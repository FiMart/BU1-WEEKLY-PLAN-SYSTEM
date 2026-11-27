'use strict';
/* BU1 Weekly Plan · ⚡ ถามด่วน — no AI, free (user, 27 Nov 2026: "ถ้าถาม ai มีแบบไม่เสียตังไหม หรือถ้าเสียตังตัดออกไปก่อนหรือหาวิธีอื่นๆแทน";
   chose ready-made questions without AI). Redesigned v4.52.1 (user: "ปรับ design และ layout ใหม่เพื่อให้เข้าใจง่าย และเวลาคัดลอกส่ง LINE ให้ใส่
   อีโมจิไปด้วย"; chose grouped questions + the answer on its own screen, LINE text one item a block with an emoji a line).
   Home: typed question (qaParse) + 3 groups (QA_GROUPS: คนและรถ · แผนงาน · งานค้าง; งานค้าง buttons carry counts, qaCounts, 60 s).
   Answer screen: ‹ กลับ, the question's own controls only (date chips for date questions, ทีม for ใครว่าง, คำค้น for แผนงาน), a summary,
   cards (code button + date, then emoji · label · value rows) and a sticky 📋 คัดลอกส่ง LINE (qaLine → lineSplit / copyPartsAsk in share.js).
   Runs the READ-ONLY search tools of js/features/ai-ask.js (AA_TOOLS via aaRun) on data this account can already read; nothing leaves the
   system, nothing is written. Floating button #qaFab for every level but GA; ✨ ถาม AI opens from here only while aaOn(). */
const QA={open:false,view:'home',id:'',rk:'today',from:'',to:'',team:'',text:'',busy:false,res:null,why:'',cnt:{},cntAt:0,cntBusy:false};
const qaOn=()=>!(typeof isGA==='function'&&isGA())&&(S.backend!=='supabase'||!!S.level)&&!!S.tasksReady;
const QA_RANGES=[['today','วันนี้'],['tomorrow','พรุ่งนี้'],['week','สัปดาห์นี้'],['next','สัปดาห์หน้า'],['month','เดือนนี้'],['custom','เลือกวัน']];
function qaRange(k){const t=new Date();const td=ymd(t);
  if(k==='today')return [td,td];if(k==='tomorrow'){const x=ymd(addDays(t,1));return [x,x]}
  if(k==='week'){const m=mondayOf(t);return [ymd(m),ymd(addDays(m,6))]}if(k==='next'){const m=addDays(mondayOf(t),7);return [ymd(m),ymd(addDays(m,6))]}
  if(k==='month')return [ymd(firstOfMonth(t)),ymd(new Date(t.getFullYear(),t.getMonth()+1,0))];
  const a=aaD(QA.from)||td,b=aaD(QA.to)||a;return b<a?[b,a]:[a,b]}
const qaRangeText=([a,b])=>a===b?`${ntfRel(a)}${ntfRel(a)!==fmtDay(a)?` (${fmtDay(a)})`:''}`:`${fmtDay(a)} – ${fmtDay(b)}`;
const QA_TEAM=()=>[['','ทุกทีม'],...WORK_TEAMS.map(t=>[t.id,t.name])];
const qaJoin=v=>Array.isArray(v)?v.filter(Boolean).join(', '):v==null?'':String(v);
const qaCap=(a,b,n)=>aaDays(a,b)>n?ymd(addDays(parseD(a),n)):b;
/* one row of a card: emoji · label · value; ll = keep the label in the LINE text */
/* list = several lines (shown one under another, '•' lines in LINE) */
const qaR=(e,l,v,ll,list)=>list?{e,l,v:Array.isArray(v)?v.filter(Boolean):[],ll:!!ll,list:true}:{e,l,v:qaJoin(v),ll:!!ll};
/* ใครว่าง: people at work grouped by plan → 'PN-… customer: name, name' */
const qaWork=d=>{const m=new Map();d.working.forEach(w=>w.plans.forEach(p=>{if(!m.has(p))m.set(p,[]);m.get(p).push(w.name)}));return [...m].map(([p,n])=>`${p}: ${n.join(', ')}`)};
const qaPlanItem=p=>({code:p.plan_no,top:`${p.day}${p.period&&p.period!=='เช้า,บ่าย'?' '+p.period:''}`,
  rows:[qaR('🛠️','งาน',p.type),qaR('🏭','ลูกค้า',[p.customer,p.location].filter(Boolean).join(' · ')),qaR('👷','ทีม',p.team),qaR('📌','สถานะ',p.late||p.status)]});

