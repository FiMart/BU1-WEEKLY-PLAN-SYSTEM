'use strict';
/* BU1 Weekly Plan · Check Sheet ในระบบ (user, 15 Oct 2026: "เพิ่มข้อมูลของการทำ Check Sheet และการทำ Check Sheet เสร็จต้องมีการ approve เป็น step";
   chose: every section confirmed one by one (QC Pass / Fail + who + when) then the whole sheet approved · approvers listed in ข้อมูลหลัก ·
   all four forms · signatures drawn on screen).
   The team's paper forms, as data (CS_FORMS): QC LAB FLS-F-161 · Data Flow Meter Check Sheet FLS-F-122 (one per meter of a booking) ·
   Remove-Reinstall Transmitter Check Sheet FLS-F-162 (per meter) · Service Report FLS-F-158 (per plan / day).
   collection "checks" ↔ app_settings rows bu1wp_chk:<id> = {form, no, jobId, itemId, taskId, planNo, title,
     h:{header fields}, v:{check items}, tb:{tables: rows}, steps:{sectionId:{res pass|fail|ok, by, at, note}}, sig:{key:{name, img, at, kind}},
     state draft|submitted|approved|rejected, submittedAt/By, approvedAt/By, approveNote, rejectedAt/By, rejectReason, createdAt/By, updatedAt/By, history}.
   Workflow: draft → (every required section confirmed, signatures) ส่งตรวจ → approver อนุมัติ / ตีกลับ (reason) → rejected is edited and sent again;
   an approver may reopen an approved sheet (reason). The person who sent it cannot approve it. Status chip Delay / On Process / Timely. */
