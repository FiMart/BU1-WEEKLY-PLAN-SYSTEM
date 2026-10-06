'use strict';
/* BU1 Weekly Plan · Weekly plan calibration (สายงาน Calibration Flow Meter)
   The team's sheet "Weekly plan calibration": DATE · No. · Request No. · Customer · Tag/SN · Size · Type ·
   Range for Customer · Point cal · Round · Sale · Lab · Status · Pass/Fail · Detail.
   DATE, Customer and Sale come from the plan; the other columns are one row per meter in task.calItems
   (central DB: data.bu1wp.calItems). Lab / Status / Pass/Fail (the yellow columns) are the lab's results and can be
   changed straight from the plan card or the week table (saved at once, like the plan status). */
const CAL_MAX=60;
/* the team's lists (user, 6 Oct 2026): Status ADD · เลื่อน · ยกเลิก · Problem; Pass/Fail PASS · FAIL;
   Lab 1 · 3 · 3.1 · 3.2 · 3.3 · 4 · Ins.7. "เสร็จ" for a meter = it has a PASS / FAIL result */
const CAL_STATUS=[
  {id:'add',th:'ADD',c:'var(--accent)'},
  {id:'postponed',th:'เลื่อน',c:'var(--warn)'},
  {id:'cancelled',th:'ยกเลิก',c:'var(--line)'},
  {id:'problem',th:'Problem',c:'var(--crit)'},
];
const CAL_ST=Object.fromEntries(CAL_STATUS.map(s=>[s.id,s]));
/* statuses saved before these lists: shown with their old names, read as ADD in the counts */
const CAL_ST_OLD={waiting:'รอสอบเทียบ',progress:'กำลังสอบเทียบ',done:'สอบเทียบเสร็จ'};
const CAL_RESULT=[{id:'pass',th:'PASS'},{id:'fail',th:'FAIL'}];
const CAL_LABS=['1','3','3.1','3.2','3.3','4','Ins.7'];
const INS_LABS=CAL_LABS;/* Weekly plan instrument: the same LAB list (user, 6 Oct 2026); its Status / Pass/Fail lists are not used there */
/* the team's choice lists (user, 6 Oct 2026): Size · Type · Process Fluid · Round (Sale names: DEFAULT_SALES) */
const CAL_SIZES=['1/8"','1/4"','1/2"','3/4"','1"','1-1/2"','2"','2-1/2"','3"','4"','6"','8"','10"','12"'];
const CAL_TYPES=['None','Coriolis meter','Magnetic meter','Rotameter','Turbine meter','Ultrasonics meter','Vortex meter','Thermal Mass','Positive Displacement'];
const CAL_FLUIDS=['Liquid','Gas/Steam','High pressure'];
const CAL_ROUNDS=['None','A (Excise)','Q (Local Excise)','W&M','Customer'];
const CAL_FIELDS=['reqNo','tag','size','type','fluid','range','points','round','lab','status','result','detail'];
const CAL_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 13l3.5-3.5M8 4h8M12 4v1.5"/></svg>';
const calOf=t=>(Array.isArray(t&&t.calItems)?t.calItems:[]).filter(x=>x&&typeof x==='object')
  .map(x=>Object.assign({id:x.id||newId('c')},...CAL_FIELDS.map(f=>({[f]:String(x[f]==null?'':x[f])}))));
const calStId=s=>CAL_ST[s]?s:'add';
const calStTh=s=>CAL_ST[s]?CAL_ST[s].th:CAL_ST_OLD[s]||CAL_ST.add.th;
const calResTh=r=>r==='pass'?'PASS':r==='fail'?'FAIL':'—';
/* n · add / postponed / cancelled / problem · pass / fail · done = has a result · pending = no result yet (not cancelled) */
const calStats=list=>{const o={n:list.length,add:0,postponed:0,cancelled:0,problem:0,pass:0,fail:0,done:0,pending:0};
  list.forEach(x=>{o[calStId(x.status)]++;if(x.result==='pass')o.pass++;if(x.result==='fail')o.fail++;
    if(x.result==='pass'||x.result==='fail')o.done++;else if(calStId(x.status)!=='cancelled')o.pending++});return o};
