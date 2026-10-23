# Plan: intro animation, every screen size, quicker screens, no launch flash

**Status: executed.** Every number below was measured on the real files, a dry-run copy or the emulator in the session
that ran this plan. Toolkit: `fix-plan-ui/`. Ground truth for the change: `fix-plan-ui/edits.js`.

## 1. Goal
The user asked for a short intro animation (logo pulse, then content rises) in the app and on the web site, everything
sized correctly on phones and tablets, and quicker screens.

| # | Problem (measured before) | Cause | Fix |
|---|---|---|---|
| F1 | App launch showed a grey screen, then white, for about 2 s | Android 12+ splash had no colour or icon; the web view started white | E8, E9 |
| F2 | No intro | — | E5, E6, E7 |
| F3 | At 320 and 360 px wide the page laid out at 390 px, so it was cropped | The header row could not shrink | E1, E2, E3, E6 |
| F4 | Header under the status bar; tabs under the gesture bar (24 px, 32 px on tablet) | Android WebView returns 0 for `env(safe-area-inset-*)`; Capacitor sets `--safe-area-inset-*` instead | E1, E4 |
| F5 | Screens took up to 1.1 s to settle | Cards rose over 0.7 s with delays up to 0.41 s; progress bars filled over 1.1 s | E6 |

A disproven hypothesis is not in the plan: removing the background blur gave no measurable gain.

## 2. Scope
| Tier | Files | Changed only by |
|---|---|---|
| Edited | `index.html`, `.smoke/harness.js`, `capacitor/android/app/src/main/res/values/styles.xml`, `capacitor/capacitor.config.json` | `node fix-plan-ui/apply.js .` |
| Generated | `dist/index.html`, `dist/sw.js` | `node tools/build.js` |
| Plan tooling | this file, `fix-plan-ui/*` | — |

Invariants (byte-identical): the plans and food content, the health logic, plan matching, the Supabase sync code, `sw.js`.

## 3. Pins
- `fix-plan-ui/gate.js` sha256 `5cbff7e707d2bcc2166cbcbb23032da4fee1f4f194370446f155e5efe3187060`
- `fix-plan-ui/expected.json` sha256 `77a7c5e78d18c509b2d71ce5e96f36bc28ea093fb6ca88784b493eac91f39f35`

## 4. Steps
```bash
node fix-plan-ui/scope-report.js   # required: SCOPE VERDICT: READY
node fix-plan-ui/gate.js pre       # required: RESULT: PASS (28/28)
node fix-plan-ui/apply.js .        # applies E1-E10
node fix-plan-ui/gate.js post      # required: RESULT: PASS (39/39)
```

## 5. The edits
- **E1** header: `padding-top` clears the status bar (`--safe-area-inset-top`, then `env()`), classes `hdr-brand` / `hdr-tools`.
- **E2, E3** header title and tools classes, so the tools can shrink and the title hides below 440 px.
- **E4** bottom tabs: `padding-bottom` clears the gesture bar the same way.
- **E5** the intro logo is in the page itself, so it shows before any script runs.
- **E6** stylesheet: intro pop and one beat, the app rises in; reduced-motion users get no intro; header shrink rules;
  long names wrap to two lines on Home; cards arrive in 0.3 s with delays capped at 0.12 s; bars fill in 0.5 s.
- **E7** the intro leaves on its own (never holds the app back).
- **E8** Android launch screen in the app's colour `#F6F8F6` with the app icon.
- **E9** `capacitor.config.json` `backgroundColor` `#f6f8f6`, so the web view never starts white.
- **E10** harness section `16c` with 10 checks for all of the above.

## 6. Results
- Gate: pre `RESULT: PASS (28/28)`, post `RESULT: PASS (39/39)`. Mutations M1-M11 each made their test fail. Tamper
  test PASS (10 tampers). Harness: 596 checks, all passing.
- Emulator, release and debug builds of 1.1.0:
  - Launch: no grey or white flash; the splash is the app's colour with its logo.
  - Size audit at 320, 360, 390, 430 and 800 px with long test names: 50 of 50 screens fit the width and clear both bars.
  - Time until a screen has settled, ms, median of 3, full CPU (before → after): screen 1142 → 560, results 462 → 400,
    plan 650 → 434, care 463 → 388, serve 1137 → 564, home 494 → 424.
  - The same at 1/4 CPU: 1215 → 646, 516 → 466, 706 → 482, 525 → 440, 1196 → 608, 567 → 486.
  - Device checks: 32 of 32 offline (airplane mode, fresh install), 2 of 2 online.

## 7. Known limits (not fixed here)
- The intro times itself from page-load start. On the emulator the page paints late, so the intro is already fading by
  about 3.5 s and is seen only briefly. A fix would wait for the logo's own animations to finish.
- On phones narrower than 440 px the header shows the logo without the title text (a design choice).
- Not checked: a real phone or a real iPhone; the emulator only.
