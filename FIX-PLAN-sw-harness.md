# Plan: fix the harness crash caused by the sw.js header change

**Status: plan only until section 10 says otherwise.** Every number below was measured on the real files or a dry-run
copy, and `gate pre` re-checks it before anything changes. Toolkit: `fix-plan-sw/`.

## 1. Goal
The smoke harness stops part-way: it reports **445 results (439 PASS + 6 speed tests, 0 FAIL)**, then
`CLOUD TESTS THREW: TypeError: Cannot read properties of undefined (reading 'get')` and exits 1, so every check after the
service-worker section never runs. After this plan it runs to the end: **586 results (580 PASS + 6 speed tests, 0 FAIL),
exit 0**. `sw.js` itself is not changed.

| # | Problem | Cause, verified in the code | Kind | Fix |
|---|---|---|---|---|
| F1 | The harness crashes | `sw.js:95` reads `request.headers.get('User-Agent')`; the fake request built at `.smoke/harness.js:2093` has no `headers`. The first GET that reaches line 95 (`harness.js:2106`, `evil.example`) throws | Stale test fixture | Fake requests carry headers (with an optional User-Agent) |
| F2 | Two service-worker tests no longer describe `sw.js` | `sw.js:48-50` and `:60-64`: with nothing saved the worker now answers with a 503 message, because a rejection shows on phones as `net::ERR_CACHE_MISS`; `sw.js:56` saves a page only when the answer is `text/html`. The test at `harness.js:2122` still expects a rejection; the one at `:2109` passed only because the install step had already saved `net:./` | Stale tests (the code comments say the change is deliberate) | The 503 test expects the 503 message; the save test checks the exact page fetched; the fake network says what each answer is |
| F3 | The new `sw.js` behaviours have no test | `sw.js:56` (only HTML is saved), `:95` (Android in-app browser loads pages itself), `:97` (the apk is never intercepted) | Missing tests | Three new tests |
| F1, F3 (E4b) | A broken offline fallback would crash the harness instead of failing one check | `harness.js` awaited the offline answer without catching a rejection (found when mutation M6 crashed the run) | Weak test | A rejection counts as a failed check |

Out of scope: nothing else fails before or after.

## 2. Scope
| Tier | Files | Changed only by |
|---|---|---|
| Edited | `.smoke/harness.js` | `node fix-plan-sw/apply.js .` |
| Generated | none | n/a |
| Plan tooling | this file, `fix-plan-sw/*` | — |

Everything else (141 files) must stay byte-identical; no file may be added or deleted. Invariants: `sw.js` is
byte-identical, and so is the app script in `index.html`. Not part of the gate's file list: `mobile/`, `capacitor/`.

## 3. Hard rules
1. **Fail closed.** One `[FAIL]`, a crash or a timeout means the plan failed. Restore the backup and report.
2. **No hand edits.** `.smoke/harness.js` changes only through `fix-plan-sw/apply.js`.
3. **No weakening tests.** The harness must be byte-identical to the dry run; no other test may change name or status.
4. **Tests must be able to fail.** The gate undoes each deliberate `sw.js` change in a temporary copy (6 mutations); the
   matching test must fail each time.
5. **Zero hallucination.** Every number here was measured (section 7).
6. **Pinned tooling.** `fix-plan-sw/gate.js` sha256 `5cbff7e707d2bcc2166cbcbb23032da4fee1f4f194370446f155e5efe3187060`;
   `fix-plan-sw/expected.json` sha256 `a698bdfad697cd420f06bd94b0dafc7e5d479e1e8281ff05c1d3bde74fa5d0ae`.
7. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis (read-only)
Check the pins; read this file, `fix-plan-sw/config.js` and `fix-plan-sw/edits.js`; run `node fix-plan-sw/scope-report.js`
(required: `SCOPE VERDICT: READY`); present scope covered, what it entails, what is in it, and how it connects with the
plan. Stop and ask on any mismatch.

## 5. Steps
```bash
sha256sum fix-plan-sw/gate.js fix-plan-sw/expected.json   # 0. compare with rule 6
node fix-plan-sw/gate.js pre        # 1. required: RESULT: PASS (21/21 checks passed, mode=pre)
node fix-plan-sw/apply.js .         # 2. required: applied 7 edits to 1 file
node fix-plan-sw/gate.js post       # 3. required: RESULT: PASS (24/24 checks passed, mode=post)
```
On any other output: copy `.smoke/harness.js` back from `%TEMP%/fix-plan-backup` and report the plan as FAILED.

