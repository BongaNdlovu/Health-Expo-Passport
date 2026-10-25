# Plan: add four herb teas (chamomile, linden flower, catnip, hops) to the sleep and stress & mood plans

**Status: plan only, nothing applied.** Every number was measured, and `gate pre` re-checks it before anything changes.

<!-- Fields with "=" inside double braces are filled by render-plan.js from tool output. The other double-brace fields are
     prose you write from this session's tool output. `render-plan.js <project> --check` must PASS before reporting. -->

## 1. Goal
Today the sleep and stress & mood plans have no herb teas. After the plan, the sleep plan suggests catnip, linden flower or hops tea in the evening and mentions chamomile, and the stress & mood plan suggests chamomile or linden flower tea. Each claim is cited to King's American Dispensatory (1898) by entry, plus Grieve's A Modern Herbal (1931) for hops. Each plan shows hazard notes from PFAF as expo safety rules. Measured on copies: tests before 568 pass / 0 fail, after 573 pass / 0 fail.

| # | Problem (exact test name or symptom) | Cause (file:line from an anchor) | Kind | Fix |
|---|---|---|---|---|
| F1 | No herb teas in the sleep and stress plans | sleep plan at `index.html:1328`, stress plan at `index.html:1362` | Real bug / Stale test / Decision: chamomile, linden, catnip, hops (hops sleep only), citing King's and Grieve, with hazard notes (your choice) | T1–T18; tests U1–U7; PLANS.md V1–V3 |

Out of scope, unchanged before and after: none.

## 2. Scope
- **Edited:** `index.html`, `.smoke/harness.js`, `PLANS.md`, changed only by `node fix-plan-herbs/apply.js .`
- **Generated:** `dist/index.html`, `dist/sw.js`, changed only by `node tools/build.js`
- **Everything else:** 133 files stay byte-identical. No file is added or deleted.
- **Invariants:** the stylesheet, the store prices, the help line, the blood-pressure, sugar and weight plans and their actions, and the Food screen reasons stay byte-identical. Extra checks: the harness parses, and no old book is named.

## 3. Hard rules (any violation = the plan FAILS)
1. **Fail closed.** Any `[FAIL]`, crash or timeout fails the plan. Never edit the gate, `config.js` or `expected.json`
   to get past one. Restore the backups and report.
2. **No hand edits.** Only `apply.js` changes edited files: each edit is applied exactly once, or nothing is written.
3. **No weakened tests.** Changed files must be byte-identical to the dry run. No test may be renamed, dropped, skipped
   or made always-true. The gate breaks the fixed code in 8 way(s), and each must be caught.
4. **Zero hallucination.** Report only what the gate or a tool printed. Write "not run" or "not measured" for
   anything else.
5. **Pinned tooling.**
   - `fix-plan-herbs/gate.js` sha256 `61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587`
   - `fix-plan-herbs/expected.json` sha256 `2b24e0ddc14cde106883df5794560bc201303cee3c4e70ce0a465e3e9ba0bd14`

   The gate pins the other files itself.
6. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis
Read-only. Check the pins, run `node fix-plan-herbs/scope-report.js` (required: `SCOPE VERDICT: READY`), read sections 1–2
and 6 and `fix-plan-herbs/edits.js`, and grep the callers and tests of each edit site.

Present it under four headings, citing `file:line`:
- **Scope covered:** 5 file(s) change (`.smoke/harness.js`, `PLANS.md`, `dist/index.html`, `dist/sw.js`, `index.html`) and 133 stay identical.
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
sha256sum fix-plan-herbs/gate.js fix-plan-herbs/expected.json   # must match rule 5
node fix-plan-herbs/gate.js pre     # required: RESULT: PASS (24/24 checks passed, mode=pre); writes backups
node fix-plan-herbs/apply.js .      # required: applied 28 edits to 3 files
node tools/build.js    # regenerate
node fix-plan-herbs/gate.js post    # required: RESULT: PASS (36/36 checks passed, mode=post)
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

## 6. The exact change (ground truth: `fix-plan-herbs/edits.js`)
### T1  (`index.html`, serves F1)

Why: explain the two new reference forms for the herbals

Find (exactly once):

```html
     "K:395–396" = printed pages of Rational Hydrotherapy (J. H. Kellogg, M.D., 1901)
```

Replace with:

```html
     "K:395–396" = printed pages of Rational Hydrotherapy (J. H. Kellogg, M.D., 1901)
     "KD:Tilia"  = an entry of King’s American Dispensatory (1898), by its Latin name (herb teas only)
     "GR:Hops"   = an entry of A Modern Herbal (Mrs M. Grieve, 1931) (herb teas only)
```

