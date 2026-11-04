'use strict';
/* BU1 Weekly Plan · สรุปงาน (user, 14 Oct 2026: "ในแต่ละแผนงานในแต่ละวัน ทำหัวข้อสรุปงานที่เสร็จแล้วด้วย เพื่อคอนเฟิร์มว่าแผนงานนี้เสร็จแล้วจริงๆ";
   chose "ต้องสรุปก่อนถึงจะเสร็จ"): a work plan becomes เสร็จแล้ว only with a written summary in the team's LINE report style
   (what was done · Completed · *notes). task.doneSum / doneBy / doneAt ↔ data.bu1wp; leave plans need none. */
const sumNeeded=t=>!!t&&!isLeave(t)&&t.status==='done';
const sumMissing=t=>sumNeeded(t)&&!String(t.doneSum||'').trim();
const SUM_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 12.5l2.3 2.3 4.7-4.8"/></svg>';
/* the card's chip on a done plan: green "สรุปแล้ว", red "ยังไม่สรุป" (older done plans) */
function sumChip(t){
  if(!sumNeeded(t))return '';const ok=!sumMissing(t);
  return `<span class="pcount sr${ok?'':' miss'}" title="${ok?'สรุปงานแล้ว · ยืนยันว่างานเสร็จจริง':'บันทึกว่าเสร็จแล้ว แต่ยังไม่ได้สรุปงาน'}">${SUM_ICON}${ok?'สรุปแล้ว':'ยังไม่สรุป'}</span>${attChip(t)}`;
}
/* the card: Actual / Plan Team and เวลาเลิกงาน once summed up */
function attChip(t){
  if(!attHas(t))return '';const a=attActualN(t),p=attPlanN(t);
  return `<span class="pcount att-ch${a!==p?' diff':''}" title="Plan Team ${p} คน · Actual ${a} คน${t.doneIn?` · ถึงหน้างาน ${esc(t.doneIn)}`:''}${t.doneOut?` · เลิกงาน ${esc(t.doneOut)}`:''}">👷 ${a}/${p}${t.doneOut?` · เลิก ${esc(t.doneOut)}`:''}</span>`;
}
const attPlanN=t=>(t.staffIds||[]).length+(t.guests||[]).length;
const attActualN=t=>(t.doneTeam||[]).length+(t.doneGuests||[]).length;
/* hours of one job = เลิกงาน − ถึงหน้างาน, no break taken off (user, 4 Nov 2026); past midnight runs on to the next day */
function attHours(t){const m=v=>{const a=/^(\d\d):(\d\d)$/.exec(v||'');return a?Number(a[1])*60+Number(a[2]):null};const a=m(t&&t.doneIn),b=m(t&&t.doneOut);return a==null||b==null?0:((b-a+1440)%1440)/60}
const attHrsTxt=h=>`${Math.round(h*10)/10} ชม.`;
/* the starting text: the plan's detail, then "Completed" — edited to what was really done */
const sumDraft=t=>[String(detailOf(t)||'').trim(),'Completed'].filter(Boolean).join('\n');
const sumWhen=t=>{const d=t&&t.doneAt?new Date(t.doneAt):null;return d&&!isNaN(d)?`${fmtShort(d)} ${be(d)} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`:''};
const SUM_HINT='เขียนสิ่งที่ทำจริงที่หน้างาน ผลงาน (Completed) และปัญหา / ข้อสังเกตที่ต้องแจ้ง (ขึ้นต้นด้วย *)';
const SUM_PH='เช่น\nTag. FT-4201\n- Install Flowmeter = 1 EA\n- Loop Test\n- Set Zero\nCompleted\n*Flowmeter Looptest ได้แค่ 0 กับ 25% เนื่องจากกล่อง Amplifier เสีย';
/* คนเข้างานจริง + เวลา (user, 4 Nov 2026: "เพิ่มตอนสรุปงานขอให้หัวข้อคนเข้างานจริง เวลา"; chose ถึงหน้างาน / เลิกงาน for the whole team · both
   required to confirm, plans confirmed before this are not forced): task.doneTeam [staff ids] · doneGuests [other-department names] ·
   doneIn / doneOut 'HH:MM' ↔ data.bu1wp. Starts ticked from Team Service; "+ เพิ่มคนที่มาเสริม" lists people freed by a เลื่อน plan that day first.
   teamActual (js/core/utils.js) makes them count as busy that day. */
