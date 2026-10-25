# Plan: cite only Ellen White, restore the natural-health ideas, and add plans for every problem the checks flag

**Status: plan only, nothing applied.** Every number was measured, and `gate pre` re-checks it before anything changes.

<!-- Fields with "=" inside double braces are filled by render-plan.js from tool output. The other double-brace fields are
     prose you write from this session's tool output. `render-plan.js <project> --check` must PASS before reporting. -->

## 1. Goal
Today five plans cite The Ministry of Healing plus Kellogg, King's and Grieve, and the underweight, fruit & veg, exercise and water checks have no plan. After the plan, nine plans cite only Ellen White (Ministry of Healing chapters, Counsels on Diet and Healthful Living paragraphs, Place of Herbs page), restore the natural-health, herb and food ideas in our own words (tagged G where she is silent), and route every flagged check to a plan. Measured on copies: tests before 573 pass / 0 fail, after 580 pass / 0 fail.

| # | Problem (exact test name or symptom) | Cause (file:line from an anchor) | Kind | Fix |
|---|---|---|---|---|
| F1 | Plans cite non-Ellen-White sources; four checks have no plan | `index.html:1222` (BOOK_REF) and the data block; `planNeeds` at `index.html:2399` | Real bug / Stale test / Decision: Ellen White only, own words, G for uncited ideas, new plans for every check (your answers) | A1–A16; tests U1–U4; PLANS.md P1 |

Out of scope, unchanged before and after: none.

## 2. Scope
- **Edited:** `index.html`, `.smoke/harness.js`, `PLANS.md`, changed only by `node fix-plan-egw/apply.js .`
- **Generated:** `dist/index.html`, `dist/sw.js`, changed only by `node tools/build.js`
- **Everything else:** 134 files stay byte-identical. No file is added or deleted.
- **Invariants:** the stylesheet, the store prices, the help line, the screening bands (cat) and the red-flag rule (urgentOf) stay byte-identical. Extra checks: the harness parses, and no author but Ellen White is named in index.html, dist/index.html or PLANS.md.

## 3. Hard rules (any violation = the plan FAILS)
1. **Fail closed.** Any `[FAIL]`, crash or timeout fails the plan. Never edit the gate, `config.js` or `expected.json`
   to get past one. Restore the backups and report.
2. **No hand edits.** Only `apply.js` changes edited files: each edit is applied exactly once, or nothing is written.
3. **No weakened tests.** Changed files must be byte-identical to the dry run. No test may be renamed, dropped, skipped
   or made always-true. The gate breaks the fixed code in 10 way(s), and each must be caught.
4. **Zero hallucination.** Report only what the gate or a tool printed. Write "not run" or "not measured" for
   anything else.
5. **Pinned tooling.**
   - `fix-plan-egw/gate.js` sha256 `61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587`
   - `fix-plan-egw/expected.json` sha256 `bbaf835aa82333f9f903675650f3c2bbae27a7f10221d90d119ed50adcd77c08`

   The gate pins the other files itself.
6. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis
Read-only. Check the pins, run `node fix-plan-egw/scope-report.js` (required: `SCOPE VERDICT: READY`), read sections 1–2
and 6 and `fix-plan-egw/edits.js`, and grep the callers and tests of each edit site.

Present it under four headings, citing `file:line`:
- **Scope covered:** 5 file(s) change (`.smoke/harness.js`, `PLANS.md`, `dist/index.html`, `dist/sw.js`, `index.html`) and 134 stay identical.
- **What it entails.**
- **What is in it.**
- **How it connects with the plan:** each edit → its goal → the tests that must pass → its mutations.

**Stop and ask** if:
- the verdict isn't READY;
- an edit or goal isn't linked;
- the code doesn't match this plan;
- this document and `edits.js` disagree;
- the change affects something not mentioned here.

Otherwise, continue to section 5 without waiting. ALREADY APPLIED: run `gate.js post` and report; don't re-apply.

## 5. Steps (from `C:\Users\fanel\Downloads\Health Expo`)
```bash
sha256sum fix-plan-egw/gate.js fix-plan-egw/expected.json   # must match rule 5
node fix-plan-egw/gate.js pre     # required: RESULT: PASS (25/25 checks passed, mode=pre); writes backups
node fix-plan-egw/apply.js .      # required: applied 21 edits to 3 files
node tools/build.js    # regenerate
node fix-plan-egw/gate.js post    # required: RESULT: PASS (37/37 checks passed, mode=post)
```
**On any other output:**
1. Copy each edited file back from `%TEMP%/fix-plan-backup` (`/` in the path is written as `__`).
2. Regenerate.
3. Report FAILED, quoting the `[FAIL]` lines.

