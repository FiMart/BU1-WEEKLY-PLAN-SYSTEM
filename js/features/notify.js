'use strict';
/* BU1 Weekly Plan · การแจ้งเตือน (user, 15 Oct 2026: "เพิ่มการแจ้งเตือนของทุกอย่างในระบบ รวมถึง GA แจ้งข้อมูลรถมาแล้ว";
   chose: bell + corner pop-up + browser notification · GA car · ใบรับคำร้องขอรับบริการสอบเทียบ · Check Sheet · NCR · plans edited / postponed / cancelled ·
   clashes · follow-ups · Safety cards; only what concerns this person).
   Nothing is written to the database. Each browser keeps, per account, a snapshot of what it last saw (localStorage) and compares
   it with what it reads now: a difference = an event (kept in the list, max 150). Follow-ups and clashes are "live": they are listed
   while the condition lasts and pop up once when they first appear. The first look at a collection only takes its snapshot. */
const NTF_CATS=[
  ['ga','GA จัดรถ / เปลี่ยน / ยกเลิก','<path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5"/><path d="M4 16.5h16v2.5H4zM5 12h14"/>'],
  ['job','ใบรับคำร้องขอรับบริการสอบเทียบ','<rect x="5" y="3.5" width="14" height="17.5" rx="2.2"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>'],
  ['cs','Check Sheet','<rect x="4.5" y="3.5" width="15" height="17.5" rx="2.2"/><path d="m8 9 1.4 1.4L12 7.8M8 14l1.4 1.4L12 12.8M14 9.5h3M14 14.5h3"/>'],
  ['ncr','NCR','<rect x="5" y="4" width="14" height="17" rx="2.2"/><path d="M12 9v4.5M12 16.6v.1"/>'],
  ['plan','แผนงานถูกแก้ / เลื่อน / ยกเลิก','<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'],
  ['clash','จัดชน คน / รถ','<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.1"/>'],
  ['follow','งานค้างต้องตาม','<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'],
  ['gareq','คำขอรถ GA (สำหรับ GA)','<path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5"/><path d="M4 16.5h16v2.5H4z"/><path d="M12 2.5v2.5M9.5 3.5l1 1.5M14.5 3.5l-1 1.5"/>'],
  ['mrep','รายงานแผนตอนเช้า','<path d="M12 3v2M5.6 5.6 7 7M3 12h2M17 7l1.4-1.4M19 12h2"/><path d="M7.5 16a4.5 4.5 0 0 1 9 0"/><path d="M3 19.5h18"/><path d="m10 11.5 1.5 1.5 3-3"/>'],
  ['odoc','เอกสาร Onsite ค้าง','<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M14 3v5h5v3M8.5 9h3M8.5 12.5h5"/><circle cx="17" cy="17" r="3.6"/><path d="M17 15.3v1.9l1.2.8"/>'],
  ['safety','บัตร Safety','<path d="M12 3 5 6v5.5c0 4.3 2.9 8 7 9.5 4.1-1.5 7-5.2 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'],
];
const NTF_CAT=Object.fromEntries(NTF_CATS.map(([k,l,i])=>[k,{l,i}]));
/* GA level (user, 2 Nov 2026: "การแจ้งเตือนในส่วนของ GA ถ้าไม่เกี่ยวข้องไม่ต้องแจ้งเตือน"): only the car requests (new / changed /
   withdrawn, today / tomorrow without a car). "GA จัดรถให้แล้ว" is GA's own work, the rest is the department's. */
const NTF_GA_CATS=new Set(['gareq']);
const ntfIsGA=()=>typeof isGA==='function'&&isGA();
const ntfCats=()=>ntfIsGA()?NTF_CATS.filter(([k])=>NTF_GA_CATS.has(k)):NTF_CATS.filter(([k])=>k!=='gareq');
const ntfCatOn=c=>!NTF.prefs.off.includes(c)&&(ntfIsGA()?NTF_GA_CATS.has(c):c!=='gareq');
const NTF={key:'',snap:null,list:[],read:new Set(),seen:new Set(),prefs:{off:[],sys:'all'},snz:{},snzOpen:'',showSnz:false,live:[],range:null,rangeAt:0,busy:false,timer:null,ready:false};
const ntfKeyOf=()=>`bu1wp.ntf|${S.backend||'local'}|${typeof DEPT==='function'?DEPT():''}|${norm(S.me)||'local'}`;
function ntfLoad(){
  const k=ntfKeyOf();if(NTF.key===k)return;NTF.key=k;let d=null;try{d=JSON.parse(localStorage.getItem(k)||'null')}catch(e){}
  NTF.snap=d&&d.snap||null;NTF.list=d&&Array.isArray(d.list)?d.list:[];NTF.read=new Set(d&&d.read||[]);NTF.seen=new Set(d&&d.seen||[]);
  NTF.prefs=Object.assign({off:[],sys:'all'},d&&d.prefs);NTF.snz=Object.assign({},d&&d.snz);NTF.live=[];NTF.range=null;NTF.rangeAt=0;
}
function ntfSave(){try{localStorage.setItem(NTF.key,JSON.stringify({snap:NTF.snap,list:NTF.list.slice(0,150),read:[...NTF.read].slice(-600),seen:[...NTF.seen].slice(-600),prefs:NTF.prefs,snz:NTF.snz}))}catch(e){}}

/* ---------- urgency (v4.50.0): crit = ด่วน / เกินกำหนด · act = ต้องทำ · info = แจ้งให้ทราบ — read from the notice's id, so stored ones work too ---------- */
const NTF_LV={crit:{th:'ด่วน · เกินกำหนด',short:'ด่วน'},act:{th:'ต้องทำ',short:'ต้องทำ'},info:{th:'แจ้งให้ทราบ',short:'แจ้ง'}};
const NTF_LV_N={crit:0,act:1,info:2};
function ntfLevel(x){
  const id=String(x.id||'');const p=id.split(':');const sub=x.live?p[2]:p[1];const c=x.cat;const td=ymd(new Date()),tm=ymd(addDays(new Date(),1));const d=x.ref&&x.ref.date;
  if(x.live){
    if(c==='clash')return 'crit';
    if(c==='job')return sub==='acc'?'crit':'act';
    if(c==='cs')return sub==='due'?'crit':'act';
    if(c==='ncr')return sub==='over'?'crit':'act';
    if(c==='follow')return sub==='late'||((sub==='ga'||sub==='team')&&d===td)?'crit':'act';
    if(c==='odoc')return sub==='over'||sub==='fail'?'crit':'act';
    if(c==='mrep')return /:late$|^live:mrep:miss/.test(id)?'crit':'act';
    if(c==='gareq')return d===td?'crit':'act';
    return 'act'}
  if(c==='ga')return /ยกเลิก/.test(x.title||'')&&d&&d>=td&&d<=tm?'crit':'info';
  if(c==='gareq')return /ด่วน/.test(x.title||'')?'crit':sub==='info'?'info':'act';
  if(c==='plan'&&sub==='st'&&/เลื่อน|ยกเลิก|ไม่เสร็จ/.test(x.title||''))return d&&d>=td&&d<=tm?'crit':'act';
  if(c==='plan'&&sub==='ed')return d&&d>=td&&d<=tm?'act':'info';
  if((c==='job'&&(sub==='new'||sub==='rev'))||(c==='cs'&&(sub==='sub'||sub==='rej'))||(c==='ncr'&&sub==='new'))return 'act';
  return 'info';
}
const ntfLvSort=(a,b)=>NTF_LV_N[ntfLevel(a)]-NTF_LV_N[ntfLevel(b)]||String(b.at||'').localeCompare(String(a.at||''));
const ntfSortLv=l=>l.slice().sort(ntfLvSort);

