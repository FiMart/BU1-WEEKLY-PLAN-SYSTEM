'use strict';
/* BU1 Weekly Plan · ⚡ ถามด่วน — no AI, free (user, 27 Nov 2026: "ถ้าถาม ai มีแบบไม่เสียตังไหม หรือถ้าเสียตังตัดออกไปก่อนหรือหาวิธีอื่นๆแทน";
   chose: replace ถาม AI with ready-made questions that need no AI; switch both AI buttons off for now).
   Ready-made questions run the same READ-ONLY search tools ถาม AI uses (AA_TOOLS in js/features/ai-ask.js) on the data this account can
   already read, in the browser: nothing leaves the system, nothing is written. A typed question is read by simple keyword rules (qaParse):
   date words (วันนี้ / พรุ่งนี้ / สัปดาห์นี้ / สัปดาห์หน้า / เดือนนี้), the topic (ว่าง · รถ · GA · NCR · Check Sheet · คำร้อง · เอกสาร …) and the
   rest as search words for plans; the panel says how it read it. Results = a table, document numbers as buttons, คัดลอกส่ง LINE.
   Floating button #qaFab bottom-right for every level but GA; ✨ ถาม AI opens from here only while aaOn() (BU1_CONFIG.aiAskUrl set). */
const QA={open:false,rk:'today',from:'',to:'',team:'',text:'',busy:false,res:null,last:''};
const qaOn=()=>!(typeof isGA==='function'&&isGA())&&(S.backend!=='supabase'||!!S.level)&&!!S.tasksReady;
const QA_RANGES=[['today','วันนี้'],['tomorrow','พรุ่งนี้'],['week','สัปดาห์นี้'],['next','สัปดาห์หน้า'],['month','เดือนนี้'],['custom','เลือกวัน']];
function qaRange(k){const t=new Date();const td=ymd(t);
  if(k==='today')return [td,td];if(k==='tomorrow'){const x=ymd(addDays(t,1));return [x,x]}
  if(k==='week'){const m=mondayOf(t);return [ymd(m),ymd(addDays(m,6))]}if(k==='next'){const m=addDays(mondayOf(t),7);return [ymd(m),ymd(addDays(m,6))]}
  if(k==='month')return [ymd(firstOfMonth(t)),ymd(new Date(t.getFullYear(),t.getMonth()+1,0))];
  const a=aaD(QA.from)||td,b=aaD(QA.to)||a;return b<a?[b,a]:[a,b]}
const qaRangeText=([a,b])=>a===b?ntfRel(a):`${fmtDay(a)} – ${fmtDay(b)}`;
const QA_TEAM=()=>[['','ทุกทีม'],...WORK_TEAMS.map(t=>[t.id,t.name])];
const qaJoin=v=>Array.isArray(v)?v.filter(Boolean).join(', '):v==null?'':String(v);

