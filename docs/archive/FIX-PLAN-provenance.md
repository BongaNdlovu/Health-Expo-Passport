# Plan: rebuild where the health plans come from, on public-domain Adventist books

**Status: plan only, nothing applied.** Every number was measured, and `gate pre` re-checks it before anything changes.

<!-- Fields with "=" inside double braces are filled by render-plan.js from tool output. The other double-brace fields are
     prose you write from this session's tool output. `render-plan.js <project> --check` must PASS before reporting. -->

## 1. Goal
Today the five plans, their actions, the Food screen, the planNeeds reasons, the Results sliders and PLANS.md cite three copyrighted books by page or chapter: the Natural Remedies Encyclopedia, Nedley's The Lost Art of Thinking and the Encyclopedia of Foods. They also carry material that is distinctive to those books (Nedley's programmes, statistics and ten thinking traps, the calorie rule of thumb, food claims). After the plan, every line is in our own words and rests on The Ministry of Healing (Ellen G. White, 1905) by chapter, Rational Hydrotherapy (J. H. Kellogg, M.D., 1901) by page, or is tagged G (general advice, sleep plan only) or S (expo safety rule). Both books are public domain; each cited chapter and page was read in this session. Measured on copies: tests before 566 pass / 0 fail, after 568 pass / 0 fail (17 old-book tests replaced, new source checks added).

| # | Problem (exact test name or symptom) | Cause (file:line from an anchor) | Kind | Fix |
|---|---|---|---|---|
| F1 | Plans cite copyrighted books | `index.html:1219` (BOOK_REF) and the data from `index.html:1224` to refLabel at `index.html:1557` | Real bug / Stale test / Decision: re-source on public-domain Adventist books, our own words, no CDC/WHO-type bodies (your answer) | E1–E24, P1; tests H1–H17 |

Out of scope, unchanged before and after: none.

## 2. Scope
- **Edited:** `index.html`, `.smoke/harness.js`, `PLANS.md`, changed only by `node fix-plan-provenance/apply.js .`
- **Generated:** `dist/index.html`, `dist/sw.js`, changed only by `node tools/build.js`
- **Everything else:** 132 files stay byte-identical. No file is added or deleted.
- **Invariants:** the precompiled stylesheet, the measured store prices (FOOD_PRICES), the crisis help line and the screening colour bands (cat) stay byte-identical. Extra checks: the harness parses, and index.html, dist/index.html and PLANS.md name none of the old books.

## 3. Hard rules (any violation = the plan FAILS)
1. **Fail closed.** Any `[FAIL]`, crash or timeout fails the plan. Never edit the gate, `config.js` or `expected.json`
   to get past one. Restore the backups and report.
2. **No hand edits.** Only `apply.js` changes edited files: each edit is applied exactly once, or nothing is written.
3. **No weakened tests.** Changed files must be byte-identical to the dry run. No test may be renamed, dropped, skipped
   or made always-true. The gate breaks the fixed code in 11 way(s), and each must be caught.
4. **Zero hallucination.** Report only what the gate or a tool printed. Write "not run" or "not measured" for
   anything else.
5. **Pinned tooling.**
   - `fix-plan-provenance/gate.js` sha256 `61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587`
   - `fix-plan-provenance/expected.json` sha256 `e167cf40da2c46289a09d5e518479a152e110829fd3b3fff69fa0c8d166f4a18`

   The gate pins the other files itself.
6. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis
Read-only. Check the pins, run `node fix-plan-provenance/scope-report.js` (required: `SCOPE VERDICT: READY`), read sections 1–2
and 6 and `fix-plan-provenance/edits.js`, and grep the callers and tests of each edit site.

Present it under four headings, citing `file:line`:
- **Scope covered:** 5 file(s) change (`.smoke/harness.js`, `PLANS.md`, `dist/index.html`, `dist/sw.js`, `index.html`) and 132 stay identical.
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
sha256sum fix-plan-provenance/gate.js fix-plan-provenance/expected.json   # must match rule 5
node fix-plan-provenance/gate.js pre     # required: RESULT: PASS (24/24 checks passed, mode=pre); writes backups
node fix-plan-provenance/apply.js .      # required: applied 42 edits to 3 files
node tools/build.js    # regenerate
node fix-plan-provenance/gate.js post    # required: RESULT: PASS (37/37 checks passed, mode=post)
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

## 6. The exact change (ground truth: `fix-plan-provenance/edits.js`)
### E1 plan data on public-domain sources  (`index.html`, serves F1)

Why: replaces the three copyrighted books (citations, programmes, statistics, thinking traps, Encyclopedia of Foods lines, calorie rule) with our own wording sourced to The Ministry of Healing (1905) and Rational Hydrotherapy (1901), plus G/S tags; drops flaxseed and valerian, which neither book supports

Find (exactly once):

