'use strict';
/* BU1 Weekly Plan · account: basic info on who is signed in and their access level; preferences of each account
   Name and photo come from the signed-in account (claude.ai profile, or the Supabase profile when that backend is on). */
S.account={name:'',avatar:'',id:null};

function roleInfo(){
  if(S.backend==='supabase'){const L=levelOf(S.level)||levelOf('viewer');
    return {label:L.th+(S.isHr?' · HR':''),desc:`${L.en} · แผนก ${DEPT()} · ${L.desc}${S.canWrite||!L.perm.edit?'':' (ตอนนี้บันทึกไม่ได้ ฐานข้อมูลปฏิเสธการเขียน)'}`,level:L.perm.edit?'editor':L.id==='ga'?'editor':'viewer'}}
  if(S.mode==='live')return S.canWrite
    ?{label:'แก้ไขแผนได้',desc:'เพิ่ม แก้ ลบแผนงานและข้อมูลหลักได้',level:'editor'}
    :{label:'ดูอย่างเดียว',desc:'เปิดดูแผนได้ แก้ไขไม่ได้ ขอสิทธิ์ Contributor จากเจ้าของหน้านี้',level:'viewer'};
  if(S.mode==='connecting')return {label:'กำลังเชื่อมต่อ…',desc:'',level:'viewer'};
  return {label:'ทดลองใช้',desc:'โหมดออฟไลน์ ข้อมูลที่แก้จะหายเมื่อปิดหน้า',level:'demo'};
}
const accountSource=()=>S.backend==='supabase'?'บัญชีกลาง (อีเมลและรหัสผ่าน)':S.mode==='live'?'บัญชี claude.ai':S.mode==='connecting'?'กำลังเชื่อมต่อ…':'ยังไม่ได้เข้าสู่ระบบ';
const accountStore=()=>S.backend==='supabase'?`Supabase กลาง · แผนก ${DEPT()}`:S.mode==='live'?'claude.ai · ข้อมูลร่วมของทีม':'ในเบราว์เซอร์นี้ชั่วคราว';
const accountName=()=>S.account.name||(S.mode==='connecting'?'กำลังเชื่อมต่อ…':S.mode==='live'?'ผู้ใช้ claude.ai':'ผู้ใช้ทดลอง');

function setAccount(a){Object.assign(S.account,a);renderAccountCard()}
function renderAccountCard(){
  const name=accountName();const av=S.account.avatar||avatarFor(name);const r=roleInfo();
  ['#meAv','#meAv2'].forEach(s=>{const i=$(s);if(i&&i.getAttribute('src')!==av)i.src=av});
  $('#meName').textContent=name;$('#meRole').textContent=r.label;$('#me').title=`${name} · ${r.label}`;
}

function openAccount(){
  const name=accountName();const r=roleInfo();const av=S.account.avatar||avatarFor(name);
  const email=(S.auth&&S.auth.user&&S.auth.user.email)||'';
  const myStaff=S.staff.find(s=>norm(s.name)===norm(name));
  /* sign-in details of the central account (Supabase mode) */
  const u=S.backend==='supabase'&&S.auth&&S.auth.user||null;
  const when=v=>{const d=v?new Date(v):null;return d&&!isNaN(d)?`${thDate(ymd(d))} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`:'—'};
  /* basic view (user, 8 Oct 2026): who, level, department, last sign-in; technical details stay in จัดการข้อมูล › การตั้งค่า */
  const L=S.backend==='supabase'?levelOf(S.level)||levelOf('viewer'):null;
  const rows=[
    myStaff?['ตำแหน่ง',esc(myStaff.role||'—')]:null,
    ['สิทธิ์',`${esc(r.label)}<small>${esc(L?L.desc:r.desc)}</small>`],
    u?['แผนก',esc(DEPT())]:['เข้าใช้งานด้วย',esc(accountSource())],/* other departments the account reaches: not shown (user, 8 Oct 2026) */
    u?['เข้าสู่ระบบล่าสุด',esc(when(u.last_sign_in_at))]:null,
  ].filter(Boolean);
  $('#acctBody').innerHTML=`
    <div class="acct-basic"><img src="${esc(av)}" alt=""><div><h2 id="acctTitle">${esc(name)}</h2>${email&&norm(email)!==norm(name)?`<p>${esc(email)}</p>`:''}<span class="acct-role ${esc(r.level)}">${esc(r.label)}</span></div></div>
    <dl class="acct-rows">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${u?pwFormHtml(email):''}
    <p class="acct-more"><button type="button" class="lnk" data-action="goto-prefs">ไปที่การตั้งค่า</button></p>`;
  $('#acctLogout').hidden=S.backend!=='supabase';
  $('#acctNote').textContent=S.mode==='live'&&S.backend!=='supabase'?'ชื่อและรูปมาจากบัญชี claude.ai':'';
  const d=$('#acctDlg');if(!d.open)d.showModal();
}

