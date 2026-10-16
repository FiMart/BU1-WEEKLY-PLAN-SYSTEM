'use strict';
/* งานของฉัน (user, 15 Oct 2026; chose "หน้า 'งานของฉัน'"): one page with what this account has to do, by its rights —
   ต้องทำตอนนี้ (the live follow-ups of js/features/notify.js: bookings to accept / review, Check Sheets to approve or fix,
   NCR due, plans past their date, documents, GA car, team, Safety cards, clashes) · แผนงานของฉัน (today / tomorrow / 7 days;
   plans I booked, I am the Sale of, or I am in the team of — "ฉันคือพนักงาน" links this browser to a staff member; the Planner
   can show every plan) · ใบรับคำร้องขอรับบริการสอบเทียบ · Check Sheet ของฉัน · การแจ้งเตือนล่าสุด. */
S.my={day:'today',all:null};
function myStaffPick(){const cur=ntfMeStaff();
  return `<label class="my-who"><span>ฉันคือพนักงาน</span><select data-my-staff aria-label="ฉันคือพนักงานคนไหน"><option value="">— ไม่ระบุ —</option>${S.staff.filter(s=>s.active!==false||s.id===cur).slice().sort(sortPeople).map(s=>`<option value="${esc(s.id)}"${s.id===cur?' selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`}
function myPlanRow(t){
  const st=STATUS[t.status]||STATUS.planned;const d=parseD(t.date);const ppl=(t.staffIds||[]).map(staffName);
  return `<button type="button" class="my-plan" data-edit="${esc(t.id)}" style="--pc:${planColor(t)}">
    <span class="my-date"><small>${TH_DAY[d.getDay()]}</small><b>${d.getDate()}</b><small>${esc(TH_MON[d.getMonth()])}</small></span>
    <span class="my-pt"><b>${esc([t.planNo,typeLabel(t)].filter(Boolean).join(' · '))}</b>
      <span>${esc([t.customer,t.location].filter(Boolean).join(' · ')||'—')} · ${esc(pName(t))}${t.timeNote?' · '+esc(t.timeNote):''}</span>
      <span class="my-chips">${noStatus(t)?'':`<span class="badge" style="--c:${st.color}"><i></i>${esc(st.th)}</span>`}${transportChip(t.transport,t)||''}${ppl.length?`<span class="my-ppl">👷 ${esc(ppl.slice(0,4).join(', '))}${ppl.length>4?` +${ppl.length-4}`:''}</span>`:''}</span></span></button>`;
}
function renderMy(){
  if(notReady())return loading('dash');
  const tasks=ntfTasks().filter(t=>!isLeave(t));const td=ymd(new Date());
  const range={today:[td,td],tomorrow:[ymd(addDays(new Date(),1)),ymd(addDays(new Date(),1))],week:[td,ymd(addDays(new Date(),6))]}[S.my.day]||[td,td];
  const all=S.my.all==null?isPlanner():S.my.all;
  const plans=tasks.filter(t=>t.date>=range[0]&&t.date<=range[1]&&(all||ntfMyPlan(t))).sort((a,b)=>a.date.localeCompare(b.date)||byTime(a,b));
  const live=NTF.live;const name=S.account&&S.account.name||(S.me?String(S.me).split('@')[0]:'');
  const me=ntfMe();
  const myJobs=canBook()||isPlanner()?S.jobs.filter(j=>j.state!=='cancelled'&&((me&&norm(j.bookedBy)===me)||ntfMySale(j.sale))).sort((a,b)=>String(b.bookedAt).localeCompare(String(a.bookedAt))).slice(0,8):[];
  const waitJobs=isPlanner()?S.jobs.filter(j=>j.state==='pending'||jbNeedsReview(j)):[];
  const myCs=me?S.checks.filter(c=>c.state!=='approved'&&(norm(c.createdBy)===me||norm(c.submittedBy)===me)).slice(0,8):[];
  const jobRow=j=>{const f=jobFlow(j);return `<button type="button" class="my-row" data-job-open="${esc(j.id)}"><span class="my-pt"><b>${esc(j.jobNo)}${j.planNo?' · '+esc(j.planNo):''}</b><span>${esc(j.customer||'—')}${j.sale?' · Sale '+esc(j.sale):''}${j.wantFrom?' · ต้องการ '+esc(fmtDay(j.wantFrom)):''}</span></span>${f?flowChip(f):''}<span class="badge">${esc((JB_STATE[j.state]||{}).th||j.state)}</span></button>`};
  const csRow=c=>`<button type="button" class="my-row" data-cs-open="${esc(c.id)}"><span class="my-pt"><b>${esc(c.no)} · ${esc((CS_FORMS[c.form]||{}).name||'')}</b><span>${esc(c.title||c.planNo||'')}</span></span>${(()=>{const st=CS_STATE[c.state]||CS_STATE.draft;const [n,t]=csProgress(c);return `<span class="badge" style="--c:${st.c}"><i></i>${esc(st.th)} ${n}/${t}</span>`})()}</button>`;
  const dayTab=(k,l)=>`<button type="button" role="tab" data-my-day="${k}" aria-selected="${S.my.day===k}">${l}</button>`;
  return `<section class="panel my-hero"><div><b>${name?`สวัสดี ${esc(name)}`:'งานของฉัน'}</b><span>${esc(roleInfo().label)}${isPlanner()?' · เห็นทุกแผนและใบรับคำร้องที่รอ':''}</span></div>${myStaffPick()}
      <div class="my-quick">${canBook()?'<button type="button" class="btn" data-job-new>+ ใบรับคำร้องใหม่</button>':''}<button type="button" class="btn" data-action="quick">ค้นหา</button></div></section>
    <section class="panel"><h2 class="my-h">ต้องทำตอนนี้ <span class="md-count">${live.length}</span></h2>
      ${live.length?`<div class="my-live">${live.map(ntfRow).join('')}</div>`:`<p class="my-ok">✓ ไม่มีงานค้างที่ต้องตาม${NTF.ready?'':' (กำลังตรวจข้อมูล…)'}</p>`}</section>
    <section class="panel"><div class="my-bar"><h2 class="my-h">แผนงาน${all?'ทั้งหมด':'ของฉัน'} <span class="md-count">${plans.length}</span></h2><span class="grow"></span>
      <div class="seg my-seg" role="tablist" aria-label="ช่วงวัน">${dayTab('today','วันนี้')}${dayTab('tomorrow','พรุ่งนี้')}${dayTab('week','7 วันข้างหน้า')}</div>
      <label class="my-all"><input type="checkbox" data-my-all${all?' checked':''}> ทุกแผน</label></div>
      ${plans.length?`<div class="my-plans">${plans.map(myPlanRow).join('')}</div>`:`<p class="my-ok">ไม่มีแผน${all?'':'ของคุณ'}ในช่วงนี้${!all&&!ntfMeStaff()?' · เลือก "ฉันคือพนักงาน" ด้านบนเพื่อเห็นแผนที่คุณอยู่ในทีม':''}</p>`}</section>
    ${waitJobs.length?`<section class="panel"><h2 class="my-h">ใบรับคำร้องรอ Planner <span class="md-count">${waitJobs.length}</span></h2><div class="my-rows">${waitJobs.map(jobRow).join('')}</div></section>`:''}
    ${myJobs.length?`<section class="panel"><h2 class="my-h">ใบรับคำร้องของฉัน</h2><div class="my-rows">${myJobs.map(jobRow).join('')}</div></section>`:''}
    ${myCs.length?`<section class="panel"><h2 class="my-h">Check Sheet ของฉันที่ยังไม่อนุมัติ</h2><div class="my-rows">${myCs.map(csRow).join('')}</div></section>`:''}
    <section class="panel"><div class="my-bar"><h2 class="my-h">การแจ้งเตือนล่าสุด</h2><span class="grow"></span><button type="button" class="btn sm" data-action="ntf">เปิดทั้งหมด</button></div>
      ${NTF.list.length?`<div class="my-live">${NTF.list.slice(0,6).map(ntfRow).join('')}</div>`:'<p class="my-ok">ยังไม่มีการแจ้งเตือน · เรื่องใหม่ เช่น GA จัดรถให้แผน ใบรับคำร้องขอรับบริการสอบเทียบ Check Sheet จะขึ้นที่นี่และที่กระดิ่ง</p>'}</section>`;
}
document.addEventListener('click',e=>{const t=e.target;
  const d=t.closest('[data-my-day]');if(d){S.my.day=d.dataset.myDay;render();return}
});
document.addEventListener('change',e=>{const t=e.target;
  if(t.matches&&t.matches('[data-my-all]')){S.my.all=t.checked;render();return}
  if(t.matches&&t.matches('[data-my-staff]')){try{t.value?localStorage.setItem('bu1wp.meStaff',t.value):localStorage.removeItem('bu1wp.meStaff')}catch(e){}
    toast(t.value?`ตั้งเป็น ${staffName(t.value)} แล้ว · แผนที่คุณอยู่ในทีมจะแสดงและแจ้งเตือน`:'ไม่ระบุพนักงานแล้ว');NTF.sig='';render();ntfTick(true)}
});
