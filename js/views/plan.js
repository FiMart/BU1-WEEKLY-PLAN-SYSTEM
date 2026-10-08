'use strict';
/* BU1 Weekly Plan · Weekly Plan board: rows (job type or customer) x days */
/* ---------- view: week board, rows (job type or customer) × days ---------- */
const NO_CUST='(ไม่ระบุลูกค้า)';
const custKey=t=>String(t.customer||'').trim()||NO_CUST;
function planGroups(list){
  if(S.pf.by==='cust'){
    const m=new Map();list.forEach(t=>{const k=custKey(t);if(!m.has(k))m.set(k,[]);m.get(k).push(t)});
    return [...m].sort((a,b)=>(a[0]===NO_CUST)-(b[0]===NO_CUST)||b[1].length-a[1].length||a[0].localeCompare(b[0],'th'))
      .map(([k,l])=>({key:'c:'+k,label:k,color:'#1462d0',tasks:l,preset:{customer:k===NO_CUST?'':k}}));
  }
  /* job types in their set order, but ลา (leave) always as the last row */
  const out=[];const seen=new Set();let leave=null;
  for(const ty of jobTypes()){seen.add(ty.id);const l=list.filter(t=>typeIdOf(t)===ty.id);if(!l.length)continue;
    const g={key:'t:'+ty.id,label:ty.name,color:ty.color,tasks:l,preset:{type:ty.id}};if(ty.id==='leave')leave=g;else out.push(g)}
  const rest=list.filter(t=>!seen.has(typeIdOf(t)));if(rest.length)out.push({key:'t:__x',label:'ประเภทที่ถูกลบแล้ว',color:'#8a979c',tasks:rest,preset:{}});
  if(leave)out.push(leave);
  return out;
}
const planMatch=t=>{const q=norm(S.pf.q);return lineMatch(t)&&(!S.pf.staff||(t.staffIds||[]).includes(S.pf.staff))&&(!q||norm(searchText(t)).includes(q))};
let gchipHtml='';
function renderChips(){
  let html='';
  if(S.view==='plan'&&!notReady()){
    const groups=planGroups(S.tasks.filter(planMatch));
    S.pf.groups=S.pf.groups.filter(k=>groups.some(g=>g.key===k));
    if(groups.length>1)html=`<button type="button" class="gchip all" data-gchip="" aria-pressed="${!S.pf.groups.length}">ทั้งหมด<b>${groups.reduce((a,g)=>a+g.tasks.length,0)}</b></button>`
      +groups.map(g=>`<button type="button" class="gchip" data-gchip="${esc(g.key)}" style="--c:${safeColor(g.color)}" aria-pressed="${S.pf.groups.includes(g.key)}">${esc(g.label)}<b>${g.tasks.length}</b></button>`).join('');
  }
  if(html!==gchipHtml){$('#gchips').innerHTML=html;gchipHtml=html}
}
function renderActions(){
  const plan=S.view==='plan',ready=!notReady();
  $('#copyMenu').hidden=!plan||!ready;if(!plan)$('#copyMenu').open=false;
  $('#btnShot').hidden=!plan||!ready||!downloads;
  $('#btnPrint').hidden=$('#btnXlsx').hidden=!(plan||S.view==='people')||!ready||!downloads;
}
const CLIP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 11.5-8.3 8.3a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.4 8.4a1.8 1.8 0 0 1-2.6-2.6l7.7-7.7"/></svg>';
const CAR_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 16.5V11l2-4.2A2 2 0 0 1 7.3 5.5h7.9a2 2 0 0 1 1.7 1L19.5 11h.5a1 1 0 0 1 1 1v4.5"/><path d="M3.5 11h16"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>';
function transportChip(v,t){
  const note=t?gaNoteText(t):'';
  if(t&&t.selfDrive){const tip=[ownCarText(t),gaTimes(t),gaInfo(t)?gaInfo(t).map(([k,x])=>k+": "+x).join(" · "):"รอ GA ระบุรถ",note].filter(Boolean).join(" · ");
    return `<span class="tchip ${gaInfo(t)?"gaok":"gawait"}" title="${esc(tip)}">${CAR_ICON}ขอรถไปเอง · ${gaInfo(t)?esc(gaSummary(t)):"รอ GA"}</span>`}
  if(t&&gaInfo(t))return `<span class="tchip gaok" title="${esc([gaInfo(t).map(([k,x])=>k+": "+x).join(" · "),gaTimes(t),note].filter(Boolean).join(" · "))}">${CAR_ICON}รถ GA · ${esc(gaSummary(t))}</span>`;
  if(t&&gaWaiting(t))return `<span class="tchip gawait${t.gaUrgent?' urgent':''}" title="${esc(['ขอรถ GA แล้ว GA จะระบุรถและทะเบียนให้ภายหลัง',gaTimes(t),note].filter(Boolean).join(' · '))}">${CAR_ICON}รถ GA · ${t.gaUrgent?'ด่วน · ':''}รอทะเบียน${t.gaGo?' · ออก '+esc(t.gaGo):''}</span>`;
  if(!v||v==='ไม่ใช้รถ')return '';
  const cls=v==='GA'?'ga':v==='รถลูกค้า'?'cust':OWN_CAR.includes(v)?'own':'car';
  return `<span class="tchip ${cls}"${cls==='own'&&t&&ownCarText(t)?` title="${esc(ownCarText(t))}"`:''}>${CAR_ICON}${v==='GA'?'รถ GA':v==='รถลูกค้า'?v:cls==='own'?'รถส่วนตัว':'รถ '+esc(v)}${t&&t.needGA&&cls==='car'?' · GA':''}</span>`;
}
function wcard(t,conf,i){
  const ty=typeOf(t);const c=conf.get(t.id);const late=isLate(t);
  const confStaff=new Set((c||[]).flatMap(x=>x.staff));
  const sub=[t.planNo?typeLabel(t):'',t.timeNote].filter(Boolean).join(' · ');
  const det=headline(t);const ch=transportChip(t.transport,t);
  /* compact card (user, 8 Oct 2026): customer and location on one line */
  const where=[t.customer&&S.pf.by!=='cust'?esc(t.customer):'',t.location?`<b>${esc(t.location)}</b>`:''].filter(Boolean).join(' · ');
  return `<button type="button" class="wc st-${esc(t.status||'planned')}${c?' has-conf':''}${isLeave(t)?' is-leave':''}${flashIds.has(t.id)?' flash':''}" style="--c:${safeColor(ty.color)};--i:${Math.min(i||0,60)}" data-edit="${esc(t.id)}">
    <span class="wc-top">${lineTag(t)}<span class="wc-title" title="${esc(t.planNo||typeLabel(t))}">${esc(t.planNo||typeLabel(t))}</span>${(t.photoIds||[]).length?`<span class="pcount" title="มีรูป ${t.photoIds.length} รูป">${CAM_ICON}${t.photoIds.length}</span>`:''}${(t.files||[]).length?`<span class="pcount" title="มีไฟล์แนบ ${t.files.length} ไฟล์">${CLIP_ICON}${t.files.length}</span>`:''}${docChip(t)}${calChip(t)}${insChip(t)}${prepChip(t)}<i class="wc-dot s-${esc(t.status||'planned')}" title="${esc(stTh(t.status))}"></i></span>
    <span class="wc-sub"><span class="wc-per">${esc(pName(t))}</span>${esc(sub)}</span>
    ${where?`<span class="wc-where" title="${esc([t.customer,t.location].filter(Boolean).join(' · '))}">${where}</span>`:''}
    ${det?`<span class="wc-det">${esc(det)}</span>`:''}
    ${ch?`<span class="wc-chips">${ch}</span>`:''}
    <span class="wc-pp">${(t.staffIds||[]).map(id=>`<span class="pp${confStaff.has(id)?' conf':''}" title="${esc(staffName(id))}">${esc(staffName(id))}</span>`).join('')}${(t.guests||[]).map(g=>`<span class="pp guest" title="${esc(g)} (แผนกอื่น)">${esc(g)}</span>`).join('')}${!(t.staffIds||[]).length&&!(t.guests||[]).length&&!isLeave(t)?'<span class="pp noteam">ยังไม่จัดคน</span>':''}</span>
    ${NEEDS_REASON.has(t.status)?`<span class="chip-flag${t.status==='postponed'?' late':''}">${statusFlag(t.status)}${t.status==='notdone'&&ncrOfTask(t)?' · '+esc(ncrOfTask(t).ncrNo):''}${t.statusNote?': '+esc(t.statusNote):''}</span>`:''}
    ${c?`<span class="chip-flag">⚠ ${esc(confLabel(c))}</span>`:''}
    ${late&&!c?`<span class="chip-flag late">⏱ เลยวันแล้ว ยังไม่ปิดงาน</span>`:''}
  </button>`;
}
/* who is free on a day: no working plan at all (ทั้งวัน), or only one half taken; full-day leave is not free */
function availOn(k){
  const work=S.tasks.filter(t=>t.date===k&&isWorking(t));const out={full:[],am:[],pm:[],leave:0};
  for(const s of S.staff.filter(s=>s.active!==false&&inTeam(s)).sort(sortPeople)){/* the open ทีม only */
    const mine=work.filter(t=>(t.staffIds||[]).includes(s.id));
    const am=mine.some(t=>pA(t)===0),pm=mine.some(t=>pB(t)===1);
    if(am&&pm){if(mine.some(t=>isLeave(t)&&periodOf(t)==='full'))out.leave++;continue}
    out[!am&&!pm?'full':!am?'am':'pm'].push(s);
  }
  return out;
}
/* ผู้ปฏิบัติงานที่ว่าง (Available): a panel below the board, one column per day, people grouped by ตำแหน่ง,
   every name in full; half-day free people carry a ว่างเช้า / ว่างบ่าย tag; a name opens a new plan for that person */
