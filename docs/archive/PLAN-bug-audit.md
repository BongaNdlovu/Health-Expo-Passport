# Plan — bug audit run by an orchestrator, drafted 2026-11-10

Plain plan with a verify list (the project's plan format). Nothing in this plan has been run. Companion file:
`STATE-MACHINES.md` (machines M1 to M14, referred to below).

## Goal
A ranked list of real, cited bugs in the current app, written to `BUG-AUDIT-2026-11-10.md`. The audit **finds and
proves**; it fixes nothing. Fixes get their own plan afterwards.

## Roles
- **Orchestrator** (one agent, the stronger model): runs the baseline, briefs the lanes, re-reads every finding
  against the source, removes duplicates, ranks, writes the report. Edits no source file.
- **Lane agents** (one per lane, a cheaper model, read-only): read their files and report candidates. They never edit,
  never run a build, and never touch files outside their lane.

## Step 0 — Baseline (orchestrator)
1. Record `git rev-parse HEAD` and `git status --short`. At drafting time: HEAD `0bcdf3e`, 18 uncommitted files. The
   audit reads the working tree as it is; the report states this.
2. Run and save the output of `npm test`, `npm run test:hub`, `npm run test:build`, `npm run typecheck`.
   `npm run test:db` only if it needs no live database (**VERIFY** by reading `tools/test-commitments.js` first).
3. Any check that already fails is recorded as "failing before the audit" and is not counted as a finding.
4. Read `BUG-REVIEW-2026-11-02.md`, `PRESSURE-TEST-2026-10-31.md` and `UI-STATES-AUDIT-2026-11-02.md` and list their
   finding ids, so known items are marked "known" instead of reported again.

## Step 1 — Lanes (run in parallel; no file belongs to two lanes)

| Lane | Files | Machines | Start from |
|---|---|---|---|
| A Session and gate | `src/cloud.js`; `src/account.js` lines 1-130 and 1555-1680 | M1, M2, M3, M5 | The 15 fields listed under "fields that outlive a sign-out" in `STATE-MACHINES.md` |
| B Sync and merge | `src/account.js` 1680 to the end; `src/retention.js` | M4, M6 | Every `await` in `cloudSync` and `cloudPush`: is it followed by a `gen` check? |
| C Queue | `src/queue.js` | M7, M8 | `qs.busy` and `qs.syncing` exits; a move while the channel is reconnecting |
| D Volunteers and account hub | `src/volunteer.js`; `src/account.js` 130-1555; `src/churchPlans.js` | M9, M13 | `status` against `checkedIn`; each busy flag's release |
| E Visitor flow and exports | `src/visitor.js`, `src/results.js`, `src/customPlan.js`, `src/helpers.js`, `src/feedback.js` | M12 | Unread in the inventory: map the check flow first |
| F Boot, update, saved copy | `index.html` inline scripts, `src/main.js`, `src/update.js`, `src/state.js`, `src/shell.js`, `src/overlay.js`, `src/crash.js`, `sw.js`, `nsmem.js`, `tutorial/tour.js` | M11, M14 | Boot order in `MODULE_MAP.md`; storage-full path in `state.js` |
| G Database rules against the client | `supabase/schema.sql` (read-only, no live database) | M10 | Each status the client reads: can the database produce a value the client does not handle? |

Lanes A, B and D share `src/account.js` by line range. They only read, so there is no conflict. Line ranges are from
the 2026-11-10 working tree; the orchestrator re-checks them before briefing.

## Step 2 — What every lane looks for
For each machine in its files, list the states and every writer, then test these six questions:
1. **Stuck state.** A flag set before an `await` and not released on every exit (early return, throw, orphaned pass).
2. **Impossible combination.** Two flags that can both be true when the screens assume they cannot.
3. **Stale return.** An async result written after a sign-out, account switch or church change.
4. **Double action.** A second tap or a second timer starting the same work.
5. **Leak across people.** State that survives sign-out or an account switch on a shared desk.
6. **Network loss at each `await`.** What the person sees, and whether their data is kept.

Also in scope per lane: wrong output for edge values (empty, zero, very long, markup in text) and messages that state
something untrue.

## Step 3 — Finding format (lanes report exactly this)
```
ID: <lane letter>-<n>
Where: <file>:<line>
Machine: <M-number or "none">
What happens: <one sentence, user's view>
Path: <numbered steps from a fresh app to the bug, each citing file:line>
Proof: READ (traced in code) | RUN (reproduced; say how)
Known: <id from an earlier report, or "new">
```
A finding without a line number and a path is dropped. "Might", "could possibly" and style opinions are not findings.

## Step 4 — Orchestrator verification
1. Re-read the cited lines for every finding. Mark each **Confirmed**, **Not a bug** (with the line that prevents it)
   or **Not checked**.
2. For Confirmed findings that the harness can reach, write the reproduction as a harness check in a scratch copy of
   `.smoke/harness.js`, outside the repository, and run it. Record pass or fail output.
3. Merge duplicates across lanes. Rank: **S1** data lost or shown to the wrong person; **S2** a person is stuck and
   must restart; **S3** wrong or misleading display; **S4** cosmetic.
4. Write `BUG-AUDIT-2026-11-10.md`: baseline results, the ranked table, the "not a bug" list with reasons, and the
   "not checked" list.

## Stop and ask the owner when
- A finding looks like live data is at risk right now (S1 that needs no unusual steps).
- Proving a finding would need the live Supabase project, real credentials, or a write to any shared system.
- A lane needs a file that belongs to another lane.

## Out of scope
Fixing anything; `dist/`, `capacitor/www/` and Android assets (built output, per `MODULE_MAP.md`); the landing site;
performance; visual design.

## What to verify when the audit is done
- [ ] `git status --short` matches Step 0, plus only `BUG-AUDIT-2026-11-10.md`.
- [ ] Every finding in the report has a file and line that opens to the code it describes.
- [ ] Every Confirmed finding says READ or RUN, and each RUN has its output.
- [ ] No finding repeats an id from the three earlier reports without the "known" mark.
- [ ] All seven lanes reported, or the report says which did not.
- [ ] The four baseline commands were run again at the end and give the same result as in Step 0.
- [ ] The report's counts (findings per severity) match the rows in its table.
