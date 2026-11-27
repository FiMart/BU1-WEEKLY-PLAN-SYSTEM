'use strict';
/* BU1 Weekly Plan · ถาม AI (user, 27 Nov 2026: "เพิ่มการถาม ai สอบถามข้อมูลในระบบด้วย"; chose plans · requests + Check Sheets · NCR + onsite
   documents · people / leave / vehicles; every level but GA; floating button + chat panel; links to what it names, tables + copy to LINE,
   chat kept in this browser).
   A manual tool-use loop: aaAsk sends the chat to BU1_CONFIG.aiAskUrl (default /api/ai-ask, api/ai-ask.js — it holds the prompt, the tool
   list, the model and the key); when Claude asks for tools (stop_reason tool_use) aaRun answers them HERE from the data this account can
   already read (Store.range / S.jobs / S.checks / S.ncr / S.staff …), READ ONLY, and the results go back as tool_result blocks.
   Assistant content is stored and resent exactly as it came back (thinking blocks included) — never edited. A failed round drops the whole
   exchange, so the chat never ends on a tool_use without its result. Chat = localStorage bu1wp.aiask|backend|dept|me (no database writes). */
const AA={key:'',msgs:[],model:'',open:false,busy:false,step:'',err:'',lastQ:'',ac:null,stop:false,drawn:false};
const AA_ROUNDS=10,AA_MAXQ=20,AA_MAXLEN=900000,AA_CLIP=40000;
/* OFF unless js/config.js sets BU1_CONFIG.aiAskUrl (user, 27 Nov 2026: costs money → off for now, replaced by the free ⚡ ถามด่วน in
   js/features/quick-ask.js, which reuses AA_TOOLS below; to switch on: aiAskUrl:'/api/ai-ask' + ANTHROPIC_API_KEY in Vercel) */
const aaUrl=()=>{const u=typeof BU1_CONFIG!=='undefined'?BU1_CONFIG.aiAskUrl:undefined;return String(u||'')};
/* central database, signed in, a known level that is not GA */
const aaOn=()=>S.backend==='supabase'&&typeof sb!=='undefined'&&!!sb&&!!aaUrl()&&!!S.level&&!(typeof isGA==='function'&&isGA());
const aaPhone=()=>window.innerWidth<=760;
const aaKeyOf=()=>`bu1wp.aiask|${S.backend||'local'}|${typeof DEPT==='function'?DEPT():''}|${norm(S.me)||'local'}`;
function aaLoad(){const k=aaKeyOf();if(AA.key===k)return;AA.key=k;let d=null;try{d=JSON.parse(localStorage.getItem(k)||'null')}catch(e){}
  AA.msgs=d&&Array.isArray(d.msgs)?d.msgs:[];AA.model=d&&d.model||'';AA.err='';AA.lastQ=''}
function aaSave(){try{localStorage.setItem(AA.key,JSON.stringify({msgs:AA.msgs,model:AA.model,at:Date.now()}))}catch(e){try{localStorage.removeItem(AA.key)}catch(_){}}}
const aaQs=()=>AA.msgs.filter(m=>m.role==='user'&&Array.isArray(m.content)&&m.content.some(b=>b.type==='text')).length;
const aaTooLong=()=>aaQs()>=AA_MAXQ||JSON.stringify(AA.msgs).length>AA_MAXLEN;

/* the first line of each question: today, who asks (the model reads "today" / "my" from it) */
function aaCtx(){const td=ymd(new Date());const name=(S.account&&S.account.name)||(S.me?String(S.me).split('@')[0]:'');
  const me=typeof ntfMeStaff==='function'?ntfMeStaff():'';
  return `[วันนี้ ${fmtDayY(td)} (${td}) · ผู้ถาม ${name||'—'} · ระดับ ${S.level||'—'}${me?` · พนักงาน ${staffName(me)}`:''}]`}
const aaStripCtx=s=>String(s||'').replace(/^\[วันนี้[^\]]*\]\n?/,'');

