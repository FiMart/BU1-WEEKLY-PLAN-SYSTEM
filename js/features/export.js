'use strict';
/* BU1 Weekly Plan · Excel and A3 print exports */
/* ---------- exports ---------- */
function loadXLSX(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=()=>res(window.XLSX);s.onerror=()=>rej(new Error('load'));document.head.appendChild(s)});
}
const stTh=s=>(STATUS[s]||STATUS.planned).th;
const fileWeek=()=>`BU1-Weekly-Plan_${weekName(S.week).replace(/\s+/g,'-')}`;
async function saveFile(filename,data,msg){
  try{await downloads.save({filename,data});toast(msg||'ส่งไฟล์ให้ดาวน์โหลดแล้ว')}
  catch(e){const c=e&&e.code;if(c==='declined')return;toast(c==='rate_limited'?'มีหน้าต่างดาวน์โหลดเปิดอยู่ รอสักครู่แล้วลองใหม่':'ดาวน์โหลดไม่สำเร็จในมุมมองนี้')}
}
async function exportXlsx(btn){
  btn.disabled=true;const old=btn.textContent;btn.textContent='กำลังสร้างไฟล์…';
  try{
    const X=await loadXLSX();const wb=X.utils.book_new();const days=weekDays();const tasks=shownTasks().slice().sort(byTime);
    const title=[`BU1 Lab · Weekly Plan ${weekName(S.week)} (${fmtShort(S.week)} – ${fmtShort(addDays(S.week,6))} ${be(addDays(S.week,6))})`];
    const head=['วันที่','วัน','หัวข้องาน','Plan No.','Sale','Customer','Location','ช่วงเวลา','Time','Detail','Request','Transport','Contact','เบอร์ติดต่อ','Team Service','สถานะ','จัดชน'];
    const conf=allConflicts();
    const ws1=X.utils.aoa_to_sheet([title,[],head,...tasks.map(t=>[t.date,TH_DAY_FULL[parseD(t.date).getDay()],typeLabel(t),t.planNo||'',t.sale||'',t.customer||'',t.location||'',pName(t),t.timeNote||'',detailOf(t),t.request||'',transportText(t),t.contact||'',t.contactTel||'',teamNames(t).join(', '),statusText(t),conf.has(t.id)?confLabel(conf.get(t.id)):''])]);
    ws1['!cols']=[11,10,18,14,16,24,24,10,22,44,30,14,20,14,32,12,26].map(w=>({wch:w}));
    X.utils.book_append_sheet(wb,ws1,'แผนงาน');
    const staff=visibleStaff(tasks.filter(isWorking));
    const grid=[title,[],['พนักงาน','ตำแหน่ง',...days.map(d=>`${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}`)]];
    for(const s of staff)grid.push([s.name,s.role||'',...days.map(d=>{const l=tasks.filter(t=>t.date===ymd(d)&&isWorking(t)&&(t.staffIds||[]).includes(s.id)).sort(byTime);return daySummary(l).text+(l.length?'\n'+l.map(t=>`${pName(t)} ${typeLabel(t)}${t.planNo?' '+t.planNo:''}${t.customer?' ('+t.customer+')':''}`).join('\n'):'')})]);
    const ws2=X.utils.aoa_to_sheet(grid);ws2['!cols']=[{wch:22},{wch:14},...days.map(()=>({wch:30}))];
    X.utils.book_append_sheet(wb,ws2,'สรุปรายคน');
    const buf=X.write(wb,{type:'array',bookType:'xlsx'});
    await saveFile(fileWeek()+'.xlsx',buf);
  }catch(e){toast('สร้างไฟล์ Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่')}
  finally{btn.disabled=false;btn.textContent=old}
}
const LOGO_MARK='<svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="rp-drop" x1="12" y1="3" x2="36" y2="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8BE0FF"/><stop offset=".5" stop-color="#2E8BF5"/><stop offset="1" stop-color="#1747C4"/></linearGradient></defs><path d="M24 2.5C23.1 2.5 8.5 18.8 8.5 30.3a15.5 15.5 0 0 0 31 0C39.5 18.8 24.9 2.5 24 2.5Z" fill="url(#rp-drop)"/><path d="M13 30c2.4-2.7 4.9-2.7 7.3 0s4.9 2.7 7.3 0 4.9-2.7 7.3 0" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="M15 37c2-2.1 4-2.1 6 0s4 2.1 6 0 4-2.1 6 0" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/></svg>';
async function exportReport(){
  const days=weekDays();const tasks=shownTasks();const conf=allConflicts();const wn=weekName(S.week);const last=addDays(S.week,6);
  const staff=visibleStaff(tasks.filter(isWorking));const now=new Date();
  const r=(k,v,always)=>(v||always)?`<tr><th>${k}</th><td>${esc(v||'')}</td></tr>`:'';
  const cardH=t=>{const ty=typeOf(t);const tel=saleTel(t.sale);const c=conf.get(t.id);
    return `<div class="cd${t.status==='cancelled'?' x':''}" style="--c:${safeColor(ty.color)}"><div class="bd"><b>${esc(typeLabel(t))}</b><span>${esc(pName(t))}</span></div><table>
${r('Plan No.',t.planNo,true)}${r('Sale',[t.sale,tel].filter(Boolean).join(' · '))}${r('Customer',t.customer,true)}${r('Location',t.location)}${r('Time',t.timeNote)}${r('Detail',detailOf(t).trim())}${r('Request',t.request)}${r('Transport',transportText(t))}${r('Contact',[t.contact,t.contactTel].filter(Boolean).join(' '))}${r('Team',teamNames(t).join(', '),true)}${t.status&&t.status!=='planned'?r('สถานะ',statusText(t)):''}
</table>${c?`<div class="w">⚠ ${esc(confLabel(c))}</div>`:''}</div>`};
  const legend=jobTypes().filter(t=>t.active!==false).map(t=>`<span><i style="background:${safeColor(t.color)}"></i>${esc(t.name)}</span>`).join('');
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly Plan ${esc(wn)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&family=IBM+Plex+Mono&display=swap">
<style>@page{size:A3 landscape;margin:8mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10px/1.4 "IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif;color:#0b1b33;margin:12px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:10px 12px;background:#eef3fa;border-radius:8px;font-size:13px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1462d0;padding-bottom:5px;margin-bottom:6px}.hd h1{font-size:20px;margin:0}.hd p{margin:0;color:#34496b}
.lg{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 6px;color:#34496b}.lg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:-1px}
.wk{display:grid;grid-template-columns:repeat(${days.length},minmax(0,1fr));gap:2.5mm;align-items:start}.dy>h2{margin:0 0 2mm;font-size:12px;background:#0a2150;color:#fff;padding:3px 6px;border-radius:4px;display:flex;justify-content:space-between}
.cd{border:1px solid #6b7c93;border-radius:4px;margin-bottom:2mm;break-inside:avoid;page-break-inside:avoid;overflow:hidden}.cd.x{opacity:.5}.bd{display:flex;justify-content:space-between;gap:4px;background:var(--c);color:#fff;padding:2px 5px;font-size:10.5px}.bd b{font-weight:600}
.cd table{border-collapse:collapse;width:100%}.cd th,.cd td{border-top:1px solid #c6d9f1;padding:1px 4px;vertical-align:top;text-align:left;font-size:9.5px}.cd th{width:15mm;background:#92D050;font-weight:600;white-space:nowrap}.cd td{white-space:pre-line;overflow-wrap:anywhere}
.w{background:#fbeae9;color:#b42323;font-weight:600;padding:2px 4px;font-size:9.5px}.pb{break-before:page;page-break-before:always}
.sm{border-collapse:collapse;width:100%}.sm th,.sm td{border:1px solid #c6d9f1;padding:3px 5px;text-align:left;vertical-align:top;font-size:10px}.sm thead th{background:#e6f1fd}.fr{color:#006300;font-weight:600}.lv{color:#875800;font-weight:600}
.sig{display:flex;gap:40px;margin-top:30px}.sig div{flex:1;text-align:center}.sig span{display:block;border-top:1px solid #0b1b33;margin:30px 16px 4px}
@media print{.bar{display:none}body{margin:0}}</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>ตั้งค่า: กระดาษ A3 · แนวนอน (Landscape) · ติ๊ก Background graphics</span></div>
<div class="hd"><div style="display:flex;gap:10px;align-items:center">${LOGO_MARK}<div><p>BU1 Lab · Weekly Plan</p><h1>${esc(wn)}</h1></div></div><p>${esc(`จันทร์ ${fmtShort(S.week)} – อาทิตย์ ${fmtShort(last)} ${be(last)}`)}<br>พิมพ์เมื่อ ${fmtShort(now)} ${be(now)} ${pad(now.getHours())}:${pad(now.getMinutes())} น.</p></div>
<div class="lg">${legend}</div>
<div class="wk">${days.map(d=>{const l=tasks.filter(t=>t.date===ymd(d)).sort(byTime);return `<div class="dy"><h2><span>${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}</span><span>${l.length}/${MAX_CARDS}</span></h2>${l.map(cardH).join('')}</div>`}).join('')}</div>
<h2 class="pb" style="font-size:14px;margin:0 0 6px">สรุปรายคนรายวัน · ${esc(wn)}</h2>
<table class="sm"><thead><tr><th>พนักงาน</th>${days.map(d=>`<th>${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}</th>`).join('')}</tr></thead><tbody>${staff.map(s=>`<tr><th>${esc(s.name)}<br><span style="font-weight:400;color:#62738f">${esc(s.role||'')}</span></th>${days.map(d=>{const l=tasks.filter(t=>t.date===ymd(d)&&isWorking(t)&&(t.staffIds||[]).includes(s.id)).sort(byTime);const r2=daySummary(l);
  return `<td>${r2.free?'<span class="fr">ว่าง</span>':`${r2.jobs?`<b>${r2.jobs} งาน</b> แรก ${esc(r2.first)} · สุดท้าย ${esc(r2.last)}`:''}${r2.leave?` <span class="lv">ลา ${esc(r2.leave)}</span>`:''}<br>${l.filter(t=>!isLeave(t)).map(t=>esc(`${pName(t)} ${typeLabel(t)}${t.planNo?' '+t.planNo:''}`)).join('<br>')}`}</td>`}).join('')}</tr>`).join('')}</tbody></table>
<div class="sig"><div><span></span>ผู้จัดทำ</div><div><span></span>หัวหน้า Lab / ผู้ตรวจสอบ</div><div><span></span>ผู้อนุมัติ</div></div></body></html>`;
  await saveFile(fileWeek()+'_A3.html',html,'ดาวน์โหลดแล้ว เปิดไฟล์แล้วกด "พิมพ์ / บันทึกเป็น PDF" เลือก A3 แนวนอน');
}
