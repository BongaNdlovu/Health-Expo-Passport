# CODING AGENT EXECUTION & VERIFICATION PLAN
### Version 3.0 · Traceable Evidence Spine · Sieve-Style Coding · Shift-Left Quality · Zero-Bloat

---

## PLAN METADATA

| Field | Value |
| :--- | :--- |
| **Plan Name** | `Remove a visitor who wandered off` |
| **Version** | `v3.0` |
| **Agent ID / Session** | `Claude Code (claude-opus-5-5), session d64fca40` |
| **Codebase / Repo** | `C:\Users\fanel\Downloads\Health Expo @ main` |
| **Base Git SHA** | `ba084c677733211db52c325855bbec7504e23886` (**working tree NOT clean — see §1.0**) |
| **Language / Stack** | `JavaScript (ES modules, // @ts-check via tsc), Supabase Postgres, Capacitor Android` |
| **Plan Author** | `[ human operator name ]` |
| **Date Created** | `2026-10-30` |

---

> **AGENT PREAMBLE — READ FIRST, EVERY SESSION** — as in the template v3.0 (no evidence, no plan; no hedge
> words; minimal effective code; sieve-style, project conventions first).

---

## § 0 · PRIME DIRECTIVES
Unchanged from template v3.0 §0.1–§0.3. Project-first notes for this repo (from `EV-CP01-01`):
- No ESLint / Prettier config exists. The governing checks are `npm run typecheck` (`tsc --noEmit -p jsconfig.json`)
  and the smoke harness `npm test` (`node --expose-gc .smoke/harness.js`).
- House style (matched, not re-styled): terse one-line guards (`if(!x)return;`), one-space indentation, no semicolon-free
  style, comments explain *why*. Sieve patterns apply inside that style.

---

## § 1 · FULL SCOPE & TRACEABLE VERIFICATION CONTRACT

### 1.0 Status of the finding (answer to the operator's question)
**Today, visitors cannot be deleted in the app.** The queue's "Remove" (`src/queue.js:131 queueRemove`) only marks a
visitor's place in one station's line as `left`; the visitor stays in *Visitors today* and in the shared database. The only
deletion paths are the 2-year retention purge (`src/account.js:1617`, `supabase/schema.sql:2449/2457`) and Reset demo
(demo mode only). Uploads only insert/upsert (`src/account.js:1514 pushDirty`), so a local splice would never reach
other desks. `[Ref: EV-CP01-02]`

**Database rule found:** deleting a visitor row is allowed **only for church admins**
(`supabase/schema.sql:350` "admins delete", `:675` "church admins delete … church_id = staff_church() and is_admin()").
Staff are refused, and a refused PostgREST delete returns **no error and zero rows** — so the app must ask for the
deleted rows back and treat 0 as "not allowed". `[Ref: EV-CP01-02b]`

**Operator amendment (2026-10-30): team leaders may remove visitors too.** A team leader is an approved member of an
active church whose linked volunteer row has `lead = true` — the same test `public.can_place` already uses
(`supabase/schema.sql:1620-1638`) and the app's `mayPlace()` (`src/volunteer.js:337-342`). The table's delete policy
admits admins only, so leaders cannot delete through it. The plan therefore adds **one SECURITY DEFINER function
`public.remove_visitor(p_id text) returns boolean`** that deletes the caller's own church's row when the caller is an
approved admin **or** a team leader of that church, and the app calls it for every shared removal. The table's
"admins delete" policies stay exactly as they are. This is the plan's only schema change and **requires re-running
`supabase/schema.sql` in Supabase** before the app build ships. `[Ref: EV-CP01-02c]`

**Blocker before execution:** another agent is editing the same files right now (`git status` at 19:2x shows
`M src/account.js, src/main.js, src/state.js, index.html, .smoke/harness.js` + `.smoke/tmp-bench*.js`). The `BEFORE`
blocks below were read from the working tree at 19:24 and **must be re-verified at CP-03 step 1** after that agent
commits. CP-01 must be re-run then (see EV-CP01-03/04 notes). `[Ref: EV-CP01-05]`

### 1.1 Numbered Requirements & Architectural Invariants
```
FUNCTIONAL REQUIREMENTS:
  - REQ-01: In the visitor journey header (Check / Results / Plan / Send home), a "Remove visitor" control removes the
            current visitor after a danger confirmation naming them ("Remove <name>?").
  - REQ-02: Signed in, removal deletes the row from public.attendees for this church first; only when the database
            confirms the row is gone is the visitor removed from this device. Other desks drop it via the existing
            realtime DELETE handler / next full pull.
  - REQ-03: Not signed in (demo / this device only), removal splices the visitor from this device only.
  - REQ-04: Signed in, the control is shown only to an approved church admin or a team leader (mayPlace()); everyone
            else is told only admins and team leaders can remove. A refused removal (function returns false or
            raises) or an offline one leaves the visitor in place and says why.
  - REQ-07: The database itself enforces REQ-04: public.remove_visitor(p_id) deletes only a row of the caller's own
            church and only for an approved admin or team leader of an active church; anyone else gets false.
  - REQ-05: Any open place of that visitor in a station line (waiting / serving) is marked "left".
  - REQ-06: A double tap removes once (one DELETE request).

ARCHITECTURAL INVARIANTS:
  - INV-01: Upload / pull / realtime sync logic is unchanged (pushDirty, cloudSync, onRemoteChange untouched).
  - INV-02: Schema change limited to ADDING public.remove_visitor + its grants. Existing policies ("admins delete",
            "church admins delete"), tables and functions are untouched; RLS keeps refusing direct deletes by staff
            and team leaders.
  - INV-03: Queue "Remove from line" (queueRemove two-tap) behaves exactly as before.
  - INV-04: Every existing harness check still passes; typecheck stays at 0 errors.
```

