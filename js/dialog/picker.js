'use strict';
/* BU1 Weekly Plan · plan drawer: Team Service picker */
/* ---------- task dialog ---------- */
const dlg=$('#dlg');const form=$('#taskForm');let editing=null;let confTimer=null;
$('#f-status').innerHTML=STATUSES.map(s=>`<label><input type="radio" name="f-status" id="f-st-${s.id}" value="${s.id}"><span><span class="s-${s.id}">${s.icon}</span>${s.th}</span></label>`).join('');
$('#f-period').innerHTML=PERIODS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
/* Team Service picker: search + team filter + availability for the chosen date/period */
let pickSel=new Set(),pickPool=null,lastPicked=null;
function availOf(id){
  const v={date:$('#f-date').value,period:$('#f-period').value,sharedTeam:$('#f-sharedTeam').checked,location:$('#f-location').value,areaId:($('#f-area')||{}).value||''};if(!v.date)return null;
  const mine=(pickPool||S.tasks).filter(o=>o.date===v.date&&isWorking(o)&&(!editing||o.id!==editing.id)&&(o.staffIds||[]).includes(id));
  const over=mine.filter(o=>overlaps(v,o));const hit=over.find(o=>!teamShared(v,o));
  if(!hit&&over.length)return {cls:'part',txt:`ทีมร่วม · ${pName(over[0])} ${typeLabel(over[0])}${over[0].planNo?' '+over[0].planNo:''}`};
  if(hit&&isLeave(hit))return {cls:'leave',txt:`ลา${pName(hit)}`};
  if(hit)return {cls:'busy',txt:`ติดงาน${pName(hit)} · ${typeLabel(hit)}${hit.planNo?' '+hit.planNo:''}`};
  if(mine.length)return {cls:'part',txt:`ว่างช่วงนี้ · วันนี้มี ${mine.length} งาน`};
  return {cls:'free',txt:'ว่าง'};
}
function pickPeople(){return S.staff.filter(s=>s.active!==false||pickSel.has(s.id)).sort(sortPeople)}
let pickGuests=[];
function renderPickSel(){
  const el=$('#tpSel');const ids=[...pickSel];
  const tags=ids.map(id=>{const n=staffName(id);const c=formCard(id);return `<span class="tp-tag"><span class="avatar xs" aria-hidden="true">${esc(initialOf(n))}</span>${esc(n)}${cardBadge(c)}<button type="button" data-tp-remove="${esc(id)}" aria-label="เอา ${esc(n)} ออก">×</button></span>`})
    .concat(pickGuests.map((g,i)=>`<span class="tp-tag guest"><span class="avatar xs" aria-hidden="true">${esc(initialOf(g))}</span>${esc(g)} <small>แผนกอื่น</small><button type="button" data-tp-guest-remove="${i}" aria-label="เอา ${esc(g)} ออก">×</button></span>`));
  el.innerHTML=tags.length?tags.join(''):'<span class="hint">ยังไม่ได้เลือก (ไม่บังคับ บันทึกแผนก่อนแล้วเพิ่มทีมทีหลังได้) · ติ๊กชื่อจากรายการด้านล่าง หรือพิมพ์ชื่อคนจากแผนกอื่น</span>';
  $('#tpCount').textContent=tags.length?`เลือกแล้ว ${tags.length} คน${pickGuests.length?` (ในแผนก ${ids.length} · แผนกอื่น ${pickGuests.length})`:''}`:'';
  $('#tpClear').hidden=!tags.length;$('#tpN').textContent=tags.length;syncTeamNeed();
  const area=($('#f-area')||{}).value;$('#tpCard').innerHTML=cardSummary(ids,area);
  $('#tpCardWrap').hidden=!(typeof hasSafety==='function'&&hasSafety()&&area&&areaRule(SAFE,area));
}
/* แผนงานนี้ใช้ … คน (user, 9 Oct 2026): the number typed, and how many are still missing against the people picked */
const teamNeedIn=()=>Math.max(0,Math.min(99,Math.floor(Number($('#f-teamNeed').value)||0)));
function syncTeamNeed(){
  const row=$('#teamNeedRow');if(!row)return;const leave=$('#f-type').value==='leave';row.hidden=leave;
  const st=$('#teamNeedSt');const n=teamNeedIn();const h=pickSel.size+pickGuests.length;
  row.classList.toggle('short',!!n&&h<n);row.classList.toggle('ok',!!n&&h>=n);
  st.innerHTML=leave||!n?'<span class="hint">ไม่บังคับ · ใส่จำนวนคนที่งานนี้ต้องใช้ ระบบจะบอกว่ายังขาดกี่คน</span>'
    :h<n?`<b>ขาดอีก ${n-h} คน</b><small>เลือกแล้ว ${h} จาก ${n} คน</small>`
    :h>n?`<b>ครบแล้ว</b><small>เลือก ${h} คน · เกินที่ตั้งไว้ ${h-n} คน</small>`:`<b>ครบแล้ว</b><small>${h} จาก ${n} คน</small>`;
}
$('#f-teamNeed').addEventListener('input',syncTeamNeed);
document.addEventListener('click',e=>{const b=e.target.closest('[data-need-step]');if(!b||!$('#teamNeedRow').contains(b))return;
  const i=$('#f-teamNeed');i.value=String(Math.max(0,Math.min(99,teamNeedIn()+Number(b.dataset.needStep))))||'';if(i.value==='0')i.value='';syncTeamNeed()});
