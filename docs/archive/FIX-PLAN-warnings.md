# Plan: warnings and precautions on every plan, screen, message and card

**Status: plan only, nothing applied.** Every number was measured, and `gate pre` re-checks it before anything changes.

<!-- Fields with "=" inside double braces are filled by render-plan.js from tool output. The other double-brace fields are
     prose you write from this session's tool output. `render-plan.js <project> --check` must PASS before reporting. -->

## 1. Goal
Today the plans say only that they are not a replacement for the clinic and that pills must not be stopped. After the plan, one disclaimer (the volunteers are not health professionals; the plan is general information, not medical advice, diagnosis or treatment) and a list of precautions (medicine, screening is not diagnosis, pregnancy and illness, herb interactions, warning signs, emergencies, children) show on every app and church plan, and in short form on Results, the Food screen, the WhatsApp preview and the card; the WhatsApp message carries all of them. Measured on copies with the database checks on: tests before 680 pass / 0 fail, after 689 pass / 0 fail.

| # | Problem (exact test name or symptom) | Cause (file:line from an anchor) | Kind | Fix |
|---|---|---|---|---|
| F1 | No disclaimer or precautions | `viewPlan`, `viewChurchPlan`, `waMessage`, `buildPrintCard` in `index.html` carry only a short clinic line | Real bug / Stale test / Decision: one shared DISCLAIMER and PRECAUTIONS, shown everywhere a plan reaches a visitor (your request) | W1–W8; tests X1–X2; PLANS.md Y1 |

Out of scope, unchanged before and after: none.

## 2. Scope
- **Edited:** `index.html`, `.smoke/harness.js`, `PLANS.md`, changed only by `node fix-plan-warnings/apply.js .`
- **Generated:** `dist/index.html`, `dist/sw.js`, changed only by `node tools/build.js`
- **Everything else:** 136 files stay byte-identical. No file is added or deleted.
- **Invariants:** the nine built-in plans, their actions and the help line stay byte-identical. Extra check: the harness parses.

## 3. Hard rules (any violation = the plan FAILS)
1. **Fail closed.** Any `[FAIL]`, crash or timeout fails the plan. Never edit the gate, `config.js` or `expected.json`
   to get past one. Restore the backups and report.
2. **No hand edits.** Only `apply.js` changes edited files: each edit is applied exactly once, or nothing is written.
3. **No weakened tests.** Changed files must be byte-identical to the dry run. No test may be renamed, dropped, skipped
   or made always-true. The gate breaks the fixed code in 9 way(s), and each must be caught.
4. **Zero hallucination.** Report only what the gate or a tool printed. Write "not run" or "not measured" for
   anything else.
5. **Pinned tooling.**
   - `fix-plan-warnings/gate.js` sha256 `61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587`
   - `fix-plan-warnings/expected.json` sha256 `02a5391e5d3fb23994ef08e0bf2886f8c0805dbb99dc11ecb39a6a45dcf6c200`

   The gate pins the other files itself.
6. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis
Read-only. Check the pins, run `node fix-plan-warnings/scope-report.js` (required: `SCOPE VERDICT: READY`), read sections 1–2
and 6 and `fix-plan-warnings/edits.js`, and grep the callers and tests of each edit site.

Present it under four headings, citing `file:line`:
- **Scope covered:** 5 file(s) change (`.smoke/harness.js`, `PLANS.md`, `dist/index.html`, `dist/sw.js`, `index.html`) and 136 stay identical.
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
sha256sum fix-plan-warnings/gate.js fix-plan-warnings/expected.json   # must match rule 5
node fix-plan-warnings/gate.js pre     # required: RESULT: PASS (20/20 checks passed, mode=pre); writes backups
node fix-plan-warnings/apply.js .      # required: applied 11 edits to 3 files
node tools/build.js    # regenerate
node fix-plan-warnings/gate.js post    # required: RESULT: PASS (33/33 checks passed, mode=post)
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

## 6. The exact change (ground truth: `fix-plan-warnings/edits.js`)
### W1  (`index.html`, serves F1)

Why: one disclaimer and one list of precautions, used everywhere a plan reaches a visitor

Find (exactly once):

```html
/* shopping-list entries shared by several plans
```

Replace with:

