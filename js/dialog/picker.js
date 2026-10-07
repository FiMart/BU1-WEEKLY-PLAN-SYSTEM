'use strict';
/* BU1 Weekly Plan · plan drawer: Team Service picker */
/* ---------- task dialog ---------- */
const dlg=$('#dlg');const form=$('#taskForm');let editing=null;let confTimer=null;
$('#f-status').innerHTML=STATUSES.map(s=>`<label><input type="radio" name="f-status" id="f-st-${s.id}" value="${s.id}"><span><span class="s-${s.id}">${s.icon}</span>${s.th}</span></label>`).join('');
$('#f-period').innerHTML=PERIODS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
/* Team Service picker: search + team filter + availability for the chosen date/period */
let pickSel=new Set(),pickPool=null,lastPicked=null;
function availOf(id){
  const v={date:$('#f-date').value,period:$('#f-period').value,sharedTeam:$('#f-sharedTeam').checked,location:$('#f-location').value,areaId:($('#f-area')||{}).value||''};if(!v.date)return null;
  const mine=(pickPool||S.tasks).filter(o=>o.date===v.date&&isWorking(o)&&(!editing||o.id!==editing.id)&&(o.staffIds||[]).includes(id));
  const over=mine.filter(o=>overlaps(v,o));const hit=over.find(o=>!teamShared(v,o));
  if(!hit&&over.length)return {cls:'part',txt:`ทีมร่วม · ${pName(over[0])} ${typeLabel(over[0])}${over[0].planNo?' '+over[0].planNo:''}`};
  if(hit&&isLeave(hit))return {cls:'leave',txt:`ลา${pName(hit)}`};
  if(hit)return {cls:'busy',txt:`ติดงาน${pName(hit)} · ${typeLabel(hit)}${hit.planNo?' '+hit.planNo:''}`};
  if(mine.length)return {cls:'part',txt:`ว่างช่วงนี้ · วันนี้มี ${mine.length} งาน`};
  return {cls:'free',txt:'ว่าง'};
}
function pickPeople(){return S.staff.filter(s=>s.active!==false||pickSel.has(s.id)).sort(sortPeople)}
let pickGuests=[];
function renderPickSel(){
  const el=$('#tpSel');const ids=[...pickSel];
  const tags=ids.map(id=>{const n=staffName(id);const c=formCard(id);return `<span class="tp-tag"><span class="avatar xs" aria-hidden="true">${esc(initialOf(n))}</span>${esc(n)}${cardBadge(c)}<button type="button" data-tp-remove="${esc(id)}" aria-label="เอา ${esc(n)} ออก">×</button></span>`})
    .concat(pickGuests.map((g,i)=>`<span class="tp-tag guest"><span class="avatar xs" aria-hidden="true">${esc(initialOf(g))}</span>${esc(g)} <small>แผนกอื่น</small><button type="button" data-tp-guest-remove="${i}" aria-label="เอา ${esc(g)} ออก">×</button></span>`));
  el.innerHTML=tags.length?tags.join(''):'<span class="hint">ยังไม่ได้เลือก (ไม่บังคับ บันทึกแผนก่อนแล้วเพิ่มทีมทีหลังได้) · ติ๊กชื่อจากรายการด้านล่าง หรือพิมพ์ชื่อคนจากแผนกอื่น</span>';
  $('#tpCount').textContent=tags.length?`เลือกแล้ว ${tags.length} คน${pickGuests.length?` (ในแผนก ${ids.length} · แผนกอื่น ${pickGuests.length})`:''}`:'';
  $('#tpClear').hidden=!tags.length;$('#tpN').textContent=tags.length;
  const area=($('#f-area')||{}).value;$('#tpCard').innerHTML=cardSummary(ids,area);
  $('#tpCardWrap').hidden=!(typeof hasSafety==='function'&&hasSafety()&&area&&areaRule(SAFE,area));
}
function addGuest(){
  const inp=$('#tpGuest');const name=inp.value.trim().replace(/\s+/g,' ').slice(0,80);if(!name)return false;
  const inDept=S.staff.find(s=>norm(s.name)===norm(name));
  if(inDept){pickSel.add(inDept.id);renderPickerList();toast(`${inDept.name} อยู่ในรายชื่อพนักงานแล้ว เลือกให้แล้ว`)}
  else if(!pickGuests.some(g=>norm(g)===norm(name)))pickGuests.push(name);
  inp.value='';renderPickSel();checkConflicts();return true;
}
const POS_COLORS=['#2a78d6','#1baf7a','#7148c9','#eb6834','#d55181','#5b6b8c','#0e8fa3','#9a6b3f'];
const NO_POS='ไม่ระบุตำแหน่ง';
function posGroups(list){
  const order=positions();const m=new Map(order.map(p=>[p,[]]));
  list.forEach(s=>{const k=String(s.role||'').trim()||NO_POS;if(!m.has(k))m.set(k,[]);m.get(k).push(s)});
  if(m.has(NO_POS)){const l=m.get(NO_POS);m.delete(NO_POS);m.set(NO_POS,l)}
  let extra=0;
  return [...m].filter(([,l])=>l.length).map(([k,l])=>{const i=order.indexOf(k);return {key:k,list:l,color:k===NO_POS?'#8a979c':POS_COLORS[(i>=0?i:order.length+extra++)%POS_COLORS.length]}});
}
function renderPickerList(){
  const list=$('#tpList');if(!list)return;
  const q=norm($('#tpQ').value);const freeOnly=$('#tpFree').checked;const allowBusy=$('#tpAllowBusy').checked;
  /* Safety: only people whose card for the chosen area is valid today (ผ่าน or ใกล้หมดอายุ); people already picked stay */
  const area=($('#f-area')||{}).value;const cardOnly=$('#tpCardOnly').checked&&typeof hasSafety==='function'&&hasSafety()&&!!area&&!!areaRule(SAFE,area);
  const cardOk=id=>{const s=personCardStatus(SAFE,id,area);return !!s&&(s.k==='ok'||s.k==='warn')};
  const people=pickPeople().filter(s=>!cardOnly||pickSel.has(s.id)||cardOk(s.id));
  let html='';
  for(const {key:team,list:members,color} of posGroups(people)){
    const rows=members.map(s=>{const a=availOf(s.id);const un=!!a&&(a.cls==='busy'||a.cls==='leave');return {s,a,un,lock:un&&!allowBusy&&!pickSel.has(s.id)}})
      .filter(({s,un})=>(!q||norm([s.name,s.role].join(' ')).includes(q))&&(!freeOnly||pickSel.has(s.id)||!un))
      .sort((x,y)=>x.un-y.un);
    if(!rows.length)continue;
    const pickable=rows.filter(r=>!r.lock);const nUn=rows.filter(r=>r.un).length;
    const nSel=pickable.filter(r=>pickSel.has(r.s.id)).length;const allOn=pickable.length>0&&nSel===pickable.length;
    html+=`<label class="tp-group sel" style="--pc:${color}"><input type="checkbox" data-tp-all="${esc(pickable.map(r=>r.s.id).join(','))}"${allOn?' checked':''}${pickable.length?'':' disabled'} data-some="${nSel&&!allOn?1:0}" aria-label="เลือกทุกคนที่ว่าง ตำแหน่ง ${esc(team)}"><b>${esc(team)}</b> ว่าง ${rows.length-nUn}/${rows.length} คน<small>${allOn?'เลือกครบแล้ว':nSel?`เลือก ${nSel}/${pickable.length}`:pickable.length?'ติ๊กเพื่อเลือกทุกคนที่ว่าง':'ไม่มีคนว่าง'}</small></label>`;
    html+=rows.map(({s,a,un,lock})=>{const on=pickSel.has(s.id);
      const tip=[s.name,s.role].filter(Boolean).join(' · ')+(un?` · ไม่ว่าง: ${a.txt}`:'');
      return `<label class="tp-row${on?' on':''}${un?' un':''}${lock?' lock':''}${on&&s.id===lastPicked?' just':''}" style="--pc:${color}" title="${esc(tip)}"><input type="checkbox" class="tp-cb" data-tp value="${esc(s.id)}"${on?' checked':''}${lock?' disabled':''}><span class="avatar sm" aria-hidden="true">${esc(initialOf(s.name))}</span><span class="tp-name"><b>${esc(s.name)}</b>${un?`<small class="why">${esc(a.txt)}</small>`:a&&a.cls==='part'?`<small>${esc(a.txt)}</small>`:''}${cardBadge(formCard(s.id))}</span></label>`}).join('');
  }
  const top=list.scrollTop;
  list.innerHTML=html||`<div class="tp-empty">${cardOnly&&!people.length?'ยังไม่มีใครมีบัตรพื้นที่นี้ (หรือยังไม่ได้จับคู่พนักงานกับ HR)':people.length?'ไม่พบรายชื่อที่ตรงกับคำค้น':'ยังไม่มีรายชื่อพนักงาน เพิ่มได้ที่หน้าข้อมูลหลัก'}</div>`;
  list.scrollTop=top;lastPicked=null;
  list.querySelectorAll('[data-some="1"]').forEach(x=>{x.indeterminate=true});
}
form.addEventListener('change',e=>{const t=e.target;
  if(t.matches('[data-tp-all]')){const ids=t.dataset.tpAll.split(',').filter(Boolean);ids.forEach(i=>t.checked?pickSel.add(i):pickSel.delete(i));renderPickSel();renderPickerList();return}
  if(t.matches('[data-tp]')){if(t.checked){pickSel.add(t.value);lastPicked=t.value}else pickSel.delete(t.value);t.closest('.tp-row').classList.toggle('on',t.checked);renderPickSel();renderPickerList();return}
  if(t.id==='tpFree'||t.id==='tpAllowBusy'||t.id==='tpCardOnly')renderPickerList();
  if(t.id==='f-sharedTeam'||t.id==='f-location'||t.id==='f-area'){syncSharedArea();renderPickerList()}
  if(t.name==='tr-per'){$('#f-period').value=t.value;renderPickerList();renderTrGrid();return}
  if(t.id==='f-date'||t.id==='f-period'){renderPickerList();renderTrGrid()}
  if(t.id==='f-type'){syncTypeOther();syncDrawerColor()}
  if(t.name==='car-mode'){syncCarMode();checkConflicts()}
  if(t.name==='f-status'){syncReason();if(NEEDS_REASON.has(t.value))setTimeout(()=>$('#f-reason').focus(),30)}
  if(t.id==='f-sale')syncSaleTel();
});
form.addEventListener('input',e=>{if(e.target.id==='tpQ')renderPickerList();if(e.target.id==='f-transport'){syncTrAdd();renderTrGrid()}});
form.addEventListener('keydown',e=>{
  if((e.target.id==='tpQ'||e.target.id==='f-transport')&&e.key==='Enter')e.preventDefault();
  if(e.target.id==='tpGuest'&&e.key==='Enter'){e.preventDefault();addGuest()}
});
form.addEventListener('click',e=>{
  const tr=e.target.closest('[data-tr]');if(tr){if(tr.getAttribute('aria-disabled')==='true'){toast(`${tr.dataset.tr} ถูกใช้แล้วในช่วงเวลานี้ เลือกคันอื่น หรือเปลี่ยนช่วงเวลา`);return}pickTransport(tr.dataset.tr);return}
  if(e.target.id==='trClear'){$('#f-transport').value='';syncTrAdd();renderTrGrid();checkConflicts();$('#f-transport').focus();return}
  const rm=e.target.closest('[data-tp-remove]');if(rm){pickSel.delete(rm.dataset.tpRemove);renderPickSel();renderPickerList();checkConflicts();return}
  const gr=e.target.closest('[data-tp-guest-remove]');if(gr){pickGuests.splice(Number(gr.dataset.tpGuestRemove),1);renderPickSel();return}
  if(e.target.closest('#tpGuestAdd')){addGuest();$('#tpGuest').focus();return}
  if(e.target.id==='tpClear'){pickSel.clear();pickGuests=[];renderPickSel();renderPickerList();checkConflicts()}
});
function syncTypeOther(){const on=$('#f-type').value==='other';$('#f-typeOther').hidden=!on}
