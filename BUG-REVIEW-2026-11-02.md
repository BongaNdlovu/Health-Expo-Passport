# BUG REVIEW & ROOT-CAUSE FORENSICS — 2026-11-02
Template: `senior_it_consultant_bug_review_forensics_plan.md` v1.0. Scope chosen with the operator: the **top 3 confirmed
defects** found by a repo-wide hunt, stop for sign-off at CP-04.

| Field | Value |
| ----- | ----- |
| Incident / Ticket ID | `REVIEW-2026-11-02` (no ticket; found by audit) |
| Severity | BUG-A SEV-1 · BUG-B SEV-1 · BUG-C SEV-2 |
| Lead | Claude Opus 5.5 (orchestrator) + 8 Claude Haiku 5.5 sub-agents (max effort) |
| Repository & Branch | `Health Expo` @ `main` |
| Faulty Commit SHA | HEAD `7557faa` (per-bug origin commits in §6 A.0) |
| Environment | Web app + Capacitor Android app (same `src/` bundle) |
| Date Initiated | 2026-11-02 |

**How the hunt ran.** Five read-only Haiku agents each read a slice of `src/` (account; cloud/core; queue/results;
visitor/volunteer/data; plans/shell/UI) and reported 25 ranked candidates (5 each) with verbatim code. The orchestrator re-read
the code for every candidate kept below; a sixth agent wrote the RED tests, a seventh ran the variant hunt. Agent
reports are leads, not evidence: every claim in this file is backed by a command run in this session.

---

## § 1 · TRIAGE

### 1.0 A blocker found first: the smoke suite has not run since today's port (`TEST-0`)
`npm test` crashes on line 171 before its first check (EV-BUG-02). Commit `3d9c872` (2026-11-02 16:15) made
`__NEWSTART.__internals` return the full app only when `window.NSMem.devBuild` is true and nobody is signed in;
`.smoke/harness.js` never loads `nsmem.js`, and its cloud section signs in (which closes the export again on every
access). So **all 849 smoke checks (834 + 15, counted below) have been silently off since `3d9c872`** — this is why none of the bugs below was
caught, and it has to be repaired before any RED → GREEN proof can live in the repo.
Scratch repair used for this review (repo untouched): load `nsmem.js` into the sandbox with
`var NS_DEV_BUILD = true;` (exactly what `NS_DEV_BUILD=1 node tools/build.js` does), and snapshot the internals'
property descriptors once while open. Result: **834 PASS / 15 FAIL**, then `CLOUD TESTS THREW: TypeError: Cannot read
properties of undefined (reading 'size')` late in the cloud section (pre-existing, out of scope, listed in §7).

### 1.1 Defect summaries & blast radius

**BUG-A · A record the database refuses is deleted from the device at the next full sync** (SEV-1, B2 → B5)
```
SYMPTOM:  a visitor/volunteer row the server refused (one toast: "<id> was not uploaded: …") disappears from the
          device and from its saved copy at the next full pass. Nothing says it was removed.
IMPACT:   any desk whose row fails a database check. Realistic triggers (verified paths):
          - a TEAM LEADER registers a new volunteer: saveVolunteer gives booth=pref[0] (volunteer.js:827-828), the
            place guard refuses a booth outside the leader's own station (schema.sql can_place) → refused → deleted;
          - the desk's 10,000th visitor gets EXPO-10000, refused by `check (id ~ '^EXPO-[0-9]{3,4}$')`;
          - a name over 200 characters (no client cap; schema `length(name) <= 200`).
DATA:     YES — permanent loss of data that never reached the server (local-only, unrecoverable).
SECURITY: no.
```

**BUG-B · Every "Sign out" button skips the "unsaved changes will be lost" warning** (SEV-1, B2)
```
SYMPTOM:  tapping Sign out with changes not yet uploaded signs out at once; seedDemo() replaces the on-device lists,
          so the unsent visitors are gone. help.js:99 / :298 promise "you are warned first".
IMPACT:   every signed-in desk; 11 Sign out buttons (index.html:1887; account.js:140,147,161,777,800;
          cloud.js:392,398,412,554; visitor.js:277). Highest risk exactly when signal is bad (offline work piles up).
DATA:     YES — permanent loss of unsent rows.
SECURITY: no.
```

