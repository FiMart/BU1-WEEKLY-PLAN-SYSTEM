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
  /* job types in their set order, but the leave types always as the last rows */
  const out=[];const seen=new Set();const leave=[];/* ลา · ลาพักร้อน · ลาป่วย · ลากิจ rows */
  for(const ty of jobTypes()){seen.add(ty.id);const l=list.filter(t=>typeIdOf(t)===ty.id);if(!l.length)continue;
    const g={key:'t:'+ty.id,label:ty.name,color:NEUTRAL_COLOR,tasks:l,preset:{type:ty.id}};/* หัวข้องาน has no colour (user, 9 Oct 2026) */if(isLeaveId(ty.id))leave.push(g);else out.push(g)}
  const rest=list.filter(t=>!seen.has(typeIdOf(t)));if(rest.length)out.push({key:'t:__x',label:'ประเภทที่ถูกลบแล้ว',color:'#8a979c',tasks:rest,preset:{}});
  out.push(...leave);
  return out;
}
const planCore=t=>{const q=norm(S.pf.q);return lineMatch(t)&&(!S.pf.staff||(t.staffIds||[]).includes(S.pf.staff))&&(!q||norm(searchText(t)).includes(q))};
/* เฉพาะแผนที่จองรถ GA (user, 11 Oct 2026: "Filter … แผนงานไหนมีจองรถ ga"): รถ GA / ขอรถไปเอง asked, or GA has answered */
const hasGA=t=>!isLeave(t)&&(!!t.needGA||!!gaInfo(t));
const planBase=t=>planCore(t)&&(!S.pf.ga||hasGA(t));
/* หัวข้องาน / ลูกค้า filters (user, 10 Oct 2026: "filter ของ หัวข้องาน กับ ลูกค้า ให้เป็น Drop Down"; were the row chips under the
   page title): two dropdowns in the filter bar, several picks each, both apply together. S.pf.types = job type ids ('__x' = a
   deleted type), S.pf.custs = custKey values. They narrow the board, the week sheets and "เลือกทั้งหมดที่แสดง". */
const typeKeyOf=t=>{const id=typeIdOf(t);return jobTypes().some(x=>x.id===id)?id:'__x'};
const typeFilterOk=t=>!S.pf.types.length||S.pf.types.includes(typeKeyOf(t));
const custFilterOk=t=>!S.pf.custs.length||S.pf.custs.includes(custKey(t));
const planMatch=t=>planBase(t)&&typeFilterOk(t)&&custFilterOk(t);
/* the options with counts: each list counts with the other filter applied; a picked option stays listed (count 0) so it can be unpicked */
function planFilterOpts(){
  const base=S.tasks.filter(planBase);const cnt=(list,key)=>{const m=new Map();list.forEach(t=>{const k=key(t);m.set(k,(m.get(k)||0)+1)});return m};
  const tc=cnt(base.filter(custFilterOk),typeKeyOf),cc=cnt(base.filter(typeFilterOk),custKey);
  const types=jobTypes().filter(x=>tc.has(x.id)||S.pf.types.includes(x.id)).map(x=>({v:x.id,label:x.name,n:tc.get(x.id)||0}))
    .concat(tc.has('__x')||S.pf.types.includes('__x')?[{v:'__x',label:'ประเภทที่ถูกลบแล้ว',n:tc.get('__x')||0}]:[]);
  const custs=[...new Set([...cc.keys(),...S.pf.custs])].map(k=>({v:k,label:k,n:cc.get(k)||0}))
    .sort((a,b)=>(a.v===NO_CUST)-(b.v===NO_CUST)||b.n-a.n||a.label.localeCompare(b.label,'th'));
  return {types,custs};
}
const ddValue=(picked,opts,all)=>!picked.length?all:picked.length===1?((opts.find(o=>o.v===picked[0])||{}).label||picked[0]):`${picked.length} รายการ`;
let pfDdHtml={types:'',custs:''};
function renderChips(){
  $('#gchips').innerHTML='';/* the old row chips: replaced by the dropdowns */
  const show=S.view==='plan'&&!notReady();$('#pfTypeDD').hidden=$('#pfCustDD').hidden=$('#pfGa').hidden=!show;
  if(!show){$('#pfTypeDD').open=$('#pfCustDD').open=false;return}
  {const n=S.tasks.filter(t=>planCore(t)&&typeFilterOk(t)&&custFilterOk(t)&&hasGA(t)).length;const b=$('#pfGa');
    $('#pfGaN').textContent=n;b.classList.toggle('on',!!S.pf.ga);b.setAttribute('aria-pressed',String(!!S.pf.ga));
    b.title=S.pf.ga?'กำลังแสดงเฉพาะแผนที่จองรถ GA · กดอีกครั้งเพื่อแสดงทุกแผน':`แสดงเฉพาะแผนที่จองรถ GA (${n} แผน)`}
  const o=planFilterOpts();
  [['types',o.types,'#pfTypeList','#pfTypeV','#pfTypeDD','ทุกหัวข้องาน'],['custs',o.custs,'#pfCustList','#pfCustV','#pfCustDD','ทุกลูกค้า']].forEach(([k,opts,list,val,dd,all])=>{
    const html=opts.length?opts.map(x=>`<label class="dd-opt"><input type="checkbox" data-dd="${k}" value="${esc(x.v)}"${S.pf[k].includes(x.v)?' checked':''}><span>${esc(x.label)}</span><b>${x.n}</b></label>`).join(''):'<p class="dd-none">ไม่มีแผนในสัปดาห์นี้</p>';
    if(html!==pfDdHtml[k]){$(list).innerHTML=html;pfDdHtml[k]=html;if(k==='custs')ddSearch()}
    $(val).textContent=ddValue(S.pf[k],opts,all);$(dd).classList.toggle('on',S.pf[k].length>0);
    const c=$(dd).querySelector('[data-dd-clear]');if(c)c.disabled=!S.pf[k].length;
  });
}
/* ลูกค้า search inside its dropdown (hides the options that do not match) */
function ddSearch(){const q=norm(($('#pfCustQ')||{}).value||'');document.querySelectorAll('#pfCustList .dd-opt').forEach(l=>{l.hidden=!!q&&!norm(l.textContent).includes(q)})}
document.addEventListener('change',e=>{const i=e.target.closest&&e.target.closest('input[data-dd]');if(!i)return;
  const k=i.dataset.dd;S.pf[k]=i.checked?[...new Set(S.pf[k].concat(i.value))]:S.pf[k].filter(x=>x!==i.value);S.anim=null;render()});
