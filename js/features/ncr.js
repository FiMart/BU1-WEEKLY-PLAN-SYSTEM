'use strict';
/* BU1 Weekly Plan · NCR (Non-Conformance Report): opened when a plan ends "ไม่เสร็จ", followed until it is closed
   collection "ncr": {ncrNo (NCR-YY-MMNNN), taskId, planNo, date, jobTypeName, customer, location, staffIds,
     category, issue, cause, correction, action, owner, due, state (open | progress | closed), result,
     createdAt/By, updatedAt/By, closedAt/By}. A plan with an NCR keeps its id in task.ncrId. */
const NCR_CATS=['เครื่องมือ / อุปกรณ์','อะไหล่ / วัสดุ','หน้างานลูกค้าไม่พร้อม','เอกสาร / ใบอนุญาต (Work Permit)','บุคลากร / ทักษะ','วิธีการทำงาน / ขั้นตอน','สภาพอากาศ / เหตุภายนอก','อื่นๆ'];
const NCR_STATES=[{id:'open',th:'เปิด',color:'var(--crit)'},{id:'progress',th:'กำลังแก้ไข',color:'var(--warn)'},{id:'closed',th:'ปิดแล้ว',color:'var(--good)'}];
const NCR_STATE=Object.fromEntries(NCR_STATES.map(s=>[s.id,s]));
S.ncr=[];S.ncrF={state:'',q:''};
const ncrOfTask=t=>t&&(S.ncr.find(n=>n.id===t.ncrId)||S.ncr.find(n=>n.taskId===t.id))||null;
const ncrOverdue=n=>n.state!=='closed'&&!!n.due&&n.due<ymd(new Date());
const ncrStateOf=n=>NCR_STATE[n.state]||NCR_STATE.open;
function nextNcrNo(date){
  const d=parseD(date||ymd(new Date()));const pre=`NCR-${String(d.getFullYear()).slice(-2)}-${pad(d.getMonth()+1)}`;
  const max=S.ncr.map(n=>String(n.ncrNo||'')).filter(x=>x.startsWith(pre)).map(x=>Number(x.slice(pre.length))||0).reduce((a,b)=>Math.max(a,b),0);
  return pre+String(max+1).padStart(3,'0');
}
/* link shown in a plan's drawer */
function ncrLinkHtml(t){
  const n=ncrOfTask(t);
  if(!n)return can('status')?`<div class="ncr-link warn"><b>⚠ งานไม่เสร็จ · ยังไม่มี NCR</b><span>บันทึก NCR เพื่อติดตามการแก้ไข</span><button type="button" class="btn sm" data-ncr-new="${esc(t.id)}">เปิด NCR</button></div>`:'';
  const st=ncrStateOf(n);
  return `<div class="ncr-link" style="--c:${st.color}"><b>${esc(n.ncrNo)} · ${esc(st.th)}${ncrOverdue(n)?' · เกินกำหนด':''}</b><span>${esc(n.category||'')}${n.owner?` · ผู้รับผิดชอบ ${esc(n.owner)}`:''}${n.due?` · กำหนด ${esc(thDate(n.due))}`:''}</span><button type="button" class="btn sm" data-ncr-open="${esc(n.id)}">เปิด NCR</button></div>`;
}

