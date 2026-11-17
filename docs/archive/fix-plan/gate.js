/* fix-plan/gate.js: the hard gate for FIX-PLAN-harness-failures.md
 *
 *   node fix-plan/gate.js pre     before any edit  (also makes the backups)
 *   node fix-plan/gate.js post    after apply.js and tools/build.js
 *
 * RULES THIS FILE ENFORCES
 *  - Every check must PASS. One FAIL, one skipped check or one crash = RESULT: FAIL = the whole plan has failed.
 *  - It only READS the project. Backups and reports go to the OS temp folder.
 *  - Every number it compares against comes from expected.json, which was MEASURED (make-expected.js), never typed by hand.
 *  - Nothing is reported as true unless a check above printed it.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process'), os = require('os');

const PINNED = { 'apply.js': 'f92bf0177fff939d2ccee8b1adf8be644cdaab5b6104942c75145043c04f44e0', 'expected.json': '58ca088e892f38b0275b72fb641bbb9f4f03506121e0792b6e412b341fd1f12c' };      /* filled in when the tooling is finalised */
const mode = process.argv[2];
if (!['pre', 'post'].includes(mode)) { console.error('usage: node fix-plan/gate.js pre|post'); process.exit(2); }
const root = (process.env.FIXPLAN_DRYRUN === '1' && process.env.FIXPLAN_ROOT) ? path.resolve(process.env.FIXPLAN_ROOT) : process.cwd();
const here = __dirname;
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rd = f => fs.readFileSync(path.join(root, f));
const E = JSON.parse(fs.readFileSync(path.join(here, 'expected.json'), 'utf8'));

const results = [];
let fatal = false;
function check(id, desc, ok, detail) {
  results.push({ id, desc, ok: !!ok, detail: ok ? '' : String(detail || '') });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}  ${desc}${ok ? '' : '\n         → ' + String(detail || '').split('\n').slice(0, 6).join('\n           ')}`);
}
function finish() {
  const bad = results.filter(r => !r.ok);
  const report = { mode, root, node: process.version, checks: results, passed: results.length - bad.length, failed: bad.length };
  const out = path.join(os.tmpdir(), `fix-plan-gate-report-${mode}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log(`\nreport: ${out}  (sha256 ${sha(fs.readFileSync(out)).slice(0, 16)}…)`);
  console.log(`RESULT: ${bad.length === 0 && results.length > 0 ? 'PASS' : 'FAIL'}  (${report.passed}/${results.length} checks passed, mode=${mode})`);
  process.exit(bad.length === 0 && results.length > 0 ? 0 : 1);
}
process.on('uncaughtException', e => { check('CRASH', 'the gate itself crashed (counts as FAIL)', false, e.stack); finish(); });

/* ---------- helpers ---------- */
const SKIP_DIR = new Set(['build', '.gradle', 'node_modules', '.claude', 'fix-plan']);
const SKIP_FILE = new Set(['FIX-PLAN-harness-failures.md']);
function manifest(r) {
  const out = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(path.join(d, e.name)); continue; }
      const rel = path.relative(r, path.join(d, e.name)).split(path.sep).join('/');
      if (SKIP_FILE.has(rel)) continue;
      out[rel] = sha(fs.readFileSync(path.join(d, e.name)));
    }
  })(r);
  return out;
}
const norm = n => n.replace(/\s*\(.*\)\s*$/, '');       /* drop the trailing "(123 ms)" style detail, which varies from run to run */
function parseRows(text) {
  const rows = [];
  for (const l of text.split(/\r?\n/)) { const m = /^  (PASS|FAIL)  (.*?)(?:  → .*)?$/.exec(l); if (m) rows.push([m[1], norm(m[2])]); }
  return rows;
}
function runHarness(appHtml) {
  return new Promise(res => {
    const env = { ...process.env }; if (appHtml) env.APP_HTML = appHtml; else delete env.APP_HTML;
    const p = cp.spawn(process.execPath, ['.smoke/harness.js'], { cwd: root, env });
    let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', () => res(parseRows(out)));
  });
}
const tally = rows => ({ pass: rows.filter(r => r[0] === 'PASS').length, fail: rows.filter(r => r[0] === 'FAIL').length });
const keyCount = rows => { const m = new Map(); for (const [s, n] of rows) m.set(s + '|' + n, (m.get(s + '|' + n) || 0) + 1); return m; };
function sameMultiset(a, b) {
  const x = keyCount(a), y = keyCount(b), diff = [];
  for (const [k, v] of x) if (y.get(k) !== v) diff.push(`${k}: ${v} vs ${y.get(k) || 0}`);
  for (const [k, v] of y) if (!x.has(k)) diff.push(`${k}: 0 vs ${v}`);
  return diff;
}
const scriptOf = html => /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const UNRELATED = ['change detection over 3900 rows is fast', 'the next poll is down to one small request per table', '120 visitors registered offline are all pending',
  'the whole backlog uploads on reconnect', '500 live inserts from other desks are applied'];