### 1.2 Files IN Scope
```
src/account.js          (removeVisitorAsk)
src/queue.js            (queueLeaveFor)
src/visitor.js          (journeyTop: the Remove control)
src/action-registry.js  ('visitor-remove')
src/main.js             (__internals exports for the harness)
src/state.js            (cloud.removing default, for typecheck)
index.html              (.jr-tools / .jr-remove CSS)
.smoke/harness.js       (TST-01 app tests via srv.rpcs mock + TST-02 PGlite database tests)
supabase/schema.sql     (ADD public.remove_visitor only — CHG-08)
dist/*, capacitor APK   (regenerated by the build only, never hand-edited)
```

### 1.3 Files OUT of Scope
```
existing policies/functions in supabase/schema.sql (INV-02) · src/cloud.js · tools/* · package.json / lockfiles · launch-video/* · the other agent's files
(.smoke/tmp-bench*.js, FIX-PLAN-sync-ui.md, context.md, .zcode/, .tmp-baseline/)
```

### 1.4 External Systems, Linters & Boundaries Touched
```
Supabase PostgREST: POST /rpc/remove_visitor {p_id} (new SECURITY DEFINER function, CHG-08); queue_entries UPDATE via existing qMove.
Supabase SQL editor: operator re-runs supabase/schema.sql once (adds the function).
Supabase Realtime: existing DELETE handler in onRemoteChange (unchanged).
Checks: npm run typecheck · npm test (PGlite DB tests need NEWSTART_PGLITE=C:/Users/fanel/pglite-test) · npm run test:build.
```

### 1.5 Definition of Done
Template v3.0 §1.5, plus: verified on the emulator (admin account) that the control appears, Cancel keeps the visitor,
Remove deletes it, and the build/APK is rebuilt.

### 1.6 Master Evidence Traceability Matrix

| Tracked Item ID | Category | Description / Target | Mapped Change | Verification Command / Method | Required Evidence ID | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `BASE-01` | Forensics | Scope file map, line counts, linters | N/A | `wc -l …; ls .eslintrc* …; package.json scripts` | `EV-CP01-01` | VERIFIED (19:15) |
| `BASE-02` | Forensics | Symbol & caller trace + RLS delete rule | N/A | `grep -rn …` (A.0) | `EV-CP01-02`, `EV-CP01-02b` | VERIFIED |
| `BASE-03` | Baseline | Typecheck | N/A | `npm run typecheck` | `EV-CP01-03` | PROVISIONAL — re-run after other agent |
| `BASE-04` | Baseline | Test suite | N/A | `NEWSTART_PGLITE=… npm test` | `EV-CP01-04` | INVALID — stopped (tree mid-edit); re-run |
| `BASE-05` | Integrity | Concurrent edits present | N/A | `git status --short` | `EV-CP01-05` | VERIFIED (blocker) |
| `REQ-01` | Requirement | Remove control + confirm | CHG-03, CHG-04, CHG-05 | harness TST-01-V4 (source) + emulator | `EV-CP03-CHG03-GREEN` | PENDING |
| `REQ-02` | Requirement | Shared delete first, then local | CHG-02, CHG-07 | `npm test` TST-01-V1 | `EV-CP03-CHG02-GREEN` | PENDING |
| `REQ-03` | Requirement | Local-only removal | CHG-02 | TST-01-V5 | `EV-CP03-CHG02-GREEN` | PENDING |
| `REQ-04` | Requirement | Admins + team leaders; refused/offline keeps visitor | CHG-02, CHG-03 | TST-01-V2a..V2e, TST-01-V7 | `EV-CP03-CHG02-GREEN` | PENDING |
| `REQ-07` | Requirement | DB enforces admin-or-leader, own church only | CHG-08 | PGlite TST-02-V1..V3 (`npm test`, DB section) | `EV-CP03-CHG08-GREEN` | PENDING |
| `REQ-05` | Requirement | Open queue places → left | CHG-01, CHG-02 | TST-01-V6 | `EV-CP03-CHG01-GREEN` | PENDING |
| `REQ-06` | Requirement | Double tap deletes once | CHG-02 | TST-01-V3 | `EV-CP03-CHG02-GREEN` | PENDING |
| `INV-01..04` | Invariant | Sync, schema, queueRemove, suite | ALL | `npm test`, `npm run typecheck`, `git diff --stat` | `EV-CP04-SUITE`, `EV-CP04-LINT`, `EV-CP05-DIFF` | PENDING |
| `SIEVE-01` | Style | 7D audit | ALL | inspection | `EV-CP02-AUDIT`, `EV-CP04-AUDIT` | PRE-APPLY PASS (A.4) |
| `SCOPE-01` | Integrity | Only §1.2 files changed | ALL | `git status -s && git diff --stat` | `EV-CP05-DIFF` | PENDING |

---

## § 2 · SEQUENTIAL CHECKPOINT EXECUTION PLAN

