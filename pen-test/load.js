/* Load test: 1,000 → 10,000 simulated users against the local preview server (tools/serve.js).
   Zero dependencies. Controller forks worker processes, each holding a share of users on keep-alive sockets.
   Each user repeats the app's cold-boot fetch sequence with no think time (saturation), so the numbers are a
   lower bound on capacity: real users pause between screens.
   Usage: node pen-test/load.js [port]
   Writes pen-test/results-load.json and prints a table. */
'use strict';
const { fork, spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = Number(process.argv[2] || 4173);
const HOST = '127.0.0.1';
const WARMUP = { users: 100, seconds: 8 };
const PHASES = [1000, 2500, 5000, 10000].map(n => ({ users: n, seconds: 30 }));
const USERS_PER_WORKER = 2500;
const SEQ = ['/', '/sw.js', '/version.json', '/manifest.webmanifest', '/icons/icon-192.png'];
const TIMEOUT_MS = 15000;

/* ---------- worker mode ---------- */
if (process.env.LOAD_WORKER) {
  const { users, seconds, offset } = JSON.parse(process.env.LOAD_WORKER);
  const agent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
  const lat = [];                              /* all durations, ms */
  const errs = { status: 0, socket: 0, timeout: 0 };
  let done = 0;
  const deadline = Date.now() + seconds * 1000;

  function get(p) {
    return new Promise(resolve => {
      const t0 = process.hrtime.bigint();
      const req = http.request({ host: HOST, port: PORT, path: p, agent, timeout: TIMEOUT_MS }, res => {
        res.resume();
        res.on('end', () => {
          lat.push(Number(process.hrtime.bigint() - t0) / 1e6);
          done++;
          resolve(res.statusCode === 200 ? null : 'status');
        });
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.on('error', e => {
        lat.push(Number(process.hrtime.bigint() - t0) / 1e6);
        done++;
        errs[e.message === 'timeout' ? 'timeout' : 'socket']++;
        resolve(e.message === 'timeout' ? 'timeout' : 'socket');
      });
      req.end();
    });
  }

  async function user(i) {
    /* stagger the first wave so 10k connects do not land in the same event-loop tick */
    await new Promise(r => setTimeout(r, (i % 2500) * 0.4));
    while (Date.now() < deadline) {
      for (const p of SEQ) {
        const e = await get(p);
        if (e === 'status') errs.status++;
        if (Date.now() >= deadline) break;
      }
    }
  }
  (async () => {
    await Promise.all(Array.from({ length: users }, (_, i) => user(i)));
    agent.destroy();
    lat.sort((a, b) => a - b);
    const pct = q => lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0;
    process.send({ users, requests: done, errors: errs, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: lat.length ? lat[lat.length - 1] : 0 });
    process.exit(0);
  })();
  return;
}

/* ---------- controller ---------- */
function canCanary() {
  return new Promise(resolve => {
    const t0 = Date.now();
    http.get({ host: HOST, port: PORT, path: '/version.json' }, res => {
      res.resume(); res.on('end', () => resolve({ ms: Date.now() - t0, ok: res.statusCode === 200 }));
    }).on('error', () => resolve({ ms: -1, ok: false }));
  });
}
function serverRSS(pid) {
  return new Promise(resolve => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-Command',
      `(Get-Process -Id ${pid}).PrivateMemorySize64`], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ps.stdout.on('data', d => out += d);
    ps.on('close', () => resolve(Number(out.trim()) || 0));
    ps.on('error', () => resolve(0));
  });
}
function phase(users, seconds, srvPid) {
  return new Promise(resolve => {
    const workers = Math.ceil(users / USERS_PER_WORKER);
    const per = Math.floor(users / workers);
    const rss = [];
    const canary = [];
    const started = Date.now();
    const rssTimer = setInterval(() => { serverRSS(srvPid).then(v => { if (v) rss.push(v); }); }, 2000);
    const canTimer = setInterval(() => { canCanary().then(v => canary.push(v)); }, 1000);
    let settled = 0;
    const results = [];
    for (let w = 0; w < workers; w++) {
      const child = fork(__filename, [], { silent: true, env: {
        ...process.env, LOAD_WORKER: JSON.stringify({ users: per, seconds, offset: w * per }) } });
      child.on('message', m => results.push(m));
      child.on('exit', () => { if (++settled === workers) finish(); });
    }
    function finish() {
      clearInterval(rssTimer); clearInterval(canTimer);
      const agg = results.reduce((a, r) => ({
        requests: a.requests + r.requests,
        errors: { status: a.errors.status + r.errors.status, socket: a.errors.socket + r.errors.socket, timeout: a.errors.timeout + r.errors.timeout },
      }), { requests: 0, errors: { status: 0, socket: 0, timeout: 0 } });
      const latSamples = Math.round(agg.requests);
      resolve({
        users, seconds, workers,
        requests: agg.requests, rps: +(agg.requests / seconds).toFixed(1),
        errors: agg.errors,
        p50: +median(results.map(r => r.p50)).toFixed(1),
        p95: +median(results.map(r => r.p95)).toFixed(1),
        p99: +median(results.map(r => r.p99)).toFixed(1),
        max: Math.max(...results.map(r => r.max), 0),
        rssStartMB: +(rss[0] / 1048576 || 0).toFixed(1),
        rssPeakMB: +(Math.max(...rss, 0) / 1048576).toFixed(1),
        canaryP95: +median(canary.filter(c => c.ok).map(c => c.ms)).toFixed(1),
        wallSeconds: +((Date.now() - started) / 1000).toFixed(1),
        note: `${latSamples} samples`,
      });
    }
  });
}
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

(async () => {
  /* the server under test */
  const SRV = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'serve.js')], {
    env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const up = await canCanary();
  if (!up.ok) { console.error('server did not start'); SRV.kill(); process.exit(1); }
  console.log(`server up on :${PORT} (pid ${SRV.pid})`);

  console.log(`warmup: ${WARMUP.users} users × ${WARMUP.seconds}s`);
  await phase(WARMUP.users, WARMUP.seconds, SRV.pid);

  const rows = [];
  for (const p of PHASES) {
    process.stdout.write(`phase ${p.users} users … `);
    const r = await phase(p.users, p.seconds, SRV.pid);
    rows.push(r);
    console.log(`${r.rps} req/s, p95 ${r.p95} ms, p99 ${r.p99} ms, errors ${r.errors.status + r.errors.socket + r.errors.timeout}, RSS ${r.rssPeakMB} MB`);
    await new Promise(res => setTimeout(res, 4000));   /* drain between phases */
  }

  SRV.kill();
  const coldKB = Math.round(fs.statSync(path.join(__dirname, '..', 'dist', 'index.html')).size / 1024);
  const report = { date: new Date().toISOString(), host: `${HOST}:${PORT}`, coldShellKB: coldKB, warmup: WARMUP, phases: rows,
    realism: { coldOpens10kMB: +(coldKB * 10000 / 1024).toFixed(0), note: 'MB of shell HTML for 10,000 cold opens (uncompressed; ~4x less over brotli)' } };
  fs.writeFileSync(path.join(__dirname, 'results-load.json'), JSON.stringify(report, null, 2));
  console.log('\nphase | users |   req/s |  p50 |  p95 |  p99 |   max | errors | server RSS peak | canary p95');
  for (const r of rows)
    console.log(`${String(r.users).padStart(5)} | ${String(r.users).padStart(5)} | ${String(r.rps).padStart(7)} | ${String(r.p50).padStart(4)} | ${String(r.p95).padStart(4)} | ${String(r.p99).padStart(4)} | ${String(r.max).padStart(5)} | ${String(r.errors.status + r.errors.socket + r.errors.timeout).padStart(6)} | ${String(r.rssPeakMB).padStart(13)} | ${String(r.canaryP95).padStart(8)}`);
  process.exit(0);
})();