/* ---------- NCR form (dialog) ---------- */
let ncrEdit=null;
function openNcr(id,task){
  const n=id?S.ncr.find(x=>x.id===id):null;
  const t=task||(n&&n.taskId?findTask(n.taskId):null);
  const v=n||{ncrNo:'',taskId:t?t.id:'',planNo:t?t.planNo||'':'',date:t?t.date:ymd(new Date()),jobTypeName:t?typeLabel(t):'',customer:t?t.customer||'':'',location:t?t.location||'':'',staffIds:t?(t.staffIds||[]).slice():[],
    category:'',issue:t&&NEEDS_REASON.has(t.status)?t.statusNote||'':'',cause:'',correction:'',action:'',owner:'',due:'',state:'open',result:''};
  ncrEdit={id:n?n.id:null,task:t,saved:false};
  const w=can('status');const dis=w?'':' disabled';
  const st=ncrStateOf(v);
  $('#ncrTitle').textContent=n?`${n.ncrNo}`:'เปิด NCR ใหม่';
  $('#ncrSub').textContent=n?`${st.th}${ncrOverdue(n)?' · เกินกำหนด':''} · รายงานงานที่ไม่สำเร็จ (Non-Conformance Report)`:'รายงานงานที่ไม่สำเร็จ (Non-Conformance Report) · เลขที่ NCR จะออกให้อัตโนมัติเมื่อบันทึก';
  const team=(v.staffIds||[]).map(staffName).join(', ');
  const ta=(name,label,ph,req)=>`<div class="field wide"><label for="ncr-${name}">${label}${req?' <b class="req">*</b>':''}</label><textarea id="ncr-${name}" name="${name}" rows="3" maxlength="1500" placeholder="${esc(ph)}"${dis}>${esc(v[name]||'')}</textarea></div>`;
  $('#ncrBody').innerHTML=`
    ${t?`<div class="ncr-plan"><b>${esc(v.jobTypeName||typeLabel(t))}${v.planNo?` · <span class="mono">${esc(v.planNo)}</span>`:''}</b><span>${esc(fmtDayY(t.date))} · ${esc(pName(t))}${t.customer?` · ${esc(t.customer)}`:''}${t.location?` · ${esc(t.location)}`:''}</span>${team?`<span>ทีม: ${esc(team)}</span>`:''}${!n?'<em>บันทึก NCR แล้ว สถานะงานจะเปลี่ยนเป็น "ไม่เสร็จ"</em>':''}</div>`:''}
    <div class="ncr-grid">
      <div class="field"><label for="ncr-date">วันที่พบปัญหา</label><input type="date" id="ncr-date" name="date" value="${esc(v.date||'')}" required${dis}></div>
      <div class="field"><label for="ncr-category">หมวดปัญหา</label><select id="ncr-category" name="category"${dis}><option value="">— เลือกหมวด —</option>${NCR_CATS.concat(v.category&&!NCR_CATS.includes(v.category)?[v.category]:[]).map(c=>`<option${c===v.category?' selected':''}>${esc(c)}</option>`).join('')}</select></div>
      ${t?'':`<div class="field"><label for="ncr-planNo">Plan No.</label><input id="ncr-planNo" name="planNo" maxlength="40" value="${esc(v.planNo||'')}" placeholder="PN-YY-MMNNN"${dis}></div>
      <div class="field"><label for="ncr-customer">ลูกค้า</label><input id="ncr-customer" name="customer" maxlength="120" value="${esc(v.customer||'')}"${dis}></div>
      <div class="field wide"><label for="ncr-location">สถานที่</label><input id="ncr-location" name="location" maxlength="120" value="${esc(v.location||'')}"${dis}></div>`}
      ${ta('issue','รายละเอียดปัญหา / สิ่งที่ไม่เป็นไปตามแผน','เช่น สอบเทียบไม่ผ่าน 2 จุด เพราะ Standard ไม่พร้อม · ลูกค้าไม่ปิดไลน์ ทำงานได้แค่ครึ่งเดียว',true)}
      ${ta('cause','สาเหตุ (Root cause)','เช่น ไม่ได้ตรวจสอบเครื่องมือก่อนออกงาน')}
      ${ta('correction','การแก้ไขเฉพาะหน้า (Correction)','เช่น นัดลูกค้าเข้าทำต่อวันที่ … · ยืมเครื่องมือสำรอง')}
      ${ta('action','การแก้ไขและป้องกันไม่ให้เกิดซ้ำ (Corrective / Preventive action)','เช่น เพิ่ม Checklist ตรวจเครื่องมือก่อนออกงาน')}
      <div class="field"><label for="ncr-owner">ผู้รับผิดชอบ</label><input id="ncr-owner" name="owner" list="dl-ncr-owner" maxlength="80" value="${esc(v.owner||'')}" placeholder="ชื่อผู้รับผิดชอบการแก้ไข"${dis}><datalist id="dl-ncr-owner">${S.staff.filter(s=>s.active!==false).sort(sortPeople).map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist></div>
      <div class="field"><label for="ncr-due">กำหนดแก้ไขเสร็จ</label><input type="date" id="ncr-due" name="due" value="${esc(v.due||'')}"${dis}></div>
      <div class="field wide"><span class="lbl">สถานะ NCR</span><div class="seg ncr-state" role="radiogroup" aria-label="สถานะ NCR">${NCR_STATES.map(s=>`<label><input type="radio" name="state" value="${s.id}"${v.state===s.id||(!v.state&&s.id==='open')?' checked':''}${dis}><span>${esc(s.th)}</span></label>`).join('')}</div></div>
      ${ta('result','ผลการตรวจติดตาม / การปิด NCR','เช่น ทำงานต่อเสร็จวันที่ … ลูกค้ารับงานแล้ว · ปรับ Checklist แล้ว')}
    </div>
    ${n?`<p class="hint ncr-meta">เปิดเมื่อ ${esc(n.createdAt?thDate(ymd(new Date(n.createdAt))):'—')}${n.closedAt?` · ปิดเมื่อ ${esc(thDate(ymd(new Date(n.closedAt))))}`:''}</p>${isoHistoryHtml(n)}`:''}
    <p class="form-err" id="ncrErr" hidden></p>`;
  $('#ncrSave').hidden=!w;$('#ncrDel').hidden=!n||!can('del');$('#ncrPrint').hidden=!n||!downloads;
  const d=$('#ncrDlg');if(!d.open)d.showModal();
  setTimeout(()=>{const f=$('#ncr-issue');if(f&&w&&!n)f.focus()},40);
}
function ncrErr(m){const e=$('#ncrErr');e.textContent=m||'';e.hidden=!m}
async function saveNcr(){
  if(!can('status')||!ncrEdit)return;
  const fd=new FormData($('#ncrForm'));const g=k=>String(fd.get(k)||'').trim();
  if(!g('issue')){ncrErr('ใส่รายละเอียดปัญหา');$('#ncr-issue').focus();return}
  if(!g('date')){ncrErr('เลือกวันที่พบปัญหา');return}
  const state=g('state')||'open';if(state==='closed'&&!g('result')){ncrErr('ก่อนปิด NCR ใส่ผลการตรวจติดตาม / การปิด NCR');$('#ncr-result').focus();return}
  const id=ncrEdit.id||newId('ncr');const old=S.ncr.find(x=>x.id===id)||{};const t=ncrEdit.task;const now=new Date().toISOString();
  const data=Object.assign({},old,{
    date:g('date'),category:g('category'),issue:g('issue'),cause:g('cause'),correction:g('correction'),action:g('action'),owner:g('owner'),due:g('due'),state,result:g('result'),
    taskId:t?t.id:(old.taskId||''),planNo:t?(t.planNo||''):(fd.has('planNo')?g('planNo'):old.planNo||''),jobTypeName:t?typeLabel(t):(old.jobTypeName||''),
    customer:t?(t.customer||''):(fd.has('customer')?g('customer'):old.customer||''),location:t?(t.location||''):(fd.has('location')?g('location'):old.location||''),staffIds:t?(t.staffIds||[]).slice():(old.staffIds||[]),
    ncrNo:old.ncrNo||nextNcrNo(g('date')),updatedAt:now,updatedBy:S.me||null});
  if(!old.createdAt){data.createdAt=now;data.createdBy=S.me||null}
  if(state==='closed'&&old.state!=='closed'){data.closedAt=now;data.closedBy=S.me||null}
  if(state!=='closed'){data.closedAt='';data.closedBy=''}
  delete data.id;
  const btn=$('#ncrSave');btn.disabled=true;
  try{
    await Store.set('ncr',id,data);
    if(t&&(t.status!=='notdone'||t.ncrId!==id||t.statusNote!==data.issue)){
      await Store.update('tasks',t.id,Object.assign({status:'notdone',statusNote:data.issue,ncrId:id},meta()));
      if(editing&&editing.id===t.id){editing=Object.assign({},editing,{status:'notdone',statusNote:data.issue,ncrId:id});const r=$('#f-st-notdone');if(r)r.checked=true;$('#f-reason').value=data.issue;syncReason()}
    }
    ncrEdit.saved=true;$('#ncrDlg').close();
    toast(`${old.ncrNo?'บันทึก':'เปิด'} ${data.ncrNo} แล้ว${state==='closed'&&old.state!=='closed'?' · ปิด NCR':''}`);
  }catch(err){ncrErr(errText(err));noteWriteError(err)}
  finally{btn.disabled=false}
}
async function deleteNcr(btn){
  if(!can('del')||!ncrEdit||!ncrEdit.id)return;const n=S.ncr.find(x=>x.id===ncrEdit.id);if(!n)return;
  if(!arm(btn,'ncr:'+n.id,'ลบ NCR','กดอีกครั้งเพื่อลบ NCR'))return;
  try{await Store.del('ncr',n.id);const t=n.taskId?findTask(n.taskId):null;if(t&&t.ncrId===n.id)await Store.update('tasks',t.id,Object.assign({ncrId:''},meta()));ncrEdit.saved=true;$('#ncrDlg').close();toast(`ลบ ${n.ncrNo} แล้ว`)}
  catch(err){ncrErr(errText(err));noteWriteError(err)}
}
/* redraw the open plan: shows the new NCR box after saving, or puts the status back after closing without saving */
document.addEventListener('close',e=>{if(e.target&&e.target.id==='ncrDlg'){if(ncrEdit&&editing&&dlg.open)renderDrawerView(editing);if(editing&&dlg.open){renderPhotos();renderFiles()}render()}},true);

