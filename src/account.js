// @ts-check
import { KINDS, acctHealthHTML, isNet, renderGate } from './cloud.js';
import { $ } from './helpers.js';
import { cloud, persist, persistNow, seedDemo } from './state.js';
import { CLOUD_UI, SB_KEY, SB_LIB, SB_URL, SYNC_KEY, closeCloud, resetLedgerSig, cloudDirtyList, cloudPending, gateBusy, gateView, healthFromError, healthLive, healthReset, healthUpload, installBlock, isDirty, isMissingErr, isOfflineErr, isSeedRow, noteHealth, passwordCheck, pwField, renderCloudBody, rowToAtt, savePassword, saveSynced, saveSyncedSoon, setCloud, sigOf, syncChrome, syncStatusText, syncTilesHTML, syncedLabel, validEmail } from './cloud.js';
import { CHURCH_PLANS_KEY, FOLLOWUP_MAX, churchPlansBox, clearInvite, followupsFor, inviteBox, myFollowupsHTML, pendingInvite } from './churchPlans.js';
import { GRACE_DAYS, clearReadings, clockKnown, followedUp, hasReadings, noteServerTime, readingsGone, visitIsOld } from './retention.js';
import { render, toast } from './shell.js';
import { confirmAsk, ok } from './feedback.js';
import { BOOTHS, EXPO_TOTAL, EXPO_UPCOMING, PROTOCOLS, STATUS_UI, attendees, boothLabel, state, volunteers } from './data.js';
import { qSafe, queueLeaveFor, queueReset, queueSync } from './queue.js';
import { bmi, cat, chipClass, esc, fmt1, initials, redFlag } from './helpers.js';
import { planNeeds } from './results.js';
import { MY_PLEDGE_ACTS, emptyDraft, hideModal, isAdminAcct, mayPlace, pledgeFormParts, setVolTab, showModal } from './volunteer.js';
import { loadScript } from './libs.js';
/* The account hub: my account, my church, all churches (platform admin), members and approvals. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ---------- churches, members and the platform admin ----------
   With the CHURCHES part of supabase/schema.sql every account belongs to one church. Staff and admins of an active church
   use the expo app as before, on that church's data only. Everyone else who signs in gets an account screen instead:
   choose or register a church, wait for approval, or (as an approved member) edit their details and see their own
   screening results. Church admins manage their members from the account hub, and only their own church: no account
   reaches another church's data. A church has at most two admins; the platform admin (the only one) gets an All churches
   tab with every church. The database checks every one of these actions; the screens only call its functions.
   A database without the CHURCHES part has no my_account function: the app then works exactly as it did before. */
const CHURCH_KEY='newstart.church.v1';               /* which church the data saved on this device belongs to */
export const ACCT_GATES=['church','churchwait','suspended','pending','member'];
const ROLE_L={member:'Member',staff:'Staff',admin:'Admin'};
/* a church's two admin posts, oldest admin first: the Health Department Leader and their Assistant (rank from my_account) */
const ADMIN_TITLES=['Health Department Leader','Assistant Health Department Leader'];
export const roleLabel=m=>!m?'':(m.role==='admin'&&m.status==='approved'&&m.admin_rank?(ADMIN_TITLES[m.admin_rank-1]||'Admin'):(ROLE_L[m.role]||m.role));
const CHURCH_L={pending:'Waiting',active:'Active',suspended:'Paused'};
/* what a person can ask to be when they sign up (memberships.wants): nothing here gives a right, an admin decides */
const WANTS=[['member','Church member','See my own results'],['pledge','Volunteer','Pledge to help at the expo'],
 ['team_member','Team member','Help at the station I choose'],['team_leader','Team leader','Lead one station'],
 ['assistant','Assistant Health Department Leader','Your church’s Leader approves this']];
const boothNames=l=>(l||[]).map(k=>boothLabel(k)).join(', ');
export const wantText=u=>{
 const w=u&&u.wants,b=boothNames(u&&u.wants_booths);
 return w==='assistant'?'Wants to be the Assistant Health Department Leader'
  :w==='team_leader'?'Wants to lead '+(b||'a station'):w==='team_member'?'Wants to help at '+(b||'a station')
  :w==='pledge'?'Wants to pledge'+(b?' · '+b:''):'';
};
const ACCT_MSG={church:'Choose your church to continue.',churchwait:'Your church is waiting for the Health Expo admin’s approval.',
 suspended:'Your church has been paused by the Health Expo admin.',pending:'Your church has not approved this account yet.',
 member:'Members see their own account. Visitor and volunteer data is for church staff.'};
/* a badge number is only unique inside its church, so uploads name the church */
export const inChurch=r=>cloud.churchId?{...r,church_id:cloud.churchId}:r;
export const conflictOn=()=>cloud.churchId?'church_id,id':'id';
const isChurchAdmin=()=>{const m=cloud.acct&&cloud.acct.membership;return !!m&&m.role==='admin'&&m.status==='approved';};
/* item 6, D-05: who may write a per-visitor custom plan — the App Owner (platform admin) or an approved church
   admin. This is the one client predicate; it reuses isAdminAcct rather than restating the role test. Postgres
   enforces the same rule in attendees_custom_plan_guard, because a client-only check is bypassable (R-04). */
export const canCustomPlan=()=>!!(cloud.acct&&(cloud.acct.platform_admin||isAdminAcct()));
/* who is signed in; true when they are staff of an active church (the expo app opens) */
export async function loadAccount(){
 const sentAt=Date.now(),r=await cloud.client.rpc('my_account');
 if(r.data&&typeof r.data==='object')noteServerTime(r.data.server_now,sentAt,Date.now());
 if(r.error||!r.data||typeof r.data!=='object'){         /* no churches in this database yet: the old staff check decides */
  cloud.acct=null;cloud.churchId='';
   if(!r.error||!isOfflineErr(r.error.message))noteHealth('account','warn','Churches are not set up in this database. Until schema.sql is run again, the old staff list decides who gets in.',r.error?String(r.error.message||''):'my_account gave no account');
   notifWatch();
   const chk=await cloud.client.rpc('is_staff');
  if(chk.error)throw chk.error;
  return chk.data===true;
 }
 /* a background sync (every minute, and on focus) lands here too: a member half-way through their pledge form keeps
    the form and their draft, and the pledge refreshes quietly instead of blanking to Loading… */
 const sameChurch=!!(cloud.acct&&cloud.acct.church&&r.data.church&&cloud.acct.church.id===r.data.church.id);
 const keepDraft=sameChurch&&(cloud.pledgeEdit||(!!state.mf&&cloud.pledge===null));
 cloud.acct=r.data;cloud.acctV++;cloud.health=undefined;cloud.myTeam=undefined;          /* Check again also reloads the member's results, pledge and team */
 if(keepDraft)loadPledge(true);else{cloud.pledge=undefined;cloud.pledgeEdit=false;state.mf=null;}
 if(cloud.user&&cloud.notifWatched!==cloud.user.id){cloud.notifWatched=cloud.user.id;notifCountSoon();}   /* the bell count: once per sign-in */
 const m=r.data.membership,c=r.data.church;
 /* an invite link opened on this device: join that church now, approved (it is used once, whatever the answer) */
 const inv=pendingInvite();
 if(inv&&!(m&&m.status==='approved'&&m.role!=='member')){
  clearInvite();
  const j=await cloud.client.rpc('join_with_invite',{p_code:inv,p_full_name:'',p_phone:''});
  if(j.error)toast(isOfflineErr(j.error.message)?'No connection: open the invite link again when you are online.':(j.error.message||'That invite link did not work.'));
  else{toast('You have joined the church ✓');return loadAccount();}
 }
 cloud.churchId=c?c.id:'';
 noteHealth('account','ok',c&&m?`${c.name} · ${roleLabel(m)}${m.status==='approved'?'':' (waiting for approval)'}`:'Signed in, not in a church yet.');
 return !!(m&&c&&m.status==='approved'&&m.role!=='member'&&c.status==='active');
}
/* the account screen a signed-in person without expo access sees */
export function acctGate(){
 const a=cloud.acct;if(!a)return '';
 const m=a.membership,c=a.church;
 if(!m||!c)return 'church';
 if(c.status==='suspended')return 'suspended';
 if(c.status!=='active')return 'churchwait';
 if(m.status!=='approved')return 'pending';
 return 'member';
}
/* forget the church data saved on this device (another church's account, or no longer staff) */
export function dropChurchData(){
 attendees.length=0;volunteers.length=0;
 cloud.synced={att:{},vol:{}};cloud.rejected={};cloud.since={att:'',vol:''};cloud.lastFull=0;
 queueReset();
 try{localStorage.removeItem(SYNC_KEY);localStorage.removeItem(CHURCH_KEY);}catch(e){}
 resetLedgerSig();afterMerge();persistNow();
}
/* Staff of a church: the saved copy must be that church's. One saved for another church is cleared first, never
   uploaded: the database would file its rows under the new church. */
export function adoptChurch(id){
 let had='';try{had=localStorage.getItem(CHURCH_KEY)||'';}catch(e){}
 if(had&&had!==id){dropChurchData();toast('Signed in to another church — loading its data');}
 try{localStorage.setItem(CHURCH_KEY,id);}catch(e){}
}
/* one database call from the account screens; a refusal is shown in the database's own words */
export async function acctRpc(fn,args,done){
 if(!cloud.client)return null;
 let r;
 try{r=await cloud.client.rpc(fn,args||{});}catch(e){r={error:e};}
 if(r.error){healthFromError('account',r.error,fn);toast(isNet(r.error.message)?'No connection — try again when you are online.':(r.error.message||'That did not work.'));return null;}
 if(done)toast(done);
 return r;
}
async function acctReload(){
 const r=await acctRpc('my_account');
 if(r&&r.data&&typeof r.data==='object'){cloud.acct=r.data;cloud.acctV++;}
 renderGate();renderAcct();profileChanged();
}
export const retryNote=(t,what)=>acctNote(t)+`<button class="btn btn-glass mt-2 w-full py-2.5 text-xs" data-action="acct-retry" data-args="${what}">Try again</button>`;
export const acctNote=t=>`<p class="mt-1.5 text-[11px] leading-relaxed text-[#5c747a]">${t}</p>`;
export const acctBox=(label,body)=>`<div class="mt-4 rounded-[18px] border border-[#123033]/[.07] bg-white/60 p-3.5"><div class="microlabel">${label}</div>${body}</div>`;

/* --- the gate screens --- */
export function acctGateHTML(st){
 const a=cloud.acct,m=a.membership,c=a.church;
 const title=t=>`<div class="display text-[17px] font-extrabold text-[#0f2a2c]">${t}</div>`;
 const out=`<div class="mt-4 flex gap-2"><button data-action="cloudSignOut" class="btn btn-glass flex-1 py-2.5 text-xs text-[#5b7178]">Sign out</button>
   <button data-action="sync-now" class="btn btn-primary flex-1 py-2.5 text-xs">Check again</button></div>`;
 const leave=c?`<button data-action="leaveChurch" class="mt-3 w-full text-center text-[11px] font-bold text-rose-700">Leave ${esc(c.name)}</button>`:'';
 const admin=a.platform_admin?`<button data-action="openAcct" data-args="admin" class="btn btn-soft mt-3 w-full py-2.5 text-xs">Open all churches (platform admin)</button>`:'';
 if(st==='church')return `${title('Choose your church')}
  ${acctNote('Signed in as <b class="text-[#33504f]">'+esc(a.email||'')+'</b>. Join the church you belong to. Its admins approve you, and then you can see your own expo results here.')}
  ${churchPickHTML()}
  <button data-action="cloudSignOut" class="btn btn-glass mt-4 w-full py-2.5 text-xs text-[#5b7178]">Sign out</button>${admin}${profDeleteHTML()}`;
 if(st==='churchwait')return `${title('Waiting for your church to be approved')}
  ${acctNote('<b class="text-[#33504f]">'+esc(c.name)+'</b> is registered, with you as its Health Department Leader. The Health Expo admin still has to approve it before visitors and volunteers can be added. Press Check again once they have — or just come back to the app, it checks by itself.')}
  ${out}${admin}${profDeleteHTML()}`;
 if(st==='suspended')return `${title(esc(c.name)+' is paused')}
  ${acctNote('The Health Expo admin has paused this church, so its expo data cannot be opened. Ask them about it, or leave the church to join another one.')}
  ${out}${leave}${admin}${profDeleteHTML()}`;
 if(st==='pending')return `${title('Waiting for approval')}
  ${acctNote('Your email <b class="text-[#33504f]">'+esc(a.email||'')+'</b> is confirmed. <b class="text-[#33504f]">'+esc(c.name)+'</b> still has to approve you as a member. Give the Health Department Leader or their Assistant the email above. The app checks again by itself when you come back to it, or press Check again.')}
  ${out}${meFormHTML('gm')}${leave}${admin}${profDeleteHTML()}`;
 return `${title('My account')}
  ${acctNote(esc(m.full_name||a.email||'')+' · '+roleLabel(m)+' of <b class="text-[#33504f]">'+esc(c.name)+'</b>')}
  ${healthHTML()}${notifBoxHTML()}${expoMemberHTML()}${pledgeHTML()}${myTeamHTML()}${meFormHTML('gm')}<div class="pf">${profPasswordBox()}</div>
  <button data-action="cloudSignOut" class="btn btn-glass mt-4 w-full py-2.5 text-xs text-[#5b7178]">Sign out</button>${leave}${admin}<div class="pf mt-3">${profDeleteHTML()}</div>`;
}
function churchPickHTML(){
 const link=(fn,t)=>`<div class="mt-3 text-center"><button type="button" data-action="${fn}" class="text-[11px] font-extrabold text-brand-700">${t}</button></div>`;
 if(cloud.regChurch)return `${dirBoxHTML('Already registered — is yours here? Join it instead of registering it again.','max-h-[26vh]')}
  <form data-action="registerChurch" class="mt-4 space-y-3">
   <label class="block"><span class="microlabel">Church or organisation name</span><input id="rcName" required maxlength="120" placeholder="e.g. Grace Chapel" class="field mt-1"></label>
   <label class="block"><span class="microlabel">Town or city</span><input id="rcCity" maxlength="80" placeholder="e.g. Durban" class="field mt-1"></label>
   <label class="block"><span class="microlabel">Church phone</span><input id="rcPhone" type="tel" inputmode="tel" maxlength="40" class="field mt-1"></label>
   <label class="block"><span class="microlabel">Church email</span><input id="rcEmail" type="email" inputmode="email" maxlength="254" class="field mt-1"></label>
   <p class="text-[10px] leading-relaxed text-[#8a9aa0]">You become the church’s Health Department Leader. One Assistant can be added later — a church has two admin posts. The Health Expo admin approves the church before any visitor data can be added.</p>
   <button id="rcGo" class="btn btn-primary w-full py-3 text-sm">Register the church</button></form>
  ${link('reg-church-list','Back to the list of churches')}`;
 return `${wantsPickHTML()}${dirBoxHTML('Then find your church','max-h-[52vh]')}
  ${link('reg-church-form','My church is not listed — register it')}`;
}
/* "What would you like to be?" comes first at sign-up; the station chips appear for the positions that need one */
function wantsPickHTML(){
 const w=cloud.wants||'member',one=w==='team_leader',needs=w==='team_leader'||w==='team_member'||w==='pledge';
 /* a title over its description, left-aligned: .btn centres a row, which put the two side by side and squeezed them */
 const two=(t,d)=>`<span class="block min-w-0 text-left"><b class="block text-xs">${esc(t)}</b><span class="block text-[10px] font-semibold leading-snug opacity-80">${esc(d)}</span></span>`;
 const btn=(k,t,d)=>`<button type="button" data-action="want-pick" data-args="${k}" aria-pressed="${w===k}" class="btn ${w===k?'btn-primary':'btn-glass'} w-full px-3 py-2.5 text-left" style="justify-content:flex-start">${two(t,d)}</button>`;
 return `<div class="mt-4"><div class="microlabel">What would you like to be?</div>
  <div class="mt-1.5 space-y-1.5">${WANTS.map(x=>btn(x[0],x[1],x[2])).join('')}
   <button type="button" data-action="reg-church-form" class="btn btn-glass w-full px-3 py-2.5 text-left" style="justify-content:flex-start">${two('Health Department Leader','Register my church — I lead it')}</button></div>
  ${needs?`<div class="mt-2"><span class="microlabel">${one?'Which station would you lead?':w==='pledge'?'A station you would like (optional, up to 2)':'Which station(s)? Up to 2'}</span>
   <div class="mt-1.5 flex flex-wrap gap-2">${BOOTHS.map(b=>`<button type="button" data-action="want-booth" data-args="${esc(b.k)}" aria-pressed="${(cloud.wantsBooths||[]).includes(b.k)}" class="availpill hue-${b.hue} ${(cloud.wantsBooths||[]).includes(b.k)?'availpill-on':''}">${esc(b.label)}</button>`).join('')}</div></div>`:''}
  ${w==='assistant'||w==='team_leader'?acctNote('Nobody gives themselves this: your church’s Health Department Leader or admin approves it first. Until then you are a plain member.'):''}</div>`;
}
/* the gate only redraws when its fingerprint changes, so a choice made on it clears the fingerprint; the search box keeps its text */
function redrawGate(){
 const q=($('#dirQ')||{}).value||'';
 cloud.gateKey='';renderGate();
 const el=$('#dirQ');if(el&&q)el.value=q;
}
export function pickWant(k){
 if(!WANTS.some(x=>x[0]===k))return;
 cloud.wants=k;
 const keep=(cloud.wantsBooths||[]).slice(0,k==='team_leader'?1:2);
 cloud.wantsBooths=(k==='team_leader'||k==='team_member'||k==='pledge')?keep:[];
 redrawGate();
}
export function pickWantBooth(k){
 const l=(cloud.wantsBooths||[]).slice(),i=l.indexOf(k),max=cloud.wants==='team_leader'?1:2;
 if(i>=0)l.splice(i,1);else{l.push(k);while(l.length>max)l.shift();}
 cloud.wantsBooths=l;redrawGate();
}
/* the searchable list of registered churches, shown both when choosing a church and when registering a new one */
function dirBoxHTML(label,maxH){
 return `<label class="mt-4 block"><span class="microlabel">${label}</span>
   <input id="dirQ" data-on-input="church-search" placeholder="Church name or town" class="field mt-1"></label>
  <div id="churchDir" class="mt-2 ${maxH} overflow-y-auto no-scrollbar">${dirHTML()}</div>`;
}
function dirHTML(){
 const l=cloud.dir;
 if(!l)return '<p class="text-[11.5px] text-[#4f6870]">Loading…</p>';
 if(!l.length)return `<p class="text-[11.5px] text-[#4f6870]">${cloud.regChurch?'No church matches yet.':'No church matches. Check the spelling, or register your church.'}</p>`;
 /* a church still waiting for the platform admin can be seen but not joined; a list from an older database has no status */
 return l.map(c=>`<div class="flex items-center gap-2 border-t border-[#123033]/[.07] py-2">
   <div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(c.name)}</div>
    <div class="truncate text-[11px] text-[#4f6870]">${esc(c.city||'')}</div></div>
   ${c.status==='pending'?`<span class="${chipClass('watch')} flex-none">Waiting for approval</span>`
    :`<button class="btn btn-primary flex-none px-4 text-xs" data-action="join-church" data-args="${qSafe(c.id)}">Join</button>`}</div>`).join('');
}
let _dirT=null;
export function churchSearchSoon(q){clearTimeout(_dirT);_dirT=setTimeout(()=>churchSearch(q),250);}
export async function churchSearch(q){
 const r=await acctRpc('church_directory',{p_search:q||''});
 cloud.dir=r&&Array.isArray(r.data)?r.data:[];
 const el=$('#churchDir');if(el)el.innerHTML=dirHTML();
}
export async function joinChurch(id,btn){
 const w=cloud.wants||'member',b=(cloud.wantsBooths||[]).slice();
 if(w==='team_leader'&&b.length!==1){toast('Choose the one station you would lead');return;}
 if(w==='team_member'&&!b.length){toast('Choose the station you would like to help at');return;}
 if(btn){btn.disabled=true;btn.textContent='…';}
 /* a plain member sends the old short call, which works with any version of the database */
 const args=w==='member'?{p_church:id}:{p_church:id,p_wants:w,p_booths:b};
 const r=await acctRpc('join_church',args,'Request sent — the church will approve you');
 if(!r){if(btn){btn.disabled=false;btn.textContent='Join';}return;}
 cloud.wants='member';cloud.wantsBooths=[];
 cloud.dir=null;await cloudSync(true);
}
export async function registerChurch(e){
 e.preventDefault();
 const v=id=>(($('#'+id)||{}).value||'').trim();
 if(v('rcName').length<2){toast('Enter the church’s name.');return;}
 gateBusy('rc','Registering…');
 const r=await acctRpc('register_church',{p_name:v('rcName'),p_city:v('rcCity'),p_phone:v('rcPhone'),p_email:v('rcEmail')},'Church registered — waiting for the Health Expo admin');
 if(!r){const b=$('#rcGo');if(b){b.disabled=false;b.textContent='Register the church';}return;}
 cloud.regChurch=false;await cloudSync(true);
}
export async function leaveChurch(){
 const c=cloud.acct&&cloud.acct.church;if(!c)return;
 const yes=await confirmAsk({title:`Leave ${c.name}?`,
  body:`Your details there are deleted${cloud.mode?' and this device clears that church’s data':''}. You can join another church afterwards.`,
  label:'Leave',danger:true});
 if(!yes)return;
 if(!await acctRpc('leave_church',{},'You have left '+c.name))return;
 closeAcct();cloud.health=undefined;cloud.dir=null;
 await cloudSync(true);
}

