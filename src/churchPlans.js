// @ts-check
import { APP_SITE, IS_APP } from './platform.js';
import { $ } from './helpers.js';
import { cloud, persist } from './state.js';
import { HELP_LINE, PROTOCOLS, precautionsHTML, state } from './data.js';
import { A, autoProtocol, esc, firstName } from './helpers.js';
import { renderMain, toast } from './shell.js';
import { acctBox, acctNote, acctRpc, nOf, renderAcct } from './account.js';
import { planNeeds, problemOf, urgentOf } from './results.js';
import { qSafe } from './queue.js';
import { optedIn } from './visitor.js';
import { confirmAsk } from './feedback.js';
/* A church's own home plans, follow-up people and invite links (with the account hub's boxes). Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= CHURCH PLANS =================
   A church's own home plans, for one of the nine problems or one of its own (e.g. "Joint pain"). Its admins write
   them on the Church screen; its staff send one to a visitor from the Plan tab, and the visitor's record keeps the
   plan's id in interests.churchPlan (so it syncs with the rest of the record). A church plan is always shown as the
   church's own, never as the app's, and the app's safety rules (red-range warning, keep taking your pills, the help
   line for sleep and stress) always come with it. In practice mode DEMO_CHURCH_PLANS stand in. */
export const CHURCH_PLANS_KEY='newstart.churchplans.v1';
export const DEMO_CHURCH_PLANS=[
 {id:'demo-joints',church_id:'demo',problem:'Joint pain',title:'Easing stiff, painful joints',
  note:'This is an example from a practice church. Real plans are written by your church’s admin.',
  actions:[{do:'Move every joint gently each morning',why:'Gentle movement keeps joints from stiffening.',how:['5 minutes of slow stretches after you get up','Stop if a joint is hot or swollen']},
   {do:'Use a warm, never hot, compress on stiff joints',why:'Warmth eases stiffness.',how:['A warm, wet towel on the joint for 10 minutes','Test the heat on your wrist first']},
   {do:'Walk a little every day',why:'Walking keeps the muscles round the joints strong.',how:['Start with 10 minutes on flat ground']},
   {do:'See the clinic if a joint is red, hot or swollen',why:'That needs a check, not only home care.',how:['Ask the triage nurse today']}]},
 {id:'demo-bp',church_id:'demo',problem:'bp',title:'Our church’s blood-pressure walking club',
  note:'This is an example from a practice church.',
  actions:[{do:'Join the Sunday walking group',why:'Walking with others keeps you going.',how:['Meet at the church gate at 07:00 on Sundays']},
   {do:'Cut right down on salt',why:'Less salt helps blood pressure come down.',how:['No salt at the table']},
   {do:'Have your blood pressure checked at church each month',why:'Seeing the numbers keeps you on track.',how:['At the health desk after the service']}]}];
