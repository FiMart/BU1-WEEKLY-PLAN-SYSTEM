'use strict';
/* BU1 Weekly Plan · อ่านจากรูป (AI) on the Data Flow Meter Check Sheet FLS-F-122 (user, 27 Nov 2026: "เริ่มทำเลย" after the AI ideas;
   chose: a Vercel function in this repository · the team makes the Anthropic key and sets it as ANTHROPIC_API_KEY on the server ·
   FLS-F-122 first · customer data goes to Anthropic only when the person presses the button · a person checks every value before saving).
   Flow: pick / take 1–2 pictures of the paper sheet → shrunk to ≤ 2000 px JPEG here → POST BU1_CONFIG.aiUrl (default /api/ai-extract,
   api/ai-extract.js) with the person's Supabase access token → values come back → review list (tick what to use) → "ใส่ค่าที่เลือก"
   puts them into the open copy csEdit only (csEdit.dirty); nothing is written until บันทึก. No key, no picture and no answer is stored. */
const AIR={id:'',busy:false,err:'',res:null,ph:[],pickH:{},pickR:[]};
const AIR_MAX=2;
/* OFF unless js/config.js sets BU1_CONFIG.aiUrl (user, 27 Nov 2026: "ถ้าเสียตังตัดออกไปก่อน" → chose to switch it off for now;
   to switch on: aiUrl:'/api/ai-extract' + ANTHROPIC_API_KEY in Vercel, docs/AI-SETUP.md) */
const airUrl=()=>{const u=typeof BU1_CONFIG!=='undefined'?BU1_CONFIG.aiUrl:undefined;return String(u||'')};
/* shown only on the central database (the server checks the person's BU1 account) and when the address is not switched off */
const airOn=()=>S.backend==='supabase'&&typeof sb!=='undefined'&&!!sb&&!!airUrl()&&!(typeof BU1_CONFIG!=='undefined'&&BU1_CONFIG.readOnly);
const airFields=()=>CS_FORMS.data.head.concat(CS_FORMS.data.secs[0].fields);
const airLocked=c=>!!(c.steps&&c.steps.cfg&&c.steps.cfg.at);/* the Configuration section is confirmed: its table and fields are locked */
const airShow=(t,v)=>t==='yn'?(v==='yes'?'Yes / ใช่':v==='no'?'No / ไม่ใช่':''):t==='date'?(/^(\d{4})-(\d\d)-(\d\d)$/.test(v)?v.replace(/^(\d{4})-(\d\d)-(\d\d)$/,(m,y,mo,d)=>`${+d}/${+mo}/${y}`):v):v;
const airUnsure=k=>!!(AIR.res&&(AIR.res.unsure||[]).includes(k));
const airT=()=>CS_FORMS.data.secs[0].table;
/* "claude-sonnet-5-5" → "Claude Sonnet 5.5" (the server picks the model: AI_MODEL in Vercel) */
const airModelName=m=>{const x=/^claude-([a-z]+)-(\d+)(?:-(\d+))?/i.exec(m||'');return x?`Claude ${x[1][0].toUpperCase()+x[1].slice(1)} ${x[2]}${x[3]?'.'+x[3]:''}`:m};