/* --- my details and my results --- */
function meFormHTML(p){
 const m=(cloud.acct&&cloud.acct.membership)||{};
 const f=(id,l,v,x)=>`<label class="block"><span class="microlabel">${l}</span><input id="${p}${id}" value="${esc(v||'')}" class="field mt-1" ${x}></label>`;
 return acctBox('My details',`<form data-action="saveMyDetails" data-pre="${p}" class="mt-2 space-y-3">
  ${f('Name','Full name',m.full_name,'autocomplete="name" maxlength="200" required')}
  ${f('Phone','Phone',m.phone,'type="tel" inputmode="tel" autocomplete="tel" maxlength="40"')}
  ${f('Area','Area or suburb',m.area,'maxlength="120"')}
  ${f('Birth','Date of birth (optional)',m.birth_date,'type="date"')}
  <p class="text-[10px] leading-relaxed text-[#8a9aa0]">Only you and your church’s admins can see these details.</p>
  <button id="${p}Go" class="btn btn-primary w-full py-3 text-sm">Save my details</button></form>`);
}
export async function saveMyDetails(e){
 e.preventDefault();
 const p=(e.target&&e.target.dataset&&e.target.dataset.pre)||'me',v=id=>(($('#'+p+id)||{}).value||'').trim();
 if(!v('Name')){toast('Enter your name.');return;}
 gateBusy(p,'Saving…');
 const r=await acctRpc('update_my_details',{p_full_name:v('Name'),p_phone:v('Phone'),p_area:v('Area'),p_birth_date:v('Birth')||null},'Your details are saved ✓');
 const b=$('#'+p+'Go');if(b){b.disabled=false;b.textContent='Save my details';}
 if(r)await acctReload();
}
async function loadHealth(){
 if(cloud.healthBusy)return;
 cloud.healthBusy=true;
 const r=await acctRpc('my_health');
 cloud.healthBusy=false;
 cloud.health=r&&r.data&&typeof r.data==='object'?r.data:null;
 cloud.acctV++;renderGate();renderAcct();profileChanged();
}
/* The member's own readings from the expo, with the same colour bands as the Results tab. Only the medical readings
   decide the clinic line, as in urgentOf(): danger range (redFlag) = see a clinic soon; any other red blood pressure,
   sugar, cholesterol or weight = book a clinic visit this week. The app's medicine rule always shows. */
/** What "My screening results" says when there are no readings: deleted after the grace period, or never measured. */
function emptyHealthNote(gone){
 return gone?acctNote(`The readings of this visit were deleted ${GRACE_DAYS} days after it, as the notice said they would be. Ask your church for a new screening.`)
  :acctNote('No readings were recorded for this badge.');
}
export function healthHTML(){
 const m=cloud.acct.membership;
 if(m.status!=='approved')return '';
 if(!m.attendee_id)return acctBox('My screening results',acctNote('Your results appear here once a church admin links your expo badge to this account. Show them this screen, or tell them your badge number.'));
 if(cloud.health===undefined){loadHealth();return acctBox('My screening results',acctNote('Loading…'));}
 if(!cloud.health)return acctBox('My screening results',acctNote('Your linked results could not be loaded. If this keeps happening, ask your church to check the badge link.'));
 const a=rowToAtt(cloud.health),s=a.s,b=bmi(a),has=v=>v!=null&&v!=='';
 /* an old record with no readings is not "not measured yet": the readings were deleted after the grace period */
 const gone=readingsGone(cloud.health);
 const rows=[
  ['Blood pressure',s.sys&&s.dia?`${s.sys}/${s.dia}`:'',cat('bp',{sys:s.sys,dia:s.dia})],
  ['Blood sugar',has(s.sugar)?`${s.sugar} mmol/L`:'',cat('sugar',s.sugar)],
  ['Cholesterol',has(s.chol)?`${s.chol} mmol/L`:'',cat('chol',s.chol)],
  ['BMI',b!=null?fmt1(b):'',cat('bmi',b)],
  ['Fruit & veg',has(s.veg)?`${s.veg} a day`:'',cat('veg',s.veg)],
  ['Exercise',has(s.walk)?`${s.walk} min a day`:'',cat('walk',s.walk)],
  ['Water',has(s.water)?`${s.water} glasses a day`:'',cat('water',s.water)],
  ['Sleep',has(s.sleep)?`${s.sleep} hours`:'',cat('sleep',s.sleep)]].filter(r=>r[1]);
 const needs=planNeeds(a),danger=redFlag(a);
 const red=danger||[cat('bp',{sys:s.sys,dia:s.dia}),cat('sugar',s.sugar),cat('chol',s.chol),cat('bmi',b)].some(c=>c[0]==='flag');
 return acctBox('My screening results',`<div class="mono mt-1 text-[10px] text-[#6b8187]">${esc(a.id)} · ${esc(String(cloud.health.created_at||'').slice(0,10))}</div>
  ${rows.length?rows.map(r=>`<div class="flex items-center justify-between gap-2 border-t border-[#123033]/[.07] py-2">
    <span class="text-[12px] font-bold text-[#123033]">${r[0]}</span>
    <span class="flex items-center gap-2"><span class="text-[12px] text-[#33504f]">${esc(r[1])}</span><span class="${chipClass(r[2][0])}">${esc(r[2][1])}</span></span></div>`).join('')
   :emptyHealthNote(gone)}
  ${red?`<p class="mt-2 text-[11px] font-bold leading-relaxed text-rose-700">${danger?'A reading was in the danger range (blood pressure 160/100 or more, or blood sugar 15 or more). Please see a clinic as soon as you can.'
   :'A reading is in the red range. Please book a clinic visit this week.'}</p>`:''}
  ${acctNote(needs.length?'What to work on first: '+needs.map(n=>esc(PROTOCOLS[n.k].tag)).join(', ')+'.':'Your numbers looked fine at the expo.')}
  ${acctNote('Keep taking any medicine you were prescribed. Only your clinic should change it.')}`);
}

/* --- my pledge (self-pledge, supabase "VOLUNTEER HUB: SELF-PLEDGE") ---
   The member's pledge is a volunteers row linked through memberships.volunteer_id. cloud.pledge: undefined = not
   loaded yet, null = no pledge, object = the row my_pledge() returned. The form reuses sections 1–3 of the staff
   pledge form (volunteer.js pledgeFormParts) with its own draft, state.mf, so the two never write each other. */
/* a plain member only ever sees the gate screen: the bell and the hub must be reachable from there too */
function notifBoxHTML(){
 const n=cloud.notifN||0;
 return acctBox('Notifications',`<button data-action="openNotifs" class="btn btn-soft w-full py-2.5 text-xs"><span id="gateNotifN">${n>0?`${n} new notification${n>1?'s':''}`:'Open notifications'}</span></button>`);
}
export function pledgeHTML(){
 const m=cloud.acct&&cloud.acct.membership;
 if(!m||m.status!=='approved')return '';
 if(cloud.pledge===undefined){loadPledge();return acctBox('My pledge',acctNote('Loading…'));}
 if(cloud.pledgeErr)return acctBox('My pledge',acctNote('Pledging needs the latest supabase/schema.sql — ask the church to update the database first.'));
 if(!cloud.pledge)return acctBox('My pledge',acctNote('Pledge to help at the next expo and your name goes onto the team list straight away. Your church’s admin registers you and chooses your station. Your pledge details stay on the roster until you unpledge or your church’s admin removes them.')+myPledgeFormHTML());
 if(cloud.pledgeEdit)return acctBox('My pledge',myPledgeFormHTML());
 const p=cloud.pledge,st=STATUS_UI[p.status];
 return acctBox('My pledge',`
  <div class="mt-1 flex flex-wrap items-center gap-1.5">
   <span class="servechip ${st?st.cls:'sc-off'}">${esc(st?st.label:p.status)}</span>
   ${p.lead?'<span class="servechip sc-warn">★ Team leader</span>':p.role?`<span class="servechip sc-off">${esc(p.role)}</span>`:''}
  </div>
  <div class="mt-2 text-[12px] font-bold text-[#123033]">${esc(p.name)}</div>
  <div class="mt-0.5 text-[11px] text-[#4f6870]">${p.booth?'Placed at '+esc(boothLabel(p.booth)):'Not placed yet — the admin chooses your station'}${p.shift?' · '+esc(p.shift):''}</div>
  ${(()=>{const e=((cloud.expos&&cloud.expos.list)||[]).find(x=>x.id===p.expo_id);return e?`<div class="mt-0.5 text-[11px] font-bold text-brand-700">For ${esc(e.name)} · ${esc(expoDate(e))}</div>`:'';})()}
  <div class="mono mt-1 text-[10px] text-[#6b8187]">${esc(p.id)} · pledged ${esc(String(p.pledged_on||'').slice(0,10))}</div>
  <div class="mt-2 flex gap-2">
   <button data-action="my-pledge-edit" class="btn btn-soft flex-1 py-2 text-xs">Edit my pledge</button>
   ${p.status==='prospect'?'<button data-action="my-pledge-withdraw" class="btn btn-glass flex-1 py-2 text-xs text-rose-700">Unpledge</button>'
     :p.status==='registered'?'<button data-action="my-pledge-deregister" class="btn btn-glass flex-1 py-2 text-xs text-rose-700">Deregister</button>':''}
   <button data-action="openSettings" class="btn btn-glass flex-1 py-2 text-xs">Settings</button>
  </div>
  ${p.status==='checkedin'?acctNote('You are checked in for this expo: only your church’s admin can change that now.'):acctNote('Your pledge details (name and contacts) stay on your church’s roster until you unpledge or your church’s admin removes them.')}`);
}
async function loadPledge(force){
 if(cloud.pledgeBusy&&!force)return;
 cloud.pledgeBusy=true;
 const r=await acctRpc('my_pledge');
 cloud.pledgeBusy=false;cloud.pledgeErr=false;
 if(r===null){cloud.pledge=null;cloud.pledgeErr=true;}
 else cloud.pledge=r&&r.data&&typeof r.data==='object'?r.data:null;
 cloud.acctV++;renderGate();     /* the member screen keys its redraw on acctV: without this it stays on Loading… */
 renderAcct();render();
}
/* the member's pledge draft: prefilled from their saved pledge (or their membership details) the first time it opens */
function myDraftInit(){
 const d=state.mf||(state.mf=emptyDraft());
 if(!d._init){
  const p=cloud.pledge,mm=(cloud.acct&&cloud.acct.membership)||{};
  d.name=p?p.name:(mm.full_name||'');d.phone=p?p.phone:(mm.phone||'');d.email=p?p.email:'';
  d.pledgeExpos=p?(p.pledge_expos||1):1;
  d.skills=p?[...(p.skills||[])]:[];d.pref=p?[...(p.pref||[])]:(Array.isArray(mm.wants_booths)?mm.wants_booths.slice(0,2):[]);d.avail=p?[...(p.availability||[])]:[];
  d.pref2=p?(p.pref2||''):'';d.shirt=p?(p.shirt||''):'';d.emergency=p?(p.emergency||''):'';d.notes=p?(p.notes||''):'';
  d._init=true;
 }
 return d;
}
function myPledgeFormHTML(){
 const d=myDraftInit();
 return `<form data-action="myPledgeSave" class="mt-2 space-y-3">
  ${expoPickHTML()}
  ${pledgeFormParts(d,'mf',MY_PLEDGE_ACTS)}
  <button id="mfGo" data-label="${cloud.pledge?'Save my pledge':'Send my pledge'}" class="btn btn-primary w-full py-3 text-sm">${cloud.pledge?'Save my pledge':'Send my pledge →'}</button>
  <p class="text-[10px] leading-relaxed text-[#8a9aa0]">Your pledge counts straight away — no approval step. Your church’s admin places you at a station.</p></form>`;
}
export function myPledgeEdit(){cloud.pledgeEdit=true;if(state.mf)delete state.mf._init;acctRedraw();}
/* the member form's field and chip handlers write state.mf; chips redraw, text fields only store (a redraw while
   typing would throw the person off the field, exactly like the staff form) */
