'use strict';
/* BU1 Weekly Plan · plan drawer: transport, Sale, job type options */
/* Transport: pick from the list or type a new plate; an unknown plate can be added to the vehicle list in one click */
const isKnownTransport=val=>{const k=norm(val);return !k||FIXED_TRANSPORT.some(x=>norm(x)===k)||S.resources.some(r=>r.kind==='vehicle'&&norm(r.name)===k)};
function normTransport(val){
  const v=String(val||'').trim();const k=norm(v);if(!k)return '';
  const f=FIXED_TRANSPORT.find(x=>norm(x)===k);if(f)return f;
  const r=S.resources.find(r=>r.kind==='vehicle'&&norm(r.name)===k);return r?r.name:v.slice(0,60);
}
function fillTransportList(){
  $('#dl-transport').innerHTML=vehicles().filter(r=>r.active!==false).map(r=>`<option value="${esc(r.name)}">${esc(r.code||'รถบริษัท')}</option>`).join('')
    +FIXED_TRANSPORT.map(x=>`<option value="${esc(x)}">${x==='GA'?'รถจาก GA':x==='รถลูกค้า'?'ลูกค้ารับ-ส่ง':'งานไม่ใช้รถ'}</option>`).join('');
  renderTrGrid();
}
/* vehicle tiles grouped by ประเภทรถ (resources.group); grey = used by another plan in an overlapping period that day */
const VEH_NO_GROUP='รถบริษัท';
const vehGroup=r=>String(r.group||'').trim()||VEH_NO_GROUP;
const TRUCK_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>';
function vehBusy(name){
  const v={date:$('#f-date').value,period:$('#f-period').value};if(!v.date)return null;const k=norm(name);
  return (pickPool||S.tasks).find(o=>o.date===v.date&&isWorking(o)&&(!editing||o.id!==editing.id)&&norm(o.transport)===k&&overlaps(v,o))||null;
}
function renderTrGrid(){
  const grid=$('#trGrid');if(!grid)return;
  const val=$('#f-transport').value.trim();const cur=norm(val);
  const all=vehicles().filter(r=>r.active!==false||norm(r.name)===cur);
  const exact=cur&&(all.some(r=>norm(r.name)===cur)||FIXED_TRANSPORT.some(x=>norm(x)===cur));
  const q=exact?'':cur;
  const match=r=>!q||norm([r.name,r.code,vehGroup(r)].join(' ')).includes(q);
  const groups=new Map();all.filter(match).forEach(r=>{const g=vehGroup(r);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r)});
  const tile=(name,sub,extra)=>{const on=norm(name)===cur;const hit=extra&&extra.fixed?null:vehBusy(name);const lock=!!hit&&!on;
    const tip=hit?`ใช้แล้ว${pName(hit)} · ${typeLabel(hit)}${hit.planNo?' '+hit.planNo:''}${hit.customer?' · '+hit.customer:''}`:'';
    return `<button type="button" class="tr-tile${on?' on':''}${hit?' busy':''}" data-tr="${esc(name)}" aria-pressed="${on}"${lock?' aria-disabled="true"':''} title="${esc([name,sub,tip].filter(Boolean).join(' · '))}">${TRUCK_ICON}<b>${esc(name)}</b>${sub?`<small>${esc(sub)}</small>`:''}${hit?`<em>${esc(tip)}</em>`:''}</button>`};
  let i=0;let h='';
  for(const [g,list] of groups)h+=`<div class="tr-grp" style="--gc:${POS_COLORS[i++%POS_COLORS.length]}"><p class="tr-gh"><i></i>${esc(g)}<span>${list.length}</span></p><div class="tr-tiles">${list.map(r=>tile(r.name,r.code)).join('')}</div></div>`;
  const fixed=['รถลูกค้า','ไม่ใช้รถ'].filter(x=>!q||norm(x).includes(q));
  if(fixed.length)h+=`<div class="tr-grp" style="--gc:#8a979c"><p class="tr-gh"><i></i>อื่นๆ<span>${fixed.length}</span></p><div class="tr-tiles">${fixed.map(x=>tile(x,x==='รถลูกค้า'?'ลูกค้ารับ-ส่ง':'งานไม่ใช้รถ',{fixed:true})).join('')}</div></div>`;
  grid.innerHTML=h||`<div class="tp-empty">${all.length?`ไม่พบรถ “${esc(val)}” ในข้อมูลหลัก กดปุ่มเพิ่มเข้าข้อมูลรถได้`:'ยังไม่มีข้อมูลรถ พิมพ์ชื่อรถหรือทะเบียน แล้วกดเพิ่มเข้าข้อมูลรถ'}</div>`;
  $('#trClear').hidden=!val;
  const r=document.querySelector(`input[name="tr-per"][value="${$('#f-period').value}"]`);if(r)r.checked=true;
}
function pickTransport(name){
  const inp=$('#f-transport');inp.value=norm(inp.value)===norm(name)?'':name;
  syncTrAdd();renderTrGrid();checkConflicts();
}
/* "ต้องการรถส่วนกลาง": GA assigns the car and plate later; the plan shows "รอระบุทะเบียน" until someone fills in a plate */
const gaWaiting=t=>!!(t&&t.needGA)&&(!t.transport||t.transport==='GA'||t.transport==='ไม่ใช้รถ');
const transportText=t=>gaWaiting(t)?'รถส่วนกลาง GA · รอ GA ระบุรถและทะเบียน':(t.transport||'')+(t.needGA&&t.transport?' (รถส่วนกลาง GA)':'');
/* ใช้ทีมร่วมฯ: the box turns solid when on, and names the area it applies to */
function syncSharedArea(){
  const box=$('#shareBox');if(!box)return;box.classList.toggle('on',$('#f-sharedTeam').checked);
  const a=($('#f-area')||{}).value;const name=a&&typeof areaName==='function'?areaName(a):$('#f-location').value.trim();
  $('#f-sharedArea').textContent=name?`พื้นที่ ${name} `:'พื้นที่เดียวกัน';
}
function syncNeedGA(){
  const on=$('#f-needGA').checked;$('#gaBox').classList.toggle('on',on);
  $('#f-transport').placeholder=on?'รอ GA ระบุรถ · กรอกทะเบียนภายหลังได้':'ค้นหา หรือพิมพ์ชื่อรถ / ทะเบียน ถ้าไม่มีในรายการ';
}
function syncTrAdd(){
  const val=$('#f-transport').value.trim();const b=$('#trAdd');const show=can('master')&&!isKnownTransport(val);
  b.hidden=!show;if(show)b.textContent=`+ เพิ่ม “${val.slice(0,24)}” เข้าข้อมูลรถ`;
}
async function addVehicle(btn){
  const name=$('#f-transport').value.trim().replace(/\s+/g,' ').slice(0,60);if(!name||isKnownTransport(name))return;
  btn.disabled=true;
  try{const order=Math.max(0,...vehicles().map(x=>Number(x.order)||0))+1;
    await Store.set('resources',newId('r'),{name,code:'',kind:'vehicle',order,active:true,createdAt:new Date().toISOString()});
    btn.hidden=true;$('#dl-transport').insertAdjacentHTML('afterbegin',`<option value="${esc(name)}">รถบริษัท</option>`);
    $('#f-transport').value=name;renderTrGrid();
    toast(`เพิ่มรถ ${name} เข้าข้อมูลหลักแล้ว (กลุ่ม "${VEH_NO_GROUP}" เปลี่ยนประเภทรถได้ที่จัดการข้อมูล › รถ)`);checkConflicts()}
  catch(err){toast(errText(err));noteWriteError(err)}
  finally{btn.disabled=false}
}
function syncSaleTel(){const tel=saleTel($('#f-sale').value);$('#f-saleTel').textContent=tel?`โทร ${tel}`:'';$('#f-saleTel').hidden=!tel}
function typeOptions(cur,blank){
  const l=activeTypes().slice();if(cur&&!l.some(t=>t.id===cur)){const t=jobTypes().find(x=>x.id===cur);l.push(t||{id:cur,name:cur})}
  return (blank?`<option value="">${blank}</option>`:'')+l.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
}