/* ---------- the loop ---------- */
async function aaCall(msgs){
  const {data:{session}={}}=await sb.auth.getSession();const tok=session&&session.access_token;
  if(!tok)throw new Error('ต้องเข้าสู่ระบบด้วยบัญชีกลางก่อน');
  const ac=new AbortController();AA.ac=ac;const tm=setTimeout(()=>ac.abort(),125000);
  let r;try{r=await fetch(aaUrl(),{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok}`},body:JSON.stringify({messages:msgs})})}
  catch(e){throw new Error(AA.stop?'หยุดแล้ว':e&&e.name==='AbortError'?'AI ใช้เวลานานเกินไป ลองถามให้แคบลง':navigator.onLine===false?'เครื่องไม่ได้ต่ออินเทอร์เน็ต':'ติดต่อบริการ AI ไม่ได้ ลองใหม่อีกครั้ง')}
  finally{clearTimeout(tm);AA.ac=null}
  let j=null;try{j=await r.json()}catch(e){}
  if(!j)throw new Error(r.status===404?'เว็บนี้ยังไม่ได้ติดตั้งบริการ AI (api/ai-ask) — ใช้ได้บนเว็บที่ deploy ด้วย Vercel':`บริการ AI ตอบผิดพลาด (${r.status})`);
  if(!j.ok)throw new Error(j.error||`บริการ AI ตอบผิดพลาด (${r.status})`);
  return {content:Array.isArray(j.content)?j.content:[],stop:j.stop_reason||'',model:j.model||''};
}
async function aaAsk(q){
  q=String(q||'').trim();if(!q||AA.busy||!aaOn())return;aaLoad();
  if(aaTooLong()){AA.err='แชตนี้ยาวแล้ว · กด "แชตใหม่" เพื่อเริ่มคุยเรื่องใหม่';aaDraw();return}
  const base=AA.msgs.length;AA.lastQ=q;
  AA.msgs.push({role:'user',content:[{type:'text',text:`${aaCtx()}\n${q}`}]});
  Object.assign(AA,{busy:true,err:'',stop:false,step:'กำลังอ่านคำถาม…'});aaDraw(true);
  try{
    let done=false;
    for(let i=0;i<AA_ROUNDS&&!done;i++){
      const r=await aaCall(AA.msgs);if(AA.stop)throw new Error('หยุดแล้ว');
      if(r.model)AA.model=r.model;
      if(r.stop==='refusal')throw new Error('AI ไม่ตอบคำถามนี้ · ลองถามด้วยคำอื่น');
      if(!r.content.length)throw new Error('AI ไม่ได้ตอบ · ลองอีกครั้ง');
      AA.msgs.push({role:'assistant',content:r.content});
      if(r.stop!=='tool_use'){done=true;break}
      const uses=r.content.filter(b=>b.type==='tool_use');
      AA.step=uses.map(aaStepText).join(' · ')||'กำลังค้นข้อมูล…';aaDraw();
      /* every result in ONE user message, a failed tool as is_error */
      const res=await Promise.all(uses.map(async u=>{try{return {type:'tool_result',tool_use_id:u.id,content:aaClip(await aaRun(u.name,u.input||{}))}}
        catch(e){return {type:'tool_result',tool_use_id:u.id,content:String(e&&e.message||e),is_error:true}}}));
      if(AA.stop)throw new Error('หยุดแล้ว');
      AA.msgs.push({role:'user',content:res});AA.step='กำลังสรุปคำตอบ…';aaDraw();
    }
    if(!done)throw new Error('AI ค้นข้อมูลหลายรอบเกินไป · ลองถามให้แคบลง');
    AA.lastQ='';
  }catch(err){AA.msgs.length=base;AA.err=String(err&&err.message||err);const t=$('#aaQ');if(t&&!t.value)t.value=q}
  finally{AA.busy=false;AA.step='';aaSave();aaDraw(true)}
}
function aaStepText(u){const x=u.input||{};const r=(a,b)=>aaD(a)?`${fmtDay(a)}${aaD(b)&&b!==a?'–'+fmtDay(b):''}`:'';
  return ({find_plans:`ค้นแผนงาน ${r(x.date_from,x.date_to)}`,get_plan:`เปิดแผน ${x.plan_no||''}`,find_requests:'ค้นใบรับคำร้อง',find_check_sheets:'ค้น Check Sheet',find_ncr:'ค้น NCR',
    onsite_docs:`ดูเอกสาร Onsite ${r(x.date_from,x.date_to)}`,people_on:`ดูกำลังคน ${r(x.date_from,x.date_to)}`,vehicles_on:`ดูการใช้รถ ${r(x.date_from,x.date_to)}`,list_staff:'ดูรายชื่อพนักงาน'})[u.name]||'กำลังค้นข้อมูล…'}
/* a result over AA_CLIP characters keeps fewer items and says so */
function aaClip(o){let s=JSON.stringify(o);if(s.length<=AA_CLIP||!o||!Array.isArray(o.items))return s.length>AA_CLIP?s.slice(0,AA_CLIP):s;
  const all=o.items.length;let n=all;while(n>1&&s.length>AA_CLIP){n=Math.floor(n*0.75);s=JSON.stringify(Object.assign({},o,{items:o.items.slice(0,n),truncated:true,note:`ผลมากเกิน แสดง ${n} จาก ${all} รายการ · ให้ค้นให้แคบลง (ช่วงวันที่สั้นลง หรือใส่ตัวกรอง)`}))}
  return s}

/* ---------- the tools (READ ONLY; the definitions live in api/ai-ask.js) ---------- */
const aaD=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
const aaCut=(s,n)=>{s=String(s==null?'':s).replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n)+'…':s};
const aaHas=(hay,q)=>!q||mdKey(hay).includes(mdKey(q));
const aaDays=(a,b)=>Math.round((parseD(b)-parseD(a))/864e5);
const aaWhen=v=>v?jbWhen(v):'';
async function aaTasks(from,to,max){
  from=aaD(from);to=aaD(to)||from;
  if(!from||to<from)throw new Error('ต้องระบุ date_from (และ date_to) เป็น YYYY-MM-DD โดย date_to ไม่ก่อน date_from');
  if(aaDays(from,to)>max)throw new Error(`ช่วงวันที่ยาวเกิน ${max} วัน · ให้แบ่งค้นเป็นช่วง`);
  const m=new Map();(await quietly(()=>Store.range('tasks',from,to))||[]).forEach(t=>m.set(t.id,t));
  S.tasks.forEach(t=>{if(t.date>=from&&t.date<=to)m.set(t.id,t)});
  return {from,to,list:[...m.values()].filter(t=>t&&t.date>=from&&t.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||String(a.planNo||'').localeCompare(String(b.planNo||'')))};
}
function aaPlan(t){
  const o={plan_no:t.planNo||'',id:t.id,date:t.date,day:fmtDay(t.date),period:pName(t),type:typeLabel(t),customer:t.customer||'',location:t.location||'',
    status:noStatus(t)?'-':stTh(t.status||'planned'),team:teamNames(t)};
  if(t.timeNote)o.time=t.timeNote;const ln=lineOf(t);if(LINE[ln])o.line=LINE[ln].name;
  const v=transportText(t);if(v)o.vehicle=v;if(t.sale)o.sale=t.sale;const dt=aaCut(detailOf(t),240);if(dt)o.detail=dt;
  if(isLate(t))o.late='เลยวันแล้ว ยังไม่ปิดสถานะ';if(t.statusNote)o.status_note=aaCut(t.statusNote,160);
  if(teamNeedOf(t))o.team_need=`${teamNeedOf(t)} คน · ${teamNeedText(t)}`;
  if(t.doneSum)o.summary=aaCut(t.doneSum,240);if(t.remark)o.remark=aaCut(t.remark,160);
  if(attHas(t))o.actual_team=[...(t.doneTeam||[]).map(staffName),...(t.doneGuests||[])];
  if(t.status==='done'){const m=docMissing(t);if(m.length)o.docs_missing=m.map(k=>DOC_NAME[k])}
  if(t.cont)o.continues=`งานต่อเนื่อง${t.contNext?' ทำต่อ '+t.contNext:''}`;
  return o;
}
async function aaFindPlan(x){
  const pn=String(x.plan_no||'').trim().toUpperCase();const id=String(x.id||'').trim();
  if(id){let t=findTask(id);if(!t){try{t=await Store.get('tasks',id)}catch(e){}}if(t)return [t]}
  if(!pn)throw new Error('ต้องระบุ plan_no หรือ id');
  const pool=new Map();(typeof NTF!=='undefined'&&NTF.range||[]).concat(S.tasks,[...known.values()],(typeof ALL!=='undefined'&&ALL.data)||[]).forEach(t=>{if(t&&String(t.planNo||'').toUpperCase()===pn)pool.set(t.id,t)});
  if(!pool.size){try{(await Store.where('tasks','planNo','==',pn)).forEach(t=>{t=normTask(t);known.set(t.id,t);pool.set(t.id,t)})}catch(e){}}
  return [...pool.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
const AA_OD={ok:'ส่งทันเวลา',late:'ส่งช้า',wait:'รอส่ง (ยังไม่ถึง Final)',follow:'เลย Final แล้วยังขาด'};
const AA_TOOLS={
  async find_plans(x){
    const {from,to,list}=await aaTasks(x.date_from,x.date_to,186);const lim=Math.max(1,Math.min(200,Math.floor(Number(x.limit)||60)));
    const st=x.status||'any';
    const hit=list.filter(t=>(x.include_leave||!isLeave(t))
      &&(st==='any'||(st==='late'?isLate(t):(t.status||'planned')===st))
      &&(!x.line||lineOf(t)===x.line||!lineOf(t))
      &&aaHas(t.customer,x.customer)&&aaHas(teamNames(t).join(' '),x.person)&&aaHas(searchText(t),x.text));
    return {from,to,count:hit.length,items:hit.slice(0,lim).map(aaPlan),...(hit.length>lim?{note:`มีทั้งหมด ${hit.length} แผน แสดง ${lim} แผนแรก`}:{})};
  },
  async get_plan(x){
    const l=await aaFindPlan(x);if(!l.length)return {count:0,note:'ไม่พบแผนนี้'};
    return {count:l.length,items:l.slice(0,10).map(t=>{const o=aaPlan(t);
      const c=contactOf(t);if(c)o.contact=c;if(t.request)o.request=aaCut(t.request,300);
      if(t.doneIn||t.doneOut)o.work_time=`${t.doneIn||'?'}–${t.doneOut||'?'}`;
      const g=typeof gaInfo==='function'?gaInfo(t):null;if(g)o.ga_car=Object.fromEntries(g);else if(t.needGA)o.ga_car=gaWaiting(t)?'ขอรถ GA แล้ว รอ GA จัดรถ':'ขอรถ GA';
      if(t.needGA&&gaTimes(t))o.ga_request=gaTimes(t);
      const rep=(t.reports||[]).map(f=>f.label||f.name).filter(Boolean);if(rep.length)o.documents=rep.slice(0,20);
      if(typeof odOn==='function'&&odOn(t)){const r=odRow(t);if(!r.none)o.onsite_docs={status:AA_OD[r.status]||r.status,final:r.final,missing:r.miss.map(s=>OD_NAME[s.id])}}
      const cal=calOf(t);if(cal.length)o.calibration=cal.slice(0,30).map(i=>({tag:i.tag,size:i.size,type:i.type,status:i.status,result:i.result}));
      const ins=insOf(t);if(ins.length)o.instrument=ins.slice(0,30).map(i=>({tag:i.tag,type:i.type,plant:i.plant,actual:i.actual,remark:i.remark}));
      const n=(S.ncr||[]).filter(y=>y.taskId===t.id).map(y=>`${y.ncrNo} (${y.state==='closed'?'ปิดแล้ว':'เปิดอยู่'})`);if(n.length)o.ncr=n;
      if(t.jobId){const j=jbById(t.jobId);if(j)o.request_no=j.jobNo}
      const h=(t.history||[]).slice(-6).map(e=>({at:aaWhen(e.at),by:String(e.by||'').split('@')[0],what:e.a==='create'?'สร้าง':(e.ch||[]).map(c=>c[0]).join(', ')}));if(h.length)o.history=h;
      return o})};
  },
  async find_requests(x){
    if(!S.jobsReady)return {count:0,note:'ยังโหลดใบรับคำร้องไม่เสร็จ ลองอีกครั้ง'};
    const st=x.state||'any';const f=aaD(x.date_from),to=aaD(x.date_to);
    const hit=S.jobs.filter(j=>(st==='any'||(st==='review'?jbNeedsReview(j):j.state===st))
      &&(!f||ymd(new Date(j.bookedAt||0))>=f)&&(!to||ymd(new Date(j.bookedAt||0))<=to)
      &&aaHas([j.jobNo,j.planNo,j.customer,j.sale,j.location,j.detail,j.note].join(' '),x.text))
      .sort((a,b)=>String(b.bookedAt||'').localeCompare(String(a.bookedAt||'')));
    const ty=id=>{const t=jobTypes().find(y=>y.id===id);return t?t.name:''};
    return {count:hit.length,items:hit.slice(0,80).map(j=>{const a=acceptFlow(j);return {request_no:j.jobNo,state:{pending:'รอ Planner รับงาน',accepted:'รับงานแล้ว',cancelled:'ยกเลิก'}[j.state]||j.state,
      ...(jbNeedsReview(j)?{review:'Sale แก้หลังออก PN · รอ review'}:{}),plan_no:j.planNo||'',customer:j.customer||'',location:j.location||'',sale:j.sale||'',job_type:j.jobTypeOther||ty(j.jobType),
      want:[j.wantFrom,j.wantTo].filter(Boolean).join(' – '),booked:aaWhen(j.bookedAt),booked_by:String(j.bookedBy||'').split('@')[0],meters:(j.items||[]).length,
      ...(a?{answer:a[1]}:{}),...(j.urgent?{urgent:true}:{}),...(j.cancelReason?{cancel_reason:j.cancelReason}:{})}})};
  },
  async find_check_sheets(x){
    if(!S.checksReady)return {count:0,note:'ยังโหลด Check Sheet ไม่เสร็จ ลองอีกครั้ง'};
    const st=x.state||'any';
    const hit=S.checks.filter(c=>(!x.form||c.form===x.form)&&(st==='any'||c.state===st)&&aaHas([c.no,c.planNo,c.title,(CS_FORMS[c.form]||{}).name].join(' '),x.text))
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
    return {count:hit.length,items:hit.slice(0,80).map(c=>{const F=CS_FORMS[c.form]||{};const [n,t]=csProgress(c);const fl=csFlow(c);return {no:c.no,form:`${F.code||''} ${F.name||c.form}`.trim(),
      state:(CS_STATE[c.state]||{}).th||c.state,plan_no:c.planNo||'',title:c.title||'',progress:`${n}/${t} หัวข้อ`,created:aaWhen(c.createdAt),
      ...(c.submittedBy?{sent_by:String(c.submittedBy).split('@')[0],sent:aaWhen(c.submittedAt)}:{}),...(c.approvedBy?{approved_by:String(c.approvedBy).split('@')[0]}:{}),
      ...(c.rejectReason&&c.state==='rejected'?{reject_reason:c.rejectReason}:{}),...(fl?{flow:fl[1]}:{})}})};
  },
  async find_ncr(x){
    if(!S.ncrReady)return {count:0,note:'ยังโหลด NCR ไม่เสร็จ ลองอีกครั้ง'};
    const st=x.state||'any';
    const hit=(S.ncr||[]).filter(n=>(st==='any'||(st==='overdue'?ncrOverdue(n):st==='closed'?n.state==='closed':n.state!=='closed'))
      &&aaHas([n.ncrNo,n.planNo,n.customer,n.issue,n.cause,n.owner,n.category].join(' '),x.text)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    return {count:hit.length,items:hit.slice(0,80).map(n=>({ncr_no:n.ncrNo,state:n.state==='closed'?'ปิดแล้ว':'เปิดอยู่',...(ncrOverdue(n)?{overdue:true}:{}),plan_no:n.planNo||'',date:n.date||'',
      customer:n.customer||'',category:n.category||'',issue:aaCut(n.issue,200),cause:aaCut(n.cause,160),action:aaCut(n.action,160),owner:n.owner||'',due:n.due||''}))};
  },
  async onsite_docs(x){
    if(typeof odRows!=='function')return {count:0,note:'ไม่มีข้อมูลติดตามเอกสาร Onsite'};
    const {from,to,list}=await aaTasks(x.date_from,x.date_to,186);const st=x.status||'any';
    const rows=odRows(list).filter(r=>st==='any'||r.status===st);
    return {from,to,count:rows.length,items:rows.map(r=>({plan_no:r.t.planNo||'',date:r.t.date,customer:r.t.customer||'',lead:odLead(r.t),status:AA_OD[r.status]||r.status,final:r.final,
      ...(r.sent?{sent:r.sent}:{}),...(r.miss.length?{missing:r.miss.map(s=>OD_NAME[s.id])}:{}),...(r.over?{over_days:r.over}:{}),...(r.ckSt?{review:{ok:'ตรวจผ่านครบ',fail:'มีเอกสารไม่ผ่าน',wait:'รอตรวจ'}[r.ckSt]}:{})}))};
  },
  async people_on(x){
    const {from,to,list}=await aaTasks(x.date_from,x.date_to||x.date_from,31);
    const staff=S.staff.filter(s=>s.active!==false&&(!x.team||inTeamId(s,x.team))).slice().sort(sortPeople);const ids=new Set(staff.map(s=>s.id));
    const out=[];for(let d=parseD(from);ymd(d)<=to;d=addDays(d,1)){const k=ymd(d);const day=list.filter(t=>t.date===k);const work=new Map(),off=new Map();
      day.forEach(t=>(t.staffIds||[]).forEach(id=>{if(!ids.has(id))return;
        if(isLeave(t)){if(t.status!=='cancelled')off.set(id,`${typeLabel(t)}${periodOf(t)!=='full'?' ('+pName(t)+')':''}`)}
        else if(holdsTeam(t)){if(!work.has(id))work.set(id,[]);work.get(id).push(`${t.planNo||typeLabel(t)}${t.customer?' '+t.customer:''}${periodOf(t)!=='full'?' ('+pName(t)+')':''}`)}}));
      const h=holidayOf(k);
      out.push({date:k,day:fmtDay(k),...(h?{holiday:h.name||h}:isWeekend(d)?{weekend:true}:{}),
        working:staff.filter(s=>work.has(s.id)).map(s=>({name:s.name,team:TEAM[teamOf(s)]?TEAM[teamOf(s)].short:'',plans:work.get(s.id)})),
        leave:staff.filter(s=>off.has(s.id)).map(s=>({name:s.name,kind:off.get(s.id)})),
        free:staff.filter(s=>!work.has(s.id)&&!off.has(s.id)).map(s=>s.name)})}
    return {from,to,team:x.team?(TEAM[x.team]||{}).name||x.team:'ทุกทีม',people:staff.length,count:out.length,items:out};
  },
  async vehicles_on(x){
    const {from,to,list}=await aaTasks(x.date_from,x.date_to||x.date_from,31);const reg=vehicles().map(v=>v.name);
    const out=[];for(let d=parseD(from);ymd(d)<=to;d=addDays(d,1)){const k=ymd(d);const day=list.filter(t=>t.date===k&&holdsTeam(t)&&!isLeave(t));const used=new Set();
      const plans=day.filter(t=>t.transport||t.needGA).map(t=>{deptCars(t).forEach(n=>used.add(n));return {plan_no:t.planNo||'',customer:t.customer||'',vehicle:transportText(t),...(gaWaiting(t)?{ga:'รอ GA จัดรถ'}:{})}});
      out.push({date:k,day:fmtDay(k),plans,free_vehicles:reg.filter(n=>!used.has(n))})}
    return {from,to,vehicles:reg,count:out.length,items:out};
  },
  async list_staff(){
    return {count:S.staff.length,items:S.staff.slice().sort(sortPeople).map(s=>({name:s.name,team:TEAM[teamOf(s)]?TEAM[teamOf(s)].name:'',position:roleOf(s),...(s.active===false?{active:false}:{})})),
      vehicles:vehicles().map(v=>({name:v.name,...(v.code?{code:v.code}:{})})),job_types:jobTypes().filter(t=>t.active!==false).map(t=>t.name)};
  }
};
async function aaRun(name,input){const f=AA_TOOLS[name];if(!f)throw new Error(`ไม่มีเครื่องมือ ${name}`);return await f(input&&typeof input==='object'?input:{})}

/* ---------- answers: a small, safe Markdown (escape first) + document numbers as buttons ---------- */
const AA_REF=/\b(?:(?:PN|JB|QC|DF|RR|SR)-\d{2}-\d{5}|NCR-\d{2}-\d{5})\b/g;
const aaInline=s=>esc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(AA_REF,m=>`<button type="button" class="aa-ref" data-aa-ref="${m}">${m}</button>`);
function aaMd(text){
  const L=String(text||'').replace(/\r/g,'').split('\n');const out=[];let i=0;
  const cells=l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
  while(i<L.length){const l=L[i];
    if(/^\s*\|.*\|\s*$/.test(l)){const rows=[];while(i<L.length&&/^\s*\|.*\|\s*$/.test(L[i]))rows.push(L[i++]);
      const body=rows.filter(r=>!/^\s*\|[\s:|-]+\|\s*$/.test(r));const hasHead=rows.length>1&&/^\s*\|[\s:|-]+\|\s*$/.test(rows[1]);
      const head=hasHead?cells(body.shift()):null;
      out.push(`<div class="aa-tw"><table class="aa-t">${head?`<thead><tr>${head.map(c=>`<th>${aaInline(c)}</th>`).join('')}</tr></thead>`:''}<tbody>${body.map(r=>`<tr>${cells(r).map(c=>`<td>${aaInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue}
    if(/^\s*([-*•]|\d+[.)])\s+/.test(l)){const ol=/^\s*\d/.test(l);const it=[];while(i<L.length&&/^\s*([-*•]|\d+[.)])\s+/.test(L[i]))it.push(L[i++].replace(/^\s*([-*•]|\d+[.)])\s+/,''));
      out.push(`<${ol?'ol':'ul'}>${it.map(x=>`<li>${aaInline(x)}</li>`).join('')}</${ol?'ol':'ul'}>`);continue}
    const h=/^\s*#{1,4}\s+(.*)$/.exec(l);if(h){out.push(`<p class="aa-h">${aaInline(h[1])}</p>`);i++;continue}
    if(!l.trim()){i++;continue}
    const p=[];while(i<L.length&&L[i].trim()&&!/^\s*\|.*\|\s*$/.test(L[i])&&!/^\s*([-*•]|\d+[.)])\s+/.test(L[i])&&!/^\s*#{1,4}\s/.test(L[i]))p.push(aaInline(L[i++]));
    out.push(`<p>${p.join('<br>')}</p>`)}
  return out.join('');
}
/* LINE text: no Markdown marks; a table becomes one "•" line a row */
function aaPlain(text){
  return String(text||'').replace(/\r/g,'').split('\n').filter(l=>!/^\s*\|[\s:|-]+\|\s*$/.test(l)).map((l,i,a)=>{
    if(/^\s*\|.*\|\s*$/.test(l)){const c=l.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()).filter(Boolean);
      const first=!a[i-1]||!/^\s*\|.*\|\s*$/.test(a[i-1]);return first?c.join(' · '):'• '+c.join(' · ')}
    return l.replace(/^\s*#{1,4}\s+/,'').replace(/^\s*[-*]\s+/,'• ')}).join('\n').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\n{3,}/g,'\n\n').trim();
}

/* ---------- the panel ---------- */
const AA_EX=['พรุ่งนี้ใครว่างบ้าง (ทีม Lab On-Site)','งานที่เลยวันแล้วยังไม่ปิดสถานะ','สัปดาห์นี้มีงานของลูกค้าไหนบ้าง','Check Sheet ที่รออนุมัติ','NCR ที่ยังเปิดอยู่และเกินกำหนด','เอกสาร Onsite เดือนนี้ที่เลย Final'];
/* the chat as exchanges: the question, the tools it used, the last answer */
function aaExchanges(){const ex=[];let cur=null;
  AA.msgs.forEach(m=>{const c=Array.isArray(m.content)?m.content:[{type:'text',text:String(m.content||'')}];
    if(m.role==='user'&&c.some(b=>b.type==='text')){cur={q:aaStripCtx(c.filter(b=>b.type==='text').map(b=>b.text).join('\n')),steps:[],a:''};ex.push(cur);return}
    if(!cur||m.role!=='assistant')return;
    c.filter(b=>b.type==='tool_use').forEach(u=>cur.steps.push(aaStepText(u)));
    const t=c.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();if(t)cur.a=t});
  return ex}
const aaModelName=m=>{const x=/^claude-([a-z]+)-(\d+)(?:-(\d+))?/i.exec(m||'');return x?`Claude ${x[1][0].toUpperCase()+x[1].slice(1)} ${x[2]}${x[3]?'.'+x[3]:''}`:''};
function aaBuild(){
  let p=$('#aaPanel');if(p)return p;
  p=document.createElement('section');p.id='aaPanel';p.className='aa-panel';p.hidden=true;p.setAttribute('aria-label','ถาม AI');
  p.innerHTML=`<header class="aa-head"><button type="button" class="icon-btn sm" data-qa-open aria-label="กลับไปถามด่วน" title="กลับไปถามด่วน">‹</button><span class="aa-logo" aria-hidden="true">✨</span><div><b>ถาม AI</b><small id="aaSub">ค้นข้อมูลในระบบ · อ่านอย่างเดียว</small></div><span class="grow"></span>
      <button type="button" class="btn sm ghost" data-aa-new title="เริ่มคุยเรื่องใหม่ (ล้างแชตนี้)">แชตใหม่</button><button type="button" class="icon-btn sm" data-aa-close aria-label="ปิด">✕</button></header>
    <div class="aa-log" id="aaLog" aria-live="polite"></div>
    <form class="aa-foot" id="aaForm" onsubmit="return false"><textarea id="aaQ" rows="2" maxlength="1500" placeholder="ถามเรื่องแผนงาน คน รถ ใบรับคำร้อง Check Sheet NCR …" aria-label="คำถาม"></textarea>
      <button type="button" class="btn primary aa-send" data-aa-send aria-label="ส่งคำถาม">ส่ง</button>
      <small class="aa-note">คำถามและข้อมูลที่ AI ค้นจะถูกส่งให้ Claude (Anthropic) เพื่อตอบ · AI ไม่แก้ข้อมูลใด ๆ · ตรวจคำตอบก่อนใช้งานจริง</small></form>`;
  document.body.appendChild(p);
  $('#aaQ').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();aaSend()}});
  return p}
