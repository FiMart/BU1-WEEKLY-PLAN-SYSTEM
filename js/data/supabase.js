'use strict';
/* BU1 Weekly Plan · Supabase (central project shared with Weekly Plan BU2 and Safety Training Record)
   - db adapter with the same shape as the claude.ai db (collection/doc/where/get/set/update/delete/onSnapshot), built on
     supabaseBackend (js/data/backend.js, which maps the public.* Weekly Plan tables), so Store and every view keep working
   - sign-in: Supabase Auth e-mail + password. One account works for every app on the central project. "สมัครสมาชิก"
     creates that central account (supabase.auth.signUp) — there is no member table or approval inside this app; access
     to BU1 data still comes from public.user_roles (core.my_depts()), set by the system owner, and RLS enforces it
   - the user is known by e-mail (lower case); the URL and anon key live only in js/config.js, filled in by the owner */
const SUPA_LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const hasSupabaseConfig=()=>typeof BU1_CONFIG!=='undefined'&&!!(BU1_CONFIG.supabaseUrl&&BU1_CONFIG.supabaseAnonKey);
const DEPT=()=>String((typeof BU1_CONFIG!=='undefined'&&BU1_CONFIG.deptId)||'BU1');
/* read-only stage: nothing is written to the central database (plans, master data, user_roles, account prefs) */
const isReadOnly=()=>typeof BU1_CONFIG==='undefined'||BU1_CONFIG.readOnly!==false;
let sb=null,backend=null;
S.auth={user:null,email:'',depts:null};