/* ---------- checks common to both modes ---------- */
function tooling() {
  for (const [f, want] of Object.entries(PINNED)) {
    const got = sha(fs.readFileSync(path.join(here, f)));
    check('T-' + f, `${f} is the audited version (sha256 ${want.slice(0, 12)}…)`, got === want, `got ${got}`);
  }
}

/* ================================================================== PRE */
async function pre() {
  tooling();
  const cur = manifest(root), base = E.baselineManifest;
  const changed = Object.keys(base).filter(f => cur[f] !== base[f]), added = Object.keys(cur).filter(f => !(f in base));
  check('B1', `project is byte-identical to the planned baseline (${Object.keys(base).length} files)`, !changed.length && !added.length,
    `changed: ${changed.join(', ') || '-'}; added: ${added.join(', ') || '-'}`);
  for (const a of E.anchors) {
    const text = rd(a.file).toString('utf8');
    const lines = text.split(/\r?\n/).map((l, i) => l.includes(a.needle) ? i + 1 : 0).filter(Boolean);
    const occ = text.split(a.needle).length - 1;
    check('A-' + a.file + ':' + a.lines.join(','), `anchor "${a.needle.slice(0, 60)}" is at line(s) ${a.lines.join(',')}, ${a.occurrences}×`,
      JSON.stringify(lines) === JSON.stringify(a.lines) && occ === a.occurrences, `found lines ${JSON.stringify(lines)} ×${occ}`);
  }
  for (const [f, eol] of Object.entries(E.eol)) check('EOL-' + f, `${f} line endings are ${eol}`, (rd(f).toString('utf8').includes('\r\n') ? 'CRLF' : 'LF') === eol, '');
  const rows = await runHarness();
  const t = tally(rows);
  check('H0a', `baseline harness: ${E.harnessBefore.pass} PASS / ${E.harnessBefore.fail} FAIL`, t.pass === E.harnessBefore.pass && t.fail === E.harnessBefore.fail, JSON.stringify(t));
  const d = sameMultiset(rows, E.harnessBefore.rows);
  check('H0b', 'baseline harness: every check name and status is exactly as recorded', d.length === 0, d.join('\n'));
  /* backups outside the project */
  const bdir = path.join(os.tmpdir(), 'fix-plan-backup'); fs.mkdirSync(bdir, { recursive: true });
  for (const f of ['index.html', '.smoke/harness.js']) fs.writeFileSync(path.join(bdir, f.replace(/[\\/]/g, '__')), rd(f));
  const ok = ['index.html', '.smoke/harness.js'].every(f => sha(fs.readFileSync(path.join(bdir, f.replace(/[\\/]/g, '__')))) === E.baselineManifest[f]);
  check('BK', `backups written to ${bdir} and verified against the baseline hashes`, ok, '');
  finish();
}

/* ================================================================== POST */
const MUTATIONS = [
  { id: 'M1', what: 'an impossible reading is clamped instead of rejected', find: "  a.s[k]=null;\n  const d=Math.round(v)/10,fix=", repl: "  a.s[k]=max;\n  const d=Math.round(v)/10,fix=",
    mustFail: ['too-high reading is not saved (and not clamped to 30)', 'blood pressure 300 is not saved and gets no decimal "fix"'] },
  { id: 'M2', what: 'the first stepper tap applies a step', find: " a.s[k]=a.s[k]==null?def:clamp(Math.round((a.s[k]+d*step)*10)/10,min,max);", repl: " a.s[k]=clamp(Math.round(((a.s[k]==null?def:a.s[k])+d*step)*10)/10,min,max);",
    mustFail: ['first + tap on an empty field shows the default', 'first − tap on an empty field also shows the default', 'sugar: first tap shows 5.5'] },
  { id: 'M3', what: 'the pledge badge card loses its label', find: "}’s badge</div>", repl: "}’s card</div>", mustFail: ['pledge screen shows a badge card again after Back'] },
  { id: 'M4', what: 'the text-[#4f6870] CSS rule is missing', find: "  .text-\\[\\#4f6870\\]{color:#4f6870}\n", repl: "", mustFail: ['no template class is missing from the stylesheet'] },
  { id: 'M5', what: 'the "did you mean 7.2" suggestion is switched off', find: "fix=step<1&&d>=min&&d<=max?d:null;", repl: "fix=null;", mustFail: ['72 for sugar is not saved but offers the one-tap fix 7.2'] },
  { id: 'M6', what: 'an emptied field becomes 0 instead of empty', find: "if(raw===''){a.s[k]=null;readingWarn(k,'');}\n else if(isNaN(v))", repl: "if(raw===''){a.s[k]=0;readingWarn(k,'');}\n else if(isNaN(v))",
    mustFail: ['an emptied field clears the reading and the warning'] },
  { id: 'M7', what: 'a comma decimal is no longer understood', find: "const parseReading=raw=>{const t=String(raw).trim().replace(',','.');", repl: "const parseReading=raw=>{const t=String(raw).trim();", mustFail: ['a comma decimal "6,5" is saved as 6.5'] },
];

