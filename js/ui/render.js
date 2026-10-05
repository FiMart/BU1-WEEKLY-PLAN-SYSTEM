'use strict';
/* BU1 Weekly Plan · render loop, sidebar, filter bar, banners, week bar, shared UI bits */
/* ---------- render ---------- */
let pendingRender=false;
const PAGES={
  plan:['Weekly Plan',''],
  people:['สรุปรายคนรายวัน','ช่วงเวลาของงานแรกและงานสุดท้าย จำนวนงาน และใครว่างในแต่ละวัน ติ๊กชื่อเพื่อลงแผนให้หลายคนพร้อมกัน'],
  projects:['แผนกำลังคนโปรเจกต์ยาว','ใส่ชื่องาน จำนวนคน และช่วงวันที่ ระบบรวมจำนวนคนที่ต้องใช้ต่อวันทั้งเดือน แล้วเทียบกับคนที่มี'],
  search:['ค้นหางานย้อนหลัง','ค้นด้วย Plan No. ชื่อลูกค้า หรือชื่อพนักงาน จากแผนทุกสัปดาห์'],
  dash:['Dashboard','รายงานผลการปฏิบัติงานสำหรับหัวหน้างานและผู้บริหาร รายสัปดาห์ รายเดือน รายไตรมาส และรายปี'],
  settings:['ข้อมูลหลัก (Master Data)','แก้ที่นี่ที่เดียว ตัวเลือกในแผนงานทุกสัปดาห์จะเปลี่ยนตามทันที'],
  help:['วิธีใช้งาน','คู่มือสั้นสำหรับทีม BU1 Lab'],
};
const VIEW_FN=()=>({plan:renderPlan,people:renderPeople,projects:renderProjects,search:renderSearch,dash:renderDash,settings:renderSettings,help:renderHelp});
function render(){
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===S.view)));
  const pg=PAGES[S.view];$('#pageTitle').textContent=pg[0];$('#pageSub').textContent=pg[1];
  renderSync();renderBanners();renderWeekbar();renderPlanbar();renderChips();renderActions();renderAccountCard();moveInd();
  updateSelbar();
  if($('#dlg').open)renderTrGrid();/* vehicle list may have changed (e.g. a car just added) */
  const main=$('#view');const ae=document.activeElement;
  if(ae&&main.contains(ae)&&isTyping(ae)){pendingRender=true;return}
  pendingRender=false;
  const ready=!notReady();const anim=ready&&!reduceMotion()?S.anim:null;
  const sc=main.querySelector('.scroll-x');const sl=sc?sc.scrollLeft:0;const st=sc?sc.scrollTop:0;
  main.className=anim?'anim-'+anim:'';
  main.innerHTML=VIEW_FN()[S.view]();
  const sc2=main.querySelector('.scroll-x');if(sc2&&!anim){sc2.scrollLeft=sl;sc2.scrollTop=st}
  if(S.view==='search')fillSearch();
  if(S.view==='settings')filterMd();
  if(S.view==='people')syncRowPicks();
  {const on=main.querySelector('.pd-strip.scroll .pd-day.on');if(on){const p=on.parentElement;p.scrollLeft=on.offsetLeft-(p.clientWidth-on.offsetWidth)/2}}
  if(ready){if(anim&&(S.view==='dash'||S.view==='plan'))countUp(main);S.anim=null;flashIds.clear()}
}
/* sidebar: one highlight that glides to the active page */
function moveInd(){
  const ind=$('#sbInd');if(!ind)return;
  const b=document.querySelector('.sb-nav button[aria-selected="true"]');
  if(!b||!b.offsetHeight){ind.style.opacity='0';return}
  ind.style.opacity='1';ind.style.height=b.offsetHeight+'px';ind.style.transform=`translateY(${b.offsetTop}px)`;
}
window.addEventListener('resize',moveInd);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(moveInd);
function countUp(root){
  root.querySelectorAll('[data-n]').forEach(el=>{
    const to=Number(el.dataset.n);if(!(to>0))return;const t0=performance.now();
    const step=now=>{const p=Math.max(0,Math.min(1,(now-t0)/750));/* a frame can be stamped before t0 */const e=1-Math.pow(1-p,3);el.textContent=Math.round(to*e).toLocaleString('th-TH');if(p<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);
  });
}
function isTyping(el){return el.tagName==='TEXTAREA'||el.tagName==='SELECT'||(el.tagName==='INPUT'&&!/^(checkbox|radio|button|submit|color)$/.test(el.type))}
document.addEventListener('focusout',()=>{if(pendingRender)setTimeout(()=>{const ae=document.activeElement;if(!ae||!$('#view').contains(ae)||!isTyping(ae))render()},0)});
const notReady=()=>S.mode==='connecting'||(S.mode==='live'&&(!S.staffReady||!S.resReady||!S.tasksReady||!S.cfgReady));

let pfTypeHtml='',pfStaffHtml='';
function renderPlanbar(){
  const bar=$('#planbar');const show=(S.view==='plan'||S.view==='people')&&!notReady();bar.hidden=!show;if(!show)return;
  const isPlan=S.view==='plan';
  $('#pf-type').hidden=true;$('#pf-availWrap').hidden=!isPlan;$('#pf-avail').checked=S.showAvail;$('#pf-by').hidden=!isPlan;$('#pf-mode').hidden=!(isPlan||S.view==='people')||isPhoneW();$('#pf-mode-'+(planDayMode()?'day':'week')).checked=true;{const r=$('#pf-by-'+S.pf.by);if(r)r.checked=true}$('#pf-staff').hidden=!isPlan;$('#pf-busyWrap').hidden=isPlan;
  $('#pf-q').placeholder=isPlan?'ค้นหาในแผน: Plan No. ลูกค้า สถานที่ รายละเอียด':'ค้นหาชื่อ หรือตำแหน่ง';
  if(document.activeElement!==$('#pf-q'))$('#pf-q').value=S.pf.q;
  if(isPlan){
    const th=`<option value="">ทุกหัวข้องาน</option>`+jobTypes().map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    if(th!==pfTypeHtml){$('#pf-type').innerHTML=th;pfTypeHtml=th}$('#pf-type').value=S.pf.type;
    const sh=`<option value="">ทุกคน</option>`+S.staff.slice().sort(sortPeople).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    if(sh!==pfStaffHtml){$('#pf-staff').innerHTML=sh;pfStaffHtml=sh}$('#pf-staff').value=S.pf.staff;
  }else $('#pf-busy').checked=S.pf.busy;
}
function updateSelbar(){
  const bar=$('#selbar');const ids=[...S.sel].filter(id=>staffById(id));
  if(ids.length!==S.sel.size)S.sel=new Set(ids);
  const show=ids.length>0&&S.view==='people'&&S.canWrite;bar.hidden=!show;if(!show)return;
  $('#selN').textContent=ids.length;$('#selNames').textContent=ids.map(staffName).join(', ');
}
function syncRowPicks(){
  document.querySelectorAll('#view [data-row-pick]').forEach(cb=>{const on=S.sel.has(cb.dataset.rowPick);cb.checked=on;cb.closest('tr').classList.toggle('picked',on)});
  document.querySelectorAll('#view [data-team-pick]').forEach(cb=>{const ids=cb.dataset.teamPick.split(',').filter(Boolean);const n=ids.filter(i=>S.sel.has(i)).length;cb.checked=n>0&&n===ids.length;cb.indeterminate=n>0&&n<ids.length});
  updateSelbar();
}
function renderSync(){
  const el=$('#sync');const m=S.mode;
  el.className='sync'+(m==='live'?' live':m==='error'?' err':'');
  el.querySelector('span').textContent=m==='live'?'ออนไลน์ · อัปเดตพร้อมกันทั้งทีม':m==='local'?'ออฟไลน์ · ไม่บันทึก':m==='error'?'การเชื่อมต่อขาด':'กำลังเชื่อมต่อ…';
}
function renderBanners(){
  const b=[];
  if(S.mode==='local')b.push(`<div class="banner warn"><b>โหมดตัวอย่างในเครื่อง</b> ข้อมูลที่แก้ในหน้านี้จะหายเมื่อปิดหน้า และไม่แชร์ให้ทีม เปิดหน้านี้ผ่านลิงก์ claude.ai เพื่อใช้ฐานข้อมูลร่วมกัน</div>`);
  if(S.mode==='error')b.push(`<div class="banner err"><b>การเชื่อมต่อฐานข้อมูลขาด</b> โหลดหน้าใหม่เพื่อเชื่อมต่ออีกครั้ง ข้อมูลที่แสดงอยู่อาจไม่เป็นปัจจุบัน</div>`);
  if(!S.canWrite){
    if(S.backend==='supabase'){const L=levelOf(S.level)||levelOf('viewer');
      b.push(`<div class="banner"><b>${esc(L.th)} (${L.en})</b> ${esc(L.desc)}${L.perm.edit?' · ตอนนี้ฐานข้อมูลปฏิเสธการบันทึก ติดต่อผู้ดูแลระบบ':' · ต้องการสิทธิ์เพิ่ม ติดต่อผู้ดูแลระบบของแผนก'}</div>`)}
    else b.push(`<div class="banner"><b>ดูได้อย่างเดียว</b> บัญชีนี้ยังไม่มีสิทธิ์แก้ไข ขอสิทธิ์ Contributor หรือ Editor จากเจ้าของหน้านี้</div>`);
  }
  const hasSample=S.staff.some(x=>x.sample)||S.resources.some(x=>x.sample)||S.tasks.some(x=>x.sample)||S.projects.some(x=>x.sample);
  if(hasSample&&S.mode==='live'&&S.view!=='help')b.push(`<div class="banner"><b>มีข้อมูลตัวอย่างอยู่ในระบบ</b> ใส่รายชื่อพนักงาน รถ และ Sale จริงที่หน้าข้อมูลหลัก แล้วลบข้อมูลตัวอย่างออก <button type="button" class="lnk" data-go="settings">ไปที่ข้อมูลหลัก</button> <button type="button" class="lnk" data-go="help">อ่านวิธีใช้</button></div>`);
  $('#banners').innerHTML=b.join('');
}
let wkExportHtml=null;
function renderWeekbar(){
  const show=S.view==='people'||(S.view==='dash'&&S.dash.mode==='week');
  $('#weekbar').hidden=!show;$('#btnAddTop').hidden=!S.canWrite;
  if(!show)return;
  const last=addDays(S.week,6);
  $('#wkTitle').textContent=weekName(S.week);
  $('#wkRange').textContent=`จันทร์ ${fmtShort(S.week)} – อาทิตย์ ${fmtShort(last)} ${be(last)}`;
  const jump=$('#wkJump');if(document.activeElement!==jump)jump.value=ymd(S.week);
  $('#optSun').checked=S.showSun;
  const sunKey=ymd(last);const sunN=S.showSun?0:S.tasks.filter(t=>t.date===sunKey).length;
  $('#sunHint').textContent=sunN?`มีแผนวันอาทิตย์ ${sunN} แผน ซ่อนอยู่ (เปิดวันอาทิตย์เพื่อดู)`:'';
  const st=$('#wkStats');
  if(notReady())st.innerHTML='';
  else{
    const tasks=shownTasks().filter(isWorking);const jobs=tasks.filter(t=>!isLeave(t));const conf=allConflicts();
    const confN=tasks.filter(t=>conf.has(t.id)).length;
    const leaveN=new Set(tasks.filter(isLeave).flatMap(t=>(t.staffIds||[]).map(id=>id+'|'+t.date))).size;
    const overN=weekDays().filter(d=>S.tasks.filter(t=>t.date===ymd(d)).length>MAX_CARDS).length;
    st.innerHTML=`<span class="stat"><b>${jobs.length}</b> แผนงาน</span>`+(leaveN?`<span class="stat"><b>${leaveN}</b> คน-วันลา</span>`:'')
      +(confN?`<span class="stat alert">⚠ <b>${confN}</b> แผนชน</span>`:'<span class="stat"><span class="s-done">●</span> ไม่มีการจัดชน</span>')
      +(overN?`<span class="stat late">⚠ <b>${overN}</b> วันเกิน 20 แผน</span>`:'');
  }
  const ex='';
  if(ex!==wkExportHtml){$('#wkExport').innerHTML=ex;wkExportHtml=ex}
}

function statusIcon(s){const st=STATUS[s]||STATUS.planned;return `<span class="sicon s-${st.id}" title="${st.th}" aria-label="${st.th}">${st.icon}</span>`}
const jr=(k,v,cls)=>v?`<span class="jr"><span class="k">${k}</span><span class="v${cls?' '+cls:''}">${esc(v)}</span></span>`:'';
function card(t,conf,i){
  const ty=typeOf(t);const c=conf.get(t.id);const late=isLate(t);
  return `<button type="button" class="jc st-${esc(t.status||'planned')}${c?' has-conf':''}${isLeave(t)?' is-leave':''}${flashIds.has(t.id)?' flash':''}" style="--c:${safeColor(ty.color)};--i:${Math.min(i||0,40)}" data-edit="${esc(t.id)}">
    <span class="jc-band"><i></i><b>${esc(typeLabel(t))}</b><span class="per">${esc(pName(t))}</span>${(t.photoIds||[]).length?`<span class="pcount" title="มีรูป ${t.photoIds.length} รูป">${CAM_ICON}${t.photoIds.length}</span>`:''}${statusIcon(t.status)}</span>
    <span class="jc-body">
      ${t.planNo?`<span class="pn">${esc(t.planNo)}</span>`:''}
      ${t.customer?`<span class="jc-cust">${esc(t.customer)}</span>`:''}
      ${jr('Location',t.location)}${jr('Time',t.timeNote)}${jr('Detail',detailOf(t).trim(),'clamp')}${jr('Request',t.request,'clamp')}
      ${jr('Transport',t.transport)}${jr('Sale',t.sale)}${jr('Team',teamNames(t).join(', '))}
      ${c?`<span class="chip-flag">⚠ ${esc(confLabel(c))}</span>`:''}
      ${late&&!c?`<span class="chip-flag late">⏱ เลยวันแล้ว ยังไม่ปิดงาน</span>`:''}
    </span>
  </button>`;
}
function legendStrip(){
  return `<div class="legend-strip"><div class="grp"><span class="lg-title">หัวข้องาน</span>${jobTypes().filter(t=>t.active!==false).map(t=>`<span class="tdot" style="--c:${safeColor(t.color)}"><i></i>${esc(t.name)}</span>`).join('')}</div>
    <div class="grp"><span class="lg-title">สถานะ</span>${STATUSES.map(s=>`<span><span class="s-${s.id}">${s.icon}</span> ${s.th}</span>`).join('')}</div></div>`;
}
function emptyState(title,text,btn,ico){return `<div class="empty"><div class="empty-ico" aria-hidden="true">${ico||'+'}</div><h3>${title}</h3><p>${text}</p>${btn||''}</div>`}
function loading(){return `<div class="skeleton" aria-label="กำลังโหลด"><i></i><i></i><i></i></div>`}
function initialOf(name){const m=String(name||'').match(/[ก-ฮA-Za-z0-9]/);return m?m[0].toUpperCase():'?'}
function dayHead(d,today,meta){const k=ymd(d);const isT=k===today;const hol=holidayOf(k);
  return `<th class="${isT?'is-today':''}${hol?' hol-day':''}"><div class="dh"><span class="dname">${TH_DAY_FULL[d.getDay()]}</span><span class="dnum">${d.getDate()}<small>${TH_MON[d.getMonth()]}</small></span><div class="dmeta">${isT?'<span class="today-pill">วันนี้</span>':''}${hol?`<span class="hol-pill" title="${esc(hol)}">${esc(hol)}</span>`:''}${meta||''}</div></div></th>`}
const searchText=t=>[t.planNo,typeLabel(t),t.customer,t.location,detailOf(t),t.request,t.transport,t.timeNote,t.sale,t.contact,t.statusNote,teamNames(t).join(' ')].join(' ');
