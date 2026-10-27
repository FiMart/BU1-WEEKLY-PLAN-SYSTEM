'use strict';
/* BU1 Weekly Plan · รายงานแผนตอนเช้า (user, 27 Oct 2026: "เพิ่มการติ๊กรายงานแผนตอนเช้าพร้อมสรุปว่าใครบ้างที่ไม่รายงาน
   ใช้เป็นส่วนหนึ่งของการประเมินวินัย"; chose: the person ticks it, the Planner may correct it with a reason · everyone in the
   Team Service of a plan that day · by 08:30, later = ช้า · day + month per person, seen by admin / Planner only)
   Who must report on a day (mrNeed): active staff in the Team Service of a plan of that day that still holds its team (not
   เลื่อน / ยกเลิก), minus anyone on a full-day leave plan. Days without a plan need nothing.
   Record = entity "mrep" ↔ app_settings row bu1wp_mrep:<YYYY-MM-DD>_<staffId> = {month, date, staffId, time 'HH:MM' (local),
   at (ISO), due (deadline then), src self|lead, by, ex (ยกเว้น), reason, hist [{at, by, txt}]}; one row per person per day,
   so people reporting at the same time never overwrite each other. A Planner's change keeps the history (never deleted).
   Status (mrSt): ok (time ≤ due) · late · ex · miss (no report; today only after the deadline) · wait (today, before it).
   Who am I (mrMe): on the central database the e-mail bound to a staff member in ข้อมูลหลัก › รายงานแผนตอนเช้า
   (S.cfg.staffAcct {staffId: e-mail}), else the one active staff member named like the account; offline = "ฉันคือพนักงาน".
   The page (view mrep), the month summary and the binding are for admin / Planner (isPlanner); everyone sees their own state
   in งานของฉัน. Notices: js/features/notify.js category mrep. */
const MR_ST={ok:{th:'ตรงเวลา',c:'var(--good)'},late:{th:'ช้า',c:'var(--warn)'},miss:{th:'ไม่รายงาน',c:'var(--crit)'},wait:{th:'ยังไม่ถึงเวลา',c:'var(--muted)'},ex:{th:'ยกเว้น',c:'var(--accent)'}};
S.mr={tab:'day',day:'',month:'',edit:'',q:''};
const mrCfg=()=>{const c=(S.cfg&&S.cfg.mrep)||{};return {time:/^\d\d:\d\d$/.test(c.time||'')?c.time:'08:30'}};
const mrAcct=()=>S.cfg&&S.cfg.staffAcct&&typeof S.cfg.staffAcct==='object'?S.cfg.staffAcct:{};
const mrHM=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const mrToday=()=>ymd(new Date());
const mrDay=()=>S.mr.day||mrToday();
const mrMonth=()=>S.mr.month||mrToday().slice(0,7);
const mrOk=()=>isPlanner();
function mrMe(){
  if(S.backend!=='supabase')return typeof ntfMeStaff==='function'?ntfMeStaff():'';
  const me=String(S.me||'').trim().toLowerCase();if(!me)return '';const A=mrAcct();
  const hit=Object.keys(A).find(id=>String(A[id]||'').trim().toLowerCase()===me&&staffById(id));if(hit)return hit;
  const n=S.account&&S.account.name;if(!n)return '';const k=mdKey(n,true);
  const l=S.staff.filter(s=>s.active!==false&&!A[s.id]&&mdKey(s.name,true)===k);return l.length===1?l[0].id:'';
}
/* Map staffId → [plans] of the people who must report on day k */
function mrNeed(list,k){
  const m=new Map(),off=new Set();
  (list||[]).forEach(t=>{if(t.date!==k)return;
    if(isLeave(t)){if((t.period||'full')==='full')(t.staffIds||[]).forEach(id=>off.add(id));return}
    if(!holdsTeam(t))return;
    (t.staffIds||[]).forEach(id=>{const s=staffById(id);if(!s||s.active===false)return;if(!m.has(id))m.set(id,[]);m.get(id).push(t)})});
  off.forEach(id=>m.delete(id));return m;
}
/* the records of a month (cached like rangeTasks; read again after a write, every 30 s on the page and on tab focus) */
function mrRows(month){
  const k='mr|'+month;let e=RC.get(k);if(!e){e={data:null,stale:true,loading:false};RC.set(k,e)}
  if(e.stale&&!e.loading){e.loading=true;const g=e.gen||0;const had=e.data;let changed=!had;
    const fn=()=>Store.where('mrep','month','==',month);
    (had?quietly(fn):fn()).then(d=>{changed=changed||JSON.stringify(d)!==JSON.stringify(had);e.data=d}).catch(()=>{if(!e.data)e.data=[]})
      .finally(()=>{e.stale=(e.gen||0)!==g;e.loading=false;if(changed||e.stale)render()})}
  return e.data;
}
function mrInvalidate(){RC.forEach((e,k)=>{if(k.startsWith('mr|')){e.stale=true;e.gen=(e.gen||0)+1}})}
const mrRec=(rows,k,id)=>(rows||[]).find(r=>r.date===k&&r.staffId===id)||null;
function mrSt(rec,k){
  if(rec&&rec.ex)return 'ex';
  if(rec&&rec.time)return rec.time<=(rec.due||mrCfg().time)?'ok':'late';
  const td=mrToday();if(k>td)return '';if(k===td&&mrHM(new Date())<=mrCfg().time)return 'wait';
  return 'miss';
}
const mrChip=(st,rec)=>st?`<span class="mr-st mr-${st}">${MR_ST[st].th}${rec&&rec.time&&!rec.ex?` · ${esc(rec.time)} น.`:''}</span>`:'';
const mrPlanTxt=t=>[t.planNo,t.customer].filter(Boolean).join(' · ')||typeLabel(t);
/* write one person-day; the history line says what changed */
async function mrPut(k,id,patch,txt){
  const rows=mrRows(k.slice(0,7));const cur=mrRec(rows,k,id)||{};
  const rec=Object.assign({},cur,{month:k.slice(0,7),date:k,staffId:id},patch);delete rec.id;delete rec.dept_id;
  rec.hist=(Array.isArray(cur.hist)?cur.hist:[]).concat([{at:new Date().toISOString(),by:S.me||null,txt}]).slice(-20);
  await Store.set('mrep',`${k}_${id}`,rec);
  const e=RC.get('mr|'+k.slice(0,7));if(e&&e.data){e.data=e.data.filter(r=>!(r.date===k&&r.staffId===id)).concat([Object.assign({id:`${k}_${id}`},rec)])}
  mrInvalidate();render();
}
async function mrSelf(){
  const id=mrMe();const k=mrToday();if(!id){toast('บัญชีนี้ยังไม่ได้ผูกกับชื่อพนักงาน ให้ Planner ผูกที่ ข้อมูลหลัก › รายงานแผนตอนเช้า');return}
  const now=new Date();const time=mrHM(now);const due=mrCfg().time;
  try{await mrPut(k,id,{time,at:now.toISOString(),due,src:'self',by:S.me||null,ex:false,reason:''},`รายงานเอง ${time} น.`);
    toast(time<=due?`รายงานแผนแล้ว ${time} น. · ตรงเวลา`:`รายงานแผนแล้ว ${time} น. · ช้ากว่า ${due} น.`)}
  catch(err){toast(errText(err));noteWriteError(err)}
}

