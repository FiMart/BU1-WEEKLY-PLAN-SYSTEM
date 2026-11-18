'use strict';
/* BU1 Weekly Plan · QR code on the paper head + scanning (user, 18 Nov 2026: "เพิ่ม data flow meter check sheet และ เพิ่มระบบการสแกน qr code อยู่บนหัวกระดาษ";
   chose: the QR opens that Check Sheet (an older paper QR that holds only a PN, like "PN-26-10020", opens that PN's plan) · scanned by a phone's own
   camera (the QR is a link to this app) and by สแกน QR in the app · on every Check Sheet and on FLS-F-018).
   QR = <this app>?cs=<check id> | ?job=<booking id> (?pn=<PN> also works). The link is kept through sign-in (sessionStorage) and opened once the
   data is ready (deepLinkTry, from render()). Libraries load from jsDelivr only when needed: qrcode-generator (making) and jsQR (reading, when the
   browser has no BarcodeDetector). */
const QR_LIB='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const QR_READ_LIB='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
/* make sure the QR maker is loaded before a print page is built (resolves null when offline: the page prints without the QR) */
const qrReady=()=>loadLib(QR_LIB,'qrcode').catch(()=>null);
const qrLink=(k,id)=>`${location.origin}${location.pathname}?${k}=${encodeURIComponent(id)}`;
/* the QR as an <img> (GIF data URL: prints, goes into PDF files and downloaded copies); '' when the maker is not loaded */
function qrImg(text,px){
  if(typeof window.qrcode!=='function')return '';
  try{const q=window.qrcode(0,'M');q.addData(text);q.make();return `<img class="qr" src="${q.createDataURL(4,0)}" width="${px}" height="${px}" alt="QR" style="display:block;width:${px}px;height:${px}px;image-rendering:pixelated">`}catch(e){return ''}
}
/* the block on a print head: QR + the lines under it */
const qrBlock=(link,lines,px)=>{const img=qrImg(link,px||62);return img?`<div style="display:grid;justify-items:center;gap:1px;font-size:8.5px;line-height:1.2;text-align:center">${img}${lines.filter(Boolean).map(l=>`<span style="white-space:nowrap">${esc(l)}</span>`).join('')}</div>`:''};

/* ---------- opening a document from a link / a scan ---------- */
const QR_DL={k:'',v:''};
(()=>{try{const p=new URLSearchParams(location.search);for(const k of ['cs','job','pn']){const v=p.get(k);if(v){QR_DL.k=k;QR_DL.v=v;sessionStorage.setItem('bu1wp.qrdl',k+'|'+v);break}}
  if(!QR_DL.k){const s=sessionStorage.getItem('bu1wp.qrdl');if(s){const i=s.indexOf('|');QR_DL.k=s.slice(0,i);QR_DL.v=s.slice(i+1)}}}catch(e){}})();
function qrClear(){QR_DL.k='';try{sessionStorage.removeItem('bu1wp.qrdl');const u=new URL(location.href);['cs','job','pn'].forEach(x=>u.searchParams.delete(x));history.replaceState(history.state,'',u.pathname+u.search+u.hash)}catch(e){}}
/* called at the end of every render(): opens the linked document once signed in and its list is read */
function deepLinkTry(){
  if(!QR_DL.k||notReady()||S.mode==='connecting')return;
  const k=QR_DL.k,v=QR_DL.v;if(k==='cs'&&!S.checksReady||k==='job'&&!S.jobsReady)return;
  qrClear();setTimeout(()=>qrGo(k,v),0);
}
function qrGo(k,v){
  v=String(v||'').trim();
  if(k==='cs'){const c=csById(v)||S.checks.find(x=>String(x.no).toUpperCase()===v.toUpperCase());if(c){openCs(c.id);return}toast('ไม่พบ Check Sheet นี้ในระบบ (อาจถูกลบไปแล้ว)');return}
  if(k==='job'){const j=jbById(v)||S.jobs.find(x=>String(x.jobNo).toUpperCase()===v.toUpperCase());if(j){goView('jobs');openJob(j.id);return}toast('ไม่พบใบรับคำร้องนี้ในระบบ');return}
  if(k==='pn')qrPn(v);
}
/* a PN: one plan opens straight away; several days (or a booking only) open ค้นหาด่วน with the PN, which lists every plan, booking and sheet of it */
async function qrPn(pn){
  pn=pn.toUpperCase();const pool=new Map();
  (typeof NTF!=='undefined'&&NTF.range||[]).concat(S.tasks,[...known.values()],ALL.data||[]).forEach(t=>{if(t&&String(t.planNo).toUpperCase()===pn)pool.set(t.id,t)});
  if(!pool.size){try{(await Store.where('tasks','planNo','==',pn)).forEach(t=>{t=normTask(t);known.set(t.id,t);pool.set(t.id,t)})}catch(e){}}
  const l=[...pool.values()];
  if(l.length===1){openTask(l[0].id);return}
  if(!l.length&&!S.jobs.some(j=>String(j.planNo).toUpperCase()===pn)&&!S.checks.some(c=>String(c.planNo).toUpperCase()===pn)){toast(`ไม่พบ ${pn} ในระบบ`);return}
  qkOpen();$('#qkQ').value=pn;qkDraw();
}
/* what a scanned QR holds: a link of this app (any address), a Check Sheet / booking number, or a PN */
function qrHandle(txt){
  const s=String(txt||'').trim();
  try{const u=new URL(s);for(const k of ['cs','job','pn']){const v=u.searchParams.get(k);if(v){qrGo(k,v);return}}}catch(e){}
  const S2=s.toUpperCase();const cs=S2.match(/\b(QC|DF|RR|SR)-\d{2}-\d{5}\b/);const jb=S2.match(/\bJB-\d{2}-\d{5}\b/);const pn=S2.match(/\bPN-\d{2}-\d{5}\b/);
  if(cs){qrGo('cs',cs[0]);return}if(jb){qrGo('job',jb[0]);return}if(pn){qrGo('pn',pn[0]);return}
  toast(`QR นี้ไม่ใช่เอกสารของระบบ: ${s.slice(0,60)}`);
}

