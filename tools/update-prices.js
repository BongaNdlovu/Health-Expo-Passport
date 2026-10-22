/* Refresh the shopping-list prices in the app from prices/prices.csv.

     node tools/update-prices.js [path/to/prices.csv] [--date "19 Oct 2026"]

   prices.csv comes from the price-collection workspace (columns: item, store, product_name, pack_size, price_zar,
   promo_note, price_per_kg_or_unit, url, captured_at, verified). A row is used only if verified=yes and its
   promo_note doesn't say "excluded from summary stats" (not comparable, short promo) or "stand-in only".
   New stores (e.g. a later Makro or Game CSV merged into prices.csv) are picked up automatically.

   For every shopping-list item below it takes the median price per unit across the usable rows, multiplies it by
   the daily amount in ITEMS, and rewrites that item's `store` text and `daily` value in index.html and
   "newstart-passport (2).html" (when present). It also writes prices/PRICES.md with the working.
   Nothing else in the HTML is touched. No dependencies; run with plain Node. */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const dateIx = args.indexOf('--date');
const DATE = dateIx >= 0 ? args.splice(dateIx, 2)[1] : '19 Oct 2026';
const csvPath = args[0] || path.join(root, 'prices', 'prices.csv');
const HTML = ['index.html', 'newstart-passport (2).html'].map(f => path.join(root, f)).filter(f => fs.existsSync(f));

/* daily amount behind each item (the dose on screen turned into grams or units); `price` = prices.csv item numbers */
const ITEMS = {
  oats:    { names: ['Rolled oats / oat bran', 'Rolled oats / whole grains', 'Rolled oats'], price: ['1'], unit: 'kg', qty: 0.060, why: '60 g dry oats' },
  flax:    { names: ['Ground flaxseed'], price: ['2'], unit: 'kg', qty: 0.015, why: '2 tbsp ground flaxseed ≈ 15 g (1 tbsp ≈ 7 g)' },
  garlic:  { names: ['Raw garlic'], price: ['3'], unit: 'kg', qty: 0.010, why: '2 cloves ≈ 10 g' },
  celery:  { names: ['Celery'], price: ['4'], unit: 'bunch', qty: 0.25, why: '2–4 stalks ≈ ¼ of a bunch' },
  tomato:  { names: ['Tomatoes'], price: ['5'], unit: 'kg', qty: 0.150, why: '2 medium tomatoes ≈ 150 g' },
  potato:  { names: ['Potatoes (with skin)'], price: ['6'], unit: 'kg', qty: 0.250, why: '250 g potatoes' },
  rice:    { names: ['Brown rice / whole maize meal'], price: ['7'], unit: 'kg', qty: 0.060, why: '60 g dry brown rice',
             standIn: { price: ['8'], label: 'unsifted maize meal was not found online, STAND-IN super (sifted) maize meal' } },
  onion:   { names: ['Onions'], price: ['9'], unit: 'kg', qty: 0.150, why: '1 medium onion ≈ 150 g' },
  beans:   { names: ['Green beans'], price: ['10'], unit: 'kg', qty: 0.100, why: '100 g green beans' },
  lentils: { names: ['Brown lentils / beans'], price: ['11', '12'], unit: 'kg', qty: 0.045, why: '½ cup cooked ≈ 45 g dry lentils or sugar beans' },
  slaw:    { names: ['Cabbage & carrots (raw salad)'], parts: [
             { price: ['14'], unit: 'kg', qty: 0.150, label: 'carrots', why: '150 g carrots' },
             { price: ['13'], unit: 'head', qty: 0.10, label: 'cabbage', why: '150 g cabbage ≈ 1/10 of a head (assumes a ~1.5 kg head; stores sell cabbage per head, weight not stated)' }] },
  valerian:{ names: ['Valerian / hops tea'], price: ['15'], unit: 'kg', qty: 0.0025, why: '1 cup ≈ 2.5 g dried valerian root',
             label: 'STAND-IN: loose dried valerian root, as no valerian teabags were found priced online', show: { div: 10, label: 'per 100 g' } },
  dates:   { names: ['Figs or dates'], price: ['16'], unit: 'kg', qty: 0.025, why: '2–3 dates ≈ 25 g', label: 'priced as dates; no dried figs were found priced online' },
  crackers:{ names: ['Whole-grain crackers'], price: ['17'], unit: 'kg', qty: 0.025, why: '2–3 Provita-type crispbreads ≈ 25 g (≈ 8 g each)' },
  nuts:    { names: ['Walnuts or mixed nuts'], price: ['18'], unit: 'kg', qty: 0.030, why: '1 small handful = 30 g' },
  fruit:   { names: ['Seasonal fruit (bananas, berries)'], price: ['19'], unit: 'kg', qty: 0.200, why: '1–2 servings ≈ 200 g bananas (priced as bananas)' },
};

