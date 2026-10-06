'use strict';
/* BU1 Weekly Plan · Safety forms: ขออบรม (request training) and บันทึกย้อนหลัง (backlog record)
   Same fields, checks and write order as BU2 (old BU1 v2.8.0 bundle):
   - ขออบรม: insert training_requests → request_people → request_documents (from the area's area_documents)
     → upload files last, one by one, each in its own try: a failed file never spoils the request.
     Status: requested, or draft when the area was already requested before (the officer decides).
     Documents: per request (doc type not per person) · per person kept for next time (stored, reused while not expired)
     · per person fresh (must be attached every time). Person files go to "<emp_code>/docs/<uuid>-<safe name>",
     request files to "requests/<request_id>/<uuid>-<safe name>"; the real file name goes to attachments.note.
     "เพิ่มพื้นที่" (add_area) only for a sub-area, and everyone must already hold a valid card of the main area group.
   - บันทึกย้อนหลัง: training that already happened → one completed request "[บันทึกย้อนหลัง]" + people with results
     + certificates for those who passed (planner may INSERT certificates of own-department people only, migration 0027)
     + ID-card photos.
   Both write to the production database: refused while BU1_CONFIG.readOnly is on (sfGuard). */
const sfToday=()=>ymd(new Date());
const sfAddMonths=(s,n)=>{if(!s)return '';const d=parseD(s);return ymd(new Date(d.getFullYear(),d.getMonth()+Number(n||0),d.getDate()))};
const sfActiveAreas=()=>{const a=SAFE.areas.filter(x=>x.active!==false);const by=(x,y)=>x.name.localeCompare(y.name,'th');const ids=new Set(a.map(x=>x.id));
  const out=[];a.filter(x=>!x.parent_id||!ids.has(x.parent_id)).sort(by).forEach(m=>{out.push(m);a.filter(x=>x.parent_id===m.id).sort(by).forEach(s=>out.push(s))});return out};
const sfPeopleList=(sel,q,id,pick)=>{const n=norm(q);const list=(SF.emps||[]).filter(e=>!n||norm(e.full_name+' '+e.emp_code).includes(n));
  return list.map(e=>{const on=sel.has(e.emp_code);const why=pick?pick(e):'';return `<label class="sf-prow${on?' on':''}"><input type="checkbox" data-${id}="${esc(e.emp_code)}"${on?' checked':''}><span><b>${esc(e.full_name)}</b><small>${esc(e.emp_code)} · ${esc(e.position_code||'—')}</small></span>${why}</label>`}).join('')||'<p class="hint">ไม่พบพนักงาน</p>'};
const sfTags=(sel,attr)=>[...sel].map(c=>`<span class="tp-tag">${esc(empName(c))}<button type="button" data-${attr}="${esc(c)}" aria-label="เอา ${esc(empName(c))} ออก">×</button></span>`).join('');

/* =================== ขออบรม =================== */
const RF={};
function rfReset(area){Object.assign(RF,{sel:new Set(),q:'',area:area||'',newArea:'',cert:'',type:'new',date:'',session:'morning',health:'',work:'',
  cName:'',cTel:'',cMail:'',note:'',prev:[],docs:[],docTypes:new Map(),stored:new Map(),files:new Map(),busy:false,done:null,err:'',tok:0})}
