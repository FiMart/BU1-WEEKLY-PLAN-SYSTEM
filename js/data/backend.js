'use strict';
/* BU1 Weekly Plan · data layer on the central Supabase project (myvwibwbwktskmfqjoez), schema public
   The real BU1 data lives in the Weekly Plan tables shared with the old BU1 app (bu1-weekly-plan.vercel.app), BU2, GA and
   Safety: public.bookings / people / cranes / leaves / … — one row = {id, dept_id, [week,] data: {id, …}}.
   Contract (handoff/DB-CONTRACT.md, 5 Oct 2026):
   - never change the JSON shape in the DB: this file maps rows <-> the app's own entities (tasks, staff, resources, …)
   - every select / delete .eq('dept_id', DEPT) · every upsert sets dept_id · bookings and leaves also carry the week column
   - when writing, keep fields the app does not know (gaCar from GA, NCR fields, tag, scope, …): {...old data, ...changes}
   - PostgREST returns at most 1,000 rows silently: order('id') + range() until count; .in() lists at most 200 ids
   - realtime: subscribe per table and filter dept_id on the client (a DELETE payload carries only the primary key)
   Formats taken from the old app (v2.8.0 bundle): week = Monday as YYYY-MM-DD (local), day = mon…sun,
   jobType = routine | fine_more | pm_internal | training | site_survey, session = morning | afternoon (none = full day).
   Fields this app has and the old one does not are kept in data.bu1wp (one namespaced object).

   Where each entity lives:
     tasks      → public.bookings (one row per plan) · leave plans → public.leaves (one row per person; id shown as "leave:<id>")
     staff      → public.people {id, name, position}       resources → public.cranes {id, name, plate, type, vendor}
     config     → public.app_settings id "bu1wp_config"     (job types, positions, Sale list)
     ncr        → public.app_settings id "bu1wp_ncr:<id>"   (one row per NCR; no own table yet — see REQUEST-TO-BU2)
     mpfm       → public.app_settings id "bu1wp_mpfm:<id>"  (Master Plan Flow Meter, one row per meter, data.month = 'YYYY-MM';
                  read one month at a time — user, 6 Oct 2026; no own table, like NCR)
     mpins      → public.app_settings id "bu1wp_mpins:<id>" (Master Plan Instrument, one row per request, same month reading)
     photos     → public.app_settings id "bu1wp_photo:<id>" (resized JPEG as a data URL, ~0.2–0.4 MB a row)
     filechunks → public.app_settings id "bu1wp_file:<fileId>_<n>" (a file in base64 pieces of 180 kB; ≤ 4 MB a file)
       user decision 6 Oct 2026: keep attachments here until BU2 creates a Storage bucket for BU1 plan files (stopgap)
     projects   → no central storage yet: refused (its UI is hidden on the central database)
   The old app reads only the "targets" row of app_settings, so the bu1wp_* rows do not touch it. */
const DB_PAGE=1000,DB_IDS=200;
const DAY_IDS=['mon','tue','wed','thu','fri','sat','sun'];
/* the old app's BU1 profile: customers are stored by id */
const CENTRAL_CUSTOMERS={L1:'Lab A',L2:'Lab B'};
const CENTRAL_TYPES=[
  {id:'routine',name:'Routine Calibrate',color:'#16a34a'},
  {id:'fine_more',name:'นอกสัญญา (Fine More)',color:'#d97706'},
  {id:'pm_internal',name:'PM Internal',color:'#7c3aed'},
  {id:'training',name:'อบรม / Training',color:'#0891b2'},
  {id:'site_survey',name:'Site Survey',color:'#64748b'},
];
/* entity -> public tables it is read from (for realtime) */
const CENTRAL_TABLES={tasks:['bookings','leaves'],staff:['people'],resources:['cranes'],config:['app_settings'],ncr:['app_settings'],mpfm:['app_settings'],mpins:['app_settings'],audit:['app_settings'],projects:[],photos:[],filechunks:[]};
const CFG_ID='bu1wp_config',NCR_PREFIX='bu1wp_ncr:',LEAVE_PREFIX='leave:';
/* entities kept as rows of app_settings, one row per record, id = prefix + record id */
/* data.ga… fields this app writes itself (GA Fleet's request fields, see gaFields): not GA's answer (gaMore) */
const GA_OWN=['gaDepart','gaPattern','gaUrgent','gaCargo','gaNote','gaRequestedAt','gaCancel','gaWholeRange'];
const KV_PREFIX={ncr:NCR_PREFIX,mpfm:'bu1wp_mpfm:',mpins:'bu1wp_mpins:',audit:'bu1wp_audit:',photos:'bu1wp_photo:',filechunks:'bu1wp_file:'};
const readOnlyErr=()=>({code:'read_only',message:'read-only: writing to the central database is switched off (BU1_CONFIG.readOnly)'});
const unsupportedErr=e=>({code:'unsupported',message:`${e}: no storage on the central database yet`});