const attHas=t=>!!t&&((t.doneTeam||[]).length>0||(t.doneGuests||[]).length>0||!!t.doneIn||!!t.doneOut);
const attOld=t=>!!t&&t.status==='done'&&!isLeave(t)&&!!String(t.doneSum||'').trim()&&!attHas(t);
/* why someone of the Plan Team did not go (task.doneAway {staffId: id} ↔ data.bu1wp; user, 4 Nov 2026: optional) */
const ATT_WHY=[['sick','ลาป่วย'],['biz','ลากิจ'],['moved','ย้ายไปงานอื่น'],['noneed','งานไม่ต้องใช้คนเพิ่ม'],['other','อื่นๆ']];
const attWhyName=k=>(ATT_WHY.find(x=>x[0]===k)||[,''])[1];
/* the state the section is drawn from: ids / guests = every row, on / gOn = the ticked ones */
function attModel(t,staffIds,guests){
  const team=staffIds||t.staffIds||[],gs=guests||t.guests||[],has=attHas(t);
  return {date:t.date||'',team:team.slice(),ids:[...new Set(team.concat(t.doneTeam||[]))],on:(has?t.doneTeam||[]:team).slice(),guests:[...new Set(gs.concat(t.doneGuests||[]))],gOn:(has?t.doneGuests||[]:gs).slice(),in:t.doneIn||'',out:t.doneOut||'',why:Object.assign({},t.doneAway||{})};
}
/* people of a เลื่อน plan on that day (id → the plan) */
function attFreed(k){const m=new Map();ntfTasks().filter(x=>x.date===k&&x.status==='postponed'&&!isLeave(x)).forEach(x=>(x.staffIds||[]).forEach(id=>{if(!m.has(id))m.set(id,x)}));return m}
function attHtml(pre,s){
  const freed=attFreed(s.date);const rest=S.staff.filter(x=>x.active!==false&&!s.ids.includes(x.id)).sort(sortPeople);
  const fr=rest.filter(x=>freed.has(x.id)),ot=rest.filter(x=>!freed.has(x.id));
  const opt=x=>`<option value="${esc(x.id)}">${esc(x.name)}${freed.has(x.id)?` · ว่างจาก ${esc(freed.get(x.id).planNo||typeLabel(freed.get(x.id)))}`:''}</option>`;
  return `<div class="v-att" data-att-box="${pre}" data-date="${esc(s.date)}" data-team="${esc(s.team.join(','))}">
    <div class="v-att-h"><b>คนเข้างานจริง</b><small>${s.on.length+s.gOn.length} คน · เอาติ๊กออกถ้าไม่ได้ไป · เพิ่มคนที่มาเสริมได้</small></div>
    <div class="v-att-l">${s.ids.map(id=>{const off=s.team.includes(id)&&!s.on.includes(id);const w=(s.why||{})[id]||'';/* ticked off: why (optional, the Dashboard sums it) */
      return `<span class="v-att-i"><label class="v-att-p${s.team.includes(id)?'':' is-add'}"><input type="checkbox" data-att="${esc(id)}"${s.on.includes(id)?' checked':''}><span>${esc(staffName(id))}</span>${s.team.includes(id)?'':'<small>มาเสริม</small>'}</label>${off?`<select class="v-att-why" data-att-why="${esc(id)}" aria-label="เหตุผลที่ ${esc(staffName(id))} ไม่ได้ไป"><option value="">เหตุผล (ถ้ามี)</option>${ATT_WHY.map(([k,l])=>`<option value="${k}"${w===k?' selected':''}>${l}</option>`).join('')}</select>`:''}</span>`}).join('')}
      ${s.guests.map(g=>`<label class="v-att-p"><input type="checkbox" data-att-g="${esc(g)}"${s.gOn.includes(g)?' checked':''}><span>${esc(g)}</span><small>แผนกอื่น</small></label>`).join('')}${!s.ids.length&&!s.guests.length?'<span class="hint">แผนนี้ยังไม่มีทีม · เพิ่มคนจากรายการด้านล่าง</span>':''}</div>
    ${rest.length?`<select class="v-att-add" data-att-add aria-label="เพิ่มคนที่มาเสริม"><option value="">+ เพิ่มคนที่มาเสริม…</option>${fr.length?`<optgroup label="ว่างจากงานเลื่อนวันนี้">${fr.map(opt).join('')}</optgroup>`:''}<optgroup label="${fr.length?'พนักงานคนอื่น':'พนักงาน'}">${ot.map(opt).join('')}</optgroup></select>`:''}
    <div class="v-att-t"><label>ถึงหน้างาน <input type="time" id="${pre}-doneIn" value="${esc(s.in)}"></label><label>เลิกงาน <input type="time" id="${pre}-doneOut" value="${esc(s.out)}"></label></div></div>`;
}
/* what is on screen now (null = not drawn) */
function sumAttNow(pre){
  const b=document.querySelector(`[data-att-box="${pre}"]`);if(!b)return null;const all=(a,k)=>[...b.querySelectorAll(`[${a}]`)].map(x=>x.dataset[k]);const onOf=(a,k)=>[...b.querySelectorAll(`[${a}]:checked`)].map(x=>x.dataset[k]);
  return {date:b.dataset.date||'',team:(b.dataset.team||'').split(',').filter(Boolean),ids:all('data-att','att'),on:onOf('data-att','att'),guests:all('data-att-g','attG'),gOn:onOf('data-att-g','attG'),in:($(`#${pre}-doneIn`)||{}).value||'',out:($(`#${pre}-doneOut`)||{}).value||'',why:Object.fromEntries([...b.querySelectorAll('[data-att-why]')].filter(x=>x.value).map(x=>[x.dataset.attWhy,x.value]))};
}
const attSave=s=>({doneTeam:s.on,doneGuests:s.gOn,doneIn:s.in,doneOut:s.out,doneAway:Object.fromEntries(Object.entries(s.why||{}).filter(([id])=>s.team.includes(id)&&!s.on.includes(id)))});
/* {save: fields} or {err: message}; an older confirmed plan may stay without them */
function attCheck(t,s){
  if(!s)return {save:{}};if(attOld(t)&&!s.in&&!s.out)return {save:{}};
  if(!s.on.length&&!s.gOn.length)return {err:'ติ๊กคนเข้างานจริงอย่างน้อย 1 คน'};
  if(!s.in)return {err:'ใส่เวลาถึงหน้างาน',el:'doneIn'};if(!s.out)return {err:'ใส่เวลาเลิกงาน',el:'doneOut'};
  return {save:attSave(s)};
}
/* the edit form's section follows the picked Team Service; a person newly picked starts ticked */
function attFormFill(){
  const box=$('#f-attSlot');if(!box||$('#f-sumWrap').hidden)return;const cur=sumAttNow('f');const team=[...pickSel];
  if(!cur){box.innerHTML=attHtml('f',attModel(Object.assign({date:$('#f-date').value},editing||{}),team,pickGuests));return}
  const fresh=team.filter(id=>!cur.ids.includes(id));const gf=pickGuests.filter(g=>!cur.guests.includes(g));const gone=id=>cur.team.includes(id)&&!team.includes(id);/* taken off the team */
  box.innerHTML=attHtml('f',Object.assign(cur,{team,ids:cur.ids.filter(id=>!gone(id)).concat(fresh),on:cur.on.filter(id=>!gone(id)).concat(fresh),guests:cur.guests.concat(gf),gOn:cur.gOn.concat(gf)}));
}
document.addEventListener('change',e=>{const el=e.target;
  if(el.dataset&&el.dataset.attAdd!==undefined&&el.value){const b=el.closest('[data-att-box]');const pre=b.dataset.attBox;const s=sumAttNow(pre);s.ids.push(el.value);s.on.push(el.value);b.outerHTML=attHtml(pre,s);return}
  if(el.dataset&&el.dataset.attG!==undefined){const b=el.closest('[data-att-box]');const s=sumAttNow(b.dataset.attBox);const n=b.querySelector('.v-att-h small');if(n)n.textContent=`${s.on.length+s.gOn.length} คน · เอาติ๊กออกถ้าไม่ได้ไป · เพิ่มคนที่มาเสริมได้`}
  /* a person ticked off gets the reason box: draw again, focus stays on the same tick */
  if(el.dataset&&el.dataset.att!==undefined){const id=el.dataset.att;const b=el.closest('[data-att-box]');const pre=b.dataset.attBox;b.outerHTML=attHtml(pre,sumAttNow(pre));const c=document.querySelector(`[data-att-box="${pre}"] [data-att="${CSS.escape(id)}"]`);if(c)c.focus()}
});
/* a done plan's people and times, as read */
function attViewHtml(t){
  if(!attHas(t))return '';const h=attHours(t);
  return `<div class="v-att-v"><div><b>Plan Team ${attPlanN(t)} คน · Actual ${attActualN(t)} คน</b></div>${t.doneIn||t.doneOut?`<div>ถึงหน้างาน ${esc(t.doneIn||'—')} น. · เลิกงาน ${esc(t.doneOut||'—')} น.${h?` · ${attHrsTxt(h)}`:''}</div>`:''}</div>`;
}
/* Team Service in the plan view after สรุปงาน: the chips above are the Plan Team, this is who really went */
function attTeamHtml(t){
  if(!sumNeeded(t)||!attHas(t))return '';const plan=t.staffIds||[],act=t.doneTeam||[],gp=t.guests||[],ga=t.doneGuests||[];
  const chip=(n,tag,cls)=>`<span class="att-c${cls?' '+cls:''}">${cls==='off'?`<s>${esc(n)}</s>`:esc(n)}${tag?`<small>${esc(tag)}</small>`:''}</span>`;
  const actual=act.map(id=>chip(staffName(id),plan.includes(id)?'':'มาเสริม',plan.includes(id)?'':'plus')).concat(ga.map(g=>chip(g,'แผนกอื่น')));
  const why=t.doneAway||{};const away=plan.filter(id=>!act.includes(id)).map(id=>[staffName(id),attWhyName(why[id])]).concat(gp.filter(g=>!ga.includes(g)).map(g=>[g,'']));const h=attHours(t);
  return `<div class="att-pa"><div class="att-r"><b>Actual (${actual.length} คน)</b><div>${actual.join('')||'<span class="dash">—</span>'}</div></div>
    ${away.length?`<div class="att-r"><b>ไม่ได้ไป (${away.length} คน)</b><div>${away.map(([n,w])=>chip(n,w,'off')).join('')}</div></div>`:''}
    ${t.doneIn||t.doneOut?`<div class="att-r"><b>เวลา</b><div class="att-tm">ถึงหน้างาน <b>${esc(t.doneIn||'—')}</b> · เลิกงาน <b>${esc(t.doneOut||'—')}</b>${h?` · รวม <b>${attHrsTxt(h)}</b>`:''}</div></div>`:''}</div>`;
}
/* ---------- Dashboard › กำลังคน: Plan Team เทียบ Actual (user, 4 Nov 2026: "เพื่อนำมาสรุปข้อมูลว่าทีมงานทำงานมากน้อยขนาดไหน"; chose a new section beside
   the old figures, which stay on Team Service): only plans summed up with คนเข้างานจริง, so Plan and Actual compare the same plans. Each person of a
   job gets its whole hours; other-department people are left out of the per-person figures. ---------- */