/* ---------- NCR page ---------- */
function ncrRow(n){const st=ncrStateOf(n);const od=ncrOverdue(n);
  return `<tr data-ncr-open="${esc(n.id)}"><td class="mono">${esc(n.ncrNo||'—')}</td><td class="num">${esc(n.date?fmtDay(n.date):'—')}</td>
    <td>${esc(n.jobTypeName||'—')}${n.planNo?`<span class="sub mono">${esc(n.planNo)}</span>`:''}</td><td>${esc(n.customer||'—')}${n.location?`<span class="sub">${esc(n.location)}</span>`:''}</td>
    <td class="why">${esc(n.issue||'')}${n.category?`<span class="sub">${esc(n.category)}</span>`:''}</td><td>${esc(n.owner||'—')}</td>
    <td class="num${od?' bad':''}">${n.due?esc(thDate(n.due))+(od?' ⚠':''):'—'}</td><td><span class="ncr-st" style="--c:${st.color}">${esc(st.th)}</span></td></tr>`}
function ncrFiltered(){
  const q=norm(S.ncrF.q);const f=S.ncrF.state;
  return S.ncr.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.ncrNo||'').localeCompare(String(a.ncrNo||'')))
    .filter(n=>(!f||(f==='overdue'?ncrOverdue(n):n.state===f))&&(!q||norm([n.ncrNo,n.planNo,n.jobTypeName,n.customer,n.location,n.issue,n.cause,n.owner,n.category].join(' ')).includes(q)));
}
function fillNcrTable(){
  const list=ncrFiltered();const tb=$('#ncrRows');if(!tb)return;
  tb.innerHTML=list.map(ncrRow).join('')||`<tr><td colspan="8" class="hint">${S.ncr.length?'ไม่พบ NCR ที่ตรงกับตัวกรอง':'ยังไม่มี NCR · เมื่อตั้งสถานะแผนงานเป็น "ไม่เสร็จ" ระบบจะให้บันทึก NCR'}</td></tr>`;
  const c=$('#ncrCount');if(c)c.textContent=`${list.length} รายการ`;
}
function renderNcr(){
  if(notReady()||(S.mode==='live'&&!S.ncrReady))return loading();
  const all=S.ncr;const cnt=s=>all.filter(n=>n.state===s).length;const od=all.filter(ncrOverdue).length;
  const tile=(id,lbl,n,cls)=>`<button type="button" class="tile ncr-tile${cls?' '+cls:''}" data-ncr-filter="${id}" aria-pressed="${S.ncrF.state===id}"><span class="lbl">${lbl}</span><span class="val">${n}<small>รายการ</small></span></button>`;
  const cats=NCR_CATS.map(c=>({label:c,n:all.filter(x=>x.category===c).length})).filter(x=>x.n);const noCat=all.filter(x=>!x.category).length;if(noCat)cats.push({label:'ยังไม่ระบุหมวด',n:noCat});
  return `<div class="sum">
    <div class="tiles">${tile('','ทั้งหมด',all.length)}${tile('open','เปิด',cnt('open'),cnt('open')?'alert':'')}${tile('progress','กำลังแก้ไข',cnt('progress'),cnt('progress')?'warnt':'')}${tile('closed','ปิดแล้ว',cnt('closed'))}${tile('overdue','เกินกำหนด',od,od?'alert':'')}</div>
    <section class="panel span-8"><header><h2>รายการ NCR <span class="md-count" id="ncrCount"></span></h2><p>งานที่ไม่สำเร็จ บันทึกปัญหา สาเหตุ การแก้ไข และติดตามจนปิด NCR · กดที่แถวเพื่อเปิด</p></header>
      <div class="ncr-tools"><input type="search" id="ncr-q" placeholder="ค้นหา NCR No. Plan No. ลูกค้า ปัญหา ผู้รับผิดชอบ" value="${esc(S.ncrF.q)}" autocomplete="off" aria-label="ค้นหา NCR">${can('status')?'<button type="button" class="btn primary" data-ncr-new="">+ เปิด NCR</button>':''}</div>
      <div class="scroll-x plain"><table class="mini ftab ncr-tab"><thead><tr><th>NCR No.</th><th>วันที่</th><th>งาน</th><th>ลูกค้า</th><th>ปัญหา</th><th>ผู้รับผิดชอบ</th><th>กำหนดเสร็จ</th><th>สถานะ</th></tr></thead><tbody id="ncrRows"></tbody></table></div></section>
    <section class="panel span-4"><header><h2>ปัญหาตามหมวด</h2><p>NCR ทั้งหมด ${all.length} รายการ แยกตามหมวดปัญหา ใช้หาจุดที่ควรปรับปรุง</p></header>${hbars(cats,'รายการ')}</section>
  </div>`;
}

