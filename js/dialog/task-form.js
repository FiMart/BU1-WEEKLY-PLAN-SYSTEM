'use strict';
/* BU1 Weekly Plan · plan drawer: open/view/edit, validation, save, delete, copy */
function defaultDate(){const td=ymd(new Date());const {from,to}=weekRange();return td>=from&&td<=to?td:from}
/* a new plan made from a booking (js/features/jobs.js, planFromJob): its id goes into task.jobId on save */
let formJobId='';
function openTask(id,preset){
  const t=id?findTask(id):null;if(id&&!t)return;
  editing=t;const p=preset||{};const jb=!t&&p.job?p.job:null;formJobId=jb?jb.id:'';
  const v=t||{jobType:p.type||'',customer:p.customer||'',period:PERIOD[p.period]?p.period:'full',status:'planned',date:p.date||defaultDate(),staffIds:Array.isArray(p.staff)?p.staff.slice():p.staff?[p.staff]:[]};
  /* ใบรับคำร้อง → แผน: every field the booking has, so nothing from the customer is typed twice (user, 15 Oct 2026) */
  if(jb)Object.assign(v,{location:jb.location||'',contact:jb.contact||'',contactTel:jb.contactTel||'',sale:jb.sale||'',detail:[jb.detail||''].concat((jb.items||[]).map((it,i)=>`- ${jbItemText(it)}`)).filter(Boolean).join('\n'),planNo:jb.planNo||'',calItems:jb.line==='fm'?(jb.items||[]).map(it=>({id:newId('c'),reqNo:jb.planNo||'',tag:it.tag||'',size:it.size?it.size+'\"':'',type:it.type||'',fluid:'',range:it.range||'',points:it.points||'',round:it.round||'',lab:'',status:'add',result:'',detail:''})):[],teamNeed:jb.teamNeed||0,request:[jb.qty,jb.poNo?'PO / ใบเสนอราคา '+jb.poNo:'',jb.note].filter(Boolean).join('\n')});
  const tid=t?typeIdOf(t):(p.type&&jobTypes().some(x=>x.id===p.type)?p.type:'');
  $('#f-type').innerHTML=typeOptions(tid,'— เลือกหัวข้องาน —');$('#f-type').value=tid;
  $('#f-typeOther').value=t&&tid==='other'?typeLabel(t)==='อื่นๆ'?'':typeLabel(t):jb&&tid==='other'?jb.jobTypeOther||'':'';syncTypeOther();fillTypeQ();
  /* สายงาน: the plan's own, else its job type's, else (new plan) the open tab */
  setLine(t?lineOf(t):(LINE[(jobTypes().find(x=>x.id===tid)||{}).line]?jobTypes().find(x=>x.id===tid).line:LINE[p.line]?p.line:''));syncLineField(false);
  $('#f-planno').value=v.planNo||'';$('#f-planhint').hidden=true;$('#f-color').value=ownColor(v);renderColorPick();
  const sl=sales().map(s=>s.name);DEFAULT_SALES.forEach(n=>{if(!sl.some(x=>norm(x)===norm(n)))sl.push(n)});if(v.sale&&!sl.some(n=>norm(n)===norm(v.sale)))sl.push(v.sale);
  $('#f-sale').innerHTML=`<option value="">— เลือก Sale —</option>`+sl.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');$('#f-sale').value=v.sale||'';syncSaleTel();
  $('#f-customer').value=v.customer||'';$('#f-location').value=v.location||'';fillAreaSelect(v.areaId||'');$('#f-sharedTeam').checked=!!v.sharedTeam;syncSharedArea();
  $('#f-date').value=v.date;$('#f-until').value='';$('#f-period').value=periodOf(v);$('#f-timeNote').value=v.timeNote||'';
  $('#f-detail').value=detailOf(v);$('#f-request').value=v.request!=null?v.request:(v.note||'');
  fillTransportList();fillCarForm(v,carModeOf(t?v:null),t);syncTrAdd();renderTrGrid();
  $('#f-contact').value=v.contact||'';$('#f-contactTel').value=v.contactTel||'';
  pickGuests=(v.guests||[]).slice();$('#tpGuest').value='';loadPrep(v);loadCal(v);loadIns(v);
  if(t)renderDrawerView(t);else $('#dView').innerHTML='';
  loadPhotos(v.photoIds||[]);loadFiles(t);
  const st=form.querySelector(`#f-st-${v.status||'planned'}`);if(st)st.checked=true;
  $('#f-reason').value=v.statusNote||'';$('#f-doneSum').value=v.doneSum||'';syncReason();
  $('#f-teamNeed').value=v.teamNeed>0?v.teamNeed:'';
  pickSel=new Set(v.staffIds||[]);pickPool=null;pickTeam=null;$('#tpQ').value='';$('#tpFree').checked=false;$('#tpAllowBusy').checked=false;
  renderPickSel();renderPickerList();
  $('#untilWrap').hidden=!!t;$('#copyBox').open=false;if(jb&&jb.wantTo&&jb.wantTo>v.date)$('#f-until').value=jb.wantTo;/* a booking over several days → one plan a day */
  if(t){const nx=ymd(addDays(parseD(t.date),1));$('#cp-from').value=nx;$('#cp-to').value=nx;$('#cp-type').innerHTML=`<option value="">เหมือนเดิม (${esc(typeLabel(t))})</option>`+typeOptions('','');$('#cp-type').value=''}
  $('#formFields').disabled=!(S.canWrite||(t&&can('ga')));
  resetDel();$('#f-err').hidden=true;$('#f-conf').hidden=true;
  const meta=$('#f-meta');meta.textContent='';
  if(t&&t.updatedAt){const when=new Date(t.updatedAt);const whenTxt=isNaN(when)?'':`${fmtShort(when)} ${be(when)} ${pad(when.getHours())}:${pad(when.getMinutes())} น.`;
    meta.textContent=`แก้ไขล่าสุด ${whenTxt}`;
    if(t.updatedBy)whoLabel(t.updatedBy).then(w=>{if(w&&editing===t)meta.textContent=`แก้ไขล่าสุดโดย ${w} · ${whenTxt}`})}
  const hist=S.tasks.concat(ALL.data||[...known.values()]);
  const opt=list=>[...new Set(list.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,400).map(c=>`<option value="${esc(c)}">`).join('');
  $('#dl-customers').innerHTML=opt(hist.map(x=>x.customer));
  $('#dl-locations').innerHTML=opt(hist.map(x=>x.location));
  $('#dl-contacts').innerHTML=opt(hist.map(x=>x.contact));
  $('#dl-guests').innerHTML=opt(hist.flatMap(x=>x.guests||[]));
  mdFormNote(null,true);mdFormSync();/* Sale / รถ / หัวข้องาน in the master spelling (js/features/md-sync.js) */
  if(!dlg.open)dlg.showModal();
  setMode(t?'view':'edit');
  if(!t)setTimeout(()=>$('#f-typeQ').focus(),30);
  checkPlanNo();
}
/* who saved a plan: profile name with the e-mail beside it, or just the e-mail */
async function whoLabel(id){
  if(!id)return '';let n='';
  if(users){try{n=((await users.profiles([id]))[id]||{}).name||''}catch(e){}}
  const mail=/@/.test(id)?id:'';
  return n&&n!==mail?(mail?`${n} (${mail})`:n):mail;
}
/* plans saved before createdBy existed: the last writer is the creator when the plan was never edited */
const creatorOf=t=>t.createdBy||(t.createdAt&&t.createdAt===t.updatedAt?t.updatedBy:'')||'';
/* the drawer opens a card in read mode (like a job sheet); แก้ไข switches to the form */
let dMode='edit';
/* the drawer header takes the plan's colour (its own, else its Plan No.'s; job types have none since 9 Oct 2026) */
function syncDrawerColor(){
  const c=dMode==='view'&&editing?planColor(editing):$('#f-color').value||planNoColor($('#f-planno').value);
  dlg.style.setProperty('--dc',c||'var(--accent)');
}
/* GA level: can open an existing plan and change only the car (รถ / Car + ต้องการรถส่วนกลาง) */
const gaOnlyEdit=()=>!S.canWrite&&!!editing&&can('ga');
function lockForGa(on){
  form.classList.toggle('ga-only',on);
  $('#formFields').querySelectorAll('input,select,textarea,button').forEach(el=>{
    if(el.closest('#carGa'))return;/* GA fills the plate and the times; the other car choices stay locked */
    if(on){if(!el.disabled){el.disabled=true;el.dataset.gaLock='1'}}else if(el.dataset.gaLock){el.disabled=false;delete el.dataset.gaLock}
  });
}
function setMode(m){
  dMode=m;const view=m==='view';const t=editing;const w=S.canWrite;const ga=gaOnlyEdit();
  syncDrawerColor();lockForGa(!view&&ga);
  /* a plan with Weekly plan calibration / instrument rows opens wide enough for its sheet (user, 7 Oct 2026) */
  const sheets=!!t&&(calOf(t).length>0||insOf(t).length>0);
  $('#dView').hidden=!view;$('#formFields').hidden=view;dlg.classList.toggle('wide',!view||sheets);dlg.classList.toggle('sheets',sheets);
  $('#btnEdit').hidden=!view||!(w||ga);$('#btnEditTxt').textContent=ga?'ระบุรถ / ทะเบียน':'แก้ไข';$('#btnSave').hidden=view||!(w||ga);
  $('#btnDel').hidden=view||!t||!can('del');$('#btnDup').hidden=!t||!w;$('#copyBox').hidden=!t||!w;
  $('#f-err').hidden=true;
  if(view&&t){$('#dlgTitle').textContent=t.planNo?`${t.planNo} · ${typeLabel(t)}`:typeLabel(t);$('#dlgSub').textContent=[t.customer,t.location].filter(Boolean).join(' · ')}
  else if(ga){$('#dlgTitle').textContent='ระบุรถ (GA)';$('#dlgSub').textContent=[t.planNo,typeLabel(t),fmtDayY(t.date)].filter(Boolean).join(' · ')+' · แก้ได้เฉพาะช่องรถ'}
  else{$('#dlgTitle').textContent=t?'แก้ไขแผนงาน':'เพิ่มแผนงาน';$('#dlgSub').textContent=t?[t.planNo,typeLabel(t),fmtDayY(t.date)].filter(Boolean).join(' · '):'กรอกตามลำดับ · เลือก Team Service ตอนนี้ หรือเพิ่มทีหลังก็ได้'}
  const body=dlg.querySelector('.dlg-body');if(body)body.scrollTop=0;
  formSnap=view?null:formKey();/* what "not saved yet" is measured against (closeTaskDlg) */
  checkConflicts();
}
/* leave and ประเภทระบบ plans have no สถานะงาน (user, 14 Oct 2026; noStatusId): always saved as planned */
const curStatus=()=>noStatusId($('#f-type').value)?'planned':(form.querySelector('input[name="f-status"]:checked')||{}).value||'planned';
function syncReason(){const s=curStatus();$('#f-reasonWrap').hidden=!NEEDS_REASON.has(s);$('#f-reasonLbl').textContent=reasonLabel(s);
  $('#f-sumWrap').hidden=s!=='done'||isLeaveId($('#f-type').value)}/* สรุปงาน (js/dialog/done-sum.js) */
/* สีของแผน from the plan view (user, 9 Oct 2026: "แก้ไขสีที่แผนงานได้เลย"): '' = ตาม Plan No. */
async function setPlanColor(c){
  if(!editing||!S.canWrite)return;const color=/^#[0-9a-f]{6}$/i.test(c||'')?String(c).toLowerCase():'';if(color===ownColor(editing))return;
  const id=editing.id;
  try{await Store.update('tasks',id,Object.assign({color},meta()));editing=Object.assign({},editing,{color});noteRecentColor(color);
    renderDrawerView(editing);renderPhotos();renderFiles();syncDrawerColor();toast(color?'เปลี่ยนสีของแผนแล้ว':'ใช้สีตาม Plan No. แล้ว')}
  catch(err){toast(errText(err));noteWriteError(err)}
}
/* extra = more fields saved with it (สรุปงาน when it becomes เสร็จแล้ว, js/dialog/done-sum.js); msg = the toast instead of the status one */
async function saveViewStatus(val,note,extra,msg){
  if(!editing)return;const id=editing.id;const ch=Object.assign({status:val,statusNote:NEEDS_REASON.has(val)?note:''},extra||{});
  try{await Store.update('tasks',id,Object.assign({},ch,meta()));
    editing=Object.assign({},editing,ch);
    const r=$('#f-st-'+val);if(r)r.checked=true;$('#f-reason').value=editing.statusNote;$('#f-doneSum').value=editing.doneSum||'';syncReason();
    renderDrawerView(editing);renderPhotos();renderFiles();
    const what=msg||(val==='done'&&extra&&extra.doneSum?'ยืนยันงานเสร็จพร้อมสรุปงานแล้ว':`บันทึกสถานะ “${stTh(val)}”${NEEDS_REASON.has(val)&&note?' พร้อมเหตุผล':''} แล้ว`);
    if(val==='done'&&docMissing(editing).length){toast(`${what} · ส่งเอกสารหลังจบงานด้านล่าง: ${docMissing(editing).map(k=>DOC_NAME[k]).join(', ')}`);const b=$('#vReport');if(b)b.scrollIntoView({block:'nearest',behavior:reduceMotion()?'auto':'smooth'})}
    else toast(what)}
  catch(err){toast(errText(err));noteWriteError(err);renderDrawerView(editing);renderPhotos()}
}
/* หมายเหตุ in the plan view (user, 9 Oct 2026): last section, right above ประวัติการแก้ไข (ISO 9001); read-only for people without status rights (GA) */
const remarkBox=t=>t&&t.remark?`<div class="remark-box"><b>📝 หมายเหตุ</b><span>${esc(t.remark)}</span></div>`:'';
/* หมายเหตุ is written here, not in the edit form (user, 9 Oct 2026: "ย้ายหัวข้อ หมายเหตุ … ข้างบน หัวข้อประวัติการแก้ไข (ISO 9001)"); saved at once */
const remarkEdit=t=>`<div class="v-remark"><label for="v-remark">📝 หมายเหตุ</label><textarea id="v-remark" rows="2" maxlength="1000" placeholder="เช่น โทรแจ้งลูกค้าก่อนเข้า 1 วัน · ใช้ประตู 3 · เตรียมบัตรผ่านโรงงาน">${esc(t.remark||'')}</textarea>
  <div class="v-row"><button type="button" class="btn sm" data-action="save-vremark" id="vRemarkSave">บันทึกหมายเหตุ</button>${t.remark?'<button type="button" class="lnk" data-action="clear-vremark">ลบหมายเหตุ</button>':''}</div></div>`;
async function saveViewRemark(text){
  if(!editing||!canWork())return;const remark=String(text||'').trim().slice(0,1000);if(remark===(editing.remark||''))return;const id=editing.id;
  try{await Store.update('tasks',id,Object.assign({remark},meta()));editing=Object.assign({},editing,{remark});renderDrawerView(editing);renderPhotos();renderFiles();toast(remark?'บันทึกหมายเหตุแล้ว':'ลบหมายเหตุแล้ว')}
  catch(err){toast(errText(err));noteWriteError(err)}
}
/* a redraw of the plan view never throws away what someone is typing (user, 21 Oct 2026: "กล่องข้อความตรง สรุปงาน กับ หมายเหตุ
   เวลาพิมพ์หรือแก้ไข ไม่ให้เด้งออก … แก้ไขกล่องข้อความทั้งระบบ"): unsaved text in its fields, the caret and the scroll stay (keepTyping) */
function renderDrawerView(t){const v=$('#dView');const same=v&&t&&v.dataset.tid===t.id;keepTyping(v,()=>{drawDrawerView(t);if(v&&t)v.dataset.tid=t.id},same)}
/* background redraws (Safety re-read, an upload finishing, NCR / Check Sheet closed, …) wait while a field in the view is being typed in,
   and keep an open สรุปงาน editor open with its text */
let drawerLater=false;
function refreshDrawerView(){
  if(typeof dlg==='undefined'||!dlg.open||!editing||dMode!=='view')return;
  const v=$('#dView');const ae=document.activeElement;
  if(v&&ae&&v.contains(ae)&&isTyping(ae)){drawerLater=true;return}
  drawerLater=false;const sum=$('#v-doneSum');const sumTxt=sum?sum.value:null;const conf=editing.status!=='done';/* not done yet = the editor confirms เสร็จแล้ว */
  renderDrawerView(editing);renderPhotos();renderFiles();
  if(sumTxt!=null&&!$('#v-doneSum')){sumSlot(sumEditHtml(editing,conf));const ta=$('#v-doneSum');if(ta)ta.value=sumTxt}
}
document.addEventListener('focusout',e=>{if(!drawerLater||!e.target.closest||!e.target.closest('#dView'))return;
  afterPointer(()=>{const v=$('#dView');const ae=document.activeElement;if(drawerLater&&!(v&&ae&&v.contains(ae)&&isTyping(ae)))refreshDrawerView()})});
function drawDrawerView(t){
  const ty=typeOf(t);const st=STATUS[t.status]||STATUS.planned;const d=parseD(t.date);
  const pool=S.tasks.some(x=>x.id===t.id)?S.tasks:[t];const conf=conflictsFor(t,pool);
  const confStaff=new Set(conf.flatMap(x=>x.staff));const tel=saleTel(t.sale);
  let kk=0;const f=(k,v,cls,wide)=>`<div class="${wide?'wide':''}" style="--k:${++kk}"><dt>${k}</dt><dd class="${v?cls||'':'dash'}">${v?esc(v):'—'}</dd></div>`;
  const people=(t.staffIds||[]).map(id=>{const s=staffById(id)||{};const n=staffName(id);return `<span class="${confStaff.has(id)?'conf':''}"><span class="avatar" aria-hidden="true">${esc(initialOf(n))}</span>${esc(n)}${s.role?` <small>${esc(s.role)}</small>`:''}${cardBadge(cardOf(id,t.areaId))}</span>`})
    .concat((t.guests||[]).map(g=>`<span class="guest"><span class="avatar" aria-hidden="true">${esc(initialOf(g))}</span>${esc(g)} <small>แผนกอื่น</small></span>`));
  const ln=LINE[lineOf(t)];
  $('#dView').innerHTML=`<div class="dv-badges">${noStatus(t)?'':`<span class="badge" style="--c:${st.color}"><i></i>${esc(st.th)}</span>`/* leave: no สถานะงาน */}${ln?`<span class="badge" style="--c:${ln.color}"><i></i>${esc(ln.name)}</span>`:''}<span class="badge" style="--c:${planColor(t)}"><i></i>${esc(typeLabel(t))}</span><span class="badge" style="--c:var(--accent)">${esc(pName(t))}</span></div>
    ${S.canWrite&&!isLeave(t)?`<div class="dv-color"><span>สีของแผน</span><div class="pc-pick">${colorPickHtml(t.color,t.planNo,'data-pcv')}</div></div>`:''}
    <div class="dv-by"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>ผู้จองแผน <b id="dvBy" class="dash">—</b></div>
    ${typeof jbPlanBox==='function'?jbPlanBox(t):''}
    ${NEEDS_REASON.has(t.status)&&!noStatus(t)?`<div class="reason-box ${esc(t.status)}"><b>${statusFlag(t.status)} · เหตุผล / ปัญหาที่หน้างาน</b><span>${t.statusNote?esc(t.statusNote):'<i>ยังไม่ได้ใส่เหตุผล</i>'}</span></div>`:''}
    ${!noStatus(t)&&(t.status==='notdone'||t.ncrId)?ncrLinkHtml(t):''}
    <div><button type="button" class="btn sm" data-action="copy-card"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/></svg> คัดลอกข้อความ</button></div>
    ${conf.length?`<div class="conf-box"><b>⚠ ${esc(confLabel(conf))}</b>${conf.slice(0,4).map(c=>`<span>ชนกับ ${esc(pName(c.other))} · ${esc(typeLabel(c.other))}${c.other.planNo?' '+esc(c.other.planNo):''}${c.other.customer?' · '+esc(c.other.customer):''}</span>`).join('')}</div>`:''}
    <dl class="dv-f">
      ${f('Plan No.',t.planNo,'mono')}${f('หัวข้องาน / Job',typeLabel(t))}${f('วันที่ทำงาน',`${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)} · ${pName(t)}`)}${f('Time',t.timeNote)}
      ${f('Customer',t.customer)}${f('Location',t.location)}${t.areaId?f('พื้นที่ (Safety)',areaName(t.areaId)):''}${f('Detail',detailOf(t).trim(),'',true)}
      ${(t.photoIds||[]).length?'<div class="wide" style="--k:8"><dt>รูปประกอบ</dt><dd class="dv-ph" id="dvPhotos"></dd></div>':''}
      ${(t.files||[]).length?`<div class="wide" style="--k:9"><dt>ไฟล์แนบ (${t.files.length})</dt><dd class="dv-files" id="dvFiles"></dd></div>`:''}
      ${reportViewHtml(t,9)}
      ${calViewHtml(t,9)}${insViewHtml(t,9)}
      ${f('Request',t.request,'',true)}
      ${prepViewHtml(t,10)}
      <div class="${gaInfo(t)?'wide':''}" style="--k:10"><dt>Transport / รถ</dt><dd class="${t.transport||t.needGA?'':'dash'}">${transportChip(t.transport,t)||esc(t.transport||'—')}${gaTimes(t)?`<span class="ga-when">${esc(gaTimes(t))}</span>`:''}${gaInfoHtml(t)}${(t.selfDrive||OWN_CAR.includes(t.transport)&&!t.needGA)&&ownCarText(t)?`<small class="car-why">${esc(ownCarText(t))}</small>`:''}${gaNoteText(t)?`<small class="car-why">📝 ${esc(gaNoteText(t))}</small>`:''}${gaWaiting(t)?'<small class="ga-note">ขอรถ GA แล้ว · แอปจองรถส่วนกลาง GA จะส่งข้อมูลรถ (ทะเบียน รถ คนขับ เวลาออก) มาที่แผนนี้เองเมื่อ GA จัดรถ</small>':''}</dd></div>
      ${f('Contact',[t.contact,t.contactTel].filter(Boolean).join(' · '))}${f('Sale',[t.sale,tel].filter(Boolean).join(' · '))}
      <div class="wide" style="--k:13"><dt>Team Service (${people.length} คน${teamNeedOf(t)?` จาก ${teamNeedOf(t)} คน`:''})${teamNeedOf(t)?` <span class="tneed-v ${teamShort(t)?'short':'ok'}">${esc(teamNeedText(t))}</span>`:''}</dt><dd class="dv-pp">${people.join('')||'<span class="dash">—</span>'}${t.sharedTeam?'<span class="dv-share" title="คนในทีมทำงานอื่นในพื้นที่เดียวกันวันเดียวกันได้ ไม่นับว่าคนซ้ำ (ต้องเปิดทั้งสองงาน)">⇄ ใช้ทีมร่วมกับงานอื่นในพื้นที่เดียวกัน</span>':''}${cardSummary(t.staffIds||[],t.areaId)}</dd></div>
    </dl>
    ${canWork()&&noStatus(t)&&!isLeave(t)?`<div class="dv-status nost">${reportBoxHtml(t)}</div>`:''/* ประเภทระบบ: no status, documents still attachable */}${canWork()&&!noStatus(t)?`<div class="dv-status"><b>สถานะงาน · กดเพื่อบันทึกผลของงานนี้</b><div class="seg" role="radiogroup" aria-label="สถานะงาน">${STATUSES.map(s=>`<label><input type="radio" name="v-status" id="v-st-${s.id}" value="${s.id}"${(t.status||'planned')===s.id?' checked':''}><span><span class="s-${s.id}">${s.icon}</span>${s.th}</span></label>`).join('')}</div>
      <div id="vSumSlot">${sumViewHtml(t,true)}</div>
      ${reportBoxHtml(t)}
      <div class="v-reason" id="vReason"${NEEDS_REASON.has(t.status)?'':' hidden'}><label for="v-reason" id="vReasonLbl">${esc(reasonLabel(t.status))}</label><textarea id="v-reason" rows="3" maxlength="600" placeholder="เช่น ลูกค้าขอเลื่อน ไลน์ผลิตยังไม่หยุด · อะไหล่ไม่พร้อม · ไม่ได้ Work Permit · ฝนตกเข้าพื้นที่ไม่ได้">${esc(t.statusNote||'')}</textarea>
        <div class="v-row"><button type="button" class="btn primary sm" data-action="save-vreason" id="vReasonSave">บันทึก${NEEDS_REASON.has(t.status)?'เหตุผล':''}</button></div></div></div>`:''}
    ${typeof csPlanHtml==='function'?csPlanHtml(t):''/* Check Sheet of this plan (js/features/checksheets.js) */}
    ${canWork()?'':sumViewHtml(t,false)}
    ${canWork()?remarkEdit(t):remarkBox(t)}
    ${isoHistoryHtml(t)}`;
  sumWho(t);
  const by=$('#dvBy');whoLabel(creatorOf(t)).then(w=>{if(w&&by.isConnected){by.textContent=w;by.classList.remove('dash')}});
}
/* the car fields come from carForm(): only the open วิธีเดินทาง choice keeps its fields */
function readForm(){
  const typeId=$('#f-type').value;const ty=jobTypes().find(x=>x.id===typeId);
  const g=$('#tpGuest')&&$('#tpGuest').value.trim();
  return mdClean({photoIds:photoItems.map(p=>p.id),fileIds:fileItems.map(f=>f.id),files:fileMeta(),jobType:typeId,line:curLine(),jobTypeOther:typeId==='other'?$('#f-typeOther').value.trim():'',jobTypeName:ty?ty.name:'',
    planNo:cleanPlan($('#f-planno').value),color:$('#f-color').value,sale:$('#f-sale').value,customer:$('#f-customer').value.trim(),location:$('#f-location').value.trim(),areaId:$('#f-area').value,sharedTeam:$('#f-sharedTeam').checked,
    date:$('#f-date').value,period:$('#f-period').value,timeNote:$('#f-timeNote').value.trim(),
    detail:$('#f-detail').value.replace(/\s+$/,'').replace(/^\s*\n/,''),request:$('#f-request').value.trim(),
    ...carForm(),contact:$('#f-contact').value.trim(),contactTel:$('#f-contactTel').value.trim(),
    prep:prepForSave(),calItems:calForSave(),insItems:insForSave(),teamNeed:isLeaveId(typeId)?0:teamNeedIn(),staffIds:[...pickSel],guests:pickGuests.concat(g&&!pickGuests.some(x=>norm(x)===norm(g))?[g.slice(0,80)]:[]),
    jobId:editing?editing.jobId||'':formJobId,/* ใบรับคำร้องขอรับบริการสอบเทียบ it was made from */
    status:curStatus(),statusNote:NEEDS_REASON.has(curStatus())?$('#f-reason').value.trim():'',
    /* สรุปงาน: written while เสร็จแล้ว is picked; another status keeps the stored one */
    ...(curStatus()==='done'&&!isLeaveId(typeId)?sumStamp($('#f-doneSum').value.trim().slice(0,3000),editing):{})});/* mdClean: Sale / รถ / หัวข้องาน saved in the master spelling */
}
form.addEventListener('change',e=>{
  if(e.target.id==='f-customer'&&!$('#f-contact').value.trim()){const c=norm(e.target.value);const hit=S.tasks.concat(ALL.data||[]).filter(t=>norm(t.customer)===c&&t.contact).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0];
    if(hit){$('#f-contact').value=hit.contact;if(!$('#f-contactTel').value.trim())$('#f-contactTel').value=hit.contactTel||''}}
});

