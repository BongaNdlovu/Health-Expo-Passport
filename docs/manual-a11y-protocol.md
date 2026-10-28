# Manual accessibility protocol — screen reader & keyboard

**Why this exists:** axe covers automated WCAG A/AA on 58 screen/state × theme combinations plus the
print card, but it cannot hear a screen reader, judge announcement order, or operate a real keyboard.
This protocol closes that gap. It is for a human tester; it is not a replacement for the automated
suite, and the automated suite is not a replacement for it.

## Tools

| Platform | Required |
|---|---|
| Windows | NVDA (latest) + Chrome or Firefox, keyboard only, 100% and 200% zoom |
| Android | TalkBack + the **signed release APK** (see build below) |
| Optional | VoiceOver + Safari on iOS for the installed PWA |

Use the demo sandbox or a **staging** account. Do not use production visitor data.

## Build / install the Android APK

```powershell
node tools/build.js
node tools/build-app.js
cd capacitor; npx cap sync android; cd ..
powershell -File tools/sign-app.ps1
adb install -r capacitor/android/app-release-signed.apk
```

Enable TalkBack (Settings → Accessibility → TalkBack) before launching.

## Flows to test

For each flow record: **name/role/state announced**, **reading order**, **focus order**, **visible
focus**, **announcements**, **keyboard reachability**, **errors**, and **no trap without Escape**.

1. **Sign-in gate** — tab to email/password/Show/Sign in/sandbox tiles; submit empty, invalid and
   offline; hear the error; confirm the app behind is not reachable.
2. **Home** — staff pill, theme, cloud, bell, three vitals tiles, Continue, visitor rows, sheet
   plus/down, dock. Confirm the visitor name/ID and every action are spoken once, with no unlabeled
   icon buttons.
3. **Visitor switcher** — open, search, switch Visitor/Volunteers, close with Escape; focus returns to
   the opener.
4. **Journey** — Check, Results, Plan, Send: step labels/states, numeric steppers, medication Yes/No,
   chips, plan links, send rows, Finish. Confirm the step change is announced and the footer is
   reachable without scrolling traps.
5. **Queue / Care / Team / Profile** — station cards, Call next/Add, care rows, all four Team tabs,
   profile sign-in/out, password show/hide, destructive actions.
6. **Notifications, registration, cloud sign-in, account/church/admin** — open/close, errors, loading,
   member approve/role actions, destructive prompts.
7. **Print** — generate the A6 card; confirm the preview is reachable and labelled, then inspect the
   PDF.
8. **System settings** — 200% browser zoom, reduced motion, high contrast/forced colours; no clipped
   controls, no motion that cannot be paused, focus always visible.

## Keyboard-only script

- Tab through the full Home and journey without a mouse; every interactive element must be reachable.
- Enter/Space activate buttons and links; arrow keys work in native selects/radios.
- Escape closes every modal/sheet and returns focus to its opener.
- Tab must not leave an open modal and reach the page behind it.
- Focus ring must be visible on mint, white, amber, ruby and cobalt surfaces.
- No focusable element hidden behind the dock or the sticky journey footer.
- 200% zoom: no two-column overlap, no horizontal scroll on 320–390 px.

## Screen-reader script (NVDA / TalkBack)

- Start at the top of each screen; use heading/landmark navigation.
- Confirm the page title and main heading are announced.
- Confirm dynamic changes (step change, queue update, toast, error) are announced once, not on every
  keystroke.
- Confirm icon-only controls have names (`aria-label`) and state (`aria-pressed`, `aria-expanded`,
  `aria-current`).
- On errors, confirm focus stays in the form and the alert is spoken; the user can correct and retry.
- On the gate, confirm the background is inert and cannot be reached.

## Severity

| Level | Meaning |
|---|---|
| Blocker | A task cannot be completed with the screen reader/keyboard. |
| Major | Task possible but a control/state is unlabeled, unreachable, or an error is silent. |
| Minor | Order/verbosity/polish issue that does not block the task. |

## Results template

Copy `verification/manual-a11y-results.md` and fill one row per flow/platform. Attach the screen
recording or NVDA Speech Viewer log for every Blocker/Major.

Exit criteria: **zero Blockers and zero Majors** on the flows above; Minors triaged with an owner.
