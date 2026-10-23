# Plan: the web app as a Capacitor Android app (offline-first, shared data)

**Status: plan only. Nothing in sections 1–6 has been applied to the project yet.** Every number below was measured on the
real files or a dry-run copy, and `gate pre` re-checks it before anything changes. The toolkit lives in
`fix-plan-capacitor/` (the project already has an older `fix-plan/`, which this plan leaves alone).

## 1. Goal
Package the existing web app (`index.html`) as an Android app with Capacitor, so it opens with no internet (everything
inside the app) and keeps sharing data through Supabase when there is signal. iPhone volunteers keep using the web app in
Safari on the same data. The web site must behave exactly as before.

Today the harness reports **433 PASS / 0 FAIL** and then stops with a crash (see "Out of scope"). After the change it
reports **445 PASS / 0 FAIL**: the 12 new app checks pass and the 433 existing results are unchanged.

| # | Problem inside an app wrapper | Where (from the anchors) | Kind | Fix |
|---|---|---|---|---|
| F1 | Fonts load from Google, libraries from CDNs, and a service worker registers: none work offline from first launch | `index.html:19` (Google Fonts), `:2738` (`loadScript`), `:4036` (service worker) | Real gap | Bundled copies in `vendor/`, used only inside the app; no service worker in the app |
| F2 | WhatsApp opens `https://wa.me/…` in a new window, which does nothing inside an app | `index.html:3723` (`sendWhatsApp`), `:3729` (`target='_blank'`) | Real gap | `whatsapp://` through the AppLauncher plugin; the Share plugin when WhatsApp is missing |
| F3 | `window.print()` does not exist in an Android app | `index.html:3795` (`printCard`), `:3800` | Real gap | Card HTML + its `.pc-*` styles go to a native CardPrinter plugin, A6 page |
| F4 | Email links use `location.origin` (`https://localhost` in the app); iPhone "Add to Home Screen" steps would show inside an app | `index.html:4081` (`authRedirect`), `:4030` (`installBlock`) | Real gap | Email links go to the web site (`APP_SITE`); no install steps inside the app |
| F5 | The web site must not change behaviour | — | Requirement | `IS_APP` is false on the web; checked by harness |
| F6 | Prove F1–F5 | `.smoke/harness.js:696` | New tests | Section 16b boots the page as the app with a stand-in Capacitor |

Out of scope, unchanged before and after: the harness stops at its service-worker section with
`CLOUD TESTS THREW: TypeError: Cannot read properties of undefined (reading 'get')`, on the pristine copy as well. Cause
(read in the code, not changed here): the uncommitted `sw.js` now calls `request.headers.get('User-Agent')`, and the
harness's fake requests have no `headers`. Checks after that point do not run, before or after this plan.

## 2. Scope: the only files that may change
| Tier | Files | Changed only by |
|---|---|---|
| Edited | `index.html`, `.smoke/harness.js` | `node fix-plan-capacitor/apply.js .` |
| Generated | `dist/index.html`, `dist/sw.js` | `node tools/build.js` |
| Plan tooling (never edited during execution) | this file, `fix-plan-capacitor/*` | — |

Everything else (117 files) must stay byte-identical. No file may be added or deleted while the gate runs.

Invariants (must stay byte-identical): the plan content (`const BOOK_REF=` … `const HUES=`), the health logic
(`function cat(` … `NUMBER TWEEN`), plan matching (`planNeeds` … `viewPlan`), and the Supabase sync (`cloudSync` …
`startRealtime`).

Skipped by the gate (not part of its file list): `mobile/` (the paused React Native work) and `capacitor/` (created by
step 6 below).

