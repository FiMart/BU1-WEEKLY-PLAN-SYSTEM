'use strict';
/* BU1 Weekly Plan · Master Plan › นำเข้า Excel, Export Excel, Export PDF (user, 6 Oct 2026: "อัปโหลด excel ได้เพื่อประหยัดเวลาในการกรอกข้อมูล",
   "export ได้ทั้ง pdf และ excel"). Both tabs (Flow Meter / Instrument), one month at a time.
   Import reads the team's own sheets as they are: the header row is the one with "Request No.", columns are matched by name
   (MPX_MAP; order and extra columns do not matter), day columns are the run of 1, 2, 3 … (or dates) in that row or the row
   next to it, merged Request No. / Customer cells are filled down. A preview dialog (#mpxDlg) shows what was read, the tab,
   the month and "เพิ่มต่อท้าย" or "แทนที่ทั้งเดือน" before anything is written. New rows are written first; with "แทนที่"
   the month's old rows are deleted afterwards (by id, BU1 rows only).
   The exported Excel has the same header row, so a file exported here can be edited and imported again. */
const MPX_MAP={
  fm:[['reqNo',/^(request|req\.?\s*no|pn\b|p\/n)/i],['cust',/^(customer|ลูกค้า$)/i],['tag',/^tag/i],['size',/^size|inch/i],['type',/^type/i],['sale',/^sale/i],
    ['fc',/flow\s*com/i],['fm',/^flow\s*-?\s*meter/i],['co',/clamp/i],['ins',/^ins\b/i],['remark',/remark|หมายเหตุ/i]],
  ins:[['reqNo',/^(request|req\.?\s*no|pn\b|p\/n)/i],['lab',/^lab\b/i],['cust',/^customer/i],['plant',/^plant/i],['tag',/^tag/i],['type',/^type/i],
    ['range',/range|set\s*point|nor\.?\s*temp/i],['remove',/^remove/i],['install',/^install/i],['cal',/^cal\b/i],['bu',/^bu\b/i],['rs',/รับ|ส่ง/],
    ['sale',/^sale/i],['contact',/ชื่อลูกค้า|^contact/i],['booking',/booking/i],['_total',/total\s*cal/i],['remark',/remark|หมายเหตุ/i]]};
/* the columns only one of the two sheets has: they decide which sheet a file is */
const MPX_OWN={fm:['size','fm','fc','co','ins'],ins:['lab','plant','range','remove','install','booking','rs','contact','_total']};
const MPX_LABEL={reqNo:'Request No.',cust:'Customer',tag:'Tag',size:'Size',type:'Type',sale:'SALE',fm:'Flow meter',ins:'Ins',fc:'Flowcom',co:'Clamp-on',remark:'Remark',
  lab:'LAB',plant:'Plant',range:'Range',remove:'Remove',install:'install',cal:'Cal',bu:'BU',rs:'รับ/ส่ง',contact:'ชื่อลูกค้า',booking:'Total Booking',_total:'Total cal'};
const MPX={file:'',wb:null,sheets:[],sheet:0,tab:'fm',month:'',mode:'add',parsed:null,have:null,busy:false};

