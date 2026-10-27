// @ts-check
import { I } from './icons.js';
import { waNumber } from './volunteer.js';
import { INT } from './data.js';
import { $ } from './helpers.js';
import { A, SEX_RANGE, bmi, cat, chipClass, chipNote, chipOf, clamp, disp, doneCount, esc, firstName, fmt1, initials, redFlag } from './helpers.js';
import { EXPO_UPCOMING, EXTRA_DEFS, HEARD, MED_YN, SEMINARS, STATION_DEFS, SURVEY, attendees, hueOf, state } from './data.js';
import { JOURNEY, JOURNEY_LABEL, jelly, render, renderMain, toast } from './shell.js';
import { planFor } from './results.js';
import { followupPicker } from './churchPlans.js';
import { cloud, migrateAttendee, persist, seedDemo } from './state.js';
import { GRACE_DAYS, RETENTION_YEARS, visitIsOld } from './retention.js';
import { homeHealthHTML, installEvt, validEmail } from './cloud.js';
import { hiredCountLabel, pendingLabel, todayStr } from './volunteer.js';
import { parseBadge } from './scanner.js';
/* The visitor journey: Check → Results entry, registration, the paper record and the survey. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= THE VISITOR JOURNEY: Check → Results → Plan → Send home ================= */
/* where a visitor's passport should open: the step they were on, else the first one not done */
function defaultStep(a){return a.done?'send':doneCount(a)<8?'screen':'results';}
export function goVisit(){
 if(!attendees.length){switchTab('screen');return;}
 const a=A();switchTab(state.stepFor===a.id&&JOURNEY.includes(state.step)?state.step:defaultStep(a));
}
export function journeyTop(){
 const a=A(),i=JOURNEY.indexOf(state.tab),d=doneCount(a);
 const done=k=>k==='screen'?d===8:k==='send'?!!a.done:false;
 return `<div class="jr">
  <button class="jr-who" data-action="openSwitcher" aria-label="Change visitor">
   <span class="jr-av av hue-${hueOf(a.id)}">${initials(a.name)}</span>
   <span class="jr-name"><b>${esc(a.name)}</b><span>${esc(a.id)}${redFlag(a)?' · <em>⚠ refer to triage</em>':''}</span></span>
   <span class="jr-change">Change</span>
  </button>
  <ol class="jr-steps">${JOURNEY.map((k,j)=>`<li><button class="jr-step ${j===i?'is-on':j<i?'is-past':''}" data-action="switchTab" data-args="${k}" ${j===i?'aria-current="step"':''}>
   <span class="jr-dot">${done(k)&&j!==i?'✓':j+1}</span><span class="jr-lbl">${JOURNEY_LABEL[k]}${k==='screen'?` <small id="jrCount">${d<8?d+'/8':''}</small>`:''}</span></button></li>`).join('')}</ol>
 </div>`;
}
export function journeyBottom(){
 const a=A(),i=JOURNEY.indexOf(state.tab),prev=JOURNEY[i-1],next=JOURNEY[i+1],left=8-doneCount(a);
 /* a station volunteer's next move is the next visitor, not this visitor's results */
 if(state.tab==='screen'&&myStation())return `<div class="jr-foot"><div class="jr-btns">
  <button class="btn btn-glass jr-back" data-action="switchTab" data-args="results">Results →</button>
  <button class="btn btn-primary jr-next" data-action="openScanner">Scan next visitor</button></div></div>`;
 return `<div class="jr-foot">
  ${state.tab==='screen'?`<p id="jrNote" class="jr-note" ${left>0?'':'hidden'}>${left} of 8 checks still empty. You can carry on and come back.</p>`:''}
  <div class="jr-btns">
   ${prev?`<button class="btn btn-glass jr-back" data-action="switchTab" data-args="${prev}">← ${JOURNEY_LABEL[prev]}</button>`:'<span></span>'}
   ${next?`<button class="btn btn-primary jr-next" data-action="switchTab" data-args="${next}">Next: ${JOURNEY_LABEL[next]} →</button>`
    :`<button class="btn btn-primary jr-next" data-action="finishVisit">${a.done?'Visit complete ✓ · Home':'Finish visit ✓'}</button>`}
  </div>
 </div>`;
}
/* last step: the plan goes home with the visitor */
export function viewSend(){
 const a=A(),P=planFor(a),first=esc(firstName(a.name)),wa=waNumber(a.phone);
 const asked=Object.keys(INT).filter(k=>a.interests&&a.interests[k]&&k!=='pouch').map(k=>INT[k]);
 const item=(fn,ic,t,sub,on)=>`<button class="snd-item ${on?'is-on':''}" data-action="${fn}"><span class="snd-ic" aria-hidden="true">${ic}</span>
  <span class="min-w-0 flex-1"><b>${t}</b><span>${sub}</span></span><span class="snd-go" aria-hidden="true">${on?'✓':'→'}</span></button>`;
 return `<section class="stagger space-y-3.5">
  <div class="glass p-4">
   <div class="microlabel">Last step</div>
   <div class="display text-base font-extrabold">Send ${first} home with the plan</div>
   <p class="mt-1 text-[11.5px] leading-snug text-[#5c747a]">Their plan: <b class="text-[#123033]">${esc(P.goal)}</b>, with the same 3 actions you went through.</p>
  </div>
  <div class="snd-list">
   ${item('openWhatsApp','💬','Send the plan on WhatsApp',wa?`Preview, then send to ${esc(a.phone)}`:'Preview, then pick their contact (no number saved)',false)}
   ${item('openEmail','✉️','Email the plan',a.email?`Preview, then send to ${esc(a.email)}`:'Preview, then type their email (none saved)',false)}
   ${item('printCard','🖨️','Print the take-home card','A6 card: their numbers and the 3 actions',false)}
   ${item('reservePouch','🛍️',a.interests&&a.interests.pouch?'Co-op starter pouch reserved':'Reserve the R25 co-op starter pouch','Bulk staples for 21 days, ready at the exit table',!!(a.interests&&a.interests.pouch))}
  </div>
  <div class="glass p-4">
   <div class="microlabel">Follow-up for the team</div>
   <p class="mt-1 text-[11.5px] leading-relaxed text-[#3d5c5e]">${asked.length?`${first} asked for: <b>${asked.map(esc).join(', ')}</b>.`:`${first} did not ask for a call back or classes.`}
    ${a.prayer?` Prayer request noted.`:''} <button class="tap-link" data-action="switchTab" data-args="screen">Change</button></p>
  </div>
  ${followupPicker(a)}
 </section>`;
}
export function finishVisit(){
 const a=attendees.find(x=>x.id===state.activeId);if(!a)return;
 const first=!a.done;a.done=true;persist();switchTab('home');
 if(first)toast(`${firstName(a.name)}’s visit is complete ✓ Ready for the next visitor`);
}
export function viewNoVisitor(){
 return `<section class="stagger space-y-3.5"><div class="glass p-5 text-center">
  <div class="display text-[16px] font-extrabold text-[#0f2a2c]">No visitor selected</div>
  <p class="mx-auto mt-1.5 max-w-[30ch] text-[11px] leading-relaxed text-[#5b7178]">Register a visitor or scan a lanyard badge first — their numbers appear here.</p>
  <button data-action="registerNew" class="btn btn-primary mt-3 w-full py-2.5 text-xs">Register a visitor →</button>
 </div></section>`;
}
export function switchTab(t){
 if(JOURNEY.includes(t)){state.step=t;state.stepFor=state.activeId;}
 if(state.food)state.food.open=false;   /* tapping a tab (even Plan) leaves the Food screen — at the tap */
 if(t!=='serve')state._serveKey='';     /* coming back to Team fades in once again */
 state.tab=t;render();window.scrollTo(0,0);
}

