# UI Contract — Health Expo Passport, "ECG" rebuild

**Status:** design-spec contract for the UI rebuild. Read-only analysis of the app; this file is the only artefact written.
**Baseline:** git tag `ui-baseline-1.2.8` (= `5404021`, light-only teal, single-file `index.html`, Capacitor + PWA, `max-w-md`).
**Design source:** `mockup_preview.html` (1,732 lines) + `mockup-review-dark.png` / `mockup-review-light.png` (1460×1120).
**Blueprint:** `master_frontend_ui_engineering_blueprint.md`, Phases 1, 4, 5, 7.

## 0. How to read the numbers

Every value below carries one tag:

| Tag | Meaning |
| :-- | :-- |
| **[M]** | Measured from `mockup-review-dark.png` / `mockup-review-light.png` by decoding the PNG and reading colour-transition coordinates. |
| **[C]** | Read directly from the mockup CSS/HTML at the cited line. |
| **[D]** | Derived by arithmetic from [M]/[C] (formula given). Not rendered, not measured. |
| **[I]** | Inference / judgement. Not verifiable from the files. |
| **[WC]** | Computed with the WCAG 2.x relative-luminance formula from the declared colours (formula given in §6.1). |

**Scale of the render.** The two renders are **1:1 CSS px**, not scaled. Three independent known-size anchors agree exactly: chassis 396 px wide (L315) → measured **396** (x 316–711 and 748–1143); screen 378 px (L315 minus 9 px padding, L317) → measured **378** (x 757–1134 at y=300 and y=600); Dynamic Island 114×31 (L346–348) → measured **114×31** (x 457–570, y 144–174). Declared surfaces also sample back byte-exact (`#0b0e0c` → `rgb(11,14,12)`, `#121614` → `rgb(18,22,20)`, `#f5f4ef` → `rgb(245,244,239)`), so the PNGs carry no colour-management shift. Measurement uncertainty is therefore **±1 px** from anti-aliasing only.

**Correction to the brief.** The brief says "phone content width is 396 px". That is the **chassis** width. The app screen is **378 px** [C: 396 − 2×9 padding] and the usable content column is **350 px** [C: 378 − 2×14 content padding; M: card x 340–687 = 348 + 2 borders]. Building to 396 px as a layout column would overshoot the reference by 46 px (13%) and break every horizontal proportion below. All derivations in §5 use **350 px**, not 396.

**App-side line citations are pinned to the baseline tag.** Every `index.html@1.2.8:N` / `src/*.js:N` reference is a line number at tag `ui-baseline-1.2.8`, not in the working tree — the working tree is being edited concurrently (during this analysis `index.html` changed from 101,299 to 102,307 bytes and had gained `--hx-*` tokens, which do not exist at the tag). Re-check any app citation against `git show ui-baseline-1.2.8:<path>` before acting on it.

---

## 1. Token table

The mockup has **no token names for mint, danger, or any gradient** — those are hard-coded literals at each use site. The "proposed var" column is this contract's naming; the "source" column is where the exact value is defined today. Any hex not listed here must not appear in the rebuild.

### 1.1 Surfaces

| Proposed var | Dark | Light | Source (mockup lines) | Notes |
| :-- | :-- | :-- | :-- | :-- |
| `--bg` (canvas) | `#0b0e0c` | `#f4f3ee` | L25 / L50 | Screen background. Not `--stage-bg` (L21–22, L46–47) — that is desktop studio chrome, excluded. |
| `--surface-hero` | `#121614` | `#ffffff` | L29 / L54 | Passport hero card. |
| `--surface-card` | `linear-gradient(180deg,#181a19 0%,#111312 100%)` | `#ffffff` | L41 / L66 | Named `--copper-banner`; used for the practice banner and the sign-in card. |
| `--sheet-bg` (ivory) | `linear-gradient(180deg,#f5f4ef 0%,#eeede6 100%)` | `#ffffff` | L36 / L61 | Light mode drops the cream tint — see §7 D-9. |
| `--sheet-ink` | `#141715` | `#141715` | L37 / L62 | Ivory sheet main text (same in both themes). |
| `--sheet-ink-sub` | `#585e57` | `#545b53` | L38 / L63 | Ivory sheet secondary text. |
| `--banner-bg` (wide) | `linear-gradient(155deg,#3d6e4a 0%,#2a5236 55%,#1c3d26 100%)` | same | L1015 | Wide expo banner. Not themed — same gradient both modes. |
| `--banner-line` | `rgba(255,255,255,0.15)` | same | L1016 | |

### 1.2 Text

| Proposed var | Dark | Light | Source | Use |
| :-- | :-- | :-- | :-- | :-- |
| `--ink` | `#f5f7f5` | `#141815` | L26 / L51 | Body + headings except on the ivory sheet. |
| `--ink-muted` | `rgba(245,247,245,0.72)` | `#4e5750` | L27 / L52 | Eyebrows, sub-copy, secondary labels. |
| `--ink-dim` | `rgba(245,247,245,0.45)` | `#7a857d` | L28 / L53 | Inactive dock labels today — **fails AA, see §6.3 F1/F9.** |

### 1.3 Accents

| Proposed var | Value | Source | Notes |
| :-- | :-- | :-- | :-- |
| `--mint` | `#34d375` | L549, L728, L753, L1132 | The one recurring mint. Never declared as a token. |
| `--mint-deep` | `#15803d` | L556, L575, L1221 | Light-mode ECG stroke, light beep line, avatar gradient end. |
| `--mint-ink` (on mint) | `#051d0d` dock / `#0c2214` circle / `#072210` pill | L1077 / L488 / L451 | Three near-identical dark inks — collapse to `#072210`. |
| `--mint-text` (on dark) | `#e6fced` | L717 | Capsule label, dark. |
| `--mint-text` (on light) | `#125428` | L722 | Capsule label, light. |
| `--grad-mint` (canonical) | `linear-gradient(180deg,#96f5b2 0%,#4ae07d 100%)` | L1078 | Dock active tab. |
| `--grad-mint-cta` | `linear-gradient(145deg,#8cf0ac 0%,#45cc73 100%)` | L487 | CTA circle. |
| `--grad-mint-pill` | `linear-gradient(180deg,#98f3b4 0%,#68dc8c 100%)` | L450 | `.ref-split-btn.mint`. |
| `--danger` | `#dc3522` | L1096 (badge), L1500 (visitor dot) | Fill only. Text use fails — §6.3 F6. |
| `--danger-text` (proposed) | `#ff6b5a` (dark) / `#b3261e` (light) | — [D] | 6.52 on `#121614`; 6.54 on `#ffffff` [WC]. |

### 1.4 Borders & elevation

