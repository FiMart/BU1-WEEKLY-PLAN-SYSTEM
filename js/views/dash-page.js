'use strict';
/* BU1 Weekly Plan · Dashboard page (v4.27.0, user 21 Oct 2026: "ปรับเปลี่ยน Dashboard ใหม่ทั้งหมด แก้ไขเนื้อหา ให้ดูง่ายและเข้าใจง่าย
   ปรับ Design ใหม่หมดเลย เพิ่มการนำเสนอแบบ Chart ให้หลากหลายมากขึ้น"; chose tabs by topic · Utilization by month with the 100% line ·
   donuts for status / สายงาน / ทีม · a calendar heatmap of daily load · the period before + rankings · charts in the A4 print).
   Figures come from dashCompute (js/views/dashboard.js); charts from js/views/dash-charts.js. Tabs: S.dash.tab. */
const DZ_TABS=[['ov','ภาพรวม','Overview'],['man','กำลังคน','Manpower'],['jobs','งานและลูกค้า','Jobs & Customers'],['cal','สอบเทียบ · Master Plan','Calibration'],['iss','ติดตามงาน','Follow-up']];
const DZ_UNIT={day:'วัน',week:'สัปดาห์',month:'เดือน'};

/* ---------- chart specs, shared by the page and the A4 print ---------- */
function dzTrendSpec(D,h){
  const P=D.P,B=D.buckets;const day=P.unit==='day';
  return {label:`แนวโน้มงานราย${DZ_UNIT[P.unit]}`,h:h||240,unit:'แผน',
    cats:B.map(b=>({lbl:b.lbl,sub:b.sub,name:b.name,hl:b.td,go:day?b.from:null,more:day?`ว่าง ${b.free} คน${b.lv?` · ลา ${b.lv} คน`:''}`:''})),
    bars:DASH_SEG.map(([s,c])=>({name:stTh(s),color:c,vals:B.map(b=>b.c[s])})),
    lines:D.prevVals?[{name:P.pLabel,color:'var(--vz-prev)',vals:B.map((b,i)=>D.prevVals[i]!=null?D.prevVals[i]:null),dots:B.length<=16}]:[]};
}
function dzTrendLegend(D){return vzLegend([...DASH_SEG.map(([s,c])=>({name:stTh(s),color:c,n:D.stc[s]})),...(D.prevVals?[{name:`${D.P.pLabel} (รวม)`,color:'var(--vz-prev)',line:1}]:[])])}
function dzUtilSpecs(Y,D){
  const today=ymd(new Date());const inP=m=>m.to>=D.P.from&&m.from<=D.P.to;
  const cats=Y.months.map(m=>({lbl:TH_MON[m.i],sub:m.est?'EST':'',name:`${TH_MON_FULL[m.i]} ${Y.y+543}${m.est?' (ประมาณการ)':''}`,hl:D.P.mode!=='year'&&inP(m),more:`Working Day ${m.days} · OT ${m.ot} งาน`}));
  return {works:{label:'งานหน้างานเทียบ Std. Work รายเดือน',h:230,unit:'งาน',cats,
      bars:[{name:'Customer work',color:'var(--vz-1)',vals:Y.months.map(m=>m.cust)},{name:'Training (อบรม)',color:'var(--vz-3)',vals:Y.months.map(m=>m.train)}],
      lines:[{name:'Std. Work (100%)',color:'var(--ink-2)',vals:Y.months.map(m=>m.std)}]},
    pct:{label:'%Utilization รายเดือน',h:150,pct:true,cats,ref:{v:100,lbl:'100%'},
      lines:[{name:'%Utilization',color:'var(--vz-1)',vals:Y.months.map(m=>m.total||m.to<today?m.util:null)}]}};
}
const dzStatusItems=D=>STATUSES.map(s=>({name:s.th,n:D.stc[s.id]||0,color:s.color}));
const dzLineItems=D=>LINES.map(l=>({name:l.name,n:(D.lineRows.find(r=>r.l.id===l.id)||{}).n||0,color:l.color})).concat(D.noLineN?[{name:'ยังไม่ระบุสาย',n:D.noLineN,color:'var(--line)'}]:[]);
const dzTeamItems=D=>[{name:'Lab On-Site อย่างเดียว',n:D.teamMix.onsite,color:TEAM.onsite.color},{name:'Lab อย่างเดียว',n:D.teamMix.lab,color:TEAM.lab.color},
  {name:'ทั้งสองทีม',n:D.teamMix.both,color:'var(--vz-3)'},...(D.teamMix.none?[{name:'ยังไม่มีคนของทีม',n:D.teamMix.none,color:'var(--line)'}]:[])];

