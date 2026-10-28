# Accessibility audit — axe-core, 2026-10-28

## Method

`tools/axe-audit.ps1` builds a temporary, CSP-relaxed copy of `dist/index.html`, injects axe-core
(dev dependency, never shipped), renders one screen/theme in headless Chrome at 500×1000, and runs
`axe.run` with the tags `wcag2a` and `wcag2aa`. JSON results are written to `verification/axe/`.

```powershell
powershell -File tools/axe-audit.ps1 -Scenario home -Theme dark
```

## Result

**36 screen × theme combinations. 0 violations.**

| Screen | Light | Dark |
|---|---:|---:|
| Home | 0 | 0 |
| Sign-In gate (form) | 0 | 0 |
| Queue | 0 | 0 |
| Care | 0 | 0 |
| Team / volunteer hub | 0 | 0 |
| Team / Pledge | 0 | 0 |
| Team / Muster | 0 | 0 |
| Team / Booth | 0 | 0 |
| Team / Record | 0 | 0 |
| Profile | 0 | 0 |
| Journey / Check | 0 | 0 |
| Journey / Results | 0 | 0 |
| Journey / Plan | 0 | 0 |
| Journey / Send home | 0 | 0 |
| Visitor switcher | 0 | 0 |
| Notifications | 0 | 0 |
| Registration form | 0 | 0 |
| Food plan | 0 | 0 |

Earlier this run the audit found three real issues, now fixed:

1. **Active dock label, Care/Serve/Profile in dark** — the label sat over a separate sliding pill;
   axe saw it over the dock background (serious contrast). The mint gradient now lives on the active
   item itself, with dark ink text; the separate `#navPill` is retired.
2. **Queue “waiting” small text in dark** — hardcoded `#4f6870` on the dark card. Now uses
   `--hx-ink-2`.
3. **Volunteer “Viewing …” strip, Muster in dark** — brown/dark inline colours on the dark bar.
   Now `--hx-ink-2` / `--hx-ink`; Muster added to the audited matrix.
4. **Journey chrome, Plan/Send in dark** — header name, step labels, plan links, action titles and
   send rows used light-theme hex values. Replaced with tokens; Check/Results/Plan/Send added to the
   matrix (22 combinations).
5. **Team Pledge/Booth/Record microlabels and Profile links** — a late `html[data-theme] .microlabel`
   rule forced `--hx-ink-3`; `.tap-link` and `text-amber-600` were below 4.5:1. Now ink-2, mint-deep
   and a darker amber; all four Team sub-tabs are in the matrix (28 combinations).
6. **Visitor switcher active tab in dark** — `bg-white` with a dark teal label. Replaced with the
   token-backed `.sw-on` state; overlays (switcher, notifications, registration, food) added to the
   matrix (36 combinations).
7. **Input borders and dim text** — raised to the 3:1 UI-component and 4.5:1 text bars.

## Scope / limits

- Automated WCAG 2 A/AA only. It does not replace a manual keyboard, screen-reader or cognitive
  review; several axe “incomplete” contrast checks (gradients/overlays) are not manually resolved.
- The main tabs, gate, four Team sub-tabs, four journey steps and four common overlays were audited at
  one viewport (500×1000), in their default state. Account/church/admin sheets, queue picker, volunteer
  placement, cloud modal, TV mode and dynamic validation/error states are not in this matrix yet.
- Tap-target and focus checks are CSS-level (44 px hit areas, mint focus ring, gate `inert`), not
  re-measured by axe.