/* ---------- เลื่อนเตือน (snooze): hidden from the bell, the badge and pop-ups until then; then it comes back unread and pops again ---------- */
const NTF_SNZ=[['h1','1 ชม.'],['h3','3 ชม.'],['tm','พรุ่งนี้ 08:00']];
const ntfSnzUntil=k=>{const n=new Date();if(k==='h1')return n.getTime()+36e5;if(k==='h3')return n.getTime()+3*36e5;const t=addDays(n,1);t.setHours(8,0,0,0);return t.getTime()};
const ntfSnoozed=id=>(NTF.snz&&NTF.snz[id]||0)>Date.now();
const ntfSnzText=id=>{const t=new Date(NTF.snz[id]);const same=ymd(t)===ymd(new Date());return `${same?'':ntfRel(ymd(t))+' '}${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')} น.`};
function ntfSnooze(id,k){NTF.snz=Object.assign({},NTF.snz,{[id]:ntfSnzUntil(k)});NTF.read.add(id);NTF.snzOpen='';ntfSave();ntfBadges();
  const pop=document.querySelector(`#ntfPops [data-pop="${CSS.escape(id)}"]`);if(pop)pop.remove();
  toast(`เลื่อนเตือนถึง ${ntfSnzText(id)}`);if(NTF.open)ntfDrawPanel();if(S.view==='my')render()}
/* snoozes whose time came: back to unread; returns the notices still there, to pop again */
function ntfWake(){const now=Date.now();const out=[];let ch=false;
  for(const [id,t] of Object.entries(NTF.snz||{}))if(t<=now){delete NTF.snz[id];NTF.read.delete(id);ch=true;const x=NTF.live.concat(NTF.list).find(y=>y.id===id);if(x)out.push(x)}
  if(ch)ntfSave();return out}

/* ---------- who this is about ---------- */
const ntfMe=()=>norm(S.me);
const ntfByOther=b=>!b||!ntfMe()||norm(b)!==ntfMe();
/* "ฉันคือพนักงาน" (งานของฉัน): this browser's pick, else the staff member with the account's name */
function ntfMeStaff(){let id='';try{id=localStorage.getItem('bu1wp.meStaff')||''}catch(e){}
  if(id&&S.staff.some(s=>s.id===id))return id;const n=norm(S.account&&S.account.name);const s=n?S.staff.find(x=>norm(x.name)===n):null;return s?s.id:''}
const ntfMySale=name=>{const a=S.account&&S.account.name;return !!a&&!!name&&mdKey(a,true)===mdKey(name,true)};
/* a plan concerns me: Planner = every plan; else I booked it, I am its Sale, or I am in its Team Service */
const ntfMyPlan=t=>!!t&&((!!ntfMe()&&norm(creatorOf(t))===ntfMe())||ntfMySale(t.sale)||(!!ntfMeStaff()&&(t.staffIds||[]).includes(ntfMeStaff())));
const ntfMine=t=>isPlanner()||ntfMyPlan(t);
const ntfWho=b=>b?String(b).split('@')[0]:'';
const ntfPlan=t=>[t.planNo,typeLabel(t)].filter(Boolean).join(' · ')+(t.date?` · ${fmtDay(t.date)}`:'')+(t.customer?` · ${t.customer}`:'');
/* v4.50.0 (user, 27 Nov 2026: "ปรับรูปแบบในการ notification ใหม่"; chose panel · pop-ups · wording · Windows / phone notices,
   grouped by urgency, buttons in each item, snooze): a notice carries its facts apart (m = {pn, ty, d, cu}) so the row shows them
   as chips — Plan No. · customer · วันนี้ / พรุ่งนี้ — and the body says only what happened. Older stored notices have no m. */
const ntfM=t=>({pn:t.planNo||'',ty:typeLabel(t)||'',d:t.date||'',cu:t.customer||''});
const ntfRel=d=>{if(!d)return '';const td=ymd(new Date());return d===td?'วันนี้':d===ymd(addDays(new Date(),1))?'พรุ่งนี้':d===ymd(addDays(new Date(),-1))?'เมื่อวาน':fmtDay(d)};
/* one line of text (pop-up on phones, Windows / phone notification) */
const ntfText=x=>{const m=x.m||{};return [m.pn,m.cu,m.d?ntfRel(m.d):'',x.body].filter(Boolean).join(' · ')};

/* ---------- the plans watched: two weeks back to a month ahead (the open week is always the freshest copy) ---------- */
const ntfWin=()=>({from:ymd(addDays(new Date(),-14)),to:ymd(addDays(new Date(),30))});
function ntfTasks(){const m=new Map();(NTF.range||[]).forEach(t=>m.set(t.id,t));S.tasks.forEach(t=>m.set(t.id,t));const {from,to}=ntfWin();return [...m.values()].filter(t=>t.date>=from&&t.date<=to)}
const NTF_SIG=[['date','วันที่'],['period','ช่วงเวลา'],['timeNote','เวลา'],['customer','ลูกค้า'],['location','สถานที่'],['staffIds','ทีม'],['transport','รถ'],['jobType','หัวข้องาน'],['planNo','Plan No.']];
const ntfSig=t=>NTF_SIG.map(([k])=>{const v=t[k];return Array.isArray(v)?v.slice().sort().join(','):String(v==null?'':v)});
const ntfGa=t=>t.gaCar?JSON.stringify(t.gaCar):'';
const tSnap=t=>({s:t.status||'planned',g:ntfGa(t),u:t.updatedAt||'',f:ntfSig(t),q:typeof gqSig==='function'?gqSig(t):''/* GA: the car request */});

/* clashes of the next two weeks (pairs of plan ids) */
function ntfClashes(tasks){
  const td=ymd(new Date()),end=ymd(addDays(new Date(),13));const byDay=new Map();
  tasks.filter(t=>t.date>=td&&t.date<=end&&holdsTeam(t)).forEach(t=>{if(!byDay.has(t.date))byDay.set(t.date,[]);byDay.get(t.date).push(t)});
  const out=new Map();
  for(const list of byDay.values())for(const t of list)for(const c of conflictsFor(t,list)){const k=[t.id,c.other.id].sort().join('|');if(out.has(k))continue;
    const what=[c.staff&&c.staff.length?(c.leave?'ติดลา ':'คนชน ')+c.staff.map(staffName).join(', '):'',c.veh?'รถซ้ำ '+c.veh:''].filter(Boolean).join(' · ');
    out.set(k,{a:t,b:c.other,what})}
  return out;
}

