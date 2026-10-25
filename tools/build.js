/* Builds the folder you upload to a web host:   node tools/build.js   →   dist/
   dist/ holds exactly what a phone needs: index.html, manifest.webmanifest, sw.js and icons/.
   sw.js gets a version taken from the content of index.html, so each new release replaces the cached copy. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'icons'), { recursive: true });

const html = fs.readFileSync(path.join(root, 'index.html'));
const version = crypto.createHash('sha1').update(html).update(fs.readFileSync(path.join(root, 'manifest.webmanifest'))).digest('hex').slice(0, 10);

fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.copyFileSync(path.join(root, 'manifest.webmanifest'), path.join(dist, 'manifest.webmanifest'));
fs.writeFileSync(path.join(dist, 'sw.js'), fs.readFileSync(path.join(root, 'sw.js'), 'utf8').replace('__VERSION__', version));
for (const f of fs.readdirSync(path.join(root, 'icons'))) fs.copyFileSync(path.join(root, 'icons', f), path.join(dist, 'icons', f));

/* the Android app (capacitor/, built by tools/sign-app.ps1), if one has been built, so phones can download it from the
   same address */
const apk = path.join(root, 'capacitor', 'android', 'app-release-signed.apk');
if (fs.existsSync(apk)) fs.copyFileSync(apk, path.join(dist, 'newstart.apk'));

/* Security headers for every file. The CSP still needs 'unsafe-inline' for scripts because the app is one page with inline
   onclick handlers; what it does lock down is WHERE code may load from (only this site plus the three pinned, hash-checked
   libraries), where data may be sent (only this site and Supabase), and who may frame the app (nobody). */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in",
  "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

/* index.html carries the same policy as a <meta> tag (it travels with the page — the packaged Android app has no
   host to read _headers). Fail the build if the two copies ever drift apart. */
{
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"\s*\/?>/.exec(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  if (!m) throw new Error('index.html has no Content-Security-Policy meta tag — add it (see dist/_headers)');
  if (m[1] !== CSP) throw new Error('index.html CSP meta tag differs from the _headers policy in tools/build.js — make them identical');
}

const SECURITY = ['/*',
  '  Content-Security-Policy: ' + CSP,
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()',
  '  Strict-Transport-Security: max-age=31536000'];

/* Cloudflare Pages / Netlify: stop the service worker and the page being cached by the CDN for long */
fs.writeFileSync(path.join(dist, '_headers'), [
  ...SECURITY,
  '/sw.js', '  Cache-Control: no-cache', '/index.html', '  Cache-Control: no-cache', '/manifest.webmanifest', '  Cache-Control: no-cache',
  '  Content-Type: application/manifest+json', '/',
  '  Cache-Control: no-cache', '/icons/*', '  Cache-Control: public, max-age=86400',
  '/newstart.apk', '  Content-Type: application/vnd.android.package-archive', '  Content-Disposition: attachment; filename="NEWSTART.apk"', ''].join('\n'));

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.relative(dist, path.join(d, e.name))); })(dist);
console.log('built dist/ (cache version ' + version + ')');
files.sort().forEach(f => console.log('  ' + f.replace(/\\/g, '/')));
