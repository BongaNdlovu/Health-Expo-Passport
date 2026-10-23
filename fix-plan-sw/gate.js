#!/usr/bin/env node
/* gate.js (gated-fix-plan): the hard gate of a gated fix plan.
 *
 *   node fix-plan/gate.js pre     before any edit (also writes verified backups of the edited files to the OS temp folder)
 *   node fix-plan/gate.js post    after apply.js and the generate command
 *
 * Every check must PASS. One FAIL, a crash, or a timeout = RESULT: FAIL = the plan has failed.
 * The gate never writes inside the project: tests and mutations run in temporary copies; backups and reports go to the
 * OS temp folder. All reference values come from expected.json, which make-expected.js MEASURED.
 *
 * Dry-run mode (only while authoring the plan): FIXPLAN_DRYRUN=1 FIXPLAN_ROOT=<copy>. The RESULT line then says DRY-RUN,
 * and a real execution must never show that word.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const L = require('./lib.js');
const HERE = __dirname;
const mode = process.argv[2];
if (!['pre', 'post'].includes(mode)) { console.error('usage: node fix-plan/gate.js pre|post'); process.exit(2); }
const DRY = process.env.FIXPLAN_DRYRUN === '1';
const root = DRY && process.env.FIXPLAN_ROOT ? path.resolve(process.env.FIXPLAN_ROOT) : process.cwd();
const SKIP_MUT = DRY && process.env.FIXPLAN_SKIP_MUT === '1';          /* tamper-test speed-up; never honoured outside a dry run */
const C = require(path.join(HERE, 'config.js'));
const E = JSON.parse(fs.readFileSync(path.join(HERE, 'expected.json'), 'utf8'));
const norm = L.normalizer(C);
const rd = f => fs.readFileSync(path.join(root, f));