const inPractice=()=>!cloud.mode&&!cloud.user;
const myChurchId=()=>cloud.acct&&cloud.acct.church?cloud.acct.church.id:'';
const churchNameOf=cp=>cp.church_id==='demo'?'Practice church':(cloud.acct&&cloud.acct.church&&cloud.acct.church.id===cp.church_id?cloud.acct.church.name:'your church');
const churchPlanLabel=cp=>PROTOCOLS[cp.problem]?PROTOCOLS[cp.problem].tag:cp.problem;
const cleanHow=x=>(Array.isArray(x.how)?x.how:String(x.how||'').split('\n')).map(h=>String(h).trim()).filter(Boolean);
/* the plans this device can send: the demo set in practice mode, otherwise the signed-in church's (cached for offline) */
export function churchPlanList(){
 if(inPractice())return DEMO_CHURCH_PLANS;
 if(!cloud.plans){try{const s=JSON.parse(localStorage.getItem(CHURCH_PLANS_KEY)||'null');if(s&&Array.isArray(s.list))cloud.plans=s;}catch(e){}}
 const cid=myChurchId();
 if(cid&&cloud.client&&(!cloud.plans||cloud.plans.cid!==cid)&&cloud.plansBusy!==cid)loadChurchPlans(cid);
 return cloud.plans&&(!cid||cloud.plans.cid===cid)?cloud.plans.list:[];
}
/* `key` keeps the platform admin's view of another church apart from this device's own church */
async function loadChurchPlans(cid,key){
 key=key||'plans';
 if(!cid||!cloud.client)return;
 if(key==='plans')cloud.plansBusy=cid;
 let r;try{r=await cloud.client.rpc('church_plans',{p_church:cid});}catch(e){r={error:e};}
 if(key==='plans')cloud.plansBusy='';
 const list=!r.error&&Array.isArray(r.data)?r.data:null;
 if(!list&&cloud[key]&&cloud[key].cid===cid)return;      /* offline or an older database: keep what we have */
 cloud[key]={cid,list:list||[]};
 if(key==='plans'&&list){try{localStorage.setItem(CHURCH_PLANS_KEY,JSON.stringify(cloud.plans));}catch(e){}}
 if(state.tab==='plan'&&A())renderMain();
 renderAcct();
}
export function chosenChurchPlan(a){
 const id=a&&a.interests&&a.interests.churchPlan;
 return id?churchPlanList().find(p=>p.id===id)||null:null;
}
/* a church plan in the same shape as planFor(), so the WhatsApp message and the card carry it unchanged */
export function churchPlanFor(a,cp){
 const base=PROTOCOLS[cp.problem]?cp.problem:autoProtocol(a),name=churchNameOf(cp);
 const list=(cp.actions||[]).map(x=>({do:String(x.do||''),why:String(x.why||''),how:cleanHow(x),ref:'',cost:0}));
 const p={tag:churchPlanLabel(cp),title:cp.title,credit:name,src:'its own plan, not reviewed by the app',steps:[],facts:[],items:[],
  habits:list.slice(0,3).map(x=>x.do),note:cp.note||'',help:['sleep','mind'].includes(cp.problem)?HELP_LINE:'',hydro:null};
 return {pk:base,church:cp,p,goal:cp.title,problem:PROTOCOLS[cp.problem]?problemOf(a,cp.problem):`A plan from ${name} for: ${cp.problem}.`,
  urgent:urgentOf(a,base),top:list.slice(0,3),more:list.slice(3),recheck:['Check in with your church’s health team in 3 weeks.','']};
}
export function chooseChurchPlan(id){
 const a=A();if(!a)return;
 a.interests=a.interests||{};
 if(id)a.interests.churchPlan=id;else delete a.interests.churchPlan;
 persist();renderMain();
 toast(id?`Church plan chosen for ${firstName(a.name)} ✓`:'Back to the app’s plan');
}
/* on the app's plan: the church's plans, the ones for today's readings first */
export function churchPlanPicker(a){
 const L=churchPlanList();if(!L.length)return '';
 const needs=new Set(planNeeds(a).map(n=>n.k));
 const sorted=[...L].sort((x,y)=>(Number(needs.has(y.problem))-Number(needs.has(x.problem)))||String(x.title).localeCompare(String(y.title)));
 return `<details class="pl-switch"><summary>Send a plan from ${esc(churchNameOf(sorted[0]))} ▾</summary>
  <div class="mt-2 grid gap-2">${sorted.map(cp=>`<button data-action="chooseChurchPlan" data-args="${qSafe(cp.id)}" class="btn btn-glass py-2.5 text-[11px]"><span class="min-w-0 flex-1 text-left"><b>${esc(cp.title)}</b> · ${esc(churchPlanLabel(cp))}${needs.has(cp.problem)?' · fits today’s readings':''}</span></button>`).join('')}</div>
 </details>`;
}
export function viewChurchPlan(a,cp){
 const P=churchPlanFor(a,cp),p=P.p,first=esc(firstName(a.name)),hue='sage';
 const card=(x,i)=>`<li class="ac-card hue-${hue}">
   <div class="ac-top"><span class="ac-n">${i+1}</span><div class="ac-do">${esc(x.do)}</div></div>
   ${x.why?`<p class="ac-why"><b>Why</b>${esc(x.why)}</p>`:''}
   ${x.how.length?`<div class="ac-how"><b>How</b><ul>${x.how.map(h=>`<li>${esc(h)}</li>`).join('')}</ul></div>`:''}
  </li>`;
 return `<section class="stagger space-y-3.5">
  <div class="glass hue-${hue} p-4">
   <div class="microlabel">${first}’s plan · from ${esc(p.credit)}</div>
   <div class="display mt-0.5 text-[19px] leading-tight font-extrabold text-[#0f2a2c]">${esc(P.goal)}</div>
   <p class="pl-problem">${esc(P.problem)}</p>
   <p class="mt-2 text-[11px] leading-snug text-[#4f6870]">Written by ${esc(p.credit)} for ${esc(p.tag)}: the church’s own plan, not reviewed by the app.</p>
   <button class="tap-link mt-1" data-action="chooseChurchPlan" data-args="">Use the app’s plan instead</button>
  </div>

  ${P.urgent?`<div class="pl-urgent" role="alert"><b>⚠ ${esc(P.urgent.t)}</b><span>${esc(P.urgent.w)}</span></div>`:''}

  <div>
   <div class="pl-h">Do ${P.top.length===1?'this':`these ${P.top.length} things`}</div>
   <ol class="ac-list">${P.top.map(card).join('')}</ol>
  </div>

  ${P.more.length?`<div class="glass p-4">
   <div class="microlabel">When these feel easy, add</div>
   <ul class="pl-more">${P.more.map(x=>`<li><b>${esc(x.do)}</b><span>${esc(x.why)}</span></li>`).join('')}</ul>
  </div>`:''}

  <div class="glass p-4">
   <div class="pl-row"><span class="pl-ic" aria-hidden="true">📅</span><div><b>Check again</b><span>${esc(P.recheck[0])}</span></div></div>
   <div class="pl-row"><span class="pl-ic" aria-hidden="true">💊</span><div><b>Keep taking your pills</b><span>Never stop prescribed pills suddenly; your clinic will adjust them. This plan is healthy-living advice, not a replacement for the clinic.${p.note?` ${esc(p.note)}`:''}</span></div></div>
  </div>
  ${p.help?`<div class="pl-urgent"><b>Need help now?</b><span>${esc(p.help)}</span></div>`:''}
  ${precautionsHTML()}
 </section>`;
}

