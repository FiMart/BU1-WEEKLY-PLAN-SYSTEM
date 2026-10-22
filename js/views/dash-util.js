'use strict';
/* BU1 Weekly Plan · Utilization Manpower Onsite (user, 19 Oct 2026; the team's Excel sheet "Utilization Manpower Onsite BU1")
   Utilization = onsite works ÷ Std. Work · Std. Work = working days × works a day (ข้อมูลหลัก › Utilization หน้างาน, default
   7 = Model 34 onsite people ÷ 5 a team = 6.8). Working days = every day minus public holidays (user, 22 Oct 2026: "นับเสาร์อาทิตย์ด้วย",
   chose every day; Mon–Fri from 19 Oct 2026); a plan on a public holiday is listed as OT and left out of the %.
   1 work = 1 plan on 1 day (a half day is 1 too). A plan counts when it still holds its team (not เลื่อน / ยกเลิก), is not leave,
   ตรวจสุขภาพ, Stand by or Support, and has someone of ทีม Lab On-Site (All Team too); อบรม = the Training row, the rest = Customer
   work. Plans of every สายงาน and ทีม tab: this figure is the onsite team's, whatever the Dashboard filters show. */
const UTO_SKIP=new Set(['health','standby','support']);
const utoCfg=()=>Object.assign({model:34,team:5,perDay:7},(S.cfg&&S.cfg.util)||{});
const isUtoDay=d=>!holidayOf(ymd(d));/* Saturday and Sunday count too */
const utoTraining=t=>typeIdOf(t)==='training'||/อบรม|training/i.test(typeLabel(t));
const utoOnsite=t=>!isLeave(t)&&holdsTeam(t)&&!UTO_SKIP.has(typeIdOf(t))&&(t.staffIds||[]).some(id=>inTeamId(S.staff.find(s=>s.id===id),'onsite'));
const utoPct=(a,b)=>b?Math.round(a/b*100):0;

/* one period: {cust, train, total, ot, days, std, util} */
function utoCount(list,from,to){
  let cust=0,train=0,ot=0;const per=Number(utoCfg().perDay)||0;
  (list||[]).forEach(t=>{if(t.date<from||t.date>to||!utoOnsite(t))return;if(!isUtoDay(parseD(t.date))){ot++;return}if(utoTraining(t))train++;else cust++});
  let days=0;for(let d=parseD(from);ymd(d)<=to;d=addDays(d,1))if(isUtoDay(d))days++;
  const total=cust+train,std=days*per;return {cust,train,total,ot,days,std,util:utoPct(total,std)};
}
const utoNote=u=>`${u.total} งาน จาก Std. ${u.std} งาน (${u.days} วันทำงาน รวมเสาร์–อาทิตย์ × ${utoCfg().perDay} งาน/วัน) · ลูกค้า ${u.cust} · อบรม ${u.train}${u.ot?` · OT วันหยุดนักขัตฤกษ์ ${u.ot} งาน (ไม่นับ)`:''}`;
const utoLevel=u=>u.util>100?'bad':u.util>=85?'warn':'';
const utoSay=u=>u.util>100?`เกินกำลังทีมหน้างาน (มากกว่า ${utoCfg().perDay} งาน/วัน) ควรเกลี่ยงานหรือเพิ่มคน`:u.util>=85?'ใกล้เต็มกำลังทีมหน้างาน':u.util<50?'ยังรับงานหน้างานเพิ่มได้':'อยู่ในระดับปกติ';

