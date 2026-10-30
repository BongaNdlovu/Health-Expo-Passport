// @ts-check
/* How the app learns a newer build is on the server, on both surfaces it runs on.

   Web / installed PWA — tools/build.js stamps the build's cache version into <meta name="app-version"> and writes
   it to /version.json. When those two differ, or a service worker is waiting to take over, a banner offers
   Update. Tapping it hands the waiting worker SKIP_WAITING and reloads once it is in control. With no waiting
   worker a plain reload is enough, because sw.js serves the page network-first.

   Android (Capacitor) — the page inside the APK carries the version it was packaged at, so a newer server build
   means a newer app is on offer. The app's own page is a local copy with no version.json, so inside the app the
   check goes to the website (APP_SITE), whose /version.json allows it (see _headers in tools/build.js). Tapping
   downloads /newstart.apk from the website, which the host sends with Content-Disposition: attachment, and the
   phone's installer takes it from there.

   A development page is never stamped, and an unstamped page never shows the banner — there is nothing to compare.

   Split from the original single-file app; bundled back into one file by tools/build.js. */
import { $ } from './helpers.js';
import { APP_SITE, IS_APP } from './platform.js';

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

/** Where this build's version.json is read from: the page's own host on the web, the website from inside the app. */
export const versionUrl = (isApp, now) => (isApp ? APP_SITE : '') + 'version.json?t=' + now;

/** The APK address the installer may be given, or '' when it is not on this app's own host. version.json is read
 *  from that host, but an absolute url inside it would otherwise be followed anywhere, which is a package nobody
 *  vetted. Inside the app the host is the website; on the web it is the page's own host. */
export function apkHref(url, isApp, pageHref) {
  const base = isApp ? APP_SITE : pageHref;
  let apk;
  try { apk = new URL(String(url), base); } catch (e) { return ''; }
  return apk.origin === new URL(base).origin ? apk.href : '';
}

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
    const res = await fetch(versionUrl(IS_APP, Date.now()), { cache: 'no-store' });
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
export async function updateNow() {
  hide();
  if (IS_APP) {
    if (server && server.apk && server.apk.url) {
      snoozed = server.version || '';
      if (snoozed) write(SNOOZE, snoozed);
      /* A WebView cannot install an APK, and navigating it to one usually just fails. Hand the address to the
         phone: the AppLauncher plugin (already in the app) opens it in the phone's own browser, which downloads
         the file for the installer. Capacitor's Browser plugin and a new window are the fallbacks. This is the one
         path that needs a real phone to verify. */
      const href = apkHref(server.apk.url, true, location.href);
      if (!href) return;
      const cap = /** @type {any} */ (window).Capacitor;
      const plugins = (cap && cap.Plugins) || {};
      if (plugins.AppLauncher && typeof plugins.AppLauncher.openUrl === 'function') {
        try { await plugins.AppLauncher.openUrl({ url: href }); return; } catch (e) { /* fall through */ }
      }
      if (plugins.Browser && typeof plugins.Browser.open === 'function') plugins.Browser.open({ url: href });
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