/* ---------- follow-ups (live while the condition lasts) ---------- */
function ntfLiveOf(tasks,clashes){
  const L=[];const off=c=>!ntfCatOn(c);const td=ymd(new Date()),tm=ymd(addDays(new Date(),1));
  const add=(cat,id,title,body,ref,m)=>{if(!off(cat))L.push({id:`live:${cat}:${id}`,cat,title,body,ref,live:true,...(m?{m}:{})})};
  if(S.jobsReady)S.jobs.forEach(j=>{const jm={pn:j.jobNo||'',cu:j.customer||''};
    if(isPlanner()&&j.state==='pending'){const f=acceptFlow(j);if(f&&f[0]==='delay')add('job','acc:'+j.id,'ใบรับคำร้องรอรับเกินกำหนด',`Sale ${j.sale||'—'} · รอ Planner รับงานและออก PN`,{t:'job',id:j.id},jm)}
    if(isPlanner()&&jbNeedsReview(j))add('job','rev:'+j.id,'Sale แก้ใบรับคำร้องหลังออก PN · รอ review',`${j.planNo?j.planNo+' · ':''}ตรวจแล้วกดยืนยันเพื่อส่งค่าไปที่แผน`,{t:'job',id:j.id},jm)});
  if(S.checksReady)S.checks.forEach(c=>{const F=CS_FORMS[c.form]||{name:c.form};const cm={pn:c.no||'',cu:c.planNo||''};
    if(c.state==='submitted'&&canApprove(c)){const f=csFlow(c);add('cs',(f&&f[0]==='delay'?'due:':'wait:')+c.id,f&&f[0]==='delay'?'Check Sheet รออนุมัติเกินกำหนด':'Check Sheet รอคุณอนุมัติ',`${F.name} · ส่งโดย ${ntfWho(c.submittedBy)||'—'}`,{t:'check',id:c.id},cm)}
    if(c.state==='rejected'&&ntfMe()&&(norm(c.submittedBy)===ntfMe()||norm(c.createdBy)===ntfMe()))add('cs','rej:'+c.id,'Check Sheet ถูกตีกลับ · แก้แล้วส่งใหม่',`${F.name}${c.rejectReason?' · เหตุผล: '+c.rejectReason:''}`,{t:'check',id:c.id},cm)});
  if(S.ncrReady&&isPlanner())S.ncr.forEach(n=>{if(n.state==='closed'||!n.due)return;const nm={pn:n.ncrNo||'',cu:n.customer||'',d:n.due};
    if(ncrOverdue(n))add('ncr','over:'+n.id,'NCR เกินกำหนดแก้ไข',`กำหนด ${fmtDay(n.due)}${n.owner?' · ผู้รับผิดชอบ '+n.owner:''}`,{t:'ncr',id:n.id},nm);
    else if(n.due<=ymd(addDays(new Date(),2)))add('ncr','soon:'+n.id,'NCR ใกล้ถึงกำหนดแก้ไข',`กำหนด ${fmtDay(n.due)}${n.owner?' · ผู้รับผิดชอบ '+n.owner:''}`,{t:'ncr',id:n.id},nm)});
  tasks.forEach(t=>{if(isLeave(t)||!ntfMine(t))return;const d=t.date;const ref={t:'task',id:t.id,date:d};const m=ntfM(t);
    if(isLate(t)&&d>=ymd(addDays(new Date(),-14)))add('follow','late:'+t.id,'เลยวันแล้ว ยังไม่ปิดสถานะงาน',`${m.ty} · กดเปิดแผนแล้วเลือก เสร็จแล้ว / ไม่เสร็จ / เลื่อน`,ref,m);
    if(t.status==='done'&&d>=ymd(addDays(new Date(),-30))){const ms=docMissing(t);if(ms.length)add('follow','doc:'+t.id,'เอกสารหลังจบงานยังไม่ครบ',`ขาด ${ms.map(k=>DOC_NAME[k]).join(', ')}`,ref,m)}
    if(holdsTeam(t)&&gaWaiting(t)&&(d===td||d===tm))add('follow','ga:'+t.id,d===td?'วันนี้ยังไม่มีรถ GA':'พรุ่งนี้ยังไม่มีรถ GA',`ขอรถ GA แล้ว · รอ GA จัดรถ${gaTimes(t)?' · '+gaTimes(t):''}`,ref,m);
    if(holdsTeam(t)&&teamShort(t)>0&&d>=td&&d<=ymd(addDays(new Date(),2)))add('follow','team:'+t.id,'ทีมยังไม่ครบตามที่ต้องการ',`${m.ty} · ${teamNeedText(t)}`,ref,m);
    if(holdsTeam(t)&&t.areaId&&d>=td&&d<=ymd(addDays(new Date(),7))&&typeof cardOf==='function'){
      const bad=(t.staffIds||[]).map(id=>[id,cardOf(id,t.areaId)]).filter(([,c])=>c);
      if(bad.length)add('safety','card:'+t.id,'บัตร Safety ของทีมต้องตรวจ',bad.map(([id,c])=>`${staffName(id)} ${c.txt}`).join(', '),ref,m)}});
  /* ติดตามเอกสาร Onsite (user, 22 Oct 2026; js/features/onsite-docs.js): the Planner and the work's Lead, near or past its Final Date */
  if(typeof odOn==='function')tasks.forEach(t=>{if(!odOn(t)||!(isPlanner()||(!!ntfMeStaff()&&odLeadId(t)===ntfMeStaff())))return;const r=odRow(t);if(r.none)return;
    const miss=r.miss.map(s=>OD_NAME[s.id]).join(', ');const ref={t:'task',id:t.id,date:t.date};const m=ntfM(t);
    if(!!ntfMeStaff()&&odLeadId(t)===ntfMeStaff())r.steps.forEach(s=>{if(s.ck&&s.ck.st==='fail')add('odoc',`fail:${t.id}:${s.id}:${s.ck.at}`,`เอกสารไม่ผ่านการตรวจ · ${OD_NAME[s.id]}`,s.ck.why?'เหตุผล: '+s.ck.why:'แก้แล้วกด "แก้แล้ว ส่งตรวจใหม่"',ref,m)});/* ผลตรวจเอกสาร: the Lead fixes it */
    if(r.status==='follow')add('odoc','over:'+t.id,'เอกสาร Onsite เลย Final แล้ว',`เลยมา ${r.over} วัน · ขาด ${miss}`,ref,m);
    else if(r.status==='wait'&&r.left<=1)add('odoc','soon:'+t.id+':'+r.final,r.left?'เอกสาร Onsite ถึง Final พรุ่งนี้':'เอกสาร Onsite ถึง Final วันนี้',`Final ${fmtDay(r.final)} · ขาด ${miss}`,ref,m)});
  if(typeof mrNotices==='function')mrNotices(tasks,add);/* รายงานแผนตอนเช้า (js/features/morning-report.js) */
  /* GA: today / tomorrow requests still without a car, every plan (js/features/ga-requests.js) */
  if(typeof isGA==='function'&&isGA())tasks.forEach(t=>{if(isLeave(t)||!holdsTeam(t)||!gaWaiting(t)||(t.date!==td&&t.date!==tm))return;
    add('gareq','wait:'+t.id+':'+t.date,t.date===td?`วันนี้ยังไม่ได้จัดรถ${t.gaUrgent?' · ด่วน':''}`:'พรุ่งนี้ยังไม่ได้จัดรถ',gaTimes(t)||'',{t:'task',id:t.id,date:t.date},ntfM(t))});
  for(const [k,c] of clashes)if(ntfMine(c.a)||ntfMine(c.b))add('clash',k,'จัดชน คน / รถ',`${c.what} · ${[c.a.planNo,typeLabel(c.a)].filter(Boolean).join(' ')} ↔ ${[c.b.planNo,typeLabel(c.b)].filter(Boolean).join(' ')}`,{t:'task',id:c.a.id,date:c.a.date},{d:c.a.date});
  return L;
}