**BUG-C · Saving a placed volunteer's form moves them back to their first preference** (SEV-2, B2)
```
SYMPTOM:  an admin places volunteer V at station Y (placement sheet / place_volunteer). Any later "Save changes" on
          V's form rewrites V.booth = V.pref[0]. For an admin the write passes the place guard and every desk shows
          the old station after sync; for a team leader the guard refuses it and local and server disagree.
DATA:     YES — the placement is overwritten in the shared database (recoverable by re-placing).
SECURITY: no.
```

### 1.2 Scope (files allowed to change, pending sign-off)
```
IN SCOPE:   src/account.js        (BUG-A: pruneRemote, + the identical latent loop in mergeRemote)
            src/action-registry.js (BUG-B)
            src/volunteer.js       (BUG-C)
            .smoke/harness.js      (TEST-0 repair + TST-BUG regression tests)
            dist/ (rebuilt by `npm run build` only, never by hand)
OUT:        everything else, incl. supabase/schema.sql, sw.js, capacitor/.
```

### 1.3 Invariants to preserve
- INV-01: refused rows are not retried in a loop (harness: "…without looping on it" stays PASS).
- INV-02: a row deleted on another desk is still removed locally; demo/seed leftovers are still cleared.
- INV-03: `cloudSignOut(true)` (account.js:831, delete-my-account path) still signs out without asking.
- INV-04: a NEW registration by an admin/demo desk still places the volunteer at their first preference.

### 1.4 Traceability matrix
| Stage | Target | Evidence | Status |
| --- | --- | --- | --- |
| TRIAGE-01 | blame / history of the faulty lines | EV-BUG-01 | VERIFIED |
| TRIAGE-02 | pre-fix baseline (all suites) | EV-BUG-02 | VERIFIED (suite broken, see 1.0) |
| REPRO-01 | deterministic RED tests A, B, C | EV-BUG-REPRO-RED | VERIFIED |
| RCA-01 | state trace proving the broken invariant | EV-BUG-RCA | VERIFIED |
| VAR-01 | repo-wide sibling scan | EV-BUG-VARIANTS | VERIFIED |
| FIX-01 | locked fix + 7D audit | EV-BUG-PREAUDIT | **AWAITING OPERATOR SIGN-OFF** |
| EXEC-01 / REG-01 / POST-01 | GREEN, full suite, report | — | PENDING |

---

## § 2 · CHECKPOINTS

### CP-01 · Triage & baseline — DONE (EV-BUG-01, EV-BUG-02)
### CP-02 · Deterministic reproduction — DONE (EV-BUG-REPRO-RED)
### CP-03 · 5-Whys, taxonomy, variants — DONE

**BUG-A**
```
SYMPTOM:   refused row EXPO-1 is gone after cloudSync(true) (TST-BUG-A1/A2 FAIL).
WHY 1:     pruneRemote splices every local row that is not on the server and not in `pending` (account.js:1628).
WHY 2:     `pending` = cloudDirtyList(kind); a refused row is not dirty: isDirty returns false when
           cloud.rejected[id] === its signature (cloud.js:110) — that is how the push avoids retrying it forever.
WHY 3:     so "not pending" is read as "the server had it and another desk deleted it", but a refused row was never
           on the server: it has no ledger entry (cloud.synced[kind][id] === undefined).
WHY 4:     the "refused" state was added to isDirty for the push loop; the prune loop (copied on 2026-11-01 from
           mergeRemote's, which predates the module split) reuses isDirty with a different meaning.
WHY 5:     the only refusal test (harness.js:1766-1776) stops before any full pass; and the suite has not run at
           all since 3d9c872 (§1.0).
ROOT CAUSE: the prune treats "not pending" as "known to the server", although a refused row is neither pending nor
           ever uploaded.
TAXONOMY:  B2 (wrong predicate) → B5 (silent loss).
```