```html
/* Shown with every plan (the app's and a church's), on the Results and Food screens, in the WhatsApp message and on
   the printed card: who is giving the advice, what it is not, and the precautions that always apply. */
const DISCLAIMER='The volunteers at this expo are not doctors, nurses or other health professionals unless they tell you so. This plan is general healthy-living information, not medical advice, a diagnosis or treatment.';
const PRECAUTIONS=[
 'Keep taking any medicine your clinic or doctor gave you. Never stop or change it without asking them.',
 'Expo readings are a quick screening, not a diagnosis. Have any high or low reading checked at a clinic.',
 'Ask your clinic before big changes in food, exercise or herb teas if you are pregnant or breastfeeding, have diabetes or heart, kidney or liver disease, or take regular medicine.',
 'Herbs and foods can interact with medicines. Ask your clinic or pharmacist before using herb teas with medicine.',
 'Stop and get help at once if you have chest pain, faintness, severe breathlessness, confusion, or a new or worsening symptom.',
 'In an emergency, call an ambulance or go to the nearest emergency unit straight away. Do not wait to try home remedies.',
 'Children, older people and anyone who is unwell may need different advice. Ask your clinic.'];
const precautionsHTML=()=>`<div class="glass p-4"><div class="microlabel">Warnings and precautions</div>
  <p class="mt-1.5 text-[11.5px] font-semibold leading-relaxed text-[#33504f]">${esc(DISCLAIMER)}</p>
  <ul class="mt-2 space-y-1.5">${PRECAUTIONS.map(t=>`<li class="flex items-start gap-2.5"><span class="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand-500"></span>
   <span class="min-w-0 flex-1 text-[11.5px] leading-snug text-[#3d5c5e]">${esc(t)}</span></li>`).join('')}</ul></div>`;
/* shopping-list entries shared by several plans
```

### W2  (`index.html`, serves F2)

Why: a church plan screen shows the warnings and precautions

Find (exactly once):

```html
  ${p.help?`<div class="pl-urgent"><b>Need help now?</b><span>${esc(p.help)}</span></div>`:''}
 </section>`;
}