export function myField(k,val){myDraftInit()[k]=val;}
/* a member sees this screen inside the gate, which redraws only when acctV moves: every tap here must bump it */
const acctRedraw=()=>{cloud.acctV++;renderGate();renderAcct();render();};
const myRedraw=acctRedraw;
export function myPickPledge(n){myDraftInit().pledgeExpos=n;myRedraw();}
export function myToggleList(k,v){
 const a=myDraftInit()[k];const i=a.indexOf(v);
 if(i<0)a.push(v);else a.splice(i,1);
 myRedraw();
}
export function myToggleBooth(k){
 const a=myDraftInit().pref;const i=a.indexOf(k);
 if(i<0){a.push(k);if(a.length>2)a.shift();}else a.splice(i,1);
 myRedraw();
}
export function mySecondBooth(k){const d=myDraftInit();d.pref2=d.pref2===k?'':k;myRedraw();}
export async function myPledgeSave(e){
 e.preventDefault();
 const d=state.mf||{};
 const name=String(d.name||'').trim(),phone=String(d.phone||'').trim(),email=String(d.email||'').trim();
 if(!name){toast('Enter your full name.');return;}
 if(!/\d/.test(phone)&&!validEmail(email)){toast('Please enter a mobile number or an email address, so the team can reach you');return;}
 gateBusy('mf','Sending…');
 const r=await acctRpc('save_my_pledge',{p:{name,phone,email,pledgeExpos:d.pledgeExpos||1,skills:d.skills||[],
   pref:d.pref||[],pref2:d.pref2||'',availability:d.avail||[],shirt:d.shirt||'',emergency:d.emergency||'',notes:d.notes||'',expoId:chosenExpo()}},
   cloud.pledge?'Your pledge is saved ✓':'Pledge received — you are on the team list ✓');
 const b=$('#mfGo');if(b){b.disabled=false;b.textContent=cloud.pledge?'Save my pledge':'Send my pledge →';}
 if(!r)return;
 cloud.pledgeEdit=false;state.mf=null;cloud.expos=undefined;cloud.adminExpos=undefined;
 await loadPledge(true);
 await acctReload();                      /* my_account now carries the volunteer_id */
}
export async function withdrawMyPledge(){
 const yes=await confirmAsk({title:'Unpledge from the expo?',
  body:'Your name comes off the team list, and your pledge is removed. You can pledge again at any time.',
  label:'Unpledge',danger:true});
 if(!yes)return;
 if(await acctRpc('withdraw_my_pledge')){
  cloud.pledgeEdit=false;state.mf=null;
  await loadPledge(true);
  await acctReload();
  renderSettings();
  ok('Your pledge is withdrawn');
 }
}
/* ---------- settings: the commitments a member owns ----------
   The profile says who you are; this panel says what you have signed up to, and is the only place a member can
   take that back without an admin. Both buttons call a database function — the sheet only asks, and the server
   decides (checked-in and unregistered states are refused there, not here). */
export function openSettings(){renderSettings();showModal('#setSheet',closeSettings);}
export function closeSettings(){hideModal('#setSheet');}
export function renderSettings(){
 const el=$('#setBody');
 if(el)el.innerHTML=settingsBody();
}
function settingsBody(){
 const m=cloud.acct&&cloud.acct.membership;
 if(!m||m.status!=='approved')
  return acctBox('Health expos',acctNote('Once your church approves your membership, the expos you pledge to appear here.'));
 if(cloud.pledge===undefined){loadPledge();return acctBox('Health expos',acctNote('Loading your commitments…'));}
 if(cloud.pledgeErr)
  return acctBox('Health expos',acctNote('Commitments need the latest supabase/schema.sql — ask your church to update the database first.'));
 const p=cloud.pledge;
 if(!p)
  return acctBox('Health expos',acctNote('You are not committed to an expo yet.')
   +`<p class="mt-2 text-[11px] leading-relaxed text-[#5c747a]">Pledge from <b>My pledge</b> on your profile; the expo appears here as soon as you do.</p>`);
 const st=STATUS_UI[p.status]||{label:p.status,cls:'sc-off'};
 const row=(k,v)=>`<div class="flex items-baseline justify-between gap-3 border-b border-[#123033]/[.06] py-1.5 last:border-0"><span class="text-[11px] font-bold text-[#5c747a]">${k}</span><span class="text-right text-[11.5px] font-bold text-[#123033]">${v}</span></div>`;
 const dated=s=>esc(String(s||'').slice(0,10))||'—';
 const exposures=Number(p.pledge_expos)||1;
 const detail=[
  row('Status',`<span class="servechip ${st.cls}">${esc(st.label)}</span>`),
  row('Health expos pledged to',`${exposures} of ${EXPO_TOTAL}`),
  row('Pledged on',dated(p.pledged_on)),
 ];
 if(p.status==='registered'||p.status==='checkedin'){
  detail.push(row('Station',p.booth?esc(boothLabel(p.booth)):'Not placed yet'));
  if(p.shift)detail.push(row('Shift',esc(p.shift)));
  if(p.role)detail.push(row('Role',esc(p.role)+(p.lead?' ★ team leader':'')));
  if(p.registered_on)detail.push(row('Registered on',dated(p.registered_on)));
 }
 const acts=p.status==='prospect'
  ?`<button data-action="my-pledge-withdraw" class="btn btn-glass w-full py-2.5 text-xs text-rose-700">Unpledge from this expo</button>`
  :p.status==='registered'
  ?`<button data-action="my-pledge-deregister" class="btn btn-glass w-full py-2.5 text-xs text-rose-700">Deregister from this expo</button>`
  :`<p class="text-[11px] leading-relaxed text-[#5c747a]">You are checked in for this expo — only your church's admin can change that now.</p>`;
 return acctBox('Health expos you are committed to',
  `<div class="mt-1 flex items-center gap-1.5"><span class="servechip ${st.cls}">${esc(st.label)}</span>
    ${p.lead?'<span class="servechip sc-warn">★ Team leader</span>':''}</div>
   <div class="mt-2 text-[13px] font-extrabold text-[#123033]">${esc(p.name)}</div>
   <div class="mono mt-0.5 text-[10px] text-[#6b8187]">${esc(p.id)}</div>
   <div class="mt-2">${detail.join('')}</div>
   <div class="mt-3">${acts}</div>`);
}
export async function deregisterMyPledge(){
 const yes=await confirmAsk({title:'Deregister from the expo?',
  body:'You come off the expo plan and your station is released. Your pledge stays on the team list, so you can register again later. If you lead a station, you hand that back too.',
  label:'Deregister',danger:true});
 if(!yes)return;
 if(await acctRpc('deregister_my_pledge')){
  cloud.pledgeEdit=false;
  await loadPledge(true);
  await acctReload();
  renderSettings();
  ok('Deregistered — your pledge still stands');
 }
}
/* attach a pledge a staff member typed in to the person's account (admins, mirroring linkMember) */
export async function linkVolunteer(uid,cur){
 const v=prompt('Volunteer number of this member’s pledge, e.g. VOL-1001. Leave it empty to unlink.',cur||'');
 if(v===null)return;
 if(await acctRpc('link_volunteer',{p_user:uid,p_vol:v.trim()},v.trim()?'Volunteer linked ✓':'Volunteer unlinked'))await reloadMembers();
}

/* ---------- my team (station leaders, VOLUNTEER HUB: PLACEMENT) ----------
   A team leader may be a plain member: their rights come from their linked volunteer record, not from staff access.
   my_team() returns their station's people and the unplaced volunteers who asked for it — and nothing else. */
export function myTeamHTML(){
 const p=cloud.pledge;
 if(!p||!p.lead||!p.booth)return '';
 if(cloud.myTeam===undefined){loadMyTeam();return acctBox('My team · '+esc(boothLabel(p.booth)),acctNote('Loading…'));}
 const L=cloud.myTeam||[],placed=L.filter(x=>x.booth),wait=L.filter(x=>!x.booth);
 const row=x=>`<div class="border-t border-[#123033]/[.07] py-2">
   <div class="flex items-center gap-2"><div class="min-w-0 flex-1">
    <div class="truncate text-[13px] font-bold text-[#123033]">${esc(x.name)}${x.lead?' <span class="text-[#bf9a40]">★</span>':''}</div>
    <div class="truncate text-[10.5px] text-[#4f6870]">${esc(x.phone||'')}${x.phone&&x.pref&&x.pref.length?' · asked for '+esc(x.pref.map(boothLabel).join(', ')):''}</div></div>
    <span class="servechip ${STATUS_UI[x.status]?STATUS_UI[x.status].cls:'sc-off'}">${esc(STATUS_UI[x.status]?STATUS_UI[x.status].label:x.status)}</span></div>
   ${x.booth?`<div class="mt-1.5 flex items-center gap-2">
     <input data-on-change="team-shift" data-vol="${qSafe(x.id)}" value="${esc(x.shift||'')}" aria-label="Shift for ${esc(x.name)}"
       placeholder="Shift, e.g. 09:00–13:00" class="field flex-1 py-1.5 text-xs">
     ${x.lead?'':`<button class="tap-link flex-none text-rose-700" data-action="team-release" data-args="${qSafe(x.id)}">Take off my station</button>`}</div>`
    :`<button class="btn btn-primary mt-1.5 w-full py-2 text-xs" data-action="team-add" data-args="${qSafe(x.id)}">Add to my team</button>`}</div>`;
 return acctBox('My team · '+esc(boothLabel(p.booth)),
  (placed.length?placed.map(row).join(''):'<p class="mt-1 text-[11px] text-[#4f6870]">Nobody is placed at your station yet.</p>')
  +(wait.length?`<div class="microlabel mt-3">Waiting for a place · ${wait.length}</div>${wait.map(row).join('')}`:'')
  +acctNote('You can add people who asked for your station, take your own people off it and set their shifts. Moving between stations is the admin’s job.'));
}
async function loadMyTeam(){
 if(cloud.myTeamBusy)return;
 cloud.myTeamBusy=true;
 const r=await acctRpc('my_team');
 cloud.myTeamBusy=false;
 cloud.myTeam=r&&Array.isArray(r.data)?r.data:[];
 cloud.acctV++;renderGate();
 renderAcct();render();
}
export async function teamAdd(id){
 const b=cloud.pledge&&cloud.pledge.booth;if(!b)return;
 if(await acctRpc('place_volunteer',{p_vol:id,p_booth:b},'Added to your team ✓'))cloud.myTeam=undefined,await loadMyTeam();
}
export async function teamRelease(id){
 if(await acctRpc('release_volunteer',{p_vol:id},'Taken off the station'))cloud.myTeam=undefined,await loadMyTeam();
}
export async function teamShift(id,shift){
 if(await acctRpc('set_shift',{p_vol:id,p_shift:shift||''},'Shift saved ✓'))cloud.myTeam=undefined,await loadMyTeam();
}

/* ---------- notifications (VOLUNTEER HUB: NOTIFICATIONS) ----------
   A bell for every signed-in account. The count is one head-only query, at sign-in and when the app comes to the
   front — never a timer. Arrivals arrive live: staff ride the existing newstart-live channel (startRealtime), a
   member who has no channel opens one for their own rows only. Offline keeps the last known count. */
export function notifRefresh(){
 const n=cloud.notifN||0;
 const b=$('#notifBell');if(b)b.classList.toggle('hidden',!cloud.user);
 for(const id of ['notifDot','homeNotifDot']){
  const d=$('#'+id);if(!d)continue;
  if(cloud.user&&n>0){d.style.display='flex';d.textContent=n>9?'9+':String(n);}else d.style.display='none';
 }
 const g=$('#gateNotifN');          /* the member gate is a screen of its own: it carries the count too */
 if(g)g.textContent=n>0?`${n} new notification${n>1?'s':''}`:'Open notifications';
}
export async function notifCount(){
 if(!cloud.client||!cloud.user){cloud.notifN=0;notifRefresh();return;}
 /* PostgREST has no `eq.null`: the NULL test is `is.null`. (`eq('read_at',null)` sends read_at=eq.null, which
    the database rejects as an invalid timestamp, so the count never loaded.) */
 const r=await cloud.client.from('notifications').select('id,read_at',{count:'exact',head:true}).eq('user_id',cloud.user.id).is('read_at',null);
 if(r.error){notifRefresh();return;}       /* offline: keep the last known count, but still show the bell */
 cloud.notifN=typeof r.count==='number'?r.count:(Array.isArray(r.data)?r.data.length:0);
 notifRefresh();
}
export function notifCountSoon(){clearTimeout(cloud.notifT);cloud.notifT=setTimeout(notifCount,300);}
/* a member with no shared channel opens one, filtered to their own rows. (Supabase Realtime applies the table's
   row level security to postgres_changes, so the filter only ever delivers the account's own inserts.) */
export function notifWatch(){
 if(!cloud.client||!cloud.user||cloud.channel||cloud.notifChannel)return;
 const ch=cloud.client.channel('newstart-notifs');
 ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+cloud.user.id},p=>onNotifRow(p.new));
 ch.subscribe();cloud.notifChannel=ch;
}
export function notifStop(){
 cloud.notifLive=false;cloud.notifWatched='';
 if(cloud.notifChannel&&cloud.client){try{cloud.client.removeChannel(cloud.notifChannel);}catch(e){}}
 cloud.notifChannel=null;cloud.notifN=0;notifRefresh();
}
function onNotifRow(row){
 if(!row||row.read_at)return;
 cloud.notifN=(cloud.notifN||0)+1;notifRefresh();
 if(cloud.notifOpen)renderNotifs();
}
export function openNotifs(){
 cloud.notifOpen=true;showModal('#notifSheet',notifClose);cloud.notifs=undefined;renderNotifs();
}
async function loadNotifs(){
 if(!cloud.client||!cloud.user)return;
 /* newest first: an ascending order + range(0,49) would fetch the OLDEST fifty and "mark all read" could then
    never clear the newest unread ones */
 const r=await cloud.client.from('notifications').select('id,kind,title,body,created_at,read_at').eq('user_id',cloud.user.id).order('created_at',{ascending:false}).range(0,49);
 if(r.error){cloud.notifs=null;cloud.notifsOffline=isOfflineErr(r.error.message);renderNotifs();return;}
 const rows=r.data||[];
 cloud.notifs=rows;renderNotifs();
}
const KIND_L={membership:'Account',placement:'Placement',lead:'Team leader',church:'Church',pledge:'Pledge',register:'Registered',deregister:'Deregistered',unpledge:'Pledge withdrawn',team:'My team',shift:'Shift',expo:'Health Expo'};
export function renderNotifs(){
 const el=$('#notifBody');if(!el)return;
 if(!cloud.user){el.innerHTML=acctNote('Sign in to see notifications.');return;}
 if(cloud.notifs===undefined){loadNotifs();return;}
 if(cloud.notifs===null){el.innerHTML=`<div class="display text-base font-extrabold">Notifications</div>${acctNote(cloud.notifsOffline?'Connect to see new notifications. Your unread count stays on the bell.':'The notifications could not be loaded. If this keeps happening, check the connection and the database setup.')}`;return;}
 const L=cloud.notifs||[];
 const unread=L.filter(x=>!x.read_at).length,maxId=L.length?Math.max(...L.map(x=>Number(x.id)||0)):0;
 el.innerHTML=`<div class="display text-base font-extrabold">Notifications</div>
  <div class="mt-1 flex items-center justify-between gap-2">
   <span class="text-[11px] text-[#5c747a]">${navigator.onLine?'The last 50, newest first.':'Connect to see new notifications.'}</span>
   ${L.length?`<button data-action="notif-mark-read" data-args="${maxId}" class="tap-link ${unread?'':'opacity-50'}">Mark all read</button>`:''}</div>
  ${L.length?L.map(x=>`<button data-action="notif-open" data-args="${qSafe(String(x.id))}" class="mt-2 w-full rounded-[16px] border border-[#123033]/[.07] bg-white/60 p-3 text-left ${x.read_at?'opacity-70':''}">
    <div class="flex items-center justify-between gap-2"><span class="microlabel">${esc(KIND_L[x.kind]||x.kind||'Notification')}</span>
     <span class="mono flex-none text-[9px] text-[#8a9aa0]">${esc(String(x.created_at||'').slice(0,16).replace('T',' '))}${x.read_at?'':' · new'}</span></div>
    <div class="mt-0.5 text-[13px] font-bold text-[#123033]">${esc(x.title)}</div>
    ${x.body?`<div class="mt-0.5 text-[11px] leading-snug text-[#4f6870]">${esc(x.body)}</div>`:''}</button>`).join('')
   :acctNote('Nothing yet. You will hear about your placement, your team and your membership here.')}`;
}
export async function markNotifsRead(upto){
 const r=await acctRpc('mark_notifications_read',{p_upto:Number(upto)||null},'Marked all read ✓');
 if(!r)return;
 cloud.notifN=0;notifRefresh();
 cloud.notifs=undefined;renderNotifs();
}
/* a notification about a station opens the board for staff; everything else opens the account screen */
export function notifOpen(id){
 const x=(cloud.notifs||[]).find(n=>String(n.id)===String(id));if(!x)return;
 notifClose();
 const staff=cloud.acct&&cloud.acct.membership&&cloud.acct.membership.role!=='member';
 if(staff&&(x.kind==='placement'||x.kind==='team'||x.kind==='pledge'||x.kind==='lead'
   ||x.kind==='register'||x.kind==='deregister'||x.kind==='unpledge')){setVolTab('muster');render();}
 else openAcct('me');
}
export function notifClose(){cloud.notifOpen=false;hideModal('#notifSheet');}