/* วิธีเดินทาง is optional (user, 9 Oct 2026): a click on the choice already picked clears it */
let carWasOn=null;
form.addEventListener('pointerdown',e=>{const l=e.target.closest('.car-mode label');const i=l&&l.querySelector('input');carWasOn=i&&i.checked?i:null},true);
form.addEventListener('click',e=>{const i=e.target.closest('.car-mode input');if(!i||i!==carWasOn)return;carWasOn=null;i.checked=false;syncCarMode();checkConflicts()});
function addGuest(){
  const inp=$('#tpGuest');const name=inp.value.trim().replace(/\s+/g,' ').slice(0,80);if(!name)return false;
  const inDept=S.staff.find(s=>norm(s.name)===norm(name));
  if(inDept){pickSel.add(inDept.id);renderPickerList();toast(`${inDept.name} อยู่ในรายชื่อพนักงานแล้ว เลือกให้แล้ว`)}
  else if(!pickGuests.some(g=>norm(g)===norm(name)))pickGuests.push(name);
  inp.value='';renderPickSel();checkConflicts();return true;
}
const POS_COLORS=['#2a78d6','#1baf7a','#7148c9','#eb6834','#d55181','#5b6b8c','#0e8fa3','#9a6b3f'];
const NO_POS='ไม่ระบุตำแหน่ง';
function posGroups(list){
  const order=positions();const m=new Map(order.map(p=>[p,[]]));
  list.forEach(s=>{const k=String(s.role||'').trim()||NO_POS;if(!m.has(k))m.set(k,[]);m.get(k).push(s)});
  if(m.has(NO_POS)){const l=m.get(NO_POS);m.delete(NO_POS);m.set(NO_POS,l)}
  let extra=0;
  return [...m].filter(([,l])=>l.length).map(([k,l])=>{const i=order.indexOf(k);return {key:k,list:l,color:k===NO_POS?'#8a979c':POS_COLORS[(i>=0?i:order.length+extra++)%POS_COLORS.length]}});
}
/* Team Service picker (user, 9 Oct 2026: "อ่านง่ายและดูง่ายต่อการเลือกทีมงาน"): a team switch with free / total counts,
   one section per team (full-width header + "เลือกทุกคนที่ว่างในทีม"), ตำแหน่ง inside it, person tiles with a status pill.
   pickTeam = the picker's own switch; null = follow the page's ทีม filter (reset each time the form opens); picked people always stay */
