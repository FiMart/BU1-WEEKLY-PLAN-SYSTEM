'use strict';
/* ค้นหาด่วน Ctrl+K (user, 15 Oct 2026: "ปรับให้หน้าเว็บทุกหน้าใช้งานง่าย"; chose Ctrl+K): one box for every page, the common commands,
   and records — plans (open week + the watched window of js/features/notify.js + every plan once ALL is loaded), ใบรับคำร้องขอรับบริการสอบเทียบ,
   Check Sheet, NCR. Opened by Ctrl / ⌘ + K anywhere, "/" when not typing, or the ค้นหา buttons (sidebar, phone top bar). */
const QK={items:[],sel:0,wait:null};
function qkPages(){return [...document.querySelectorAll('.sb-nav button[data-view]')].filter(b=>getComputedStyle(b).display!=='none')
  .map(b=>{const v=b.dataset.view;const s=b.querySelector('svg');return {k:'page',v,t:(PAGES[v]||[b.textContent.trim()])[0],s:'ไปหน้า',ic:s?s.innerHTML:'',kw:b.textContent+' '+(PAGES[v]||['',''])[1]}})}
function qkCmds(){
  const c=[];const ic={add:'<path d="M12 5v14M5 12h14"/>',job:'<rect x="5" y="3.5" width="14" height="17.5" rx="2.2"/><path d="M12 9v7M8.5 12.5h7"/>',week:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    ntf:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',theme:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',ga:'<path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5"/><path d="M4 16.5h16v2.5H4z"/>'};
  if(S.canWrite)c.push({k:'cmd',a:'add',t:'เพิ่มแผนงาน',kw:'new plan add เพิ่ม ลงแผน'});
  if(canBook())c.push({k:'cmd',a:'job',t:'ใบรับคำร้องใหม่',kw:'booking job จอง'});
  c.push({k:'cmd',a:'week',t:'ไป Weekly Plan สัปดาห์นี้',kw:'today this week วันนี้'});
  c.push({k:'cmd',a:'ntf',t:'เปิดการแจ้งเตือน',kw:'notification bell แจ้งเตือน'});
  c.push({k:'cmd',a:'theme',t:'สลับโหมดมืด / สว่าง',kw:'dark light theme ธีม'});
  c.push({k:'cmd',a:'ga',t:'จองรถส่วนกลาง GA ↗',kw:'ga fleet car รถ'});
  return c.map(x=>Object.assign(x,{s:'คำสั่ง',ic:ic[x.a]}));
}
function qkFind(q){
  const k=mdKey(q);if(!k)return [];const has=(...a)=>a.some(x=>x&&mdKey(x).includes(k));const out=[];
  const plans=new Map();(typeof NTF!=='undefined'&&NTF.range||[]).concat(ALL.data||[],S.tasks).forEach(t=>plans.set(t.id,t));
  [...plans.values()].filter(t=>has(t.planNo,t.customer,t.location,typeLabel(t),(t.staffIds||[]).map(staffName).join(' ')))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8)
    .forEach(t=>out.push({k:'task',id:t.id,t:[t.planNo,typeLabel(t)].filter(Boolean).join(' · ')||'แผนงาน',s:`แผนงาน · ${fmtDay(t.date)}${t.customer?' · '+t.customer:''}${t.location?' · '+t.location:''}`,c:planColor(t)}));
  S.jobs.filter(j=>has(j.jobNo,j.planNo,j.customer,j.sale,j.location,(j.items||[]).map(i=>i.tag).join(' '))).slice(0,5)
    .forEach(j=>out.push({k:'job',id:j.id,t:`${j.jobNo}${j.planNo?' · '+j.planNo:''}`,s:`ใบรับคำร้องขอรับบริการสอบเทียบ · ${j.customer||''}${j.sale?' · Sale '+j.sale:''}`}));
  S.checks.filter(c=>has(c.no,c.planNo,c.title,(c.h||{}).customer,(c.h||{}).tag)).slice(0,5)
    .forEach(c=>out.push({k:'check',id:c.id,t:`${c.no} · ${(CS_FORMS[c.form]||{}).name||''}`,s:`Check Sheet · ${c.title||c.planNo||''}`}));
  S.ncr.filter(n=>has(n.ncrNo,n.planNo,n.customer,n.issue,n.category)).slice(0,4)
    .forEach(n=>out.push({k:'ncr',id:n.id,t:n.ncrNo||'NCR',s:`NCR · ${n.customer||''}${n.category?' · '+n.category:''}`}));
  return out;
}
function qkOpen(){
  let d=$('#qkDlg');
  if(!d){d=document.createElement('dialog');d.id='qkDlg';d.className='qk-dlg';d.setAttribute('aria-label','ค้นหาด่วน');
    d.innerHTML=`<div class="qk-in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input id="qkQ" type="search" autocomplete="off" placeholder="พิมพ์ชื่อหน้า · Plan No. · ลูกค้า · เลขใบรับคำร้อง · Check Sheet · NCR · คำสั่ง" aria-label="ค้นหาด่วน" aria-controls="qkList"><kbd>Esc</kbd></div>
      <div class="qk-list" id="qkList" role="listbox" aria-label="ผลการค้นหา"></div><p class="qk-foot"><span>↑ ↓ เลือก</span><span>Enter เปิด</span><span>Esc ปิด</span></p>`;
    document.body.appendChild(d);
    d.addEventListener('click',e=>{if(e.target===d){d.close();return}const r=e.target.closest('[data-qk]');if(r)qkRun(QK.items[Number(r.dataset.qk)])});
    d.addEventListener('mousemove',e=>{const r=e.target.closest('[data-qk]');if(r&&Number(r.dataset.qk)!==QK.sel){QK.sel=Number(r.dataset.qk);qkMark()}});
    $('#qkQ').addEventListener('input',()=>{QK.sel=0;qkDraw()});
    $('#qkQ').addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=QK.items.length;if(!n)return;QK.sel=(QK.sel+(e.key==='ArrowDown'?1:-1)+n)%n;qkMark();return}
      if(e.key==='Enter'){e.preventDefault();const x=QK.items[QK.sel];if(x)qkRun(x)}});
  }
  $('#qkQ').value='';QK.sel=0;qkDraw();if(!d.open)d.showModal();setTimeout(()=>$('#qkQ').focus(),20);
}
function qkDraw(){
  const q=$('#qkQ').value.trim();const k=mdKey(q);
  const base=qkCmds().concat(qkPages());
  const hit=k?base.filter(x=>mdKey(x.t+' '+(x.kw||'')).includes(k)):base;
  if(k&&k.length>=2&&!ALL.data&&!ALL.loading)allTasks();/* every plan, once (the search page uses the same copy) */
  QK.items=hit.concat(qkFind(q));
  const grp={page:'หน้า',cmd:'คำสั่ง',task:'แผนงาน',job:'ใบรับคำร้องขอรับบริการสอบเทียบ',check:'Check Sheet',ncr:'NCR'};let last='';
  $('#qkList').innerHTML=QK.items.map((x,i)=>{const g=grp[x.k];const h=g!==last?`<p class="qk-h">${g}</p>`:'';last=g;
    return `${h}<button type="button" class="qk-row" role="option" data-qk="${i}" aria-selected="${i===QK.sel}"><span class="qk-ic"${x.c?` style="--c:${esc(x.c)}"`:''}>${x.ic?`<svg viewBox="0 0 24 24" aria-hidden="true">${x.ic}</svg>`:'<i></i>'}</span><span class="qk-t"><b>${esc(x.t)}</b>${x.s?`<small>${esc(x.s)}</small>`:''}</span></button>`}).join('')
    +(!QK.items.length?`<p class="qk-none">ไม่พบ “${esc(q)}”${ALL.loading?' · กำลังโหลดแผนย้อนหลัง…':' · ลองพิมพ์ Plan No. ชื่อลูกค้า หรือเลขใบรับคำร้อง'}</p>`:'')
    +(k&&ALL.loading?'<p class="qk-none">กำลังโหลดแผนทุกสัปดาห์…</p>':'');
  clearTimeout(QK.wait);if(k&&ALL.loading)QK.wait=setTimeout(()=>{const d=$('#qkDlg');if(d&&d.open)qkDraw()},700);
}
function qkMark(){document.querySelectorAll('#qkList [data-qk]').forEach(b=>{const on=Number(b.dataset.qk)===QK.sel;b.setAttribute('aria-selected',String(on));if(on)b.scrollIntoView({block:'nearest'})})}
function qkRun(x){
  const d=$('#qkDlg');if(d&&d.open)d.close();if(!x)return;
  if(x.k==='page'){goView(x.v);window.scrollTo(0,0);return}
  if(x.k==='task'||x.k==='job'||x.k==='check'||x.k==='ncr'){ntfOpen({t:x.k,id:x.id});return}
  if(x.a==='add'){openTask(null,{line:S.line});return}
  if(x.a==='job'){goView('jobs');openJob(null);return}
  if(x.a==='week'){goView('plan');jumpWeek(ymd(new Date()));return}
  if(x.a==='ntf'){ntfPanel(true);return}
  if(x.a==='theme'){toggleTheme();return}
  if(x.a==='ga'){window.open(GA_FLEET_URL,'_blank','noopener');return}
}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='k'||e.key==='K')){e.preventDefault();const d=$('#qkDlg');if(d&&d.open)d.close();else qkOpen();return}
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!isTyping(document.activeElement||document.body)&&!document.querySelector('dialog[open]')){e.preventDefault();qkOpen()}
});
