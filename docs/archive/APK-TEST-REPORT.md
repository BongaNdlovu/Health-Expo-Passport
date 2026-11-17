# newstart.apk — end-to-end test report

**Artifact:** `C:\Users\fanel\Downloads\Health Expo\dist\newstart.apk`
**Package:** `org.newstart.expopassport` · versionName 1.2.5 · versionCode 10 · minSdk 24 · targetSdk 36
**Signed:** v2 + v3 schemes valid · SHA-256 `16f97c41caecaa0e6dbe21795a7d95fa7ef6abd486dd1f289239e5d2b74431d1`
**Tested:** 27 Oct 2026 · Android 16 emulator (sdk_gphone64_x86_64) + Chrome against the APK's own extracted `assets/public`

---

## 1. Verdict

The app itself is in good shape: it installs, cold-starts with no network, captures a visitor offline, survives a restart, scans a badge with the live camera, and the whole screening → results → plan → food → care → send-home flow works with correct arithmetic and solid input validation.

**The APK you handed me is not built from the current code.** It is missing the consent, guardian, retention, survey and chronic-condition work that is in `dist/`. That is the one thing I would fix before shipping.

| Area | Result |
| --- | --- |
| Functions end-to-end | Working (40+ flows exercised) |
| Rate limits | No risk found |
| Memory leaks | One real, slow leak (detached nodes per render) |
| Security leaks | No exploitable leak found; APK has weaker CSP than the site |

---

## 2. The blocking issue: the APK is stale

| | APK | current `dist/` |
| --- | --- | --- |
| `index.html` | 487,594 B | 546,227 B |
| Named functions | 363 | 397 |
| `consent` occurrences | **0** | 54 |
| `guardian` | **0** | 26 |
| `retention` | **0** | 10 |
| `survey` | **0** | 13 |
| `optin` | **0** | 16 |
| `chronic` | **0** | 31 |
| inline `onclick=` attributes | 175 | 0 (action registry) |
| CSP `script-src` | `'unsafe-inline'` | two sha256 hashes only |

Missing functions include `consentCard`, `consentFields`, `recordConsent`, `readConsent`, `showGuardian`, `applyRetention`, `historyCard`, `pastVisitCard`, `openChurchData`, `adminDataHTML`, `adminPostHTML`, `scoreTiles`, `surveyCard`.

Why it matters: this app stores names, phone numbers, blood pressure, glucose, BMI and prayer notes. Anyone who installs `newstart.apk` today gets a build with **no consent capture and no guardian path**, while the website has both. For a health app handling minors, that is a compliance gap, not a cosmetic one.

**Fix:** rebuild and re-sign (`powershell -File tools\sign-app.ps1`), bump `versionCode`/`versionName`, then re-test. Everything below was run against the shipped bytes, so the findings still stand for 1.2.5.

---

## 3. Functions end-to-end

Run on the emulator (device behaviour) and in Chrome against the APK's extracted `assets/public` (the exact bundled JS). 54/60 scripted assertions passed; the 6 failures were harness selector mistakes, except where noted below.

**Verified working**
- Auth gate: sign-in, create account, forgot password, password rules (8–72 chars, letter + number), email regex, gate re-locks after restart.
- Practice mode opens offline with demo data and a clear "nothing is shared" banner.
- Registration: blocks empty name, age outside 12–105, missing sex, height outside 100–220, bad phone, bad email. Duplicate detection by name *and* by last-9 phone digits, with "Open EXPO-042" / "Register a new passport" choices. Auto badge allocation skips taken numbers (EXPO-124 next).
- Screening: 8 checks, BMI auto-calculated (94 kg / 174 cm → 31.0), out-of-range values refused with helpful text ("300 cannot be right (possible: 70–210)… Did you mean 4?"), progress counter 8/8.
- Results: health age 47.6 for a 41-year-old with those readings, ranked risk list, "what adds the most years", simulation sliders respond.
- Plan: 3 concrete actions with book citations; Food: 6 foods, prices sum correctly (R22.74/day × 21 = R477.54).
- Care lists sorted into urgent / nurse calls / interests; Export CSV produces 4 rows, quoted, and defuses spreadsheet formulas (`=HYPERLINK` → `'=HYPERLINK`, `@SUM` → `'@SUM`, `+27` phone numbers untouched).
- WhatsApp and email previews carry the plan text; take-home card builds with a QR (2 media nodes).
- Team: volunteer record, badge tiers correct (1 expo → Bronze, 3 → Silver, 6 → Gold, 10 → Platinum, 15 → Legend), expo log adds to history (+5 hrs), volunteer switcher lists 7 volunteers.
- Scanner: typed badge normalises `expo-42`/`042`/`QR:EXPO-042` → EXPO-042; unknown badge starts registration with the badge pre-filled; on-device live camera preview works and the scan opened the right visitor (EXPO-042).
- All six nav tabs, no console errors across the whole run.
- Offline on-device: airplane mode → force-stop → cold start renders; registered "Offline Test" EXPO-124 offline; after force-stop + relaunch the visitor is still in the list.

**Bugs**

