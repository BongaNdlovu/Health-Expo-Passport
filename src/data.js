// @ts-check
import { bmi, esc } from './helpers.js';
/* Seed and season data: volunteers roster, booths, badge tiers, the expo, the home plans and their actions. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= SEED DATA ================= */
export const SEED=[
 {id:'EXPO-042',name:'David Mokoena',age:50,sex:'Male',phone:'+27 82 555 0142',heightCm:174,
  s:{sys:142,dia:90,sugar:6.4,chol:6.2,weight:94,veg:1,walk:10,water:3,sleep:5.5},
  interests:{nurse:true,cook:true,stress:false,pouch:true,consent:true,optin:true,consentOn:'2026-03-13'},prayer:'Prayed for work stress, better sleep and lower blood pressure.',done:false},
 {id:'EXPO-088',name:'Sipho Ndlovu',age:46,sex:'Male',phone:'+27 71 220 4477',heightCm:170,
  s:{sys:128,dia:84,sugar:5.2,chol:4.8,weight:78,veg:3,walk:25,water:6,sleep:7},
  interests:{nurse:false,cook:true,stress:false,pouch:false,consent:true,optin:false,consentOn:'2026-03-13'},prayer:'',done:false},
 {id:'EXPO-117',name:'Maria van Wyk',age:58,sex:'Female',phone:'+27 83 900 1122',heightCm:160,
  s:{sys:162,dia:98,sugar:9.8,chol:5.6,weight:86,veg:2,walk:0,water:2,sleep:6},
  interests:{nurse:true,cook:false,stress:true,pouch:true,consent:true,optin:true,consentOn:'2026-03-13'},prayer:'Asked for prayer about family worries and her health.',done:false},
];
export const attendees=JSON.parse(JSON.stringify(SEED));
/* filled from SEED_VOL below — the volunteer tables are declared further down */
export const volunteers=[];
export const state={activeId:'EXPO-042',tab:'home',protocol:'bp',sim:{kitchen:3,walk:30,hydro:2},regOpen:false,
  sugFor:null,sugVal:null,pendingBadge:null,scanLock:false,_goal:null,
  /* --- volunteer / serve section --- */
  volTab:'pledge',volId:'VOL-1001',volOpen:false,volRegOpen:false,pledgeDone:false,logOpen:false,switchMode:'visitor',
  vf:{name:'',phone:'',email:'',pledgeExpos:1,skills:[],pref:[],avail:[]},
  _volSeq:1008};

export const STATION_DEFS=[
 {k:'sugar', label:'Blood Sugar', hint:'mmol/L · random', letter:'SU',hue:'sand', step:0.1, def:5.5, min:1,  max:30},
 {k:'chol',  label:'Cholesterol', hint:'mmol/L',            letter:'CH',hue:'peach', step:0.1, def:5.0, min:1,  max:15},
 {k:'weight',label:'Weight',      hint:'kg → BMI auto',     letter:'WT',hue:'sky', step:0.5, def:70,  min:30, max:250},
 {k:'veg',   label:'Fruit & Veg', hint:'servings / day',    letter:'NU',hue:'sage', step:1,   def:3,   min:0,  max:12},
 {k:'walk',  label:'Exercise',    hint:'min brisk / day',   letter:'EX',hue:'mint', step:5,   def:20,  min:0,  max:120},
 {k:'water', label:'Water',       hint:'glasses / day',     letter:'WA',hue:'aqua', step:1,   def:5,   min:0,  max:15},
 {k:'sleep', label:'Sleep',       hint:'hours / night',     letter:'SL',hue:'lilac', step:0.5, def:7,   min:0,  max:14},
];
/* The rest of the paper Personal Health Record. These do not count toward the 8 checks or the health age.
   more: extra fields on the same card, as [key, label, min, max, step, start]. */
export const EXTRA_DEFS=[
 {k:'waist',    label:'Waist',              hint:'cm · at the navel',   letter:'WC',hue:'sky',  step:1,   def:90,  min:40, max:200},
 {k:'fat',      label:'Body fat (BIA)',     hint:'% · from the scale',  letter:'BF',hue:'peach',step:0.1, def:25,  min:3,  max:70},
 {k:'tbw',      label:'Body water (TBW)',   hint:'% · from the scale',  letter:'TW',hue:'aqua', step:0.1, def:55,  min:20, max:80},
 {k:'pef',      label:'Lung function (PEF)',hint:'L/min · best of 3',   letter:'LF',hue:'mint', step:10,  def:400, min:50, max:900,
  more:[['pefExp','Recommended (from the chart)',50,900,10,450]]},
 {k:'pulseRest',label:'Fitness',            hint:'pulse · beats/min',   letter:'FT',hue:'blush',step:1,   def:72,  min:30, max:200,
  more:[['pulseEx','After exercise',40,220,1,110],['pulseRec','After 3 min recovery',30,220,1,90]]},
];
/* The Health Age Survey on the paper form: the answer number is the box ticked (1 is the first box). */
export const SURVEY=[
 {k:'exFreq',   q:'Aerobic exercise (20–30 min)', a:['5 or more times a week','Less than 3 times a week','Rarely']},
 {k:'breakfast',q:'A good breakfast (fruit or veg with a whole grain)',a:['Almost every day','Sometimes','Rarely']},
 {k:'snack',    q:'Snacking on junk food between meals',a:['Several times each day','Sometimes','Rarely']},
 {k:'smoke',    q:'Smoking',                      a:['Never smoked','Have quit smoking','Less than 1 pack a day','More than 1 pack a day']},
 {k:'alcohol',  q:'Alcohol drinks a week',        a:['None','1–2 a week','3–10 a week','More than 10 a week']},
];
/* yes/no on the paper form, kept as 1 or 0 */
export const MED_YN=[['preg','Pregnant'],['ops','Major operations'],['chronic','Chronic illnesses'],['bpMed','On BP medication']];
export const INT={nurse:'Nurse call',cook:'Cooking school',stress:'Stress & peace',pouch:'R25 pouch'};
/* the free seminars and "how did you hear" on the paper survey; Healthy Cooking Classes is the existing Cooking school */
export const SEMINARS={coaching:'Wellness & weight-loss coaching (6 weeks)',habits:'21 Days of Healthy Habits (WhatsApp)',lifestyle:'Lifestyle diseases seminar',
 marriage:'Marriage seminar',parenting:'Parenting seminar',financial:'Financial health seminar',spiritual:'Spiritual health (Bible study)'};
export const HEARD={heardsocial:'Social media',heardpaper:'Newspaper',heardflyer:'Flyer',heardword:'Word of mouth',heardother:'Other'};

/* ================= VOLUNTEER DATA ================= */
/* The incoming expo every volunteer is pledging toward. Swap this each season. */
export const EXPO_UPCOMING={
  id:'EXPO-2027-03', name:'SDA Community Health Expo — March',
  venue:'Church hall & parking lot', date:'2027-03-13',
  need:22, /* total helpers the expo needs */
  shifts:['07:00 setup','08:30–11:00','11:00–13:30','13:30–16:00','16:00 pack-up'],
};

/* Booth / station roster a volunteer can pledge toward. cap = helpers needed. */
export const BOOTHS=[
 {k:'welcome', label:'Welcome & Registration', letter:'WE',hue:'mint', cap:3, blurb:'Greet visitors, write badges, start the passport.'},
 {k:'vitals',  label:'Vitals & BMI',           letter:'VI',hue:'sky',  cap:3, blurb:'Height, weight, BMI and waist — the first numbers.'},
 {k:'bp',      label:'Blood Pressure',         letter:'BP',hue:'blush',cap:4, blurb:'Cuff readings, red-flag triage and calm reassurance.'},
 {k:'sugar',   label:'Blood Sugar & Chol.',    letter:'SU',hue:'sand', cap:3, blurb:'Glucose and cholesterol finger-prick testing.'},
 {k:'kitchen', label:'Kitchen Pharmacy',       letter:'KP',hue:'sage', cap:3, blurb:'Cooking school, tastings and the R25 pouch.'},
 {k:'plan',    label:'Health Counselling',   letter:'NS',hue:'lilac',cap:4, blurb:'Walk visitors through their 21-day plan.'},
 {k:'prayer',  label:'Prayer & Chaplaincy',    letter:'PR',hue:'aqua', cap:2, blurb:'Quiet corner, prayer requests, spiritual care.'},
 {k:'kids',    label:'Kids Corner',            letter:'KC',hue:'peach',cap:2, blurb:'Keep the children safe and busy while parents queue.'},
 {k:'logistics',label:'Logistics & Setup',     letter:'LG',hue:'sage', cap:3, blurb:'Tables, gazebos, water, pack-up and transport.'},
 {k:'media',   label:'Media & Photography',    letter:'MD',hue:'sky',  cap:1, blurb:'Photos, social posts and the follow-up story.'},
 {k:'followup',label:'Follow-up & Data',       letter:'FU',hue:'mint', cap:2, blurb:'Capture cards, call-backs and the CSV after the day.'},
 {k:'refresh', label:'Refreshments',           letter:'RF',hue:'peach',cap:2, blurb:'Healthy tea, water and snacks for team and visitors.'},
];
export const BOOTH=k=>BOOTHS.find(b=>b.k===k);
export const boothLabel=k=>{const b=BOOTH(k);return b?b.label:'Unassigned';};
export const boothHue=k=>{const b=BOOTH(k);return b?b.hue:'mint';};

