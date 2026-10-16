'use strict';
/* BU1 Weekly Plan · ใบรับคำร้องขอรับบริการสอบเทียบ (user, 15 Oct 2026 — ISO 9001 project, stage 1: "Sale ส่งคำร้อง → Planner รับงาน (ออก PN No.) → กระจายเป็น Weekly";
   chose: the booking is the one source the daily plans are made from · in-app notices only)
   collection "jobs" ↔ app_settings rows bu1wp_job:<id> = {jobNo JB-YY-MMNNN, state pending | accepted | cancelled,
     customer, location, contact, contactTel, sale, jobType, jobTypeOther, line, wantFrom, wantTo, period, teamNeed, qty, poNo,
     detail, note, urgent, bookedAt / bookedBy (set by the system), planNo, acceptedAt / acceptedBy, acceptNote,
     review {at, by, ch:[[field, from, to]]} + reviewedAt / reviewedBy (Sale changed it after the PN; the Planner confirms),
     cancelReason, cancelledAt / cancelledBy, createdAt/By, updatedAt/By, history (ISO 9001)}.
   Plans made from a booking carry task.jobId (↔ data.bu1wp.jobId) and its PN. Status of each step: Delay / On Process / Timely. */
S.jobs=[];S.jobsReady=false;S.jbF={tab:'open',q:'',mine:false,ins:false};
/* the team's request form FLS-F-018 "ใบรับคำร้องขอรับบริการสอบเทียบ" (user, 15 Oct 2026: "ข้อมูลให้อ้างอิงตามไฟล์ที่แนบไป") */
const JB_SVC=[['inhouse','In-house calibration','สอบเทียบในห้องปฏิบัติการ'],['onsite','On-site calibration','สอบเทียบนอกสถานที่'],['mobile','Mobile calibration','รถสอบเทียบเคลื่อนที่']];
const JB_REPORTS=['Calibration certificate','Loop test transmitter report','Before calibration result','Input to flow computer (support technical data)','Gas meter calibration certificate','Configuration (support technical data)','Pressure / Temperature calibration certificate'];
const JB_METHODS=['1 · ISO 4185:1980 (Weighing Method)','2 · API Chapter 4 Section 5 (Master meter Method)','3 · DKD-R6-1 (Pressure)','4 · Comparison technique (Temperature)'];
const JB_WITNESS=[['customer','Customer'],['excise','Excise'],['wm','W&M'],['customs','Customs'],['other','Other']];
const JB_MATERIALS=['Blind plate','Blind flange','Gasket'];
const JB_OUTPUTS=['4-20 mA','Pulse','Frequency','HART','Modbus','Profibus'];
const JB_BY={flowlab:'BY FLOWLAB',customer:'BY CUSTOMER'};
const jbItemText=it=>[it.tag,it.product,it.type,it.size?it.size+'"':'',it.cls?'Class '+it.cls:'',it.range].filter(Boolean).join(' · ');
const JB_LABEL={svcType:'ความต้องการรับบริการ',customer:'ลูกค้า',address:'ที่อยู่',location:'สถานที่',contact:'ผู้ติดต่อ',contactTel:'เบอร์ติดต่อ',email:'Email',certSame:'ใบ Cert ใช้ข้อมูลเดียวกับลูกค้า',certName:'ชื่อบริษัทในใบ Cert',certAddress:'ที่อยู่ในใบ Cert',
  sale:'Sale',jobType:'หัวข้องาน',jobTypeOther:'หัวข้องาน (อื่นๆ)',line:'สายงาน',items:'รายการเครื่อง (UUT)',reports:'Require report',reportOther:'Require report (อื่นๆ)',materialBy:'Material',materials:'Material ที่ใช้',
  adjust:'Left FLOWLAB adjust to meter',adjustPoints:'จุดที่ปรับ (As found)',highPressure:'High Pressure Flow meter',installBy:'Disconnect & Install',disconnectDate:'วันที่ถอด',installDate:'วันที่ติดตั้ง',
  transportBy:'Transportation',receiveDate:'วันที่รับเครื่อง',returnDate:'วันที่ส่งคืน',
  wantFrom:'วันที่ลูกค้าต้องการ',wantTo:'ถึงวันที่',period:'ช่วงเวลา',teamNeed:'จำนวนคนที่ใช้',qty:'จำนวนเครื่อง / จุด',poNo:'เลขที่ PO / ใบเสนอราคา',detail:'รายละเอียดงาน',note:'หมายเหตุถึง Planner',urgent:'งานด่วน'};
const JB_FIELDS=Object.keys(JB_LABEL);
const JB_SHARED=['customer','location','contact','contactTel','sale'];
const JB_ITEM_F=['tag','product','type','size','cls','output','range','points','acc','interval','method','round','refer'];/* copied to the plans made from it when the Planner accepts a change */
const JB_STATE={pending:{th:'รอ Planner รับงาน',c:'var(--warn)'},accepted:{th:'รับงานแล้ว',c:'var(--good)'},cancelled:{th:'ยกเลิก',c:'var(--muted)'}};
const jbKpi=()=>Object.assign({acceptDays:1,urgentDays:3},(S.cfg&&S.cfg.jobKpi)||{});
const isPlanner=()=>can('master');/* ผู้ดูแลระบบ / ผู้วางแผน */
const canBook=()=>can('edit');
const jbById=id=>S.jobs.find(j=>j.id===id)||null;
/* Flow Meter only since 16 Oct 2026 (user: "ใบจองงาน ให้เน้นไปที่ flow meter เป็นหลัก"; chose Flow Meter only): new requests are line fm,
   no line choice; Instrument requests made before stay readable but are left out of the list, the tiles and the KPI unless asked for */
const jbIsIns=j=>!!j&&j.line==='ins';
const jbFmJobs=()=>S.jobs.filter(j=>!jbIsIns(j));
const jbNeedsReview=j=>!!j&&j.state==='accepted'&&!!j.review&&!j.reviewedAt;

/* ---------- time: working days are Mon–Sat without public holidays (isWorkDay, js/core/holidays.js) ---------- */
const day0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
/* the end of the n-th working day after d: the deadline to answer a booking */
function addWorkDays(d,n){let x=day0(d),k=0;while(k<n){x=addDays(x,1);if(isWorkDay(x))k++}return new Date(x.getFullYear(),x.getMonth(),x.getDate(),23,59,59)}
/* working days from date a to date b (b later = positive) */
function workDaysBetween(a,b){const s=day0(a),e=day0(b);if(e<=s)return -Math.round((s-e)/864e5);let n=0;for(let x=addDays(s,1);x<=e;x=addDays(x,1))if(isWorkDay(x))n++;return n}
const jbWhen=iso=>{const d=iso instanceof Date?iso:new Date(iso);return isNaN(d)?'—':`${fmtShort(d)} ${be(d)} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`};
const jbDur=ms=>{const m=Math.max(0,Math.round(ms/6e4));if(m<60)return `${m} นาที`;const h=Math.floor(m/60);if(h<24)return `${h} ชม.${m%60?` ${m%60} นาที`:''}`;const d=Math.floor(h/24);return `${d} วัน${h%24?` ${h%24} ชม.`:''}`};
const jbDue=j=>addWorkDays(new Date(j.bookedAt||j.createdAt||Date.now()),jbKpi().acceptDays);
/* lead time: working days from booking to the day the customer wants; short = กระชั้น */
const jbLead=j=>j.wantFrom&&j.bookedAt?workDaysBetween(new Date(j.bookedAt),parseD(j.wantFrom)):null;
const jbShort=j=>{const l=jbLead(j);return l!=null&&l<jbKpi().urgentDays};
const jbUrgent=j=>!!j&&(!!j.urgent||jbShort(j));

/* ---------- Delay / On Process / Timely (user: "ทุกระบบต้องมี สถานะ Delay / On Process / Timely") ---------- */
const FLOW={delay:{th:'Delay',sub:'ล่าช้า'},process:{th:'On Process',sub:'กำลังดำเนินการ'},timely:{th:'Timely',sub:'ทันเวลา'}};
const flowChip=f=>f?`<span class="jb-flow ${f[0]}" title="${esc(FLOW[f[0]].sub+(f[1]?' · '+f[1]:''))}">${FLOW[f[0]].th}</span>`:'';
/* the Planner's answer to a booking */
function acceptFlow(j){
  if(!j||j.state==='cancelled')return null;const due=jbDue(j);
  if(j.state==='pending')return Date.now()>due?['delay',`เลยกำหนดตอบรับ (${jbWhen(due)})`]:['process',`ตอบรับภายใน ${jbWhen(due)}`];
  const at=new Date(j.acceptedAt||0);const took=jbDur(at-new Date(j.bookedAt));
  return at<=due?['timely',`ตอบรับใน ${took}`]:['delay',`ตอบรับช้า · ใช้เวลา ${took}`];
}
/* one plan on its day */
function planFlow(t){
  if(!t||noStatus(t)||t.status==='cancelled')return null;const today=ymd(new Date());
  if(t.status==='done'){const d=t.doneAt?ymd(new Date(t.doneAt)):'';return d&&d>t.date?['delay',`ยืนยันเสร็จช้า (${fmtDay(d)})`]:['timely','เสร็จตามแผน']}
  if(t.status==='notdone')return ['delay','ไม่เสร็จ'];
  if(t.status==='postponed')return ['delay','เลื่อน'];
  return t.date<today?['delay','เลยวันแล้ว ยังไม่ปิดงาน']:['process',t.date===today?'ทำวันนี้':'รอวันทำงาน'];
}
/* the whole booking: answer → plans → work */
function jobFlow(j,plans){
  if(!j||j.state==='cancelled')return null;
  if(j.state==='pending')return acceptFlow(j);
  const ps=(plans||jbPlans(j)).filter(t=>t.status!=='cancelled');
  if(!ps.length)return j.wantFrom&&j.wantFrom<ymd(new Date())?['delay','ยังไม่ลงแผน · เลยวันที่ลูกค้าต้องการ']:['process','รับงานแล้ว · รอลงแผน'];
  const f=ps.map(planFlow).filter(Boolean);
  if(f.some(x=>x[0]==='delay'))return ['delay',f.find(x=>x[0]==='delay')[1]];
  if(f.length&&f.every(x=>x[0]==='timely'))return ['timely','ทุกแผนเสร็จตามแผน'];
  return ['process',`ลงแผนแล้ว ${ps.length} แผน`];
}

