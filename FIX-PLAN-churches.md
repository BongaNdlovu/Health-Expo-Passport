# Plan: church accounts, personal (member) accounts and the platform admin, with hard gates

**Status: see section 10.** Every number below was measured on the real files or a dry-run copy, and `gate pre`
re-checks it before anything changes. Tooling lives in `fix-plan-churches/` (the earlier plan's `fix-plan/` is untouched).

## 1. Goal
Add three account levels to the NEWSTART Passport, as agreed in the brief:
- **Church account:** a church registers in the app, waits for the platform admin, then sees only its own visitors,
  volunteers, queue and audit trail.
- **Personal (member) account:** a person joins one church, manages their own details there, and sees their own
  screening results once a church admin links their badge.
- **Platform admin:** only you; sees and manages every church.

Today `node .smoke/harness.js` reports 328 PASS and 5 FAIL. The section-19 crash is described below. Measured end state:
416 PASS and the same 5 FAIL. That is 88 new checks, all PASS: 37 for the app in section 18b and 51 for the database
in section 18c.

| # | Goal | Where it is today (anchors, measured) | Fix |
|---|---|---|---|
| F1 | Church accounts with separate data | One shared pool. `attendees.id` is the whole primary key (`supabase/schema.sql:112`). The queue's one-visit index is global (`schema.sql:229`). | `churches` table; `church_id` on every data row; primary key `(church_id, id)`; RLS per church; one-time move of existing data into a first church |
| F2 | Personal (member) accounts | Signed-in non-staff only see "Waiting for approval" (`index.html:4037`, `index.html:4392`) | `memberships` table and functions; gate screens: choose/register church, waiting, paused, **My account** (details + own results) |
| F3 | Platform admin only you can see | No such role | `platform_admins` (added only in the SQL editor); Admin tab: all churches, approve/pause, any church's members, audit trail |
| F4 | Sync stays correct with churches | Uploads match on badge alone (`index.html:4475`, `index.html:4485`) | Uploads carry `church_id` and match on `church_id,id`. A phone never uploads one church's data into another church. Databases without churches still work through the old `is_staff` path. |
| F5 | Tests and docs | — | Harness sections 18b and 18c; README setup step 5 and a "Churches" section |

Out of scope, unchanged before and after (causes not investigated):
- `change detection over 3900 rows is fast`
- `the next poll is down to one small request per table`
- `120 visitors registered offline are all pending`
- `the whole backlog uploads on reconnect`
- `500 live inserts from other desks are applied`

**Found, not fixed (out of scope):** harness section 19 stops partway with `CLOUD TESTS THREW`. The harness asks for
cache `newstart-libs-v1` (`.smoke/harness.js:1236`), but `sw.js:8` names it `newstart-libs-v2`, so the checks after that
point never run. The new checks are therefore placed **before** section 19.

## 2. Scope: the only files that may change
| Tier | Files | Changed only by |
|---|---|---|
| Edited | `supabase/schema.sql`, `index.html`, `.smoke/harness.js`, `supabase/README.md` | `node fix-plan-churches/apply.js .` |
| Generated | `dist/index.html`, `dist/sw.js` | `node tools/build.js` |
| Plan tooling (never edited during execution) | this file, `fix-plan-churches/*` | — |

The other 45 manifest files must stay byte-identical, and no file may be added or deleted. Invariants:
- The precompiled stylesheet `<style id="tw">` does not change; the new screens reuse existing classes.
- The HARDENING section of `schema.sql` does not change.
- The health plans (`PROTOCOLS`) do not change.

## 3. Hard rules (any violation = the whole plan FAILS)
1. **Fail closed.** One `[FAIL]`, a crash or a timeout in the gate fails the plan. Never edit the gate, its config or
   `expected.json` to get past a failure.
2. **No hand edits.** The four edited files change only through `apply.js`, which applies each of its 22 edits exactly
   once or writes nothing.
3. **No weakening tests.** The edited and generated files must be byte-identical to the dry run.
4. **Tests must be able to fail.** 26 mutations, 14 in the app and 12 in the SQL, must each make their tests FAIL.
5. **Zero hallucination.** Report only what the gate or a raw tool printed.
6. **Pinned tooling.** `fix-plan-churches/gate.js` sha256 = `5cbff7e707d2bcc2166cbcbb23032da4fee1f4f194370446f155e5efe3187060`,
   `fix-plan-churches/expected.json` sha256 = `8b129616f13224a6c1abea0ed45633ea06fc31a7bb9fd2d35e6eb0c99dd491e0`.
7. **Real run only.** The final `RESULT:` lines must not say `DRY-RUN`.
8. **Database checks need PGlite.** Section 18c runs only when `NEWSTART_PGLITE` points at a folder with
   `@electric-sql/pglite@0.5.11` installed. Without it, the 51 database checks are missing and H4 fails.

## 4. Before execution: scope analysis (required, read-only)
1. Check the hashes in rule 6, then read this file, `fix-plan-churches/config.js` and `fix-plan-churches/edits.js`.
2. Run `node fix-plan-churches/scope-report.js`. It must say `SCOPE VERDICT: READY`.
3. Present the analysis under the four headings: scope covered, what it entails, what is in it, how it connects. Stop
   and ask if the verdict is not READY, an edit or goal is unlinked, or the code differs from this plan.

## 5. Steps (Git Bash, from the project folder, after section 4)
```bash
export NEWSTART_PGLITE=<folder with @electric-sql/pglite installed>
sha256sum fix-plan-churches/gate.js fix-plan-churches/expected.json
node fix-plan-churches/gate.js pre     # required: RESULT: PASS (27/27 checks passed, mode=pre)
node fix-plan-churches/apply.js .      # required: applied 22 edits to 4 files
node tools/build.js
node fix-plan-churches/gate.js post    # required: RESULT: PASS (51/51 checks passed, mode=post)
```
**On any other output:** copy the four files back from `%TEMP%/fix-plan-backup`, run `node tools/build.js`, and
report FAILED, quoting the `[FAIL]` lines.

## 6. The exact change (ground truth: `fix-plan-churches/edits.js`)
**`supabase/schema.sql`**
- **S1** removes the global queue index at line 229. The per-church index is created after `church_id` exists.
- **S2** inserts the CHURCHES section before `AFTER RUNNING THE SCRIPT` (line 375) and rewrites that footer.
  - **Tables:** `platform_admins`, `churches` (pending, active or suspended) and `memberships` (member, staff or admin;
    pending or approved).
  - **Access:** `staff_church()`; `is_staff()` and `is_admin()` are redefined on memberships.
  - **One-time move:** runs only on the run that adds `church_id`.
  - **Keys and policies:** primary keys become `(church_id, id)`; there are per-church policies on visitors, volunteers
    and queue; "Call next" is limited to the caller's church; the audit trail records the church.
  - **Account functions** (all check the caller):
    - `my_account`, `church_directory`, `join_church`, `register_church`
    - `update_my_details`, `leave_church`, `my_health`
    - `update_church`, `church_members`, `set_member`, `link_member`, `remove_member`
    - `admin_churches`, `admin_set_church_status`, `admin_audit`

**`index.html`** (H1–H13)
- Account state on `cloud`.
- `gateState()` sends signed-in non-staff to the account screen that fits them.
- `cloudSync()` calls `loadAccount()`. On a database without churches it falls back to `is_staff`. A definite
  "no expo access" answer clears the saved copy, and staff adopt their church.
- Uploads add `church_id` and use `onConflict:'church_id,id'`.
- Sign-out forgets the account and `newstart.church.v1`.
- The panel behind the logo gets My account, Church (church admins) and Admin (platform admin).
- A new account sheet (`#acctSheet`) is added.
- One new code block (373 lines) holds the gate screens, the sheet, the church-admin and platform-admin screens, and
  the member's results view. That view uses the same colour bands as the Results tab and the app's own clinic rule:
  only blood pressure, sugar, cholesterol and weight trigger it, exactly as in `urgentOf`.

**`.smoke/harness.js`** (T1–T5)
- Exports the new functions.
- The fake database answers named account functions and records what an upsert matched on.
- Section 18b adds 37 app checks; section 18c adds 51 database checks on PGlite. Both go before section 19.

**`supabase/README.md`** (R1–R2)
- Setup step 5 now makes you platform admin.
- New section "Churches, members and the platform admin".

**Not changed:** the stylesheet, the health plans, the HARDENING section, and every other file.

## 7. Measured facts
- Baseline: 333 results, 328 PASS / 2 FAIL, plus 3 timing tests that may have any status (gate pre H0a, dry run).
- After: 421 results, at least 416 PASS; every remaining FAIL is one of the 5 unrelated; all 88 required tests PASS (gate post H1, H2, H4).
- Dry run: `RESULT: PASS (27/27 checks passed, mode=pre)` on a pristine copy; `RESULT: PASS (51/51 checks passed, mode=post)` on the patched and built copy.
- Anchors:
  - `index.html`: 4392, 4037, 4475, 4485, 4306
  - `supabase/schema.sql`: 229, 112, 375
  - `.smoke/harness.js`: 1185, 1236
  - `sw.js`: 8
- Line endings: `schema.sql` and `index.html` are CRLF; `harness.js` and `README.md` are LF.
- The first gate run left 3 mutations uncaught, and the tests and mutations were corrected:
  - **MA11** crashed the run instead of failing a test, so it was replaced.
  - **MA12** is really caught by section 17.
  - **MS4** listed a test that guards something else.
- Visual check (dry-run copy, 375 px, stand-in client): the church list, My account with results, the Church screen,
  the Admin screen and the logo panel all rendered, with no console errors.
- Tamper test: see section 10.

## 8. Not measured (so not claimed)
- **Against your real Supabase project:** the SQL was run only on PGlite (Postgres 18.6) with a stand-in auth schema.
  Supabase's own grants, Realtime under the new RLS, and PostgREST upserts with `onConflict: church_id,id` are not measured.
- **Email delivery** for new member sign-ups: not measured.
- **Performance** of the per-church policies with thousands of rows: not measured.
- **Causes of the 5 unrelated failures:** not investigated.

## 9. Execution report template
Present the scope analysis, then quote both `RESULT:` lines, the S1 and H1 lines, and anything not run as "not run".

## 10. Status
**Executed 2026-10-21 (Africa/Johannesburg): PASS.**

- **Tooling:** `fix-plan-churches/` did not exist in the project. It was restored byte-for-byte from the authoring
  scratchpad in the OS temp folder. `gate.js` sha256 =
  `5cbff7e707d2bcc2166cbcbb23032da4fee1f4f194370446f155e5efe3187060`; `expected.json` sha256 =
  `8b129616f13224a6c1abea0ed45633ea06fc31a7bb9fd2d35e6eb0c99dd491e0` (both match rule 6); all five hashes in
  `expected.json` `toolHashes` also match.
- `node fix-plan-churches/gate.js pre` → `RESULT: PASS  (27/27 checks passed, mode=pre)`.
- `node fix-plan-churches/apply.js .` → `applied 22 edits to 4 files`.
- `node tools/build.js` → `built dist/ (cache version 7085dee4a6)`.
- `node fix-plan-churches/gate.js post` → `RESULT: PASS  (51/51 checks passed, mode=post)`:
  `H1` 421 results and at least 416 PASS; `H2` every remaining FAIL is one of the five known unrelated tests;
  `H4` all 88 required tests present and PASS; `M0` 26 mutations and all 26 caught.
- `S1`: exactly `.smoke/harness.js`, `dist/index.html`, `dist/sw.js`, `index.html`, `supabase/README.md` and
  `supabase/schema.sql` changed; `S3`: the other 45 manifest files are byte-identical; every `X-*` file is
  byte-identical to the dry run.
- Section 18c ran on PGlite 0.5.11 (`NEWSTART_PGLITE` pointed at a folder outside the project).
- A separate harness run in a throwaway copy showed exactly the five unrelated FAILs and section 19 still stops at its
  `newstart-libs-v1` check (`CLOUD TESTS THREW: TypeError: Cannot read properties of undefined (reading 'size')`), as
  section 1 said.
- Not measured (unchanged from section 8): the real Supabase project, email delivery, performance of the per-church
  policies at scale, and the causes of the five unrelated failures.
- **Independent check (2026-10-21):** the six changed files are byte-identical to the dry run. Re-running
  `node fix-plan-churches/gate.js post` in the project gave `RESULT: PASS  (51/51 checks passed, mode=post)`.

## 11. Follow-up fix after this plan (made by hand, outside the gate)
After execution, a review found a gap. Live delete events are not filtered by row-level security
(Supabase Realtime docs, "Postgres Changes": "RLS policies are not applied to `DELETE` statements"). The app matched a
live delete on the badge number alone, so a delete in another church could hide this church's visitor with the same
badge on the device until the next full pull.

- **Fix:** `onRemoteChange()` in `index.html` applies a live delete only when it names this device's church. A delete
  that names no church is left to the full pull. An insert or update naming another church is ignored.
- **Test:** two new harness checks in section 18b.
- **Result, measured on a copy of the project:** 418 PASS, and the same five unrelated FAILs.
- **Proof the checks can fail:** with the guard removed, both new checks FAIL.
- **Consequence:** `index.html`, `.smoke/harness.js`, `dist/index.html` and `dist/sw.js` no longer match this plan's
  `expected.json`, so `gate.js post` would now report them as changed. That is expected; this plan is finished and
  should not be re-run.