function attStats(jobs){
  const done=jobs.filter(t=>sumNeeded(t)&&!sumMissing(t));const have=done.filter(attHas);const P=new Map();
  const g=id=>{if(!P.has(id))P.set(id,{id,name:staffName(id),s:staffById(id),plan:0,act:0,add:0,away:0,hrs:0,days:new Set()});return P.get(id)};
  have.forEach(t=>{const plan=t.staffIds||[],act=t.doneTeam||[],h=attHours(t);
    plan.forEach(id=>{const p=g(id);p.plan++;if(!act.includes(id))p.away++});
    act.forEach(id=>{const p=g(id);p.act++;p.hrs+=h;p.days.add(t.date);if(!plan.includes(id))p.add++})});
  const people=[...P.values()].sort((a,b)=>b.hrs-a.hrs||b.act-a.act||a.name.localeCompare(b.name,'th'));
  const sum=l=>l.reduce((a,p)=>{a.plan+=p.plan;a.act+=p.act;a.add+=p.add;a.away+=p.away;a.hrs+=p.hrs;return a},{plan:0,act:0,add:0,away:0,hrs:0,n:l.length});
  const teams=TEAMS.map(x=>x.id).concat(['']).map(id=>Object.assign({id},sum(people.filter(p=>teamOf(p.s)===id)))).filter(x=>x.n);
  return {done,have,older:done.length-have.length,people,teams,tot:sum(people),clock:have.reduce((a,t)=>a+attHours(t),0)};
}
function attDashHtml(D){
  const A=D.att;const sub='จากงานที่สรุปคนเข้างานจริงแล้วในช่วงนี้ (ตามแท็บสายงาน / ทีมที่เปิด) · ชั่วโมง = เลิกงาน − ถึงหน้างาน ไม่หักพัก ทุกคนในงานเดียวกันได้เท่ากัน · ไม่รวมคนแผนกอื่น · ตัวเลขคน-วันด้านบนยังนับตาม Team Service';
  if(!A.have.length)return dzCard('span-12','Plan Team เทียบ Actual',sub,`<p class="hint">ยังไม่มีงานที่สรุปคนเข้างานจริงในช่วงนี้${A.older?` · งานเสร็จก่อนมีหัวข้อนี้ ${A.older} แผนไม่ถูกนับ`:''}</p>`,' style="--d:5"');
  const n=(v,c)=>`<td class="n${v&&c?' '+c:''}">${v||'–'}</td>`;const hr=h=>h?f1(h):'–';
  const row=(lb,x)=>`<tr><td>${lb}</td><td class="n">${x.plan}</td><td class="n">${x.act}</td>${n(x.add,'plus')}${n(x.away,'bad')}<td class="n"><b>${hr(x.hrs)}</b></td></tr>`;
  const head='<thead><tr><th>{}</th><th class="n">Plan (งาน)</th><th class="n">Actual (งาน)</th><th class="n">มาเสริม</th><th class="n">ไม่ได้ไป</th><th class="n">ชั่วโมง</th></tr></thead>';
  return dzCard('span-12','Plan Team เทียบ Actual',sub,`<div class="dz-facts"><span><b>${A.have.length}</b>งานที่สรุปแล้ว${A.older?` (ไม่นับงานเก่า ${A.older})`:''}</span><span><b>${f1(A.tot.hrs)}</b>ชั่วโมงทำงานรวมของทุกคน</span><span><b>${f1(A.clock/A.have.length)}</b>ชั่วโมงเฉลี่ยต่องาน</span><span><b>${A.tot.add}</b>ครั้งที่มาเสริม</span><span><b>${A.tot.away}</b>ครั้งที่ไม่ได้ไป</span></div>
    <div class="att-dz"><div><h3 class="dz-sub">ชั่วโมงทำงานจริงรายคน</h3>${vzRank(A.people.filter(p=>p.hrs).map(p=>({label:p.name,n:Math.round(p.hrs*10)/10,extra:`${p.act} งาน · ${p.days.size} วัน`})),{unit:'ชม.'})}</div>
      <div><h3 class="dz-sub">แยกตามทีม</h3><table class="mini att-t">${head.replace('{}','ทีม')}<tbody>${A.teams.map(x=>row(x.id&&TEAM[x.id]?`<span class="tdot" style="--c:${TEAM[x.id].color}"><i></i>${esc(TEAM[x.id].name)}</span>`:esc(teamName(x.id)),x)).join('')}</tbody></table>
        <h3 class="dz-sub">รายคน</h3><div class="scroll-x plain att-sc"><table class="mini att-t">${head.replace('{}','ชื่อ')}<tbody>${A.people.map(p=>row(esc(p.name),p)).join('')}</tbody></table></div></div></div>`,' style="--d:5"');
}
const attNum=h=>Math.round(h*10)/10;
/* Excel sheets + the A4 print (dashRows in js/views/dashboard.js) */
function attSheets(D){
  const A=D.att;const rows=x=>[x.plan,x.act,x.add,x.away,attNum(x.hrs)];
  return {att:{sheet:'Plan vs Actual',title:'Plan Team เทียบ Actual (งานที่สรุปคนเข้างานจริงแล้ว · ชั่วโมง = เลิกงาน − ถึงหน้างาน ไม่หักพัก)',head:['ทีม / ชื่อ','Plan (งาน)','Actual (งาน)','มาเสริม','ไม่ได้ไป','ชั่วโมง'],num:[1,2,3,4,5],rows:[...A.teams.map(x=>['ทีม '+teamName(x.id),...rows(x)]),...A.people.map(p=>[p.name,...rows(p)])]},
    attPlans:{sheet:'Plan vs Actual รายแผน',title:'Plan Team เทียบ Actual รายแผน',head:['วันที่','Plan No.','หัวข้องาน','Customer','Plan Team','Actual','คน Plan','คน Actual','ถึงหน้างาน','เลิกงาน','ชั่วโมง','ไม่ได้ไป (เหตุผล)'],num:[6,7,10],
      rows:A.have.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(t=>[t.date,t.planNo||'',typeLabel(t),t.customer||'',(t.staffIds||[]).map(staffName).concat(t.guests||[]).join(', '),(t.doneTeam||[]).map(staffName).concat(t.doneGuests||[]).join(', '),attPlanN(t),attActualN(t),t.doneIn||'',t.doneOut||'',attNum(attHours(t)),(t.staffIds||[]).filter(id=>!(t.doneTeam||[]).includes(id)).map(id=>staffName(id)+((t.doneAway||{})[id]?` (${attWhyName(t.doneAway[id])})`:'')).join(', ')])}};
}
/* ---------- Dashboard › กำลังคน: who did not work on which day (user, 4 Nov 2026: "ถ้าวันไหน ทีมงานคนไหนไม่ทำงาน ให้นำมาวิเคราะห์ใน Dashboard ด้วย"; chose both kinds · optional
   reason · Mon–Fri without holidays for "no work" · person × day table + ranking). A person-day: ทำงาน (in the Actual of a summed-up plan, else in a
   plan that holds its team, half days too) > ลา > ไม่ได้ไป (Plan Team of a summed-up plan, not in its Actual, and worked nowhere else that day) > ไม่มีงาน
   (Mon–Fri non-holiday only). Plans of every สายงาน; days up to today. Admin and Safety positions never go on plans, so they are left out. ---------- */
