'use strict';
/* BU1 Weekly Plan · Dashboard › แผนเทียบผล · Master Plan (user, 6 Oct 2026)
   Reads the Master Plan sheets (js/views/master-plan.js) for the report period and sets them against the Weekly Plan:
   - Flow Meter: Plan = C and W cells of Master Plan Flow Meter in the period · Actual = meters of Weekly plan calibration
     with a result (PASS / FAIL) on plans in the period. Also every code's count, meters, Ins, by Type / Size / SALE / customer.
   - Instrument: Plan = Total Booking of the Master Plan Instrument rows active in the period · Actual = Total cal (the day
     counts that fall in the period). Also Completed rows, by LAB / Type / SALE / รับ/ส่ง / customer.
   A row counts in the period when one of its day cells falls in it (a row with no day filled counts in its month).
   Shared by the page, the A4 print and the Excel file (dashRows). */
const PVA_C={plan:'#93b4e8',act:'#1d5be0',ins:'#9a4fd8',book:'#d8c2f0'};

/* the Master Plan rows of every month the period touches (cached like rangeTasks; refreshed by invalidate()) */
function mpRangeRows(ent,from,to){
  const months=[];for(let d=firstOfMonth(parseD(from));ymd(d)<=to;d=new Date(d.getFullYear(),d.getMonth()+1,1))months.push(ymd(d).slice(0,7));
  const k=`mp|${ent}|${months.join(',')}`;let e=RC.get(k);if(!e){e={data:null,stale:true,loading:false};RC.set(k,e)}
  /* like loadInto, without adding the rows to `known` (that is the plans' history) */
  if(e.stale&&!e.loading){e.loading=true;const g=e.gen||0;const had=e.data;let changed=!had;
    const fn=()=>Promise.all(months.map(m=>Store.where(ent,'month','==',m))).then(l=>l.flat());
    (had?quietly(fn):fn()).then(d=>{changed=changed||JSON.stringify(d)!==JSON.stringify(had);e.data=d}).catch(()=>{if(!e.data)e.data=[]})
      .finally(()=>{e.stale=(e.gen||0)!==g;e.loading=false;if(changed||e.stale)render()})}
  return e.data;
}
/* a Master Plan write: only its cached ranges are read again */
function mpInvalidate(){RC.forEach((e,k)=>{if(k.startsWith('mp|')){e.stale=true;e.gen=(e.gen||0)+1}})}