const calOpts=(list,cur,blank)=>(blank!=null?`<option value="">${blank}</option>`:'')+list.map(([v,l])=>`<option value="${esc(v)}"${String(cur)===String(v)?' selected':''}>${esc(l)}</option>`).join('');
/* a fixed list as options; a value saved before the list existed stays selectable */
const listOpts=(list,cur)=>calOpts(list.concat(cur&&!list.includes(cur)?[cur]:[]).map(l=>[l,l]),cur,'—');
const labOpts=cur=>listOpts(CAL_LABS,cur);
const stOpts=cur=>calOpts(CAL_STATUS.map(s=>[s.id,s.th]).concat(cur&&!CAL_ST[cur]?[[cur,CAL_ST_OLD[cur]||cur]]:[]),cur||'add');
const resOpts=cur=>calOpts(CAL_RESULT.map(r=>[r.id,r.th]),cur,'—');

/* ---------- board card chip and LINE text ---------- */
function calChip(t){
  const l=calOf(t);if(!l.length)return '';const s=calStats(l);
  return `<span class="pcount cal${!s.pending&&s.done?' ok':''}${s.fail||s.problem?' bad':''}" title="สอบเทียบ ${s.n} เครื่อง · มีผลแล้ว ${s.done}${s.pass?` · PASS ${s.pass}`:''}${s.fail?` · FAIL ${s.fail}`:''}${s.problem?` · Problem ${s.problem}`:''}${s.postponed?` · เลื่อน ${s.postponed}`:''}">${CAL_ICON}${s.done}/${s.n}</span>`;
}
function calLines(t){
  const l=calOf(t);if(!l.length)return [];const s=calStats(l);
  return [`🧪 สอบเทียบ Flow Meter : ${s.n} เครื่อง${s.pass?` · PASS ${s.pass}`:''}${s.fail?` · FAIL ${s.fail}`:''}${s.problem?` · Problem ${s.problem}`:''}${s.postponed?` · เลื่อน ${s.postponed}`:''}${s.cancelled?` · ยกเลิก ${s.cancelled}`:''}`]
    .concat(l.map((x,i)=>`${i+1}. ${[x.tag||'(ไม่มี Tag/SN)',x.size,x.type,x.fluid,x.points?`Point ${x.points}`:'',x.round&&x.round!=='None'?`Round ${x.round}`:'',x.lab?`Lab ${x.lab}`:''].filter(Boolean).join(' · ')}${calStId(x.status)!=='add'?` · ${calStTh(x.status)}`:''}${x.result?` · ${calResTh(x.result)}`:''}`));
}

