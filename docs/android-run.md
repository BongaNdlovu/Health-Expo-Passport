# Android run — 2026-10-28

## Artifact

- Package: `org.newstart.expopassport`
- Build: signed release APK from `tools/sign-app.ps1`
- File: `capacitor/android/app-release-signed.apk` (also copied to `dist/newstart.apk`)
- Size: **3,464,372 bytes**
- Signature: APK Signature Scheme **v2 + v3**, certificate SHA-256
  `16f97c41caecaa0e6dbe21795a7d95fa7ef6abd486dd1f289239e5d2b74431d1`
- Web payload: the minified single-file page (`dist/index.html`, 501,379 bytes), CSP hashes intact
- Plugins: app-launcher 8.0.1, share 8.0.3, **status-bar 8.0.4** (new)
- Final rebuild: includes the self-contained dock pill and the volunteer “Viewing …” contrast fix;
  reinstalled and re-verified on the same AVD. This rebuild is byte-identical to the release
  `dist/index.html` (501,379 bytes), SHA-256 of the APK
  `8A058C27AFE711DED9F9C636BD04435122C30D8DF4B9CEEFDCE0C652C1E0FE43`.

## Device

- AVD: `Medium_Phone`, **Android 16** (API 36), 1080×2400, 420 dpi
- Installed with `adb install -r` → Success
- Launched via the launcher intent; process `org.newstart.expopassport/.MainActivity` resumed
- Logcat: no `Uncaught`, `SyntaxError`, `TypeError` or fatal WebView errors during boot/navigation

## Verified on-device

| Step | Result | Screenshot |
|---|---|---|
| Cold launch → Passport gate (light) | rendered, form usable | `verification/android/gate2.png`, `r9-gate.png` |
| Theme → Dark | gate and status bar switch | `verification/android/dark-status2.png`, `final.png` |
| Tap **3 demos** (sandbox) | demo mode entered, gate dismissed | `verification/android/home.png`, `r9-home.png` |
| Home (dark, real persisted visitor) | hero, tiles, red-flag banner, visitors sheet, dock | `verification/android/home-dark-final.png` |
| Tap **Queue** | queue station board | `verification/android/queue.png` |
| Tap **Team → Muster** | active pill, volunteer board, legible viewing strip | `verification/android/r9-muster.png` |
| Final byte-identical rebuild | dark gate, status-bar sync | `verification/android/r10-final.png` |

The status bar is now driven by `@capacitor/status-bar` from `setTheme()` / boot: dark theme → light
icons, light theme → dark icons. The gate makes `#app` `inert` so nothing behind it can be focused.

Cold start on the emulator is slow (~15–20 s to first paint after install); this is the emulator, not
measured on physical hardware.

## Not verified

- Physical Android device (only the emulator).
- Low-end performance profile / frame timing on hardware.
- Play Store packaging rules (versionCode bump, store listing).
- iOS (not part of this repository's current targets).
