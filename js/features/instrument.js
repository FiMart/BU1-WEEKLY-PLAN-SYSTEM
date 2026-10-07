'use strict';
/* BU1 Weekly Plan · Weekly plan instrument (สายงาน Instrument), the team's sheet (user, 6 Oct 2026):
   a yellow "Date: 30 Aug 26 วันอาทิตย์" bar, then Request No. · LAB · Customer · Plant · TAG / SN. · Type ·
   Range / Set Point / Nor.Temp (Unit) · Remove · Cal · install · BU · SALE · ชื่อลูกค้า · Plan · Actual · Remark,
   and under each row its certificates: Item · Certificate_No · Request_No · Tag_No · Description · Client Name ·
   Cal_Date · Activity · Note.
   Date, Customer, SALE and ชื่อลูกค้า (the plan's Contact) come from the plan; the rest are task.insItems
   (central DB: data.bu1wp.insItems) = [{id, reqNo, lab, plant, tag, type, range, remove, cal, install, bu, plan,
   actual, remark, certs:[{id, certNo, tagNo, desc, client, calDate, activity, note}]}].
   Request No. defaults to the Plan No.; Remove / Cal / install (the yellow columns), Actual and Remark can be changed
   straight from the week table and the plan card (saved at once). */
const INS_MAX=40,INS_CERT_MAX=60;
const INS_FIELDS=['reqNo','lab','plant','tag','type','range','remove','cal','install','bu','plan','actual','remark'];
const INS_CERT_FIELDS=['certNo','tagNo','desc','client','calDate','activity','note'];
const INS_TYPES=['PT','TT','TE','PG','TG','DPT','LT','FT','PI','TI','RTD','Thermocouple','Pressure Gauge','Thermometer','Hygrometer','Data Logger'];
const INS_REMARKS=['Completed','In progress','Pending','Postponed','Cancelled'];
const INS_ACTIVITIES=['Calibration','Repair','Adjust','Verification','Installation'];
const INS_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M7.5 13h1M15.5 13h1M12 8.5v1"/><path d="M9 21h6"/></svg>';
const insStr=v=>String(v==null?'':v);
const insOf=t=>(Array.isArray(t&&t.insItems)?t.insItems:[]).filter(x=>x&&typeof x==='object').map(x=>Object.assign({id:x.id||newId('i')},
  ...INS_FIELDS.map(f=>({[f]:insStr(x[f])})),{certs:(Array.isArray(x.certs)?x.certs:[]).filter(c=>c&&typeof c==='object').map(c=>Object.assign({id:c.id||newId('k')},...INS_CERT_FIELDS.map(f=>({[f]:insStr(c[f])}))))}));
const insReq=(t,x)=>x&&x.reqNo||t&&t.planNo||'';
const insNum=v=>{const n=parseFloat(v);return isFinite(n)?n:0};
const insDone=x=>/complete/i.test(x.remark||'');
/* 30-Aug as on the sheet; "Date: 30 Aug 26 วันอาทิตย์" for the day bar */
const insDM=k=>{if(!k)return '';const d=parseD(k);return `${d.getDate()}-${EN_MON[d.getMonth()]}`};
const insDayBar=k=>{const d=parseD(k);return `Date: ${d.getDate()} ${EN_MON[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`};
const insStats=list=>{const o={n:list.length,plan:0,actual:0,done:0,certs:0};list.forEach(x=>{o.plan+=insNum(x.plan);o.actual+=insNum(x.actual);if(insDone(x))o.done++;o.certs+=x.certs.length});return o};
const insDl=(id,list)=>{if(document.getElementById(id))return;const el=document.createElement('datalist');el.id=id;el.innerHTML=list.map(v=>`<option value="${esc(v)}">`).join('');document.body.appendChild(el)};
insDl('dl-insType',INS_TYPES);insDl('dl-insRemark',INS_REMARKS);insDl('dl-insAct',INS_ACTIVITIES);

