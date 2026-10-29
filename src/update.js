// @ts-check
/* How the app learns a newer build is on the server, on both surfaces it runs on.

   Web / installed PWA — tools/build.js stamps the build's cache version into <meta name="app-version"> and writes
   it to /version.json. When those two differ, or a service worker is waiting to take over, a banner offers
   Update. Tapping it hands the waiting worker SKIP_WAITING and reloads once it is in control. With no waiting
   worker a plain reload is enough, because sw.js serves the page network-first.

   Android (Capacitor) — the page inside the APK carries the version it was packaged at, so a newer server build
   means a newer app is on offer. Tapping downloads /newstart.apk, which the host already sends with
   Content-Disposition: attachment (see _headers in tools/build.js), and the phone's installer takes it from there.

   A development page is never stamped, and an unstamped page never shows the banner — there is nothing to compare.

   Split from the original single-file app; bundled back into one file by tools/build.js. */
import { $ } from './helpers.js';
import { IS_APP } from './platform.js';

const SNOOZE = 'newstart.updSnooze';        /* the server version this person said "not now" to */

/** @type {{version?:string, apk?:{url?:string}|null}|null} */
let server = null;            /* the last /version.json we read */
/** @type {ServiceWorker|null} */
let waiting = null;           /* a worker installed and waiting to take over this page */
let reloading = false;        /* set only by the Update button: a stray controllerchange must not reload us */
let snoozed = '';

const ownVersion = () => {
  const m = document.querySelector('meta[name="app-version"]');
  return m ? String(m.getAttribute('content') || '') : '';
};
const read = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

/** Watch for a newer build. Safe to call twice; a development page does nothing at all. */
export function updateInit() {
  const own = ownVersion();
  if (!own || own === '__APP_VERSION__') return;
  snoozed = read(SNOOZE);
  watchWorker();
  checkNow();
  /* Deliberately no interval: the app keeps exactly two timers (cloud sync and the queue tick) because they
     are the expensive thing on a weak phone. An update is only worth mentioning when someone is looking, so
     this runs on open, when the app comes back to the foreground, and when the network returns. */
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNow(); });
  addEventListener('online', () => checkNow());
}

function watchWorker() {
  if (IS_APP || !('serviceWorker' in navigator)) return;
  /** @param {ServiceWorker|null|undefined} w */
  const adopt = w => {
    if (!w) return;
    const bump = () => {
      /* "installed" with a controller already present is the update case; without one it is a first install */
      if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; offer(); }
    };
    w.addEventListener('statechange', bump);
    bump();
  };
  navigator.serviceWorker.ready.then(reg => {
    adopt(reg.installing);
    adopt(reg.waiting);
    reg.addEventListener('updatefound', () => adopt(reg.installing));
  }).catch(() => { /* no worker: the version check still works */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
}

async function checkNow() {
  if (!navigator.onLine) return;
  let data = null;
  try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    data = await res.json();
  } catch (e) { return; }                    /* offline, or no file on this host: stay quiet */
  if (!data || typeof data.version !== 'string') return;
  server = data;
  offer();
}

function offer() {
  const own = ownVersion();
  const newer = !!(server && server.version && server.version !== own);
  if (!waiting && !newer) { hide(); return; }
  const key = (server && server.version) || own;
  if (snoozed === key) return;               /* they asked not to be told again about this one */
  show(IS_APP && !!(server && server.apk));
}

/** @param {boolean} app */
function show(app) {
  const bar = $('#updateBar');
  if (!bar) return;
  const t = $('#upTitle'), b = $('#upBody');
  if (t) t.textContent = app ? 'A new app version is ready' : 'A new version is ready';
  if (b) b.textContent = app ? 'Tap Update to download and install it.' : 'Tap Update — it takes a few seconds.';
  bar.classList.remove('hidden');
}
function hide() {
  const bar = $('#updateBar');
  if (bar) bar.classList.add('hidden');
}

/** The Update button. */
export function updateNow() {
  hide();
  if (IS_APP) {
    if (server && server.apk && server.apk.url) {
      snoozed = server.version || '';
      if (snoozed) write(SNOOZE, snoozed);
      /* A WebView cannot install an APK, and navigating it to one usually just fails. Hand the file to whatever
         the platform offers: Capacitor's Browser plugin, then a new window (Chrome), then plain navigation as a
         last resort. This is the one path that needs a real phone to verify. */
      /* Only ever hand the installer a file from this app's own host. version.json is same-origin, but an
         absolute url inside it would otherwise be followed anywhere, which is a package nobody vetted. */
      const apk = new URL(String(server.apk.url), location.href);
      if (apk.origin !== location.origin) return;
      const href = apk.href;
      const cap = /** @type {any} */ (window).Capacitor;
      const browser = cap && cap.Plugins && cap.Plugins.Browser;
      if (browser && typeof browser.open === 'function') browser.open({ url: href });
      else if (!window.open(href, '_blank')) location.href = href;
    }
    return;
  }
  reloading = true;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    /* the controllerchange handler reloads first; this is the belt-and-braces timeout if it never fires */
    setTimeout(() => location.reload(), 4000);
    return;
  }
  location.reload();
}

/** "Not now" — quiet until the next build, not just until the next screen. */
export function updateLater() {
  snoozed = (server && server.version) || '';
  if (snoozed) write(SNOOZE, snoozed);
  hide();
}

/** The decision, without a network, for the smoke test. */
export function updateState() {
  return { own: ownVersion(), server: server ? server.version : null, waiting: !!waiting, snoozed };
}
