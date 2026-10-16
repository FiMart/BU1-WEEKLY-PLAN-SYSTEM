'use strict';
/* Weekly Cal / Ins (user, 16 Oct 2026: "แยกแผนของหน้า weekly plan ของ master plan flow meter กับ master plan instrument แยกเป็นอีก 1 หน้า";
   chose both: this page + Master Plan as two pages). The two week sheets that sat under the Weekly Plan board — Weekly plan calibration
   (Flow Meter calItems) and Weekly plan instrument (insItems) — live here with their own tabs (S.ws.tab, first = the open สายงาน);
   the week is S.week, changed with #weekbar (same week as Weekly Plan). Every plan of the week is used (the board's filters are not).
   Weekly Plan keeps a link bar (wsLinkHtml) when the week has rows. */
S.ws={tab:''};
const wsTab=()=>S.ws.tab||(S.line==='ins'?'ins':'fm');
function renderWsheet(){
  if(notReady())return loading();
  const tab=wsTab();const cr=calWeekRows(S.tasks).length,ir=insWeekRows(S.tasks).length;
  const sub={fm:`Flow Meter · ${cr} เครื่องในสัปดาห์นี้`,ins:`Instrument · ${ir} รายการในสัปดาห์นี้`};
  return `<div class="mp-tabs" role="tablist" aria-label="ตารางรายสัปดาห์">${LINES.map(l=>`<button type="button" role="tab" class="mp-tab${tab===l.id?' on':''}" data-ws-tab="${l.id}" aria-selected="${tab===l.id}" style="--lc:${l.color}"><span class="mp-tab-ico">${l.icon}</span><span class="mp-tab-t"><b>${l.id==='fm'?'Weekly plan calibration':'Weekly plan instrument'}</b><small>${sub[l.id]}</small></span></button>`).join('')}</div>`
    +(tab==='ins'?insWeekHtml(S.tasks):calWeekHtml(S.tasks));
}
/* under the Weekly Plan board: where the sheets went, with this week's counts */
function wsLinkHtml(){
  const cr=calWeekRows(S.tasks).length,ir=insWeekRows(S.tasks).length;if(!cr&&!ir)return '';
  const b=(tab,t,n,u)=>n?`<button type="button" class="ws-go" data-ws-go="${tab}"><b>${t}</b><span>${n} ${u}</span>›</button>`:'';
  return `<nav class="ws-link" aria-label="ตารางรายสัปดาห์"><span>ตารางสัปดาห์นี้</span>${b('fm','Weekly plan calibration',cr,'เครื่อง')}${b('ins','Weekly plan instrument',ir,'รายการ')}</nav>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ws-tab]');if(b){if(S.ws.tab!==b.dataset.wsTab){S.ws.tab=b.dataset.wsTab;S.anim='view';render()}return}
  const g=e.target.closest('[data-ws-go]');if(g){S.ws.tab=g.dataset.wsGo;goView('wsheet');window.scrollTo(0,0)}
});