/* ---------- board card chip and LINE text ---------- */
function insChip(t){
  const l=insOf(t);if(!l.length)return '';const s=insStats(l);
  return `<span class="pcount ins${s.n&&s.done===s.n?' ok':''}" title="Instrument ${s.n} รายการ · Plan ${s.plan} · Actual ${s.actual}${s.certs?` · Certificate ${s.certs}`:''}">${INS_ICON}${s.actual}/${s.plan}</span>`;
}
function insLines(t){
  const l=insOf(t);if(!l.length)return [];const s=insStats(l);
  return [`🌡️ Instrument : ${s.n} รายการ · Plan ${s.plan} · Actual ${s.actual}${s.certs?` · Certificate ${s.certs}`:''}`]
    .concat(l.map((x,i)=>`${i+1}. ${[insReq(t,x),x.lab,x.plant,x.tag||'(ไม่มี TAG/SN)',x.type,x.range,x.remove?`Remove ${insDM(x.remove)}`:'',x.cal?`Cal ${insDM(x.cal)}`:'',x.install?`Install ${insDM(x.install)}`:'',x.remark].filter(Boolean).join(' · ')}`));
}

/* ---------- plan form: one card per request row, certificates inside ---------- */
let insItems=[];
function insItemHtml(x,i){
  const inp=(f,lbl,ph,cls,type,list)=>`<label class="${cls||''}"><span>${lbl}</span><input data-ins-i="${i}" data-ins-f="${f}" value="${esc(x[f])}"${type?` type="${type}"`:' maxlength="160" autocomplete="off"'}${type==='number'?' min="0" step="1" inputmode="numeric"':''}${ph?` placeholder="${esc(ph)}"`:''}${list?` list="${list}"`:''}></label>`;
  const cert=(c,k)=>`<tr><td class="c-no">${k+1}</td>${['certNo','tagNo','desc','calDate','activity','note'].map(f=>`<td><input data-ins-i="${i}" data-ins-c="${k}" data-ins-cf="${f}" value="${esc(c[f])}"${f==='calDate'?' type="date"':' maxlength="160" autocomplete="off"'}${f==='activity'?' list="dl-insAct"':''}${f==='tagNo'?` placeholder="${esc(x.tag||'')}"`:''} aria-label="${f} ${k+1}"></td>`).join('')}<td><button type="button" class="ph-x2" data-ins-cdel="${i}|${k}" aria-label="ลบ Certificate ${k+1}">×</button></td></tr>`;
  return `<div class="ins-item" style="--i:${i}">
    <div class="ci-head"><span class="ci-no ins">No. ${i+1}</span><span class="ci-sum">${esc([x.tag,x.type,x.plant].filter(Boolean).join(' · ')||'รายการใหม่')}</span>
      <button type="button" class="btn sm ghost" data-ins-dup="${i}" title="เพิ่มรายการถัดไปโดยใช้ค่าเดียวกัน (ยกเว้น TAG/SN, Actual และ Certificate)">คัดลอก</button><button type="button" class="ph-x2" data-ins-del="${i}" aria-label="ลบรายการที่ ${i+1}">×</button></div>
    <div class="ci-grid">
      ${inp('reqNo','Request No.',insReqDefault()||'= Plan No.','mono')}<label class="y0"><span>LAB</span><select data-ins-i="${i}" data-ins-f="lab">${listOpts(INS_LABS,x.lab)}</select></label>
      ${inp('plant','Plant','เช่น HD4')}${inp('tag','TAG / SN.','เช่น ตามเอกสารแนบ','mono')}
      ${inp('type','Type','เช่น PT,TT,TE','', '', 'dl-insType')}${inp('range','Range / Set Point / Nor.Temp (Unit)','เช่น Point Cal ตามเอกสารแนบ','w2')}${inp('bu','BU','-')}
      ${inp('remove','Remove','','y','date')}${inp('cal','Cal','','y','date')}${inp('install','install','','y','date')}${inp('plan','Plan','จำนวน','','number')}
      ${inp('actual','Actual','จำนวน','','number')}${inp('remark','Remark','เช่น Completed','w3','','dl-insRemark')}
    </div>
    <div class="ins-certs"><div class="ic-head"><b>Certificate</b><small>Request_No = ${esc(insReqDefault(x)||'Request No.')} · Client Name = ลูกค้าของแผน</small></div>
      ${x.certs.length?`<div class="ic-scroll"><table class="ic-tbl"><thead><tr><th>Item</th><th>Certificate_No</th><th>Tag_No</th><th>Description</th><th>Cal_Date</th><th>Activity</th><th>Note</th><th></th></tr></thead><tbody>${x.certs.map(cert).join('')}</tbody></table></div>`:''}
      <button type="button" class="btn sm ghost ic-add" data-ins-cadd="${i}"${x.certs.length>=INS_CERT_MAX?' disabled':''}>+ เพิ่ม Certificate</button></div>
  </div>`;
}
/* Request No. left empty = the Plan No. of the form */
function insReqDefault(x){return x&&x.reqNo||cleanPlan(($('#f-planno')||{}).value||'')}
function renderInsForm(){
  const el=$('#insList');if(!el)return;
  el.innerHTML=insItems.map(insItemHtml).join('')||'<p class="hint cal-empty">ยังไม่มีรายการ กด "+ เพิ่มรายการ" เพื่อใส่เครื่องมือ Instrument ของแผนนี้</p>';
  const s=insStats(insItems);$('#insN').textContent=insItems.length?`${s.n} รายการ · Plan ${s.plan} · Actual ${s.actual}${s.certs?` · Certificate ${s.certs}`:''}`:'ไม่บังคับ';
  $('#insAdd').disabled=insItems.length>=INS_MAX;
}
function loadIns(v){insItems=insOf(v);renderInsForm();syncInsRows()}
const insForSave=()=>insItems.map(x=>Object.assign({},x,...INS_FIELDS.map(f=>({[f]:insStr(x[f]).trim()})),
  {certs:x.certs.map(c=>Object.assign({},c,...INS_CERT_FIELDS.map(f=>({[f]:insStr(c[f]).trim()})))).filter(c=>INS_CERT_FIELDS.some(f=>c[f]))}))
  .filter(x=>INS_FIELDS.some(f=>x[f])||x.certs.length);