/* --- the account hub: My account · My church · All churches (platform admin) --- */
export function acctTabs(){
 const a=cloud.acct,t=[];if(!a)return t;
 if(a.membership)t.push(['me','My account']);
 if(isChurchAdmin()||(a.platform_admin&&cloud.adminChurch))t.push(['church','My church']);
 if(a.platform_admin)t.push(['admin','All churches']);
 return t;
}
export function openAcct(tab){
 cloud.acctTab=tab||'me';
 cloud.expos=undefined;cloud.adminExpos=undefined;   /* pledge counts change while the sheet is closed: read them fresh */
 if(cloud.acctTab==='admin'){cloud.plat=null;cloud.audit=null;cloud.pAdmins=null;}
 if(cloud.acctTab==='church'){cloud.members=null;cloud.adminPlans=null;cloud.planEdit=null;cloud.adminFollowups=null;cloud.inviteLink=null;}
 if(cloud.acctTab==='me')cloud.myFollow=null;
 showModal('#acctSheet');renderAcct();
}
export function closeAcct(){hideModal('#acctSheet');}
export function renderAcct(){
 const hd=$('#acctTabs'),el=$('#acctBody'),sheet=$('#acctSheet');
 if(!hd||!el||!sheet||sheet.classList.contains('hidden'))return;
 if(!cloud.acct){hd.innerHTML='';el.innerHTML=acctNote('Accounts need the churches part of supabase/schema.sql. Run the whole file again in the Supabase SQL editor.');return;}
 const tabs=acctTabs();
 if(!tabs.some(t=>t[0]===cloud.acctTab))cloud.acctTab=(tabs[0]||['me'])[0];
 hd.innerHTML=`<div class="flex gap-2">${tabs.map(([k,l])=>`<button data-action="openAcct" data-args="${k}" class="btn ${k===cloud.acctTab?'btn-primary':'btn-glass'} flex-1 py-2 text-xs">${l}</button>`).join('')}</div>`;
 el.innerHTML=`<div id="acctHealth">${acctHealthHTML()}</div>`+(cloud.acctTab==='admin'?platformHTML():cloud.acctTab==='church'?churchAdminHTML():meHTML());
}
function meHTML(){
 const a=cloud.acct,m=a.membership,c=a.church;
 if(!m||!c)return acctNote('This account is not in a church.');
 return `<div class="text-[13px] font-bold text-[#123033]">${esc(c.name)}${c.city?' · '+esc(c.city):''}</div>
  <div class="text-[11px] text-[#4f6870]">${roleLabel(m)} · ${m.status==='approved'?'approved':'waiting for approval'} · ${esc(a.email||'')}</div>
  ${m.followup&&m.status==='approved'?myFollowupsHTML():''}${healthHTML()}${expoMemberHTML()}${pledgeHTML()}${myTeamHTML()}${meFormHTML('me')}
  <button data-action="leaveChurch" class="mt-3 w-full text-center text-[11px] font-bold text-rose-700">Leave ${esc(c.name)}</button>`;
}
/* the signed-in staff member's shortcut into the sheet (the panel behind the logo) */
export function acctButtons(){
 const a=cloud.acct;if(!a)return '';
 const m=a.membership,b=(t,l)=>`<button data-action="hub-open" data-args="${t}" class="btn btn-soft flex-1 py-2.5 text-xs">${l}</button>`;
 return acctBox(esc(a.church?a.church.name:'No church')+(m?' · '+roleLabel(m):''),
  `<div class="mt-2 flex gap-2">${b('me','My account')}${isChurchAdmin()?b('church','My church'):''}${a.platform_admin?b('admin','All churches'):''}</div>`);
}

/* --- the Profile page (bottom tab) ---
   Who is signed in, sign in / out, my details, my password and deleting my account: the same actions as the sheets behind
   the logo, on a page that can be found. Its forms report in place (profMsg), because a redraw would wipe what is typed. */
const profWho=()=>{
 const a=cloud.acct,m=a&&a.membership,meta=(cloud.user&&cloud.user.user_metadata)||{},email=(a&&a.email)||(cloud.user&&cloud.user.email)||'';
 return {email,name:(m&&m.full_name)||meta.full_name||email.split('@')[0]||'Signed in'};
};
function profMsg(id,msg){
 const e=$('#'+id);
 if(!e)return;
 e.textContent=msg||'';e.className='text-[11px] font-bold text-rose-600';
}
/* gateBusy changed a button's label while its request ran: put the label back */
function profIdle(id){
 const b=$('#'+id);
 if(b&&b.dataset&&b.dataset.label){b.disabled=false;b.textContent=b.dataset.label;}
}
const profFail=()=>{profMsg('pfErr',cloud.formErr);profIdle('pfGo');};
/* The page follows sign-in, sign-out and account changes. cloudRefresh leaves a box that is being typed in alone; right
   after the person's own sign-in it must not, because the form they just used is what gets replaced. */
export function profileChanged(force){
 if(state.tab!=='me')return;
 const el=/** @type {HTMLElement|null} */ (document.activeElement);
 if(force&&el&&el.blur)el.blur();
 cloudRefresh();
}
const profHero=(title,note)=>`<div class="hero p-5 text-center"><div class="display text-[17px] font-extrabold text-[#0f2a2c]">${title}</div>
  <p class="mx-auto mt-1.5 max-w-[32ch] text-[11.5px] leading-relaxed text-[#5b7178]">${note}</p></div>`;
export function viewProfile(){
 const wrap=h=>`<section class="pf stagger space-y-3.5">${h}</section>`;
 if(window.NEWSTART_NO_CLOUD)return wrap(profHero('Your profile','Sign-in is switched off in this copy of the app.'));
 return wrap(cloud.user?profSignedIn():profSignedOut());
}
function profSignedOut(){
 const hero=profHero('Your profile',(cloud.demo?'<b>Practice mode</b>: demo visitors, nothing is shared. ':'')+'Sign in to share visitors and volunteers between desks and to manage your account.');
 /* the sign-in service is still loading, or could not load */
 if(!cloud.client){
  const failed=cloud.status==='unavailable';
  return hero+acctBox('Sign in',acctNote(failed?'The sign-in service did not load, usually because there is no internet.':'Connecting…')
   +(failed?`<button data-action="cloudInit" class="btn btn-primary mt-3 w-full py-2.5 text-xs">Try again</button>`:''))+installBlock();
 }
 return hero+acctBox('Sign in',`<form data-action="cloudSignIn" data-pre="pf" class="mt-2 space-y-3">
   <label class="block"><span class="microlabel">Email</span>
    <input id="pfEmail" type="email" inputmode="email" autocomplete="username" required placeholder="you@example.org" class="field mt-1" value="${esc(cloud.viewEmail||'')}"></label>
   ${pwField('pfPass','Password','current-password')}
   <p id="pfErr" role="alert" class="text-[11px] font-bold text-rose-600"></p>
   <button id="pfGo" data-label="Sign in" class="btn btn-primary w-full py-3 text-sm">Sign in</button></form>
  <div class="mt-3 flex items-center justify-between">
   <button type="button" data-action="profGate" data-args="forgot" class="tap-link">Forgot password?</button>
   <button type="button" data-action="profGate" data-args="signup" class="tap-link">Create an account</button></div>`)+installBlock();
}
function profSignedIn(){
 const a=cloud.acct,m=a&&a.membership,w=profWho();
 const hero=`<div class="hero p-5">
   <div class="flex items-center gap-3">
    <span class="flex h-12 w-12 flex-none items-center justify-center rounded-[18px] text-sm font-extrabold av hue-lilac">${esc(initials(w.name))}</span>
    <div class="min-w-0"><div class="display truncate text-[19px] leading-tight font-extrabold text-[#0f2a2c]">${esc(w.name)}</div>
     <div class="truncate text-[11px] text-[#5c747a]">${esc(w.email)}</div></div></div>
   <div class="mt-3 flex flex-wrap gap-1.5">${profChips()}</div>${profShortcuts()}</div>`;
 return hero+profSync()+(m?meFormHTML('pm')+healthHTML()+expoMemberHTML()+pledgeHTML()+myTeamHTML():'')+profPasswordBox()+installBlock()+profAccountBox();
}
/* role, church and approval as small labels under the name */
function profChips(){
 const a=cloud.acct,m=a&&a.membership,c=a&&a.church,out=[],chip=(t,cls)=>`<span class="servechip ${cls}">${esc(t)}</span>`;
 if(a&&a.platform_admin)out.push(chip('Platform admin','sc-ok'));
 if(m)out.push(chip(roleLabel(m)||m.role,'sc-ok'));
 if(m&&m.status!=='approved')out.push(chip('Waiting for approval','sc-warn'));
 if(c)out.push(chip(c.name+(c.city?' · '+c.city:''),'sc-off'));
 return out.join('');
}
/* the screens only admins have: the church's members, and the platform admin (the database decides who may open them) */
function profShortcuts(){
 const a=cloud.acct;
 if(!a)return '';
 const go=(t,l)=>`<button data-action="openAcct" data-args="${t}" class="btn btn-soft flex-1 py-2.5 text-xs">${l}</button>`;
 const row=(isChurchAdmin()?go('church','My church'):'')+(a.platform_admin?go('admin','All churches'):'');
 return `<div class="mt-3 flex gap-2">${row}<button data-action="openSettings" class="btn btn-soft flex-1 py-2.5 text-xs">Settings</button></div>`;
}
function profSync(){
 const ui=CLOUD_UI[cloud.status]||CLOUD_UI.off;
 return acctBox('Sync',`<div class="mt-2 flex items-center gap-2 text-[12px] font-bold text-[#33504f]"><span style="width:9px;height:9px;border-radius:9999px;background:${ui[0]}"></span><span id="profSyncLine">${esc(syncStatusText())}${syncedLabel()}</span></div>
  ${cloud.err?`<p class="mt-1.5 text-[11px] leading-relaxed text-rose-600">${esc(cloud.err)}</p>`:''}
  ${cloud.ready?`<div class="mt-3 grid grid-cols-3 gap-2" id="profSyncTiles">${syncTilesHTML()}</div>`:''}
  <div class="mt-3 flex gap-2"><button data-action="sync-now" class="btn btn-primary flex-1 py-2.5 text-xs"${cloud.busy?' disabled':''}>Sync now</button>
   <button data-action="openCloud" class="btn btn-glass flex-1 py-2.5 text-xs">Details</button>
   ${cloud.user?`<button data-action="cloudSignOut" class="btn btn-glass flex-1 py-2.5 text-xs">Sign out</button>`:''}</div>`);
}
function profPasswordBox(){
 return acctBox('Password',`<form data-action="profPassword" class="mt-2 space-y-3">
  ${pwField('pwNew','New password','new-password','At least 8 characters')}
  ${pwField('pwNew2','Repeat it','new-password','Type it again')}
  <p class="text-[10px] leading-relaxed text-[#8a9aa0]">At least 8 characters, with a letter and a number.</p>
  <p id="pwErr" role="alert" class="text-[11px] font-bold text-rose-600"></p>
  <button id="pwGo" data-label="Change password" class="btn btn-soft w-full py-3 text-sm">Change password</button></form>`);
}
export async function profPassword(e){
 e.preventDefault();
 if(!cloud.client)return;
 const pw=$('#pwNew').value,pw2=$('#pwNew2').value,bad=passwordCheck(pw,pw2);
 if(bad){profMsg('pwErr',bad);return;}
 gateBusy('pw','Saving…');
 const msg=await savePassword(pw);
 profIdle('pwGo');
 if(msg){profMsg('pwErr',msg);return;}
 $('#pwNew').value='';$('#pwNew2').value='';
 profMsg('pwErr','');toast('Password updated');
}
function profAccountBox(){
 return acctBox('Account',`<button data-action="cloudSignOut" class="btn btn-glass mt-2 w-full py-2.5 text-xs text-[#5b7178]">Sign out</button>${profDeleteHTML()}`);
}
/* Deleting is two steps: open the panel, then type DELETE. The database refuses only the only platform admin. */
function profDeleteHTML(){
 if(!cloud.delOpen)return `<button data-action="profDeleteAsk" class="mt-3 w-full text-center text-[11px] font-bold text-rose-700">Delete my account…</button>`;
 return `<div class="mt-3 rounded-[14px] border border-rose-200/70 bg-rose-50/80 p-3">
   <p class="text-[11px] font-bold leading-relaxed text-rose-700">This deletes your login and your details (name, phone, area, pledge and the position you asked for) for good. Visitor and volunteer records stay with your church. It cannot be undone.</p>
   <label class="mt-2 block"><span class="microlabel">Type DELETE to confirm</span>
    <input id="pfDelType" data-on-input="prof-delete-typed" autocomplete="off" autocapitalize="characters" class="field mt-1"></label>
   <p id="pfDelErr" role="alert" class="mt-2 text-[11px] font-bold text-rose-600"></p>
   <div class="mt-2 flex gap-2"><button data-action="profDeleteAsk" class="btn btn-glass flex-1 py-2.5 text-xs">Cancel</button>
    <button id="pfDelGo" data-label="Delete my account" data-action="profDeleteGo" disabled class="btn btn-glass flex-1 py-2.5 text-xs text-rose-700">Delete my account</button></div></div>`;
}
const profRedraw=()=>{cloud.gateKey='';renderGate();render();};
export function profDeleteAsk(){cloud.delOpen=!cloud.delOpen;profRedraw();}
const profTyped=el=>String((el&&el.value)||'').trim().toUpperCase()==='DELETE';
export function profDeleteTyped(el){
 const b=$('#pfDelGo');
 if(b)b.disabled=!profTyped(el);
}
export async function profDeleteGo(){
 if(!cloud.client||!cloud.user||!profTyped($('#pfDelType')))return;
 gateBusy('pfDel','Deleting…');
 let r;
 try{r=await cloud.client.rpc('delete_my_account');}catch(err){r={error:err};}
 if(r.error){
  const m=String(r.error.message||'');
  profIdle('pfDelGo');
  profMsg('pfDelErr',isMissingErr(r.error)?'Deleting accounts needs the latest supabase/schema.sql. Ask the administrator to run it again.':isNet(m)?'No connection — try again when you are online.':(m||'Could not delete the account.'));
  return;
 }
 await cloudSignOut(true);
 toast('Your account has been deleted');
}
/* Create an account / Forgot password open the full-screen sign-in screens, with a way back to the app (gateBack) */
export function profGate(v){cloud.gateForce=true;gateView(v);}
export function gateBack(){
 cloud.gateHide=true;                  /* keep the session; the app stays open until a sign-in screen is asked for again */
 cloud.gateForce=false;cloud.view='login';cloud.formErr='';cloud.gateKey='';renderGate();
}

/* --- church admins (and the platform admin, for any church) --- */
export function churchAdminHTML(){
 const a=cloud.acct,viaAdmin=a.platform_admin&&!!cloud.adminChurch;
 const cid=viaAdmin?cloud.adminChurch:(a.church&&a.church.id);
 const c=viaAdmin?((cloud.plat||[]).find(x=>x.id===cid)||{id:cid,name:''}):a.church;
 if(!cid||!c)return acctNote('No church to manage.');
 if(!cloud.members||cloud.members.cid!==cid)loadMembers(cid);
 const L=cloud.members&&cloud.members.cid===cid?cloud.members.list:null,waiting=L?L.filter(u=>u.status==='pending').length:0,
       admins=L?L.filter(u=>u.role==='admin'&&u.status==='approved').length:0;
 /* the two admin posts are stored: rank 1 = Health Department Leader, rank 2 = their Assistant */
 const ranks={};
 (L||[]).filter(u=>u.role==='admin'&&u.status==='approved').forEach(u=>{ranks[u.user_id]=u.admin_post==='leader'?1:2;});
 /* the Leader and the platform admin give and take the admin posts; the Assistant runs the members */
 const canPost=!!(a.platform_admin||(a.membership&&a.membership.role==='admin'&&a.membership.status==='approved'&&a.membership.admin_rank===1&&a.membership.church_id===cid));
 const F=followupsFor(cid);
 const selfAdmin=!viaAdmin&&a.membership&&a.membership.church_id===cid&&a.membership.role==='admin'&&a.membership.status==='approved';
 return `${viaAdmin?`<button data-action="back-to-churches" class="tap-link">← All churches</button>`:''}
  <div class="mt-1 text-[13px] font-bold text-[#123033]">${esc(c.name)}</div>
  ${acctBox('Health Expos',expoAdminHTML(cid))}
  ${acctBox('Members'+(waiting?` · ${waiting} waiting`:'')+(F?` · ${F.length} of ${FOLLOWUP_MAX} follow-up people`:''),
   !L?acctNote('Loading…'):cloud.members.err?retryNote('Could not load the members. Check your connection.','members'):!L.length?acctNote('Nobody has joined yet.'):L.map(u=>memberRow(u,F,admins,ranks,canPost)).join('')
   +acctNote('Members see only their own details and results. Staff and church admins see this church’s visitors and volunteers, so only give those roles to people you know.')
   +acctNote('Admins manage this church only: nobody here can open another church’s data. The two admin posts are the Health Department Leader and their Assistant: the Leader (or the Expo admin) gives, swaps and takes them; the Assistant approves and removes members, pledges and team leaders.')
   +acctNote(`Follow-up people (up to ${FOLLOWUP_MAX}) are given visitors to contact after the expo, and see only those visitors.`))}
  ${selfAdmin?acctBox('My admin post',adminPostHTML(a.membership,ranks)):''}
  ${acctBox('Invite links',inviteBox(cid,c))}
  ${acctBox('Church plans',churchPlansBox(cid))}
  ${acctBox('Church details',churchFormHTML(c))}`;
}
/* F = the user ids of the church's follow-up people (null while loading); admins = its count of approved admins;
   ranks = user id → 1 for the Health Department Leader, 2 for their Assistant; canPost = may this viewer give admin posts */
