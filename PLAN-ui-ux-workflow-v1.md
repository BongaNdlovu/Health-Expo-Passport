# CODING AGENT PLAN — HEALTH EXPO PASSPORT · UI/UX & WORKFLOW UPDATE
### Generated against `CODING_AGENT_PLAN_TEMPLATE_v1.4.md`

---

## PLAN METADATA

| Field | Value |
|---|---|
| **Plan Name** | `UI/UX & Workflow Update — button spacing, metric drill-down, result confirmation, registration cancel, custom visitor plans + RBAC` |
| **Version** | `v1.4` |
| **Agent ID / Session** | `hermes · 2026-10-29 · ui-ux-workflow` |
| **Codebase / Repo** | `C:\Users\fanel\Downloads\Health Expo` — git `main`, HEAD `9507821`, plus uncommitted operator work in `index.html` and `src/ui.js` (ECG trace only) present at authoring time |
| **Language / Stack** | Vanilla ES modules (no framework) + esbuild single-file bundle · Supabase Postgres (SQL RPCs, RLS) · Capacitor Android · jsdom smoke harness |
| **Plan Author** | fanel (operator) |
| **Date Created** | 2026-10-29 |
| **Completion Target** | 2026-11-05 |

---

## § 0 · PRIME DIRECTIVE — MINIMAL, EFFECTIVE CODE

Adopted verbatim from template v1.4 and binding on every CHANGE block in this plan.

- Solve the **stated** problem in §1. Not an imagined future one.
- Smallest diff that fully and correctly satisfies the requirement.
- **Reuse before adding.** This codebase already owns a confirmation sheet (`feedback.js`), a church-plan renderer (`churchPlans.js`), a card builder (`ui.js`), an action registry (`action-registry.js`) and a SQL authorization pattern (`is_admin()` / `is_platform_admin()` + a guard trigger). Every change below extends one of those; none invents a parallel mechanism.
- No new dependency. `package.json` has `devDependencies` only and stays that way.
- No new timer (§ the harness enforces "exactly two timers").
- No CSS class that `index.html` does not define (the harness fails on any undefined template class).
- Net-added lines must trace to a §1 requirement.

**Forbidden here specifically:** a new modal component (reuse `confirmAsk`), a new plan "engine" (reuse the `planFor()` shape), a second admin predicate (reuse `isAdminAcct()` — see D-05), a client-only permission check for custom plans (see R-04).

---

## § 1 · FULL SCOPE DEFINITION

> **HARD STOP — READ BEFORE ANY FILE IS TOUCHED.**
> §1.6 is **resolved**: the operator accepted the recommended option for Q1–Q12 on 2026-10-29, recorded there as **D-01 … D-12**, and those decisions are binding on every AFTER block. CP-02 Phase A (the change index) is complete. **CP-02 Phase B (exact code) is still not generated** — not because anything is ambiguous, but because the operator asked for planning only. Q13 (working-tree state) remains open and blocks *applying* code, not writing it.

### 1.1 What this plan accomplishes

Six independent UI/UX and workflow changes to the Health Expo Passport app, delivered in one branch:

**(1) Button spacing standardisation.** Every row that contains two or more interactive controls must have at least **8 px** of separation at every supported width (320 px – 430 px), and no control may crowd its container's edge. The governing spacing scale already exists in `docs/ui-contract.md` §3.3 (CTA row gap 4, bento gap 8, card stack gap 11). This plan does **not** invent a new scale; it enforces the existing one on button rows and fixes the rows that violate it. Evidence of a real violation exists at `src/visitor.js:187` (Male/Female pair inside `gap-1.5` = 6 px).

**(2) Metric card cleanup and drill-down.** The three summary cards on the Check screen (Blood pressure, Blood sugar, Body BMI, `src/visitor.js:167–169`) currently render a **decorative arrow** through `tileHTML({pill:true})` → `splitBtnHTML()` → `I.arrow`, and the cards are **not clickable**. The arrow is removed (the affordance is a lie — nothing happens), the whole card becomes a tap target, and each routes to a per-metric results view. That view shows the recorded entry/entries for that metric, or a clear empty state ("No results recorded yet") when the metric has no value.

**(3) Confirmation before keyed results are committed.** Readings are currently written straight into the visitor record on every field commit (`onStationCommit`, `src/visitor.js:635`) and persisted immediately — there is no "submit" moment and no confirmation. This plan introduces a single confirmation at **the transition from Check → Results** ("Are you sure about these results?"), which is the point where the operator declares the readings complete. Confirmed values keep the existing edit-anytime behaviour.

**(4) Registration cancel control.** The New visitor form (`src/visitor.js:179`) has no Cancel; only the `+` toggle (`toggleReg`, `src/visitor.js:271`) closes it, and it does not communicate that unsaved input is discarded. This plan adds a visible **Cancel** button at the top of the form that clears the in-progress fields and returns the operator to Home — and works for both entry points: a brand-new visitor and a follow-up visit for an existing visitor (`newVisitFrom`, `src/visitor.js:505`).

**(5) Custom / imported plan override on the Visitor Plan screen.** Today the Plan screen renders either the app's generated plan (`planFor`) or a **pre-written church plan** chosen from the church's library (`chosenChurchPlan` → `viewChurchPlan`, `src/churchPlans.js:60–140`). There is no way to write a plan for one specific visitor. This plan adds a per-visitor custom plan that **overrides** the generated plan, entered either by typing into structured fields or by importing a file. The override is stored on the visitor record and is what the Send-home step, WhatsApp text, email body and printed card then carry.