/* ---------- สแกน QR in the app: the camera (BarcodeDetector, else jsQR), or a photo from the device ---------- */
const QR_SCAN={stream:null,raf:0,det:null,busy:false,cv:null};
function qrMsg(m,bad){const p=$('#qrMsg');if(p){p.textContent=m;p.classList.toggle('bad',!!bad)}}
async function qrScan(){
  let d=$('#qrDlg');
  if(!d){d=document.createElement('dialog');d.id='qrDlg';d.className='qr-dlg';d.setAttribute('aria-labelledby','qrT');document.body.appendChild(d);
    d.innerHTML=`<div class="qr-wrap"><header><b id="qrT">สแกน QR code</b><button type="button" class="icon-btn" data-qr-close aria-label="ปิด">✕</button></header>
      <div class="qr-cam"><video id="qrVid" playsinline muted></video><i class="qr-aim" aria-hidden="true"></i></div><p id="qrMsg" class="qr-msg" role="status"></p>
      <div class="qr-act"><label class="btn"><input type="file" id="qrFile" accept="image/*" class="sr-only">เลือกรูปถ่าย QR</label><button type="button" class="btn" data-qr-close>ปิด</button></div></div>`;
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-qr-close]'))d.close()});
    d.addEventListener('close',qrStop);
    $('#qrFile').addEventListener('change',async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;qrMsg('กำลังอ่านรูป…');
      const img=new Image();const u=URL.createObjectURL(f);try{img.src=u;await img.decode();const t=await qrRead(img);if(t){d.close();qrHandle(t)}else qrMsg('อ่าน QR ในรูปไม่ได้ · ถ่ายให้ QR ชัดและเต็มกรอบมากขึ้น',true)}
      catch(err){qrMsg('เปิดรูปนี้ไม่ได้',true)}finally{URL.revokeObjectURL(u)}})}
  if(!d.open)d.showModal();qrMsg('กำลังเปิดกล้อง…');
  if(!QR_SCAN.det&&'BarcodeDetector' in window){try{const f=await window.BarcodeDetector.getSupportedFormats();if(f.includes('qr_code'))QR_SCAN.det=new window.BarcodeDetector({formats:['qr_code']})}catch(e){}}
  if(!QR_SCAN.det)loadLib(QR_READ_LIB,'jsQR').catch(()=>{});
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('nocam');
    QR_SCAN.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(!d.open){qrStop();return}
    const v=$('#qrVid');v.srcObject=QR_SCAN.stream;await v.play();qrMsg('ส่องกล้องไปที่ QR code บนหัวกระดาษ');qrLoop();
  }catch(e){qrMsg(e&&e.name==='NotAllowedError'?'ไม่ได้รับอนุญาตให้ใช้กล้อง · กด "เลือกรูปถ่าย QR" แทนได้':'เปิดกล้องไม่ได้ · กด "เลือกรูปถ่าย QR" แทนได้',true)}
}
/* the text of the first QR in a video frame / picture, or null */
async function qrRead(src){
  if(QR_SCAN.det){try{const r=await QR_SCAN.det.detect(src);if(r&&r[0])return r[0].rawValue}catch(e){}}
  if(!window.jsQR){try{await loadLib(QR_READ_LIB,'jsQR')}catch(e){return null}}
  const w=src.videoWidth||src.naturalWidth||src.width,h=src.videoHeight||src.naturalHeight||src.height;if(!w||!h)return null;
  const sc=Math.min(1,900/Math.max(w,h));const cv=QR_SCAN.cv||(QR_SCAN.cv=document.createElement('canvas'));cv.width=Math.round(w*sc);cv.height=Math.round(h*sc);
  const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,cv.width,cv.height);const im=x.getImageData(0,0,cv.width,cv.height);
  const r=window.jsQR(im.data,im.width,im.height,{inversionAttempts:'attemptBoth'});return r&&r.data?r.data:null;
}
function qrLoop(){
  const v=$('#qrVid');let last=0;
  const tick=async now=>{if(!QR_SCAN.stream)return;QR_SCAN.raf=requestAnimationFrame(tick);if(QR_SCAN.busy||now-last<200||v.readyState<2)return;last=now;QR_SCAN.busy=true;
    try{const t=await qrRead(v);if(t&&QR_SCAN.stream){const d=$('#qrDlg');if(d&&d.open)d.close();qrHandle(t)}}finally{QR_SCAN.busy=false}};
  QR_SCAN.raf=requestAnimationFrame(tick);
}
function qrStop(){cancelAnimationFrame(QR_SCAN.raf);if(QR_SCAN.stream){QR_SCAN.stream.getTracks().forEach(t=>t.stop());QR_SCAN.stream=null}const v=$('#qrVid');if(v)v.srcObject=null}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-qr-scan]');if(b)qrScan()});
