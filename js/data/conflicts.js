'use strict';
/* BU1 Weekly Plan · people/vehicle lookups and conflict detection */
/* ---------- lookups ---------- */
const staffById=id=>S.staff.find(s=>s.id===id);
const staffName=id=>(staffById(id)||{}).name||'(ไม่พบรายชื่อ)';
function visibleStaff(tasks){
  const used=new Set(tasks.flatMap(t=>t.staffIds||[]));
  return S.staff.filter(s=>(s.active!==false||used.has(s.id))&&inTeam(s)).sort(sortPeople);/* the open ทีม only */
}
const teamNames=t=>[...(t.staffIds||[]).map(staffName),...(t.guests||[]).map(g=>g+' (แผนกอื่น)')];
/* จำนวน Team Service ที่ต้องการ (user, 9 Oct 2026: "แผนงานนี้ใช้ Team Service กี่คน … ขาดกี่คน"): task.teamNeed (0 = not set);
   the team counted = staff + people from other departments; leave plans have none */
const teamHave=t=>(t.staffIds||[]).length+(t.guests||[]).length;
const teamNeedOf=t=>t&&!isLeave(t)?Math.max(0,Math.floor(Number(t.teamNeed)||0)):0;
const teamShort=t=>Math.max(0,teamNeedOf(t)-teamHave(t));
/* the short label: "ขาด 2 คน" · "ครบ 4/4" · "เกิน 1 คน" ('' when no number is set) */
function teamNeedText(t){const n=teamNeedOf(t);if(!n)return '';const h=teamHave(t);return h<n?`ขาด ${n-h} คน`:h>n?`ครบ · เกิน ${h-n} คน`:`ครบ ${h}/${n}`}
/* a chip for cards: red while short, green when complete */
const teamNeedChip=t=>{const n=teamNeedOf(t);if(!n)return '';const s=teamShort(t);return `<span class="tchip tneed ${s?'short':'ok'}" title="Team Service ${teamHave(t)}/${n} คน${s?` · ขาดอีก ${s} คน`:' · ครบแล้ว'}">👷 ${teamHave(t)}/${n}${s?` · ขาด ${s}`:''}</span>`};
/* people are grouped by ทีม (user, 8 Oct 2026; once anyone has one, and no team filter is on) then ตำแหน่ง (role) in the order of
   the positions list: group key "Lab On-Site · Engineer". (The old free-text staff "team" was dropped 5 Oct 2026; ทีม is TEAMS.) */
const roleOf=s=>String((s&&s.role)||'').trim()||'ไม่ระบุตำแหน่ง';
const roleRank=s=>(positions().indexOf(roleOf(s))+1)||999;
const teamsUsed=()=>S.staff.some(s=>teamOf(s));
const teamRank=s=>{const i=TEAMS.findIndex(t=>t.id===teamOf(s));return i<0?TEAMS.length:i};
const groupKey=(s,split)=>(split??(teamsUsed()&&!S.team))?`${teamName(teamOf(s))} · ${roleOf(s)}`:roleOf(s);
const roleOfKey=k=>String(k).split(' · ').pop();
function roleGroups(list){const m=new Map();const split=teamsUsed()&&!S.team;[...list].sort((a,b)=>(split?teamRank(a)-teamRank(b):0)||roleRank(a)-roleRank(b)||sortPeople(a,b)).forEach(s=>{const k=groupKey(s,split);if(!m.has(k))m.set(k,[]);m.get(k).push(s)});return m}

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