/* ---------- one look: read, compare, remember ---------- */
async function ntfTick(force){
  if(NTF.busy||notReady()||!S.tasksReady)return;ntfLoad();NTF.busy=true;
  try{
    if(force||!NTF.range||Date.now()-NTF.rangeAt>60000){const {from,to}=ntfWin();
      try{NTF.range=await quietly(()=>Store.range('tasks',from,to));NTF.rangeAt=Date.now()}catch(e){if(!NTF.range)return}}
    const tasks=ntfTasks();const snap=NTF.snap||{};const ev=[];const now=new Date().toISOString();
    if(ntfIsGA())NTF.list=NTF.list.filter(x=>NTF_GA_CATS.has(x.cat));/* notices kept from before the rule */
    const add=(cat,id,title,body,ref,m)=>{if(ntfCatOn(cat))ev.push({id:`${cat}:${id}:${Date.now().toString(36)}`,cat,title,body,ref,at:now,...(m?{m}:{})})};
    /* GA level (user, 30 Oct 2026): every plan's car request — new, changed, withdrawn (snapshots from before have no q: skipped once) */
    if(snap.t&&typeof isGA==='function'&&isGA())for(const t of tasks){if(isLeave(t))continue;const p=snap.t[t.id];if(p&&p.q===undefined)continue;const was=p?p.q:'',now=gqSig(t);const ref={t:'task',id:t.id,date:t.date};
      const fresh=!p&&(!t.gaRequestedAt||Date.now()-new Date(t.gaRequestedAt)<2*864e5);/* a plan new to the window, asked for lately */
      const m=ntfM(t);
      if(!was&&now&&(p||fresh))add('gareq','new:'+t.id,t.gaUrgent?'ขอรถ GA ใหม่ · ด่วน':'ขอรถ GA ใหม่',gaTimes(t)||'',ref,m);
      else if(was&&!now)add('gareq','can:'+t.id,'แผนกยกเลิกขอรถ GA',t.gaCancel&&t.gaCancel.reason?'เหตุผล: '+t.gaCancel.reason:t.status==='cancelled'?'ยกเลิกแผนงาน':'',ref,m);
      else if(was&&now&&was!==now)add('gareq','ed:'+t.id,'แก้ข้อมูลขอรถ GA',`${gaTimes(t)||''}${t.updatedBy?' · โดย '+ntfWho(t.updatedBy):''}`.replace(/^ · /,''),ref,m)}
    /* plans: GA's answer, status, edits by someone else */
    if(snap.t)for(const t of tasks){const p=snap.t[t.id];if(!p||isLeave(t))continue;const n=tSnap(t);const ref={t:'task',id:t.id,date:t.date};const m=ntfM(t);
      if(p.g!==n.g&&ntfMine(t)){const s=typeof gaSummary==='function'?gaSummary(t):'';
        add('ga','car:'+t.id,!p.g?'GA จัดรถให้แล้ว':!n.g?'GA ยกเลิกรถของแผน':'GA เปลี่ยนรถของแผน',n.g&&s?s:!n.g?'แผนนี้ยังไม่มีรถ · ติดต่อ GA หรือจัดรถแผนก':'',ref,m)}
      if(p.s!==n.s&&ntfMine(t)&&ntfByOther(t.updatedBy)&&!noStatus(t))
        add('plan','st:'+t.id,`แผนงาน${n.s==='done'?'เสร็จแล้ว':n.s==='planned'?'กลับเป็นวางแผน':' '+stTh(n.s)}`,`${t.statusNote?t.statusNote+' · ':''}${t.updatedBy?'โดย '+ntfWho(t.updatedBy):''}`.replace(/ · $/,''),ref,m);
      if(p.u!==n.u&&ntfByOther(t.updatedBy)&&ntfMine(t)){const ch=NTF_SIG.filter((_,i)=>p.f&&p.f[i]!==n.f[i]).map(x=>x[1]);
        if(ch.length)add('plan','ed:'+t.id,`แผนงานถูกแก้ ${ch.join(', ')}`,t.updatedBy?'โดย '+ntfWho(t.updatedBy):'',ref,m)}}
    /* ใบรับคำร้องขอรับบริการสอบเทียบ */
    if(snap.j&&S.jobsReady)for(const j of S.jobs){const p=snap.j[j.id];const ref={t:'job',id:j.id};const mineJ=(!!ntfMe()&&norm(j.bookedBy)===ntfMe())||ntfMySale(j.sale);const jm={pn:j.jobNo||'',cu:j.customer||'',d:j.wantFrom||''};
      if(!p){if(j.state==='pending'&&isPlanner()&&ntfByOther(j.bookedBy))add('job','new:'+j.id,'ใบรับคำร้องใหม่ · รอรับงาน',`Sale ${j.sale||'—'}${j.wantFrom?' · ต้องการ '+fmtDay(j.wantFrom):''}`,ref,jm);continue}
      if(p.s!=='accepted'&&j.state==='accepted'&&mineJ&&ntfByOther(j.acceptedBy))add('job','acc:'+j.id,`Planner รับงานแล้ว · ออก ${j.planNo||'PN'}`,j.acceptedBy?'โดย '+ntfWho(j.acceptedBy):'',ref,jm);
      if(!p.r&&jbNeedsReview(j)&&isPlanner()&&ntfByOther(j.review&&j.review.by))add('job','rev:'+j.id,'Sale แก้ใบรับคำร้องหลังออก PN',`${j.planNo?j.planNo+' · ':''}โดย ${ntfWho(j.review&&j.review.by)}`,ref,jm);
      if(p.s!=='cancelled'&&j.state==='cancelled'&&(isPlanner()||mineJ)&&ntfByOther(j.cancelledBy))add('job','can:'+j.id,'ใบรับคำร้องถูกยกเลิก',j.cancelReason?'เหตุผล: '+j.cancelReason:'',ref,jm)}
    /* Check Sheet */
    if(snap.c&&S.checksReady)for(const c of S.checks){const p=snap.c[c.id];const F=CS_FORMS[c.form]||{name:c.form};const ref={t:'check',id:c.id};const cm={pn:c.no||'',cu:c.planNo||''};
      const mineC=!!ntfMe()&&(norm(c.submittedBy)===ntfMe()||norm(c.createdBy)===ntfMe());
      if((!p||p.s!=='submitted')&&c.state==='submitted'&&canApprove(c))add('cs','sub:'+c.id,'Check Sheet ส่งมาให้คุณอนุมัติ',`${F.name} · ส่งโดย ${ntfWho(c.submittedBy)||'—'}`,ref,cm);
      if(p&&p.s!==c.state&&c.state==='approved'&&mineC&&ntfByOther(c.approvedBy))add('cs','ok:'+c.id,'Check Sheet อนุมัติแล้ว',`${F.name} · โดย ${ntfWho(c.approvedBy)}`,ref,cm);
      if(p&&p.s!==c.state&&c.state==='rejected'&&mineC&&ntfByOther(c.rejectedBy))add('cs','rej:'+c.id,'Check Sheet ถูกตีกลับ',`${F.name}${c.rejectReason?' · เหตุผล: '+c.rejectReason:''}`,ref,cm)}
    /* NCR */
    if(snap.n&&S.ncrReady)for(const n of S.ncr){const p=snap.n[n.id];const ref={t:'ncr',id:n.id};const nm={pn:n.ncrNo||'',cu:n.customer||''};
      if(!p){if(n.state!=='closed'&&isPlanner()&&ntfByOther(n.createdBy))add('ncr','new:'+n.id,'เปิด NCR ใหม่',n.category||'',ref,nm);continue}
      if(p.s!=='closed'&&n.state==='closed'&&(isPlanner()||norm(n.createdBy)===ntfMe())&&ntfByOther(n.closedBy))add('ncr','cl:'+n.id,'ปิด NCR แล้ว',n.closedBy?'โดย '+ntfWho(n.closedBy):'',ref,nm)}
    /* live follow-ups + clashes */
    const cl=ntfClashes(tasks);NTF.live=ntfLiveOf(tasks,cl);
    const first=!NTF.snap;const freshLive=first?[]:NTF.live.filter(x=>!NTF.seen.has(x.id)&&!ntfSnoozed(x.id));
    NTF.live.forEach(x=>NTF.seen.add(x.id));
    const woke=ntfWake();
    NTF.snap={t:Object.fromEntries(tasks.map(t=>[t.id,tSnap(t)])),
      j:S.jobsReady?Object.fromEntries(S.jobs.map(j=>[j.id,{s:j.state,r:jbNeedsReview(j)?1:0}])):snap.j,
      c:S.checksReady?Object.fromEntries(S.checks.map(c=>[c.id,{s:c.state}])):snap.c,
      n:S.ncrReady?Object.fromEntries(S.ncr.map(n=>[n.id,{s:n.state}])):snap.n};
    if(ev.length)NTF.list=ev.concat(NTF.list).slice(0,150);
    ntfSave();NTF.ready=true;
    ntfAnnounce(ev.concat(freshLive,woke.filter(x=>!ev.includes(x)&&!freshLive.includes(x))));ntfBadges();
    if(NTF.open)ntfDrawPanel();
    const sig=NTF.live.map(x=>x.id+x.body).join()+'|'+NTF.list.length;/* งานของฉัน redraws only when its lists changed (render() calls ntfSoon) */
    if(sig!==NTF.sig){NTF.sig=sig;if(S.view==='my'&&!document.querySelector('#view :focus'))render()}
  }finally{NTF.busy=false}
}
function ntfSoon(){clearTimeout(NTF.timer);NTF.timer=setTimeout(()=>ntfTick(),1500)}
setInterval(()=>ntfTick(),60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)ntfTick(true)});