S.checks=[];S.checksReady=false;S.csF={tab:'todo',form:'',q:''};
const CS_SIGN_GOV=[['excise','Excise'],['wm','W&M'],['custom','Custom']];
const CS_FORMS={
  qc:{code:'FLS-F-161',pre:'QC',name:'QC LAB',sub:'ขั้นตอนการปฏิบัติงานสอบเทียบใน Lab',per:'item',
    head:[['customer','Customer'],['tag','Tag No.'],['receiveDate','Receive Date','date'],['requestNo','Request No.'],
      ['sensorMfr','Sensor · Manufacturer'],['sensorModel','Sensor · Model'],['sensorSerial','Sensor · Serial No.'],['txMfr','Transmitter · Manufacturer'],['txModel','Transmitter · Model'],['txSerial','Transmitter · Serial No.']],
    secs:[
      {id:'s1',t:'1. รับอุปกรณ์',qc:1,items:['ถ่ายรูปอุปกรณ์ขณะอยู่ในบรรจุภัณฑ์ / ขณะอยู่ในยานพาหนะ / อุปกรณ์ต่อพ่วง','ตรวจเช็คสารตกค้างใน Flowmeter ก่อนเข้าพื้นที่แลป','ตรวจสอบข้อมูลจากแผนงานเทียบกับอุปกรณ์','ตรวจสอบข้อมูลจากใบคำร้องขอรับบริการสอบเทียบ (FLS-F-018) เทียบกับอุปกรณ์','เขียนใบรับส่งของ (FLS-F-024) จัดเก็บเอกสารตามเลข Request No.','ติดป้ายชี้บ่ง (FLS-F-023)','เช็คสภาพอุปกรณ์แต่ละตัว พร้อมถ่ายรูปประกอบ','เช็ค On Power แต่ละตัว']},
      {id:'s2',t:'2. Check Configuration (Before)',qc:1,items:['Save Configuration Before','จดบันทึก Configuration Before ลง Data flow meter Form (FLS-F-122)','Set configuration For Calibrate','Up load Configuration Before จัดเก็บ']},
      {id:'s3',t:'3. Install For Calibrate',qc:1,items:['เช็ค Alignment','เช็ค Leak']},
      {id:'s4',t:'4. Wiring For Calibrate',qc:1,items:['เช็ค Wiring','เช็ค สัญญาณ']},
      {id:'s5',t:'5. Calibrate',qc:1,items:['Mode calibration (Mass / Volume)','เลือกใช้แบบ Form excel','เช็ค Input K-Factor to Flowcom ค่าต้องเท่ากับ Set output Flowmeter (ถ้าหน้างานมี Flowcom)','On Process Calibrate','ตรวจสอบข้อมูลจากกราฟมือ (ตัวเลขที่ใช้ในการคำนวณถูกต้องหรือไม่)','แจ้งผล Report (กราฟ) ให้ทีมงาน Lab ทราบก่อนส่งให้ลูกค้า / Sale ทราบ','ติดสติ๊กเกอร์ cal (FLS-F-011)','นำข้อมูลใส่ลงใน file กลาง ครบถ้วน เช่น config ข้อมูลดิบ รูป']},
      {id:'s6',t:'6. Disconnect & Remove Wiring',qc:1,items:['เช็คความครบถ้วนของน็อต Terminal หลัง Remove Wiring และต่อพ่วงอื่นๆ ให้ครบถ้วนเหมือนเดิม','เช็ค วาล์ว ก่อน เดรน','Drain น้ำ / vent pressure','ปิดหน้าแปลนบน Skid','Purge น้ำออกจาก Flow meter ให้แห้ง','ติดสติกเกอร์หน้าแปลน']},
      {id:'s7',t:'7. Check Configuration (After)',qc:1,items:['Save Configuration After','จดบันทึก Configuration After ลง Data flow meter Form (FLS-F-122)','ปรับ configuration มาตรวจสอบ','Up load Configuration After จัดเก็บ']},
      {id:'s8',t:'8. Cleaning',qc:1,items:['ทำความสะอาด Flowmeter','ปรับ configuration มาเช็ค และ Recheck configuration (เป็นคนละคนกับคนคืน configuration)','จัดเก็บในพื้นที่เตรียมส่ง'],other:'s7'},
      {id:'s9',t:'9. Report',qc:1,items:['ออกรายงานผลการสอบเทียบ (Report / Certificate)']},
      {id:'s10',t:'10. ส่งอุปกรณ์',qc:1,items:['ถ่ายรูปอุปกรณ์ขณะอยู่ในบรรจุภัณฑ์ / ขณะอยู่ในยานพาหนะ / อุปกรณ์ต่อพ่วง พร้อมถ่ายรูปประกอบ','เตรียมเอกสารใบคำร้องขอรับบริการสอบเทียบ (FLS-F-018) สำหรับให้ลูกค้าเซ็นต์','เขียนใบรับส่งของ (FLS-F-024)','ถอดป้ายชี้บ่ง (FLS-F-023)','Scan และนำเอกสารใบรับส่งของ (FLS-F-024) / รูปถ่าย จัดเก็บเอกสารตามเลข Request No.']}]},
  data:{code:'FLS-F-122',pre:'DF',name:'Data Flow Meter Check Sheet',sub:'ข้อมูลมิเตอร์ และ Configuration ก่อน / ระหว่าง / หลังสอบเทียบ',per:'item',
    head:[['customer','Customer'],['highPressure','High Pressure Flowmeter','yn'],['type','Meter · Type'],['tag','Meter · Tag'],['size','Connection size'],['receiveDate','Receive Date','date'],['calDate','Cal. Date','date'],
      ['cfgStatus','Configuration Status','yn'],['cfgLocation','Configuration · Location'],['saveName','Save Name'],['sensorMake','Sensor · Make'],['sensorModel','Sensor · Model'],['sensorSerial','Sensor · Serial No.'],
      ['txMake','Transmitter · Make'],['txModel','Transmitter · Model'],['txSerial','Transmitter · Serial No.'],['referJob','Data History · Refer Job No.']],
    secs:[
      {id:'cfg',t:'Configuration',ok:1,table:{k:'cfg',min:12,cols:[['d','Description',3],['b','Before calibration',2],['p','Process calibration',2],['a','After calibration',2],['c','ตรวจ','sel',['','Yes','No','แก้ไขแล้ว']]],
        quick:['Name plate · GK','Name plate · GKL','GK','GKL','Density','terminals A','measurement A','range max A','terminals D','pulse shape','100% pulse rate','measurement D','range max D','LFC threshold','LFC hysteresis']},
        fields:[['hpBefore','Config Before ถูก set ตาม High Pressure Cert.','yn'],['hpAfter','Config After ถูก set ตาม High Pressure Cert.','yn']]},
      {id:'rec',t:'บันทึกข้อมูล (Record data)',ok:1,note:'ผู้บันทึกข้อมูล Configuration'},
      {id:'re',t:'ตรวจซ้ำข้อมูล (Recheck data)',ok:1,other:'rec',note:'ต้องเป็นคนละคนกับผู้บันทึก'},
      {id:'ri1',t:'Recheck data หลังติดตั้ง · ครั้งที่ 1',ok:1,opt:1},
      {id:'ri2',t:'Recheck data หลังติดตั้ง · ครั้งที่ 2',ok:1,opt:1}]},
  rr:{code:'FLS-F-162',pre:'RR',name:'Remove-Reinstall Transmitter Check Sheet',sub:'ถอด-ติดตั้งหน้างาน',per:'item',
    head:[['inst','Instrument Transmitter','checks',['Pressure','D/P','Flow Tx','Level','Temp Tx','Temp. Sensor']],['fm','Flow meter','checks',['Mass Flow','Vortex flow','Magnetic flow','PD Meter','Ultrasonic','Other']],
      ['plant','Plant'],['location','Location'],['tag','Tag no.'],['flange','Flange size'],['cls','Class'],['rangeTrans','Range Trans.'],['rangeDisplay','Range display'],['rangeDcs','Range DCS'],
      ['scaffold','Scaffolding','checks',['Require','Not require','Installation','Remove']],['heavy','Heavy Equipment','checks',['Crane','Hiab','Hanging Hoist','Other']],['craneTon','Crane (Ton)'],
      ['gasket','Gasket','checks',['Non-Asbestos','Spiral Wound PTFE','Spiral Wound Graphite','Teflon (PTFE)']],['insul','Insulation','checks',['Hot','Cold','Remove','Install']]],
    secs:[
      {id:'rm',t:'Inspection Activity · ถอด (Remove)',ok:1,note:'Tested and inspected by · REMOVE',items:['ถอดสาย Signal อุปกรณ์','ถอด Power Cable','ถอด flange','ถอด accessories','Mark ทิศทาง Flow meter flange / pipe',['Check flange flow meter','o',['Pass','Not pass']],'ติดตั้ง wood plate or Plastic Cover @ Flange Meter','ติดตั้ง Plastic Cover ป้องกัน Diaphragm Transmitter','ติดตั้ง blind flange or blind plate @ pipe line after remove']},
      {id:'in',t:'Inspection Activity · ติดตั้ง (Reinstall)',ok:1,note:'Tested and inspected by · REINSTALL',items:['ติดตั้งสาย Signal อุปกรณ์','ติดตั้ง Power Cable','ติดตั้ง flange','ติดตั้ง accessories',['Bolts & Nuts','o',['ใหม่','เก่า']],'Use new gasket','Bolt alignment after reinstall','Leakage test','Loop Test','Service / manifold valve open and balance valve',['Torque Value (if require)','val'],['Flange Torque Value (if require)','val'],['ตรวจสอบจอ Transmitter','o',['Normal','Fail']],'หมีบซีล Flow Transmitter','Save configuration']},
      {id:'fc',t:'Flow Computer',ok:1,opt:1,items:['Print Before / After of Snapshort + Configuration','Save file configuration Flow computer','คืนค่า Override Temp / Pressure / Flow','ตรวจสอบ Temp / Pressure / Flow ทุกค่ากลับมาอ่าน online','หมีบซีลตู้ FLOW COMPUTER','Lock switch Controller (กรณีพื้นที่ Tuckload)']},
      {id:'res',t:'Inspection Result',ok:1,table:{k:'tb',min:4,cols:[['n','สาย',1],['tb1','TB',1],['c1','Color',1],['tb2','TB',1],['c2','Color',1]],seed:[{n:'Power'},{n:'Signal'},{n:'Sensor'},{n:'Sensor'}]},
        table2:{k:'loop',min:5,title:'Loop Test Signal',cols:[['uf','Upward · Field simulation',1],['ud','Upward · DCS Reading',1],['df','Downward · Field simulation',1],['dd','Downward · DCS Reading',1]]},
        fields:[['temp','Confirm Temp Sensor with DCS · Temp Value (°C)'],['density','ค่า Density (kg/m3)'],['zBefore','ค่าก่อน Verify Zero'],['zAfter','ค่าหลัง Verify Zero'],['zCal','ค่า Calibrate Zero (ถ้าจำเป็น)'],['zLive','ค่า Live ZERO']],
        items:['ZERO: เปิด Produce เข้าสู่ระบบ meter ก่อนทำการ Zero','ZERO: ตรวจสอบ Produce ต้องเต็มให้เต็มท่อ และไม่มีอากาศเหลือภายในท่อ ก่อน ZERO METER','ZERO: ตรวจสอบ Density ก่อนทำการ Zero','ZERO: ตรวจสอบ Pressure ในท่อก่อนทำการ Zero Meter']},
      {id:'sig',t:'Customer / Government Witness',sign:[['customer','Customer witness'],['gov','Government witness',1]],opt:1}]},
  sr:{code:'FLS-F-158',pre:'SR',name:'Service Report',sub:'รายงานบริการหน้างาน',per:'plan',
    head:[['requestNo','Request No.'],['customer','Customer'],['location','Location'],['attn','Attn. Person'],['tel','Tel. No.'],['serviceDate','Service date','date'],
      ['team','Flowlab Team','area'],['transport','Transport','radio',['Request transport from GA','Pickup truck of Laboratory department','Other']],['plate','License plate / Other'],
      ['w1s','Working time · First · Start','time'],['w1f','First · Finished','time'],['w2s','Second · Start','time'],['w2f','Second · Finished','time'],['w3s','Third · Start','time'],['w3f','Third · Finished','time']],
    secs:[
      {id:'work',t:'งานที่ทำต่อ Tag',ok:1,table:{k:'items',min:3,cols:[['tag','Tag / SN',2],['product','Product',1],['type','Type',1],['size','Size',1],['cls','Class',1],['gasket','Gasket','sel',['','Customer','FLS']],
        ['dis','Disconnection','chk'],['ins','Installation','chk'],['torque','Test Torque','chk'],['zero','Set zero','chk'],['loop','Loop test','chk'],['linear','Input linear','chk'],['leak','Test leak','chk'],['hiab','Hiab (Ton)',1],['crane','Crane (Ton)',1],['other','Other',2]]}},
      {id:'result',t:'ผล / ปัญหาของงาน',ok:1,fields:[['remark','Remark','area'],['result','Result / Work Problem','area'],['additional','Additional','area']]},
      {id:'sig',t:'ลายเซ็น',sign:[['leader','Flowlab leader'],['customer','Customer'],['gov','Government',1]],need:['leader','customer']}]}
};
const CS_STATE={draft:{th:'กำลังทำ',c:'var(--warn)'},submitted:{th:'รออนุมัติ',c:'var(--accent)'},approved:{th:'อนุมัติแล้ว',c:'var(--good)'},rejected:{th:'ตีกลับแก้ไข',c:'var(--crit)'}};
const csById=id=>S.checks.find(c=>c.id===id)||null;
const csMe=()=>String(S.me||'').trim().toLowerCase();
const csWho=b=>b?esc(String(b).split('@')[0]):'—';
/* approvers per form (ข้อมูลหลัก › ผู้อนุมัติ Check Sheet); none listed / off the central DB = admin + planner */
const csApprovers=f=>String(((S.cfg||{}).csApprovers||{})[f]||'').split(/[\s,;]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
function canApprove(c){
  if(!c||c.state!=='submitted'&&c.state!=='approved')return false;
  const l=csApprovers(c.form);const ok=S.backend==='supabase'&&l.length?l.includes(csMe()):can('master');
  return ok&&!(S.backend==='supabase'&&csMe()&&String(c.submittedBy||'').toLowerCase()===csMe());/* not your own */
}
const canEditCs=c=>!!c&&(c.state==='draft'||c.state==='rejected')&&canWork();
/* every item key of a section */
const csItemKey=(s,i)=>`${s.id}.${i}`;
const csItemDef=it=>Array.isArray(it)?{l:it[0],t:it[1],o:it[2]}:{l:it,t:'chk'};
function csSecDone(c,s){const st=c.steps&&c.steps[s.id];return !!(st&&st.at)}
const csReqSecs=f=>CS_FORMS[f].secs.filter(s=>!s.opt&&(s.qc||s.ok||s.need));
function csProgress(c){const req=csReqSecs(c.form);const n=req.filter(s=>s.sign?csSignOk(c,s):csSecDone(c,s)).length;return [n,req.length]}
const csSignOk=(c,s)=>(s.need||[]).every(k=>c.sig&&c.sig[k]&&c.sig[k].img);

/* Delay / On Process / Timely (the same chips as ใบรับคำร้องขอรับบริการสอบเทียบ): 1 working day to approve after it is sent; a sheet still open
   a working day after its date (plan date / receive date / made) is Delay */
function csFlow(c){
  if(!c)return null;const days=Math.max(1,Number(((S.cfg||{}).jobKpi||{}).csDays)||1);
  if(c.state==='approved'){const due=addWorkDays(new Date(c.submittedAt||c.createdAt),days);return new Date(c.approvedAt)<=due?['timely',`อนุมัติ ${jbWhen(c.approvedAt)}`]:['delay',`อนุมัติช้า (${jbWhen(c.approvedAt)})`]}
  if(c.state==='submitted'){const due=addWorkDays(new Date(c.submittedAt),days);return Date.now()>due?['delay',`รออนุมัติเกินกำหนด ${jbWhen(due)}`]:['process',`ต้องอนุมัติภายใน ${jbWhen(due)}`]}
  if(c.state==='rejected')return ['delay',`ตีกลับ: ${c.rejectReason||''}`];
  const ref=c.h&&(c.h.serviceDate||c.h.calDate||c.h.receiveDate)||String(c.createdAt||'').slice(0,10);
  const due=ref?addWorkDays(parseD(ref.slice(0,10)),days):null;
  return due&&Date.now()>due?['delay','ยังไม่ส่งตรวจ · เลยกำหนด']:['process','กำลังทำ'];
}
function nextCsNo(form){
  const d=new Date();const pre=`${CS_FORMS[form].pre}-${String(d.getFullYear()).slice(-2)}-${pad(d.getMonth()+1)}`;
  const max=S.checks.map(c=>String(c.no||'')).filter(x=>x.startsWith(pre)).map(x=>Number(x.slice(pre.length))||0).reduce((a,b)=>Math.max(a,b),0);
  return pre+String(max+1).padStart(3,'0');
}
/* ---------- new sheet: the header comes from the booking / plan (nothing typed twice) ---------- */
function csPrefill(form,job,item,task){
  const j=job||{},it=item||{},t=task||{};const h={};
  if(form==='qc')Object.assign(h,{customer:j.customer||t.customer||'',tag:it.tag||'',receiveDate:j.receiveDate||'',requestNo:j.planNo||t.planNo||''});
  if(form==='data')Object.assign(h,{customer:j.customer||t.customer||'',highPressure:j.highPressure?'yes':'',type:it.type||'',tag:it.tag||'',size:[it.size?it.size+'"':'',it.cls].filter(Boolean).join(' '),receiveDate:j.receiveDate||'',referJob:it.refer||''});
  if(form==='rr'){const ty=norm(it.type||'');Object.assign(h,{plant:j.location||t.location||'',location:t.location||j.location||'',tag:it.tag||'',flange:it.size?it.size+'"':'',cls:it.cls||'',
    fm:/coriolis|mass/.test(ty)?['Mass Flow']:/vortex/.test(ty)?['Vortex flow']:/mag/.test(ty)?['Magnetic flow']:/ultra/.test(ty)?['Ultrasonic']:/pd|positive/.test(ty)?['PD Meter']:[],rangeTrans:it.range||''})}
  if(form==='sr'){const cars=typeof deptCars==='function'?deptCars(t):[];
    Object.assign(h,{requestNo:t.planNo||j.planNo||'',customer:t.customer||j.customer||'',location:t.location||j.location||'',attn:t.contact||j.contact||'',tel:t.contactTel||j.contactTel||'',serviceDate:t.date||'',
      team:(t.staffIds||[]).map(staffName).concat(t.guests||[]).map((n,i)=>`${i+1}) ${n}`).join('\n'),transport:t.needGA?'Request transport from GA':cars.length?'Pickup truck of Laboratory department':'',plate:cars.join(', ')})}
  const tb={};
  if(form==='sr'&&job)tb.items=(job.items||[]).map(x=>({tag:x.tag||'',product:x.product||'',type:x.type||'',size:x.size||'',cls:x.cls||''}));
  const f=CS_FORMS[form];f.secs.forEach(s=>{[s.table,s.table2].filter(Boolean).forEach(T=>{if(!tb[T.k])tb[T.k]=(T.seed||[]).map(r=>Object.assign({},r))})});
  return {h,tb};
}
async function csCreate(form,{jobId,itemId,taskId}={}){
  if(!canWork())return;const task=taskId?findTask(taskId):null;const job=jbById(jobId||(task&&task.jobId)||'');/* a plan made from a booking brings its meters */const item=job&&itemId?(job.items||[]).find(x=>x.id===itemId):null;
  const dup=S.checks.find(c=>c.form===form&&(itemId?c.itemId===itemId&&(form!=='rr'||c.taskId===(taskId||'')):c.taskId===taskId)&&c.state!=='rejected');
  if(dup){openCs(dup.id);return}
  const p=csPrefill(form,job,item,task);const now=new Date().toISOString();const id=newId('cs');
  const data={form,no:nextCsNo(form),jobId:jobId||(task&&task.jobId)||'',itemId:itemId||'',taskId:taskId||'',planNo:(job&&job.planNo)||(task&&task.planNo)||'',
    title:item?jbItemText(item):task?`${fmtDay(task.date)} · ${typeLabel(task)}`:'',h:p.h,v:{},tb:p.tb,steps:{},sig:{},state:'draft',createdAt:now,createdBy:S.me||null,updatedAt:now,updatedBy:S.me||null};
  try{await Store.set('checks',id,data);toast(`สร้าง ${data.no} · ${CS_FORMS[form].name} แล้ว`);openCs(id,data)}catch(err){toast(errText(err));noteWriteError(err)}
}

/* ---------- the sheet (dialog #csDlg) ---------- */
let csEdit=null;
function openCs(id,fresh){
  const c=csById(id)||(fresh?Object.assign({id},fresh):null);if(!c)return;
  csEdit=JSON.parse(JSON.stringify(c));csEdit.id=id;
  csDraw();const d=$('#csDlg');if(!d.open)d.showModal();
}
function csDraw(){
  const c=csEdit;const F=CS_FORMS[c.form];const ed=canEditCs(c);const dis=ed?'':' disabled';const st=CS_STATE[c.state]||CS_STATE.draft;
  const [n,tot]=csProgress(c);const job=c.jobId?jbById(c.jobId):null;
  $('#csTitle').textContent=`${c.no} · ${F.name}`;
  $('#csSub').textContent=`${F.code} · ${c.planNo||'—'}${c.title?' · '+c.title:''}${job?' · '+job.customer:''}`;
  const hf=([k,l,t,o])=>{const val=c.h[k]==null?'':c.h[k];const nm=`data-cs="h|${k}"`;
    const inner=t==='date'?`<input type="date" ${nm} value="${esc(val)}"${dis}>`:t==='time'?`<input type="time" ${nm} value="${esc(val)}"${dis}>`:t==='area'?`<textarea rows="3" ${nm}${dis}>${esc(val)}</textarea>`
      :t==='yn'?`<div class="jb-rad">${[['yes','Yes'],['no','No']].map(([v,x])=>`<label><input type="radio" name="csh-${k}" ${nm} value="${v}"${val===v?' checked':''}${dis}><span>${x}</span></label>`).join('')}</div>`
      :t==='radio'?`<div class="jb-rad">${o.map(x=>`<label><input type="radio" name="csh-${k}" ${nm} value="${esc(x)}"${val===x?' checked':''}${dis}><span>${esc(x)}</span></label>`).join('')}</div>`
      :t==='checks'?`<div class="jb-chk">${o.map(x=>`<label><input type="checkbox" data-cs="hc|${k}" value="${esc(x)}"${(val||[]).includes(x)?' checked':''}${dis}><span>${esc(x)}</span></label>`).join('')}</div>`
      :`<input ${nm} value="${esc(val)}" maxlength="200"${dis}>`;
    return `<div class="field${t==='area'||t==='checks'||t==='radio'?' wide':''}"><label>${esc(l)}</label>${inner}</div>`};
  $('#csBody').innerHTML=`<div class="cs-top"><span class="ncr-st" style="--c:${st.c}">${esc(st.th)}</span>${flowChip(csFlow(c))}<span class="cs-prog"><b>${n}/${tot}</b> หัวข้อยืนยันแล้ว</span>
      <span class="cs-meta">สร้าง ${esc(jbWhen(c.createdAt))} · ${csWho(c.createdBy)}${c.submittedAt?` · ส่งตรวจ ${esc(jbWhen(c.submittedAt))} · ${csWho(c.submittedBy)}`:''}${c.approvedAt?` · อนุมัติ ${esc(jbWhen(c.approvedAt))} · ${csWho(c.approvedBy)}`:''}</span></div>
    ${c.state==='rejected'?`<div class="reason-box cancelled"><b>ตีกลับเมื่อ ${esc(jbWhen(c.rejectedAt))} โดย ${csWho(c.rejectedBy)} · แก้แล้วส่งตรวจใหม่</b><span>${esc(c.rejectReason||'')}</span></div>`:''}
    <fieldset class="jb-sec"><legend>ข้อมูล · ${esc(F.sub)}</legend><div class="ncr-grid jb-grid">${F.head.map(hf).join('')}</div></fieldset>
    ${F.secs.map(s=>csSecHtml(c,s,ed)).join('')}
    ${csApproveHtml(c)}
    ${isoHistoryHtml(c)}<p class="form-err" id="csErr" hidden></p>`;
  $('#csSave').hidden=!ed;$('#csSubmit').hidden=!ed;$('#csDel').hidden=!(can('del')||(c.state==='draft'&&c.createdBy&&String(c.createdBy).toLowerCase()===csMe()));
  csPads();
}
function csSecHtml(c,s,ed){
  const dis=ed?'':' disabled';const step=(c.steps||{})[s.id];const done=!!(step&&step.at);const lock=done||!ed;const ld=lock?' disabled':'';
  const items=(s.items||[]).map((raw,i)=>{const it=csItemDef(raw);const k=csItemKey(s,i);const v=c.v[k];
    const extra=it.t==='o'?`<span class="cs-o">${it.o.map(x=>`<label><input type="radio" name="csv-${k}" data-cs="vo|${k}" value="${esc(x)}"${v===x?' checked':''}${ld}>${esc(x)}</label>`).join('')}</span>`
      :it.t==='val'?`<input class="cs-val" data-cs="v|${k}|val" value="${esc(v&&v.val||'')}" placeholder="ค่า"${ld}>`:'';
    const box=it.t==='o'?'':`<input type="checkbox" data-cs="vc|${k}"${(v===true||(v&&v.on))?' checked':''}${ld}>`;
    return `<li class="cs-it">${box?`<label class="cs-chk">${box}<span>${esc(it.l)}</span></label>`:`<span class="cs-l">${esc(it.l)}</span>`}${extra}</li>`}).join('');
  const table=T=>!T?'':`<div class="cs-tbw">${T.title?`<b class="cs-tbt">${esc(T.title)}</b>`:''}<div class="scroll-x plain"><table class="mini cs-tb"><thead><tr><th>#</th>${T.cols.map(([,l])=>`<th>${esc(l)}</th>`).join('')}${!lock?'<th></th>':''}</tr></thead><tbody>
      ${csRows(c,T).map((r,ri)=>`<tr><td class="num">${ri+1}</td>${T.cols.map(([ck,,w,o])=>`<td>${w==='chk'?`<input type="checkbox" data-cs="tbc|${T.k}|${ri}|${ck}"${r[ck]?' checked':''}${ld}>`:w==='sel'?`<select data-cs="tb|${T.k}|${ri}|${ck}"${ld}>${o.map(x=>`<option${x===(r[ck]||'')?' selected':''}>${esc(x)}</option>`).join('')}</select>`:`<input data-cs="tb|${T.k}|${ri}|${ck}" value="${esc(r[ck]||'')}"${ck==='d'&&T.quick?' list="cs-dl-'+T.k+'"':''}${ld}>`}</td>`).join('')}${!lock?`<td><button type="button" class="ph-x2" data-cs-rowdel="${T.k}|${ri}" aria-label="ลบแถว">×</button></td>`:''}</tr>`).join('')}</tbody></table></div>
      ${!lock?`<button type="button" class="btn sm" data-cs-rowadd="${T.k}">+ เพิ่มแถว</button>`:''}${T.quick?`<datalist id="cs-dl-${T.k}">${T.quick.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`:''}</div>`;
  const fields=(s.fields||[]).map(([k,l,t])=>{const val=c.h[k]==null?'':c.h[k];
    return `<div class="field${t==='area'?' wide':''}"><label>${esc(l)}</label>${t==='area'?`<textarea rows="3" data-cs="h|${k}"${ld}>${esc(val)}</textarea>`:t==='yn'?`<div class="jb-rad">${[['yes','ใช่'],['no','ไม่ใช่']].map(([v,x])=>`<label><input type="radio" name="csh-${k}" data-cs="h|${k}" value="${v}"${val===v?' checked':''}${ld}><span>${x}</span></label>`).join('')}</div>`:`<input data-cs="h|${k}" value="${esc(val)}"${ld}>`}</div>`}).join('');
  const sign=(s.sign||[]).map(([k,l,gov])=>{const g=(c.sig||{})[k];
    return `<div class="cs-sig"><b>${esc(l)}${(s.need||[]).includes(k)?' <b class="req">*</b>':''}</b>${gov?`<div class="jb-chk">${CS_SIGN_GOV.map(([v,x])=>`<label><input type="radio" name="csg-${k}" data-cs="sk|${k}" value="${v}"${g&&g.kind===v?' checked':''}${ed&&!(g&&g.img)?'':' disabled'}>${x}</label>`).join('')}</div>`:''}
      ${g&&g.img?`<img src="${g.img}" alt="ลายเซ็น ${esc(g.name||'')}"><span>${esc(g.name||'')} · ${esc(jbWhen(g.at))}</span>${ed?`<button type="button" class="lnk" data-cs-sigclr="${k}">เซ็นใหม่</button>`:''}`
        :ed?`<canvas class="cs-pad" data-cs-pad="${k}" width="520" height="170" aria-label="ช่องเซ็นชื่อ ${esc(l)}"></canvas><div class="cs-sigrow"><input data-cs-signame="${k}" placeholder="ชื่อ-นามสกุล ผู้เซ็น" maxlength="80"><button type="button" class="lnk" data-cs-padclr="${k}">ล้าง</button><button type="button" class="btn sm primary" data-cs-sigsave="${k}">บันทึกลายเซ็น</button></div>`:'<span class="hint">ยังไม่ได้เซ็น</span>'}</div>`}).join('');
  const conf=s.qc||s.ok?(done?`<div class="cs-done ${step.res==='fail'?'bad':''}"><b>${step.res==='pass'?'✓ QC Pass':step.res==='fail'?'✗ QC Fail':'✓ ยืนยันแล้ว'}</b><span>${csWho(step.by)} · ${esc(jbWhen(step.at))}</span>${step.note?`<span>📝 ${esc(step.note)}</span>`:''}${ed?`<button type="button" class="lnk" data-cs-undo="${s.id}">ยกเลิกการยืนยัน</button>`:''}</div>`
      :ed?`<div class="cs-conf"><input data-cs-note="${s.id}" placeholder="${s.qc?'เอกสารอ้างอิง / Remark (ไม่บังคับ)':'หมายเหตุ (ไม่บังคับ)'}" maxlength="200">${s.qc?`<button type="button" class="btn sm cs-pass" data-cs-step="${s.id}|pass">✓ QC Pass</button><button type="button" class="btn sm danger" data-cs-step="${s.id}|fail">✗ Fail</button>`:`<button type="button" class="btn sm primary" data-cs-step="${s.id}|ok">ยืนยันหัวข้อนี้</button>`}</div>`:'<span class="hint">ยังไม่ยืนยัน</span>'):'';
  return `<fieldset class="jb-sec cs-sec${done?' done':''}${s.opt?' opt':''}"><legend>${esc(s.t)}${s.opt?' <small>(ถ้ามี)</small>':''}${s.note?` <small>· ${esc(s.note)}</small>`:''}</legend>
    ${items?`<ul class="cs-items">${items}</ul>`:''}${table(s.table)}${table(s.table2)}${fields?`<div class="ncr-grid jb-grid">${fields}</div>`:''}${sign?`<div class="cs-sigs">${sign}</div>`:''}${conf}</fieldset>`;
}
const csRows=(c,T)=>{const r=(c.tb&&c.tb[T.k])||[];return r.length>=(T.min||0)?r:r.concat(Array.from({length:(T.min||0)-r.length},()=>({})))};
function csApproveHtml(c){
  const appr=csApprovers(c.form);
  const who=appr.length?appr.map(x=>x.split('@')[0]).join(', '):'ผู้ดูแลระบบ / ผู้วางแผน';
  if(c.state==='submitted')return `<fieldset class="jb-sec cs-appr"><legend>อนุมัติ Check Sheet</legend><p class="hint">ผู้อนุมัติ: ${esc(who)} · ผู้ส่งตรวจอนุมัติใบของตัวเองไม่ได้</p>
    ${canApprove(c)?`<div class="cs-conf"><input id="cs-apNote" placeholder="ความเห็น / เหตุผล (ตีกลับต้องใส่)" maxlength="300"><button type="button" class="btn primary" data-cs-approve>อนุมัติ</button><button type="button" class="btn danger" data-cs-reject>ตีกลับแก้ไข</button></div>`:'<p class="hint">รอผู้อนุมัติ</p>'}</fieldset>`;
  if(c.state==='approved')return `<fieldset class="jb-sec cs-appr ok"><legend>อนุมัติแล้ว</legend><p><b>${csWho(c.approvedBy)}</b> · ${esc(jbWhen(c.approvedAt))}${c.approveNote?` · ${esc(c.approveNote)}`:''}</p>
    ${canApprove(c)?`<div class="cs-conf"><input id="cs-apNote" placeholder="เหตุผลที่เปิดแก้ไขใหม่" maxlength="300"><button type="button" class="btn sm" data-cs-reopen>ยกเลิกอนุมัติ (เปิดแก้ไข)</button></div>`:''}</fieldset>`;
  return '';
}
function csErr(m){const e=$('#csErr');if(e){e.textContent=m||'';e.hidden=!m}}
/* signature pads: draw with mouse / finger / pen */
function csPads(){
  document.querySelectorAll('#csBody canvas[data-cs-pad]').forEach(cv=>{if(cv.dataset.on)return;cv.dataset.on='1';const x=cv.getContext('2d');x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#0b1b33';let down=false,last=null;
    const pt=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]};
    cv.addEventListener('pointerdown',e=>{down=true;last=pt(e);cv.setPointerCapture(e.pointerId);cv.dataset.ink='1'});
    cv.addEventListener('pointermove',e=>{if(!down)return;const p=pt(e);x.beginPath();x.moveTo(last[0],last[1]);x.lineTo(p[0],p[1]);x.stroke();last=p});
    ['pointerup','pointercancel','pointerleave'].forEach(n=>cv.addEventListener(n,()=>{down=false}))});
}
/* ---------- saving ---------- */
async function csSave(patch,msg){
  const c=csEdit;if(!c)return false;const now=new Date().toISOString();
  const data=Object.assign({},c,patch||{},{updatedAt:now,updatedBy:S.me||null});delete data.id;delete data.dirty;
  try{await Store.set('checks',c.id,data);csEdit=Object.assign({id:c.id},JSON.parse(JSON.stringify(data)));if(msg)toast(msg);csDraw();return true}
  catch(err){csErr(errText(err));noteWriteError(err);return false}
}
async function csStep(sid,res){
  const c=csEdit;const s=CS_FORMS[c.form].secs.find(x=>x.id===sid);if(!s||!canEditCs(c))return;
  if(s.other){const o=(c.steps||{})[s.other];if(o&&o.by&&S.me&&String(o.by).toLowerCase()===csMe()){csErr(`"${s.t}" ต้องเป็นคนละคนกับผู้ยืนยัน "${CS_FORMS[c.form].secs.find(x=>x.id===s.other).t}"`);return}}
  if(s.items&&s.items.length&&res!=='fail'){const miss=s.items.map((raw,i)=>[csItemDef(raw),csItemKey(s,i)]).filter(([it,k])=>{const v=c.v[k];return it.t==='o'?!v:it.t==='val'?false:!(v===true||(v&&v.on))});
    if(miss.length&&!await askConfirm('ยังติ๊กไม่ครบ',`ยังไม่ได้ติ๊ก ${miss.length} รายการในหัวข้อนี้\n${miss.slice(0,4).map(m=>'· '+m[0].l).join('\n')}${miss.length>4?'\n…':''}\nยืนยันหัวข้อนี้ต่อหรือไม่?`,'ยืนยันต่อ'))return}
  const note=String(($(`[data-cs-note="${sid}"]`)||{}).value||'').trim();
  c.steps=Object.assign({},c.steps,{[sid]:{res,by:S.me||null,at:new Date().toISOString(),note}});
  csSave(null,`${s.t}: ${res==='pass'?'QC Pass':res==='fail'?'QC Fail':'ยืนยันแล้ว'}`);
}
async function csSubmit(){
  const c=csEdit;if(!c||!canEditCs(c))return;const F=CS_FORMS[c.form];
  const miss=csReqSecs(c.form).filter(s=>s.sign?!csSignOk(c,s):!csSecDone(c,s));
  if(miss.length){csErr(`ยังไม่ครบ: ${miss.map(s=>s.sign?s.t+' (ลายเซ็น)':s.t).join(' · ')}`);return}
  const fail=F.secs.filter(s=>(c.steps||{})[s.id]&&c.steps[s.id].res==='fail');
  if(fail.length&&!await askConfirm('มีหัวข้อ QC Fail',`มีหัวข้อที่ QC Fail: ${fail.map(s=>s.t).join(' · ')}\nส่งตรวจต่อหรือไม่?`,'ส่งตรวจ'))return;
  const now=new Date().toISOString();
  await csSave({state:'submitted',submittedAt:now,submittedBy:S.me||null,rejectReason:'',rejectedAt:'',rejectedBy:''},`ส่ง ${c.no} ให้ผู้อนุมัติแล้ว`);
}
async function csDecide(kind){
  const c=csEdit;if(!c||!canApprove(c))return;const note=String(($('#cs-apNote')||{}).value||'').trim();const now=new Date().toISOString();
  if(kind==='approve')return csSave({state:'approved',approvedAt:now,approvedBy:S.me||null,approveNote:note},`อนุมัติ ${c.no} แล้ว`);
  if(!note){csErr(kind==='reject'?'ใส่เหตุผลที่ตีกลับ':'ใส่เหตุผลที่เปิดแก้ไข');$('#cs-apNote').focus();return}
  return csSave({state:'rejected',rejectedAt:now,rejectedBy:S.me||null,rejectReason:note,approvedAt:'',approvedBy:'',approveNote:''},kind==='reject'?`ตีกลับ ${c.no} แล้ว`:`เปิดแก้ไข ${c.no} แล้ว`);
}
async function csDelete(btn){
  const c=csEdit;if(!c)return;if(!arm(btn,'cs:'+c.id,'ลบ Check Sheet','กดอีกครั้งเพื่อลบ'))return;
  try{await Store.del('checks',c.id);$('#csDlg').close();toast(`ลบ ${c.no} แล้ว`)}catch(err){csErr(errText(err));noteWriteError(err)}
}

