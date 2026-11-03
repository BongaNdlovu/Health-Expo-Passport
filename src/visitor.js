// @ts-check
import { I } from './icons.js';
import { waNumber } from './volunteer.js';
import { INT } from './data.js';
import { $ } from './helpers.js';
import { A, SEX_RANGE, bmi, cat, chipClass, chipNote, chipOf, clamp, disp, doneCount, esc, firstName, fmt1, initials, redFlag } from './helpers.js';
import { EXPO_UPCOMING, EXTRA_DEFS, HEARD, MED_YN, SEMINARS, STATION_DEFS, SURVEY, attendees, hueOf, state } from './data.js';
import { JOURNEY, JOURNEY_LABEL, jelly, render, renderMain, toast } from './shell.js';
import { planFor, viewMetric } from './results.js';
import { followupPicker } from './churchPlans.js';
import { cloud, migrateAttendee, persist, seedDemo } from './state.js';
import { GRACE_DAYS, RETENTION_YEARS, visitIsOld } from './retention.js';
import { homeHealthHTML, installEvt, validEmail } from './cloud.js';
import { hiredCountLabel, mayPlace, pendingLabel, todayStr } from './volunteer.js';
import { bannerHTML, capsuleHTML, ctaHTML, ecgHTML, journeyRailHTML, rulerHTML, spectrumHTML, splitBtnHTML, tileHTML } from './ui.js';
import { confirmAsk } from './feedback.js';
import { qAskClear, qDemoClear, qLeaveServing, qStartAsk, queue, seedDemoQueue } from './queue.js';
import { QUEUE_OF_READING, queueConfirmGaps, queueFinishVisit, queueFlowStart, queueLineText, queueStripHTML, queueStripRefresh } from './queue.js';
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
   <span class="jr-name"><b>${esc(a.name)}</b><span>${esc(a.id)}${redFlag(a)?' · <em>⚠ emergency, attend quickly</em>':''}</span></span>
   <span class="jr-change">Change</span>
  </button>
  <div id="jrLine" class="jr-line"${queueLineText(a.id)?'':' hidden'}>${esc(queueLineText(a.id))}</div>
  ${a.id&&(!cloud.user||mayPlace())?`<div class="jr-tools"><button class="jr-remove" data-action="visitor-remove" data-args="${esc(a.id)}">Remove visitor</button></div>`:''}
  <ol class="jr-steps">${JOURNEY.map((k,j)=>`<li><button class="jr-step ${j===i?'is-on':j<i?'is-past':''}" ${k==='results'&&state.tab==='screen'?'data-action="confirmResults"':`data-action="switchTab" data-args="${esc(k)}"`} ${j===i?'aria-current="step"':''}>
   <span class="jr-dot">${done(k)&&j!==i?'✓':j+1}</span><span class="jr-lbl">${JOURNEY_LABEL[k]}${k==='screen'?` <small id="jrCount">${d<8?d+'/8':''}</small>`:''}</span></button></li>`).join('')}</ol>
 </div>`;
}
export function journeyBottom(){
 const a=A(),i=JOURNEY.indexOf(state.tab),prev=JOURNEY[i-1],next=JOURNEY[i+1],left=8-doneCount(a);
 /* the move from Check into Results asks the operator to confirm the readings (see confirmResults) */
 const nextBtn=k=>`<button class="btn btn-primary jr-next" ${k==='results'?'data-action="confirmResults"':`data-action="switchTab" data-args="${esc(k)}"`}>${k==='results'?'Next: Results':`Next: ${JOURNEY_LABEL[k]}`} →</button>`;
 /* Start and Finish for the volunteer's station sit above the buttons, where the thumb already is */
 const ms=myStation(),scope=ms?(QUEUE_OF_READING[ms]||null):'';
 const strip=state.tab==='screen'&&scope!==null?`<div id="jrQ" class="jr-q">${queueStripHTML(a,scope)}</div>`:'';
 /* a station volunteer's next move is the next visitor, not this visitor's results */
 if(state.tab==='screen'&&ms)return `<div class="jr-foot">${strip}<div class="jr-btns">
  <button class="btn btn-glass jr-back" data-action="confirmResults">Results →</button>
  ${scope?`<button class="btn btn-primary jr-next" data-action="queueNextInLine" data-args="${esc(scope)}">Next in line</button>`:`<button class="btn btn-primary jr-next" data-action="registerNew">Next visitor</button>`}</div></div>`;
 return `<div class="jr-foot">${strip}
  ${state.tab==='screen'?`<p id="jrNote" class="jr-note" ${left>0?'':'hidden'}>${left} of 8 checks still empty. You can carry on and come back.</p>`:''}
  <div class="jr-btns">
   ${prev?`<button class="btn btn-glass jr-back" data-action="switchTab" data-args="${esc(prev)}">← ${JOURNEY_LABEL[prev]}</button>`:'<span></span>'}
   ${next?nextBtn(next)
    :`<button class="btn btn-primary jr-next" data-action="finishVisit">${a.done?'Visit complete ✓ · Home':'Finish visit ✓'}</button>`}
  </div>
 </div>`;
}
/* The Check → Results gate (item 3). This is the moment the operator declares the readings complete, so the
   question names what is recorded and what is still blank rather than asking a generic "are you sure" (D-02,
   D-09). Confirming writes interests.submittedOn, the one marker that says the visit's readings were submitted;
   after that the question is not asked again and every value stays editable (D-08). */
function resultsBody(a){
 const have=[];
 if(a.s.sys!=null||a.s.dia!=null)have.push(`Blood pressure ${a.s.sys??'—'}/${a.s.dia??'—'}`);
 if(a.s.sugar!=null)have.push(`Blood sugar ${a.s.sugar} mmol/L`);
 if(bmi(a)!=null)have.push(`Body BMI ${fmt1(bmi(a))}`);
 /* the 8 checks, in the order the journey lists them */
 const checks=[['blood pressure',a.s.sys!=null&&a.s.dia!=null],['blood sugar',a.s.sugar!=null],['cholesterol',a.s.chol!=null],
  ['weight',a.s.weight!=null],['fruit and vegetables',a.s.veg!=null],['exercise',a.s.walk!=null],
  ['water',a.s.water!=null],['sleep',a.s.sleep!=null]];
 const missing=checks.filter(x=>!x[1]).map(x=>'No '+x[0]+' recorded');
 const lead=have.length?have.join(' · ')+'.':'No readings are recorded yet.';
 return `${lead} ${missing.length?missing.join(' · ')+'.':'All 8 checks are recorded.'} You can still edit them afterwards.`;
}
export async function confirmResults(){
 const a=A();
 if(!attendees.some(x=>x.id===a.id)){switchTab('screen');return;}
 /* one confirmation per visit: a confirmed visit goes straight on, so coming back later does not nag */
 if(a.interests&&a.interests.submittedOn){switchTab('results');return;}
 const yes=await confirmAsk({title:'Are you sure about these results?',body:resultsBody(a),
  label:'Yes, that is right',cancelLabel:'Edit'});
 if(!yes)return;                       /* Edit: stay on Check, every value untouched */
 a.interests=a.interests||{};
 a.interests.submittedOn=todayStr();
 queueConfirmGaps(a);                  /* the checks confirmed as not filled in are skipped in the queue too */
 persist();
 switchTab('results');
}
/* "Edit readings" on Results: back to Check with a.s untouched (D-08) */
export function editReadings(){switchTab('screen');}
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
 const item=(fn,ic,t,sub,on)=>`<button class="snd-item ${on?'is-on':''}" data-action="${esc(fn)}"><span class="snd-ic" aria-hidden="true">${ic}</span>
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
 /* going home: out of every line they are still in (the passport is saved first, whatever the queue says) */
 queueFinishVisit(a.id).then(more=>{if(more)toast(`${firstName(a.name)}’s visit is complete ✓${more}`);});
}
export function viewNoVisitor(){
 return `<section class="stagger space-y-3.5"><div class="glass p-5 text-center">
  <div class="display text-[16px] font-extrabold text-[#0f2a2c]">No visitor selected</div>
  <p class="mx-auto mt-1.5 max-w-[30ch] text-[11px] leading-relaxed text-[#5b7178]">Register a visitor first — their numbers appear here.</p>
  <button data-action="registerNew" class="btn btn-primary mt-3 w-full py-2.5 text-xs">Register a visitor →</button>
 </div></section>`;
}
export function switchTab(t){
 if(window.NSMem)window.NSMem.release('tab');                 /* timers that belong to the screen being left */
 /* opening Results, Plan or Send home finishes the check stations still serving this visitor (queue.js qLeaveServing) */
 if((t==='results'||t==='plan'||t==='send')&&state.activeId)qLeaveServing(state.activeId,t);
 if(JOURNEY.includes(t)){state.step=t;state.stepFor=state.activeId;}
 if(state.food)state.food.open=false;   /* tapping a tab (even Plan) leaves the Food screen — at the tap */
 if(t!=='screen'){state.metric='';state.metricFor='';}   /* the metric drill-down lives inside Check */
 if(t!=='plan'){state.customEdit=false;state.customDraft=null;}   /* the custom-plan editor belongs to the Plan screen */
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
 const spec=[tri.flag,tri.watch,tri.ok,tri.none];
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
      <button data-action="toggleTheme" class="hx-theme" aria-label="Switch light or dark" title="Switch light or dark">
       <svg class="hx-theme-light" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg><svg class="hx-theme-dark" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </button>
      <button data-action="openHelpHere" data-tour="help-btn-home" class="hx-round ns-help-round" aria-label="Help for this screen" title="Help">?</button>
      <button data-action="openCloud" class="hx-round" aria-label="Cloud sync" title="Cloud sync" data-tour="cloud-btn">
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
     <div style="margin-top:10px">${capsuleHTML(a.done&&doneCount(a)===8?'Completed · all checks recorded':a.done?`Finished · ${doneCount(a)} of 8 checks`:`Step ${stepIdx+1} of 4 · ${JOURNEY_LABEL[step]}`)}</div>   <!-- a visit can finish early: the header says how much of the 8 it has (V8a) -->
     ${rulerHTML(pct)}
    </div>
   </div>
  </div>

  ${cloud.demo&&!cloud.user?`<div class="hx-practice">
   <div class="hx-practice-copy"><b>Practice Mode Active</b><span>Demo visitors · nothing is shared</span></div>
   <button data-action="openCloud" class="hx-practice-go" aria-label="Sign in">${splitBtnHTML({label:'Sign in'})}</button>
  </div>`:''}

  <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
   <button type="button" data-action="openMetric" data-args="bp" aria-label="Blood pressure details" style="display:block;width:100%;padding:0;border:0;background:none;text-align:inherit;font:inherit;cursor:pointer">
    ${tileHTML({label:'Blood pressure',icon:I.pulse,value:`${a.s.sys??'—'}/${a.s.dia??'—'}`,status:cbp[1],tone:'ruby',pill:true})}</button>
   <button type="button" data-action="openMetric" data-args="sugar" aria-label="Blood sugar details" style="display:block;width:100%;padding:0;border:0;background:none;text-align:inherit;font:inherit;cursor:pointer">
    ${tileHTML({label:'Blood sugar',icon:I.drop,value:a.s.sugar==null?'—':fmt1(a.s.sugar),status:csg[1],tone:'amber',pill:true})}</button>
   <button type="button" data-action="openMetric" data-args="bmi" aria-label="Body BMI details" style="display:block;width:100%;padding:0;border:0;background:none;text-align:inherit;font:inherit;cursor:pointer">
    ${tileHTML({label:'Body BMI',icon:I.scale,value:bmi(a)?fmt1(bmi(a)):'—',status:cbm[1],tone:'cobalt',pill:true})}</button>
  </div>

  ${redFlag(a)?`<div style="display:flex;gap:8px;padding:10px 12px;border-radius:16px;background:var(--hx-rose-bg);border:1px solid var(--hx-rose-line);color:var(--hx-rose);font-size:11px;font-weight:700;line-height:1.35">
    <span>⚠</span><span>Emergency: skip the fitness test and attend to this visitor quickly.</span></div>`:''}

  <button data-action="goVisit" style="display:block;width:100%;border:0;background:none;padding:0;cursor:pointer" aria-label="${esc(ctaLabel)}">
   ${ctaHTML({label:ctaLabel})}
  </button>`}

  ${state.regOpen?`<div class="glass p-4">
   <div class="flex items-center justify-between gap-2">
    <div class="display text-sm font-extrabold">New visitor</div>
    <button type="button" class="btn btn-glass px-3 py-2 text-[11px]" data-action="cancelReg">Cancel</button>
   </div>
   <div class="mt-0.5 text-[11px] leading-snug text-[#5c747a]">Takes about 30 seconds. Their number is given automatically.</div>
   <form data-action="registerSubmit" novalidate class="pop-in mt-4 space-y-3">
    <input id="rgName" required maxlength="200" placeholder="Full name e.g. Sipho Ndlovu" class="field">
    <div class="grid grid-cols-2 gap-3">
     <div><label class="microlabel" for="rgAge">Age</label><input id="rgAge" type="text" inputmode="numeric" required placeholder="e.g. 46" class="field mono mt-1" data-on-input="guardian-show" data-args="rg"></div>
     <div><span class="microlabel">Sex</span><input type="hidden" id="rgSex" value="">
      <div class="mt-1 grid grid-cols-2 gap-2" role="group" aria-label="Sex">${['Male','Female'].map(s=>`<button type="button" data-sex="${esc(s)}" aria-pressed="false" data-action="pick-sex" class="btn btn-glass py-2.5 text-[12px]">${s}</button>`).join('')}</div></div>
    </div>
    <div class="grid grid-cols-2 gap-3">
     <div><label class="microlabel" for="rgPhone">WhatsApp (optional)</label><input id="rgPhone" type="tel" inputmode="tel" placeholder="082 123 4567" class="field mono mt-1"></div>
     <div><label class="microlabel" for="rgHeight">Height (cm)</label><input id="rgHeight" type="text" inputmode="numeric" placeholder="if measured" class="field mono mt-1"></div>
    </div>
    <div><label class="microlabel" for="rgEmail">Email (optional)</label><input id="rgEmail" type="email" inputmode="email" autocomplete="off" placeholder="for sending the plan by email" class="field mt-1"></div>
    <div><span class="microlabel">Visitor number</span>
     <div id="rgNumber" class="field mono mt-1 font-bold text-brand-900" style="background:rgba(58,165,151,.09);border-color:rgba(58,165,151,.3)">${nextBadge()||'—'}</div>
     <p class="mt-1 text-[10.5px] text-[#6b8187]">Given automatically. Find them later by name or number.</p></div>
    ${consentFields('rg',false)}
    <div id="rgErr" class="st-warn" role="alert" hidden></div>
    <button class="btn btn-primary w-full py-3 text-sm">Register & start the checks →</button>
   </form>
  </div>`:''}

  <div class="hx-ivory">
   <div class="hx-ivory-head">
    <div><h3>Visitors today</h3><p class="hx-ivory-sub">Tap a visitor to open their passport${(!cloud.user||mayPlace())&&attendees.length?' · the bin removes them':''}</p></div>
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
    ${cloud.user||cloud.mode?'':'<button data-action="resetDemoAsk">Reset demo</button><button data-action="nsDiag">Memory diagnostics</button>'}
    ${installEvt?`<button data-action="installApp">Install app</button>`:''}
    <button data-action="openCloud">${cloud.user?'Sync':'Sign in'}</button>
    ${cloud.user?`<button data-action="cloudSignOut">Sign out</button>`:''}
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
/* the last 30 searches are remembered for a minute (nsmem.js), so typing and deleting a letter does not scan every visitor again */
const visCache=window.NSMem?new window.NSMem.Cache('visitorSearch',{max:30,ttl:60000}):null;
export function visitorsToShow(query){
 if(visCache&&query)return visCache.memo(String(query).trim().toLowerCase(),()=>visitorsFind(query));
 return visitorsFind(query);
}
function visitorsFind(query){
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
 /* Remove sits beside the row, not inside it (a button in a button is not valid): church admins and team leaders when signed in,
    anyone in practice mode; it asks first (removeVisitorAsk) */
 const rm=(!cloud.user||mayPlace())?`<button class="hx-row-x" data-action="visitor-remove" data-args="${esc(x.id)}" aria-label="Remove ${esc(x.name)}" title="Remove visitor"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5"/></svg></button>`:'';
 return `<div class="hx-rowwrap"><button data-action="switchTo" data-args="${esc(x.id)}" class="hx-row${act?' is-on':''}" style="font:inherit;text-align:left">
  <span class="hx-row-main"><span class="hx-row-dot" style="background:${dot}"></span>
   <span class="hx-row-txt"><strong class="hx-row-name">${esc(x.name)}${x.done?' ✓':''}</strong><span class="hx-row-sub">${esc(x.id)} · ${esc(line)} · ${d}/8 checks</span></span></span>
  <span class="hx-row-badge">${n} / 4</span></button>${rm}</div>`;
}
function visitorListHTML(query){
 const rows=visitorsToShow(query),q=String(query||'').trim();
 if(!rows.length)return `<p class="px-1 py-3 text-center text-[11px] text-[#6b8187]">${q?'Nobody matches “'+esc(q)+'”.':'No visitors yet.'}</p>${q?'<button data-action="vq-clear" class="btn btn-glass mx-auto block px-4 py-2 text-[11px]">Clear search</button>':''}`;
 const more=(q?0:attendees.length-rows.length);
 const capped=q&&rows.length>=LIST_CAP;   /* search hit the cap: say how to narrow (V8b) */
 return rows.map(visitorRowHTML).join('')+(capped?`<p class="px-1 pt-2 text-center text-[10px] font-semibold text-[#6b8187]">First ${LIST_CAP} matches: type more of the name or phone.</p>`:(more>0?`<p class="px-1 pt-2 text-center text-[10px] font-semibold text-[#6b8187]">Latest ${rows.length} of ${attendees.length} — search to find anyone else.</p>`:''));
}
export function filterVisitors(v){state.vq=v;const el=$('#visitorList');if(el)el.innerHTML=visitorListHTML(v);}
/* the one-tap way out of a search that matched nobody */
export function clearVisitorSearch(){const i=$('#vq');if(i){i.value='';i.focus();}filterVisitors('');}
/* the next visitor number: one above the highest this phone knows (a signed-in phone holds the whole church's list),
   EXPO-001 on a fresh start. A clash with another desk is settled on upload (resolveConflict in account.js). */
