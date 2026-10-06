'use strict';
/* BU1 Weekly Plan · Excel and A3 print exports */
/* ---------- exports ---------- */
function loadXLSX(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>res(window.XLSX);s.onerror=()=>rej(new Error('load'));document.head.appendChild(s)});
}
const stTh=s=>(STATUS[s]||STATUS.planned).th;
const fileWeek=()=>`BU1-Weekly-Plan_${S.line?LINE[S.line].short.replace(/\s+/g,'-')+'_':''}${weekName(S.week).replace(/\s+/g,'-')}`;
const lineTitle=()=>S.line?` · ${lineName()}`:'';
async function saveFile(filename,data,msg){
  try{await downloads.save({filename,data});toast(msg||'ส่งไฟล์ให้ดาวน์โหลดแล้ว')}
  catch(e){const c=e&&e.code;if(c==='declined')return;toast(c==='rate_limited'?'มีหน้าต่างดาวน์โหลดเปิดอยู่ รอสักครู่แล้วลองใหม่':'ดาวน์โหลดไม่สำเร็จในมุมมองนี้')}
}
async function exportXlsx(btn){
  btn.disabled=true;const old=btn.textContent;btn.textContent='กำลังสร้างไฟล์…';
  try{
    const X=await loadXLSX();const wb=X.utils.book_new();const days=weekDays();const all=shownTasks().slice().sort(byTime);const tasks=all.filter(lineMatch);
    const title=[`BU1 Lab · Weekly Plan${lineTitle()} ${weekName(S.week)} (${fmtShort(S.week)} – ${fmtShort(addDays(S.week,6))} ${be(addDays(S.week,6))})`];
    const head=['วันที่','วัน','สายงาน','หัวข้องาน','Plan No.','Sale','Customer','Location','ช่วงเวลา','Time','Detail','Request','Transport','Contact','เบอร์ติดต่อ','Team Service','สถานะ','จัดชน'];
    const conf=allConflicts();
    const ws1=X.utils.aoa_to_sheet([title,[],head,...tasks.map(t=>[t.date,TH_DAY_FULL[parseD(t.date).getDay()],LINE[lineOf(t)]?LINE[lineOf(t)].name:'',typeLabel(t),t.planNo||'',t.sale||'',t.customer||'',t.location||'',pName(t),t.timeNote||'',detailOf(t),t.request||'',transportText(t),t.contact||'',t.contactTel||'',teamNames(t).join(', '),statusText(t),conf.has(t.id)?confLabel(conf.get(t.id)):''])]);
    ws1['!cols']=[11,10,20,18,14,16,24,24,10,22,44,30,14,20,14,32,12,26].map(w=>({wch:w}));
    X.utils.book_append_sheet(wb,ws1,'แผนงาน');
    /* per person: every line (one shared team), so "ว่าง" is true */
    const staff=visibleStaff(all.filter(isWorking));
    const grid=[title,[],['พนักงาน','ตำแหน่ง',...days.map(d=>`${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}`)]];
    for(const s of staff)grid.push([s.name,s.role||'',...days.map(d=>{const l=all.filter(t=>t.date===ymd(d)&&isWorking(t)&&(t.staffIds||[]).includes(s.id)).sort(byTime);return daySummary(l).text+(l.length?'\n'+l.map(t=>`${pName(t)} ${typeLabel(t)}${t.planNo?' '+t.planNo:''}${t.customer?' ('+t.customer+')':''}`).join('\n'):'')})]);
    const ws2=X.utils.aoa_to_sheet(grid);ws2['!cols']=[{wch:22},{wch:14},...days.map(()=>({wch:30}))];
    X.utils.book_append_sheet(wb,ws2,'สรุปรายคน');
    /* the team's "Weekly plan calibration" sheet, same columns (Flow Meter plans of the week) */
    const cr=S.line==='ins'?[]:calWeekRows(tasks);
    if(cr.length){const ws3=X.utils.aoa_to_sheet([['Weekly plan calibration'],[`${fmtShort(S.week)} – ${fmtShort(addDays(S.week,6))} ${be(addDays(S.week,6))}`],CAL_HEAD,...cr.map(calRowCells)]);
      ws3['!cols']=[12,5,14,26,20,8,20,14,18,24,16,14,9,14,9,30].map(w=>({wch:w}));ws3['!merges']=[{s:{r:0,c:0},e:{r:0,c:CAL_HEAD.length-1}}];
      X.utils.book_append_sheet(wb,ws3,'Weekly plan calibration')}
    /* "Weekly plan instrument": the rows, then their certificates */
    const ir=S.line==='fm'?[]:insWeekRows(tasks);
    if(ir.length){const span=`${fmtShort(S.week)} – ${fmtShort(addDays(S.week,6))} ${be(addDays(S.week,6))}`;
      const ws4=X.utils.aoa_to_sheet([['Weekly plan instrument'],[span],INS_HEAD,...ir.map(insRowCells)]);
      ws4['!cols']=[12,16,9,24,10,22,12,30,9,9,9,6,16,16,6,7,16].map(w=>({wch:w}));X.utils.book_append_sheet(wb,ws4,'Weekly plan instrument');
      const cr2=ir.flatMap(insCertCells);
      if(cr2.length){const ws5=X.utils.aoa_to_sheet([['Certificates · Weekly plan instrument'],[span],INS_CERT_HEAD,...cr2]);ws5['!cols']=[20,6,18,16,18,30,24,10,14,24].map(w=>({wch:w}));X.utils.book_append_sheet(wb,ws5,'Certificates')}}
    const buf=X.write(wb,{type:'array',bookType:'xlsx'});
    await saveFile(fileWeek()+'.xlsx',buf);
  }catch(e){toast('สร้างไฟล์ Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่')}
  finally{btn.disabled=false;btn.textContent=old}
}
const LOGO_MARK='<svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="rp-drop" x1="12" y1="3" x2="36" y2="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8BE0FF"/><stop offset=".5" stop-color="#2E8BF5"/><stop offset="1" stop-color="#1747C4"/></linearGradient></defs><path d="M24 2.5C23.1 2.5 8.5 18.8 8.5 30.3a15.5 15.5 0 0 0 31 0C39.5 18.8 24.9 2.5 24 2.5Z" fill="url(#rp-drop)"/><path d="M13 30c2.4-2.7 4.9-2.7 7.3 0s4.9 2.7 7.3 0 4.9-2.7 7.3 0" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M15 37c2-2.1 4-2.1 6 0s4 2.1 6 0 4-2.1 6 0" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/></svg>';
/* Print / PDF: the Weekly Plan of the open week as the board shows it — rows = หัวข้องาน (or ลูกค้า, as on screen; ลา last),
   columns = days — on A3 landscape; page 2 = สรุปรายคนรายวัน with signature lines. Opens a print window at once
   (the page prints itself when its fonts are ready); if the browser blocks the window, the same page is downloaded instead. */
