'use strict';
/* BU1 Weekly Plan · public holidays
   The list lives in config/main.holidays [{date:'YYYY-MM-DD', name}] and is edited under จัดการข้อมูล › วันหยุด.
   Until someone saves a list, DEFAULT_HOLIDAYS is used: Thai public holidays 2569 (2026) with substitution days,
   plus the fixed-date holidays of 2570 (2027). Lunar holidays of 2027 (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา)
   and any special holidays the cabinet announces must be added when they are announced. */
const DEFAULT_HOLIDAYS=[
  ['2026-01-01','วันขึ้นปีใหม่'],
  ['2026-03-03','วันมาฆบูชา'],
  ['2026-04-06','วันจักรี'],
  ['2026-04-13','วันสงกรานต์'],['2026-04-14','วันสงกรานต์'],['2026-04-15','วันสงกรานต์'],
  ['2026-05-01','วันแรงงานแห่งชาติ'],
  ['2026-05-04','วันฉัตรมงคล'],
  ['2026-05-31','วันวิสาขบูชา'],['2026-06-01','ชดเชยวันวิสาขบูชา'],
  ['2026-06-03','วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี'],
  ['2026-07-28','วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว'],
  ['2026-07-29','วันอาสาฬหบูชา'],['2026-07-30','วันเข้าพรรษา'],
  ['2026-08-12','วันแม่แห่งชาติ'],
  ['2026-10-13','วันนวมินทรมหาราช'],
  ['2026-10-23','วันปิยมหาราช'],
  ['2026-12-05','วันพ่อแห่งชาติ'],['2026-12-07','ชดเชยวันพ่อแห่งชาติ'],
  ['2026-12-10','วันรัฐธรรมนูญ'],
  ['2026-12-31','วันสิ้นปี'],
  ['2027-01-01','วันขึ้นปีใหม่'],
  ['2027-04-06','วันจักรี'],
  ['2027-04-13','วันสงกรานต์'],['2027-04-14','วันสงกรานต์'],['2027-04-15','วันสงกรานต์'],
  ['2027-05-01','วันแรงงานแห่งชาติ'],['2027-05-03','ชดเชยวันแรงงานแห่งชาติ'],
  ['2027-05-04','วันฉัตรมงคล'],
  ['2027-06-03','วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี'],
  ['2027-07-28','วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว'],
  ['2027-08-12','วันแม่แห่งชาติ'],
  ['2027-10-13','วันนวมินทรมหาราช'],
  ['2027-10-23','วันปิยมหาราช'],['2027-10-25','ชดเชยวันปิยมหาราช'],
  ['2027-12-05','วันพ่อแห่งชาติ'],['2027-12-06','ชดเชยวันพ่อแห่งชาติ'],
  ['2027-12-10','วันรัฐธรรมนูญ'],
  ['2027-12-31','วันสิ้นปี'],
].map(([date,name])=>({date,name}));
const holidayList=()=>(Array.isArray(S.cfg&&S.cfg.holidays)?S.cfg.holidays:DEFAULT_HOLIDAYS);
let holCache={src:null,map:new Map()};
/* holiday name of a YYYY-MM-DD, or '' */
function holidayOf(k){
  const l=holidayList();
  if(holCache.src!==l){const m=new Map();l.forEach(h=>{if(h&&h.date)m.set(h.date,m.has(h.date)?m.get(h.date)+' · '+h.name:String(h.name||'วันหยุด'))});holCache={src:l,map:m}}
  return holCache.map.get(k)||'';
}
const isWeekend=d=>d.getDay()===0||d.getDay()===6;
/* shown as a day off (grey column): Saturday, Sunday or a public holiday */
const isOffDay=d=>isWeekend(d)||!!holidayOf(ymd(d));
/* counted as a working day for capacity (the Lab works Monday–Saturday): not Sunday and not a public holiday */
const isWorkDay=d=>d.getDay()!==0&&!holidayOf(ymd(d));

