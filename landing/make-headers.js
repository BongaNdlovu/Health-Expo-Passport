/* Writes _headers for the landing page: the Content-Security-Policy allows only this page's own inline script,
   pinned by its hash. Run after any change to index.html's script:  node make-headers.js */
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error('expected one inline script, found ' + scripts.length);
const hash = "'sha256-" + crypto.createHash('sha256').update(scripts[0]).digest('base64') + "'";
const csp = ["default-src 'none'", "script-src " + hash, "style-src 'unsafe-inline'", "img-src 'self' data:", "media-src 'self'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"].join('; ');
fs.writeFileSync(path.join(__dirname, '_headers'), ['/*', '  Content-Security-Policy: ' + csp, '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin', '  Permissions-Policy: camera=(), microphone=(), geolocation=()', ''].join('\n'));
console.log('wrote _headers with', hash);
