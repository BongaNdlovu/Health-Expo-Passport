// @ts-check
import { I } from './icons.js';
import { $, A } from './helpers.js';
import { EXPO_UPCOMING, INT } from './data.js';
import { disp } from './helpers.js';
import { DROPS, FOOD_PRICES, PRICE_DATE, SEX_RANGE, autoProtocol, bmi, cat, chipClass, clamp, costOf, doneCount, esc, firstName, fmt1, healthAge, initials, money, pefPct, projection, dangerSig, redFlag, urgentAttended, simBP, tweenGoal } from './helpers.js';
import { ACTIONS, DISCLAIMER, FOOD_WHY, HEARD, HUE_P, PLAN_GOAL, PROTOCOLS, RECHECK, SEMINARS, SURVEY, attendees, cholUp, heavy, hueOf, planBooks, precautionsHTML, refLabel, state } from './data.js';
import { cloud, persist } from './state.js';
import { IS_APP } from './platform.js';
import { jelly, renderMain, renderNav, syncRanges, toast, toastUndo } from './shell.js';
import { chosenChurchPlan, churchPlanFor, churchPlanPicker, customPlanFor, viewChurchPlan } from './churchPlans.js';
import { customPlanBox } from './customPlan.js';
import { GRACE_DAYS, hasReadings, readingsGone, visitIsOld, withoutOldReadings } from './retention.js';
import { hasConsent, optedIn } from './visitor.js';
const saveBusy=new Set();   /* the files whose save is still handing off to the share sheet (R4) */
/* the three numbers at the top of Results: actual age, health age now, and the 90-day goal.
   An under-18 visitor gets a dash and "from age 18" in the tiles; the line above them says why (V5). */
function scoreTiles(tile,a,ha,proj,gone){
 const minor=a.age!=null&&a.age<18;   /* no health age, no years delta and no warning tint under 18 (V5/M1) */
 return `${tile('Actual age',fmt1(a.age),'yrs old','border-sky-200/70 bg-sky-50/80 text-sky-800')}
    ${tile('Now',gone?'—':ha.health!=null?fmt1(ha.health):'—',gone?'readings deleted':minor?'from age 18':ha.complete?`${ha.total>0?'+':''}${fmt1(ha.total)} yrs`:ha.needsHeight?'add height':doneCount(a)+'/8 done',
      !minor&&ha.total>0.4?'border-rose-200/70 bg-rose-50/70 text-rose-700':'border-sage-200/80 bg-sage-50/90 text-sage-800')}
    ${tile('90-day goal',gone||proj.age==null?'—':fmt1(proj.age),gone?'readings deleted':minor?'from age 18':proj.age==null?'after all 8 checks':`win ${fmt1(proj.yearsWon)} yrs`,'border-lilac-200/80 bg-lilac-50/90 text-lilac-700','scoreGoal')}`;
}
/* the "What adds the most years" list, longest first, with the rest behind a tap */
function yearsHTML(byYears,row){
 return `<div class="space-y-1.5">${byYears.slice(0,3).map(row).join('')}</div>
   ${byYears.length>3?`<details class="pl-switch"><summary>Show all ${byYears.length} ▾</summary><div class="mt-2 space-y-1.5">${byYears.slice(3).map(row).join('')}</div></details>`:''}`;
}
/* what the "What to work on" card lists: the needs, or the all-clear */
/* at least one measured value (height, a prayer note or the illness list alone are not readings) */
const anyReading=a=>Object.keys((a&&a.s)||{}).some(k=>a.s[k]!=null);
function workOnHTML(a,needs){
 return needs.length?`<div class="mt-2.5 space-y-1.5">${needs.map((n,i)=>`<div class="flex items-start gap-2.5 rounded-[16px] px-3 py-2 ${i?'bg-white/50':'bg-white/85 ring-1 ring-brand-400/25'}">
      <span class="chip ${n.sev>=3?'chip-flag':'chip-watch'} mt-0.5 flex-none">${PROTOCOLS[n.k].tag}</span>
      <span class="text-[11px] leading-snug text-[#33504f]">${esc(problemOf(a,n.k))}</span></div>`).join('')}</div>
    <p class="mt-2.5 text-[11px] leading-snug text-[#5c747a]">Next, the Plan turns <b class="text-[#123033]">${PROTOCOLS[needs[0].k].tag.toLowerCase()}</b> into 3 clear actions.</p>`
  /* a danger reading the plans do not cover (a low sugar, or a top blood-pressure number alone) is never "all clear" (E-1) */
  :redFlag(a)?`<p class="mt-1 text-[11.5px] font-bold leading-snug text-rose-700">A reading is in the danger range. The team attends to you now, before any plan.</p>`
  /* nothing measured yet is not "all clear" either (E-2) */
  :!anyReading(a)?`<p class="mt-1 text-[11.5px] leading-snug text-[#3d5c5e]">No readings yet. Do the checks first, then this shows what to work on.</p>`
  :`<p class="mt-1 text-[11.5px] leading-snug text-[#3d5c5e]">No numbers need attention today ✓ The Plan shows habits that keep them that way.</p>`;
}
/* the one line a screen shows instead of numbers whose readings were deleted after the grace period */
const goneNote=cls=>`<p class="${cls}">Readings were deleted ${GRACE_DAYS} days after the visit. They were given on the printed card or by WhatsApp on the day.</p>`;
/* Results, Plan, Food and Care views. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= VIEW: RESULTS ================= */
export function viewResults(){
 const raw=A(),a=withoutOldReadings(raw),gone=visitIsOld(raw),ha=healthAge(a),{sys,dia}=simBP(a),proj=projection(a),pk=autoProtocol(a),first=esc(firstName(a.name));
 const tile=(l,v,sub,cls,id)=>`<div class="rounded-[18px] border px-2 py-3 text-center ${cls}">
  <div class="text-[10px] font-bold opacity-65">${l}</div>
  <div class="display mt-1.5 text-xl leading-none font-extrabold" ${id?`id="${esc(id)}"`:''}>${v}</div>
  <div class="mt-1 text-[9px] font-bold opacity-80" ${id?`id="${id}Sub"`:''}>${sub}</div></div>`;
 const bar=(id,lblId,label,base,now)=>`<div>
  <div class="flex justify-between text-[10px] font-bold"><span class="text-[#5c747a]">${label}</span>
  <span id="${esc(lblId)}" class="mono text-brand-700">${base} → ${now}</span></div>
  <div class="bar-track mt-1.5"><div id="${esc(id)}" class="bar-fill" style="width:${clamp(now/base*100,30,100)}%"></div></div></div>`;
 /* biggest first: the counsellor talks about the top three */
 const byYears=[...ha.f].sort((x,y)=>y[2]-x[2]);
 const row=([n,val,y])=>`<div class="flex items-center justify-between rounded-[14px] px-3 py-2 ${y>0.05?'bg-rose-50/70':'bg-white/50'}">
    <span class="text-[12px] font-semibold text-[#33504f]">${n}</span>
    <span class="flex items-center gap-2"><span class="mono text-[10px] text-[#6b8187]">${val}</span>
    <span class="mono w-11 text-right text-[11px] font-bold ${y>0.05?'text-rose-600':'text-[#6b8187]'}">${y>0.05?'+'+fmt1(y):'±0.0'}</span></span></div>`;
 const needs=planNeeds(a);
 return `<section class="stagger space-y-3.5">

  <div class="glass p-4">
   <div class="flex items-start justify-between gap-2">
    <div><div class="microlabel">Results</div>
    <div class="display text-base font-extrabold">${first}’s health age</div></div>
    ${!gone&&hasReadings(a)?`<button class="btn btn-glass flex-none px-3 py-2 text-[11px]" data-action="editReadings">Edit readings</button>`:''}
   </div>
   <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">${a.age!=null&&a.age<18?`A health age is worked out for adults only (18 and over). ${first}’s readings and plan below still apply.`:'Worked out from the 8 checks, no maths needed.'}</p>
   ${gone?goneNote('mt-2 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-[10.5px] font-semibold leading-snug text-sky-800'):''}
   <div class="mt-3.5 grid grid-cols-3 gap-2">${scoreTiles(tile,a,ha,proj,gone)}</div>
   ${gone||ha.complete?'':`<div class="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[10px] font-semibold leading-snug text-amber-800">
     ${ha.needsHeight?'Add their height at the weight station: the health age needs it for the BMI.':'Finish all 8 checks, with their height, to see the health age and the 90-day goal.'}</div>`}
  </div>

  <div class="glass p-4">
   <div class="microlabel">What to work on</div>
   ${gone?`<p class="mt-1 text-[11.5px] leading-snug text-[#3d5c5e]">This visit’s readings are no longer kept, so there is nothing to work on from today. The plan below keeps the habits that help everyone.</p>`
   :workOnHTML(a,needs)}
  </div>

  <div class="glass p-4">
   <div class="microlabel mb-2.5">What adds the most years</div>
   ${gone?`<p class="text-[11.5px] leading-snug text-[#3d5c5e]">Deleted with the readings ${GRACE_DAYS} days after the visit.</p>`:yearsHTML(byYears,row)}
  </div>

  ${gone?'':`<details class="glass pl-det" ${state.simOpen?'open':''} data-on-toggle="sim-open"><summary>Show the 90-day win (counselling tool)</summary><div>
   <p class="text-[11px] leading-snug text-[#5c747a]">Slide the three commitments with the visitor and watch blood pressure and health age respond.</p>
   <div class="sim-panel mt-3">
    <div class="flex items-center justify-between gap-2">
     <div><div class="microlabel">Blood pressure</div>
      <div class="mono mt-1 text-xl font-bold text-[#0f2a2c]"><span id="simNow">${a.s.sys??130}/${a.s.dia??85}</span>
        <span class="text-[#b3c2c5]">→</span> <span id="simNew" class="text-brand-700">${sys}/${dia}</span></div></div>
     <div class="text-right">${(()=>{const c=cat('bp',{sys,dia});return `<span id="simCat" class="${chipClass(c[0])}">${c[1]}</span>`})()}
      <div id="simDrop" class="mono mt-1.5 text-[11px] font-bold text-brand-700">−${simBP(a).dS} / −${simBP(a).dD} mmHg</div></div>
    </div>
    <div class="mt-4 space-y-3">
     ${bar('simSysBar','simSysLbl','Systolic (target < 120)',a.s.sys??130,sys)}
     ${bar('simDiaBar','simDiaLbl','Diastolic (target < 80)',a.s.dia??85,dia)}
    </div>
    <div class="mt-3.5 flex items-center justify-between rounded-[14px] border border-white/90 bg-white/70 px-3 py-2">
     <span class="text-[11px] font-bold text-[#33504f]">90-day health age</span>
     <span id="simAge" class="mono text-sm font-bold text-brand-700">${proj.age==null?'—':fmt1(proj.age)+' yrs'}</span>
    </div>
   </div>
   <div class="mt-3 space-y-2.5">
    ${simSlider('simK','kitchen','1 · Food: salt-free whole foods','simKBadge',0,3,1,state.sim.kitchen,'Little salt; oats or whole grains, plenty of vegetables and fruit, and plain water (Ministry of Healing chs. 17, 23).')}
    ${simSlider('simW','walk','2 · Brisk sunlight walk','simWBadge',0,45,5,state.sim.walk,'A brisk walk outdoors in daylight every day, with plenty of plain water (Ministry of Healing ch. 17).')}
    ${simSlider('simH','hydro','3 · Neutral bath + early night','simHBadge',0,2,1,state.sim.hydro,'A warm, neutral bath (33–35°C, never hot) before bed and lights out before 22:00 (Ministry of Healing ch. 17).')}
   </div>
   <p class="mt-3 text-center text-[10px] leading-snug text-[#8a9aa0]">Expo readings are a quick screening, not a diagnosis, and the volunteers are not health professionals. The blood-pressure and health-age figures are illustrative estimates for counselling, not a prediction. The plans draw, in our own words, on the health writings of Ellen G. White.${costOf(pk)?` The full plan’s food costs about ${money(costOf(pk))} a day (store prices checked ${PRICE_DATE}; they change and vary by branch).`:''}</p>
  </div></details>`}
 </section>`;
}

