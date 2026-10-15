'use strict';
/* BU1 Weekly Plan · Booking Plan: every plan of every week in one table (after BU2's "Booking Plan" page)
   Read only: booking and editing happen in Weekly Plan; a row opens the plan card.
   Redesign (user, 15 Oct 2026: "ปรับ design และ layout หน้า booking plan ใหม่ และเน้น filter เป็น drop down"):
   - summary tiles of what the filters show (plans · coming · past not closed · done · postponed / cancelled / not done);
   - one filter bar: search + dropdowns ช่วงวันที่ (presets or own dates) · สถานะ · ลูกค้า · หัวข้องาน · Sale · Team Service · รถ,
     each with plan counts (counted under the other filters; a picked value stays listed) and a search box in the long lists,
     then เรียง; the picked values show as chips under the bar (× removes one, ล้างทั้งหมด);
   - the table, grouped by week when sorted by date (cards on narrow screens, css "Booking Plan fits every screen").
   State S.bk; the dropdowns reuse the Weekly Plan .dd look but their own attributes (data-bkdd …). */
S.bk={q:'',range:'all',from:'',to:'',st:[],cust:[],type:[],sale:[],staff:[],veh:[],sort:'new'};
const BK_MAX=500;
const BK_RANGES=[['all','ทุกช่วงเวลา'],['today','วันนี้'],['week','สัปดาห์นี้'],['nextweek','สัปดาห์หน้า'],['month','เดือนนี้'],['next30','30 วันข้างหน้า'],['last30','30 วันที่ผ่านมา'],['custom','กำหนดเอง…']];
const BK_SORTS=[['new','วันที่ ใหม่ → เก่า'],['old','วันที่ เก่า → ใหม่'],['pn','Plan No.'],['cust','ลูกค้า ก → ฮ']];
const BK_ICON={
  date:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  st:'<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
  cust:'<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/>',
  type:'<path d="M4 6h16M4 12h10M4 18h6"/>',
  sale:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  staff:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.4-.3 4.4 1.3 5 4.3"/>',
  veh:'<path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5"/><path d="M4 16.5h16M5 12h14"/><circle cx="8" cy="14.3" r=".9"/><circle cx="16" cy="14.3" r=".9"/>',
  sort:'<path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/>'};
