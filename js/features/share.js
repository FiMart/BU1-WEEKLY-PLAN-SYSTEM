'use strict';
/* BU1 Weekly Plan · copy as text for LINE, screenshot, dark mode */
/* ---------- copy as text (LINE), screenshot, theme ---------- */
/* LINE text in the team's own report style: one emoji per line (🏭 สถานที่ · 🕘 Work Date · ✍️ รายละเอียด · 👷 ทีมงาน …) */
const LINE_PERIOD={am:'ช่วงเช้า',pm:'ช่วงบ่าย',full:'ทั้งวัน'};
const LINE_STATUS={done:'✅',notdone:'❌',postponed:'🔁',cancelled:'⛔'};
const workDate=k=>{const d=parseD(k);return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`};
/* one line of text: tabs and runs of spaces become one space (user, 11 Nov 2026: "เวลาแบ่งเป็นข้อๆ ให้ไม่ต้องเว้นวรรค" — "✓<tab><tab>Hot work" → "✓ Hot work") */
const lineClean=s=>String(s||'').replace(/[\t  - 　]+/g,' ').replace(/ {2,}/g,' ').trim();
/* "✍️ label : text" on one line, or the label then one line each when the text has several lines */
const lineBlock=(icon,label,text)=>{const l=String(text||'').split(/\r?\n/).map(lineClean).filter(Boolean);
  return !l.length?[]:l.length===1?[`${icon} ${label} : ${l[0]}`]:[`${icon} ${label} :`].concat(l)};
function jobLines(t,withPeriod){
  const tel=saleTel(t.sale);const real=attIn(t);/* a confirmed plan (เสร็จ / ไม่เสร็จ) reports who really went (user, 4 + 9 Nov 2026) */
  const team=real&&(t.doneTeam||[]).concat(t.doneGuests||[]).length?(t.doneTeam||[]).map(staffName).concat(t.doneGuests||[]):teamNames(t);
  const when=[workDate(t.date),withPeriod?`(${LINE_PERIOD[periodOf(t)]||pName(t)})`:'',t.timeNote?`· ${t.timeNote}`:''].filter(Boolean).join(' ');
  return [
    ...lineBlock('🏢','ลูกค้า',t.customer),...lineBlock('🏭','สถานที่',t.location),`🕘 Work Date : ${when}`,...(real&&(t.doneIn||t.doneOut)?[`⏱️ เวลาจริง : ถึงหน้างาน ${t.doneIn||'-'} น. · เลิกงาน ${t.doneOut||'-'} น.`]:[]),
    /* a confirmed done plan reports its สรุปงาน as รายละเอียด (user, 14 Oct 2026: the team's "Completed" message) */
    ...lineBlock('✍️','รายละเอียด',sumNeeded(t)&&!sumMissing(t)?t.doneSum:detailOf(t)),...lineBlock('📝','Request',t.request),...lineBlock('📌','หมายเหตุ',t.remark),
    ...(t.transport||t.needGA?[`🚗 รถ : ${transportText(t)}`]:[]),
    ...(contactOf(t)?[`☎️ ติดต่อ : ${contactOf(t)}`]:[]),
    ...calLines(t),...insLines(t),
    ...(prepText(t)?['🧰 '+prepText(t)]:[]),
    ...(()=>{const nd=teamNeedOf(t)?` (${team.length}/${teamNeedOf(t)} คน${teamShort(t)?` · ขาด ${teamShort(t)} คน`:''})`:'';/* จำนวนที่ต้องการ (user, 9 Oct 2026) */
      const lb=real?'เข้างานจริง':'ทีมงาน';return team.length>1?[`👷 ${lb}${nd} :`].concat(team.map((n,i)=>`${i+1}. ${n}`)):[`👷 ${lb}${nd} : ${team[0]||'-'}`]})(),
    ...(t.sale?[`💼 Sale : ${t.sale}${tel?' '+tel:''}`]:[]),
    ...(LINE_STATUS[t.status]?[`${LINE_STATUS[t.status]} สถานะ : ${statusText(t)}`]:[]),
    ...(reportsOf(t).length||docNeeded(t)?[`📎 เอกสาร : ${DOC_KINDS.filter(k=>!docNAOf(t).includes(k.id)).map(k=>`${k.name} ${docsOf(t,k.id).length?'✅':'❌'}`).join(' · ')}`]:[]),
  ];
}
const lineLabel=t=>LINE[lineOf(t)]?LINE[lineOf(t)].name:'';
function cardText(t){
  return [`📌 ${typeLabel(t)}${t.planNo?' · '+t.planNo:''}`].concat(lineLabel(t)?[`🔧 สายงาน : ${lineLabel(t)}`]:[],jobLines(t,true)).join('\n');
}
/* one day for LINE: the open สายงาน tab only (its plans, plans without a line, and leave) */
function dayText(k){return dayParts(k,Infinity)[0]}
/* LINE takes at most 10,000 characters in one message, so a long day comes in parts, cut only between plans (user, 11 Nov 2026:
   "พอเวลามีแผนเยอะๆให้สามารถคัดลอกมาให้ได้ครบทุกแผน"); every part starts with the day's head and "ส่วนที่ i/n". .length counts an emoji as 2: margin. */
const LINE_MAX=9000;
function dayParts(k,max){
  max=max||LINE_MAX;
  const d=parseD(k);const list=S.tasks.filter(t=>t.date===k&&isWorking(t)&&lineMatch(t)).sort(byTime);
  const jobs=list.filter(t=>!isLeave(t));const lv=list.filter(isLeave);
  const head=[`📅 แผนงาน BU1 Lab${scopeName()?' · '+scopeName():''}`,`วัน${TH_DAY_FULL[d.getDay()]}ที่ ${fmtShort(d)} ${be(d)} · ${jobs.length} งาน`];
  const blocks=jobs.map((t,i)=>[`${i+1}) ${LINE_PERIOD[periodOf(t)]||pName(t)} · ${typeLabel(t)}${t.planNo?' · '+t.planNo:''}${!S.line&&lineOf(t)?` [${LINE[lineOf(t)].short}]`:''}`,...jobLines(t,false)].join('\n'));
  if(lv.length)blocks.push(['🏖️ ลา :',...lv.map(t=>`- ${teamNames(t).join(', ')} (${LINE_PERIOD[periodOf(t)]||pName(t)})`)].join('\n'));
  const room=max-head.join('\n').length-40;/* 40 = "· ส่วนที่ i/n" and the blank line */
  /* a single plan longer than a whole part is cut between its own lines */
  const items=blocks.flatMap(b=>{if(b.length<=room)return [b];const out=[];let cur='';b.split('\n').forEach(l=>{if(cur&&cur.length+1+l.length>room){out.push(cur);cur=l}else cur=cur?cur+'\n'+l:l});if(cur)out.push(cur);return out});
  const parts=[];let cur=[];let len=0;
  items.forEach(b=>{if(cur.length&&len+2+b.length>room){parts.push(cur);cur=[];len=0}cur.push(b);len+=(len?2:0)+b.length});
  if(cur.length||!parts.length)parts.push(cur);
  const n=parts.length;
  return parts.map((p,i)=>[head[0]+(n>1?` · ส่วนที่ ${i+1}/${n}`:''),head[1],...p.flatMap(b=>['',b])].join('\n'));
}
/* copy a day: one message, or a list of parts to copy one after another */
function copyDay(k){
  const parts=dayParts(k);
  if(parts.length===1){copyText(parts[0],`คัดลอกแผน${fmtDay(k)}แล้ว วางใน LINE ได้เลย`);return}
  let d=$('#linePartsDlg');
  if(!d){d=document.createElement('dialog');d.id='linePartsDlg';d.className='confirm-dlg';d.setAttribute('aria-labelledby','lpT');document.body.appendChild(d);
    d.addEventListener('click',e=>{const b=e.target.closest('[data-lp]');if(!b){if(e.target===d||e.target.closest('[data-lp-close]'))d.close();return}
      const i=Number(b.dataset.lp);copyText(d._parts[i],`คัดลอกส่วนที่ ${i+1}/${d._parts.length} แล้ว วางใน LINE แล้วกลับมาคัดลอกส่วนถัดไป`);b.classList.add('done');b.querySelector('small').textContent='คัดลอกแล้ว ✓';
      const nx=d.querySelector(`[data-lp="${i+1}"]`);if(nx)nx.focus()})}
  d._parts=parts;const plans=p=>(p.match(/^\d+\) /gm)||[]).length;
  d.innerHTML=`<div class="confirm-wrap"><h2 id="lpT">แผน ${esc(fmtDay(k))} ยาวเกินที่ LINE ส่งได้ในข้อความเดียว</h2>
    <p>แบ่งเป็น ${parts.length} ส่วน · กดคัดลอกทีละส่วน แล้ววางใน LINE ตามลำดับ</p>
    <div class="lp-list">${parts.map((p,i)=>`<button type="button" class="btn lp-b" data-lp="${i}"><b>คัดลอกส่วนที่ ${i+1}/${parts.length}</b><small>${plans(p)?`${plans(p)} งาน · `:''}${p.length.toLocaleString()} ตัวอักษร</small></button>`).join('')}</div>
    <div class="confirm-act"><button type="button" class="btn" data-lp-close>ปิด</button></div></div>`;
  d.showModal();setTimeout(()=>{const b=d.querySelector('[data-lp="0"]');if(b)b.focus()},30);
}
function copyText(txt,msg){
  const done=()=>toast(msg||'คัดลอกแล้ว วางใน LINE ได้เลย');
  const fb=()=>{const a=$('#copyArea');a.value=txt;const dd=$('#copyDlg');if(!dd.open)dd.showModal();setTimeout(()=>{a.focus();a.select()},30)};
  try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,fb);else fb()}catch(e){fb()}
}
$('#copyMenu').addEventListener('toggle',e=>{
  if(!e.target.open)return;const days=Array.from({length:7},(_,i)=>addDays(S.week,i));
  $('#copyPop').innerHTML=`<p>เลือกวัน แล้ววางข้อความใน LINE${scopeName()?` · เฉพาะ ${esc(scopeName())}`:''}</p>`+days.map(d=>{const k=ymd(d);const n=S.tasks.filter(t=>t.date===k&&isWorking(t)&&!isLeave(t)&&lineMatch(t)).length;
    return `<button type="button" data-action="copy-day" data-date="${k}">${TH_DAY_FULL[d.getDay()]} ${fmtShort(d)}<span>${n} งาน</span></button>`}).join('');
});
const H2I_LIB='https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';/* Screenshot + PDF files (js/features/pdf-export.js) */
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
    const [lib,fontCSS]=await Promise.all([loadLib(H2I_LIB,'htmlToImage'),shotFontCSS()]);
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
