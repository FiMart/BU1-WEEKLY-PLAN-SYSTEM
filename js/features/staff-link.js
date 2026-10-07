'use strict';
/* BU1 Weekly Plan · จับคู่พนักงาน: link each Team Service person (public.people.id) to their HR record (core.employees.emp_code)
   in core.person_id_map (migration 0022: dept_id, people_id, emp_code, verified_by, verified_at; RLS = own department).
   The Safety card check (js/features/cert-status.js) can only see a person who is linked here.
   0022 on purpose has no bulk name-matching: two people sharing a first name cannot be told apart by a script, so every
   link is confirmed by a person. This screen only SUGGESTS (same full name, or same first name) and saves what is chosen;
   the one bulk action covers names that match letter for letter, after a confirm that lists them.
   Who: admin and planer (S.perm.master); refused while BU1_CONFIG.readOnly is on. */
S.sfl={filter:'todo',q:''};
const sfCanLink=()=>S.backend==='supabase'&&!isReadOnly()&&!!S.perm.master;
/* names compared without titles, extra spaces or case */
const nameKey=s=>String(s||'').replace(/^\s*(นาย|นางสาว|นาง|น\.ส\.|mr\.?|mrs\.?|ms\.?|miss)\s*/i,'').replace(/\s+/g,' ').trim().toLowerCase();
const firstKey=s=>nameKey(s).split(' ')[0];
function linkSuggest(person){
  const emps=SF.emps||[];const k=nameKey(person.name);
  const exact=emps.filter(e=>nameKey(e.full_name)===k);if(exact.length)return {kind:'exact',list:exact};
  const f=firstKey(person.name);return {kind:'first',list:f?emps.filter(e=>firstKey(e.full_name)===f):[]};
}
const linkedEmp=pid=>SAFE.empOf.get(pid)||'';
const linkRow=pid=>(SAFE.mapRows||[]).find(m=>m.people_id===pid)||null;
/* people whose full name matches exactly one HR record that nobody else holds yet */
function exactPending(){
  const used=new Set(SAFE.empOf.values());
  return S.staff.filter(p=>!linkedEmp(p.id)).map(p=>{const s=linkSuggest(p);return s.kind==='exact'&&s.list.length===1&&!used.has(s.list[0].emp_code)?{p,e:s.list[0]}:null}).filter(Boolean);
}
function drawLink(){
  const b=$('#sfBody');sfLoad('emps',loadEmps);loadSafety();
  if(SF.err.emps&&!SF.emps){b.innerHTML=sfError(SF.err.emps);return}
  if(!SAFE.ready||!SF.emps){b.innerHTML=SAFE.err?sfError(SAFE.err):loading();return}
  const people=S.staff.slice().sort((a,b)=>(a.active===false)-(b.active===false)||sortPeople(a,b));
  const linked=people.filter(p=>linkedEmp(p.id)).length;const can=sfCanLink();const bulk=can?exactPending():[];
  const owner=new Map();SAFE.empOf.forEach((e,pid)=>owner.set(e,pid));
  const empBy=new Map(SF.emps.map(e=>[e.emp_code,e]));
  const q=norm(S.sfl.q);
  const list=people.filter(p=>(S.sfl.filter==='all'||(S.sfl.filter==='todo'?!linkedEmp(p.id):!!linkedEmp(p.id)))&&(!q||norm(p.name+' '+p.role+' '+linkedEmp(p.id)).includes(q)));
  /* the full HR list goes into a row's dropdown only when it is opened (dozens of rows × the whole HR list made every redraw slow) */
  const opt=(e,cur,pid)=>{const o=owner.get(e.emp_code);return `<option value="${esc(e.emp_code)}"${e.emp_code===cur?' selected':''}>${esc(e.full_name)} · ${esc(e.emp_code)}${o&&o!==pid?` (จับคู่กับ ${esc(staffName(o))} แล้ว)`:''}</option>`};
  b.innerHTML=`<section class="panel sf-hero sf-link-hero">
      <div class="sf-hero-t"><small>Team Service ↔ ทะเบียนพนักงาน HR</small><h3>จับคู่พนักงานกับ Safety</h3>
        <p>ระบบเช็คบัตรเข้าพื้นที่ได้เฉพาะคนที่จับคู่กับรหัสพนักงาน HR แล้ว · ระบบแนะนำจากชื่อ แต่ต้องตรวจและยืนยันทีละคน (คนชื่อซ้ำกันระบบเดาเองไม่ได้)</p></div>
      <div class="sf-hero-n"><span>จับคู่แล้ว</span><b>${linked}<small> / ${people.length} คน</small></b><div class="sf-bar"><i class="k-ok" style="width:${people.length?linked/people.length*100:0}%"></i></div></div>
    </section>
    ${can?'':`<p class="hint">${esc(isReadOnly()?'โหมดอ่านอย่างเดียว ยังบันทึกการจับคู่ไม่ได้':'ดูได้อย่างเดียว · การจับคู่ทำได้เฉพาะผู้ดูแลระบบและผู้วางแผน (Planer)')}</p>`}
    <section class="panel sf-list">
      <div class="sf-list-h">
        <div class="seg" role="radiogroup" aria-label="แสดง">${[['todo','ยังไม่จับคู่',people.length-linked],['done','จับคู่แล้ว',linked],['all','ทั้งหมด',people.length]].map(([v,l,n])=>`<label><input type="radio" name="sfl-filter" value="${v}"${S.sfl.filter===v?' checked':''}><span>${l} <b>${n}</b></span></label>`).join('')}</div>
        <input type="search" id="sfl-q" placeholder="ค้นหาชื่อพนักงาน" value="${esc(S.sfl.q)}" autocomplete="off" aria-label="ค้นหาชื่อพนักงาน">
        ${bulk.length?`<button type="button" class="btn sm" data-sf="link-bulk">ยืนยันชื่อที่ตรงกันทุกตัวอักษร (${bulk.length} คน)</button>`:''}
      </div>
      <div class="scroll-x plain"><table class="list sf-table sf-link"><thead><tr><th>พนักงานในแผน (Team Service)</th><th>รหัสพนักงาน HR</th><th>สถานะ</th></tr></thead><tbody>
      ${list.map(p=>{const cur=linkedEmp(p.id);const e=cur&&empBy.get(cur);const row=linkRow(p.id);const s=cur?null:linkSuggest(p);
        const sug=s&&s.list.filter(x=>!owner.has(x.emp_code));
        const others=SF.emps.filter(x=>!(sug||[]).includes(x));
        return `<tr><td><b>${esc(p.name)}</b><span class="sub">${esc(p.role||'—')}${p.active===false?' · ปิดใช้งาน':''}</span></td>
          <td>${can?`<select data-link-pid="${esc(p.id)}" data-lazy="1" aria-label="รหัสพนักงาน HR ของ ${esc(p.name)}"><option value="">— ยังไม่จับคู่ —</option>
              ${sug&&sug.length?`<optgroup label="${s.kind==='exact'?'ชื่อตรงกัน':'ชื่อต้นตรงกัน — ตรวจนามสกุล'}">${sug.map(x=>opt(x,cur,p.id)).join('')}</optgroup><optgroup label="พนักงานทั้งหมด">`:''}
              ${others.filter(x=>x.emp_code===cur).map(x=>opt(x,cur,p.id)).join('')}<option value="" disabled data-more="1">… เปิดเพื่อดูพนักงานทั้งหมด (${others.length} คน)</option>${sug&&sug.length?'</optgroup>':''}${cur&&!e?`<option value="${esc(cur)}" selected>${esc(cur)} (ไม่อยู่ในรายชื่อ HR ที่ใช้งาน)</option>`:''}</select>`
            :e?`${esc(e.full_name)} <span class="mono hint">${esc(cur)}</span>`:cur?`<span class="mono">${esc(cur)}</span>`:'<span class="hint">—</span>'}
            ${!cur&&sug&&sug.length===1&&can?`<button type="button" class="lnk sf-use" data-link-use="${esc(p.id)}|${esc(sug[0].emp_code)}">ใช้ ${esc(sug[0].full_name)} (${esc(sug[0].emp_code)})</button>`:''}</td>
          <td>${cur?`${sfPill('ok','จับคู่แล้ว')}${row&&row.verified_by?`<span class="sub">โดย ${esc(String(row.verified_by).split('@')[0])}${row.verified_at?' · '+esc(sfDate(row.verified_at)):''}</span>`:''}`
            :sug&&sug.length?sfPill('warn',s.kind==='exact'?'มีชื่อที่ตรงกัน':`ชื่อต้นตรงกัน ${sug.length} คน`):sfPill('none','ยังไม่จับคู่')}</td></tr>`}).join('')
        ||`<tr><td colspan="3" class="hint" style="padding:22px 14px">${people.length?'ไม่มีรายชื่อที่ตรงกับตัวกรอง':'ยังไม่มีรายชื่อพนักงาน'}</td></tr>`}
      </tbody></table></div></section>`;
}
async function saveLink(pid,emp){
  if(!sfCanLink()){toast(isReadOnly()?'โหมดอ่านอย่างเดียว ยังบันทึกการจับคู่ไม่ได้':'การจับคู่ทำได้เฉพาะผู้ดูแลระบบและผู้วางแผน');return false}
  try{
    if(emp){
      const other=[...SAFE.empOf].find(([p,e])=>e===emp&&p!==pid);
      if(other&&!confirm(`${emp} จับคู่กับ ${staffName(other[0])} อยู่แล้ว\nจะจับคู่ให้ ${staffName(pid)} ด้วยหรือไม่? (คนละคนไม่ควรใช้รหัสเดียวกัน)`))return false;
      const now=new Date().toISOString();
      const {error}=await coreDb().from('person_id_map').upsert({dept_id:DEPT(),people_id:pid,emp_code:emp,verified_by:S.auth.email,verified_at:now},{onConflict:'dept_id,people_id'});
      if(error)throw error;
      SAFE.empOf.set(pid,emp);SAFE.mapRows=(SAFE.mapRows||[]).filter(m=>m.people_id!==pid).concat({people_id:pid,emp_code:emp,verified_by:S.auth.email,verified_at:now});
    }else{
      const {error}=await coreDb().from('person_id_map').delete().eq('dept_id',DEPT()).eq('people_id',pid);if(error)throw error;
      SAFE.empOf.delete(pid);SAFE.mapRows=(SAFE.mapRows||[]).filter(m=>m.people_id!==pid);
    }
    return true;
  }catch(err){toast('บันทึกการจับคู่ไม่สำเร็จ: '+((err&&err.message)||err));return false}
}
/* a save already updates the screen; the full Safety read (every certificate) runs once, a few seconds after the last save */
let linkSyncT=0;function linkSyncSoon(){clearTimeout(linkSyncT);linkSyncT=setTimeout(()=>loadSafety(true),4000)}
/* fill a row's dropdown with the whole HR list the first time it is opened */
function linkFill(sel){
  if(!sel||sel.dataset.lazy!=='1'||!SF.emps)return;sel.dataset.lazy='';
  const pid=sel.dataset.linkPid,cur=sel.value;const owner=new Map();SAFE.empOf.forEach((e,p)=>owner.set(e,p));
  const have=new Set([...sel.options].map(o=>o.value).filter(Boolean));const more=sel.querySelector('[data-more]');
  const html=SF.emps.filter(e=>!have.has(e.emp_code)).map(e=>{const o=owner.get(e.emp_code);return `<option value="${esc(e.emp_code)}">${esc(e.full_name)} · ${esc(e.emp_code)}${o&&o!==pid?` (จับคู่กับ ${esc(staffName(o))} แล้ว)`:''}</option>`}).join('');
  if(more){more.insertAdjacentHTML('beforebegin',html);more.remove()}else sel.insertAdjacentHTML('beforeend',html);
  sel.value=cur;
}
['mousedown','focusin','keydown'].forEach(ev=>document.addEventListener(ev,e=>{const s=e.target.closest&&e.target.closest('select[data-link-pid]');if(s)linkFill(s)},true));
async function linkBulk(){
  const list=exactPending();if(!list.length)return;
  if(!confirm(`ยืนยันการจับคู่ ${list.length} คนที่ชื่อตรงกับทะเบียน HR ทุกตัวอักษร:\n\n${list.slice(0,30).map(x=>`• ${x.p.name} → ${x.e.emp_code}`).join('\n')}${list.length>30?`\n… และอีก ${list.length-30} คน`:''}\n\nตรวจแล้วว่าเป็นคนเดียวกัน กด OK`))return;
  let n=0;for(const x of list){if(await saveLink(x.p.id,x.e.emp_code))n++}
  toast(`จับคู่แล้ว ${n} คน`);linkSyncSoon();fillSafety();
}
document.addEventListener('change',async e=>{const t=e.target;
  if(t.name==='sfl-filter'){S.sfl.filter=t.value;fillSafety();return}
  if(t.dataset&&t.dataset.linkPid!==undefined){t.disabled=true;const ok=await saveLink(t.dataset.linkPid,t.value);
    if(ok){toast(t.value?`จับคู่ ${staffName(t.dataset.linkPid)} กับ ${t.value} แล้ว`:`ยกเลิกการจับคู่ ${staffName(t.dataset.linkPid)} แล้ว`);linkSyncSoon()}fillSafety()}
});
document.addEventListener('input',e=>{if(e.target.id==='sfl-q'){S.sfl.q=e.target.value;const pos=e.target.selectionStart;fillSafety();const i=$('#sfl-q');if(i){i.focus();i.setSelectionRange(pos,pos)}}});
document.addEventListener('click',async e=>{
  if(e.target.closest('[data-sf-golink]')){if(dlg.open)dlg.close();S.sf.tab='link';S.sfl.filter='todo';goView('safety');window.scrollTo(0,0);return}
  const u=e.target.closest('[data-link-use]');if(u){const [pid,emp]=u.dataset.linkUse.split('|');if(await saveLink(pid,emp)){toast(`จับคู่ ${staffName(pid)} กับ ${emp} แล้ว`);linkSyncSoon()}fillSafety();return}
  if(e.target.closest('[data-sf="link-bulk"]'))linkBulk();
});
