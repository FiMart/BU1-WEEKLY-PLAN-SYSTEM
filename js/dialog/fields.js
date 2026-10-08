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
    +FIXED_TRANSPORT.map(x=>`<option value="${esc(x)}">${TRANSPORT_SUB[x]}</option>`).join('');
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
  grid.innerHTML=h||`<div class="tp-empty">${all.length?`ไม่พบรถ “${esc(val)}” ในข้อมูลหลัก กดปุ่มเพิ่มเข้าข้อมูลรถได้`:'ยังไม่มีข้อมูลรถ พิมพ์ชื่อรถหรือทะเบียน แล้วกดเพิ่มเข้าข้อมูลรถ'}</div>`;
  $('#trClear').hidden=!val;
  const r=document.querySelector(`input[name="tr-per"][value="${$('#f-period').value}"]`);if(r)r.checked=true;
}
function pickTransport(name){
  const inp=$('#f-transport');inp.value=norm(inp.value)===norm(name)?'':name;
  syncTrAdd();renderTrGrid();checkConflicts();
}
/* "ต้องการรถส่วนกลาง": GA assigns the car and plate later; the plan shows "รอระบุทะเบียน" until someone fills in a plate */
const gaWaiting=t=>!!(t&&t.needGA)&&(!t.transport||t.transport==='GA'||t.transport==='ไม่ใช้รถ')&&!gaInfo(t);
/* GA's answer (user, 7 Oct 2026: "แอป GA กรอกข้อมูลรถให้แล้ว ให้ไปโชว์ข้อมูลทั้งหมดของ GA"): data.gaCar and any other
   data.ga… field the GA app writes on the booking (task.gaCar / task.gaMore, read only — never written back).
   The GA app's format is not documented here, so every field is shown: known names get a Thai label, the rest keep
   their own name; nested objects are flattened ("driver › phone"), dates shown in local time. */
const GA_LABELS=[[/^(plate|plateno|licen[cs]e(plate|no)?|carplate|registration|ทะเบียน)$/,'ทะเบียน'],[/^(car|carname|vehicle|vehiclename|name|model|brand)$/,'รถ'],
  [/^(type|cartype|vehicletype|kind)$/,'ประเภทรถ'],[/^(driver|drivername)$/,'พนักงานขับรถ'],[/^(driverphone|drivertel|phone|tel|mobile)$/,'เบอร์โทร'],
  [/^(depart|departtime|departure|go|gotime|pickup|pickuptime|start|starttime|out|outtime)$/,'เวลาออก'],[/^(return|returntime|back|backtime|end|endtime|in|intime)$/,'เวลากลับ'],
  [/^(seat|seats|capacity)$/,'ที่นั่ง'],[/^(status|state)$/,'สถานะ'],[/^(note|notes|remark|remarks|comment)$/,'หมายเหตุ'],
  [/^(by|assignedby|updatedby|staff|gastaff)$/,'ผู้จัดรถ'],[/^(at|assignedat|updatedat|time|date)$/,'จัดเมื่อ']];