/* each question: label, uses the date range or not, run(ctx) → {title, cols:[[key, label]], rows, note?} */
const QA_Q=[
  {id:'free',ic:'👷',l:'ใครว่าง / ใครลา',range:1,team:1,async run(c){const r=await aaRun('people_on',{date_from:c.from,date_to:c.to,team:c.team});
    return {title:`ใครว่าง · ${qaRangeText([c.from,c.to])} · ${r.team}`,cols:[['day','วัน'],['free','ว่าง'],['work','ทำงาน'],['leave','ลา']],
      rows:r.items.map(d=>({day:d.day+(d.holiday?` (${d.holiday})`:d.weekend?' (หยุด)':''),free:d.free.length?`${d.free.length} คน: ${d.free.join(', ')}`:'—',
        work:d.working.map(w=>`${w.name} (${w.plans.join(' / ')})`),leave:d.leave.map(l=>`${l.name} (${l.kind})`)}))}}},
  {id:'plans',ic:'📅',l:'แผนงานในช่วงนี้',range:1,team:0,async run(c){const r=await aaRun('find_plans',{date_from:c.from,date_to:c.to,text:c.text,limit:200});
    return {title:`แผนงาน · ${qaRangeText([c.from,c.to])}${c.text?` · "${c.text}"`:''} · ${r.count} แผน`,cols:QA_PLAN_COLS,rows:r.items.map(qaPlanRow),note:r.note}}},
  {id:'late',ic:'⏰',l:'เลยวันแล้วยังไม่ปิด',range:0,async run(){const to=ymd(addDays(new Date(),-1)),from=ymd(addDays(new Date(),-60));const r=await aaRun('find_plans',{date_from:from,date_to:to,status:'late',limit:200});
    return {title:`เลยวันแล้วยังไม่ปิดสถานะ (60 วันล่าสุด) · ${r.count} แผน`,cols:QA_PLAN_COLS,rows:r.items.map(qaPlanRow)}}},
  {id:'short',ic:'🧩',l:'ทีมยังไม่ครบ',range:1,async run(c){const r=await aaRun('find_plans',{date_from:c.from,date_to:c.to,limit:200});const l=r.items.filter(p=>/ขาด/.test(p.team_need||''));
    return {title:`ทีมยังไม่ครบ · ${qaRangeText([c.from,c.to])} · ${l.length} แผน`,cols:[['pn','Plan No.'],['day','วัน'],['need','ต้องการ'],['team','ทีมตอนนี้'],['cust','ลูกค้า']],
      rows:l.map(p=>({pn:p.plan_no,day:p.day,need:p.team_need,team:p.team,cust:p.customer}))}}},
  {id:'ga',ic:'🚐',l:'รอรถ GA',range:1,async run(c){const r=await aaRun('vehicles_on',{date_from:c.from,date_to:qaCap(c.from,c.to,31)});const rows=[];
    r.items.forEach(d=>d.plans.filter(p=>p.ga).forEach(p=>rows.push({day:d.day,pn:p.plan_no,cust:p.customer,car:p.vehicle})));
    return {title:`รอ GA จัดรถ · ${qaRangeText([c.from,qaCap(c.from,c.to,31)])} · ${rows.length} แผน`,cols:[['day','วัน'],['pn','Plan No.'],['cust','ลูกค้า'],['car','วิธีเดินทาง']],rows}}},
  {id:'cars',ic:'🚗',l:'รถแผนกว่าง / ใช้งาน',range:1,async run(c){const to=qaCap(c.from,c.to,31);const r=await aaRun('vehicles_on',{date_from:c.from,date_to:to});
    return {title:`รถแผนก · ${qaRangeText([c.from,to])}`,cols:[['day','วัน'],['free','ว่าง'],['used','ใช้งาน']],
      rows:r.items.map(d=>({day:d.day,free:d.free_vehicles.length?d.free_vehicles:'—',used:d.plans.filter(p=>p.vehicle).map(p=>`${p.plan_no} ${p.vehicle}`)}))}}},
  {id:'docs',ic:'📎',l:'เอกสารหลังจบงานไม่ครบ',range:0,async run(){const r=await aaRun('find_plans',{date_from:ymd(addDays(new Date(),-30)),date_to:ymd(new Date()),status:'done',limit:200});const l=r.items.filter(p=>p.docs_missing);
    return {title:`เอกสารหลังจบงานยังไม่ครบ (30 วันล่าสุด) · ${l.length} แผน`,cols:[['pn','Plan No.'],['day','วัน'],['cust','ลูกค้า'],['miss','ขาด'],['team','ทีม']],
      rows:l.map(p=>({pn:p.plan_no,day:p.day,cust:p.customer,miss:p.docs_missing,team:p.team}))}}},
  {id:'odoc',ic:'🗂️',l:'เอกสาร Onsite เลย Final',range:0,async run(){const r=await aaRun('onsite_docs',{date_from:ymd(addDays(new Date(),-90)),date_to:ymd(new Date()),status:'follow'});
    return {title:`เอกสาร Onsite เลย Final แล้วยังขาด (90 วันล่าสุด) · ${r.count} งาน`,cols:[['pn','Plan No.'],['date','วันทำงาน'],['cust','ลูกค้า'],['lead','Lead'],['over','เลยมา'],['miss','ขาด']],
      rows:r.items.map(x=>({pn:x.plan_no,date:fmtDay(x.date),cust:x.customer,lead:x.lead,over:x.over_days?`${x.over_days} วัน`:'',miss:x.missing}))}}},
  {id:'req',ic:'📝',l:'ใบรับคำร้องรอรับงาน / review',range:0,async run(){const a=await aaRun('find_requests',{state:'pending'}),b=await aaRun('find_requests',{state:'review'});const l=a.items.concat(b.items);
    return {title:`ใบรับคำร้องที่รอ Planner · ${l.length} ใบ`,cols:[['no','เลขที่'],['st','สถานะ'],['cust','ลูกค้า'],['sale','Sale'],['want','ต้องการ'],['ans','ตอบรับ']],
      rows:l.map(j=>({no:j.request_no,st:j.review||j.state,cust:j.customer,sale:j.sale,want:j.want,ans:j.answer||''}))}}},
  {id:'cs',ic:'✅',l:'Check Sheet รออนุมัติ / ตีกลับ',range:0,async run(){const a=await aaRun('find_check_sheets',{state:'submitted'}),b=await aaRun('find_check_sheets',{state:'rejected'});const l=a.items.concat(b.items);
    return {title:`Check Sheet รออนุมัติ / ตีกลับ · ${l.length} ใบ`,cols:[['no','เลขที่'],['form','ฟอร์ม'],['st','สถานะ'],['pn','PN'],['by','ส่งโดย'],['why','หมายเหตุ']],
      rows:l.map(x=>({no:x.no,form:x.form,st:x.state,pn:x.plan_no,by:x.sent_by||'',why:x.reject_reason||x.flow||''}))}}},
  {id:'ncr',ic:'⚠️',l:'NCR ที่ยังเปิดอยู่',range:0,async run(){const r=await aaRun('find_ncr',{state:'open'});
    return {title:`NCR ที่ยังเปิดอยู่ · ${r.count} ใบ (เกินกำหนด ${r.items.filter(n=>n.overdue).length})`,cols:[['no','เลขที่'],['due','กำหนด'],['cust','ลูกค้า'],['pn','PN'],['issue','ปัญหา'],['owner','ผู้รับผิดชอบ']],
      rows:r.items.map(n=>({no:n.ncr_no,due:(n.due?fmtDay(n.due):'')+(n.overdue?' · เกินกำหนด':''),cust:n.customer,pn:n.plan_no,issue:n.issue,owner:n.owner}))}}}
];
const QA_PLAN_COLS=[['pn','Plan No.'],['day','วัน'],['type','งาน'],['cust','ลูกค้า · สถานที่'],['team','ทีม'],['st','สถานะ']];
const qaPlanRow=p=>({pn:p.plan_no,day:`${p.day}${p.period&&p.period!=='เช้า,บ่าย'?' '+p.period:''}`,type:p.type,cust:[p.customer,p.location].filter(Boolean).join(' · '),team:p.team,st:p.late||p.status});
const qaCap=(a,b,n)=>aaDays(a,b)>n?ymd(addDays(parseD(a),n)):b;