/* ---------- print one NCR (A4 form with signatures) ---------- */
async function ncrPrint(){
  const n=ncrEdit&&ncrEdit.id&&S.ncr.find(x=>x.id===ncrEdit.id);if(!n)return;const st=ncrStateOf(n);const now=new Date();
  const r=(k,v)=>`<tr><th>${k}</th><td>${esc(v||'—')}</td></tr>`;
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(n.ncrNo)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&family=IBM+Plex+Mono:wght@600&display=swap">
<style>@page{size:A4 portrait;margin:14mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:11px/1.55 "IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif;color:#0b1b33;margin:16px;max-width:182mm}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:12px;padding:10px 12px;background:#eef3fa;border-radius:8px;font-size:13px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2.5px solid #b42323;padding-bottom:8px;margin-bottom:12px}.hd .org{margin:0;color:#1462d0;font-weight:600;font-size:10px;letter-spacing:.06em;text-transform:uppercase}.hd h1{font-size:18px;margin:2px 0 0}.hd p{margin:0;text-align:right;color:#34496b}
.no{font:600 16px/1.2 "IBM Plex Mono",monospace;color:#b42323}.st{display:inline-block;margin-top:4px;padding:1px 10px;border-radius:999px;border:1px solid #c6d9f1;font-weight:600}
table{border-collapse:collapse;width:100%;margin-bottom:10px}th,td{border:1px solid #c6d9f1;padding:6px 8px;text-align:left;vertical-align:top}th{width:38mm;background:#f3f7fd;font-weight:600}td{white-space:pre-line;overflow-wrap:anywhere}
h2{font-size:12.5px;margin:12px 0 6px}.sig{display:flex;gap:24px;margin-top:40px}.sig div{flex:1;text-align:center}.sig span{display:block;border-top:1px solid #0b1b33;margin:36px 8px 4px}
@media print{.bar{display:none}body{margin:0;max-width:none}}${isoPageCss('ncr')}</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>A4 แนวตั้ง</span></div>
<div class="hd"><div style="display:flex;gap:10px;align-items:center">${LOGO_MARK}<div><p class="org">${esc(DASH_ORG)}</p><h1>รายงานงานที่ไม่สำเร็จ (NCR)</h1></div></div><p><span class="no">${esc(n.ncrNo)}</span><br><span class="st">${esc(st.th)}</span><br>พิมพ์เมื่อ ${esc(thDate(ymd(now)))}</p></div>${isoHeadHtml('ncr')}
<h2>ข้อมูลงาน</h2><table>${r('วันที่พบปัญหา',n.date?fmtDayY(n.date):'')}${r('หัวข้องาน',n.jobTypeName)}${r('Plan No.',n.planNo)}${r('ลูกค้า',n.customer)}${r('สถานที่',n.location)}${r('ทีมผู้ปฏิบัติงาน',(n.staffIds||[]).map(staffName).join(', '))}</table>
<h2>ปัญหาและการแก้ไข</h2><table>${r('หมวดปัญหา',n.category)}${r('รายละเอียดปัญหา',n.issue)}${r('สาเหตุ (Root cause)',n.cause)}${r('การแก้ไขเฉพาะหน้า',n.correction)}${r('การแก้ไขและป้องกันการเกิดซ้ำ',n.action)}${r('ผู้รับผิดชอบ',n.owner)}${r('กำหนดแก้ไขเสร็จ',n.due?thDate(n.due):'')}</table>
<h2>การตรวจติดตาม / ปิด NCR</h2><table>${r('ผลการตรวจติดตาม',n.result)}${r('สถานะ',st.th+(n.closedAt?' · ปิดเมื่อ '+thDate(ymd(new Date(n.closedAt))):''))}</table>
<div class="sig"><div><span></span>ผู้รายงาน</div><div><span></span>หัวหน้างาน / ผู้ตรวจสอบ</div><div><span></span>ผู้อนุมัติปิด NCR</div></div></body></html>`;
  await saveFile(`${n.ncrNo}.html`,html,'ดาวน์โหลดใบ NCR แล้ว เปิดไฟล์แล้วกด "พิมพ์ / บันทึกเป็น PDF"');
}

document.addEventListener('click',e=>{
  const nw=e.target.closest('[data-ncr-new]');if(nw){const t=nw.dataset.ncrNew?findTask(nw.dataset.ncrNew):null;openNcr(null,t);return}
  const op=e.target.closest('[data-ncr-open]');if(op){openNcr(op.dataset.ncrOpen);return}
  const fl=e.target.closest('[data-ncr-filter]');if(fl){S.ncrF.state=S.ncrF.state===fl.dataset.ncrFilter?'':fl.dataset.ncrFilter;render();return}
  if(e.target.closest('#ncrSave')){saveNcr();return}
  if(e.target.closest('#ncrPrint')){ncrPrint();return}
  const dl=e.target.closest('#ncrDel');if(dl){deleteNcr(dl);return}
  if(e.target.closest('[data-ncr-close]'))$('#ncrDlg').close();
});
document.addEventListener('input',e=>{if(e.target.id==='ncr-q'){S.ncrF.q=e.target.value;fillNcrTable()}});
document.addEventListener('submit',e=>{if(e.target.id==='ncrForm'){e.preventDefault();saveNcr()}});