export function nextBadge(){
 let max=0;
 /* only ids the database's own check allows feed the next number, so the badge it generates is never one that
    would be refused (EXPO-10000 is five digits — D3) */
 for(const a of attendees){const m=/^EXPO-(\d+)$/.exec(a.id);if(m&&+m[1]>max&&+m[1]<=9999)max=+m[1];}
 if(max>=9999)return '';   /* every number up to EXPO-9999 is taken: registration says so instead of reusing one (D3) */
 return 'EXPO-'+String(max+1).padStart(3,'0');
}
export function toggleReg(){state.regOpen=!state.regOpen;renderMain();if(state.regOpen){const n=$('#rgName');if(n)n.focus();}}
/* item 4: Cancel discards the in-progress form and lands on Home, for a brand-new visitor and for a follow-up
   visit. The form has no draft state of its own: the fields live in the page, so drawing Home again clears them. */
export function cancelReg(){
 state.regOpen=false;state.newVisitOf=null;state._goal=null;
 state.tab='home';render();window.scrollTo(0,0);
}
/* item 2: the whole vitals tile is the tap target; this screen shows that one reading's recorded entry (D-01)
   and is a sub-screen of Check, so Back returns there (D-06). */
export function openMetric(key){
 const a=A();
 if(!attendees.some(x=>x.id===a.id)){toast('Register a visitor first');return;}
 if(!['bp','sugar','bmi'].includes(key))return;
 state.metric=key;state.metricFor=a.id;
 switchTab('screen');      /* the drill-down lives inside the Check tab (D-06) */
}
export function metricBack(){state.metric='';state.metricFor='';renderMain();window.scrollTo(0,0);}
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
  <button class="btn btn-primary mt-3 w-full py-3 text-sm" data-action="recordConsent" data-args="${esc(a.id)}">Record consent & open the checks</button>
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
 if(!a.interests.optin){delete a.interests.followUp;delete a.interests.followUpName;delete a.interests.nurse;}   /* a decliner leaves the 48-hour calls list (E6) */
 persist();renderMain();toast(a.interests.optin?'Follow-up allowed ✓':'No follow-up contact — the record is deleted with the readings 7 days after the visit.');
}
/* problems are shown inside the form (not a passing toast), so nothing typed is lost */
function regError(html){const el=$('#rgErr');if(!el){toast(html.replace(/<[^>]+>/g,''));return;}el.innerHTML=html;el.hidden=!html;}
const normName=n=>String(n||'').toLowerCase().replace(/[^a-z]/g,'');
export function registerSubmit(e,force){
 if(e)e.preventDefault();
 regError('');
 const name=$('#rgName').value.trim().replace(/\s+/g,' ').slice(0,200);   /* the database caps names at 200 (D3) */
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
 if(!id)return regError('No badge numbers are left on this phone (EXPO-9999 is taken). Ask your church admin before registering more visitors.');
 /* the same person twice gives two half-filled passports: ask first (name, last 9 phone digits, or email) */
 const digits=phone.replace(/\D/g,'').slice(-9);
 /* a new visit of a past visitor is the same person on purpose, so their old passport is not a duplicate */
 const dup=!force&&attendees.find(x=>x.id!==state.newVisitOf&&(normName(x.name)===normName(name)
   ||(digits.length===9&&String(x.phone||'').replace(/\D/g,'').slice(-9)===digits)
   ||(email&&String(x.email||'').toLowerCase()===email.toLowerCase())));
 if(dup)return regError(`${esc(dup.name)} may already be registered as <b>${esc(dup.id)}</b>.
   <span class="mt-2 btn-row"><button type="button" class="st-fix" style="background:#2b8074" data-action="switch-visitor" data-args="${esc(dup.id)}">Open ${esc(dup.id)}</button>
   <button type="button" class="st-fix" style="background:#6b8187" data-action="register-again">Register a new passport</button></span>`);
 const a=migrateAttendee({id,name,age,sex,phone:phone||'+27 —',email,heightCm:h,s:{},interests:cons.it,prayer:'',done:false});
 attendees.push(a);state.activeId=a.id;state.regOpen=false;state.newVisitOf=null;state.sugFor=null;state._goal=null;
 const said=`${firstName(a.name)} is ${a.id} ✓ Start the checks`;
 switchTab('screen');toast(said);
 queueFlowStart(a.id,said);
}
export function resetDemo(){
 if(cloud.user||cloud.mode){toast('Reset is off while connected to the shared database');return;}
 qAskClear();
 if(window.NSMem)window.NSMem.bump('reset');             /* drop every cached screen and search */
 seedDemo();
 queue.length=0;qDemoClear();seedDemoQueue();          /* the practice queue starts again too */
 state.sugFor=null;state._goal=null;render();toast('Demo data reset — storage cleared');
}
/* The button asks first; resetDemo itself stays synchronous because the smoke harness calls it directly and
   cannot answer a dialog. Same split as confirmAsk: the question belongs to the action, not the domain. */