/* ---------- plan form: one card per meter ---------- */
let calItems=[];
/* Request No. = the plan's Plan No. (user, 6 Oct 2026): shown read-only in each row, never typed */
const calReqNo=()=>cleanPlan(($('#f-planno')||{}).value||'');
const reqOf=(t,x)=>t&&t.planNo||x&&x.reqNo||'';
form.addEventListener('input',e=>{if(e.target.id==='f-planno')document.querySelectorAll('#calList .ci-req').forEach(i=>{i.value=calReqNo()})});
function calItemHtml(x,i){
  const inp=(f,lbl,ph,cls,list)=>`<label class="${cls||''}"><span>${lbl}</span><input data-cal-i="${i}" data-cal-f="${f}" value="${esc(x[f])}" maxlength="${f==='detail'?300:120}" autocomplete="off"${ph?` placeholder="${esc(ph)}"`:''}${list?` list="${list}"`:''}></label>`;
  const sel=(f,lbl,html,cls)=>`<label class="${cls==null?'y':cls}"><span>${lbl}</span><select data-cal-i="${i}" data-cal-f="${f}">${html}</select></label>`;
  return `<div class="cal-item" style="--i:${i}">
    <div class="ci-head"><span class="ci-no">No. ${i+1}</span><span class="ci-sum">${esc([x.tag,x.size,x.type].filter(Boolean).join(' · ')||'เครื่องใหม่')}</span>
      <button type="button" class="btn sm ghost" data-cal-dup="${i}" title="เพิ่มเครื่องถัดไปโดยใช้ค่าเดียวกัน (ยกเว้น Tag/SN และผล)">คัดลอก</button><button type="button" class="ph-x2" data-cal-del="${i}" aria-label="ลบเครื่องที่ ${i+1}">×</button></div>
    <div class="ci-grid">
      <label class="mono"><span>Request No.</span><input class="ci-req" value="${esc(calReqNo())}" readonly tabindex="-1" title="ใช้เลขเดียวกับ Plan No. ของแผนนี้" placeholder="= Plan No."></label>${inp('tag','Tag/SN','เช่น FT-101 / SN 12345','mono')}
      ${sel('size','Size',listOpts(CAL_SIZES,x.size),'')}${sel('type','Type',listOpts(CAL_TYPES,x.type),'')}${sel('fluid','Process Fluid',listOpts(CAL_FLUIDS,x.fluid),'')}
      ${inp('range','Range for Customer','เช่น 0–50 m³/h','w2')}${sel('round','Round',listOpts(CAL_ROUNDS,x.round),'')}
      ${inp('points','Point cal','เช่น 10%, 25%, 50%, 75%, 100%','w2')}${sel('lab','Lab',labOpts(x.lab))}${sel('status','Status',stOpts(x.status))}
      ${sel('result','Pass/Fail',resOpts(x.result))}${inp('detail','Detail','หมายเหตุ เช่น สภาพเครื่อง อุปกรณ์ที่มากับเครื่อง','w3')}
    </div></div>`;
}
function renderCalForm(){
  const el=$('#calList');if(!el)return;
  el.innerHTML=calItems.map(calItemHtml).join('')||'<p class="hint cal-empty">ยังไม่มีรายการ กด "+ เพิ่มเครื่อง" เพื่อใส่ Flow Meter ที่จะสอบเทียบ</p>';
  const s=calStats(calItems);$('#calN').textContent=calItems.length?`${s.n} เครื่อง${s.pass?` · PASS ${s.pass}`:''}${s.fail?` · FAIL ${s.fail}`:''}${s.problem?` · Problem ${s.problem}`:''}`:'ไม่บังคับ';
  $('#calAdd').disabled=calItems.length>=CAL_MAX;
}
function loadCal(v){calItems=calOf(v);renderCalForm();syncCalRows()}
/* reqNo is saved as the Plan No. too, so the stored row reads the same as the sheet */
const calForSave=()=>calItems.map(x=>Object.assign({},x,...CAL_FIELDS.map(f=>({[f]:String(x[f]||'').trim()})),{reqNo:calReqNo()})).filter(x=>CAL_FIELDS.some(f=>f!=='status'&&f!=='reqNo'&&x[f]));
/* shown for Flow Meter plans (and any plan that already has rows, so nothing is hidden by a line change) */
function syncCalRows(){const on=curLine()==='fm'||calItems.length>0;document.querySelectorAll('#formFields .cal-row').forEach(el=>{el.hidden=!on})}
function addCal(from){
  if(calItems.length>=CAL_MAX){toast(`ใส่ได้ไม่เกิน ${CAL_MAX} เครื่องต่อแผน`);return}
  const last=from||calItems[calItems.length-1];
  calItems.push(Object.assign(Object.fromEntries(CAL_FIELDS.map(f=>[f,''])),{id:newId('c'),status:'add'},
    last?{size:last.size,type:last.type,fluid:last.fluid,range:last.range,points:last.points,round:last.round,lab:last.lab}:{}));
  renderCalForm();const f=$('#calList .cal-item:last-child [data-cal-f="tag"]');if(f)f.focus();
}
form.addEventListener('input',e=>{const t=e.target;if(t.dataset.calF==null)return;const x=calItems[Number(t.dataset.calI)];if(!x)return;x[t.dataset.calF]=t.value;
  const sum=t.closest('.cal-item').querySelector('.ci-sum');if(sum)sum.textContent=[x.tag,x.size,x.type].filter(Boolean).join(' · ')||'เครื่องใหม่'});
form.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.calF!=null&&t.tagName==='SELECT'){const x=calItems[Number(t.dataset.calI)];if(x){x[t.dataset.calF]=t.value;renderCalForm()}return}
  if(t.name==='f-line'||t.id==='f-type')syncCalRows();
  if(t.matches('[data-vcal]'))saveViewCal(t);
});
form.addEventListener('click',e=>{
  if(e.target.closest('#calAdd')){addCal();return}
  const d=e.target.closest('[data-cal-dup]');if(d){const x=calItems[Number(d.dataset.calDup)];if(x)addCal(x);return}
  const r=e.target.closest('[data-cal-del]');if(r){calItems.splice(Number(r.dataset.calDel),1);renderCalForm();syncCalRows()}
});

