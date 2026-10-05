'use strict';
/* BU1 Weekly Plan · account roles from the central database
   public.user_roles: one row per person per department — id = e-mail (lower case), dept_id, data = {id, email, name?, level}.
   level values in use on the central project: admin · engineer · sale · ga · viewer (same names as Weekly Plan BU2).
   core.org_roles (email, role) holds organisation roles such as HR; core.is_hr() tells whether the signed-in e-mail has one.
   The same rules are enforced by row level security in supabase/schema.sql (bu1wp.my_level). */
const LEVELS=[
  {id:'admin',th:'ผู้ดูแลระบบ',en:'Admin',desc:'ทำได้ทุกอย่าง: แผนงาน ข้อมูลหลัก ลบแผน นำเข้าข้อมูล และจัดการผู้ใช้ของแผนก',perm:{edit:1,status:1,del:1,master:1,users:1,import:1,ga:1}},
  {id:'engineer',th:'วิศวกร / ผู้วางแผน',en:'Engineer',desc:'เพิ่มและแก้แผนงาน เปลี่ยนสถานะ แนบรูปและไฟล์ แผนกำลังคนโปรเจกต์ · แก้ข้อมูลหลักและลบแผนไม่ได้',perm:{edit:1,status:1,ga:1}},
  {id:'sale',th:'ฝ่ายขาย',en:'Sale',desc:'ดูแผนงานทั้งหมด ค้นหา และดาวน์โหลดรายงาน · แก้ไขไม่ได้',perm:{}},
  {id:'ga',th:'GA',en:'GA',desc:'ดูแผนงาน และระบุรถ / ทะเบียนให้แผนงานที่ขอรถส่วนกลาง',perm:{ga:1}},
  {id:'viewer',th:'ดูอย่างเดียว',en:'Viewer',desc:'เปิดดูแผนงานได้ แก้ไขไม่ได้',perm:{}},
];
const PERM_KEYS=['edit','status','del','master','users','import','ga'];
const levelOf=id=>LEVELS.find(l=>l.id===String(id||'').trim().toLowerCase())||null;
/* claude.ai and offline: every permission follows S.canWrite (no per-person levels there); user management is Supabase only */
S.perm=Object.fromEntries(PERM_KEYS.map(k=>[k,k!=='users']));S.level=null;S.isHr=false;
function applyLevel(level){
  const L=levelOf(level);S.level=L?L.id:'viewer';
  S.perm=Object.fromEntries(PERM_KEYS.map(k=>[k,!!(L&&L.perm[k])]));S.canWrite=!!S.perm.edit;
}
/* can('master') etc.: edit-type permissions also need S.canWrite, which turns off when the database refuses a write */
const can=k=>k==='ga'?!!S.perm.ga&&(S.canWrite||S.backend==='supabase'):S.canWrite&&!!S.perm[k];
const levelLabel=id=>{const L=levelOf(id);return L?`${L.th} (${L.en})`:String(id||'—')};

/* signed-in person's level for this department (RLS returns only their own rows) and HR flag */
async function loadMyLevel(){
  let level=null;
  try{const {data,error}=await sb.from('user_roles').select('id,dept_id,data').eq('dept_id',DEPT()).eq('id',S.auth.email).maybeSingle();
    if(!error&&data)level=(data.data||{}).level||null}catch(e){}
  try{const {data,error}=await sb.schema('core').rpc('is_hr');S.isHr=!error&&data===true}catch(e){S.isHr=false}
  return level;
}

