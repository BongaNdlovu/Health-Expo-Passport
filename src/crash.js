// @ts-check
/* Crash guard. An uncaught error anywhere — a render that throws, an action, a background
   promise — shows a full-screen card instead of leaving a half-drawn page on the tablet.
   The card offers Try again (one more render), Reload the app, and Close and carry on (for
   a one-off failure in the background), and says plainly that nothing was lost: visitors and
   volunteers stay saved on this phone. Repeat copies of the same error restack nothing, and
   the card itself must never throw: if even it fails, the console line is all we can do.
   The buttons are wired with listeners, not inline onclick — the CSP allows no inline code. */
import { esc } from './helpers.js';

let shown = false, last = '', recover = null;

const text = err => {
  const m = err && err.message ? String(err.message) : String(err);
  return m.length > 300 ? m.slice(0, 300) + '…' : m;
};

export function showCrash(err){
  const msg = text(err);
  console.error('Uncaught:', err);
  if (shown && last === msg) return;
  shown = true; last = msg;
  try{
    let el = document.getElementById('crashCard');
    if (!el){ el = document.createElement('div'); el.id = 'crashCard'; document.body.appendChild(el); }
    el.innerHTML = `<div role="alertdialog" aria-modal="true" aria-label="Something went wrong"
      style="position:fixed;inset:0;z-index:90;background:rgba(11,26,28,.55);display:flex;align-items:center;justify-content:center;padding:16px">
     <div style="background:#fff;border-radius:22px;max-width:400px;width:100%;padding:20px;box-shadow:0 18px 50px rgba(11,26,28,.35)">
      <div style="font-size:15px;font-weight:800;color:#0f2a2c">Something went wrong</div>
      <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:#33504f">That screen could not be drawn. Nothing was lost — visitors and volunteers stay saved on this phone.</p>
      <p id="crashMsg" style="margin:10px 0 0;font-family:ui-monospace,SFMono-Regular,monospace;font-size:10px;line-height:1.5;color:#8a5a12;word-break:break-word">${esc(msg)}</p>
      <div style="display:flex;gap:8px;margin-top:14px">
       <button id="crashAgain" style="flex:1;border:0;border-radius:14px;padding:11px 0;font-size:12px;font-weight:700;color:#fff;background:#2ea597;cursor:pointer">Try again</button>
       <button id="crashReload" style="flex:1;border:0;border-radius:14px;padding:11px 0;font-size:12px;font-weight:700;color:#33504f;background:#eef4f2;cursor:pointer">Reload the app</button>
      </div>
      <button id="crashClose" style="display:block;margin:10px auto 0;border:0;background:none;padding:2px 6px;font-size:11px;font-weight:700;color:#6b8187;text-decoration:underline;cursor:pointer">Close and carry on</button>
     </div></div>`;
    const on = (id, fn) => { const b = el.querySelector('#' + id); if (b && b.addEventListener) b.addEventListener('click', fn); };
    on('crashAgain', () => crashAction('again'));
    on('crashReload', () => crashAction('reload'));
    on('crashClose', () => crashAction('close'));
  }catch(e){ /* even the card could not be drawn — the console line above stands */ }
}

export function hideCrash(){
  shown = false; last = '';
  try{
    const el = document.getElementById('crashCard');
    if (el) el.innerHTML = '';
  }catch(e){ /* ignore */ }
}

/* what the card's buttons do. 'again' hides the card and gives render one more chance —
   if it throws again the window handler shows the card straight back. 'reload' reloads the
   page (the saved copy and the sign-in both survive; the Android app reloads from the
   package). 'close' only dismisses: a background promise may have failed while every
   screen still works. */
export function crashAction(kind){
  if (kind === 'again'){ hideCrash(); try{ if (recover) recover(); }catch(e){ showCrash(e); } }
  else if (kind === 'reload'){ try{ if (typeof location.reload === 'function') location.reload(); }catch(e){ /* nothing sensible left */ } }
  else if (kind === 'close') hideCrash();
}

/* wire the two window events. Registered defensively: a host without them (the smoke
   test's fake DOM) must not break the boot. */
export function installCrash(fn){
  recover = fn;
  try{ addEventListener('error', e => showCrash(e && (e.error || e.message))); }catch(e){ /* ignore */ }
  try{ addEventListener('unhandledrejection', e => showCrash(e && (e.reason || e.type))); }catch(e){ /* ignore */ }
}
