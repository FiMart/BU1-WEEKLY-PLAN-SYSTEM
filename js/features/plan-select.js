'use strict';
/* BU1 Weekly Plan · เลือกหลายแผน (user, 9 Oct 2026: "Select ติ๊กเลือกแผนงาน … ย้ายแผนงาน หรือลบแผนงานได้เลยตามที่ติ๊กเลือก")
   "เลือกหลายแผน" in the page actions turns the Weekly Plan cards into tick boxes (a click picks instead of opening);
   the bar at the bottom moves the picked plans to another date or deletes them.
   Move: the earliest picked plan goes to the chosen date and the others keep their distance from it (same day → all to
   that day); the period stays. Needs edit rights; delete needs can('del') and always asks first. Clashes after a move
   show on the board as usual. */
S.pickMode=false;S.picked=new Set();
const canPick=()=>S.canWrite||can('del');
function setPickMode(on){
  S.pickMode=!!on&&canPick();if(!S.pickMode)S.picked.clear();
  document.body.classList.toggle('pick-mode',S.pickMode);S.anim=null;render();
}
/* the picked plans that still exist in the open week (a week change or a delete drops the rest) */
const pickedTasks=()=>[...S.picked].map(id=>S.tasks.find(t=>t.id===id)).filter(Boolean);
function togglePick(id,el){
  if(S.picked.has(id))S.picked.delete(id);else S.picked.add(id);
  if(el)el.classList.toggle('picked',S.picked.has(id));
  renderPickBar();
}
function renderPickBar(){
  const bar=$('#pickBar');if(!bar)return;
  const show=S.pickMode&&S.view==='plan';bar.hidden=!show;document.body.classList.toggle('has-pickbar',show);if(!show)return;
  const list=pickedTasks();S.picked=new Set(list.map(t=>t.id));const n=list.length;
  const days=[...new Set(list.map(t=>t.date))].sort();const shown=S.tasks.filter(planMatch).filter(isWorking);
  const keep=$('#pkDate')?$('#pkDate').value:'';
  bar.innerHTML=`<div class="pk-count"><b>${n}</b> แผนที่เลือก${days.length>1?`<small>${days.length} วัน</small>`:''}</div>
    <button type="button" class="btn sm ghost" data-action="pick-all">เลือกทั้งหมดที่แสดง (${shown.length})</button>
    ${n?'<button type="button" class="btn sm ghost" data-action="pick-none">ล้าง</button>':''}
    <span class="pk-sep" aria-hidden="true"></span>
    ${S.canWrite?`<label class="pk-move"><span>ย้ายไปวันที่</span><input type="date" id="pkDate" value="${esc(keep||(days[0]||''))}"${n?'':' disabled'} aria-label="ย้ายแผนที่เลือกไปวันที่"></label>
    <button type="button" class="btn sm primary" data-action="pick-move"${n?'':' disabled'}>ย้าย</button>`:''}
    ${can('del')?`<button type="button" class="btn sm danger" data-action="pick-del"${n?'':' disabled'}>ลบ ${n||''} แผน</button>`:''}
    <button type="button" class="btn sm" data-action="pick-mode">เสร็จ</button>
    ${S.canWrite?`<div class="pk-color"><span>สีของแผนที่เลือก</span><div class="pc-pick${n?'':' off'}">${colorPickHtml(pickColorNow(list),'','data-pkc')}</div></div>`:''}
    ${days.length>1&&S.canWrite?'<p class="pk-hint">หลายวัน: แผนแรกไปวันที่เลือก แผนอื่นเลื่อนตามจำนวนวันเท่ากัน</p>':''}`;
}
/* the colour the picked plans share ('' = all ตาม Plan No.), or null when they differ / none is picked */
function pickColorNow(list){const l=list.filter(t=>!isLeave(t));if(!l.length)return null;const c=ownColor(l[0]);return l.every(t=>ownColor(t)===c)?c:null}
/* เปลี่ยนสีหลายแผน (user, 9 Oct 2026): the colour goes to every picked plan at once ('' = back to ตาม Plan No.);
   leave stays grey; the selection is kept so the change shows on the ticked cards */