const gaKey=k=>String(k).replace(/^ga(?=[A-Z_])/,'').replace(/[_\s-]/g,'').toLowerCase();
const gaLabel=k=>{const n=gaKey(k);const hit=GA_LABELS.find(([re])=>re.test(n));return hit?hit[1]:String(k).replace(/^ga(?=[A-Z_])/,'').replace(/[_-]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2')};
function gaVal(v){
  if(typeof v==='boolean')return v?'ใช่':'ไม่';
  const s=String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)){const d=new Date(s);if(!isNaN(d))return `${fmtShort(d)} ${be(d)} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`}
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return `${fmtShort(parseD(s))} ${be(parseD(s))}`;
  return s;
}
/* [[label, value], …] or null when GA has written nothing yet */
function gaInfo(t){
  if(!t)return null;const out=[];const seen=new Set();
  const add=(label,v)=>{if(v==null||v===''||(Array.isArray(v)&&!v.length))return;const s=Array.isArray(v)?v.map(x=>x&&typeof x==='object'?Object.values(x).filter(y=>y!=null&&y!=='').join(' '):gaVal(x)).filter(Boolean).join(', '):gaVal(v);if(s)out.push([label,s])};
  const walk=(o,pre)=>Object.entries(o).forEach(([k,v])=>{if(/^(id|dept_?id)$/i.test(k))return;const label=(pre?pre+' › ':'')+gaLabel(k);
    if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,label);else if(!seen.has(label)){seen.add(label);add(label,v)}});
  const g=t.gaCar;if(g!=null&&g!==''){if(typeof g==='object')walk(Array.isArray(g)?{car:g}:g,'');else add('รถ',g)}
  if(t.gaMore&&typeof t.gaMore==='object')walk(t.gaMore,'');
  if(!out.length)return null;
  const order=l=>{const i=GA_LABELS.findIndex(([,x])=>x===l);return i<0?99:i};
  return out.sort((a,b)=>order(a[0])-order(b[0]));
}
/* one line for the card / LINE / exports: plate and car, then the driver */
function gaSummary(t){const l=gaInfo(t);if(!l)return '';const v=k=>(l.find(([x])=>x===k)||[])[1];
  const s=[v('ทะเบียน'),v('รถ'),v('พนักงานขับรถ')&&'คนขับ '+v('พนักงานขับรถ')].filter(Boolean);return (s.length?s:l.slice(0,2).map(([,x])=>x)).join(' · ')}
function gaInfoHtml(t){const l=gaInfo(t);if(!l)return '';
  return `<div class="ga-info"><b>${CAR_ICON}ข้อมูลรถจาก GA</b><dl>${l.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`}
/* วิธีเดินทาง (user, 8 Oct 2026; the BU2 form GA Fleet reads): the request goes into GA Fleet's own booking fields
   (data.gaPattern / gaDepart / gaUrgent / gaCargo / gaNote, ขอรถไปเอง = transport 'self' + selfReason / selfNote; js/data/backend.js) */
const GA_PATTERNS={wait:'ส่งแล้วรอรับกลับ',drop:'ส่งอย่างเดียว',pickup_return:'ไปรับกลับบริษัท',continue:'ส่งแล้วไปต่อ'};
const SELF_REASONS=['ต้องใช้รถทั้งวัน','งานนอกเวลา','ไปหลายที่','อื่นๆ'];
const cargoText=c=>c&&typeof c==='object'?['ขนของ',c.size,c.caution&&`ระวัง: ${c.caution}`].filter(Boolean).join(' · '):'';
/* what was asked of GA in one line: pattern · time · urgent · cargo (older plans may still carry กลับ) */
const gaTimes=t=>!t||!t.needGA?'':t.selfDrive?(t.gaGo?`รับรถ ${t.gaGo} น.`:'')
  :[GA_PATTERNS[t.gaPattern]||'',t.gaGo?`รถออก ${t.gaGo} น.`:'',t.gaBack?`กลับ ${t.gaBack} น.`:'',t.gaUrgent?'งานด่วน':'',cargoText(t.gaCargo)].filter(Boolean).join(' · ');