function airHtml(c,ed){
  if(!c||c.form!=='data'||!ed||!airOn())return '';
  if(AIR.id!==c.id)Object.assign(AIR,{id:c.id,busy:false,err:'',res:null,ph:[],pickH:{},pickR:[]});
  const ph=AIR.ph.length?`<div class="air-ph">${AIR.ph.map(u=>`<img src="${u}" alt="รูปที่ส่งให้ AI อ่าน">`).join('')}</div>`:'';
  const head=`<div class="air-top"><div><b>✨ อ่านจากรูปกระดาษ (AI)</b><span class="hint">ถ่าย / เลือกรูปใบ FLS-F-122 ที่เขียนแล้ว ได้ไม่เกิน ${AIR_MAX} รูป · รูปจะถูกส่งไปให้ Claude (Anthropic) อ่านเฉพาะตอนกดปุ่มนี้ และไม่ถูกเก็บไว้ · ตรวจทุกค่าก่อนใส่ แล้วกดบันทึก</span></div>
    <button type="button" class="btn sm primary" data-ai-pick${AIR.busy?' disabled':''}>${AIR.busy?'กำลังอ่าน…':AIR.res?'อ่านรูปใหม่':'📷 เลือก / ถ่ายรูป'}</button>
    <input type="file" id="aiFile" accept="image/*" multiple hidden></div>`;
  if(AIR.busy)return `<fieldset class="jb-sec air">${head}${ph}<p class="air-wait"><span class="air-spin" aria-hidden="true"></span>AI กำลังอ่านรูป ใช้เวลาประมาณ 20–60 วินาที…</p></fieldset>`;
  if(AIR.err)return `<fieldset class="jb-sec air">${head}${ph}<p class="air-err" role="alert">${esc(AIR.err)}</p></fieldset>`;
  if(!AIR.res)return `<fieldset class="jb-sec air">${head}</fieldset>`;
  const r=AIR.res;const lock=airLocked(c);const cfgKeys=CS_FORMS.data.secs[0].fields.map(f=>f[0]);
  const hRows=airFields().map(([k,l,t])=>{const nv=String((r.h||{})[k]||'').trim();if(!nv)return '';const cur=String(c.h[k]||'');const same=cur===nv;const off=lock&&cfgKeys.includes(k);
    return `<tr class="${airUnsure(k)?'air-uns':''}${same?' air-same':''}"><td><input type="checkbox" data-ai-h="${esc(k)}"${AIR.pickH[k]&&!same&&!off?' checked':''}${same||off?' disabled':''} aria-label="ใช้ค่า ${esc(l)}"></td>
      <th>${esc(l)}</th><td class="air-nv">${esc(airShow(t,nv))}${airUnsure(k)?' <span class="air-flag" title="AI ไม่แน่ใจ ตรวจกับรูปก่อน">⚠ ไม่แน่ใจ</span>':''}</td>
      <td class="air-cur">${same?'ตรงกับค่าเดิม':off?'ล็อก (ยืนยันหัวข้อ Configuration แล้ว)':cur?'ค่าเดิม: '+esc(airShow(t,cur)):'<i>ว่าง</i>'}</td></tr>`}).join('');
  const rows=(r.rows||[]).map((x,i)=>{const u=col=>airUnsure(`row${i+1}.${col}`)?' class="air-uns"':'';
    return `<tr><td><input type="checkbox" data-ai-r="${i}"${AIR.pickR[i]&&!lock?' checked':''}${lock?' disabled':''} aria-label="ใช้แถว ${i+1}"></td><td class="num">${i+1}</td><td${u('d')}>${esc(x.d||'')}</td><td${u('b')}>${esc(x.b||'')}</td><td${u('p')}>${esc(x.p||'')}</td><td${u('a')}>${esc(x.a||'')}</td><td${u('c')}>${esc(x.c||'')}</td></tr>`}).join('');
  const nH=Object.keys(AIR.pickH).filter(k=>AIR.pickH[k]).length;const nR=AIR.pickR.filter(Boolean).length;
  return `<fieldset class="jb-sec air">${head}${ph}
    ${r.note?`<p class="air-note">📝 ${esc(r.note)}</p>`:''}
    ${(r.unsure||[]).length?`<p class="air-note warn">⚠ AI ไม่แน่ใจ ${(r.unsure||[]).length} ค่า (แถบสีส้ม) ตรวจกับรูปให้แน่ใจก่อนใช้</p>`:''}
    ${hRows?`<b class="cs-tbt">ข้อมูลหัวใบ</b><div class="scroll-x plain"><table class="air-t"><tbody>${hRows}</tbody></table></div>`:'<p class="hint">ไม่พบข้อมูลหัวใบในรูป</p>'}
    ${rows?`<b class="cs-tbt">CONFIGURATION · ${(r.rows||[]).length} แถว${lock?' · ล็อกแล้ว (ยกเลิกการยืนยันหัวข้อ Configuration ก่อนถึงจะใส่ได้)':''}</b>
      <div class="scroll-x plain"><table class="mini cs-tb air-rt"><thead><tr><th><input type="checkbox" data-ai-rall${!lock&&nR===(r.rows||[]).length?' checked':''}${lock?' disabled':''} aria-label="เลือกทุกแถว"></th><th>#</th><th>Description</th><th>Before</th><th>Process</th><th>After</th><th>ตรวจ</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="hint">แถวที่ Description ตรงกับแถวเดิมจะเติมค่าลงแถวนั้น (ค่าเดิมที่มีอยู่ไม่ถูกลบถ้า AI อ่านได้ว่าง) แถวอื่นลงแถวว่างถัดไป</p>`:'<p class="hint">ไม่พบตาราง CONFIGURATION ในรูป</p>'}
    <div class="air-acts"><span class="hint">เลือก ${nH} ค่า · ${nR} แถว${r.model?` · อ่านโดย ${esc(airModelName(r.model))}`:''}</span><span class="grow"></span><button type="button" class="btn sm ghost" data-ai-clear>ทิ้งผลนี้</button><button type="button" class="btn sm primary" data-ai-apply${nH||nR?'':' disabled'}>ใส่ค่าที่เลือกลงในใบ</button></div></fieldset>`;
}

/* a picture → JPEG ≤ 2000 px (≤ ~1.9 MB base64), so two fit under the server's 4.5 MB limit */
async function airShrink(file){
  let src,w,h,close=()=>{};
  try{src=await createImageBitmap(file,{imageOrientation:'from-image'});w=src.width;h=src.height;close=()=>src.close&&src.close()}
  catch(e){const url=URL.createObjectURL(file);src=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(new Error('เปิดรูปนี้ไม่ได้ (ใช้ JPEG / PNG — รูป HEIC ให้เปลี่ยนเป็น JPEG ก่อน)'));im.src=url});w=src.naturalWidth;h=src.naturalHeight;close=()=>URL.revokeObjectURL(url)}
  try{
    for(const [mx,q] of [[2000,.86],[1700,.8],[1400,.75]]){
      const s=Math.min(1,mx/Math.max(w,h));const cv=document.createElement('canvas');cv.width=Math.round(w*s);cv.height=Math.round(h*s);
      const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.drawImage(src,0,0,cv.width,cv.height);
      const url=cv.toDataURL('image/jpeg',q);const data=url.slice(url.indexOf(',')+1);
      if(data.length<1_900_000)return {media_type:'image/jpeg',data,url};
    }
    throw new Error('รูปใหญ่เกินไป');
  }finally{close()}
}

async function airRun(files){
  const c=csEdit;if(!c||c.form!=='data'||!canEditCs(c)||AIR.busy)return;
  const list=[...files].filter(f=>/^image\//.test(f.type)||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)).slice(0,AIR_MAX);
  if(!list.length){AIR.err='เลือกไฟล์รูปภาพ';csDraw();return}
  Object.assign(AIR,{busy:true,err:'',res:null,ph:[],pickH:{},pickR:[]});csDraw();
  const id=c.id;
  try{
    const imgs=[];for(const f of list)imgs.push(await airShrink(f));
    AIR.ph=imgs.map(i=>i.url);if(csEdit&&csEdit.id===id)csDraw();
    const {data:{session}={}}=await sb.auth.getSession();const tok=session&&session.access_token;
    if(!tok)throw new Error('ต้องเข้าสู่ระบบด้วยบัญชีกลางก่อน');
    const ac=new AbortController();const tm=setTimeout(()=>ac.abort(),130000);
    let r;try{r=await fetch(airUrl(),{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok}`},body:JSON.stringify({form:'data',images:imgs.map(({media_type,data})=>({media_type,data}))})})}
    catch(e){throw new Error(e&&e.name==='AbortError'?'AI ใช้เวลานานเกินไป ลองใหม่อีกครั้ง':navigator.onLine===false?'เครื่องไม่ได้ต่ออินเทอร์เน็ต':'ติดต่อบริการ AI ไม่ได้ ลองใหม่อีกครั้ง')}
    finally{clearTimeout(tm)}
    let j=null;try{j=await r.json()}catch(e){}
    if(!j)throw new Error(r.status===404?'เว็บนี้ยังไม่ได้ติดตั้งบริการ AI (api/ai-extract) — ใช้ได้บนเว็บที่ deploy ด้วย Vercel':`บริการ AI ตอบผิดพลาด (${r.status})`);
    if(!j.ok)throw new Error(j.error||`บริการ AI ตอบผิดพลาด (${r.status})`);
    if(!csEdit||csEdit.id!==id)return;/* the sheet was closed meanwhile */
    AIR.res={h:j.h||{},rows:(j.rows||[]).filter(x=>x&&(x.d||x.b||x.p||x.a||x.c)),unsure:j.unsure||[],note:j.note||'',model:String(j.model||'')};
    /* ticked at first: values for empty fields (a value that would replace something already typed waits for the person to tick it) and every row */
    airFields().forEach(([k])=>{const nv=String(AIR.res.h[k]||'').trim();AIR.pickH[k]=!!nv&&!String(csEdit.h[k]||'').trim()});
    AIR.pickR=AIR.res.rows.map(()=>true);
  }catch(err){AIR.err=String(err&&err.message||err)}
  finally{AIR.busy=false;if(csEdit&&csEdit.id===id)csDraw()}
}