/* ---------- งานของฉัน: the person's own box ---------- */
function mrMyHtml(){
  const id=mrMe();const k=mrToday();const due=mrCfg().time;
  if(!id)return S.backend==='supabase'&&S.staff.length?`<section class="panel mr-my none"><b>รายงานแผนตอนเช้า</b><span class="hint">บัญชีนี้ยังไม่ได้ผูกกับชื่อพนักงาน · ถ้าคุณเป็นพนักงานที่ออกงาน ให้ Planner ผูกบัญชีที่ ข้อมูลหลัก › รายงานแผนตอนเช้า</span></section>`:'';
  const tasks=typeof ntfTasks==='function'?ntfTasks():S.tasks;const need=mrNeed(tasks,k).get(id);
  if(!need)return `<section class="panel mr-my none"><b>รายงานแผนตอนเช้า</b><span class="hint">วันนี้ ${esc(staffName(id))} ไม่มีแผนงาน · ไม่ต้องรายงาน</span></section>`;
  const rows=mrRows(k.slice(0,7));const rec=mrRec(rows,k,id);const st=rows?mrSt(rec,k):'';
  const plans=`<ul class="mr-plans">${need.map(t=>`<li><button type="button" class="lnk" data-edit="${esc(t.id)}">${esc(mrPlanTxt(t))}</button> <small>${esc(typeLabel(t))}${t.timeNote?' · '+esc(t.timeNote):''}</small></li>`).join('')}</ul>`;
  const done=rec&&(rec.time||rec.ex);
  return `<section class="panel mr-my${done?' done':st==='miss'?' miss':''}"><div class="mr-myh"><b>รายงานแผนตอนเช้า</b><span class="hint">${esc(staffName(id))} · วันนี้ ${need.length} แผน · รายงานภายใน ${esc(due)} น.</span>${st?mrChip(st,rec):''}</div>${plans}
    ${!rows?loading():done?`<p class="mr-done">✓ ${rec.ex?`ยกเว้นโดยหัวหน้า${rec.reason?' · '+esc(rec.reason):''}`:`รายงานแล้ว ${esc(rec.time)} น.${rec.src==='lead'?' (หัวหน้าบันทึกให้)':''}`}</p>`
      :`<button type="button" class="btn primary mr-go" data-mr-self>✓ รายงานแผนวันนี้</button>${st==='miss'?`<small class="mr-lnote">เลย ${esc(due)} น. แล้ว · รายงานตอนนี้จะนับเป็น "ช้า"</small>`:''}`}</section>`;
}

