'use strict';
/* คำแนะนำบนทุกหน้า (user, 15 Oct 2026; chose "คำแนะนำบนทุกหน้า"): the "?" beside each page title opens a short card —
   what the page is for and its 3–4 main moves — with a link to the matching part of วิธีใช้. It opens by itself the first time a
   person visits a page in this browser (localStorage bu1wp.tipsSeen), then only on the "?". */
const PAGE_TIPS={
  plan:['ลงแผนรายวันของทีม เห็นทั้งสัปดาห์',['กด + เพิ่มแผนงาน หรือ + ในช่องวันของตาราง','กดการ์ดแผนเพื่อดู / แก้ / บันทึกสถานะงาน','‹ › หรือปุ่มปฏิทินเปลี่ยนสัปดาห์ · กรองด้วยสายงาน ทีม หัวข้องาน ลูกค้า','เลือกหลายแผนเพื่อย้ายวัน เปลี่ยนสี หรือลบพร้อมกัน']],
  my:['ทุกอย่างที่คุณต้องทำ รวมไว้ที่เดียว',['ต้องทำตอนนี้ = เรื่องที่ต้องตาม กดแถวเพื่อเปิดเรื่องนั้น','เลือก "ฉันคือพนักงาน" เพื่อเห็นแผนที่คุณอยู่ในทีม และรับแจ้งเตือนของแผนนั้น','สลับ วันนี้ / พรุ่งนี้ / 7 วัน · ติ๊ก "ทุกแผน" เพื่อดูของทุกคน']],
  jobs:['Sale ส่งคำร้อง → Planner รับงาน (ออก PN) → ลงแผนรายวัน',['Sale กด + ใบรับคำร้องใหม่ กรอกตามใบรับคำร้อง FLS-F-018','Planner เปิดใบรับคำร้องที่รอ แล้วกด รับงาน / ออก PN','รับแล้วกด + ลงแผนรายวัน ข้อมูลลูกค้าและเครื่องไปที่แผนให้เอง','PDF / PDF ทั้งชุด ได้ไฟล์ที่กรอกข้อมูลครบ']],
  checks:['Check Sheet ของแต่ละเครื่อง / แผน ทำทีละหัวข้อแล้วส่งอนุมัติ',['สร้างจากใบรับคำร้องขอรับบริการสอบเทียบ (+ QC / + DF / + RR) หรือหน้าดูแผน (Service Report)','ติ๊กรายการ แล้วกด QC Pass / Fail หรือ ยืนยันหัวข้อ ระบบลงชื่อและเวลาให้','ครบแล้วกด ส่งตรวจ → ผู้อนุมัติ อนุมัติ หรือ ตีกลับ (ใส่เหตุผล)','แท็บ รออนุมัติ = ใบที่คุณต้องอนุมัติ']],
  booking:['ดูแผนทุกสัปดาห์ในตารางเดียว',['ค้นหาด้านบน แล้วกรองด้วย drop down (ช่วงวันที่ สถานะ ลูกค้า Sale รถ …)','กดแถวเพื่อเปิดแผน · เปิดใน Weekly Plan เพื่อไปสัปดาห์นั้น']],
  mplan:['แผนรายเดือน Flow Meter',['เลือกเดือนด้วย ‹ › แล้วกรอกในตารางได้เลย · รหัสงานรายวัน D / C / W / I …','นำเข้า / ส่งออก Excel และ PDF ได้จากแถบด้านบน','Instrument อยู่ที่เมนู Master Plan · Instrument']],
  mplanins:['แผนรายเดือน Instrument',['เลือกเดือนด้วย ‹ › แล้วกรอกในตารางได้เลย · จำนวนสอบเทียบรายวัน','ดึงจาก Weekly plan instrument / นำเข้า / ส่งออก Excel และ PDF ได้จากแถบด้านบน','Flow Meter อยู่ที่เมนู Master Plan · Flow Meter']],
  wsheet:['ตารางสอบเทียบ / Instrument ของสัปดาห์',['สลับแท็บ Weekly plan calibration / Weekly plan instrument','เปลี่ยนสัปดาห์ด้วย ‹ › ที่แถบด้านบน','แก้ Lab / Status / Pass-Fail หรือ Remove / Cal / install ในตารางได้ทันที · กดแถวเพื่อเปิดแผน']],
  safety:['บัตรเข้าพื้นที่และคำขออบรมของทีม',['Dashboard พื้นที่ = บัตรของแต่ละคน','ขออบรม / คำขอของฉัน / บันทึกย้อนหลัง อยู่ในแท็บด้านบน']],
  people:['ใครทำงานอะไร ช่วงไหน และใครว่าง',['ติ๊กชื่อหลายคน แล้วกด ลงแผนให้คนที่เลือก','เปลี่ยนสัปดาห์ด้วย ‹ ›']],
  projects:['กำลังคนของโปรเจกต์ยาว',['ใส่ชื่องาน จำนวนคน และช่วงวันที่ ระบบรวมคนที่ต้องใช้ต่อวัน']],
  search:['ค้นหาแผนย้อนหลังทุกสัปดาห์',['พิมพ์ Plan No. ลูกค้า หรือชื่อพนักงาน','หรือกดปุ่ม ค้นหา ที่เมนูด้านซ้ายเพื่อค้นหาได้จากทุกหน้า']],
  ncr:['งานไม่สำเร็จ ติดตามจนปิด',['NCR เปิดเองเมื่อแผนเป็น ไม่เสร็จ หรือกด + เปิด NCR','ใส่สาเหตุ การแก้ไข ผู้รับผิดชอบ และกำหนดเสร็จ · เลยกำหนดจะแจ้งเตือน']],
  dash:['รายงานผลการปฏิบัติงาน',['เลือก สัปดาห์ / เดือน / ไตรมาส / ปี แล้ว ‹ › เปลี่ยนช่วง','แท็บ ภาพรวม · กำลังคน · งานและลูกค้า · สอบเทียบ · ติดตามงาน','ชี้ที่กราฟเพื่อดูตัวเลข · กดวันในกราฟหรือปฏิทินเพื่อเปิดแผนวันนั้น','พิมพ์ A4 (มีกราฟ) หรือส่งออก Excel ได้จากด้านบน']],
  settings:['ข้อมูลหลักที่ทุกแผนใช้',['พนักงาน รถ หัวข้องาน Sale แก้ที่นี่ที่เดียว แผนเปลี่ยนตาม','ตรวจแผนให้ตรงข้อมูลหลัก · ผู้อนุมัติ Check Sheet · ISO 9001 · สำรองข้อมูล']],
  help:['คู่มือและคลิปสอน',['กดการ์ดคลิปเพื่อดูทีละขั้น · ปุ่ม ค้นหา ที่เมนูด้านซ้ายไปหน้าหรือแผนได้ทันที']],
};
function tipSeen(v){try{return (localStorage.getItem('bu1wp.tipsSeen')||'').split(',').includes(v)}catch(e){return true}}
function tipMark(v){try{const l=(localStorage.getItem('bu1wp.tipsSeen')||'').split(',').filter(Boolean);if(!l.includes(v)){l.push(v);localStorage.setItem('bu1wp.tipsSeen',l.join(','))}}catch(e){}}
let tipOpen=null;
function renderPageTip(){
  const tp=PAGE_TIPS[S.view];const btn=$('#pageTipBtn'),box=$('#pageTip');if(!btn||!box)return;
  btn.hidden=!tp;if(!tp){box.hidden=true;return}
  if(tipOpen==null||tipOpen.v!==S.view||tipOpen.wait)tipOpen={v:S.view,on:!tipSeen(S.view)&&!notReady(),wait:notReady()};/* decided once the page has its data */
  if(tipOpen.on)tipMark(S.view);
  btn.setAttribute('aria-expanded',String(tipOpen.on));box.hidden=!tipOpen.on;
  if(tipOpen.on)box.innerHTML=`<b>${esc(tp[0])}</b><ul>${tp[1].map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="pt-act"><button type="button" class="lnk" data-go="help">เปิดวิธีใช้ ›</button><button type="button" class="lnk" data-tip-close>ปิดคำแนะนำ</button></div>`;
}
document.addEventListener('click',e=>{
  if(e.target.closest('#pageTipBtn')){tipOpen={v:S.view,on:!(tipOpen&&tipOpen.v===S.view&&tipOpen.on)};renderPageTip();return}
  if(e.target.closest('[data-tip-close]')){tipOpen={v:S.view,on:false};renderPageTip()}
});
