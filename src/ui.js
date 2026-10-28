// @ts-check
/* Pure HTML builders for the mockup design system. No DOM access: screens compose these strings.
   Everything visual is a class in the "HX COMPONENTS" CSS section; these helpers only structure markup. */
import { I } from './icons.js';
import { esc } from './helpers.js';

/* Authentic P-Q-R-S-T trace used by the reference (viewBox 0 0 340 70). */
export const ECG_PATH = 'M 0 35 L 50 35 L 64 35 L 72 31 Q 78 28 84 35 L 96 35 L 102 41 L 114 8 L 126 62 L 136 31 Q 148 24 162 35 L 195 35 L 210 35 L 218 31 Q 224 28 230 35 L 242 35 L 248 41 L 260 8 L 272 62 L 282 31 Q 294 24 308 35 L 340 35';

/** Static ECG trace plus one transform-only scan overlay. Decorative. */
export function ecgHTML(){
 return `<div class="hx-ecg" aria-hidden="true">
  <svg viewBox="0 0 340 70" preserveAspectRatio="none" focusable="false">
   <path class="hx-ecg-track" d="${ECG_PATH}"/>
  </svg>
  <span class="hx-ecg-scan"></span>
 </div>`;
}

/** Mint status capsule, e.g. "Step 2 of 4 · Vitals recorded". */
export function capsuleHTML(text){
 return `<span class="hx-capsule"><i></i>${esc(text)}</span>`;
}

/** Tick ruler with a progress pin; pct is clamped to 0-100. */
export function rulerHTML(pct){
 const p=Math.max(0,Math.min(100,Number(pct)||0));
 return `<div class="hx-ruler" aria-hidden="true"><span class="hx-ruler-pin" style="left:${p}%"></span></div>`;
}

/**
 * Jewelled vitals tile.
 * @param {{label?:string, icon?:string, value?:string|number, status?:string, tone?:'ruby'|'amber'|'cobalt'|'mint'}} [o]
 */
export function tileHTML(o){
 o=o||{};
 const tones=['ruby','amber','cobalt','mint'];
 const tone=tones.indexOf(o.tone)>=0?o.tone:'mint';
 return `<div class="hx-tile hx-tile-${tone}">
  <div class="hx-tile-head"><span class="hx-tile-label">${esc(o.label||'')}</span><span class="hx-tile-icon" aria-hidden="true">${o.icon||''}</span></div>
  <div class="hx-tile-value">${esc(o.value==null?'—':o.value)}</div>
  <div class="hx-tile-status">${esc(o.status||'')}</div>
 </div>`;
}

/** Small split label + arrow badge. `variant:'mint'` for the bright pill. */
export function splitBtnHTML(o){
 o=o||{};
 const mint=o.variant==='mint'?' hx-split-mint':'';
 return `<span class="hx-split${mint}"><span class="hx-split-label">${esc(o.label||'')}</span><span class="hx-split-circle" aria-hidden="true">${I.arrow}</span></span>`;
}

/** Full-width split CTA: label pill + arrow circle. `variant:'dark'` inverts the label. */
export function ctaHTML(o){
 o=o||{};
 const dark=o.variant==='dark'?' hx-cta-dark':'';
 return `<span class="hx-cta${dark}"><span class="hx-cta-main">${esc(o.label||'')}</span><span class="hx-cta-circle" aria-hidden="true">${I.arrow}</span></span>`;
}

/** Five-segment screening spectrum, proportional to real counts. */
export function spectrumHTML(counts){
 const vals=(Array.isArray(counts)&&counts.length===5?counts:[0,0,0,0,0]).map(n=>Math.max(0,Number(n)||0));
 const total=vals.reduce((a,b)=>a+b,0);
 const flex=total?vals.map(n=>n/total*100):[20,20,20,20,20];
 const names=['orange','amber','lime','green','purple'];
 const aria=total?`Screening spectrum, ${total} visitors`:'Screening spectrum, no visitors yet';
 return `<div class="hx-spectrum" role="img" aria-label="${esc(aria)}">${vals.map((n,i)=>`<i class="hx-seg-${names[i]}" style="flex:${flex[i].toFixed(2)}"></i>`).join('')}</div>`;
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
 </div>`;
}
