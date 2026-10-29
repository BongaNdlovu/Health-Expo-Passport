// @ts-check
import { PROTOCOLS, attendees, state } from './data.js';
import { planNeeds } from './results.js';
/* Shared helpers: escaping, csv, dates, prices, the health-age engine and the number tween. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= HELPERS ================= */
export const $=s=>document.querySelector(s);
export const fmt1=n=>(Math.round(n*10)/10).toFixed(1);
export const disp=v=>v==null?'':(Number.isInteger(v)?String(v):fmt1(v));
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/* volunteer-supplied text is rendered into HTML, so escape it */
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=v=>'R'+v.toFixed(2);
/* date the shopping-list prices were checked; set by tools/update-prices.js with the item prices */
export const PRICE_DATE='19 Oct 2026';
/* FOOD_PRICES:BEGIN — written by tools/update-prices.js from prices/prices.csv; do not edit by hand. Per food: the
   cheapest, median and dearest verified store price per unit, how many prices and which stores, for the Food screen. */
export const FOOD_PRICES={"oats":{"names":["Rolled oats / oat bran","Rolled oats / whole grains","Rolled oats"],"note":"","parts":[{"label":"","unit":"per kg","amount":"60 g dry oats","qty":0.06,"min":29.99,"med":44.99,"max":153.98,"n":11,"stores":["Checkers","Makro","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"SPAR","dear":"Pick n Pay"}]},"flax":{"names":["Ground flaxseed"],"note":"","parts":[{"label":"","unit":"per kg","amount":"2 tbsp ground flaxseed ≈ 15 g (1 tbsp ≈ 7 g)","qty":0.015,"min":149.98,"med":149.98,"max":211.96,"n":5,"stores":["Checkers","Pick n Pay","Woolworths"],"cheap":"Checkers","dear":"Woolworths"}]},"garlic":{"names":["Raw garlic"],"note":"","parts":[{"label":"","unit":"per kg","amount":"2 cloves ≈ 10 g","qty":0.01,"min":199.99,"med":246.6,"max":316.58,"n":3,"stores":["Checkers","SPAR","Woolworths"],"cheap":"SPAR","dear":"Woolworths"}]},"celery":{"names":["Celery"],"note":"","parts":[{"label":"","unit":"a bunch","amount":"2–4 stalks ≈ ¼ of a bunch","qty":0.25,"min":25.99,"med":28.99,"max":29.99,"n":3,"stores":["Pick n Pay","Woolworths"],"cheap":"Pick n Pay","dear":"Pick n Pay"}]},"tomato":{"names":["Tomatoes"],"note":"","parts":[{"label":"","unit":"per kg","amount":"2 medium tomatoes ≈ 150 g","qty":0.15,"min":19.99,"med":32.99,"max":34.99,"n":8,"stores":["Checkers","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"SPAR","dear":"Checkers"}]},"potato":{"names":["Potatoes (with skin)"],"note":"","parts":[{"label":"","unit":"per kg","amount":"250 g potatoes","qty":0.25,"min":10,"med":12.49,"max":25,"n":9,"stores":["Checkers","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"Shoprite","dear":"Woolworths"}]},"rice":{"names":["Brown rice / whole maize meal"],"note":"unsifted maize meal was not found online, STAND-IN super (sifted) maize meal","parts":[{"label":"","unit":"per kg","amount":"60 g dry brown rice","qty":0.06,"min":18.98,"med":22.5,"max":44.99,"n":11,"stores":["Checkers","Game","Makro","Pick n Pay","Shoprite","Woolworths"],"cheap":"Makro","dear":"Checkers"}]},"onion":{"names":["Onions"],"note":"","parts":[{"label":"","unit":"per kg","amount":"1 medium onion ≈ 150 g","qty":0.15,"min":12.49,"med":30,"max":39.99,"n":9,"stores":["Checkers","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"SPAR","dear":"Woolworths"}]},"beans":{"names":["Green beans"],"note":"","parts":[{"label":"","unit":"per kg","amount":"100 g green beans","qty":0.1,"min":29.99,"med":83.3,"max":218.56,"n":7,"stores":["Checkers","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"SPAR","dear":"Woolworths"}]},"lentils":{"names":["Brown lentils / beans"],"note":"","parts":[{"label":"","unit":"per kg","amount":"½ cup cooked ≈ 45 g dry lentils or sugar beans","qty":0.045,"min":43.98,"med":51.98,"max":111.98,"n":15,"stores":["Checkers","Game","Makro","Pick n Pay","Shoprite","Woolworths"],"cheap":"Pick n Pay","dear":"Woolworths"}]},"slaw":{"names":["Cabbage & carrots (raw salad)"],"note":"","parts":[{"label":"carrots","unit":"per kg","amount":"150 g carrots","qty":0.15,"min":14.99,"med":14.99,"max":21.99,"n":5,"stores":["Checkers","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"Pick n Pay","dear":"Woolworths"},{"label":"cabbage","unit":"a head","amount":"150 g cabbage ≈ 1/10 of a head (assumes a ~1.5 kg head; stores sell cabbage per head, weight not stated)","qty":0.1,"min":14.99,"med":16.99,"max":35.98,"n":7,"stores":["Checkers","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"SPAR","dear":"Woolworths"}]},"valerian":{"names":["Valerian / hops tea"],"note":"STAND-IN: loose dried valerian root, as no valerian teabags were found priced online","parts":[{"label":"","unit":"per 100 g","amount":"1 cup ≈ 2.5 g dried valerian root","qty":0.0025,"min":124.99,"med":124.99,"max":124.99,"n":1,"stores":["Dis-Chem"],"cheap":"Dis-Chem","dear":"Dis-Chem"}]},"dates":{"names":["Figs or dates"],"note":"priced as dates; no dried figs were found priced online","parts":[{"label":"","unit":"per kg","amount":"2–3 dates ≈ 25 g","qty":0.025,"min":79.96,"med":95.88,"max":219.93,"n":8,"stores":["Checkers","Makro","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"Checkers","dear":"Woolworths"}]},"crackers":{"names":["Whole-grain crackers"],"note":"","parts":[{"label":"","unit":"per kg","amount":"2–3 Provita-type crispbreads ≈ 25 g (≈ 8 g each)","qty":0.025,"min":153.98,"med":183.96,"max":274.64,"n":6,"stores":["Checkers","Game","Pick n Pay","Shoprite","Woolworths"],"cheap":"Pick n Pay","dear":"Woolworths"}]},"nuts":{"names":["Walnuts or mixed nuts"],"note":"","parts":[{"label":"","unit":"per kg","amount":"1 small handful = 30 g","qty":0.03,"min":349.98,"med":449.5,"max":699.9,"n":9,"stores":["Checkers","Game","Makro","Pick n Pay","Woolworths"],"cheap":"Pick n Pay","dear":"Woolworths"}]},"fruit":{"names":["Seasonal fruit (bananas, berries)"],"note":"","parts":[{"label":"","unit":"per kg","amount":"1–2 servings ≈ 200 g bananas (priced as bananas)","qty":0.2,"min":14.99,"med":34.58,"max":47.77,"n":8,"stores":["Checkers","Pick n Pay","SPAR","Shoprite","Woolworths"],"cheap":"SPAR","dear":"Pick n Pay"}]}};
/* FOOD_PRICES:END */
/* Stand-in when the shared database has no visitors yet, so every view can still render. It is never stored. */
const NOBODY={id:'—',name:'Nobody yet',age:0,sex:'',phone:'',heightCm:165,
  s:{sys:null,dia:null,sugar:null,chol:null,weight:null,veg:null,walk:null,water:null,sleep:null},interests:{},prayer:'',done:false};
export const A=()=>attendees.find(a=>a.id===state.activeId)||attendees[0]||NOBODY;
export const initials=n=>n.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
/* first name for greetings — skips a leading title so "Dr Samuel Adeyemi" is Samuel, not Dr */
export const firstName=n=>{const w=String(n||'').trim().split(/\s+/);return (/^(dr|mr|mrs|ms|miss|prof|pastor|ps|rev|elder)\.?$/i.test(w[0])&&w[1])?w[1]:w[0];};
/* no height, no BMI: a guessed height would give a confident but wrong number */
export const bmi=a=>{const w=a.s.weight,h=a.heightCm/100;return (w&&a.heightCm)?w/(h*h):null};
export const redFlag=a=>(a.s.sys&&a.s.sys>=160)||(a.s.dia&&a.s.dia>=100)||(a.s.sugar&&(a.s.sugar>=15||a.s.sugar<3));
export const doneCount=a=>['bp','sugar','chol','weight','veg','walk','water','sleep'].filter(k=>k==='bp'?(a.s.sys&&a.s.dia):(a.s[k]!=null)).length;
export const costOf=k=>PROTOCOLS[k].items.reduce((t,i)=>t+i.daily,0);

export function cat(key,v){
 const F='flag',W='watch',OK='ok';
 switch(key){
  case 'bp': if(!v||!v.sys||!v.dia)return[null,'—']; if(v.sys>=160||v.dia>=100)return[F,'Crisis']; if(v.sys>=140||v.dia>=90)return[W,'High']; if(v.sys>=130||v.dia>=85)return[W,'Elevated']; return[OK,'Normal'];
  /* a random reading; the paper form's range is 4–8. Under 3.0 is ADA level-2 hypoglycaemia. */
  case 'sugar': if(v==null)return[null,'—']; if(v>=15)return[F,'Very high']; if(v>=11)return[F,'High']; if(v>8)return[W,'Above range'];
   if(v<3)return[F,'Very low']; if(v<4)return[W,'Low']; return[OK,'Normal'];
  /* the paper form's ranges: body fat 15–20% men, 22–28% women; body water 55–65% men, 45–60% women */
  case 'fat': case 'tbw':{ const r=SEX_RANGE[key][v&&v.sex]; if(!v||v.v==null||!r)return[null,'—'];
   if(v.v<r[0])return[W,'Below range']; if(v.v>r[1])return[W,'Above range']; return[OK,'In range'];}
  /* WHO 2008 waist report: men 94 cm increased risk, 102 substantially increased; women 80 and 88 */
  case 'waist':{ const r=SEX_RANGE.waist[v&&v.sex]; if(!v||v.v==null||!r)return[null,'—'];
   if(v.v>=r[1])return[F,'High risk']; if(v.v>=r[0])return[W,'Raised']; return[OK,'Healthy'];}
  /* peak flow as % of the recommended value: the asthma zones, green 80%+, yellow 50–79%, red under 50% (NHLBI) */
  case 'pef': if(v==null)return[null,'—']; if(v<50)return[F,'Low']; if(v<80)return[W,'Reduced']; return[OK,'Good'];
  /* resting pulse: 60–100 is normal for adults (AHA); a fit person can sit lower, so only a fast one is marked */
  case 'pulse': if(v==null)return[null,'—']; if(v>100)return[W,'Fast']; return[OK,'Normal'];
  case 'chol': if(v==null)return[null,'—']; if(v>=7.5)return[F,'High']; if(v>=5)return[W,'Above range']; return[OK,'Healthy'];
  case 'bmi': if(v==null)return[null,'—']; if(v>=35)return[F,'Obese II']; if(v>=30)return[W,'Obese']; if(v>=25)return[W,'Overweight']; if(v<18.5)return[W,'Under']; return[OK,'Healthy'];
  case 'veg': if(v==null)return[null,'—']; if(v>=5)return[OK,'On target']; if(v>=3)return[W,'Low']; return[F,'Very low'];
  case 'walk': if(v==null)return[null,'—']; if(v>=30)return[OK,'Active']; if(v>=10)return[W,'Light']; return[F,'Sedentary'];
  case 'water': if(v==null)return[null,'—']; if(v>=8)return[OK,'Good']; if(v>=5)return[W,'Low']; return[F,'Dehydrated'];
  case 'sleep': if(v==null)return[null,'—']; if(v>=7&&v<=9)return[OK,'Restful']; if(v>9)return[W,'Long']; if(v>=6)return[W,'Short']; return[F,'Deprived'];
 }}
export const SEX_RANGE={fat:{Male:[15,20],Female:[22,28]},tbw:{Male:[55,65],Female:[45,60]},waist:{Male:[94,102],Female:[80,88]}};
/* peak flow as a whole % of the recommended value from the chart */
export const pefPct=a=>a.s.pef!=null&&a.s.pefExp?Math.round(a.s.pef/a.s.pefExp*100):null;
/* the chip a station card shows */
export function chipOf(a,k){
 if(k==='weight')return cat('bmi',bmi(a));
 if(k==='fat'||k==='tbw'||k==='waist')return cat(k,{v:a.s[k],sex:a.sex});
 if(k==='pef')return cat('pef',pefPct(a));
 if(k==='pulseRest')return cat('pulse',a.s.pulseRest);
 return cat(k,a.s[k]);
}
/* the small line under a chip: BMI, % of expected peak flow, how far the pulse came down in 3 minutes */
export function chipNote(a,k){
 if(k==='weight')return bmi(a)?'BMI '+fmt1(bmi(a)):'';
 if(k==='pef')return pefPct(a)!=null?pefPct(a)+'% of recommended':'';
 if(k==='pulseRest'&&a.s.pulseEx!=null&&a.s.pulseRec!=null){const d=a.s.pulseEx-a.s.pulseRec;return d>=0?`down ${d} in 3 min`:`up ${-d} in 3 min`;}
 return '';
}
export const chipClass=c=>c==='flag'?'chip chip-flag':c==='watch'?'chip chip-watch':c==='ok'?'chip chip-ok':'chip chip-none';

/* Health-age engine.
   Method: the recognised "heart age" idea — read somebody's measurements back as the age of a person whose
   measurements sit at reference level. Every measure therefore moves the number BOTH ways: better than the
   reference takes years off, worse puts them on, so somebody fit can be younger than their years.
   Reference levels: systolic 125 mmHg and BMI 22.5 are the levels the Framingham non-laboratory heart-age
   model treats as reference (D'Agostino 2008, the basis of the NHS/JBS3 and Heart Foundation calculators).
   The rest are ordinary clinical targets: diastolic 80, glucose 5.5 mmol/L, total cholesterol 5.0, five a
   day, 30 min a day, 8 glasses, 7-9 hours asleep.
   This is a screening ESTIMATE for teaching, not a validated risk score. The published models also need
   smoking status, which this expo does not ask for, so their coefficients cannot honestly be applied here.
   Credit for beating a target is deliberately small and capped: going further below a target is not linearly
   healthier, and for glucose and BMI it is harmful. The total is capped either way so no single reading runs
   away with the answer. */
const HA_CAP=15;
const span=(v,lo,hi)=>v<lo?lo-v:v>hi?v-hi:0;
function factorsOf(m){
 const f=[],yr=(name,shown,years,lo,hi)=>f.push([name,shown,clamp(years,lo,hi)]);
 if(m.sys&&m.dia) yr('Blood pressure',`${m.sys}/${m.dia}`,(m.sys-125)*0.08+(m.dia-80)*0.10,-3,8);
 /* below about 4.5 mmol/L is a low reading, not a better one, so the credit stops there */
 if(m.sugar!=null) yr('Blood sugar',`${m.sugar} mmol/L`,(m.sugar-5.5)*0.6,-0.6,6);
 if(m.chol!=null) yr('Cholesterol',`${m.chol} mmol/L`,(m.chol-5)*0.3,-1.5,5);
 /* BMI reads both ways: too light carries its own risk, so under 18.5 is a penalty, not a credit */
 if(m.bmi!=null) yr('Body weight (BMI)',fmt1(m.bmi),
   m.bmi<18.5?(18.5-m.bmi)*0.25:m.bmi>22.5?(m.bmi-22.5)*0.15:-(22.5-m.bmi)*0.10,-0.4,6);
 if(m.veg!=null) yr('Fruit & veg',`${m.veg} servings/day`,(5-m.veg)*0.10,-0.3,1.5);
 if(m.walk!=null) yr('Exercise',`${m.walk} min/day`,(30-m.walk)*0.02,-1.2,1.5);
 if(m.water!=null) yr('Water',`${m.water} glasses/day`,(8-m.water)*0.06,-0.3,0.8);
 if(m.sleep!=null) yr('Sleep',`${m.sleep} hrs/night`,
   span(m.sleep,7,9)*(m.sleep<7?0.25:0.15)||-0.2,-0.2,3);
 return f;
}
export function healthAge(a){
 const f=factorsOf({...a.s,bmi:bmi(a)});
 const total=clamp(f.reduce((t,x)=>t+x[2],0),-HA_CAP,HA_CAP);
 const complete=doneCount(a)===8;
 /* a health age still has to be a plausible adult age, however good the readings are */
 return {f,total,complete,health:complete?Math.max(18,+(a.age+total).toFixed(1)):null};
}
export const DROPS={kSys:[0,4,8,11],kDia:[0,2,4,6],hSys:[0,3,5],hDia:[0,2,3]};
export function simBP(a){
 const {kitchen,walk,hydro}=state.sim,s=a.s;
 const baseS=s.sys??130,baseD=s.dia??85;
 const wS=Math.min(8,Math.round(walk*0.2)),wD=Math.min(5,Math.round(walk*0.1333));
 const sys=clamp(baseS-DROPS.kSys[kitchen]-wS-DROPS.hSys[hydro],90,220);
 const dia=clamp(baseD-DROPS.kDia[kitchen]-wD-DROPS.hDia[hydro],55,140);
 return {sys,dia,dS:baseS-sys,dD:baseD-dia};
}
export function projection(a){
 const s=a.s,{sys,dia}=simBP(a),{kitchen,walk,hydro}=state.sim;
 const m={sys,dia,sugar:s.sugar,chol:s.chol,
  bmi:Math.max(18,(bmi(a)??25)-(kitchen>=2?2:0)-(walk>=30?1:0)),
  veg:Math.min(5,(s.veg??2)+kitchen*1.5),
  walk:Math.max(s.walk??0,walk),
  water:Math.min(8,(s.water??4)+kitchen*1.5+(walk>=30?1:0)),
  sleep:Math.min(9,(s.sleep??7)+hydro*0.6)};
 const t=factorsOf(m).reduce((x,y)=>x+y[2],0);
 return {age:+(a.age+t).toFixed(1),yearsWon:healthAge(a).total-t};
}
/* The plan opened first is the top of the "what this person needs" list (planNeeds, further down), so the two cannot disagree.
   Nothing flagged → the sleep plan, the gentlest general one. */
export function autoProtocol(a){const n=planNeeds(a);return n.length?n[0].k:'sleep';}
function reasonText(k,a){switch(k){
 case 'bp':return`Blood pressure ${a.s.sys??'—'}/${a.s.dia??'—'}`;
 case 'sugar':return`Blood sugar ${a.s.sugar??'—'} mmol/L`;
 case 'bmi':return`BMI ${bmi(a)?fmt1(bmi(a)):'—'}`;
 default:return`Sleep ${a.s.sleep??'—'} hrs/night`}}

/* ================= NUMBER TWEEN ================= */
function tween(el,from,to,dec,suffix){
 if(!el)return;
 if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   el.textContent=to.toFixed(dec)+suffix;return;}
 cancelAnimationFrame(el._raf);
 const t0=performance.now(),dur=460;
 const step=t=>{
  const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3),v=from+(to-from)*e;
  el.textContent=v.toFixed(dec)+suffix;
  if(p<1)el._raf=requestAnimationFrame(step);
 };
 el._raf=requestAnimationFrame(step);
}
export function tweenGoal(to){
 const from=(state._goal==null?to:state._goal);
 state._goal=to;
 tween(document.getElementById('scoreGoal'),from,to,1,' yrs');
 tween(document.getElementById('simAge'),from,to,1,' yrs');
}
