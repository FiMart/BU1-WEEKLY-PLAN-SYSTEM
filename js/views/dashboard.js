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
function dashStep(dir){const st={month:1,quarter:3,year:12}[S.dash.mode]||1;setMonth(dir?new Date(S.month.getFullYear(),S.month.getMonth()+dir*st,1):new Date())}

/* every figure the report shows, computed once and shared by the page, the A4 print and the Excel file */
function dashCompute(){
  const P=dashPeriod();const {from,to}=P;
  /* the open สายงาน tab (lineMatch): its plans, plans without a line, and leave */
  const lt=l=>l&&l.filter(lineMatch);
  const tasks=lt(P.mode==='week'?S.tasks:rangeTasks(from,to));const prev=lt(rangeTasks(P.pFrom,P.pTo));
  if(!tasks)return {P,loading:true};
  const today=ymd(new Date());const inR=t=>t.date>=from&&t.date<=to;
  const all=tasks.filter(inR);const work=all.filter(isWorking);const jobs=work.filter(t=>!isLeave(t));const leaves=work.filter(isLeave);
  const days=[];for(let d=parseD(from);ymd(d)<=to;d=addDays(d,1))days.push(new Date(d));
  const workDays=days.filter(isWorkDay);/* Monday–Saturday, minus public holidays */
  const active=S.staff.filter(s=>s.active!==false);const conf=conflictsIn(work);
  const stc=Object.fromEntries(STATUSES.map(s=>[s.id,0]));all.filter(t=>!isLeave(t)).forEach(t=>{const k=t.status||'planned';stc[k]=(stc[k]||0)+1});
  const allJ=Object.values(stc).reduce((a,n)=>a+n,0);const totalJ=jobs.length;
  const due=jobs.filter(t=>t.date<=today);const doneDue=due.filter(t=>t.status==='done').length;const doneRate=due.length?pct(doneDue,due.length):null;
  const pcN=stc.postponed+stc.cancelled;const pcRate=pct(pcN,allJ);
  const confN=work.filter(t=>conf.has(t.id)).length;const lateN=jobs.filter(isLate).length;const gaN=work.filter(t=>gaWaiting(t)).length;

  /* people */
  const pst=new Map();
  const ps=id=>{if(!pst.has(id))pst.set(id,{jobs:0,am:0,pm:0,full:0,days:new Map(),dates:new Set(),leave:new Set(),conf:0,types:new Map()});return pst.get(id)};
  jobs.forEach(t=>{const per=periodOf(t);const PR=PERIOD[per];(t.staffIds||[]).forEach(id=>{const p=ps(id);p.jobs++;p[per]++;
    const sl=p.days.get(t.date)||{am:false,pm:false};sl.am=sl.am||PR.a===0;sl.pm=sl.pm||PR.b===1;p.days.set(t.date,sl);p.dates.add(t.date);
    const k=typeLabel(t);p.types.set(k,(p.types.get(k)||0)+1);if((conf.get(t.id)||[]).some(c=>c.staff.includes(id)))p.conf++})});
  leaves.forEach(t=>(t.staffIds||[]).forEach(id=>{const p=ps(id);p.leave.add(t.date);p.dates.add(t.date)}));
  const people=S.staff.filter(s=>s.active!==false||pst.has(s.id)).map(s=>{const p=ps(s.id);const wd=[...p.days.values()].reduce((a,x)=>a+(x.am&&x.pm?1:.5),0);
    const top=[...p.types].sort((a,b)=>b[1]-a[1])[0];return Object.assign({s,wd,free:workDays.filter(d=>!p.dates.has(ymd(d))).length,top:top?`${top[0]} (${top[1]})`:''},p)})
    .sort((a,b)=>b.jobs-a.jobs||b.wd-a.wd||sortPeople(a.s,b.s));
  const manDays=people.reduce((a,p)=>a+p.wd,0);const capDays=active.length*workDays.length;const util=pct(manDays,capDays);
  const busyN=people.filter(p=>p.jobs>0).length;const leaveDays=people.reduce((a,p)=>a+p.leave.size,0);
  const avgTeam=totalJ?jobs.reduce((a,t)=>a+(t.staffIds||[]).length+(t.guests||[]).length,0)/totalJ:0;
  const prevJobs=prev?prev.filter(t=>t.date>=P.pFrom&&t.date<=P.pTo&&isWorking(t)&&!isLeave(t)):null;
  const prevDoneRate=prevJobs&&prevJobs.length?pct(prevJobs.filter(t=>t.status==='done').length,prevJobs.length):null;

  /* roles: capacity = people × working days (Mon–Sat) */
  const groupRows=keyOf=>{const m=new Map();active.forEach(s=>{const k=keyOf(s);if(!m.has(k))m.set(k,{k,n:0,ids:new Set()});const x=m.get(k);x.n++;x.ids.add(s.id)});
    return [...m.values()].map(x=>{const md=people.filter(p=>x.ids.has(p.s.id)).reduce((a,p)=>a+p.wd,0);
      return Object.assign(x,{jobs:jobs.filter(t=>(t.staffIds||[]).some(id=>x.ids.has(id))).length,md,util:pct(md,x.n*workDays.length)})})};
  const order=positions();const roleRows=groupRows(roleOf)
    .sort((a,b)=>((order.indexOf(a.k)+1)||999)-((order.indexOf(b.k)+1)||999)||a.k.localeCompare(b.k,'th'));

  /* job types, customers, vehicles, sales */
  const types=jobTypes().filter(t=>t.id!=='leave').map(ty=>({label:ty.name,color:ty.color,n:jobs.filter(t=>typeIdOf(t)===ty.id).length,id:ty.id})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  const knownIds=new Set(jobTypes().map(t=>t.id));const orphanN=jobs.filter(t=>!knownIds.has(typeIdOf(t))).length;if(orphanN)types.push({label:'ประเภทที่ถูกลบแล้ว',n:orphanN});
  const custKeyOf=t=>String(t.customer||'').trim()||'(ไม่ระบุลูกค้า)';
  const cust=new Map();jobs.forEach(t=>{const k=custKeyOf(t);cust.set(k,(cust.get(k)||0)+1)});const custList=[...cust].sort((a,b)=>b[1]-a[1]);
  const veh=new Map();jobs.forEach(t=>{const v=String(t.transport||'').trim();if(!v||v==='ไม่ใช้รถ')return;if(!veh.has(v))veh.set(v,{n:0,d:new Set()});const x=veh.get(v);x.n++;x.d.add(t.date)});
  const vehList=[...veh].sort((a,b)=>b[1].n-a[1].n).map(([k,x])=>({label:k==='GA'?'รถ GA':k,n:x.n,days:x.d.size}));
  const noCar=jobs.filter(t=>!t.transport||t.transport==='ไม่ใช้รถ').length;
  const sale=new Map();jobs.forEach(t=>{const k=String(t.sale||'').trim()||'(ไม่ระบุ Sale)';sale.set(k,(sale.get(k)||0)+1)});const saleList=[...sale].sort((a,b)=>b[1]-a[1]);

  /* สายงาน: each line's plans, completion and man-days; and the Flow Meter calibration rows (Weekly plan calibration) */
  const lineRows=LINES.map(l=>{const lj=jobs.filter(t=>lineOf(t)===l.id);const ld=lj.filter(t=>t.date<=today);const ldone=ld.filter(t=>t.status==='done').length;
    return {l,n:lj.length,done:lj.filter(t=>t.status==='done').length,due:ld.length,doneRate:ld.length?pct(ldone,ld.length):null,
      md:lj.reduce((a,t)=>a+((t.staffIds||[]).length+(t.guests||[]).length)*(periodOf(t)==='full'?1:.5),0),cust:new Set(lj.map(custKeyOf)).size,
      share:pct(lj.length,totalJ)}});
  const noLineN=jobs.filter(t=>!lineOf(t)).length;
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
  const follow=all.filter(t=>!isLeave(t)&&(NEEDS_REASON.has(t.status)||isLate(t)||(isWorking(t)&&gaWaiting(t)))).sort(byTime);

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
    {name:'อัตราใช้กำลังคน (Utilization)',value:`${util}%`,note:`${f1(manDays)} จาก ${capDays} คน-วัน (${active.length} คน × ${workDays.length} วันทำงาน จ.–ส. ไม่รวมวันหยุด)`},
    {name:'คน-วันทำงาน (Man-days)',value:`${f1(manDays)} คน-วัน`,note:`ทีมเฉลี่ย ${f1(avgTeam)} คนต่องาน`},
    {name:'กำลังคนที่มีงาน (Active Manpower)',value:`${busyN} / ${active.length} คน`,note:`ว่างทั้งช่วง ${Math.max(0,active.length-busyN)} คน · ลา ${leaveDays} คน-วัน`},
    {name:'อัตราเลื่อน / ยกเลิก (Postpone & Cancel)',value:`${pcRate}%`,note:`เลื่อน ${stc.postponed} · ยกเลิก ${stc.cancelled} จาก ${allJ} แผน`},
    {name:'ประเด็นต้องติดตาม (Open Issues)',value:`${confN+lateN+gaN} รายการ`,note:`จัดชน ${confN} · เลยวันยังไม่ปิด ${lateN} · รอ GA ระบุรถ ${gaN}`},
    {name:'งานไม่เสร็จ (NCR)',value:`${stc.notdone||0} แผน`,note:`NCR ในช่วงนี้ ${ncrIn.length} รายการ · ยังไม่ปิด ${ncrOpen}${ncrLate?` · เกินกำหนด ${ncrLate}`:''}`},
    ...lineRows.map(r=>({name:`สายงาน ${r.l.name}`,value:`${r.n} แผน`,note:`เสร็จ ${r.done}${r.doneRate!=null?` · ปิดงาน ${r.doneRate}% ของที่ถึงกำหนด`:''} · ${f1(r.md)} คน-วัน · ลูกค้า ${r.cust} ราย`})),
    ...(ins.n?[{name:'Instrument (Plan / Actual)',value:`${ins.actual} / ${ins.plan}`,note:`${ins.n} รายการ · Completed ${ins.done}${insRate!=null?` · Actual ${insRate}% ของ Plan`:''}${ins.certs?` · Certificate ${ins.certs}`:''}`}]:[]),
    ...MPK.kpis,
    ...(cal.n?[{name:'สอบเทียบ Flow Meter (เครื่อง)',value:`${cal.n} เครื่อง`,note:`PASS ${cal.pass} · FAIL ${cal.fail}${passRate!=null?` (ผ่าน ${passRate}%)`:''} · รอผล ${cal.pending} · เลื่อน ${cal.postponed} · ยกเลิก ${cal.cancelled} · Problem ${cal.problem}`}]:[]),
  ];
  const findings=[];
  findings.push({t:'',s:`มีแผนงานทั้งหมด ${totalJ} แผน${prevJobs?` ${chg(totalJ,prevJobs.length)}`:''} ใช้ทีมเฉลี่ย ${f1(avgTeam)} คนต่องาน`});
  if(due.length)findings.push({t:doneRate>=90?'good':doneRate<70?'warn':'',s:`ปิดงานแล้ว ${doneDue} จาก ${due.length} แผนที่ถึงกำหนด (${doneRate}%)${lateN?` ยังไม่ปิด ${lateN} แผน`:''}`});
  findings.push({t:util>=90?'bad':util>=75?'warn':'',s:`ใช้กำลังคน ${util}% (${f1(manDays)} จาก ${capDays} คน-วัน) ${util>=90?'ภาระงานสูงมาก ควรเกลี่ยงานหรือเพิ่มกำลังคน':util>=75?'ภาระงานค่อนข้างสูง':util<40?'ยังมีกำลังคนว่างรองรับงานเพิ่มได้':'อยู่ในระดับปกติ'}`});
  if(types[0])findings.push({t:'',s:`งานหลักคือ ${types[0].label} ${types[0].n} แผน (${pct(types[0].n,totalJ)}%)${types[1]?` รองลงมาคือ ${types[1].label} ${types[1].n} แผน`:''}`});
  if(custList[0])findings.push({t:'',s:`ลูกค้าที่มีงานมากที่สุดคือ ${custList[0][0]} ${custList[0][1]} แผน (${pct(custList[0][1],totalJ)}%) จากลูกค้าทั้งหมด ${cust.size} ราย`});
  const topP=people.find(p=>p.jobs);if(topP)findings.push({t:'',s:`พนักงานที่มีงานมากที่สุดคือ ${topP.s.name} ${topP.jobs} แผน (${f1(topP.wd)} คน-วัน)`});
  if(stc.notdone||ncrIn.length)findings.push({t:ncrOpen?'bad':'warn',s:`งานไม่เสร็จ ${stc.notdone||0} แผน · NCR ${ncrIn.length} รายการ (ยังไม่ปิด ${ncrOpen}${ncrLate?` · เกินกำหนด ${ncrLate}`:''}) ดูรายละเอียดที่หน้า NCR`});
  if(pcN)findings.push({t:'warn',s:`เลื่อน ${stc.postponed} แผน และยกเลิก ${stc.cancelled} แผน (${pcRate}% ของแผนทั้งหมด) ดูเหตุผลในหัวข้อ 7`});
  if(!S.line&&lineRows.some(r=>r.n))findings.push({t:noLineN?'warn':'',s:`แยกตามสายงาน: ${lineRows.map(r=>`${r.l.name} ${r.n} แผน (${r.share}%)`).join(' · ')}${noLineN?` · ยังไม่ระบุสาย ${noLineN} แผน`:''}`});
  if(cal.n)findings.push({t:cal.fail||cal.problem?'warn':'',s:`สอบเทียบ Flow Meter ${cal.n} เครื่อง มีผลแล้ว ${cal.done} เครื่อง${judged?` · PASS ${cal.pass} · FAIL ${cal.fail} (ผ่าน ${passRate}%)`:''}${cal.problem?` · Problem ${cal.problem}`:''}${cal.postponed?` · เลื่อน ${cal.postponed}`:''}${calTypes[0]?` · ชนิดที่มากที่สุดคือ ${calTypes[0][0]} ${calTypes[0][1]} เครื่อง`:''}`});
  if(ins.n)findings.push({t:insRate!=null&&insRate<80?'warn':'',s:`Instrument ${ins.n} รายการ · Plan ${ins.plan} · Actual ${ins.actual}${insRate!=null?` (${insRate}%)`:''} · Completed ${ins.done}${ins.certs?` · ออก Certificate ${ins.certs} ใบ`:''}${insTypes[0]?` · Type ที่มากที่สุดคือ ${insTypes[0][0]}`:''}`});
  findings.push(...MPK.findings);
  const issues=[confN&&`จัดชน ${confN} แผน`,lateN&&`เลยวันแล้วยังไม่ปิด ${lateN} แผน`,gaN&&`รอ GA ระบุรถ ${gaN} แผน`].filter(Boolean);
  findings.push(issues.length?{t:'bad',s:`ประเด็นที่ต้องดำเนินการ: ${issues.join(' · ')}`}:{t:'good',s:'ไม่มีประเด็นค้างที่ต้องดำเนินการ'});

  return {P,today,all,work,jobs,leaves,days,workDays,active,conf,stc,allJ,totalJ,due,doneDue,doneRate,pcN,pcRate,confN,lateN,gaN,ncrIn,ncrOpen,ncrLate,
    people,manDays,capDays,util,busyN,leaveDays,avgTeam,prevJobs,prevDoneRate,roleRows,types,cust,custList,vehList,noCar,saleList,
    pairs,follow,buckets,heat,kpis,findings,custKeyOf,lineRows,noLineN,calR,cal,passRate,calTypes,calLabs,calSizes,calCust,calFluids,calRounds,insR,ins,insRate,insTypes,insLabs,insPlants,insCust,mp};
}