/* a typed question → {q, rk, team, text, why} by keywords; anything else = plans with search words */
function qaParse(s){const t=String(s||'').toLowerCase();let rk='',team='';
  if(/พรุ่งนี้/.test(t))rk='tomorrow';else if(/วันนี้/.test(t))rk='today';else if(/(สัปดาห์|อาทิตย์)หน้า/.test(t))rk='next';else if(/(สัปดาห์|อาทิตย์)นี้/.test(t))rk='week';else if(/เดือนนี้/.test(t))rk='month';
  let q='plans';
  if(/รถ/.test(t)&&/ว่าง|ใช้/.test(t)&&!/ga/.test(t))q='cars';
  else if(/ga|รอรถ|ขอรถ/.test(t))q='ga';
  else if(/ใคร.*ว่าง|ว่าง.*(ใคร|คน)|คนว่าง|ใครลา|ลาบ้าง|ใครทำงาน|ว่างบ้าง/.test(t))q='free';
  else if(/ncr/.test(t))q='ncr';
  else if(/check ?sheet|เช็คชีท|อนุมัติ|ตีกลับ/.test(t))q='cs';
  else if(/คำร้อง|jb-|รอรับงาน/.test(t))q='req';
  else if(/final|เอกสาร.*(onsite|ออนไซต์)/.test(t))q='odoc';
  else if(/เอกสาร/.test(t))q='docs';
  else if(/ไม่ครบ|ขาดคน|คนไม่พอ/.test(t))q='short';
  else if(/เลยวัน|ยังไม่ปิด|ค้างปิด|ค้าง/.test(t))q='late';
  if(q==='free'){if(/on-?site|ออนไซต์|หน้างาน/.test(t))team='onsite';else if(/\blab\b|แล็บ|แลป|แล็ป/.test(t))team='lab'}
  const text=q!=='plans'?'':String(s).replace(/(พรุ่งนี้|วันนี้|(สัปดาห์|อาทิตย์)(หน้า|นี้)|เดือนนี้|มีงาน|แผนงาน|งาน|อะไร|บ้าง|ของ|ลูกค้า|แผน|ไหม|มั้ย|ครับ|ค่ะ|คะ|หน่อย|ขอดู|ดู|ที่|\?)/g,' ').replace(/\s+/g,' ').trim();
  return {q,rk,team,text}}

