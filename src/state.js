// @ts-check
import { STATUS_UI } from './data.js';
import { EXTRA_DEFS, MED_YN, SEED, SEED_VOL, SURVEY, attendees, state, volunteers } from './data.js';
import { hashStr } from './cloud.js';
import { cloudQueuePush } from './account.js';
import { toast } from './shell.js';
/* State and persistence: the app state, the cloud state and the saved offline copy. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= PERSISTENCE ================= */
const LS_KEY='newstart.passport.v2';
/* Cloud state lives up here because persistence reads it. The sync code itself is further down. */
export const cloud={client:null,user:null,mode:false,status:'off',err:'',busy:false,again:false,starting:false,blocked:false,
  synced:{att:{},vol:{}},rejected:{},channel:null,pushT:null,retryT:null,renderT:null,formErr:'',
  since:{att:'',vol:''},lastFull:0,ready:false,demo:false,gateKey:'',
  view:'login',viewEmail:'',pending:false,recovery:false,resendAt:0,signingOut:false,
  acct:null,acctV:0,churchId:'',acctTab:'me',health:undefined,dir:null,regChurch:false,members:null,plat:null,audit:null,adminChurch:'',gateForce:false,delOpen:false,
  pledge:undefined,pledgeErr:false,pledgeBusy:false,   /* the member's own pledge (src/account.js pledgeHTML) */
  myTeam:undefined,myTeamBusy:false};                   /* a team leader's people (src/account.js myTeamHTML) */
/* Every screen change calls this, but the data rarely changes: compare a fingerprint first and only write (and only
   look for rows to upload) when something really changed. Writing ~1 MB to storage on every tap is what drained phones. */
let _savedSig='',_fullWarned=false;
export function persistNow(){
 let s;
 try{s=JSON.stringify({attendees,activeId:state.activeId,sim:state.sim,
  volunteers,volId:state.volId,volTab:state.volTab,_volSeq:state._volSeq,cloud:cloud.mode});}catch(e){return;}
 const h=hashStr(s);
 if(h===_savedSig)return;
 try{localStorage.setItem(LS_KEY,s);_savedSig=h;}catch(e){storageFull();}
 if(cloud.user)cloudQueuePush();
}
/* the browser refused to save: say so once instead of failing silently */
export function storageFull(){
 if(_fullWarned)return;_fullWarned=true;
 setTimeout(()=>toast(cloud.user?'This phone\'s app storage is full — keep it online so changes upload straight away.'
  :'This phone\'s app storage is full — recent changes may not be kept after closing the app.'),0);
}
let _pt;export function persist(){clearTimeout(_pt);_pt=setTimeout(persistNow,250);}
addEventListener('pagehide',persistNow);document.addEventListener('visibilitychange',()=>{if(document.hidden)persistNow()});
/* Rows arrive from the shared database, where a staff account can write anything into a JSON column. Readings are numbers
   or nothing, so a reading can never carry markup into the many places that print it. */
const numOrNull=v=>{if(v===null||v===undefined||v===''||typeof v==='boolean')return null;const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:null;};
/* lazy: it reads data.js constants, and import cycles can evaluate this module before data has run */
let _rk;const readKeys=()=>_rk||(_rk=['sys','dia','sugar','chol','weight','veg','walk','water','sleep',
 ...EXTRA_DEFS.flatMap(x=>[x.k,...(x.more||[]).map(m=>m[0])]),...SURVEY.map(x=>x.k),...MED_YN.map(x=>x[0])]);