/* the questions: g = group, range = uses the date chips, run(ctx) → {sub, count, unit, items:[{code, top, te, rows}], sum?} */
const QA_GROUPS=[['people','👷','คนและรถ','เลือกวันได้'],['plans','📅','แผนงาน',''],['todo','📄','งานค้าง','ตัวเลข = จำนวนที่ค้างอยู่ตอนนี้']];
const QA_Q=[
  {id:'free',g:'people',ic:'🙋',l:'ใครว่าง / ใครลา',d:'คนว่าง · ทำงาน · ลา รายวัน',range:1,team:1,async run(c){const to=qaCap(c.from,c.to,31);const r=await aaRun('people_on',{date_from:c.from,date_to:to,team:c.team});
    const one=r.items.length===1?r.items[0]:null;
    return {sub:`${qaRangeText([c.from,to])} · ${r.team}`,count:r.people,unit:'คน',sum:one?[['🟢',one.free.length,'ว่าง'],['🔵',one.working.length,'ทำงาน'],['🟠',one.leave.length,'ลา']]:null,
      items:r.items.map(d=>({top:d.day+(d.holiday?` · ${d.holiday}`:d.weekend?' · วันหยุด':''),
        rows:[qaR('🟢',`ว่าง ${d.free.length} คน`,d.free.length?d.free:'—',true),qaR('🔵',`ทำงาน ${d.working.length} คน`,qaWork(d),true,true),...(d.leave.length?[qaR('🟠',`ลา ${d.leave.length} คน`,d.leave.map(l=>`${l.name} (${l.kind})`),true)]:[])]}))}}},
  {id:'short',g:'people',ic:'🧩',l:'ทีมยังไม่ครบ',d:'แผนที่คนยังไม่พอ',range:1,async run(c){const r=await aaRun('find_plans',{date_from:c.from,date_to:c.to,limit:200});const l=r.items.filter(p=>/ขาด/.test(p.team_need||''));
    return {sub:qaRangeText([c.from,c.to]),count:l.length,unit:'แผน',items:l.map(p=>({code:p.plan_no,top:p.day,rows:[qaR('🧩','ต้องการ',p.team_need,true),qaR('👷','ทีมตอนนี้',p.team,true),qaR('🏭','ลูกค้า',p.customer)]}))}}},
  {id:'ga',g:'people',ic:'🚐',l:'รอรถ GA',d:'ขอรถ GA แล้ว ยังไม่ได้รถ',range:1,async run(c){const to=qaCap(c.from,c.to,31);const r=await aaRun('vehicles_on',{date_from:c.from,date_to:to});const items=[];
    r.items.forEach(d=>d.plans.filter(p=>p.ga).forEach(p=>items.push({code:p.plan_no,top:d.day,rows:[qaR('🏭','ลูกค้า',p.customer),qaR('🚐','วิธีเดินทาง',p.vehicle)]})));
    return {sub:qaRangeText([c.from,to]),count:items.length,unit:'แผน',items}}},
  {id:'cars',g:'people',ic:'🚗',l:'รถแผนกว่าง / ใช้งาน',d:'รถแผนกแต่ละวัน',range:1,async run(c){const to=qaCap(c.from,c.to,31);const r=await aaRun('vehicles_on',{date_from:c.from,date_to:to});
    return {sub:qaRangeText([c.from,to]),count:r.vehicles.length,unit:'คัน',items:r.items.map(d=>({top:d.day,rows:[qaR('🟢','ว่าง',d.free_vehicles.length?d.free_vehicles:'—',true),qaR('🚗','ใช้งาน',d.plans.filter(p=>p.vehicle).map(p=>`${p.plan_no} ${p.vehicle}`),true)]}))}}},
  {id:'plans',g:'plans',ic:'📋',l:'แผนงานในช่วงนี้',d:'ค้นตามลูกค้า / คน / PN ได้',range:1,text:1,async run(c){const r=await aaRun('find_plans',{date_from:c.from,date_to:c.to,text:c.text,limit:200});
    return {sub:`${qaRangeText([c.from,c.to])}${c.text?` · "${c.text}"`:''}`,count:r.count,unit:'แผน',items:r.items.map(qaPlanItem),note:r.note}}},
  {id:'late',g:'plans',ic:'⏰',l:'เลยวันแล้วยังไม่ปิด',d:'60 วันล่าสุด',async run(){const r=await aaRun('find_plans',{date_from:ymd(addDays(new Date(),-60)),date_to:ymd(addDays(new Date(),-1)),status:'late',limit:200});
    return {sub:'60 วันล่าสุด',count:r.count,unit:'แผน',items:r.items.map(qaPlanItem)}}},
  {id:'docs',g:'todo',ic:'📎',l:'เอกสารหลังจบงานไม่ครบ',d:'30 วันล่าสุด',async run(){const r=await aaRun('find_plans',{date_from:ymd(addDays(new Date(),-30)),date_to:ymd(new Date()),status:'done',limit:200});const l=r.items.filter(p=>p.docs_missing);
    return {sub:'30 วันล่าสุด',count:l.length,unit:'แผน',items:l.map(p=>({code:p.plan_no,top:p.day,rows:[qaR('🏭','ลูกค้า',p.customer),qaR('❗','ขาด',p.docs_missing,true),qaR('👷','ทีม',p.team)]}))}}},
  {id:'odoc',g:'todo',ic:'🗂️',l:'เอกสาร Onsite เลย Final',d:'90 วันล่าสุด',async run(){const r=await aaRun('onsite_docs',{date_from:ymd(addDays(new Date(),-90)),date_to:ymd(new Date()),status:'follow'});
    return {sub:'90 วันล่าสุด',count:r.count,unit:'งาน',items:r.items.map(x=>({code:x.plan_no,top:fmtDay(x.date),rows:[qaR('🏭','ลูกค้า',x.customer),qaR('👤','Lead',x.lead,true),qaR('⏰','เลย Final',x.over_days?`${x.over_days} วัน`:'',true),qaR('❗','ขาด',x.missing,true)]}))}}},
  {id:'req',g:'todo',ic:'📝',l:'ใบรับคำร้องรอ Planner',d:'รอรับงาน / รอ review',async run(){const a=await aaRun('find_requests',{state:'pending'}),b=await aaRun('find_requests',{state:'review'});const l=a.items.concat(b.items);
    return {sub:'ทั้งหมดที่ค้าง',count:l.length,unit:'ใบ',items:l.map(j=>({code:j.request_no,top:j.review||j.state,te:'📌',rows:[qaR('🏭','ลูกค้า',j.customer),qaR('💼','Sale',j.sale,true),qaR('🗓️','ต้องการ',j.want,true),qaR('⏱️','ตอบรับ',j.answer||'')]}))}}},
  {id:'cs',g:'todo',ic:'✅',l:'Check Sheet รออนุมัติ / ตีกลับ',d:'',async run(){const a=await aaRun('find_check_sheets',{state:'submitted'}),b=await aaRun('find_check_sheets',{state:'rejected'});const l=a.items.concat(b.items);
    return {sub:'ทั้งหมดที่ค้าง',count:l.length,unit:'ใบ',items:l.map(x=>({code:x.no,top:x.state,te:'📌',rows:[qaR('📋','ฟอร์ม',x.form),qaR('🔖','PN',x.plan_no,true),qaR('👤','ส่งโดย',x.sent_by||'',true),qaR('📝','หมายเหตุ',x.reject_reason||x.flow||'')]}))}}},
  {id:'ncr',g:'todo',ic:'⚠️',l:'NCR ที่ยังเปิดอยู่',d:'',async run(){const r=await aaRun('find_ncr',{state:'open'});const od=r.items.filter(n=>n.overdue).length;
    return {sub:od?`เกินกำหนด ${od} ใบ`:'ทั้งหมดที่เปิดอยู่',count:r.count,unit:'ใบ',items:r.items.map(n=>({code:n.ncr_no,top:n.due?`กำหนด ${fmtDay(n.due)}${n.overdue?' · เกินกำหนด':''}`:'ไม่มีกำหนด',te:'⏰',
      rows:[qaR('🏭','ลูกค้า',n.customer),qaR('🔖','PN',n.plan_no,true),qaR('⚠️','ปัญหา',n.issue),qaR('👤','ผู้รับผิดชอบ',n.owner,true)]}))}}}
];
const qaQ=id=>QA_Q.find(x=>x.id===id)||null;