**BUG-B**
```
SYMPTOM:   Sign out button signs out with no warning (TST-BUG-B1/B2 FAIL; direct call B0 PASS).
WHY 1:     cloudSignOut(force) skips the confirm when `force` is truthy (account.js:1418-1420).
WHY 2:     dispatch calls every registered action as fn(element, event) (actions.js:28); the element is truthy.
WHY 3:     cloudSignOut is registered in the "plain functions (no arguments)" list (action-registry.js:37), whose
           contract (comment at :28) is "called with (element, event) and ignore both" — this one does not ignore.
WHY 4:     before the module split (3310c4a, 2026-10-27) all 7 buttons were onclick="cloudSignOut()" (no argument);
           the split moved them to data-action without an adapter.
WHY 5:     every harness sign-out calls g.cloudSignOut() directly (harness.js:1865, 2328, 3080, 4039); nothing
           dispatches the button.
ROOT CAUSE: a function with a meaningful parameter was registered as an argument-ignoring action.
TAXONOMY:  B2 (truthy value into a boolean gate).
```

**BUG-C**
```
SYMPTOM:   after an admin placement, "Save changes" puts V back at pref[0].
WHY 1:     the edit branch runs `v.booth=d.pref[0]` whenever the volunteer has a preference (volunteer.js:835).
WHY 2:     the form draft carries preferences (d.pref, prefilled from v.pref at :757), never the placement.
WHY 3:     placement became a separate admin action in a30bd21 (place_volunteer), but the form's one-tap
           "registration = placement" rule was kept for edits too.
WHY 4:     the database allows the admin's write (place guard passes admins), so nothing refuses it.
WHY 5:     harness saveVolunteer tests (≈ lines 336, 430, 573-580) cover new volunteers and validation only.
ROOT CAUSE: an edit re-derives an admin-owned field (booth) from a user-owned one (pref).
TAXONOMY:  B2.
```

**Variant hunt (EV-BUG-VARIANTS, summary)** — full raw output kept in the session transcript (102.8 KB).
| Pattern | Site | Class | Proposed |
| --- | --- | --- | --- |
| 1 plain action with a real parameter | AST scan of every shorthand ACTION_MAP entry vs. its declared parameters | only `cloudSignOut` VULNERABLE; all others ignore their args (e.g. `exportCSV(mode)`: element !== 'minimal' → full export, the intended default) | fix in BUG-B |
| 2 "not pending" = "on server" | account.js:1628 pruneRemote | VULNERABLE (live) | fix in BUG-A |
| 2 | account.js:1611 mergeRemote deletion loop | VULNERABLE (latent: both callers pass `full=false` today) | same 2-line guard, recommended |
| 2 | account.js:1419 sign-out warning count `cloudPending()` skips refused rows | VULNERABLE (refused rows wiped with "Sign out?" wording) | recommended with BUG-B (needs approval: scope +0 files) |
| 2 | account.js:1473 / :112 dropChurchData on lost access / church switch | VULNERABLE, but the code comment calls the wipe intended | **owner decision**, not in this fix |
| 2 | main.js:41 + state.js:108 local copy with 0 visitors reseeds volunteers | VULNERABLE (reasoned, not run) | queued |
| 3 placement from preference | volunteer.js:835 | VULNERABLE | fix in BUG-C |
| 3 | volunteer.js:827-828 new volunteer by a team leader → booth=pref[0] → refused | VULNERABLE; it is the everyday trigger of BUG-A | BUG-A fix stops the loss; the refusal itself is queued |
| 3 | cloud.js:54-58 volToRow / :41 attToRow whole-row upsert | design-level (last-writer-wins) | queued, design |

---

### CP-04 · Locked fixes & regression matrix — **STOPPED FOR OPERATOR SIGN-OFF**

**FIX-0 · .smoke/harness.js (test infrastructure)**
Before `vm.runInContext(code, …)`: run `nsmem.js` in the sandbox with `var NS_DEV_BUILD = true;` (the same switch
tools/build.js uses for test builds). Replace `const g = sandbox.__NEWSTART.__internals` with a one-time snapshot of
its property descriptors (getters stay live), so signing in inside the suite does not close it. +~6 / −1 lines.

