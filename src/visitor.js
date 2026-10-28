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
import { bannerHTML, capsuleHTML, ctaHTML, ecgHTML, rulerHTML, spectrumHTML, splitBtnHTML, tileHTML } from './ui.js';
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
  <button class="btn btn-primary jr-next" data-action="registerNew">Next visitor</button></div></div>`;
 return `<div class="jr-foot">
  ${state.tab==='screen'?`<p id="jrNote" class="jr-note" ${left>0?'':'hidden'}>${left} of 8 checks still empty. You can carry on and come back.</p>`:''}
  <div class="jr-btns">
   ${prev?`<button class="btn btn-glass jr-back" data-action="switchTab" data-args="${prev}">← ${JOURNEY_LABEL[prev]}</button>`:'<span></span>'}
   ${next?`<button class="btn btn-primary jr-next" data-action="switchTab" data-args="${next}">Next: ${JOURNEY_LABEL[next]} →</button>`
    :`<button class="btn btn-primary jr-next" data-action="finishVisit">${a.done?'Visit complete ✓ · Home':'Finish visit ✓'}</button>`}
  </div>
 </div>`;
}
/* the team's follow-up line follows the recorded answer: contact allowed or not, then anything specific they asked for */
function followUpLine(a,first,asked){
 const list=asked.length?`<b>${asked.map(esc).join(', ')}</b>`:'';
 if(!optedIn(a))return asked.length?`${first} ticked ${list}, but did not agree to be contacted, so no one will follow up.`
  :`${first} did not agree to be contacted after the expo.`;
 return asked.length?`${first} agreed to follow-up and asked for: ${list}.`
  :`${first} agreed to follow-up, with nothing specific asked for yet.`;
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
   <p class="mt-1 text-[11.5px] leading-relaxed text-[#3d5c5e]">${followUpLine(a,first,asked)}
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
  <p class="mx-auto mt-1.5 max-w-[30ch] text-[11px] leading-relaxed text-[#5b7178]">Register a visitor first — their numbers appear here.</p>
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
 const step=state.stepFor===a.id&&JOURNEY.includes(state.step)?state.step:defaultStep(a);
 const stepIdx=JOURNEY.indexOf(step),pct=Math.round(((stepIdx+1)/4)*100);
  const num=String(a.id||'').replace(/^EXPO-/,'');
 const tri={flag:0,watch:0,ok:0,none:0};
 for(const x of attendees){
  const cs=[cat('bp',{sys:x.s.sys,dia:x.s.dia}),cat('sugar',x.s.sugar),cat('bmi',bmi(x))];
  if(redFlag(x)||cs.some(z=>z[0]==='flag'))tri.flag++;
  else if(cs.some(z=>z[0]==='watch'))tri.watch++;
  else if(cs.every(z=>z[0]==='ok'))tri.ok++;
  else tri.none++;
 }
 const spec=[tri.flag,tri.watch,tri.ok,tri.none,0];
 const ctaLabel=a.done?`Open ${firstName(a.name)}’s passport`:`Continue: ${JOURNEY_LABEL[step]}`;
 return `<section class="stagger space-y-3.5">
  ${!attendees.length?`<div class="hx-hero" style="text-align:center">
   <div class="hx-eyebrow">Community screening</div>
   <div class="hx-id" style="font-size:36px;letter-spacing:-1px">No visitors yet</div>
   <p style="margin:4px auto 0;max-width:32ch;font-size:11.5px;line-height:1.5;color:var(--hx-hero-sub)">${cloud.mode?'The shared database is empty. ':''}Register a new visitor to begin.</p>
   <button data-action="toggleReg" class="btn btn-primary mt-4 w-full py-3 text-sm">+ Register first visitor</button>
  </div>`:`<div class="hx-hero">
   <div style="position:absolute;inset:0;top:50%;transform:translateY(-50%)">${ecgHTML()}</div>
   <div style="position:relative">
    <div class="hx-hero-top">
     <button data-action="switcher-open" class="hx-staff" aria-label="Switch visitor">
      <span class="av hue-${hueOf(a.id)} hx-staff-av">${initials(a.name)}</span>
      <span class="hx-staff-meta"><b>${esc(firstName(a.name))}</b><span>· ${esc(a.id)}</span></span>
      ${I.chevD}
     </button>
     <span class="hx-hero-tools">
      <button data-action="toggleTheme" class="hx-theme" aria-label="Switch light or dark">
       ${I.sun}<span class="hx-theme-light">Light</span><span class="hx-theme-dark">Dark</span>
      </button>
      <button data-action="openCloud" class="hx-round" aria-label="Cloud sync" title="Cloud sync">
       <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6.5 19z"/></svg>
       <span id="homeCloudDot" class="hx-cloud-dot"></span>
      </button>
      <button data-action="openNotifs" class="hx-round" aria-label="Notifications">
       ${I.bell}<span id="homeNotifDot" class="hx-notif-dot"></span>
      </button>
     </span>
    </div>
    <div style="text-align:center;margin-top:6px">
     <div class="hx-eyebrow">Now serving visitor</div>
     <div class="hx-id">${esc(num)}</div>
     <div class="hx-name">${esc(a.name)} <span>· ${a.age}y ${esc(a.sex)}</span></div>
     <div style="margin-top:10px">${capsuleHTML(a.done?'Completed · all checks recorded':`Step ${stepIdx+1} of 4 · ${JOURNEY_LABEL[step]}`)}</div>
     ${rulerHTML(pct)}
    </div>
   </div>
  </div>

  ${cloud.demo&&!cloud.user?`<div class="hx-practice">
   <div class="hx-practice-copy"><b>Practice Mode Active</b><span>Demo visitors · Safe offline training</span></div>
   <button data-action="openCloud" class="hx-practice-go" aria-label="Sign in">${splitBtnHTML({label:'Sign in'})}</button>
  </div>`:''}

  <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
   ${tileHTML({label:'Blood pressure',icon:I.pulse,value:`${a.s.sys??'—'}/${a.s.dia??'—'}`,status:cbp[1],tone:'ruby',pill:true})}
   ${tileHTML({label:'Blood sugar',icon:I.drop,value:a.s.sugar==null?'—':fmt1(a.s.sugar),status:csg[1],tone:'amber',pill:true})}
   ${tileHTML({label:'Body BMI',icon:I.scale,value:bmi(a)?fmt1(bmi(a)):'—',status:cbm[1],tone:'cobalt',pill:true})}
  </div>

  ${redFlag(a)?`<div style="display:flex;gap:8px;padding:10px 12px;border-radius:16px;background:var(--hx-rose-bg);border:1px solid var(--hx-rose-line);color:var(--hx-rose);font-size:11px;font-weight:700;line-height:1.35">
    <span>⚠</span><span>Clinical red flag: skip the fitness test and refer to the triage nurse now.</span></div>`:''}

  <button data-action="goVisit" style="display:block;width:100%;border:0;background:none;padding:0;cursor:pointer" aria-label="${esc(ctaLabel)}">
   ${ctaHTML({label:ctaLabel})}
  </button>`}

  ${state.regOpen?`<div class="glass p-4">
   <div class="display text-sm font-extrabold">New visitor</div>
   <div class="mt-0.5 text-[11px] leading-snug text-[#5c747a]">Takes about 30 seconds. Their number is given automatically.</div>
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
    <div><span class="microlabel">Visitor number</span>
     <div id="rgNumber" class="field mono mt-1 font-bold text-brand-900" style="background:rgba(58,165,151,.09);border-color:rgba(58,165,151,.3)">${nextBadge()}</div>
     <p class="mt-1 text-[10.5px] text-[#6b8187]">Given automatically. Find them later by name or number.</p></div>
    ${consentFields('rg',false)}
    <div id="rgErr" class="st-warn" role="alert" hidden></div>
    <button class="btn btn-primary w-full py-3 text-sm">Register & start the checks →</button>
   </form>
  </div>`:''}

  <div class="hx-ivory">
   <div class="hx-ivory-head">
    <div><h3>Visitors today</h3><p class="hx-ivory-sub">Tap a visitor row to inspect live vitals</p></div>
    <div style="display:flex;gap:6px;flex:none">
     <button data-action="toggleReg" class="hx-round hx-round-ivory" aria-label="Register a new visitor" aria-expanded="${!!state.regOpen}">${I.plus}</button>
     <button data-action="openSwitcher" class="hx-round hx-round-ivory" aria-label="Find or switch visitor">${I.chevD}</button>
    </div>
   </div>
   ${cloud.user?`<div id="homeHealth">${homeHealthHTML()}</div>`:''}
   <div class="hx-sheet-meta"><strong>Screening Spectrum</strong><span>VN: ${attendees.length} Active · 4 Steps</span></div>
   ${spectrumHTML(spec)}
   ${attendees.length>LIST_CAP?`<input id="vq" type="search" placeholder="Search ${attendees.length} visitors by name, badge or phone" value="${esc(state.vq||'')}"
     data-on-input="visitors-filter" class="field mb-2" autocomplete="off">`:''}
   <div id="visitorList">${visitorListHTML(state.vq)}</div>
   <div class="hx-sheet-actions">
    ${cloud.user||cloud.mode?'':`<button data-action="resetDemo">Reset demo</button>`}
    ${installEvt?`<button data-action="installApp">Install app</button>`:''}
    <button data-action="openCloud">${cloud.user?'Sync':'Sign in'}</button>
   </div>
  </div>

  <button data-action="openVolModal" class="hx-banner" style="width:100%;text-align:left;font:inherit;cursor:pointer">
   <span class="hx-banner-top"><span>${esc(EXPO_UPCOMING.name)}</span><em>${esc(hiredCountLabel())}</em></span>
   <span class="hx-banner-bottom"><strong>Pledge &amp; Booth Registration</strong>${splitBtnHTML({label:'Details',variant:'mint'})}</span>
   <span class="hx-banner-note">Pledge to help · pick your booth${esc(pendingLabel())}</span>
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
 const act=x.id===state.activeId,d=doneCount(x);
 const cbp=cat('bp',{sys:x.s.sys,dia:x.s.dia}),csg=cat('sugar',x.s.sugar);
 const dot=redFlag(x)?'#dc3522':(cbp[0]==='watch'||csg[0]==='watch')?'#d97706':'#22c55e';
 const line=`BP ${x.s.sys??'—'}/${x.s.dia??'—'} · ${cbp[1]}`;
 const n=JOURNEY.indexOf(defaultStep(x))+1;
 return `<button data-action="switchTo" data-args="${x.id}" class="hx-row${act?' is-on':''}" style="font:inherit;text-align:left">
  <span class="hx-row-main"><span class="hx-row-dot" style="background:${dot}"></span>
   <span><strong class="hx-row-name">${esc(x.name)}${x.done?' ✓':''}</strong><span class="hx-row-sub">${esc(x.id)} · ${esc(line)} · ${d}/8 checks</span></span></span>
  <span class="hx-row-badge">${n} / 4</span></button>`;
}
function visitorListHTML(query){
 const rows=visitorsToShow(query),q=String(query||'').trim();
 if(!rows.length)return `<p class="px-1 py-3 text-center text-[11px] text-[#6b8187]">${q?'Nobody matches “'+esc(q)+'”.':'No visitors yet.'}</p>`;
 const more=(q?0:attendees.length-rows.length);
 return rows.map(visitorRowHTML).join('')+(more>0?`<p class="px-1 pt-2 text-center text-[10px] font-semibold text-[#6b8187]">Latest ${rows.length} of ${attendees.length} — search to find anyone else.</p>`:'');
}
export function filterVisitors(v){state.vq=v;const el=$('#visitorList');if(el)el.innerHTML=visitorListHTML(v);}
/* the next visitor number: one above the highest this phone knows (a signed-in phone holds the whole church's list),
   EXPO-001 on a fresh start. A clash with another desk is settled on upload (resolveConflict in account.js). */