/* --- the Church screen: writing the church's plans (admins) --- */
const CP_SLOTS=5;            /* things to do shown in the form; a plan may hold up to 8 */
export function churchPlansBox(cid){
 const own=cid===myChurchId(),key=own?'plans':'adminPlans',S=cloud[key];
 if(!S||S.cid!==cid){if(!(own&&cloud.plansBusy===cid))loadChurchPlans(cid,key);return acctNote('Loading…');}
 const ed=cloud.planEdit&&cloud.planEdit.cid===cid?cloud.planEdit:null;
 return (S.list.length?S.list.map(cp=>`<div class="border-t border-[#123033]/[.07] py-2.5"><div class="flex items-center gap-2">
   <div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(cp.title)}</div>
    <div class="truncate text-[11px] text-[#4f6870]">${esc(churchPlanLabel(cp))} · ${nOf((cp.actions||[]).length,'thing')} to do</div></div>
   <button class="tap-link" data-action="plan-edit" data-church="${qSafe(cid)}" data-plan="${qSafe(cp.id)}">Edit</button>
   <button class="tap-link text-rose-700" data-action="plan-delete" data-church="${qSafe(cid)}" data-plan="${qSafe(cp.id)}">Delete</button></div></div>`).join('')
   :acctNote('No church plans yet.'))
  +(ed?churchPlanForm(cid,ed):`<button class="btn btn-primary mt-3 w-full py-2.5 text-xs" data-action="plan-edit" data-church="${qSafe(cid)}" data-plan="">+ Write a new plan</button>`)
  +acctNote('Your staff can send these plans to visitors from the Plan tab. They show as your church’s own plan, together with the app’s safety rules. Write them in your own words; do not copy from books.');
}
function churchPlanForm(cid,ed){
 const keys=Object.keys(PROTOCOLS),own=!keys.includes(ed.problem),acts=ed.actions||[];
 const slots=Math.min(8,Math.max(CP_SLOTS,acts.length));
 const field=(id,ph,v,max)=>`<input id="${id}" value="${esc(v||'')}" placeholder="${ph}" maxlength="${max}" class="field mt-1.5 text-xs">`;
 return `<form data-action="plan-save" data-args="${qSafe(cid)}" class="mt-3 space-y-2.5">
  <label class="block"><span class="microlabel">Problem</span>
   <select id="cpProblem" class="field mt-1 text-xs">${keys.map(k=>`<option value="${k}" ${k===ed.problem?'selected':''}>${PROTOCOLS[k].tag}</option>`).join('')}<option value="own" ${own?'selected':''}>Another problem (type it below)</option></select></label>
  ${field('cpOwn','Another problem, e.g. Joint pain',own?ed.problem:'',60)}
  <label class="block"><span class="microlabel">Title</span>${field('cpTitle','e.g. Easing stiff, painful joints',ed.title,120)}</label>
  ${Array.from({length:slots},(_,i)=>{const x=acts[i]||{};return `<div class="rounded-[14px] border border-[#123033]/[.07] p-2.5"><div class="microlabel">Thing to do ${i+1}${i?' (optional)':''}</div>
   ${field('cpDo'+i,'What to do',x.do,140)}${field('cpWhy'+i,'Why it helps',x.why,240)}
   <textarea id="cpHow${i}" rows="2" maxlength="400" placeholder="How: one step per line" class="field mt-1.5 text-xs">${esc(cleanHow(x).join('\n'))}</textarea></div>`;}).join('')}
  <label class="block"><span class="microlabel">Safety note (optional)</span><textarea id="cpNote" rows="2" maxlength="600" class="field mt-1 text-xs">${esc(ed.note||'')}</textarea></label>
  <div class="flex gap-2"><button id="cpGo" class="btn btn-primary flex-1 py-2.5 text-xs">Save plan</button>
   <button type="button" class="btn btn-glass flex-1 py-2.5 text-xs" data-action="plan-edit-cancel">Cancel</button></div>
 </form>`;
}
export function editChurchPlan(cid,id){
 const S=cloud[cid===myChurchId()?'plans':'adminPlans'],cp=id&&S?S.list.find(p=>p.id===id):null;
 cloud.planEdit=cp?{...cp,cid}:{cid,id:null,problem:'bp',title:'',actions:[],note:''};
 renderAcct();
}
export async function saveChurchPlan(e,cid){
 e.preventDefault();
 const v=id=>(($('#'+id)||{}).value||'').trim(),ed=cloud.planEdit||{};
 const problem=v('cpProblem')==='own'?v('cpOwn'):v('cpProblem');
 const actions=[];
 for(let i=0;i<8;i++){const d=v('cpDo'+i);if(d)actions.push({do:d,why:v('cpWhy'+i),how:v('cpHow'+i).split('\n').map(h=>h.trim()).filter(Boolean)});}
 if(!problem){toast('Choose the problem this plan is for.');return;}
 if(!actions.length){toast('Add at least one thing to do.');return;}
 const r=await acctRpc('save_church_plan',{p_church:cid,p_id:ed.id||null,p_problem:problem,p_title:v('cpTitle'),p_actions:actions,p_note:v('cpNote')},'Plan saved ✓');
 if(!r)return;
 cloud.planEdit=null;
 await loadChurchPlans(cid,cid===myChurchId()?'plans':'adminPlans');
}
export async function deleteChurchPlan(cid,id){
 const S=cloud[cid===myChurchId()?'plans':'adminPlans'],cp=S&&S.list.find(p=>p.id===id);
 const yes=await confirmAsk({title:'Delete this plan?',
  body:`“${cp?cp.title:''}” goes for good. Visitors it was sent to go back to the app’s plan.`,label:'Delete',danger:true});
 if(!yes)return;
 if(await acctRpc('delete_church_plan',{p_id:id},'Plan deleted'))await loadChurchPlans(cid,cid===myChurchId()?'plans':'adminPlans');
}