function syncInsRows(){const on=curLine()==='ins'||insItems.length>0;document.querySelectorAll('#formFields .ins-row').forEach(el=>{el.hidden=!on})}
function addIns(from){
  if(insItems.length>=INS_MAX){toast(`ใส่ได้ไม่เกิน ${INS_MAX} รายการต่อแผน`);return}
  const last=from||insItems[insItems.length-1];
  insItems.push(Object.assign(Object.fromEntries(INS_FIELDS.map(f=>[f,''])),{id:newId('i'),certs:[]},
    last?{reqNo:last.reqNo,lab:last.lab,plant:last.plant,type:last.type,range:last.range,remove:last.remove,cal:last.cal,install:last.install,bu:last.bu,plan:last.plan}:{}));
  renderInsForm();const f=$('#insList .ins-item:last-child [data-ins-f="'+(last?'tag':'plant')+'"]');if(f)f.focus();
}
form.addEventListener('input',e=>{const t=e.target;
  if(t.id==='f-planno'){document.querySelectorAll('#insList [data-ins-f="reqNo"]').forEach(i=>{i.placeholder=insReqDefault()||'= Plan No.'});return}
  if(t.dataset.insCf!=null){const x=insItems[Number(t.dataset.insI)];const c=x&&x.certs[Number(t.dataset.insC)];if(c)c[t.dataset.insCf]=t.value;return}
  if(t.dataset.insF==null)return;const x=insItems[Number(t.dataset.insI)];if(!x)return;x[t.dataset.insF]=t.value;
  const sum=t.closest('.ins-item').querySelector('.ci-sum');if(sum)sum.textContent=[x.tag,x.type,x.plant].filter(Boolean).join(' · ')||'รายการใหม่';
  if(['plan','actual'].includes(t.dataset.insF)){const s=insStats(insItems);$('#insN').textContent=`${s.n} รายการ · Plan ${s.plan} · Actual ${s.actual}${s.certs?` · Certificate ${s.certs}`:''}`}
});
form.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.insF!=null&&t.tagName==='SELECT'){const x=insItems[Number(t.dataset.insI)];if(x)x[t.dataset.insF]=t.value;return}
  if(t.name==='f-line'||t.id==='f-type')syncInsRows();
  if(t.matches('[data-vins]'))saveViewIns(t);
});
form.addEventListener('click',e=>{
  if(e.target.closest('#insAdd')){addIns();return}
  const d=e.target.closest('[data-ins-dup]');if(d){const x=insItems[Number(d.dataset.insDup)];if(x)addIns(x);return}
  const r=e.target.closest('[data-ins-del]');if(r){insItems.splice(Number(r.dataset.insDel),1);renderInsForm();syncInsRows();return}
  const ca=e.target.closest('[data-ins-cadd]');if(ca){const x=insItems[Number(ca.dataset.insCadd)];if(!x)return;
    x.certs.push(Object.assign(Object.fromEntries(INS_CERT_FIELDS.map(f=>[f,''])),{id:newId('k'),tagNo:x.tag,calDate:x.cal,activity:'Calibration'}));renderInsForm();
    const f=$(`#insList .ins-item:nth-child(${Number(ca.dataset.insCadd)+1}) .ic-tbl tbody tr:last-child input`);if(f)f.focus();return}
  const cd=e.target.closest('[data-ins-cdel]');if(cd){const [i,k]=cd.dataset.insCdel.split('|').map(Number);const x=insItems[i];if(x){x.certs.splice(k,1);renderInsForm()}}
});