/* ---- CSV -------------------------------------------------------------- */
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.length > 1);
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const all = parseCSV(fs.readFileSync(csvPath, 'utf8')).map(r => {
  const m = /^([\d.]+) per (\S+)/.exec(r.price_per_kg_or_unit || '');
  return { ...r, num: (r.item || '').split('.')[0], ppu: m ? +m[1] : NaN, unit: m ? m[2] : '',
    excluded: /excluded from summary stats/.test(r.promo_note), standIn: /stand-in only/.test(r.promo_note) };
}).filter(r => r.verified === 'yes' && isFinite(r.ppu));

const median = v => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quart = (v, p) => { const s = [...v].sort((a, b) => a - b), x = (s.length - 1) * p, lo = Math.floor(x); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (x - lo); };
const r0 = v => 'R' + (v >= 100 ? Math.round(v) : v >= 10 ? Math.round(v) : v.toFixed(2));
const UNIT = { kg: 'per kg', bunch: 'a bunch', head: 'a head', pack: 'a pack' };
function pick(nums, unit, standIn) {
  const rows = all.filter(r => nums.includes(r.num) && r.unit === unit && (standIn ? r.standIn : !r.standIn && !r.excluded));
  if (!rows.length) return null;
  const v = rows.map(r => r.ppu), stores = [...new Set(rows.map(r => r.store))].sort();
  const lo = v.length >= 4 ? quart(v, 0.25) : Math.min(...v), hi = v.length >= 4 ? quart(v, 0.75) : Math.max(...v);
  const cheap = rows.reduce((a, r) => r.ppu < a.ppu ? r : a), dear = rows.reduce((a, r) => r.ppu > a.ppu ? r : a);
  return { rows, stores, med: median(v), lo, hi, n: rows.length, min: Math.min(...v), max: Math.max(...v), cheap, dear };
}
/* show = {div, label} prints a different unit than the CSV's (e.g. valerian per 100 g instead of per kg).
   The price comes first because the Plan screen truncates this text on small phones. */
const priceTxt = (s, unit, show) => {
  const d = show ? show.div : 1, u = show ? show.label : UNIT[unit], f = v => show ? 'R' + (v / d).toFixed(2) : r0(v);
  return s.lo === s.hi ? `${f(s.med)} ${u}` : `${f(s.lo)}–${f(s.hi)} ${u} (median ${f(s.med)})`;
};

/* ---- compute every item ------------------------------------------------ */
const out = {}, work = [], food = {};
const r2 = v => Math.round(v * 100) / 100;
for (const [key, it] of Object.entries(ITEMS)) {
  let daily = 0, parts = [], stores = new Set(), text;
  food[key] = { names: it.names, note: [it.label, it.standIn && it.standIn.label].filter(Boolean).join('; '), parts: [] };
  for (const p of it.parts || [it]) {
    const s = pick(p.price, p.unit);
    if (!s) throw new Error('no usable prices for ' + key + ' (items ' + p.price + ')');
    daily += p.qty * s.med; s.stores.forEach(x => stores.add(x));
    /* the Food screen's price bars: real cheapest / median / dearest store price per unit, in the unit the app shows */
    const d = p.show ? p.show.div : 1;
    food[key].parts.push({ label: it.parts ? p.label : '', unit: p.show ? p.show.label : UNIT[p.unit], amount: p.why, qty: p.qty,
      min: r2(s.min / d), med: r2(s.med / d), max: r2(s.max / d), n: s.n, stores: s.stores,
      cheap: s.cheap.store, dear: s.dear.store });
    parts.push((it.parts ? p.label + ' ' : '') + priceTxt(s, p.unit, p.show));
    work.push({ item: it.names[0] + (it.parts ? ' (' + p.label + ')' : ''), why: p.why, med: s.med, unit: p.unit, qty: p.qty, n: s.n, stores: s.stores, min: s.min, max: s.max });
  }
  text = parts.join(', ');
  text = text[0].toUpperCase() + text.slice(1) + ' at ' + [...stores].sort().join(', ');
  if (it.label) text += ' — ' + it.label;
  if (it.standIn) { const s = pick(it.standIn.price, it.unit, true); if (s) text += `; ${it.standIn.label} ${r0(s.lo)}–${r0(s.hi)} ${UNIT[it.unit]} at ${s.stores.join(", ")}`; }
  text += ` (checked ${DATE})`;
  out[key] = { text, daily: Math.round(daily * 100) / 100 };
}