### T2  (`index.html`, serves F1)

Why: credit lines for the two herbals; Grieve is not called public domain because that was not checked

Find (exactly once):

```html
const BOOK2_REF='Rational Hydrotherapy (J. H. Kellogg, M.D., 1901; public domain)';
```

Replace with:

```html
const BOOK2_REF='Rational Hydrotherapy (J. H. Kellogg, M.D., 1901; public domain)';
const BOOK3_REF='King’s American Dispensatory (1898; public domain)';
const BOOK4_REF='A Modern Herbal (Mrs M. Grieve, 1931)';
```

### T3  (`index.html`, serves F2)

Why: sleep plan source line names the herbal entries

Find (exactly once):

```html
  src:'The Ministry of Healing: chs. 17, 18, 20, 23, 25, 26 · Rational Hydrotherapy: pp. 197, 372, 377, 383–384, 395–396',
```

Replace with:

```html
  src:'The Ministry of Healing: chs. 17, 18, 20, 23, 25, 26 · Rational Hydrotherapy: pp. 197, 372, 377, 383–384, 395–396 · King’s American Dispensatory: Matricaria, Tilia, Nepeta, Humulus · A Modern Herbal: Hops',
```

### T4  (`index.html`, serves F2)

Why: sleep plan summary mentions the herb tea

Find (exactly once):

```html
and Dr Kellogg’s neutral bath at bedtime.',
```

Replace with:

```html
and Dr Kellogg’s neutral bath at bedtime, with a cup of calming herb tea.',
```

### T5  (`index.html`, serves F2)

Why: sleep plan: an evening herb-tea step (catnip, linden, hops)

Find (exactly once):

```html
   ['20:00','Dim the lights and switch off the TV and phone. Set the day’s worries aside and sing or read something calming.','G · MH:18'],
```

Replace with:

```html
   ['20:00','Dim the lights and switch off the TV and phone. Set the day’s worries aside and sing or read something calming.','G · MH:18'],
   ['20:15','A cup of warm catnip, linden flower or hops tea, unsweetened.','KD:Nepeta · KD:Tilia · KD:Humulus · GR:Hops'],
```

### T6  (`index.html`, serves F2)

Why: sleep plan: what the herbals say about the four teas

Find (exactly once):

```html
   ['Poor sleep for weeks, or feeling low or anxious, is a reason to see your clinic.','S']],
```

Replace with:

```html
   ['Catnip tea, drunk warm, was used to calm restlessness and nervous irritability and to bring on sleep.','KD:Nepeta'],
   ['Linden flower tea was used to ease restlessness and promote rest and sleep.','KD:Tilia'],
   ['Hops were used to calm the nerves and promote sleep.','KD:Humulus · GR:Hops'],
   ['Chamomile tea was used to calm nervous irritability and restlessness.','KD:Matricaria'],
   ['Poor sleep for weeks, or feeling low or anxious, is a reason to see your clinic.','S']],
```

### T7  (`index.html`, serves F3)

Why: sleep plan: hazard notes for the four teas

Find (exactly once):

```html
If sleep has been poor for weeks, or you feel low or anxious, see your clinic.',
```

Replace with:

```html
If sleep has been poor for weeks, or you feel low or anxious, see your clinic. Herb teas: hops adds to the effect of sleeping or anxiety pills and alcohol, so ask your clinic first if you take them, or if you are pregnant or breastfeeding. No catnip tea in pregnancy. Chamomile can affect people allergic to ragweed. Use fresh linden flowers, not old stock.',
```

### T8  (`index.html`, serves F2)

Why: stress & mood plan source line names the herbal entries

Find (exactly once):

```html
  src:'The Ministry of Healing: chs. 8, 17, 18, 19, 20, 23, 26 · Rational Hydrotherapy: pp. 197, 372, 383–384, 395–396',
```

Replace with:

```html
  src:'The Ministry of Healing: chs. 8, 17, 18, 19, 20, 23, 26 · Rational Hydrotherapy: pp. 197, 372, 383–384, 395–396 · King’s American Dispensatory: Matricaria, Tilia',
```

### T9  (`index.html`, serves F2)

Why: stress & mood plan: an afternoon chamomile or linden tea step

Find (exactly once):

```html
   ['16:00','Do one kind thing for someone else: a visit, a call or a helping hand.','MH:18'],
```

Replace with:

```html
   ['16:00','Do one kind thing for someone else: a visit, a call or a helping hand.','MH:18'],
   ['16:30','A cup of chamomile or linden flower tea, unsweetened, in a quiet moment.','KD:Matricaria · KD:Tilia'],
```