/* ---------- the A4 print: the same charts drawn at a fixed width, light colours ---------- */
const DZ_PRINT_CSS=`:root{--surface:#fff;--surface-2:#f6f8fc;--line:#dae0ea;--line-2:#e8ecf3;--ink:#0d1626;--ink-2:#39465b;--muted:#68768c;--good:#0ca30c;--warn:#fab219;--crit:#d03b3b;--crit-ink:#b42323;--serious:#ec835a;--accent:#1d5be0;
  --vz-1:#2a78d6;--vz-2:#eb6834;--vz-3:#1baf7a;--vz-prev:#8b95a7;--vz-grid:#e8ecf3;--vz-axis:#c3cad6;--vz-hl:#eef3fd}
.ch{border:1px solid #c6d9f1;border-radius:6px;padding:6px 8px 8px;margin:8px 0;break-inside:avoid}.ch h3{margin:0 0 4px}.ch3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;break-inside:avoid}.ch3 .ch{margin:0}
.vz-svg{display:block;max-width:100%;height:auto}.vz-legend{display:flex;flex-wrap:wrap;gap:3px 12px;list-style:none;margin:4px 0 0;padding:0;font-size:9.5px;color:#39465b}.vz-legend li{display:flex;align-items:center;gap:4px}.vz-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--c)}.vz-legend i.ln{width:14px;height:2px}
.vz-donut{display:flex;align-items:center;gap:8px}.vz-dsvg{flex:none}.vz-dleg{list-style:none;margin:0;padding:0;font-size:9px;flex:1;min-width:0}.vz-dleg li{display:grid;grid-template-columns:9px minmax(0,1fr) auto 26px;gap:4px;align-items:center}.vz-dleg i{width:8px;height:8px;border-radius:2px;background:var(--c)}.vz-dleg em{color:#68768c;font-style:normal;text-align:right}`;
function dzPrintCharts(D){
  const W=700;let h=`<div class="ch"><h3>แนวโน้มงานราย${DZ_UNIT[D.P.unit]}${D.prevVals?` · เส้นเทา = ${esc(D.P.pLabel)}`:''}</h3>${vzXY(dzTrendSpec(D,200),W)}${dzTrendLegend(D)}</div>`;
  const dn=(t,items)=>`<div class="ch"><h3>${t}</h3>${vzDonut(items,{sub:'แผน',size:96,th:13})}</div>`;
  h+=`<div class="ch3">${dn('สถานะงาน',dzStatusItems(D))}${!S.line?dn('แยกตามสายงาน',dzLineItems(D)):''}${teamsUsed()?dn('แยกตามทีม',dzTeamItems(D)):''}</div>`;
  const Y=utoYearData();
  if(Y){const s=dzUtilSpecs(Y,D);h+=`<div class="ch"><h3>Utilization หน้างาน · ปี ${Y.y+543} (Std. Work = วันทำงานทุกวันรวมเสาร์–อาทิตย์ × ${esc(String(utoCfg().perDay))} งาน/วัน)</h3>${vzXY(Object.assign({},s.works,{h:200}),W)}
    ${vzLegend([{name:'Customer work',color:'var(--vz-1)'},{name:'Training (อบรม)',color:'var(--vz-3)'},{name:'Std. Work (100%)',color:'var(--ink-2)',line:1}])}${vzXY(Object.assign({},s.pct,{h:120}),W)}</div>`}
  return h;
}

/* ---------- the page ---------- */
function renderDash(){
  if(notReady())return loading();
  const D=dashCompute();const P=D.P;const mode=P.mode;const tab=DZ_TABS.some(t=>t[0]===S.dash.tab)?S.dash.tab:'ov';
  const now=new Date();
  let h=`<div class="dash-bar dz-bar"><div class="seg" role="radiogroup" aria-label="ช่วงรายงาน">${DASH_MODES.map(([v,l])=>`<label><input type="radio" name="dash-mode" id="dash-${v}" value="${v}"${mode===v?' checked':''}><span>${l}</span></label>`).join('')}</div>
    ${mode!=='week'?`<div class="wk-nav"><button type="button" class="arrow" data-action="dprev" aria-label="${esc(P.pLabel)}">‹</button><button type="button" data-action="dthis">${{month:'เดือนนี้',quarter:'ไตรมาสนี้',year:'ปีนี้'}[mode]}</button><button type="button" class="arrow" data-action="dnext" aria-label="ช่วงถัดไป">›</button></div>`:''}
    <span class="dz-per"><b>${esc(P.label)}</b> ${esc(thDate(P.from))} – ${esc(thDate(P.to))}</span>
    ${downloads?`<span class="dz-acts"><button type="button" class="btn" data-action="dash-print" title="ดาวน์โหลดรายงาน A4 (มีกราฟ) สำหรับพิมพ์หรือบันทึกเป็น PDF">${PRINT_ICON} พิมพ์ / PDF</button><button type="button" class="btn" data-action="dash-xlsx" title="ดาวน์โหลดตัวเลขทุกตารางเป็นไฟล์ Excel">Excel</button></span>`:''}</div>`;
  if(D.loading)return h+loading();
  const iss=D.confN+D.lateN+D.gaN+D.docN;
  h+=`<div class="dz">
    <header class="dz-hd"><div><p class="rpt-org">${DASH_ORG}</p><h2>รายงานผลการปฏิบัติงาน${scopeName()?' · '+esc(scopeName()):''} · ${esc(P.label)}</h2></div>
      <p>เทียบกับ${esc(P.pLabel)} · ข้อมูล ณ ${esc(thDate(ymd(now)))} ${pad(now.getHours())}:${pad(now.getMinutes())} น.</p></header>
    <div class="dz-tabs" role="tablist" aria-label="หัวข้อ Dashboard">${DZ_TABS.map(([id,th,en])=>`<button type="button" role="tab" aria-selected="${tab===id}" class="${tab===id?'on':''}" data-dash-tab="${id}"><span class="dz-tl">${th}${id==='iss'&&iss?`<span class="dz-badge">${iss}</span>`:''}</span><small>${en}</small></button>`).join('')}</div>
    <div class="sum dz-body" role="tabpanel">${{ov:dzOverview,man:dzManpower,jobs:dzJobs,cal:dzCal,iss:dzIssues}[tab](D)}</div></div>`;
  requestAnimationFrame(vzMount);
  return h;
}
const dzCard=(span,title,sub,body,extra)=>`<section class="panel dz-card ${span}"${extra||''}><header><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</header>${body}</section>`;
function dzKpi(o){return `<div class="dz-kpi${o.cls?' '+o.cls:''}"${o.go?` role="button" tabindex="0" data-dash-tab="${o.go}"`:''} ${o.tip?`title="${esc(o.tip)}"`:''}>
  <span class="dz-kl">${o.lbl}<em>${o.en}</em></span><span class="dz-kv">${o.val}${o.unit?`<small>${o.unit}</small>`:''}</span>${o.delta||''}${o.viz||''}<span class="dz-kf">${o.foot||''}</span></div>`}