/* ---------- plan card (read mode): the sheet's rows; the yellow columns change at once ---------- */
function calTableHtml(rows,opt){
  /* rows: [{t, x, i, no}] · opt.edit: Lab/Status/Pass-Fail as selects · opt.week: DATE, Customer, Sale columns */
  const w=opt&&opt.week,ed=opt&&opt.edit;
  const ysel=(r,f,html)=>ed?`<select class="cal-sel" data-vcal="${esc(r.t.id)}|${esc(r.x.id)}|${f}" aria-label="${f} ของ ${esc(r.x.tag||'เครื่องที่ '+r.no)}">${html}</select>`:'';
  const head=(w?'<th class="c-date" colspan="2">DATE</th>':'')+`<th class="c-no">No.</th><th>Request No.</th>${w?'<th>Customer</th>':''}<th>Tag/SN:</th><th>Size</th><th>Type</th><th>Process Fluid</th><th>Range for Customer</th><th>Point cal</th><th>Round</th>${w?'<th>Sale</th>':''}<th class="y">Lab</th><th class="y">Status</th><th class="y">Pass/Fail</th><th>Detail</th>`;
  const body=rows.map((r,k)=>{const x=r.x,t=r.t;const d=parseD(t.date);const first=w&&(k===0||rows[k-1].t.date!==t.date);
    return `<tr class="${w&&first&&k?'day-first':''}${x.status==='cancelled'?' cx':''}"${w?` data-cal-open="${esc(t.id)}"`:''}>
      ${w?`<td class="c-d${first?'':' rep'}"><span>${EN_DAY[d.getDay()]}</span></td><td class="c-d2${first?'':' rep'}" data-l="DATE"><span><i class="ph-only">${EN_DAY[d.getDay()]} </i>${esc(fmtShort(d))}</span></td>`:''}
      <td class="c-no num" data-l="No.">${r.no}</td><td class="mono" data-l="Request No.">${esc(reqOf(t,x)||'–')}</td>${w?`<td data-l="Customer"><b>${esc(t.customer||'–')}</b></td>`:''}
      <td class="mono tag" data-l="Tag/SN">${esc(x.tag||'–')}</td><td data-l="Size">${esc(x.size||'–')}</td><td data-l="Type">${esc(x.type||'–')}</td><td data-l="Process Fluid">${esc(x.fluid||'–')}</td>
      <td data-l="Range">${esc(x.range||'–')}</td><td data-l="Point cal">${esc(x.points||'–')}</td><td data-l="Round">${esc(x.round||'–')}</td>${w?`<td data-l="Sale">${esc(t.sale||'–')}</td>`:''}
      <td class="y" data-l="Lab">${ed?ysel(r,'lab',labOpts(x.lab)):esc(x.lab||'–')}</td>
      <td class="y" data-l="Status">${ed?ysel(r,'status',stOpts(x.status)):`<span class="cst" style="--c:${CAL_ST[calStId(x.status)].c}"><i></i>${esc(calStTh(x.status))}</span>`}</td>
      <td class="y" data-l="Pass/Fail">${ed?ysel(r,'result',resOpts(x.result)):`<span class="cres ${esc(x.result||'')}">${calResTh(x.result)}</span>`}</td>
      <td class="det" data-l="Detail">${esc(x.detail||'')}</td></tr>`}).join('');
  return `<div class="cal-scroll"><table class="cal-tbl${w?' week':''}${ed?' ed':''}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function calViewHtml(t,k){
  const l=calOf(t);if(!l.length)return '';const s=calStats(l);
  return `<div class="wide" style="--k:${k}"><dt>Weekly plan calibration · ${s.n} เครื่อง${s.pass?` · PASS ${s.pass}`:''}${s.fail?` · <span class="bad">FAIL ${s.fail}</span>`:''}${s.problem?` · <span class="bad">Problem ${s.problem}</span>`:''}</dt>
    <dd class="dv-cal">${calTableHtml(l.map((x,i)=>({t,x,i,no:i+1})),{edit:S.canWrite})}</dd></div>`;
}
/* a yellow column changed in the card or the week table: saved at once */
async function saveViewCal(sel){
  const [tid,cid,f]=sel.dataset.vcal.split('|');const t=(editing&&editing.id===tid)?editing:findTask(tid);if(!t||!S.canWrite)return;
  const list=calOf(t).map(x=>x.id===cid?Object.assign({},x,{[f]:sel.value}):x);
  sel.disabled=true;
  try{await Store.update('tasks',tid,Object.assign({calItems:list},meta()));
    if(editing&&editing.id===tid){editing=Object.assign({},editing,{calItems:list});calItems=calOf(editing);renderCalForm();if(dMode==='view'){renderDrawerView(editing);renderPhotos();renderFiles()}}
    const x=list.find(y=>y.id===cid);toast(`บันทึก ${x&&x.tag?x.tag+' · ':''}${f==='lab'?'Lab':f==='status'?'Status':'Pass/Fail'} แล้ว`)}
  catch(err){toast(errText(err));noteWriteError(err);render()}
  finally{sel.disabled=false}
}

/* ---------- the week: "Weekly plan calibration" under the board (Flow Meter tab) ---------- */
function calWeekRows(tasks){
  const rows=[];let no=0;
  tasks.filter(t=>!isLeave(t)&&isWorking(t)).sort(byTime).forEach(t=>calOf(t).forEach((x,i)=>rows.push({t,x,i,no:++no})));
  return rows;
}
function calWeekHtml(){
  if(S.line==='ins')return '';
  const rows=calWeekRows(S.tasks.filter(planMatch));
  if(!rows.length&&S.line!=='fm')return '';
  const s=calStats(rows.map(r=>r.x));
  return `<section class="cal-week" aria-label="Weekly plan calibration">
    <header class="cw-head"><div class="cw-title">${CAL_ICON}<div><h2>Weekly plan calibration</h2><p>${esc(fmtShort(S.week))} – ${esc(fmtShort(addDays(S.week,6)))} ${be(addDays(S.week,6))} · รายการ Flow Meter ที่สอบเทียบในสัปดาห์นี้${S.canWrite&&rows.length?' · แก้ Lab / Status / Pass/Fail ในตารางได้ทันที':''}</p></div></div>
      ${rows.length?`<div class="cw-stats"><span><b>${s.n}</b>เครื่อง</span><span class="ok"><b>${s.pass}</b>PASS</span><span class="${s.fail?'bad':''}"><b>${s.fail}</b>FAIL</span><span><b>${s.pending}</b>รอผล</span>${s.postponed?`<span><b>${s.postponed}</b>เลื่อน</span>`:''}${s.cancelled?`<span><b>${s.cancelled}</b>ยกเลิก</span>`:''}${s.problem?`<span class="bad"><b>${s.problem}</b>Problem</span>`:''}</div>`:''}</header>
    ${rows.length?calTableHtml(rows,{week:true,edit:S.canWrite}):`<p class="cw-empty">ยังไม่มีรายการสอบเทียบในสัปดาห์นี้ · เปิดแผนงาน Flow Meter แล้วกรอกที่หัวข้อ "Weekly plan calibration"${S.canWrite?' <button type="button" class="lnk" data-action="add" data-line="fm">+ เพิ่มแผนงาน Flow Meter</button>':''}</p>`}
  </section>`;
}
document.addEventListener('change',e=>{const t=e.target;if(t.matches&&t.matches('#view [data-vcal]'))saveViewCal(t)});
document.addEventListener('click',e=>{if(e.target.closest('select'))return;const r=e.target.closest('#view [data-cal-open]');if(r)openTask(r.dataset.calOpen)});

/* ---------- exports: the sheet's columns ---------- */
const CAL_HEAD=['DATE','No.','Request No.','Customer','Tag/SN','Size','Type','Process Fluid','Range for Customer','Point cal','Round','Sale','Lab','Status','Pass/Fail','Detail'];
const CAL_YELLOW=[12,13,14];/* Lab · Status · Pass/Fail columns of CAL_HEAD */
const calRowCells=r=>[fmtDayY(r.t.date),r.no,reqOf(r.t,r.x),r.t.customer||'',r.x.tag,r.x.size,r.x.type,r.x.fluid,r.x.range,r.x.points,r.x.round,r.t.sale||'',r.x.lab,calStTh(r.x.status),calResTh(r.x.result).replace('—',''),r.x.detail];
