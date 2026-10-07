'use strict';
/* BU1 Weekly Plan · job types, periods, statuses, calendar names */
/* ---------- constants ---------- */
/* สายงาน (work lines) of the one Weekly Plan: the board has a tab per line; the team is shared, so clashes and
   who-is-free are checked across both. A plan keeps its line in task.line (central DB: data.bu1wp.line); without one
   it takes its job type's line (jobType.line), and a plan with neither shows on every tab marked "ไม่ระบุสาย" */
const LINES=[
  {id:'fm',name:'Flow Meter',short:'Flow Meter',tag:'FM',color:'#0b8fd6',desc:'สอบเทียบมาตรวัดอัตราการไหล',
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9h4v6H2M22 9h-4v6h4"/><rect x="6" y="7.5" width="12" height="9" rx="2"/><path d="M9 12h6m-2-2 2 2-2 2"/><path d="M12 7.5V4.5M10 4.5h4"/></svg>'},
  {id:'ins',name:'Instrument',short:'Instrument',tag:'INS',color:'#9a4fd8',desc:'อุปกรณ์ Instrument · Pressure · Temperature · Humidity',
    icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M7.5 13h1M15.5 13h1M12 8.5v1"/><path d="M9 21h6"/></svg>'},
];
const LINE=Object.fromEntries(LINES.map(l=>[l.id,l]));
/* "ทั้งสองสาย" in the plan form: no line, shows on both tabs */
const LINE_BOTH={id:'',name:'ใช้ได้ทั้งสองสาย',short:'ทั้งสองสาย',tag:'ALL',color:'#64748b',
  icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3"/></svg>'};
/* the team's Sale names (user, 6 Oct 2026): always offered in the plan's Sale list, next to the ones in ข้อมูลหลัก */
const DEFAULT_SALES=['Rungnapa','Chananrat','Priraya','Pattarawadee','Witchulada','Thanyaphat','Kanyanut','Natpakorn'];
const DEFAULT_TYPES=[
  {id:'disconnect',name:'Disconnect',color:'#eb6834',line:'fm'},
  {id:'installation',name:'Installation',color:'#2a78d6',line:'fm'},
  {id:'dci',name:'D/C/I',color:'#4a3aa7',line:'fm'},
  {id:'calonsite',name:'Cal On Site',color:'#1baf7a'},
  {id:'caltemp',name:'Cal temp&humidity',color:'#eda100',line:'ins'},
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
const FIXED_TRANSPORT=['GA','รถลูกค้า','ขับรถเอง','ไม่ใช้รถ'];/* ขับรถเอง (user, 7 Oct 2026): own car, never a vehicle clash */
const TRANSPORT_SUB={GA:'รถจาก GA','รถลูกค้า':'ลูกค้ารับ-ส่ง','ขับรถเอง':'ใช้รถส่วนตัว','ไม่ใช้รถ':'งานไม่ใช้รถ'};
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
const VIEWS=['plan','booking','mplan','safety','people','projects','search','dash','ncr','settings','help'];
const TH_MON=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_MON_FULL=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const EN_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const EN_DAY=['SUN','MON','TUE','WED','THU','FRI','SAT'];
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7)}
const TH_DAY=['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
const TH_DAY_FULL=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
