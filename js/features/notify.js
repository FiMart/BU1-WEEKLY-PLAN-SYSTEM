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
  ['mrep','รายงานแผนตอนเช้า','<path d="M12 3v2M5.6 5.6 7 7M3 12h2M17 7l1.4-1.4M19 12h2"/><path d="M7.5 16a4.5 4.5 0 0 1 9 0"/><path d="M3 19.5h18"/><path d="m10 11.5 1.5 1.5 3-3"/>'],
  ['odoc','เอกสาร Onsite ค้าง','<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M14 3v5h5v3M8.5 9h3M8.5 12.5h5"/><circle cx="17" cy="17" r="3.6"/><path d="M17 15.3v1.9l1.2.8"/>'],
  ['safety','บัตร Safety','<path d="M12 3 5 6v5.5c0 4.3 2.9 8 7 9.5 4.1-1.5 7-5.2 7-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'],
];
const NTF_CAT=Object.fromEntries(NTF_CATS.map(([k,l,i])=>[k,{l,i}]));
const NTF={key:'',snap:null,list:[],read:new Set(),seen:new Set(),prefs:{off:[]},live:[],range:null,rangeAt:0,busy:false,timer:null,ready:false};
const ntfKeyOf=()=>`bu1wp.ntf|${S.backend||'local'}|${typeof DEPT==='function'?DEPT():''}|${norm(S.me)||'local'}`;
function ntfLoad(){
  const k=ntfKeyOf();if(NTF.key===k)return;NTF.key=k;let d=null;try{d=JSON.parse(localStorage.getItem(k)||'null')}catch(e){}
  NTF.snap=d&&d.snap||null;NTF.list=d&&Array.isArray(d.list)?d.list:[];NTF.read=new Set(d&&d.read||[]);NTF.seen=new Set(d&&d.seen||[]);
  NTF.prefs=Object.assign({off:[]},d&&d.prefs);NTF.live=[];NTF.range=null;NTF.rangeAt=0;
}
function ntfSave(){try{localStorage.setItem(NTF.key,JSON.stringify({snap:NTF.snap,list:NTF.list.slice(0,150),read:[...NTF.read].slice(-600),seen:[...NTF.seen].slice(-600),prefs:NTF.prefs}))}catch(e){}}

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