let pickTeam=null;
const pickTeamNow=()=>pickTeam==null?S.team:pickTeam;
const pickInTeam=(s,id)=>!id||(id==='all'?teamOf(s)==='all':inTeamId(s,id));
const isUn=a=>!!a&&(a.cls==='busy'||a.cls==='leave');
function renderPickerList(){
  const list=$('#tpList');if(!list)return;
  const q=norm($('#tpQ').value);const freeOnly=$('#tpFree').checked;const allowBusy=$('#tpAllowBusy').checked;
  /* Safety: only people whose card for the chosen area is valid today (ผ่าน or ใกล้หมดอายุ); people already picked stay */
  const area=($('#f-area')||{}).value;const cardOnly=$('#tpCardOnly').checked&&typeof hasSafety==='function'&&hasSafety()&&!!area&&!!areaRule(SAFE,area);
  const cardOk=id=>{const s=personCardStatus(SAFE,id,area);return !!s&&(s.k==='ok'||s.k==='warn')};
  const people=pickPeople().filter(s=>!cardOnly||pickSel.has(s.id)||cardOk(s.id));
  const av=new Map(people.map(s=>[s.id,availOf(s.id)]));
  /* team switch: ทุกทีม · Lab On-Site · Lab · All Team, "ว่าง free/total" each (no switch until teams are set) */
  const useTeams=S.staff.some(s=>teamOf(s));const pt=useTeams?pickTeamNow():'';
  const tb=$('#tpTeams');
  if(tb){tb.hidden=!useTeams;
    if(useTeams)tb.innerHTML=[{id:'',name:'ทุกทีม',color:'var(--accent)'}].concat(TEAMS).map(t=>{const l=people.filter(s=>pickInTeam(s,t.id));const f=l.filter(s=>!isUn(av.get(s.id))).length;const on=pt===t.id;
      return `<button type="button" class="tpt${on?' on':''}" data-tp-team="${t.id}" aria-pressed="${on}" style="--tc:${t.color}"><i aria-hidden="true"></i>${esc(t.name)}<small>ว่าง ${f}/${l.length}</small></button>`}).join('')}
  const shown=people.filter(s=>pickSel.has(s.id)||pickInTeam(s,pt));
  /* open team first, then All Team (they work in it too), then the rest; one section without headers until teams are set */
  const tRank=id=>id===pt&&pt?0:id==='all'&&pt?1:id?2+TEAMS.findIndex(t=>t.id===id):99;
  const tOrder=useTeams?TEAMS.map(t=>t.id).concat(['']).sort((a,b)=>tRank(a)-tRank(b)):[null];
  let html='';
  for(const tid of tOrder){const inT=tid==null?shown:shown.filter(s=>teamOf(s)===tid);if(!inT.length)continue;
    let sec='';let tFree=0,tAll=0;const tPick=[];const tc=TEAM[tid]?TEAM[tid].color:'#8a979c';
    for(const {key:pos,list:members,color} of posGroups(inT)){
      const rows=members.map(s=>{const a=av.get(s.id);const un=isUn(a);return {s,a,un,lock:un&&!allowBusy&&!pickSel.has(s.id)}})
        .filter(({s,un})=>(!q||norm([s.name,s.role,teamOf(s)?teamName(teamOf(s)):''].join(' ')).includes(q))&&(!freeOnly||pickSel.has(s.id)||!un))
        .sort((x,y)=>x.un-y.un);
      if(!rows.length)continue;
      const pickable=rows.filter(r=>!r.lock);const nUn=rows.filter(r=>r.un).length;tFree+=rows.length-nUn;tAll+=rows.length;tPick.push(...pickable.map(r=>r.s.id));
      const nSel=pickable.filter(r=>pickSel.has(r.s.id)).length;const allOn=pickable.length>0&&nSel===pickable.length;
      sec+=`<label class="tp-group sel" style="--pc:${color}"><input type="checkbox" data-tp-all="${esc(pickable.map(r=>r.s.id).join(','))}"${allOn?' checked':''}${pickable.length?'':' disabled'} data-some="${nSel&&!allOn?1:0}" aria-label="เลือกทุกคนที่ว่าง ตำแหน่ง ${esc(pos)}"><b>${esc(pos)}</b><span>ว่าง ${rows.length-nUn}/${rows.length}</span><small>${allOn?'เลือกครบแล้ว':nSel?`เลือก ${nSel}/${pickable.length}`:''}</small></label>`;
      sec+=rows.map(({s,a,un,lock})=>{const on=pickSel.has(s.id);
        const st=un?a.txt:a&&a.cls==='part'?a.txt:'ว่าง';const sc=un?a.cls:a&&a.cls==='part'?'part':'free';
        const tip=[s.name,s.role,teamOf(s)?teamName(teamOf(s)):''].filter(Boolean).join(' · ')+` · ${st}`;
        return `<label class="tp-row${on?' on':''}${un?' un':''}${lock?' lock':''}${on&&s.id===lastPicked?' just':''}" style="--pc:${color};--tc:${tc}" title="${esc(tip)}"><input type="checkbox" class="tp-cb" data-tp value="${esc(s.id)}"${on?' checked':''}${lock?' disabled':''}><span class="avatar sm" aria-hidden="true">${esc(initialOf(s.name))}</span><span class="tp-name"><b>${esc(s.name)}</b><small class="tp-st st-${sc}">${esc(st)}</small>${cardBadge(formCard(s.id))}</span><i class="tp-ck" aria-hidden="true"></i></label>`}).join('');
    }
    if(!sec)continue;
    if(tid!=null){const nSel=tPick.filter(id=>pickSel.has(id)).length;const allOn=tPick.length>0&&nSel===tPick.length;
      html+=`<div class="tp-team" style="--tc:${tc}"><i aria-hidden="true"></i><b>${esc(teamName(tid))}</b><span>ว่าง ${tFree}/${tAll} คน${nSel?` · เลือก ${nSel}`:''}</span>${tPick.length?`<label class="tp-tall"><input type="checkbox" data-tp-all="${esc(tPick.join(','))}"${allOn?' checked':''} data-some="${nSel&&!allOn?1:0}"> เลือกทุกคนที่ว่างในทีม</label>`:''}</div>`}
    html+=sec;
  }
  const top=list.scrollTop;
  list.innerHTML=html||`<div class="tp-empty">${cardOnly&&!people.length?'ยังไม่มีใครมีบัตรพื้นที่นี้ (หรือยังไม่ได้จับคู่พนักงานกับ HR)':shown.length||!people.length?(people.length?'ไม่พบรายชื่อที่ตรงกับคำค้น':'ยังไม่มีรายชื่อพนักงาน เพิ่มได้ที่หน้าข้อมูลหลัก'):'ทีมนี้ยังไม่มีรายชื่อ เลือก ทุกทีม เพื่อดูทุกคน'}</div>`;
  list.scrollTop=top;lastPicked=null;
  list.querySelectorAll('[data-some="1"]').forEach(x=>{x.indeterminate=true});
}
form.addEventListener('change',e=>{const t=e.target;
  if(t.matches('[data-pc-custom]')){$('#f-color').value=t.value;renderColorPick();return}
  if(t.matches('[data-pcv-custom]')){setPlanColor(t.value);return}
  if(t.matches('[data-tp-all]')){const ids=t.dataset.tpAll.split(',').filter(Boolean);ids.forEach(i=>t.checked?pickSel.add(i):pickSel.delete(i));renderPickSel();renderPickerList();return}
  if(t.matches('[data-tp]')){if(t.checked){pickSel.add(t.value);lastPicked=t.value}else pickSel.delete(t.value);t.closest('.tp-row').classList.toggle('on',t.checked);renderPickSel();renderPickerList();return}
  if(t.id==='tpFree'||t.id==='tpAllowBusy'||t.id==='tpCardOnly')renderPickerList();
  if(t.id==='f-sharedTeam'||t.id==='f-location'||t.id==='f-area'){syncSharedArea();renderPickerList()}
  if(t.name==='tr-per'){$('#f-period').value=t.value;renderPickerList();renderTrGrid();return}
  if(t.id==='f-date'||t.id==='f-period'){renderPickerList();renderTrGrid()}
  if(t.id==='f-type'){syncTypeOther();syncDrawerColor()}
  if(t.name==='car-mode'){syncCarMode();checkConflicts()}
  if(t.id==='f-gaCargo'){syncCarMode();if(t.checked)setTimeout(()=>$('#f-gaCargoSize').focus(),30)}
  if(t.name==='f-status'){syncReason();if(NEEDS_REASON.has(t.value))setTimeout(()=>$('#f-reason').focus(),30)}
  if(t.id==='f-sale')syncSaleTel();
});
form.addEventListener('input',e=>{if(e.target.id==='tpQ')renderPickerList();if(e.target.id==='f-planno')renderColorPick();if(e.target.id==='f-transport'){syncTrAdd();renderTrGrid()}});
form.addEventListener('keydown',e=>{
  if((e.target.id==='tpQ'||e.target.id==='f-transport')&&e.key==='Enter')e.preventDefault();
  if(e.target.id==='tpGuest'&&e.key==='Enter'){e.preventDefault();addGuest()}
});
form.addEventListener('click',e=>{
  const tr=e.target.closest('[data-tr]');if(tr){if(tr.getAttribute('aria-disabled')==='true'){toast(`${tr.dataset.tr} ถูกใช้แล้วในช่วงเวลานี้ เลือกคันอื่น หรือเปลี่ยนช่วงเวลา`);return}pickTransport(tr.dataset.tr);return}
  if(e.target.id==='trClear'){$('#f-transport').value='';syncTrAdd();renderTrGrid();checkConflicts();$('#f-transport').focus();return}
  const tt=e.target.closest('[data-tp-team]');if(tt){pickTeam=tt.dataset.tpTeam;renderPickerList();return}
  /* สีของแผน: in the form it waits for บันทึก; in the plan view it is saved at once */
  const pc=e.target.closest('[data-pc]');if(pc){$('#f-color').value=pc.dataset.pc;renderColorPick();return}
  const pv=e.target.closest('[data-pcv]');if(pv){setPlanColor(pv.dataset.pcv);return}
  const rm=e.target.closest('[data-tp-remove]');if(rm){pickSel.delete(rm.dataset.tpRemove);renderPickSel();renderPickerList();checkConflicts();return}
  const gr=e.target.closest('[data-tp-guest-remove]');if(gr){pickGuests.splice(Number(gr.dataset.tpGuestRemove),1);renderPickSel();return}
  if(e.target.closest('#tpGuestAdd')){addGuest();$('#tpGuest').focus();return}
  if(e.target.id==='tpClear'){pickSel.clear();pickGuests=[];renderPickSel();renderPickerList();checkConflicts()}
});
function syncTypeOther(){const on=$('#f-type').value==='other';$('#f-typeOther').hidden=!on}