/* ================= FOLLOW-UP PEOPLE =================
   A church names up to five of its approved members as follow-up people (Church screen). Staff give each visitor one
   of them on Send home; the visitor's record keeps the id and name in interests.followUp / followUpName, so the choice
   syncs with the record and still shows offline. A follow-up person sees the visitors given to them under My account.
   In practice mode DEMO_FOLLOWUPS stand in. */
export const FOLLOWUP_MAX=5;
const DEMO_FOLLOWUPS=[{user_id:'demo-f1',full_name:'Grace Dlamini',phone:'082 111 2233'},
 {user_id:'demo-f2',full_name:'Peter Naidoo',phone:'083 444 5566'},{user_id:'demo-f3',full_name:'Lerato Mokoena',phone:'071 777 8899'}];
export function followupList(){
 if(inPractice())return DEMO_FOLLOWUPS;
 const cid=myChurchId();
 if(cid&&cloud.client&&(!cloud.followups||cloud.followups.cid!==cid)&&cloud.followupsBusy!==cid)loadFollowups(cid);
 return cloud.followups&&cloud.followups.cid===cid?cloud.followups.list:[];
}
/* `key` keeps the platform admin's view of another church apart from this device's own church */
async function loadFollowups(cid,key){
 key=key||'followups';
 if(!cid||!cloud.client)return;
 if(key==='followups')cloud.followupsBusy=cid;
 let r;try{r=await cloud.client.rpc('church_followups',{p_church:cid});}catch(e){r={error:e};}
 if(key==='followups')cloud.followupsBusy='';
 const list=!r.error&&Array.isArray(r.data)?r.data:null;
 if(!list&&cloud[key]&&cloud[key].cid===cid)return;      /* offline or an older database: keep what we have */
 cloud[key]={cid,list:list||[]};
 if(state.tab==='send'&&A())renderMain();
 renderAcct();
}
/* the Church screen's follow-up ids for this church, or null while they load */
export function followupsFor(cid){
 const own=cid===myChurchId(),key=own?'followups':'adminFollowups',S=cloud[key];
 if(!S||S.cid!==cid){if(!(own&&cloud.followupsBusy===cid))loadFollowups(cid,key);return null;}
 return S.list.map(p=>p.user_id);
}
export async function setFollowup(uid,on){
 const r=await acctRpc('set_followup',{p_user:uid,p_on:on},on?'Now a follow-up person ✓':'No longer a follow-up person');
 const cid=cloud.members&&cloud.members.cid;
 if(r&&cid)await loadFollowups(cid,cid===myChurchId()?'followups':'adminFollowups');
}
export function chooseFollowup(uid){
 const a=A();if(!a)return;
 a.interests=a.interests||{};
 if(uid&&!optedIn(a)){toast(`${firstName(a.name)} did not agree to follow-up contact`);return;}
 const p=uid&&followupList().find(x=>x.user_id===uid);
 if(p){a.interests.followUp=p.user_id;a.interests.followUpName=p.full_name;}
 else{delete a.interests.followUp;delete a.interests.followUpName;}
 persist();renderMain();
 toast(p?`${firstName(p.full_name)} will follow up with ${firstName(a.name)} ✓`:'No follow-up person');
}
/* on Send home: who from the church will contact this visitor after the expo */
export function followupPicker(a){
 const L=followupList(),cur=a.interests&&a.interests.followUp;
 if(!optedIn(a))return `<div class="glass p-4"><div class="microlabel">Follow-up person</div>
  ${acctNote(`${esc(firstName(a.name))} did not agree to be contacted after the expo, so no follow-up person is given.`)}</div>`;
 if(!L.length)return myChurchId()?`<div class="glass p-4"><div class="microlabel">Follow-up person</div>
  ${acctNote(`Your church has not named any follow-up people yet. A church admin can name up to ${FOLLOWUP_MAX} on the Church screen.`)}</div>`:'';
 return `<div class="glass p-4"><div class="microlabel">Follow-up person</div>
  <p class="mt-1 text-[11.5px] leading-snug text-[#5c747a]">Who from the church will contact ${esc(firstName(a.name))} after the expo.</p>
  <div class="mt-2 flex flex-wrap items-center gap-1.5">${L.map(p=>`<button data-action="chooseFollowup" data-args="${qSafe(p.user_id)}" class="availpill hue-sage ${cur===p.user_id?'availpill-on':''}" aria-pressed="${cur===p.user_id}">${cur===p.user_id?'✓ ':''}${esc(p.full_name||'(no name)')}</button>`).join('')}
   ${cur?`<button data-action="chooseFollowup" data-args="" class="tap-link">None</button>`:''}</div></div>`;
}
/* My account, for a follow-up person: the visitors given to them */
export function myFollowupsHTML(){
 if(!cloud.myFollow){if(!cloud.myFollowBusy)loadMyFollowups();return acctBox('People to follow up',acctNote('Loading…'));}
 const L=cloud.myFollow,tel=p=>String(p||'').replace(/[^+\d]/g,'');
 return acctBox(`People to follow up · ${L.length}`,L.length?L.map(p=>`<div class="border-t border-[#123033]/[.07] py-2">
   <div class="text-[13px] font-bold text-[#123033]">${esc(p.name)}</div>
   <div class="text-[11px] text-[#4f6870]">${esc(p.id)}${tel(p.phone).length>5?` · <a class="tap-link" href="tel:${esc(tel(p.phone))}">${esc(p.phone)}</a>`:''}${p.email?' · '+esc(p.email):''}</div></div>`).join('')
  :acctNote('Nobody has been given to you yet. Visitors appear here when staff choose you on their Send home screen.'));
}
async function loadMyFollowups(){
 cloud.myFollowBusy=true;
 const r=await acctRpc('my_followups');
 cloud.myFollowBusy=false;cloud.myFollow=r&&Array.isArray(r.data)?r.data:[];
 renderAcct();
}

