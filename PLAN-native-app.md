# Plan: Health Expo Passport as a standalone React Native app

> **Superseded (2026-10-23).** Volunteers need shared data, so the app is now the web app packaged with Capacitor:
> see `FIX-PLAN-capacitor.md`. This plan stopped during M3; its code is in `mobile/` (not committed) for reference only.

**Mode:** light (design plan). The gated-fix-plan toolkit edits existing files with exact find/replace and cannot
create new files; this rewrite is almost all new files. Each milestone below gets its own concrete task list and
verification when it is built.

**Status:** M1 and M2 done (2026-10-23). M3 not started.

---

## 1. Goal

Rebuild the app so it **installs and runs with no internet at all**, on Android now and iPhone later, from one
React Native (Expo) codebase. All data stays on the phone.

### Where it stands today (sourced)

| Fact | Source |
| --- | --- |
| The Android app is a Trusted Web Activity that opens `winter-bonus-626a.ndlovufanelesibonge8.workers.dev` | `android/twa-manifest.json` (`host`, `fallbackType: "webview"`) |
| Package `org.newstart.expopassport`, version 1.0.2 / code 3, key `./signing/newstart.jks` alias `newstart` | `android/twa-manifest.json` |
| The whole app is one file: `index.html`, 5,558 lines | `grep -c ""` this session |
| Data model on the server: 8 tables (staff, attendees, volunteers, queue_entries, audit_log, platform_admins, churches, memberships) | `supabase/schema.sql` |
| Libraries loaded from CDNs: supabase-js 2.45.4, html5-qrcode 2.3.8, qrcodejs 1.0.0 | `sw.js` `LIB_URLS` |
| Bottom tabs: Home, Visitor, Queue, Care, Team, Profile | `index.html:1789-1796` |
| Visitor journey: Check → Results → Plan → Send home | `index.html:1786-1787` |
| Five plans: `bp`, `sugar`, `bmi`, `sleep`, `mind` | `index.html:1222, 1258, 1290, 1323, 1357` |
| Plan matching: `planNeeds()` | `index.html:2413-2430` |
| On this PC: Node v24.5.0, npm 11.5.1, JDK 17, Android SDK platforms 36 and 37.0, build-tools 35.0.0 and 36.0.0, NDK 27.1.12297006 | commands this session |

### Decisions you made (this conversation)

- React Native with Expo (rather than Kotlin, Flutter or Capacitor).
- Each phone is self-contained; visitors and volunteers move between phones by **QR code or file**, with no internet.
- A **local PIN** replaces online sign-in. Multi-church, platform-admin and server audit features are dropped.
- The new Android app **replaces** the current one: same package name and signing key.
- **Android first, iPhone later.** The code stays cross-platform; only Android is built and shipped now.

---

## 2. Scope

### Kept (ported from `index.html`)

| Area | Source functions (`index.html`) |
| --- | --- |
| Health logic: categories, health age, projection, BMI, BP stage, plan matching, problem text, urgent rule, plan builder | `cat` 1612, `factorsOf` 1627, `healthAge` 1639, `simBP` 1646, `projection` 1654, `autoProtocol` 1667, `bpStage` 2405, `planNeeds` 2413, `problemOf` 2435, `urgentOf` 2455, `planFor` 2461 |
| Content: stations, interests, booths, badge tiers, plans, book references, help line, food reasons | `STATION_DEFS` 1093, `INT` 1102, `BOOTHS` 1114, `BADGE_TIERS` 1143, `BOOK_REF`… 1216-1219, `HELP_LINE` 1220, `PROTOCOLS` 1221, `FOOD_WHY` 1407 |
| Home | `viewHome` 1940 |
| Visitor register, list, switch | `registerSubmit` 2075, `visitorListHTML` 2058, `openSwitcher` 3557 |
| Check (screening by station) | `viewScreen` 2126, `stationPicker` 2183, `followUpCard` 2190 |
| Results with the what-if sliders | `viewResults` 2298, `simSlider` 2374 |
| Plan and Food | `viewPlan` 2470, `viewFood` 2596 |
| Send home: WhatsApp message, printed card | `viewSend` 1887, `waMessage` 3694, `buildPrintCard` 3745 |
| Care list (urgent first) | `viewCare` 2652 |
| Queue, on this phone only, including the big-screen view | `viewQueue` 5523, `renderBigScreen` 5456 (local parts only) |
| Team: pledge, muster, booths, records, register, badges | `viewVolPledge` 2950 … `viewVolRegister` 3358, `badgeTier` 2844 |
| Lanyard QR scan and badge parsing | `openScanner` 2745, `parseBadge` 2813 |
| CSV export | `exportCSV` 2709, `exportVolCSV` 3512 |
| Profile, as a local profile: PIN change, erase this phone's data | `viewProfile` 4717 (local parts) |

### Dropped (needs a server)

