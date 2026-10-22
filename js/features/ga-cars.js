'use strict';
/* BU1 Weekly Plan · รถแผนก → GA Fleet (user, 22 Oct 2026: "รถแผนกทุกคัน เวลา BU1 ลงแผนงานส่งข้อมูลรถแผนกไปให้ทางแอป GA Fleet ด้วย
   และเวลาเพิ่มรถแผนกคันใหม่ ทุกครั้งให้ส่งข้อมูลไปหาแอป GA Fleet ด้วย" — GA keeps the keys and must not lend a car that has work).
   GA Fleet reads public.cranes rows with data.type in GA_CAR_TYPES (not archived) as this department's cars, and a booking's data.crane
   ids + data.day as that car's work. backend.js writeCranes now gives every vehicle that type (ประเภทรถ of this app → bu1wp.group) and
   bookingRow already writes the ids, so new vehicles and new plans reach GA by themselves. This file = the one-time catch-up for what was
   saved before: vehicles still on another type, and plans from today on whose vehicle ids were never stored (chose "ปุ่มส่งครั้งเดียว"). */
const gaCarsOn=()=>S.backend==='supabase';
const gaCarsMissing=()=>gaCarsOn()?vehicles().filter(r=>r.active!==false&&!GA_CAR_TYPES.includes(r.gaType||'')):[];
/* plans from today on (180 days) that name a registered vehicle whose id is not stored on the booking */
async function gaPlansMissing(){
  const from=new Date();const list=await Store.range('tasks',ymd(from),ymd(addDays(from,180)));
  return (list||[]).filter(t=>t.src==='bookings'&&!isLeave(t)&&deptCars(t).filter(isVehicleName).length>asList(t._crane).length);
}
function gaCarBoxHtml(){
  if(!gaCarsOn())return '';const vs=vehicles().filter(r=>r.active!==false);const miss=gaCarsMissing();
  return `<div class="ga-cars ${miss.length?'warn':'ok'}"><b>${miss.length?`GA Fleet ยังมองไม่เห็นรถแผนก ${miss.length} จาก ${vs.length} คัน`:`GA Fleet เห็นรถแผนกครบ ${vs.length} คัน`}</b>
    <span>${miss.length?`${esc(miss.map(r=>r.name).join(', '))} · `:''}รถแผนกทุกคันและแผนงานที่ใช้รถจะส่งไปที่แอป GA Fleet ให้เอง (คันใหม่ส่งตอนเพิ่ม · แผนส่งตอนบันทึก) GA จึงรู้ว่ารถคันไหนมีงานวันไหน และไม่จ่ายกุญแจรถที่มีงานแล้ว</span>
    ${can('master')?`<button type="button" class="btn sm${miss.length?' primary':''}" data-action="ga-car-sync">${miss.length?'ส่งรถทุกคันไป GA Fleet':'ตรวจและส่งแผนที่ใช้รถอีกครั้ง'}</button>`:''}</div>`;
}
async function gaCarSync(btn){
  if(!can('master')||!gaCarsOn())return;
  btn.disabled=true;const old=btn.textContent;btn.textContent='กำลังตรวจ…';
  try{
    const cars=gaCarsMissing();const plans=await gaPlansMissing();
    if(!cars.length&&!plans.length){toast('GA Fleet เห็นรถและแผนงานที่ใช้รถครบแล้ว');return}
    const ok=await askConfirm(`ส่งข้อมูลไป GA Fleet`,`${cars.length?`รถ ${cars.length} คัน: ${cars.map(r=>r.name).join(', ')}\n`:''}${plans.length?`แผนงานที่ใช้รถแผนกตั้งแต่วันนี้ ${plans.length} แผน\n`:''}\nประเภทรถที่ตั้งไว้ในหน้านี้ยังเหมือนเดิม · ไม่เปลี่ยนข้อมูลอื่นของแผน`,'ส่งไป GA Fleet');
    if(!ok)return;
    let done=0,fail=0;btn.textContent='กำลังส่ง…';
    for(const r of cars){try{await Store.update('resources',r.id,{group:r.group||''});done++}catch(e){fail++;noteWriteError(e)}}
    for(const t of plans){try{await Store.update('tasks',t.id,{transport:t.transport});done++}catch(e){fail++;noteWriteError(e)}}
    toast(fail?`ส่งแล้ว ${done} รายการ · ไม่สำเร็จ ${fail} รายการ ลองกดอีกครั้ง`:`ส่งไป GA Fleet แล้ว · รถ ${cars.length} คัน · แผน ${plans.length} แผน`);
  }catch(e){toast(errText(e))}
  finally{btn.disabled=false;btn.textContent=old;render()}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="ga-car-sync"]');if(b)gaCarSync(b)});
