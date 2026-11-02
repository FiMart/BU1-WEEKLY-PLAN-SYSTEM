'use strict';
/* BU1 Weekly Plan · the GA level's own layout.
   v4.34.0 (user, 30 Oct 2026: "ปรับหน้าตาของ website และ mobile ให้เหมาะสมกับ Role GA"): first page งานขอรถ GA, only GA's menus,
   car first in the plan view, car notices. Redone in v4.35.0 (user, 2 Nov 2026: "ปรับปรุง การแสดงผลของ Role GA ใหม่หมดจด"; chose a daily
   dispatch timeline · Weekly Plan for GA · a new plan view · phones · menus · LINE copy · daily dispatch sheet · car-use summary).
   isGA() = level ga. render() sets body.role-ga (css/ga-requests.css: only GA's menus, in GA's own order and groups, GA phone bar);
   render() / goView keep GA on GA_VIEWS (else → gareq).
   gareq (renderGareq) = จัดรถรายวัน: a week of day buttons (S.gq.date), filter chips S.gq.st, the day's requests as a timeline by the time
   out, "still waiting" days ahead, คัดลอกส่ง LINE (gqLineText) and พิมพ์ใบจ่ายรถ (gqPrintHtml, A4 landscape).
   gasum (renderGasum) = สรุปการใช้รถ: S.gs.per week / month / prev → tiles, ranks per plate / driver / pattern / destination, day table.
   GA's plan view = gqViewHtml. Weekly Plan for GA (js/views/plan.js wcard): time + full car chip, other plans faded, the GA filter on
   once per load (gqPfOnce), no Available panel. Notices: notify.js category gareq (gqSig). */
const GA_VIEWS=new Set(['gareq','gasum','plan','booking','search','help']);
const GA_ONLY=new Set(['gareq','gasum']);/* other levels never land on these */
const isGA=()=>S.level==='ga';
S.gq={date:'',st:''};S.gs={per:'month'};
const GQ_ST={wait:{th:'รอจัดรถ',c:'var(--warn)'},done:{th:'จัดรถแล้ว',c:'var(--good)'},cancel:{th:'ยกเลิกขอรถ',c:'var(--muted)'}};
/* the plans GA cares about */
const gqReq=t=>!!t&&!isLeave(t)&&(!!t.needGA||!!gaInfo(t)||!!t.gaCancel);
function gqState(t){
  if(t.status==='cancelled'||(!t.needGA&&t.gaCancel))return 'cancel';
  return gaInfo(t)||gaPlateOf(t)?'done':'wait';
}
const gqTime=t=>t.gaGo||'';
const gqKind=t=>t.selfDrive?'ขอรถไปเอง':`รถ GA${t.gaPattern&&GA_PATTERNS[t.gaPattern]?' · '+GA_PATTERNS[t.gaPattern]:''}`;
const gqTeam=t=>(t.staffIds||[]).map(staffName).concat(t.guests||[]);
const gqWhere=t=>[t.customer,t.location].filter(Boolean).join(' · ')||typeLabel(t);
const gqDay=()=>S.gq.date||ymd(new Date());
const gqChip=st=>`<span class="gq-st gq-${st}">${GQ_ST[st].th}</span>`;
const gqUrg=t=>t.gaUrgent&&gqState(t)!=='cancel'?'<span class="gq-urg">ด่วน</span>':'';
const gqTimeChip=t=>t.gaGo?`<span class="tchip gq-tc" title="${t.selfDrive?'เวลารับรถ':'เวลารถออก'}">🕘 ${esc(t.gaGo)}</span>`:'';
const gqDayName=k=>{const d=parseD(k);const td=ymd(new Date());const pre=k===td?'วันนี้ · ':k===ymd(addDays(new Date(),1))?'พรุ่งนี้ · ':'';return `${pre}${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)}`};
/* a phone number as a link that dials on phones */
const gqTel=(n,lbl)=>{const d=String(n||'').replace(/[^\d+]/g,'');return d.length>=6?`<a class="gq-tel" href="tel:${esc(d)}">☎ ${esc(lbl||n)}</a>`:esc(n||'')};
/* the car GA sent (data.gaCar, labelled by gaInfo) */
function gqCar(t){
  const l=gaInfo(t);const v=k=>l?((l.find(([x])=>x===k)||[])[1]||''):'';
  return {plate:v('ทะเบียน')||gaPlateOf(t)||'',name:v('รถ'),driver:v('พนักงานขับรถ'),phone:v('เบอร์โทร'),out:v('เวลาออก'),day:v('วันที่ใช้รถ'),any:!!l||!!gaPlateOf(t),rest:l?l.filter(([k])=>!['ทะเบียน','รถ','พนักงานขับรถ','เบอร์โทร','เวลาออก','วันที่ใช้รถ'].includes(k)):[]};
}
const gqMap=t=>{const q=[t.location,t.customer].filter(Boolean).join(' ');return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:''};
/* requests of a range (null while the range is loading) */
function gqList(from,to){const l=rangeTasks(from,to);return l?l.filter(t=>t.date>=from&&t.date<=to&&gqReq(t)):null}
/* one day's requests from the week the page reads (that range is already loaded) */
function gqDayList(day){const m=mondayOf(parseD(day));const l=gqList(ymd(m),ymd(addDays(m,6)));return l?l.filter(t=>t.date===day):null}
const GQ_RANK={wait:0,done:1,cancel:2};
const gqSort=(a,b)=>String(gqTime(a)||'99').localeCompare(String(gqTime(b)||'99'))||GQ_RANK[gqState(a)]-GQ_RANK[gqState(b)]||String(a.planNo||'').localeCompare(String(b.planNo||''));
const gqCount=l=>{const c={n:l.length,wait:0,done:0,cancel:0,urgent:0,self:0};l.forEach(t=>{const s=gqState(t);c[s]++;if(t.gaUrgent&&s==='wait')c.urgent++;if(t.selfDrive&&s!=='cancel')c.self++});return c};
const gqPass=t=>{const s=gqState(t);return !S.gq.st||(S.gq.st==='urgent'?s==='wait'&&t.gaUrgent:s===S.gq.st)};