### T10  (`index.html`, serves F2)

Why: stress & mood plan: what the herbal says about the two teas

Find (exactly once):

```html
   ['Trust in God is one of the true remedies.','MH:8']],
```

Replace with:

```html
   ['Chamomile tea was used to calm nervous irritability, restlessness and peevishness.','KD:Matricaria'],
   ['Linden flower tea was used to ease irritation and restlessness.','KD:Tilia'],
   ['Trust in God is one of the true remedies.','MH:8']],
```

### T11  (`index.html`, serves F3)

Why: stress & mood plan: hazard notes for the two teas

Find (exactly once):

```html
or that stops you working or sleeping, is a reason to see your clinic.',
```

Replace with:

```html
or that stops you working or sleeping, is a reason to see your clinic. Herb teas: chamomile can affect people allergic to ragweed. Use fresh linden flowers, not old stock.',
```

### T12  (`index.html`, serves F2)

Why: sleep plan: herb-tea action, last so the top three stay the same

Find (exactly once):

```html
   how:['Set the day’s worries aside','A short prayer of thanks']}],
```

Replace with:

```html
   how:['Set the day’s worries aside','A short prayer of thanks']},
  {do:'A cup of calming herb tea in the evening',why:'Catnip, linden flower and hops teas were used to calm restlessness and bring on sleep, and chamomile to calm nervous irritability.',ref:'KD:Nepeta · KD:Tilia · KD:Humulus · GR:Hops · KD:Matricaria',
   how:['One cup, warm and unsweetened','The old herbals used about 15 g of chamomile or hops, or 30 g of catnip, to half a litre of boiling water','Taking sleeping or anxiety pills, pregnant or breastfeeding? Ask your clinic before hops']}],
```

### T13  (`index.html`, serves F2)

Why: stress & mood plan: chamomile or linden action, last so the top three stay the same

Find (exactly once):

```html
   how:['Oats with fruit and a few nuts']}],
```

Replace with:

```html
   how:['Oats with fruit and a few nuts']},
  {do:'A cup of chamomile or linden tea in a quiet moment',why:'Chamomile was used to calm nervous irritability and restlessness, and linden flowers to ease restlessness.',ref:'KD:Matricaria · KD:Tilia',
   how:['Warm and unsweetened, sitting down','The old herbal used about 15 g of chamomile flowers to half a litre of boiling water','Allergic to ragweed? Choose linden instead']}],
```

### T14  (`index.html`, serves F1)

Why: reference labels for the herbals

Find (exactly once):

```html
/* "MH:23" → "Ministry of Healing ch. 23"; "K:395–396" → "Kellogg pp. 395–396"; "G" / "S" → what the line rests on */
```

Replace with:

```html
/* "MH:23" → "Ministry of Healing ch. 23"; "K:395–396" → "Kellogg pp. 395–396"; "KD:Tilia" → "King’s Dispensatory: Tilia";
   "GR:Hops" → "Grieve: Hops"; "G" / "S" → what the line rests on */
```

### T15  (`index.html`, serves F1)

Why: refLabel reads the herbal references

Find (exactly once):

```html
  if(REF_TAG[x])return REF_TAG[x];
```

Replace with:

```html
  if(REF_TAG[x])return REF_TAG[x];
  const h=x.match(/^(KD|GR):(.+)$/);if(h)return (h[1]==='KD'?'King’s Dispensatory: ':'Grieve: ')+h[2];
```

### T16  (`index.html`, serves F1)

Why: plans credit the herbals they use; four credits read better joined with "; "

Find (exactly once):

```html
 if(/(^|\s)K:/.test(refs))out.push(BOOK2_REF);
 return out;
}
const planCredit=p=>planBooks(p).join(' and ');
```

Replace with:

```html
 if(/(^|\s)K:/.test(refs))out.push(BOOK2_REF);
 if(/(^|\s)KD:/.test(refs))out.push(BOOK3_REF);
 if(/(^|\s)GR:/.test(refs))out.push(BOOK4_REF);
 return out;
}
const planCredit=p=>planBooks(p).join('; ');
```

### T17  (`index.html`, serves F1)