### ✦ CP-01 · Forensics & Baseline — **Status: PARTIAL (re-run BASE-03/04 when the other agent has committed)**
```
DATA & STATE FLOW SUMMARY:
- Entry: a tap on [data-action="visitor-remove"] → action-registry → removeVisitorAsk(id) in account.js (has attendees,
  cloud, state, confirmAsk, toast, render, KINDS, isNet, persist, saveSyncedSoon in scope).
- Shared state: attendees[] (data.js), cloud.synced.att{id→sig} (sync ledger), state.activeId, queue[] (queue.js).
- Mutations: DELETE on public.attendees (RLS: church admins only; refusal = 0 rows, no error); splice attendees;
  delete ledger key; queue entries → 'left' via existing qMove (live: queue_entries UPDATE; practice: local).
- Other desks: onRemoteChange DELETE branch already removes an unedited row (account.js:1659); full pull also does.
- Linters: none beyond tsc; house style = terse guards (sieve-compatible).
```

### ✦ CP-02 · Locked code, tests, shift-left audit — **Status: DONE (pre-apply), awaiting operator sign-off**

#### Phase A — Atomic Change Index (dependency order)
```
CHG-08  supabase/schema.sql ADD    public.remove_visitor(p_id) + grants (applied FIRST) Satisfies REQ-07, INV-02
CHG-01  src/queue.js        ADD    queueLeaveFor(attendeeId) after queueRemove       Satisfies REQ-05, INV-03
CHG-02  src/account.js      ADD    removeVisitorAsk(id) above applyRetention; shared removal = rpc('remove_visitor')
        Satisfies REQ-02/03/04/06, INV-01  + import queueLeaveFor (queue.js) and mayPlace (volunteer.js)
CHG-03  src/visitor.js      MODIFY journeyTop(): Remove control (admins + team leaders when signed in; anyone in demo)
        Satisfies REQ-01/04  + import mayPlace
CHG-04  index.html          ADD    .jr-tools / .jr-remove rules after .jr-change    Satisfies REQ-01
CHG-05  src/action-registry.js MODIFY import + 'visitor-remove'                       Satisfies REQ-01
CHG-06  src/main.js + src/state.js  MODIFY __internals (removeVisitorAsk, queueLeaveFor); cloud default removing:''
CHG-07  .smoke/harness.js   MODIFY TST-01 app block (srv.rpcs.remove_visitor mock) + TST-02 PGlite block
        Satisfies REQ-01..07
Sieve applied: flat guards, named predicates (isShared, isOnServer, isAdmin, wasDeleted, isOpen), one in-flight slot
(cloud.removing) set before the confirmation so a second tap bounces.
```

#### Phase D — Risks
```
- Other agent's concurrent edits to account.js/main.js/state.js/harness → BEFORE mismatch → HALT (CP-03 step 1).
- Refusal must not be silent → remove_visitor returns false (not allowed / not found) → TST-01-V2d, TST-02-V2.
- App build shipped before the schema re-run → rpc error "Could not find the function" → visitor kept, message shown
  (TST-01-V2f); README gets no new step beyond the existing "re-run schema.sql".
- A team leader removes a visitor from another station: allowed by design (the operator asked for team leaders, not
  per-station); the function still limits them to their own church.
- Visitor with an unsynced local edit: isOnServer uses the ledger; an unsynced *new* visitor is local-only → splice.
- Realtime echo of our own DELETE: onRemoteChange finds no row (already spliced) → no-op.
- Existing harness counts (N attendees) → tests use their own rows EXPO-4100/4101 and leave N unchanged.
EXISTING TESTS EXPECTED TO CHANGE: none (new block only; the unwired-action / duplicate-id tests cover the new button).
```

#### Operator sign-off
```
Human Operator Sign-Off: [ NAME / DATE ]
Decided (operator, 2026-10-30): church admins AND team leaders may remove when signed in. Other staff and members
cannot. Platform admins browsing a church are not included (they are not that church's admin or leader).
```

### ✦ CP-03 … CP-06
As template v3.0. Additional CP-03 step 0: `git status --short` must show the other agent's work committed (no foreign
`M` on §1.2 files) before step 1. CHG-08 (schema) is applied and its PGlite tests are green before any app change. After CP-04: `node tools/build.js`, `npm run test:build`, sign the APK
(`powershell -ExecutionPolicy Bypass -File tools/sign-app.ps1`, bump versionCode), emulator check (admin account).

---

## § 6 · IMMUTABLE EVIDENCE LEDGER