async function post() {
  tooling();
  const A = E.afterManifest, B = E.baselineManifest, cur = manifest(root);
  const ALLOWED_CHANGED = ['index.html', '.smoke/harness.js', 'dist/index.html', 'dist/sw.js'];
  const allFiles = new Set([...Object.keys(B), ...Object.keys(cur)]);
  const changed = [...allFiles].filter(f => B[f] !== cur[f]).sort();
  check('S1', `only the allowed files changed: ${ALLOWED_CHANGED.join(', ')}`, JSON.stringify(changed) === JSON.stringify([...ALLOWED_CHANGED].sort()), `changed/added/removed: ${changed.join(', ') || '(none)'}`);
  const missing = Object.keys(B).filter(f => !(f in cur)), added = Object.keys(cur).filter(f => !(f in B));
  check('S2', 'no file was added or deleted anywhere in the project', !missing.length && !added.length, `missing: ${missing.join(', ') || '-'}; added: ${added.join(', ') || '-'}`);
  for (const f of ['index.html', '.smoke/harness.js', 'dist/index.html', 'dist/sw.js'])
    check('X-' + f, `${f} is byte-identical to the dry-run result (sha256 ${A[f].slice(0, 12)}…)`, cur[f] === A[f], `got ${(cur[f] || 'missing').slice(0, 12)}…`);
  const others = Object.keys(B).filter(f => !ALLOWED_CHANGED.includes(f));
  check('S3', `the other ${others.length} files are byte-identical to the baseline`, others.every(f => cur[f] === B[f]), others.filter(f => cur[f] !== B[f]).join(', '));

  /* the app's logic must be untouched: the whole <script> block is byte-identical, so only CSS can have changed */
  const idx = rd('index.html').toString('utf8');
  check('L1', 'the app\'s entire <script> block (all logic) is byte-identical to the baseline', sha(scriptOf(idx)) === E.indexScriptSha, 'script block changed');
  const CR = '\r', eol = idx.includes('\r\n') ? '\r\n' : '\n';
  const added2 = '  .max-w-\\[32ch\\]{max-width:32ch}' + eol + '  .text-\\[\\#4f6870\\]{color:#4f6870}' + eol;
  const without = idx.split(added2);
  check('L2', 'index.html differs from the baseline by exactly the two added CSS lines and nothing else', without.length === 2 && sha(without.join('')) === B['index.html'], `occurrences of the added lines: ${without.length - 1}`);
  try { new Function(scriptOf(idx)); check('L3', 'the app script still parses', true); } catch (e) { check('L3', 'the app script still parses', false, e.message); }
  const syn = cp.spawnSync(process.execPath, ['--check', path.join(root, '.smoke/harness.js')], { encoding: 'utf8' });
  check('L4', 'the harness file is valid JavaScript', syn.status === 0, syn.stderr);

  /* dist is a pure function of the sources */
  const swSrc = rd('sw.js').toString('utf8');
  const version = crypto.createHash('sha1').update(rd('index.html')).update(rd('manifest.webmanifest')).digest('hex').slice(0, 10);
  check('D1', 'dist/index.html is byte-identical to index.html', rd('dist/index.html').equals(rd('index.html')), '');
  check('D2', `dist/sw.js equals sw.js with __VERSION__ replaced by the recomputed version (${version})`, rd('dist/sw.js').toString('utf8') === swSrc.replace('__VERSION__', version), '');
  const distNow = Object.keys(cur).filter(f => f.startsWith('dist/')).sort(), distBase = Object.keys(B).filter(f => f.startsWith('dist/')).sort();
  check('D3', 'dist/ has exactly the same set of files as before', JSON.stringify(distNow) === JSON.stringify(distBase), distNow.join(','));
  check('D4', 'dist/_headers still carries the security headers', /Content-Security-Policy/.test(rd('dist/_headers').toString('utf8')) && /X-Frame-Options: DENY/.test(rd('dist/_headers').toString('utf8')), '');

  /* the harness itself */
  const rows = await runHarness();
  const t = tally(rows);
  const failNames = rows.filter(r => r[0] === 'FAIL').map(r => r[1]);
  check('H1', `harness total is ${E.harnessAfter.pass + E.harnessAfter.fail} checks and PASS >= ${E.harnessAfter.pass}`, t.pass + t.fail === E.harnessAfter.pass + E.harnessAfter.fail && t.pass >= E.harnessAfter.pass, JSON.stringify(t));
  check('H2', 'every FAIL left is one of the 5 known unrelated checks (none of the four targets)', failNames.every(n => UNRELATED.includes(n)), 'unexpected FAIL: ' + failNames.filter(n => !UNRELATED.includes(n)).join(' | '));
  const a = rows.filter(r => !UNRELATED.includes(r[1])), b = E.harnessAfter.rows.filter(r => !UNRELATED.includes(r[1]));
  const d = sameMultiset(a, b);
  check('H3', 'every other check has exactly the recorded name and status (nothing renamed, dropped, added or weakened)', d.length === 0, d.join('\n'));
  const mustPass = ['first + tap on an empty field shows the default', 'the second + tap then steps up by one', 'first − tap on an empty field also shows the default', 'sugar: first tap shows 5.5',
    'sugar: second tap steps by 0.1 without float noise', 'too-high reading is not saved (and not clamped to 30)', 'too-high reading tells the volunteer why', '72 for sugar is not saved but offers the one-tap fix 7.2',
    'a comma decimal "6,5" is saved as 6.5', 'text such as "abc" is not saved and the message says it is not a number', 'an emptied field clears the reading and the warning',
    'an in-range reading is kept exactly as typed', 'blood pressure 300 is not saved and gets no decimal "fix"', 'pledge screen shows a badge card again after Back',
    'no template class is missing from the stylesheet'];
  const passNames = rows.filter(r => r[0] === 'PASS').map(r => r[1]);
  const missingPass = mustPass.map(norm).filter(n => !passNames.some(p => p === n || p.startsWith(n)));
  check('H4', `all ${mustPass.length} required checks for the four fixes are present and PASS`, !missingPass.length, 'missing or failing: ' + missingPass.join(' | '));
  const gone = ['first + tap starts from the default (121)', 'typed value is clamped on commit'].map(norm);
  check('H5', 'the two obsolete check names no longer exist', !rows.some(r => gone.includes(r[1])), '');

  /* mutation tests: break the real app in a specific way; the matching check MUST fail, or the test proves nothing */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-plan-mut-'));
  const toEol = t => t.split('\r\n').join('\n').split('\n').join(eol);
  const jobs = MUTATIONS.map(m => {
    const find = toEol(m.find), n = idx.split(find).length - 1;
    if (n !== 1) return Promise.resolve({ m, err: `mutation text matched ${n} times (must be exactly 1), so the mutation test is invalid` });
    const file = path.join(tmp, m.id + '.html'); fs.writeFileSync(file, idx.replace(find, () => toEol(m.repl)));
    return runHarness(file).then(r => ({ m, rows: r }));
  });
  for (const j of await Promise.all(jobs)) {
    if (j.err) { check('MUT-' + j.m.id, j.m.what, false, j.err); continue; }
    const fails = j.rows.filter(r => r[0] === 'FAIL').map(r => r[1]);
    const notCaught = j.m.mustFail.map(norm).filter(n => !fails.some(f => f === n || f.startsWith(n)));
    check('MUT-' + j.m.id, `breaking the app (${j.m.what}) makes the matching tests FAIL`, !notCaught.length, 'NOT caught: ' + notCaught.join(' | '));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  finish();
}

(async () => { try { await (mode === 'pre' ? pre() : post()); } catch (e) { check('CRASH', 'the gate crashed (counts as FAIL)', false, e.stack); finish(); } })();