## 6. The exact change (ground truth: `fix-plan-sw/edits.js`)
### E1 the fake network says what each answer is
Goals: F2. sw.js:56 saves a page only when the answer is text/html; the fake network answered everything as plain text, so no page was ever saved and the save test passed only on the install copy. Proven by mutation(s) M3, M5.
File: `.smoke/harness.js`. Replaces:
```
  let netFail = false, netCalls = [];
  const swSandbox = {
```
with:
```
  let netFail = false, netCalls = [];
  /* like a real host, every answer says what it is: pages are HTML, unless the address asks for plain text */
  const typeOfNet = u => /\.js(\?|$)/.test(u) ? 'application/javascript' : /\.png(\?|$)/.test(u) ? 'image/png' : /\.woff2(\?|$)/.test(u) ? 'font/woff2'
    : /[?&]plain=1/.test(u) ? 'text/plain' : 'text/html; charset=utf-8';
  const swSandbox = {
```

### E1b the fake fetch uses it
Goals: F2. returns each answer with its content type. Proven by mutation(s) M3, M5.
File: `.smoke/harness.js`. Replaces:
```
    fetch: async r => { netCalls.push(typeof r === 'string' ? r : r.url); if (netFail) throw new TypeError('Failed to fetch'); return new Response('net:' + (typeof r === 'string' ? r : r.url)); },
```
with:
```
    fetch: async r => { const u = typeof r === 'string' ? r : r.url; netCalls.push(u); if (netFail) throw new TypeError('Failed to fetch');
      return new Response('net:' + u, { headers: { 'Content-Type': typeOfNet(u) } }); },
```

### E2 fake requests carry headers
Goals: F1. sw.js:95 reads request.headers.get('User-Agent'); the fake request had no headers, which crashed the harness at its first non-Supabase GET and hid every check after it. Proven by mutation(s) M1.
File: `.smoke/harness.js`. Replaces:
```
  const route = (url, init = {}) => { let out = { handled: false, promise: null };
    swHandlers.fetch({ request: { method: 'GET', mode: 'cors', url, ...init }, respondWith: p => { out.handled = true; out.promise = p; } }); return out; };
```
with:
```
  const route = (url, init = {}) => { let out = { handled: false, promise: null };
    /* a real request carries headers; init.ua stands for the browser's User-Agent */
    const { ua, ...rest } = init;
    const headers = { get: n => (String(n).toLowerCase() === 'user-agent' ? (ua || null) : null) };
    swHandlers.fetch({ request: { method: 'GET', mode: 'cors', url, headers, ...rest }, respondWith: p => { out.handled = true; out.promise = p; } }); return out; };
```

### E3 the save test checks the page that was fetched
Goals: F2. it only checked startsWith("net:"), which the copy saved at install already satisfied. Proven by mutation(s) M5.
File: `.smoke/harness.js`. Replaces:
```
  ok('the fetched page is saved for offline use', (await (swCaches.get('newstart-shell-test1').get(keyOf('index.html')).clone().text())).startsWith('net:'));
```
with:
```
  const savedPage = async () => (await swCaches.get('newstart-shell-test1').get(keyOf('index.html')).clone().text());
  ok('the fetched page is saved for offline use', (await savedPage()) === 'net:https://expo.example/?x=1');
```

### E4 tests for the new sw.js behaviours
Goals: F3. sw.js:56 (only HTML is saved), :95 (Android in-app browser loads pages itself) and :97 (the apk is never intercepted) had no test. Proven by mutation(s) M1, M2, M3.
File: `.smoke/harness.js`. Replaces:
```
  netFail = true;
  const offNav = route('https://expo.example/', { mode: 'navigate' });
```
with:
```
  const plainNav = route('https://expo.example/?plain=1', { mode: 'navigate' });
  if (plainNav.handled) await plainNav.promise;
  ok('an answer that is not a web page is not saved as the offline page', plainNav.handled && (await savedPage()) === 'net:https://expo.example/?x=1');
  const wv = route('https://expo.example/', { mode: 'navigate', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36' });
  const chrome = route('https://expo.example/', { mode: 'navigate', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36' });
  if (chrome.handled) await chrome.promise;
  ok('Android\'s in-app browser (wv) loads pages itself, untouched by the worker', wv.handled === false && chrome.handled === true);
  ok('the app download (.apk) is never intercepted', route('https://expo.example/newstart.apk').handled === false);
  netFail = true;
  const offNav = route('https://expo.example/', { mode: 'navigate' });
```

