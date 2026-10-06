'use strict';
/* BU1 Weekly Plan · job types, periods, statuses, calendar names */
/* ---------- constants ---------- */
const DEFAULT_TYPES=[
  {id:'disconnect',name:'Disconnect',color:'#eb6834'},
  {id:'installation',name:'Installation',color:'#2a78d6'},
  {id:'dci',name:'D/C/I',color:'#4a3aa7'},
  {id:'calonsite',name:'Cal On Site',color:'#1baf7a'},
  {id:'caltemp',name:'Cal temp&humidity',color:'#eda100'},
  {id:'training',name:'อบรม',color:'#008300'},
  {id:'health',name:'ตรวจสุขภาพ',color:'#e87ba4'},
  {id:'standby',name:'Stand by on-call',color:'#5b6b8c'},
  {id:'support',name:'Support รับ-ส่ง',color:'#9a6b3f'},
  {id:'leave',name:'ลา',color:'#8a979c'},
  {id:'other',name:'อื่นๆ',color:'#0e8fa3'},
];
const SYSTEM_TYPES=new Set(['leave','other']);
const LEGACY={cal:'calonsite',ins:'installation',trn:'training',lv:'leave'};
const LEGACY_NAME={svc:'ซ่อม / Service',pm:'บำรุงรักษา (PM)',tst:'ทดสอบ / ตรวจสอบ',off:'งานเอกสาร / รายงาน'};
const PERIODS=[{id:'am',name:'เช้า',a:0,b:0},{id:'pm',name:'บ่าย',a:1,b:1},{id:'full',name:'เช้า,บ่าย',a:0,b:1}];
const PERIOD=Object.fromEntries(PERIODS.map(p=>[p.id,p]));
const DEFAULT_POSITIONS=['Admin','Engineer','Technician','Special Contract','Assistant Technician'];
/* earlier Thai role names, converted once to the English roles above (and when pasted in bulk) */
const LEGACY_ROLES={'วิศวกร':'Engineer','ช่างเทคนิค':'Technician','สญจ':'Special Contract','ผชช':'Assistant Technician'};
const roleName=r=>LEGACY_ROLES[String(r||'').trim()]||String(r||'').trim();
const FIXED_TRANSPORT=['GA','รถลูกค้า','ไม่ใช้รถ'];
const MAX_CARDS=20;
const PLAN_RE=/^PN-\d{2}-(0[1-9]|1[0-2])\d{3}$/;
/* "กำลังดำเนินการ" (progress) was removed on 2026-10-05; plans saved with it are read as วางแผน (normTask in store.js) */
const STATUSES=[
  {id:'planned',th:'วางแผน',icon:'○',color:'var(--muted)'},
  {id:'done',th:'เสร็จแล้ว',icon:'●',color:'var(--good)'},
  {id:'notdone',th:'ไม่เสร็จ',icon:'⚠',color:'var(--crit)'},/* opens an NCR (js/features/ncr.js) */
  {id:'postponed',th:'เลื่อน',icon:'↻',color:'var(--warn)'},
  {id:'cancelled',th:'ยกเลิก',icon:'✕',color:'var(--line)'},
];
const STATUS=Object.fromEntries(STATUSES.map(s=>[s.id,s]));
/* ไม่เสร็จ / postponed / cancelled plans carry the reason or site problem in statusNote */
const NEEDS_REASON=new Set(['notdone','postponed','cancelled']);
const reasonLabel=s=>s==='cancelled'?'เหตุผลที่ยกเลิก / ปัญหาที่หน้างาน':s==='notdone'?'สาเหตุที่งานไม่เสร็จ / ปัญหาที่หน้างาน':'เหตุผลที่เลื่อน / ปัญหาที่หน้างาน';
const statusFlag=s=>s==='postponed'?'↻ เลื่อน':s==='notdone'?'⚠ ไม่เสร็จ':'✕ ยกเลิก';
const statusText=t=>(STATUS[t.status]||STATUS.planned).th+(NEEDS_REASON.has(t.status)&&t.statusNote?` — ${t.statusNote}`:'');
const VIEWS=['plan','booking','safety','people','projects','search','dash','ncr','settings','help'];
const TH_MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_MON_FULL=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const EN_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const EN_DAY=['SUN','MON','TUE','WED','THU','FRI','SAT'];
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7)}
const TH_DAY=['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const TH_DAY_FULL=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