**(6) Structured template + RBAC for custom plans.** The custom plan is not free text: it is a structured editor (title, problem area, 3–8 actions each with do / why / how) that matches the shape `planFor()` already produces, so it renders through the existing plan card with no new renderer. Access is restricted to the **App Owner** (platform admin) and **Church Admins** — enforced in the UI *and* in Postgres, because attendee rows are written directly by the client sync (`attToRow`, `src/cloud.js`) and a client-only check is bypassable.

**What must NOT change under any circumstances:**
- The eight recorded checks, their ranges, `parseReading` validation, `crossCheck`, or any clinical classification (`cat`, `redFlag`, `bpStage`, `healthAge`). No medical logic is touched.
- The church-plan feature. Custom plans are a **new, additional** override; `church_plans`, `chooseChurchPlan`, `viewChurchPlan` and the church plan editor keep their current behaviour.
- Consent capture, retention, or the `interests` keys already stored (`optin`, `churchPlan`, and the `INT` flags).
- The two-timer budget, the CSP (no inline handlers), the action-registry dispatch model, or the offline-first data flow.
- The Plan screen's generated content for visitors with no override.

### 1.2 Files in scope — every file the agent is allowed to modify

```
index.html                    (CSS: button-row spacing rule, metric tap target, custom-plan editor)
src/visitor.js                (items 2, 3, 4 — tiles, Check→Results confirm, Cancel)
src/results.js                (item 2 — metric drill-down view; item 5 — plan precedence)
src/ui.js                     (item 2 — arrow-less status pill, decision D-07)
src/churchPlans.js            (item 5 — custom plan renderer beside churchPlanFor)
src/customPlan.js             (NEW — item 5/6: template, parse/normalise, import)
src/account.js                (item 6 — reuse isAdminAcct; expose the authoring check if needed)
src/feedback.js               (item 3 — reuse confirmAsk; no new modal)
src/action-registry.js        (items 2, 3, 4, 5 — every new data-action)
src/main.js                   (new exports added to __internals)
src/types.js                  (item 5 — CustomPlan typedef)
src/cloud.js                  (item 5 — confirm interests round-trip, no mapping change expected)
supabase/schema.sql           (item 6 — guard trigger + save RPC for custom plans)
.smoke/harness.js             (tests for items 1–6)
tools/test-commitments.js     (items 5/6 — DB-level tests, PGlite)
```

### 1.3 Files explicitly OUT of scope — must not be touched

```
src/data.js                   clinical protocols, ACTIONS, PROTOCOLS, food prices — no content changes
src/helpers.js                health maths (healthAge, bmi, cat, parseReading) — untouched
src/queue.js, src/shell.js    unrelated screens; shell.js only if a nav badge must change (it must not)
src/retention.js              data lifecycle
src/update.js, sw.js          update workflow shipped in the previous plan
tools/build.js                build pipeline
capacitor/, android/, dist/   artefacts — rebuilt, never hand-edited
package.json                  no new dependencies (a new script entry is allowed only if §2 CP-02 adds a test runner)
docs/ui-contract.md           READ-ONLY reference; it is the standard, not a file to rewrite
supabase/seed-demo.sql, supabase/test-security.sql
any file not listed in §1.2
```

### 1.4 Dependencies and external systems involved

```
Postgres 15+ (Supabase)     RLS, is_admin(), is_platform_admin(), trigger guard, JSONB interests
Supabase REST/Realtime      attendee row sync (attToRow / rowToAtt) — customPlan travels inside interests
esbuild                     bundle + CSS minify (build.js, unchanged)
jsdom + vm                  .smoke/harness.js
PGlite (dev only)           tools/test-commitments.js — runs real schema.sql against Postgres 18 in WASM
Browser File API            item 5's import path (readAsText) — no new library
Capacitor WebView           must keep working; no native API is introduced
```

### 1.5 Definition of done

```
- Every button row in the shipped app has >= 8 px between controls at 320 px width, verified by a new
  harness assertion over the templates AND by a manual capture at 320 / 360 / 414 px.
- The three metric cards carry no arrow, are keyboard-focusable, and each opens its own view.
- Each metric view shows its reading(s); a metric with no value shows the empty state and still navigates.
- Advancing Check -> Results asks "Are you sure about these results?" with Confirm and Edit; Confirm is the
  only path that marks the readings submitted; Edit returns to the Check screen with values intact.
- The registration form has a visible Cancel that clears the form and lands on Home, for both a new visitor
  and a follow-up visit.
- A Church Admin or the App Owner can write or import a custom plan; it replaces the generated plan on the
  Plan screen and in Send-home (WhatsApp preview, email body, printed card).
- A plain member/volunteer sees no custom-plan controls, and a direct API write of interests.customPlan is
  REFUSED by Postgres (proven by a PGlite test), not merely hidden.
- npm run typecheck -> 0 errors
- npm run build -> succeeds, dist/ regenerated
- npm test -> all checks pass, baseline 886 + new assertions, ZERO new failures
- npm run test:build -> 17/17
- npm run test:db -> baseline 34 + new assertions, 0 failures
- No file outside §1.2 modified (git status must show exactly the §1.2 list)
```

### 1.6 DECISIONS — resolved 2026-10-29

