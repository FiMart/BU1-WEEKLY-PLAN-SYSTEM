'use strict';
/* BU1 Weekly Plan · backup and move data (claude.ai ⇄ Supabase ⇄ file)
   Export writes every collection to one JSON file; import writes it back (same id = overwrite).
   Use it to move the team's data from the claude.ai link to the Supabase site, or to keep a monthly backup. */
const BACKUP_COLLS=['staff','resources','projects','tasks','photos','filechunks'];
let importData=null;

async function exportBackup(btn){
  if(!downloads){toast('ดาวน์โหลดไม่ได้ในมุมมองนี้');return}
  btn.disabled=true;const old=btn.textContent;
  try{
    const out={app:'bu1-weekly-plan',version:1,exportedAt:new Date().toISOString(),source:S.backend||S.mode,collections:{}};
    for(const c of BACKUP_COLLS){btn.textContent=`กำลังอ่าน ${c}…`;out.collections[c]=await Store.all(c)}
    const cfg=await Store.get('config','main');out.collections.config=cfg?[cfg]:[];
    const n=Object.values(out.collections).reduce((a,l)=>a+l.length,0);
    await saveFile(`BU1-Weekly-Plan-backup_${ymd(new Date())}.json`,new Blob([JSON.stringify(out)],{type:'application/json'}),`สำรองข้อมูลแล้ว ${n} รายการ`);
  }catch(e){toast('สำรองข้อมูลไม่สำเร็จ '+errText(e))}
  finally{btn.disabled=false;btn.textContent=old}
}
async function readBackupFile(file){
  try{
    const j=JSON.parse(await file.text());
    if(!j||j.app!=='bu1-weekly-plan'||!j.collections)throw new Error('format');
    importData=j;
  }catch(e){importData=null;toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ BU1 Weekly Plan')}
  render();
}
async function runImport(btn){
  if(!importData||!can('import'))return;
  if(!arm(btn,'import','นำเข้าข้อมูล','กดอีกครั้งเพื่อยืนยันการนำเข้า'))return;
  btn.disabled=true;S.bulk=true;let done=0;
  const cols=importData.collections;const total=Object.values(cols).reduce((a,l)=>a+(l||[]).length,0);
  try{
    if(S.backend==='supabase'&&db&&db.bulk){/* upsert per entity, 200 rows a call; dept_id is set by the backend */
      for(const [c,l] of Object.entries(cols)){const rows=(l||[]).filter(d=>d&&d.id).map(d=>Object.assign({},d,{id:String(d.id)}));
        for(let i=0;i<rows.length;i+=200){await db.bulk(c,rows.slice(i,i+200));done+=Math.min(200,rows.length-i);btn.textContent=`นำเข้าแล้ว ${done}/${total}`}}
    }else{
      for(const [c,l] of Object.entries(cols)){for(const d of (l||[])){const {id,...data}=d;if(!id)continue;await Store.set(c,String(id),data);done++;if(done%10===0)btn.textContent=`นำเข้าแล้ว ${done}/${total}`}}
    }
    toast(`นำเข้าข้อมูลแล้ว ${done} รายการ`);importData=null;
  }catch(e){toast(`นำเข้าได้ ${done} รายการ แล้วหยุด: ${errText(e)}`);noteWriteError(e)}
  finally{S.bulk=false;btn.disabled=false;invalidate();if(!db)localPublish();else render()}
}
function backupSection(){
  const n=importData?Object.entries(importData.collections).map(([c,l])=>`${c} ${(l||[]).length}`).join(' · '):'';
  const where=S.backend==='supabase'?'Supabase':S.mode==='live'?'claude.ai':'เครื่องนี้ (ออฟไลน์)';
  return {id:'backup',title:'สำรอง / ย้ายข้อมูล',sub:'ไฟล์ JSON · ย้ายไป Supabase',count:'JSON',
    desc:`ข้อมูลตอนนี้อยู่ที่ ${where} · สำรองข้อมูลทั้งหมด (พนักงาน รถ แผนงาน โปรเจกต์ รูป ไฟล์แนบ ข้อมูลหลัก) เป็นไฟล์เดียว แล้วนำเข้าที่ระบบ Supabase เพื่อย้ายข้อมูล หรือเก็บไว้เป็นไฟล์สำรองประจำเดือน`,
    body:`<div class="bk">
      <div class="bk-step"><span class="step">1</span><div><b>สำรองข้อมูล</b><p class="hint">ดาวน์โหลดข้อมูลทั้งหมดจากระบบที่เปิดอยู่เป็นไฟล์ .json</p><button type="button" class="btn primary" data-action="backup-export"${downloads?'':' disabled'}>ดาวน์โหลดไฟล์สำรอง</button></div></div>
      <div class="bk-step"><span class="step">2</span><div><b>นำเข้าข้อมูล</b><p class="hint">เลือกไฟล์สำรอง แล้วกดนำเข้า รายการที่มี id เดียวกันจะถูกเขียนทับ รายการอื่นไม่ถูกลบ${can('import')?'':' · บัญชีนี้ไม่มีสิทธิ์นำเข้าข้อมูล'}</p>
        <label class="btn" for="bkFile">เลือกไฟล์สำรอง (.json)</label><input type="file" id="bkFile" class="sr-only" accept=".json,application/json"${can('import')?'':' disabled'}>
        ${importData?`<div class="bk-file"><b>พร้อมนำเข้า</b> · ส่งออกจาก ${esc(importData.source||'-')} เมื่อ ${esc(importData.exportedAt&&!isNaN(new Date(importData.exportedAt))?thDate(ymd(new Date(importData.exportedAt))):'-')}<br><span class="hint">${esc(n)}</span></div>
          <button type="button" class="btn danger" data-action="backup-import">นำเข้าข้อมูล</button>`:''}</div></div>
    </div>`};
}
document.addEventListener('change',e=>{if(e.target.id==='bkFile'&&e.target.files&&e.target.files[0]){readBackupFile(e.target.files[0]);e.target.value=''}});
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-action]');if(!a)return;
  if(a.dataset.action==='backup-export')exportBackup(a);
  if(a.dataset.action==='backup-import')runImport(a);
});
