'use strict';
/* BU1 Weekly Plan · ISO 9001 records (user, 8 Oct 2026: "แก้ไขระบบให้รองรับกับ ISO 9001 Record")
   Three parts the user chose (ISO 9001:2015 §7.5 documented information):
   1) ประวัติการแก้ไข (audit trail): every save of a plan (tasks) or an NCR adds an entry to the record's own `history`
      [{at, by, a:'create'|'edit', ch:[[field, from, to], …]}] (last ISO_HISTORY_MAX kept; values stored as display text) —
      written in Store.set / Store.update (js/data/store.js → isoStamp). A deleted plan / NCR leaves a row in entity "audit"
      {at, by, coll, recId, a:'delete', label, snap, history} (central DB: app_settings "bu1wp_audit:<id>") before it goes.
   2) เลขที่เอกสาร / Rev. on every report: S.cfg.iso[<record>] = {code, rev, eff, keep, owner} (edited in ข้อมูลหลัก ›
      ISO 9001 · Record); prints get a document-control line under the title and "หน้า x / y" + the code in the page footer,
      Excel files a document-control row under the title (isoHeadHtml / isoPageCss / isoLine).
   3) ทะเบียน Record + ระยะเวลาจัดเก็บ: the register (record, code, Rev., effective date, retention, owner, where kept),
      recent deletions, and "ส่งออกเก็บถาวร" = one Excel workbook of a month / year (plans, documents, NCR, history, deletions). */
const ISO_HISTORY_MAX=80;
const ISO_RECS=[
  {k:'plan',name:'แผนงานรายสัปดาห์ (Weekly Plan)',where:'Weekly Plan · Print / PDF · Excel',keep:3},
  {k:'docs',name:'เอกสารหลังจบงาน (Service Report · QC · ใบรับงาน)',where:'แนบในแผนงาน · หน้ารายละเอียดแผน',keep:5},
  {k:'ncr',name:'NCR · รายงานงานที่ไม่สำเร็จ',where:'หน้า NCR · พิมพ์ใบ NCR',keep:5},
  {k:'mpfm',name:'Master Plan · Flow Meter',where:'Master Plan · PDF · Excel',keep:3},
  {k:'mpins',name:'Master Plan · Instrument',where:'Master Plan · PDF · Excel',keep:3},
  {k:'dash',name:'รายงานผลการปฏิบัติงาน (Dashboard)',where:'Dashboard · พิมพ์รายงาน · Excel',keep:3},
  {k:'audit',name:'ประวัติการแก้ไข / การลบ Record (Audit trail)',where:'หน้ารายละเอียดแผน / NCR · ทะเบียน Record',keep:5},
];
const ISO_STORE='BU1 Weekly Plan · ฐานข้อมูลกลาง (Supabase)';
function isoDoc(k){const r=ISO_RECS.find(x=>x.k===k)||{k,name:k,keep:3};const c=((S.cfg||{}).iso||{})[k]||{};
  return {k,name:r.name,where:r.where,code:String(c.code||'').trim(),rev:String(c.rev||'').trim(),eff:c.eff||'',keep:Number(c.keep)>0?Number(c.keep):r.keep,owner:String(c.owner||'').trim()||'หัวหน้า Lab'}}
const isoWho=()=>S.me||(S.account&&S.account.name)||'ผู้ใช้ในเครื่องนี้';
const isoStamp=()=>{const n=new Date();return `${thDate(ymd(n))} ${pad(n.getHours())}:${pad(n.getMinutes())} น.`};
/* the document-control text of a record: "เลขที่เอกสาร FM-LAB-01 · Rev. 00 · วันที่มีผล 1 ต.ค. 2569 · จัดเก็บ 3 ปี" */
function isoLine(k){const d=isoDoc(k);
  return [d.code?`เลขที่เอกสาร ${d.code}`:'',d.rev?`Rev. ${d.rev}`:'',d.eff?`วันที่มีผล ${thDate(d.eff)}`:'',`จัดเก็บ ${d.keep} ปี`].filter(Boolean).join(' · ')}
