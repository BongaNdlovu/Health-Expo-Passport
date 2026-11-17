# Plan: cloud status signals (status panel, inline badges, Test now), with hard gates

**Status: EXECUTED 2026-10-21, PASS (section 10).** Every number below was measured on the real files or a dry-run
copy. Tooling lives in `fix-plan-status/`.

## 1. Goal
Today the app has one overall cloud state: the dot on the logo and one line behind it (`CLOUD_UI` / `setCloud()`). The
Queue tab has its own banner (`qStateInfo()`, `index.html:5172`). Other errors appear as toasts that disappear, so staff
cannot see which part of the cloud is working.

Agreed in the brief: a status panel plus inline badges, covering four groups of functions, with a Test now button.

| # | Goal | Fix |
|---|---|---|
| G1 | Sign-in and data sync | Rows **Sign-in**, **Download** and **Upload**. Upload counts what is waiting, and says when the database refused a change. |
| G2 | Live updates and the live queue | Rows **Live updates** and **Live queue**, set from each live connection's own report (`SUBSCRIBED`, `CHANNEL_ERROR`, …). Today the visitor/volunteer connection ignores it (`index.html:4925`). |
| G3 | Accounts and admin | Row **Accounts & admin**: the church and role, a warning when the churches part of the schema is missing, and each failing account call with its function name |
| G4 | Database setup | Row **Database setup** names the exact missing table or function |
| G5 | Where staff see it | **Panel** behind the logo, under Sync now: all 7 rows, with time and detail. **Home**: a pill under "Visitors today" showing the worst of Download, Upload and Live updates. **Queue**: a Details link on its warning and error banners. **Account screens**: a banner while an account call is failing. |
| G6 | Tests and docs | Harness section 18d (21 checks), and a README bullet under "How it behaves" |

**Test now** only reads: one row of `attendees`, `volunteers` and `queue_entries`, plus `queue_now()` and `my_account()`.
It never changes data. A test proves this, and a mutation proves that test can fail.

**Rule kept:** a row changes only when something actually happened. Possible sources:
- a request that worked or failed
- a live connection's own report
- Test now

A row nobody has checked says "Not checked yet". Test now with no connection says "Could not be checked"; it never says
"found".

**Fixed along the way:** the existing "Waiting for approval" panel (`approvalsHTML`) used two border classes that are not
in the stylesheet, so its borders never drew. The new class check surfaced this, and edits C22–C23 switch them to the
existing class.

## 2. Scope: the only files that may change
| Tier | Files | Changed only by |
|---|---|---|
| Edited | `index.html`, `.smoke/harness.js`, `supabase/README.md` | `node fix-plan-status/apply.js .` |
| Generated | `dist/index.html`, `dist/sw.js` | `node tools/build.js` |
| Plan tooling | this file, `fix-plan-status/*` | — |

The other 88 manifest files must stay byte-identical, and nothing may be added or deleted. Invariants:
- The stylesheet `<style id="tw">` does not change.
- The health plans (`PROTOCOLS`) do not change.
- The merge and upload code from `fetchRows` to `resolveConflict` is byte-identical: the signals only observe it.

## 3. Hard rules (any violation = the plan FAILS)
1. **Fail closed.** A `[FAIL]`, a crash or a timeout fails the plan. Never edit the gate, its config or `expected.json`.
2. **No hand edits.** Only `apply.js` changes the three files, through 28 exact edits, each matching exactly once.
3. **No weakening tests.** Edited and generated files must be byte-identical to the dry run.
4. **Tests must be able to fail.** 10 mutations (MH1–MH10) must each make their tests FAIL.
5. **Zero hallucination.** Report only what the gate or a raw tool printed.
6. **Pinned tooling.** `fix-plan-status/gate.js` sha256 = `5cbff7e707d2bcc2166cbcbb23032da4fee1f4f194370446f155e5efe3187060`,
   `fix-plan-status/expected.json` sha256 = `20d25c93973cf337f42c1d66952e799971013cdd1921babd683a9736f9ac9ce5`.
7. **Real run only.** The final `RESULT:` lines must not say `DRY-RUN`.
8. **Database checks need PGlite.** Set `NEWSTART_PGLITE` to a folder with `@electric-sql/pglite@0.5.11`, or section 18c
   is skipped and the baseline check H0b fails.
9. **Signing key in temp copies.** The gate runs the tests in temporary copies of the project, and deletes them afterwards.
   Those copies include `android/signing`, because section 19 checks that the key file exists. The manifest does not hash
   the key.

## 4. Before execution: scope analysis (required, read-only)
1. Check the hashes in rule 6. Read this file, `fix-plan-status/config.js` and `fix-plan-status/edits.js`.
2. Run `node fix-plan-status/scope-report.js`. It must say `SCOPE VERDICT: READY`.
3. Present the four headings: scope covered, what it entails, what is in it, how it connects. Stop and ask on any
   mismatch.

## 5. Steps (Git Bash, from the project folder, after section 4)
```bash
export NEWSTART_PGLITE=<folder with @electric-sql/pglite installed>
sha256sum fix-plan-status/gate.js fix-plan-status/expected.json
node fix-plan-status/gate.js pre     # required: RESULT: PASS (21/21 checks passed, mode=pre)
node fix-plan-status/apply.js .      # required: applied 28 edits to 3 files
node tools/build.js
node fix-plan-status/gate.js post    # required: RESULT: PASS (34/34 checks passed, mode=post)
```
**On any other output:** copy the three files back from `%TEMP%/fix-plan-backup`, run `node tools/build.js`, and
report FAILED, quoting the `[FAIL]` lines.

