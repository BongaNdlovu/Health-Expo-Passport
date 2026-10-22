/* fix-plan/apply.js: applies the plan's exact edits, nothing else.
   Usage: node fix-plan/apply.js <projectRoot>
   Every edit is an exact-text replacement that must match EXACTLY ONCE, or the script stops with a non-zero exit code
   and writes nothing. It touches only index.html and .smoke/harness.js. */
const fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || '.');
const files = { 'index.html': [], '.smoke/harness.js': [] };
const edit = (file, id, oldText, newText) => files[file].push({ id, oldText, newText });

/* ------------------------------------------------------------------ index.html (CSS only) */
edit('index.html', 'P1 css rules',
  '  .max-w-\\[30ch\\]{max-width:30ch}\n',
  '  .max-w-\\[30ch\\]{max-width:30ch}\n  .max-w-\\[32ch\\]{max-width:32ch}\n  .text-\\[\\#4f6870\\]{color:#4f6870}\n');

/* ------------------------------------------------------------------ .smoke/harness.js */
edit('.smoke/harness.js', 'H1 ignore hook classes',
  "  const IGNORE = new Set(['nav-drop']);          /* marker class, styled through #navDrop */\n",
  "  /* marker classes: nav-drop is styled through #navDrop; jr-next / jr-back are hooks only (the buttons are styled by .btn and .jr-btns) */\n  const IGNORE = new Set(['nav-drop', 'jr-next', 'jr-back']);\n");

edit('.smoke/harness.js', 'H2 stepper first tap (Option A)',
  "g.onStep('EXPO-042', 'sys', 1, 70, 210, 1, 120);\nok('first + tap starts from the default (121)', dm.s.sys === 121, 'got ' + dm.s.sys);\n",
  `g.onStep('EXPO-042', 'sys', 1, 70, 210, 1, 120);
ok('first + tap on an empty field shows the default (120), not a guess above it', dm.s.sys === 120, 'got ' + dm.s.sys);
g.onStep('EXPO-042', 'sys', 1, 70, 210, 1, 120);
ok('the second + tap then steps up by one (121)', dm.s.sys === 121, 'got ' + dm.s.sys);

dm.s.sys = null;
g.onStep('EXPO-042', 'sys', -1, 70, 210, 1, 120);
ok('first − tap on an empty field also shows the default (120)', dm.s.sys === 120, 'got ' + dm.s.sys);

/* a decimal station: sugar default 5.5, step 0.1 */
dm.s.sugar = null;
g.onStep('EXPO-042', 'sugar', 1, 1, 30, 0.1, 5.5);
ok('sugar: first tap shows 5.5', dm.s.sugar === 5.5, 'got ' + dm.s.sugar);
g.onStep('EXPO-042', 'sugar', 1, 1, 30, 0.1, 5.5);
ok('sugar: second tap steps by 0.1 without float noise (5.6)', dm.s.sugar === 5.6, 'got ' + dm.s.sugar);
`);

edit('.smoke/harness.js', 'H3 commit rules',
  "$el('in-sugar').value = '99'; g.onStationCommit('EXPO-042', 'sugar', $el('in-sugar'), 1, 30);\nok('typed value is clamped on commit', dm.s.sugar === 30, 'got ' + dm.s.sugar);\n",
  `/* commit rules for a typed reading: valid -> saved; impossible or garbage -> NOT saved and explained, never changed into another number */
g.state.activeId = 'EXPO-042';
const commit = (k, raw, min, max, step) => {
  const el = $el('in-' + k); el.value = raw; dm.s[k] = 1234;                    /* sentinel: proves the app overwrote it */
  g.onStationCommit('EXPO-042', k, el, min, max, step);
  return { v: dm.s[k], warn: $el('warn-' + k), box: el.value };
};
let r = commit('sugar', '99', 1, 30, 0.1);
ok('too-high reading is not saved (and not clamped to 30)', r.v === null, 'got ' + r.v);
ok('too-high reading tells the volunteer why', r.warn.hidden === false && /cannot be right/.test(r.warn.innerHTML) && /1–30/.test(r.warn.innerHTML), r.warn.innerHTML);

r = commit('sugar', '72', 1, 30, 0.1);
ok('72 for sugar is not saved but offers the one-tap fix 7.2', r.v === null && /Did you mean 7\\.2\\?/.test(r.warn.innerHTML), r.v + ' | ' + r.warn.innerHTML);

r = commit('sugar', '6,5', 1, 30, 0.1);
ok('a comma decimal "6,5" is saved as 6.5', r.v === 6.5 && r.warn.hidden === true, r.v);

r = commit('sugar', 'abc', 1, 30, 0.1);
ok('text such as "abc" is not saved and the message says it is not a number', r.v === null && /not a number/.test(r.warn.innerHTML), r.v + ' | ' + r.warn.innerHTML);

r = commit('sugar', '', 1, 30, 0.1);
ok('an emptied field clears the reading and the warning', r.v === null && r.warn.hidden === true, r.v);

r = commit('sugar', '5.4', 1, 30, 0.1);
ok('an in-range reading is kept exactly as typed (5.4)', r.v === 5.4 && r.box === '5.4', r.v + ' / ' + r.box);

r = commit('sys', '300', 70, 210, 1);
ok('blood pressure 300 is not saved and gets no decimal "fix"', r.v === null && !/Did you mean/.test(r.warn.innerHTML), r.v + ' | ' + r.warn.innerHTML);
dm.s.sugar = null; dm.s.sys = null;
`);

edit('.smoke/harness.js', 'H4 badge card',
  "ok('pledge screen shows a badge card again after Back', $main.innerHTML.includes('Your badge'));\n",
  `const pledgeHtml = $main.innerHTML;
ok('pledge screen shows a badge card again after Back', /’s badge<\\/div>/.test(pledgeHtml), 'no personalised badge card found');
`);

/* ------------------------------------------------------------------ apply (all-or-nothing) */
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
const out = {};
for (const [file, edits] of Object.entries(files)) {
  const p = path.join(root, file);
  let text = fs.readFileSync(p, 'utf8');
  const eol = text.includes(CR + LF) ? CR + LF : LF;      /* index.html uses Windows line endings, harness.js Unix ones */
  const fix = t => t.split(CR + LF).join(LF).split(LF).join(eol);
  for (const e of edits) {
    const oldText = fix(e.oldText), newText = fix(e.newText);
    const n = text.split(oldText).length - 1;
    if (n !== 1) { console.error(`STOP: edit "${e.id}" in ${file} matched ${n} times (must be exactly 1). Nothing was written.`); process.exit(1); }
    text = text.replace(oldText, () => newText);
  }
  out[p] = text;
}
for (const [p, text] of Object.entries(out)) fs.writeFileSync(p, text);
console.log('applied ' + Object.values(files).reduce((t, e) => t + e.length, 0) + ' edits to 2 files');
