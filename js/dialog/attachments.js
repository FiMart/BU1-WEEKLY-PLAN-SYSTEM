'use strict';
/* BU1 Weekly Plan · plan drawer: photos, file attachments, lightbox */
/* Photos: shrunk in the browser, one per db doc (photos/<id>), so anyone who can edit plans can attach them */
const MAX_PHOTOS=8;const photoCache=new Map();let photoItems=[];let lbIndex=0;
const CAM_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/></svg>';
async function compressImage(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('decode'));i.src=url});
    let max=1400,q=.82;
    for(let k=0;k<8;k++){
      const sc=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
      const out=c.toDataURL('image/jpeg',q);if(out.length<=230000)return {data:out,w,h};
      if(q>.62)q-=.1;else max=Math.round(max*.8);
    }
    throw new Error('big');
  }finally{URL.revokeObjectURL(url)}
}
async function addPhotoFiles(files){
  if(!S.canWrite)return;
  const imgs=[...files].filter(f=>f&&(/^image\//.test(f.type||'')||/\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name||'')));
  if(!imgs.length){toast('เลือกไฟล์รูปภาพ (JPG หรือ PNG)');return}
  const room=MAX_PHOTOS-photoItems.length;if(room<=0){toast(`แนบได้สูงสุด ${MAX_PHOTOS} รูปต่อแผน`);return}
  let bad=0;
  for(const f of imgs.slice(0,room)){
    try{const r=await compressImage(f);photoItems.push({id:newId('p'),data:r.data,w:r.w,h:r.h,name:String(f.name||'photo').slice(0,80),isNew:true});renderPhotos()}
    catch(e){bad++}
  }
  if(bad)toast(`เปิดรูปไม่ได้ ${bad} ไฟล์ ใช้ไฟล์ JPG หรือ PNG (รูป HEIC จาก iPhone ให้แชร์เป็น JPG ก่อน)`);
  else if(imgs.length>room)toast(`แนบได้สูงสุด ${MAX_PHOTOS} รูปต่อแผน`);
}
function renderPhotos(){
  $('#phGrid').innerHTML=photoItems.map((p,i)=>p.data
    ?`<figure class="ph"><button type="button" class="view" data-ph-view="${i}" aria-label="ดูรูปที่ ${i+1}"><img src="${p.data}" alt="รูปประกอบ ${i+1}"></button>${S.canWrite?`<button type="button" class="ph-x" data-ph-remove="${i}" aria-label="ลบรูปที่ ${i+1}">×</button>`:''}${p.isNew?'<span class="new">ใหม่</span>':''}</figure>`
    :`<figure class="ph loading">${p.missing?'ไม่พบรูป':'กำลังโหลด…'}${S.canWrite&&p.missing?`<button type="button" class="ph-x" data-ph-remove="${i}" aria-label="เอาออก">×</button>`:''}</figure>`).join('');
  $('#photoBox').classList.toggle('full',(photoItems.length>=MAX_PHOTOS&&fileItems.length>=MAX_FILES)||!S.canWrite);
  const dv=$('#dvPhotos');if(dv)dv.innerHTML=photoItems.map((p,i)=>p.data?`<figure class="ph"><button type="button" class="view" data-ph-view="${i}" aria-label="ดูรูปที่ ${i+1}"><img src="${p.data}" alt="รูปประกอบ ${i+1}"></button></figure>`:`<figure class="ph loading">${p.missing?'ไม่พบรูป':'กำลังโหลด…'}</figure>`).join('');
}
async function loadPhotos(ids){
  const items=ids.map(id=>({id,data:photoCache.get(id)||'',isNew:false}));photoItems=items;renderPhotos();
  const want=items.filter(p=>!p.data);if(!want.length)return;
  await Promise.all(want.map(async p=>{try{const d=await Store.get('photos',p.id);if(d&&d.data){p.data=d.data;photoCache.set(p.id,d.data)}else p.missing=true}catch(e){p.missing=true}}));
  if(photoItems===items)renderPhotos();
}
async function persistNewPhotos(){
  const now=new Date().toISOString();
  for(const p of photoItems.filter(x=>x.isNew)){await Store.set('photos',p.id,{data:p.data,w:p.w,h:p.h,name:p.name,createdAt:now,by:S.me||null});p.isNew=false;photoCache.set(p.id,p.data)}
}
async function cleanupPhotos(ids){
  for(const id of ids){try{const refs=await Store.where('tasks','photoIds','array-contains',id);if(!refs.length){await Store.del('photos',id);photoCache.delete(id)}}catch(e){}}
}
/* Other attachments (PDF, Excel, Word...): kept byte-for-byte, split into ≤180 KB chunks in filechunks/<fileId>_<i>
   because a db document holds at most 256 KB; the task keeps files[{id,name,size,type}] and fileIds for lookups */
const MAX_FILES=5,MAX_FILE_BYTES=4*1024*1024,CHUNK=180000;let fileItems=[];
const isImgFile=f=>/^image\/(jpe?g|png|gif|webp|bmp)/.test(f.type||'')||/\.(jpe?g|png|gif|webp|bmp)$/i.test(f.name||'');
async function addAttachments(files){
  if(!S.canWrite)return;const all=[...(files||[])].filter(Boolean);if(!all.length)return;
  if(dMode==='view')setMode('edit');
  const imgs=all.filter(isImgFile),docs=all.filter(f=>!isImgFile(f));
  if(docs.length)addDocFiles(docs);
  if(imgs.length)await addPhotoFiles(imgs);
}
function addDocFiles(docs){
  let big=0,over=0;
  for(const f of docs){
    if(fileItems.length>=MAX_FILES){over++;continue}
    if(!f.size||f.size>MAX_FILE_BYTES){big++;continue}
    fileItems.push({id:newId('f'),name:String(f.name||'file').slice(0,120),size:f.size,type:f.type||'',blob:f,isNew:true});
  }
  renderFiles();
  if(big)toast(`แนบไม่ได้ ${big} ไฟล์ เพราะใหญ่เกิน 4 MB หรือเป็นไฟล์ว่าง ลดขนาดไฟล์ก่อน เช่น บันทึก PDF แบบย่อขนาด`);
  else if(over)toast(`แนบไฟล์ได้สูงสุด ${MAX_FILES} ไฟล์ต่อแผน`);
}
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
function fileExt(name){const e=(String(name).includes('.')?String(name).split('.').pop():'').toLowerCase();return e==='pdf'?'PDF':/^(xlsx?|xlsm|csv)$/.test(e)?'XLS':/^docx?$/.test(e)?'DOC':/^pptx?$/.test(e)?'PPT':/^(zip|rar|7z)$/.test(e)?'ZIP':(e.slice(0,4).toUpperCase()||'FILE')}
function fileRow(f,i,editable){
  const ext=fileExt(f.name);
  return `<div class="fchip"><span class="fext" data-ext="${esc(ext)}">${esc(ext)}</span><span class="fmeta"><b title="${esc(f.name)}">${esc(f.name)}</b><small>${fmtSize(f.size||0)}${f.isNew?' · ใหม่ จะอัปโหลดตอนกดบันทึก':''}</small></span>${f.isNew?'':`<button type="button" class="btn sm" data-file-dl="${esc(f.id)}">ดาวน์โหลด</button>`}${editable?`<button type="button" class="ph-x2" data-file-remove="${i}" aria-label="เอา ${esc(f.name)} ออก">×</button>`:''}</div>`;
}
function renderFiles(){
  $('#fileList').innerHTML=fileItems.map((f,i)=>fileRow(f,i,S.canWrite)).join('');
  const dv=$('#dvFiles');if(dv)dv.innerHTML=fileItems.map((f,i)=>fileRow(f,i,false)).join('');
  $('#photoBox').classList.toggle('full',(photoItems.length>=MAX_PHOTOS&&fileItems.length>=MAX_FILES)||!S.canWrite);
}
function loadFiles(t){fileItems=(t&&t.files||[]).map(f=>Object.assign({},f,{isNew:false}));renderFiles()}
const fileMeta=()=>fileItems.map(f=>({id:f.id,name:f.name,size:f.size,type:f.type||''}));
const toB64=u8=>{let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)};
/* one file's bytes as chunks filechunks/<id>_<i> (also used by the Service Report, js/dialog/report.js) */
async function putFileChunks(f,onProg){
  const now=new Date().toISOString();
  const u8=new Uint8Array(await f.blob.arrayBuffer());const n=Math.max(1,Math.ceil(u8.length/CHUNK));
  for(let i=0;i<n;i++){if(onProg)onProg(f,i,n);await Store.set('filechunks',`${f.id}_${i}`,{fileId:f.id,i,n,name:f.name,data:toB64(u8.subarray(i*CHUNK,(i+1)*CHUNK)),createdAt:now,by:S.me||null})}
}
async function persistNewFiles(onProg){
  for(const f of fileItems.filter(x=>x.isNew)){await putFileChunks(f,onProg);f.isNew=false;delete f.blob}
}
async function downloadFile(id,btn,meta){
  const f=meta||fileItems.find(x=>x.id===id)||{name:'file'};
  if(!downloads){toast('หน้านี้ดาวน์โหลดไฟล์ไม่ได้ในมุมมองนี้ เปิดผ่านลิงก์ claude.ai');return}
  if(btn){btn.disabled=true;btn.textContent='กำลังโหลด…'}
  try{
    const parts=(await Store.where('filechunks','fileId','==',id)).sort((a,b)=>a.i-b.i);
    if(!parts.length||parts.length<(parts[0].n||1))throw new Error('missing');
    const bufs=parts.map(p=>{const s=atob(p.data);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u});
    await saveFile(f.name,new Blob(bufs,{type:f.type||'application/octet-stream'}),`ส่งไฟล์ ${f.name} ให้ดาวน์โหลดแล้ว`);
  }catch(e){toast('เปิดไฟล์ไม่สำเร็จ ไฟล์อาจถูกลบไปแล้ว')}
  finally{if(btn){btn.disabled=false;btn.textContent='ดาวน์โหลด'}}
}
async function cleanupFiles(ids){
  for(const id of ids){try{const refs=await Store.where('tasks','fileIds','array-contains',id);if(refs.length)continue;
    for(const p of await Store.where('filechunks','fileId','==',id))await Store.del('filechunks',p.id)}catch(e){}}
}
$('#phFile').addEventListener('change',e=>{addAttachments(e.target.files);e.target.value=''});
['dragenter','dragover'].forEach(ev=>dlg.addEventListener(ev,e=>{if(!S.canWrite||!e.dataTransfer||![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();$('#photoBox').classList.add('drag')}));
['dragleave','drop'].forEach(ev=>dlg.addEventListener(ev,()=>$('#photoBox').classList.remove('drag')));
dlg.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length){e.preventDefault();addAttachments(e.dataTransfer.files)}});
dlg.addEventListener('paste',e=>{const fs=[...((e.clipboardData&&e.clipboardData.files)||[])];if(fs.length){e.preventDefault();addAttachments(fs)}});
form.addEventListener('click',e=>{
  const fd=e.target.closest('[data-file-dl]');if(fd){downloadFile(fd.dataset.fileDl,fd);return}
  const fr=e.target.closest('[data-file-remove]');if(fr){fileItems.splice(Number(fr.dataset.fileRemove),1);renderFiles();return}
  const v=e.target.closest('[data-ph-view]');if(v){openLightbox(Number(v.dataset.phView));return}
  const r=e.target.closest('[data-ph-remove]');if(r){photoItems.splice(Number(r.dataset.phRemove),1);renderPhotos()}
});
const lb=$('#lightbox');
function showLb(){const p=photoItems[lbIndex];if(!p)return;$('#lbImg').src=p.data||'';$('#lbCap').textContent=`รูปที่ ${lbIndex+1} / ${photoItems.length}${p.name?' · '+p.name:''}`;$('#lbPrev').hidden=$('#lbNext').hidden=photoItems.length<2}
function openLightbox(i){if(!photoItems[i]||!photoItems[i].data)return;lbIndex=i;showLb();if(!lb.open)lb.showModal()}
$('#lbPrev').addEventListener('click',()=>{lbIndex=(lbIndex-1+photoItems.length)%photoItems.length;showLb()});
$('#lbNext').addEventListener('click',()=>{lbIndex=(lbIndex+1)%photoItems.length;showLb()});
$('#lbClose').addEventListener('click',()=>lb.close());
lb.addEventListener('click',e=>{if(e.target===lb)lb.close()});
lb.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')$('#lbPrev').click();if(e.key==='ArrowRight')$('#lbNext').click()});