```html
/* ---------------------------------------------------------------------------------------------------------
   The five plans are built from two books. A reference is either a printed PAGE of the Natural Remedies
   Encyclopedia ("527", "526–528") or a CHAPTER of The Lost Art of Thinking ("N:16", "N:1–10"; that book's
   page numbers are not reliable in the text, so it is cited by chapter). Several can be joined with " · ".
   Everything here is paraphrased advice, not quotation.
   "steps"  = the day, in order (each with its reference)
   "facts"  = what the books advise, with references
   "items"  = shopping list with APPROXIMATE South African prices (neither book has prices; check locally)
   "habits" = the three-line summary used on the WhatsApp message and the take-home card
   "note"   = a plan-specific safety note;  "help" = a get-help line shown prominently (mind and sleep plans)  */
const BOOK_REF='Natural Remedies Encyclopedia, 7th ed. (Vance Ferrell & Harold M. Cherne, M.D., Harvestime Books)';
const BOOK2_REF='The Lost Art of Thinking (Neil Nedley, M.D., Nedley Publishing, 2011)';
/* used on the Food screen only (FOOD_WHY entries with src:'ef'); references "F:76" = Volume 1, printed page 76 */
const BOOK3_REF='Encyclopedia of Foods and Their Healing Power, Vol. 1 (George D. Pamplona-Roger, M.D., Education and Health Library)';
const HELP_LINE='If you feel hopeless, or have thoughts of harming yourself, tell someone you trust today and call the SADAG suicide crisis line (0800 567 567) or Lifeline (0861 322 322), or go to the nearest clinic or emergency service. Do not wait.';
const PROTOCOLS={
 bp:{tag:'Blood pressure',tagline:'21-day blood-pressure plan',title:'High Blood Pressure — Home Plan',
  src:'Natural Remedies Encyclopedia: Hypertension, pp. 526–528; neutral bath, p. 259 · The Lost Art of Thinking: chs. 13, 15, 17',
  mech:'Follows the Hypertension chapter: plenty of water, a salt-free whole-food plant diet rich in potassium, daily outdoor exercise, slow deep breathing, rest, and a healthy weight.',
  steps:[
   ['06:30','A full glass of water, then breakfast of oat bran or whole grains with fruit. The book also suggests flaxseed oil (2 tbsp a day); ground flaxseed is a cheaper alternative. No salt.','526'],
   ['10:00','Drink water: about eight cups a day, starting when you get up. Optional hawthorn tea: 1 tsp herb per cup, up to 2 cups a day.','527 · N:17'],
   ['13:00','Big raw-vegetable lunch with celery, carrot, tomato and raw garlic. Unsalted potato soup (with the skin) is a good potassium source.','526–527'],
   ['14:00','Outdoors after lunch: 10–20 slow, deep belly breaths. Repeat just before bed.','N:15'],
   ['16:30','Walk outdoors in daylight for about 30 minutes. Start gently and build up slowly.','528 · N:13'],
   ['19:00','Light supper, finished several hours before bed. No salty or processed food.','527'],
   ['21:00','Warm neutral bath (34–36°C) before bed, then lights out by 22:00.','259']],
  hydro:'<b>Neutral bath (34–36°C / 94–97°F), just before bed:</b> soak until relaxed, about 15–20 minutes. The Encyclopedia says it relaxes the nerves and helps sleep by evening out the circulation (p. 259). <em>Do not use hot tub baths with high blood pressure (p. 259), and no hot foot bath if the feet have hardened arteries or lost feeling (p. 257).</em>',
  facts:[
   ['Drink plenty of water through the day.','526'],
   ['About eight cups of water a day can help lower blood pressure in people who are chronically dehydrated, because water keeps the blood thinner and the heart does not have to pump so hard.','N:17'],
   ['Eat lots of high-fibre plant foods: vegetables, fruit, nuts and whole grains. Oat bran is singled out.','526'],
   ['Potassium-rich fresh fruit and vegetables help the body get rid of extra sodium.','526'],
   ['Leave out added salt. Read labels for sodium, MSG, soy sauce and preservatives.','527'],
   ['Foods named for blood pressure: raw garlic, celery (about 4 stalks), tomatoes, broccoli and carrots.','526–527'],
   ['Aim for at least five servings of fruit and vegetables every day.','527'],
   ['Avoid habitual overeating, sweets and rich pastry, animal fat, alcohol, tobacco, loud noise and late meals.','527–528'],
   ['Daily outdoor exercise, enough rest at night, and losing weight if overweight all help lower pressure.','528'],
   ['Slow, deep belly breathing (10–20 breaths after each meal and before bed) lowered heart rate and blood pressure in a study. Wear loose clothing and sit upright.','N:15'],
   ['Brisk walking for about 30 minutes is a good start. See a doctor before vigorous exercise if you have heart disease or several heart-disease risk factors.','N:13'],
   ['Have your blood pressure checked regularly.','528'],
   ['Severe cases: rest, gentle walking and neutral baths. No vigorous hydrotherapy.','528']],
  note:'Hawthorn tea and potassium-rich foods can interact with blood-pressure pills or kidney disease. Mention them to your clinic first.',
  habits:['Water, no added salt, raw garlic and plenty of fruit and vegetables','A daily outdoor walk, slow deep breaths and enough rest','A neutral bath and an early night'],
  items:[
   {name:'Rolled oats / oat bran',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   {name:'Ground flaxseed',dose:'1–2 tbsp',store:'R150–R160 per kg (median R150) at Checkers, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:2.25},
   {name:'Raw garlic',dose:'2 cloves',store:'R200–R317 per kg (median R247) at Checkers, SPAR, Woolworths (checked 19 Oct 2026)',daily:2.47},
   {name:'Celery',dose:'2–4 stalks',store:'R26–R30 a bunch (median R29) at Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:7.25},
   {name:'Tomatoes',dose:'2 medium',store:'R24–R35 per kg (median R33) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.95},
   {name:'Potatoes (with skin)',dose:'250g for soup',store:'R11–R15 per kg (median R12) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:3.12}]},

 sugar:{tag:'Blood sugar',tagline:'21-day blood-sugar plan',title:'High Blood Sugar — Home Plan',
  src:'Natural Remedies Encyclopedia: Diabetes, pp. 656–658; hydrotherapy cautions, pp. 256–259 · The Lost Art of Thinking: chs. 11, 13, 17',
  mech:'Follows the Diabetes chapter: smaller meals at regular times, whole plant foods rich in fibre, no sugar or white flour, raw garlic and onions, daily exercise, and a healthy weight.',
  steps:[
   ['06:30','Water, then breakfast at a regular time: whole-grain porridge (brown rice or maize meal) with vegetables or beans. No sugar.','657–658'],
   ['10:00','Water or unsweetened herbal tea. If you need a snack: raw vegetables or cooked green beans (never raw).','657 · N:17'],
   ['13:00','Lunch: raw salad with onion and raw garlic, plus beans or lentils. Chew slowly, because eating fast pushes sugar up.','657–658'],
   ['16:30','Brisk walk outdoors. The book calls exercise “insulin’s best friend” and suggests twice a day. If you are unfit, alternate 60 seconds brisk with 30 seconds easy.','658 · N:13'],
   ['18:00','Small, early supper eaten slowly. Nothing more to eat late in the evening.','657'],
   ['21:00','Check both feet for cuts, blisters or sores, then bed.','658']],
  hydro:'<b>Avoid hot and cold extremes.</b> The Encyclopedia warns against extreme hot or cold treatments in diabetes (p. 256) and says a hot full bath is not for people with diabetes (p. 259). A neutral bath (34–36°C / 94–97°F) is the safe choice (p. 259). <em>If your feet have lost feeling, test water with your elbow, never your foot.</em>',
  facts:[
   ['Goals for people with diabetes: fasting 90–130 mg/dL (5.0–7.2 mmol/L); two hours after a meal under 160 mg/dL (8.9 mmol/L); A1c about 7%.','657'],
   ['Eat smaller meals, chew well, keep regular times and stop eating late at night. Overeating can bring diabetes on or make it worse.','657'],
   ['A high-fibre whole-food diet with plant protein lowers the need for insulin. A low-fibre diet can bring diabetes on.','657'],
   ['Onions, green beans and raw garlic every day are named as lowering blood sugar; fenugreek helps regulate it.','657–658'],
   ['Stop sugar, white-flour foods, greasy food and tobacco. Coffee can push blood sugar very high.','657'],
   ['Blood sugar above 140 mg/dL (7.8 mmol/L) an hour after a meal can cause tiredness and sluggish thinking.','N:11'],
   ['Exercise (twice a day if you can) moves sugar out of the blood. Keep a healthy weight.','657–658'],
   ['Good hydration keeps the blood thinner, which helps people with diabetes: complications get worse when the blood is thick.','N:17'],
   ['Beginners can use interval walking: 60 seconds brisk, 30 seconds easy, repeated. Warm up with 3–5 minutes of slow walking first.','N:13'],
   ['Take good care of your feet; infections start more easily.','658'],
   ['A high-sugar attack needs an emergency room. For low sugar, drink something sweet at once; insulin users should carry a glucagon kit.','658']],
  note:'If you take diabetes pills or insulin, never change the dose yourself. Talk to your clinic first.',
  habits:['Small regular meals of whole foods, with no sugar or white flour','A brisk outdoor walk every day and plenty of water','Check your feet every evening'],
  items:[
   {name:'Brown rice / whole maize meal',dose:'60g dry',store:'R21–R38 per kg (median R23) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths; unsifted maize meal was not found online, STAND-IN super (sifted) maize meal R11–R13 per kg at Game, Makro, SPAR (checked 19 Oct 2026)',daily:1.35},
   {name:'Onions',dose:'1 medium',store:'R28–R39 per kg (median R30) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.50},
   {name:'Raw garlic',dose:'2 cloves',store:'R200–R317 per kg (median R247) at Checkers, SPAR, Woolworths (checked 19 Oct 2026)',daily:2.47},
   {name:'Green beans',dose:'100g',store:'R68–R86 per kg (median R83) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:8.33},
   {name:'Brown lentils / beans',dose:'½ cup cooked',store:'R49–R68 per kg (median R52) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.34}]},

 bmi:{tag:'Weight & cholesterol',tagline:'Steady weight & cholesterol plan',title:'Weight & Cholesterol — Home Plan',
  src:'Natural Remedies Encyclopedia: Overweight, pp. 480–482; High cholesterol, pp. 531–532 · The Lost Art of Thinking: chs. 11, 13, 17',
  mech:'Follows the Overweight and High Cholesterol chapters and Dr Nedley’s weight-loss program: steady, nourishing whole-food eating (no crash diets), no snacking, plenty of raw vegetables, healthy oils, water, and daily outdoor exercise.',
  steps:[
   ['06:30','Never skip breakfast, and make it the biggest meal: a whole grain (brown rice, barley, millet or buckwheat) with fruit and a few nuts. The book adds 2 tsp flaxseed oil; ground flaxseed is a cheaper alternative.','481 · N:11'],
   ['10:00','Water only between meals, 8–10 glasses across the day. No juice, pop or coffee. Hunger between meals is a sign the meals are not nourishing enough.','481 · N:11'],
   ['13:00','Moderate lunch: as many raw vegetables as you like, with beans, nuts or seeds. Nothing fried.','481'],
   ['16:30','Walk 30 minutes or more outdoors; a pedometer goal of 10,000 steps a day helps. Build up slowly.','481–482 · N:13'],
   ['17:30','Lightest meal of the day, early, or just whole fruit. Then nothing more to eat before bed.','481 · N:11']],
  hydro:null,
  facts:[
   ['Overweight means about 20% or more above the average weight for your height.','480'],
   ['Crash diets do not last; steady, nourishing eating beats losing and regaining. A rule of thumb for a gradual-loss programme: body weight in lb × 10, plus 30%, is the calories you can eat daily without regaining.','480–481'],
   ['Nedley’s five-part programme: cut out snacks; drink only water between meals; eat a good breakfast, a moderate lunch and little or no evening meal; cut sugar and fat and eat plenty of fibre; exercise every day.','N:11'],
   ['Refined carbohydrates are out: sugar, alcohol, white flour, quick oats and packaged cereals. Cook whole grains and eat them in their natural state.','481'],
   ['Eat as many raw vegetables as you like. Avoid fried, frozen and canned vegetables.','481'],
   ['Biggest meal at breakfast, lightest at supper, and nothing before bed. Finishing a meal slightly hungry does no harm. Calories shifted from evening to morning are less likely to be stored as fat.','481 · N:11'],
   ['Drink at least 8–10 glasses of water a day, starting when you get up. Do not wait until you are thirsty.','481 · N:17'],
   ['Losing even 5 pounds can raise energy and lift mood right away.','N:11'],
   ['Every plant food is free of cholesterol; animal foods (meat, milk, eggs, cheese, butter, fish) contain it, except egg whites.','N:11'],
   ['Cholesterol: avoid saturated fat (meat, butter, cheese), fried food and hydrogenated oil. Use only cold-pressed vegetable oils such as flaxseed or wheat germ.','532'],
   ['Large meals push the liver to make more cholesterol, so eat smaller meals.','532'],
   ['Good levels: total cholesterol under 200 mg/dL (5.2 mmol/L), LDL under 130, triglycerides under 150 (1.7 mmol/L).','532'],
   ['Exercise lowers triglycerides even without weight loss, and losing even 10 lb helps.','531–532'],
   ['Exercise: about 30 minutes of brisk walking uses around 150 calories. See a doctor before vigorous exercise if you have heart disease or several heart-disease risk factors.','N:13']],
  note:'Avoid starving or very fast weight loss. If you have diabetes or take medicine, ask your clinic before changing your eating.',
  habits:['Whole grains, raw vegetables and water, with no snacks or crash diets','Walk 30 minutes or more outdoors every day','A light early supper and nothing before bed'],
  items:[
   {name:'Rolled oats / whole grains',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   {name:'Brown lentils / beans',dose:'½ cup cooked',store:'R49–R68 per kg (median R52) at Checkers, Game, Makro, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.34},
   {name:'Ground flaxseed',dose:'1–2 tbsp',store:'R150–R160 per kg (median R150) at Checkers, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:2.25},
   {name:'Cabbage & carrots (raw salad)',dose:'300g a day',store:'Carrots R15–R17 per kg (median R15), cabbage R16–R25 a head (median R17) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:3.95}]},

 sleep:{tag:'Sleep',tagline:'Better-sleep plan',title:'Restless Nights — Home Plan',
  src:'Natural Remedies Encyclopedia: Insomnia, pp. 547–548; neutral bath, p. 259 · The Lost Art of Thinking: ch. 16 “Rewind in Your Sleep”, chs. 14–15',
  mech:'Follows the Insomnia chapter and Dr Nedley’s six sleep steps: regular hours, morning daylight, no sleep robbers, a light early supper, calm evenings, and a cool, dark, quiet room.',
  steps:[
   ['07:00','Get up at the same time every day. You should wake without an alarm; needing one means you are short of sleep. Get 30 minutes of daylight within 10 minutes of waking and have breakfast near a sunny window.','548 · N:14 · N:16'],
   ['12:30','Make breakfast and lunch your main meals. No caffeine, alcohol or smoking in the day: caffeine can halve melatonin for about 6 hours and alcohol cuts deep sleep.','547 · N:16'],
   ['17:00','A gentle outdoor walk or exercise in the late afternoon, not right before bed.','548 · N:16'],
   ['18:30','Light supper, finished 3–4 hours before bed. A simple fruit meal is an excellent choice. Leave out meat, sugar and fatty food at night.','547 · N:16'],
   ['20:00','Dim the lights and switch off the TV and phone. Set worries aside: read something calming or listen to soothing music for 15–30 minutes, with a short prayer of thanks.','N:16'],
   ['20:30','Warm neutral bath (34–36°C) just before bed, or 10–20 slow deep breaths in the fresh air.','259 · N:15'],
   ['21:00','In bed by 21:00–22:00; the book notes a 9 pm bedtime gives the most melatonin. Cool, dark, quiet, tidy room with fresh air. Valerian tea about 30 minutes before bed if you like.','548 · N:16']],
  hydro:'<b>Neutral bath (34–36°C / 94–97°F), just before bed.</b> The Encyclopedia says it relaxes people and helps them sleep by evening out the circulation (p. 259). <em>Skip hot baths and hot foot baths if you have diabetes, high blood pressure or numb feet (pp. 256–257, 259).</em>',
  facts:[
   ['Most adults need 7–8 hours of sleep and some need 9. If you need an alarm to wake up, you are probably short of sleep.','N:16'],
   ['Go to bed and get up at the same time every day, weekends too. Sleeping in disrupts the body clock. A regular weekly day of rest helps too.','548 · N:16'],
   ['Morning daylight sets the body clock. Avoid bright light in the evening, and use only a dim light if you wake at night.','548 · N:14'],
   ['Let breakfast and lunch be the main meals, and eat lightly in the evening, 3–4 hours before bed. Hunger at night: try a glass of cool water.','547 · N:16'],
   ['Foods that support sleep: figs, dates, whole-grain crackers, oats, rice, corn, bananas, barley and ginger. Fatty food, sugar, white flour, salt and MSG keep people awake.','547 · N:16'],
   ['Sleep robbers: caffeine (halves melatonin for about 6 hours), alcohol (about 41% less deep sleep), tobacco, aspartame, and late TV and internet.','547 · N:16'],
   ['Keep the bedroom cool (about 15–18°C / 60–65°F), dark, quiet and tidy, with a little fresh air moving.','548 · N:16'],
   ['Exercise in the day helps you sleep and wake less often at night, but not right before bed.','548 · N:16'],
   ['Calm the mind before bed: soothing music or spiritual reading for 15–30 minutes, and set worries aside. Guilt and stress keep people awake.','N:16'],
   ['Teas that promote sleep: hops, valerian, catnip, skullcap, passionflower, lemon balm. Do not use hops with valerian for more than 2 weeks without a break.','548'],
   ['Sleeping pills do not fix the problem and stop working after a few weeks; herb teas are the easier way off them.','548'],
   ['Poor sleep and stress feed each other. Ongoing insomnia can by itself trigger depression, so treat sleep as a priority.','N:16'],
   ['If you cannot sleep, lying still and relaxing is nearly as good as sleep, or get up quietly for a short time and go back to bed.','548']],
  note:'Some medicines (including some for blood pressure, anxiety and depression) can disturb sleep. Ask your clinic, and never stop them yourself. Do not stop sleeping tablets suddenly. If sleep has been poor for weeks, or you feel low or anxious, see your clinic.',
  help:HELP_LINE,
  habits:['The same bed and wake time every day, with morning daylight','A light early supper, no caffeine or alcohol, and a calm evening','A neutral bath, a cool dark quiet room and lights out by 22:00'],
  items:[
   {name:'Valerian / hops tea',dose:'1 cup, 30 min before bed',store:'R124.99 per 100 g at Dis-Chem — STAND-IN: loose dried valerian root, as no valerian teabags were found priced online (checked 19 Oct 2026)',daily:3.12},
   {name:'Figs or dates',dose:'2–3 pieces',store:'R82–R111 per kg (median R96) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths — priced as dates; no dried figs were found priced online (checked 19 Oct 2026)',daily:2.40},
   {name:'Whole-grain crackers',dose:'2–3',store:'R180–R188 per kg (median R184) at Checkers, Game, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.60}]},

 mind:{tag:'Stress & mood',tagline:'Calm-mind plan',title:'Stress, Worry & Low Mood — Home Plan',
  src:'The Lost Art of Thinking: chs. 1–10 (thinking habits) and 11, 13–19 (lifestyle) · Natural Remedies Encyclopedia: neutral bath, p. 259',
  mech:'Follows Dr Nedley’s book: steady lifestyle habits (morning daylight, movement, water, plant foods, deep breathing, friends, calm music and sleep) together with ten thinking habits that change how a worry feels.',
  steps:[
   ['06:30','Get up at the same time. Within 10 minutes of waking, get 30 minutes of daylight, outdoors if you can. Drink water as soon as you are out of bed.','N:14 · N:17'],
   ['07:30','A good plant-based breakfast: fruit, whole grains and a few nuts. A sprinkle of ground flaxseed and walnuts adds omega-3.','N:11'],
   ['10:00','Water again: 8–10 glasses across the day. Do not wait until you are thirsty.','N:17'],
   ['12:30','Midday movement: 30 minutes of brisk walking, gardening or another activity you enjoy, outdoors. Regular exercise lowers anxiety and low mood.','N:13'],
   ['13:30','After lunch: 10–20 slow, deep belly breaths in fresh air. Do the same just before bed.','N:15'],
   ['16:00','Connect with people: call or visit a friend or family member, or join a church or community activity. Close relationships protect the mind.','N:18'],
   ['19:30','Thinking practice (5 minutes): write down the worry. Ask which of the ten thinking traps below it might be, then write a more balanced version and one good thing that really counts.','N:1–10'],
   ['20:30','Calm evening: soothing music or spiritual reading for 15–30 minutes, worries set aside, a short prayer. A warm neutral bath (34–36°C) also eases nervous tension.','N:16 · N:19 · 259'],
   ['21:30','Lights out in a cool, dark, quiet room. Aim for 7–8 hours; the book notes a 9 pm bedtime gives the most melatonin.','N:16']],
  hydro:'<b>Neutral bath (34–36°C / 94–97°F):</b> the Encyclopedia lists it for anxiety, nervous exhaustion and irritability, and says it relaxes nervous tension (p. 259). Give it just before bed. <em>Skip hot baths if you have diabetes or high blood pressure (p. 259).</em>',
  facts:[
   ['Thinking trap 1, all-or-nothing: seeing things as perfect or a failure. Life is more like a dimmer switch than an on/off switch. Live between the lines.','N:1'],
   ['Thinking trap 2, overgeneralizing: one bad event does not make a rule. Generalize with care.','N:2'],
   ['Thinking trap 3, the negative mental filter: noticing only the bad. Spring-clean your filters.','N:3'],
   ['Thinking trap 4, jumping to conclusions and mind-reading: cross-check your conclusions against the facts.','N:4'],
   ['Thinking trap 5, fortune telling: predicting the worst before it happens. Steer clear of it.','N:5'],
   ['Thinking trap 6, magnifying problems and shrinking good things (catastrophizing). Balance your view.','N:6'],
   ['Thinking trap 7, taking things personally: not everything is about you or your fault.','N:7'],
   ['Thinking trap 8, emotional reasoning: a feeling is not a fact. Let your head do the thinking.','N:8'],
   ['Thinking trap 9, harsh labels such as “I am a failure”: label an event or action accurately, not a whole person.','N:9'],
   ['Thinking trap 10, discounting the positive: waving good things away with “that doesn’t count”. Count the positive.','N:10'],
   ['People who exercise regularly have less depression and anxiety; in one study, highly stressed students who exercised less reported 21% more anxiety.','N:13'],
   ['Morning light sets the body clock and helps tiredness, poor sleep and low mood. Avoid bright light in the evening.','N:14'],
   ['Slow deep belly breathing relaxes the body, improves mood and helps you sleep. Loose clothing and good posture make it easier.','N:15'],
   ['Poor sleep and stress feed each other, and ongoing insomnia can on its own trigger depression. Treat sleep as a priority.','N:16'],
   ['Eat plenty of fruit, vegetables and grains; berries, cruciferous vegetables, garlic and leafy greens are named as especially good for the brain.','N:11'],
   ['Drink water from the moment you wake. Good hydration helps thinking, concentration and headaches.','N:17'],
   ['Close family and friends protect mental health: get involved in a community or church project and be the kind of friend you want to have.','N:18'],
   ['Soothing (sedative) music is linked to less anxiety and more relaxation.','N:19'],
   ['The neutral bath is used for anxiety, nervous exhaustion and irritability.','259']],
  note:'This plan supports good care; it does not replace a clinic. Low mood or worry that lasts more than a couple of weeks, or that stops you working or sleeping, is a reason to see your clinic.',
  help:HELP_LINE,
  habits:['30 minutes of morning daylight and an outdoor walk, with plenty of water','Slow deep breaths after meals and before bed, and time with people you trust','Check a worrying thought against the ten thinking traps, then a calm evening and lights out by 21:30'],
  items:[
   {name:'Ground flaxseed',dose:'1–2 tbsp',store:'R150–R160 per kg (median R150) at Checkers, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:2.25},
   {name:'Walnuts or mixed nuts',dose:'1 small handful (30g)',store:'R430–R520 per kg (median R450) at Checkers, Game, Makro, Pick n Pay, Woolworths (checked 19 Oct 2026)',daily:13.49},
   {name:'Rolled oats',dose:'60g breakfast',store:'R41–R49 per kg (median R45) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:2.70},
   {name:'Seasonal fruit (bananas, berries)',dose:'1–2 servings',store:'R33–R38 per kg (median R35) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:6.92}]},
};

/* Why each shopping-list food is there, for the Food screen.
   `plan` lines restate something the plans above already say, with the same reference (printed page of the Natural
   Remedies Encyclopedia, or "N:" = Nedley chapter): to add one, put it in the plan's steps/facts first.
   `src:'ef'` lines paraphrase the Encyclopedia of Foods and Their Healing Power, Vol. 1 (BOOK3_REF), "F:76" = its
   printed page 76. Only what that page says about the food; its cancer claims are deliberately left out.
   `care` = a caution to show with the food. */
const FOOD_WHY={
 oats:[{plan:'bp',txt:'High-fibre plant foods help lower blood pressure, and oat bran is singled out.',ref:'526'},
  {plan:'bmi',txt:'Whole grains belong at breakfast, the biggest meal of the day. Choose rolled oats: quick oats and packaged cereals count as refined.',ref:'481 · N:11'},
  {plan:'mind',txt:'Part of a good plant-based breakfast of fruit, whole grains and a few nuts.',ref:'N:11'},
  {plan:'sleep',txt:'Oats are on the list of foods that support sleep.',ref:'547 · N:16'},
  {src:'ef',txt:'The grain richest in protein, calcium and iron. People with diabetes tolerate it very well, and oat bran lowers cholesterol.',ref:'F:64 · F:76'}],
 flax:[{plan:'bp',txt:'The Encyclopedia suggests flaxseed oil, 2 tbsp a day. Ground flaxseed is the cheaper way to get it.',ref:'526'},
  {plan:'bmi',txt:'Use only cold-pressed oils such as flaxseed. The book adds 2 tsp flaxseed oil at breakfast; ground flaxseed is cheaper.',ref:'532 · 481'},
  {plan:'mind',txt:'A sprinkle of ground flaxseed (with walnuts) adds omega-3 to breakfast.',ref:'N:11'},
  {src:'ef',txt:'Rich in soluble fibre that soothes the bowel and helps its healthy bacteria, and it also gives useful protein and fats. Whole seeds must be chewed well, so ground flaxseed is easier.',ref:'F:354'}],
 garlic:[{plan:'bp',txt:'Named for blood pressure, together with celery, tomatoes, broccoli and carrots.',ref:'526–527'},
  {plan:'sugar',txt:'Raw garlic, onions and green beans every day are named as lowering blood sugar.',ref:'657–658'},
  {plan:'mind',txt:'Garlic is among the foods named as especially good for the brain.',ref:'N:11'},
  {src:'ef',txt:'Lowers cholesterol and keeps the blood flowing freely. Its strong taste lets you use less salt, which helps people with high blood pressure.',ref:'F:109 · F:338'}],
 celery:[{plan:'bp',txt:'Named for blood pressure: about 4 stalks a day, raw, in the lunch salad.',ref:'526–527'},
  {src:'ef',txt:'Described as cleansing the blood and lowering cholesterol.',ref:'F:111'}],
 tomato:[{plan:'bp',txt:'Named for blood pressure, and potassium-rich fresh vegetables help the body get rid of extra sodium.',ref:'526–527'},
  {src:'ef',txt:'Protects the prostate and supports the immune system.',ref:'F:111'}],
 potato:[{plan:'bp',txt:'Unsalted potato soup with the skin is a good potassium source; potassium helps the body get rid of extra sodium.',ref:'526–527',
  care:'Potassium-rich foods can interact with blood-pressure pills or kidney disease. Mention them to your clinic first.'},
  {src:'ef',txt:'An almost complete, balanced food that settles excess stomach acid.',ref:'F:111'}],
 rice:[{plan:'sugar',txt:'Whole-grain porridge at a regular time. A high-fibre whole-food diet lowers the need for insulin.',ref:'657–658'},
  {plan:'sleep',txt:'Rice and corn are on the list of foods that support sleep.',ref:'547 · N:16'},
  {src:'ef',txt:'Whole grains release their sugar slowly, so people with diabetes tolerate them better than refined grains. Rice suits a diet for heart disease and high blood pressure, and maize (corn) lowers cholesterol.',ref:'F:65 · F:76–77'}],
 onion:[{plan:'sugar',txt:'Onions every day are named as lowering blood sugar.',ref:'657–658'},
  {src:'ef',txt:'Helps prevent hardening of the arteries; the onion family lowers cholesterol.',ref:'F:109'}],
 beans:[{plan:'sugar',txt:'Green beans every day are named as lowering blood sugar, and, cooked, they make a good snack instead of sweets.',ref:'657–658'},
  {src:'ef',txt:'Also described as lowering blood glucose and strengthening the heart.',ref:'F:109',
  care:'Always cook green beans. Raw green beans contain a natural toxin that cooking destroys.'}],
 lentils:[{plan:'sugar',txt:'Beans or lentils at lunch: plant protein with fibre lowers the need for insulin.',ref:'657–658'},
  {plan:'bmi',txt:'Beans with raw vegetables make a filling lunch, and every plant food is free of cholesterol.',ref:'481 · N:11'},
  {src:'ef',txt:'Lentils are very rich in iron and fibre, and useful with anaemia, constipation, diabetes and high cholesterol. Beans also lower cholesterol.',ref:'F:90–91'}],
 slaw:[{plan:'bmi',txt:'Eat as many raw vegetables as you like; avoid fried, frozen and canned ones.',ref:'481'},
  {plan:'bp',txt:'Carrots are among the foods named for blood pressure.',ref:'526–527'},
  {src:'ef',txt:'Cabbage is rich in calcium, which helps prevent weak bones, and helps heal stomach ulcers. Carrots protect the eyes and the skin.',ref:'F:106 · F:111'}],
 valerian:[{plan:'sleep',txt:'Valerian and hops are among the teas named for sleep, and herb teas are the easier way off sleeping pills.',ref:'548',
  care:'Do not use hops with valerian for more than 2 weeks without a break. Never stop sleeping tablets suddenly.'},
  {src:'ef',txt:'Valerian is noted for its calming (sedative) effect.',ref:'F:111'}],
 dates:[{plan:'sleep',txt:'Figs and dates are on the list of foods that support sleep, and a simple fruit meal makes an excellent light supper.',ref:'547 · N:16'},
  {src:'ef',txt:'Dates give vitamins, minerals and fibre; figs help digestion. Both soothe the airways.',ref:'F:46 · F:48'}],
 crackers:[{plan:'sleep',txt:'Whole-grain crackers are on the list of foods that support sleep.',ref:'547 · N:16'},
  {src:'ef',txt:'Choose whole grain: white flour, and bakery products made with white flour, fat and sugar, promote hardening of the arteries, diabetes and tooth decay.',ref:'F:72–73'}],
 nuts:[{plan:'mind',txt:'A few nuts at breakfast; walnuts add omega-3.',ref:'N:11'},
  {plan:'bmi',txt:'A whole-grain breakfast with fruit and a few nuts.',ref:'481 · N:11'},
  {src:'ef',txt:'Walnuts are recommended for people with heart disease: they lower cholesterol and steady the nerves.',ref:'F:58'}],
 fruit:[{plan:'mind',txt:'Plenty of fruit; berries are named as especially good for the brain.',ref:'N:11'},
  {plan:'sleep',txt:'Bananas are on the list of foods that support sleep.',ref:'547 · N:16'},
  {plan:'bp',txt:'Aim for at least five servings of fruit and vegetables every day.',ref:'527'},
  {src:'ef',txt:'Bananas are rich in potassium, which is good for the heart. Strawberries are a strong antioxidant that helps against hardening of the arteries.',ref:'F:46 · F:48'}],
};

/* ---------------------------------------------------------------------------------------------------------
   DIRECTIVE PLAN: what the visitor must DO, WHY (the book's reason) and HOW (concrete steps), most important first.
   The plan screen shows the first 3; the rest appear under "When these feel easy, add". WhatsApp and the printed
   card carry the same 3. Every `why`/`how` restates the plan's own steps and facts above, with the same reference;
   nothing new is claimed ("F:" = Encyclopedia of Foods, vol. 1). Optional per action:
     foods: food keys whose daily cost is shown       when(a): only for visitors it fits
     first(a): move to the top for this visitor      how items may be functions of the visitor (return '' to skip) */
const heavy=a=>{const b=bmi(a);return b!=null&&b>=25;};
const cholUp=a=>a.s.chol!=null&&a.s.chol>=5;
const PLAN_GOAL={bp:'Bring your blood pressure down',sugar:'Bring your blood sugar down',bmi:'Reach a healthy weight and cholesterol',
 sleep:'Sleep deeply again',mind:'Calm your mind'};
const ACTIONS={
 bp:[
  {do:'Stop adding salt, from today',why:'Leaving out added salt is the book’s first rule for high blood pressure.',ref:'527',
   how:['No salt in cooking or at the table','No stock cubes, soy sauce, MSG or salty processed food','Read labels: avoid sodium and preservatives']},
  {do:'Walk 30 minutes outdoors every day',why:'Daily outdoor exercise, enough rest and losing extra weight all lower blood pressure.',ref:'528 · N:13',
   how:['In daylight, for example at 16:30','Start gently and build up slowly','Heart disease or several heart risks? See a doctor before hard exercise']},
  {do:'Eat raw garlic, celery and tomato every day',why:'These are the foods the book names for blood pressure, and potassium-rich vegetables help the body get rid of extra sodium.',ref:'526–527',
   foods:['garlic','celery','tomato'],how:['A big raw salad at lunch: 2 cloves garlic, 2–4 celery stalks, 2 tomatoes','Unsalted potato soup, with the skin, is good too']},
  {do:'Drink about 8 cups of water a day',why:'Water keeps the blood thinner, so the heart does not have to pump so hard.',ref:'526 · N:17',
   how:['A full glass as soon as you get up','Spread the rest through the day']},
  {do:'Lose extra weight slowly',why:'Losing weight if you are overweight helps lower blood pressure.',ref:'528 · 480–481',when:heavy,
   how:['No crash diets: steady, nourishing meals','Biggest meal at breakfast, lightest at supper']},
  {do:'Take 10–20 slow, deep breaths after meals and before bed',why:'Slow belly breathing lowered heart rate and blood pressure in a study.',ref:'N:15',
   how:['Sit upright, in loose clothing','Outdoors in fresh air if you can']},
  {do:'End the day with a warm neutral bath and lights out by 22:00',why:'A neutral bath relaxes the nerves and helps sleep, and rest at night lowers pressure.',ref:'259 · 528',
   how:['34–36°C for 15–20 minutes, never hot','Lights out by 22:00']}],
 sugar:[
  {do:'Stop sugar and white flour, from today',why:'Sugar, white-flour foods and greasy food push blood sugar up, and coffee can push it very high.',ref:'657',
   how:['No sugar in drinks, no sweets, cakes or cold drinks','Swap white bread for whole grains: brown rice or whole maize meal','No coffee and no tobacco']},
  {do:'Walk briskly every day, twice if you can',why:'Exercise moves sugar out of the blood. The book calls it “insulin’s best friend”.',ref:'657–658 · N:13',
   how:['Warm up with 3–5 minutes of slow walking','Unfit? Repeat 60 seconds brisk, 30 seconds easy']},
  {do:'Eat raw onion, raw garlic and cooked green beans every day',why:'These three are named as lowering blood sugar.',ref:'657–658 · F:109',foods:['onion','garlic','beans'],
   how:['Raw onion and garlic in the lunch salad','Green beans always cooked, never raw','Cooked green beans make a good snack instead of sweets']},
  {do:'Eat small meals at regular times, and nothing late',why:'Overeating can bring diabetes on or make it worse; smaller meals at set times help.',ref:'657',
   how:['Breakfast, lunch and a small, early supper','Chew slowly: eating fast pushes sugar up','Nothing more to eat in the evening']},
  {do:'Build meals on whole grains, beans and lentils',why:'A high-fibre whole-food diet with plant protein lowers the need for insulin.',ref:'657',foods:['rice','lentils'],
   how:['Brown rice or whole maize meal porridge for breakfast','Beans or lentils at lunch']},
  {do:'Check both feet every evening',why:'Infections start more easily with high blood sugar.',ref:'658',
   how:['Look for cuts, blisters or sores','Avoid hot and cold extremes: a neutral bath (34–36°C) is the safe choice']},
  {do:'Drink water through the day',why:'Good hydration keeps the blood thinner; complications get worse when the blood is thick.',ref:'N:17',
   how:['Water or unsweetened herbal tea, not juice']}],
 bmi:[
  {do:'Make breakfast your biggest meal and supper the lightest',why:'Calories eaten in the morning are less likely to be stored as fat, and finishing a meal slightly hungry does no harm.',ref:'481 · N:11',
   foods:['oats'],how:['Breakfast: oats or another whole grain, with fruit and a few nuts','Supper early and light, or just fruit','Nothing to eat before bed',
    a=>a.s.weight?`About ${Math.round(a.s.weight*2.2046*13/50)*50} kcal a day keeps your weight steady; a little under that loses it gradually (p. 481)`:'']},
  {do:'Cut out fried food and animal fat',why:'Saturated fat, fried food and hydrogenated oil raise cholesterol, and every plant food is free of it.',ref:'532 · N:11',
   first:a=>cholUp(a)&&!heavy(a),foods:['flax'],how:['No meat fat, butter, cheese or fried food','Use only cold-pressed oils such as flaxseed','Smaller meals: large meals push the liver to make more cholesterol']},
  {do:'Stop snacking: only water between meals',why:'Cutting out snacks and drinking only water between meals is the first part of Dr Nedley’s weight programme.',ref:'N:11 · 481',
   how:['8–10 glasses of water a day','No juice, cold drinks or coffee','Hungry between meals? Make the meals more nourishing']},
  {do:'Walk 30 minutes or more outdoors every day',why:'Exercise lowers triglycerides even without weight loss; 30 minutes of brisk walking uses about 150 calories.',ref:'531–532 · N:13',
   how:['Aim for 10,000 steps a day','Build up slowly; heart disease? See a doctor first']},
  {do:'Fill up on raw vegetables',why:'You may eat as many raw vegetables as you like; avoid fried, frozen and canned ones.',ref:'481',foods:['slaw'],
   how:['Raw cabbage and carrot salad, about 300 g a day']},
  {do:'Choose whole grains, never refined',why:'Sugar, white flour, quick oats and packaged cereals are refined carbohydrates; cook whole grains instead.',ref:'481',
   how:['Rolled oats, brown rice, barley','No sugar, sweets or white bread']}],
 sleep:[
  {do:'Go to bed and get up at the same time every day',why:'Regular hours set the body clock, and a 9 pm bedtime gives the most melatonin.',ref:'548 · N:16',
   how:['In bed by 21:00–22:00, weekends too','You should wake without an alarm']},
  {do:'Get 30 minutes of daylight within 10 minutes of waking',why:'Morning daylight sets the body clock; bright light in the evening upsets it.',ref:'548 · N:14',
   how:['Outdoors, or breakfast near a sunny window','Dim the lights in the evening']},
  {do:'No caffeine or alcohol, and a light supper 3–4 hours before bed',why:'Caffeine can halve melatonin for about 6 hours, alcohol cuts deep sleep, and fatty or sugary food at night keeps you awake.',ref:'547 · N:16',
   foods:['dates','crackers'],how:['No coffee, strong tea, cola or alcohol','Supper: fruit, or a few dates or figs and whole-grain crackers','No meat, sugar or fatty food at night']},
  {do:'Make the last hour calm',why:'Guilt and stress keep people awake; a calm mind and a neutral bath help sleep.',ref:'N:16 · 259',
   how:['TV and phone off; calming reading or music for 15–30 minutes','A warm neutral bath (34–36°C), or slow deep breaths in fresh air']},
  {do:'Keep the bedroom cool, dark and quiet',why:'A cool (about 15–18°C), dark, quiet, tidy room with fresh air helps sleep.',ref:'548 · N:16',
   how:['Only a dim light if you wake at night']},
  {do:'Valerian tea 30 minutes before bed, if you like',why:'Valerian and hops are teas named for sleep, and the easier way off sleeping pills.',ref:'548',foods:['valerian'],
   how:['Not hops with valerian for more than 2 weeks without a break','Never stop sleeping tablets suddenly']}],
 mind:[
  {do:'Get outside: morning daylight and a 30-minute walk',why:'Morning light helps tiredness, poor sleep and low mood, and regular exercise lowers anxiety and low mood.',ref:'N:14 · N:13',
   how:['30 minutes of daylight within 10 minutes of waking','Walk, garden or any activity you enjoy']},
  {do:'Catch one worrying thought a day and check it',why:'Ten common thinking traps make worries feel worse; checking a thought against them changes how it feels.',ref:'N:1–10',
   how:['Evening, 5 minutes: write the worry down','Ask which trap it is, e.g. all-or-nothing or fortune telling','Write a more balanced version, and one good thing that really counts']},
  {do:'Connect with someone every day',why:'Close family and friends protect mental health.',ref:'N:18',
   how:['Call or visit a friend or family member','Join a church or community activity']},
  {do:'Take 10–20 slow, deep breaths after meals and before bed',why:'Slow belly breathing relaxes the body, improves mood and helps sleep.',ref:'N:15',
   how:['Sit upright, in loose clothing, in fresh air']},
  {do:'Drink water from the moment you wake',why:'Good hydration helps thinking, concentration and headaches.',ref:'N:17',how:['8–10 glasses across the day']},
  {do:'A plant breakfast with flaxseed and walnuts',why:'Fruit, whole grains and nuts are good for the brain; flaxseed and walnuts add omega-3.',ref:'N:11',foods:['oats','flax','nuts'],
   how:['Oats with fruit, ground flaxseed and a few walnuts']},
  {do:'A calm evening and lights out by 21:30',why:'Poor sleep and stress feed each other; soothing music or spiritual reading helps.',ref:'N:16 · N:19',
   how:['15–30 minutes of calm music or reading, and a short prayer','Cool, dark, quiet room']}],
};
/* When to check again: the step that closes the 21 days. */
const RECHECK={bp:['Have your blood pressure checked again in 3 weeks, at a clinic or pharmacy.','528'],
 sugar:['Have your blood sugar checked again in 3 weeks, at your clinic.',''],
 bmi:['Check your weight again in 3 weeks, on the same scale.',''],
 sleep:['Write down your hours of sleep each night for the 3 weeks.',''],
 mind:['Low mood or worry lasting more than 2 weeks, or stopping you working or sleeping? See your clinic.','']};

const HUES=['mint','sky','lilac','sage','blush','sand','aqua','peach'];
const hueOf=id=>HUES[[...String(id)].reduce((t,c)=>t+c.charCodeAt(0),0)%HUES.length];
const HUE_P={bp:'blush',sugar:'sand',bmi:'sky',sleep:'lilac',mind:'aqua'};
/* "527" → "p. 527"; "N:16" → "Nedley ch. 16"; "N:1–10" → "Nedley chs. 1–10"; joined with " · " */
/* "F:76" → "vol. 1, p. 76" = Encyclopedia of Foods and Their Healing Power (Food screen only) */
function refLabel(pg){
 return String(pg).split(' · ').map(x=>{
  const f=x.match(/^F:(.+)$/);if(f)return (/[–-]/.test(f[1])?'vol. 1, pp. ':'vol. 1, p. ')+f[1];
  const m=x.match(/^N:(.+)$/);return m?(/[–-]/.test(m[1])?'Nedley chs. ':'Nedley ch. ')+m[1]:'p. '+x;}).join(' · ');
}
/* which books a plan actually draws on, so the credit line only names those */
function planBooks(p,extra){
 const refs=[...p.steps.map(s=>s[2]),...p.facts.map(f=>f[1]),...(extra||[])].join(' · ');
 const out=[];
 if(/(^|\s)\d{3}/.test(refs.replace(/[NF]:[\d–-]+/g,'')))out.push(BOOK_REF);
 if(/N:/.test(refs))out.push(BOOK2_REF);
 if(/F:/.test(refs))out.push(BOOK3_REF);
 return out;
}
const planCredit=p=>planBooks(p).join(' and ');
```