function dashMp(P,buckets,calR){
  const fmRows=mpRangeRows('mpfm',P.from,P.to),insRows=mpRangeRows('mpins',P.from,P.to);
  if(!fmRows||!insRows)return null;
  const inR=k=>k>=P.from&&k<=P.to;
  const cells=r=>Object.entries(r.days||{}).map(([n,v])=>({k:`${r.month}-${pad(Number(n))}`,v:String(v||'').trim()})).filter(c=>c.v&&inR(c.k));
  const monthIn=m=>`${m}-01`<=P.to&&ymd(new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0))>=P.from;
  const countBy=(list,f)=>{const m=new Map();list.forEach(x=>{const ks=[].concat(f(x)).map(k=>String(k||'').trim()).filter(Boolean);(ks.length?ks:['(ไม่ระบุ)']).forEach(k=>m.set(k,(m.get(k)||0)+1))});return [...m].sort((a,b)=>b[1]-a[1])};
  const sumBy=(list,f,v)=>{const m=new Map();list.forEach(x=>{const k=String(f(x)||'').trim()||'(ไม่ระบุ)';m.set(k,(m.get(k)||0)+v(x))});return [...m].filter(([,n])=>n).sort((a,b)=>b[1]-a[1])};

  /* ---- Flow Meter ---- */
  const fm=fmRows.map(r=>({r,c:cells(r)})).filter(x=>x.c.length);
  const codes=MP_CODES.concat(MP_OTHER).map(([c,name])=>({c,name,n:fm.reduce((a,x)=>a+x.c.reduce((b,e)=>b+mpTokens(e.v).filter(t=>t===c.toUpperCase()).length,0),0)}));
  const code=c=>(codes.find(x=>x.c===c)||{n:0}).n;
  const isCal=v=>{const t=mpTokens(v);return t.includes('C')||t.includes('W')};
  const fmPlan=code('C')+code('W');const fmAct=calR.filter(r=>r.x.result).length;
  const fmMeters=fm.filter(x=>String(x.r.fm||'').trim()).length;const fmCalMeters=fm.filter(x=>x.c.some(e=>isCal(e.v))).length;
  const fmIns=fm.reduce((a,x)=>a+mpNum(x.r.ins),0);
  const fmBy={type:countBy(fm,x=>x.r.type),size:countBy(fm,x=>x.r.size),sale:countBy(fm,x=>x.r.sale),cust:countBy(fm,x=>x.r.cust)};

  /* ---- Instrument ---- */
  const ins=insRows.map(r=>({r,c:cells(r).map(e=>({k:e.k,n:mpNum(e.v)}))})).filter(x=>x.c.length||(!Object.keys(x.r.days||{}).length&&monthIn(x.r.month)));
  const insBook=ins.reduce((a,x)=>a+mpNum(x.r.booking),0),insCal=ins.reduce((a,x)=>a+x.c.reduce((b,e)=>b+e.n,0),0);
  const insDone=ins.filter(x=>/complete/i.test(x.r.remark||'')).length;
  const calOf=x=>x.c.reduce((b,e)=>b+e.n,0);
  const insBy={lab:sumBy(ins,x=>x.r.lab,calOf),type:countBy(ins,x=>String(x.r.type||'').split(/\s*[,/]\s*/)),sale:sumBy(ins,x=>x.r.sale,calOf),rs:countBy(ins,x=>x.r.rs),cust:sumBy(ins,x=>x.r.cust,calOf)};

  /* ---- per day / week / month of the trend chart ---- */
  const trend=buckets.map(b=>{const inB=k=>k>=b.from&&k<=b.to;
    return {name:b.name,lbl:b.lbl,sub:b.sub,we:b.we,td:b.td,
      fmPlan:fm.reduce((a,x)=>a+x.c.filter(e=>inB(e.k)).reduce((s,e)=>s+mpTokens(e.v).filter(t=>t==='C'||t==='W').length,0),0),
      fmAct:calR.filter(r=>r.x.result&&inB(r.t.date)).length,
      ins:ins.reduce((a,x)=>a+x.c.filter(e=>inB(e.k)).reduce((s,e)=>s+e.n,0),0)}});
  return {fm,codes,fmPlan,fmAct,fmRate:fmPlan?pct(fmAct,fmPlan):null,fmMeters,fmCalMeters,fmIns,fmBy,w:code('W'),c:code('C'),d:code('D'),i:code('I'),
    ins,insBook,insCal,insRate:insBook?pct(insCal,insBook):null,insDone,insBy,trend};
}
/* KPI rows and findings (page tiles, A4 print, Excel "สรุป") */
function dashMpKpis(M,line){
  if(!M)return {kpis:[],findings:[]};const k=[],f=[];
  if(line!=='ins'&&(M.fm.length||M.fmAct)){
    k.push({name:'Flow Meter: แผนเทียบผล (Plan vs Actual)',value:M.fmRate==null?`${M.fmAct} เครื่อง`:`${M.fmRate}%`,note:`สอบเทียบแล้ว (มีผล PASS/FAIL) ${M.fmAct} จากแผน C+W ใน Master Plan ${M.fmPlan} ครั้ง`});
    k.push({name:'Master Plan Flow Meter',value:`${M.fm.length} แถว`,note:`Flow meter ${M.fmMeters} · มีแผนสอบเทียบ ${M.fmCalMeters} ตัว · C ${M.c} · W (Witness) ${M.w} · D ${M.d} · I ${M.i}${M.fmIns?` · Ins ${M.fmIns}`:''}`});
    f.push({t:M.fmRate!=null&&M.fmRate<80?'warn':'',s:`Master Plan Flow Meter: แผนสอบเทียบ ${M.fmPlan} ครั้ง (C ${M.c} · W ${M.w}) ทำแล้วตาม Weekly plan calibration ${M.fmAct} เครื่อง${M.fmRate!=null?` (${M.fmRate}%)`:''}${M.fmBy.cust[0]?` · ลูกค้าที่มีมิเตอร์มากที่สุดคือ ${M.fmBy.cust[0][0]} (${M.fmBy.cust[0][1]} ตัว)`:''}`});
  }
  if(line!=='fm'&&M.ins.length){
    k.push({name:'Instrument: Total cal / Total Booking',value:M.insRate==null?`${M.insCal}`:`${M.insRate}%`,note:`Total cal ${M.insCal} จาก Total Booking ${M.insBook} · ${M.ins.length} แถว · Completed ${M.insDone}`});
    f.push({t:M.insRate!=null&&M.insRate<80?'warn':'',s:`Master Plan Instrument: Total Booking ${M.insBook} · Total cal ${M.insCal}${M.insRate!=null?` (${M.insRate}%)`:''} · ${M.ins.length} แถว · Completed ${M.insDone}${M.insBy.lab[0]?` · LAB ที่สอบเทียบมากที่สุดคือ LAB ${M.insBy.lab[0][0]} (${M.insBy.lab[0][1]} เครื่อง)`:''}`});
  }
  return {kpis:k,findings:f};
}

