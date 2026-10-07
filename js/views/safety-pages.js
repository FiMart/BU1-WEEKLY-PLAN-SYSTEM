'use strict';
/* BU1 Weekly Plan · Safety Training pages (after the Safety pages inside BU2's Weekly Plan; central Supabase only)
   Tabs: Dashboard พื้นที่ · คำขอของฉัน · บันทึกย้อนหลัง · เอกสาร / ใบรับรอง, plus the "ขออบรม" form (js/features/safety-forms.js).
   Queries follow the old BU1 / BU2 app (v2.8.0 bundle) and handoff/CLAUDE-HANDOFF.md §4:
   - people come from the HR roster core.employees (dept_code = BU1, status active)
   - card status: js/features/cert-status.js (same rules as BU2)
   - request status, 5 steps (migration 0042): requested เตรียมเอกสาร → booking_sent ส่งคำขอจองอบรม → scheduled นัดอบรม
     → awaiting_card รอรับบัตร → completed เสร็จสิ้น (+ draft, cancelled). The planner never moves the status: the officer does it in the Safety app.
   - Safety data is supporting information: if it fails to load the plan keeps working
   - files: names through safeFileName() (Thai names fail with "Invalid key"); the real name is kept in attachments.note;
     downloads fetch a blob and name it here (never ?download=, Thai names break)
   Writes (requests, people, certificates, files) go to the production database: they are refused while BU1_CONFIG.readOnly is on. */
S.sf={tab:'dash',area:'',filter:'all',q:'',dq:'',dtype:''};
const SF={emps:null,reqs:null,docs:null,at:{},busy:{},err:{},again:{}};
const sfDb=()=>sb.schema('safety'),coreDb=()=>sb.schema('core');
const sfCanWrite=()=>S.backend==='supabase'&&!isReadOnly()&&!!S.perm.edit;
const SF_RO_MSG='ตอนนี้เป็นโหมดอ่านอย่างเดียว ยังส่งหรือแก้ข้อมูล Safety ไม่ได้ (รออนุมัติเปิดการบันทึก)';
function sfGuard(){if(sfCanWrite())return true;toast(isReadOnly()?SF_RO_MSG:'บัญชีนี้ไม่มีสิทธิ์แก้ไข');return false}

/* ---------- shared helpers ---------- */
const reqCode=(no,at,id)=>no==null?String(id||'').slice(0,8):`FLS-${new Date(at).getFullYear()}-Safety-${String(no).padStart(4,'0')}`;
const sfDate=s=>s?fmtDayY(String(s).slice(0,10)):'—';
const sfPill=(kind,label)=>`<span class="sf-pill k-${kind}">${esc(label)}</span>`;
const sfDot=kind=>`<i class="sf-dot k-${kind}" aria-hidden="true"></i>`;
/* storage keys: ASCII only (BU2 safeFileName) */
function safeFileName(name){
  const i=name.lastIndexOf('.');
  const base=(i>0?name.slice(0,i):name).replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'file';
  const ext=i>0?name.slice(i).replace(/[^A-Za-z0-9.]+/g,''):'';
  return base.slice(0,80)+ext;
}
const uuid=()=>(crypto.randomUUID?crypto.randomUUID():newId('u'));
async function sfChunkIn(ids,mk){const out=[];for(let i=0;i<ids.length;i+=200)out.push(...await safePages(()=>mk(ids.slice(i,i+200)),'id'));return out}
const empName=code=>((SF.emps||[]).find(e=>e.emp_code===code)||{}).full_name||code;
const KIND_LABEL={ok:CERT_LABEL.ok,warn:CERT_LABEL.warn,bad:CERT_LABEL.bad,none:CERT_LABEL.none};
const RQ_STATUS={draft:['none','Draft'],requested:['info','เตรียมเอกสาร'],booking_sent:['info','ส่งคำขอจองอบรม'],scheduled:['warn','นัดอบรม'],
  awaiting_card:['warn','รอรับบัตร'],completed:['ok','เสร็จสิ้น'],cancelled:['none','ยกเลิก']};
const RQ_STEPS=['requested','booking_sent','scheduled','awaiting_card','completed'];
const RQ_RESULT={pending:['none','รอผล'],passed:['ok','ผ่าน'],failed:['bad','ไม่ผ่าน'],no_show:['none','ไม่มา']};
const RQ_EVENT={people_updated:'แก้ไขรายชื่อ',cancelled:'ยกเลิกคำขอ',reopened:'เปิดคำขอใหม่'};
const RQ_TYPE={new:'อบรมบัตรใหม่',renewal:'ต่ออายุบัตร',add_area:'เพิ่มพื้นที่'};
const RQ_SESSION={morning:'รอบเช้า',afternoon:'รอบบ่าย',full:'เต็มวัน'};
const rqPill=s=>{const x=RQ_STATUS[s]||['none',s||'—'];return sfPill(x[0],x[1])};

