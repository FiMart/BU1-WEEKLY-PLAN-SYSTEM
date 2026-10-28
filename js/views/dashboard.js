'use strict';
/* BU1 Weekly Plan · dashboard: an organisation report for a week, month, quarter or year, with A4 print and Excel exports */
/* ---------- view: dashboard ---------- */
const DASH_MODES=[['week','รายสัปดาห์'],['month','รายเดือน'],['quarter','รายไตรมาส'],['year','รายปี']];
const DASH_SEG=[['done','var(--good)'],['notdone','var(--crit)'],['planned','var(--muted)'],['postponed','var(--warn)']];
const DASH_ORG='BU1 Lab · Laboratory Department';
const f1=n=>(Math.round(n*10)/10).toLocaleString('th-TH',{maximumFractionDigits:1});
const pct=(a,b)=>b?Math.round(a/b*100):0;
const thDate=s=>{const d=parseD(s);return `${fmtShort(d)} ${be(d)}`};
const PRINT_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/></svg>';
function hbars(items,unit){
  const max=Math.max(1,...items.map(x=>x.n));
  return `<div class="hbars">${items.map(x=>`<div class="hb"><span class="hb-label" title="${esc(x.label)}">${x.color?`<i style="background:${safeColor(x.color)}"></i>`:''}${esc(x.label)}</span><span class="hb-track"><span class="hb-bar" style="width:${x.n/max*100}%${x.color?';background:'+safeColor(x.color):''}" data-tip="${esc(x.label)}: ${x.n} ${unit}${x.extra?' · '+esc(x.extra):''}"></span></span><span class="hb-val">${x.n}${x.extra?` <span class="hint">· ${esc(x.extra)}</span>`:''}</span></div>`).join('')||'<p class="hint">ยังไม่มีข้อมูลในช่วงนี้</p>'}</div>`;
}

/* the report period, the one before it (for comparison) and how the trend chart is bucketed */
function dashPeriod(){
  const mode=S.dash.mode,m=S.month,y=m.getFullYear(),mo=m.getMonth();
  if(mode==='week'){const {from,to}=weekRange();return {mode,from,to,label:'สัปดาห์ '+weekName(S.week),pFrom:ymd(addDays(S.week,-7)),pTo:ymd(addDays(S.week,-1)),pLabel:'สัปดาห์ก่อน',unit:'day'}}
  if(mode==='month')return {mode,from:ymd(m),to:ymd(new Date(y,mo+1,0)),label:`${TH_MON_FULL[mo]} ${be(m)}`,pFrom:ymd(new Date(y,mo-1,1)),pTo:ymd(new Date(y,mo,0)),pLabel:'เดือนก่อน',unit:'day'};
  if(mode==='quarter'){const q=Math.floor(mo/3);const s=new Date(y,q*3,1);
    return {mode,from:ymd(s),to:ymd(new Date(y,q*3+3,0)),label:`ไตรมาส ${q+1}/${be(s)} (${TH_MON[q*3]} – ${TH_MON[q*3+2]})`,pFrom:ymd(new Date(y,q*3-3,1)),pTo:ymd(new Date(y,q*3,0)),pLabel:'ไตรมาสก่อน',unit:'week'}}
  return {mode:'year',from:`${y}-01-01`,to:`${y}-12-31`,label:`ปี ${be(m)}`,pFrom:`${y-1}-01-01`,pTo:`${y-1}-12-31`,pLabel:'ปีก่อน',unit:'month'};
}
/* bucket ranges of a period: days (week, month), Monday weeks (quarter) or months (year) — the trend chart's columns */
function dashRanges(from,to,unit){
  const out=[];
  if(unit==='day')for(let d=parseD(from);ymd(d)<=to;d=addDays(d,1))out.push({a:ymd(d),b:ymd(d)});
  else if(unit==='week')for(let w=mondayOf(parseD(from));ymd(w)<=to;w=addDays(w,7))out.push({a:ymd(w)<from?from:ymd(w),b:ymd(addDays(w,6))>to?to:ymd(addDays(w,6))});
  else for(let i=0;i<12;i++){const s=new Date(parseD(from).getFullYear(),i,1);out.push({a:ymd(s),b:ymd(new Date(s.getFullYear(),i+1,0))})}
  return out;
}
function dashStep(dir){const st={month:1,quarter:3,year:12}[S.dash.mode]||1;setMonth(dir?new Date(S.month.getFullYear(),S.month.getMonth()+dir*st,1):new Date())}