/* ---------- จัดรถรายวัน ---------- */
function gqCarBar(t){
  const st=gqState(t);
  if(st==='cancel')return `<div class="gq-carbar cn"><b>${t.status==='cancelled'?'แผนงานถูกยกเลิก':'แผนกยกเลิกขอรถ'}</b>${t.gaCancel&&t.gaCancel.reason?`<span>${esc(t.gaCancel.reason)}</span>`:t.statusNote?`<span>${esc(t.statusNote)}</span>`:''}</div>`;
  if(st==='wait')return `<div class="gq-carbar wait"><b>ยังไม่ได้จัดรถ</b><a class="gq-go" href="${esc(GA_FLEET_URL)}" target="_blank" rel="noopener">จัดรถใน GA Fleet ↗</a></div>`;
  const c=gqCar(t);
  return `<div class="gq-carbar ok">${c.plate?`<span class="gq-plate">${esc(c.plate)}</span>`:''}${c.name?`<span>${esc(c.name)}</span>`:''}${c.driver?`<span>คนขับ <b>${esc(c.driver)}</b></span>`:''}${c.phone?gqTel(c.phone):''}${c.out?`<span>ออก ${esc(c.out)}</span>`:''}${!c.plate&&!c.driver?`<span>${esc(gaSummary(t))}</span>`:''}</div>`;
}
function gqRow(t){
  const st=gqState(t);const team=gqTeam(t);
  return `<li class="gq-row gq-c-${st}${t.gaUrgent&&st==='wait'?' urgent':''}">
    <div class="gq-when"><b>${esc(gqTime(t)||'—')}</b><small>${gqTime(t)?(t.selfDrive?'รับรถ':'รถออก'):'ไม่ระบุเวลา'}</small></div>
    <div class="gq-body">
      <button type="button" class="gq-card" data-edit="${esc(t.id)}">
        <span class="gq-top">${gqChip(st)}${gqUrg(t)}<span class="gq-kind">${esc(gqKind(t))}</span></span>
        <b class="gq-where">${esc(gqWhere(t))}</b>
        <span class="gq-meta">${esc([t.planNo,typeLabel(t),[pName(t),t.timeNote].filter(Boolean).join(' ')].filter(Boolean).join(' · '))}</span>
        ${team.length?`<span class="gq-team"><i>👷 ${team.length} คน</i>${team.slice(0,6).map(n=>`<span>${esc(n)}</span>`).join('')}${team.length>6?`<span>+${team.length-6}</span>`:''}</span>`:''}
        ${t.gaCargo?`<span class="gq-line">📦 ${esc(cargoText(t.gaCargo))}</span>`:''}
        ${t.selfDrive&&ownCarText(t)?`<span class="gq-line">📝 ${esc(ownCarText(t))}</span>`:''}
        ${t.gaNote?`<span class="gq-line gq-note">💬 ${esc(t.gaNote)}</span>`:''}
      </button>
      ${gqCarBar(t)}
    </div></li>`;
}
function renderGareq(){
  if(notReady())return loading();
  const day=gqDay();const mon=mondayOf(parseD(day));const td=ymd(new Date());
  const wk=gqList(ymd(mon),ymd(addDays(mon,6)));
  const pills=Array.from({length:7},(_,i)=>{const d=addDays(mon,i);const k=ymd(d);const l=wk?wk.filter(t=>t.date===k&&gqState(t)!=='cancel'):[];const w=l.filter(t=>gqState(t)==='wait').length;
    return `<button type="button" class="gq-dp${k===day?' on':''}${k===td?' today':''}${isOffDay(d)||holidayOf(k)?' off':''}" data-gq-day="${k}" aria-pressed="${k===day}" title="${esc(gqDayName(k))}${l.length?` · ขอรถ ${l.length}`:''}${w?` · รอจัดรถ ${w}`:''}">
      <small>${TH_DAY[d.getDay()]}</small><b>${d.getDate()}</b><span class="gq-dpn">${!wk?'':l.length?l.length+' คำขอ':'–'}</span>${w?`<i class="gq-dpw">${w}</i>`:''}</button>`}).join('');
  const nav=`<div class="gq-nav"><button type="button" class="icon-btn" data-gq-shift="-7" aria-label="สัปดาห์ก่อน">‹</button><div class="gq-days" role="group" aria-label="เลือกวัน">${pills}</div><button type="button" class="icon-btn" data-gq-shift="7" aria-label="สัปดาห์ถัดไป">›</button></div>`;
  const top=`<div class="gq-head"><div class="gq-mon"><b>${TH_MON_FULL[mon.getMonth()]} ${be(mon)}</b>${day!==td?`<button type="button" class="btn sm" data-gq-day="${td}">วันนี้</button>`:''}</div>${nav}</div>`;
  if(!wk)return `<div class="gq-page">${top}${loading()}</div>`;
  /* days ahead (today … +6) that still wait for a car */
  const ah=gqList(td,ymd(addDays(new Date(),6)));const aw={};(ah||[]).forEach(t=>{if(gqState(t)==='wait')aw[t.date]=(aw[t.date]||0)+1});
  const ahead=Object.keys(aw).sort();
  const apLbl=k=>k===td?'วันนี้':k===ymd(addDays(new Date(),1))?'พรุ่งนี้':`${TH_DAY[parseD(k).getDay()]} ${fmtShort(parseD(k))}`;
  const aheadH=`<div class="gq-ahead${ahead.length?'':' none'}"><b>ยังรอจัดรถ</b>${ahead.length?ahead.map(k=>`<button type="button" class="gq-ap${k===day?' on':''}" data-gq-day="${k}">${esc(apLbl(k))} <i>${aw[k]}</i></button>`).join(''):'<span class="gq-ok">7 วันข้างหน้าจัดรถครบแล้ว</span>'}</div>`;
  const all=wk.filter(t=>t.date===day);const c=gqCount(all);
  const fc=(k,n,l)=>`<button type="button" class="gq-fc gq-fc-${k||'all'}${S.gq.st===k?' on':''}" data-gq-st="${k}" aria-pressed="${S.gq.st===k}"><b>${n}</b>${l}</button>`;
  const chips=`<div class="gq-fcs">${fc('',c.n,'ทั้งหมด')}${fc('wait',c.wait,'รอจัดรถ')}${c.urgent?fc('urgent',c.urgent,'ด่วน'):''}${fc('done',c.done,'จัดแล้ว')}${c.cancel?fc('cancel',c.cancel,'ยกเลิก'):''}</div>`;
  const acts=`<div class="gq-acts"><button type="button" class="btn sm" data-gq-line${c.n?'':' disabled'}>คัดลอกส่ง LINE</button><button type="button" class="btn sm" data-gq-print${c.n?'':' disabled'}>พิมพ์ใบจ่ายรถ</button><a class="btn primary sm" href="${esc(GA_FLEET_URL)}" target="_blank" rel="noopener">เปิด GA Fleet ↗</a></div>`;
  /* wide screens: the cars already given that day, in the side panel */
  const given=all.filter(t=>gqState(t)==='done').sort(gqSort);
  const cars=`<div class="gq-cars"><b>รถที่จัดแล้ว (${given.length})</b>${given.length?`<ul>${given.map(t=>{const x=gqCar(t);return `<li><button type="button" data-edit="${esc(t.id)}"><span class="gq-plate">${esc(x.plate||'รถ GA')}</span><span><b>${esc(gqTime(t)||'—')}</b> ${esc(gqWhere(t))}${x.driver?`<small>คนขับ ${esc(x.driver)}</small>`:''}</span></button></li>`}).join('')}</ul>`:'<span class="hint">ยังไม่มี</span>'}</div>`;
  const hol=holidayOf(day);
  const title=`<h2 class="gq-dt">${esc(gqDayName(day))}${hol?` <span class="gq-hol">${esc(hol)}</span>`:''}</h2>`;
  const show=all.filter(gqPass).sort(gqSort);
  const body=show.length?`<ol class="gq-tl">${show.map(gqRow).join('')}</ol>`:`<div class="gq-empty"><b>${all.length?'ไม่มีคำขอในสถานะนี้':'วันนี้ไม่มีคำขอรถ GA'}</b><span>${all.length?'กดตัวกรองอีกครั้งเพื่อดูทั้งหมด':'เลือกวันอื่นจากแถบด้านบน'}</span></div>`;
  /* one column on phones / tablets (side panel = the waiting days + buttons above the list); from 1280 px the side panel
     stands on the right and stays in view (css/ga-requests.css) */
  return `<div class="gq-page">${top}<div class="gq-cols"><section class="gq-sheet">${title}${chips}${body}</section><aside class="gq-side">${aheadH}${acts}${cars}</aside></div></div>`;
}