/* cached loads: drawn at once from cache, refreshed when older than ~1 minute (other apps change these tables) */
async function sfLoad(key,fn,force){
  if(SF.busy[key]){if(force)SF.again[key]=fn;return}
  /* a failed read waits too: the redraw after a failure used to start the same read again at once, which failed again —
     an endless loop that froze the page and hammered the database (user, 7 Oct 2026: "โหลดข้อมูลค้าง") */
  if(!force&&(SF[key]||SF.err[key])&&Date.now()-(SF.at[key]||0)<55000)return;
  SF.busy[key]=true;
  try{SF[key]=await sfTimeout(fn());SF.err[key]=''}catch(e){SF.err[key]=String((e&&e.message)||e||'โหลดไม่สำเร็จ');if(!SF[key])SF[key]=null}
  finally{SF.busy[key]=false;SF.at[key]=Date.now();sfRedraw();const again=SF.again[key];if(again){delete SF.again[key];setTimeout(()=>sfLoad(key,again,true),0)}}
}
/* "ลองใหม่" on an error: everything is read again */
function sfRetry(){SF.err={};SF.at={};SAFE.err='';SAFE.at=0;loadSafety(true);fillSafety()}
const loadEmps=()=>safePages(()=>coreDb().from('employees').select('emp_code,full_name,email,dept_code,position_code,status').eq('dept_code',DEPT()).eq('status','active'),'emp_code')
  .then(l=>l.sort((a,b)=>a.full_name.localeCompare(b.full_name,'th')));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.view==='safety')sfRedraw()});
setInterval(()=>{if(!document.hidden&&S.view==='safety')sfRedraw()},60000);

/* ---------- page shell ---------- */
const SF_TABS=[['dash','Dashboard พื้นที่'],['link','จับคู่พนักงาน'],['req','คำขอของฉัน'],['back','บันทึกย้อนหลัง'],['docs','เอกสาร / ใบรับรอง']];
function renderSafety(){
  if(S.backend!=='supabase')return emptyState('Safety Training ใช้ได้เมื่อเชื่อมฐานข้อมูลกลาง','ข้อมูลบัตรและคำขออบรมอยู่ในระบบ Safety ของบริษัท เปิดผ่านเว็บที่ต่อ Supabase กลางแล้วล็อกอินด้วยบัญชี BU1','','!');
  return `<div class="sf-top"><div class="seg sf-tabs" role="tablist" aria-label="หน้า Safety">${SF_TABS.map(([id,l])=>`<label><input type="radio" name="sf-tab" value="${id}"${S.sf.tab===id?' checked':''}><span>${l}</span></label>`).join('')}</div>
      <span class="grow"></span><button type="button" class="btn primary" data-sf="request"${sfCanWrite()?'':` title="${esc(isReadOnly()?SF_RO_MSG:'ไม่มีสิทธิ์')}"`}>+ ขออบรม</button></div>
    <div id="sfBody">${loading()}</div>`;
}
function fillSafety(){
  if(!$('#sfBody'))return;
  ({dash:drawDash,link:drawLink,req:drawReqs,back:drawBacklog,docs:drawDocs}[S.sf.tab]||drawDash)();
}
const sfError=msg=>`<div class="banner err"><b>โหลดข้อมูล Safety ไม่สำเร็จ</b> ${esc(msg)} · การจัดแผนงานยังใช้ได้ตามปกติ <button type="button" class="btn sm" data-sf-retry>ลองใหม่</button></div>`;
document.addEventListener('click',e=>{if(e.target.closest('[data-sf-retry]'))sfRetry()});