const bkIcon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${BK_ICON[k]}</svg>`;
/* the multi-pick dropdowns: keys(t) = the values a plan has; name(v) = how a value reads */
const BK_DIMS=[
  {k:'st',label:'สถานะ',all:'ทุกสถานะ',keys:t=>[t.status||'planned'].concat(isLate(t)?['late']:[]),name:v=>v==='late'?'เลยวันแล้ว ยังไม่ปิดงาน':stTh(v),order:STATUSES.map(s=>s.id).concat('late')},
  {k:'cust',label:'ลูกค้า',all:'ทุกลูกค้า',search:true,keys:t=>[custKey(t)],name:v=>v},
  {k:'type',label:'หัวข้องาน',all:'ทุกหัวข้องาน',search:true,keys:t=>[typeKeyOf(t)],name:v=>v==='__x'?'ประเภทที่ถูกลบแล้ว':(jobTypes().find(x=>x.id===v)||{}).name||v},
  {k:'sale',label:'Sale',all:'ทุก Sale',search:true,keys:t=>[String(t.sale||'').trim()||'__none'],name:v=>v==='__none'?'(ไม่ระบุ Sale)':v},
  {k:'staff',label:'Team Service',all:'ทุกคน',search:true,keys:t=>(t.staffIds||[]).length?t.staffIds:['__none'],name:v=>v==='__none'?'(ยังไม่จัดคน)':staffName(v)},
  {k:'veh',label:'รถ',all:'รถทั้งหมด',search:true,keys:t=>{const l=deptCars(t).concat(gaPlateOf(t)?[gaPlateOf(t)]:[]);return l.length?l:['__none']},name:v=>v==='__none'?'(ไม่มีรถแผนก / ทะเบียน GA)':v}];
const bkDim=k=>BK_DIMS.find(d=>d.k===k);

/* ---------- filters ---------- */
function bkRange(){
  const r=S.bk.range,today=ymd(new Date()),mon=mondayOf(new Date()),d=new Date();
  if(r==='today')return [today,today];
  if(r==='week')return [ymd(mon),ymd(addDays(mon,6))];
  if(r==='nextweek')return [ymd(addDays(mon,7)),ymd(addDays(mon,13))];
  if(r==='month')return [ymd(new Date(d.getFullYear(),d.getMonth(),1)),ymd(new Date(d.getFullYear(),d.getMonth()+1,0))];
  if(r==='next30')return [today,ymd(addDays(d,30))];
  if(r==='last30')return [ymd(addDays(d,-30)),today];
  if(r==='custom')return [S.bk.from||'',S.bk.to||''];
  return ['',''];
}
const bkRangeLabel=()=>{if(S.bk.range!=='custom')return (BK_RANGES.find(x=>x[0]===S.bk.range)||BK_RANGES[0])[1];const [a,b]=bkRange();return a||b?`${a?fmtDay(a):'…'} – ${b?fmtDay(b):'…'}`:'กำหนดเอง'};
const bkText=t=>norm([t.planNo,t.customer,t.location,t.remark,t.sale,t.areaId&&typeof areaName==='function'?areaName(t.areaId):'',detailOf(t),typeLabel(t),teamNames(t).join(' ')].join(' '));
/* every filter except `skip` (the dropdown being counted) */
function bkMatch(t,skip){
  if(isLeave(t)||!lineMatch(t))return false;
  const [from,to]=bkRange();if(from&&t.date<from||to&&t.date>to)return false;
  const q=norm(S.bk.q);if(q&&!bkText(t).includes(q))return false;
  return BK_DIMS.every(d=>d.k===skip||!S.bk[d.k].length||d.keys(t).some(k=>S.bk[d.k].includes(k)));
}
const bkActive=()=>BK_DIMS.reduce((n,d)=>n+S.bk[d.k].length,0)+(S.bk.range!=='all'?1:0)+(S.bk.q?1:0);

/* ---------- page ---------- */
let bkOpen='';/* the dropdown left open, kept when the page redraws (auto refresh every 20 s) */
const bkOpenAttr=k=>bkOpen===k?' open':'';
function bkDdHtml(d){
  return `<details class="dd bp-dd" data-bkdd-box="${d.k}"${bkOpenAttr(d.k)}><summary class="dd-btn">${bkIcon(d.k)}<span class="dd-k">${esc(d.label)}</span><b class="dd-v" id="bpV-${d.k}">${esc(d.all)}</b></summary>
    <div class="dd-pop" role="group" aria-label="กรองตาม${esc(d.label)}">${d.search?`<input type="search" class="dd-q" data-bkq="${d.k}" placeholder="ค้นหา${esc(d.label)}" autocomplete="off" aria-label="ค้นหา${esc(d.label)}">`:''}
      <div class="dd-list" id="bpL-${d.k}"></div><div class="dd-foot"><button type="button" class="lnk" data-bkdd-clear="${d.k}">ล้าง</button><button type="button" class="btn sm primary" data-dd-close>ตกลง</button></div></div></details>`;
}
function renderBooking(){
  const [from,to]=S.bk.range==='custom'?bkRange():['',''];
  return `<div class="bp-stats" id="bpStats" aria-live="polite"></div>
    <section class="bp-filter" aria-label="ตัวกรอง Booking Plan">
      <div class="bp-row1"><label class="bp-q"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input type="search" id="bk-q" placeholder="ค้นหา Plan No. · ลูกค้า · สถานที่ · รายละเอียด · ชื่อทีมงาน" value="${esc(S.bk.q)}" aria-label="คำค้น" autocomplete="off"></label>
        <details class="dd bp-dd bp-sort" data-bkdd-box="sort"${bkOpenAttr('sort')}><summary class="dd-btn">${bkIcon('sort')}<span class="dd-k">เรียง</span><b class="dd-v" id="bpV-sort"></b></summary>
          <div class="dd-pop" role="radiogroup" aria-label="เรียงลำดับ">${BK_SORTS.map(([v,l])=>`<label class="dd-opt one"><input type="radio" name="bp-sort" value="${v}"${S.bk.sort===v?' checked':''}><span>${l}</span></label>`).join('')}</div></details></div>
      <div class="bp-row2">
        <details class="dd bp-dd" data-bkdd-box="date"${bkOpenAttr('date')}><summary class="dd-btn">${bkIcon('date')}<span class="dd-k">ช่วงวันที่</span><b class="dd-v" id="bpV-date"></b></summary>
          <div class="dd-pop" role="radiogroup" aria-label="ช่วงวันที่"><div class="dd-list">${BK_RANGES.map(([v,l])=>`<label class="dd-opt one"><input type="radio" name="bp-range" value="${v}"${S.bk.range===v?' checked':''}><span>${l}</span></label>`).join('')}</div>
            <div class="bp-own"${S.bk.range==='custom'?'':' hidden'}><label>ตั้งแต่ <input type="date" id="bk-from" value="${esc(from)}"></label><label>ถึง <input type="date" id="bk-to" value="${esc(to)}"></label></div>
            <div class="dd-foot"><button type="button" class="lnk" data-bkdd-clear="date">ล้าง</button><button type="button" class="btn sm primary" data-dd-close>ตกลง</button></div></div></details>
        ${BK_DIMS.map(bkDdHtml).join('')}
      </div>
      <div class="bp-chips" id="bpChips"></div>
    </section>
    <div class="scroll-x bk-wrap"><table class="list bk-table"><thead><tr><th>Plan No.</th><th>ลูกค้า</th><th>หัวข้องาน</th><th>สถานที่ / พื้นที่</th><th>วันที่</th><th>รถ</th><th>Team Service</th><th>ผู้จอง</th><th>สถานะ</th></tr></thead>
      <tbody id="bkBody"></tbody></table><div class="count-note" id="bkCount"></div></div>`;
}
const bookerOf=t=>{const e=creatorOf(t);return e?String(e).split('@')[0]:'—'};
function bkRow(t,days){
  const d=parseD(t.date);const team=t.staffIds||[];const ch=transportChip(t.transport,t);
  const av=team.slice(0,5).map(id=>{const n=staffName(id);return `<span class="avatar xs" title="${esc(n)}">${esc(initialOf(n))}</span>`}).join('')+(team.length>5?`<span class="more">+${team.length-5}</span>`:'')
    +((t.guests||[]).length?`<span class="more" title="${esc(t.guests.join(', '))}">+${t.guests.length} แผนกอื่น</span>`:'');
  const multi=t.planNo&&(days.get(t.planNo)||new Set()).size>1;
  return `<tr class="bk-row" data-edit="${esc(t.id)}" tabindex="0" style="--c:${planColor(t)}">
    <td class="num c-pn">${esc(t.planNo||'–')}${multi?' <span class="multi-badge" title="Plan No. นี้มีหลายวัน">หลายวัน</span>':''}</td>
    <td class="c-cust">${esc(t.customer||'–')}${t.remark?`<span class="sub bk-note" title="${esc(t.remark)}">📌 ${esc(t.remark)}</span>`:''}</td>
    <td class="c-type"><span class="tdot" style="--c:${planColor(t)}"><i></i>${esc(typeLabel(t))}</span>${LINE[lineOf(t)]?`<span class="sub">${esc(LINE[lineOf(t)].name)}</span>`:''}</td>
    <td class="c-loc">${esc(t.location||'–')}${t.areaId&&typeof areaName==='function'?`<span class="sub">พื้นที่ ${esc(areaName(t.areaId))}</span>`:''}</td>
    <td class="num c-date"><b>${EN_DAY[d.getDay()]}</b> ${esc(fmtShort(d))} ${String(be(d)).slice(-2)}<span class="sub">${esc(pName(t))}${t.timeNote?' · '+esc(t.timeNote):''}</span></td>
    <td class="c-car">${ch||esc(t.transport||'–')}</td>
    <td class="c-team"><div class="avstack">${av||'–'}</div>${teamNeedChip(t)}</td>
    <td class="booker c-by" title="${esc(creatorOf(t)||'ไม่ระบุ')}">${esc(bookerOf(t))}</td>
    <td class="c-st">${noStatus(t)?'<span class="sub">–</span>':`<span class="pill">${statusIcon(t.status)} ${esc((STATUS[t.status]||STATUS.planned).th)}</span>`}${isLate(t)?'<span class="sub bad">เลยวันแล้ว</span>':''}</td></tr>`;
}
/* the dropdown lists, their labels, the chips and the tiles (the details elements stay, so an open dropdown stays open) */
function bkFillFilters(all){
  BK_DIMS.forEach(d=>{
    const m=new Map();all.filter(t=>bkMatch(t,d.k)).forEach(t=>new Set(d.keys(t)).forEach(k=>m.set(k,(m.get(k)||0)+1)));
    S.bk[d.k].forEach(k=>{if(!m.has(k))m.set(k,0)});
    let opts=[...m].map(([v,n])=>({v,n,label:d.name(v)}));
    opts=d.order?opts.sort((a,b)=>d.order.indexOf(a.v)-d.order.indexOf(b.v)):opts.sort((a,b)=>(a.v==='__none')-(b.v==='__none')||b.n-a.n||a.label.localeCompare(b.label,'th'));
    const L=$('#bpL-'+d.k);if(!L)return;
    L.innerHTML=opts.length?opts.map(o=>`<label class="dd-opt"><input type="checkbox" data-bkdd="${d.k}" value="${esc(o.v)}"${S.bk[d.k].includes(o.v)?' checked':''}><span>${esc(o.label)}</span><b>${o.n}</b></label>`).join(''):'<p class="dd-none">ไม่มีแผนตามตัวกรองนี้</p>';
    const q=document.querySelector(`[data-bkq="${d.k}"]`);if(q&&q.value)bkDdSearch(q);
    const p=S.bk[d.k];$('#bpV-'+d.k).textContent=!p.length?d.all:p.length===1?d.name(p[0]):`${p.length} รายการ`;
    const box=document.querySelector(`[data-bkdd-box="${d.k}"]`);box.classList.toggle('on',p.length>0);
    const c=box.querySelector('[data-bkdd-clear]');if(c)c.disabled=!p.length;
  });
  $('#bpV-date').textContent=bkRangeLabel();document.querySelector('[data-bkdd-box="date"]').classList.toggle('on',S.bk.range!=='all');
  $('#bpV-sort').textContent=(BK_SORTS.find(x=>x[0]===S.bk.sort)||BK_SORTS[0])[1];
  const chips=[];
  if(S.bk.range!=='all')chips.push(`<button type="button" class="bp-chip" data-bkx="date">ช่วงวันที่: <b>${esc(bkRangeLabel())}</b> <i aria-hidden="true">×</i></button>`);
  BK_DIMS.forEach(d=>S.bk[d.k].forEach(v=>chips.push(`<button type="button" class="bp-chip" data-bkx="${d.k}" data-v="${esc(v)}" aria-label="เอา ${esc(d.label)} ${esc(d.name(v))} ออก">${esc(d.label)}: <b>${esc(d.name(v))}</b> <i aria-hidden="true">×</i></button>`)));
  if(S.bk.q)chips.push(`<button type="button" class="bp-chip" data-bkx="q">คำค้น: <b>${esc(S.bk.q)}</b> <i aria-hidden="true">×</i></button>`);
  $('#bpChips').innerHTML=chips.length?chips.join('')+`<button type="button" class="lnk bp-clear" data-action="bk-clear">ล้างทั้งหมด</button>`:'';
  $('#bpChips').hidden=!chips.length;
}
function bkStats(list){
  const today=ymd(new Date());const c=f=>list.filter(f).length;
  const tile=(lbl,n,cls,sub)=>`<div class="bp-stat${cls?' '+cls:''}"><span>${lbl}</span><b>${n.toLocaleString('th-TH')}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  const custs=new Set(list.map(t=>custKey(t))).size;
  return tile('แผนตามตัวกรอง',list.length,'all',`${custs} ลูกค้า`)
    +tile('กำลังจะถึง',c(t=>t.date>=today&&isWorking(t)&&t.status!=='done'),'',`ตั้งแต่วันนี้`)
    +tile('เลยวันแล้ว ยังไม่ปิด',c(isLate),c(isLate)?'bad':'','ต้องอัปเดตสถานะ')
    +tile('เสร็จแล้ว',c(t=>t.status==='done'),'good','')
    +tile('เลื่อน · ยกเลิก · ไม่เสร็จ',c(t=>['postponed','cancelled','notdone'].includes(t.status)),'warn','');
}
function fillBooking(){
  const body=$('#bkBody');if(!body)return;
  const all=allTasks();
  if(!all){body.innerHTML=`<tr><td colspan="9" class="hint" style="padding:20px 12px">กำลังโหลดแผนทุกสัปดาห์…</td></tr>`;$('#bkCount').textContent='';$('#bpStats').innerHTML='';return}
  bkFillFilters(all);
  const s=S.bk.sort;const list=all.filter(t=>bkMatch(t)).sort((a,b)=>
    s==='old'?(a.date||'').localeCompare(b.date||'')||byTime(a,b):s==='pn'?String(a.planNo||'~').localeCompare(String(b.planNo||'~'))||(a.date||'').localeCompare(b.date||''):
    s==='cust'?String(a.customer||'~').localeCompare(String(b.customer||'~'),'th')||(a.date||'').localeCompare(b.date||''):(b.date||'').localeCompare(a.date||'')||byTime(a,b));
  $('#bpStats').innerHTML=bkStats(list);
  /* a Plan No. used on more than one day = a multi-day job (BU2's "หลายวัน" badge) */
  const days=new Map();all.forEach(t=>{if(t.planNo){if(!days.has(t.planNo))days.set(t.planNo,new Set());days.get(t.planNo).add(t.date)}});
  const shown=list.slice(0,BK_MAX);const byWeek=s==='new'||s==='old';
  const wkN=new Map();if(byWeek)shown.forEach(t=>{const w=ymd(mondayOf(parseD(t.date)));wkN.set(w,(wkN.get(w)||0)+1)});
  let lastW='';const thisW=ymd(mondayOf(new Date()));
  body.innerHTML=shown.map(t=>{let h='';
    if(byWeek){const w=ymd(mondayOf(parseD(t.date)));if(w!==lastW){lastW=w;const m=parseD(w);const e=addDays(m,6);
      h=`<tr class="bp-wk${w===thisW?' now':''}"><td colspan="9"><b>${esc(fmtShort(m))} – ${esc(fmtShort(e))} ${be(e)}</b><span>สัปดาห์ที่ ${isoWeek(m)}${w===thisW?' · สัปดาห์นี้':''} · ${wkN.get(w)} แผน</span><button type="button" class="lnk" data-goweek="${w}">เปิดใน Weekly Plan</button></td></tr>`}}
    return h+bkRow(t,days)}).join('')
    ||`<tr><td colspan="9" class="bp-empty">ไม่พบแผนที่ตรงกับตัวกรอง${bkActive()?' · <button type="button" class="lnk" data-action="bk-clear">ล้างตัวกรองทั้งหมด</button>':''}</td></tr>`;
  $('#bkCount').textContent=`${list.length.toLocaleString('th-TH')} แผน${list.length>BK_MAX?` (แสดง ${BK_MAX} รายการแรก)`:''} จากทั้งหมด ${all.filter(t=>!isLeave(t)&&lineMatch(t)).length.toLocaleString('th-TH')} แผน${scopeName()?` ${scopeName()}`:''}ในระบบ (ไม่รวมแผนลา) · กดแถวเพื่อเปิดแผน`;
}
function bkDdSearch(inp){const q=norm(inp.value);const L=$('#bpL-'+inp.dataset.bkq);if(L)L.querySelectorAll('.dd-opt').forEach(l=>{const s=l.querySelector('span');l.hidden=!!q&&!norm(s?s.textContent:'').includes(q)})/* the name only, not the count */}