/* ---------- the page (admin / Planner) ---------- */
function mrDayData(k){
  const tasks=rangeTasks(k,k);const rows=mrRows(k.slice(0,7));if(!tasks||!rows)return null;
  const need=mrNeed(tasks,k);
  const list=[...need].map(([id,plans])=>{const rec=mrRec(rows,k,id);return {id,s:staffById(id),plans,rec,st:mrSt(rec,k)}});
  const ord={miss:0,wait:1,late:2,ok:3,ex:4};list.sort((a,b)=>(ord[a.st]??9)-(ord[b.st]??9)||sortPeople(a.s,b.s));
  const c={n:list.length};Object.keys(MR_ST).forEach(x=>c[x]=list.filter(r=>r.st===x).length);return {k,list,c};
}
function mrMonthData(m){
  const [y,mo]=m.split('-').map(Number);const from=`${m}-01`,last=ymd(new Date(y,mo,0));const to=last<mrToday()?last:mrToday();
  if(from>to)return {m,people:[],days:[],empty:true};
  const tasks=rangeTasks(from,last);const rows=mrRows(m);if(!tasks||!rows)return null;
  const days=[];for(let d=parseD(from);ymd(d)<=last;d=addDays(d,1))days.push(ymd(d));
  const P=new Map();
  days.filter(k=>k<=to).forEach(k=>{mrNeed(tasks,k).forEach((plans,id)=>{if(!P.has(id))P.set(id,{id,s:staffById(id),need:0,ok:0,late:0,miss:0,wait:0,ex:0,day:{}});
    const p=P.get(id);const rec=mrRec(rows,k,id);const st=mrSt(rec,k);p.day[k]={st,rec,plans};if(st==='wait')return;p.need++;p[st]++})});
  const people=[...P.values()].filter(p=>p.need).map(p=>/* someone whose only day is today before the deadline has nothing to count yet */Object.assign(p,{rate:p.need-p.ex>0?Math.round(p.ok/(p.need-p.ex)*100):null}))
    .sort((a,b)=>b.miss-a.miss||b.late-a.late||sortPeople(a.s,b.s));
  const tot=people.reduce((a,p)=>{['need','ok','late','miss','ex'].forEach(x=>a[x]+=p[x]);return a},{need:0,ok:0,late:0,miss:0,ex:0});
  tot.rate=tot.need-tot.ex>0?Math.round(tot.ok/(tot.need-tot.ex)*100):null;
  return {m,days,to,people,tot};
}
/* layout (user, 27 Oct 2026: "ปรับ design และ layout … ให้พอดีสัดส่วนทั้ง web และ mobile"): a date / month bar, one summary
   (progress + one stacked bar + chips that filter, S.mr.st), then people as cards in groups — the same on every screen,
   one column on phones. The month keeps its table with day cells on wide screens and turns into person cards on phones. */