1. **Volunteer pledge accepts a name with no mobile** (medium). The form marks *Mobile \** and the intro says "only a name and mobile are needed", but `saveVolunteer()` only checks the name. Result: a `prospect` volunteer with `phone: ""` who nobody can contact — visible afterwards as "2 pledges still need registration".
2. **`mailto:` percent-encodes the address** (low). `mailtoHref()` runs `encodeURIComponent(to)`, producing `mailto:thandi.test%40example.org?...`. Some mail clients do not decode `%40` in the address part and show a blank recipient. Encode only the subject/body. The body is also 5.7 KB, over the ~2 KB some clients accept — consider a short body plus the plan as a link or attachment.
3. **Missing phone is stored as `"+27 —"`** (low). `registerSubmit` writes `phone: phone || '+27 —'`, so the placeholder becomes real data and flows into the CSV.
4. **Invalid entry left in the field with no message** (low). Typing `-5` or `abc` into a screening input leaves the text visible and saves nothing, with no warning; out-of-range numbers do explain themselves, so this reads as a silent failure.
5. **`switchTab()` with an unknown key blanks the app** (info). `renderMain` does `view()` on `undefined`; not reachable from the UI since nav keys are fixed, but worth a guard.

---

## 4. Rate limits — no risk found

- **Practice mode makes zero network requests.** A full sweep of every screen plus a CSV export produced 0 resource entries. No telemetry, no analytics, no polling.
- Push is **single-flight** (`cloud.busy` + `again`), batches **100 rows** per request (`PUSH_BATCH=100`), falls back to per-row on batch failure.
- Retries are **bounded and superseded**: offline → one retry in 20 s, server error → one in 60 s, always `clearTimeout` first. No tight loop.
- 429s are handled with human messages ("Too many emails were sent just now. Wait a few minutes"), and `42501` / `PGRST205` produce actionable text instead of a retry storm.
- Only nit: retries are fixed-delay without jitter, so many desks reconnecting after an outage hit the API in sync. At expo scale (a handful of devices) this is fine.

Not testable without credentials: authenticated sync volume, realtime reconnect behaviour, church data pulls.

---

## 5. Memory leaks — one real leak

Measured with CDP `Performance` metrics against the APK's bundle, with a control page as a baseline.

| After | Nodes | Listeners | Heap |
| --- | --- | --- | --- |
| baseline | 13,449 | 778 | 1,549 KB |
| 160 tab switches | 43,944 | 2,383 | 1,680 KB |
| +60 more switches | 50,043 | 2,704 | 1,692 KB |

- **≈228 DOM nodes and ≈13 event listeners are retained per render** (`render()` → 3417 nodes / 15 calls).
- Growth is perfectly linear and **survives forced GC** (3 passes) and idle time.
- **Attached DOM stays flat** at 403 elements — the page does not bloat; the leak is detached subtrees (Chrome reports a retained detached `<section>` with the "Results" microlabels).
- Control: a page doing 40× `innerHTML` replacement of ~190 spans stays at 386 nodes / 190 listeners → this is not Blink bookkeeping.
- Heap cost ≈3 KB per render. 500 screen switches ≈ 114k nodes, ~1.5 MB heap plus per-node overhead — a slow degradation over a long expo day, on a mid-range phone, not an OOM.
- Device PSS: 96 MB fresh, 122–135 MB after heavy use, back to 96 MB after restart — consistent with this plus normal graphics cache.
- Camera is **not** leaked: `dumpsys media.camera` shows `DISCONNECT` immediately after the scan and `Active Camera Clients: []`.
- No leaked `setInterval`; `toast`/`scanLock`/`sync` timers are all cleared before re-arming.

Worth a heap-snapshot retainer walk before fixing. Cache the rendered subtree and update in place, or null out element refs and cancel pending rAF/transition work on the old tree.

---

## 6. Security

**Good**
- The publishable key cannot read data: `GET /rest/v1/attendees` → `42501 permission denied`, `volunteers` likewise. RLS/grants hold; no anon read of patient data.
- Only a `sb_publishable_…` key ships; no `service_role` and no JWT anywhere in the bundle.
- Stored XSS attempts fail: `<img src=x onerror=…>` and `<script>` in name/prayer never execute and render as text; 0 raw tags in the DOM.
- CSV formula injection is defused.
- Android: `allowBackup=false`, `fullBackupContent=false`, not debuggable (`run-as` refused), no `usesCleartextTraffic`, `webContentsDebuggingEnabled: false`, `allowMixedContent: false`, `androidScheme: https`. Only `MainActivity` is exported (launcher) — FileProvider is `exported=false`.
- No PII in logcat.
- WebView debugging is off, so the DOM is not reachable from a desktop — verified: no `webview_devtools_remote` socket.
- Storage buckets list empty; no IndexedDB, no caches.

**Weaknesses**
1. **The APK's CSP is weaker than the site's.** The site uses hash-based `script-src` and no inline handlers; the APK relies on 175 inline `onclick` attributes and therefore ships `script-src 'self' 'unsafe-inline'`. If an XSS ever lands, the APK has no second line of defence. Rebuilding from current source fixes this for free.
2. **PII sits in plaintext `localStorage`** under `newstart.passport.v2` (names, phones, BP, glucose, prayer notes). That is normal for a Capacitor app and the sandbox + `allowBackup=false` contain it, but a rooted or physically compromised phone exposes everything. Consider encrypting the store or not persisting prayer notes.
3. No CSP/security headers apply inside the APK (only the meta tag); acceptable since assets are local.
4. `Permissions-Policy: camera=(self)` on the site is fine; the APK requests CAMERA at runtime — correctly, only when the scanner opens.

---

## 7. Not covered

- Authenticated cloud sync, account/church admin, approvals (needs a staff login on their Supabase project).
- Multi-desk queue behaviour — in practice mode the queue is intentionally empty and not persisted.
- Real printing (Android print service) — the plugin is registered in `MainActivity` and present in `classes.dex`, but I did not send a job.
- Decoding a physical lanyard QR (the emulator camera shows a synthetic scene).
- iOS.
