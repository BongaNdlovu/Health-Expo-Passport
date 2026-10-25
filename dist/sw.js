/* Health Expo Passport — service worker.
   Lets the installed app open with no signal: it keeps a copy of the page, its icons and the three code libraries
   it loads from CDNs. It NEVER stores anything from Supabase — visitor health data, volunteer details and sign-in
   tokens travel only between the app and the database (the app keeps its own saved copy on the device).
   VERSION is stamped by tools/build.js so every release replaces the old cache. */
const VERSION = 'fa961dc185';
const SHELL = 'newstart-shell-' + VERSION;
const LIBS = 'newstart-libs-v2';              /* v2: scripts are now loaded with integrity checks (CORS), so older opaque copies are dropped */

/* the page itself is fetched separately (see install): some hosts redirect /index.html to /, and a redirected
   response may not be handed to a page navigation */
const SHELL_FILES = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/icon-180.png', 'icons/favicon-32.png'];
/* keep in step with SB_LIB / H5Q / QRJS in index.html (tools/check is in .smoke/harness.js) */
const LIB_URLS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const isSupabase = host => host === 'supabase.co' || host.endsWith('.supabase.co') || host.endsWith('.supabase.in');

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(SHELL_FILES);                                    /* the app itself must be cacheable */
    const home = await fetch('./', { cache: 'reload' });
    if (!home.ok) throw new Error('page not available');
    await shell.put('index.html', await cleanCopy(home));
    const libs = await caches.open(LIBS);
    /* libraries are best-effort: a CDN hiccup must not stop the app installing */
    await Promise.allSettled(LIB_URLS.map(async url => { if (!(await libs.match(url))) await libs.add(url); }));
    await self.skipWaiting();
  })());
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
/* the page: use the network, and the saved copy only when the network does not answer.
   A rejected answer here is shown on the phone as net::ERR_CACHE_MISS, so this must always return a response.
   The 4s cutoff applies only when a saved copy exists. With nothing saved, a slow phone must be allowed to finish. */
async function page(request) {
  const cache = await caches.open(SHELL);
  const saved = await cache.match('index.html');
  const pull = async () => {
    const res = await fetch(request);
    const html = res && res.ok && (res.headers.get('content-type') || '').includes('text/html');
    if (html) cache.put('index.html', await cleanCopy(res.clone()));
    return res;
  };
  if (!saved) {
    try { return await pull(); }
    catch (err) {
      return new Response('The page could not be loaded. Check the connection and try again.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });
    }
  }
  try {
    return await Promise.race([pull(), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
  } catch (err) {
    return saved;
  }
}
/* own files: answer from the saved copy at once, refresh it in the background */
async function ownFile(request) {
  const cache = await caches.open(SHELL);
  const saved = await cache.match(request, { ignoreSearch: true });
  const fresh = fetch(request).then(res => { if (res && res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
  return saved || (await fresh) || Response.error();
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
