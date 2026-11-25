'use strict';
/* BU1 Weekly Plan · Preview for every kind of file (user, 25 Nov 2026: "ไฟล์แนบที่ต่อจาก Detail แก้ไขให้สามารถเปิดไฟล์ดูตัวอย่างได้ทุกนามสกุลไฟล์").
   previewFile (js/dialog/attachments.js) shows pictures, PDF, video and audio itself and hands every other file to fpvShow:
   Word .docx (docx-preview) · Excel .xlsx .xls .ods .csv (SheetJS, one tab a sheet) · PowerPoint .pptx (text + pictures of each slide, JSZip) ·
   .zip (the list inside) · Word / PowerPoint / Outlook files of the old kind (.doc .ppt .msg: the text inside only) · anything that is text
   (.txt .cfg .log .json .xml .html …, shown as plain text, never run) · any other file is checked: text is shown, a program's own file says so.
   Libraries load from jsDelivr / cdnjs only when such a file is opened. Everything is drawn from the file's bytes; nothing is sent anywhere. */
const FPV_JSZIP='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const FPV_DOCX='https://cdn.jsdelivr.net/npm/docx-preview@0.3.2/dist/docx-preview.min.js';
const FPV_IMG=/^(png|jpe?g|gif|webp|bmp|avif|ico|svg|jfif)$/;
const FPV_VIDEO=/^(mp4|m4v|webm|mov|ogv)$/;
const FPV_AUDIO=/^(mp3|wav|m4a|aac|oga|ogg|flac|opus)$/;
const FPV_TEXT=/^(txt|log|json|xml|html?|xhtml|md|ini|cfg|conf|config|yaml|yml|js|css|sql|bat|cmd|ps1|py|sh|eml|rtf|tsv|prn|dat|lst|nfo|properties|reg)$/;
let fvExtra=[];/* object URLs made for one preview (slide pictures, …), revoked when the dialog closes */
const fpvExt=n=>{const s=String(n||'');return s.includes('.')?s.split('.').pop().toLowerCase():''};
const fpvUrl=b=>{const u=URL.createObjectURL(b);fvExtra.push(u);return u};
function fpvClean(){fvExtra.forEach(u=>URL.revokeObjectURL(u));fvExtra=[]}
const fpvNone=(ext,msg)=>`<div class="fpv-none"><span class="fext" data-ext="${esc(ext.toUpperCase()||'FILE')}">${esc(ext.toUpperCase()||'FILE')}</span><p>${msg}</p></div>`;
const fpvNote=t=>`<p class="fpv-note">${t}</p>`;
/* text of a file: UTF-8, or Thai Windows-874 when UTF-8 does not fit */
function fpvDecode(buf){
  const u8=new Uint8Array(buf);let t=new TextDecoder('utf-8').decode(u8);
  const bad=(t.match(/�/g)||[]).length;if(bad>t.length*0.01){try{t=new TextDecoder('windows-874').decode(u8)}catch(e){}}
  return t.replace(/^﻿/,'');
}
/* bytes that read as text (few control characters / no NUL) */
function fpvIsText(buf){const u8=new Uint8Array(buf.slice(0,65536));if(!u8.length)return true;let bad=0;for(const c of u8){if(c===0)return false;if(c<9||(c>13&&c<32))bad++}return bad/u8.length<0.02}
const fpvPre=(t,cap)=>{const big=t.length>(cap||600000);return `${big?fpvNote(`ไฟล์ยาวมาก แสดง ${Math.round((cap||600000)/1000)}K ตัวอักษรแรก · ดาวน์โหลดเพื่อดูทั้งหมด`):''}<pre class="fpv-pre">${esc(big?t.slice(0,cap||600000):t)}</pre>`};
/* the words inside an old Office file (.doc .ppt .msg): runs of UTF-16 text, else of plain bytes */
function fpvStrings(buf){
  const u8=new Uint8Array(buf);const out=[];let cur='';
  const ok=c=>(c>=32&&c<127)||(c>=0x0E00&&c<=0x0E7F)||c===9;
  for(let i=0;i+1<u8.length;i+=2){const c=u8[i]|(u8[i+1]<<8);if(ok(c))cur+=String.fromCharCode(c);else{if(cur.trim().length>=4)out.push(cur.trim());cur=''}}
  if(cur.trim().length>=4)out.push(cur.trim());
  if(out.join('').length<200){cur='';for(const c of u8){if(c>=32&&c<127)cur+=String.fromCharCode(c);else{if(cur.trim().length>=6)out.push(cur.trim());cur=''}}}
  return out.filter((x,i,a)=>a.indexOf(x)===i).join('\n');
}
/* the body for a file previewFile does not show itself; stale = a newer file was opened meanwhile */
async function fpvShow(body,b,f,stale){
  const ext=fpvExt(f.name);const put=h=>{if(!stale())body.innerHTML=h};
  try{
    if(/^(docx|docm|dotx|dotm)$/.test(ext)){
      put('<p class="fpv-msg">กำลังเปิดไฟล์ Word…</p>');await loadLib(FPV_JSZIP,'JSZip');await loadLib(FPV_DOCX,'docx');if(stale())return;
      body.innerHTML='<div class="fpv-fill fpv-docx"></div>';await window.docx.renderAsync(b,body.firstChild,null,{className:'docx',inWrapper:true,breakPages:true,useBase64URL:true,ignoreLastRenderedPageBreak:true});return}
    if(/^(xlsx|xlsm|xlsb|xls|ods|csv|xltx)$/.test(ext)){
      put('<p class="fpv-msg">กำลังเปิดไฟล์ Excel…</p>');const X=await loadXLSX();const buf=await b.arrayBuffer();if(stale())return;
      const wb=ext==='csv'?X.read(fpvDecode(buf),{type:'string'}):X.read(buf,{type:'array'});
      const sheets=wb.SheetNames.map(n=>{const ws=wb.Sheets[n];let cut=false;
        if(ws['!ref']){const r=X.utils.decode_range(ws['!ref']);if(r.e.r-r.s.r>999||r.e.c-r.s.c>59){cut=true;r.e.r=Math.min(r.e.r,r.s.r+999);r.e.c=Math.min(r.e.c,r.s.c+59);ws['!ref']=X.utils.encode_range(r)}}
        return {n,cut,html:ws['!ref']?X.utils.sheet_to_html(ws,{header:'',footer:''}):'<p class="fpv-msg">แผ่นงานนี้ว่าง</p>'}});
      put(`<div class="fpv-fill fpv-xl">${sheets.length>1?`<div class="fpv-tabs" role="tablist">${sheets.map((s,i)=>`<button type="button" role="tab" data-fpv-sheet="${i}" aria-selected="${!i}">${esc(s.n)}</button>`).join('')}</div>`:''}
        ${sheets.map((s,i)=>`<div class="fpv-sheet" data-fpv-pane="${i}"${i?' hidden':''}>${s.cut?fpvNote('แผ่นงานใหญ่ แสดง 1,000 แถว · 60 คอลัมน์แรก'):''}${s.html}</div>`).join('')}</div>`);return}
    if(/^(pptx|ppsx|potx|pptm)$/.test(ext)){
      put('<p class="fpv-msg">กำลังเปิดไฟล์ PowerPoint…</p>');await loadLib(FPV_JSZIP,'JSZip');const zip=await window.JSZip.loadAsync(b);if(stale())return;
      const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,c)=>Number(a.match(/\d+/)[0])-Number(c.match(/\d+/)[0]));
      const xml=s=>new DOMParser().parseFromString(s,'application/xml');const slides=[];
      for(const [i,n] of names.entries()){
        const doc=xml(await zip.file(n).async('string'));
        const paras=[...doc.getElementsByTagNameNS('*','p')].filter(p=>p.namespaceURI&&p.namespaceURI.includes('drawingml')).map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('')).filter(x=>x.trim());
        const imgs=[];const rel=zip.file(n.replace('slides/','slides/_rels/')+'.rels');
        if(rel){for(const r of xml(await rel.async('string')).getElementsByTagNameNS('*','Relationship')){const tg=r.getAttribute('Target')||'';if(!/\/image$/.test(r.getAttribute('Type')||'')||!FPV_IMG.test(fpvExt(tg)))continue;
          const p=('ppt/slides/'+tg).split('/').reduce((a,x)=>{if(x==='..')a.pop();else if(x!=='.')a.push(x);return a},[]).join('/');const fz=zip.file(p);if(fz)imgs.push(fpvUrl(await fz.async('blob')))}}
        slides.push(`<section class="fpv-slide"><b>สไลด์ ${i+1}</b>${paras.map(x=>`<p>${esc(x)}</p>`).join('')||'<p class="fpv-msg">ไม่มีข้อความ</p>'}${imgs.map(u=>`<img src="${u}" alt="">`).join('')}</section>`)}
      put(`<div class="fpv-fill fpv-slides">${fpvNote(`PowerPoint ${slides.length} สไลด์ · แสดงข้อความและรูปของแต่ละสไลด์ (การจัดวาง สี แอนิเมชันดูได้เมื่อดาวน์โหลดไปเปิดด้วย PowerPoint)`)}${slides.join('')}</div>`);return}
    if(ext==='zip'){
      put('<p class="fpv-msg">กำลังเปิดไฟล์ zip…</p>');await loadLib(FPV_JSZIP,'JSZip');const zip=await window.JSZip.loadAsync(b);if(stale())return;
      const rows=Object.values(zip.files).map(e=>`<tr><td>${e.dir?'📁 ':''}${esc(e.name)}</td><td class="n">${e.dir?'':fmtSize((e._data&&e._data.uncompressedSize)||0)}</td><td>${e.date?esc(fmtShort(e.date)):''}</td></tr>`).join('');
      put(`<div class="fpv-fill fpv-zip">${fpvNote(`ไฟล์ข้างใน ${Object.values(zip.files).filter(e=>!e.dir).length} ไฟล์ · ดาวน์โหลดแล้วแตกไฟล์เพื่อเปิดแต่ละไฟล์`)}<table class="mini"><thead><tr><th>ชื่อ</th><th class="n">ขนาด</th><th>วันที่</th></tr></thead><tbody>${rows}</tbody></table></div>`);return}
    const buf=await b.arrayBuffer();if(stale())return;
    if(/^(doc|dot|ppt|pps|msg|wps|pub)$/.test(ext)){const t=fpvStrings(buf);
      put(t?`<div class="fpv-fill">${fpvNote(`ไฟล์ .${esc(ext)} แบบเก่า · แสดงเฉพาะข้อความในไฟล์ (รูปแบบ ตาราง รูป ดูได้เมื่อดาวน์โหลดไปเปิดด้วยโปรแกรม)`)}${fpvPre(t)}</div>`:fpvNone(ext,`ไฟล์ .${esc(ext)} นี้ไม่มีข้อความที่อ่านได้ · กด <b>ดาวน์โหลด</b> แล้วเปิดด้วยโปรแกรมในเครื่อง`));return}
    if(FPV_TEXT.test(ext)||fpvIsText(buf)){put(`<div class="fpv-fill">${/^(html?|xhtml|xml|svg)$/.test(ext)?fpvNote('แสดงเป็นข้อความต้นฉบับ (ไม่เปิดเป็นหน้าเว็บ เพื่อความปลอดภัย)'):''}${fpvPre(fpvDecode(buf))}</div>`);return}
    put(fpvNone(ext,`ไฟล์ .${esc(ext||'?')} เป็นไฟล์ของโปรแกรมเฉพาะ (${esc(fmtSize(b.size))}) เบราว์เซอร์แสดงเนื้อหาไม่ได้<br>กด <b>ดาวน์โหลด</b> แล้วเปิดด้วยโปรแกรมของไฟล์นั้น`));
  }catch(e){put(fpvNone(ext,`เปิดดูไฟล์นี้ไม่สำเร็จ${navigator.onLine===false?' (ออฟไลน์อยู่ · ตัวเปิดไฟล์ต้องใช้อินเทอร์เน็ตครั้งแรก)':' (ไฟล์อาจเสียหรือมีรหัสผ่าน)'}<br>กด <b>ดาวน์โหลด</b> แล้วเปิดด้วยโปรแกรมในเครื่อง`))}
}
/* Excel: one sheet at a time */
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-fpv-sheet]');if(!t)return;const box=t.closest('.fpv-xl');const i=t.dataset.fpvSheet;
  box.querySelectorAll('[data-fpv-sheet]').forEach(b=>b.setAttribute('aria-selected',String(b===t)));box.querySelectorAll('[data-fpv-pane]').forEach(p=>{p.hidden=p.dataset.fpvPane!==i})});
