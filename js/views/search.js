'use strict';
/* BU1 Weekly Plan · history search */
/* ---------- view: search history ---------- */
function renderSearch(){
  return `<div class="toolbar">
    <input type="search" id="srch-q" placeholder="พิมพ์ Plan No. ชื่อลูกค้า หรือชื่อพนักงาน" value="${esc(S.srch.q)}" aria-label="คำค้น" autocomplete="off">
    <div class="seg" role="radiogroup" aria-label="ค้นหาด้วย">${[['all','ทุกช่อง'],['plan','Plan No.'],['cust','Customer'],['staff','พนักงาน']].map(([v,l])=>`<label><input type="radio" name="srch-by" id="srch-by-${v}" value="${v}"${S.srch.by===v?' checked':''}><span>${l}</span></label>`).join('')}</div>
    <label class="wk-jump">ตั้งแต่ <input type="date" id="srch-from" value="${esc(S.srch.from)}"></label>
    <label class="wk-jump">ถึง <input type="date" id="srch-to" value="${esc(S.srch.to)}"></label>
    <button type="button" class="btn sm ghost" data-action="srch-reload">โหลดข้อมูลล่าสุด</button>
  </div>
  <div class="scroll-x"><table class="list"><thead><tr><th>วันที่</th><th>Plan No.</th><th>หัวข้องาน</th><th>Customer / Location</th><th>ช่วงเวลา</th><th>Team Service</th><th>Transport</th><th>Sale</th><th>สถานะ</th></tr></thead><tbody id="srchBody"></tbody></table><div class="count-note" id="srchCount"></div></div>`;
}
function fillSearch(){
  const body=$('#srchBody');if(!body)return;
  const all=allTasks();
  if(!all){body.innerHTML=`<tr><td colspan="9" class="hint" style="padding:20px 12px">กำลังโหลดแผนทุกสัปดาห์…</td></tr>`;$('#srchCount').textContent='';return}
  const q=norm(S.srch.q);const by=S.srch.by;const {from,to}=S.srch;
  let list=all.filter(t=>(!from||t.date>=from)&&(!to||t.date<=to));
  if(q)list=list.filter(t=>{
    const plan=norm(t.planNo).includes(q),cust=norm(t.customer).includes(q),st=norm(teamNames(t).join(' ')).includes(q);
    if(by==='plan')return plan;if(by==='cust')return cust;if(by==='staff')return st;
    return plan||cust||st||norm([t.location,detailOf(t),typeLabel(t),t.sale,t.contact,t.request].join(' ')).includes(q);
  });
  list.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||byTime(a,b));
  const shown=list.slice(0,300);
  body.innerHTML=shown.map(t=>{const ty=typeOf(t);return `<tr><td class="num"><button type="button" class="ttl" data-edit="${esc(t.id)}">${esc(fmtDayY(t.date))}</button><span class="sub">สัปดาห์ ${esc(weekName(mondayOf(parseD(t.date))))} · <button type="button" class="lnk" data-goweek="${esc(t.date)}">เปิดสัปดาห์</button></span></td>
    <td class="num">${esc(t.planNo||'–')}</td><td><span class="tdot" style="--c:${safeColor(ty.color)}"><i></i>${esc(typeLabel(t))}</span></td>
    <td>${esc(t.customer||'–')}<span class="sub">${esc(t.location||'')}</span></td><td>${esc(pName(t))}${t.timeNote?`<span class="sub">${esc(t.timeNote)}</span>`:''}</td>
    <td>${esc(teamNames(t).join(', ')||'–')}</td><td>${esc(t.transport||'–')}</td><td>${esc(t.sale||'–')}</td><td><span class="pill">${statusIcon(t.status)} ${esc((STATUS[t.status]||STATUS.planned).th)}</span>${NEEDS_REASON.has(t.status)&&t.statusNote?`<span class="sub">${esc(t.statusNote)}</span>`:''}</td></tr>`}).join('')
    ||`<tr><td colspan="9" style="color:var(--muted);padding:20px 12px">ไม่พบแผนงานที่ตรงกับคำค้น</td></tr>`;
  $('#srchCount').textContent=`พบ ${list.length.toLocaleString('th-TH')} แผน${list.length>300?' (แสดง 300 รายการล่าสุด)':''} จากทั้งหมด ${all.length.toLocaleString('th-TH')} แผนในระบบ`;
}
