'use strict';
/* BU1 Weekly Plan · Service Report: documents that confirm a plan was finished (optional)
   Attached in the plan view once the status is "เสร็จแล้ว" and saved at once (no "บันทึก" needed).
   The bytes go where other attachments go (filechunks/<fileId>_<i>, ≤ 4 MB a file); the plan lists them in
   reports[{id,name,size,type,at,by}] (central DB: data.bu1wp.reports) — apart from files/fileIds, so saving the
   edit form never drops them and a copied plan does not carry them. */
const MAX_REPORTS=5;let repBusy=false;
const reportsOf=t=>Array.isArray(t&&t.reports)?t.reports:[];
const REP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13l2 2 4-4"/></svg>';
function reportRow(f,canDel){
  const ext=fileExt(f.name);const when=f.at?new Date(f.at):null;
  return `<div class="fchip"><span class="fext" data-ext="${esc(ext)}">${esc(ext)}</span><span class="fmeta"><b title="${esc(f.name)}">${esc(f.name)}</b><small>${fmtSize(f.size||0)}${when&&!isNaN(when)?` · แนบเมื่อ ${fmtShort(when)} ${when.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}`:''}</small></span><button type="button" class="btn sm" data-rep-dl="${esc(f.id)}">ดาวน์โหลด</button>${canDel?`<button type="button" class="ph-x2" data-rep-del="${esc(f.id)}" aria-label="ลบ ${esc(f.name)}">×</button>`:''}</div>`;
}
/* read-only list in the plan's details (everyone who can open the plan) */
function reportViewHtml(t,k){
  const l=reportsOf(t);if(!l.length||(S.canWrite&&t.status==='done'))return '';/* editors see it in the box below */
  return `<div class="wide" style="--k:${k}"><dt>Service Report (${l.length})</dt><dd class="dv-files">${l.map(f=>reportRow(f,false)).join('')}</dd></div>`;
}
/* the box under the status buttons: shown for "เสร็จแล้ว" */
function reportBoxHtml(t){
  if(t.status!=='done')return '';const l=reportsOf(t);const full=l.length>=MAX_REPORTS;
  return `<div class="v-report" id="vReport">
    <div class="vr-head">${REP_ICON}<b>Service Report / เอกสารยืนยันงานเสร็จ</b><span class="opt">ไม่บังคับ</span></div>
    ${l.length?`<div class="vr-list">${l.map(f=>reportRow(f,true)).join('')}</div>`:'<p class="hint">แนบใบ Service Report ที่ลูกค้าเซ็น รูปถ่ายใบงาน หรือเอกสารอื่นที่ยืนยันว่างานเสร็จ</p>'}
    ${full?`<p class="hint">แนบครบ ${MAX_REPORTS} ไฟล์แล้ว</p>`:`<label class="btn sm vr-add${repBusy?' busy':''}"><input type="file" id="vRepFile" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx" class="sr-only"${repBusy?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></svg> <span id="vRepLbl">${repBusy?'กำลังอัปโหลด…':'แนบไฟล์'}</span></label><small class="hint">PDF รูป Word หรือ Excel · ไม่เกิน 4 MB ต่อไฟล์ · สูงสุด ${MAX_REPORTS} ไฟล์ · บันทึกทันที</small>`}
  </div>`;
}
function redrawReportView(){renderDrawerView(editing);renderPhotos();renderFiles()}
async function addReports(files){
  if(!editing||!S.canWrite||repBusy)return;
  const cur=reportsOf(editing);const room=MAX_REPORTS-cur.length;
  const all=[...(files||[])].filter(Boolean);if(!all.length)return;
  const ok=all.filter(f=>f.size&&f.size<=MAX_FILE_BYTES).slice(0,Math.max(0,room));
  const big=all.filter(f=>!f.size||f.size>MAX_FILE_BYTES).length;
  if(!ok.length){toast(room<=0?`แนบ Service Report ได้สูงสุด ${MAX_REPORTS} ไฟล์ต่อแผน`:'ไฟล์ใหญ่เกิน 4 MB หรือเป็นไฟล์ว่าง ลดขนาดไฟล์ก่อน');return}
  const id=editing.id;const now=new Date().toISOString();const added=[];
  repBusy=true;redrawReportView();
  try{
    for(const [k,file] of ok.entries()){
      const f={id:newId('f'),name:String(file.name||'service-report').slice(0,120),size:file.size,type:file.type||'',blob:file};
      await putFileChunks(f,(x,i,n)=>{const l=$('#vRepLbl');if(l)l.textContent=`กำลังอัปโหลด ${ok.length>1?`ไฟล์ ${k+1}/${ok.length} · `:''}${Math.round((i+1)/n*100)}%`});
      added.push({id:f.id,name:f.name,size:f.size,type:f.type,at:now,by:S.me||null});
    }
    const reports=reportsOf(editing).concat(added);
    await Store.update('tasks',id,Object.assign({reports},meta()));
    if(editing&&editing.id===id)editing=Object.assign({},editing,{reports});
    toast(`แนบ Service Report ${added.length} ไฟล์แล้ว${big?` · ข้าม ${big} ไฟล์ที่ใหญ่เกิน 4 MB`:''}${all.length-big>ok.length?` · แนบได้สูงสุด ${MAX_REPORTS} ไฟล์`:''}`);
  }catch(err){toast(errText(err));noteWriteError(err);if(added.length)cleanupFiles(added.map(f=>f.id))}/* nothing half-saved stays behind */
  finally{repBusy=false;if(editing&&editing.id===id&&dMode==='view')redrawReportView()}
}
async function removeReport(fid){
  if(!editing||!S.canWrite)return;const f=reportsOf(editing).find(x=>x.id===fid);if(!f)return;
  if(!await askConfirm('ลบ Service Report?',`ลบไฟล์ ${f.name} ออกจากแผนนี้\nลบแล้วกู้คืนไม่ได้`,'ลบไฟล์'))return;
  const id=editing.id;const reports=reportsOf(editing).filter(x=>x.id!==fid);
  try{await Store.update('tasks',id,Object.assign({reports},meta()));
    if(editing&&editing.id===id){editing=Object.assign({},editing,{reports});redrawReportView()}
    cleanupFiles([fid]);toast(`ลบ ${f.name} แล้ว`)}
  catch(err){toast(errText(err));noteWriteError(err)}
}
dlg.addEventListener('change',e=>{if(e.target.id==='vRepFile'){addReports(e.target.files);e.target.value=''}});
dlg.addEventListener('click',e=>{
  const d=e.target.closest('[data-rep-dl]');if(d){const f=reportsOf(editing).find(x=>x.id===d.dataset.repDl);downloadFile(d.dataset.repDl,d,f);return}
  const r=e.target.closest('[data-rep-del]');if(r)removeReport(r.dataset.repDel);
});
