// @ts-check
/* Pure HTML builders for the mockup design system. No DOM access: screens compose these strings.
   Everything visual is a class in the "HX COMPONENTS" CSS section; these helpers only structure markup. */
import { I } from './icons.js';
import { esc } from './helpers.js';

/* Authentic P-Q-R-S-T trace used by the reference (viewBox 0 0 340 70). */
export const ECG_PATH = 'M 0 35 L 50 35 L 64 35 L 72 31 Q 78 28 84 35 L 96 35 L 102 41 L 114 8 L 126 62 L 136 31 Q 148 24 162 35 L 195 35 L 210 35 L 218 31 Q 224 28 230 35 L 242 35 L 248 41 L 260 8 L 272 62 L 282 31 Q 294 24 308 35 L 340 35';

/* still trace, then the sweep: tail, halo and head share the path and differ only in dash length */
const ECG_LAYERS = ['base', 'tail', 'halo', 'head'];

/* one beat of the sweep, in ms: must match the 2.4s in the hxSweep* rules */
const ECG_BEAT_MS = 2400;

/** The monitor trace: a faint still rhythm with a bright head sweeping along it, tail behind and halo
    round it, so it hugs every bend — no radial overlay to show edges. Decorative; reduced motion and a
    hidden page get the still trace only. Every render builds a new copy, so it starts at the clock's
    point in the beat (a negative delay) and the sweep carries on instead of snapping back. */
export function ecgHTML(){
 const phase = typeof performance !== 'undefined' ? Math.round(performance.now() % ECG_BEAT_MS) : 0;
 return `<div class="hx-ecg" aria-hidden="true">
  <svg viewBox="0 0 340 70" preserveAspectRatio="none" focusable="false" style="--hx-ecg-ph:-${phase}ms">
   ${ECG_LAYERS.map(k => `<path class="hx-ecg-${k}" pathLength="101" d="${ECG_PATH}"/>`).join('\n   ')}
  </svg>
 </div>`;
}

/** Mint status capsule, e.g. "Step 2 of 4 · Vitals recorded". */
export function capsuleHTML(text){
 return `<span class="hx-capsule"><i></i>${esc(text)}</span>`;
}

/**
 * Cinematic 4-stage journey conduit (Check → Results → Plan → Send).
 * Replaces the old barcode tick ruler with an intuitive, luminous milestone rail.
 * @param {number} [stepIdx] 0=Check, 1=Results, 2=Plan, 3=Send (or 0-100 percentage)
 * @param {boolean} [isDone] whether all 4 steps are complete
 */
export function journeyRailHTML(stepIdx, isDone){
 const steps = [
  { label: 'Check' },
  { label: 'Results' },
  { label: 'Plan' },
  { label: 'Send' }
 ];
 let cur = Number(stepIdx) || 0;
 if (cur > 3) cur = Math.max(0, Math.min(3, Math.round((cur / 100) * 4) - 1));
 if (isDone) cur = 4;
 const pctFill = isDone ? 100 : Math.round((cur / 3) * 100);

 return `<div class="hx-journey-rail" role="progressbar" aria-valuenow="${isDone ? 4 : cur + 1}" aria-valuemin="1" aria-valuemax="4" aria-label="Journey progress: Step ${isDone ? 4 : cur + 1} of 4">
  <div class="hx-rail-track" aria-hidden="true"><div class="hx-rail-fill" style="--hx-fill:${pctFill / 100}"></div></div>
  <div class="hx-rail-steps">
   ${steps.map((s, i) => {
    const done = isDone || i < cur;
    const active = !isDone && i === cur;
    const cls = done ? 'is-done' : active ? 'is-active' : 'is-pending';
    const icon = done
     ? `<svg class="hx-step-check" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>`
     : active
      ? `<span class="hx-step-beacon"></span>`
      : `<span class="hx-step-num">${i + 1}</span>`;
    return `<div class="hx-rail-step ${cls}">
     <span class="hx-step-node">${icon}</span>
     <span class="hx-step-lbl">${s.label}</span>
    </div>`;
   }).join('')}
  </div>
 </div>`;
}

/** Backward-compatible alias for journeyRailHTML */
export const rulerHTML = journeyRailHTML;

/**
 * Jewelled vitals tile. `pill` adds the split High/Watch badge from the reference.
 * @param {{label?:string, icon?:string, value?:string|number, status?:string, tone?:'ruby'|'amber'|'cobalt'|'mint', pill?:boolean}} [o]
 */
export function tileHTML(o){
 o=o||{};
 const tones=['ruby','amber','cobalt','mint'];
 const tone=tones.indexOf(o.tone)>=0?o.tone:'mint';
 const foot=o.pill?`<span class="hx-tile-foot">${splitBtnHTML({label:o.status||'—',arrow:false})}</span>`:`<div class="hx-tile-status">${esc(o.status||'')}</div>`;
 return `<div class="hx-tile hx-tile-${tone}">
  <div class="hx-tile-head"><span class="hx-tile-label">${esc(o.label||'')}</span><span class="hx-tile-icon" aria-hidden="true">${o.icon||''}</span></div>
  <div class="hx-tile-value">${esc(o.value==null?'—':o.value)}</div>
  ${foot}
 </div>`;
}