**FIX-A · src/account.js pruneRemote (and the latent twin in mergeRemote)**
```js
// BEFORE (account.js:1626-1629, same shape at 1609-1612)
  if(remote.has(o.id))continue;
  if(!pending.has(o.id)){k.list.splice(i,1);delete sy[o.id];changed=1;}   /* demo leftovers, or deleted on another desk */
  else delete sy[o.id];                                                    /* edited here but gone there: upload it again */
// AFTER
  if(remote.has(o.id))continue;
  const isNeverUploaded=sy[o.id]===undefined&&!isSeedRow(kind,o);   /* refused on its first upload: never on the server, so not "deleted there" */
  if(isNeverUploaded)continue;
  if(!pending.has(o.id)){k.list.splice(i,1);delete sy[o.id];changed=1;}   /* demo leftovers, or deleted on another desk */
  else delete sy[o.id];                                                    /* edited here but gone there: upload it again */
```
+2 lines per loop. Keeps INV-01 (isDirty unchanged, so no retry loop) and INV-02 (a deleted-elsewhere row had a
ledger entry; seed leftovers are seed rows).

**FIX-B · src/action-registry.js**
```js
// BEFORE (:37, plain list)   closeVolModal, closeVolReg, closeWhatsApp, cloudInit, cloudResend, cloudSignOut, copyInvite,
// AFTER                      closeVolModal, closeVolReg, closeWhatsApp, cloudInit, cloudResend, copyInvite,
//   + in the adapter section: cloudSignOut: () => cloudSignOut(),   /* never pass the button as `force` */
```
+1 / −0 net (one name moved). INV-03 untouched (account.js:831 still passes `true`).
*Optional FIX-B2 (variant):* the warning's count also counts refused rows still on the device, so they are not wiped
under the plain "Sign out?" wording. +1 line in account.js:1419.

**FIX-C · src/volunteer.js:835**
```js
// BEFORE   if(registered){v.status=…;v.booth=d.pref[0];v.registeredOn=v.registeredOn||today;}
// AFTER    if(registered){v.status=…;v.booth=v.booth||d.pref[0];v.registeredOn=v.registeredOn||today;}
```
0 net lines: an unplaced volunteer is still placed at pref[0] on registration (INV-04); a placed one keeps the
station the admin chose.

**3-vector regression matrix (to be added to .smoke/harness.js)**
| Vector | BUG-A | BUG-B | BUG-C |
| --- | --- | --- | --- |
| V1 exact repro | TST-BUG-A1/A2: refused row survives a full sync, on device and in the saved copy | TST-BUG-B1/B2: button + answer No keeps the user and the unsaved visitor | TST-BUG-C1: edit keeps an admin's booth |
| V2 boundaries | a row deleted on another desk (ledger entry, not on server) is still removed; a seed leftover is still removed | answer Yes signs out; no pending rows → plain "Sign out?" still asked | volunteer with booth null + pref → placed at pref[0]; prefs cleared → status prospect, booth kept |
| V3 invariants | "without looping on it" stays PASS; pending edit of a remotely deleted row is re-uploaded | B0: direct `cloudSignOut()` asks; `cloudSignOut(true)` does not | TST-BUG-C2: new registration takes pref[0] |

**7-dimension pre-audit (EV-BUG-PREAUDIT)** — graded on the locked AFTER blocks above.
- D1 root cause, not symptom: PASS — each fix sits at the predicate/registration that broke the invariant (§CP-03).
- D2 variants: PASS — EV-BUG-VARIANTS; two variants folded in (mergeRemote twin, B2 optional), the rest queued.
- D3 boundary/security: PASS — no new input paths; no data logged.
- D4 state cleanup: PASS — no new timers/locks; FIX-A keeps the row and its rejected mark, so the next edit retries.
- D5 regression lock: PASS — RED shown for A, B and C, with a passing control for B and C (EV-BUG-REPRO-RED).
- D6 footprint: PASS — app code ≈ +5 / −1 lines across 3 files (exact numbers in EV-BUG-DIFF after applying).
- D7 sieve: 7.2 flat guard (`if(isNeverUploaded)continue;` on its own line), 7.5 named predicate, 7.4 one action per
  line; 7.1 lint/typecheck to be run in CP-05.
- **Grade: A (provisional, pending the operator's sign-off and CP-05's compile/suite run).**

```
Operator Sign-Off on Surgical Fix: [ GIVEN — the operator pasted the execution plan built on these locked
                                     fixes and instructed "execute" (2026-11-02 23:47), then "please
                                     continue and finish" (2026-11-03); waves 0-4 ran 2026-11-03 ]
Scope Expansion for Variants Approved?: [ YES — mergeRemote twin (A2) and FIX-B2 (B3) both applied in
                                          Wave 1, commit 503b2e7 ]
```

