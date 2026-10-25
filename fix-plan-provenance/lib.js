/* lib.js (gated-fix-plan): helpers shared by gate.js, make-expected.js and tamper-test.js. Read-only except copyProject(). */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
const eolOf = text => (text.includes(CR + LF) ? 'CRLF' : 'LF');

/* every file under root -> sha256, skipping config.skipDirs (by directory name) and config.skipFiles (by relative path) */
function manifest(root, C) {
  const skipDirs = new Set(C.skipDirs || []), skipFiles = new Set(C.skipFiles || []), out = {};
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!skipDirs.has(e.name)) walk(path.join(d, e.name)); continue; }
      const rel = path.relative(root, path.join(d, e.name)).split(path.sep).join('/');
      if (skipFiles.has(rel)) continue;
      out[rel] = sha(fs.readFileSync(path.join(d, e.name)));
    }
  })(root);
  return out;
}

/* copy a project, leaving out heavy/irrelevant directories (config.copySkipDirs, default config.skipDirs) */
function copyProject(src, dst, C) {
  const skip = new Set(C.copySkipDirs || C.skipDirs || []);
  fs.cpSync(src, dst, { recursive: true, filter: s => { const rel = path.relative(src, s); return !rel || !rel.split(path.sep).some(p => skip.has(p)); } });
}

/* replace `find` exactly once, matching the file's own line endings */
function replaceOnce(text, find, repl) {
  const eol = text.includes(CR + LF) ? CR + LF : LF;
  const fix = t => t.split(CR + LF).join(LF).split(LF).join(eol);
  const f = fix(find), n = text.split(f).length - 1;
  return { n, text: n === 1 ? text.replace(f, () => fix(repl)) : text };
}

/* test-name normalisation: removes run-to-run noise such as "(123 ms)" */
const normalizer = C => { const re = C.test.normalize ? new RegExp(C.test.normalize) : null; return n => (re ? n.replace(re, '') : n).trim(); };

function parseRows(text, C) {
  const re = new RegExp(C.test.line), norm = normalizer(C), rows = [];
  for (const l of text.split(/\r?\n/)) {
    const m = re.exec(l); if (!m) continue;
    const st = m[1] === C.test.pass ? 'PASS' : m[1] === C.test.fail ? 'FAIL' : null;
    if (st) rows.push([st, norm(m[2])]);
  }
  return rows;
}

/* run the project's test command in `dir`; resolves to { rows, code, timedOut } */
function runTests(dir, C, extraEnv) {
  return new Promise(res => {
    const p = cp.spawn(C.test.cmd, C.test.args || [], { cwd: dir, env: { ...process.env, ...(extraEnv || {}) }, shell: !!C.test.shell });
    let out = '', timedOut = false;
    const t = setTimeout(() => { timedOut = true; p.kill(); }, (C.test.timeoutSec || 600) * 1000);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', code => { clearTimeout(t); res({ rows: parseRows(out, C), code, timedOut, out }); });
    p.on('error', e => { clearTimeout(t); res({ rows: [], code: -1, timedOut, out: String(e) }); });
  });
}

/* tests listed in config.flaky (their result depends on machine speed) keep their name but lose their status: 'ANY' */
function stabilize(rows, C) { const norm = normalizer(C), f = new Set((C.flaky || []).map(norm)); return rows.map(r => (f.has(r[1]) ? ['ANY', r[1]] : r)); }

const tally = rows => ({ pass: rows.filter(r => r[0] === 'PASS').length, fail: rows.filter(r => r[0] === 'FAIL').length });
function multisetDiff(a, b) {
  const cnt = rows => { const m = new Map(); for (const [s, n] of rows) m.set(s + ' | ' + n, (m.get(s + ' | ' + n) || 0) + 1); return m; };
  const x = cnt(a), y = cnt(b), d = [];
  for (const [k, v] of x) if (y.get(k) !== v) d.push(`${k}: ${v} now, ${y.get(k) || 0} expected`);
  for (const [k, v] of y) if (!x.has(k)) d.push(`${k}: 0 now, ${v} expected`);
  return d;
}

/* anchor = { file, needle } -> lines (1-based) that contain it, and total occurrences */
function measureAnchor(root, a) {
  const text = fs.readFileSync(path.join(root, a.file), 'utf8');
  return { lines: text.split(/\r?\n/).map((l, i) => (l.includes(a.needle) ? i + 1 : 0)).filter(Boolean), occurrences: text.split(a.needle).length - 1 };
}

/* invariant = { id, file, regex } -> sha256 of capture group 1 (or of the whole match), or null when it does not match */
function invariantHash(root, inv) {
  const m = new RegExp(inv.regex).exec(fs.readFileSync(path.join(root, inv.file), 'utf8'));
  return m ? sha(m[1] !== undefined ? m[1] : m[0]) : null;
}

module.exports = { sha, eolOf, manifest, copyProject, replaceOnce, normalizer, parseRows, runTests, stabilize, tally, multisetDiff, measureAnchor, invariantHash };