/* ---------- reading a sheet ---------- */
const mpxTxt=v=>v==null?'':v instanceof Date?`${v.getDate()}-${EN_MON[v.getMonth()]}`:typeof v==='number'?String(Math.round(v*10000)/10000):String(v).replace(/\s+/g,' ').trim();
const mpxIsNum=v=>typeof v==='number'||/^\s*\d+(\.\d+)?\s*$/.test(String(v||''));
/* a day-column label: 5 · "5" · "MON 5" · "5-Oct" · a date */
function mpxDay(v){
  if(v instanceof Date)return {d:v.getDate(),m:ymd(v).slice(0,7)};
  if(typeof v==='number')return Number.isInteger(v)&&v>=1&&v<=31?{d:v}:null;
  const s=String(v||'').trim();let m=s.match(/^(\d{1,2})$/)||s.match(/^(\d{1,2})\s*[-\/ ]\s*[A-Za-zก-๙]{3}/)||s.match(/^[A-Za-zก-๙]{2,4}\.?\s+(\d{1,2})$/);
  if(!m)return null;const d=Number(m[1]);return d>=1&&d<=31?{d}:null;
}
/* the header row: the one with "Request No." and the most known column names */
function mpxMatch(tab,label,used){if(!label)return null;const r=MPX_MAP[tab].find(([f,re])=>!used.has(f)&&re.test(label));return r?r[0]:null}
function mpxHeader(aoa,tab){
  let best=null;
  for(let h=0;h<Math.min(aoa.length,40);h++){const row=aoa[h]||[];const used=new Set();const cols={};
    row.forEach((v,c)=>{const f=mpxMatch(tab,mpxTxt(v),used);if(f){used.add(f);cols[f]=c}});
    if(cols.reqNo==null)continue;const n=Object.keys(cols).length;const own=MPX_OWN[tab].filter(f=>cols[f]!=null).length;
    if(!best||n>best.n)best={h,cols,n,own}}
  if(!best)return null;
  /* a name split over two rows ("Size" over "(Inch)", "install" over "(final)"): try the row under / over an empty header cell */
  const used=new Set(Object.keys(best.cols));const taken=new Set(Object.values(best.cols));
  for(const r of [best.h+1,best.h-1]){const row=aoa[r]||[];row.forEach((v,c)=>{if(taken.has(c)||mpxTxt((aoa[best.h]||[])[c])||mpxIsNum(v))return;const f=mpxMatch(tab,mpxTxt(v),used);if(f){used.add(f);taken.add(c);best.cols[f]=c;best.sub=Math.max(best.sub||0,r)}})}
  best.n=Object.keys(best.cols).length;best.own=MPX_OWN[tab].filter(f=>best.cols[f]!=null).length;
  return best;
}
/* the day columns: the longest run of consecutive columns numbered day+1 in the header row or a row next to it */
function mpxDays(aoa,H){
  const taken=new Set(Object.values(H.cols));let best=null;
  for(const r of [H.h,H.h+1,H.h-1,H.h-2]){if(r<0||!aoa[r])continue;const row=aoa[r];let run=[];
    const done=()=>{if(run.length>=5&&(!best||run.length>best.list.length))best={r,list:run};run=[]};
    for(let c=0;c<row.length;c++){const d=taken.has(c)?null:mpxDay(row[c]);
      if(d&&run.length&&run[run.length-1].c===c-1&&d.d===run[run.length-1].d+1)run.push(Object.assign({c},d));
      else{done();if(d)run=[Object.assign({c},d)]}}
    done()}
  if(!best)return {r:-1,list:[],month:''};
  const ms=best.list.map(x=>x.m).filter(Boolean);const month=ms.length?ms.sort((a,b)=>ms.filter(x=>x===b).length-ms.filter(x=>x===a).length)[0]:'';
  return {r:best.r,list:best.list,month};
}
function mpxParse(ws,tab){
  const aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  const H=mpxHeader(aoa,tab);if(!H)return {ok:false,why:'ไม่พบแถวหัวตารางที่มี "Request No."'};
  const D=mpxDays(aoa,H);
  const start=Math.max(H.h,H.sub||0,D.r)+1;
  /* merged cells (Request No. / Customer / SALE over many meters): the value goes to every row of the merge */
  const fieldCols=new Set(Object.values(H.cols));
  (ws['!merges']||[]).forEach(m=>{if(m.s.r<start||!fieldCols.has(m.s.c))return;const v=(aoa[m.s.r]||[])[m.s.c];
    for(let r=m.s.r+1;r<=m.e.r;r++){if(!aoa[r])aoa[r]=[];if(mpxTxt(aoa[r][m.s.c])==='')aoa[r][m.s.c]=v}});
  const fields=tab==='ins'?MPI_FIELDS:MP_FIELDS;const out=[];let skipped=0;
  for(let r=start;r<aoa.length;r++){const row=aoa[r]||[];
    const rec=Object.fromEntries(fields.map(f=>[f,H.cols[f]!=null?mpxTxt(row[H.cols[f]]):'']));
    const days={};D.list.forEach(({c,d})=>{const raw=row[c];let v=tab==='ins'?String(typeof raw==='number'?Math.round(raw*100)/100:mpxTxt(raw)).replace(/[^\d.]/g,''):mpCanon(mpxTxt(raw));if(v)days[d]=v});
    const filled=fields.filter(f=>rec[f]).length,nd=Object.keys(days).length;if(!filled&&!nd)continue;
    /* one lone cell and no day codes: a note or the code legend under the sheet ("D | Disconnect"), not a meter */
    if(filled<=1&&!nd){skipped++;continue}
    /* totals, the code legend under the sheet, a repeated header */
    const first=rec.reqNo||rec.cust||rec.tag;
    if(/^(total|grand total|sum)\b|^(รวม|ยอดรวม)/i.test(first)||/^request/i.test(rec.reqNo)||(tab==='fm'&&MP_CANON[String(rec.reqNo).toUpperCase()]&&!rec.cust&&!rec.tag)||(!rec.reqNo&&!rec.cust&&!rec.tag&&!(tab==='ins'&&rec.plant))){skipped++;continue}
    /* the next meters of a request often leave Request No. / Customer / SALE blank: they belong to the row above */
    const prev=out[out.length-1];
    if(prev&&rec.tag&&!rec.reqNo&&!rec.cust)['reqNo','cust','sale'].concat(tab==='ins'?['plant','contact']:[]).forEach(f=>{if(!rec[f])rec[f]=prev[f]});
    out.push(Object.assign(rec,{days}))}
  return {ok:true,H,D,rows:out,skipped};
}
/* which tab a sheet looks like, and the best sheet for a tab */
function mpxScore(ws){const aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});const f=mpxHeader(aoa,'fm'),i=mpxHeader(aoa,'ins');return {fm:f?f.own*2+f.n:0,ins:i?i.own*2+i.n:0}}