/* ---------- counts, pop-ups, browser notifications ---------- */
const ntfUnread=()=>NTF.list.concat(NTF.live).filter(x=>!NTF.read.has(x.id)&&!ntfSnoozed(x.id)).length;
/* the bell turns red while something urgent is unread */
const ntfUrgent=()=>NTF.list.concat(NTF.live).some(x=>!NTF.read.has(x.id)&&!ntfSnoozed(x.id)&&ntfLevel(x)==='crit');
function ntfBadges(){const n=ntfUnread();const u=n&&ntfUrgent();
  ['#ntfBadge','#ntfBadgeM'].forEach(s=>{const b=$(s);if(b){b.hidden=!n;b.textContent=n>99?'99+':n;b.classList.toggle('ntf-crit',!!u);b.title=u?'มีเรื่องด่วนที่ยังไม่อ่าน':''}});
  const k=NTF.live.filter(x=>!ntfSnoozed(x.id)).length;
  const m=$('#myBadge');if(m){m.hidden=!k;m.textContent=k>99?'99+':k}
  const mb=$('#myBadgeM');if(mb){mb.hidden=!k;mb.textContent=k>99?'99+':k}}
function ntfIcon(cat){const c=NTF_CAT[cat]||NTF_CAT.follow;return `<span class="ntf-ic c-${esc(cat)}" aria-hidden="true"><svg viewBox="0 0 24 24">${c.i}</svg></span>`}
const ntfPhone=()=>window.innerWidth<=760;
const NTF_BELL='<span class="ntf-ic c-all" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg></span>';
/* phones (user, 2 Nov 2026: "ใน mobile ปรับการแจ้งเตือนใหม่ให้เหมาะสมมากกว่านี้"; chose one bar at the top): one notice = its title,
   several = "มีการแจ้งเตือนใหม่ n รายการ"; tap opens it / the list, ✕ or a swipe up closes it, gone after 5 s */
/* v4.50.0: the most urgent first; ด่วน stays 8 s, others 5 s; a coloured edge says how urgent */
function ntfPhoneBar(items){
  const box=ntfPopBox();box.classList.add('top');box.innerHTML='';if(NTF.open)return;
  const list=ntfSortLv(items);const x=list[0],one=list.length===1;const lv=ntfLevel(x);const nc=list.filter(y=>ntfLevel(y)==='crit').length;
  const el=document.createElement('div');el.className=`ntf-pop bar lv-${one?lv:nc?'crit':ntfLevel(x)}`;el.setAttribute('role',lv==='crit'?'alert':'status');
  el.innerHTML=one?`${ntfIcon(x.cat)}<div><span class="ntf-tl"><b>${esc(x.title)}</b>${lv!=='info'?`<em class="ntf-lv">${NTF_LV[lv].short}</em>`:''}</span><span>${esc(ntfText(x))}</span></div><button type="button" class="ntf-x" aria-label="ปิด">✕</button>`
    :`${NTF_BELL}<div><span class="ntf-tl"><b>มีการแจ้งเตือนใหม่ ${list.length} รายการ</b>${nc?`<em class="ntf-lv">ด่วน ${nc}</em>`:''}</span><span>${esc(list.slice(0,2).map(y=>y.title).join(' · '))}${list.length>2?' …':''}</span></div><button type="button" class="ntf-x" aria-label="ปิด">✕</button>`;
  let y0=null;const gone=()=>{el.classList.add('out');setTimeout(()=>el.remove(),300)};
  el.addEventListener('pointerdown',e=>{y0=e.clientY});
  el.addEventListener('pointerup',e=>{if(y0!=null&&e.clientY-y0<-25){y0=null;el.dataset.sw='1';gone()}y0=null});
  el.addEventListener('click',e=>{if(el.dataset.sw)return;el.remove();if(e.target.closest('.ntf-x'))return;if(one){NTF.read.add(x.id);ntfSave();ntfBadges();ntfOpen(x.ref)}else ntfPanel(true)});
  box.appendChild(el);setTimeout(gone,nc||lv==='crit'?8000:5000);
}
function ntfAnnounce(items){
  items=items.filter(x=>!ntfSnoozed(x.id));if(!items.length)return;
  if(ntfPhone())ntfPhoneBar(items);else ntfPops(items);
  ntfSys(items);
}
/* Windows / phone notification: only while this page is in the background, after the person allowed it.
   ⚙ "แจ้งบน Windows / มือถือ" = every notice · ด่วน + ต้องทำ · ด่วนเท่านั้น (NTF.prefs.sys). Up to 3 one by one (ด่วน first, ด่วน stays
   until clicked), more = one summary that opens the bell. */
const NTF_SYS=[['all','ทุกเรื่อง'],['act','ด่วน + ต้องทำ'],['crit','เฉพาะเรื่องด่วน']];
const ntfSysOk=x=>{const p=NTF.prefs.sys||'all';const lv=ntfLevel(x);return p==='all'||(p==='act'&&lv!=='info')||(p==='crit'&&lv==='crit')};
function ntfSys(items){
  if(!document.hidden||!('Notification' in window)||Notification.permission!=='granted')return;
  const pick=ntfSortLv(items).filter(ntfSysOk);if(!pick.length)return;
  const show=(title,o,go)=>{try{const n=new Notification(title,Object.assign({icon:'assets/apple-touch-icon.png',badge:'assets/favicon-32.png'},o));n.onclick=()=>{window.focus();n.close();go()}}catch(e){}};
  if(pick.length<=3)pick.forEach(x=>{const lv=ntfLevel(x);
    show(`${lv==='crit'?'🔴 ด่วน · ':lv==='act'?'🟠 ':''}${x.title}`,{body:ntfText(x),tag:'bu1wp-'+x.id,requireInteraction:lv==='crit',silent:lv==='info'},()=>{NTF.read.add(x.id);ntfSave();ntfBadges();ntfOpen(x.ref)})});
  else{const nc=pick.filter(x=>ntfLevel(x)==='crit').length;
    show(`BU1 Weekly Plan · ${pick.length} เรื่องใหม่${nc?` (ด่วน ${nc})`:''}`,{body:pick.slice(0,4).map(x=>'• '+x.title).join('\n')+(pick.length>4?`\nและอีก ${pick.length-4} เรื่อง`:''),tag:'bu1wp-sum',requireInteraction:!!nc},()=>ntfPanel(true))}
}
/* corner pop-ups (desktop): ด่วน stays until closed, ต้องทำ 12 s, แจ้งให้ทราบ 8 s — the bar under it runs out, a mouse over it pauses it;
   the first button does the main thing, ⏰ 1 ชม. snoozes it */