export const AVAIL=[['weekday-am','Weekday AM'],['weekday-pm','Weekday PM'],['saturday','Saturday'],['sunday','Sunday'],['setup','Setup / pack-up']];

export const SKILLS=[['clinic','Clinical / nursing'],['counselling','Counselling'],['cooking','Cooking & food'],['prayer','Prayer team'],['admin','Admin & data'],['photography','Photography'],['logistics','Hands-on logistics'],['kids','Children']];

export const STATUS_UI={
 prospect:{label:'Pledged',cls:'sc-warn', hint:'Pledged — registration opens closer to the day.'},
 registered:{label:'Registered',cls:'sc-ok', hint:'Registered and booth confirmed.'},
 checkedin:{label:'Checked in ✓',cls:'sc-ok', hint:'On site and checked in today.'},
 };

/* Badge tiers. A volunteer holds the highest tier whose minimums are both met. */
export const BADGE_TIERS=[
 {n:0,name:'Friend of the Expo',  short:'Friend',  hue:'sage', minExpos:0, minHours:0,  stars:0},
 {n:1,name:'Bronze Service Badge',short:'Bronze',  hue:'peach',minExpos:1, minHours:6,  stars:1},
 {n:2,name:'Silver Service Badge',short:'Silver',  hue:'sky',  minExpos:3, minHours:18, stars:2},
 {n:3,name:'Gold Service Badge',  short:'Gold',    hue:'sand', minExpos:6, minHours:36, stars:3},
 {n:4,name:'Platinum Service Badge',short:'Platinum',hue:'aqua',minExpos:9,minHours:60, stars:4},
 {n:5,name:'Expo Legend',     short:'Legend',  hue:'lilac',minExpos:12,minHours:72,stars:5},
];

/* Seed volunteers — deliberately spread across tiers so every badge is visible in the demo. */
export const SEED_VOL=[
 {id:'VOL-1001',name:'Thandi Mabaso',phone:'+27 82 441 0091',email:'thandi@example.co.za',
  status:'registered',pledgeExpos:4,skills:['clinic','counselling'],pref:['bp','vitals'],pref2:'sugar',
  booth:'bp',availability:['saturday','weekday-pm'],shirt:'M',emergency:'Sipho 082 441 0091',
  since:'2021-09-01',notes:'',pledgedOn:'2026-01-12',registeredOn:'2026-02-20',checkedIn:false,role:'Booth lead',
  history:[{expo:'EXPO-2024-03',name:'Autumn Health Expo',date:'2024-03-09',booth:'bp',hours:7.5},
           {expo:'EXPO-2024-09',name:'Spring Health Expo',date:'2024-09-14',booth:'bp',hours:8},
           {expo:'EXPO-2025-03',name:'Autumn Health Expo',date:'2025-03-08',booth:'vitals',hours:6.5},
           {expo:'EXPO-2025-09',name:'Spring Health Expo',date:'2025-09-13',booth:'bp',hours:8}]},
 {id:'VOL-1002',name:'Pieter Botha',phone:'+27 83 220 7745',email:'',
  status:'checkedin',pledgeExpos:2,skills:['logistics'],pref:['logistics'],pref2:'refresh',
  booth:'logistics',availability:['setup','saturday'],shirt:'L',emergency:'Anna 083 220 7745',
  since:'2023-03-01',notes:'Has a bakkie — can collect the gazebos.',pledgedOn:'2026-01-15',registeredOn:'2026-02-22',checkedIn:true,role:'Logistics',
  history:[{expo:'EXPO-2023-03',name:'Autumn Health Expo',date:'2023-03-11',booth:'logistics',hours:9},
           {expo:'EXPO-2024-03',name:'Autumn Health Expo',date:'2024-03-09',booth:'logistics',hours:9}]},
 {id:'VOL-1003',name:'Grace Nkosi',phone:'+27 71 909 3312',email:'grace@example.co.za',
  status:'registered',pledgeExpos:6,skills:['cooking','admin'],pref:['kitchen','refresh'],pref2:'welcome',
  booth:'kitchen',availability:['weekday-am','saturday','sunday'],shirt:'S',emergency:'Ruth 071 909 3312',
  since:'2019-09-01',notes:'Runs the cooking school demo.',pledgedOn:'2025-12-02',registeredOn:'2026-02-10',checkedIn:false,role:'Cooking school',
  history:[{expo:'EXPO-2022-03',name:'Autumn Health Expo',date:'2022-03-12',booth:'kitchen',hours:8},
           {expo:'EXPO-2022-09',name:'Spring Health Expo',date:'2022-09-10',booth:'kitchen',hours:7},
           {expo:'EXPO-2023-09',name:'Spring Health Expo',date:'2023-09-09',booth:'kitchen',hours:8},
           {expo:'EXPO-2024-03',name:'Autumn Health Expo',date:'2024-03-09',booth:'refresh',hours:6},
           {expo:'EXPO-2025-03',name:'Autumn Health Expo',date:'2025-03-08',booth:'kitchen',hours:8},
           {expo:'EXPO-2025-09',name:'Spring Health Expo',date:'2025-09-13',booth:'kitchen',hours:8.5}]},
 {id:'VOL-1004',name:'Nomvula Dlamini',phone:'+27 84 117 6650',email:'',
  status:'prospect',pledgeExpos:1,skills:['kids'],pref:['kids'],pref2:'welcome',
  booth:null,availability:['sunday'],shirt:'M',emergency:'',
  since:'2026-02-01',notes:'First time — friend of Grace.',pledgedOn:'2026-02-25',registeredOn:null,checkedIn:false,role:'',
  history:[]},
 {id:'VOL-1005',name:'Dr Samuel Adeyemi',phone:'+27 82 664 2210',email:'sam@example.co.za',
  status:'registered',pledgeExpos:3,skills:['clinic','counselling','prayer'],pref:['plan','prayer'],pref2:'bp',
  booth:'plan',availability:['saturday'],shirt:'XL',emergency:'Bisi 082 664 2210',
  since:'2021-03-01',notes:'Retired GP — supervises the red-flag triage.',pledgedOn:'2026-01-08',registeredOn:'2026-02-14',checkedIn:false,role:'Clinical lead',
  history:[{expo:'EXPO-2023-03',name:'Autumn Health Expo',date:'2023-03-11',booth:'plan',hours:7},
           {expo:'EXPO-2024-09',name:'Spring Health Expo',date:'2024-09-14',booth:'plan',hours:7.5},
           {expo:'EXPO-2025-09',name:'Spring Health Expo',date:'2025-09-13',booth:'prayer',hours:6}]},
 {id:'VOL-1006',name:'Lerato Sithole',phone:'+27 76 330 8891',email:'',
  status:'prospect',pledgeExpos:2,skills:['photography','admin'],pref:['media','followup'],pref2:'welcome',
  booth:null,availability:['saturday','weekday-am'],shirt:'S',emergency:'',
  since:'2026-02-05',notes:'Brought a camera last year.',pledgedOn:'2026-02-27',registeredOn:null,checkedIn:false,role:'',
  history:[]},
 {id:'VOL-1007',name:'Johannes Pretorius',phone:'+27 82 776 1123',email:'',
  status:'registered',pledgeExpos:5,skills:['logistics','admin'],pref:['followup','welcome'],pref2:'logistics',
  booth:'followup',availability:['weekday-pm','saturday'],shirt:'L',emergency:'Maria 082 776 1123',
  since:'2020-09-01',notes:'Keeps the follow-up spreadsheet.',pledgedOn:'2026-01-20',registeredOn:'2026-02-18',checkedIn:false,role:'Data',
  history:[{expo:'EXPO-2022-03',name:'Autumn Health Expo',date:'2022-03-12',booth:'welcome',hours:6},
           {expo:'EXPO-2023-09',name:'Spring Health Expo',date:'2023-09-09',booth:'followup',hours:7},
           {expo:'EXPO-2024-09',name:'Spring Health Expo',date:'2024-09-14',booth:'followup',hours:7},
           {expo:'EXPO-2025-03',name:'Autumn Health Expo',date:'2025-03-08',booth:'followup',hours:6.5},
           {expo:'EXPO-2025-09',name:'Spring Health Expo',date:'2025-09-13',booth:'followup',hours:7.5}]},
];

/* ---------------------------------------------------------------------------------------------------------
   The plans are written in our own words. The only author cited is Ellen G. White (1827–1915):
     "MH:23"  = chapter 23 of The Ministry of Healing (1905)
     "CD:731" = numbered paragraph 731 of Counsels on Diet and Foods (compiled 1938)
     "HL:571" = numbered paragraph 571 of Healthful Living (compiled 1897)
     "PH:6"   = page 6 of The Place of Herbs in Rational Therapy (compiled 1931)
   Two tags name lines no book is cited for: "G" = general natural-health advice, "S" = the expo's own safety rule.
   Several references can be joined with " · ". See PLANS.md for what each one supports.
   "steps"  = the day, in order (each with its reference)
   "facts"  = what the plan is based on, with references
   "items"  = shopping list with APPROXIMATE South African prices (no book has prices; check locally); [] = none
   "habits" = the three-line summary used on the WhatsApp message and the take-home card
   "note"   = a plan-specific safety note;  "help" = a get-help line shown prominently (mind and sleep plans)  */
