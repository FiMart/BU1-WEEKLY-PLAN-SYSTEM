'use strict';
/* BU1 Weekly Plan · ติดตามเอกสาร Onsite (user, 22 Oct 2026: the team's sheet "Status Update เอกสาร Onsite 2026", "เพิ่มระบบนี้ให้หน่อย";
   chose: a page + a box in the plan view (+ Dashboard), rows taken from Weekly Plan, step dates filled from the system and editable,
   Final Date = 2 working days Mon–Fri)
   A row = one onsite plan (utoOnsite: someone of ทีม Lab On-Site / All Team, not leave / ตรวจสุขภาพ / Stand by / Support / อบรม,
   not เลื่อน / ยกเลิก) dated today or before. Lead = the first person of its Team Service (the order the Planner set).
   Steps (OD_STEPS) = the sheet's columns; each holds a date, else "ตาม" (still owed), or – (ไม่มีสำหรับงานนี้, the sheet's black cell).
   Which steps a job type needs: ข้อมูลหลัก › ติดตามเอกสาร Onsite (S.cfg.odoc.off {typeId:[step ids not needed]}, every step by default);
   per plan task.docTrack ↔ data.bu1wp.docTrack = {<step>:'YYYY-MM-DD' typed date | 'na' | 'need', note:'Remark'}.
   Dates filled by themselves when nothing is typed: ใบรับงาน ← the booking's รับคำร้องเมื่อ / an uploaded ใบรับงาน file · Service Report and
   ส่ง QC ← the uploaded document / approved Check Sheet (SR, Remove-Reinstall) · Config Flow com ← an approved Data Flow Meter sheet.
   Working days = Mon–Fri without public holidays (odWorkDay). The number beside a date = working days after the work date (the sheet's).
   Complete = every needed step after the work has a date; sent = the latest of them. Status: ในเวลา (sent ≤ Final) · เกินเวลา ·
   รอเอกสาร (not complete, Final not passed) · ตามต่อ (not complete, Final passed; "−n" = calendar days past, like the sheet). */
const OD_STEPS=[
  {id:'prep',name:'เตรียมใบรับงานก่อนเริ่ม',short:'ใบรับงาน<br>ก่อนเริ่ม',pre:true},
  {id:'sr',name:'Service Report',short:'Service<br>Report'},
  {id:'qc',name:'ส่ง QC',short:'ส่ง QC'},
  {id:'cfg',name:'Config Flow com',short:'Config<br>Flow com'},
  {id:'draft',name:'Draft + Report',short:'Draft +<br>Report'},
  {id:'bak',name:'Back up / Flowcom',short:'Back up /<br>Flowcom'},
  {id:'send',name:'ส่งใบรับงาน',short:'ส่ง<br>ใบรับงาน'}];