export function memberRow(u,F,admins,ranks,canPost){
 const id=qSafe(u.user_id),fu=!!(F&&F.includes(u.user_id)),isAdmin=u.role==='admin'&&u.status==='approved',want=wantText(u);
 const post=isAdmin?((ranks&&ranks[u.user_id])===1?'leader':'assistant'):'none';
 const asst=u.status==='pending'&&u.confirmed&&u.wants==='assistant'&&canPost;
 return `<div class="border-t border-[#123033]/[.07] py-2.5">
  <div class="flex items-center gap-2"><div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(u.full_name||'(no name given)')}</div>
   ${ranks&&ranks[u.user_id]?`<div class="text-[10px] font-bold text-[#33504f]">${esc(ADMIN_TITLES[ranks[u.user_id]-1])}</div>`:''}
   ${want?`<div class="text-[10px] font-bold text-brand-700">${esc(want)}</div>`:''}
   <div class="truncate text-[11px] text-[#4f6870]">${esc(u.email||'')}${u.phone?' · '+esc(u.phone):''}${u.area?' · '+esc(u.area):''}${u.confirmed?'':' · has not confirmed the email yet'}</div></div>
   ${u.status==='pending'&&u.confirmed?`<button class="btn btn-primary flex-none px-4 text-xs" data-action="${asst?'member-approve-assistant':'member-approve'}" data-user="${id}" data-role="${qSafe(u.role)}">${asst?'Approve as Assistant':'Approve'}</button>`:''}</div>
  ${u.status==='pending'&&u.wants==='assistant'&&!canPost?acctNote('Only the Health Department Leader or the Expo admin can make someone the Assistant. Approve them as a member now, and they can appoint them.'):''}
  <div class="mt-1.5 flex flex-wrap items-center gap-2">
   ${isAdmin?'':`<select data-on-change="member-role" data-user="${id}" data-status="${qSafe(u.status)}" aria-label="Role" class="field py-1.5 text-xs" style="width:auto">${['member','staff'].map(r=>`<option value="${r}" ${r===u.role?'selected':''}>${ROLE_L[r]}</option>`).join('')}</select>`}
   ${canPost&&u.status==='approved'?`<select data-on-change="member-post" data-user="${id}" aria-label="Admin post" class="field py-1.5 text-xs" style="width:auto">${[['none','No admin post'],['leader',ADMIN_TITLES[0]],['assistant','Assistant']].map(o=>`<option value="${o[0]}" ${o[0]===post?'selected':''}>${o[1]}</option>`).join('')}</select>`:''}
   <button class="tap-link" data-action="member-link" data-user="${id}" data-cur="${qSafe(u.attendee_id||'')}">${u.attendee_id?'Badge '+esc(u.attendee_id):'Link badge'}</button>
   <button class="tap-link" data-action="member-vol-link" data-user="${id}" data-cur="${qSafe(u.volunteer_id||'')}">${u.volunteer_id?'Vol '+esc(u.volunteer_id):'Link volunteer'}</button>
   ${F&&u.status==='approved'?`<button class="tap-link" aria-pressed="${fu}" data-action="followup-toggle" data-user="${id}" data-on="${fu?0:1}">${fu?'✓ Follow-up person':'Make follow-up person'}</button>`:''}
   ${isAdmin&&!canPost?'':`<button class="tap-link text-rose-700" data-action="removeMember" data-args="${id}">Remove</button>`}</div></div>`;
}
async function loadMembers(cid){
 if(!cid||cloud.membersBusy===cid)return;
 cloud.membersBusy=cid;
 const r=await acctRpc('church_members',{p_church:cid});
 cloud.membersBusy='';
 cloud.members={cid,list:r&&Array.isArray(r.data)?r.data:[],err:!(r&&Array.isArray(r.data))};
 renderAcct();
}
const reloadMembers=()=>{const cid=cloud.members&&cloud.members.cid;cloud.members=null;return loadMembers(cid);};
export async function setMember(uid,role,status){
 const r=await acctRpc('set_member',{p_user:uid,p_role:role,p_status:status},'Saved ✓');
 await reloadMembers();                                            /* also puts a refused role back in the list */
 if(r&&cloud.acct&&uid===cloud.acct.user_id)await cloudSync(true);  /* changed my own role */
}
/* the Leader's (or the Expo admin's) choice of who holds which admin post; a held post is replaced, and a person
   who holds the other post swaps with its holder — the database does it, the screen only asks first */
export async function setAdminPost(uid,post){
 const L=(cloud.members&&cloud.members.list)||[],u=L.find(x=>x.user_id===uid)||{},name=u.full_name||u.email||'this person';
 const holder=post==='none'?null:L.find(x=>x.user_id!==uid&&x.role==='admin'&&x.status==='approved'&&x.admin_post===post);
 const mine=u.role==='admin'&&u.status==='approved'?u.admin_post:'';
 const t=post==='leader'?ADMIN_TITLES[0]:ADMIN_TITLES[1];
 if(post==='none'){
  if(!await confirmAsk({title:`Take ${name}’s admin post away?`,body:'They stay on as staff and keep seeing the church’s expo data, but they can no longer approve or remove members.',label:'Take it away',danger:true})){await reloadMembers();return;}
 }else if(holder&&!mine){
  if(!await confirmAsk({title:`Make ${name} the ${t}?`,body:`${holder.full_name||holder.email} holds that post now. They stay on as staff.`,label:'Replace',danger:true})){await reloadMembers();return;}
 }else if(holder&&mine){
  if(!await confirmAsk({title:'Swap the two admin posts?',body:`${name} becomes the ${t} and ${holder.full_name||holder.email} takes ${name}’s post.`,label:'Swap'})){await reloadMembers();return;}
 }
 const r=await acctRpc('set_admin_post',{p_user:uid,p_post:post},'Saved ✓');
 await reloadMembers();                                           /* also puts a refused post back in the list */
 if(r&&cloud.acct)await acctReload();
}
/* approve someone who asked to be the Assistant: approve them as a member, then give the post (asking first if it is held) */
export async function approveAssistant(uid){
 if(!await acctRpc('set_member',{p_user:uid,p_role:'member',p_status:'approved'}))return;
 await reloadMembers();
 await setAdminPost(uid,'assistant');
}
export async function linkMember(uid,cur){
 const v=prompt('Badge number of this member’s expo record, e.g. EXPO-042. Leave it empty to unlink.',cur||'');
 if(v===null)return;
 if(await acctRpc('link_member',{p_user:uid,p_attendee:v.trim()},v.trim()?'Badge linked ✓':'Badge unlinked'))await reloadMembers();
}
export async function removeMember(uid){
 const u=((cloud.members&&cloud.members.list)||[]).find(x=>x.user_id===uid)||{};
 const yes=await confirmAsk({title:`Remove ${u.full_name||u.email||'this person'}?`,
  body:'Their details are deleted from this church and they lose access to it.',label:'Remove',danger:true});
 if(!yes)return;
 if(await acctRpc('remove_member',{p_user:uid},'Removed'))await reloadMembers();
}
/* an admin's own post: step down with one action. A church may have no admin; the Expo admin appoints one. */
export function adminPostHTML(m,ranks){
 const me=cloud.acct&&cloud.acct.user_id;   /* the membership object carries no user id; the account does */
 /* until the church's member list arrives, nobody can tell whether a co-admin exists */
 if(!cloud.members||cloud.members.cid!==m.church_id)return acctNote('Loading…');
 const others=cloud.members.list.filter(u=>u.role==='admin'&&u.status==='approved'&&u.user_id!==me).length;
 const title=(ranks&&ranks[me])?esc(ADMIN_TITLES[ranks[me]-1]):esc(roleLabel(m)||'Admin');
 return `<div class="text-[12px] font-bold text-[#123033]">${title}</div>
  <button data-action="stepDown" class="btn btn-glass mt-2 w-full py-2.5 text-xs text-rose-700">Step down — become a member</button>
  ${acctNote('You keep your account and your own screening results.')}
  ${others?acctNote('When the Health Department Leader steps down, their Assistant automatically becomes the Health Department Leader.')
   :acctNote('You are this church’s only admin: if you step down it has no admin until the Expo admin appoints one.')}`;
}
export async function stepDown(){
 const sole=!((cloud.members&&cloud.members.list)||[]).some(u=>u.role==='admin'&&u.status==='approved'&&cloud.acct&&u.user_id!==cloud.acct.user_id);
 const yes=await confirmAsk({title:'Step down as admin?',
  body:'You become a plain member: this church’s visitors, volunteers and queue are hidden from you. Your account and your own results stay.'+(sole?' The church will have no admin until the Expo admin appoints one.':''),
  label:'Step down',danger:true});
 if(!yes)return;
 const uid=cloud.acct&&cloud.acct.user_id;
 if(!await acctRpc('set_member',{p_user:uid,p_role:'member',p_status:'approved'},'You stepped down — you are a member now'))return;
 cloud.members=null;                     /* a member may no longer list the church's members */
 await acctReload();
 await cloudSync(true);                  /* the saved copy of the church's expo data leaves this device */
}
function churchFormHTML(c){
 const f=(id,l,v,x)=>`<label class="block"><span class="microlabel">${l}</span><input id="cf${id}" value="${esc(v||'')}" class="field mt-1" ${x}></label>`;
 return `<form data-action="church-save" data-args="${qSafe(c.id)}" class="mt-2 space-y-3">
  ${f('Name','Church name',c.name,'required maxlength="120"')}${f('City','Town or city',c.city,'maxlength="80"')}
  ${f('Phone','Church phone',c.phone,'type="tel" inputmode="tel" maxlength="40"')}${f('Email','Church email',c.email,'type="email" inputmode="email" maxlength="254"')}
  <button id="chGo" class="btn btn-primary w-full py-3 text-sm">Save church details</button></form>`;
}
export async function saveChurch(e,cid){
 e.preventDefault();
 const v=id=>(($('#cf'+id)||{}).value||'').trim();
 gateBusy('cf','Saving…');
 const r=await acctRpc('update_church',{p_church:cid,p_name:v('Name'),p_city:v('City'),p_phone:v('Phone'),p_email:v('Email')},'Church details saved ✓');
 const b=$("#chGo");if(b){b.disabled=false;b.textContent="Save church details";}
 if(!r)return;
 if(cloud.acct.platform_admin)await loadPlatform();
 await acctReload();
}


/* ---------- Health Expos ----------
   A church's admins set up each expo (name, date, time, venue, volunteers needed in all and per station, a medical
   clinic with its doctors); every approved member sees the open ones and pledges to one. The database decides who may do
   what (church_expos, save_expo, delete_expo); these screens only ask. Counts and types only: no doctor is named. */
const DOCTOR_TYPES=['GP','Dentist','Optometrist','Physiotherapist','Dietitian','Psychologist','Other'];
const EXPO_ST={draft:['Draft','watch'],open:['Open','ok'],done:['Done','ok'],cancelled:['Cancelled','flag']};
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
export const expoDate=x=>{
 const d=new Date(String(x.starts_on||'')+'T12:00:00');
 return isNaN(d.getTime())?String(x.starts_on||''):d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
};
const expoTime=x=>x.start_time?(x.end_time?x.start_time+' – '+x.end_time:'from '+x.start_time):'';
const expoClosed=x=>!!(x.signup_deadline&&String(x.signup_deadline)<todayStr());
const openExpos=()=>((cloud.expos&&cloud.expos.list)||[]).filter(x=>x.status==='open'&&!expoClosed(x));
async function fetchExpos(cid){
 /* a read: an older database without the function just shows no expos, quietly */
 if(!cloud.client)return {err:'net',list:[]};
 let r;
 try{r=await cloud.client.rpc('church_expos',cid?{p_church:cid}:{});}catch(e){r={error:e};}
 if(r&&!r.error&&Array.isArray(r.data))return {list:r.data};
 const msg=String((r&&r.error&&r.error.message)||'');
 return {err:/function|does not exist|schema cache/i.test(msg)?'schema':'net',list:[]};
}
/* the Team tab's headline expo: the church's nearest open expo while signed in, the built-in one otherwise */
const EXPO_DEFAULT={...EXPO_UPCOMING};
/* who can create, edit and delete Health Expos: an approved church admin, or the platform admin through All churches */
export const canManageExpos=()=>isAdminAcct()||!!(cloud.acct&&cloud.acct.platform_admin);
export function manageExpos(){
 hideModal('#volModal');
 if(!cloud.acct)return;
 openAcct(isAdminAcct()?'church':'admin');
}
export function syncExpoHeadline(){
 const L=openExpos().filter(x=>String(x.starts_on).slice(0,10)>=todayStr()).sort((a,b)=>String(a.starts_on).localeCompare(String(b.starts_on)));
 const x=L[0];
 if(!x){Object.assign(EXPO_UPCOMING,EXPO_DEFAULT);return;}
 Object.assign(EXPO_UPCOMING,{sample:false,id:x.id,name:x.name,venue:x.venue||x.address||'Venue to be announced',date:String(x.starts_on).slice(0,10),
  need:x.volunteers_needed>0?x.volunteers_needed:EXPO_DEFAULT.need});
}
async function loadExpos(){
 if(cloud.expoBusy)return;
 cloud.expoBusy=true;
 const r=await fetchExpos('');
 cloud.expoBusy=false;
 cloud.expos=r;syncExpoHeadline();
 cloud.acctV++;renderGate();
 renderAcct();render();
}
async function loadAdminExpos(cid){
 if(cloud.expoBusy===cid)return;
 cloud.expoBusy=cid;
 const r=await fetchExpos(cid);
 cloud.expoBusy=false;
 cloud.adminExpos={cid,...r};
 renderAcct();
}
export function acctRetry(what){
 if(what==='members')cloud.members=null;
 else if(what==='pAdmins')cloud.pAdmins=null;
 else if(what==='expos'){cloud.expos=undefined;cloud.adminExpos=undefined;}
 acctRedraw();
}
const reloadExpos=()=>{cloud.expos=undefined;cloud.adminExpos=undefined;acctRedraw();};