/* ---------- จัดการข้อมูล › วันหยุด ---------- */
const holSorted=()=>holidayList().slice().filter(h=>h&&h.date).sort((a,b)=>a.date.localeCompare(b.date));
function saveHolidays(list,msg){saveCfg({holidays:list.slice().sort((a,b)=>a.date.localeCompare(b.date))},msg)}
function holidaySection(){
  const list=holSorted();const y=new Date().getFullYear();const dis=can('master')?'':' disabled';
  const thisYear=list.filter(h=>h.date.startsWith(y+'-'));
  const years=[...new Set(list.map(h=>h.date.slice(0,4)))];
  const rows=years.map(yr=>`<tr class="hol-year"><th colspan="4">ปี ${Number(yr)+543} (${yr}) · ${list.filter(h=>h.date.startsWith(yr+'-')).length} วัน</th></tr>`+list.map((h,i)=>({h,i})).filter(x=>x.h.date.startsWith(yr+'-')).map(({h,i})=>{const d=parseD(h.date);
    return `<tr><td class="hint" style="white-space:nowrap">${TH_DAY_FULL[d.getDay()]}</td><td><input type="date" id="hol-d-${i}" data-hol-idx="${i}" data-hol-field="date" value="${esc(h.date)}"${dis} aria-label="วันที่"></td>
      <td><input id="hol-n-${i}" data-hol-idx="${i}" data-hol-field="name" value="${esc(h.name||'')}" maxlength="80"${dis} aria-label="ชื่อวันหยุด"></td>
      <td>${can('master')?`<button type="button" class="btn sm danger" data-action="del-hol" data-idx="${i}">ลบ</button>`:''}</td></tr>`}).join('')).join('');
  return {id:'holidays',title:'วันหยุด',sub:`ปี ${y+543} · ${thisYear.length} วัน`,count:thisYear.length,
    desc:'วันหยุดนักขัตฤกษ์ แสดงเป็นวันหยุดในตาราง Weekly Plan, คนว่าง, สรุปรายคน, กำลังคน และ Dashboard (ไม่นับเป็นวันทำงานเวลาคำนวณกำลังคน) · ค่าเริ่มต้นคือวันหยุดราชการปี 2569 ครบทั้งปี และวันหยุดวันที่คงที่ของปี 2570 · วันหยุดทางพุทธศาสนาของปี 2570 และวันหยุดพิเศษที่ ครม. ประกาศเพิ่ม ให้เพิ่มเมื่อมีประกาศ',
    body:`<div class="scroll-x plain md-scroll"><table class="edit-table"><thead><tr><th>วัน</th><th>วันที่</th><th>ชื่อวันหยุด</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="hint">ยังไม่มีวันหยุด</td></tr>'}</tbody></table></div>
      ${can('master')?`<form class="add-row" data-add-hol><input type="date" name="date" id="add-hol-date" required aria-label="วันที่"><input name="name" id="add-hol-name" placeholder="ชื่อวันหยุด เช่น วันหยุดพิเศษ" maxlength="80" required aria-label="ชื่อวันหยุด"><button class="btn primary" type="submit">เพิ่มวันหยุด</button></form>
      <div><button type="button" class="btn sm" data-action="hol-reset">คืนค่าวันหยุดราชการเริ่มต้น</button></div>`:''}`};
}
document.addEventListener('change',e=>{
  const t=e.target;if(!t.dataset||t.dataset.holIdx===undefined||!can('master'))return;
  const list=holSorted().map(h=>Object.assign({},h));const h=list[Number(t.dataset.holIdx)];if(!h)return;
  const v=t.value.trim();if(!v){toast(t.dataset.holField==='date'?'เลือกวันที่':'ใส่ชื่อวันหยุด');render();return}
  h[t.dataset.holField]=v;saveHolidays(list,'บันทึกวันหยุดแล้ว');
});
document.addEventListener('submit',e=>{
  const f=e.target;if(!f.matches||!f.matches('[data-add-hol]'))return;e.preventDefault();if(!can('master'))return;
  const fd=new FormData(f);const date=String(fd.get('date')||'');const name=String(fd.get('name')||'').trim();if(!date||!name)return;
  const list=holSorted().map(h=>Object.assign({},h));if(list.some(h=>h.date===date&&h.name===name)){toast('มีวันหยุดนี้อยู่แล้ว');return}
  list.push({date,name});f.reset();saveHolidays(list,`เพิ่ม ${name} (${thDate(date)}) แล้ว`);
});
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-action]');if(!a||!can('master'))return;
  if(a.dataset.action==='del-hol'){const list=holSorted().map(h=>Object.assign({},h));const h=list[Number(a.dataset.idx)];if(!h)return;
    if(!arm(a,'hol:'+h.date+h.name,'ลบ'))return;list.splice(Number(a.dataset.idx),1);saveHolidays(list,`ลบ ${h.name} แล้ว`)}
  if(a.dataset.action==='hol-reset'){if(!arm(a,'hol-reset','คืนค่าวันหยุดราชการเริ่มต้น','กดอีกครั้งเพื่อแทนที่รายการทั้งหมด'))return;saveHolidays(DEFAULT_HOLIDAYS,'คืนค่าวันหยุดราชการเริ่มต้นแล้ว')}
});