Replace with:

```html
/* ---------------------------------------------------------------------------------------------------------
   The five plans rest on two public-domain books by Seventh-day Adventist health pioneers, always in our own words:
     "MH:23"     = chapter 23 of The Ministry of Healing (Ellen G. White, 1905)
     "K:395–396" = printed pages of Rational Hydrotherapy (J. H. Kellogg, M.D., 1901)
   Two tags name lines that come from no book: "G" = general advice, "S" = the expo's own safety rule.
   Several references can be joined with " · ". See PLANS.md for where each one was checked.
   "steps"  = the day, in order (each with its reference)
   "facts"  = what the plan is based on, with references
   "items"  = shopping list with APPROXIMATE South African prices (neither book has prices; check locally)
   "habits" = the three-line summary used on the WhatsApp message and the take-home card
   "note"   = a plan-specific safety note;  "help" = a get-help line shown prominently (mind and sleep plans)  */
const BOOK_REF='The Ministry of Healing (Ellen G. White, 1905; public domain)';
const BOOK2_REF='Rational Hydrotherapy (J. H. Kellogg, M.D., 1901; public domain)';
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
  src:'The Ministry of Healing: chs. 17, 18, 20, 23, 25, 26 · Rational Hydrotherapy: pp. 197, 372, 377, 383–384, 395–396',
  mech:'Built on The Ministry of Healing’s counsel (no late eating, no stimulants, daily outdoor exercise, fresh air and sunlight in the bedroom, a thankful mind) and Dr Kellogg’s neutral bath at bedtime.',
  steps:[
   ['07:00','Get up at the same time every day. Open the curtains and windows, and get outside in the morning light.','G · MH:20'],
   ['07:30','Start the day thankful: a short prayer of thanks for the night and the new day.','MH:18'],
   ['12:30','Make breakfast and lunch the main meals. No tea, coffee, cola or tobacco: they stimulate, and sleeplessness follows.','MH:23 · MH:26'],
   ['16:30','A walk or outdoor work in the late afternoon.','MH:17'],
   ['18:00','A light, early supper, or just fruit and a few crackers. Nothing more to eat after it.','MH:23 · MH:25'],
   ['20:00','Dim the lights and switch off the TV and phone. Set the day’s worries aside and sing or read something calming.','G · MH:18'],
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
   ['Poor sleep for weeks, or feeling low or anxious, is a reason to see your clinic.','S']],
  note:'Some medicines (including some for blood pressure, anxiety and depression) can disturb sleep. Ask your clinic, and never stop them yourself. Do not stop sleeping tablets suddenly. If sleep has been poor for weeks, or you feel low or anxious, see your clinic.',
  help:HELP_LINE,
  habits:['The same bed and wake time every day, with morning light and fresh air','A light early supper, and no tea, coffee or tobacco','A neutral bath, slow deep breaths and lights out by 22:00'],
  items:[
   {name:'Figs or dates',dose:'2–3 pieces',store:'R82–R111 per kg (median R96) at Checkers, Makro, Pick n Pay, SPAR, Shoprite, Woolworths — priced as dates; no dried figs were found priced online (checked 19 Oct 2026)',daily:2.40},
   {name:'Whole-grain crackers',dose:'2–3',store:'R180–R188 per kg (median R184) at Checkers, Game, Pick n Pay, Shoprite, Woolworths (checked 19 Oct 2026)',daily:4.60},
   {name:'Seasonal fruit (bananas, berries)',dose:'1–2 servings',store:'R33–R38 per kg (median R35) at Checkers, Pick n Pay, SPAR, Shoprite, Woolworths (checked 19 Oct 2026)',daily:6.92}]},

 mind:{tag:'Stress & mood',tagline:'Calm-mind plan',title:'Stress, Worry & Low Mood — Home Plan',
  src:'The Ministry of Healing: chs. 8, 17, 18, 19, 20, 23, 26 · Rational Hydrotherapy: pp. 197, 372, 383–384, 395–396',
  mech:'Built on The Ministry of Healing’s chapters on the mind and on nature: mind and body affect each other, so time outdoors, exercise, deep breathing, simple food, gratitude, song, helping others and trust in God all lift the spirits.',
  steps:[
   ['06:30','Get up and thank God for the night and the new day. Drink a glass of water.','MH:18 · MH:17'],
   ['07:00','Spend time outdoors in the morning light: walk, garden, or sit among trees and flowers.','MH:19'],
   ['07:30','A simple plant breakfast: oats or another whole grain, with fruit and a few nuts.','MH:23'],
   ['12:30','Midday: a brisk walk or useful work outdoors. Work with the hands lifts a heavy mind.','MH:17'],
   ['13:30','After lunch: a few minutes of slow, deep breaths in fresh air, sitting up straight.','MH:20'],
   ['16:00','Do one kind thing for someone else: a visit, a call or a helping hand.','MH:18'],
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
   ['Trust in God is one of the true remedies.','MH:8']],
  note:'This plan supports good care; it does not replace a clinic. Low mood or worry that lasts more than a couple of weeks, or that stops you working or sleeping, is a reason to see your clinic.',
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
   how:['Set the day’s worries aside','A short prayer of thanks']}],
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
   how:['Oats with fruit and a few nuts']}],
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
/* "MH:23" → "Ministry of Healing ch. 23"; "K:395–396" → "Kellogg pp. 395–396"; "G" / "S" → what the line rests on */
const REF_TAG={G:'general advice',S:'expo safety rule'};
function refLabel(pg){
 return String(pg).split(' · ').map(x=>{
  if(REF_TAG[x])return REF_TAG[x];
  const k=x.match(/^K:(.+)$/);if(k)return (/[–-]/.test(k[1])?'Kellogg pp. ':'Kellogg p. ')+k[1];
  const m=x.match(/^MH:(.+)$/);return m?'Ministry of Healing ch. '+m[1]:x;}).join(' · ');
}
/* which books a plan actually draws on, so the credit line only names those */
function planBooks(p,extra){
 const refs=[...p.steps.map(s=>s[2]),...p.facts.map(f=>f[1]),...(extra||[])].join(' · ');
 const out=[];
 if(/(^|\s)MH:/.test(refs))out.push(BOOK_REF);
 if(/(^|\s)K:/.test(refs))out.push(BOOK2_REF);
 return out;
}
const planCredit=p=>planBooks(p).join(' and ');
```