| Proposed var | Dark | Light | Source | Notes |
| :-- | :-- | :-- | :-- | :-- |
| `--line-sheet` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | L30 / L55 | `--card-hero-border`, reused by hero, banner, ivory sheet, tiles. |
| `--line-rim` | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.85)` | L24 / L49 | `--phone-rim` — **phone chassis only, never app UI.** App equivalent is the `inset 0 1px 0` highlight in `.glass` (`index.html@1.2.8:56–62`). |
| `--line-subtle` | `rgba(255,255,255,0.06)` | `rgba(20,24,21,0.07)` | L32 / L57 | Ruler minor ticks. Also `--ruler-stroke` `rgba(255,255,255,0.20)` / `rgba(20,24,21,0.22)` (L31 / L56) for major ticks. |
| `--line-tile` | `rgba(255,255,255,0.18)` | same | L806 | Vitals-tile rim (same both themes). |
| `--dock-bg` | `rgba(16,22,18,0.88)` | `rgba(255,255,255,0.9)` | L33 / L58 | |
| `--dock-line` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.08)` | L34 / L59 | |
| `--dock-shadow` | `0 20px 44px rgba(0,0,0,0.7)` | `0 16px 36px rgba(18,38,26,0.1)` | L35 / L60 | |
| `--field-bg` | `rgba(255,255,255,0.05)` | `#ffffff` | L39 / L64 | |
| `--field-line` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.14)` | L40 / L65 | **1.25:1 / 1.38:1** [WC] — §6.3 F7/F13. |
| `--field-focus` | `#34d375` + `0 0 0 3px rgba(52,211,117,0.2)` | (not overridden) | L1131–1134 | No light-mode override; ring is 1.15:1 on white — §6.3 F15. |
| `--shadow-card` | `0 18px 40px rgba(0,0,0,0.25)` | `0 14px 34px rgba(18,38,26,0.07)` | L503 / L509 | |
| `--shadow-tile` | `0 10px 22px -4px rgba(0,0,0,0.28)` | same | L807 | |
| `--shadow-sheet` | `0 16px 36px rgba(0,0,0,0.15)` | same | L895 | |

### 1.5 The four tile gradients

Each tile is a **radial glow over a 3-stop linear gradient**; the glow is positioned in the bottom/right half and is the main source of contrast loss (§6.3 F3–F5).

| Tile | Glow (radial) | Linear stops | Source |
| :-- | :-- | :-- | :-- |
| `--tile-ruby` | `radial-gradient(circle at 85% 85%, rgba(255,120,95,0.22) 0%, transparent 60%)` | `linear-gradient(155deg,#a81c1c 0%,#881212 55%,#630c0c 100%)` | L814–816 |
| `--tile-amber` | `radial-gradient(circle at 80% 75%, rgba(255,235,170,0.24) 0%, transparent 60%)` | `linear-gradient(155deg,#c7740e 0%,#a85806 55%,#783b03 100%)` | L821–823 |
| `--tile-cobalt` | `radial-gradient(circle at 82% 50%, rgba(210,238,255,0.22) 0%, transparent 60%)` | `linear-gradient(160deg,#326ea8 0%,#235485 55%,#15385c 100%)` | L828–830 |
| `--tile-mint` | `radial-gradient(circle at 20% 20%, rgba(180,245,205,0.22) 0%, transparent 60%)` | `linear-gradient(145deg,#2d7d4c 0%,#1f5e37 55%,#123e23 100%)` | L835–837 |

All four are `background` shorthand (glow listed first = painted on top), on `border:1px solid rgba(255,255,255,0.18)` (L806). White text is fixed (`#ffffff`, L851 / L875); the tiles do **not** change in light mode.

### 1.6 Spectrum segments

Track: `height:20px; border-radius:6px; gap:1.5px; background:rgba(0,0,0,0.08)` (L949–957). Segments are flex ratios summing to **10.0** (L959–963):

| Class | flex | Fill | Source |
| :-- | --: | :-- | :-- |
| `.seg-orange` | 4.8 | `linear-gradient(90deg,#e45d29,#db7123)` | L959 |
| `.seg-amber` | 3.4 | `linear-gradient(90deg,#cf821b,#bf931b)` | L960 |
| `.seg-lime` | 0.9 | `#a5ad1d` | L961 |
| `.seg-green` | 0.5 | `#3f9941` | L962 |
| `.seg-purple` | 0.4 | `#622585` | L963 |

Segment widths at the 350 px content column, inner 318 px, minus 4×1.5 px gaps = 312 px available [D]: **149.8 / 106.1 / 28.1 / 15.6 / 12.5 px**. Render agrees at the small end: lime 27 px (x 1046–1073), green 16 px (1075–1090), purple 12 px (1093–1104) [M].

---

## 2. Typography

### 2.1 Family — the mockup is *not* using Inter

The mockup loads Inter + Plus Jakarta Sans from Google Fonts (L7–9) but its only font-family rule is:

```css
font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", sans-serif;   /* L76 */
```

`Plus Jakarta Sans` appears **nowhere** in the mockup's CSS — a search finds it only in the font `<link>` (L9). Because `-apple-system` wins on Apple platforms, **the mockup renders SF Pro on iPhone and Inter on Android/Windows** — the supplied renders were captured with Inter (Windows). The app baseline instead sets `font-family:Inter,system-ui,sans-serif` (`index.html@1.2.8:36`) and uses Plus Jakarta Sans only for `.display` (`index.html@1.2.8:75`).

**Contract:** the app's stack wins — `Inter` first, `system-ui` fallback; `.display` stays Plus Jakarta Sans 800. This means the iPhone rendering will differ from the mockup by design. Do not "fix" the app to match the mockup's Apple rendering.

### 2.2 Scale

| Role | Size / weight / tracking / line-height | Where | Source |
| :-- | :-- | :-- | :-- |
| Display 1 | 48 px / 700 / −2 px / 1.02 | hub visitor number | L686–694 |
| Display 2 | 36 px / 700 / −1 px / 1.02 | gate "Passport" wordmark (inline override) | L1234 |
| Title 1 | 18 px / 750 / −0.4 px / normal | ivory sheet `h3` | L907–913 |
| Title 2 | 16 px / 700 / −0.3 px / 1.15 | wide banner headline | L1036–1041 |
| Title 3 | 15.5 px / 650 / −0.2 px / normal | visitor name | L695–701 |
| Title 4 | 14.5 px / 700 / −0.2 px | banner `h4` | L774–780 |
| CTA | 14.5 px / 750 / −0.25 px | split CTA label | L469–471 |
| Body | 14 px / 500 | inputs | L1126 |
| Body-sm | 13.5 px / 700 | visitor row name | L997–999 |
| Numeral | 22 px / 800 / −0.8 px / 1.05 + text-shadow | vital value | L869–880 |
| Meta | 12.5 / 700 · 12 / 600 | spectrum label, banner top | L938–942, L1024–1030 |
| Micro | 11.5 / 500–650 | eyebrows, capsule, caption, pills, banner `p` | L646–650, L679–685, L714–716, L848–854, L914–918 |
| Micro-sm | 11 / 500–600 | visitor sub-line, field labels | L1003–1008, L1257, L1262 |
| Dock | 9.5 px / 600, icon 19 px | dock labels | L1068, L1084–1087 |
| Badge | 9 px / 800 | dock count | L1098 |

### 2.3 Everything below 11 px (exhaustive — 5 declarations)

| Value | Element | Source | Verdict |
| :-- | :-- | :-- | :-- |
| **9.5 px** | `.he-tab` dock label | L1068 | Raise to ≥11 px — §7 D-10 |
| **9 px** | `.he-badge` dock count | L1098 | Raise to 10 px + 16 px badge, or mark aria-hidden |
| **10.5 px** | `.pill-label` inline in the three visitor rows | L1507, L1520, L1533 | Raise to 11 px |

At or just above the floor but **chrome-only** — never carry over: `.phone-tag` 11.5 (L301), `.studio-sub` 11.5 (L138), `.phone-theme-btn` 11 (L249).

### 2.4 Type defects to fix in the rebuild