/* ================= VIEW: ONE METRIC (opened from the Check tiles) =================
   D-01: this visit's entry only — the value, its classification, the reference range and the counselling line.
   There is no cross-visit history: the app has no person identity, and the readings are deleted after the
   grace period. D-06: this is a sub-screen of Check, so Back returns to the check grid. */
export function viewMetric(key){
 const raw=A(),a=withoutOldReadings(raw),gone=visitIsOld(raw),b=bmi(a);
 const k=['bp','sugar','bmi'].includes(key)?key:'bp';
 const label={bp:'Blood pressure',sugar:'Blood sugar',bmi:'Body BMI'}[k];
 const range={bp:'Healthy is under 120/80 mmHg.',sugar:'The healthy range for a random reading is 4–8 mmol/L.',bmi:'Healthy BMI is 18.5–25.'}[k];
 const empty={bp:'No blood pressure recorded yet.',sugar:'No blood sugar recorded yet.',bmi:'No body BMI recorded yet.'}[k];
 let value='',c=[null,'—'],entry=[],line='';
 if(k==='bp'){
  if(a.s.sys!=null||a.s.dia!=null)value=`${a.s.sys??'—'}/${a.s.dia??'—'}`;
  c=cat('bp',{sys:a.s.sys,dia:a.s.dia});
  entry=[['Top (systolic)',a.s.sys==null?'—':`${a.s.sys} mmHg`],['Bottom (diastolic)',a.s.dia==null?'—':`${a.s.dia} mmHg`]];
  line=c[0]==='flag'?'Emergency: the health team attends to you first, before anything else today.'
   :c[0]==='watch'?'Have it checked again in 3 weeks, cut down on salt and walk every day.'
   :c[0]==='ok'?'Keep it there with less salt, daily walks and plenty of vegetables.':'';
 }else if(k==='sugar'){
  if(a.s.sugar!=null)value=`${a.s.sugar} mmol/L`;
  c=cat('sugar',a.s.sugar);
  entry=[['Reading',a.s.sugar==null?'—':`${a.s.sugar} mmol/L`]];
  line=c[0]==='flag'?'Emergency: the health team attends to you first, before anything else today.'
   :c[0]==='watch'?'Cut out sugar and sweet drinks, and have it checked again in 3 weeks.'
   :c[0]==='ok'?'Keep it in range: no sugar or sweet drinks, and a walk every day.':'';
 }else{
  if(b!=null)value=fmt1(b);
  c=cat('bmi',b);
  entry=[['Weight',a.s.weight==null?'—':`${a.s.weight} kg`],['Height',a.heightCm==null?'—':`${a.heightCm} cm`]];
  line=b==null?'':b<18.5?'A little underweight: build up with regular meals and enough protein.'
   :b>=25?'The plan’s first goal is slow, steady weight loss: regular meals, no crash diets.'
   :'Keep it in the healthy range with daily movement and regular meals.';
 }
 const rows=entry.map(([l,v])=>`<div class="flex items-center justify-between border-t border-[#123033]/[.07] py-2 text-[12px]">
   <span class="text-[#5c747a]">${esc(l)}</span><span class="mono font-bold text-[#123033]">${esc(v)}</span></div>`).join('');
 return `<section class="stagger space-y-3.5">
  <div class="glass p-4">
   <button class="btn btn-glass q-tvbtn" data-action="metricBack">← Check</button>
   <div class="microlabel mt-3">${label} · this visit</div>
   <div class="display mt-1 text-xl font-extrabold text-[#0f2a2c]">${value?esc(value):'—'}</div>
   ${value?`<div class="mt-2"><span class="${chipClass(c[0])}">${c[1]}</span></div>`:''}
   ${gone?`<p class="mt-2 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-[10.5px] font-semibold leading-snug text-sky-800">Readings were deleted ${GRACE_DAYS} days after the visit. They were given on the printed card or by WhatsApp on the day.</p>`:''}
   ${value?`<div class="mt-3">${rows}</div>
    <p class="mt-2.5 text-[11.5px] font-semibold leading-snug text-[#33504f]">${esc(range)}</p>
    <p class="mt-1.5 text-[11.5px] leading-snug text-[#3d5c5e]">${esc(line)}</p>`
   :`<p class="mt-3 text-[13px] font-bold text-[#33504f]">${esc(empty)}</p>
    <p class="mt-1 text-[11.5px] leading-snug text-[#5c747a]">The reading appears here as soon as it is saved on the Check screen.</p>
    <button class="btn btn-primary mt-3 w-full py-2.5 text-xs" data-action="metricBack">Record it on the Check screen →</button>`}
  </div>
 </section>`;
}
function simSlider(id,key,label,badgeId,min,max,step,val,caption){
 return `<div class="glass-thin hue-${{kitchen:'sage',walk:'aqua',hydro:'lilac'}[key]} p-3.5">
  <div class="flex items-center justify-between gap-2">
   <label for="${esc(id)}" class="text-[12px] font-bold leading-tight text-[#33504f]">${label}</label>
   <span id="${esc(badgeId)}" class="mono flex-none rounded-full tint px-2 py-0.5 text-[10px] font-bold"></span>
  </div>
  <input id="${esc(id)}" type="range" min="${min}" max="${max}" step="${step}" value="${esc(val)}" data-on-input="sim-set" data-args="${esc(key)}" class="mt-1 w-full">
  <p class="mt-0.5 text-[10px] leading-snug text-[#667d83]">${caption}</p></div>`;
}
export function onSim(k,v){state.sim[k]=+v;updateSimUI();persist();}
export function updateSimUI(){syncRanges();
 const a=A(); if(!a)return;
 const {sys,dia,dS,dD}=simBP(a),proj=projection(a);
 const set=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt;};
 set('simNow',`${a.s.sys??130}/${a.s.dia??85}`);set('simNew',`${sys}/${dia}`);
 const c=cat('bp',{sys,dia}),sc=document.getElementById('simCat');
 if(sc){if(sc.textContent!==c[1])jelly(sc);sc.textContent=c[1];sc.className=chipClass(c[0]);}
 set('simDrop',`−${dS} / −${dD} mmHg`);
 set('simSysLbl',`${a.s.sys??130} → ${sys}`);set('simDiaLbl',`${a.s.dia??85} → ${dia}`);
 const sb=document.getElementById('simSysBar');if(sb)sb.style.width=clamp(sys/(a.s.sys??130)*100,30,100)+'%';
 const db=document.getElementById('simDiaBar');if(db)db.style.width=clamp(dia/(a.s.dia??85)*100,30,100)+'%';
 if(proj.age!=null){tweenGoal(proj.age);set('scoreGoalSub',`win ${fmt1(proj.yearsWon)} yrs`);}
 const wS=Math.min(8,Math.round(state.sim.walk*0.2)),wD=Math.min(5,Math.round(state.sim.walk*0.1333));
 set('simKBadge',`L${state.sim.kitchen+1} · −${DROPS.kSys[state.sim.kitchen]}/−${DROPS.kDia[state.sim.kitchen]}`);
 set('simWBadge',`${state.sim.walk}min · −${wS}/−${wD}`);
 set('simHBadge',`L${state.sim.hydro} · −${DROPS.hSys[state.sim.hydro]}/−${DROPS.hDia[state.sim.hydro]}`);
}