### E2  (`index.html`, serves F2)

Why: counselling sliders on Results cite the old book's pages; now the public-domain sources

Find (exactly once):

```html
'No added salt; oats or whole grains, raw vegetables, garlic, celery and plenty of water (book, pp. 526–527).'
```

Replace with:

```html
'Little salt; oats or whole grains, plenty of vegetables and fruit, and plain water (Ministry of Healing chs. 17, 23).'
```

### E3  (`index.html`, serves F2)

Why: walk slider cited the old book

Find (exactly once):

```html
'A daily outdoor walk in daylight, with 8–10 glasses of water through the day (book, pp. 481, 528).'
```

Replace with:

```html
'A brisk walk outdoors in daylight every day, with plenty of plain water (Ministry of Healing ch. 17).'
```

### E4  (`index.html`, serves F2)

Why: bath slider cited the old book and the old 34–36°C range

Find (exactly once):

```html
'A warm (not hot) neutral bath before bed and lights out before 22:00 (book, pp. 259, 528).'
```

Replace with:

```html
'A neutral bath (33–35°C, never hot) before bed and lights out before 22:00 (Kellogg pp. 395–396).'
```

### E5  (`index.html`, serves F2)

Why: BOOK_REF now starts with "The", so "from the ${BOOK_REF}" would read "the The"