The operator accepted the recommended option for **Q1–Q12** on 2026-10-29. Recorded here as **D-01 … D-12**. These are binding: an AFTER block that contradicts a decision is a plan violation, and the rejected options are recorded so they are not re-litigated.

| ID | Question | Decision | Consequence in this plan |
|---|---|---|---|
| **D-01** | Meaning of "historical entries" on a metric view (Q1) | This visit's reading only: value, classification, reference range, counselling line. No cross-visit history. | `viewMetric()` needs no new state and no schema change. Rejected: per-person history (the app has no person identity) and a readings-history table (a separate plan). |
| **D-02** | The submit moment (Q2) | The Check → Results transition — one confirmation per visit. | The gate goes in `onStep`/`goVisit`. Not in `onStationCommit` (per keystroke) and not in `finishVisit` (already too late). |
| **D-03** | Import format (Q3) | The app's own JSON template. | `parseCustomPlanFile()` handles JSON only. No plain-text parser, no second failure mode. |
| **D-04** | Custom plan lifetime (Q4) | On that visitor's record at `interests.customPlan`; travels like `churchPlan`. | `attToRow` already sends `interests` wholesale, so no mapper change. Nothing is written to `church_plans`. |
| **D-05** | Role boundary (Q5) | App Owner = `platform_admins`. Church Admin = `role='admin' and status='approved'`. Team leaders, staff and members excluded. | `canCustomPlan()` is the single client predicate; `is_admin() or is_platform_admin()` is the single server predicate. |
| **D-06** | Metric view placement (Q6) | A sub-screen of the Check tab — the same pattern as the Food screen under Plan. | No new tab and no nav change; Back returns to Check. |
| **D-07** | Status pill after the arrow is removed (Q7) | Keep the pill; remove only the arrow. | `ui.js` gains an arrow-less pill variant used by the three tiles. The pill still carries the clinical status, so it keeps its contrast. The earlier "no ui.js change" note is superseded. |
| **D-08** | Editing after confirmation (Q8) | Add "Edit readings" on Results, returning to Check with values intact. | A new control on the Results screen, reusing the existing step mechanism. |
| **D-09** | Incomplete readings at the gate (Q9) | The dialog names the missing checks. | Body lists what is blank ("No blood sugar recorded") and still allows proceeding. |
| **D-10** | Safety furniture on a custom plan (Q10) | Keep `precautionsHTML()`, the "keep taking your pills" block and the disclaimer. Replace only the credit line with "written by ‹church›". | `customPlanFor()` renders through the same plan chrome. It must not build a bare list. |
| **D-11** | Template download (Q11) | A "Download template" action emitting exactly the JSON the importer accepts. | One more action plus a Blob download in the style of `downloadCSV`. No new dependency. |
| **D-12** | Item 1 scope (Q12) | Bounded: the measured violation, the `btn-row` rule, and wrap fixes. Not a 99-row sweep. | CHANGE 3 is bounded by a grep list recorded in A.5. A full sweep is a separate plan. |

**Still open — Q13 (working-tree state).** `index.html` and `src/ui.js` carried uncommitted operator changes (ECG) when this plan was written, and D-07 now guarantees CHANGE 4 touches `src/ui.js` too. CP-03 must rebase onto a committed tree before applying anything. This blocks *applying* code; it does not block writing it.

---

## § 2 · CHECKPOINT EXECUTION PLAN

---

### ✦ CP-01 · Read and understand the full codebase context

**Status:** `DONE`

#### File map (read in full unless marked)

| File | Lines | How it was read |
|---|---|---|
| `src/visitor.js` | 682 | FULL — tiles, registration form, `registerSubmit`, `toggleReg`, `newVisitFrom`, `finishVisit`, `onStationCommit` |
| `src/results.js` | 542 | `viewResults` (37–104), `planFor` (241–258), `viewPlan` (260–300+) read in full; rest grepped |
| `src/ui.js` | 92 | FULL |
| `src/churchPlans.js` | 306 | 55–140 (`chosenChurchPlan`, `churchPlanFor`, `churchPlanPicker`, `viewChurchPlan`, `churchPlansBox`) in full; rest grepped |
| `src/account.js` | 1289 | `isChurchAdmin` (38), `acctTabs`/`renderAcct` (572–620), `pledgeHTML`/`viewProfile` (260–360, 555–700), notification block (520–565) read; rest grepped |
| `src/volunteer.js` | 1257 | 1–100 (badge maths), `isAdminAcct` (331), `mayPlace` (335) read; rest grepped |
| `src/cloud.js` | 574 | `attToRow` / `rowToAtt` read in full; rest grepped |
| `src/feedback.js` | 76 | FULL |
| `src/action-registry.js` | 199 | FULL |
| `src/main.js` | 43 | FULL |
| `src/types.js` | 52 | Grepped (typedefs) |
| `index.html` | 1439 | Head, sheet markup (1241–1430), toast (1387–1400) read; CSS grepped by selector |
| `supabase/schema.sql` | 2280 | `is_admin` / `is_platform_admin` (462–520), `volunteers_place_guard` (1429+), `notify` (1756), notifications block read; rest grepped |
| `docs/ui-contract.md` | 642 | §3.3 spacing table (202–220) read; rest grepped |
| `.smoke/harness.js` | 4087 | Boot machinery (1–160), `16e` section read; policing assertions grepped |

#### Grep output (raw)

