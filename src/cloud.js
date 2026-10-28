// @ts-check
import { APP_SITE, IS_APP } from './platform.js';
import { $ } from './helpers.js';
import { cloud, migrateAttendee, migrateVolunteer, storageFull } from './state.js';
import { SEED, SEED_VOL, attendees, state, volunteers } from './data.js';
import { ACCT_GATES, acctButtons, acctGate, acctGateHTML, churchSearch, cloudInit, cloudRefresh, profileChanged } from './account.js';
import { render, toast } from './shell.js';
import { esc } from './helpers.js';
import { pendingInvite } from './churchPlans.js';
import { hideModal, showModal } from './volunteer.js';
import { qSafe, qs } from './queue.js';
/* Cloud sync with Supabase: sign-in gate, pull/push, live updates, libraries and installs. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* =====================================================================
   CLOUD SYNC  —  Supabase (shared database between desks)
   ---------------------------------------------------------------------
   The app stays offline-first: every change is written to this device
   immediately, and uploaded when a signed-in staff member is online.
   Tables and row-level security: supabase/schema.sql. The publishable
   key below is public by design — the database refuses every request that
   is not from a signed-in user on the public.staff list.
     synced[kind][id] = signature of the row as last known to match the server.
     A row is "pending" when its signature differs (or it was never uploaded).
   ===================================================================== */
export const SB_URL='https://wlsrgihkijlvjyfxvhfl.supabase.co';
export const SB_KEY='sb_publishable_mA_jEgF_t1sRrnfAgM-1eg_wNdvgQYG';
export const SB_LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
/* Subresource Integrity (sha384) of the pinned sign-in library. Changing a library version means recomputing its hash:
   curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A   and prefixing it with sha384- */
export const SRI={
 [SB_LIB]:'sha384-GFr3yTh5lJznCbZfpTtXnwboFsxqtTQoeTZCRHhE0579KrRmlCzen5AA8ohaB5ug',
};
/* Inside the Android app the library is bundled (tools/build-app.js copies them and refuses any whose bytes do not
   match the hash above), so the app needs no internet to start. The integrity check still applies to the copy. */
const APP_LIB={[SB_LIB]:'vendor/supabase.min.js'};
export function appCopyOf(src){return IS_APP&&APP_LIB[src]||src;}
export const SYNC_KEY='newstart.cloud.v1';

const nulIfEmpty=v=>v?v:null;
/** Converts an Attendee record into its database row. @param {import('./types.js').Attendee} a */
export const attToRow=a=>({id:a.id,name:a.name,age:a.age!==''&&Number.isFinite(+a.age)?Math.round(+a.age):null,sex:a.sex||null,
 phone:a.phone||null,email:a.email||null,height_cm:a.heightCm!=null&&a.heightCm!==''&&Number.isFinite(+a.heightCm)?+a.heightCm:null,s:a.s||{},interests:a.interests||{},
 prayer:a.prayer||'',done:!!a.done,
 /* sent only when written, so a database not yet given the chronic_list column still takes every other visitor */
 ...(a.chronicList?{chronic_list:a.chronicList}:{}),
 /* the visit's date: kept so a record uploaded late still counts as its real visit and not as a new one (the 7-day
    retention in schema.sql and the phone's own rule both read it). Omitted on a brand-new visitor, where now() is right. */
 ...(a.created_at?{created_at:a.created_at}:{})});
/** Converts a database row back into an Attendee. @param {{id:string,name:string,age:number,sex:string,phone:string,email:string,height_cm:number,s:Record<string,number|null>,interests:Record<string,any>,prayer:string,done:boolean,chronic_list?:string,created_at?:string}} r */
export const rowToAtt=r=>migrateAttendee({id:r.id,name:r.name,age:r.age==null?0:r.age,sex:r.sex||'',phone:r.phone||'',email:r.email||'',
 heightCm:r.height_cm==null?null:Number(r.height_cm),s:r.s||{},interests:r.interests||{},prayer:r.prayer||'',done:!!r.done,chronicList:r.chronic_list||'',
 created_at:r.created_at});
/** Converts a Volunteer record into its database row. @param {import('./types.js').Volunteer} v */
export const volToRow=v=>({id:v.id,name:v.name,phone:v.phone||'',email:v.email||'',status:v.status||'prospect',
 pledge_expos:Number(v.pledgeExpos)||1,skills:v.skills||[],pref:v.pref||[],pref2:v.pref2||'',booth:nulIfEmpty(v.booth),
 availability:v.availability||[],shirt:v.shirt||'',emergency:v.emergency||'',since:v.since||'',notes:v.notes||'',
 pledged_on:nulIfEmpty(v.pledgedOn),registered_on:nulIfEmpty(v.registeredOn),checked_in:!!v.checkedIn||v.status==='checkedin',
 role:v.role||'',shift:v.shift||'',lead:!!v.lead,history:v.history||[]});
/** Converts a database row back into a Volunteer. @param {Record<string,any>} r */
export const rowToVol=r=>migrateVolunteer({id:r.id,name:r.name,phone:r.phone||'',email:r.email||'',status:r.status,
 pledgeExpos:r.pledge_expos||1,skills:r.skills||[],pref:r.pref||[],pref2:r.pref2||'',booth:r.booth||null,
 availability:r.availability||[],shirt:r.shirt||'',emergency:r.emergency||'',since:r.since||'',notes:r.notes||'',
 pledgedOn:r.pledged_on||null,registeredOn:r.registered_on||null,checkedIn:!!r.checked_in,role:r.role||'',
 shift:r.shift||'',lead:!!r.lead,history:r.history||[]});