/** Small split label + arrow badge. `variant:'mint'` for the bright pill; `arrow:false` keeps the pill and
    drops the circle, for a status badge that is not a call to action (the three vitals tiles). */
export function splitBtnHTML(o){
 o=o||{};
 const mint=o.variant==='mint'?' hx-split-mint':'';
 const circle=o.arrow===false?'':`<span class="hx-split-circle" aria-hidden="true">${I.arrow}</span>`;
 return `<span class="hx-split${mint}"><span class="hx-split-label">${esc(o.label||'')}</span>${circle}</span>`;
}

/** Full-width split CTA: label pill + arrow circle. `variant:'dark'` inverts the label. */
export function ctaHTML(o){
 o=o||{};
 const dark=o.variant==='dark'?' hx-cta-dark':'';
 return `<span class="hx-cta${dark}"><span class="hx-cta-main">${esc(o.label||'')}</span><span class="hx-cta-circle" aria-hidden="true">${I.arrow}</span></span>`;
}

/** Whole-number shares of `parts` that always add up to exactly 100 (largest remainder), all 0 when empty. */
export function shares(parts){
 const total = parts.reduce((s, n) => s + n, 0);
 if (!total) return parts.map(() => 0);
 const raw = parts.map(n => n * 100 / total), out = raw.map(Math.floor);
 let left = 100 - out.reduce((s, n) => s + n, 0);
 const order = raw.map((r, i) => [r - out[i], i]).sort((x, y) => y[0] - x[0]);
 for (const [, i] of order) { if (!left) break; out[i]++; left--; }
 return out;
}

/**
 * Triage deck: Emergency (any red reading or red flag: attend quickly), Watch (something raised), Optimal (BP, sugar and BMI all
 * normal). The shares are of the visitors whose three core checks are in, so the cards add up to 100%; anyone
 * still in their checks is counted on its own line and as a grey run on the rail, which is sized by head count.
 * @param {number[]} counts [action, watch, optimal, still in checks]
 */
export function spectrumHTML(counts){
 const [flag, watch, ok, pending] = [0, 1, 2, 3].map(i => Math.max(0, Number(Array.isArray(counts) ? counts[i] : 0) || 0));
 const screened = flag + watch + ok, total = screened + pending;
 const [pf, pw, po] = shares([flag, watch, ok]);
 const aria = total
  ? `Screening distribution of ${screened} screened visitors: ${flag} emergency, attend quickly (${pf}%), ${watch} under watch (${pw}%), ${ok} optimal (${po}%)${pending ? `; ${pending} still in their checks` : ''}`
  : 'Screening distribution: no visitors yet';
 const card = (tone, title, n, p, word) => `<div class="hx-triage-card hx-triage-${tone}">
    <div class="hx-triage-head"><span class="hx-triage-dot"></span><span class="hx-triage-title">${title}</span></div>
    <div class="hx-triage-val">${n}</div>
    <div class="hx-triage-sub">${screened ? p + '% · ' : ''}${word}</div>
   </div>`;
 const bar = (tone, n) => n ? `<div class="hx-triage-bar hx-bar-${tone}" style="flex-grow:${n}"></div>` : '';
 return `<div class="hx-triage-deck" role="region" aria-label="${esc(aria)}">
  <div class="hx-triage-grid">
   ${card('ruby', 'Emergency', flag, pf, 'Attend quickly')}
   ${card('amber', 'Watch', watch, pw, 'Elevated')}
   ${card('mint', 'Optimal', ok, po, 'Healthy')}
  </div>
  <div class="hx-triage-rail" aria-hidden="true">
   ${total ? bar('ruby', flag) + bar('amber', watch) + bar('mint', ok) + bar('slate', pending) : '<div class="hx-triage-bar hx-bar-empty" style="flex-grow:1"></div>'}
  </div>
  ${total ? `<p class="hx-triage-note">${screened} of ${total} screened${pending ? ` · ${pending} still in checks` : ''}</p>` : ''}
 </div>`;
}

/** One ivory-sheet row: status dot, name, detail line, optional right badge. */
export function ivoryRowHTML(o){
 o=o||{};
 const badge=o.badge?`<span class="hx-row-badge">${esc(o.badge)}</span>`:'';
 return `<div class="hx-row">
  <span class="hx-row-main"><span class="hx-row-dot" style="background:${esc(o.dot||'#22c55e')}"></span>
   <span><strong class="hx-row-name">${esc(o.name||'')}</strong><span class="hx-row-sub">${esc(o.sub||'')}</span></span>
  </span>${badge}
 </div>`;
}

/** Deep-green expo banner with a split action. */
export function bannerHTML(o){
 o=o||{};
 return `<div class="hx-banner">
  <div class="hx-banner-top"><span>${esc(o.eyebrow||'')}</span><em>${esc(o.meta||'')}</em></div>
  <div class="hx-banner-bottom"><strong>${esc(o.title||'')}</strong>${o.cta||''}</div>
  ${o.sub?`<span class="hx-banner-note">${esc(o.sub)}</span>`:''}
 </div>`;
}