/* ---------- the plans watched: two weeks back to a month ahead (the open week is always the freshest copy) ---------- */
const ntfWin=()=>({from:ymd(addDays(new Date(),-14)),to:ymd(addDays(new Date(),30))});
function ntfTasks(){const m=new Map();(NTF.range||[]).forEach(t=>m.set(t.id,t));S.tasks.forEach(t=>m.set(t.id,t));const {from,to}=ntfWin();return [...m.values()].filter(t=>t.date>=from&&t.date<=to)}
const NTF_SIG=[['date','วันที่'],['period','ช่วงเวลา'],['timeNote','เวลา'],['customer','ลูกค้า'],['location','สถานที่'],['staffIds','ทีม'],['transport','รถ'],['jobType','หัวข้องาน'],['planNo','Plan No.']];
const ntfSig=t=>NTF_SIG.map(([k])=>{const v=t[k];return Array.isArray(v)?v.slice().sort().join(','):String(v==null?'':v)});
const ntfGa=t=>t.gaCar?JSON.stringify(t.gaCar):'';
const tSnap=t=>({s:t.status||'planned',g:ntfGa(t),u:t.updatedAt||'',f:ntfSig(t)});

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
  const L=[];const off=c=>NTF.prefs.off.includes(c);const td=ymd(new Date()),tm=ymd(addDays(new Date(),1));
  const add=(cat,id,title,body,ref)=>{if(!off(cat))L.push({id:`live:${cat}:${id}`,cat,title,body,ref,live:true})};
  if(S.jobsReady)S.jobs.forEach(j=>{
    if(isPlanner()&&j.state==='pending'){const f=acceptFlow(j);if(f&&f[0]==='delay')add('job','acc:'+j.id,'ใบรับคำร้องรอรับเกินกำหนด',`${j.jobNo} · ${j.customer||''} · Sale ${j.sale||'—'}`,{t:'job',id:j.id})}
    if(isPlanner()&&jbNeedsReview(j))add('job','rev:'+j.id,'รอ review ใบรับคำร้องที่ Sale แก้หลังออก PN',`${j.jobNo} · ${j.planNo||''} · ${j.customer||''}`,{t:'job',id:j.id})});
  if(S.checksReady)S.checks.forEach(c=>{const F=CS_FORMS[c.form]||{name:c.form};
    if(c.state==='submitted'&&canApprove(c)){const f=csFlow(c);add('cs',(f&&f[0]==='delay'?'due:':'wait:')+c.id,f&&f[0]==='delay'?'Check Sheet รออนุมัติเกินกำหนด':'Check Sheet รออนุมัติ',`${F.name} ${c.no} · ส่งโดย ${ntfWho(c.submittedBy)||'—'}`,{t:'check',id:c.id})}
    if(c.state==='rejected'&&ntfMe()&&(norm(c.submittedBy)===ntfMe()||norm(c.createdBy)===ntfMe()))add('cs','rej:'+c.id,'Check Sheet ถูกตีกลับ · รอแก้แล้วส่งใหม่',`${F.name} ${c.no}${c.rejectReason?' · '+c.rejectReason:''}`,{t:'check',id:c.id})});
  if(S.ncrReady&&isPlanner())S.ncr.forEach(n=>{if(n.state==='closed'||!n.due)return;
    if(ncrOverdue(n))add('ncr','over:'+n.id,'NCR เกินกำหนดแก้ไข',`${n.ncrNo} · กำหนด ${fmtDay(n.due)}${n.owner?' · '+n.owner:''}`,{t:'ncr',id:n.id});
    else if(n.due<=ymd(addDays(new Date(),2)))add('ncr','soon:'+n.id,'NCR ใกล้กำหนดแก้ไข',`${n.ncrNo} · กำหนด ${fmtDay(n.due)}${n.owner?' · '+n.owner:''}`,{t:'ncr',id:n.id})});
  tasks.forEach(t=>{if(isLeave(t)||!ntfMine(t))return;const d=t.date;const ref={t:'task',id:t.id,date:d};
    if(isLate(t)&&d>=ymd(addDays(new Date(),-14)))add('follow','late:'+t.id,'เลยวันแล้วยังไม่ปิดงาน',ntfPlan(t),ref);
    if(t.status==='done'&&d>=ymd(addDays(new Date(),-30))){const m=docMissing(t);if(m.length)add('follow','doc:'+t.id,'เอกสารหลังจบงานยังไม่ครบ',`${ntfPlan(t)} · ขาด ${m.map(k=>DOC_NAME[k]).join(', ')}`,ref)}
    if(holdsTeam(t)&&gaWaiting(t)&&(d===td||d===tm))add('follow','ga:'+t.id,d===td?'วันนี้ยังไม่มีรถ GA':'พรุ่งนี้ยังไม่มีรถ GA',`${ntfPlan(t)} · ขอรถ GA แล้ว รอ GA จัดรถ`,ref);
    if(holdsTeam(t)&&teamShort(t)>0&&d>=td&&d<=ymd(addDays(new Date(),2)))add('follow','team:'+t.id,'ทีมยังไม่ครบตามที่ต้องการ',`${ntfPlan(t)} · ${teamNeedText(t)}`,ref);
    if(holdsTeam(t)&&t.areaId&&d>=td&&d<=ymd(addDays(new Date(),7))&&typeof cardOf==='function'){
      const bad=(t.staffIds||[]).map(id=>[id,cardOf(id,t.areaId)]).filter(([,c])=>c);
      if(bad.length)add('safety','card:'+t.id,'บัตร Safety ของทีมต้องตรวจ',`${ntfPlan(t)} · ${bad.map(([id,c])=>`${staffName(id)} ${c.txt}`).join(', ')}`,ref)}});
  /* ติดตามเอกสาร Onsite (user, 22 Oct 2026; js/features/onsite-docs.js): the Planner and the work's Lead, near or past its Final Date */
  if(typeof odOn==='function')tasks.forEach(t=>{if(!odOn(t)||!(isPlanner()||(!!ntfMeStaff()&&odLeadId(t)===ntfMeStaff())))return;const r=odRow(t);if(r.none)return;
    const miss=r.miss.map(s=>OD_NAME[s.id]).join(', ');const ref={t:'task',id:t.id,date:t.date};
    if(r.status==='follow')add('odoc','over:'+t.id,'เอกสาร Onsite เลย Final แล้ว',`${ntfPlan(t)} · เลยมา ${r.over} วัน · ขาด ${miss}`,ref);
    else if(r.status==='wait'&&r.left<=1)add('odoc','soon:'+t.id+':'+r.final,r.left?'เอกสาร Onsite ถึง Final พรุ่งนี้':'เอกสาร Onsite ถึง Final วันนี้',`${ntfPlan(t)} · Final ${fmtDay(r.final)} · ขาด ${miss}`,ref)});
  if(typeof mrNotices==='function')mrNotices(tasks,add);/* รายงานแผนตอนเช้า (js/features/morning-report.js) */
  for(const [k,c] of clashes)if(ntfMine(c.a)||ntfMine(c.b))add('clash',k,`จัดชน ${fmtDay(c.a.date)}`,`${[c.a.planNo,typeLabel(c.a)].filter(Boolean).join(' ')} ↔ ${[c.b.planNo,typeLabel(c.b)].filter(Boolean).join(' ')} · ${c.what}`,{t:'task',id:c.a.id,date:c.a.date});
  return L;
}

