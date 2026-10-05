'use strict';
/* BU1 Weekly Plan · shared db (or in-memory store), cached range reads, week helpers */
/* ---------- store (shared db, or in-memory when db is unavailable) ----------
   The app's single read / write path: views call Store (or the live queries in boot.js), never a storage API directly.
   db is the claude.ai db, or the Supabase adapter (js/data/supabase.js on js/data/backend.js); without db it is memory. */
const L={staff:new Map(),resources:new Map(),tasks:new Map(),config:new Map(),photos:new Map(),projects:new Map(),filechunks:new Map()};
/* plans saved with the removed status "progress" (กำลังดำเนินการ) are read as "planned" */
const normTask=t=>{if(t&&t.status==='progress')t.status='planned';return t};
const rows=m=>[...m].map(([id,d])=>normTask(Object.assign({id},d)));
const docRows=s=>s.docs.map(d=>normTask(Object.assign({id:d.id},d.data())));
function localPublish(){
  S.staff=rows(L.staff);S.resources=rows(L.resources);S.projects=rows(L.projects);
  const {from,to}=weekRange();S.tasks=rows(L.tasks).filter(t=>t.date>=from&&t.date<=to);
  S.cfg=Object.assign({},L.config.get('main')||{});S.tasksReady=true;S.projReady=true;invalidate();render();
}
function afterWrite(c){if(c==='tasks'&&!S.bulk){invalidate();render()}}
const Store={
  /* every row carries dept_id (central Supabase guide, item 3); the Supabase backend always overwrites it with BU1_CONFIG.deptId */
  async set(c,id,d){d=Object.assign({},d,{dept_id:DEPT()});if(db){const r=await db.collection(c).doc(id).set(d);afterWrite(c);return r}if(!L[c])L[c]=new Map();L[c].set(id,Object.assign({},d));if(!S.bulk)localPublish()},
  async update(c,id,d){if(db){const r=await db.collection(c).doc(id).update(d);afterWrite(c);return r}L[c].set(id,Object.assign({},L[c].get(id),d));localPublish()},
  async del(c,id){if(db){const r=await db.collection(c).doc(id).delete();afterWrite(c);return r}L[c].delete(id);localPublish()},
  async where(c,field,op,val){
    if(db){const s=await db.collection(c).where(field,op,val).get();return docRows(s)}
    return rows(L[c]).filter(x=>op==='in'?val.includes(x[field]):op==='array-contains'?(x[field]||[]).includes(val):x[field]===val);
  },
  async range(c,from,to){
    if(db){const s=await db.collection(c).where('date','>=',from).where('date','<=',to).get();return docRows(s)}
    return rows(L[c]).filter(x=>x.date>=from&&x.date<=to);
  },
  async all(c){
    if(db){const s=await db.collection(c).get();return docRows(s)}
    return rows(L[c]);
  },
  async get(c,id){
    if(db){const s=await db.collection(c).doc(id).get();return s.exists?normTask(Object.assign({id:s.id},s.data())):null}
    const d=L[c].get(id);return d?normTask(Object.assign({id},d)):null;
  },
};
function errText(e){
  const c=e&&e.code;
  if(c==='invalid_argument')return 'บันทึกไม่ได้: บัญชีนี้ไม่มีสิทธิ์แก้ไข ขอสิทธิ์ Contributor จากเจ้าของหน้านี้';
  if(c==='quota_exceeded')return 'ฐานข้อมูลเต็ม ลบแผนเก่าที่ไม่ใช้แล้วออกก่อน แล้วบันทึกอีกครั้ง';
  if(c==='resource_exhausted')return 'ส่งคำขอถี่เกินไป รอสักครู่แล้วลองอีกครั้ง';
  if(c==='revoked')return 'สิทธิ์เข้าถึงถูกเปลี่ยน โหลดหน้าใหม่อีกครั้ง';
  return 'บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง';
}
function noteWriteError(e){if(e&&e.code==='invalid_argument'){S.canWrite=false;render()}}

/* ---------- cached reads outside the open week (month views, search) ---------- */
const RC=new Map();const ALL={data:null,stale:true,loading:false};
function invalidate(){RC.forEach(e=>{e.stale=true});ALL.stale=true}
function loadInto(e,fn,after){
  if(!e.stale||e.loading)return;e.loading=true;
  fn().then(d=>{e.data=d;d.forEach(t=>known.set(t.id,t))}).catch(()=>{if(!e.data)e.data=[]})
    .finally(()=>{e.stale=false;e.loading=false;if(after)after();render()});
}
function rangeTasks(from,to){const k=from+'|'+to;let e=RC.get(k);if(!e){e={data:null,stale:true,loading:false};RC.set(k,e)}loadInto(e,()=>Store.range('tasks',from,to));return e.data}
function allTasks(){loadInto(ALL,()=>Store.all('tasks'),()=>{if(S.view==='search')fillSearch()});return ALL.data}
const findTask=id=>S.tasks.find(x=>x.id===id)||known.get(id)||null;

/* ---------- week helpers ---------- */
function weekDays(){const n=S.showSun?7:6;return Array.from({length:n},(_,i)=>addDays(S.week,i))}
function weekRange(){return {from:ymd(S.week),to:ymd(addDays(S.week,6))}}
function shownTasks(){const days=new Set(weekDays().map(ymd));return S.tasks.filter(t=>days.has(t.date))}