/* เปลี่ยนรหัสผ่าน (user, 10 Oct 2026: "ผู้ใช้งานระบบ สามารถเปลี่ยนรหัสผ่านได้ในหน้าบัญชี"): central account only.
   The current password is checked first (signing in again with it), then sb.auth.updateUser({password}). */
function pwFormHtml(email){
  return `<details class="acct-pw" id="acctPw"><summary><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.4"/></svg><b>เปลี่ยนรหัสผ่าน</b><small>ใช้กับทุกแอปที่เข้าด้วยบัญชีกลางนี้</small></summary>
    <form id="acctPwForm" class="acct-pw-form" novalidate>
      <input type="email" name="username" autocomplete="username" value="${esc(email)}" hidden>
      <label class="field"><span>รหัสผ่านปัจจุบัน</span><span class="pw-wrap"><input id="cp-cur" type="password" autocomplete="current-password" required><button type="button" class="pw-eye" data-pw-toggle aria-label="แสดงรหัสผ่าน">แสดง</button></span></label>
      <label class="field"><span>รหัสผ่านใหม่ <small class="hint">อย่างน้อย 8 ตัวอักษร</small></span><span class="pw-wrap"><input id="cp-new" type="password" autocomplete="new-password" minlength="8" required><button type="button" class="pw-eye" data-pw-toggle aria-label="แสดงรหัสผ่าน">แสดง</button></span></label>
      <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input id="cp-new2" type="password" autocomplete="new-password" minlength="8" required></label>
      <p class="acct-pw-msg" id="cpMsg" role="alert" hidden></p>
      <div class="acct-pw-row"><button type="submit" class="btn primary" id="cpSave">บันทึกรหัสผ่านใหม่</button><span class="hint">ลืมรหัสผ่านปัจจุบัน? ออกจากระบบแล้วกด "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบ</span></div>
    </form></details>`;
}
function cpMsg(text,kind){const el=$('#cpMsg');if(!el)return;el.textContent=text||'';el.className='acct-pw-msg'+(kind?' '+kind:'');el.hidden=!text}
async function changePassword(){
  const cur=$('#cp-cur').value,pw=$('#cp-new').value,pw2=$('#cp-new2').value;
  const fail=(m,f)=>{cpMsg(m,'err');if(f)$(f).focus()};
  if(!cur)return fail('ใส่รหัสผ่านปัจจุบัน','#cp-cur');
  if(pw.length<8)return fail('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร','#cp-new');
  if(pw!==pw2)return fail('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน','#cp-new2');
  if(pw===cur)return fail('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน','#cp-new');
  if(typeof sb==='undefined'||!sb||!S.auth||!S.auth.email)return fail('เปลี่ยนรหัสผ่านได้เมื่อเข้าสู่ระบบด้วยบัญชีกลางเท่านั้น');
  const btn=$('#cpSave');btn.disabled=true;cpMsg('กำลังบันทึก…');
  try{
    const chk=await withTimeout(sb.auth.signInWithPassword({email:S.auth.email,password:cur}),15000);
    if(chk.error){fail(/invalid login|credentials/i.test(chk.error.message||'')?'รหัสผ่านปัจจุบันไม่ถูกต้อง':authText(chk.error),'#cp-cur');return}
    const {data,error}=await withTimeout(sb.auth.updateUser({password:pw}),15000);
    if(error){fail(/reauth/i.test(error.message||'')?'ระบบกลางต้องยืนยันตัวตนอีกครั้ง ใช้ "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบเพื่อรับลิงก์ตั้งรหัสใหม่ทางอีเมล':authText(error));return}
    if(data&&data.user)S.auth.user=data.user;
    ['#cp-cur','#cp-new','#cp-new2'].forEach(s=>{$(s).value=''});cpMsg('เปลี่ยนรหัสผ่านแล้ว ครั้งหน้าเข้าสู่ระบบด้วยรหัสผ่านใหม่','ok');toast('เปลี่ยนรหัสผ่านแล้ว');
  }catch(e){fail(authText(e))}
  finally{btn.disabled=false}
}
document.addEventListener('submit',e=>{if(e.target.id!=='acctPwForm')return;e.preventDefault();changePassword()});
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#acctPwForm')&&$('#cpMsg')&&$('#cpMsg').classList.contains('err'))cpMsg('')});