Why: the footer no longer says "both books" are public domain (Grieve's status was not checked)

Find (exactly once):

```html
Both books are in the public domain, and the advice is in our own words.
```

Replace with:

```html
The advice is in our own words.
```

### T18  (`index.html`, serves F1)

Why: the footer explains the herbal reference forms and that hazard notes are expo safety rules

Find (exactly once):

```html
Lines marked “general advice” or “expo safety rule” come from no book.</p>
```

Replace with:

```html
“King’s Dispensatory” = an entry of King’s American Dispensatory (1898); “Grieve” = an entry of A Modern Herbal (1931). Lines marked “general advice” or “expo safety rule”, and the herb hazard notes, come from no book.</p>
```

### U1  (`.smoke/harness.js`, serves F4)

Why: export the herbal credit lines

Find (exactly once):

```js
  'BOOK2_REF', 'refLabel',
```

Replace with:

```js
  'BOOK2_REF', 'BOOK3_REF', 'BOOK4_REF', 'refLabel',
```

### U2  (`.smoke/harness.js`, serves F4)

Why: herbal entries are valid references

Find (exactly once):

```js
  const PART = '(?:MH:\\d{1,2}|K:\\d{3}(?:[–-]\\d{3})?|G|S)', PAGE
```

Replace with:

```js
  const PART = '(?:MH:\\d{1,2}|K:\\d{3}(?:[–-]\\d{3})?|KD:[A-Z][a-z]+|GR:[A-Z][a-z]+|G|S)', PAGE
```

### U3  (`.smoke/harness.js`, serves F4)

Why: herb checks: which entries, which herbs in which plan, hazard notes, no tinctures

Find (exactly once):

```js
    !oldBooks.test(JSON.stringify(PL) + JSON.stringify(g.ACTIONS) + JSON.stringify(g.FOOD_WHY) + g.BOOK_REF + g.BOOK2_REF));
```

Replace with:

```js
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
```

### U4  (`.smoke/harness.js`, serves F4)

Why: the herbals are credited

Find (exactly once):

```js
  ok('Rational Hydrotherapy is credited in full, as public domain', /Rational Hydrotherapy/.test(g.BOOK2_REF) && /Kellogg/.test(g.BOOK2_REF) && /1901/.test(g.BOOK2_REF) && /public domain/.test(g.BOOK2_REF));
```

Replace with:

```js
  ok('Rational Hydrotherapy is credited in full, as public domain', /Rational Hydrotherapy/.test(g.BOOK2_REF) && /Kellogg/.test(g.BOOK2_REF) && /1901/.test(g.BOOK2_REF) && /public domain/.test(g.BOOK2_REF));
  ok('the two herbals are credited: King’s (1898, public domain) and Grieve (1931)', /King’s American Dispensatory/.test(g.BOOK3_REF) && /1898/.test(g.BOOK3_REF) && /public domain/.test(g.BOOK3_REF)
    && /A Modern Herbal/.test(g.BOOK4_REF) && /Grieve/.test(g.BOOK4_REF) && /1931/.test(g.BOOK4_REF));
```

### U5  (`.smoke/harness.js`, serves F4)

Why: herbal reference labels

Find (exactly once):

```js
&& g.refLabel('G · MH:20') === 'general advice · Ministry of Healing ch. 20');
```

Replace with:

```js
&& g.refLabel('G · MH:20') === 'general advice · Ministry of Healing ch. 20'
    && g.refLabel('KD:Tilia') === 'King’s Dispensatory: Tilia' && g.refLabel('GR:Hops') === 'Grieve: Hops');
```

### U6  (`.smoke/harness.js`, serves F4)

Why: the sleep plan credits four books, the stress plan three

Find (exactly once):

```js
&& g.planBooks(PL.bmi).length === 1
```

Replace with:

```js
&& g.planBooks(PL.bmi).length === 1 && g.planBooks(PL.sleep).length === 4 && g.planBooks(PL.mind).length === 3
```

### V1  (`PLANS.md`, serves F5)

Why: name the two herbals and how they are cited

Find (exactly once):

```md
> for the neutral bath and its cautions.
```

Replace with:

```md
> for the neutral bath and its cautions.

Four herb teas in the sleep and stress & mood plans are cited to two herbals:

> *King's American Dispensatory* (1898), public domain, cited by its entry name (for example `King's Dispensatory: Tilia`).
> *A Modern Herbal* — Mrs M. Grieve (1931), cited as `Grieve: Hops`.
```

### V2  (`PLANS.md`, serves F5)

Why: the herb-tea section: which herbs, where, sources, hazards, what was left out

Find (exactly once):

```md
## How a person is matched to a plan
```

Replace with:

```md
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
```

### V3  (`PLANS.md`, serves F5)

Why: herb teas are no longer wholly left out

Find (exactly once):

```md
Herbal teas, supplements and calorie formulas are also left out, because neither
book supports them.
```

Replace with:

```md
Supplements and calorie formulas are also left out, because neither book supports
them. Herb teas are limited to the four in "Herb teas" above.
```

### U7  (`.smoke/harness.js`, serves F4)

Why: chamomile is back as a sourced tea (King's), so it leaves the list of old content that must stay gone

Find (exactly once):

```js
  const oldWords = /hibiscus|beetroot|stock cube|Aromat|apple-cider|cinnamon|pumpkin seed|oat milk|chamomile/i;
```

Replace with:

```js
  const oldWords = /hibiscus|beetroot|stock cube|Aromat|apple-cider|cinnamon|pumpkin seed|oat milk/i;
```

Not changed: the blood-pressure, sugar and weight plans; the shopping lists and prices (herb prices were not checked, so the teas are not on the list); the top three actions of every plan, so the WhatsApp message and card stay the same.

## 7. Measured facts (verbatim from prove.js)
```text
apply (dry-run copy)               141 ms  applied 28 edits to 3 files
generate (dry-run copy)             90 ms  exit 0
make-expected                    81705 ms  expected.json written: 138 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tamper-test (+ full gate post)  185923 ms  TAMPER-TEST: PASS  (control passed; 9 tampers)
scope-report pristine              164 ms  SCOPE VERDICT: READY  (28 edit(s) pending, 0 already applied)
scope-report dry-run               146 ms  SCOPE VERDICT: ALREADY APPLIED  (0 edit(s) pending, 28 already applied)
scope-report (real project)        165 ms  SCOPE VERDICT: READY  (28 edit(s) pending, 0 already applied)
gate pre (real project)          41647 ms  RESULT: PASS  (24/24 checks passed, mode=pre)

# make-expected
expected.json written: 138 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html
tests before {"pass":568,"fail":0} (exit 0) -> after {"pass":573,"fail":0} (exit 0)
  anchor index.html:1221 x1  const BOOK2_REF='
  anchor index.html:1328 x1   sleep:{tag:'Sleep'
  anchor index.html:1362 x1   mind:{tag:'Stress & mood'
  anchor index.html:1520 x1  function refLabel(pg){
  anchor index.html:1527 x1  function planBooks(p,extra){
  anchor .smoke/harness.js:2199 x1    const oldBooks = 

# tamper-test (its control is the full dry-run gate post)
control: gate post on the dry-run copy (full, with mutation tests)…
  OK    control must PASS -> RESULT: PASS  (36/36 checks passed, mode=post)  [DRY-RUN]
  OK    plan never applied (pristine copy) -> RESULT: FAIL  (15/21 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-.smoke/harness.js  .smoke/harness.js is byte-identi, X-PLANS.md  PLANS.md is byte-identical to the dry-run, X-dist/index.html  dist/index.html is byte-identical 
  OK    a stray file was added -> RESULT: FAIL  (19/21 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S2  no file was added or deleted
  OK    edited file drifted by one byte: index.html -> RESULT: FAIL  (20/21 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
  OK    edited file drifted by one byte: .smoke/harness.js -> RESULT: FAIL  (20/21 checks passed, mode=post)   caught by: X-.smoke/harness.js  .smoke/harness.js is byte-identi
  OK    edited file drifted by one byte: PLANS.md -> RESULT: FAIL  (20/21 checks passed, mode=post)   caught by: X-PLANS.md  PLANS.md is byte-identical to the dry-run
  OK    an out-of-scope file was changed: .smoke/serve.js -> RESULT: FAIL  (19/21 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S3  the other 133 files are byte-identical to the bas
  OK    generated file left stale: dist/index.html -> RESULT: FAIL  (19/21 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/index.html  dist/index.html is byte-identical 
  OK    generated file left stale: dist/sw.js -> RESULT: FAIL  (19/21 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/sw.js  dist/sw.js is byte-identical to the dry
  OK    half-applied: edit "T1" undone -> RESULT: FAIL  (20/21 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
TAMPER-TEST: PASS  (control passed; 9 tampers)

PIN fix-plan/gate.js sha256 61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587
PIN fix-plan/expected.json sha256 2b24e0ddc14cde106883df5794560bc201303cee3c4e70ce0a465e3e9ba0bd14
```

## 8. Not measured
- Herb prices and availability in South Africa: not measured.
- Whether Grieve (1931) is public domain in South Africa or the US: not checked.
- Printed page numbers in King's: not used; entries are cited by Latin name.
- Gram and litre amounts are rounded conversions of the herbals' ounces and pints, not measured.
- Clinical review of the teas and hazard notes: not done.
- The Android copies (capacitor/www, APKs): not rebuilt.

## 9. Execution report (only these statements)
1. The scope analysis summary under the four headings, and the SCOPE VERDICT line.
2. Both `RESULT:` lines and both report paths with their hashes.
3. The S1 line (files changed) and the H1 line (test tally).
4. Anything not run, marked "not run".
