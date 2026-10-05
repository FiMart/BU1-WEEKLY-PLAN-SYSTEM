'use strict';
/* BU1 Weekly Plan · app state and per-viewer preferences */
/* ---------- state ---------- */
const S={staff:[],resources:[],projects:[],tasks:[],cfg:{},week:mondayOf(new Date()),month:firstOfMonth(new Date()),view:'plan',showSun:true,
  mode:'connecting',canWrite:true,me:null,tasksReady:false};
S.pf={q:'',teams:[],busy:false,staff:'',type:'',by:'type',groups:[]};S.anim='view';S.sel=new Set();
S.srch={q:'',by:'all',from:'',to:''};S.showAvail=true;S.pmode=null;S.pday=null;S.mday=null;S.md='staff';S.mdq='';S.dash={mode:'week'};S.projEdit=null;
const flashIds=new Set();
const known=new Map();
const reduceMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
try{const v=localStorage.getItem('bu1wp.view');if(VIEWS.includes(v))S.view=v;S.showSun=localStorage.getItem('bu1wp.sun7')!=='0';
  S.pf.busy=localStorage.getItem('bu1wp.pfbusy')==='1';
  {const dm=localStorage.getItem('bu1wp.dash');if(['month','quarter','year'].includes(dm))S.dash.mode=dm}
  if(localStorage.getItem('bu1wp.by')==='cust')S.pf.by='cust';
  S.md=localStorage.getItem('bu1wp.md')||'staff';
  {const pm=localStorage.getItem('bu1wp.pmode');if(pm==='day'||pm==='week')S.pmode=pm}
  S.showAvail=localStorage.getItem('bu1wp.avail')!=='0';
  if(localStorage.getItem('bu1wp.mini')==='1')document.body.classList.add('mini');
  const th=localStorage.getItem('bu1wp.theme');if(th==='dark'||th==='light')document.documentElement.setAttribute('data-theme',th)}catch(e){}
{const h=(location.hash||'').slice(1);if(VIEWS.includes(h))S.view=h}
const remember=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
/* tablets (761–1180px) start with the icon-only sidebar; the saved choice applies again on wider screens */
const isTabletW=()=>innerWidth>760&&innerWidth<=1180;
let wasTablet=isTabletW();if(wasTablet)document.body.classList.add('mini');
window.addEventListener('resize',()=>{const t=isTabletW();if(t===wasTablet)return;wasTablet=t;let pref=false;try{pref=localStorage.getItem('bu1wp.mini')==='1'}catch(e){}document.body.classList.toggle('mini',t||pref)});

let db=null,users=null,downloads=null,unsubTasks=null;