const OD_NAME=Object.fromEntries(OD_STEPS.map(s=>[s.id,s.name]));
const OD_ST={ok:{th:'ในเวลา',sub:'ส่งเอกสารครบภายใน Final Date'},late:{th:'เกินเวลา',sub:'ส่งครบแล้วแต่หลัง Final Date'},wait:{th:'รอเอกสาร',sub:'ยังไม่ครบ ยังไม่ถึง Final Date'},follow:{th:'ตามต่อ',sub:'ยังไม่ครบ เลย Final Date แล้ว'}};
const OD_DAYS_BACK=90;/* ค้างส่ง: plans of the last 90 days */
S.od={tab:'week',st:'',q:''};
const odCfg=()=>{const c=(S.cfg&&S.cfg.odoc)||{};return {days:Math.max(1,Number(c.days)||2),off:c.off&&typeof c.off==='object'?c.off:{}}};
const odWorkDay=d=>{const w=d.getDay();return w!==0&&w!==6&&!holidayOf(ymd(d))};
const odIsDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v);
const odDay=iso=>{if(!iso)return '';if(odIsDate(iso))return iso;const d=new Date(iso);return isNaN(d)?'':ymd(d)};
const odDM=k=>{if(!k)return '';const d=parseD(k);return `${pad(d.getDate())}-${EN_MON[d.getMonth()]}`};
/* Final Date = the n-th working day after the work date */
function odFinal(k){let d=parseD(k),n=0;const N=odCfg().days;while(n<N){d=addDays(d,1);if(odWorkDay(d))n++}return ymd(d)}
/* working days from a to b (b earlier = minus) */
function odLag(a,b){if(b===a)return 0;const back=b<a;let s=parseD(back?b:a);const e=back?a:b;let n=0;for(s=addDays(s,1);ymd(s)<=e;s=addDays(s,1))if(odWorkDay(s))n++;return back?-n:n}
const odCal=(a,b)=>Math.round((parseD(b)-parseD(a))/864e5);
const odTrack=t=>t&&t.docTrack&&typeof t.docTrack==='object'&&!Array.isArray(t.docTrack)?t.docTrack:{};
const odOn=t=>!!t&&utoOnsite(t)&&!utoTraining(t)&&t.date<=ymd(new Date());
const odTypeNeeds=(t,id)=>!(odCfg().off[typeIdOf(t)]||[]).includes(id);
/* the date the system knows of, with where it came from */
function odAuto(t,id){
  const pick=l=>l.filter(x=>x&&x.d).sort((a,b)=>a.d.localeCompare(b.d))[0]||null;
  const files=k=>typeof docsOf==='function'?docsOf(t,k).map(f=>({d:odDay(f.at),src:`แนบไฟล์ ${f.name}`})):[];
  const sheet=k=>{const c=typeof docBySheet==='function'?docBySheet(t,k):null;return c?{d:odDay(c.approvedAt),src:`Check Sheet ${c.no} อนุมัติ`}:null};
  if(id==='prep'){const j=t.jobId&&typeof jbById==='function'?jbById(t.jobId):null;return pick([j&&{d:odDay(j.bookedAt),src:`ใบรับคำร้อง ${j.jobNo||''}`},...files('job')])}
  if(id==='sr')return pick([...files('sr'),sheet('sr')]);
  if(id==='qc')return pick([...files('qc'),sheet('qc')]);
  if(id==='cfg'){const c=(S.checks||[]).filter(c=>c.form==='data'&&c.state==='approved'&&(c.taskId===t.id||(t.jobId&&c.jobId===t.jobId))).sort((a,b)=>String(a.approvedAt).localeCompare(String(b.approvedAt)))[0];
    return c?{d:odDay(c.approvedAt),src:`Check Sheet ${c.no} อนุมัติ`}:null}
  return null;
}
/* one step of one plan: {id, need, na, date, auto, src, lag, over} */
function odStep(t,id){
  const m=odTrack(t)[id];const pre=id==='prep';
  if(m==='na')return {id,na:true,need:false,why:'ไม่มีสำหรับงานนี้'};
  const typed=odIsDate(m)?m:'';const need=!!typed||m==='need'||odTypeNeeds(t,id);
  if(!need)return {id,na:true,need:false,why:`หัวข้องานนี้ไม่ต้องส่ง (ข้อมูลหลัก)`};
  const a=typed?null:odAuto(t,id);const date=typed||(a?a.d:'');
  const lag=date?odLag(t.date,date):null;
  return {id,need:true,date,auto:!typed&&!!date,src:typed?'กรอกเอง':a?a.src:'',lag,over:date?(pre?date>t.date:lag>odCfg().days):false};
}
function odRow(t){
  const steps=OD_STEPS.map(s=>odStep(t,s.id));const post=steps.filter(s=>s.need&&s.id!=='prep');
  const final=odFinal(t.date);const today=ymd(new Date());
  if(!post.length)return {t,steps,final,none:true,done:false,sent:'',status:'',miss:[]};
  const miss=post.filter(s=>!s.date);const done=!miss.length;const sent=done?post.map(s=>s.date).sort().pop():'';
  const status=done?(sent<=final?'ok':'late'):(today<=final?'wait':'follow');
  const prep=steps[0];
  return {t,steps,final,done,sent,status,miss,over:status==='follow'?odCal(final,today):0,left:status==='wait'?odCal(today,final):0,prepBad:prep.need&&(!prep.date||prep.date>t.date)};
}
const odRows=list=>(list||[]).filter(odOn).map(odRow).filter(r=>!r.none);
const odLeadId=t=>(t.staffIds||[]).find(x=>staffById(x))||'';
const odLead=t=>{const id=odLeadId(t);return id?staffName(id):''};
const odWorkSt=t=>t.status==='done'?'Complete':(t.status||'planned')==='planned'?'On Process':stTh(t.status);
/* counts of a list of rows; rate = ในเวลา ÷ rows already due (sent, or Final passed) */
function odCount(rows){const c={n:rows.length,ok:0,late:0,wait:0,follow:0};rows.forEach(r=>c[r.status]++);const due=c.ok+c.late+c.follow;c.due=due;c.rate=due?Math.round(c.ok/due*100):null;return c}
const odSummary=list=>odCount(odRows(list));
/* the ISO 9001 history line of docTrack */
const odTrackText=v=>Object.entries(v||{}).filter(([k,x])=>x&&OD_NAME[k]||k==='note'&&x).map(([k,x])=>k==='note'?`Remark: ${x}`:`${OD_NAME[k]} ${x==='na'?'ไม่มี':x==='need'?'ต้องส่ง':odDM(x)}`).join(' · ')||'—';

/* ---------- the page (user, 22 Oct 2026: "ปรับ layout ของหน้านี้ด้วยให้ดูดีและเข้าใจง่าย"; chose cards + table switch, quick entry, notices) ----------
   Summary bar (ส่งทันเวลา % + one stacked bar + status chips that filter) → tools (search · การ์ด / ตาราง · เลือกหลายงาน · Excel) →
   legend → the work, grouped by day (รายสัปดาห์) or most urgent first (ค้างส่ง). A step (card box or table cell) opens #odPop:
   วันนี้ · เมื่อวาน · วันทำงาน · any date · ไม่มี / ต้องส่ง · ใช้ค่าจากระบบ. เลือกหลายงาน = tick cards, then one step + date for all. */