/* one expo as a card: the members' version, and the admin's with its status, stations and buttons */
function expoCard(x,admin){
 const need=Number(x.volunteers_needed)||0,got=Number(x.pledged)||0,pct=need?Math.min(100,Math.round(got*100/need)):0;
 const [stL,stC]=EXPO_ST[x.status]||[x.status,'watch'];
 const id=qSafe(x.id);
 const needs=x.station_needs||{},placed=x.placed||{};
 const stations=admin?BOOTHS.filter(b=>needs[b.k]).map(b=>`<div class="flex items-center justify-between gap-2 text-[11px] text-[#33504f]"><span class="min-w-0 truncate">${esc(b.label)}</span><span class="flex-none font-bold">${Number(placed[b.k])||0} of ${needs[b.k]} placed</span></div>`).join(''):'';
 const types=(x.doctor_types||[]).join(', ');
 const mine=cloud.pledge&&cloud.pledge.expo_id===x.id;
 return `<div class="border-t border-[#123033]/[.07] py-3">
  <div class="flex items-center gap-2"><div class="min-w-0 flex-1"><div class="text-[13px] font-bold leading-snug text-[#123033]">${esc(x.name)}</div>
   <div class="text-[11px] leading-snug text-[#4f6870]">${esc(expoDate(x))}${expoTime(x)?' · '+esc(expoTime(x)):''}</div></div>
   ${admin?`<span class="${chipClass(stC)} flex-none">${esc(stL)}</span>`:''}</div>
  ${x.venue||x.address?`<div class="mt-1 text-[11px] leading-snug text-[#4f6870]">${esc([x.venue,x.address].filter(Boolean).join(' · '))}</div>`:''}
  ${need?`<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#123033]/10"><div class="h-1.5 rounded-full bg-brand-500" style="width:${pct}%"></div></div>
   <div class="mt-1 text-[11px] font-bold text-[#33504f]">${got} of ${need} volunteers${got>=need?' — the team is full ✓':' — '+(need-got)+' still needed'}</div>`:''}
  ${stations?`<div class="mt-1.5 space-y-1">${stations}</div>`:''}
  <div class="mt-1.5 text-[11px] leading-snug text-[#4f6870]">${x.clinic?`Medical clinic: ${x.doctors?nOf(x.doctors,'doctor'):'doctors to be confirmed'}${types?' · '+esc(types):''}`:'No medical clinic'}</div>
  ${x.signup_deadline?`<div class="text-[11px] leading-snug ${expoClosed(x)?'font-bold text-rose-700':'text-[#4f6870]'}">${expoClosed(x)?'Sign-ups closed on ':'Sign up by '}${esc(expoDate({starts_on:x.signup_deadline}))}</div>`:''}
  ${admin?`<div class="mt-2 flex flex-wrap items-center gap-3">
    <button class="tap-link" data-action="expo-edit" data-args="${id}">Edit</button>
    ${x.status==='draft'?`<button class="tap-link text-brand-700" data-action="expo-status" data-args="${id}" data-status="open">Open for members</button>`
     :x.status==='open'?`<button class="tap-link" data-action="expo-status" data-args="${id}" data-status="done">Mark done</button>`
     :`<button class="tap-link" data-action="expo-status" data-args="${id}" data-status="open">Reopen</button>`}
    <button class="tap-link text-rose-700" data-action="expo-delete" data-args="${id}">Delete</button></div>`
  :mine?`<div class="mt-2 text-[11px] font-bold text-brand-700">You have pledged to this expo ✓</div>`
  :expoClosed(x)?'':`<button class="btn btn-primary mt-2 w-full py-2.5 text-xs" data-action="expo-pledge" data-args="${id}">${cloud.pledge?'Pledge to this expo instead':'Pledge to help at this expo'}</button>`}</div>`;
}
/* the members' view: only open expos, nothing at all when there are none */
export function expoMemberHTML(){
 const m=cloud.acct&&cloud.acct.membership;
 if(!m||m.status!=='approved')return '';
 if(cloud.expos===undefined){loadExpos();return '';}
 const L=cloud.expos.list.filter(x=>x.status==='open');
 return L.length?acctBox(L.length>1?'Health Expos':'Health Expo',L.map(x=>expoCard(x,false)).join('')):'';
}
export function pledgeToExpo(id){
 cloud.pledgeExpo=id;
 if(cloud.pledge)myPledgeEdit();else acctRedraw();
 const el=$('#mfName');if(el&&el.scrollIntoView)el.scrollIntoView({block:'center'});
}
/* the expo a pledge is for: the only open one, or the one the member chose */
const chosenExpo=()=>{const o=openExpos();return o.length===1?o[0].id:(o.some(x=>x.id===cloud.pledgeExpo)?cloud.pledgeExpo:(cloud.pledge&&cloud.pledge.expo_id)||'');};
function expoPickHTML(){
 const o=openExpos();
 if(!o.length)return '';
 if(o.length===1)return `<div class="text-[12px] font-bold text-brand-700">For ${esc(o[0].name)} · ${esc(expoDate(o[0]))}</div>`;
 const cur=chosenExpo();
 return `<label class="block"><span class="microlabel">Which expo are you pledging to?</span>
  <select data-on-change="expo-pick" aria-label="Which expo" class="field mt-1"><option value="" ${cur?'':'selected'}>Any — the church will tell me</option>
  ${o.map(x=>`<option value="${esc(x.id)}" ${x.id===cur?'selected':''}>${esc(x.name)} · ${esc(expoDate(x))}</option>`).join('')}</select></label>`;
}
export function pickExpo(v){cloud.pledgeExpo=v;}

/* the admin's side: the list, and one form for a new or changed expo */
export function expoAdminHTML(cid){
 if(cloud.expoEdit)return expoFormHTML();
 const E=cloud.adminExpos;
 if(!E||E.cid!==cid){loadAdminExpos(cid);return acctNote('Loading…');}
 return `${E.err==='schema'?acctNote('Health Expos need the latest supabase/schema.sql — ask the administrator to run it again.')
   :E.err?retryNote('Could not load the Health Expos. Check your connection.','expos')
   :E.list.length?E.list.map(x=>expoCard(x,true)).join(''):acctNote('No expo yet. Add one: members see it once it is open, and pledge to it.')}
  ${E.err?'':`<button class="btn btn-primary mt-3 w-full py-2.5 text-xs" data-action="expo-new" data-args="${qSafe(cid)}">+ New Health Expo</button>`}`;
}
const stationTotal=n=>Object.values(n||{}).reduce((t,v)=>t+(Number(v)||0),0);
export function newExpo(cid){
 const needs={};BOOTHS.forEach(b=>{needs[b.k]=b.cap;});
 cloud.expoEdit={id:'',church:cid,name:'',startsOn:'',startTime:'09:00',endTime:'14:00',venue:'',address:'',signupDeadline:'',
  needs,total:stationTotal(needs),totalTouched:false,clinic:false,doctors:0,types:[],status:'draft'};
 renderAcct();
}
export function editExpo(id){
 const x=((cloud.adminExpos&&cloud.adminExpos.list)||[]).find(e=>e.id===id);if(!x)return;
 cloud.expoEdit={id:x.id,church:cloud.adminExpos.cid,name:x.name,startsOn:String(x.starts_on||'').slice(0,10),startTime:x.start_time||'',endTime:x.end_time||'',
  venue:x.venue||'',address:x.address||'',signupDeadline:x.signup_deadline?String(x.signup_deadline).slice(0,10):'',needs:{...(x.station_needs||{})},
  total:Number(x.volunteers_needed)||0,totalTouched:true,clinic:!!x.clinic,doctors:Number(x.doctors)||0,types:[...(x.doctor_types||[])],status:x.status};
 renderAcct();
}
export function expoField(k,v){
 const d=cloud.expoEdit;if(!d)return;
 d[k]=v;
 if(k==='total')d.totalTouched=true;
 if(k==='clinic')renderAcct();            /* the clinic fields appear or go */
}
export function expoStation(k,v){
 const d=cloud.expoEdit;if(!d)return;
 const n=Math.max(0,Math.min(100,parseInt(v,10)||0));
 if(n)d.needs[k]=n;else delete d.needs[k];
 if(!d.totalTouched){d.total=stationTotal(d.needs);const t=$('#xpTotal');if(t)t.value=String(d.total);}   /* the total follows the stations until it is typed over */
}
export function expoType(t){
 const d=cloud.expoEdit;if(!d)return;
 const i=d.types.indexOf(t);if(i<0)d.types.push(t);else d.types.splice(i,1);
 renderAcct();
}
export function cancelExpo(){cloud.expoEdit=null;renderAcct();}
function expoFormHTML(){
 const d=cloud.expoEdit,f=(k,l,type,x)=>`<label class="block"><span class="microlabel">${l}</span><input data-on-input="expo-field" data-k="${k}" type="${type}" value="${esc(d[k]||'')}" class="field mt-1" ${x||''}></label>`;
 return `<div class="mt-2 space-y-3">
  ${f('name','Name of the expo *','text','maxlength="120" placeholder="e.g. Pinetown Health Expo 2027" autocomplete="off"')}
  ${f('startsOn','Date *','date')}
  ${f('signupDeadline','Volunteers must sign up by (optional)','date')}
  <div class="grid grid-cols-2 gap-2">${f('startTime','Starts','time')}${f('endTime','Ends','time')}</div>
  ${f('venue','Venue','text','maxlength="120" placeholder="e.g. Church hall" autocomplete="off"')}
  ${f('address','Address','text','maxlength="300" placeholder="Street, suburb, town" autocomplete="off"')}
  <label class="block"><span class="microlabel">Volunteers needed in total</span>
   <input id="xpTotal" data-on-input="expo-field" data-k="total" type="number" inputmode="numeric" min="0" max="1000" value="${Number(d.total)||0}" class="field mt-1"></label>
  <details class="rounded-[14px] border border-[#123033]/[.07] bg-white/50 p-2.5"><summary class="py-1.5 text-[12px] font-bold text-[#33504f]">Volunteers needed at each station</summary>
   <div class="mt-2 space-y-1.5">${BOOTHS.map(b=>`<label class="flex items-center gap-2"><span class="min-w-0 flex-1 truncate text-[12px] text-[#33504f]">${esc(b.label)}</span>
    <input data-on-input="expo-station" data-k="${esc(b.k)}" type="number" inputmode="numeric" min="0" max="100" value="${d.needs[b.k]||0}" aria-label="${esc(b.label)} volunteers" class="field flex-none" style="width:4.5rem"></label>`).join('')}</div>
   ${acctNote('Each station starts at its usual size. The total above follows these numbers until you type your own.')}</details>
  <label class="flex items-center gap-2.5 py-1.5 text-[12px] font-bold text-[#33504f]"><input type="checkbox" data-on-change="expo-check" ${d.clinic?'checked':''} class="h-5 w-5 flex-none"> A medical clinic will take part</label>
  ${d.clinic?`<div class="rounded-[14px] border border-[#123033]/[.07] bg-white/50 p-2.5">
   <label class="block"><span class="microlabel">How many doctors will be there?</span>
    <input data-on-input="expo-field" data-k="doctors" type="number" inputmode="numeric" min="0" max="100" value="${Number(d.doctors)||0}" class="field mt-1"></label>
   <div class="mt-2"><span class="microlabel">What kind of doctors?</span>
    <div class="mt-1.5 flex flex-wrap gap-2">${DOCTOR_TYPES.map(t=>`<button type="button" data-action="expo-type" data-args="${esc(t)}" aria-pressed="${d.types.includes(t)}" class="availpill hue-aqua ${d.types.includes(t)?'availpill-on':''}">${esc(t)}</button>`).join('')}</div></div></div>`:''}
  <button type="button" id="xpGo" data-action="expo-save" data-status="${d.id&&d.status!=='draft'?d.status:'open'}" class="btn btn-primary w-full py-3 text-sm">${d.id?(d.status==='draft'?'Save and open for members':'Save changes'):'Save and open for members'}</button>
  ${!d.id||d.status==='draft'?`<button type="button" data-action="expo-save" data-status="draft" class="btn btn-glass w-full py-2.5 text-xs">Save as a draft (only admins see it)</button>`:''}
  <button type="button" data-action="expo-cancel" class="tap-link w-full justify-center">Cancel</button></div>`;
}
export async function saveExpoForm(status){
 const d=cloud.expoEdit;if(!d)return;
 if(String(d.name||'').trim().length<2){toast('Enter the expo’s name.');return;}
 if(!d.startsOn){toast('Choose the date of the expo.');return;}
 if(d.startTime&&d.endTime&&d.endTime<=d.startTime){toast('The end time is before the start time.');return;}
 if(d.signupDeadline&&d.signupDeadline>d.startsOn){toast('The sign-up deadline is after the expo.');return;}
 if(cloud.expoSaving)return;                 /* a second tap while the first is in flight would create the expo twice */
 cloud.expoSaving=true;
 const b0=$('#xpGo'),was=b0?b0.textContent:'';
 gateBusy('xp','Saving…');
 const r=await acctRpc('save_expo',{p:{id:d.id||'',church:d.church||'',name:d.name,startsOn:d.startsOn,startTime:d.startTime||'',endTime:d.endTime||'',venue:d.venue||'',
   address:d.address||'',volunteersNeeded:d.total||0,stationNeeds:d.needs,clinic:!!d.clinic,doctors:d.doctors||0,doctorTypes:d.types,signupDeadline:d.signupDeadline||'',status:status||d.status}},
  status==='open'&&d.status!=='open'?'Saved — members can see it now ✓':'Saved ✓');
 cloud.expoSaving=false;
 const b=$('#xpGo');if(b){b.disabled=false;b.textContent=was||'Save and open for members';}
 if(!r)return;
 cloud.expoEdit=null;reloadExpos();
}
export async function setExpoStatus(id,status){
 const x=((cloud.adminExpos&&cloud.adminExpos.list)||[]).find(e=>e.id===id);if(!x)return;
 const r=await acctRpc('save_expo',{p:{id,name:x.name,startsOn:String(x.starts_on).slice(0,10),startTime:x.start_time||'',endTime:x.end_time||'',venue:x.venue||'',address:x.address||'',
   volunteersNeeded:x.volunteers_needed,stationNeeds:x.station_needs||{},clinic:!!x.clinic,doctors:x.doctors,doctorTypes:x.doctor_types||[],
   signupDeadline:x.signup_deadline?String(x.signup_deadline).slice(0,10):'',status}},status==='open'?'Open — members can see it ✓':'Marked done ✓');
 if(r)reloadExpos();
}
export async function deleteExpoAsk(id){
 const x=((cloud.adminExpos&&cloud.adminExpos.list)||[]).find(e=>e.id===id)||{};
 const yes=await confirmAsk({title:`Delete ${x.name||'this expo'}?`,body:'It disappears for everyone. Volunteers who pledged to it stay on your team list.',label:'Delete',danger:true});
 if(!yes)return;
 if(await acctRpc('delete_expo',{p_id:id},'Expo deleted'))reloadExpos();
}