/* ================= VIEW: PLAN ================= */
/* The reading in the expo's screening bands: normal, pre-hypertension, stage 1, stage 2. */
export function bpStage(sys,dia){
 if(!sys||!dia)return '';
 if(sys>=160||dia>=100)return 'stage 2 high blood pressure';
 if(sys>=140||dia>=90)return 'stage 1 high blood pressure';
 if(sys>=120||dia>=80)return 'pre-hypertension';
 return 'normal';
}
/* "1 serving", "3 servings": a reading with its unit */
const countOf=(n,one,many)=>n+' '+(Number(n)===1?one:many);
/* Which plans this person's numbers point to, most urgent first, with the reason in plain words. */
export function planNeeds(a){
 const out=[],sev=c=>c==='flag'?3:c==='watch'?2:0;
 const bp=cat('bp',{sys:a.s.sys,dia:a.s.dia});
 /* order: red-flag blood pressure, red-flag sugar, amber blood pressure, amber sugar, then weight/cholesterol, then sleep */
 if(sev(bp[0]))out.push({k:'bp',sev:sev(bp[0]),rank:sev(bp[0])===3?0:2,why:`${a.s.sys}/${a.s.dia} is ${bpStage(a.s.sys,a.s.dia)}`});
 /* only a high reading: the blood-sugar plan lowers sugar, so a low one goes to the care notes instead (careNotes) */
 const sg=cat('sugar',a.s.sugar);
 if(sev(sg[0])&&a.s.sugar>8)out.push({k:'sugar',sev:sev(sg[0]),rank:sev(sg[0])===3?1:3,why:`${a.s.sugar} mmol/L (${Math.round(a.s.sugar*18)} mg/dL) is above the expo’s healthy range`});
 const b=bmi(a),bm=cat('bmi',b),ch=cat('chol',a.s.chol),why=[];
 const heavy=b!=null&&b>=25;
 if(heavy)why.push(`BMI ${fmt1(b)} is above the healthy range`);
 if(sev(ch[0]))why.push(`cholesterol ${a.s.chol} mmol/L (${Math.round(a.s.chol*38.67)} mg/dL) is above the expo’s healthy range`);
 /* the paper record's body measures point to the same plan: a large waist, or body fat above range */
 const wc=cat('waist',{v:a.s.waist,sex:a.sex}),bf=cat('fat',{v:a.s.fat,sex:a.sex}),fatUp=bf[0]==='watch'&&a.s.fat>SEX_RANGE.fat[a.sex][1];
 if(sev(wc[0]))why.push(`waist ${a.s.waist} cm is ${wc[1].toLowerCase()}`);
 if(fatUp)why.push(`body fat ${a.s.fat}% is above the ${SEX_RANGE.fat[a.sex].join('–')}% range`);
 if(why.length)out.push({k:'bmi',sev:Math.max(heavy?sev(bm[0])||2:0,sev(ch[0]),sev(wc[0]),fatUp?2:0),rank:4,why:why.join('; ')});
 if(b!=null&&b<18.5)out.push({k:'thin',sev:sev(bm[0])||2,rank:4.2,why:`BMI ${fmt1(b)} is below the healthy range`});
 const sl=cat('sleep',a.s.sleep);
 if(sev(sl[0]))out.push({k:'sleep',sev:sev(sl[0]),rank:5,why:`${a.s.sleep} hours a night. The plan builds regular hours, fresh air and a calm, light evening`});
 /* the visitor ticked "Stress & peace" at the screening desk */
 if(a.interests&&a.interests.stress)out.push({k:'mind',sev:2,rank:4.5,why:'Asked for stress and peace support. The calm-mind plan pairs time outdoors with gratitude, kindness and rest'});
 /* the habit checks, after every medical flag */
 const vg=cat('veg',a.s.veg),wk=cat('walk',a.s.walk),wt=cat('water',a.s.water);
 if(sev(vg[0]))out.push({k:'veg',sev:sev(vg[0]),rank:6,why:`${countOf(a.s.veg,'serving','servings')} of fruit and vegetables a day; the goal is 5 or more`});
 if(sev(wk[0]))out.push({k:'move',sev:sev(wk[0]),rank:6.5,why:`${countOf(a.s.walk,'minute','minutes')} of exercise a day; the goal is 30`});
 /* no minutes measured: the survey answer stands in for them */
 else if(a.s.walk==null&&a.s.exFreq>=2)out.push({k:'move',sev:a.s.exFreq,rank:6.5,why:`Aerobic exercise ${SURVEY[0].a[a.s.exFreq-1].toLowerCase()}; the goal is 5 or more times a week`});
 if(sev(wt[0]))out.push({k:'water',sev:sev(wt[0]),rank:7,why:`${countOf(a.s.water,'glass','glasses')} of water a day; the goal is 8`});
 /* the scale's body water below range points to the water plan too */
 else if(cat('tbw',{v:a.s.tbw,sex:a.sex})[0]==='watch'&&a.s.tbw<SEX_RANGE.tbw[a.sex][0])
  out.push({k:'water',sev:2,rank:7,why:`body water ${a.s.tbw}% is below the ${SEX_RANGE.tbw[a.sex].join('–')}% range`});
 return out.sort((x,y)=>x.rank-y.rank);
}
/* The plan actually shown for this visitor: the one picked on the Plan step, else the one their numbers point to.
   WhatsApp and the printed card use the same, so the visitor goes home with what was explained at the table. */
