'use strict';
/* BU1 Weekly Plan · the GA level's own layout (user, 30 Oct 2026: "ปรับหน้าตาของ website และ mobile ให้เหมาะสมกับ Role GA";
   chose: a new first page งานขอรถ GA · only the menus GA uses · car details first in the plan view · car notices).
   isGA() = level ga. render() sets body.role-ga (css/ga-requests.css hides every other menu on the sidebar, #bnSheet and the
   phone bar, and shows the GA phone buttons .bn-ga); render() / goView keep GA on GA_VIEWS (else → gareq).
   Page gareq (renderGareq): plans that ask for a GA car (needGA), have GA's answer (gaInfo) or were withdrawn (gaCancel), by day;
   tabs S.gq.day today / tomorrow / week / month / past, status chips S.gq.st wait / done / cancel / urgent. A card opens the
   plan; GA's plan view = gqViewHtml (request first, then the facts GA needs, the car GA gave, หมายเหตุ). Notices: notify.js
   category gareq (new / changed / withdrawn request, today / tomorrow not assigned yet) for every plan, not only "mine". */
const GA_VIEWS=new Set(['gareq','plan','booking','search','help']);
const isGA=()=>S.level==='ga';
S.gq={day:'week',st:''};
const GQ_ST={wait:{th:'รอจัดรถ',c:'var(--warn)'},done:{th:'จัดรถแล้ว',c:'var(--good)'},cancel:{th:'ยกเลิกขอรถ',c:'var(--muted)'}};
/* the plans GA cares about */
const gqReq=t=>!!t&&!isLeave(t)&&(!!t.needGA||!!gaInfo(t)||!!t.gaCancel);
function gqState(t){
  if(t.status==='cancelled'||(!t.needGA&&t.gaCancel))return 'cancel';
  return gaInfo(t)||gaPlateOf(t)?'done':'wait';
}
const gqTime=t=>t.gaGo||'';
const gqKind=t=>t.selfDrive?'ขอรถไปเอง':`รถ GA${t.gaPattern&&GA_PATTERNS[t.gaPattern]?' · '+GA_PATTERNS[t.gaPattern]:''}`;
const gqTeam=t=>(t.staffIds||[]).map(staffName).concat(t.guests||[]);
function gqRange(){
  const td=new Date(),k=ymd(td);const d=n=>ymd(addDays(td,n));
  return {today:[k,k,'วันนี้'],tomorrow:[d(1),d(1),'พรุ่งนี้'],week:[k,d(6),'7 วันข้างหน้า'],month:[k,d(30),'30 วันข้างหน้า'],past:[d(-7),d(-1),'ย้อนหลัง 7 วัน']}[S.gq.day]||[k,d(6),'7 วันข้างหน้า'];
}
const gqChip=st=>`<span class="gq-st gq-${st}">${GQ_ST[st].th}</span>`;
function gqCarLine(t){const l=gaInfo(t);if(!l)return gaPlateOf(t)?`🚗 ${esc(gaPlateOf(t))}`:'';
  const v=k=>(l.find(([x])=>x===k)||[])[1];
  return [v('ทะเบียน')?`<b>${esc(v('ทะเบียน'))}</b>`:'',v('รถ')?esc(v('รถ')):'',v('พนักงานขับรถ')?`คนขับ ${esc(v('พนักงานขับรถ'))}${v('เบอร์โทร')?` (${esc(v('เบอร์โทร'))})`:''}`:'',v('เวลาออก')?`ออก ${esc(v('เวลาออก'))}`:''].filter(Boolean).join(' · ')||esc(gaSummary(t));
}
function gqCard(t){
  const st=gqState(t);const team=gqTeam(t);const time=gqTime(t);
  return `<button type="button" class="gq-card gq-c-${st}${t.gaUrgent&&st==='wait'?' urgent':''}" data-edit="${esc(t.id)}">
    <span class="gq-time"><b>${esc(time||'—')}</b><small>${t.selfDrive?'รับรถ':'รถออก'}</small></span>
    <span class="gq-main">
      <span class="gq-top">${gqChip(st)}${t.gaUrgent&&st!=='cancel'?'<span class="gq-urg">ด่วน</span>':''}<span class="gq-kind">${esc(gqKind(t))}</span></span>
      <b class="gq-where">${esc([t.customer,t.location].filter(Boolean).join(' · ')||typeLabel(t))}</b>
      <span class="gq-meta">${esc([t.planNo,pName(t),t.timeNote].filter(Boolean).join(' · '))}${team.length?` · ทีม ${team.length} คน: ${esc(team.slice(0,4).join(', '))}${team.length>4?` +${team.length-4}`:''}`:''}</span>
      ${t.gaCargo?`<span class="gq-line">📦 ${esc(cargoText(t.gaCargo))}</span>`:''}
      ${t.selfDrive&&ownCarText(t)?`<span class="gq-line">📝 ${esc(ownCarText(t))}</span>`:''}
      ${t.gaNote?`<span class="gq-line">💬 ${esc(t.gaNote)}</span>`:''}
      ${st==='done'?`<span class="gq-car">${gqCarLine(t)}</span>`:''}
      ${st==='cancel'?`<span class="gq-line gq-cn">${esc(t.gaCancel&&t.gaCancel.reason||(t.status==='cancelled'?'ยกเลิกแผนงาน':'แผนกยกเลิกขอรถ'))}</span>`:''}
    </span></button>`;
}
function renderGareq(){
  if(notReady())return loading();
  const [from,to,lbl]=gqRange();const list=rangeTasks(from,to);
  const tabs=`<div class="seg gq-tabs" role="tablist" aria-label="ช่วงวัน">${[['today','วันนี้'],['tomorrow','พรุ่งนี้'],['week','7 วัน'],['month','30 วัน'],['past','ย้อนหลัง']].map(([k,l])=>`<label><input type="radio" name="gq-day" value="${k}"${S.gq.day===k?' checked':''}><span>${l}</span></label>`).join('')}</div>`;
  const head=`<div class="gq-bar">${tabs}<a class="btn primary gq-fleet" href="${esc(GA_FLEET_URL)}" target="_blank" rel="noopener">เปิดแอป GA Fleet ↗</a></div>`;
  if(!list)return `<div class="gq-page">${head}${loading()}</div>`;
  const all=list.filter(t=>t.date>=from&&t.date<=to&&gqReq(t));
  const c={n:all.length,wait:0,done:0,cancel:0,urgent:0};all.forEach(t=>{const s=gqState(t);c[s]++;if(t.gaUrgent&&s==='wait')c.urgent++});
  const tile=(k,n,l,sub)=>`<button type="button" class="gq-k gq-k-${k}${S.gq.st===k?' on':''}" data-gq-st="${k}" aria-pressed="${S.gq.st===k}"><b>${n}</b><span>${l}</span><small>${sub}</small></button>`;
  let h=head+`<div class="gq-ks">${tile('',c.n,'ขอรถทั้งหมด',esc(lbl))}${tile('wait',c.wait,'รอจัดรถ','ยังไม่ได้ส่งรถ')}${tile('urgent',c.urgent,'ด่วน','รอจัดรถ · งานด่วน')}${tile('done',c.done,'จัดรถแล้ว','มีทะเบียนแล้ว')}${tile('cancel',c.cancel,'ยกเลิกขอรถ','แผนกยกเลิก / เปลี่ยน')}</div>`;
  const show=all.filter(t=>{const s=gqState(t);return !S.gq.st||(S.gq.st==='urgent'?s==='wait'&&t.gaUrgent:s===S.gq.st)});
  if(!show.length)return `<div class="gq-page">${h}<div class="gq-empty"><b>${all.length?'ไม่มีคำขอในสถานะนี้':'ไม่มีคำขอรถ GA ในช่วงนี้'}</b><span>${esc(lbl)}</span></div></div>`;
  const days=[...new Set(show.map(t=>t.date))].sort();if(S.gq.day==='past')days.reverse();
  const rank={wait:0,done:1,cancel:2};
  h+=days.map(k=>{const l=show.filter(t=>t.date===k).sort((a,b)=>rank[gqState(a)]-rank[gqState(b)]||String(gqTime(a)||'99').localeCompare(String(gqTime(b)||'99')));
    const d=parseD(k);const w=l.filter(t=>gqState(t)==='wait').length;const td=ymd(new Date());
    return `<section class="gq-day"><header><h2>${k===td?'วันนี้ · ':k===ymd(addDays(new Date(),1))?'พรุ่งนี้ · ':''}${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)} ${be(d)}</h2><span class="gq-dn">${l.length} คำขอ</span>${w?`<span class="gq-dn warn">รอจัดรถ ${w}</span>`:''}</header>
      <div class="gq-cards">${l.map(gqCard).join('')}</div></section>`}).join('');
  return `<div class="gq-page">${h}</div>`;
}
/* GA's plan view: the request first, then what GA needs to arrange the trip */
function gqViewHtml(t){
  const st=gqReq(t)?gqState(t):'';const d=parseD(t.date);const team=gqTeam(t);const tel=saleTel(t.sale);
  const f=(k,v)=>v?`<div><dt>${k}</dt><dd>${v}</dd></div>`:'';
  return `<div class="gq-view">
    ${st?`<div class="gq-vh gq-c-${st}">${gqChip(st)}${t.gaUrgent&&st!=='cancel'?'<span class="gq-urg">ด่วน</span>':''}<span class="gq-kind">${esc(gqKind(t))}</span>
      <div class="gq-vt"><b>${esc(gqTime(t)||'—')}</b><span>${t.selfDrive?'เวลารับรถ':'เวลารถออก'} · ${esc(TH_DAY_FULL[d.getDay()])} ${esc(fmtShort(d))} ${be(d)}</span></div></div>`
      :'<div class="gq-vh none"><b>แผนนี้ไม่ได้ขอรถ GA</b></div>'}
    ${st==='done'?gaInfoHtml(t):st==='wait'?`<div class="gq-todo"><b>ยังไม่ได้จัดรถ</b><span>จัดรถในแอป GA Fleet แล้วข้อมูลรถ (ทะเบียน คนขับ เวลาออก) จะขึ้นที่แผนนี้เอง</span><a class="btn primary sm" href="${esc(GA_FLEET_URL)}" target="_blank" rel="noopener">เปิดแอป GA Fleet ↗</a></div>`:''}
    ${st==='cancel'?`<div class="gq-todo cn"><b>${t.status==='cancelled'?'แผนงานถูกยกเลิก':'แผนกยกเลิกขอรถ'}</b><span>${esc(t.gaCancel&&t.gaCancel.reason||t.statusNote||'')}</span></div>`:''}
    <dl class="gq-dl">
      ${f('รูปแบบ',esc(t.selfDrive?'ขอรถไปเอง (ขับเอง)':GA_PATTERNS[t.gaPattern]||'—'))}
      ${t.selfDrive?f('เหตุผล',esc(ownCarText(t))):''}
      ${f('ของต้องขน',t.gaCargo?esc(cargoText(t.gaCargo)):'')}
      ${f('หมายเหตุถึง GA',t.gaNote?esc(t.gaNote):'')}
      ${f('ลูกค้า / สถานที่',esc([t.customer,t.location].filter(Boolean).join(' · ')))}
      ${f('ช่วงเวลา',esc([pName(t),t.timeNote].filter(Boolean).join(' · ')))}
      ${f(`ทีม (${team.length} คน)`,team.length?esc(team.join(', ')):'')}
      ${f('ผู้ติดต่อหน้างาน',esc([t.contact,t.contactTel].filter(Boolean).join(' · ')))}
      ${f('Sale',esc([t.sale,tel].filter(Boolean).join(' · ')))}
      ${f('งาน',esc([t.planNo,typeLabel(t)].filter(Boolean).join(' · ')))}
      ${t.gaRequestedAt?f('ขอรถเมื่อ',esc(jbWhen(t.gaRequestedAt))):''}
    </dl>
    ${remarkBox(t)}</div>`;
}
/* the badge: requests still waiting for a car today and tomorrow */
function gqBadge(){
  const n=isGA()&&typeof ntfTasks==='function'?ntfTasks().filter(t=>gqReq(t)&&gqState(t)==='wait'&&(t.date===ymd(new Date())||t.date===ymd(addDays(new Date(),1)))).length:0;
  ['#gaBadge','#gaBadgeM'].forEach(s=>{const b=$(s);if(b){b.hidden=!n;b.textContent=n}});
}
/* notices for GA (js/features/notify.js): the request's own signature, so a change of time / place / cargo shows */
const gqSig=t=>t&&!isLeave(t)&&t.needGA&&t.status!=='cancelled'?JSON.stringify([t.date,t.period||'',t.gaGo||'',t.gaPattern||'',!!t.gaUrgent,t.gaCargo||null,t.gaNote||'',!!t.selfDrive,t.location||'']):'';
document.addEventListener('change',e=>{if(e.target.name==='gq-day'){S.gq.day=e.target.value;S.anim='view';render()}});
document.addEventListener('click',e=>{const k=e.target.closest&&e.target.closest('[data-gq-st]');if(k){const v=k.dataset.gqSt;S.gq.st=S.gq.st===v?'':v;render()}});