function awayStats(D){
  if(D._aw)return D._aw;const td=ymd(new Date());const byDay=new Map();(D.raw||[]).forEach(t=>{if(t.date>=D.P.from&&t.date<=D.P.to){if(!byDay.has(t.date))byDay.set(t.date,[]);byDay.get(t.date).push(t)}});
  const did=t=>t.status==='done'&&attHas(t)?(t.doneTeam||[]):(t.staffIds||[]);const days=D.days.map(ymd).filter(k=>k<=td);const base=new Set(days.filter(k=>!isOffDay(parseD(k))));
  const rows=D.people.map(p=>p.s).filter(s=>s&&!mrSafety(s)&&!/^admin$/i.test(String(s.role||'').trim())).map(s=>{const r={s,id:s.id,name:s.name,work:0,away:0,idle:0,leave:0,cells:{}};
    days.forEach(k=>{const l=byDay.get(k)||[];const jobs=l.filter(t=>!isLeave(t)&&holdsTeam(t));const on=jobs.filter(t=>did(t).includes(s.id));
      const lv=l.find(t=>isLeave(t)&&isWorking(t)&&(t.staffIds||[]).includes(s.id));const aw=jobs.filter(t=>t.status==='done'&&attHas(t)&&(t.staffIds||[]).includes(s.id)&&!(t.doneTeam||[]).includes(s.id));
      const st=on.length?'work':lv?'leave':aw.length?'away':base.has(k)?'idle':'';if(!st)return;r[st]++;r.cells[k]={st,plans:st==='work'?on:st==='away'?aw:lv?[lv]:[],why:st==='away'?(aw[0].doneAway||{})[s.id]||'':''}});
    return r}).sort((a,b)=>(b.away+b.idle)-(a.away+a.idle)||(b.away-a.away)||a.name.localeCompare(b.name,'th'));
  const shown=days.filter(k=>base.has(k)||rows.some(r=>r.cells[k]));const why=new Map();rows.forEach(r=>Object.values(r.cells).forEach(c=>{if(c.st==='away'){const n=attWhyName(c.why)||'ไม่ระบุ';why.set(n,(why.get(n)||0)+1)}}));
  const sum=k=>rows.reduce((a,r)=>a+r[k],0);
  return D._aw={rows,days:shown,baseN:base.size,away:sum('away'),idle:sum('idle'),leave:sum('leave'),work:sum('work'),why:[...why].sort((a,b)=>b[1]-a[1])};
}
const AW_ST={work:['ทำงาน','•'],away:['ไม่ได้ไป','✕'],idle:['ไม่มีงาน','○'],leave:['ลา','ล']};
function awayDashHtml(D){
  const A=awayStats(D);const sub=`วันจันทร์–ศุกร์ ไม่รวมวันหยุด ถึงวันนี้ · ไม่ได้ไป = อยู่ใน Plan Team แต่สรุปงานว่าไม่ได้ไป และไม่ได้ทำงานอื่นวันนั้น · ไม่มีงาน = ไม่ได้อยู่ในงานไหนและไม่ได้ลา · ไม่นับตำแหน่ง Admin / Safety · งานที่ยังไม่สรุปนับตาม Team Service`;
  if(!A.days.length||!A.rows.length)return dzCard('span-12','ทีมงานที่ไม่ทำงาน',sub,'<p class="hint">ยังไม่มีวันให้นับในช่วงนี้</p>',' style="--d:5"');
  const kinds=[{id:'away',name:'ไม่ได้ไป (อยู่ในแผน)',color:'var(--vz-2)'},{id:'idle',name:'ไม่มีงาน',color:'var(--vz-3)'}];const rk=A.rows.filter(r=>r.away+r.idle);
  const small=['week','month'].includes(D.P.mode);
  const head=A.days.map(k=>{const d=parseD(k);return `<th class="aw-d${isOffDay(d)?' off':''}"><small>${TH_DAY[d.getDay()]}</small>${d.getDate()}</th>`}).join('');
  const cell=(r,k)=>{const c=r.cells[k];if(!c)return '<td></td>';const [lb,g]=AW_ST[c.st];const pl=c.plans.map(t=>[t.planNo,t.customer].filter(Boolean).join(' ')||typeLabel(t)).filter(Boolean).join(', ');
    return `<td><button type="button" class="aw-c aw-${c.st}" data-vz-go="${k}" title="${esc([r.name,fmtDayY(k),lb,attWhyName(c.why),pl].filter(Boolean).join(' · '))}" aria-label="${esc(r.name+' '+fmtDay(k)+' '+lb)}">${g}</button></td>`};
  const table=small?`<div class="scroll-x plain aw-sc"><table class="mini aw-t"><thead><tr><th class="aw-n">ชื่อ</th>${head}<th class="n">ไม่ได้ไป</th><th class="n">ไม่มีงาน</th><th class="n">ลา</th></tr></thead><tbody>${A.rows.map(r=>`<tr><td class="aw-n"><b>${esc(r.name)}</b><span class="sub">${esc(teamOf(r.s)?teamName(teamOf(r.s)):r.s.role||'')}</span></td>${A.days.map(k=>cell(r,k)).join('')}<td class="n${r.away?' bad':''}">${r.away||'–'}</td><td class="n">${r.idle||'–'}</td><td class="n">${r.leave||'–'}</td></tr>`).join('')}</tbody></table></div>
    <ul class="aw-leg">${Object.entries(AW_ST).map(([k,[l,g]])=>`<li><span class="aw-c aw-${k}" aria-hidden="true">${g}</span>${l}</li>`).join('')}<li class="hint">กดช่องเพื่อเปิดวันนั้นใน Weekly Plan</li></ul>`:'<p class="hint">ตารางคน × วัน ดูได้เมื่อเลือกรายสัปดาห์หรือรายเดือน</p>';
  return dzCard('span-12','ทีมงานที่ไม่ทำงาน',sub,`<div class="dz-facts"><span><b>${A.away}</b>คน-วัน ไม่ได้ไป</span><span><b>${A.idle}</b>คน-วัน ไม่มีงาน</span><span><b>${A.leave}</b>คน-วัน ลา</span><span><b>${A.baseN}</b>วันทำงานที่นับ</span></div>
    ${table}<div class="dz-grid2 aw-g"><div><h3 class="dz-sub">อันดับรายคน</h3>${rk.length?vzStackRows(rk.map(r=>({label:r.name,sub:teamOf(r.s)?teamName(teamOf(r.s)):'',v:{away:r.away,idle:r.idle},extra:`ทำงาน ${r.work} วัน`})),kinds,{unit:'วัน'}):'<p class="hint">ทุกคนมีงานครบทุกวันในช่วงนี้</p>'}</div>
    <div><h3 class="dz-sub">เหตุผลที่ไม่ได้ไป</h3>${A.why.length?vzRank(A.why.map(([label,n])=>({label,n})),{unit:'ครั้ง'}):'<p class="hint">ไม่มีคนที่ไม่ได้ไปในช่วงนี้</p>'}</div></div>`,' style="--d:5"');
}
function awaySheets(D){
  const A=awayStats(D);const det=[];A.rows.forEach(r=>Object.entries(r.cells).forEach(([k,c])=>{if(c.st==='away'||c.st==='idle')det.push([k,r.name,teamOf(r.s)?teamName(teamOf(r.s)):'',AW_ST[c.st][0],attWhyName(c.why),c.plans.map(t=>[t.planNo,t.customer].filter(Boolean).join(' ')).join(', ')])}));
  det.sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1],'th'));
  return {away:{sheet:'ไม่ทำงานรายคน',title:`ทีมงานที่ไม่ทำงาน (จ.–ศ. ไม่รวมวันหยุด ${A.baseN} วัน · ไม่นับตำแหน่ง Admin / Safety)`,head:['ชื่อ','ทีม','ทำงาน (วัน)','ไม่ได้ไป (วัน)','ไม่มีงาน (วัน)','ลา (วัน)'],num:[2,3,4,5],rows:A.rows.map(r=>[r.name,teamOf(r.s)?teamName(teamOf(r.s)):'',r.work,r.away,r.idle,r.leave])},
    awayDays:{sheet:'ไม่ทำงานรายวัน',title:'ทีมงานที่ไม่ทำงาน รายวัน',head:['วันที่','ชื่อ','ทีม','สถานะ','เหตุผล','แผนงาน'],num:[],rows:det}};
}
/* the editor in the plan view: confirm = the plan is not done yet (saving sets เสร็จแล้ว); att = ticks to keep across a redraw */
function sumEditHtml(t,confirm,att){
  const miss=!confirm&&sumMissing(t);
  return `<div class="v-sum edit${miss?' miss':''}" id="vSum"><label for="v-doneSum">${SUM_ICON}สรุปงาน · ยืนยันว่างานนี้เสร็จแล้วจริง</label>
    ${miss?'<p class="v-sum-warn">แผนนี้บันทึกว่าเสร็จแล้ว แต่ยังไม่มีสรุปงาน</p>':''}${attOld(t)?'<p class="hint v-att-old">แผนนี้ยืนยันเสร็จก่อนมีหัวข้อคนเข้างานจริง · จะใส่เพิ่มหรือไม่ก็ได้</p>':''}<div id="v-attSlot">${attHtml('v',att||attModel(t))}</div><small>${SUM_HINT}</small>
    <textarea id="v-doneSum" rows="8" maxlength="3000" placeholder="${esc(SUM_PH)}">${esc(String(t.doneSum||'').trim()||sumDraft(t))}</textarea>
    <div class="v-row"><button type="button" class="btn primary sm" data-action="save-vsum">${confirm?'ยืนยันงานเสร็จ':'บันทึกสรุปงาน'}</button>${miss?'':'<button type="button" class="lnk" data-action="cancel-vsum">ยกเลิก</button>'}</div></div>`;
}
/* a done plan's summary; edit = may write it (canWork) */
function sumViewHtml(t,edit){
  if(!sumNeeded(t))return '';
  if(sumMissing(t))return edit?sumEditHtml(t,false):`<div class="v-sum miss"><b>${SUM_ICON}สรุปงาน</b><span><i>ยังไม่ได้สรุปงาน</i></span></div>`;
  const when=sumWhen(t);
  return `<div class="v-sum" id="vSumView"><b>${SUM_ICON}สรุปงาน · ยืนยันว่าเสร็จแล้ว</b>${attViewHtml(t)}<span>${esc(String(t.doneSum).trim())}</span>
    <small>ยืนยันโดย <b id="vSumBy">${t.doneBy?'…':'—'}</b>${when?' · '+when:''}${edit?' · <button type="button" class="lnk" data-action="edit-vsum">แก้ไขสรุปงาน</button>':''}</small></div>`;
}
/* fills "ยืนยันโดย" with the person's name once the profile is read */
function sumWho(t){const el=$('#vSumBy');if(!el||!t||!t.doneBy)return;whoLabel(t.doneBy).then(w=>{if(el.isConnected)el.textContent=w||'—'})}
/* who / when move with the summary: set when the plan becomes done or the text changes */
function sumStamp(sum,old){
  const was=old&&old.status==='done'&&!isLeave(old)?String(old.doneSum||'').trim():null;
  return was!=null&&was===sum?{doneSum:sum,doneBy:old.doneBy||null,doneAt:old.doneAt||''}:{doneSum:sum,doneBy:S.me||null,doneAt:sum?new Date().toISOString():''};
}
function sumSlot(html){const s=$('#vSumSlot');if(s){s.innerHTML=html;sumWho(editing)}}
function openSumEdit(confirm){
  if(!editing)return;sumSlot(sumEditHtml(editing,confirm));
  const ta=$('#v-doneSum');if(ta){ta.scrollIntoView({block:'nearest',behavior:reduceMotion()?'auto':'smooth'});setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},30)}
}
async function saveViewSum(){
  if(!editing||!canWork())return;const ta=$('#v-doneSum');const sum=String(ta&&ta.value||'').trim().slice(0,3000);
  const a=attCheck(editing,sumAttNow('v'));if(a.err){toast(a.err);const el=a.el&&$('#v-'+a.el);if(el)el.focus();return}
  if(!sum){toast('เขียนสรุปงานก่อนยืนยันว่าเสร็จ');if(ta)ta.focus();return}
  const was=editing.status==='done';
  await saveViewStatus('done','',Object.assign(sumStamp(sum,editing),a.save),was?'บันทึกสรุปงานแล้ว':'');
}
/* ---------- งานเลื่อนรู้วันเข้างาน: send its people to help another plan of that day (user, 4 Nov 2026: "พอมีงานเลื่อนที่ทราบในวันเข้างานเลย
   ทำให้ดึงรายชื่อกลับเป็นว่าง แต่จริงๆแล้วเมื่อว่างเราจะนำคนนั้นไปเสริมเข้างานอื่น"): added to the other plan's Team Service, so they stop
   counting as free at once. Their names stay on the เลื่อน plan (its record; holdsTeam already frees them there). ---------- */