async function recolorPicked(c){
  if(!S.canWrite)return;const color=/^#[0-9a-f]{6}$/i.test(c||'')?String(c).toLowerCase():'';
  const all=pickedTasks();if(!all.length){toast('ติ๊กเลือกแผนก่อน');return}
  const list=all.filter(t=>!isLeave(t)&&ownColor(t)!==color);if(!list.length)return;
  let ok=0;S.bulk=true;
  try{for(const t of list){await Store.update('tasks',t.id,Object.assign({color},meta()));ok++}}
  catch(err){toast(errText(err));noteWriteError(err)}
  finally{S.bulk=false;invalidate();if(!db)localPublish();else render()}
  toast(`${color?'เปลี่ยนสี':'ใช้สีตาม Plan No.'} ${ok} แผนแล้ว${all.some(isLeave)?' · แผนลาใช้สีเทาเสมอ':''}`);
}
document.addEventListener('click',e=>{const s=e.target.closest('#pickBar [data-pkc]');if(s)recolorPicked(s.dataset.pkc)});
document.addEventListener('change',e=>{if(e.target.matches&&e.target.matches('#pickBar [data-pkc-custom]'))recolorPicked(e.target.value)});
async function movePicked(){
  if(!S.canWrite)return;const list=pickedTasks();const to=($('#pkDate')||{}).value;
  if(!list.length)return;if(!to){toast('เลือกวันที่จะย้ายไป');return}
  const base=list.map(t=>t.date).sort()[0];const shift=Math.round((parseD(to)-parseD(base))/864e5);
  if(!shift){toast('แผนที่เลือกอยู่วันนั้นแล้ว');return}
  const many=new Set(list.map(t=>t.date)).size>1;
  if(!await askConfirm('ย้ายแผนงาน?',`ย้าย ${list.length} แผน${many?` เลื่อน${shift>0?'ไป':'ย้อน'} ${Math.abs(shift)} วัน (คงระยะห่างเดิม)`:` ไปวัน${TH_DAY_FULL[parseD(to).getDay()]} ${fmtShort(parseD(to))} ${be(parseD(to))}`}\nช่วงเวลา ทีม และรายละเอียดเหมือนเดิม`,'ย้าย'))return;
  let ok=0;const moved=[];
  for(const t of list){const date=ymd(addDays(parseD(t.date),shift));
    try{await Store.update('tasks',t.id,Object.assign({date},meta()));ok++;moved.push(t.id);flashIds.add(t.id)}catch(err){toast(errText(err));noteWriteError(err);break}}
  S.picked.clear();
  const wk=mondayOf(parseD(to));if(ymd(wk)!==ymd(S.week)){S.week=wk;if(typeof subscribeWeek==='function')subscribeWeek()}
  S.anim='view';render();
  const conf=allConflicts();const clash=moved.filter(id=>conf.has(id)).length;
  toast(`ย้าย ${ok} แผนแล้ว${ok<list.length?` (ไม่สำเร็จ ${list.length-ok})`:''}${clash?` · ⚠ จัดชน ${clash} แผน ตรวจที่การ์ด`:''}`);
}
async function deletePicked(){
  if(!can('del'))return;const list=pickedTasks();if(!list.length)return;
  const names=list.slice(0,8).map(t=>`· ${fmtShort(parseD(t.date))} ${t.planNo||typeLabel(t)}${t.customer?' · '+t.customer:''}`).join('\n')+(list.length>8?`\n… และอีก ${list.length-8} แผน`:'');
  if(!await askConfirm(`ลบ ${list.length} แผนงาน?`,`${names}\nลบแล้วกู้คืนไม่ได้ (ระบบเก็บบันทึกการลบไว้ตาม ISO 9001)`,`ลบ ${list.length} แผน`))return;
  let ok=0;const pids=[],fids=[];
  for(const t of list){
    try{await Store.del('tasks',t.id);known.delete(t.id);ok++;pids.push(...(t.photoIds||[]));fids.push(...(t.fileIds||[]),...reportsOf(t).map(f=>f.id))}
    catch(err){toast(errText(err));noteWriteError(err);break}}
  S.picked.clear();S.anim='view';render();
  if(pids.length)cleanupPhotos(pids);if(fids.length)cleanupFiles(fids);
  toast(`ลบ ${ok} แผนแล้ว${ok<list.length?` (ไม่สำเร็จ ${list.length-ok})`:''}`);
}
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-action^="pick-"]');if(!a)return;
  const act=a.dataset.action;
  if(act==='pick-mode'){setPickMode(!S.pickMode);return}
  if(act==='pick-all'){S.tasks.filter(planMatch).filter(isWorking).forEach(t=>S.picked.add(t.id));render();return}
  if(act==='pick-none'){S.picked.clear();render();return}
  if(act==='pick-move'){movePicked();return}
  if(act==='pick-del'){deletePicked();return}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.pickMode&&!document.querySelector('dialog[open]'))setPickMode(false)});
