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
  [['s1','วิศวกร A','Engineer',1,'onsite'],['s2','ช่างเทคนิค B','Technician',2,'onsite'],['s3','ช่างเทคนิค C','Technician',3,'lab'],['s4','สญจ D','Special Contract',4,'all']].forEach(([id,name,role,order,team])=>L.staff.set(id,{name,role,order,team,active:true,sample:true}));
  L.resources.set('r1',{name:'1กข-1234',code:'กระบะ (ตัวอย่าง)',group:'รถกระบะ',kind:'vehicle',order:1,active:true,sample:true});
  L.resources.set('r2',{name:'รถ Hiab เช่า 1',code:'HIAB (ตัวอย่าง)',group:'HIAB เช่าเพิ่ม',kind:'vehicle',order:2,active:true,sample:true});
  L.config.set('main',{sales:[{name:'Sale ตัวอย่าง',tel:'08x-xxx-0001'}]});
  [{jobType:'disconnect',planNo:'PN-26-09001',jobId:'j1',customer:'ลูกค้าตัวอย่าง',location:'ชลบุรี',date:D(0),period:'full',timeNote:'ถึงหน้างาน 08.30 น.',detail:'Work Order: WO-001\nTag No. FT-101',transport:'1กข-1234',staffIds:['s1','s2'],status:'planned',
     calItems:[{id:'c1',tag:'FT-101',size:'2"',type:'Magnetic meter',fluid:'Liquid',range:'0–40 m³/h',points:'10%, 25%, 50%, 75%, 100%',round:'A (Excise)',lab:'1',status:'add',result:'pass',detail:''},
       {id:'c2',tag:'FT-102',size:'3"',type:'Turbine meter',fluid:'Gas/Steam',range:'5–120 m³/h',points:'20%, 50%, 100%',round:'Customer',lab:'3.1',status:'add',result:'',detail:'มี flange มาด้วย'}]},
   {jobType:'installation',planNo:'PN-26-09001',jobId:'j1',customer:'ลูกค้าตัวอย่าง',location:'ชลบุรี',date:D(1),period:'full',detail:'ติดตั้ง Flowmeter คืน',transport:'1กข-1234',staffIds:['s1','s2'],status:'planned'},
   {jobType:'calonsite',line:'ins',contact:'K.Suphamit',sale:'Rungnapa',
    insItems:[{id:'i1',reqNo:'R-S1-2608061',lab:'1',plant:'HD4',tag:'ตามเอกสารแนบ',type:'PT,TT,TE',range:'Point Cal ตามเอกสารแนบ',remove:D(0),cal:D(1),install:D(1),bu:'-',plan:'3',actual:'7',remark:'Completed',
      certs:[{id:'k1',certNo:'CAL-26-1001',tagNo:'PT-101',desc:'Pressure Transmitter 0-10 bar',client:'',calDate:D(1),activity:'Calibration',note:''},{id:'k2',certNo:'CAL-26-1002',tagNo:'TT-201',desc:'Temperature Transmitter 0-200 °C',client:'',calDate:D(1),activity:'Calibration',note:''}]}],
    planNo:'PN-26-09002',customer:'ลูกค้าตัวอย่าง 2',location:'สมุทรปราการ',date:D(1),period:'am',detail:'สอบเทียบ Pressure Gauge',transport:'1กข-1234',staffIds:['s3'],status:'planned'},
   {jobType:'leave_vac',date:D(2),period:'full',detail:'',staffIds:['s4'],status:'planned'}]
   .forEach((t,i)=>L.tasks.set('d'+i,Object.assign({sample:true},t)));
  {const m=ymd(w).slice(0,7),n=k=>parseD(D(k)).getDate();/* Master Plan Flow Meter sample rows (this month) */
   [{reqNo:'PN-26-09001',cust:'ลูกค้าตัวอย่าง',tag:'FT-101',size:'2',type:'CORIOLIS',sale:'Rungnapa',fm:'1',days:{[n(0)]:'D',[n(1)]:'W',[n(2)]:'I'}},
    {reqNo:'PN-26-09001',cust:'ลูกค้าตัวอย่าง',tag:'FT-102',size:'3',type:'TURBINE',sale:'Rungnapa',fm:'2',days:{[n(0)]:'D',[n(1)]:'C',[n(2)]:'I'}},
    {reqNo:'PN-26-09001',cust:'ลูกค้าตัวอย่าง',tag:'',type:'TT,TE,PT',sale:'Rungnapa',ins:'3',days:{[n(0)]:'D/C/I'}}]
    .forEach((r,i)=>{if(ymd(addDays(w,2)).slice(0,7)!==m)return;L.mpfm.set('m'+i,Object.assign({month:m,order:i+1,fc:'',co:'',remark:'',sample:true},{size:'',fm:'',ins:''},r))})}
  {const m=ymd(w).slice(0,7),n=k=>parseD(D(k)).getDate();/* Master Plan Instrument sample row */
   if(ymd(addDays(w,2)).slice(0,7)===m)L.mpins.set('n0',{month:m,order:1,reqNo:'R-S1-2608061',lab:'1',cust:'ลูกค้าตัวอย่าง 2',plant:'HD4',tag:'ตามเอกสารแนบ',type:'PT,TT,TE',
     range:'Point Cal ตามเอกสารแนบ',remove:insDM(D(0)),cal:insDM(D(1)),install:insDM(D(2)),bu:'-',rs:'ลูกค้าส่งเอง',sale:'Rungnapa',contact:'K.Suphamit',booking:'13',days:{[n(1)]:'8',[n(2)]:'6'},remark:'',sample:true})}
  {/* ใบรับคำร้องขอรับบริการสอบเทียบ samples: one done (PN-26-09001 → the two plans above), one waiting too long (Delay), one just booked */
   const ago=(days,h)=>{const d=new Date();d.setDate(d.getDate()-days);d.setHours(h,15,0,0);return d.toISOString()};
   L.jobs.set('j1',{jobNo:'JB-26-09001',state:'accepted',svcType:'inhouse',customer:'ลูกค้าตัวอย่าง',address:'99 ถ.ตัวอย่าง อ.เมือง จ.ชลบุรี',email:'somchai@example.com',certSame:true,location:'ชลบุรี',contact:'K.Somchai',contactTel:'08x-xxx-1111',sale:'Sale ตัวอย่าง',jobType:'disconnect',line:'fm',
     items:[{id:'u1',tag:'FT-101',product:'Flowmeter',type:'Magnetic meter',size:'2',cls:'150#',output:'4-20 mA',range:'0–40 m³/h',points:'10%, 25%, 50%, 75%, 100%',acc:'0.5%',interval:'1 ปี',method:'1',witness:['excise'],round:'A (Excise)',refer:''},
       {id:'u2',tag:'FT-102',product:'Flowmeter',type:'Turbine meter',size:'3',cls:'300#',output:'Pulse',range:'5–120 m³/h',points:'20%, 50%, 100%',acc:'0.5%',interval:'1 ปี',method:'1',witness:[],round:'Customer',refer:''}],
     reports:['Calibration certificate','Before calibration result'],materialBy:'flowlab',materials:['Gasket'],adjust:'accept',installBy:'flowlab',disconnectDate:D(0),installDate:D(1),transportBy:'flowlab',receiveDate:D(0),returnDate:D(1),
     wantFrom:D(0),wantTo:D(1),period:'full',teamNeed:2,qty:'Flowmeter 2 ตัว',poNo:'QT-26-0901',detail:'Remove Flowmeter FT-101, FT-102 ส่ง Cal ที่ Lab แล้ว Install คืน',note:'',urgent:false,
     bookedAt:ago(9,9),bookedBy:'sale@example.com',planNo:'PN-26-09001',acceptedAt:ago(9,14),acceptedBy:'planner@example.com',acceptNote:'',createdAt:ago(9,9),updatedAt:ago(9,14),sample:true});
   L.jobs.set('j2',{jobNo:'JB-26-09002',state:'pending',customer:'ลูกค้าตัวอย่าง 3',location:'ระยอง',contact:'K.Napa',contactTel:'08x-xxx-2222',sale:'Rungnapa',jobType:'dci',line:'fm',svcType:'onsite',
     items:[{id:'u3',tag:'FT-301',product:'Flowmeter',type:'Coriolis meter',size:'4',cls:'300#',output:'4-20 mA',range:'0–50,000 kg/h',points:'25%, 50%, 75%, 100%',acc:'0.2%',interval:'1 ปี',method:'2',witness:['customer'],round:'',refer:''}],
     wantFrom:ymd(addDays(new Date(),2)),wantTo:'',period:'am',teamNeed:2,qty:'1 เครื่อง',poNo:'',detail:'D/C/I Coriolis FT-301 ที่หน่วย Utility',note:'ลูกค้าขอทีมเดิม',urgent:false,
     bookedAt:ago(3,10),bookedBy:'sale2@example.com',createdAt:ago(3,10),updatedAt:ago(3,10),sample:true});
   L.jobs.set('j3',{jobNo:'JB-26-09003',state:'pending',customer:'ลูกค้าตัวอย่าง 4',location:'สมุทรปราการ',contact:'',contactTel:'',sale:'Priraya',jobType:'installation',line:'fm',
     wantFrom:ymd(addDays(new Date(),1)),wantTo:'',period:'full',teamNeed:3,qty:'Flowmeter 1 ตัว',poNo:'PO-7781',detail:'Install Flowmeter ใหม่ 1 ตัว พร้อม Loop Test',note:'',urgent:true,
     bookedAt:new Date().toISOString(),bookedBy:'sale3@example.com',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sample:true})}
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
  db.collection('jobs').onSnapshot(s=>{S.jobs=s.docs.map(x=>Object.assign({id:x.id},x.data()));S.jobsReady=true;render()},dbErr);/* ใบรับคำร้องขอรับบริการสอบเทียบ */
  db.collection('checks').onSnapshot(s=>{S.checks=s.docs.map(x=>Object.assign({id:x.id},x.data()));S.checksReady=true;render()},dbErr);/* Check Sheet */
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