/* ---------- plans made from a booking ---------- */
function jbPlans(j){
  if(!j)return [];const m=new Map();
  S.tasks.concat([...known.values()],ALL.data||[]).forEach(t=>{if(t&&t.jobId===j.id)m.set(t.id,t)});
  return [...m.values()].sort(byTime);
}
/* read the plans of its PN from the database (any week), so the list is complete */
async function jbLoadPlans(j){
  if(!j||!j.planNo)return;
  try{(await Store.where('tasks','planNo','==',j.planNo)).forEach(t=>known.set(t.id,normTask(t)))}catch(e){}
}

/* ---------- numbers ---------- */
function nextJobNo(d){
  d=d||new Date();const pre=`JB-${String(d.getFullYear()).slice(-2)}-${pad(d.getMonth()+1)}`;
  const max=S.jobs.map(j=>String(j.jobNo||'')).filter(x=>x.startsWith(pre)).map(x=>Number(x.slice(pre.length))||0).reduce((a,b)=>Math.max(a,b),0);
  return pre+String(max+1).padStart(3,'0');
}
/* the next free PN-YY-MMNNN of a month (plans and bookings seen so far): a suggestion, the Planner may type another */
function nextPlanNo(date){
  const d=date?parseD(date):new Date();const pre=`PN-${String(d.getFullYear()).slice(-2)}-${pad(d.getMonth()+1)}`;
  const nos=S.tasks.concat([...known.values()],ALL.data||[]).map(t=>t&&t.planNo).concat(S.jobs.map(j=>j.planNo));
  const max=nos.map(x=>String(x||'')).filter(x=>x.startsWith(pre)).map(x=>Number(x.slice(pre.length))||0).reduce((a,b)=>Math.max(a,b),0);
  return pre+String(max+1).padStart(3,'0');
}

/* ---------- page ---------- */
const JB_TABS=[['open','ต้องดำเนินการ'],['pending','รอรับงาน'],['review','รอ review'],['noplan','รอลงแผน'],['planned','ลงแผนแล้ว'],['cancelled','ยกเลิก'],['all','ทั้งหมด']];
function jbTabOf(j){if(j.state==='cancelled')return 'cancelled';if(j.state==='pending')return 'pending';if(jbNeedsReview(j))return 'review';return jbPlans(j).length?'planned':'noplan'}
function jbMatch(j,tab){const t=jbTabOf(j);return tab==='all'||(tab==='open'?t==='pending'||t==='review'||t==='noplan':t===tab)}
function jbFiltered(){
  const q=norm(S.jbF.q);const me=String(S.me||'').toLowerCase();
  return S.jobs.filter(j=>jbMatch(j,S.jbF.tab)&&(S.jbF.ins||!jbIsIns(j))&&(!S.jbF.mine||String(j.bookedBy||'').toLowerCase()===me)
      &&(!q||norm([j.jobNo,j.planNo,j.customer,j.location,j.sale,j.detail,j.poNo,jbTypeName(j)].join(' ')).includes(q)))
    .sort((a,b)=>String(b.bookedAt||'').localeCompare(String(a.bookedAt||'')));
}
const jbTypeName=j=>j.jobType==='other'?(j.jobTypeOther||'อื่นๆ'):((jobTypes().find(t=>t.id===j.jobType)||{}).name||j.jobType||'—');
const jbWant=j=>j.wantFrom?(j.wantTo&&j.wantTo>j.wantFrom?`${fmtDay(j.wantFrom)} – ${fmtDay(j.wantTo)}`:fmtDay(j.wantFrom)):'—';
const jbStatePill=j=>{const s=JB_STATE[j.state]||JB_STATE.pending;return `<span class="ncr-st" style="--c:${s.c}">${esc(s.th)}</span>`};
function jbRow(j){
  const lead=jbLead(j);const ps=jbPlans(j);
  return `<tr data-job-open="${esc(j.id)}"><td><b class="mono">${esc(j.jobNo||'—')}</b><span class="sub">รับ ${esc(jbWhen(j.bookedAt))}</span></td>
    <td>${esc(j.customer||'—')}${j.location?`<span class="sub">${esc(j.location)}</span>`:''}</td>
    <td>${esc(jbTypeName(j))}${j.detail?`<span class="sub jb-clamp">${esc(j.detail)}</span>`:''}</td>
    <td class="num">${esc(jbWant(j))}${lead!=null?`<span class="sub${jbShort(j)?' bad':''}">${lead<0?'ส่งหลังวันงาน':`ล่วงหน้า ${lead} วันทำงาน`}</span>`:''}${jbUrgent(j)?'<span class="jb-urgent">ด่วน</span>':''}</td>
    <td>${esc(j.sale||'—')}</td>
    <td class="mono">${esc(j.planNo||'—')}${ps.length?`<span class="sub">${ps.length} แผน</span>`:''}</td>
    <td>${jbStatePill(j)}${jbNeedsReview(j)?'<span class="jb-rev">รอ review</span>':''}${flowChip(jobFlow(j,ps))}</td></tr>`;
}
function fillJobs(){
  const tb=$('#jbRows');if(!tb)return;const list=jbFiltered();
  tb.innerHTML=list.map(jbRow).join('')||`<tr><td colspan="7" class="hint">${S.jobs.length?'ไม่พบใบรับคำร้องที่ตรงกับตัวกรอง':'ยังไม่มีใบรับคำร้อง · Sale กด "+ ใบรับคำร้องใหม่" เพื่อส่งงานให้ Planner'}</td></tr>`;
  const c=$('#jbCount');if(c)c.textContent=`${list.length} ใบ`;
}
/* KPI of the bookings made in the last 90 days: answer time, answered in time, short-notice share — per Sale too */
function jbKpiRows(){
  const from=Date.now()-90*864e5;const list=jbFmJobs().filter(j=>j.state!=='cancelled'&&new Date(j.bookedAt||0).getTime()>=from);
  const one=l=>{const acc=l.filter(j=>j.acceptedAt);const ms=acc.map(j=>new Date(j.acceptedAt)-new Date(j.bookedAt));
    const ok=acc.filter(j=>new Date(j.acceptedAt)<=jbDue(j)).length;
    return {n:l.length,acc:acc.length,avg:ms.length?ms.reduce((a,b)=>a+b,0)/ms.length:null,ok,pct:acc.length?Math.round(ok/acc.length*100):null,short:l.filter(jbShort).length,urg:l.filter(jbUrgent).length}};
  const sales=[...new Set(list.map(j=>j.sale||'(ไม่ระบุ)'))].sort((a,b)=>a.localeCompare(b,'th'));
  return {all:one(list),sales:sales.map(s=>Object.assign({name:s},one(list.filter(j=>(j.sale||'(ไม่ระบุ)')===s))))};
}
function renderJobs(){
  if(notReady()||(S.mode==='live'&&!S.jobsReady))return loading();
  allTasks();/* every plan, so a booking knows its plans in any week */
  const FM=jbFmJobs();const insN=S.jobs.length-FM.length;
  const cnt=t=>FM.filter(j=>jbTabOf(j)===t).length;const late=FM.filter(j=>j.state==='pending'&&(acceptFlow(j)||[])[0]==='delay').length;
  const K=jbKpiRows();const k=jbKpi();
  const tile=(id,lbl,n,cls,note)=>`<button type="button" class="tile ncr-tile${cls?' '+cls:''}" data-jb-tab="${id}" aria-pressed="${S.jbF.tab===id}"><span class="lbl">${lbl}</span><span class="val">${n}<small>ใบ</small></span>${note?`<span class="note">${note}</span>`:''}</button>`;
  const pct=v=>v==null?'—':v+'%';
  return `<div class="sum">
    <div class="tiles">${tile('pending','รอ Planner รับงาน',cnt('pending'),late?'alert':cnt('pending')?'warnt':'',late?`Delay ${late} ใบ`:'')}${tile('review','Sale แก้ไข · รอ review',cnt('review'),cnt('review')?'alert':'')}${tile('noplan','รับแล้ว · รอลงแผน',cnt('noplan'),cnt('noplan')?'warnt':'')}${tile('planned','ลงแผนแล้ว',cnt('planned'))}${tile('all','ทั้งหมด',FM.length)}</div>
    <section class="panel span-12"><header><h2>ใบรับคำร้องขอรับบริการสอบเทียบ · Flow Meter <span class="md-count" id="jbCount"></span></h2><p>Sale ส่งคำร้อง (FLS-F-018) → Planner รับงาน (ออก PN) → ลงแผนรายวันสาย Flow Meter จากใบรับคำร้องเดียวกัน · รายการเครื่องเข้า Weekly plan calibration ให้เอง · กดแถวเพื่อเปิด</p></header>
      <div class="jb-tabs" role="tablist" aria-label="สถานะใบรับคำร้อง">${JB_TABS.map(([id,l])=>`<button type="button" role="tab" data-jb-tab="${id}" aria-selected="${S.jbF.tab===id}">${l}</button>`).join('')}</div>
      <div class="ncr-tools"><input type="search" id="jb-q" placeholder="ค้นหาเลขที่คำร้อง PN ลูกค้า สถานที่ Sale" value="${esc(S.jbF.q)}" autocomplete="off" aria-label="ค้นหาใบรับคำร้อง">
        <label class="jb-mine"><input type="checkbox" id="jb-mine"${S.jbF.mine?' checked':''}> เฉพาะที่ฉันส่ง</label>${insN?`<label class="jb-mine" title="ใบรับคำร้องสาย Instrument ที่ทำไว้ก่อนเปลี่ยนเป็น Flow Meter อย่างเดียว"><input type="checkbox" id="jb-ins"${S.jbF.ins?' checked':''}> แสดงใบ Instrument เดิม (${insN})</label>`:''}${canBook()?'<button type="button" class="btn primary" data-job-new>+ ใบรับคำร้องใหม่</button>':''}</div>
      <div class="scroll-x plain"><table class="mini ftab jb-tab"><thead><tr><th>เลขที่คำร้อง</th><th>ลูกค้า</th><th>งาน</th><th>วันที่ต้องการ</th><th>Sale</th><th>PN No.</th><th>สถานะ</th></tr></thead><tbody id="jbRows"></tbody></table></div></section>
    <section class="panel span-12"><header><h2>KPI การรับงาน · 90 วันล่าสุด</h2><p>เป้าหมาย: Planner ตอบรับภายใน ${k.acceptDays} วันทำงานหลังส่งคำร้อง · งานกระชั้น = ส่งล่วงหน้าน้อยกว่า ${k.urgentDays} วันทำงาน (ตั้งค่าที่ ข้อมูลหลัก › KPI ใบรับคำร้องขอรับบริการสอบเทียบ)</p></header>
      <div class="scroll-x plain"><table class="mini jb-kpi"><thead><tr><th>Sale</th><th>ใบรับคำร้อง</th><th>ตอบรับแล้ว</th><th>ตอบรับเฉลี่ย</th><th>ทันเวลา (Timely)</th><th>คำร้องกระชั้น</th><th>ด่วนทั้งหมด</th></tr></thead><tbody>
        ${K.sales.map(s=>`<tr><td>${esc(s.name)}</td><td class="num">${s.n}</td><td class="num">${s.acc}</td><td class="num">${s.avg==null?'—':jbDur(s.avg)}</td><td class="num">${pct(s.pct)}</td><td class="num">${s.short}</td><td class="num">${s.urg}</td></tr>`).join('')||'<tr><td colspan="7" class="hint">ยังไม่มีใบรับคำร้องใน 90 วันล่าสุด</td></tr>'}
        ${K.sales.length?`<tr class="tot"><td>รวม</td><td class="num">${K.all.n}</td><td class="num">${K.all.acc}</td><td class="num">${K.all.avg==null?'—':jbDur(K.all.avg)}</td><td class="num">${pct(K.all.pct)}</td><td class="num">${K.all.short}${K.all.n?` <small>(${Math.round(K.all.short/K.all.n*100)}%)</small>`:''}</td><td class="num">${K.all.urg}</td></tr>`:''}</tbody></table></div>
      <p class="hint jb-hint">ถ้างานกระชั้นมีสัดส่วนสูงต่อเนื่อง ใช้ตัวเลขนี้ประกอบการตัดสินใจ เช่น ควรมีคนสำรองรองานด่วนหรือไม่</p></section>
  </div>`;
}

