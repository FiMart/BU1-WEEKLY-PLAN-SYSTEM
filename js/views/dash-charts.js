'use strict';
/* BU1 Weekly Plan · Dashboard charts (v4.27.0, user 21 Oct 2026: "ปรับเปลี่ยน Dashboard ใหม่ทั้งหมด … เพิ่มการนำเสนอแบบ Chart ให้หลากหลายมากขึ้น").
   Plain SVG / HTML, no chart library. Built to the dataviz method: columns ≤ 24 px with a 4 px rounded top, 2 px surface gaps
   between stacked segments, 2 px lines, 8 px dots with a 2 px surface ring, solid hairline grid, ONE y axis per chart,
   a legend for 2+ series, sparing direct labels, text in ink tokens (never the series colour), a hover / focus tip per
   column that lists every series at that x, and a table twin for each chart (same tab, the A4 print, the Excel file).
   Colours are roles (--vz-* in css/dash-charts.css, light + dark), checked with the dataviz skill's validate_palette.js on
   this app's surfaces (#ffffff / #101725): blue + aqua stack, blue + orange, orange · blue · aqua, one-hue blue ramp,
   สายงาน FM #0b8fd6 + INS #b0479a (INS was #9a4fd8, which failed the colour-blind check against FM). */
const VZ=new Map();let vzSeq=0;
const vzRO=typeof ResizeObserver==='function'?new ResizeObserver(es=>es.forEach(e=>vzDraw(e.target))):null;
/* a chart that is drawn at its real width once it is in the page (vzMount after each render, again on resize) */
function vzBox(spec){
  const id='vz'+(++vzSeq);VZ.set(id,spec);if(VZ.size>120)VZ.delete(VZ.keys().next().value);
  return `<div class="vz" data-vz="${id}" style="height:${spec.h||220}px" role="figure" aria-label="${esc(spec.label||'')}"></div>`;
}
function vzDraw(el){const spec=VZ.get(el.dataset.vz);if(!spec)return;const w=Math.floor(el.clientWidth);if(!w||w===el._vzw)return;el._vzw=w;el.innerHTML=vzXY(spec,w)}
function vzMount(){document.querySelectorAll('.vz[data-vz]').forEach(el=>{if(!el._vzo){el._vzo=1;if(vzRO)vzRO.observe(el)}vzDraw(el)})}

/* clean y ticks: about four steps of 1 / 2 / 5 × 10ⁿ */
function vzTicks(max){if(!(max>0))return {top:4,step:1};const raw=max/4;const p=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=Math.max(1,[1,2,5,10].map(m=>m*p).find(m=>m>=raw)||10*p);/* counts and % only: whole steps */return {step,top:Math.ceil(max/step)*step}}
const vzN=v=>{const r=Math.round(v*10)/10;return Math.abs(r)>=1000?(r/1000).toLocaleString('th-TH',{maximumFractionDigits:1})+'K':r.toLocaleString('th-TH',{maximumFractionDigits:1})};
const vzA=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

/* columns (stacked when several bar series) + lines on one y axis
   spec {cats:[{lbl, sub, name, hl, go}], bars:[{name, color, vals}], lines:[{name, color, vals, dots}], ref:{v, lbl}, fmt, unit, h, labels:'auto'|'none'} */