/* ================= VIEW: HOME ================= */
export function viewHome(){
 const a=A(),dc=doneCount(a),first=esc(firstName(a.name));
 const cbp=cat('bp',{sys:a.s.sys,dia:a.s.dia}),csg=cat('sugar',a.s.sugar),cbm=cat('bmi',bmi(a));
 const tone=c=>c==='flag'?'tile-flag':c==='watch'?'tile-watch':'tile-ok';
 const metric=(l,v,c)=>`<div class="tile hue-${{BP:'blush',Sugar:'sand',BMI:'sky'}[l]} ${tone(c)}"><span class="tile-l">${l}</span><span class="tile-v">${v}</span></div>`;
 const step=state.stepFor===a.id&&JOURNEY.includes(state.step)?state.step:defaultStep(a);
 return `<section class="stagger space-y-3.5">
  ${cloud.demo&&!cloud.user?`<div class="vw-bar" style="cursor:default"><span><b>Practice mode</b> · demo visitors, nothing is shared</span><button class="vw-sw" data-action="openCloud">Sign in</button></div>`:''}

  ${!attendees.length?`<div class="hero p-5 text-center">
   <div class="display text-[17px] font-extrabold text-[#0f2a2c]">Welcome</div>
   <p class="mx-auto mt-1.5 max-w-[32ch] text-[11.5px] leading-relaxed text-[#5b7178]">${cloud.mode?'The shared database is empty. ':''}Scan a visitor’s lanyard badge, or register a new visitor, to begin.</p>
  </div>`:`<div class="hero p-5"><div class="wave-clip" aria-hidden="true"><div class="wave w1"></div><div class="wave w2"></div></div>
   <div class="microlabel">Now serving</div>
   <div class="mt-2 flex items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-3">
     <span class="flex h-12 w-12 flex-none items-center justify-center rounded-[18px] text-sm font-extrabold av hue-${hueOf(a.id)}">${initials(a.name)}</span>
     <div class="min-w-0">
      <div class="display truncate text-[19px] leading-tight font-extrabold text-[#0f2a2c]">${esc(a.name)}</div>
      <div class="mono mt-0.5 text-[11px] text-[#5c747a]">${esc(a.id)} · ${a.age}y ${esc(a.sex)}</div>
     </div>
    </div>
    <span class="flex-none rounded-full px-2.5 py-1 text-[10px] font-extrabold ${a.done?'bg-brand-500/15 text-brand-800':'bg-white/70 text-[#5b7178]'}">
      ${a.done?'Completed ✓':`Step ${JOURNEY.indexOf(step)+1} of 4`}</span>
   </div>
   <div class="mt-4 flex gap-2">
    ${metric('BP',`${a.s.sys??'—'}/${a.s.dia??'—'}`,cbp[0])}
    ${metric('Sugar',a.s.sugar??'—',csg[0])}
    ${metric('BMI',bmi(a)?fmt1(bmi(a)):'—',cbm[0])}
   </div>
   ${redFlag(a)?`<div class="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/80 px-3 py-2.5 text-[11px] font-bold leading-snug text-rose-700">
     <span class="mt-px">⚠</span><span>Clinical red flag: skip the fitness test and refer to the triage nurse now.</span></div>`:''}
   <button data-action="goVisit" class="btn btn-primary mt-4 w-full py-3 text-sm">${a.done?`Open ${first}’s passport`:`Continue: ${JOURNEY_LABEL[step]} →`}</button>
  </div>`}

  <div class="grid grid-cols-2 gap-2">
   <button data-action="openScanner" class="btn btn-primary py-3.5 text-[13px]">
    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
    Scan badge</button>
   <button data-action="toggleReg" class="btn ${state.regOpen?'btn-glass':'btn-soft'} py-3.5 text-[13px]" aria-expanded="${!!state.regOpen}">${state.regOpen?'Close form':'+ New visitor'}</button>
  </div>

  ${state.regOpen?`<div class="glass p-4">
   <div class="display text-sm font-extrabold">New visitor</div>
   <div class="mt-0.5 text-[11px] leading-snug text-[#5c747a]">Takes about 30 seconds. Their lanyard badge opens the passport.</div>
   <form data-action="registerSubmit" novalidate class="pop-in mt-4 space-y-3">
    <input id="rgName" required placeholder="Full name e.g. Sipho Ndlovu" class="field">
    <div class="grid grid-cols-2 gap-3">
     <div><label class="microlabel" for="rgAge">Age</label><input id="rgAge" type="text" inputmode="numeric" required placeholder="e.g. 46" class="field mono mt-1" data-on-input="guardian-show" data-args="rg"></div>
     <div><span class="microlabel">Sex</span><input type="hidden" id="rgSex" value="">
      <div class="mt-1 grid grid-cols-2 gap-1.5" role="group" aria-label="Sex">${['Male','Female'].map(s=>`<button type="button" data-sex="${s}" aria-pressed="false" data-action="pick-sex" class="btn btn-glass py-2.5 text-[12px]">${s}</button>`).join('')}</div></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
     <div><label class="microlabel" for="rgPhone">WhatsApp (optional)</label><input id="rgPhone" type="tel" inputmode="tel" placeholder="082 123 4567" class="field mono mt-1"></div>
     <div><label class="microlabel" for="rgHeight">Height (cm)</label><input id="rgHeight" type="text" inputmode="numeric" placeholder="if measured" class="field mono mt-1"></div>
    </div>
    <div><label class="microlabel" for="rgEmail">Email (optional)</label><input id="rgEmail" type="email" inputmode="email" autocomplete="off" placeholder="for sending the plan by email" class="field mt-1"></div>
    <div><label class="microlabel" for="rgBadge">Lanyard badge</label>
     <div class="mt-1 flex gap-2">
      <input id="rgBadge" value="${state.pendingBadge||''}" placeholder="${nextBadge()}" autocomplete="off"
        class="field mono min-w-0 flex-1 font-bold uppercase text-brand-900"
        style="background:rgba(58,165,151,.09);border-color:rgba(58,165,151,.3)">
      <button type="button" data-action="openScanner" class="btn btn-soft flex-none px-4 text-xs" aria-label="Scan the lanyard badge">Scan</button>
     </div>
     <p class="mt-1 text-[10.5px] text-[#6b8187]">No badge to scan? Leave it empty and they get the next free number, ${nextBadge()}.</p></div>
    ${consentFields('rg',false)}
    <div id="rgErr" class="st-warn" role="alert" hidden></div>
    <button class="btn btn-primary w-full py-3 text-sm">Register & start the checks →</button>
   </form>
  </div>`:''}

  <div class="glass p-4">
   <div class="mb-2 flex items-start justify-between gap-3">
    <div class="min-w-0"><div class="microlabel">Visitors today</div>
     <div class="mt-0.5 text-[11px] font-semibold text-[#4f6870]">${cloud.user?'Shared between desks':'Saved on this device'}</div></div>
    <div class="flex flex-none items-center gap-3">
     ${cloud.user||cloud.mode?'':`<button data-action="resetDemo" class="tap-link" style="color:#4f6870">Reset demo</button>`}
     ${installEvt?`<button data-action="installApp" class="tap-link">Install app</button>`:''}
     <button data-action="openCloud" class="tap-link">${cloud.user?'Sync':'Sign in'}</button>
    </div>
   </div>
   ${cloud.user?`<div id="homeHealth">${homeHealthHTML()}</div>`:''}
   ${attendees.length>LIST_CAP?`<input id="vq" type="search" placeholder="Search ${attendees.length} visitors by name, badge or phone" value="${esc(state.vq||'')}"
     data-on-input="visitors-filter" class="field mb-2" autocomplete="off">`:''}
   <div id="visitorList" class="space-y-1">${visitorListHTML(state.vq)}</div>
  </div>

  <button data-action="openVolModal" class="glass hue-tint hue-peach flex w-full items-center gap-3 p-3.5 text-left">
   <span class="flex h-10 w-10 flex-none items-center justify-center rounded-[15px] tint hue-peach">${I.team}</span>
   <span class="min-w-0 flex-1">
    <span class="microlabel">Incoming expo · ${hiredCountLabel()}</span>
    <span class="mt-0.5 block text-[13px] font-extrabold leading-snug text-[#0f2a2c]">${esc(EXPO_UPCOMING.name)}</span>
    <span class="mt-0.5 block text-[10px] font-semibold text-[#6b8187]">Pledge to help · pick your booth${pendingLabel()}</span>
   </span>
   <svg class="h-4 w-4 flex-none text-[#8a9aa0]" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
  </button>
 </section>`;
}
/* With hundreds of visitors, drawing everyone on every tap would make the phone crawl, so long lists show the
   most recent few (plus whoever is open) and a search box finds the rest. Short lists show everyone as before. */