const weekDate=(week,day)=>{const i=DAY_IDS.indexOf(day);return week&&i>=0?ymd(addDays(parseD(week),i)):''};
const weekOf=date=>ymd(mondayOf(parseD(date)));
const dayOf=date=>DAY_IDS[(parseD(date).getDay()+6)%7];
const asList=v=>Array.isArray(v)?v:v?[v]:[];
const stripped=o=>{const c=Object.assign({},o);Object.keys(c).forEach(k=>{if(c[k]===undefined)delete c[k]});return c};

function supabaseBackend(client,{dept}){
  const from=t=>client.from(t);
  async function selectAll(table,narrow){
    const out=[];let at=0,total=Infinity;
    while(at<total){
      let q=from(table).select('*',{count:'exact'}).eq('dept_id',dept);
      if(narrow)q=narrow(q);
      const {data,error,count}=await q.order('id').range(at,at+DB_PAGE-1);
      if(error)throw error;
      const rows=data||[];out.push(...rows);total=count??out.length;
      if(!rows.length)break;at+=rows.length;
    }
    return out;
  }
  /* current rows by id (for merging), 200 ids at a time */
  async function byIds(table,ids){
    const out=[];
    for(let i=0;i<ids.length;i+=DB_IDS){const part=ids.slice(i,i+DB_IDS);out.push(...await selectAll(table,q=>q.in('id',part)))}
    return new Map(out.map(r=>[r.id,r]));
  }
  async function put(table,rows){if(!rows.length)return;const {error}=await from(table).upsert(rows);if(error)throw error}
  async function drop(table,ids){
    for(let i=0;i<ids.length;i+=DB_IDS){const {error}=await from(table).delete().eq('dept_id',dept).in('id',ids.slice(i,i+DB_IDS));if(error)throw error}
  }
  /* names for crane / equipment ids inside bookings; reloaded when those tables change */
  let lookups=null;
  const loadLookups=()=>lookups||(lookups=Promise.all([selectAll('cranes'),selectAll('equipment').catch(()=>[])])
    .then(([c,e])=>({cranes:new Map(c.map(r=>[r.id,r.data||{}])),equipment:new Map(e.map(r=>[r.id,r.data||{}]))}))
    .catch(err=>{lookups=null;throw err}));
  const craneName=c=>c?String(c.plate||c.name||''):'';

  /* ---------- read: rows -> app entities ---------- */
  function taskOf(r,lk){
    const d=r.data||{};const x=d.bu1wp||{};const st=d.status==='issue'?'notdone':d.status==='done'?'done':'planned';
    const scope=asList(d.scope).filter(Boolean);
    const equip=asList(d.equipment).map(id=>{const e=lk.equipment.get(id);return e?[e.name,e.sn].filter(Boolean).join(' '):id});
    const detail=x.detail!=null?x.detail:[d.tag?`Tag No. ${d.tag}`:'',d.tagDetail,scope.length?`Scope: ${scope.join(', ')}`:'',
      equip.length?`เครื่องมือ: ${equip.join(', ')}`:'',d.trainTopic?`หัวข้ออบรม: ${d.trainTopic}`:'',
      d.meterCount!=null&&d.meterCount!==''?`จำนวนมิเตอร์: ${d.meterCount}`:'',d.note].filter(Boolean).join('\n');
    const cranes=asList(d.crane).map(id=>craneName(lk.cranes.get(id))||id);
    return {id:r.id,date:weekDate(d.week||r.week,d.day),
      period:d.session==='morning'?'am':d.session==='afternoon'?'pm':'full',
      jobType:x.jobType||d.jobType||'routine',jobTypeOther:x.jobTypeOther||'',jobTypeName:x.jobTypeName||'',line:x.line||'',
      planNo:d.jobNo||'',customer:CENTRAL_CUSTOMERS[d.customer]||d.customer||'',location:d.location||'',areaId:d.areaId||'',
      timeNote:x.timeNote!=null?x.timeNote:[d.startTime,d.endTime].filter(Boolean).join('–')+(d.startTime?' น.':''),
      detail,request:x.request||'',transport:x.transport!=null?x.transport:cranes.join(', '),
      needGA:x.needGA!=null?!!x.needGA:!!d.needsGACar,
      /* วิธีเดินทาง: GA Fleet's own fields first (data.gaDepart / gaPattern / …, transport 'self'), then this app's older copies */
      gaGo:d.gaDepart||x.gaGo||'',gaBack:x.gaBack||'',gaPattern:d.gaPattern||'',gaUrgent:!!d.gaUrgent,gaCargo:d.gaCargo&&typeof d.gaCargo==='object'?d.gaCargo:null,gaNote:d.gaNote||'',gaRequestedAt:d.gaRequestedAt||'',
      selfDrive:!!x.selfDrive||d.transport==='self',carReason:d.selfReason||x.carReason||'',carNote:d.selfNote||x.carNote||'',
      gaCar:d.gaCar||null,gaMore:Object.fromEntries(Object.entries(d).filter(([k])=>/^ga[A-Z_]/.test(k)&&k!=='gaCar'&&!GA_OWN.includes(k))),/* GA's other fields, read only */
      contact:x.contact||'',contactTel:x.contactTel||'',sale:x.sale||'',guests:asList(x.guests),prep:asList(x.prep),
      staffIds:asList(d.workers),status:x.status||st,statusNote:d.problem||'',ncrId:x.ncrId||'',
      photoIds:asList(x.photoIds),fileIds:asList(x.fileIds),files:asList(x.files),reports:asList(x.reports),docNA:asList(x.docNA),history:asList(x.history),calItems:asList(x.calItems),insItems:asList(x.insItems),sharedTeam:!!d.allowSharedTeam,
      createdBy:d.createdBy||x.createdBy||null,createdAt:x.createdAt||'',updatedAt:x.updatedAt||'',updatedBy:x.updatedBy||null,
      tag:d.tag||'',groupId:d.groupId||null,src:'bookings'};
  }
  const leaveOf=r=>{const d=r.data||{};const x=d.bu1wp||{};
    return {id:LEAVE_PREFIX+r.id,date:weekDate(d.week||r.week,d.day),period:x.period||'full',jobType:'leave',
      staffIds:d.personId?[d.personId]:[],detail:x.detail!=null?x.detail:d.kind||'ลา',status:x.status||'planned',statusNote:x.statusNote||'',history:asList(x.history),
      createdBy:x.createdBy||null,createdAt:x.createdAt||'',updatedAt:x.updatedAt||'',updatedBy:x.updatedBy||null,src:'leaves'}};
  const staffOf=(r,i)=>{const d=r.data||{};const x=d.bu1wp||{};return {id:r.id,name:d.name||r.id,role:d.position||'',order:x.order??i,active:!d.archived}};
  const resourceOf=(r,i)=>{const d=r.data||{};const x=d.bu1wp||{};return {id:r.id,name:craneName(d)||r.id,code:d.plate?d.name||'':'',group:d.type||'',vendor:d.vendor||'',
    kind:'vehicle',order:x.order??i,active:!d.archived}};

  async function listTasks(f){
    const lk=await loadLookups();
    const byWeek=q=>{if(f.from)q=q.gte('week',weekOf(f.from));if(f.to)q=q.lte('week',weekOf(f.to));return q};
    if(f.id!=null){
      const id=String(f.id);
      if(id.startsWith(LEAVE_PREFIX))return (await selectAll('leaves',q=>q.eq('id',id.slice(LEAVE_PREFIX.length)))).map(leaveOf);
      return (await selectAll('bookings',q=>q.eq('id',id))).map(r=>taskOf(r,lk));
    }
    /* Plan No. check while typing: ask the server for that job number only */
    const pn=(f.eq||[]).find(([k])=>k==='planNo');
    if(pn)return (await selectAll('bookings',q=>byWeek(q).eq('data->>jobNo',String(pn[1])))).map(r=>taskOf(r,lk)).filter(t=>t.date);
    /* "is this photo / file still used by a plan?" (cleanup after removing an attachment) */
    const has=(f.contains||[]).find(([k])=>k==='photoIds'||k==='fileIds');
    if(has)return (await selectAll('bookings',q=>q.filter(`data->bu1wp->${has[0]}`,'cs',JSON.stringify([has[1]])))).map(r=>taskOf(r,lk));
    const [b,l]=await Promise.all([selectAll('bookings',byWeek),selectAll('leaves',byWeek)]);
    return b.map(r=>taskOf(r,lk)).concat(l.map(leaveOf)).filter(t=>t.date);
  }
  /* this app's own job types and positions stay the choices (user, 6 Oct 2026); the old app's job types are kept
     inactive only so its plans still show a name and colour. Edits are saved in app_settings "bu1wp_config". */
  async function listConfig(){
    const [people,saved]=await Promise.all([selectAll('people'),selectAll('app_settings',q=>q.eq('id',CFG_ID))]);
    const used=[...new Set(people.map(r=>(r.data||{}).position).filter(Boolean))];
    const s=(saved[0]&&saved[0].data)||{};
    const types=Array.isArray(s.jobTypes)&&s.jobTypes.length?s.jobTypes:DEFAULT_TYPES;
    const legacy=CENTRAL_TYPES.filter(c=>!types.some(t=>t.id===c.id)).map(c=>Object.assign({active:false},c));
    return [Object.assign({},s,{id:'main',jobTypes:types.concat(legacy),
      positions:[...new Set((Array.isArray(s.positions)&&s.positions.length?s.positions:DEFAULT_POSITIONS).concat(used))],
      sales:Array.isArray(s.sales)?s.sales:[],rolesV2:true})];
  }
  /* app_settings records: one by id, a file's chunks by fileId, or all of the entity */
  async function listKv(entity,f){
    const p=KV_PREFIX[entity];const fileId=entity==='filechunks'&&(f.eq||[]).find(([k])=>k==='fileId');
    /* Master Plan: only the asked month (data.month) is read, not the whole year */
    const month=(entity==='mpfm'||entity==='mpins')&&(f.eq||[]).find(([k])=>k==='month');
    const narrow=f.id!=null?q=>q.eq('id',p+f.id):fileId?q=>q.like('id',p+fileId[1]+'_%'):month?q=>q.like('id',p+'%').eq('data->>month',String(month[1])):q=>q.like('id',p+'%');
    return (await selectAll('app_settings',narrow)).map(r=>Object.assign({},r.data||{},{id:r.id.slice(p.length)}));
  }

  /* ---------- write: app entities -> rows (merged with what is stored) ---------- */
  const isLeaveTask=t=>t.jobType==='leave';
  const plain=t=>{const c=Object.assign({},t);['id','dept_id','src','gaCar','gaMore','tag','groupId','start','end','type'].forEach(k=>delete c[k]);return c};
  function bu1wpOf(t,old){
    return stripped(Object.assign({},old||{},{jobType:t.jobType,jobTypeOther:t.jobTypeOther||'',jobTypeName:t.jobTypeName||'',line:t.line||'',/* สายงาน fm | ins */
      detail:t.detail??'',request:t.request||'',timeNote:t.timeNote||'',transport:t.transport||'',needGA:!!t.needGA,gaGo:t.gaGo||'',gaBack:t.gaBack||'',/* เวลาไป / กลับ asked of GA (ขอรถใช้เอง: เวลารับ / คืนรถ) */selfDrive:!!t.selfDrive,carReason:t.carReason||'',carNote:t.carNote||'',/* รถส่วนตัว: เหตุผล / หมายเหตุ */
      contact:t.contact||'',contactTel:t.contactTel||'',sale:t.sale||'',guests:asList(t.guests),prep:asList(t.prep),
      status:t.status||'planned',ncrId:t.ncrId||'',period:t.period||'full',sample:t.sample||undefined,
      photoIds:asList(t.photoIds),fileIds:asList(t.fileIds),files:asList(t.files),/* the pictures and files themselves: app_settings rows */
      calItems:asList(t.calItems),/* Weekly plan calibration rows (js/features/calibration.js) */
      insItems:asList(t.insItems),/* Weekly plan instrument rows + certificates (js/features/instrument.js) */
      history:asList(t.history),
      docNA:asList(t.docNA),/* เอกสารหลังจบงาน marked ไม่มีสำหรับงานนี้: 'sr' | 'qc' | 'job' */
      reports:asList(t.reports),/* Service Report / QC / ใบรับงาน files (js/dialog/report.js), bytes in app_settings like the files above */
      createdAt:t.createdAt||(old&&old.createdAt)||'',createdBy:t.createdBy||(old&&old.createdBy)||null,updatedAt:t.updatedAt||'',updatedBy:t.updatedBy||null}));
  }
  /* transport text -> crane ids, when every name matches a registered vehicle (plate or name) */
  function craneIds(text,lk){
    const names=String(text||'').split(/\s*,\s*/).map(s=>s.trim()).filter(Boolean);const ids=[];
    for(const n of names){const hit=[...lk.cranes].find(([,c])=>[craneName(c),c.name,c.plate].some(v=>v&&norm(v)===norm(n)));if(hit)ids.push(hit[0])}
    return ids;
  }
  /* the GA request in GA Fleet's own booking fields (read by ga-fleet.vercel.app; the BU2 form writes the same):
     needsGACar · gaPattern wait|drop|pickup_return|continue · gaDepart "HH:MM" · gaUrgent · gaCargo {size, caution} ·
     gaNote · gaRequestedAt · ขอรถไปเอง = transport 'self' + selfReason / selfNote · gaCancel {reason} when a request is withdrawn */
  function gaFields(d,t,wasNeed,st){
    const put=(k,v)=>{if(v==null||v===''||v===false)delete d[k];else d[k]=v};
    const need=!!t.needGA&&st!=='cancelled';const self=need&&!!t.selfDrive;
    put('gaDepart',need?t.gaGo||'':'');put('gaPattern',need&&!self?t.gaPattern||'wait':'');put('gaUrgent',need&&!self&&!!t.gaUrgent);
    put('gaCargo',need&&!self&&t.gaCargo&&t.gaCargo.size?{size:t.gaCargo.size,...(t.gaCargo.caution?{caution:t.gaCargo.caution}:{})}:null);
    put('gaNote',need?t.gaNote||'':'');put('selfReason',self?t.carReason||'':'');put('selfNote',self?t.carNote||'':'');
    if(self)d.transport='self';else if(d.transport==='self')delete d.transport;
    if(need){if(!d.gaRequestedAt)d.gaRequestedAt=new Date().toISOString();delete d.gaCancel}
    else{delete d.gaRequestedAt;if(wasNeed)d.gaCancel={reason:st==='cancelled'?`ยกเลิกแผนงาน${t.statusNote?' · '+t.statusNote:''}`:'แผนกเปลี่ยนวิธีเดินทาง ไม่ใช้รถ GA',at:new Date().toISOString()}}
  }
  function bookingRow(t,old,lk){
    const d=Object.assign({},old?old.data||{}:{});const wasNeed=d.needsGACar===true;
    const ids=craneIds(t.transport,lk);const cust=Object.keys(CENTRAL_CUSTOMERS).find(k=>norm(CENTRAL_CUSTOMERS[k])===norm(t.customer));
    const st=t.status||'planned';const centralType=CENTRAL_TYPES.some(c=>c.id===t.jobType)?t.jobType:null;
    Object.assign(d,{id:t.id,week:weekOf(t.date),day:dayOf(t.date),
      jobType:centralType||d.jobType||'routine',jobNo:t.planNo||'',customer:cust||t.customer||'',location:t.location||'',
      workers:asList(t.staffIds),status:st==='done'?'done':st==='planned'?'planned':'issue',problem:NEEDS_REASON.has(st)?t.statusNote||'':'',
      needsGACar:!!t.needGA&&st!=='cancelled',/* a cancelled plan leaves GA's queue */
      /* vehicles: unchanged text keeps the stored ids as they are; otherwise the ids of the registered vehicles named */
      crane:norm(t.transport)===norm(asList(d.crane).map(id=>craneName(lk.cranes.get(id))||id).join(', '))?asList(d.crane):ids,
      tag:d.tag!=null?d.tag:(t.planNo||''),scope:Array.isArray(d.scope)?d.scope:asList(d.scope),equipment:asList(d.equipment),
      createdBy:d.createdBy||t.createdBy||'',bu1wp:bu1wpOf(t,d.bu1wp)});
    gaFields(d,t,wasNeed,st);
    if(t.areaId)d.areaId=t.areaId;else delete d.areaId;
    if(t.sharedTeam)d.allowSharedTeam=true;else delete d.allowSharedTeam;/* BU2's own field: the old app reads it too */
    if(t.period==='am')d.session='morning';else if(t.period==='pm')d.session='afternoon';else delete d.session;
    if(t.period==='am'||t.period==='pm')d.craneSlot=t.period;else delete d.craneSlot;
    if(d.groupId===undefined)d.groupId=null;if(d.problem==null)d.problem='';
    return {id:t.id,dept_id:dept,week:d.week,data:d};
  }
  /* a leave plan becomes one leaves row per person (the first keeps the plan's id) */
  function leaveRows(t,baseId,olds){
    const people=asList(t.staffIds);const list=people.length?people:[''];
    return list.map((p,i)=>{const id=i?`${baseId}~${p}`:baseId;const old=olds.get(id);const d=Object.assign({},old?old.data||{}:{});
      Object.assign(d,{id,week:weekOf(t.date),day:dayOf(t.date),personId:p,kind:String(t.detail||'ลา').split('\n')[0].slice(0,60)||'ลา',
        bu1wp:Object.assign(bu1wpOf(t,d.bu1wp),{detail:t.detail||'',statusNote:t.statusNote||''})});
      return {id,dept_id:dept,week:d.week,data:d}});
  }
  async function writeTasks(rows){
    const lk=await loadLookups();
    const bIds=[],lIds=[];rows.forEach(r=>{const id=String(r.id);if(id.startsWith(LEAVE_PREFIX))lIds.push(id.slice(LEAVE_PREFIX.length));else{bIds.push(id);lIds.push(id)}});
    const [oldB,oldL]=await Promise.all([byIds('bookings',bIds),byIds('leaves',lIds)]);
    const putB=[],putL=[],dropB=[],dropL=[];
    for(const t0 of rows){
      const id=String(t0.id);const t=Object.assign(plain(t0),{id});
      if(!t.date)throw {code:'invalid_argument',message:'plan without a date'};
      if(id.startsWith(LEAVE_PREFIX)){
        const base=id.slice(LEAVE_PREFIX.length);
        if(isLeaveTask(t))putL.push(...leaveRows(t,base,oldL));
        else{dropL.push(base);putB.push(bookingRow(Object.assign({},t,{id:base}),null,lk))}/* leave turned into work */
      }else if(isLeaveTask(t)){
        if(oldB.has(id))dropB.push(id);/* work turned into leave */
        putL.push(...leaveRows(t,id,oldL));
      }else putB.push(bookingRow(t,oldB.get(id),lk));
    }
    /* write first, then remove what moved table, so a failure never loses the plan */
    await put('bookings',putB);await put('leaves',putL);
    await drop('bookings',dropB);await drop('leaves',dropL);
  }
  async function writePeople(rows){
    const old=await byIds('people',rows.map(r=>String(r.id)));
    await put('people',rows.map(s=>{const id=String(s.id);const d=Object.assign({},(old.get(id)||{}).data||{});
      Object.assign(d,{id,name:s.name||'',position:s.role||d.position||'',archived:s.active===false,bu1wp:stripped(Object.assign({},d.bu1wp||{},{order:s.order,sample:s.sample||undefined}))});
      return {id,dept_id:dept,data:d}}));
  }
  async function writeCranes(rows){
    const old=await byIds('cranes',rows.map(r=>String(r.id)));
    await put('cranes',rows.map(v=>{const id=String(v.id);const d=Object.assign({},(old.get(id)||{}).data||{});
      Object.assign(d,{id,name:v.code||v.name||'',plate:v.code?v.name||'':(d.plate&&!v.code&&d.name===v.name?d.plate:''),type:v.group||d.type||'',
        vendor:v.vendor??d.vendor??'',archived:v.active===false,bu1wp:stripped(Object.assign({},d.bu1wp||{},{order:v.order,sample:v.sample||undefined}))});
      return {id,dept_id:dept,data:d}}));
    lookups=null;
  }
  const settingsRow=(id,data)=>({id,dept_id:dept,data,updated_at:new Date().toISOString()});

  return {
    dept,
    /* filters from the db adapter: {id} · {from,to} on the plan date (→ week column) · planNo; others are re-checked on the client */
    async list(entity,f={}){
      if(!(entity in CENTRAL_TABLES))throw new Error('unknown entity: '+entity);
      let rows;
      if(entity==='tasks')rows=await listTasks(f);
      else if(entity==='staff')rows=(await selectAll('people')).map(staffOf);
      else if(entity==='resources')rows=(await selectAll('cranes')).map(resourceOf);
      else if(entity==='config')rows=await listConfig();
      else if(KV_PREFIX[entity])return listKv(entity,f);
      else rows=[];/* projects: no central storage yet */
      return f.id!=null&&entity!=='tasks'?rows.filter(r=>r.id===String(f.id)):rows;
    },
    async upsert(entity,rows){
      if(isReadOnly())throw readOnlyErr();
      if(!rows.length)return;
      if(entity==='tasks')return writeTasks(rows);
      if(entity==='staff')return writePeople(rows);
      if(entity==='resources')return writeCranes(rows.filter(r=>(r.kind||'vehicle')==='vehicle'));
      if(entity==='config')return put('app_settings',rows.filter(r=>r.id==='main').map(r=>{const d=plain(r);delete d.rolesV2;return settingsRow(CFG_ID,d)}));
      if(KV_PREFIX[entity])return put('app_settings',rows.map(r=>settingsRow(KV_PREFIX[entity]+r.id,plain(r))));
      throw unsupportedErr(entity);
    },
    async remove(entity,ids){
      if(isReadOnly())throw readOnlyErr();
      ids=ids.map(String);if(!ids.length)return;
      if(entity==='tasks'){
        const leaves=ids.filter(i=>i.startsWith(LEAVE_PREFIX)).map(i=>i.slice(LEAVE_PREFIX.length));
        await drop('bookings',ids.filter(i=>!i.startsWith(LEAVE_PREFIX)));await drop('leaves',leaves);return;
      }
      if(entity==='staff')return drop('people',ids);
      if(entity==='resources'){await drop('cranes',ids);lookups=null;return}
      if(KV_PREFIX[entity])return drop('app_settings',ids.map(i=>KV_PREFIX[entity]+i));
      throw unsupportedErr(entity);
    },
    /* live changes of one entity; returns an unsubscribe function */
    watch(entity,cb){
      const tables=(CENTRAL_TABLES[entity]||[]).concat(entity==='tasks'?['cranes','equipment']:[]);
      if(!tables.length)return ()=>{};
      const ch=client.channel(`bu1:${entity}:${Math.random().toString(36).slice(2,8)}`);
      tables.forEach(table=>ch.on('postgres_changes',{event:'*',schema:'public',table},p=>{
        const r=(p.new&&p.new.dept_id)?p.new:(p.old||{});if(r.dept_id!==undefined&&r.dept_id!==dept)return;
        if(table==='cranes'||table==='equipment')lookups=null;
        if(table==='app_settings'){const id=String(r.id||'');if(entity==='config'&&id!==CFG_ID)return;if(KV_PREFIX[entity]&&!id.startsWith(KV_PREFIX[entity]))return}
        cb(p);
      }));
      ch.subscribe();
      return ()=>client.removeChannel(ch);
    },
  };
}