/* ---------- db adapter on the backend ---------- */
function supaErr(e){
  const m=String((e&&(e.message||e.details))||'');const c=String((e&&e.code)||'');
  if(c==='42501'||/row-level security|permission denied/i.test(m))return {code:'invalid_argument',message:m};
  if(/JWT|expired|not authenticated/i.test(m)||c==='PGRST301')return {code:'revoked',message:m};
  if(/Failed to fetch|NetworkError|network/i.test(m))return {code:'unavailable',message:m};
  return {code:c||'unknown',message:m};
}
function supaDb(be){
  const guard=async p=>{try{return await netTrack(p)}catch(e){throw supaErr(e)}};
  /* writes: a failure stays on screen (banner) until a later write succeeds — never cleared by realtime, which only
     proves that someone else's write arrived (store-notes from BU2) */
  const wguard=async p=>{
    try{const r=await guard(p);if(S.writeFail){S.writeFail=null;render()}return r}
    catch(e){if(e.code!=='read_only'){S.writeFail={msg:e.message||String(e.code||''),at:new Date()};render()}throw e}
  };
  /* live queries by entity, so a write reloads them at once even when realtime is not switched on */
  const live=new Map();const poke=e=>(live.get(e)||new Set()).forEach(fn=>fn());
  const loaders=new Set();/* each live query's read, for refreshNow (pull to refresh) */
  /* auto refresh: realtime may not be switched on for the central tables, so every live query (and the cached
     month / Booking / search reads) is read again quietly — when the tab comes back, when the network returns, and
     every AUTO_MS while the page is open. Nothing is redrawn unless a row really changed */
  const AUTO_MS=20000,CACHE_EVERY=3;/* cached reads (all plans for Booking / search) are bigger: every 3rd round */
  let round=0;
  const refreshAll=all=>{
    if(document.hidden||(S.mode!=='live'&&S.mode!=='error'))return;/* after a dropped connection it keeps trying */
    live.forEach(set=>set.forEach(fn=>fn()));
    if(all||++round%CACHE_EVERY===0){invalidate();if(['booking','search','dash','projects'].includes(S.view))quietly(render)}
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAll(true)});
  window.addEventListener('online',()=>refreshAll(true));
  setInterval(()=>refreshAll(false),AUTO_MS);
  /* where-clauses go to the server (date range, id, ==, array-contains) and are checked again here */
  const narrow=wh=>{const f={eq:[],contains:[]};wh.forEach(([k,op,v])=>{
    if(k==='date'&&op==='>=')f.from=v;else if(k==='date'&&op==='<=')f.to=v;else if(k==='id'&&op==='==')f.id=v;
    else if(op==='=='&&typeof v!=='boolean')f.eq.push([k,v]);else if(op==='array-contains')f.contains.push([k,v])});return f};
  const match=(d,wh)=>wh.every(([k,op,v])=>{const x=d[k];
    if(op==='==')return String(x)===String(v);if(op==='>=')return String(x)>=String(v);if(op==='<=')return String(x)<=String(v);
    if(op==='in')return (v||[]).map(String).includes(String(x));if(op==='array-contains')return Array.isArray(x)&&x.includes(v);return true});
  const fetchRows=async(e,wh)=>(await guard(be.list(e,narrow(wh)))).filter(d=>match(d,wh));
  const snapOf=rows=>({docs:rows.map(r=>({id:r.id,data:()=>{const {id,...d}=r;return d}})),metadata:{fromCache:false},docChanges:()=>[]});
  function watch(e,wh,cb,err){
    let alive=true,timer=null,prev=null,busy=false,again=false;
    /* the first read shows the loading bar; later ones (realtime, auto refresh, after a write) are quiet and call back
       only when a row was added, changed or removed, so an idle page is not redrawn */
    const load=async()=>{
      if(busy){again=true;return}busy=true;
      try{const rows=await (prev?quietly(()=>fetchRows(e,wh)):fetchRows(e,wh));if(!alive)return;
        const now=new Map(rows.map(r=>[r.id,JSON.stringify(r)]));const changes=[];
        if(prev){now.forEach((v,id)=>{if(!prev.has(id))changes.push({type:'added',doc:{id}});else if(prev.get(id)!==v)changes.push({type:'modified',doc:{id}})});
          prev.forEach((v,id)=>{if(!now.has(id))changes.push({type:'removed',doc:{id}})})}
        const first=!prev;prev=now;S.syncAt=new Date();
        if(first||changes.length){const s=snapOf(rows);s.docChanges=()=>changes;cb(s)}
        if(S.mode==='error'){S.mode='live';render()}/* the connection is back */
      }catch(x){if(alive&&err)err(x)}
      finally{busy=false;if(again&&alive){again=false;soon()}}
    };
    const soon=()=>{clearTimeout(timer);timer=setTimeout(load,250)};
    if(!live.has(e))live.set(e,new Set());live.get(e).add(soon);loaders.add(load);
    load();const off=be.watch(e,soon);
    return ()=>{alive=false;clearTimeout(timer);live.get(e).delete(soon);loaders.delete(load);off()};
  }
  function query(e,wh){
    return {where:(f,op,v)=>query(e,wh.concat([[f,op,v]])),get:async()=>snapOf(await fetchRows(e,wh)),onSnapshot:(cb,err)=>watch(e,wh,cb,err)};
  }
  function docRef(e,id){
    const one=async()=>(await guard(be.list(e,{id})))[0]||null;
    return {
      async get(){const r=await one();return {exists:!!r,id,data:()=>{if(!r)return undefined;const {id:_,...d}=r;return d}}},
      async set(d){await wguard(be.upsert(e,[Object.assign({},d,{id})]));poke(e)},
      async update(d){const r=await one();if(!r)throw {code:'not_found',message:'document not found'};await wguard(be.upsert(e,[Object.assign({},r,d,{id})]));poke(e)},
      async delete(){await wguard(be.remove(e,[id]));poke(e)},
      onSnapshot:(cb,err)=>watch(e,[['id','==',id]],s=>{const r=s.docs[0];cb({exists:!!r,id,data:()=>r?r.data():undefined})},err),
    };
  }
  const collection=c=>Object.assign(query(c,[]),{doc:id=>docRef(c,id)});
  return {collection,doc:path=>{const [c,id]=String(path).split('/');return docRef(c,id)},
    /* read everything on screen again now and resolve when done (pull to refresh) */
    async refreshNow(){invalidate();await Promise.all([...loaders].map(f=>f()));render()},
    /* bulk upsert for backup import: rows of one entity [{id, ...fields}] */
    async bulk(entity,rows){await wguard(be.upsert(entity,rows));poke(entity)}};
}