/* --- the platform admin: every church --- */
export const nOf=(n,w)=>n+' '+w+(Number(n)===1?'':'s');
export function platformHTML(){
 if(cloud.adminData)return adminDataHTML();
 if(cloud.plat===null){loadPlatform();return acctNote('Loading…');}
 const L=cloud.plat,n=s=>L.filter(c=>c.status===s).length,sum=k=>L.reduce((t,c)=>t+(Number(c[k])||0),0);
 const tile=(l,v)=>`<div class="tile"><span class="tile-l">${l}</span><span class="tile-v">${v}</span></div>`;
 if(cloud.audit===null)loadAudit();
 return `<div class="grid grid-cols-3 gap-2">${tile('Churches',L.length)}${tile('Waiting',n('pending'))}${tile('Members',sum('members'))}</div>
  ${acctBox('Churches',!L.length?acctNote('No church has registered yet.'):L.map(churchRow).join(''))}
  ${platformAdminsHTML()}
  ${acctBox('Recent changes',!cloud.audit?acctNote('Loading…'):!cloud.audit.length?acctNote('Nothing changed yet.')
   :cloud.audit.map(x=>`<div class="leading-snug border-t border-[#123033]/[.07] py-1.5 text-[11px] text-[#33504f]">${esc(String(x.at||'').slice(0,16).replace('T',' '))} · ${esc(x.church||'—')} · ${esc(x.actor||'?')} · ${esc(String(x.op||'').toLowerCase())} ${x.tbl==='platform_admins'?'platform admin':x.tbl==='attendees'?'visitor':'volunteer'} ${esc(x.row_id||'')}</div>`).join(''))}`;
}
/* the platform admins: who they are, and add one by email. The first is made once in the SQL editor; removing one is not in the app yet. */
function platformAdminsHTML(){
 if(cloud.pAdmins===null){loadPlatformAdmins();return acctBox('Platform admins',acctNote('Loading…'));}
 const L=cloud.pAdmins,me=cloud.acct&&cloud.acct.user_id;
 if(cloud.pAdminsErr)return acctBox('Platform admins',retryNote('Could not load the platform admins. Check your connection.','pAdmins'));
 return acctBox('Platform admins',`${acctNote('Platform admins approve churches and can open every church. Add someone who already has an account in this app with a confirmed email.')}
  ${L.map(p=>`<div class="flex items-center gap-2 border-t border-[#123033]/[.07] py-2">
    <div class="min-w-0 flex-1 truncate text-[13px] font-bold text-[#123033]">${esc(p.email||'')}${p.user_id===me?' <span class="font-semibold text-[#667d83]">(you)</span>':''}</div>
    </div>`).join('')}
  <form data-action="padmin-add" class="mt-2 flex gap-2">
   <input id="paEmail" type="email" inputmode="email" autocomplete="off" required maxlength="254" placeholder="their email address" aria-label="Email of the new platform admin" class="field min-w-0 flex-1">
   <button id="paGo" class="btn btn-primary flex-none px-4 py-2 text-xs">Add</button></form>`);
}
async function loadPlatformAdmins(){
 if(cloud.pAdminsBusy)return;
 cloud.pAdminsBusy=true;
 const r=await acctRpc('admin_platform_admins');
 cloud.pAdminsBusy=false;
 cloud.pAdmins=r&&Array.isArray(r.data)?r.data:[];cloud.pAdminsErr=!(r&&Array.isArray(r.data));
 renderAcct();
}
export async function addPlatformAdmin(e){
 e.preventDefault();
 const em=(($('#paEmail')||{}).value||'').trim();
 if(!validEmail(em)){toast('Enter their email address.');return;}
 const b=$('#paGo');if(b){b.disabled=true;b.textContent='…';}
 const r=await acctRpc('admin_add_platform_admin',{p_email:em},em+' is now a platform admin ✓');
 if(!r){if(b){b.disabled=false;b.textContent='Add';}return;}
 cloud.pAdmins=null;cloud.audit=null;renderAcct();
}
function churchRow(c){
 const id=qSafe(c.id);
 return `<div class="border-t border-[#123033]/[.07] py-2.5">
  <div class="flex items-center gap-2"><div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(c.name)}</div>
   <div class="text-[11px] leading-snug text-[#4f6870]">${esc(c.city||'—')} · ${nOf(c.members,'member')} · ${c.staff} staff · ${nOf(c.visitors,'visitor')} · ${nOf(c.volunteers,'volunteer')}${c.pending?' · '+c.pending+' waiting':''}</div></div>
   <span class="${chipClass(c.status==='active'?'ok':c.status==='pending'?'watch':'flag')}">${CHURCH_L[c.status]||esc(c.status)}</span></div>
  <div class="mt-1.5 flex flex-wrap items-center gap-2">
   ${c.status==='active'?`<button class="tap-link text-rose-700" data-action="church-status" data-args="${id}" data-status="suspended">Pause</button>`
    :`<button class="btn btn-primary px-4 py-1.5 text-xs" data-action="church-status" data-args="${id}" data-status="active">${c.status==='pending'?'Approve':'Reactivate'}</button>`}
   <button class="tap-link" data-action="openChurchData" data-args="${id}">Data</button>
   <button class="tap-link" data-action="manageChurch" data-args="${id}">Members & details</button></div></div>`;
}
/* the owner's read-only look at one church's visitors and volunteers (admin_church_data) */
export function openChurchData(id){cloud.adminData=id;cloud.adminRows=null;renderAcct();}
export function adminDataHTML(){
 const c=(cloud.plat||[]).find(x=>x.id===cloud.adminData)||{id:cloud.adminData,name:''};
 if(!cloud.adminRows)loadChurchData(cloud.adminData);
 const d=cloud.adminRows,when=s=>esc(String(s||'').slice(0,10));
 return `<button data-action="all-churches-back" class="tap-link">← All churches</button>
  <div class="mt-1 text-[13px] font-bold text-[#123033]">${esc(c.name||'Church')}</div>
  ${acctNote('Read-only. The medical readings stay in the Supabase dashboard, which only you can open.')}
  ${!d?acctNote('Loading…'):d.error?acctNote('Could not load this church’s data. Check your connection and try again.')
   :`${acctBox('Visitors'+(d.visitor_count?` · ${d.visitor_count}`:''),d.visitors.length?d.visitors.map(a=>`
   <div class="border-t border-[#123033]/[.07] py-2">
    <div class="flex items-center gap-2"><div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(a.name)}</div>
     <div class="truncate text-[11px] text-[#4f6870]">${esc(a.id)}${a.phone?' · '+esc(a.phone):''}${a.email?' · '+esc(a.email):''}</div></div>
     <span class="${chipClass(a.done?'ok':'watch')}">${a.done?'Done':'In progress'}</span></div>
    <div class="text-[10px] text-[#8a9aa0]">visited ${when(a.created_at)}${a.updated_at&&a.updated_at!==a.created_at?' · updated '+when(a.updated_at):''}</div></div>`).join('')
    :acctNote('No visitors yet.'))}
   ${acctBox('Volunteers'+(d.volunteer_count?` · ${d.volunteer_count}`:''),d.volunteers.length?d.volunteers.map(v=>`
   <div class="border-t border-[#123033]/[.07] py-2">
    <div class="flex items-center gap-2"><div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(v.name)}</div>
     <div class="truncate text-[11px] text-[#4f6870]">${esc(v.id)}${v.phone?' · '+esc(v.phone):''}${v.email?' · '+esc(v.email):''}</div></div>
     <span class="${chipClass(v.status==='checkedin'?'ok':'watch')}">${esc(v.status||'')}</span></div>
    <div class="text-[10px] text-[#8a9aa0]">joined ${when(v.created_at)}</div></div>`).join('')
    :acctNote('No volunteers yet.'))}`}`;
}
async function loadChurchData(cid){
 if(!cid||!cloud.client||cloud.adminRowsBusy===cid)return;
 cloud.adminRowsBusy=cid;
 const r=await acctRpc('admin_church_data',{p_church:cid});
 cloud.adminRowsBusy='';
 cloud.adminRows=r&&r.data&&typeof r.data==='object'?r.data:{visitor_count:0,volunteer_count:0,visitors:[],volunteers:[],error:true};
 renderAcct();
}
async function loadPlatform(){
 if(cloud.platBusy)return;
 cloud.platBusy=true;
 const r=await acctRpc('admin_churches');
 cloud.platBusy=false;
 cloud.plat=r&&Array.isArray(r.data)?r.data:[];
 renderAcct();
}
async function loadAudit(){
 if(cloud.auditBusy)return;
 cloud.auditBusy=true;
 const r=await acctRpc('admin_audit',{p_limit:30});
 cloud.auditBusy=false;
 cloud.audit=r&&Array.isArray(r.data)?r.data:[];
 renderAcct();
}
export async function setChurchStatus(id,st){
 const c=(cloud.plat||[]).find(x=>x.id===id)||{};
 if(st==='suspended'){
  const yes=await confirmAsk({title:`Pause ${c.name||'this church'}?`,
   body:'Its staff lose access to its visitors and volunteers until you reactivate it.',label:'Pause',danger:true});
  if(!yes)return;
 }
 if(!await acctRpc('admin_set_church_status',{p_church:id,p_status:st},st==='active'?'Church approved ✓':'Church paused'))return;
 await loadPlatform();
 if(cloud.churchId===id||(cloud.acct&&cloud.acct.church&&cloud.acct.church.id===id))await cloudSync(true);
}
export function manageChurch(id){cloud.adminChurch=id;openAcct('church');}

/* ---------- start-up and sign-in ---------- */
/* Someone waiting to be approved should not have to press Check again: when the app comes back to the front (or the
   network returns) it asks once, at most every 15 seconds. No timer runs, so a phone in a pocket does no work. */
let _waitAt=0;
export function checkWhileWaiting(){
 if(document.hidden||!cloud.user||!cloud.acct||cloud.busy)return;
 const m=cloud.acct.membership,c=cloud.acct.church;
 const waiting=!!m&&(m.status==='pending'||(!!c&&c.status!=='active'));
 if(!waiting||Date.now()-_waitAt<15000)return;
 _waitAt=Date.now();
 cloudSync(true);
}
export async function cloudInit(){
 if(cloud.client||cloud.starting)return;
 cloud.starting=true;setCloud('loading');
 try{
  if(!window.supabase)await loadScript(SB_LIB);
  if(!window.supabase||!window.supabase.createClient)throw new Error('library missing');
 }catch(e){cloud.starting=false;noteHealth('auth','bad','The sign-in service did not load, usually because there is no internet. Connect, then reopen the app.',String((e&&e.message)||e));setCloud(cloud.mode?'offline':'unavailable');return;}
 cloud.client=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 /* never await Supabase calls inside this callback — hand off to a timer */
 cloud.client.auth.onAuthStateChange((ev,session)=>setTimeout(()=>cloudAuthEvent(ev,session),0));
 try{document.addEventListener('visibilitychange',checkWhileWaiting);addEventListener('online',checkWhileWaiting);}catch(e){/* no page events here */};
 cloud.starting=false;
}
export function cloudAuthEvent(ev,session){
 const u=session&&session.user;
 /* the link in a "reset password" email opens the app signed in; hold the gate until a new password is saved */
 if(ev==='PASSWORD_RECOVERY'){cloud.recovery=true;cloud.gateKey='';}
 if(u){
  const same=cloud.user&&cloud.user.id===u.id;
  cloud.user=u;cloud.gateForce=false;noteHealth('auth','ok','Signed in as '+(u.email||''));
  if(!same){cloud.mode=true;cloud.blocked=false;cloud.lastFull=0;cloud.since={att:'',vol:''};cloudSync();profileChanged(true);}
 }else if(ev==='SIGNED_OUT'||ev==='INITIAL_SESSION'){
  /* A session that ends while the desk is open (expired, or revoked elsewhere) puts the sign-in gate back up:
     on a shared desk the next person must not continue in the previous operator's copy, and "Back to the app"
     must not wave them in — dropping cloud.ready removes the Back control too (gateState). A desk that starts
     without a session was never open for anyone, so the boot path (saved copy, no gate) is untouched. */
  const wasIn=!!cloud.user;
  if(wasIn){cloud.user=null;stopRealtime();notifStop();cloudRefresh();
   applyRetention();afterMerge();persistNow();      /* the server may already have purged these readings; the saved copy follows */
   cloud.ready=false;}
  healthReset();noteHealth('auth','off','Not signed in.');
  if(ev==='SIGNED_OUT'&&wasIn&&!cloud.signingOut)toast('Signed out — tap the logo to sign in again');
  setCloud('signedout');
 }
}
export async function cloudSignIn(e){
 e.preventDefault();
 if(!cloud.client)return;
 /* the same handler serves the full-screen gate (data-pre="gate") and the sheet behind the logo */
 const pre=(e.target&&e.target.dataset&&e.target.dataset.pre)||'cloud';
 const em=($('#'+pre+'Email').value||'').trim(),pw=$('#'+pre+'Pass').value;
 const fail=m=>{cloud.formErr=m;cloud.gateKey='';renderCloudBody();renderGate();profFail();};
 if(!em||!pw){fail('Enter your staff email and password.');return;}
 const go=$('#'+pre+'Go');if(go){go.disabled=true;go.textContent='Signing in…';}
 let res;
 try{res=await cloud.client.auth.signInWithPassword({email:em,password:pw});}catch(err){res={error:err};}
 const msg=res.error?String(res.error.message||''):'';
 if(res.error){
  /* signed up but never clicked the e-mailed link: send them to the screen that can resend it */
  if(res.error.code==='email_not_confirmed'||/email not confirmed/i.test(msg)){
   cloud.viewEmail=em;cloud.view='verify';cloud.formErr='Your email is not confirmed yet. Open the link we emailed you, then sign in.';cloud.gateKey='';if(pre==='pf'){cloud.gateForce=true;profIdle('pfGo');}renderGate();return;
  }
  fail(/invalid login/i.test(msg)?'Wrong email or password.':isNet(msg)?'No connection — try again when you are online.':(msg||'Sign-in failed.'));
  return;
 }
 cloud.formErr='';closeCloud();
}
export async function cloudSignOut(force){
 const n=cloudPending();
 if(!force){
  const yes=await confirmAsk(n
   ?{title:'Sign out with unsaved changes?',body:`${n} change${n>1?'s':''} on this device ${n>1?'have':'has'} not been uploaded yet and will be lost.`,label:'Sign out',danger:true}
   :{title:'Sign out?',body:'The visitor and volunteer data stored on this device will be cleared.',label:'Sign out',danger:true});
  if(!yes)return;
 }
 clearTimeout(cloud.pushT);clearTimeout(cloud.retryT);stopRealtime();
 cloud.signingOut=true;
 try{await cloud.client.auth.signOut({scope:'local'});}catch(e){}
 cloud.signingOut=false;cloud.ready=false;cloud.demo=false;cloud.gateHide=false;cloud.gateKey='';cloud.isAdmin=undefined;cloud.pendingUsers=null;
 Object.assign(EXPO_UPCOMING,EXPO_DEFAULT);
 cloud.acct=null;cloud.churchId='';cloud.health=undefined;cloud.dir=null;cloud.regChurch=false;cloud.members=null;cloud.plat=null;cloud.audit=null;cloud.pAdmins=null;cloud.expos=undefined;cloud.adminExpos=undefined;cloud.expoEdit=null;cloud.pledgeExpo='';cloud.adminChurch='';cloud.adminData='';cloud.adminRows=null;closeAcct();
 cloud.view='login';cloud.viewEmail='';cloud.pending=false;cloud.recovery=false;cloud.formErr='';cloud.gateForce=false;cloud.delOpen=false;
 cloud.plans=null;cloud.adminPlans=null;cloud.planEdit=null;try{localStorage.removeItem(CHURCH_PLANS_KEY);}catch(e){}
 cloud.followups=null;cloud.adminFollowups=null;cloud.myFollow=null;cloud.inviteLink=null;clearInvite();   /* a stale invite link must not join the next account on this desk */
 cloud.user=null;cloud.mode=false;cloud.blocked=false;cloud.synced={att:{},vol:{}};cloud.rejected={};cloud.rejectedNote=null;cloud.lastFull=0;cloud.since={att:'',vol:''};
 cloud.phase='';cloud.prog={done:0,total:0};cloud.syncedAt=0;   /* the status chrome starts clean for the next account */
 try{localStorage.removeItem(SYNC_KEY);localStorage.removeItem(CHURCH_KEY);}catch(e){}
 resetLedgerSig();
 seedDemo();state.sugFor=null;state._goal=null;state.tab=state.tab==='me'?'me':'home';
 closeCloud();render();setCloud('signedout');toast('Signed out — sign in again, or open the practice sandbox');
}

/* ---------- pull, merge, push ---------- */
/* The place-guard trigger answers 42501 with hint 'place_guard'. The message test keeps a database that has not
   been updated yet working. Either way it is one row another desk has moved, not a bad sign-in. */
const isPlaceRefusal=e=>!!e&&e.code==='42501'&&(e.hint==='place_guard'||/may place volunteers|choose team leaders/i.test(e.message||''));
function cloudError(err,where){
 console.warn('cloud sync:',err);
 healthFromError(where||'sync',err);
 if(where!=='upload'&&isOfflineErr(err&&err.message))healthUpload();
 const msg=String((err&&err.message)||err||'');
 if(!navigator.onLine||/failed to fetch|networkerror|load failed|network request/i.test(msg)){
  setCloud('offline');clearTimeout(cloud.retryT);cloud.retryT=setTimeout(()=>cloudSync(),20000);return;
 }
 if(err&&(err.code==='PGRST205'||err.code==='PGRST202'||/schema cache|could not find the (table|function)/i.test(msg)))
  {cloud.blocked=true;setCloud('error','The database tables are not set up yet. Run supabase/schema.sql in the Supabase SQL editor.');return;}
 /* the place guard also answers 42501, but that is one row another desk has already moved, not a bad sign-in */
 if(err&&(err.code==='42501'||/row-level security|permission denied/i.test(msg))&&!isPlaceRefusal(err))
  {cloud.blocked=true;setCloud('error','This sign-in is not on the staff list yet. Ask the administrator to add it (step 3 at the bottom of supabase/schema.sql).');return;}
 /* the raw message is already in Details (healthFromError put it there): the status line keeps calm words */
 setCloud('error','Sync hit a problem. It retries by itself — Details has the technical bit.');
 clearTimeout(cloud.retryT);cloud.retryT=setTimeout(()=>cloudSync(),60000);
}
export async function cloudSync(manual){
 if(!cloud.client||!cloud.user)return;
 if(cloud.busy){cloud.again=true;return;}
 if(manual)cloud.blocked=false;
 cloud.busy=true;cloud.phase='pull';cloud.prog={done:0,total:0};setCloud('syncing');
 try{
  if(!await loadAccount()){
   cloud.blocked=true;cloud.pending=true;
   noteHealth('sync','off','This account has no expo data access, so nothing is downloaded.');noteHealth('upload','off','Nothing to upload for this account.');
   if(cloud.acct){dropChurchData();cloud.ready=false;}      /* the database says no expo access: the saved copy goes too */
   setCloud('error',cloud.acct?ACCT_MSG[acctGate()]:'This account is not approved yet. Ask the administrator to add it to the staff list (see supabase/README.md).');
   notifWatch();return;
  }
  cloud.pending=false;
  /* A device signing in for the first time may carry edited demo rows. Their ids sit inside the normal numbering
     space, but a real visitor registered before the first sign-in is always numbered above the demo data, and an
     explicit sign-out wipes the device — so here, and only here, "a seed id that was never uploaded" is practice
     data, which must not ride into the real church. Re-signing in after a lost session keeps its saved copy: the
     church key survives that, so this purge does not run and unsynced real work is safe. */
  try{if(!localStorage.getItem(CHURCH_KEY)){
   for(const kind of ['att','vol']){const k=KINDS[kind];
    for(let i=k.list.length-1;i>=0;i--){const o=k.list[i];
     if(cloud.synced[kind][o.id]===undefined&&isDirty(kind,o)&&k.seed.some(x=>x.id===o.id)){k.list.splice(i,1);delete cloud.synced[kind][o.id];}}
   }
  }}catch(e){}
  if(cloud.acct)adoptChurch(cloud.churchId);
  /* A full pull on sign-in, "Sync now" and every 10 minutes (it is the only way to notice rows deleted on another
     desk); in between, only rows changed since the last pull. */
  const full=!!manual||!cloud.lastFull||Date.now()-cloud.lastFull>600000;
  const [ra,rv]=await Promise.all([fetchRows('attendees',full?'':cloud.since.att),fetchRows('volunteers',full?'':cloud.since.vol)]);
  const changed=mergeRemote('att',ra,full)|mergeRemote('vol',rv,full);
  noteSince('att',ra);noteSince('vol',rv);
  if(full)cloud.lastFull=Date.now();
  /* the same 7-day rule the database applies, on this device, before anything is uploaded: an old record is cleared
     (or dropped) here rather than being sent back after the purge */
  const pruned=applyRetention();
  if(pruned&&!attendees.some(a=>a.id===state.activeId))state.activeId=(attendees[0]||{}).id||'';
  cloud.phase='push';
  await pushDirty();
  afterMerge();saveSynced();persistNow();
  startRealtime();
  queueSync();                    /* separate from the visitor sync: a queue problem must never block it */
  setCloud('online');noteHealth('sync','ok',`Up to date: ${attendees.length} visitors, ${volunteers.length} volunteers.`);healthUpload();
  if(changed||manual)cloudRefresh();
 }catch(err){cloudError(err);}
 finally{
  cloud.busy=false;cloud.phase='';
  syncChrome();                    /* the ring and badge settle even when no setCloud ran (nothing to upload) */
  if(cloud.status==='online')cloud.ready=true;      /* the first successful sync lifts the sign-in gate */
  renderGate();
  if(cloud.again){cloud.again=false;cloudQueuePush();}
 }
}
/* Supabase answers at most 1000 rows per request, so read in pages. Reading everything in one request
   would silently stop at row 1000 and the merge below would then treat every later visitor as deleted. */