/* ---------- the booking (dialog #jbDlg) ---------- */
let jbEdit=null;
function jbSaleOptions(cur){
  const sl=sales().map(s=>s.name);DEFAULT_SALES.forEach(n=>{if(!sl.some(x=>norm(x)===norm(n)))sl.push(n)});if(cur&&!sl.some(n=>norm(n)===norm(cur)))sl.push(cur);
  return `<option value="">— เลือก Sale —</option>`+sl.map(n=>`<option value="${esc(n)}"${norm(n)===norm(cur||'')?' selected':''}>${esc(n)}</option>`).join('');
}
/* Flow Meter job types first, then the ones used by both lines; Instrument-only types are not offered (a saved one stays selectable) */
function jbTypeOptions(cur){const fmFirst=(a,b)=>(a.line==='fm'?0:1)-(b.line==='fm'?0:1);
  return `<option value="">— เลือกหัวข้องาน —</option>`+activeTypes().filter(t=>!isLeaveId(t.id)&&t.line!=='ins').sort(fmFirst).concat(cur&&activeTypes().some(t=>t.id===cur&&t.line==='ins')?[activeTypes().find(t=>t.id===cur)]:[]).concat(cur&&!activeTypes().some(t=>t.id===cur)&&jobTypes().find(t=>t.id===cur)?[jobTypes().find(t=>t.id===cur)]:[]).map(t=>`<option value="${esc(t.id)}"${t.id===cur?' selected':''}>${esc(t.name)}</option>`).join('')}