/* ---------- import: pick a file → preview → write ---------- */
function mpImportPick(){
  if(!can('edit')){toast('บัญชีนี้แก้ Master Plan ไม่ได้');return}
  const inp=document.createElement('input');inp.type='file';inp.accept='.xlsx,.xls,.xlsm,.csv';
  inp.onchange=()=>{const f=inp.files&&inp.files[0];if(f)mpImportFile(f)};inp.click();
}
async function mpImportFile(file){
  let X;try{X=await loadXLSX()}catch(e){toast('โหลดตัวอ่าน Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');return}
  let wb;try{wb=X.read(await file.arrayBuffer(),{type:'array',cellDates:true})}catch(e){toast('อ่านไฟล์นี้ไม่ได้ ใช้ไฟล์ .xlsx, .xls หรือ .csv');return}
  const sheets=wb.SheetNames.map(n=>Object.assign({name:n},mpxScore(wb.Sheets[n])));
  const tab=mpTab();const other=tab==='fm'?'ins':'fm';
  /* the sheet that fits the open tab best; if the file only fits the other tab, switch to it */
  let si=sheets.reduce((b,s,i)=>s[tab]>sheets[b][tab]?i:b,0);let useTab=tab;
  if(!sheets[si][tab]){const oi=sheets.reduce((b,s,i)=>s[other]>sheets[b][other]?i:b,0);if(sheets[oi][other]){si=oi;useTab=other}}
  else if(sheets[si][other]>sheets[si][tab]+2)useTab=other;
  Object.assign(MPX,{file:file.name,wb,sheets,sheet:si,tab:useTab,month:'',mode:'add',parsed:null,have:null,busy:false});
  mpxRead();mpxOpen();
}
function mpxRead(){
  const ws=MPX.wb.Sheets[MPX.sheets[MPX.sheet].name];MPX.parsed=mpxParse(ws,MPX.tab);
  if(!MPX.month)MPX.month=(MPX.parsed.ok&&MPX.parsed.D.month)||mpMonth();
  mpxHave();
}
/* the rows already in the chosen tab and month (for "แทนที่ทั้งเดือน") */
function mpxHave(){
  const key=MPX.tab+'|'+MPX.month;MPX.have=null;
  if(S.mpKey===key&&S.mpRows){MPX.have=S.mpRows.slice();return}
  Store.where(MP_ENT[MPX.tab],'month','==',MPX.month).then(l=>{if(MPX.tab+'|'+MPX.month===key){MPX.have=l;mpxFill()}}).catch(()=>{MPX.have=[];mpxFill()});
}
function mpxOpen(){const d=$('#mpxDlg');if(!d)return;mpxFill();if(!d.open)d.showModal()}
function mpxClose(){const d=$('#mpxDlg');if(d&&d.open&&!MPX.busy)d.close();MPX.wb=null}
function mpxFill(){
  const d=$('#mpxDlg');if(!d)return;const P=MPX.parsed;const tabName=MPX.tab==='ins'?'Instrument':'Flow Meter';
  $('#mpxTitle').textContent='นำเข้า Excel · '+tabName;$('#mpxSub').textContent=MPX.file;
  const [y,m]=MPX.month.split('-').map(Number);const monName=`${TH_MON_FULL[m-1]} ${y+543}`;
  const fields=(MPX.tab==='ins'?MPI_FIELDS.concat(['_total']):MP_FIELDS);
  let h=`<div class="mpx-opts">
    ${MPX.sheets.length>1?`<label><span>ชีต</span><select id="mpx-sheet">${MPX.sheets.map((s,i)=>`<option value="${i}"${i===MPX.sheet?' selected':''}>${esc(s.name)}${s.fm||s.ins?'':' (ไม่พบหัวตาราง)'}</option>`).join('')}</select></label>`:''}
    <label><span>นำเข้าเป็น</span><select id="mpx-tab"><option value="fm"${MPX.tab==='fm'?' selected':''}>Flow Meter</option><option value="ins"${MPX.tab==='ins'?' selected':''}>Instrument</option></select></label>
    <label><span>เดือน</span><input type="month" id="mpx-month" value="${esc(MPX.month)}"></label></div>`;
  if(!P.ok){h+=`<div class="mpx-bad"><b>อ่านชีตนี้ไม่ได้</b> ${esc(P.why)} · ตรวจว่าเป็นแผ่นงาน ${esc(tabName)} ที่มีแถวหัวตาราง (Request No., Customer, Tag …)</div>`}
  else{
    const got=fields.filter(f=>P.H.cols[f]!=null),miss=fields.filter(f=>P.H.cols[f]==null);
    const dl=P.D.list;const sample=P.rows.slice(0,6);
    h+=`<div class="mpx-found"><div class="mpx-big"><b>${P.rows.length}</b><span>แถวที่จะนำเข้า</span></div><div class="mpx-big"><b>${dl.length?`${dl[0].d}–${dl[dl.length-1].d}`:'–'}</b><span>คอลัมน์วันที่</span></div><div class="mpx-big"><b>${esc(monName)}</b><span>เข้าเดือน</span></div></div>
      <p class="mpx-cols"><span>อ่านได้</span>${got.map(f=>`<i class="ok">${esc(MPX_LABEL[f])}</i>`).join('')}${miss.length?`<span>ไม่พบ</span>${miss.map(f=>`<i>${esc(MPX_LABEL[f])}</i>`).join('')}`:''}</p>
      ${!dl.length?'<div class="mpx-bad">ไม่พบคอลัมน์วันที่ (1, 2, 3 … หรือวันที่) ในแถวหัวตาราง ข้อมูลรายวันจะไม่ถูกนำเข้า</div>':''}
      ${P.D.month&&P.D.month!==MPX.month?`<div class="mpx-warn">หัวคอลัมน์วันที่ในไฟล์เป็นเดือน ${esc(P.D.month)} แต่เลือกนำเข้าเดือน ${esc(MPX.month)}</div>`:''}
      ${P.skipped?`<p class="hint">ข้ามแถวสรุป / แถวรหัสงาน / แถวที่ไม่มี Request No. Customer และ Tag ${P.skipped} แถว</p>`:''}
      ${sample.length?`<div class="mpx-prev"><table><thead><tr><th>#</th><th>Request No.</th><th>Customer</th><th>Tag</th>${MPX.tab==='ins'?'<th>LAB</th><th>Total Booking</th>':'<th>Size</th><th>Type</th>'}<th>วันที่ในแผน</th></tr></thead><tbody>${sample.map((r,i)=>`<tr><td>${i+1}</td><td class="mono">${esc(r.reqNo)}</td><td>${esc(r.cust)}</td><td class="mono">${esc(r.tag)}</td>${MPX.tab==='ins'?`<td>${esc(r.lab)}</td><td>${esc(r.booking)}</td>`:`<td>${esc(r.size)}</td><td>${esc(r.type)}</td>`}<td class="mpx-days">${Object.entries(r.days).slice(0,8).map(([k,v])=>`<span><b>${k}</b> ${esc(v)}</span>`).join('')}${Object.keys(r.days).length>8?' …':''}</td></tr>`).join('')}</tbody></table>${P.rows.length>sample.length?`<p class="hint">และอีก ${P.rows.length-sample.length} แถว</p>`:''}</div>`:''}`;
    const n=MPX.have==null?null:MPX.have.length;const canDel=can('del');
    h+=`<fieldset class="mpx-mode"><legend>แถวเดิมของ ${esc(tabName)} เดือน ${esc(monName)}: ${n==null?'กำลังตรวจ…':`${n} แถว`}</legend>
      <label><input type="radio" name="mpx-mode" value="add"${MPX.mode==='add'?' checked':''}> <b>เพิ่มต่อท้าย</b> <span>เก็บแถวเดิมไว้ แถวจากไฟล์ต่อท้าย</span></label>
      <label class="${canDel?'':'off'}"><input type="radio" name="mpx-mode" value="replace"${MPX.mode==='replace'?' checked':''}${canDel?'':' disabled'}> <b>แทนที่ทั้งเดือน</b> <span>${canDel?`ลบแถวเดิม${n?` ${n} แถว`:''}ของเดือนนี้ แล้วใช้ข้อมูลจากไฟล์แทน`:'บัญชีนี้ลบแถวไม่ได้'}</span></label></fieldset>`;
  }
  $('#mpxBody').innerHTML=h;
  const ok=P.ok&&P.rows.length&&!MPX.busy&&!(MPX.mode==='replace'&&MPX.have==null);
  $('#mpxGo').disabled=!ok;if(!MPX.busy)$('#mpxGo').textContent=P.ok&&P.rows.length?`นำเข้า ${P.rows.length} แถว`:'นำเข้า';
}
async function mpxRun(){
  const P=MPX.parsed;if(!P||!P.ok||!P.rows.length||MPX.busy||!can('edit'))return;
  const replace=MPX.mode==='replace'&&can('del');const old=replace?(MPX.have||[]):[];
  if(replace&&old.length&&!await askConfirm(`แทนที่ Master Plan ทั้งเดือน?`,`ลบแถวเดิม ${old.length} แถว แล้วใช้ ${P.rows.length} แถวจากไฟล์ ${MPX.file} แทน · ลบแล้วกู้คืนไม่ได้`,'แทนที่'))return;
  const ent=MP_ENT[MPX.tab];const fields=MPX.tab==='ins'?MPI_FIELDS:MP_FIELDS;const now=new Date().toISOString();
  let order=replace?0:(MPX.have||[]).reduce((a,r)=>Math.max(a,Number(r.order)||0),0);
  const list=P.rows.map(r=>({id:newId('mp'),row:Object.assign({month:MPX.month,order:++order},Object.fromEntries(fields.map(f=>[f,''])),r,{createdAt:now,createdBy:S.me||null,importedFrom:MPX.file})}));
  const btn=$('#mpxGo');MPX.busy=true;btn.disabled=true;let done=0,fail=0;S.bulk=true;
  const step=()=>{btn.textContent=`กำลังนำเข้า ${done}/${list.length}…`};step();
  /* four at a time: quick on the central database without a burst of hundreds of requests */
  const pool=async(items,fn)=>{let i=0;await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{while(i<items.length){const it=items[i++];try{await fn(it)}catch(e){fail++;noteWriteError(e)}done++;step()}}))};
  try{
    await pool(list,x=>Store.set(ent,x.id,x.row));
    /* "แทนที่": the old rows go only when every new row is saved */
    if(replace&&!fail){done=0;btn.textContent='กำลังลบแถวเดิม…';await pool(old,r=>Store.del(ent,r.id))}
  }finally{S.bulk=false;MPX.busy=false}
  mpInvalidate();if(!db)localPublish();
  const d=$('#mpxDlg');if(d&&d.open)d.close();MPX.wb=null;
  if(fail)toast(`นำเข้าได้ ${list.length-fail} จาก ${list.length} แถว · บางแถวบันทึกไม่สำเร็จ${replace?' จึงยังไม่ลบแถวเดิม':''}`);
  else toast(`นำเข้าแล้ว ${list.length} แถว${replace&&old.length?` · แทนที่แถวเดิม ${old.length} แถว`:''}`);
  S.mp.tab=MPX.tab;S.mp.month=MPX.month;mpSc={k:'',l:0,t:0};if(S.mpKey===MPX.tab+'|'+MPX.month&&db){/* the live read brings the rows */}
  S.anim='view';render();
}
document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#mpxDlg'))return;
  if(t.id==='mpx-sheet'){MPX.sheet=Number(t.value);MPX.month='';mpxRead();mpxFill()}
  else if(t.id==='mpx-tab'){MPX.tab=t.value;mpxRead();mpxFill()}
  else if(t.id==='mpx-month'){if(/^\d{4}-\d{2}$/.test(t.value)){MPX.month=t.value;mpxHave();mpxFill()}}
  else if(t.name==='mpx-mode'){MPX.mode=t.value;mpxFill()}});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-mpx-close]')){mpxClose();return}
  if(e.target.id==='mpxGo'){mpxRun();return}
  if(e.target.id==='mpxDlg'&&!MPX.busy)mpxClose();
});

