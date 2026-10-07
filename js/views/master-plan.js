'use strict';
/* BU1 Weekly Plan · Master Plan (user, 6 Oct 2026; the team's sheets "Plan Lab 1" and "Plan Lab Ins 2026")
   One page, one month at a time, two tabs:
   - Flow Meter: the team's monthly sheet, entered here (not taken from the Weekly Plan). One row per meter:
     Request No. · Customer · Tag · Size (Inch) · Type · SALE · Flow meter (No.) · Ins · Flowcom · Clamp-on ·
     day 1…31 (work codes D / I / C / W / R / S / C-OS …, combined as "D/C/I") · Remark.
     W and Cal per day above the days, every code's daily count in the legend under the table.
     Entity "mpfm" = {month:'YYYY-MM', order, reqNo, cust, tag, size, type, sale, fm, ins, fc, co, days:{'1':'D/C/I',…}, remark}
     (central DB: public.app_settings id "bu1wp_mpfm:<id>", one row per meter, read one month at a time).
   - Instrument: the team's monthly sheet, entered here too (user, 6 Oct 2026). One row per request:
     Request No. / PN · LAB · Customer · Plant · Tag · Type · Range / Set Point / Nor.Temp (Unit) · Remove · Cal · install (final) ·
     BU (R / I) · รับ/ส่ง · SALE (Contact) · ชื่อลูกค้า · Total Booking · Total cal (= sum of the days) · day 1…31 (count) · Remark.
     Entity "mpins" = {month, order, reqNo, lab, cust, plant, tag, type, range, remove, cal, install, bu, rs, sale, contact,
     booking, days:{'15':'40',…}, remark, src} (app_settings "bu1wp_mpins:<id>"); "ดึงจาก Weekly plan instrument" copies the
     month's task.insItems rows in (src = "<plan id>|<row id>", each copied once). */
S.mp={tab:'',month:'',q:''};S.mpRows=null;S.mpKey='';S.mpFocus=null;S.mpSel=new Set();
/* the sheet's legend (counted per day) and the other codes used in its cells */
const MP_CODES=[['D','Disconnect'],['I','Install'],['C','Cal.'],['W','Cal & Witness'],['Te','internal test'],['TP','cal temp pressure'],
  ['K','Config K-factor'],['L','Loop Test'],['T','Training'],['P','On power (new meter)'],['F','Field Survey']];
const MP_OTHER=[['R','รับมิเตอร์'],['S','ส่งมิเตอร์'],['C-OS','Cal On-Site'],['Check-OS','Check On-Site'],['SWITCH','สลับมิเตอร์'],['Clamp-on','Clamp-on'],['Internal','Internal'],['Sim','Simulate']];
const MP_CANON=Object.fromEntries(MP_CODES.concat(MP_OTHER).map(([c])=>[c.toUpperCase(),c]));
const MP_SIZES=['1/8','1/4','3/8','1/2','3/4','1','1-1/2','2','2-1/2','3','4','6','8','10','12','14','16'];
const MP_TYPES=['CORIOLIS','MAGNETIC','VORTEX','TURBINE','ULTRASONIC','PD','THERMAL MASS','ROTA','GAS TURBINE','FLOW SWITCH','INS','FLOWCOM','TT,TE,PT','PT','TT','TE','DP','PG'];
const MP_CELLS=['D','I','C','W','R','S','D/C','D/I','C/I','D/C/I','D/W/I','D/W','W/I','R/C','R/W','R/C/S','R/W/S','C/S','W/S','I/L','L','C-OS','Check-OS','SWITCH','Clamp-on','Internal','K','T','P','F','Te','TP','Sim'];
const MP_FIELDS=['reqNo','cust','tag','size','type','sale','fm','ins','fc','co','remark'];
const MP_NUM=new Set(['fm','ins','fc','co','booking']);
const MPI_FIELDS=['reqNo','lab','cust','plant','tag','type','range','remove','cal','install','bu','rs','sale','contact','booking','remark'];
const MPI_RS=['ลูกค้าส่งเอง','เซลล์จองรถ','ทีมถอด','มีใบนำของเข้า'];
const MP_ENT={fm:'mpfm',ins:'mpins'};
insDl('dl-mpCode',MP_CELLS);insDl('dl-mpSize',MP_SIZES);insDl('dl-mpType',MP_TYPES);
insDl('dl-mpLab',INS_LABS);insDl('dl-mpBu',['-','BU1','BU2']);insDl('dl-mpRs',MPI_RS);

/* ---------- month, rows, codes ---------- */
const mpMonth=()=>S.mp.month||(S.mp.month=ymd(new Date()).slice(0,7));
const mpTab=()=>S.mp.tab||(S.line==='ins'?'ins':'fm');
function mpDays(){const [y,m]=mpMonth().split('-').map(Number);return Array.from({length:new Date(y,m,0).getDate()},(_,i)=>new Date(y,m-1,i+1))}
function mpShift(n){const [y,m]=mpMonth().split('-').map(Number);const d=n?new Date(y,m-1+n,1):new Date();S.mp.month=ymd(d).slice(0,7);S.anim='view';render()}
/* typed codes in the sheet's spelling: "d/c/i" → "D/C/I", "c-os" → "C-OS"; other words stay as typed */
const mpCanon=v=>String(v||'').trim().replace(/[A-Za-z][A-Za-z-]*/g,w=>MP_CANON[w.toUpperCase()]||w);
const mpTokens=v=>String(v||'').split(/[\/\s,+]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);
function mpCellCls(v){const k=mpTokens(v);if(!k.length)return '';
  return k.includes('W')?'w':k.includes('C')?'c':k.some(x=>x==='C-OS'||x==='CHECK-OS'||x==='CLAMP-ON')?'os':k.includes('SWITCH')?'sw':k.includes('D')||k.includes('I')?'di':'x'}