export async function fetchRows(table,since){
 const PAGE=500,rows=[];
 for(let page=0;page<400;page++){
  let q=cloud.client.from(table).select('*');
  q=since?q.gte('updated_at',since).order('updated_at').order('id'):q.order('created_at').order('id');
  const {data,error}=await q.range(page*PAGE,page*PAGE+PAGE-1);
  if(error)throw error;
  rows.push(...data);
  if(data.length<PAGE)return rows;
 }
 throw new Error('Too many rows to sync in one go');
}
function noteSince(kind,rows){for(const r of rows)if(r.updated_at&&r.updated_at>cloud.since[kind])cloud.since[kind]=r.updated_at;}
/* remote rows overwrite local ones that have no pending edit; local pending edits win and are uploaded.
   `full` = rows is the complete table, so a local row missing from it was deleted elsewhere. */
export function mergeRemote(kind,rows,full=true){
 if(!rows.length&&!full)return 0;                     /* nothing changed anywhere: skip re-reading every local row */
 const k=KINDS[kind],sy=cloud.synced[kind],remote=new Map(rows.map(r=>[r.id,r]));
 const at=new Map(k.list.map((o,i)=>[o.id,i]));       /* id → position, so a big list is not searched once per row */
 /* a full pull needs to know every pending row (to keep local edits when deleting what is gone elsewhere); a small
    incremental pull only needs to ask about the rows that arrived */
 const dirtyAll=full?new Set(cloudDirtyList(kind).map(o=>o.id)):null;
 const pending={has:id=>{if(dirtyAll)return dirtyAll.has(id);const i=at.get(id);return i!==undefined&&isDirty(kind,k.list[i]);}};
 let changed=0;
 for(const [id,row] of remote){
  const obj=k.fromRow(row),s=sigOf(k.toRow(obj)),i=at.has(id)?at.get(id):-1;
  if(i<0){at.set(id,k.list.length);k.list.push(obj);sy[id]=s;changed=1;}
  else if(!pending.has(id)){
   if(sigOf(k.toRow(k.list[i]))!==s){k.list.splice(i,1,obj);changed=1;}
   sy[id]=s;
  }
 }
 for(let i=full?k.list.length-1:-1;i>=0;i--){
  const o=k.list[i];
  if(remote.has(o.id))continue;
  if(!pending.has(o.id)){k.list.splice(i,1);delete sy[o.id];changed=1;}   /* demo leftovers, or deleted on another desk */
  else delete sy[o.id];                                                    /* edited here but gone there: upload it again */
 }
 return changed;
}
/* Rows go up in batches of PUSH_BATCH (one request per row took minutes to catch up after a stretch offline). If the server
   refuses a batch for any reason, the rows are sent one at a time so a bad row, or an id already taken, is handled exactly
   as before. */
const PUSH_BATCH=100;
async function pushDirty(){
 /* the progress the status line shows: a fixed total taken now, ticked up as batches land (observe-only —
    the upload order and requests are exactly as before) */
 const lists={att:cloudDirtyList('att'),vol:cloudDirtyList('vol')};   /* one snapshot, same rows and order as before */
 cloud.prog={done:0,total:lists.att.length+lists.vol.length};
 syncChrome();
 for(const kind of ['att','vol']){
  const k=KINDS[kind],sy=cloud.synced[kind],list=lists[kind];
  const groups=[[list.filter(o=>sy[o.id]!==undefined),false],[list.filter(o=>sy[o.id]===undefined),true]];
  for(const [group,isFresh] of groups){
   for(let i=0;i<group.length;i+=PUSH_BATCH){
    const chunk=group.slice(i,i+PUSH_BATCH);
    if(chunk.length>1){
     const rows=chunk.map(o=>k.toRow(o)),sigs=rows.map(sigOf);
     const {error}=await (isFresh?cloud.client.from(k.table).insert(rows.map(inChurch)):cloud.client.from(k.table).upsert(rows.map(inChurch),{onConflict:conflictOn()}));
     if(!error){chunk.forEach((o,j)=>{sy[o.id]=sigs[j];});cloud.prog.done+=chunk.length;syncChrome();continue;}
    }
    for(const o of chunk){await pushOne(kind,o);cloud.prog.done++;}   /* refused rows count as handled */
    syncChrome();                                                     /* once per chunk, never once per row */
   }
  }
 }
 syncChrome();
}
async function pushOne(kind,o,again){
 const k=KINDS[kind],row=k.toRow(o),s=sigOf(row),fresh=cloud.synced[kind][o.id]===undefined;
 const q=fresh?cloud.client.from(k.table).insert(inChurch(row)):cloud.client.from(k.table).upsert(inChurch(row),{onConflict:conflictOn()});
 const {error}=await q;
 if(!error){
  cloud.synced[kind][o.id]=s;
  if(cloud.rejected[o.id]!==undefined){            /* an edit after a refusal went through: the refusal is over */
   delete cloud.rejected[o.id];
   if(cloud.rejectedNote&&cloud.rejectedNote.id===o.id)cloud.rejectedNote=null;
  }
  return;
 }
 if(fresh&&error.code==='23505')return resolveConflict(kind,o,s);
 /* one row's station was changed on another desk: take the server's placement, keep this phone's other edits,
    and try once more. Never let it stop the rest of the desk (it used to set cloud.blocked). */
 const placeRefused=isPlaceRefusal(error);
 if(placeRefused&&!again&&kind==='vol'&&await resolvePlacement(o))return;
 if(/^2[23]/.test(error.code||'')||placeRefused){           /* data the database refuses: skip this row, keep syncing the rest */
  cloud.rejected[o.id]=s;cloud.rejectedNote={id:o.id,msg:String(error.message||'')};
  toast(`${o.id} was not uploaded: ${error.message}`);return;
 }
 throw error;
}
/* the server's placement wins over a stale copy; the local name, notes and other edits are kept */
async function resolvePlacement(o){
 let q=cloud.client.from('volunteers').select('*').eq('id',o.id);
 if(cloud.churchId)q=q.eq('church_id',cloud.churchId);      /* ids repeat across churches; RLS already scopes this */
 let r;try{r=await q.maybeSingle();}catch(e){return false;}
 if(r.error||!r.data)return false;
 const srv=KINDS.vol.fromRow(r.data);
 o.booth=srv.booth;o.lead=!!srv.lead;o.role=srv.role||'';o.status=srv.status||o.status;
 o.registeredOn=srv.registeredOn;o.checkedIn=!!srv.checkedIn;
 await pushOne('vol',o,true);
 return true;
}
/* the id is already taken on the server */
/* Visitor numbers are given by each phone, so two desks registering at the same moment can pick the same one. They are
   two different people: the one uploaded second takes the next number free on the server and on this phone, and the
   volunteer is told the new number. This is the visitor's first upload, so only a queue place taken in the second
   before it would still carry the old number. */
async function renumberVisitor(o){
 const ids=await cloud.client.from('attendees').select('id');
 if(ids.error)throw ids.error;
 const num=id=>{const m=/^EXPO-(\d+)$/.exec(String(id));return m?+m[1]:0;};
 const max=Math.max(0,...ids.data.map(r=>num(r.id)),...attendees.map(a=>num(a.id)));
 const old=o.id;o.id='EXPO-'+String(max+1).padStart(3,'0');
 if(state.activeId===old)state.activeId=o.id;
 toast(`Another desk gave out ${old} at the same moment: this visitor is now ${o.id}`);
 return pushOne('att',o);
}
async function resolveConflict(kind,o,s){
 const k=KINDS[kind];
 const {data,error}=await cloud.client.from(k.table).select('*').eq('id',o.id).maybeSingle();
 if(error)throw error;
 if(data&&sigOf(k.toRow(k.fromRow(data)))===s){cloud.synced[kind][o.id]=s;return;}   /* an earlier upload of this very row */
 if(kind==='att')return renumberVisitor(o);
 /* two desks pledged at the same moment: take the next free volunteer number */
 const ids=await cloud.client.from('volunteers').select('id');
 if(ids.error)throw ids.error;
 const max=Math.max(1000,...ids.data.map(r=>parseInt(String(r.id).replace(/\D/g,''),10)||0),...volunteers.map(v=>parseInt(String(v.id).replace(/\D/g,''),10)||0));
 const old=o.id;o.id='VOL-'+(max+1);
 if(state.volId===old)state.volId=o.id;
 return pushOne(kind,o);
}
export function afterMerge(kind){
 if(!kind||kind==='att')if(!attendees.some(a=>a.id===state.activeId))state.activeId=(attendees[0]||{}).id||'';
 if(!kind||kind==='vol'){
  if(!state.volNew&&!volunteers.some(v=>v.id===state.volId))state.volId=(volunteers[0]||{}).id||null;
  if(cloud.user){let m=1000;for(const v of volunteers){const n=parseInt(String(v.id).replace(/\D/g,''),10)||0;if(n>m)m=n;}state._volSeq=m+1;}
 }
}
/* A visitor who wandered off: removed from the shared database first, then from this device. Church admins and team
   leaders may (remove_visitor checks the same in the database and answers false when it refuses). */
export async function removeVisitorAsk(id){
 const visitor=attendees.find(x=>x.id===id);
 if(!visitor)return;
 if(cloud.removing===id)return;                       /* a second tap while the first is still in flight */
 const isShared=!!cloud.user;
 if(isShared&&!mayPlace()){toast('Only your church’s admins and team leaders can remove a visitor');return;}
 cloud.removing=id;
 try{
  const yes=await confirmAsk({title:`Remove ${visitor.name||id}?`,
   body:isShared?'Their passport and readings are deleted for every desk in your church. This cannot be undone.'
    :'Their passport and readings are deleted from this device. This cannot be undone.',
   label:'Remove',danger:true});
  if(!yes)return;
  // 1. The shared copy, when there is one
  const isOnServer=isShared&&cloud.synced.att[id]!==undefined;
  if(isOnServer){
   const client=cloud.client;
   if(!client){toast('Removing a visitor needs a connection — try again when you are online.');return;}
   let res;
   try{res=await client.rpc('remove_visitor',{p_id:id});}catch(e){res={error:e};}
   const {data,error}=res;
   if(error){toast(isNet(error.message)?'Removing a visitor needs a connection — try again when you are online.':(error.message||'That did not work.'));return;}
   const wasDeleted=data===true;
   if(!wasDeleted){toast('The database did not remove them: only your church’s admins and team leaders can');return;}
  }
  // 2. Their open places in the station lines
  await queueLeaveFor(id);
  // 3. This device
  const i=attendees.findIndex(x=>x.id===id);
  if(i>=0)attendees.splice(i,1);
  delete cloud.synced.att[id];
  delete cloud.rejected[id];
  if(cloud.rejectedNote&&cloud.rejectedNote.id===id)cloud.rejectedNote=null;
  if(state.activeId===id)state.activeId=attendees[0]?attendees[0].id:'';
  saveSyncedSoon();persist();render();
  toast(`${visitor.name||id} removed`);
 }finally{cloud.removing='';}
}
/* The same 7-day rule the database applies (schema.sql), on this device: the readings of a past visit go, and a visitor
   who did not agree to follow-up goes with them. It only touches records the server has already confirmed and that have
   no pending local edit — those upload first, and the database clears them there. Demo data is never touched. */
export function applyRetention(){
 if(!cloud.user&&!cloud.mode)return 0;
 if(!clockKnown())return 0;   /* the database's clock is not known yet: this phone's own could be days out */
 let n=0;
 for(let i=attendees.length-1;i>=0;i--){
  const a=attendees[i];
  if(cloud.synced.att[a.id]===undefined||isSeedRow('att',a)||!visitIsOld(a)||isDirty('att',a))continue;
  if(!followedUp(a)){attendees.splice(i,1);delete cloud.synced.att[a.id];n++;}
  else if(hasReadings(a)){clearReadings(a);n++;}     /* now differs from the server copy, so it is uploaded and the trigger keeps it clear */
 }
 return n;
}
export function cloudQueuePush(){
 if(!cloud.user||!cloud.client||cloud.blocked)return;
 clearTimeout(cloud.pushT);cloud.pushT=setTimeout(cloudPush,700);
}
export async function cloudPush(){
 if(!cloud.user||!cloud.client||cloud.blocked)return;
 if(cloud.busy){cloud.again=true;return;}
 if(!cloudPending()){if(cloud.status==='syncing')setCloud('online');return;}
 cloud.busy=true;cloud.phase='push';cloud.prog={done:0,total:0};setCloud('syncing');
 try{await pushDirty();saveSynced();setCloud('online');healthUpload();}
 catch(err){cloudError(err,'upload');}
 finally{cloud.busy=false;cloud.phase='';syncChrome();if(cloud.again){cloud.again=false;cloudQueuePush();}}
}

/* ---------- live updates from other desks ---------- */
export function startRealtime(){
 if(cloud.channel||!cloud.client)return;
 const ch=cloud.client.channel('newstart-live');
 for(const kind of ['att','vol'])ch.on('postgres_changes',{event:'*',schema:'public',table:KINDS[kind].table},p=>onRemoteChange(kind,p));
 /* the bell rides the same channel: a notification for this account arrives without any polling */
 if(cloud.user)ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+cloud.user.id},p=>onNotifRow(p.new));
 ch.subscribe(st=>{cloud.liveSt=st;healthLive('live',st);});cloud.channel=ch;
}
export function stopRealtime(){
 if(cloud.channel)noteHealth('live','off','Not connected.');
 cloud.liveSt='';
 if(cloud.channel&&cloud.client){try{cloud.client.removeChannel(cloud.channel);}catch(e){}}
 queueReset();
 cloud.channel=null;
}
export function onRemoteChange(kind,p){
 const k=KINDS[kind],sy=cloud.synced[kind];
 /* With churches a badge number repeats across churches, and Supabase applies no row-level security to delete events
    (Realtime docs, "Postgres Changes"). So a live delete counts only when it names this device's church; one that does
    not is left to the next full pull, which notices deletions anyway. Inserts and updates are checked the same way. */
 if(cloud.churchId&&(p.eventType==='DELETE'?!(p.old&&p.old.church_id===cloud.churchId):!!(p.new&&p.new.church_id&&p.new.church_id!==cloud.churchId)))return;
 if(p.eventType==='DELETE'){
  const id=p.old&&p.old.id,i=k.list.findIndex(o=>o.id===id);
  if(i>=0&&sigOf(k.toRow(k.list[i]))===sy[id]){k.list.splice(i,1);delete sy[id];}
 }else if(p.new&&p.new.id){
  const obj=k.fromRow(p.new),s=sigOf(k.toRow(obj)),id=obj.id,i=k.list.findIndex(o=>o.id===id);
  if(i>=0){
   const here=sigOf(k.toRow(k.list[i]));
   if(here===s){sy[id]=s;return;}                 /* the echo of our own save */
   if(here!==sy[id])return;                      /* we have a pending edit of our own: it wins */
   k.list.splice(i,1,obj);
  }else k.list.push(obj);
  sy[id]=s;
 }else return;
 afterMerge(kind);saveSyncedSoon();persist();cloudRefresh();
}
/* redraw only when that cannot wipe something being typed */
export function cloudRefresh(){
 clearTimeout(cloud.renderT);
 cloud.renderT=setTimeout(()=>{
  const el=document.activeElement;
  if((el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))||state.regOpen||state.volRegOpen||state.logOpen)return;
  render();
 },250);
}