/* ---------- คัดลอกส่ง LINE ---------- */
function gqReqLines(t,i){
  const st=gqState(t);const team=gqTeam(t);const c=gqCar(t);
  const out=[`${i!=null?i+'. ':''}${gqTime(t)?`🕘 ${gqTime(t)} ${t.selfDrive?'รับรถ':'รถออก'}`:'🕘 ไม่ระบุเวลา'} · ${st==='wait'?'⏳ รอจัดรถ':st==='done'?'✅ จัดรถแล้ว':'❌ ยกเลิกขอรถ'}${t.gaUrgent&&st!=='cancel'?' · 🔴 ด่วน':''}`,
    `🏭 ${gqWhere(t)}`,`🔁 ${gqKind(t)}`];
  if(t.planNo)out.push(`📄 ${t.planNo}${pName(t)?' · '+pName(t):''}`);
  if(team.length)out.push(`👷 ${team.length} คน: ${team.join(', ')}`);
  if(t.gaCargo)out.push(`📦 ${cargoText(t.gaCargo)}`);
  if(t.selfDrive&&ownCarText(t))out.push(`📝 ${ownCarText(t)}`);
  if(t.gaNote)out.push(`💬 ${t.gaNote}`);
  if(t.contact||t.contactTel)out.push(`📞 หน้างาน ${[t.contact,t.contactTel].filter(Boolean).join(' ')}`);
  if(st==='done')out.push(`🚘 ${[c.plate,c.name,c.driver?'คนขับ '+c.driver:'',c.phone,c.out?'ออก '+c.out:''].filter(Boolean).join(' · ')||gaSummary(t)}`);
  if(st==='cancel'&&t.gaCancel&&t.gaCancel.reason)out.push(`เหตุผล: ${t.gaCancel.reason}`);
  return out;
}
function gqLineText(day,list){
  const live=list.filter(t=>gqState(t)!=='cancel').sort(gqSort);const cn=list.filter(t=>gqState(t)==='cancel');const c=gqCount(list);
  const out=[`🚗 รถ GA · BU1 · ${gqDayName(day).replace(/^(วันนี้|พรุ่งนี้) · /,'')}`,`ขอรถ ${c.n-c.cancel} · รอจัดรถ ${c.wait} · จัดแล้ว ${c.done}${c.cancel?` · ยกเลิก ${c.cancel}`:''}`];
  live.forEach((t,i)=>{out.push('',...gqReqLines(t,i+1))});
  if(cn.length)out.push('','❌ ยกเลิกขอรถ:',...cn.map(t=>`- ${[gqTime(t),gqWhere(t),t.planNo].filter(Boolean).join(' · ')}${t.gaCancel&&t.gaCancel.reason?' ('+t.gaCancel.reason+')':''}`));
  return out.join('\n');
}