/* ---------- people: same calls the views make on the claude.ai user capability (ids are e-mails) ---------- */
function avatarFor(name){
  const ch=initialOf(name);const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#2F8BFF"/><text x="32" y="42" font-family="sans-serif" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
const supaName=()=>{const u=S.auth.user||{};const m=u.user_metadata||{};return m.full_name||m.name||S.auth.email};
function supaUsers(){
  return {
    async me(){const n=supaName();return {id:S.auth.email,name:n,avatarUrl:avatarFor(n)}},
    async id(){return S.auth.email},
    async can(){return S.canWrite},/* from data.level; RLS enforces the same rules and a refused write turns editing off */
    async profiles(ids){const out={};ids.forEach(e=>{out[e]={name:e===S.auth.email?supaName():String(e||'')}});return out},
  };
}
/* outside claude.ai the page may start downloads itself */
const browserDownloads={async save({filename,data}){
  const blob=data instanceof Blob?data:new Blob([data]);const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}};

/* ---------- sign-in screens ---------- */
const AUTH_ERR=[[/Invalid login credentials/i,'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],[/Email not confirmed/i,'บัญชีนี้ยังไม่ได้ยืนยันอีเมล เปิดลิงก์ยืนยันในอีเมลก่อน แล้วเข้าสู่ระบบอีกครั้ง'],
  [/already registered|already been registered|User already exists/i,'อีเมลนี้มีบัญชีแล้ว เข้าสู่ระบบด้วยรหัสผ่านเดิม หรือกด "ลืมรหัสผ่าน"'],[/Signups not allowed|signup is disabled/i,'ระบบกลางปิดการสมัครเอง ติดต่อผู้ดูแลระบบกลางเพื่อขอบัญชี'],
  [/Password should be at least/i,'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'],[/rate limit|too many/i,'ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่'],
  [/Failed to fetch|NetworkError/i,'เชื่อมต่อ Supabase ไม่ได้ ตรวจสอบอินเทอร์เน็ต หรือค่าใน js/config.js'],[/valid email|invalid email/i,'รูปแบบอีเมลไม่ถูกต้อง']];
const authText=e=>{const m=String((e&&e.message)||e||'');const hit=AUTH_ERR.find(([r])=>r.test(m));return hit?hit[1]:(m||'ทำรายการไม่สำเร็จ ลองอีกครั้ง')};
function authMsg(text,kind){const el=$('#authMsg');el.textContent=text||'';el.className='auth-msg'+(kind?' '+kind:'');el.hidden=!text}
const signupDomain=()=>String((typeof BU1_CONFIG!=='undefined'&&BU1_CONFIG.allowedEmailDomain)||'').trim().toLowerCase().replace(/^@/,'');
function showAuth(screen){
  $('#auth').hidden=false;document.body.classList.add('auth-open');
  document.querySelectorAll('#auth [data-auth-screen]').forEach(f=>{f.hidden=f.dataset.authScreen!==screen});
  const tabs=(screen==='login'||screen==='register')&&BU1_CONFIG.allowSignup!==false;$('#authTabs').hidden=!tabs;
  document.querySelectorAll('#auth .auth-alt').forEach(x=>{x.hidden=BU1_CONFIG.allowSignup===false});
  document.querySelectorAll('#authTabs [data-auth-go]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.authGo===screen)));
  $('#authPreview').hidden=!S.authPreview;
  if(screen==='noaccess'){$('#authNoWho').textContent=S.auth.email;$('#authNoDept').textContent=DEPT()}
  if(screen==='register'){const d=signupDomain();const h=$('#arDomain');h.hidden=!d;h.textContent=d?`สมัครได้เฉพาะอีเมล @${d}`:'';pwMeter()}
  authMsg('');const first=$(`#auth [data-auth-screen="${screen}"] input`);if(first)setTimeout(()=>first.focus(),40);
}
function hideAuth(){$('#auth').hidden=true;document.body.classList.remove('auth-open');S.authPreview=false}
/* preview of the sign-in / sign-up pages on the claude.ai link (where sign-in is the claude.ai account) */
function openAuthPreview(screen){S.authPreview=true;showAuth(screen||'login')}
/* password strength: length, upper + lower, digit, symbol */
function pwScore(p){let s=0;if(p.length>=8)s++;if(p.length>=12)s++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return Math.min(4,p.length<8?Math.min(1,s):s)}
function pwMeter(){
  const p=String(($('#ar-pw')||{}).value||'');const s=p?Math.max(1,pwScore(p)):0;
  const m=$('#arMeter');if(!m)return;m.dataset.s=s;
  $('#arMeterTxt').textContent=!p?'ใช้ตัวอักษร ตัวเลข และสัญลักษณ์ผสมกัน':p.length<8?'สั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร':['','อ่อน','พอใช้','ดี','แข็งแรง'][s];
}
function busyBtn(form,on,label){const b=form.querySelector('button[type=submit]');if(!b)return;if(on){b.dataset.label=b.textContent;b.textContent=label||'กำลังดำเนินการ…'}else if(b.dataset.label)b.textContent=b.dataset.label;b.disabled=on}

const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);
async function initSupabase(){
  S.backend='supabase';S.mode='connecting';render();showAuth('wait');
  try{await withTimeout(loadLib(SUPA_LIB,'supabase'),15000)}
  catch(e){showAuth('login');authMsg('เชื่อมต่อระบบเข้าสู่ระบบไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต แล้วโหลดหน้าใหม่','err');return}
  sb=window.supabase.createClient(BU1_CONFIG.supabaseUrl,BU1_CONFIG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let recovering=/type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange(ev=>{
    if(ev==='PASSWORD_RECOVERY'){recovering=true;showAuth('newpw')}
    if(ev==='SIGNED_OUT'&&S.auth.user){location.reload()}
  });
  let session=null;
  try{({data:{session}}=await withTimeout(sb.auth.getSession(),15000))}catch(e){showAuth('login');authMsg(authText(e),'err');return}
  if(recovering){showAuth('newpw');return}
  if(!session){showAuth('login');return}
  await afterLogin(session.user);
}
/* departments this e-mail may open, from core.my_depts() (reads public.user_roles); null = could not ask, let RLS decide */
async function myDepts(){
  try{
    const {data,error}=await withTimeout(sb.schema('core').rpc('my_depts'),10000);if(error)return null;
    const list=(Array.isArray(data)?data:[data]).flat().map(x=>typeof x==='string'?x:x&&(x.dept_id||x.my_depts||x.dept||x.code)).filter(Boolean).map(String);
    return list;
  }catch(e){return null}
}
async function afterLogin(user){
  S.auth.user=user;S.auth.email=String(user.email||'').trim().toLowerCase();S.me=S.auth.email;
  usePrefsOf(S.auth.email,(user.user_metadata||{}).bu1wp_prefs,isReadOnly()?null:pushPrefs);render();
  /* the stored session may predate a change made on another device: read the account once more from the server */
  sb.auth.getUser().then(({data})=>{const u=data&&data.user;if(!u||String(u.email||'').toLowerCase()!==S.auth.email)return;S.auth.user=u;
    const r=cleanPrefs((u.user_metadata||{}).bu1wp_prefs);if(Object.keys(r).length&&JSON.stringify(r)!==JSON.stringify(prefs)){usePrefsOf(S.auth.email,r,isReadOnly()?null:pushPrefs);S.anim='view';render()}}).catch(()=>{});
  S.auth.depts=await myDepts();
  if(S.auth.depts&&!S.auth.depts.includes(DEPT())){showAuth('noaccess');return}
  /* role = data.level of this person's public.user_roles row for BU1 (js/features/roles.js); no row = viewer */
  applyLevel(await loadMyLevel());
  if(isReadOnly())S.canWrite=false;/* stage 2: compare with the old app before any write is switched on */
  hideAuth();
  backend=supabaseBackend(sb,{dept:DEPT()});
  db=supaDb(backend);users=supaUsers();downloads=browserDownloads;S.mode='live';
  document.body.classList.add('central');/* photos, files and projects have no central storage yet (closed until BU2 adds it) */
  if(S.view==='projects')S.view='plan';
  $('#btnLogout').hidden=false;
  showMe();wireData();loadSafety(true);/* Safety cards for the team picker (read only, never blocks planning) */
}

/* the account's display prefs go to its user_metadata.bu1wp_prefs (merged with the other metadata keys), a moment after the last change */
let prefTimer=null;
function pushPrefs(p){
  if(!sb||!S.auth.user)return;clearTimeout(prefTimer);
  prefTimer=setTimeout(()=>{sb.auth.updateUser({data:{bu1wp_prefs:p}}).then(({data})=>{if(data&&data.user)S.auth.user=data.user}).catch(()=>{})},800);
}
document.addEventListener('input',e=>{if(e.target.id==='ar-pw')pwMeter()});
document.addEventListener('click',e=>{
  const eye=e.target.closest('[data-pw-toggle]');if(eye){const inp=eye.parentElement.querySelector('input');const show=inp.type==='password';inp.type=show?'text':'password';eye.textContent=show?'ซ่อน':'แสดง';eye.setAttribute('aria-label',show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');return}
  if(e.target.closest('[data-auth-close]')){hideAuth();return}
  const go=e.target.closest('[data-auth-go]');if(go){showAuth(go.dataset.authGo);return}
  if(e.target.closest('[data-action="logout"]')){
    if(!sb)return;
    askConfirm('ออกจากระบบ?',`แน่ใจไหมว่าจะออกจากระบบ${S.auth.email?`\n${S.auth.email}`:''}\nครั้งหน้าต้องเข้าสู่ระบบด้วยอีเมลและรหัสผ่านอีกครั้ง`,'ออกจากระบบ')
      .then(ok=>{if(ok)sb.auth.signOut().then(()=>location.reload())});
    return;
  }
  if(e.target.closest('#authRecheck')){if(!S.auth.user)return;authMsg('');myDepts().then(d=>{S.auth.depts=d;if(d&&!d.includes(DEPT()))authMsg(`ยังไม่มีสิทธิ์แผนก ${DEPT()} ติดต่อผู้ดูแลระบบกลาง`,'warn');else afterLogin(S.auth.user)})}
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(!f.closest||!f.closest('#auth'))return;e.preventDefault();
  if(!sb){if(S.authPreview)authMsg('นี่คือหน้าตัวอย่าง ใช้งานจริงได้เมื่อเปิดผ่านเว็บที่ต่อ Supabase กลางแล้ว','warn');return}
  const fd=new FormData(f);const v=k=>String(fd.get(k)||'').trim();const screen=f.dataset.authScreen;
  busyBtn(f,true);authMsg('');
  try{
    if(screen==='login'){
      const {data,error}=await sb.auth.signInWithPassword({email:v('email').toLowerCase(),password:String(fd.get('password')||'')});if(error)throw error;
      await afterLogin(data.user);
    }else if(screen==='register'){
      /* creates an account in the central Supabase Auth (shared by every app); BU1 access is still granted by the owner */
      if(BU1_CONFIG.allowSignup===false)throw new Error('ระบบนี้ปิดการสมัครเอง ติดต่อผู้ดูแลระบบกลางเพื่อขอบัญชี');
      const email=v('email').toLowerCase();const pw=String(fd.get('password')||'');const dom=signupDomain();
      if(!v('name'))throw new Error('ใส่ชื่อ-นามสกุล');
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
      if(dom&&!email.endsWith('@'+dom))throw new Error(`สมัครได้เฉพาะอีเมล @${dom}`);
      if(pw.length<8)throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      if(pw!==String(fd.get('password2')||''))throw new Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      if(!fd.get('agree'))throw new Error('ติ๊กยืนยันว่าเป็นพนักงาน BU1 Lab ก่อนสมัคร');
      const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{full_name:v('name'),employee_code:v('code'),requested_dept:DEPT(),requested_app:'bu1-weekly-plan'},emailRedirectTo:location.origin+location.pathname}});
      if(error)throw error;
      if(data.session)await afterLogin(data.user);
      else{showAuth('registered');$('#authRegWho').textContent=email}
    }else if(screen==='reset'){
      const {error}=await sb.auth.resetPasswordForEmail(v('email').toLowerCase(),{redirectTo:location.origin+location.pathname});if(error)throw error;
      authMsg('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว เปิดลิงก์ในอีเมลเพื่อตั้งรหัสใหม่','ok');
    }else if(screen==='newpw'){
      const pw=String(fd.get('password')||'');if(pw.length<8)throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      if(pw!==String(fd.get('password2')||''))throw new Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      const {data,error}=await sb.auth.updateUser({password:pw});if(error)throw error;
      history.replaceState(null,'',location.pathname);await afterLogin(data.user);toast('ตั้งรหัสผ่านใหม่แล้ว');
    }
  }catch(err){authMsg(authText(err),'err')}
  finally{busyBtn(f,false)}
});
