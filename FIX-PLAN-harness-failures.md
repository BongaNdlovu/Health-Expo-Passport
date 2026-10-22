# Plan: fix four smoke-test failures (Option A), with hard gates

**Status: plan only. Nothing here has been applied to the project.** The patches were dry-run on a scratch copy outside the project.

## 1. Goal
`node .smoke/harness.js` currently reports **313 PASS / 9 FAIL**. After this plan it reports **328 PASS / 5 FAIL**: the four targets pass and the five unrelated failures are untouched.

| # | Failing check | Cause (verified in the code) | Fix |
|---|---|---|---|
| F1 | `no template class is missing from the stylesheet` (`text-[#4f6870] jr-next jr-back max-w-[32ch]`) | `text-[#4f6870]` (7 uses, lines 1997, 2160, 4091, 4268, 4271, 4273) and `max-w-[32ch]` (1 use, line 1937) have no CSS rule. `jr-next` (3 uses) and `jr-back` (2 uses) are hook classes only. | Add 2 CSS rules after line 520; add both hook names to the harness ignore list (line 542) |
| F2 | `pledge screen shows a badge card again after Back` | The card now reads "<Name>’s badge" (`index.html:2966`); the test looks for "Your badge". | Update the test |
| F3 | `typed value is clamped on commit` | Intended behaviour changed (`index.html:2231` comment): an impossible reading is not saved and is explained. | Replace with 8 checks of the real rule |
| F4 | `first + tap starts from the default (121)` | `onStep` (`index.html:2208`) shows the default (120) on the first tap, then steps. **Decision: Option A, keep the app, fix the test.** | Replace with 5 checks |

The five unrelated failures stay as they are and are not investigated here: `change detection over 3900 rows is fast`, `the next poll is down to one small request per table`, `120 visitors registered offline are all pending`, `the whole backlog uploads on reconnect`, `500 live inserts from other desks are applied`.

## 2. Scope: the only files that may change
| Tier | Files | How |
|---|---|---|
| Edited | `index.html` (**CSS only**: exactly two added lines), `.smoke/harness.js` | `node fix-plan/apply.js .` only |
| Generated | `dist/index.html`, `dist/sw.js` (version stamp) | `node tools/build.js` only |
| Plan tooling (read-only during execution) | `FIX-PLAN-harness-failures.md`, `fix-plan/apply.js`, `fix-plan/gate.js`, `fix-plan/expected.json` | never edited |

**Everything else, including the other 86 tracked files, must stay byte-identical.** `index.html`'s whole `<script>` block (all app logic) must stay byte-identical. No file may be added or deleted.

## 3. Hard rules (any violation = the whole plan FAILS)
1. **Fail closed.** One FAIL, one skipped check or one crash in the gate means the plan failed. Do not retry with edits to the gate, `expected.json` or `apply.js`; stop and report.
2. **No hand edits.** The only way to change `index.html` / `harness.js` is `fix-plan/apply.js`. It matches every edit exactly once or stops and writes nothing.
3. **No weakening tests.** The final bytes of both edited files must equal the dry-run result (gate checks X-*). No `ok(…, true)`, no extra ignores, no renamed or dropped checks (H3).
4. **Tests must be able to fail.** The gate breaks the real app 7 ways and requires the matching test to fail each time (MUT-M1…M7).
5. **Zero hallucination.** Every number in this plan was measured (section 6) and `gate pre` re-checks the line numbers, counts and hashes against the real files. In the final report, every statement must be copied from gate output or a raw tool result. Anything not printed by a check may not be claimed. If a value was not measured, say "not measured".
6. **Pinned tooling.** Before starting, `sha256sum fix-plan/gate.js` must equal `52a1f3bddb8ba4bd63b750d19a6686996394cc9f5da217ce90b8096388ed5f57`. The gate pins `apply.js` (`f92bf0177fff…`) and `expected.json` (`58ca088e892f…`) itself.