1. **Off-scale weights**: 650 / 750 / 450 (L648, L910, L704, L470, L421). With non-variable fallbacks these round unpredictably. Map to **600 / 700 / 800** unless the variable Inter axis is guaranteed.
2. **No line-height tokens**: only 1.02 / 1.05 / 1.15 are declared. 11.5 px text inherits `normal`, which differs by font — pin it to **1.35** for micro, **1.45** for body.
3. **14 px inputs** (L1126) trigger iOS Safari auto-zoom (blueprint Phase 7). Must be **16 px** — §7 D-11. The baseline sets `.field` to 0.875 rem = 14 px (`index.html@1.2.8:104`) but already overrides to 16 px for touch via `@media (pointer:coarse)` (`index.html@1.2.8:562`); carry that override into the rebuild.
4. **No `rem`**: every size is px, so OS font scaling is ignored (Phase 1.2). Re-express the scale in `rem` at 16 px root.

---

## 3. Geometry

### 3.1 Frame, columns and safe area

| Item | Value | Source |
| :-- | :-- | :-- |
| Chassis | 396 × 836, radius 56, padding 9 | L314–319 [C]; 396 × 836 confirmed [M] |
| Screen | **378 × 818**, radius 47 | [C] L317 + L330–334; width 378 [M] |
| Content column | **350 px** | [C] L397 padding `56px 14px 105px`; [M] 348 + 2 borders |
| Dynamic Island | 114 × 31 at top 11, radius 20 | L346–348 [C]; 114 × 31 at y=144 [M] — **chrome, never app** |
| Fake status bar | 50 px tall, padding `12px 28px 0 32px`, time 14.5/600 | L365–383 — **chrome, never app** |
| Content top offset | 56 px (= 50 status bar + 6) | L397 |
| Home indicator | 126 × 4 at bottom 5 | L1104–1114 — **chrome, never app** |
| Bottom content padding | 105 px (= 16 dock offset + 53 dock + 36 clearance) | L397 |
| Safe area (app) | `max(.75rem, env(safe-area-inset-top) + .5rem)` top, same bottom | `index.html@1.2.8:870`, `index.html@1.2.8:898` |
| Viewport | `viewport-fit=cover` | mockup L5, `index.html@1.2.8:8` |

**Safe-area relationship.** The mockup fakes the notch with a fixed 50 px bar; the app must use `env(safe-area-inset-*)` plus Capacitor's `--safe-area-inset-top` variable. The mockup's 56 px offset maps to **`calc(safe-top + 6px)`**, floored at 12 px — *not* a hard 56. On a non-notched Android device `env()` is 0, and a fixed 56 px would push the hero down by 56 px of dead space. The app also has a real header (see §4.11) that the mockup does not have, so the hero's top gap is *header height + 11 px*, not 56 px.

### 3.2 Radii

| Radius | Applied to | Source |
| --: | :-- | :-- |
| 28 | hero card | L500 |
| 26 | ivory sheet | L891 |
| 22 | practice banner, wide banner, vitals tile | L763, L799, L1013 |
| 22 | app header glass (`rounded-[22px]`) | `index.html@1.2.8:871` |
| 24 | app nav glass (`rounded-[24px]`) | `index.html@1.2.8:899` |
| 16 | input | L1120 |
| 14 | visitor row | L972 |
| 7 | tile icon badge | L858 |
| 6 | spectrum bar | L952 |
| 999 / 50% | dock, split pill, CTA pill, circles | L1054, L418, L466, L433 |

### 3.3 Spacing

| Item | Value | Source |
| :-- | :-- | :-- |
| Content padding | 56 / 14 / 105 | L397 |
| Card gap (stack) | **11** | L400 [C]; measured 11–12 [M] |
| Hero padding | 16 / 16 / 14 (+ inline 16 bottom on gate) | L504, L1205 |
| Banner padding | 13 15 | L764 |
| Tile padding | 12 11 11 | L800 |
| Ivory sheet padding | 16 15 | L892 |
| Wide banner padding | 14 15, internal gap 8 | L1014, L1021 |
| Bento gap | **8** | L794 [C]; tile pitch 119.5 − width 111 = 8.5 [M] |
| CTA row gap | 4 | L458 |
| Split pill gap | 2 | L409 |
| Visitor row gap | margin-bottom 6 | L975 |
| Spectrum gap | 1.5 | L953 |
| Staff pill padding | 4 11 4 4, gap 8 | L622–623 |
| Dock padding | 6 8 | L1059 |

### 3.4 Component dimensions

| Item | Value | Source |
| :-- | :-- | :-- |
| Vitals tile | **111 × 128** (min-height 128), radius 22 | [M] 111×128; [C] L801 |
| Tile icon badge | 22 × 22, radius 7, glyph 12 | L856–867 |
| Split pill | label h **25**, padding 0 11; circle **25 × 25**, glyph 12 @ stroke 2.6 | L415–445 |
| Split CTA | main h **48**, circle **48 × 48**, glyph 18 | L463–491 [C]; row 48 tall [M] |
| Input | h **48**, radius 16, padding 0 14 | L1119–1124 |
| Icon circle btn | 28 (ivory), 30 (help) | L919–921, L656–658 |
| Staff pill | h 36 (28 avatar + 2×4) | L619–645 |
| ECG strip | 70 px tall, full width, centred | L518–535 |
| Tick ruler | 20 px tall, margin 12 4 2 | L732–736 |
| Spectrum bar | 20 px tall | L951 |
| Dock | left/right 10, bottom 16, radius 999; **358 × 53 measured** | L1044–1060 [C]; [M] x 767–1124, y 882–935 |
| Dock tab | padding 4 10, icon 19, gap 2.5, label 9.5 → **47 px fill × 37 measured**, 41 CSS | L1062–1087 [C]; [M] active mint pill 47×37 (AA-clipped, lower bound) |
| Dock badge | 14 × 14 min, 9 px type | L1088–1102 |
| Strong hit targets | CTA 48 [M], tile 128 [M], input 48 [C], visitor row ~48 [D] | |

---

## 4. Component anatomy

For each: exact mockup structure, measured/CSS numbers, and **D** = data-bearing, **X** = decorative.

### 4.1 Passport hero — **D** (X for the ECG and ruler)

```html
<section class="hero-bio-card" aria-label="Now serving visitor">
  <div class="ecg-monitor-wave" aria-hidden="true"><svg viewBox="0 0 340 70" preserveAspectRatio="none">…3 paths…</svg></div>
  <div class="hero-top-bar">
    <button class="staff-pill"><span class="staff-avatar">DM</span><span class="staff-meta">David <span>· EXPO-042</span></span></button>
    <div><button class="phone-theme-btn">Light</button><button class="help-circle-btn">?</button></div>
  </div>
  <div class="hero-center">
    <div class="hero-eyebrow">Now Serving Visitor</div>
    <div class="hero-giant-id">042</div>
    <p class="hero-patient-name">David Mokoena <span>· 50y Male</span></p>
    <span class="hero-mint-capsule"><i></i> Step 2 of 4 · Vitals Recorded</span>
  </div>
  <div class="hero-ruler" aria-hidden="true"><span class="hero-ruler-active" style="left:50%"></span></div>
</section>
```
Markup L1205–1242 (gate variant) and L1344–1379 (hub). Measured **350 wide × 231 tall**, top at y=189, radius 28, background `#121614`, 1 px `rgba(255,255,255,0.08)` border, shadow `0 18px 40px rgba(0,0,0,.25)`. Internal rhythm [C]: 16 padding → 36 top bar → 6 margin → eyebrow ~14 → 49 numeral → 4 margins → ~22 name → 10 → ~26 capsule → 12+20+2 ruler → 14 padding = **≈229–231** [D], consistent with the measured 231 [M].