Find (exactly once):

```html
The plans come from the ${BOOK_REF} and ${BOOK2_REF}.
```

Replace with:

```html
The plans draw, in our own words, on ${BOOK_REF} and ${BOOK2_REF}.
```

### E6  (`index.html`, serves F3)

Why: the BP bands are the expo's screening bands, not a book's

Find (exactly once):

```html
/* The reading in the book's own terms (blood pressure bands: High Cholesterol chapter, p. 532). */
```

Replace with:

```html
/* The reading in the expo's screening bands: normal, pre-hypertension, stage 1, stage 2. */
```

### E7  (`index.html`, serves F3)

Why: the BP reason cited the old book's page

Find (exactly once):

```html
is ${bpStage(a.s.sys,a.s.dia)} (book, p. 532)`});
```

Replace with:

```html
is ${bpStage(a.s.sys,a.s.dia)}`});
```

### E8  (`index.html`, serves F3)

Why: the sugar reason quoted the old book's limit and page

Find (exactly once):

```html
(${Math.round(a.s.sugar*18)} mg/dL). The book’s limit without diabetes is 110 mg/dL (p. 657)`});
```

Replace with:

```html
(${Math.round(a.s.sugar*18)} mg/dL) is above the expo’s healthy range`});
```

### E9  (`index.html`, serves F3)

