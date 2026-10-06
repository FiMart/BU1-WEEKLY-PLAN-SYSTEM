'use strict';
/* BU1 Weekly Plan · Safety area cards in the team picker (central Supabase only, read only)
   Chain (handoff/CLAUDE-HANDOFF.md §4): public.people.id → core.person_id_map (dept_id, people_id → emp_code)
   → safety.certificates (emp_code, cert_type_id, area_id, issued_date, expiry_date).
   Areas: safety.areas (2 levels through parent_id, match_terms = confirmed synonyms of the name);
   safety.area_cert_rules say which card types each area needs. The status rules live in js/features/cert-status.js.
   From the hand-off: badges are warnings only (picking is never blocked); if Safety data cannot load, planning carries
   on without badges; other apps change these tables, so they are re-read when the tab comes back and every 60 s.
   A plan keeps its area in task.areaId (= Booking.areaId in public.bookings). */
const SAFE={ready:false,loading:false,at:0,err:'',areas:[],rules:[],types:new Map(),empOf:new Map(),certsByEmp:new Map()};

async function safePages(mk,order){
  const out=[];
  for(let at=0;;at+=1000){
    const {data,error}=await mk().order(order).range(at,at+999);
    if(error)throw error;out.push(...(data||[]));
    if(!data||data.length<1000)break;
  }
  return out;
}
async function loadSafety(force){
  if(S.backend!=='supabase'||!sb||!S.auth.user||SAFE.loading)return;
  if(!force&&Date.now()-SAFE.at<55000)return;
  SAFE.loading=true;
  try{
    const sf=sb.schema('safety'),core=sb.schema('core');
    const track=p=>SAFE.ready?p:netTrack(p);/* first load shows the loading bar; the refresh every minute is quiet */
    const [areas,rules,types,certs,map]=await track(Promise.all([
      safePages(()=>sf.from('areas').select('id,name,client,parent_id,match_terms,active'),'id'),
      safePages(()=>sf.from('area_cert_rules').select('area_id,cert_type_id,validity_months,requires_health_check,warn_days_before,active'),'area_id'),
      safePages(()=>sf.from('cert_types').select('id,name,scope,validity_months,active'),'id'),
      safePages(()=>sf.from('certificates').select('id,emp_code,cert_type_id,area_id,issued_date,expiry_date,card_issued,cert_number'),'id'),
      safePages(()=>core.from('person_id_map').select('people_id,emp_code,verified_by,verified_at').eq('dept_id',DEPT()),'people_id'),
    ]));
    SAFE.mapRows=map;
    SAFE.areas=areas;SAFE.rules=rules;SAFE.types=new Map(types.map(t=>[t.id,t.name]));SAFE.typeRows=types;SAFE.certs=certs;
    SAFE.empOf=new Map(map.map(m=>[m.people_id,m.emp_code]));
    SAFE.certsByEmp=new Map();certs.forEach(c=>{if(!SAFE.certsByEmp.has(c.emp_code))SAFE.certsByEmp.set(c.emp_code,[]);SAFE.certsByEmp.get(c.emp_code).push(c)});
    SAFE.ready=true;SAFE.err='';SAFE.at=Date.now();
  }catch(e){SAFE.err=String((e&&e.message)||e||'');SAFE.at=Date.now()}/* keeps the last good data; the plan works without it */
  finally{SAFE.loading=false;safetyRefreshUi()}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadSafety()});
setInterval(()=>{if(!document.hidden)loadSafety()},60000);

/* ---------- areas ---------- */
const areaById=id=>SAFE.areas.find(a=>a.id===id)||null;
const normLoc=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
function areaName(id){const a=areaById(id);if(!a)return id||'';const p=a.parent_id&&areaById(a.parent_id);return p?`${p.name} › ${a.name}`:a.name}
/* Location text → area: exact match (case and spacing ignored) on id, name or a confirmed synonym, and only when one area fits */
function areaFromLocation(loc){
  const k=normLoc(loc);if(!k)return null;
  const hits=SAFE.areas.filter(a=>a.active!==false&&[a.id,a.name].concat(a.match_terms||[]).some(x=>normLoc(x)===k));
  return hits.length===1?hits[0]:null;
}
const hasSafety=()=>S.backend==='supabase'&&SAFE.ready&&SAFE.areas.length>0;