/* filled in by initKinds() from the boot sequence: import cycles can run this module before data.js
   has initialized its arrays, so the row kinds must not be built at module-eval time */
export let KINDS={att:{},vol:{}};
export function initKinds(){
 KINDS={
  att:{table:'attendees',list:attendees,toRow:attToRow,fromRow:rowToAtt,migrate:migrateAttendee,seed:SEED},
  vol:{table:'volunteers',list:volunteers,toRow:volToRow,fromRow:rowToVol,migrate:migrateVolunteer,seed:SEED_VOL},
 };
}
/* key order must not matter when comparing rows */
/* JSON with every object's keys sorted — exactly the text the old JSON.stringify(replacer) version produced (old
   saved ledgers depend on that), a little faster. (Integer-like keys come first in numeric order, as they did when the
   replacer rebuilt each object.) */
const isIdxKey=k=>/^(0|[1-9]\d{0,9})$/.test(k)&&+k<4294967295;
function stableJSON(v){
 const t=typeof v;
 if(t==='number')return isFinite(v)?String(v):'null';
 if(t==='boolean')return v?'true':'false';
 if(v===null||t!=='object')return JSON.stringify(v);
 if(typeof v.toJSON==='function')return stableJSON(v.toJSON());
 if(Array.isArray(v)){let s='[';for(let i=0;i<v.length;i++){const x=stableJSON(v[i]);s+=(i?',':'')+(x===undefined?'null':x);}return s+']';}
 const ks=Object.keys(v).sort(),idx=ks.filter(isIdxKey);
 const order=idx.length?idx.sort((a,b)=>Number(a)-Number(b)).concat(ks.filter(k=>!isIdxKey(k))):ks;
 let s='{',first=true;
 for(const k of order){const x=stableJSON(v[k]);if(x===undefined)continue;s+=(first?'':',')+JSON.stringify(k)+':'+x;first=false;}
 return s+'}';
}
/* 53-bit fingerprint of a string (cyrb53). The sync ledger keeps one of these per row (~11 characters) instead of the
   whole row as text, which used to make the ledger bigger than the data itself. */