export const LIST_CAP=25;
export function visitorsToShow(query){
 const q=String(query||'').trim().toLowerCase(),out=[];
 if(q){
  for(let i=attendees.length-1;i>=0&&out.length<LIST_CAP;i--){const x=attendees[i];
   if(`${x.name} ${x.id} ${x.phone||''} ${x.email||''}`.toLowerCase().includes(q))out.push(x);}
  return out;
 }
 if(attendees.length<=LIST_CAP)return attendees;
 const recent=attendees.slice(-LIST_CAP).reverse(),act=attendees.find(a=>a.id===state.activeId);
 return act&&!recent.includes(act)?[act,...recent.slice(0,LIST_CAP-1)]:recent;
}
function visitorRowHTML(x){
 const d=doneCount(x),act=x.id===state.activeId;
 return `<button data-action="switchTo" data-args="${x.id}" class="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-all duration-300 ${act?'bg-brand-500/10 ring-1 ring-brand-400/25':'hover:bg-white/60 active:scale-[.99]'}">
     <span class="flex h-9 w-9 flex-none items-center justify-center rounded-[13px] text-[11px] font-extrabold transition-all duration-300 ${act?'av':'tint'} hue-${hueOf(x.id)}">${initials(x.name)}</span>
     <span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-bold">${esc(x.name)}${x.done?' <span class="text-brand-600">✓</span>':''}</span>
     <span class="mono block text-[10px] text-[#6b8187]">${esc(x.id)}</span></span>
     <span class="flex flex-none gap-0.5">${Array.from({length:8},(_,i)=>`<span class="h-1.5 w-1.5 rounded-full transition-colors duration-300 ${i<d?'bg-brand-500':'bg-[#123033]/10'}"></span>`).join('')}</span>
     <span class="text-[#9db0b4]">›</span></button>`;
}
function visitorListHTML(query){
 const rows=visitorsToShow(query),q=String(query||'').trim();
 if(!rows.length)return `<p class="px-1 py-3 text-center text-[11px] text-[#6b8187]">${q?'Nobody matches “'+esc(q)+'”.':'No visitors yet.'}</p>`;
 const more=(q?0:attendees.length-rows.length);
 return rows.map(visitorRowHTML).join('')+(more>0?`<p class="px-1 pt-2 text-center text-[10px] font-semibold text-[#6b8187]">Latest ${rows.length} of ${attendees.length} — search to find anyone else.</p>`:'');
}
export function filterVisitors(v){state.vq=v;const el=$('#visitorList');if(el)el.innerHTML=visitorListHTML(v);}
/* first unused EXPO-nnn above the seed range */
export function nextBadge(){
 let n=120+attendees.length;
 while(attendees.some(a=>a.id==='EXPO-'+String(n).padStart(3,'0')))n++;
 return 'EXPO-'+String(n).padStart(3,'0');
}
export function toggleReg(){state.regOpen=!state.regOpen;renderMain();if(state.regOpen){const n=$('#rgName');if(n)n.focus();}}
/* Male / Female in one tap: the buttons fill the hidden #rgSex that registerSubmit() reads */
export function pickSex(btn){
 const s=btn&&btn.dataset&&btn.dataset.sex;if(!s)return;
 $('#rgSex').value=s;
 btn.parentElement.querySelectorAll('[data-sex]').forEach(b=>{const on=b.dataset.sex===s;
  b.classList.toggle('btn-primary',on);b.classList.toggle('btn-glass',!on);b.setAttribute('aria-pressed',String(on));});
}
/* ================= POPIA CONSENT =================
   Health readings and prayer requests are special personal information (POPIA s26–27): they are processed only with
   the visitor's explicit consent. The volunteer asks one question, CONSENT_Q, which covers the screening and any prayer
   request, and a second, optional question about follow-up. Both answers are kept in interests (consent, optin) with the
   date and NOTICE_VERSION: the notice below is what the yes covers, kept as proof, not read aloud. Follow-up can be
   stopped later (optin off). Under 18, a parent or guardian consents (s34–35), named in guardianName. Change
   NOTICE_VERSION whenever the notice text changes. */
