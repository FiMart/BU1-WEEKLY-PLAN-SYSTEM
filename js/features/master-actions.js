'use strict';
/* BU1 Weekly Plan · master data actions */
/* ---------- master data actions ---------- */
const armed=new Map();
function arm(btn,key,label,armedLabel){
  if(armed.has(key)){clearTimeout(armed.get(key));armed.delete(key);return true}
  btn.classList.add('armed');btn.textContent=armedLabel||'ยืนยันลบ';armed.set(key,setTimeout(()=>{armed.delete(key);btn.classList.remove('armed');btn.textContent=label},4000));return false;
}
async function deleteRow(btn){
  if(!arm(btn,btn.dataset.coll+'/'+btn.dataset.id,'ลบ'))return;
  try{await Store.del(btn.dataset.coll,btn.dataset.id);toast('ลบแล้ว')}catch(err){toast(errText(err));noteWriteError(err)}
}
async function clearSample(btn){
  if(!arm(btn,'sample','ลบข้อมูลตัวอย่างทั้งหมด','กดอีกครั้งเพื่อลบข้อมูลตัวอย่างทั้งหมด'))return;
  btn.disabled=true;btn.textContent='กำลังลบ…';let n=0;
  try{for(const c of ['tasks','staff','resources','projects']){const list=await Store.where(c,'sample','==',true);for(const r of list){await Store.del(c,r.id);n++}}invalidate();toast(`ลบข้อมูลตัวอย่าง ${n} รายการแล้ว`)}
  catch(err){toast(errText(err));noteWriteError(err)}
  finally{btn.disabled=false;render()}
}
async function saveCfg(patch,msg){try{await Store.set('config','main',Object.assign({},S.cfg,patch));if(msg)toast(msg)}catch(err){toast(errText(err));noteWriteError(err)}}
/* one-time switch to the English roles (Admin, Engineer, …) on shared data: renames staff roles and resets the
   positions list to DEFAULT_POSITIONS, keeping team-added positions after them; runs once, by the first editor to open */
let rolesBusy=false;
async function migrateRoles(){
  if(rolesBusy||!db||!can('master')||!S.staffReady||!S.cfgReady||S.cfg.rolesV2)return;
  rolesBusy=true;
  try{
    for(const s of S.staff)if(LEGACY_ROLES[String(s.role||'').trim()])await Store.update('staff',s.id,{role:roleName(s.role)});
    const used=new Set(S.staff.map(s=>roleName(s.role)));
    const extra=(Array.isArray(S.cfg.positions)?S.cfg.positions:[]).map(roleName).filter(p=>p&&!DEFAULT_POSITIONS.includes(p)&&(p!=='Add/พนักงานเสริม'||used.has(p)));
    await Store.set('config','main',Object.assign({},S.cfg,{positions:[...DEFAULT_POSITIONS,...new Set(extra)],rolesV2:true}));
  }catch(err){noteWriteError(err)}
  finally{rolesBusy=false}
}
const typesCopy=()=>jobTypes().map(t=>Object.assign({},t));