/* ---------- one look: read, compare, remember ---------- */
async function ntfTick(force){
  if(NTF.busy||notReady()||!S.tasksReady)return;ntfLoad();NTF.busy=true;
  try{
    if(force||!NTF.range||Date.now()-NTF.rangeAt>60000){const {from,to}=ntfWin();
      try{NTF.range=await quietly(()=>Store.range('tasks',from,to));NTF.rangeAt=Date.now()}catch(e){if(!NTF.range)return}}
    const tasks=ntfTasks();const snap=NTF.snap||{};const ev=[];const now=new Date().toISOString();
    const add=(cat,id,title,body,ref)=>{if(!NTF.prefs.off.includes(cat))ev.push({id:`${cat}:${id}:${Date.now().toString(36)}`,cat,title,body,ref,at:now})};
    /* plans: GA's answer, status, edits by someone else */
    if(snap.t)for(const t of tasks){const p=snap.t[t.id];if(!p||isLeave(t))continue;const n=tSnap(t);const ref={t:'task',id:t.id,date:t.date};
      if(p.g!==n.g&&ntfMine(t)){const s=typeof gaSummary==='function'?gaSummary(t):'';
        add('ga','car:'+t.id,!p.g?'GA จัดรถให้แล้ว':!n.g?'GA ยกเลิกรถของแผน':'GA เปลี่ยนรถของแผน',`${ntfPlan(t)}${n.g&&s?' · '+s:''}`,ref)}
      if(p.s!==n.s&&ntfMine(t)&&ntfByOther(t.updatedBy)&&!noStatus(t))
        add('plan','st:'+t.id,`แผนงาน${n.s==='done'?'เสร็จแล้ว':n.s==='planned'?'กลับเป็นวางแผน':' '+stTh(n.s)}`,`${ntfPlan(t)}${t.statusNote?' · '+t.statusNote:''}${t.updatedBy?' · โดย '+ntfWho(t.updatedBy):''}`,ref);
      if(p.u!==n.u&&ntfByOther(t.updatedBy)&&ntfMine(t)){const ch=NTF_SIG.filter((_,i)=>p.f&&p.f[i]!==n.f[i]).map(x=>x[1]);
        if(ch.length)add('plan','ed:'+t.id,'แผนงานถูกแก้ไข',`${ntfPlan(t)} · แก้ ${ch.join(', ')}${t.updatedBy?' · โดย '+ntfWho(t.updatedBy):''}`,ref)}}
    /* ใบรับคำร้องขอรับบริการสอบเทียบ */
    if(snap.j&&S.jobsReady)for(const j of S.jobs){const p=snap.j[j.id];const ref={t:'job',id:j.id};const mineJ=(!!ntfMe()&&norm(j.bookedBy)===ntfMe())||ntfMySale(j.sale);
      if(!p){if(j.state==='pending'&&isPlanner()&&ntfByOther(j.bookedBy))add('job','new:'+j.id,'ใบรับคำร้องใหม่ รอ Planner รับงาน',`${j.jobNo} · ${j.customer||''} · Sale ${j.sale||'—'}${j.wantFrom?' · ต้องการ '+fmtDay(j.wantFrom):''}`,ref);continue}
      if(p.s!=='accepted'&&j.state==='accepted'&&mineJ&&ntfByOther(j.acceptedBy))add('job','acc:'+j.id,'Planner รับงานแล้ว · ออก PN',`${j.jobNo} → ${j.planNo||''} · ${j.customer||''}`,ref);
      if(!p.r&&jbNeedsReview(j)&&isPlanner()&&ntfByOther(j.review&&j.review.by))add('job','rev:'+j.id,'Sale แก้ใบรับคำร้องหลังออก PN',`${j.jobNo} · ${j.planNo||''} · โดย ${ntfWho(j.review&&j.review.by)}`,ref);
      if(p.s!=='cancelled'&&j.state==='cancelled'&&(isPlanner()||mineJ)&&ntfByOther(j.cancelledBy))add('job','can:'+j.id,'ใบรับคำร้องถูกยกเลิก',`${j.jobNo} · ${j.customer||''}${j.cancelReason?' · '+j.cancelReason:''}`,ref)}
    /* Check Sheet */
    if(snap.c&&S.checksReady)for(const c of S.checks){const p=snap.c[c.id];const F=CS_FORMS[c.form]||{name:c.form};const ref={t:'check',id:c.id};
      const mineC=!!ntfMe()&&(norm(c.submittedBy)===ntfMe()||norm(c.createdBy)===ntfMe());
      if((!p||p.s!=='submitted')&&c.state==='submitted'&&canApprove(c))add('cs','sub:'+c.id,'Check Sheet ส่งมาให้อนุมัติ',`${F.name} ${c.no} · ส่งโดย ${ntfWho(c.submittedBy)||'—'}`,ref);
      if(p&&p.s!==c.state&&c.state==='approved'&&mineC&&ntfByOther(c.approvedBy))add('cs','ok:'+c.id,'Check Sheet อนุมัติแล้ว',`${F.name} ${c.no} · โดย ${ntfWho(c.approvedBy)}`,ref);
      if(p&&p.s!==c.state&&c.state==='rejected'&&mineC&&ntfByOther(c.rejectedBy))add('cs','rej:'+c.id,'Check Sheet ถูกตีกลับ',`${F.name} ${c.no}${c.rejectReason?' · '+c.rejectReason:''}`,ref)}
    /* NCR */
    if(snap.n&&S.ncrReady)for(const n of S.ncr){const p=snap.n[n.id];const ref={t:'ncr',id:n.id};
      if(!p){if(n.state!=='closed'&&isPlanner()&&ntfByOther(n.createdBy))add('ncr','new:'+n.id,'เปิด NCR ใหม่',`${n.ncrNo} · ${n.customer||''}${n.category?' · '+n.category:''}`,ref);continue}
      if(p.s!=='closed'&&n.state==='closed'&&(isPlanner()||norm(n.createdBy)===ntfMe())&&ntfByOther(n.closedBy))add('ncr','cl:'+n.id,'ปิด NCR แล้ว',`${n.ncrNo} · ${n.customer||''}`,ref)}
    /* live follow-ups + clashes */
    const cl=ntfClashes(tasks);NTF.live=ntfLiveOf(tasks,cl);
    const first=!NTF.snap;const freshLive=first?[]:NTF.live.filter(x=>!NTF.seen.has(x.id));
    NTF.live.forEach(x=>NTF.seen.add(x.id));
    NTF.snap={t:Object.fromEntries(tasks.map(t=>[t.id,tSnap(t)])),
      j:S.jobsReady?Object.fromEntries(S.jobs.map(j=>[j.id,{s:j.state,r:jbNeedsReview(j)?1:0}])):snap.j,
      c:S.checksReady?Object.fromEntries(S.checks.map(c=>[c.id,{s:c.state}])):snap.c,
      n:S.ncrReady?Object.fromEntries(S.ncr.map(n=>[n.id,{s:n.state}])):snap.n};
    if(ev.length)NTF.list=ev.concat(NTF.list).slice(0,150);
    ntfSave();NTF.ready=true;
    ntfAnnounce(ev.concat(freshLive));ntfBadges();
    if(NTF.open)ntfDrawPanel();
    const sig=NTF.live.map(x=>x.id+x.body).join()+'|'+NTF.list.length;/* งานของฉัน redraws only when its lists changed (render() calls ntfSoon) */
    if(sig!==NTF.sig){NTF.sig=sig;if(S.view==='my'&&!document.querySelector('#view :focus'))render()}
  }finally{NTF.busy=false}
}
function ntfSoon(){clearTimeout(NTF.timer);NTF.timer=setTimeout(()=>ntfTick(),1500)}
setInterval(()=>ntfTick(),60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)ntfTick(true)});

