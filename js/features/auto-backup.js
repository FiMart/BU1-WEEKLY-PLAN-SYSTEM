'use strict';
/* BU1 Weekly Plan · สำรองข้อมูลอัตโนมัติในเบราว์เซอร์ (user, 14 Oct 2026: "เพิ่มการ backup ข้อมูลตลอดเวลา"; chose "เก็บในเบราว์เซอร์อัตโนมัติ")
   Every browser that has the app open keeps copies of the data in its own IndexedDB ("bu1wp-autobackup": store meta = the list,
   store data = the copy, same id "<source>|YYYY-MM-DDTHH" = one copy an hour). A copy is taken 2 min after a write from this browser
   (at most every 10 min), every hour while the page is open (other people's changes), when the page is hidden after a write, and
   30 s after start when the last copy is older than 30 min; a copy equal to the last one is not stored again. Kept: every copy of
   the last 48 h, then the last one of each day for 14 days. Same format as the backup file (js/features/backup.js), so a copy can be
   downloaded, or restored through the import step there. Photos and file chunks are left out (size); nothing is written to the DB. */
const ABK_COLLS=['staff','resources','projects','tasks','ncr','jobs','checks','mpfm','mpins','audit'];
const ABK_KEEP_H=48,ABK_KEEP_D=14;
const ABK={db:null,dirty:false,last:0,lastHash:'',busy:false,timer:null,list:null,err:'',off:false};
const abkReq=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
function abkOpen(){
  if(ABK.db)return Promise.resolve(ABK.db);
  return new Promise((res,rej)=>{let r;try{r=indexedDB.open('bu1wp-autobackup',1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'id'});if(!d.objectStoreNames.contains('data'))d.createObjectStore('data',{keyPath:'id'})};
    r.onsuccess=()=>{ABK.db=r.result;ABK.db.onversionchange=()=>{ABK.db.close();ABK.db=null};res(ABK.db)};r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('blocked'))});
}
/* one transaction: fn issues its requests at once and returns their promise; resolves when the transaction is done */
async function abkTx(stores,mode,fn){
  const d=await abkOpen();const tx=d.transaction(stores,mode);const done=new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('abort'))});
  const out=await fn(tx);await done;return out;
}
const abkSrc=()=>`${S.backend||'local'}:${(typeof DEPT==='function'&&DEPT())||'BU1'}`;
const abkMetas=async()=>(await abkTx(['meta'],'readonly',tx=>abkReq(tx.objectStore('meta').getAll()))).filter(m=>m.src===abkSrc()).sort((a,b)=>b.at.localeCompare(a.at));
/* a short fingerprint of the copy: an equal copy is not stored twice */
function abkHash(s){let h=5381,g=52711;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h=(h*33)^c;g=(g*31)^c}return (h>>>0).toString(36)+(g>>>0).toString(36)+s.length.toString(36)}
const abkHour=d=>`${ymd(d)}T${pad(d.getHours())}`;
/* the data can be read: signed in on the central DB (or the local / claude.ai store), loaded, no import running */
const abkReady=()=>!ABK.off&&typeof indexedDB!=='undefined'&&!notReady()&&S.mode!=='connecting'&&(S.backend!=='supabase'||(!!db&&!!S.me))&&!S.bulk;
async function abkBuild(){
  const out={app:'bu1-weekly-plan',version:1,exportedAt:new Date().toISOString(),source:S.backend||S.mode,auto:true,by:S.me||'',collections:{}};
  for(const c of ABK_COLLS){try{out.collections[c]=await quietly(()=>Store.all(c))}catch(e){if(c==='tasks'||c==='staff')throw e;out.collections[c]=[]}}/* a part without storage (projects on the central DB) stays empty */
  const cfg=await quietly(()=>Store.get('config','main'));out.collections.config=cfg?[cfg]:[];
  return out;
}
async function abkRun(force){
  clearTimeout(ABK.timer);ABK.timer=null;
  if(ABK.busy||!abkReady())return false;ABK.busy=true;
  try{
    if(!ABK.last)await abkLoadLast();
    const out=await abkBuild();const body=JSON.stringify(out.collections);const hash=abkHash(body);const now=new Date();const id=`${abkSrc()}|${abkHour(now)}`;
    ABK.dirty=false;
    if(hash===ABK.lastHash&&!force){ABK.last=now.getTime();ABK.err='';return true}/* nothing changed since the last copy */
    const counts=Object.fromEntries(Object.entries(out.collections).map(([c,l])=>[c,(l||[]).length]));
    const meta={id,src:abkSrc(),at:now.toISOString(),by:S.me||'',hash,bytes:body.length,counts,n:Object.values(counts).reduce((a,n)=>a+n,0)};
    await abkTx(['meta','data'],'readwrite',tx=>{tx.objectStore('meta').put(meta);tx.objectStore('data').put({id,out});return Promise.resolve()});
    ABK.last=now.getTime();ABK.lastHash=hash;ABK.err='';
    if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});/* ask the browser not to clear it when space runs low */
    await abkPrune();return true;
  }catch(e){ABK.err=e&&e.name==='QuotaExceededError'?'พื้นที่ในเบราว์เซอร์เต็ม':'สำรองไม่สำเร็จ';if(e&&/blocked|SecurityError|InvalidStateError/.test(e.name+e.message))ABK.off=true;return false}
  finally{ABK.busy=false;abkFill()}
}
async function abkLoadLast(){const m=(await abkMetas())[0];ABK.last=m?new Date(m.at).getTime():0;ABK.lastHash=m?m.hash:''}
/* keep every copy of the last 48 h, then the newest of each day for 14 days */
async function abkPrune(){
  const list=await abkMetas();const now=Date.now();const days=new Set();const drop=[];
  for(const m of list){const t=new Date(m.at).getTime();
    if(now-t<=ABK_KEEP_H*3600e3){days.add(ymd(new Date(t)));continue}
    const dk=ymd(new Date(t));if(now-t<=ABK_KEEP_D*86400e3&&!days.has(dk)){days.add(dk);continue}
    drop.push(m.id)}
  if(drop.length)await abkTx(['meta','data'],'readwrite',tx=>{drop.forEach(id=>{tx.objectStore('meta').delete(id);tx.objectStore('data').delete(id)});return Promise.resolve()});
}
/* a write from this browser: copy 2 min later (at most every 10 min) */
function abkKick(){
  ABK.dirty=true;if(ABK.timer)return;
  const wait=Math.max(2*60e3,ABK.last?ABK.last+10*60e3-Date.now():0);
  ABK.timer=setTimeout(()=>abkRun(),wait);
}
['set','update','del'].forEach(m=>{const f=Store[m];Store[m]=async function(...a){const r=await f.apply(Store,a);abkKick();return r}});
/* every 5 min: a copy every hour while the page is open (other people's changes come in by realtime / auto refresh) */
setInterval(()=>{const age=Date.now()-ABK.last;if(ABK.dirty&&age>=10*60e3||age>=60*60e3)abkRun()},5*60e3);
setTimeout(async function first(){if(!abkReady()){setTimeout(first,30e3);return}try{await abkLoadLast()}catch(e){}if(Date.now()-ABK.last>=30*60e3)abkRun()},30e3);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&ABK.dirty)abkRun()});