/* ---------- export: the open tab and month, every row (the search box does not limit it) ---------- */
const mpFile=ext=>`BU1-Master-Plan-${mpTab()==='ins'?'Instrument':'Flow-Meter'}_${mpMonth()}.${ext}`;
function mpSheetData(){
  const tab=mpTab();const days=mpDays();const all=mpSorted();const [y,m]=mpMonth().split('-').map(Number);
  const title=`BU1 Lab · Master Plan · ${tab==='ins'?'Instrument':'Flow Meter'} · ${EN_MON[m-1].toUpperCase()} ${y} (${TH_MON_FULL[m-1]} ${y+543})`;
  const dn=days.map(d=>d.getDate());
  if(tab==='ins'){
    const head=['#','Request No. / PN','LAB','Customer','Plant','Tag','Type','Range / Set Point / Nor.Temp (Unit)','Remove','Cal','install (final)','BU','รับ/ส่ง','SALE (Contact)','ชื่อลูกค้า','Total Booking','Total cal',...dn,'Remark'];
    const rows=all.map((r,i)=>[i+1,r.reqNo||'',r.lab||'',r.cust||'',r.plant||'',r.tag||'',r.type||'',r.range||'',r.remove||'',r.cal||'',r.install||'',r.bu||'',r.rs||'',r.sale||'',r.contact||'',mpOut(r.booking),mpCal(r)||'',...dn.map(n=>mpOut((r.days||{})[n])),r.remark||'']);
    const perDay=dn.map(n=>all.reduce((a,r)=>a+mpNum((r.days||{})[n]),0));
    const tb=all.reduce((a,r)=>a+mpNum(r.booking),0),tc=all.reduce((a,r)=>a+mpCal(r),0);
    return {tab,title,days,head,rows,first:17,top:[['Total ต่อวัน',perDay]],total:['','รวม','','','','','','','','','','','','','',tb,tc,...perDay.map(n=>n||''),''],
      stats:[[all.length,'แถว'],[tb,'Total Booking'],[tc,'Total cal'],[all.filter(r=>/complete/i.test(r.remark||'')).length,'Completed']]};
  }
  const head=['#','Request No.','Customer','Tag','Size (Inch)','Type','SALE','Flow meter','Ins','Flowcom','Clamp-on',...dn,'Remark'];
  const rows=all.map((r,i)=>[i+1,r.reqNo||'',r.cust||'',r.tag||'',r.size||'',r.type||'',r.sale||'',mpOut(r.fm),mpOut(r.ins),mpOut(r.fc),mpOut(r.co),...dn.map(n=>(r.days||{})[n]||''),r.remark||'']);
  const per=c=>dn.map(n=>all.reduce((a,r)=>a+mpTokens((r.days||{})[n]).filter(x=>x===c.toUpperCase()).length,0));
  const tot={fm:all.filter(r=>String(r.fm||'').trim()).length,ins:all.reduce((a,r)=>a+mpNum(r.ins),0),fc:all.reduce((a,r)=>a+mpNum(r.fc),0),co:all.reduce((a,r)=>a+mpNum(r.co),0)};
  const w=per('W'),c=per('C');const sum=a=>a.reduce((x,y)=>x+y,0);
  return {tab,title,days,head,rows,first:11,top:[['W · Witness',w],['Cal',c]],total:['','รวม','','','','','',tot.fm,tot.ins,tot.fc,tot.co,...dn.map(()=>''),''],
    legend:MP_CODES.map(([k,name])=>{const a=per(k);return [k,name,a,sum(a)]}),
    stats:[[all.length,'แถว'],[tot.fm,'Flow meter'],[tot.ins,'Ins'],[sum(w),'W (Cal & Witness)'],[sum(c),'Cal']]};
}
const mpOut=v=>{const s=String(v==null?'':v).trim();return /^\d+(\.\d+)?$/.test(s)?Number(s):s};
async function mpExportXlsx(btn){
  if(!S.mpRows){toast('กำลังโหลด Master Plan ลองอีกครั้งในอีกสักครู่');return}
  const old=btn.innerHTML;btn.disabled=true;btn.textContent='กำลังสร้างไฟล์…';
  try{
    const X=await loadXLSX();const D=mpSheetData();const wb=X.utils.book_new();const now=new Date();const n=D.head.length;
    const blank=k=>Array(k).fill('');
    const wk=['','',...blank(D.first-2),...D.days.map(d=>EN_DAY[d.getDay()]),''];
    const tops=D.top.map(([l,a])=>['',l,...blank(D.first-2),...a.map(v=>v||''),'']);
    const aoa=[[D.title],[`ส่งออกเมื่อ ${fmtShort(now)} ${be(now)} ${pad(now.getHours())}:${pad(now.getMinutes())} น. · ${D.rows.length} แถว`],isoXlsxRow(D.tab==='ins'?'mpins':'mpfm'),...tops,wk,D.head,...D.rows,D.total];
    const ws=X.utils.aoa_to_sheet(aoa);
    const wFix=D.tab==='ins'?[5,18,7,26,12,18,14,30,9,9,11,6,16,14,14,9,9]:[5,16,26,18,8,14,14,9,6,8,8];
    ws['!cols']=[...wFix,...D.days.map(()=>D.tab==='ins'?5:7),36].map(w=>({wch:w}));
    ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:Math.min(n-1,20)}}];
    X.utils.book_append_sheet(wb,ws,D.tab==='ins'?'Master Plan INS':'Master Plan FM');
    if(D.legend){const lg=X.utils.aoa_to_sheet([[D.title+' · สรุปรายวันตามรหัสงาน'],[],['รหัส','ความหมาย',...D.days.map(d=>d.getDate()),'รวม'],...D.legend.map(([k,name,a,s])=>[k,name,...a.map(v=>v||''),s])]);
      lg['!cols']=[{wch:7},{wch:20},...D.days.map(()=>({wch:4})),{wch:6}];X.utils.book_append_sheet(wb,lg,'สรุปรหัสงาน')}
    await saveFile(mpFile('xlsx'),X.write(wb,{type:'array',bookType:'xlsx'}));
  }catch(e){toast('สร้างไฟล์ Excel ไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่')}
  finally{btn.disabled=false;btn.innerHTML=old}
}
/* PDF: an A3 landscape print page (the browser's "Save as PDF"), the sheet as on screen with the team's colours */
async function mpExportPdf(){
  if(!S.mpRows){toast('กำลังโหลด Master Plan ลองอีกครั้งในอีกสักครู่');return}
  const D=mpSheetData();const now=new Date();const today=ymd(now);const ins=D.tab==='ins';
  const dc=d=>{const k=ymd(d);return [isOffDay(d)?'off':'',holidayOf(k)?'hol':'',k===today?'td':''].filter(Boolean).join(' ')};
  const nd=D.days.length;const fixed=D.first;
  const yellow=ins?new Set([8,9,10]):new Set();
  const th=D.head.map((h,i)=>i>=fixed&&i<fixed+nd?`<th class="d ${dc(D.days[i-fixed])}"><small>${EN_DAY[D.days[i-fixed].getDay()]}</small>${h}</th>`:`<th class="${yellow.has(i)?'y':''}${i===16&&ins?' tc':''}">${esc(h)}</th>`).join('');
  const tops=D.top.map(([l,a])=>`<tr class="top"><th colspan="${fixed}" class="lbl">${esc(l)}</th>${a.map((v,i)=>`<th class="d ${dc(D.days[i])}${v?' on':''}">${v||''}</th>`).join('')}<th></th></tr>`).join('');
  const body=D.rows.map(r=>`<tr>${r.map((v,i)=>{if(i>=fixed&&i<fixed+nd){const s=String(v||'');return `<td class="d ${dc(D.days[i-fixed])} ${ins?(s?'cnt':''):mpCellCls(s)}">${esc(s)}</td>`}
    return `<td class="${yellow.has(i)?'y c':''}${i===0?' c':''}${i===16&&ins?' tc c':''}${!ins&&i>=7&&i<=10||ins&&(i===2||i===11||i===15)?' c':''}">${esc(v)}</td>`}).join('')}</tr>`).join('')
    ||`<tr><td colspan="${D.head.length}" class="empty">ยังไม่มีข้อมูลในเดือนนี้</td></tr>`;
  const foot=`<tr class="tot">${D.total.map((v,i)=>`<td class="${i>=fixed&&i<fixed+nd?'d':''} c">${esc(v)}</td>`).join('')}</tr>`;
  const legend=D.legend?`<h2>สรุปรายวันตามรหัสงาน</h2><table class="mp lg"><thead><tr><th class="lgh">รหัส</th>${D.days.map(d=>`<th class="d ${dc(d)}"><small>${EN_DAY[d.getDay()]}</small>${d.getDate()}</th>`).join('')}<th>รวม</th></tr></thead><tbody>${D.legend.map(([k,name,a,s])=>`<tr><th class="lgh"><b>${esc(k)}</b> ${esc(name)}</th>${a.map((v,i)=>`<td class="d ${dc(D.days[i])} c">${v||''}</td>`).join('')}<td class="c"><b>${s}</b></td></tr>`).join('')}</tbody></table>
    <p class="note">รหัสในช่องวันที่: ${MP_CODES.concat(MP_OTHER).map(([c,n])=>`<b>${esc(c)}</b> ${esc(n)}`).join(' · ')}</p>`:'<p class="note">ช่องวันที่ = จำนวนที่สอบเทียบในวันนั้น · Total cal = ผลรวมของช่องวันที่</p>';
  const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(D.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>@page{size:A3 landscape;margin:7mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:8px/1.3 "IBM Plex Sans Thai","Leelawadee UI",Tahoma,sans-serif;color:#0b1b33;margin:12px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px;padding:10px 12px;background:#eef3fa;border-radius:8px;font-size:13px}.bar button{font:inherit;font-weight:600;padding:6px 14px;border-radius:6px;border:0;background:#1462d0;color:#fff;cursor:pointer}
.hd{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid ${ins?'#9a4fd8':'#0b8fd6'};padding-bottom:5px;margin-bottom:6px}.hd h1{font-size:18px;margin:0;line-height:1.25}.hd p{margin:0;color:#34496b;font-size:10px}
.st{display:flex;gap:6px;margin:0 0 6px}.st span{border:1px solid #c6d3e4;border-radius:5px;padding:2px 8px;font-size:9.5px;color:#34496b}.st b{color:#0b1b33;font-family:"IBM Plex Mono",monospace;margin-right:3px}
table.mp{border-collapse:collapse;width:100%}.mp th,.mp td{border:1px solid #9fb0c6;padding:1.5px 3px;vertical-align:middle;overflow-wrap:anywhere}
.mp thead th{background:${ins?'#eadcf7':'#d9ecf9'};font-weight:600;text-align:center}.mp th.y,.mp td.y{background:#ffff99}.mp th.tc,.mp td.tc{background:#c6e5a8}
.mp .d{width:${ins?'14px':'19px'};text-align:center;font-family:"IBM Plex Mono",monospace;padding:1px}.mp th small{display:block;font-size:6px;font-weight:600;color:#62738f}
.mp .off{background:#d9d9d9}.mp .hol{background:#f8c4c4}.mp thead .td{box-shadow:inset 0 -2px 0 #0b8fd6}
.mp td.w{background:#00e64d;color:#063;font-weight:700}.mp td.c.d,.mp td.c{text-align:center}.mp td.d.c{background:#99f0b8}.mp td.di{color:#b45309;font-weight:600}.mp td.os{background:#cfe7f7}.mp td.sw{background:#e7d6f7}.mp td.cnt{background:#ffff66;color:#1a3fa0;font-weight:700}
.mp tr.top th{background:#fff;font-family:"IBM Plex Mono",monospace;font-weight:600}.mp tr.top th.on{background:#c8f5d5}.mp tr.top th.lbl{text-align:right;color:#1f7a3a}
.mp tr.tot td{background:#eef3fa;font-weight:700}.mp tr{break-inside:avoid}.mp td.empty{text-align:center;padding:8mm;color:#62738f}
h2{font-size:12px;margin:10px 0 4px}.lg .lgh{text-align:left;width:120px;background:#f5f8fd}.note{color:#34496b;font-size:9px;margin:6px 0 0}
.sig{display:flex;gap:40px;margin-top:24px;break-inside:avoid}.sig div{flex:1;text-align:center;font-size:10px}.sig span{display:block;border-top:1px solid #0b1b33;margin:26px 16px 4px}
@media print{.bar{display:none}body{margin:0}}${isoPageCss(ins?'mpins':'mpfm')}</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button><span>ตั้งค่า: กระดาษ A3 · แนวนอน (Landscape) · ติ๊ก Background graphics · เลือกเครื่องพิมพ์ "Save as PDF" เพื่อได้ไฟล์ PDF</span></div>
<div class="hd"><div style="display:flex;gap:10px;align-items:center">${LOGO_MARK}<div><p>BU1 Lab · Master Plan</p><h1>${esc(D.title.replace(/^BU1 Lab · Master Plan · /,''))}</h1></div></div><p>พิมพ์เมื่อ ${fmtShort(now)} ${be(now)} ${pad(now.getHours())}:${pad(now.getMinutes())} น.${S.account&&S.account.name?`<br>ผู้พิมพ์ ${esc(S.account.name)}`:''}</p></div>${isoHeadHtml(ins?'mpins':'mpfm')}
<div class="st">${D.stats.map(([v,l])=>`<span><b>${esc(v)}</b>${esc(l)}</span>`).join('')}</div>
<table class="mp"><thead>${tops}<tr>${th}</tr></thead><tbody>${body}${D.rows.length?foot:''}</tbody></table>
${legend}
<div class="sig"><div><span></span>ผู้จัดทำ</div><div><span></span>หัวหน้า Lab / ผู้ตรวจสอบ</div><div><span></span>ผู้อนุมัติ</div></div>
<script>if(window.opener)window.addEventListener('load',function(){(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},300)})});</script></body></html>`;
  let w=null;try{w=window.open('','_blank')}catch(e){}
  if(w&&w.document){w.document.open();w.document.write(html);w.document.close();return}
  await saveFile(mpFile('html').replace('.html','_A3.html'),html,'ดาวน์โหลดแล้ว เปิดไฟล์แล้วกด "พิมพ์ / บันทึกเป็น PDF" เลือก A3 แนวนอน');
}
document.addEventListener('click',e=>{
  if(e.target.closest('[data-mp-imp-xlsx]')){mpImportPick();return}
  const x=e.target.closest('[data-mp-xlsx]');if(x){mpExportXlsx(x);return}
  if(e.target.closest('[data-mp-pdf]'))mpExportPdf();
});