/* ---------- counts, pop-ups, browser notifications ---------- */
const ntfUnread=()=>NTF.list.filter(x=>!NTF.read.has(x.id)).length+NTF.live.filter(x=>!NTF.read.has(x.id)).length;
function ntfBadges(){const n=ntfUnread();
  ['#ntfBadge','#ntfBadgeM'].forEach(s=>{const b=$(s);if(b){b.hidden=!n;b.textContent=n>99?'99+':n}});
  const m=$('#myBadge');if(m){const k=NTF.live.length;m.hidden=!k;m.textContent=k>99?'99+':k}
  const mb=$('#myBadgeM');if(mb){const k=NTF.live.length;mb.hidden=!k;mb.textContent=k>99?'99+':k}}
function ntfIcon(cat){const c=NTF_CAT[cat]||NTF_CAT.follow;return `<span class="ntf-ic c-${esc(cat)}" aria-hidden="true"><svg viewBox="0 0 24 24">${c.i}</svg></span>`}
function ntfAnnounce(items){
  if(!items.length)return;
  const box=ntfPopBox();const show=items.slice(0,3);
  show.forEach(x=>{const el=document.createElement('div');el.className='ntf-pop';el.setAttribute('role','status');
    el.innerHTML=`${ntfIcon(x.cat)}<div><b>${esc(x.title)}</b><span>${esc(x.body)}</span></div><button type="button" class="ntf-x" aria-label="ปิด">✕</button>`;
    el.addEventListener('click',e=>{el.remove();if(e.target.closest('.ntf-x'))return;NTF.read.add(x.id);ntfSave();ntfBadges();ntfOpen(x.ref)});
    box.appendChild(el);setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400)},8000)});
  if(items.length>3){const el=document.createElement('div');el.className='ntf-pop more';el.innerHTML=`<div><b>และอีก ${items.length-3} รายการ</b><span>กดเพื่อดูการแจ้งเตือนทั้งหมด</span></div>`;el.addEventListener('click',()=>{el.remove();ntfPanel(true)});box.appendChild(el);setTimeout(()=>el.remove(),8000)}
  /* the system notification: only while this page is in the background, after the person allowed it */
  if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){
    try{const x=items[0];const n=new Notification(items.length>1?`${x.title} (+${items.length-1})`:x.title,{body:x.body,icon:'assets/apple-touch-icon.png',tag:'bu1wp-'+x.id});
      n.onclick=()=>{window.focus();n.close();ntfOpen(x.ref)}}catch(e){}}
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
const ntfRow=x=>`<button type="button" class="ntf-row${NTF.read.has(x.id)?'':' unread'}${x.live?' live':''}" data-ntf="${esc(x.id)}">${ntfIcon(x.cat)}<span class="ntf-t"><b>${esc(x.title)}</b><span>${esc(x.body)}</span>${x.at?`<small>${esc(ntfAgo(x.at))}</small>`:''}</span></button>`;
function ntfPanel(on){
  let p=$('#ntfPanel');
  if(on===false||(on==null&&p&&!p.hidden)){if(p)p.hidden=true;NTF.open=false;document.querySelectorAll('[data-action="ntf"]').forEach(b=>b.setAttribute('aria-expanded','false'));return}
  if(!p){p=document.createElement('section');p.id='ntfPanel';p.className='ntf-panel';p.setAttribute('aria-label','การแจ้งเตือน');document.body.appendChild(p)}
  NTF.open=true;NTF.tab=NTF.tab||'all';NTF.set=false;p.hidden=false;document.querySelectorAll('[data-action="ntf"]').forEach(b=>b.setAttribute('aria-expanded','true'));
  ntfLoad();ntfDrawPanel();ntfPlace();ntfTick();
}
function ntfPlace(){const p=$('#ntfPanel');if(!p||p.hidden)return;
  const b=[...document.querySelectorAll('[data-action="ntf"]')].find(x=>x.offsetParent);const z=(window.uiZoom&&window.uiZoom())||1;
  if(!b||window.innerWidth<=760){p.classList.add('sheet');p.style.left=p.style.top='';return}
  p.classList.remove('sheet');const r=b.getBoundingClientRect();p.style.left=Math.round(r.right/z+8)+'px';p.style.top=Math.round(Math.max(8,r.top/z-6))+'px'}