What the gate checks (each check's result is in the report JSON it prints):
- **pre:** tooling hashes, a byte-identical baseline, anchors, line endings, invariants, the recorded test results, and
  verified backups.
- **post:**
  - only the planned files changed, each byte-identical to the dry run, with the rest unchanged;
  - invariants and extra checks;
  - fresh regeneration;
  - test tallies, names and statuses;
  - every mutation caught.

After the first FAIL, the gate skips the slow steps (`[SKIP]`), because the RESULT is FAIL anyway.

## 6. The exact change (ground truth: `fix-plan-egw/edits.js`)
### A1 plan data on Ellen White only, nine plans  (`index.html`, serves F1)

Why: cites only Ellen White (Ministry of Healing chapters, Counsels on Diet and Healthful Living paragraphs, Place of Herbs page) or G/S; restores the natural-health, herb and food ideas in our own words; adds the underweight, fruit & veg, exercise and water plans

Find (exactly once):

```html
/* ---------------------------------------------------------------------------------------------------------
   The five plans rest on two public-domain books by Seventh-day Adventist health pioneers, always in our own words:
     "MH:23"     = chapter 23 of The Ministry of Healing (Ellen G. White, 1905)
     "K:395–396" = printed pages of Rational Hydrotherapy (J. H. Kellogg, M.D., 1901)
     "KD:Tilia"  = an entry of King’s American Dispensatory (1898), by its Latin name (herb teas only)
     "GR:Hops"   = an entry of A Modern Herbal (Mrs M. Grieve, 1931) (herb teas only)
   Two tags name lines that come from no book: "G" = general advice, "S" = the expo's own safety rule.
   Several references can be joined with " · ". See PLANS.md for where each one was checked.
   "steps"  = the day, in order (each with its reference)
   "facts"  = what the plan is based on, with references
   "items"  = shopping list with APPROXIMATE South African prices (neither book has prices; check locally)
   "habits" = the three-line summary used on the WhatsApp message and the take-home card
   "note"   = a plan-specific safety note;  "help" = a get-help line shown prominently (mind and sleep plans)  */
const BOOK_REF='The Ministry of Healing (Ellen G. White, 1905; public domain)';
const BOOK2_REF='Rational Hydrotherapy (J. H. Kellogg, M.D., 1901; public domain)';
const BOOK3_REF='King’s American Dispensatory (1898; public domain)';
const BOOK4_REF='A Modern Herbal (Mrs M. Grieve, 1931)';
const HELP_LINE='If you feel hopeless, or have thoughts of harming yourself, tell someone you trust today and call the SADAG suicide crisis line (0800 567 567) or Lifeline (0861 322 322), or go to the nearest clinic or emergency service. Do not wait.';
const PROTOCOLS={
 bp:{tag:'Blood pressure',tagline:'21-day blood-pressure plan',title:'High Blood Pressure — Home Plan',
  src:'The Ministry of Healing: chs. 8, 17, 20, 23, 26 · Rational Hydrotherapy: pp. 197, 372, 395–396',
  mech:'Built on the natural remedies The Ministry of Healing lists: water, fresh air, sunlight, exercise, rest, and simple plant foods with little salt.',
  steps:[
   ['06:30','A glass of water when you get up, then a breakfast of oats or another whole grain with fruit. Go easy on salt.','MH:17 · MH:23'],
   ['10:00','Drink plain water freely through the day, not tea, coffee or sweet drinks.','MH:17 · MH:26'],
   ['13:00','A big lunch of vegetables: a raw salad with tomato, celery, carrot, onion and garlic, with beans or lentils. Unsalted potato soup is good too.','MH:23'],
   ['13:30','A short walk after the meal, head up and shoulders back, then a few slow, deep breaths in fresh air.','MH:17 · MH:20'],
   ['16:30','A brisk walk outdoors. Start gently and build up slowly.','MH:17'],
   ['18:00','A light supper, eaten early, with nothing salty or processed. Nothing more to eat after it.','MH:23'],
   ['21:00','A neutral bath (33–35°C, never hot) just before bed, then lights out.','K:395–396']],
  hydro:'<b>Neutral bath (33–35°C / 92–95°F), just before bed:</b> stay in about 15–30 minutes. Dr Kellogg advised it at bedtime to bring on sound sleep (Rational Hydrotherapy, pp. 395–396), and The Ministry of Healing says warm and neutral baths soothe the nerves (ch. 17). <em>Never a hot bath: Dr Kellogg warned against very hot baths for people with hardened arteries or heart trouble (pp. 197, 372). If your feet have lost feeling, test the water with your elbow.</em>',
  facts:[
   ['The natural remedies: pure air, sunlight, moderation, rest, exercise, good food, water and trust in God.','MH:8'],
   ['Water drunk freely helps the body do its work and resist disease.','MH:17'],
   ['Build meals on grains, fruit, nuts and vegetables, prepared as simply as possible.','MH:23'],
   ['Beans, peas and lentils with whole grains make a complete diet without meat.','MH:23'],
   ['Go easy on salt, pickles and spicy food, and eat plenty of fruit.','MH:23'],
   ['Use little sugar: cakes, sweet puddings and pastries are best left out.','MH:23'],
   ['Tea and coffee give short-lived energy, followed by headache, sleeplessness and a racing heart.','MH:26'],
   ['Tobacco and alcohol harm the body; leave them out.','MH:26'],
   ['Lack of exercise is a common cause of disease; exercise keeps the blood flowing freely.','MH:17'],
   ['Walk outdoors every day the weather allows: brisk walking works the whole body and fills the lungs.','MH:17'],
   ['Sit and stand up straight so the lungs can fill; deep breathing calms the nerves.','MH:20'],
   ['People worn out by overwork need rest, freedom from worry and time outdoors.','MH:17'],
   ['No very hot baths with hardened arteries or heart trouble; the neutral bath is the gentle choice.','K:197 · K:372'],
   ['Have your blood pressure checked regularly at a clinic or pharmacy.','S']],
  note:'Potassium-rich foods such as potatoes and tomatoes can matter with some blood-pressure pills or kidney disease. Mention them to your clinic first.',
  habits:['Water, little salt, and plenty of vegetables, fruit and whole grains','A daily outdoor walk and slow deep breaths in fresh air','A neutral bath and an early night'],
  items:[
   {name:'Rolled oats / oat bran',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   {name:'Raw garlic',dose:'2 cloves',store:'R200–R317 per kg (median R247) at Checkers, SPAR, Woolworths (checked 19 Oct 2026)',daily:2.47},
   {name:'Celery',dose:'2–4 stalks',store:'R26–R30 a bunch (median R29) at Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:7.25},
   {name:'Tomatoes',dose:'2 medium',store:'R24–R35 per kg (median R33) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.95},
   {name:'Potatoes (with skin)',dose:'250g for soup',store:'R11–R15 per kg (median R12) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:3.12}]},

 sugar:{tag:'Blood sugar',tagline:'21-day blood-sugar plan',title:'High Blood Sugar — Home Plan',
  src:'The Ministry of Healing: chs. 17, 23, 25, 26 · Rational Hydrotherapy: p. 377',
  mech:'Built on The Ministry of Healing’s counsel on food and exercise: simple whole plant foods, meals at set times with nothing in between, little sugar, no late eating, and daily outdoor exercise.',
  steps:[
   ['06:30','Water, then breakfast at a set time: whole-grain porridge (brown rice, oats or whole maize meal) with beans or fruit. No added sugar.','MH:23'],
   ['10:00','Water between meals, and nothing to eat until lunch.','MH:17 · MH:23'],
   ['13:00','Lunch at a set time: a raw salad with onion and garlic, cooked green beans, and beans or lentils. Eat slowly and chew well.','MH:23'],
   ['13:30','A short walk after lunch, head up and shoulders back.','MH:17'],
   ['16:30','A brisk walk outdoors. If you are unfit, start with a few minutes and add a little each day.','MH:17'],
   ['18:00','A small, early supper of plain food, eaten slowly. Nothing more to eat in the evening.','MH:23 · MH:25'],
   ['21:00','Check both feet for cuts, blisters or sores, then bed.','S']],
  hydro:'<b>Avoid very hot and very cold baths.</b> Dr Kellogg advised people with diabetes who are thin or frail to avoid both extremes (Rational Hydrotherapy, p. 377); the expo keeps to that for everyone with diabetes. A neutral bath (33–35°C / 92–95°F) is the gentle choice. <em>If your feet have lost feeling, test the water with your elbow, never your foot.</em>',
  facts:[
   ['Eat at set times, and nothing between meals.','MH:23'],
   ['Leave five or six hours between meals so digestion can finish its work.','MH:23'],
   ['Do not eat late: the stomach should have finished its work before you lie down.','MH:23'],
   ['If a third meal is eaten, make it light and early: crackers and fruit suit the evening.','MH:25'],
   ['Build meals on grains, fruit, nuts and vegetables, prepared as simply as possible.','MH:23'],
   ['Rice, maize, oats, beans, peas and lentils are good everyday staples.','MH:23'],
   ['Far too much sugar is eaten: sweets, cakes and pastries are best left out.','MH:23'],
   ['Eat slowly and chew well, at a calm, unhurried meal.','MH:23'],
   ['Even plain, healthy food should not be overeaten.','MH:23'],
   ['Exercise every day, outdoors where you can; a short walk after meals helps digestion.','MH:17'],
   ['Tea, coffee and tobacco are stimulants; leave them out.','MH:26'],
   ['Thin or frail people with diabetes should avoid very hot and very cold baths; the expo applies this to everyone with diabetes.','K:377 · S'],
   ['Check your feet every day: with high blood sugar, small sores can become infected.','S'],
   ['Very high or very low sugar is an emergency: go to the clinic or emergency room. If you take insulin, follow your clinic’s plan for low sugar.','S']],
  note:'If you take diabetes pills or insulin, never change the dose yourself. Talk to your clinic first.',
  habits:['Meals of whole foods at set times, nothing in between, and little sugar','A brisk outdoor walk every day and plenty of water','Check your feet every evening'],
  items:[
   {name:'Brown rice / whole maize meal',dose:'60g dry',store:'R21–R38 per kg (median R23) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths; unsifted maize meal was not found online, STAND-IN super (sifted) maize meal R11–R13 per kg at Game, Makro, SPAR (checked 19 Oct 2026)',daily:1.35},
   {name:'Onions',dose:'1 medium',store:'R28–R39 per kg (median R30) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.50},
   {name:'Raw garlic',dose:'2 cloves',store:'R200–R317 per kg (median R247) at Checkers, SPAR, Woolworths (checked 19 Oct 2026)',daily:2.47},
   {name:'Green beans',dose:'100g',store:'R68–R86 per kg (median R83) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:8.33},
   {name:'Brown lentils / beans',dose:'½ cup cooked',store:'R49–R68 per kg (median R52) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.34}]},

 bmi:{tag:'Weight & cholesterol',tagline:'Steady weight & cholesterol plan',title:'Weight & Cholesterol — Home Plan',
  src:'The Ministry of Healing: chs. 17, 23, 25, 26',
  mech:'Built on The Ministry of Healing’s counsel: simple plant meals at set times with nothing in between, a light early supper or none, little fat and sugar, and daily outdoor exercise.',
  steps:[
   ['06:30','Make breakfast a good meal: oats or another whole grain, with fruit and a few nuts.','MH:23'],
   ['10:00','Water only between meals: no snacks, juice, cold drinks or coffee.','MH:23 · MH:26'],
   ['13:00','Lunch at a set time: plenty of vegetables, with beans or lentils and a whole grain. Nothing fried.','MH:23'],
   ['13:30','A short walk after lunch, head up and shoulders back.','MH:17'],
   ['16:30','A brisk outdoor walk. Build up slowly, a little more each day.','MH:17'],
   ['17:30','A light, early supper, or just fruit and a cracker. Then nothing more before bed.','MH:23 · MH:25']],
  hydro:null,
  facts:[
   ['Eat at set times, and nothing between meals.','MH:23'],
   ['Leave five or six hours between meals; many people find two good meals a day better than three.','MH:23'],
   ['A third meal, if eaten, should be very light: crackers and fruit suit the evening.','MH:25'],
   ['Do not eat late in the evening: it disturbs sleep, and you wake with no appetite for breakfast.','MH:23'],
   ['Grains, fruit, nuts and vegetables, simply prepared, are the most healthful foods.','MH:23'],
   ['Nuts can take the place of meat, but eat only a few.','MH:23'],
   ['The oil in olives is far better than animal fat. Keep butter to a minimum, and cheese is best left out.','MH:23'],
   ['Far too much sugar is eaten: leave out cakes, sweet puddings, pastries and jams.','MH:23'],
   ['Even simple food can be overeaten: eat what the body needs and no more.','MH:23'],
   ['Eat slowly and chew well.','MH:23'],
   ['Without exercise the body gets clogged and some people put on weight; walk outdoors every day.','MH:17'],
   ['No crash diets or starving: steady, regular meals are the safe way to lose weight.','S'],
   ['Heart disease or several heart risks? See a doctor before hard exercise.','S']],
  note:'Avoid starving or very fast weight loss. If you have diabetes or take medicine, ask your clinic before changing your eating.',
  habits:['Whole-food meals at set times, with nothing in between','A brisk outdoor walk every day','A light early supper and nothing before bed'],
  items:[
   {name:'Rolled oats / whole grains',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   {name:'Brown lentils / beans',dose:'½ cup cooked',store:'R49–R68 per kg (median R52) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.34},
   {name:'Cabbage & carrots (raw salad)',dose:'300g a day',store:'Carrots R15–R17 per kg (median R15), cabbage R16–R25 a head (median R17) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:3.95}]},

 sleep:{tag:'Sleep',tagline:'Better-sleep plan',title:'Restless Nights — Home Plan',
  src:'The Ministry of Healing: chs. 17, 18, 20, 23, 25, 26 · Rational Hydrotherapy: pp. 197, 372, 377, 383–384, 395–396 · King’s American Dispensatory: Matricaria, Tilia, Nepeta, Humulus · A Modern Herbal: Hops',
  mech:'Built on The Ministry of Healing’s counsel (no late eating, no stimulants, daily outdoor exercise, fresh air and sunlight in the bedroom, a thankful mind) and Dr Kellogg’s neutral bath at bedtime, with a cup of calming herb tea.',
  steps:[
   ['07:00','Get up at the same time every day. Open the curtains and windows, and get outside in the morning light.','G · MH:20'],
   ['07:30','Start the day thankful: a short prayer of thanks for the night and the new day.','MH:18'],
   ['12:30','Make breakfast and lunch the main meals. No tea, coffee, cola or tobacco: they stimulate, and sleeplessness follows.','MH:23 · MH:26'],
   ['16:30','A walk or outdoor work in the late afternoon.','MH:17'],
   ['18:00','A light, early supper, or just fruit and a few crackers. Nothing more to eat after it.','MH:23 · MH:25'],
   ['20:00','Dim the lights and switch off the TV and phone. Set the day’s worries aside and sing or read something calming.','G · MH:18'],
   ['20:15','A cup of warm catnip, linden flower or hops tea, unsweetened.','KD:Nepeta · KD:Tilia · KD:Humulus · GR:Hops'],
   ['20:30','A neutral bath (33–35°C) just before bed, or a few minutes of slow, deep breaths in fresh air.','K:395–396 · MH:20'],
   ['21:00','Lights out by 21:00–22:00, in a room with fresh air: open the window a little.','G · MH:20']],
  hydro:'<b>Neutral bath (33–35°C / 92–95°F), just before bed:</b> stay in about 15–30 minutes. Dr Kellogg counted it among the best remedies for sleeplessness and advised taking it at bedtime (Rational Hydrotherapy, pp. 383–384, 395–396). <em>Never hot. Skip very hot or very cold baths if you have diabetes, heart trouble or hardened arteries (pp. 197, 372, 377), and test the water with your elbow if your feet have lost feeling.</em>',
  facts:[
   ['Most adults need 7–8 hours of sleep. Keep the same bed and wake times every day, weekends too.','G'],
   ['Full, deep breathing calms the nerves and brings sound, refreshing sleep.','MH:20'],
   ['Eating late keeps the stomach working through the night: sleep is restless and you wake unrefreshed.','MH:23'],
   ['If a third meal is eaten, make it light: crackers and fruit suit the evening.','MH:25'],
   ['Tea and coffee give short-lived energy, followed by headache and sleeplessness.','MH:26'],
   ['Bedrooms need fresh air day and night, and should be opened to the sunshine every day.','MH:20'],
   ['Daily exercise, outdoors where possible, strengthens the whole body.','MH:17'],
   ['Overwork calls for rest, freedom from worry and time in nature.','MH:17'],
   ['A cheerful, thankful mind is good for the body; worry and grief wear it down.','MH:18'],
   ['A neutral bath taken at bedtime is one of the best remedies for sleeplessness.','K:383–384 · K:395–396'],
   ['Do not stop sleeping tablets on your own; ask your clinic.','S'],
   ['Catnip tea, drunk warm, was used to calm restlessness and nervous irritability and to bring on sleep.','KD:Nepeta'],
   ['Linden flower tea was used to ease restlessness and promote rest and sleep.','KD:Tilia'],
   ['Hops were used to calm the nerves and promote sleep.','KD:Humulus · GR:Hops'],
   ['Chamomile tea was used to calm nervous irritability and restlessness.','KD:Matricaria'],
   ['Poor sleep for weeks, or feeling low or anxious, is a reason to see your clinic.','S']],
  note:'Some medicines (including some for blood pressure, anxiety and depression) can disturb sleep. Ask your clinic, and never stop them yourself. Do not stop sleeping tablets suddenly. If sleep has been poor for weeks, or you feel low or anxious, see your clinic. Herb teas: hops adds to the effect of sleeping or anxiety pills and alcohol, so ask your clinic first if you take them, or if you are pregnant or breastfeeding. No catnip tea in pregnancy. Chamomile can affect people allergic to ragweed. Use fresh linden flowers, not old stock.',
  help:HELP_LINE,
  habits:['The same bed and wake time every day, with morning light and fresh air','A light early supper, and no tea, coffee or tobacco','A neutral bath, slow deep breaths and lights out by 22:00'],
  items:[
   {name:'Figs or dates',dose:'2–3 pieces',store:'R82–R111 per kg (median R96) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths — priced as dates; no dried figs were found priced online (checked 19 Oct 2026)',daily:2.40},
   {name:'Whole-grain crackers',dose:'2–3',store:'R180–R188 per kg (median R184) at Checkers, Game, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.60},
   {name:'Seasonal fruit (bananas, berries)',dose:'1–2 servings',store:'R33–R38 per kg (median R35) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:6.92}]},

 mind:{tag:'Stress & mood',tagline:'Calm-mind plan',title:'Stress, Worry & Low Mood — Home Plan',
  src:'The Ministry of Healing: chs. 8, 17, 18, 19, 20, 23, 26 · Rational Hydrotherapy: pp. 197, 372, 383–384, 395–396 · King’s American Dispensatory: Matricaria, Tilia',
  mech:'Built on The Ministry of Healing’s chapters on the mind and on nature: mind and body affect each other, so time outdoors, exercise, deep breathing, simple food, gratitude, song, helping others and trust in God all lift the spirits.',
  steps:[
   ['06:30','Get up and thank God for the night and the new day. Drink a glass of water.','MH:18 · MH:17'],
   ['07:00','Spend time outdoors in the morning light: walk, garden, or sit among trees and flowers.','MH:19'],
   ['07:30','A simple plant breakfast: oats or another whole grain, with fruit and a few nuts.','MH:23'],
   ['12:30','Midday: a brisk walk or useful work outdoors. Work with the hands lifts a heavy mind.','MH:17'],
   ['13:30','After lunch: a few minutes of slow, deep breaths in fresh air, sitting up straight.','MH:20'],
   ['16:00','Do one kind thing for someone else: a visit, a call or a helping hand.','MH:18'],
   ['16:30','A cup of chamomile or linden flower tea, unsweetened, in a quiet moment.','KD:Matricaria · KD:Tilia'],
   ['19:30','Write down three good things from today, thank God for each, and read them out loud.','MH:18'],
   ['20:30','A calm evening: sing or listen to hymns, set worries aside, and pray. A neutral bath (33–35°C) eases restlessness.','MH:18 · K:383–384'],
   ['21:30','Lights out in a room with fresh air.','MH:20']],
  hydro:'<b>Neutral bath (33–35°C / 92–95°F), just before bed:</b> Dr Kellogg used it for nervousness and sleeplessness (Rational Hydrotherapy, pp. 383–384, 395–396). <em>Never hot: skip very hot baths if you have heart trouble or hardened arteries (pp. 197, 372).</em>',
  facts:[
   ['Mind and body are closely linked: worry, grief and discontent wear down health, while courage, hope and a cheerful spirit build it up.','MH:18'],
   ['Nothing does more for health of body and soul than a thankful spirit.','MH:18'],
   ['Thoughts follow words: speaking of the good things you have makes faith and joy grow.','MH:18'],
   ['Singing is a help that is always at hand against discouragement.','MH:18'],
   ['Thinking of others, and helping those in need, brings healing to the helper too.','MH:18'],
   ['Kindness and sympathy help a discouraged mind more than harsh words.','MH:18'],
   ['Time outdoors among trees, flowers and fresh air is one of nature’s best remedies.','MH:19'],
   ['People worn out by overwork or worry need rest, freedom from care and time in nature.','MH:17'],
   ['Useful work with the hands, outdoors if possible, lifts the spirits; idleness leaves people dwelling on their troubles.','MH:17'],
   ['Deep breathing of fresh air calms the nerves; shallow breathing leaves people dull and low.','MH:20'],
   ['Eat simple meals of grains, fruit, nuts and vegetables at set times, calmly and with thanks.','MH:23'],
   ['Tea, coffee and tobacco only stimulate, and leave people more tired and on edge afterwards.','MH:26'],
   ['Chamomile tea was used to calm nervous irritability, restlessness and peevishness.','KD:Matricaria'],
   ['Linden flower tea was used to ease irritation and restlessness.','KD:Tilia'],
   ['Trust in God is one of the true remedies.','MH:8']],
  note:'This plan supports good care; it does not replace a clinic. Low mood or worry that lasts more than a couple of weeks, or that stops you working or sleeping, is a reason to see your clinic. Herb teas: chamomile can affect people allergic to ragweed. Use fresh linden flowers, not old stock.',
  help:HELP_LINE,
  habits:['Morning light, an outdoor walk and plenty of water','Slow deep breaths, and one kind act for someone every day','Three good things and a prayer or song of thanks each evening, then lights out by 21:30'],
  items:[
   {name:'Walnuts or mixed nuts',dose:'1 small handful (30g)',store:'R430–R520 per kg (median R450) at Checkers, Game, Makro, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:13.49},
   {name:'Rolled oats',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   {name:'Seasonal fruit (bananas, berries)',dose:'1–2 servings',store:'R33–R38 per kg (median R35) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:6.92}]},
};

/* Why each shopping-list food is there, for the Food screen. Every line restates something the plans above already
   say, with the same reference: to add one, put it in the plan's steps or facts first. `care` = a caution to show. */
const FOOD_WHY={
 oats:[{plan:'bp',txt:'Whole grains, with fruit, make a good breakfast; grains are one of the four foods The Ministry of Healing builds the diet on.',ref:'MH:23'},
  {plan:'bmi',txt:'Breakfast is a good meal: oats or another whole grain, with fruit and a few nuts.',ref:'MH:23'},
  {plan:'mind',txt:'Part of a simple plant breakfast of whole grains, fruit and a few nuts.',ref:'MH:23'}],
 garlic:[{plan:'bp',txt:'Part of the big raw-vegetable lunch.',ref:'MH:23'},
  {plan:'sugar',txt:'Raw onion and garlic go in the lunch salad.',ref:'MH:23'}],
 celery:[{plan:'bp',txt:'Part of the big raw-vegetable lunch.',ref:'MH:23'}],
 tomato:[{plan:'bp',txt:'Part of the big raw-vegetable lunch.',ref:'MH:23'}],
 potato:[{plan:'bp',txt:'Unsalted potato soup, with the skin, is a simple vegetable dish for lunch.',ref:'MH:23',
  care:'Potassium-rich foods can matter with some blood-pressure pills or kidney disease. Mention them to your clinic first.'}],
 rice:[{plan:'sugar',txt:'Rice, maize and oats are good everyday staples; whole-grain porridge at a set time makes breakfast.',ref:'MH:23'}],
 onion:[{plan:'sugar',txt:'Raw onion and garlic go in the lunch salad.',ref:'MH:23'}],
 beans:[{plan:'sugar',txt:'Cooked green beans are part of the vegetable lunch.',ref:'MH:23',
  care:'Always cook green beans. Do not eat them raw.'}],
 lentils:[{plan:'sugar',txt:'Beans, peas and lentils with whole grains make a complete diet without meat.',ref:'MH:23'},
  {plan:'bmi',txt:'Beans or lentils with vegetables and a whole grain make a filling lunch.',ref:'MH:23'}],
 slaw:[{plan:'bmi',txt:'Plenty of vegetables at lunch; vegetables are one of the four foods the diet is built on.',ref:'MH:23'}],
 dates:[{plan:'sleep',txt:'Fruit, fresh or dried, makes a light early supper.',ref:'MH:23 · MH:25'}],
 crackers:[{plan:'sleep',txt:'Crackers and fruit are the light evening meal The Ministry of Healing suggests, when a third meal is eaten.',ref:'MH:25'}],
 nuts:[{plan:'mind',txt:'A few nuts with breakfast. Nuts can take the place of meat, but eat only a few.',ref:'MH:23'}],
 fruit:[{plan:'mind',txt:'Fruit is one of the four foods the diet is built on.',ref:'MH:23'},
  {plan:'sleep',txt:'Fruit makes a light early supper.',ref:'MH:25'}],
};

/* ---------------------------------------------------------------------------------------------------------
   DIRECTIVE PLAN: what the visitor must DO, WHY (the source's reason) and HOW (concrete steps), most important first.
   The plan screen shows the first 3; the rest appear under "When these feel easy, add". WhatsApp and the printed
   card carry the same 3. Every `why`/`how` restates the plan's own steps and facts above, with the same reference;
   nothing new is claimed. Optional per action:
     foods: food keys whose daily cost is shown       when(a): only for visitors it fits
     first(a): move to the top for this visitor      how items may be functions of the visitor (return '' to skip) */
const heavy=a=>{const b=bmi(a);return b!=null&&b>=25;};
const cholUp=a=>a.s.chol!=null&&a.s.chol>=5;
const PLAN_GOAL={bp:'Bring your blood pressure down',sugar:'Bring your blood sugar down',bmi:'Reach a healthy weight and cholesterol',
 sleep:'Sleep deeply again',mind:'Calm your mind'};
const ACTIONS={
 bp:[
  {do:'Cut right down on salt, from today',why:'Go easy on salt, pickles and spicy food, and eat plenty of fruit instead.',ref:'MH:23',
   how:['No salt in cooking or at the table','No stock cubes, soy sauce, MSG or salty processed food','Read labels: avoid sodium and preservatives']},
  {do:'Walk outdoors every day',why:'Lack of exercise is a common cause of disease; brisk walking in the open air works the whole body and fills the lungs.',ref:'MH:17',
   how:['In daylight, for example at 16:30','Start gently and build up slowly','Heart disease or several heart risks? See a doctor before hard exercise']},
  {do:'Eat a big raw-vegetable lunch every day',why:'Grains, fruit, nuts and vegetables, simply prepared, are the most healthful foods.',ref:'MH:23',
   foods:['garlic','celery','tomato'],how:['A big raw salad at lunch: garlic, celery and tomato','Unsalted potato soup, with the skin, is good too']},
  {do:'Drink plenty of plain water',why:'Water drunk freely helps the body do its work and resist disease.',ref:'MH:17',
   how:['A full glass as soon as you get up','Water through the day, not tea, coffee or sweet drinks']},
  {do:'Lose extra weight slowly',why:'Simple meals at set times, with nothing in between and a light early supper, bring weight down steadily.',ref:'MH:23',when:heavy,
   how:['No crash diets: steady, regular meals','A light, early supper']},
  {do:'Take slow, deep breaths after meals and before bed',why:'Deep breathing calms the nerves and brings sound sleep.',ref:'MH:20',
   how:['Sit upright, in loose clothing','Outdoors in fresh air if you can']},
  {do:'End the day with a neutral bath and an early night',why:'Neutral baths soothe the nerves, and Dr Kellogg advised one at bedtime for sound sleep.',ref:'MH:17 · K:395–396',
   how:['33–35°C for 15–30 minutes, never hot','Lights out by 22:00']}],
 sugar:[
  {do:'Cut out sugar and sweets, from today',why:'Far too much sugar is eaten; sweets, cakes and pastries are best left out.',ref:'MH:23',
   how:['No sugar in drinks, no sweets, cakes or cold drinks','Swap white bread for whole grains: brown rice, oats or whole maize meal','No coffee and no tobacco']},
  {do:'Walk briskly every day',why:'Exercise keeps the blood flowing freely, and a short walk after meals helps digestion.',ref:'MH:17',
   how:['A short walk after lunch','A brisk outdoor walk later in the day','Unfit? Start with a few minutes and add a little each day']},
  {do:'Eat at set times, with nothing in between',why:'Meals at set times, five or six hours apart with nothing in between, give digestion time to finish; and nothing late.',ref:'MH:23',
   how:['Breakfast, lunch and a small, early supper','Chew slowly and eat calmly','Nothing more to eat in the evening']},
  {do:'Build meals on whole grains, beans and vegetables',why:'Rice, maize, oats, beans, peas, lentils and vegetables, simply prepared, are good everyday staples.',ref:'MH:23',
   foods:['rice','lentils','onion','garlic','beans'],how:['Brown rice or whole maize meal porridge for breakfast','At lunch: raw onion and garlic in a salad, cooked green beans, and beans or lentils','Green beans always cooked, never raw']},
  {do:'Check both feet every evening',why:'With high blood sugar, small sores can become infected.',ref:'S',
   how:['Look for cuts, blisters or sores','Avoid very hot and very cold baths: a neutral bath (33–35°C) is the gentle choice']},
  {do:'Drink water through the day',why:'Water drunk freely helps the body do its work and resist disease.',ref:'MH:17',
   how:['Water, not juice or sweet drinks']}],
 bmi:[
  {do:'Make supper the lightest meal, and early',why:'Many people find two good meals a day better than three; a third meal should be light, and eating late disturbs sleep.',ref:'MH:23 · MH:25',
   foods:['oats'],how:['Breakfast: oats or another whole grain, with fruit and a few nuts','Supper early and light, or just fruit and a cracker','Nothing to eat before bed']},
  {do:'Cut out fried food and animal fat',why:'The oil in olives is far better than animal fat; keep butter to a minimum and leave cheese out.',ref:'MH:23',
   first:a=>cholUp(a)&&!heavy(a),how:['No meat fat, butter, cheese or fried food','Smaller meals: even simple food can be overeaten']},
  {do:'Stop snacking: only water between meals',why:'Eat at set times, and take nothing until the next meal.',ref:'MH:23',
   how:['Plenty of water through the day','No juice, cold drinks or coffee','Hungry between meals? Make the meals themselves more filling']},
  {do:'Walk outdoors every day',why:'Without exercise the body gets clogged and some people put on weight; walking in the open air is the best exercise.',ref:'MH:17',
   how:['Build up slowly, a little more each day','Heart disease? See a doctor first']},
  {do:'Fill up on vegetables',why:'Vegetables, with grains, fruit and nuts, are the foods the diet is built on.',ref:'MH:23',foods:['slaw'],
   how:['Raw cabbage and carrot salad, about 300 g a day']},
  {do:'Choose whole grains and beans, with little sugar',why:'Rice, maize, oats, beans and lentils are good staples, and far too much sugar is eaten.',ref:'MH:23',foods:['lentils'],
   how:['Rolled oats, brown rice, beans, lentils','No sugar, sweets or white bread']}],
 sleep:[
  {do:'Go to bed and get up at the same time every day',why:'A steady rhythm helps the body know when to sleep.',ref:'G',
   how:['In bed by 21:00–22:00, weekends too','Morning light and fresh air as soon as you are up']},
  {do:'No tea, coffee or tobacco, and a light early supper',why:'Stimulants bring sleeplessness, and eating late keeps the stomach working through the night.',ref:'MH:26 · MH:23',
   foods:['dates','crackers','fruit'],how:['No coffee, strong tea, cola or tobacco','Supper: fruit, or a few dates and whole-grain crackers','Nothing more to eat after supper']},
  {do:'Take a neutral bath just before bed',why:'Dr Kellogg counted the neutral bath, taken at bedtime, among the best remedies for sleeplessness.',ref:'K:383–384 · K:395–396',
   how:['33–35°C for 15–30 minutes, never hot','Skip very hot baths with diabetes or heart trouble']},
  {do:'Breathe deeply in fresh air before bed',why:'Full, deep breathing calms the nerves and brings sound, refreshing sleep.',ref:'MH:20',
   how:['Sit upright, in loose clothing','A few minutes by an open window']},
  {do:'Keep the bedroom aired and sunlit',why:'Bedrooms need fresh air day and night, and should be opened to the sunshine every day.',ref:'MH:20',
   how:['Open the window a little at night','Open curtains and windows every morning']},
  {do:'Walk or work outdoors every day',why:'Daily exercise, outdoors where possible, strengthens the whole body.',ref:'MH:17',
   how:['Late afternoon is a good time']},
  {do:'End the day thankful',why:'A cheerful, thankful mind is good for the body; worry wears it down.',ref:'MH:18',
   how:['Set the day’s worries aside','A short prayer of thanks']},
  {do:'A cup of calming herb tea in the evening',why:'Catnip, linden flower and hops teas were used to calm restlessness and bring on sleep, and chamomile to calm nervous irritability.',ref:'KD:Nepeta · KD:Tilia · KD:Humulus · GR:Hops · KD:Matricaria',
   how:['One cup, warm and unsweetened','The old herbals used about 15 g of chamomile or hops, or 30 g of catnip, to half a litre of boiling water','Taking sleeping or anxiety pills, pregnant or breastfeeding? Ask your clinic before hops']}],
 mind:[
  {do:'Get outside every day: morning light and a walk',why:'Time outdoors among trees, flowers and fresh air, with exercise, is one of nature’s best remedies.',ref:'MH:19 · MH:17',
   how:['Morning light as soon as you are up','Walk, garden or do useful work outdoors']},
  {do:'Write down three good things each evening',why:'Nothing does more for health than a thankful spirit, and speaking of good things makes joy grow.',ref:'MH:18',
   how:['Evening, 5 minutes: three good things from today','Thank God for each one','Read them out loud']},
  {do:'Do one kind thing for someone every day',why:'Thinking of others, and helping those in need, brings healing to the helper too.',ref:'MH:18',
   how:['Call or visit a friend, neighbour or family member','Join a church or community project']},
  {do:'Take slow, deep breaths after meals and before bed',why:'Deep breathing of fresh air calms the nerves.',ref:'MH:20',
   how:['Sit upright, in loose clothing, in fresh air']},
  {do:'Sing, even when you do not feel like it',why:'Singing is a help that is always at hand against discouragement.',ref:'MH:18',
   how:['A hymn in the morning or evening','Calm music instead of TV before bed']},
  {do:'Drink water from the moment you wake',why:'Water drunk freely helps the body do its work.',ref:'MH:17',how:['A glass as soon as you are up','Plenty through the day']},
  {do:'A simple plant breakfast, eaten calmly',why:'Grains, fruit and nuts make a good meal, eaten slowly and with thanks.',ref:'MH:23',foods:['oats','nuts','fruit'],
   how:['Oats with fruit and a few nuts']},
  {do:'A cup of chamomile or linden tea in a quiet moment',why:'Chamomile was used to calm nervous irritability and restlessness, and linden flowers to ease restlessness.',ref:'KD:Matricaria · KD:Tilia',
   how:['Warm and unsweetened, sitting down','The old herbal used about 15 g of chamomile flowers to half a litre of boiling water','Allergic to ragweed? Choose linden instead']}],
};
/* When to check again: the step that closes the 21 days. */
const RECHECK={bp:['Have your blood pressure checked again in 3 weeks, at a clinic or pharmacy.','S'],
 sugar:['Have your blood sugar checked again in 3 weeks, at your clinic.',''],
 bmi:['Check your weight again in 3 weeks, on the same scale.',''],
 sleep:['Write down your hours of sleep each night for the 3 weeks.',''],
 mind:['Low mood or worry lasting more than 2 weeks, or stopping you working or sleeping? See your clinic.','']};

const HUES=['mint','sky','lilac','sage','blush','sand','aqua','peach'];
const hueOf=id=>HUES[[...String(id)].reduce((t,c)=>t+c.charCodeAt(0),0)%HUES.length];
const HUE_P={bp:'blush',sugar:'sand',bmi:'sky',sleep:'lilac',mind:'aqua'};
/* "MH:23" → "Ministry of Healing ch. 23"; "K:395–396" → "Kellogg pp. 395–396"; "KD:Tilia" → "King’s Dispensatory: Tilia";
   "GR:Hops" → "Grieve: Hops"; "G" / "S" → what the line rests on */
const REF_TAG={G:'general advice',S:'expo safety rule'};
function refLabel(pg){
 return String(pg).split(' · ').map(x=>{
  if(REF_TAG[x])return REF_TAG[x];
  const h=x.match(/^(KD|GR):(.+)$/);if(h)return (h[1]==='KD'?'King’s Dispensatory: ':'Grieve: ')+h[2];
  const k=x.match(/^K:(.+)$/);if(k)return (/[–-]/.test(k[1])?'Kellogg pp. ':'Kellogg p. ')+k[1];
  const m=x.match(/^MH:(.+)$/);return m?'Ministry of Healing ch. '+m[1]:x;}).join(' · ');
}
/* which books a plan actually draws on, so the credit line only names those */
function planBooks(p,extra){
 const refs=[...p.steps.map(s=>s[2]),...p.facts.map(f=>f[1]),...(extra||[])].join(' · ');
 const out=[];
 if(/(^|\s)MH:/.test(refs))out.push(BOOK_REF);
 if(/(^|\s)K:/.test(refs))out.push(BOOK2_REF);
 if(/(^|\s)KD:/.test(refs))out.push(BOOK3_REF);
 if(/(^|\s)GR:/.test(refs))out.push(BOOK4_REF);
 return out;
}
const planCredit=p=>planBooks(p).join('; ');
```

Replace with:

```html
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
const BOOK_REF='The Ministry of Healing (Ellen G. White, 1905)';
const BOOK2_REF='Counsels on Diet and Foods (Ellen G. White, compiled 1938)';
const BOOK3_REF='Healthful Living (Ellen G. White, compiled 1897)';
const BOOK4_REF='The Place of Herbs in Rational Therapy (Ellen G. White, compiled 1931)';
const HELP_LINE='If you feel hopeless, or have thoughts of harming yourself, tell someone you trust today and call the SADAG suicide crisis line (0800 567 567) or Lifeline (0861 322 322), or go to the nearest clinic or emergency service. Do not wait.';
/* shopping-list entries shared by several plans (prices from prices/prices.csv, written by tools/update-prices.js) */
const ITEM_FLAX={name:'Ground flaxseed',dose:'1–2 tbsp',store:'R150–R160 per kg (median R150) at Checkers, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:2.25};
const ITEM_FRUIT={name:'Seasonal fruit (bananas, berries)',dose:'1–2 servings',store:'R33–R38 per kg (median R35) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:6.92};
const ITEM_DATES={name:'Figs or dates',dose:'2–3 pieces',store:'R82–R111 per kg (median R96) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths — priced as dates; no dried figs were found priced online (checked 19 Oct 2026)',daily:2.40};
const ITEM_NUTS={name:'Walnuts or mixed nuts',dose:'1 small handful (30g)',store:'R430–R520 per kg (median R450) at Checkers, Game, Makro, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:13.49};
const ITEM_LENTILS={name:'Brown lentils / beans',dose:'½ cup cooked',store:'R49–R68 per kg (median R52) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.34};
const ITEM_SLAW={name:'Cabbage & carrots (raw salad)',dose:'300g a day',store:'Carrots R15–R17 per kg (median R15), cabbage R16–R25 a head (median R17) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:3.95};
const ITEM_TOMATO={name:'Tomatoes',dose:'2 medium',store:'R24–R35 per kg (median R33) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.95};
const HOT_BATH_CARE='Never a hot bath with high blood pressure, heart trouble or diabetes, and test the water with your elbow if your feet have lost feeling.';
const PROTOCOLS={
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
const FOOD_WHY={
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
const heavy=a=>{const b=bmi(a);return b!=null&&b>=25;};
const cholUp=a=>a.s.chol!=null&&a.s.chol>=5;
const PLAN_GOAL={bp:'Bring your blood pressure down',sugar:'Bring your blood sugar down',bmi:'Reach a healthy weight and cholesterol',
 thin:'Reach a healthy weight',veg:'Eat more fruit and vegetables',move:'Move more every day',water:'Drink enough water',
 sleep:'Sleep deeply again',mind:'Calm your mind'};
const ACTIONS={
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
const RECHECK={bp:['Have your blood pressure checked again in 3 weeks, at a clinic or pharmacy.','S'],
 sugar:['Have your blood sugar checked again in 3 weeks, at your clinic.',''],
 bmi:['Check your weight again in 3 weeks, on the same scale.',''],
 thin:['Check your weight again in 3 weeks, on the same scale.',''],
 veg:['Count your servings of fruit and vegetables each day for the 3 weeks.',''],
 move:['Write down your walking minutes each day for the 3 weeks.',''],
 water:['Count your glasses of water each day for the 3 weeks.',''],
 sleep:['Write down your hours of sleep each night for the 3 weeks.',''],
 mind:['Low mood or worry lasting more than 2 weeks, or stopping you working or sleeping? See your clinic.','']};

const HUES=['mint','sky','lilac','sage','blush','sand','aqua','peach'];
const hueOf=id=>HUES[[...String(id)].reduce((t,c)=>t+c.charCodeAt(0),0)%HUES.length];
const HUE_P={bp:'blush',sugar:'sand',bmi:'sky',thin:'peach',veg:'sage',move:'mint',water:'aqua',sleep:'lilac',mind:'aqua'};
/* "MH:23" → "Ministry of Healing ch. 23"; "CD:731" → "Counsels on Diet §731"; "HL:571" → "Healthful Living §571";
   "PH:6" → "Place of Herbs p. 6"; "G" / "S" → what the line rests on */
const REF_TAG={G:'general advice',S:'expo safety rule'};
const REF_BOOK={MH:'Ministry of Healing ch. ',CD:'Counsels on Diet §',HL:'Healthful Living §',PH:'Place of Herbs p. '};
function refLabel(pg){
 return String(pg).split(' · ').map(x=>{
  if(REF_TAG[x])return REF_TAG[x];
  const m=x.match(/^(MH|CD|HL|PH):(.+)$/);return m?REF_BOOK[m[1]]+m[2]:x;}).join(' · ');
}
/* which books a plan actually draws on, so the credit line only names those */
function planBooks(p,extra){
 const refs=[...p.steps.map(s=>s[2]),...p.facts.map(f=>f[1]),...(extra||[])].join(' · ');
 const out=[];
 if(/(^|\s)MH:/.test(refs))out.push(BOOK_REF);
 if(/(^|\s)CD:/.test(refs))out.push(BOOK2_REF);
 if(/(^|\s)HL:/.test(refs))out.push(BOOK3_REF);
 if(/(^|\s)PH:/.test(refs))out.push(BOOK4_REF);
 return out;
}
const planCredit=p=>planBooks(p).join('; ');
```

### U1 harness section 21 on Ellen White sources and nine plans  (`.smoke/harness.js`, serves F5)

Why: checks the nine plans, the Ellen White reference forms and the passages read, that most lines cite her, that no other author is named, and keeps the herb, bath, medicine and help-line checks

Find (exactly once):

```js
  /* ---- 21. plans built from public-domain Adventist books ------------- */
  console.log('\n21. Book-based plans');
  const PL = g.PROTOCOLS;
  const PART = '(?:MH:\\d{1,2}|K:\\d{3}(?:[–-]\\d{3})?|KD:[A-Z][a-z]+|GR:[A-Z][a-z]+|G|S)', PAGE = new RegExp('^' + PART + '(?: · ' + PART + ')*$');
  const plans = Object.keys(PL);
  ok('all five plans are there (blood pressure, sugar, weight & cholesterol, sleep, stress & mood)', ['bp', 'sugar', 'bmi', 'sleep', 'mind'].every(k => PL[k]) && plans.length === 5, plans.join());
  ok('every plan names its book chapters and pages', plans.every(k => /(pp?\. \d{3}|chs?\. \d)/.test(PL[k].src)), plans.map(k => PL[k].src).join(' | '));
  ok('every step has a time, text and a page in the book', plans.every(k => PL[k].steps.length >= 5 && PL[k].steps.every(([t, txt, pg]) => /^\d\d:\d\d$/.test(t) && txt.length > 20 && PAGE.test(pg))));
  ok('every plan has a list of what the book advises, each with a page', plans.every(k => PL[k].facts.length >= 8 && PL[k].facts.every(([txt, pg]) => txt.length > 20 && PAGE.test(pg))));
  ok('every plan has three habits for the message and card', plans.every(k => PL[k].habits.length === 3));
  ok('every plan has a safety note and priced items', plans.every(k => PL[k].note.length > 20 && PL[k].items.length >= 3 && PL[k].items.every(i => i.daily > 0 && i.store && i.dose && /checked \d+ \w+ \d{4}/.test(i.store))));
  const allRefs = k => [...PL[k].steps.map(s => s[2]), ...PL[k].facts.map(f => f[1])].join(' · ').split(' · ');
  const everyRef = [...plans.flatMap(allRefs), ...plans.flatMap(k => g.ACTIONS[k].map(x => x.ref)), ...Object.values(g.FOOD_WHY).flat().map(w => w.ref)].join(' · ').split(' · ');
  ok('every reference in the plans, actions and foods is a Ministry of Healing chapter, a Kellogg page, general advice or an expo safety rule',
    everyRef.every(r => PAGE.test(r)), everyRef.filter(r => !PAGE.test(r)).join());
  ok('cited Ministry of Healing chapters are its health chapters (8, 17–20, 23–26)',
    everyRef.filter(r => r.startsWith('MH:')).every(r => [8, 17, 18, 19, 20, 23, 24, 25, 26].includes(+r.slice(3))), everyRef.filter(r => r.startsWith('MH:')).join());
  ok('cited Kellogg pages are the pages checked for these plans (197, 372, 377, 383–384, 395–396)',
    everyRef.filter(r => r.startsWith('K:')).every(r => ['197', '372', '377', '383–384', '395–396'].includes(r.slice(2))), everyRef.filter(r => r.startsWith('K:')).join());
  ok('"general advice" lines (no book) appear only in the sleep plan',
    plans.filter(k => k !== 'sleep').every(k => !allRefs(k).some(r => r === 'G') && !g.ACTIONS[k].some(x => x.ref.split(' · ').includes('G'))));
  const oldBooks = /Nedley|Encyclopedia|Harvestime|Ferrell|Cherne|Pamplona|Lost Art of Thinking/i;
  ok('nothing in the plans, actions or foods names the old books',
    !oldBooks.test(JSON.stringify(PL) + JSON.stringify(g.ACTIONS) + JSON.stringify(g.FOOD_WHY) + g.BOOK_REF + g.BOOK2_REF));
  const herbRefs = everyRef.filter(r => /^(KD|GR):/.test(r));
  ok('cited herbal entries are the ones checked (King’s: Matricaria, Tilia, Nepeta, Humulus; Grieve: Hops)',
    herbRefs.length > 0 && herbRefs.every(r => ['KD:Matricaria', 'KD:Tilia', 'KD:Nepeta', 'KD:Humulus', 'GR:Hops'].includes(r)), herbRefs.join());
  const planText = k => JSON.stringify(PL[k]) + JSON.stringify(g.ACTIONS[k]);
  ok('herb teas: only chamomile, linden flower, catnip and hops, with hops in the sleep plan only',
    plans.every(k => !/valerian|passion ?flower|skullcap|scullcap|lemon balm|hawthorn|kava/i.test(planText(k))) && ['bp', 'sugar', 'bmi', 'mind'].every(k => !/hops/i.test(planText(k)))
    && ['catnip', 'linden', 'hops', 'chamomile'].every(w => new RegExp(w, 'i').test(planText('sleep'))) && ['chamomile', 'linden'].every(w => new RegExp(w, 'i').test(planText('mind'))));
  ok('every herb tea comes with its hazard note',
    /sleeping or anxiety pills/.test(PL.sleep.note) && /catnip tea in pregnancy/.test(PL.sleep.note) && /ragweed/.test(PL.sleep.note) && /fresh linden/.test(PL.sleep.note)
    && /ragweed/.test(PL.mind.note) && /fresh linden/.test(PL.mind.note));
  ok('herb teas are water teas, never tinctures, extracts or capsules', !/tincture|extract|capsule/i.test(JSON.stringify(PL) + JSON.stringify(g.ACTIONS)));
  const oldWords = /hibiscus|beetroot|stock cube|Aromat|apple-cider|cinnamon|pumpkin seed|oat milk/i;
  ok('the old, non-book content is gone from the plans', !oldWords.test(JSON.stringify(PL)), (JSON.stringify(PL).match(oldWords) || [])[0]);
  ok('no plan tells people to take a HOT foot bath, and the hot-bath cautions stay (Kellogg pp. 197, 372, 377)',
    plans.every(k => !PL[k].steps.some(s => /foot bath/i.test(s[1]))) && /never a hot bath/i.test(PL.bp.hydro) && /extremes/i.test(PL.sugar.hydro));
  ok('every bath named in a plan is the neutral bath (33–35°C, Kellogg p. 395)', plans.filter(k => PL[k].hydro).every(k => /33–35°C/.test(PL[k].hydro)));
  ok('no plan recommends high-dose supplements or fasting', !/\bmg\b|fast(ing)? (one|two|1|2) days|poke root|cayenne|senna/i.test(JSON.stringify(PL.bp.steps) + JSON.stringify(PL.sleep.steps) + JSON.stringify(PL.sugar.steps)));
  ok('no plan tells anyone to stop medicine', plans.every(k => !/stop (taking )?(your )?(pills|medic)/i.test(PL[k].steps.map(s => s[1]).join(' '))) && plans.every(k => /clinic|doctor/i.test(PL[k].note) || k === 'bmi'));
  ok('The Ministry of Healing is credited in full, as public domain', /The Ministry of Healing/.test(g.BOOK_REF) && /Ellen G\. White/.test(g.BOOK_REF) && /1905/.test(g.BOOK_REF) && /public domain/.test(g.BOOK_REF));
  ok('Rational Hydrotherapy is credited in full, as public domain', /Rational Hydrotherapy/.test(g.BOOK2_REF) && /Kellogg/.test(g.BOOK2_REF) && /1901/.test(g.BOOK2_REF) && /public domain/.test(g.BOOK2_REF));
  ok('the two herbals are credited: King’s (1898, public domain) and Grieve (1931)', /King’s American Dispensatory/.test(g.BOOK3_REF) && /1898/.test(g.BOOK3_REF) && /public domain/.test(g.BOOK3_REF)
    && /A Modern Herbal/.test(g.BOOK4_REF) && /Grieve/.test(g.BOOK4_REF) && /1931/.test(g.BOOK4_REF));
  ok('reference labels read naturally', g.refLabel('MH:23') === 'Ministry of Healing ch. 23' && g.refLabel('K:377') === 'Kellogg p. 377' && g.refLabel('K:395–396') === 'Kellogg pp. 395–396'
    && g.refLabel('S') === 'expo safety rule' && g.refLabel('G · MH:20') === 'general advice · Ministry of Healing ch. 20'
    && g.refLabel('KD:Tilia') === 'King’s Dispensatory: Tilia' && g.refLabel('GR:Hops') === 'Grieve: Hops');
  ok('every plan credits the books it really uses', plans.every(k => g.planBooks(PL[k]).length >= 1) && g.planBooks(PL.bp).length === 2 && g.planBooks(PL.bmi).length === 1 && g.planBooks(PL.sleep).length === 4 && g.planBooks(PL.mind).length === 3
    && g.planCredit(PL.sleep).includes('The Ministry of Healing') && g.planCredit(PL.sleep).includes('Rational Hydrotherapy'));
  ok('the stress & mood plan rests on gratitude, kindness, song and time outdoors, not on thinking traps',
    ['thankful spirit', 'helping those in need', 'Singing', 'Time outdoors'].every(w => PL.mind.facts.some(([t]) => t.includes(w))) && !/Thinking trap/.test(JSON.stringify(PL.mind)));
```

Replace with:

```js
  /* ---- 21. plans built on Ellen White's health writings ----------------- */
  console.log('\n21. Book-based plans');
  const PL = g.PROTOCOLS;
  const PART = '(?:MH:\\d{1,2}|CD:\\d{1,3}|HL:\\d{1,3}|PH:\\d{1,2}|G|S)', PAGE = new RegExp('^' + PART + '(?: · ' + PART + ')*$');
  const plans = Object.keys(PL);
  ok('all nine plans are there (blood pressure, sugar, weight & cholesterol, underweight, fruit & veg, exercise, water, sleep, stress & mood)',
    ['bp', 'sugar', 'bmi', 'thin', 'veg', 'move', 'water', 'sleep', 'mind'].every(k => PL[k]) && plans.length === 9, plans.join());
  ok('every plan names its book chapters and pages', plans.every(k => /(chs?\. \d|§)/.test(PL[k].src)), plans.map(k => PL[k].src).join(' | '));
  ok('every step has a time, text and a page in the book', plans.every(k => PL[k].steps.length >= 5 && PL[k].steps.every(([t, txt, pg]) => /^\d\d:\d\d$/.test(t) && txt.length > 20 && PAGE.test(pg))));
  ok('every plan has a list of what the book advises, each with a page', plans.every(k => PL[k].facts.length >= 8 && PL[k].facts.every(([txt, pg]) => txt.length > 20 && PAGE.test(pg))));
  ok('every plan has three habits for the message and card', plans.every(k => PL[k].habits.length === 3));
  ok('every plan has a safety note, and every food plan has priced items (exercise and water have none)',
    plans.every(k => PL[k].note.length > 20) && plans.every(k => ['move', 'water'].includes(k) ? PL[k].items.length === 0
      : PL[k].items.length >= 3 && PL[k].items.every(i => i.daily > 0 && i.store && i.dose && /checked \d+ \w+ \d{4}/.test(i.store))));
  const allRefs = k => [...PL[k].steps.map(s => s[2]), ...PL[k].facts.map(f => f[1])].join(' · ').split(' · ');
  const everyRef = [...plans.flatMap(allRefs), ...plans.flatMap(k => g.ACTIONS[k].map(x => x.ref)), ...Object.values(g.FOOD_WHY).flat().map(w => w.ref)].join(' · ').split(' · ');
  ok('every reference in the plans, actions and foods is an Ellen White book, general advice or an expo safety rule',
    everyRef.every(r => PAGE.test(r)), everyRef.filter(r => !PAGE.test(r)).join());
  ok('cited Ministry of Healing chapters are its health chapters (8, 17–20, 23–26)',
    everyRef.filter(r => r.startsWith('MH:')).every(r => [8, 17, 18, 19, 20, 23, 24, 25, 26].includes(+r.slice(3))), everyRef.filter(r => r.startsWith('MH:')).join());
  const CD_READ = [111, 137, 138, 146, 168, 191, 201, 245, 267, 268, 269, 270, 320, 326, 464, 475, 504, 509, 514, 518, 726, 727, 728, 731];
  const HL_READ = [185, 189, 313, 570, 571, 578, 618, 717, 780, 786];
  ok('cited Counsels on Diet, Healthful Living and Place of Herbs passages are the ones checked',
    everyRef.filter(r => /^(CD|HL|PH):/.test(r)).every(r => r.startsWith('CD:') ? CD_READ.includes(+r.slice(3)) : r.startsWith('HL:') ? HL_READ.includes(+r.slice(3)) : r === 'PH:6'),
    everyRef.filter(r => /^(CD|HL|PH):/.test(r)).join());
  ok('every plan cites Ellen White in most of its steps and facts',
    plans.every(k => { const lines = [...PL[k].steps.map(s => s[2]), ...PL[k].facts.map(f => f[1])]; return lines.filter(r => /(MH|CD|HL|PH):/.test(r)).length * 2 > lines.length; }),
    plans.map(k => k + ':' + [...PL[k].steps.map(s => s[2]), ...PL[k].facts.map(f => f[1])].filter(r => /(MH|CD|HL|PH):/.test(r)).length).join());
  const otherBooks = /Nedley|Encyclopedia|Harvestime|Ferrell|Cherne|Pamplona|Lost Art of Thinking|Kellogg|Rational Hydrotherapy|King’s|Dispensatory|Grieve|Modern Herbal/i;
  ok('nothing in the plans, actions, foods or credits names an author other than Ellen White',
    !otherBooks.test(JSON.stringify(PL) + JSON.stringify(g.ACTIONS) + JSON.stringify(g.FOOD_WHY) + g.BOOK_REF + g.BOOK2_REF + g.BOOK3_REF + g.BOOK4_REF));
  const planText = k => JSON.stringify(PL[k]) + JSON.stringify(g.ACTIONS[k]);
  ok('herb teas: only chamomile, linden flower, catnip and hops, with hops in the sleep plan only',
    plans.every(k => !/valerian|passion ?flower|skullcap|scullcap|lemon balm|hawthorn|kava/i.test(planText(k))) && plans.filter(k => k !== 'sleep').every(k => !/hops/i.test(planText(k)))
    && ['catnip', 'linden', 'hops', 'chamomile'].every(w => new RegExp(w, 'i').test(planText('sleep'))) && ['chamomile', 'linden'].every(w => new RegExp(w, 'i').test(planText('mind'))));
  ok('hop and catnip tea cite Ellen White’s letter (Place of Herbs p. 6)', PL.sleep.facts.some(([t, r]) => /Hop tea/.test(t) && /catnip/.test(t) && r === 'PH:6'));
  ok('every herb tea comes with its hazard note',
    /sleeping or anxiety pills/.test(PL.sleep.note) && /catnip tea in pregnancy/.test(PL.sleep.note) && /ragweed/.test(PL.sleep.note) && /fresh linden/.test(PL.sleep.note)
    && /ragweed/.test(PL.mind.note) && /fresh linden/.test(PL.mind.note));
  ok('herb teas are water teas, never tinctures, extracts or capsules', !/tincture|extract|capsule/i.test(JSON.stringify(PL) + JSON.stringify(g.ACTIONS)));
  const oldWords = /hibiscus|beetroot|stock cube|Aromat|apple-cider|cinnamon|pumpkin seed|oat milk/i;
  ok('the old, non-book content is gone from the plans', !oldWords.test(JSON.stringify(PL)), (JSON.stringify(PL).match(oldWords) || [])[0]);
  ok('no plan tells people to take a HOT foot bath, and the hot-bath cautions stay',
    plans.every(k => !PL[k].steps.some(s => /foot bath/i.test(s[1]))) && /never a hot bath/i.test(PL.bp.hydro) && /extremes/i.test(PL.sugar.hydro));
  ok('every bath named in a plan is the warm, neutral bath (33–35°C)', plans.filter(k => PL[k].hydro).every(k => /33–35°C/.test(PL[k].hydro)));
  ok('no plan recommends high-dose supplements or fasting', !/\bmg\b|fast(ing)? (one|two|1|2) days|poke root|cayenne|senna/i.test(plans.map(k => JSON.stringify(PL[k].steps)).join('')));
  ok('no plan tells anyone to stop medicine', plans.every(k => !/stop (taking )?(your )?(pills|medic)/i.test(PL[k].steps.map(s => s[1]).join(' '))) && plans.every(k => /clinic|doctor/i.test(PL[k].note) || k === 'bmi'));
  ok('every credit is an Ellen White book', [g.BOOK_REF, g.BOOK2_REF, g.BOOK3_REF, g.BOOK4_REF].every(b => /Ellen G\. White/.test(b))
    && /The Ministry of Healing/.test(g.BOOK_REF) && /Counsels on Diet and Foods/.test(g.BOOK2_REF) && /Healthful Living/.test(g.BOOK3_REF) && /The Place of Herbs in Rational Therapy/.test(g.BOOK4_REF));
  ok('reference labels read naturally', g.refLabel('MH:23') === 'Ministry of Healing ch. 23' && g.refLabel('CD:731') === 'Counsels on Diet §731' && g.refLabel('HL:571') === 'Healthful Living §571'
    && g.refLabel('PH:6') === 'Place of Herbs p. 6' && g.refLabel('S') === 'expo safety rule' && g.refLabel('G · MH:20') === 'general advice · Ministry of Healing ch. 20');
  ok('every plan credits the books it really uses', plans.every(k => g.planBooks(PL[k]).length >= 1) && g.planBooks(PL.veg).length === 1 && g.planBooks(PL.sleep).length === 4
    && g.planCredit(PL.sleep).includes('The Ministry of Healing') && g.planCredit(PL.sleep).includes('The Place of Herbs'));
  ok('the stress & mood plan rests on gratitude, kindness, song, time outdoors and a thought check',
    ['thankful spirit', 'Helping others', 'Singing', 'Time outdoors', 'thinking traps'].every(w => PL.mind.facts.some(([t]) => t.includes(w))));
```

### A2  (`index.html`, serves F2)

Why: bath slider cited Kellogg; now Ellen White

Find (exactly once):

```html
'A neutral bath (33–35°C, never hot) before bed and lights out before 22:00 (Kellogg pp. 395–396).'
```

Replace with:

```html
'A warm, neutral bath (33–35°C, never hot) before bed and lights out before 22:00 (Ministry of Healing ch. 17).'
```

### A3  (`index.html`, serves F2)

Why: Results credit line names Ellen White, and skips the food cost when the plan has no shopping list

Find (exactly once):

```html
The plans draw, in our own words, on ${BOOK_REF} and ${BOOK2_REF}. The full plan’s food costs about ${money(costOf(pk))} a day (store prices checked ${PRICE_DATE}; they change and vary by branch).</p>
```

Replace with:

```html
The plans draw, in our own words, on the health writings of Ellen G. White.${costOf(pk)?` The full plan’s food costs about ${money(costOf(pk))} a day (store prices checked ${PRICE_DATE}; they change and vary by branch).`:''}</p>
```

### A4  (`index.html`, serves F3)

Why: planNeeds comment: there are nine plans now

Find (exactly once):

```html
/* Which of the four plans this person's numbers point to, most urgent first, with the reason in plain words. */
```

Replace with:

```html
/* Which plans this person's numbers point to, most urgent first, with the reason in plain words. */
```

### A5  (`index.html`, serves F3)

Why: an underweight reading now gets its own plan

Find (exactly once):

```html
 if(why.length)out.push({k:'bmi',sev:Math.max(heavy?sev(bm[0])||2:0,sev(ch[0])),rank:4,why:why.join('; ')});
```

Replace with:

```html
 if(why.length)out.push({k:'bmi',sev:Math.max(heavy?sev(bm[0])||2:0,sev(ch[0])),rank:4,why:why.join('; ')});
 if(b!=null&&b<18.5)out.push({k:'thin',sev:sev(bm[0])||2,rank:4.2,why:`BMI ${fmt1(b)} is below the healthy range`});
```

### A6  (`index.html`, serves F3)

Why: low fruit & veg, exercise and water readings now get their own plans, after the medical ones

Find (exactly once):

```html
 return out.sort((x,y)=>x.rank-y.rank);
```

Replace with:

```html
 /* the habit checks, after every medical flag */
 const vg=cat('veg',a.s.veg),wk=cat('walk',a.s.walk),wt=cat('water',a.s.water);
 if(sev(vg[0]))out.push({k:'veg',sev:sev(vg[0]),rank:6,why:`${a.s.veg} servings of fruit and vegetables a day; the goal is 5 or more`});
 if(sev(wk[0]))out.push({k:'move',sev:sev(wk[0]),rank:6.5,why:`${a.s.walk} minutes of exercise a day; the goal is 30`});
 if(sev(wt[0]))out.push({k:'water',sev:sev(wt[0]),rank:7,why:`${a.s.water} glasses of water a day; the goal is 8`});
 return out.sort((x,y)=>x.rank-y.rank);
```

### A7  (`index.html`, serves F3)

Why: the problem line for the four new plans

Find (exactly once):

```html
 if(pk==='mind'&&a.interests&&a.interests.stress)return 'You asked for help with stress and worry.';
```

Replace with:

```html
 if(pk==='mind'&&a.interests&&a.interests.stress)return 'You asked for help with stress and worry.';
 if(pk==='thin'&&bmi(a)!=null&&bmi(a)<18.5)return `BMI ${fmt1(bmi(a))}: underweight. Healthy is 18.5–25.`;
 if(pk==='veg'&&s.veg!=null&&s.veg<5)return `Fruit and vegetables: ${s.veg} servings a day. The goal is 5 or more.`;
 if(pk==='move'&&s.walk!=null&&s.walk<30)return `Exercise: ${s.walk} minutes a day. The goal is 30.`;
 if(pk==='water'&&s.water!=null&&s.water<8)return `Water: ${s.water} glasses a day. The goal is 8.`;
```

### A8  (`index.html`, serves F4)

Why: the food button only appears when the plan has a shopping list (open)

Find (exactly once):

```html
  <button class="pl-food" onclick="openFood()">
```

Replace with:

```html
  ${p.items.length?`<button class="pl-food" onclick="openFood()">
```

### A9  (`index.html`, serves F4)

Why: the food button only appears when the plan has a shopping list (close)

Find (exactly once):

```html
What each food costs, and why it is in the plan.</span></span><span aria-hidden="true">→</span></button>
```

Replace with:

```html
What each food costs, and why it is in the plan.</span></span><span aria-hidden="true">→</span></button>`:''}
```

### A10  (`index.html`, serves F4)

Why: the Food screen opens on all foods when the current plan has none

Find (exactly once):

```html
 state.food={open:true,plan:state.protocol||'bp',metric:(state.food&&state.food.metric)||'day'};
```

Replace with:

```html
 const pk=state.protocol&&PROTOCOLS[state.protocol]&&PROTOCOLS[state.protocol].items.length?state.protocol:'all';
 state.food={open:true,plan:pk,metric:(state.food&&state.food.metric)||'day'};
```

### A11  (`index.html`, serves F4)

Why: the Food screen offers a filter only for plans that have foods

Find (exactly once):

```html
    ${Object.keys(PROTOCOLS).map(k=>`<button class="fd-chip
```

Replace with:

```html
    ${Object.keys(PROTOCOLS).filter(k=>PROTOCOLS[k].items.length).map(k=>`<button class="fd-chip
```

### A12  (`index.html`, serves F4)

Why: the WhatsApp preview leaves out an empty shopping list

Find (exactly once):

```html
  <div class="mt-3 rounded-[14px] border border-amber-200/70 bg-amber-50/80 p-2.5 text-[10px] leading-relaxed text-amber-900">
   <b>Shopping list (store prices checked ${PRICE_DATE}; may vary by branch):</b> ${p.items.map(it=>`${it.name} (${it.dose})`).join('; ')}.
  </div>
```

Replace with:

```html
  ${p.items.length?`<div class="mt-3 rounded-[14px] border border-amber-200/70 bg-amber-50/80 p-2.5 text-[10px] leading-relaxed text-amber-900">
   <b>Shopping list (store prices checked ${PRICE_DATE}; may vary by branch):</b> ${p.items.map(it=>`${it.name} (${it.dose})`).join('; ')}.
  </div>`:''}
```

### A13  (`index.html`, serves F4)

Why: the WhatsApp message leaves out an empty shopping list

Find (exactly once):

```html
  `Food for this plan: about ${money(costOf(pk))} a day.`,
  '',
  `Shopping list (store prices checked ${PRICE_DATE}; may vary by branch): ${p.items.map(it=>`${it.name} (${it.dose})`).join('; ')}.`,
  '',
```

Replace with:

```html
  ...(p.items.length?[`Food for this plan: about ${money(costOf(pk))} a day.`,'',
   `Shopping list (store prices checked ${PRICE_DATE}; may vary by branch): ${p.items.map(it=>`${it.name} (${it.dose})`).join('; ')}.`,'']:[]),
```

### A14  (`index.html`, serves F4)

Why: the printed card leaves out an empty shopping list

Find (exactly once):

```html
   ${p.help?'':`<div class="pc-line">🛒
```

Replace with:

```html
   ${p.help||!p.items.length?'':`<div class="pc-line">🛒
```

### A15  (`index.html`, serves F1)

Why: the source footer explains the Ellen White reference forms

Find (exactly once):

```html
“Ministry of Healing ch.” = a chapter of The Ministry of Healing; “Kellogg p.” = a printed page of Rational Hydrotherapy. The advice is in our own words. “King’s Dispensatory” = an entry of King’s American Dispensatory (1898); “Grieve” = an entry of A Modern Herbal (1931). Lines marked “general advice” or “expo safety rule”, and the herb hazard notes, come from no book.</p>
```

Replace with:

```html
All books are by Ellen G. White. “Ministry of Healing ch.” = a chapter of The Ministry of Healing; “Counsels on Diet §” and “Healthful Living §” = a numbered paragraph of those books; “Place of Herbs p.” = a page of The Place of Herbs in Rational Therapy. The advice is in our own words. Lines marked “general advice” or “expo safety rule”, and the herb hazard notes, rest on no book.</p>
```

### A16  (`index.html`, serves F4)

Why: the Food screen footer credits Ellen White's books

Find (exactly once):

```html
Why each food — in our own words, from ${esc(BOOK_REF)} (“Ministry of Healing ch.”).</p>
```

Replace with:

```html
Why each food — in our own words, from the health writings of Ellen G. White, or marked “general advice”.</p>
```

### U2  (`.smoke/harness.js`, serves F5)

Why: the new plans are chosen from their readings

Find (exactly once):

```js
  ok('an underweight person is NOT given the weight-loss plan', g.autoProtocol(thin) !== 'bmi' && !g.planNeeds(thin).some(n => n.k === 'bmi'), g.autoProtocol(thin));
```

Replace with:

```js
  ok('an underweight person is NOT given the weight-loss plan', g.autoProtocol(thin) !== 'bmi' && !g.planNeeds(thin).some(n => n.k === 'bmi'), g.autoProtocol(thin));
  ok('…they get the underweight plan instead, with the reason', g.autoProtocol(thin) === 'thin' && /below the healthy range/.test(g.planNeeds(thin)[0].why), g.autoProtocol(thin));
  const habits = { s: { sys: 112, dia: 72, sugar: 5.0, chol: 4.2, weight: 65, veg: 2, walk: 5, water: 3, sleep: 8 }, heightCm: 170 };
  ok('low fruit & veg, exercise and water readings each get their plan, in that order', g.planNeeds(habits).map(n => n.k).join() === 'veg,move,water', g.planNeeds(habits).map(n => n.k).join());
  ok('…and a medical flag still comes first', g.planNeeds({ ...habits, s: { ...habits.s, sys: 150, dia: 95 } })[0].k === 'bp');
```

### U3  (`.smoke/harness.js`, serves F5)

Why: the Plan screen shows Ellen White labels and credits

Find (exactly once):

```js
  ok('…shows the plan steps with their sources', /Ministry of Healing ch\. 23/.test($main.innerHTML) && $main.innerHTML.includes('Source: ' + PL.bp.src));
  ok('…lists what the plan is based on, and credits both public-domain books', $main.innerHTML.includes('What this plan is based on') && $main.innerHTML.includes('The Ministry of Healing (Ellen G. White, 1905') && $main.innerHTML.includes('Rational Hydrotherapy (J. H. Kellogg'));
  ok('…labels Kellogg references as pages', /Kellogg pp\. 395–396/.test($main.innerHTML));
```

Replace with:

```js
  ok('…shows the plan steps with their sources', /Counsels on Diet §\d+/.test($main.innerHTML) && $main.innerHTML.includes('Source: ' + PL.bp.src));
  ok('…lists what the plan is based on, and credits the Ellen White books it uses', $main.innerHTML.includes('What this plan is based on') && $main.innerHTML.includes('The Ministry of Healing (Ellen G. White, 1905') && $main.innerHTML.includes('Healthful Living (Ellen G. White'));
  ok('…labels Healthful Living references by paragraph', /Healthful Living §\d+/.test($main.innerHTML));
```

### U4  (`.smoke/harness.js`, serves F5)

Why: the four new plans render, and plans with no shopping list show no food button

Find (exactly once):

```js
  g.state.protocol = 'bmi'; g.render();
  ok('the weight plan shows no calorie rule of thumb (it came only from the old book)', !/kcal/.test($main.innerHTML));
```

Replace with:

```js
  for (const k of ['thin', 'veg', 'move', 'water']) {
    g.state.protocol = k; g.render();
    ok('Plan screen renders the new ' + k + ' plan with its source and facts', $main.innerHTML.includes('Source: ' + PL[k].src) && PL[k].facts.every(([t]) => $main.innerHTML.includes(t.slice(0, 25))), k);
  }
  g.state.protocol = 'water'; g.render();
  ok('a plan with no shopping list shows no food button', !/openFood\(\)/.test($main.innerHTML));
  g.state.protocol = 'veg'; g.render();
  ok('a plan with a shopping list still shows the food button', /openFood\(\)/.test($main.innerHTML));
  g.state.protocol = 'bmi'; g.render();
  ok('the weight plan shows no calorie rule of thumb (it came only from the old book)', !/kcal/.test($main.innerHTML));
```

### P1 PLANS.md for Ellen White sources and nine plans  (`PLANS.md`, serves F6)

Why: rewrites where the plans come from: Ellen White only, the reference forms, the nine plans and when each is chosen, the herb teas, what was left out

Find (exactly once):

```md
# Where the plans come from

The five plans on the **Plan** tab, the WhatsApp message and the take-home card rest on two books by Seventh-day
Adventist health pioneers. Both are long out of copyright:

> *The Ministry of Healing* — Ellen G. White (Pacific Press, 1905). She died in 1915.
> *Rational Hydrotherapy* — J. H. Kellogg, M.D. (F. A. Davis, 1901), written while he was an Adventist and ran the
> Battle Creek Sanitarium. The church dropped him from membership in 1907, and he died in 1943. The plans use him only
> for the neutral bath and its cautions.

Four herb teas in the sleep and stress & mood plans are cited to two herbals:

> *King's American Dispensatory* (1898), public domain, cited by its entry name (for example `King's Dispensatory: Tilia`).
> *A Modern Herbal* — Mrs M. Grieve (1931), cited as `Grieve: Hops`.

Everything is written in our own words. Nothing is quoted. Each step, fact and action shows what it rests on:

- **`Ministry of Healing ch. 23`**: a chapter of *The Ministry of Healing*. Chapters are used instead of pages because
  the free e-book's page markers do not line up exactly with the printed pages.
- **`Kellogg pp. 395–396`**: printed pages of *Rational Hydrotherapy*.
- **`general advice`**: widely agreed advice that neither book gives (only in the sleep plan: regular bed and wake
  times, 7–8 hours of sleep, dim lights and no screens before bed).
- **`expo safety rule`**: the expo's own safety rule, not a book claim (foot checks, emergencies, clinic visits,
  no crash diets, seeing a doctor before hard exercise).

| Plan | The Ministry of Healing (chapters) | Rational Hydrotherapy (pages) |
| --- | --- | --- |
| Blood pressure | 8, 17, 20, 23, 26 | 197, 372, 395–396 |
| Blood sugar | 17, 23, 25, 26 | 377 |
| Weight & cholesterol | 17, 23, 25, 26 | — |
| Sleep | 17, 18, 20, 23, 25, 26 | 197, 372, 377, 383–384, 395–396 |
| Stress & mood | 8, 17, 18, 19, 20, 23, 26 | 197, 372, 383–384, 395–396 |

What each reference covers:

| Reference | What the plans take from it |
| --- | --- |
| MH ch. 8, "The Physician, an Educator" | The natural remedies: pure air, sunlight, moderation, rest, exercise, good food, water, trust in God |
| MH ch. 17, "The Use of Remedies" | Rest for the overworked; water drunk freely; warm and neutral baths soothe the nerves; inactivity causes disease; daily outdoor exercise, brisk walking, a short walk after meals; useful work lifts the mind |
| MH ch. 18, "Mind Cure" | Mind and body affect each other; gratitude, speaking of good things, song, sympathy, helping others; thanking God in the morning |
| MH ch. 19, "In Contact With Nature" | Time outdoors among trees and flowers as a remedy |
| MH ch. 20, "General Hygiene" | Deep breathing calms the nerves and brings sound sleep; posture; fresh air and sunshine in bedrooms |
| MH ch. 23, "Diet and Health" | Grains, fruit, nuts and vegetables, simply prepared; beans, peas and lentils; few nuts; olive oil over animal fat; little butter, sugar or salt; meals at set times, 5–6 hours apart, nothing between; no late eating; eat slowly and calmly; do not overeat |
| MH ch. 25, "Extremes in Diet" | Two meals often suit people better; a third meal light, such as crackers and fruit |
| MH ch. 26, "Stimulants and Narcotics" | Tea and coffee stimulate, then leave headache and sleeplessness; tobacco and alcohol harm |
| Kellogg p. 197 | No very hot baths with a weak heart, hardened arteries or old age |
| Kellogg p. 372 | Heart disease: avoid extremes of temperature; neutral baths suit |
| Kellogg p. 377 | Diabetes, when thin or frail: avoid very hot and very cold baths (the expo applies this to everyone with diabetes) |
| Kellogg pp. 383–384 | The neutral bath, taken at bedtime, is among the best remedies for sleeplessness |
| Kellogg pp. 395–396 | The bedtime neutral bath: 92–95°F (33–35°C) for 15–30 minutes, for sound sleep |

Where to check them: the 1905 text of *The Ministry of Healing* is free to read at text.egwwritings.org (book 135); the
Ellen G. White Estate's e-book edition carries its own licence, so cite the 1905 book, not the e-book. A scan of
*Rational Hydrotherapy* (1901) is on archive.org (item `rationalhydroth00kellgoog`).

**Not claimed:** no doctor or church body has reviewed or approved these plans. Do not say they are "Adventist
approved" or name any living doctor as their source unless that person has agreed in writing.

## Herb teas (sleep and stress & mood plans only)

Four mild herb teas were chosen to agree with the Adventist health books the expo team uses, then checked in the two
herbals above. Each is a plain water tea, never an alcohol tincture, extract or capsule, and none is a stimulant.

| Herb | Plans | What the herbal says (our words) | Source | Hazard note shown in the plan |
| --- | --- | --- | --- | --- |
| Chamomile (German) | Sleep, Stress & mood | Calms nervous irritability and restlessness; about ½ oz of flowers to a pint of water | King's: Matricaria | Can affect people allergic to ragweed |
| Linden flower | Sleep, Stress & mood | Eases restlessness, promotes rest and sleep | King's: Tilia | Use fresh flowers, not old stock |
| Catnip | Sleep | A warm tea calms restlessness and brings on sleep; about 1 oz to a pint | King's: Nepeta | No catnip tea in pregnancy |
| Hops | Sleep only | Calms the nerves and promotes sleep; about ½ oz to a pint | King's: Humulus; Grieve: Hops | Adds to sleeping or anxiety pills and alcohol; ask first if pregnant or breastfeeding |

The hazard notes come from the "Known Hazards" field of Plants For A Future (pfaf.org), checked on 25 Oct 2026, and are
shown as expo safety rules, not cited. Left out after checking: valerian (needs strict limits), passionflower (the old
herbals give no water tea for it), lemon balm (they give no calming use) and skullcap (possible liver harm). Herb prices
were not checked, so the teas are not on the shopping list or the Food screen.

Copyright: King's (1898) is public domain. Henriette's online transcription (henriettes-herb.com) carries her own
copyright notice, so cite the book, not the web page. Whether Grieve's 1931 book is public domain in South Africa and
the US was not checked; the plans only paraphrase it and name it.

## How a person is matched to a plan

`planNeeds()` reads the screening numbers and lists what needs attention, in this order: red-flag blood pressure,
red-flag sugar, amber blood pressure, amber sugar, weight/cholesterol, **stress & mood**, sleep. The first item is the
plan that opens; the others are one tap away. Each line explains the reading against the expo's screening ranges
(blood pressure bands: normal, pre-hypertension, stage 1, stage 2); no book is cited there.

**Stress & mood** is offered only when the volunteer ticks *Stress & peace* on the Screen tab (the follow-up card). The app
does not diagnose anyone's mood. A real medical flag (blood pressure, sugar) always comes first.

## Get-help line

The sleep and stress & mood plans show a prominent "Need help now?" box, and include the same words in the WhatsApp message
and on the printed card: the SADAG suicide crisis line (0800 567 567), Lifeline (0861 322 322), and the advice to go to the
nearest clinic or emergency service. **Check these numbers and their hours with SADAG (sadag.org) and Lifeline
(lifelinesa.co.za) before the expo**; published sources disagree on the opening hours. The text is one constant,
`HELP_LINE`, in `index.html`.

## What was deliberately left out

Some advice in the source books is unsafe, out of date or contested to hand out at a health expo, so it is **not** in
the plans: fasting, a fruit-only diet, avoiding all milk, eggs or cheese, cold baths and douches, sweating baths, and
any suggestion to reduce medicine. Supplements and calorie formulas are also left out, because neither book supports
them. Herb teas are limited to the four in "Herb teas" above. The app's rule stays: **never stop prescribed pills suddenly; the clinic adjusts them.** Dr
Kellogg's cautions are kept: no very hot baths with heart trouble or hardened arteries, no very hot or very cold baths
with diabetes, and the neutral bath as the gentle choice. The expo adds its own: test the water with your elbow if your
feet have lost feeling, and see a doctor before hard exercise with heart disease or several heart risk factors.

## How a plan is shown: do this, why, how

Each plan opens as instructions, not reading material:

1. **Goal and problem** in one line, with the healthy target. For example: *"Bring your blood pressure down.
   Blood pressure 150/95: high (stage 1). Healthy is under 120/80."*
2. **A red-range reading comes first.** Blood pressure 160/100+ or sugar 15+ means *see the triage nurse now*; any
   other red reading means *book a clinic visit this week*. This is the expo's safety rule, not a book claim.
3. **Do these 3 things:** numbered actions, each with **Why** (the reason, with its reference) and **How**
   (concrete steps, plus the food cost where foods are involved).
4. **When these feel easy, add:** the plan's remaining actions.
5. **Check again** (for example, blood pressure in 3 weeks) and **keep taking your pills**.
6. Folded away: the full timed day, home hydrotherapy, and what the plan is based on.

The actions are `ACTIONS` in `index.html`, most important first. Every why and how restates the plan's own steps and
facts, with the same reference; nothing new is claimed. They adapt to the person: an action can apply only to
some visitors (for example "lose extra weight slowly" only when the BMI is 25 or more), or move to the top for them (for example
"cut out fried food and animal fat" when cholesterol, not weight, is the problem). The WhatsApp message and the
printed card carry the same problem line, 3 actions and recheck, so the visitor goes home with what was explained.

The printed A6 card measures itself before printing and steps the text down a size if anything would be cut off.
(The previous card ran past the bottom edge and lost the safety note.)

## The Food screen

On the Plan tab, **See the food** opens one screen with every shopping-list food (14 in all). It can be filtered by plan
or show all foods. Bars show the cost **per day**, over the **21 days**, or the **store prices** (cheapest store, median, dearest
store). Tapping a food shows **why it is in the plan** and how its price was worked out.

- **Why:** `FOOD_WHY` in `index.html`. Every line repeats something a plan already says, with the same reference. To
  add one, put it in the plan's steps or facts first, then repeat it there.
- **Green beans:** the plans always say to cook them (an expo safety rule), and the Food screen shows that caution.
- **Prices:** `FOOD_PRICES` in `index.html`, between the `FOOD_PRICES:BEGIN` / `END` markers. `node tools/update-prices.js`
  rewrites it from `prices/prices.csv` along with the shopping-list prices, so never edit it by hand. Flaxseed and
  valerian still have prices there, but no plan lists them any more.

## Things to know

- **Prices** are real South African supermarket prices checked on the stores' own websites on 19 Oct 2026 (neither book has any): Pick n Pay, Checkers, Shoprite, Woolworths, Makro, Game, one SPAR store's webshop and Dis-Chem. Each item shows the stores and the typical price range; the daily cost is the median price × the daily amount. Prices change and vary by branch, and the app says so wherever it shows them. Two items had no exact match online and use a flagged stand-in: unsifted maize meal (super maize meal shown) and dried figs (dates). The working is in `prices/PRICES.md`; to refresh, update `prices/prices.csv` and run `node tools/update-prices.js`.
- The **blood-pressure and health-age projections** on the Results tab are illustrative counselling estimates from the
  original app, not from either book, and are labelled that way.
- Plans are plain data in `index.html` (`PROTOCOLS`). To change a step, edit it there and keep its reference honest:
  only cite a chapter or page you have read, and use `G` or `S` when no book says it.
- **A clinical reviewer should read the plans before the expo.**
```

Replace with:

```md
# Where the plans come from

The nine plans on the **Plan** tab, the WhatsApp message and the take-home card are written in our own words. The only
author cited is **Ellen G. White** (1827–1915). Nothing is quoted.

| Reference on screen | Book | How it is cited |
| --- | --- | --- |
| `Ministry of Healing ch. 23` | *The Ministry of Healing* (1905) | by chapter (the free e-book's page markers do not line up exactly with the printed pages) |
| `Counsels on Diet §731` | *Counsels on Diet and Foods* (compiled 1938) | by numbered paragraph |
| `Healthful Living §571` | *Healthful Living* (compiled 1897) | by numbered paragraph |
| `Place of Herbs p. 6` | *The Place of Herbs in Rational Therapy* (compiled 1931) | by page (her letter of 1890 on catnip and hop tea) |
| `general advice` | none | widely agreed natural-health advice that her books do not give (amounts, targets, traditional foods and teas, the thought check) |
| `expo safety rule` | none | the expo's own safety rules (foot checks, emergencies, clinic visits, fluid limits, seeing a doctor before hard exercise) |

Her own words are long out of copyright. The compilations and the White Estate's e-book files carry their own rights, so
the app only paraphrases and cites them; it never copies their text. A test checks that most of every plan's steps and
facts cite her, that every cited chapter or paragraph is one that was read for these plans, and that no other author is named.

## The nine plans

| Plan | Chosen when | Main Ellen White references |
| --- | --- | --- |
| Blood pressure | blood pressure 130/85 or more | MH chs. 8, 17, 20, 26; CD §§111, 138, 245, 267, 268, 475, 514, 518, 726, 731; HL §§570, 571, 717 |
| Blood sugar | sugar 6.1 mmol/L or more | MH chs. 17, 26; CD §§146, 168, 191, 245, 267, 268, 504, 518, 726, 731; HL §571 |
| Weight & cholesterol | BMI 25 or more, or cholesterol 5 or more | MH chs. 17, 23, 25; CD §§137, 168, 191, 245, 267, 268, 269, 326, 504, 514, 731; HL §§571, 578 |
| Underweight | BMI under 18.5 | MH ch. 23; CD §§138, 146, 168, 245, 267, 268, 320, 326, 518, 731; HL §§185, 578 |
| Fruit & veg | under 5 servings a day | CD §§111, 137, 146, 245, 267, 464, 475, 509, 514, 518 |
| Exercise | under 30 minutes a day | MH chs. 17, 20; HL §§570, 571, 578, 717, 780 |
| Water | under 8 glasses a day | MH ch. 26; CD §§475, 726, 727, 728, 731; HL §786 |
| Sleep | under 7 hours a night | MH chs. 17, 18, 20, 26; CD §§201, 245, 268, 270; HL §§185, 189, 313, 571, 618, 717; Place of Herbs p. 6 |
| Stress & mood | the visitor asked for stress and peace support | MH chs. 8, 17, 18, 19, 20, 26; CD §§111, 201, 268, 727; HL §§313, 717, 780 |

What the main references say, in short:
- **MH ch. 8:** the true remedies are pure air, sunlight, moderation, rest, exercise, good food, water and trust in God.
- **MH ch. 17:** rest for the overworked; water drunk freely; warm and neutral baths soothe the nerves; inactivity breeds
  disease; walk after meals; useful work lifts the mind.
- **MH ch. 18:** mind and body affect each other; gratitude, speaking of good things, song, sympathy, helping others.
- **MH ch. 19:** time outdoors in nature. **MH ch. 20:** deep breathing, fresh air and sunshine in bedrooms.
- **MH ch. 23 / 25 / 26:** simple plant foods, nuts in place of meat, little fat and sugar, a light third meal, no
  stimulants (tea, coffee, tobacco, alcohol).
- **CD §§267–270, 245:** meals at set times at least five hours apart, nothing between, a hearty breakfast, a light early
  third meal or none, no late suppers.
- **CD §§111, 138, 146, 464, 475, 504, 509, 514, 518:** grains, fruit, nuts and vegetables; staples and dried fruit;
  plenty of fruit and vegetables; whole-grain bread; beans.
- **CD §§168, 191, 137, 326, 320:** eat slowly; much less sugar; food free of grease; enough nourishing food, never a
  meagre diet.
- **CD §§201:** irregular hours for eating and sleeping wear down the mind.
- **CD §§726–731, HL §786:** water drunk freely; hot water before eating; little or no drink with meals.
- **HL §§570, 571, 578, 780:** walking is the best exercise, outdoors every day, brisk but not violent.
- **HL §§185, 189, 313, 618, 717:** sleep restores strength; late hours weaken; air and sun in bedrooms; deep breathing.
- **Place of Herbs p. 6 (Letter 35, 1890):** catnip tea quiets the nerves; hop tea brings sleep.

## How a person is matched to a plan

`planNeeds()` reads the screening numbers and lists what needs attention, most urgent first: red-flag blood pressure,
red-flag sugar, amber blood pressure, amber sugar, weight/cholesterol, underweight, **stress & mood**, sleep, then the
habit checks (fruit & veg, exercise, water). The first item is the plan that opens; the others are one tap away. Each
line explains the reading against the expo's screening ranges; no book is cited there.

**Stress & mood** is offered only when the volunteer ticks *Stress & peace* on the Screen tab (the follow-up card). The
app does not diagnose anyone's mood. A real medical flag (blood pressure, sugar) always comes first.

## Get-help line

The sleep and stress & mood plans show a prominent "Need help now?" box, and include the same words in the WhatsApp message
and on the printed card: the SADAG suicide crisis line (0800 567 567), Lifeline (0861 322 322), and the advice to go to the
nearest clinic or emergency service. **Check these numbers and their hours with SADAG (sadag.org) and Lifeline
(lifelinesa.co.za) before the expo**; published sources disagree on the opening hours. The text is one constant,
`HELP_LINE`, in `index.html`.

## Herb teas

Only four mild teas, all plain water teas (never tinctures, extracts or capsules), and none is a stimulant:
- **Hops and catnip** (sleep plan): Ellen White's letter of 1890 says hop tea brings sleep and catnip tea quiets the
  nerves (Place of Herbs p. 6). Hops is in the sleep plan only.
- **Chamomile and linden flower** (sleep and stress & mood): general advice; her books do not name them.

Each plan shows the hazard notes as expo safety rules: hops adds to sleeping or anxiety pills and alcohol (ask first if
pregnant or breastfeeding); no catnip in pregnancy; chamomile can affect people allergic to ragweed; use fresh linden
flowers, not old stock. Valerian, passionflower, lemon balm and skullcap are left out. Herb prices were not checked, so
the teas are not on the shopping list.

## What was deliberately left out

Some advice in the source books, and in other natural-health books, is unsafe, out of date or contested to hand out at
a health expo, so it is **not** in the plans: fasting, a fruit-only diet, avoiding all milk, eggs or cheese, cold baths
and douches, sweating baths, high-dose supplements, strong herbs, calorie formulas, and any suggestion to reduce
medicine. The app's rule stays: **never stop prescribed pills suddenly; the clinic adjusts them.** Hot baths are never
suggested; the warm, neutral bath (33–35°C) is, with a caution for high blood pressure, heart trouble, diabetes and
numb feet.

## How a plan is shown: do this, why, how

Each plan opens as instructions, not reading material:

1. **Goal and problem** in one line, with the healthy target. For example: *"Bring your blood pressure down.
   Blood pressure 150/95: high (stage 1). Healthy is under 120/80."*
2. **A red-range reading comes first.** Blood pressure 160/100+ or sugar 15+ means *see the triage nurse now*; any
   other red reading means *book a clinic visit this week*. This is the expo's safety rule, not a book claim.
3. **Do these 3 things:** numbered actions, each with **Why** (the reason, with its reference) and **How**
   (concrete steps, plus the food cost where foods are involved).
4. **When these feel easy, add:** the plan's remaining actions.
5. **Check again** (for example, blood pressure in 3 weeks) and **keep taking your pills**.
6. Folded away: the full timed day, home hydrotherapy, and what the plan is based on.

The actions are `ACTIONS` in `index.html`, most important first. Every why and how restates the plan's own steps and
facts, with the same reference; nothing new is claimed. The WhatsApp message and the printed card carry the same
problem line, 3 actions and recheck, so the visitor goes home with what was explained.

## The Food screen

On the Plan tab, **Food for this plan** opens one screen with every shopping-list food. It can be filtered by plan (only
plans that have a shopping list) or show all foods. The exercise and water plans have no shopping list, so they show no
food button, and their message and card leave the shopping line out.

- **Why:** `FOOD_WHY` in `index.html`. Every line repeats something a plan already says, with the same reference.
- **Prices:** `FOOD_PRICES` in `index.html`, between the `FOOD_PRICES:BEGIN` / `END` markers. `node tools/update-prices.js`
  rewrites it from `prices/prices.csv` along with the shopping-list prices (including the shared `ITEM_…` entries), so
  never edit it by hand. Valerian still has a price there, but no plan lists it.

## Things to know

- **Prices** are real South African supermarket prices checked on the stores' own websites on 19 Oct 2026 (no book has any). Each item shows the stores and the typical price range; the daily cost is the median price × the daily amount. Prices change and vary by branch, and the app says so wherever it shows them. Two items had no exact match online and use a flagged stand-in: unsifted maize meal (super maize meal shown) and dried figs (dates). The working is in `prices/PRICES.md`; to refresh, update `prices/prices.csv` and run `node tools/update-prices.js`.
- The **blood-pressure and health-age projections** on the Results tab are illustrative counselling estimates, not from
  any book, and are labelled that way.
- Plans are plain data in `index.html` (`PROTOCOLS`). To change a step, edit it there and keep its reference honest:
  only cite a chapter, paragraph or page you have read, and use `G` or `S` when her books do not say it.
- **No doctor or church body has reviewed or approved these plans.** Do not say they are "Adventist approved" or name any
  living doctor as their source unless that person has agreed in writing. **A clinical reviewer should read the plans
  before the expo.**
```

Not changed: the screening thresholds, red flags and help line; the prices and the price tool; the database and sync code. Part B (church plans) is a separate plan.

## 7. Measured facts (verbatim from prove.js)
```text
apply (dry-run copy)               165 ms  applied 21 edits to 3 files
generate (dry-run copy)             73 ms  exit 0
make-expected                    82899 ms  expected.json written: 139 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tamper-test (+ full gate post)  229572 ms  TAMPER-TEST: PASS  (control passed; 9 tampers)
scope-report pristine              174 ms  SCOPE VERDICT: READY  (21 edit(s) pending, 0 already applied)
scope-report dry-run               150 ms  SCOPE VERDICT: ALREADY APPLIED  (0 edit(s) pending, 21 already applied)
scope-report (real project)        206 ms  SCOPE VERDICT: READY  (21 edit(s) pending, 0 already applied)
gate pre (real project)          42334 ms  RESULT: PASS  (25/25 checks passed, mode=pre)

# make-expected
expected.json written: 139 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tests before {"pass":573,"fail":0} (exit 0) -> after {"pass":580,"fail":0} (exit 0)
  anchor index.html:1222 x1  const BOOK_REF='
  anchor index.html:1227 x1  const PROTOCOLS={
  anchor index.html:1448 x1  const ACTIONS={
  anchor index.html:1537 x1  function refLabel(pg){
  anchor index.html:2399 x1  function planNeeds(a){
  anchor index.html:2421 x1  function problemOf(a,pk){
  anchor index.html:2541 x1  function openFood(){
  anchor .smoke/harness.js:2179 x1  console.log('\n21. Book-based plans');

# tamper-test (its control is the full dry-run gate post)
control: gate post on the dry-run copy (full, with mutation tests)…
  OK    control must PASS -> RESULT: PASS  (37/37 checks passed, mode=post)  [DRY-RUN]
  OK    plan never applied (pristine copy) -> RESULT: FAIL  (13/20 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-.smoke/harness.js  .smoke/harness.js is byte-identi, X-PLANS.md  PLANS.md is byte-identical to the dry-run, X-dist/index.html  dist/index.html is byte-identical 
  OK    a stray file was added -> RESULT: FAIL  (18/20 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S2  no file was added or deleted
  OK    edited file drifted by one byte: index.html -> RESULT: FAIL  (19/20 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
  OK    edited file drifted by one byte: .smoke/harness.js -> RESULT: FAIL  (19/20 checks passed, mode=post)   caught by: X-.smoke/harness.js  .smoke/harness.js is byte-identi
  OK    edited file drifted by one byte: PLANS.md -> RESULT: FAIL  (19/20 checks passed, mode=post)   caught by: X-PLANS.md  PLANS.md is byte-identical to the dry-run
  OK    an out-of-scope file was changed: .smoke/serve.js -> RESULT: FAIL  (18/20 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S3  the other 134 files are byte-identical to the bas
  OK    generated file left stale: dist/index.html -> RESULT: FAIL  (17/20 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/index.html  dist/index.html is byte-identical , C-no-other-authors  index.html, dist/index.html and P
  OK    generated file left stale: dist/sw.js -> RESULT: FAIL  (18/20 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/sw.js  dist/sw.js is byte-identical to the dry
  OK    half-applied: edit "A1 plan data on Ellen White only, nine plans" undone -> RESULT: FAIL  (18/20 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry, C-no-other-authors  index.html, dist/index.html and P
TAMPER-TEST: PASS  (control passed; 9 tampers)

PIN fix-plan/gate.js sha256 61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587
PIN fix-plan/expected.json sha256 bbaf835aa82333f9f903675650f3c2bbae27a7f10221d90d119ed50adcd77c08
```

## 8. Not measured
- Clinical review of the plans: not done.
- Copyright status of the compilations (Counsels on Diet and Foods, Healthful Living, The Place of Herbs): not checked; the plans only paraphrase and cite them.
- Whether general-advice (G) lines are medically accurate: not reviewed by a clinician.
- The Android copies: not rebuilt.
- The database checks (PGlite) were not run for this plan.

## 9. Execution report (only these statements)
1. The scope analysis summary under the four headings, and the SCOPE VERDICT line.
2. Both `RESULT:` lines and both report paths with their hashes.
3. The S1 line (files changed) and the H1 line (test tally).
4. Anything not run, marked "not run".