export function hashStr(str){
 let h1=0xdeadbeef,h2=0x41c6ce57;
 for(let i=0;i<str.length;i++){const c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
 h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
 h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
 return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}
export const sigOf=o=>hashStr(stableJSON(o));
/* an untouched demo row: it must never be uploaded to the real database */
export function isSeedRow(kind,o){
 const k=KINDS[kind],s=k.seed.find(x=>x.id===o.id);
 return !!s&&sigOf(k.toRow(k.migrate(JSON.parse(JSON.stringify(s)))))===sigOf(k.toRow(o));
}
/* a row is "pending" when it differs from what the server last confirmed (or was never uploaded) */
export function isDirty(kind,o){
 const k=KINDS[kind],sy=cloud.synced[kind],s=sigOf(k.toRow(o));
 if(cloud.rejected[o.id]===s)return false;
 return sy[o.id]===undefined?!isSeedRow(kind,o):s!==sy[o.id];
}
export function cloudDirtyList(kind){return KINDS[kind].list.filter(o=>isDirty(kind,o));}
export const cloudPending=()=>cloudDirtyList('att').length+cloudDirtyList('vol').length;
export function loadSynced(){try{
 const d=JSON.parse(localStorage.getItem(SYNC_KEY)||'null');if(!d||!d.att||!d.vol)return;
 /* ledgers saved by older versions hold each row's full text: fingerprint it (same result as sigOf of that row), so
    nothing looks edited and nothing is uploaded again — and the saved ledger shrinks to a fraction */
 let old=0;
 for(const k of ['att','vol'])for(const id in d[k]){const v=d[k][id];if(typeof v==='string'&&v.charCodeAt(0)===123){d[k][id]=hashStr(v);old++;}}
 cloud.synced={att:d.att,vol:d.vol};
 if(old)saveSynced();
}catch(e){}}
export let _ledgerSig='';
export function resetLedgerSig(){_ledgerSig='';}   /* the saved copy changed underneath: forget the last written fingerprint */
export function saveSynced(){clearTimeout(cloud.saveT);try{
 const s=JSON.stringify(cloud.synced),h=hashStr(s);
 if(h===_ledgerSig)return;                                   /* unchanged: skip the write */
 localStorage.setItem(SYNC_KEY,s);_ledgerSig=h;
}catch(e){storageFull();}}
/* a burst of live changes would otherwise rewrite the whole ledger once per row */
export function saveSyncedSoon(){clearTimeout(cloud.saveT);cloud.saveT=setTimeout(saveSynced,500);}

/* ---------- status ---------- */
export const CLOUD_UI={
 off:['#9db0b4','Starting…'],
 unavailable:['#9db0b4','Cloud sync could not load (no internet?). This device keeps working on its own.'],
 loading:['#e0a63a','Connecting…'],
 signedout:['#9db0b4','Not signed in'],
 syncing:['#e0a63a','Syncing…'],
 online:['#2f9e6f','Up to date'],
 offline:['#e0a63a','Offline — changes are kept on this device and upload when you reconnect.'],
 error:['#d6584a','Sync problem'],
};
export function setCloud(status,err){
 cloud.status=status;cloud.err=err||'';
 const ui=CLOUD_UI[status]||CLOUD_UI.off;
 for(const id of ['cloudDot','homeCloudDot']){const dot=$('#'+id);if(dot)dot.style.background=ui[0];}
 const m=$('#cloudModal');if(m&&!m.classList.contains('hidden'))renderCloudBody();
 renderGate();profileChanged();
}
/* ---------- installing as a phone app ---------- */
/* Android/desktop Chrome offer an install prompt through an event; iPhones have no event, so we explain the
   Share → Add to Home Screen steps instead. Nothing is shown inside the installed app itself. */
export let installEvt=null;
export function setInstallEvt(v){installEvt=v;}   /* the smoke test drives the install flow through this */
const isStandalone=()=>(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||(/** @type {any} */ (navigator)).standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;installChanged();});
addEventListener('appinstalled',()=>{installEvt=null;installChanged();toast('App installed ✓');});
function installChanged(){
 const m=$('#cloudModal');if(m&&!m.classList.contains('hidden'))renderCloudBody();
 if(state.tab==='home')cloudRefresh();
}
export async function installApp(){
 if(!installEvt)return;
 const ev=installEvt;installEvt=null;
 try{ev.prompt();await ev.userChoice;}catch(e){}
 installChanged();
}
export function installBlock(){
 if(IS_APP)return '';
 if(isStandalone())return `<p class="mt-4 text-center text-[11px] font-bold text-brand-700">Installed on this phone ✓</p>`;
 if(installEvt)return `<button data-action="installApp" class="btn btn-soft mt-4 w-full py-2.5 text-xs">Install the app on this phone</button>`;
 if(isIOS())return `<p class="mt-4 rounded-[14px] bg-white/60 px-3 py-2 text-[11px] leading-relaxed text-[#5b7178]"><b>Install on iPhone:</b> open this page in Safari, tap the Share button, then <b>Add to Home Screen</b>.</p>`;
 return '';
}
if(!IS_APP&&'serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))
 addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

/* ---------- sign-in gate ---------- */
/* Until someone has signed in on this device, a full-screen login covers the app. Devices that were signed in
   before (they hold a saved copy) open straight into the app, so a flat battery or a dropped connection at the
   expo never locks the desk out of its own data.
   Views while signed out:  login · signup · verify (check your email) · forgot · forgotSent
   Signed in but not approved yet: pending.  After a reset-password link: newpass. */
/* the sign-in screens a signed-out person can leave again ("Back to the app") when the Profile page opened them */
const GATE_BACKABLE=['form','signup','verify','forgot','forgotSent'];
export function gateState(){
 if(window.NEWSTART_NO_CLOUD)return 'hidden';
 if(cloud.recovery&&cloud.user)return 'newpass';
 if((cloud.ready||cloud.demo)&&!cloud.gateForce)return 'hidden';
 if(cloud.user){
  if(cloud.pending)return acctGate()||'pending';
  return cloud.status==='error'?'error':'loading';
 }
 if(cloud.status==='unavailable')return 'unavailable';
 if(cloud.client&&cloud.status==='signedout')return cloud.view==='login'?'form':cloud.view;
 return 'connecting';
}
/* Passwords: long enough to resist guessing, short enough for bcrypt (it ignores everything past 72 bytes). */
export function passwordProblem(pw){
 if(pw.length<8)return 'Use at least 8 characters.';
 if(pw.length>72)return 'Use at most 72 characters.';
 if(!/[A-Za-z]/.test(pw)||!/\d/.test(pw))return 'Use at least one letter and one number.';
 return '';
}
export const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
/* a new password: the rules, then what the server says when it is saved. Each gives the message to show, or '' when all is well. */
export const passwordCheck=(pw,pw2)=>passwordProblem(pw)||(pw!==pw2?'The two passwords do not match.':'');
export async function savePassword(pw){
 let res;
 try{res=await cloud.client.auth.updateUser({password:pw});}catch(err){res={error:err};}
 if(!res.error)return '';
 const m=String(res.error.message||'');
 return res.error.code==='same_password'||/different from the old/i.test(m)?'Choose a password you have not used before.':isNet(m)?'No connection — try again when you are online.':(m||'Could not save the new password.');
}
/* a password box with one Show / Hide button for every box in its form (the sign-in screens and the Profile page both use it) */
export const pwField=(id,label,auto,ph)=>`<label class="block"><span class="microlabel">${label}</span>
   <span class="relative mt-1 block"><input id="${id}" type="password" autocomplete="${auto}" required placeholder="${ph||'Password'}" class="field" style="padding-right:4.5rem">
   <button type="button" data-action="toggle-pass" class="text-[11px] font-extrabold text-brand-700" style="position:absolute;right:.9rem;top:50%;transform:translateY(-50%)">Show</button></span></label>`;
/* where the e-mailed links (confirm / reset) send people back to: this page, if it has a web address */
export const authRedirect=()=>IS_APP?APP_SITE:/^https?:$/.test(location.protocol)?location.origin+location.pathname:undefined;
export function gateView(v){
 const e=$('#gateEmail');if(e&&e.value)cloud.viewEmail=e.value.trim();
 cloud.view=v;cloud.formErr='';cloud.gateKey='';renderGate();
}
function gateFail(m){cloud.formErr=m;cloud.gateKey='';renderCloudBody();renderGate();}
export function gateBusy(pre,label){const b=$('#'+pre+'Go');if(b){b.disabled=true;const l=b.querySelector('.hx-cta-main');if(l)l.textContent=label;else b.textContent=label;}}
export const isNet=m=>/fetch|network|load failed/i.test(String(m||''))||!navigator.onLine;

export function renderGate(){
 const el=$('#authGate'),body=$('#authGateBody');
 if(!el||!body)return;
 const st=gateState();
 el.classList.toggle('hidden',st==='hidden');el.classList.toggle('flex',st!=='hidden');
 /* the gate is a full-screen modal: nothing behind it may take focus or a tap */
 const app=document.getElementById('app');if(app){if(st==='hidden')app.removeAttribute('inert');else app.setAttribute('inert','');}
 const sandbox=$('#gateSandbox');if(sandbox)sandbox.style.display=cloud.mode?'none':'';
 if(st==='hidden'){cloud.gateKey='';return;}
 const key=[st,cloud.formErr,cloud.err,cloud.status,cloud.viewEmail,cloud.acctV].join('|');
 if(key===cloud.gateKey)return;
 cloud.gateKey=key;
 const keepEmail=($('#gateEmail')||{}).value||cloud.viewEmail||'',keepName=($('#gateName')||{}).value||'';
 const title=t=>`<div class="display hx-gate-title text-[17px] font-extrabold">${t}</div>`;
 const note=(t,cls)=>`<p class="mt-1.5 text-[11px] leading-relaxed ${cls||'text-[#5c747a]'}">${t}</p>`;
 const link=(fn,t)=>`<button type="button" data-action="${fn}" class="text-[11px] font-extrabold text-brand-700">${t}</button>`;
 const err=`<p id="gateErr" role="alert" class="text-[11px] font-bold text-rose-600">${esc(cloud.formErr)}</p>`;
 const emailField=`<label class="block"><span class="microlabel">Email</span>
   <input id="gateEmail" type="email" inputmode="email" autocomplete="username" required placeholder="you@example.org" class="field mt-1" value="${esc(keepEmail)}"></label>`;
 const fileWarn=/^https?:$/.test(location.protocol)?'':note('Heads-up: this page was opened from a file, so the links in the emails cannot bring you back here. Open the app from its web address instead.','text-amber-800');
 let html='';
 if(st==='form'){
  html=`${title('Staff Sign-In')}${note('Enter your staff email and password.')}
   ${pendingInvite()?note('<b>You have a church invite link.</b> Sign in, or create an account, and you join the church straight away: no searching and no waiting.','text-brand-900'):''}
   <form data-action="cloudSignIn" data-pre="gate" class="mt-4 space-y-3">
    ${emailField}${pwField('gatePass','Password','current-password')}
    ${err}
    <button id="gateGo" type="submit" class="hx-cta hx-gate-submit">
     <span class="hx-cta-main">Sign In to Expo</span><span class="hx-cta-circle" aria-hidden="true">→</span>
    </button>
   </form>
   <div class="mt-3 flex items-center justify-between">${link("gateView('forgot')",'Forgot password?')}${link("gateView('signup')",'Create an account')}</div>`;
   /* the demo entry lives in the sandbox tiles under the card, not duplicated here */
 }else if(st==='signup'){
  html=`${title('Create your account')}${note('Use your own email. We will send a link to confirm it. After that, an administrator approves your account before you can see any visitor data.')}
   <form data-action="cloudSignUp" data-pre="gate" class="mt-4 space-y-3">
    <label class="block"><span class="microlabel">Your name</span>
     <input id="gateName" autocomplete="name" required placeholder="e.g. Thandi Mabaso" class="field mt-1" value="${esc(keepName)}"></label>
    ${emailField}
    ${pwField('gatePass','Create a password','new-password','At least 8 characters')}
    ${pwField('gatePass2','Repeat the password','new-password','Type it again')}
    <p class="text-[10px] leading-relaxed text-[#8a9aa0]">At least 8 characters, with a letter and a number.</p>
    ${err}
    <button id="gateGo" class="btn btn-primary w-full py-3 text-sm">Create account</button>
   </form>
   ${fileWarn}
   <div class="mt-3 text-center">${link("gateView('login')",'I already have an account — sign in')}</div>`;
 }else if(st==='verify'){
  html=`${title('Check your email')}
   ${note('We sent a confirmation link to <b class="text-[#33504f]">'+esc(cloud.viewEmail||'your email')+'</b>. Open it, then come back here and sign in. It can take a minute — check spam too.')}
   ${fileWarn}
   <p id="gateErr" role="alert" class="mt-2 text-[11px] font-bold text-rose-600">${esc(cloud.formErr)}</p>
   <div class="mt-3 flex gap-2"><button data-action="gateView" data-args="login" class="btn btn-glass flex-1 py-2.5 text-xs text-[#5b7178]">Back to sign-in</button>
   <button data-action="cloudResend" class="btn btn-primary flex-1 py-2.5 text-xs">Resend email</button></div>`;
 }else if(st==='forgot'){
  html=`${title('Reset your password')}${note('Enter your email and we will send you a link to choose a new password.')}
   <form data-action="cloudForgot" data-pre="gate" class="mt-4 space-y-3">
    ${emailField}${err}
    <button id="gateGo" class="btn btn-primary w-full py-3 text-sm">Send reset link</button>
   </form>
   ${fileWarn}
   <div class="mt-3 text-center">${link("gateView('login')",'Back to sign-in')}</div>`;
 }else if(st==='forgotSent'){
  html=`${title('Check your email')}
   ${note('If <b class="text-[#33504f]">'+esc(cloud.viewEmail||'that address')+'</b> has an account, a reset link is on its way. Open it to choose a new password.')}
   <button data-action="gateView" data-args="login" class="btn btn-primary mt-4 w-full py-2.5 text-xs">Back to sign-in</button>`;
 }else if(st==='newpass'){
  html=`${title('Choose a new password')}${note('You are signed in through your reset link. Pick a new password to finish.')}
   <form data-action="cloudNewPassword" data-pre="gate" class="mt-4 space-y-3">
    ${pwField('gatePass','New password','new-password','At least 8 characters')}
    ${pwField('gatePass2','Repeat it','new-password','Type it again')}
    <p class="text-[10px] leading-relaxed text-[#8a9aa0]">At least 8 characters, with a letter and a number.</p>
    ${err}
    <button id="gateGo" class="btn btn-primary w-full py-3 text-sm">Save new password</button>
   </form>`;
 }else if(cloud.acct&&ACCT_GATES.includes(st)){
  html=`<div id="gateHealth">${acctHealthHTML()}</div>`+acctGateHTML(st);
 }else if(st==='pending'){
  html=`${title('Waiting for approval')}
   ${note('Your email <b class="text-[#33504f]">'+esc((cloud.user&&cloud.user.email)||'')+'</b> is confirmed. An administrator still has to approve this account before you can see visitor and volunteer data. Give them the email above, then press Check again.')}
   <div class="mt-4 flex gap-2"><button data-action="cloudSignOut" class="btn btn-glass flex-1 py-2.5 text-xs text-[#5b7178]">Sign out</button>
   <button data-action="sync-now" class="btn btn-primary flex-1 py-2.5 text-xs">Check again</button></div>`;
 }else if(st==='loading'){
  html=`${title('Loading your data…')}${note(esc((cloud.user&&cloud.user.email)||'')+(cloud.status==='offline'?' — no connection yet, still trying.':' — fetching visitors and volunteers.'))}`;
 }else if(st==='error'){
  html=`${title('Signed in, but not ready')}${note(esc(cloud.err||'Something went wrong while loading.'),'text-rose-600')}
   <div class="mt-4 flex gap-2"><button data-action="cloudSignOut" class="btn btn-glass flex-1 py-2.5 text-xs text-[#5b7178]">Sign out</button>
   <button data-action="sync-now" class="btn btn-primary flex-1 py-2.5 text-xs">Try again</button></div>`;
 }else if(st==='unavailable'){
  html=`${title('Can’t reach sign-in')}${note('The sign-in service did not load — usually no internet. Connect and try again.')}
   <button data-action="cloudInit" class="btn btn-primary mt-4 w-full py-2.5 text-xs">Try again</button>
   <button data-action="gateDemo" class="mt-3 w-full text-center text-[11px] font-bold text-[#8a9aa0]">Open the demo without signing in</button>`;
 }else{
  html=`${title('Connecting…')}${note('Checking for a saved sign-in.')}`;
 }
 if(cloud.gateForce&&GATE_BACKABLE.includes(st))html+=`<div class="mt-3 text-center">${link('gateBack','Back to the app')}</div>`;
 body.innerHTML=html;
 if(st==='church'&&!cloud.regChurch&&cloud.dir==null)churchSearch('');
 if(['form','signup','forgot'].includes(st))setTimeout(()=>{const e=$(st==='signup'?'#gateName':'#gateEmail');if(e&&e.focus)e.focus();},60);
 if(st==='newpass')setTimeout(()=>{const e=$('#gatePass');if(e&&e.focus)e.focus();},60);
}
export function togglePass(btn){
 /* one Show/Hide button reveals every password box in the form, so a typo in either is visible */
 const form=btn.closest&&btn.closest('form'),boxes=form?[...form.querySelectorAll('input[type=password],input[data-pw]')]:[btn.parentElement.querySelector('input')];
 const show=boxes.some(i=>i.type==='password');
 boxes.forEach(i=>{i.type=show?'text':'password';i.setAttribute('data-pw','1');});
 btn.textContent=show?'Hide':'Show';
}
export function gateDemo(){cloud.demo=true;renderGate();render();toast('Practice mode: demo visitors, nothing is shared');}

/* ---------- account actions ---------- */
export async function cloudSignUp(e){
 e.preventDefault();
 if(!cloud.client)return;
 const name=($('#gateName').value||'').trim().replace(/\s+/g,' '),em=($('#gateEmail').value||'').trim(),pw=$('#gatePass').value,pw2=$('#gatePass2').value;
 cloud.viewEmail=em;
 if(!name){gateFail('Enter your name so the administrator knows who you are.');return;}
 if(!validEmail(em)){gateFail('That email address does not look right.');return;}
 const bad=passwordProblem(pw);
 if(bad){gateFail(bad);return;}
 if(pw!==pw2){gateFail('The two passwords do not match.');return;}
 gateBusy('gate','Creating account…');
 let res;
 try{res=await cloud.client.auth.signUp({email:em,password:pw,options:{data:{full_name:name},emailRedirectTo:authRedirect()}});}catch(err){res={error:err};}
 if(res.error){
  const m=String(res.error.message||''),c=res.error.code||'';
  gateFail(c==='signup_disabled'||/signups? not allowed/i.test(m)?'Creating accounts is switched off for this project. Ask the administrator to add you.'
   :c==='weak_password'?m
   :c==='user_already_exists'||/already registered/i.test(m)?'That email already has an account — sign in, or reset your password.'
   :c==='over_email_send_rate_limit'||res.error.status===429||/rate limit/i.test(m)?'Too many emails were sent just now. Wait a few minutes and try again.'
   :isNet(m)?'No connection — try again when you are online.':(m||'Could not create the account.'));
  return;
 }
 const u=res.data&&res.data.user;
 /* with e-mail confirmation on, signing up an address that already exists returns a user with no identities */
 if(u&&Array.isArray(u.identities)&&u.identities.length===0){gateFail('That email already has an account — sign in, or reset your password.');return;}
 cloud.resendAt=Date.now()+60000;
 if(res.data&&res.data.session)return;                 /* confirmation is switched off: the sign-in event takes over */
 cloud.view='verify';cloud.formErr='';cloud.gateKey='';renderGate();
}
export async function cloudResend(){
 const em=cloud.viewEmail;
 if(!cloud.client||!em)return;
 if(Date.now()<(cloud.resendAt||0)){const s=Math.ceil((cloud.resendAt-Date.now())/1000);gateFail(`Please wait ${s} second${s===1?'':'s'} before asking again.`);return;}
 let res;
 try{res=await cloud.client.auth.resend({type:'signup',email:em,options:{emailRedirectTo:authRedirect()}});}catch(err){res={error:err};}
 if(res.error){gateFail(isNet(res.error.message)?'No connection — try again when you are online.':/rate limit/i.test(res.error.message||'')?'Too many emails were sent just now. Wait a few minutes.':(res.error.message||'Could not resend.'));return;}
 cloud.resendAt=Date.now()+60000;cloud.formErr='';cloud.gateKey='';renderGate();toast('Confirmation email sent again');
}
export async function cloudForgot(e){
 e.preventDefault();
 if(!cloud.client)return;
 const em=($('#gateEmail').value||'').trim();
 cloud.viewEmail=em;
 if(!validEmail(em)){gateFail('That email address does not look right.');return;}
 gateBusy('gate','Sending…');
 let res;
 try{res=await cloud.client.auth.resetPasswordForEmail(em,{redirectTo:authRedirect()});}catch(err){res={error:err};}
 if(res.error&&(isNet(res.error.message)||res.error.status===429||/rate limit/i.test(res.error.message||''))){
  gateFail(isNet(res.error.message)?'No connection — try again when you are online.':'Too many emails were sent just now. Wait a few minutes and try again.');return;
 }
 /* the answer is the same whether or not the address has an account, so this cannot be used to find out who does */
 cloud.view='forgotSent';cloud.formErr='';cloud.gateKey='';renderGate();
}
export async function cloudNewPassword(e){
 e.preventDefault();
 if(!cloud.client)return;
 const pw=$('#gatePass').value,pw2=$('#gatePass2').value;
 const bad=passwordProblem(pw);
 if(bad){gateFail(bad);return;}
 if(pw!==pw2){gateFail('The two passwords do not match.');return;}
 gateBusy('gate','Saving…');
 const msg=await savePassword(pw);
 if(msg){gateFail(msg);return;}
 cloud.recovery=false;cloud.formErr='';cloud.gateKey='';renderGate();toast('Password updated');
}
export function openCloud(){
 renderCloudBody();showModal('#cloudModal');
 if(!cloud.client&&!cloud.starting)cloudInit();
 setTimeout(()=>{const e=$('#cloudEmail');if(e&&e.focus)e.focus();},60);
}
export function closeCloud(){hideModal('#cloudModal');}
/* Admins approve new volunteers here, instead of running SQL in the database dashboard (supabase/schema.sql has
   the is_admin / staff_pending / staff_approve functions). Anyone else never sees this section. */
async function loadApprovals(){
 if(!cloud.client||!cloud.user||cloud.apprBusy)return;
 cloud.apprBusy=true;
 try{
  const r=await cloud.client.rpc('is_admin');
  cloud.isAdmin=!r.error&&r.data===true;          /* functions not installed yet → simply not an admin */
  if(cloud.isAdmin){const p=await cloud.client.rpc('staff_pending');cloud.pendingUsers=p.error?[]:p.data||[];cloud.apprErr=p.error?p.error.message:'';}
 }catch(e){cloud.isAdmin=false;}
 finally{cloud.apprBusy=false;const m=$('#cloudModal');if(m&&!m.classList.contains('hidden'))renderCloudBody();}
}
export async function approveStaff(uid,btn){
 if(btn){btn.disabled=true;btn.textContent='…';}
 const r=await cloud.client.rpc('staff_approve',{p_user:uid});
 if(r.error){toast(r.error.message);if(btn){btn.disabled=false;btn.textContent='Approve';}return;}
 toast('Approved ✓ They can sign in and use the app now');
 cloud.pendingUsers=(cloud.pendingUsers||[]).filter(u=>u.user_id!==uid);renderCloudBody();
}
function approvalsHTML(){
 const list=cloud.pendingUsers;
 return `<div class="mt-4 rounded-[18px] border border-[#123033]/[.07] bg-white/60 p-3.5">
  <div class="flex items-center justify-between"><div class="microlabel">Waiting for approval</div>
   <button class="tap-link" data-action="approvals-clear">Refresh</button></div>
  ${cloud.apprErr?`<p class="text-[11.5px] text-rose-700">${esc(cloud.apprErr)}</p>`:''}
  ${!list?'<p class="text-[11.5px] text-[#4f6870]">Loading…</p>':!list.length?'<p class="text-[11.5px] text-[#4f6870]">Nobody is waiting ✓</p>'
   :list.map(u=>`<div class="flex items-center gap-2 border-t border-[#123033]/[.07] py-2">
     <div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(u.full_name||'(no name given)')}</div>
      <div class="truncate text-[11px] text-[#4f6870]">${esc(u.email||'')}${u.confirmed?'':' · has not confirmed the email yet'}</div></div>
     ${u.confirmed?`<button class="btn btn-primary flex-none px-4 text-xs" data-action="staff-approve" data-args="${qSafe(u.user_id)}">Approve</button>`:''}</div>`).join('')}
  <p class="mt-2 text-[11px] leading-snug text-[#4f6870]">Only approve people you know: approved accounts can see visitors’ health information.</p>
 </div>`;
}
export function renderCloudBody(){
 const body=$('#cloudBody');if(!body)return;
 const keep=($('#cloudEmail')||{}).value||'';
 const ui=CLOUD_UI[cloud.status]||CLOUD_UI.off;
 if(cloud.user){
  const tile=(l,v)=>`<div class="tile"><span class="tile-l">${l}</span><span class="tile-v">${v}</span></div>`;
  body.innerHTML=`<div class="display text-base font-extrabold">Shared database</div>
   <div class="mt-3 flex items-center gap-2 text-[12px] font-bold text-[#33504f]"><span style="width:9px;height:9px;border-radius:9999px;background:${ui[0]}"></span>${esc(ui[1])}</div>
   ${cloud.err?`<p class="mt-1.5 text-[11px] leading-relaxed text-rose-600">${esc(cloud.err)}</p>`:''}
   <div class="mono mt-2 text-[10px] text-[#6b8187]">${esc(cloud.user.email||'')}</div>
   <div class="mt-3 grid grid-cols-3 gap-2">${tile('Visitors',attendees.length)}${tile('Volunteers',volunteers.length)}${tile('To upload',cloudPending())}</div>
   <div class="mt-4 flex gap-2">
    <button data-action="cloudSignOut" class="btn btn-glass flex-1 py-2.5 text-xs text-[#5b7178]">Sign out</button>
    <button data-action="sync-now" class="btn btn-primary flex-1 py-2.5 text-xs">Sync now</button>
   </div>${statusPanelHTML()}${acctButtons()}${cloud.isAdmin&&!cloud.acct?approvalsHTML():''}${installBlock()}`;
  if(cloud.isAdmin===undefined&&!cloud.acct)loadApprovals();
  return;
 }
 body.innerHTML=`<div class="display text-base font-extrabold">Staff sign-in</div>
  <p class="mt-1 text-[11px] leading-relaxed text-[#5c747a]">Sign in to share visitors and volunteers between desks. Until you do, this device only shows demo data.</p>
  ${cloud.client?`<form data-action="cloudSignIn" class="mt-3 space-y-3">
    <input id="cloudEmail" type="email" inputmode="email" autocomplete="username" required placeholder="Staff email" class="field" value="${esc(keep)}">
    <input id="cloudPass" type="password" autocomplete="current-password" required placeholder="Password" class="field">
    <p id="cloudErr" role="alert" class="text-[11px] font-bold text-rose-600">${esc(cloud.formErr)}</p>
    <button id="cloudGo" class="btn btn-primary w-full py-3 text-sm">Sign in</button></form>`
   :`<p class="mt-3 text-[11px] font-bold text-amber-800">${esc(ui[1])}</p>`}${installBlock()}`;
}