const odTab=()=>S.od.tab==='todo'?'todo':'week';
S.od.view=(()=>{try{return localStorage.getItem('bu1wp.odView')==='table'?'table':'card'}catch(e){return 'card'}})();
S.od.pick=false;S.od.sel=new Set();
function odBase(){
  if(odTab()==='week'){const days=new Set(weekDays().map(ymd));return odRows(S.tasks.filter(t=>days.has(t.date)))}
  const today=ymd(new Date());const list=rangeTasks(ymd(addDays(parseD(today),-OD_DAYS_BACK)),today);
  return list?odRows(list).filter(r=>!r.done):null;
}
const odMatch=r=>{const q=norm(S.od.q);return (!S.od.st||r.status===S.od.st)&&(!q||norm([r.t.planNo,r.t.customer,r.t.location,odLead(r.t),typeLabel(r.t),r.t.sale].join(' ')).includes(q))};
/* most urgent first: ตามต่อ (longest past Final), รอเอกสาร (nearest Final), เกินเวลา, ในเวลา */
const OD_RANK={follow:0,wait:1,late:2,ok:3};
const odUrgent=(a,b)=>OD_RANK[a.status]-OD_RANK[b.status]||(a.status==='follow'?b.over-a.over:a.status==='wait'?a.left-b.left:0)||a.t.date.localeCompare(b.t.date)||String(a.t.planNo).localeCompare(String(b.t.planNo));
const odChip=r=>r.status?`<span class="od-st od-${r.status}" title="${esc(OD_ST[r.status].sub)}">${OD_ST[r.status].th}</span>`:'';
const odFollowTxt=r=>r.done?'ครบ':r.status==='follow'?`−${r.over}`:r.left?`อีก ${r.left} วัน`:'วันนี้';
/* the line beside the status: what it means for this work */
const odSay=r=>r.status==='follow'?`เลย Final มา ${r.over} วัน`:r.status==='wait'?(r.left?`อีก ${r.left} วันถึง Final`:'ถึง Final วันนี้'):r.status==='late'?`ส่งครบ ${fmtShort(parseD(r.sent))} · ช้า ${odLag(r.final,r.sent)} วันทำงาน`:`ส่งครบ ${fmtShort(parseD(r.sent))}`;
const odNeedN=r=>r.steps.filter(s=>s.need&&s.id!=='prep');
/* one step's look: state class, the short value, the tooltip */
function odLook(r,s){
  const st=OD_STEPS.find(x=>x.id===s.id);const pre=s.id==='prep';
  if(s.na)return {cls:'na',val:'–',sub:'ไม่มี',tip:`${st.name} · ${s.why}`};
  const cls=s.date?(s.over?'over':s.auto?'auto':'ok'):(pre?'miss':'owe');
  const tip=`${st.name}${s.date?` · ${thDate(s.date)}${pre?(s.date>r.t.date?' · หลังวันทำงาน':''):` · ${s.lag} วันทำงานหลังวันทำงาน`}${s.src?` · ${s.src}`:''}`:pre?' · ยังไม่มีใบรับงานก่อนเริ่มงาน':' · ยังไม่ได้รับ (ตาม)'}${canWork()?' · กดเพื่อกรอก':''}`;
  return {cls,val:s.date?fmtShort(parseD(s.date)):pre?'ไม่มี':'ตาม',sub:s.date?(pre?(s.date>r.t.date?'หลังวันงาน':'ก่อนเริ่ม'):`${s.lag} วัน`):pre?'ก่อนเริ่มงาน':'ยังไม่ได้รับ',dm:s.date?odDM(s.date):pre?'ไม่มี':'ตาม',tip};
}
const odStepBtn=(r,s,inner,cls)=>canWork()?`<button type="button" class="${cls}" data-od-pop="${s.id}" data-od-t="${esc(r.t.id)}" title="${esc(odLook(r,s).tip)}" aria-haspopup="dialog">${inner}</button>`:`<span class="${cls}" title="${esc(odLook(r,s).tip)}">${inner}</span>`;
const odPickBox=r=>S.od.pick?`<label class="od-pk" title="เลือกงานนี้"><input type="checkbox" data-od-sel="${esc(r.t.id)}"${S.od.sel.has(r.t.id)?' checked':''} aria-label="เลือก ${esc(r.t.planNo||typeLabel(r.t))}"></label>`:'';
function odCard(r,withDate){
  const t=r.t;const n=(t.staffIds||[]).length;const need=odNeedN(r);const got=need.filter(s=>s.date).length;const note=odTrack(t).note;
  const steps=r.steps.map(s=>{const L=odLook(r,s);const st=OD_STEPS.find(x=>x.id===s.id);
    return `<li>${odStepBtn(r,s,`<span class="od-sl">${st.short.replace('<br>',' ')}</span><b>${esc(L.val)}</b><small>${esc(L.sub)}</small>`,`od-s ${L.cls}`)}</li>`}).join('');
  return `<article class="od-card od-${r.status}${S.od.sel.has(t.id)?' sel':''}">
    <header class="od-ch">${odPickBox(r)}${odChip(r)}<span class="od-say">${esc(odSay(r))}</span><span class="od-fin" title="Final Date = วันทำงาน + ${odCfg().days} วันทำงาน">Final <b>${esc(fmtShort(parseD(r.final)))}</b></span></header>
    <div class="od-cm"><button type="button" class="od-pno mono" data-edit="${esc(t.id)}" title="เปิดแผน">${esc(t.planNo||'ไม่มี PN')}</button><b class="od-cu">${esc(t.customer||'–')}</b><span class="tdot" style="--c:${planColor(t)}"><i></i>${esc(typeLabel(t))}</span></div>
    <div class="od-mt"><span>Lead <b>${esc(odLead(t)||'—')}</b>${n>1?` +${n-1}`:''}</span>${t.sale?`<span>${esc(t.sale)}</span>`:''}<span class="od-ws ${t.status==='done'?'done':''}">${esc(odWorkSt(t))}</span>${withDate?`<span>วันทำงาน ${esc(fmtDay(t.date))}</span>`:''}</div>
    <div class="od-prog" title="เอกสารหลังงานได้รับ ${got} จาก ${need.length}"><span class="od-pt"><i style="width:${need.length?Math.round(got/need.length*100):0}%"></i></span><span>เอกสาร ${got}/${need.length}</span></div>
    <ol class="od-steps">${steps}</ol>
    ${r.miss.length||note?`<footer class="od-cf">${r.miss.length?`<span>ยังขาด <b>${esc(r.miss.map(s=>OD_NAME[s.id]).join(' · '))}</b></span>`:''}${note?`<span class="od-rm">📝 ${esc(note)}</span>`:''}</footer>`:''}</article>`;
}
function odCell(r,s){const L=odLook(r,s);if(s.na)return `<td class="od-c na" title="${esc(L.tip)}">–</td>`;
  return `<td class="od-c ${L.cls}">${odStepBtn(r,s,`${esc(L.dm)}${s.date&&s.id!=='prep'?`<small>${s.lag}</small>`:''}`,'od-cb')}</td>`}