/* ---------- lists in the booking and the plan ---------- */
const csChip=c=>{const st=CS_STATE[c.state]||CS_STATE.draft;const [n,t]=csProgress(c);return `<button type="button" class="cs-chip" data-cs-open="${esc(c.id)}" style="--c:${st.c}" title="${esc(c.no)} · ${esc(st.th)} · ${n}/${t} หัวข้อ"><b>${esc(CS_FORMS[c.form].pre)}</b>${esc(st.th)}${c.state==='draft'||c.state==='rejected'?` ${n}/${t}`:''}</button>`};
const csNew=(form,attrs,label)=>canWork()?`<button type="button" class="cs-add" data-cs-new="${form}" ${attrs} title="สร้าง ${esc(CS_FORMS[form].name)} (${CS_FORMS[form].code})">+ ${label||CS_FORMS[form].pre}</button>`:'';
function csJobHtml(j){
  if(!j||j.state!=='accepted'||!(j.items||[]).length)return '';
  const rows=(j.items||[]).map((it,i)=>{const of=f=>S.checks.filter(c=>c.form===f&&c.itemId===it.id);
    return `<tr><td class="num">${i+1}</td><td><b class="mono">${esc(it.tag||'—')}</b><span class="sub">${esc([it.type,it.size?it.size+'"':''].filter(Boolean).join(' · '))}</span></td>
      ${['qc','data','rr'].map(f=>`<td>${of(f).map(csChip).join('')}${of(f).some(c=>c.state!=='rejected')&&f!=='rr'?'':csNew(f,`data-cs-job="${esc(j.id)}" data-cs-item="${esc(it.id)}"`)}</td>`).join('')}</tr>`}).join('');
  return `<fieldset class="jb-sec"><legend>Check Sheet ของแต่ละเครื่อง</legend><div class="scroll-x plain"><table class="mini cs-list"><thead><tr><th>#</th><th>TAG</th><th>QC LAB <small>F-161</small></th><th>Data Flow Meter <small>F-122</small></th><th>Remove-Reinstall <small>F-162</small></th></tr></thead><tbody>${rows}</tbody></table></div>
    <small class="hint">แต่ละใบ: ทำทีละหัวข้อ (ยืนยัน / QC Pass-Fail ลงชื่อและเวลาให้เอง) → ส่งตรวจ → ผู้อนุมัติอนุมัติหรือตีกลับ · Service Report ทำที่แผนรายวัน</small></fieldset>`;
}
function csPlanHtml(t){
  if(!t||isLeave(t))return '';const job=t.jobId?jbById(t.jobId):null;
  const sr=S.checks.filter(c=>c.form==='sr'&&c.taskId===t.id);const rr=S.checks.filter(c=>c.form==='rr'&&c.taskId===t.id);
  const items=job?(job.items||[]):[];
  return `<div class="cs-plan"><b>Check Sheet ของงานนี้</b>
    <div class="cs-pl-row"><span>Service Report</span>${sr.map(csChip).join('')}${sr.some(c=>c.state!=='rejected')?'':csNew('sr',`data-cs-task="${esc(t.id)}"`,'สร้าง Service Report')}</div>
    ${items.map(it=>{const mine=rr.filter(c=>c.itemId===it.id);return `<div class="cs-pl-row"><span>Remove-Reinstall · <b class="mono">${esc(it.tag||'—')}</b></span>${mine.map(csChip).join('')}${mine.some(c=>c.state!=='rejected')?'':csNew('rr',`data-cs-task="${esc(t.id)}" data-cs-job="${esc(job.id)}" data-cs-item="${esc(it.id)}"`,'สร้าง')}</div>`}).join('')}
    ${!items.length?`<div class="cs-pl-row"><span>Remove-Reinstall</span>${rr.map(csChip).join('')}${csNew('rr',`data-cs-task="${esc(t.id)}"`,'สร้าง')}</div>`:''}</div>`;
}
/* an approved Service Report / Remove-Reinstall sheet of the plan counts as its after-job document (js/dialog/report.js) */
function csApprovedFor(t,kind){
  if(!t)return null;const f=kind==='sr'?'sr':kind==='qc'?'rr':'';if(!f)return null;
  return S.checks.find(c=>c.form===f&&c.taskId===t.id&&c.state==='approved')||null;
}

