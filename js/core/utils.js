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
const isWorking=t=>t.status!=='cancelled';
function weekName(mon){const sun=addDays(mon,6);return `${mon.getDate()}-${sun.getDate()} ${EN_MON[sun.getMonth()]} ${String(sun.getFullYear()).slice(-2)}`}

/* ---------- master data lookups ---------- */
function jobTypes(){const l=S.cfg.jobTypes;return Array.isArray(l)&&l.length?l:DEFAULT_TYPES}
const activeTypes=()=>jobTypes().filter(t=>t.active!==false);
const typeIdOf=t=>t.jobType||LEGACY[t.type]||'other';
function typeOf(t){const id=typeIdOf(t);return jobTypes().find(x=>x.id===id)||DEFAULT_TYPES.find(x=>x.id===id)||{id,name:t.jobTypeName||id,color:'#8a979c'}}
function typeLabel(t){const ty=typeOf(t);if(ty.id==='other')return String(t.jobTypeOther||'').trim()||LEGACY_NAME[t.type]||ty.name;return ty.name}
const isLeave=t=>typeIdOf(t)==='leave';
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