/* ---------- Dashboard พื้นที่: card status of the whole team for one area ---------- */
/* layout: area list (with how many can enter) · area header with progress · status tiles that filter · people table */
function teamStatus(areaId){
  const rule=areaRule(SAFE,areaId);
  const rows=(SF.emps||[]).map(e=>{if(!rule)return {e,k:'none',exp:null};const exp=latestExpiry(SAFE,e.emp_code,rule,areaId);return {e,k:certStatus(exp,rule.warn_days_before),exp}});
  const ord={ok:0,warn:1,bad:2,none:3};
  rows.sort((a,b)=>ord[a.k]-ord[b.k]||String(a.exp||'').localeCompare(String(b.exp||''))||a.e.full_name.localeCompare(b.e.full_name,'th'));
  const n={ok:0,warn:0,bad:0,none:0};rows.forEach(r=>n[r.k]++);
  return {rule,rows,n};
}
const sfDashRows=()=>teamStatus(S.sf.area);
/* areas in order: each main area followed by its sub-areas */
function dashAreas(){
  const areas=SAFE.areas.filter(a=>a.active!==false);const byName=(x,y)=>x.name.localeCompare(y.name,'th');const ids=new Set(areas.map(a=>a.id));
  const out=[];areas.filter(a=>!a.parent_id||!ids.has(a.parent_id)).sort(byName).forEach(m=>{out.push(m);areas.filter(a=>a.parent_id===m.id).sort(byName).forEach(s=>out.push(s))});
  return out;
}
const daysLeft=exp=>{if(!exp)return '';const t=new Date();t.setHours(0,0,0,0);const d=Math.round((parseD(exp).getTime()-t.getTime())/864e5);return d<0?`เลยมา ${-d} วัน`:d===0?'หมดวันนี้':`อีก ${d} วัน`};
function drawDash(){
  const b=$('#sfBody');sfLoad('emps',loadEmps);loadSafety();
  if(SF.err.emps&&!SF.emps){b.innerHTML=sfError(SF.err.emps);return}
  if(!SAFE.ready||!SF.emps){b.innerHTML=SAFE.err?sfError(SAFE.err):loading();return}
  const areas=dashAreas();
  if(!areas.length){b.innerHTML=emptyState('ยังไม่มีพื้นที่ในระบบ Safety','เจ้าหน้าที่ความปลอดภัยเป็นผู้เพิ่มพื้นที่และกำหนดบัตรที่ต้องใช้ในแอป Safety','','!');return}
  if(!areas.some(a=>a.id===S.sf.area))S.sf.area=areas[0].id;
  const cur=areas.find(a=>a.id===S.sf.area);const parent=cur.parent_id&&SAFE.areas.find(a=>a.id===cur.parent_id);
  const {rule,rows,n}=sfDashRows();const tn=rule?SAFE.types.get(rule.cert_type_id)||rule.cert_type_id:'';
  const pct=rows.length?Math.round(n.ok/rows.length*100):0;
  const list=areas.map(a=>{const s=teamStatus(a.id);const on=a.id===S.sf.area;
    return `<button type="button" class="sf-area${a.parent_id?' sub':''}${on?' on':''}" data-sf-area="${esc(a.id)}" aria-pressed="${on}"><span><b>${esc(a.name)}</b><small>${esc(a.client||a.id)}</small></span>${s.rule?`<em title="เข้าได้ตอนนี้">${s.n.ok}/${s.rows.length}</em>`:'<em class="none" title="ยังไม่ได้กำหนดบัตร">—</em>'}</button>`}).join('');
  const tile=(k,label)=>`<button type="button" class="sf-kpi k-${k}${S.sf.filter===k?' on':''}" data-sf-filter="${k}" aria-pressed="${S.sf.filter===k}"><span>${esc(label)}</span><b>${k==='all'?rows.length:n[k]}</b></button>`;
  b.innerHTML=`<div class="sf-dash">
    <aside class="panel sf-areas" aria-label="พื้นที่"><h3>พื้นที่ <small>${areas.length}</small></h3>
      <select id="sf-areaSel" class="sf-areaSel" aria-label="เลือกพื้นที่">${areas.map(a=>`<option value="${esc(a.id)}"${a.id===S.sf.area?' selected':''}>${a.parent_id?'　└ ':''}${esc(a.name)}</option>`).join('')}</select>
      <div class="sf-area-list">${list}</div></aside>
    <div class="sf-main">
      <section class="panel sf-hero">
        <div class="sf-hero-t"><small>${parent?`พื้นที่รองของ ${esc(parent.name)}`:'พื้นที่หลัก'}${cur.client&&cur.client!==cur.id?` · ลูกค้า ${esc(cur.client)}`:''}</small><h3>${esc(cur.name)} <span class="mono">${esc(cur.id)}</span></h3>
          <p>${rule?`${esc(tn)} · อายุบัตร ${esc(rule.validity_months??'—')} เดือน · เตือนล่วงหน้า ${esc(rule.warn_days_before)} วัน`:'ยังไม่ได้ตั้งค่าประเภทใบรับรองของพื้นที่นี้ ทุกคนจึงแสดงเป็น "ยังไม่เคยอบรม"'}</p></div>
        <div class="sf-hero-n"><span>เข้าได้ตอนนี้</span><b>${n.ok}<small> / ${rows.length} คน</small></b><div class="sf-bar" role="img" aria-label="เข้าได้ ${pct}%"><i class="k-ok" style="width:${rows.length?n.ok/rows.length*100:0}%"></i><i class="k-warn" style="width:${rows.length?n.warn/rows.length*100:0}%"></i><i class="k-bad" style="width:${rows.length?n.bad/rows.length*100:0}%"></i></div></div>
      </section>
      <div class="sf-kpis" role="group" aria-label="กรองตามสถานะ">${tile('all','ทั้งหมด')}${tile('ok',KIND_LABEL.ok)}${tile('warn',KIND_LABEL.warn)}${tile('bad',KIND_LABEL.bad)}${tile('none',KIND_LABEL.none)}</div>
      <section class="panel sf-list">
        <div class="sf-list-h"><input type="search" id="sf-q" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" value="${esc(S.sf.q)}" autocomplete="off" aria-label="ค้นหาพนักงาน"><span class="hint" id="sfShown"></span></div>
        <div class="scroll-x plain"><table class="list sf-table"><thead><tr><th>ชื่อ–นามสกุล</th><th>ตำแหน่ง</th><th>บัตรหมดอายุ</th><th>สถานะ</th></tr></thead><tbody id="sfDashBody"></tbody></table></div>
      </section>
    </div></div>`;
  drawDashTable();
}
function drawDashTable(){
  const body=$('#sfDashBody');if(!body)return;
  const {rows}=sfDashRows();const q=norm(S.sf.q);
  const list=rows.filter(r=>(S.sf.filter==='all'||r.k===S.sf.filter)&&(!q||norm(r.e.full_name+' '+r.e.emp_code).includes(q)));
  body.innerHTML=list.map(r=>`<tr class="sf-row" data-sf-emp="${esc(r.e.emp_code)}" tabindex="0">
      <td><div class="sf-who"><span class="avatar sm" aria-hidden="true">${esc(initialOf(r.e.full_name))}</span><span><b>${esc(r.e.full_name)}</b><span class="sub">${esc(r.e.emp_code)}</span></span></div></td>
      <td class="hint">${esc(r.e.position_code||'—')}</td>
      <td>${r.exp?`${esc(sfDate(r.exp))}<span class="sub k-${r.k}">${esc(daysLeft(r.exp))}</span>`:'<span class="hint">—</span>'}</td>
      <td>${sfPill(r.k,KIND_LABEL[r.k])}</td></tr>`).join('')
    ||`<tr><td colspan="4" class="hint" style="padding:22px 14px">${rows.length?'ไม่มีคนที่ตรงกับตัวกรอง':`ยังไม่มีข้อมูลทีมงานสำหรับแผนก ${esc(DEPT())}`}</td></tr>`;
  const s=$('#sfShown');if(s)s.textContent=`แสดง ${list.length} จาก ${rows.length} คน · กดชื่อเพื่อดูใบรับรองทั้งหมด`;
  document.querySelectorAll('[data-sf-filter]').forEach(x=>{const on=x.dataset.sfFilter===S.sf.filter;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});
}