document.addEventListener('input',e=>{if(e.target.id==='pfCustQ')ddSearch()});
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-dd-clear]');if(c){S.pf[c.dataset.ddClear]=[];S.anim=null;render();return}
  if(e.target.closest('#pfGa')){S.pf.ga=!S.pf.ga;S.anim=null;render();return}
  if(e.target.closest('[data-dd-close]')){e.target.closest('details').open=false;return}
  document.querySelectorAll('#planbar details.dd[open]').forEach(d=>{if(!d.contains(e.target))d.open=false});/* one open at a time; a click outside closes */
});
document.addEventListener('toggle',e=>{const d=e.target;if(!d.matches||!d.matches('#planbar details.dd')||!d.open)return;
  document.querySelectorAll('#planbar details.dd[open]').forEach(x=>{if(x!==d)x.open=false});
  if(d.id==='pfCustDD'){const q=$('#pfCustQ');if(q&&!isPhoneW())setTimeout(()=>q.focus(),30)}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const d=document.querySelector('#planbar details.dd[open]');if(d){d.open=false;d.querySelector('summary').focus()}}});
function renderActions(){
  const plan=S.view==='plan',ready=!notReady();
  $('#copyMenu').hidden=!plan||!ready;if(!plan)$('#copyMenu').open=false;
  $('#btnShot').hidden=!plan||!ready||!downloads;
  $('#btnPrint').hidden=$('#btnXlsx').hidden=!(plan||S.view==='people')||!ready||!downloads;
  /* เลือกหลายแผน: Weekly Plan only; leaving the page ends it */
  if(!plan&&S.pickMode){S.pickMode=false;S.picked.clear();document.body.classList.remove('pick-mode')}
  const bp=$('#btnPick');bp.hidden=!plan||!ready||!canPick();bp.classList.toggle('on',S.pickMode);bp.setAttribute('aria-pressed',String(S.pickMode));
  $('#btnPickTxt').textContent=S.pickMode?'เลิกเลือก':'เลือกหลายแผน';
  renderPickBar();
}
const CLIP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.5 11.5-8.3 8.3a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.4 8.4a1.8 1.8 0 0 1-2.6-2.6l7.7-7.7"/></svg>';
const CAR_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 16.5V11l2-4.2A2 2 0 0 1 7.3 5.5h7.9a2 2 0 0 1 1.7 1L19.5 11h.5a1 1 0 0 1 1 1v4.5"/><path d="M3.5 11h16"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>';
const WALK_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13.5" cy="4.5" r="1.8"/><path d="m10 21 2-5.5 2.5 2.2V21M8 12.5l1.8-4 3.4-1.2 2.3 3.4 2.8 1"/><path d="m12 15.5 1.2-5.3"/></svg>';
/* the plate GA gave (else the first thing GA wrote): Weekly Plan cards show only this, e.g. "กข 1234" (user, 26 Oct 2026:
   "หน้าแผนก่อนกดเข้าไป ให้โชว์แค่ทะเบียนรถ GA … ใน web layout", then "ใน mobile layout ด้วย โชว์แค่ "กข 1234"") —
   the rest is in the tooltip and the plan view */
const gaPlateShort=t=>{const l=gaInfo(t);if(!l)return '';const p=l.find(([k])=>k==='ทะเบียน');return p?p[1]:l[0][1]};
/* the plan's cars as chips: each department vehicle (up to 2), then the GA car (user, 11 Oct 2026: both on one plan);
   short = Weekly Plan cards (week table + daily view / phones): GA's answer = the plate alone, no "รถ GA ·" / "ขอรถไปเอง ·" */
