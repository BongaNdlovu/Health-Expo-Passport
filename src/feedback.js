// @ts-check
/* One vocabulary for "what just happened", used by every action that changes something the person can see.
   Three tones on the existing toast, and one confirmation sheet that replaces the browser's confirm(): the
   native dialog cannot be styled, blocks the page, and on the packaged Android app looks like a system error.

   The sheet is #confirmSheet in index.html. It registers with overlay.js like every other sheet, so the Android
   Back key answers it "no" instead of leaving the app — the same trap the overlay stack exists to prevent.

   Split from the original single-file app; bundled back into one file by tools/build.js. */

import { $ } from './helpers.js';
import { overlayClosed, overlayOpened } from './overlay.js';
import { toast } from './shell.js';

/* ✓ it worked · ⚠ it did not, or it is about to be destructive · plain for neutral progress */
export const ok = m => toast('✓ ' + m);
export const warn = m => toast('⚠ ' + m);
export const say = m => toast(m);

const SHEET = '#confirmSheet';
/** @type {((yes:boolean)=>void)|null} */
let settle = null;                       /* the resolver for the open question, null when none is open */
let timer = 0;

/* The smoke harness has no hands. It sets this to true or false and every question then answers itself, the
   same way the harness's sandbox already answers window.confirm. Left null in the app, where the sheet is the
   only way to answer. */
/** @type {boolean|null} */
let autoAnswer = null;
/** @param {boolean|null} v */
export function setAutoAnswer(v) { autoAnswer = v; }

function hide() {
  const el = $('#confirmSheet');
  if (!el) return;
  clearTimeout(timer);
  el.classList.add('is-closing');
  timer = window.setTimeout(() => { el.classList.add('hidden'); el.classList.remove('flex', 'is-closing'); }, 260);
  overlayClosed(SHEET);
}

/** Answer the open question. The Back key, Cancel, the confirm button and a second question all land here. */
export function answer(yes) {
  if (!settle) return;
  const put = settle;
  settle = null;
  hide();
  put(!!yes);
}

/**
 * Ask before something that cannot be undone from the screen. Resolves false if the sheet is not in the page,
 * so a caller can never hang on a missing element.
 * @param {{title?:string, body?:string, label?:string, danger?:boolean}} [o]
 * @returns {Promise<boolean>}
 */
export function confirmAsk(o) {
  o = o || {};
  if (autoAnswer !== null) return Promise.resolve(autoAnswer);
  const title = $('#cfTitle'), body = $('#cfBody'), go = $('#cfGo'), sheet = $('#confirmSheet');
  if (!title || !body || !go || !sheet) return Promise.resolve(false);
  if (settle) answer(false);             /* one question at a time: a second ask replaces the first */
  title.textContent = o.title || 'Are you sure?';
  body.textContent = o.body || '';
  go.textContent = o.label || 'Confirm';
  go.className = o.danger
    ? 'btn flex-1 bg-rose-600 py-2.5 text-xs text-white'
    : 'btn btn-primary flex-1 py-2.5 text-xs';
  sheet.classList.remove('hidden', 'is-closing');
  sheet.classList.add('flex');
  overlayOpened(SHEET, () => answer(false));
  return new Promise(res => { settle = res; });
}

/* Escape is a cancel, exactly as it is for every other sheet */
document.addEventListener('keydown', e => { if (e.key === 'Escape' && settle) answer(false); });
