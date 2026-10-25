#!/usr/bin/env node
/* make-expected.js (gated-fix-plan): MEASURES everything the gate will later compare against, and writes expected.json.
 *
 *   node <stage>/make-expected.js <pristineCopy> <dryRunCopy>
 *
 *   <pristineCopy> : untouched copy of the project (baseline).
 *   <dryRunCopy>   : copy where apply.js (and the generate command, if any) has been run.
 *
 * It refuses to write expected.json if the plan contradicts itself: an anchor that does not exist, a dry run that
 * touched a file outside the allowlist, an edited file that did not change, an invariant that changed, a required
 * test that does not pass, an obsolete test that still exists, a mutation whose text does not match exactly once.
 * expected.json is never edited by hand: regenerate it.
 */
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib.js');
const HERE = __dirname;
const C = require(path.join(HERE, 'config.js'));
const [pristine, dry] = process.argv.slice(2).map(p => p && path.resolve(p));
if (!pristine || !dry) { console.error('usage: node make-expected.js <pristineCopy> <dryRunCopy>'); process.exit(2); }

(async () => {
  const problems = [];
  const toolHashes = {};
  for (const f of ['config.js', 'edits.js', 'apply.js', 'lib.js', 'scope-report.js']) toolHashes[f] = L.sha(fs.readFileSync(path.join(HERE, f)));

  const baselineManifest = L.manifest(pristine, C), afterManifest = L.manifest(dry, C);
  const all = new Set([...Object.keys(baselineManifest), ...Object.keys(afterManifest)]);
  const changed = [...all].filter(f => baselineManifest[f] !== afterManifest[f]).sort();
  const allowed = new Set([...C.edited, ...(C.generated || [])]);
  const outOfScope = changed.filter(f => !allowed.has(f));
  if (outOfScope.length) problems.push('dry run changed files outside the allowlist: ' + outOfScope.join(', '));
  for (const f of C.edited) if (!changed.includes(f)) problems.push(`edited file ${f} did not change in the dry run`);

  const anchors = (C.anchors || []).map(a => ({ ...a, ...L.measureAnchor(pristine, a) }));
  for (const a of anchors) if (!a.occurrences) problems.push(`anchor not found (would be a false claim): ${a.file}: ${a.needle}`);

  const eol = {}; for (const f of C.edited) eol[f] = L.eolOf(fs.readFileSync(path.join(pristine, f), 'utf8'));

  const invariants = {};
  for (const inv of C.invariants || []) {
    const b = L.invariantHash(pristine, inv), a = L.invariantHash(dry, inv);
    if (!b) problems.push(`invariant ${inv.id} does not match anything in ${inv.file}`);
    else if (a !== b) problems.push(`invariant ${inv.id} (${inv.desc}) changed in the dry run`);
    invariants[inv.id] = b;
  }

  for (const m of C.mutations || []) {
    const n = L.replaceOnce(fs.readFileSync(path.join(dry, m.file), 'utf8'), m.find, m.replace).n;
    if (n !== 1) problems.push(`mutation ${m.id}: find text matches ${n} times in the dry-run ${m.file} (must be exactly 1)`);
  }

  /* one at a time: running suites in parallel slows the machine and flips timing-sensitive tests */
  console.log('running tests on the pristine copy, then the dry-run copy…');
  const before = await L.runTests(pristine, C), after = await L.runTests(dry, C);
  before.rows = L.stabilize(before.rows, C); after.rows = L.stabilize(after.rows, C);
  if (!before.rows.length) problems.push('the test command produced no parsable result lines on the pristine copy (check config.test.line)');
  if (!after.rows.length) problems.push('the test command produced no parsable result lines on the dry-run copy');
  const afterFail = after.rows.filter(r => r[0] === 'FAIL').map(r => r[1]);
  const afterPass = new Set(after.rows.filter(r => r[0] === 'PASS').map(r => r[1]));
  const norm = L.normalizer(C);
  const flaky = new Set((C.flaky || []).map(norm));
  for (const n of [...(C.requiredPass || []), ...(C.targets || [])].map(norm)) if (flaky.has(n)) problems.push('a target or required test cannot also be flaky: ' + n);
  for (const n of flaky) if (!before.rows.some(r => r[1] === n)) problems.push('flaky test not found in the baseline run: ' + n);
  const unrelated = new Set((C.unrelatedFails || []).map(norm));
  for (const n of afterFail) if (!unrelated.has(n)) problems.push('after the dry run this test still FAILS and is not listed as unrelated: ' + n);
  for (const n of (C.requiredPass || []).map(norm)) if (!afterPass.has(n)) problems.push('required test does not PASS after the dry run: ' + n);
  for (const n of (C.obsoleteNames || []).map(norm)) if (after.rows.some(r => r[1] === n)) problems.push('obsolete test still exists after the dry run: ' + n);
  for (const n of (C.targets || []).map(norm)) if (!before.rows.some(r => r[0] === 'FAIL' && r[1] === n)) problems.push('target is not actually FAILING on the baseline: ' + n);
  /* a mustFail test that does not PASS on the fixed code can never prove a mutation; catch it now, not in the gate */
  for (const m of C.mutations || []) for (const n of m.mustFail.map(norm)) if (!afterPass.has(n)) problems.push(`mutation ${m.id}: mustFail test does not PASS after the dry run: ${n}`);

  if (problems.length) { console.error('\nexpected.json NOT written. The plan contradicts the measurements:\n - ' + problems.join('\n - ')); process.exit(1); }

  const exp = {
    note: 'MEASURED by make-expected.js. Never edit by hand; regenerate instead.',
    toolHashes, baselineManifest, afterManifest, changed, anchors, eol, invariants,
    testBefore: { ...L.tally(before.rows), total: before.rows.length, exitCode: before.code, rows: before.rows },
    testAfter: { ...L.tally(after.rows), total: after.rows.length, exitCode: after.code, rows: after.rows },
  };
  fs.writeFileSync(path.join(HERE, 'expected.json'), JSON.stringify(exp, null, 1));
  console.log(`expected.json written: ${Object.keys(baselineManifest).length} baseline files; changed: ${changed.join(', ')}`);
  console.log(`tests before ${JSON.stringify(L.tally(before.rows))} (exit ${before.code}) -> after ${JSON.stringify(L.tally(after.rows))} (exit ${after.code})`);
  for (const a of anchors) console.log(`  anchor ${a.file}:${a.lines.join(',')} x${a.occurrences}  ${a.needle.slice(0, 70)}`);
  /* the plan document pins these two; the gate pins the rest through expected.json */
  for (const f of ['gate.js', 'expected.json']) console.log(`PIN ${f} sha256 ${L.sha(fs.readFileSync(path.join(HERE, f)))}`);
})().catch(e => { console.error(e.stack); process.exit(1); });