const CONSENT_Q='Do you consent to today’s health screening, including any prayer request you share?';
const NOTICE_VERSION='2026-10-27';
/* POPIA s14: kept no longer than needed. The readings go GRACE_DAYS after the visit and a record not updated for
   RETENTION_YEARS is deleted; the database does the same (purge_expired_visitors in schema.sql). */
/* the church or organisation that ran the expo, as it registered itself; demo mode has none */
const noticeChurch=()=>{const c=cloud.acct&&cloud.acct.church;return c&&c.name?c:null;};
const churchName=()=>{const c=noticeChurch();return c?c.name:'The church or organisation running this health expo';};
const churchWho=()=>{const c=noticeChurch();
 if(!c)return 'The church or organisation running this health expo, through its approved health team.';
 const reach=[c.city,c.phone,c.email].filter(Boolean).join(' · ');
 return reach?`${c.name} (${reach}), through its approved health team.`:`${c.name}, through its approved health team.`;};
const noticeRows=()=>[
 ['Who',churchWho()],
 ['What','Name, age, sex, contact details, your health checks and survey answers, and any prayer request.'],
 ['Why','To screen your health today and give you a home plan. Only if you agree to follow-up will you be contacted afterwards by WhatsApp, email or phone.'],
 ['Who sees it',`Only the approved health team of ${churchName()}. It is never sold. If you ask for your plan on WhatsApp or by email, it is sent through that service.`],
 ['How long',`Your health readings and any prayer request are deleted ${GRACE_DAYS} days after your visit. If you agree to follow-up, only your name and contact details are kept, for up to ${RETENTION_YEARS} years after your last visit.`],
 ['Your choice','Taking part is voluntary. Without the screening consent we cannot record your checks. Follow-up is your choice and you may stop it at any time.'],
 ['Your rights','You may see, correct or ask us to delete your information at any time, and object to its use. Complaints: the Information Regulator, www.inforegulator.org.za.'],
];
const noticeHTML=()=>`<dl class="mt-2 space-y-1.5 text-[11px] leading-snug text-[#33504f]">${noticeRows().map(([t,d])=>`<div><dt class="inline font-bold">${t}: </dt><dd class="inline">${esc(d)}</dd></div>`).join('')}</dl>`;
export const hasConsent=a=>!!(a&&a.interests&&a.interests.consent);
export const optedIn=a=>!!(a&&a.interests&&a.interests.optin);
const isMinor=age=>Number(age)>0&&Number(age)<18;
/* the notice and ticks; p is the id prefix ('rg' on the registration form, 'cs' on a passport with no consent yet) */
function consentFields(p,minor){
 return `<div class="rounded-2xl border border-[#123033]/[.07] bg-white/60 p-3">
  <div class="microlabel">Consent (POPIA) · ask the visitor</div>
  <p class="mt-1 text-[13px] font-bold leading-snug text-[#123033]">“${CONSENT_Q}”</p>
  <label class="mt-2 flex items-start gap-2 text-[12px] leading-snug text-[#123033]"><input id="${p}Consent" type="checkbox" class="mt-0.5 h-4 w-4 flex-none">
   <span><b>Yes, they consent.</b> Required to record the checks.</span></label>
  <label class="mt-2 flex items-start gap-2 text-[12px] leading-snug text-[#123033]"><input id="${p}Optin" type="checkbox" class="mt-0.5 h-4 w-4 flex-none">
   <span>May we contact you afterwards about your results, seminars and classes? <b>Optional.</b></span></label>
  <details class="mt-2"><summary class="text-[11px] font-semibold text-brand-800">What this consent covers (kept with the record) ▾</summary>${noticeHTML()}</details>
  <div id="${p}GuardianBox" class="mt-2.5 space-y-2 rounded-[14px] bg-amber-50/80 p-2.5" ${minor?'':'hidden'}>
   <div class="text-[11.5px] font-bold text-amber-800">Under 18: a parent or guardian must agree</div>
   <input id="${p}GuardianName" maxlength="80" placeholder="Parent or guardian’s full name" class="field">
   <label class="flex items-start gap-2 text-[12px] leading-snug text-[#123033]"><input id="${p}Guardian" type="checkbox" class="mt-0.5 h-4 w-4 flex-none">
    <span>This parent or guardian was asked and gives the consent above.</span></label>
  </div>
 </div>`;
}
export function showGuardian(p,age){const b=document.getElementById(p+'GuardianBox');if(b)b.hidden=!isMinor(Math.round(+String(age).trim()));}
/* reads the ticks: an error message, or the consent entries to keep in interests */
function readConsent(p,age){
 const on=id=>{const el=/** @type {HTMLInputElement|null} */ (document.getElementById(p+id));return !!(el&&el.checked);};
 if(!on('Consent'))return {err:'Ask the consent question and tick Yes: without it the checks cannot be recorded (POPIA).'};
 /* the screening yes is required; the follow-up yes is a separate, optional answer */
 const out={consent:true,optin:on('Optin'),consentOn:todayStr(),consentV:NOTICE_VERSION};
 if(isMinor(age)){
  const el=/** @type {HTMLInputElement|null} */ (document.getElementById(p+'GuardianName')),gn=el?String(el.value||'').trim().replace(/\s+/g,' ').slice(0,80):'';
  if(!gn||!on('Guardian'))return {err:'Under 18: type the parent or guardian’s name and tick their consent.'};
  out.guardian=true;out.guardianName=gn;
 }
 return {it:out};
}
/* a passport with no consent on record (registered before this step, or from an older device): ask before any check */
function consentCard(a){
 return `<div class="glass hue-tint hue-blush p-4">
  <div class="microlabel">Consent needed</div>
  <div class="display text-base font-extrabold">Ask ${esc(firstName(a.name))} first</div>
  <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">No consent is recorded for this passport, so its checks stay closed.</p>
  <div class="mt-3">${consentFields('cs',isMinor(a.age))}</div>
  <div id="csErr" class="st-warn mt-2" role="alert" hidden></div>
  <button class="btn btn-primary mt-3 w-full py-3 text-sm" data-action="recordConsent" data-args="${a.id}">Record consent & open the checks</button>
 </div>`;
}
export function recordConsent(id){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 const r=readConsent('cs',a.age),el=document.getElementById('csErr');
 if(r.err){if(el){el.textContent=r.err;el.hidden=false;}else toast(r.err);return;}
 a.interests=Object.assign({},a.interests,r.it);persist();renderMain();toast('Consent recorded ✓');
}
/* the follow-up yes can be changed later, or withdrawn (POPIA s11(2)) */
export function toggleOptin(id){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 a.interests=a.interests||{};a.interests.optin=!a.interests.optin;
 if(!a.interests.optin){delete a.interests.followUp;delete a.interests.followUpName;}
 persist();renderMain();toast(a.interests.optin?'Follow-up allowed ✓':'No follow-up contact — the record is deleted with the readings 7 days after the visit.');
}
/* problems are shown inside the form (not a passing toast), so nothing typed is lost */
function regError(html){const el=$('#rgErr');if(!el){toast(html.replace(/<[^>]+>/g,''));return;}el.innerHTML=html;el.hidden=!html;}
const normName=n=>String(n||'').toLowerCase().replace(/[^a-z]/g,'');
export function registerSubmit(e,force){
 if(e)e.preventDefault();
 regError('');
 const name=$('#rgName').value.trim().replace(/\s+/g,' ');
 const ageRaw=$('#rgAge').value.trim(),age=Math.round(+ageRaw);
 const sex=$('#rgSex').value,phone=$('#rgPhone').value.trim(),hRaw=$('#rgHeight').value.trim().replace(',','.');
 const email=$('#rgEmail')?$('#rgEmail').value.trim().slice(0,200):'';
 if(!name)return regError('Type the visitor’s full name.');
 if(!ageRaw||!(age>=12&&age<=105))return regError('Type their age (12 to 105).');
 if(!sex)return regError('Choose Male or Female.');
 const h=hRaw===''?null:+hRaw;
 if(h!=null&&!(h>=100&&h<=220))return regError(`Height ${esc(hRaw)} cm cannot be right (100–220). Leave it empty if not measured.`);
 if(phone&&!waNumber(phone))return regError('That WhatsApp number looks incomplete. Check it (for example 082 123 4567), or leave it empty.');
 if(email&&!validEmail(email))return regError('That email address does not look right. Check it, or leave it empty.');
 const cons=readConsent('rg',age);
 if(cons.err)return regError(cons.err);
 /* the id is used in handlers and matched against scanned QR codes, so it must be a clean EXPO-nnn */
 const raw=$('#rgBadge').value.trim()||nextBadge();   /* no badge scanned or typed: the next free number */
 const id=parseBadge(raw);
 if(!id)return regError('A badge looks like EXPO-042.');
 const taken=attendees.find(x=>x.id===id);
 if(taken)return regError(`${id} already belongs to ${esc(taken.name)}. Use a different lanyard.`);
 /* the same person twice gives two half-filled passports: ask first (name, last 9 phone digits, or email) */
 const digits=phone.replace(/\D/g,'').slice(-9);
 /* a new visit of a past visitor is the same person on purpose, so their old passport is not a duplicate */
 const dup=!force&&attendees.find(x=>x.id!==state.newVisitOf&&(normName(x.name)===normName(name)
   ||(digits.length===9&&String(x.phone||'').replace(/\D/g,'').slice(-9)===digits)
   ||(email&&String(x.email||'').toLowerCase()===email.toLowerCase())));
 if(dup)return regError(`${esc(dup.name)} may already be registered as <b>${esc(dup.id)}</b>.
   <span class="mt-2 flex gap-2"><button type="button" class="st-fix" style="background:#2b8074" data-action="switch-visitor" data-args="${dup.id}">Open ${esc(dup.id)}</button>
   <button type="button" class="st-fix" style="background:#6b8187" data-action="register-again">Register a new passport</button></span>`);
 const a=migrateAttendee({id,name,age,sex,phone:phone||'+27 —',email,heightCm:h,s:{},interests:cons.it,prayer:'',done:false});
 attendees.push(a);state.activeId=a.id;state.regOpen=false;state.pendingBadge=null;state.newVisitOf=null;state.sugFor=null;state._goal=null;
 switchTab('screen');toast(`${a.id} linked to ${firstName(a.name)} ✓ Start the checks`);
}
export function resetDemo(){
 if(cloud.user||cloud.mode){toast('Reset is off while connected to the shared database');return;}
 if(!confirm('Reset all demo data? Every visitor and volunteer you added on this device will be erased.'))return;
 seedDemo();state.sugFor=null;state._goal=null;render();toast('Demo data reset — storage cleared');
}
/* tapping a visitor in the list opens their passport where they left off */
export function switchTo(id){state.activeId=id;state.sugFor=null;state._goal=null;goVisit();toast(`Now serving ${firstName(A().name)} · ${id}`);}