const gaNoteText=t=>t&&t.needGA&&t.gaNote?`หมายเหตุถึง GA: ${t.gaNote}`:'';
/* ขอรถไปเอง / older รถส่วนตัว: why, and the detail */
const ownCarText=t=>[t.carReason?`เหตุผล: ${t.carReason}`:'',t.carNote||''].filter(Boolean).join(' · ');
/* ขอรถไปเอง: a GA car our staff drive — sent to GA like รถ GA, with เหตุผล and เวลารับรถ */
const selfDriveText=t=>'ขอรถไปเอง (รถ GA)'+(gaInfo(t)?' · '+gaSummary(t):' · รอ GA ระบุรถ')+(ownCarText(t)?' · '+ownCarText(t):'')+(gaTimes(t)?' · '+gaTimes(t):'');
const transportText=t=>(t.selfDrive?selfDriveText(t):OWN_CAR.includes(t.transport)&&!t.needGA?'รถส่วนตัว'+(ownCarText(t)?' · '+ownCarText(t):''):(gaInfo(t)?`รถ GA · ${gaSummary(t)}`+(t.transport&&!FIXED_TRANSPORT.includes(t.transport)&&!gaSummary(t).includes(t.transport)?' · '+t.transport:''):gaWaiting(t)?'รถ GA · รอ GA ระบุรถและทะเบียน':(t.transport||'')+(t.needGA&&t.transport?' (รถ GA)':''))+(gaTimes(t)?' · '+gaTimes(t):''))+(gaNoteText(t)?' · '+gaNoteText(t):'');
/* ใช้ทีมร่วมฯ: the box turns solid when on, and names the area it applies to */
function syncSharedArea(){
  const box=$('#shareBox');if(!box)return;box.classList.toggle('on',$('#f-sharedTeam').checked);
  const a=($('#f-area')||{}).value;const name=a&&typeof areaName==='function'?areaName(a):$('#f-location').value.trim();
  $('#f-sharedArea').textContent=name?`พื้นที่ ${name} `:'พื้นที่เดียวกัน';
}
/* วิธีเดินทาง (user, 7–8 Oct 2026): four choices, one required, each opens its own fields —
   รถแผนก = the Lab's vehicles (tiles, clash check) · รถ GA = needGA + รูปแบบ / เวลารถออก / งานด่วน / ของต้องขน
   (+ the plate GA tells us) · ขอรถไปเอง = needGA + selfDrive + เวลารับรถ + เหตุผล (required) / รายละเอียด ·
   ไม่ใช้รถ = transport 'ไม่ใช้รถ'. รถ GA and ขอรถไปเอง share หมายเหตุถึง GA. */
