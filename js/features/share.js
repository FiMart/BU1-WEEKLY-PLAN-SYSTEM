'use strict';
/* BU1 Weekly Plan · copy as text for LINE, screenshot, dark mode */
/* ---------- copy as text (LINE), screenshot, theme ---------- */
function cardText(t){
  const tel=saleTel(t.sale);
  return [`${typeLabel(t)}${t.planNo?' · '+t.planNo:''}`,`วันที่: ${fmtDayY(t.date)} (${pName(t)})${t.timeNote?' '+t.timeNote:''}`,
    t.customer?`ลูกค้า: ${t.customer}`:'',t.location?`สถานที่: ${t.location}`:'',detailOf(t).trim()?`Detail: ${detailOf(t).trim()}`:'',
    t.request?`Request: ${t.request}`:'',t.transport||t.needGA?`รถ: ${transportText(t)}`:'',(t.contact||t.contactTel)?`ติดต่อ: ${[t.contact,t.contactTel].filter(Boolean).join(' ')}`:'',
    prepText(t),`ทีม: ${teamNames(t).join(', ')||'-'}`,t.sale?`Sale: ${t.sale}${tel?' '+tel:''}`:'',NEEDS_REASON.has(t.status)?`สถานะ: ${statusText(t)}`:''].filter(Boolean).join('\n');
}
function dayText(k){
  const d=parseD(k);const list=S.tasks.filter(t=>t.date===k&&isWorking(t)).sort(byTime);
  const jobs=list.filter(t=>!isLeave(t));const lv=list.filter(isLeave);
  const out=[`แผนงาน BU1 Lab วัน${TH_DAY_FULL[d.getDay()]}ที่ ${fmtShort(d)} ${be(d)} (${jobs.length} งาน)`];
  jobs.forEach((t,i)=>{
    out.push('',`${i+1}) [${pName(t)}] ${typeLabel(t)}${t.planNo?' · '+t.planNo:''}`);
    if(t.customer||t.location)out.push('   '+[t.customer,t.location].filter(Boolean).join(' @ '));
    if(t.timeNote)out.push('   เวลา: '+t.timeNote);
    detailOf(t).split('\n').map(x=>x.trim()).filter(Boolean).forEach(x=>out.push('   '+x));
    if(t.transport||t.needGA)out.push('   รถ: '+transportText(t));
    out.push('   ทีม: '+(teamNames(t).join(', ')||'-'));
    if(NEEDS_REASON.has(t.status))out.push('   สถานะ: '+statusText(t));
  });
  if(lv.length)out.push('','ลา: '+lv.map(t=>`${teamNames(t).join(', ')} (${pName(t)})`).join(' · '));
  return out.join('\n');
}
function copyText(txt,msg){
  const done=()=>toast(msg||'คัดลอกแล้ว วางใน LINE ได้เลย');
  const fb=()=>{const a=$('#copyArea');a.value=txt;const dd=$('#copyDlg');if(!dd.open)dd.showModal();setTimeout(()=>{a.focus();a.select()},30)};
  try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,fb);else fb()}catch(e){fb()}
}
$('#copyMenu').addEventListener('toggle',e=>{
  if(!e.target.open)return;const days=Array.from({length:7},(_,i)=>addDays(S.week,i));
  $('#copyPop').innerHTML='<p>เลือกวัน แล้ววางข้อความใน LINE</p>'+days.map(d=>{const k=ymd(d);const n=S.tasks.filter(t=>t.date===k&&isWorking(t)&&!isLeave(t)).length;
    return `<button type="button" data-action="copy-day" data-date="${k}">${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}<span>${n} งาน</span></button>`}).join('');
});
function loadLib(src,glob){
  if(window[glob])return Promise.resolve(window[glob]);
  return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=()=>window[glob]?res(window[glob]):rej(new Error('lib'));s.onerror=()=>rej(new Error('load'));document.head.appendChild(s)});
}
/* the page's Google Fonts (Thai + Latin subsets) as @font-face rules with data URLs, so the PNG uses IBM Plex Sans Thai
   instead of a system font; '' when the fonts cannot be fetched (the image then falls back to system fonts) */
let shotFonts=null;
async function shotFontCSS(){
  if(shotFonts!=null)return shotFonts;
  try{
    const link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(l=>/fonts\.googleapis\.com/.test(l.href));if(!link)return shotFonts='';
    const css=await (await fetch(link.href)).text();
    const blocks=css.split('/*').slice(1).map(b=>'/*'+b).filter(b=>/^\/\* (thai|latin) \*\//.test(b));
    const toData=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)});
    const out=await Promise.all(blocks.map(async b=>{const m=b.match(/url\((https:[^)]+)\)/);if(!m)return '';const r=await fetch(m[1]);if(!r.ok)throw new Error('font');return b.replace(m[1],await toData(await r.blob()))}));
    return shotFonts=out.join('\n');
  }catch(e){return shotFonts=''}
}
async function takeShot(btn){
  const el=document.querySelector('#view .wp-panel');if(!el||!downloads)return;
  btn.disabled=true;
  try{
    const [lib,fontCSS]=await Promise.all([loadLib('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js','htmlToImage'),shotFontCSS()]);
    /* capture at zoom 1 with an explicit width (the whole table, not the scrolled window), otherwise the size resolves wrongly and the image comes out blank */
    document.body.style.zoom='1';el.classList.add('capture');
    const sc=el.querySelector('.wp-scroll');const w=Math.ceil(Math.max(el.clientWidth,sc?sc.scrollWidth:0));el.style.width=w+'px';
    const h=Math.ceil(el.scrollHeight);
    const blob=await lib.toBlob(el,{pixelRatio:2,backgroundColor:getComputedStyle(el).backgroundColor,width:w,height:h,
      ...(fontCSS?{fontEmbedCSS:fontCSS}:{skipFonts:true}),
      filter:n=>!(n.classList&&(n.classList.contains('wadd')||n.classList.contains('wp-jump')||n.classList.contains('pd-add')||n.classList.contains('pd-addday')))});
    if(!blob||blob.size<20000)throw new Error('empty');
    await saveFile(`${fileWeek()}${planDayMode()?'_'+planDay():''}.png`,blob,'บันทึกรูปตารางแล้ว ส่งต่อใน LINE ได้เลย');
  }catch(e){toast('บันทึกรูปไม่สำเร็จ ลองอีกครั้ง หรือใช้ Print / PDF แทน')}
  finally{el.classList.remove('capture');el.style.width='';document.body.style.zoom='';btn.disabled=false}
}
const isDark=()=>{const a=document.documentElement.getAttribute('data-theme');if(a)return a==='dark';try{return matchMedia('(prefers-color-scheme: dark)').matches}catch(e){return false}};
function syncThemeLbl(){const l=$('#themeLbl');if(l)l.textContent=isDark()?'โหมดสว่าง':'โหมดมืด'}
function toggleTheme(){const t=isDark()?'light':'dark';document.documentElement.setAttribute('data-theme',t);remember('bu1wp.theme',t);syncThemeLbl()}
syncThemeLbl();