const mvPool=k=>{const m=new Map();ntfTasks().concat(S.tasks).forEach(x=>m.set(x.id,x));return [...m.values()].filter(x=>x.date===k)};
const mvName=x=>x.planNo||typeLabel(x);
function mvBoxHtml(t){
  if(!t||t.status!=='postponed'||isLeave(t)||!S.canWrite)return '';
  const ids=(t.staffIds||[]).filter(id=>{const s=staffById(id);return s&&s.active!==false});if(!ids.length)return '';
  const pool=mvPool(t.date);const targets=pool.filter(x=>x.id!==t.id&&holdsTeam(x)&&!isLeave(x)).sort((a,b)=>String(mvName(a)).localeCompare(String(mvName(b))));
  const where=id=>targets.filter(x=>(x.staffIds||[]).includes(id));
  return `<div class="mv-box" id="mvBox"><div class="mv-h"><b>ย้ายคนไปเสริมงานอื่น</b><small>แผนนี้เลื่อน คนในทีมจึงว่าง · เลือกคนและแผนของวันเดียวกัน แล้วคนนั้นจะไม่นับว่าว่าง</small></div>
    <div class="v-att-l">${ids.map(id=>{const w=where(id);return `<label class="v-att-p${w.length?' is-away':''}"><input type="checkbox" data-mv="${esc(id)}"${w.length?'':' checked'}><span>${esc(staffName(id))}</span>${w.length?`<small>อยู่ที่ ${esc(w.map(mvName).join(', '))}</small>`:'<small>ว่าง</small>'}</label>`}).join('')}</div>
    ${targets.length?`<div class="mv-go"><select id="mv-to" aria-label="แผนที่จะไปเสริม"><option value="">เลือกแผนที่จะไปเสริม…</option>${targets.map(x=>`<option value="${esc(x.id)}">${esc([mvName(x),x.customer,pName(x)].filter(Boolean).join(' · '))}</option>`).join('')}</select><button type="button" class="btn primary sm" data-mv-go>ย้ายไปเสริม</button></div>`:'<p class="hint">วันนี้ไม่มีแผนอื่นให้ไปเสริม</p>'}</div>`;
}
async function mvGo(btn){
  if(!editing||!S.canWrite)return;const to=($('#mv-to')||{}).value;const ids=[...document.querySelectorAll('#mvBox [data-mv]:checked')].map(x=>x.dataset.mv);
  if(!ids.length){toast('ติ๊กคนที่จะย้ายก่อน');return}if(!to){toast('เลือกแผนที่จะไปเสริมก่อน');const s=$('#mv-to');if(s)s.focus();return}
  const pool=mvPool(editing.date);const target=pool.find(x=>x.id===to);if(!target)return;const add=ids.filter(id=>!(target.staffIds||[]).includes(id));
  if(!add.length){toast(`คนที่เลือกอยู่ที่ ${mvName(target)} แล้ว`);return}
  const staffIds=(target.staffIds||[]).concat(add);btn.disabled=true;
  try{await Store.update('tasks',to,Object.assign({staffIds},meta()));
    /* the list is re-read a moment later: show the move now */
    [S.tasks,NTF.range||[]].forEach(l=>{const x=l.find(y=>y.id===to);if(x)x.staffIds=staffIds});invalidate();
    const clash=conflictsFor(Object.assign({},target,{staffIds}),pool).filter(c=>c.staff.some(id=>add.includes(id)));
    toast(`ย้าย ${add.map(staffName).join(', ')} ไปเสริม ${mvName(target)} แล้ว${clash.length?` · ⚠ ชนกับ ${clash.map(c=>mvName(c.other)).join(', ')}`:''}`);
    render();refreshDrawerView()}
  catch(err){toast(errText(err));noteWriteError(err);btn.disabled=false}
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-mv-go]');if(b)mvGo(b)});
