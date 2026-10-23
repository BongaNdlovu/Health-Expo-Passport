/* fix-plan-sw/edits.js: the ONLY changes this plan makes, applied in order by apply.js. sw.js is not touched.
   F1 the harness no longer crashes on sw.js reading request headers, so every section after it runs again
   F2 the service-worker tests check what sw.js does now (its comments say each change is deliberate)
   F3 the new sw.js behaviours are covered by tests that can fail */
module.exports = [
  {
    id: 'E1 the fake network says what each answer is',
    fixes: ['F2'],
    why: 'sw.js:56 saves a page only when the answer is text/html; the fake network answered everything as plain text, so no page was ever saved and the save test passed only on the install copy',
    protectedBy: ['M3', 'M5'],
    file: '.smoke/harness.js',
    find: `  let netFail = false, netCalls = [];
  const swSandbox = {`,
    replace: `  let netFail = false, netCalls = [];
  /* like a real host, every answer says what it is: pages are HTML, unless the address asks for plain text */
  const typeOfNet = u => /\\.js(\\?|$)/.test(u) ? 'application/javascript' : /\\.png(\\?|$)/.test(u) ? 'image/png' : /\\.woff2(\\?|$)/.test(u) ? 'font/woff2'
    : /[?&]plain=1/.test(u) ? 'text/plain' : 'text/html; charset=utf-8';
  const swSandbox = {`,
  },
  {
    id: 'E1b the fake fetch uses it',
    fixes: ['F2'],
    why: 'returns each answer with its content type',
    protectedBy: ['M3', 'M5'],
    file: '.smoke/harness.js',
    find: `    fetch: async r => { netCalls.push(typeof r === 'string' ? r : r.url); if (netFail) throw new TypeError('Failed to fetch'); return new Response('net:' + (typeof r === 'string' ? r : r.url)); },`,
    replace: `    fetch: async r => { const u = typeof r === 'string' ? r : r.url; netCalls.push(u); if (netFail) throw new TypeError('Failed to fetch');
      return new Response('net:' + u, { headers: { 'Content-Type': typeOfNet(u) } }); },`,
  },
  {
    id: 'E2 fake requests carry headers',
    fixes: ['F1'],
    why: 'sw.js:95 reads request.headers.get(\'User-Agent\'); the fake request had no headers, which crashed the harness at its first non-Supabase GET and hid every check after it',
    protectedBy: ['M1'],
    file: '.smoke/harness.js',
    find: `  const route = (url, init = {}) => { let out = { handled: false, promise: null };
    swHandlers.fetch({ request: { method: 'GET', mode: 'cors', url, ...init }, respondWith: p => { out.handled = true; out.promise = p; } }); return out; };`,
    replace: `  const route = (url, init = {}) => { let out = { handled: false, promise: null };
    /* a real request carries headers; init.ua stands for the browser's User-Agent */
    const { ua, ...rest } = init;
    const headers = { get: n => (String(n).toLowerCase() === 'user-agent' ? (ua || null) : null) };
    swHandlers.fetch({ request: { method: 'GET', mode: 'cors', url, headers, ...rest }, respondWith: p => { out.handled = true; out.promise = p; } }); return out; };`,
  },
  {
    id: 'E3 the save test checks the page that was fetched',
    fixes: ['F2'],
    why: 'it only checked startsWith("net:"), which the copy saved at install already satisfied',
    protectedBy: ['M5'],
    file: '.smoke/harness.js',
    find: `  ok('the fetched page is saved for offline use', (await (swCaches.get('newstart-shell-test1').get(keyOf('index.html')).clone().text())).startsWith('net:'));
`,
    replace: `  const savedPage = async () => (await swCaches.get('newstart-shell-test1').get(keyOf('index.html')).clone().text());
  ok('the fetched page is saved for offline use', (await savedPage()) === 'net:https://expo.example/?x=1');
`,
  },
  {
    id: 'E4 tests for the new sw.js behaviours',
    fixes: ['F3'],
    why: 'sw.js:56 (only HTML is saved), :95 (Android in-app browser loads pages itself) and :97 (the apk is never intercepted) had no test',
    protectedBy: ['M1', 'M2', 'M3'],
    file: '.smoke/harness.js',
    find: `  netFail = true;
  const offNav = route('https://expo.example/', { mode: 'navigate' });`,
    replace: `  const plainNav = route('https://expo.example/?plain=1', { mode: 'navigate' });
  if (plainNav.handled) await plainNav.promise;
  ok('an answer that is not a web page is not saved as the offline page', plainNav.handled && (await savedPage()) === 'net:https://expo.example/?x=1');
  const wv = route('https://expo.example/', { mode: 'navigate', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36' });
  const chrome = route('https://expo.example/', { mode: 'navigate', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36' });
  if (chrome.handled) await chrome.promise;
  ok('Android\\'s in-app browser (wv) loads pages itself, untouched by the worker', wv.handled === false && chrome.handled === true);
  ok('the app download (.apk) is never intercepted', route('https://expo.example/newstart.apk').handled === false);
  netFail = true;
  const offNav = route('https://expo.example/', { mode: 'navigate' });`,
  },
  {
    id: 'E4b a broken offline fallback fails its check instead of stopping the harness',
    fixes: ['F1', 'F3'],
    why: 'the test awaited the answer without catching a rejection, so a worker that rejected offline crashed the whole harness (every later check silently missing) instead of failing this one check',
    protectedBy: ['M6'],
    file: '.smoke/harness.js',
    find: `  const offNav = route('https://expo.example/', { mode: 'navigate' });
  ok('offline: the page opens from the saved copy', offNav.handled && (await (await offNav.promise).text()).startsWith('net:'));`,
    replace: `  const offNav = route('https://expo.example/', { mode: 'navigate' });
  /* a rejection must count as a failed check, not stop the harness */
  const offText = offNav.handled ? await offNav.promise.then(r => r.text(), () => '') : '';
  ok('offline: the page opens from the saved copy', offText.startsWith('net:'));`,
  },
  {
    id: 'E5 nothing saved yet: a 503 message, not a rejection',
    fixes: ['F2'],
    why: 'sw.js:48-50 and :60-64: a rejected answer shows on the phone as net::ERR_CACHE_MISS, so the worker now answers with a short 503 message; the test still expected a rejection',
    protectedBy: ['M4'],
    file: '.smoke/harness.js',
    find: `  const cold = route('https://expo.example/', { mode: 'navigate' });
  ok('offline with nothing saved yet: the failure is reported, not faked', cold.handled && await cold.promise.then(() => false, () => true));`,
    replace: `  const cold = route('https://expo.example/', { mode: 'navigate' });
  /* sw.js answers with a short 503 message instead of rejecting: a rejection shows on the phone as net::ERR_CACHE_MISS */
  const coldRes = cold.handled ? await cold.promise.then(r => r, () => null) : null;
  ok('offline with nothing saved yet: the failure is reported, not faked', !!coldRes && coldRes.status === 503 && /could not be loaded/.test(await coldRes.text()));`,
  },
];
