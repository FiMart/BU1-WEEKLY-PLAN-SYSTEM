'use strict';
/* BU1 Weekly Plan · plan drawer: open/view/edit, validation, save, delete, copy */
function defaultDate(){const td=ymd(new Date());const {from,to}=weekRange();return td>=from&&td<=to?td:from}
function openTask(id,preset){
  const t=id?findTask(id):null;if(id&&!t)return;
  editing=t;const p=preset||{};
  const v=t||{jobType:p.type||'',customer:p.customer||'',period:PERIOD[p.period]?p.period:'full',status:'planned',date:p.date||defaultDate(),staffIds:Array.isArray(p.staff)?p.staff.slice():p.staff?[p.staff]:[]};
  const tid=t?typeIdOf(t):(p.type&&jobTypes().some(x=>x.id===p.type)?p.type:'');
  $('#f-type').innerHTML=typeOptions(tid,'— เลือกหัวข้องาน —');$('#f-type').value=tid;
  $('#f-typeOther').value=t&&tid==='other'?typeLabel(t)==='อื่นๆ'?'':typeLabel(t):'';syncTypeOther();
  $('#f-planno').value=v.planNo||'';$('#f-planhint').hidden=true;
  const sl=sales().map(s=>s.name);if(v.sale&&!sl.some(n=>norm(n)===norm(v.sale)))sl.push(v.sale);
  $('#f-sale').innerHTML=`<option value="">— เลือก Sale —</option>`+sl.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');$('#f-sale').value=v.sale||'';syncSaleTel();
  $('#f-customer').value=v.customer||'';$('#f-location').value=v.location||'';
  $('#f-date').value=v.date;$('#f-until').value='';$('#f-period').value=periodOf(v);$('#f-timeNote').value=v.timeNote||'';
  $('#f-detail').value=detailOf(v);$('#f-request').value=v.request!=null?v.request:(v.note||'');
  fillTransportList();$('#f-transport').value=v.transport||'';$('#f-needGA').checked=!!v.needGA;syncNeedGA();syncTrAdd();renderTrGrid();
  $('#f-contact').value=v.contact||'';$('#f-contactTel').value=v.contactTel||'';
  pickGuests=(v.guests||[]).slice();$('#tpGuest').value='';loadPrep(v);
  if(t)renderDrawerView(t);else $('#dView').innerHTML='';
  loadPhotos(v.photoIds||[]);loadFiles(t);
  const st=form.querySelector(`#f-st-${v.status||'planned'}`);if(st)st.checked=true;
  $('#f-reason').value=v.statusNote||'';syncReason();
  pickSel=new Set(v.staffIds||[]);pickPool=null;$('#tpQ').value='';$('#tpFree').checked=false;$('#tpAllowBusy').checked=false;
  renderPickSel();renderPickerList();
  $('#untilWrap').hidden=!!t;$('#copyBox').open=false;
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
  if(!dlg.open)dlg.showModal();
  setMode(t?'view':'edit');
  if(!t)setTimeout(()=>$('#f-type').focus(),30);
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
/* the drawer header takes the job type colour */
function syncDrawerColor(){
  const ty=dMode==='view'&&editing?typeOf(editing):jobTypes().find(x=>x.id===$('#f-type').value);
  dlg.style.setProperty('--dc',ty?safeColor(ty.color):'var(--accent)');
}
/* GA level: can open an existing plan and change only the car (รถ / Car + ต้องการรถส่วนกลาง) */
const gaOnlyEdit=()=>!S.canWrite&&!!editing&&can('ga');
function lockForGa(on){
  form.classList.toggle('ga-only',on);
  $('#formFields').querySelectorAll('input,select,textarea,button').forEach(el=>{
    if(el.closest('.tr-pick')&&!el.closest('.tr-per'))return;/* the period tabs belong to the plan's time */
    if(on){if(!el.disabled){el.disabled=true;el.dataset.gaLock='1'}}else if(el.dataset.gaLock){el.disabled=false;delete el.dataset.gaLock}
  });
}
function setMode(m){
  dMode=m;const view=m==='view';const t=editing;const w=S.canWrite;const ga=gaOnlyEdit();
  syncDrawerColor();lockForGa(!view&&ga);
  $('#dView').hidden=!view;$('#formFields').hidden=view;dlg.classList.toggle('wide',!view);
  $('#btnEdit').hidden=!view||!(w||ga);$('#btnEditTxt').textContent=ga?'ระบุรถ / ทะเบียน':'แก้ไข';$('#btnSave').hidden=view||!(w||ga);
  $('#btnDel').hidden=view||!t||!can('del');$('#btnDup').hidden=!t||!w;$('#copyBox').hidden=!t||!w;
  $('#f-err').hidden=true;
  if(view&&t){$('#dlgTitle').textContent=t.planNo?`${t.planNo} · ${typeLabel(t)}`:typeLabel(t);$('#dlgSub').textContent=[t.customer,t.location].filter(Boolean).join(' · ')}
  else if(ga){$('#dlgTitle').textContent='ระบุรถ (GA)';$('#dlgSub').textContent=[t.planNo,typeLabel(t),fmtDayY(t.date)].filter(Boolean).join(' · ')+' · แก้ได้เฉพาะช่องรถ'}
  else{$('#dlgTitle').textContent=t?'แก้ไขแผนงาน':'เพิ่มแผนงาน';$('#dlgSub').textContent=t?[t.planNo,typeLabel(t),fmtDayY(t.date)].filter(Boolean).join(' · '):'กรอกตามลำดับ แล้วติ๊กเลือก Team Service ที่ว่าง'}
  const body=dlg.querySelector('.dlg-body');if(body)body.scrollTop=0;
  checkConflicts();
}
const curStatus=()=>(form.querySelector('input[name="f-status"]:checked')||{}).value||'planned';
function syncReason(){const s=curStatus();$('#f-reasonWrap').hidden=!NEEDS_REASON.has(s);$('#f-reasonLbl').textContent=reasonLabel(s)}
async function saveViewStatus(val,note){
  if(!editing)return;const id=editing.id;
  try{await Store.update('tasks',id,Object.assign({status:val,statusNote:NEEDS_REASON.has(val)?note:''},meta()));
    editing=Object.assign({},editing,{status:val,statusNote:NEEDS_REASON.has(val)?note:''});
    const r=$('#f-st-'+val);if(r)r.checked=true;$('#f-reason').value=editing.statusNote;syncReason();
    renderDrawerView(editing);renderPhotos();renderFiles();toast(`บันทึกสถานะ “${stTh(val)}”${NEEDS_REASON.has(val)&&note?' พร้อมเหตุผล':''} แล้ว`)}
  catch(err){toast(errText(err));noteWriteError(err);renderDrawerView(editing);renderPhotos()}
}
function renderDrawerView(t){
  const ty=typeOf(t);const st=STATUS[t.status]||STATUS.planned;const d=parseD(t.date);
  const pool=S.tasks.some(x=>x.id===t.id)?S.tasks:[t];const conf=conflictsFor(t,pool);
  const confStaff=new Set(conf.flatMap(x=>x.staff));const tel=saleTel(t.sale);
  let kk=0;const f=(k,v,cls,wide)=>`<div class="${wide?'wide':''}" style="--k:${++kk}"><dt>${k}</dt><dd class="${v?cls||'':'dash'}">${v?esc(v):'—'}</dd></div>`;
  const people=(t.staffIds||[]).map(id=>{const s=staffById(id)||{};const n=staffName(id);return `<span class="${confStaff.has(id)?'conf':''}"><span class="avatar" aria-hidden="true">${esc(initialOf(n))}</span>${esc(n)}${s.role?` <small>${esc(s.role)}</small>`:''}</span>`})
    .concat((t.guests||[]).map(g=>`<span class="guest"><span class="avatar" aria-hidden="true">${esc(initialOf(g))}</span>${esc(g)} <small>แผนกอื่น</small></span>`));
  $('#dView').innerHTML=`<div class="dv-badges"><span class="badge" style="--c:${st.color}"><i></i>${esc(st.th)}</span><span class="badge" style="--c:${safeColor(ty.color)}"><i></i>${esc(typeLabel(t))}</span><span class="badge" style="--c:var(--accent)">${esc(pName(t))}</span></div>
    <div class="dv-by"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>ผู้จองแผน <b id="dvBy" class="dash">—</b></div>
    ${NEEDS_REASON.has(t.status)?`<div class="reason-box ${esc(t.status)}"><b>${statusFlag(t.status)} · เหตุผล / ปัญหาที่หน้างาน</b><span>${t.statusNote?esc(t.statusNote):'<i>ยังไม่ได้ใส่เหตุผล</i>'}</span></div>`:''}
    ${t.status==='notdone'||t.ncrId?ncrLinkHtml(t):''}
    <div><button type="button" class="btn sm" data-action="copy-card"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/></svg> คัดลอกข้อความ</button></div>
    ${conf.length?`<div class="conf-box"><b>⚠ ${esc(confLabel(conf))}</b>${conf.slice(0,4).map(c=>`<span>ชนกับ ${esc(pName(c.other))} · ${esc(typeLabel(c.other))}${c.other.planNo?' '+esc(c.other.planNo):''}${c.other.customer?' · '+esc(c.other.customer):''}</span>`).join('')}</div>`:''}
    <dl class="dv-f">
      ${f('Plan No.',t.planNo,'mono')}${f('หัวข้องาน / Job',typeLabel(t))}${f('วันที่ทำงาน',`${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)} · ${pName(t)}`)}${f('Time',t.timeNote)}
      ${f('Customer',t.customer)}${f('Location',t.location)}${f('Detail',detailOf(t).trim(),'',true)}
      ${(t.photoIds||[]).length?'<div class="wide" style="--k:8"><dt>รูปประกอบ</dt><dd class="dv-ph" id="dvPhotos"></dd></div>':''}
      ${(t.files||[]).length?`<div class="wide" style="--k:9"><dt>ไฟล์แนบ (${t.files.length})</dt><dd class="dv-files" id="dvFiles"></dd></div>`:''}
      ${f('Request',t.request)}
      ${prepViewHtml(t,10)}
      <div style="--k:10"><dt>Transport / รถ</dt><dd class="${t.transport||t.needGA?'':'dash'}">${transportChip(t.transport,t)||esc(t.transport||'—')}${gaWaiting(t)?'<small class="ga-note">ต้องการรถส่วนกลาง GA จะระบุรถและทะเบียนให้ภายหลัง กด "แก้ไข" เพื่อกรอกทะเบียนเมื่อได้รับแจ้ง</small>':''}</dd></div>
      ${f('Contact',[t.contact,t.contactTel].filter(Boolean).join(' · '))}${f('Sale',[t.sale,tel].filter(Boolean).join(' · '))}
      <div class="wide" style="--k:13"><dt>Team Service (${people.length} คน)</dt><dd class="dv-pp">${people.join('')||'<span class="dash">—</span>'}</dd></div>
    </dl>
    ${S.canWrite?`<div class="dv-status"><b>สถานะงาน · กดเพื่อบันทึกผลของงานนี้</b><div class="seg" role="radiogroup" aria-label="สถานะงาน">${STATUSES.map(s=>`<label><input type="radio" name="v-status" id="v-st-${s.id}" value="${s.id}"${(t.status||'planned')===s.id?' checked':''}><span><span class="s-${s.id}">${s.icon}</span>${s.th}</span></label>`).join('')}</div>
      <div class="v-reason" id="vReason"${NEEDS_REASON.has(t.status)?'':' hidden'}><label for="v-reason" id="vReasonLbl">${esc(reasonLabel(t.status))}</label><textarea id="v-reason" rows="3" maxlength="600" placeholder="เช่น ลูกค้าขอเลื่อน ไลน์ผลิตยังไม่หยุด · อะไหล่ไม่พร้อม · ไม่ได้ Work Permit · ฝนตกเข้าพื้นที่ไม่ได้">${esc(t.statusNote||'')}</textarea>
        <div class="v-row"><button type="button" class="btn primary sm" data-action="save-vreason" id="vReasonSave">บันทึก${NEEDS_REASON.has(t.status)?'เหตุผล':''}</button></div></div></div>`:''}`;
  const by=$('#dvBy');whoLabel(creatorOf(t)).then(w=>{if(w&&by.isConnected){by.textContent=w;by.classList.remove('dash')}});
}
function readForm(){
  const typeId=$('#f-type').value;const ty=jobTypes().find(x=>x.id===typeId);
  const g=$('#tpGuest')&&$('#tpGuest').value.trim();
  return {photoIds:photoItems.map(p=>p.id),fileIds:fileItems.map(f=>f.id),files:fileMeta(),jobType:typeId,jobTypeOther:typeId==='other'?$('#f-typeOther').value.trim():'',jobTypeName:ty?ty.name:'',
    planNo:cleanPlan($('#f-planno').value),sale:$('#f-sale').value,customer:$('#f-customer').value.trim(),location:$('#f-location').value.trim(),
    date:$('#f-date').value,period:$('#f-period').value,timeNote:$('#f-timeNote').value.trim(),
    detail:$('#f-detail').value.replace(/\s+$/,'').replace(/^\s*\n/,''),request:$('#f-request').value.trim(),
    transport:normTransport($('#f-transport').value),needGA:$('#f-needGA').checked,contact:$('#f-contact').value.trim(),contactTel:$('#f-contactTel').value.trim(),
    prep:prepForSave(),staffIds:[...pickSel],guests:pickGuests.concat(g&&!pickGuests.some(x=>norm(x)===norm(g))?[g.slice(0,80)]:[]),
    status:curStatus(),statusNote:NEEDS_REASON.has(curStatus())?$('#f-reason').value.trim():''};
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
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
function formError(msg){const el=$('#f-err');el.textContent=msg;el.hidden=!msg}
function validate(v){
  if(!v.jobType)return ['เลือกหัวข้องานก่อนบันทึก','#f-type'];
  if(v.jobType==='other'&&!v.jobTypeOther)return ['พิมพ์หัวข้องานเมื่อเลือก "อื่นๆ"','#f-typeOther'];
  if(!v.date)return ['เลือกวันที่ของงาน','#f-date'];
  if(!v.staffIds.length&&!v.guests.length)return ['เลือก Team Service อย่างน้อย 1 คน (ติ๊กชื่อ หรือพิมพ์ชื่อคนจากแผนกอื่น)','#tpQ'];
  return null;
}
const meta=()=>({updatedAt:new Date().toISOString(),updatedBy:S.me||null});
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(gaOnlyEdit()){/* GA saves only the car fields */
    const btn=$('#btnSave');btn.disabled=true;
    try{await Store.update('tasks',editing.id,Object.assign({transport:normTransport($('#f-transport').value),needGA:$('#f-needGA').checked},meta()));dlg.close();toast('บันทึกรถของแผนงานแล้ว')}
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
      for(const d of dates){await Store.set('tasks',newId('t'),Object.assign({},v,{date:d,sample:false,createdAt:now,createdBy:S.me||null},meta()))}
      if(S.sel.size){S.sel.clear();syncRowPicks()}
      toast(dates.length>1?`สร้าง ${name} แล้ว ${dates.length} แผน (${fmtDay(dates[0])} – ${fmtDay(dates[dates.length-1])})`:(inWeek(dates[0])?`สร้าง ${name} แล้ว`:`สร้าง ${name} แล้ว ในวัน${fmtDay(dates[0])}`));
    }
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
  const pids=(editing.photoIds||[]).slice();const fids=(editing.fileIds||[]).slice();
  try{await Store.del('tasks',editing.id);known.delete(editing.id);dlg.close();toast('ลบแผนแล้ว');if(pids.length)cleanupPhotos(pids);if(fids.length)cleanupFiles(fids)}catch(err){formError(errText(err));noteWriteError(err)}
}
async function copyTo(dates,typeId){
  const v=readForm();
  const extra=typeId?{jobType:typeId,jobTypeName:(jobTypes().find(x=>x.id===typeId)||{}).name||'',jobTypeOther:typeId==='other'?v.jobTypeOther:''}:{};
  const bad=validate(Object.assign({},v,extra,{jobTypeOther:typeId==='other'?(v.jobTypeOther||'อื่นๆ'):v.jobTypeOther}));if(bad){formError(bad[0]);return false}
  const now=new Date().toISOString();
  try{await persistNewPhotos();await persistNewFiles();
    for(const d of dates)await Store.set('tasks',newId('t'),Object.assign({},v,extra,{date:d,status:'planned',statusNote:'',prep:v.prep.map(p=>({text:p.text,done:false})),sample:false,createdAt:now,createdBy:S.me||null},meta()));
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