async function exportReport(){
  const days=weekDays();const all=shownTasks();const tasks=all.filter(lineMatch);const conf=allConflicts();const wn=weekName(S.week);const last=days[days.length-1];
  const staff=visibleStaff(all.filter(isWorking));const now=new Date();const today=ymd(now);/* page 2: every line (one shared team) */
  const groups=planGroups(tasks);
  const work=tasks.filter(t=>isWorking(t)&&!isLeave(t));const cnt=s=>work.filter(t=>(t.status||'planned')===s).length;
  const cardH=t=>{const ty=typeOf(t);const c=conf.get(t.id);const st=t.status||'planned';
    const det=detailOf(t).split('\n').map(x=>x.trim()).filter(Boolean).slice(0,3).join('\n');const tr=transportText(t);
    return `<div class="cd st-${esc(st)}" style="--c:${safeColor(ty.color)}">
      <div class="ct"><b class="pn">${!S.line&&LINE[lineOf(t)]?`<span class="ln" style="background:${LINE[lineOf(t)].color}">${LINE[lineOf(t)].tag}</span>`:''}${esc(t.planNo||typeLabel(t))}</b><i class="dot" title="${esc(stTh(st))}"></i></div>
      <div class="cs"><span class="per">${esc(pName(t))}</span>${esc([t.planNo?typeLabel(t):'',t.timeNote].filter(Boolean).join(' · '))}</div>
      ${t.location?`<div class="cl">L : <b>${esc(t.location)}</b></div>`:''}${t.customer&&S.pf.by!=='cust'?`<div class="cc">${esc(t.customer)}</div>`:''}
      ${det?`<div class="cdet">${esc(det)}</div>`:''}${tr?`<div class="ctr">🚗 ${esc(tr)}</div>`:''}
      ${teamNames(t).length?`<div class="cpp">${teamNames(t).map(n=>`<span>${esc(n)}</span>`).join('')}</div>`:''}
      ${NEEDS_REASON.has(st)?`<div class="w">${esc(statusFlag(st))}${t.statusNote?': '+esc(t.statusNote):''}</div>`:''}${c?`<div class="w">⚠ ${esc(confLabel(c))}</div>`:''}</div>`};
  const head=days.map(d=>{const k=ymd(d);const n=tasks.filter(t=>t.date===k).length;const hol=holidayOf(k);
    return `<th class="${isOffDay(d)?'we':''}${k===today?' td':''}"><b>${EN_DAY[d.getDay()]}</b><span>${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}</span>${hol?`<em>${esc(hol)}</em>`:''}<small>${n}/${MAX_CARDS} แผน</small></th>`}).join('');
  const body=groups.map(g=>`<tr><th class="gh" style="--c:${safeColor(g.color)}"><b>${esc(g.label)}</b><small>${g.tasks.length} แผน</small></th>${days.map(d=>{const k=ymd(d);
    return `<td class="${isOffDay(d)?'we':''}">${g.tasks.filter(t=>t.date===k).sort(byTime).map(cardH).join('')}</td>`}).join('')}</tr>`).join('')
    ||`<tr><td colspan="${days.length+1}" class="empty">ยังไม่มีแผนในสัปดาห์นี้</td></tr>`;
  const legend=`<span><i style="background:#8a979c"></i>วางแผน ${cnt('planned')}</span><span><i style="background:#0ca30c"></i>เสร็จ ${cnt('done')}</span><span><i style="background:#fab219"></i>เลื่อน ${cnt('postponed')}</span>${cnt('notdone')?`<span><i style="background:#d03b3b"></i>ไม่เสร็จ ${cnt('notdone')}</span>`:''}${conf.size?`<span class="alert">⚠ จัดชน ${tasks.filter(t=>conf.has(t.id)).length}</span>`:''}`;
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly Plan${esc(lineTitle())} ${esc(wn)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>@page{size:A3 landscape;margin:7mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:9.5px/1.4 "IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif;color:#0b1b33;margin:12px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:10px 12px;background:#eef3fa;border-radius:8px;font-size:13px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid #1462d0;padding-bottom:5px;margin-bottom:6px}.hd h1{font-size:20px;margin:0;line-height:1.25}.hd p{margin:0;color:#34496b;font-size:11px}
.lg{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0 0 6px;color:#34496b;font-size:10.5px}.lg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:-1px}.lg .alert{color:#b42323;font-weight:600}
table.wp{border-collapse:collapse;width:100%;table-layout:fixed}
.wp col.g{width:24mm}.wp th,.wp td{border:1px solid #c6d3e4;vertical-align:top;padding:1.5mm}
.wp thead th{background:#0a2150;color:#fff;text-align:center;padding:1.5mm 1mm}.wp thead th b{display:block;font-size:12px;letter-spacing:.06em}.wp thead th span{display:block;font-size:9.5px;opacity:.9}
.wp thead th small{display:inline-block;margin-top:2px;padding:0 6px;border-radius:99px;background:rgba(255,255,255,.18);font-size:9px}.wp thead th em{display:block;font-style:normal;font-size:9px;color:#ffd6d6}
.wp thead th.we{background:#33476b}.wp thead th.td{background:#1462d0}.wp thead th.corner{text-align:left;font-size:9.5px;font-weight:500}
.wp td.we{background:#f7f4ee}.wp tr{break-inside:avoid;page-break-inside:avoid}
.gh{background:#f5f8fd;text-align:left;border-left:3px solid var(--c)!important}.gh b{display:block;font-size:11px;font-weight:600}.gh small{color:#62738f}
.cd{border:1px solid #b9c6d8;border-left:3px solid var(--c);border-radius:4px;padding:1.2mm 1.5mm;margin-bottom:1.5mm;background:#fff;break-inside:avoid;page-break-inside:avoid}
.cd.st-cancelled{opacity:.5}.cd.st-done{background:#f1faf1}
.ct{display:flex;justify-content:space-between;align-items:center;gap:4px}.pn{font:600 9.5px/1.3 "IBM Plex Mono","IBM Plex Sans Thai",monospace;overflow-wrap:anywhere}
.ln{display:inline-block;margin-right:3px;padding:0 3px;border-radius:3px;color:#fff;font-size:8px;font-weight:700;vertical-align:1px}
.dot{width:7px;height:7px;border-radius:50%;background:#8a979c;flex:none}.st-done .dot{background:#0ca30c}.st-postponed .dot{background:#fab219}.st-notdone .dot{background:#d03b3b}.st-cancelled .dot{background:#c6d3e4}
.cs{color:#34496b;font-size:9px}.per{display:inline-block;margin-right:4px;padding:0 4px;border-radius:3px;background:#e6f1fd;color:#1462d0;font-weight:600}
.cl{font-size:9px}.cc{font-weight:600;font-size:9.5px}.cdet{white-space:pre-line;font-size:9px;color:#34496b;overflow-wrap:anywhere}.ctr{font-size:9px;color:#6d46c8}
.cpp{display:flex;flex-wrap:wrap;gap:2px;margin-top:1px}.cpp span{padding:0 4px;border-radius:3px;background:#eef3fa;font-size:9px}
.w{margin-top:1px;background:#fbeae9;color:#b42323;font-weight:600;padding:1px 3px;border-radius:3px;font-size:8.5px}
.cwt{font-size:18px;text-align:center;margin:0 0 2px}.cws{text-align:center;margin:0 0 6px;color:#34496b}
.cw{border-collapse:collapse;width:100%}.cw th,.cw td{border:1px solid #6b7f99;padding:3px 5px;font-size:9.5px;vertical-align:top;overflow-wrap:anywhere}
.cw th{background:#8fd0ef;font-weight:600;text-align:center}.cw th.y{background:#f5e50a}.cw td.c{text-align:center}.cw tr{break-inside:avoid}
.iw .ih th{background:#92d050;color:#1a3fa0;font-style:italic}.iw .ih th.y{background:#92d050}.iw td.y{background:#ffff00}
.iw .idt td{background:#ffff00;color:#1a3fa0;font-size:11px;padding:4px 6px}.iw .icw{background:#dce9f7;padding:3px 3px 3px 24px}
.ic th{background:#fff;color:#1a3fa0;text-align:left}.ic td{background:#fff}
.empty{text-align:center;padding:10mm;color:#62738f}.pb{break-before:page;page-break-before:always}
.sm{border-collapse:collapse;width:100%}.sm th,.sm td{border:1px solid #c6d9f1;padding:3px 5px;text-align:left;vertical-align:top;font-size:10px}.sm thead th{background:#e6f1fd}.fr{color:#006300;font-weight:600}.lv{color:#875800;font-weight:600}
.sig{display:flex;gap:40px;margin-top:30px}.sig div{flex:1;text-align:center}.sig span{display:block;border-top:1px solid #0b1b33;margin:30px 16px 4px}
@media print{.bar{display:none}body{margin:0}}</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>ตั้งค่า: กระดาษ A3 · แนวนอน (Landscape) · ติ๊ก Background graphics</span></div>
<div class="hd"><div style="display:flex;gap:10px;align-items:center">${LOGO_MARK}<div><p>BU1 Lab · Weekly Planning${esc(lineTitle())}</p><h1>${esc(`${fmtShort(S.week)} – ${fmtShort(last)} ${be(last)}`)}</h1></div></div><p>${esc(`สัปดาห์ที่ ${isoWeek(S.week)} · ${wn}`)}<br>พิมพ์เมื่อ ${fmtShort(now)} ${be(now)} ${pad(now.getHours())}:${pad(now.getMinutes())} น.</p></div>
<div class="lg">${legend}</div>
<table class="wp"><colgroup><col class="g">${days.map(()=>'<col>').join('')}</colgroup><thead><tr><th class="corner">${S.pf.by==='cust'?'ลูกค้า':'หัวข้องาน'} \\ วัน</th>${head}</tr></thead><tbody>${body}</tbody></table>
${(()=>{const cr=S.line==='ins'?[]:calWeekRows(tasks);if(!cr.length)return '';
  return `<h2 class="pb cwt">Weekly plan calibration</h2><p class="cws">${esc(`${fmtShort(S.week)} – ${fmtShort(last)} ${be(last)} · ${cr.length} เครื่อง`)}</p>
  <table class="cw"><thead><tr>${CAL_HEAD.map((h,i)=>`<th class="${CAL_YELLOW.includes(i)?'y':''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${cr.map(r=>`<tr>${calRowCells(r).map((v,i)=>`<td class="${CAL_YELLOW.includes(i)?'y':''}${i===1?' c':''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`})()}
${(()=>{const ir=S.line==='fm'?[]:insWeekRows(tasks);if(!ir.length)return '';let day='';const n=INS_HEAD.length-1;
  const hd=`<tr class="ih">${INS_HEAD.slice(1).map((h,i)=>`<th class="${INS_YELLOW_I.includes(i+1)?'y':''}">${esc(h)}</th>`).join('')}</tr>`;
  return `<h2 class="pb cwt">Weekly plan instrument</h2><p class="cws">${esc(`${fmtShort(S.week)} – ${fmtShort(last)} ${be(last)} · ${ir.length} รายการ`)}</p><table class="cw iw">${ir.map(r=>{let h='';
    if(r.t.date!==day){day=r.t.date;h+=`<tr class="idt"><td colspan="${n}"><b>${esc(insDayBar(day))}</b>&nbsp;&nbsp;&nbsp;วัน${TH_DAY_FULL[parseD(day).getDay()]}</td></tr>${hd}`}
    h+=`<tr>${insRowCells(r).slice(1).map((v,i)=>`<td class="${INS_YELLOW_I.includes(i+1)?'y c':''}">${esc(v)}</td>`).join('')}</tr>`;
    const cc=insCertCells(r);if(cc.length)h+=`<tr><td colspan="${n}" class="icw"><table class="cw ic"><tr>${INS_CERT_HEAD.slice(1).map(x=>`<th>${esc(x)}</th>`).join('')}</tr>${cc.map(c=>`<tr>${c.slice(1).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table></td></tr>`;
    return h}).join('')}</table>`})()}
<h2 class="pb" style="font-size:14px;margin:0 0 6px">สรุปรายคนรายวัน · ${esc(wn)}</h2>
<table class="sm"><thead><tr><th>พนักงาน</th>${days.map(d=>`<th>${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}</th>`).join('')}</tr></thead><tbody>${staff.map(s=>`<tr><th>${esc(s.name)}<br><span style="font-weight:400;color:#62738f">${esc(s.role||'')}</span></th>${days.map(d=>{const l=all.filter(t=>t.date===ymd(d)&&isWorking(t)&&(t.staffIds||[]).includes(s.id)).sort(byTime);const r2=daySummary(l);
  return `<td>${r2.free?'<span class="fr">ว่าง</span>':`${r2.jobs?`<b>${r2.jobs} งาน</b> แรก ${esc(r2.first)} · สุดท้าย ${esc(r2.last)}`:''}${r2.leave?` <span class="lv">ลา ${esc(r2.leave)}</span>`:''}<br>${l.filter(t=>!isLeave(t)).map(t=>esc(`${pName(t)} ${typeLabel(t)}${t.planNo?' '+t.planNo:''}`)).join('<br>')}`}</td>`}).join('')}</tr>`).join('')}</tbody></table>
<div class="sig"><div><span></span>ผู้จัดทำ</div><div><span></span>หัวหน้า Lab / ผู้ตรวจสอบ</div><div><span></span>ผู้อนุมัติ</div></div>
<script>/* opened from the app: print once the Thai font is ready (a downloaded copy just shows the button) */
if(window.opener)window.addEventListener('load',function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},300)})});</script></body></html>`;
  let w=null;try{w=window.open('','_blank')}catch(e){}
  if(w&&w.document){w.document.open();w.document.write(html);w.document.close();return}
  await saveFile(fileWeek()+'_A3.html',html,'ดาวน์โหลดแล้ว เปิดไฟล์แล้วกด "พิมพ์ / บันทึกเป็น PDF" เลือก A3 แนวนอน');
}