function renderDash(){
  if(notReady())return loading();
  const D=dashCompute();const P=D.P;const mode=P.mode;
  let h=`<div class="dash-bar"><div class="seg" role="radiogroup" aria-label="ช่วงรายงาน">${DASH_MODES.map(([v,l])=>`<label><input type="radio" name="dash-mode" id="dash-${v}" value="${v}"${mode===v?' checked':''}><span>${l}</span></label>`).join('')}</div>
    ${mode!=='week'?`<div class="wk-nav"><button type="button" class="arrow" data-action="dprev" aria-label="${esc(P.pLabel)}">‹</button><button type="button" data-action="dthis">${{month:'เดือนนี้',quarter:'ไตรมาสนี้',year:'ปีนี้'}[mode]}</button><button type="button" class="arrow" data-action="dnext" aria-label="ช่วงถัดไป">›</button></div>`:''}
    <span class="hint"><b>${esc(P.label)}</b> · ${esc(thDate(P.from))} – ${esc(thDate(P.to))}</span></div>`;
  if(D.loading)return h+loading();
  const now=new Date();
  const sec=(n,th,en,id)=>`<h3 class="dsec"${id?` id="${id}"`:''}><span>${n}</span>${th}<small>${en}</small></h3>`;

  /* ---- report header ---- */
  h+=`<div class="sum"><header class="rpt-hd span-12"><div><p class="rpt-org">${DASH_ORG}</p><h2>รายงานผลการปฏิบัติงาน${S.line?' · '+esc(lineName()):''} · ${esc(P.label)}</h2>
      <p class="rpt-meta">ช่วงข้อมูล ${esc(thDate(P.from))} – ${esc(thDate(P.to))} · เปรียบเทียบกับ${esc(P.pLabel)} · ข้อมูล ณ ${esc(thDate(ymd(now)))} ${pad(now.getHours())}:${pad(now.getMinutes())} น.</p></div>
    ${downloads?`<div class="rpt-actions"><button type="button" class="btn" data-action="dash-print" title="ดาวน์โหลดรายงาน A4 สำหรับพิมพ์หรือบันทึกเป็น PDF">${PRINT_ICON} พิมพ์รายงาน / PDF</button><button type="button" class="btn" data-action="dash-xlsx" title="ดาวน์โหลดตัวเลขทุกตารางเป็นไฟล์ Excel">Excel รายงาน</button></div>`:''}</header>`;

  /* ---- 1. executive summary ---- */
  const num=n=>`<span data-n="${n}">${n}</span>`;
  const tile=(i,lbl,en,val,unit,foot,cls,bar)=>`<div class="tile${cls?' '+cls:''}" style="--d:${i}"><span class="lbl">${lbl}<em>${en}</em></span><span class="val">${val}<small>${unit}</small></span>${bar!=null?`<span class="tbar"><i style="width:${Math.min(100,bar)}%"></i></span>`:''}<span class="foot">${foot}</span></div>`;
  const delta=(cur,prv,unit)=>prv==null?'<span class="dl">กำลังโหลดข้อมูลช่วงก่อน…</span>':cur===prv?`<span class="dl">เท่ากับ${P.pLabel}</span>`:`<span class="dl ${cur>prv?'up':'down'}">${cur>prv?'▲':'▼'} ${Math.abs(cur-prv)}${unit||''} จาก${P.pLabel}</span>`;
  const iss=D.confN+D.lateN+D.gaN;
  h+=sec(1,'สรุปภาพรวม','Summary');
  h+=`<div class="tiles">
    ${tile(0,'งานทั้งหมด','Total Jobs',num(D.totalJ),'แผน',delta(D.totalJ,D.prevJobs?D.prevJobs.length:null,' แผน'))}
    ${tile(1,'อัตราปิดงาน','Completion Rate',D.doneRate==null?'–':num(D.doneRate),D.doneRate==null?'':'%',esc(D.kpis[1].note),'',D.doneRate)}
    ${tile(2,'อัตราใช้กำลังคน','Utilization',num(D.util),'%',esc(D.kpis[2].note),D.util>=90?'warnt':'',D.util)}
    ${tile(3,'กำลังคนที่มีงาน','Active Manpower',num(D.busyN),`/ ${D.active.length} คน`,esc(D.kpis[4].note))}
    ${tile(4,'อัตราเลื่อน / ยกเลิก','Postpone & Cancel',num(D.pcRate),'%',esc(D.kpis[5].note),D.pcN?'warnt':'')}
    ${tile(5,'งานไม่เสร็จ / NCR','Not done · NCR',num(D.stc.notdone||0),'แผน',`${esc(D.kpis[7].note)}${D.ncrIn.length?' · <button type="button" class="lnk" data-view="ncr">เปิดหน้า NCR</button>':''}`,D.ncrOpen?'alert':'')}
    ${tile(6,'ประเด็นต้องติดตาม','Open Issues',(iss?'⚠ ':'')+num(iss),'รายการ',iss?`${esc(D.kpis[6].note)} · <button type="button" class="lnk" data-action="jump-conf" data-target="#dashIssues">ดูรายละเอียด ↓</button>`:'ไม่มีประเด็นค้าง',iss?'alert':'')}
  </div>`;
  h+=`<section class="panel span-12" style="--d:1"><header><h2>ประเด็นสำคัญ</h2><p>สรุปอัตโนมัติจากแผนงานในช่วงนี้ ใช้ประกอบการรายงานผลการปฏิบัติงาน</p></header><ul class="findings">${D.findings.map(f=>`<li class="${f.t}">${esc(f.s)}</li>`).join('')}</ul></section>`;
  /* สายงาน side by side (ทั้งหมด tab), then the Flow Meter calibration figures */
  if(!S.line){const R=D.lineRows;const tot=Math.max(1,R.reduce((a,r)=>a+r.n,0)+D.noLineN);
    h+=`<section class="panel span-12 dl-lines" style="--d:2"><header><h2>แยกตามสายงาน</h2><p>แผนงานของแต่ละสาย · ปิดงาน = เสร็จแล้ว ÷ แผนที่ถึงกำหนด · คน-วัน นับงานครึ่งวันเป็น 0.5${D.noLineN?` · ยังไม่ระบุสาย ${D.noLineN} แผน`:''}</p></header>
      <div class="dl-split" role="img" aria-label="${esc(R.map(r=>`${r.l.name} ${r.n} แผน`).join(', '))}">${R.filter(r=>r.n).map(r=>`<span style="flex:${r.n};background:${r.l.color}" data-tip="${esc(r.l.name)} ${r.n} แผน (${pct(r.n,tot)}%)"></span>`).join('')}${D.noLineN?`<span style="flex:${D.noLineN};background:var(--line)" data-tip="ยังไม่ระบุสาย ${D.noLineN} แผน"></span>`:''}</div>
      <div class="dl-cards">${R.map(r=>`<button type="button" class="dl-card" data-line-tab="${r.l.id}" style="--lc:${r.l.color}"><span class="dl-ico">${r.l.icon}</span><span class="dl-b"><b>${esc(r.l.name)}</b>
        <span class="dl-k"><span><em>${num(r.n)}</em>แผน · ${r.share}%</span><span><em>${r.doneRate==null?'–':r.doneRate+'%'}</em>ปิดงาน</span><span><em>${f1(r.md)}</em>คน-วัน</span><span><em>${r.cust}</em>ลูกค้า</span></span>
        <span class="lt-bar"><i style="width:${r.n?Math.round(r.done/r.n*100):0}%"></i></span></span></button>`).join('')}</div></section>`}
  if(S.line!=='ins'&&(D.cal.n||S.line==='fm')){const C=D.cal;const toB=l=>l.slice(0,8).map(([k,n])=>({label:k,n,extra:pct(n,C.n)+'%'}));
    h+=`<section class="panel span-12 dl-cal" style="--d:3"><header><h2>${CAL_ICON} Calibration Flow Meter · Weekly plan calibration</h2><p>เครื่องที่สอบเทียบในช่วงนี้จากแผนงาน (ไม่รวมแผนที่ยกเลิก) · Status: ADD เลื่อน ยกเลิก Problem · PASS / FAIL ตามที่ Lab บันทึก</p></header>
      ${C.n?`<div class="cal-tiles">
        <div><b>${num(C.n)}</b><span>เครื่องทั้งหมด</span></div><div class="ok"><b>${num(C.pass)}</b><span>PASS${D.passRate!=null?` · ${D.passRate}%`:''}</span></div>
        <div class="${C.fail?'bad':''}"><b>${num(C.fail)}</b><span>FAIL</span></div><div><b>${num(C.pending)}</b><span>รอผล (ADD)</span></div>
        <div><b>${num(C.postponed+C.cancelled)}</b><span>เลื่อน ${C.postponed} · ยกเลิก ${C.cancelled}</span></div><div class="${C.problem?'bad':''}"><b>${num(C.problem)}</b><span>Problem</span></div></div>
      <div class="cal-cols"><div><h3>ตามชนิด (Type)</h3>${hbars(toB(D.calTypes),'เครื่อง')}</div><div><h3>ตามขนาด (Size)</h3>${hbars(toB(D.calSizes),'เครื่อง')}</div>
        <div><h3>ตาม Process Fluid</h3>${hbars(toB(D.calFluids),'เครื่อง')}</div><div><h3>ตาม Round</h3>${hbars(toB(D.calRounds),'เครื่อง')}</div>
        <div><h3>ตาม Lab</h3>${hbars(toB(D.calLabs),'เครื่อง')}</div><div><h3>ตามลูกค้า</h3>${hbars(toB(D.calCust),'เครื่อง')}</div></div>`
      :'<p class="hint">ยังไม่มีรายการสอบเทียบในช่วงนี้ · กรอกได้ที่หัวข้อ "Weekly plan calibration" ในแผนงาน Flow Meter</p>'}</section>`}
  if(S.line!=='fm'&&(D.ins.n||S.line==='ins')){const I=D.ins;const toB=l=>l.slice(0,8).map(([k,n])=>({label:k,n,extra:pct(n,I.n)+'%'}));
    h+=`<section class="panel span-12 dl-cal dl-ins" style="--d:4"><header><h2>${INS_ICON} Instrument · Weekly plan instrument</h2><p>รายการเครื่องมือ Instrument ในช่วงนี้จากแผนงาน (ไม่รวมแผนที่ยกเลิก) · Plan / Actual = จำนวนตามที่กรอก · Completed = Remark "Completed"</p></header>
      ${I.n?`<div class="cal-tiles">
        <div><b>${num(I.n)}</b><span>รายการ (Request)</span></div><div><b>${num(I.plan)}</b><span>Plan รวม</span></div>
        <div class="ok"><b>${num(I.actual)}</b><span>Actual รวม${D.insRate!=null?` · ${D.insRate}%`:''}</span></div><div class="ok"><b>${num(I.done)}</b><span>Completed · ${pct(I.done,I.n)}%</span></div>
        <div><b>${num(I.certs)}</b><span>Certificate</span></div><div><b>${num(D.insCust.length)}</b><span>ลูกค้า</span></div></div>
      <div class="cal-cols"><div><h3>ตาม Type</h3>${hbars(toB(D.insTypes),'รายการ')}</div><div><h3>ตาม LAB</h3>${hbars(toB(D.insLabs),'รายการ')}</div><div><h3>ตาม Plant</h3>${hbars(toB(D.insPlants),'รายการ')}</div><div><h3>ตามลูกค้า</h3>${hbars(toB(D.insCust),'รายการ')}</div></div>`
      :'<p class="hint">ยังไม่มีรายการ Instrument ในช่วงนี้ · กรอกได้ที่หัวข้อ "Weekly plan instrument" ในแผนงาน Instrument</p>'}</section>`}

  /* ---- 2. Master Plan: plan vs actual ---- */
  h+=dashMpHtml(D,{tile,num,sec});

  /* ---- 3. performance: trend chart + status ---- */
  h+=sec(3,'ผลการดำเนินงาน','Performance');
  const B=D.buckets;const day=P.unit==='day';const unitName=day?'วัน':P.unit==='week'?'สัปดาห์':'เดือน';
  const maxN=Math.max(1,...B.map(x=>x.n));const step=maxN<=5?1:maxN<=10?2:maxN<=20?5:maxN<=50?10:maxN<=100?20:50;const yMax=Math.max(step,Math.ceil(maxN/step)*step);
  const ticks=[];for(let v=0;v<=yMax;v+=step)ticks.push(v);
  h+=`<section class="panel span-8" style="--d:2"><header><h2>แนวโน้มงานราย${unitName}</h2><p>จำนวนแผนงานในแต่ละ${unitName} แยกตามสถานะ (ไม่รวมแผนลาและงานที่ยกเลิก)${day?' แถวล่างคือจำนวนคนที่ว่างทั้งวัน':''}</p></header>
    <div class="scroll-x plain"><div class="dchart" style="--n:${B.length};min-width:${Math.max(420,B.length*(day?26:44))}px">
      <div class="dc-plot">${ticks.map(v=>`<div class="dc-grid${v===0?' base':''}" style="bottom:${v/yMax*100}%"><span>${v}</span></div>`).join('')}${day&&yMax>=MAX_CARDS?`<div class="dc-grid cap" style="bottom:${MAX_CARDS/yMax*100}%"><span>${MAX_CARDS}</span></div>`:''}
        ${B.map((x,j)=>{const tip=`${x.name}: ${x.n} งาน`+(x.n?` (${DASH_SEG.filter(([s])=>x.c[s]).map(([s])=>`${stTh(s)} ${x.c[s]}`).join(' · ')})`:'')+(day?` · ว่าง ${x.free} คน${x.lv?` · ลา ${x.lv} คน`:''}`:'');
          return `<div class="dc-col${x.we?' we':''}${x.td?' td':''}" data-tip="${esc(tip)}" style="--j:${j}">${x.n?`<span class="dc-v" style="bottom:calc(${x.n/yMax*100}% + 3px)">${x.n}</span>`:''}<div class="dc-stack" style="height:${x.n/yMax*100}%">${DASH_SEG.filter(([s])=>x.c[s]).map(([s,c])=>`<i style="flex:${x.c[s]};background:${c}"></i>`).join('')}</div></div>`}).join('')}</div>
      <div class="dc-x">${B.map(x=>`<span class="${x.td?'td':''}"><b>${esc(x.lbl)}</b>${esc(x.sub)}</span>`).join('')}</div>
      ${day?`<div class="dc-x dc-free">${B.map(x=>`<span title="ว่าง ${x.free} คน">${x.free}</span>`).join('')}</div>`:''}
    </div></div>
    <ul class="legend">${DASH_SEG.map(([s,c])=>`<li><i style="background:${c}"></i>${stTh(s)} <b>${D.stc[s]}</b></li>`).join('')}${day?'<li><i style="background:var(--good-ink);border-radius:50%"></i>ตัวเลขแถวล่าง = คนว่าง</li>':''}</ul></section>`;
  const pc={am:D.jobs.filter(t=>periodOf(t)==='am').length,pm:D.jobs.filter(t=>periodOf(t)==='pm').length,full:D.jobs.filter(t=>periodOf(t)==='full').length};
  h+=`<section class="panel span-4" style="--d:3"><header><h2>สถานะงาน</h2><p>ทุกแผนงานในช่วงนี้ ${D.allJ} แผน (รวมที่ยกเลิก)</p></header>
    <div class="stack" role="img" aria-label="${STATUSES.map(s=>`${s.th} ${D.stc[s.id]}`).join(', ')}">${D.allJ?STATUSES.filter(s=>D.stc[s.id]).map(s=>`<span style="flex:${D.stc[s.id]};background:${s.color}" data-tip="${s.th} ${D.stc[s.id]} แผน (${pct(D.stc[s.id],D.allJ)}%)"></span>`).join(''):''}</div>
    <table class="mini"><tbody>${STATUSES.map(s=>`<tr><td><span class="s-${s.id}">${s.icon}</span> ${s.th}</td><td class="n"><b>${D.stc[s.id]}</b></td><td class="n hint">${pct(D.stc[s.id],D.allJ)}%</td></tr>`).join('')}</tbody></table>
    <header style="margin-top:4px"><h2>ช่วงเวลาของงาน</h2></header>
    <table class="mini"><tbody><tr><td>เช้า</td><td class="n"><b>${pc.am}</b></td></tr><tr><td>บ่าย</td><td class="n"><b>${pc.pm}</b></td></tr><tr><td>เช้า,บ่าย (ทั้งวัน)</td><td class="n"><b>${pc.full}</b></td></tr><tr><td>ทีมเฉลี่ยต่องาน</td><td class="n"><b>${f1(D.avgTeam)}</b> คน</td></tr></tbody></table></section>`;

  /* ---- 4. manpower ---- */
  h+=sec(4,'กำลังคน','Manpower');
  const grpTable=(rows,first)=>`<table class="mini"><thead><tr><th>${first}</th><th class="n">คน</th><th class="n">แผน</th><th class="n">คน-วัน</th><th class="n">ใช้กำลังคน</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.k)}</td><td class="n">${x.n}</td><td class="n">${x.jobs}</td><td class="n">${f1(x.md)}</td><td class="n"><span class="ibar sm"><i style="width:${Math.min(100,x.util)}%"></i></span>${x.util}%</td></tr>`).join('')||'<tr><td colspan="5" class="hint">ยังไม่มีข้อมูล</td></tr>'}</tbody></table>`;
  h+=`<section class="panel span-12" style="--d:5"><header><h2>ภาระงานตามตำแหน่ง</h2><p>เรียงตามลำดับตำแหน่งในข้อมูลหลัก · ใช้กำลังคน = คน-วันทำงาน ÷ (จำนวนคนในตำแหน่ง × วันทำงาน จ.–ส. ไม่รวมวันหยุดนักขัตฤกษ์)</p></header>${grpTable(D.roleRows,'ตำแหน่ง')}</section>`;
  const maxJ=Math.max(1,...D.people.map(p=>p.jobs));const wdN=D.workDays.length;
  h+=`<section class="panel span-12" style="--d:6"><header><h2>รายละเอียดรายคน</h2><p>คน-วัน นับงานครึ่งวัน (เช้าหรือบ่าย) เป็น 0.5 · ว่าง = วันทำงาน (จันทร์–เสาร์ ไม่รวมวันหยุดนักขัตฤกษ์) ที่ไม่มีแผนเลย · เรียงจากงานมากไปน้อย</p></header>
    <div class="scroll-x plain" style="max-height:520px;overflow:auto"><table class="mini ptab"><thead><tr><th>#</th><th>ชื่อ</th><th>งาน (แผน)</th><th class="n">คน-วัน</th><th class="n">ใช้กำลังคน</th><th class="n">เช้า</th><th class="n">บ่าย</th><th class="n">ทั้งวัน</th><th class="n">ลา (วัน)</th><th class="n">ว่าง (วัน)</th><th class="n">จัดชน</th><th>งานที่ทำมากสุด</th></tr></thead><tbody>
    ${D.people.map((p,i)=>`<tr${p.jobs?'':' class="idle"'}><td class="n hint">${i+1}</td><td><b>${esc(p.s.name)}</b><span class="sub">${esc(p.s.role||'—')}</span></td>
      <td><span class="ibar"><i style="width:${p.jobs/maxJ*100}%"></i></span><b class="num">${p.jobs}</b></td><td class="n">${f1(p.wd)}</td><td class="n">${pct(p.wd,wdN)}%</td><td class="n">${p.am||'–'}</td><td class="n">${p.pm||'–'}</td><td class="n">${p.full||'–'}</td>
      <td class="n">${p.leave.size||'–'}</td><td class="n${p.free===wdN?' free':''}">${p.free}</td><td class="n${p.conf?' bad':''}">${p.conf?'⚠ '+p.conf:'–'}</td><td>${esc(p.top||'—')}</td></tr>`).join('')||'<tr><td colspan="12" class="hint">ยังไม่มีรายชื่อพนักงาน</td></tr>'}
    </tbody></table></div></section>`;
  if(D.heat){const H=D.heat;const mx=Math.max(1,...H.rows.flatMap(g=>g.v));
    h+=`<section class="panel span-12" style="--d:7"><header><h2>งานต่อคนราย${H.by} · ${esc(P.label)}</h2><p>จำนวนแผนงานของแต่ละคนในแต่ละ${H.by} สีเข้มคืองานมาก</p></header><div class="scroll-x plain" style="max-height:480px;overflow:auto"><table class="mini heat"><thead><tr><th>ชื่อ</th>${H.cols.map(c=>`<th class="n">${esc(c.name)}</th>`).join('')}<th class="n">รวม</th></tr></thead><tbody>
      ${H.rows.map(g=>`<tr><td>${esc(g.p.s.name)}</td>${g.v.map(v=>`<td class="n${v?' h':''}" style="--h:${Math.round(v/mx*55)}">${v||'–'}</td>`).join('')}<td class="n"><b>${g.p.jobs}</b></td></tr>`).join('')}</tbody></table></div></section>`}

  /* ---- 5. customers & job types ---- */
  h+=sec(5,'ลูกค้าและประเภทงาน','Customers & Job Types');
  const top=D.custList.slice(0,10).map(([k,n])=>({label:k,n,extra:pct(n,D.totalJ)+'%'}));const restN=D.custList.slice(10).reduce((a,x)=>a+x[1],0);if(restN)top.push({label:`ลูกค้าอื่น ${D.custList.length-10} ราย`,n:restN});
  h+=`<section class="panel span-6" style="--d:8"><header><h2>งานตามหัวข้องาน</h2><p>จำนวนแผนของแต่ละหัวข้องาน เรียงจากมากไปน้อย</p></header>${hbars(D.types.map(x=>Object.assign({},x,{extra:pct(x.n,D.totalJ)+'%'})),'แผน')}</section>`;
  h+=`<section class="panel span-6" style="--d:9"><header><h2>งานตามลูกค้า</h2><p>ลูกค้า ${D.cust.size} ราย · 10 อันดับแรกตามจำนวนแผน</p></header>${hbars(top,'แผน')}</section>`;
  const tcols=D.types.filter(x=>x.n&&x.id);const crow=D.custList.slice(0,10);
  h+=`<section class="panel span-12" style="--d:10"><header><h2>ลูกค้า × หัวข้องาน</h2><p>จำนวนแผนของลูกค้าแต่ละรายแยกตามหัวข้องาน (10 รายแรก)</p></header>${crow.length&&tcols.length?`<div class="scroll-x plain"><table class="mini"><thead><tr><th>ลูกค้า</th>${tcols.map(c=>`<th class="n"><span class="tdot" style="--c:${safeColor(c.color)}"><i></i>${esc(c.label)}</span></th>`).join('')}<th class="n">รวม</th></tr></thead><tbody>${crow.map(([k,n])=>`<tr><td>${esc(k)}</td>${tcols.map(c=>{const v=D.jobs.filter(t=>D.custKeyOf(t)===k&&typeIdOf(t)===c.id).length;return `<td class="n">${v||'–'}</td>`}).join('')}<td class="n"><b>${n}</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">ยังไม่มีข้อมูลในช่วงนี้</p>'}</section>`;

  /* ---- 6. resources & sales ---- */
  h+=sec(6,'ทรัพยากรและผู้ประสานงาน','Resources & Sales');
  h+=`<section class="panel span-6" style="--d:11"><header><h2>การใช้รถ</h2><p>จำนวนแผนและจำนวนวันที่ใช้ของแต่ละคัน${D.noCar?` · ไม่ใช้รถ ${D.noCar} แผน`:''}</p></header>${hbars(D.vehList.map(x=>({label:x.label,n:x.n,extra:`${x.days} วัน`})),'แผน')}</section>`;
  h+=`<section class="panel span-6" style="--d:12"><header><h2>งานตาม Sale</h2><p>จำนวนแผนงานที่ Sale แต่ละคนดูแล</p></header>${hbars(D.saleList.map(([k,n])=>({label:k,n,extra:pct(n,D.totalJ)+'%'})),'แผน')}</section>`;

  /* ---- 7. issues & follow-up ---- */
  h+=sec(7,'ประเด็นที่ต้องติดตาม','Issues & Follow-up','dashIssues');
  if(D.pairs.length){
    const overlapName=(a,b)=>{const am=pA(a)===0&&pA(b)===0,pm=pB(a)===1&&pB(b)===1;return am&&pm?'เช้า,บ่าย':am?'เช้า':'บ่าย'};
    const planCell=t=>{const ty=typeOf(t);return `<button type="button" class="cplan" data-edit="${esc(t.id)}" style="--c:${safeColor(ty.color)}"><span class="tdot"><i></i><b>${esc(typeLabel(t))}</b></span>${t.planNo?`<span class="mono">${esc(t.planNo)}</span>`:''}<small>${esc([pName(t),t.customer,t.location].filter(Boolean).join(' · ')||'—')}</small><small>ทีม: ${esc(teamNames(t).join(', ')||'—')}${t.transport?` · รถ: ${esc(t.transport)}`:''}</small></button>`};
    h+=`<section class="panel span-12" id="dashConf" style="--d:13"><header><h2>แผนงานที่จัดชน · ${D.pairs.length} คู่</h2><p>แต่ละแถวคือแผนงาน 2 แผน ซึ่งใช้คนหรือรถคันเดียวกันในช่วงเวลาที่ทับกัน หรือจัดคนที่ลาไปทำงาน กดที่แผนงานเพื่อเปิดแก้ไข</p></header>
      <div class="scroll-x plain"><table class="mini ctab"><thead><tr><th>วันที่</th><th>ช่วงที่ทับกัน</th><th>แผนงาน</th><th>ชนกับแผนงาน</th><th>สาเหตุ</th></tr></thead><tbody>
      ${D.pairs.map(p=>{const who=p.staff.map(staffName);
        return `<tr><td class="num">${esc(fmtDay(p.a.date))}</td><td><span class="per">${esc(overlapName(p.a,p.b))}</span></td><td>${planCell(p.a)}</td><td>${planCell(p.b)}</td>
          <td class="why">${who.length?`<span class="cchip ${p.leave?'l':'p'}">${p.leave?'ติดลา':'คนชน'}: ${esc(who.join(', '))}</span>`:''}${p.veh?`<span class="cchip v">รถที่ใช้งานซ้ำกัน: ${esc(p.veh)}</span>`:''}
          <small>${p.leave?'เอาคนที่ลาออกจากแผนงาน หรือเปลี่ยนช่วงเวลา':p.veh&&!who.length?'เปลี่ยนรถ หรือเปลี่ยนช่วงเวลาของแผนใดแผนหนึ่ง':'เปลี่ยนคน หรือเปลี่ยนช่วงเวลาของแผนใดแผนหนึ่ง'}</small></td></tr>`}).join('')}
      </tbody></table></div></section>`;
  }
  const F=D.follow;
  h+=`<section class="panel span-12" style="--d:14"><header><h2>งานที่ต้องติดตาม · ${F.length} แผน</h2><p>งานที่เลื่อนหรือยกเลิก พร้อมเหตุผลจากหน้างาน งานที่เลยวันแล้วยังไม่ปิด${D.gaN?` และแผนงานที่ขอรถส่วนกลาง ซึ่ง GA ยังไม่ได้ระบุรถ (${D.gaN} แผน)`:''} กดที่แถวเพื่อเปิดแผน</p></header>
    ${F.length?`<div class="scroll-x plain"><table class="mini ftab"><thead><tr><th>วันที่</th><th>งาน</th><th>ลูกค้า</th><th>สถานะ</th><th>เหตุผล / สิ่งที่ต้องทำ</th><th>ทีม</th></tr></thead><tbody>${F.map(t=>{const reason=NEEDS_REASON.has(t.status);const late=!reason&&isLate(t);const ty=typeOf(t);
      const stat=reason?`<span class="fstat ${esc(t.status)}">${(STATUS[t.status]||{}).icon||''} ${esc(stTh(t.status))}</span>`:late?'<span class="fstat late">⏱ เลยวันแล้ว</span>':'<span class="fstat ga">รอรถ GA</span>';
      const why=reason?(t.statusNote?esc(t.statusNote):'<span class="hint">ยังไม่ได้ใส่เหตุผล</span>'):late?`<span class="hint">ยังเป็น "${esc(stTh(t.status))}" ควรอัปเดตสถานะ</span>${gaWaiting(t)?'<br><span class="hint">และยังรอ GA ระบุรถ</span>':''}`:'<span class="hint">ขอรถส่วนกลางแล้ว GA ยังไม่ได้ระบุรถและทะเบียน กรอกทะเบียนในแผนเมื่อได้รับแจ้ง</span>';
      return `<tr data-edit="${esc(t.id)}"><td class="num">${esc(fmtDay(t.date))}</td><td><span class="tdot" style="--c:${safeColor(ty.color)}"><i></i>${esc(typeLabel(t))}</span>${t.planNo?`<span class="sub mono">${esc(t.planNo)}</span>`:''}</td><td>${esc(t.customer||'–')}</td>
        <td>${stat}</td><td class="why">${why}</td><td>${esc(teamNames(t).join(', ')||'–')}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="hint">ไม่มีงานที่ต้องติดตามในช่วงนี้</p>'}</section>`;
  return h+'</div>';
}

/* ---------- report tables shared by the A4 print and the Excel file ---------- */
function dashRows(D){
  const P=D.P;const unitName=P.unit==='day'?'วัน':P.unit==='week'?'สัปดาห์':'เดือน';
  const followWhy=t=>NEEDS_REASON.has(t.status)?(t.statusNote||'ยังไม่ได้ใส่เหตุผล'):isLate(t)?`ยังเป็น "${stTh(t.status)}" ควรอัปเดตสถานะ`:'รอ GA ระบุรถและทะเบียน';
  const followStat=t=>NEEDS_REASON.has(t.status)?stTh(t.status):isLate(t)?'เลยวันแล้ว':'รอรถ GA';
  const planTxt=t=>[typeLabel(t),t.planNo,t.customer].filter(Boolean).join(' · ');
  const grp=x=>[x.k,x.n,x.jobs,Math.round(x.md*10)/10,x.util];
  return {...dashMpRows(D),
    kpi:{sheet:'KPI',title:'ตัวชี้วัดหลัก (KPI)',head:['ตัวชี้วัด','ค่า','รายละเอียด'],rows:D.kpis.map(k=>[k.name,k.value,k.note])},
    trend:{sheet:'แนวโน้ม',title:`แนวโน้มงานราย${unitName}`,head:[unitName,'รวม (แผน)','เสร็จแล้ว','ไม่เสร็จ','วางแผน','เลื่อน'],num:[1,2,3,4,5],rows:D.buckets.map(b=>[b.name,b.n,b.c.done,b.c.notdone,b.c.planned,b.c.postponed])},
    status:{sheet:'สถานะ',title:'สถานะงาน',head:['สถานะ','แผน','%'],num:[1,2],rows:STATUSES.map(s=>[s.th,D.stc[s.id],pct(D.stc[s.id],D.allJ)])},
    role:{sheet:'ตำแหน่ง',title:'ภาระงานตามตำแหน่ง',head:['ตำแหน่ง','คน','แผน','คน-วัน','ใช้กำลังคน (%)'],num:[1,2,3,4],rows:D.roleRows.map(grp)},
    person:{sheet:'รายคน',title:'รายละเอียดรายคน',head:['#','ชื่อ','ตำแหน่ง','งาน (แผน)','คน-วัน','ใช้กำลังคน (%)','เช้า','บ่าย','ทั้งวัน','ลา (วัน)','ว่าง (วัน)','จัดชน','งานที่ทำมากสุด'],num:[0,3,4,5,6,7,8,9,10,11],
      rows:D.people.map((p,i)=>[i+1,p.s.name,p.s.role||'',p.jobs,Math.round(p.wd*10)/10,pct(p.wd,D.workDays.length),p.am,p.pm,p.full,p.leave.size,p.free,p.conf,p.top||''])},
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
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>รายงานผลการปฏิบัติงาน ${esc(P.label)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap">
<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10.5px/1.5 "IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif;color:#0b1b33;margin:16px;max-width:190mm}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:12px;padding:10px 12px;background:#eef3fa;border-radius:8px;font-size:13px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2.5px solid #1462d0;padding-bottom:8px;margin-bottom:12px}.hd .org{margin:0;color:#1462d0;font-weight:600;font-size:10px;letter-spacing:.06em;text-transform:uppercase}.hd h1{font-size:19px;margin:2px 0 0}.hd p{margin:0;color:#34496b;text-align:right}
h2{display:flex;align-items:center;gap:8px;font-size:14px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #c6d9f1;break-after:avoid}h2 span{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:5px;background:#1462d0;color:#fff;font-size:11px}h2 small{font-weight:400;color:#62738f;font-size:11px}
h3{font-size:11.5px;margin:10px 0 4px;break-after:avoid}
.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.kpi div{border:1px solid #c6d9f1;border-radius:6px;padding:6px 8px;break-inside:avoid}.kpi b{display:block;font-size:16px;color:#0a2150}.kpi span{display:block;font-size:9.5px;color:#34496b}.kpi em{display:block;font-style:normal;font-size:9px;color:#62738f;margin-top:2px}
ul.f{margin:8px 0 0;padding-left:18px}ul.f li{margin:2px 0}ul.f li.bad{color:#b42323;font-weight:600}ul.f li.warn{color:#875800}ul.f li.good{color:#006300}
.t{border-collapse:collapse;width:100%;margin-bottom:4px}.t th,.t td{border:1px solid #c6d9f1;padding:3px 5px;text-align:left;vertical-align:top;font-size:9.5px;overflow-wrap:anywhere}.t thead th{background:#e6f1fd;font-weight:600}.t .n{text-align:right;white-space:nowrap}.t tr{break-inside:avoid}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}.e{color:#62738f;margin:2px 0 6px}
.sig{display:flex;gap:30px;margin-top:34px;break-inside:avoid}.sig div{flex:1;text-align:center}.sig span{display:block;border-top:1px solid #0b1b33;margin:34px 10px 4px}
@media print{.bar{display:none}body{margin:0;max-width:none}}</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>ตั้งค่า: กระดาษ A4 · แนวตั้ง (Portrait) · ติ๊ก Background graphics</span></div>
<div class="hd"><div style="display:flex;gap:10px;align-items:center">${LOGO_MARK}<div><p class="org">${esc(DASH_ORG)}</p><h1>รายงานผลการปฏิบัติงาน${S.line?' · '+esc(lineName()):''} · ${esc(P.label)}</h1></div></div>
<p>ช่วงข้อมูล ${esc(thDate(P.from))} – ${esc(thDate(P.to))}<br>จัดทำเมื่อ ${esc(thDate(ymd(now)))} ${pad(now.getHours())}:${pad(now.getMinutes())} น.${S.account&&S.account.name?`<br>ผู้จัดทำ ${esc(S.account.name)}`:''}</p></div>
${sec(1,'สรุปภาพรวม','Summary')}
<div class="kpi">${D.kpis.map(k=>`<div><span>${esc(k.name)}</span><b>${esc(k.value)}</b><em>${esc(k.note)}</em></div>`).join('')}</div>
<ul class="f">${D.findings.map(f=>`<li class="${f.t}">${esc(f.s)}</li>`).join('')}</ul>
${!S.line?tbl(T.lines):''}${D.calR.length?tbl(Object.assign({},T.cal,{head:T.cal.head.filter((x,i)=>i!==CAL_HEAD.length-1),rows:T.cal.rows.map(r=>r.filter((x,i)=>i!==CAL_HEAD.length-1))})):''}${D.insR.length?tbl(Object.assign({},T.ins,{head:T.ins.head.filter((x,i)=>![7,13].includes(i)),num:[12,13],rows:T.ins.rows.map(r=>r.filter((x,i)=>![7,13].includes(i)))})):''}
${D.mp?`${sec(2,'แผนเทียบผล · Master Plan','Plan vs Actual')}${tbl(Object.assign({},T.mpTrend,S.line==='fm'?{head:T.mpTrend.head.slice(0,4),num:[1,2,3],rows:T.mpTrend.rows.map(r=>r.slice(0,4))}:S.line==='ins'?{head:[T.mpTrend.head[0],T.mpTrend.head[4]],num:[1],rows:T.mpTrend.rows.map(r=>[r[0],r[4]])}:{}))}<div class="two">${S.line!=='ins'?`<div>${tbl(T.mpCodes)}</div>`:''}${S.line!=='fm'?`<div>${tbl(Object.assign({},T.mpInsLab,{rows:T.mpInsLab.rows.slice(0,25)}))}</div>`:''}</div>`:''}
${sec(3,'ผลการดำเนินงาน','Performance')}<div class="two"><div>${tbl(T.trend)}</div><div>${tbl(T.status)}</div></div>
${sec(4,'กำลังคน','Manpower')}${tbl(T.role)}${tbl(Object.assign({},T.person,{head:T.person.head.slice(0,12),rows:T.person.rows.map(r=>r.slice(0,12))}))}
${sec(5,'ลูกค้าและประเภทงาน','Customers & Job Types')}<div class="two"><div>${tbl(T.types)}</div><div>${tbl(Object.assign({},T.cust,{title:T.cust.rows.length>15?'งานตามลูกค้า (15 อันดับแรก)':T.cust.title,rows:T.cust.rows.slice(0,15)}))}</div></div>
${sec(6,'ทรัพยากรและผู้ประสานงาน','Resources & Sales')}<div class="two"><div>${tbl(T.veh)}</div><div>${tbl(T.sale)}</div></div>
${sec(7,'ประเด็นที่ต้องติดตาม','Issues & Follow-up')}${tbl(Object.assign({},T.ncr,{head:T.ncr.head.filter((x,i)=>![2,7,8].includes(i)),rows:T.ncr.rows.map(r=>r.filter((x,i)=>![2,7,8].includes(i)))}))}${tbl(T.conf)}${tbl(T.follow)}
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
    const add=(name,head,body)=>{const ws=X.utils.aoa_to_sheet([title,stamp,[],...head,...body]);ws['!cols']=widths([...head,...body]);X.utils.book_append_sheet(wb,ws,name)};
    add('สรุป',[[T.kpi.title],T.kpi.head],[...T.kpi.rows,[],['ประเด็นสำคัญ'],...D.findings.map(f=>['• '+f.s])]);
    for(const k of ['lines','cal','ins','insCert',...(D.mp?['mpTrend','mpCodes','mpFm','mpIns','mpInsLab']:[]),'trend','status','role','person','types','cust','veh','sale','ncr','conf','follow','plans']){const t=T[k];add(t.sheet,[[t.title],t.head],t.rows.length?t.rows:[['ไม่มีข้อมูลในช่วงนี้']])}
    await saveFile(dashFile(P)+'.xlsx',X.write(wb,{type:'array',bookType:'xlsx'}));
  }catch(e){toast('สร้างไฟล์ Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่')}
  finally{btn.disabled=false;btn.textContent=old}
}