function odTable(rows,withDate){
  const head=`<tr>${S.od.pick?'<th></th>':''}<th>Status</th><th>ติดตาม</th><th>Final<br>Date</th>${withDate?'<th>Date<br>Work</th>':''}<th>Lead</th><th>PN</th><th>Job Work</th><th>DETAIL</th><th>Status of<br>Work</th><th>ผู้ออก<br>ใบรับงาน</th>${OD_STEPS.map(s=>`<th class="od-sh">${s.short}</th>`).join('')}<th>ส่งครบ<br>วันที่</th><th>Remark</th></tr>`;
  return `<div class="scroll-x plain od-scroll"><table class="mini od-t"><thead>${head}</thead><tbody>${rows.map(r=>{const t=r.t;const n=(t.staffIds||[]).length;
    return `<tr class="od-r od-${r.status}${S.od.sel.has(t.id)?' sel':''}">${S.od.pick?`<td>${odPickBox(r)}</td>`:''}<td>${odChip(r)}</td><td class="n od-f od-${r.status}">${odFollowTxt(r)}</td><td class="n mono">${odDM(r.final)}</td>${withDate?`<td class="n mono">${odDM(t.date)}</td>`:''}
      <td class="od-lead">${esc(odLead(t)||'—')}${n>1?` <small>+${n-1}</small>`:''}</td><td><button type="button" class="lnk mono" data-edit="${esc(t.id)}" title="เปิดแผน">${esc(t.planNo||'–')}</button></td><td class="od-cust">${esc(t.customer||'–')}</td>
      <td><span class="tdot" style="--c:${planColor(t)}"><i></i>${esc(typeLabel(t))}</span></td><td><span class="od-ws ${t.status==='done'?'done':''}">${esc(odWorkSt(t))}</span></td><td>${esc(t.sale||'–')}</td>
      ${r.steps.map(s=>odCell(r,s)).join('')}<td class="n mono">${r.sent?odDM(r.sent):''}</td><td class="od-note">${esc(odTrack(t).note||'')}</td></tr>`}).join('')}</tbody></table></div>`;
}
const odList=(rows,withDate)=>S.od.view==='table'?odTable(rows,withDate):`<div class="od-cards">${rows.map(r=>odCard(r,withDate)).join('')}</div>`;
/* the summary: ส่งทันเวลา %, one bar of the four states, chips that filter */
function odSumHtml(c){
  const seg=['ok','late','wait','follow'];const tot=Math.max(1,c.n);
  const chip=(st,n,lbl)=>`<button type="button" class="od-fc${st?' od-'+st:''}${S.od.st===st?' on':''}" data-od-st="${st}" aria-pressed="${S.od.st===st}">${st?'<i></i>':''}${lbl}<b>${n}</b></button>`;
  return `<section class="panel od-sum"><div class="od-rate"><span>ส่งเอกสารทันเวลา</span><b>${c.rate==null?'–':c.rate+'%'}</b><small>${c.due?`ในเวลา ${c.ok} จาก ${c.due} งานที่ถึง Final แล้ว`:'ยังไม่มีงานที่ถึง Final'}</small></div>
    <div class="od-mid"><div class="od-bar2" role="img" aria-label="${seg.map(s=>`${OD_ST[s].th} ${c[s]}`).join(' · ')}">${seg.map(s=>c[s]?`<i class="od-${s}" style="flex:${c[s]/tot}" title="${OD_ST[s].th} ${c[s]} งาน"></i>`:'').join('')||'<i class="od-none" style="flex:1"></i>'}</div>
      <div class="od-fcs">${chip('',c.n,'ทั้งหมด')}${seg.map(s=>chip(s,c[s],OD_ST[s].th)).join('')}</div></div></section>`;
}
const OD_LEGEND=`<div class="od-legend" aria-label="ความหมายของช่องเอกสาร"><span><i class="od-s ok"></i>ได้รับแล้ว (ตัวเลข = วันทำงานหลังวันทำงาน)</span><span><i class="od-s auto"></i>ระบบเติมให้</span><span><i class="od-s owe"></i>ตาม = ยังไม่ได้รับ</span><span><i class="od-s over"></i>ช้ากว่า Final / ใบรับงานไม่พร้อม</span><span><i class="od-s na"></i>ไม่มีสำหรับงานนี้</span></div>`;
function renderOdoc(){
  if(notReady())return loading();
  const tab=odTab();const base=odBase();
  const todo=(()=>{if(tab==='todo')return base;const today=ymd(new Date());const l=rangeTasks(ymd(addDays(parseD(today),-OD_DAYS_BACK)),today);return l?odRows(l).filter(r=>!r.done):null})();
  const fol=todo?todo.filter(r=>r.status==='follow').length:0;
  const tabs=`<div class="mp-tabs od-tabs" role="tablist" aria-label="ติดตามเอกสาร Onsite">${[['week','รายสัปดาห์',`งานของสัปดาห์ ${weekName(S.week)} แบ่งตามวัน`],['todo','ค้างส่ง',`เอกสารยังไม่ครบ · ${OD_DAYS_BACK} วันล่าสุด${todo?` · ${todo.length} งาน`:''}`]].map(([id,th,sub])=>`<button type="button" role="tab" class="mp-tab${tab===id?' on':''}" data-od-tab="${id}" aria-selected="${tab===id}"><span class="mp-tab-t"><b>${th}${id==='todo'&&fol?` <span class="od-badge" title="ตามต่อ ${fol} งาน">${fol}</span>`:''}</b><small>${esc(sub)}</small></span></button>`).join('')}</div>`;
  if(!base)return `<div class="od-page">${tabs}${loading()}</div>`;
  const c=odCount(base);const rows=base.filter(odMatch).sort(odUrgent);const ed=canWork();
  const seg=(v,l)=>`<label><input type="radio" name="od-view" value="${v}"${S.od.view===v?' checked':''} data-od-view="${v}"><span>${l}</span></label>`;
  let h=tabs+odSumHtml(c)+`<div class="od-tools"><input type="search" id="od-q" value="${esc(S.od.q)}" placeholder="ค้นหา PN · ลูกค้า · Lead · หัวข้องาน" aria-label="ค้นหางาน" autocomplete="off">
    <div class="seg od-vw" role="radiogroup" aria-label="รูปแบบการแสดง">${seg('card','การ์ด')}${seg('table','ตาราง')}</div>
    ${ed?`<button type="button" class="btn${S.od.pick?' primary':''}" data-od-pick aria-pressed="${S.od.pick}">${S.od.pick?'เสร็จ':'เลือกหลายงาน'}</button>`:''}
    ${typeof downloads!=='undefined'&&downloads?'<button type="button" class="btn" data-action="od-xlsx">Excel</button>':''}
    <span class="od-fnote">Final Date = วันทำงาน + ${odCfg().days} วันทำงาน (จ.–ศ. ไม่นับวันหยุดนักขัตฤกษ์)</span></div>
    ${S.od.pick?odBulkHtml(rows):''}${OD_LEGEND}`;
  if(tab==='week'){
    const today=ymd(new Date());
    h+=weekDays().map(d=>{const k=ymd(d);const all=base.filter(r=>r.t.date===k);const l=rows.filter(r=>r.t.date===k);
      if(!all.length&&k>today)return '';const fc=all.filter(r=>r.status==='follow').length;
      return `<section class="od-day${all.length?'':' empty'}"><header><h2>${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)}</h2>${all.length?`<span class="od-dn">${all.length} งาน</span><span class="od-dn">Final ${esc(fmtDay(odFinal(k)))}</span>${fc?`<span class="od-dn bad">ตามต่อ ${fc}</span>`:''}`:'<span class="hint">ไม่มีงานหน้างาน</span>'}${holidayOf(k)?`<span class="od-dn hol">${esc(holidayOf(k))}</span>`:''}</header>
        ${l.length?odList(l,false):all.length?'<p class="hint">ไม่มีงานที่ตรงกับตัวกรอง</p>':''}</section>`}).join('')||'<p class="hint">ยังไม่มีงานหน้างานในสัปดาห์นี้</p>';
  }else{
    h+=`<section class="od-day"><header><h2>เอกสารยังไม่ครบ · ${rows.length} งาน</h2><span class="hint">งานหน้างาน ${OD_DAYS_BACK} วันล่าสุด เรียงจากเร่งด่วนที่สุด (เลย Final นานสุดก่อน)</span></header>
      ${rows.length?odList(rows,true):'<p class="hint od-empty">ไม่มีงานค้างส่งเอกสาร 🎉</p>'}</section>`;
  }
  requestAnimationFrame(odPopPlace);
  return `<div class="od-page${S.od.view==='table'?' tbl':''}">${h}</div>`;
}