/* the year table (Jan–Dec) like the team's sheet; null while the year's plans load */
const utoYear=()=>S.utYear||S.month.getFullYear();
function utoYearData(){
  const y=utoYear();const list=rangeTasks(`${y}-01-01`,`${y}-12-31`);if(!list)return null;
  const today=ymd(new Date());let acc=0,accStd=0;
  const months=Array.from({length:12},(_,i)=>{const from=ymd(new Date(y,i,1)),to=ymd(new Date(y,i+1,0));const u=utoCount(list,from,to);
    acc+=u.total;accStd+=u.std;return Object.assign(u,{i,from,to,acc,accStd,est:to>=today&&u.total>0,cur:today>=from&&today<=to})});
  const used=months.filter(m=>m.total);const avg=k=>used.length?used.reduce((a,m)=>a+m[k],0)/used.length:0;
  const sum=k=>used.reduce((a,m)=>a+m[k],0);
  return {y,months,used:used.length,avg:{cust:avg('cust'),train:avg('train'),total:avg('total'),ot:avg('ot')},util:utoPct(sum('total'),sum('std')),
    days:months.reduce((a,m)=>a+m.days,0),std:months.reduce((a,m)=>a+m.std,0)};
}
/* rows shared by the page, the A4 print and Excel */
function utoRows(Y){
  const M=Y.months;const r1=n=>Math.round(n*10)/10;
  return {sheet:'Utilization Onsite',title:`Utilization Manpower Onsite BU1 · ปี ${Y.y+543} (${Y.y})`,head:['Work (Team)',...M.map(m=>(m.est?'EST-':'')+EN_MON[m.i]),'Average / Month'],num:Array.from({length:13},(_,i)=>i+1),
    rows:[['Customer work',...M.map(m=>m.cust),r1(Y.avg.cust)],['Training (อบรม)',...M.map(m=>m.train),r1(Y.avg.train)],['Total',...M.map(m=>m.total),r1(Y.avg.total)],
      ['Accumulate',...M.map(m=>m.acc),''],['%Utilization Lab-Onsite',...M.map(m=>m.util+'%'),Y.util+'%'],
      ['Working Day (จ.–อา.)',...M.map(m=>m.days),Y.days],[`Std. Work (× ${utoCfg().perDay} งาน/วัน)`,...M.map(m=>m.std),Y.std],['Accumulate Std.',...M.map(m=>m.accStd),''],
      ['OT วันหยุดนักขัตฤกษ์ (ไม่นับ)',...M.map(m=>m.ot),r1(Y.avg.ot)]]};
}
function utoPanelHtml(){
  const Y=utoYearData();const c=utoCfg();
  const nav=`<span class="uto-nav"><button type="button" class="arrow" data-uto-y="-1" aria-label="ปีก่อน">‹</button><b>${utoYear()+543}</b><button type="button" class="arrow" data-uto-y="1" aria-label="ปีถัดไป">›</button></span>`;
  const head=`<header><h2>Utilization Manpower Onsite · ทีม Lab On-Site</h2>${nav}<p>งานหน้างาน ÷ Std. Work · Std. Work = วันทำงานทุกวันรวมเสาร์–อาทิตย์ (ไม่รวมวันหยุดนักขัตฤกษ์) × ${esc(String(c.perDay))} งาน/วัน (Model ${esc(String(c.model))} คน ÷ ทีมละ ${esc(String(c.team))} คน) = 100% · 1 แผน 1 วัน = 1 งาน · นับแผนที่มีคนทีม Lab On-Site / All Team ทุกสายงาน ไม่นับ ลา ตรวจสุขภาพ Stand by Support และแผนเลื่อน / ยกเลิก · งานวันหยุดนักขัตฤกษ์ = OT แสดงแยก ไม่นับใน % · EST = เดือนที่ยังมีแผนรอถึงวัน (ประมาณการ)</p></header>`;
  if(!Y)return `<section class="panel span-12 uto" style="--d:5">${head}${loading()}</section>`;
  const T=utoRows(Y);const M=Y.months;
  const cell=(m,v,cls)=>`<td class="n${m.est?' est':''}${m.cur?' cur':''}${cls?' '+cls:''}">${v}</td>`;
  const row=(lbl,f,last,cls)=>`<tr class="${cls||''}"><th scope="row">${lbl}</th>${M.map(m=>cell(m,f(m),cls==='pct'?(m.util>100?'over':m.util&&m.util<50?'low':''):'')).join('')}<td class="n avg">${last}</td></tr>`;
  const r1=n=>f1(n);
  return `<section class="panel span-12 uto" style="--d:5">${head}<div class="scroll-x plain"><table class="mini uto-t"><thead><tr><th>Work (Team)</th>${M.map(m=>`<th class="n${m.est?' est':''}${m.cur?' cur':''}">${m.est?'<small>EST</small>':''}${TH_MON[m.i]}</th>`).join('')}<th class="n avg">เฉลี่ย / เดือน</th></tr></thead><tbody>
    ${row('Customer work',m=>m.cust||'',r1(Y.avg.cust))}${row('Training (อบรม)',m=>m.train||'',r1(Y.avg.train))}${row('Total',m=>m.total||'',r1(Y.avg.total),'tot')}
    ${row('Accumulate',m=>m.acc.toLocaleString('th-TH'),'','acc')}${row('%Utilization',m=>m.days?m.util+'%':'',Y.util+'%','pct')}
    ${row('Working Day (จ.–อา.)',m=>m.days,Y.days,'sub')}${row(`Std. Work (× ${esc(String(c.perDay))})`,m=>m.std,Y.std.toLocaleString('th-TH'),'sub')}${row('Accumulate Std.',m=>m.accStd.toLocaleString('th-TH'),'','sub')}
    ${row('OT วันหยุดนักขัตฤกษ์',m=>m.ot||'',r1(Y.avg.ot),'ot')}</tbody></table></div>
    <p class="hint uto-foot">เฉลี่ย / เดือน = เฉลี่ยเฉพาะเดือนที่มีงาน (${Y.used} เดือน) · %Utilization เฉลี่ย = งานรวม ÷ Std. Work ของเดือนเหล่านั้น · ตั้งค่า Model / คนต่อทีม / งานต่อวัน ที่ ข้อมูลหลัก › Utilization หน้างาน</p></section>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-uto-y]');if(!b)return;S.utYear=utoYear()+Number(b.dataset.utoY);render()});

/* ข้อมูลหลัก › Utilization หน้างาน: Model onsite people ÷ people a team = works a day (100%) */
function utoSection(){
  const c=utoCfg();const dis=can('master')?'':' disabled';
  return {id:'util',title:'Utilization หน้างาน',sub:`${c.perDay} งาน/วัน = 100%`,count:'KPI',
    desc:'ใช้คำนวณ Utilization Manpower Onsite ใน Dashboard: งานหน้างาน ÷ (วันทำงาน × งานต่อวัน) · วันทำงาน = ทุกวันรวมเสาร์–อาทิตย์ · วันหยุดนักขัตฤกษ์นับเป็น OT',
    body:`<div class="jb-kset uto-set"><label>Model คนหน้างาน <input type="number" min="1" max="500" class="w-num" data-utocfg="model" value="${esc(String(c.model))}"${dis}> คน</label>
      <label>เฉลี่ยทีมละ <input type="number" min="1" max="20" class="w-num" data-utocfg="team" value="${esc(String(c.team))}"${dis}> คน</label>
      <label>งานหน้างานต่อวัน (= 100%) <input type="number" min="1" max="100" class="w-num" data-utocfg="perDay" value="${esc(String(c.perDay))}"${dis}> งาน/วัน</label>
      <p class="hint">${esc(String(c.model))} ÷ ${esc(String(c.team))} = ${f1(c.model/c.team)} ≈ ${Math.round(c.model/c.team)} งาน/วัน · เปลี่ยน Model หรือคนต่อทีม ระบบปัดเศษให้เอง แก้งานต่อวันเองได้ (อบรม = 1 งาน)</p></div>`};
}
document.addEventListener('change',e=>{const k=e.target.dataset&&e.target.dataset.utocfg;if(!k||!can('master'))return;
  const v=Math.max(1,Math.min(500,Math.floor(Number(e.target.value)||0)||1));const c=Object.assign({},utoCfg(),{[k]:v});
  if(k!=='perDay')c.perDay=Math.max(1,Math.round(c.model/c.team));
  saveCfg({util:c},'บันทึกค่า Utilization หน้างานแล้ว')});