```
$ grep -rn "tileHTML\|splitBtnHTML\|ctaHTML" src/*.js | grep -v "^src/ui.js"
src/visitor.js:15:import { bannerHTML, capsuleHTML, ctaHTML, ecgHTML, rulerHTML, spectrumHTML, splitBtnHTML, tileHTML } from './ui.js';
src/visitor.js:163:   <button data-action="openCloud" class="hx-practice-go" aria-label="Sign in">${splitBtnHTML({label:'Sign in'})}</button>
src/visitor.js:167:   ${tileHTML({label:'Blood pressure',icon:I.pulse,value:`${a.s.sys??'—'}/${a.s.dia??'—'}`,status:cbp[1],tone:'ruby',pill:true})}
src/visitor.js:168:   ${tileHTML({label:'Blood sugar',icon:I.drop,value:a.s.sugar==null?'—':fmt1(a.s.sugar),status:csg[1],tone:'amber',pill:true})}
src/visitor.js:169:   ${tileHTML({label:'Body BMI',icon:I.scale,value:bmi(a)?fmt1(bmi(a)):'—',status:cbm[1],tone:'cobalt',pill:true})}
src/visitor.js:176:   ${ctaHTML({label:ctaLabel})}
src/visitor.js:226:   <span class="hx-banner-bottom"><strong>Pledge &amp; Booth Registration</strong>${splitBtnHTML({label:'Details',variant:'mint'})}</span>

$ grep -rn "custom plan\|customPlan\|override" src/*.js supabase/schema.sql
(no output)

$ git log --oneline -S "customPlan" -- src
(no output)          # the feature has never existed in this repository

$ grep -n "arrow" src/icons.js
21: arrow:svgW('<path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7"/>'),

$ grep -rh 'class="btn[^"]*"' src/*.js | wc -l
99

$ grep -rn 'gap-1\.5' src/*.js | grep -i "btn\|button"
src/visitor.js:187   <div class="mt-1 grid grid-cols-2 gap-1.5" role="group" aria-label="Sex">  ... class="btn btn-glass py-2.5 text-[12px]"
src/churchPlans.js:241   flex flex-wrap items-center gap-1.5 ... (pill chips, not .btn)
src/visitor.js:545       flex flex-wrap gap-1.5 ... (pill chips, not .btn)

$ grep -n "regOpen\|registerSubmit\|newVisitFrom" src/visitor.js
179:  ${state.regOpen?`<div class="glass p-4">
182:   <form data-action="registerSubmit" novalidate class="pop-in mt-4 space-y-3">
207:    <button data-action="toggleReg" class="hx-round hx-round-ivory" ...>
271: export function toggleReg(){state.regOpen=!state.regOpen;renderMain();...}
369: export function registerSubmit(e,force){
397:  attendees.push(a);state.activeId=a.id;state.regOpen=false;...
505: export function newVisitFrom(id){

$ grep -n "chosenChurchPlan\|churchPlanFor\|churchPlanPicker\|viewChurchPlan" src/churchPlans.js
60:export function chosenChurchPlan(a){
65:export function churchPlanFor(a,cp){
81:export function churchPlanPicker(a){
89:export function viewChurchPlan(a,cp){
```

#### Data flow summary

- **Readings** enter on the Check screen through `onStationCommit(id, k, el, min, max, step)`. It validates against per-field ranges, writes directly into the in-memory attendee (`a.s[k]`), calls `crossCheck` + `updateScreenMeta`, and every later render re-reads `a.s`. There is **no staging buffer and no submit event** — the DOM input and the record are the same value.
- **Persistence** is layered: `persist()` → `localStorage` → `cloudPush()` → Supabase `attendees` row via `attToRow`, which sends `interests` **wholesale** (`interests: a.interests || {}`). Any new key inside `interests` therefore survives the round trip without a schema or mapper change.
- **The Plan screen** resolves its content in one place: `viewPlan()` calls `chosenChurchPlan(a)` first (a church plan chosen per visitor, stored at `a.interests.churchPlan`), else `planFor(a, state.protocol)` (generated). Both return the **same object shape** — `{pk, p, goal, problem, urgent, top, more, secondary, recheck}` — which is why `viewChurchPlan` can render a church plan through the same card markup and why the WhatsApp/email/print paths need no branching.
- **Send-home** (`viewSend`, `src/visitor.js:62`) re-calls `planFor(a)` to name the plan in the header. If a custom plan is added, this call must resolve to the override or the header will contradict the plan the visitor was shown.
- **Authorization** exists in two layers that are already in use: client predicates (`isAdminAcct()` = approved church admin; `cloud.acct.platform_admin` = App Owner) and SQL predicates (`is_admin()`, `is_platform_admin()`). The codebase's established pattern for protecting a *column* from a *direct row write* is a `BEFORE UPDATE` trigger comparing OLD/NEW against a session flag — `volunteers_place_guard` is the working precedent.

---

### ✦ CP-02 · Generate the complete implementation

**Status:** `Phase A DONE · Phase B READY — decisions D-01…D-12 recorded, code not yet generated`

#### Phase A — Change index

```
CHANGE 1
  File:     index.html  (CSS)
  Location: the button/utility block, beside the existing `.btn` rules
  Type:     ADD
  Summary:  Add one rule `.btn-row{gap:8px}` (the §3.3 "bento gap" already used by the card grid) so a
            row of buttons has a named, single-source spacing value.
  Depends:  none

CHANGE 2
  File:     src/visitor.js:187
  Location: the Sex group in the New visitor form
  Type:     MODIFY
  Summary:  Change `gap-1.5` (6 px) to `gap-2` (8 px) on the Male/Female pair — the one measured violation
            of the 8 px rule among .btn rows.
  Depends:  none

CHANGE 3
  File:     src/visitor.js (every flex row whose children carry `class="btn`, ~99 occurrences)
  Location: enumerated during CP-03 from a grep list recorded in §6 A.5
  Type:     MODIFY
  Summary:  Replace ad-hoc gaps on button rows with `btn-row`; add `flex-wrap` where a 320 px viewport
            forces a third control onto a second line. No visual change above 360 px.
  Depends:  CHANGE 1

CHANGE 4
  File:     src/ui.js — splitBtnHTML()
  Location: the split label + arrow-circle builder
  Type:     MODIFY
  Summary:  Add an arrow-less variant so the status pill renders its label without the arrow circle. The
            three metric tiles use it; the Sign-in and banner callers keep the arrow. Decision D-07.
            (Supersedes the earlier "no ui.js change needed" note in A.6.1.)
  Depends:  D-07

CHANGE 5
  File:     src/visitor.js:167–169
  Location: the three metric tiles
  Type:     MODIFY
  Summary:  Keep `pill:true` but pass the arrow-less variant, and wrap each tile in a
            `<button data-action="openMetric" data-args="bp|sugar|bmi">` so the whole card is the target.
            The pill keeps the clinical status readable; only the false affordance is removed. Decision D-07.
  Depends:  CHANGE 4

CHANGE 6
  File:     src/results.js
  Location: after viewResults()
  Type:     ADD
  Summary:  `viewMetric(key)` — one screen for bp | sugar | bmi showing the recorded value, its
            classification, the reference range, the counselling line, and the empty state
            "No results recorded yet" when the metric is null. Content per D-01.
  Depends:  D-01

CHANGE 7
  File:     src/visitor.js + src/results.js
  Location: screen routing
  Type:     ADD
  Summary:  `openMetric(key)` stores the metric on state and switches to a metric screen; `renderMain`
            dispatches to `viewMetric` for that state. Route must be reachable with no visitor too (guard).
  Depends:  CHANGE 6

CHANGE 8
  File:     src/action-registry.js, src/main.js
  Location: ACTION_MAP + __internals
  Type:     ADD
  Summary:  Register `openMetric`, `metricBack`, `cancelReg`, `confirmResults`, `editReadings`,
            `customPlanEdit`, `customPlanSave`, `customPlanImport`, `customPlanClear`, `customPlanTemplate`;
            export the new functions through __internals.
  Depends:  CHANGES 7, 10, 12, 16

CHANGE 9
  File:     src/visitor.js — onStep() / the Check → Results advance path
  Location: the transition into `results`
  Type:     MODIFY
  Summary:  Before advancing to Results, `await confirmAsk({title:'Are you sure about these results?',
            body:<the three headline readings + any blank check named>, label:'Yes, that is right',
            danger:false})`. Confirm advances; Edit stays on Check with every value untouched.
            The body names missing checks rather than asking a generic question. Decisions D-02, D-09.
  Depends:  D-02, D-09, CHANGE 21

CHANGE 10
  File:     src/visitor.js:179
  Location: the New visitor form header
  Type:     ADD
  Summary:  Add a visible "Cancel" button (btn btn-glass) beside the "New visitor" heading, wired to
            `cancelReg()`.
  Depends:  none

CHANGE 11
  File:     src/visitor.js
  Location: near toggleReg()
  Type:     ADD
  Summary:  `cancelReg()` — sets `state.regOpen=false`, clears `state.newVisitOf` and `state._goal`,
            re-renders Home. DOM inputs are discarded by the re-render (no draft state exists for this form,
            verified in CP-01).
  Depends:  CHANGE 10

CHANGE 12
  File:     src/types.js
  Location: typedefs
  Type:     ADD
  Summary:  `CustomPlan` typedef: {title, problem, actions:[{do,why,how:string[]}], note, by, at}.
  Depends:  D-04

CHANGE 13
  File:     src/churchPlans.js
  Location: beside churchPlanFor()
  Type:     ADD
  Summary:  `customPlanFor(a, cp)` — maps a CustomPlan into the same object shape planFor() returns, so the
            existing plan card, Send-home header, WhatsApp text and print card all consume it unchanged.
  Depends:  CHANGE 12

CHANGE 14
  File:     src/results.js — planFor()
  Location: the first line of planFor()
  Type:     MODIFY
  Summary:  Precedence becomes custom > church > generated: if `a.interests.customPlan` exists, return
            customPlanFor(a, it) before the chosenChurchPlan branch.
  Depends:  CHANGE 13

CHANGE 15
  File:     src/customPlan.js  (NEW)
  Location: whole file
  Type:     ADD
  Summary:  The template + editor payload: `blankCustomPlan()`, `normaliseCustomPlan(raw)` (trims, caps
            lengths, enforces 3–8 actions, rejects unknown keys), `parseCustomPlanFile(text)` for the JSON
            template, `customPlanTemplate()` returning that same JSON for download, and `customPlanHTML(a)`
            for the editor sheet. Decisions D-03, D-10, D-11.
  Depends:  D-03, D-11

CHANGE 16
  File:     src/results.js — viewPlan()
  Location: the header block of the standard plan
  Type:     ADD
  Summary:  Show a "Write a custom plan" / "Edit custom plan" / "Remove custom plan" control ONLY when
            `canCustomPlan()` is true; hidden entirely otherwise (not merely disabled).
  Depends:  CHANGE 15, CHANGE 17

CHANGE 17
  File:     src/account.js
  Location: beside isChurchAdmin()
  Type:     ADD
  Summary:  `canCustomPlan()` = `!!(cloud.acct && (cloud.acct.platform_admin || isAdminAcct()))`, importing
            isAdminAcct rather than restating the role test (see D-05).
  Depends:  none

CHANGE 18
  File:     supabase/schema.sql
  Location: beside volunteers_place_guard / the attendee guards
  Type:     ADD
  Summary:  `attendees_custom_plan_guard` BEFORE INSERT OR UPDATE trigger on public.attendees: when
            `new.interests ? 'customPlan'` and it differs from OLD, require `is_admin() or is_platform_admin()`,
            raising 42501 otherwise. Mirrors volunteers_place_guard's shape and error style.
  Depends:  none

CHANGE 19
  File:     .smoke/harness.js
  Location: a new section 16f
  Type:     ADD
  Summary:  Assertions for items 1–6: no `.btn` in a gap-1/gap-1.5 row; metric tiles carry no arrow and are
            buttons; viewMetric empty + populated; the confirm gate on Check → Results; cancelReg resets
            state and lands home; custom plan precedence; controls hidden for a member; the Edit-readings
            link returns to Check with values intact.
  Depends:  CHANGES 1–16, CHANGE 21

CHANGE 20
  File:     tools/test-commitments.js
  Location: a new section
  Type:     ADD
  Summary:  DB tests: an admin can write interests.customPlan; a member's identical write is refused 42501;
            a non-customPlan interests change by a member still succeeds (the guard must not block consent).
  Depends:  CHANGE 18

CHANGE 21
  File:     src/results.js — viewResults()
  Location: the header block, beside the health-age title
  Type:     ADD
  Summary:  An "Edit readings" control, shown when the visit's readings still exist, that returns to the Check
            screen with `a.s` untouched so the operator can correct a value and come back. Decision D-08.
  Depends:  D-08
```

#### Phase B — Exact code + tests: **NOT YET GENERATED**

§1.6 is resolved (D-01 … D-12), so nothing below is blocked by ambiguity any more. The operator's instruction was **planning only**, so no AFTER block has been written. Phase B is ready to generate on request: 21 changes, one BEFORE / AFTER / targeted-test block each, against the tree at HEAD `9507821` + the operator's uncommitted ECG work.

#### Phase C — Risks & unknowns

```
RISKS & UNKNOWNS:
  R-01  Wrapping a <div> tile in <button> changes the box model (button padding/border defaults) and the
        tile is a CSS grid child. Detected by: the 3-up grid collapsing or cards shifting at 320 px
        (manual capture) and by the harness's undefined-class check.
        Mitigation: style the button with `display:block;padding:0;border:0;background:none;text-align:inherit`
        — the same treatment already used for the `goVisit` CTA at src/visitor.js:175.

  R-02  `tileHTML` with `pill:false` renders `hx-tile-status`, which may be visually different from the
        current pill. If the operator wants the pill shape WITHOUT the arrow, that is a new `ui.js` variant
        (3 callers, therefore legitimate) rather than a one-line call-site change. Detected by: side-by-side
        capture. DECISION NEEDED — folded into Q1 review.

  R-03  The Check → Results gate (CHANGE 9) sits on a hot path used at every visit. If confirmAsk is slow or
        blocked, the operator cannot reach Results. Detected by: harness route test; timeout in the sheet.
        Mitigation: `confirmAsk` already resolves false when the sheet element is missing, and the harness
        auto-answers — the gate must not be the only way forward if the sheet fails to render.

  R-04  A client-only RBAC check is bypassable: the app writes attendee rows directly (attToRow → upsert), so
        any approved member can PATCH interests.customPlan over the API. The trigger in CHANGE 18 is the
        control; the UI gate is only a courtesy. If the trigger is omitted, item 6 is NOT satisfied.
        Detected by: tools/test-commitments.js member-write test.

  R-05  The guard must not block ordinary interests writes (consent `optin`, `churchPlan`, prayer flags stay
        member-writable). A naive `if new.interests is distinct from old.interests then require admin` would
        break consent capture — a clinical/legal regression. Detected by: R-05's dedicated test asserting a
        member CAN still change optin.

  R-06  Imported JSON is untrusted input. `parseCustomPlanFile` must validate types and lengths and must never
        inject into HTML — every field goes through esc() at render (the plan card already escapes do/why/how).
        A 2 MB file must be rejected before parse.

  R-07  Sending a custom plan by WhatsApp/email/print: these build text from planFor(); if precedence is added
        to viewPlan only, Send-home would announce the generated plan while the visitor saw the custom one.
        Detected by: a harness assertion that viewSend names the custom goal.

TESTS THAT MAY BREAK:
  T-01  "every button the screens draw has a registered action" — every new data-action must be registered in
        the same change (CHANGE 8). Expected to pass once wired.
  T-02  "no template class is missing from the stylesheet" — `btn-row` and any new class must be added to
        index.html in CHANGE 1. Expected to pass once added.
  T-03  "the app still has exactly two timers" — no timer is added; expected to remain passing.
  T-04  Existing plan/viewPlan assertions (if any) may assert the exact header markup; adding a control inside
        the header could break a regex. Will be fixed by tightening the assertion to the new markup, and the
        change will be recorded in A.6.
  T-05  `test:db` fixture tables must gain any column the new trigger reads; the fixture is built in the test
        file, so this is a test-side change, not a schema change.

PRE-EXISTING FAILURES:
  P-01  "saving to the device is fast" is threshold-flaky on a loaded machine (observed 301 ms against a
        300 ms bound once, 249 ms on the next run; payload unchanged at 1266 KB). Not this plan's
        responsibility; re-run before treating as a regression.
```

#### Proof required to pass CP-02

- [x] Phase A complete — index above.
- [ ] Phase B complete — **withheld**, see §1.6. Not claimed as done.
- [x] Phase C complete.
- [ ] Human operator sign-off — pending.
- [x] No code applied to any file — this document changes nothing in the app.

```
Human operator sign-off: [ PENDING ]
Notes from review: [ answer §1.6 Q1–Q5, then Phase B is generated ]
```

---

### ✦ CP-03 · Apply pre-approved code — atomic change→test loop

**Status:** `PENDING`

Execution follows the template verbatim: locate the CP-02 block → read the target file → apply exactly → `git diff` → `npm run typecheck` → run the pre-specified test → log in §6 A.2. Any mismatch between the BEFORE block and the file halts the loop.

Project-specific notes for the executor:

1. The harness builds from `src/` with esbuild, **not** from `dist/`. A harness run does not require a build; `test:build` does.
2. Every new `data-action` must be added to `action-registry.js` in the same change, or the harness's registry assertion fails.
3. Every new CSS class must be defined in `index.html`, or the undefined-class assertion fails.
4. `npm run test:db` needs `NODE_PATH` pointing at a PGlite install (`C:/Users/fanel/pglite-test/node_modules`) or `npm i -D @electric-sql/pglite` in this repo.
5. Apply changes in index order; CHANGES 6, 9, 15, 12 depend on §1.6 answers and cannot be applied before them.

---

### ✦ CP-04 · Full regression sweep

**Status:** `PENDING`

Baseline to beat (measured, not assumed):

```
npm run typecheck   ->  0 errors
npm test            ->  all 886 checks passed
npm run test:build  ->  all 17 build checks passed
npm run test:db     ->  all 34 DB checks passed  (with PGlite on NODE_PATH)
npm run test:hub    ->  35 passed, 0 failed      (with NEWSTART_PGLITE set)
```

Any new failure is this plan's responsibility. P-01 is not.

---

### ✦ CP-04.5 · Code quality review

**Status:** `PENDING`

Six dimensions per §3B. Dimension 6 (anti-bloat) is the one most at risk here: this plan adds a new module (`customPlan.js`), a new screen, an editor sheet and a trigger. Every one of them must be justified against §1, and the plan does not add a dependency, a second modal, a second admin predicate, or a parallel plan renderer.

---

### ✦ CP-05 · Final review

**Status:** `PENDING`

`git status` at the end must list exactly the §1.2 files — nothing more.

---

### ✦ CP-06 · Change report

**Status:** `PENDING` — written into §6 A.7.

---

### ✦ CP-07 · [ Custom checkpoint — device check ]

**Status:** `PENDING`

#### Instructions
1. After CP-04, rebuild the APK (`powershell -File tools/sign-app.ps1`) and install on a phone.
2. Verify at 320 px (small phone), 360 px and 414 px: no button row overflows, no label truncates mid-word.
3. Tap each metric card; confirm the arrow is gone and the destination screen opens.
4. Complete a visit end to end and confirm the Check → Results question appears once.
5. As a member (not admin) sign in and confirm no custom-plan control exists anywhere on the Plan screen.

#### Proof required to pass CP-07
- [ ] Screenshots at the three widths, one per changed screen.
- [ ] A screen recording of the confirm gate and the metric drill-down.
- [ ] `adb` install output or the APK file with its versionCode.

---

## § 3 · TOOL CALLING PROTOCOL

Adopted verbatim from template v1.4. Project-specific additions:

| Tool | Project rule |
|---|---|
| `grep` / `search` | Before adding any `data-action`, grep `ACTION_MAP` (duplicate names silently overwrite). Before adding a CSS class, grep `index.html` for the selector. |
| `terminal` | `npm test` takes 2–4 minutes; run it **once** per call and write to a file if you intend to grep it twice. |
| `git diff` | After every file write — the harness's own assertions are not a substitute for reading the diff. |

---

## § 3A · MICRO-TEST PROTOCOL

Each CHANGE's targeted test is specified in its CP-02 Phase B block once Phase B is generated.

Project-specific run commands:

```bash
# one harness section is not isolated — the suite runs as one process
npm test                     # full suite, includes the new 16f section
npm run test:build           # build artefacts only, seconds
NODE_PATH=C:/Users/fanel/pglite-test/node_modules npm run test:db
```

The harness has no single-test filter; a new section is verified by running the whole suite and reading the section's lines. This is the repo's established pattern and is not a reason to add a test framework.

---

## § 3B · CODE QUALITY RUBRIC

Adopted verbatim from template v1.4, with the repo's own conventions layered on:

- `// @ts-check` at the top of every touched module.
- Comments explain **why**, in prose, in the voice already used across `src/`.
- All user-supplied text through `esc()` before interpolation.
- SQL: `security definer`, `set search_path = ''`, explicit `revoke all`, targeted `grant`.
- British/SA English.
- No new dependency.

---

## § 4 · FAILURE MODES & COUNTERMEASURES

Adopted verbatim from template v1.4. The three most likely here:

| Failure | Countermeasure for this repo |
|---|---|
| New `data-action` with no adapter | The harness names it. Register it; do not weaken the assertion. |
| New CSS class not in the stylesheet | The harness enumerates every missing class. Add them to `index.html`; do not add a utility library. |
| A guard trigger blocks a legitimate write | The PGlite suite must include the "member can still change consent" case before the trigger ships. |

---

## § 5 · PROOF & ANTI-HALLUCINATION PROTOCOL

Adopted verbatim from template v1.4. Forbidden status words: *I believe, I think, should be, likely, probably.*

Repo-specific tripwires:

| # | Tripwire |
|---|---|
| H.11 | Claiming "the tests pass" without pasting the `all N checks passed` line. |
| H.12 | Claiming RBAC works when only the UI check exists and no PGlite member-write test was run. |
| H.13 | Claiming a screen "works" without a harness assertion or a device capture at 320 px. |

---

## § 6 · CODE APPENDIX

### A.1 · Pre-generated code register — EMPTY
Populated when CP-02 Phase B is generated and signed off.

### A.2 · Per-change test results — EMPTY
### A.3 · Full suite output — EMPTY

### A.4 · Quality review log — EMPTY

### A.5 · Errors encountered & resolutions — EMPTY

### A.6 · Decisions & deviations

```
A.6.1 — 2026-10-29 — Item 2 arrow removal
DEVIATION: planned as a ui.js change; resolved as a call-site change (pill:false).
REASON:    splitBtnHTML's arrow belongs to a shared component used by Sign in and the banner. Removing the
           option from the component would break those; adding an arrow:false flag used only by three tiles
           is a single-purpose parameter. The tile already has a pill-less branch.
APPROVED BY: pending operator confirmation (see R-02).

A.6.2 — 2026-10-29 — Item 5 is not a "restore"
DEVIATION: the brief says "restore"; git log -S "customPlan" -- src returns nothing.
REASON:    the feature has never existed in this repository. Item 5 is new work. The nearest existing
           feature is the church plan library, which is a different thing (pre-written, reusable, selected)
           and is deliberately left untouched.
APPROVED BY: recorded for the operator; does not change the deliverable.

A.6.3 — 2026-10-29 — Tree moved during authoring
OBSERVATION: HEAD advanced to 9507821 while this plan was being written; uncommitted operator changes exist
           in index.html (CSS) and src/ui.js (ecgHTML only).
ACTION:    every line number cited in §2 CP-01 was re-verified against the working tree after the drift —
           visitor.js 167-169 (tiles), 179 (reg form), 187 (sex gap), 271 (toggleReg), 369 (registerSubmit)
           all still hold. src/ui.js changed only in ecgHTML; tileHTML and splitBtnHTML are untouched, so
           the item-2 premise stands.
RISK:      a concurrent edit to index.html CSS can collide with CHANGE 1. Rebase before CP-03.
APPROVED BY: self — verification only, no plan change.

A.6.4 — 2026-10-29 — Decisions recorded
DECISION:  The operator accepted the recommended option for Q1–Q12 ("lets go with recommended options"),
           keyed into §1.6 as D-01 … D-12. Q13 (working-tree state) left open.
EFFECT:    Supersedes the "no ui.js change needed" note in A.6.1 — D-07 keeps the status pill and removes
           only the arrow, so CHANGE 4 now modifies splitBtnHTML(). Adds CHANGE 21 (Edit readings on Results,
           D-08). CHANGE 15 gains template download (D-11) and the plan-chrome constraint (D-10).
           No file in the application was modified by this decision pass.
APPROVED BY: fanel (operator), 2026-10-29.
```

### A.7 · Change report — EMPTY (written at CP-06)

---

## § 7 · HARD STOP RULES

Adopted verbatim from template v1.4, HS-1 … HS-10, plus:

| # | Rule |
|---|---|
| **HS-11** | Every AFTER block must implement decisions **D-01 … D-12** as recorded in §1.6. A block that contradicts a decision, or that reintroduces a rejected option, is a plan violation. |

---

## PLAN COMPLETION SIGN-OFF

| Checkpoint | Status | Proof location |
|---|---|---|
| CP-01 Read codebase | `DONE` | §2 CP-01 (file map, grep output, data flow) |
| CP-02A Change index | `DONE` | §2 CP-02 Phase A (21 changes) |
| CP-02B Code generation | `READY — not requested` | §1.6 decisions D-01…D-12 recorded |
| CP-02C Risks & operator sign-off | `RISKS DONE` / sign-off `PENDING` | §2 CP-02 Phase C |
| CP-03 Apply pre-approved code | `PENDING` | §6 A.2 |
| CP-04 Full regression sweep | `PENDING` | §6 A.3 |
| CP-04.5 Code quality review | `PENDING` | §6 A.4 |
| CP-05 Final review | `PENDING` | §2 CP-05 |
| CP-06 Change report | `PENDING` | §6 A.7 |
| CP-07 Custom (device check) | `PENDING` | §2 CP-07 |

**Quality verdict:** `N/A — no code applied`
**Anti-bloat verdict (§0):** `LEAN — no code applied; 20 changes, 1 new module, 0 new dependencies`
**Change report attached (CP-06):** `NO`
**Final git diff attached:** `NO — this plan modifies no file`
**Human operator final sign-off:** `[ PENDING ]`
**Definition of done verified (§1.5):** `NO — not started`