/* print pages: a line under the header, and the footer of every page (code left, "หน้า x / y" right) */
function isoHeadHtml(k){return `<div class="iso-ctl" style="margin:-6px 0 8px;font-size:9px;color:#34496b;display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #c6d3e4;padding-bottom:3px"><span>${esc(isoLine(k))}</span><span>พิมพ์โดย ${esc(isoWho())} · ${esc(isoStamp())}</span></div>`}
function isoPageCss(k){const d=isoDoc(k);const left=[d.code,d.rev?'Rev. '+d.rev:''].filter(Boolean).join(' ').replace(/"/g,'');
  return `@page{@bottom-left{content:"${left||'BU1 Lab'}";font:8pt "IBM Plex Sans Thai",sans-serif;color:#62738f}@bottom-right{content:"หน้า " counter(page) " / " counter(pages);font:8pt "IBM Plex Sans Thai",sans-serif;color:#62738f}}`}
/* Excel: one row under the title */
const isoXlsxRow=k=>[`${isoLine(k)} · ส่งออกโดย ${isoWho()} · ${isoStamp()}`];

/* ---------- 1) audit trail ---------- */
const ISO_COLLS=new Set(['tasks','ncr']);
const ISO_SKIP=new Set(['id','dept_id','updatedAt','updatedBy','createdAt','createdBy','history','sample','src','gaCar','gaMore','gaRequestedAt','start','end','type','fileIds','tag','groupId','jobTypeName','closedAt','closedBy']);
const ISO_FIELD={date:'วันที่',period:'ช่วงเวลา',jobType:'หัวข้องาน',jobTypeOther:'หัวข้องาน (อื่นๆ)',line:'สายงาน',planNo:'Plan No.',sale:'Sale',customer:'Customer',location:'Location',areaId:'พื้นที่ (Safety)',
  timeNote:'Time',detail:'Detail',request:'Request',transport:'รถ',needGA:'ขอรถ GA',selfDrive:'ขอรถไปเอง',gaGo:'เวลารถออก / รับรถ',gaBack:'เวลากลับ / คืนรถ',gaPattern:'รูปแบบรถ GA',gaUrgent:'งานด่วน (รถ GA)',gaCargo:'ของต้องขน',gaNote:'หมายเหตุถึง GA',carReason:'เหตุผลขอรถไปเอง',carNote:'รายละเอียด (รถ)',
  contact:'Contact',contactTel:'เบอร์ติดต่อ',guests:'คนแผนกอื่น',prep:'ใบเตรียมงาน',staffIds:'Team Service',sharedTeam:'ใช้ทีมร่วม',status:'สถานะ',statusNote:'เหตุผล / ปัญหา',
  calItems:'Weekly plan calibration',insItems:'Weekly plan instrument',reports:'เอกสารหลังจบงาน',docNA:'เอกสารที่ไม่มีสำหรับงานนี้',photoIds:'รูป',files:'ไฟล์แนบ',ncrId:'NCR',
  ncrNo:'NCR No.',taskId:'แผนงาน',category:'หมวดปัญหา',issue:'ปัญหา',cause:'สาเหตุ',correction:'การแก้ไขเฉพาะหน้า',action:'การแก้ไขและป้องกัน',owner:'ผู้รับผิดชอบ',due:'กำหนดเสร็จ',state:'สถานะ NCR',result:'ผลการตรวจติดตาม'};
const isoBlank=v=>v==null||v===''||v===false||(Array.isArray(v)&&!v.length)||(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length);
const isoKey=v=>isoBlank(v)?'':typeof v==='string'?v.trim():JSON.stringify(v);
/* a value as people read it (stored as text: the history stays readable after names or lists change) */
function isoText(k,v,other){
  if(isoBlank(v))return '—';
  if(k==='status')return stTh(v);
  if(k==='state')return (NCR_STATE[v]||{th:v}).th;
  if(k==='staffIds')return asArr(v).map(staffName).join(', ');
  if(k==='areaId'&&typeof areaName==='function')return areaName(v);
  if(k==='line')return LINE[v]?LINE[v].name:String(v);
  if(k==='period')return (PERIOD[v]||{}).name||String(v);
  if(k==='gaPattern')return GA_PATTERNS[v]||String(v);
  if(k==='gaCargo')return cargoText(v)||'—';
  if(k==='jobType'){const t=jobTypes().find(x=>x.id===v);return t?t.name:String(v)}
  if(k==='reports'||k==='files')return asArr(v).map(f=>(f&&(f.label!=null?f.label||f.name:f.name))||'').filter(Boolean).join(', ')||`${asArr(v).length} ไฟล์`;
  if(typeof v==='boolean')return v?'ใช่':'ไม่';
  if(Array.isArray(v)){if(v.every(x=>typeof x!=='object'))return v.join(', ');
    return Array.isArray(other)&&other.length===v.length?`${v.length} รายการ (แก้ไขข้อมูลในรายการ)`:`${v.length} รายการ`}
  if(typeof v==='object')return JSON.stringify(v).slice(0,160);
  const s=String(v).replace(/\s+/g,' ').trim();return s.length>160?s.slice(0,157)+'…':s;
}
const asArr=v=>Array.isArray(v)?v:v?[v]:[];
function isoOld(c,id){
  if(c==='tasks'){const t=findTask(id);if(t)return t;const l=L.tasks.get(id);return l?Object.assign({id},l):null}
  if(c==='ncr'){const n=(S.ncr||[]).find(x=>x.id===id);if(n)return n;const l=L.ncr.get(id);return l?Object.assign({id},l):null}
  return null;
}
/* called by Store.set (partial=false) and Store.update (partial=true) before the write: returns the data with history added */
function isoAudit(c,id,d,partial){
  if(!ISO_COLLS.has(c)||!d||d.sample)return d;
  const old=isoOld(c,id);
  const keys=partial?Object.keys(d):[...new Set(Object.keys(d).concat(old?Object.keys(old):[]))];
  const ch=[];
  if(old)for(const k of keys){if(ISO_SKIP.has(k)||k.startsWith('_'))continue;const a=old[k],b=k in d?d[k]:(partial?a:undefined);
    if(isoKey(a)!==isoKey(b))ch.push([ISO_FIELD[k]||k,isoText(k,a,b),isoText(k,b,a)])}
  const hist=asArr(old&&old.history);
  if(old&&!ch.length)return partial||'history' in d?d:Object.assign({},d,{history:hist});/* nothing a person would see changed */
  const entry={at:new Date().toISOString(),by:isoWho(),a:old?'edit':'create',ch:old?ch:[]};
  return Object.assign({},d,{history:hist.concat(entry).slice(-ISO_HISTORY_MAX)});
}
const isoLabel=(c,r)=>!r?'':c==='ncr'?[r.ncrNo,r.planNo,r.customer].filter(Boolean).join(' · '):[r.planNo,typeof typeLabel==='function'?typeLabel(r):'',r.customer,r.date?fmtDay(r.date):''].filter(Boolean).join(' · ');
/* called by Store.del before a plan / NCR is deleted: the deletion and the record's last state stay in the audit log */
async function isoDeleteLog(c,id){
  if(!ISO_COLLS.has(c))return;const old=isoOld(c,id);if(!old||old.sample)return;
  const snap=c==='ncr'?{ncrNo:old.ncrNo,date:old.date,planNo:old.planNo,customer:old.customer,issue:old.issue,state:old.state}
    :{date:old.date,planNo:old.planNo||'',jobType:typeof typeLabel==='function'?typeLabel(old):old.jobType,customer:old.customer||'',location:old.location||'',status:old.status||'',team:asArr(old.staffIds).map(staffName).join(', '),reports:asArr(old.reports).length};
  await Store.set('audit',newId('a'),{at:new Date().toISOString(),by:isoWho(),coll:c,recId:String(id),a:'delete',label:isoLabel(c,old),snap,history:asArr(old.history).slice(-30)});
}
/* history list for the plan / NCR view */
function isoHistoryHtml(r,k){
  const h=asArr(r&&r.history);if(!h.length&&!(r&&r.createdAt))return '';
  const when=at=>{const d=new Date(at);return isNaN(d)?'':`${thDate(ymd(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const who=b=>esc(String(b||'—').split('@')[0]);
  const rows=h.slice().reverse().map(e=>`<li><div><b>${e.a==='create'?'สร้าง Record':'แก้ไข'}</b> <span>${esc(when(e.at))} · ${who(e.by)}</span></div>${(e.ch||[]).length?`<ul>${e.ch.map(([f,a,b])=>`<li><b>${esc(f)}</b> <s>${esc(a)}</s> → ${esc(b)}</li>`).join('')}</ul>`:''}</li>`).join('');
  const first=!h.some(e=>e.a==='create')&&r.createdAt?`<li><div><b>สร้าง Record</b> <span>${esc(when(r.createdAt))} · ${who(r.createdBy)}</span></div></li>`:'';
  return `<details class="iso-hist"${k?` style="--k:${k}"`:''}><summary>ประวัติการแก้ไข (ISO 9001) · ${h.length} ครั้ง</summary><ol>${rows}${first}</ol>${h.length>=ISO_HISTORY_MAX?`<p class="hint">แสดง ${ISO_HISTORY_MAX} ครั้งล่าสุด · ครั้งก่อนหน้าอยู่ในไฟล์ส่งออกเก็บถาวร</p>`:''}</details>`;
}

/* ---------- 3) ทะเบียน Record (ข้อมูลหลัก › ISO 9001 · Record) ---------- */
let isoDel=null,isoDelBusy=false;
function isoLoadDeletes(){if(isoDelBusy)return;isoDelBusy=true;Store.all('audit').then(l=>{isoDel=l.sort((a,b)=>String(b.at).localeCompare(String(a.at)))}).catch(()=>{isoDel=isoDel||[]}).finally(()=>{isoDelBusy=false;if(S.view==='settings'&&S.md==='iso')render()})}
function isoSection(){
  const ed=can('master');const dis=ed?'':' disabled';const now=new Date();const y=now.getFullYear();
  if(isoDel==null)isoLoadDeletes();
  const rows=ISO_RECS.map(r=>{const d=isoDoc(r.k);const f=(fld,val,attrs)=>`<input data-iso="${r.k}|${fld}" value="${esc(val)}"${attrs||''}${dis} aria-label="${fld} ของ ${esc(r.name)}">`;
    return `<tr><td><b>${esc(r.name)}</b><span class="sub">${esc(r.where)}</span></td><td>${f('code',d.code,' maxlength="40" placeholder="เช่น FM-LAB-01" class="mono"')}</td><td>${f('rev',d.rev,' maxlength="10" placeholder="00" class="w-rev"')}</td>
      <td>${f('eff',d.eff,' type="date"')}</td><td>${f('keep',d.keep,' type="number" min="1" max="50" class="w-num"')}</td><td>${f('owner',d.owner,' maxlength="60"')}</td></tr>`}).join('');
  const del=isoDel==null?'<p class="hint">กำลังโหลด…</p>':isoDel.length?`<div class="scroll-x plain"><table class="mini"><thead><tr><th>เมื่อ</th><th>โดย</th><th>Record ที่ลบ</th></tr></thead><tbody>${isoDel.slice(0,30).map(a=>{const d=new Date(a.at);
    return `<tr><td class="num">${esc(isNaN(d)?'':thDate(ymd(d))+' '+pad(d.getHours())+':'+pad(d.getMinutes()))}</td><td>${esc(String(a.by||'').split('@')[0])}</td><td>${esc(a.coll==='ncr'?'NCR':'แผนงาน')} · ${esc(a.label||a.recId)}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="hint">ยังไม่มีการลบแผนงานหรือ NCR</p>';
  const years=Array.from({length:6},(_,i)=>y-i);
  return {id:'iso',title:'ISO 9001 · Record',sub:'เลขที่เอกสาร · ระยะเวลาจัดเก็บ',count:ISO_RECS.length,
    desc:'ทะเบียน Record ตาม ISO 9001 (ข้อ 7.5 เอกสารที่เป็นลายลักษณ์อักษร) · เลขที่เอกสาร Rev. และวันที่มีผล พิมพ์บนหัวรายงานทุกฉบับ (Print / PDF / Excel) พร้อมเลขหน้า · ทุกแผนงานและ NCR เก็บประวัติการแก้ไขว่าใครแก้อะไรเมื่อไร และบันทึกการลบไว้',
    body:`<div class="scroll-x plain md-scroll"><table class="edit-table iso-reg"><thead><tr><th>Record</th><th>เลขที่เอกสาร</th><th>Rev.</th><th>วันที่มีผล</th><th>จัดเก็บ (ปี)</th><th>ผู้รับผิดชอบ</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="hint" style="margin:0">ที่จัดเก็บ: ${esc(ISO_STORE)} · ไฟล์แนบเก็บคู่กับแผนงาน · ${ed?'แก้แล้วบันทึกทันที':'ดูได้อย่างเดียว · แก้ได้เฉพาะผู้ดูแลระบบ / ผู้วางแผน'}</p>
      <h3 class="iso-h">ส่งออกเก็บถาวร (Archive)</h3>
      <div class="iso-arch"><select id="iso-y" aria-label="ปี">${years.map(v=>`<option value="${v}">${v+543}</option>`).join('')}</select>
        <select id="iso-m" aria-label="เดือน"><option value="">ทั้งปี</option>${TH_MON_FULL.map((m,i)=>`<option value="${i+1}"${i===now.getMonth()?' selected':''}>${m}</option>`).join('')}</select>
        <button type="button" class="btn primary" data-iso-archive>ส่งออก Excel เก็บถาวร</button></div>
      <p class="hint" style="margin:0">ไฟล์เดียวมีทุก Record ของช่วงนั้น: แผนงาน · เอกสารหลังจบงาน · NCR · ประวัติการแก้ไข · การลบ · ทะเบียน Record — เก็บไว้ตามระยะเวลาจัดเก็บ</p>
      <h3 class="iso-h">การลบ Record ล่าสุด</h3>${del}`};
}
document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset||!t.dataset.iso)return;
  if(!can('master')){toast('บัญชีนี้แก้ทะเบียน Record ไม่ได้');return}
  const [k,f]=t.dataset.iso.split('|');const iso=Object.assign({},(S.cfg||{}).iso||{});const cur=Object.assign({},iso[k]||{});
  cur[f]=f==='keep'?Math.max(1,Math.min(50,Number(t.value)||ISO_RECS.find(r=>r.k===k).keep)):t.value.trim();iso[k]=cur;
  await saveCfg({iso},'บันทึกทะเบียน Record แล้ว');
});

/* "ส่งออก Excel เก็บถาวร": every record of a month or a year in one workbook */
async function isoArchive(btn){
  const y=Number($('#iso-y').value),m=Number($('#iso-m').value)||0;
  const from=m?`${y}-${pad(m)}-01`:`${y}-01-01`,to=m?ymd(new Date(y,m,0)):`${y}-12-31`;const label=m?`${y}-${pad(m)}`:`${y}`;
  const old=btn.textContent;btn.disabled=true;btn.textContent='กำลังรวบรวม…';
  try{
    const X=await loadXLSX();
    const [tasks,audit]=await Promise.all([Store.range('tasks',from,to),Store.all('audit').catch(()=>[])]);
    const ncr=(S.ncr||[]).filter(n=>n.date&&n.date>=from&&n.date<=to);const inR=at=>{const k=ymd(new Date(at));return k>=from&&k<=to};
    const plans=tasks.slice().sort(byTime);
    const period=`ช่วง ${thDate(from)} – ${thDate(to)}`;
    const wb=X.utils.book_new();
    const add=(name,k,title,head,body,w)=>{const ws=X.utils.aoa_to_sheet([[`${DASH_ORG} · ${title}`],isoXlsxRow(k),[period],[],head,...(body.length?body:[['ไม่มีข้อมูลในช่วงนี้']])]);
      if(w)ws['!cols']=w.map(x=>({wch:x}));X.utils.book_append_sheet(wb,ws,name)};
    const who=b=>String(b||'').split('@')[0];const when=at=>{const d=new Date(at);return isNaN(d)?'':`${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
    add('ทะเบียน Record','audit','ทะเบียน Record (ISO 9001)',['Record','เลขที่เอกสาร','Rev.','วันที่มีผล','ระยะเวลาจัดเก็บ (ปี)','ผู้รับผิดชอบ','ที่จัดเก็บ / รูปแบบ'],
      ISO_RECS.map(r=>{const d=isoDoc(r.k);return [r.name,d.code,d.rev,d.eff,d.keep,d.owner,`${ISO_STORE} · ${r.where}`]}),[44,16,6,12,10,16,60]);
    add('แผนงาน','plan','แผนงาน (Record)',['วันที่','สายงาน','หัวข้องาน','Plan No.','Customer','Location','ช่วงเวลา','Team Service','รถ','สถานะ','เหตุผล / ปัญหา','เอกสารหลังจบงาน','สร้างโดย','สร้างเมื่อ','แก้ล่าสุดโดย','แก้ล่าสุดเมื่อ','แก้ไข (ครั้ง)'],
      plans.map(t=>[t.date,LINE[lineOf(t)]?LINE[lineOf(t)].name:'',typeLabel(t),t.planNo||'',t.customer||'',t.location||'',pName(t),teamNames(t).join(', '),transportText(t),stTh(t.status),t.statusNote||'',
        isLeave(t)?'':`${docState(t).have}/${docState(t).need}`,who(t.createdBy),when(t.createdAt),who(t.updatedBy),when(t.updatedAt),asArr(t.history).filter(e=>e.a==='edit').length]),[11,16,18,14,22,18,9,30,24,10,24,10,14,16,14,16,8]);
    add('เอกสารหลังจบงาน','docs','เอกสารหลังจบงาน (Record)',['วันที่งาน','Plan No.','หัวข้องาน','Customer','ชื่อเอกสาร','ไฟล์','แนบโดย','แนบเมื่อ'],
      plans.filter(t=>!isLeave(t)).flatMap(t=>reportsOf(t).map(f=>[t.date,t.planNo||'',typeLabel(t),t.customer||'',docLabel(f),f.name,who(f.by),when(f.at)])),[11,14,18,22,26,30,14,16]);
    add('NCR','ncr','NCR (Record)',['NCR No.','วันที่','Plan No.','Customer','หมวด','ปัญหา','สาเหตุ','การแก้ไข','การป้องกัน','ผู้รับผิดชอบ','กำหนดเสร็จ','สถานะ','ผลการตรวจติดตาม','ปิดเมื่อ'],
      ncr.map(n=>[n.ncrNo||'',n.date||'',n.planNo||'',n.customer||'',n.category||'',n.issue||'',n.cause||'',n.correction||'',n.action||'',n.owner||'',n.due||'',(NCR_STATE[n.state]||{th:n.state}).th,n.result||'',when(n.closedAt)]),[14,11,14,20,18,30,24,24,24,14,11,10,24,16]);
    const hist=[];plans.forEach(t=>asArr(t.history).forEach(e=>{const base=['แผนงาน',[t.planNo,typeLabel(t),t.date].filter(Boolean).join(' · '),when(e.at),who(e.by),e.a==='create'?'สร้าง':'แก้ไข'];
      if((e.ch||[]).length)e.ch.forEach(([f,a,b])=>hist.push(base.concat([f,a,b])));else hist.push(base.concat(['','','']))}));
    ncr.forEach(n=>asArr(n.history).forEach(e=>{const base=['NCR',n.ncrNo||'',when(e.at),who(e.by),e.a==='create'?'สร้าง':'แก้ไข'];if((e.ch||[]).length)e.ch.forEach(([f,a,b])=>hist.push(base.concat([f,a,b])));else hist.push(base.concat(['','','']))}));
    add('ประวัติการแก้ไข','audit','ประวัติการแก้ไข (Audit trail)',['ชนิด','Record','เมื่อ','โดย','การกระทำ','ช่อง','จาก','เป็น'],hist.sort((a,b)=>String(a[2]).localeCompare(String(b[2]))),[9,36,16,16,9,22,30,30]);
    add('การลบ','audit','การลบ Record',['เมื่อ','โดย','ชนิด','Record','ข้อมูลล่าสุดก่อนลบ'],audit.filter(a=>a.a==='delete'&&inR(a.at)).sort((a,b)=>String(a.at).localeCompare(String(b.at)))
      .map(a=>[when(a.at),who(a.by),a.coll==='ncr'?'NCR':'แผนงาน',a.label||a.recId,JSON.stringify(a.snap||{})]),[16,16,9,40,60]);
    await saveFile(`BU1-ISO-Records_${label}.xlsx`,X.write(wb,{type:'array',bookType:'xlsx'}),`ส่งออก Record ${m?TH_MON_FULL[m-1]+' ':''}${y+543} แล้ว · ${plans.length} แผน · NCR ${ncr.length}`);
  }catch(err){toast('ส่งออกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่')}
  finally{btn.disabled=false;btn.textContent=old}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-iso-archive]');if(b)isoArchive(b)});