/* ---------- the sheet: plan card and the week (yellow date bar, green header, light blue certificates) ---------- */
const INS_COLS=[['reqNo','Request No.'],['lab','LAB'],['cust','Customer'],['plant','Plant'],['tag','TAG / SN.'],['type','Type'],['range','Range / Set Point / Nor.Temp (Unit)'],
  ['remove','Remove'],['cal','Cal'],['install','install'],['bu','BU'],['sale','SALE'],['contact','ชื่อลูกค้า'],['plan','Plan'],['actual','Actual'],['remark','Remark']];
const INS_YELLOW=new Set(['remove','cal','install']);
function insTableHtml(rows,opt){
  /* rows: [{t,x,no}] in date order · opt.week: day bars and plan columns · opt.edit: yellow dates, Actual, Remark editable */
  const w=opt&&opt.week,ed=opt&&opt.edit;
  const cols=INS_COLS.filter(([k])=>w||!['cust','sale','contact'].includes(k));
  const head=`<tr class="iw-head">${cols.map(([k,l])=>`<th class="${INS_YELLOW.has(k)?'y':''}">${esc(l)}</th>`).join('')}</tr>`;
  const edit=(r,f,type)=>`<input class="iw-in" data-vins="${esc(r.t.id)}|${esc(r.x.id)}|${f}" value="${esc(r.x[f])}"${type?` type="${type}"`:' maxlength="160"'}${f==='remark'?' list="dl-insRemark"':''}${type==='number'?' min="0" step="1" inputmode="numeric"':''} aria-label="${f} ของ ${esc(r.x.tag||'รายการ '+r.no)}">`;
  const cell=(r,k)=>{const x=r.x,t=r.t;
    if(k==='reqNo')return `<td class="mono" data-l="Request No.">${esc(insReq(t,x)||'–')}</td>`;
    if(k==='cust')return `<td data-l="Customer"><b>${esc(t.customer||'–')}</b></td>`;
    if(k==='sale')return `<td data-l="SALE">${esc(t.sale||'–')}</td>`;
    if(k==='contact')return `<td data-l="ชื่อลูกค้า">${esc(t.contact||'–')}</td>`;
    if(INS_YELLOW.has(k))return `<td class="y c" data-l="${k==='install'?'install':k==='cal'?'Cal':'Remove'}">${ed?`<label class="iw-dt${x[k]?'':' empty'}" title="เลือกวันที่"><span>${esc(insDM(x[k])||'+ วันที่')}</span>${edit(r,k,'date')}</label>`:esc(insDM(x[k])||'–')}</td>`;
    if(k==='actual')return `<td class="c num" data-l="Actual">${ed?edit(r,k,'number'):`<b>${esc(x.actual||'–')}</b>`}</td>`;
    if(k==='plan')return `<td class="c num" data-l="Plan">${esc(x.plan||'–')}</td>`;
    if(k==='remark')return `<td class="rm${insDone(x)?' ok':''}" data-l="Remark">${ed?edit(r,k):esc(x.remark||'')}</td>`;
    return `<td class="${k==='tag'?'mono tag':k==='lab'||k==='bu'?'c':''}" data-l="${esc((INS_COLS.find(c=>c[0]===k)||[])[1]||k)}">${esc(x[k]||(k==='bu'?'-':'–'))}</td>`};
  const certs=r=>r.x.certs.length?`<tr class="iw-cert"><td colspan="${cols.length}"><div class="ic-scroll"><table class="ic-tbl ro"><thead><tr><th>Item</th><th>Certificate_No</th><th>Request_No</th><th>Tag_No</th><th>Description</th><th>Client Name</th><th>Cal_Date</th><th>Activity</th><th>Note</th></tr></thead><tbody>
    ${r.x.certs.map((c,k)=>`<tr><td class="c-no" data-l="Item">${k+1}</td><td class="mono" data-l="Certificate_No">${esc(c.certNo||'–')}</td><td class="mono" data-l="Request_No">${esc(insReq(r.t,r.x)||'–')}</td><td class="mono" data-l="Tag_No">${esc(c.tagNo||r.x.tag||'–')}</td><td data-l="Description">${esc(c.desc||'–')}</td><td data-l="Client Name">${esc(c.client||r.t.customer||'–')}</td><td data-l="Cal_Date">${esc(c.calDate?insDM(c.calDate):'–')}</td><td data-l="Activity">${esc(c.activity||'–')}</td><td data-l="Note">${esc(c.note||'')}</td></tr>`).join('')}</tbody></table></div></td></tr>`:'';
  let body='',day='';
  rows.forEach(r=>{
    if(w&&r.t.date!==day){day=r.t.date;const d=parseD(day);
      body+=`<tr class="iw-date"><td colspan="${cols.length}"><b>${esc(insDayBar(day))}</b><span>วัน${TH_DAY_FULL[d.getDay()]}</span></td></tr>${head}`}
    body+=`<tr class="iw-row"${w?` data-ins-open="${esc(r.t.id)}"`:''}>${cols.map(([k])=>cell(r,k)).join('')}</tr>${certs(r)}`;
  });
  return `<div class="iw-scroll"><table class="iw-tbl${w?' week':''}${ed?' ed':''}">${w?'':`<thead>${head}</thead>`}<tbody>${body}</tbody></table></div>`;
}
function insViewHtml(t,k){
  const l=insOf(t);if(!l.length)return '';const s=insStats(l);
  return `<div class="wide" style="--k:${k}"><dt>Weekly plan instrument · ${s.n} รายการ · Plan ${s.plan} · Actual ${s.actual}${s.certs?` · Certificate ${s.certs}`:''}</dt>
    <dd class="dv-cal">${insTableHtml(l.map((x,i)=>({t,x,no:i+1})),{edit:S.canWrite})}</dd></div>`;
}
/* a yellow date, Actual or Remark changed in the card or the week table: saved at once */
/* the compact date ("5-Oct", as on the sheet) opens the date picker; the native input sits invisible on top */
document.addEventListener('click',e=>{const i=e.target.closest&&e.target.closest('.iw-dt input');if(i&&i.showPicker)try{i.showPicker()}catch(err){}});
async function saveViewIns(inp){
  const dt=inp.closest('.iw-dt');if(dt){dt.querySelector('span').textContent=insDM(inp.value)||'+ วันที่';dt.classList.toggle('empty',!inp.value)}
  const [tid,iid,f]=inp.dataset.vins.split('|');const t=(editing&&editing.id===tid)?editing:findTask(tid);if(!t||!S.canWrite)return;
  const list=insOf(t).map(x=>x.id===iid?Object.assign({},x,{[f]:inp.value.trim()}):x);
  inp.disabled=true;
  try{await Store.update('tasks',tid,Object.assign({insItems:list},meta()));
    if(editing&&editing.id===tid){editing=Object.assign({},editing,{insItems:list});insItems=insOf(editing);renderInsForm()}
    const x=list.find(y=>y.id===iid);toast(`บันทึก ${x&&x.tag?x.tag+' · ':''}${f==='remove'?'Remove':f==='cal'?'Cal':f==='install'?'install':f==='actual'?'Actual':'Remark'} แล้ว`)}
  catch(err){toast(errText(err));noteWriteError(err);render()}
  finally{inp.disabled=false}
}