export async function resetDemoAsk(){
 if(cloud.user||cloud.mode){toast('Reset is off while connected to the shared database');return;}
 const yes=await confirmAsk({title:'Reset the demo data?',
  body:'Every visitor and volunteer you added on this device is erased. This cannot be undone.',label:'Reset',danger:true});
 if(yes)resetDemo();
}
/* tapping a visitor in the list opens their passport where they left off */
export function switchTo(id){state.activeId=id;state.sugFor=null;state._goal=null;state.metric='';state.metricFor='';state.customEdit=false;goVisit();toast(`Now serving ${firstName(A().name)} · ${id}`);}

/* ================= VIEW: SCREEN ================= */
/* A text field with a decimal keypad, not type="number": a number field silently empties "6,5", and South
   Africans write decimals with a comma. Each field has its own warning line under it. */
function stepperHTML(a,k,label,min,max,step,def){
 return `${label?`<div class="microlabel mb-1.5">${label}</div>`:''}
 <div class="flex items-center gap-1.5">
  <button type="button" data-action="step" data-id="${esc(a.id)}" data-k="${esc(k)}" data-dir="-1" data-min="${esc(min)}" data-max="${esc(max)}" data-step="${esc(step)}" data-def="${esc(def)}" class="step-btn" aria-label="Lower">−</button>
  <input id="in-${k}" type="text" inputmode="decimal" autocomplete="off" value="${disp(a.s[k])}" placeholder="—" aria-describedby="warn-${k}"
   data-on-input="station-input" data-id="${esc(a.id)}" data-k="${esc(k)}" data-min="${esc(min)}" data-max="${esc(max)}" data-on-change="station-commit" data-id="${esc(a.id)}" data-k="${esc(k)}" data-min="${esc(min)}" data-max="${esc(max)}" data-step="${esc(step)}"
   class="step-input">
  <button type="button" data-action="step" data-id="${esc(a.id)}" data-k="${esc(k)}" data-dir="1" data-min="${esc(min)}" data-max="${esc(max)}" data-step="${esc(step)}" data-def="${esc(def)}" class="step-btn" aria-label="Higher">+</button>
 </div>
 <p id="warn-${k}" class="st-warn" role="alert" hidden></p>`;
}
/* ---------- one check at a time (v1.6.2) ----------
   The checks screen asks the 8 checks one by one, each with its own question, the app's range and Back / Skip / Next,
   then shows a summary to tap back into. "Show all 8 checks" returns to the one-screen form (remembered for this tab
   session in TF_KEY). A volunteer who has picked their own station keeps the one-station screen. */
