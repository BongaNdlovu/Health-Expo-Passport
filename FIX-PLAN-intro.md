# Plan: the intro plays in full

**Status: executed (section 9).** Every number below was measured on the real files, a dry-run
copy or the emulator, and `gate pre` re-checks the baseline before anything changes. Toolkit: `fix-plan-intro/`.

## 1. Goal
The intro (logo pops in and beats once, then the app rises) is cut short. `index.html:3973` times it by the clock:
`setTimeout(leave,Math.max(120,1100-performance.now()))`, so it leaves about 1.1 s after navigation began, whether or
not the logo has been seen. Measured on the emulator (debug build, 3 reloads, `intro-measure.js`):

| Reload | First paint | Intro leaves | Logo animation played when it left |
|---|---|---|---|
| 1 | 536 ms | 1102 ms | pop 450/450 (finished), beat 800/1100 |
| 2 | 752 ms | 1103 ms | pop 450/450 (finished), beat 817/1100 |
| 3 | 1204 ms | 1101 ms | pop 200/450, beat 200/1100 |

| # | Goal | Fix |
|---|---|---|
| F1 | The intro plays in full: it leaves when the logo's own animation has finished, however late the page first paints | E1 |
| F2 | It never holds the app back: it leaves anyway 1.6 s after the logo appears, or 5 s after the script runs if the logo never shows; it leaves only once | E1 |
| F3 | Every behaviour above has a harness check that can fail | E2 |

Out of scope: the intro's look (CSS and markup are invariants), the cold-start blank gap before the page first paints.

## 2. Scope
| Tier | Files | Changed only by |
|---|---|---|
| Edited | `index.html`, `.smoke/harness.js` | `node fix-plan-intro/apply.js .` |
| Generated | `dist/index.html`, `dist/sw.js` | `node tools/build.js` |
| Plan tooling | this file, `fix-plan-intro/*` | — |

The other 212 files must stay byte-identical; no file may be added or deleted. Invariants: the content, health logic and
sync code; every stylesheet (`index.html` lines 1-888); the page markup up to the app script (lines 888-1112); `sw.js`.

## 3. Hard rules
1. **Fail closed.** One `[FAIL]`, a crash or a timeout means the plan failed. Restore the backup and report.
2. **No hand edits.** The two edited files change only through `fix-plan-intro/apply.js`.
3. **No weakening tests.** No existing test may change name or status.
4. **Tests must be able to fail.** 5 mutations, each must make its matching new test fail.
5. **Zero hallucination.** Every number here was measured (section 7).
6. **Pinned tooling.** `fix-plan-intro/gate.js` sha256 `5cbff7e707d2bcc2166cbcbb23032da4fee1f4f194370446f155e5efe3187060`;
   `fix-plan-intro/expected.json` sha256 `f2ccbdc49077686c3155abd13277f3ae94ad1120e144bc9472999b6dbb23afdf`.
7. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis (read-only)
Check the pins; read this file, `fix-plan-intro/config.js` and `fix-plan-intro/edits.js`; run
`node fix-plan-intro/scope-report.js` (required: `SCOPE VERDICT: READY`); present the analysis; stop on any mismatch.

## 5. Steps
```bash
sha256sum fix-plan-intro/gate.js fix-plan-intro/expected.json   # 0. compare with rule 6
node fix-plan-intro/gate.js pre     # 1. required: RESULT: PASS (21/21 checks passed, mode=pre)
node fix-plan-intro/apply.js .      # 2. required: applied 2 edits to 2 files
node tools/build.js                 # 3. regenerates dist/
node fix-plan-intro/gate.js post    # 4. required: RESULT: PASS (31/31 checks passed, mode=post)
```
On any other output: copy the edited files back from `%TEMP%/fix-plan-backup`, rebuild, and report the plan as FAILED.

## 6. The exact change (ground truth: `fix-plan-intro/edits.js`)
### E1 the intro waits for the logo's animation (F1, F2; proven by M1-M5)
`index.html`, replaces the `introLeave` block (lines 3966-3974) with:
```js
(function introLeave(){
 const el=document.getElementById('intro');if(!el)return;
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){el.remove();return;}
 let gone=false;
 const leave=()=>{if(gone)return;gone=true;document.documentElement.classList.add('intro-rise');el.classList.add('intro-out');setTimeout(()=>el.remove(),450);};
 const badge=el.querySelector('.intro-badge');
 const anims=badge&&badge.getAnimations?badge.getAnimations():[];
 if(!anims.length){setTimeout(leave,Math.max(120,1100-performance.now()));return;}
 Promise.all(anims.map(a=>a.finished)).then(leave,leave);
 Promise.all(anims.map(a=>a.ready)).then(()=>setTimeout(leave,1600),leave);
 setTimeout(leave,5000);
})();
```
(plus a rewritten comment above it).

### E2 harness section 16d (F3)
`.smoke/harness.js`, after section 16c: runs the `introLeave` source on its own in a `vm` context with fake timers and
controllable animation promises. Five checks:
- it waits for the logo's animation to finish, however late the page first paints;
- it still leaves 1.6 s after the logo appears if the animation stalls;
- it still leaves after 5 s if the logo never gets to show;
- it leaves only once, however many of its timers fire;
- browsers that cannot report animations get the old timing.

## 7. Measured facts
- Tests before: 596 results, 590 PASS / 0 FAIL (+6 flaky). After (dry run): 595 PASS / 0 FAIL.
- Anchors: `index.html:891` intro markup, `index.html:523` the badge animation (pop 0.45 s, beat 0.6 s from 0.5 s),
  `.smoke/harness.js:805` section 17.
- Dry-run gate: pre `RESULT: PASS (21/21)`, post `RESULT: PASS (31/31)`, M1-M5 each caught.
- Tamper test: PASS (control passed; 8 tampers: plan never applied, stray file, one-byte drift in each edited file,
  out-of-scope change, each generated file stale, half-applied).
- Scope report: READY on the baseline, ALREADY APPLIED on the dry run.
- Real project: `gate.js pre` → `RESULT: PASS (21/21 checks passed, mode=pre)`.

## 8. Not measured
- The cold start was checked by screenshots about 0.5-0.9 s apart, so the beat itself was not seen frame by frame.
- Real phones and iPhone Safari.
- Whether 1.6 s and 5 s are the best safety limits; they are design choices (the animation itself lasts 1.1 s).

## 9. Execution record
Executed 2026-10-23 after the scope analysis (`scope-report.js`: `SCOPE VERDICT: READY`, both pins matched):
- `gate.js pre` → `RESULT: PASS (21/21 checks passed, mode=pre)`
- `apply.js .` → `applied 2 edits to 2 files`; `node tools/build.js` regenerated `dist/`
- `gate.js post` → `RESULT: PASS (31/31 checks passed, mode=post)`, M1-M5 each caught

On the emulator (debug build, same 5 reloads as section 1's method): the intro left at 1597-1780 ms (was 1101-1103 ms),
and every time both logo animations had finished (pop 450/450, beat 1100/1100). A cold start, by screenshots: Android
splash at 1.4-2.7 s, blank app colour at 3.6-4.5 s, intro logo at 5.1 s, sign-in at 5.9 s. Device checks: 32 of 32
offline, 2 of 2 online. Release APK rebuilt and signed (certificate SHA-256 `16f97c41…31d1`) and contains the change.

Found while executing, not fixed here: `tools/sign-app.ps1` stops at line 58 whenever `JAVA_HOME` is set, because
`java -version` writes to stderr and the script treats that as an error; it works with `JAVA_HOME` unset.