window.addEventListener('resize',ntfPlace);
function ntfDrawPanel(){
  const p=$('#ntfPanel');if(!p||p.hidden)return;
  const ev=NTF.tab==='unread'?NTF.list.filter(x=>!NTF.read.has(x.id)):NTF.list;const live=NTF.tab==='unread'?NTF.live.filter(x=>!NTF.read.has(x.id)):NTF.live;
  const perm='Notification' in window?Notification.permission:'none';
  p.innerHTML=`<header><b>การแจ้งเตือน</b><span class="grow"></span><button type="button" class="lnk" data-ntf-all>อ่านทั้งหมด</button><button type="button" class="icon-btn sm" data-ntf-set aria-label="ตั้งค่าการแจ้งเตือน" title="ตั้งค่า"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2"/></svg></button><button type="button" class="icon-btn sm" data-ntf-close aria-label="ปิด">✕</button></header>
    ${NTF.set?`<div class="ntf-set"><p>เลือกเรื่องที่ต้องการให้แจ้ง (เก็บในเบราว์เซอร์นี้)</p>${NTF_CATS.map(([k,l])=>`<label><input type="checkbox" data-ntf-cat="${k}"${NTF.prefs.off.includes(k)?'':' checked'}> ${ntfIcon(k)} ${esc(l)}</label>`).join('')}
      <div class="ntf-perm">${perm==='granted'?'✓ แจ้งเตือนบน Windows / มือถือ เปิดอยู่ (เด้งเมื่อหน้านี้เปิดค้างไว้ในแท็บอื่น)':perm==='denied'?'การแจ้งเตือนของเบราว์เซอร์ถูกปิดไว้ · เปิดได้ที่ไอคอนแม่กุญแจหน้าที่อยู่เว็บ':perm==='none'?'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนของระบบ':'<button type="button" class="btn sm primary" data-ntf-perm>เปิดแจ้งเตือนบน Windows / มือถือ</button>'}</div>
      <button type="button" class="btn sm" data-ntf-set>เสร็จ</button></div>`
    :`<div class="seg ntf-tabs" role="tablist"><button type="button" role="tab" data-ntf-tab="all" aria-selected="${NTF.tab!=='unread'}">ทั้งหมด</button><button type="button" role="tab" data-ntf-tab="unread" aria-selected="${NTF.tab==='unread'}">ยังไม่อ่าน ${ntfUnread()?`(${ntfUnread()})`:''}</button></div>
    <div class="ntf-list">${live.length?`<p class="ntf-h">ต้องติดตาม · ${live.length}</p>${live.map(ntfRow).join('')}`:''}
      ${ev.length?`<p class="ntf-h">ล่าสุด</p>${ev.slice(0,60).map(ntfRow).join('')}`:''}
      ${!live.length&&!ev.length?`<p class="ntf-empty">${NTF.ready?'ไม่มีการแจ้งเตือน':'กำลังตรวจข้อมูล…'}<small>เรื่องใหม่ เช่น GA จัดรถ ใบรับคำร้องขอรับบริการสอบเทียบ Check Sheet จะขึ้นที่นี่</small></p>`:''}</div>
    ${perm==='default'?'<button type="button" class="ntf-ask" data-ntf-perm>🔔 เปิดแจ้งเตือนบน Windows / มือถือ เพื่อรู้แม้เปิดหน้าอื่นอยู่</button>':''}
    <footer><button type="button" class="lnk" data-ntf-my>เปิดหน้างานของฉัน ›</button></footer>`}`;
}
document.addEventListener('click',e=>{const t=e.target;
  const r=t.closest('[data-ntf]');if(r){const id=r.dataset.ntf;NTF.read.add(id);ntfSave();ntfBadges();const x=NTF.list.concat(NTF.live).find(y=>y.id===id);if(x)ntfOpen(x.ref);return}
  if(t.closest('[data-ntf-close]')){ntfPanel(false);return}
  if(t.closest('[data-ntf-all]')){NTF.list.concat(NTF.live).forEach(x=>NTF.read.add(x.id));ntfSave();ntfBadges();ntfDrawPanel();return}
  if(t.closest('[data-ntf-set]')){NTF.set=!NTF.set;ntfDrawPanel();return}
  const tb=t.closest('[data-ntf-tab]');if(tb){NTF.tab=tb.dataset.ntfTab;ntfDrawPanel();return}
  if(t.closest('[data-ntf-perm]')){if('Notification' in window)Notification.requestPermission().then(()=>ntfDrawPanel());return}
  if(t.closest('[data-ntf-my]')){ntfPanel(false);goView('my');return}
  if(NTF.open&&!t.closest('#ntfPanel')&&!t.closest('[data-action="ntf"]'))ntfPanel(false);
});
document.addEventListener('change',e=>{const c=e.target.closest&&e.target.closest('[data-ntf-cat]');if(!c)return;const k=c.dataset.ntfCat;
  const off=new Set(NTF.prefs.off);c.checked?off.delete(k):off.add(k);NTF.prefs.off=[...off];ntfSave();ntfTick(true)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&NTF.open)ntfPanel(false)});
