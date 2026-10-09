'use strict';
/* BU1 Weekly Plan · DOM/date/text helpers and master data lookups */
/* ---------- utils ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const mondayOf=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return addDays(x,-((x.getDay()+6)%7))};
const firstOfMonth=d=>new Date(d.getFullYear(),d.getMonth(),1);
const be=d=>d.getFullYear()+543;
const fmtShort=d=>`${d.getDate()} ${TH_MON[d.getMonth()]}`;
const fmtDay=s=>{const d=parseD(s);return `${TH_DAY[d.getDay()]} ${fmtShort(d)}`};
const fmtDayY=s=>{const d=parseD(s);return `${TH_DAY[d.getDay()]} ${fmtShort(d)} ${String(be(d)).slice(-2)}`};
const toMin=t=>{const [h,m]=String(t||'0:0').split(':').map(Number);return (h||0)*60+(m||0)};
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const norm=s=>String(s||'').trim().toLowerCase();
const detailOf=t=>String(t.detail!=null?t.detail:(t.title||''));
const headline=t=>detailOf(t).split('\n').map(x=>x.trim()).find(Boolean)||'';
const safeColor=c=>/^#[0-9a-fA-F]{6}$/.test(String(c||''))?c:'#8a979c';
/* สีของแผน (user, 9 Oct 2026): job types have no colour any more. A plan uses its own colour (task.color ↔ data.bu1wp.color),
   else one taken from its Plan No. (the same Plan No. always gets the same colour), else grey; leave is always grey */
const PLAN_COLORS=['#2a78d6','#1baf7a','#7148c9','#eb6834','#d55181','#0e8fa3','#c27c0e','#3f9b3a','#d03b3b','#5b6b8c','#8a5cf6','#b4589f'];
const NEUTRAL_COLOR='#8a979c';
const planNoColor=pn=>{const k=String(pn||'').trim().toUpperCase();if(!k)return '';let h=0;for(const ch of k)h=(h*31+ch.charCodeAt(0))>>>0;return PLAN_COLORS[h%PLAN_COLORS.length]};
const ownColor=t=>t&&/^#[0-9a-fA-F]{6}$/.test(String(t.color||''))?t.color:'';
const planColor=t=>!t||isLeave(t)?NEUTRAL_COLOR:ownColor(t)||planNoColor(t.planNo)||NEUTRAL_COLOR;
const isWorking=t=>t.status!=='cancelled';
function weekName(mon){const sun=addDays(mon,6);return `${mon.getDate()}-${sun.getDate()} ${EN_MON[sun.getMonth()]} ${String(sun.getFullYear()).slice(-2)}`}

/* ---------- master data lookups ---------- */
/* saved types from before สายงาน existed (no line key at all) take the default type's line; '' = both lines */
function jobTypes(){const l=S.cfg.jobTypes;if(!(Array.isArray(l)&&l.length))return DEFAULT_TYPES;
  return l.map(t=>{if(!t||t.line!==undefined)return t;const d=DEFAULT_TYPES.find(x=>x.id===t.id);return d&&d.line?Object.assign({},t,{line:d.line}):t})}
const lineOptions=cur=>`<option value="">ใช้ได้ทั้งสองสาย</option>`+LINES.map(l=>`<option value="${l.id}"${cur===l.id?' selected':''}>${esc(l.name)}</option>`).join('');
const activeTypes=()=>jobTypes().filter(t=>t.active!==false);
const typeIdOf=t=>t.jobType||LEGACY[t.type]||'other';
function typeOf(t){const id=typeIdOf(t);return jobTypes().find(x=>x.id===id)||DEFAULT_TYPES.find(x=>x.id===id)||{id,name:t.jobTypeName||id,color:'#8a979c'}}
function typeLabel(t){const ty=typeOf(t);if(ty.id==='other')return String(t.jobTypeOther||'').trim()||LEGACY_NAME[t.type]||ty.name;return ty.name}
const isLeave=t=>typeIdOf(t)==='leave';
/* สายงาน of a plan: its own, else its job type's; '' = not set (leave never has one) */
const lineOf=t=>isLeave(t)?'':LINE[t.line]?t.line:LINE[typeOf(t).line]?typeOf(t).line:'';
/* ทีม of a person ('' = not set) and the team filter (S.team): a plan shows when one of its people is in the open team;
   a work plan nobody is on yet shows in every team (it still needs people) */
const teamOf=s=>s&&TEAM[s.team]?s.team:'';
const teamName=id=>TEAM[id]?TEAM[id].name:NO_TEAM;
/* member of a work team: that team, or All Team (in both) */
const inTeamId=(s,id)=>{const t=teamOf(s);return !!t&&(t===id||(t==='all'&&!!TEAM[id]&&!TEAM[id].all))};
const inTeam=s=>!S.team||inTeamId(s,S.team);
const teamMatch=t=>{if(!S.team)return true;const ids=t.staffIds||[];if(!ids.length)return !isLeave(t);return ids.some(id=>inTeamId(S.staff.find(s=>s.id===id),S.team))};
/* the open tab (S.line) shows its own plans, plans without a line, and leave (people are shared); then the team filter */
const lineMatch=t=>(!S.line||!lineOf(t)||lineOf(t)===S.line)&&teamMatch(t);
const lineName=()=>S.line&&LINE[S.line]?LINE[S.line].name:'';
/* the open สายงาน and ทีม for titles: "Flow Meter · Lab On-Site" */
const scopeName=()=>[lineName(),S.team?teamName(S.team):''].filter(Boolean).join(' · ');
/* people grouped by team (fixed order, then "ยังไม่ระบุทีม"); only the open team when the filter is on */
const teamGroups=list=>TEAMS.map(t=>t.id).concat(['']).filter(id=>!S.team||id===S.team).map(id=>({id,name:teamName(id),team:TEAM[id]||null,people:list.filter(s=>teamOf(s)===id)})).filter(g=>g.people.length);
function periodOf(t){
  if(PERIOD[t.period])return t.period;
  if(t.start&&t.end){const a=toMin(t.start)<720,b=toMin(t.end)>780;return a&&b?'full':a?'am':'pm'}
  return 'full';
}
const pName=t=>PERIOD[periodOf(t)].name;
const pA=t=>PERIOD[periodOf(t)].a,pB=t=>PERIOD[periodOf(t)].b;
const overlaps=(a,b)=>pA(a)<=pB(b)&&pA(b)<=pB(a);
const byTime=(a,b)=>(a.date||'').localeCompare(b.date||'')||pA(a)-pA(b)||pB(a)-pB(b)||String(a.planNo||'').localeCompare(String(b.planNo||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
const positions=()=>Array.isArray(S.cfg.positions)&&S.cfg.positions.length?S.cfg.positions:DEFAULT_POSITIONS;
const sales=()=>(S.cfg.sales||[]).filter(s=>s&&s.name);
const saleTel=name=>{const s=sales().find(x=>norm(x.name)===norm(name));return s?s.tel||'':''};
const sortPeople=(a,b)=>(a.order??999)-(b.order??999)||(a.name||'').localeCompare(b.name||'','th');
const vehicles=()=>S.resources.filter(r=>r.kind==='vehicle').sort(sortPeople);