const mpNum=v=>{const n=parseFloat(v);return isFinite(n)?n:0};
const mpSorted=()=>(S.mpRows||[]).slice().sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
const mpMatch=r=>{const q=norm(S.mp.q);return !q||norm([r.reqNo,r.cust,r.tag,r.type,r.sale,r.remark,r.plant,r.contact,r.lab].join(' ')).includes(q)};
const mpCal=r=>Object.values(r.days||{}).reduce((a,v)=>a+mpNum(v),0);/* Instrument: Total cal = the day counts */
const mpEnt=()=>MP_ENT[mpTab()];
const mpFields=()=>mpTab()==='ins'?MPI_FIELDS:MP_FIELDS;
/* one input cell of either sheet (plain text for a viewer) */
const mpCell=(r,f,cls,dl,ed)=>ed?`<td class="mp-c ${cls||''}"><input class="mp-in" data-mp="${esc(r.id)}|${f}" value="${esc(r[f]||'')}"${dl?` list="${dl}"`:''}${MP_NUM.has(f)?' inputmode="numeric"':''} maxlength="${f==='remark'||f==='range'?200:80}" aria-label="${f}"></td>`
  :`<td class="mp-c ${cls||''}">${esc(r[f]||'')}</td>`;

/* the open tab's month is read live only while the page is open (S.mpKey = "<tab>|<month>") */
let mpUnsub=null;
function mpWatch(){
  const tab=mpTab(),m=mpMonth(),key=tab+'|'+m;if(S.mpKey===key)return;mpStop();S.mpKey=key;S.mpSel=new Set();const ent=MP_ENT[tab];
  if(!db){S.mpRows=rows(L[ent]).filter(r=>r.month===m);return}
  mpUnsub=db.collection(ent).where('month','==',m).onSnapshot(s=>{if(S.mpKey!==key)return;S.mpRows=docRows(s);render()},
    e=>{dbErr(e);if(S.mpKey===key&&!S.mpRows){S.mpRows=[];render()}});
}
function mpStop(){if(mpUnsub){mpUnsub();mpUnsub=null}S.mpKey='';S.mpRows=null}

/* ---------- writes (every change is saved at once) ---------- */
async function mpPut(id,row,ent){try{await Store.set(ent||mpEnt(),id,row);mpInvalidate()}catch(e){toast(errText(e));noteWriteError(e)}}
function mpSave(id,patch){
  const r=(S.mpRows||[]).find(x=>x.id===id);if(!r)return;
  Object.assign(r,patch,{updatedAt:new Date().toISOString(),updatedBy:S.me||null});/* shown at once; the live read confirms it */
  const {id:_,...d}=r;return mpPut(id,d);
}
function mpAdd(afterId){
  if(!can('edit'))return;
  const list=mpSorted();const i=list.findIndex(x=>x.id===afterId);const a=list[i];
  const ord=x=>Number(x&&x.order)||0;
  const order=a?(list[i+1]?(ord(a)+ord(list[i+1]))/2:ord(a)+1):(list.length?Math.max(...list.map(ord))+1:1);
  /* "+" on a row: the next meter of the same Request No. (Customer, Size, Type, SALE kept; Flow meter No. + 1);
     Instrument: the next row of the same request (everything up to the dates kept, Tag and counts empty) */
  const ins=mpTab()==='ins';const keep=k=>Object.fromEntries(k.map(f=>[f,a[f]||'']));
  const base=!a?{}:ins?keep(['reqNo','lab','cust','plant','type','remove','cal','install','bu','rs','sale','contact'])
    :Object.assign(keep(['reqNo','cust','size','type','sale']),{fm:/^\d+$/.test(String(a.fm||''))?String(Number(a.fm)+1):''});
  const id=newId('mp');
  const row=Object.assign({month:mpMonth(),order},Object.fromEntries(mpFields().map(f=>[f,''])),{days:{}},base,
    {createdAt:new Date().toISOString(),createdBy:S.me||null});
  S.mpFocus={id,f:a?'tag':'reqNo'};
  if(S.mpRows)S.mpRows.push(Object.assign({id},row));fillMp();
  mpPut(id,row);
}
function mpDel(id){
  const r=(S.mpRows||[]).find(x=>x.id===id);if(!r||!can('del'))return;
  askConfirm('ลบแถวนี้ออกจาก Master Plan?',[r.reqNo,r.cust,r.tag].filter(Boolean).join(' · ')||'แถวว่าง','ลบแถว').then(async ok=>{
    if(!ok)return;const ent=mpEnt();S.mpRows=S.mpRows.filter(x=>x.id!==id);fillMp();
    try{await Store.del(ent,id);mpInvalidate()}catch(e){toast(errText(e));noteWriteError(e)}});
}

/* ลบข้อมูล (user, 6 Oct 2026): tick rows and delete them, or delete the whole month of the open tab when nothing is ticked.
   S.mpSel = ticked row ids (cleared when the tab or month changes); every delete asks first, by id, BU1 rows only */
const mpSelBox=(r,i)=>can('del')?`<input type="checkbox" class="mp-sel" data-mp-sel="${esc(r.id)}"${S.mpSel.has(r.id)?' checked':''} aria-label="เลือกแถวที่ ${i+1}">`:'';
const mpSelAll=list=>{if(!can('del'))return '#';const n=list.filter(r=>S.mpSel.has(r.id)).length;
  return `<input type="checkbox" class="mp-sel" data-mp-selall=""${list.length&&n===list.length?' checked':''}${n&&n<list.length?' data-some="1"':''} aria-label="เลือกทุกแถวที่แสดง">`};
