'use strict';
/* BU1 Weekly Plan · per-person daily summary */
/* ---------- view: per-person daily summary ---------- */
function miniChip(t,c){
  const ty=typeOf(t);
  return `<button type="button" class="mc${c?' has-conf':''}" style="--c:${safeColor(ty.color)}" data-edit="${esc(t.id)}" title="${esc([typeLabel(t),t.planNo,t.customer,pName(t)].filter(Boolean).join(' · '))}"><i></i><span>${esc(typeLabel(t))}${t.customer?' · '+esc(t.customer):''}</span><em>${c?'⚠ ':''}${esc(pName(t))}</em></button>`;
}
function daySummary(list){
  const jobs=list.filter(t=>!isLeave(t));const lv=list.filter(isLeave);
  if(!list.length)return {free:true,text:'ว่าง'};
  const r={jobs:jobs.length,leave:lv.length?pName(lv[0]):''};
  if(jobs.length){r.first=pName(jobs[0]);r.last=pName(jobs.slice().sort((a,b)=>pB(a)-pB(b)||pA(a)-pA(b)).pop())}
  r.text=[jobs.length?`${jobs.length} งาน (แรก ${r.first} · สุดท้าย ${r.last})`:'',r.leave?`ลา ${r.leave}`:''].filter(Boolean).join(' · ');
  return r;
}
function cellSummary(list,conf,sid){
  const r=daySummary(list);if(r.free)return '<span class="sc-free">ว่าง</span>';
  let h='<div class="sc">';
  if(r.jobs)h+=`<span class="sc-n">${r.jobs} งาน</span><span class="sc-p">แรก <b>${esc(r.first)}</b> · สุดท้าย <b>${esc(r.last)}</b></span>`;
  if(r.leave)h+=`<span class="sc-leave">ลา ${esc(r.leave)}</span>`;
  h+=list.map(t=>miniChip(t,(conf.get(t.id)||[]).some(x=>x.staff.includes(sid)))).join('');
  return h+'</div>';
}
function renderPeople(){
  if(notReady())return loading();
  const days=weekDays();const today=ymd(new Date());const tasks=shownTasks().filter(isWorking);const conf=allConflicts();
  const all=visibleStaff(tasks);
  if(!all.length)return emptyState('ยังไม่มีรายชื่อพนักงาน','เพิ่มรายชื่อวิศวกร ช่างเทคนิค และพนักงานเสริมก่อน แต่ละคนจะเป็นหนึ่งแถวในตารางนี้',`<button type="button" class="btn primary" data-go="settings">เพิ่มรายชื่อ</button>`);
  const busy=new Set(tasks.flatMap(t=>t.staffIds||[]));const q=norm(S.pf.q);
  const staff=all.filter(s=>(!S.pf.busy||busy.has(s.id))&&(!q||norm([s.name,s.role].join(' ')).includes(q)));
  $('#pf-count').textContent=staff.length!==all.length?`แสดง ${staff.length} จาก ${all.length} คน`:`${all.length} คน`;
  const groups=roleGroups(staff);const showGroups=groups.size>1||(groups.size===1&&!groups.has('ไม่ระบุตำแหน่ง'));
  const freeOn=d=>{const k=ymd(d);return all.filter(s=>s.active!==false&&!tasks.some(t=>t.date===k&&(t.staffIds||[]).includes(s.id))).length};
  if(planDayMode())return peopleDayHtml({days,tasks,conf,staff,groups,showGroups,busy,q,freeOn});
  let ci=0;
  let h=`<div class="scroll-x tall people"><table class="grid"><colgroup><col class="c-who">${days.map(()=>'<col>').join('')}</colgroup><thead><tr><th class="corner">พนักงาน</th>`;
  for(const d of days)h+=dayHead(d,today,`<span class="dfree">ว่าง ${freeOn(d)} คน</span>`);
  h+=`</tr></thead><tbody>`;
  for(const [team,members] of groups){
    if(showGroups){const nb=members.filter(s=>busy.has(s.id)).length;h+=`<tr class="team-row"><th scope="rowgroup">${S.canWrite?`<input type="checkbox" class="row-pick" data-team-pick="${esc(members.map(s=>s.id).join(','))}" aria-label="เลือกทุกคนในตำแหน่ง ${esc(team)}" title="เลือกทุกคนในตำแหน่งนี้">`:''}<b>${esc(team)}</b>${members.length} คน · มีงาน ${nb}</th><td colspan="${days.length}"></td></tr>`}
    for(const s of members){
      const mine=tasks.filter(t=>(t.staffIds||[]).includes(s.id));
      const jobsN=mine.filter(t=>!isLeave(t)).length;const freeDays=days.filter(d=>!mine.some(t=>t.date===ymd(d))).length;
      h+=`<tr class="${S.sel.has(s.id)?'picked':''}"><th scope="row"><div class="who">${S.canWrite?`<input type="checkbox" class="row-pick" data-row-pick="${esc(s.id)}"${S.sel.has(s.id)?' checked':''} aria-label="เลือก ${esc(s.name)} เพื่อลงแผน">`:''}<span class="avatar" aria-hidden="true">${esc(initialOf(s.name))}</span><div class="who-text"><span class="who-name">${esc(s.name)}</span><span class="who-role">${esc(s.role||'—')}</span>${s.active===false?'<span class="who-role">(ปิดใช้งาน)</span>':''}</div></div>
        <div class="who-stat">งาน ${jobsN} · ว่าง ${freeDays} วัน</div></th>`;
      for(const d of days){const k=ymd(d);const list=mine.filter(t=>t.date===k).sort(byTime);ci++;
        h+=`<td class="${k===today?'is-today':''}"><div class="cell">${cellSummary(list,conf,s.id)}${S.canWrite?`<button type="button" class="add" data-action="add" data-date="${k}" data-staff="${esc(s.id)}" aria-label="เพิ่มแผนให้ ${esc(s.name)} วัน${TH_DAY_FULL[d.getDay()]}">+ เพิ่ม</button>`:''}</div></td>`}
      h+='</tr>';
    }
  }
  if(!staff.length)h+=`<tr class="no-match"><td colspan="${days.length+1}">ไม่พบคนที่ตรงกับตัวกรอง ลองล้างคำค้น หรือปิด "เฉพาะคนที่มีงาน"</td></tr>`;
  const vs=vehicles().filter(v=>v.active!==false||tasks.some(t=>vehKey(t)===norm(v.name)));
  if(vs.length&&!q){
    h+=`<tr class="team-row"><th scope="rowgroup"><b>รถ</b>${vs.length} คัน</th><td colspan="${days.length}"></td></tr>`;
    for(const v of vs){const mine=tasks.filter(t=>vehKey(t)===norm(v.name));
      h+=`<tr><th scope="row"><div class="who"><span class="avatar sq" aria-hidden="true">รถ</span><div class="who-text"><span class="who-name">${esc(v.name)}</span>${v.code?`<span class="who-role">${esc(v.code)}</span>`:''}<span class="who-role">ใช้ ${mine.length} งาน</span></div></div></th>`;
      for(const d of days){const k=ymd(d);const list=mine.filter(t=>t.date===k).sort(byTime);
        h+=`<td class="${k===today?'is-today':''}"><div class="cell">${list.length?list.map(t=>miniChip(t,(conf.get(t.id)||[]).some(x=>x.veh))).join(''):'<span class="sc-free">ว่าง</span>'}</div></td>`}
      h+='</tr>';
    }
  }
  h+=`</tbody></table></div><p class="hint">"แรก" คือช่วงเวลาของงานแรกของวัน "สุดท้าย" คือช่วงเวลาของงานสุดท้าย กรอบแดงคือถูกจัดงานในช่วงเวลาที่ทับกัน หรือถูกจัดงานในวันที่ลา</p>`;
  return h;
}
/* daily view (tablet / phone): one day, one row per person grouped by team, then vehicles */
function peopleDayHtml({days,tasks,conf,staff,groups,showGroups,busy,q,freeOn}){
  let k=planDay();if(!days.some(x=>ymd(x)===k))k=S.pday=ymd(days[days.length-1]);/* Sunday hidden by the วันอาทิตย์ switch */
  const d=parseD(k);const dayT=tasks.filter(t=>t.date===k);
  const busyN=new Set(dayT.filter(t=>!isLeave(t)).flatMap(t=>t.staffIds||[])).size;const lvN=new Set(dayT.filter(isLeave).flatMap(t=>t.staffIds||[])).size;
  let h=`<section class="wp-panel pd-panel" aria-label="สรุปรายคน ${esc(fmtDay(k))}">`+dayStrip(days,k,xk=>{const n=freeOn(parseD(xk));return [n,'free',`ว่าง ${n} คน`]},'pday')
    +pdHead(d,`ว่าง ${freeOn(d)} คน · มีงาน ${busyN} · ลา ${lvN}`,'pday')+'<div class="pd-body" data-swipe="pday">';
  for(const [team,members] of groups){
    const nb=members.filter(s=>dayT.some(t=>!isLeave(t)&&(t.staffIds||[]).includes(s.id))).length;
    h+=`<section class="pd-grp">${showGroups?`<h3>${S.canWrite?`<input type="checkbox" class="row-pick" data-team-pick="${esc(members.map(s=>s.id).join(','))}" aria-label="เลือกทุกคนในตำแหน่ง ${esc(team)}" title="เลือกทุกคนในตำแหน่งนี้">`:''}${esc(team)}<span class="pd-cnt">${members.length} คน · มีงาน ${nb}</span></h3>`:''}<div class="pp-list">`;
    for(const s of members){
      const list=dayT.filter(t=>(t.staffIds||[]).includes(s.id)).sort(byTime);
      h+=`<div class="pp-row${S.sel.has(s.id)?' picked':''}"><div class="pp-top">${S.canWrite?`<input type="checkbox" class="row-pick" data-row-pick="${esc(s.id)}"${S.sel.has(s.id)?' checked':''} aria-label="เลือก ${esc(s.name)} เพื่อลงแผน">`:''}<span class="avatar" aria-hidden="true">${esc(initialOf(s.name))}</span>
        <div class="who-text"><span class="who-name">${esc(s.name)}</span><span class="who-role">${esc(s.role||'—')}${s.active===false?' · (ปิดใช้งาน)':''}</span></div>
        ${S.canWrite?`<button type="button" class="btn sm" data-action="add" data-date="${k}" data-staff="${esc(s.id)}" aria-label="เพิ่มแผนให้ ${esc(s.name)}">+ เพิ่ม</button>`:''}</div>
        <div class="pp-stat">${cellSummary(list,conf,s.id)}</div></div>`;
    }
    h+='</div></section>';
  }
  if(!staff.length)h+='<div class="pd-empty">ไม่พบคนที่ตรงกับตัวกรอง ลองล้างคำค้น หรือปิด "เฉพาะคนที่มีงาน"</div>';
  const vs=vehicles().filter(v=>v.active!==false||tasks.some(t=>vehKey(t)===norm(v.name)));
  if(vs.length&&!q){
    h+=`<section class="pd-grp"><h3>รถ<span class="pd-cnt">${vs.length} คัน</span></h3><div class="pp-list">`;
    for(const v of vs){const list=dayT.filter(t=>vehKey(t)===norm(v.name)).sort(byTime);
      h+=`<div class="pp-row"><div class="pp-top"><span class="avatar sq" aria-hidden="true">รถ</span><div class="who-text"><span class="who-name">${esc(v.name)}</span>${v.code?`<span class="who-role">${esc(v.code)}</span>`:''}</div></div>
        <div class="pp-stat"><div class="sc">${list.length?list.map(t=>miniChip(t,(conf.get(t.id)||[]).some(x=>x.veh))).join(''):'<span class="sc-free">ว่าง</span>'}</div></div></div>`}
    h+='</div></section>';
  }
  return h+'</div></section>';
}
