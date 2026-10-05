'use strict';
/* BU1 Weekly Plan · long-project manpower plan */
/* ---------- view: long-project manpower plan ---------- */
function renderProjects(){
  if(notReady()||!S.projReady)return loading();
  const m=S.month;const y=m.getFullYear(),mo=m.getMonth();const nd=new Date(y,mo+1,0).getDate();
  const days=Array.from({length:nd},(_,i)=>new Date(y,mo,i+1));const from=ymd(days[0]),to=ymd(days[nd-1]);const today=ymd(new Date());
  const tasks=rangeTasks(from,to);
  const list=S.projects.filter(p=>p.from&&p.to&&p.from<=to&&p.to>=from).sort((a,b)=>String(a.from).localeCompare(String(b.from))||String(a.name).localeCompare(String(b.name),'th'));
  const need=(p,d)=>{const k=ymd(d);return k>=p.from&&k<=p.to&&(p.workSun||d.getDay()!==0)?(Number(p.headcount)||0):0};
  const active=S.staff.filter(s=>s.active!==false).length;
  const avail=d=>{if(!tasks)return null;const k=ymd(d);const lv=new Set(tasks.filter(t=>t.date===k&&isWorking(t)&&isLeave(t)).flatMap(t=>t.staffIds||[]));return active-lv.size};
  let h=`<section class="weekbar" aria-label="เลือกเดือน"><div class="wk-nav"><button type="button" class="arrow" data-action="mprev" aria-label="เดือนก่อน">‹</button><button type="button" data-action="mthis">เดือนนี้</button><button type="button" class="arrow" data-action="mnext" aria-label="เดือนถัดไป">›</button></div>
    <div class="wk-label"><strong>${TH_MON_FULL[mo]} ${be(m)}</strong><span>${EN_MON[mo]} ${String(y).slice(-2)} · ${list.length} โปรเจกต์ · พนักงานที่ใช้งาน ${active} คน</span></div>
    <div class="wk-tools"><div class="seg"${isPhoneW()?' hidden':''} role="radiogroup" aria-label="มุมมอง"><label><input type="radio" name="pm-mode" value="day"${planDayMode()?' checked':''}><span>รายวัน</span></label><label><input type="radio" name="pm-mode" value="week"${planDayMode()?'':' checked'}><span>ทั้งเดือน</span></label></div>${S.canWrite?`<button type="button" class="btn primary" data-action="proj-new"><span class="plus">+</span> เพิ่มโปรเจกต์</button>`:''}</div></section>`;
  if(S.projEdit)h+=projForm();
  if(planDayMode())return h+projDayHtml({days,list,need,avail});
  h+=`<div class="scroll-x tall"><table class="mp"><thead><tr><th class="nm">โปรเจกต์</th>${days.map(d=>`<th class="${d.getDay()===0?'sun':''}${ymd(d)===today?' today-col':''}">${TH_DAY[d.getDay()]}<b>${d.getDate()}</b></th>`).join('')}</tr></thead><tbody>`;
  for(const p of list){
    h+=`<tr><th class="nm">${S.canWrite?`<button type="button" class="proj-name" data-proj-edit="${esc(p.id)}" title="แก้ไขโปรเจกต์">`:'<div class="proj-name">'}<b>${esc(p.name)}</b><small>${esc(p.headcount)} คน · ${esc(fmtDay(p.from))} – ${esc(fmtDay(p.to))}${p.workSun?' · รวมวันอาทิตย์':''}</small>${S.canWrite?'</button>':'</div>'}</th>`;
    h+=days.map(d=>{const n=need(p,d);return n?`<td class="on" data-tip="${esc(p.name)} · ${fmtDay(ymd(d))} ต้องใช้ ${n} คน">${n}</td>`:`<td class="${d.getDay()===0?'sun':''}"></td>`}).join('')+'</tr>';
  }
  if(!list.length)h+=`<tr><th class="nm"><span class="hint">ยังไม่มีโปรเจกต์ในเดือนนี้</span></th>${days.map(d=>`<td class="${d.getDay()===0?'sun':''}"></td>`).join('')}</tr>`;
  const req=days.map(d=>list.reduce((a,p)=>a+need(p,d),0));const av=days.map(avail);
  h+=`<tr class="tot first"><th class="nm">ต้องใช้รวม (คน)</th>${req.map(n=>`<td>${n||''}</td>`).join('')}</tr>`;
  h+=`<tr class="tot"><th class="nm">คนที่มี (หักคนลา)</th>${av.map(n=>`<td>${n==null?'…':n}</td>`).join('')}</tr>`;
  h+=`<tr class="tot"><th class="nm">คงเหลือ</th>${av.map((n,i)=>{if(n==null)return '<td>…</td>';const r=n-req[i];return `<td class="${r<0?'neg':req[i]?'pos':''}" data-tip="${fmtDay(ymd(days[i]))}: มี ${n} คน ต้องใช้ ${req[i]} คน">${req[i]?(r<0?'⚠ ':'')+r:''}</td>`}).join('')}</tr>`;
  h+=`</tbody></table></div><p class="hint">ตัวเลขในตารางคือจำนวนคนที่โปรเจกต์ต้องใช้ในวันนั้น ไม่นับวันอาทิตย์ เว้นแต่ติ๊ก "รวมวันอาทิตย์" · "คนที่มี" คือพนักงานที่ใช้งานอยู่ หักคนที่มีแผนลาในวันนั้น · ช่องแดงคือคนไม่พอ</p>`;
  return h;
}
/* daily view (tablet / phone): the month's days as a scrolling strip, the chosen day's need vs available, active projects */
function monthDay(days){
  const from=ymd(days[0]),to=ymd(days[days.length-1]);
  if(!S.mday||S.mday<from||S.mday>to){const t=ymd(new Date());S.mday=t>=from&&t<=to?t:from}
  return S.mday;
}
function stepMonthDay(dir){
  const kd=addDays(parseD(S.mday||ymd(S.month)),dir);S.mday=ymd(kd);
  if(kd.getMonth()!==S.month.getMonth()||kd.getFullYear()!==S.month.getFullYear())setMonth(kd);else{S.anim=null;render()}
}
function projDayHtml({days,list,need,avail}){
  const k=monthDay(days);const d=parseD(k);
  const reqOn=x=>list.reduce((a,p)=>a+need(p,x),0);const req=reqOn(d);const av=avail(d);const rest=av==null?null:av-req;
  let h=`<section class="wp-panel pd-panel" aria-label="กำลังคน ${esc(fmtDay(k))}">`+dayStrip(days,k,xk=>{const x=parseD(xk);const n=reqOn(x);const a=avail(x);return [n||'–',a!=null&&n>a?'over':!n?'zero':'',n?`ต้องใช้ ${n} คน`:'ไม่มีโปรเจกต์']},'mday',true)
    +pdHead(d,`ต้องใช้ ${req} คน · มี ${av==null?'…':av} คน (หักคนลา)${rest!=null&&req?` · <b class="${rest<0?'neg':'pos'}">${rest<0?'⚠ ขาด '+(-rest):'เหลือ '+rest} คน</b>`:''}`,'mday')+'<div class="pd-body" data-swipe="mday">';
  const on=list.filter(p=>need(p,d));
  if(!on.length)h+='<div class="pd-empty">ไม่มีโปรเจกต์ที่ต้องใช้คนในวันนี้</div>';
  else h+=`<div class="pj-list">${on.map(p=>{const total=Math.round((parseD(p.to)-parseD(p.from))/864e5)+1;const nth=Math.round((d-parseD(p.from))/864e5)+1;
    return `<div class="pj-card">${S.canWrite?`<button type="button" class="proj-name" data-proj-edit="${esc(p.id)}" title="แก้ไขโปรเจกต์">`:'<div class="proj-name">'}<b>${esc(p.name)}</b><small>${esc(fmtDay(p.from))} – ${esc(fmtDay(p.to))}${p.workSun?' · รวมวันอาทิตย์':''} · วันที่ ${nth} จาก ${total}</small>${p.note?`<small>${esc(p.note)}</small>`:''}${S.canWrite?'</button>':'</div>'}<span class="pj-need"><b>${need(p,d)}</b>คน</span></div>`}).join('')}</div>`;
  return h+'</div></section><p class="hint">"มี" คือพนักงานที่ใช้งานอยู่ หักคนที่มีแผนลาในวันนั้น ไม่นับวันอาทิตย์ เว้นแต่โปรเจกต์ติ๊ก "รวมวันอาทิตย์"</p>';
}
function projForm(){
  const p=S.projEdit==='new'?{name:'',headcount:'',from:ymd(S.month),to:'',note:'',workSun:false}:S.projects.find(x=>x.id===S.projEdit);
  if(!p){S.projEdit=null;return ''}
  return `<form class="panel" id="projForm" data-id="${esc(S.projEdit)}"><header><h2>${S.projEdit==='new'?'เพิ่มโปรเจกต์':'แก้ไขโปรเจกต์'}</h2><p>จำนวนคนต่อวันจะถูกนับทุกวันในช่วงวันที่ (ยกเว้นวันอาทิตย์ ถ้าไม่ได้ติ๊ก)</p></header>
    <div class="pgrid">
      <div class="field span2m"><label for="pj-name">ชื่องาน / โปรเจกต์</label><input id="pj-name" name="name" maxlength="120" required value="${esc(p.name)}" placeholder="เช่น Shutdown โรงงาน … ระยอง"></div>
      <div class="field"><label for="pj-n">จำนวนคน / วัน</label><input id="pj-n" name="headcount" type="number" min="1" max="200" required value="${esc(p.headcount)}"></div>
      <div class="field"><label for="pj-from">วันเริ่ม</label><input id="pj-from" name="from" type="date" required value="${esc(p.from)}"></div>
      <div class="field"><label for="pj-to">วันจบ</label><input id="pj-to" name="to" type="date" required value="${esc(p.to)}"></div>
      <div class="field span2m" style="grid-column:1/-1"><label for="pj-note">หมายเหตุ</label><input id="pj-note" name="note" maxlength="300" value="${esc(p.note||'')}" placeholder="เช่น ต้องมีวิศวกรอย่างน้อย 1 คน"></div>
    </div>
    <div class="pbtns"><label class="check"><input type="checkbox" id="pj-sun" name="workSun"${p.workSun?' checked':''}> รวมวันอาทิตย์</label><span class="grow"></span>
      ${S.projEdit!=='new'?'<button type="button" class="btn danger" data-action="proj-del" id="btnProjDel">ลบโปรเจกต์</button>':''}
      <button type="button" class="btn ghost" data-action="proj-cancel">ยกเลิก</button><button type="submit" class="btn primary">บันทึก</button></div>
    <p class="form-err" id="pj-err" hidden></p></form>`;
}
