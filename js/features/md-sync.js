'use strict';
/* BU1 Weekly Plan · plans kept in line with ข้อมูลหลัก (user, 15 Oct 2026: "ข้อมูลบางข้อมูลให้ปรับให้ตรงกับข้อมูลหลัก Detect โดยอัตโนมัติ";
   chose Sale · รถ · หัวข้องาน, at all three moments: while filling / saving a plan (mdFormSync, readForm → mdClean),
   when a name is changed in ข้อมูลหลัก (mdRenamed) and a check of every saved plan (ข้อมูลหลัก › ตรวจแผนให้ตรงข้อมูลหลัก).
   A value is matched loosely (mdKey: case, spaces, dots, dashes, Thai digits; people also without "K." / "คุณ" in front) and
   replaced by the master spelling only when exactly one master entry matches. Leave plans and old GA plates are left alone. */
const MD_THDIG='๐๑๒๓๔๕๖๗๘๙';
const mdKey=(s,person)=>{let k=String(s||'').normalize('NFKC').toLowerCase().trim().replace(/[๐-๙]/g,d=>MD_THDIG.indexOf(d));
  if(person)k=k.replace(/^(k\.|khun\s+|คุณ)\s*/,'');return k.replace(/[\s.\-_·,()\/\\'"]+/g,'')};
/* Sale: ข้อมูลหลัก › รายชื่อ Sale, then the built-in names the form always offers */
function mdSaleNames(){const out=[];sales().map(s=>s.name).concat(DEFAULT_SALES).forEach(n=>{n=String(n||'').trim();if(n&&!out.some(x=>norm(x)===norm(n)))out.push(n)});return out}
function mdSaleName(v){
  const s=String(v||'').trim();if(!s)return null;const names=mdSaleNames();if(names.includes(s))return null;
  const k=mdKey(s,true);const hit=names.filter(n=>mdKey(n,true)===k);return hit.length===1?hit[0]:null;
}
/* รถ: the vehicle's name, or a plate written in its รายละเอียด ("GC · ขจ 8723") */
function mdCarName(v){
  const s=String(v||'').trim();if(!s||FIXED_TRANSPORT.includes(s))return null;const vs=vehicles();if(vs.some(r=>r.name===s))return null;
  const k=mdKey(s);if(!k)return null;
  const hit=vs.filter(r=>mdKey(r.name)===k||String(r.code||'').split(/[·|,;]/).some(c=>{const ck=mdKey(c);return ck.length>=4&&ck===k}));
  return hit.length===1?hit[0].name:null;
}
/* หัวข้องาน: อื่นๆ typed with a master name, or a type id no longer listed whose saved name is; never into a leave type or อื่นๆ */
function mdTypeByKey(name){const k=mdKey(name);if(!k)return null;const h=jobTypes().filter(x=>x&&x.id!=='other'&&!isLeaveId(x.id)&&mdKey(x.name)===k);return h.length===1?h[0]:null}
function mdTypeFix(t){
  if(isLeave(t))return null;const id=typeIdOf(t);
  if(id==='other'){const h=mdTypeByKey(t.jobTypeOther);return h?{type:h,from:t.jobTypeOther}:null}
  if(!jobTypes().some(x=>x&&x.id===id)&&t.jobTypeName){const h=mdTypeByKey(t.jobTypeName);return h?{type:h,from:t.jobTypeName}:null}
  return null;
}
/* one plan → {ch: fields to write, notes: [[what, from, to]]} or null */
function mdFix(t){
  if(!t||isLeave(t))return null;const ch={},notes=[];
  const s=mdSaleName(t.sale);if(s){ch.sale=s;notes.push(['Sale',t.sale,s])}
  if(!legacyGaPlate(t)){let moved=false;const out=carNames(t).map(n=>{const m=mdCarName(n);if(m){moved=true;notes.push(['รถ',n,m]);return m}return n});
    if(moved)ch.transport=out.filter((n,i)=>out.findIndex(x=>norm(x)===norm(n))===i).join(', ')}
  const ty=mdTypeFix(t);if(ty){Object.assign(ch,{jobType:ty.type.id,jobTypeOther:'',jobTypeName:ty.type.name});notes.push(['หัวข้องาน',ty.from,ty.type.name])}
  return notes.length?{ch,notes}:null;
}
const mdClean=v=>{const f=mdFix(v);return f?Object.assign(v,f.ch):v};/* readForm: what is saved is always the master spelling */
const mdNoteText=n=>n.map(([w,a,b])=>`${w} “${a}” → “${b}”`).join(' · ');

/* ---------- 1) the plan form ---------- */
/* opening the form and leaving a field: a loose match is shown as the master value at once, with a line saying what changed */
function mdFormSync(){
  const notes=[];
  const sel=$('#f-sale');const sm=mdSaleName(sel.value);
  if(sm){notes.push(['Sale',sel.value,sm]);if(![...sel.options].some(o=>o.value===sm))sel.insertAdjacentHTML('beforeend',`<option value="${esc(sm)}">${esc(sm)}</option>`);sel.value=sm;syncSaleTel()}
  let car=false;trSlots().forEach(i=>{const m=mdCarName(i.value);if(m){notes.push(['รถ',i.value.trim(),m]);i.value=m;car=true}});
  if(car){syncTrAdd();renderTrGrid()}
  const q=$('#f-typeQ');const qv=q.value.trim();const hit=qv?typeByName(qv):null;
  if(hit&&hit.id!=='other'&&hit.name!==qv){notes.push(['หัวข้องาน',qv,hit.name]);q.value=hit.name;syncTypeQ()}
  mdFormNote(notes);
}
let mdNotes=[];
function mdFormNote(add,reset){
  if(reset)mdNotes=[];(add||[]).forEach(n=>{const i=mdNotes.findIndex(x=>x[0]===n[0]&&x[2]===n[1]);if(i>=0)mdNotes[i]=[n[0],mdNotes[i][1],n[2]];else mdNotes.push(n)});
  const el=$('#f-mdfix');if(!el)return;el.hidden=!mdNotes.length;
  el.innerHTML=mdNotes.length?`<b>ปรับให้ตรงข้อมูลหลักแล้ว</b> ${esc(mdNoteText(mdNotes))} <small>· บันทึกแผนเพื่อเก็บค่านี้</small>`:'';
}
document.addEventListener('change',e=>{const t=e.target;if(!t||!t.id||!dlg.open)return;
  if(t.id==='f-transport'||t.id==='f-transport2'||t.id==='f-typeQ'||t.id==='f-sale')mdFormSync()});

/* ---------- 2) a name changed in ข้อมูลหลัก ---------- */
const mdRows=async()=>{const all=await Store.all('tasks');return all};
async function mdRenamed(kind,old,nw){
  old=String(old||'').trim();nw=String(nw||'').trim();
  if(!S.canWrite||!can('master')||!old||!nw||old===nw)return;
  let tasks;try{tasks=await quietly(mdRows)}catch(e){return}
  const k=norm(old);const sale=kind==='sale';
  const hits=tasks.filter(t=>!isLeave(t)&&(sale?norm(t.sale)===k:!legacyGaPlate(t)&&carNames(t).some(n=>norm(n)===k)));
  const jobs=sale?(S.jobs||[]).filter(j=>norm(j.sale)===k):[];
  if(!hits.length&&!jobs.length)return;
  const what=sale?'Sale':'รถ';
  if(!await askConfirm(`เปลี่ยน${what}ในแผนงานด้วย?`,`มีแผนงาน ${hits.length} แผน${jobs.length?` และใบจอง ${jobs.length} ใบ`:''} ที่ใช้${what} “${old}” · เปลี่ยนเป็น “${nw}” ตามข้อมูลหลักทั้งหมดหรือไม่`,'เปลี่ยนทั้งหมด'))return;
  const items=hits.map(t=>({coll:'tasks',id:t.id,ch:sale?{sale:nw}:{transport:carNames(t).map(n=>norm(n)===k?nw:n).filter((n,i,a)=>a.findIndex(x=>norm(x)===norm(n))===i).join(', ')}}))
    .concat(jobs.map(j=>({coll:'jobs',id:j.id,ch:{sale:nw}})));
  const r=await mdApply(items);
  toast(r.bad?`เปลี่ยนแล้ว ${r.ok} รายการ · ไม่สำเร็จ ${r.bad} รายการ (ลองตรวจอีกครั้งที่ ข้อมูลหลัก › ตรวจแผนให้ตรงข้อมูลหลัก)`:`เปลี่ยน “${old}” เป็น “${nw}” ในแผนงานแล้ว ${r.ok} รายการ`);
}
async function mdApply(items,onStep){
  let ok=0,bad=0;
  for(const [i,it] of items.entries()){if(onStep)onStep(i,items.length);
    try{await Store.update(it.coll,it.id,Object.assign({},it.ch,meta()));ok++}catch(err){bad++;noteWriteError(err)}}
  return {ok,bad};
}

/* ---------- 3) check every saved plan (ข้อมูลหลัก section) ---------- */
const mds={busy:false,list:null,n:0,sel:new Set(),at:''};
async function mdScan(){
  if(mds.busy)return;mds.busy=true;render();
  try{
    const tasks=await Store.all('tasks');const list=[];
    tasks.forEach(t=>{const f=mdFix(t);if(f)list.push({coll:'tasks',id:t.id,date:t.date||'',name:[t.planNo,typeLabel(t)].filter(Boolean).join(' · '),cust:t.customer||'',ch:f.ch,notes:f.notes})});
    (S.jobs||[]).forEach(j=>{const s=mdSaleName(j.sale);if(s)list.push({coll:'jobs',id:j.id,date:j.wantFrom||'',name:`ใบจอง ${j.jobNo}${j.planNo?' · '+j.planNo:''}`,cust:j.customer||'',ch:{sale:s},notes:[['Sale',j.sale,s]]})});
    list.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    mds.list=list;mds.n=tasks.length;mds.sel=new Set(list.map(x=>x.coll+'|'+x.id));mds.at=new Date().toISOString();
  }catch(err){toast(errText(err));mds.list=null}
  finally{mds.busy=false;render()}
}
async function mdApplyPicked(btn){
  const items=(mds.list||[]).filter(x=>mds.sel.has(x.coll+'|'+x.id));if(!items.length||mds.busy)return;
  if(!await askConfirm('ปรับแผนงานให้ตรงข้อมูลหลัก',`ปรับ ${items.length} รายการตามที่แสดง (Sale · รถ · หัวข้องาน) · ประวัติการแก้ไขของแต่ละแผนบันทึกไว้`,`ปรับ ${items.length} รายการ`))return;
  mds.busy=true;const old=btn.textContent;
  const r=await mdApply(items,(i,n)=>{btn.textContent=`กำลังปรับ ${i+1}/${n}…`});
  mds.busy=false;btn.textContent=old;
  toast(r.bad?`ปรับแล้ว ${r.ok} รายการ · ไม่สำเร็จ ${r.bad} รายการ`:`ปรับแผนงานให้ตรงข้อมูลหลักแล้ว ${r.ok} รายการ`);
  mdScan();
}
function mdSyncSection(){
  const L=mds.list;const n=L?L.length:null;
  const row=x=>{const k=x.coll+'|'+x.id;return `<tr><td><input type="checkbox" data-mds-pick="${esc(k)}"${mds.sel.has(k)?' checked':''} aria-label="เลือก ${esc(x.name)}"></td>
    <td>${x.date?esc(fmtDayY(x.date)):'—'}</td><td><b>${esc(x.name)}</b>${x.cust?`<span class="sub">${esc(x.cust)}</span>`:''}</td>
    <td>${x.notes.map(([w,a,b])=>`<div class="mds-ch"><span class="mds-w">${esc(w)}</span><s>${esc(a)}</s> → <b>${esc(b)}</b></div>`).join('')}</td></tr>`};
  return {id:'mdsync',title:'ตรวจแผนให้ตรงข้อมูลหลัก',sub:'Sale · รถ · หัวข้องาน',count:n==null?'–':n,warn:!!n,
    desc:'หาแผนงานที่ Sale · รถ · หัวข้องาน สะกดต่างจากข้อมูลหลักเล็กน้อย (ตัวพิมพ์เล็ก-ใหญ่ เว้นวรรค จุด ขีด เลขไทย K. / คุณ) แล้วปรับเป็นชื่อในข้อมูลหลัก · ระบบปรับให้เองตอนกรอกแผน และถามก่อนเมื่อแก้ชื่อ Sale / รถ ในข้อมูลหลัก · หัวข้องาน "อื่นๆ" ที่พิมพ์ตรงกับหัวข้องานในข้อมูลหลักจะเปลี่ยนเป็นหัวข้องานนั้น · ไม่แตะแผนลา',
    body:`<div class="mds-bar"><button type="button" class="btn primary" data-mds-scan${mds.busy||!can('master')?' disabled':''}>${mds.busy?'กำลังตรวจ…':L?'ตรวจอีกครั้ง':'ตรวจแผนงานทั้งหมด'}</button>
      ${L?`<span class="hint">ตรวจ ${mds.n} แผน · ${esc(jbWhen(mds.at))}</span>`:''}<span class="grow"></span>
      ${n?`<button type="button" class="btn" data-mds-all>${mds.sel.size===n?'ไม่เลือกทั้งหมด':'เลือกทั้งหมด'}</button><button type="button" class="btn primary" data-mds-apply${mds.sel.size&&S.canWrite?'':' disabled'}>ปรับที่เลือก (${mds.sel.size})</button>`:''}</div>
      ${L==null?'':n?`<div class="scroll-x plain md-scroll"><table class="mini mds-table"><thead><tr><th></th><th>วันที่</th><th>แผนงาน / ใบจอง</th><th>ปรับเป็น</th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>`
        :'<p class="mds-ok">✓ แผนงานทั้งหมดตรงกับข้อมูลหลักแล้ว</p>'}`};
}
document.addEventListener('click',e=>{const t=e.target;
  if(t.closest('[data-mds-scan]')){if(can('master'))mdScan();return}
  if(t.closest('[data-mds-all]')){const all=(mds.list||[]).map(x=>x.coll+'|'+x.id);mds.sel=mds.sel.size===all.length?new Set():new Set(all);render();return}
  const ap=t.closest('[data-mds-apply]');if(ap&&can('master')){mdApplyPicked(ap);return}
});
document.addEventListener('change',e=>{const p=e.target.closest&&e.target.closest('[data-mds-pick]');if(!p)return;const k=p.dataset.mdsPick;p.checked?mds.sel.add(k):mds.sel.delete(k);render()});