export function nextBadge(){
 let max=0;
 for(const a of attendees){const m=/^EXPO-(\d+)$/.exec(a.id);if(m&&+m[1]>max)max=+m[1];}
 return 'EXPO-'+String(max+1).padStart(3,'0');
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
 return `<div class="glass hue-blush p-4">
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
 /* the number is given here, not typed; another desk taking the same one at the same moment is settled on upload */
 const id=nextBadge();
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
 attendees.push(a);state.activeId=a.id;state.regOpen=false;state.newVisitOf=null;state.sugFor=null;state._goal=null;
 switchTab('screen');toast(`${firstName(a.name)} is ${a.id} ✓ Start the checks`);
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
 const bpCard=`<div class="glass hue-blush p-4">
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
  return `<div class="glass hue-${x.hue} flex flex-col gap-3 p-4">
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
/* A returning visitor opened by an old number: that visit is closed, so the checks start on a new passport */
function pastVisitCard(a){
 return `<div class="glass hue-sky p-4">
  <div class="microlabel">Past visit</div>
  <div class="display text-base font-extrabold">${esc(firstName(a.name))}’s visit was more than ${GRACE_DAYS} days ago</div>
  <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Readings of a past visit are deleted after ${GRACE_DAYS} days, so this passport takes no new checks. Register today’s visit on a new badge: their details are filled in, and they are asked for consent again.</p>
  <button class="btn btn-primary mt-3 w-full py-3 text-sm" data-action="new-visit" data-args="${a.id}">Register as a new visit</button>
 </div>`;
}
/* opens New visitor with the past visit's details; the badge is new and the consent is asked again */
export function newVisitFrom(id){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 state.regOpen=true;state.newVisitOf=a.id;
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
 return `<div class="glass hue-lilac space-y-2.5 p-4">
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