const TF_KEYS = ['bp', 'sugar', 'chol', 'weight', 'veg', 'walk', 'water', 'sleep'];
const TF_KEY = 'newstart.checkView';
const TF_Q = {
 bp: [
  'What is the blood pressure?',
  'Top (systolic) and bottom (diastolic) number, in mmHg. Then tap Yes or No for BP medication.',
  'Healthy is under 120/80 mmHg.'
 ],
 sugar: [
  'What is the blood sugar?',
  'A random finger-prick reading, in mmol/L.',
  'The healthy range for a random reading is 4–8 mmol/L.'
 ],
 chol: ['What is the cholesterol?', 'The reading in mmol/L.', 'Healthy is under 5 mmol/L.'],
 weight: [
  'How much do they weigh?',
  'Weight in kg, and their height in cm. The BMI is worked out for you.',
  'Healthy BMI is 18.5–25.'
 ],
 veg: ['How many servings of fruit and veg a day?', 'Ask about a usual day.', 'On target is 5 or more servings a day.'],
 walk: [
  'How many minutes of brisk exercise a day?',
  'Fast walking counts. Minutes on a usual day.',
  'Active is 30 minutes or more a day.'
 ],
 water: ['How many glasses of water a day?', 'Glasses on a usual day.', 'Good is 8 glasses or more a day.'],
 sleep: ['How many hours of sleep a night?', 'Hours on a usual night.', 'Restful is 7 to 9 hours a night.']
};
function tfMode0() {
 if (state.tfMode === undefined) {
  try {
   state.tfMode = sessionStorage.getItem(TF_KEY) === 'all' ? 'all' : 'one';
  } catch {
   state.tfMode = 'one';
  }
 }
 return state.tfMode;
}
function tfOn(a, ms) {
 return !ms && tfMode0() === 'one' && !(attendees.some(x => x.id === a.id) && (!hasConsent(a) || visitIsOld(a)));
}
const tfDone = (a, k) => {
 if (k === 'bp') {
  return !!(a.s.sys && a.s.dia);
 }
 return a.s[k] != null;
};
const tfLabel = k => {
 if (k === 'bp') {
  return 'Blood pressure';
 }
 return (STATION_DEFS.find(y => y.k === k) || {}).label || k;
};
function tfIdx(a) {
 if (!state.tf || state.tf.id !== a.id) {
  const i = TF_KEYS.findIndex(k => !tfDone(a, k));
  state.tf = {
   id: a.id,
   i: i < 0 ? TF_KEYS.length : i
  };
 }
 return state.tf.i;
}
function tfSummary(a) {
 const rows = TF_KEYS.map((k, j) => {
  const c =
   k === 'bp'
    ? cat('bp', {
       sys: a.s.sys,
       dia: a.s.dia
      })
    : chipOf(a, k);
  const v = k === 'bp' ? (tfDone(a, k) ? `${a.s.sys}/${a.s.dia}` : 'Not done') : a.s[k] != null ? disp(a.s[k]) : 'Not done';
  return `<button type="button" class="tf-sum-row" data-action="tfGo" data-args="${j}" aria-label="Check ${j + 1}, ${tfLabel(k)}: ${v}. Tap to change"><span class="tf-sum-n" aria-hidden="true">${j + 1}</span><span class="tf-sum-l">${tfLabel(k)}</span><span class="tf-sum-v">${v}</span><span class="${chipClass(c[0])}">${c[1]}</span></button>`;
 }).join('');
 return `<div id="tfQ" class="glass tf-in p-4"><h2 id="tfTitle" class="tf-title" tabindex="-1">${doneCount(a)} of 8 checks recorded</h2><p class="tf-hint">Tap a check to change it.</p><div class="tf-sum">${rows}</div><button type="button" class="btn btn-primary tf-btn mt-3 w-full" data-action="tfMode" data-args="all">Rest of the paper record (all checks on one screen) \u2192</button></div>${followUpCard(a)}`;
}
function tfView(a, d, bpCard, cardOf) {
 const n = TF_KEYS.length;
 const i = tfIdx(a);
 const fin = i >= n;
 const k = TF_KEYS[Math.min(i, n - 1)];
 const x = STATION_DEFS.find(y => y.k === k);
 const q = TF_Q[k];
 const pos = fin ? n : i + 1;
 const head = `<div class="glass tf-head p-4" data-tour="tf-head"><div class="flex items-center justify-between gap-2"><div><div class="microlabel">Station screening \xB7 one at a time</div><div class="display text-base font-extrabold">${esc(firstName(a.name))}'s 8 checks</div></div><span id="stProgTxt" class="mono text-xs font-bold text-brand-700" aria-label="checks recorded">${d}/8</span></div><div class="tf-prog mt-3" role="progressbar" aria-valuemin="1" aria-valuemax="${n}" aria-valuenow="${pos}" aria-label="${fin ? 'Summary of the 8 checks' : `Check ${pos} of ${n}`}"><div class="tf-prog-fill" style="width:${(pos / n) * 100}%"></div></div><div class="mt-1 flex flex-wrap items-center justify-between gap-x-2"><span class="tf-count" aria-live="polite">${fin ? 'Summary' : `Check ${pos} of ${n} \xB7 ${tfLabel(k)}`}</span><button type="button" class="tap-link tf-link" data-action="tfMode" data-args="all" data-tour="tf-all">Show all 8 checks</button></div></div>`;
 const body = fin
  ? tfSummary(a)
  : `<div id="tfQ" class="tf-q tf-in" role="group" aria-labelledby="tfTitle"><h2 id="tfTitle" class="tf-title" tabindex="-1">${q[0]}</h2><p class="tf-hint">${q[1]}</p><p class="tf-range"><b>The app\u2019s range:</b> ${q[2]}</p>${k === 'bp' ? bpCard : cardOf(x)}</div><div class="tf-nav"><button type="button" class="btn btn-glass tf-btn" data-action="tfBack"${i ? '' : ' disabled'}>\u2190 Back</button><button type="button" class="btn btn-glass tf-btn" data-action="tfSkip">${tfDone(a, k) ? 'Skip' : 'Not done · skip'}</button><button type="button" class="btn btn-primary tf-btn" data-action="tfNext">${i === n - 1 ? 'Finish ✓' : 'Next →'}</button></div><p class="tf-keys">Enter = Next. Answers are saved as you go.</p>`;
 return `<section class="stagger space-y-3">
  <div id="redBanner" class="${redFlag(a) ? '' : 'hidden'} flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/90 p-4 text-rose-700">
   <span class="flex h-8 w-8 flex-none items-center justify-center rounded-[12px] bg-rose-500/15 font-extrabold">!</span>
   <div><div class="text-[11px] font-extrabold uppercase tracking-wider">Clinical red flag</div>
   <p class="mt-1 text-[11px] leading-relaxed text-rose-700">BP \u2265 160/100, or sugar \u2265 15 or under 3: do NOT run the step test. Emergency: attend to the visitor quickly.</p></div>
  </div>
  ${head}${body}${stationPicker()}<p class="text-center"><button type="button" class="tap-link tf-link" data-action="tfMode" data-args="all">Show all 8 checks on one screen</button></p></section>`;
}
export function tfGo(j, focus) {
 const a = A();
 if (!a) {
  return;
 }
 tfIdx(a);
 state.tf.i = Math.max(0, Math.min(TF_KEYS.length, j | 0));
 renderMain();
 setTimeout(() => {
  const q = document.getElementById('tfQ');
  const f = /** @type {HTMLElement|null} */ (q && (q.querySelector('.step-input') || document.getElementById('tfTitle')));
  if (q && q.scrollIntoView) {
   q.scrollIntoView({
    block: 'nearest'
   });
  }
  if (focus !== false && f) {
   f.focus({
    preventScroll: true
   });
  }
 }, 40);
}
function tfCommit() {
 const el = document.activeElement;
 if (
  el &&
  el.tagName === 'INPUT' &&
  el.closest &&
  el.closest('#tfQ')
 ) {
  el.dispatchEvent(
   new Event('change', {
    bubbles: true
   })
  );
 }
}
function tfBlocked() {
 const q = document.getElementById('tfQ');
 const a = A();
 if (!q || !a) {
  return false;
 }
 for (const el of /** @type {NodeListOf<HTMLInputElement>} */ (q.querySelectorAll('.step-input'))) {
  const k = el.id.slice(3);
  if (el.value.trim() !== '' && a.s[k] == null) {
   el.focus();
   return true;
  }
 }
 return false;
}
export function tfNext() {
 tfCommit();
 if (tfBlocked()) {
  return;
 }
 const a = A();
 if (a) {
  tfGo(tfIdx(a) + 1);
 }
}
export function tfSkip() {
 const a = A();
 if (a) {
  tfGo(tfIdx(a) + 1);
 }
}
export function tfBack() {
 tfCommit();
 const a = A();
 if (a) {
  tfGo(tfIdx(a) - 1);
 }
}
export function tfMode(m) {
 if (m === 'all+') {
  state.myStation = '';
  try {
   localStorage.removeItem(MS_KEY);
  } catch {}
 }
 state.tfMode = m === 'one' ? 'one' : 'all';
 try {
  sessionStorage.setItem(TF_KEY, state.tfMode);
 } catch {}
 state.tf = null;
 renderMain();
 toast(state.tfMode === 'all' ? 'All 8 checks on one screen' : 'One check at a time');
 if (window.scrollTo) {
  window.scrollTo({
   top: 0
  });
 }
}
/* Enter in a reading's box goes to the next check, as on paper */
document.addEventListener('keydown', ev => {
 if (ev.key !== 'Enter' || ev.isComposing || ev.shiftKey) return;
 const t = /** @type {HTMLElement|null} */ (ev.target);
 if (t && t.tagName === 'INPUT' && t.closest && t.closest('#tfQ')) {
  ev.preventDefault();
  tfNext();
 }
});
export function viewScreen(){
 const a=A(),d=doneCount(a),cbp=cat('bp',{sys:a.s.sys,dia:a.s.dia});
 /* the vitals drill-down replaces the check grid inside the same tab (D-06) */
 if(state.metric&&state.metricFor===a.id)return viewMetric(state.metric);
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
   ${x.k==='weight'?`<label class="st-height"><span>Height</span><input id="in-height" type="text" inputmode="numeric" autocomplete="off" value="${a.heightCm||''}" placeholder="—" data-on-change="height-set" data-args="${esc(a.id)}"><span>cm</span></label>
    <p id="warn-height" class="st-warn" role="alert" ${a.heightCm?'hidden':''}>${a.heightCm?'':'Add their height for the BMI.'}</p>`:''}
   ${(x.more||[]).map(m=>stepperHTML(a,m[0],m[1],m[2],m[3],m[4],m[5])).join('')}
   ${x.k==='fat'||x.k==='tbw'||x.k==='waist'?(SEX_RANGE[x.k][a.sex]?'':'<p class="st-warn">Choose Male or Female at registration for the range.</p>'):''}
  </div>`};
 const ms=myStation(),one=ms&&ms!=='bp'?STATION_DEFS.concat(EXTRA_DEFS).find(x=>x.k===ms):null;
 if(tfOn(a,ms))return tfView(a,d,bpCard,cardOf);      /* one check at a time */
 /* POPIA: no consent on record, no checks */
 if(attendees.some(x=>x.id===a.id)&&!hasConsent(a))return `<section class="stagger space-y-3">${consentCard(a)}</section>`;
 /* a visit past the grace period takes no new readings: the database would clear them on upload */
 if(attendees.some(x=>x.id===a.id)&&visitIsOld(a))return `<section class="stagger space-y-3">${pastVisitCard(a)}</section>`;
 return `<section class="stagger space-y-3">
  <div id="redBanner" class="${redFlag(a)?'':'hidden'} flex items-start gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/90 p-4 text-rose-700">
   <span class="flex h-8 w-8 flex-none items-center justify-center rounded-[12px] bg-rose-500/15 font-extrabold">!</span>
   <div><div class="text-[11px] font-extrabold uppercase tracking-wider">Clinical red flag</div>
   <p class="mt-1 text-[11px] leading-relaxed text-rose-700">BP ≥ 160/100, or sugar ≥ 15 or under 3: do NOT run the step test. Emergency: attend to the visitor quickly.</p></div>
  </div>

  <div class="glass p-4">
   <div class="flex items-center justify-between">
    <div><div class="microlabel">Station screening</div>
    <div class="display text-base font-extrabold">${esc(firstName(a.name))}'s 8 checks</div></div>
    <span id="stProgTxt" class="mono text-xs font-bold text-brand-700">${d}/8</span>
   </div>
   <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-[#123033]/[.08]">
     <div id="stProgBar" class="bar-fill" style="width:${d/8*100}%"></div></div>
   <p class="mt-2.5 text-[11px] leading-snug text-[#5c747a]">Tap − / + or type a number. Chips turn amber / rose when a value needs attention.</p>${ms?'':'<button type="button" class="btn btn-glass tf-sw mt-2.5 w-full" data-action="tfMode" data-args="one" data-tour="tf-one">One at a time →</button>'}
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
  ${ms?`<p class="text-center text-[12px] text-[#4f6870]">Saved automatically ✓ Only your station is shown. <button class="tap-link" data-action="tfMode" data-args="all+">Show all 8 checks</button></p>`
   :followUpCard(a)}
 </section>`;
}
/* A returning visitor opened by an old number: that visit is closed, so the checks start on a new passport */
function pastVisitCard(a){
 return `<div class="glass hue-sky p-4">
  <div class="microlabel">Past visit</div>
  <div class="display text-base font-extrabold">${esc(firstName(a.name))}’s visit was more than ${GRACE_DAYS} days ago</div>
  <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Readings of a past visit are deleted after ${GRACE_DAYS} days, so this passport takes no new checks. Register today’s visit on a new badge: their details are filled in, and they are asked for consent again.</p>
  <button class="btn btn-primary mt-3 w-full py-3 text-sm" data-action="new-visit" data-args="${esc(a.id)}">Register as a new visit</button>
 </div>`;
}
/* opens New visitor with the past visit's details; the badge is new and the consent is asked again */
export function newVisitFrom(id){
 const a=attendees.find(x=>x.id===id);if(!a)return;
 state.regOpen=true;state.newVisitOf=a.id;
 switchTab('home');
 const put=(sel,v)=>{const el=/** @type {HTMLInputElement|null} */ ($(sel));if(el&&v)el.value=String(v);};
 put('#rgName',a.name);put('#rgAge',a.age||'');put('#rgPhone',a.phone==='+27 —'?'':a.phone);put('#rgEmail',a.email);
 const sx=document.querySelector(`[data-action="pick-sex"][data-sex="${esc(a.sex)}"]`);if(sx)pickSex(sx);
 showGuardian('rg',a.age);
}
/* "My station": a station volunteer sees only the check they do, so nothing to scroll past. Kept on this phone. */
const MS_KEY='newstart.myStation';
function myStation(){if(state.myStation===undefined){try{state.myStation=localStorage.getItem(MS_KEY)||'';}catch(e){state.myStation='';}}return state.myStation;}
export function setMyStation(k){state.myStation=k;try{k?localStorage.setItem(MS_KEY,k):localStorage.removeItem(MS_KEY);}catch(e){}renderMain();}
function stationPicker(){
 const ms=myStation(),opts=[['','All 8 checks'],['bp','Blood pressure'],...STATION_DEFS.concat(EXTRA_DEFS).map(x=>[x.k,x.label])];
 return `<div class="glass p-3.5"><div class="microlabel">Your station</div>
  <div class="fd-chips mt-2" role="group" aria-label="Your station">${opts.map(([k,l])=>`<button class="fd-chip hue-mint" aria-pressed="${k===ms}" data-action="setMyStation" data-args="${esc(k)}">${l}</button>`).join('')}</div></div>`;
}
/* A Yes / No pair, as circled on the paper form. Tapping the chosen answer again clears it. */
function ynHTML(a,k,label){
 const v=a.s[k],b=(val,l)=>`<button type="button" class="availpill hue-mint ${v===val?'availpill-on':''}" aria-pressed="${v===val}" data-action="answer-set" data-id="${esc(a.id)}" data-k="${esc(k)}" data-val="${esc(val)}">${l}</button>`;
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
    data-on-input="chronic-list" data-args="${esc(a.id)}"></label>`:''}
 </div>`;
}
/* the Health Age Survey; sleep is the Sleep check above, so it is not asked twice */
function surveyCard(a){
 return `<div class="glass p-4">
  <div class="microlabel">Health age survey</div>
  <div class="display text-base font-extrabold">How does ${esc(firstName(a.name))} live?</div>
  ${SURVEY.map(x=>`<div class="mt-3"><div class="text-[12px] font-semibold text-[#33504f]">${x.q}</div>
   <div class="mt-1.5 flex flex-wrap gap-1.5">${x.a.map((l,i)=>`<button type="button" class="availpill hue-sand ${a.s[x.k]===i+1?'availpill-on':''}" aria-pressed="${a.s[x.k]===i+1}" data-action="answer-set" data-id="${esc(a.id)}" data-k="${esc(x.k)}" data-val="${i+1}">${l}</button>`).join('')}</div></div>`).join('')}
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
    return `<button type="button" data-action="interest-toggle" data-id="${esc(a.id)}" data-k="${esc(k)}" class="availpill hue-${INT_HUE[k]} ${on?'availpill-on':''}" aria-pressed="${on}">${on?'✓ ':''}${INT[k]}</button>`;}).join('')}
  </div>
  <div class="mt-3 rounded-[14px] bg-white/60 p-2.5">
   <div class="flex items-center justify-between gap-2"><span class="text-[12px] font-semibold text-[#33504f]">May the church contact them after the expo?</span>
    <button type="button" data-action="toggleOptin" data-args="${esc(a.id)}" class="availpill hue-mint ${optedIn(a)?'availpill-on':''}" aria-pressed="${optedIn(a)}">${optedIn(a)?'✓ Yes':'No'}</button></div>
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
    data-on-input="prayer-set" data-args="${esc(a.id)}">${esc(a.prayer||'')}</textarea></label>
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
 return `<button type="button" data-action="tick-toggle" data-id="${esc(a.id)}" data-k="${esc(k)}" class="availpill hue-${hue} ${on?'availpill-on':''}" aria-pressed="${on}">${on?'✓ ':''}${set[k]}</button>`;}).join('');
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
 el.innerHTML=msg?esc(msg)+(fix!=null?` <button type="button" class="st-fix" data-action="reading-apply" data-args="${esc(k)}" data-fix="${esc(fix)}">Use ${disp(fix)}</button>`:''):'';
}
/* while typing: save only a complete, possible value; a half-typed "14" (on the way to 140) is simply not saved yet */
export function onStationInput(id,k,el,min,max){
 const a=attendees.find(x=>x.id===id); if(!a)return;
 const raw=el.value.trim(),v=parseReading(raw);
 a.s[k]=raw!==''&&!isNaN(v)&&v>=min&&v<=max?v:null;
 if(a.s[k]!=null||raw==='')readingWarn(k,'');
 updateScreenMeta();
}
/* on leaving the field: a wrong value is never changed into a different one. It is not saved — the previous reading
   stays whatever it was (V6) — and the volunteer is told why. A missed decimal point (72 for 7.2) is offered as a
   one-tap fix. */
export function onStationCommit(id,k,el,min,max,step){
 const a=attendees.find(x=>x.id===id); if(!a)return;
 const raw=el.value.trim(),v=parseReading(raw),old=a.s[k];
 const kept=old!=null?` Previous value ${disp(old)} kept.`:'';    /* (V6) only a refusal mentions what is kept */
 if(raw===''){a.s[k]=null;readingWarn(k,'');}
 else if(isNaN(v))readingWarn(k,`“${raw}” is not a number. Type digits only, for example ${disp(step<1?5.5:120)}.${kept}`);
 else if(v<min||v>max){
  const d=Math.round(v)/10,fix=step<1&&d>=min&&d<=max?d:null;
  readingWarn(k,`${disp(v)} cannot be right (possible: ${min}–${max}). Not saved: check and type it again.${fix!=null?` Did you mean ${disp(fix)}?`:''}${kept}`,fix);
 }else{a.s[k]=v;el.value=disp(v);readingWarn(k,'');}
 crossCheck(a);updateScreenMeta();
 if(a.s[k]!=null)qStartAsk(id,k);      /* still waiting in this line? offer to start them (queue.js) */
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
 queueStripRefresh();
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