/* ---------- page ---------- */
const CS_TABS=[['todo','รออนุมัติ'],['draft','กำลังทำ'],['rejected','ตีกลับ'],['approved','อนุมัติแล้ว'],['all','ทั้งหมด']];
function csFiltered(){
  const q=norm(S.csF.q);const tab=S.csF.tab;
  return S.checks.filter(c=>(tab==='all'||(tab==='todo'?c.state==='submitted':c.state===tab))&&(!S.csF.form||c.form===S.csF.form)
    &&(!q||norm([c.no,c.planNo,c.title,c.h&&c.h.customer,c.h&&c.h.tag,CS_FORMS[c.form].name].join(' ')).includes(q)))
    .sort((a,b)=>String(b.submittedAt||b.updatedAt||'').localeCompare(String(a.submittedAt||a.updatedAt||'')));
}
function fillChecks(){
  const tb=$('#csRows');if(!tb)return;const list=csFiltered();
  tb.innerHTML=list.map(c=>{const st=CS_STATE[c.state]||CS_STATE.draft;const [n,t]=csProgress(c);
    return `<tr data-cs-open="${esc(c.id)}"><td><b class="mono">${esc(c.no)}</b><span class="sub">${esc(CS_FORMS[c.form].name)}</span></td><td class="mono">${esc(c.planNo||'—')}</td>
      <td>${esc((c.h&&c.h.customer)||'—')}<span class="sub">${esc(c.title||'')}</span></td><td>${csWho(c.createdBy)}<span class="sub">${esc(jbWhen(c.createdAt))}</span></td>
      <td><div class="cs-bar"><i style="width:${t?Math.round(n/t*100):0}%"></i></div><span class="sub">${n}/${t} หัวข้อ</span></td>
      <td><span class="ncr-st" style="--c:${st.c}">${esc(st.th)}</span>${flowChip(csFlow(c))}</td></tr>`}).join('')
    ||`<tr><td colspan="6" class="hint">${S.checks.length?'ไม่พบ Check Sheet ที่ตรงกับตัวกรอง':'ยังไม่มี Check Sheet · สร้างได้จากใบรับคำร้องขอรับบริการสอบเทียบ (ต่อเครื่อง) หรือหน้าดูแผน (Service Report)'}</td></tr>`;
  const n=$('#csCount');if(n)n.textContent=`${list.length} ใบ`;
}
function renderChecks(){
  if(notReady()||(S.mode==='live'&&!S.checksReady))return loading();
  const cnt=s=>S.checks.filter(c=>c.state===s).length;const mine=S.checks.filter(c=>c.state==='submitted'&&canApprove(c)).length;
  const tile=(id,lbl,n,cls,note)=>`<button type="button" class="tile ncr-tile${cls?' '+cls:''}" data-cs-tab="${id}" aria-pressed="${S.csF.tab===id}"><span class="lbl">${lbl}</span><span class="val">${n}<small>ใบ</small></span>${note?`<span class="note">${note}</span>`:''}</button>`;
  return `<div class="sum"><div class="tiles">${tile('todo','รออนุมัติ',cnt('submitted'),mine?'alert':cnt('submitted')?'warnt':'',mine?`รอคุณอนุมัติ ${mine} ใบ`:'')}${tile('draft','กำลังทำ',cnt('draft'),'')}${tile('rejected','ตีกลับแก้ไข',cnt('rejected'),cnt('rejected')?'alert':'')}${tile('approved','อนุมัติแล้ว',cnt('approved'),'')}${tile('all','ทั้งหมด',S.checks.length,'')}</div>
    <section class="panel span-12"><header><h2>Check Sheet <span class="md-count" id="csCount"></span></h2><p>QC LAB · Data Flow Meter · Remove-Reinstall · Service Report · ทำทีละหัวข้อ → ส่งตรวจ → อนุมัติ · กดแถวเพื่อเปิด</p></header>
      <div class="jb-tabs" role="tablist">${CS_TABS.map(([id,l])=>`<button type="button" role="tab" data-cs-tab="${id}" aria-selected="${S.csF.tab===id}">${l}</button>`).join('')}</div>
      <div class="ncr-tools"><input type="search" id="cs-q" placeholder="ค้นหาเลขที่ PN ลูกค้า Tag" value="${esc(S.csF.q)}" autocomplete="off" aria-label="ค้นหา Check Sheet">
        <select id="cs-form" aria-label="ชนิดฟอร์ม"><option value="">ทุกฟอร์ม</option>${Object.entries(CS_FORMS).map(([k,f])=>`<option value="${k}"${S.csF.form===k?' selected':''}>${esc(f.name)} (${f.code})</option>`).join('')}</select></div>
      <div class="scroll-x plain"><table class="mini ftab cs-tab"><thead><tr><th>เลขที่</th><th>PN</th><th>ลูกค้า / เครื่อง</th><th>ผู้ทำ</th><th>ความคืบหน้า</th><th>สถานะ</th></tr></thead><tbody id="csRows"></tbody></table></div></section></div>`;
}
function csBadge(){
  const n=S.checks.filter(c=>c.state==='submitted'&&canApprove(c)).length;['#csBadge','#csBadgeM'].forEach(s=>{const b=$(s);if(b){b.hidden=!n;b.textContent=n}});
}
/* ข้อมูลหลัก › ผู้อนุมัติ Check Sheet */
function csApproverSection(){
  const dis=can('master')?'':' disabled';const a=(S.cfg||{}).csApprovers||{};
  return {id:'csappr',title:'ผู้อนุมัติ Check Sheet',sub:'แยกตามฟอร์ม',count:Object.keys(CS_FORMS).filter(k=>csApprovers(k).length).length+'/4',
    desc:'อีเมลบัญชีกลางของผู้อนุมัติแต่ละฟอร์ม คั่นด้วย , · ว่าง = ผู้ดูแลระบบและผู้วางแผนอนุมัติได้ · ผู้ส่งตรวจอนุมัติใบของตัวเองไม่ได้',
    body:`<div class="cs-aset">${Object.entries(CS_FORMS).map(([k,f])=>`<label><b>${esc(f.name)}</b> <small>${f.code}</small><input data-csappr="${k}" value="${esc(a[k]||'')}" placeholder="เช่น lead.lab@company.co.th, sr.engineer@company.co.th"${dis}></label>`).join('')}
      <label><b>อนุมัติภายใน (วันทำงาน)</b> <small>เกินแล้วขึ้น Delay</small><input type="number" min="1" max="30" class="w-num" data-csdays value="${Math.max(1,Number(((S.cfg||{}).jobKpi||{}).csDays)||1)}"${dis}></label></div>`};
}

