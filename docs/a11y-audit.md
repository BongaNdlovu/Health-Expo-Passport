# Accessibility audit — axe-core, 2026-10-28

## Method

`tools/axe-audit.ps1` builds a temporary, CSP-relaxed copy of `dist/index.html`, injects axe-core
(dev dependency, never shipped), renders one screen/theme in headless Chrome at 500×1000, and runs
`axe.run` with the tags `wcag2a` and `wcag2aa`. JSON results are written to `verification/axe/`.

```powershell
powershell -File tools/axe-audit.ps1 -Scenario home -Theme dark
```

## Result

**14 screen × theme combinations. 0 violations.**

| Screen | Light | Dark |
|---|---:|---:|
| Home | 0 | 0 |
| Sign-In gate (form) | 0 | 0 |
| Queue | 0 | 0 |
| Care | 0 | 0 |
| Team / volunteer hub | 0 | 0 |
| Team / Muster | 0 | 0 |
| Profile | 0 | 0 |

Earlier this run the audit found three real issues, now fixed:

1. **Active dock label, Care/Serve/Profile in dark** — the label sat over a separate sliding pill;
   axe saw it over the dock background (serious contrast). The mint gradient now lives on the active
   item itself, with dark ink text; the separate `#navPill` is retired.
2. **Queue “waiting” small text in dark** — hardcoded `#4f6870` on the dark card. Now uses
   `--hx-ink-2`.
3. **Volunteer “Viewing …” strip, Muster in dark** — brown/dark inline colours on the dark bar.
   Now `--hx-ink-2` / `--hx-ink`; Muster added to the audited matrix.
4. **Input borders and dim text** — raised to the 3:1 UI-component and 4.5:1 text bars.

## Scope / limits

- Automated WCAG 2 A/AA only. It does not replace a manual keyboard, screen-reader or cognitive
  review; several axe “incomplete” contrast checks (gradients/overlays) are not manually resolved.
- Only the six main screens were audited, at one viewport (500×1000), in their default state.
  Modals, the journey tabs, and dynamic validation/error states are not covered by this matrix.
- Tap-target and focus checks are CSS-level (44 px hit areas, mint focus ring, gate `inert`), not
  re-measured by axe.