const MR_ORDER=['miss','wait','late','ok','ex'];
const mrWho=r=>r&&r.src?`${r.src==='self'?'รายงานเอง':'หัวหน้าบันทึก'}${r.src==='lead'&&r.by?' ('+String(r.by).split('@')[0]+')':''}`:'';
function mrEditHtml(r){
  const rec=r.rec||{};const cur=rec.ex?'ex':rec.time?'rep':'none';
  return `<div class="mr-ef"><div class="seg" role="radiogroup" aria-label="สถานะ"><label><input type="radio" name="mr-e-st" value="rep"${cur==='rep'?' checked':''}><span>รายงานแล้ว</span></label><label><input type="radio" name="mr-e-st" value="ex"${cur==='ex'?' checked':''}><span>ยกเว้น</span></label><label><input type="radio" name="mr-e-st" value="none"${cur==='none'?' checked':''}><span>ไม่รายงาน</span></label></div>
    <label class="mr-et">เวลาที่รายงาน <input type="time" id="mr-e-time" value="${esc(rec.time||mrCfg().time)}"></label>
    <label class="mr-ew">เหตุผล (ต้องใส่) <input type="text" id="mr-e-why" maxlength="200" placeholder="เช่น รายงานในกลุ่ม LINE 08:10 · ไปส่งเครื่องตั้งแต่เช้า" value="" autocomplete="off"></label>
    <div class="mr-eb"><button type="button" class="btn primary sm" data-mr-save="${esc(r.id)}">บันทึก</button><button type="button" class="btn sm" data-mr-cancel>ยกเลิก</button></div>
    ${Array.isArray(rec.hist)&&rec.hist.length?`<details class="mr-hist"><summary>ประวัติ ${rec.hist.length} ครั้ง</summary><ol>${rec.hist.slice().reverse().map(h=>`<li>${esc(jbWhen(h.at))} · ${esc(String(h.by||'').split('@')[0]||'—')} · ${esc(h.txt||'')}</li>`).join('')}</ol></details>`:''}</div>`;
}
function mrCard(r,k){
  const rec=r.rec||{};const ed=S.mr.edit===`${k}_${r.id}`;const nm=r.s?r.s.name:r.id;
  const sub=[r.s&&r.s.role,r.s&&teamOf(r.s)?teamName(teamOf(r.s)):''].filter(Boolean).join(' · ');
  return `<article class="mr-card mr-${r.st}${ed?' open':''}"><div class="mr-ch"><span class="mr-av" aria-hidden="true">${esc(initialOf(nm))}</span>
      <span class="mr-nm"><b>${esc(nm)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span>${mrChip(r.st,rec)}</div>
    <div class="mr-pls">${r.plans.map(t=>`<button type="button" class="mr-pl" data-edit="${esc(t.id)}" style="--c:${planColor(t)}" title="${esc(mrPlanTxt(t))} · กดเพื่อเปิดแผน"><i></i><span>${esc(mrPlanTxt(t))}</span></button>`).join('')}</div>
    ${rec.src||rec.reason||can('master')?`<div class="mr-cf"><span>${esc(mrWho(rec))}${rec.reason?`${rec.src?' · ':''}${esc(rec.reason)}`:''}</span>${can('master')?`<button type="button" class="lnk" data-mr-edit="${esc(r.id)}" aria-expanded="${ed}">${ed?'ปิด':'แก้ไข'}</button>`:''}</div>`:''}
    ${ed?mrEditHtml(r):''}</article>`;
}
/* progress + one bar + chips (counts; a chip filters the cards) */
function mrSumHtml(c,pct,lead,lbl,keys){
  const tot=Math.max(1,keys.reduce((a,x)=>a+(c[x]||0),0));
  const chip=(x,n,t)=>`<button type="button" class="mr-fc${x?' mr-'+x:''}${(S.mr.st||'')===x?' on':''}" data-mr-st="${x}" aria-pressed="${(S.mr.st||'')===x}">${x?'<i></i>':''}${t}<b>${n}</b></button>`;
  return `<div class="mr-sum"><div class="mr-big"><span>${esc(lbl)}</span><b>${pct==null?'–':pct+'%'}</b><small>${lead}</small></div>
    <div class="mr-mid"><div class="mr-bar" role="img" aria-label="${esc(keys.map(x=>`${MR_ST[x].th} ${c[x]||0}`).join(' · '))}">${keys.map(x=>c[x]?`<i class="mr-${x}" style="flex:${c[x]/tot}" title="${MR_ST[x].th} ${c[x]}"></i>`:'').join('')||'<i class="mr-none" style="flex:1"></i>'}</div>
      <div class="mr-fcs">${chip('',c.n,'ทั้งหมด')}${keys.filter(x=>c[x]).map(x=>chip(x,c[x],x==='wait'?'รอถึงเวลา':MR_ST[x].th)).join('')}</div></div></div>`;
}
function mrDayHtml(){
  const k=mrDay();const D=mrDayData(k);const d=parseD(k);const due=mrCfg().time;const td=mrToday();
  const left=k===td?(()=>{const [h,m]=due.split(':').map(Number);const n=new Date();const mins=h*60+m-(n.getHours()*60+n.getMinutes());return mins>=0?`อีก ${mins>=60?Math.floor(mins/60)+' ชม. ':''}${mins%60} นาที`:'เลยเวลาแล้ว'})():k<td?'ผ่านไปแล้ว':'ยังไม่ถึงวัน';
  const bar=`<div class="mr-bar1"><div class="mr-nav"><button type="button" class="icon-btn" data-mr-day="-1" aria-label="วันก่อน">‹</button>
      <button type="button" class="mr-pick" data-cal="mrep" aria-haspopup="dialog" aria-expanded="${CAL.el&&!CAL.el.hidden&&CAL.from==='mrep'}" title="เลือกวัน">${PICK_DATE_ICON}<span><b>${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)}</b>${k===td?'<small>วันนี้</small>':''}</span></button>
      <button type="button" class="icon-btn" data-mr-day="1" aria-label="วันถัดไป">›</button>${k!==td?'<button type="button" class="btn sm" data-mr-day="0">วันนี้</button>':''}</div>
    <div class="mr-due${k===td&&left==='เลยเวลาแล้ว'?' over':''}"><span>ต้องรายงานภายใน</span><b>${esc(due)} น.</b><small>${esc(left)}</small></div></div>`;
  if(!D)return bar+loading();
  if(!D.list.length)return bar+'<div class="mr-empty"><b>ไม่มีใครต้องรายงานในวันนี้</b><span>ไม่มีแผนงานที่มีคนในทีม (ไม่นับคนลาทั้งวัน และแผนเลื่อน / ยกเลิก)</span></div>';
  const c=D.c;const done=c.ok+c.late;const base=c.n-c.ex;
  let h=bar+mrSumHtml(c,base>0?Math.round(done/base*100):null,`รายงานแล้ว ${done} จาก ${base} คน${c.late?` · ช้า ${c.late}`:''}${c.ex?` · ยกเว้น ${c.ex}`:''}`,'รายงานแล้ว',MR_ORDER);
  const show=D.list.filter(r=>!S.mr.st||r.st===S.mr.st);
  const groups=[['todo','ยังไม่รายงาน',r=>r.st==='miss'||r.st==='wait'],['done','รายงานแล้ว',r=>r.st==='ok'||r.st==='late'],['ex','ยกเว้น',r=>r.st==='ex']];
  h+=groups.map(([g,t,f])=>{const l=show.filter(f);if(!l.length)return '';
    return `<section class="mr-grp mr-g-${g}"><header><h3>${t} <span class="md-count">${l.length}</span></h3>${g==='todo'?`<button type="button" class="btn sm" data-mr-copy title="คัดลอกรายชื่อไปทวงในกลุ่ม LINE">คัดลอกรายชื่อ</button>`:''}</header>
      <div class="mr-cards">${l.map(r=>mrCard(r,k)).join('')}</div></section>`}).join('')||'<p class="hint mr-none">ไม่มีคนในสถานะนี้</p>';
  return h+`<p class="hint mr-foot">คนที่มีแผนงานในวันนั้นต้องรายงาน (ไม่นับคนลาทั้งวัน และแผนเลื่อน / ยกเลิก)${can('master')?' · กด แก้ไข เพื่อบันทึกแทน / ยกเว้น ต้องใส่เหตุผลทุกครั้ง':''}</p>`;
}
function mrMonthHtml(){
  const m=mrMonth();const [y,mo]=m.split('-').map(Number);const D=mrMonthData(m);
  const bar=`<div class="mr-bar1"><div class="mr-nav"><button type="button" class="icon-btn" data-mr-mon="-1" aria-label="เดือนก่อน">‹</button><span class="mr-pick static">${PICK_DATE_ICON}<span><b>${TH_MON_FULL[mo-1]} ${y+543}</b></span></span><button type="button" class="icon-btn" data-mr-mon="1" aria-label="เดือนถัดไป">›</button>${m!==mrToday().slice(0,7)?'<button type="button" class="btn sm" data-mr-mon="0">เดือนนี้</button>':''}</div>
    ${typeof downloads!=='undefined'&&downloads?'<button type="button" class="btn sm" data-mr-xlsx>Excel</button>':''}</div>`;
  if(!D)return bar+loading();
  if(D.empty||!D.people.length)return bar+'<div class="mr-empty"><b>ยังไม่มีวันที่ต้องรายงานในเดือนนี้</b></div>';
  const T=Object.assign({n:D.tot.need},D.tot);
  let h=bar+mrSumHtml(T,T.rate,`ตรงเวลา ${T.ok} จาก ${T.need-T.ex} คน-วัน · นับถึง ${esc(fmtDay(D.to))}`,'ตรงเวลา ทั้งทีม',['miss','late','ok','ex']);
  const people=D.people.filter(p=>!S.mr.st||p[S.mr.st]);
  const dayCell=(p,k)=>{const x=p.day[k];return x&&x.st?`<button type="button" class="mr-dc mr-${x.st}" data-mr-goday="${k}" title="${esc(`${fmtDay(k)} · ${MR_ST[x.st].th}${x.rec&&x.rec.time&&!x.rec.ex?' '+x.rec.time+' น.':''}${x.rec&&x.rec.reason?' · '+x.rec.reason:''} · ${x.plans.map(mrPlanTxt).join(', ')}`)}" aria-label="${esc(fmtDay(k)+' '+MR_ST[x.st].th)}"></button>`:'<span class="mr-dc"></span>'};
  const num=(v,cls)=>`<td class="n${v&&cls?' '+cls:''}">${v||'–'}</td>`;
  /* wide screens: a table with one cell per day */
  h+=`<div class="scroll-x plain mr-wide"><table class="mini mr-mt"><thead><tr><th>ชื่อ</th><th class="n">ต้องรายงาน</th><th class="n">ตรงเวลา</th><th class="n">ช้า</th><th class="n">ไม่รายงาน</th><th class="n">ยกเว้น</th><th class="n">% ตรงเวลา</th><th><div class="mr-days-h">${D.days.map(k=>{const d=parseD(k);return `<span class="${d.getDay()===0||d.getDay()===6?'we':''}">${d.getDate()}</span>`}).join('')}</div></th></tr></thead><tbody>
    ${people.map(p=>`<tr><td><b>${esc(p.s?p.s.name:p.id)}</b><span class="sub">${esc(p.s&&p.s.role||'')}</span></td><td class="n">${p.need}</td>${num(p.ok)}${num(p.late,'warn')}${num(p.miss,'bad')}${num(p.ex)}
      <td class="n"><span class="mr-rate${p.rate!=null&&p.rate<80?' low':''}">${p.rate==null?'–':p.rate+'%'}</span></td><td><div class="mr-days">${D.days.map(k=>dayCell(p,k)).join('')}</div></td></tr>`).join('')}</tbody></table></div>`;
  /* phones: one card a person */
  h+=`<div class="mr-cards mr-narrow">${people.map(p=>`<article class="mr-card mr-mc"><div class="mr-ch"><span class="mr-av" aria-hidden="true">${esc(initialOf(p.s?p.s.name:p.id))}</span><span class="mr-nm"><b>${esc(p.s?p.s.name:p.id)}</b><small>${esc(p.s&&p.s.role||'')}</small></span><span class="mr-rate${p.rate!=null&&p.rate<80?' low':''}">${p.rate==null?'–':p.rate+'%'}</span></div>
    <div class="mr-mn"><span>ต้องรายงาน <b>${p.need}</b></span><span class="ok">ตรงเวลา <b>${p.ok}</b></span><span class="late">ช้า <b>${p.late}</b></span><span class="miss">ไม่รายงาน <b>${p.miss}</b></span>${p.ex?`<span>ยกเว้น <b>${p.ex}</b></span>`:''}</div>
    <div class="mr-days">${D.days.map(k=>dayCell(p,k)).join('')}</div></article>`).join('')}</div>`;
  return h+`<p class="hint mr-foot">% ตรงเวลา = ตรงเวลา ÷ (วันที่ต้องรายงาน − ยกเว้น) · เรียงคนที่ไม่รายงานมากที่สุดก่อน · ช่องสีรายวัน: เขียว ตรงเวลา · ส้ม ช้า · แดง ไม่รายงาน · ฟ้า ยกเว้น · ว่าง = ไม่มีแผน · กดช่องเพื่อเปิดวันนั้น</p>`;
}
function renderMrep(){
  if(notReady())return loading();
  if(!mrOk())return '<p class="hint">หน้านี้สำหรับผู้ดูแลระบบและผู้วางแผน · ดูสถานะการรายงานของคุณได้ที่ งานของฉัน</p>';
  const tab=S.mr.tab==='month'?'month':'day';
  const tabs=`<div class="mp-tabs mr-tabs" role="tablist" aria-label="รายงานแผนตอนเช้า">${[['day','รายวัน','ใครรายงานแล้ว / ยังไม่รายงาน'],['month','สรุปรายเดือน','รายคน · ใช้ประเมินวินัย']].map(([id,th,sub])=>`<button type="button" role="tab" class="mp-tab${tab===id?' on':''}" data-mr-tab="${id}" aria-selected="${tab===id}"><span class="mp-tab-t"><b>${th}</b><small>${sub}</small></span></button>`).join('')}</div>`;
  return `<div class="mr-page">${tabs}${tab==='month'?mrMonthHtml():mrDayHtml()}</div>`;
}
async function mrXlsx(btn){
  const D=mrMonthData(mrMonth());if(!D||!D.people)return;btn.disabled=true;
  try{const X=await loadXLSX();const wb=X.utils.book_new();const [y,mo]=D.m.split('-').map(Number);const title=[`BU1 Lab · รายงานแผนตอนเช้า · ${TH_MON_FULL[mo-1]} ${y+543}`];
    const s1=[title,[`ต้องรายงานภายใน ${mrCfg().time} น. · นับถึง ${fmtDay(D.to)}`],['ชื่อ','ตำแหน่ง','ทีม','ต้องรายงาน (วัน)','ตรงเวลา','ช้า','ไม่รายงาน','ยกเว้น','% ตรงเวลา'],
      ...D.people.map(p=>[p.s?p.s.name:p.id,p.s&&p.s.role||'',p.s&&teamOf(p.s)?teamName(teamOf(p.s)):'',p.need,p.ok,p.late,p.miss,p.ex,p.rate==null?'':p.rate+'%'])];
    const w1=X.utils.aoa_to_sheet(s1);w1['!cols']=[22,14,14,14,10,8,10,8,10].map(w=>({wch:w}));X.utils.book_append_sheet(wb,w1,'สรุปรายคน');
    const det=[];D.people.forEach(p=>D.days.forEach(k=>{const x=p.day[k];if(!x||!x.st||x.st==='wait')return;
      det.push([k,p.s?p.s.name:p.id,MR_ST[x.st].th,x.rec&&x.rec.time&&!x.rec.ex?x.rec.time:'',x.rec&&x.rec.src?(x.rec.src==='self'?'รายงานเอง':'หัวหน้าบันทึก'):'',x.rec&&x.rec.reason||'',x.plans.map(mrPlanTxt).join(', ')])}));
    det.sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1],'th'));
    const w2=X.utils.aoa_to_sheet([title,['วันที่','ชื่อ','สถานะ','เวลา','บันทึกโดย','เหตุผล','แผนงาน'],...det]);w2['!cols']=[11,22,12,8,14,30,40].map(w=>({wch:w}));X.utils.book_append_sheet(wb,w2,'รายละเอียดรายวัน');
    await saveFile(`BU1-รายงานแผนตอนเช้า-${D.m}.xlsx`,X.write(wb,{type:'array',bookType:'xlsx'}))}
  catch(e){toast('สร้างไฟล์ Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่')}
  finally{btn.disabled=false}
}
document.addEventListener('click',async e=>{
  if(!e.target.closest)return;
  if(e.target.closest('[data-mr-self]')){const b=e.target.closest('[data-mr-self]');b.disabled=true;await mrSelf();return}
  const fc=e.target.closest('[data-mr-st]');if(fc){const v=fc.dataset.mrSt;S.mr.st=S.mr.st===v?'':v;render();return}
  const tb=e.target.closest('[data-mr-tab]');if(tb){S.mr.tab=tb.dataset.mrTab;S.mr.edit='';S.mr.st='';S.anim='view';render();return}
  const dy=e.target.closest('[data-mr-day]');if(dy){const n=Number(dy.dataset.mrDay);S.mr.day=n?ymd(addDays(parseD(mrDay()),n)):'';S.mr.edit='';render();return}
  const mo=e.target.closest('[data-mr-mon]');if(mo){const n=Number(mo.dataset.mrMon);const [y,m]=mrMonth().split('-').map(Number);S.mr.month=n?ymd(new Date(y,m-1+n,1)).slice(0,7):'';render();return}
  const gd=e.target.closest('[data-mr-goday]');if(gd){S.mr.day=gd.dataset.mrGoday;S.mr.tab='day';S.mr.edit='';render();window.scrollTo(0,0);return}
  const ed=e.target.closest('[data-mr-edit]');if(ed){const key=`${mrDay()}_${ed.dataset.mrEdit}`;S.mr.edit=S.mr.edit===key?'':key;render();return}
  if(e.target.closest('[data-mr-cancel]')){S.mr.edit='';render();return}
  const sv=e.target.closest('[data-mr-save]');if(sv){if(!can('master'))return;
    const id=sv.dataset.mrSave,k=mrDay();const st=(document.querySelector('input[name="mr-e-st"]:checked')||{}).value;const why=($('#mr-e-why')||{}).value||'';const time=($('#mr-e-time')||{}).value||'';
    if(!why.trim()){toast('ใส่เหตุผลก่อนบันทึก');const w=$('#mr-e-why');if(w)w.focus();return}
    if(st==='rep'&&!/^\d\d:\d\d$/.test(time)){toast('ใส่เวลาที่รายงาน');return}
    const patch=st==='rep'?{time,at:'',due:mrCfg().time,ex:false}:st==='ex'?{ex:true,time:''}:{ex:false,time:'',at:''};
    sv.disabled=true;
    try{await mrPut(k,id,Object.assign(patch,{src:'lead',by:S.me||null,reason:why.trim().slice(0,200)}),`${st==='rep'?`หัวหน้าบันทึกว่ารายงาน ${time} น.`:st==='ex'?'หัวหน้ายกเว้น':'หัวหน้าเปลี่ยนเป็นไม่รายงาน'} · ${why.trim().slice(0,200)}`);
      S.mr.edit='';render();toast(`${staffName(id)}: ${st==='rep'?`รายงาน ${time} น.`:st==='ex'?'ยกเว้น':'ไม่รายงาน'}`)}
    catch(err){toast(errText(err));noteWriteError(err);sv.disabled=false}
    return}
  if(e.target.closest('[data-mr-copy]')){const D=mrDayData(mrDay());if(!D)return;const l=D.list.filter(r=>r.st==='miss'||r.st==='wait');
    copyText(`📋 ยังไม่รายงานแผน ${fmtDay(D.k)} (ภายใน ${mrCfg().time} น.)\n${l.map((r,i)=>`${i+1}. ${r.s?r.s.name:r.id} · ${r.plans.map(mrPlanTxt).join(', ')}`).join('\n')}`,'คัดลอกรายชื่อแล้ว วางใน LINE ได้เลย');return}
  const x=e.target.closest('[data-mr-xlsx]');if(x)mrXlsx(x);
});
/* keep the page fresh while it is open (other people report from their phones) */
setInterval(()=>{if(S.view==='mrep'||S.view==='my'){mrInvalidate();if(S.view==='mrep'&&!document.querySelector('#view :focus'))render()}},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(S.view==='mrep'||S.view==='my')){mrInvalidate();render()}});