function vzXY(s,w){
  const H=s.h||220,n=s.cats.length,fmt=s.fmt||vzN,unit=s.unit?' '+s.unit:'';
  const bars=s.bars||[],lines=(s.lines||[]).filter(l=>l&&l.vals);
  const pl=s.pct?40:36,pr=s.ref?44:12,pt=16,pb=s.cats.some(c=>c.sub)?36:24;
  const pw=Math.max(20,w-pl-pr),ph=Math.max(20,H-pt-pb),band=pw/Math.max(1,n);
  const tot=i=>bars.reduce((a,b)=>a+(+b.vals[i]||0),0);
  let max=0;for(let i=0;i<n;i++){max=Math.max(max,tot(i));lines.forEach(l=>{if(l.vals[i]!=null)max=Math.max(max,+l.vals[i])})}
  if(s.ref)max=Math.max(max,s.ref.v*1.1);
  const T=vzTicks(max);const y=v=>pt+ph-(Math.max(0,v)/T.top)*ph;const cx=i=>pl+band*i+band/2;
  let g='';
  for(let v=0,k=0;v<=T.top+1e-9&&k<12;v+=T.step,k++){const yy=Math.round(y(v))+.5;
    g+=`<line x1="${pl}" x2="${pl+pw}" y1="${yy}" y2="${yy}" stroke="var(${v===0?'--vz-axis':'--vz-grid'})" stroke-width="1"/><text x="${pl-7}" y="${yy+4}" text-anchor="end" font-size="11" fill="var(--muted)">${vzA(fmt(v)+(s.pct?'%':''))}</text>`}
  /* highlighted columns (today / the period) sit behind everything */
  s.cats.forEach((c,i)=>{if(c.hl)g+=`<rect x="${pl+band*i}" y="${pt}" width="${band}" height="${ph}" fill="var(--vz-hl)"/>`});
  const bw=Math.max(3,Math.min(24,band*.6));
  for(let i=0;i<n;i++){let acc=0;const segs=bars.map(b=>({b,v:+b.vals[i]||0})).filter(x=>x.v>0);
    segs.forEach((x,j)=>{const y0=y(acc),y1=y(acc+x.v);acc+=x.v;const top=j===segs.length-1;const gap=j>0?2:0;const x0=cx(i)-bw/2;const yb=y0-gap,yt=y1;const hh=yb-yt;if(hh<=0.4)return;
      const r=top?Math.min(4,hh/2,bw/2):0;
      g+=r?`<path d="M${x0},${yb}V${yt+r}Q${x0},${yt} ${x0+r},${yt}H${x0+bw-r}Q${x0+bw},${yt} ${x0+bw},${yt+r}V${yb}Z" fill="${x.b.color}"/>`:`<rect x="${x0}" y="${yt}" width="${bw}" height="${hh}" fill="${x.b.color}"/>`})}
  lines.forEach(l=>{const pts=[];l.vals.forEach((v,i)=>{if(v!=null)pts.push([cx(i),y(+v)])});if(!pts.length)return;
    if(pts.length>1)g+=`<path d="M${pts.map(p=>p.join(',')).join('L')}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if(l.dots!==false&&(n<=16||pts.length===1))pts.forEach(p=>{g+=`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${l.color}" stroke="var(--surface)" stroke-width="2"/>`})});
  if(s.ref){const yy=Math.round(y(s.ref.v))+.5;g+=`<line x1="${pl}" x2="${pl+pw}" y1="${yy}" y2="${yy}" stroke="var(--crit)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${pl+pw+6}" y="${yy+4}" font-size="11" font-weight="600" fill="var(--crit-ink)">${vzA(s.ref.lbl)}</text>`}
  /* direct labels, sparingly: the highest column (and a highlighted one) — or the highest / last point of a lone line */
  if(s.labels!=='none'){const lab=new Set();
    if(bars.length){let mi=-1,mv=0;for(let i=0;i<n;i++)if(tot(i)>mv){mv=tot(i);mi=i}if(mi>=0)lab.add(mi);s.cats.forEach((c,i)=>{if(c.hl&&tot(i)>0&&n>1&&s.cats.filter(x=>x.hl).length===1)lab.add(i)});
      lab.forEach(i=>{g+=`<text x="${cx(i)}" y="${y(tot(i))-6}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${vzA(fmt(tot(i)))}</text>`})}
    else if(lines.length===1){const v=lines[0].vals;let mi=-1,mv=-1,li=-1;v.forEach((x,i)=>{if(x==null)return;li=i;if(+x>mv){mv=+x;mi=i}});[mi,li].filter((x,k,a)=>x>=0&&a.indexOf(x)===k).forEach(i=>{
      g+=`<text x="${Math.min(pl+pw-4,Math.max(pl+12,cx(i)))}" y="${y(+v[i])-9}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${vzA(fmt(+v[i])+(s.pct?'%':''))}</text>`})}}
  /* x labels: thinned when the bands are narrow */
  const every=Math.max(1,Math.ceil(30/band));
  s.cats.forEach((c,i)=>{if(i%every&&!c.hl)return;const x=cx(i);
    g+=`<text x="${x}" y="${pt+ph+15}" text-anchor="middle" font-size="11" font-weight="${c.hl?700:500}" fill="var(${c.hl?'--ink':'--ink-2'})">${vzA(c.lbl)}</text>`;
    if(c.sub)g+=`<text x="${x}" y="${pt+ph+29}" text-anchor="middle" font-size="10" fill="var(--muted)">${vzA(c.sub)}</text>`});
  /* hit targets: the whole band, every series at that x in the tip */
  s.cats.forEach((c,i)=>{const parts=[c.name||c.lbl];bars.forEach(b=>parts.push(`${b.name} ${fmt(+b.vals[i]||0)}${unit}`));
    if(bars.length>1)parts.push(`รวม ${fmt(tot(i))}${unit}`);lines.forEach(l=>{if(l.vals[i]!=null)parts.push(`${l.name} ${fmt(+l.vals[i])}${s.pct?'%':unit}`)});if(c.more)parts.push(c.more);
    g+=`<rect class="vz-hit" fill="transparent" x="${pl+band*i}" y="${pt}" width="${band}" height="${ph+pb-6}" tabindex="0" data-tip="${vzA(parts.join(' · '))}"${c.go?` data-vz-go="${vzA(c.go)}"`:''}/>`});
  return `<svg class="vz-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" font-family="inherit">${g}</svg>`;
}
/* legend: rect keys for bars, line keys for lines */
function vzLegend(items){return `<ul class="vz-legend">${items.map(x=>`<li><i class="${x.line?'ln':x.dash?'ln dash':''}" style="--c:${x.color}"></i>${esc(x.name)}${x.n!=null?` <b>${esc(String(x.n))}</b>`:''}</li>`).join('')}</ul>`}

/* donut: part-to-whole, ≤ 6 parts, 2 px gaps, the total in the middle, a legend with value + % beside it */
function vzDonut(items,o){
  o=o||{};const size=o.size||132,th=o.th||18,c0=size/2,r=(size-th)/2,C=2*Math.PI*r;const tot=items.reduce((a,x)=>a+(x.n||0),0);const live=items.filter(x=>x.n>0);
  let off=0,arcs='';
  if(tot)live.forEach(x=>{const len=x.n/tot*C;const gap=live.length>1?Math.min(2,len/3):0;
    arcs+=`<circle class="vz-seg" cx="${c0}" cy="${c0}" r="${r}" fill="none" stroke="${x.color}" stroke-width="${th}" stroke-dasharray="${Math.max(.01,len-gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${c0} ${c0})" tabindex="0" data-tip="${vzA(`${x.name}: ${x.n}${o.unit?' '+o.unit:''} (${Math.round(x.n/tot*100)}%)`)}"/>`;off+=len});
  else arcs=`<circle cx="${c0}" cy="${c0}" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="${th}"/>`;
  const svg=`<svg class="vz-dsvg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${vzA(o.label||'')}">${arcs}
    <text x="${c0}" y="${c0+(o.sub?2:7)}" text-anchor="middle" font-size="${size>=120?24:19}" font-weight="700" fill="var(--ink)">${vzA(o.center!=null?o.center:tot)}</text>${o.sub?`<text x="${c0}" y="${c0+19}" text-anchor="middle" font-size="11" fill="var(--muted)">${vzA(o.sub)}</text>`:''}</svg>`;
  return `<div class="vz-donut">${svg}<ul class="vz-dleg">${items.map(x=>`<li tabindex="0" data-tip="${vzA(`${x.name}: ${x.n||0}${o.unit?' '+o.unit:''}`)}"><i style="--c:${x.color}"></i><span>${esc(x.name)}</span><b>${x.n||0}</b><em>${tot?Math.round((x.n||0)/tot*100):0}%</em></li>`).join('')}</ul></div>`;
}

/* ranking bars (one series, slot 1) with the previous period as a tick on each track */
function vzRank(items,o){
  o=o||{};const max=Math.max(1,...items.map(x=>Math.max(x.n,x.prev||0)));const hasPrev=items.some(x=>x.prev!=null);
  if(!items.length)return '<p class="hint">ยังไม่มีข้อมูลในช่วงนี้</p>';
  return `${hasPrev?`<ul class="vz-legend sm"><li><i style="--c:var(--vz-1)"></i>ช่วงนี้</li><li><i class="tick"></i>${esc(o.prevLbl||'ช่วงก่อน')}</li></ul>`:''}<div class="vz-rank">${items.map(x=>{
    const d=x.prev!=null?x.n-x.prev:null;
    return `<div class="vz-rk" tabindex="0" data-tip="${vzA(`${x.label}: ${x.n}${o.unit?' '+o.unit:''}${x.prev!=null?` · ${o.prevLbl||'ช่วงก่อน'} ${x.prev}`:''}${x.extra?' · '+x.extra:''}`)}"><span class="vz-rk-l" title="${vzA(x.label)}">${esc(x.label)}</span>
      <span class="vz-rk-t"><i class="vz-rk-b" style="width:${x.n/max*100}%${x.color?';--c:'+x.color:''}"></i>${x.prev?`<i class="vz-rk-p" style="left:${x.prev/max*100}%"></i>`:''}</span>
      <b class="vz-rk-v">${x.n}${x.extra?`<small>${esc(x.extra)}</small>`:''}</b>${hasPrev?`<em class="vz-rk-d">${d==null?'':d>0?'▲ '+d:d<0?'▼ '+(-d):'–'}</em>`:''}</div>`}).join('')}</div>`;
}
/* stacked bars per row (man-days: weekdays · Sat–Sun · public-holiday OT) */
function vzStackRows(rows,keys,o){
  o=o||{};const max=Math.max(1,...rows.map(r=>keys.reduce((a,k)=>a+(r.v[k.id]||0),0)));
  return `${vzLegend(keys.map(k=>({name:k.name,color:k.color})))}<div class="vz-rank vz-srows">${rows.map(r=>{const t=keys.reduce((a,k)=>a+(r.v[k.id]||0),0);
    return `<div class="vz-rk" tabindex="0" data-tip="${vzA(`${r.label}: ${keys.map(k=>`${k.name} ${vzN(r.v[k.id]||0)}`).join(' · ')}${o.unit?' '+o.unit:''}${r.extra?' · '+r.extra:''}`)}"><span class="vz-rk-l" title="${vzA(r.label)}">${esc(r.label)}${r.sub?`<small>${esc(r.sub)}</small>`:''}</span>
      <span class="vz-rk-t">${keys.map(k=>(r.v[k.id]||0)>0?`<i class="vz-rk-b seg" style="width:${(r.v[k.id]||0)/max*100}%;--c:${k.color}"></i>`:'').join('')}</span><b class="vz-rk-v">${vzN(t)}${r.extra?`<small>${esc(r.extra)}</small>`:''}</b></div>`}).join('')}</div>`;
}
/* the period as a calendar heatmap (one-hue blue, 5 steps; public holidays outlined = OT days) */
function vzCal(days,o){
  o=o||{};const mx=Math.max(1,...days.map(d=>d.n));const lv=n=>n?Math.max(1,Math.min(5,Math.ceil(n/mx*5))):0;
  const tip=d=>`${fmtDay(d.k)}${d.hol?' · '+d.hol:''}: ${d.n} แผน · งานหน้างาน ${d.ons} · ว่าง ${d.free} คน${d.lv?` · ลา ${d.lv} คน`:''}`;
  const cell=(d,big)=>`<button type="button" class="vz-cc h${lv(d.n)}${d.off?' off':''}${d.today?' td':''}" data-vz-go="${d.k}" data-tip="${vzA(tip(d))}" aria-label="${vzA(tip(d))}">${big?`<span class="dn">${d.d.getDate()}</span>${d.n?`<b>${d.n}</b>`:''}`:''}</button>`;
  const legend=`<div class="vz-calk"><span>น้อย</span>${[1,2,3,4,5].map(i=>`<i class="vz-cc h${i}"></i>`).join('')}<span>มาก (${mx} แผน/วัน)</span><i class="vz-cc off"></i><span>วันหยุดนักขัตฤกษ์ (OT)</span></div>`;
  if(!o.compact){/* week / month: Monday-first calendar rows */
    const first=days[0].d;const lead=(first.getDay()+6)%7;const cells=[];for(let i=0;i<lead;i++)cells.push('<span class="vz-cc blank"></span>');days.forEach(d=>cells.push(cell(d,true)));
    return `<div class="vz-cal"><div class="vz-calh">${['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'].map(x=>`<span>${x}</span>`).join('')}</div><div class="vz-calg">${cells.join('')}</div></div>${legend}`}
  /* quarter / year: weeks as columns, Monday … Sunday as rows, month names on top */
  const first=days[0].d;const lead=(first.getDay()+6)%7;const cols=Math.ceil((lead+days.length)/7);let mons='',last=-1;
  days.forEach((d,i)=>{const col=Math.floor((lead+i)/7);if(d.d.getDate()<=7&&d.d.getMonth()!==last&&(lead+i)%7===0||i===0){last=d.d.getMonth();mons+=`<span style="grid-column:${col+1}">${TH_MON[d.d.getMonth()]}</span>`}});
  const cells=[];for(let i=0;i<lead;i++)cells.push('<span class="vz-cc blank"></span>');days.forEach(d=>cells.push(cell(d,false)));
  return `<div class="scroll-x plain"><div class="vz-calw" style="--cols:${cols}"><div class="vz-calm">${mons}</div><div class="vz-calr"><span>จ.</span><span></span><span>พ.</span><span></span><span>ศ.</span><span></span><span>อา.</span></div><div class="vz-calgw">${cells.join('')}</div></div></div>${legend}`;
}
/* small things for the number tiles */
function vzSpark(vals){const v=vals.map(x=>+x||0);if(v.length<2)return '';const mx=Math.max(1,...v);const st=100/(v.length-1);
  return `<svg class="vz-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="M${v.map((x,i)=>`${(i*st).toFixed(1)},${(26-x/mx*24).toFixed(1)}`).join('L')}" fill="none" stroke="var(--vz-1)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`}
function vzMeter(p,o){o=o||{};const v=Math.max(0,Math.min(100,p||0));return `<span class="vz-meter${o.cls?' '+o.cls:''}"><i style="width:${v}%"></i>${o.mark!=null?`<b style="left:${o.mark}%"></b>`:''}</span>`}

/* keyboard focus shows the same tip as hover; a calendar day / trend day opens that day in Weekly Plan */
document.addEventListener('focusin',e=>{const el=e.target.closest&&e.target.closest('.dz [data-tip]');const tp=document.getElementById('tip');if(!el||!tp)return;
  tp.textContent=el.dataset.tip;tp.hidden=false;const r=el.getBoundingClientRect();const z=(window.uiZoom&&window.uiZoom())||1;
  tp.style.left=Math.max(8,Math.min(window.innerWidth-tp.offsetWidth*z-8,r.left))/z+'px';tp.style.top=(r.bottom+6)/z+'px'});
document.addEventListener('focusout',e=>{if(e.target.closest&&e.target.closest('.dz [data-tip]')){const tp=document.getElementById('tip');if(tp)tp.hidden=true}});
document.addEventListener('click',e=>{const go=e.target.closest('[data-vz-go]');if(!go)return;const d=parseD(go.dataset.vzGo);if(!d||isNaN(d))return;jumpWeek(d);goView('plan')});
