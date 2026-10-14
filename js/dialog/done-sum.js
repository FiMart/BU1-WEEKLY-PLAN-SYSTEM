'use strict';
/* BU1 Weekly Plan · สรุปงาน (user, 14 Oct 2026: "ในแต่ละแผนงานในแต่ละวัน ทำหัวข้อสรุปงานที่เสร็จแล้วด้วย เพื่อคอนเฟิร์มว่าแผนงานนี้เสร็จแล้วจริงๆ";
   chose "ต้องสรุปก่อนถึงจะเสร็จ"): a work plan becomes เสร็จแล้ว only with a written summary in the team's LINE report style
   (what was done · Completed · *notes). task.doneSum / doneBy / doneAt ↔ data.bu1wp; leave plans need none. */
const sumNeeded=t=>!!t&&!isLeave(t)&&t.status==='done';
const sumMissing=t=>sumNeeded(t)&&!String(t.doneSum||'').trim();
const SUM_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 12.5l2.3 2.3 4.7-4.8"/></svg>';
/* the card's chip on a done plan: green "สรุปแล้ว", red "ยังไม่สรุป" (older done plans) */
function sumChip(t){
  if(!sumNeeded(t))return '';const ok=!sumMissing(t);
  return `<span class="pcount sr${ok?'':' miss'}" title="${ok?'สรุปงานแล้ว · ยืนยันว่างานเสร็จจริง':'บันทึกว่าเสร็จแล้ว แต่ยังไม่ได้สรุปงาน'}">${SUM_ICON}${ok?'สรุปแล้ว':'ยังไม่สรุป'}</span>`;
}
/* the starting text: the plan's detail, then "Completed" — edited to what was really done */
const sumDraft=t=>[String(detailOf(t)||'').trim(),'Completed'].filter(Boolean).join('\n');
const sumWhen=t=>{const d=t&&t.doneAt?new Date(t.doneAt):null;return d&&!isNaN(d)?`${fmtShort(d)} ${be(d)} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`:''};
const SUM_HINT='เขียนสิ่งที่ทำจริงที่หน้างาน ผลงาน (Completed) และปัญหา / ข้อสังเกตที่ต้องแจ้ง (ขึ้นต้นด้วย *)';
const SUM_PH='เช่น\nTag. FT-4201\n- Install Flowmeter = 1 EA\n- Loop Test\n- Set Zero\nCompleted\n*Flowmeter Looptest ได้แค่ 0 กับ 25% เนื่องจากกล่อง Amplifier เสีย';
/* the editor in the plan view: confirm = the plan is not done yet (saving sets เสร็จแล้ว) */
function sumEditHtml(t,confirm){
  const miss=!confirm&&sumMissing(t);
  return `<div class="v-sum edit${miss?' miss':''}" id="vSum"><label for="v-doneSum">${SUM_ICON}สรุปงาน · ยืนยันว่างานนี้เสร็จแล้วจริง</label>
    ${miss?'<p class="v-sum-warn">แผนนี้บันทึกว่าเสร็จแล้ว แต่ยังไม่มีสรุปงาน</p>':''}<small>${SUM_HINT}</small>
    <textarea id="v-doneSum" rows="8" maxlength="3000" placeholder="${esc(SUM_PH)}">${esc(String(t.doneSum||'').trim()||sumDraft(t))}</textarea>
    <div class="v-row"><button type="button" class="btn primary sm" data-action="save-vsum">${confirm?'ยืนยันงานเสร็จ':'บันทึกสรุปงาน'}</button>${miss?'':'<button type="button" class="lnk" data-action="cancel-vsum">ยกเลิก</button>'}</div></div>`;
}
/* a done plan's summary; edit = may write it (canWork) */
function sumViewHtml(t,edit){
  if(!sumNeeded(t))return '';
  if(sumMissing(t))return edit?sumEditHtml(t,false):`<div class="v-sum miss"><b>${SUM_ICON}สรุปงาน</b><span><i>ยังไม่ได้สรุปงาน</i></span></div>`;
  const when=sumWhen(t);
  return `<div class="v-sum" id="vSumView"><b>${SUM_ICON}สรุปงาน · ยืนยันว่าเสร็จแล้ว</b><span>${esc(String(t.doneSum).trim())}</span>
    <small>ยืนยันโดย <b id="vSumBy">${t.doneBy?'…':'—'}</b>${when?' · '+when:''}${edit?' · <button type="button" class="lnk" data-action="edit-vsum">แก้ไขสรุปงาน</button>':''}</small></div>`;
}
/* fills "ยืนยันโดย" with the person's name once the profile is read */
function sumWho(t){const el=$('#vSumBy');if(!el||!t||!t.doneBy)return;whoLabel(t.doneBy).then(w=>{if(el.isConnected)el.textContent=w||'—'})}
/* who / when move with the summary: set when the plan becomes done or the text changes */
function sumStamp(sum,old){
  const was=old&&old.status==='done'&&!isLeave(old)?String(old.doneSum||'').trim():null;
  return was!=null&&was===sum?{doneSum:sum,doneBy:old.doneBy||null,doneAt:old.doneAt||''}:{doneSum:sum,doneBy:S.me||null,doneAt:sum?new Date().toISOString():''};
}
function sumSlot(html){const s=$('#vSumSlot');if(s){s.innerHTML=html;sumWho(editing)}}
function openSumEdit(confirm){
  if(!editing)return;sumSlot(sumEditHtml(editing,confirm));
  const ta=$('#v-doneSum');if(ta){ta.scrollIntoView({block:'nearest',behavior:reduceMotion()?'auto':'smooth'});setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)},30)}
}
async function saveViewSum(){
  if(!editing||!canWork())return;const ta=$('#v-doneSum');const sum=String(ta&&ta.value||'').trim().slice(0,3000);
  if(!sum){toast('เขียนสรุปงานก่อนยืนยันว่าเสร็จ');if(ta)ta.focus();return}
  const was=editing.status==='done';
  await saveViewStatus('done','',sumStamp(sum,editing),was?'บันทึกสรุปงานแล้ว':'');
}
