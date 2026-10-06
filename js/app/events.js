'use strict';
/* BU1 Weekly Plan · global event handlers */
/* ---------- events ---------- */
function goView(v){if(S.view!==v){S.view=v;S.anim='view';rememberView(v)}render()}
function setMonth(d){S.month=firstOfMonth(d);S.anim='view';render()}
/* phone bottom bar: "เพิ่มเติม" opens the other pages */
function bnMore(open){const s=$('#bnSheet'),b=document.querySelector('.bn-more');if(!s||!b)return;s.hidden=!open;b.setAttribute('aria-expanded',String(open))}
document.addEventListener('keydown',e=>{if(e.key==='Escape')bnMore(false)});
document.addEventListener('click',e=>{
  const t=e.target;
  if(t.closest('[data-action="bn-more"]')){bnMore($('#bnSheet').hidden);return}
  if(!t.closest('#bnSheet'))bnMore(false);
  const tab=t.closest('[data-view]');if(tab){bnMore(false);goView(tab.dataset.view);window.scrollTo(0,0);return}
  const go=t.closest('[data-go]');if(go){goView(go.dataset.go);window.scrollTo(0,0);return}
  if(!t.closest('#copyMenu'))$('#copyMenu').open=false;
  const md=t.closest('[data-md]');if(md){if(S.md!==md.dataset.md){S.md=md.dataset.md;S.mdq='';remember('bu1wp.md',S.md);S.anim='view';render();const b=$('#view .md-body');if(b&&window.innerWidth<=900)b.scrollIntoView({block:'start'})}return}
  const gc=t.closest('[data-gchip]');if(gc){const k=gc.dataset.gchip;S.pf.groups=!k?[]:S.pf.groups.includes(k)?S.pf.groups.filter(x=>x!==k):S.pf.groups.concat(k);S.anim='view';render();return}
  const gw=t.closest('[data-goweek]');if(gw){S.week=mondayOf(parseD(gw.dataset.goweek));S.view='plan';rememberView('plan');S.anim='view';subscribeWeek();window.scrollTo(0,0);return}
  const pe=t.closest('[data-proj-edit]');if(pe){S.projEdit=pe.dataset.projEdit;render();setTimeout(()=>{const f=$('#pj-name');if(f){f.focus();f.scrollIntoView({block:'center'})}},30);return}
  const pdb=t.closest('[data-pday]');if(pdb){S.pday=pdb.dataset.pday;S.anim=null;render();return}
  const mdb=t.closest('[data-mday]');if(mdb){S.mday=mdb.dataset.mday;S.anim=null;render();return}
  const ed=t.closest('[data-edit]');if(ed){openTask(ed.dataset.edit);return}
  const a=t.closest('[data-action]');if(!a)return;
  switch(a.dataset.action){
    case 'prev':S.week=addDays(S.week,-7);if(S.pday)S.pday=ymd(addDays(parseD(S.pday),-7));S.anim='prev';subscribeWeek();break;
    case 'next':S.week=addDays(S.week,7);if(S.pday)S.pday=ymd(addDays(parseD(S.pday),7));S.anim='next';subscribeWeek();break;
    case 'pday-prev':stepPlanDay(-1);break;
    case 'pday-next':stepPlanDay(1);break;
    case 'mday-prev':stepMonthDay(-1);break;
    case 'mday-next':stepMonthDay(1);break;
    case 'thisweek':{const w=mondayOf(new Date());S.anim=w>S.week?'next':w<S.week?'prev':'view';S.week=w;subscribeWeek();break}
    case 'mprev':setMonth(new Date(S.month.getFullYear(),S.month.getMonth()-1,1));break;
    case 'mnext':setMonth(new Date(S.month.getFullYear(),S.month.getMonth()+1,1));break;
    case 'mthis':setMonth(new Date());break;
    case 'add':if(S.canWrite)openTask(null,{date:a.dataset.date,type:a.dataset.type,customer:a.dataset.cust,period:a.dataset.period,staff:[...new Set([...(a.dataset.staff?[a.dataset.staff]:[]),...(S.view==='people'?S.sel:[])])]});break;
    case 'edit-task':setMode('edit');setTimeout(()=>{const f=$('#f-type');if(f)f.focus()},30);break;
    case 'add-vehicle':if(can('master'))addVehicle(a);break;
    case 'copy-card':if(editing)copyText(cardText(editing),'คัดลอกแผนแล้ว วางใน LINE ได้เลย');break;
    case 'save-vreason':{const r=dlg.querySelector('input[name="v-status"]:checked');if(r&&editing)saveViewStatus(r.value,$('#v-reason').value.trim());break}
    case 'copy-day':$('#copyMenu').open=false;copyText(dayText(a.dataset.date),`คัดลอกแผน${fmtDay(a.dataset.date)}แล้ว วางใน LINE ได้เลย`);break;
    case 'shot':takeShot(a);break;
    case 'dprev':dashStep(-1);break;
    case 'dnext':dashStep(1);break;
    case 'dthis':dashStep(0);break;
    case 'dash-print':dashPrint();break;
    case 'dash-xlsx':dashXlsx(a);break;
    case 'jump-conf':{const s=$(a.dataset.target||'#dashConf');if(s)s.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'});break}
    case 'theme':toggleTheme();break;
    case 'side-mini':{const on=!document.body.classList.contains('mini');document.body.classList.toggle('mini',on);remember('bu1wp.mini',on?'1':'0');setTimeout(moveInd,240);break}
    case 'add-sel':if(S.canWrite)openTask(null,{staff:[...S.sel]});break;
    case 'clear-sel':S.sel.clear();syncRowPicks();break;
    case 'close':dlg.close();break;
    case 'del-task':deleteTask();break;
    case 'dup-task':duplicateTask();break;
    case 'copy-range':copyRange();break;
    case 'del-row':deleteRow(a);break;
    case 'del-sale':saveCfg({sales:(S.cfg.sales||[]).filter((_,i)=>i!==Number(a.dataset.idx))},'ลบ Sale แล้ว');break;
    case 'del-type':{const i=Number(a.dataset.idx);const l=typesCopy();if(!l[i]||SYSTEM_TYPES.has(l[i].id))break;if(!arm(a,'type/'+l[i].id,'ลบ'))break;saveCfg({jobTypes:l.filter((_,j)=>j!==i)},`ลบ ${l[i].name} แล้ว แผนเก่ายังแสดงชื่อเดิม`);break}
    case 'del-pos':{const l=positions().slice();l.splice(Number(a.dataset.idx),1);saveCfg({positions:l},'ลบตำแหน่งแล้ว');break}
    case 'clear-sample':clearSample(a);break;
    case 'xlsx':exportXlsx(a);break;
    case 'report':exportReport();break;
    case 'proj-new':S.projEdit='new';render();setTimeout(()=>{const f=$('#pj-name');if(f)f.focus()},30);break;
    case 'proj-cancel':S.projEdit=null;render();break;
    case 'proj-del':{if(!arm(a,'proj/'+S.projEdit,'ลบโปรเจกต์','กดอีกครั้งเพื่อลบ'))break;const id=S.projEdit;Store.del('projects',id).then(()=>{S.projEdit=null;toast('ลบโปรเจกต์แล้ว');render()}).catch(err=>{toast(errText(err));noteWriteError(err)});break}
    case 'srch-reload':ALL.stale=true;fillSearch();break;
  }
});
$('#optSun').addEventListener('change',e=>{S.showSun=e.target.checked;remember('bu1wp.sun7',S.showSun?'1':'0');S.anim='view';render()});
function jumpWeek(v){if(!v)return;const d=parseD(v);const m=mondayOf(d);
  if(d.getDay()!==1)toast(`เปิดสัปดาห์ ${weekName(m)} (เริ่มวันจันทร์ ${fmtShort(m)})`);
  S.anim=m>S.week?'next':m<S.week?'prev':'view';S.week=m;subscribeWeek()}
$('#wkJump').addEventListener('change',e=>jumpWeek(e.target.value));
$('#pf-q').addEventListener('input',e=>{S.pf.q=e.target.value;render()});
$('#pf-type').addEventListener('change',e=>{S.pf.type=e.target.value;render()});
$('#pf-staff').addEventListener('change',e=>{S.pf.staff=e.target.value;render()});
$('#pf-avail').addEventListener('change',e=>{S.showAvail=e.target.checked;remember('bu1wp.avail',S.showAvail?'1':'0');render()});
$('#pf-busy').addEventListener('change',e=>{S.pf.busy=e.target.checked;remember('bu1wp.pfbusy',S.pf.busy?'1':'0');S.anim='view';render()});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset)return;
  if(t.dataset.rowPick!==undefined){if(t.checked)S.sel.add(t.dataset.rowPick);else S.sel.delete(t.dataset.rowPick);syncRowPicks();return}
  if(t.dataset.teamPick!==undefined){t.dataset.teamPick.split(',').filter(Boolean).forEach(i=>{if(t.checked)S.sel.add(i);else S.sel.delete(i)});syncRowPicks()}
});
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='srch-q'){S.srch.q=t.value;fillSearch()}
  if(t.id==='md-q'){S.mdq=t.value;filterMd()}
});
document.addEventListener('change',async e=>{const t=e.target;
  if(t.name==='srch-by'){S.srch.by=t.value;fillSearch();return}
  if(t.id==='wkJump2'){jumpWeek(t.value);return}
  if(t.name==='pm-mode'){S.pmode=t.value;remember('bu1wp.pmode',t.value);S.anim='view';render();return}
  if(t.name==='pf-mode'){S.pmode=t.value;remember('bu1wp.pmode',t.value);S.anim='view';render();return}
  if(t.name==='pf-by'){S.pf.by=t.value;S.pf.groups=[];remember('bu1wp.by',t.value);S.anim='view';render();return}
  if(t.name==='v-status'&&editing){const val=t.value;
    if(val==='notdone'){openNcr(ncrOfTask(editing)?ncrOfTask(editing).id:null,editing);return}/* ไม่เสร็จ is saved together with its NCR */
    if(NEEDS_REASON.has(val)){const w=$('#vReason');w.hidden=false;$('#vReasonLbl').textContent=reasonLabel(val);$('#vReasonSave').textContent=`บันทึกสถานะ “${stTh(val)}”`;
      const ta=$('#v-reason');if(editing.status!==val)ta.value='';setTimeout(()=>ta.focus(),30);return}
    saveViewStatus(val,'');return}
  if(t.id==='srch-from'||t.id==='srch-to'){S.srch[t.id.slice(5)]=t.value;fillSearch();return}
  if(t.name==='dash-mode'){S.dash.mode=t.value;remember('bu1wp.dash',t.value);S.anim='view';render();return}
  if(t.dataset.field&&t.dataset.coll){
    let v=t.type==='checkbox'?t.checked:t.value;
    if(t.dataset.field==='order')v=v===''?null:Number(v);
    if(t.dataset.field==='name'&&!String(v).trim()){toast('ชื่อต้องไม่ว่าง');render();return}
    try{await Store.update(t.dataset.coll,t.dataset.id,{[t.dataset.field]:typeof v==='string'?v.trim():v});toast('บันทึกแล้ว')}catch(err){toast(errText(err));noteWriteError(err)}
    return;
  }
  if(t.dataset.typeIdx!==undefined){const l=typesCopy();const i=Number(t.dataset.typeIdx);if(!l[i])return;const f=t.dataset.typeField;
    const v=f==='active'?t.checked:f==='color'?safeColor(t.value):t.value.trim();if(f==='name'&&!v){toast('ชื่อประเภทต้องไม่ว่าง');render();return}
    l[i][f]=v;saveCfg({jobTypes:l},'บันทึกแล้ว');return}
  if(t.dataset.posIdx!==undefined){const l=positions().slice();const v=t.value.trim();if(!v){toast('ชื่อตำแหน่งต้องไม่ว่าง');render();return}l[Number(t.dataset.posIdx)]=v;saveCfg({positions:l},'บันทึกแล้ว');return}
  if(t.dataset.saleIdx!==undefined){const list=(S.cfg.sales||[]).map(s=>Object.assign({},s));const i=Number(t.dataset.saleIdx);if(!list[i])return;
    const v=t.value.trim();if(t.dataset.saleField==='name'&&!v){toast('ชื่อ Sale ต้องไม่ว่าง');render();return}
    list[i][t.dataset.saleField]=v;saveCfg({sales:list},'บันทึกแล้ว')}
});
document.addEventListener('submit',async e=>{const f=e.target;if(!f.dataset)return;
  if(f.id==='projForm'){e.preventDefault();
    const fd=new FormData(f);const name=String(fd.get('name')||'').trim();const n=Number(fd.get('headcount'));const from=String(fd.get('from')||''),to=String(fd.get('to')||'');
    const err=m=>{const el=$('#pj-err');el.textContent=m;el.hidden=false};
    if(!name)return err('ใส่ชื่องาน');if(!(n>=1))return err('ใส่จำนวนคนอย่างน้อย 1 คน');if(!from||!to)return err('เลือกวันเริ่มและวันจบ');if(to<from)return err('วันจบต้องไม่ก่อนวันเริ่ม');
    const id=f.dataset.id==='new'?newId('p'):f.dataset.id;const old=S.projects.find(x=>x.id===id)||{};
    try{await Store.set('projects',id,{name,headcount:n,from,to,note:String(fd.get('note')||'').trim(),workSun:!!fd.get('workSun'),sample:!!old.sample,createdAt:old.createdAt||new Date().toISOString(),...meta()});
      S.projEdit=null;toast(`บันทึก ${name} แล้ว`);if(from.slice(0,7)!==ymd(S.month).slice(0,7)&&!(from<=ymd(S.month)&&to>=ymd(S.month)))S.month=firstOfMonth(parseD(from));render()}
    catch(ex){err(errText(ex));noteWriteError(ex)}
    return}
  if(f.dataset.addSale!==undefined){e.preventDefault();
    const fd=new FormData(f);const name=String(fd.get('name')||'').trim();const tel=String(fd.get('tel')||'').trim();if(!name)return;
    const list=(S.cfg.sales||[]).slice();if(list.some(s=>norm(s.name)===norm(name))){toast(`มี ${name} อยู่แล้ว`);return}
    list.push({name,tel});f.reset();saveCfg({sales:list},`เพิ่ม ${name} แล้ว`);return}
  if(f.dataset.addType!==undefined){e.preventDefault();
    const fd=new FormData(f);const name=String(fd.get('name')||'').trim();if(!name)return;const l=typesCopy();
    if(l.some(t=>norm(t.name)===norm(name))){toast(`มี ${name} อยู่แล้ว`);return}
    l.splice(Math.max(0,l.findIndex(t=>t.id==='leave')),0,{id:newId('ty'),name,color:safeColor(String(fd.get('color'))),active:true});f.reset();saveCfg({jobTypes:l},`เพิ่ม ${name} แล้ว`);return}
  if(f.dataset.addPos!==undefined){e.preventDefault();
    const name=String(new FormData(f).get('name')||'').trim();if(!name)return;const l=positions().slice();if(l.includes(name)){toast(`มี ${name} อยู่แล้ว`);return}
    l.push(name);f.reset();saveCfg({positions:l},`เพิ่ม ${name} แล้ว`);return}
  if(f.dataset.bulk!==undefined){e.preventDefault();
    const have=new Set(S.staff.map(s=>norm(s.name)));let order=Math.max(0,...S.staff.map(x=>Number(x.order)||0));
    const rowsIn=String(new FormData(f).get('rows')||'').split(/\r?\n/).map(l=>l.split(/\t|,/).map(x=>x.trim())).filter(r=>r[0]);
    const todo=[];for(const [name,role] of rowsIn){const k=norm(name);if(have.has(k))continue;have.add(k);todo.push({name:name.slice(0,80),role:roleName(role).slice(0,80)})}
    if(!todo.length){toast(rowsIn.length?'ทุกชื่อมีอยู่ในระบบแล้ว':'วางรายชื่อก่อน หนึ่งคนต่อหนึ่งบรรทัด');return}
    const btn=f.querySelector('button[type=submit]');btn.disabled=true;let n=0;
    try{for(const p of todo){toast(`กำลังเพิ่มรายชื่อ ${n+1}/${todo.length}…`);await Store.set('staff',newId('s'),Object.assign(p,{order:++order,active:true,createdAt:new Date().toISOString()}));n++}
      f.reset();toast(`เพิ่ม ${n} คนแล้ว${rowsIn.length>n?` (ข้ามชื่อซ้ำ ${rowsIn.length-n})`:''}`)}
    catch(err){toast(`เพิ่มได้ ${n} คน แล้วหยุด: ${errText(err)}`);noteWriteError(err)}
    finally{btn.disabled=false}
    return}
  if(f.dataset.add){e.preventDefault();
    const c=f.dataset.add;const fd=new FormData(f);const name=String(fd.get('name')||'').trim();if(!name)return;
    const isV=c==='vehicle';const coll=isV?'resources':'staff';const list=isV?vehicles():S.staff;const order=Math.max(0,...list.map(x=>Number(x.order)||0))+1;
    if(isV&&list.some(v=>norm(v.name)===norm(name))){toast(`มีรถ ${name} อยู่แล้ว`);return}
    const data=isV?{name,code:String(fd.get('code')||'').trim(),group:String(fd.get('group')||'').trim().slice(0,60),kind:'vehicle',order,active:true}:{name,role:String(fd.get('role')||'').trim(),order,active:true};
    try{await Store.set(coll,newId(isV?'r':'s'),Object.assign(data,{createdAt:new Date().toISOString()}));f.reset();toast(`เพิ่ม “${name}” แล้ว`)}catch(err){toast(errText(err));noteWriteError(err)}
  }
});
let toastT=null;
function toast(msg){
  const el=$('#toast');const bad=/ไม่สำเร็จ|ไม่ได้|ต้องไม่ว่าง|หยุด|ขาด|ถี่เกินไป|เต็ม|มี .+ อยู่แล้ว/.test(msg);
  el.classList.remove('show');void el.offsetWidth;
  el.textContent=msg;el.classList.toggle('bad',bad);el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),3400);
}
const tip=$('#tip');
document.addEventListener('mouseover',e=>{const el=e.target.closest('[data-tip]');if(!el){tip.hidden=true;return}tip.textContent=el.dataset.tip;tip.hidden=false});
/* the page is zoomed (css/scale.css): mouse coordinates are screen pixels, so divide by the zoom to place the tooltip */
document.addEventListener('mousemove',e=>{if(tip.hidden)return;const z=(window.uiZoom&&window.uiZoom())||1;const w=tip.offsetWidth*z;tip.style.left=Math.min(window.innerWidth-w-8,e.clientX+12)/z+'px';tip.style.top=(e.clientY+14)/z+'px'});