/* ---------- table + LINE text ---------- */
const qaCell=v=>esc(qaJoin(v)).replace(AA_REF,m=>`<button type="button" class="aa-ref" data-qa-ref="${m}">${m}</button>`);
function qaTable(r){if(!r.rows.length)return '<p class="qa-none">ไม่พบข้อมูล</p>';
  return `<div class="aa-tw"><table class="aa-t qa-t"><thead><tr>${r.cols.map(([,l])=>`<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${r.rows.map(x=>`<tr>${r.cols.map(([k,l])=>`<td data-l="${esc(l)}">${qaJoin(x[k])?`<span>${qaCell(x[k])}</span>`:''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
const qaText=r=>[r.title,...r.rows.map(x=>'• '+r.cols.map(([k])=>qaJoin(x[k])).filter(v=>v&&v!=='—').join(' · '))].join('\n');

/* ---------- running a question ---------- */
async function qaRun(id,why){
  const Q=QA_Q.find(x=>x.id===id);if(!Q||QA.busy)return;const [from,to]=qaRange(QA.rk);
  QA.busy=true;QA.last=id;QA.res={title:`${Q.l}…`,cols:[],rows:[],loading:true,why};qaDraw();
  try{const r=await Q.run({from,to,team:QA.team,text:QA.text.trim()});QA.res=Object.assign(r,{why,id,range:!!Q.range})}
  catch(e){QA.res={title:Q.l,cols:[],rows:[],err:String(e&&e.message||e),why}}
  finally{QA.busy=false;qaDraw(true)}
}
function qaAskText(){const i=$('#qaQ');const s=i?i.value.trim():'';if(!s)return;const p=qaParse(s);
  if(p.rk)QA.rk=p.rk;if(p.q==='free')QA.team=p.team;QA.text=p.text;
  const Q=QA_Q.find(x=>x.id===p.q);const why=`ตีความว่า: ${Q.l}${Q.range?` · ${qaRangeText(qaRange(QA.rk))}`:''}${p.q==='free'&&QA.team?` · ${TEAM[QA.team].name}`:''}${p.text?` · คำค้น "${p.text}"`:''}`;
  qaRun(p.q,why)}

/* ---------- the panel ---------- */
function qaBuild(){
  let p=$('#qaPanel');if(p)return p;
  p=document.createElement('section');p.id='qaPanel';p.className='aa-panel qa-panel';p.hidden=true;p.setAttribute('aria-label','ถามด่วน');
  p.innerHTML=`<header class="aa-head"><span class="aa-logo" aria-hidden="true">⚡</span><div><b>ถามด่วน</b><small>ค้นจากข้อมูลในระบบทันที · ไม่ใช้ AI · ไม่มีค่าใช้จ่าย</small></div><span class="grow"></span>
      <span id="qaAi"></span><button type="button" class="icon-btn sm" data-qa-close aria-label="ปิด">✕</button></header>
    <div class="aa-log qa-body" id="qaBody"></div>`;
  document.body.appendChild(p);return p}
function qaDraw(scroll){
  const p=$('#qaPanel');if(!p||p.hidden)return;const b=$('#qaBody');const keep=b.scrollTop;const [from,to]=qaRange(QA.rk);
  $('#qaAi').innerHTML=typeof aaOn==='function'&&aaOn()?'<button type="button" class="btn sm" data-aa-open title="ถามเป็นภาษาพูดด้วย AI (มีค่าใช้จ่าย)">✨ ถาม AI</button>':'';
  const typed=$('#qaQ')?$('#qaQ').value:'';const r=QA.res;
  b.innerHTML=`<form class="qa-ask" onsubmit="return false"><input id="qaQ" type="search" maxlength="200" placeholder="พิมพ์ถาม เช่น พรุ่งนี้ใครว่าง · งานของ PTT สัปดาห์นี้ · NCR" aria-label="พิมพ์คำถาม" value="${esc(typed)}"><button type="button" class="btn primary" data-qa-ask>ถาม</button></form>
    <div class="qa-opts"><div class="qa-chips" role="group" aria-label="ช่วงวันที่">${QA_RANGES.map(([k,l])=>`<button type="button" class="qa-chip${QA.rk===k?' on':''}" data-qa-rk="${k}" aria-pressed="${QA.rk===k}">${l}</button>`).join('')}</div>
      ${QA.rk==='custom'?`<div class="qa-dates"><input type="date" id="qaFrom" value="${esc(from)}" aria-label="ตั้งแต่"><span>ถึง</span><input type="date" id="qaTo" value="${esc(to)}" aria-label="ถึง"></div>`:''}
      <div class="qa-row"><span class="qa-rt">${esc(qaRangeText([from,to]))}</span><label class="qa-team">ทีม <select id="qaTeam">${QA_TEAM().map(([v,l])=>`<option value="${v}"${QA.team===v?' selected':''}>${esc(l)}</option>`).join('')}</select></label>
        <input id="qaText" type="search" placeholder="คำค้นแผน (ลูกค้า / คน / PN)" value="${esc(QA.text)}" aria-label="คำค้นแผน"></div></div>
    <div class="qa-grid">${QA_Q.map(q=>`<button type="button" class="qa-q${QA.last===q.id?' on':''}" data-qa-q="${q.id}"><span aria-hidden="true">${q.ic}</span>${esc(q.l)}${q.range?'':' <small>ไม่ใช้ช่วงวัน</small>'}</button>`).join('')}</div>
    ${r?`<div class="qa-res" id="qaRes">${r.why?`<p class="qa-why">${esc(r.why)}</p>`:''}<div class="qa-rh"><b>${esc(r.title)}</b>${r.rows&&r.rows.length?'<button type="button" class="btn sm" data-qa-copy>คัดลอกส่ง LINE</button>':''}</div>
      ${r.loading?'<p class="aa-busy"><span class="aa-spin" aria-hidden="true"></span><span>กำลังค้น…</span></p>':r.err?`<div class="aa-err" role="alert">${esc(r.err)}</div>`:qaTable(r)}${r.note?`<p class="qa-why">${esc(r.note)}</p>`:''}</div>`:'<p class="qa-hint">กดคำถามด้านบน หรือพิมพ์ถาม · ผลขึ้นเป็นตาราง กดเลข PN / JB / Check Sheet / NCR เพื่อเปิด</p>'}`;
  if(scroll){const res=$('#qaRes');if(res)res.scrollIntoView({block:'start',behavior:'smooth'})}else b.scrollTop=keep;
}
function qaPanel(on){
  const p=qaBuild();if(on==null)on=p.hidden;
  if(!on){p.hidden=true;QA.open=false;document.body.classList.remove('aa-lock');const f=$('#qaFab');if(f)f.setAttribute('aria-expanded','false');return}
  if(!qaOn())return;if(typeof aaPanel==='function'&&AA.open)aaPanel(false);if(typeof ntfPanel==='function'&&NTF.open)ntfPanel(false);
  p.hidden=false;QA.open=true;document.body.classList.toggle('aa-lock',window.innerWidth<=760);const f=$('#qaFab');if(f)f.setAttribute('aria-expanded','true');
  qaDraw();setTimeout(()=>{const q=$('#qaQ');if(q&&window.innerWidth>760)q.focus()},50)}
/* the floating button (called at the end of render()) */
function qaSync(){
  const on=qaOn();document.body.classList.toggle('qa-on',on);let f=$('#qaFab');
  if(on&&!f){f=document.createElement('button');f.type='button';f.id='qaFab';f.className='aa-fab';f.setAttribute('data-qa-open','');f.setAttribute('aria-expanded','false');f.title='ถามด่วน: ค้นข้อมูลในระบบ';
    f.innerHTML='<span aria-hidden="true">⚡</span><b>ถามด่วน</b>';document.body.appendChild(f)}
  if(f)f.hidden=!on;if(!on&&QA.open)qaPanel(false);
}
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;
  if(t.closest('[data-qa-open]')){if(typeof AA!=='undefined'&&AA.open)aaPanel(false);qaPanel(true);return}
  if(!t.closest('#qaPanel'))return;
  if(t.closest('[data-qa-close]')){qaPanel(false);return}
  if(t.closest('[data-qa-ask]')){qaAskText();return}
  const rk=t.closest('[data-qa-rk]');if(rk){QA.rk=rk.dataset.qaRk;if(QA.rk==='custom'&&!QA.from){QA.from=ymd(new Date());QA.to=QA.from}qaDraw();if(QA.res&&QA.res.range&&QA.last)qaRun(QA.last);return}
  const q=t.closest('[data-qa-q]');if(q){QA.text=($('#qaText')||{}).value||'';qaRun(q.dataset.qaQ);return}
  if(t.closest('[data-qa-copy]')){if(QA.res&&QA.res.rows)copyText(qaText(QA.res),'คัดลอกแล้ว · วางใน LINE ได้เลย');return}
  const rf=t.closest('[data-qa-ref]');if(rf){const code=rf.dataset.qaRef;if(window.innerWidth<=760)qaPanel(false);
    if(/^NCR-/.test(code)){const n=(S.ncr||[]).find(y=>y.ncrNo===code);goView('ncr');if(n&&typeof openNcr==='function')openNcr(n.id);else toast(`ไม่พบ ${code}`);return}
    qrHandle(code)}
});
document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#qaPanel'))return;
  if(t.id==='qaTeam'){QA.team=t.value;if(QA.last==='free')qaRun('free');return}
  if(t.id==='qaFrom'||t.id==='qaTo'){QA[t.id==='qaFrom'?'from':'to']=t.value;qaDraw();if(QA.res&&QA.res.range&&QA.last)qaRun(QA.last);return}
  if(t.id==='qaText'){QA.text=t.value}
});
document.addEventListener('keydown',e=>{const t=e.target;
  if(e.key==='Enter'&&t&&(t.id==='qaQ'||t.id==='qaText')&&!e.isComposing){e.preventDefault();if(t.id==='qaQ')qaAskText();else{QA.text=t.value;qaRun(QA.last&&QA_Q.find(x=>x.id===QA.last).range?QA.last:'plans')}return}
  if(e.key==='Escape'&&QA.open&&!document.querySelector('dialog[open]'))qaPanel(false)});
window.addEventListener('resize',()=>{if(QA.open)document.body.classList.toggle('aa-lock',window.innerWidth<=760)});
