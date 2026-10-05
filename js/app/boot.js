'use strict';
/* BU1 Weekly Plan · data wiring and start-up (loads last) */
/* ---------- data wiring ---------- */
function dbErr(e){if(e&&(e.code==='revoked'||e.code==='unavailable'||e.code==='not_granted'||e.code==='capability_disabled')){S.mode='error';render()}}
function subscribeWeek(){
  if(!db){if(S.mode==='local')localPublish();else render();return}
  if(unsubTasks)unsubTasks();S.tasksReady=false;S.tasks=[];render();
  const {from,to}=weekRange();
  let settled=false;
  unsubTasks=db.collection('tasks').where('date','>=',from).where('date','<=',to).onSnapshot(s=>{
    if(settled)s.docChanges().forEach(ch=>{if(ch.type!=='removed')flashIds.add(ch.doc.id)});
    settled=!s.metadata.fromCache;S.tasks=docRows(s);S.tasks.forEach(t=>known.set(t.id,t));S.tasksReady=true;invalidate();render()},dbErr);
}
function startLocal(){
  S.mode='local';const w=S.week;const D=n=>ymd(addDays(w,n));
  [['s1','วิศวกร A','Engineer',1],['s2','ช่างเทคนิค B','Technician',2],['s3','ช่างเทคนิค C','Technician',3],['s4','สญจ D','Special Contract',4]].forEach(([id,name,role,order])=>L.staff.set(id,{name,role,order,active:true,sample:true}));
  L.resources.set('r1',{name:'1กข-1234',code:'กระบะ (ตัวอย่าง)',group:'รถกระบะ',kind:'vehicle',order:1,active:true,sample:true});
  L.resources.set('r2',{name:'รถ Hiab เช่า 1',code:'HIAB (ตัวอย่าง)',group:'HIAB เช่าเพิ่ม',kind:'vehicle',order:2,active:true,sample:true});
  L.config.set('main',{sales:[{name:'Sale ตัวอย่าง',tel:'08x-xxx-0001'}]});
  [{jobType:'disconnect',planNo:'PN-26-09001',customer:'ลูกค้าตัวอย่าง',location:'ชลบุรี',date:D(0),period:'full',timeNote:'ถึงหน้างาน 08.30 น.',detail:'Work Order: WO-001\nTag No. FT-101',transport:'1กข-1234',staffIds:['s1','s2'],status:'planned'},
   {jobType:'installation',planNo:'PN-26-09001',customer:'ลูกค้าตัวอย่าง',location:'ชลบุรี',date:D(1),period:'full',detail:'ติดตั้ง Flowmeter คืน',transport:'1กข-1234',staffIds:['s1','s2'],status:'planned'},
   {jobType:'calonsite',planNo:'PN-26-09002',customer:'ลูกค้าตัวอย่าง 2',location:'สมุทรปราการ',date:D(1),period:'am',detail:'สอบเทียบ Pressure Gauge',transport:'1กข-1234',staffIds:['s3'],status:'planned'},
   {jobType:'leave',date:D(2),period:'full',detail:'ลาพักร้อน',staffIds:['s4'],status:'planned'}]
   .forEach((t,i)=>L.tasks.set('d'+i,Object.assign({sample:true},t)));
  L.projects.set('p1',{name:'โปรเจกต์ตัวอย่าง',headcount:3,from:D(0),to:D(18),workSun:false,sample:true});
  S.cfgReady=true;localPublish();
}
function showMe(){
  if(!users)return;
  users.me().then(m=>{if(!m||!m.id)return;setAccount({name:m.name||'',avatar:m.avatarUrl||'',id:m.id})}).catch(()=>{});
}
/* live subscriptions; the same code serves the claude.ai db and the Supabase adapter */
function wireData(){
  db.collection('staff').onSnapshot(s=>{S.staff=s.docs.map(x=>Object.assign({id:x.id},x.data()));S.staffReady=true;render();migrateRoles()},dbErr);
  db.collection('resources').onSnapshot(s=>{S.resources=s.docs.map(x=>Object.assign({id:x.id},x.data()));S.resReady=true;render()},dbErr);
  db.collection('projects').onSnapshot(s=>{S.projects=s.docs.map(x=>Object.assign({id:x.id},x.data()));S.projReady=true;render()},dbErr);
  db.collection('ncr').onSnapshot(s=>{S.ncr=s.docs.map(x=>Object.assign({id:x.id},x.data()));S.ncrReady=true;render()},dbErr);
  db.doc('config/main').onSnapshot(s=>{S.cfg=s.exists?s.data():{};S.cfgReady=true;render();migrateRoles()},dbErr);
  subscribeWeek();
}
/* backend: claude.ai db when opened on claude.ai · Supabase (login required) when js/config.js is filled in · otherwise offline sample */
async function init(){
  render();
  const c=window.claude;
  if(c&&typeof c.use==='function'){
    const [d,u,dl]=await Promise.all([c.use('db').catch(()=>null),c.use('user').catch(()=>null),c.use('downloads').catch(()=>null)]);
    users=u;downloads=dl;
    if(d){
      db=d;S.mode='live';S.backend='claude';showMe();
      if(users){try{S.me=await users.id();const w=await users.can('data.write');if(w===false)S.canWrite=false}catch(e){}}
      usePrefsOf(S.me||'claude');wireData();return;
    }
  }
  if(hasSupabaseConfig()){initSupabase();return}
  downloads=browserDownloads;usePrefsOf('local');startLocal();
}
init();