/* ---------- cloud status: one record per cloud function ----------
   Each row says what just happened to that function: a request that worked or failed, a live connection's own report,
   or Test now. Nothing is guessed; a row nobody has checked says so. The panel behind the logo lists every row, Home
   shows the worst of download / upload / live updates, and the queue and account screens point here when they fail. */
const HEALTH_ROWS=[['auth','Sign-in'],['sync','Download'],['upload','Upload'],['live','Live updates'],['queue','Live queue'],
 ['account','Accounts & admin'],['schema','Database setup']];
const H_TONE={ok:'live',warn:'warn',bad:'bad',off:'info'};
const H_RANK={bad:3,warn:2,off:1,ok:0};
export const health={};
const hhmm=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
export const isOfflineErr=m=>!navigator.onLine||/failed to fetch|networkerror|load failed|network request/i.test(String(m||''));
export const isMissingErr=e=>!!e&&(e.code==='PGRST205'||e.code==='PGRST202'||e.code==='42P01'||e.code==='42883'||/schema cache|could not find the (table|function)|does not exist/i.test(String(e.message||'')));
/* "Could not find the table 'public.queue_entries' …" / "… function public.my_account …" / relation "x" -> the name */
export const missingName=e=>{const m=/(?:public\.|relation\s+")([a-z_]+)/i.exec(String((e&&e.message)||''));return m?m[1]:'';};
let _healthT=null;
export function noteHealth(key,st,msg,detail){
 health[key]={st,msg,detail:detail||'',at:Date.now()};
 clearTimeout(_healthT);_healthT=setTimeout(healthRefresh,60);
}
export function healthReset(){for(const k in health)delete health[k];cloud.testedAt=0;}
/* a failed request, in plain words; a missing table or function also marks Database setup */
export function healthFromError(key,err,what){
 const msg=String((err&&err.message)||err||''),name=what||missingName(err);
 if(isOfflineErr(msg))return noteHealth(key,'warn','No connection. It retries by itself; changes stay on this phone.',msg);
 if(isMissingErr(err)){
  noteHealth('schema','bad',`Missing in the database: ${name||'a table or function'}. Run supabase/schema.sql again in the Supabase SQL editor.`,msg);
  return noteHealth(key,'bad','Not set up in the database yet (see Database setup).',msg);
 }
 if(err&&(err.code==='42501'||/row-level security|permission denied/i.test(msg)))return noteHealth(key,'bad','Refused: this account has no access to it.',msg);
 noteHealth(key,'bad',msg||'Failed for an unknown reason.',[err&&err.code,what].filter(Boolean).join(' · '));
}
/* what is waiting to upload, counted from this phone's own copy */
export function healthUpload(){
 const n=cloudPending(),bad=Object.keys(cloud.rejected).length;
 if(bad)return noteHealth('upload','warn',`${bad} change${bad>1?'s were':' was'} refused by the database and will not upload. The reason was shown when it happened.`);
 noteHealth('upload',n?'warn':'ok',n?`${n} change${n>1?'s':''} waiting to upload.`:'Every change on this phone is uploaded.');
}
/* the live connections report their own state: SUBSCRIBED, or CHANNEL_ERROR / TIMED_OUT / CLOSED while reconnecting */
export function healthLive(key,st){
 if(st==='SUBSCRIBED')return noteHealth(key,'ok',key==='queue'?'Live: every desk sees the same line.':'Connected: changes from other desks arrive straight away.',st);
 if(!st)return noteHealth(key,'warn','Connecting the live updates…','no status reported yet');
 noteHealth(key,'warn',key==='queue'?'Reconnecting… numbers may be a few seconds behind.':'Reconnecting… other desks’ changes still arrive at the next sync (within 10 minutes).',st||'connecting');
}
function healthRefresh(){
 const m=$('#cloudModal');if(m&&!m.classList.contains('hidden'))renderCloudBody();
 const h=$('#homeHealth');if(h)h.innerHTML=homeHealthHTML();
 for(const id of ['acctHealth','gateHealth']){const e=$('#'+id);if(e)e.innerHTML=acctHealthHTML();}
}
/* the panel behind the logo */
export function statusPanelHTML(){
 return `<div class="mt-4 rounded-[18px] border border-[#123033]/[.07] bg-white/60 p-3.5">
  <div class="flex items-center justify-between"><div class="microlabel">Cloud status</div>
   <button class="tap-link" data-action="healthTest" ${cloud.testing?'disabled':''}>${cloud.testing?'Testing…':'Test now'}</button></div>
  ${HEALTH_ROWS.map(([k,l])=>{const h=health[k];
   return `<div class="q-state q-state-${h?H_TONE[h.st]:'info'} mt-2"><span class="q-dot"></span><span style="flex:1"><b>${l}</b> · ${h?esc(h.msg):'Not checked yet.'}${h&&h.detail&&h.st!=='ok'?`<span class="mono mt-0.5 block text-[10px]">${esc(h.detail)}</span>`:''}</span><span class="text-[10px]">${h?hhmm(h.at):''}</span></div>`;}).join('')}
  <p class="mt-2 text-[10px] leading-relaxed text-[#8a9aa0]">${cloud.testedAt?`Test now ran at ${hhmm(cloud.testedAt)}. `:''}Test now only reads (one row of each table, and read-only functions); it never changes data.</p>
 </div>`;
}
/* Home: the worst of download, upload and live updates, one tap from the details */
export function homeHealthHTML(){
 const rows=['sync','upload','live'].map(k=>health[k]).filter(Boolean);
 if(!rows.length)return '';
 const w=rows.reduce((a,b)=>H_RANK[b.st]>H_RANK[a.st]?b:a);
 return `<button data-action="openCloud" class="q-state q-state-${H_TONE[w.st]} mb-2 w-full text-left"><span class="q-dot"></span><span class="min-w-0 flex-1 truncate">${w.st==='ok'?'Up to date with the shared database':esc(w.msg)}</span><span>Details</span></button>`;
}
/* the account screens: only when an account call is failing */
export function acctHealthHTML(){
 const h=health.account;
 if(!h||h.st==='ok'||h.st==='off')return '';
 return `<button data-action="openCloud" class="q-state q-state-${H_TONE[h.st]} mb-2.5 w-full text-left"><span class="q-dot"></span><span class="min-w-0 flex-1">${esc(h.msg)}</span><span>Details</span></button>`;
}
/* Test now: read-only checks of each function, one after another, each recorded with its time */
export async function healthTest(){
 if(!cloud.client||!cloud.user){noteHealth('auth','off','Not signed in. Sign in to test the shared database.');return;}
 if(cloud.testing)return;
 cloud.testing=true;renderCloudBody();
 const missing=[];let unreached=0;
 const probe=async(key,what,run)=>{
  let r;
  try{r=await run();}catch(e){r={error:e};}
  if(r&&r.error){if(isMissingErr(r.error))missing.push(what);else unreached++;healthFromError(key,r.error,what);return null;}
  return r||{};
 };
 noteHealth('auth','ok','Signed in as '+(cloud.user.email||''));
 const a=await probe('sync','attendees',()=>cloud.client.from('attendees').select('id').range(0,0));
 const v=await probe('sync','volunteers',()=>cloud.client.from('volunteers').select('id').range(0,0));
 if(a&&v)noteHealth('sync','ok','Reading visitors and volunteers works.');
 const qc=await probe('queue','queue_now',()=>cloud.client.rpc('queue_now'));
 const qt=await probe('queue','queue_entries',()=>cloud.client.from('queue_entries').select('id').range(0,0));
 if(qc&&qt)healthLive('queue',qs.rt||'');
 const me=await probe('account','my_account',()=>cloud.client.rpc('my_account'));
 if(me&&me.data&&typeof me.data==='object')noteHealth('account','ok','Account functions answer.');
 else if(me){missing.push('my_account (churches part)');noteHealth('account','warn','Churches are not set up in this database. Until schema.sql is run again, the old staff list decides who gets in.');}
 healthUpload();
 if(cloud.channel)healthLive('live',cloud.liveSt||'');else noteHealth('live','off','Not connected (connects after the first download).');
 if(missing.length)noteHealth('schema','bad',`Missing in the database: ${missing.join(', ')}. Run supabase/schema.sql again in the Supabase SQL editor.`);
 else if(unreached)noteHealth('schema','warn',`Could not be checked: ${unreached} request${unreached>1?'s':''} failed for another reason (see the rows above).`);
 else noteHealth('schema','ok','Every table and function Test now checks was found: attendees, volunteers, queue_entries, queue_now, my_account.');
 cloud.testing=false;cloud.testedAt=Date.now();
 healthRefresh();renderCloudBody();toast(missing.length?'Cloud test finished: something is missing (see Database setup)':'Cloud test finished');
}