/* Plan No. is typed by the user in PN-YY-MMNNN; a wrong shape or a number used on another day only raises a notice */
const cleanPlan=s=>String(s||'').trim().replace(/\s+/g,'').toUpperCase().slice(0,40);
let planChkTimer=null;
function checkPlanNo(){
  clearTimeout(planChkTimer);
  planChkTimer=setTimeout(async()=>{
    const hint=$('#f-planhint');const pn=cleanPlan($('#f-planno').value);
    if(!pn){hint.hidden=true;return}
    if(!PLAN_RE.test(pn)){hint.hidden=false;hint.className='hint warn';hint.textContent='รูปแบบควรเป็น PN-YY-MMNNN เช่น PN-26-09004 (YY = ปี ค.ศ. 2 หลัก, MM = เดือน 01–12, NNN = ลำดับ)';return}
    let hits=[];try{hits=await Store.where('tasks','planNo','==',pn)}catch(e){hits=S.tasks.filter(t=>t.planNo===pn)}
    hits=hits.filter(t=>!editing||t.id!==editing.id).sort(byTime);
    if(cleanPlan($('#f-planno').value)!==pn)return;
    if(!hits.length){hint.hidden=true;return}
    const h=hits[0];hint.hidden=false;hint.className='hint';
    hint.textContent=`Plan No. นี้มีอยู่แล้ว ${hits.length} แผน เช่น ${fmtDay(h.date)} ${typeLabel(h)}${h.customer?' · '+h.customer:''} (งานต่อเนื่องใช้เลขเดียวกันได้)`;
  },350);
}
$('#f-planno').addEventListener('input',checkPlanNo);
$('#f-planno').addEventListener('change',e=>{e.target.value=cleanPlan(e.target.value)});
function datesFor(v){
  const until=$('#untilWrap').hidden?'':$('#f-until').value;
  if(!v.date)return [];if(!until||until<=v.date)return [v.date];
  const out=[];const skip=$('#f-skipsun').checked;
  for(let d=parseD(v.date);ymd(d)<=until&&out.length<31;d=addDays(d,1)){if(skip&&d.getDay()===0)continue;out.push(ymd(d))}
  return out;
}
async function poolFor(dates){
  const {from,to}=weekRange();if(!dates.some(d=>d<from||d>to))return S.tasks;
  try{const a=dates.slice().sort();return await Store.range('tasks',a[0],a[a.length-1])}catch(e){return S.tasks}
}
function checkConflicts(){
  clearTimeout(confTimer);
  confTimer=setTimeout(async()=>{
    const ok=$('#f-ok');
    if(dMode==='view'){$('#f-conf').hidden=true;ok.hidden=true;$('#btnSave').textContent='บันทึก';return}
    const v=readForm();const dates=datesFor(v);const box=$('#f-conf');
    if(!dates.length){box.hidden=true;ok.hidden=true;return}
    const pool=await poolFor(dates);
    pickPool=pool;renderPickerList();
    const found=[];
    for(const d of dates){for(const c of conflictsFor(Object.assign({},v,{id:editing?editing.id:'__new',date:d}),pool))found.push(Object.assign({date:d},c))}
    const full=editing&&editing.date===v.date?[]:dates.filter(d=>pool.filter(t=>t.date===d&&(!editing||t.id!==editing.id)).length>=MAX_CARDS);
    if(!found.length&&!full.length){box.hidden=true;ok.hidden=!(v.staffIds.length||v.guests.length);$('#btnSave').textContent='บันทึก';return}
    box.hidden=false;ok.hidden=true;$('#btnSave').textContent=found.length?'บันทึก (มีการจัดชน)':'บันทึก';
    box.innerHTML=(found.length?`<b>⚠ จัดชนกับแผนอื่น ${found.length} รายการ</b>`+found.slice(0,6).map(c=>{const who=c.staff.map(staffName);const what=[who.length?(c.leave?'ติดลา: ':'คนชน: ')+who.join(', '):'',c.veh?'รถที่ใช้งานซ้ำกัน: '+c.veh:''].filter(Boolean).join(' · ');
        return `<span>${esc(fmtDay(c.date))} ${esc(pName(c.other))} · ${esc(typeLabel(c.other))}${c.other.planNo?' '+esc(c.other.planNo):''}${c.other.customer?' · '+esc(c.other.customer):''} → ${esc(what)}</span>`}).join('')+(found.length>6?`<span>และอีก ${found.length-6} รายการ</span>`:''):'')
      +(full.length?`<b>⚠ ${full.map(fmtDay).join(', ')} มีแผนครบ ${MAX_CARDS} แผนแล้ว</b>`:'')
      +'<span class="hint">บันทึกได้ แต่ควรปรับช่วงเวลา คน หรือรถก่อนแจกแผน</span>';
  },250);
}
form.addEventListener('input',checkConflicts);form.addEventListener('change',checkConflicts);
/* the form never closes from a click beside it (user, 15 Oct 2026: "ป้องกันไม่ให้กดตรงพื้นที่ว่างๆของ form เพื่อปิด");
   ✕ / ปิด / Esc ask first while the edit form holds changes not saved (formSnap = readForm() when the form opened) */
