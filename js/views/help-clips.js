'use strict';
/* BU1 Weekly Plan · คลิปสอนการใช้งาน (user, 10 Oct 2026: "เพิ่มคลิปสอนวิธีการใช้ระบบ"; chose animated clips in the help page)
   Each clip = real screens of the app (assets/help/<frame>.jpg, sample data, light theme) played one step at a time:
   the picture eases in, a highlight box and a pointer move to the button of the step, the caption explains it.
   r = the highlight box in pixels of the frame (w × h), measured from the page when the frame was made.
   The frames are only loaded when a clip is opened (cards use the first frame, lazy). */
const CLIP_DESK={w:1280,h:800},CLIP_PHONE={w:390,h:844};
const HELP_CLIPS=[
  {id:'add',title:'ลงแผนงานใหม่',sub:'ตั้งแต่กดเพิ่มแผนจนบันทึก',size:CLIP_DESK,steps:[
    {f:'add-1',r:[571,13,106,32],t:'กด “+ เพิ่มแผนงาน” มุมขวาบน หรือชี้ช่องของวันในตารางแล้วกด + (ระบบเลือกวันและหัวข้องานให้)'},
    {f:'add-2',r:[503,104,748,37],t:'พิมพ์หรือเลือกหัวข้องาน ถ้าเป็นหัวข้อใหม่ กด “+ เพิ่ม … เข้าข้อมูลหลัก” ได้ทันที'},
    {f:'add-3',r:[503,225,247,37],t:'ใส่ Plan No. รูปแบบ PN-YY-MMNNN · สีของแผนตาม Plan No. อัตโนมัติ หรือกดเลือกสีเอง'},
    {f:'add-4',r:[493,494,768,155],t:'ใส่ลูกค้า สถานที่ วันที่ ช่วงเวลา (เช้า / บ่าย / ทั้งวัน) และเวลา · งานหลายวันใส่ “ถึงวันที่”'},
    {f:'add-5',r:[361,699,887,42],t:'เลือกวิธีเดินทาง (ไม่บังคับ): รถแผนก · รถ GA · ขอรถไปเอง · กดซ้ำเพื่อยกเลิก'},
    {f:'add-6',r:[361,681,887,59],t:'ใส่จำนวนคนที่งานต้องใช้ แล้วติ๊กชื่อใน Team Service ระบบบอกทันทีว่ายังขาดกี่คน'},
    {f:'add-7',r:[1129,753,132,36],t:'กด “บันทึก” แผนขึ้นบนตารางทันที ทุกคนในทีมเห็นพร้อมกัน'}]},
  {id:'view',title:'เปิดแผน อัปเดตสถานะ และแนบเอกสาร',sub:'งานที่ทำทุกวันหลังออกหน้างาน',size:CLIP_DESK,steps:[
    {f:'view-1',r:[602,534,124,266],t:'กดการ์ดแผนบนตารางเพื่อเปิดรายละเอียด'},
    {f:'view-2',r:[762,692,464,48],t:'บันทึกสถานะงานได้ทันที: วางแผน · เสร็จแล้ว · ไม่เสร็จ (เปิด NCR) · เลื่อน · ยกเลิก'},
    {f:'view-3',r:[762,373,484,364],t:'เอกสารหลังจบงาน: อัปโหลดแยกตามเอกสาร Service Report · QC · ใบรับงาน · เอกสารอื่น ๆ'},
    {f:'view-4',r:[748,602,513,138],t:'หมายเหตุ: พิมพ์แล้วกด “บันทึกหมายเหตุ” ทุกคนเห็นบนการ์ดและข้อความ LINE'},
    {f:'view-5',r:[1183,753,78,36],t:'ต้องการแก้รายละเอียด กด “แก้ไข” (ตามสิทธิ์ของบัญชี)'}]},
  {id:'pick',title:'เลือกหลายแผน: ย้ายวัน · เปลี่ยนสี · ลบ',sub:'จัดการทีละหลายแผนในครั้งเดียว',size:CLIP_DESK,steps:[
    {f:'pick-1',r:[682,13,123,32],t:'กด “เลือกหลายแผน” ข้างปุ่มเพิ่มแผนงาน (เลื่อนลงไปแล้วมีปุ่มลอยมุมขวาล่าง)'},
    {f:'pick-2',r:[602,325,124,185],t:'กดการ์ดเพื่อติ๊กเลือก เลือกได้หลายแผนหลายวัน'},
    {f:'pick-3',r:[662,660,194,37],t:'ย้ายไปวันที่: เลือกวันแล้วกด “ย้าย” แผนอื่นที่เลือกเลื่อนตามระยะห่างเดิม'},
    {f:'pick-4',r:[334,741,611,31],t:'เปลี่ยนสีของแผนที่เลือกทั้งหมดในคลิกเดียว (หรือกลับไปใช้สีตาม Plan No.)'},
    {f:'pick-5',r:[577,705,71,29],t:'ลบแผนที่เลือก ระบบถามยืนยันก่อนทุกครั้ง · กด “เสร็จ” หรือ Esc เมื่อเลิกเลือก'}]},
  {id:'filter',title:'กรองและค้นหาแผน',sub:'สายงาน · ทีม · หัวข้องาน · ลูกค้า',size:CLIP_DESK,steps:[
    {f:'filter-1',r:[228,55,426,34],t:'แท็บสายงาน: ทั้งหมด · Flow Meter · Instrument พร้อมจำนวนแผน'},
    {f:'filter-2',r:[910,56,352,32],t:'แท็บทีม: ทุกทีม · Lab On-Site · Lab แสดงเฉพาะแผนและคนของทีมนั้น'},
    {f:'filter-3',r:[672,140,266,226],t:'Drop Down หัวข้องาน / ลูกค้า ติ๊กได้หลายรายการ มีช่องค้นหาลูกค้า กด “ล้าง” เพื่อดูทั้งหมด'},
    {f:'filter-4',r:[228,100,247,35],t:'ช่องค้นหา: พิมพ์ Plan No. ลูกค้า สถานที่ หรือรายละเอียด'}]},
  {id:'share',title:'ส่งแผนเข้า LINE · พิมพ์ · Excel',sub:'แจกแผนให้ทีม',size:CLIP_DESK,steps:[
    {f:'share-1',r:[744,51,228,287],t:'คัดลอกแผนส่ง LINE: เลือกวัน ได้ข้อความแผนของวันนั้นพร้อมวางในกลุ่ม'},
    {f:'share-2',r:[977,13,109,32],t:'Screenshot: บันทึกตารางทั้งสัปดาห์เป็นรูป ส่งต่อได้ทันที'},
    {f:'share-3',r:[1092,13,107,32],t:'Print / PDF: แผนสัปดาห์ขนาด A3 แนวนอน พร้อมเลขที่เอกสาร ISO'},
    {f:'share-4',r:[1205,13,56,32],t:'Excel: แผนทั้งสัปดาห์และสรุปรายคนเป็นไฟล์ .xlsx'}]},
  {id:'pages',title:'Booking Plan · สรุปรายคน · Dashboard',sub:'ดูภาพรวมและรายงาน',size:CLIP_DESK,steps:[
    {f:'pages-1',r:[228,111,1033,101],t:'Booking Plan: การจองทุกสัปดาห์ในหน้าเดียว กรองสถานะ ช่วงวันที่ รถ และลูกค้า'},
    {f:'pages-2',r:[229,302,1031,66],t:'กดแถวเพื่อเปิดแผนนั้น สีแถบซ้ายคือสีของแผน'},
    {f:'pages-3',r:[229,220,1031,580],t:'สรุปรายคน: งานของแต่ละคนในแต่ละวัน คนที่ว่าง และรถรายวัน'},
    {f:'pages-4',r:[228,371,1033,159],t:'Dashboard: ตัวเลขสรุปรายสัปดาห์ / เดือน / ไตรมาส / ปี พิมพ์รายงานหรือ Excel ได้'}]},
  {id:'phone',title:'ใช้งานบนมือถือ',sub:'แผนรายวันในมือ',size:CLIP_PHONE,steps:[
    {f:'phone-1',r:[14,105,362,40],t:'แถวบนสุด: + เพิ่มแผนงาน · เลือกหลายแผน · ส่ง LINE'},
    {f:'phone-2',r:[15,343,360,91],t:'แตะวันที่เพื่อดูแผนของวันนั้น หรือปัดซ้าย-ขวาเปลี่ยนวัน'},
    {f:'phone-3',r:[29,540,332,147],t:'แผนของวันจัดตามหัวข้องาน แตะการ์ดเพื่อเปิดรายละเอียดและอัปเดตสถานะ'},
    {f:'phone-4',r:[0,778,390,66],t:'แถบเมนูด้านล่าง: แผนงาน · Booking · Safety · รายคน · เพิ่มเติม (หน้าอื่น) · ดึงหน้าลงเพื่อโหลดใหม่'}]},
];
const CLIP_STEP_MS=5200;
const clipSrc=f=>`assets/help/${f}.jpg`;
const clipSecs=c=>Math.round(c.steps.length*CLIP_STEP_MS/1000);
/* the cards at the top of the help page */
function helpClipsHtml(){
  return `<section class="panel help-sec help-clips" id="help-clips"><h2><span class="step">▶</span>คลิปสอนการใช้งาน</h2>
    <p>กดคลิปเพื่อดูทีละขั้น ภาพจริงจากระบบ (ข้อมูลตัวอย่าง) · เล่นอัตโนมัติ กดหยุด ย้อน หรือข้ามได้ · ปุ่มลูกศร ← → และ Space บนคีย์บอร์ดก็ใช้ได้</p>
    <div class="clip-cards">${HELP_CLIPS.map((c,i)=>`<button type="button" class="clip-card${c.size===CLIP_PHONE?' phone':''}" data-clip="${c.id}">
      <span class="clip-thumb"><img src="${clipSrc(c.steps[0].f)}" alt="" loading="lazy" decoding="async"><i class="clip-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></i></span>
      <span class="clip-meta"><b>${i+1}. ${esc(c.title)}</b><small>${esc(c.sub)} · ${c.steps.length} ขั้น · ≈ ${clipSecs(c)} วินาที</small></span></button>`).join('')}</div></section>`;
}
/* ---------- player ---------- */
const CP={clip:null,i:0,playing:false,t0:0,done:0,raf:0};
function clipDlg(){
  let d=$('#clipDlg');if(d)return d;
  d=document.createElement('dialog');d.id='clipDlg';d.className='clip-dlg';d.setAttribute('aria-labelledby','clipTitle');
  d.innerHTML=`<div class="clip-wrap">
    <header class="clip-head"><b id="clipTitle"></b><span class="clip-count" id="clipCount"></span><span class="grow"></span>
      <button type="button" class="icon-btn" data-clip-full aria-label="เต็มจอ" title="เต็มจอ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      <button type="button" class="icon-btn" data-clip-close aria-label="ปิด">✕</button></header>
    <div class="clip-stage" id="clipStage"><div class="clip-cam" id="clipCam"><img id="clipImg" alt=""><div class="clip-hl" id="clipHl"></div><div class="clip-ptr" id="clipPtr" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10.5 19z"/></svg><i></i></div></div></div>
    <p class="clip-cap" id="clipCap" aria-live="polite"></p>
    <div class="clip-ctl"><button type="button" class="icon-btn" data-clip-go="-1" aria-label="ขั้นก่อนหน้า">‹</button>
      <button type="button" class="icon-btn clip-pp" data-clip-pp aria-label="หยุด"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="ic-pause" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/><path class="ic-play" d="M8 5.5v13l11-6.5z"/></svg></button>
      <button type="button" class="icon-btn" data-clip-go="1" aria-label="ขั้นถัดไป">›</button>
      <div class="clip-bars" id="clipBars"></div></div></div>`;
  document.body.appendChild(d);
  const done=()=>{clipStop();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{})};
  d.addEventListener('close',done);d.addEventListener('cancel',done);/* Esc */
  const close0=d.close.bind(d);d.close=v=>{done();close0(v)};/* ✕ / backdrop / code */
  d.addEventListener('click',e=>{if(e.target===d)d.close()});
  return d;
}
function openClip(id){
  const c=HELP_CLIPS.find(x=>x.id===id);if(!c)return;const d=clipDlg();
  CP.clip=c;CP.i=0;$('#clipTitle').textContent=c.title;
  d.classList.toggle('phone',c.size===CLIP_PHONE);$('#clipStage').style.setProperty('--ar',c.size.w/c.size.h);
  $('#clipBars').innerHTML=c.steps.map((s,i)=>`<button type="button" class="clip-bar" data-clip-to="${i}" aria-label="ขั้นที่ ${i+1}"><i></i></button>`).join('');
  c.steps.forEach(s=>{const im=new Image();im.src=clipSrc(s.f)});/* preload this clip only */
  if(!d.open)d.showModal();clipShow(0);clipPlay(true);
}
function clipShow(i){
  const c=CP.clip;if(!c)return;CP.i=Math.max(0,Math.min(c.steps.length-1,i));const s=c.steps[CP.i];const W=c.size.w,H=c.size.h;
  const [x,y,w,h]=s.r;const rx=Math.max(0,x),ry=Math.max(0,y),rw=Math.min(W,x+w)-rx,rh=Math.min(H,y+h)-ry;
  const pct=(v,t)=>(v/t*100).toFixed(3)+'%';
  const img=$('#clipImg'),cam=$('#clipCam'),hl=$('#clipHl'),ptr=$('#clipPtr');
  cam.classList.remove('show');void cam.offsetWidth;
  img.src=clipSrc(s.f);img.alt=s.t;
  hl.style.left=pct(rx,W);hl.style.top=pct(ry,H);hl.style.width=pct(rw,W);hl.style.height=pct(rh,H);
  /* the pointer ends on the middle of the box (lower half for tall boxes); the camera eases toward it */
  const cx=rx+rw/2,cy=ry+Math.min(rh/2,40);ptr.style.left=pct(cx,W);ptr.style.top=pct(cy,H);
  cam.style.transformOrigin=`${pct(cx,W)} ${pct(ry+rh/2,H)}`;
  requestAnimationFrame(()=>cam.classList.add('show'));
  $('#clipCap').innerHTML=`<b>${CP.i+1}</b>${esc(s.t)}`;$('#clipCount').textContent=`ขั้นที่ ${CP.i+1} / ${c.steps.length}`;
  document.querySelectorAll('#clipBars .clip-bar').forEach((b,j)=>{b.classList.toggle('done',j<CP.i);b.classList.toggle('on',j===CP.i);b.querySelector('i').style.width=j<CP.i?'100%':'0%'});
  CP.done=0;CP.t0=performance.now();
}
function clipTick(now){
  if(!CP.playing||!CP.clip)return;
  const dl=$('#clipDlg');if(!dl||!dl.open){clipStop();return}/* closed by Esc / backdrop: stop here too */
  const el=CP.done+(now-CP.t0);const bar=document.querySelector('#clipBars .clip-bar.on i');
  if(bar)bar.style.width=Math.min(100,el/CLIP_STEP_MS*100)+'%';
  if(el>=CLIP_STEP_MS){if(CP.i<CP.clip.steps.length-1)clipShow(CP.i+1);else{clipPlay(false);return}}
  CP.raf=requestAnimationFrame(clipTick);
}
function clipPlay(on){
  CP.playing=on;cancelAnimationFrame(CP.raf);const b=document.querySelector('#clipDlg [data-clip-pp]');
  if(b){b.classList.toggle('paused',!on);b.setAttribute('aria-label',on?'หยุด':'เล่น')}
  if(on){if(CP.clip&&CP.i===CP.clip.steps.length-1&&CP.done>=CLIP_STEP_MS)clipShow(0);CP.t0=performance.now();CP.raf=requestAnimationFrame(clipTick)}
  else CP.done+=performance.now()-CP.t0;
  const d=$('#clipDlg');if(d)d.classList.toggle('paused',!on);
}
function clipStop(){CP.playing=false;cancelAnimationFrame(CP.raf)}
document.addEventListener('click',e=>{
  const card=e.target.closest('[data-clip]');if(card){openClip(card.dataset.clip);return}
  if(!e.target.closest('#clipDlg'))return;
  if(e.target.closest('[data-clip-close]')){$('#clipDlg').close();return}
  if(e.target.closest('[data-clip-pp]')){clipPlay(!CP.playing);return}
  const go=e.target.closest('[data-clip-go]');if(go){clipShow(CP.i+Number(go.dataset.clipGo));if(!CP.playing)CP.done=0;return}
  const to=e.target.closest('[data-clip-to]');if(to){clipShow(Number(to.dataset.clipTo));return}
  if(e.target.closest('[data-clip-full]')){const w=$('#clipDlg .clip-wrap');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else if(w.requestFullscreen)w.requestFullscreen().catch(()=>{});return}
  if(e.target.closest('#clipStage'))clipPlay(!CP.playing);/* a tap on the picture pauses / plays */
});
document.addEventListener('keydown',e=>{
  const d=$('#clipDlg');if(!d||!d.open)return;
  if(e.key==='ArrowRight'){clipShow(CP.i+1);e.preventDefault()}
  else if(e.key==='ArrowLeft'){clipShow(CP.i-1);e.preventDefault()}
  else if(e.key===' '&&!e.target.closest('button')){clipPlay(!CP.playing);e.preventDefault()}
});
