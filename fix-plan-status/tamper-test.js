#!/usr/bin/env node
/* tamper-test.js (gated-fix-plan): proves the gate can FAIL. A gate that cannot fail is worthless.
 *
 *   node <stage>/tamper-test.js <pristineCopy> <dryRunCopy>
 *
 * 1. Control: `gate post` on the dry-run copy must PASS (with mutation tests).
 * 2. Each tamper below is applied to a fresh copy and `gate post` must FAIL:
 *    never-applied, stray file added, each edited file drifted by one byte, an out-of-scope file changed,
 *    each generated file left stale, and the first edit undone (half-applied plan).
 * Exit code 0 only if the control passed and every tamper was caught. Works only on copies; never touches the project.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const L = require('./lib.js');
const HERE = __dirname;
const C = require(path.join(HERE, 'config.js'));
const EDITS = require(path.join(HERE, 'edits.js'));
const E = JSON.parse(fs.readFileSync(path.join(HERE, 'expected.json'), 'utf8'));
const [pristine, dry] = process.argv.slice(2).map(p => p && path.resolve(p));
if (!pristine || !dry) { console.error('usage: node tamper-test.js <pristineCopy> <dryRunCopy>'); process.exit(2); }

function gate(rootDir, skipMut) {
  const r = cp.spawnSync(process.execPath, [path.join(HERE, 'gate.js'), 'post'], {
    cwd: rootDir, encoding: 'utf8', maxBuffer: 64 << 20,
    env: { ...process.env, FIXPLAN_DRYRUN: '1', FIXPLAN_ROOT: rootDir, FIXPLAN_SKIP_MUT: skipMut ? '1' : '0' } });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status, result: (out.match(/^RESULT:.*$/m) || ['(no RESULT line)'])[0], fails: out.split(/\r?\n/).filter(l => l.startsWith('[FAIL]')).map(l => l.slice(7, 60)) };
}
const copyOf = (src, tag) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `fix-plan-tamper-${tag}-`)); L.copyProject(src, d, C); return d; };
const appendByte = (d, f) => fs.appendFileSync(path.join(d, f), '\n');

const tampers = [];
tampers.push({ name: 'plan never applied (pristine copy)', make: () => copyOf(pristine, 'none') });
tampers.push({ name: 'a stray file was added', make: () => { const d = copyOf(dry, 'stray'); fs.writeFileSync(path.join(d, 'stray-notes.txt'), 'x'); return d; } });
for (const f of C.edited) tampers.push({ name: `edited file drifted by one byte: ${f}`, make: () => { const d = copyOf(dry, 'drift'); appendByte(d, f); return d; } });
const outsider = Object.keys(E.baselineManifest).filter(f => !E.changed.includes(f)).sort((a, b) => (/\.(md|json|js|txt|html|css)$/.test(b) ? 1 : 0) - (/\.(md|json|js|txt|html|css)$/.test(a) ? 1 : 0))[0];
if (outsider) tampers.push({ name: `an out-of-scope file was changed: ${outsider}`, make: () => { const d = copyOf(dry, 'outside'); appendByte(d, outsider); return d; } });
for (const f of (C.generated || []).filter(g => E.changed.includes(g)))
  tampers.push({ name: `generated file left stale: ${f}`, make: () => { const d = copyOf(dry, 'stale'); fs.copyFileSync(path.join(pristine, f), path.join(d, f)); return d; } });
tampers.push({ name: `half-applied: edit "${EDITS[0].id}" undone`, make: () => {
  const d = copyOf(dry, 'half'), p = path.join(d, EDITS[0].file), r = L.replaceOnce(fs.readFileSync(p, 'utf8'), EDITS[0].replace, EDITS[0].find);
  if (r.n !== 1) throw new Error('cannot undo the first edit exactly once (its replacement text is not unique); pick another edit to undo');
  fs.writeFileSync(p, r.text); return d; } });

let ok = true;
console.log('control: gate post on the dry-run copy (full, with mutation tests)…');
const control = gate(dry, false);
console.log(`  ${control.code === 0 ? 'OK   ' : 'WRONG'} control must PASS -> ${control.result}`);
if (control.code !== 0) { ok = false; console.log('  failing checks: ' + control.fails.join(' | ')); }
for (const t of tampers) {
  let d;
  try { d = t.make(); } catch (e) { ok = false; console.log(`  WRONG could not build tamper "${t.name}": ${e.message}`); continue; }
  const r = gate(d, true);
  const caught = r.code === 1 && /^RESULT: FAIL/.test(r.result);
  if (!caught) ok = false;
  console.log(`  ${caught ? 'OK   ' : 'WRONG'} ${t.name} -> ${r.result.replace(/\s+\[DRY-RUN.*$/, '')}${caught ? '   caught by: ' + r.fails.slice(0, 4).join(', ') : ''}`);
  fs.rmSync(d, { recursive: true, force: true });
}
console.log(`\nTAMPER-TEST: ${ok ? 'PASS' : 'FAIL'}  (control ${control.code === 0 ? 'passed' : 'did NOT pass'}; ${tampers.length} tampers)`);
process.exit(ok ? 0 : 1);