/* ================= VIEW: SCREEN ================= */
/* A text field with a decimal keypad, not type="number": a number field silently empties "6,5", and South
   Africans write decimals with a comma. Each field has its own warning line under it. */
function stepperHTML(a,k,label,min,max,step,def){
 return `${label?`<div class="microlabel mb-1.5">${label}</div>`:''}
 <div class="flex items-center gap-1.5">
  <button type="button" data-action="step" data-id="${a.id}" data-k="${k}" data-dir="-1" data-min="${min}" data-max="${max}" data-step="${step}" data-def="${def}" class="step-btn" aria-label="Lower">−</button>
  <input id="in-${k}" type="text" inputmode="decimal" autocomplete="off" value="${disp(a.s[k])}" placeholder="—" aria-describedby="warn-${k}"
   data-on-input="station-input" data-id="${a.id}" data-k="${k}" data-min="${min}" data-max="${max}" data-on-change="station-commit" data-id="${a.id}" data-k="${k}" data-min="${min}" data-max="${max}" data-step="${step}"
   class="step-input">
  <button type="button" data-action="step" data-id="${a.id}" data-k="${k}" data-dir="1" data-min="${min}" data-max="${max}" data-step="${step}" data-def="${def}" class="step-btn" aria-label="Higher">+</button>
 </div>
 <p id="warn-${k}" class="st-warn" role="alert" hidden></p>`;
}
export function viewScreen(){
 const a=A(),d=doneCount(a),cbp=cat('bp',{sys:a.s.sys,dia:a.s.dia});
 const bpCard=`<div class="glass hue-tint hue-blush p-4">
  <div class="flex items-center justify-between">
   <div class="flex items-center gap-2.5">
    <span class="flex h-8 w-8 items-center justify-center rounded-[12px] text-[10px] font-extrabold ico">BP</span>
    <div><div class="text-[13px] font-bold leading-tight">Blood pressure</div><div class="text-[10px] text-[#6b8187]">mmHg — top / bottom</div></div>
   </div>
   <span id="chip-bp" class="${chipClass(cbp[0])}">${cbp[1]}</span>
  </div>
  <div class="mt-3.5 st-bp">
   ${stepperHTML(a,'sys','Top (systolic)',70,210,1,120)}
   ${stepperHTML(a,'dia','Bottom (diastolic)',40,130,1,80)}
  </div>
  <div class="mt-3">${ynHTML(a,'bpMed','On BP medication')}</div></div>`;
 const cardOf=x=>{
  const chip=chipOf(a,x.k);
  const extra=`<span id="note-${x.k}" class="mono text-[10px] text-[#6b8187]">${chipNote(a,x.k)}</span>`;
  return `<div class="glass hue-tint hue-${x.hue} flex flex-col gap-3 p-4">
   <div class="flex items-center gap-2.5">
    <span class="flex h-8 w-8 flex-none items-center justify-center rounded-[12px] text-[10px] font-extrabold ico">${x.letter}</span>
    <div class="min-w-0 flex-1"><div class="text-[13px] font-bold leading-tight">${x.label}</div><div class="text-[10px] text-[#6b8187]">${x.hint}</div></div>
    <span class="flex flex-none flex-col items-end gap-1"><span id="chip-${x.k}" class="${chipClass(chip[0])}">${chip[1]}</span>${extra}</span>
   </div>
   ${stepperHTML(a,x.k,'',x.min,x.max,x.step,x.def)}
   ${x.k==='weight'?`<label class="st-height"><span>Height</span><input id="in-height" type="text" inputmode="numeric" autocomplete="off" value="${a.heightCm||''}" placeholder="—" data-on-change="height-set" data-args="${a.id}"><span>cm</span></label>
    <p id="warn-height" class="st-warn" role="alert" ${a.heightCm?'hidden':''}>${a.heightCm?'':'Add their height for the BMI.'}</p>`:''}
   ${(x.more||[]).map(m=>stepperHTML(a,m[0],m[1],m[2],m[3],m[4],m[5])).join('')}
   ${x.k==='fat'||x.k==='tbw'||x.k==='waist'?(SEX_RANGE[x.k][a.sex]?'':'<p class="st-warn">Choose Male or Female at registration for the range.</p>'):''}
  </div>`};
 const ms=myStation(),one=ms&&ms!=='bp'?STATION_DEFS.concat(EXTRA_DEFS).find(x=>x.k===ms):null;
 /* POPIA: no consent on record, no checks */
 if(attendees.some(x=>x.id===a.id)&&!hasConsent(a))return `<section class="stagger space-y-3">${consentCard(a)}</section>`;
 /* a visit past the grace period takes no new readings: the database would clear them on upload */
 if(attendees.some(x=>x.id===a.id)&&visitIsOld(a))return `<section class="stagger space-y-3">${pastVisitCard(a)}</section>`;
 return `<section class="stagger space-y-3">
  <div id="redBanner" class="${redFlag(a)?'':'hidden'} flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/90 p-4 text-rose-700">
   <span class="flex h-8 w-8 flex-none items-center justify-center rounded-[12px] bg-rose-500/15 font-extrabold">!</span>
   <div><div class="text-[11px] font-extrabold uppercase tracking-wider">Clinical red flag</div>
   <p class="mt-1 text-[11px] leading-relaxed text-rose-600/90">BP ≥ 160/100, or sugar ≥ 15 or under 3: do NOT run the step test. Send the visitor to the triage nurse now.</p></div>
  </div>

  <div class="glass p-4">
   <div class="flex items-center justify-between">
    <div><div class="microlabel">Station screening</div>
    <div class="display text-base font-extrabold">${esc(firstName(a.name))}'s 8 checks</div></div>
    <span id="stProgTxt" class="mono text-xs font-bold text-brand-700">${d}/8</span>
   </div>
   <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-[#123033]/[.08]">
     <div id="stProgBar" class="bar-fill" style="width:${d/8*100}%"></div></div>
   <p class="mt-2.5 text-[11px] leading-snug text-[#5c747a]">Tap − / + or type a number. Chips turn amber / rose when a value needs attention.</p>
  </div>

  ${stationPicker()}
  ${!ms||ms==='bp'?bpCard:''}
  ${one?`<div class="st-one">${cardOf(one)}</div>`:ms?'':`<div class="st-grid">${STATION_DEFS.map(cardOf).join('')}</div>
  <div class="glass p-4"><div class="microlabel">Personal Health Record</div>
   <div class="display text-base font-extrabold">The rest of the paper record</div>
   <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Not part of the 8 checks. Fill in what was measured.</p></div>
  ${historyCard(a)}
  <div class="st-grid">${EXTRA_DEFS.map(cardOf).join('')}</div>
  ${surveyCard(a)}`}
  ${ms?`<p class="text-center text-[12px] text-[#4f6870]">Saved automatically ✓ Only your station is shown. <button class="tap-link" data-action="setMyStation" data-args="">Show all 8 checks</button></p>`
   :followUpCard(a)}
 </section>`;
}
/* A returning visitor scanned with an old badge: that visit is closed, so the checks start on a new passport */
function pastVisitCard(a){
 return `<div class="glass hue-tint hue-sky p-4">
  <div class="microlabel">Past visit</div>
  <div class="display text-base font-extrabold">${esc(firstName(a.name))}’s visit was more than ${GRACE_DAYS} days ago</div>
  <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Readings of a past visit are deleted after ${GRACE_DAYS} days, so this passport takes no new checks. Register today’s visit on a new badge: their details are filled in, and they are asked for consent again.</p>
  <button class="btn btn-primary mt-3 w-full py-3 text-sm" data-action="new-visit" data-args="${a.id}">Register as a new visit</button>
 </div>`;
}
/* opens New visitor with the past visit's details; the badge is new and the consent is asked again */
export function newVisitFrom(id){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 state.regOpen=true;state.pendingBadge=null;state.newVisitOf=a.id;
 switchTab('home');
 const put=(sel,v)=>{const el=/** @type {HTMLInputElement|null} */ ($(sel));if(el&&v)el.value=String(v);};
 put('#rgName',a.name);put('#rgAge',a.age||'');put('#rgPhone',a.phone==='+27 —'?'':a.phone);put('#rgEmail',a.email);
 const sx=document.querySelector(`[data-action="pick-sex"][data-sex="${a.sex}"]`);if(sx)pickSex(sx);
 showGuardian('rg',a.age);
}
/* "My station": a station volunteer sees only the check they do, so nothing to scroll past. Kept on this phone. */
const MS_KEY='newstart.myStation';
function myStation(){if(state.myStation===undefined){try{state.myStation=localStorage.getItem(MS_KEY)||'';}catch(e){state.myStation='';}}return state.myStation;}
export function setMyStation(k){state.myStation=k;try{k?localStorage.setItem(MS_KEY,k):localStorage.removeItem(MS_KEY);}catch(e){}renderMain();}
function stationPicker(){
 const ms=myStation(),opts=[['','All 8 checks'],['bp','Blood pressure'],...STATION_DEFS.concat(EXTRA_DEFS).map(x=>[x.k,x.label])];
 return `<div class="glass p-3.5"><div class="microlabel">Your station</div>
  <div class="fd-chips mt-2" role="group" aria-label="Your station">${opts.map(([k,l])=>`<button class="fd-chip hue-mint" aria-pressed="${k===ms}" data-action="setMyStation" data-args="${k}">${l}</button>`).join('')}</div></div>`;
}
/* A Yes / No pair, as circled on the paper form. Tapping the chosen answer again clears it. */
function ynHTML(a,k,label){
 const v=a.s[k],b=(val,l)=>`<button type="button" class="availpill hue-mint ${v===val?'availpill-on':''}" aria-pressed="${v===val}" data-action="answer-set" data-id="${a.id}" data-k="${k}" data-val="${val}">${l}</button>`;
 return `<div class="flex flex-wrap items-center justify-between gap-2"><span class="text-[12px] font-semibold text-[#33504f]">${label}</span>
  <span class="flex gap-1.5">${b(1,'Yes')}${b(0,'No')}</span></div>`;
}
/* top right of the paper record: pregnant, major operations, chronic illnesses (and which) */
function historyCard(a){
 return `<div class="glass hue-tint hue-lilac space-y-2.5 p-4">
  <div class="text-[13px] font-bold leading-tight">Medical history</div>
  ${MED_YN.filter(([k])=>k!=='bpMed'&&(k!=='preg'||a.sex!=='Male')).map(([k,l])=>ynHTML(a,k,l)).join('')}
  ${a.s.chronic===1?`<label class="block"><span class="microlabel">Which chronic illnesses?</span>
   <input type="text" maxlength="200" class="field mt-1" value="${esc(a.chronicList||'')}" placeholder="For example diabetes, asthma"
    data-on-input="chronic-list" data-args="${a.id}"></label>`:''}
 </div>`;
}
/* the Health Age Survey; sleep is the Sleep check above, so it is not asked twice */
function surveyCard(a){
 return `<div class="glass p-4">
  <div class="microlabel">Health age survey</div>
  <div class="display text-base font-extrabold">How does ${esc(firstName(a.name))} live?</div>
  ${SURVEY.map(x=>`<div class="mt-3"><div class="text-[12px] font-semibold text-[#33504f]">${x.q}</div>
   <div class="mt-1.5 flex flex-wrap gap-1.5">${x.a.map((l,i)=>`<button type="button" class="availpill hue-sand ${a.s[x.k]===i+1?'availpill-on':''}" aria-pressed="${a.s[x.k]===i+1}" data-action="answer-set" data-id="${a.id}" data-k="${x.k}" data-val="${i+1}">${l}</button>`).join('')}</div></div>`).join('')}
 </div>`;
}
export function setAnswer(id,k,v){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 a.s[k]=a.s[k]===v?null:v;
 persist();renderMain();
}
export function onChronicList(id,v){const a=attendees.find(x=>x.id===id);if(!a)return;a.chronicList=String(v||'').slice(0,200);persist();}
/* What the visitor asked for and their prayer request. These are what fill the Care lists for the ministry team. */
const INT_HUE={nurse:'blush',cook:'sage',stress:'lilac',pouch:'peach'};
export function followUpCard(a){
 const known=attendees.some(x=>x.id===a.id);
 if(!known)return '';
 return `<div class="glass p-4">
  <div class="microlabel">Follow-up</div>
  <div class="display text-base font-extrabold">What did ${esc(firstName(a.name))} ask for?</div>
  <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Tick anything they would like. It goes straight onto the Care lists for the team.</p>
  <div class="mt-3 flex flex-wrap gap-1.5">
   ${Object.keys(INT).map(k=>{const on=!!(a.interests&&a.interests[k]);
    return `<button type="button" data-action="interest-toggle" data-id="${a.id}" data-k="${k}" class="availpill hue-${INT_HUE[k]} ${on?'availpill-on':''}" aria-pressed="${on}">${on?'✓ ':''}${INT[k]}</button>`;}).join('')}
  </div>
  <div class="mt-3 rounded-[14px] bg-white/60 p-2.5">
   <div class="flex items-center justify-between gap-2"><span class="text-[12px] font-semibold text-[#33504f]">May the church contact them after the expo?</span>
    <button type="button" data-action="toggleOptin" data-args="${a.id}" class="availpill hue-mint ${optedIn(a)?'availpill-on':''}" aria-pressed="${optedIn(a)}">${optedIn(a)?'✓ Yes':'No'}</button></div>
   <p class="mt-1 text-[10.5px] text-[#6b8187]">Consent given ${esc(a.interests.consentOn||'(date not recorded)')}${a.interests.guardianName?` by ${esc(a.interests.guardianName)} (parent or guardian)`:''}. To withdraw it, a church admin deletes the record.</p>
   <details class="mt-1"><summary class="text-[10.5px] font-semibold text-brand-800">What they agreed to${a.interests.consentV?` (notice of ${esc(a.interests.consentV)})`:''} ▾</summary>
    ${!a.interests.consentV||a.interests.consentV===NOTICE_VERSION?noticeHTML():'<p class="mt-1 text-[10.5px] text-[#6b8187]">An older version of the notice; this app now shows the '+NOTICE_VERSION+' version.</p>'}</details>
  </div>
  <div class="microlabel mt-3">Free seminars they would attend</div>
  <div class="mt-1.5 flex flex-wrap gap-1.5">${pillsHTML(a,SEMINARS,'sage')}</div>
  <div class="microlabel mt-3">How did they hear about the expo?</div>
  <div class="mt-1.5 flex flex-wrap gap-1.5">${pillsHTML(a,HEARD,'sky')}</div>
  <label class="mt-3 block"><span class="microlabel">Prayer request (optional)</span>
   <textarea id="prayerNote" rows="3" maxlength="500" class="field mt-1" placeholder="Anything they would like us to pray for"
    data-on-input="prayer-set" data-args="${a.id}">${esc(a.prayer||'')}</textarea></label>
 </div>`;
}
export function toggleInterest(btn,id,k){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 a.interests=a.interests||{};a.interests[k]=!a.interests[k];
 const on=!!a.interests[k];
 if(btn){btn.classList.toggle('availpill-on',on);btn.textContent=(on?'✓ ':'')+INT[k];btn.setAttribute&&btn.setAttribute('aria-pressed',String(on));}
 persist();
}
/* tick boxes kept in interests, like the follow-up asks: SEMINARS and HEARD */
const pillsHTML=(a,set,hue)=>Object.keys(set).map(k=>{const on=!!(a.interests&&a.interests[k]);
 return `<button type="button" data-action="tick-toggle" data-id="${a.id}" data-k="${k}" class="availpill hue-${hue} ${on?'availpill-on':''}" aria-pressed="${on}">${on?'✓ ':''}${set[k]}</button>`;}).join('');