/* ---------- quick entry: the step popover ---------- */
const OD_POP={el:null,tid:'',step:''};
const odTaskOf=tid=>(typeof editing!=='undefined'&&editing&&editing.id===tid?editing:null)||findTask(tid);
function odPopAnchor(){return OD_POP.tid?document.querySelector(`#view [data-od-pop="${OD_POP.step}"][data-od-t="${CSS.escape(OD_POP.tid)}"]`):null}
function odPopPlace(){
  const p=OD_POP.el;if(!p||p.hidden)return;const b=odPopAnchor();const r=b&&b.getBoundingClientRect();
  if(!r||!r.width||r.bottom<0||r.top>window.innerHeight){odPopClose();return}
  const z=parseFloat(getComputedStyle(document.body).zoom)||1;const vw=window.innerWidth/z,vh=window.innerHeight/z,w=p.offsetWidth,h=p.offsetHeight;
  const left=Math.max(8,Math.min(r.left/z+r.width/z/2-w/2,vw-w-8));let top=r.bottom/z+6;if(top+h>vh-8&&r.top/z-h-6>=8)top=r.top/z-h-6;
  p.style.left=left+'px';p.style.top=Math.max(8,top)+'px';
}
function odPopOpen(tid,step){
  const t=odTaskOf(tid);if(!t||!canWork())return;
  if(!OD_POP.el){const el=document.createElement('div');el.id='odPop';el.className='od-pop';el.setAttribute('role','dialog');el.hidden=true;document.body.appendChild(el);OD_POP.el=el}
  OD_POP.tid=tid;OD_POP.step=step;const s=odStep(t,step);const m=odTrack(t)[step];const today=ymd(new Date());const yest=ymd(addDays(new Date(),-1));
  const btn=(v,l,sub)=>`<button type="button" class="od-pb" data-od-set="${v}">${l}${sub?`<small>${esc(sub)}</small>`:''}</button>`;
  const now=s.na?'ไม่มีสำหรับงานนี้':s.date?`${thDate(s.date)}${s.src?' · '+s.src:''}`:'ยังไม่ได้รับ';
  OD_POP.el.setAttribute('aria-label',`${OD_NAME[step]} ของ ${t.planNo||typeLabel(t)}`);
  OD_POP.el.innerHTML=`<div class="od-ph2"><b>${esc(OD_NAME[step])}</b><span>${esc([t.planNo,t.customer].filter(Boolean).join(' · '))}</span><small>ตอนนี้: ${esc(now)}</small></div>
    ${s.na&&m!=='na'?'':`<div class="od-pbs">${btn(today,'วันนี้',fmtShort(parseD(today)))}${btn(yest,'เมื่อวาน',fmtShort(parseD(yest)))}${step==='prep'?'':btn(t.date,'วันทำงาน',fmtShort(parseD(t.date)))}</div>
    <div class="od-pd"><input type="date" id="odPopDate" value="${esc(s.date||today)}" aria-label="เลือกวันที่"><button type="button" class="btn sm primary" data-od-set="pick">ใส่วันที่นี้</button></div>`}
    <div class="od-pf">${s.na?`<button type="button" class="lnk" data-od-set="need">ต้องส่งเอกสารนี้</button>`:`<button type="button" class="lnk" data-od-set="na">ไม่มีสำหรับงานนี้</button>`}${odIsDate(m)?`<button type="button" class="lnk" data-od-set="auto">ใช้ค่าจากระบบ</button>`:''}<button type="button" class="lnk" data-od-set="close">ปิด</button></div>`;
  OD_POP.el.hidden=false;odPopPlace();const f=OD_POP.el.querySelector('.od-pb')||OD_POP.el.querySelector('button');if(f)f.focus();
}
function odPopClose(focus){if(!OD_POP.el||OD_POP.el.hidden)return;const b=focus?odPopAnchor():null;OD_POP.el.hidden=true;OD_POP.tid='';if(b)b.focus()}
/* what a choice writes for one step of one plan ('' = remove the typed value) */
function odPatchFor(t,step,kind,date){
  if(kind==='na')return 'na';
  if(kind==='need')return odTypeNeeds(t,step)?'':'need';
  if(kind==='auto')return odTypeNeeds(t,step)?'':'need';
  return date;
}
document.addEventListener('click',e=>{
  if(!e.target.closest)return;
  const pb=e.target.closest('[data-od-pop]');if(pb){const same=OD_POP.el&&!OD_POP.el.hidden&&OD_POP.tid===pb.dataset.odT&&OD_POP.step===pb.dataset.odPop;if(same)odPopClose();else odPopOpen(pb.dataset.odT,pb.dataset.odPop);return}
  if(OD_POP.el&&!OD_POP.el.hidden){
    if(!OD_POP.el.contains(e.target)){odPopClose();return}
    const b=e.target.closest('[data-od-set]');if(!b)return;const v=b.dataset.odSet;const tid=OD_POP.tid,step=OD_POP.step;const t=odTaskOf(tid);
    if(v==='close'||!t){odPopClose(true);return}
    const date=v==='pick'?($('#odPopDate')||{}).value:odIsDate(v)?v:'';if(v==='pick'&&!date){toast('เลือกวันที่ก่อน');return}
    const kind=v==='na'||v==='need'||v==='auto'?v:'date';odPopClose(true);
    odSave(tid,{[step]:odPatchFor(t,step,kind,date)},`${OD_NAME[step]}: ${kind==='na'?'ไม่มีสำหรับงานนี้':kind==='need'?'ต้องส่ง':kind==='auto'?'ใช้ค่าจากระบบ':thDate(date)}`);
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&OD_POP.el&&!OD_POP.el.hidden){e.preventDefault();odPopClose(true)}
  if(e.key==='Enter'&&e.target.id==='odPopDate'){e.preventDefault();const b=OD_POP.el.querySelector('[data-od-set="pick"]');if(b)b.click()}});