export const BOOK_REF='The Ministry of Healing (Ellen G. White, 1905)';
export const BOOK2_REF='Counsels on Diet and Foods (Ellen G. White, compiled 1938)';
export const BOOK3_REF='Healthful Living (Ellen G. White, compiled 1897)';
export const BOOK4_REF='The Place of Herbs in Rational Therapy (Ellen G. White, compiled 1931)';
export const HELP_LINE='If you feel hopeless, or have thoughts of harming yourself, tell someone you trust today and call the SADAG suicide crisis line (0800 567 567) or Lifeline (0861 322 322), or go to the nearest clinic or emergency service. Do not wait.';
/* Shown with every plan (the app's and a church's), on the Results and Food screens, in the WhatsApp message and on
   the printed card: who is giving the advice, what it is not, and the precautions that always apply. */
export const DISCLAIMER='The volunteers at this expo are not doctors, nurses or other health professionals unless they tell you so. This plan is general healthy-living information, not medical advice, a diagnosis or treatment.';
export const PRECAUTIONS=[
 'Keep taking any medicine your clinic or doctor gave you. Never stop or change it without asking them.',
 'Expo readings are a quick screening, not a diagnosis. Have any high or low reading checked at a clinic.',
 'Ask your clinic before big changes in food, exercise or herb teas if you are pregnant or breastfeeding, have diabetes or heart, kidney or liver disease, or take regular medicine.',
 'Herbs and foods can interact with medicines. Ask your clinic or pharmacist before using herb teas with medicine.',
 'Stop and get help at once if you have chest pain, faintness, severe breathlessness, confusion, or a new or worsening symptom.',
 'In an emergency, call an ambulance or go to the nearest emergency unit straight away. Do not wait to try home remedies.',
 'Children, older people and anyone who is unwell may need different advice. Ask your clinic.'];
export const precautionsHTML=()=>`<div class="glass p-4"><div class="microlabel">Warnings and precautions</div>
  <p class="mt-1.5 text-[11.5px] font-semibold leading-relaxed text-[#33504f]">${esc(DISCLAIMER)}</p>
  <ul class="mt-2 space-y-1.5">${PRECAUTIONS.map(t=>`<li class="flex items-start gap-2.5"><span class="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand-500"></span>
   <span class="min-w-0 flex-1 text-[11.5px] leading-snug text-[#3d5c5e]">${esc(t)}</span></li>`).join('')}</ul></div>`;