### A.0 · Forensics & Pre-Flight Baseline (CP-01)
```
================================================================================
EVIDENCE ID:   EV-CP01-01 (Scope File Map, Line Counts & Project Linter Rules)
TIMESTAMP:     2026-10-30 19:15
COMMAND:       wc -l src/visitor.js src/account.js src/queue.js src/action-registry.js src/main.js .smoke/harness.js;
               ls .eslintrc* eslint.config.* .prettierrc*; grep -n '"scripts"' -A10 package.json
EXIT CODE:     0
GIT SHA:       ba084c6
RAW OUTPUT:
   743 src/visitor.js
  1682 src/account.js
   331 src/queue.js
   229 src/action-registry.js
    45 src/main.js
  4754 .smoke/harness.js
  7784 total
ls: cannot access '.eslintrc*': No such file or directory
ls: cannot access 'eslint.config.*': No such file or directory
ls: cannot access '.prettierrc*': No such file or directory
10:  "scripts": {
11-    "build": "node tools/build.js",
12-    "test": "node --expose-gc .smoke/harness.js",
13-    "test:hub": "node tools/test-volunteer-hub.js",
14-    "test:build": "node tools/test-build.js",
15-    "test:db": "node tools/test-commitments.js",
16-    "typecheck": "tsc --noEmit -p jsconfig.json"
================================================================================

================================================================================
EVIDENCE ID:   EV-CP01-02 (Symbol & Caller Grep Trace)
TIMESTAMP:     2026-10-30 19:15
COMMAND:       grep -rn "attendees.splice\|queueRemove\|resetDemoAsk\|function visitorListHTML\|export function cloudDirtyList\|async function pushDirty\|export function onRemoteChange\|is_staff()" src/*.js supabase/schema.sql
EXIT CODE:     0
RAW OUTPUT (abridged to the lines that decide this plan; full file plans/ev/EV-CP01-02.txt):
src/account.js:1514:async function pushDirty(){
src/account.js:1617:  if(!followedUp(a)){attendees.splice(i,1);delete cloud.synced.att[a.id];n++;}
src/account.js:1653:export function onRemoteChange(kind,p){
src/action-registry.js:63:  queueRemove: el => queueRemove(el.dataset.args),
src/queue.js:131:export function queueRemove(id){
src/visitor.js:260:    ${cloud.user||cloud.mode?'':`<button data-action="resetDemoAsk">Reset demo</button>`}
src/visitor.js:465:export async function resetDemoAsk(){
================================================================================

================================================================================
EVIDENCE ID:   EV-CP01-02b (Delete permission in the database)
COMMAND:       sed -n 336,351p supabase/schema.sql; grep -n "for delete" supabase/schema.sql
EXIT CODE:     0
RAW OUTPUT:
-- replace the single "staff full access" policy with one per action, so deleting needs an admin
    execute format('create policy "admins delete" on public.%I for delete to authenticated using (public.is_admin())', t);
675:    execute format('create policy "church admins delete" on public.%I for delete to authenticated using (church_id = public.staff_church() and public.is_admin())', t);
================================================================================

================================================================================
EVIDENCE ID:   EV-CP01-02c (How the schema and the app define a team leader)
COMMAND:       sed -n 1620,1638p supabase/schema.sql; grep -n "export const mayPlace" -A6 src/volunteer.js;
               grep -n "create table if not exists public.memberships" -A4 supabase/schema.sql
EXIT CODE:     0
RAW OUTPUT (decisive lines):
    select v.booth, v.lead from public.memberships m
    join public.churches c on c.id = m.church_id and c.status = 'active'
    join public.volunteers v on v.church_id = m.church_id and v.id = m.volunteer_id
    where m.user_id = (select auth.uid()) and m.status = 'approved'
337:export const mayPlace=()=>{
338- if(isAdminAcct())return true;
339- const m=cloud.acct&&cloud.acct.membership,vid=m&&m.volunteer_id;
340- const v=vid&&volunteers.find(x=>x.id===vid);
341- return !!(v&&v.lead);
439:  user_id          uuid primary key references auth.users (id) on delete cascade,   -- one church per person
================================================================================

================================================================================
EVIDENCE ID:   EV-CP01-03 (Typecheck baseline) — PROVISIONAL
TIMESTAMP:     2026-10-30 19:15
COMMAND:       npm run typecheck
EXIT CODE:     0
RAW OUTPUT:
> typecheck
> tsc --noEmit -p jsconfig.json
NOTE: taken while another agent had uncommitted edits; re-run before CP-03.
================================================================================

================================================================================
EVIDENCE ID:   EV-CP01-04 (Test suite baseline) — INVALID, RE-RUN REQUIRED
TIMESTAMP:     2026-10-30 19:15 → stopped 19:3x
COMMAND:       NEWSTART_PGLITE=C:/Users/fanel/pglite-test npm test
EXIT CODE:     n/a (process stopped by me after >9 min; normal run ≈2 min)
RAW OUTPUT (last lines before stop):
  PASS  Care with 600 urgent + 1000 call-backs draws a capped set (60 cards, 2 ms)
  PASS  Care counts still show the true totals
  PASS  "Show more" adds 100 cards per tap, not everything
  PASS  repeated "Show more" reaches all 600 urgent
NOTE: the run overlapped the other agent's .smoke/tmp-bench.js and its edits to .smoke/harness.js; not a baseline.
================================================================================

================================================================================
EVIDENCE ID:   EV-CP01-05 (Concurrent edits — blocker)
COMMAND:       git status --short
RAW OUTPUT:
 M .smoke/harness.js
 M context.md
 M dist/_headers
 M dist/index.html
 M dist/sw.js
 M dist/version.json
 M index.html
 M src/account.js
 M src/cloud.js
 M src/main.js
 M src/state.js
?? .smoke/tmp-bench-run.js
?? .smoke/tmp-bench.js
?? .tmp-baseline/
?? .zcode/
?? FIX-PLAN-sync-ui.md
?? plans/
================================================================================
```

### A.1 · Locked Pre-Generated Code & Directed Test Register (CP-02 Phase B)