Accessibility debt: the giant number and name are `div`/`p` with no heading or accessible label, and the section's `aria-label` says only "Now serving visitor". The rebuild must expose id, name, step and age/sex as one readable group.

### 4.2 ECG waveform — **X** (must never imply diagnosis)

```html
<div class="ecg-monitor-wave" aria-hidden="true">
  <svg viewBox="0 0 340 70" preserveAspectRatio="none" style="width:100%;height:100%">
    <path class="ecg-track-base"  d="M 0 35 L 50 35 … 340 35" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path pathLength="100" class="ecg-sweep-beam" d="…identical…" …/>
    <path class="ecg-beep-line" d="…identical…" …/>
  </svg>
</div>
```

* **3 paths, one `d` string** — 22 path commands (18 `L`, 4 `Q`), two P-QRS-T complexes in a 340×70 viewBox (L1211–1215). Duplicated verbatim in both phones (L1350–1354).
* Container: 70 px tall, `top:50%`/`translateY(-50%)`, `opacity:.46` dark / `.40` light, horizontal `mask-image` transparent→black at 10%/90% (L518–535).
* Path 1 `.ecg-track-base`: stroke `rgba(52,211,117,.26)` / light `rgba(22,163,74,.22)`, width 1.8 (L538–545).
* Path 2 `.ecg-sweep-beam`: `#34d375`, width 2.6, `drop-shadow(0 0 6px rgba(52,211,117,.85))`, `stroke-dasharray:22 78`, **animation `ecg-sweep-scan 2.4s linear infinite`**, `stroke-dashoffset 25 → −100` (L547–567).
* Path 3 `.ecg-beep-line`: `#34d375`, **`ecg-heartbeat-beep 1.6s cubic-bezier(.22,1,.36,1) infinite`**, keyframes at 0/22/28/34/42/50/100 % animating `opacity` (.12→1→.12), `stroke-width` (1.6→3.4) **and `filter: drop-shadow()`** (L569–609).

### 4.3 Mint capsule — **D**

```html
<span class="hero-mint-capsule"><i></i> Step 2 of 4 · Vitals Recorded</span>
```
`inline-flex`, gap 6, padding `5px 14px`, radius 999, 11.5/650; dark `rgba(22,42,30,.65)` + 1 px `rgba(74,222,128,.4)` + `#e6fced`; light `rgba(34,197,94,.12)` + `rgba(22,163,74,.35)` + `#125428` (L707–729). Dot 6 × 6 `#34d375` (L724–729), **X**.

### 4.4 Tick ruler — **X in markup, D in meaning**

```html
<div class="hero-ruler" aria-hidden="true"><span class="hero-ruler-active" style="left:50%"></span></div>
```
20 px tall, margin `12px 4px 2px`; two `repeating-linear-gradient` tracks — major every **48 px**, 1 px wide, `background-size:100% 16px`; minor every **8 px**, 1 px, `background-size:100% 9px`; both anchored bottom, masked 18 %→82 % (L732–745). Pin: 2 × 20 px `#34d375`, `box-shadow:0 0 8px #34d375`, `transition:left .35s`, positions 28 % / 50 % / 74 % per visitor (L1629, L1640, L1651, L746–756).

The pin encodes step progress but is `aria-hidden` with no text alternative — §7 D-12.

### 4.5 Vitals tile — **D**

```html
<div id="vital-bp-card" class="caustic-tile ruby">
  <div class="tile-head">
    <span class="tile-head-title">Blood<br>Pressure</span>
    <div class="tile-icon-badge" title="Blood Pressure"><svg …/></div>
  </div>
  <b class="tile-value">142/90</b>
  <div class="tile-foot"><span class="ref-split-btn"><span class="pill-label">High</span><span class="pill-circle"><svg …/></span></span></div>
</div>
```
Measured **111 × 128**, pitch 119.5 (gap 8), radius 22, padding `12 11 11`, `justify-content:space-between`, 1 px `rgba(255,255,255,.18)` rim, `0 10px 22px -4px rgba(0,0,0,.28)` shadow (L797–810). Header 11.5/650 white; value 22/800/−0.8 + text-shadow; footer pill 25 px. Grid is `repeat(3,1fr)` (L791–795). The **only** status encoding is the tile class (`ruby`/`amber`/`cobalt`/`mint-cloud`) swapped in JS (L1669–1679), i.e. colour only — the pill text ("High"/"Watch"/"Optimal") is the accessible signal and must survive.

### 4.6 Split CTA — **D**

```html
<button class="ref-cta-row">
  <span class="cta-main">Continue: Consultation &amp; Results</span>
  <span class="cta-circle"><svg width="18" height="18" …/></span>
</button>
```
Row gap 4, `width:100%`; main `flex:1; height:48px; radius:999`, 14.5/750/−0.25, white on `#111814` with `0 10px 24px rgba(0,0,0,.22)`; light mode inverts to `#141815` bg / `#fff` text (L463–482). Circle 48 × 48, `linear-gradient(145deg,#8cf0ac,#45cc73)`, glyph `#0c2214`, shadow `0 10px 22px rgba(52,211,117,.3)` (L483–493). Measured 48 tall.

### 4.7 Ivory sheet + spectrum bar — **D** (spectrum **X**)

```html
<section class="ivory-sheet" aria-label="Visitors today">
  <div class="ivory-head">
    <div><h3>Visitors today</h3><p>Tap a visitor row to inspect live vitals</p></div>
    <button class="ivory-circle-btn" title="Cohort Filter"><svg …/></button>
  </div>
  <div class="spectrum-meta"><strong>Screening Spectrum</strong><span>VN: 3 Active · 4 Stations</span></div>
  <div class="segmented-bar" aria-hidden="true"><i class="seg-orange"></i>…</div>
  <button class="ivory-visitor-row active">
    <span class="visitor-left"><span class="visitor-dot" style="background:#dc3522"></span>
      <span><strong class="visitor-name">David Mokoena</strong><span class="visitor-sub">EXPO-042 · BP 142/90 · Serving now</span></span></span>
    <span class="ref-split-btn"><span class="pill-label" style="background:#141815;color:#fff;height:23px;font-size:10.5px">2 / 4</span></span>
  </button>
</section>
```
Radius 26, padding `16 15`, shadow `0 16px 36px rgba(0,0,0,.15)`, border `--line-sheet`; dark = cream gradient, light = flat white (L889–899). Rows: radius 14, padding `9 11`, `rgba(255,255,255,.65)` on cream, active = white + `rgba(34,197,94,.45)` border + shadow (L966–1008). The spectrum bar is `aria-hidden` with **no legend, axis or units** — it cannot carry clinical meaning as drawn.

### 4.8 Wide banner — **D**

```html
<section class="wide-bio-banner" aria-label="Incoming expo">
  <div class="wide-bio-top"><span>SDA Community Health Expo</span><em>March · 5/22 helpers</em></div>
  <div class="wide-bio-bottom"><strong>Pledge &amp; Booth<br>Registration</strong>
    <span class="ref-split-btn mint"><span class="pill-label">Details</span><span class="pill-circle">…</span></span></div>
</section>
```
Radius 22, padding `14 15`, gap 8, gradient L1015, 1 px `rgba(255,255,255,.15)`, `0 12px 28px rgba(0,0,0,.28)` (L1011–1041).