/* a typed question → {q, rk, team, text} by keywords; anything else = plans with search words */
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

/* ---------- LINE text: a head, then one block an item, an emoji a line ---------- */
const QA_NUM=['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
function qaLineParts(){const r=QA.res,Q=qaQ(QA.id);if(!r||!Q)return [];
  const head=[`${Q.ic} ${Q.l}`,`🗓️ ${r.sub} · ${r.count} ${r.unit}`];
  if(r.sum)head.push(r.sum.map(([e,n,l])=>`${e} ${l} ${n}`).join(' · '));
  const blocks=r.items.map((x,i)=>{const first=[x.code?`🔖 ${x.code}`:'',x.top?`${x.te||'📅'} ${x.top}`:''].filter(Boolean).join(' · ');
    return [`${QA_NUM[i]||`▪️ ${i+1}.`} ${first}`,...x.rows.filter(w=>w.list?w.v.length:w.v).map(w=>w.list?[`${w.e} ${w.l}`,...w.v.map(s=>`   • ${s}`)].join('\n'):`${w.e} ${w.ll?w.l+': ':''}${w.v}`)].join('\n')});
  if(!blocks.length)blocks.push('✅ ไม่มีรายการ');
  return lineSplit(head,blocks)}
function qaCopy(){const parts=qaLineParts();if(!parts.length)return;const Q=qaQ(QA.id);
  if(parts.length===1){copyText(parts[0],'คัดลอกแล้ว · วางใน LINE ได้เลย');return}
  copyPartsAsk(parts,Q.l,p=>{const n=(p.match(/^(?:\d️⃣|🔟|▪️ \d+\.) /gmu)||[]).length;return n?`${n} รายการ · `:''})}

/* ---------- running ---------- */
async function qaRun(id,why){
  const Q=qaQ(id);if(!Q)return;const [from,to]=qaRange(QA.rk);
  QA.view='res';QA.id=id;QA.why=why||'';QA.busy=true;QA.res=null;qaDraw();const tok=QA.tok=(QA.tok||0)+1;
  let res;try{res=await Q.run({from,to,team:QA.team,text:QA.text.trim()})}catch(e){res={err:String(e&&e.message||e),items:[],count:0,unit:'',sub:''}}
  if(tok!==QA.tok)return;/* a newer question was asked meanwhile */
  QA.busy=false;QA.res=res;qaDraw();const b=$('#qaBody');if(b)b.scrollTop=0;
}
function qaAskText(){const i=$('#qaQ');const s=i?i.value.trim():'';if(!s)return;const p=qaParse(s);
  if(p.rk)QA.rk=p.rk;if(p.q==='free')QA.team=p.team;QA.text=p.text;const Q=qaQ(p.q);
  qaRun(p.q,`จาก "${s}" → ${Q.l}${Q.range?` · ${qaRangeText(qaRange(QA.rk))}`:''}${p.q==='free'&&QA.team?` · ${TEAM[QA.team].name}`:''}${p.text?` · คำค้น "${p.text}"`:''}`)}
/* counts on the งานค้าง buttons (and เลยวัน): quiet, at most once a minute */
async function qaCounts(){if(QA.cntBusy||Date.now()-QA.cntAt<60000)return;QA.cntBusy=true;
  try{for(const id of ['late','docs','odoc','req','cs','ncr']){try{const r=await qaQ(id).run({});QA.cnt[id]=r.count}catch(e){}}QA.cntAt=Date.now()}
  finally{QA.cntBusy=false;if(QA.open&&QA.view==='home')qaDraw()}}

/* ---------- drawing ---------- */
const qaCell=v=>esc(v).replace(AA_REF,m=>`<button type="button" class="aa-ref" data-qa-ref="${m}">${m}</button>`);
function qaCard(x,i){
  return `<li class="qa-card"><div class="qa-ch"><span class="qa-n">${i+1}</span>${x.code?`<button type="button" class="aa-ref" data-qa-ref="${esc(x.code)}">${esc(x.code)}</button>`:''}${x.top?`<b>${esc(x.top)}</b>`:''}</div>
    <dl>${x.rows.filter(w=>w.list?w.v.length:w.v).map(w=>`<div><dt><span aria-hidden="true">${w.e}</span>${esc(w.l)}</dt><dd>${w.list?`<ul class="qa-ul">${w.v.map(s=>`<li>${qaCell(s)}</li>`).join('')}</ul>`:qaCell(w.v)}</dd></div>`).join('')}</dl></li>`}
function qaHome(){
  const typed=$('#qaQ')?$('#qaQ').value:'';
  return `<form class="qa-ask" onsubmit="return false"><input id="qaQ" type="search" maxlength="200" placeholder="พิมพ์ถาม เช่น พรุ่งนี้ใครว่าง · งานของ PTT สัปดาห์นี้" aria-label="พิมพ์คำถาม" value="${esc(typed)}"><button type="button" class="btn primary" data-qa-ask>ถาม</button></form>
    ${QA_GROUPS.map(([g,ic,l,d])=>`<section class="qa-g"><h3><span aria-hidden="true">${ic}</span>${esc(l)}${d?`<small>${esc(d)}</small>`:''}</h3><div class="qa-grid">${QA_Q.filter(q=>q.g===g).map(q=>{const n=QA.cnt[q.id];
      return `<button type="button" class="qa-q" data-qa-q="${q.id}"><span class="qa-ic" aria-hidden="true">${q.ic}</span><span class="qa-qt"><b>${esc(q.l)}</b>${q.d?`<small>${esc(q.d)}</small>`:''}</span>${n!=null?`<em class="qa-cnt${n?' has':''}" aria-label="${n} รายการ">${n}</em>`:''}</button>`}).join('')}</div></section>`).join('')}`}
function qaResult(){
  const Q=qaQ(QA.id);const r=QA.res;const [from,to]=qaRange(QA.rk);
  const ctl=Q.range||Q.team||Q.text?`<div class="qa-ctl">${Q.range?`<div class="qa-chips" role="group" aria-label="ช่วงวันที่">${QA_RANGES.map(([k,l])=>`<button type="button" class="qa-chip${QA.rk===k?' on':''}" data-qa-rk="${k}" aria-pressed="${QA.rk===k}">${l}</button>`).join('')}</div>
      ${QA.rk==='custom'?`<div class="qa-dates"><input type="date" id="qaFrom" value="${esc(from)}" aria-label="ตั้งแต่"><span>ถึง</span><input type="date" id="qaTo" value="${esc(to)}" aria-label="ถึง"></div>`:''}`:''}
      ${Q.team||Q.text?`<div class="qa-row">${Q.team?`<label class="qa-team">ทีม <select id="qaTeam">${QA_TEAM().map(([v,l])=>`<option value="${v}"${QA.team===v?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`:''}
        ${Q.text?`<input id="qaText" type="search" placeholder="ค้นลูกค้า / คน / PN แล้วกด Enter" value="${esc(QA.text)}" aria-label="คำค้นแผน">`:''}</div>`:''}</div>`:'';
  const sum=!r?'':r.err?`<div class="aa-err" role="alert">${esc(r.err)}</div>`:`<div class="qa-sum"><b>${r.count}</b><span>${esc(r.unit)}${r.sub?` · ${esc(r.sub)}`:''}</span>${r.sum?`<span class="qa-sumx">${r.sum.map(([e,n,l])=>`<i>${e} ${esc(l)} <b>${n}</b></i>`).join('')}</span>`:''}</div>`;
  return `${ctl}${QA.why?`<p class="qa-why">${esc(QA.why)}</p>`:''}
    ${QA.busy?'<p class="aa-busy qa-load"><span class="aa-spin" aria-hidden="true"></span><span>กำลังค้น…</span></p>':`${sum}
      ${r&&!r.err?(r.items.length?`<ol class="qa-list">${r.items.map(qaCard).join('')}</ol>`:'<p class="qa-none">✅ ไม่มีรายการ</p>'):''}${r&&r.note?`<p class="qa-why">${esc(r.note)}</p>`:''}`}`}
function qaBuild(){
  let p=$('#qaPanel');if(p)return p;
  p=document.createElement('section');p.id='qaPanel';p.className='aa-panel qa-panel';p.hidden=true;p.setAttribute('aria-label','ถามด่วน');
  p.innerHTML='<header class="aa-head" id="qaHead"></header><div class="aa-log qa-body" id="qaBody"></div><footer class="qa-foot" id="qaFoot" hidden></footer>';
  document.body.appendChild(p);return p}
function qaDraw(){
  const p=$('#qaPanel');if(!p||p.hidden)return;const home=QA.view==='home';const Q=qaQ(QA.id);
  const ai=typeof aaOn==='function'&&aaOn()?'<button type="button" class="btn sm" data-aa-open title="ถามเป็นภาษาพูดด้วย AI (มีค่าใช้จ่าย)">✨ ถาม AI</button>':'';
  $('#qaHead').innerHTML=home?`<span class="aa-logo" aria-hidden="true">⚡</span><div><b>ถามด่วน</b><small>ค้นจากข้อมูลในระบบทันที · ไม่ใช้ AI · ไม่มีค่าใช้จ่าย</small></div><span class="grow"></span>${ai}<button type="button" class="icon-btn sm" data-qa-close aria-label="ปิด">✕</button>`
    :`<button type="button" class="btn sm ghost qa-back" data-qa-home aria-label="กลับไปหน้าคำถาม">‹ กลับ</button><div class="qa-ht"><b><span aria-hidden="true">${Q.ic}</span> ${esc(Q.l)}</b></div><span class="grow"></span><button type="button" class="icon-btn sm" data-qa-close aria-label="ปิด">✕</button>`;
  $('#qaBody').innerHTML=home?qaHome():qaResult();
  const f=$('#qaFoot');const can=!home&&!QA.busy&&QA.res&&!QA.res.err;f.hidden=!can;
  f.innerHTML=can?`<button type="button" class="btn primary qa-copy" data-qa-copy>📋 คัดลอกส่ง LINE</button>`:'';
  if(home)qaCounts();
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
  if(t.closest('[data-qa-home]')){QA.view='home';QA.tok=(QA.tok||0)+1;QA.busy=false;qaDraw();return}
  if(t.closest('[data-qa-ask]')){qaAskText();return}
  const q=t.closest('[data-qa-q]');if(q){QA.why='';if(q.dataset.qaQ!=='plans')QA.text='';qaRun(q.dataset.qaQ);return}
  const rk=t.closest('[data-qa-rk]');if(rk){QA.rk=rk.dataset.qaRk;if(QA.rk==='custom'&&!QA.from){QA.from=ymd(new Date());QA.to=QA.from}QA.why='';qaRun(QA.id);return}
  if(t.closest('[data-qa-copy]')){qaCopy();return}
  const rf=t.closest('[data-qa-ref]');if(rf){const code=rf.dataset.qaRef;if(window.innerWidth<=760)qaPanel(false);
    if(/^NCR-/.test(code)){const n=(S.ncr||[]).find(y=>y.ncrNo===code);goView('ncr');if(n&&typeof openNcr==='function')openNcr(n.id);else toast(`ไม่พบ ${code}`);return}
    qrHandle(code)}
});
document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#qaPanel'))return;
  if(t.id==='qaTeam'){QA.team=t.value;QA.why='';qaRun(QA.id);return}
  if(t.id==='qaFrom'||t.id==='qaTo'){QA[t.id==='qaFrom'?'from':'to']=t.value;QA.why='';qaRun(QA.id)}
});
document.addEventListener('keydown',e=>{const t=e.target;
  if(e.key==='Enter'&&t&&(t.id==='qaQ'||t.id==='qaText')&&!e.isComposing){e.preventDefault();if(t.id==='qaQ')qaAskText();else{QA.text=t.value;QA.why='';qaRun('plans')}return}
  if(e.key==='Escape'&&QA.open&&!document.querySelector('dialog[open]')){if(QA.view==='res'){QA.view='home';qaDraw()}else qaPanel(false)}});
window.addEventListener('resize',()=>{if(QA.open)document.body.classList.toggle('aa-lock',window.innerWidth<=760)});
