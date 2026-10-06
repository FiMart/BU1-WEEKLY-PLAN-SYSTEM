'use strict';
/* BU1 Weekly Plan · certStatus — Safety area-card status of a person (same rules as BU2's certStatus.ts)
   Pure functions: no DOM, no network. js/features/safety.js loads the data and draws the badges.
   Rules copied one for one from BU2 / the old BU1 app (v2.8.0 bundle, the hook that feeds the team picker):
   - an area is checked against ONE card type: its first active rule in safety.area_cert_rules, ordered by cert_type_id;
     an area with no active rule needs no card → no status at all
   - a card counts when it is of that type and its area_id is that area or empty (a general card)
   - when a person holds several, the latest expiry_date wins (compared as text; a card with no expiry_date loses)
   - status from that expiry, counted in whole days from today (00:00 local):
       no expiry → none (ยังไม่เคยอบรม) · already past → bad (หมดอายุ) · within warn_days_before → warn (ใกล้หมดอายุ) · else ok
   - a person not linked in core.person_id_map has no status (unknown) — never "ไม่มีบัตร"
   - badge text on the team picker: warn "ใกล้หมด", bad "หมดอายุ", none "ไม่มีบัตร"; ok and unknown show nothing

   data = {rules:[{area_id,cert_type_id,warn_days_before,active}], certsByEmp: Map(emp_code → [{cert_type_id,area_id,expiry_date}]),
           empOf: Map(people.id → emp_code)} */
const CERT_LABEL={ok:'ผ่าน / ปกติ',warn:'ใกล้หมดอายุ',bad:'หมดอายุ',none:'ยังไม่เคยอบรม'};
const CERT_BADGE={ok:'',warn:'ใกล้หมด',bad:'หมดอายุ',none:'ไม่มีบัตร',unknown:''};

/* BU2 Cp(expiry, warnDays) */
function certStatus(expiry,warnDays){
  if(!expiry)return 'none';
  const today=new Date();today.setHours(0,0,0,0);
  const left=Math.round((parseD(expiry).getTime()-today.getTime())/864e5);
  return left<0?'bad':left<=warnDays?'warn':'ok';
}
/* the one rule an area is checked against: first active rule by cert_type_id (BU2: .order('cert_type_id').limit(1)) */
function areaRule(data,areaId){
  return data.rules.filter(r=>r.area_id===areaId&&r.active!==false)
    .sort((a,b)=>String(a.cert_type_id)<String(b.cert_type_id)?-1:String(a.cert_type_id)>String(b.cert_type_id)?1:0)[0]||null;
}
/* latest expiry of one person's cards for the rule (BU2 keeps the max of expiry_date||'') */
function latestExpiry(data,emp,rule,areaId){
  let best,found=false;
  (data.certsByEmp.get(emp)||[]).filter(c=>c.cert_type_id===rule.cert_type_id&&(c.area_id==null||c.area_id===areaId))
    .forEach(c=>{if(!found||(c.expiry_date||'')>(best||'')){best=c.expiry_date;found=true}});
  return found?best??null:null;
}
/* one person on one area → null (area needs no card) or {k: ok|warn|bad|none|unknown, expiry, rule} */
function personCardStatus(data,peopleId,areaId){
  const rule=areaRule(data,areaId);if(!rule)return null;
  const emp=data.empOf.get(peopleId);
  if(!emp)return {k:'unknown',expiry:null,rule};
  const expiry=latestExpiry(data,emp,rule,areaId);
  return {k:certStatus(expiry,rule.warn_days_before),expiry,rule};
}
/* a team on one area → counts per status */
function teamCardCounts(data,ids,areaId){
  const n={ok:0,warn:0,bad:0,none:0,unknown:0};
  ids.forEach(id=>{const s=personCardStatus(data,id,areaId);if(s)n[s.k]++});
  return n;
}