### CP-05 · Apply & verify — DONE (2026-11-03, branch `fix/2026-11-02-review`, never pushed)

**Surgical fixes (BUG-A/B/C)** applied exactly as locked in CP-04 — plus both approved variants
(mergeRemote deletion-loop twin; FIX-B2 refused-rows-in-warning). The three-vector regression matrix
lives in `.smoke/harness.js` as `TST-BUG-A1/A2/A3`, `B0/B1/B2/B3`, `C1/C2/C3`
(RED outputs in §6 A.1; each was seen failing at HEAD `7557faa` before its fix landed).

**The review's full finding list** was planned (FIX-PLAN-2026-11-02, waves 0-4) and executed in six
commit-waves, every fix RED-first then GREEN:

| Commit | Wave | Scope |
|---|---|---|
| `8f2ac4a` | 0 | Smoke suite repaired (T0-1…T0-7): nsmem boot, internals snapshot, v1.6.2 check updates, the TST-BUG RED blocks added, `NEWSTART_PGLITE` documented |
| `503b2e7` | 1 | Silent data loss: A1-A3 prune/merge guards, B1 button adapter, B2 warning counts refused rows, C1/C2 booth ownership, D1/D2/D3 |
| `d716f39` | 2a | Privacy: E6 care lists follow opt-in + grace period, E7 prayer CSV + stale visits, E8 guardian out of the minimal CSV |
| `8e3a6c5` | 2b | Races/duplicates: E1 session-generation guard, E2 stale personal answers, E3 queued full pull, E4 duplicate-id signature, E5 hung-body deadline; E9/E10 double-tap locks, E11 failed-load retry |
| `5da6dac` | 3 | UI & async states: U1-U8, Q5/Q6, A13-A20a, R4, V8b (offline, timeouts, 429 cooldown, session-ended, aria, disabled styles, update hand-off, sw version.json) |
| `d8b887c` | 4 | Correctness: Q1-Q4, V4-V6, V8a-V9, A12, A20b, A21, P1-P5 (queue counts/flush/toasts, volHours rounding, no health age under 18 + keep-previous-reading (both owner decisions), byte password limit, overlay Escape, imported-plan label) |

**Final verification (2026-11-03):**
```
npm test                    1652/1652 PASS (with NEWSTART_PGLITE=C:\Users\fanel\pglite-test:
                            1431 fake-server checks + the 18c churches battery + DB-attack batteries)
npm run test:db              51/51   · npm run test:hub 35/35   (same env; no dependency added)
npm run typecheck            0 errors
npm run build + test:build   build 0 · 20/20
npm test (no pglite)         1431/1431   · ui-budget within verification/budget.json (re-baselined
                             once, Wave 3, sanctioned inline-JS growth; allowlist untouched)
Browser preview (dist @ :4180, real CDP offline): boot ✓, offline state ✓, demo queue ✓,
  .btn:disabled/[aria-busy] styling served and visible in light and dark ✓. Sign-in-gated flows
  (sign-out warning, placed-volunteer edit, gate Try-again) are locked by the suite checks
  (TST-BUG-B1/B2, TST-BUG-C1, TST-U1) and need a real account for screenshots.
Footprint 7557faa..HEAD: 31 files, +1638/−360 (app code + smoke tests + budgets).
```

**Not done, on purpose:** V7 clinical wording (BP 120-129/80-84 label, BMI 25.0 rounding edge, sleep
step) — **left flagged OWNER: the question was asked 2026-11-03 and skipped, so the current wording
stands**; Q3c (queueNextInLine vs qFree) — owner chose to record it as a design follow-up; the
expo-form draft-discard prompt — recorded as a follow-up (needs the async confirmAsk pattern);
401/JWT refresh branch and last-writer-wins upserts — design follow-ups from the original plan.

### CP-06 · Post-mortem — DONE

Why 2 of the 3 top bugs could eat visitor data silently, and what keeps it from happening again:

1. **The suite had been dead for a day.** TEST-0 (`g.setAutoAnswer is not a function` at boot) meant
   the last green run predated every risky change of 2026-11-02. Wave 0 restored the harness first —
   the root cause (internals gated on `NSMem.devBuild`, never booted by the harness) is now covered
   by the boot path itself.
2. **isDirty had two meanings.** The push loop reads it as "needs upload"; the prune loop (copied
   from mergeRemote's, pre-split) read `!isDirty` as "the server has it". A refused row is neither
   dirty nor on the server, so "not pending" deleted it. The fix pairs the guard with a comment, and
   both loops now keep never-uploaded rows.
3. **The module split introduced signature bugs.** BUG-B (an argument-ignoring action list receiving
   `cloudSignOut(force)` via the dispatch contract) and BUG-C (an edit branch re-deriving an
   admin-owned booth from a user preference) both date to `3310c4a`. The harness now dispatches the
   real buttons rather than calling functions directly.
4. **Async code had no session identity.** Every await in cloudSync could land after a sign-out or
   account switch. The Wave 2 `cloud.gen` guard is now the house pattern: capture the generation
   before the first await, check after each.
5. **UX states lagged features.** The eleven network flows of the UI audit had no loading/offline/
   rate-limited/refused states. Wave 3 added them per flow and the harness locks each.

Process deltas that made the difference, kept as standards: every fix RED-first (a check that has
never failed is not a regression lock); one wave, one commit, gates before each commit; test
fixtures carry the state the real flow would leave (`cloud.churchId`, `signInWaitUntil` resets);
race tests drive the fake server through held promises (`srv.holdRpc`) instead of sleeps.

---

## § 6 · EVIDENCE VAULT

### A.0 — EV-BUG-01 (blame)  · 2026-11-02 · HEAD 7557faa · EXIT 0
```
$ git blame -L <line>,<line> --date=short <file>
src/account.js:1628   3c5c475d 2026-11-01  if(!pending.has(o.id)){k.list.splice(i,1);delete sy[o.id];changed=1;}
src/cloud.js:110      3310c4af 2026-10-27  if(cloud.rejected[o.id]===s)return false;
src/action-registry.js:37  3310c4af 2026-10-27  closeVolModal, closeVolReg, closeWhatsApp, cloudInit, cloudResend, cloudSignOut, copyInvite,
src/account.js:1418   3310c4af 2026-10-27  export async function cloudSignOut(force){
src/volunteer.js:835  a30bd212 2026-10-27  if(registered){…v.booth=d.pref[0];…}
3c5c475 2026-11-01 Harden sync scale, notifications, custom plans, and visitor removal.
3310c4a 2026-10-27 Split the page into modules and bundle it back into one file.
a30bd21 2026-10-27 Admins place, move, swap and release through database functions; …

$ git show 3310c4a^:index.html | grep -o 'onclick="cloudSignOut([^"]*)"' | sort | uniq -c
      7 onclick="cloudSignOut()"
```

### A.0 — EV-BUG-02 (baseline) · 2026-11-02 22:27:06 · HEAD 7557faa
```
=== npm test                      EXIT 1
.smoke\harness.js:171   g.setAutoAnswer(true);   TypeError: g.setAutoAnswer is not a function
=== npm run typecheck             EXIT 0
=== npm run test:build            EXIT 1   "2 of 20 build checks FAILED"
  FAIL  the CSP script-src allows the Supabase library URL the app loads
  FAIL  the settings sheet
=== npm run test:hub              EXIT 0   SKIP: set NEWSTART_PGLITE … (not run: no @electric-sql/pglite)
=== npm run test:db               EXIT 2   needs @electric-sql/pglite (not run)
--- scratch harness with FIX-0 applied (repo untouched): 834 PASS / 15 FAIL, then CLOUD TESTS THREW (pre-existing)
```

### A.1 — EV-BUG-REPRO-RED · 2026-11-02 23:11:21 · HEAD 7557faa, repo clean (`git status --porcelain | wc -l` → 0)
```
$ node --expose-gc harness-repro.js     (scratch copy: harness + FIX-0 + TST-BUG blocks)   EXIT 1
541:  FAIL  TST-BUG-A1 a refused row is still on the device after the next full sync  → pending=0 rejected=EXPO-1
542:  FAIL  TST-BUG-A2 ...and still in the saved copy
545:  PASS  TST-BUG-B0 control: direct call asks first
546:  FAIL  TST-BUG-B1 the Sign out button asks first when changes are not uploaded (answer No keeps the user signed in)  → user=false
547:  FAIL  TST-BUG-B2 ...and the unsaved visitor stays
PASS 834 FAIL 20  — non-TST lines identical to baseline except one known timing check
  ("first full pull finished in a sensible time", limit 4000 ms) which also flips on the unmodified harness.

$ node --expose-gc harness-red-final.js   (adds the BUG-C block after harness line 346)   2026-11-02 23:21:59   EXIT 1
131:  FAIL  TST-BUG-C1 editing a placed volunteer keeps the booth an admin placed them at  → booth=bp pref0=bp
132:  PASS  TST-BUG-C2 control: a NEW registration still takes its first preference
543:  FAIL  TST-BUG-A1 a refused row is still on the device after the next full sync  → pending=0 rejected=EXPO-1
544:  FAIL  TST-BUG-A2 ...and still in the saved copy
547:  PASS  TST-BUG-B0 control: direct call asks first
548:  FAIL  TST-BUG-B1 the Sign out button asks first when changes are not uploaded (answer No keeps the user signed in)  → user=false
549:  FAIL  TST-BUG-B2 ...and the unsaved visitor stays
PASS 835 FAIL 21  — non-TST diff vs baseline: only the same 4000 ms timing check.
(EXIT 1 in both runs is the pre-existing late "CLOUD TESTS THREW"; all TST-BUG lines print before it.)
```

### A.1 — EV-BUG-RCA (state trace, temporary probes, removed afterwards)
```
DBG A pre:  onDevice=true rejected=EXPO-1 pending=0 dirtyAtt=[] serverHasEXPO1=false savedIds=EXPO-1,EXPO-340
DBG A post: onDevice=false rejected=EXPO-1 calls=[select:attendees:range0, select:volunteers:range0,
            select:attendees:id,updated_at:range0, select:volunteers:id,updated_at:range0] savedIds=EXPO-340
DBG direct call, warning live: title="Sign out with unsaved changes?" user=true pending=1
DBG button with warning live:  title="" user=false onDevice=false pending=0
DBG C pre:       cloudUser=false firstPref=bp booth=kids status=registered pref=["bp","vitals"]
DBG C form:      volId=VOL-1001 volNew=false vfPref=["bp","vitals"] volRegOpen=true
DBG C post-save: booth=bp toast="Saved ✓"   → the edit branch reset the admin's placement to pref[0]
```

---

## § 7 · Other confirmed or likely defects (not in the top 3 — queued)
Reported by the hunters; the orchestrator re-read the code only where marked ✔. Not reproduced.
- ✔ Care "48-hour follow-up calls" lists visitors who declined follow-up and prints their phone (results.js:509, 555) — consent question for the owner.
- Sign-out during an in-flight sync re-admits the old account's visitors (account.js cloudSync, no identity re-check) — SEV-2 race.
- Lost upload response → the same visitor inserted twice under a new number (resolveConflict compares a signature that includes server `created_at`) — SEV-2.
- Request deadline cleared at headers; a stalled body holds `cloud.busy` / queue lock (cloud.js:611-613) — SEV-2.
- A slow previous-account `my_health` / `my_pledge` response is shown to the next account (account.js:286-290, 372-377) — SEV-2 race.
- Minimal ("no names") CSV still contains the parent/guardian's name (results.js:591, 606) — SEV-3 privacy.
- sw.js answers every later version.json check with the first cached copy (ignoreSearch) — SEV-3.
- A queued sync is downgraded to push-only (`cloud.again`) — found independently by two agents — SEV-3.
- Health age floored at 18 for visitors aged 12-17 (helpers.js:118); badge hours compared as unrounded float sums (volunteer.js:31) — SEV-3.
- Rejected / half-typed reading erases the stored value (visitor.js:928, 939) — harness codifies it; owner decision.
- Pre-existing harness FAILs (15) and test:build FAILs (2): mostly checks not updated for v1.6.2 (vendored fonts,
  SecureExport), plus the late `CLOUD TESTS THREW`. Not triaged individually.