/* ---------- page ---------- */
function pvaChart(trend,series,day){
  const max=Math.max(1,...trend.flatMap(b=>series.map(s=>b[s.k])));
  return `<div class="scroll-x plain"><div class="pva" style="--n:${trend.length};min-width:${Math.max(360,trend.length*(day?17:44))}px">
    <div class="pva-plot"><span class="pva-max">${max}</span>${trend.map(b=>`<div class="pva-col${b.we?' we':''}${b.td?' td':''}" data-tip="${esc(b.name+': '+series.map(s=>`${s.l} ${b[s.k]}`).join(' · '))}">${series.map(s=>`<i style="height:${b[s.k]/max*100}%;background:${s.c}"></i>`).join('')}</div>`).join('')}</div>
    <div class="pva-x">${trend.map(b=>`<span class="${b.td?'td':''}"><b>${esc(b.lbl)}</b>${esc(b.sub||'')}</span>`).join('')}</div></div></div>
    <ul class="legend">${series.map(s=>`<li><i style="background:${s.c}"></i>${esc(s.l)} <b>${trend.reduce((a,b)=>a+b[s.k],0)}</b></li>`).join('')}</ul>`;
}
function dashMpHtml(D,{tile,num,sec}){
  const M=D.mp;const day=D.P.unit==='day';const unitName=day?'วัน':D.P.unit==='week'?'สัปดาห์':'เดือน';
  const showFm=S.line!=='ins',showIns=S.line!=='fm';
  let h=sec(2,'แผนเทียบผล · Master Plan','Plan vs Actual');
  if(!M)return h+`<section class="panel span-12"><p class="hint mp-wait"><span class="sk-spin" aria-hidden="true"></span> กำลังโหลด Master Plan ของช่วงนี้…</p></section>`;
  const toB=(l,unit,tot)=>l.slice(0,8).map(([k,n])=>({label:k,n,extra:tot?pct(n,tot)+'%':''}));
  const open='<button type="button" class="lnk" data-go="mplan">เปิด Master Plan</button>';
  h+=`<div class="tiles">
    ${showFm?tile(0,'Flow Meter แผนเทียบผล','FM Plan vs Actual',M.fmRate==null?'–':num(M.fmRate),M.fmRate==null?'':'%',`สอบเทียบแล้ว ${M.fmAct} จากแผน ${M.fmPlan} ครั้ง (C ${M.c} · W ${M.w})`,M.fmRate!=null&&M.fmRate<80?'warnt':'',M.fmRate):''}
    ${showFm?tile(1,'Cal &amp; Witness','W ใน Master Plan',num(M.w),'ครั้ง',`มิเตอร์ที่มีแผนสอบเทียบ ${M.fmCalMeters} ตัว`):''}
    ${showIns?tile(2,'Instrument Total cal','INS Cal vs Booking',M.insRate==null?'–':num(M.insRate),M.insRate==null?'':'%',`Total cal ${M.insCal} จาก Total Booking ${M.insBook}`,M.insRate!=null&&M.insRate<80?'warnt':'',M.insRate):''}
    ${showIns?tile(3,'Instrument Completed','Completed rows',num(M.insDone),`/ ${M.ins.length} แถว`,`Remark "Completed" · ${open}`):''}
  </div>`;
  if(showFm)h+=`<section class="panel span-${showIns?6:12}" style="--d:2"><header><h2>Flow Meter: แผนเทียบผลราย${unitName}</h2><p>แผน = ช่อง C และ W ใน Master Plan Flow Meter · ทำแล้ว = เครื่องที่มีผล PASS / FAIL ใน Weekly plan calibration ของแผนงานวันนั้น</p></header>
    ${pvaChart(M.trend,[{k:'fmPlan',l:'แผน (C+W)',c:PVA_C.plan},{k:'fmAct',l:'ทำแล้ว',c:PVA_C.act}],day)}</section>`;
  if(showIns)h+=`<section class="panel span-${showFm?6:12}" style="--d:3"><header><h2>Instrument: จำนวนสอบเทียบราย${unitName}</h2><p>Total cal จากช่องวันที่ของ Master Plan Instrument · Total Booking ทั้งช่วง ${M.insBook}</p></header>
    ${pvaChart(M.trend,[{k:'ins',l:'Total cal',c:PVA_C.ins}],day)}</section>`;
  if(showFm){const C=M.fm.length;
    h+=`<section class="panel span-12 dl-cal" style="--d:4"><header><h2>${CAL_ICON} Master Plan Flow Meter</h2><p>แถวที่มีรหัสงานในช่วงนี้ · นับรหัสในช่องวันที่ (D/C/I นับ D, C, I อย่างละครั้ง) · ${open}</p></header>
      ${C?`<div class="cal-tiles"><div><b>${num(C)}</b><span>แถว (มิเตอร์ / อุปกรณ์)</span></div><div><b>${num(M.fmMeters)}</b><span>Flow meter</span></div><div><b>${num(M.fmIns)}</b><span>Ins</span></div>
        <div class="ok"><b>${num(M.c)}</b><span>C · Cal.</span></div><div class="ok"><b>${num(M.w)}</b><span>W · Cal &amp; Witness</span></div><div><b>${num(M.d)} / ${M.i}</b><span>D Disconnect / I Install</span></div></div>
      <div class="mp-codes">${M.codes.filter(x=>x.n).map(x=>`<span><b>${esc(x.c)}</b>${esc(x.name)} <em>${x.n}</em></span>`).join('')}</div>
      <div class="cal-cols"><div><h3>ตาม Type</h3>${hbars(toB(M.fmBy.type,'',C),'แถว')}</div><div><h3>ตาม Size (Inch)</h3>${hbars(toB(M.fmBy.size,'',C),'แถว')}</div>
        <div><h3>ตาม SALE</h3>${hbars(toB(M.fmBy.sale,'',C),'แถว')}</div><div><h3>ตามลูกค้า</h3>${hbars(toB(M.fmBy.cust,'',C),'แถว')}</div></div>`
      :`<p class="hint">ยังไม่มีแผนใน Master Plan Flow Meter ช่วงนี้ · ${open}</p>`}</section>`}
  if(showIns){const n=M.ins.length;
    h+=`<section class="panel span-12 dl-cal dl-ins" style="--d:5"><header><h2>${INS_ICON} Master Plan Instrument</h2><p>Total Booking ของแถวในช่วงนี้ · Total cal = จำนวนในช่องวันที่ที่อยู่ในช่วง · LAB / SALE / ลูกค้า นับเป็นจำนวนเครื่องที่สอบเทียบ · ${open}</p></header>
      ${n?`<div class="cal-tiles"><div><b>${num(n)}</b><span>แถว (Request)</span></div><div><b>${num(M.insBook)}</b><span>Total Booking</span></div>
        <div class="ok"><b>${num(M.insCal)}</b><span>Total cal${M.insRate!=null?` · ${M.insRate}%`:''}</span></div><div><b>${num(Math.max(0,M.insBook-M.insCal))}</b><span>คงเหลือ (Booking − Cal)</span></div>
        <div class="ok"><b>${num(M.insDone)}</b><span>Completed · ${pct(M.insDone,n)}%</span></div><div><b>${num(M.insBy.cust.length)}</b><span>ลูกค้า</span></div></div>
      <div class="cal-cols"><div><h3>ตาม LAB (เครื่อง)</h3>${hbars(toB(M.insBy.lab,'',M.insCal),'เครื่อง')}</div><div><h3>ตาม Type (แถว)</h3>${hbars(toB(M.insBy.type,'',n),'แถว')}</div>
        <div><h3>ตาม SALE (เครื่อง)</h3>${hbars(toB(M.insBy.sale,'',M.insCal),'เครื่อง')}</div><div><h3>รับ / ส่ง (แถว)</h3>${hbars(toB(M.insBy.rs,'',n),'แถว')}</div>
        <div><h3>ตามลูกค้า (เครื่อง)</h3>${hbars(toB(M.insBy.cust,'',M.insCal),'เครื่อง')}</div></div>`
      :`<p class="hint">ยังไม่มีแผนใน Master Plan Instrument ช่วงนี้ · ${open}</p>`}</section>`}
  return h;
}