**After the gate (section 5, steps 5–8), new files are added.** They are outside the find/replace toolkit and are proven
by `tools/build-app.js`'s hash check, the APK checks and the emulator test:
`vendor/` (3 libraries, `fonts.css`, 4 font files, README), `tools/build-app.js`, `tools/sign-app.ps1`, and the
`capacitor/` project (package.json, capacitor.config.json, the Android project with `CardPrinterPlugin.java`, the current
app's icons and splash, CAMERA permission, version 1.1.0 / code 4).

## 3. Hard rules (any violation = the whole plan FAILS)
1. **Fail closed.** One `[FAIL]`, a crash or a timeout in the gate means the plan failed. Do not edit the gate, its config
   or `expected.json` to get past a failure. Restore the backups and report.
2. **No hand edits.** Edited files change only through `fix-plan-capacitor/apply.js`, which applies each edit exactly once
   or writes nothing.
3. **No weakening tests.** Edited and generated files must be byte-identical to the dry-run result. No test may be
   renamed, dropped, skipped or made always-true.
4. **Tests must be able to fail.** The gate breaks the fixed code 11 ways; each matching test must fail.
5. **Zero hallucination.** Every number, line, count and outcome in this plan was measured (section 7). In the execution
   report, every statement must be copied from gate output or a raw tool result.
6. **Pinned tooling.** `fix-plan-capacitor/gate.js` sha256 must be
   `5cbff7e707d2bcc2166cbcbb23032da4fee1f4f194370446f155e5efe3187060` and `fix-plan-capacitor/expected.json` must be
   `ae3f636bec5eb0b48170f20b3deeee726cb6e191876ab508b152bfab46598992`.
7. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis (required, read-only)
1. Check the pinned hashes (rule 6). Read this document, `fix-plan-capacitor/config.js` and `fix-plan-capacitor/edits.js`.
2. Run `node fix-plan-capacitor/scope-report.js`. Required: `SCOPE VERDICT: READY`.
3. Open each edit site and its callers and tests.
4. Present the scope under: scope covered, what it entails, what is in it, how it connects with the plan.
5. Stop and ask if the verdict is not READY, an edit or goal is unlinked, the code does not match this plan, this
   document and `edits.js` disagree, or the change would affect something not mentioned here.

## 5. Steps (from the project root, only after section 4)
```bash
sha256sum fix-plan-capacitor/gate.js fix-plan-capacitor/expected.json   # 0. compare with rule 6
node fix-plan-capacitor/gate.js pre        # 1. required: RESULT: PASS (27/27 checks passed, mode=pre)
node fix-plan-capacitor/apply.js .         # 2. required: applied 11 edits to 2 files
node tools/build.js                        # 3. regenerate dist/
node fix-plan-capacitor/gate.js post       # 4. required: RESULT: PASS (35/35 checks passed, mode=post)
```
On any other output: copy each edited file back from `%TEMP%/fix-plan-backup`, re-run `node tools/build.js`, and report
the plan as FAILED, quoting the `[FAIL]` lines.

After a PASS:
5. Add `vendor/` (the files measured in section 7) and `tools/build-app.js`; run it. Required: it builds `capacitor/www/`
   and does not print "NOT built".
6. Add `tools/sign-app.ps1` and the `capacitor/` project; run `powershell -File tools\sign-app.ps1`. Required: apksigner
   prints "Verifies", and the certificate SHA-256 equals the current app's (`android/app-release-signed.apk`).
7. Check the APK: package `org.newstart.expopassport`, version code 4, permissions include INTERNET and CAMERA.
8. Emulator (`ctv390`): install over the current app; in airplane mode, a fresh start opens and a visitor can be registered
   and screened; the card prints; WhatsApp falls back to the share sheet (no WhatsApp on the emulator); with the network
   back, sign-in and sync reach Supabase.

## 6. The exact change (ground truth: `fix-plan-capacitor/edits.js`)
### E1 fonts: bundled copy in the app, Google Fonts on the web
Goals: F1, F5. the three Google Fonts tags need the internet; inside the app the same fonts come from vendor/fonts.css. Proven by mutation(s) M10.
File: `index.html`. Replaces:
```
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=Plus+Jakarta+Sans:wght@600..800&display=swap" rel="stylesheet">
```
with:
```
<!-- Fonts: the Android app carries its own copy (vendor/fonts.css), so it shows the same letters with no internet;
     the web site loads them from Google Fonts as before. -->
<script id="fontPick">(function(){
 var app=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
 document.write(app?'<link href="vendor/fonts.css" rel="stylesheet">'
  :'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  +'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=Plus+Jakarta+Sans:wght@600..800&display=swap" rel="stylesheet">');
})();</script>
```

### E2 IS_APP and the web site address
Goals: F1, F2, F3, F4, F5. one flag says whether the page runs inside the Android app (Capacitor); everything app-specific asks it. Proven by mutation(s) M1, M11.
File: `index.html`. Replaces:
```
<script>
/* ================= SEED DATA ================= */
```
with:
```
<script>
/* ================= ANDROID APP (Capacitor) =================
   The same page also runs packaged inside the Android app, where it opens with no internet and syncs when there is
   signal. IS_APP is true only there; the few places that differ (libraries, fonts, WhatsApp, printing, email links)
   ask it. APP_SITE is the web address: sign-up and password emails must link there, not to the app. */
const IS_APP=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
const APP_SITE='https://winter-bonus-626a.ndlovufanelesibonge8.workers.dev/';

/* ================= SEED DATA ================= */
```

### E3 loadScript loads the bundled copy inside the app
Goals: F1. the three libraries come from CDNs; inside the app they load from vendor/, and the same SRI hash still has to match. Proven by mutation(s) M2.
File: `index.html`. Replaces:
```
function loadScript(src){return _scripts[src]||(_scripts[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;
```
with:
```
function loadScript(src){return _scripts[src]||(_scripts[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=appCopyOf(src);
```

### E4 APP_LIB: where each library lives inside the app
Goals: F1. maps each pinned CDN address to its bundled copy; the web keeps the CDN address. Proven by mutation(s) M2.
File: `index.html`. Replaces:
```
 [QRJS]:'sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU',
};
const SYNC_KEY='newstart.cloud.v1';
```
with:
```
 [QRJS]:'sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU',
};
/* Inside the Android app the libraries are bundled (tools/build-app.js copies them and refuses any whose bytes do not
   match the hash above), so the app needs no internet to start. The integrity check still applies to the copy. */
const APP_LIB={[SB_LIB]:'vendor/supabase.min.js',[H5Q]:'vendor/html5-qrcode.min.js',[QRJS]:'vendor/qrcode.min.js'};
function appCopyOf(src){return IS_APP&&APP_LIB[src]||src;}
const SYNC_KEY='newstart.cloud.v1';
```

### E5 WhatsApp inside the app
Goals: F2. a wa.me link opened in a new window does nothing inside the app; it opens the WhatsApp app instead, or the share sheet when WhatsApp is not installed. Proven by mutation(s) M6, M7.
File: `index.html`. Replaces:
```
 const n=waNumber(a.phone),url=`https://wa.me/${n}?text=${encodeURIComponent(waMessage(a))}`;
 closeWhatsApp();
 toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');
```
with:
```
 const n=waNumber(a.phone),url=`https://wa.me/${n}?text=${encodeURIComponent(waMessage(a))}`;
 closeWhatsApp();
 if(IS_APP){sendWhatsAppInApp(n,waMessage(a));return;}
 toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');
```

### E6 sendWhatsAppInApp
Goals: F2. the app-side sender: whatsapp:// through the AppLauncher plugin (WhatsApp sends once there is signal), else the Share plugin. Proven by mutation(s) M6, M7.
File: `index.html`. Replaces:
```
 document.body.appendChild(link);link.click();link.remove();
}
```
with:
```
 document.body.appendChild(link);link.click();link.remove();
}
/* Android app: straight into the WhatsApp app with the message ready (it goes once the phone has signal). Without
   WhatsApp on the phone, the phone's own share sheet offers SMS, email and the rest. */
