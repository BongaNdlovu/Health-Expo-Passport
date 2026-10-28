/* Draws the app icons: a white ECG activity line on the NEWSTART green, matching the in-app logo.
   No dependencies: pixels are computed here and encoded with Node's zlib.
   Run:  node tools/make-icons.js
   Writes the PWA icons and the Android mipmap launcher icons. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const out = path.join(root, 'icons');
const res = path.join(root, 'capacitor', 'android', 'app', 'src', 'main', 'res');
fs.mkdirSync(out, { recursive: true });

/* ---- the ECG activity glyph, in a -1..1 square ------------------------------- */
/* Lucide Activity: M22 12 h-4 l-3 9 L9 3 l-3 9 H2, centred in a 24-unit box */
const ECG = [[22, 12], [18, 12], [15, 21], [9, 3], [6, 12], [2, 12]]
  .map(([x, y]) => [x / 12 - 1, 1 - y / 12]);
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const onMark = (x, y, w) => ECG.slice(1).some((p, i) => segDist(x, y, ECG[i], p) <= w);

/* NEWSTART logo green gradient, top-left to bottom-right */
const lerp = (a, b, t) => a + (b - a) * t;
const green = t => [lerp(0x34, 0x15, t), lerp(0xd3, 0x80, t), lerp(0x75, 0x3d, t)];

/* colour of one sample point (u,v in 0..1 across the icon) → [r,g,b,a] 0..255 */
function sample(u, v, { radius, markScale, stroke }) {
  /* rounded-square mask */
  if (radius > 0) {
    const cx = Math.abs(u - 0.5) - (0.5 - radius), cy = Math.abs(v - 0.5) - (0.5 - radius);
    if (cx > 0 && cy > 0 && Math.hypot(cx, cy) > radius) return [0, 0, 0, 0];
  }
  const x = (u - 0.5) * 2 / markScale;
  const y = (0.5 - v) * 2 / markScale;
  if (onMark(x, y, stroke / 2)) return [255, 255, 255, 255];
  return [...green((u + v) / 2), 255];
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
    px[o] = a ? Math.round(r / a) : 0; px[o + 1] = a ? Math.round(g / a) : 0;
    px[o + 2] = a ? Math.round(b / a) : 0; px[o + 3] = Math.round(a / n);
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
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const write = (file, size, opts) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png(size, render(size, opts)));
};

/* PWA / web icons: rounded square, mark inside the safe area */
const pwa = [
  ['icon-192.png', 192, { radius: 0.22, markScale: 0.9, stroke: 0.14 }],
  ['icon-512.png', 512, { radius: 0.22, markScale: 0.9, stroke: 0.14 }],
  ['icon-maskable-512.png', 512, { radius: 0, markScale: 0.72, stroke: 0.14 }],
  ['icon-180.png', 180, { radius: 0, markScale: 0.85, stroke: 0.14 }],
  ['favicon-32.png', 32, { radius: 0.22, markScale: 0.9, stroke: 0.16 }],
];
for (const [name, size, opts] of pwa) {
  write(path.join(out, name), size, opts);
  console.log('wrote icons/' + name + ' (' + size + 'x' + size + ')');
}

/* Android: legacy launcher + adaptive maskable, at every density */
const densities = [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]];
for (const [d, launcher, maskable] of densities) {
  const dir = path.join(res, 'mipmap-' + d);
  write(path.join(dir, 'ic_launcher.png'), launcher, { radius: 0.22, markScale: 0.9, stroke: 0.14 });
  write(path.join(dir, 'ic_maskable.png'), maskable, { radius: 0, markScale: 0.72, stroke: 0.14 });
  console.log('wrote mipmap-' + d + '/ic_launcher.png + ic_maskable.png');
}