function ntfPops(items){
  const box=ntfPopBox();box.classList.remove('top');const list=ntfSortLv(items);const show=list.slice(0,3);
  show.forEach(x=>{const lv=ntfLevel(x);const A=ntfActs(x);const ms=lv==='crit'?0:lv==='act'?12000:8000;
    const el=document.createElement('div');el.className=`ntf-pop lv-${lv}`;el.dataset.pop=x.id;el.setAttribute('role',lv==='crit'?'alert':'status');
    el.innerHTML=`${ntfIcon(x.cat)}<div class="ntf-pt"><span class="ntf-tl"><b>${esc(x.title)}</b>${lv!=='info'?`<em class="ntf-lv">${NTF_LV[lv].short}</em>`:''}</span>${ntfChips(x)}${x.body?`<span class="ntf-b">${esc(x.body)}</span>`:''}
      <span class="ntf-pa">${A.slice(0,1).map(([k,l])=>`<button type="button" class="ntf-a pri" data-pop-act="${k}">${esc(l)}</button>`).join('')}<button type="button" class="ntf-a" data-pop-snz title="เลื่อนเตือนอีก 1 ชั่วโมง">⏰ 1 ชม.</button></span></div>
      <button type="button" class="ntf-x" aria-label="ปิด">✕</button>${ms?`<i class="ntf-tm" style="animation-duration:${ms}ms" aria-hidden="true"></i>`:''}`;
    const gone=()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)};
    if(ms)el.querySelector('.ntf-tm').addEventListener('animationend',gone);
    el.addEventListener('click',e=>{e.stopPropagation();const t=e.target;
      if(t.closest('.ntf-x')){el.remove();return}
      if(t.closest('[data-pop-snz]')){el.remove();ntfSnooze(x.id,'h1');return}
      const a=t.closest('[data-pop-act]');el.remove();ntfDo(x,a?a.dataset.popAct:'open')});
    box.appendChild(el)});
  while(box.querySelectorAll('.ntf-pop:not(.more)').length>4)box.querySelector('.ntf-pop:not(.more)').remove();/* the oldest goes */
  if(list.length>3){const el=document.createElement('div');el.className='ntf-pop more';el.innerHTML=`<div><b>และอีก ${list.length-3} รายการ</b><span>กดเพื่อดูการแจ้งเตือนทั้งหมด</span></div>`;el.addEventListener('click',e=>{e.stopPropagation();el.remove();ntfPanel(true)});box.appendChild(el);setTimeout(()=>el.remove(),12000)}
}
function ntfPopBox(){let b=$('#ntfPops');if(!b){b=document.createElement('div');b.id='ntfPops';b.className='ntf-pops';document.body.appendChild(b)}return b}

/* ---------- open what a notification is about ---------- */
async function ntfOpen(ref){
  if(!ref)return;ntfPanel(false);
  if(ref.t==='task'){let t=findTask(ref.id);if(!t){try{t=await Store.get('tasks',ref.id)}catch(e){}if(t)known.set(t.id,t)}
    if(t)openTask(t.id);else toast('ไม่พบแผนนี้แล้ว (อาจถูกลบ)');return}
  if(ref.t==='job'){goView('jobs');if(jbById(ref.id))openJob(ref.id);return}
  if(ref.t==='check'){if(csById(ref.id))openCs(ref.id);else goView('checks');return}
  if(ref.t==='ncr'){goView('ncr');if(S.ncr.some(n=>n.id===ref.id))openNcr(ref.id);return}
  if(ref.t==='view')goView(ref.v);
}

/* ---------- the panel (bell) ---------- */
function ntfAgo(at){const s=(Date.now()-new Date(at))/1000;if(!(s>=0))return '';if(s<60)return 'เมื่อสักครู่';if(s<3600)return `${Math.floor(s/60)} นาทีที่แล้ว`;if(s<86400)return `${Math.floor(s/3600)} ชม. ที่แล้ว`;return jbWhen(at)}
/* every row sits on a strip that a swipe to the left uncovers (touch: mark read, and hide a ล่าสุด item) */
/* v4.50.0: a row = the notice (opens it) + its buttons: the main thing to do · ✓ อ่านแล้ว · ⏰ เลื่อน (1 ชม. · 3 ชม. · พรุ่งนี้ 08:00) */
const ntfChips=x=>{const m=x.m;if(!m)return '';const td=ymd(new Date());const o=[];
  if(m.d)o.push(`<span class="ntf-c d${m.d===td?' td':m.d<td?' past':''}">${esc(ntfRel(m.d))}</span>`);if(m.pn)o.push(`<span class="ntf-c pn">${esc(m.pn)}</span>`);if(m.cu)o.push(`<span class="ntf-c">${esc(m.cu)}</span>`);
  return o.length?`<span class="ntf-cs">${o.join('')}</span>`:''};
/* the main thing(s) a notice asks for, as [kind, label] (kinds run in ntfDo) */
function ntfActs(x){const r=x.ref||{};const id=String(x.id);const A=[];
  if(x.cat==='mrep'&&/:self:/.test(id)&&typeof mrSelf==='function')A.push(['mr','✓ รายงานแผนวันนี้']);
  if(r.t==='task'){
    if(x.cat==='clash'){A.push(['week','ดูวันนั้น']);A.push(['open','เปิดแผน'])}
    else{A.push(['open',x.cat==='follow'&&/:late:/.test(id)?'ปิดสถานะงาน':x.cat==='gareq'?'เปิดคำขอรถ':x.cat==='follow'&&/:doc:/.test(id)?'แนบเอกสาร':'เปิดแผน']);
      if(x.cat==='odoc')A.push(['odoc','ติดตามเอกสาร']);else if(x.cat==='gareq'&&typeof GA_FLEET_URL!=='undefined')A.push(['gaf','GA Fleet']);else if(r.date)A.push(['week','ดูในสัปดาห์'])}}
  else if(r.t==='job'){const j=typeof jbById==='function'?jbById(r.id):null;A.push(['open',j&&j.state==='pending'&&isPlanner()?'เปิดรับงาน':j&&isPlanner()&&jbNeedsReview(j)?'เปิด review':'เปิดใบรับคำร้อง'])}
  else if(r.t==='check'){const c=typeof csById==='function'?csById(r.id):null;A.push(['open',c&&c.state==='submitted'&&canApprove(c)?'เปิดอนุมัติ':c&&c.state==='rejected'?'เปิดแก้ไข':'เปิด Check Sheet'])}
  else if(r.t==='ncr')A.push(['open','เปิด NCR']);
  else if(r.t==='view'&&!A.length)A.push(['open',r.v==='mrep'?'ดูรายงานเช้า':'เปิดหน้า']);
  return A.slice(0,2)}
const ntfFind=id=>NTF.list.concat(NTF.live).find(y=>y.id===id)||null;
function ntfRedraw(){if(NTF.open)ntfDrawPanel();if(S.view==='my'&&!document.querySelector('#view :focus'))render()}
function ntfDo(x,k){NTF.read.add(x.id);NTF.snzOpen='';ntfSave();ntfBadges();
  if(k==='open'){ntfOpen(x.ref);return}
  if(k==='week'){const d=(x.ref&&x.ref.date)||(x.m&&x.m.d);ntfPanel(false);if(S.view!=='plan')goView('plan');if(d)jumpWeek(d);return}
  if(k==='odoc'){ntfPanel(false);goView('odoc');return}
  if(k==='gaf')window.open(GA_FLEET_URL,'_blank','noopener');
  if(k==='mr'&&typeof mrSelf==='function')mrSelf().then(()=>ntfTick(true));
  ntfRedraw()}
const ntfRow=x=>{const lv=ntfLevel(x);const unread=!NTF.read.has(x.id);const snz=ntfSnoozed(x.id);const A=ntfActs(x);const open=NTF.snzOpen===x.id;
  return `<div class="ntf-sw"><span class="ntf-swl" aria-hidden="true">${x.live?'อ่านแล้ว':'อ่านแล้ว · ซ่อน'}</span><div class="ntf-row lv-${lv}${unread?' unread':''}${x.live?' live':''}" data-ntf="${esc(x.id)}">
    <button type="button" class="ntf-main" data-ntf-go>${ntfIcon(x.cat)}<span class="ntf-t"><span class="ntf-tl"><b>${esc(x.title)}</b>${lv!=='info'?`<em class="ntf-lv">${NTF_LV[lv].short}</em>`:''}</span>${ntfChips(x)}${x.body?`<span class="ntf-b">${esc(x.body)}</span>`:''}<small>${x.at?esc(ntfAgo(x.at)):x.live?'ยังค้างอยู่':''}${snz?` · ⏰ เลื่อนถึง ${esc(ntfSnzText(x.id))}`:''}</small></span></button>
    <div class="ntf-acts">${A.map(([k,l],i)=>`<button type="button" class="ntf-a${i?'':' pri'}" data-ntf-act="${k}">${esc(l)}</button>`).join('')}${unread?'<button type="button" class="ntf-a" data-ntf-act="read" title="ทำเครื่องหมายว่าอ่านแล้ว">✓ อ่านแล้ว</button>':''}<button type="button" class="ntf-a snz" data-ntf-snz aria-expanded="${open}" title="เลื่อนเตือนภายหลัง">⏰ เลื่อน</button>${open?`<span class="ntf-snzm" role="group" aria-label="เลื่อนเตือน">${NTF_SNZ.map(([k,l])=>`<button type="button" class="ntf-a" data-ntf-snzt="${k}">${l}</button>`).join('')}${snz?'<button type="button" class="ntf-a" data-ntf-snzt="off">ยกเลิกเลื่อน</button>':''}</span>`:''}</div></div></div>`};