const pkOf=a=>state.sugFor===a.id&&PROTOCOLS[state.protocol]?state.protocol:autoProtocol(a);
/* the visitor's main problem in one plain sentence, with the healthy target */
export function problemOf(a,pk){
 const s=a.s;
 if(pk==='bp'&&s.sys&&s.dia){
  const w={'stage 2 high blood pressure':'very high (stage 2)','stage 1 high blood pressure':'high (stage 1)',
   'pre-hypertension':'a little high (pre-hypertension)','normal':'normal'}[bpStage(s.sys,s.dia)];
  return `Blood pressure ${s.sys}/${s.dia}: ${w}. Healthy is under 120/80.`;
 }
 if(pk==='sugar'&&s.sugar!=null)return `Blood sugar ${s.sugar} mmol/L: ${cat('sugar',s.sugar)[1].toLowerCase()}. The healthy range for a random reading is 4–8.`;
 if(pk==='bmi'){
  const out=[],b=bmi(a);
  if(heavy(a))out.push(`BMI ${fmt1(b)}: ${cat('bmi',b)[1].toLowerCase()}. Healthy is 18.5–25.`);
  if(cholUp(a))out.push(`Cholesterol ${s.chol} mmol/L: ${cat('chol',s.chol)[1].toLowerCase()}. Good is under 5.2.`);
  const wc=cat('waist',{v:s.waist,sex:a.sex});
  if(wc[0]&&wc[0]!=='ok')out.push(`Waist ${s.waist} cm: ${wc[1].toLowerCase()}. Healthy is under ${SEX_RANGE.waist[a.sex][0]}.`);
  const r=SEX_RANGE.fat[a.sex];
  if(r&&s.fat!=null&&s.fat>r[1])out.push(`Body fat ${s.fat}%: above range. Healthy is ${r.join('–')}%.`);
  if(out.length)return out.join(' ');
 }
 if(pk==='sleep'&&s.sleep!=null&&s.sleep<7)return `Sleep ${s.sleep} hours a night: too little. Most adults need 7–8.`;
 if(pk==='mind'&&a.interests&&a.interests.stress)return 'You asked for help with stress and worry.';
 if(pk==='thin'&&bmi(a)!=null&&bmi(a)<18.5)return `BMI ${fmt1(bmi(a))}: underweight. Healthy is 18.5–25.`;
 if(pk==='veg'&&s.veg!=null&&s.veg<5)return `Fruit and vegetables: ${countOf(s.veg,'serving','servings')} a day. The goal is 5 or more.`;
 if(pk==='move'&&s.walk!=null&&s.walk<30)return `Exercise: ${countOf(s.walk,'minute','minutes')} a day. The goal is 30.`;
 if(pk==='water'&&s.water!=null&&s.water<8)return `Water: ${countOf(s.water,'glass','glasses')} a day. The goal is 8.`;
 const tw=SEX_RANGE.tbw[a.sex];
 if(pk==='water'&&tw&&s.tbw!=null&&s.tbw<tw[0])return `Body water ${s.tbw}%: below range. Healthy is ${tw.join('–')}%.`;
 return planNeeds(a).length?'Not your main need today, but these habits help everyone.'
  :redFlag(a)?'A reading is in the danger range today. The team attends to that first; these habits are for afterwards.'
  :!anyReading(a)?'No readings yet. These habits help everyone; the checks show which matter most for you.'
  :'Your numbers look fine today. This plan helps keep them that way.';
}
/* What the counsellor must also raise: things no home plan covers, from the paper record and survey. Plain sentences. */
export function careNotes(a){
 const s=a.s,out=[];
 if(s.sugar!=null&&s.sugar<4)out.push(`Blood sugar ${s.sugar} mmol/L is low (healthy is 4–8). Give a sweet drink or fruit now. Emergency: attend to them quickly and stay with them until it is back up.`);
 if(s.bpMed===1)out.push('Takes blood-pressure medication: keep taking it. This plan does not replace it; only their doctor changes it.');
 if(s.preg===1)out.push('Pregnant: skip the step test, and she should check any plan with her doctor or clinic.');
 if(s.chronic===1)out.push(`Chronic illness${a.chronicList?': '+a.chronicList:''}. Check the plan with their doctor.`);
 if(s.ops===1)out.push('Has had a major operation: skip the step test unless their doctor has cleared them.');
 const w=cat('waist',{v:s.waist,sex:a.sex});
 if(w[0]&&w[0]!=='ok')out.push(`Waist ${s.waist} cm: ${w[1].toLowerCase()} (${a.sex==='Female'?'under 80':'under 94'} is healthy).`);
 const p=pefPct(a);
 if(p!=null&&p<80)out.push(`Lung function ${s.pef} is ${p}% of the recommended ${s.pefExp}. ${p<50?'Emergency: attend to them quickly and refer them to a clinic today.':'Suggest a clinic check.'}`);
 if(s.pulseRest!=null&&s.pulseRest>100)out.push(`Resting pulse ${s.pulseRest} is fast (normal is 60–100). Skip the step test and suggest a clinic check soon.`);
 const bf=SEX_RANGE.fat[a.sex];
 if(bf&&s.fat!=null&&s.fat<bf[0])out.push(`Body fat ${s.fat}% is below the ${bf.join('–')}% range.`);
 if(s.smoke>=3)out.push(`Smokes (${SURVEY[3].a[s.smoke-1].toLowerCase()}). Offer help to stop.`);
 if(s.alcohol>=3)out.push(`Drinks alcohol ${SURVEY[4].a[s.alcohol-1].toLowerCase()}. Talk about cutting down.`);
 if(s.snack===1)out.push('Snacks on junk food several times a day.');
 if(s.breakfast>=2)out.push(`Has a good breakfast ${SURVEY[1].a[s.breakfast-1].toLowerCase()}.`);
 return out;
}
/* a reading in the red range comes before any home plan (the expo's safety rule, not a book claim) */
export function urgentOf(a,pk){
 if(redFlag(a))return {t:'Emergency: the team attends to you now, before anything else',w:'A reading is in the danger range: blood pressure 160/100 or more, or blood sugar 15 or more, or under 3.'};
 const red=pk==='bp'?cat('bp',{sys:a.s.sys,dia:a.s.dia})[0]==='flag':pk==='sugar'?cat('sugar',a.s.sugar)[0]==='flag'
  :pk==='bmi'?cat('chol',a.s.chol)[0]==='flag'||cat('bmi',bmi(a))[0]==='flag':false;
 return red?{t:'Book a clinic visit this week',w:'This reading is in the red range. The plan below helps, but a clinic must check it.'}:null;
}
export function planFor(a,pk){
 /* item 5: a custom plan written for this visitor IS the plan. It comes before the church library and before
    the generated plan, and every caller (Plan, Send home, WhatsApp, email, the printed card) gets the same
    object, so none of them can announce a different plan from the one the visitor was shown (D-04, R-07). */
 const custom=a&&a.interests&&a.interests.customPlan;
 if(custom&&typeof custom==='object'&&!Array.isArray(custom))return customPlanFor(a,custom);
 if(!pk){const cp=chosenChurchPlan(a);if(cp)return churchPlanFor(a,cp);}
 pk=pk||pkOf(a);
 const actions=k=>{
  const all=(ACTIONS[k]||[]).filter(x=>!x.when||x.when(a)),isFirst=x=>!!(x.first&&x.first(a));
  const fix=x=>({...x,how:x.how.map(h=>typeof h==='function'?h(a):h).filter(Boolean),
   cost:(x.foods||[]).reduce((t,c)=>{const f=foodList().find(f=>f.k===c);return t+(f?f.daily:0);},0)});
  return [...all.filter(isFirst),...all.filter(x=>!isFirst(x))].map(fix);
 };
 const list=actions(pk);
 /* One plan, not nine. Whatever else the checks flagged is folded in here as a secondary objective of the
    same plan, so the visitor leaves with one thing to follow instead of a menu of separate plans. */
 const secondary=planNeeds(a).filter(n=>n.k!==pk&&PROTOCOLS[n.k]).map(n=>{
  const [act]=actions(n.k);
  return act?{k:n.k,tag:PROTOCOLS[n.k].tag,why:n.why,act}:null;
 }).filter(Boolean);
 return {pk,p:PROTOCOLS[pk],goal:PLAN_GOAL[pk],problem:problemOf(a,pk),urgent:urgentOf(a,pk),
  top:list.slice(0,3),more:list.slice(3),secondary,recheck:RECHECK[pk]};
}
export function viewPlan(){
 const raw=A(),a=withoutOldReadings(raw),gone=visitIsOld(raw),sug=autoProtocol(a);
 if(state.sugFor!==a.id||state.sugVal!==sug){state.protocol=sug;state.sugFor=a.id;state.sugVal=sug;}
 /* a custom plan overrides the church library too, so the church-plan screen is only shown when there is none */
 const custom=!!(a.interests&&a.interests.customPlan&&typeof a.interests.customPlan==='object');
 const cp=!custom&&chosenChurchPlan(a);if(cp)return viewChurchPlan(a,cp);
 const P=planFor(a,state.protocol),p=P.p,hue=HUE_P[P.pk],first=esc(firstName(a.name));
 /* a custom plan is the whole plan: the readings' other needs are not advertised as part of someone else's words */
 const others=custom?[]:planNeeds(a).filter(n=>n.k!==P.pk);
 const ref=r=>r?` <span class="ac-ref">${refLabel(r)}</span>`:'';
 const card=(x,i)=>`<li class="ac-card hue-${hue}">
   <div class="ac-top"><span class="ac-n">${i+1}</span><div class="ac-do">${esc(x.do)}</div></div>
   ${x.why?`<p class="ac-why"><b>Why</b>${esc(x.why)}${ref(x.ref)}</p>`:''}
   ${x.how.length?`<div class="ac-how"><b>How</b><ul>${x.how.map(h=>`<li>${esc(h)}</li>`).join('')}</ul></div>`:''}
   
  </li>`;
 return `<section class="stagger space-y-3.5">
  <div class="glass hue-${hue} p-4">
   <div class="microlabel">${first}’s plan · 90 days</div>
   <div class="display mt-0.5 text-[19px] leading-tight font-extrabold text-[#0f2a2c]">${esc(P.goal)}</div>
   <p class="pl-problem">${esc(P.problem)}</p>
   ${custom?`<p class="mt-2 text-[11px] leading-snug text-[#4f6870]">Written by ${esc(p.credit||'your church')} · the church’s own plan, not reviewed by the app.</p>`:''}
   ${gone?`<p class="mt-2 rounded-[14px] border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-[10.5px] font-semibold leading-snug text-sky-800">Readings were deleted ${GRACE_DAYS} days after the visit. This plan is the general one that helps everyone.</p>`:''}
   ${others.length?`<div class="pl-also"><span>Also in this plan:</span>${others.map(n=>`<span class="fd-chip hue-${HUE_P[n.k]}">${esc(PROTOCOLS[n.k]?PROTOCOLS[n.k].tag:n.k)}</span>`).join('')}</div>`:''}
   ${custom?'':churchPlanPicker(a)}
   ${customPlanBox(a)}
  </div>

  ${P.urgent&&!gone?`<div class="pl-urgent" role="alert"><b>⚠ ${esc(P.urgent.t)}</b><span>${esc(P.urgent.w)}</span></div>`:''}
  ${careNotes(a).length?`<div class="glass p-4"><div class="pl-h">Also talk about</div>
   <ul class="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-[#33504f]">${careNotes(a).map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:''}

  <div>
   <div class="pl-h">Do these 3 things</div>
   <ol class="ac-list">${P.top.map(card).join('')}</ol>
  </div>

  ${P.secondary&&P.secondary.length?`<div class="glass p-4">
   <div class="pl-h">Also in your plan</div>
   <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">The checks flagged these too. They belong to the same 90 days, not a separate plan.</p>
   <ul class="pl-more mt-2">${P.secondary.map(s=>`<li><b>${esc(s.act.do)}</b>${ref(s.act.ref)}<span>${esc(s.why)}</span></li>`).join('')}</ul>
  </div>`:''}

  ${P.more.length?`<div class="glass p-4">
   <div class="microlabel">When these feel easy, add</div>
   <ul class="pl-more">${P.more.map(x=>`<li><b>${esc(x.do)}</b>${ref(x.ref)}<span>${esc(x.why)}</span></li>`).join('')}</ul>
  </div>`:''}

  <div class="glass p-4">
   <div class="pl-row"><span class="pl-ic" aria-hidden="true">📅</span><div><b>Check again</b><span>${esc(P.recheck[0])}${ref(P.recheck[1])}</span></div></div>
   <div class="pl-row"><span class="pl-ic" aria-hidden="true">💊</span><div><b>Keep taking your pills</b><span>Never stop prescribed pills suddenly; your clinic will adjust them. This plan is healthy-living advice, not a replacement for the clinic.${p.note?` ${esc(p.note)}`:''}</span></div></div>
  </div>
  ${p.help?`<div class="pl-urgent"><b>Need help now?</b><span>${esc(p.help)}</span></div>`:''}
  ${precautionsHTML()}

  ${p.items.length?`<button class="pl-food" data-action="openFood">
   <span class="min-w-0 flex-1"><b>Food for this plan · store prices</b>
   <span>Store prices checked ${PRICE_DATE}; they vary by branch. What each food costs, and why it is in the plan.</span></span><span aria-hidden="true">→</span></button>`:''}

  ${p.steps.length?`<details class="glass pl-det"><summary>The full day, step by step</summary><div>
   <div class="space-y-2.5">${p.steps.map(([t,txt,pg])=>`<div class="flex gap-2.5">
     <span class="mono flex-none rounded-[10px] px-2 py-1 text-[10px] font-bold tint hue-${hue}">${t}</span>
     <span class="min-w-0 flex-1 text-[12px] leading-snug text-[#3d5c5e]">${txt}${ref(pg)}</span></div>`).join('')}</div>
  </div></details>`:''}
  ${p.hydro?`<details class="glass pl-det"><summary>Home hydrotherapy (free)</summary><div><p class="text-[11.5px] leading-relaxed text-[#3d5c5e]">${p.hydro}</p></div></details>`:''}
  ${custom?`<details class="glass pl-det"><summary>What this plan is based on</summary><div>
   <p class="text-[11.5px] leading-relaxed text-[#3d5c5e]">Written by ${esc(p.credit||'your church')} for ${esc(firstName(a.name))}. It is the church’s own plan, not reviewed by the app.</p>
   <p class="mt-2.5 text-[10px] leading-relaxed text-[#8a9aa0]">${esc(DISCLAIMER)}</p>
  </div></details>`
  :`<details class="glass pl-det"><summary>What this plan is based on</summary><div>
   <p class="text-[11.5px] leading-relaxed text-[#3d5c5e]">${esc(p.mech)}</p>
   <ul class="mt-2.5 space-y-2">${p.facts.map(([txt,pg])=>`<li class="flex items-start gap-2.5">
     <span class="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand-500"></span>
     <span class="min-w-0 flex-1 text-[11.5px] leading-snug text-[#3d5c5e]">${txt}${ref(pg)}</span></li>`).join('')}</ul>
   <p class="mt-3 text-[10px] leading-relaxed text-[#8a9aa0]">Source: ${p.src}. ${planBooks(p,P.top.concat(P.more).map(x=>x.ref)).join('. ')}. All books are by Ellen G. White. “Ministry of Healing ch.” = a chapter of The Ministry of Healing; “Counsels on Diet §” and “Healthful Living §” = a numbered paragraph of those books; “Place of Herbs p.” = a page of The Place of Herbs in Rational Therapy. The advice is in our own words. Lines marked “general advice” or “expo safety rule”, and the herb hazard notes, rest on no book.</p>
  </div></details>`}
 </section>`;
}

/* ================= VIEW: FOOD (opened from the Plan tab) =================
   Every shopping-list food once, ordered by what it costs on the shelf (cheapest first) with the stores that
   sell it, and, on tap, why it is in the plan and how its price was worked out. Prices: FOOD_PRICES (written by
   tools/update-prices.js) and each item's `daily`; reasons: FOOD_WHY. */
/* the price on the shelf: each priced part’s median added up, so the list can be ordered by what somebody
   actually pays at the till rather than by a per-day share of it */
export const shelfOf=f=>f.price&&f.price.parts.length?f.price.parts.reduce((t,p)=>t+p.med,0):null;
export const shortFood=n=>n.split(/ \(| \/ /)[0];
export const foodKeyOf=name=>{for(const k in FOOD_PRICES)if(FOOD_PRICES[k].names.includes(name))return k;return 'x-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');};
let _foods=null;
function foodList(){
 if(_foods)return _foods;
 const m=new Map();
 for(const pk of Object.keys(PROTOCOLS))for(const it of PROTOCOLS[pk].items){
  const k=foodKeyOf(it.name);
  if(!m.has(k))m.set(k,{k,name:it.name,dose:it.dose,daily:it.daily,store:it.store,plans:[],price:FOOD_PRICES[k]||null,why:FOOD_WHY[k]||[]});
  const f=m.get(k);f.plans.push(pk);
  if(it.name.length<f.name.length)f.name=it.name;          /* "Rolled oats" rather than "Rolled oats / oat bran" */
 }
 return _foods=[...m.values()];
}
export function openFood(){
 const pk=state.protocol&&PROTOCOLS[state.protocol]&&PROTOCOLS[state.protocol].items.length?state.protocol:'all';
 state.food={open:true,plan:pk};
 state._foodAnim=true;renderMain();window.scrollTo(0,0);
}
export function closeFood(){if(state.food)state.food.open=false;renderMain();window.scrollTo(0,0);}
export function setFoodPlan(k){state.food.plan=k;state._foodAnim=true;renderMain();}
/* opening a food only shows/hides its panel: no redraw, so the bars do not grow again */
export function toggleFood(k){
 const b=document.getElementById('fh-'+k),d=document.getElementById('fd-'+k);if(!b||!d)return;
 const open=d.hidden;d.hidden=!open;b.setAttribute('aria-expanded',String(open));
 const more=b.querySelector('.fd-more');if(more)more.textContent=open?'Close ▴':'Why? ▾';
}
function foodMiniBars(part,i0){
 if(part.n<2||part.min===part.max)return `<span class="fd-one">${part.label?`<b>${esc(part.label)}:</b> `:''}R${part.med.toFixed(2)} ${esc(part.unit)} at ${esc(part.stores.join(', '))}${part.n<2?' (only one price found)':''}</span>`;
 const row=(cls,lab,v,d)=>`<span class="fd-mini ${cls}"><span>${lab}</span><span class="fd-track"><i class="fd-bar" style="--w:${(v/part.max).toFixed(3)};--d:${d}"></i></span><b>R${v.toFixed(2)}</b></span>`;
 return `${part.label?`<span class="fd-part">${esc(part.label)} · ${esc(part.unit)}</span>`:''}
  ${row('fd-lo','Cheapest · '+esc(part.cheap),part.min,i0)}${row('','Typical',part.med,i0+1)}${row('fd-hi','Dearest · '+esc(part.dear),part.max,i0+2)}`;
}
function foodDetail(f,plan){
 /* this plan's reasons first, then the other plans */
 const rank=w=>w.plan===plan?0:1;
 const why=[...f.why].sort((a,b)=>rank(a)-rank(b));
 const cares=why.filter(w=>w.care).map(w=>w.care);
 const P=f.price,parts=P?P.parts:[];
 const amount=parts.length?parts.map(p=>(p.label&&!p.amount.includes(p.label)?p.label+' ':'')+p.amount).join(' + '):f.dose;
 const stores=[...new Set(parts.flatMap(p=>p.stores))].sort();
 return `<div class="fd-h">Why this food</div>
  ${why.length?why.map(w=>`<div class="fd-why"><span class="fd-tag hue-${HUE_P[w.plan]}">${esc(PROTOCOLS[w.plan].tag)}</span>
    <span>${esc(w.txt)} <span class="fd-ref">${refLabel(w.ref)}</span></span></div>`).join('')
   :'<div class="fd-why"><span>No reason is recorded for this food yet. A reviewer should add one.</span></div>'}
  ${cares.map(c=>`<div class="fd-care">⚠ ${esc(c)}</div>`).join('')}
  <div class="fd-money"><b>How much:</b> ${amount.toLowerCase().startsWith(f.dose.toLowerCase())?esc(amount):esc(f.dose)+(amount!==f.dose?` (priced as ${esc(amount)})`:'')}.<br>
   <b>Store price:</b> ${shelfOf(f)!=null?`about R${shelfOf(f).toFixed(2)} for ${esc(amount)}, at the typical (median) price`:esc(f.store)}.<br>
   ${parts.length?`<b>Where the price comes from:</b> ${parts.map(p=>`${p.label?esc(p.label)+': ':''}median R${p.med.toFixed(2)} ${esc(p.unit)} from ${p.n} store price${p.n>1?'s':''}`).join('; ')} at ${esc(stores.join(', '))}.`
    :`<b>Where the price comes from:</b> ${esc(f.store)}.`}
   ${P&&P.note?`<br><b>Note:</b> ${esc(P.note)}.`:''}</div>`;
}
export function viewFood(){
 const F=state.food,plan=F.plan,anim=!!state._foodAnim;state._foodAnim=false;
 const foods=foodList().filter(f=>plan==='all'||f.plans.includes(plan))
  .sort((a,b)=>{const x=shelfOf(a),y=shelfOf(b);return x==null?(y==null?0:1):y==null?-1:x-y;});
 const priced=foods.filter(f=>shelfOf(f)!=null);
 const hue=plan==='all'?'mint':HUE_P[plan];
 const tile=(v,l)=>`<div class="fd-tile"><b>${v}</b><span>${l}</span></div>`;
 const rand=v=>'R'+v.toFixed(2);
 const tiles=tile(foods.length,'Foods')
  +(priced.length?tile(rand(shelfOf(priced[0])),'Cheapest: '+esc(shortFood(priced[0].name))):'')
  +(priced.length>1?tile(rand(shelfOf(priced[priced.length-1])),'Dearest: '+esc(shortFood(priced[priced.length-1].name))):'');
 const rows=foods.map((f,i)=>{
  const fh=plan==='all'?HUE_P[f.plans[0]]:hue,parts=f.price?f.price.parts:[];
  const chart=parts.length?`<span class="fd-trio">${parts.map((p,j)=>foodMiniBars(p,i+j*3)).join('')}</span>`:`<span class="fd-one">${esc(f.store)}</span>`;
  const right=`<span class="fd-more">Why? ▾</span>`;
  return `<li class="fd-row hue-${fh}">
   <button id="fh-${f.k}" class="fd-head" data-action="toggleFood" data-args="${esc(f.k)}" aria-expanded="false" aria-controls="fd-${f.k}">
    <span class="fd-name">${esc(f.name)}<small>${esc(f.dose)}${plan==='all'?' · '+f.plans.map(k=>esc(PROTOCOLS[k].tag)).join(', '):''}</small></span>
    ${right}${chart}
   </button>
   <div id="fd-${f.k}" class="fd-detail" hidden>${foodDetail(f,plan)}</div>
  </li>`;}).join('');
 const p=plan==='all'?null:PROTOCOLS[plan];
 return `<section class="${anim?'stagger ':''}space-y-3.5">
  <div class="glass p-4">
   <div class="q-head"><div><div class="microlabel">Kitchen Pharmacy</div>
    <div class="display text-base font-extrabold">The food behind the plan</div></div>
    <button class="btn btn-glass q-tvbtn" data-action="closeFood">← Plan</button></div>
   <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">What each food costs at the amount in the plan, and why it is in the plan. Tap a food to see why.</p>
   <div class="fd-chips mt-3" role="group" aria-label="Which plan">
    ${Object.keys(PROTOCOLS).filter(k=>PROTOCOLS[k].items.length).map(k=>`<button class="fd-chip hue-${HUE_P[k]}" aria-pressed="${k===plan}" data-action="setFoodPlan" data-args="${esc(k)}">${esc(PROTOCOLS[k].tag)}</button>`).join('')}
    <button class="fd-chip hue-mint" aria-pressed="${plan==='all'}" data-action="setFoodPlan" data-args="all">All foods</button>
   </div>
   <div class="fd-tiles mt-3">${tiles}</div>
  </div>

  <div class="glass px-4 pb-4 pt-2">
   <ul class="fd-list ${anim?'fd-anim':''}">${rows}</ul>
   <p class="fd-foot">Each food’s own prices per unit: the cheapest, the middle (median) and the dearest verified price found online, and the store that sells it. The dearest is often a different brand or pack size. Store prices were checked online on ${PRICE_DATE}; they change and vary by branch, so check your own shop. The books give no prices.</p>
   <p class="fd-foot">Why each food — in our own words, from the health writings of Ellen G. White, or marked “general advice”.</p>
  </div>

  ${p?`<div class="fd-pouch"><div style="flex:1"><b>Tight budget? Church co-op starter pouch — R25</b><span>Bulk staples, ready at the exit table.</span></div></div>
  <div class="rounded-[22px] border border-amber-200/70 bg-amber-50/80 p-3.5 text-[11px] leading-relaxed text-amber-900">
   <b>Safety:</b> ${esc(DISCLAIMER)} Never stop prescribed pills suddenly, and ask your clinic before big changes in food if you take regular medicine.${p.note?` <b>This plan:</b> ${esc(p.note)}`:''}</div>`:''}
 </section>`;
}

/* ================= VIEW: CARE ================= */
export function viewCare(){
 /* the lists draw what a screen may still show (old visits' readings are dropped), and only people who
    agreed to follow-up appear in the calls list or with a phone number (E6) */
 const live=attendees.map(withoutOldReadings);
 const urgent=live.filter(redFlag).sort((x,y)=>Number(urgentAttended(x))-Number(urgentAttended(y))),open=urgent.filter(x=>!urgentAttended(x)).length,calls=live.filter(x=>x.interests.nurse&&optedIn(x)),
       inter=live.filter(x=>x.interests.cook||x.interests.stress||x.interests.pouch);
 const countTile=(n,l,cls)=>`<div class="rounded-[18px] border px-2 py-2.5 text-center ${cls}">
  <div class="display text-xl leading-none font-extrabold">${n}</div>
  <div class="mt-1.5 text-[10px] font-bold opacity-75">${l}</div></div>`;
 return `<section class="stagger space-y-4">
  <div class="glass p-4">
   <div class="flex items-start justify-between gap-3">
    <div><div class="microlabel">Ministry follow-up</div>
    <div class="display text-base font-extrabold">Tonight's care lists</div>
    <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Sorted automatically — no more paper cards.</p><div class="mt-1.5 flex flex-wrap gap-2"><button data-action="exportCSVMin" class="btn btn-glass px-2.5 py-1.5 text-[11px]" style="min-height:44px">Minimal CSV</button><button data-action="exportPrayerCSV" class="btn btn-glass px-2.5 py-1.5 text-[11px]" style="min-height:44px">Prayer list</button></div></div>
    <div class="flex flex-none flex-col gap-2"><button data-action="exportCSV" class="btn btn-primary px-3 py-2 text-[11px]" style="min-height:44px">Export CSV</button><button data-action="exportXLSX" class="btn btn-soft px-3 py-2 text-[11px]" style="min-height:44px">Excel</button></div>
   </div>
   <div class="mt-3.5 grid grid-cols-3 gap-2">
    ${countTile(open,urgent.length>open?`Urgent · ${urgent.length-open} attended`:'Urgent','border-rose-200/70 bg-rose-50/70 text-rose-700')}
    ${countTile(calls.length,'Follow-up calls','border-amber-200/70 bg-amber-50/70 text-amber-700')}
    ${countTile(inter.length,'Interests','border-lilac-200/80 bg-lilac-50/90 text-lilac-700')}
   </div>
  </div>
  ${listSection('Emergency — attend quickly',urgent,'rose')}
  ${listSection('48-hour follow-up calls',calls,'amber')}
  ${listSection('Seminar & co-op interests',inter,'brand')}
 </section>`;
}
function listSection(title,arr,tone){
 const head={rose:'text-rose-600',amber:'text-amber-600',brand:'text-lilac-700'}[tone];
 if(!arr.length)return `<div class="glass p-4"><div class="text-[11px] font-extrabold ${head}">${title}</div>
   <div class="mt-1 text-[11px] text-[#6b8187]">Nobody here — nice and quiet ✓</div></div>`;
 /* hundreds of cards at once would make the phone crawl (10,000 at once is ~175,000 page elements): show the first 30 and
   add 100 more per tap */
 const lim=CARE_CAP+((state.careMore&&state.careMore[tone])||0),shown=arr.slice(0,lim),left=arr.length-shown.length;
 return `<div class="space-y-2">
  <div class="px-1 text-[11px] font-extrabold uppercase tracking-wider ${head}">${title} · ${arr.length}</div>
 ${shown.map(x=>careCard(x,tone==='rose')).join('')}
 ${left>0?`<button data-action="showAllCare" data-args="${esc(tone)}" class="btn btn-glass w-full py-2.5 text-[11px] text-[#5b7178]">Show ${Math.min(CARE_MORE,left)} more · ${left} left</button>`:''}</div>`;
}
const CARE_CAP=30,CARE_MORE=100;
export function showAllCare(tone){state.careMore=Object.assign({},state.careMore,{[tone]:((state.careMore&&state.careMore[tone])||0)+CARE_MORE});renderMain();}
function careCard(a,urgent){
 const flags=[['BP',cat('bp',{sys:a.s.sys,dia:a.s.dia})],['Sugar',cat('sugar',a.s.sugar)],['BMI',cat('bmi',bmi(a))]]
  .filter(x=>x[1][0]==='flag'||x[1][0]==='watch');
 const tags=Object.keys(INT).filter(k=>a.interests[k]).map(k=>`<span class="rounded-lg bg-[#123033]/[.06] px-1.5 py-0.5 text-[9px] font-bold text-[#5b7178]">${INT[k]}</span>`).join('');
 const done=urgent&&urgentAttended(a),m=done&&a.interests.attended;
 return `<div class="glass p-3.5"${done?' style="opacity:.7"':''}>
  <div class="flex items-center gap-2.5">
   <span class="flex h-9 w-9 flex-none items-center justify-center rounded-[13px] text-[11px] font-extrabold tint hue-${hueOf(a.id)}">${initials(a.name)}</span>
   <div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold">${esc(a.name)}</div>
   <div class="mono truncate text-[10px] text-[#6b8187]">${esc(a.id)}${!optedIn(a)?' · no follow-up':a.phone?' · '+esc(a.phone):' · no phone recorded'}</div></div>
   ${optedIn(a)?`<button data-action="openWAFor" data-args="${esc(a.id)}" aria-label="WhatsApp ${esc(a.name)}"
     class="btn flex-none rounded-[14px] text-[#128C4B] transition active:scale-95"
     style="width:44px;height:44px;background:rgba(37,211,102,.14)">${I.wa}</button>`
    :`<span class="chip chip-none flex-none">No contact</span>`}
  </div>
  ${flags.length?`<div class="mt-2.5 flex flex-wrap gap-1.5">${flags.map(([l,c])=>`<span class="${chipClass(c[0])}">${l} ${c[1]==='—'?'':c[1]}</span>`).join('')}</div>`:''}
  ${tags?`<div class="mt-2 flex flex-wrap gap-1.5">${tags}</div>`:''}
  ${a.prayer?`<p class="mt-2.5 rounded-[14px] bg-white/60 px-2.5 py-2 text-[11px] italic leading-snug text-[#5c747a]">“${esc(a.prayer)}”</p>`:''}
  ${!urgent?'':done?`<div class="mt-2.5 flex items-center justify-between gap-2 text-[11px] font-bold text-[#1f6b62]"><span>✓ Attended to${m.by?' by '+esc(m.by):''}${m.at?' · '+esc(attendedWhen(m.at)):''}</span>
    <button class="tap-link" data-action="urgent-undo" data-args="${esc(a.id)}">Undo</button></div>`
   :`<button class="btn btn-soft mt-2.5 w-full py-2 text-xs" data-action="urgent-attended" data-args="${esc(a.id)}">Called / attended to ✓</button>`}
 </div>`;
}
/* when an urgent visitor was attended to, in this phone's local time */
const attendedWhen=iso=>{const d=new Date(iso);return isNaN(+d)?'':d.toLocaleString('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});};
/* who is marking it: the signed-in person's name or email, nothing in practice mode */
const markedBy=()=>{const m=cloud.acct&&cloud.acct.membership;return (m&&m.full_name)||(cloud.user&&cloud.user.email)||'';};
/* Care → Called / attended to ✓: the visitor stays on the Urgent list, greyed, but no longer counts in the red badge.
   It goes up with the visitor's row, so every desk in the church sees it. */
export function markAttended(id){
 const a=attendees.find(x=>x.id===id);if(!a||!redFlag(a))return;
 a.interests=a.interests||{};
 a.interests.attended={sig:dangerSig(a),at:new Date().toISOString(),by:markedBy()};
 persist();renderMain();renderNav();
 toastUndo(`${firstName(a.name)} marked as attended to`,()=>unmarkAttended(id));
}
export function unmarkAttended(id){
 const a=attendees.find(x=>x.id===id);if(!a||!a.interests||!a.interests.attended)return;
 delete a.interests.attended;
 persist();renderMain();renderNav();
}
/* ---------- exports (v1.6.2) ----------
   The follow-up sheet has one column per value so it sorts and filters in a spreadsheet: all 8 checks, blood pressure
   as two numbers, a flag next to each check, units in the headers, and when and where it was exported (SAST). Prayer
   requests are not in it: they go in their own list for the prayer team (exportPrayerCSV). The minimal sheet leaves
   out names, contact details, medical history and the survey. */
function sastStamp(d=new Date()){
 const p=new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
 const g=t=>(p.find(x=>x.type===t)||{}).value||'';
 return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')} SAST`;
}
/** @param {'full'|'minimal'|string} [mode] @returns {string[][]} the header row, then one row per visitor */
export function followUpRows(mode){
 const min=mode==='minimal',stamp=sastStamp();
 const expo=EXPO_UPCOMING&&EXPO_UPCOMING.name?`${EXPO_UPCOMING.name}${EXPO_UPCOMING.date?` (${EXPO_UPCOMING.date})`:''}`:'';
 const by=cloud.user?'Signed-in team device':'This device (practice mode)';
 /* a number as the passport shows it, '' for nothing; kept as text so a badge like 007 keeps its zeros */
 const n=v=>v==null||v===''||(typeof v==='number'&&!isFinite(v))?'':typeof v==='number'?disp(v):String(v);
 const yn=v=>v===1?'Yes':v===0?'No':'';
 const flag=c=>c&&c[1]&&c[0]!=='ok'?`${c[0]==='flag'?'FLAG':'Watch'}: ${c[1]}`:c&&c[1]?'In range':'';
 const ticked=(a,set)=>Object.keys(set).filter(k=>a.interests[k]).map(k=>set[k]).join('; ');
 const head=['Badge',...(min?[]:['Name','Phone','Email']),'Age','Sex','Height (cm)','Weight (kg)','Waist (cm)',...(min?[]:['Body fat %','Body water %','PEF (L/min)','Recovery pulse (bpm)']),'BMI (kg/m²)','BMI flag',
  'BP systolic (mmHg)','BP diastolic (mmHg)','BP flag','BP medication','Blood sugar (mmol/L)','Sugar flag','Cholesterol (mmol/L)','Cholesterol flag',
  'Fruit & veg (servings/day)','Exercise (min/day)','Water (glasses/day)','Sleep (hours/night)','Checks done (of 8)',
  ...(min?[]:['Pregnant','Major operations','Chronic illnesses',...SURVEY.map(x=>x.q),'Also talk about','Interests','Seminars','Heard via']),
  'Health age','Flags',...(min?[]:['Prayer request']),
  'Health consent','Consent date','Notice version',...(min?[]:['Parent or guardian']),'Follow-up allowed','Expo','Recorded on','Exported (SAST)'];
 const rows=[head];
 attendees.forEach(raw=>{
  /* the readings of a visit past the grace period are never exported either (the database has already cleared them) */
  const a=withoutOldReadings(raw),s=a.s||{},ha=healthAge(a),b=bmi(a);
  /* this is the follow-up sheet: no contact details for anyone who did not agree to be contacted */
  const ok=optedIn(a);
  const cb=s.sys&&s.dia?cat('bp',{sys:s.sys,dia:s.dia}):null,cs=s.sugar!=null?cat('sugar',s.sugar):null,cc=s.chol!=null?cat('chol',s.chol):null,cm=b?cat('bmi',b):null;
  const fl=[['BP',cb],['Sugar',cs],['Cholesterol',cc],['BMI',cm]].filter(([,c])=>c&&(c[0]==='flag'||c[0]==='watch')).map(([l,c])=>`${l}: ${c[1]}`).join('; ');
  const done=[s.weight!=null&&a.heightCm,s.sys&&s.dia,s.sugar!=null,s.chol!=null,s.veg!=null,s.walk!=null,s.water!=null,s.sleep!=null].filter(Boolean).length;
  rows.push([a.id,...(min?[]:[a.name||'',ok&&a.phone||'',ok&&a.email||'']),n(a.age),a.sex||'',n(a.heightCm),n(s.weight),n(s.waist),...(min?[]:[n(s.fat),n(s.tbw),n(s.pef),n(s.pulseRec)]),b?fmt1(b):'',flag(cm),
   n(s.sys),n(s.dia),flag(cb),yn(s.bpMed),n(s.sugar),flag(cs),n(s.chol),flag(cc),n(s.veg),n(s.walk),n(s.water),n(s.sleep),String(done),
   ...(min?[]:[yn(s.preg),yn(s.ops),s.chronic===1?'Yes'+(a.chronicList?': '+a.chronicList:''):yn(s.chronic),
    ...SURVEY.map(x=>s[x.k]?x.a[s[x.k]-1]:''),careNotes(a).join(' '),ticked(a,INT),ticked(a,SEMINARS),ticked(a,HEARD)]),
   ha.health!=null&&isFinite(ha.health)?fmt1(ha.health):a.age!=null&&a.age<18?'under 18':'incomplete',fl,...(min?[]:[a.prayer?'Yes (see prayer list)':'No']),
   hasConsent(a)?'Yes':'Not recorded',a.interests.consentOn||'',a.interests.consentV||'',...(min?[]:[a.interests.guardianName||'']),ok?'Yes':'No',expo,by,stamp]);
 });
 return rows;
}
export function exportCSV(mode){
 const minimal=mode==='minimal';
 downloadCSV(followUpRows(minimal?'minimal':'full'),minimal?'newstart-followup-minimal.csv':'newstart-followup.csv',
  minimal?'Minimal sheet exported (CSV: badge, checks and consent only) ✓':'Follow-up sheet exported (CSV) ✓ This file holds health data: delete it when you are done.');
}
/* the prayer team's own list: first name, a phone only when follow-up is allowed, and the request */
export function exportPrayerCSV(){
 const st=sastStamp(),rows=[['Badge','First name','Phone (if follow-up allowed)','Prayer request','Exported (SAST)']];
 /* a past-grace visit's prayer request goes with its readings: a stale prayer is not the prayer team's business (E7) */
 attendees.forEach(a=>{if(a.prayer&&!visitIsOld(a))rows.push([a.id,firstName(a.name||''),optedIn(a)&&a.phone||'',a.prayer,st]);});
 downloadCSV(rows,'newstart-prayer-list.csv','Prayer list exported (CSV) ✓ Share it only with the prayer team.');
}
/* Quote every cell, and defuse spreadsheet formulas: a typed name like =HYPERLINK(...) would
   otherwise execute when the file is opened in Excel. Phone numbers starting "+27" stay as they are. */