window.addEventListener('resize',odPopPlace);window.addEventListener('scroll',odPopPlace,true);

/* ---------- เลือกหลายงาน: one step + one date (or ไม่มี / ค่าจากระบบ) for every ticked work ---------- */
function odBulkHtml(rows){
  const n=S.od.sel.size;const today=ymd(new Date());const all=rows.length&&rows.every(r=>S.od.sel.has(r.t.id));
  return `<div class="od-bulk" role="region" aria-label="กรอกหลายงานพร้อมกัน"><b>เลือก ${n} งาน</b>
    <button type="button" class="lnk" data-od-selall="${all?'0':'1'}">${all?'ไม่เลือกทั้งหมด':`เลือกทั้งหมดที่แสดง (${rows.length})`}</button>
    <label>ขั้น <select id="odBulkStep">${OD_STEPS.map(s=>`<option value="${s.id}"${S.od.bStep===s.id?' selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
    <label>วันที่ <input type="date" id="odBulkDate" value="${esc(S.od.bDate||today)}"></label>
    <button type="button" class="btn primary sm" data-od-bulk="date"${n?'':' disabled'}>ใส่วันที่</button>
    <button type="button" class="btn sm" data-od-bulk="na"${n?'':' disabled'}>ไม่มีสำหรับงานนี้</button>
    <button type="button" class="btn sm" data-od-bulk="auto"${n?'':' disabled'}>ใช้ค่าจากระบบ</button></div>`;
}
async function odBulk(kind){
  if(!canWork())return;const step=($('#odBulkStep')||{}).value;const date=($('#odBulkDate')||{}).value;
  if(!OD_NAME[step])return;if(kind==='date'&&!date){toast('เลือกวันที่ก่อน');return}
  const ids=[...S.od.sel];if(!ids.length)return;S.od.bStep=step;S.od.bDate=date;
  let ok=0,fail=0;S.bulk=true;
  try{for(const id of ids){const t=findTask(id);if(!t){fail++;continue}
      const docTrack=Object.assign({},odTrack(t),{[step]:odPatchFor(t,step,kind,date)});Object.keys(docTrack).forEach(k=>{if(docTrack[k]===''||docTrack[k]==null)delete docTrack[k]});
      try{await Store.update('tasks',id,Object.assign({docTrack},meta()));known.set(id,Object.assign({},t,{docTrack}));ok++}catch(err){fail++;noteWriteError(err)}}}
  finally{S.bulk=false;invalidate();render()}
  toast(`${OD_NAME[step]}: ${kind==='date'?thDate(date):kind==='na'?'ไม่มีสำหรับงานนี้':'ใช้ค่าจากระบบ'} · ${ok} งาน${fail?` · ไม่สำเร็จ ${fail} งาน`:''}`);
  if(!fail)S.od.sel.clear();render();
}
document.addEventListener('click',e=>{
  if(!e.target.closest)return;
  if(e.target.closest('[data-od-pick]')){S.od.pick=!S.od.pick;S.od.sel.clear();render();return}
  const sa=e.target.closest('[data-od-selall]');if(sa){const rows=(odBase()||[]).filter(odMatch);if(sa.dataset.odSelall==='1')rows.forEach(r=>S.od.sel.add(r.t.id));else S.od.sel.clear();render();return}
  const bk=e.target.closest('[data-od-bulk]');if(bk){odBulk(bk.dataset.odBulk);return}
});
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.odSel){if(el.checked)S.od.sel.add(el.dataset.odSel);else S.od.sel.delete(el.dataset.odSel);render();return}
  if(el.dataset.odView){S.od.view=el.dataset.odView;try{localStorage.setItem('bu1wp.odView',S.od.view)}catch(err){}render();return}
  if(el.id==='odBulkStep')S.od.bStep=el.value;if(el.id==='odBulkDate')S.od.bDate=el.value;
});
/* Excel: the rows on screen, the sheet's columns */
async function odXlsx(btn){
  const base=odBase();if(!base)return;const rows=base.filter(odMatch).sort((a,b)=>a.t.date.localeCompare(b.t.date));
  btn.disabled=true;const old=btn.textContent;btn.textContent='กำลังสร้างไฟล์…';
  try{const X=await loadXLSX();const wb=X.utils.book_new();
    const title=[`BU1 Lab · Status Update เอกสาร Onsite · ${odTab()==='week'?`สัปดาห์ ${weekName(S.week)} (${fmtShort(S.week)} – ${fmtShort(addDays(S.week,6))} ${be(addDays(S.week,6))})`:`ค้างส่ง ${OD_DAYS_BACK} วันล่าสุด`}`];
    const head=['Status','ติดตาม','Final Date','Date Work','เอกสารครบ','วันที่ส่งเอกสาร','Lead','Team Service','PN','Job Work','DETAIL','Status of Work','ผู้ออกใบรับงาน',...OD_STEPS.flatMap(s=>s.id==='prep'?[s.name]:[s.name,'วัน']),'Remark'];
    const body=rows.map(r=>{const t=r.t;return [OD_ST[r.status].th,odFollowTxt(r),r.final,t.date,r.done?'/':'',r.sent,odLead(t),teamNames(t).join(', '),t.planNo||'',t.customer||'',typeLabel(t),odWorkSt(t),t.sale||'',
      ...r.steps.flatMap(s=>{const v=s.na?'–':s.date||'ตาม';return s.id==='prep'?[v]:[v,s.date?s.lag:'']}),odTrack(t).note||'']});
    const ws=X.utils.aoa_to_sheet([title,isoXlsxRow('docs'),head,...body]);ws['!cols']=head.map(x=>({wch:x==='วัน'?5:Math.max(10,Math.min(24,String(x).length+4))}));
    X.utils.book_append_sheet(wb,ws,'เอกสาร Onsite');
    await saveFile(`BU1-เอกสาร-Onsite-${odTab()==='week'?ymd(S.week):ymd(new Date())}.xlsx`,X.write(wb,{type:'array',bookType:'xlsx'}));
  }catch(e){toast('สร้างไฟล์ Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่')}
  finally{btn.disabled=false;btn.textContent=old}
}

/* ---------- the box in the plan view ---------- */
function odPlanHtml(t){
  if(!odOn(t))return '';const r=odRow(t);const ed=canWork();const tr=odTrack(t);
  const rows=r.steps.map(s=>{const st=OD_STEPS.find(x=>x.id===s.id);const m=tr[s.id];
    const val=s.na?'<span class="od-v na">ไม่มีสำหรับงานนี้</span>':s.date?`<span class="od-v${s.over?' over':''}">${thDate(s.date)}${s.id==='prep'?(s.date>t.date?' · หลังวันทำงาน':''):` · ${s.lag} วันทำงาน`}</span>`:`<span class="od-v ${s.id==='prep'?'miss':'owe'}">${s.id==='prep'?'ยังไม่มี':'ตาม (ยังไม่ได้รับ)'}</span>`;
    const src=s.na?(m==='na'?'':esc(s.why)):s.src?esc(s.src):'';
    const tog=ed?(s.na?`<button type="button" class="lnk" data-od-na="${s.id}" data-od-t="${esc(t.id)}">ต้องส่ง</button>`:!odIsDate(m)?`<button type="button" class="lnk" data-od-na="${s.id}" data-od-t="${esc(t.id)}">ไม่มี</button>`:''):'';
    return `<div class="od-pr${s.na?' na':''}"><span class="od-pn">${esc(st.name)}</span>${val}${src?`<small>${src}</small>`:''}<span class="od-pa">${ed&&!s.na?`<input type="date" class="od-pin" data-od-step="${s.id}" data-od-t="${esc(t.id)}" value="${esc(odIsDate(m)?m:'')}" aria-label="วันที่ ${esc(st.name)}" title="กรอกวันที่เอง (ว่าง = ใช้ค่าจากระบบ)">`:''}${tog}</span></div>`}).join('');
  return `<div class="od-plan"><div class="od-ph"><b>ติดตามเอกสาร Onsite</b>${r.none?'<span class="hint">หัวข้องานนี้ไม่ต้องส่งเอกสาร</span>':`${odChip(r)}<span class="hint">Final Date ${thDate(r.final)} · ${r.done?`ส่งครบ ${thDate(r.sent)}`:r.status==='follow'?`เลยมา ${r.over} วัน · ยังขาด ${r.miss.map(s=>OD_NAME[s.id]).join(', ')}`:`ยังขาด ${r.miss.map(s=>OD_NAME[s.id]).join(', ')}`}</span>`}
    <button type="button" class="lnk" data-od-go>เปิดหน้าติดตามเอกสาร ›</button></div>
    <div class="od-prs">${rows}</div>
    ${ed?`<label class="od-pnote">Remark <input type="text" id="od-note-${esc(t.id)}" data-od-note="${esc(t.id)}" value="${esc(tr.note||'')}" maxlength="200" placeholder="เช่น รอลูกค้าเซ็น SR · ส่งทาง e-mail แล้ว" autocomplete="off"></label>`:tr.note?`<p class="od-pnote">Remark: ${esc(tr.note)}</p>`:''}</div>`;
}

/* ---------- saving (at once, like เอกสารหลังจบงาน) ---------- */
async function odSave(tid,patch,msg){
  if(!canWork())return;const t=(typeof editing!=='undefined'&&editing&&editing.id===tid?editing:null)||findTask(tid);if(!t)return;
  const docTrack=Object.assign({},odTrack(t),patch);Object.keys(docTrack).forEach(k=>{if(docTrack[k]===''||docTrack[k]==null)delete docTrack[k]});
  try{await Store.update('tasks',tid,Object.assign({docTrack},meta()));
    const nt=Object.assign({},t,{docTrack});known.set(tid,nt);
    if(typeof editing!=='undefined'&&editing&&editing.id===tid){editing=nt;refreshDrawerView()}
    if(msg)toast(msg)}
  catch(err){toast(errText(err));noteWriteError(err);render()}
}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.odStep){const id=el.dataset.odStep;const v=el.value;odSave(el.dataset.odT,{[id]:v||''},`${OD_NAME[id]}: ${v?thDate(v):'ใช้ค่าจากระบบ'}`);return}
  if(el.dataset.odNote!=null&&el.dataset.odNote!==''){const t=findTask(el.dataset.odNote)||(typeof editing!=='undefined'?editing:null);const v=el.value.trim().slice(0,200);if(t&&v!==(odTrack(t).note||''))odSave(el.dataset.odNote,{note:v},'บันทึก Remark แล้ว')}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.odNote){e.preventDefault();e.target.blur()}});
/* the search box: redraw after a pause, keeping the caret (render() waits while a field of the page is being typed in) */
let odQT=null;
document.addEventListener('input',e=>{if(e.target.id!=='od-q')return;S.od.q=e.target.value;clearTimeout(odQT);odQT=setTimeout(()=>{const q0=$('#od-q');if(!q0||document.activeElement!==q0)return;const pos=q0.selectionStart;
  q0.blur();pendingRender=false;render();const q=$('#od-q');if(q){q.focus();q.setSelectionRange(pos,pos)}},250)});
document.addEventListener('click',e=>{
  if(!e.target.closest)return;
  if(e.target.closest('[data-od-go]')){if(typeof dlg!=='undefined'&&dlg.open)dlg.close();goView('odoc');window.scrollTo(0,0);return}
  const tb=e.target.closest('[data-od-tab]');if(tb){S.od.tab=tb.dataset.odTab;S.od.st='';S.od.sel.clear();S.anim='view';render();return}
  const k=e.target.closest('[data-od-st]');if(k){S.od.st=S.od.st===k.dataset.odSt?'':k.dataset.odSt;render();return}
  const n=e.target.closest('[data-od-na]');if(n){const t=(typeof editing!=='undefined'&&editing&&editing.id===n.dataset.odT?editing:null)||findTask(n.dataset.odT);if(!t)return;
    const id=n.dataset.odNa;const s=odStep(t,id);odSave(t.id,{[id]:s.na?(odTypeNeeds(t,id)?'':'need'):'na'},`${OD_NAME[id]}: ${s.na?'ต้องส่ง':'ไม่มีสำหรับงานนี้'}`);return}
  const x=e.target.closest('[data-action="od-xlsx"]');if(x)odXlsx(x);
});

/* ---------- ข้อมูลหลัก › ติดตามเอกสาร Onsite ---------- */
function odSection(){
  const c=odCfg();const dis=can('master')?'':' disabled';
  const types=jobTypes().filter(t=>t.active!==false&&!isLeaveId(t.id)&&!UTO_SKIP.has(t.id)&&t.id!=='training');
  return {id:'odoc',title:'ติดตามเอกสาร Onsite',sub:`Final = +${c.days} วันทำงาน`,count:types.length,
    desc:'ใช้กับหน้า "ติดตามเอกสาร Onsite": Final Date = วันทำงาน + จำนวนวันทำงานนี้ (จ.–ศ. ไม่นับวันหยุดนักขัตฤกษ์) · ติ๊กเอกสารที่หัวข้องานนั้นต้องส่ง ช่องที่ไม่ติ๊กแสดงเป็น – (ไม่มีสำหรับงานนี้) · แต่ละแผนกด "ไม่มี" / "ต้องส่ง" เองได้ในหน้ารายละเอียดแผน',
    body:`<div class="jb-kset"><label>Final Date = วันทำงาน + <input type="number" min="1" max="30" class="w-num" data-odcfg="days" value="${c.days}"${dis}> วันทำงาน</label>
      <p class="hint">ตัวอย่าง: งานวันศุกร์ + ${c.days} วันทำงาน = ${thDate(odFinal(ymd((()=>{const d=new Date();d.setDate(d.getDate()+((5-d.getDay()+7)%7));return d})())))}</p></div>
      <div class="scroll-x plain md-scroll"><table class="edit-table od-mx"><thead><tr><th>หัวข้องาน</th>${OD_STEPS.map(s=>`<th class="c">${s.short}</th>`).join('')}</tr></thead><tbody>
      ${types.map(t=>{const off=c.off[t.id]||[];return `<tr><td>${esc(t.name)}</td>${OD_STEPS.map(s=>`<td class="c"><input type="checkbox" data-odmx="${esc(t.id)}" data-odmx-s="${s.id}"${off.includes(s.id)?'':' checked'}${dis} aria-label="${esc(t.name)} ต้องส่ง ${esc(s.name)}"></td>`).join('')}</tr>`}).join('')}
      </tbody></table></div>`};
}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset||!can('master'))return;
  if(el.dataset.odcfg==='days'){const days=Math.max(1,Math.min(30,Math.floor(Number(el.value)||0)||2));saveCfg({odoc:Object.assign({},odCfg(),{days})},`Final Date = วันทำงาน + ${days} วันทำงาน`);return}
  if(el.dataset.odmx){const c=odCfg();const ty=el.dataset.odmx,s=el.dataset.odmxS;const cur=(c.off[ty]||[]).filter(x=>x!==s);if(!el.checked)cur.push(s);
    const off=Object.assign({},c.off,{[ty]:cur});if(!cur.length)delete off[ty];saveCfg({odoc:Object.assign({},c,{off})},`${(jobTypes().find(x=>x.id===ty)||{}).name||ty}: ${el.checked?'ต้องส่ง':'ไม่ต้องส่ง'} ${OD_NAME[s]}`)}
});
