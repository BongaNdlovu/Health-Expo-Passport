# MODULE_MAP — v1.6.2 security + multi-serve + checks port (source of the v43 test build)

The app ships as ES modules under `src/`, bundled by `tools/build.js` (esbuild IIFE `__NEWSTART`) into `dist/index.html`.
`tools/build-app.js` copies `dist/` into `capacitor/www/`. Never edit `dist/`, `capacitor/www/` or Android `assets/public` by hand.

## Boot order (index.html)
1. `<script id="fontPick">` inline (theme before first paint; hashed in the CSP).
2. `nsmem.js` — `window.NSMem`: memory helper (bounded caches, timers, `bump/release/every`). Diagnostics only when
   `NS_DEV_BUILD` is true; **false in source**, set true only by `NS_DEV_BUILD=1 node tools/build.js`.
3. `tutorial/tour.css`, `tutorial/tour.js` (defer) — `window.NSTour`, guided tour driven by `tutorial/steps.json` (31 steps).
4. `vendor/fonts.css` (no Google Fonts / CDN).
5. `<script id="secureStore">` inline — encrypts localStorage (AES-256-GCM; key from Android Keystore via SecureKey, or
   non-extractable WebCrypto key in IndexedDB), then calls `window.__bootApp()`.
6. App bundle (built): `window.__bootApp=function(){…__NEWSTART=(…)()}; if(window.__secureReady)window.__bootApp();`

CSP: `script-src 'self'` + hashes (fontPick, secureStore, bundle); `style-src 'self' 'unsafe-inline'`; `font-src 'self'`;
connect-src self + update site + the one Supabase project. supabase-js 2.118.0 from `vendor/` with SRI (src/cloud.js `SRI`).

## Modules changed in this port
| File | Change |
| --- | --- |
| src/queue.js | BP-first flow; multi-serve places (capacity 1–6 per station, place names, move ⇄, call to place, full-places toasts, TV "n of N"); queue history cap 150 + prune; demo queue persisted per device; "skip lines with readings in"; ask-to-queue after a reading; `seedDemoQueue()`; `qAfter()` hooks; esc() on data-args |
| src/results.js | Follow-up CSV rebuilt (all 8 checks, BP 2 columns, flags, units, SAST stamps), minimal (no-PII) mode, prayer CSV, XLSX export (no library; zip-store), CSV-injection-safe cells, shared `saveExport()` (native: private cache + share sheet) |
| src/visitor.js | One-at-a-time check flow (`tf*`), Enter → next check; memory diagnostics button; visitor search memo cache; resetDemo clears queue/demo state |
| src/help.js | Start-here help (HELP_START), help for the current screen (`openHelpHere`), tour start, help cache |
| src/account.js | Learn box for signed-out users; `nsAuthTimer(on)` session refresh timer (off in demo/signed-out, paused when hidden) |
| src/cloud.js | supabase-js from vendor/ + SRI; demo gate seeds the demo queue and offers the tour; SW registration works after load; clearer schema-error text |
| src/main.js | `__internals` exposed only when `NSMem.devBuild && !signed-in && !cloud mode`; otherwise a frozen minimal `__tourApi` for the tour |
| src/action-registry.js | Actions for tf flow, places, skip-filled, exports (CSV/minimal/prayer/XLSX), diagnostics, help-here, tour |
| src/shell.js, overlay.js, state.js | NSMem bump/release hooks; Escape closes help/queue pick; persist max-wait 2 s |
| src/feedback.js, customPlan.js, churchPlans.js, volunteer.js | 44 px targets; text; esc() on attributes |
| src/globals.d.ts | Types for NSMem, NSTour, __secureReady, __bootApp |
| index.html | Boot order above, v1.6.2 CSS, help button, gate help button, 44 px confirm button, text fixes, dev CSP |
| tools/build.js | Boot wrapper, inline-script hashes, CDN-free CSP, copies nsmem.js/tutorial/vendor to dist, NS_DEV_BUILD switch |
| tools/build-app.js | Also copies nsmem.js and tutorial/ into capacitor/www |
| sw.js | Precaches the new same-origin files; no CDN hosts; libs cache v4 |
| vendor/supabase.min.js | supabase-js 2.118.0 (sha384-UagCvVPT…dP5Tp) |
| Java | CardPrinterPlugin.saveDownload → SecureExport (private cache + share sheet, F-01); SecureKeyPlugin (Keystore-wrapped data key, F-02/F-06) registered in MainActivity |
| supabase/proposed/ | RLS proposal + tests + live-queue proposal — **PROPOSED / NOT APPLIED** |