Why: the BMI reason cited the old book's definition and page

Find (exactly once):

```html
is above the healthy range (the book counts about 20% over average weight as overweight, p. 480)`);
```

Replace with:

```html
is above the healthy range`);
```

### E10  (`index.html`, serves F3)

Why: the cholesterol reason quoted the old book's level and page

Find (exactly once):

```html
(${Math.round(a.s.chol*38.67)} mg/dL); the book’s good level is under 200 (p. 532)`);
```

Replace with:

```html
(${Math.round(a.s.chol*38.67)} mg/dL) is above the expo’s healthy range`);
```

### E11  (`index.html`, serves F3)

Why: the sleep reason cited both old books

Find (exactly once):

```html
The books ask for regular hours and a calm, light evening (Encyclopedia p. 547; Nedley ch. 16)`});
```

Replace with:

```html
The plan builds regular hours, fresh air and a calm, light evening`});
```

### E12  (`index.html`, serves F3)

Why: the stress reason cited the old book's thinking habits

Find (exactly once):

```html
The calm-mind plan pairs daily habits with ten thinking habits (Nedley, chs. 1–19)'});
```

Replace with:

```html
The calm-mind plan pairs time outdoors with gratitude, kindness and rest'});
```

### E13  (`index.html`, serves F4)

Why: the calorie rule of thumb came only from the old book; removed (its value)

Find (exactly once):

```html
 const kcal=P.pk==='bmi'&&a.s.weight?Math.round(a.s.weight*2.2046*13/50)*50:0;
```

Replace with:

```html

```

### E14  (`index.html`, serves F4)

Why: food button said "why the books include it"

Find (exactly once):

```html
What each food costs, and why the books include it.</span></span>
```

Replace with:

```html
What each food costs, and why it is in the plan.</span></span>
```

### E15  (`index.html`, serves F4)

Why: the calorie rule of thumb came only from the old book; removed (its box)

Find (exactly once):

```html
   ${kcal?`<div class="mt-3 rounded-[14px] bg-white/60 px-3 py-2 text-[11px] leading-snug text-[#33504f]">The book’s rule of thumb (p. 481): about <b>${kcal} kcal a day</b> keeps weight steady. Eating a little under that loses weight gradually. Avoid crash diets.</div>`:''}
```

Replace with:

```html

```

### E16  (`index.html`, serves F4)

Why: the folded section is what the plan is based on, not "what the books say"

Find (exactly once):

```html
<summary>Everything the books say</summary>
```

Replace with:

```html
<summary>What this plan is based on</summary>
```

### E17  (`index.html`, serves F4)

Why: the source footer explained the old books' reference styles

Find (exactly once):

```html
“p.” = the Natural Remedies Encyclopedia’s printed pages; “Nedley ch.” = chapters of The Lost Art of Thinking; “vol. 1, p.” = the Encyclopedia of Foods. Paraphrased: open the book at the same place for the full text.</p>
```

Replace with:

```html
“Ministry of Healing ch.” = a chapter of The Ministry of Healing; “Kellogg p.” = a printed page of Rational Hydrotherapy. Both books are in the public domain, and the advice is in our own words. Lines marked “general advice” or “expo safety rule” come from no book.</p>
```

### E18  (`index.html`, serves F4)

Why: Food screen comment

Find (exactly once):

```html
   stores) and, on tap, why the books include it and how its price was worked out. Prices: FOOD_PRICES (written by
```

Replace with:

```html
   stores) and, on tap, why it is in the plan and how its price was worked out. Prices: FOOD_PRICES (written by
```

### E19  (`index.html`, serves F4)

Why: the Encyclopedia of Foods lines are gone, so its ranking branch goes too

Find (exactly once):

```html
 /* this plan's reasons first, then the Encyclopedia of Foods, then the other plans */
 const rank=w=>w.plan===plan?0:w.src==='ef'?1:2;
```

Replace with:

```html
 /* this plan's reasons first, then the other plans */
 const rank=w=>w.plan===plan?0:1;
```

### E20  (`index.html`, serves F4)

Why: the Encyclopedia of Foods tag is gone; every reason is tagged with its plan

Find (exactly once):

```html
  ${why.length?why.map(w=>`<div class="fd-why">${w.src==='ef'?'<span class="fd-tag hue-sage">Encyclopedia of Foods</span>'
    :`<span class="fd-tag hue-${HUE_P[w.plan]}">${esc(PROTOCOLS[w.plan].tag)}</span>`}