### 4.9 Dock — **D** (navigation)

```html
<nav class="he-tabbar" aria-label="Primary Navigation">
  <a href="#" class="he-tab on" aria-current="page"><svg …/><span>Home</span></a>
  <a href="#" class="he-tab"><svg …/><span>Visitor</span><span class="he-badge">8</span></a>
  <a href="#" class="he-tab"><svg …/><span>Queue</span></a>
  <a href="#" class="he-tab"><svg …/><span>Care</span><span class="he-badge">1</span></a>
  <a href="#" class="he-tab"><svg …/><span>Team</span></a>
  <a href="#" class="he-tab"><svg …/><span>Profile</span></a>
</nav>
```
**Measured 358 × 53 at x 767–1124, y 882–935** → confirms `left/right:10; bottom:16; padding:6 8` and a ~41 px tab. Tabs: `flex-direction:column`, gap 2.5, icon 19, label 9.5/600 (L1062–1087). Active: `linear-gradient(180deg,#96f5b2,#4ae07d)`, text `#051d0d`, `0 4px 12px rgba(74,224,125,.35)` (L1076–1080). Badge 14 × 14, `#dc3522`, 9/800 (L1088–1102). Background `rgba(16,22,18,.88)` **+ `backdrop-filter: blur(28px) saturate(1.9)`** (L1050–1055).

Labels and order match the shipped app exactly — `SERVE_TABS` = Home / Visitor / Queue / Care / Team / Profile (`src/shell.js:22–29`). No renaming required.

### 4.10 Sign-in card + sandbox tiles — **D**

```html
<section class="snapshot-copper-card" style="flex-direction:column;align-items:stretch;gap:11px;padding:16px 15px">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><h4>Staff Sign-In</h4><p>Enter email and booth password</p></div>
    <div class="icon-box" style="width:24px;height:24px;opacity:.6">…lock…</div>
  </div>
  <div><label style="font-size:11px;font-weight:600;opacity:.7;margin:0 0 4px 4px">Staff Email</label>
       <input type="email" class="login-input-well" value="you@example.org"></div>
  <div><label …>Password</label>
    <div style="position:relative"><input id="pwd-field" type="password" class="login-input-well" style="padding-right:58px">
      <button type="button" onclick="togglePwd()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:11.5px;font-weight:650;color:#34d375">Show</button></div></div>
  <div class="ref-cta-row" onclick="setView('hub')" style="margin-top:2px;cursor:pointer">
    <span class="cta-main">Sign In to Expo</span><span class="cta-circle">…</span></div>
  <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;opacity:.8;padding:2px 4px 0">
    <a href="#" style="color:#34d375">Forgot password?</a><a href="#" style="color:#34d375">Create account</a></div>
</section>
```
Markup L1245–1280. Bg = `--copper-banner`, radius 22, border `--line-sheet`, shadow `0 10px 24px rgba(0,0,0,.12)` (L761–773). Inputs: 48 tall, radius 16, **14 px**, `outline:none`, focus border `#34d375` + 3 px ring (L1117–1134). Two sandbox tiles follow in a `1fr 1fr` grid, gap 8: `.caustic-tile.mint-cloud` ("Practise / Sandbox") and `.caustic-tile.amber` ("Offline / Training"), each with sub-copy 11 px `rgba(255,255,255,.9)` margin-top 6 and `.tile-foot` split pill margin-top 12 (L1283–1315).

### 4.11 Header — **NOT IN THE MOCKUP**

There is no app header in either phone. `hero-top-bar` (L611–671) is the only header-like row, and it contains a studio control: the `phone-theme-btn` "Light" toggle (L1227, L1364). The header must come from the baseline instead:

```html
<header class="sticky top-0 z-30 px-3" style="padding-top:max(.75rem,calc(var(--safe-area-inset-top,0px) + .5rem),calc(env(safe-area-inset-top,0px) + .5rem))">
  <div class="glass flex items-center justify-between gap-2 rounded-[22px] px-3 py-2.5">
    <button id="cloudBtn" … class="… h-9 w-9 … rounded-[14px]">…</button>
    <div class="display text-[15px] font-extrabold …">Health Expo Passport</div>
    <button id="notifBell" …></button>
    <button id="headerChip" … class="btn btn-glass h-9 gap-1.5 rounded-full py-0 pl-1 pr-2.5"></button>
  </div>
</header>
```
(`index.html@1.2.8:870–893`). Header is ~58 px tall [C: 36 + 2×10 padding + border], plus a 12–16 px top inset. The rebuild restyles this bar with the contract tokens but **keeps its information architecture** (cloud status, title, notifications, visitor switcher) and does **not** add a theme toggle to it.

### 4.12 Decorative vs data-bearing — summary

| Component | Kind | Why |
| :-- | :-- | :-- |
| Hero card (ID, name, step) | **D** | Must be one labelled group for AT. |
| ECG waveform | **X** | `aria-hidden`; a decorative flourish, never a reading. |
| Ruler + pin | **X / D** | Marked decorative but encodes step % — must gain a text equivalent or be dropped from data duty. |
| Mint capsule | **D** | Status text. |
| Vitals tile | **D** | Value + status pill; colour must not be the only carrier. |
| Split CTA / split pill | **D** | Label + action. |
| Ivory sheet rows | **D** | Visitor records. |
| Spectrum bar | **X** | No legend/units; decorative until real distributions exist. |
| Wide banner | **D** | Event + helper count + action. |
| Dock + badges | **D** | Navigation + counts. |
| Sign-in card, sandbox tiles | **D** | Credentials, demo entry. |

---

## 5. Pixel measurements at 390 and 430 CSS px

**Method.** (1) Decode the PNGs losslessly and establish scale from three known anchors — all agree at 1:1 (§0). (2) Read each horizontal geometry as a colour-transition coordinate (AA tolerance ±1 px). (3) For 390/430, apply the *fixed-gutter rule*: fixed dimensions never scale (radii, heights, type, paddings, dock inset); only fluid widths change, as `content = W − 2×14`, `tile = (content − 2×8)/3`, `dock = W − 20`. **The 390/430 columns were not rendered** — they are arithmetic [D], not measurements. Deviation beyond ±1 px is expected only where text re-wraps (±2–4 px in height).

| Element | 396 render (measured) | 390 (derived) | 430 (derived) | Rule |
| :-- | --: | --: | --: | :-- |
| Chassis (excluded) | 396 | — | — | chrome |
| Screen / app viewport | **378** [M] | 390 | 430 | device width |
| Page gutter | 14 [C] | 14 | 14 | fixed |
| **Content column** | **350** [M] | **362** | **402** | W − 28 |
| Full-width card | 350 [M] | 362 | 402 | = content |
| Hero inner | 316 [D] | 328 | 368 | content − 34 |
| Hero total height | **231** [M] | 231 | 231 | fixed rhythm |
| Practice banner height | **58** [M] | 58 | 58 | fixed |
| Vitals tile | **111 × 128** [M] | **115.3** | **128.7** | (content − 16)/3 |
| Tile inner | 87 [D] | 91.3 | 104.7 | tile − 24 |
| 2-up sandbox tile | 171 [D] | 177 | 197 | (content − 8)/2 |
| Split CTA height / main width | 48 / 298 [M, D] | 48 / 310 | 48 / 350 | content − 52 |
| Input width | 318 [D] | 330 | 370 | panel inner |
| Ivory sheet inner | 318 [D] | 330 | 370 | content − 32 |
| Spectrum available | 312 [D] | 324 | 364 | inner − 6 |
| Spectrum orange | 149.8 [D] | 155.5 | 174.7 | flex 4.8/10 |
| Tick ruler width | 342 [D] | 354 | 394 | content − 8 |
| **Dock** | **358 × 53** [M] | 370 × 53 | 410 × 53 | W − 20 |
| Dock inner | 340 [D] | 352 | 392 | dock − 18 |
| Dock tab (6 across) | ~47 × 37 [M] (CSS 41) | ~52 × 41 | ~59 × 41 | space-around |