function airApply(){
  const c=csEdit;const r=AIR.res;if(!c||!r||!canEditCs(c))return;const lock=airLocked(c);const cfgKeys=CS_FORMS.data.secs[0].fields.map(f=>f[0]);let nh=0,nr=0;
  airFields().forEach(([k])=>{if(!AIR.pickH[k]||(lock&&cfgKeys.includes(k)))return;const nv=String(r.h[k]||'').trim();if(nv&&nv!==c.h[k]){c.h[k]=nv;nh++}});
  if(!lock){const T=airT();const rows=csRows(c,T).map(x=>Object.assign({},x));const empty=x=>!['d','b','p','a','c'].some(k=>String(x[k]||'').trim());const used=new Set();
    r.rows.forEach((x,i)=>{if(!AIR.pickR[i])return;
      const key=typeof mdKey==='function'?mdKey(x.d):String(x.d||'').toLowerCase().trim();
      let at=key?rows.findIndex((y,yi)=>!used.has(yi)&&(typeof mdKey==='function'?mdKey(y.d):String(y.d||'').toLowerCase().trim())===key):-1;
      if(at<0)at=rows.findIndex((y,yi)=>!used.has(yi)&&empty(y));if(at<0){rows.push({});at=rows.length-1}
      used.add(at);const y=rows[at];['d','b','p','a','c'].forEach(k=>{const v=String(x[k]||'').trim();if(v)y[k]=v});nr++});
    c.tb=Object.assign({},c.tb,{[T.k]:rows})}
  c.dirty=true;Object.assign(AIR,{res:null,ph:[],pickH:{},pickR:[]});csDraw();
  toast(`ใส่ค่าจากรูปแล้ว ${nh} ค่า · ${nr} แถว — ตรวจอีกครั้งแล้วกด "บันทึก"`);
}

document.addEventListener('click',e=>{const t=e.target;if(!t.closest||!t.closest('#csDlg'))return;
  if(t.closest('[data-ai-pick]')){const f=$('#aiFile');if(f){f.value='';f.click()}return}
  if(t.closest('[data-ai-apply]')){airApply();return}
  if(t.closest('[data-ai-clear]')){Object.assign(AIR,{res:null,err:'',ph:[],pickH:{},pickR:[]});csDraw();return}
});
document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#csDlg'))return;
  if(t.id==='aiFile'){if(t.files&&t.files.length)airRun(t.files);return}
  const h=t.dataset&&t.dataset.aiH;if(h!==undefined){AIR.pickH[h]=t.checked;csDraw();return}
  const r=t.dataset&&t.dataset.aiR;if(r!==undefined){AIR.pickR[Number(r)]=t.checked;csDraw();return}
  if(t.dataset&&t.dataset.aiRall!==undefined){AIR.pickR=AIR.pickR.map(()=>t.checked);csDraw()}
});
