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
  const out=[];const seen=new Set();
  for(const ty of jobTypes()){seen.add(ty.id);const l=list.filter(t=>typeIdOf(t)===ty.id);if(l.length)out.push({key:'t:'+ty.id,label:ty.name,color:ty.color,tasks:l,preset:{type:ty.id}})}
  const rest=list.filter(t=>!seen.has(typeIdOf(t)));if(rest.length)out.push({key:'t:__x',label:'ประเภทที่ถูกลบแล้ว',color:'#8a979c',tasks:rest,preset:{}});
  return out;
}
const planMatch=t=>{const q=norm(S.pf.q);return (!S.pf.staff||(t.staffIds||[]).includes(S.pf.staff))&&(!q||norm(searchText(t)).includes(q))};
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
  if(t&&gaWaiting(t))return `<span class="tchip gawait" title="ต้องการรถส่วนกลาง GA จะระบุรถและทะเบียนให้ภายหลัง">${CAR_ICON}รถ GA · รอทะเบียน</span>`;
  if(!v||v==='ไม่ใช้รถ')return '';
  const cls=v==='GA'?'ga':v==='รถลูกค้า'?'cust':'car';
  return `<span class="tchip ${cls}">${CAR_ICON}${v==='GA'?'รถ GA':v==='รถลูกค้า'?'รถลูกค้า':'รถ '+esc(v)}${t&&t.needGA&&cls==='car'?' · GA':''}</span>`;
}
function wcard(t,conf,i){
  const ty=typeOf(t);const c=conf.get(t.id);const late=isLate(t);
  const confStaff=new Set((c||[]).flatMap(x=>x.staff));
  const sub=[t.planNo?typeLabel(t):'',t.timeNote].filter(Boolean).join(' · ');
  const det=headline(t);const ch=transportChip(t.transport,t);
  return `<button type="button" class="wc st-${esc(t.status||'planned')}${c?' has-conf':''}${isLeave(t)?' is-leave':''}${flashIds.has(t.id)?' flash':''}" style="--c:${safeColor(ty.color)};--i:${Math.min(i||0,60)}" data-edit="${esc(t.id)}">
    <span class="wc-top"><span class="wc-title" title="${esc(t.planNo||typeLabel(t))}">${esc(t.planNo||typeLabel(t))}</span>${(t.photoIds||[]).length?`<span class="pcount" title="มีรูป ${t.photoIds.length} รูป">${CAM_ICON}${t.photoIds.length}</span>`:''}${(t.files||[]).length?`<span class="pcount" title="มีไฟล์แนบ ${t.files.length} ไฟล์">${CLIP_ICON}${t.files.length}</span>`:''}<i class="wc-dot s-${esc(t.status||'planned')}" title="${esc(stTh(t.status))}"></i></span>
    <span class="wc-sub"><span class="wc-per">${esc(pName(t))}</span>${esc(sub)}</span>
    ${t.location?`<span class="wc-loc">L : <b>${esc(t.location)}</b></span>`:''}
    ${t.customer&&S.pf.by!=='cust'?`<span class="wc-cust">${esc(t.customer)}</span>`:''}
    ${det?`<span class="wc-det">${esc(det)}</span>`:''}
    ${ch?`<span class="wc-chips">${ch}</span>`:''}
    <span class="wc-pp">${(t.staffIds||[]).map(id=>`<span class="pp${confStaff.has(id)?' conf':''}">${esc(staffName(id))}</span>`).join('')}${(t.guests||[]).map(g=>`<span class="pp guest">${esc(g)}</span>`).join('')}</span>
    ${NEEDS_REASON.has(t.status)?`<span class="chip-flag${t.status==='postponed'?' late':''}">${t.status==='postponed'?'↻ เลื่อน':'✕ ยกเลิก'}${t.statusNote?': '+esc(t.statusNote):''}</span>`:''}
    ${c?`<span class="chip-flag">⚠ ${esc(confLabel(c))}</span>`:''}
    ${late&&!c?`<span class="chip-flag late">⏱ เลยวันแล้ว ยังไม่ปิดงาน</span>`:''}
  </button>`;
}
/* who is free on a day: no working plan at all (ทั้งวัน), or only one half taken; full-day leave is not free */
function availOn(k){
  const work=S.tasks.filter(t=>t.date===k&&isWorking(t));const out={full:[],am:[],pm:[],leave:0};
  for(const s of S.staff.filter(s=>s.active!==false).sort(sortPeople)){
    const mine=work.filter(t=>(t.staffIds||[]).includes(s.id));
    const am=mine.some(t=>pA(t)===0),pm=mine.some(t=>pB(t)===1);
    if(am&&pm){if(mine.some(t=>isLeave(t)&&periodOf(t)==='full'))out.leave++;continue}
    out[!am&&!pm?'full':!am?'am':'pm'].push(s);
  }
  return out;
}
/* every free person is listed in full (no "+N" collapsing) */
function availCell(k,d,a){
  const grp=(label,list,period,cls)=>{
    if(!list.length)return '';const show=list;
    const pill=s=>{const tip=`${s.name}${s.role?' · '+s.role:''} · ${label}`;
      return S.canWrite?`<button type="button" class="av-pill" data-action="add" data-date="${k}" data-staff="${esc(s.id)}" data-period="${period}" title="${esc(tip)} · กดเพื่อลงแผนให้วัน${TH_DAY_FULL[d.getDay()]}">${esc(s.name)}</button>`
        :`<span class="av-pill" title="${esc(tip)}">${esc(s.name)}</span>`};
    return `<div class="av-grp ${cls}"><span class="av-lbl">${label} <b>${list.length}</b></span><div class="av-list">${show.map(pill).join('')}</div></div>`;
  };
  const none=!a.full.length&&!a.am.length&&!a.pm.length;
  return `<div class="av-cell">${grp('ว่างทั้งวัน',a.full,'full','f')}${grp('ว่างเช้า',a.am,'am','h')}${grp('ว่างบ่าย',a.pm,'pm','h')}${none?'<span class="av-none">ไม่มีคนว่าง</span>':''}${a.leave?`<span class="av-leave">ลา ${a.leave} คน</span>`:''}</div>`;
}
function renderPlan(){
  if(notReady())return loading();
  const avail=Array.from({length:7},(_,i)=>availOn(ymd(addDays(S.week,i))));const showAv=S.showAvail&&S.staff.some(s=>s.active!==false);
  const days=Array.from({length:7},(_,i)=>addDays(S.week,i));const today=ymd(new Date());const conf=allConflicts();
  const base=S.tasks.filter(planMatch);const groups=planGroups(base);
  const shown=S.pf.groups.length?groups.filter(g=>S.pf.groups.includes(g.key)):groups;
  const work=S.tasks.filter(t=>isWorking(t)&&!isLeave(t));const cnt=s=>work.filter(t=>(t.status||'planned')===s).length;
  const confN=S.tasks.filter(t=>conf.has(t.id)).length;
  const last=days[6];const isThis=ymd(S.week)===ymd(mondayOf(new Date()));
  let ci=0;
  let h=S.staff.length?'':`<div class="banner warn"><b>ยังไม่มีรายชื่อพนักงาน</b> เพิ่มรายชื่อก่อนเพื่อเลือก Team Service ในแผน <button type="button" class="lnk" data-go="settings">ไปที่จัดการข้อมูล</button></div>`;
  h+=`<section class="wp-panel" aria-label="แผนงานสัปดาห์ ${esc(weekName(S.week))}"><header class="wp-head">
    <div class="wp-brand">BU1 · Weekly Planning</div>
    <div class="wp-nav"><button type="button" class="icon-btn" data-action="prev" aria-label="สัปดาห์ก่อน">‹</button>
      <div class="wp-wk"><b>${fmtShort(S.week)} – ${fmtShort(last)} ${last.getFullYear()}</b><span>สัปดาห์ที่ ${isoWeek(S.week)} · ${esc(weekName(S.week))} · ${isThis?'สัปดาห์นี้':'<button type="button" class="lnk" data-action="thisweek">กลับสัปดาห์นี้</button>'}</span></div>
      <button type="button" class="icon-btn" data-action="next" aria-label="สัปดาห์ถัดไป">›</button>
      <label class="wp-jump" title="สร้าง / ไปสัปดาห์ของวันที่เลือก"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><input type="date" id="wkJump2" value="${ymd(S.week)}" aria-label="สร้าง / ไปสัปดาห์ของวันที่เลือก"></label></div>
    <div class="wp-legend">${[['planned','var(--muted)','วางแผน'],['done','var(--good)','เสร็จ'],['postponed','var(--warn)','เลื่อน']].map(([s,c,l])=>`<span><i style="background:${c}"></i>${l} <b data-n="${cnt(s)}">${cnt(s)}</b></span>`).join('')}${confN?`<span class="alert">⚠ จัดชน <b data-n="${confN}">${confN}</b></span>`:''}</div>
  </header>`;
  const total=S.tasks.length;const vis=shown.reduce((a,g)=>a+g.tasks.length,0);
  $('#pf-count').textContent=vis!==total?`แสดง ${vis} จาก ${total} แผน`:`${total} แผน`;
  if(planDayMode())return h+planDayHtml({days,today,conf,shown,avail,showAv})+'</section>';
  h+=`<div class="scroll-x wp-scroll"><table class="wp"><colgroup><col class="c-g">${days.map(()=>'<col>').join('')}</colgroup><thead><tr><th class="corner">${S.pf.by==='cust'?'ลูกค้า':'หัวข้องาน'} \\ วัน</th>`;
  days.forEach((d,i)=>{const k=ymd(d);const n=S.tasks.filter(t=>t.date===k).length;const we=d.getDay()===0||d.getDay()===6;const a=avail[i];
    h+=`<th class="${we?'wkend':''}${k===today?' is-today':''}"><b>${EN_DAY[d.getDay()]}</b><span>${fmtShort(d)}${k===today?' · วันนี้':''}</span><span class="cap${n>MAX_CARDS?' over':n===MAX_CARDS?' full':''}" title="แผนของวันนี้ ${n} จาก ${MAX_CARDS} แผน">${n}/${MAX_CARDS}</span>${S.staff.length?`<span class="dfree" title="ว่างทั้งวัน ${a.full.length} · ว่างเช้า ${a.am.length} · ว่างบ่าย ${a.pm.length}">ว่าง ${a.full.length} คน${a.am.length+a.pm.length?` · ครึ่งวัน ${a.am.length+a.pm.length}`:''}</span>`:''}</th>`});
  h+='</tr></thead><tbody>';
  if(!shown.length)h+=`<tr class="no-rows"><td colspan="8">${S.tasks.length?'ไม่มีแผนงานที่ตรงกับตัวกรอง':'ยังไม่มีแผนในสัปดาห์นี้'}${S.canWrite?' · <button type="button" class="lnk" data-action="add">+ เพิ่มแผนงาน</button>':''}</td></tr>`;
  for(const g of shown){
    h+=`<tr><th class="gh" scope="row" style="--c:${safeColor(g.color)}"><span class="gh-name"><i></i>${esc(g.label)}</span><span class="gh-sub">${g.tasks.length} แผน</span></th>`;
    for(const d of days){const k=ymd(d);const list=g.tasks.filter(t=>t.date===k).sort(byTime);const we=d.getDay()===0||d.getDay()===6;
      h+=`<td class="${we?'wkend':''}${k===today?' is-today':''}"><div class="wcell">${list.map(t=>wcard(t,conf,ci++)).join('')}${S.canWrite?`<button type="button" class="wadd" data-action="add" data-date="${k}"${g.preset.type?` data-type="${esc(g.preset.type)}"`:''}${g.preset.customer!=null?` data-cust="${esc(g.preset.customer)}"`:''} aria-label="เพิ่มแผน ${esc(g.label)} วัน${TH_DAY_FULL[d.getDay()]}">+ เพิ่ม</button>`:''}</div></td>`}
    h+='</tr>';
  }
  /* ว่าง (Available) sits last, below the job-type rows (ลา is the last type) */
  if(showAv){
    h+=`<tr class="av-row"><th class="gh av-gh" scope="row" style="--c:var(--good)"><span class="gh-name"><i></i>ว่าง</span><span class="gh-sub">Available</span></th>`;
    days.forEach((d,i)=>{const k=ymd(d);const we=d.getDay()===0||d.getDay()===6;h+=`<td class="${we?'wkend':''}${k===today?' is-today':''}">${availCell(k,d,avail[i])}</td>`});
    h+='</tr>';
  }
  h+='</tbody></table></div></section>';
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
  return `<div class="pd-strip${scroll?' scroll':''}" role="tablist" aria-label="เลือกวัน">${days.map(x=>{const xk=ymd(x);const [bt,bc,bl]=badge(xk);const we=x.getDay()===0||x.getDay()===6;
    return `<button type="button" role="tab" class="pd-day${xk===sel?' on':''}${xk===today?' td':''}${we?' we':''}" data-${attr}="${xk}" aria-selected="${xk===sel}" aria-label="${esc(TH_DAY_FULL[x.getDay()]+' '+fmtShort(x)+(bl?' · '+bl:''))}"><small>${xk===today?'วันนี้':TH_DAY[x.getDay()]}</small><b>${x.getDate()}</b><span class="pd-n${bc?' '+bc:''}">${bt}</span></button>`}).join('')}</div>`;
}
function pdHead(d,sub,act){
  const k=ymd(d);
  return `<div class="pd-head"><button type="button" class="icon-btn" data-action="${act}-prev" aria-label="วันก่อน">‹</button>
    <div class="pd-title"><b>วัน${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)}${k===ymd(new Date())?' · วันนี้':''}</b><span>${sub}</span></div>
    <button type="button" class="icon-btn" data-action="${act}-next" aria-label="วันถัดไป">›</button></div>`;
}
function planDayHtml({days,today,conf,shown,avail,showAv}){
  const k=planDay();const idx=days.findIndex(d=>ymd(d)===k);const d=days[idx];const a=avail[idx];
  const n=S.tasks.filter(t=>t.date===k).length;
  let h=dayStrip(days,k,xk=>{const xn=S.tasks.filter(t=>t.date===xk).length;return [xn,xn>MAX_CARDS?'over':!xn?'zero':'',`${xn} แผน`]},'pday');
  h+=pdHead(d,`<span class="cap${n>MAX_CARDS?' over':n===MAX_CARDS?' full':''}">${n}/${MAX_CARDS}</span> แผน${S.staff.length?` · ว่าง ${a.full.length} คน${a.am.length+a.pm.length?` · ครึ่งวัน ${a.am.length+a.pm.length}`:''}`:''}`,'pday')+'<div class="pd-body" data-swipe="pday">';
  const groups=shown.map(g=>({g,list:g.tasks.filter(t=>t.date===k).sort(byTime)})).filter(x=>x.list.length);
  if(!groups.length)h+=`<div class="pd-empty">${n?'ไม่มีแผนงานที่ตรงกับตัวกรองในวันนี้':'ยังไม่มีแผนในวันนี้'}</div>`;
  let ci=0;
  for(const {g,list} of groups){
    const add=S.canWrite?`<button type="button" class="btn sm pd-add" data-action="add" data-date="${k}"${g.preset.type?` data-type="${esc(g.preset.type)}"`:''}${g.preset.customer!=null?` data-cust="${esc(g.preset.customer)}"`:''} aria-label="เพิ่มแผน ${esc(g.label)}">+ เพิ่ม</button>`:'';
    h+=`<section class="pd-grp" style="--c:${safeColor(g.color)}"><h3><i></i>${esc(g.label)}<span class="pd-cnt">${list.length} แผน</span>${add}</h3><div class="pd-cards">${list.map(t=>wcard(t,conf,ci++)).join('')}</div></section>`;
  }
  if(S.canWrite)h+=`<button type="button" class="btn pd-addday" data-action="add" data-date="${k}">+ เพิ่มแผนงานวัน${TH_DAY_FULL[d.getDay()]}</button>`;
  if(showAv)h+=`<section class="pd-grp pd-av" style="--c:var(--good)"><h3><i></i>ว่าง (Available)</h3>${availCell(k,d,a)}</section>`;
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