````
================================================================================
CHANGE ID: CHG-01 · FILE: src/queue.js · SATISFIES: REQ-05, INV-03
EVIDENCE HOOKS: EV-CP03-CHG01-RED/DIFF/COMPILE/GREEN · OPERATOR LOCK: [ ]
================================================================================
BEFORE (anchor, verbatim):
```js
export function qSelect(k){state.qStation=k;qs.confirm='';renderMain();}
```
AFTER (inserted directly above the anchor; anchor unchanged):
```js
/* a visitor removed from the list leaves every line they are still in: queue_entries has no link to the visitor row */
export async function queueLeaveFor(attendeeId){
 const open=queue.filter(e=>e.attendeeId===attendeeId);
 for(const entry of open){
  const isOpen=entry.status==='waiting'||entry.status==='serving';
  if(!isOpen)continue;
  await qMove(entry.id,'left',['waiting','serving'],null);   /* null: no toast per line; the caller says what happened */
 }
}
export function qSelect(k){state.qStation=k;qs.confirm='';renderMain();}
```
````

````
================================================================================
CHANGE ID: CHG-02 · FILE: src/account.js · SATISFIES: REQ-02, REQ-03, REQ-04, REQ-06, INV-01
================================================================================
BEFORE (import, verbatim line 11):
```js
import { qSafe, queueReset, queueSync } from './queue.js';
```
AFTER:
```js
import { qSafe, queueLeaveFor, queueReset, queueSync } from './queue.js';
```
BEFORE (import, verbatim line 14):
```js
import { MY_PLEDGE_ACTS, emptyDraft, hideModal, isAdminAcct, pledgeFormParts, setVolTab, showModal } from './volunteer.js';
```
AFTER:
```js
import { MY_PLEDGE_ACTS, emptyDraft, hideModal, isAdminAcct, mayPlace, pledgeFormParts, setVolTab, showModal } from './volunteer.js';
```
BEFORE (anchor, verbatim):
```js
export function applyRetention(){
```
AFTER (inserted directly above the anchor):
```js
/* A visitor who wandered off: removed from the shared database first, then from this device. Church admins and team
   leaders may (remove_visitor checks the same in the database and answers false when it refuses). */
export async function removeVisitorAsk(id){
 const visitor=attendees.find(x=>x.id===id);
 if(!visitor)return;
 if(cloud.removing===id)return;                       /* a second tap while the first is still in flight */
 const isShared=!!cloud.user;
 if(isShared&&!mayPlace()){toast('Only your church’s admins and team leaders can remove a visitor');return;}
 cloud.removing=id;
 try{
  const yes=await confirmAsk({title:`Remove ${visitor.name||id}?`,
   body:isShared?'Their passport and readings are deleted for every desk in your church. This cannot be undone.'
    :'Their passport and readings are deleted from this device. This cannot be undone.',
   label:'Remove',danger:true});
  if(!yes)return;
  // 1. The shared copy, when there is one
  const isOnServer=isShared&&cloud.synced.att[id]!==undefined;
  if(isOnServer){
   let res;
   try{res=await cloud.client.rpc('remove_visitor',{p_id:id});}catch(e){res={error:e};}
   const {data,error}=res;
   if(error){toast(isNet(error.message)?'Removing a visitor needs a connection — try again when you are online.':(error.message||'That did not work.'));return;}
   const wasDeleted=data===true;
   if(!wasDeleted){toast('The database did not remove them: only your church’s admins and team leaders can');return;}
  }
  // 2. Their open places in the station lines
  await queueLeaveFor(id);
  // 3. This device
  const i=attendees.findIndex(x=>x.id===id);
  if(i>=0)attendees.splice(i,1);
  delete cloud.synced.att[id];
  if(state.activeId===id)state.activeId=attendees[0]?attendees[0].id:'';
  saveSyncedSoon();persist();render();
  toast(`${visitor.name||id} removed`);
 }finally{cloud.removing='';}
}
export function applyRetention(){
```
````

````
================================================================================
CHANGE ID: CHG-03 · FILE: src/visitor.js (journeyTop) · SATISFIES: REQ-01, REQ-04
================================================================================
BEFORE (verbatim):
```js
   <span class="jr-change">Change</span>
  </button>
  <ol class="jr-steps">
```
AFTER:
```js
   <span class="jr-change">Change</span>
  </button>
  ${a.id&&(!cloud.user||mayPlace())?`<div class="jr-tools"><button class="jr-remove" data-action="visitor-remove" data-args="${esc(a.id)}">Remove visitor</button></div>`:''}
  <ol class="jr-steps">
```
BEFORE (import, verbatim line 14):
```js
import { hiredCountLabel, pendingLabel, todayStr } from './volunteer.js';
```
AFTER:
```js
import { hiredCountLabel, mayPlace, pendingLabel, todayStr } from './volunteer.js';
```
````

````
================================================================================
CHANGE ID: CHG-04 · FILE: index.html · SATISFIES: REQ-01
================================================================================
BEFORE (anchor, verbatim):
```css
  .jr-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;list-style:none;margin:0;padding:0}
```
AFTER (two rules inserted directly above the anchor):
```css
  .jr-tools{display:flex;justify-content:flex-end;margin:-.35rem 0 .15rem}
  .jr-remove{min-height:36px;padding:0 .4rem;border:0;background:none;cursor:pointer;font:inherit;font-size:11px;font-weight:800;color:var(--hx-rose)}
  .jr-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;list-style:none;margin:0;padding:0}
```
````