function transportChip(v,t,short){
  t=t||{transport:v};const note=gaNoteText(t);const more=short?' · กดที่แผนเพื่อดูข้อมูลรถทั้งหมด':'';
  const gaTxt=lead=>short?esc(gaPlateShort(t)):`${lead} · ${esc(gaSummary(t))}`;
  if(t.transport===NO_CAR&&!t.needGA)return `<span class="tchip nocar" title="${esc(noCarWhy(t)||NO_CAR)}">${WALK_ICON}${NO_CAR}${noCarWhy(t)?' · '+esc(noCarWhy(t)):''}</span>`;
  const one=n=>{const cls=n==='รถลูกค้า'?'cust':OWN_CAR.includes(n)?'own':'car';
    return `<span class="tchip ${cls}"${cls==='own'&&ownCarText(t)?` title="${esc(ownCarText(t))}"`:''}>${CAR_ICON}${n==='รถลูกค้า'?n:cls==='own'?'รถส่วนตัว':esc(n)/* the car icon says it is a vehicle: no "รถ" before every plate (user, 10 Oct 2026) */}</span>`};
  let h=OWN_CAR.includes(t.transport)&&!t.needGA?one(t.transport):deptCars(t).concat(carNames(t).filter(n=>n==='รถลูกค้า')).map(one).join('');
  if(t.selfDrive){const tip=[ownCarText(t),gaTimes(t),gaInfo(t)?gaInfo(t).map(([k,x])=>k+": "+x).join(" · "):"รอ GA ระบุรถ",note].filter(Boolean).join(" · ");
    h+=`<span class="tchip ${gaInfo(t)?"gaok":"gawait"}" title="${esc((short&&gaInfo(t)?'ขอรถไปเอง · ':'')+tip+(gaInfo(t)?more:''))}">${CAR_ICON}${gaInfo(t)?gaTxt('ขอรถไปเอง'):"ขอรถไปเอง · รอ GA"}</span>`}
  else if(gaInfo(t))h+=`<span class="tchip gaok" title="${esc((short?'รถ GA · ':'')+[gaInfo(t).map(([k,x])=>k+": "+x).join(" · "),gaTimes(t),note].filter(Boolean).join(" · ")+more)}">${CAR_ICON}${gaTxt('รถ GA')}</span>`;
  /* waiting: no time on the card (user, 11 Oct 2026) — once GA Fleet saves the trip, the chip above shows what GA sent */
  else if(gaWaiting(t))h+=`<span class="tchip gawait${t.gaUrgent?' urgent':''}" title="${esc(['ขอรถ GA แล้ว · แอปจองรถ GA จะส่งข้อมูลรถ (ทะเบียน คนขับ เวลา) มาที่แผนนี้เมื่อจัดรถ',gaTimes(t),note].filter(Boolean).join(' · '))}">${CAR_ICON}รถ GA · ${t.gaUrgent?'ด่วน · ':''}รอ GA จัดรถ</span>`;
  else if(t.needGA||t.transport==='GA')h+=`<span class="tchip ga" title="${esc([gaTimes(t),note].filter(Boolean).join(' · '))}">${CAR_ICON}รถ GA${gaPlateOf(t)?' · '+esc(gaPlateOf(t)):''}</span>`;
  return h;
}
function wcard(t,conf,i,short){/* short = Weekly Plan cards (GA car = plate only) */
  const ty=typeOf(t);const c=conf.get(t.id);const late=isLate(t);
  const confStaff=new Set((c||[]).flatMap(x=>x.staff));
  const sub=[t.planNo?typeLabel(t):'',t.timeNote].filter(Boolean).join(' · ');
  const det=headline(t);const ch=transportChip(t.transport,t,short);
  /* compact card (user, 8 Oct 2026): customer and location on one line */
  const where=[t.customer&&S.pf.by!=='cust'?esc(t.customer):'',t.location?`<b>${esc(t.location)}</b>`:''].filter(Boolean).join(' · ');
  return `<button type="button" class="wc st-${esc(t.status||'planned')}${c?' has-conf':''}${isLeave(t)?' is-leave':''}${flashIds.has(t.id)?' flash':''}${S.pickMode?' pickable':''}${S.pickMode&&S.picked.has(t.id)?' picked':''}" style="--c:${planColor(t)};--i:${Math.min(i||0,60)}" data-edit="${esc(t.id)}">
    <span class="wc-top"><span class="wc-title" title="${esc(t.planNo||typeLabel(t))}">${esc(t.planNo||typeLabel(t))}</span>${noStatus(t)?'':`<i class="wc-dot s-${esc(t.status||'planned')}" title="${esc(stTh(t.status))}"></i>`}</span>
    <span class="wc-sub">${lineTag(t)}<span class="wc-per">${esc(pName(t))}</span>${esc(sub)}</span>
    ${where?`<span class="wc-where" title="${esc([t.customer,t.location].filter(Boolean).join(' · '))}">${where}</span>`:''}
    ${det?`<span class="wc-det">${esc(det)}</span>`:''}
    ${t.remark?`<span class="wc-note" title="หมายเหตุ: ${esc(t.remark)}">📝 ${esc(t.remark)}</span>`:''}
    ${(()=>{/* Weekly Plan redesign (user, 9 Oct 2026): the small counters sit with the car chip, so Plan No. gets the whole top line */
      const ic=`${(t.photoIds||[]).length?`<span class="pcount" title="มีรูป ${t.photoIds.length} รูป">${CAM_ICON}${t.photoIds.length}</span>`:''}${(t.files||[]).length?`<span class="pcount" title="มีไฟล์แนบ ${t.files.length} ไฟล์">${CLIP_ICON}${t.files.length}</span>`:''}${sumChip(t)}${docChip(t)}${calChip(t)}${insChip(t)}${prepChip(t)}`;
      return ch||ic?`<span class="wc-chips">${ch}${ic}</span>`:''})()}
    <span class="wc-pp">${teamNeedChip(t)}${(t.staffIds||[]).map(id=>`<span class="pp${confStaff.has(id)?' conf':''}" title="${esc(staffName(id))}">${esc(staffName(id))}</span>`).join('')}${(t.guests||[]).map(g=>`<span class="pp guest" title="${esc(g)} (แผนกอื่น)">${esc(g)}</span>`).join('')}${!(t.staffIds||[]).length&&!(t.guests||[]).length&&!isLeave(t)?'<span class="pp noteam">ยังไม่จัดคน</span>':''}</span>
    ${NEEDS_REASON.has(t.status)&&!noStatus(t)?`<span class="chip-flag${t.status==='postponed'?' late':''}">${statusFlag(t.status)}${t.status==='notdone'&&ncrOfTask(t)?' · '+esc(ncrOfTask(t).ncrNo):''}${t.statusNote?': '+esc(t.statusNote):''}</span>`:''}
    ${c?`<span class="chip-flag">⚠ ${esc(confLabel(c))}</span>`:''}
    ${late&&!c?`<span class="chip-flag late">⏱ เลยวันแล้ว ยังไม่ปิดงาน</span>`:''}
  </button>`;
}
/* who is free on a day: no working plan at all (ทั้งวัน), or only one half taken; full-day leave is not free */
function availOn(k,team){
  const work=S.tasks.filter(t=>t.date===k&&holdsTeam(t));const out={full:[],am:[],pm:[],leave:0,moved:new Map()};
  /* people of a เลื่อน plan that day are free again (user, 14 Oct 2026); moved = id → that plan, for the "งานเลื่อน" tag */
  S.tasks.filter(t=>t.date===k&&t.status==='postponed'&&!isLeave(t)).forEach(t=>(t.staffIds||[]).forEach(id=>{if(!out.moved.has(id))out.moved.set(id,t)}));
  for(const s of S.staff.filter(s=>s.active!==false&&(team?inTeamId(s,team):inTeam(s))).sort(sortPeople)){/* the open ทีม only, or the asked one */
    const mine=work.filter(t=>(t.staffIds||[]).includes(s.id));
    const am=mine.some(t=>pA(t)===0),pm=mine.some(t=>pB(t)===1);
    if(am&&pm){if(mine.some(t=>isLeave(t)&&periodOf(t)==='full'))out.leave++;continue}
    out[!am&&!pm?'full':!am?'am':'pm'].push(s);
  }
  return out;
}
/* "ว่าง n คน" by each date counts ทีม Lab On-Site only (user, 14 Oct 2026; All Team people are in it too), whatever ทีม tab is open;
   null when nobody is in that team yet. The Available panel below still follows the open ทีม. */