/* ---------- one person: every certificate + ID-card photos ---------- */
function sfOpen(title,sub,body,foot,wide){
  $('#sfDlgTitle').textContent=title;$('#sfDlgSub').textContent=sub||'';$('#sfDlgBody').innerHTML=body;$('#sfDlgFoot').innerHTML=foot||'<span class="grow"></span><button type="button" class="btn" data-sf-close>ปิด</button>';
  const d=$('#sfDlg');d.classList.toggle('wide',!!wide);if(!d.open)d.showModal();
}
async function openPerson(code){
  const e=(SF.emps||[]).find(x=>x.emp_code===code)||{emp_code:code,full_name:code};
  sfOpen(e.full_name,`${e.emp_code} · ${e.position_code||'—'}`,loading());
  try{
    const [cr,ph]=await sfTimeout(Promise.all([
      sfDb().from('certificates').select('*, cert_types(name), areas(name)').eq('emp_code',code).order('issued_date',{ascending:false}),
      sfDb().from('attachments').select('*').eq('emp_code',code).eq('kind','id_card_photo').order('uploaded_at',{ascending:false})]));
    if(cr.error||ph.error)throw cr.error||ph.error;
    const warn=new Map(SAFE.rules.map(r=>[`${r.area_id}|${r.cert_type_id}`,r.warn_days_before]));
    const photos=await Promise.all((ph.data||[]).map(async a=>{const s=await sb.storage.from('safety-docs').createSignedUrl(a.storage_path,3600);return Object.assign({},a,{url:(s.data||{}).signedUrl||null})}));
    if(!$('#sfDlg').open)return;
    const certs=cr.data||[];
    $('#sfDlgBody').innerHTML=`<h4 class="sf-h">ใบรับรองทั้งหมด (${certs.length})</h4>
      ${certs.map(c=>{const k=certStatus(c.expiry_date,warn.get(`${c.area_id}|${c.cert_type_id}`)??30);
        return `<div class="sf-cert"><div><b>${esc((c.cert_types||{}).name||c.cert_type_id)}</b><span>${esc((c.areas||{}).name||c.area_id||'ทั่วไป')}</span>
          <small>ออก ${esc(sfDate(c.issued_date))} · หมดอายุ ${esc(sfDate(c.expiry_date))}${c.cert_number?` · เลขที่ ${esc(c.cert_number)}`:''}</small>${c.card_issued?'<small class="ok">✓ ออกบัตรแล้ว</small>':''}</div>
          <div>${sfDot(k)} ${sfPill(k,KIND_LABEL[k])}</div></div>`}).join('')||'<p class="hint">ยังไม่มีใบรับรอง</p>'}
      <h4 class="sf-h">รูปหน้าบัตรที่แนบไว้ (${photos.length})</h4>
      ${photos.length?`<div class="sf-photos">${photos.map(p=>p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="รูปหน้าบัตร"><small>${esc(sfDate(p.uploaded_at))}</small></a>`:`<span class="sf-nophoto">โหลดไม่ได้</span>`).join('')}</div>`:'<p class="hint">ยังไม่มีรูปแนบ</p>'}`;
  }catch(err){$('#sfDlgBody').innerHTML=sfError((err&&err.message)||String(err))}
}

/* ---------- คำขอของฉัน: every request this department sent ---------- */
async function loadReqs(){
  const reqs=await safePages(()=>sfDb().from('training_requests').select('*, areas(name), cert_types(name)').eq('dept_id',DEPT()),'requested_at');
  const ids=reqs.map(r=>r.id);
  const people=await sfChunkIn(ids,part=>sfDb().from('request_people').select('request_id,emp_code').in('request_id',part)).catch(()=>[]);
  const n=new Map();people.forEach(p=>n.set(p.request_id,(n.get(p.request_id)||0)+1));
  return reqs.map(r=>Object.assign({},r,{areaName:(r.areas||{}).name||r.requested_area_name||null,certName:(r.cert_types||{}).name||null,peopleCount:n.get(r.id)||0}))
    .sort((a,b)=>String(b.requested_at).localeCompare(String(a.requested_at)));
}
function drawReqs(){
  const b=$('#sfBody');sfLoad('reqs',loadReqs);sfLoad('emps',loadEmps);
  if(SF.err.reqs&&!SF.reqs){b.innerHTML=sfError(SF.err.reqs);return}
  if(!SF.reqs){b.innerHTML=loading();return}
  const all=SF.reqs;const f=S.sf.rqf||'';
  const cnt=s=>all.filter(x=>x.status===s).length;
  const list=all.filter(x=>!f||(f==='open'?!['completed','cancelled'].includes(x.status):x.status===f));
  const stepCell=s=>{const i=RQ_STEPS.indexOf(s);return i<0?'':`<span class="sf-track" aria-hidden="true">${RQ_STEPS.map((_,j)=>`<i class="${j<i?'done':j===i?'on':''}"></i>`).join('')}</span>`};
  b.innerHTML=`<div class="sf-stages" role="group" aria-label="กรองตามขั้นตอน">
      <button type="button" class="sf-stage${!f?' on':''}" data-sf-rqf=""><span>ทั้งหมด</span><b>${all.length}</b></button>
      <button type="button" class="sf-stage${f==='open'?' on':''}" data-sf-rqf="open"><span>กำลังดำเนินการ</span><b>${all.filter(x=>!['completed','cancelled'].includes(x.status)).length}</b></button>
      ${RQ_STEPS.map((s,i)=>`<button type="button" class="sf-stage k-${RQ_STATUS[s][0]}${f===s?' on':''}" data-sf-rqf="${s}"><span><em>${i+1}</em>${esc(RQ_STATUS[s][1])}</span><b>${cnt(s)}</b></button>`).join('')}
      ${cnt('draft')||cnt('cancelled')?`<button type="button" class="sf-stage k-none${f==='draft'?' on':''}" data-sf-rqf="draft"><span>Draft</span><b>${cnt('draft')}</b></button><button type="button" class="sf-stage k-none${f==='cancelled'?' on':''}" data-sf-rqf="cancelled"><span>ยกเลิก</span><b>${cnt('cancelled')}</b></button>`:''}
    </div>
    <section class="panel sf-list">
      <div class="sf-list-h"><span class="hint">คำขออบรมที่ ${esc(DEPT())} เคยส่ง · สถานะเปลี่ยนโดยเจ้าหน้าที่ความปลอดภัยในแอป Safety · กดแถวเพื่อดูรายละเอียด</span></div>
      <div class="scroll-x plain"><table class="list sf-table"><thead><tr><th>รหัสคำขอ</th><th>พื้นที่ / ใบรับรอง</th><th>ผู้จอง</th><th>คน</th><th>สถานะ</th></tr></thead><tbody>
      ${list.map(x=>`<tr class="sf-row" data-sf-req="${esc(x.id)}" tabindex="0"><td><span class="mono sf-code">${esc(reqCode(x.request_no,x.requested_at,x.id))}</span><span class="sub">ส่ง ${esc(sfDate(x.requested_at))}</span></td>
        <td><b>${esc(x.areaName||'—')}</b><span class="sub">${esc(x.certName||'—')} · ${esc(RQ_TYPE[x.request_type]||'')}</span></td>
        <td class="hint">${esc(String(x.requested_by||'—').split('@')[0])}</td><td class="num"><b>${x.peopleCount}</b></td>
        <td><div class="sf-stcell">${rqPill(x.status)}${stepCell(x.status)}</div></td></tr>`).join('')
        ||`<tr><td colspan="5" class="hint" style="padding:22px 14px">${all.length?'ไม่มีคำขอในขั้นตอนนี้':'ยังไม่เคยส่งคำขออบรม'}</td></tr>`}
      </tbody></table></div></section>`;
}
const RQ={id:null,people:null,events:[],editing:false,sel:new Set(),q:''};
const rqOf=id=>(SF.reqs||[]).find(x=>x.id===id)||null;
async function openRequest(id){
  RQ.id=id;RQ.people=null;RQ.events=[];RQ.editing=false;RQ.q='';drawRequest();
  try{
    const [p,ev]=await sfTimeout(Promise.all([sfDb().from('request_people').select('emp_code,result,note').eq('request_id',id),
      sfDb().from('training_request_events').select('*').eq('request_id',id).order('created_at',{ascending:false})]));
    if(p.error)throw p.error;
    const codes=(p.data||[]).map(x=>x.emp_code);const known=new Set((SF.emps||[]).map(e=>e.emp_code));
    const missing=codes.filter(c=>!known.has(c));let extra=[];
    if(missing.length){const r=await coreDb().from('employees').select('emp_code,full_name,position_code').in('emp_code',missing);extra=r.data||[]}
    const names=new Map((SF.emps||[]).concat(extra).map(e=>[e.emp_code,e.full_name]));
    if(RQ.id!==id)return;
    RQ.people=(p.data||[]).map(x=>Object.assign({name:names.get(x.emp_code)||x.emp_code},x));RQ.events=ev.data||[];drawRequest();
  }catch(err){if(RQ.id===id){$('#sfDlgBody').innerHTML=sfError((err&&err.message)||String(err))}}
}
function drawRequest(){
  const r=rqOf(RQ.id);if(!r)return;
  const open=r.status==='requested'||r.status==='draft';const step=RQ_STEPS.indexOf(r.status);
  const f=(k,v)=>v?`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`:'';
  const ppl=RQ.people;const passed=ppl?ppl.filter(x=>x.result==='passed').length:0;const showRes=r.status==='completed'||r.status==='awaiting_card';
  let body=`<div class="sf-status">${rqPill(r.status)}${r.status!=='cancelled'&&r.status!=='draft'?`<ol class="sf-steps">${RQ_STEPS.map((s,i)=>`<li class="${i<step?'done':i===step?'on':''}">${esc(RQ_STATUS[s][1])}</li>`).join('')}</ol>`:''}</div>
    <h4 class="sf-h">รายละเอียดการนัดอบรม</h4>
    <dl class="sf-dl">${f('วันที่ส่งคำขอ',sfDate(r.requested_at))}${f('ผู้จอง',r.requested_by)}${f('ประเภทคำขอ',RQ_TYPE[r.request_type])}${f('ใบรับรอง',r.certName)}
      ${f('หลักสูตร',r.course_name)}${f('วันที่อบรม',r.training_date&&sfDate(r.training_date))}${f('รอบ',RQ_SESSION[r.session])}${f('เวลาอบรม',r.training_time)}${f('เวลารถออก',r.bus_time)}
      ${f('สถานที่',r.place)}${f('ลิงก์ประชุม',r.meeting_link)}${f('ผู้ประสานงาน',r.coordinator_name?r.coordinator_name+(r.coordinator_phone?' · '+r.coordinator_phone:''):'')}
      ${f('วันตรวจสุขภาพ',r.health_check_date&&sfDate(r.health_check_date))}${f('วันปฏิบัติงาน',r.work_date&&sfDate(r.work_date))}
      ${f('ผู้ติดต่อเจ้าของงาน',[r.client_contact_name,r.client_contact_phone,r.client_contact_email].filter(Boolean).join(' · '))}${f('ข้อความถึงผู้วางแผน',r.message_to_planer)}${f('หมายเหตุ',r.note)}</dl>
    ${r.prep_note?`<p class="sf-note">เอกสารที่ต้องเตรียม: ${esc(r.prep_note)}</p>`:''}
    ${!r.course_name&&!r.training_date&&!r.place&&!r.prep_note?'<p class="hint">เจ้าหน้าที่ความปลอดภัยยังไม่ได้กรอกรายละเอียดนัดอบรม</p>':''}
    <h4 class="sf-h">รายชื่อ (${ppl?ppl.length:'…'} คน)${open&&!RQ.editing&&ppl?' <button type="button" class="lnk" data-sf="rq-edit">แก้ไขรายชื่อ</button>':''}</h4>`;
  if(!ppl)body+=loading();
  else if(RQ.editing){
    const q=norm(RQ.q);const list=(SF.emps||[]).filter(e=>!q||norm(e.full_name+' '+e.emp_code).includes(q));
    body+=`<input type="search" id="rq-q" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" value="${esc(RQ.q)}" autocomplete="off">
      <div class="sf-pick" id="rqPick">${list.map(e=>`<label class="check"><input type="checkbox" data-rq-emp="${esc(e.emp_code)}"${RQ.sel.has(e.emp_code)?' checked':''}> ${esc(e.full_name)} <small class="hint">${esc(e.emp_code)}</small></label>`).join('')||'<p class="hint">ไม่พบพนักงาน</p>'}</div>`;
  }else body+=`${showRes?`<p class="${passed===ppl.length?'ok':'warn'}"><b>ผ่าน ${passed}/${ppl.length} คน</b></p>`:''}
      <ul class="sf-people">${ppl.map(p=>`<li><span>${esc(p.name)}${p.note?`<small>${esc(p.note)}</small>`:''}</span>${showRes?sfPill(...(RQ_RESULT[p.result]||RQ_RESULT.pending)):''}</li>`).join('')||'<li class="hint">ไม่มีรายชื่อ</li>'}</ul>`;
  if(RQ.events.length)body+=`<h4 class="sf-h">ประวัติการแก้ไข</h4><ul class="sf-events">${RQ.events.map(e=>`<li><b>${esc(RQ_EVENT[e.action]||e.action)}</b> — ${esc(e.actor||'')}${e.detail?`<span>${esc(e.detail)}</span>`:''}<small>${esc(sfDate(e.created_at))}</small></li>`).join('')}</ul>`;
  const foot=RQ.editing?`<span class="grow"></span><button type="button" class="btn" data-sf="rq-edit-cancel">ยกเลิก</button><button type="button" class="btn primary" data-sf="rq-edit-save">บันทึกรายชื่อ</button>`
    :`<button type="button" class="btn danger" data-sf="rq-delete" title="ลบคำขอออกจากระบบถาวร">ลบถาวร</button>${open?'<button type="button" class="btn" data-sf="rq-cancel">ยกเลิกคำขอ</button>':''}<span class="grow"></span><button type="button" class="btn primary" data-sf-close>ปิด</button>`;
  sfOpen(`${reqCode(r.request_no,r.requested_at,r.id)} · ${r.areaName||'—'}`,'รายละเอียดคำขอ',body,foot);
}
async function rqSavePeople(){
  if(!sfGuard())return;const r=rqOf(RQ.id);if(!r||!RQ.people)return;
  const before=new Set(RQ.people.map(p=>p.emp_code));const add=[...RQ.sel].filter(c=>!before.has(c));const del=[...before].filter(c=>!RQ.sel.has(c));
  if(!add.length&&!del.length){RQ.editing=false;drawRequest();return}
  try{
    if(del.length){const {error}=await sfDb().from('request_people').delete().eq('request_id',r.id).in('emp_code',del);if(error)throw error}
    if(add.length){const {error}=await sfDb().from('request_people').insert(add.map(c=>({request_id:r.id,emp_code:c})));if(error)throw error}
    const detail=[add.length&&'เพิ่ม: '+add.map(empName).join(', '),del.length&&'ลบ: '+del.map(empName).join(', ')].filter(Boolean).join(' · ');
    await sfDb().from('training_request_events').insert({request_id:r.id,action:'people_updated',detail});
    r.peopleCount=RQ.sel.size;toast('บันทึกรายชื่อแล้ว');openRequest(r.id);sfLoad('reqs',loadReqs,true);
  }catch(err){toast('บันทึกรายชื่อไม่สำเร็จ: '+((err&&err.message)||err))}
}
async function rqCancel(){
  if(!sfGuard())return;const r=rqOf(RQ.id);if(!r)return;
  if(!confirm(`ยกเลิกคำขอ ${reqCode(r.request_no,r.requested_at,r.id)} ใช่ไหม?`))return;
  try{const {error}=await sfDb().from('training_requests').update({status:'cancelled'}).eq('id',r.id);if(error)throw error;
    await sfDb().from('training_request_events').insert({request_id:r.id,action:'cancelled'});
    r.status='cancelled';toast('ยกเลิกคำขอแล้ว');openRequest(r.id);sfLoad('reqs',loadReqs,true)}
  catch(err){toast('ยกเลิกไม่สำเร็จ: '+((err&&err.message)||err))}
}
async function rqDelete(){
  if(!sfGuard())return;const r=rqOf(RQ.id);if(!r)return;const code=reqCode(r.request_no,r.requested_at,r.id);
  let files=0;try{files=((await sfDb().from('attachments').select('id').eq('request_id',r.id)).data||[]).length}catch(e){}
  const msg=`ลบคำขอ ${code} ออกจากระบบถาวร?\n\nพื้นที่ ${r.areaName||'—'} · ${r.peopleCount} คน · สถานะ ${(RQ_STATUS[r.status]||[])[1]||r.status}\n\n`
    +(r.status==='completed'?'⚠️ คำขอนี้สถานะ "เสร็จสิ้น" แปลว่าออกใบรับรองไปแล้ว — ลบคำขอแล้ว "ใบรับรองจะยังอยู่" ถ้าต้องการเอาออกด้วยต้องให้เจ้าหน้าที่ความปลอดภัยเพิกถอน\n\n':'')
    +(files?`⚠️ คำขอนี้มีไฟล์แนบ ${files} ไฟล์ — ลบคำขอแล้วไฟล์จะค้างในระบบโดยไม่มีที่ให้เปิดดูอีก ถ้ายังต้องใช้ให้ดาวน์โหลดเก็บไว้ก่อน (เจ้าหน้าที่ความปลอดภัยเท่านั้นที่ลบไฟล์ทิ้งได้)\n\n`:'')
    +'ลบแล้วกู้คืนไม่ได้ (รายชื่อผู้เข้าอบรมและประวัติการแก้ไขจะหายไปด้วย)';
  if(!confirm(msg))return;
  try{const {error}=await sfDb().from('training_requests').delete().eq('id',r.id);if(error)throw error;
    SF.reqs=SF.reqs.filter(x=>x.id!==r.id);$('#sfDlg').close();toast(`ลบคำขอ ${code} แล้ว`);fillSafety()}
  catch(err){toast('ลบไม่สำเร็จ: '+((err&&err.message)||err))}
}

/* ---------- เอกสาร / ใบรับรอง: files of BU1 people, download rights set by the Safety officer (0043) ---------- */
async function loadDocs(){
  const emps=SF.emps||await loadEmps();if(!SF.emps)SF.emps=emps;
  const [types,setting,atts]=await Promise.all([
    sfDb().from('doc_types').select('*').order('sort_order').order('name'),
    sfDb().from('settings').select('key,value').eq('key','planner_id_card_photo').maybeSingle(),
    sfChunkIn(emps.map(e=>e.emp_code),part=>sfDb().from('attachments').select('*').in('emp_code',part))]);
  const t=types.error?[]:types.data||[];
  return {types:new Map(t.map(x=>[x.id,x])),typeList:t,photoOk:!setting.data||setting.data.value!=='false',atts:atts.sort((a,b)=>String(b.uploaded_at).localeCompare(String(a.uploaded_at)))};
}
/* mirrors safety.planner_can_read_file(): own upload, ID-card photo when allowed, or a doc type the officer opened */
function canDownload(a,d){
  if(String(a.uploaded_by||'').toLowerCase()===S.auth.email)return true;
  if(a.kind==='id_card_photo')return d.photoOk;
  const t=d.types.get(a.doc_type_id);return !!(t&&t.planner_download);
}
function drawDocs(){
  const b=$('#sfBody');sfLoad('docs',loadDocs);
  if(SF.err.docs&&!SF.docs){b.innerHTML=sfError(SF.err.docs);return}
  if(!SF.docs){b.innerHTML=loading();return}
  const d=SF.docs;const q=norm(S.sf.dq);const ty=S.sf.dtype;
  const typeOf=a=>a.kind==='id_card_photo'?'รูปหน้าบัตร / ใบรับรอง':(d.types.get(a.doc_type_id)||{}).name||(a.kind==='document'?'เอกสาร':'อื่นๆ');
  const list=d.atts.filter(a=>(!ty||(ty==='photo'?a.kind==='id_card_photo':a.doc_type_id===ty))&&(!q||norm([empName(a.emp_code),a.emp_code,a.note,typeOf(a)].join(' ')).includes(q)));
  b.innerHTML=`<div class="toolbar"><select id="sf-dtype" aria-label="ชนิดเอกสาร"><option value="">ทุกชนิดเอกสาร</option><option value="photo"${ty==='photo'?' selected':''}>รูปหน้าบัตร / ใบรับรอง</option>${d.typeList.map(t=>`<option value="${esc(t.id)}"${ty===t.id?' selected':''}>${esc(t.name)}</option>`).join('')}</select>
      <input type="search" id="sf-dq" placeholder="ค้นหาชื่อพนักงาน / ชื่อไฟล์" value="${esc(S.sf.dq)}" autocomplete="off" aria-label="ค้นหาเอกสาร"></div>
    <p class="hint">เจ้าหน้าที่ความปลอดภัยเป็นผู้กำหนดว่าเอกสารชนิดไหนดาวน์โหลดได้ · ไฟล์ที่คุณอัปโหลดเองดาวน์โหลดได้เสมอ</p>
    <div class="scroll-x"><table class="list sf-table"><thead><tr><th>พนักงาน</th><th>ชนิด</th><th>ไฟล์</th><th>หมดอายุ</th><th>อัปโหลดเมื่อ</th><th></th></tr></thead><tbody>
    ${list.slice(0,500).map(a=>{const ok=canDownload(a,d);return `<tr><td><b>${esc(empName(a.emp_code))}</b><span class="sub">${esc(a.emp_code||'')}</span></td><td>${esc(typeOf(a))}</td>
      <td class="hint">${esc(a.note||String(a.storage_path).split('/').pop())}</td><td class="hint">${a.expiry_date?esc(sfDate(a.expiry_date)):'—'}</td><td class="hint">${esc(sfDate(a.uploaded_at))}</td>
      <td>${ok?`<button type="button" class="btn sm" data-sf-dl="${esc(a.id)}">ดาวน์โหลด</button>`:'<span class="hint" title="เจ้าหน้าที่ความปลอดภัยไม่ได้เปิดให้ดาวน์โหลดเอกสารชนิดนี้">ไม่เปิดให้ดาวน์โหลด</span>'}</td></tr>`}).join('')
      ||'<tr><td colspan="6" class="hint" style="padding:20px 12px">ไม่พบเอกสาร</td></tr>'}
    </tbody></table><div class="count-note">${list.length.toLocaleString('th-TH')} ไฟล์${list.length>500?' (แสดง 500 รายการล่าสุด)':''}</div></div>`;
}
async function downloadAtt(id,btn){
  const a=((SF.docs||{}).atts||[]).find(x=>x.id===id);if(!a)return;
  btn.disabled=true;
  try{const {data,error}=await sb.storage.from('safety-docs').download(a.storage_path);if(error)throw error;
    const name=a.note||String(a.storage_path).split('/').pop();await (downloads||browserDownloads).save({filename:name,data})}
  catch(err){toast('ดาวน์โหลดไม่สำเร็จ'+(/not.?found|denied|403|400/i.test(String((err&&err.message)||err))?' (ไม่มีสิทธิ์ หรือไม่พบไฟล์)':''))}
  finally{btn.disabled=false}
}

/* ---------- events ---------- */
document.addEventListener('change',e=>{const t=e.target;
  if(t.name==='sf-tab'){S.sf.tab=t.value;render();return}
  if(t.id==='sf-areaSel'){S.sf.area=t.value;fillSafety();return}
  if(t.id==='sf-dtype'){S.sf.dtype=t.value;fillSafety();return}
  if(t.dataset&&t.dataset.rqEmp){t.checked?RQ.sel.add(t.dataset.rqEmp):RQ.sel.delete(t.dataset.rqEmp)}
});
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='sf-q'){S.sf.q=t.value;drawDashTable()}
  if(t.id==='sf-dq'){S.sf.dq=t.value;clearTimeout(t._tm);t._tm=setTimeout(()=>{fillSafety();const i=$('#sf-dq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)}
  if(t.id==='rq-q'){RQ.q=t.value;const sel=t.selectionStart;drawRequest();const i=$('#rq-q');if(i){i.focus();i.setSelectionRange(sel,sel)}}
});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-sf-close]')||e.target===$('#sfDlg')){$('#sfDlg').close();return}
  const ar=e.target.closest('[data-sf-area]');if(ar){S.sf.area=ar.dataset.sfArea;fillSafety();return}
  const fl=e.target.closest('[data-sf-filter]');if(fl){S.sf.filter=fl.dataset.sfFilter;drawDashTable();return}
  const rf=e.target.closest('[data-sf-rqf]');if(rf){S.sf.rqf=rf.dataset.sfRqf;fillSafety();return}
  const emp=e.target.closest('[data-sf-emp]');if(emp){openPerson(emp.dataset.sfEmp);return}
  const rq=e.target.closest('[data-sf-req]');if(rq){openRequest(rq.dataset.sfReq);return}
  const dl=e.target.closest('[data-sf-dl]');if(dl){downloadAtt(dl.dataset.sfDl,dl);return}
  const a=e.target.closest('[data-sf]');if(!a)return;
  switch(a.dataset.sf){
    case 'rq-edit':RQ.editing=true;RQ.sel=new Set((RQ.people||[]).map(p=>p.emp_code));RQ.q='';drawRequest();break;
    case 'rq-edit-cancel':RQ.editing=false;drawRequest();break;
    case 'rq-edit-save':rqSavePeople();break;
    case 'rq-cancel':rqCancel();break;
    case 'rq-delete':rqDelete();break;
  }
});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.target.classList||!e.target.classList.contains('sf-row'))return;
  const t=e.target;if(t.dataset.sfEmp)openPerson(t.dataset.sfEmp);else if(t.dataset.sfReq)openRequest(t.dataset.sfReq)});
