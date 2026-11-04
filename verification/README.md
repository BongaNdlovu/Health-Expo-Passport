# UI verification tooling

Dev-only tools for the mockup rebuild. Nothing here ships in `dist/` or the APK.

## Capture an exact phone viewport

Chrome headless clamps its window to ~500 px, so the app is rendered inside an iframe of the requested width in a temporary wrapper. Only the **temporary copy** of `dist/index.html` gets a relaxed CSP; the real file is untouched.

```powershell
# demo home, light, exact 390x844
powershell -NoProfile -ExecutionPolicy Bypass -File tools/capture.ps1 `
  -Name home-390 -Width 390 -Height 844 -Theme light -Demo

# signed-out gate (current build)
powershell -NoProfile -ExecutionPolicy Bypass -File tools/capture.ps1 `
  -Name gate-390 -Width 390 -Height 844 -Theme light

# dark, animated (Freeze off) for motion inspection
powershell -NoProfile -ExecutionPolicy Bypass -File tools/capture.ps1 `
  -Name home-dark -Width 430 -Height 932 -Theme dark -Demo -Freeze:$false
```

Output defaults to `verification/shots/<name>.png`. `-Freeze` (default on) hides `#intro` and stops animations/transitions for a deterministic frame.

The script uses Windows PowerShell 5.1 (`powershell`, not `pwsh`) and Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe`.

## Compare two captures

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/visual-diff.ps1 `
  -A verification/baseline/home-390.png -B verification/shots/home-390.png -ThresholdPct 0.5
```

Exit 0 = within threshold, 1 = over, 2 = bad input. A red diff PNG is written to `verification/diffs/`.

## Enforce the performance budget

```powershell
node tools/ui-budget.js
```

Reads `verification/budget.json` (re-baselined 2026-11-04 to the current rebuild) and `dist/index.html`:

| Metric | Baseline | Limit |
|---|---:|---:|
| raw page bytes | 747,810 | +2% |
| CSS characters | 104,457 | +2% |
| inline JS characters | 615,076 | +2% |
| external origins | 7 allowlisted | 0 new |

The inline JS allowance was raised from +1% to +2% on 2026-11-04 for the admin pledge, deregister and block controls (+1.75% at the time). The release gate is +2% CSS. During the component build-out (Phases 2–6) the CSS is allowed to rise while legacy blocks still exist; Phase 7 must delete the superseded blocks and return under +2%. Page bytes and gzip are the binding runtime metrics at every phase.

## Baseline captures

`verification/baseline/` is the v1.2.8 + Phase 1.1 state, captured at exact widths with animations frozen:

- `baseline-gate-390.png` — offline gate ("Connecting…")
- `baseline-home-390.png`, `baseline-home-430.png` — demo home, light
- `baseline-home-390-dark.png` — demo home, dark (mostly unmigrated on purpose; shows the gap)

These are the before images for visual diffs during the screen migrations.
