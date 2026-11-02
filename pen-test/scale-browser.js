/* Browser scale + memory-leak test for the built app (dist/), using puppeteer-core and the machine's Chrome.
   Part A — per-size timings at 1,000 / 3,000 / 10,000 visitors: cold load, tab renders, edit+save,
            change detection, and a 100-event realtime burst.
   Part B — leak protocol: 100 sustained use-cycles (renders, remote events, saves) with forced GC sampling of
            JS heap, DOM node count and event-listener count. A leak shows as a listener/node/heap ratchet.
   The page runs with window.NEWSTART_NO_CLOUD so nothing touches the live Supabase project.
   Usage: node pen-test/scale-browser.js [port]   → pen-test/results-browser.json */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = Number(process.argv[2] || 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SIZES = [1000, 3000, 10000];
const CYCLES = 100;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* database-row factories, applied inside the page through the app's own rowToAtt/rowToVol mapping */
function attendeeRow(i) {
  const id = 'EXPO-' + (1000 + i), t = Date.now();
  return { id, name: 'Visitor ' + i, age: 20 + (i % 60), sex: i % 2 ? 'Male' : 'Female',
    phone: '082 000 ' + String(i % 10000).padStart(4, '0'), email: '', height_cm: i % 7 ? 160 + (i % 30) : null,
    s: { sys: 118 + (i % 40), dia: 76 + (i % 25), sugar: 4.5 + (i % 30) / 10, chol: 3.8 + (i % 20) / 10,
      weight: 55 + (i % 45), veg: i % 5, walk: (i % 40) * 5, water: i % 8, sleep: 5 + (i % 5) },
    interests: i % 3 === 0 ? { optin: true } : {}, prayer: i % 9 === 0 ? 'Family' : '', done: i % 4 !== 0,
    chronic_list: i % 11 === 0 ? 'BP meds' : '', created_at: new Date(t - (100000 - i) * 60000).toISOString(),
    updated_at: new Date(t - (100000 - i) * 60000).toISOString() };
}
function volunteerRow(i) {
  const t = Date.now();
  return { id: 'VOL-' + (1001 + i), name: 'Helper ' + i, phone: '', email: '', status: i % 5 ? 'registered' : 'prospect',
    pledge_expos: 1, skills: [], pref: ['bp'], pref2: '', booth: i % 3 ? 'bp' : null, availability: [], shirt: 'M',
    emergency: '', since: '2024-01-01', notes: '', pledged_on: '2026-10-01', registered_on: i % 5 ? '2026-10-02' : null,
    checked_in: false, role: '', shift: '', lead: false, history: i % 10 ? [{ expo: 'E' + (i % 12), name: 'N', date: '2025-01-01', booth: 'bp', hours: 6 }] : [],
    created_at: new Date(t).toISOString(), updated_at: new Date(t).toISOString() };
}

async function metrics(cdp) {
  const m = (await cdp.send('Performance.getMetrics')).metrics;
  const get = n => Math.round(m.find(x => x.name === n).value);
  return { heapMB: +(get('JSHeapUsedSize') / 1048576).toFixed(1), nodes: get('Nodes'), listeners: get('JSEventListeners') };
}
/* run a page-side function (defined in Node, no closures) and time it inside the page */
async function timeEval(page, fn, ...args) {
  return page.evaluate(async (fnSrc, args) => {
    const f = eval('(' + fnSrc + ')');
    const t0 = performance.now();
    const out = await f(...args);
    return { ms: +(performance.now() - t0).toFixed(1), out };
  }, fn.toString(), args);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--disable-gpu', '--no-first-run', '--mute-audio',
      `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'pen-test-chrome-'))}`,
      '--window-size=412,915', '--disable-background-timer-throttling'],
    defaultViewport: { width: 412, height: 915, isMobile: true, hasTouch: true },
  });
  const results = { date: new Date().toISOString(), coldLoad: {}, warmLoad: {}, sizes: {}, leaks: {} };

  /* ---------- cold load (empty cache, service worker not yet installed) ---------- */
  {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { window.NEWSTART_NO_CLOUD = true; });
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable'); await cdp.send('Performance.enable');
    const bytes = { body: 0, n: 0 };
    cdp.on('Network.loadingFinished', async e => {
      try { const b = await cdp.send('Network.getResponseBody', { requestId: e.requestId });
        bytes.body += (b.base64 ? Math.ceil(b.body.length * 3 / 4) : b.body.length); bytes.n++; } catch (_) {}
    });
    const t0 = Date.now();
    await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction('!!window.__NEWSTART.__internals', { timeout: 30000 });
    results.coldLoad = { ms: Date.now() - t0, requests: bytes.n, bodyKB: Math.round(bytes.body / 1024) };
    await cdp.send('HeapProfiler.collectGarbage'); await sleep(300);
    results.coldLoad.heap = await metrics(cdp);
    await page.close();
  }

  /* ---------- warm load with the service worker controlling the page ---------- */
  {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { window.NEWSTART_NO_CLOUD = true; });
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const swState = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return 'none';
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      await new Promise(r => setTimeout(r, 800));
      return reg && navigator.serviceWorker.controller ? 'controlled' : 'installed-no-controller';
    });
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    const bytes = { body: 0, n: 0 };
    cdp.on('Network.loadingFinished', async e => {
      try { const b = await cdp.send('Network.getResponseBody', { requestId: e.requestId });
        bytes.body += (b.base64 ? Math.ceil(b.body.length * 3 / 4) : b.body.length); bytes.n++; } catch (_) {}
    });
    /* stale-while-revalidate: the page answers from the saved copy at once, and the revalidation download lands
       in the background — so the honest number is time-to-app-ready, not time-to-network-quiet */
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('!!window.__NEWSTART.__internals', { timeout: 30000 });
    const readyMs = Date.now() - t0;
    await sleep(1500);                        /* let the background revalidation finish for the byte count */
    results.warmLoad = { sw: swState, readyMs, ms: readyMs, requests: bytes.n, bodyKB: Math.round(bytes.body / 1024), note: 'bytes are the background refresh; the page opened from the saved copy' };
    await page.close();
  }

  /* ---------- per-size timings ---------- */
  for (const n of SIZES) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { window.NEWSTART_NO_CLOUD = true; });
    const cdp = await page.createCDPSession();
    await cdp.send('Performance.enable');
    const gc = () => cdp.send('HeapProfiler.collectGarbage');
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.waitForFunction('!!window.__NEWSTART.__internals');
    await page.evaluate(([ar, vr]) => { window.__seedAtt = eval('(' + ar + ')'); window.__seedVol = eval('(' + vr + ')'); },
      [attendeeRow.toString(), volunteerRow.toString()]);
    await page.evaluate((n) => {
      const g = window.__NEWSTART.__internals;
      g.attendees.length = 0; g.volunteers.length = 0;
      for (let i = 0; i < n; i++) g.attendees.push(g.rowToAtt(window.__seedAtt(i)));
      const vn = Math.max(30, Math.round(n * 0.3));
      for (let i = 0; i < vn; i++) g.volunteers.push(g.rowToVol(window.__seedVol(i)));
      g.state.activeId = g.attendees[0].id;
      g.persistNow();
      g.render();
    }, n);
    await sleep(300);
    await gc(); await sleep(250);
    const memBaseline = await metrics(cdp);

    const timings = {};
    /* render each serve tab */
    for (const tab of ['home', 'queue', 'care', 'serve', 'me']) {
      timings['tab_' + tab] = await timeEval(page, async (tab) => {
        const g = window.__NEWSTART.__internals;
        g.state.tab = tab; g.render();
      }, tab);
    }
    /* the visitor journey with one visitor open: screen → results → plan → send */
    timings.journey = await timeEval(page, async () => {
      const g = window.__NEWSTART.__internals;
      g.state.activeId = g.attendees[Math.floor(g.attendees.length / 2)].id;
      const t = {};
      g.state.tab = 'screen'; g.render(); t.screen = performance.now();
      g.state.tab = 'results'; g.render(); t.results = performance.now();
      g.state.tab = 'plan'; g.render(); t.plan = performance.now();
      g.state.tab = 'send'; g.render(); t.send = performance.now();
      return { screen: +(t.results - t.screen).toFixed(1), results: +(t.plan - t.results).toFixed(1), plan: +(t.send - t.plan).toFixed(1), send: +(performance.now() - t.send).toFixed(1) };
    });
    /* edit + save: the real write path (render + whole-dataset persist) */
    timings.editSaveMs = (await timeEval(page, async () => {
      const g = window.__NEWSTART.__internals; const a = g.attendees[0];
      const t0 = performance.now(); a.prayer = 'edit ' + Math.random(); g.render(); g.persistNow();
      return +(performance.now() - t0).toFixed(1);
    })).out;
    /* change detection: 5 passes of cloudPending, per pass — the cost paid before every upload */
    timings.dirtyMs = (await timeEval(page, async () => {
      const g = window.__NEWSTART.__internals; const t0 = performance.now();
      for (let i = 0; i < 5; i++) g.cloudPending();
      return +((performance.now() - t0) / 5).toFixed(1);
    })).out;
    /* saved-copy size */
    timings.savedCopyKB = await page.evaluate(() => Math.round((localStorage.getItem('newstart.passport.v2') || '').length / 1024));
    /* realtime burst: 100 remote UPDATE events fan through onRemoteChange (per-event merge is synchronous) */
    timings.burstSyncMs = (await timeEval(page, async () => {
      const g = window.__NEWSTART.__internals; const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        const a = g.attendees[(i * 97) % g.attendees.length];
        const row = g.attToRow({ ...a, s: { ...a.s, sys: 128 } });
        row.updated_at = new Date(Date.now() + i).toISOString();
        row.church_id = 'demo';
        g.onRemoteChange('att', { eventType: 'UPDATE', new: row });
      }
      return +(performance.now() - t0).toFixed(1);
    })).out;
    await sleep(1200);                        /* let the debounced refresh+persist settle */
    timings.renderAfterBurstMs = (await timeEval(page, async () => { window.__NEWSTART.__internals.render(); })).ms;
    /* memory with the dataset live */
    await gc(); await sleep(250);
    const memLoaded = await metrics(cdp);

    results.sizes[n] = { memBaseline, memLoaded, ...timings,
      tab: Object.fromEntries(Object.entries(timings).filter(([k]) => k.startsWith('tab_')).map(([k, v]) => [k.slice(4), v.ms])) };
    console.log(`size ${n}: heap ${memLoaded.heapMB} MB, nodes ${memLoaded.nodes}, listeners ${memLoaded.listeners}, ` +
      Object.entries(results.sizes[n].tab).map(([k, v]) => `${k} ${v}ms`).join(', '));
    await page.close();
  }

  /* ---------- leak protocol at 3,000 and 10,000 ---------- */
  for (const n of [3000, 10000]) {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { window.NEWSTART_NO_CLOUD = true; });
    const cdp = await page.createCDPSession();
    await cdp.send('Performance.enable');
    const gc = () => cdp.send('HeapProfiler.collectGarbage');
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await page.waitForFunction('!!window.__NEWSTART.__internals');
    await page.evaluate(([ar, vr]) => { window.__seedAtt = eval('(' + ar + ')'); window.__seedVol = eval('(' + vr + ')'); },
      [attendeeRow.toString(), volunteerRow.toString()]);
    await page.evaluate((n) => {
      const g = window.__NEWSTART.__internals;
      g.attendees.length = 0; g.volunteers.length = 0;
      for (let i = 0; i < n; i++) g.attendees.push(g.rowToAtt(window.__seedAtt(i)));
      const vn = Math.max(30, Math.round(n * 0.3));
      for (let i = 0; i < vn; i++) g.volunteers.push(g.rowToVol(window.__seedVol(i)));
      g.state.activeId = g.attendees[0].id;
      g.persistNow(); g.render();
    }, n);
    await sleep(300);
    await gc(); await sleep(300);
    const base = await metrics(cdp);
    const samples = [base];
    for (let c = 1; c <= CYCLES; c++) {
      await page.evaluate((c) => {
        const g = window.__NEWSTART.__internals;
        for (const tab of ['home', 'queue', 'care', 'serve', 'me', 'screen']) { g.state.tab = tab; g.render(); }
        /* a burst of live traffic: 20 remote updates + 5 local edits + a save */
        for (let i = 0; i < 20; i++) {
          const a = g.attendees[(c * 31 + i * 97) % g.attendees.length];
          const row = g.attToRow({ ...a, prayer: 'cycle ' + c });
          row.updated_at = new Date().toISOString(); row.church_id = 'demo';
          g.onRemoteChange('att', { eventType: 'UPDATE', new: row });
        }
        for (let i = 0; i < 5; i++) { const o = g.attendees[(c * 13 + i) % g.attendees.length]; o.s = { ...o.s, sys: 120 + (c % 40) }; }
        g.persistNow();
      }, c);
      if (c % 10 === 0) { await gc(); await sleep(120); samples.push(await metrics(cdp)); }
    }
    await gc(); await sleep(300);
    const end = await metrics(cdp);
    const heaps = samples.map(s => s.heapMB);
    const trend = +(heaps[heaps.length - 1] - heaps[1]).toFixed(1);
    results.leaks[n] = { baseline: base, end, samples, listenerDelta: end.listeners - base.listeners, nodeDelta: end.nodes - base.nodes,
      heapTrendMB: trend, verdict: (end.listeners - base.listeners) <= 2 && (end.nodes - base.nodes) < 500 && trend < 8 ? 'no leak' : 'INVESTIGATE' };
    console.log(`leak ${n}: listeners ${base.listeners}→${end.listeners} (Δ${end.listeners - base.listeners}), nodes Δ${end.nodes - base.nodes}, heap ${base.heapMB}→${end.heapMB} MB (trend ${trend} MB) → ${results.leaks[n].verdict}`);
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'results-browser.json'), JSON.stringify(results, null, 2));
  console.log('written pen-test/results-browser.json');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