let formSnap=null;
const formKey=()=>{try{return JSON.stringify(readForm())}catch(e){return null}};
const formDirty=()=>dlg.open&&dMode==='edit'&&(S.canWrite||gaOnlyEdit())&&formSnap!==null&&formKey()!==formSnap;
async function closeTaskDlg(){
  if(formDirty()&&!await askConfirm('ยังไม่ได้บันทึก','แผนงานนี้มีข้อมูลที่ยังไม่ได้บันทึก ปิดฟอร์มโดยไม่บันทึกหรือไม่?','ปิดโดยไม่บันทึก'))return;
  formSnap=null;if(dlg.open)dlg.close();
}
dlg.addEventListener('cancel',e=>{if(e.target===dlg&&formDirty()){e.preventDefault();closeTaskDlg()}});
dlg.addEventListener('close',()=>{formSnap=null});
function formError(msg){const el=$('#f-err');el.textContent=msg;el.hidden=!msg}
function validate(v,copy){
  if(!v.jobType)return ['พิมพ์ หรือเลือกหัวข้องานก่อนบันทึก','#f-typeQ'];
  if(v.jobType==='other'&&!v.jobTypeOther)return ['พิมพ์ชื่อหัวข้องาน (อื่นๆ)','#f-typeQ'];
  if(!v.date)return ['เลือกวันที่ของงาน','#f-date'];
  /* Team Service is optional (a plan can be booked first and staffed later); only a leave needs the person on leave */
  if(isLeaveId(v.jobType)&&!v.staffIds.length)return ['เลือกพนักงานที่ลาอย่างน้อย 1 คน','#tpQ'];
  /* วิธีเดินทาง is optional (user, 9 Oct 2026; was required since 8 Oct) */
  if(v.selfDrive){if(!v.gaGo)return ['ใส่เวลารับรถ (ขอรถไปเอง)','#f-ownGo'];if(!v.carReason)return ['เลือกเหตุผลที่ขอรถไปเอง','#selfWhy input'];
    if(v.carReason==='อื่นๆ'&&!v.carNote)return ['ใส่รายละเอียดเมื่อเลือกเหตุผล "อื่นๆ"','#f-carNote']}
  if(v.transport===NO_CAR&&v.carReason==='อื่นๆ'&&!v.carNote)return ['ระบุเหตุผลที่ไม่ใช้รถ (อื่นๆ)','#f-noneNote'];
  if(v.needGA&&!v.selfDrive&&v.gaCargo&&!v.gaCargo.size)return ['ใส่ของที่ขน / ขนาด (มีของต้องขน)','#f-gaCargoSize'];
  /* เสร็จแล้ว needs สรุปงาน (user, 14 Oct 2026); a copy starts as วางแผน */
  if(!copy&&v.status==='done'&&!isLeaveId(v.jobType)&&!v.doneSum)return ['เขียนสรุปงานก่อนบันทึกว่าเสร็จแล้ว','#f-doneSum'];
  return null;
}
const meta=()=>({updatedAt:new Date().toISOString(),updatedBy:S.me||null});
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(gaOnlyEdit()){/* GA saves only the car fields */
    const btn=$('#btnSave');btn.disabled=true;
    try{await Store.update('tasks',editing.id,Object.assign(carForm(),meta()));dlg.close();toast('บันทึกรถของแผนงานแล้ว')}
    catch(err){formError(errText(err))}finally{btn.disabled=false}
    return;
  }
  if(!S.canWrite)return;
  const v=readForm();const bad=validate(v);if(bad){formError(bad[0]);const el=$(bad[1]);if(el)el.focus();return}
  formError('');const btn=$('#btnSave');btn.disabled=true;$('#tpGuest').value='';pickGuests=v.guests.slice();
  const now=new Date().toISOString();
  try{
    if(photoItems.some(p=>p.isNew)){btn.textContent='กำลังบันทึกรูป…';await persistNewPhotos()}
    if(fileItems.some(f=>f.isNew)){await persistNewFiles((f,i,n)=>{btn.textContent=`อัปโหลดไฟล์ ${i+1}/${n}…`})}
    const name=v.planNo||typeLabel(v);let ncrFor=null;
    if(editing){
      const data=Object.assign({},editing,v,{sample:!!editing.sample,createdAt:editing.createdAt||now},meta());delete data.id;delete data.start;delete data.end;delete data.type;
      await Store.set('tasks',editing.id,data);
      const removed=(editing.photoIds||[]).filter(id=>!v.photoIds.includes(id));if(removed.length)cleanupPhotos(removed);
      const removedF=(editing.fileIds||[]).filter(id=>!v.fileIds.includes(id));if(removedF.length)cleanupFiles(removedF);
      toast(inWeek(v.date)?`บันทึก ${name} แล้ว`:`บันทึก ${name} แล้ว แผนย้ายไป${fmtDay(v.date)}`);
      if(v.status==='notdone'&&!ncrOfTask(editing)&&can('status'))ncrFor=Object.assign({id:editing.id},data);/* ไม่เสร็จ without an NCR yet */
    }else{
      const dates=datesFor(v);
      /* a multi-day job: the calibration rows go on its first day only, so the week's sheet counts each meter once */
      for(const [di,d] of dates.entries()){await Store.set('tasks',newId('t'),Object.assign({},v,di?{calItems:[],insItems:[]}:{},{date:d,sample:false,createdAt:now,createdBy:S.me||null},meta()))}
      if(S.sel.size){S.sel.clear();syncRowPicks()}
      toast(dates.length>1?`สร้าง ${name} แล้ว ${dates.length} แผน (${fmtDay(dates[0])} – ${fmtDay(dates[dates.length-1])})`:(inWeek(dates[0])?`สร้าง ${name} แล้ว`:`สร้าง ${name} แล้ว ในวัน${fmtDay(dates[0])}`));
    }
    noteRecentColor(v.color);/* สีที่ใช้ล่าสุด */
    dlg.close();
    if(ncrFor)openNcr(null,ncrFor);
  }catch(err){formError(errText(err));noteWriteError(err)}
  finally{btn.disabled=false;btn.textContent='บันทึก';checkConflicts()}
});
function inWeek(d){const {from,to}=weekRange();return d>=from&&d<=to}
let delArmed=null;
function resetDel(){const b=$('#btnDel');b.classList.remove('armed');b.textContent='ลบแผน';clearTimeout(delArmed);delArmed=null}
async function deleteTask(){
  if(!can('del'))return;const b=$('#btnDel');
  if(!delArmed){b.classList.add('armed');b.textContent='กดอีกครั้งเพื่อยืนยันการลบ';delArmed=setTimeout(resetDel,4000);return}
  resetDel();
  const pids=(editing.photoIds||[]).slice();const fids=(editing.fileIds||[]).concat(reportsOf(editing).map(f=>f.id));
  try{await Store.del('tasks',editing.id);known.delete(editing.id);dlg.close();toast('ลบแผนแล้ว');if(pids.length)cleanupPhotos(pids);if(fids.length)cleanupFiles(fids)}catch(err){formError(errText(err));noteWriteError(err)}
}
async function copyTo(dates,typeId){
  const v=readForm();
  const extra=typeId?{jobType:typeId,jobTypeName:(jobTypes().find(x=>x.id===typeId)||{}).name||'',jobTypeOther:typeId==='other'?v.jobTypeOther:''}:{};
  const bad=validate(Object.assign({},v,extra,{jobTypeOther:typeId==='other'?(v.jobTypeOther||'อื่นๆ'):v.jobTypeOther}),true);if(bad){formError(bad[0]);return false}
  const now=new Date().toISOString();
  try{await persistNewPhotos();await persistNewFiles();
    for(const d of dates)await Store.set('tasks',newId('t'),Object.assign({},v,extra,{date:d,status:'planned',statusNote:'',doneSum:'',doneBy:null,doneAt:'',prep:v.prep.map(p=>({text:p.text,done:false})),calItems:[],insItems:[],reports:[],docNA:[],sample:false,createdAt:now,createdBy:S.me||null},meta()));
    dlg.close();const nm=v.planNo||typeLabel(Object.assign({},v,extra));
    toast(dates.length>1?`ก๊อป ${nm} แล้ว ${dates.length} แผน (${fmtDay(dates[0])} – ${fmtDay(dates[dates.length-1])})`:`ก๊อป ${nm} ไป${fmtDay(dates[0])}แล้ว`);return true}
  catch(err){formError(errText(err));noteWriteError(err);return false}
}
function duplicateTask(){let d=addDays(parseD($('#f-date').value),1);if(!S.showSun&&d.getDay()===0)d=addDays(d,1);copyTo([ymd(d)],'')}
async function copyRange(){
  const a=$('#cp-from').value,b=$('#cp-to').value||a;
  if(!a){formError('เลือกวันที่เริ่มก๊อป');return}if(b<a){formError('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');return}
  const skip=$('#cp-skipsun').checked;const dates=[];
  for(let d=parseD(a);ymd(d)<=b&&dates.length<31;d=addDays(d,1)){if(skip&&d.getDay()===0)continue;dates.push(ymd(d))}
  if(!dates.length){formError('ไม่มีวันให้ก๊อป (ช่วงที่เลือกมีแต่วันอาทิตย์)');return}
  const btn=$('#btnCopy');btn.disabled=true;await copyTo(dates,$('#cp-type').value);btn.disabled=false;
}