/* plans a day (user, 14 Oct 2026: "วันนี้มีกี่แผน ไม่นับ หัวข้องานลา, ลาป่วย, ลากิจ, ลาพักร้อน"): every leave type left out */
/* + not เลื่อน · ยกเลิก · ไม่เสร็จ (user, 14 Oct 2026); a plan with no สถานะงาน (ประเภทระบบ) always counts */
const DAY_SKIP=new Set(['postponed','cancelled','notdone']);
const dayJobs=(list,k)=>list.filter(t=>t.date===k&&!isLeave(t)&&(noStatus(t)||!DAY_SKIP.has(t.status))).length;
const FREE_TEAM='onsite';
const freeOn=k=>S.staff.some(s=>s.active!==false&&inTeamId(s,FREE_TEAM))?availOn(k,FREE_TEAM):null;
const freeTitle=a=>`${TEAM[FREE_TEAM].name} · ว่างทั้งวัน ${a.full.length} · ว่างเช้า ${a.am.length} · ว่างบ่าย ${a.pm.length}${a.leave?` · ลา ${a.leave}`:''}`;
const freeText=a=>`On-Site ว่าง ${a.full.length} คน${a.am.length+a.pm.length?` · ครึ่งวัน ${a.am.length+a.pm.length}`:''}`;
/* ผู้ปฏิบัติงานที่ว่าง (Available): a panel below the board, one column per day, people grouped by ตำแหน่ง,
   every name in full; half-day free people carry a ว่างเช้า / ว่างบ่าย tag; a name opens a new plan for that person */