function aaDraw(scroll){
  const p=$('#aaPanel');if(!p||p.hidden)return;const log=$('#aaLog');const ex=aaExchanges();
  $('#aaSub').textContent=`ค้นข้อมูลในระบบ · อ่านอย่างเดียว${AA.model?' · '+aaModelName(AA.model):''}`;
  log.innerHTML=`${!ex.length&&!AA.busy?`<div class="aa-intro"><p>ถามเป็นภาษาพูดได้เลย AI จะค้นจากข้อมูลที่บัญชีนี้เห็นได้ แล้วตอบพร้อมปุ่มเปิดแผน / ใบที่พูดถึง</p><div class="aa-exs">${AA_EX.map(q=>`<button type="button" class="aa-ex" data-aa-ex="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`:''}
    ${ex.map((x,i)=>`<div class="aa-q">${esc(x.q)}</div>${x.a||x.steps.length?`<div class="aa-a">${x.steps.length?`<details class="aa-steps"><summary>ค้นข้อมูล ${x.steps.length} ครั้ง</summary><ul>${x.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`:''}
      <div class="aa-md">${aaMd(x.a)}</div>${x.a?`<div class="aa-acts"><button type="button" class="btn sm" data-aa-copy="${i}">คัดลอกส่ง LINE</button></div>`:''}</div>`:''}`).join('')}
    ${AA.busy?`<div class="aa-a aa-busy" role="status"><span class="aa-spin" aria-hidden="true"></span><span>${esc(AA.step||'กำลังคิด…')}</span><button type="button" class="btn sm ghost" data-aa-stop>หยุด</button></div>`:''}
    ${AA.err?`<div class="aa-err" role="alert">${esc(AA.err)}${AA.lastQ?' <button type="button" class="btn sm" data-aa-retry>ลองอีกครั้ง</button>':''}</div>`:''}`;
  const send=$('[data-aa-send]');if(send)send.disabled=AA.busy;const q=$('#aaQ');if(q)q.disabled=AA.busy;
  if(scroll!==false)log.scrollTop=log.scrollHeight;
}
function aaPanel(on){
  const p=aaBuild();if(on==null)on=p.hidden;
  if(!on){p.hidden=true;AA.open=false;document.body.classList.remove('aa-lock');return}
  if(!aaOn())return;aaLoad();p.hidden=false;AA.open=true;document.body.classList.toggle('aa-lock',aaPhone());
  if(typeof ntfPanel==='function'&&NTF.open)ntfPanel(false);
  aaDraw();setTimeout(()=>{const q=$('#aaQ');if(q&&!AA.busy)q.focus()},50);
}
function aaSend(){const q=$('#aaQ');if(!q||AA.busy)return;const v=q.value.trim();if(!v)return;q.value='';aaAsk(v)}
/* called at the end of render(): the panel closes when AI is not allowed any more. The floating button is ⚡ ถามด่วน
   (js/features/quick-ask.js); ถาม AI opens from inside it while aaOn() */
function aaSync(){if(!aaOn()&&AA.open)aaPanel(false)}
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;
  if(t.closest('[data-aa-open]')){if(typeof qaPanel==='function')qaPanel(false);aaPanel(true);return}
  if(!t.closest('#aaPanel'))return;
  if(t.closest('[data-aa-close]')){aaPanel(false);return}
  if(t.closest('[data-aa-send]')){aaSend();return}
  const ex=t.closest('[data-aa-ex]');if(ex){aaAsk(ex.dataset.aaEx);return}
  if(t.closest('[data-aa-stop]')){AA.stop=true;if(AA.ac)AA.ac.abort();return}
  if(t.closest('[data-aa-retry]')){const q=AA.lastQ;const i=$('#aaQ');if(i&&i.value.trim()===q)i.value='';AA.err='';aaAsk(q);return}
  if(t.closest('[data-aa-new]')){if(AA.busy)return;AA.msgs=[];AA.err='';AA.lastQ='';aaSave();aaDraw();const q=$('#aaQ');if(q)q.focus();return}
  const cp=t.closest('[data-aa-copy]');if(cp){const x=aaExchanges()[Number(cp.dataset.aaCopy)];if(x&&x.a)copyText(aaPlain(x.a),'คัดลอกคำตอบแล้ว · วางใน LINE ได้เลย');return}
  const rf=t.closest('[data-aa-ref]');if(rf){const code=rf.dataset.aaRef;if(aaPhone())aaPanel(false);
    if(/^NCR-/.test(code)){const n=(S.ncr||[]).find(y=>y.ncrNo===code);goView('ncr');if(n&&typeof openNcr==='function')openNcr(n.id);else toast(`ไม่พบ ${code}`);return}
    qrHandle(code)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&AA.open&&!document.querySelector('dialog[open]'))aaPanel(false)});
window.addEventListener('resize',()=>{if(AA.open)document.body.classList.toggle('aa-lock',aaPhone())});