/* ---------- the list in จัดการข้อมูล › สำรอง / ย้ายข้อมูล ---------- */
const abkWhen=iso=>{const d=new Date(iso);return isNaN(d)?'':`${fmtShort(d)} ${be(d)} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`};
const abkAgo=iso=>{const m=Math.round((Date.now()-new Date(iso).getTime())/60e3);return m<1?'เมื่อสักครู่':m<60?`${m} นาทีที่แล้ว`:m<1440?`${Math.floor(m/60)} ชม. ที่แล้ว`:`${Math.floor(m/1440)} วันที่แล้ว`};
const abkSize=b=>b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' kB';
function abkListHtml(){
  if(typeof indexedDB==='undefined'||ABK.off)return '<p class="hint">เบราว์เซอร์นี้เก็บสำเนาไม่ได้ (โหมดส่วนตัว หรือปิดการเก็บข้อมูลของเว็บไว้)</p>';
  const l=ABK.list;if(!l)return '<p class="hint">กำลังอ่านสำเนา…</p>';
  const head=`<p class="abk-st${ABK.err?' bad':''}">${ABK.err?`⚠ ${esc(ABK.err)} · `:''}${l.length?`สำเนาล่าสุด <b>${esc(abkWhen(l[0].at))}</b> (${esc(abkAgo(l[0].at))}) · เก็บไว้ ${l.length} สำเนา`:'ยังไม่มีสำเนา ระบบจะสำรองให้เองภายในไม่กี่นาที'}</p>`;
  return head+(l.length?`<div class="abk-list">${l.map(m=>`<div class="abk-row"><span class="abk-t"><b>${esc(abkWhen(m.at))}</b><small>แผนงาน ${m.counts.tasks||0} · พนักงาน ${m.counts.staff||0} · ทั้งหมด ${m.n} รายการ · ${abkSize(m.bytes)}</small></span>
    <button type="button" class="btn sm" data-abk-dl="${esc(m.id)}"${downloads?'':' disabled'}>ดาวน์โหลด</button>${can('import')?`<button type="button" class="btn sm" data-abk-use="${esc(m.id)}">กู้คืน…</button>`:''}</div>`).join('')}</div>`:'');
}
function abkBoxHtml(){
  setTimeout(abkFill,0);
  return `<div class="bk-step abk"><span class="step">⟳</span><div><b>สำรองอัตโนมัติ (เบราว์เซอร์นี้)</b>
    <p class="hint">ระบบเก็บสำเนาข้อมูลทั้งหมด (ยกเว้นรูปและไฟล์แนบ) ไว้ในเบราว์เซอร์นี้เองตลอดเวลา — หลังมีการบันทึก และทุกชั่วโมงที่เปิดหน้านี้ไว้ · เก็บทุกสำเนา 48 ชม. ล่าสุด และวันละ 1 สำเนาย้อนหลัง ${ABK_KEEP_D} วัน · ทุกเครื่องที่เปิดระบบเก็บของตัวเอง ล้างข้อมูลเบราว์เซอร์แล้วสำเนาจะหาย ควรดาวน์โหลดไฟล์สำรองเก็บไว้ด้วยเป็นระยะ</p>
    <div id="abkList">${abkListHtml()}</div>
    <div class="abk-act"><button type="button" class="btn" data-action="abk-now">สำรองตอนนี้</button></div></div></div>`;
}
/* reads the list and redraws only that part (the page redraws often) */
async function abkFill(){
  try{if(typeof indexedDB!=='undefined'&&!ABK.off)ABK.list=await abkMetas()}catch(e){ABK.off=true}
  const el=$('#abkList');if(!el)return;const h=abkListHtml();if(el.innerHTML!==h)el.innerHTML=h;
}
async function abkCopy(id){const r=await abkTx(['data'],'readonly',tx=>abkReq(tx.objectStore('data').get(id)));return r&&r.out}
document.addEventListener('click',async e=>{
  const now=e.target.closest('[data-action="abk-now"]');
  if(now){if(!abkReady()){toast('ยังอ่านข้อมูลไม่เสร็จ ลองอีกครั้งสักครู่');return}now.disabled=true;now.textContent='กำลังสำรอง…';
    const ok=await abkRun(true);now.disabled=false;now.textContent='สำรองตอนนี้';toast(ok?'สำรองข้อมูลในเบราว์เซอร์นี้แล้ว':'สำรองไม่สำเร็จ '+(ABK.err||''));return}
  const dl=e.target.closest('[data-abk-dl]');
  if(dl){const out=await abkCopy(dl.dataset.abkDl).catch(()=>null);if(!out){toast('ไม่พบสำเนานี้แล้ว');abkFill();return}
    const d=new Date(out.exportedAt);await saveFile(`BU1-Weekly-Plan-auto-backup_${ymd(d)}_${pad(d.getHours())}${pad(d.getMinutes())}.json`,new Blob([JSON.stringify(out)],{type:'application/json'}),'ดาวน์โหลดสำเนาแล้ว');return}
  const use=e.target.closest('[data-abk-use]');
  if(use&&can('import')){const out=await abkCopy(use.dataset.abkUse).catch(()=>null);if(!out){toast('ไม่พบสำเนานี้แล้ว');abkFill();return}
    importData=out;render();toast(`เลือกสำเนา ${abkWhen(out.exportedAt)} แล้ว · ตรวจแล้วกด "นำเข้าข้อมูล" ในข้อ 2`);
    setTimeout(()=>{const b=document.querySelector('[data-action="backup-import"]');if(b)b.scrollIntoView({block:'center',behavior:reduceMotion()?'auto':'smooth'})},60)}
});