Cloud sign-in and password flows (`renderGate` 4090 … `cloudNewPassword` 4251), staff approvals (4271-4288),
the cloud health panel (4345-4402), accounts, churches, members, platform and audit (4448-4947), sync and realtime
(`cloudInit` 4950 … `cloudRefresh` 5219), queue realtime (5387), PWA install (4016-4030), and the service worker.

### New

- On-device SQLite database.
- 4–6 digit PIN lock.
- Phone-to-phone transfer: export and import of visitors and volunteers as a file, and as QR codes for small batches.
- A one-time demo seed, replacing `seedDemo` 1772.

### Not in scope

The iPhone build and App Store release, Play Store listing changes, moving data off phones that run the current app,
and any change to the current web app or the Cloudflare site.

---

## 3. Architecture

| Part | Choice |
| --- | --- |
| Framework | Expo, TypeScript, Expo Router (tabs plus the journey stack) |
| Database | `expo-sqlite`, with tables `visitors`, `volunteers`, `volunteer_history`, `queue_entries`, `settings` |
| Health logic | `src/logic/`: pure TypeScript with no React, ported function by function from `index.html` |
| QR scan | `expo-camera` barcode scanning |
| QR show | `react-native-qrcode-svg` |
| Printed card | `expo-print` (builds a PDF on the phone) |
| CSV and transfer files | `expo-file-system` plus `expo-sharing` |
| PIN | Hashed PIN in `expo-secure-store` |
| WhatsApp | Opens WhatsApp with the message filled in. WhatsApp itself needs signal to deliver it; the app does not. |
| Android build | `expo prebuild` plus local Gradle, signed with `android/signing/newstart.jks` |
| Location in repo | A new `mobile/` folder. The current web app and `android/` stay untouched until you decide to retire them. |

The Android manifest leaves out the `INTERNET` permission, so the app physically cannot use the network.

---

## 4. Steps (milestones)

Each milestone ends with a check someone else can run, and a stop condition.