## 4. Steps (run from `C:\Users\fanel\Downloads\Health Expo`, Git Bash)
```bash
# 0. tooling is the audited version (must print the hash in rule 6)
sha256sum fix-plan/gate.js
# 1. PRE-GATE: baseline must match the plan exactly; also writes verified backups to %TEMP%\fix-plan-backup
node fix-plan/gate.js pre            # required: RESULT: PASS (29/29 checks passed, mode=pre)
# 2. APPLY the exact edits (5 edits, 2 files)
node fix-plan/apply.js .             # required: "applied 5 edits to 2 files"
# 3. BUILD dist
node tools/build.js
# 4. POST-GATE
node fix-plan/gate.js post           # required: RESULT: PASS (29/29 checks passed, mode=post)
```
Any other result: restore the two files from `%TEMP%\fix-plan-backup`, re-run `node tools/build.js`, and report the plan as FAILED with the failing gate lines quoted verbatim.

**Pre-gate checks (29):** tooling hashes; all 90 baseline files byte-identical; 21 anchors (file, line, occurrence count); line endings (`index.html` CRLF, `harness.js` LF); baseline harness is exactly 313 PASS / 9 FAIL with every check name and status as recorded; backups verified.

**Post-gate checks (29):** only the 4 allowed files changed (S1) and nothing added or deleted (S2); each of the 4 is byte-identical to the dry run (X); the other 86 files unchanged (S3); the `<script>` block unchanged (L1); `index.html` differs from baseline by exactly the two CSS lines (L2); app script and harness parse (L3, L4); `dist/index.html` equals `index.html` (D1), `dist/sw.js` equals `sw.js` with the independently recomputed version (D2), same dist file set (D3), security headers still present (D4); harness has 333 checks, ≥328 PASS (H1), every remaining FAIL is one of the 5 unrelated ones (H2), every other check name and status is as recorded (H3), the 15 required new checks PASS (H4), the 2 obsolete names are gone (H5); seven mutation tests (MUT-M1…M7).

## 5. The exact change (ground truth is `fix-plan/apply.js`)
**`index.html`**: after the existing rule at line 520 (`.max-w-\[30ch\]{max-width:30ch}`, inside `<style id="tw-extra">`) add:
```css
  .max-w-\[32ch\]{max-width:32ch}
  .text-\[\#4f6870\]{color:#4f6870}
```
`#4f6870` is rgb(79, 104, 112).

**`.smoke/harness.js`**: (H1) the ignore list becomes `new Set(['nav-drop', 'jr-next', 'jr-back'])`; (H2) the stepper check becomes 5: first **+** on an empty field = 120, second **+** = 121, first **−** = 120, sugar first tap = 5.5, sugar second tap = 5.6; (H3) the clamp check becomes 8: 99 with max 30 is not saved and explained; 72 for sugar is not saved and offers 7.2; `6,5` saves 6.5; `abc` is not saved and says "not a number"; empty clears; 5.4 kept; BP 300 not saved with no decimal fix; (H4) the badge check looks for `’s badge</div>`. The full text of each edit is in `fix-plan/apply.js`.

**No app logic changes.** `onStep` and `onStationCommit` are untouched.

## 6. Measured facts (all re-checked by `gate pre`)
- Baseline harness: 313 PASS, 9 FAIL; the harness exit code is 1 while any FAIL exists.
- Dry run on a scratch copy: 328 PASS, 5 FAIL (+5 stepper, +8 clamp, +1 badge, +1 class check, −4 old FAILs); `apply.js` applied 5 edits.
- Gate dry-run: `pre` 29/29 on a pristine copy and on the real project; `post` 29/29 on the patched and built copy.
- Gate tamper tests (all correctly FAILED): plan never applied; extra file added; a new test weakened to always pass; app logic changed (`CARE_CAP` 30→31); `dist/index.html` left stale.
- `index.html` uses CRLF and `harness.js` uses LF; `apply.js` handles both.

## 7. Not measured (so not claimed)
- The browser check of the CSS (computed `max-width` of the empty-state paragraph, computed colour of a `.text-[#4f6870]` element) was started but **not measured**. From the CSS rule alone the colour must be `rgb(79, 104, 112)` and `max-width` must not be `none`. Baseline browser values: **not measured**.
- The causes of the five unrelated failures: **not investigated**.

## 8. Final report template (only these statements are allowed, each copied from output)
1. Quote the two `RESULT:` lines (pre and post) and both report hashes.
2. Quote the harness tally from the post report.
3. List the files changed (gate S1 output).
4. State anything not run as "not run".
