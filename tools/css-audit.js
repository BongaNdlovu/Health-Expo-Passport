/* Report authored CSS rules whose class selectors no longer appear in markup or src.
   Read-only audit. Usage: node tools/css-audit.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>'));
const src = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
const usedText = body + '\n' + src;

const clsRe = /\.((?:\\.|[A-Za-z0-9_-])+)/g;
const unescape = s => s.replace(/\\(.)/g, '$1');
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cache = new Map();
function used(cls) {
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

const blocks = [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)];
const dead = [];
blocks.forEach((b, bi) => {
  const css = b[2];
  for (const r of splitTop(css)) {
    if (/^@/.test(r.head)) continue;
    const classes = [...r.head.matchAll(clsRe)].map(m => unescape(m[1]));
    if (!classes.length) continue;
    if (classes.some(used)) continue;
    dead.push({ block: bi + 1, len: r.raw.length, sel: r.head.replace(/\s+/g, ' ').slice(0, 110) });
  }
});
dead.sort((a, b) => b.len - a.len);
console.log('dead rules:', dead.length, 'chars:', dead.reduce((n, r) => n + r.len, 0));
for (const r of dead.slice(0, 60)) console.log(String(r.len).padStart(5), 'b' + r.block, r.sel);