const rfIsNew=()=>RF.area==='__new__';
const rfKey=(docId,emp)=>`${docId}|${emp||''}`;
function rfMode(doc){const t=doc.doc_type_id?RF.docTypes.get(doc.doc_type_id):null;return !t||!t.per_person?'per_request':t.fresh_required?'person_fresh':'person_stored'}
const attState=a=>!a?'missing':a.expiry_date&&a.expiry_date<sfToday()?'expired':'ok';
function rfDocReady(doc){
  const m=rfMode(doc);if(m==='per_request')return RF.files.has(rfKey(doc.id,null));
  return RF.sel.size>0&&[...RF.sel].every(c=>RF.files.has(rfKey(doc.id,c))||m==='person_stored'&&doc.doc_type_id&&attState(RF.stored.get(`${c}|${doc.doc_type_id}`))==='ok');
}
function rfCerts(){
  if(rfIsNew())return (SAFE.typeRows||[]).filter(t=>t.scope==='area'&&t.active!==false).map(t=>({id:t.id,name:t.name,validity_months:t.validity_months}));
  return SAFE.rules.filter(r=>r.area_id===RF.area&&r.active!==false).map(r=>({id:r.cert_type_id,name:SAFE.types.get(r.cert_type_id)||r.cert_type_id,validity_months:r.validity_months}));
}
const rfParent=()=>{const a=SAFE.areas.find(x=>x.id===RF.area);return a&&a.parent_id||null};
/* add_area: people holding a valid card of the chosen type for the main area group (main + its sub-areas, or a general card) */
function rfHolders(){
  const p=rfParent();if(RF.type!=='add_area'||!p||!RF.cert)return null;
  const group=new Set([p].concat(SAFE.areas.filter(a=>a.parent_id===p).map(a=>a.id)));const today=sfToday();
  return new Set((SAFE.certs||[]).filter(c=>c.cert_type_id===RF.cert&&c.expiry_date&&c.expiry_date>=today&&(c.area_id==null||group.has(c.area_id))).map(c=>c.emp_code));
}
async function rfLoadArea(){
  const tok=++RF.tok;RF.docs=[];RF.prev=[];RF.cert='';
  if(!RF.area||rfIsNew()){drawRF();return}
  try{
    const [docs,types,prev]=await Promise.all([
      sfDb().from('area_documents').select('*').eq('area_id',RF.area).eq('active',true).order('sort_order'),
      sfDb().from('doc_types').select('*').order('sort_order').order('name'),
      sfDb().from('training_requests').select('id,request_no,status,training_date,course_name,requested_at').eq('area_id',RF.area).eq('dept_id',DEPT()).order('requested_at',{ascending:false}).limit(5)]);
    if(tok!==RF.tok)return;
    RF.docs=docs.data||[];RF.docTypes=new Map((types.data||[]).map(t=>[t.id,t]));RF.prev=prev.data||[];
  }catch(e){}
  drawRF();rfLoadStored();
}
async function rfLoadStored(){
  const types=RF.docs.filter(d=>rfMode(d)==='person_stored').map(d=>d.doc_type_id).filter(Boolean);
  if(!RF.sel.size||!types.length){RF.stored=new Map();return}
  const tok=RF.tok;
  try{const r=await sfDb().from('attachments').select('*').in('emp_code',[...RF.sel]).in('doc_type_id',types).is('request_id',null).order('uploaded_at',{ascending:false});
    if(tok!==RF.tok||r.error)return;const m=new Map();(r.data||[]).forEach(a=>{const k=`${a.emp_code}|${a.doc_type_id}`;if(!m.has(k))m.set(k,a)});RF.stored=m;drawRF()}catch(e){}
}
function openRequestForm(){
  sfLoad('emps',loadEmps);loadSafety();rfReset(S.sf.area||'');
  if(!SAFE.ready||!SF.emps){sfOpen('ขออบรม','',loading(),'',true);const wait=setInterval(()=>{if(SAFE.ready&&SF.emps){clearInterval(wait);if($('#sfDlg').open)rfLoadArea()}},300);setTimeout(()=>clearInterval(wait),20000);return}
  rfLoadArea();
}
function drawRF(){
  if(RF.done){const d=RF.done;
    sfOpen('ขออบรม','',`<div class="sf-done"><b class="ok">ส่งคำขอแล้ว ✓</b><span>รหัสคำขอ ${esc(reqCode(d.request_no,d.requested_at,d.id))}</span>${d.attached?`<span class="ok">แนบเอกสารแล้ว ${d.attached} ไฟล์</span>`:''}
      ${d.failed.length?`<p class="bad"><b>คำขอบันทึกแล้ว แต่ไฟล์ ${d.failed.length} รายการอัปโหลดไม่สำเร็จ</b> — แจ้งเจ้าหน้าที่ให้แนบเพิ่มทีหลัง<br>${esc(d.failed.join(' · '))}</p>`:''}</div>`,'<span class="grow"></span><button type="button" class="btn primary" data-sf-close>ปิด</button>',true);return}
  const areas=sfActiveAreas();const certs=rfCerts();const parent=rfParent();const holders=rfHolders();
  const lacking=holders?[...RF.sel].filter(c=>!holders.has(c)):[];
  const addAreaBad=RF.type==='add_area'&&(!parent||lacking.length>0);
  const ready=RF.docs.filter(rfDocReady).length;const selList=[...RF.sel];
  const fileBtn=key=>{const f=RF.files.get(key);return f?`<span class="sf-file">📎 ${esc(f.name)} <button type="button" class="lnk" data-rf-unfile="${esc(key)}">ลบ</button></span>`
    :`<label class="sf-attach">+ แนบไฟล์<input type="file" class="sr-only" data-rf-file="${esc(key)}"></label>`};
  const docsHtml=RF.docs.map(doc=>{const m=rfMode(doc);const off=doc.owner==='safety_officer';
    return `<div class="sf-doc"><div class="sf-doc-h"><span>${rfDocReady(doc)?'<b class="ok">✓</b> ':''}<b>${esc(doc.name)}</b>
        <small>${off?'เจ้าหน้าที่จัดเตรียม · แนบได้ถ้ามี':doc.requirement_level==='mandatory'?'บังคับ':'ถ้ามี'}${m==='person_fresh'?' · ต้องแนบใหม่ทุกครั้ง':m==='person_stored'?' · แนบครั้งเดียว เก็บไว้ใช้ครั้งหน้า':''}</small></span>
        ${m==='per_request'?fileBtn(rfKey(doc.id,null)):selList.length>1?`<label class="sf-attach" title="สแกนรวมหลายคนในไฟล์เดียว — ใส่ให้ทุกคนที่ยังไม่มีในแถวนี้">+ ไฟล์เดียวให้ทุกคน<input type="file" class="sr-only" data-rf-fileall="${esc(doc.id)}"></label>`:''}</div>
      ${m!=='per_request'&&selList.length?`<div class="sf-doc-p">${selList.map(c=>{const st=m==='person_stored'&&doc.doc_type_id?RF.stored.get(`${c}|${doc.doc_type_id}`):null;const s=m==='person_stored'?attState(st):'missing';const k=rfKey(doc.id,c);
        return `<div><span>${esc(empName(c))}</span>${s==='ok'&&!RF.files.has(k)?`<span class="ok">✓ มีในระบบแล้ว${st&&st.expiry_date?` · ถึง ${esc(sfDate(st.expiry_date))}`:''}</span>`:`${s==='expired'&&!RF.files.has(k)?'<span class="bad">หมดอายุ</span>':''}${fileBtn(k)}`}</div>`}).join('')}</div>`:''}</div>`}).join('');
  const body=`
    <div class="field"><span class="lbl">รายชื่อ (${RF.sel.size} คน)${RF.type==='add_area'&&holders?' <small class="hint">— เลือกได้เฉพาะคนที่ถือบัตรพื้นที่หลักอยู่แล้ว</small>':''}</span>
      <input type="search" id="rf-q" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" value="${esc(RF.q)}" autocomplete="off">
      ${RF.sel.size?`<div class="tp-sel">${sfTags(RF.sel,'rf-unsel')}<button type="button" class="lnk" data-sf="rf-clear">ล้างทั้งหมด</button></div>`:''}
      <div class="sf-pick" id="rfPeople">${sfPeopleList(RF.sel,RF.q,'rf-emp',holders?e=>holders.has(e.emp_code)?'':'<small class="bad">ยังไม่มีบัตรหลัก</small>':null)}</div></div>
    <div class="field"><label class="lbl" for="rf-area">พื้นที่ที่ต้องเข้า</label>
      <select id="rf-area"><option value="">— เลือกพื้นที่ —</option>${areas.map(a=>`<option value="${esc(a.id)}"${RF.area===a.id?' selected':''}>${a.parent_id?'　└ ':''}${esc(a.name)} (${esc(a.id)})</option>`).join('')}<option value="__new__"${rfIsNew()?' selected':''}>➕ เพิ่มพื้นที่ใหม่ — ไม่มีในรายการข้างบน (พิมพ์ชื่อเอง)</option></select>
      ${rfIsNew()?`<input id="rf-newArea" placeholder="พิมพ์ชื่อพื้นที่ เช่น PTT GC#5 / ROC Unit 3" value="${esc(RF.newArea)}" maxlength="120"><span class="hint">พื้นที่ที่พิมพ์เองยังไม่ได้ลงทะเบียน — เจ้าหน้าที่ความปลอดภัยจะเพิ่มเข้าระบบให้ตอนรับคำขอ</span>`:'<span class="hint">ไม่เจอพื้นที่ที่ต้องการ? เลือก "➕ เพิ่มพื้นที่ใหม่" ท้ายรายการ</span>'}</div>
    ${RF.prev.length?`<div class="sf-warnbox"><b>เคยขอพื้นที่นี้มาแล้ว ${RF.prev.length} ครั้ง — คำขอนี้จะเป็น Draft</b>${RF.prev.map(p=>`<span>${esc(reqCode(p.request_no,p.requested_at,p.id))} · ${esc((RQ_STATUS[p.status]||[])[1]||p.status)} · ${esc(p.training_date?sfDate(p.training_date):'ยังไม่นัดวัน')}</span>`).join('')}</div>`:''}
    <div class="field"><span class="lbl">ประเภทใบรับรอง</span>${certs.length?certs.map(c=>`<label class="sf-radio"><input type="radio" name="rf-cert" value="${esc(c.id)}"${RF.cert===c.id?' checked':''}> ${esc(c.name)} ${c.validity_months?`<small class="hint">(อายุ ${esc(c.validity_months)} เดือน)</small>`:''}</label>`).join(''):'<span class="hint">เลือกพื้นที่ก่อน หรือยังไม่ได้ตั้งค่าประเภทใบรับรองของพื้นที่นี้</span>'}</div>
    <div class="seg" role="radiogroup" aria-label="ประเภทคำขอ">${Object.entries(RQ_TYPE).map(([v,l])=>`<label><input type="radio" name="rf-type" value="${v}"${RF.type===v?' checked':''}><span>${l}</span></label>`).join('')}</div>
    ${RF.type==='add_area'&&!parent&&RF.area&&!rfIsNew()?`<div class="sf-warnbox"><b>"${esc(areaName(RF.area))}" เป็นพื้นที่หลัก ไม่ใช่พื้นที่ที่เพิ่มเข้าไปได้</b><span>โหมด "เพิ่มพื้นที่" ใช้กับพื้นที่รองเท่านั้น (เช่น GC#2 ที่อยู่ใต้ PTT GC) — ถ้าจะขออบรมบัตรหลักใบใหม่ ให้เลือก "อบรมบัตรใหม่" แทน</span></div>`:''}
    ${RF.type==='add_area'&&parent?`<div class="${lacking.length?'sf-badbox':'sf-okbox'}">${!RF.cert?'เลือกประเภทใบรับรองก่อน ระบบจะตรวจบัตรหลักให้':!RF.sel.size?`เลือกรายชื่อก่อน ระบบจะตรวจให้ว่าทุกคนมีบัตรหลักของ <b>${esc(areaName(parent))}</b> แล้วหรือยัง`
      :lacking.length?`<b>ส่งคำขอไม่ได้ — ${lacking.length} คนยังไม่มีบัตรหลักของ ${esc(areaName(parent))}</b><br>${esc(lacking.map(empName).join(', '))}<br><small>ต้องขออบรมบัตรหลักให้ผ่านก่อน หรือเอาคนเหล่านี้ออกจากรายชื่อ · ถ้ามีบัตรจริงแต่ยังไม่ได้บันทึกเข้าระบบ ให้แจ้งเจ้าหน้าที่ความปลอดภัยบันทึกย้อนหลังให้ก่อน</small>`
      :`✓ ทุกคนที่เลือก (${RF.sel.size} คน) มีบัตรหลักของ <b>${esc(areaName(parent))}</b> ที่ยังไม่หมดอายุแล้ว`}</div>`:''}
    <div class="sf-grid2">
      <div class="field"><label class="lbl" for="rf-date">วันที่ส่งอบรม</label><input type="date" id="rf-date" value="${esc(RF.date)}">
        <div class="seg" role="radiogroup" aria-label="รอบอบรม">${Object.entries(RQ_SESSION).map(([v,l])=>`<label><input type="radio" name="rf-session" value="${v}"${RF.session===v?' checked':''}><span>${l}</span></label>`).join('')}</div></div>
      <div class="field"><label class="lbl" for="rf-health">วันที่ส่งตรวจสุขภาพ</label><input type="date" id="rf-health" value="${esc(RF.health)}"><span class="hint">ต้องตรวจก่อนวันอบรม</span></div>
      <div class="field"><label class="lbl" for="rf-work">วันที่ปฏิบัติงาน</label><input type="date" id="rf-work" value="${esc(RF.work)}"><span class="hint">เว้นว่างได้ถ้ายังไม่กำหนด</span></div>
    </div>
    <div class="field"><span class="lbl">เจ้าของงาน (ผู้ติดต่อ)</span><div class="pair"><input id="rf-cName" placeholder="ชื่อผู้ติดต่อ" value="${esc(RF.cName)}"><input id="rf-cTel" placeholder="เบอร์โทร" value="${esc(RF.cTel)}"></div>
      <input id="rf-cMail" type="email" placeholder="อีเมล" value="${esc(RF.cMail)}"><span class="hint">ผู้จอง: ${esc(S.auth.email)} (${esc(DEPT())})</span></div>
    ${!rfIsNew()&&RF.docs.length?`<div class="field"><span class="lbl">เอกสารที่ต้องเตรียม (${ready}/${RF.docs.length} พร้อม) <small class="hint">— แนบตรงนี้ให้เจ้าหน้าที่ได้เลย ไม่ต้องส่งแยก</small></span>${RF.sel.size?'':'<span class="hint">เลือกรายชื่อก่อน จะเห็นว่าใครมีเอกสารในระบบแล้วบ้าง</span>'}${docsHtml}</div>`:''}
    <div class="field"><label class="lbl" for="rf-note">หมายเหตุ</label><textarea id="rf-note" rows="3" placeholder="เช่น ต้องเข้าไซต์ 2 ก.ย. ขออบรมก่อน 30 ส.ค.">${esc(RF.note)}</textarea></div>
    ${RF.err?`<p class="form-err">${esc(RF.err)}</p>`:''}${isReadOnly()?`<p class="hint">${esc(SF_RO_MSG)}</p>`:''}`;
  const can=!RF.busy&&RF.sel.size>0&&RF.area&&!(rfIsNew()&&!RF.newArea.trim())&&!addAreaBad;
  const top=$('#sfDlgBody')?$('#sfDlgBody').scrollTop:0;
  sfOpen('ขออบรม',`ส่งคำขอให้เจ้าหน้าที่ความปลอดภัย · แผนก ${DEPT()}`,body,`<span class="grow"></span><button type="button" class="btn" data-sf-close>ปิด</button><button type="button" class="btn primary" data-sf="rf-submit"${can?'':' disabled'}>${RF.busy?'กำลังส่ง…':'ส่งคำขอ'}</button>`,true);
  $('#sfDlgBody').scrollTop=top;
}
function rfRedrawPeople(){const el=$('#rfPeople');if(!el)return;const h=rfHolders();el.innerHTML=sfPeopleList(RF.sel,RF.q,'rf-emp',h?e=>h.has(e.emp_code)?'':'<small class="bad">ยังไม่มีบัตรหลัก</small>':null)}
async function rfSubmit(){
  if(!sfGuard()||RF.busy)return;RF.busy=true;RF.err='';drawRF();
  try{
    const isNew=rfIsNew();
    const {data:rq,error}=await sfDb().from('training_requests').insert({dept_id:DEPT(),area_id:isNew?null:RF.area||null,requested_area_name:isNew?RF.newArea.trim():null,
      cert_type_id:RF.cert||null,request_type:RF.type,training_date:RF.date||null,session:RF.session||null,health_check_date:RF.health||null,work_date:RF.work||null,
      client_contact_name:RF.cName||null,client_contact_phone:RF.cTel||null,client_contact_email:RF.cMail||null,note:RF.note||null,status:RF.prev.length?'draft':'requested'})
      .select('id,request_no,requested_at').single();
    if(error)throw error;
    const rid=rq.id;
    {const {error:e2}=await sfDb().from('request_people').insert([...RF.sel].map(c=>({request_id:rid,emp_code:c})));if(e2)throw e2}
    const docRow=new Map();
    if(!isNew&&RF.docs.length){
      const {data:rd,error:e3}=await sfDb().from('request_documents').insert(RF.docs.map(d=>({request_id:rid,area_document_id:d.id,name:d.name,requirement_level:d.requirement_level,owner:d.owner,status:'missing'}))).select('id,area_document_id');
      if(e3)throw e3;(rd||[]).forEach(x=>docRow.set(x.area_document_id,x.id));
    }
    /* files last, each on its own */
    const failed=[],sent=new Set();
    for(const [key,file] of RF.files){
      const [docId,emp]=key.split('|');const doc=RF.docs.find(d=>d.id===docId);if(!doc)continue;
      const m=rfMode(doc);const t=doc.doc_type_id?RF.docTypes.get(doc.doc_type_id):null;
      try{
        const path=emp?`${emp}/docs/${uuid()}-${safeFileName(file.name)}`:`requests/${rid}/${uuid()}-${safeFileName(file.name)}`;
        const up=await sb.storage.from('safety-docs').upload(path,file);if(up.error)throw up.error;
        const expiry=m==='person_stored'&&t&&t.validity_months?sfAddMonths(sfToday(),t.validity_months):null;
        const ins=await sfDb().from('attachments').insert({request_id:m==='person_stored'?null:rid,emp_code:emp||null,area_document_id:doc.id,doc_type_id:doc.doc_type_id||null,kind:'document',storage_path:path,expiry_date:expiry,note:file.name});
        if(ins.error)throw ins.error;sent.add(key);
      }catch(err){failed.push(`${doc.name}${emp?` (${empName(emp)})`:''}: ${(err&&err.message)||err}`)}
    }
    for(const doc of RF.docs){const id=docRow.get(doc.id);if(!id)continue;const m=rfMode(doc);
      const ok=m==='per_request'?sent.has(rfKey(doc.id,null)):RF.sel.size>0&&[...RF.sel].every(c=>sent.has(rfKey(doc.id,c))||m==='person_stored'&&doc.doc_type_id&&attState(RF.stored.get(`${c}|${doc.doc_type_id}`))==='ok');
      if(ok)await sfDb().from('request_documents').update({status:'ready'}).eq('id',id)}
    RF.done={id:rid,request_no:rq.request_no,requested_at:rq.requested_at,attached:sent.size,failed};sfLoad('reqs',loadReqs,true);
  }catch(err){RF.err=(err&&err.message)||String(err)}
  finally{RF.busy=false;drawRF()}
}

/* =================== บันทึกย้อนหลัง =================== */
const BL={};
function blReset(){Object.assign(BL,{sel:new Set(),q:'',free:false,areaText:'',cert:'',validity:12,areas:new Set(),date:sfToday(),note:'',rows:new Map(),busy:false,done:null,err:''})}
blReset();
const blType=()=>(SAFE.typeRows||[]).find(t=>t.id===BL.cert)||null;
const blGeneral=()=>{const t=blType();return !!t&&t.scope==='general'};
const blAreaChoices=()=>SAFE.rules.filter(r=>r.cert_type_id===BL.cert&&r.active!==false).map(r=>({id:r.area_id,name:areaName(r.area_id),validity_months:r.validity_months})).sort((a,b)=>a.name.localeCompare(b.name,'th'));
const blIssues=()=>!BL.free&&!!BL.cert&&(blGeneral()||BL.areas.size>0);
function blRow(c){if(!BL.rows.has(c))BL.rows.set(c,{health:'na',result:'passed',expiry:sfAddMonths(BL.date,BL.validity),card:false,photo:null});return BL.rows.get(c)}
function drawBacklog(){
  const b=$('#sfBody');sfLoad('emps',loadEmps);loadSafety();
  if(!SAFE.ready||!SF.emps){b.innerHTML=SAFE.err?sfError(SAFE.err):loading();return}
  if(BL.done){const d=BL.done;b.innerHTML=`<section class="panel sf-done">${d.issued?`<b class="ok">บันทึกแล้ว ✓ ออกใบรับรอง ${d.issued} ใบ</b>`:'<b class="warn">บันทึกประวัติแล้ว — แต่ยังไม่ได้ออกใบรับรอง</b><span>เพราะพื้นที่ยังไม่ได้ลงทะเบียน หรือยังไม่ได้เลือกประเภทใบรับรอง</span>'}
      ${d.failedPhotos.length?`<span class="warn">รูปหน้าบัตรของ ${esc(d.failedPhotos.join(', '))} อัปโหลดไม่สำเร็จ — ข้อมูลอื่นบันทึกครบแล้ว แนบรูปเพิ่มทีหลังได้ ไม่ต้องกรอกใหม่</span>`:''}
      <span class="hint">ใบรับรองจะขึ้นในหน้า "Dashboard พื้นที่" ให้เลย · ดูรายการย้อนหลังได้ที่แท็บ "คำขอของฉัน"</span><span class="hint">รหัสรายการ ${esc(reqCode(d.request_no,d.requested_at,d.id))}</span>
      <button type="button" class="btn primary" data-sf="bl-next">บันทึกรายการถัดไป</button></section>`;return}
  const types=(SAFE.typeRows||[]).filter(t=>t.active!==false).sort((x,y)=>x.name.localeCompare(y.name,'th'));const choices=blAreaChoices();
  const can=!BL.busy&&BL.sel.size>0&&!!BL.date&&(BL.free?!!BL.areaText.trim():!!BL.cert&&(blGeneral()||BL.areas.size>0));
  b.innerHTML=`<p class="hint">สำหรับอบรมที่จัดไปแล้วก่อนมีระบบนี้ — กรอกผล แนบรูปหน้าบัตร แล้วบันทึกจบในหน้าเดียว ออกใบรับรองให้ทันที</p>
    <div class="sf-back">
      <section class="panel sf-pad">
        <div class="field"><span class="lbl">รายชื่อผู้เข้าอบรม (${BL.sel.size} คน)</span><input type="search" id="bl-q" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" value="${esc(BL.q)}" autocomplete="off">
          <div class="sf-pick" id="blPeople">${sfPeopleList(BL.sel,BL.q,'bl-emp')}</div></div>
      </section>
      <section class="panel sf-pad">
        <label class="check"><input type="checkbox" id="bl-free"${BL.free?' checked':''}> พื้นที่ยังไม่มีในระบบ (พิมพ์ชื่อเอง · จะยังไม่ออกใบรับรอง)</label>
        ${BL.free?`<input id="bl-areaText" placeholder="ชื่อพื้นที่" value="${esc(BL.areaText)}" maxlength="120">`:`
        <div class="field"><label class="lbl" for="bl-cert">ประเภทใบรับรอง</label><select id="bl-cert"><option value="">— เลือก —</option>${types.map(t=>`<option value="${esc(t.id)}"${BL.cert===t.id?' selected':''}>${esc(t.name)}${t.scope==='general'?' (ทั่วไป)':''}</option>`).join('')}</select></div>
        ${BL.cert&&!blGeneral()?`<div class="field"><span class="lbl">พื้นที่ที่ได้บัตร</span>${choices.map(a=>`<label class="check"><input type="checkbox" data-bl-area="${esc(a.id)}"${BL.areas.has(a.id)?' checked':''}> ${esc(a.name)}${a.validity_months?` <small class="hint">(อายุ ${esc(a.validity_months)} เดือน)</small>`:''}</label>`).join('')||'<span class="hint">ใบรับรองนี้ยังไม่ได้ผูกกับพื้นที่ใดในระบบ</span>'}</div>`:''}`}
        <div class="sf-grid2"><div class="field"><label class="lbl" for="bl-date">วันที่อบรม</label><input type="date" id="bl-date" value="${esc(BL.date)}"></div>
          <div class="field"><label class="lbl" for="bl-validity">อายุบัตร (เดือน)</label><input type="number" id="bl-validity" min="1" max="120" value="${esc(BL.validity)}"></div></div>
        <div class="field"><label class="lbl" for="bl-note">หมายเหตุ</label><input id="bl-note" value="${esc(BL.note)}" maxlength="300"></div>
      </section>
    </div>
    ${BL.sel.size?`<section class="panel"><div class="scroll-x plain"><table class="list sf-table"><thead><tr><th>ชื่อ</th><th>ตรวจสุขภาพ</th><th>ผลอบรม</th><th>บัตรหมดอายุ</th><th>ออกบัตรแล้ว</th><th>รูปหน้าบัตร</th></tr></thead><tbody>
      ${[...BL.sel].map(c=>{const r=blRow(c);const sel=(k,opts,v)=>`<select data-bl-row="${esc(c)}" data-k="${k}">${opts.map(([o,l])=>`<option value="${o}"${v===o?' selected':''}>${l}</option>`).join('')}</select>`;
        return `<tr><td><b>${esc(empName(c))}</b></td><td>${sel('health',[['na','ไม่ต้องตรวจ'],['passed','ผ่าน'],['failed','ไม่ผ่าน'],['pending','รอผล']],r.health)}</td>
          <td>${sel('result',[['passed','ผ่าน'],['failed','ไม่ผ่าน'],['no_show','ไม่มา'],['pending','รอผล']],r.result)}</td>
          <td><input type="date" data-bl-row="${esc(c)}" data-k="expiry" value="${esc(r.expiry)}"></td><td><input type="checkbox" data-bl-row="${esc(c)}" data-k="card"${r.card?' checked':''} aria-label="ออกบัตรแล้ว"></td>
          <td>${r.photo?`<span class="sf-file">📎 ${esc(r.photo.name)} <button type="button" class="lnk" data-bl-unphoto="${esc(c)}">ลบ</button></span>`:`<label class="sf-attach">+ รูป<input type="file" accept="image/*" class="sr-only" data-bl-photo="${esc(c)}"></label>`}</td></tr>`}).join('')}
      </tbody></table></div><div class="sf-pad"><button type="button" class="lnk" data-sf="bl-allpass">ตั้งทุกคนเป็น "ผ่าน"</button></div></section>`:''}
    ${BL.err?`<p class="form-err">${esc(BL.err)}</p>`:''}
    <div class="sf-actions">${isReadOnly()?`<span class="hint">${esc(SF_RO_MSG)}</span>`:''}<span class="grow"></span><button type="button" class="btn" data-sf="bl-reset">ล้างฟอร์ม</button><button type="button" class="btn primary" data-sf="bl-submit"${can?'':' disabled'}>${BL.busy?'กำลังบันทึก…':'บันทึก'}</button></div>`;
}
function blRedrawPeople(){const el=$('#blPeople');if(el)el.innerHTML=sfPeopleList(BL.sel,BL.q,'bl-emp')}
async function blSubmit(){
  if(!sfGuard()||BL.busy)return;
  const issues=blIssues();
  if(!issues&&!confirm('รายการนี้จะยังไม่มีใบรับรองออกให้\n\n'+(BL.free?'เพราะพื้นที่นี้ยังไม่ได้ลงทะเบียนในระบบ (พิมพ์เป็นข้อความอิสระ) — การเพิ่มพื้นที่เป็นสิทธิ์ของเจ้าหน้าที่ความปลอดภัย ':'เพราะยังไม่ได้เลือกประเภทใบรับรอง ')+'ประวัติการอบรมจะถูกบันทึกไว้ครบ แล้วให้เจ้าหน้าที่ออกใบรับรองย้อนหลังให้ทีหลังได้\n\nกด OK เพื่อบันทึกต่อไป'))return;
  BL.busy=true;BL.err='';drawBacklog();
  try{
    const general=blGeneral();const areas=[...BL.areas];const rows=[...BL.sel].map(c=>({c,r:blRow(c)}));
    const {data:rq,error}=await sfDb().from('training_requests').insert({dept_id:DEPT(),area_id:BL.free||general?null:areas[0]||null,requested_area_name:BL.free?BL.areaText.trim():null,
      cert_type_id:BL.cert||null,request_type:'new',training_date:BL.date,note:['[บันทึกย้อนหลัง]',BL.note.trim()].filter(Boolean).join(' '),status:'completed'}).select('id,request_no,requested_at').single();
    if(error)throw error;
    {const {error:e2}=await sfDb().from('request_people').insert(rows.map(({c,r})=>({request_id:rq.id,emp_code:c,health_status:r.health,result:r.result,expiry_override:r.expiry||null,card_issued:r.card})));if(e2)throw e2}
    let issued=0;
    if(issues){
      const passed=rows.filter(x=>x.r.result==='passed');
      const certs=general?passed.map(({c,r})=>({emp_code:c,cert_type_id:BL.cert,area_id:null,issued_date:BL.date,expiry_date:r.expiry||null,card_issued:r.card}))
        :passed.flatMap(({c,r})=>areas.map(a=>({emp_code:c,cert_type_id:BL.cert,area_id:a,issued_date:BL.date,expiry_date:r.expiry||null,card_issued:r.card})));
      if(certs.length){const {error:e3}=await sfDb().from('certificates').insert(certs);if(e3)throw e3}
      issued=certs.length;
    }
    const failedPhotos=[];
    for(const {c,r} of rows){if(!r.photo)continue;
      try{const ext=(r.photo.name.split('.').pop()||'jpg').replace(/[^A-Za-z0-9]/g,'')||'jpg';const path=`${c}/${uuid()}-idcard.${ext}`;
        const up=await sb.storage.from('safety-docs').upload(path,r.photo);if(up.error)throw up.error;
        const ins=await sfDb().from('attachments').insert({emp_code:c,request_id:rq.id,kind:'id_card_photo',storage_path:path,note:r.photo.name});if(ins.error)throw ins.error}
      catch(e){failedPhotos.push(empName(c))}}
    BL.done={id:rq.id,request_no:rq.request_no,requested_at:rq.requested_at,issued,failedPhotos};loadSafety(true);sfLoad('reqs',loadReqs,true);
  }catch(err){BL.err=(err&&err.message)||String(err)}
  finally{BL.busy=false;drawBacklog()}
}

/* =================== events =================== */
document.addEventListener('change',e=>{const t=e.target;const d=t.dataset||{};
  /* ขออบรม */
  if(d.rfEmp){t.checked?RF.sel.add(d.rfEmp):RF.sel.delete(d.rfEmp);drawRF();rfLoadStored();return}
  if(t.id==='rf-area'){RF.area=t.value;rfLoadArea();return}
  if(t.name==='rf-cert'){RF.cert=t.value;drawRF();return}
  if(t.name==='rf-type'){RF.type=t.value;drawRF();return}
  if(t.name==='rf-session'){RF.session=t.value;return}
  if(d.rfFile&&t.files&&t.files[0]){RF.files.set(d.rfFile,t.files[0]);drawRF();return}
  if(d.rfFileall&&t.files&&t.files[0]){const doc=RF.docs.find(x=>x.id===d.rfFileall);const m=doc&&rfMode(doc);
    if(doc)RF.sel.forEach(c=>{const st=m==='person_stored'&&doc.doc_type_id?RF.stored.get(`${c}|${doc.doc_type_id}`):null;if(attState(st)!=='ok')RF.files.set(rfKey(doc.id,c),t.files[0])});drawRF();return}
  /* บันทึกย้อนหลัง */
  if(d.blEmp){t.checked?BL.sel.add(d.blEmp):BL.sel.delete(d.blEmp);drawBacklog();return}
  if(t.id==='bl-free'){BL.free=t.checked;drawBacklog();return}
  if(t.id==='bl-cert'){BL.cert=t.value;BL.areas=new Set();const ty=blType();BL.validity=ty&&ty.validity_months||12;BL.rows.forEach(r=>{r.expiry=sfAddMonths(BL.date,BL.validity)});drawBacklog();return}
  if(d.blArea){t.checked?BL.areas.add(d.blArea):BL.areas.delete(d.blArea);drawBacklog();return}
  if(t.id==='bl-date'||t.id==='bl-validity'){if(t.id==='bl-date')BL.date=t.value;else BL.validity=Number(t.value)||12;BL.rows.forEach(r=>{r.expiry=sfAddMonths(BL.date,BL.validity)});drawBacklog();return}
  if(d.blRow){const r=blRow(d.blRow);r[d.k]=t.type==='checkbox'?t.checked:t.value;return}
  if(d.blPhoto&&t.files&&t.files[0]){blRow(d.blPhoto).photo=t.files[0];drawBacklog();return}
});
document.addEventListener('input',e=>{const t=e.target;
  const txt={'rf-newArea':'newArea','rf-cName':'cName','rf-cTel':'cTel','rf-cMail':'cMail','rf-note':'note','rf-date':'date','rf-health':'health','rf-work':'work'}[t.id];
  if(txt){RF[txt]=t.value;if(t.id==='rf-newArea'){const b=document.querySelector('[data-sf="rf-submit"]');if(b)b.disabled=!(RF.sel.size&&RF.newArea.trim())}return}
  if(t.id==='rf-q'){RF.q=t.value;rfRedrawPeople();return}
  if(t.id==='bl-q'){BL.q=t.value;blRedrawPeople();return}
  if(t.id==='bl-areaText'){BL.areaText=t.value;const b=document.querySelector('[data-sf="bl-submit"]');if(b)b.disabled=!(BL.sel.size&&BL.date&&BL.areaText.trim());return}
  if(t.id==='bl-note'){BL.note=t.value}
});
document.addEventListener('click',e=>{
  const un=e.target.closest('[data-rf-unsel]');if(un){RF.sel.delete(un.dataset.rfUnsel);drawRF();return}
  const uf=e.target.closest('[data-rf-unfile]');if(uf){RF.files.delete(uf.dataset.rfUnfile);drawRF();return}
  const up=e.target.closest('[data-bl-unphoto]');if(up){blRow(up.dataset.blUnphoto).photo=null;drawBacklog();return}
  const a=e.target.closest('[data-sf]');if(!a)return;
  switch(a.dataset.sf){
    case 'request':openRequestForm();break;
    case 'rf-clear':RF.sel.clear();drawRF();break;
    case 'rf-submit':rfSubmit();break;
    case 'bl-submit':blSubmit();break;
    case 'bl-reset':case 'bl-next':blReset();drawBacklog();break;
    case 'bl-allpass':BL.sel.forEach(c=>{blRow(c).result='passed'});drawBacklog();break;
  }
});