/* ================= INVITE LINKS =================
   A church admin shares a link (…/?join=CODE). Whoever opens it and signs in joins that church at once, approved,
   as a member or as staff: no searching for the church, no waiting for approval. The code waits in localStorage
   through the sign-up email round trip, and loadAccount() uses it after the next sign-in. */
export const INVITE_KEY='newstart.invite.v1';
export const pendingInvite=()=>{try{return localStorage.getItem(INVITE_KEY)||'';}catch(e){return '';}};
export const clearInvite=()=>{try{localStorage.removeItem(INVITE_KEY);}catch(e){}};
(function takeInvite(){
 try{
  const q=new URLSearchParams(location.search),c=(q.get('join')||'').toLowerCase();
  if(!/^[0-9a-f]{32}$/.test(c))return;
  localStorage.setItem(INVITE_KEY,c);
  q.delete('join');history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:'')+location.hash);
 }catch(e){}
})();
export function inviteBox(cid,c){
 const L=cloud.inviteLink&&cloud.inviteLink.cid===cid?cloud.inviteLink:null;
 return `${acctNote(`Share a link: whoever opens it and signs in joins ${esc(c.name||'the church')} at once, already approved, with no searching and no waiting. Links last 30 days.`)}
  <div class="mt-2 flex gap-2"><button class="btn btn-soft flex-1 py-2 text-xs" data-action="invite-make" data-args="${qSafe(cid)}" data-role="member">Member link</button>
   <button class="btn btn-soft flex-1 py-2 text-xs" data-action="invite-make" data-args="${qSafe(cid)}" data-role="staff">Staff link</button></div>
  ${L?`<div class="mt-2 rounded-[14px] bg-white/70 p-2.5"><div class="microlabel">${L.role==='staff'?'Staff':'Member'} invite link</div>
   <input id="invLink" readonly value="${esc(L.link)}" data-action="select-self" class="field mono mt-1 text-[11px]">
   <div class="mt-1.5 flex gap-3"><button class="tap-link" data-action="copyInvite">Copy</button><button class="tap-link" data-action="shareInvite">Share</button></div></div>`:''}
  <button class="tap-link mt-2 text-rose-700" data-action="cancelInvites" data-args="${qSafe(cid)}">Cancel all invite links</button>`;
}
export async function makeInvite(cid,role){
 const r=await acctRpc('create_church_invite',{p_church:cid,p_role:role});
 if(!r||!r.data)return;
 cloud.inviteLink={cid,role,link:(IS_APP?APP_SITE:location.origin+location.pathname)+'?join='+r.data};
 renderAcct();copyInvite();
}
export function copyInvite(){
 const l=cloud.inviteLink&&cloud.inviteLink.link;if(!l)return;
 const manual=()=>toast('Select the link and copy it');
 try{navigator.clipboard.writeText(l).then(()=>toast('Invite link copied ✓'),manual);}catch(e){manual();}
}
export function shareInvite(){
 const l=cloud.inviteLink&&cloud.inviteLink.link;if(!l)return;
 const t=`Join us on the Health Expo Passport: ${l}`;
 if(navigator.share)navigator.share({text:t}).catch(()=>{});else window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');
}
export async function cancelInvites(cid){
 const yes=await confirmAsk({title:'Cancel every invite link?',
  body:'Anyone who has not used theirs yet will need a new one.',label:'Cancel links',danger:true});
 if(!yes)return;
 if(await acctRpc('cancel_church_invites',{p_church:cid},'Invite links cancelled')){cloud.inviteLink=null;renderAcct();}
}
/* HUE_N (per-tab hue) now lives next to SERVE_TABS in the shell section below */