/* shopping-list entries shared by several plans (prices from prices/prices.csv, written by tools/update-prices.js) */
const ITEM_FLAX={name:'Ground flaxseed',dose:'1–2 tbsp',store:'R150–R160 per kg (median R150) at Checkers, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:2.25};
const ITEM_FRUIT={name:'Seasonal fruit (bananas, berries)',dose:'1–2 servings',store:'R33–R38 per kg (median R35) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:6.92};
const ITEM_DATES={name:'Figs or dates',dose:'2–3 pieces',store:'R82–R111 per kg (median R96) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths — priced as dates; no dried figs were found priced online (checked 19 Oct 2026)',daily:2.40};
const ITEM_NUTS={name:'Walnuts or mixed nuts',dose:'1 small handful (30g)',store:'R430–R520 per kg (median R450) at Checkers, Game, Makro, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:13.49};
const ITEM_LENTILS={name:'Brown lentils / beans',dose:'½ cup cooked',store:'R49–R68 per kg (median R52) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.34};
const ITEM_SLAW={name:'Cabbage & carrots (raw salad)',dose:'300g a day',store:'Carrots R15–R17 per kg (median R15), cabbage R16–R25 a head (median R17) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:3.95};
const ITEM_TOMATO={name:'Tomatoes',dose:'2 medium',store:'R24–R35 per kg (median R33) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.95};
const HOT_BATH_CARE='Never a hot bath with high blood pressure, heart trouble or diabetes, and test the water with your elbow if your feet have lost feeling.';
export const PROTOCOLS={
 bp:{tag:'Blood pressure',tagline:'21-day blood-pressure plan',title:'High Blood Pressure — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: chs. 8, 17, 20, 26 · Counsels on Diet and Foods: §§ 111, 138, 245, 267, 268, 475, 514, 518, 726, 731 · Healthful Living: §§ 570, 571, 717',
  mech:'Built on Ellen White’s counsel: plain water, little salt, simple plant foods with plenty of fruit and vegetables, daily walks in the open air, deep breathing and rest.',
  steps:[
   ['06:30','A glass of water when you get up, then a good breakfast of oats or another whole grain with fruit and a spoon of ground flaxseed. Go easy on salt.','CD:268 · CD:475 · G'],
   ['10:00','Water between meals rather than with them: about 8 glasses across the day. No tea, coffee or sweet drinks.','CD:731 · MH:26 · G'],
   ['13:00','A big lunch of vegetables: a raw salad with tomato, celery, carrot, onion and raw garlic, with beans or lentils. Unsalted potato soup with the skin on is good too.','CD:514 · CD:518 · G'],
   ['13:30','A short walk after lunch, head up and shoulders back, then 10–20 slow, deep breaths that fill the belly.','MH:17 · HL:717 · G'],
   ['16:30','A brisk walk outdoors, building up to 30 minutes. Start gently.','HL:571 · G'],
   ['18:00','A light supper, eaten early, with nothing salty or processed. Nothing more after it.','CD:245'],
   ['21:00','A warm (never hot) bath of about 33–35°C before bed, then lights out by 22:00.','MH:17 · G']],
  hydro:'<b>Warm, neutral bath before bed:</b> water at about body temperature (33–35°C) for 15–30 minutes. Ellen White wrote that warm and neutral baths soothe the nerves and even out the circulation (Ministry of Healing ch. 17). <em>'+HOT_BATH_CARE+'</em>',
  facts:[
   ['The true remedies: pure air, sunlight, moderation, rest, exercise, good food, water and trust in God.','MH:8'],
   ['Drink plain water freely, but between meals rather than with them.','CD:726 · CD:731'],
   ['Go easy on salt, pickles and spicy food, and eat plenty of fruit.','CD:475'],
   ['Grains, fruit, nuts and vegetables give the body all it needs.','CD:111 · CD:138'],
   ['Fresh fruit and vegetables bring potassium, which helps the body let go of extra salt. Aim for at least five servings a day.','G'],
   ['Raw garlic, celery, tomatoes, carrots and onions are traditional favourites for blood pressure; oats and ground flaxseed add fibre.','G'],
   ['Tea, coffee, alcohol and tobacco stimulate and then exhaust the heart and nerves; leave them out.','MH:26'],
   ['Walking is the best exercise: it improves the circulation and uses the whole body. Walk outdoors every day.','HL:570 · HL:571'],
   ['Deep, full breaths of fresh air refresh the blood and calm the nerves.','HL:717 · MH:20'],
   ['Losing extra weight slowly helps blood pressure come down.','G'],
   ['People worn out by overwork need rest and freedom from worry.','MH:17'],
   ['Have your blood pressure checked regularly. A very high reading needs the clinic, not only home care.','S']],
  note:'Potassium-rich foods such as potatoes and tomatoes can matter with some blood-pressure pills or kidney disease. Mention them to your clinic first.',
  habits:['Water, little salt, and plenty of vegetables, fruit and whole grains','A daily outdoor walk and slow deep breaths in fresh air','A warm bath and an early night'],
  items:[
   {name:'Rolled oats / oat bran',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   ITEM_FLAX,
   {name:'Raw garlic',dose:'2 cloves',store:'R200–R317 per kg (median R247) at Checkers, SPAR, Woolworths (checked 19 Oct 2026)',daily:2.47},
   {name:'Celery',dose:'2–4 stalks',store:'R26–R30 a bunch (median R29) at Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:7.25},
   ITEM_TOMATO,
   {name:'Potatoes (with skin)',dose:'250g for soup',store:'R11–R15 per kg (median R12) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:3.12}]},

 sugar:{tag:'Blood sugar',tagline:'21-day blood-sugar plan',title:'High Blood Sugar — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: chs. 17, 26 · Counsels on Diet and Foods: §§ 146, 168, 191, 245, 267, 268, 504, 518, 726, 731 · Healthful Living: § 571',
  mech:'Built on Ellen White’s counsel on eating: simple whole plant foods at set times with nothing in between, little sugar, a light early supper, and a walk every day.',
  steps:[
   ['06:30','Water, then breakfast at a set time: whole-grain porridge (brown rice, oats or whole maize meal) with beans or fruit. No added sugar.','CD:146 · CD:268'],
   ['10:00','Water between meals, and nothing to eat until lunch.','CD:267 · CD:731'],
   ['13:00','Lunch at a set time: a raw salad with onion and garlic, cooked green beans, and beans or lentils. Eat slowly and chew well.','CD:168 · CD:518 · G'],
   ['13:30','A short walk after lunch, head up and shoulders back.','MH:17'],
   ['16:30','A brisk walk outdoors. If you are unfit, walk briskly for a minute, then easily for half a minute, and repeat.','HL:571 · G'],
   ['18:00','A small, early supper of plain food, several hours before bed. Nothing more in the evening.','CD:245'],
   ['21:00','Check both feet for cuts, blisters or sores, then bed.','S']],
  hydro:'<b>Avoid both extremes: very hot and very cold baths.</b> A warm, neutral bath (33–35°C) is the gentle choice, and Ellen White wrote that such baths soothe the nerves (Ministry of Healing ch. 17). <em>If your feet have lost feeling, test the water with your elbow, never your foot.</em>',
  facts:[
   ['Eat at set times and nothing in between; leave at least five hours between meals.','CD:267'],
   ['Make breakfast a good meal: the stomach handles food best in the morning.','CD:268'],
   ['If a third meal is eaten, keep it light and several hours before bed.','CD:245'],
   ['Far too much sugar is eaten: sweets, cakes and pastries are best left out.','CD:191'],
   ['Choose whole grains over white flour: whole-wheat bread nourishes far better.','CD:504'],
   ['Rice, maize, oats, beans, peas and lentils are good everyday staples.','CD:146'],
   ['Eat slowly and chew well; if time is short, eat less rather than bolt your food.','CD:168'],
   ['Onions, garlic and cooked green beans are traditional everyday foods for steadier blood sugar.','G'],
   ['Walk outdoors every day; a short walk after meals helps digestion.','MH:17 · HL:571'],
   ['Tea, coffee and tobacco are stimulants; coffee can push blood sugar up, so leave it out.','MH:26 · G'],
   ['Drink plenty of water; good hydration helps people with high blood sugar.','CD:726 · G'],
   ['Check your feet every day: with high blood sugar, small sores can become infected.','S'],
   ['Very high or very low sugar is an emergency: go to the clinic or emergency room. If you take insulin, follow your clinic’s plan for low sugar.','S']],
  note:'If you take diabetes pills or insulin, never change the dose yourself. Talk to your clinic first.',
  habits:['Meals of whole foods at set times, nothing in between, and little sugar','A brisk outdoor walk every day and plenty of water','Check your feet every evening'],
  items:[
   {name:'Brown rice / whole maize meal',dose:'60g dry',store:'R21–R38 per kg (median R23) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths; unsifted maize meal was not found online, STAND-IN super (sifted) maize meal R11–R13 per kg at Game, Makro, SPAR (checked 19 Oct 2026)',daily:1.35},
   {name:'Onions',dose:'1 medium',store:'R28–R39 per kg (median R30) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.50},
   {name:'Raw garlic',dose:'2 cloves',store:'R200–R317 per kg (median R247) at Checkers, SPAR, Woolworths (checked 19 Oct 2026)',daily:2.47},
   {name:'Green beans',dose:'100g',store:'R68–R86 per kg (median R83) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:8.33},
   ITEM_LENTILS]},

 bmi:{tag:'Weight & cholesterol',tagline:'Steady weight & cholesterol plan',title:'Weight & Cholesterol — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: chs. 17, 23, 25 · Counsels on Diet and Foods: §§ 137, 168, 191, 245, 267, 268, 269, 326, 504, 514, 731 · Healthful Living: §§ 571, 578',
  mech:'Built on Ellen White’s counsel: a hearty breakfast, a light early supper or none, nothing between meals, simple plant food free of grease, and daily exercise in the open air.',
  steps:[
   ['06:30','Make breakfast the biggest meal: oats or another whole grain, with fruit, a few nuts and a spoon of ground flaxseed.','CD:268 · G'],
   ['10:00','Water only between meals: no snacks, juice, cold drinks or coffee.','CD:267 · CD:731'],
   ['13:00','Lunch at a set time: plenty of vegetables, with beans or lentils and a whole grain. Nothing fried.','CD:514 · CD:137'],
   ['13:30','A short walk after lunch, head up and shoulders back.','MH:17'],
   ['16:30','A brisk outdoor walk; build up slowly to 30 minutes or more, or about 10,000 steps a day.','HL:571 · G'],
   ['17:30','A light, early supper, or just fruit and a cracker. Then nothing more before bed.','CD:245 · MH:25']],
  hydro:null,
  facts:[
   ['Eat at set times and nothing in between; many find two good meals a day better than three.','CD:267'],
   ['Make breakfast the heartiest meal of the day, not supper.','CD:268'],
   ['A third meal, if eaten, should be light and several hours before bed.','CD:245'],
   ['Late suppers are especially harmful for people who sit most of the day.','CD:269'],
   ['Prepare food simply and free of grease. Plant foods carry no cholesterol.','CD:137 · G'],
   ['Oats, beans, lentils and ground flaxseed bring the kind of fibre that helps lower cholesterol.','G'],
   ['Far too much sugar is eaten: leave out cakes, sweet puddings and pastries.','CD:191'],
   ['Choose whole-grain bread over white.','CD:504'],
   ['Eat slowly; even plain, healthy food can be overeaten.','CD:168 · MH:23'],
   ['Active exercise in the open air every day strengthens the liver, kidneys and lungs.','HL:578'],
   ['Losing even a few kilograms can lift energy and mood.','G'],
   ['The body still needs enough nourishing food: no crash diets or starving.','CD:326 · S'],
   ['Heart disease or several heart risks? See a doctor before hard exercise.','S']],
  note:'Avoid starving or very fast weight loss. If you have diabetes or take medicine, ask your clinic before changing your eating.',
  habits:['Whole-food meals at set times, with nothing in between','A brisk outdoor walk every day','A light early supper and nothing before bed'],
  items:[
   {name:'Rolled oats / whole grains',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   ITEM_LENTILS,ITEM_FLAX,ITEM_SLAW]},

 thin:{tag:'Underweight',tagline:'Healthy weight-gain plan',title:'Underweight — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: ch. 23 · Counsels on Diet and Foods: §§ 138, 146, 168, 245, 267, 268, 320, 326, 518, 731 · Healthful Living: §§ 185, 578',
  mech:'Built on Ellen White’s counsel that the body must have enough nourishing food: good meals of whole grains, beans, nuts, fruit and vegetables at set times, a hearty breakfast, and daily exercise outdoors.',
  steps:[
   ['07:00','A hearty breakfast: oats or whole-grain porridge with milk or soy milk, fruit, a handful of nuts and a few dates.','CD:268 · CD:146'],
   ['10:00','Water between meals. If the meals leave you hungry, make them bigger rather than snacking.','CD:731 · CD:267'],
   ['13:00','A full lunch: beans or lentils with brown rice or maize meal, cooked vegetables and a salad. Eat slowly and enjoy it.','CD:146 · CD:518 · CD:168'],
   ['16:30','A walk outdoors or light work in the garden, to build appetite and muscle.','HL:578 · G'],
   ['18:00','A good third meal, early: whole-grain bread with peanut butter or beans, and fruit.','CD:245 · G'],
   ['21:30','Lights out in good time: the body restores its strength in sleep.','HL:185']],
  hydro:null,
  facts:[
   ['The body must have enough nourishing food; health cannot be kept on a meagre diet.','CD:326'],
   ['A diet made too plain or poorly prepared can leave people weaker. Food should be nourishing and tasty.','CD:320 · CD:326'],
   ['Grains, fruit, nuts and vegetables give the body all it needs.','CD:138'],
   ['Rice, maize, oats, beans, peas and lentils, with dried fruit, are good, filling staples.','CD:146'],
   ['Nuts can take the place of meat, and a handful a day adds energy.','MH:23 · G'],
   ['Eat at set times, and make breakfast a hearty meal.','CD:267 · CD:268'],
   ['Eat slowly and calmly: food eaten in a hurry or while anxious does less good.','CD:168'],
   ['Active exercise in the open air strengthens the body, and builds muscle when the meals are good.','HL:578 · G'],
   ['The body restores its strength during sleep.','HL:185'],
   ['Weight loss you cannot explain, or a poor appetite that lasts, is a reason to see your clinic.','S']],
  note:'Being underweight can come from illness, worry or not having enough food. If you have lost weight without trying, see your clinic. If food money is short, ask the Health Ministries team about the co-op starter pouch.',
  habits:['Three good meals at set times, with a hearty breakfast','Beans, nuts, whole grains and dried fruit every day','A walk outdoors and a good night’s sleep'],
  items:[
   {name:'Rolled oats',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   ITEM_NUTS,ITEM_LENTILS,ITEM_DATES]},

 veg:{tag:'Fruit & veg',tagline:'More fruit & vegetables plan',title:'Too Little Fruit & Veg — Home Plan',
  src:'Ellen G. White — Counsels on Diet and Foods: §§ 111, 137, 146, 245, 267, 464, 475, 509, 514, 518',
  mech:'Built on Ellen White’s counsel that grains, fruit, nuts and vegetables are the diet God chose: fruit at every meal and plenty of vegetables, simply prepared.',
  steps:[
   ['07:00','Fruit with breakfast: a banana or seasonal fruit on your porridge.','CD:475 · CD:464'],
   ['10:00','Water between meals; fresh or dried fruit belongs with the meals.','CD:267 · CD:146'],
   ['13:00','Half the plate vegetables: a raw salad of cabbage, carrot and tomato, plus a cooked vegetable.','CD:514 · CD:509'],
   ['13:30','Beans or lentils with lunch a few times a week.','CD:518'],
   ['17:00','Plan tomorrow’s fruit and vegetables: buy what is in season, or plant a few in a pot or garden.','CD:509 · G'],
   ['18:00','A light supper of fruit, or a vegetable soup.','CD:245 · G']],
  hydro:null,
  facts:[
   ['Grains, fruit, nuts and vegetables are the diet the Creator chose.','CD:111'],
   ['Everyone should know the special value of fruit and vegetables fresh from the orchard and garden.','CD:509'],
   ['Eat plenty of fruit; it eases the craving for salty, spicy food.','CD:475'],
   ['Fruit is a gift to be thankful for.','CD:464'],
   ['Hearty workers need plenty of vegetables, fruit and grains.','CD:514'],
   ['Dried fruit such as raisins and dates can be used freely as everyday food.','CD:146'],
   ['Beans, boiled or baked, are a simple, wholesome dish.','CD:518'],
   ['Prepare vegetables simply, without much grease or spice.','CD:137'],
   ['Aim for at least five servings of fruit and vegetables a day: a serving is a fist-sized fruit or half a cup of vegetables.','G'],
   ['Brightly coloured fruit and vegetables, and dark leafy greens, bring the widest range of goodness.','G']],
  note:'Wash fruit and vegetables well, and always cook green beans. If you take a blood-thinning pill such as warfarin, keep the amount of leafy greens steady from day to day and tell your clinic.',
  habits:['Fruit with every breakfast','Half the plate vegetables at lunch','At least five servings of fruit and vegetables a day'],
  items:[ITEM_FRUIT,ITEM_SLAW,ITEM_TOMATO,ITEM_DATES]},

 move:{tag:'Exercise',tagline:'Daily walking plan',title:'Too Little Exercise — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: chs. 17, 20 · Healthful Living: §§ 570, 571, 578, 717, 780',
  mech:'Built on Ellen White’s counsel that walking in the open air is the best exercise: some every day, summer and winter, brisk but not violent, and a short walk after meals.',
  steps:[
   ['06:30','Open the windows and take 10 slow, deep breaths.','HL:717 · MH:20'],
   ['07:30','A 10-minute walk outdoors before or after breakfast.','HL:571 · G'],
   ['13:30','A short walk after lunch, head up and shoulders back.','MH:17'],
   ['16:30','Your main walk, brisk but not violent. Week 1: 10 minutes; add 5 minutes each week until you reach 30.','HL:780 · G'],
   ['18:30','Useful work with your hands: garden, sweep, carry, or help a neighbour.','MH:17'],
   ['21:00','Write down your minutes for the day.','G']],
  hydro:null,
  facts:[
   ['No exercise can take the place of walking: it improves the circulation and uses the whole body.','HL:570'],
   ['Walk in the open air every day the weather allows, summer and winter.','HL:571'],
   ['Brisk but not violent exercise in the open air, with a cheerful spirit, sends fresh blood to the whole body.','HL:780'],
   ['Active exercise outdoors every day strengthens the liver, kidneys and lungs.','HL:578'],
   ['Lack of exercise is a common cause of disease.','MH:17'],
   ['A short walk after meals helps digestion; hard work straight after eating hinders it.','MH:17'],
   ['Useful work with the hands lifts the mind as well as the body.','MH:17'],
   ['Deep, full breaths of fresh air refresh the blood.','HL:717'],
   ['Aim for at least 30 minutes of brisk walking a day, built up slowly.','G'],
   ['Heart disease, chest pain or several heart risks? See a doctor before hard exercise.','S']],
  note:'Stop and rest if you feel chest pain, faintness or severe breathlessness, and see your clinic. Start slowly if you have not exercised for a long time.',
  habits:['A walk outdoors every day, summer and winter','A short walk after every meal','Add 5 minutes a week until you reach 30 minutes a day'],
  items:[]},

 water:{tag:'Water',tagline:'Daily water plan',title:'Too Little Water — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: ch. 26 · Counsels on Diet and Foods: §§ 475, 726, 727, 728, 731 · Healthful Living: § 786',
  mech:'Built on Ellen White’s counsel that pure water, drunk freely, is one of Heaven’s best gifts: a hot drink of water before breakfast, water between meals, and water in place of tea, coffee and sweet drinks.',
  steps:[
   ['06:30','A glass or two of hot (never scalding) water as soon as you get up, before breakfast.','CD:728'],
   ['10:00','Two glasses of water mid-morning.','CD:727 · G'],
   ['12:00','A glass of water about half an hour before lunch; little or no drink with the meal itself.','CD:731'],
   ['15:00','Two glasses of water mid-afternoon. Keep a bottle with you.','G'],
   ['17:00','A glass of water before supper.','CD:731'],
   ['20:00','A last glass in the early evening, not right at bedtime.','G']],
  hydro:null,
  facts:[
   ['Pure water, drunk freely, helps the body do its work and resist disease.','CD:726'],
   ['Drink freely of pure water every day.','CD:727'],
   ['A drink of clear, hot water before eating does no harm and may do good.','CD:728'],
   ['Little or no drink with meals: drink water a while before or after eating instead.','CD:731'],
   ['Salty and spicy food makes people thirsty at meals; fruit eases that thirst.','CD:731 · CD:475'],
   ['Pure water to drink and fresh air to breathe refresh the whole body.','HL:786'],
   ['Tea, coffee and sweet drinks do not take the place of water.','MH:26 · G'],
   ['Aim for about 8 glasses of water a day; pale yellow urine is a good sign you are drinking enough.','G'],
   ['If your clinic has told you to limit fluids, for example with heart or kidney failure, keep to their limit.','S']],
  note:'People with heart or kidney failure may need to limit fluids. Ask your clinic how much is right for you.',
  habits:['A glass of hot water as soon as you get up','Water between meals, about 8 glasses a day','Water instead of tea, coffee and sweet drinks'],
  items:[]},

 sleep:{tag:'Sleep',tagline:'Better-sleep plan',title:'Restless Nights — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: chs. 17, 18, 20, 26 · Counsels on Diet and Foods: §§ 201, 245, 268, 270 · Healthful Living: §§ 185, 189, 313, 571, 618, 717 · The Place of Herbs in Rational Therapy: p. 6',
  mech:'Built on Ellen White’s counsel: regular hours, no late suppers, no stimulants, daily outdoor exercise, fresh air and sunshine in the bedroom, a thankful mind, and a cup of hop or catnip tea.',
  steps:[
   ['07:00','Get up at the same time every day; you should wake without an alarm. Open the curtains and windows, and spend the first half hour in daylight if you can.','CD:201 · HL:618 · G'],
   ['07:30','Start the day thankful: a short prayer of thanks, and breakfast near a sunny window.','MH:18 · G'],
   ['12:30','Make breakfast and lunch the main meals. No tea, coffee, cola, alcohol or tobacco.','CD:268 · MH:26'],
   ['16:30','A walk or outdoor work in the late afternoon, not right before bed.','HL:571 · G'],
   ['18:00','A light supper at least 3 hours before bed: fruit, or a few dates and whole-grain crackers.','CD:245 · CD:270'],
   ['20:00','Dim the lights and switch off the TV and phone. Set the day’s worries aside, and read or sing something calming.','G · MH:18'],
   ['20:15','A cup of warm hop or catnip tea, or chamomile or linden flower tea, unsweetened.','PH:6 · G'],
   ['20:30','A warm (never hot) bath of about 33–35°C, or 10–20 slow, deep breaths by an open window.','MH:17 · HL:717'],
   ['21:00','Lights out by 21:00–22:00, in a cool, dark, quiet room with a window open a little.','HL:313 · G']],
  hydro:'<b>Warm, neutral bath just before bed:</b> water at about body temperature (33–35°C) for 15–30 minutes. Ellen White wrote that warm and neutral baths soothe the nerves (Ministry of Healing ch. 17). <em>'+HOT_BATH_CARE+'</em>',
  facts:[
   ['Irregular hours for eating and sleeping wear down the mind. Keep the same bed and wake times every day, weekends too.','CD:201 · G'],
   ['Keeping late hours lays the foundation for weakness.','HL:189'],
   ['The body restores its strength during sleep. Most adults need 7–8 hours; needing an alarm to wake is a sign of too little.','HL:185 · G'],
   ['Eating just before bed keeps the stomach working, so sleep is restless and you wake unrefreshed.','CD:270'],
   ['A third meal, if eaten, should be light and several hours before bed.','CD:245'],
   ['Tea and coffee give short-lived energy and then sleeplessness. Caffeine late in the day is a common thief of sleep, and alcohol spoils deep sleep.','MH:26 · G'],
   ['Bedrooms need fresh air day and night, and daily sunshine and airing.','HL:313 · HL:618'],
   ['Morning daylight sets the body clock; bright lights and screens late at night upset it. A cool room, about 15–18°C, helps.','G'],
   ['Walk outdoors every day; exercise helps sleep, but not right before bed.','HL:571 · G'],
   ['Hop tea helps bring on sleep, and catnip tea quiets the nerves.','PH:6'],
   ['Chamomile and linden flower teas are traditional calming teas for the evening.','G'],
   ['Deep breathing of fresh air calms the nerves and helps sound sleep.','HL:717 · MH:20'],
   ['A cheerful, thankful mind is good for the body; worry and guilt keep people awake.','MH:18'],
   ['If you cannot sleep, lie still and rest, or get up quietly for a short while and go back to bed.','G'],
   ['Sleeping pills do not cure poor sleep and stop working after a few weeks. Never stop them suddenly; ask your clinic.','S'],
   ['Poor sleep for weeks, or feeling low or anxious, is a reason to see your clinic.','S']],
  note:'Some medicines (including some for blood pressure, anxiety and depression) can disturb sleep. Ask your clinic, and never stop them yourself. Do not stop sleeping tablets suddenly. If sleep has been poor for weeks, or you feel low or anxious, see your clinic. Herb teas: hops adds to the effect of sleeping or anxiety pills and alcohol, so ask your clinic first if you take them, or if you are pregnant or breastfeeding. No catnip tea in pregnancy. Chamomile can affect people allergic to ragweed. Use fresh linden flowers, not old stock.',
  help:HELP_LINE,
  habits:['The same bed and wake time every day, with morning light and fresh air','A light early supper, and no tea, coffee or tobacco','A cup of hop or catnip tea, and lights out by 22:00'],
  items:[ITEM_DATES,
   {name:'Whole-grain crackers',dose:'2–3',store:'R180–R188 per kg (median R184) at Checkers, Game, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.60},
   ITEM_FRUIT]},

 mind:{tag:'Stress & mood',tagline:'Calm-mind plan',title:'Stress, Worry & Low Mood — Home Plan',
  src:'Ellen G. White — The Ministry of Healing: chs. 8, 17, 18, 19, 20, 26 · Counsels on Diet and Foods: §§ 111, 201, 268, 727 · Healthful Living: §§ 313, 717, 780',
  mech:'Built on Ellen White’s counsel on the mind: mind and body affect each other, so time outdoors, walking, deep breathing, simple food, gratitude, song, helping others, sound thinking and trust in God all lift the spirits.',
  steps:[
   ['06:30','Get up and thank God for the night and the new day. Drink a glass of water.','MH:18 · CD:727'],
   ['07:00','Half an hour outdoors in the morning light: walk, garden, or sit among trees and flowers.','MH:19 · G'],
   ['07:30','A simple plant breakfast: oats with fruit, a few walnuts and a spoon of ground flaxseed.','CD:268 · G'],
   ['12:30','Midday: a brisk walk or useful work outdoors. Work with the hands lifts a heavy mind.','HL:780 · MH:17'],
   ['13:30','After lunch: 10–20 slow, deep breaths in fresh air, sitting up straight.','HL:717 · MH:20'],
   ['16:00','Do one kind thing for someone else: a visit, a call or a helping hand.','MH:18'],
   ['16:30','A cup of chamomile or linden flower tea in a quiet moment.','G'],
   ['19:30','Check one worrying thought: write it down, ask whether it is all-or-nothing, a jump to the worst, or a feeling taken as fact, then write a fairer version and three good things from today.','G · MH:18'],
   ['20:30','A calm evening: sing or listen to hymns, set worries aside, and pray. A warm, neutral bath eases tension.','MH:18 · MH:17'],
   ['21:30','Lights out in a room with fresh air.','HL:313']],
  hydro:'<b>Warm, neutral bath (33–35°C), just before bed:</b> Ellen White wrote that warm and neutral baths soothe the nerves (Ministry of Healing ch. 17). <em>'+HOT_BATH_CARE+'</em>',
  facts:[
   ['Mind and body are closely linked: worry, grief and discontent wear down health, while courage, hope and a cheerful spirit build it up.','MH:18'],
   ['Nothing does more for health of body and soul than a thankful spirit.','MH:18'],
   ['Thoughts follow words: speaking of the good things you have makes faith and joy grow.','MH:18'],
   ['Worries often grow from thinking traps: seeing things as all good or all bad, expecting the worst, or treating a feeling as a fact. Writing a fairer version of the thought takes away much of its sting.','G'],
   ['Singing is a help that is always at hand against discouragement.','MH:18'],
   ['Helping others brings healing to the helper too; close friends and church family protect the mind.','MH:18 · G'],
   ['Time outdoors among trees and flowers is one of nature’s best remedies.','MH:19'],
   ['Brisk walking in the open air with a cheerful spirit refreshes the whole body; regular exercise eases anxiety and low mood.','HL:780 · G'],
   ['Deep breathing of fresh air calms the nerves.','HL:717 · MH:20'],
   ['Irregular hours for eating and sleeping wear down the mind.','CD:201'],
   ['Simple plant meals at set times feed the brain well: fruit, vegetables, whole grains, walnuts and flaxseed.','CD:111 · G'],
   ['Tea, coffee and tobacco only stimulate, and leave people more tired and on edge afterwards.','MH:26'],
   ['Chamomile and linden flower teas are traditional calming teas.','G'],
   ['Trust in God is one of the true remedies.','MH:8']],
  note:'This plan supports good care; it does not replace a clinic. Low mood or worry that lasts more than a couple of weeks, or that stops you working or sleeping, is a reason to see your clinic. Herb teas: chamomile can affect people allergic to ragweed. Use fresh linden flowers, not old stock.',
  help:HELP_LINE,
  habits:['Morning light, an outdoor walk and plenty of water','Slow deep breaths, and one kind act for someone every day','Check one worrying thought and count three good things each evening'],
  items:[ITEM_NUTS,
   {name:'Rolled oats',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   ITEM_FRUIT,ITEM_FLAX]},
};

/* Why each shopping-list food is there, for the Food screen. Every line restates something the plans above already
   say, with the same reference: to add one, put it in the plan's steps or facts first. `care` = a caution to show. */
export const FOOD_WHY={
 oats:[{plan:'bp',txt:'A good breakfast of oats or another whole grain, with fruit.',ref:'CD:268'},
  {plan:'bmi',txt:'Breakfast is the biggest meal: oats or another whole grain, with fruit and a few nuts. Oats bring fibre that helps lower cholesterol.',ref:'CD:268 · G'},
  {plan:'thin',txt:'The base of a hearty breakfast.',ref:'CD:268'},
  {plan:'mind',txt:'Part of a simple plant breakfast.',ref:'CD:268'}],
 flax:[{plan:'bp',txt:'A spoon of ground flaxseed on breakfast adds fibre.',ref:'G'},
  {plan:'bmi',txt:'Ground flaxseed brings fibre that helps lower cholesterol.',ref:'G'},
  {plan:'mind',txt:'Walnuts and flaxseed feed the brain well.',ref:'G'}],
 garlic:[{plan:'bp',txt:'Raw garlic is a traditional favourite for blood pressure, in the big vegetable lunch.',ref:'G'},
  {plan:'sugar',txt:'Onion and garlic are traditional everyday foods for steadier blood sugar.',ref:'G'}],
 celery:[{plan:'bp',txt:'A traditional favourite for blood pressure, in the big vegetable lunch.',ref:'G'}],
 tomato:[{plan:'bp',txt:'A traditional favourite for blood pressure, and it brings potassium.',ref:'G'},
  {plan:'veg',txt:'Part of the raw salad at lunch.',ref:'CD:514'}],
 potato:[{plan:'bp',txt:'Unsalted potato soup, with the skin, is a simple vegetable dish for lunch.',ref:'CD:514',
  care:'Potassium-rich foods can matter with some blood-pressure pills or kidney disease. Mention them to your clinic first.'}],
 rice:[{plan:'sugar',txt:'Rice, maize and oats are good everyday staples; whole-grain porridge at a set time makes breakfast.',ref:'CD:146'}],
 onion:[{plan:'sugar',txt:'Onion and garlic are traditional everyday foods for steadier blood sugar.',ref:'G'}],
 beans:[{plan:'sugar',txt:'Cooked green beans are a traditional everyday food for steadier blood sugar.',ref:'G',
  care:'Always cook green beans. Do not eat them raw.'}],
 lentils:[{plan:'sugar',txt:'Rice, maize, oats, beans, peas and lentils are good everyday staples.',ref:'CD:146'},
  {plan:'bmi',txt:'Beans or lentils with vegetables and a whole grain make a filling lunch, and bring fibre.',ref:'CD:514 · G'},
  {plan:'thin',txt:'Beans and lentils with grains are good, filling staples.',ref:'CD:146'}],
 slaw:[{plan:'bmi',txt:'Plenty of vegetables at lunch.',ref:'CD:514'},
  {plan:'veg',txt:'Half the plate vegetables, starting with a raw salad.',ref:'CD:514'}],
 dates:[{plan:'sleep',txt:'Fruit, fresh or dried, makes a light early supper.',ref:'CD:245'},
  {plan:'thin',txt:'Dried fruit is a good, filling staple.',ref:'CD:146'},
  {plan:'veg',txt:'Dried fruit can be used freely as everyday food.',ref:'CD:146'}],
 crackers:[{plan:'sleep',txt:'A few crackers with fruit make a light supper several hours before bed.',ref:'CD:245'}],
 nuts:[{plan:'mind',txt:'A few walnuts with breakfast feed the brain well.',ref:'G'},
  {plan:'thin',txt:'Nuts can take the place of meat, and a handful a day adds energy.',ref:'MH:23'}],
 fruit:[{plan:'veg',txt:'Fruit with every breakfast; eat plenty of it.',ref:'CD:475'},
  {plan:'sleep',txt:'Fruit makes a light early supper.',ref:'CD:245'},
  {plan:'mind',txt:'Fruit is part of a simple plant breakfast.',ref:'CD:268'}],
};

/* ---------------------------------------------------------------------------------------------------------
   DIRECTIVE PLAN: what the visitor must DO, WHY (the reason, with its reference) and HOW (concrete steps), most
   important first. The plan screen shows the first 3; the rest appear under "When these feel easy, add". WhatsApp
   and the printed card carry the same 3. Every `why`/`how` restates the plan's own steps and facts above, with the
   same reference; nothing new is claimed. Optional per action:
     foods: food keys whose daily cost is shown       when(a): only for visitors it fits
     first(a): move to the top for this visitor      how items may be functions of the visitor (return '' to skip) */
export const heavy=a=>{const b=bmi(a);return b!=null&&b>=25;};
export const cholUp=a=>a.s.chol!=null&&a.s.chol>=5;
export const PLAN_GOAL={bp:'Bring your blood pressure down',sugar:'Bring your blood sugar down',bmi:'Reach a healthy weight and cholesterol',
 thin:'Reach a healthy weight',veg:'Eat more fruit and vegetables',move:'Move more every day',water:'Drink enough water',
 sleep:'Sleep deeply again',mind:'Calm your mind'};
export const ACTIONS={
 bp:[
  {do:'Cut right down on salt, from today',why:'Go easy on salt, pickles and spicy food, and eat plenty of fruit instead.',ref:'CD:475',
   how:['No salt in cooking or at the table','No stock cubes, soy sauce, MSG or salty processed food','Read labels: avoid sodium and preservatives']},
  {do:'Walk outdoors every day',why:'Walking is the best exercise: it improves the circulation and uses the whole body.',ref:'HL:570 · HL:571',
   how:['In daylight, for example at 16:30','Start gently and build up to 30 minutes','Heart disease or several heart risks? See a doctor before hard exercise']},
  {do:'Eat a big raw-vegetable lunch every day',why:'Plenty of vegetables, fruit and grains; tomato, celery, garlic and carrots are traditional favourites for blood pressure.',ref:'CD:514 · G',
   foods:['garlic','celery','tomato'],how:['A big raw salad at lunch: garlic, celery and tomato','Unsalted potato soup, with the skin, is good too']},
  {do:'Drink about 8 glasses of water, between meals',why:'Water drunk freely helps the body resist disease; drink it between meals rather than with them.',ref:'CD:726 · CD:731 · G',
   how:['A full glass as soon as you get up','Water through the day, not tea, coffee or sweet drinks']},
  {do:'Lose extra weight slowly',why:'Meals at set times, a good breakfast and a light early supper bring weight down steadily.',ref:'CD:267 · CD:268',when:heavy,
   how:['No crash diets: steady, regular meals','A light, early supper']},
  {do:'Take 10–20 slow, deep breaths after meals and before bed',why:'Deep, full breaths refresh the blood and calm the nerves.',ref:'HL:717',
   how:['Sit upright, in loose clothing','Outdoors in fresh air if you can']},
  {do:'Add ground flaxseed to breakfast',why:'Oats and ground flaxseed add fibre.',ref:'G',foods:['flax'],
   how:['1–2 tablespoons on your porridge']},
  {do:'End the day with a warm bath and an early night',why:'Warm and neutral baths soothe the nerves and even out the circulation.',ref:'MH:17',
   how:['33–35°C for 15–30 minutes, never hot','Lights out by 22:00']}],
 sugar:[
  {do:'Cut out sugar and sweets, from today',why:'Far too much sugar is eaten; sweets, cakes and pastries are best left out.',ref:'CD:191',
   how:['No sugar in drinks, no sweets, cakes or cold drinks','Swap white bread for whole grains: brown rice, oats or whole maize meal','No coffee and no tobacco']},
  {do:'Walk briskly every day',why:'Walk outdoors every day; a short walk after meals helps digestion.',ref:'MH:17 · HL:571',
   how:['A short walk after lunch','A brisk outdoor walk later in the day','Unfit? Walk briskly for a minute, easily for half a minute, and repeat']},
  {do:'Eat at set times, with nothing in between',why:'Leave at least five hours between meals with nothing in between, and keep any third meal light and early.',ref:'CD:267 · CD:245',
   how:['Breakfast, lunch and a small, early supper','Chew slowly and eat calmly','Nothing more to eat in the evening']},
  {do:'Build meals on whole grains, beans and vegetables',why:'Rice, maize, oats, beans and lentils are good staples, and whole grains nourish better than white flour.',ref:'CD:146 · CD:504',
   foods:['rice','lentils'],how:['Brown rice or whole maize meal porridge for breakfast','Beans or lentils at lunch']},
  {do:'Eat onion, garlic and cooked green beans every day',why:'They are traditional everyday foods for steadier blood sugar.',ref:'G',foods:['onion','garlic','beans'],
   how:['Raw onion and garlic in the lunch salad','Green beans always cooked, never raw']},
  {do:'Check both feet every evening',why:'With high blood sugar, small sores can become infected.',ref:'S',
   how:['Look for cuts, blisters or sores','Avoid very hot and very cold baths: a warm bath (33–35°C) is the gentle choice']},
  {do:'Drink water through the day',why:'Water drunk freely helps the body do its work and resist disease.',ref:'CD:726',
   how:['Water, not juice or sweet drinks']}],
 bmi:[
  {do:'Make breakfast your biggest meal and supper the lightest',why:'Make breakfast the heartiest meal; a third meal should be light and several hours before bed.',ref:'CD:268 · CD:245',
   foods:['oats'],how:['Breakfast: oats or another whole grain, with fruit and a few nuts','Supper early and light, or just fruit and a cracker','Nothing to eat before bed']},
  {do:'Cut out fried food and animal fat',why:'Prepare food simply and free of grease; plant foods carry no cholesterol, and flaxseed and oats bring fibre that helps lower it.',ref:'CD:137 · G',
   first:a=>cholUp(a)&&!heavy(a),foods:['flax'],how:['No meat fat, butter, cheese or fried food','A spoon of ground flaxseed on breakfast','Smaller meals: even simple food can be overeaten']},
  {do:'Stop snacking: only water between meals',why:'Eat at set times, and take nothing until the next meal.',ref:'CD:267',
   how:['Plenty of water through the day','No juice, cold drinks or coffee','Hungry between meals? Make the meals themselves more filling']},
  {do:'Walk outdoors every day',why:'Active exercise in the open air every day strengthens the liver, kidneys and lungs.',ref:'HL:578 · HL:571',
   how:['Build up slowly to 30 minutes or more','Heart disease? See a doctor first']},
  {do:'Fill up on vegetables',why:'Plenty of vegetables, fruit and grains.',ref:'CD:514',foods:['slaw'],
   how:['Raw cabbage and carrot salad, about 300 g a day']},
  {do:'Choose whole grains and beans, with little sugar',why:'Whole grains nourish better than white flour, and far too much sugar is eaten.',ref:'CD:504 · CD:191',foods:['lentils'],
   how:['Rolled oats, brown rice, beans, lentils','No sugar, sweets or white bread']}],
 thin:[
  {do:'Eat three good meals at set times',why:'The body must have enough nourishing food, eaten at set times.',ref:'CD:326 · CD:267',
   how:['Breakfast, lunch and an early supper, every day','Make the meals bigger rather than snacking']},
  {do:'Make breakfast hearty',why:'The stomach handles food best in the morning, so breakfast should be the heartiest meal.',ref:'CD:268',foods:['oats','nuts'],
   how:['Porridge with milk or soy milk, fruit, a handful of nuts and a few dates']},
  {do:'Add beans, nuts and dried fruit every day',why:'Grains, beans, lentils and dried fruit are good, filling staples, and nuts can take the place of meat.',ref:'CD:146 · MH:23',
   foods:['lentils','dates'],how:['Beans or lentils at lunch','A few dates or raisins with breakfast']},
  {do:'Walk or work outdoors every day',why:'Active exercise in the open air strengthens the body and builds appetite.',ref:'HL:578',
   how:['A walk or light garden work in the afternoon']},
  {do:'Eat slowly and calmly',why:'Food eaten in a hurry or while anxious does less good.',ref:'CD:168',
   how:['Sit down for meals and chew well']},
  {do:'See the clinic if you lost weight without trying',why:'Weight loss you cannot explain needs a check.',ref:'S',
   how:['Ask the triage nurse today if you are worried']}],
 veg:[
  {do:'Fruit with every breakfast',why:'Eat plenty of fruit; fruit is a gift to be thankful for.',ref:'CD:475 · CD:464',foods:['fruit'],
   how:['A banana or seasonal fruit on your porridge']},
  {do:'Half the plate vegetables at lunch',why:'Plenty of vegetables, fruit and grains, simply prepared.',ref:'CD:514 · CD:137',foods:['slaw','tomato'],
   how:['A raw salad of cabbage, carrot and tomato','Plus one cooked vegetable']},
  {do:'Reach five servings of fruit and vegetables a day',why:'At least five servings a day is the goal; colourful fruit and vegetables and dark greens bring the widest range of goodness.',ref:'G',
   how:['A serving is a fist-sized fruit or half a cup of vegetables','Count them for a week']},
  {do:'Keep dried fruit for everyday use',why:'Dried fruit such as raisins and dates can be used freely as everyday food.',ref:'CD:146',foods:['dates'],
   how:['A few dates or raisins with breakfast']},
  {do:'Beans or lentils a few times a week',why:'Beans, boiled or baked, are a simple, wholesome dish.',ref:'CD:518',
   how:['Bean soup, or lentils with rice']}],
 move:[
  {do:'Walk outdoors every day',why:'No exercise can take the place of walking, and it should be done in the open air every day the weather allows.',ref:'HL:570 · HL:571',
   how:['Week 1: 10 minutes a day','Summer and winter']},
  {do:'Walk a little after every meal',why:'A short walk after meals helps digestion.',ref:'MH:17',
   how:['Head up, shoulders back','Even 5 minutes counts']},
  {do:'Add 5 minutes a week until you reach 30',why:'Brisk but not violent exercise refreshes the whole body; 30 minutes a day is the goal.',ref:'HL:780 · G',
   how:['Write down your minutes each day','Heart disease, chest pain or several heart risks? See a doctor first']},
  {do:'Do useful work with your hands',why:'Useful work lifts the mind as well as the body.',ref:'MH:17',
   how:['Garden, sweep, carry, or help a neighbour']},
  {do:'Breathe deeply in fresh air',why:'Deep, full breaths of fresh air refresh the blood.',ref:'HL:717',
   how:['10 slow breaths by an open window each morning']}],
 water:[
  {do:'Drink hot water as soon as you get up',why:'A drink of clear, hot water before eating does no harm and may do good.',ref:'CD:728',
   how:['A glass or two before breakfast, hot but never scalding']},
  {do:'Drink between meals, not with them',why:'Little or no drink with meals; drink water a while before or after eating.',ref:'CD:731',
   how:['A glass half an hour before each meal','Two glasses mid-morning and mid-afternoon']},
  {do:'About 8 glasses a day',why:'Drink freely of pure water every day; about 8 glasses is the goal.',ref:'CD:727 · G',
   how:['Keep a bottle with you','Pale yellow urine means you are drinking enough']},
  {do:'Water instead of tea, coffee and sweet drinks',why:'Tea, coffee and sweet drinks do not take the place of water.',ref:'MH:26 · G',
   how:['Swap one drink a day, then another']},
  {do:'Eat plenty of fruit',why:'Fruit eases thirst and the craving for salty, spicy food.',ref:'CD:475',
   how:['Fruit with every breakfast']}],
 sleep:[
  {do:'Go to bed and get up at the same time every day',why:'Irregular hours for eating and sleeping wear down the mind; a steady rhythm helps the body know when to sleep.',ref:'CD:201 · G',
   how:['In bed by 21:00–22:00, weekends too','Morning light and fresh air as soon as you are up']},
  {do:'No tea, coffee or tobacco, and a light early supper',why:'Stimulants bring sleeplessness, and eating just before bed keeps the stomach working through the night.',ref:'MH:26 · CD:270',
   foods:['dates','crackers','fruit'],how:['No coffee, strong tea, cola or tobacco','Supper: fruit, or a few dates and whole-grain crackers','Nothing more to eat after supper']},
  {do:'A cup of hop or catnip tea in the evening',why:'Hop tea helps bring on sleep and catnip tea quiets the nerves; chamomile and linden flower are gentle alternatives.',ref:'PH:6 · G',
   how:['One cup, warm and unsweetened','Taking sleeping or anxiety pills, pregnant or breastfeeding? Ask your clinic before hops','No catnip in pregnancy']},
  {do:'Take a warm bath just before bed',why:'Warm and neutral baths soothe the nerves.',ref:'MH:17',
   how:['33–35°C for 15–30 minutes, never hot','Skip very hot baths with diabetes or heart trouble']},
  {do:'Breathe deeply in fresh air before bed',why:'Deep breathing of fresh air calms the nerves and helps sound sleep.',ref:'HL:717',
   how:['Sit upright, in loose clothing','A few minutes by an open window']},
  {do:'Keep the bedroom aired and sunlit',why:'Bedrooms need fresh air day and night, and daily sunshine and airing.',ref:'HL:313 · HL:618',
   how:['Open the window a little at night','Open curtains and windows every morning']},
  {do:'Walk or work outdoors every day',why:'Walk outdoors every day; exercise helps sleep, but not right before bed.',ref:'HL:571 · G',
   how:['Late afternoon is a good time']},
  {do:'End the day thankful',why:'A cheerful, thankful mind is good for the body; worry keeps people awake.',ref:'MH:18',
   how:['Set the day’s worries aside','A short prayer of thanks']}],
 mind:[
  {do:'Get outside every day: morning light and a walk',why:'Time outdoors among trees and flowers is one of nature’s best remedies, and brisk walking with a cheerful spirit refreshes the whole body.',ref:'MH:19 · HL:780',
   how:['Half an hour of morning light','Walk, garden or do useful work outdoors']},
  {do:'Check one worrying thought each evening',why:'Worries often grow from thinking traps; writing a fairer version of the thought takes away much of its sting.',ref:'G',
   how:['Evening, 5 minutes: write the worry down','Is it all-or-nothing, a jump to the worst, or a feeling taken as fact?','Write a fairer version of it']},
  {do:'Write down three good things each evening',why:'Nothing does more for health than a thankful spirit, and speaking of good things makes joy grow.',ref:'MH:18',
   how:['Three good things from today','Thank God for each one','Read them out loud']},
  {do:'Do one kind thing for someone every day',why:'Helping others brings healing to the helper too.',ref:'MH:18',
   how:['Call or visit a friend, neighbour or family member','Join a church or community project']},
  {do:'Take slow, deep breaths after meals and before bed',why:'Deep breathing of fresh air calms the nerves.',ref:'HL:717',
   how:['Sit upright, in loose clothing, in fresh air']},
  {do:'Sing, even when you do not feel like it',why:'Singing is a help that is always at hand against discouragement.',ref:'MH:18',
   how:['A hymn in the morning or evening','Calm music instead of TV before bed']},
  {do:'Drink water from the moment you wake',why:'Drink freely of pure water every day.',ref:'CD:727',how:['A glass as soon as you are up','Plenty through the day']},
  {do:'A simple plant breakfast, eaten calmly',why:'Simple plant meals feed the brain well: fruit, whole grains, walnuts and flaxseed.',ref:'CD:268 · G',foods:['oats','nuts','fruit','flax'],
   how:['Oats with fruit, a few walnuts and a spoon of ground flaxseed']},
  {do:'A cup of chamomile or linden tea in a quiet moment',why:'Chamomile and linden flower teas are traditional calming teas.',ref:'G',
   how:['Warm and unsweetened, sitting down','Allergic to ragweed? Choose linden instead']}],
};
/* When to check again: the step that closes the 21 days. */
export const RECHECK={bp:['Have your blood pressure checked again in 3 weeks, at a clinic or pharmacy.','S'],
 sugar:['Have your blood sugar checked again in 3 weeks, at your clinic.',''],
 bmi:['Check your weight again in 3 weeks, on the same scale.',''],
 thin:['Check your weight again in 3 weeks, on the same scale.',''],
 veg:['Count your servings of fruit and vegetables each day for the 3 weeks.',''],
 move:['Write down your walking minutes each day for the 3 weeks.',''],
 water:['Count your glasses of water each day for the 3 weeks.',''],
 sleep:['Write down your hours of sleep each night for the 3 weeks.',''],
 mind:['Low mood or worry lasting more than 2 weeks, or stopping you working or sleeping? See your clinic.','']};

const HUES=['mint','sky','lilac','sage','blush','sand','aqua','peach'];
export const hueOf=id=>HUES[[...String(id)].reduce((t,c)=>t+c.charCodeAt(0),0)%HUES.length];
export const HUE_P={bp:'blush',sugar:'sand',bmi:'sky',thin:'peach',veg:'sage',move:'mint',water:'aqua',sleep:'lilac',mind:'aqua'};
/* "MH:23" → "Ministry of Healing ch. 23"; "CD:731" → "Counsels on Diet §731"; "HL:571" → "Healthful Living §571";
   "PH:6" → "Place of Herbs p. 6"; "G" / "S" → what the line rests on */
const REF_TAG={G:'general advice',S:'expo safety rule'};
const REF_BOOK={MH:'Ministry of Healing ch. ',CD:'Counsels on Diet §',HL:'Healthful Living §',PH:'Place of Herbs p. '};
export function refLabel(pg){
 return String(pg).split(' · ').map(x=>{
  if(REF_TAG[x])return REF_TAG[x];
  const m=x.match(/^(MH|CD|HL|PH):(.+)$/);return m?REF_BOOK[m[1]]+m[2]:x;}).join(' · ');
}
/* which books a plan actually draws on, so the credit line only names those */
export function planBooks(p,extra){
 const refs=[...p.steps.map(s=>s[2]),...p.facts.map(f=>f[1]),...(extra||[])].join(' · ');
 const out=[];
 if(/(^|\s)MH:/.test(refs))out.push(BOOK_REF);
 if(/(^|\s)CD:/.test(refs))out.push(BOOK2_REF);
 if(/(^|\s)HL:/.test(refs))out.push(BOOK3_REF);
 if(/(^|\s)PH:/.test(refs))out.push(BOOK4_REF);
 return out;
}
export const planCredit=p=>p.credit||planBooks(p).join('; ');
