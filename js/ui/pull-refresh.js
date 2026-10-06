'use strict';
/* BU1 Weekly Plan · pull to refresh on the phone layout (≤ 760 px)
   Pull the page down from the very top and let go past the line: the data on screen is read again in place
   (db.refreshNow on the central database, plus the Safety cards) — no page reload, the open week and filters stay.
   The browser's own pull-to-refresh is switched off on phones (css: overscroll-behavior-y), so there is one gesture,
   and it also works where the browser has none (app added to the home screen, LINE's browser). */
const PTR={y0:0,x0:0,pull:0,on:false,busy:false,el:null};
const PTR_GO=72,PTR_MAX=120;/* px pulled (after resistance) to refresh / at most */
function ptrEl(){
  if(PTR.el)return PTR.el;
  const el=document.createElement('div');el.className='ptr';el.setAttribute('aria-hidden','true');
  el.innerHTML='<span class="ptr-ball"><svg viewBox="0 0 24 24"><path d="M12 5v13M6 12l6 6 6-6"/></svg><span class="ptr-spin"></span></span><span class="ptr-txt"></span>';
  document.body.appendChild(el);PTR.el=el;return el;
}
/* the gesture starts only at the top of the page, with nothing open over it and no inner list scrolled down */
function ptrCanStart(t){
  if(!isPhoneW()||PTR.busy||window.scrollY>0||document.body.classList.contains('auth-open'))return false;
  if(document.querySelector('dialog[open]'))return false;
  const sheet=$('#bnSheet');if(sheet&&!sheet.hidden)return false;
  for(let n=t;n&&n!==document.body;n=n.parentElement)if(n.scrollTop>0)return false;
  return !(t.closest&&t.closest('input,textarea,select,[contenteditable]'));
}
function ptrShow(){
  const el=ptrEl();const p=PTR.pull;const ready=p>=PTR_GO;
  el.classList.add('show');el.classList.toggle('ready',ready);
  el.style.transform=`translate(-50%,${p-56}px)`;
  el.style.setProperty('--turn',`${Math.min(1,p/PTR_GO)*180}deg`);
  el.querySelector('.ptr-txt').textContent=ready?'ปล่อยเพื่อรีเฟรช':'ดึงลงเพื่อรีเฟรช';
}
function ptrHide(){const el=ptrEl();el.classList.remove('show','ready','busy');el.style.transform='';PTR.pull=0}
async function ptrRun(){
  const el=ptrEl();PTR.busy=true;el.classList.add('busy');el.classList.remove('ready');
  el.style.transform=`translate(-50%,${PTR_GO-56}px)`;el.querySelector('.ptr-txt').textContent='กำลังอัปเดตข้อมูล…';
  const t0=Date.now();let ok=true;
  try{
    if(db&&typeof db.refreshNow==='function'){
      await Promise.all([db.refreshNow(),typeof loadSafety==='function'?loadSafety(true):null]);
    }else if(S.mode==='local'){render()}
    else{location.reload();return}
  }catch(e){ok=false}
  const wait=Math.max(0,600-(Date.now()-t0));/* the spinner is seen even when the answer is instant */
  setTimeout(()=>{PTR.busy=false;ptrHide();toast(ok?'อัปเดตข้อมูลล่าสุดแล้ว':'อัปเดตไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองอีกครั้ง')},wait);
}
document.addEventListener('touchstart',e=>{
  PTR.on=false;if(e.touches.length!==1||!ptrCanStart(e.target))return;
  PTR.on=true;PTR.y0=e.touches[0].clientY;PTR.x0=e.touches[0].clientX;PTR.pull=0;
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!PTR.on||PTR.busy)return;
  const dy=e.touches[0].clientY-PTR.y0,dx=e.touches[0].clientX-PTR.x0;
  if(!PTR.pull&&(dy<=0||Math.abs(dx)>dy)){PTR.on=false;return}/* a scroll up or a sideways swipe (day strip) */
  if(window.scrollY>0){PTR.on=false;ptrHide();return}
  PTR.pull=Math.max(0,Math.min(PTR_MAX,dy*.5));/* resistance: the indicator moves half as far as the finger */
  if(e.cancelable)e.preventDefault();/* no rubber-band scroll while pulling */
  ptrShow();
},{passive:false});
const ptrEnd=()=>{if(!PTR.on)return;PTR.on=false;if(PTR.busy)return;if(PTR.pull>=PTR_GO)ptrRun();else ptrHide()};
document.addEventListener('touchend',ptrEnd);
document.addEventListener('touchcancel',()=>{PTR.on=false;if(!PTR.busy)ptrHide()});