/* ---------- badges ---------- */
/* status rules: js/features/cert-status.js (same as BU2) — checked against today, badge only for warn / bad / none */
const CARD_ICON={warn:'!',bad:'✕',none:'✕'};
function cardOf(peopleId,areaId){
  if(!hasSafety()||!areaId)return null;
  const s=personCardStatus(SAFE,peopleId,areaId);if(!s||!CERT_BADGE[s.k])return null;
  const type=SAFE.types.get(s.rule.cert_type_id)||s.rule.cert_type_id;
  const tip=`${type} · พื้นที่ ${areaName(areaId)} · ${CERT_LABEL[s.k]}${s.expiry?` · หมดอายุ ${fmtDayY(s.expiry)}`:''}`;
  return {k:s.k,txt:CERT_BADGE[s.k],tip};
}
const cardBadge=c=>c?`<span class="card-b k-${c.k}" title="${esc(c.tip)}"><i aria-hidden="true">${CARD_ICON[c.k]}</i>${esc(c.txt)}</span>`:'';
/* the form's current area */
const formCard=id=>cardOf(id,($('#f-area')||{}).value);
/* one line under a team: how it stands for the area's card */
function cardSummary(ids,areaId){
  if(!hasSafety()||!areaId||!ids.length)return '';
  const rule=areaRule(SAFE,areaId);
  if(!rule)return `<div class="card-sum"><b>พื้นที่ ${esc(areaName(areaId))}</b> ไม่ได้กำหนดบัตรที่ต้องใช้ในระบบ Safety</div>`;
  const n=teamCardCounts(SAFE,ids,areaId);
  const parts=[n.ok&&`${CERT_LABEL.ok} ${n.ok}`,n.warn&&`${CERT_LABEL.warn} ${n.warn}`,n.bad&&`${CERT_LABEL.bad} ${n.bad}`,n.none&&`ไม่มีบัตร ${n.none}`,n.unknown&&`ไม่ทราบ ${n.unknown}`].filter(Boolean);
  const bad=n.bad+n.none;
  /* "ไม่ทราบ" = not linked to an HR record yet: the card cannot be checked until someone links them */
  const unk=n.unknown?` · <span class="hint">${n.unknown} คนยังไม่ได้จับคู่กับทะเบียน HR จึงเช็คบัตรไม่ได้</span>${S.perm&&S.perm.master?' <button type="button" class="lnk" data-sf-golink>จับคู่พนักงาน</button>':''}`:'';
  return `<div class="card-sum${bad?' bad':n.warn||n.unknown?' warn':''}"><b>${esc(SAFE.types.get(rule.cert_type_id)||rule.cert_type_id)} · ${esc(areaName(areaId))}</b> ${parts.join(' · ')}${bad?' · เป็นคำเตือน ยังเลือกคนได้ตามปกติ':''}${unk}</div>`;
}

/* ---------- plan form ---------- */
function fillAreaSelect(cur){
  const sel=$('#f-area');if(!sel)return;const on=hasSafety();
  $('#lblArea').hidden=$('#areaWrap').hidden=!on&&!cur;
  const act=SAFE.areas.filter(a=>a.active!==false||a.id===cur);
  const mains=act.filter(a=>!a.parent_id||!areaById(a.parent_id)).sort((a,b)=>a.name.localeCompare(b.name,'th'));
  const subs=p=>act.filter(a=>a.parent_id===p.id).sort((a,b)=>a.name.localeCompare(b.name,'th'));
  let html='<option value="">— ไม่ระบุพื้นที่ —</option>'+mains.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}${m.client?` (${esc(m.client)})`:''}</option>`+subs(m).map(s=>`<option value="${esc(s.id)}">　└ ${esc(s.name)}</option>`).join('')).join('');
  if(cur&&!areaById(cur))html+=`<option value="${esc(cur)}">${esc(cur)}</option>`;
  sel.innerHTML=html;sel.value=cur||'';
  $('#f-areaHint').hidden=true;
}
function autoArea(){
  if(!hasSafety()||$('#f-area').value)return;
  const a=areaFromLocation($('#f-location').value);if(!a)return;
  $('#f-area').value=a.id;const h=$('#f-areaHint');h.hidden=false;h.textContent=`จับคู่พื้นที่ "${areaName(a.id)}" จาก Location ให้อัตโนมัติ เปลี่ยนได้`;
  renderPickSel();renderPickerList();
}
function safetyRefreshUi(){
  if(typeof dlg==='undefined'||!dlg.open)return;
  if(dMode==='edit'){fillAreaSelect($('#f-area').value||(editing&&editing.areaId)||'');renderPickSel();renderPickerList()}
  else if(editing){renderDrawerView(editing);renderPhotos();renderFiles()}
}
form.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='f-location')autoArea();
  if(t.id==='f-area'){$('#f-areaHint').hidden=true;renderPickSel();renderPickerList()}
});