function dzDelta(cur,prv,D,unit){if(prv==null)return '<span class="dz-dl">กำลังโหลดช่วงก่อน…</span>';if(cur===prv)return `<span class="dz-dl">เท่ากับ${esc(D.P.pLabel)}</span>`;
  return `<span class="dz-dl ${cur>prv?'up':'down'}"><i aria-hidden="true">${cur>prv?'▲':'▼'}</i> ${Math.abs(cur-prv)}${unit||''} จาก${esc(D.P.pLabel)} (${prv})</span>`}

/* ภาพรวม: six numbers, the trend + status, Utilization by month + สายงาน / ทีม, the findings */
function dzOverview(D){
  const P=D.P,U=D.U;const iss=D.confN+D.lateN+D.gaN+D.docN;
  let h=`<div class="dz-kpis span-12">
    ${dzKpi({lbl:'งานทั้งหมด',en:'Total jobs',val:D.totalJ,unit:'แผน',delta:dzDelta(D.totalJ,D.prevJobs?D.prevJobs.length:null,D,' แผน'),viz:vzSpark(D.buckets.map(b=>b.n)),foot:`ทีมเฉลี่ย ${f1(D.avgTeam)} คนต่องาน`})}
    ${dzKpi({lbl:'อัตราปิดงาน',en:'Completion',val:D.doneRate==null?'–':D.doneRate,unit:D.doneRate==null?'':'%',viz:vzMeter(D.doneRate,{cls:D.doneRate!=null&&D.doneRate<70?'warn':'good'}),foot:esc(D.kpis[1].note)})}
    ${dzKpi({lbl:'Utilization หน้างาน',en:'Onsite',val:D.util,unit:'%',viz:vzMeter(D.util/1.5,{cls:D.util>100?'crit':D.util>=85?'warn':'',mark:100/1.5}),foot:`${U.total} จาก Std. ${U.std} งาน${U.ot?` · OT ${U.ot}`:''}`,tip:D.kpis[2].note,cls:D.util>100?'alert':'',go:'man'})}
    ${dzKpi({lbl:'คนที่มีงาน',en:'Active manpower',val:D.busyN,unit:`/ ${D.active.length} คน`,viz:vzMeter(pct(D.busyN,D.active.length)),foot:esc(D.kpis[4].note)})}
    ${dzKpi({lbl:'เลื่อน / ยกเลิก',en:'Postpone & cancel',val:D.pcRate,unit:'%',foot:`เลื่อน ${D.stc.postponed} · ยกเลิก ${D.stc.cancelled} จาก ${D.allJ} แผน`,cls:D.pcN?'warnt':''})}
    ${dzKpi({lbl:'ประเด็นต้องติดตาม',en:'Open issues',val:(iss?'⚠ ':'')+iss,unit:'รายการ',foot:iss?`จัดชน ${D.confN} · เลยวัน ${D.lateN} · รอ GA ${D.gaN} · เอกสาร ${D.docN} — กดดู`:'ไม่มีประเด็นค้าง',cls:iss?'alert':'ok',go:'iss'})}
  </div>`;
  h+=dzCard('span-8',`แนวโน้มงานราย${DZ_UNIT[P.unit]}`,`จำนวนแผนแยกตามสถานะ (ไม่รวมแผนลาและที่ยกเลิก)${D.prevVals?` · เส้นเทา = ${esc(P.pLabel)}`:''}${P.unit==='day'?' · กดที่วันเพื่อเปิดแผนวันนั้น':''}`,
    vzBox(dzTrendSpec(D))+dzTrendLegend(D),' style="--d:1"');
  h+=dzCard('span-4','สถานะงาน',`ทุกแผนในช่วงนี้ ${D.allJ} แผน (รวมที่ยกเลิก)`,vzDonut(dzStatusItems(D),{sub:'แผน',unit:'แผน',label:'สถานะงาน'}),' style="--d:2"');
  const Y=utoYearData();
  h+=dzCard('span-8',`Utilization หน้างาน · ปี ${utoYear()+543}`,`งานหน้างาน (มีคนทีม Lab On-Site) เทียบ Std. Work = วันทำงาน (ทุกวันรวมเสาร์–อาทิตย์ ไม่รวมวันหยุดนักขัตฤกษ์) × ${esc(String(utoCfg().perDay))} งาน/วัน · ${P.mode!=='year'?'แถบเข้ม = ช่วงที่เลือก · ':''}EST = เดือนที่ยังมีแผนรอถึงวัน`,
    Y?(()=>{const S2=dzUtilSpecs(Y,D);return vzBox(S2.works)+vzLegend([{name:'Customer work',color:'var(--vz-1)'},{name:'Training (อบรม)',color:'var(--vz-3)'},{name:'Std. Work (100%)',color:'var(--ink-2)',line:1}])
      +`<h3 class="dz-sub">%Utilization</h3>`+vzBox(S2.pct)+`<p class="dz-more"><button type="button" class="lnk" data-dash-tab="man">ดูตาราง ม.ค.–ธ.ค. และภาระงานรายวัน ›</button></p>`})():loading(),' style="--d:3"');
  h+=`<div class="span-4 dz-stack">${!S.line?dzCard('','แยกตามสายงาน','แผนงานของแต่ละสาย · กดเพื่อเปิดแท็บสายงาน',vzDonut(dzLineItems(D),{sub:'แผน',unit:'แผน',size:112,th:16,label:'แยกตามสายงาน'})+`<div class="dz-chips">${LINES.map(l=>`<button type="button" class="lnk" data-line-tab="${l.id}">${esc(l.name)} ›</button>`).join('')}</div>`,' style="--d:4"'):''}
    ${teamsUsed()?dzCard('','แยกตามทีม','แผนที่มีคนของทีมนั้น (คน All Team นับเป็นทั้งสองทีม)',vzDonut(dzTeamItems(D),{sub:'แผน',unit:'แผน',size:112,th:16,label:'แยกตามทีม'}),' style="--d:5"'):''}</div>`;
  h+=dzCard('span-12','ประเด็นสำคัญ','สรุปอัตโนมัติจากแผนงานในช่วงนี้',`<ul class="findings dz-find">${D.findings.map(f=>`<li class="${f.t}">${esc(f.s)}</li>`).join('')}</ul>`,' style="--d:6"');
  return h;
}