/* Anything starting with + or - is a formula to a spreadsheet ("+1+HYPERLINK(...)", "-2+3"), unless it is plainly a phone
   number or a number: only digits, spaces and . , ( ) - after the sign. A leading | is defused too (DDE). */
export const csvCell=c=>{let s=c==null||(typeof c==='number'&&!isFinite(c))?'':String(c);
 if(/^[=@\t\r|]/.test(s)||(/^[+-]/.test(s)&&!/^(\+\d[\d\s().-]*|-?\d+([.,]\d+)?|\+27 —)$/.test(s)))s="'"+s;
 return `"${s.replace(/"/g,'""')}"`;};

/* ---------- Excel (.xlsx) without a library ----------
   An .xlsx is a zip of a few XML files. zipStore writes them uncompressed ("stored"), which every spreadsheet app
   reads. The header row is bold, shaded, frozen and has filters; numbers are numbers, except ones with leading zeros. */
/** @type {Uint32Array|null} */
let crcTable=null;
/** @param {Uint8Array} u */
function crc32(u){
 if(!crcTable){
  crcTable=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
 }
 let c=0xFFFFFFFF;
 for(let i=0;i<u.length;i++)c=crcTable[(c^u[i])&255]^(c>>>8);
 return (c^0xFFFFFFFF)>>>0;
}
/** @param {[string,string][]} files name and text of each file in the zip @returns {Blob} */
function zipStore(files){
 const te=new TextEncoder(),parts=[],cen=[];
 const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
 /* version 2.0, UTF-8 names, stored, fixed 1980-01-01 time */
 const common=c=>[...u16(20),0,8,0,0,0,0,0,33,...u32(c)];
 let off=0;
 for(const [name,txt] of files){
  const nb=te.encode(name),d=te.encode(txt),c=crc32(d);
  const h=new Uint8Array([80,75,3,4,...common(c),...u32(d.length),...u32(d.length),...u16(nb.length),0,0]);
  parts.push(h,nb,d);
  cen.push(new Uint8Array([80,75,1,2,...u16(20),...common(c),...u32(d.length),...u32(d.length),...u16(nb.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(off)]),nb);
  off+=h.length+nb.length+d.length;
 }
 const cs=cen.reduce((t,x)=>t+x.length,0);
 const end=new Uint8Array([80,75,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cs),...u32(off),0,0]);
 return new Blob([...parts,...cen,end],{type:XLSX_MIME});
}
const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XML_HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main',NS_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** @param {{name:string,rows:string[][],data:boolean}[]} sheets the first sheet with data:true gets the frozen, filtered header */
export function xlsxBuild(sheets){
 const x=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
 const col=i=>{let r='';for(i++;i>0;i=((i-1)/26)|0)r=String.fromCharCode(65+((i-1)%26))+r;return r;};
 const num=/^-?\d+(\.\d+)?$/;
 const cell=(v,ri,ci,isData)=>{
  const ref=col(ci)+(ri+1),sv=v==null?'':String(v);
  if(ri>0&&isData&&num.test(sv)&&!/^0\d/.test(sv)&&sv.length<15)return `<c r="${ref}"><v>${sv}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${ri===0?' s="1"':''}><is><t xml:space="preserve">${x(sv)}</t></is></c>`;
 };
 const sheetXml=(rows,isData)=>{
  const w=rows[0].map((_,ci)=>Math.min(48,Math.max(8,...rows.slice(0,200).map(r=>String(r[ci]??'').length+2))));
  return XML_HEAD+`<worksheet xmlns="${NS_MAIN}"><sheetViews><sheetView workbookViewId="0">${isData?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>':''}</sheetView></sheetViews>`
   +`<cols>${w.map((v,i)=>`<col min="${i+1}" max="${i+1}" width="${v}" customWidth="1"/>`).join('')}</cols>`
   +`<sheetData>${rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>cell(v,ri,ci,isData)).join('')}</row>`).join('')}</sheetData>`
   +(isData?`<autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/>`:'')+'</worksheet>';
 };
 const first=sheets[0];
 const files=[
  ['[Content_Types].xml',XML_HEAD+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
   +sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'],
  ['_rels/.rels',XML_HEAD+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml',XML_HEAD+`<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${sheets.map((sh,i)=>`<sheet name="${x(sh.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets>`
   +(first.data?`<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${x(first.name)}'!$A$1:$${col(first.rows[0].length-1)}$${first.rows.length}</definedName></definedNames>`:'')+'</workbook>'],
  ['xl/_rels/workbook.xml.rels',XML_HEAD+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
   +sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')
   +`<Relationship Id="rId${sheets.length+1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`],
  /* style 1: bold on a light green fill, for the header row */
  ['xl/styles.xml',XML_HEAD+`<styleSheet xmlns="${NS_MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFEA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
  ...sheets.map((sh,i)=>/** @type {[string,string]} */([`xl/worksheets/sheet${i+1}.xml`,sheetXml(sh.rows,sh.data)]))
 ];
 return zipStore(/** @type {[string,string][]} */(files));
}
export function exportXLSX(mode){
 const minimal=mode==='minimal',rows=followUpRows(minimal?'minimal':'full');
 const meta=[['About this file',''],['Exported (SAST)',sastStamp()],['Expo',EXPO_UPCOMING&&EXPO_UPCOMING.name||''],['Rows',String(rows.length-1)],
  ['Sheet',minimal?'Minimal: badge, checks and consent only':'Full follow-up sheet (contact details only when follow-up is allowed)'],
  ['Prayer requests','Not included: export the separate prayer list'],
  ['Privacy','Holds health data (POPIA special personal information). Share only with the follow-up team and delete it when you are done.']];
 const blob=xlsxBuild([{name:'Follow-up',rows,data:true},{name:'About',rows:meta,data:false}]);
 saveExport(minimal?'newstart-followup-minimal.xlsx':'newstart-followup.xlsx',XLSX_MIME,blob,
  'Follow-up sheet exported (Excel) ✓ This file holds health data: delete it when you are done.');
}
/* Saves the CSV and says so only once it is saved. */
export function downloadCSV(rows,filename,okMsg){
 const csv=rows.map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
 saveExport(filename,'text/csv','\uFEFF'+csv,okMsg);      /* the byte-order mark makes Excel read the file as UTF-8 */
}
/* The Android app's WebView ignores a blob link's download, so there the native plugin writes the file into the app's
   private folder and opens the share sheet (CardPrinterPlugin.saveDownload → SecureExport): nothing is left in the
   public Downloads folder. In a browser it is an ordinary download.
   @param {string} filename @param {string} mime @param {string|Blob} data */
function saveExport(filename,mime,data,okMsg){
 if(IS_APP){
  if(saveBusy.has(filename)){toast('One save is already in progress');return;}   /* a second save of THIS file while it is still handing off (R4); a different file may queue behind */
  const P=window.Capacitor.Plugins.CardPrinter;
  if(!P||!P.saveDownload){toast('Saving files needs the latest version of the app');return;}
  /* the plugin takes text; binary files go as base64 behind a b64: marker */
  const text=typeof data==='string'?Promise.resolve(data):data.arrayBuffer().then(ab=>{
   const u=new Uint8Array(ab);let b='';
   for(let i=0;i<u.length;i+=32768)b+=String.fromCharCode.apply(null,u.subarray(i,i+32768));
   return 'b64:'+btoa(b);
  });
  saveBusy.add(filename);
  text.then(t=>P.saveDownload({name:filename,text:t,mime}))
   .then(()=>toast(`${okMsg} Choose where to send ${filename} (it is not kept in Downloads).`))
   .catch(e=>toast('Could not save the file. Try again.'))   /* fixed words: the raw plugin error names nothing useful (R4) */
   .finally(()=>{saveBusy.delete(filename);});   /* only this file's own guard: another file's finishing save no longer clears it */
  return;
 }
 toast(okMsg);
 const blob=typeof data==='string'?new Blob([data],{type:mime+';charset=utf-8'}):data;
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=filename;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
