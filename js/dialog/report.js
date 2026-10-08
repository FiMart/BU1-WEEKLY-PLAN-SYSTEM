'use strict';
/* BU1 Weekly Plan · เอกสารหลังจบงาน (user, 7 Oct 2026)
   Documents every finished work plan should carry: Service Report · QC (check sheet, e.g. Remove-Reinstall Transmitter
   Check Sheet) · ใบรับงาน (the service request form from Sale). Each document has its own row and upload button
   (user, 8 Oct 2026: "อัปโหลดเฉพาะได้เลย"); a file keeps its own name and is labelled with the row's document. Older files
   whose label names several documents ("Service Report, QC") show under each. A fourth row "เอกสารอื่น ๆ" takes any other
   file (label '', optional and editable there; not counted). A document counts when a file's label names it.
   Allowed in any status (ใบรับงาน usually comes first); counted as missing once the plan is "เสร็จแล้ว". A document that
   does not apply can be marked "ไม่มีสำหรับงานนี้" (docNA). Saved at once (no "บันทึก" needed).
   The bytes go where other attachments go (filechunks/<fileId>_<i>, ≤ 4 MB a file); the plan lists them in
   reports[{id,name,size,type,at,by,label}] (central DB: data.bu1wp.reports; older entries: kind 'sr'|'qc'|'job', or
   nothing = Service Report) and docNA ['qc', …] (data.bu1wp.docNA) — apart from files/fileIds, so saving the edit form
   never drops them and a copied plan does not carry them. */
const DOC_KINDS=[
  {id:'sr',name:'Service Report',sub:'ใบรายงานบริการที่ลูกค้าเซ็น',re:/^(sr|s\/r|service\s*report|รายงานบริการ)$/i},
  {id:'qc',name:'QC',sub:'Check Sheet ตรวจสอบงาน',re:/^(qc|q\/c|check\s*sheet|checksheet|ใบตรวจสอบ|ใบ\s*qc)$/i},
  {id:'job',name:'ใบรับงาน',sub:'ใบรับคำร้องขอรับบริการ ที่ได้จาก Sale',re:/^(ใบรับงาน|ใบรับคำร้อง.*|job\s*order|request\s*form)$/i}];
const DOC_NAME=Object.fromEntries(DOC_KINDS.map(k=>[k.id,k.name]));
const MAX_REPORTS=15;let repBusy=false;
const reportsOf=t=>Array.isArray(t&&t.reports)?t.reports:[];
/* a file's label: its own, else the old fixed kind, else (oldest files) Service Report */
const docLabel=f=>f&&f.label!=null?String(f.label):f&&DOC_NAME[f.kind]?DOC_NAME[f.kind]:'Service Report';
const docParts=l=>String(l||'').split(/\s*(?:,|\+|\/(?!r|c)|·|และ)\s*/i).map(x=>x.trim()).filter(Boolean);
const docOfKind=(f,k)=>{const kd=DOC_KINDS.find(x=>x.id===k);return !!kd&&docParts(docLabel(f)).some(p=>kd.re.test(p))};
const docNAOf=t=>Array.isArray(t&&t.docNA)?t.docNA.filter(k=>DOC_NAME[k]):[];
const docsOf=(t,k)=>reportsOf(t).filter(f=>docOfKind(f,k));
const docCanon=l=>docParts(l).map(p=>{const k=DOC_KINDS.find(x=>x.re.test(p));return k?k.name:p}).join(', ');
/* the documents a plan still owes: only work plans that are "เสร็จแล้ว" */
const docNeeded=t=>!!t&&!isLeave(t)&&t.status==='done';
const docMissing=t=>docNeeded(t)?DOC_KINDS.filter(k=>!docNAOf(t).includes(k.id)&&!docsOf(t,k.id).length).map(k=>k.id):[];
function docState(t){const na=docNAOf(t);const need=DOC_KINDS.filter(k=>!na.includes(k.id));return {need:need.length,have:need.filter(k=>docsOf(t,k.id).length).length,na}}
const REP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13l2 2 4-4"/></svg>';
/* the card's chip: "2/3" once the job is done (red while missing), a plain file count before */
function docChip(t){
  if(!t||isLeave(t))return '';const s=docState(t);const n=reportsOf(t).length;
  if(docNeeded(t)){const ok=s.have>=s.need;const miss=docMissing(t).map(k=>DOC_NAME[k]);
    return `<span class="pcount sr${ok?'':' miss'}" title="${ok?'เอกสารหลังจบงานครบ':'ยังไม่ได้ส่ง: '+esc(miss.join(', '))}">${REP_ICON}${s.have}/${s.need}</span>`}
  return n?`<span class="pcount sr" title="แนบเอกสารแล้ว ${n} ไฟล์">${REP_ICON}${n}</span>`:'';
}
/* one file; under a document row (kind) its label shows only when the file covers more than that document;
   เอกสารอื่น ๆ (files naming no document) keep an optional editable label (typing a document's name moves the file there) */