**Uncertainty and limits**

* ±1 px on all measured edges (AA). Vertical totals inherit the render's font metrics (Inter on Windows); on Apple devices (SF Pro) hero/banner heights may move **1–3 px** [I]. Re-measure on device before locking heights.
* The 430 column is *not* a phone mockup: `max-w-md` = 448 px (`index.html@1.2.8:866`), so at 430 the app is full-bleed and the mockup's chassis no longer applies.
* **320 px sanity check [D]:** content 292, tile 92, tile inner 68. "142/90" at 22/800 needs ≈ 74 px [I] → the vitals value **overflows at 320 px**, which the blueprint Phase 1.2 mandates. Use a 20 px value at ≤ 360 px or let it shrink with `clamp()`. Dock = 300 px → 6 tabs at ~50 px; an 11 px "Visitor" label (~36 px) + 20 px padding = 56 px > 50 → **labels collide at 320 px**; plan an icon-only or 5-tab fallback below 360 px.
* Vertical 390/430 positions from the screen top are invariant; the amount of content above the fold is not (device heights differ, and the 836 px frame is not a device).

---

## 6. Contrast (WCAG 2.x formula)

### 6.1 Method

`L = 0.2126·R + 0.7152·G + 0.0722·B` on linearised channels (`c/12.92` below 0.04045, else `((c+0.055)/1.055)^2.4`); `ratio = (Lmax+0.05)/(Lmin+0.05)`. Translucent colours are composited over the real backdrop before measuring; gradients are measured at their **worst stop**. Thresholds: **4.5:1** normal text, **3:1** large text (≥ 18.66 px bold / 24 px regular) and non-text UI. Ratios below are [WC].

### 6.2 Passing pairs

| Theme | Pair | Ratio |
| :-- | :-- | --: |
| dark | `--ink` / canvas | 18.02 |
| dark | `--ink-muted` / canvas | 9.48 |
| dark | `--ink` / hero | 16.95 |
| dark | `--ink-muted` / hero | 8.91 |
| dark | sheet ink / cream top · bottom | 16.39 · 15.38 |
| dark | sheet ink-sub / cream top · bottom | 6.05 · 5.67 |
| dark | capsule label / capsule | 15.16 |
| dark | dock active label / mint | 13.47 |
| dark | ruby tile white / worst stop · glow | 7.37 · 5.87 |
| dark | cobalt tile white / worst stop | 5.34 |
| dark | mint tile white / worst stop | 5.06 |
| dark | CTA dark ink / white | 18.03 |
| dark | CTA circle glyph / mint top · bottom | 12.10 · 8.08 |
| dark | `#34d375` link / panel | 8.93 |
| light | `--ink` / canvas | 16.14 |
| light | `--ink-muted` / canvas · white | 6.74 · 7.49 |
| light | sheet ink / white | 18.05 |
| light | sheet ink-sub / white | 7.00 |
| light | capsule label / capsule | 8.15 |
| light | dock active label / mint | 13.47 |
| light | CTA white / `#141815` | 17.93 |
| light | input text / white | 17.93 |

### 6.3 Every failure (plus one fragile pass)

| # | Theme | Pair | Ratio | Needs | Root cause |
| --: | :-- | :-- | --: | --: | :-- |
| **F1** | dark | dock inactive label (`--ink-dim`) over dock-on-sheet | **3.81** | 4.5 | translucent dock over a white sheet; 9.5 px text (L33, L1067–1068) |
| **F2** | dark | `--ink-dim` on canvas | **4.28** | 4.5 | token itself is too light for normal text (L28) |
| **F3** | dark | amber tile title, white 11.5 px on `#c7740e` | **3.54** | 4.5 | gradient top stop too light (L823) |
| **F4** | dark | amber tile sub-copy `rgba(255,255,255,.9)` 11 px | **3.17** | 4.5 | same + 90 % white (L1291) |
| **F5** | dark | amber tile value over its glow | **2.66** | 3.0 (large) | radial glow `rgba(255,235,170,.24)` (L822) |
| **F6** | dark | `--danger` `#dc3522` as text on hero / ivory | **3.98 / 4.17** | 4.5 | fill token used as text (L1096) |
| **F7** | dark | input border `rgba(255,255,255,.12)` vs field bg | **1.25** | 3.0 | 1.4.11 control boundary (L40) |
| **F8** | dark | dock badge 9 px white / `#dc3522` | 4.59 | 4.5 | passes by 0.09 — fragile |
| **F9** | light | dock inactive label `--ink-dim` on white | **3.83** | 4.5 | L53 + L1067 |
| **F10** | light | `.staff-meta span` at `opacity:.55`, 11.5 px | **3.86** | 4.5 | opacity instead of a token (L651–654) |
| **F11** | light | `#34d375` "Show / Forgot / Create" links on white | **1.96** | 4.5 | hard-coded inline colour, no light override (L1265, L1277–1278) |
| **F12** | light | amber tile title / sub-copy (identical to F3/F4) | **3.54 / 3.17** | 4.5 | tiles are not themed (L820–824) |
| **F13** | light | input border `rgba(0,0,0,.14)` on white | **1.38** | 3.0 | 1.4.11 (L65) |
| **F14** | light | `--ink-dim` on white hero | **3.83** | 4.5 | L53 |
| **F15** | light | focus ring `rgba(52,211,117,.2)` on white | **1.15** | 3.0 | 2.4.11/1.4.11 — focus change is imperceptible (L1131–1134) |
| **F16** | light | active dock mint `#4ae07d` vs white dock | **1.71** | 3.0 | state fill; label ink saves it but not for colour-blind users |
| **F17** | both | card/sheet vs canvas (light: white on `#f4f3ee`) | **1.11** | n/a | not a WCAG failure (decorative grouping) but the surface is visually undefined — see D-9 |

---

## 7. Deliberate deviations (required)

Each deviation states the measured defect, the replacement, and the verified replacement ratio where applicable.

### D-1 · Dock labels: use `--ink-muted`, not `--ink-dim`
`--ink-dim` is 3.81 (dark, over sheet) / 3.83 (light) against a 4.5 requirement. Replace with `--ink-muted`: **7.22** over the dark dock-on-sheet composite, **7.49** on the light dock [WC]. Carry the inactive/active distinction with weight (600 → 700) and the active mint pill, not with lower contrast. Also bump 9.5 → **11 px**.

### D-2 · Links must be tokens, not inline `#34d375`
The three inline links (L1265, L1277–1278) fall to **1.96** in light mode. Add `--link` = `#34d375` dark (**8.93**) / `#15803d` light (**5.02**) [WC] and delete the inline styles.