export function toggleTick(btn,id,k){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 a.interests=a.interests||{};a.interests[k]=!a.interests[k];
 const on=a.interests[k],l=SEMINARS[k]||HEARD[k];
 btn.classList.toggle('availpill-on',on);btn.textContent=(on?'✓ ':'')+l;btn.setAttribute('aria-pressed',String(on));
 persist();
}
export function onPrayer(id,v){const a=attendees.find(x=>x.id===id);if(!a)return;a.prayer=String(v||'').slice(0,500);persist();}
export function reservePouch(){
 const a=attendees.find(x=>x.id===state.activeId);
 if(!a){toast('Register a visitor first');return;}
 a.interests=a.interests||{};
 a.interests.pouch=!a.interests.pouch;
 persist();renderMain();
 toast(a.interests.pouch?`R25 starter pouch reserved for ${firstName(a.name)} ✓`:'Pouch reservation removed');
}
/* − / + start from a typical value when the field is empty, then move in steps */
export function onStep(id,k,d,min,max,step,def){
 const a=attendees.find(x=>x.id===id); if(!a)return;
 a.s[k]=a.s[k]==null?def:clamp(Math.round((a.s[k]+d*step)*10)/10,min,max);
 const inp=/** @type {HTMLInputElement|null} */ (document.getElementById('in-'+k)); if(inp){inp.value=disp(a.s[k]);jelly(inp);}
 readingWarn(k,'');crossCheck(a);updateScreenMeta();
}
/* "6,5" and "6.5" are the same reading; anything that is not plain digits is not a reading */
const parseReading=raw=>{const t=String(raw).trim().replace(',','.');return /^\d+(\.\d+)?$/.test(t)?parseFloat(t):NaN;};
function readingWarn(k,msg,fix){
 const el=document.getElementById('warn-'+k),inp=document.getElementById('in-'+k);
 if(inp){inp.classList.toggle('is-bad',!!msg);inp.setAttribute('aria-invalid',msg?'true':'false');}
 if(!el)return;
 el.hidden=!msg;el.dataset.cross='';
 el.innerHTML=msg?esc(msg)+(fix!=null?` <button type="button" class="st-fix" data-action="reading-apply" data-args="${k}" data-fix="${fix}">Use ${disp(fix)}</button>`:''):'';
}
/* while typing: save only a complete, possible value; a half-typed "14" (on the way to 140) is simply not saved yet */
export function onStationInput(id,k,el,min,max){
 const a=attendees.find(x=>x.id===id); if(!a)return;
 const raw=el.value.trim(),v=parseReading(raw);
 a.s[k]=raw!==''&&!isNaN(v)&&v>=min&&v<=max?v:null;
 if(a.s[k]!=null||raw==='')readingWarn(k,'');
 updateScreenMeta();
}
/* on leaving the field: a wrong value is never changed into a different one. It is not saved, and the volunteer is
   told why. A missed decimal point (72 for 7.2) is offered as a one-tap fix. */