````
================================================================================
CHANGE ID: CHG-05 · FILE: src/action-registry.js · SATISFIES: REQ-01
================================================================================
BEFORE (verbatim):
```js
  'acct-retry': el => acctRetry(el.dataset.args),
```
AFTER:
```js
  'acct-retry': el => acctRetry(el.dataset.args),
  'visitor-remove': el => removeVisitorAsk(el.dataset.args),
```
BEFORE (import, verbatim prefix of line 2):
```js
import { acctRetry, manageExpos,
```
AFTER:
```js
import { acctRetry, manageExpos, removeVisitorAsk,
```
````

````
================================================================================
CHANGE ID: CHG-06 · FILES: src/main.js, src/state.js · SATISFIES: REQ-02..06 (testability), INV-04 (typecheck)
================================================================================
main.js BEFORE: `export const __internals = { manageExpos,`
main.js AFTER:  `export const __internals = { removeVisitorAsk, queueLeaveFor, manageExpos,`
main.js imports: add `removeVisitorAsk` to the './account.js' import and `queueLeaveFor` to the './queue.js' import.
state.js BEFORE (cloud defaults, verbatim fragment): `expoSaving:false,`
state.js AFTER:  `expoSaving:false,removing:'',`
````

````
================================================================================
CHANGE ID: CHG-07 · FILE: .smoke/harness.js · SATISFIES: REQ-01..06
================================================================================
MOCK: no change to the mock query builder. The mock client already routes `rpc(name)` to `srv.rpcs[name]`
(`.smoke/harness.js` mock `async rpc(name, args)`); the test block installs `srv.rpcs.remove_visitor` itself, behaving
like CHG-08: false when refused or not found, true after deleting, a network error when `srv.offline`.

DIRECTED TEST MATRIX — inserted after the verbatim line
`  ok('rows are not lost when a full pull is split across pages', …` (signed-in section):
```js
  /* removing a visitor who wandered off (PLAN-remove-visitor TST-01) */
  {
    const C0 = g.cloud, keepAcct = C0.acct, keepRpcs = srv.rpcs;
    srv.rpcs = { ...(keepRpcs || {}), remove_visitor: a => {
      srv.calls.push('rpc:remove_visitor');
      if (srv.offline) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
      if (srv.noRemoveFn) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.remove_visitor' } };
      const had = srv.tables.attendees.get(a.p_id);
      if (srv.refuseDelete || !had) return { data: false, error: null };
      srv.tables.attendees.delete(a.p_id);
      srv.emit('attendees', { eventType: 'DELETE', old: had });
      return { data: true, error: null };
    } };
    C0.acct = { ...(keepAcct || {}), membership: { role: 'admin', status: 'approved', church_id: C0.churchId } };
    for (const [id, name] of [['EXPO-4100', 'Wandered Off'], ['EXPO-4101', 'Also Gone']])
      srv.tables.attendees.set(id, { ...lateRow, id, name, updated_at: new Date().toISOString() });
    await g.cloudSync(true);
    const before = g.attendees.length;
    srv.calls.length = 0;
    await g.removeVisitorAsk('EXPO-4100');
    ok('TST-01-V1 an admin removes a visitor: gone here and in the shared database, one request',
      g.attendees.length === before - 1 && !g.attendees.some(a => a.id === 'EXPO-4100') && !srv.tables.attendees.has('EXPO-4100')
      && srv.calls.filter(c => c === 'rpc:remove_visitor').length === 1 && g.cloudPending() === 0, srv.calls.join());
    await g.removeVisitorAsk('EXPO-9999');
    ok('TST-01-V2a an unknown badge changes nothing', g.attendees.length === before - 1);
    g.setAutoAnswer(false); await g.removeVisitorAsk('EXPO-4101'); g.setAutoAnswer(true);
    ok('TST-01-V2b Cancel keeps the visitor here and in the database', g.attendees.some(a => a.id === 'EXPO-4101') && srv.tables.attendees.has('EXPO-4101'));
    srv.offline = true; await g.removeVisitorAsk('EXPO-4101'); srv.offline = false;
    ok('TST-01-V2c offline, the visitor stays (nothing is lost)', g.attendees.some(a => a.id === 'EXPO-4101') && srv.tables.attendees.has('EXPO-4101'));
    srv.refuseDelete = true; await g.removeVisitorAsk('EXPO-4101'); srv.refuseDelete = false;
    ok('TST-01-V2d a removal the database refuses (false) keeps the visitor', g.attendees.some(a => a.id === 'EXPO-4101'));
    srv.noRemoveFn = true; await g.removeVisitorAsk('EXPO-4101'); srv.noRemoveFn = false;
    ok('TST-01-V2f before schema.sql is re-run (no function), the visitor is kept', g.attendees.some(a => a.id === 'EXPO-4101') && srv.tables.attendees.has('EXPO-4101'));
    C0.acct = { ...(keepAcct || {}), membership: { role: 'staff', status: 'approved', church_id: C0.churchId } };
    srv.calls.length = 0; await g.removeVisitorAsk('EXPO-4101');
    ok('TST-01-V2e staff who are not team leaders are refused, and nothing is sent', g.attendees.some(a => a.id === 'EXPO-4101') && !srv.calls.includes('rpc:remove_visitor'));
    /* a team leader: an ordinary member whose linked volunteer leads a station (mayPlace) */
    g.volunteers.push({ ...g.volunteers[0], id: 'VOL-9990', name: 'Station Lead', lead: true, booth: 'bp' });
    C0.acct = { ...(keepAcct || {}), membership: { role: 'member', status: 'approved', church_id: C0.churchId, volunteer_id: 'VOL-9990' } };
    srv.calls.length = 0;
    await Promise.all([g.removeVisitorAsk('EXPO-4101'), g.removeVisitorAsk('EXPO-4101')]);
    ok('TST-01-V7 a team leader removes a visitor', !g.attendees.some(a => a.id === 'EXPO-4101') && !srv.tables.attendees.has('EXPO-4101'));
    ok('TST-01-V3 a double tap sends one request', srv.calls.filter(c => c === 'rpc:remove_visitor').length === 1, srv.calls.join());
    g.volunteers.splice(g.volunteers.findIndex(v => v.id === 'VOL-9990'), 1);
    await g.cloudSync(true);
    ok('TST-01-V3b a full pull does not bring them back', !g.attendees.some(a => a.id === 'EXPO-4100' || a.id === 'EXPO-4101') && g.attendees.length === before - 1);
    C0.acct = keepAcct; srv.rpcs = keepRpcs;
  }
```
Inserted after the verbatim line `  g.setAutoAnswer(true);                     /* back to the headless default for the rest of the suite */`
(demo section, not signed in):
```js
  { /* PLAN-remove-visitor TST-01-V5 / V6 / V4: this device only, the queue, and the control */
    g.attendees.push({ ...g.attendees[0], id: 'EXPO-0990', name: 'Local Wanderer' });
    g.queue.push({ id: 'q-test-990', attendeeId: 'EXPO-0990', station: 'bp', status: 'waiting', joinedAt: Date.now(), calledAt: 0, finishedAt: 0 });
    await g.removeVisitorAsk('EXPO-0990');
    ok('TST-01-V5 not signed in, a visitor is removed from this device', !g.attendees.some(a => a.id === 'EXPO-0990'));
    ok('TST-01-V6 their place in a station line is marked left', g.queue.find(e => e.id === 'q-test-990').status === 'left');
    const vjs = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'visitor.js'), 'utf8');
    ok('TST-01-V4 the journey header has the Remove control, for admins and team leaders when signed in', /data-action="visitor-remove"/.test(vjs) && /!cloud\.user\|\|mayPlace\(\)/.test(vjs));
  }
```
VERIFICATION COMMAND: `NEWSTART_PGLITE=C:/Users/fanel/pglite-test npm test 2>&1 | grep -E "TST-01|FAIL|checks passed|FAILED"`
EXPECTED PASS ASSERTION: 13 lines `PASS  TST-01-…` + 5 lines `PASS  TST-02-…` (CHG-08), no `FAIL`, final
`all N checks passed` (N = baseline + 18).
RED expectation (before CHG-01..06): `g.removeVisitorAsk is not a function` → harness throws → this is a load error, not an
assertion; per template, apply CHG-06's two export lines first as stubs is NOT allowed, so RED is recorded as the TST-01
block failing with "g.removeVisitorAsk is not a function" and logged as an expected missing-symbol red (template §4 note).
````