/* ---------- print (the paper form, A4) ---------- */
function csOpenPrint(html,fname){
  let w=null;try{w=window.open('','_blank')}catch(e){}
  if(w&&w.document){w.document.open();w.document.write(html);w.document.close();return}
  saveFile(fname,html,'ดาวน์โหลดแบบฟอร์มแล้ว เปิดไฟล์แล้วกด "พิมพ์ / บันทึกเป็น PDF"');
}
function csPrint(){const c=csEdit;if(c)csOpenPrint(csPrintHtml(c),`${c.no}_${CS_FORMS[c.form].code}.html`)}
/* the PDF file (js/features/pdf-export.js): the same page, A4 portrait */
function csPdf(btn){const c=csEdit;if(c)pdfExport([csPdfDoc(c)],`${c.no}_${CS_FORMS[c.form].code}.pdf`,btn)}
const csPdfDoc=c=>({html:csPrintHtml(c),orient:'p',foot:`${CS_FORMS[c.form].code} · ${c.no}${c.planNo?' · '+c.planNo:''}`});
function csPrintHtml(c){
  const F=CS_FORMS[c.form];const box=b=>b?'☑':'☐';
  const hv=([k,l,t,o])=>{const v=c.h[k];return `<tr><th>${esc(l)}</th><td>${t==='checks'?o.map(x=>`${box((v||[]).includes(x))} ${esc(x)}`).join(' &nbsp; '):t==='yn'?`${box(v==='yes')} Yes ${box(v==='no')} No`:t==='radio'?o.map(x=>`${box(v===x)} ${esc(x)}`).join(' &nbsp; '):t==='date'&&v?esc(fmtDay(v)):esc(v||'')}</td></tr>`};
  const sec=s=>{const st=(c.steps||{})[s.id];
    const items=(s.items||[]).map((raw,i)=>{const it=csItemDef(raw);const v=c.v[csItemKey(s,i)];return `<tr><td>${it.t==='o'?it.o.map(x=>`${box(v===x)} ${esc(x)}`).join(' '):box(v===true||(v&&v.on))}</td><td>${esc(it.l)}${it.t==='val'?` : <b>${esc(v&&v.val||'')}</b>`:''}</td></tr>`}).join('');
    const tbl=T=>!T?'':`${T.title?`<p><b>${esc(T.title)}</b></p>`:''}<table class="tb${T.cols.length>9?' many':''}"><tr><th>#</th>${T.cols.map(([,l])=>`<th>${esc(l)}</th>`).join('')}</tr>${csRows(c,T).map((r,ri)=>`<tr><td>${ri+1}</td>${T.cols.map(([k,,w])=>`<td>${w==='chk'?box(r[k]):esc(r[k]||'')}</td>`).join('')}</tr>`).join('')}</table>`;
    const fl=(s.fields||[]).map(([k,l,t])=>`<tr><th>${esc(l)}</th><td>${t==='yn'?`${box(c.h[k]==='yes')} ใช่ ${box(c.h[k]==='no')} ไม่ใช่`:esc(c.h[k]||'')}</td></tr>`).join('');
    const sg=(s.sign||[]).map(([k,l,gov])=>{const g=(c.sig||{})[k];return `<div class="sg"><b>${esc(l)}${gov&&g&&g.kind?' · '+esc((CS_SIGN_GOV.find(x=>x[0]===g.kind)||[])[1]||''):''}</b>${g&&g.img?`<img src="${g.img}"><span>${esc(g.name||'')} · ${esc(jbWhen(g.at))}</span>`:'<span class="ln"></span>'}</div>`}).join('');
    return `<h2>${esc(s.t)}${st&&st.at?` <span class="ok">${st.res==='pass'?'QC Pass':st.res==='fail'?'QC Fail':'ยืนยันแล้ว'} · ${csWho(st.by)} · ${esc(jbWhen(st.at))}${st.note?' · '+esc(st.note):''}</span>`:''}</h2>
      ${items?`<table class="it">${items}</table>`:''}${tbl(s.table)}${tbl(s.table2)}${fl?`<table>${fl}</table>`:''}${sg?`<div class="sgs">${sg}</div>`:''}`};
  const st=CS_STATE[c.state]||CS_STATE.draft;
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(c.no)} · ${esc(F.code)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap">
<style>@page{size:A4 portrait;margin:11mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10.5px/1.45 "IBM Plex Sans Thai",Tahoma,sans-serif;color:#0b1b33;margin:14px;max-width:188mm}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:8px 12px;background:#eef3fa;border-radius:8px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1462d0;padding-bottom:6px;margin-bottom:8px}.hd h1{font-size:16px;margin:0}.hd p{margin:0;text-align:right}
table{border-collapse:collapse;width:100%;margin:4px 0 6px}th,td{border:1px solid #9fb0c8;padding:3px 6px;text-align:left;vertical-align:top}th{background:#f3f7fd;font-weight:600;width:34%}.it td:first-child{width:28px;text-align:center}.tb th{width:auto}.many{font-size:9px}.many th,.many td{padding:2px 3px}
h2{font-size:12px;margin:10px 0 3px;padding:3px 6px;background:#e8eef8}h2 .ok{font-weight:400;font-size:10.5px;color:#1f6f43}.sgs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sg{border:1px solid #9fb0c8;padding:5px;display:grid;gap:3px;min-height:70px}.sg img{max-width:100%;height:56px;object-fit:contain}.sg .ln{border-bottom:1px solid #0b1b33;height:40px}
.ap{margin-top:10px;border:1.5px solid #0b1b33;padding:6px 8px}.foot{text-align:right;color:#4a5b75;margin-top:6px}@media print{.bar{display:none}body{margin:0;max-width:none}}${typeof isoPageCss==='function'?isoPageCss('docs'):''}</style></head><body>
<div class="bar">${printBackHtml()}<button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>${esc(F.code)} · ${esc(c.no)}</span></div>
<div class="hd"><div style="display:flex;gap:10px;align-items:center">${orgLogo(42)}<div><b>${esc(ORG_NAME)} · ${esc(DASH_ORG)}</b><h1>${esc(F.name)}</h1></div></div><p>${esc(c.no)} · Request No. ${esc(c.planNo||'—')}<br>สถานะ: ${esc(st.th)}</p></div>
<table>${F.head.map(hv).join('')}</table>${F.secs.map(sec).join('')}
<div class="ap"><b>การอนุมัติ</b> · ส่งตรวจ ${c.submittedAt?`${csWho(c.submittedBy)} ${esc(jbWhen(c.submittedAt))}`:'—'} · ${c.state==='approved'?`อนุมัติโดย <b>${csWho(c.approvedBy)}</b> ${esc(jbWhen(c.approvedAt))}${c.approveNote?' · '+esc(c.approveNote):''}`:esc(st.th)}</div>
<p class="foot">${esc(F.code)} · พิมพ์จากระบบ ${esc(jbWhen(new Date()))}</p></body></html>`;
  return html;
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  const t=e.target;
  const nw=t.closest('[data-cs-new]');if(nw){const d=nw.dataset;if(d.csJob&&$('#jbDlg').open)$('#jbDlg').close();if(dlg.open&&d.csTask)dlg.close();csCreate(d.csNew,{jobId:d.csJob||'',itemId:d.csItem||'',taskId:d.csTask||''});return}
  const op=t.closest('[data-cs-open]');if(op){if($('#jbDlg').open&&t.closest('#jbDlg'))$('#jbDlg').close();if(dlg.open&&t.closest('#dlg'))dlg.close();openCs(op.dataset.csOpen);return}
  const tb=t.closest('[data-cs-tab]');if(tb){S.csF.tab=tb.dataset.csTab;render();return}
  if(!csEdit||!t.closest('#csDlg'))return;
  const sp=t.closest('[data-cs-step]');if(sp){const [sid,res]=sp.dataset.csStep.split('|');csStep(sid,res);return}
  const un=t.closest('[data-cs-undo]');if(un){const s=Object.assign({},csEdit.steps);delete s[un.dataset.csUndo];csEdit.steps=s;csSave(null,'ยกเลิกการยืนยันหัวข้อแล้ว');return}
  const ra=t.closest('[data-cs-rowadd]');if(ra){const k=ra.dataset.csRowadd;const T=csTable(k);csEdit.tb[k]=csRows(csEdit,T).concat([{}]);csDraw();return}
  const rd=t.closest('[data-cs-rowdel]');if(rd){const [k,ri]=rd.dataset.csRowdel.split('|');const T=csTable(k);const r=csRows(csEdit,T).slice();r.splice(Number(ri),1);csEdit.tb[k]=r;csDraw();return}
  const pc=t.closest('[data-cs-padclr]');if(pc){const cv=document.querySelector(`#csBody canvas[data-cs-pad="${pc.dataset.csPadclr}"]`);if(cv){cv.getContext('2d').clearRect(0,0,cv.width,cv.height);delete cv.dataset.ink}return}
  const ss=t.closest('[data-cs-sigsave]');if(ss){const k=ss.dataset.csSigsave;const cv=document.querySelector(`#csBody canvas[data-cs-pad="${k}"]`);const nm=String(($(`[data-cs-signame="${k}"]`)||{}).value||'').trim();
    if(!cv||!cv.dataset.ink){csErr('เซ็นชื่อในช่องก่อน');return}if(!nm){csErr('ใส่ชื่อผู้เซ็น');$(`[data-cs-signame="${k}"]`).focus();return}
    const kind=(document.querySelector(`input[name="csg-${k}"]:checked`)||{}).value||'';
    csEdit.sig=Object.assign({},csEdit.sig,{[k]:{name:nm,img:cv.toDataURL('image/png'),at:new Date().toISOString(),kind}});csSave(null,`บันทึกลายเซ็น ${nm} แล้ว`);return}
  const sc=t.closest('[data-cs-sigclr]');if(sc){const s=Object.assign({},csEdit.sig);delete s[sc.dataset.csSigclr];csEdit.sig=s;csSave(null,'ลบลายเซ็นแล้ว');return}
  if(t.closest('#csSave')){csSave(null,`บันทึก ${csEdit.no} แล้ว`);return}
  if(t.closest('#csSubmit')){csSubmit();return}
  if(t.closest('[data-cs-approve]')){csDecide('approve');return}
  if(t.closest('[data-cs-reject]')){csDecide('reject');return}
  if(t.closest('[data-cs-reopen]')){csDecide('reopen');return}
  if(t.closest('#csPrint')){csPrint();return}
  if(t.closest('#csPdf')){csPdf(t.closest('#csPdf'));return}
  const dl=t.closest('#csDel');if(dl){csDelete(dl);return}
  if(t.closest('[data-cs-close]'))$('#csDlg').close();
});
const csTable=k=>{for(const s of CS_FORMS[csEdit.form].secs)for(const T of [s.table,s.table2])if(T&&T.k===k)return T;return {k,min:0}};
/* typing / ticking only changes the open copy; บันทึก / a section confirm writes it */
function csInput(e){
  const el=e.target;const a=el.dataset&&el.dataset.cs;if(!a||!csEdit||!el.closest('#csDlg'))return;const p=a.split('|');
  if(p[0]==='h'){csEdit.h[p[1]]=el.value}
  else if(p[0]==='hc'){const s=new Set(csEdit.h[p[1]]||[]);el.checked?s.add(el.value):s.delete(el.value);csEdit.h[p[1]]=[...s]}
  else if(p[0]==='vc'){const cur=csEdit.v[p[1]];csEdit.v[p[1]]=cur&&typeof cur==='object'?Object.assign({},cur,{on:el.checked}):el.checked}
  else if(p[0]==='vo'){csEdit.v[p[1]]=el.value}
  else if(p[0]==='v'){csEdit.v[p[1]]=Object.assign({},typeof csEdit.v[p[1]]==='object'?csEdit.v[p[1]]:{},{[p[2]]:el.value,on:true})}
  else if(p[0]==='tb'||p[0]==='tbc'){const T=csTable(p[1]);const r=csRows(csEdit,T).map(x=>Object.assign({},x));r[Number(p[2])][p[3]]=p[0]==='tbc'?el.checked:el.value;csEdit.tb[p[1]]=r}
  csEdit.dirty=true;
}
document.addEventListener('input',e=>{if(e.target.id==='cs-q'){S.csF.q=e.target.value;fillChecks();return}csInput(e)});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='cs-form'){S.csF.form=t.value;fillChecks();return}
  const k=t.dataset&&t.dataset.csappr;if(k!==undefined&&can('master')){saveCfg({csApprovers:Object.assign({},(S.cfg||{}).csApprovers||{},{[k]:t.value.trim()})},'บันทึกผู้อนุมัติแล้ว');return}
  if(t.dataset&&t.dataset.csdays!==undefined&&can('master')){saveCfg({jobKpi:Object.assign({},(S.cfg||{}).jobKpi||{},{csDays:Math.max(1,Math.min(30,Math.floor(Number(t.value)||1)))})},'บันทึกแล้ว');return}
  csInput(e)});
/* closing with unsaved typing asks first */
document.addEventListener('cancel',e=>{if(e.target&&e.target.id==='csDlg'&&csEdit&&csEdit.dirty){e.preventDefault();askConfirm('ยังไม่ได้บันทึก','มีข้อมูลที่ยังไม่บันทึก ปิดโดยไม่บันทึกหรือไม่?','ปิดโดยไม่บันทึก').then(ok=>{if(ok){csEdit.dirty=false;$('#csDlg').close()}})}},true);
document.addEventListener('click',e=>{const x=e.target.closest&&e.target.closest('#csDlg [data-cs-close]');if(x&&csEdit&&csEdit.dirty){e.stopImmediatePropagation();askConfirm('ยังไม่ได้บันทึก','มีข้อมูลที่ยังไม่บันทึก ปิดโดยไม่บันทึกหรือไม่?','ปิดโดยไม่บันทึก').then(ok=>{if(ok){csEdit.dirty=false;$('#csDlg').close()}})}},true);
document.addEventListener('close',e=>{if(e.target&&e.target.id==='csDlg'&&!e.target.open){/* the close event comes late: a sheet opened right after must stay */csEdit=null;if(S.view==='checks')render();if(dlg.open&&editing)refreshDrawerView()}},true);
