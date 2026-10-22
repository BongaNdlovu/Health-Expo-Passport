/* Draws the app icons (a white heart with a pulse line on the NEWSTART teal) and writes them as PNG files.
   No dependencies: pixels are computed here and encoded with Node's zlib.
   Run:  node tools/make-icons.js            (writes icons/*.png) */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });

/* ---- shapes, in a -1..1 square ------------------------------------------------ */
/* classic heart curve: (x²+y²−1)³ − x²y³ ≤ 0, y pointing up */
const inHeart = (x, y) => Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0;
/* pulse line through the heart, as a polyline with round ends */
const PULSE = [[-1.02, 0.02], [-0.38, 0.02], [-0.2, 0.5], [0.08, -0.52], [0.3, 0.02], [1.02, 0.02]];
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const onPulse = (x, y, w) => PULSE.slice(1).some((p, i) => segDist(x, y, PULSE[i], p) <= w);

/* NEWSTART teal gradient, top-left to bottom-right */
const lerp = (a, b, t) => a + (b - a) * t;
const teal = t => [lerp(0x58, 0x2a, t), lerp(0xb5, 0x7a, t), lerp(0xa7, 0x70, t)];

/* colour of one sample point (u,v in 0..1 across the icon) → [r,g,b,a] 0..255 */
function sample(u, v, { radius, heartScale }) {
  /* rounded-square mask */
  if (radius > 0) {
    const cx = Math.abs(u - 0.5) - (0.5 - radius), cy = Math.abs(v - 0.5) - (0.5 - radius);
    if (cx > 0 && cy > 0 && Math.hypot(cx, cy) > radius) return [0, 0, 0, 0];
  }
  const bg = teal((u + v) / 2);
  /* heart coordinates: centred, y up, shifted slightly so the visual weight is centred */
  const x = (u - 0.5) / heartScale * 2, y = -((v - 0.5) / heartScale * 2) + 0.08;
  if (inHeart(x, y)) {
    if (onPulse(x, y, 0.075)) return [...teal(0.55), 255];
    return [255, 255, 255, 255];
  }
  /* soft glow behind the heart */
  return [...bg, 255];
}

/* ---- rasterise with 4x4 supersampling ---------------------------------------- */
function render(size, opts) {
  const ss = 4, px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sj = 0; sj < ss; sj++) for (let si = 0; si < ss; si++) {
      const [R, G, B, A] = sample((i + (si + 0.5) / ss) / size, (j + (sj + 0.5) / ss) / size, opts);
      r += R * A; g += G * A; b += B * A; a += A;
    }
    const o = (j * size + i) * 4, n = ss * ss;
    px[o] = a ? Math.round(r / a) : 0; px[o + 1] = a ? Math.round(g / a) : 0; px[o + 2] = a ? Math.round(b / a) : 0; px[o + 3] = Math.round(a / n);
  }
  return px;
}

/* ---- PNG encoder --------------------------------------------------------------- */
function png(size, px) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; /* 8-bit RGBA */
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* any = rounded with transparent corners; maskable = full bleed with the heart inside the 80% safe zone;
   apple = full bleed, opaque (iOS rounds the corners itself) */
const jobs = [
  ['icon-192.png', 192, { radius: 0.22, heartScale: 0.62 }],
  ['icon-512.png', 512, { radius: 0.22, heartScale: 0.62 }],
  ['icon-maskable-512.png', 512, { radius: 0, heartScale: 0.5 }],
  ['icon-180.png', 180, { radius: 0, heartScale: 0.6 }],
  ['favicon-32.png', 32, { radius: 0.22, heartScale: 0.7 }],
];
for (const [name, size, opts] of jobs) {
  fs.writeFileSync(path.join(out, name), png(size, render(size, opts)));
  console.log('wrote icons/' + name + ' (' + size + 'x' + size + ')');
}