/* ---------- notices (js/features/notify.js) ---------- */
function mrNotices(tasks,add){
  const k=mrToday();const rows=mrRows(k.slice(0,7));if(!rows)return;const due=mrCfg().time;const late=mrHM(new Date())>due;
  const need=mrNeed(tasks,k);const me=mrMe();
  if(me&&need.has(me)&&!mrRec(rows,k,me))add('mrep','self:'+k+(late?':late':''),late?`ยังไม่ได้รายงานแผนวันนี้ (เลย ${due} น.)`:`รายงานแผนวันนี้ก่อน ${due} น.`,need.get(me).map(mrPlanTxt).join(' · '),{t:'view',v:'my'});
  if(isPlanner()&&late){const miss=[...need.keys()].filter(id=>!mrRec(rows,k,id));
    if(miss.length)add('mrep','miss:'+k+':'+miss.length,`ยังไม่รายงานแผน ${miss.length} คน`,miss.map(staffName).slice(0,8).join(', ')+(miss.length>8?` +${miss.length-8}`:''),{t:'view',v:'mrep'})}
}

/* ---------- ข้อมูลหลัก › รายงานแผนตอนเช้า ---------- */
function mrSection(){
  const c=mrCfg();const A=mrAcct();const dis=can('master')?'':' disabled';const staff=S.staff.filter(s=>s.active!==false).slice().sort(sortPeople);
  const mails=(S.userRows||[]).map(r=>r.id);const bound=staff.filter(s=>A[s.id]).length;
  return {id:'mrep',title:'รายงานแผนตอนเช้า',sub:`ภายใน ${c.time} น. · ผูกบัญชี ${bound}/${staff.length} คน`,count:bound,
    desc:'คนที่มีแผนงานวันนั้นต้องกด "รายงานแผนวันนี้" ในหน้างานของฉันภายในเวลานี้ เกินนับเป็น "ช้า" ไม่กดเลยนับ "ไม่รายงาน" · ผูกบัญชีอีเมลกับชื่อพนักงาน เพื่อให้แต่ละคนรายงานได้เฉพาะของตัวเอง (ไม่ผูก = ใช้ชื่อบัญชีที่ตรงกับชื่อพนักงานคนเดียว)',
    body:`<div class="jb-kset"><label>ต้องรายงานภายใน <input type="time" data-mrcfg="time" value="${esc(c.time)}"${dis}> น.</label></div>
      ${mails.length?`<datalist id="dl-mr-mail">${mails.map(m=>`<option value="${esc(m)}">`).join('')}</datalist>`:''}
      <div class="scroll-x plain md-scroll"><table class="edit-table"><thead><tr><th>พนักงาน</th><th>ทีม</th><th>บัญชี (อีเมล)</th></tr></thead><tbody>
      ${staff.map(s=>`<tr><td>${esc(s.name)}</td><td class="hint">${esc(teamOf(s)?teamName(teamOf(s)):'—')}</td><td><input type="email" id="mr-a-${esc(s.id)}" data-mracct="${esc(s.id)}" value="${esc(A[s.id]||'')}" list="dl-mr-mail" placeholder="อีเมลบัญชีกลางของคนนี้" maxlength="120" autocomplete="off"${dis} aria-label="อีเมลของ ${esc(s.name)}"></td></tr>`).join('')||'<tr><td colspan="3" class="hint">ยังไม่มีรายชื่อพนักงาน</td></tr>'}
      </tbody></table></div>`};
}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset||!can('master'))return;
  if(el.dataset.mrcfg==='time'){if(!/^\d\d:\d\d$/.test(el.value))return;saveCfg({mrep:Object.assign({},mrCfg(),{time:el.value})},`ต้องรายงานแผนภายใน ${el.value} น.`);return}
  if(el.dataset.mracct){const id=el.dataset.mracct;const v=el.value.trim().toLowerCase();
    if(v&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){toast('รูปแบบอีเมลไม่ถูกต้อง');return}
    const A=Object.assign({},mrAcct());const dup=v&&Object.keys(A).find(x=>x!==id&&String(A[x]).toLowerCase()===v);
    if(dup){toast(`อีเมลนี้ผูกกับ ${staffName(dup)} อยู่แล้ว`);el.value=A[id]||'';return}
    if(v)A[id]=v;else delete A[id];saveCfg({staffAcct:A},v?`${staffName(id)} ↔ ${v}`:`เอาบัญชีของ ${staffName(id)} ออกแล้ว`)}
});