const PERSON_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.7 3.6-5.8 7-5.8s6.2 2.1 7 5.8"/></svg>';
function availDay(d,a,today){
  const k=ymd(d);const hol=holidayOf(k);const we=isOffDay(d);const order=positions();
  const per=new Map([...a.full.map(s=>[s.id,'full']),...a.am.map(s=>[s.id,'am']),...a.pm.map(s=>[s.id,'pm'])]);
  const people=[...a.full,...a.am,...a.pm];
  let h=`<div class="avp-day${we?' we':''}${k===today?' td':''}"><div class="avp-head" title="ว่างทั้งวัน ${a.full.length} · ว่างเช้า ${a.am.length} · ว่างบ่าย ${a.pm.length}${a.leave?` · ลา ${a.leave}`:''}"><b>${EN_DAY[d.getDay()]}</b><span>${d.getDate()}</span>${hol?`<em class="hol" title="${esc(hol)}">${esc(hol)}</em>`:we?'<em>วันหยุด</em>':''}${k===today?'<em class="td">วันนี้</em>':''}<i>${people.length} ว่าง</i></div>`;
  if(!people.length)h+='<p class="avp-none">ไม่มีคนว่าง</p>';
  for(const [role,list] of roleGroups(people)){
    const ci=order.indexOf(roleOfKey(role));const color=POS_COLORS[(ci>=0?ci:order.length)%POS_COLORS.length];
    h+=`<div class="avp-grp" style="--pc:${color}"><p>${esc(role)}</p>${list.map(s=>{const p=per.get(s.id);const tag=p==='am'?'ว่างเช้า':p==='pm'?'ว่างบ่าย':'';
      const inner=`<span class="avatar xs" aria-hidden="true">${esc(initialOf(s.name))}</span><span class="avp-name">${esc(s.name)}</span>${tag?`<small>${tag}</small>`:''}`;
      return S.canWrite?`<button type="button" class="avp-row" data-action="add" data-date="${k}" data-staff="${esc(s.id)}" data-period="${p}" title="ลงแผนให้ ${esc(s.name)} · วัน${TH_DAY_FULL[d.getDay()]} ${esc(fmtShort(d))}${tag?' · '+tag:''}">${inner}</button>`
        :`<div class="avp-row">${inner}</div>`}).join('')}</div>`;
  }
  if(a.leave)h+=`<p class="avp-leave">ลาทั้งวัน ${a.leave} คน</p>`;
  return h+'</div>';
}
/* week view: a table laid out like the board above it (the same 140 px label column and seven equal day columns),
   rows = ตำแหน่ง, cells = the people of that position who are free that day (user, 6 Oct 2026: "สมส่วนกับหน้าเว็บ") */