/** Migrates an old or untrusted attendee object into the current shape. @param {Record<string,any>} a @returns {import('./types.js').Attendee} */
export function migrateAttendee(a){
 const s=Object.assign({sys:null,dia:null,sugar:null,chol:null,weight:null,veg:null,walk:null,water:null,sleep:null},a.s||{});
 /* the chronic illnesses written on the form are text, so they live beside the readings (the database takes only numbers in s) */
 const cl=a.chronicList!=null?a.chronicList:s.chronicList;
 a=Object.assign({},a,{chronicList:String(cl==null?'':cl).slice(0,200)});
 for(const k of Object.keys(s)){if(readKeys().includes(k))s[k]=numOrNull(s[k]);else delete s[k];}
 if(a.age!==undefined)a=Object.assign({},a,{age:numOrNull(a.age)==null?0:numOrNull(a.age)});
 if(a.heightCm!==undefined&&a.heightCm!==null)a=Object.assign({},a,{heightCm:numOrNull(a.heightCm)});
 if(a.interests&&typeof a.interests==='object'){
  const it=a.interests,keep=/** @type {Record<string,any>} */ (Object.fromEntries(Object.keys(it).filter(k=>/^[a-z]{1,12}$/.test(k)).map(k=>[k,!!it[k]])));
  /* the three text entries: the chosen church plan, and the follow-up person's id and name. Ids stay plain, names short. */
  for(const k of ['churchPlan','followUp'])if(typeof it[k]==='string'&&/^[A-Za-z0-9-]{1,64}$/.test(it[k]))keep[k]=it[k];
  if(keep.followUp&&typeof it.followUpName==='string')keep.followUpName=it.followUpName.slice(0,80);
  /* the POPIA consent record: the date it was given, and the guardian who gave it for a child */
  for(const k of ['consentOn','consentV'])if(typeof it[k]==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(it[k]))keep[k]=it[k];
  if(keep.guardian&&typeof it.guardianName==='string')keep.guardianName=it.guardianName.slice(0,80);
  a=Object.assign({},a,{interests:keep});
 }
 /* ids are interpolated into data-* attributes, so keep them to letters, digits and dashes */
 const id=String(a.id==null?'':a.id).replace(/[^A-Za-z0-9-]/g,'');
 const o=/** @type {import('./types.js').Attendee} */ (Object.assign({heightCm:165,interests:{},email:'',prayer:'',done:false},a,{id,s,email:String(a.email==null?'':a.email).trim().slice(0,200)}));
 /* the visit's date, sent to the database so an old record keeps its real date (see attToRow) */
 if(a.created_at!=null&&!isNaN(Date.parse(String(a.created_at))))o.created_at=new Date(String(a.created_at)).toISOString();
 else delete o.created_at;
 return o;
}
/** Migrates an old or untrusted volunteer object into the current shape. @param {Record<string,any>} v @returns {import('./types.js').Volunteer} */
export function migrateVolunteer(v){
 const o=Object.assign({phone:'',email:'',status:'prospect',pledgeExpos:1,skills:[],pref:[],pref2:'',
  booth:null,availability:[],shirt:'',emergency:'',since:'',notes:'',pledgedOn:null,registeredOn:null,
  checkedIn:false,role:'',history:[],shift:'',lead:false},v||{});
 o.history=(Array.isArray(o.history)?o.history:[]).map(h=>{
  h=Object.assign({expo:'',name:'Health Expo',date:'',booth:'',hours:0},h&&typeof h==='object'?h:{});
  /* database JSON: keep each part to the plain kind of text or number it is meant to be */
  return {expo:String(h.expo==null?'':h.expo).slice(0,80),name:String(h.name==null?'':h.name).slice(0,120),
   date:String(h.date==null?'':h.date).slice(0,10),booth:String(h.booth==null?'':h.booth).slice(0,40),hours:numOrNull(h.hours)||0};
 });
 if(!STATUS_UI[o.status])o.status='prospect';
 if(o.status==='checkedin')o.checkedIn=true;
 return /** @type {import('./types.js').Volunteer} */ (/** @type {unknown} */ (o));
}
export function loadPersisted(){
 try{
  const raw=localStorage.getItem(LS_KEY); if(!raw)return false;
  _savedSig=hashStr(raw);
  const d=JSON.parse(raw);
  /* a copy saved while connected to the shared database may legitimately be empty */
  cloud.mode=!!d.cloud;
  if(!Array.isArray(d.attendees)||(!d.attendees.length&&!cloud.mode))return false;
  attendees.length=0; d.attendees.forEach(a=>attendees.push(migrateAttendee(a)));
  state.sim=Object.assign({kitchen:3,walk:30,hydro:2},d.sim||{});
  state.activeId=attendees.some(a=>a.id===d.activeId)?d.activeId:(attendees[0]||{}).id||'';
  /* volunteers are optional — older payloads simply keep the seed roster */
  if(Array.isArray(d.volunteers)&&(d.volunteers.length||cloud.mode)){
   volunteers.length=0; d.volunteers.forEach(v=>volunteers.push(migrateVolunteer(v)));
   state._volSeq=d._volSeq||(1000+volunteers.length+1);
  }
  if(state.volTab==null||!['pledge','muster','booth','record'].includes(d.volTab))state.volTab='pledge';else state.volTab=d.volTab;
  if(volunteers.some(v=>v.id===d.volId))state.volId=d.volId;
  return true;
 }catch(e){return false;}
}
export function seedDemo(){
 attendees.length=0; JSON.parse(JSON.stringify(SEED)).forEach(a=>attendees.push(a));
 volunteers.length=0; JSON.parse(JSON.stringify(SEED_VOL)).forEach(v=>volunteers.push(v));
 state.activeId='EXPO-042'; state.sim={kitchen:3,walk:30,hydro:2};
 state.volId='VOL-1001'; state.volTab='pledge'; state._volSeq=1008;
 state.volRegOpen=false; state.logOpen=false; state.switchMode='visitor'; state.volNew=false;
 state.vf={name:'',phone:'',email:'',pledgeExpos:1,skills:[],pref:[],avail:[]};
 persist();
}