### D-3 · Amber tile must darken or take a scrim
White 11.5 px on `#c7740e` = **3.54**; the glow drops the value to **2.66** (below even the 3.0 large-text floor). Three acceptable fixes (pick one):
* darken stop 1 to `#a05a06` → **5.30** white on stop 1 [WC]; or
* keep the gradient but add a 28 % black scrim behind text → **6.12** (glow included: **4.81**) [WC]; or
* switch the amber tile's ink to `#1f1202` → **5.18** [WC].
The bottom-right radial glow must not sit behind small text. Cobalt (**3.65**) and mint (**3.53**) glows are only safe for ≥ 18.66 px bold values, so keep small text out of those corners.

### D-4 · `--danger` is fill-only
`#dc3522` is **4.17** on ivory and **3.98** on the dark hero — it cannot be body text. Introduce `--danger-text` = `#b3261e` light (**6.54** on white) / `#ff6b5a` dark (**6.52** on hero) [WC], and keep `#dc3522` for badges/dots where it measures **4.59** on white.

### D-5 · Form boundaries and focus must be visible
Field borders measure **1.25** (dark) / **1.38** (light) against their fill; WCAG 1.4.11 requires 3:1 for the control boundary. Raise to `rgba(255,255,255,0.40)` → **3.34** [WC] and `rgba(0,0,0,0.42)` → **3.04** [WC]. Replace the `.2`-alpha focus halo with a **2 px solid `--focus`** ring plus a 2 px offset, using the theme link colours above; never remove the outline without this (blueprint Phase 5).

### D-6 · 44 × 44 minimum hit areas
Measured interactive boxes below 44 in **both** axes: help button **30** (L656–658), ivory filter **28** (L919–921), split pill **25** (L415–443), dock tab **~47 × 41** (L1062–1075; 37 px fill measured), inline "Show" (~15 px tall, L1265), theme pill **~25** (L243–256). Keep the visual size; add an invisible 44 × 44 hit area (`::before` inset negative, or `min-height:44px` on rows). The dock must grow **53 → 56 px** to give 44 px tabs at 11 px labels.

### D-7 · Semantics — clickable `div`/`span`/`a#`
The gate CTA is `<div class="ref-cta-row" onclick=…>` (L1269) and the sandbox tiles are `<div class="caustic-tile" onclick=…>` (L1284, L1300) — neither is focusable or announced (blueprint Phase 5). The dock uses `<a href="#">` (L1558) for tab switches. Rebuild with `<button type="button">` for actions, `<a href>` only for real URLs, `aria-current="page"` retained, and a visible `:focus-visible` ring.

### D-8 · Reduced motion — the mockup has **zero** media queries
Searched: no `@media` and no `prefers-reduced-motion` anywhere in the 1,732 lines. Both ECG animations are `infinite` (L553, L572). Required:
* `@media (prefers-reduced-motion: reduce)` → `animation:none` on `.ecg-sweep-beam` and `.ecg-beep-line`, rendering the **static base trace only** (path 1);
* remove the infinite sweep when `document.hidden` (Capacitor background) — otherwise the GPU keeps painting off-screen;
* keep the app's existing intro opt-out precedent (`src/shell.js:184`).

### D-9 · Surfaces need separation in light mode
In light mode hero, card and sheet are all `#ffffff` on `#f4f3ee` — a **1.11:1** boundary (F17). Keep white fills but add a **1 px `rgba(0,0,0,0.12)`** border and the existing elevation; do not rely on shadow alone. Optionally keep the cream sheet gradient (`#f5f4ef → #eeede6`) in both themes so the "ivory" object keeps its identity.

### D-10 · 11 px type floor
9.5 px (L1068), 9 px (L1098), 10.5 px (L1507/1520/1533) must rise to **11 px** (dock), **10 px + 16 px badge** (count), **11 px** (row pills). Below 11 px is not legible at arm's length or under OS text scaling.

### D-11 · 16 px inputs
14 px inputs (L1126) trigger iOS auto-zoom (blueprint Phase 7). Set **16 px** on `input`/`select`/`textarea` under `@media (pointer:coarse)` at minimum, as the baseline already does for `.field` (`index.html@1.2.8:562`), and prefer 16 px unconditionally in the mockup's own fields.

### D-12 · The ruler may not be the only progress signal
The pin is `aria-hidden` (L1239, L1376) yet carries 28/50/74 % step data. Either expose it as `role="progressbar"` with `aria-valuenow`/`aria-valuetext` ("Step 2 of 4"), or keep it decorative and ensure the mint capsule always states the step in words (it does today — L1373).

### D-13 · Performance (top priority)

| Effect | Where | Cost | Required deviation |
| :-- | :-- | :-- | :-- |
| `backdrop-filter: blur(28px) saturate(1.9)` on the dock | L1050–1052 | Re-blurs the scrolling page **every frame**; the most expensive effect in the design | Make the dock **opaque** (`--dock-bg` at 1.0 alpha) or cap at `blur(8px)`; never stack blur on blur |
| Animated `filter: drop-shadow()` in the beep keyframes | L581, L591, L596, L602, L607 | Filter animation cannot composite; repaints the 70 px strip at 60 fps | Delete `filter` from the keyframes; animate `opacity` only |
| `stroke-dashoffset` infinite animation | L553, L560–567 | Paint invalidation of a full-width SVG every frame, forever | Keep the **static** sweep dash as a styled path; drop the motion (or run it once on mount) |
| `mask-image` on ECG + ruler | L529–530, L743–744 | Extra mask layer per card; forces off-main-thread raster | Accept once, but do not animate the masked layer |
| `transition: all .35s` on hero/banner/sheet/dock, `all .18s` on rows/tabs | L506, L772, L898, L1060, L1074 | `all` can animate layout/paint properties unexpectedly | Enumerate properties (`background-color, border-color, transform`) |
| `transition: left` on the ruler pin | L755 | Layout + paint on every step change | Use `transform: translateX()` |
| Shadows on every card/tile + dock | L503, L767, L807, L895, L1017, L1055 | Large blur radii raise raster cost on first paint and on every scroll into view | Flatten shadows under the existing `.lite` class; keep one elevation level |
| Two infinite animations per screen | L553 + L572 | Keeps the compositor awake even when idle | One ECG instance max, hub only; none on gate/queue/care/results |

**Budget for the rebuild [I]:** ≤ 1 backdrop-filtered surface on screen, ≤ 1 always-on animation (and none under `.lite` or reduced motion), 0 filter animations, 0 animated shadows. Extend the existing `.lite` path (`src/shell.js:162–175`, `index.html@1.2.8:420–426`) to `animation:none`, `backdrop-filter:none`, `box-shadow:none` on cards.

**Paint/composite red flags found (complete list):** backdrop-filter ×2 app-relevant (dock L1051, app glass `index.html@1.2.8:57`), animated drop-shadow ×2 keyframe blocks, infinite `stroke-dashoffset`, infinite opacity/stroke-width keyframes, masked layers ×2, `transition: all` ×6, `box-shadow` transitions on 7 surfaces, and no `will-change` anywhere in the mockup (the app uses it only on `.btn`, `index.html@1.2.8:91` — do not extend it, it costs GPU memory).

---

## 8. Mapping: mockup component → app surface