/* "งานเลื่อน" beside a person freed by a เลื่อน plan that day (user, 14 Oct 2026) */
const movedOf=(a,id)=>{const t=a&&a.moved&&a.moved.get(id);return t?`${t.planNo||typeLabel(t)}${t.customer?' · '+t.customer:''}`:''};
const movedTag=(a,id)=>movedOf(a,id)?`<small class="avp-mv" title="ว่างเพราะแผน ${esc(movedOf(a,id))} เลื่อน">งานเลื่อน</small>`:'';
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
      const inner=`<span class="avatar xs" aria-hidden="true">${esc(initialOf(s.name))}</span><span class="avp-name">${esc(s.name)}</span>${tag?`<small>${tag}</small>`:''}${movedTag(a,s.id)}`;
      return S.canWrite?`<button type="button" class="avp-row" data-action="add" data-date="${k}" data-staff="${esc(s.id)}" data-period="${p}" title="ลงแผนให้ ${esc(s.name)} · วัน${TH_DAY_FULL[d.getDay()]} ${esc(fmtShort(d))}${tag?' · '+tag:''}${movedOf(a,s.id)?' · ว่างเพราะแผน '+esc(movedOf(a,s.id))+' เลื่อน':''}">${inner}</button>`
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
      const inner=`<span class="avatar xs" aria-hidden="true">${esc(initialOf(s.name))}</span><span class="avp-name">${esc(s.name)}${tag?`<small>${tag}</small>`:''}${movedTag(avail[i],s.id)}</span>`;
      return S.canWrite?`<button type="button" class="avp-row" data-action="add" data-date="${k}" data-staff="${esc(s.id)}" data-period="${p}" title="ลงแผนให้ ${esc(s.name)} · วัน${TH_DAY_FULL[d.getDay()]} ${esc(fmtShort(d))}${tag?' · '+tag:''}${movedOf(avail[i],s.id)?' · ว่างเพราะแผน '+esc(movedOf(avail[i],s.id))+' เลื่อน':''}">${inner}</button>`:`<div class="avp-row">${inner}</div>`}).join(''):'<span class="avp-dash" aria-label="ไม่มีคนว่าง">–</span>'}</td>`}).join('')}</tr>`;
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
  const work=LT.filter(t=>isWorking(t)&&!noStatus(t));/* leave / ประเภทระบบ have no status to count */const cnt=s=>work.filter(t=>(t.status||'planned')===s).length;
  const confN=LT.filter(t=>conf.has(t.id)).length;
  const last=days[6];const isThis=ymd(S.week)===ymd(mondayOf(new Date()));
  let ci=0;
  let h=S.staff.length?'':`<div class="banner warn"><b>ยังไม่มีรายชื่อพนักงาน</b> เพิ่มรายชื่อก่อนเพื่อเลือก Team Service ในแผน <button type="button" class="lnk" data-go="settings">ไปที่จัดการข้อมูล</button></div>`;
  h+=`<section class="wp-panel" aria-label="แผนงานสัปดาห์ ${esc(weekName(S.week))}${scopeName()?' · '+esc(scopeName()):''}"><header class="wp-head">
    <div class="wp-brand"><span class="org-chip"><img src="${orgLogoUrl()}" alt="FLOWLAB &amp; SERVICE"></span><span class="wp-bt">BU1 · Weekly Planning</span>${S.line?`<span class="wp-line" style="--lc:${LINE[S.line].color}">${esc(lineName())}</span>`:''}${S.team?`<span class="wp-line" style="--lc:${TEAM[S.team].color}">${esc(teamName(S.team))}</span>`:''}</div>
    <div class="wp-nav"><button type="button" class="icon-btn" data-action="prev" aria-label="สัปดาห์ก่อน">‹</button>
      <div class="wp-wk"><b>${fmtShort(S.week)} – ${fmtShort(last)} ${last.getFullYear()}</b><span>สัปดาห์ที่ ${isoWeek(S.week)} · ${esc(weekName(S.week))} · ${isThis?'สัปดาห์นี้':'<button type="button" class="lnk" data-action="thisweek">กลับสัปดาห์นี้</button>'}</span></div>
      <button type="button" class="icon-btn" data-action="next" aria-label="สัปดาห์ถัดไป">›</button>
      ${calBtn('board')}</div>
    <div class="wp-legend">${[['planned','var(--muted)','วางแผน'],['done','var(--good)','เสร็จ'],['postponed','var(--warn)','เลื่อน'],['notdone','var(--crit)','ไม่เสร็จ']].filter(([s])=>s!=='notdone'||cnt(s)).map(([s,c,l])=>`<span><i style="background:${c}"></i>${l} <b data-n="${cnt(s)}">${cnt(s)}</b></span>`).join('')}${confN?`<span class="alert">⚠ จัดชน <b data-n="${confN}">${confN}</b></span>`:''}</div>
  </header>`;
  /* plans without leave, like the day heads; leave counted apart (user, 15 Oct 2026: "ข้อมูลแต่ละหน้าที่แปลกๆ") */
  const total=LT.filter(t=>!isLeave(t)).length;const vis=shown.reduce((a,g)=>a+g.tasks.filter(t=>!isLeave(t)).length,0);const lvN=LT.filter(isLeave).length;
  $('#pf-count').textContent=(vis!==total?`แสดง ${vis} จาก ${total} แผน`:`${total} แผน`)+(lvN?` · ลา ${lvN}`:'');
  if(planDayMode()){const i=days.findIndex(d=>ymd(d)===planDay());
    return h+planDayHtml({days,today,conf,shown,avail,showAv})+'</section>'+wsLinkHtml()+(showAv?availPanel([days[i]],[avail[i]],today):'')}
  h+=`<div class="scroll-x wp-scroll"><table class="wp"><colgroup><col class="c-g">${days.map(()=>'<col>').join('')}</colgroup><thead><tr><th class="corner">${S.pf.by==='cust'?'ลูกค้า':'หัวข้องาน'} \\ วัน</th>`;
  /* the date only: no "n/20" plans a day any more (user, 14 Oct 2026); then "n แผน" without the leave types */
  days.forEach(d=>{const k=ymd(d);const we=isOffDay(d);const hol=holidayOf(k);const a=freeOn(k);const nj=dayJobs(LT,k);
    h+=`<th class="${we?'wkend':''}${k===today?' is-today':''}${k===S.jumpDay?' is-jump':''}"><b>${EN_DAY[d.getDay()]}</b><span>${fmtShort(d)}${k===today?' · วันนี้':''}</span>${hol?`<span class="hol" title="${esc(hol)}">${esc(hol)}</span>`:''}<span class="dcount${nj?'':' zero'}" title="แผนงานวันนี้ ${nj} แผน (ไม่นับลา · เลื่อน · ยกเลิก · ไม่เสร็จ)">${nj} แผน</span>${a?`<span class="dfree" title="${esc(freeTitle(a))}">${freeText(a)}</span>`:''}</th>`});
  h+='</tr></thead><tbody>';
  if(!shown.length)h+=`<tr class="no-rows"><td colspan="8">${LT.length?'ไม่มีแผนงานที่ตรงกับตัวกรอง':S.line?`ยังไม่มีแผนงาน ${esc(lineName())} ในสัปดาห์นี้`:'ยังไม่มีแผนในสัปดาห์นี้'}${S.canWrite?' · <button type="button" class="lnk" data-action="add">+ เพิ่มแผนงาน</button>':''}</td></tr>`;
  for(const g of shown){
    h+=`<tr><th class="gh" scope="row" style="--c:${safeColor(g.color)}"><span class="gh-name"><i></i>${esc(g.label)}</span><span class="gh-sub">${g.tasks.length} แผน</span></th>`;
    for(const d of days){const k=ymd(d);const list=g.tasks.filter(t=>t.date===k).sort(byTime);const we=isOffDay(d);
      h+=`<td class="${we?'wkend':''}${k===today?' is-today':''}${k===S.jumpDay?' is-jump':''}"><div class="wcell">${list.map(t=>wcard(t,conf,ci++,true)).join('')}${S.canWrite?`<button type="button" class="wadd" data-action="add" data-date="${k}"${g.preset.type?` data-type="${esc(g.preset.type)}"`:''}${g.preset.customer!=null?` data-cust="${esc(g.preset.customer)}"`:''} aria-label="เพิ่มแผน ${esc(g.label)} วัน${TH_DAY_FULL[d.getDay()]}">+ เพิ่ม</button>`:''}</div></td>`}
    h+='</tr>';
  }
  h+='</tbody></table></div></section>';
  /* the week's calibration / instrument sheets have their own page since 16 Oct 2026 (js/views/week-sheets.js): a link bar here */
  h+=wsLinkHtml();
  if(showAv)h+=availPanel(days,avail,today);
  return h;
}