/* ---------- tables for the A4 print and Excel ---------- */
function dashMpRows(D){
  const M=D.mp;const unitName=D.P.unit==='day'?'วัน':D.P.unit==='week'?'สัปดาห์':'เดือน';
  const days=c=>c.map(e=>`${Number(e.k.slice(8))}/${Number(e.k.slice(5,7))}: ${e.v!=null?e.v:e.n}`).join(' · ');
  if(!M)return {};
  return {
    mpTrend:{sheet:'MP แผนเทียบผล',title:`Master Plan · แผนเทียบผลราย${unitName}`,head:[unitName,'FM แผน (C+W)','FM ทำแล้ว (มีผล)','FM ทำได้ (%)','INS Total cal'],num:[1,2,3,4],
      rows:M.trend.map(b=>[b.name,b.fmPlan,b.fmAct,b.fmPlan?pct(b.fmAct,b.fmPlan):'–',b.ins]).concat([['รวม',M.fmPlan,M.fmAct,M.fmRate==null?'–':M.fmRate,M.insCal]])},
    mpCodes:{sheet:'MP FM รหัสงาน',title:'Master Plan Flow Meter · จำนวนตามรหัสงาน',head:['รหัส','ความหมาย','ครั้ง'],num:[2],rows:M.codes.filter(x=>x.n).map(x=>[x.c,x.name,x.n])},
    mpFm:{sheet:'MP Flow Meter',title:'Master Plan Flow Meter (แถวที่มีงานในช่วงนี้)',head:['เดือน','Request No.','Customer','Tag','Size (Inch)','Type','SALE','Flow meter','Ins','Flowcom','Clamp-on','รหัสงานในช่วง (วัน/เดือน: รหัส)','Remark'],num:[7,8,9,10],
      rows:M.fm.map(x=>[x.r.month,x.r.reqNo||'',x.r.cust||'',x.r.tag||'',x.r.size||'',x.r.type||'',x.r.sale||'',x.r.fm||'',x.r.ins||'',x.r.fc||'',x.r.co||'',days(x.c),x.r.remark||''])},
    mpIns:{sheet:'MP Instrument',title:'Master Plan Instrument (แถวในช่วงนี้)',head:['เดือน','Request No. / PN','LAB','Customer','Plant','Tag','Type','Range / Set Point / Nor.Temp (Unit)','Remove','Cal','install (final)','BU','รับ/ส่ง','SALE','ชื่อลูกค้า','Total Booking','Total cal (ในช่วง)','จำนวนรายวัน','Remark'],num:[15,16],
      rows:M.ins.map(x=>[x.r.month,x.r.reqNo||'',x.r.lab||'',x.r.cust||'',x.r.plant||'',x.r.tag||'',x.r.type||'',x.r.range||'',x.r.remove||'',x.r.cal||'',x.r.install||'',x.r.bu||'',x.r.rs||'',x.r.sale||'',x.r.contact||'',mpNum(x.r.booking),x.c.reduce((a,e)=>a+e.n,0),days(x.c),x.r.remark||''])},
    mpInsLab:{sheet:'MP INS ตาม LAB',title:'Master Plan Instrument · Total cal ตาม LAB และลูกค้า',head:['กลุ่ม','ชื่อ','เครื่อง'],num:[2],
      rows:M.insBy.lab.map(([k,n])=>['LAB',k,n]).concat(M.insBy.cust.map(([k,n])=>['ลูกค้า',k,n]))},
  };
}