function openJob(id){
  const j=id?jbById(id):null;if(id&&!j)return;
  const ed=j?j.state!=='cancelled'&&canBook():canBook();const dis=ed?'':' disabled';
  const v=Object.assign({svcType:'inhouse',period:'full',sale:'',line:'fm',certSame:true,materialBy:'',installBy:'',transportBy:'',adjust:''},j||{});
  /* line: Flow Meter for every new request; an older one keeps what it had (Instrument requests stay Instrument) */
  jbEdit={id:j?j.id:null,line:j?(j.line||''):'fm',items:(Array.isArray(v.items)&&v.items.length?v.items:[{product:'Flowmeter'}]).map(x=>Object.assign({id:x.id||newId('u'),witness:[]},x)),ed};
  const f=(k,label,html,cls)=>`<div class="field${cls?' '+cls:''}"><label for="jb-${k}">${label}</label>${html}</div>`;
  const inp=(k,attrs)=>`<input id="jb-${k}" name="${k}" value="${esc(v[k]==null?'':v[k])}"${attrs||''}${dis}>`;
  const rad=(k,list)=>`<div class="jb-rad" role="radiogroup">${list.map(([val,l,sub])=>`<label><input type="radio" name="jb-${k}" value="${val}"${v[k]===val?' checked':''}${dis}><span>${esc(l)}${sub?`<small>${esc(sub)}</small>`:''}</span></label>`).join('')}</div>`;
  const chk=(k,list)=>`<div class="jb-chk">${list.map(x=>`<label><input type="checkbox" data-jbchk="${k}" value="${esc(x)}"${(v[k]||[]).includes(x)?' checked':''}${dis}><span>${esc(x)}</span></label>`).join('')}</div>`;
  const hist=S.tasks.concat(ALL.data||[...known.values()]);const opt=list=>[...new Set(list.map(x=>String(x||'').trim()).filter(Boolean))].slice(0,400).map(c=>`<option value="${esc(c)}">`).join('');
  $('#jbTitle').textContent=j?`${j.jobNo} · ${j.customer||''}`:'ใบรับคำร้องขอรับบริการสอบเทียบ · ใบใหม่';
  $('#jbSub').textContent=j?`${(JB_STATE[j.state]||JB_STATE.pending).th}${j.planNo?' · Request No. '+j.planNo:''} · รับคำร้องเมื่อ ${jbWhen(j.bookedAt)}`:'ใบรับคำร้องขอรับบริการสอบเทียบ (FLS-F-018) · ระบบบันทึกวัน-เวลาที่ส่งคำร้องให้อัตโนมัติ แล้วส่งให้ Planner รับงาน';
  $('#jbBody').innerHTML=`${j?jbStatusHtml(j):''}${j&&jbNeedsReview(j)?jbReviewHtml(j):''}${j&&j.state==='pending'&&isPlanner()?jbAcceptHtml(j):''}
    <fieldset class="jb-sec"><legend>ส่วนที่ 1 · สำหรับ Sale · ข้อมูลลูกค้า</legend>
      ${f('svcType','ความต้องการรับบริการ <b class="req">*</b>',rad('svcType',JB_SVC),'wide')}
      <div class="ncr-grid jb-grid">
        ${f('customer','บริษัท / ลูกค้า (Customer) <b class="req">*</b>',inp('customer',' list="jb-dl-cust" maxlength="120"'))}
        ${f('sale','Contact Sale <b class="req">*</b>',`<select id="jb-sale" name="sale"${dis}>${jbSaleOptions(v.sale)}</select>`)}
        ${f('address','ที่อยู่ (Address)',inp('address',' maxlength="300"'),'wide')}
        ${f('location','สถานที่ทำงาน / Plant <b class="req">*</b>',inp('location',' list="jb-dl-loc" maxlength="120"'))}
        ${f('contact','ผู้ติดต่อ (Contact)',inp('contact',' maxlength="80"'))}
        ${f('contactTel','โทรศัพท์ (Tel)',inp('contactTel',' maxlength="40" inputmode="tel"'))}
        ${f('email','Email',inp('email',' maxlength="120" type="email"'))}
        ${f('poNo','เลขที่ PO / ใบเสนอราคา',inp('poNo',' maxlength="60"'))}
        <div class="field wide"><label class="jb-urg"><input type="checkbox" id="jb-certSame"${v.certSame!==false?' checked':''}${dis}> ใบ Cert ใช้ชื่อบริษัท / ที่อยู่เดียวกับด้านบน (As above)</label></div>
        <div class="field wide jb-cert"${v.certSame!==false?' hidden':''}><div class="ncr-grid jb-grid">${f('certName','ชื่อบริษัทในใบ Cert (ภาษาอังกฤษตัวพิมพ์ใหญ่)',inp('certName',' maxlength="160"'))}${f('certAddress','ที่อยู่ในใบ Cert',inp('certAddress',' maxlength="300"'))}</div></div>
      </div></fieldset>
    <fieldset class="jb-sec"><legend>รายการเครื่องที่ส่งสอบเทียบ (UUTs List and Calibration Requirements)</legend><div id="jbItems">${jbItemsHtml()}</div>
      ${ed?'<button type="button" class="btn sm" data-jbit-add>+ เพิ่มเครื่อง</button>':''}<small class="hint">แต่ละเครื่องจะเป็นต้นทางของ Check Sheet (QC LAB · Data Flow Meter · Remove-Reinstall) ไม่ต้องกรอกซ้ำ</small></fieldset>
    <fieldset class="jb-sec"><legend>ความต้องการเพิ่มเติม</legend><div class="ncr-grid jb-grid">
      ${f('reports','Require report',chk('reports',JB_REPORTS)+inp('reportOther',' maxlength="120" placeholder="อื่นๆ (ระบุ)"'),'wide')}
      ${f('materialBy','Material',rad('materialBy',Object.entries(JB_BY))+chk('materials',JB_MATERIALS))}
      ${f('adjust','Left FLOWLAB adjust to meter',rad('adjust',[['accept','ACCEPT'],['notaccept','NOT ACCEPT']])+inp('adjustPoints',' maxlength="120" placeholder="As found / Points"'))}
      ${f('installBy','Disconnect & Install',rad('installBy',Object.entries(JB_BY))+`<div class="jb-2">${inp('disconnectDate',' type="date" title="วันที่ถอด"')}${inp('installDate',' type="date" title="วันที่ติดตั้ง"')}</div><small class="hint">วันที่ถอด · วันที่ติดตั้ง</small>`)}
      ${f('transportBy','Transportation / Receive & Return',rad('transportBy',Object.entries(JB_BY))+`<div class="jb-2">${inp('receiveDate',' type="date" title="วันที่รับเครื่อง"')}${inp('returnDate',' type="date" title="วันที่ส่งคืน"')}</div><small class="hint">วันที่รับเครื่อง · วันที่ส่งคืน</small>`)}
      <div class="field"><label class="jb-urg"><input type="checkbox" id="jb-highPressure"${v.highPressure?' checked':''}${dis}> High Pressure Flow meter</label></div>
    </div></fieldset>
    <fieldset class="jb-sec"><legend>สำหรับวางแผน</legend><div class="ncr-grid jb-grid">
      ${f('jobType','หัวข้องาน <b class="req">*</b>',`<select id="jb-jobType" name="jobType"${dis}>${jbTypeOptions(v.jobType)}</select>`)}
      ${f('jobTypeOther','หัวข้องาน (ถ้าเลือก อื่นๆ)',inp('jobTypeOther',' maxlength="80"'))}
      <div class="field"><span class="lbl">สายงาน</span><span class="jb-line${jbIsIns(v)?' ins':''}">${jbIsIns(v)?'Instrument · ใบเดิม (ก่อนเปลี่ยนเป็น Flow Meter อย่างเดียว)':jbEdit.line==='fm'?'Flow Meter':'Flow Meter / ทั้งสองสาย · ใบเดิม'}</span></div>
      ${f('teamNeed','จำนวนคนที่ใช้ (ประมาณ)',`<input id="jb-teamNeed" name="teamNeed" type="number" min="0" max="50" value="${v.teamNeed>0?v.teamNeed:''}"${dis}>`)}
      ${f('wantFrom','วันที่ลูกค้าต้องการ <b class="req">*</b>',inp('wantFrom',' type="date"'))}
      ${f('wantTo','ถึงวันที่ (งานหลายวัน)',inp('wantTo',' type="date"'))}
      ${f('period','ช่วงเวลา',`<select id="jb-period" name="period"${dis}>${PERIODS.map(p=>`<option value="${p.id}"${(v.period||'full')===p.id?' selected':''}>${esc(p.name)}</option>`).join('')}</select>`)}
      <div class="field"><label class="jb-urg"><input type="checkbox" id="jb-urgent" name="urgent"${v.urgent?' checked':''}${dis}> งานด่วน (ลูกค้าขอเร่ง)</label><small class="hint">ระบบนับ "คำร้องกระชั้น" เองเมื่อส่งล่วงหน้าน้อยกว่า ${jbKpi().urgentDays} วันทำงาน</small></div>
      ${f('detail','รายละเอียดงาน / ขอบเขต (Scope) <b class="req">*</b>',`<textarea id="jb-detail" name="detail" rows="4" maxlength="3000" placeholder="เช่น Switch Flowmeter Coriolis · Remove → Cal ที่ Lab → Install คืน · ต้องมี Work Permit"${dis}>${esc(v.detail||'')}</textarea>`,'wide')}
      ${f('note','หมายเหตุถึง Planner',`<textarea id="jb-note" name="note" rows="2" maxlength="1000" placeholder="เช่น ลูกค้าขอทีมเดิม · ต้องเข้าก่อน 08.00 น."${dis}>${esc(v.note||'')}</textarea>`,'wide')}
    </div></fieldset>
    <datalist id="jb-dl-cust">${opt(hist.map(x=>x.customer).concat(S.jobs.map(x=>x.customer)))}</datalist><datalist id="jb-dl-loc">${opt(hist.map(x=>x.location).concat(S.jobs.map(x=>x.location)))}</datalist>
    <datalist id="jb-dl-out">${JB_OUTPUTS.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
    ${j&&j.state==='accepted'?jbPlansHtml(j):''}
    ${j&&typeof csJobHtml==='function'?csJobHtml(j):''}
    ${j&&j.state!=='cancelled'&&canBook()?`<details class="jb-cancel"><summary>ยกเลิกใบรับคำร้องนี้</summary><div class="field"><label for="jb-cancelWhy">เหตุผลที่ยกเลิก</label><textarea id="jb-cancelWhy" rows="2" maxlength="500" placeholder="เช่น ลูกค้ายกเลิกงาน · เลื่อนไม่มีกำหนด"></textarea></div><button type="button" class="btn danger sm" data-job-cancel>ยืนยันยกเลิกใบรับคำร้อง</button></details>`:''}
    ${j&&j.state==='cancelled'?`<div class="reason-box cancelled"><b>ยกเลิกเมื่อ ${esc(jbWhen(j.cancelledAt))}${j.cancelledBy?' โดย '+esc(String(j.cancelledBy).split('@')[0]):''}</b><span>${esc(j.cancelReason||'—')}</span></div>`:''}
    ${j?isoHistoryHtml(j):''}
    <p class="form-err" id="jbErr" hidden></p>`;
  $('#jbSave').hidden=!ed;$('#jbSave').textContent=j?'บันทึกใบรับคำร้อง':'ส่งใบรับคำร้องให้ Planner';$('#jbDel').hidden=!j||!can('del');$('#jbPrint').hidden=!j;$('#jbPdf').hidden=!j;
  const ns=j?jbSheets(j).length:0;$('#jbPdfAll').hidden=!ns;$('#jbPdfAll').textContent=`PDF ทั้งชุด (${ns+1} ใบ)`;
  const d=$('#jbDlg');if(!d.open)d.showModal();
  if(j&&j.state==='accepted')jbLoadPlans(j).then(()=>{if(jbEdit&&jbEdit.id===j.id){const b=$('#jbPlans');if(b)b.outerHTML=jbPlansHtml(jbById(j.id)||j)}});
  setTimeout(()=>{const x=$('#jb-customer');if(x&&ed&&!j)x.focus()},40);
}
/* the UUT rows of FLS-F-018: one card per meter */
function jbItemsHtml(){
  const ed=jbEdit&&jbEdit.ed;const dis=ed?'':' disabled';const L=jbEdit?jbEdit.items:[];
  const c=(i,k,label,attrs,cls)=>`<label class="${cls||''}"><span>${label}</span><input data-jbit="${i}|${k}" value="${esc(L[i][k]||'')}"${attrs||''}${dis}></label>`;
  return L.map((it,i)=>`<div class="jb-item"><div class="jb-ih"><b>ITEM ${i+1}</b>${it.tag?`<span>${esc(jbItemText(it))}</span>`:''}${ed&&L.length>1?`<button type="button" class="ph-x2" data-jbit-del="${i}" aria-label="ลบเครื่องที่ ${i+1}">×</button>`:''}</div>
    <div class="jb-ig">${c(i,'tag','TAG No. *',' maxlength="60" class="mono"')}${c(i,'product','Product',' maxlength="60" placeholder="Flowmeter"')}
      <label class="w2"><span>Type (Flowmeter)</span><select data-jbit="${i}|type"${dis}><option value="">—</option>${CAL_TYPES.filter(x=>x!=='None').concat(it.type&&!CAL_TYPES.includes(it.type)?[it.type]:[]).map(x=>`<option${x===it.type?' selected':''}>${esc(x)}</option>`).join('')}</select></label>
      <label><span>Size (inch)</span><select data-jbit="${i}|size"${dis}><option value="">—</option>${CAL_SIZES.map(s=>s.replace(/"$/,'')).concat(it.size&&!CAL_SIZES.some(s=>s.replace(/"$/,'')===it.size)?[it.size]:[]).map(s=>`<option value="${esc(s)}"${s===String(it.size||'')?' selected':''}>${esc(s)}"</option>`).join('')}</select></label>
      ${c(i,'cls','Class',' maxlength="12" placeholder="150#"')}${c(i,'output','Output signal',' maxlength="40" list="jb-dl-out"')}
      ${c(i,'range','Flow range',' maxlength="60" placeholder="0–136,080 kg/h"','w2')}${c(i,'points','Calibration point',' maxlength="120" placeholder="@ 1500, 2500, 3000 … kg/h"','w2')}
      ${c(i,'acc','ความถูกต้อง (±) Accuracy',' maxlength="20"')}${c(i,'interval','Calibration interval',' maxlength="20" placeholder="1 ปี"')}
      <label class="w2"><span>Method</span><select data-jbit="${i}|method"${dis}><option value="">—</option>${JB_METHODS.map((m,k)=>`<option value="${k+1}"${String(it.method)===String(k+1)?' selected':''}>${esc(m)}</option>`).join('')}</select></label>
      <label><span>Round</span><select data-jbit="${i}|round"${dis}><option value="">—</option>${CAL_ROUNDS.concat(it.round&&!CAL_ROUNDS.includes(it.round)?[it.round]:[]).map(r=>`<option${r===it.round?' selected':''}>${esc(r)}</option>`).join('')}</select></label>
      ${c(i,'refer','Refer Job No.',' maxlength="40"')}
      <div class="jb-wit w2"><span>Witness</span>${JB_WITNESS.map(([k,l])=>`<label><input type="checkbox" data-jbitw="${i}|${k}"${(it.witness||[]).includes(k)?' checked':''}${dis}>${l}</label>`).join('')}</div></div></div>`).join('');
}function jbStatusHtml(j){
  const af=acceptFlow(j);const lead=jbLead(j);
  const who=b=>b?esc(String(b).split('@')[0]):'—';
  return `<div class="jb-steps">
    <div class="jb-step done"><b>1 · Sale ส่งคำร้อง</b><span>${esc(jbWhen(j.bookedAt))} · ${who(j.bookedBy)}</span>${lead!=null?`<span class="${jbShort(j)?'bad':''}">${lead<0?'ส่งหลังวันที่ลูกค้าต้องการ':`ส่งล่วงหน้า ${lead} วันทำงาน`}${jbUrgent(j)?' · <b class="jb-urgent">ด่วน</b>':''}</span>`:''}</div>
    <div class="jb-step${j.state==='accepted'?' done':j.state==='pending'?' now':''}"><b>2 · Planner รับงาน · ออก PN</b>${j.acceptedAt?`<span>${esc(jbWhen(j.acceptedAt))} · ${who(j.acceptedBy)} · <b class="mono">${esc(j.planNo||'')}</b></span>`:`<span>${j.state==='cancelled'?'—':'รอ Planner'}</span>`}${flowChip(af)}${j.acceptNote?`<span class="sub">📝 ${esc(j.acceptNote)}</span>`:''}</div>
    <div class="jb-step${jbPlans(j).length?' done':j.state==='accepted'?' now':''}"><b>3 · ลงแผนรายวัน (Weekly)</b><span>${jbPlans(j).length?`${jbPlans(j).length} แผน`:'ยังไม่ลงแผน'}</span>${j.state==='accepted'?flowChip(jobFlow(j)):''}</div>
  </div>`;
}
function jbReviewHtml(j){
  const r=j.review||{};
  return `<div class="jb-review"><b>⚠ Sale แก้ไขใบรับคำร้องหลังออก PN แล้ว · รอ Planner review และปรับแผน</b><span>แก้เมื่อ ${esc(jbWhen(r.at))} โดย ${esc(String(r.by||'—').split('@')[0])}</span>
    <ul>${(r.ch||[]).map(([k,a,b])=>`<li><b>${esc(JB_LABEL[k]||k)}</b> <s>${esc(a||'—')}</s> → ${esc(b||'—')}</li>`).join('')}</ul>
    ${isPlanner()?`<div class="v-row"><button type="button" class="btn primary sm" data-job-review="push">รับทราบ + อัปเดตแผนที่ลงไว้</button><button type="button" class="btn sm" data-job-review="ok">รับทราบ (ปรับแผนเอง)</button></div><small class="hint">"อัปเดตแผน" คัดลอก ${JB_SHARED.map(k=>JB_LABEL[k]).join(' · ')} ที่เปลี่ยนไปใส่ทุกแผนของใบรับคำร้องนี้ · วันที่ คน และรายละเอียดรายวันให้ปรับเองในแผน</small>`:'<small class="hint">Planner จะเห็นรายการนี้ในหน้าใบรับคำร้องขอรับบริการสอบเทียบ (ป้าย "รอ review")</small>'}</div>`;
}
function jbAcceptHtml(j){
  return `<div class="jb-accept"><b>Planner รับงาน · ออก PN No.</b><div class="jb-acc-row"><input id="jb-pn" class="mono" maxlength="40" value="${esc(j.planNo||nextPlanNo(j.wantFrom))}" aria-label="PN No." placeholder="PN-YY-MMNNN">
    <input id="jb-accNote" maxlength="300" placeholder="หมายเหตุถึง Sale (ไม่บังคับ) เช่น รับได้วันที่ 20 แทน" aria-label="หมายเหตุถึง Sale"><button type="button" class="btn primary" data-job-accept>รับงาน · ออก PN</button></div>
    <small class="hint">ระบบเสนอเลขถัดไปของเดือนที่ลูกค้าต้องการ แก้ได้ · การออก PN = ยืนยันว่ารับทราบ / รับงานแล้ว และบันทึกเวลาตอบรับ</small></div>`;
}
function jbPlansHtml(j){
  const ps=jbPlans(j);
  return `<div class="jb-plans" id="jbPlans"><div class="jb-ph"><b>แผนรายวันจากใบรับคำร้องนี้ (${ps.length})</b>${S.canWrite?'<button type="button" class="btn sm primary" data-job-plan>+ ลงแผนรายวัน</button>':''}</div>
    ${ps.length?`<ul>${ps.map(t=>`<li><button type="button" class="jb-pl" data-edit="${esc(t.id)}"><span class="num">${esc(fmtDay(t.date))} · ${esc(pName(t))}</span><span>${esc(typeLabel(t))}${(t.staffIds||[]).length?' · '+esc(teamNames(t).join(', ')):' · ยังไม่จัดคน'}</span>${noStatus(t)?'':`<span class="ncr-st" style="--c:${(STATUS[t.status]||STATUS.planned).color}">${esc(stTh(t.status))}</span>`}${flowChip(planFlow(t))}</button></li>`).join('')}</ul>`
      :'<p class="hint">ยังไม่ลงแผน · กด "+ ลงแผนรายวัน" ระบบนำข้อมูลจากใบรับคำร้องไปกรอกในแผนให้ (ลูกค้า สถานที่ ผู้ติดต่อ Sale รายละเอียด PN วันที่) ไม่ต้องพิมพ์ซ้ำ</p>'}</div>`;
}
function jbErr(m){const e=$('#jbErr');if(e){e.textContent=m||'';e.hidden=!m}}
function jbRead(){
  const g=k=>{const el=$('#jb-'+k);return el?String(el.value||'').trim():''};
  const r=k=>(document.querySelector(`input[name="jb-${k}"]:checked`)||{}).value||'';
  const c=k=>[...document.querySelectorAll(`[data-jbchk="${k}"]:checked`)].map(x=>x.value);
  const items=(jbEdit?jbEdit.items:[]).map(it=>{const o={id:it.id,witness:(it.witness||[]).slice()};JB_ITEM_F.forEach(k=>{o[k]=String(it[k]||'').trim()});return o})
    .filter(it=>JB_ITEM_F.some(k=>it[k]&&!(k==='product'&&it[k]==='Flowmeter'))||it.witness.length);/* a row with only the default Product is an unused row */
  const certSame=!!($('#jb-certSame')||{}).checked;
  return {svcType:r('svcType'),customer:g('customer'),address:g('address'),location:g('location'),contact:g('contact'),contactTel:g('contactTel'),email:g('email'),sale:g('sale'),poNo:g('poNo'),
    certSame,certName:certSame?'':g('certName'),certAddress:certSame?'':g('certAddress'),items,qty:items.length?`${items.length} เครื่อง`:'',
    reports:c('reports'),reportOther:g('reportOther'),materialBy:r('materialBy'),materials:c('materials'),adjust:r('adjust'),adjustPoints:g('adjustPoints'),highPressure:!!($('#jb-highPressure')||{}).checked,
    installBy:r('installBy'),disconnectDate:g('disconnectDate'),installDate:g('installDate'),transportBy:r('transportBy'),receiveDate:g('receiveDate'),returnDate:g('returnDate'),
    jobType:g('jobType'),jobTypeOther:g('jobTypeOther'),line:jbEdit?jbEdit.line:'fm',wantFrom:g('wantFrom'),wantTo:g('wantTo'),period:g('period')||'full',teamNeed:Math.max(0,Math.floor(Number(g('teamNeed'))||0)),
    detail:g('detail'),note:g('note'),urgent:!!($('#jb-urgent')||{}).checked};
}
const jbText=(k,v)=>Array.isArray(v)?(k==='items'?v.map(it=>it.tag||'?').join(', '):v.join(', ')):v===true?'ใช่':v===false?'ไม่':k==='svcType'?((JB_SVC.find(x=>x[0]===v)||[])[1]||v||''):(k==='materialBy'||k==='installBy'||k==='transportBy')?(JB_BY[v]||''):k==='adjust'?(v==='accept'?'ACCEPT':v==='notaccept'?'NOT ACCEPT':''):
  k==='jobType'?jbTypeName({jobType:v}):k==='line'?(LINE[v]?LINE[v].name:'ทั้งสองสาย'):k==='period'?((PERIOD[v]||{}).name||v):/(Date|wantFrom|wantTo)$/.test(k)&&v?fmtDay(v):String(v==null||v===0?'':v);
/* a change in the meters list reads as the tags plus what changed in them */
const jbItemsKey=l=>(l||[]).map(it=>JB_ITEM_F.map(k=>it[k]||'').join('|')+'|'+(it.witness||[]).join(',')).join('#');async function saveJob(){
  if(!jbEdit||!canBook())return;const v=jbRead();
  const need=[['svcType','เลือกความต้องการรับบริการ (In-house / On-site / Mobile)'],['customer','ใส่ชื่อลูกค้า'],['location','ใส่สถานที่'],['sale','เลือก Sale'],['jobType','เลือกหัวข้องาน'],['wantFrom','เลือกวันที่ลูกค้าต้องการ'],['detail','ใส่รายละเอียดงาน / ขอบเขต']].find(([k])=>!v[k]);
  {const bad=v.items.findIndex(it=>!it.tag);if(bad>=0){jbErr(`ใส่ TAG No. ของเครื่องที่ ${bad+1} (หรือลบแถวที่ไม่ใช้)`);const el=document.querySelector(`[data-jbit="${bad}|tag"]`);if(el)el.focus();return}}
  if(need){jbErr(need[1]);const el=$('#jb-'+need[0]);if(el)el.focus();return}
  if(v.jobType==='other'&&!v.jobTypeOther){jbErr('พิมพ์ชื่อหัวข้องาน (อื่นๆ)');$('#jb-jobTypeOther').focus();return}
  if(v.wantTo&&v.wantTo<v.wantFrom){jbErr('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');$('#jb-wantTo').focus();return}
  const id=jbEdit.id||newId('jb');const old=jbById(id);const now=new Date().toISOString();
  const data=Object.assign({},old||{},v,{updatedAt:now,updatedBy:S.me||null});delete data.id;
  if(!old)Object.assign(data,{jobNo:nextJobNo(),state:'pending',bookedAt:now,bookedBy:S.me||null,createdAt:now,createdBy:S.me||null});
  /* a change after the PN by someone who is not the Planner: the Planner reviews it (user: "ต้องแจ้ง Planner ให้ review และปรับแผน") */
  let rev=false;
  if(old&&old.state==='accepted'&&!isPlanner()){
    const ch=JB_FIELDS.filter(k=>k==='items'?jbItemsKey(old.items)!==jbItemsKey(v.items):String(jbText(k,old[k]))!==String(jbText(k,v[k]))).map(k=>[k,jbText(k,old[k]),jbText(k,v[k])]);
    if(ch.length){const prev=jbNeedsReview(old)?(old.review.ch||[]):[];data.review={at:now,by:S.me||null,ch:prev.filter(p=>!ch.some(c=>c[0]===p[0])).concat(ch)};data.reviewedAt='';data.reviewedBy='';rev=true}
  }
  const btn=$('#jbSave');btn.disabled=true;
  try{await Store.set('jobs',id,data);jbEdit.saved=true;$('#jbDlg').close();if(!old)jbDoneAsk(Object.assign({id},data));
    toast(old?(rev?`บันทึก ${data.jobNo} แล้ว · แจ้ง Planner ให้ review การแก้ไขแล้ว`:`บันทึก ${data.jobNo} แล้ว`):`ส่งใบรับคำร้อง ${data.jobNo} ให้ Planner แล้ว · รับคำร้องเมื่อ ${jbWhen(now)}`)}
  catch(err){jbErr(errText(err));noteWriteError(err)}
  finally{btn.disabled=false}
}
async function acceptJob(){
  const j=jbEdit&&jbById(jbEdit.id);if(!j||!isPlanner()||j.state!=='pending')return;
  const pn=cleanPlan(($('#jb-pn')||{}).value);
  if(!PLAN_RE.test(pn)){jbErr('PN No. ต้องเป็นรูปแบบ PN-YY-MMNNN เช่น PN-26-10015');$('#jb-pn').focus();return}
  const dup=S.jobs.find(o=>o.id!==j.id&&o.planNo===pn&&o.state!=='cancelled');if(dup){jbErr(`PN ${pn} ใช้กับใบรับคำร้อง ${dup.jobNo} แล้ว`);$('#jb-pn').focus();return}
  const now=new Date().toISOString();const note=String(($('#jb-accNote')||{}).value||'').trim().slice(0,300);
  try{await Store.update('jobs',j.id,{state:'accepted',planNo:pn,acceptedAt:now,acceptedBy:S.me||null,acceptNote:note,updatedAt:now,updatedBy:S.me||null});
    const f=acceptFlow(Object.assign({},j,{state:'accepted',acceptedAt:now}));
    toast(`รับงาน ${j.jobNo} · ออก ${pn} แล้ว · ${FLOW[f[0]].th} (${f[1]})`);openJob(j.id)}
  catch(err){jbErr(errText(err));noteWriteError(err)}
}
async function reviewJob(push){
  const j=jbEdit&&jbById(jbEdit.id);if(!j||!isPlanner()||!jbNeedsReview(j))return;
  const keys=[...new Set((j.review.ch||[]).map(c=>c[0]))].filter(k=>JB_SHARED.includes(k));let n=0;
  try{
    if(push&&keys.length){await jbLoadPlans(j);for(const t of jbPlans(j)){const ch={};keys.forEach(k=>{if((t[k]||'')!==(j[k]||''))ch[k]=j[k]||''});
      if(Object.keys(ch).length){await Store.update('tasks',t.id,Object.assign(ch,meta()));n++}}}
    const now=new Date().toISOString();await Store.update('jobs',j.id,{reviewedAt:now,reviewedBy:S.me||null,updatedAt:now,updatedBy:S.me||null});
    toast(push?(n?`รับทราบแล้ว · อัปเดต ${n} แผน`:'รับทราบแล้ว · แผนไม่ต้องเปลี่ยน'):'รับทราบการแก้ไขแล้ว · อย่าลืมปรับแผนที่เกี่ยวข้อง');openJob(j.id)}
  catch(err){jbErr(errText(err));noteWriteError(err)}
}
async function cancelJob(){
  const j=jbEdit&&jbById(jbEdit.id);if(!j||!canBook()||j.state==='cancelled')return;
  const why=String(($('#jb-cancelWhy')||{}).value||'').trim();if(!why){jbErr('ใส่เหตุผลที่ยกเลิก');$('#jb-cancelWhy').focus();return}
  const n=jbPlans(j).filter(t=>t.status!=='cancelled').length;
  if(!await askConfirm('ยกเลิกใบรับคำร้อง?',`ยกเลิก ${j.jobNo} · ${j.customer}${n?`\nแผนที่ลงไว้ ${n} แผน ยังอยู่ — ตั้งสถานะ "ยกเลิก" ที่แผนเองถ้าไม่ทำแล้ว`:''}`,'ยกเลิกใบรับคำร้อง'))return;
  const now=new Date().toISOString();
  try{await Store.update('jobs',j.id,{state:'cancelled',cancelReason:why,cancelledAt:now,cancelledBy:S.me||null,updatedAt:now,updatedBy:S.me||null});$('#jbDlg').close();toast(`ยกเลิก ${j.jobNo} แล้ว`)}
  catch(err){jbErr(errText(err));noteWriteError(err)}
}
async function deleteJob(btn){
  const j=jbEdit&&jbById(jbEdit.id);if(!j||!can('del'))return;
  if(!arm(btn,'job:'+j.id,'ลบใบรับคำร้อง','กดอีกครั้งเพื่อลบใบรับคำร้อง'))return;
  try{await Store.del('jobs',j.id);$('#jbDlg').close();toast(`ลบ ${j.jobNo} แล้ว · แผนที่ลงไว้ยังอยู่`)}catch(err){jbErr(errText(err));noteWriteError(err)}
}
/* + ลงแผนรายวัน: the plan form filled from the booking (user: "แต่ละทีมวางแผนต่อจากข้อมูลต้นทางชุดเดียวกัน") */
function planFromJob(){
  const j=jbEdit&&jbById(jbEdit.id);if(!j||!S.canWrite||j.state!=='accepted')return;
  $('#jbDlg').close();openTask(null,{job:j,date:j.wantFrom&&j.wantFrom>=ymd(addDays(new Date(),-60))?j.wantFrom:ymd(new Date()),type:j.jobType,customer:j.customer,line:j.line,period:j.period});
}
/* FLS-F-018 printed from the booking (A4 landscape, the team's own layout) */
function jbPrintForm(j){csOpenPrint(jbPrintHtml(j),`${j.planNo||j.jobNo}_FLS-F-018.html`)}
/* PDF files (js/features/pdf-export.js): the booking alone, or the booking + every Check Sheet of it in one file (user, 15 Oct 2026) */
const jbPdfDoc=j=>({html:jbPrintHtml(j),orient:'l',foot:`FLS-F-018 · ${j.planNo||j.jobNo}`});
const CS_ORDER=['qc','data','rr','sr'];
function jbSheets(j){
  const idx=id=>{const i=(j.items||[]).findIndex(it=>it.id===id);return i<0?999:i};
  return (S.checks||[]).filter(c=>c.state!=='rejected'&&(c.jobId===j.id||c.itemId&&(j.items||[]).some(it=>it.id===c.itemId)))
    .sort((a,b)=>CS_ORDER.indexOf(a.form)-CS_ORDER.indexOf(b.form)||idx(a.itemId)-idx(b.itemId)||String(a.no).localeCompare(String(b.no)));
}
/* print / PDF from what is on the screen (user, 16 Oct 2026: "พิมพ์ pdf ได้ หลังจากกรอกข้อมูล"): the stored request with the form's
   current values on top, so edits print before they are saved; a read-only request prints as stored */
function jbOnScreen(){
  const j=jbEdit&&jbById(jbEdit.id);if(!j)return null;
  return jbEdit.ed&&$('#jbDlg').open?Object.assign({},j,jbRead(),{id:j.id,jobNo:j.jobNo,planNo:j.planNo,bookedAt:j.bookedAt}):j;
}
/* a new request has just been sent: offer its print / PDF at once (with its real JB number) */
function jbDoneAsk(j){
  let d=$('#jbDoneDlg');
  if(!d){d=document.createElement('dialog');d.id='jbDoneDlg';d.className='confirm-dlg';d.setAttribute('aria-labelledby','jbDoneT');document.body.appendChild(d);
    d.addEventListener('click',e=>{const b=e.target.closest('[data-jbdone]');if(!b){if(e.target===d)d.close();return}const k=b.dataset.jbdone;
      if(k==='pdf')jbPdf(d._job,false,b);else if(k==='print')jbPrintForm(d._job);else d.close()})}
  d._job=j;const n=(j.items||[]).length;
  d.innerHTML=`<div class="confirm-wrap"><div class="confirm-ico ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></div>
    <h2 id="jbDoneT">ส่งใบรับคำร้อง ${esc(j.jobNo)} ให้ Planner แล้ว</h2>
    <p>${esc(j.customer||'')}${n?` · ${n} เครื่อง`:''} · รับคำร้องเมื่อ ${esc(jbWhen(j.bookedAt))}<br>พิมพ์หรือเก็บไฟล์ PDF ของใบรับคำร้องขอรับบริการสอบเทียบ (FLS-F-018) ใบนี้ได้เลย</p>
    <div class="confirm-act"><button type="button" class="btn" data-jbdone="close">ปิด</button><button type="button" class="btn" data-jbdone="print">พิมพ์</button><button type="button" class="btn primary" data-jbdone="pdf">ดาวน์โหลด PDF</button></div></div>`;
  d.showModal();setTimeout(()=>{const b=d.querySelector('[data-jbdone="pdf"]');if(b)b.focus()},30);
}
function jbPdf(j,all,btn){
  const docs=[jbPdfDoc(j)].concat(all?jbSheets(j).map(csPdfDoc):[]);const n=j.planNo||j.jobNo;
  pdfExport(docs,all?`${n}_ชุดเอกสาร.pdf`:`${n}_FLS-F-018.pdf`,btn);
}
function jbPrintHtml(j){
  const svc=k=>j.svcType===k?'☑':'☐';const by=(v,k)=>v===k?'☑':'☐';const has=(l,x)=>(l||[]).includes(x)?'☑':'☐';
  const rows=(j.items||[]).concat(Array.from({length:Math.max(0,10-(j.items||[]).length)},()=>null)).map((it,i)=>it?`<tr><td>${i+1}</td><td>${esc(it.tag)}</td><td>${esc(it.product)}</td><td>${esc(it.type)}</td><td>${esc(it.size)}</td><td>${esc(it.cls)}</td><td>${esc(it.output)}</td><td>${esc(it.range)}</td><td>${esc(it.points)}</td><td>${esc(it.acc)}</td><td>${esc(it.interval)}</td><td>${esc(it.method)}</td><td>${JB_WITNESS.filter(([k])=>(it.witness||[]).includes(k)).map(x=>x[1]).join(', ')}</td><td>${esc(it.round)}</td><td>${esc(it.refer)}</td></tr>`:`<tr>${'<td>&nbsp;</td>'.repeat(15)}</tr>`).join('');
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(j.planNo||j.jobNo)} · FLS-F-018</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap">
<style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10.5px/1.45 "IBM Plex Sans Thai",Tahoma,sans-serif;color:#0b1b33;margin:12px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:8px 12px;background:#eef3fa;border-radius:8px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
h1{font-size:17px;margin:0;text-align:center}.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}.req{border:1.5px solid #0b1b33;padding:6px 10px;min-width:260px}.req b{font-size:13px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #6b7c96;padding:3px 5px;vertical-align:top}th{background:#eef3fa;font-weight:600}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}.box{border:1px solid #6b7c96;padding:5px 7px}.box b{display:block}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.foot{margin-top:6px;text-align:right;color:#4a5b75}
@media print{.bar{display:none}body{margin:0}}${typeof isoPageCss==='function'?isoPageCss('jobs'):''}</style></head><body>
<div class="bar"><button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>A4 แนวนอน · FLS-F-018</span></div>
<div class="top"><div style="display:flex;gap:12px;align-items:center">${orgLogo(52)}<div><b>${esc(ORG_NAME)}</b><h1 style="text-align:left">ใบรับคำร้องขอรับบริการสอบเทียบ</h1></div></div>
<div class="req"><b>REQUEST No. ${esc(j.planNo||'(รอ Planner ออก PN)')}</b><br>CONTACT SALE : ${esc(j.sale||'')}<br>เลขที่คำร้อง : ${esc(j.jobNo)} · รับคำร้องเมื่อ ${esc(jbWhen(j.bookedAt))}</div></div>
<p><b>ส่วนที่ 1 สำหรับ SALE</b> &nbsp; ${svc('inhouse')} In-house calibration &nbsp; ${svc('onsite')} On-site calibration &nbsp; ${svc('mobile')} Mobile calibration</p>
<table><tr><th style="width:16%">บริษัท / Customer</th><td>${esc(j.customer)}</td><th style="width:12%">ผู้ติดต่อ / Contact</th><td>${esc(j.contact)}</td><th style="width:9%">โทร / Tel</th><td>${esc(j.contactTel)}</td></tr>
<tr><th>ที่อยู่ / Address</th><td colspan="3">${esc(j.address||'')} ${j.location?'· สถานที่ '+esc(j.location):''}</td><th>Email</th><td>${esc(j.email||'')}</td></tr>
<tr><th>ชื่อบริษัท / ที่อยู่ในใบ Cert</th><td colspan="5">${j.certSame!==false?'☑ ใช้ข้อมูลเดียวกับด้านบน (As above)':esc([j.certName,j.certAddress].filter(Boolean).join(' · '))}</td></tr></table>
<p><b>รายการเครื่องที่ส่งสอบเทียบ (UUTs List and Calibration Requirements)</b></p>
<table><tr><th>ITEM</th><th>TAG No.</th><th>PRODUCT</th><th>TYPE</th><th>SIZE (inch)</th><th>CLASS</th><th>OUTPUT</th><th>FLOW RANGE</th><th>CALIBRATION POINT</th><th>(±)Accuracy</th><th>Interval</th><th>Method</th><th>WITNESS</th><th>Round</th><th>Refer Job No.</th></tr>${rows}</table>
<div class="grid"><div class="box"><b>REQUIRE REPORT</b>${JB_REPORTS.map(x=>`${has(j.reports,x)} ${esc(x)}`).join('<br>')}${j.reportOther?`<br>☑ ${esc(j.reportOther)}`:''}</div>
<div class="box"><b>MATERIAL</b>${by(j.materialBy,'flowlab')} BY FLOWLAB ${by(j.materialBy,'customer')} BY CUSTOMER<br>${JB_MATERIALS.map(x=>`${has(j.materials,x)} ${x}`).join('<br>')}<br><b>LEFT FLOWLAB ADJUST TO METER</b>${by(j.adjust,'accept')} ACCEPT ${by(j.adjust,'notaccept')} NOT ACCEPT<br>${esc(j.adjustPoints||'')}<br><b>High Pressure Flow meter</b>${j.highPressure?'☐ No ☑ Yes':'☑ No ☐ Yes'}</div>
<div class="box"><b>DISCONNECT &amp; INSTALL</b>${by(j.installBy,'flowlab')} BY FLOWLAB ${by(j.installBy,'customer')} BY CUSTOMER<br>Disconnect date ${esc(j.disconnectDate?fmtDay(j.disconnectDate):'')}<br>Install date ${esc(j.installDate?fmtDay(j.installDate):'')}<br><b>TRANSPORTATION / RECEIVE &amp; RETURN</b>${by(j.transportBy,'flowlab')} BY FLOWLAB ${by(j.transportBy,'customer')} BY CUSTOMER<br>Receive date ${esc(j.receiveDate?fmtDay(j.receiveDate):'')}<br>Return date ${esc(j.returnDate?fmtDay(j.returnDate):'')}</div>
<div class="box"><b>รายละเอียด / หมายเหตุ</b>${esc(j.detail||'')}${j.note?'<br>'+esc(j.note):''}</div></div>
<div class="sig"><div class="box"><b>METER RECEIVE</b>FLOWLAB SIGN ____________ DATE ________<br>CUSTOMER SIGN ____________ DATE ________</div><div class="box"><b>METER RETURN TO CUSTOMER</b>FLOWLAB SIGN ____________ DATE ________<br>CUSTOMER SIGN ____________ DATE ________</div></div>
<p class="foot">FLS-F-018-REV.12 · พิมพ์จากระบบ ${esc(jbWhen(new Date()))}</p></body></html>`;
  return html;
}/* the booking box in a plan's view */
function jbPlanBox(t){
  const j=t&&t.jobId?jbById(t.jobId):null;if(!j)return '';
  return `<div class="jb-box${jbNeedsReview(j)?' rev':''}"><b>ใบรับคำร้อง ${esc(j.jobNo)}${j.planNo?' · '+esc(j.planNo):''}</b><span>รับคำร้อง ${esc(jbWhen(j.bookedAt))}${j.sale?' · Sale '+esc(j.sale):''}${j.acceptedAt?` · รับงาน ${esc(jbWhen(j.acceptedAt))}`:''}</span>${jbNeedsReview(j)?'<span class="bad">⚠ Sale แก้ไขใบรับคำร้อง · รอ Planner review</span>':''}<button type="button" class="btn sm" data-job-open="${esc(j.id)}">เปิดใบรับคำร้อง</button></div>`;
}
/* in-app notice (user chose "ในระบบอย่างเดียว"): the menu badge = bookings waiting for the Planner (to accept or to review) */
function jbBadge(){
  const b=$('#jobBadge');if(!b)return;const n=isPlanner()?S.jobs.filter(j=>j.state==='pending'||jbNeedsReview(j)).length:0;b.hidden=!n;b.textContent=n;
  const m=$('#jobBadgeM');if(m){m.hidden=!n;m.textContent=n}
}
/* ข้อมูลหลัก › KPI ใบรับคำร้องขอรับบริการสอบเทียบ */
function jobKpiSection(){
  const k=jbKpi();const dis=can('master')?'':' disabled';
  return {id:'jobkpi',title:'KPI ใบรับคำร้องขอรับบริการสอบเทียบ',sub:`ตอบรับ ${k.acceptDays} วัน · กระชั้น < ${k.urgentDays} วัน`,count:'KPI',
    desc:'เป้าหมายที่ใช้ตัดสถานะ Delay / On Process / Timely ของใบรับคำร้องขอรับบริการสอบเทียบ · นับเฉพาะวันทำงาน (จันทร์–เสาร์ ไม่รวมวันหยุดในข้อมูลหลัก)',
    body:`<div class="jb-kset"><label>Planner ต้องตอบรับ (ออก PN) ภายใน <input type="number" min="0" max="30" class="w-num" data-jbkpi="acceptDays" value="${k.acceptDays}"${dis}> วันทำงานหลัง Sale ส่งคำร้อง</label>
      <label>นับเป็น "คำร้องกระชั้น" เมื่อส่งล่วงหน้าน้อยกว่า <input type="number" min="0" max="60" class="w-num" data-jbkpi="urgentDays" value="${k.urgentDays}"${dis}> วันทำงาน</label>
      <p class="hint">ตัวอย่าง: ตั้ง 1 วัน แล้ว Sale ส่งคำร้องวันจันทร์ 10:00 น. Planner ต้องออก PN ภายในสิ้นวันอังคาร ถ้าเกินขึ้น Delay</p></div>`};
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const nw=e.target.closest('[data-job-new]');if(nw){openJob(null);return}
  const op=e.target.closest('[data-job-open]');if(op){openJob(op.dataset.jobOpen);return}
  const tb=e.target.closest('[data-jb-tab]');if(tb){S.jbF.tab=tb.dataset.jbTab;render();return}
  if(e.target.closest('[data-job-accept]')){acceptJob();return}
  const rv=e.target.closest('[data-job-review]');if(rv){reviewJob(rv.dataset.jobReview==='push');return}
  if(e.target.closest('[data-job-cancel]')){cancelJob();return}
  if(e.target.closest('[data-job-plan]')){planFromJob();return}
  const dl=e.target.closest('#jbDel');if(dl){deleteJob(dl);return}
  if(e.target.closest('[data-jb-close]'))$('#jbDlg').close();
  const pl=e.target.closest('#jbDlg [data-edit]');if(pl)$('#jbDlg').close();/* a plan in the list: the drawer opens (events.js) */
});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='jb-q'){S.jbF.q=t.value;fillJobs();return}
  if(t.dataset&&t.dataset.jbit&&jbEdit){const [i,k]=t.dataset.jbit.split('|');if(jbEdit.items[i])jbEdit.items[i][k]=t.value}});