/* ---- rewrite the item lines ------------------------------------------- */
const jsStr = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const changes = [];
for (const file of HTML) {
  let html = fs.readFileSync(file, 'utf8'), hits = 0;
  for (const [key, it] of Object.entries(ITEMS)) for (const name of it.names) {
    const re = new RegExp("(\\{name:'" + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "',dose:'[^']*',store:')((?:[^'\\\\]|\\\\.)*)(',daily:)([\\d.]+)(\\})", 'g');
    html = html.replace(re, (m, a, oldStore, b, oldDaily, c) => {
      hits++; changes.push({ file: path.basename(file), name, oldStore: oldStore.replace(/\\'/g, "'"), oldDaily: +oldDaily, newStore: out[key].text, newDaily: out[key].daily });
      return a + jsStr(out[key].text) + b + out[key].daily.toFixed(2) + c;
    });
  }
  html = html.replace(/const PRICE_DATE='[^']*';/, `const PRICE_DATE='${jsStr(DATE)}';`);
  /* structured prices for the Food screen, between markers (files without the markers are left alone) */
  const block = /(\/\* FOOD_PRICES:BEGIN[\s\S]*?\*\/\n)[\s\S]*?(\n\/\* FOOD_PRICES:END \*\/)/;
  if (block.test(html)) html = html.replace(block, (m, a, b) => a + 'const FOOD_PRICES=' + JSON.stringify(food) + ';' + b);
  const total = (html.match(/\{name:'[^']*',dose:'[^']*',store:'/g) || []).length;
  if (!hits || hits !== total) throw new Error(path.basename(file) + `: ${total} shopping-list items but only ${hits} known to ITEMS; add the missing names`);
  fs.writeFileSync(file, html);
  console.log(path.basename(file) + ': ' + hits + ' shopping-list items updated');
}

/* ---- working sidecar --------------------------------------------------- */
const md = ['# Shopping-list prices: working', '', `Generated by \`node tools/update-prices.js\` from \`${path.relative(root, csvPath).split(path.sep).join('/')}\` (prices checked ${DATE}).`, '',
  'Rule: median price per unit across the verified store rows (promos ending soon, items that aren\'t comparable, and stand-ins are left out of the median) × the daily amount below. ' +
  'Prices are real online store prices on that date; they change and vary by branch.', '',
  '| Item | Daily amount assumed | Median price | Rows (stores) | Range in data | Daily cost |', '|---|---|---|---|---|---|',
  ...work.map(w => `| ${w.item} | ${w.why} | R${w.med.toFixed(2)} ${UNIT[w.unit]} | ${w.n} (${w.stores.join(', ')}) | R${w.min.toFixed(2)}–R${w.max.toFixed(2)} | ${w.qty} × R${w.med.toFixed(2)} = R${(Math.round(w.qty * w.med * 100) / 100).toFixed(2)} |`),
  '', 'Shown in the app (text range = middle half of the store prices, or min–max when fewer than 4 rows):', '',
  '| App item | Store text | Daily |', '|---|---|---|',
  ...Object.entries(ITEMS).map(([k, it]) => `| ${it.names.join(' / ')} | ${out[k].text} | R${out[k].daily.toFixed(2)} |`), ''];
fs.writeFileSync(path.join(root, 'prices', 'PRICES.md'), md.join('\n'));
console.log('wrote prices/PRICES.md');