/* ---------- events ---------- */
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='bk-q'){S.bk.q=t.value;fillBooking();return}
  if(t.dataset&&t.dataset.bkq){bkDdSearch(t)}
});
document.addEventListener('change',e=>{const t=e.target;
  if(t.dataset&&t.dataset.bkdd){const k=t.dataset.bkdd;S.bk[k]=t.checked?[...new Set(S.bk[k].concat(t.value))]:S.bk[k].filter(x=>x!==t.value);fillBooking();return}
  if(t.name==='bp-range'){S.bk.range=t.value;const own=document.querySelector('.bp-own');if(own)own.hidden=t.value!=='custom';
    if(t.value==='custom'&&!S.bk.from&&!S.bk.to){const f=$('#bk-from');if(f)setTimeout(()=>f.focus(),30)}fillBooking();return}
  if(t.id==='bk-from'||t.id==='bk-to'){S.bk[t.id.slice(3)]=t.value;S.bk.range='custom';const r=document.querySelector('input[name="bp-range"][value="custom"]');if(r)r.checked=true;fillBooking();return}
  if(t.name==='bp-sort'){S.bk.sort=t.value;t.closest('details').open=false;fillBooking()}
});
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-bkdd-clear]');if(c){const k=c.dataset.bkddClear;if(k==='date'){S.bk.range='all';S.bk.from=S.bk.to='';render()}else{S.bk[k]=[];fillBooking()}return}
  const x=e.target.closest('[data-bkx]');if(x){const k=x.dataset.bkx;
    if(k==='date'){S.bk.range='all';S.bk.from=S.bk.to='';render()}else if(k==='q'){S.bk.q='';render()}else{S.bk[k]=S.bk[k].filter(v=>v!==x.dataset.v);fillBooking()}return}
  if(e.target.closest('[data-action="bk-clear"]')){S.bk={q:'',range:'all',from:'',to:'',st:[],cust:[],type:[],sale:[],staff:[],veh:[],sort:S.bk.sort};render();return}
  /* one dropdown open at a time; a click outside closes them */
  document.querySelectorAll('#view details.bp-dd[open]').forEach(d=>{if(!d.contains(e.target))d.open=false});
});
document.addEventListener('toggle',e=>{const d=e.target;if(!d.matches||!d.matches('#view details.bp-dd'))return;if(!d.open){if(bkOpen===d.dataset.bkddBox)bkOpen='';return}bkOpen=d.dataset.bkddBox;
  document.querySelectorAll('#view details.bp-dd[open]').forEach(x=>{if(x!==d)x.open=false});
  const q=d.querySelector('.dd-q');if(q&&window.innerWidth>760)setTimeout(()=>q.focus(),30)},true);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const d=document.querySelector('#view details.bp-dd[open]');if(d){d.open=false;d.querySelector('summary').focus();return}}
  if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('bk-row'))openTask(e.target.dataset.edit);
});