````
================================================================================
CHANGE ID: CHG-08 · FILE: supabase/schema.sql · SATISFIES: REQ-07, INV-02 · APPLIED FIRST
EVIDENCE HOOKS: EV-CP03-CHG08-RED/DIFF/COMPILE/GREEN
================================================================================
BEFORE (anchor, verbatim — the HEALTH EXPOS section header added earlier this session; re-verify at CP-03):
```sql
-- which expo a volunteer pledged to (the member picks it when pledging); a volunteer with none counts towards the
```
AFTER (block inserted directly above the anchor):
```sql
-- Remove a visitor who wandered off (PLAN-remove-visitor). Church admins and team leaders of the caller's own active
-- church; a team leader is an approved member whose linked volunteer has lead = true (the test can_place uses).
-- The table's "admins delete" policies are unchanged: this function is the only way a team leader deletes, and only
-- a row of their own church. false = not allowed or not found; the app keeps the visitor and says so.
create or replace function public.remove_visitor(p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church uuid;
  v_allowed boolean;
begin
  select m.church_id, (m.role = 'admin' or coalesce(v.lead, false))
    into v_church, v_allowed
    from public.memberships m
    join public.churches c on c.id = m.church_id and c.status = 'active'
    left join public.volunteers v on v.church_id = m.church_id and v.id = m.volunteer_id
   where m.user_id = (select auth.uid()) and m.status = 'approved';
  if v_church is null or not v_allowed then
    return false;
  end if;
  delete from public.attendees a where a.id = p_id and a.church_id = v_church;
  return found;
end;
$$;
revoke all on function public.remove_visitor(text) from public, anon;
grant execute on function public.remove_visitor(text) to authenticated;
```
Facts relied on (re-verify at CP-01 re-run): memberships.user_id is the primary key — one church per person
(`schema.sql:439`); volunteers.lead exists (`:163`); the attendees audit trigger fires on delete (`:385`), so every
removal is in the platform admin's Recent changes.