/* ---------- the week: "Weekly plan instrument" under the board (Instrument tab) ---------- */
function insWeekRows(tasks){
  const rows=[];let no=0;
  tasks.filter(t=>!isLeave(t)&&isWorking(t)).sort(byTime).forEach(t=>insOf(t).forEach(x=>rows.push({t,x,no:++no})));
  return rows;
}
function insWeekHtml(){
  if(S.line!=='ins'&&(S.line||!insWeekRows(S.tasks.filter(planMatch)).length))return '';
  const rows=insWeekRows(S.tasks.filter(planMatch));const s=insStats(rows.map(r=>r.x));
  return `<section class="cal-week ins-week" aria-label="Weekly plan instrument">
    <header class="cw-head"><div class="cw-title ins">${INS_ICON}<div><h2>Weekly plan instrument</h2><p>${esc(fmtShort(S.week))} – ${esc(fmtShort(addDays(S.week,6)))} ${be(addDays(S.week,6))} · รายการเครื่องมือ Instrument ในสัปดาห์นี้${S.canWrite&&rows.length?' · แก้ Remove / Cal / install, Actual และ Remark ในตารางได้ทันที':''}</p></div></div>
      ${rows.length?`<div class="cw-stats"><span><b>${s.n}</b>รายการ</span><span><b>${s.plan}</b>Plan</span><span class="ok"><b>${s.actual}</b>Actual</span><span class="ok"><b>${s.done}</b>Completed</span>${s.certs?`<span><b>${s.certs}</b>Certificate</span>`:''}</div>`:''}</header>
    ${rows.length?insTableHtml(rows,{week:true,edit:S.canWrite}):`<p class="cw-empty">ยังไม่มีรายการ Instrument ในสัปดาห์นี้ · เปิดแผนงาน Instrument แล้วกรอกที่หัวข้อ "Weekly plan instrument"${S.canWrite?' <button type="button" class="lnk" data-action="add" data-line="ins">+ เพิ่มแผนงาน Instrument</button>':''}</p>`}
  </section>`;
}
document.addEventListener('change',e=>{const t=e.target;if(t.matches&&t.matches('#view [data-vins]'))saveViewIns(t)});
document.addEventListener('click',e=>{if(e.target.closest('input,select,button,a'))return;const r=e.target.closest('#view [data-ins-open]');if(r)openTask(r.dataset.insOpen)});

/* ---------- exports: the sheet's columns ---------- */
const INS_HEAD=['Date'].concat(INS_COLS.map(c=>c[1]));
const INS_YELLOW_I=INS_HEAD.map((h,i)=>['Remove','Cal','install'].includes(h)?i:-1).filter(i=>i>=0);
const insRowCells=r=>[insDayBar(r.t.date).replace('Date: ',''),insReq(r.t,r.x),r.x.lab,r.t.customer||'',r.x.plant,r.x.tag,r.x.type,r.x.range,insDM(r.x.remove),insDM(r.x.cal),insDM(r.x.install),r.x.bu||'-',r.t.sale||'',r.t.contact||'',r.x.plan,r.x.actual,r.x.remark];
const INS_CERT_HEAD=['TAG / SN.','Item','Certificate_No','Request_No','Tag_No','Description','Client Name','Cal_Date','Activity','Note'];
const insCertCells=r=>r.x.certs.map((c,k)=>[r.x.tag,k+1,c.certNo,insReq(r.t,r.x),c.tagNo||r.x.tag,c.desc,c.client||r.t.customer||'',c.calDate?insDM(c.calDate):'',c.activity,c.note]);
