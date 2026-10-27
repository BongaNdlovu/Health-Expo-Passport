/* One-time migration: split the single inline <script> in index.html into src/ ES modules.
   node tools/split.js split        → write src/*.js, rewrite index.html to a module tag, write jsconfig.json
   node tools/split.js fiximports   → run tsc, auto-add missing imports, repeat until no TS2304 remains
   (kept for provenance; harmless to delete after the migration) */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const srcDir = path.join(root, 'src');

/* section table in original order; later entries with the same file append to it */
const SECTIONS = [
  ['platform', l => /^\/\* ================= ANDROID APP/.test(l)],
  ['data', l => /^\/\* ================= SEED DATA/.test(l)],
  ['data', l => /^\/\* ================= VOLUNTEER DATA/.test(l)],
  ['churchPlans', l => /^\/\* ================= CHURCH PLANS/.test(l)],
  ['churchPlans', l => /^\/\* ================= FOLLOW-UP PEOPLE/.test(l)],
  ['churchPlans', l => /^\/\* ================= INVITE LINKS/.test(l)],
  ['icons', l => /^\/\* ================= ICONS/.test(l)],
  ['helpers', l => /^\/\* ================= HELPERS/.test(l)],
  ['helpers', l => /^\/\* ================= NUMBER TWEEN/.test(l)],
  ['state', l => /^\/\* ================= PERSISTENCE/.test(l)],
  ['shell', l => /^\/\* ================= RENDER: SHELL/.test(l)],
  ['visitor', l => /^\/\* ================= THE VISITOR JOURNEY/.test(l)],
  ['visitor', l => /^\/\* ================= VIEW: HOME/.test(l)],
  ['visitor', l => /^\/\* ================= POPIA CONSENT/.test(l)],
  ['visitor', l => /^\/\* ================= VIEW: SCREEN/.test(l)],
  ['results', l => /^\/\* ================= VIEW: RESULTS/.test(l)],
  ['results', l => /^\/\* ================= VIEW: PLAN/.test(l)],
  ['results', l => /^\/\* ================= VIEW: FOOD/.test(l)],
  ['results', l => /^\/\* ================= VIEW: CARE/.test(l)],
  ['scanner', l => /^\/\* ================= REAL CAMERA QR SCANNING/.test(l)],
  ['volunteer', (l, lines, i) => /^   VOLUNTEER \/ SERVE/.test(l) ? i - 1 : -1],   /* banner starts one line above */
  ['volunteer', l => /^\/\* ================= MODALS/.test(l)],
  ['volunteer', l => /^\/\* ================= A6 PRINT CARD/.test(l)],
  ['shell', l => /^\/\* ================= TOAST & KEYS/.test(l)],
  ['shell', l => /^\/\* ================= LIQUID INTERACTIONS/.test(l)],
  ['shell', l => /^\/\* ===== intro/.test(l)],
  ['cloud', (l, lines, i) => /^   CLOUD SYNC/.test(l) ? i - 1 : -1],               /* banner starts one line above */
  ['account', l => /^\/\* -+ churches, members and the platform admin/.test(l)],
  ['queue', l => /^\/\* ================= LIVE QUEUE/.test(l)],
  ['main', l => /^\/\* Init — seed the volunteer roster/.test(l)],
];

const HEADERS = {
  platform: 'Android app (Capacitor) detection and addresses.',
  data: 'Seed and season data: volunteers roster, booths, badge tiers, the expo, the home plans and their actions.',
  churchPlans: "A church's own home plans, follow-up people and invite links (with the account hub's boxes).",
  icons: 'Inline SVG icons.',
  helpers: 'Shared helpers: escaping, csv, dates, prices, the health-age engine and the number tween.',
  state: 'State and persistence: the app state, the cloud state and the saved offline copy.',
  shell: 'The app shell: rendering, toast, liquid interactions and the intro.',
  visitor: 'The visitor journey: Check → Results entry, registration, the paper record and the survey.',
  results: 'Results, Plan, Food and Care views.',
  scanner: 'Real camera QR scanning.',
  volunteer: 'Volunteers: pledge, register, booth picker, serve, modals, WhatsApp/email share and the print card.',
  cloud: 'Cloud sync with Supabase: sign-in gate, pull/push, live updates, libraries and installs.',
  account: 'The account hub: my account, my church, all churches (platform admin), members and approvals.',
  queue: 'The live queue shared between desks.',
  main: 'App entry: imports every module in the original evaluation order, then boots.',
};