function reportRow(f,edit,kind){
  const ext=fileExt(f.name);const when=f.at?new Date(f.at):null;const l=docLabel(f);
  const also=kind&&l&&l!==DOC_NAME[kind]?` · ไฟล์นี้มี ${esc(l)}`:'';
  const tag=kind?'':edit?`<input class="doc-lbl" list="dl-docKinds" data-rep-lbl="${esc(f.id)}" value="${esc(l)}" maxlength="80" placeholder="ชื่อเอกสาร (ไม่บังคับ)" aria-label="ชื่อเอกสารของ ${esc(f.name)}" autocomplete="off">`:l?`<span class="doc-tag">${esc(l)}</span>`:'';
  return `<div class="fchip doc-file"><span class="fext" data-ext="${esc(ext)}">${esc(ext)}</span><span class="fmeta"><b title="${esc(f.name)}">${esc(f.name)}</b><small>${fmtSize(f.size||0)}${when&&!isNaN(when)?` · แนบเมื่อ ${fmtShort(when)} ${when.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}`:''}${also}</small></span>
    ${tag}<button type="button" class="btn sm" data-rep-dl="${esc(f.id)}">ดาวน์โหลด</button>${edit?`<button type="button" class="ph-x2" data-rep-del="${esc(f.id)}" aria-label="ลบ ${esc(f.name)}">×</button>`:''}</div>`;
}
const UP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>';
const OTHER_DOC='other';/* upload row for any other document (user, 8 Oct 2026): label '', not counted in the 3 */
const upBtn=(kind,name,n)=>{const busy=repBusy===kind;
  return `<label class="btn sm vr-add${busy?' busy':''}"><input type="file" data-rep-kind="${kind}" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx" class="sr-only"${repBusy?' disabled':''} aria-label="อัปโหลด ${esc(name)}">${UP_ICON}<span id="vRepLbl-${kind}">${busy?'กำลังอัปโหลด…':n?'เพิ่มไฟล์':'อัปโหลด'}</span></label>`};
/* เอกสารหลังจบงาน (user, 8 Oct 2026): one row per document, each with its own upload button and its own files,
   then "เอกสารอื่น ๆ" for any other file */