/* กำลังคน: calendar heatmap, the Utilization table, workload per person, per position, details */
function dzManpower(D){
  const P=D.P;const cd=D.calDays;const work=cd.filter(d=>!d.off);
  const top=cd.slice().sort((a,b)=>b.n-a.n)[0];const low=work.slice().sort((a,b)=>a.free-b.free)[0];const avg=work.length?work.reduce((a,d)=>a+d.n,0)/work.length:0;
  let h=dzCard('span-12','ภาระงานรายวัน',`สีเข้ม = แผนมาก (ตามแท็บสายงาน / ทีมที่เปิด) · ชี้ที่วันเพื่อดูงานหน้างานและคนว่าง · กดเพื่อเปิดแผนวันนั้น`,
    `<div class="dz-facts"><span><b>${f1(avg)}</b>แผนต่อวันทำงาน (เฉลี่ย)</span>${top&&top.n?`<span><b>${top.n}</b>สูงสุด · ${esc(fmtDay(top.k))}</span>`:''}${low?`<span><b>${low.free}</b>คนว่างน้อยสุด · ${esc(fmtDay(low.k))}</span>`:''}<span><b>${cd.reduce((a,d)=>a+d.ons,0)}</b>งานหน้างานในช่วงนี้</span></div>`
    +vzCal(cd,{compact:P.mode==='quarter'||P.mode==='year'}),' style="--d:1"');
  h+=utoPanelHtml();
  const ppl=D.people.filter(p=>p.wd||p.ot||p.jobs);
  /* man-days split by kind of day (user, 22 Oct 2026: Saturday and Sunday are working days too; public holidays = OT) */
  const DAYKEYS=[{id:'wk',name:'วันธรรมดา จ.–ศ.',color:'var(--vz-1)'},{id:'we',name:'เสาร์–อาทิตย์',color:'var(--vz-3)'},{id:'ot',name:'OT วันหยุดนักขัตฤกษ์',color:'var(--vz-2)'}];
  const dayV=x=>{const wd=x.wd!=null?x.wd:x.md;/* person = wd, team (teamUse) = md */return {wk:Math.max(0,wd-x.we),we:x.we,ot:x.ot}};
  h+=dzCard('span-8','ภาระงานรายคน',`คน-วันของแต่ละคน (งานครึ่งวัน = 0.5) แยกเป็นวันธรรมดา · เสาร์–อาทิตย์ · OT วันหยุดนักขัตฤกษ์ · % ท้ายแถว = คน-วัน ÷ วันทำงานของคนนั้น (ทุกวันรวมเสาร์–อาทิตย์ หักวันลา) · ชี้ที่แถวเพื่อดูตัวเลข`,
    ppl.length?`<div class="dz-scroll">${vzStackRows(ppl.slice().sort((a,b)=>(b.wd+b.ot)-(a.wd+a.ot)).map(p=>({label:p.s.name,sub:p.s.role||'',v:dayV(p),extra:`${pct(p.wd,p.cap)}%`})),DAYKEYS,{unit:'คน-วัน'})}</div>`:'<p class="hint">ยังไม่มีงานในช่วงนี้</p>',' style="--d:3"');
  /* positions, then the teams as charts too (user, 22 Oct 2026: "หัวข้อใช้กำลังคนตามตำแหน่ง ตรงแยกตามทีมให้โชว์ กราฟ หรือ Chart ด้วย") */
  const TU=D.teamUse||[];
  h+=dzCard('span-4','ใช้กำลังคนตามตำแหน่ง',`% = คน-วันของคนในตำแหน่ง ÷ (จำนวนคน × วันทำงาน ทุกวันรวมเสาร์–อาทิตย์ − วันลา) · 100% = ทุกคนมีงานทุกวัน`,vzRank(D.roleRows.map(r=>({label:r.k,n:r.util,extra:`${r.n} คน · ${f1(r.md)} คน-วัน`})),{unit:'%'})
    +(teamsUsed()?`<h3 class="dz-sub">แยกตามทีม · ใช้กำลังคน (%)</h3>${vzRank(TU.map(x=>({label:x.tm.name,n:x.util,color:x.tm.color,extra:`${x.n} คน`})),{unit:'%'})}
      <h3 class="dz-sub">แยกตามทีม · คน-วันตามชนิดวัน</h3>${vzStackRows(TU.map(x=>({label:x.tm.name,v:dayV(x),extra:`${x.util}%`})),DAYKEYS,{unit:'คน-วัน'})}
      <h3 class="dz-sub">แยกตามทีม · ตัวเลข</h3><table class="mini"><thead><tr><th>ทีม</th><th class="n">คน</th><th class="n">แผน</th><th class="n">ปิดงาน</th><th class="n">คน-วัน</th><th class="n">ใช้กำลังคน</th></tr></thead><tbody>${D.teamRows.map(r=>{const u=TU.find(x=>x.tm.id===r.tm.id)||{};return `<tr><td><span class="tdot" style="--c:${r.tm.color}"><i></i>${esc(r.tm.name)}</span></td><td class="n">${r.people}</td><td class="n">${r.n}</td><td class="n">${r.doneRate==null?'–':r.doneRate+'%'}</td><td class="n">${f1(u.md||0)}</td><td class="n">${u.util==null?'–':u.util+'%'}</td></tr>`}).join('')}</tbody></table>
      <p class="hint dz-note">คน All Team นับอยู่ในทั้งสองทีม · ปิดงาน = เสร็จแล้ว ÷ แผนที่ถึงกำหนด</p>`:''),' style="--d:4"');
  const maxJ=Math.max(1,...D.people.map(p=>p.jobs));const wdN=D.workDays.length;
  h+=`<details class="panel dz-card dz-det span-12" style="--d:5"><summary><h2>ตารางรายละเอียดรายคน</h2><span class="hint">${D.people.length} คน · กดเพื่อเปิด</span></summary>
    <div class="scroll-x plain" style="max-height:520px;overflow:auto"><table class="mini ptab"><thead><tr><th>#</th><th>ชื่อ</th><th>งาน (แผน)</th><th class="n">คน-วัน</th><th class="n">OT</th><th class="n">ใช้กำลังคน</th><th class="n">เช้า</th><th class="n">บ่าย</th><th class="n">ทั้งวัน</th><th class="n">ลา (วัน)</th><th class="n">ว่าง (วัน)</th><th class="n">จัดชน</th><th>งานที่ทำมากสุด</th></tr></thead><tbody>
    ${D.people.map((p,i)=>`<tr${p.jobs?'':' class="idle"'}><td class="n hint">${i+1}</td><td><b>${esc(p.s.name)}</b><span class="sub">${esc(p.s.role||'—')}</span></td>
      <td><span class="ibar"><i style="width:${p.jobs/maxJ*100}%"></i></span><b class="num">${p.jobs}</b></td><td class="n">${f1(p.wd)}</td><td class="n">${p.ot?f1(p.ot):'–'}</td><td class="n">${pct(p.wd,p.cap)}%</td><td class="n">${p.am||'–'}</td><td class="n">${p.pm||'–'}</td><td class="n">${p.full||'–'}</td>
      <td class="n">${p.leave.size||'–'}</td><td class="n${p.free===wdN?' free':''}">${p.free}</td><td class="n${p.conf?' bad':''}">${p.conf?'⚠ '+p.conf:'–'}</td><td>${esc(p.top||'—')}</td></tr>`).join('')||'<tr><td colspan="13" class="hint">ยังไม่มีรายชื่อพนักงาน</td></tr>'}
    </tbody></table></div></details>`;
  if(D.heat){const H=D.heat;const mx=Math.max(1,...H.rows.flatMap(g=>g.v));
    h+=`<details class="panel dz-card dz-det span-12" style="--d:6"><summary><h2>งานต่อคนราย${H.by}</h2><span class="hint">จำนวนแผนของแต่ละคน · กดเพื่อเปิด</span></summary><div class="scroll-x plain" style="max-height:480px;overflow:auto"><table class="mini heat"><thead><tr><th>ชื่อ</th>${H.cols.map(c=>`<th class="n">${esc(c.name)}</th>`).join('')}<th class="n">รวม</th></tr></thead><tbody>
      ${H.rows.map(g=>`<tr><td>${esc(g.p.s.name)}</td>${g.v.map(v=>`<td class="n${v?' h':''}" style="--h:${Math.round(v/mx*55)}">${v||'–'}</td>`).join('')}<td class="n"><b>${g.p.jobs}</b></td></tr>`).join('')}</tbody></table></div></details>`}
  return h;
}