/* preferences of the signed-in account (js/core/state.js keeps them per account): shown in the account window and in จัดการข้อมูล › การตั้งค่า */
const PREF_GROUPS=[
  ['หน้าตา',[
    {id:'dark',label:'โหมดมืด',desc:'พื้นสีเข้ม สบายตาเวลาใช้ในที่แสงน้อย',get:()=>isDark(),set:v=>{if(v!==isDark())toggleTheme()}},
    {id:'mini',label:'ย่อเมนูด้านซ้าย',desc:'เหลือแต่ไอคอน ตารางจะกว้างขึ้น',get:()=>document.body.classList.contains('mini'),set:v=>{document.body.classList.toggle('mini',v);remember('bu1wp.mini',v?'1':'0');setTimeout(moveInd,240)}},
  ]],
  ['Weekly Plan',[
    {id:'cust',label:'จัดแถวตามลูกค้า',desc:'ปิดไว้ = จัดแถวตามหัวข้องาน',get:()=>S.pf.by==='cust',set:v=>{S.pf.by=v?'cust':'type';S.pf.groups=[];remember('bu1wp.by',S.pf.by)}},
    {id:'avail',label:'แสดงแถวคนว่าง (Available)',desc:'แถวล่างสุดของตาราง บอกคนที่ว่างทั้งวัน ว่างเช้า และว่างบ่าย',get:()=>S.showAvail,set:v=>{S.showAvail=v;remember('bu1wp.avail',v?'1':'0')}},
  ]],
  ['สรุปรายคน',[
    {id:'sun',label:'แสดงวันอาทิตย์',desc:'ปิดไว้ = แสดงจันทร์ถึงเสาร์',get:()=>S.showSun,set:v=>{S.showSun=v;remember('bu1wp.sun7',v?'1':'0')}},
    {id:'busy',label:'แสดงเฉพาะคนที่มีงาน',desc:'ซ่อนคนที่ไม่มีแผนเลยในสัปดาห์นั้น',get:()=>S.pf.busy,set:v=>{S.pf.busy=v;remember('bu1wp.pfbusy',v?'1':'0')}},
  ]],
  ['Dashboard',[
    {id:'dashMonth',label:'เปิดเป็นรายเดือน',desc:'ปิดไว้ = รายสัปดาห์',get:()=>S.dash.mode==='month',set:v=>{S.dash.mode=v?'month':'week';remember('bu1wp.dash',S.dash.mode)}},
  ]],
];
const prefScopeText=()=>S.backend==='supabase'?'บันทึกไว้กับบัญชีนี้ เข้าสู่ระบบจากเครื่องอื่นก็ได้การตั้งค่าเดิม แต่ละบัญชีตั้งค่าแยกกัน'
  :S.mode==='live'?'บันทึกไว้กับบัญชีนี้ในเบราว์เซอร์นี้ คนอื่นที่ใช้เครื่องเดียวกันตั้งค่าแยกกัน':'โหมดทดลอง การตั้งค่าจำไว้ในเบราว์เซอร์นี้';
