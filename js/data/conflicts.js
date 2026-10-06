'use strict';
/* BU1 Weekly Plan · people/vehicle lookups and conflict detection */
/* ---------- lookups ---------- */
const staffById=id=>S.staff.find(s=>s.id===id);
const staffName=id=>(staffById(id)||{}).name||'(ไม่พบรายชื่อ)';
function visibleStaff(tasks){
  const used=new Set(tasks.flatMap(t=>t.staffIds||[]));
  return S.staff.filter(s=>s.active!==false||used.has(s.id)).sort(sortPeople);
}
const teamNames=t=>[...(t.staffIds||[]).map(staffName),...(t.guests||[]).map(g=>g+' (แผนกอื่น)')];
/* people are grouped by ตำแหน่ง (role) in the order of the positions list; the old staff "team" field is no longer used (2026-10-05) */
const roleOf=s=>String((s&&s.role)||'').trim()||'ไม่ระบุตำแหน่ง';
const roleRank=s=>(positions().indexOf(roleOf(s))+1)||999;
function roleGroups(list){const m=new Map();[...list].sort((a,b)=>roleRank(a)-roleRank(b)||sortPeople(a,b)).forEach(s=>{const k=roleOf(s);if(!m.has(k))m.set(k,[]);m.get(k).push(s)});return m}

/* "ใช้ทีมร่วมกับงานอื่นในพื้นที่เดียวกัน" (BU2 Booking.allowSharedTeam): the same people may work two plans on the same day and
   period without a clash when BOTH plans have it on and are in the same area — the Safety area when both have one, otherwise
   the same Location. Leave never shares; a shared vehicle still clashes. */
const locKey=s=>norm(s).replace(/\s+/g,' ');
const sameArea=(a,b)=>a.areaId&&b.areaId?a.areaId===b.areaId:!!locKey(a.location)&&locKey(a.location)===locKey(b.location);
const teamShared=(a,b)=>!!a.sharedTeam&&!!b.sharedTeam&&!isLeave(a)&&!isLeave(b)&&sameArea(a,b);

/* ---------- conflicts: same person in overlapping periods, person on leave, same vehicle ---------- */
function vehKey(t){const k=norm(t.transport);if(!k)return null;return S.resources.some(r=>r.kind==='vehicle'&&norm(r.name)===k)?k:null}
function conflictsFor(task,pool){
  const out=[];if(!isWorking(task))return out;const mv=vehKey(task);const tl=isLeave(task);
  for(const o of pool){
    if(o.id===task.id||o.date!==task.date||!isWorking(o)||!overlaps(task,o))continue;
    const ol=isLeave(o);if(tl&&ol)continue;
    const st=teamShared(task,o)?[]:(task.staffIds||[]).filter(x=>(o.staffIds||[]).includes(x));
    const veh=!tl&&!ol&&mv&&vehKey(o)===mv;
    if(st.length||veh)out.push({other:o,staff:st,veh:veh?task.transport:'',leave:tl||ol});
  }
  return out;
}
let confCache={key:null,map:null};
function allConflicts(){
  if(confCache.key===S.tasks&&confCache.res===S.resources)return confCache.map;
  const map=new Map();
  for(const t of S.tasks){const c=conflictsFor(t,S.tasks);if(c.length)map.set(t.id,c)}
  confCache={key:S.tasks,res:S.resources,map};return map;
}
function conflictsIn(list){
  const byDate=new Map();list.forEach(t=>{if(!byDate.has(t.date))byDate.set(t.date,[]);byDate.get(t.date).push(t)});
  const map=new Map();for(const day of byDate.values())for(const t of day){const c=conflictsFor(t,day);if(c.length)map.set(t.id,c)}
  return map;
}
function confLabel(list){
  const people=new Set(),leave=new Set(),veh=new Set();
  list.forEach(c=>{c.staff.forEach(x=>(c.leave?leave:people).add(staffName(x)));if(c.veh)veh.add(c.veh)});
  const parts=[];
  if(people.size)parts.push('คนชน: '+[...people].join(', '));
  if(leave.size)parts.push('ติดลา: '+[...leave].join(', '));
  if(veh.size)parts.push('รถที่ใช้งานซ้ำกัน: '+[...veh].join(', '));
  return parts.join(' · ');
}
const isLate=t=>(!t.status||t.status==='planned')&&t.date<ymd(new Date());