const results = [];
function check(id, desc, ok, detail) {
  results.push({ id, desc, ok: !!ok, detail: ok ? '' : String(detail || '') });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}  ${desc}${ok ? '' : '\n         -> ' + String(detail || '').split('\n').slice(0, 8).join('\n            ')}`);
}
function finish() {
  const bad = results.filter(r => !r.ok), pass = bad.length === 0 && results.length > 0;
  const report = { mode, root, dryRun: DRY, skippedMutations: SKIP_MUT, node: process.version, at: new Date().toISOString(), passed: results.length - bad.length, total: results.length, checks: results };
  const out = path.join(os.tmpdir(), `fix-plan-gate-report-${mode}${DRY ? '-dryrun' : ''}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(`\nreport: ${out}  (sha256 ${L.sha(fs.readFileSync(out)).slice(0, 16)}…)`);
  console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}  (${report.passed}/${results.length} checks passed, mode=${mode})${DRY ? `  [DRY-RUN root=${root}${SKIP_MUT ? ', mutations skipped' : ''}]` : ''}`);
  process.exit(pass ? 0 : 1);
}
const crash = e => { check('CRASH', 'the gate itself crashed (counts as FAIL)', false, e && e.stack || e); finish(); };
process.on('uncaughtException', crash);

const tmpCopy = tag => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `fix-plan-${tag}-`)); L.copyProject(root, d, C); return d; };
const rmrf = d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { } };
async function testsInCopy() { const d = tmpCopy('test'); try { const r = await L.runTests(d, C); r.rows = L.stabilize(r.rows, C); return r; } finally { rmrf(d); } }

function tooling() {
  for (const [f, want] of Object.entries(E.toolHashes)) {
    const got = L.sha(fs.readFileSync(path.join(HERE, f)));
    check('T-' + f, `${f} is the audited version (${want.slice(0, 12)}…)`, got === want, `got ${got.slice(0, 12)}…`);
  }
}
function invariants(label) {
  for (const inv of C.invariants || []) check(`I-${inv.id}`, `${label}: ${inv.desc}`, L.invariantHash(root, inv) === E.invariants[inv.id], `${inv.file} region changed or not found`);
}

/* ================================================================== PRE */
async function pre() {
  tooling();
  const cur = L.manifest(root, C), base = E.baselineManifest;
  const changed = Object.keys(base).filter(f => cur[f] !== base[f]), added = Object.keys(cur).filter(f => !(f in base));
  check('B1', `project is byte-identical to the planned baseline (${Object.keys(base).length} files)`, !changed.length && !added.length,
    `changed or missing: ${changed.join(', ') || '-'}; added: ${added.join(', ') || '-'}  (baseline drifted: re-plan)`);
  for (const a of E.anchors) {
    const m = L.measureAnchor(root, a);
    check(`A-${a.file}:${a.lines.join(',')}`, `"${a.needle.slice(0, 60)}" is at line(s) ${a.lines.join(',')}, ${a.occurrences}x`,
      JSON.stringify(m.lines) === JSON.stringify(a.lines) && m.occurrences === a.occurrences, `found line(s) ${m.lines.join(',') || 'none'}, ${m.occurrences}x`);
  }
  for (const [f, e] of Object.entries(E.eol)) check(`EOL-${f}`, `${f} uses ${e} line endings`, L.eolOf(rd(f).toString('utf8')) === e, '');
  invariants('baseline');
  const t = await testsInCopy();
  check('H0a', `baseline tests: ${E.testBefore.total} results, ${E.testBefore.pass} PASS / ${E.testBefore.fail} FAIL${(C.flaky || []).length ? ` (+${(C.flaky || []).length} flaky, any status)` : ''}`, !t.timedOut && t.rows.length === E.testBefore.total && L.tally(t.rows).pass === E.testBefore.pass && L.tally(t.rows).fail === E.testBefore.fail,
    t.timedOut ? 'test run timed out' : JSON.stringify(L.tally(t.rows)));
  const d = L.multisetDiff(t.rows, E.testBefore.rows);
  check('H0b', 'baseline tests: every test name and status is exactly as recorded', d.length === 0, d.join('\n'));
  const bdir = path.join(os.tmpdir(), 'fix-plan-backup');
  fs.mkdirSync(bdir, { recursive: true });
  for (const f of C.edited) fs.writeFileSync(path.join(bdir, f.replace(/[\\/]/g, '__')), rd(f));
  check('BK', `backups of ${C.edited.join(', ')} written to ${bdir} and verified`, C.edited.every(f => L.sha(fs.readFileSync(path.join(bdir, f.replace(/[\\/]/g, '__')))) === base[f]), '');
  finish();
}

/* ================================================================== POST */
async function post() {
  tooling();
  const A = E.afterManifest, B = E.baselineManifest, cur = L.manifest(root, C);
  const all = new Set([...Object.keys(B), ...Object.keys(cur)]);
  const changedNow = [...all].filter(f => B[f] !== cur[f]).sort();
  check('S1', `exactly these files changed: ${E.changed.join(', ')}`, JSON.stringify(changedNow) === JSON.stringify(E.changed), `changed/added/removed now: ${changedNow.join(', ') || '(none)'}`);
  const missing = Object.keys(B).filter(f => !(f in cur)), added = Object.keys(cur).filter(f => !(f in B));
  check('S2', 'no file was added or deleted', !missing.length && !added.length, `missing: ${missing.join(', ') || '-'}; added: ${added.join(', ') || '-'}`);
  for (const f of E.changed) check(`X-${f}`, `${f} is byte-identical to the dry-run result (${(A[f] || 'deleted').slice(0, 12)}…)`, cur[f] === A[f], `got ${(cur[f] || 'missing').slice(0, 12)}…`);
  const others = Object.keys(B).filter(f => !E.changed.includes(f));
  const drift = others.filter(f => cur[f] !== B[f]);
  check('S3', `the other ${others.length} files are byte-identical to the baseline`, !drift.length, drift.join(', '));
  invariants('after');

  for (const c of C.checks || []) {
    const r = cp.spawnSync(c.cmd, c.args || [], { cwd: root, encoding: 'utf8', shell: !!c.shell, timeout: 120000 });
    check(`C-${c.id}`, c.desc, r.status === 0, (r.stderr || r.stdout || r.error || '').toString().slice(0, 400));
  }

  if (C.generate && (C.generated || []).length) {
    const d = tmpCopy('gen');
    try {
      for (const f of C.generated) rmrf(path.join(d, f));
      const r = cp.spawnSync(C.generate.cmd, C.generate.args || [], { cwd: d, encoding: 'utf8', shell: !!C.generate.shell, timeout: 300000 });
      const diff = C.generated.filter(f => !fs.existsSync(path.join(d, f)) || !fs.readFileSync(path.join(d, f)).equals(rd(f)));
      check('G1', `generated files are exactly what "${[C.generate.cmd, ...(C.generate.args || [])].join(' ')}" produces from the current sources`, r.status === 0 && !diff.length,
        r.status !== 0 ? 'generate command failed: ' + (r.stderr || '').slice(0, 300) : 'stale or different: ' + diff.join(', '));
    } finally { rmrf(d); }
  }

  const t = await testsInCopy();
  const tl = L.tally(t.rows), total = E.testAfter.total;
  check('H1', `tests: ${total} results and at least ${E.testAfter.pass} PASS`, !t.timedOut && t.rows.length === total && tl.pass >= E.testAfter.pass, t.timedOut ? 'timed out' : JSON.stringify(tl));
  const unrelated = new Set((C.unrelatedFails || []).map(norm));
  const fails = t.rows.filter(r => r[0] === 'FAIL').map(r => r[1]);
  check('H2', `every remaining FAIL is one of the ${unrelated.size} known unrelated tests`, fails.every(n => unrelated.has(n)), 'unexpected FAIL: ' + fails.filter(n => !unrelated.has(n)).join(' | '));
  const d = L.multisetDiff(t.rows.filter(r => !unrelated.has(r[1])), E.testAfter.rows.filter(r => !unrelated.has(r[1])));
  check('H3', 'every other test has exactly the recorded name and status (nothing renamed, dropped, added or weakened)', d.length === 0, d.join('\n'));
  const passing = new Set(t.rows.filter(r => r[0] === 'PASS').map(r => r[1]));
  const req = (C.requiredPass || []).map(norm), missingReq = req.filter(n => !passing.has(n));
  check('H4', `all ${req.length} required tests are present and PASS`, req.length > 0 && !missingReq.length, missingReq.length ? 'missing or failing: ' + missingReq.join(' | ') : 'config.requiredPass is empty');
  const obsolete = (C.obsoleteNames || []).map(norm);
  check('H5', `the ${obsolete.length} obsolete test name(s) no longer exist`, !t.rows.some(r => obsolete.includes(r[1])), t.rows.filter(r => obsolete.includes(r[1])).map(r => r[1]).join(' | '));

  /* mutation tests: break the real code on purpose; the matching tests MUST fail, or they prove nothing */
  const muts = C.mutations || [];
  check('M0', `${muts.length} mutation test(s) are defined`, muts.length > 0, 'config.mutations is empty: the new tests are unproven');
  if (SKIP_MUT) { check('M-SKIP', 'mutation tests skipped (dry-run speed-up only)', true); return finish(); }
  const queue = [...muts], outRes = [];
  async function worker() {
    while (queue.length) {
      const m = queue.shift(), dir = tmpCopy('mut-' + m.id);
      try {
        const p = path.join(dir, m.file), r = L.replaceOnce(fs.readFileSync(p, 'utf8'), m.find, m.replace);
        if (r.n !== 1) { outRes.push({ m, err: `the mutation text matched ${r.n} times (must be exactly 1), so this mutation test is invalid` }); continue; }
        fs.writeFileSync(p, r.text);
        outRes.push({ m, res: await L.runTests(dir, C) });
      } finally { rmrf(dir); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(C.parallel || 3, muts.length) }, worker));
  outRes.sort((a, b) => muts.indexOf(a.m) - muts.indexOf(b.m));
  for (const o of outRes) {
    if (o.err) { check(`MUT-${o.m.id}`, o.m.what, false, o.err); continue; }
    const failed = new Set(o.res.rows.filter(r => r[0] === 'FAIL').map(r => r[1]));
    const notCaught = o.m.mustFail.map(norm).filter(n => !failed.has(n));
    check(`MUT-${o.m.id}`, `breaking the code (${o.m.what}) makes the matching tests FAIL`, o.res.rows.length > 0 && !notCaught.length,
      o.res.rows.length ? 'NOT caught: ' + notCaught.join(' | ') : 'the test run produced no results (a crash is not a catch)');
  }
  finish();
}

(mode === 'pre' ? pre() : post()).catch(crash);
