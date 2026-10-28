/* Purge the generated Tailwind block (#tw) down to the classes this app actually uses.
   Safety net: .smoke/harness.js asserts every class in the templates exists in the stylesheet.
   Usage: node tools/purge-tw.js [--write] */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<style id="tw">([\s\S]*?)<\/style>/);
if (!match) throw new Error('no <style id="tw"> block');

const css = match[1];
const body = html.slice(html.indexOf('<body>'));
const srcText = fs.readdirSync(path.join(root, 'src'))
  .filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8'))
  .join('\n');
const usedText = body + '\n' + srcText;

const unescape = s => s.replace(/\\(.)/g, '$1');
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const classRe = /\.((?:\\.|[A-Za-z0-9_-])+)/g;

function classesOf(selector) {
  const out = [];
  let m;
  classRe.lastIndex = 0;
  while ((m = classRe.exec(selector))) out.push(unescape(m[1]));
  return out;
}

const FORCE = new Set(['hover:text-white','inline','active:scale-95','hover:bg-white/60']);
const cache = new Map();
function used(cls) {
  if (!cls) return true;
  if (cache.has(cls)) return cache.get(cls);
  const re = new RegExp('(^|[\\s"\'`{}()])' + escapeRe(cls) + '(?=$|[\\s"\'`{}()])');
  const hit = re.test(usedText);
  cache.set(cls, hit);
  return hit;
}

function splitTop(text) {
  const rules = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    const start = i;
    const brace = text.indexOf('{', i);
    if (brace < 0) break;
    let depth = 0, j = brace;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') { depth--; if (depth === 0) { j++; break; } }
    }
    rules.push({ head: text.slice(start, brace).trim(), body: text.slice(brace + 1, j - 1), raw: text.slice(start, j) });
    i = j;
  }
  return rules;
}

function filterSelectors(sel) {
  /* split on commas at paren/bracket depth zero */
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  const kept = parts.filter(p => {
    const cls = classesOf(p);
    return cls.length === 0 || cls.every(used);
  });
  return kept.join(',');
}

function filterCss(text) {
  let out = '';
  for (const r of splitTop(text)) {
    if (/^@(media|supports|layer|container)/.test(r.head)) {
      const inner = filterCss(r.body);
      if (inner.trim()) out += r.head + '{' + inner + '}';
    } else if (/^@(keyframes|-webkit-keyframes|font-face|page|charset|import)/.test(r.head)) {
      out += r.raw;
    } else {
      const sel = filterSelectors(r.head);
      if (sel.trim()) out += sel + '{' + r.body + '}';
    }
  }
  return out;
}

const purged = filterCss(css);
const missing = [];
const allClasses = new Set();
let m;
classRe.lastIndex = 0;
while ((m = classRe.exec(css))) allClasses.add(unescape(m[1]));
for (const c of allClasses) if (!used(c)) missing.push(c);

console.log('tw chars:      ' + css.length);
console.log('purged chars:  ' + purged.length);
console.log('saved:         ' + (css.length - purged.length) + ' (' + ((1 - purged.length / css.length) * 100).toFixed(1) + '%)');
console.log('classes in tw: ' + allClasses.size + ', unused: ' + missing.length);
console.log('unused sample: ' + missing.slice(0, 40).join(' '));

if (process.argv.includes('--write')) {
  const next = html.replace(match[0], '<style id="tw">' + purged + '</style>');
  fs.writeFileSync(htmlPath, next);
  console.log('written');
}