const PREF_DEFAULTS={mini:false,cust:false,avail:true,sun:true,busy:false,dashMonth:false};
const allPrefs=()=>PREF_GROUPS.flatMap(g=>g[1]);
function prefsHtml(){
  return `<div class="pref-groups">${PREF_GROUPS.map(([g,list])=>`<div class="pref-grp"><h4>${esc(g)}</h4>${list.map(p=>`<label class="pref-row"><span class="pref-txt"><b>${esc(p.label)}</b><small>${esc(p.desc)}</small></span><span class="switch"><input type="checkbox" data-pref="${p.id}"${p.get()?' checked':''} aria-label="${esc(p.label)}"></span></label>`).join('')}</div>`).join('')}</div>`;
}
function resetPrefs(){
  for(const p of allPrefs())if(p.id in PREF_DEFAULTS)p.set(PREF_DEFAULTS[p.id]);
  forget('theme');document.documentElement.removeAttribute('data-theme');syncThemeLbl();
  render();if($('#acctDlg').open)openAccount();toast('คืนค่าการตั้งค่าเริ่มต้นแล้ว');
}
function prefsSection(){
  const r=roleInfo();const n=allPrefs().length;
  const changed=allPrefs().filter(p=>p.id in PREF_DEFAULTS&&p.get()!==PREF_DEFAULTS[p.id]).length;
  const info=[
    ['เวอร์ชัน',`v${APP_VERSION} · BU1 Lab`],
    ['ข้อมูลเก็บที่',accountStore()],
    ['เข้าใช้งานด้วย',accountSource()],
    ['สิทธิ์ของคุณ',r.label],
    ['แผนสูงสุดต่อวัน',`${MAX_CARDS} แผน`],
    ['ขนาดหน้าจอ',`${Math.round(uiZoom()*100)}% · ปรับตามความกว้างหน้าจออัตโนมัติ`],
    ['ไฟล์แนบต่อแผน',`รูป ${MAX_PHOTOS} รูป · ไฟล์ ${MAX_FILES} ไฟล์ (ไม่เกิน ${MAX_FILE_BYTES/1048576} MB ต่อไฟล์)`],
    ['ข้อมูลในระบบ',`พนักงาน ${S.staff.filter(s=>s.active!==false).length} คน · รถ ${vehicles().filter(v=>v.active!==false).length} คัน · โปรเจกต์ ${S.projects.length} · แผนสัปดาห์นี้ ${S.tasks.length}`],
  ];
  return {id:'prefs',title:'การตั้งค่า',sub:changed?`ปรับแล้ว ${changed} รายการ · ข้อมูลระบบ`:'การแสดงผล · ข้อมูลระบบ',count:n,
    desc:'การแสดงผลที่จำไว้กับบัญชีของคุณ ไม่กระทบคนอื่นในทีม และข้อมูลของระบบ',
    body:`<h3 class="pref-h">การแสดงผลของบัญชี${S.me&&/@/.test(S.me)?` <small class="hint">${esc(S.me)}</small>`:''}</h3><p class="hint">${esc(prefScopeText())}</p>${prefsHtml()}
      <div class="pref-actions"><button type="button" class="btn" data-action="reset-prefs">คืนค่าเริ่มต้น</button><span class="hint">โหมดมืดจะกลับไปใช้ตามการตั้งค่าของเครื่อง</span></div>
      <h3 class="pref-h">ข้อมูลระบบ</h3>
      <dl class="acct-info">${info.map(([k,v],i)=>`<div${i>=info.length-2?' class="wide"':''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`};
}

document.addEventListener('click',e=>{
  if(e.target.closest('[data-action="account"]')){openAccount();return}
  if(e.target.closest('[data-action="goto-prefs"]')){$('#acctDlg').close();S.md='prefs';remember('bu1wp.md','prefs');goView('settings');window.scrollTo(0,0);return}
  if(e.target.closest('[data-action="reset-prefs"]')){resetPrefs();return}
  if(e.target.closest('[data-acct-close]')||e.target===$('#acctDlg')||e.target.closest('#acctDlg [data-edit]'))$('#acctDlg').close();
});
document.addEventListener('change',e=>{
  const t=e.target;const p=t.dataset&&t.dataset.pref&&allPrefs().find(x=>x.id===t.dataset.pref);if(!p)return;
  p.set(t.checked);S.anim='view';render();
});