export function onStationCommit(id,k,el,min,max,step){
 const a=attendees.find(x=>x.id===id); if(!a)return;
 const raw=el.value.trim(),v=parseReading(raw);
 if(raw===''){a.s[k]=null;readingWarn(k,'');}
 else if(isNaN(v)){a.s[k]=null;readingWarn(k,`“${raw}” is not a number. Type digits only, for example ${disp(step<1?5.5:120)}.`);}
 else if(v<min||v>max){
  a.s[k]=null;
  const d=Math.round(v)/10,fix=step<1&&d>=min&&d<=max?d:null;
  readingWarn(k,`${disp(v)} cannot be right (possible: ${min}–${max}). Not saved: check and type it again.${fix!=null?` Did you mean ${disp(fix)}?`:''}`,fix);
 }else{a.s[k]=v;el.value=disp(v);readingWarn(k,'');}
 crossCheck(a);updateScreenMeta();
}
/* height lives on the passport, not in the readings; the Weight station can add or correct it */
export function onHeight(id,el){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 const raw=el.value.trim().replace(',','.'),v=+raw,w=document.getElementById('warn-height');
 if(raw===''){a.heightCm=null;if(w){w.hidden=false;w.textContent='Add their height for the BMI.';}}
 else if(!(v>=100&&v<=220)){if(w){w.hidden=false;w.textContent=raw+' cm cannot be right (100–220). Not saved.';}el.classList.add('is-bad');return;}
 else{a.heightCm=Math.round(v);el.value=a.heightCm;if(w)w.hidden=true;}
 el.classList.remove('is-bad');updateScreenMeta();
}
export function applyReading(k,v){
 const a=A();a.s[k]=v;const el=/** @type {HTMLInputElement|null} */ (document.getElementById('in-'+k));if(el)el.value=disp(v);
 readingWarn(k,'');crossCheck(a);updateScreenMeta();
}
/* the bottom blood-pressure number is always lower than the top one; keep the values, but ask for a re-check */
function crossCheck(a){
 const el=document.getElementById('warn-dia');if(!el)return;
 const bad=a.s.sys&&a.s.dia&&a.s.dia>=a.s.sys;
 if(bad){readingWarn('dia','The bottom number should be lower than the top one. Check both readings.');el.dataset.cross='1';}
 else if(el.dataset.cross==='1')readingWarn('dia','');
}
function updateScreenMeta(){
 const a=A(); if(!a)return;
 const setChip=(idc,c)=>{const el=document.getElementById(idc);if(el){if(el.textContent!==c[1])jelly(el);el.textContent=c[1];el.className=chipClass(c[0]);}};
 setChip('chip-bp',cat('bp',{sys:a.s.sys,dia:a.s.dia}));
 STATION_DEFS.concat(EXTRA_DEFS).forEach(x=>{setChip('chip-'+x.k,chipOf(a,x.k));
  const n=document.getElementById('note-'+x.k);if(n)n.textContent=chipNote(a,x.k);});
 const d=doneCount(a);
 const t=document.getElementById('stProgTxt');if(t)t.textContent=d+'/8';
 const b=document.getElementById('stProgBar');if(b)b.style.width=(d/8*100)+'%';
 const rb=document.getElementById('redBanner');
 if(rb){rb.classList.toggle('hidden',!redFlag(a));rb.classList.toggle('flex',redFlag(a));}
 const nc=document.getElementById('navCount');if(nc)nc.textContent=d+'/8';
 const jc=document.getElementById('jrCount');if(jc)jc.textContent=d<8?d+'/8':'';
 const jn=document.getElementById('jrNote');if(jn){jn.hidden=d===8;jn.textContent=`${8-d} of 8 checks still empty. You can carry on and come back.`;}
 persist();
}