/* ---------- พิมพ์ใบจ่ายรถ (A4 landscape, opens a print window; downloaded when the browser blocks it) ---------- */
function gqPrintHtml(day,list){
  const rows=list.filter(t=>gqState(t)!=='cancel').sort(gqSort);const cn=list.filter(t=>gqState(t)==='cancel');const c=gqCount(list);
  const tr=(t,i)=>{const car=gqCar(t);const team=gqTeam(t);const st=gqState(t);
    return `<tr><td class="c">${i+1}</td><td class="c"><b class="tm">${esc(gqTime(t)||'—')}</b><br><small>${t.selfDrive?'รับรถ':'รถออก'}</small></td>
      <td>${st==='wait'?'<span class="w">รอจัดรถ</span>':'จัดแล้ว'}${t.gaUrgent?'<br><span class="u">ด่วน</span>':''}</td>
      <td><b>${esc(gqWhere(t))}</b><br><small>${esc([t.planNo,typeLabel(t),pName(t)].filter(Boolean).join(' · '))}</small>${t.contact||t.contactTel?`<br><small>หน้างาน ${esc([t.contact,t.contactTel].filter(Boolean).join(' '))}</small>`:''}</td>
      <td>${esc(gqKind(t))}</td><td>${team.length} คน<br><small>${esc(team.join(', '))}</small></td>
      <td>${esc([t.gaCargo?'ของ: '+cargoText(t.gaCargo):'',t.selfDrive?ownCarText(t):'',t.gaNote].filter(Boolean).join(' · '))}</td>
      <td><b>${esc(car.plate)}</b>${car.name?`<br><small>${esc(car.name)}</small>`:''}</td><td>${esc(car.driver)}${car.phone?`<br><small>${esc(car.phone)}</small>`:''}</td>
      <td class="sg"></td><td class="sg"></td></tr>`};
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบจ่ายรถ GA · BU1 · ${esc(day)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap">
<style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:10.5px/1.4 "IBM Plex Sans Thai",Tahoma,sans-serif;color:#0b1b33;margin:14px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:8px 12px;background:#eef3fa;border-radius:8px}.bar .go{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2px solid #1462d0;padding-bottom:6px;margin-bottom:8px}.hd h1{font-size:17px;margin:0}.hd p{margin:2px 0 0;color:#34496b}.hd .r{text-align:right}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #9fb1c9;padding:4px 5px;vertical-align:top;text-align:left}th{background:#e6eef9;font-weight:700;font-size:10px}td.c{text-align:center}small{color:#4a5d7a}
.tm{font-size:13px}.w{color:#9a5b00;font-weight:700}.u{color:#c62828;font-weight:700}td.sg{width:76px}tr{page-break-inside:avoid}
h2{font-size:12px;margin:12px 0 4px}.ft{margin-top:14px;display:flex;justify-content:space-between;gap:20px}.ft div{flex:1;border-top:1px solid #9fb1c9;padding-top:4px;text-align:center;color:#34496b}</style></head><body>
<div class="bar">${printBackHtml()}<button type="button" class="go" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>ใบจ่ายรถ GA ${esc(gqDayName(day))}</span></div>
<div class="hd"><div style="display:flex;gap:12px;align-items:flex-end">${orgLogo(38)}<div><h1>ใบจ่ายรถ GA · BU1 Lab</h1><p>${esc(gqDayName(day).replace(/^(วันนี้|พรุ่งนี้) · /,''))} · ขอรถ ${c.n-c.cancel} · รอจัดรถ ${c.wait} · จัดแล้ว ${c.done}${c.cancel?` · ยกเลิก ${c.cancel}`:''}</p></div></div>
<div class="r"><p>${esc(ORG_NAME)}</p><p>พิมพ์โดย ${esc((S.account&&S.account.name)||S.me||'')} · ${esc(jbWhen(new Date().toISOString()))}</p></div></div>
<table><thead><tr><th>#</th><th>เวลา</th><th>สถานะ</th><th>ปลายทาง / งาน</th><th>รูปแบบ</th><th>ทีม</th><th>ของ / หมายเหตุ</th><th>ทะเบียน</th><th>คนขับ</th><th>ลงชื่อรับรถ</th><th>คืนรถ (เวลา / ลงชื่อ)</th></tr></thead>
<tbody>${rows.map(tr).join('')||'<tr><td colspan="11" class="c">ไม่มีคำขอรถ</td></tr>'}</tbody></table>
${cn.length?`<h2>ยกเลิกขอรถ (${cn.length})</h2><table><tbody>${cn.map(t=>`<tr><td>${esc(gqTime(t)||'—')}</td><td>${esc(gqWhere(t))}</td><td>${esc(t.planNo||'')}</td><td>${esc(t.gaCancel&&t.gaCancel.reason||(t.status==='cancelled'?'ยกเลิกแผนงาน':'แผนกยกเลิกขอรถ'))}</td></tr>`).join('')}</tbody></table>`:''}
<div class="ft"><div>ผู้จัดรถ (GA)</div><div>ผู้ตรวจสอบ</div></div>
<script>document.fonts&&document.fonts.ready.then(function(){setTimeout(function(){try{window.print()}catch(e){}},300)})</script></body></html>`;
}
function gqPrint(){const day=gqDay();const l=gqDayList(day);if(!l||!l.length)return toast('ไม่มีคำขอรถในวันนี้');csOpenPrint(gqPrintHtml(day,l),`ใบจ่ายรถGA_${day}.html`)}

/* ---------- สรุปการใช้รถ ---------- */
function gsRange(){
  const td=new Date();const m0=firstOfMonth(td);
  if(S.gs.per==='week'){const m=mondayOf(td);return [ymd(m),ymd(addDays(m,6)),`สัปดาห์นี้ · ${fmtShort(m)} – ${fmtShort(addDays(m,6))} ${be(m)}`]}
  if(S.gs.per==='prev'){const p=new Date(m0.getFullYear(),m0.getMonth()-1,1);const e=new Date(m0.getFullYear(),m0.getMonth(),0);return [ymd(p),ymd(e),`เดือนก่อน · ${TH_MON_FULL[p.getMonth()]} ${be(p)}`]}
  const e=new Date(m0.getFullYear(),m0.getMonth()+1,0);return [ymd(m0),ymd(e),`เดือนนี้ · ${TH_MON_FULL[m0.getMonth()]} ${be(m0)}`];
}
/* days between asking and the work day (the request's own date in local time) */
const gsLead=t=>{if(!t.gaRequestedAt)return null;const a=new Date(t.gaRequestedAt);if(isNaN(a))return null;return Math.round((parseD(t.date)-parseD(ymd(a)))/864e5)};
function gsRank(list,key,max){
  const m=new Map();list.forEach(t=>{const k=key(t);if(!k)return;const o=m.get(k)||{label:k,n:0,days:new Set()};o.n++;o.days.add(t.date);m.set(k,o)});
  return [...m.values()].sort((a,b)=>b.n-a.n||a.label.localeCompare(b.label)).slice(0,max||8).map(o=>({label:o.label,n:o.n,extra:`${o.days.size} วัน`}));
}
function renderGasum(){
  if(notReady())return loading();
  const [from,to,lbl]=gsRange();
  const tabs=`<div class="seg gq-tabs" role="tablist" aria-label="ช่วงเวลา">${[['week','สัปดาห์นี้'],['month','เดือนนี้'],['prev','เดือนก่อน']].map(([k,l])=>`<label><input type="radio" name="gs-per" value="${k}"${S.gs.per===k?' checked':''}><span>${l}</span></label>`).join('')}</div>`;
  const head=`<div class="gq-bar">${tabs}<span class="gs-lbl">${esc(lbl)}</span></div>`;
  const all=gqList(from,to);if(!all)return `<div class="gq-page">${head}${loading()}</div>`;
  const c=gqCount(all);const live=all.filter(t=>gqState(t)!=='cancel');const done=all.filter(t=>gqState(t)==='done');
  const td=ymd(new Date());const missed=all.filter(t=>gqState(t)==='wait'&&t.date<td).length;
  const short=live.filter(t=>{const d=gsLead(t);return d!=null&&d<=1}).length;
  const pct=live.length?Math.round(done.length/live.length*100):0;
  const tile=(k,n,l,sub)=>`<div class="gq-k gq-k-${k}"><b>${n}</b><span>${l}</span><small>${sub}</small></div>`;
  let h=head+`<div class="gq-ks gs-ks">${tile('',live.length,'ขอรถ',`${new Set(live.map(t=>t.date)).size} วันที่มีคำขอ`)}${tile('done',done.length,'จัดรถแล้ว',`${pct}% ของคำขอ`)}${tile('wait',c.wait,'ยังไม่จัด',missed?`เลยวันแล้ว ${missed}`:'ยังไม่ถึงวัน')}${tile('urgent',live.filter(t=>t.gaUrgent).length,'ด่วน',`ขอล่วงหน้า ≤ 1 วัน ${short}`)}${tile('cancel',c.cancel,'ยกเลิกขอรถ',`ขอรถไปเอง ${c.self}`)}</div>`;
  if(!all.length)return `<div class="gq-page">${h}<div class="gq-empty"><b>ไม่มีคำขอรถ GA ในช่วงนี้</b><span>${esc(lbl)}</span></div></div>`;
  const card=(t,body)=>`<section class="gs-card"><h3>${t}</h3>${body}</section>`;
  const car=t=>{const x=gqCar(t);return x.plate?x.plate+(x.name?' · '+x.name:''):''};
  h+=`<div class="gs-grid">${card('ทะเบียนรถที่จัด',vzRank(gsRank(done,car),{unit:'เที่ยว'}))}${card('คนขับ',vzRank(gsRank(done,t=>gqCar(t).driver),{unit:'เที่ยว'}))}
    ${card('รูปแบบที่ขอ',vzRank(gsRank(live,t=>gqKind(t).replace(/^รถ GA · /,'')),{unit:'คำขอ'}))}${card('ปลายทาง',vzRank(gsRank(live,t=>t.customer||t.location||''),{unit:'คำขอ'}))}</div>`;
  /* by day: click = open that day in จัดรถรายวัน */
  const days=[...new Set(all.map(t=>t.date))].sort();
  h+=card('รายวัน',`<div class="scroll-x"><table class="list gs-days"><thead><tr><th>วัน</th><th>ขอรถ</th><th>จัดแล้ว</th><th>รอจัด</th><th>ด่วน</th><th>ยกเลิก</th><th>รถที่ใช้</th></tr></thead><tbody>${days.map(k=>{const l=all.filter(t=>t.date===k);const x=gqCount(l);const plates=[...new Set(l.filter(t=>gqState(t)==='done').map(t=>gqCar(t).plate).filter(Boolean))];
    return `<tr data-gq-go="${k}" tabindex="0" title="เปิดวันนี้ในจัดรถรายวัน"><td><b>${esc(fmtDayY(k))}</b></td><td>${x.n-x.cancel}</td><td>${x.done}</td><td class="${x.wait?'w':''}">${x.wait}</td><td>${x.urgent||''}</td><td>${x.cancel||''}</td><td>${esc(plates.join(', '))}</td></tr>`}).join('')}</tbody></table></div>`);
  return `<div class="gq-page">${h}</div>`;
}

/* ---------- GA's plan view: the request first, then what GA needs to arrange the trip ---------- */
function gqViewHtml(t){
  const st=gqReq(t)?gqState(t):'';const d=parseD(t.date);const team=gqTeam(t);const tel=saleTel(t.sale);const map=gqMap(t);
  const f=(k,v)=>v?`<div><dt>${k}</dt><dd>${v}</dd></div>`:'';
  const sec=(title,body)=>body?`<section class="gv-sec"><h4>${title}</h4>${body}</section>`:'';
  const c=gqCar(t);
  const hero=st?`<div class="gv-hero gq-c-${st}">
      <div class="gv-hl">${gqChip(st)}${gqUrg(t)}<span class="gq-kind">${esc(gqKind(t))}</span></div>
      <div class="gv-time"><b>${esc(gqTime(t)||'—')}</b><span>${t.selfDrive?'เวลารับรถ':'เวลารถออก'}<br>${esc(TH_DAY_FULL[d.getDay()])} ${esc(fmtShort(d))} ${be(d)}</span></div>
      <div class="gv-acts">${st==='wait'?`<a class="btn primary sm" href="${esc(GA_FLEET_URL)}" target="_blank" rel="noopener">จัดรถใน GA Fleet ↗</a>`:`<a class="btn sm" href="${esc(GA_FLEET_URL)}" target="_blank" rel="noopener">GA Fleet ↗</a>`}
        <button type="button" class="btn sm" data-gq-copy1="${esc(t.id)}">คัดลอกส่ง LINE</button>${map?`<a class="btn sm" href="${esc(map)}" target="_blank" rel="noopener">แผนที่ ↗</a>`:''}</div></div>`
    :'<div class="gv-hero none"><b>แผนนี้ไม่ได้ขอรถ GA</b><span>ดูข้อมูลแผนได้ด้านล่าง</span></div>';
  const carBox=st==='done'?`<section class="gv-car"><h4>รถที่จัดแล้ว</h4><div class="gv-cl">${c.plate?`<span class="gq-plate lg">${esc(c.plate)}</span>`:''}<div>${c.name?`<b>${esc(c.name)}</b>`:''}${c.driver?`<span>คนขับ ${esc(c.driver)}</span>`:''}${c.phone?gqTel(c.phone):''}</div></div>
      <dl class="gq-dl">${f('เวลาออก',esc(c.out))}${f('วันที่ใช้รถ',c.day?esc(c.day):'')}${c.rest.map(([k,v])=>f(esc(k),esc(v))).join('')}</dl></section>`
    :st==='wait'?`<section class="gv-car wait"><h4>ยังไม่ได้จัดรถ</h4><p>จัดรถในแอป GA Fleet แล้วทะเบียน คนขับ และเวลาออกจะขึ้นที่แผนนี้เอง</p></section>`
    :st==='cancel'?`<section class="gv-car cn"><h4>${t.status==='cancelled'?'แผนงานถูกยกเลิก':'แผนกยกเลิกขอรถ'}</h4>${t.gaCancel&&t.gaCancel.reason||t.statusNote?`<p>${esc(t.gaCancel&&t.gaCancel.reason||t.statusNote)}</p>`:''}</section>`:'';
  const trip=`<dl class="gq-dl">${f('ปลายทาง',`${esc(gqWhere(t))}${map?` · <a href="${esc(map)}" target="_blank" rel="noopener">ดูแผนที่</a>`:''}`)}
      ${f('รูปแบบ',esc(t.selfDrive?'ขอรถไปเอง (ขับเอง)':GA_PATTERNS[t.gaPattern]||'—'))}${t.selfDrive?f('เหตุผล',esc(ownCarText(t))):''}
      ${f('ช่วงเวลางาน',esc([pName(t),t.timeNote].filter(Boolean).join(' · ')))}${f('ของต้องขน',t.gaCargo?esc(cargoText(t.gaCargo)):'')}
      ${t.gaRequestedAt?f('ขอรถเมื่อ',esc(jbWhen(t.gaRequestedAt))):''}</dl>${t.gaNote?`<p class="gv-note">💬 ${esc(t.gaNote)}</p>`:''}`;
  const teamH=team.length?`<div class="gv-team">${team.map((n,i)=>`<span${i===0?' class="lead" title="หัวหน้าทีม"':''}>${esc(n)}</span>`).join('')}</div>`:'<p class="hint">ยังไม่จัดคน</p>';
  const contact=`<dl class="gq-dl">${f('ผู้ติดต่อหน้างาน',[esc(t.contact||''),t.contactTel?gqTel(t.contactTel):''].filter(Boolean).join(' '))}${f('Sale',[esc(t.sale||''),tel?gqTel(tel):''].filter(Boolean).join(' '))}</dl>`;
  const job=`<dl class="gq-dl">${f('งาน',esc([t.planNo,typeLabel(t)].filter(Boolean).join(' · ')))}${f('รายละเอียด',esc(headline(t)||''))}</dl>`;
  return `<div class="gq-view">${hero}${carBox}${sec('การเดินทาง',trip)}${sec(`ทีมที่ไปด้วย (${team.length} คน)`,teamH)}${sec('ติดต่อ',contact.includes('<dt>')?contact:'')}${sec('งาน',job)}${remarkBox(t)}</div>`;
}
/* the badge: requests still waiting for a car today and tomorrow */
function gqBadge(){
  const n=isGA()&&typeof ntfTasks==='function'?ntfTasks().filter(t=>gqReq(t)&&gqState(t)==='wait'&&(t.date===ymd(new Date())||t.date===ymd(addDays(new Date(),1)))).length:0;
  ['#gaBadge','#gaBadgeM'].forEach(s=>{const b=$(s);if(b){b.hidden=!n;b.textContent=n}});
}
/* Weekly Plan for GA: show only plans with a GA request the first time (the GA filter button switches it off) */
let gqPfSet=false;
function gqPfOnce(){if(!gqPfSet&&isGA()){gqPfSet=true;S.pf.ga=true;S.line='';S.team=''}}/* GA has no สายงาน / ทีม tabs: never stuck on one */
/* notices for GA (js/features/notify.js): the request's own signature, so a change of time / place / cargo shows */
const gqSig=t=>t&&!isLeave(t)&&t.needGA&&t.status!=='cancelled'?JSON.stringify([t.date,t.period||'',t.gaGo||'',t.gaPattern||'',!!t.gaUrgent,t.gaCargo||null,t.gaNote||'',!!t.selfDrive,t.location||'']):'';
document.addEventListener('change',e=>{if(e.target.name==='gs-per'){S.gs.per=e.target.value;S.anim='view';render()}});
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target;if(!t)return;
  const k=t.closest('[data-gq-st]');if(k){const v=k.dataset.gqSt;S.gq.st=S.gq.st===v?'':v;render();return}
  const dy=t.closest('[data-gq-day]');if(dy){S.gq.date=dy.dataset.gqDay;S.anim=null;render();return}
  const sh=t.closest('[data-gq-shift]');if(sh){S.gq.date=ymd(addDays(parseD(gqDay()),+sh.dataset.gqShift));S.anim=null;render();return}
  const go=t.closest('[data-gq-go]');if(go){S.gq.date=go.dataset.gqGo;S.gq.st='';goView('gareq');window.scrollTo(0,0);return}
  if(t.closest('[data-gq-line]')){const day=gqDay();const l=gqDayList(day);if(l&&l.length)copyText(gqLineText(day,l),'คัดลอกรายการรถแล้ว วางใน LINE ได้เลย');return}
  if(t.closest('[data-gq-print]')){gqPrint();return}
  const c1=t.closest('[data-gq-copy1]');if(c1){const p=editing&&editing.id===c1.dataset.gqCopy1?editing:S.tasks.find(x=>x.id===c1.dataset.gqCopy1);if(p)copyText([`🚗 คำขอรถ GA · BU1 · ${gqDayName(p.date).replace(/^(วันนี้|พรุ่งนี้) · /,'')}`,...gqReqLines(p)].join('\n'),'คัดลอกคำขอรถแล้ว');return}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'){const r=e.target.closest&&e.target.closest('tr[data-gq-go]');if(r)r.click()}});
