'use strict';
/* BU1 Weekly Plan · master data */
/* ---------- view: master data ---------- */
/* master data: a list of topics on the left, the chosen topic on the right */
function filterMd(){
  const inp=$('#md-q');if(!inp)return;if(document.activeElement!==inp)inp.value=S.mdq;
  const q=norm(S.mdq);let n=0;const rows=document.querySelectorAll('#view .md-body tbody tr[data-q]');
  rows.forEach(r=>{const on=!q||r.dataset.q.includes(q);r.hidden=!on;if(on)n++});
  const c=$('#md-qn');if(c)c.textContent=q?`พบ ${n} จาก ${rows.length} คน`:`${rows.length} คน`;
}
const MD_ICONS={
  staff:'<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.4-.3 4.4 1.3 5 4.3"/>',
  vehicle:'<path d="M3.5 16.5V11l2-4.2A2 2 0 0 1 7.3 5.5h7.9a2 2 0 0 1 1.7 1L19.5 11h.5a1 1 0 0 1 1 1v4.5"/><path d="M3.5 11h16"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/>',
  types:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="3.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="3.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  sales:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  positions:'<rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4 12.5h16"/>',
  periods:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sample:'<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
  users:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/><path d="m16.5 4.5 1.5 1.5 3-3"/>',
  backup:'<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 7.97"/><path d="M12 12v8M9 17l3 3 3-3"/>',
  holidays:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m12 12.6.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  about:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
  prefs:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
};
function renderSettings(){
  if(notReady())return loading();
  const dis=can('master')?'':' disabled';
  const staff=S.staff.slice().sort((a,b)=>roleRank(a)-roleRank(b)||sortPeople(a,b));
  const vs=vehicles();const types=jobTypes();const pos=positions();
  const sampleN=S.staff.filter(x=>x.sample).length+S.resources.filter(x=>x.sample).length+S.projects.filter(x=>x.sample).length;
  const hasSample=sampleN>0||S.tasks.some(t=>t.sample);
  const posOpts=(cur)=>{const l=pos.slice();if(cur&&!l.includes(cur))l.push(cur);return `<option value="">— ไม่ระบุ —</option>`+l.map(p=>`<option value="${esc(p)}"${p===cur?' selected':''}>${esc(p)}</option>`).join('')};
  const activeStaff=staff.filter(s=>s.active!==false).length;
  const secs=[
    {id:'staff',title:'พนักงาน',sub:`ใช้งาน ${activeStaff} คน`,count:staff.length,
     desc:'รายชื่อสำหรับ Team Service เรียงตามตำแหน่ง คนที่ปิดใช้งานจะไม่แสดงในตัวเลือก แต่แผนเก่ายังอยู่ครบ',
     body:`<div class="md-tools"><input type="search" id="md-q" placeholder="ค้นหาชื่อ หรือตำแหน่ง" aria-label="ค้นหาพนักงาน" autocomplete="off"><span class="hint" id="md-qn">${staff.length} คน</span></div>
      <div class="scroll-x plain md-scroll"><table class="edit-table"><thead><tr><th>ลำดับ</th><th>ชื่อ</th><th>ตำแหน่ง</th><th>ใช้งาน</th><th></th></tr></thead><tbody>
      ${staff.map(s=>`<tr class="${s.active===false?'inactive':''}" data-q="${esc(norm([s.name,s.role].join(' ')))}"><td><input class="w-num" type="number" min="0" id="st-o-${esc(s.id)}" data-coll="staff" data-id="${esc(s.id)}" data-field="order" value="${esc(s.order??'')}"${dis} aria-label="ลำดับ"></td>
        <td><input id="st-n-${esc(s.id)}" data-coll="staff" data-id="${esc(s.id)}" data-field="name" value="${esc(s.name)}" maxlength="80"${dis} aria-label="ชื่อ"></td>
        <td><select id="st-r-${esc(s.id)}" data-coll="staff" data-id="${esc(s.id)}" data-field="role"${dis} aria-label="ตำแหน่ง">${posOpts(s.role||'')}</select></td>
        <td><input type="checkbox" id="st-a-${esc(s.id)}" data-coll="staff" data-id="${esc(s.id)}" data-field="active"${s.active!==false?' checked':''}${dis} aria-label="ใช้งาน"></td>
        <td>${can('master')?`<button type="button" class="btn sm danger" data-action="del-row" data-coll="staff" data-id="${esc(s.id)}">ลบ</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="hint">ยังไม่มีรายชื่อ</td></tr>'}
      </tbody></table></div>
      ${can('master')?`<form class="add-row" data-add="staff"><input name="name" id="add-st-name" placeholder="ชื่อ-นามสกุล" maxlength="80" required aria-label="ชื่อ"><select name="role" id="add-st-role" aria-label="ตำแหน่ง">${posOpts('')}</select><button class="btn primary" type="submit">เพิ่มคน</button></form>
      <details class="bulk"><summary>เพิ่มหลายคนพร้อมกัน (วางจาก Excel)</summary><form data-bulk>
        <p class="hint" style="margin:0">หนึ่งคนต่อหนึ่งบรรทัด เรียงคอลัมน์ ชื่อ · ตำแหน่ง คัดลอกจาก Excel มาวางได้เลย ระบบจะข้ามชื่อที่มีอยู่แล้ว</p>
        <textarea name="rows" id="bulk-rows" rows="6" placeholder="สมชาย ใจดี&#9;Engineer&#10;สมหญิง รักงาน&#9;Technician"></textarea>
        <div><button class="btn primary" type="submit">เพิ่มทั้งหมด</button></div></form></details>`:''}`},
    {id:'vehicle',title:'รถ',sub:'ประเภทรถ · ชื่อรถ / ทะเบียน',count:vs.length,
     desc:'รถที่ใช้เลือกในช่อง รถ / Car ของแผนงาน จัดกลุ่มตามประเภทรถ (เช่น MOBILE CRANE, HIAB เช่าเพิ่ม, รถกระบะ) ระบบเตือนเมื่อรถคันเดียวกันถูกใช้ 2 งานในช่วงเวลาที่ทับกัน รถที่พิมพ์ใหม่ในแผนเพิ่มเข้ามาที่นี่ได้ด้วยปุ่ม "+ เพิ่ม … เข้าข้อมูลรถ"',
     body:`<datalist id="dl-vgroups">${[...new Set(vs.map(vehGroup))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist><div class="scroll-x plain md-scroll"><table class="edit-table"><thead><tr><th>ลำดับ</th><th>ประเภทรถ</th><th>ชื่อรถ / ทะเบียน</th><th>รายละเอียด</th><th>ใช้งาน</th><th></th></tr></thead><tbody>
      ${vs.slice().sort((a,b)=>vehGroup(a).localeCompare(vehGroup(b),'th')||sortPeople(a,b)).map(r=>`<tr class="${r.active===false?'inactive':''}"><td><input class="w-num" type="number" min="0" id="rs-o-${esc(r.id)}" data-coll="resources" data-id="${esc(r.id)}" data-field="order" value="${esc(r.order??'')}"${dis} aria-label="ลำดับ"></td>
        <td><input id="rs-g-${esc(r.id)}" list="dl-vgroups" data-coll="resources" data-id="${esc(r.id)}" data-field="group" value="${esc(r.group||'')}" maxlength="60"${dis} aria-label="ประเภทรถ" placeholder="${VEH_NO_GROUP}"></td>
        <td><input id="rs-n-${esc(r.id)}" class="mono" data-coll="resources" data-id="${esc(r.id)}" data-field="name" value="${esc(r.name)}" maxlength="60"${dis} aria-label="ชื่อรถ / ทะเบียน"></td>
        <td><input id="rs-c-${esc(r.id)}" data-coll="resources" data-id="${esc(r.id)}" data-field="code" value="${esc(r.code||'')}" maxlength="60"${dis} aria-label="รายละเอียด" placeholder="เช่น GC · ขจ 8723"></td>
        <td><input type="checkbox" id="rs-a-${esc(r.id)}" data-coll="resources" data-id="${esc(r.id)}" data-field="active"${r.active!==false?' checked':''}${dis} aria-label="ใช้งาน"></td>
        <td>${can('master')?`<button type="button" class="btn sm danger" data-action="del-row" data-coll="resources" data-id="${esc(r.id)}">ลบ</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="hint">ยังไม่มีรถ</td></tr>'}
      </tbody></table></div>
      ${can('master')?`<form class="add-row" data-add="vehicle"><input name="group" id="add-rs-group" list="dl-vgroups" placeholder="ประเภทรถ เช่น รถกระบะ" maxlength="60" aria-label="ประเภทรถ" style="flex-basis:150px"><input name="name" id="add-rs-name" class="mono" placeholder="ชื่อรถ / ทะเบียน" maxlength="60" required aria-label="ชื่อรถ / ทะเบียน"><input name="code" id="add-rs-code" placeholder="รายละเอียด เช่น GC · ขจ 8723" maxlength="60" aria-label="รายละเอียด"><button class="btn primary" type="submit">เพิ่มรถ</button></form>`:''}`},
    {id:'types',title:'หัวข้องาน',sub:'ประเภทงาน · ชื่อและสีของแผน',count:types.length,
     desc:'ชื่อและสีของแผนแต่ละประเภท "ลา" ใช้ตรวจการจัดงานในวันลา "อื่นๆ" ให้พิมพ์หัวข้อเองในแผน สองประเภทนี้ลบไม่ได้',
     body:`<div class="scroll-x plain md-scroll"><table class="edit-table"><thead><tr><th>สี</th><th>ชื่อ</th><th>ใช้งาน</th><th></th></tr></thead><tbody>
      ${types.map((t,i)=>`<tr class="${t.active===false?'inactive':''}"><td><input type="color" class="swatch-in" id="ty-c-${i}" data-type-idx="${i}" data-type-field="color" value="${safeColor(t.color)}"${dis} aria-label="สีของ ${esc(t.name)}"></td>
        <td><input id="ty-n-${i}" data-type-idx="${i}" data-type-field="name" value="${esc(t.name)}" maxlength="40"${dis} aria-label="ชื่อประเภท"></td>
        <td><input type="checkbox" id="ty-a-${i}" data-type-idx="${i}" data-type-field="active"${t.active!==false?' checked':''}${dis||(SYSTEM_TYPES.has(t.id)?' disabled':'')} aria-label="ใช้งาน"></td>
        <td>${SYSTEM_TYPES.has(t.id)?'<span class="sys-tag">ประเภทระบบ</span>':can('master')?`<button type="button" class="btn sm danger" data-action="del-type" data-idx="${i}">ลบ</button>`:''}</td></tr>`).join('')}
      </tbody></table></div>
      ${can('master')?`<form class="add-row" data-add-type><input type="color" name="color" id="add-ty-color" class="swatch-in" value="#2a78d6" aria-label="สี"><input name="name" id="add-ty-name" placeholder="ชื่อประเภทงานใหม่" maxlength="40" required aria-label="ชื่อประเภท"><button class="btn primary" type="submit">เพิ่มประเภท</button></form>`:''}`},
    {id:'sales',title:'รายชื่อ Sale',sub:'ชื่อและเบอร์โทร',count:sales().length,
     desc:'ตัวเลือกในช่อง Sale ของแผนงาน เบอร์โทรจะแสดงใต้ช่อง Sale และในไฟล์พิมพ์',
     body:`<div class="scroll-x plain md-scroll"><table class="edit-table"><thead><tr><th>ชื่อ Sale</th><th>เบอร์โทร</th><th></th></tr></thead><tbody>
      ${(S.cfg.sales||[]).map((s,i)=>`<tr><td><input id="sl-n-${i}" data-sale-idx="${i}" data-sale-field="name" value="${esc(s.name)}" maxlength="80"${dis} aria-label="ชื่อ Sale"></td><td><input id="sl-t-${i}" data-sale-idx="${i}" data-sale-field="tel" value="${esc(s.tel||'')}" maxlength="60"${dis} aria-label="เบอร์โทร Sale"></td><td>${can('master')?`<button type="button" class="btn sm danger" data-action="del-sale" data-idx="${i}">ลบ</button>`:''}</td></tr>`).join('')||'<tr><td colspan="3" class="hint">ยังไม่มีรายชื่อ Sale</td></tr>'}
      </tbody></table></div>
      ${can('master')?`<form class="add-row" data-add-sale><input name="name" id="add-sl-name" placeholder="ชื่อ Sale" maxlength="80" required aria-label="ชื่อ Sale"><input name="tel" id="add-sl-tel" placeholder="เบอร์โทร" maxlength="60" aria-label="เบอร์โทร"><button class="btn primary" type="submit">เพิ่ม Sale</button></form>`:''}`},
    {id:'positions',title:'ตำแหน่งพนักงาน',sub:'ใช้จัดกลุ่มรายชื่อพนักงาน',count:pos.length,
     desc:'ตัวเลือกในช่องตำแหน่งของพนักงาน และใช้จัดกลุ่มรายชื่อตอนเลือก Team Service ในแผน (เรียงตามลำดับในรายการนี้)',
     body:`<div class="scroll-x plain"><table class="edit-table"><tbody>
      ${pos.map((p,i)=>`<tr><td style="width:1%" class="hint">${i+1}</td><td><input id="ps-${i}" data-pos-idx="${i}" value="${esc(p)}" maxlength="40"${dis} aria-label="ตำแหน่ง"></td><td class="hint" style="width:1%;white-space:nowrap">${S.staff.filter(s=>s.role===p).length} คน</td><td style="width:1%">${can('master')?`<button type="button" class="btn sm danger" data-action="del-pos" data-idx="${i}">ลบ</button>`:''}</td></tr>`).join('')}
      </tbody></table></div>
      ${can('master')?`<form class="add-row" data-add-pos><input name="name" id="add-ps-name" placeholder="ตำแหน่งใหม่" maxlength="40" required aria-label="ตำแหน่งใหม่"><button class="btn primary" type="submit">เพิ่มตำแหน่ง</button></form>`:''}`},
    {id:'periods',title:'ช่วงเวลา',sub:'เช้า / บ่าย / เช้า,บ่าย',count:3,
     desc:'ใช้ตรวจการจัดคนชนกันและรถที่ใช้งานซ้ำกัน แผนงานที่อยู่ในช่วงเวลาที่ทับกันจะถูกเตือน ช่วงเวลาเป็นค่าคงที่ของระบบ',
     body:`<table class="mini"><thead><tr><th>ช่วงเวลา</th><th>ทับกับ</th></tr></thead><tbody>
      <tr><td><b>เช้า</b></td><td>เช้า · เช้า,บ่าย</td></tr><tr><td><b>บ่าย</b></td><td>บ่าย · เช้า,บ่าย</td></tr><tr><td><b>เช้า,บ่าย</b> (ทั้งวัน)</td><td>ทุกช่วงเวลา</td></tr></tbody></table>
      <p class="hint" style="margin:0">เวลาจริง เช่น "ถึงหน้างาน 08.30 น." ให้พิมพ์ในช่อง Time ของแผน</p>`},
  ];
  if(can('master'))secs.push({id:'sample',title:'ข้อมูลตัวอย่าง',sub:hasSample?'ยังมีข้อมูลตัวอย่างอยู่':'ลบแล้ว',count:hasSample?'!':'0',
     desc:hasSample?'ตอนนี้มีพนักงาน รถ แผน และโปรเจกต์ตัวอย่างอยู่ในระบบ ลบออกก่อนเริ่มใช้งานจริง ข้อมูลที่ทีมเพิ่มเองจะไม่ถูกลบ':'ไม่มีข้อมูลตัวอย่างเหลืออยู่',
     body:`<div><button type="button" class="btn danger" data-action="clear-sample"${hasSample?'':' disabled'}>ลบข้อมูลตัวอย่างทั้งหมด</button></div>`});
  const us=usersSection();if(us)secs.unshift(us);
  secs.splice(secs.findIndex(s=>s.id==='periods')+1,0,holidaySection());
  secs.push(backupSection(),prefsSection(),aboutSection());
  const cur=secs.find(s=>s.id===S.md)||secs[0];
  return `
  <div class="md">
    <nav class="md-list" role="tablist" aria-label="หัวข้อข้อมูลหลัก"><p class="md-cap">หัวข้อข้อมูลหลัก</p>
      ${secs.map(s=>`<button type="button" role="tab" class="md-item${(s.id==='sample'&&hasSample)||s.warn?' warn':''}" data-md="${s.id}" aria-selected="${s.id===cur.id}"><span class="md-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${MD_ICONS[s.id]}</svg></span><span class="md-txt"><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></span><span class="md-count">${esc(s.count)}</span></button>`).join('')}
    </nav>
    <section class="panel md-body" role="tabpanel" aria-label="${esc(cur.title)}"><header><h2>${esc(cur.title)} <span class="md-count">${esc(cur.count)}</span></h2><p>${esc(cur.desc)}</p></header>${cur.body}</section>
  </div>`;
}