/* the date controls stay on screen while the plans scroll (user, 14 Oct 2026: "scroll … เลือกวันที่ได้ … ไม่ต้องเลื่อนไปข้างบน"):
   the board head (week ‹ › · calendar) sticks to the top — under the phone's own top bar — and the day strip (daily view) or
   the day row of the table sticks under it; --stk0 / --wph = those heights (css "date controls stay on screen") */
function planStick(){
  const p=document.querySelector('#view .wp-panel');if(!p)return;const h=p.querySelector(':scope>.wp-head');
  const m=document.querySelector('.mtop');const top=m&&getComputedStyle(m).position==='sticky'&&m.offsetHeight?m.offsetHeight:0;
  p.style.setProperty('--stk0',top+'px');p.style.setProperty('--wph',(h?h.offsetHeight:0)+'px');
}
window.addEventListener('resize',()=>{if(S.view==='plan'){planStick();syncDateDock()}});
/* below the board (calibration / instrument sheets, ผู้ปฏิบัติงานที่ว่าง) the panel — and its sticky head — has scrolled away:
   #dateDock (fixed, same place) then shows the week ‹ › + calendar, and the day strip in the daily view */
function renderDateDock(){
  if(S.view!=='plan')calClose(false);else setTimeout(calPlace,0);/* the calendar popup follows its button after a redraw */
  const el=$('#dateDock');if(!el)return;
  if(S.view!=='plan'||notReady()){el.hidden=true;el.innerHTML='';return}
  const days=Array.from({length:7},(_,i)=>addDays(S.week,i));const last=days[6];const LT=S.tasks.filter(lineMatch);
  el.innerHTML=`<div class="dd-nav"><button type="button" class="icon-btn" data-action="prev" aria-label="สัปดาห์ก่อน">‹</button>
    <b>${fmtShort(S.week)} – ${fmtShort(last)} ${last.getFullYear()}</b>
    <button type="button" class="icon-btn" data-action="next" aria-label="สัปดาห์ถัดไป">›</button>
    ${calBtn('dock')}
    <button type="button" class="lnk dd-top" data-action="dock-top">ขึ้นบนสุด</button></div>
    ${planDayMode()?dayStrip(days,planDay(),xk=>{const xn=dayJobs(LT,xk);return [xn,!xn?'zero':'',`${xn} แผน`]},'pday'):''}`;
  syncDateDock();
}
function syncDateDock(){
  const el=$('#dateDock');if(!el||!el.innerHTML)return;
  const p=document.querySelector('#view .wp-panel');const h=p&&p.querySelector(':scope>.wp-head');
  const top=parseFloat((p&&p.style.getPropertyValue('--stk0'))||0)||0;
  const z=parseFloat(getComputedStyle(document.body).zoom)||1;/* rects are screen pixels, the sticky top page pixels */
  const gone=!!h&&h.getBoundingClientRect().top<top*z-2;/* the sticky head is being pushed up by the end of the panel */
  el.style.top=top+'px';if(el.hidden===gone)el.hidden=!gone;
}
window.addEventListener('scroll',()=>{if(S.view==='plan')syncDateDock()},{passive:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-action="dock-top"]'))window.scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'})});
/* the calendar button (user, 14 Oct 2026): the browser's own date field (an invisible <input type="date"> over the button) did not
   reliably move the board in real browsers ("เลือกวันที่แล้ว ยังอยู่ที่สัปดาห์เดิม"), so it was replaced (user: "เปลี่ยนเป็นแบบอื่นได้")
   by this app's own month calendar: #calPop lives in <body>, outside #view, so the page redrawing itself (auto refresh, realtime)
   cannot close it or lose the pick. A day → jumpWeek(day) (js/app/events.js): its week opens on that day. */