App surfaces are the shipped ones: gate (`#authGate`, `src/cloud.js` `renderGate`), home/hub (`viewHome`), journey = Check/Results/Plan/Send (`src/shell.js:19–20`), queue (`viewQueue` + `#tv` board), care (`viewCare`), team/volunteer (`serve`), profile/account (`#me`, `#acctSheet`), overlays (`#switcherModal`, `#notifSheet`, `#queueModal`, `#placeSheet`, `#cloudModal`, `#volModal`, `#waModal`, `#toast`, crash card).

| Mockup component | Must serve | Notes | Must NOT copy |
| :-- | :-- | :-- | :-- |
| Passport hero (4.1) | home/hub, journey Check, queue "now serving" | One identity block: id, name, age/sex, step. Condense to a strip for Results/Plan/Send. | The "Light" toggle (L1227), the `?` help button that fakes navigation (L1228), the `· v4.2` build badge (L1224) |
| ECG waveform (4.2) | home/hub only (optionally queue) | Decorative; static by default; never on Results, gate or any clinical readout | The infinite sweep/beep timings; the implication of a live cardiac trace |
| Mint capsule (4.3) | hub, journey step, queue status, care follow-up | Text-first status | "Ready for Booth Check-in" / "Step 2 of 4" hard-coded copy (L1236, L1373) |
| Tick ruler (4.4) | journey Check→Results→Plan→Send progress | 4-step progress, not a measurement scale | The 48 px tick rhythm implying mm/Hg; the 28/50/74 % pin values (L1629–1651) |
| Vitals tile (4.5) | Results (BP/sugar/BMI), care risk cards, hub mini-strip | Colour + text; tile class must come from `redFlag`/`cat`, never hard-coded | "142/90 High", "6.4 Watch", "31.0 High" (L1409–1456) and the `VISITORS` seed (L1622–1656) |
| Split CTA (4.6) | gate Sign in, journey Next/Send, queue Call next, care follow-up, volunteer register, profile save | Primary action pattern app-wide | The div-based CTA (L1269) — must be `<button>` |
| Split pill (4.5/4.8) | secondary actions, row affordances | 25 px visual / 44 px hit area | — |
| Ivory sheet + rows (4.7) | hub visitor list, visitor switcher, care list, results summary | Rows are the app's record pattern | The spectrum bar as clinical data (no legend/axis, L1489–1495); the hard-coded lead-ins "Serving now / All normal / Counseling" (L1503–1529) |
| Wide banner (4.8) | team/volunteer (pledge + booth registration), incoming expo, notifications entry | | "March · 5/22 helpers" sample copy (L1542) |
| Dock (4.9) | global nav — 6 tabs, **exact match** to `SERVE_TABS` | Keep Home/Visitor/Queue/Care/Team/Profile and badges | `<a href="#">` (L1558–1609); the blur; the 9.5 px labels |
| Sign-in card (4.10) | gate (`#authGate`), `#cloudModal`, `#acctSheet` auth | Email + password + demo path already exist in `renderGate` | The "Staff Sign-In / Enter email and booth password" copy as-is; the inline `#34d375` links; the pre-filled `you@example.org` value |
| Sandbox tiles (4.10) | gate demo entry (`gateDemo`), volunteer training | Two-up grid, mint + amber | "3 Demo Visitors Loaded" (L1291) — read the real demo count |
| Header (4.11) | every screen | Restyle baseline `index.html@1.2.8:870–893` | — (no header exists in the mockup to copy) |

### Never copy (studio / hardware / fake data)

| Thing | Lines | Why |
| :-- | :-- | :-- |
| Studio control bar | L95–178, L1150–1180 | Design-tool chrome; ships nowhere |
| Floating theme pill | L181–213, L1140–1147 | Same |
| Phone chassis, bezel, shadow | L313–338 | Hardware mock-up |
| Dynamic Island | L340–363 | Fake |
| Status bar + "9:41" | L365–389, L1195, L1334 | Fake; use real safe-area |
| Home indicator | L1104–1114 | Fake |
| `phone-theme-btn` ("Light"/"Dark") | L243–265, L1227, L1364 | Studio toggle inside the app frame |
| Phone tag labels | L292–309, L1189, L1328 | Studio labels |
| Sample clinical statuses & visitor seed | L1409–1456, L1503–1529, L1622–1656 | Demo data; must come from the store |
| "9:41", "v4.2", "3 Demo Visitors Loaded", "5/22 helpers" | L1195, L1224, L1291, L1542 | Fabricated values |

---

## 9. Open questions / uncertainties

1. **Does this rebuild ship a dark theme at all?** The baseline is light-only (teal, `#123033` ink, `#46a597` brand). The mockup *defaults* to dark and introduces a second neutral ramp (`#f5f7f5` / `#141815`). Two palettes plus two ink colours is a brand decision, not a CSS port. If dark ships: system-preference default, with a setting in Profile (not a header toggle).
2. **Ink reconciliation.** App ink `#123033` vs mockup `#141815`; app brand teal `#46a597` vs mockup mint `#34d375`. Are these a full rebrand, or does the teal survive? The contract above assumes mint replaces teal; unverified.
3. **Typeface.** App uses Inter + Plus Jakarta Sans loaded from Google Fonts *at runtime* (`index.html@1.2.8:25–26`) — a network dependency inside a single-file PWA/Capacitor build. Self-host subset WOFF2, or fall back to the system stack? Until decided, the mockup's Apple rendering (SF Pro) and the app (Inter) will not match.
4. **Is the ECG decorative everywhere, or does it ever accompany a real reading?** If an ECG ever appears on Results, it becomes clinical content and cannot stay `aria-hidden`.
5. **What is the ruler actually measuring** — journey step (4 steps), station count, or queue position? The pin values 28/50/74 % imply a continuous scale the app does not have.
6. **Does the app have data to back "Screening Spectrum"?** If not, the bar is decoration and must not be labelled as a screening distribution.
7. **Dock at 320–360 px.** Six 11 px labels cannot fit (see §5). Icon-only below 360, a 5-tab variant, or a horizontal scroll? This contradicts the "6-tab dock" premise and needs a product decision.
8. **Amber tile treatment** (D-3): darken the gradient (visual change) vs dark ink (brand change) vs scrim (extra paint). Which one is acceptable?
9. **Danger ramp.** Mockup `#dc3522` vs app `#bd5248` (rose-600), `#c9574d` (`nav-badge-alert`), `#d6584a` (`.q-card-flag`). Unify on one ramp; the app currently has three reds.
10. **Light-mode ivory sheet.** Flat white (as mocked) or retain cream (identity + surface separation)? D-9.
11. **Header + hero stack.** The mockup has no header; adding the ~58 px baseline header consumes above-the-fold space that the mockup never budgeted for. Confirm the mockup's y-positions are *frame-relative*, not screen-absolute.
12. **Safe-area floor.** 12 px (baseline) vs the mockup's implied 16 px bottom inset. The dock's 16 px bottom (L1048) should become `max(12px, safe-bottom + 8px)`.
13. **Unverified:** no 390/430 render exists; the 390/430 columns in §5 are arithmetic, not screenshots. The 320 px overflow/label-collision findings use estimated text widths [I] and need a device check.
14. **Unverified:** the exact full height of the ivory sheet on the hub screen — it overflows the 818 px screen in both renders (a third row is clipped under the dock), so its true height cannot be measured from the mockup.

---

*End of contract. No app file, `index.html`, `src/`, `tests/` or `dist/` was modified; this document is the only file written.*
