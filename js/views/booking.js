'use strict';
/* BU1 Weekly Plan · Booking Plan: every plan of every week in one table (after BU2's "Booking Plan" page)
   Read only: booking and editing happen in Weekly Plan; a row opens the plan card.
   BU2 filters by customer chips, status, date range, equipment and a search box; BU1 uses its own model, so equipment
   becomes the vehicle (รถ) and the columns follow the plan card: Plan No., customer, job type, location / Safety area,
   date and period, vehicle, Team Service, who booked it, status. Newest date first. */
S.bk={cust:'',st:'',from:'',to:'',veh:'',q:''};
const BK_MAX=500;

function renderBooking(){
  const vs=[...new Set(vehicles().map(v=>v.name).concat((allTasks()||[]).map(t=>t.transport).filter(Boolean)))].sort((a,b)=>a.localeCompare(b,'th'));
  return `<div class="toolbar bk-bar">
      <div class="seg bk-st" role="radiogroup" aria-label="สถานะ">${[['','ทุกสถานะ']].concat(STATUSES.map(s=>[s.id,s.th])).map(([v,l])=>`<label><input type="radio" name="bk-st" value="${v}"${S.bk.st===v?' checked':''}><span>${l}</span></label>`).join('')}</div>
      <label class="wk-jump">ตั้งแต่ <input type="date" id="bk-from" value="${esc(S.bk.from)}"></label>
      <label class="wk-jump">ถึง <input type="date" id="bk-to" value="${esc(S.bk.to)}"></label>
      <select id="bk-veh" aria-label="รถ"><option value="">รถทั้งหมด</option>${vs.map(v=>`<option value="${esc(v)}"${S.bk.veh===v?' selected':''}>${esc(v)}</option>`).join('')}</select>
      <input type="search" id="bk-q" placeholder="ค้นหา Plan No. / ลูกค้า / สถานที่ / Detail" value="${esc(S.bk.q)}" aria-label="คำค้น" autocomplete="off">
      ${S.bk.from||S.bk.to||S.bk.veh||S.bk.q||S.bk.st||S.bk.cust?'<button type="button" class="btn sm ghost" data-action="bk-clear">ล้างตัวกรอง</button>':''}
    </div>
    <div class="bk-cust" id="bkCust" role="group" aria-label="กรองตามลูกค้า"></div>
    <div class="scroll-x bk-wrap"><table class="list bk-table"><thead><tr><th>Plan No.</th><th>ลูกค้า</th><th>หัวข้องาน</th><th>สถานที่ / พื้นที่</th><th>วันที่</th><th>รถ</th><th>Team Service</th><th>ผู้จอง</th><th>สถานะ</th></tr></thead>
      <tbody id="bkBody"></tbody></table><div class="count-note" id="bkCount"></div></div>`;
}
function bkFiltered(all,skipCust){
  const q=norm(S.bk.q);const {from,to,st,veh,cust}=S.bk;
  return all.filter(t=>!isLeave(t)&&lineMatch(t)&&(!from||t.date>=from)&&(!to||t.date<=to)&&(!st||(t.status||'planned')===st)
    &&(!veh||norm(t.transport).split(/\s*,\s*/).includes(norm(veh))||norm(t.transport)===norm(veh))
    &&(skipCust||!cust||norm(t.customer)===norm(cust))
    &&(!q||norm([t.planNo,t.customer,t.location,t.remark,t.areaId&&typeof areaName==='function'?areaName(t.areaId):'',detailOf(t),typeLabel(t)].join(' ')).includes(q)));
}
const bookerOf=t=>{const e=creatorOf(t);return e?String(e).split('@')[0]:'—'};
function fillBooking(){
  const body=$('#bkBody');if(!body)return;
  const all=allTasks();
  if(!all){body.innerHTML=`<tr><td colspan="9" class="hint" style="padding:20px 12px">กำลังโหลดแผนทุกสัปดาห์…</td></tr>`;$('#bkCount').textContent='';$('#bkCust').innerHTML='';return}
  /* customer chips: counts under every other filter, busiest first */
  const base=bkFiltered(all,true);const cn=new Map();
  base.forEach(t=>{const k=String(t.customer||'').trim();if(k)cn.set(k,(cn.get(k)||0)+1)});
  const chips=[...cn].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'th')).slice(0,12);
  if(S.bk.cust&&!chips.some(([k])=>norm(k)===norm(S.bk.cust)))chips.push([S.bk.cust,cn.get(S.bk.cust)||0]);
  $('#bkCust').innerHTML=`<button type="button" class="chip-btn${S.bk.cust?'':' on'}" data-bk-cust="">ทั้งหมด <span>${base.length}</span></button>`
    +chips.map(([k,n])=>`<button type="button" class="chip-btn${norm(S.bk.cust)===norm(k)?' on':''}" data-bk-cust="${esc(k)}">${esc(k)} <span>${n}</span></button>`).join('');
  const list=bkFiltered(all,false).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||byTime(a,b));
  /* a Plan No. used on more than one day = a multi-day job (BU2's "หลายวัน" badge) */
  const days=new Map();all.forEach(t=>{if(t.planNo){if(!days.has(t.planNo))days.set(t.planNo,new Set());days.get(t.planNo).add(t.date)}});
  body.innerHTML=list.slice(0,BK_MAX).map(t=>{
    const ty=typeOf(t);const d=parseD(t.date);const team=t.staffIds||[];const ch=transportChip(t.transport,t);
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
      <td class="c-team"><div class="avstack">${av||'–'}</div></td>
      <td class="booker c-by" title="${esc(creatorOf(t)||'ไม่ระบุ')}">${esc(bookerOf(t))}</td>
      <td class="c-st"><span class="pill">${statusIcon(t.status)} ${esc((STATUS[t.status]||STATUS.planned).th)}</span></td></tr>`}).join('')
    ||`<tr><td colspan="9" class="hint" style="padding:20px 12px">ไม่พบงานที่ตรงกับตัวกรอง</td></tr>`;
  $('#bkCount').textContent=`${list.length.toLocaleString('th-TH')} แผน${list.length>BK_MAX?` (แสดง ${BK_MAX} รายการล่าสุด)`:''} จากทั้งหมด ${all.filter(t=>!isLeave(t)&&lineMatch(t)).length.toLocaleString('th-TH')} แผน${scopeName()?` ${scopeName()}`:''}ในระบบ · กดแถวเพื่อเปิดแผน`;
}
document.addEventListener('input',e=>{if(e.target.id==='bk-q'){S.bk.q=e.target.value;fillBooking()}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.name==='bk-st'){S.bk.st=t.value;render();return}
  if(t.id==='bk-from'||t.id==='bk-to'){S.bk[t.id.slice(3)]=t.value;render();return}
  if(t.id==='bk-veh'){S.bk.veh=t.value;render()}
});
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-bk-cust]');if(c){S.bk.cust=c.dataset.bkCust;fillBooking();return}
  if(e.target.closest('[data-action="bk-clear"]')){S.bk={cust:'',st:'',from:'',to:'',veh:'',q:''};render()}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('bk-row'))openTask(e.target.dataset.edit)});