**M1. Walking skeleton**
- Create `mobile/` with Expo and TypeScript, six empty tabs, and an SQLite database that opens.
- Build a debug APK and install it on emulator `ctv390` with networking off.
- *Verify:* the app launches and every tab opens with networking disabled (screenshot); the merged manifest has no `INTERNET` permission (`aapt2 dump permissions`).
- *Stop if:* the Expo build fails on this PC's toolchain, or the `INTERNET` permission can't be removed.
- **Result (2026-10-23): passed.**
  - Versions, pinned exactly in `mobile/package.json`: Expo 58.0.17, React Native 0.88.0, React 19.3.0, expo-router 58.0.25, expo-sqlite 58.0.13. `react-dom` is pinned to 19.3.0 to fix an npm peer conflict. `npx expo-doctor`: 20/20 checks passed. `npx tsc --noEmit`: exit 0.
  - `aapt2 dump permissions` on the APK: no `android.permission.INTERNET`. It still lists READ/WRITE_EXTERNAL_STORAGE (maxSdk 32), SYSTEM_ALERT_WINDOW and VIBRATE from the Expo template; block them at M7.
  - On `ctv390` with airplane mode on (`airplane_mode_on=1`; ping to 8.8.8.8 got 100% loss), the APK installed. It cold-started in 1,610 ms the first time and 380 ms after a force-stop. Home showed "Database ready: passport.db, schema v1" both times. All six tabs opened (read with `uiautomator dump`), with the same process (pid 2680) and no AndroidRuntime errors.
  - **Build blocker found and fixed:** C++ build paths reach 322 characters. Windows long paths are on (`LongPathsEnabled=1`), but the SDK's CMake 3.22.1 ships ninja 1.10.2, which can't use them. `mobile/scripts/build-android.sh` points Gradle at a private CMake copy in `%LOCALAPPDATA%\expo-build-tools\cmake-3.22.1-ninja-1.13.2`, with ninja 1.13.2 from the official GitHub release (SHA-256 `07fc8261…dc65`, matching GitHub's published digest). The SDK is unchanged.
  - Build time: 5 m 33 s for `x86_64` only. APK size: 31,961,685 bytes.
  - **Temporary for M1–M6:** package `org.newstart.expopassport.preview`, debug-signed, so it installs next to the current app instead of over it. Tab icons are empty boxes until M3.
  - npm reports 15 high-severity audit warnings. Not investigated; review before M7 (never `npm audit fix --force`).

**M2. Health logic, ported and proven identical**
- Port the logic functions and content listed in §2 into `src/logic/`.
- Add tests that run the **original** functions (loaded from `index.html` in Node) and the ported ones on the same inputs: the seed visitors plus generated edge cases around every threshold. The outputs must be equal.
- *Verify:* the test command prints every case as passing; at least one deliberate change to a threshold makes a test fail (mutation check).
- *Stop if:* any output differs and the cause isn't a deliberate change you approved.
- **Result (2026-10-23): passed.**
  - **Content is copied mechanically, not retyped.** `mobile/tools/extract-content.js` boots the original script in a sandbox and serialises 24 constants into `mobile/src/logic/content.ts` (2,208 lines): the plans, actions, book references, help line, food reasons, prices, stations, booths, badge tiers and demo data. The three functions inside `ACTIONS` are emitted from their own source. The file records the sha256 of the `index.html` it came from, and a test fails if it is out of date (`npm run content` regenerates it).
  - **Logic ported by hand** into `src/logic/health.ts` (311 lines), `badges.ts`, `measures.ts` and `format.ts`, with the shared types in `types.ts`. Two deliberate differences: the sliders (`state.sim`) and the chosen plan are parameters, and `redFlag` returns a real boolean (the original returns any falsy value; every caller only tests truthiness).
  - **Comparison tests** (`npm test`): 34 tests, all passing, making 1,013,470 port-vs-original comparisons. Inputs: every reading at and either side of every threshold; BMI pinned to 18.5/25/30/35; the 3 demo visitors plus 20,000 seeded-random visitors; all 108 slider positions on 2,000 visitors; and 76 volunteers on and around every badge tier.
  - **Mutation check** (`npm run test:mutate`): 22/22 deliberate mistakes caught, covering thresholds, ranks, wording, the kcal formula, the help-line number, one shopping price, badge rules and name titles. Every file's sha256 was identical after the run. The first run caught 18/21; the 3 misses were fixed by adding test inputs (a volunteer exactly 1 hour short, names with every title) and a unique anchor for the help-line mutation.
  - `npx tsc --noEmit` exit 0, `npx expo-doctor` 20/20.
  - **For M3:** `PROTOCOLS.*.hydro` contains `<b>`/`<em>` HTML from the web app, so the Plan screen must render that markup natively. The weight plan's `hydro` is `null`.
  - **While both apps exist,** the tests read `../index.html`. If the web app is ever retired, freeze the content (stop running the extractor) and keep the comparison results as the baseline.

**M3. Visitor journey**
- Home, register, visitor list, Check, Results (sliders), Plan, Food and Send home, with WhatsApp and the printed card.
- *Verify:* on the emulator with networking off, a new visitor goes through all four steps, the card PDF opens, and data survives an app restart.

**M4. Care, Queue and lanyard scanning**
- *Verify:* a red-flag visitor shows first on Care; queue join and call-next work; scanning a QR shown on screen opens the right visitor.

**M5. Team section**
- *Verify:* pledge, register, booth assignment, record hours and badge tier match the web app for the seed volunteers (compare screenshots or values).

**M6. PIN, profile, transfer and CSV**
- *Verify:* the PIN lock appears on cold start; "erase this phone" clears all tables; an exported file imported on a second, clean install gives the same visitors (row counts and a content hash); CSV columns match `exportCSV`.

**M7. Signed release that replaces the current app**
- Release build signed with `newstart.jks`, package `org.newstart.expopassport`, version code above 3.
- *Verify:* `apksigner verify --print-certs` shows the same certificate as `android/app-release-signed.apk`; `adb install -r` over the current app succeeds; the full flow passes with networking off.
- *Stop if:* the signatures differ. Installing over the top would fail, and uninstalling first would wipe the current app's data.

---

## 5. Decisions still open (with recommendations)

| Decision | Options | Recommendation |
| --- | --- | --- |
| Expo SDK version | Latest stable at M1, or a pinned older one | Latest stable at M1, pinned exactly in `package.json` |
| Look and feel | Recreate the current glass look closely, or a cleaner native look in the same colours | Same colours and layout, native components. Exact glass effects cost a lot of time on Android. |
| Demo data on first launch | Seed the demo visitors and volunteers, or start empty | Start empty, with a "Load demo data" button on Profile |
| What happens to the TWA (`android/`) and the Cloudflare site | Keep both, or retire them after M7 | Keep until the native app has been used at one expo |

---

## 6. Risks

- **Health logic drift.** A wrong threshold gives wrong advice. M2's comparison against the original code is the guard.
- **Data on current phones is lost on upgrade.** The current app's data lives in Chrome's storage for the website; the new app cannot read it. If any phone holds real visitor data, export it (CSV) from the current app first.
- **Size of the job.** About 5,558 lines of web code become a multi-screen native app. No time estimate has been measured.

---

## 7. Not measured / not checked

- The current Expo SDK version, its supported Node and JDK versions, and whether it builds with JDK 17 on this PC.
- Whether the `index.html` functions can be loaded in Node without the page (M2 depends on this; the existing `.smoke/harness.js` may already do something similar, but I haven't read how).
- The uncommitted changes in `android/app/src/main/java/org/newstart/expopassport/LauncherActivity.java`, `android/app/build.gradle` and `tools/sign-apk.ps1`.
- Whether the certificate in `android/signing/newstart.jks` matches the one on phones that already have the app.
- EAS Build limits and Apple Developer fees (for the later iPhone step).
- How long each milestone will take.
- Whether any phone currently holds real visitor data.

---

## 8. Before execution

Whoever executes this plan first reads it in full, checks the facts in §1 still hold (the commands are named), and
presents the scope (what each milestone covers, what it entails, what it touches, and how it serves the goal) before
running anything. Milestones run in order; each must pass its check before the next starts.