/* every figure the report shows, computed once and shared by the page, the A4 print and the Excel file */
function dashCompute(){
  const P=dashPeriod();const {from,to}=P;
  /* the open สายงาน tab (lineMatch): its plans, plans without a line, and leave */
  const lt=l=>l&&l.filter(lineMatch);
  const raw=P.mode==='week'?S.tasks:rangeTasks(from,to);const tasks=lt(raw);const prev=lt(rangeTasks(P.pFrom,P.pTo));
  if(!tasks)return {P,loading:true};
  const today=ymd(new Date());const inR=t=>t.date>=from&&t.date<=to;
  const all=tasks.filter(inR);const work=all.filter(isWorking);const jobs=work.filter(t=>!isLeave(t));const leaves=work.filter(isLeave);
  const days=[];for(let d=parseD(from);ymd(d)<=to;d=addDays(d,1))days.push(new Date(d));
  /* every day minus public holidays (user, 22 Oct 2026: "นับเสาร์อาทิตย์ด้วยเรื่องของแผนงาน และกำลังคน", chose "นับทุกวันทั้งหมด";
     was Mon–Fri since 19 Oct 2026) — work on a public holiday is OT */
  const workDays=days.filter(isUtoDay);
  const active=S.staff.filter(s=>s.active!==false);const conf=conflictsIn(work);
  const stc=Object.fromEntries(STATUSES.map(s=>[s.id,0]));all.filter(t=>!isLeave(t)).forEach(t=>{const k=t.status||'planned';stc[k]=(stc[k]||0)+1});
  /* ไม่เสร็จ split (user, 28 Oct 2026): งานต่อเนื่อง (no NCR) apart from the ones that need an NCR */
  const contN=all.filter(t=>!isLeave(t)&&t.status==='notdone'&&t.cont).length;const ndNcrN=(stc.notdone||0)-contN;
  const ndSplit=stc.notdone?` (งานต่อเนื่อง ${contN} · ต้องเปิด NCR ${ndNcrN})`:'';
  const allJ=Object.values(stc).reduce((a,n)=>a+n,0);const totalJ=jobs.length;
  const due=jobs.filter(t=>t.date<=today);const doneDue=due.filter(t=>t.status==='done').length;const doneRate=due.length?pct(doneDue,due.length):null;
  const pcN=stc.postponed+stc.cancelled;const pcRate=pct(pcN,allJ);
  const confN=work.filter(t=>conf.has(t.id)).length;const lateN=jobs.filter(isLate).length;const gaN=work.filter(t=>gaWaiting(t)).length;const docN=jobs.filter(t=>docMissing(t).length).length;/* done, เอกสารหลังจบงาน missing */

  /* people */
  const pst=new Map();
  const ps=id=>{if(!pst.has(id))pst.set(id,{jobs:0,am:0,pm:0,full:0,days:new Map(),dates:new Set(),leave:new Set(),conf:0,types:new Map()});return pst.get(id)};
  /* man-days (user, 19 Oct 2026: "อยากให้ตัวเลขตรงขึ้น"): only plans that hold the team (holdsTeam — not เลื่อน / ยกเลิก) fill a day;
     a person's capacity = working days minus their leave on those days (half-day leave = 0.5) */
  const wkSet=new Set(workDays.map(ymd));
  jobs.forEach(t=>{const per=periodOf(t);(t.staffIds||[]).forEach(id=>{const p=ps(id);p.jobs++;p[per]++;
    const k=typeLabel(t);p.types.set(k,(p.types.get(k)||0)+1);if((conf.get(t.id)||[]).some(c=>c.staff.includes(id)))p.conf++})});
  /* busy days come from plans of EVERY สายงาน (user, 19 Oct 2026): people work on both lines, so a day on a Flow Meter plan is not
     free capacity on the Instrument tab — man-days / Utilization / ว่าง (วัน) are the same whatever tab is open */
  raw.filter(t=>inR(t)&&!isLeave(t)&&isWorking(t)).forEach(t=>{const PR=PERIOD[periodOf(t)];const holds=holdsTeam(t);(t.staffIds||[]).forEach(id=>{const p=ps(id);
    if(holds){const sl=p.days.get(t.date)||{am:false,pm:false};sl.am=sl.am||PR.a===0;sl.pm=sl.pm||PR.b===1;p.days.set(t.date,sl)}p.dates.add(t.date)})});
  const lvSlot=new Map();/* id|date → {am, pm} of leave on a working day */
  leaves.forEach(t=>{const PR=PERIOD[periodOf(t)];(t.staffIds||[]).forEach(id=>{const p=ps(id);p.leave.add(t.date);p.dates.add(t.date);
    if(!wkSet.has(t.date))return;const k=id+'|'+t.date;const sl=lvSlot.get(k)||{am:false,pm:false};sl.am=sl.am||PR.a===0;sl.pm=sl.pm||PR.b===1;lvSlot.set(k,sl)})});
  const slotN=x=>x.am&&x.pm?1:.5;
  const people=S.staff.filter(s=>s.active!==false||pst.has(s.id)).map(s=>{const p=ps(s.id);const dd=[...p.days];
    const wd=dd.filter(([k])=>wkSet.has(k)).reduce((a,[,x])=>a+slotN(x),0);const ot=dd.filter(([k])=>!wkSet.has(k)).reduce((a,[,x])=>a+slotN(x),0);/* OT = public holidays */
    const we=dd.filter(([k])=>wkSet.has(k)&&[0,6].includes(parseD(k).getDay())).reduce((a,[,x])=>a+slotN(x),0);/* the Sat / Sun part of wd */
    const lv=workDays.reduce((a,d)=>{const sl=lvSlot.get(s.id+'|'+ymd(d));return a+(!sl?0:sl.am&&sl.pm?1:.5)},0);
    const top=[...p.types].sort((a,b)=>b[1]-a[1])[0];return Object.assign({s,wd,we,ot,lv,cap:Math.max(0,workDays.length-lv),free:workDays.filter(d=>!p.dates.has(ymd(d))).length,top:top?`${top[0]} (${top[1]})`:''},p)})
    .sort((a,b)=>b.jobs-a.jobs||b.wd-a.wd||sortPeople(a.s,b.s));
  /* man-days of the open ทีม's active people (all active people when no team is picked) */
  const uPeople=people.filter(p=>p.s.active!==false&&inTeam(p.s));
  const manDays=uPeople.reduce((a,p)=>a+p.wd,0);const weDays=uPeople.reduce((a,p)=>a+p.we,0);const otDays=uPeople.reduce((a,p)=>a+p.ot,0);
  /* each work team's own load for the team chart (user, 22 Oct 2026: "ใช้กำลังคนตามตำแหน่ง ตรงแยกตามทีมให้โชว์กราฟ"); All Team people count in both */
  const teamUse=WORK_TEAMS.map(tm=>{const g=people.filter(p=>p.s.active!==false&&inTeamId(p.s,tm.id));const md=g.reduce((a,p)=>a+p.wd,0),cap=g.reduce((a,p)=>a+p.cap,0);
    return {tm,n:g.length,md,we:g.reduce((a,p)=>a+p.we,0),ot:g.reduce((a,p)=>a+p.ot,0),cap,util:pct(md,cap)}});
  /* Utilization = Utilization Manpower Onsite (js/views/dash-util.js): onsite works ÷ (working days × works a day), every สายงาน */
  const U=utoCount(raw,from,to);const util=U.util;
  const busyN=people.filter(p=>p.jobs>0).length;const leaveDays=people.reduce((a,p)=>a+p.leave.size,0);
  const avgTeam=totalJ?jobs.reduce((a,t)=>a+(t.staffIds||[]).length+(t.guests||[]).length,0)/totalJ:0;
  const prevJobs=prev?prev.filter(t=>t.date>=P.pFrom&&t.date<=P.pTo&&isWorking(t)&&!isLeave(t)):null;
  const prevDoneRate=prevJobs&&prevJobs.length?pct(prevJobs.filter(t=>t.status==='done').length,prevJobs.length):null;

  /* roles: capacity = people × working days (every day but public holidays) − their leave */
  const groupRows=keyOf=>{const m=new Map();active.forEach(s=>{const k=keyOf(s);if(!m.has(k))m.set(k,{k,n:0,ids:new Set()});const x=m.get(k);x.n++;x.ids.add(s.id)});
    return [...m.values()].map(x=>{const g=people.filter(p=>x.ids.has(p.s.id));const md=g.reduce((a,p)=>a+p.wd,0);const cap=g.reduce((a,p)=>a+p.cap,0);
      return Object.assign(x,{jobs:jobs.filter(t=>(t.staffIds||[]).some(id=>x.ids.has(id))).length,md,util:pct(md,cap)})})};
  const order=positions();const roleRows=groupRows(roleOf)
    .sort((a,b)=>((order.indexOf(a.k)+1)||999)-((order.indexOf(b.k)+1)||999)||a.k.localeCompare(b.k,'th'));

  /* job types, customers, vehicles, sales */
  const types=jobTypes().filter(t=>!isLeaveId(t.id)).map(ty=>({label:ty.name,n:jobs.filter(t=>typeIdOf(t)===ty.id).length,id:ty.id})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  const knownIds=new Set(jobTypes().map(t=>t.id));const orphanN=jobs.filter(t=>!knownIds.has(typeIdOf(t))).length;if(orphanN)types.push({label:'ประเภทที่ถูกลบแล้ว',n:orphanN});
  const custKeyOf=t=>String(t.customer||'').trim()||'(ไม่ระบุลูกค้า)';
  const cust=new Map();jobs.forEach(t=>{const k=custKeyOf(t);cust.set(k,(cust.get(k)||0)+1)});const custList=[...cust].sort((a,b)=>b[1]-a[1]);
  const veh=new Map();jobs.forEach(t=>deptCars(t).forEach(v=>{if(!veh.has(v))veh.set(v,{n:0,d:new Set()});const x=veh.get(v);x.n++;x.d.add(t.date)}));/* each department vehicle of a plan (up to 2) */
  const vehList=[...veh].sort((a,b)=>b[1].n-a[1].n).map(([k,x])=>({k,label:k==='GA'?'รถ GA':k,n:x.n,days:x.d.size}));
  const noCar=jobs.filter(t=>!deptCars(t).length&&!t.needGA).length;
  const sale=new Map();jobs.forEach(t=>{const k=String(t.sale||'').trim()||'(ไม่ระบุ Sale)';sale.set(k,(sale.get(k)||0)+1)});const saleList=[...sale].sort((a,b)=>b[1]-a[1]);

  /* สายงาน: each line's plans, completion and man-days; and the Flow Meter calibration rows (Weekly plan calibration) */
  const lineRows=LINES.map(l=>{const lj=jobs.filter(t=>lineOf(t)===l.id);const ld=lj.filter(t=>t.date<=today);const ldone=ld.filter(t=>t.status==='done').length;
    return {l,n:lj.length,done:lj.filter(t=>t.status==='done').length,due:ld.length,doneRate:ld.length?pct(ldone,ld.length):null,
      md:lj.reduce((a,t)=>a+((t.staffIds||[]).length+(t.guests||[]).length)*(periodOf(t)==='full'?1:.5),0),cust:new Set(lj.map(custKeyOf)).size,
      share:pct(lj.length,totalJ)}});
  const noLineN=jobs.filter(t=>!lineOf(t)).length;
  /* ทีม (user, 8 Oct 2026): plans with someone of the team on them, completion, and the team's own man-days */
  /* All Team people count in both teams (user, 9 Oct 2026) */
  const tOf=id=>teamOf(S.staff.find(s=>s.id===id));const inT=(id,tm)=>inTeamId(S.staff.find(s=>s.id===id),tm);
  const teamRows=WORK_TEAMS.map(tm=>{const tj=jobs.filter(t=>(t.staffIds||[]).some(id=>inT(id,tm.id)));const td=tj.filter(t=>t.date<=today);
    return {tm,n:tj.length,done:tj.filter(t=>t.status==='done').length,doneRate:td.length?pct(td.filter(t=>t.status==='done').length,td.length):null,
      md:tj.reduce((a,t)=>a+(t.staffIds||[]).filter(id=>inT(id,tm.id)).length*(periodOf(t)==='full'?1:.5),0),
      people:S.staff.filter(s=>s.active!==false&&inTeamId(s,tm.id)).length,share:pct(tj.length,totalJ)}});
  const noTeamN=jobs.filter(t=>!(t.staffIds||[]).some(id=>tOf(id))).length;
  const calR=calWeekRows(jobs);const cal=calStats(calR.map(r=>r.x));const judged=cal.pass+cal.fail;const passRate=judged?pct(cal.pass,judged):null;
  const countBy=f=>{const m=new Map();calR.forEach(r=>{const k=String(f(r)||'').trim()||'(ไม่ระบุ)';m.set(k,(m.get(k)||0)+1)});return [...m].sort((a,b)=>b[1]-a[1])};
  const calTypes=countBy(r=>r.x.type),calLabs=countBy(r=>r.x.lab),calSizes=countBy(r=>r.x.size),calCust=countBy(r=>r.t.customer),
    calFluids=countBy(r=>r.x.fluid),calRounds=countBy(r=>r.x.round);
  /* Weekly plan instrument: rows, Plan vs Actual, Completed, certificates; Type "PT,TT,TE" counts each code */
  const insR=insWeekRows(jobs);const ins=insStats(insR.map(r=>r.x));const insRate=ins.plan?pct(ins.actual,ins.plan):null;
  const countIns=f=>{const m=new Map();insR.forEach(r=>{const ks=[].concat(f(r)).map(k=>String(k||'').trim()).filter(Boolean);(ks.length?ks:['(ไม่ระบุ)']).forEach(k=>m.set(k,(m.get(k)||0)+1))});return [...m].sort((a,b)=>b[1]-a[1])};
  const insTypes=countIns(r=>String(r.x.type||'').split(/\s*[,/]\s*/)),insLabs=countIns(r=>r.x.lab),insPlants=countIns(r=>r.x.plant),insCust=countIns(r=>r.t.customer);

  /* conflicts (one row per pair) and follow-up */
  const pairs=[];const seenPair=new Set();
  work.forEach(t=>(conf.get(t.id)||[]).forEach(c=>{
    const k=[t.id,c.other.id].sort().join('|');if(seenPair.has(k))return;seenPair.add(k);
    const [a,b]=isLeave(t)&&!isLeave(c.other)?[c.other,t]:[t,c.other];
    pairs.push({a,b,staff:c.staff,veh:c.veh,leave:c.leave});
  }));
  pairs.sort((x,y)=>byTime(x.a,y.a)||byTime(x.b,y.b));
  const follow=all.filter(t=>!isLeave(t)&&(NEEDS_REASON.has(t.status)||isLate(t)||(isWorking(t)&&gaWaiting(t))||docMissing(t).length)).sort(byTime);

  /* trend buckets: days (week, month), weeks (quarter) or months (year) */
  const mk=(a,b)=>{const l=jobs.filter(t=>t.date>=a&&t.date<=b);return {n:l.length,c:Object.fromEntries(DASH_SEG.map(([s])=>[s,l.filter(t=>(t.status||'planned')===s).length]))}};
  const buckets=[];
  if(P.unit==='day')days.forEach(d=>{const k=ymd(d);const busy=new Set(work.filter(t=>t.date===k).flatMap(t=>t.staffIds||[]));
    buckets.push(Object.assign({from:k,to:k,lbl:String(d.getDate()),sub:TH_DAY[d.getDay()],we:isOffDay(d),td:k===today,name:fmtDay(k)+(holidayOf(k)?' · '+holidayOf(k):''),
      free:active.filter(s=>!busy.has(s.id)).length,lv:new Set(leaves.filter(t=>t.date===k).flatMap(t=>t.staffIds||[])).size},mk(k,k)))});
  else if(P.unit==='week')for(let w=mondayOf(parseD(from));ymd(w)<=to;w=addDays(w,7)){const a=ymd(w)<from?from:ymd(w),b=ymd(addDays(w,6))>to?to:ymd(addDays(w,6));
    buckets.push(Object.assign({from:a,to:b,lbl:String(parseD(a).getDate()),sub:TH_MON[parseD(a).getMonth()],td:today>=a&&today<=b,name:`สัปดาห์ ${weekName(w)}`},mk(a,b)))}
  else for(let i=0;i<12;i++){const s=new Date(parseD(from).getFullYear(),i,1);const a=ymd(s),b=ymd(new Date(s.getFullYear(),i+1,0));
    buckets.push(Object.assign({from:a,to:b,lbl:TH_MON[i],sub:'',td:today>=a&&today<=b,name:`${TH_MON_FULL[i]} ${be(s)}`},mk(a,b)))}

  /* the same buckets in the period before (the trend chart's comparison line); null while that period loads */
  const prevVals=prevJobs?dashRanges(P.pFrom,P.pTo,P.unit).map(r=>prevJobs.filter(t=>t.date>=r.a&&t.date<=r.b).length):null;
  /* every day of the period for the calendar heatmap: plans (open tab), onsite works (every line), people free / on leave */
  const byDay=new Map();raw.forEach(t=>{if(!inR(t))return;if(!byDay.has(t.date))byDay.set(t.date,[]);byDay.get(t.date).push(t)});
  const calDays=days.map(d=>{const k=ymd(d);const l=byDay.get(k)||[];const busy=new Set(l.filter(holdsTeam).flatMap(t=>t.staffIds||[]));
    return {k,d,n:l.filter(t=>!isLeave(t)&&holdsTeam(t)&&lineMatch(t)).length,ons:l.filter(utoOnsite).length,free:active.filter(s=>!busy.has(s.id)).length,
      lv:new Set(l.filter(t=>isLeave(t)&&isWorking(t)).flatMap(t=>t.staffIds||[])).size,off:!isUtoDay(d),hol:holidayOf(k)||'',today:k===today}});
  /* the period before, counted the same way, for the ranking ticks */
  const cntBy=(l,f)=>{const m=new Map();l.forEach(t=>[].concat(f(t)).forEach(k=>{if(k!=null&&k!=='')m.set(k,(m.get(k)||0)+1)}));return m};
  const prevBy=prevJobs?{cust:cntBy(prevJobs,custKeyOf),type:cntBy(prevJobs,t=>knownIds.has(typeIdOf(t))?typeIdOf(t):'__x'),
    sale:cntBy(prevJobs,t=>String(t.sale||'').trim()||'(ไม่ระบุ Sale)'),veh:cntBy(prevJobs,t=>deptCars(t))}:null;
  /* plans by team for the donut: one part each (On-Site only · Lab only · both · nobody of a team yet) */
  const teamMix={onsite:0,lab:0,both:0,none:0};jobs.forEach(t=>{const ids=t.staffIds||[];const on=ids.some(id=>inT(id,'onsite')),lb=ids.some(id=>inT(id,'lab'));teamMix[on&&lb?'both':on?'onsite':lb?'lab':'none']++});

  /* person × week (month) or person × month (quarter, year) */
  let heat=null;
  if(P.mode!=='week'){
    const cols=[];
    if(P.mode==='month')for(let w=mondayOf(parseD(from));ymd(w)<=to;w=addDays(w,7))cols.push({name:weekName(w),from:ymd(w)<from?from:ymd(w),to:ymd(addDays(w,6))>to?to:ymd(addDays(w,6))});
    else for(let d=parseD(from);ymd(d)<=to;d=new Date(d.getFullYear(),d.getMonth()+1,1))cols.push({name:TH_MON[d.getMonth()],from:ymd(d),to:ymd(new Date(d.getFullYear(),d.getMonth()+1,0))});
    heat={by:P.mode==='month'?'สัปดาห์':'เดือน',cols,rows:people.map(p=>({p,v:cols.map(c=>jobs.filter(t=>t.date>=c.from&&t.date<=c.to&&(t.staffIds||[]).includes(p.s.id)).length)}))};
  }

  /* Master Plan sheets set against the Weekly Plan (js/views/dash-master.js); null while they load */
  const mp=dashMp(P,buckets,calR);const MPK=dashMpKpis(mp,S.line);

  /* KPIs and key findings in plain text, shared by the page, print and Excel */
  /* NCR of plans that ended ไม่เสร็จ in this period */
  const ncrIn=S.ncr.filter(n=>n.date>=from&&n.date<=to).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const ncrOpen=ncrIn.filter(n=>n.state!=='closed').length;const ncrLate=ncrIn.filter(ncrOverdue).length;
  const chg=(cur,prv)=>cur===prv?`เท่ากับ${P.pLabel}`:prv?`${cur>prv?'เพิ่มขึ้น':'ลดลง'} ${Math.abs(cur-prv)} แผน (${Math.abs(Math.round((cur-prv)/prv*100))}%) จาก${P.pLabel}`:`${P.pLabel}ไม่มีแผนงาน`;
  const kpis=[
    {name:'งานทั้งหมด (Total Jobs)',value:`${totalJ} แผน`,note:prevJobs?chg(totalJ,prevJobs.length):''},
    {name:'อัตราปิดงาน (Completion Rate)',value:doneRate==null?'–':`${doneRate}%`,note:due.length?`ปิดแล้ว ${doneDue} จาก ${due.length} แผนที่ถึงกำหนด${prevDoneRate!=null?` · ${P.pLabel} ${prevDoneRate}%`:''}`:'ยังไม่มีแผนที่ถึงกำหนด'},
    {name:'อัตราใช้กำลังคนหน้างาน (Utilization Onsite)',value:`${util}%`,note:utoNote(U)},
    {name:'คน-วันทำงาน (Man-days)',value:`${f1(manDays)} คน-วัน`,note:`ทุกวันรวมเสาร์–อาทิตย์${weDays?` (เสาร์–อาทิตย์ ${f1(weDays)} คน-วัน)`:''} · ทีมเฉลี่ย ${f1(avgTeam)} คนต่องาน${otDays?` · OT วันหยุดนักขัตฤกษ์ ${f1(otDays)} คน-วัน`:''}`},
    {name:'กำลังคนที่มีงาน (Active Manpower)',value:`${busyN} / ${active.length} คน`,note:`ว่างทั้งช่วง ${Math.max(0,active.length-busyN)} คน · ลา ${leaveDays} คน-วัน`},
    {name:'อัตราเลื่อน / ยกเลิก (Postpone & Cancel)',value:`${pcRate}%`,note:`เลื่อน ${stc.postponed} · ยกเลิก ${stc.cancelled} จาก ${allJ} แผน`},
    {name:'ประเด็นต้องติดตาม (Open Issues)',value:`${confN+lateN+gaN+docN} รายการ`,note:`จัดชน ${confN} · เลยวันยังไม่ปิด ${lateN} · รอ GA ระบุรถ ${gaN} · เอกสารไม่ครบ ${docN}`},
    {name:'งานไม่เสร็จ (NCR)',value:`${stc.notdone||0} แผน`,note:`${contN?`งานต่อเนื่อง ${contN} แผน (ไม่เปิด NCR) · `:''}NCR ในช่วงนี้ ${ncrIn.length} รายการ · ยังไม่ปิด ${ncrOpen}${ncrLate?` · เกินกำหนด ${ncrLate}`:''}`},
    ...lineRows.map(r=>({name:`สายงาน ${r.l.name}`,value:`${r.n} แผน`,note:`เสร็จ ${r.done}${r.doneRate!=null?` · ปิดงาน ${r.doneRate}% ของที่ถึงกำหนด`:''} · ${f1(r.md)} คน-วัน · ลูกค้า ${r.cust} ราย`})),
    ...(ins.n?[{name:'Instrument (Plan / Actual)',value:`${ins.actual} / ${ins.plan}`,note:`${ins.n} รายการ · Completed ${ins.done}${insRate!=null?` · Actual ${insRate}% ของ Plan`:''}${ins.certs?` · Certificate ${ins.certs}`:''}`}]:[]),
    ...MPK.kpis,
    ...(cal.n?[{name:'สอบเทียบ Flow Meter (เครื่อง)',value:`${cal.n} เครื่อง`,note:`PASS ${cal.pass} · FAIL ${cal.fail}${passRate!=null?` (ผ่าน ${passRate}%)`:''} · รอผล ${cal.pending} · เลื่อน ${cal.postponed} · ยกเลิก ${cal.cancelled} · Problem ${cal.problem}`}]:[]),
  ];
  const findings=[];
  findings.push({t:'',s:`มีแผนงานทั้งหมด ${totalJ} แผน${prevJobs?` ${chg(totalJ,prevJobs.length)}`:''} ใช้ทีมเฉลี่ย ${f1(avgTeam)} คนต่องาน`});
  if(due.length)findings.push({t:doneRate>=90?'good':doneRate<70?'warn':'',s:`ปิดงานแล้ว ${doneDue} จาก ${due.length} แผนที่ถึงกำหนด (${doneRate}%)${lateN?` ยังไม่ปิด ${lateN} แผน`:''}`});
  if(U.std)findings.push({t:utoLevel(U),s:`ใช้กำลังคนหน้างาน ${util}% (${U.total} งาน จาก Std. ${U.std} งาน) ${utoSay(U)}${U.ot?` · มีงานวันหยุดนักขัตฤกษ์ (OT) อีก ${U.ot} งาน`:''}`});
  if(types[0])findings.push({t:'',s:`งานหลักคือ ${types[0].label} ${types[0].n} แผน (${pct(types[0].n,totalJ)}%)${types[1]?` รองลงมาคือ ${types[1].label} ${types[1].n} แผน`:''}`});
  if(custList[0])findings.push({t:'',s:`ลูกค้าที่มีงานมากที่สุดคือ ${custList[0][0]} ${custList[0][1]} แผน (${pct(custList[0][1],totalJ)}%) จากลูกค้าทั้งหมด ${cust.size} ราย`});
  const topP=people.find(p=>p.jobs);if(topP)findings.push({t:'',s:`พนักงานที่มีงานมากที่สุดคือ ${topP.s.name} ${topP.jobs} แผน (${f1(topP.wd)} คน-วัน)`});
  if(stc.notdone||ncrIn.length)findings.push({t:ncrOpen?'bad':'warn',s:`งานไม่เสร็จ ${stc.notdone||0} แผน${ndSplit} · NCR ${ncrIn.length} รายการ (ยังไม่ปิด ${ncrOpen}${ncrLate?` · เกินกำหนด ${ncrLate}`:''}) ดูรายละเอียดที่หน้า NCR`});
  if(pcN)findings.push({t:'warn',s:`เลื่อน ${stc.postponed} แผน และยกเลิก ${stc.cancelled} แผน (${pcRate}% ของแผนทั้งหมด) ดูเหตุผลในหัวข้อ 7`});
  if(!S.line&&lineRows.some(r=>r.n))findings.push({t:noLineN?'warn':'',s:`แยกตามสายงาน: ${lineRows.map(r=>`${r.l.name} ${r.n} แผน (${r.share}%)`).join(' · ')}${noLineN?` · ยังไม่ระบุสาย ${noLineN} แผน`:''}`});
  if(cal.n)findings.push({t:cal.fail||cal.problem?'warn':'',s:`สอบเทียบ Flow Meter ${cal.n} เครื่อง มีผลแล้ว ${cal.done} เครื่อง${judged?` · PASS ${cal.pass} · FAIL ${cal.fail} (ผ่าน ${passRate}%)`:''}${cal.problem?` · Problem ${cal.problem}`:''}${cal.postponed?` · เลื่อน ${cal.postponed}`:''}${calTypes[0]?` · ชนิดที่มากที่สุดคือ ${calTypes[0][0]} ${calTypes[0][1]} เครื่อง`:''}`});
  if(ins.n)findings.push({t:insRate!=null&&insRate<80?'warn':'',s:`Instrument ${ins.n} รายการ · Plan ${ins.plan} · Actual ${ins.actual}${insRate!=null?` (${insRate}%)`:''} · Completed ${ins.done}${ins.certs?` · ออก Certificate ${ins.certs} ใบ`:''}${insTypes[0]?` · Type ที่มากที่สุดคือ ${insTypes[0][0]}`:''}`});
  findings.push(...MPK.findings);
  const issues=[confN&&`จัดชน ${confN} แผน`,lateN&&`เลยวันแล้วยังไม่ปิด ${lateN} แผน`,gaN&&`รอ GA ระบุรถ ${gaN} แผน`,docN&&`งานเสร็จแต่เอกสารหลังจบงานไม่ครบ ${docN} แผน`].filter(Boolean);
  /* ติดตามเอกสาร Onsite of the period (js/features/onsite-docs.js): every onsite plan, whatever the สายงาน / ทีม tab */
  const od=typeof odSummary==='function'?odSummary((raw||[]).filter(inR)):null;
  if(od&&od.n)findings.push({t:od.follow?'bad':od.late?'warn':'good',s:`เอกสาร Onsite ${od.n} งาน · ในเวลา ${od.ok} · เกินเวลา ${od.late} · รอเอกสาร ${od.wait} · ตามต่อ ${od.follow}${od.rate!=null?` · ส่งทันเวลา ${od.rate}%`:''}`});
  findings.push(issues.length?{t:'bad',s:`ประเด็นที่ต้องดำเนินการ: ${issues.join(' · ')}`}:{t:'good',s:'ไม่มีประเด็นค้างที่ต้องดำเนินการ'});

  return {P,today,all,work,jobs,leaves,days,workDays,active,conf,stc,allJ,totalJ,due,doneDue,doneRate,pcN,pcRate,confN,lateN,gaN,docN,ncrIn,ncrOpen,ncrLate,
    people,manDays,weDays,otDays,teamUse,U,util,busyN,leaveDays,avgTeam,prevJobs,prevDoneRate,roleRows,types,cust,custList,vehList,noCar,saleList,
    pairs,follow,buckets,prevVals,calDays,prevBy,teamMix,heat,kpis,findings,custKeyOf,lineRows,noLineN,teamRows,noTeamN,calR,cal,passRate,calTypes,calLabs,calSizes,calCust,calFluids,calRounds,insR,ins,insRate,insTypes,insLabs,insPlants,insCust,mp,od};
}

/* the page itself (tabs, charts) is in js/views/dash-page.js — v4.27.0 */

/* ---------- report tables shared by the A4 print and the Excel file ---------- */
function dashRows(D){
  const P=D.P;const unitName=P.unit==='day'?'วัน':P.unit==='week'?'สัปดาห์':'เดือน';
  const followWhy=t=>NEEDS_REASON.has(t.status)?(t.statusNote||'ยังไม่ได้ใส่เหตุผล'):isLate(t)?`ยังเป็น "${stTh(t.status)}" ควรอัปเดตสถานะ`:gaWaiting(t)?'รอ GA ระบุรถและทะเบียน':`ยังไม่ได้ส่ง ${docMissing(t).map(k=>DOC_NAME[k]).join(', ')}`;
  const followStat=t=>NEEDS_REASON.has(t.status)?stTh(t.status):isLate(t)?'เลยวันแล้ว':gaWaiting(t)?'รอรถ GA':'เอกสารไม่ครบ';
  const planTxt=t=>[typeLabel(t),t.planNo,t.customer].filter(Boolean).join(' · ');
  const grp=x=>[x.k,x.n,x.jobs,Math.round(x.md*10)/10,x.util];
  const UY=utoYearData();/* Utilization Manpower Onsite of the year (null while it loads) */
  return {...dashMpRows(D),...(UY?{uto:utoRows(UY)}:{}),
    kpi:{sheet:'KPI',title:'ตัวชี้วัดหลัก (KPI)',head:['ตัวชี้วัด','ค่า','รายละเอียด'],rows:D.kpis.map(k=>[k.name,k.value,k.note])},
    trend:{sheet:'แนวโน้ม',title:`แนวโน้มงานราย${unitName}`,head:[unitName,'รวม (แผน)','เสร็จแล้ว','ไม่เสร็จ','วางแผน','เลื่อน'],num:[1,2,3,4,5],rows:D.buckets.map(b=>[b.name,b.n,b.c.done,b.c.notdone,b.c.planned,b.c.postponed])},
    status:{sheet:'สถานะ',title:'สถานะงาน',head:['สถานะ','แผน','%'],num:[1,2],rows:STATUSES.map(s=>[s.th,D.stc[s.id],pct(D.stc[s.id],D.allJ)])},
    role:{sheet:'ตำแหน่ง',title:'ภาระงานตามตำแหน่ง',head:['ตำแหน่ง','คน','แผน','คน-วัน','ใช้กำลังคน (%)'],num:[1,2,3,4],rows:D.roleRows.map(grp)},
    person:{sheet:'รายคน',title:'รายละเอียดรายคน',head:['#','ชื่อ','ตำแหน่ง','งาน (แผน)','คน-วัน','ในนั้น เสาร์–อาทิตย์','OT วันหยุดนักขัตฤกษ์','ใช้กำลังคน (%)','เช้า','บ่าย','ทั้งวัน','ลา (วัน)','ว่าง (วัน)','จัดชน','งานที่ทำมากสุด'],num:[0,3,4,5,6,7,8,9,10,11,12,13],
      rows:D.people.map((p,i)=>[i+1,p.s.name,p.s.role||'',p.jobs,Math.round(p.wd*10)/10,Math.round(p.we*10)/10,Math.round(p.ot*10)/10,pct(p.wd,p.cap),p.am,p.pm,p.full,p.leave.size,p.free,p.conf,p.top||''])},
    types:{sheet:'หัวข้องาน',title:'งานตามหัวข้องาน',head:['หัวข้องาน','แผน','%'],num:[1,2],rows:D.types.map(x=>[x.label,x.n,pct(x.n,D.totalJ)])},
    cust:{sheet:'ลูกค้า',title:'งานตามลูกค้า',head:['ลูกค้า','แผน','%'],num:[1,2],rows:D.custList.map(([k,n])=>[k,n,pct(n,D.totalJ)])},
    veh:{sheet:'รถ',title:'การใช้รถ',head:['รถ','แผน','วันที่ใช้'],num:[1,2],rows:D.vehList.map(x=>[x.label,x.n,x.days])},
    sale:{sheet:'Sale',title:'งานตาม Sale',head:['Sale','แผน','%'],num:[1,2],rows:D.saleList.map(([k,n])=>[k,n,pct(n,D.totalJ)])},
    conf:{sheet:'จัดชน',title:'แผนงานที่จัดชน',head:['วันที่','แผนงาน','ชนกับแผนงาน','สาเหตุ'],rows:D.pairs.map(p=>[fmtDay(p.a.date),`${pName(p.a)} · ${planTxt(p.a)}`,`${pName(p.b)} · ${planTxt(p.b)}`,
      [p.staff.length?`${p.leave?'ติดลา':'คนชน'}: ${p.staff.map(staffName).join(', ')}`:'',p.veh?`รถที่ใช้งานซ้ำกัน: ${p.veh}`:''].filter(Boolean).join(' · ')])},
    ncr:{sheet:'NCR',title:'NCR · งานไม่สำเร็จ',head:['NCR No.','วันที่','งาน','Plan No.','ลูกค้า','หมวดปัญหา','ปัญหา','สาเหตุ','การแก้ไข / ป้องกัน','ผู้รับผิดชอบ','กำหนดเสร็จ','สถานะ'],
      rows:D.ncrIn.map(n=>[n.ncrNo||'',n.date?fmtDay(n.date):'',n.jobTypeName||'',n.planNo||'',n.customer||'',n.category||'',n.issue||'',n.cause||'',[n.correction,n.action].filter(Boolean).join(' / '),n.owner||'',n.due?thDate(n.due):'',ncrStateOf(n).th+(ncrOverdue(n)?' (เกินกำหนด)':'')])},
    follow:{sheet:'ติดตาม',title:'งานที่ต้องติดตาม',head:['วันที่','หัวข้องาน','Plan No.','ลูกค้า','สถานะ','เหตุผล / สิ่งที่ต้องทำ','ทีม'],rows:D.follow.map(t=>[fmtDay(t.date),typeLabel(t),t.planNo||'',t.customer||'',followStat(t),followWhy(t),teamNames(t).join(', ')])},
    lines:{sheet:'สายงาน',title:'แยกตามสายงาน',head:['สายงาน','แผน','%','เสร็จ','ปิดงาน (%)','คน-วัน','ลูกค้า (ราย)'],num:[1,2,3,4,5,6],
      rows:D.lineRows.map(r=>[r.l.name,r.n,r.share,r.done,r.doneRate==null?'–':r.doneRate,Math.round(r.md*10)/10,r.cust]).concat(D.noLineN?[['ยังไม่ระบุสาย',D.noLineN,pct(D.noLineN,D.totalJ),'','','','']]:[])},
    teams:{sheet:'ทีม',title:'แยกตามทีม',head:['ทีม','แผน','%','เสร็จ','ปิดงาน (%)','คน-วัน','คน'],num:[1,2,3,4,5,6],
      rows:D.teamRows.map(r=>[r.tm.name,r.n,r.share,r.done,r.doneRate==null?'–':r.doneRate,Math.round(r.md*10)/10,r.people]).concat(D.noTeamN?[['ยังไม่มีคนของทีมใด',D.noTeamN,pct(D.noTeamN,D.totalJ),'','','','']]:[])},
    cal:{sheet:'Weekly plan calibration',title:'Weekly plan calibration (Flow Meter)',head:CAL_HEAD,num:[1],rows:D.calR.map(calRowCells)},
    ins:{sheet:'Weekly plan instrument',title:'Weekly plan instrument (Instrument)',head:INS_HEAD,num:[14,15],rows:D.insR.map(insRowCells)},
    insCert:{sheet:'Certificates',title:'Certificates (Instrument)',head:INS_CERT_HEAD,num:[1],rows:D.insR.flatMap(insCertCells)},
    plans:{sheet:'แผนงานทั้งหมด',title:'แผนงานทั้งหมดในช่วงนี้',head:['วันที่','สายงาน','หัวข้องาน','Plan No.','Sale','Customer','Location','ช่วงเวลา','Team Service','Transport','สถานะ'],
      rows:D.all.slice().sort(byTime).map(t=>[t.date,LINE[lineOf(t)]?LINE[lineOf(t)].name:'',typeLabel(t),t.planNo||'',t.sale||'',t.customer||'',t.location||'',pName(t),teamNames(t).join(', '),transportText(t),statusText(t)])},
  };
}
const dashFile=P=>`BU1-Report_${P.mode}_${P.from}_${P.to}`;
async function dashPrint(){
  const D=dashCompute();if(D.loading){toast('กำลังโหลดข้อมูล ลองอีกครั้งในอีกสักครู่');return}
  const P=D.P;const T=dashRows(D);const now=new Date();
  const tbl=t=>`<h3>${esc(t.title)}</h3>${t.rows.length?`<table class="t"><thead><tr>${t.head.map((x,i)=>`<th${(t.num||[]).includes(i)?' class="n"':''}>${esc(x)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map((v,i)=>`<td${(t.num||[]).includes(i)?' class="n"':''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p class="e">ไม่มีข้อมูลในช่วงนี้</p>'}`;
  const sec=(n,th,en)=>`<h2><span>${n}</span>${th} <small>${en}</small></h2>`;
  /* section 8 (user, 8 Oct 2026: "ให้โชว์แผนด้วย"): every plan of the period, columns that fit A4 portrait (Excel keeps the full sheet) */
  const planList={title:`แผนงานทั้งหมด ${D.all.length} แผน`,head:['วันที่','ช่วง','งาน / Plan No.','ลูกค้า · สถานที่','Team Service','รถ','สถานะ'],
    rows:D.all.slice().sort(byTime).map(t=>[`${TH_DAY[parseD(t.date).getDay()]} ${fmtShort(parseD(t.date))}`,pName(t),[typeLabel(t),t.planNo].filter(Boolean).join(' · '),[t.customer,t.location].filter(Boolean).join(' · '),teamNames(t).join(', '),transportText(t),statusText(t)])};
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>รายงานผลการปฏิบัติงาน ${esc(P.label)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap">
<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10.5px/1.5 "IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif;color:#0b1b33;margin:16px;max-width:190mm}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:12px;padding:10px 12px;background:#eef3fa;border-radius:8px;font-size:13px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2.5px solid #1462d0;padding-bottom:8px;margin-bottom:12px}.hd .org{margin:0;color:#1462d0;font-weight:600;font-size:10px;letter-spacing:.06em;text-transform:uppercase}.hd h1{font-size:19px;margin:2px 0 0}.hd>div{min-width:0}.hd>p{flex:none;white-space:nowrap}.hd p{margin:0;color:#34496b;text-align:right}
h2{display:flex;align-items:center;gap:8px;font-size:14px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #c6d9f1;break-after:avoid}h2 span{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:5px;background:#1462d0;color:#fff;font-size:11px}h2 small{font-weight:400;color:#62738f;font-size:11px}
h3{font-size:11.5px;margin:10px 0 4px;break-after:avoid}
.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.kpi div{border:1px solid #c6d9f1;border-radius:6px;padding:6px 8px;break-inside:avoid}.kpi b{display:block;font-size:16px;color:#0a2150}.kpi span{display:block;font-size:9.5px;color:#34496b}.kpi em{display:block;font-style:normal;font-size:9px;color:#62738f;margin-top:2px}
ul.f{margin:8px 0 0;padding-left:18px}ul.f li{margin:2px 0}ul.f li.bad{color:#b42323;font-weight:600}ul.f li.warn{color:#875800}ul.f li.good{color:#006300}
.t{border-collapse:collapse;width:100%;margin-bottom:4px}.t th,.t td{border:1px solid #c6d9f1;padding:3px 5px;text-align:left;vertical-align:top;font-size:9.5px;overflow-wrap:anywhere}.t thead th{background:#e6f1fd;font-weight:600}.t .n{text-align:right;white-space:nowrap}.t tr{break-inside:avoid}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}.e{color:#62738f;margin:2px 0 6px}
.sig{display:flex;gap:30px;margin-top:34px;break-inside:avoid}.sig div{flex:1;text-align:center}.sig span{display:block;border-top:1px solid #0b1b33;margin:34px 10px 4px}
@media print{.bar{display:none}body{margin:0;max-width:none}}${isoPageCss('dash')}${DZ_PRINT_CSS}</style></head><body>
<div class="bar">${printBackHtml()}<button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>ตั้งค่า: กระดาษ A4 · แนวตั้ง (Portrait) · ติ๊ก Background graphics</span></div>
<div class="hd"><div style="display:flex;gap:10px;align-items:center">${orgLogo(44)}<div><p class="org">${esc(DASH_ORG)}</p><h1>รายงานผลการปฏิบัติงาน${scopeName()?' · '+esc(scopeName()):''} · ${esc(P.label)}</h1></div></div>
<p>ช่วงข้อมูล ${esc(thDate(P.from))} – ${esc(thDate(P.to))}<br>จัดทำเมื่อ ${esc(thDate(ymd(now)))} ${pad(now.getHours())}:${pad(now.getMinutes())} น.${S.account&&S.account.name?`<br>ผู้จัดทำ ${esc(S.account.name)}`:''}</p></div>${isoHeadHtml('dash')}
${sec(1,'สรุปภาพรวม','Summary')}
<div class="kpi">${D.kpis.map(k=>`<div><span>${esc(k.name)}</span><b>${esc(k.value)}</b><em>${esc(k.note)}</em></div>`).join('')}</div>${dzPrintCharts(D)}
<ul class="f">${D.findings.map(f=>`<li class="${f.t}">${esc(f.s)}</li>`).join('')}</ul>
${!S.line?tbl(T.lines):''}${!S.team&&teamsUsed()?tbl(T.teams):''}${D.calR.length?tbl(Object.assign({},T.cal,{head:T.cal.head.filter((x,i)=>i!==CAL_HEAD.length-1),rows:T.cal.rows.map(r=>r.filter((x,i)=>i!==CAL_HEAD.length-1))})):''}${D.insR.length?tbl(Object.assign({},T.ins,{head:T.ins.head.filter((x,i)=>![7,13].includes(i)),num:[12,13],rows:T.ins.rows.map(r=>r.filter((x,i)=>![7,13].includes(i)))})):''}
${D.mp?`${sec(2,'แผนเทียบผล · Master Plan','Plan vs Actual')}${tbl(Object.assign({},T.mpTrend,S.line==='fm'?{head:T.mpTrend.head.slice(0,4),num:[1,2,3],rows:T.mpTrend.rows.map(r=>r.slice(0,4))}:S.line==='ins'?{head:[T.mpTrend.head[0],T.mpTrend.head[4]],num:[1],rows:T.mpTrend.rows.map(r=>[r[0],r[4]])}:{}))}<div class="two">${S.line!=='ins'?`<div>${tbl(T.mpCodes)}</div>`:''}${S.line!=='fm'?`<div>${tbl(Object.assign({},T.mpInsLab,{rows:T.mpInsLab.rows.slice(0,25)}))}</div>`:''}</div>`:''}
${sec(3,'ผลการดำเนินงาน','Performance')}<div class="two"><div>${tbl(T.trend)}</div><div>${tbl(T.status)}</div></div>
${sec(4,'กำลังคน','Manpower')}${T.uto?tbl(T.uto):''}${tbl(T.role)}${tbl(Object.assign({},T.person,{head:T.person.head.slice(0,14),rows:T.person.rows.map(r=>r.slice(0,14))}))}
${sec(5,'ลูกค้าและประเภทงาน','Customers & Job Types')}<div class="two"><div>${tbl(T.types)}</div><div>${tbl(Object.assign({},T.cust,{title:T.cust.rows.length>15?'งานตามลูกค้า (15 อันดับแรก)':T.cust.title,rows:T.cust.rows.slice(0,15)}))}</div></div>
${sec(6,'ทรัพยากรและผู้ประสานงาน','Resources & Sales')}<div class="two"><div>${tbl(T.veh)}</div><div>${tbl(T.sale)}</div></div>
${sec(7,'ประเด็นที่ต้องติดตาม','Issues & Follow-up')}${tbl(Object.assign({},T.ncr,{head:T.ncr.head.filter((x,i)=>![2,7,8].includes(i)),rows:T.ncr.rows.map(r=>r.filter((x,i)=>![2,7,8].includes(i)))}))}${tbl(T.conf)}${tbl(T.follow)}
${sec(8,'แผนงานในช่วงนี้','Plans')}${tbl(planList)}
<div class="sig"><div><span></span>ผู้จัดทำ</div><div><span></span>หัวหน้า Lab / ผู้ตรวจสอบ</div><div><span></span>ผู้อนุมัติ</div></div></body></html>`;
  await saveFile(dashFile(P)+'.html',html,'ดาวน์โหลดแล้ว เปิดไฟล์แล้วกด "พิมพ์ / บันทึกเป็น PDF" เลือก A4 แนวตั้ง');
}
async function dashXlsx(btn){
  const D=dashCompute();if(D.loading){toast('กำลังโหลดข้อมูล ลองอีกครั้งในอีกสักครู่');return}
  btn.disabled=true;const old=btn.textContent;btn.textContent='กำลังสร้างไฟล์…';
  try{
    const X=await loadXLSX();const wb=X.utils.book_new();const P=D.P;const T=dashRows(D);const now=new Date();
    const title=[`${DASH_ORG} · รายงานผลการปฏิบัติงาน ${P.label} (${thDate(P.from)} – ${thDate(P.to)})`];
    const stamp=[`จัดทำเมื่อ ${thDate(ymd(now))} ${pad(now.getHours())}:${pad(now.getMinutes())} น.`];
    const widths=aoa=>{const w=[];aoa.forEach(r=>r.forEach((v,i)=>{w[i]=Math.max(w[i]||8,Math.min(50,String(v==null?'':v).length+2))}));return w.map(wch=>({wch}))};
    const add=(name,head,body)=>{const ws=X.utils.aoa_to_sheet([title,stamp,isoXlsxRow('dash'),...head,...body]);ws['!cols']=widths([...head,...body]);X.utils.book_append_sheet(wb,ws,name)};
    add('สรุป',[[T.kpi.title],T.kpi.head],[...T.kpi.rows,[],['ประเด็นสำคัญ'],...D.findings.map(f=>['• '+f.s])]);
    for(const k of [...(T.uto?['uto']:[]),'lines','teams','cal','ins','insCert',...(D.mp?['mpTrend','mpCodes','mpFm','mpIns','mpInsLab']:[]),'trend','status','role','person','types','cust','veh','sale','ncr','conf','follow','plans']){const t=T[k];add(t.sheet,[[t.title],t.head],t.rows.length?t.rows:[['ไม่มีข้อมูลในช่วงนี้']])}
    await saveFile(dashFile(P)+'.xlsx',X.write(wb,{type:'array',bookType:'xlsx'}));
  }catch(e){toast('สร้างไฟล์ Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่')}
  finally{btn.disabled=false;btn.textContent=old}
}
