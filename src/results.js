// @ts-check
import { I } from './icons.js';
import { $, A } from './helpers.js';
import { INT } from './data.js';
import { DROPS, FOOD_PRICES, PRICE_DATE, SEX_RANGE, autoProtocol, bmi, cat, chipClass, clamp, costOf, esc, firstName, fmt1, healthAge, initials, money, pefPct, projection, redFlag, simBP, tweenGoal } from './helpers.js';
import { ACTIONS, DISCLAIMER, FOOD_WHY, HEARD, HUE_P, PLAN_GOAL, PROTOCOLS, RECHECK, SEMINARS, SURVEY, attendees, cholUp, heavy, hueOf, planBooks, precautionsHTML, refLabel, state } from './data.js';
import { persist } from './state.js';
import { IS_APP } from './platform.js';
import { jelly, renderMain, syncRanges, toast } from './shell.js';
import { chosenChurchPlan, churchPlanFor, churchPlanPicker, customPlanFor, viewChurchPlan } from './churchPlans.js';
import { customPlanBox } from './customPlan.js';
import { GRACE_DAYS, hasReadings, readingsGone, visitIsOld, withoutOldReadings } from './retention.js';
import { hasConsent, optedIn } from './visitor.js';
/* the three numbers at the top of Results: actual age, health age now, and the 90-day goal */
function scoreTiles(tile,a,ha,proj,gone){
 return `${tile('Actual age',fmt1(a.age),'yrs old','border-sky-200/70 bg-sky-50/80 text-sky-800')}
    ${tile('Now',gone?'—':ha.health!=null?fmt1(ha.health):'—',gone?'readings deleted':ha.complete?`${ha.total>0?'+':''}${fmt1(ha.total)} yrs`:ha.f.length+'/8 done',
      ha.total>0.4?'border-rose-200/70 bg-rose-50/70 text-rose-700':'border-sage-200/80 bg-sage-50/90 text-sage-800')}
    ${tile('90-day goal',gone?'—':fmt1(proj.age),gone?'readings deleted':`win ${fmt1(proj.yearsWon)} yrs`,'border-lilac-200/80 bg-lilac-50/90 text-lilac-700','scoreGoal')}`;
}
/* the "What adds the most years" list, longest first, with the rest behind a tap */
function yearsHTML(byYears,row){
 return `<div class="space-y-1.5">${byYears.slice(0,3).map(row).join('')}</div>
   ${byYears.length>3?`<details class="pl-switch"><summary>Show all ${byYears.length} ▾</summary><div class="mt-2 space-y-1.5">${byYears.slice(3).map(row).join('')}</div></details>`:''}`;
}
/* what the "What to work on" card lists: the needs, or the all-clear */
function workOnHTML(a,needs){
 return needs.length?`<div class="mt-2.5 space-y-1.5">${needs.map((n,i)=>`<div class="flex items-start gap-2.5 rounded-[16px] px-3 py-2 ${i?'bg-white/50':'bg-white/85 ring-1 ring-brand-400/25'}">
      <span class="chip ${n.sev>=3?'chip-flag':'chip-watch'} mt-0.5 flex-none">${PROTOCOLS[n.k].tag}</span>
      <span class="text-[11px] leading-snug text-[#33504f]">${esc(problemOf(a,n.k))}</span></div>`).join('')}</div>
    <p class="mt-2.5 text-[11px] leading-snug text-[#5c747a]">Next, the Plan turns <b class="text-[#123033]">${PROTOCOLS[needs[0].k].tag.toLowerCase()}</b> into 3 clear actions.</p>`
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
  <div class="display mt-1.5 text-xl leading-none font-extrabold" ${id?`id="${id}"`:''}>${v}</div>
  <div class="mt-1 text-[9px] font-bold opacity-80" ${id?`id="${id}Sub"`:''}>${sub}</div></div>`;
 const bar=(id,lblId,label,base,now)=>`<div>
  <div class="flex justify-between text-[10px] font-bold"><span class="text-[#5c747a]">${label}</span>
  <span id="${lblId}" class="mono text-brand-700">${base} → ${now}</span></div>
  <div class="bar-track mt-1.5"><div id="${id}" class="bar-fill" style="width:${clamp(now/base*100,30,100)}%"></div></div></div>`;
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
   <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Worked out from the 8 checks, no maths needed.</p>
   ${gone?goneNote('mt-2 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-3 py-2 text-[10.5px] font-semibold leading-snug text-sky-800'):''}
   <div class="mt-3.5 grid grid-cols-3 gap-2">${scoreTiles(tile,a,ha,proj,gone)}</div>
   ${gone||ha.complete?'':`<div class="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[10px] font-semibold leading-snug text-amber-800">
     Finish all 8 checks for the exact score. Missing checks use typical values in the goal above.</div>`}
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
     <span id="simAge" class="mono text-sm font-bold text-brand-700">${fmt1(proj.age)} yrs</span>
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
  line=c[0]==='flag'?'See the triage nurse before anything else today.'
   :c[0]==='watch'?'Have it checked again in 3 weeks, cut down on salt and walk every day.'
   :c[0]==='ok'?'Keep it there with less salt, daily walks and plenty of vegetables.':'';
 }else if(k==='sugar'){
  if(a.s.sugar!=null)value=`${a.s.sugar} mmol/L`;
  c=cat('sugar',a.s.sugar);
  entry=[['Reading',a.s.sugar==null?'—':`${a.s.sugar} mmol/L`]];
  line=c[0]==='flag'?'See the triage nurse before anything else today.'
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
   <label for="${id}" class="text-[12px] font-bold leading-tight text-[#33504f]">${label}</label>
   <span id="${badgeId}" class="mono flex-none rounded-full tint px-2 py-0.5 text-[10px] font-bold"></span>
  </div>
  <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-on-input="sim-set" data-args="${key}" class="mt-1 w-full">
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
 tweenGoal(proj.age);
 set('scoreGoalSub',`win ${fmt1(proj.yearsWon)} yrs`);
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
 /* only a high reading: the blood-sugar plan lowers sugar, so a low one goes to the nurse instead (careNotes) */
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
  :'Your numbers look fine today. This plan helps keep them that way.';
}
/* What the counsellor must also raise: things no home plan covers, from the paper record and survey. Plain sentences. */
export function careNotes(a){
 const s=a.s,out=[];
 if(s.sugar!=null&&s.sugar<4)out.push(`Blood sugar ${s.sugar} mmol/L is low (healthy is 4–8). Give a sweet drink or fruit now, and the nurse should see them.`);
 if(s.bpMed===1)out.push('Takes blood-pressure medication: keep taking it. This plan does not replace it; only their doctor changes it.');
 if(s.preg===1)out.push('Pregnant: the nurse should see her before the step test and before any plan.');
 if(s.chronic===1)out.push(`Chronic illness${a.chronicList?': '+a.chronicList:''}. Check the plan with their doctor.`);
 if(s.ops===1)out.push('Has had a major operation: ask the nurse before the step test.');
 const w=cat('waist',{v:s.waist,sex:a.sex});
 if(w[0]&&w[0]!=='ok')out.push(`Waist ${s.waist} cm: ${w[1].toLowerCase()} (${a.sex==='Female'?'under 80':'under 94'} is healthy).`);
 const p=pefPct(a);
 if(p!=null&&p<80)out.push(`Lung function ${s.pef} is ${p}% of the recommended ${s.pefExp}. ${p<50?'The nurse should see them today.':'Suggest a clinic check.'}`);
 if(s.pulseRest!=null&&s.pulseRest>100)out.push(`Resting pulse ${s.pulseRest} is fast (normal is 60–100). Skip the step test; the nurse should check it.`);
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
 if(redFlag(a))return {t:'See the triage nurse now, before anything else',w:'A reading is in the danger range: blood pressure 160/100 or more, or blood sugar 15 or more, or under 3.'};
 const red=pk==='bp'?cat('bp',{sys:a.s.sys,dia:a.s.dia})[0]==='flag':pk==='sugar'?cat('sugar',a.s.sugar)[0]==='flag'
  :pk==='bmi'?cat('chol',a.s.chol)[0]==='flag'||cat('bmi',bmi(a))[0]==='flag':false;
 return red?{t:'Book a clinic visit this week',w:'This reading is in the red range. The plan below helps, but a clinic must check it.'}:null;
}
export function planFor(a,pk){
 /* item 5: a custom plan written for this visitor IS the plan. It comes before the church library and before
    the generated plan, and every caller (Plan, Send home, WhatsApp, email, the printed card) gets the same
    object, so none of them can announce a different plan from the one the visitor was shown (D-04, R-07). */
 const custom=a&&a.interests&&a.interests.customPlan;
 if(custom&&typeof custom==='object')return customPlanFor(a,custom);
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
   <p class="text-[11.5px] leading-relaxed text-[#3d5c5e]">${p.mech}</p>
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
   <button id="fh-${f.k}" class="fd-head" data-action="toggleFood" data-args="${f.k}" aria-expanded="false" aria-controls="fd-${f.k}">
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
    ${Object.keys(PROTOCOLS).filter(k=>PROTOCOLS[k].items.length).map(k=>`<button class="fd-chip hue-${HUE_P[k]}" aria-pressed="${k===plan}" data-action="setFoodPlan" data-args="${k}">${esc(PROTOCOLS[k].tag)}</button>`).join('')}
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
 const urgent=attendees.filter(redFlag),calls=attendees.filter(x=>x.interests.nurse),
       inter=attendees.filter(x=>x.interests.cook||x.interests.stress||x.interests.pouch);
 const countTile=(n,l,cls)=>`<div class="rounded-[18px] border px-2 py-2.5 text-center ${cls}">
  <div class="display text-xl leading-none font-extrabold">${n}</div>
  <div class="mt-1.5 text-[10px] font-bold opacity-75">${l}</div></div>`;
 return `<section class="stagger space-y-4">
  <div class="glass p-4">
   <div class="flex items-start justify-between gap-3">
    <div><div class="microlabel">Ministry follow-up</div>
    <div class="display text-base font-extrabold">Tonight's care lists</div>
    <p class="mt-1 text-[11px] leading-snug text-[#5c747a]">Sorted automatically — no more paper cards.</p></div>
    <button data-action="exportCSV" class="btn btn-primary flex-none px-3 py-2 text-[11px]">Export CSV</button>
   </div>
   <div class="mt-3.5 grid grid-cols-3 gap-2">
    ${countTile(urgent.length,'Urgent','border-rose-200/70 bg-rose-50/70 text-rose-700')}
    ${countTile(calls.length,'Nurse calls','border-amber-200/70 bg-amber-50/70 text-amber-700')}
    ${countTile(inter.length,'Interests','border-lilac-200/80 bg-lilac-50/90 text-lilac-700')}
   </div>
  </div>
  ${listSection('Urgent — refer to triage',urgent,'rose')}
  ${listSection('48-hour nurse calls',calls,'amber')}
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
 ${shown.map(x=>careCard(x)).join('')}
 ${left>0?`<button data-action="showAllCare" data-args="${tone}" class="btn btn-glass w-full py-2.5 text-[11px] text-[#5b7178]">Show ${Math.min(CARE_MORE,left)} more · ${left} left</button>`:''}</div>`;
}
const CARE_CAP=30,CARE_MORE=100;
export function showAllCare(tone){state.careMore=Object.assign({},state.careMore,{[tone]:((state.careMore&&state.careMore[tone])||0)+CARE_MORE});renderMain();}
function careCard(a){
 const flags=[['BP',cat('bp',{sys:a.s.sys,dia:a.s.dia})],['Sugar',cat('sugar',a.s.sugar)],['BMI',cat('bmi',bmi(a))]]
  .filter(x=>x[1][0]==='flag'||x[1][0]==='watch');
 const tags=Object.keys(INT).filter(k=>a.interests[k]).map(k=>`<span class="rounded-lg bg-[#123033]/[.06] px-1.5 py-0.5 text-[9px] font-bold text-[#5b7178]">${INT[k]}</span>`).join('');
 return `<div class="glass p-3.5">
  <div class="flex items-center gap-2.5">
   <span class="flex h-9 w-9 flex-none items-center justify-center rounded-[13px] text-[11px] font-extrabold tint hue-${hueOf(a.id)}">${initials(a.name)}</span>
   <div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold">${esc(a.name)}</div>
   <div class="mono truncate text-[10px] text-[#6b8187]">${esc(a.id)} · ${esc(a.phone)}</div></div>
   ${optedIn(a)?`<button data-action="openWAFor" data-args="${a.id}" aria-label="WhatsApp ${esc(a.name)}"
     class="btn flex-none rounded-[14px] text-[#128C4B] transition active:scale-95"
     style="width:44px;height:44px;background:rgba(37,211,102,.14)">${I.wa}</button>`
    :`<span class="chip chip-none flex-none">No contact</span>`}
  </div>
  ${flags.length?`<div class="mt-2.5 flex flex-wrap gap-1.5">${flags.map(([l,c])=>`<span class="${chipClass(c[0])}">${l} ${c[1]==='—'?'':c[1]}</span>`).join('')}</div>`:''}
  ${tags?`<div class="mt-2 flex flex-wrap gap-1.5">${tags}</div>`:''}
  ${a.prayer?`<p class="mt-2.5 rounded-[14px] bg-white/60 px-2.5 py-2 text-[11px] italic leading-snug text-[#5c747a]">“${esc(a.prayer)}”</p>`:''}
 </div>`;
}
export function exportCSV(){
 const rows=[['Badge','Name','Phone','Email','Age','Sex','Height cm','Weight kg','BP','BP medication','Sugar mmol/L','BMI','Waist cm','Body fat %','Body water %',
  'PEF','PEF recommended','Resting pulse','Exercise pulse','Recovery pulse','Pregnant','Major operations','Chronic illnesses',
  ...SURVEY.map(x=>x.q),'Health age','Flags','Also talk about','Interests','Seminars','Heard via','Prayer note',
  'Health consent','Consent date','Notice version','Parent or guardian','Follow-up allowed']];
 const yn=v=>v===1?'Yes':v===0?'No':'';
 const ticked=(a,set)=>Object.keys(set).filter(k=>a.interests[k]).map(k=>set[k]).join('; ');
 attendees.forEach(raw=>{
  /* the readings of a visit past the grace period are never exported either (the database has already cleared them) */
  const a=withoutOldReadings(raw),ha=healthAge(a),s=a.s;
  const fl=[cat('bp',{sys:s.sys,dia:s.dia}),cat('sugar',s.sugar),cat('bmi',bmi(a))].filter(c=>c[0]==='flag'||c[0]==='watch').map(c=>c[1]).join('; ');
  /* this is the follow-up sheet: no contact details for anyone who did not agree to be contacted */
  const ok=optedIn(a);
  rows.push([a.id,a.name,ok?a.phone:'',ok?a.email||'':'',a.age,a.sex,a.heightCm??'',s.weight??'',s.sys&&s.dia?`${s.sys}/${s.dia}`:'',yn(s.bpMed),s.sugar??'',bmi(a)?fmt1(bmi(a)):'',
   s.waist??'',s.fat??'',s.tbw??'',s.pef??'',s.pefExp??'',s.pulseRest??'',s.pulseEx??'',s.pulseRec??'',
   yn(s.preg),yn(s.ops),s.chronic===1?'Yes'+(a.chronicList?': '+a.chronicList:''):yn(s.chronic),
   ...SURVEY.map(x=>s[x.k]?x.a[s[x.k]-1]:''),ha.health!=null?fmt1(ha.health):'incomplete',fl,careNotes(a).join(' '),
   ticked(a,INT),ticked(a,SEMINARS),ticked(a,HEARD),a.prayer,
   hasConsent(a)?'Yes':'Not recorded',a.interests.consentOn||'',a.interests.consentV||'',a.interests.guardianName||'',ok?'Yes':'No']);
 });
 downloadCSV(rows,'newstart-followup.csv','Follow-up sheet exported (CSV) ✓ This file holds health data: delete it when you are done.');
}
/* Quote every cell, and defuse spreadsheet formulas: a typed name like =HYPERLINK(...) would
   otherwise execute when the file is opened in Excel. Phone numbers starting "+27" stay as they are. */
/* Anything starting with + or - is a formula to a spreadsheet ("+1+HYPERLINK(...)", "-2+3"), unless it is plainly a phone
   number or a number: only digits, spaces and . , ( ) - after the sign. */
export const csvCell=c=>{let s=String(c==null?'':c);
 if(/^[=@\t\r]/.test(s)||(/^[+-]/.test(s)&&!/^(\+\d[\d\s().-]*|-?\d+([.,]\d+)?|\+27 —)$/.test(s)))s="'"+s;
 return `"${s.replace(/"/g,'""')}"`;};
/* Saves the CSV and says so only once it is saved. The Android app's WebView ignores a blob link's download, so there
   the native plugin writes the file into Downloads (CardPrinterPlugin.saveDownload). */
export function downloadCSV(rows,filename,okMsg){
 const csv=rows.map(r=>r.map(csvCell).join(',')).join('\n');
 if(IS_APP){
  const P=window.Capacitor.Plugins.CardPrinter;
  if(!P||!P.saveDownload){toast('Saving files needs the latest version of the app');return;}
  P.saveDownload({name:filename,text:'﻿'+csv,mime:'text/csv'})
   .then(r=>toast(`${okMsg} Saved in ${r&&r.where||'Downloads'} as ${filename}.`))
   .catch(e=>toast('Could not save the file: '+(e&&e.message||e)));
  return;
 }
 toast(okMsg);
 const url=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