const NTF_SHORT={ga:'GA จัดรถ',job:'ใบรับคำร้อง',cs:'Check Sheet',ncr:'NCR',plan:'แผนงาน',clash:'จัดชน',follow:'งานค้าง',gareq:'คำขอรถ',mrep:'รายงานเช้า',odoc:'เอกสาร Onsite',safety:'Safety'};
const ntfDay=at=>{const k=ymd(new Date(at));return k===ymd(new Date())?'วันนี้':k===ymd(addDays(new Date(),-1))?'เมื่อวาน':'ก่อนหน้านี้'};
function ntfPanel(on){
  let p=$('#ntfPanel');
  if(on===false||(on==null&&p&&!p.hidden)){if(p)p.hidden=true;NTF.open=false;document.body.classList.remove('ntf-lock');document.querySelectorAll('[data-action="ntf"]').forEach(b=>b.setAttribute('aria-expanded','false'));return}
  if(!p){p=document.createElement('section');p.id='ntfPanel';p.className='ntf-panel';p.setAttribute('aria-label','การแจ้งเตือน');document.body.appendChild(p)}
  NTF.open=true;NTF.tab=NTF.tab||'all';NTF.set=false;p.hidden=false;document.querySelectorAll('[data-action="ntf"]').forEach(b=>b.setAttribute('aria-expanded','true'));
  const pops=$('#ntfPops');if(pops)pops.innerHTML='';/* nothing pops over the open list */
  ntfLoad();ntfPlace();ntfDrawPanel();ntfTick();
}
/* phones: the whole screen (page under it does not scroll); wider: beside the bell */
function ntfPlace(){const p=$('#ntfPanel');if(!p||p.hidden)return;
  const b=[...document.querySelectorAll('[data-action="ntf"]')].find(x=>x.offsetParent);const z=(window.uiZoom&&window.uiZoom())||1;const was=p.classList.contains('sheet');
  if(!b||ntfPhone()){p.classList.add('sheet');p.style.left=p.style.top='';document.body.classList.add('ntf-lock');if(!was)ntfDrawPanel();return}
  p.classList.remove('sheet');document.body.classList.remove('ntf-lock');if(was)ntfDrawPanel();const r=b.getBoundingClientRect();p.style.left=Math.round(r.right/z+8)+'px';p.style.top=Math.round(Math.max(8,r.top/z-6))+'px'}
window.addEventListener('resize',ntfPlace);
function ntfDrawPanel(){
  const p=$('#ntfPanel');if(!p||p.hidden)return;
  const full=p.classList.contains('sheet');
  /* unread tab, then the category chips (only categories that have something), then by day */
  /* v4.50.0: grouped by urgency — ด่วน · เกินกำหนด / ต้องทำ (follow-ups still open + unread notices of that kind) / ความเคลื่อนไหวล่าสุด
     (everything else, newest first, by day); snoozed ones only under "เลื่อนไว้" */
  const keep=x=>(NTF.tab!=='unread'||!NTF.read.has(x.id))&&!ntfSnoozed(x.id);const evAll=NTF.list.filter(keep),liveAll=NTF.live.filter(keep);
  const cnt={};liveAll.concat(evAll).forEach(x=>{cnt[x.cat]=(cnt[x.cat]||0)+1});const cats=ntfCats().map(c=>c[0]).filter(k=>cnt[k]);
  if(NTF.cat&&!cnt[NTF.cat])NTF.cat='';const inCat=x=>!NTF.cat||x.cat===NTF.cat;
  const ev=evAll.filter(inCat),live=liveAll.filter(inCat);
  const chips=cats.length>1?`<div class="ntf-cats" role="group" aria-label="หมวด"><button type="button" class="ntf-cat${!NTF.cat?' on':''}" data-ntf-cat-f="">ทั้งหมด <b>${liveAll.length+evAll.length}</b></button>${cats.map(k=>`<button type="button" class="ntf-cat${NTF.cat===k?' on':''}" data-ntf-cat-f="${k}">${esc(NTF_SHORT[k]||k)} <b>${cnt[k]}</b></button>`).join('')}</div>`:'';
  const top=live.concat(ev.filter(x=>!NTF.read.has(x.id)&&ntfLevel(x)!=='info'));const topIds=new Set(top.map(x=>x.id));
  const byLv=lv=>top.filter(x=>ntfLevel(x)===lv).sort((a,b)=>(b.live?1:0)-(a.live?1:0)||String(b.at||'').localeCompare(String(a.at||'')));
  const crit=byLv('crit'),act=byLv('act');const rest=ev.filter(x=>!topIds.has(x.id)).slice(0,80);
  const days=['วันนี้','เมื่อวาน','ก่อนหน้านี้'].map(d=>[d,rest.filter(x=>ntfDay(x.at)===d)]).filter(([,l])=>l.length);
  const zz=NTF.list.concat(NTF.live).filter(x=>ntfSnoozed(x.id));if(!zz.length)NTF.showSnz=false;
  const sec=(lv,l)=>l.length?`<p class="ntf-h lv-${lv}"><i aria-hidden="true"></i>${NTF_LV[lv].th}<b>${l.length}</b></p>${l.map(ntfRow).join('')}`:'';
  const readN=NTF.list.filter(x=>NTF.read.has(x.id)).length;
  const perm='Notification' in window?Notification.permission:'none';
  p.innerHTML=`<header>${full?'<button type="button" class="icon-btn sm ntf-back" data-ntf-close aria-label="กลับ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg></button>':''}<b>การแจ้งเตือน</b><span class="grow"></span>${NTF.set?'':`<button type="button" class="lnk" data-ntf-all>อ่านทั้งหมด</button>`}<button type="button" class="icon-btn sm" data-ntf-set aria-label="ตั้งค่าการแจ้งเตือน" title="ตั้งค่า"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2"/></svg></button>${full?'':'<button type="button" class="icon-btn sm" data-ntf-close aria-label="ปิด">✕</button>'}</header>
    ${NTF.set?`<div class="ntf-set"><p>เลือกเรื่องที่ต้องการให้แจ้ง (เก็บในเบราว์เซอร์นี้)</p>${ntfCats().map(([k,l])=>`<label><input type="checkbox" data-ntf-cat="${k}"${NTF.prefs.off.includes(k)?'':' checked'}> ${ntfIcon(k)} ${esc(l)}</label>`).join('')}
      <div class="ntf-sysp"><b>แจ้งบน Windows / มือถือ</b><div class="ntf-sysr" role="radiogroup" aria-label="แจ้งบน Windows / มือถือ">${NTF_SYS.map(([k,l])=>`<label><input type="radio" name="ntf-sys" data-ntf-sys="${k}"${(NTF.prefs.sys||'all')===k?' checked':''}> ${l}</label>`).join('')}</div></div>
      <div class="ntf-perm">${perm==='granted'?'✓ แจ้งเตือนบน Windows / มือถือ เปิดอยู่ (เด้งเมื่อหน้านี้เปิดค้างไว้ในแท็บอื่น)':perm==='denied'?'การแจ้งเตือนของเบราว์เซอร์ถูกปิดไว้ · เปิดได้ที่ไอคอนแม่กุญแจหน้าที่อยู่เว็บ':perm==='none'?'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนของระบบ':'<button type="button" class="btn sm primary" data-ntf-perm>เปิดแจ้งเตือนบน Windows / มือถือ</button>'}</div>
      <button type="button" class="btn sm" data-ntf-set>เสร็จ</button></div>`
    :`<div class="seg ntf-tabs" role="tablist"><button type="button" role="tab" data-ntf-tab="all" aria-selected="${NTF.tab!=='unread'}">ทั้งหมด</button><button type="button" role="tab" data-ntf-tab="unread" aria-selected="${NTF.tab==='unread'}">ยังไม่อ่าน ${ntfUnread()?`(${ntfUnread()})`:''}</button></div>
    ${chips}${full&&(live.length||ev.length)?'<p class="ntf-tip">ปัดรายการไปทางซ้าย = อ่านแล้ว / ซ่อน</p>':''}
    <div class="ntf-list">${NTF.showSnz?`<p class="ntf-h lv-snz"><i aria-hidden="true"></i>เลื่อนเตือนไว้<b>${zz.length}</b></p>${zz.map(ntfRow).join('')}`
      :`${sec('crit',crit)}${sec('act',act)}
      ${(live.length||ev.length)&&!crit.length&&!act.length?'<p class="ntf-clear">✓ ไม่มีเรื่องด่วนหรืองานที่ต้องทำ</p>':''}
      ${days.length?`<p class="ntf-h lv-info"><i aria-hidden="true"></i>ความเคลื่อนไหวล่าสุด</p>${days.map(([d,l])=>`<p class="ntf-d">${d}</p>${l.map(ntfRow).join('')}`).join('')}`:''}`}
      ${!NTF.showSnz&&!live.length&&!ev.length?`<p class="ntf-empty">${!NTF.ready?'กำลังตรวจข้อมูล…':NTF.tab==='unread'?'อ่านครบแล้ว':'ไม่มีการแจ้งเตือน'}<small>${ntfIsGA()?'คำขอรถ GA ใหม่ แก้ไข หรือยกเลิก จะขึ้นที่นี่':'เรื่องใหม่ เช่น GA จัดรถ ใบรับคำร้องขอรับบริการสอบเทียบ Check Sheet จะขึ้นที่นี่'}</small></p>`:''}</div>
    ${perm==='default'?'<button type="button" class="ntf-ask" data-ntf-perm>🔔 เปิดแจ้งเตือนบน Windows / มือถือ เพื่อรู้แม้เปิดหน้าอื่นอยู่</button>':''}
    <footer>${zz.length?`<button type="button" class="lnk" data-ntf-zz aria-pressed="${NTF.showSnz}">${NTF.showSnz?'‹ กลับ':`⏰ เลื่อนไว้ ${zz.length}`}</button>`:''}${readN?`<button type="button" class="lnk" data-ntf-clear title="ลบรายการล่าสุดที่อ่านแล้วออกจากรายการในเบราว์เซอร์นี้">ล้างที่อ่านแล้ว (${readN})</button>`:''}<span class="grow"></span>${ntfIsGA()?'':'<button type="button" class="lnk" data-ntf-my>เปิดหน้างานของฉัน ›</button>'}</footer>`}`;
}
/* touch: swipe a row to the left = mark read (a ล่าสุด item is also hidden); the click that ends a swipe is ignored */
let NSW=null,ntfSwAt=0;
document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;const r=e.target.closest&&e.target.closest('#ntfPanel .ntf-row');if(r)NSW={r,x:e.clientX,y:e.clientY,dx:0,on:false,id:e.pointerId}});
document.addEventListener('pointermove',e=>{if(!NSW||e.pointerId!==NSW.id)return;const dx=e.clientX-NSW.x,dy=e.clientY-NSW.y;
  if(!NSW.on){if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5){NSW.on=true;NSW.r.classList.add('swiping')}else{if(Math.abs(dy)>12)NSW=null;return}}
  NSW.dx=Math.min(0,dx);NSW.r.style.transform=`translateX(${NSW.dx}px)`;NSW.r.parentElement.classList.toggle('go',NSW.dx<-80)});
