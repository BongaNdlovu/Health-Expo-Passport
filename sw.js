/* Health Expo Passport — service worker.
   Lets the installed app open with no signal: it keeps a copy of the page, its icons, the memory helper, the guided
   tour and the vendored sign-in library and fonts. v1.6.2: nothing is loaded from a CDN any more. It NEVER stores anything from Supabase — visitor health data, volunteer details and sign-in
   tokens travel only between the app and the database (the app keeps its own saved copy on the device).
   VERSION is stamped by tools/build.js so every release replaces the old cache. */
const VERSION = '__VERSION__';
const SHELL = 'newstart-shell-' + VERSION;
const LIBS = 'newstart-libs-v4';              /* v4: the CDN copies (supabase-js 2.45.4, Google Fonts) are dropped; everything is same-origin */

/* the page itself is fetched separately (see install): some hosts redirect /index.html to /, and a redirected
   response may not be handed to a page navigation */
const SHELL_FILES = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/icon-180.png', 'icons/favicon-32.png',
  'nsmem.js', 'tutorial/tour.js', 'tutorial/tour.css', 'tutorial/steps.json', 'vendor/fonts.css',
  /* keep in step with SB_LIB in src/cloud.js (supabase-js 2.118.0, integrity-pinned there) */
  'vendor/supabase.min.js'];
/* best-effort extras: a missing font must not stop the app installing */
const LIB_URLS = ['vendor/fonts/Inter-latin.woff2', 'vendor/fonts/Inter-latin-ext.woff2',
  'vendor/fonts/PlusJakartaSans-latin.woff2', 'vendor/fonts/PlusJakartaSans-latin-ext.woff2'];
const LIB_HOSTS = [];                          /* no off-site libraries or fonts (CSP allows none) */
const isSupabase = host => host === 'supabase.co' || host.endsWith('.supabase.co') || host.endsWith('.supabase.in');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    /* cache: 'reload' skips the browser's HTTP cache: vendor/ and tutorial/ are served with a max-age (tools/build.js
       _headers), and a new release must store the new files, not the copies the browser kept from the old one */
    await shell.addAll(SHELL_FILES.map(url => new Request(url, { cache: 'reload' })));   /* the app itself must be cacheable */
    const home = await fetch('./', { cache: 'reload' });
    if (!home.ok) throw new Error('page not available');
    await shell.put('index.html', await cleanCopy(home));
    /* fonts are best-effort and same-origin, so they live in the shell cache that ownFile() reads */
    await Promise.allSettled(LIB_URLS.map(async url => { if (!(await shell.match(url))) await shell.add(new Request(url, { cache: 'reload' })); }));
    /* No skipWaiting() here. A new build now waits until the page asks for it (src/update.js shows the banner
       and its Update button sends UPDATE_NOW). Swapping the worker under a running page is how an app ends up
       half-updated: the open page still runs the old bundle while every later fetch comes from the new worker. */
  })());
});

/* The page's Update button. Anything else is ignored. */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== SHELL && key !== LIBS) await caches.delete(key);
    await self.clients.claim();
  })());
});

/* a response that followed a redirect is refused for navigations; rebuild it as a plain one */
async function cleanCopy(res) {
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}
/* the page: the saved copy answers at once and the network copy is refreshed in the background ONLY when it belongs
   to this worker's own release (matching VERSION). Overwriting an old worker's SHELL cache with a newer release's HTML
   would pair the new page's SRI hashes with this worker's old vendored vendor/supabase.min.js (F-11). New releases
   arrive atomically when the new worker installs its own versioned cache and the user taps Update. */
async function page(request) {
  const cache = await caches.open(SHELL);
  const saved = await cache.match('index.html');
  const pull = fetch(request).then(async res => {
    const html = res && res.ok && (res.headers.get('content-type') || '').includes('text/html');
    if (html) {
      const txt = await res.clone().text();
      const m = /<meta\s+name="?app-version"?\s+content="?([0-9a-f]+)"?/i.exec(txt);
      if (!m || !/^[0-9a-f]+$/.test(VERSION) || m[1] === VERSION) await cache.put('index.html', await cleanCopy(res.clone()));
    }
    return res;
  }).catch(() => null);
  if (!saved) {
    const res = await pull;
    return res || new Response('The page could not be loaded. Check the connection and try again.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });
  }
  pull.catch(() => {});                       /* refresh for the next open; the visitor waits for nobody */
  return saved;
}
/* own files: serve this worker's versioned copy when cached; only fetch from network when not yet cached (F-11) */
async function ownFile(request) {
  if (new URL(request.url).pathname === '/version.json') {   /* (U5) the update check must never be answered from the saved shell (ignoreSearch keeps the first copy alive forever); straight to the network, never stored */
    const res = await fetch(request).catch(() => null);
    return res || Response.error();
  }
  const cache = await caches.open(SHELL);
  const saved = await cache.match(request, { ignoreSearch: true });
  if (saved) return saved;
  const fresh = await fetch(request).catch(() => null);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh || Response.error();
}
/* CDN libraries and fonts never change at a given address: saved copy first */
async function library(request) {
  const cache = await caches.open(LIBS);
  const saved = await cache.match(request);
  /* an opaque copy cannot satisfy a CORS (integrity-checked) script request: fetch it again */
  if (saved && !(saved.type === 'opaque' && request.mode === 'cors')) return saved;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (isSupabase(url.hostname)) return;                                 /* data and sign-in: straight to the network, never stored */
  /* Android's in-app browser fails the worker's own fetch and then shows net::ERR_CACHE_MISS. Let it load the site itself. */
  if ((request.headers.get('User-Agent') || '').includes('; wv)')) return;
  /* the install file must reach the phone unchanged. Intercepting it can hand the phone this web page instead of the apk, and the installer then refuses the file. */
  if (url.origin === self.location.origin && url.pathname.endsWith('.apk')) return;
  if (request.mode === 'navigate' && url.origin === self.location.origin) { event.respondWith(page(request)); return; }
  if (url.origin === self.location.origin) { event.respondWith(ownFile(request)); return; }
  if (LIB_HOSTS.includes(url.hostname)) event.respondWith(library(request));
});