```

Replace with:

```html
  ${why.length?why.map(w=>`<div class="fd-why"><span class="fd-tag hue-${HUE_P[w.plan]}">${esc(PROTOCOLS[w.plan].tag)}</span>
```

### E21  (`index.html`, serves F4)

Why: empty-reason text named the books

Find (exactly once):

```html
No reason from the books is recorded for this food yet.
```

Replace with:

```html
No reason is recorded for this food yet.
```

### E22  (`index.html`, serves F4)

Why: Food screen intro said "why the books include it"

Find (exactly once):

```html
and why the books include it. Tap a food to see why.</p>
```

Replace with:

```html
and why it is in the plan. Tap a food to see why.</p>
```

### E23  (`index.html`, serves F4)

Why: Food screen footer named all three old books

Find (exactly once):

```html
Why each food — from three books: ${esc(BOOK_REF)} (“p.”); ${esc(BOOK2_REF)} (“Nedley ch.”); and ${esc(BOOK3_REF)} (“vol. 1, p.”). Paraphrased: open the book at the same place for the full text.</p>
```

Replace with:

```html
Why each food — in our own words, from ${esc(BOOK_REF)} (“Ministry of Healing ch.”).</p>
```

### E24  (`index.html`, serves F4)

Why: the card's short book names no longer need the ", 7th" edition split

Find (exactly once):

```html
.map(b=>b.split(' (')[0].split(', 7th')[0]).join('; ');
```

Replace with:

```html
.map(b=>b.split(' (')[0]).join('; ');
```

### H1  (`.smoke/harness.js`, serves F5)

Why: export ACTIONS and FOOD_WHY so every reference in them can be checked

Find (exactly once):

```js
  'planFor', 'PRICE_DATE',
```

Replace with:

```js
  'planFor', 'PRICE_DATE', 'ACTIONS', 'FOOD_WHY',
```

### H2  (`.smoke/harness.js`, serves F5)

Why: section title and the reference format: Ministry of Healing chapter, Kellogg page, G or S

Find (exactly once):

```js
  /* ---- 21. plans built from the Natural Remedies Encyclopedia --------- */
  console.log('\n21. Book-based plans');
  const PL = g.PROTOCOLS;
  const PART = '(?:\\d{3}(?:[–-]\\d{3})?|N:\\d{1,2}(?:[–-]\\d{1,2})?)', PAGE = new RegExp('^' + PART + '(?: · ' + PART + ')*$');
```

Replace with:

```js
  /* ---- 21. plans built from public-domain Adventist books ------------- */
  console.log('\n21. Book-based plans');
  const PL = g.PROTOCOLS;
  const PART = '(?:MH:\\d{1,2}|K:\\d{3}(?:[–-]\\d{3})?|G|S)', PAGE = new RegExp('^' + PART + '(?: · ' + PART + ')*$');
```

### H3  (`.smoke/harness.js`, serves F5)

Why: old-book reference checks replaced by checks on the new sources

Find (exactly once):

```js
  ok('cited Encyclopedia pages sit inside the chapters used (256–259, 480–482, 526–528, 531–532, 547–548, 656–658)',
    plans.every(k => allRefs(k).filter(r => !r.startsWith('N:')).every(pg => pg.match(/\d{3}/g).every(n => [[256, 259], [480, 482], [526, 528], [531, 532], [547, 548], [656, 658]].some(([a, b]) => +n >= a && +n <= b)))));
  ok('cited Nedley chapters are real lifestyle or thinking chapters (1–19)',
    plans.every(k => allRefs(k).filter(r => r.startsWith('N:')).every(r => r.slice(2).split(/[–-]/).every(n => +n >= 1 && +n <= 19))));
  ok('Nedley references are chapters, never invented page numbers', plans.every(k => allRefs(k).filter(r => r.startsWith('N:')).every(r => !/\d{3}/.test(r))));
```

Replace with:

```js
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
```

### H4  (`.smoke/harness.js`, serves F5)

Why: the hot-bath caution is now Dr Kellogg's, worded "never a hot bath"

Find (exactly once):

```js
  ok('no plan tells people to take a HOT foot bath (the book cautions against it for diabetes and numb feet)',
    plans.every(k => !PL[k].steps.some(s => /foot bath/i.test(s[1]))) && /do not use hot tub baths/i.test(PL.bp.hydro) && /extremes/i.test(PL.sugar.hydro));
  ok('every bath named in a plan is the neutral bath (34–36°C)', plans.filter(k => PL[k].hydro).every(k => /34–36°C/.test(PL[k].hydro)));
```

Replace with:

```js
  ok('no plan tells people to take a HOT foot bath, and the hot-bath cautions stay (Kellogg pp. 197, 372, 377)',
    plans.every(k => !PL[k].steps.some(s => /foot bath/i.test(s[1]))) && /never a hot bath/i.test(PL.bp.hydro) && /extremes/i.test(PL.sugar.hydro));
  ok('every bath named in a plan is the neutral bath (33–35°C, Kellogg p. 395)', plans.filter(k => PL[k].hydro).every(k => /33–35°C/.test(PL[k].hydro)));
```

### H5  (`.smoke/harness.js`, serves F5)

Why: credits, labels and the stress plan now follow the new sources

Find (exactly once):

```js
  ok('the Encyclopedia is credited in full', /Natural Remedies Encyclopedia/.test(g.BOOK_REF) && /Ferrell/.test(g.BOOK_REF) && /Cherne/.test(g.BOOK_REF));
  ok('The Lost Art of Thinking is credited in full', /Lost Art of Thinking/.test(g.BOOK2_REF) && /Nedley/.test(g.BOOK2_REF) && /2011/.test(g.BOOK2_REF));
  ok('reference labels read naturally', g.refLabel('527') === 'p. 527' && g.refLabel('526–528') === 'p. 526–528' && g.refLabel('N:16') === 'Nedley ch. 16'
    && g.refLabel('N:1–10') === 'Nedley chs. 1–10' && g.refLabel('548 · N:14 · N:16') === 'p. 548 · Nedley ch. 14 · Nedley ch. 16');
  ok('every plan credits the books it really uses', plans.every(k => g.planBooks(PL[k]).length >= 1) && g.planBooks(PL.bp).length === 2 && g.planBooks(PL.mind).length === 2
    && g.planCredit(PL.sleep).includes('Natural Remedies Encyclopedia') && g.planCredit(PL.sleep).includes('The Lost Art of Thinking'));
  ok('the stress & mood plan teaches all ten thinking traps in order, each tied to its chapter',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(n => PL.mind.facts.some(([t, r]) => t.startsWith('Thinking trap ' + n + ',') && r === 'N:' + n)));
```

Replace with:

```js
  ok('The Ministry of Healing is credited in full, as public domain', /The Ministry of Healing/.test(g.BOOK_REF) && /Ellen G\. White/.test(g.BOOK_REF) && /1905/.test(g.BOOK_REF) && /public domain/.test(g.BOOK_REF));
  ok('Rational Hydrotherapy is credited in full, as public domain', /Rational Hydrotherapy/.test(g.BOOK2_REF) && /Kellogg/.test(g.BOOK2_REF) && /1901/.test(g.BOOK2_REF) && /public domain/.test(g.BOOK2_REF));
  ok('reference labels read naturally', g.refLabel('MH:23') === 'Ministry of Healing ch. 23' && g.refLabel('K:377') === 'Kellogg p. 377' && g.refLabel('K:395–396') === 'Kellogg pp. 395–396'
    && g.refLabel('S') === 'expo safety rule' && g.refLabel('G · MH:20') === 'general advice · Ministry of Healing ch. 20');
  ok('every plan credits the books it really uses', plans.every(k => g.planBooks(PL[k]).length >= 1) && g.planBooks(PL.bp).length === 2 && g.planBooks(PL.bmi).length === 1
    && g.planCredit(PL.sleep).includes('The Ministry of Healing') && g.planCredit(PL.sleep).includes('Rational Hydrotherapy'));
  ok('the stress & mood plan rests on gratitude, kindness, song and time outdoors, not on thinking traps',
    ['thankful spirit', 'helping those in need', 'Singing', 'Time outdoors'].every(w => PL.mind.facts.some(([t]) => t.includes(w))) && !/Thinking trap/.test(JSON.stringify(PL.mind)));
```

### H6  (`.smoke/harness.js`, serves F5)

Why: the BP bands are the expo's own, so the test names drop "book"

Find (exactly once):

```js
  /* the book's blood-pressure bands (p. 532) */
  ok('book BP bands: normal / pre / stage 1 / stage 2',
```

Replace with:

```js
  /* the expo's blood-pressure screening bands */
  ok('BP bands: normal / pre / stage 1 / stage 2',
```

### H7  (`.smoke/harness.js`, serves F5)

Why: test name drops "book"

Find (exactly once):

```js
  ok('book BP bands: missing numbers give nothing',
```

Replace with:

```js
  ok('BP bands: missing numbers give nothing',
```

### H8  (`.smoke/harness.js`, serves F5)

Why: reasons no longer cite a book page

Find (exactly once):

```js
  ok('…each with a reason in plain words and the book page', nDav.every(n => n.why.length > 20 && /p\. \d{3}/.test(n.why)));
  ok('…the BP reason uses the book band and the sugar reason shows mg/dL',
```

Replace with:

```js
  ok('…each with a reason in plain words, citing no book page', nDav.every(n => n.why.length > 20 && !/p\. \d{3}|book|Nedley|Encyclopedia/i.test(n.why)));
  ok('…the BP reason uses the screening band and the sugar reason shows mg/dL',
```

### H9  (`.smoke/harness.js`, serves F5)

Why: Plan screen shows the new reference labels, credits and safety note

Find (exactly once):

```js
  ok('…shows the plan steps with book page numbers', /p\. 526/.test($main.innerHTML) && $main.innerHTML.includes('Source: ' + PL.bp.src));
  ok('…lists what the books advise, and credits both books', $main.innerHTML.includes('Everything the books say') && $main.innerHTML.includes('Natural Remedies Encyclopedia') && $main.innerHTML.includes('The Lost Art of Thinking'));
  ok('…labels Nedley references as chapters', /Nedley ch\. 17/.test($main.innerHTML));
```

Replace with:

```js
  ok('…shows the plan steps with their sources', /Ministry of Healing ch\. 23/.test($main.innerHTML) && $main.innerHTML.includes('Source: ' + PL.bp.src));
  ok('…lists what the plan is based on, and credits both public-domain books', $main.innerHTML.includes('What this plan is based on') && $main.innerHTML.includes('The Ministry of Healing (Ellen G. White, 1905') && $main.innerHTML.includes('Rational Hydrotherapy (J. H. Kellogg'));
  ok('…labels Kellogg references as pages', /Kellogg pp\. 395–396/.test($main.innerHTML));
```

### H10  (`.smoke/harness.js`, serves F5)

Why: the hawthorn note is gone; the kidney caution stays

Find (exactly once):

```js
/Never stop prescribed pills suddenly/.test($main.innerHTML) && /Hawthorn/.test($main.innerHTML));
```

Replace with:

```js
/Never stop prescribed pills suddenly/.test($main.innerHTML) && /kidney disease/.test($main.innerHTML));
```

### H11  (`.smoke/harness.js`, serves F5)

Why: the calorie rule of thumb came only from the old book and is removed

Find (exactly once):

```js
  ok('weight plan shows the book\'s calorie rule of thumb for David (94 kg → about 2700 kcal)', /2700 kcal a day/.test($main.innerHTML) && /p\. 481/.test($main.innerHTML), ($main.innerHTML.match(/about <b>[^<]+/) || [])[0]);
```

Replace with:

```js
  ok('the weight plan shows no calorie rule of thumb (it came only from the old book)', !/kcal/.test($main.innerHTML));
```

### H12  (`.smoke/harness.js`, serves F5)

Why: the stress plan screen shows its gratitude habit and chapter labels

Find (exactly once):

```js
  ok('the stress plan shows all ten thinking traps and Nedley chapter labels', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(n => $main.innerHTML.includes('Thinking trap ' + n + ',')) && /Nedley chs\. 1–10/.test($main.innerHTML));
```

Replace with:

```js
  ok('the stress plan screen shows its gratitude habit and Ministry of Healing chapter labels', $main.innerHTML.includes('Write down three good things each evening') && /Ministry of Healing ch\. 18/.test($main.innerHTML));
```

### H13  (`.smoke/harness.js`, serves F5)

Why: the WhatsApp message carries the new source line

Find (exactly once):

```js
msg2.includes('Hypertension, pp. 526–528') && msg2.includes('Natural Remedies Encyclopedia'), top3.join(' | '));
```

Replace with:

```js
msg2.includes(PL.bp.src) && msg2.includes('The Ministry of Healing'), top3.join(' | '));
```

### H14  (`.smoke/harness.js`, serves F5)

Why: the WhatsApp preview carries the new source line

Find (exactly once):

```js
$el('waBody').innerHTML.includes('Hypertension, pp. 526–528'));
```

Replace with:

```js
$el('waBody').innerHTML.includes(PL.bp.src));
```

### H15  (`.smoke/harness.js`, serves F5)

Why: the card credits the new book

Find (exactly once):

```js
/store prices checked \d+ \w+ \d{4}; may vary by branch/.test($el('printArea').innerHTML) && /Natural Remedies Encyclopedia/.test($el('printArea').innerHTML));
```

Replace with:

```js
/store prices checked \d+ \w+ \d{4}; may vary by branch/.test($el('printArea').innerHTML) && /The Ministry of Healing/.test($el('printArea').innerHTML));
```

### H16  (`.smoke/harness.js`, serves F5)

Why: the stress plan's message credits the new book

Find (exactly once):

```js
mindTop.every(d => mindMsg.includes(d)) && mindMsg.includes('The Lost Art of Thinking') && /0800 567 567/.test(mindMsg));
```

Replace with:

```js
mindTop.every(d => mindMsg.includes(d)) && mindMsg.includes('The Ministry of Healing') && /0800 567 567/.test(mindMsg));
```

### H17  (`.smoke/harness.js`, serves F5)

Why: the stress plan's card credits the new book

Find (exactly once):

```js
/0800 567 567/.test($el('printArea').innerHTML) && /The Lost Art of Thinking/.test($el('printArea').innerHTML));
```

Replace with:

```js
/0800 567 567/.test($el('printArea').innerHTML) && /The Ministry of Healing/.test($el('printArea').innerHTML));
```

### P1 PLANS.md provenance  (`PLANS.md`, serves F6)

Why: rewrites where the plans come from: the two public-domain books, what each chapter/page supports, G and S lines, what was left out, and that no doctor or church body has approved the plans

Find (exactly once):

```md
# Where the plans come from

The five plans on the **Plan** tab, the WhatsApp message and the take-home card are built from two books:

> *Natural Remedies Encyclopedia*, 7th enlarged edition — Vance Ferrell & Harold M. Cherne, M.D. (Harvestime Books)
> *The Lost Art of Thinking* — Neil Nedley, M.D. (Nedley Publishing, 2011)

Every step and every "What the books advise" line shows where it comes from:

- **`p. 527`** — a printed page of the Encyclopedia, so a volunteer can open the same page.
- **`Nedley ch. 16`** — a chapter of *The Lost Art of Thinking*. That book's printed page numbers are not reliable in
  the file we have, so it is cited by chapter, never by an invented page.

The advice is paraphrased, never copied out, and the credit line names only the books a plan actually uses.

| Plan | Encyclopedia (printed pages) | Nedley (chapters) |
| --- | --- | --- |
| Blood pressure | Hypertension 526–528 · bands 532 · neutral bath 259 · overweight 480 | 13 exercise · 15 breathing · 17 water |
| Blood sugar | Diabetes 656–658 · hydrotherapy cautions 256–259 | 11 food · 13 exercise · 17 water |
| Weight & cholesterol | Overweight 480–482 · High cholesterol & triglycerides 531–532 | 11 (his five-part weight-loss programme, cholesterol) · 13 · 17 |
| Sleep | Insomnia 547–548 · neutral bath 259 | 16 "Rewind in Your Sleep" · 14 light · 15 breathing |
| Stress & mood | Neutral bath 259 | 1–10 ten thinking habits · 11, 13–19 lifestyle |

## How a person is matched to a plan

`planNeeds()` reads the screening numbers and lists what needs attention, in this order: red-flag blood pressure,
red-flag sugar, amber blood pressure, amber sugar, weight/cholesterol, **stress & mood**, sleep. The first item is the
plan that opens; the others are one tap away. Each line explains the reading in the books' own terms.

**Stress & mood** is offered only when the volunteer ticks *Stress & peace* on the Screen tab (the follow-up card). The app
does not diagnose anyone's mood. A real medical flag (blood pressure, sugar) always comes first.

## Get-help line

The sleep and stress & mood plans show a prominent "Need help now?" box, and include the same words in the WhatsApp message
and on the printed card: the SADAG suicide crisis line (0800 567 567), Lifeline (0861 322 322), and the advice to go to the
nearest clinic or emergency service. **Check these numbers and their hours with SADAG (sadag.org) and Lifeline
(lifelinesa.co.za) before the expo**; published sources disagree on the opening hours. The text is one constant,
`HELP_LINE`, in `index.html`.

## What was deliberately left out

Both books contain advice that is unsafe or contested to hand out at a health expo, so these are **not** in the plans:
high-dose vitamin, mineral and omega-3 supplements, fasting days, strong herbal formulas, cayenne in teaspoon doses, hot
baths for people with diabetes or high blood pressure, "aggressive" exercise targets for everyone, and any suggestion to
reduce medicine. The app's rule stays: **never stop prescribed pills suddenly; the clinic adjusts them.** The books'
own cautions are kept: no extreme hot/cold treatments in diabetes (Encyclopedia p. 256), no hot foot bath with hardened
arteries or numb feet (p. 257), no hot tub bath with high blood pressure or diabetes (p. 259), and see a doctor before
vigorous exercise with heart disease or several heart risk factors (Nedley ch. 13).

Where the two books disagree the plans take the cautious route. Example: the Encyclopedia says to avoid tomatoes and
potatoes at night; Nedley lists tomatoes among melatonin-rich foods. The sleep plan mentions neither.

## How a plan is shown: do this, why, how

Each plan opens as instructions, not reading material:

1. **Goal and problem** in one line, with the healthy target. For example: *"Bring your blood pressure down.
   Blood pressure 150/95: high (stage 1). Healthy is under 120/80."*
2. **A red-range reading comes first.** Blood pressure 160/100+ or sugar 15+ means *see the triage nurse now*; any
   other red reading means *book a clinic visit this week*. This is the expo's safety rule, not a book claim.
3. **Do these 3 things:** numbered actions, each with **Why** (the book's reason, with its reference) and **How**
   (concrete steps, plus the food cost where foods are involved).
4. **When these feel easy, add:** the plan's remaining actions.
5. **Check again** (for example, blood pressure in 3 weeks) and **keep taking your pills**.
6. Folded away: the full timed day, home hydrotherapy, and everything the books say.

The actions are `ACTIONS` in `index.html`, most important first. Every why and how restates the plan's own steps and
facts, with the same reference; nothing new is claimed. They adapt to the person: an action can apply only to
some visitors (for example "lose extra weight slowly" only when the BMI is 25 or more), or move to the top for them (for example
"cut out fried food and animal fat" when cholesterol, not weight, is the problem). The WhatsApp message and the
printed card carry the same problem line, 3 actions and recheck, so the visitor goes home with what was explained.

The printed A6 card measures itself before printing and steps the text down a size if anything would be cut off.
(The previous card ran past the bottom edge and lost the safety note.)

## The Food screen

On the Plan tab, **See the food** opens one screen with every shopping-list food (16 in all). It can be filtered by plan
or show all foods. Bars show the cost **per day**, over the **21 days**, or the **store prices** (cheapest store, median, dearest
store). Tapping a food shows **why it is in the plan** and how its price was worked out.

- **Why:** `FOOD_WHY` in `index.html`, from three books:
  - Lines tagged with a plan repeat something that plan already says, with the same page or chapter reference. To add
    one, put it in the plan's steps or facts first, then repeat it there.
  - Lines tagged **Encyclopedia of Foods** paraphrase *Encyclopedia of Foods and Their Healing Power*, Vol. 1
    (George D. Pamplona-Roger, M.D., Education and Health Library). They are cited as "vol. 1, p." with the printed page.
    Only Volume 1 was available; its detailed food chapters are in Volume 2. The book's cancer claims are deliberately
    left out.
- **Green beans:** that book says raw green beans contain a natural toxin that cooking destroys (vol. 1, p. 109). The
  blood-sugar plan's snack line therefore now says "cooked green beans (never raw)", and the Food screen shows the caution.
- **Prices:** `FOOD_PRICES` in `index.html`, between the `FOOD_PRICES:BEGIN` / `END` markers. `node tools/update-prices.js`
  rewrites it from `prices/prices.csv` along with the shopping-list prices, so never edit it by hand.

## Things to know

- **Prices** are real South African supermarket prices checked on the stores' own websites on 19 Oct 2026 (neither book has any): Pick n Pay, Checkers, Shoprite, Woolworths, Makro, Game, one SPAR store's webshop and Dis-Chem. Each item shows the stores and the typical price range; the daily cost is the median price × the daily amount. Prices change and vary by branch, and the app says so wherever it shows them. Three items had no exact match online and use a flagged stand-in: unsifted maize meal (super maize meal shown), valerian teabags (loose dried valerian root) and dried figs (dates). The working is in `prices/PRICES.md`; to refresh, update `prices/prices.csv` and run `node tools/update-prices.js`.
- The **blood-pressure and health-age projections** on the Results tab are illustrative counselling estimates from the
  original app, not from either book, and are labelled that way.
- The **calorie rule of thumb** on the weight plan is the Encyclopedia's (p. 481).
- Plans are plain data in `index.html` (`PROTOCOLS`). To change a step, edit it there and keep its reference honest.
- Some of the books' advice is contested (for example the Encyclopedia's diabetes chapter advises avoiding gluten grains and
  cow's milk). The plans use the guidance only where it is mainstream-safe and cite where it comes from so a clinician can
  review it. **A clinical reviewer should read the plans before the expo.**
```

Replace with:

```md
# Where the plans come from

The five plans on the **Plan** tab, the WhatsApp message and the take-home card rest on two books by Seventh-day
Adventist health pioneers. Both are long out of copyright:

> *The Ministry of Healing* — Ellen G. White (Pacific Press, 1905). She died in 1915.
> *Rational Hydrotherapy* — J. H. Kellogg, M.D. (F. A. Davis, 1901), written while he was an Adventist and ran the
> Battle Creek Sanitarium. The church dropped him from membership in 1907, and he died in 1943. The plans use him only
> for the neutral bath and its cautions.

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
any suggestion to reduce medicine. Herbal teas, supplements and calorie formulas are also left out, because neither
book supports them. The app's rule stays: **never stop prescribed pills suddenly; the clinic adjusts them.** Dr
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

Not changed: the screening thresholds and red-flag rules, the help line, the prices and price tool, prices/, the Android folders and APKs, capacitor/www/index.html, and the old copy newstart-passport (2).html (these last three still contain the old book references; see section 8).

## 7. Measured facts (verbatim from prove.js)
```text
apply (dry-run copy)               155 ms  applied 42 edits to 3 files
generate (dry-run copy)            118 ms  exit 0
make-expected                    82687 ms  expected.json written: 137 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tamper-test (+ full gate post)  233673 ms  TAMPER-TEST: PASS  (control passed; 9 tampers)
scope-report pristine              193 ms  SCOPE VERDICT: READY  (42 edit(s) pending, 0 already applied)
scope-report dry-run               163 ms  SCOPE VERDICT: ALREADY APPLIED  (0 edit(s) pending, 42 already applied)
scope-report (real project)        222 ms  SCOPE VERDICT: READY  (42 edit(s) pending, 0 already applied)
gate pre (real project)          42546 ms  RESULT: PASS  (24/24 checks passed, mode=pre)

# make-expected
expected.json written: 137 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tests before {"pass":566,"fail":0} (exit 0) -> after {"pass":568,"fail":0} (exit 0)
  anchor index.html:1219 x1  const BOOK_REF='
  anchor index.html:1224 x1  const PROTOCOLS={
  anchor index.html:1410 x1  const FOOD_WHY={
  anchor index.html:1472 x1  const ACTIONS={
  anchor index.html:1557 x1  function refLabel(pg){
  anchor index.html:2416 x1  function planNeeds(a){
  anchor index.html:2579 x1  function foodDetail(f,plan){
  anchor .smoke/harness.js:2179 x1  console.log('\n21. Book-based plans');

# tamper-test (its control is the full dry-run gate post)
control: gate post on the dry-run copy (full, with mutation tests)…
  OK    control must PASS -> RESULT: PASS  (37/37 checks passed, mode=post)  [DRY-RUN]
  OK    plan never applied (pristine copy) -> RESULT: FAIL  (12/19 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-.smoke/harness.js  .smoke/harness.js is byte-identi, X-PLANS.md  PLANS.md is byte-identical to the dry-run, X-dist/index.html  dist/index.html is byte-identical 
  OK    a stray file was added -> RESULT: FAIL  (17/19 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S2  no file was added or deleted
  OK    edited file drifted by one byte: index.html -> RESULT: FAIL  (18/19 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
  OK    edited file drifted by one byte: .smoke/harness.js -> RESULT: FAIL  (18/19 checks passed, mode=post)   caught by: X-.smoke/harness.js  .smoke/harness.js is byte-identi
  OK    edited file drifted by one byte: PLANS.md -> RESULT: FAIL  (18/19 checks passed, mode=post)   caught by: X-PLANS.md  PLANS.md is byte-identical to the dry-run
  OK    an out-of-scope file was changed: .smoke/serve.js -> RESULT: FAIL  (17/19 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S3  the other 132 files are byte-identical to the bas
  OK    generated file left stale: dist/index.html -> RESULT: FAIL  (16/19 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/index.html  dist/index.html is byte-identical , C-no-old-books  index.html, dist/index.html and PLANS
  OK    generated file left stale: dist/sw.js -> RESULT: FAIL  (17/19 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/sw.js  dist/sw.js is byte-identical to the dry
  OK    half-applied: edit "E1 plan data on public-domain sources" undone -> RESULT: FAIL  (17/19 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry, C-no-old-books  index.html, dist/index.html and PLANS
TAMPER-TEST: PASS  (control passed; 9 tampers)

PIN fix-plan/gate.js sha256 61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587
PIN fix-plan/expected.json sha256 e167cf40da2c46289a09d5e518479a152e110829fd3b3fff69fa0c8d166f4a18
```

## 8. Not measured
- Legal advice: not given. Whether paraphrase plus public-domain sources removes all legal risk was not investigated; ask a South African IP lawyer.
- capacitor/www/index.html, android/app-release-signed.apk and dist/newstart.apk still contain the old text: not rebuilt (the Android build script named in project notes is not in this checkout).
- newstart-passport (2).html still cites the old books: not changed.
- The public GitHub history still contains the old text: not changed.
- Clinical review of the new wording: not done.
- The Ministry of Healing page numbers: not used (the e-book page markers are ambiguous), so chapters are cited.
- The NEWSTART trademark (a 1986 filing by Weimar Institute was found): registration status not checked.
- The database checks (PGlite) were not run.

## 9. Execution report (only these statements)
1. The scope analysis summary under the four headings, and the SCOPE VERDICT line.
2. Both `RESULT:` lines and both report paths with their hashes.
3. The S1 line (files changed) and the H1 line (test tally).
4. Anything not run, marked "not run".