function availTable(days,avail,today){
  const order=positions();const color=role=>{const ci=order.indexOf(roleOfKey(role));return POS_COLORS[(ci>=0?ci:order.length)%POS_COLORS.length]};
  const union=new Map();avail.forEach(a=>[...a.full,...a.am,...a.pm].forEach(s=>union.set(s.id,s)));
  const roles=[...roleGroups([...union.values()]).keys()];
  const byDay=avail.map(a=>({g:roleGroups([...a.full,...a.am,...a.pm]),per:new Map([...a.full.map(s=>[s.id,'full']),...a.am.map(s=>[s.id,'am']),...a.pm.map(s=>[s.id,'pm'])])}));
  const team=role=>S.staff.filter(s=>s.active!==false&&inTeam(s)&&groupKey(s)===role).length;
  const cls=d=>{const k=ymd(d);return `${isOffDay(d)?'wkend':''}${k===today?' is-today':''}`};
  const head=days.map((d,i)=>{const k=ymd(d);const a=avail[i];const hol=holidayOf(k);const n=a.full.length+a.am.length+a.pm.length;
    return `<th class="${cls(d)}" title="ว่างทั้งวัน ${a.full.length} · ว่างเช้า ${a.am.length} · ว่างบ่าย ${a.pm.length}${a.leave?` · ลา ${a.leave}`:''}"><b>${EN_DAY[d.getDay()]}</b><span>${fmtShort(d)}${k===today?' · วันนี้':''}</span>${hol?`<span class="hol" title="${esc(hol)}">${esc(hol)}</span>`:''}<i class="${n?'':'zero'}">${n} ว่าง${a.am.length+a.pm.length?` <small>ครึ่งวัน ${a.am.length+a.pm.length}</small>`:''}</i></th>`}).join('');
  const row=role=>`<tr style="--pc:${color(role)}"><th scope="row" class="avp-role"><b>${esc(role)}</b><small>${team(role)} คน</small></th>${days.map((d,i)=>{const k=ymd(d);const list=byDay[i].g.get(role)||[];
    return `<td class="${cls(d)}">${list.length?list.map(s=>{const p=byDay[i].per.get(s.id);const tag=p==='am'?'ว่างเช้า':p==='pm'?'ว่างบ่าย':'';
      const inner=`<span class="avatar xs" aria-hidden="true">${esc(initialOf(s.name))}</span><span class="avp-name">${esc(s.name)}${tag?`<small>${tag}</small>`:''}</span>`;
      return S.canWrite?`<button type="button" class="avp-row" data-action="add" data-date="${k}" data-staff="${esc(s.id)}" data-period="${p}" title="ลงแผนให้ ${esc(s.name)} · วัน${TH_DAY_FULL[d.getDay()]} ${esc(fmtShort(d))}${tag?' · '+tag:''}">${inner}</button>`:`<div class="avp-row">${inner}</div>`}).join(''):'<span class="avp-dash" aria-label="ไม่มีคนว่าง">–</span>'}</td>`}).join('')}</tr>`;
  const leave=avail.some(a=>a.leave)?`<tr class="avp-lv"><th scope="row" class="avp-role"><b>ลาทั้งวัน</b></th>${days.map((d,i)=>`<td class="${cls(d)}">${avail[i].leave?`${avail[i].leave} คน`:''}</td>`).join('')}</tr>`:'';
  return `<div class="avp-scroll"><table class="avp-tbl"><colgroup><col class="c-g">${days.map(()=>'<col>').join('')}</colgroup>
    <thead><tr><th class="corner">ตำแหน่ง \\ วัน</th>${head}</tr></thead>
    <tbody>${roles.length?roles.map(row).join(''):`<tr><td colspan="${days.length+1}" class="avp-none">ไม่มีคนว่างในสัปดาห์นี้</td></tr>`}${leave}</tbody></table></div>`;
}
function availPanel(days,avail,today){
  const week=days.length>1;
  return `<section class="avp${week?' wk':''}" aria-label="ผู้ปฏิบัติงานที่ว่าง"><header class="avp-top">${PERSON_ICON}<div><h2>ผู้ปฏิบัติงานที่ว่าง (Available)</h2><p>คนที่ยังไม่ถูกจัดงานในแต่ละวัน — ใช้มอบหมายงานเพิ่ม${S.canWrite?' · กดชื่อเพื่อลงแผนให้คนนั้น':''}</p></div></header>
    ${week?availTable(days,avail,today):`<div class="avp-scroll"><div class="avp-grid" style="--n:${days.length}">${days.map((d,i)=>availDay(d,avail[i],today)).join('')}</div></div>`}</section>`;
}
function renderPlan(){
  if(notReady())return loading('plan');
  const avail=Array.from({length:7},(_,i)=>availOn(ymd(addDays(S.week,i))));const showAv=S.showAvail&&S.staff.some(s=>s.active!==false);
  const days=Array.from({length:7},(_,i)=>addDays(S.week,i));const today=ymd(new Date());const conf=allConflicts();
  const base=S.tasks.filter(planMatch);const groups=planGroups(base);
  const shown=S.pf.groups.length?groups.filter(g=>S.pf.groups.includes(g.key)):groups;
  /* counts follow the open สายงาน tab (LT); who is free and clashes stay across both lines (one team) */
  const LT=S.tasks.filter(lineMatch);
  const work=LT.filter(t=>isWorking(t)&&!isLeave(t));const cnt=s=>work.filter(t=>(t.status||'planned')===s).length;
  const confN=LT.filter(t=>conf.has(t.id)).length;
  const last=days[6];const isThis=ymd(S.week)===ymd(mondayOf(new Date()));
  let ci=0;
  let h=S.staff.length?'':`<div class="banner warn"><b>ยังไม่มีรายชื่อพนักงาน</b> เพิ่มรายชื่อก่อนเพื่อเลือก Team Service ในแผน <button type="button" class="lnk" data-go="settings">ไปที่จัดการข้อมูล</button></div>`;
  h+=`<section class="wp-panel" aria-label="แผนงานสัปดาห์ ${esc(weekName(S.week))}${scopeName()?' · '+esc(scopeName()):''}"><header class="wp-head">
    <div class="wp-brand">BU1 · Weekly Planning${S.line?`<span class="wp-line" style="--lc:${LINE[S.line].color}">${esc(lineName())}</span>`:''}${S.team?`<span class="wp-line" style="--lc:${TEAM[S.team].color}">${esc(teamName(S.team))}</span>`:''}</div>
    <div class="wp-nav"><button type="button" class="icon-btn" data-action="prev" aria-label="สัปดาห์ก่อน">‹</button>
      <div class="wp-wk"><b>${fmtShort(S.week)} – ${fmtShort(last)} ${last.getFullYear()}</b><span>สัปดาห์ที่ ${isoWeek(S.week)} · ${esc(weekName(S.week))} · ${isThis?'สัปดาห์นี้':'<button type="button" class="lnk" data-action="thisweek">กลับสัปดาห์นี้</button>'}</span></div>
      <button type="button" class="icon-btn" data-action="next" aria-label="สัปดาห์ถัดไป">›</button>
      <label class="wp-jump" title="สร้าง / ไปสัปดาห์ของวันที่เลือก"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><input type="date" id="wkJump2" value="${ymd(S.week)}" aria-label="สร้าง / ไปสัปดาห์ของวันที่เลือก"></label></div>
    <div class="wp-legend">${[['planned','var(--muted)','วางแผน'],['done','var(--good)','เสร็จ'],['postponed','var(--warn)','เลื่อน'],['notdone','var(--crit)','ไม่เสร็จ']].filter(([s])=>s!=='notdone'||cnt(s)).map(([s,c,l])=>`<span><i style="background:${c}"></i>${l} <b data-n="${cnt(s)}">${cnt(s)}</b></span>`).join('')}${confN?`<span class="alert">⚠ จัดชน <b data-n="${confN}">${confN}</b></span>`:''}</div>
  </header>`;
  const total=LT.length;const vis=shown.reduce((a,g)=>a+g.tasks.length,0);
  $('#pf-count').textContent=vis!==total?`แสดง ${vis} จาก ${total} แผน`:`${total} แผน`;
  if(planDayMode()){const i=days.findIndex(d=>ymd(d)===planDay());
    return h+planDayHtml({days,today,conf,shown,avail,showAv})+'</section>'+calWeekHtml()+insWeekHtml()+(showAv?availPanel([days[i]],[avail[i]],today):'')}
  h+=`<div class="scroll-x wp-scroll"><table class="wp"><colgroup><col class="c-g">${days.map(()=>'<col>').join('')}</colgroup><thead><tr><th class="corner">${S.pf.by==='cust'?'ลูกค้า':'หัวข้องาน'} \\ วัน</th>`;
  days.forEach((d,i)=>{const k=ymd(d);const n=LT.filter(t=>t.date===k).length;const we=isOffDay(d);const hol=holidayOf(k);const a=avail[i];
    h+=`<th class="${we?'wkend':''}${k===today?' is-today':''}"><b>${EN_DAY[d.getDay()]}</b><span>${fmtShort(d)}${k===today?' · วันนี้':''}</span>${hol?`<span class="hol" title="${esc(hol)}">${esc(hol)}</span>`:''}<span class="cap${n>MAX_CARDS?' over':n===MAX_CARDS?' full':''}" title="แผนของวันนี้ ${n} จาก ${MAX_CARDS} แผน">${n}/${MAX_CARDS}</span>${S.staff.length?`<span class="dfree" title="ว่างทั้งวัน ${a.full.length} · ว่างเช้า ${a.am.length} · ว่างบ่าย ${a.pm.length}">ว่าง ${a.full.length} คน${a.am.length+a.pm.length?` · ครึ่งวัน ${a.am.length+a.pm.length}`:''}</span>`:''}</th>`});
  h+='</tr></thead><tbody>';
  if(!shown.length)h+=`<tr class="no-rows"><td colspan="8">${LT.length?'ไม่มีแผนงานที่ตรงกับตัวกรอง':S.line?`ยังไม่มีแผนงาน ${esc(lineName())} ในสัปดาห์นี้`:'ยังไม่มีแผนในสัปดาห์นี้'}${S.canWrite?' · <button type="button" class="lnk" data-action="add">+ เพิ่มแผนงาน</button>':''}</td></tr>`;
  for(const g of shown){
    h+=`<tr><th class="gh" scope="row" style="--c:${safeColor(g.color)}"><span class="gh-name"><i></i>${esc(g.label)}</span><span class="gh-sub">${g.tasks.length} แผน</span></th>`;
    for(const d of days){const k=ymd(d);const list=g.tasks.filter(t=>t.date===k).sort(byTime);const we=isOffDay(d);
      h+=`<td class="${we?'wkend':''}${k===today?' is-today':''}"><div class="wcell">${list.map(t=>wcard(t,conf,ci++)).join('')}${S.canWrite?`<button type="button" class="wadd" data-action="add" data-date="${k}"${g.preset.type?` data-type="${esc(g.preset.type)}"`:''}${g.preset.customer!=null?` data-cust="${esc(g.preset.customer)}"`:''} aria-label="เพิ่มแผน ${esc(g.label)} วัน${TH_DAY_FULL[d.getDay()]}">+ เพิ่ม</button>`:''}</div></td>`}
    h+='</tr>';
  }
  h+='</tbody></table></div></section>';
  /* Flow Meter: the week's "Weekly plan calibration" sheet, then ผู้ปฏิบัติงานที่ว่าง below the board */
  h+=calWeekHtml()+insWeekHtml();
  if(showAv)h+=availPanel(days,avail,today);
  return h;
}