/* the meters of FLS-F-018: add / remove a row, witness boxes, a select (method / round), the "As above" cert switch */
document.addEventListener('click',e=>{
  if(!jbEdit)return;
  if(e.target.closest('[data-jbit-add]')){jbEdit.items.push({id:newId('u'),witness:[],product:'Flowmeter'});$('#jbItems').innerHTML=jbItemsHtml();const l=document.querySelectorAll('#jbItems [data-jbit$="|tag"]');if(l.length)l[l.length-1].focus();return}
  const del=e.target.closest('[data-jbit-del]');if(del){jbEdit.items.splice(Number(del.dataset.jbitDel),1);$('#jbItems').innerHTML=jbItemsHtml();return}
  if(e.target.closest('#jbPrint')){const j=jbOnScreen();if(j)jbPrintForm(j)}
  const pb=e.target.closest('#jbPdf,#jbPdfAll');if(pb){const j=jbOnScreen();if(j)jbPdf(j,pb.id==='jbPdfAll',pb)}
});
document.addEventListener('change',e=>{const t=e.target;if(!jbEdit)return;
  if(t.dataset&&t.dataset.jbit){const [i,k]=t.dataset.jbit.split('|');if(jbEdit.items[i])jbEdit.items[i][k]=t.value;return}
  if(t.dataset&&t.dataset.jbitw){const [i,k]=t.dataset.jbitw.split('|');const it=jbEdit.items[i];if(it){const w=new Set(it.witness||[]);t.checked?w.add(k):w.delete(k);it.witness=[...w]}return}
  if(t.id==='jb-certSame'){const c=document.querySelector('#jbBody .jb-cert');if(c)c.hidden=t.checked}
});
document.addEventListener('change',e=>{
  if(e.target.id==='jb-mine'){S.jbF.mine=e.target.checked;fillJobs();return}
  if(e.target.id==='jb-ins'){S.jbF.ins=e.target.checked;fillJobs();return}
  const k=e.target.dataset&&e.target.dataset.jbkpi;
  if(k&&can('master')){const v=Math.max(0,Math.min(60,Math.floor(Number(e.target.value)||0)));saveCfg({jobKpi:Object.assign({},jbKpi(),{[k]:v})},'บันทึก KPI ใบรับคำร้องขอรับบริการสอบเทียบแล้ว')}
});
document.addEventListener('submit',e=>{if(e.target.id==='jbForm'){e.preventDefault();saveJob()}});
/* Enter in the PN box accepts the job instead of saving the form */
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target.id==='jb-pn'||e.target.id==='jb-accNote')){e.preventDefault();acceptJob()}});
document.addEventListener('close',e=>{if(e.target&&e.target.id==='jbDlg'&&S.view==='jobs')render()},true);
