/* One-time migration: replace inline on* handler attributes with data-action attributes.
   node tools/deinline.js            → convert, rewrite files, print the adapter skeleton + manual sites
   Patterns converted here:  fn()  |  fn('x') / fn('${x}')  |  fn(event) on forms  |  backdrop if-expressions.
   Everything else (multi-arg, this.value, this, multi-statement) is reported for manual conversion. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = ['index.html', ...fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f)];

const zero = new Set(), one = new Set(), event = new Set(), manual = [];
let converted = 0;

for (const f of files) {
  const p = path.join(root, f);
  let t = fs.readFileSync(p, 'utf8');
  let changed = false;
  t = t.replace(/on(click|submit|input|change)="([^"]*)"/g, (all, type, expr) => {
    if (/^(click|submit)$/.test(type)) {
      let m;
      if ((m = /^([A-Za-z_$][\w$]*)\(\)$/.exec(expr))) { zero.add(m[1]); converted++; changed = true; return `data-action="${m[1]}"`; }
      if ((m = /^([A-Za-z_$][\w$]*)\('([^']*)'\)$/.exec(expr))) { one.add(m[1]); converted++; changed = true; return `data-action="${m[1]}" data-args="${m[2]}"`; }
      if ((m = /^([A-Za-z_$][\w$]*)\(event\)$/.exec(expr))) { event.add(m[1]); converted++; changed = true; return `data-action="${m[1]}"`; }
      if (/^if\(event\.target===this\)([A-Za-z_$][\w$]*)\(\)$/.test(expr)) {
        const fn = expr.replace(/^if\(event\.target===this\)/, '').replace(/\(\)$/, '');
        zero.add(fn); converted++; changed = true; return `data-action="${fn}" data-backdrop="1"`;
      }
    }
    manual.push(`${f} :: ${expr.slice(0, 110)}`);
    return all;   /* left as-is: converted by hand */
  });
  if (changed) fs.writeFileSync(p, t);
}

console.log('converted ' + converted + ' sites; ' + manual.length + ' left for manual conversion\n');
console.log('--- 0-arg (register the function itself) ---');
console.log([...zero].sort().join(', '));
console.log('\n--- single-arg via data-args (adapter: el => fn(el.dataset.args)) ---');
console.log([...one].sort().join(', '));
console.log('\n--- form/event fns (adapter: (el, ev) => fn(ev)) ---');
console.log([...event].sort().join(', '));
console.log('\n--- manual sites ---');
for (const m of manual) console.log('  ' + m);
