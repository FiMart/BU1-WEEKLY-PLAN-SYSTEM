'use strict';
/* BU1 Weekly Plan · app state and per-account preferences */
/* ---------- state ---------- */
const S={staff:[],resources:[],projects:[],tasks:[],cfg:{},week:mondayOf(new Date()),month:firstOfMonth(new Date()),view:'plan',showSun:true,
  mode:'connecting',canWrite:true,me:null,tasksReady:false};
S.pf={q:'',teams:[],busy:false,staff:'',type:'',by:'type',groups:[]};S.anim='view';S.sel=new Set();
S.srch={q:'',by:'all',from:'',to:''};S.showAvail=true;S.pmode=null;S.pday=null;S.mday=null;S.md='staff';S.mdq='';S.dash={mode:'week'};S.projEdit=null;
const flashIds=new Set();
const known=new Map();
const reduceMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
/* start page: Weekly Plan, every time the site is opened. Only a refresh (F5) stays on the page that was open — a reopened
   tab or a restored browser session also brings back sessionStorage, so the navigation type decides, not the stored value */
const isReload=(()=>{try{const n=performance.getEntriesByType('navigation')[0];if(n)return n.type==='reload';return performance.navigation&&performance.navigation.type===1}catch(e){return false}})();
try{const v=sessionStorage.getItem('bu1wp.view');if(isReload&&VIEWS.includes(v))S.view=v;else sessionStorage.removeItem('bu1wp.view')}catch(e){}
try{localStorage.removeItem('bu1wp.view')}catch(e){}
{const h=(location.hash||'').slice(1);if(VIEWS.includes(h))S.view=h}
const rememberView=v=>{try{sessionStorage.setItem('bu1wp.view',v)}catch(e){}};

/* ---------- preferences per account ----------
   One JSON object per account in this browser ('bu1wp.prefs.<account>'). At start-up the last account's prefs are shown
   (no flash of the wrong theme), then usePrefsOf() swaps in the signed-in account's. With Supabase the same object is
   kept in the account's user_metadata.bu1wp_prefs, so it follows the person to other devices (prefSync, js/data/supabase.js). */
const PREF_KEYS=['theme','mini','by','avail','sun7','pfbusy','dash','pmode','md'];
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}};
const cleanPrefs=o=>{const out={};if(o&&typeof o==='object')PREF_KEYS.forEach(k=>{if(o[k]!=null)out[k]=String(o[k])});return out};
function readPrefs(owner){try{return cleanPrefs(JSON.parse(lsGet('bu1wp.prefs.'+owner)||'{}'))}catch(e){return {}}}
/* prefs saved per browser before they became per account: handed to the first account that signs in here, then removed */
function legacyPrefs(){const o={};PREF_KEYS.forEach(k=>{const v=lsGet('bu1wp.'+k);if(v!=null)o[k]=v});return o}
const dropLegacy=()=>PREF_KEYS.forEach(k=>lsSet('bu1wp.'+k,null));
let prefOwner=null,prefSync=null;
let prefs=(()=>{const last=lsGet('bu1wp.lastUser');return last?readPrefs(last):legacyPrefs()})();
const pref=k=>prefs[k]==null?null:prefs[k];
/* tablets (761–1180px) start with the icon-only sidebar; the saved choice applies again on wider screens */
const isTabletW=()=>innerWidth>760&&innerWidth<=1180;
let wasTablet=isTabletW();
function applyPrefs(){
  S.showSun=pref('sun7')!=='0';S.pf.busy=pref('pfbusy')==='1';S.showAvail=pref('avail')!=='0';
  S.dash.mode=['month','quarter','year'].includes(pref('dash'))?pref('dash'):'week';
  S.pf.by=pref('by')==='cust'?'cust':'type';S.pf.groups=[];
  S.md=pref('md')||'staff';S.pmode=pref('pmode')==='day'||pref('pmode')==='week'?pref('pmode'):null;
  document.body.classList.toggle('mini',wasTablet||pref('mini')==='1');
  const th=pref('theme');if(th==='dark'||th==='light')document.documentElement.setAttribute('data-theme',th);else document.documentElement.removeAttribute('data-theme');
}
applyPrefs();
function savePrefs(){
  if(!prefOwner)return;/* before sign-in a change lives in memory only, so it never lands on another person's prefs */
  lsSet('bu1wp.prefs.'+prefOwner,JSON.stringify(prefs));
  if(prefSync)prefSync(Object.assign({},prefs));
}
const remember=(k,v)=>{prefs[String(k).replace(/^bu1wp\./,'')]=String(v);savePrefs()};
const forget=k=>{delete prefs[String(k).replace(/^bu1wp\./,'')];savePrefs()};
/* called once the account is known: id = e-mail / claude.ai user id / 'local'; remote = prefs stored with the account (Supabase) */
function usePrefsOf(id,remote,sync){
  const owner=String(id||'local').trim().toLowerCase();
  const fromRemote=cleanPrefs(remote);const local=readPrefs(owner);
  let p=Object.keys(fromRemote).length?fromRemote:Object.keys(local).length?local:legacyPrefs();
  dropLegacy();
  prefOwner=owner;prefs=p;prefSync=sync||null;lsSet('bu1wp.lastUser',owner);
  lsSet('bu1wp.prefs.'+owner,JSON.stringify(prefs));
  if(prefSync&&!Object.keys(fromRemote).length&&Object.keys(prefs).length)prefSync(Object.assign({},prefs));
  applyPrefs();
  if(typeof syncThemeLbl==='function')syncThemeLbl();
}
window.addEventListener('resize',()=>{const t=isTabletW();if(t===wasTablet)return;wasTablet=t;document.body.classList.toggle('mini',t||pref('mini')==='1')});

let db=null,users=null,downloads=null,unsubTasks=null;