function mpSelSync(){
  const have=new Set((S.mpRows||[]).map(r=>r.id));S.mpSel.forEach(id=>{if(!have.has(id))S.mpSel.delete(id)});
  const b=document.querySelector('[data-mp-delbar]');if(!b)return;const n=S.mpSel.size;
  b.querySelector('span').textContent=n?`ลบที่เลือก (${n})`:'ลบข้อมูล';b.classList.toggle('on',!!n);
  b.disabled=!S.mpRows||!S.mpRows.length;
  const all=document.querySelector('[data-mp-selall]');if(all)all.indeterminate=all.dataset.some==='1';
}
async function mpDelMany(ids){
  const ent=mpEnt();let done=0,fail=0;const b=document.querySelector('[data-mp-delbar]');
  const step=()=>{if(b)b.querySelector('span').textContent=`กำลังลบ ${done}/${ids.length}…`};if(b)b.disabled=true;step();S.bulk=true;
  const gone=new Set();let i=0;
  try{await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{while(i<ids.length){const id=ids[i++];
    try{await Store.del(ent,id);gone.add(id)}catch(e){fail++;noteWriteError(e)}done++;step()}}))}
  finally{S.bulk=false}
  if(S.mpRows)S.mpRows=S.mpRows.filter(r=>!gone.has(r.id));gone.forEach(id=>S.mpSel.delete(id));
  mpInvalidate();if(!db)localPublish();else fillMp();
  toast(fail?`ลบได้ ${gone.size} จาก ${ids.length} แถว · บางแถวลบไม่สำเร็จ ลองอีกครั้ง`:`ลบแล้ว ${gone.size} แถว`);
}
async function mpDelBar(){
  if(!can('del')||!S.mpRows)return;const all=S.mpRows;const tab=mpTab()==='ins'?'Master Plan Instrument':'Master Plan Flow Meter';
  const [y,m]=mpMonth().split('-').map(Number);const mon=`${TH_MON_FULL[m-1]} ${y+543}`;
  const label=r=>[r.reqNo,r.cust,r.tag].filter(Boolean).join(' · ')||'แถวว่าง';
  if(S.mpSel.size){const pick=mpSorted().filter(r=>S.mpSel.has(r.id));
    if(await askConfirm(`ลบ ${pick.length} แถวที่เลือก?`,pick.slice(0,8).map(label).join('\n')+(pick.length>8?`\nและอีก ${pick.length-8} แถว`:'')+'\n\nลบแล้วกู้คืนไม่ได้',`ลบ ${pick.length} แถว`))mpDelMany(pick.map(r=>r.id));
    return}
  if(!all.length){toast('เดือนนี้ไม่มีข้อมูลให้ลบ');return}
  if(await askConfirm(`ลบ ${tab} ทั้งเดือน ${mon}?`,`ลบทั้งหมด ${all.length} แถวของ ${tab} เดือน${mon} (ไม่ว่าจะค้นหาอะไรอยู่) · ลบแล้วกู้คืนไม่ได้ ถ้ายังต้องการข้อมูล กด Excel เก็บไว้ก่อน\n\nต้องการลบเฉพาะบางแถว ให้ติ๊กช่องหน้าแถวก่อนแล้วกดลบ`,`ลบทั้ง ${all.length} แถว`))mpDelMany(all.map(r=>r.id));
}