function mainScript(lines) {
  const start = lines.findIndex((l, i) => i > 500 && /^<script>$/.test(l));
  const end = lines.findIndex((l, i) => i > start && /^<\/script>/.test(l));
  if (start < 0 || end < 0) throw new Error('main script block not found');
  return { start, end, body: lines.slice(start + 1, end) };
}

function doSplit() {
  /* the intact pre-split page lives in dist/ (the last build): extract the script from there */
  const distLines = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8').split('\n');
  const { body } = mainScript(distLines);
  const lines = fs.readFileSync(htmlPath, 'utf8').split('\n');
  if (!lines.some(l => /^<script type="module" src="\.\/src\/main\.js"><\/script>$/.test(l))) {
    const { start, end } = mainScript(lines);
    lines.splice(start, end - start + 1, '<script type="module" src="./src/main.js"></script>');
    fs.writeFileSync(htmlPath, lines.join('\n'));
  }
  const cuts = [];
  for (const [file, pred] of SECTIONS) {
    for (let i = 1; i < body.length; i++) {
      const hit = pred(body[i], body, i);
      const at = hit === true ? i : (typeof hit === 'number' ? hit : -1);   /* false must not count: false >= 0 is true */
      if (at >= 0) { cuts.push({ file, at }); break; }
    }
  }
  cuts.sort((a, b) => a.at - b.at);
  const files = {};
  const pieces = [{ file: 'platform', at: 0 }, ...cuts];   /* content starts with the platform section */
  pieces.forEach((p, i) => {
    const stop = i + 1 < pieces.length ? pieces[i + 1].at : body.length;
    (files[p.file] = files[p.file] || []).push(body.slice(p.at, stop).join('\n'));
  });
  fs.rmSync(srcDir, { recursive: true, force: true });
  fs.mkdirSync(srcDir);
  for (const [file, parts] of Object.entries(files)) {
    const text = parts.join('\n');
    fs.writeFileSync(path.join(srcDir, file + '.js'),
      `/* ${HEADERS[file] || ''} Split from the original single-file app; bundled back into one file by tools/build.js. */\n`
      + text.replace(/\n{4,}/g, '\n\n\n').replace(/\s+$/, '\n'));
  }
  /* entry module: init code + the smoke-test internals export */
  const init = (files.main || []).join('\n');
  const names = exportsList();
  const defOf = {};
  for (const [f, parts] of Object.entries(files))
    for (const part of parts)
      for (const m of part.matchAll(/(?:^(?:const|let|var|class|async function|function)|;\s*(?:async\s+)?function)\s+([A-Za-z_$][\w$]*)/gm))
        (defOf[m[1]] = defOf[m[1]] || []).push(f);
  const imports = names.map(n => {
    const from = defOf[n];
    if (!from || from.length > 1) throw new Error((from ? 'ambiguous: ' : 'no module declares: ') + n + (from ? ' in ' + from.join(',') : ''));
    return { n, f: from[0] };
  });
  const byFile = {};
  imports.forEach(({ n, f }) => (byFile[f] = byFile[f] || []).push(n));
  let out = `/* ${HEADERS.main} */
`;
  for (const [f, list] of Object.entries(byFile).sort())
    out += `import { ${list.sort().join(', ')} } from './${f}.js';\n`;
  out += '\n' + init.replace(/\s+$/, '\n')
    + `\n/* The smoke test (.smoke/harness.js) reaches the internals through this one object. */
export const __internals = { ${names.join(', ')} };\n`;
  fs.writeFileSync(path.join(srcDir, 'main.js'), out);
  fs.writeFileSync(path.join(root, 'jsconfig.json'), JSON.stringify({
    compilerOptions: { module: 'esnext', target: 'es2020', moduleResolution: 'bundler', checkJs: true, noEmit: true, strict: false, lib: ['es2020', 'dom'] },
    include: ['src/**/*.js', 'src/**/*.d.ts'],
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(srcDir, 'globals.d.ts'),
    `/* Libraries loaded from CDNs (or Capacitor) that the app reads as globals. */
declare const supabase: { createClient: Function };
declare const Capacitor: any;
declare const QRCode: any;
declare const BarcodeDetector: any;
declare const Html5Qrcode: any;
`);
  const total = Object.values(files).reduce((t, p) => t + p.reduce((t2, x) => t2 + x.length, 0), 0);
  console.log(`split ${total} lines into ${Object.keys(files).length + 1} modules`);
}

/* the smoke test's export list — read from .smoke/harness.js so there is one source of truth */
function exportsList() {
  const h = fs.readFileSync(path.join(root, '.smoke', 'harness.js'), 'utf8');
  const m = /const EXPORTS = \[([\s\S]*?)\];/.exec(h);
  return [...new Set([...m[1].matchAll(/'([A-Za-z_$][\w$]*)'/g)].map(x => x[1]).filter(n => n !== 'setVolTab'))];
}

function declIndex() {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js') && f !== 'main.js');
  const idx = {};
  for (const f of files) {
    const text = fs.readFileSync(path.join(srcDir, f), 'utf8');
    for (const m of text.matchAll(/(?:^(?:export\s+)?(?:const|let|var|class|async function|function)|;\s*(?:async\s+)?function)\s+([A-Za-z_$][\w$]*)/gm))
      (idx[m[1]] = idx[m[1]] || []).push(f.replace(/\.js$/, ''));
    /* multi-declarator top-level lines: export const A='…',B='…' — only on lines that begin a declaration */
    for (const line of text.split('\n'))
      if (/^(?:export\s+)?(?:const|let|var)\s/.test(line))
        for (const m of line.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g))
          (idx[m[1]] = idx[m[1]] || []).push(f.replace(/\.js$/, ''));
  }
  return idx;
}

function doFixImports() {
  const idx = declIndex();
  let out;
  try { out = execSync('npx tsc --noEmit -p jsconfig.json 2>&1', { cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  const want = {};   /* file -> Set(module -> Set(name)) */
  let other = 0;
  for (const m of out.matchAll(/src[/\\]([\w-]+)\.js\(\d+,\d+\): error TS(?:2304|2552|2592): Cannot find name '([A-Za-z_$][\w$]*)'/g)) {
    const [, f, name] = m;
    const from = idx[name];
    if (!from) { console.log('unresolved: ' + name + ' (used in ' + f + ')'); other++; continue; }
    if (from.length > 1) { console.log('ambiguous: ' + name + ' declared in ' + from.join(',')); other++; continue; }
    if (from[0] === f) continue;
    ((want[f] = want[f] || {})[from[0]] = want[f][from[0]] || new Set()).add(name);
  }
  for (const [f, mods] of Object.entries(want)) {
    const p = path.join(srcDir, f + '.js');
    let text = fs.readFileSync(p, 'utf8');
    const lines = Object.entries(mods).map(([m, set]) => `import { ${[...set].sort().join(', ')} } from './${m}.js';`);
    text = lines.join('\n') + '\n' + text;
    fs.writeFileSync(p, text);
    console.log(f + ': added ' + lines.length + ' import line(s)');
  }
  const remaining = (out.match(/error TS2304/g) || []).length - Object.values(want).reduce((t, s) => t + s.size, 0);
  console.log('TS2304 left: ' + Math.max(0, remaining) + (other ? '; ' + other + ' manual' : ''));
}

/* mark as `export` every top-level declaration some other module imports (computed from the import lines) */
function doExportMarks() {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
  const needed = {};    /* file -> Set(name) */
  for (const f of files) {
    const text = fs.readFileSync(path.join(srcDir, f), 'utf8');
    for (const m of text.matchAll(/import \{ ([^}]+) \} from '\.\/([\w-]+)\.js';/g))
      for (const n of m[1].split(',').map(s => s.trim()).filter(Boolean))
        (needed[m[2]] = needed[m[2]] || new Set()).add(n);
  }
  let marked = 0;
  for (const [f, names] of Object.entries(needed)) {
    const p = path.join(srcDir, f + '.js');
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = /^(const|let|var|class|async function|function)\s+([A-Za-z_$][\w$]*)/.exec(lines[i]);
      if (m && names.has(m[2]) && !/^export\s/.test(lines[i])) { lines[i] = 'export ' + lines[i]; marked++; }
    }
    fs.writeFileSync(p, lines.join('\n'));
  }
  console.log('marked ' + marked + ' declarations export');
}

module.exports = { doSplit, doFixImports, doExportMarks };
if (require.main === module) (process.argv[2] === 'fiximports' ? doFixImports : process.argv[2] === 'exportmarks' ? doExportMarks : doSplit)();