const PICK_DATE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
const calBtn=from=>`<button type="button" class="wp-jump" data-cal="${from}" aria-haspopup="dialog" aria-expanded="${CAL.el&&!CAL.el.hidden&&CAL.from===from}" title="เลือกวันที่ (เปิดแผนงานของวันนั้น)" aria-label="เลือกวันที่ (เปิดแผนงานของวันนั้น)">${PICK_DATE_ICON}</button>`;
const CAL={el:null,month:null,from:''};
function calHtml(){
  const m=CAL.month,y=m.getFullYear(),mo=m.getMonth(),last=new Date(y,mo+1,0);
  const today=ymd(new Date()),sel=planDay(),wk=ymd(S.week);const fk=sel.slice(0,7)===ymd(m).slice(0,7)?sel:ymd(m);/* the day Tab lands on */
  let rows='';
  for(let ws=mondayOf(new Date(y,mo,1));ws<=last;ws=addDays(ws,7)){
    rows+=`<div class="cal-wk${ymd(ws)===wk?' on':''}">`+Array.from({length:7},(_,i)=>{const d=addDays(ws,i);const k=ymd(d);const hol=holidayOf(k);
      return `<button type="button" class="cal-d${d.getMonth()!==mo?' out':''}${k===today?' td':''}${k===sel?' sel':''}${i===6||hol?' off':''}" data-cal-day="${k}" tabindex="${k===fk?0:-1}" aria-label="${esc(`วัน${TH_DAY_FULL[d.getDay()]} ${d.getDate()} ${TH_MON_FULL[d.getMonth()]} ${be(d)}${hol?' · '+hol:''}`)}"${hol?` title="${esc(hol)}"`:''}${k===sel?' aria-current="date"':''}>${d.getDate()}</button>`}).join('')+'</div>';
  }
  return `<div class="cal-hd"><button type="button" class="icon-btn" data-cal-mon="-1" aria-label="เดือนก่อน">‹</button><b>${TH_MON_FULL[mo]} ${be(m)}</b><button type="button" class="icon-btn" data-cal-mon="1" aria-label="เดือนถัดไป">›</button></div>
    <div class="cal-dn" aria-hidden="true">${['จ','อ','พ','พฤ','ศ','ส','อา'].map(x=>`<span>${x}</span>`).join('')}</div><div class="cal-grid">${rows}</div>
    <div class="cal-ft"><button type="button" class="btn sm" data-cal-day="${today}">วันนี้</button><span>สัปดาห์ที่เปิดอยู่มีแถบสี</span><button type="button" class="lnk" data-cal-close>ปิด</button></div>`;
}
const calBtnEl=()=>document.querySelector(CAL.from==='dock'?'#dateDock [data-cal]':'#view .wp-head [data-cal]');
/* under the button (above it when there is no room); the body is zoomed on desktop, so screen px are turned into page px */
function calPlace(){
  const p=CAL.el;if(!p||p.hidden)return;const b=calBtnEl();
  const z=parseFloat(getComputedStyle(document.body).zoom)||1;const r=b&&b.getBoundingClientRect();
  if(!r||!r.width||r.bottom<0||r.top>window.innerHeight){calClose(false);return}
  const vw=window.innerWidth/z,vh=window.innerHeight/z,w=p.offsetWidth,h=p.offsetHeight;
  const left=Math.max(8,Math.min(r.left/z+r.width/z/2-w/2,vw-w-8));let top=r.bottom/z+6;if(top+h>vh-8&&r.top/z-h-6>=8)top=r.top/z-h-6;
  p.style.left=left+'px';p.style.top=Math.max(8,top)+'px';
}
function calDraw(focusKey){
  const p=CAL.el;p.innerHTML=calHtml();calPlace();
  const f=focusKey&&p.querySelector(`[data-cal-day="${focusKey}"]`)||p.querySelector('.cal-d[tabindex="0"]')||p.querySelector('.cal-d:not(.out)');if(f)f.focus({preventScroll:true});
}
function calOpen(from){
  if(!CAL.el){CAL.el=document.createElement('div');CAL.el.id='calPop';CAL.el.className='cal-pop';CAL.el.setAttribute('role','dialog');CAL.el.setAttribute('aria-label','เลือกวันที่');CAL.el.hidden=true;document.body.appendChild(CAL.el)}
  CAL.from=from;const d=parseD(planDay());CAL.month=new Date(d.getFullYear(),d.getMonth(),1);CAL.el.hidden=false;calDraw(planDay());
  document.querySelectorAll('[data-cal]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.cal===from)));
}
function calClose(focusBtn){
  if(!CAL.el||CAL.el.hidden)return;CAL.el.hidden=true;document.querySelectorAll('[data-cal]').forEach(b=>b.setAttribute('aria-expanded','false'));
  if(focusBtn){const b=calBtnEl();if(b)b.focus()}
}
function calMonth(n,focusKey){CAL.month=new Date(CAL.month.getFullYear(),CAL.month.getMonth()+n,1);calDraw(focusKey)}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-cal]');if(b){if(CAL.el&&!CAL.el.hidden&&CAL.from===b.dataset.cal)calClose(false);else calOpen(b.dataset.cal);return}
  if(!CAL.el||CAL.el.hidden||!CAL.el.contains(e.target))return;
  const mo=e.target.closest('[data-cal-mon]');if(mo){calMonth(Number(mo.dataset.calMon));return}
  const d=e.target.closest('[data-cal-day]');if(d){calClose(false);jumpWeek(d.dataset.calDay);return}
  if(e.target.closest('[data-cal-close]'))calClose(true);
});
document.addEventListener('pointerdown',e=>{if(CAL.el&&!CAL.el.hidden&&!CAL.el.contains(e.target)&&!e.target.closest('[data-cal]'))calClose(false)});
/* keys: Esc closes, arrows move a day / a week, PageUp / PageDown a month */
document.addEventListener('keydown',e=>{
  if(!CAL.el||CAL.el.hidden)return;if(e.key==='Escape'){e.preventDefault();calClose(true);return}
  const d=e.target.closest&&e.target.closest('.cal-d');if(!d||!CAL.el.contains(d))return;
  const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];const pg={PageUp:-1,PageDown:1}[e.key];if(!step&&!pg)return;e.preventDefault();
  const cur=parseD(d.dataset.calDay);const nx=step?addDays(cur,step):new Date(cur.getFullYear(),cur.getMonth()+pg,Math.min(cur.getDate(),28));const k=ymd(nx);
  const diff=(nx.getFullYear()-CAL.month.getFullYear())*12+nx.getMonth()-CAL.month.getMonth();
  if(diff)calMonth(diff,k);else{const f=CAL.el.querySelector(`[data-cal-day="${k}"]`);if(f)f.focus()}
});
window.addEventListener('scroll',calPlace,{passive:true});window.addEventListener('resize',calPlace);/* ---------- daily plan view: one day at a time, the default on tablet and phone (≤1180px) ---------- */
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
  const k=planDay();const idx=days.findIndex(d=>ymd(d)===k);const d=days[idx];const a=freeOn(k);
  const LT=S.tasks.filter(lineMatch);const n=dayJobs(LT,k);
  let h=dayStrip(days,k,xk=>{const xn=dayJobs(LT,xk);return [xn,!xn?'zero':'',`${xn} แผน`]},'pday');
  h+=pdHead(d,`${n} แผน${a?` · <span title="${esc(freeTitle(a))}">${freeText(a)}</span>`:''}`,'pday')+'<div class="pd-body" data-swipe="pday">';
  const groups=shown.map(g=>({g,list:g.tasks.filter(t=>t.date===k).sort(byTime)})).filter(x=>x.list.length);
  if(!groups.length)h+=`<div class="pd-empty">${n?'ไม่มีแผนงานที่ตรงกับตัวกรองในวันนี้':S.line?`ยังไม่มีแผนงาน ${esc(lineName())} ในวันนี้`:'ยังไม่มีแผนในวันนี้'}</div>`;
  let ci=0;
  for(const {g,list} of groups){
    const add=S.canWrite?`<button type="button" class="btn sm pd-add" data-action="add" data-date="${k}"${g.preset.type?` data-type="${esc(g.preset.type)}"`:''}${g.preset.customer!=null?` data-cust="${esc(g.preset.customer)}"`:''} aria-label="เพิ่มแผน ${esc(g.label)}">+ เพิ่ม</button>`:'';
    h+=`<section class="pd-grp" style="--c:${safeColor(g.color)}"><h3><i></i>${esc(g.label)}<span class="pd-cnt">${list.length} แผน</span>${add}</h3><div class="pd-cards">${list.map(t=>wcard(t,conf,ci++,true)).join('')}</div></section>`;
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