/* ---------- page ---------- */
function renderMp(){
  if(notReady())return loading();
  const tab=mpTab();mpWatch();
  const [y,m]=mpMonth().split('-').map(Number);const isNow=mpMonth()===ymd(new Date()).slice(0,7);
  const ed=can('edit');
  const sub={fm:'มิเตอร์ · รหัสงานรายวัน D / C / W / I …',ins:'Request · LAB · จำนวนสอบเทียบรายวัน'};
  return `<div class="mp-tabs" role="tablist" aria-label="สายงาน">${LINES.map(l=>`<button type="button" role="tab" class="mp-tab${tab===l.id?' on':''}" data-mp-tab="${l.id}" aria-selected="${tab===l.id}" style="--lc:${l.color}"><span class="mp-tab-ico">${l.icon}</span><span class="mp-tab-t"><b>${l.id==='fm'?'Master Plan Flow Meter':'Master Plan Instrument'}</b><small>${sub[l.id]}</small></span></button>`).join('')}</div>
    <section class="mp-bar" style="--lc:${LINE[tab].color}">
      <div class="mp-nav"><button type="button" class="icon-btn" data-mp-mon="-1" aria-label="เดือนก่อน">‹</button>
        <div class="mp-mon"><b>${EN_MON[m-1].toUpperCase()} ${y}</b><span>${TH_MON_FULL[m-1]} ${y+543} · ${isNow?'เดือนนี้':'<button type="button" class="lnk" data-mp-mon="0">กลับเดือนนี้</button>'}</span></div>
        <button type="button" class="icon-btn" data-mp-mon="1" aria-label="เดือนถัดไป">›</button>
        <label class="mp-pick" title="เลือกเดือน"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><input type="month" id="mp-month" value="${esc(mpMonth())}" aria-label="เลือกเดือน"></label></div>
      <label class="mp-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input type="search" id="mp-q" placeholder="${tab==='fm'?'ค้นหา Request No. / Customer / Tag / SALE':'ค้นหา Request No. / Customer / Plant / Tag / SALE'}" value="${esc(S.mp.q)}" aria-label="คำค้น" autocomplete="off"></label>
      <div class="mp-act">
        ${ed?`<button type="button" class="btn" data-mp-imp-xlsx="" title="อ่านแผ่นงาน Master Plan ของทีมจากไฟล์ Excel (.xlsx / .xls) เข้าเดือนนี้"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 14.5v4a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-4"/></svg>นำเข้า Excel</button>`:''}
        <button type="button" class="btn" data-mp-xlsx="" title="ดาวน์โหลดเดือนนี้เป็นไฟล์ Excel (นำเข้ากลับได้)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 14.5v4a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-4"/></svg>Excel</button>
        <button type="button" class="btn" data-mp-pdf="" title="พิมพ์ / บันทึกเป็น PDF (A3 แนวนอน)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/></svg>PDF</button>
        ${can('del')?'<button type="button" class="btn mp-delbtn" data-mp-delbar="" title="ลบแถวที่ติ๊กเลือก · ไม่ได้เลือกแถว = ลบข้อมูลทั้งเดือนของแท็บนี้"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/></svg><span>ลบข้อมูล</span></button>':''}
        ${ed?'<button type="button" class="btn primary" data-mp-add=""><span class="plus">+</span> เพิ่มแถว</button>':''}
      </div>
    </section>
    <div id="mpSum" class="mp-sum" style="--lc:${LINE[tab].color}"></div>
    <div id="mpBody" style="--lc:${LINE[tab].color}"></div>
    <datalist id="dl-mpSale">${[...new Set(DEFAULT_SALES.concat(sales().map(s=>s.name)))].map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;
}
/* the month's figures above the sheet: [value, name, note, tone] */
const mpTiles=(list,shown)=>list.map(([v,n,note,tone])=>`<div class="mp-k${tone?' '+tone:''}"><b>${v}</b><span>${n}</span>${note?`<small>${note}</small>`:''}</div>`).join('')+(shown!=null?`<div class="mp-k q"><b>${shown}</b><span>ตรงคำค้น</span><small>แถวที่แสดงในตาราง</small></div>`:'');
const mpCardHead=(t,sub,act)=>`<header class="mp-card-h"><div><h3>${t}</h3><p>${sub}</p></div>${act?`<div class="mp-card-act">${act}</div>`:''}</header>`;
function fillMp(){
  const body=$('#mpBody');if(!body)return;mpSelSync();
  if(mpTab()==='ins'){fillMpIns(body);return}
  if(!S.mpRows){body.innerHTML=`<p class="hint mp-wait"><span class="sk-spin" aria-hidden="true"></span> กำลังโหลด Master Plan ของเดือนนี้…</p>`;$('#mpSum').innerHTML='';return}
  const days=mpDays();const all=mpSorted();const list=all.filter(mpMatch);const ed=can('edit'),del=can('del');
  const today=ymd(new Date());
  /* totals: Flow meter = rows with a meter No.; Ins / Flowcom / Clamp-on = the sum of the column; W and Cal per day */
  const tot={fm:all.filter(r=>String(r.fm||'').trim()).length,ins:all.reduce((a,r)=>a+mpNum(r.ins),0),fc:all.reduce((a,r)=>a+mpNum(r.fc),0),co:all.reduce((a,r)=>a+mpNum(r.co),0)};
  const per=code=>days.map(d=>all.reduce((a,r)=>a+mpTokens((r.days||{})[d.getDate()]).filter(x=>x===code.toUpperCase()).length,0));
  const wDay=per('W'),cDay=per('C');const sum=a=>a.reduce((x,y)=>x+y,0);
  $('#mpSum').innerHTML=mpTiles([[all.length,'แถว','มิเตอร์ / อุปกรณ์'],[tot.fm,'Flow meter','แถวที่มีหมายเลขมิเตอร์'],[tot.ins,'Ins',tot.fc||tot.co?`Flowcom ${tot.fc} · Clamp-on ${tot.co}`:'รวมคอลัมน์ Ins'],[sum(wDay),'W','Cal &amp; Witness','w'],[sum(cDay),'C','Cal.','c']],list.length!==all.length?list.length:null);
  if(!all.length){body.innerHTML=emptyState('ยังไม่มี Master Plan Flow Meter ของเดือนนี้',ed?'กด "+ เพิ่มแถว" แล้วพิมพ์ Request No. Customer Tag … และรหัสงานในช่องวันที่ เช่น D, W, I หรือ D/C/I ระบบบันทึกทันทีเมื่อออกจากช่อง · หรือนำเข้าแผ่นงานของทีมจากไฟล์ Excel':'ยังไม่มีใครกรอกแผนของเดือนนี้',ed?'<button type="button" class="btn primary" data-mp-add="">+ เพิ่มแถวแรก</button> <button type="button" class="btn" data-mp-imp-xlsx="">นำเข้าจาก Excel</button>':'',CAL_ICON);return}
  const dayCls=d=>{const k=ymd(d);return [isOffDay(d)?'off':'',holidayOf(k)?'hol':'',k===today?'today':''].filter(Boolean).join(' ')};
  const dayTitle=d=>holidayOf(ymd(d))||'';
  const cell=(r,f,cls,dl)=>mpCell(r,f,cls,dl,ed);
  const head=`<tr class="mp-tw"><th class="no"></th><th class="rq lbl" title="จำนวน W (Cal &amp; Witness) ต่อวัน">W · Witness</th><th colspan="9"></th>${wDay.map((n,i)=>`<th class="d ${dayCls(days[i])}">${n||''}</th>`).join('')}<th colspan="${del?2:1}"></th></tr>
    <tr class="mp-tc"><th class="no"></th><th class="rq lbl" title="จำนวน C (Cal.) ต่อวัน">Cal</th><th colspan="9"></th>${cDay.map((n,i)=>`<th class="d ${dayCls(days[i])}">${n||''}</th>`).join('')}<th colspan="${del?2:1}"></th></tr>
    <tr class="mp-th"><th class="no">${mpSelAll(list)}</th><th class="rq">Request No.</th><th class="cu">Customer</th><th class="tg">Tag</th><th class="sz">Size<small>Inch</small></th><th class="ty">Type</th><th class="sl">SALE</th>
      <th class="n">Flow meter<small>${tot.fm}</small></th><th class="n">Ins<small>${tot.ins}</small></th><th class="n">Flowcom<small>${tot.fc}</small></th><th class="n">Clamp-on<small>${tot.co}</small></th>
      ${days.map(d=>`<th class="d ${dayCls(d)}"${dayTitle(d)?` title="${esc(dayTitle(d))}"`:''}><small>${EN_DAY[d.getDay()]}</small>${d.getDate()}</th>`).join('')}<th class="rm">Remark</th>${del?'<th class="x"></th>':''}</tr>`;
  const rowsHtml=list.map((r,i)=>{const dv=r.days||{};
    return `<tr class="mp-row${r.sample?' sample':''}${S.mpSel.has(r.id)?' sel':''}" data-mp-row="${esc(r.id)}"><td class="no">${mpSelBox(r,i)}${ed?`<button type="button" class="mp-plus" data-mp-add="${esc(r.id)}" title="เพิ่มมิเตอร์ถัดไปของ Request No. เดียวกัน (ใต้แถวนี้)" aria-label="เพิ่มแถวใต้แถวที่ ${i+1}">+</button>`:''}<span>${i+1}</span></td>
      ${cell(r,'reqNo','rq mono')}${cell(r,'cust','cu')}${cell(r,'tag','tg mono')}${cell(r,'size','sz c','dl-mpSize')}${cell(r,'type','ty','dl-mpType')}${cell(r,'sale','sl','dl-mpSale')}
      ${cell(r,'fm','n c')}${cell(r,'ins','n c')}${cell(r,'fc','n c')}${cell(r,'co','n c')}
      ${days.map(d=>{const n=d.getDate();const v=dv[n]||'';const c=mpCellCls(v);
        return ed?`<td class="d ${dayCls(d)} ${c}"><input class="mp-in d" data-mp="${esc(r.id)}|d|${n}" value="${esc(v)}" list="dl-mpCode" maxlength="24" aria-label="${esc(r.tag||r.reqNo||'แถว '+(i+1))} วันที่ ${n}"></td>`
          :`<td class="d ${dayCls(d)} ${c}">${esc(v)}</td>`}).join('')}
      ${cell(r,'remark','rm')}${del?`<td class="x"><button type="button" class="ph-x2" data-mp-del="${esc(r.id)}" aria-label="ลบแถวที่ ${i+1}">×</button></td>`:''}</tr>`}).join('')
    ||`<tr><td colspan="${13+days.length}" class="hint" style="padding:16px 12px">ไม่พบแถวที่ตรงกับคำค้น</td></tr>`;
  /* the sheet's legend: every code's count per day and in the month */
  const legend=MP_CODES.map(([c,name])=>{const a=per(c);return `<tr><th class="lg">${esc(c)}<span>${esc(name)}</span></th>${a.map((n,i)=>`<td class="d ${dayCls(days[i])}">${n||''}</td>`).join('')}<td class="t">${sum(a)}</td></tr>`}).join('');
  body.innerHTML=`<section class="mp-card">${mpCardHead('Master Plan Flow Meter',`${list.length} แถว · แถวบน W และ Cal ต่อวัน · ช่อง C เขียวอ่อน W เขียว · เสาร์-อาทิตย์สีเทา วันหยุดสีแดง`)}<div class="mp-scroll main"><table class="mp-tbl${ed?' ed':''}"><thead>${head}</thead><tbody>${rowsHtml}</tbody></table></div></section>
    <section class="mp-card">${mpCardHead('สรุปรายวันตามรหัสงาน','จำนวนแต่ละรหัสในช่องวันที่ (D/C/I นับ D, C, I อย่างละครั้ง)')}<div class="mp-scroll"><table class="mp-lg"><thead><tr><th class="lg">รหัส</th>${days.map(d=>`<th class="d ${dayCls(d)}"><small>${EN_DAY[d.getDay()]}</small>${d.getDate()}</th>`).join('')}<th class="t">รวม</th></tr></thead><tbody>${legend}</tbody></table></div>
    <p class="hint mp-note">รหัสในช่องวันที่: ${MP_CODES.map(([c,n])=>`<b>${esc(c)}</b> ${esc(n)}`).join(' · ')} · อื่น ๆ ${MP_OTHER.map(([c,n])=>`<b>${esc(c)}</b> ${esc(n)}`).join(' · ')} · ใส่หลายรหัสในวันเดียวคั่นด้วย / เช่น D/C/I · กด Enter เพื่อลงไปแถวถัดไป</p></section>`;
  mpKeepScroll(body);
  if(S.mpFocus){const f=body.querySelector(`[data-mp="${CSS.escape(S.mpFocus.id)}|${S.mpFocus.f}"]`);S.mpFocus=null;if(f){f.focus();f.scrollIntoView({block:'nearest',inline:'nearest'})}}
}

/* ---------- Master Plan Instrument (the team's sheet "Plan Lab Ins 2026") ----------
   One row per request: Request No. / PN · LAB · Customer · Plant · Tag · Type · Range / Set Point / Nor.Temp (Unit) ·
   Remove · Cal · install (final) · BU (R / I) · รับ/ส่ง · SALE (Contact) · ชื่อลูกค้า · Total Booking · Total cal ·
   day 1…31 (how many are calibrated that day) · Remark. Total cal = the sum of the day counts. */
function fillMpIns(body){
  if(!S.mpRows){body.innerHTML=`<p class="hint mp-wait"><span class="sk-spin" aria-hidden="true"></span> กำลังโหลด Master Plan Instrument ของเดือนนี้…</p>`;$('#mpSum').innerHTML='';return}
  const days=mpDays();const all=mpSorted();const list=all.filter(mpMatch);const ed=can('edit'),del=can('del');
  const today=ymd(new Date());const sum=a=>a.reduce((x,y)=>x+y,0);
  const perDay=days.map(d=>all.reduce((a,r)=>a+mpNum((r.days||{})[d.getDate()]),0));
  const tb=all.reduce((a,r)=>a+mpNum(r.booking),0),tc=all.reduce((a,r)=>a+mpCal(r),0);
  const done=all.filter(r=>/complete/i.test(r.remark||'')).length;
  $('#mpSum').innerHTML=mpTiles([[all.length,'แถว','Request'],[tb,'Total Booking','จำนวนที่จอง'],[tc,'Total cal',tb?`${Math.round(tc/tb*100)}% ของ Booking`:'ผลรวมช่องวันที่','c'],[Math.max(0,tb-tc),'คงเหลือ','Booking − Cal'],[done,'Completed',all.length?`${Math.round(done/all.length*100)}% ของแถว`:'','ok']],list.length!==all.length?list.length:null);
  const imp=ed?'<button type="button" class="btn" data-mp-import="">ดึงจาก Weekly plan instrument</button>':'';
  if(!all.length){body.innerHTML=emptyState('ยังไม่มี Master Plan Instrument ของเดือนนี้',ed?'กด "+ เพิ่มแถว" แล้วกรอก Request No. LAB Customer … และจำนวนที่สอบเทียบในช่องวันที่ หรือดึงรายการที่ลงไว้ใน Weekly plan instrument ของเดือนนี้มาใส่':'ยังไม่มีใครกรอกแผนของเดือนนี้',
    ed?`<button type="button" class="btn primary" data-mp-add="">+ เพิ่มแถวแรก</button> <button type="button" class="btn" data-mp-imp-xlsx="">นำเข้าจาก Excel</button> ${imp}`:'',INS_ICON);return}
  const dayCls=d=>{const k=ymd(d);return [isOffDay(d)?'off':'',holidayOf(k)?'hol':'',k===today?'today':''].filter(Boolean).join(' ')};
  const cell=(r,f,cls,dl)=>mpCell(r,f,cls,dl,ed);
  const head=`<tr class="mp-tc"><th class="no"></th><th class="rq lbl" title="จำนวนที่สอบเทียบต่อวัน">Total ต่อวัน</th><th colspan="15"></th>${perDay.map((n,i)=>`<th class="d ${dayCls(days[i])}">${n||''}</th>`).join('')}<th colspan="${del?2:1}"></th></tr>
    <tr class="mp-th ins"><th class="no">${mpSelAll(list)}</th><th class="rq">Request No. / PN</th><th class="lb">LAB</th><th class="cu">Customer</th><th class="pl">Plant</th><th class="tg">Tag</th><th class="ty">Type</th><th class="rg">Range / Set Point /<br>Nor.Temp (Unit)</th>
      <th class="y dt">Remove</th><th class="y dt">Cal</th><th class="y dt">install<small class="red">(final)</small></th><th class="bu">BU<small>R / I</small></th><th class="rs">รับ/ส่ง</th><th class="sl">SALE<small>(Contact)</small></th><th class="ct">ชื่อลูกค้า</th>
      <th class="n">Total Booking<small>${tb}</small></th><th class="n tcal">Total cal<small>${tc}</small></th>
      ${days.map(d=>`<th class="d ${dayCls(d)}"${holidayOf(ymd(d))?` title="${esc(holidayOf(ymd(d)))}"`:''}><small>${EN_DAY[d.getDay()]}</small>${d.getDate()}</th>`).join('')}<th class="rm">Remark</th>${del?'<th class="x"></th>':''}</tr>`;
  const rowsHtml=list.map((r,i)=>{const dv=r.days||{};const c=mpCal(r);
    return `<tr class="mp-row ins${r.sample?' sample':''}${S.mpSel.has(r.id)?' sel':''}" data-mp-row="${esc(r.id)}"><td class="no">${mpSelBox(r,i)}${ed?`<button type="button" class="mp-plus" data-mp-add="${esc(r.id)}" title="เพิ่มแถวถัดไปของ Request No. เดียวกัน (ใต้แถวนี้)" aria-label="เพิ่มแถวใต้แถวที่ ${i+1}">+</button>`:''}<span>${i+1}</span></td>
      ${cell(r,'reqNo','rq mono')}${cell(r,'lab','lb c','dl-mpLab')}${cell(r,'cust','cu')}${cell(r,'plant','pl')}${cell(r,'tag','tg')}${cell(r,'type','ty','dl-insType')}${cell(r,'range','rg')}
      ${cell(r,'remove','y dt c')}${cell(r,'cal','y dt c')}${cell(r,'install','y dt c')}${cell(r,'bu','bu c','dl-mpBu')}${cell(r,'rs','rs','dl-mpRs')}${cell(r,'sale','sl','dl-mpSale')}${cell(r,'contact','ct')}
      ${cell(r,'booking','n c')}<td class="mp-c n c tcal"><b>${c||''}</b></td>
      ${days.map(d=>{const n=d.getDate();const v=dv[n]||'';
        return ed?`<td class="d ${dayCls(d)}${v?' cnt':''}"><input class="mp-in d" data-mp="${esc(r.id)}|d|${n}" value="${esc(v)}" inputmode="numeric" maxlength="5" aria-label="${esc(r.tag||r.reqNo||'แถว '+(i+1))} วันที่ ${n}"></td>`
          :`<td class="d ${dayCls(d)}${v?' cnt':''}">${esc(v)}</td>`}).join('')}
      ${cell(r,'remark','rm','dl-insRemark')}${del?`<td class="x"><button type="button" class="ph-x2" data-mp-del="${esc(r.id)}" aria-label="ลบแถวที่ ${i+1}">×</button></td>`:''}</tr>`}).join('')
    ||`<tr><td colspan="${21+days.length}" class="hint" style="padding:16px 12px">ไม่พบแถวที่ตรงกับคำค้น</td></tr>`;
  body.innerHTML=`<section class="mp-card">${mpCardHead('Master Plan Instrument',`${list.length} แถว · แถวบน = จำนวนสอบเทียบต่อวัน · Remove / Cal / install สีเหลือง · Total cal สีเขียว`,imp)}<div class="mp-scroll main"><table class="mp-tbl ins${ed?' ed':''}"><thead>${head}</thead><tbody>${rowsHtml}</tbody></table></div>
    <p class="hint mp-note">ช่องวันที่ = จำนวนที่สอบเทียบในวันนั้น · Total cal = ผลรวมของช่องวันที่ · Remove / Cal / install พิมพ์ได้ทั้งวันเดียวหรือช่วง เช่น 13-Aug หรือ 14-16 · กด Enter เพื่อลงไปแถวถัดไป</p></section>`;
  mpKeepScroll(body);
  if(S.mpFocus){const f=body.querySelector(`[data-mp="${CSS.escape(S.mpFocus.id)}|${S.mpFocus.f}"]`);S.mpFocus=null;if(f){f.focus();f.scrollIntoView({block:'nearest',inline:'nearest'})}}
}
/* rows of the month's Weekly plan instrument (task.insItems) that are not in the sheet yet; each keeps src = "<plan id>|<row id>" */
async function mpImportIns(){
  if(!can('edit')||!S.mpRows)return;
  const days=mpDays();const from=ymd(days[0]),to=ymd(days[days.length-1]);
  const tasks=rangeTasks(from,to);if(!tasks){toast('กำลังโหลดแผนงานของเดือนนี้ ลองกดอีกครั้งในอีกสักครู่');return}
  const have=new Set(S.mpRows.map(r=>r.src).filter(Boolean));const add=[];
  tasks.filter(t=>!isLeave(t)&&isWorking(t)).sort(byTime).forEach(t=>insOf(t).forEach(x=>{const src=t.id+'|'+x.id;if(have.has(src))return;
    const k=x.cal||t.date;const n=insNum(x.actual)||insNum(x.plan);
    add.push({reqNo:insReq(t,x),lab:x.lab,cust:t.customer||'',plant:x.plant,tag:x.tag,type:x.type,range:x.range,remove:insDM(x.remove),cal:insDM(x.cal),install:insDM(x.install),
      bu:x.bu,rs:'',sale:t.sale||'',contact:t.contact||'',booking:x.plan,remark:x.remark,days:k>=from&&k<=to&&n?{[parseD(k).getDate()]:String(n)}:{},src})}));
  if(!add.length){toast('ไม่มีรายการใหม่จาก Weekly plan instrument ในเดือนนี้');return}
  if(!await askConfirm(`ดึง ${add.length} รายการจาก Weekly plan instrument?`,add.slice(0,8).map(r=>[r.reqNo,r.cust,r.tag].filter(Boolean).join(' · ')).join('\n')+(add.length>8?`\nและอีก ${add.length-8} รายการ`:''),'ดึงรายการ'))return;
  let order=S.mpRows.reduce((a,r)=>Math.max(a,Number(r.order)||0),0);const now=new Date().toISOString();
  for(const r of add){const id=newId('mp');const row=Object.assign({month:mpMonth(),order:++order},Object.fromEntries(MPI_FIELDS.map(f=>[f,''])),r,{createdAt:now,createdBy:S.me||null});
    S.mpRows.push(Object.assign({id},row));await mpPut(id,row)}
  fillMp();toast(`ดึงแล้ว ${add.length} รายการ`);
}
/* every save redraws the table: it keeps its scroll place (per tab and month); a month opened fresh starts at today's column */
let mpSc={k:'',l:0,t:0};
const mpScKey=()=>mpTab()+'|'+mpMonth();
function mpKeepScroll(body){
  const sc=body.querySelector('.mp-scroll.main');if(!sc)return;
  if(mpSc.k===mpScKey()&&!mpSc.auto){sc.scrollLeft=mpSc.l;sc.scrollTop=mpSc.t;return}
  /* Flow Meter: the pinned columns (#, Request No., Tag) cover the left edge: today goes three days right of them (Instrument opens at the left: its details matter more). Measured again once
     the web font has loaded (the columns get narrower), unless the person has scrolled meanwhile */
  const key=mpScKey();
  const toToday=()=>{const box=document.querySelector('#mpBody .mp-scroll.main');if(!box)return;const th=box.querySelector('thead tr.mp-th th.d.today');
    /* every header cell is sticky to the top; the pinned columns are the ones with a left offset */
    const pinned=[...box.querySelectorAll('thead tr.mp-th th')].map(x=>{const c=getComputedStyle(x);return c.position==='sticky'&&c.left!=='auto'?(parseFloat(c.left)||0)+x.offsetWidth:0}).reduce((a,b)=>Math.max(a,b),0);
    box.scrollLeft=0;box.scrollLeft=th&&mpTab()==='fm'?Math.max(0,th.getBoundingClientRect().left-box.getBoundingClientRect().left-pinned-3*th.offsetWidth):0;mpSc={k:key,l:box.scrollLeft,t:box.scrollTop,auto:true}};
  toToday();
  if(document.fonts&&document.fonts.status!=='loaded')document.fonts.ready.then(()=>{if(mpSc.auto&&mpSc.k===key&&mpScKey()===key)toToday()});
}
/* a scroll that is not the automatic one above is the person's: keep their place from then on */
document.addEventListener('scroll',e=>{const t=e.target;if(!(t.classList&&t.classList.contains('mp-scroll')&&t.classList.contains('main')))return;
  const auto=mpSc.auto&&mpSc.k===mpScKey()&&Math.abs(t.scrollLeft-mpSc.l)<2&&Math.abs(t.scrollTop-mpSc.t)<2;
  mpSc={k:mpScKey(),l:t.scrollLeft,t:t.scrollTop,auto}},true);

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const tb=e.target.closest('[data-mp-tab]');if(tb){if(S.mp.tab!==tb.dataset.mpTab){S.mp.tab=tb.dataset.mpTab;S.anim='view';render()}return}
  const mo=e.target.closest('[data-mp-mon]');if(mo){mpShift(Number(mo.dataset.mpMon));return}
  const ad=e.target.closest('[data-mp-add]');if(ad){mpAdd(ad.dataset.mpAdd||null);return}
  const dl=e.target.closest('[data-mp-del]');if(dl){mpDel(dl.dataset.mpDel);return}
  if(e.target.closest('[data-mp-import]')){mpImportIns();return}
  if(e.target.closest('[data-mp-delbar]'))mpDelBar();
});
document.addEventListener('input',e=>{if(e.target.id==='mp-q'){S.mp.q=e.target.value;fillMp()}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.matches&&t.matches('[data-mp-sel]')){if(t.checked)S.mpSel.add(t.dataset.mpSel);else S.mpSel.delete(t.dataset.mpSel);const tr=t.closest('tr');if(tr)tr.classList.toggle('sel',t.checked);
    const b=$('#mpBody');const all=b&&b.querySelector('[data-mp-selall]');if(all){const boxes=[...b.querySelectorAll('[data-mp-sel]')];const n=boxes.filter(x=>x.checked).length;all.checked=!!boxes.length&&n===boxes.length;all.indeterminate=n>0&&n<boxes.length;all.dataset.some=all.indeterminate?'1':''}mpSelSync();return}
  if(t.matches&&t.matches('[data-mp-selall]')){$('#mpBody').querySelectorAll('[data-mp-sel]').forEach(x=>{x.checked=t.checked;if(t.checked)S.mpSel.add(x.dataset.mpSel);else S.mpSel.delete(x.dataset.mpSel);const tr=x.closest('tr');if(tr)tr.classList.toggle('sel',t.checked)});t.indeterminate=false;t.dataset.some='';mpSelSync();return}
  if(t.id==='mp-month'){if(/^\d{4}-\d{2}$/.test(t.value)){S.mp.month=t.value;S.anim='view';render()}return}
  if(!t.matches||!t.matches('input[data-mp]'))return;
  if(!can('edit')){toast('บัญชีนี้แก้ Master Plan ไม่ได้');return}
  const [id,f,n]=t.dataset.mp.split('|');const r=(S.mpRows||[]).find(x=>x.id===id);if(!r)return;
  const ins=mpTab()==='ins';
  if(f==='d'){
    /* Flow Meter: work codes in the sheet's spelling · Instrument: a count */
    const v=ins?String(t.value).replace(/[^\d.]/g,''):mpCanon(t.value);t.value=v;const days=Object.assign({},r.days||{});if(v)days[n]=v;else delete days[n];
    const td=t.closest('td');if(td){td.classList.remove('w','c','os','sw','di','x','cnt');const c=ins?(v?'cnt':''):mpCellCls(v);if(c)td.classList.add(c)}
    if(JSON.stringify(days)!==JSON.stringify(r.days||{}))mpSave(id,{days});return}
  if(!mpFields().includes(f))return;const v=t.value.trim();if(v!==String(r[f]||''))mpSave(id,{[f]:v});
});
/* Enter = the same column one row down (Shift+Enter: up), like the team's Excel sheet */
document.addEventListener('keydown',e=>{const t=e.target;
  if(e.key==='Enter'&&t.classList&&t.classList.contains('mp-row')&&t.dataset.edit){openTask(t.dataset.edit);return}
  if(e.key!=='Enter'||!t.matches||!t.matches('input[data-mp]'))return;e.preventDefault();
  const [,f,n]=t.dataset.mp.split('|');const tr=t.closest('tr');const next=e.shiftKey?tr.previousElementSibling:tr.nextElementSibling;
  const sel=f==='d'?`[data-mp$="|d|${n}"]`:`[data-mp$="|${f}"]`;const g=next&&next.querySelector(sel);
  if(g){g.focus();g.select()}else t.blur();
});