## 6. The exact change (ground truth: `fix-plan-status/edits.js`)
**`index.html`**

*New code*
- **C1:** one new block before the churches code, containing:
  - the status records: `health`, `noteHealth`, `healthReset`
  - error classification: `healthFromError`, where offline is amber, a missing table or function is red and also marks
    Database setup, and a refusal is red
  - `healthUpload` and `healthLive`
  - the screens: the panel (`statusPanelHTML`), the Home pill (`homeHealthHTML`) and the account banner
    (`acctHealthHTML`)
  - `healthTest`, the read-only Test now

*Where each row is set*
- **Sign-in:**
  - **C2:** red when the sign-in library failed to load
  - **C3:** green when signed in
  - **C4:** a sign-out clears every row
- **Accounts:**
  - **C5:** amber when the database has no churches part
  - **C6:** green with the church and role
  - **C7:** each failing account call
- **Download and Upload:**
  - **C8:** `cloudError` records failures; offline recounts what is waiting
  - **C9:** "off" for an account with no expo access
  - **C10:** green after a sync, with counts
  - **C11:** `cloudPush` records upload results
- **Live updates:**
  - **C12:** the connection reports its state
  - **C13:** off when stopped
- **Live queue:**
  - **C14:** state after loading
  - **C15:** a failing load, naming a missing queue table
  - **C16:** its connection state

*Where staff see it*
- **C17:** the queue banner's Details link
- **C18:** the status list in the panel behind the logo
- **C19:** the Home pill
- **C20–C21:** the banner on the account sheet and on the account screens in the sign-in gate
- **C22–C23:** the approvals panel's border classes

**`.smoke/harness.js`**
- **T1:** exports the new functions.
- **T2–T3:** the fake database can report a live connection state. This is opt-in, so older tests are unchanged.
- **T4:** section 18d (21 checks), before section 19.

**`supabase/README.md`**
- **R1:** one bullet explaining the rows and what Test now does.

**Not changed:** the stylesheet, the health plans, and the sync, merge and upload logic.

## 7. Measured facts
- **Baseline:** 567 results, 562 PASS / 0 FAIL, plus 5 timing tests that may have any status (H0a). There are no
  unrelated failures.
- **After:** 588 results, at least 583 PASS; all 21 required tests PASS; 10 mutations defined, all caught (gate post).
- **Dry run:** `RESULT: PASS (21/21 checks passed, mode=pre)` and `RESULT: PASS (34/34 checks passed, mode=post)`.
- **Tamper test:** `TAMPER-TEST: PASS (control passed; 9 tampers)`. Each tamper was caught:
  - plan never applied
  - stray file
  - each edited file drifted by one byte
  - an out-of-scope file changed
  - each generated file stale
  - half-applied
- **Scope report:** READY on the pristine copy and **on the real project**; ALREADY APPLIED on the patched copy.
- **Real project:** `node fix-plan-status/gate.js pre` → `RESULT: PASS (21/21 checks passed, mode=pre)` (B1: 93 files
  byte-identical to the baseline).
- **Anchors:**
  - `index.html`: 4758 (`cloudError`), 4925 (live `subscribe`), 5172 (`qStateInfo`), 4292 (`renderCloudBody`), 564 (`.q-state`)
  - `.smoke/harness.js`: 1596 (section 19)
- **Gate history:** the first gate run left mutation MH4 (Home showing the best row instead of the worst) uncaught,
  because its test had Download and Upload in the same state. A test where the rows differ was added; it is now caught.
- **Visual check** (dry-run copy, 375 px, stand-in client):
  - the panel with 7 rows, including a missing `queue_entries` named in red
  - the Home pill turning amber when offline
  - the Queue banner with Retry and Details
  - no console errors

## 8. Not measured (so not claimed)
- **Your real Supabase project:** not measured. That includes the real Realtime status strings over a real network, and
  Test now against the live database.
- **Older phones:** how the panel renders on them is not measured.
- **Missing-name messages:** only the PostgREST formats `'public.name'`, `public.name` and `relation "name"` are
  recognised. Any other wording shows as "a table or function".

## 9. Execution report template
Present the scope analysis, then quote both `RESULT:` lines, the S1 and H1 lines, and anything not run as "not run".

## 10. Execution (2026-10-21)
- **Scope analysis:**
  - The rule-6 hashes matched.
  - `scope-report.js`: `SCOPE VERDICT: READY  (28 edit(s) pending, 0 already applied)`, with all five files matching the
    planned baseline.
  - Callers checked: `cloudError` (2), `qStateBar` (1), `renderCloudBody` (8). No name clash with `cloud.health` or
    `healthHTML`.
- `node fix-plan-status/gate.js pre` → `RESULT: PASS  (21/21 checks passed, mode=pre)` (report sha256 `2ee17d1bd178b48d…`)
- `node fix-plan-status/apply.js .` → `applied 28 edits to 3 files`
- `node tools/build.js` → `built dist/ (cache version 68e42f769b)`
- `node fix-plan-status/gate.js post` → `RESULT: PASS  (34/34 checks passed, mode=post)` (report sha256 `6a92b7633ee52cfc…`)
  - `S1  exactly these files changed: .smoke/harness.js, dist/index.html, dist/sw.js, index.html, supabase/README.md`
  - `H1  tests: 588 results and at least 583 PASS`
- **Not run:** anything against the real Supabase project (section 8).
