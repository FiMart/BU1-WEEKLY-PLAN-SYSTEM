'use strict';
/* BU1 Weekly Plan · PDF files of the filled paper forms (user, 15 Oct 2026: "Export มาเป็น PDF ที่กรอกข้อมูลทั้งหมด";
   chose a direct .pdf download + one file for a whole booking).
   Each form's print page (csPrintHtml / jbPrintHtml) is laid out in a hidden iframe at the A4 text width, cut between rows / blocks
   (never through a row, a signature box or a heading), drawn by html-to-image (the browser renders the Thai text itself)
   and placed on A4 pages by jsPDF. The page footer (form code · number · Page x / y) is written by jsPDF in Latin letters only. */
const PDF_LIB='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const PDF_MM={p:[210,297],l:[297,210]};const PDF_M=10;const PDF_FOOT=5;
/* blocks a page may not cut through */
const PDF_ATOMS='tr,h1,h2,p,.sg,.box,.ap,.req,.iso-ctl,img';
let pdfBusy=false;

/* one document → page images [{data, h (mm)}] */
async function pdfPages(lib,fontCSS,doc){
  const [pw,ph]=PDF_MM[doc.orient]||PDF_MM.p;const cw=pw-2*PDF_M,ch=ph-2*PDF_M-PDF_FOOT;
  let W=Math.round(cw/25.4*96),H=Math.floor(W*ch/cw);
  const fr=document.createElement('iframe');fr.setAttribute('aria-hidden','true');fr.tabIndex=-1;
  fr.style.cssText=`position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;border:0;pointer-events:none`;
  document.documentElement.appendChild(fr);/* outside <body>, so the page zoom (--z) does not touch it */
  try{
    const d=fr.contentDocument;
    d.open();d.write(String(doc.html).replace('</head>',`<style>.bar{display:none!important}html,body{margin:0!important;padding:0!important;background:#fff!important;max-width:none!important}#pdfRoot{width:${W}px;background:#fff;padding:1px 0}</style></head>`));d.close();
    await new Promise(r=>{if(d.readyState==='complete')r();else{fr.onload=r;setTimeout(r,5000)}});
    d.body.innerHTML=`<div id="pdfRoot">${d.body.innerHTML}</div>`;
    const root=d.getElementById('pdfRoot');void root.offsetHeight;
    try{await Promise.race([d.fonts.ready,new Promise(r=>setTimeout(r,5000))])}catch(e){}
    await Promise.all([...d.images].map(im=>im.complete?0:new Promise(r=>{im.onload=im.onerror=r;setTimeout(r,4000)})));
    /* a table wider than the page: lay the page out as wide as it, the image is scaled down onto A4 */
    const sw=Math.ceil(root.scrollWidth);if(sw>W+2){root.style.width=sw+'px';fr.style.width=sw+'px';W=sw;H=Math.floor(W*ch/cw);void root.offsetHeight}
    const top=root.getBoundingClientRect().top;const total=Math.ceil(root.scrollHeight);
    const atoms=[...root.querySelectorAll(PDF_ATOMS)].map(el=>{const r=el.getBoundingClientRect();return {t:r.top-top,b:r.bottom-top,h2:/^H[12]$/.test(el.tagName)}});
    /* a cut is fine where no block is crossed; before a heading is better than right after it */
    const cand=new Set([total]);atoms.forEach(a=>{cand.add(Math.ceil(a.b)+1);if(a.h2)cand.add(Math.floor(a.t)-1)});
    const cuts=[...cand].filter(y=>y>0&&y<=total&&!atoms.some(a=>a.t<y-.5&&a.b>y+.5)).sort((a,b)=>a-b);
    /* only a little over one page (e.g. FLS-F-018's footer line): shrink it onto one page instead */
    const one=total>H&&total<=H*1.15;
    const spans=[];if(one)spans.push([0,total]);else for(let y=0;y<total-2;){let n=cuts.filter(c=>c>y+H*.35&&c<=y+H).pop();if(n==null)n=Math.min(total,y+H);
      /* a heading left alone at the foot of a page goes to the next one */
      const lone=atoms.find(a=>a.h2&&a.t>=y&&a.b<=n&&a.b>n-28);if(lone&&n<total&&lone.t-1>y+H*.35)n=Math.floor(lone.t)-1;
      spans.push([y,n]);y=n}
    const pr=Math.max(1,Math.min(2,15000/Math.max(1,total)));
    const canvas=await lib.toCanvas(root,{pixelRatio:pr,width:W,height:total,backgroundColor:'#ffffff',...(fontCSS?{fontEmbedCSS:fontCSS}:{skipFonts:true})});
    return spans.map(([a,b])=>{const c=document.createElement('canvas');c.width=Math.round(W*pr);c.height=Math.max(1,Math.round((b-a)*pr));
      const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(canvas,0,Math.round(a*pr),c.width,c.height,0,0,c.width,c.height);
      const h=(b-a)*cw/W;return {data:c.toDataURL('image/jpeg',.9),h:Math.min(h,ch),w:h>ch?cw*ch/h:cw}});
  }finally{fr.remove()}
}
/* docs = [{html, orient 'p'|'l', foot}] → one .pdf; each document starts on a new page */
async function pdfExport(docs,fname,btn){
  if(pdfBusy||!docs.length)return;pdfBusy=true;
  const btns=[...document.querySelectorAll('#csPdf,#jbPdf,#jbPdfAll')];const old=btn?btn.textContent:'';
  btns.forEach(b=>b.disabled=true);if(btn)btn.textContent='กำลังสร้าง PDF…';
  try{
    const [lib,jsp,fontCSS]=await Promise.all([loadLib(H2I_LIB,'htmlToImage'),loadLib(PDF_LIB,'jspdf'),shotFontCSS()]);
    const or=o=>o==='l'?'landscape':'portrait';
    const pdf=new jsp.jsPDF({unit:'mm',format:'a4',orientation:or(docs[0].orient),compress:true});let first=true;
    for(const [di,doc] of docs.entries()){
      if(btn&&docs.length>1)btn.textContent=`กำลังสร้าง PDF ${di+1}/${docs.length}…`;
      const pages=await pdfPages(lib,fontCSS,doc);const [pw,ph]=PDF_MM[doc.orient]||PDF_MM.p;
      const foot=String(doc.foot||'').replace(/[^\x20-\x7e]+/g,' ').replace(/\s+/g,' ').trim();
      pages.forEach((p,i)=>{if(!first)pdf.addPage('a4',or(doc.orient));first=false;
        pdf.addImage(p.data,'JPEG',PDF_M+(pw-2*PDF_M-p.w)/2,PDF_M,p.w,p.h,undefined,'FAST');
        pdf.setFontSize(7.5);pdf.setTextColor(98,115,143);
        if(foot)pdf.text(foot,PDF_M,ph-PDF_M+1);pdf.text(`Page ${i+1} / ${pages.length}`,pw-PDF_M,ph-PDF_M+1,{align:'right'})});
    }
    await saveFile(fname,pdf.output('blob'),'ดาวน์โหลดไฟล์ PDF แล้ว');
  }catch(e){toast('สร้าง PDF ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ หรือกด "พิมพ์" แล้วเลือกบันทึกเป็น PDF')}
  finally{pdfBusy=false;btns.forEach(b=>b.disabled=false);if(btn)btn.textContent=old}
}