### E4b a broken offline fallback fails its check instead of stopping the harness
Goals: F1, F3. the test awaited the answer without catching a rejection, so a worker that rejected offline crashed the whole harness (every later check silently missing) instead of failing this one check. Proven by mutation(s) M6.
File: `.smoke/harness.js`. Replaces:
```
  const offNav = route('https://expo.example/', { mode: 'navigate' });
  ok('offline: the page opens from the saved copy', offNav.handled && (await (await offNav.promise).text()).startsWith('net:'));
```
with:
```
  const offNav = route('https://expo.example/', { mode: 'navigate' });
  /* a rejection must count as a failed check, not stop the harness */
  const offText = offNav.handled ? await offNav.promise.then(r => r.text(), () => '') : '';
  ok('offline: the page opens from the saved copy', offText.startsWith('net:'));
```

### E5 nothing saved yet: a 503 message, not a rejection
Goals: F2. sw.js:48-50 and :60-64: a rejected answer shows on the phone as net::ERR_CACHE_MISS, so the worker now answers with a short 503 message; the test still expected a rejection. Proven by mutation(s) M4.
File: `.smoke/harness.js`. Replaces:
```
  const cold = route('https://expo.example/', { mode: 'navigate' });
  ok('offline with nothing saved yet: the failure is reported, not faked', cold.handled && await cold.promise.then(() => false, () => true));
```
with:
```
  const cold = route('https://expo.example/', { mode: 'navigate' });
  /* sw.js answers with a short 503 message instead of rejecting: a rejection shows on the phone as net::ERR_CACHE_MISS */
  const coldRes = cold.handled ? await cold.promise.then(r => r, () => null) : null;
  ok('offline with nothing saved yet: the failure is reported, not faked', !!coldRes && coldRes.status === 503 && /could not be loaded/.test(await coldRes.text()));
```

`sw.js` and the app are not changed (invariants).

## 7. Measured facts
- Baseline: 142 files. Changed by the dry run: `.smoke/harness.js` only.
- Harness before: 439 PASS / 0 FAIL counted (445 results including 6 speed tests listed as flaky), exit 1 (the crash).
  After: 580 PASS / 0 FAIL counted (586 results), exit 0.
- Anchors: `.smoke/harness.js:2093` (the fake request), `:2106` (first test that crashes), `:2109` (save test), `:2122`
  (nothing-saved test); `sw.js:95` (User-Agent), `:56` (HTML only), `:97` (apk), `:63` (503 message), `:49` (the comment
  explaining it). Each occurs once.
- Dry-run gate: `RESULT: PASS  (21/21 checks passed, mode=pre)` and `RESULT: PASS  (24/24 checks passed, mode=post)`;
  M1–M6 all caught.
- The first dry-run `gate post` failed `MUT-M6` (23/24): breaking the offline fallback crashed the harness instead of
  failing a check. Edit E4b was added for it; the second run passed.
- Tamper test: `TAMPER-TEST: PASS  (control passed; 5 tampers)`: plan never applied, a stray file, a one-byte drift, an
  out-of-scope change, and a half-applied edit were each caught.
- Scope report: `READY (7 edit(s) pending)` on pristine, `ALREADY APPLIED` on the dry run.

## 8. Not measured
- How `sw.js` behaves in real browsers (Chrome, Android's in-app browser): the harness runs it against fake service-worker
  globals only.
- The 4-second "slow network" fallback is not tested (it would add 4 s to every run).

## 9. Execution report
1. The scope analysis with the SCOPE VERDICT line. 2. Both `RESULT:` lines. 3. The S1 and H1 lines. 4. Anything not run.

## 10. Execution result (2026-10-23)
- Scope analysis presented first; `SCOPE VERDICT: READY  (7 edit(s) pending, 0 already applied)`.
- `node fix-plan-sw/gate.js pre` → `RESULT: PASS  (21/21 checks passed, mode=pre)`.
- `node fix-plan-sw/apply.js .` → `applied 7 edits to 1 file`.
- `node fix-plan-sw/gate.js post` → `RESULT: PASS  (24/24 checks passed, mode=post)`;
  `[PASS] S1  exactly these files changed: .smoke/harness.js`; `[PASS] H1  tests: 586 results and at least 580 PASS`;
  `[PASS] H4  all 12 required tests are present and PASS`; MUT-M1 … MUT-M6 all caught.
- Not run: `sw.js` in real browsers; the 4-second slow-network fallback.