const carMode=()=>(document.querySelector('input[name="car-mode"]:checked')||{}).value||'';
const radioVal=n=>(document.querySelector(`input[name="${n}"]:checked`)||{}).value||'';
const setRadio=(n,v)=>document.querySelectorAll(`input[name="${n}"]`).forEach(r=>{r.checked=r.value===v});
/* the form's car fields from a plan (older free-text reasons go to อื่นๆ + detail) */
function fillCarForm(v,cm,t){
  $('#f-transport').value=cm==='dept'?v.transport||'':'';
  $('#f-gaPlate').value=cm==='ga'&&v.transport&&v.transport!=='GA'&&v.transport!=='ไม่ใช้รถ'?v.transport:'';
  setRadio('ga-pat',cm==='ga'?v.gaPattern||'wait':'wait');$('#f-gaGo').value=cm==='ga'?v.gaGo||'':'';$('#f-gaUrgent').checked=cm==='ga'&&!!v.gaUrgent;
  const c=cm==='ga'&&v.gaCargo&&typeof v.gaCargo==='object'?v.gaCargo:null;
  $('#f-gaCargo').checked=!!c;$('#f-gaCargoSize').value=c&&c.size||'';$('#f-gaCargoCaution').value=c&&c.caution||'';
  $('#gaMoreBox').open=!!c||!!$('#f-gaPlate').value;
  $('#f-ownGo').value=cm==='own'?v.gaGo||'':'';
  const r=cm==='own'?v.carReason||'':'';const known=SELF_REASONS.includes(r);
  setRadio('self-why',known?r:r?'อื่นๆ':'');$('#f-carNote').value=cm==='own'?[known?'':r,v.carNote||''].filter(Boolean).join(' · '):'';
  $('#f-gaNote').value=cm==='ga'||cm==='own'?v.gaNote||'':'';
  $('#gaFromApp').innerHTML=t?gaInfoHtml(t):'';setCarMode(cm);
}
function carModeOf(t){if(!t)return '';if(t.selfDrive||(OWN_CAR.includes(t.transport)&&!t.needGA))return 'own';if(t.needGA||t.transport==='GA')return 'ga';const v=t.transport||'';if(v==='ไม่ใช้รถ')return 'none';if(OWN_CAR.includes(v))return 'own';return v?'dept':''}
function setCarMode(m){document.querySelectorAll('input[name="car-mode"]').forEach(r=>{r.checked=r.value===m});syncCarMode()}
function syncCarMode(){
  const m=carMode();$('#carDept').hidden=m!=='dept';$('#carGa').hidden=m!=='ga';$('#carOwn').hidden=m!=='own';
  $('#gaNoteBox').hidden=m!=='ga'&&m!=='own';$('#gaCargoBox').hidden=!$('#f-gaCargo').checked;if(m)$('#carErr').hidden=true;
  document.querySelectorAll('.car-mode label').forEach(l=>l.classList.toggle('on',l.querySelector('input').checked));
  if(m==='dept'){syncTrAdd();renderTrGrid()}
}
/* the plan's car fields as saved, from the open choice (fields of the other choices are cleared) */
function carForm(){
  const m=carMode();const blank={needGA:false,selfDrive:false,gaGo:'',gaBack:'',gaPattern:'',gaUrgent:false,gaCargo:null,gaNote:'',carReason:'',carNote:''};
  const note=$('#f-gaNote').value.trim();
  if(m==='dept')return Object.assign(blank,{transport:normTransport($('#f-transport').value)});
  if(m==='ga')return Object.assign(blank,{transport:normTransport($('#f-gaPlate').value),needGA:true,gaGo:$('#f-gaGo').value,gaPattern:radioVal('ga-pat')||'wait',gaUrgent:$('#f-gaUrgent').checked,
    gaCargo:$('#f-gaCargo').checked?{size:$('#f-gaCargoSize').value.trim(),caution:$('#f-gaCargoCaution').value.trim()}:null,gaNote:note});
  if(m==='own')return Object.assign(blank,{transport:'',needGA:true,selfDrive:true,gaGo:$('#f-ownGo').value,carReason:radioVal('self-why'),carNote:$('#f-carNote').value.trim(),gaNote:note});
  if(m==='none')return Object.assign(blank,{transport:'ไม่ใช้รถ'});
  return Object.assign(blank,{transport:''});
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
/* job types grouped by สายงาน (Flow Meter, Instrument, then the ones used by both) once any type has a line */
function typeOptions(cur,blank){
  const l=activeTypes().slice();if(cur&&!l.some(t=>t.id===cur)){const t=jobTypes().find(x=>x.id===cur);l.push(t||{id:cur,name:cur})}
  const opt=t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`;
  const head=blank?`<option value="">${blank}</option>`:'';
  if(!l.some(t=>LINE[t.line]))return head+l.map(opt).join('');
  return head+LINES.map(ln=>{const g=l.filter(t=>t.line===ln.id);return g.length?`<optgroup label="${esc(ln.name)}">${g.map(opt).join('')}</optgroup>`:''}).join('')
    +(()=>{const g=l.filter(t=>!LINE[t.line]);return g.length?`<optgroup label="ใช้ได้ทั้งสองสาย">${g.map(opt).join('')}</optgroup>`:''})();
}
/* สายงาน field of the plan form: hidden for leave; a job type that belongs to one line selects it.
   Not required (user, 6 Oct 2026): "ทั้งสองสาย" (value '') = no line, the plan shows on both tabs */
$('#f-line').innerHTML=LINES.concat([LINE_BOTH]).map(l=>`<label style="--lc:${l.color}"><input type="radio" name="f-line" id="f-line-${l.id||'both'}" value="${l.id}"><span><span class="ls-ico">${l.icon}</span><span class="ls-t"><b>${esc(l.short)}</b><small>${esc(l.id?l.tag:'ไม่ระบุสาย')}</small></span></span></label>`).join('');
const curLine=()=>($('#f-type').value==='leave'?'':((document.querySelector('input[name="f-line"]:checked')||{}).value||''));
function setLine(id){const v=LINE[id]?id:'';document.querySelectorAll('input[name="f-line"]').forEach(r=>{r.checked=r.value===v})}
function syncLineField(fromType){
  const leave=$('#f-type').value==='leave';document.querySelectorAll('#formFields .line-row').forEach(el=>{el.hidden=leave});
  const ty=jobTypes().find(x=>x.id===$('#f-type').value);const own=ty&&LINE[ty.line]?ty.line:'';
  if(fromType&&own)setLine(own);
  $('#lblLine small').textContent=own?`หัวข้องานนี้เป็นของ ${LINE[own].short}`:'ไม่บังคับ · หัวข้องานนี้ใช้ได้ทั้งสองสาย';
}
$('#f-type').addEventListener('change',()=>syncLineField(true));