const ntfSwEnd=e=>{if(!NSW||(e&&e.pointerId!==NSW.id))return;const s=NSW;NSW=null;if(!s.on)return;ntfSwAt=Date.now();s.r.classList.remove('swiping');
  if(e&&e.type==='pointerup'&&s.dx<-80){const id=s.r.dataset.ntf;NTF.read.add(id);if(!s.r.classList.contains('live'))NTF.list=NTF.list.filter(x=>x.id!==id);ntfSave();ntfBadges();s.r.style.transform='translateX(-110%)';setTimeout(ntfDrawPanel,180)}
  else{s.r.style.transform='';s.r.parentElement.classList.remove('go')}};
document.addEventListener('pointerup',ntfSwEnd);document.addEventListener('pointercancel',ntfSwEnd);
document.addEventListener('click',e=>{const t=e.target;
  const cf=t.closest('[data-ntf-cat-f]');if(cf){NTF.cat=cf.dataset.ntfCatF;ntfDrawPanel();return}
  if(t.closest('[data-ntf-clear]')){NTF.list=NTF.list.filter(x=>!NTF.read.has(x.id));ntfSave();ntfBadges();ntfDrawPanel();return}
  const row=t.closest('[data-ntf]');
  if(row){if(Date.now()-ntfSwAt<400)return;const x=ntfFind(row.dataset.ntf);if(!x){row.remove();return}
    if(t.closest('[data-ntf-go]')){ntfDo(x,'open');return}
    const ac=t.closest('[data-ntf-act]');if(ac){ntfDo(x,ac.dataset.ntfAct);return}
    if(t.closest('[data-ntf-snz]')){NTF.snzOpen=NTF.snzOpen===x.id?'':x.id;ntfRedraw();return}
    const st=t.closest('[data-ntf-snzt]');if(st){if(st.dataset.ntfSnzt==='off'){delete NTF.snz[x.id];NTF.snzOpen='';ntfSave();ntfBadges();ntfRedraw()}else ntfSnooze(x.id,st.dataset.ntfSnzt);return}
    return}
  if(t.closest('[data-ntf-zz]')){NTF.showSnz=!NTF.showSnz;NTF.snzOpen='';ntfDrawPanel();return}
  if(t.closest('[data-ntf-close]')){ntfPanel(false);return}
  if(t.closest('[data-ntf-all]')){NTF.list.concat(NTF.live).forEach(x=>NTF.read.add(x.id));ntfSave();ntfBadges();ntfDrawPanel();return}
  if(t.closest('[data-ntf-set]')){NTF.set=!NTF.set;ntfDrawPanel();return}
  const tb=t.closest('[data-ntf-tab]');if(tb){NTF.tab=tb.dataset.ntfTab;ntfDrawPanel();return}
  if(t.closest('[data-ntf-perm]')){if('Notification' in window)Notification.requestPermission().then(()=>ntfDrawPanel());return}
  if(t.closest('[data-ntf-my]')){ntfPanel(false);goView('my');return}
  if(NTF.open&&!t.closest('#ntfPanel')&&!t.closest('[data-action="ntf"]'))ntfPanel(false);
});
document.addEventListener('change',e=>{const s=e.target.closest&&e.target.closest('[data-ntf-sys]');if(s){NTF.prefs.sys=s.dataset.ntfSys;ntfSave();return}
  const c=e.target.closest&&e.target.closest('[data-ntf-cat]');if(!c)return;const k=c.dataset.ntfCat;
  const off=new Set(NTF.prefs.off);c.checked?off.delete(k):off.add(k);NTF.prefs.off=[...off];ntfSave();ntfTick(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&NTF.open)ntfPanel(false)});