/* ---------- admin: people of this department in public.user_roles ---------- */
S.userRows=null;
async function loadUsers(){
  try{
    const out=[];for(let from=0;;from+=1000){
      const {data,error}=await sb.from('user_roles').select('id,dept_id,data,updated_at').eq('dept_id',DEPT()).order('id').range(from,from+999);
      if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break;
    }
    S.userRows=out;
  }catch(e){S.userRows=[];toast('โหลดรายชื่อผู้ใช้ไม่สำเร็จ: '+(e.message||e))}
  render();
}
async function saveUser(email,name,level){
  const id=String(email||'').trim().toLowerCase();
  const row={id,dept_id:DEPT(),data:{id,email:id,level}};if(name)row.data.name=name;
  const old=(S.userRows||[]).find(r=>r.id===id);if(old&&old.data&&old.data.name&&!name)row.data.name=old.data.name;
  const {error}=await sb.from('user_roles').upsert(row,{onConflict:'id,dept_id'});if(error)throw error;
}
function usersSection(){
  if(S.backend!=='supabase'||!can('users'))return null;
  if(S.userRows==null){loadUsers();return {id:'users',title:'ผู้ใช้งานระบบ',sub:'กำลังโหลด…',count:'…',desc:'',body:loading()}}
  const rows=S.userRows.slice().sort((a,b)=>LEVELS.findIndex(l=>l.id===(a.data||{}).level)-LEVELS.findIndex(l=>l.id===(b.data||{}).level)||a.id.localeCompare(b.id));
  const opts=cur=>LEVELS.map(l=>`<option value="${l.id}"${l.id===cur?' selected':''}>${esc(l.th)} (${l.en})</option>`).join('')+(cur&&!levelOf(cur)?`<option value="${esc(cur)}" selected>${esc(cur)}</option>`:'');
  return {id:'users',title:'ผู้ใช้งานระบบ',sub:`${rows.length} คน · สิทธิ์แผนก ${DEPT()}`,count:rows.length,
    desc:`รายชื่อจาก public.user_roles ของแผนก ${DEPT()} (ระบบกลาง) เปลี่ยนระดับสิทธิ์ได้ทันที · เพิ่มคนใหม่ได้เมื่อมีบัญชีกลางแล้ว (ผู้ดูแลระบบกลางเป็นคนสร้างบัญชี)`,
    body:`<div class="lv-legend">${LEVELS.map(l=>`<div><b>${esc(l.th)} <small>${l.en}</small></b><span>${esc(l.desc)}</span></div>`).join('')}</div>
      <div class="scroll-x plain md-scroll"><table class="edit-table"><thead><tr><th>อีเมล</th><th>ชื่อ</th><th>ระดับสิทธิ์</th><th>แก้ไขล่าสุด</th><th></th></tr></thead><tbody>
      ${rows.map(r=>{const d=r.data||{};const self=r.id===S.auth.email;const u=r.updated_at?new Date(r.updated_at):null;
        return `<tr><td class="mono">${esc(r.id)}${self?' <span class="sys-tag">(คุณ)</span>':''}</td><td>${esc(d.name||'—')}</td>
          <td><select id="ul-${esc(r.id)}" data-user-level="${esc(r.id)}"${self?' disabled title="เปลี่ยนระดับของตัวเองไม่ได้"':''} aria-label="ระดับสิทธิ์ของ ${esc(r.id)}">${opts(d.level)}</select></td>
          <td class="hint">${u&&!isNaN(u)?esc(thDate(ymd(u))):''}</td>
          <td>${self?'':`<button type="button" class="btn sm danger" data-action="user-remove" data-id="${esc(r.id)}">เอาสิทธิ์ออก</button>`}</td></tr>`}).join('')||'<tr><td colspan="5" class="hint">ยังไม่มีผู้ใช้</td></tr>'}
      </tbody></table></div>
      <form class="add-row" data-user-add><input name="email" id="ua-email" type="email" placeholder="อีเมลของบัญชีกลาง" required maxlength="120" aria-label="อีเมล"><input name="name" id="ua-name" placeholder="ชื่อ (ไม่บังคับ)" maxlength="80" aria-label="ชื่อ"><select name="level" id="ua-level" aria-label="ระดับสิทธิ์">${opts('viewer')}</select><button class="btn primary" type="submit">ให้สิทธิ์แผนก ${DEPT()}</button></form>
      <div><button type="button" class="btn sm" data-action="users-reload">โหลดรายชื่อใหม่</button></div>`};
}
document.addEventListener('change',async e=>{
  const t=e.target;if(!t.dataset||t.dataset.userLevel===undefined||!sb)return;
  const id=t.dataset.userLevel;const r=(S.userRows||[]).find(x=>x.id===id);
  try{await saveUser(id,(r&&r.data||{}).name||'',t.value);if(r)r.data=Object.assign({},r.data,{level:t.value});toast(`${id} เป็น "${levelLabel(t.value)}" แล้ว`)}
  catch(err){toast('เปลี่ยนสิทธิ์ไม่สำเร็จ: '+(err.message||err));loadUsers()}
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(!f.matches||!f.matches('[data-user-add]'))return;e.preventDefault();if(!sb)return;
  const fd=new FormData(f);const email=String(fd.get('email')||'').trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast('รูปแบบอีเมลไม่ถูกต้อง');return}
  try{await saveUser(email,String(fd.get('name')||'').trim(),String(fd.get('level')||'viewer'));f.reset();toast(`ให้สิทธิ์ ${email} แล้ว`);loadUsers()}
  catch(err){toast('เพิ่มผู้ใช้ไม่สำเร็จ: '+(err.message||err))}
});
document.addEventListener('click',async e=>{
  const a=e.target.closest('[data-action]');if(!a)return;
  if(a.dataset.action==='users-reload'){S.userRows=null;render();return}
  if(a.dataset.action==='user-remove'){
    if(!arm(a,'user:'+a.dataset.id,'เอาสิทธิ์ออก','กดอีกครั้งเพื่อยืนยัน'))return;
    try{const {error}=await sb.from('user_roles').delete().eq('dept_id',DEPT()).eq('id',a.dataset.id);if(error)throw error;toast(`เอาสิทธิ์แผนก ${DEPT()} ของ ${a.dataset.id} ออกแล้ว`);loadUsers()}
    catch(err){toast('เอาสิทธิ์ออกไม่สำเร็จ: '+(err.message||err))}
  }
});