DIRECTED TEST MATRIX (PGlite, inserted before the verbatim line
`    /* what a person asks to be when they join (their position), kept for the admin who approves */`):
```js
    /* PLAN-remove-visitor TST-02: remove_visitor — admins and team leaders of their own church only */
    const L1 = 'e5000000-0000-4000-8000-000000000005', S1 = 'e6000000-0000-4000-8000-000000000006';
    for (const [uid, em, role] of [[L1, 'l1@example.org', 'member'], [S1, 's1@example.org', 'staff']]) {
      await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [uid, em]);
      await sys(`insert into public.memberships (user_id, church_id, role, status, full_name, phone) values ($1, $2, $3, 'approved', 'Temp Person', '082 000 0000')`, [uid, A, role]);
    }
    await sys(`insert into public.volunteers (church_id, id, name) values ($1, 'VOL-9901', 'Lead Person')`, [A]);
    await sys(`update public.volunteers set status = 'registered', booth = 'bp', lead = true where church_id = $1 and id = 'VOL-9901'`, [A]);
    await sys(`update public.memberships set volunteer_id = 'VOL-9901' where user_id = $1`, [L1]);
    await sys(`insert into public.attendees (church_id, id, name) values ($1, 'EXPO-9701', 'Gone A'), ($1, 'EXPO-9702', 'Gone B'), ($1, 'EXPO-9703', 'Gone C')`, [A]);
    const rv = async (uid, id) => { const r = await as(uid, `select public.remove_visitor($1) ok`, [id]); return r.error ? 'error:' + r.error.message : r.rows[0].ok; };
    const gone = async id => (await sys(`select count(*)::int n from public.attendees where id = $1 and church_id = $2`, [id, A]))[0].n === 0;
    ok('TST-02-V1 a church admin removes a visitor of their church', (await rv(U.alice, 'EXPO-9701')) === true && await gone('EXPO-9701'));
    ok('TST-02-V1b a team leader (member + lead volunteer) removes one too', (await rv(L1, 'EXPO-9702')) === true && await gone('EXPO-9702'));
    ok('TST-02-V2 staff without a lead, and plain members, get false and nothing is deleted',
      (await rv(S1, 'EXPO-9703')) === false && (await rv(M1 || S1, 'EXPO-9703')) === false && !(await gone('EXPO-9703')));
    ok('TST-02-V2b another church\'s admin cannot remove it (false, row kept)', (await rv(X4 || S1, 'EXPO-9703')) === false && !(await gone('EXPO-9703')));
    const direct = await as(S1, `delete from public.attendees where id = 'EXPO-9703' returning id`);
    ok('TST-02-V3 an unknown badge returns false; a direct delete by staff still removes nothing (policy unchanged)',
      (await rv(U.alice, 'EXPO-9999')) === false && (!!direct.error || direct.rows.length === 0) && !(await gone('EXPO-9703')));
    await sys(`delete from public.attendees where id = 'EXPO-9703' and church_id = $1`, [A]);
    await sys(`update public.memberships set volunteer_id = null where user_id = $1`, [L1]);
    await sys(`delete from public.volunteers where id = 'VOL-9901' and church_id = $1`, [A]);
    await sys(`delete from public.memberships where user_id in ($1, $2)`, [L1, S1]);
    await sys(`delete from auth.users where id in ($1, $2)`, [L1, S1]);
```
NOTE for CP-03: `M1` / `X4` are the expo-test people; they are deleted at the end of that block, so at CP-03 step 1
the TST-02 block either moves inside the expo block before its clean-up or creates its own member / other-church admin.
The executor resolves this as an EV-DELTA if the expo block's clean-up order differs on disk.
VERIFICATION COMMAND: `NEWSTART_PGLITE=C:/Users/fanel/pglite-test npm test 2>&1 | grep -E "TST-02|FAIL"`
````

### A.4 · 7-Dimension audit (EV-CP02-AUDIT, pre-apply)
```
FILES: src/account.js, src/queue.js, src/visitor.js, index.html, src/action-registry.js, src/main.js, src/state.js, .smoke/harness.js
D1 Readability: PASS — named predicates isShared, isOnServer, wasDeleted, isOpen; semantic names (visitor, entry, del).
D2 Errors & boundary: PASS — DB error → toast (net vs other); refused delete detected by row count; finally clears the slot.
D3 Security: PASS — the database decides (remove_visitor: approved admin or lead of an ACTIVE church, own church only,
   SECURITY DEFINER with search_path ''; execute revoked from anon); existing delete policies untouched; UI hides the
   control from everyone else (mayPlace); every delete is audited by the existing attendees_audit trigger; no PII logged.
D4 Performance: PASS — one find, one DELETE, queue scan O(entries); no loop invariants recomputed.
D5 Cohesion: PASS — removal logic in account.js beside the sync ledger it edits; queue logic stays in queue.js.
D6 Anti-bloat: PASS — ≈ +45 lines app code (+2 CSS) and +25 lines SQL; reuses confirmAsk, qMove, mayPlace, the
   can_place definition of a leader, saveSyncedSoon; one function instead of a second delete policy; no new deps.
D7 Sieve: 7.1 house style kept · 7.2 max depth 2 (try → if) · 7.3 numbered stages 1–3 · 7.4 each guard on its own
   statement · 7.5 compound checks named · 7.6 no XOR gate needed (N/A).
GRADE: A (pre-apply)
```

### A.2 / A.3 / A.5 / A.6
Empty — filled during CP-03…CP-06 (append-only).

---

## PLAN COMPLETION & EVIDENCE SIGN-OFF
| Checkpoint | Status |
| :--- | :--- |
| CP-01 Forensics & Baseline | PARTIAL — BASE-03/04 re-run after the other agent commits |
| CP-02 Locked Code, Tests & 7D Gate | DONE — awaiting operator sign-off |
| CP-03 … CP-06 | PENDING |
