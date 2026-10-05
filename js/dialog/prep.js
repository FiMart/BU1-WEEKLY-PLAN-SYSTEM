'use strict';
/* BU1 Weekly Plan · plan drawer: ใบเตรียมงาน (preparation checklist)
   task.prep = [{text, done}]: tools, equipment, spare parts and documents to get ready before going on site.
   Ticked in the form, or straight from the read-only card (saved at once, like the status). */
const PREP_MAX=40;
let prepItems=[];
const prepOf=t=>(Array.isArray(t&&t.prep)?t.prep:[]).filter(p=>p&&String(p.text||'').trim()).map(p=>({text:String(p.text).trim(),done:!!p.done}));
const prepDone=list=>list.filter(p=>p.done).length;
const PREP_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 12.5 2 2 4-4"/></svg>';
/* board card chip: พร้อม done/n */
function prepChip(t){
  const l=prepOf(t);if(!l.length)return '';const d=prepDone(l);
  return `<span class="pcount prep${d===l.length?' ok':''}" title="ใบเตรียมงาน พร้อม ${d}/${l.length} รายการ">${PREP_ICON}${d}/${l.length}</span>`;
}
/* copy-to-LINE text */
function prepText(t){
  const l=prepOf(t);if(!l.length)return '';
  return [`ใบเตรียมงาน (พร้อม ${prepDone(l)}/${l.length}):`].concat(l.map(p=>`${p.done?'☑':'☐'} ${p.text}`)).join('\n');
}
function renderPrep(){
  const el=$('#prepList');if(!el)return;
  el.innerHTML=prepItems.map((p,i)=>`<li class="prep-row${p.done?' on':''}"><label class="check"><input type="checkbox" data-prep-done="${i}"${p.done?' checked':''}><span>${esc(p.text)}</span></label><button type="button" class="prep-x" data-prep-remove="${i}" aria-label="ลบ ${esc(p.text)}">×</button></li>`).join('');
  el.hidden=!prepItems.length;
  $('#prepN').textContent=prepItems.length?`พร้อม ${prepDone(prepItems)}/${prepItems.length} รายการ`:'ยังไม่มีรายการ';
  $('#prepAdd').disabled=prepItems.length>=PREP_MAX;
}
function addPrep(){
  const inp=$('#prepIn');const text=inp.value.trim().replace(/\s+/g,' ').slice(0,120);if(!text)return false;
  if(prepItems.length>=PREP_MAX){toast(`ใส่ได้ไม่เกิน ${PREP_MAX} รายการ`);return false}
  if(!prepItems.some(p=>norm(p.text)===norm(text)))prepItems.push({text,done:false});
  inp.value='';renderPrep();syncPrepLast();return true;
}
/* what readForm saves: the list plus a line still typed in the box */
function prepForSave(){
  const text=$('#prepIn').value.trim().replace(/\s+/g,' ').slice(0,120);
  const out=prepItems.map(p=>({text:p.text,done:!!p.done}));
  if(text&&out.length<PREP_MAX&&!out.some(p=>norm(p.text)===norm(text)))out.push({text,done:false});
  return out;
}
/* the latest other plan of the same job type that has a checklist: its items can be pulled in, unticked */
function prepSource(){
  const tid=$('#f-type').value;if(!tid)return null;
  const hist=S.tasks.concat(ALL.data||[...known.values()]);
  return hist.filter(x=>(!editing||x.id!==editing.id)&&typeIdOf(x)===tid&&prepOf(x).length)
    .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]||null;
}
function syncPrepLast(){
  const b=$('#prepLast');const src=prepSource();
  const fresh=src?prepOf(src).filter(p=>!prepItems.some(x=>norm(x.text)===norm(p.text))):[];
  b.hidden=!fresh.length;
  if(fresh.length)b.textContent=`+ ใช้รายการจากแผนล่าสุดของ “${typeLabel(src)}” (${fresh.length})`;
}
function pullPrepLast(){
  const src=prepSource();if(!src)return;let n=0;
  for(const p of prepOf(src)){if(prepItems.length>=PREP_MAX)break;if(!prepItems.some(x=>norm(x.text)===norm(p.text))){prepItems.push({text:p.text,done:false});n++}}
  renderPrep();syncPrepLast();if(n)toast(`เพิ่ม ${n} รายการจาก${src.planNo?' '+src.planNo:'แผน'} ${fmtDay(src.date)}`);
}
/* fills the form part when the drawer opens */
function loadPrep(v){
  prepItems=prepOf(v);$('#prepIn').value='';renderPrep();syncPrepLast();
  const hist=S.tasks.concat(ALL.data||[...known.values()]);
  $('#dl-prep').innerHTML=[...new Set(hist.flatMap(x=>prepOf(x).map(p=>p.text)))].slice(0,400).map(c=>`<option value="${esc(c)}">`).join('');
}
/* read-only card: the checklist, tickable by anyone who may change the plan */
function prepViewHtml(t,k){
  const l=prepOf(t);const d=prepDone(l);
  const items=l.map((p,i)=>S.canWrite
    ?`<li class="${p.done?'on':''}"><label class="check"><input type="checkbox" data-vprep="${i}"${p.done?' checked':''}><span>${esc(p.text)}</span></label></li>`
    :`<li class="${p.done?'on':''}"><span class="prep-mk" aria-hidden="true">${p.done?'✓':''}</span><span>${esc(p.text)}</span><span class="sr-only">${p.done?'เตรียมแล้ว':'ยังไม่ได้เตรียม'}</span></li>`).join('');
  return `<div class="wide" style="--k:${k}"><dt>ใบเตรียมงาน${l.length?` · <span id="dvPrepN" class="${d===l.length?'ok':''}">พร้อม ${d}/${l.length}</span>`:''}</dt><dd class="${l.length?'dv-prep':'dash'}">${l.length?`<ul>${items}</ul>`:'—'}</dd></div>`;
}
async function saveViewPrep(i,on,box){
  if(!editing||!S.canWrite)return;
  const list=prepOf(editing).map((p,k)=>k===i?{text:p.text,done:on}:p);
  box.disabled=true;
  try{await Store.update('tasks',editing.id,Object.assign({prep:list},meta()));
    editing=Object.assign({},editing,{prep:list});prepItems=list.map(p=>Object.assign({},p));renderPrep();
    box.closest('li').classList.toggle('on',on);
    const n=$('#dvPrepN'),d=prepDone(list);if(n){n.textContent=`พร้อม ${d}/${list.length}`;n.classList.toggle('ok',d===list.length)}
    if(d===list.length&&on)toast('เตรียมของครบทุกรายการแล้ว')}
  catch(err){box.checked=!on;toast(errText(err));noteWriteError(err)}
  finally{box.disabled=false}
}
form.addEventListener('change',e=>{const t=e.target;
  if(t.matches('[data-prep-done]')){const p=prepItems[Number(t.dataset.prepDone)];if(p){p.done=t.checked;renderPrep()}return}
  if(t.matches('[data-vprep]')){saveViewPrep(Number(t.dataset.vprep),t.checked,t);return}
  if(t.id==='f-type')syncPrepLast();
});
form.addEventListener('keydown',e=>{if(e.target.id==='prepIn'&&e.key==='Enter'){e.preventDefault();addPrep()}});
form.addEventListener('click',e=>{
  const rm=e.target.closest('[data-prep-remove]');if(rm){prepItems.splice(Number(rm.dataset.prepRemove),1);renderPrep();syncPrepLast();return}
  if(e.target.closest('#prepAdd')){addPrep();$('#prepIn').focus();return}
  if(e.target.closest('#prepLast'))pullPrepLast();
});