async function sendWhatsAppInApp(n,msg){
 const P=window.Capacitor.Plugins;
 let opened=false;
 try{const r=await P.AppLauncher.openUrl({url:`whatsapp://send?${n?`phone=${n}&`:''}text=${encodeURIComponent(msg)}`});opened=!!(r&&r.completed);}catch(e){}
 if(opened){toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');return;}
 toast('WhatsApp is not on this phone — choose another way to send');
 try{await P.Share.share({text:msg});}catch(e){}
}
```

### E7 printCard inside the app
Goals: F3. window.print() does not exist in an Android app; the card goes to the phone's print service as an A6 page instead. Proven by mutation(s) M8, M9.
File: `index.html`. Replaces:
```
 await ensureQrLib();
 buildPrintCard();
 document.body.classList.add('print-mode');
 window.print();
}
```
with:
```
 await ensureQrLib();
 buildPrintCard();
 if(IS_APP){printCardInApp();return;}
 document.body.classList.add('print-mode');
 window.print();
}
/* Android app: the card (with only its own .pc-* styles) goes to the CardPrinter plugin, which prints it through the
   phone's print service on an A6 page. The QR code is drawn on a canvas, which does not survive copying the HTML, so
   it travels as a picture. */
function printCardInApp(){
 const pa=$('#printArea');
 pa.querySelectorAll('.pc-qr').forEach(q=>{const c=q.querySelector('canvas');if(!c||!c.toDataURL)return;
  try{const u=c.toDataURL('image/png');q.innerHTML='';const i=document.createElement('img');i.src=u;i.alt='';q.appendChild(i);}catch(e){}});
 const css=[...(document.styleSheets||[])].flatMap(s=>{try{return [...s.cssRules];}catch(e){return [];}})
  .filter(r=>r.selectorText&&r.selectorText.includes('.pc-')).map(r=>r.cssText).join('\n');
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:105mm 148mm;margin:0}html,body{margin:0;background:#fff}${css}</style></head><body>${pa.innerHTML}</body></html>`;
 const P=window.Capacitor.Plugins.CardPrinter;
 if(!P){toast('Printing is not available in this version of the app');return;}
 P.print({html,name:'Health Expo card '+A().id}).catch(e=>toast('Could not open printing: '+(e&&e.message||e)));
}
```

### E8 no "install" steps inside the app
Goals: F4. the install block tells iPhone users to Add to Home Screen; inside an app that is wrong. Proven by mutation(s) M5.
File: `index.html`. Replaces:
```
function installBlock(){
 if(isStandalone())
```
with:
```
function installBlock(){
 if(IS_APP)return '';
 if(isStandalone())
```

### E9 no service worker inside the app
Goals: F1. the app already carries every file; a service worker there would only keep stale copies. Proven by mutation(s) M4.
File: `index.html`. Replaces:
```
if('serviceWorker' in navigator&&(location.protocol==='https:'
```
with:
```
if(!IS_APP&&'serviceWorker' in navigator&&(location.protocol==='https:'
```

### E10 email links go to the web site from the app
Goals: F4. inside the app location.origin is the app's internal address (https://localhost), which no email link can open. Proven by mutation(s) M3.
File: `index.html`. Replaces:
```
const authRedirect=()=>/^https?:$/.test(location.protocol)?location.origin+location.pathname:undefined;
```
with:
```
const authRedirect=()=>IS_APP?APP_SITE:/^https?:$/.test(location.protocol)?location.origin+location.pathname:undefined;
```

### E11 harness: boot the page as the Android app and check every app behaviour
Goals: F6, F5. proves E1 to E10 with a stand-in Capacitor, and that the web page is not affected.
File: `.smoke/harness.js`. Replaces:
```
(async () => {
  console.log('\n17. Cloud sync (fake Supabase)');
```
with:
```
(async () => {
  /* ---- 16b. the Android app (Capacitor): the same page, booted as the app ----
     Placed before the service-worker tests so it runs even when a later section stops the harness. */
  console.log('\n16b. Android app (Capacitor)');
  {
    const opened = [], shared = [], printed = [], swRegistered = [];
    let whatsappInstalled = true;
    const Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        AppLauncher: { openUrl: async o => { opened.push(o.url); return { completed: whatsappInstalled }; } },
        Share: { share: async o => { shared.push(o.text); return {}; } },
        CardPrinter: { print: async o => { printed.push(o.html); return {}; } },
      },
    };
    /* the app gets its own storage, so its saves can never change what the web checks after it see */
    const appMem = new Map();
    const appStore = { getItem: k => (appMem.has(k) ? appMem.get(k) : null), setItem: (k, v) => appMem.set(k, String(v)), removeItem: k => appMem.delete(k) };
    const head = makeEl('app-head');
    const appDoc = { ...document, head, body: makeEl('app-body'), createElement: () => makeEl('created') };
    function QRCode() {} QRCode.CorrectLevel = { L: 1 };
    const appBox = {
      ...sandbox, document: appDoc, Capacitor, QRCode, __A: undefined, localStorage: appStore,
      print: () => { throw new Error('window.print does not exist inside the Android app'); },
      location: { href: 'https://localhost/', protocol: 'https:', origin: 'https://localhost', pathname: '/', hostname: 'localhost' },
      navigator: { ...sandbox.navigator, userAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
        serviceWorker: { register: u => { swRegistered.push(u); return Promise.resolve(); } } },
      addEventListener: (ev, fn) => { if (ev === 'load') fn(); },
    };
    appBox.window = appBox; appBox.globalThis = appBox;
    vm.createContext(appBox);
    let booted = true;
    try {
      vm.runInContext(body + '\n;globalThis.__A={IS_APP:typeof IS_APP!=="undefined"?IS_APP:undefined,loadScript,authRedirect,installBlock,' +
        'sendWhatsApp,printCard,waMessage,waNumber,attendees,state,SB_LIB,H5Q,QRJS,SRI};', appBox, { filename: 'app-mode.js' });
    } catch (e) { booted = false; console.log('APP BOOT THREW: ' + e.stack); }
    const A = appBox.__A || {};
    const tick = () => new Promise(r => setTimeout(r, 0));
    ok('app: the page boots as the Android app', booted && A.IS_APP === true);
    ok('web: the page does not think it is the app', vm.runInContext('typeof IS_APP!=="undefined"&&IS_APP===false', sandbox) === true);
    ok('web: the libraries still load from their pinned CDN addresses', vm.runInContext('typeof appCopyOf==="function"&&appCopyOf(SB_LIB)===SB_LIB&&appCopyOf(H5Q)===H5Q&&appCopyOf(QRJS)===QRJS', sandbox) === true);

    let srcs = [], sbEl = {};
    if (booted) {
      A.loadScript(A.SB_LIB).catch(() => {}); A.loadScript(A.H5Q).catch(() => {}); A.loadScript(A.QRJS).catch(() => {});
      srcs = head.children.map(c => c.src);
      sbEl = head.children.find(c => c.src === 'vendor/supabase.min.js') || {};
    }
    ok('app: the sign-in library loads from the copy inside the app, with the same integrity check', !!A.SRI && sbEl.integrity === A.SRI[A.SB_LIB]);
    ok('app: the scanner and QR libraries load from the copies inside the app', srcs.includes('vendor/html5-qrcode.min.js') && srcs.includes('vendor/qrcode.min.js') && !srcs.some(s => /^https:/.test(s)));
    ok('app: sign-up and password emails link back to the web site, not to the app', booted && A.authRedirect() === 'https://winter-bonus-626a.ndlovufanelesibonge8.workers.dev/');
    ok('app: no service worker is registered inside the app', booted && swRegistered.length === 0);
    appBox.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
    ok('app: no "Add to Home Screen" steps are shown inside the app', booted && A.installBlock() === '');

    let msg = '', num = '';
    if (booted) {
      const a0 = A.attendees[0]; A.state.activeId = a0.id; A.state.sugFor = null;
      msg = A.waMessage(a0); num = A.waNumber(a0.phone);
      A.sendWhatsApp(); await tick(); await tick();
    }
    ok('app: WhatsApp opens the WhatsApp app with the message ready', opened.length === 1 && opened[0] === 'whatsapp://send?phone=' + num + '&text=' + encodeURIComponent(msg) && shared.length === 0);
    whatsappInstalled = false;
    if (booted) { A.sendWhatsApp(); await tick(); await tick(); }
    ok('app: without WhatsApp on the phone, the message goes to the share sheet', opened.length === 2 && shared.length === 1 && shared[0] === msg);

    let printThrew = false;
    if (booted) { try { await A.printCard(); await tick(); } catch (e) { printThrew = true; } }
    ok('app: the take-home card goes to the phone\'s print service as an A6 page', booted && !printThrew && printed.length === 1 &&
      printed[0].includes('@page{size:105mm 148mm') && printed[0].includes('Never stop prescribed pills suddenly'));

    const pick = (html.match(/<script id="fontPick">([\s\S]*?)<\/script>/) || [])[1];
    const fontsFor = win => { let out = ''; vm.runInNewContext(pick || 'throw new Error("no fontPick")', { window: win, document: { write: s => { out += s; } } }); return out; };
    let appFonts = '', webFonts = '';
    try { appFonts = fontsFor({ Capacitor }); webFonts = fontsFor({}); } catch (e) { }
    ok('fonts: the app uses its own copy, the web site Google Fonts', /href="vendor\/fonts\.css"/.test(appFonts) && !/googleapis/.test(appFonts) &&
      /fonts\.googleapis\.com\/css2\?family=Inter/.test(webFonts) && !/vendor\//.test(webFonts));
  }

  console.log('\n17. Cloud sync (fake Supabase)');
```

No other code changes: the four invariants above are checked by the gate.

## 7. Measured facts
- Baseline: 121 files (re-measured after the first real `gate pre` stopped on 3 files of the older `fix-plan/` folder that the first baseline copy had left out). Changed by the dry run: `.smoke/harness.js`, `dist/index.html`, `dist/sw.js`, `index.html`.
- Harness before: 427 PASS / 0 FAIL (433 results, exit 1). After: 439 PASS / 0 FAIL (445 results, exit 1). Exit 1 both times is the pre-existing service-worker crash (section 1).
- Six existing speed tests are listed as flaky (their result depends on machine load; the gate checks they exist, not their status).
- Anchors (measured on the pristine copy):
  - `index.html:19` ×1: `family=Inter:wght@400..800&family=Plus+Jakarta+Sans`
  - `index.html:1071` ×1: `/* ================= SEED DATA ================= */`
  - `index.html:2738` ×1: `function loadScript(src)`
  - `index.html:3723` ×1: `function sendWhatsApp()`
  - `index.html:3729` ×1: `link.target='_blank'`
  - `index.html:3795` ×1: `async function printCard()`
  - `index.html:3800` ×1: ` window.print();`
  - `index.html:3913` ×1: `const SYNC_KEY=`
  - `index.html:4030` ×1: `function installBlock()`
  - `index.html:4036` ×1: `if('serviceWorker' in navigator`
  - `index.html:4081` ×1: `const authRedirect=`
  - `.smoke/harness.js:696` ×1: `console.log('\n17. Cloud sync (fake Supabase)');`
- Dry-run gate: `RESULT: PASS  (27/27 checks passed, mode=pre)` and `RESULT: PASS  (35/35 checks passed, mode=post)`, all 11 mutations caught.
- Scope report: `SCOPE VERDICT: READY  (11 edit(s) pending, 0 already applied)` on pristine; `ALREADY APPLIED` on the dry run.
- Tamper test (run alone):
```
  OK    control must PASS -> RESULT: PASS  (35/35 checks passed, mode=post)
  OK    plan never applied (pristine copy) -> RESULT: FAIL  (17/25 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, d,
  OK    a stray file was added -> RESULT: FAIL  (23/25 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, d, S2  no file
  OK    edited file drifted by one byte: index.html -> RESULT: FAIL  (23/25 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to
  OK    edited file drifted by one byte: .smoke/harness.js -> RESULT: FAIL  (24/25 checks passed, mode=post)   caught by: X-.smoke/harness.js  .smoke/harness.js
  OK    an out-of-scope file was changed: .cursor/settings.json -> RESULT: FAIL  (23/25 checks passed, mode=post)   caught by: S1  exactly these files changed: 
  OK    generated file left stale: dist/index.html -> RESULT: FAIL  (22/25 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harnes
  OK    generated file left stale: dist/sw.js -> RESULT: FAIL  (22/25 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js,
  OK    half-applied: edit "E1 fonts: bundled copy in the app, Google Fonts on the web" undone -> RESULT: FAIL  (19/25 checks passed, mode=post)   caught by: X-
TAMPER-TEST: PASS  (control passed; 8 tampers)
```
- Bundled files, each checked in this session: `supabase.min.js` 111,088 bytes, `html5-qrcode.min.js` 375,364 bytes and `qrcode.min.js` 19,927 bytes, each matching the SRI hash pinned in `index.html`; 4 font files (latin and latin-ext of Inter and Plus Jakarta Sans), 182,664 bytes in total. Licences: MIT (supabase-js, npm), Apache-2.0 (html5-qrcode, npm), MIT (qrcodejs, cdnjs API), OFL (both fonts, google/fonts METADATA.pb).
- Toolchain: Capacitor 8.5.3 (published 2026-10-07) uses Gradle 8.14.3 and Java 21 (`JavaVersion.VERSION_21` in its Android code); this PC had JDK 17 and Android Studio's Java 25. Portable Temurin JDK 21.0.12.1 installed in `%LOCALAPPDATA%expo-build-toolsjdk-21`; zip 205,073,461 bytes, SHA-256 matched Adoptium's published value.
- `@capacitor/app-launcher` 8.0.1 `openUrl` on Android resolves `{completed:false}` when no app can open the link (read in its source), which is what the WhatsApp fallback checks.

## 8. Not measured (so not claimed)
- Whether `window.Capacitor` exists when `<head>` runs inside Capacitor 8 on a real device (the font choice depends on it):
  checked on the emulator in step 8, not before.
- Android 12+ shows its own splash style; whether the current app's splash image looks identical: not checked.
- Whether WebView `localStorage` (the app's offline copy) can be cleared by Android under storage pressure: not investigated.
- Sync between two phones: step 8 checks one emulator against Supabase only.
- The iPhone app: not built (decided: later).
- The pre-existing harness crash (section 1): not fixed by this plan.

## 9. Execution report (only these statements are allowed)
1. The section 4 scope analysis, with the SCOPE VERDICT line verbatim.
2. Both `RESULT:` lines and both report paths with their hashes.
3. The S1 line (files changed) and the H1 line (test tally).
4. Steps 5–8: the commands' own output. Anything not run: "not run".

## 10. Execution result (2026-10-23)
- Section 4 scope analysis presented before running; `SCOPE VERDICT: READY  (11 edit(s) pending, 0 already applied)`.
- First real `gate pre` stopped: `[FAIL] B1 … added: fix-plan/apply.js, fix-plan/expected.json, fix-plan/gate.js` (the
  first baseline copy had left out the older `fix-plan/` folder). Nothing was applied. Re-planned per the rules: the
  folder was added to both copies, `make-expected.js`, gate pre/post (dry run) and the tamper test re-run, and the pin in
  rule 6 updated to the new `expected.json`.
- `node fix-plan-capacitor/gate.js pre` → `RESULT: PASS  (27/27 checks passed, mode=pre)`.
- `node fix-plan-capacitor/apply.js .` → `applied 11 edits to 2 files`; `node tools/build.js` → `built dist/ (cache version 74952dd599)`.
- `node fix-plan-capacitor/gate.js post` → `RESULT: PASS  (35/35 checks passed, mode=post)`;
  `[PASS] S1  exactly these files changed: .smoke/harness.js, dist/index.html, dist/sw.js, index.html`;
  `[PASS] H1  tests: 445 results and at least 439 PASS`; MUT-M1 … MUT-M11 all PASS (caught).
- Step 5: `node tools/build-app.js` → `built capacitor/www/ (15 files; libraries checked against index.html's integrity hashes)`.
  Negative check on a scratch copy: one byte added to `vendor/qrcode.min.js` → `NOT built: vendor/qrcode.min.js does not
  match the pinned hash …`, exit 1.
- Step 6: `tools/sign-app.ps1` → `BUILD SUCCESSFUL in 2m 24s`, `Verifies`, `capacitor\android\app-release-signed.apk  4 013 906 bytes`.
  Two script faults fixed on the way: `npx cap` not found from PowerShell (now calls the Capacitor CLI by path), and a
  `'\'` collapsed to `'\'` when the script was first written through the shell.
- Step 7: certificate SHA-256 `16f97c41caecaa0e6dbe21795a7d95fa7ef6abd486dd1f289239e5d2b74431d1` for both the new APK and
  `android/app-release-signed.apk`; `package: name='org.newstart.expopassport' versionCode='4' versionName='1.1.0'`;
  permissions INTERNET and CAMERA.
- Step 8 (emulator `ctv390`, airplane mode on):
  - `adb install -r` over the installed app: versionCode 2 / 1.0.1 → 4 / 1.1.0. Cold start 2955 ms, later 889 ms.
  - First launch offline showed the staff sign-in in the bundled fonts; the sign-in form (not "connecting") means the
    bundled Supabase library loaded with no network (`gateState`, `index.html:4099`).
  - Practice mode: Home, Results and Send home render; print opened Android's print service with
    `Paper size: ISO A6` and the full card with its QR code; "Send in WhatsApp" opened the share sheet
    (`Sharing text`), WhatsApp not being installed.
  - Practice mode is not remembered after a restart; the same is true on the web (`cloud.demo` is in memory only,
    `index.html:4238`).
  - Supabase answers a CORS preflight from origin `https://localhost` with `Access-Control-Allow-Origin: *` on
    `auth/v1/token` and `rest/v1/attendees`.
- **Not run:** a real staff sign-in and sync (needs real credentials, which must be entered by a person); two phones
  syncing; badge scanning with the camera; iPhone.