function docBox(t,edit){
  const s=docState(t);const done=docNeeded(t);const ok=s.have>=s.need;const na=docNAOf(t);const full=reportsOf(t).length>=MAX_REPORTS;
  const rows=DOC_KINDS.map(k=>{const fs=docsOf(t,k.id);const n=fs.length;const st=n?'ok':na.includes(k.id)?'na':done?'miss':'wait';
    const up=edit&&st!=='na'&&!full?upBtn(k.id,k.name,n):'';
    return `<div class="doc-row ${st}">
      <div class="doc-rh"><i class="doc-ic">${st==='ok'?'✓':st==='na'?'–':st==='miss'?'✗':'○'}</i><span class="doc-nm"><b>${esc(k.name)}</b><small>${st==='na'?'ไม่มีสำหรับงานนี้':esc(k.sub)}</small></span>
        <span class="doc-act">${up}${edit&&!n?`<button type="button" class="lnk" data-rep-na="${k.id}">${st==='na'?'ต้องส่ง':'ไม่มี'}</button>`:''}</span></div>
      ${n?`<div class="vr-list">${fs.map(f=>reportRow(f,edit,k.id)).join('')}</div>`:''}</div>`}).join('');
  const other=reportsOf(t).filter(f=>!DOC_KINDS.some(k=>docOfKind(f,k.id)));
  return `<div class="v-report${done&&!ok?' miss':''}" id="vReport">
    <div class="vr-head">${REP_ICON}<b>เอกสารหลังจบงาน</b><span class="opt${done?ok?' ok':' bad':''}">ส่งแล้ว ${s.have}/${s.need}</span>${done?'':'<span class="hint">แนบล่วงหน้าได้ · ต้องครบเมื่องานเสร็จ</span>'}</div>
    <div class="doc-rows">${rows}
      ${edit||other.length?`<div class="doc-row other">
        <div class="doc-rh"><i class="doc-ic">+</i><span class="doc-nm"><b>เอกสารอื่น ๆ</b><small>ไม่บังคับ · ไฟล์อื่นที่เกี่ยวกับงาน เช่น รูปหน้างาน ใบส่งของ ผลทดสอบ</small></span>
          <span class="doc-act">${edit&&!full?upBtn(OTHER_DOC,'เอกสารอื่น ๆ',other.length):''}</span></div>
        ${other.length?`<div class="vr-list">${other.map(f=>reportRow(f,edit,null)).join('')}</div>`:''}</div>`:''}</div>
    ${edit?`<small class="hint">${full?`แนบครบ ${MAX_REPORTS} ไฟล์แล้ว · `:''}PDF รูป Word หรือ Excel · ไม่เกิน 4 MB ต่อไฟล์ · สูงสุด ${MAX_REPORTS} ไฟล์ต่อแผน · บันทึกทันที</small>`:''}
    ${edit&&other.length?`<datalist id="dl-docKinds">${DOC_KINDS.map(k=>`<option value="${esc(k.name)}">${esc(k.sub)}</option>`).join('')}<option value="Service Report, QC">Service Report และ QC ในไฟล์เดียว</option></datalist>`:''}
  </div>`;
}
/* read-only list in the plan's details (people who cannot edit); editors get the box under the status buttons */
function reportViewHtml(t,k){
  if(S.canWrite||isLeave(t)||(!reportsOf(t).length&&!docNeeded(t)))return '';
  return `<div class="wide" style="--k:${k}"><dt>เอกสารหลังจบงาน</dt><dd>${docBox(t,false)}</dd></div>`;
}
function reportBoxHtml(t){return isLeave(t)?'':docBox(t,true)}
function redrawReportView(){renderDrawerView(editing);renderPhotos();renderFiles()}
const docLeftToast=t=>docNeeded(t)?(docMissing(t).length?` · ยังขาด ${docMissing(t).map(k=>DOC_NAME[k]).join(', ')}`:' · เอกสารครบแล้ว'):'';
/* kind = the document row the files were uploaded on: they are labelled with that document (เอกสารอื่น ๆ: no label) */
async function addReports(files,kind){
  if(!editing||!S.canWrite||repBusy||!(DOC_NAME[kind]||kind===OTHER_DOC))return;
  const kname=DOC_NAME[kind]||'เอกสารอื่น ๆ';
  const room=MAX_REPORTS-reportsOf(editing).length;
  const all=[...(files||[])].filter(Boolean);if(!all.length)return;
  const ok=all.filter(f=>f.size&&f.size<=MAX_FILE_BYTES).slice(0,Math.max(0,room));
  const big=all.filter(f=>!f.size||f.size>MAX_FILE_BYTES).length;
  if(!ok.length){toast(room<=0?`แนบเอกสารได้สูงสุด ${MAX_REPORTS} ไฟล์ต่อแผน`:'ไฟล์ใหญ่เกิน 4 MB หรือเป็นไฟล์ว่าง ลดขนาดไฟล์ก่อน');return}
  const id=editing.id;const now=new Date().toISOString();const added=[];
  repBusy=kind;redrawReportView();
  try{
    for(const [k,file] of ok.entries()){
      const f={id:newId('f'),name:String(file.name||'document').slice(0,120),size:file.size,type:file.type||'',blob:file};
      await putFileChunks(f,(x,i,n)=>{const l=$('#vRepLbl-'+kind);if(l)l.textContent=`กำลังอัปโหลด ${ok.length>1?`ไฟล์ ${k+1}/${ok.length} · `:''}${Math.round((i+1)/n*100)}%`});
      added.push({id:f.id,name:f.name,size:f.size,type:f.type,at:now,by:S.me||null,label:DOC_NAME[kind]||''});
    }
    const reports=reportsOf(editing).concat(added);
    await Store.update('tasks',id,Object.assign({reports},meta()));
    if(editing&&editing.id===id)editing=Object.assign({},editing,{reports});
    toast(`${kname}: แนบ ${added.length} ไฟล์แล้ว${big?` · ข้าม ${big} ไฟล์ที่ใหญ่เกิน 4 MB`:''}${all.length-big>ok.length?` · แนบได้สูงสุด ${MAX_REPORTS} ไฟล์`:''}${docLeftToast(editing)}`);
  }catch(err){toast(errText(err));noteWriteError(err);if(added.length)cleanupFiles(added.map(f=>f.id))}/* nothing half-saved stays behind */
  finally{repBusy=false;if(editing&&editing.id===id&&dMode==='view')redrawReportView()}
}
/* a file's label, typed or picked: saved at once ("qc" → "QC", "sr, qc" → "Service Report, QC") */
async function setReportLabel(fid,val){
  if(!editing||!S.canWrite)return;const f=reportsOf(editing).find(x=>x.id===fid);if(!f)return;
  const label=docCanon(String(val||'').replace(/\s+/g,' ').trim().slice(0,80));if(label===docLabel(f))return;
  const id=editing.id;const reports=reportsOf(editing).map(x=>x.id===fid?Object.assign({},x,{label}):x);
  try{await Store.update('tasks',id,Object.assign({reports},meta()));
    if(editing&&editing.id===id){editing=Object.assign({},editing,{reports});redrawReportView()}
    toast(`${f.name}: ${label||'ไม่ระบุชื่อเอกสาร'}${docLeftToast(editing)}`)}
  catch(err){toast(errText(err));noteWriteError(err);redrawReportView()}
}
async function removeReport(fid){
  if(!editing||!S.canWrite)return;const f=reportsOf(editing).find(x=>x.id===fid);if(!f)return;
  if(!await askConfirm('ลบไฟล์เอกสาร?',`ลบไฟล์ ${f.name}${docLabel(f)?` (${docLabel(f)})`:''} ออกจากแผนนี้\nลบแล้วกู้คืนไม่ได้`,'ลบไฟล์'))return;
  const id=editing.id;const reports=reportsOf(editing).filter(x=>x.id!==fid);
  try{await Store.update('tasks',id,Object.assign({reports},meta()));
    if(editing&&editing.id===id){editing=Object.assign({},editing,{reports});redrawReportView()}
    cleanupFiles([fid]);toast(`ลบ ${f.name} แล้ว`)}
  catch(err){toast(errText(err));noteWriteError(err)}
}
/* ไม่มีสำหรับงานนี้: on / off for one document */
async function toggleDocNA(kind){
  if(!editing||!S.canWrite||!DOC_NAME[kind])return;const id=editing.id;
  const cur=docNAOf(editing);const docNA=cur.includes(kind)?cur.filter(x=>x!==kind):cur.concat([kind]);
  try{await Store.update('tasks',id,Object.assign({docNA},meta()));
    if(editing&&editing.id===id){editing=Object.assign({},editing,{docNA});redrawReportView()}
    toast(docNA.includes(kind)?`${DOC_NAME[kind]}: ไม่มีสำหรับงานนี้`:`${DOC_NAME[kind]}: ต้องส่งตามปกติ`)}
  catch(err){toast(errText(err));noteWriteError(err)}
}
dlg.addEventListener('change',e=>{const t=e.target;
  if(t.dataset&&t.dataset.repKind){addReports(t.files,t.dataset.repKind);t.value='';return}
  if(t.dataset&&t.dataset.repLbl)setReportLabel(t.dataset.repLbl,t.value);
});
dlg.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.repLbl){e.preventDefault();e.target.blur()}});
dlg.addEventListener('click',e=>{
  const d=e.target.closest('[data-rep-dl]');if(d){const f=reportsOf(editing).find(x=>x.id===d.dataset.repDl);downloadFile(d.dataset.repDl,d,f);return}
  const r=e.target.closest('[data-rep-del]');if(r){removeReport(r.dataset.repDel);return}
  const n=e.target.closest('[data-rep-na]');if(n)toggleDocNA(n.dataset.repNa);
});