/* ---------- daily plan view: one day at a time, the default on tablet and phone (≤1180px) ---------- */
/* phones (≤760px) are locked to the daily view; tablets default to it and can switch; desktops default to the week */
const isPhoneW=()=>window.innerWidth<=760;
const planDayMode=()=>isPhoneW()||(S.pmode?S.pmode==='day':window.innerWidth<=1180);
/* the chosen day, kept inside the open week: today when it is in the week, otherwise Monday */
function planDay(){
  const from=ymd(S.week),to=ymd(addDays(S.week,6));
  if(!S.pday||S.pday<from||S.pday>to){const t=ymd(new Date());S.pday=t>=from&&t<=to?t:from}
  return S.pday;
}
/* shared by the daily views (plan, people, projects): a row of day buttons and the chosen day's heading.
   badge(k) returns [text, class, label]; attr is the data attribute the click handler reads; act names the ‹ › actions. */
function dayStrip(days,sel,badge,attr,scroll){
  const today=ymd(new Date());
  return `<div class="pd-strip${scroll?' scroll':''}" role="tablist" aria-label="เลือกวัน">${days.map(x=>{const xk=ymd(x);const [bt,bc,bl]=badge(xk);const we=isOffDay(x);const xh=holidayOf(xk);
    return `<button type="button" role="tab" class="pd-day${xk===sel?' on':''}${xk===today?' td':''}${we?' we':''}${xh?' hol':''}" data-${attr}="${xk}" aria-selected="${xk===sel}"${xh?` title="${esc(xh)}"`:''} aria-label="${esc(TH_DAY_FULL[x.getDay()]+' '+fmtShort(x)+(xh?' · '+xh:'')+(bl?' · '+bl:''))}"><small>${xk===today?'วันนี้':TH_DAY[x.getDay()]}</small><b>${x.getDate()}</b><span class="pd-n${bc?' '+bc:''}">${bt}</span></button>`}).join('')}</div>`;
}
function pdHead(d,sub,act){
  const k=ymd(d);const hol=holidayOf(k);
  return `<div class="pd-head"><button type="button" class="icon-btn" data-action="${act}-prev" aria-label="วันก่อน">‹</button>
    <div class="pd-title"><b>วัน${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)}${k===ymd(new Date())?' · วันนี้':''}</b>${hol?`<em class="pd-hol">วันหยุด · ${esc(hol)}</em>`:''}<span>${sub}</span></div>
    <button type="button" class="icon-btn" data-action="${act}-next" aria-label="วันถัดไป">›</button></div>`;
}
function planDayHtml({days,today,conf,shown,avail,showAv}){
  const k=planDay();const idx=days.findIndex(d=>ymd(d)===k);const d=days[idx];const a=avail[idx];
  const LT=S.tasks.filter(lineMatch);const n=LT.filter(t=>t.date===k).length;
  let h=dayStrip(days,k,xk=>{const xn=LT.filter(t=>t.date===xk).length;return [xn,xn>MAX_CARDS?'over':!xn?'zero':'',`${xn} แผน`]},'pday');
  h+=pdHead(d,`<span class="cap${n>MAX_CARDS?' over':n===MAX_CARDS?' full':''}">${n}/${MAX_CARDS}</span> แผน${S.staff.length?` · ว่าง ${a.full.length} คน${a.am.length+a.pm.length?` · ครึ่งวัน ${a.am.length+a.pm.length}`:''}`:''}`,'pday')+'<div class="pd-body" data-swipe="pday">';
  const groups=shown.map(g=>({g,list:g.tasks.filter(t=>t.date===k).sort(byTime)})).filter(x=>x.list.length);
  if(!groups.length)h+=`<div class="pd-empty">${n?'ไม่มีแผนงานที่ตรงกับตัวกรองในวันนี้':S.line?`ยังไม่มีแผนงาน ${esc(lineName())} ในวันนี้`:'ยังไม่มีแผนในวันนี้'}</div>`;
  let ci=0;
  for(const {g,list} of groups){
    const add=S.canWrite?`<button type="button" class="btn sm pd-add" data-action="add" data-date="${k}"${g.preset.type?` data-type="${esc(g.preset.type)}"`:''}${g.preset.customer!=null?` data-cust="${esc(g.preset.customer)}"`:''} aria-label="เพิ่มแผน ${esc(g.label)}">+ เพิ่ม</button>`:'';
    h+=`<section class="pd-grp" style="--c:${safeColor(g.color)}"><h3><i></i>${esc(g.label)}<span class="pd-cnt">${list.length} แผน</span>${add}</h3><div class="pd-cards">${list.map(t=>wcard(t,conf,ci++)).join('')}</div></section>`;
  }
  if(S.canWrite)h+=`<button type="button" class="btn pd-addday" data-action="add" data-date="${k}">+ เพิ่มแผนงานวัน${TH_DAY_FULL[d.getDay()]}</button>`;
  return h+'</div>';
}
/* in auto mode, switch between the day and week views when the window crosses 1180px */
let lastDayMode=planDayMode(),lastPhone=isPhoneW();
window.addEventListener('resize',()=>{const m=planDayMode(),p=isPhoneW();if(m===lastDayMode&&p===lastPhone)return;lastDayMode=m;lastPhone=p;if(['plan','people','projects'].includes(S.view))render()});
/* swipe left / right on a day's content to change the day (data-swipe: pday = week views, mday = projects month) */
let pdTouch=null;
document.addEventListener('touchstart',e=>{const b=e.target.closest&&e.target.closest('[data-swipe]');pdTouch=b&&e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,act:b.dataset.swipe}:null},{passive:true});
document.addEventListener('touchend',e=>{if(!pdTouch)return;const p=e.changedTouches[0];const dx=p.clientX-pdTouch.x,dy=p.clientY-pdTouch.y;const act=pdTouch.act;pdTouch=null;
  if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8)(act==='mday'?stepMonthDay:stepPlanDay)(dx<0?1:-1)},{passive:true});
/* move the chosen day by one, crossing into the next or previous week when needed */
function stepPlanDay(dir){
  const k=ymd(addDays(parseD(planDay()),dir));S.pday=k;
  if(k<ymd(S.week)||k>ymd(addDays(S.week,6))){S.week=mondayOf(parseD(k));S.anim=dir<0?'prev':'next';subscribeWeek()}else{S.anim=null;render()}
}