/* งานและลูกค้า: rankings with the period before as a tick, time of day, customer × job type */
function dzJobs(D){
  const P=D.P,pb=D.prevBy;const pv=(m,k)=>pb?(m.get(k)||0):null;const pl=P.pLabel;
  const cust=D.custList.slice(0,10).map(([k,n])=>({label:k,n,prev:pv(pb&&pb.cust||new Map(),k)}));const restN=D.custList.slice(10).reduce((a,x)=>a+x[1],0);
  if(restN)cust.push({label:`ลูกค้าอื่น ${D.custList.length-10} ราย`,n:restN,color:'var(--vz-prev)'});
  const types=D.types.map(x=>({label:x.label,n:x.n,prev:pv(pb&&pb.type||new Map(),x.id||'__x')}));
  const sales=D.saleList.map(([k,n])=>({label:k,n,prev:pv(pb&&pb.sale||new Map(),k)}));
  const vehs=D.vehList.map(x=>({label:x.label,n:x.n,prev:pv(pb&&pb.veh||new Map(),x.k),extra:`${x.days} วัน`}));
  const o={unit:'แผน',prevLbl:pl};
  let h=dzCard('span-6','ลูกค้า',`${D.cust.size>10?'10 อันดับแรกจาก':'ทั้งหมด'} ${D.cust.size} ราย · ขีดดำ = ${esc(pl)} (ไม่มีขีด = ช่วงก่อนไม่มีงาน)`,vzRank(cust,o),' style="--d:1"');
  h+=dzCard('span-6','หัวข้องาน',`จำนวนแผนต่อหัวข้องาน · ขีดดำ = ${esc(pl)}`,vzRank(types,o),' style="--d:2"');
  h+=dzCard('span-6','Sale',`แผนที่ Sale แต่ละคนดูแล`,vzRank(sales,o),' style="--d:3"');
  h+=dzCard('span-6','การใช้รถแผนก',`จำนวนแผนต่อคัน (วัน = จำนวนวันที่ใช้)${D.noCar?` · ไม่ใช้รถ ${D.noCar} แผน`:''}`,vzRank(vehs,o),' style="--d:4"');
  const pc=[{name:'เช้า',n:D.jobs.filter(t=>periodOf(t)==='am').length,color:'var(--vz-1)'},{name:'บ่าย',n:D.jobs.filter(t=>periodOf(t)==='pm').length,color:'var(--vz-2)'},{name:'ทั้งวัน',n:D.jobs.filter(t=>periodOf(t)==='full').length,color:'var(--vz-3)'}];
  h+=dzCard('span-4','ช่วงเวลาของงาน',`ทีมเฉลี่ย ${f1(D.avgTeam)} คนต่องาน`,vzDonut(pc,{sub:'แผน',unit:'แผน',size:118,th:16,label:'ช่วงเวลาของงาน'}),' style="--d:5"');
  const tcols=D.types.filter(x=>x.n&&x.id);const crow=D.custList.slice(0,10);
  h+=dzCard('span-8','ลูกค้า × หัวข้องาน','จำนวนแผนของลูกค้า 10 รายแรกแยกตามหัวข้องาน',crow.length&&tcols.length?`<div class="scroll-x plain"><table class="mini dz-x"><thead><tr><th>ลูกค้า</th>${tcols.map(c=>`<th class="n">${esc(c.label)}</th>`).join('')}<th class="n">รวม</th></tr></thead><tbody>${crow.map(([k,n])=>`<tr><td>${esc(k)}</td>${tcols.map(c=>{const v=D.jobs.filter(t=>D.custKeyOf(t)===k&&typeIdOf(t)===c.id).length;return `<td class="n${v?' v':''}" style="--a:${Math.round(v/Math.max(1,n)*60)}%">${v||'–'}</td>`}).join('')}<td class="n"><b>${n}</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">ยังไม่มีข้อมูลในช่วงนี้</p>',' style="--d:6"');
  return h;
}

/* สอบเทียบ · Master Plan: Flow Meter results donut + breakdowns, Instrument, Master Plan vs Weekly Plan */
function dzCal(D){
  let h='';const toR=(l,n)=>l.slice(0,8).map(([k,v])=>({label:k,n:v,extra:pct(v,n)+'%'}));
  if(S.line!=='ins'){const C=D.cal;
    h+=dzCard('span-12',`${CAL_ICON} Flow Meter · Weekly plan calibration`,'เครื่องที่สอบเทียบในช่วงนี้จากแผนงาน (ไม่รวมแผนที่ยกเลิก) · PASS / FAIL ตามที่ Lab บันทึก',
      C.n?`<div class="dz-calrow">${vzDonut([{name:'PASS',n:C.pass,color:'var(--good)'},{name:'FAIL',n:C.fail,color:'var(--crit)'},{name:'รอผล (ADD)',n:C.pending,color:'var(--muted)'},{name:'Problem',n:C.problem,color:'var(--serious)'},{name:'เลื่อน',n:C.postponed,color:'var(--warn)'},{name:'ยกเลิก',n:C.cancelled,color:'var(--line)'}],{sub:'เครื่อง',unit:'เครื่อง',center:C.n,label:'ผลสอบเทียบ'})}
        <div class="dz-grid2"><div><h3 class="dz-sub">ตามชนิด (Type)</h3>${vzRank(toR(D.calTypes,C.n),{unit:'เครื่อง'})}</div><div><h3 class="dz-sub">ตามขนาด (Size)</h3>${vzRank(toR(D.calSizes,C.n),{unit:'เครื่อง'})}</div>
        <div><h3 class="dz-sub">ตาม Lab</h3>${vzRank(toR(D.calLabs,C.n),{unit:'เครื่อง'})}</div><div><h3 class="dz-sub">ตามลูกค้า</h3>${vzRank(toR(D.calCust,C.n),{unit:'เครื่อง'})}</div>
        <div><h3 class="dz-sub">ตาม Process Fluid</h3>${vzRank(toR(D.calFluids,C.n),{unit:'เครื่อง'})}</div><div><h3 class="dz-sub">ตาม Round</h3>${vzRank(toR(D.calRounds,C.n),{unit:'เครื่อง'})}</div></div></div>`
      :'<p class="hint">ยังไม่มีรายการสอบเทียบในช่วงนี้ · กรอกได้ที่หัวข้อ "Weekly plan calibration" ในแผนงาน Flow Meter</p>',' style="--d:1"')}
  if(S.line!=='fm'){const I=D.ins;
    h+=dzCard('span-12',`${INS_ICON} Instrument · Weekly plan instrument`,'รายการ Instrument ในช่วงนี้จากแผนงาน · Plan / Actual = จำนวนตามที่กรอก · Completed = Remark "Completed"',
      I.n?`<div class="dz-facts"><span><b>${I.n}</b>รายการ (Request)</span><span><b>${I.plan}</b>Plan รวม</span><span><b>${I.actual}</b>Actual รวม${D.insRate!=null?` · ${D.insRate}%`:''}</span><span><b>${I.done}</b>Completed · ${pct(I.done,I.n)}%</span><span><b>${I.certs}</b>Certificate</span></div>
        ${vzMeter(D.insRate||0,{cls:D.insRate!=null&&D.insRate<80?'warn':'good'})}
        <div class="dz-grid2"><div><h3 class="dz-sub">ตาม Type</h3>${vzRank(toR(D.insTypes,I.n),{unit:'รายการ'})}</div><div><h3 class="dz-sub">ตาม LAB</h3>${vzRank(toR(D.insLabs,I.n),{unit:'รายการ'})}</div>
        <div><h3 class="dz-sub">ตาม Plant</h3>${vzRank(toR(D.insPlants,I.n),{unit:'รายการ'})}</div><div><h3 class="dz-sub">ตามลูกค้า</h3>${vzRank(toR(D.insCust,I.n),{unit:'รายการ'})}</div></div>`
      :'<p class="hint">ยังไม่มีรายการ Instrument ในช่วงนี้ · กรอกได้ที่หัวข้อ "Weekly plan instrument" ในแผนงาน Instrument</p>',' style="--d:2"')}
  const num=n=>`<span data-n="${n}">${n}</span>`;
  const tile=(i,lbl,en,val,unit,foot,cls,bar)=>`<div class="tile${cls?' '+cls:''}" style="--d:${i}"><span class="lbl">${lbl}<em>${en}</em></span><span class="val">${val}<small>${unit}</small></span>${bar!=null?`<span class="tbar"><i style="width:${Math.min(100,bar)}%"></i></span>`:''}<span class="foot">${foot}</span></div>`;
  const sec=(n,th,en)=>`<h3 class="dsec dz-sec span-12">${th}<small>${en}</small></h3>`;
  h+=dashMpHtml(D,{tile,num,sec});
  return h;
}

/* ติดตามงาน: what needs doing, the clashes, the plans to follow, NCR */
function dzIssues(D){
  const F=D.follow;
  const box=(n,lbl,cls,tgt)=>`<button type="button" class="dz-iss${n?' '+cls:''}"${tgt?` data-action="jump-conf" data-target="${tgt}"`:''}><b>${n}</b><span>${lbl}</span></button>`;
  let h=`<div class="dz-isss span-12">${box(D.confN,'แผนที่จัดชน','bad','#dashConf')}${box(D.lateN,'เลยวันแล้วยังไม่ปิด','warn','#dashFollow')}${box(D.gaN,'รอ GA ระบุรถ','warn','#dashFollow')}${box(D.docN,'งานเสร็จ เอกสารไม่ครบ','warn','#dashFollow')}
    <button type="button" class="dz-iss${D.ncrOpen?' bad':''}" data-view="ncr"><b>${D.ncrIn.length}</b><span>NCR ในช่วงนี้${D.ncrOpen?` · ยังไม่ปิด ${D.ncrOpen}`:''} ›</span></button>
    ${D.od?`<button type="button" class="dz-iss${D.od.follow?' bad':''}" data-view="odoc"><b>${D.od.follow}</b><span>เอกสาร Onsite ตามต่อ (เลย Final) ›</span></button>`:''}</div>`;
  /* ติดตามเอกสาร Onsite (user, 22 Oct 2026) */
  if(D.od&&D.od.n){const O=D.od;
    h+=dzCard('span-12','ติดตามเอกสาร Onsite',`งานหน้างานในช่วงนี้ ${O.n} งาน · Final Date = วันทำงาน + ${odCfg().days} วันทำงาน (จ.–ศ.) · ส่งทันเวลา = ในเวลา ÷ งานที่ถึงกำหนดแล้ว`,
      `<div class="dz-calrow">${vzDonut([{name:'ในเวลา',n:O.ok,color:'var(--good)'},{name:'เกินเวลา',n:O.late,color:'var(--warn)'},{name:'รอเอกสาร',n:O.wait,color:'var(--vz-1)'},{name:'ตามต่อ',n:O.follow,color:'var(--crit)'}],{sub:'งาน',unit:'งาน',center:O.n,label:'สถานะเอกสาร Onsite'})}
      <div class="dz-facts"><span><b>${O.rate==null?'–':O.rate+'%'}</b>ส่งทันเวลา</span><span><b>${O.ok}</b>ในเวลา</span><span><b>${O.late}</b>เกินเวลา</span><span><b>${O.follow}</b>ตามต่อ</span><span><button type="button" class="lnk" data-view="odoc">เปิดหน้าติดตามเอกสาร ›</button></span></div></div>`,' style="--d:1"')}
  if(D.pairs.length){
    const overlapName=(a,b)=>{const am=pA(a)===0&&pA(b)===0,pm=pB(a)===1&&pB(b)===1;return am&&pm?'เช้า,บ่าย':am?'เช้า':'บ่าย'};
    const planCell=t=>`<button type="button" class="cplan" data-edit="${esc(t.id)}" style="--c:${planColor(t)}"><span class="tdot"><i></i><b>${esc(typeLabel(t))}</b></span>${t.planNo?`<span class="mono">${esc(t.planNo)}</span>`:''}<small>${esc([pName(t),t.customer,t.location].filter(Boolean).join(' · ')||'—')}</small><small>ทีม: ${esc(teamNames(t).join(', ')||'—')}${t.transport||t.needGA?` · รถ: ${esc(transportText(t))}`:''}</small></button>`;
    h+=`<section class="panel dz-card span-12" id="dashConf" style="--d:1"><header><h2>แผนงานที่จัดชน · ${D.pairs.length} คู่</h2><p>แต่ละแถวคือแผนงาน 2 แผนที่ใช้คนหรือรถคันเดียวกันในช่วงเวลาที่ทับกัน หรือจัดคนที่ลาไปทำงาน กดที่แผนงานเพื่อเปิดแก้ไข</p></header>
      <div class="scroll-x plain"><table class="mini ctab"><thead><tr><th>วันที่</th><th>ช่วงที่ทับกัน</th><th>แผนงาน</th><th>ชนกับแผนงาน</th><th>สาเหตุ</th></tr></thead><tbody>
      ${D.pairs.map(p=>{const who=p.staff.map(staffName);
        return `<tr><td class="num">${esc(fmtDay(p.a.date))}</td><td><span class="per">${esc(overlapName(p.a,p.b))}</span></td><td>${planCell(p.a)}</td><td>${planCell(p.b)}</td>
          <td class="why">${who.length?`<span class="cchip ${p.leave?'l':'p'}">${p.leave?'ติดลา':'คนชน'}: ${esc(who.join(', '))}</span>`:''}${p.veh?`<span class="cchip v">รถที่ใช้งานซ้ำกัน: ${esc(p.veh)}</span>`:''}
          <small>${p.leave?'เอาคนที่ลาออกจากแผนงาน หรือเปลี่ยนช่วงเวลา':p.veh&&!who.length?'เปลี่ยนรถ หรือเปลี่ยนช่วงเวลาของแผนใดแผนหนึ่ง':'เปลี่ยนคน หรือเปลี่ยนช่วงเวลาของแผนใดแผนหนึ่ง'}</small></td></tr>`}).join('')}
      </tbody></table></div></section>`}
  h+=`<section class="panel dz-card span-12" id="dashFollow" style="--d:2"><header><h2>งานที่ต้องติดตาม · ${F.length} แผน</h2><p>งานที่เลื่อนหรือยกเลิกพร้อมเหตุผล งานที่เลยวันแล้วยังไม่ปิด แผนที่ขอรถ GA แต่ยังไม่ได้รถ และงานเสร็จที่เอกสารหลังจบงานยังไม่ครบ · กดที่แถวเพื่อเปิดแผน</p></header>
    ${F.length?`<div class="scroll-x plain"><table class="mini ftab"><thead><tr><th>วันที่</th><th>งาน</th><th>ลูกค้า</th><th>สถานะ</th><th>เหตุผล / สิ่งที่ต้องทำ</th><th>ทีม</th></tr></thead><tbody>${F.map(t=>{const reason=NEEDS_REASON.has(t.status);const late=!reason&&isLate(t);
      const stat=reason?`<span class="fstat ${esc(t.status)}">${(STATUS[t.status]||{}).icon||''} ${esc(stTh(t.status))}${t.status==='notdone'&&t.cont?' · งานต่อเนื่อง':''}</span>${t.status==='notdone'&&t.cont&&t.contNext?`<span class="sub">ทำต่อ ${esc(fmtDay(t.contNext))}</span>`:''}`:late?'<span class="fstat late">⏱ เลยวันแล้ว</span>':gaWaiting(t)?'<span class="fstat ga">รอรถ GA</span>':'<span class="fstat doc">เอกสารไม่ครบ</span>';
      const why=reason?(t.statusNote?esc(t.statusNote):'<span class="hint">ยังไม่ได้ใส่เหตุผล</span>'):late?`<span class="hint">ยังเป็น "${esc(stTh(t.status))}" ควรอัปเดตสถานะ</span>${gaWaiting(t)?'<br><span class="hint">และยังรอ GA ระบุรถ</span>':''}`:gaWaiting(t)?'<span class="hint">ขอรถส่วนกลางแล้ว GA ยังไม่ได้ระบุรถและทะเบียน</span>':`ยังไม่ได้ส่ง <b>${esc(docMissing(t).map(k=>DOC_NAME[k]).join(', '))}</b> <span class="hint">· เปิดแผนแล้วแนบไฟล์</span>`;
      return `<tr data-edit="${esc(t.id)}"><td class="num">${esc(fmtDay(t.date))}</td><td><span class="tdot" style="--c:${planColor(t)}"><i></i>${esc(typeLabel(t))}</span>${t.planNo?`<span class="sub mono">${esc(t.planNo)}</span>`:''}</td><td>${esc(t.customer||'–')}</td>
        <td>${stat}</td><td class="why">${why}</td><td>${esc(teamNames(t).join(', ')||'–')}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="hint">ไม่มีงานที่ต้องติดตามในช่วงนี้ 🎉</p>'}</section>`;
  return h;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-dash-tab]');if(!b)return;S.dash.tab=b.dataset.dashTab;render();const t=document.querySelector('.dz-tabs');if(t&&t.getBoundingClientRect().top<0)t.scrollIntoView({block:'start'})});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.dz-kpi[data-dash-tab]')){e.preventDefault();e.target.click()}});