/* --- the Church screen
```

Replace with:

```html
  ${p.help?`<div class="pl-urgent"><b>Need help now?</b><span>${esc(p.help)}</span></div>`:''}
  ${precautionsHTML()}
 </section>`;
}

/* --- the Church screen
```

### W3  (`index.html`, serves F2)

Why: every app plan screen shows the warnings and precautions

Find (exactly once):

```html
  ${p.help?`<div class="pl-urgent"><b>Need help now?</b><span>${esc(p.help)}</span></div>`:''}

  ${p.items.length?`<button class="pl-food"
```

Replace with:

```html
  ${p.help?`<div class="pl-urgent"><b>Need help now?</b><span>${esc(p.help)}</span></div>`:''}
  ${precautionsHTML()}

  ${p.items.length?`<button class="pl-food"
```

### W4  (`index.html`, serves F3)

Why: the Results screen says the readings are screening only, by volunteers

Find (exactly once):

```html
The blood-pressure and health-age figures are illustrative estimates for counselling, not a prediction.
```

Replace with:

```html
Expo readings are a quick screening, not a diagnosis, and the volunteers are not health professionals. The blood-pressure and health-age figures are illustrative estimates for counselling, not a prediction.
```

### W5  (`index.html`, serves F3)

Why: the Food screen safety box carries the disclaimer

Find (exactly once):

```html
   <b>Safety:</b> this is healthy-living advice, not a replacement for the clinic. Never stop prescribed pills suddenly.
```

Replace with:

```html
   <b>Safety:</b> ${esc(DISCLAIMER)} Never stop prescribed pills suddenly, and ask your clinic before big changes in food if you take regular medicine.
```

### W6  (`index.html`, serves F4)

Why: the WhatsApp preview carries the disclaimer

Find (exactly once):

```html
  ${p.help?`<p class="mt-2 text-[10px] font-bold leading-relaxed text-rose-700">${esc(p.help)}</p>`:''}
```

Replace with:

```html
  ${p.help?`<p class="mt-2 text-[10px] font-bold leading-relaxed text-rose-700">${esc(p.help)}</p>`:''}
  <p class="mt-2 text-[10px] leading-relaxed text-[#6b8187]">${esc(DISCLAIMER)} ${esc(PRECAUTIONS[5])}</p>
```

### W7  (`index.html`, serves F4)

Why: the WhatsApp message carries the disclaimer and every precaution

Find (exactly once):

```html
  `These are home remedies and healthy-living advice, not a replacement for your clinic. If you take blood-pressure or diabetes pills, do not stop them suddenly — your clinic will adjust the doses safely.`,
```

Replace with:

```html
  `These are home remedies and healthy-living advice, not a replacement for your clinic. If you take blood-pressure or diabetes pills, do not stop them suddenly — your clinic will adjust the doses safely.`,
  '',
  DISCLAIMER,
  'Warnings and precautions:',
  ...PRECAUTIONS.map(t=>`• ${t}`),
```

### W8  (`index.html`, serves F4)

Why: the printed card says who gave the advice and what to do in an emergency

Find (exactly once):

```html
    <div class="pc-safety">Not a replacement for your clinic. <b>Never stop prescribed pills suddenly</b>; your clinic will adjust them.
```

Replace with:

```html
    <div class="pc-safety">Not a replacement for your clinic: given by volunteers, not health professionals, as general information, not medical advice. <b>Never stop prescribed pills suddenly</b>; your clinic will adjust them. In an emergency, go to the nearest emergency unit.
```

### X1  (`.smoke/harness.js`, serves F5)

Why: export the disclaimer and precautions to the tests

Find (exactly once):

```js
  'planFor', 'PRICE_DATE', 'ACTIONS', 'FOOD_WHY', 'urgentOf',
```

Replace with:

```js
  'planFor', 'PRICE_DATE', 'ACTIONS', 'FOOD_WHY', 'urgentOf', 'DISCLAIMER', 'PRECAUTIONS', 'openFood', 'closeFood',
```

### X2  (`.smoke/harness.js`, serves F5)

Why: the disclaimer and precautions show on every plan, the Results and Food screens, the message and the card

Find (exactly once):

```js
  ok('“Use the app’s plan instead” goes back to the app\'s plan', !cpDav.interests.churchPlan && /Do these 3 things/.test($main.innerHTML) && /Counsels on Diet §/.test($main.innerHTML));
```

Replace with:

```js
  ok('“Use the app’s plan instead” goes back to the app\'s plan', !cpDav.interests.churchPlan && /Do these 3 things/.test($main.innerHTML) && /Counsels on Diet §/.test($main.innerHTML));
  const showsWarnings = h => h.includes('Warnings and precautions') && h.includes(g.DISCLAIMER) && g.PRECAUTIONS.every(t => h.includes(t));
  ok('the disclaimer says the volunteers are not health professionals and the plan is not medical advice', /not doctors, nurses or other health professionals/.test(g.DISCLAIMER) && /not medical advice/.test(g.DISCLAIMER));
  ok('the precautions cover medicine, screening, pregnancy and illness, herb interactions, warning signs, emergencies and children',
    [/Never stop or change it/, /not a diagnosis/, /pregnant or breastfeeding/, /interact with medicines/, /chest pain/, /emergency unit/, /Children/].every(re => g.PRECAUTIONS.some(t => re.test(t))));
  ok('every app plan screen shows the disclaimer and the precautions', Object.keys(PL).every(k => { g.state.protocol = k; g.render(); return showsWarnings($main.innerHTML); }));
  g.chooseChurchPlan('demo-joints');
  ok('a church plan screen shows them too', showsWarnings($main.innerHTML));
  g.chooseChurchPlan(''); g.state.protocol = 'bp';
  const wMsg = g.waMessage(cpDav);
  ok('the WhatsApp message carries the disclaimer and every precaution', wMsg.includes(g.DISCLAIMER) && g.PRECAUTIONS.every(t => wMsg.includes('• ' + t)));
  g.openWhatsApp();
  ok('the WhatsApp preview carries the disclaimer', $el('waBody').innerHTML.includes(g.DISCLAIMER));
  g.buildPrintCard();
  ok('the printed card says the advice comes from volunteers, not health professionals, and what to do in an emergency',
    /not health professionals/.test($el('printArea').innerHTML) && /nearest emergency unit/.test($el('printArea').innerHTML) && /Not a replacement for your clinic/.test($el('printArea').innerHTML));
  g.state.tab = 'results'; g.render();
  ok('the Results screen says the readings are screening only, not a diagnosis', /quick screening, not a diagnosis/.test($main.innerHTML) && /not health professionals/.test($main.innerHTML));
  g.state.tab = 'plan'; g.render(); g.openFood();
  ok('the Food screen carries the disclaimer', $main.innerHTML.includes(g.DISCLAIMER));
  g.closeFood();
```

### Y1  (`PLANS.md`, serves F6)

Why: the warnings and precautions, and where they show

Find (exactly once):

```md
## Get-help line
```

Replace with:

```md
## Warnings and precautions

Every plan, the app's and a church's, shows a **Warnings and precautions** box, and the same words go out in the
WhatsApp message (`DISCLAIMER` and `PRECAUTIONS` in `index.html`). The Results screen, the Food screen and the printed
card carry the short form.

- **Who is speaking:** the volunteers are not doctors, nurses or other health professionals unless they say so. The
  plans are general healthy-living information, not medical advice, a diagnosis or treatment.
- **Always:** keep taking prescribed medicine and never stop or change it without the clinic; expo readings are a
  screening, not a diagnosis, so have high or low readings checked; ask the clinic before big changes when pregnant or
  breastfeeding, with diabetes or heart, kidney or liver disease, or on regular medicine; herbs and foods can interact
  with medicines; stop and get help at once with chest pain, faintness, severe breathlessness, confusion or a new or
  worsening symptom; in an emergency go to the nearest emergency unit and do not wait for home remedies; children, older
  people and anyone unwell may need different advice.

These are the app's own safety words, not a substitute for legal advice. Before charging for the app, have a lawyer
read them together with the terms of use and privacy policy.

## Get-help line
```

Not changed: the plans themselves, the red-flag rules, the help line, the database. The existing clinic and do-not-stop-pills wording stays.

## 7. Measured facts (verbatim from prove.js)
```text
apply (dry-run copy)               145 ms  applied 11 edits to 3 files
generate (dry-run copy)             75 ms  exit 0
make-expected                    90835 ms  expected.json written: 141 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tamper-test (+ full gate post)  216596 ms  TAMPER-TEST: PASS  (control passed; 9 tampers)
scope-report pristine              112 ms  SCOPE VERDICT: READY  (11 edit(s) pending, 0 already applied)
scope-report dry-run               110 ms  SCOPE VERDICT: ALREADY APPLIED  (0 edit(s) pending, 11 already applied)
scope-report (real project)        144 ms  SCOPE VERDICT: READY  (11 edit(s) pending, 0 already applied)
gate pre (real project)          45908 ms  RESULT: PASS  (20/20 checks passed, mode=pre)

# make-expected
expected.json written: 141 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tests before {"pass":680,"fail":0} (exit 0) -> after {"pass":689,"fail":0} (exit 0)
  anchor index.html:1236 x1  const PROTOCOLS={
  anchor index.html:2809 x1  function viewPlan(){
  anchor index.html:1806 x1  function viewChurchPlan(a,cp){
  anchor index.html:4033 x1  function waMessage(a){
  anchor index.html:4082 x1  function buildPrintCard(){

# tamper-test (its control is the full dry-run gate post)
control: gate post on the dry-run copy (full, with mutation tests)…
  OK    control must PASS -> RESULT: PASS  (33/33 checks passed, mode=post)  [DRY-RUN]
  OK    plan never applied (pristine copy) -> RESULT: FAIL  (11/17 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-.smoke/harness.js  .smoke/harness.js is byte-identi, X-PLANS.md  PLANS.md is byte-identical to the dry-run, X-dist/index.html  dist/index.html is byte-identical 
  OK    a stray file was added -> RESULT: FAIL  (15/17 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S2  no file was added or deleted
  OK    edited file drifted by one byte: index.html -> RESULT: FAIL  (16/17 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
  OK    edited file drifted by one byte: .smoke/harness.js -> RESULT: FAIL  (16/17 checks passed, mode=post)   caught by: X-.smoke/harness.js  .smoke/harness.js is byte-identi
  OK    edited file drifted by one byte: PLANS.md -> RESULT: FAIL  (16/17 checks passed, mode=post)   caught by: X-PLANS.md  PLANS.md is byte-identical to the dry-run
  OK    an out-of-scope file was changed: .smoke/serve.js -> RESULT: FAIL  (15/17 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S3  the other 136 files are byte-identical to the bas
  OK    generated file left stale: dist/index.html -> RESULT: FAIL  (15/17 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/index.html  dist/index.html is byte-identical 
  OK    generated file left stale: dist/sw.js -> RESULT: FAIL  (15/17 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/sw.js  dist/sw.js is byte-identical to the dry
  OK    half-applied: edit "W1" undone -> RESULT: FAIL  (16/17 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
TAMPER-TEST: PASS  (control passed; 9 tampers)

PIN fix-plan/gate.js sha256 61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587
PIN fix-plan/expected.json sha256 02a5391e5d3fb23994ef08e0bf2886f8c0805dbb99dc11ecb39a6a45dcf6c200
```

## 8. Not measured
- Legal review of the disclaimer wording: not done; a lawyer should read it with the terms of use and privacy policy before the app is sold.
- Whether the printed card still fits on A6 with the longer safety line: checked only by the card's own shrink-to-fit code, not printed.
- The Android app: not rebuilt.

## 9. Execution report (only these statements)
1. The scope analysis summary under the four headings, and the SCOPE VERDICT line.
2. Both `RESULT:` lines and both report paths with their hashes.
3. The S1 line (files changed) and the H1 line (test tally).
4. Anything not run, marked "not run".
