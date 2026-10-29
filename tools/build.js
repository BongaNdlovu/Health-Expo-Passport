/* Builds the folder you upload to a web host:   node tools/build.js   →   dist/
   The app is the ES modules under src/, bundled with esbuild back into one file and injected into
   index.html in place of the <script type="module"> tag. The page stays a single self-contained
   file, so the offline setup, the service worker (it precaches just the page) and the Android app
   all work exactly as before. Run this BEFORE tools/build-app.js (the Android app packages dist/). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'icons'), { recursive: true });

const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bundle = esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true, format: 'iife', globalName: '__NEWSTART', write: false, logLevel: 'warning',
  /* Ship less without touching behaviour: whitespace/syntax only, identifiers stay readable in stack
     traces. The old build shipped a ~466 KB unminified IIFE inside every page. */
  minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false,
}).outputFiles[0].text;
/* The page is one inline-styled file; minify the shipped copy of each style block, not the source. */
const minifiedShell = shell.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (all, attrs, css) => {
  try { return '<style' + attrs + '>' + esbuild.transformSync(css, { loader: 'css', minify: true }).code + '</style>'; }
  catch (e) { console.warn('CSS minify skipped: ' + e.message); return all; }
});
/* The cache version fingerprints everything the service worker precaches or serves: the app bundle, the page shell
   (styles and markup), the manifest and the icons. Hashing only the bundle and manifest left a change to colours or
   icons under the old cache name, so installed apps kept serving the old files. */
const versionHash = crypto.createHash('sha1').update(bundle).update(minifiedShell).update(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
for (const f of fs.readdirSync(path.join(root, 'icons')).sort()) versionHash.update(f).update(fs.readFileSync(path.join(root, 'icons', f)));
const version = versionHash.digest('hex').slice(0, 10);

/* ---- CSP ---------------------------------------------------------------------------------------------
   No 'unsafe-inline' for scripts: the page has exactly two inline scripts and each is allowed by its own
   content hash — the tiny font picker in <head>, and the app bundle (different on every build, so its hash
   is stamped fresh into the built page and _headers here). Anything else must come from 'self' or the three
   pinned, hash-checked CDNs. The style-src 'unsafe-inline' stays: the page styles itself inline. */
const hashOf = s => "'sha256-" + crypto.createHash('sha256').update(s).digest('base64') + "'";
const fontPick = (shell.match(/<script id="fontPick">([\s\S]*?)<\/script>/) || [])[1];
if (!fontPick) throw new Error('index.html lost its fontPick script — the CSP hash cannot be computed');

const cspScripts = base => base.replace("'self'", "'self' " + hashOf(fontPick));
const policy = scripts => [
  "default-src 'self'",
  cspScripts(scripts),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in",
  "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');
/* the browser hashes the exact text between <script> and </script>, so the hash is taken of exactly what is
   injected below — newlines included */
const inlineBundle = '\n' + bundle + '\n';
const CSP_DEV = policy("script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com");
const CSP_DIST = policy("script-src 'self' " + hashOf(inlineBundle) + ' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com');

/* The shell's meta tag is the development policy (dev loads src/main.js as an external module, so it needs
   'self' but not the bundle hash). It must carry the current fontPick hash — fail the build on drift. */
{
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"\s*\/?>/.exec(shell);
  if (!m) throw new Error('index.html has no Content-Security-Policy meta tag — add it (see dist/_headers)');
  if (m[1] !== CSP_DEV) throw new Error('index.html CSP meta tag is out of date — set its script-src to exactly:\n  ' + CSP_DEV);
}

/* replacer functions, not strings: a "$&" or "$'" inside the bundle must be inserted literally */
/* The page's own build id, for src/update.js: it compares this with /version.json to decide whether to offer an
   update. The hash above is taken over the source page, which still holds the placeholder, and the built copy is
   stamped afterwards — the same two-step sw.js already uses for __VERSION__. */
if (!minifiedShell.includes('__APP_VERSION__')) throw new Error('index.html lost its app-version meta — the update check cannot tell which build it is');
const built = minifiedShell.replace('<script type="module" src="./src/main.js"></script>', () => '<script>' + inlineBundle + '</script>')
  .replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/, (all, a, b) => a + CSP_DIST + b)
  .replace('__APP_VERSION__', version);
if (!built.includes('__NEWSTART') || built.includes('<script type="module"')) throw new Error('bundle injection failed');

fs.writeFileSync(path.join(dist, 'index.html'), built);
fs.copyFileSync(path.join(root, 'manifest.webmanifest'), path.join(dist, 'manifest.webmanifest'));
fs.writeFileSync(path.join(dist, 'sw.js'), fs.readFileSync(path.join(root, 'sw.js'), 'utf8').replace('__VERSION__', version));
for (const f of fs.readdirSync(path.join(root, 'icons'))) fs.copyFileSync(path.join(root, 'icons', f), path.join(dist, 'icons', f));

/* the Android app (capacitor/, built by tools/sign-app.ps1), if one has been built, so phones can download it from the
   same address */
const apk = path.join(root, 'capacitor', 'android', 'app-release-signed.apk');
if (fs.existsSync(apk)) fs.copyFileSync(apk, path.join(dist, 'newstart.apk'));

/* What src/update.js reads: the build this folder was made at, and — when an Android build is sitting beside it —
   where to fetch it. No version is claimed for the APK: it was packaged from whichever dist/ existed at the time,
   and its own page carries that build's id. */
/* The build date is HEAD's commit date, not the wall clock: two builds of the same source then write the
   same bytes, so a no-op rebuild stops showing dist/ as changed. Outside a git checkout it falls back to
   now. The build's real identity is `version` above, which is a hash of what actually went into it. */
let builtAt = '';
try { builtAt = require('child_process').execFileSync('git', ['log', '-1', '--format=%cI'], { cwd: root, encoding: 'utf8' }).trim(); }
catch (e) { /* not a checkout, or no git on PATH */ }
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({
  version,
  built: builtAt || new Date().toISOString(),
  apk: fs.existsSync(apk) ? { url: 'newstart.apk' } : null,
}, null, 2) + '\n');

/* Security headers for every file — identical to the built page's meta tag. What the policy locks down is WHERE
   code may load from (only this site, the two inline hashed scripts, and the three pinned libraries), where data
   may be sent (only this site and Supabase), and who may frame the app (nobody). */
const SECURITY = ['/*',
  '  Content-Security-Policy: ' + CSP_DIST,
  '  X-Content-Type-Options: nosniff',
  '  X-Frame-Options: DENY',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
  '  Strict-Transport-Security: max-age=31536000'];

/* Cloudflare Pages / Netlify: stop the service worker and the page being cached by the CDN for long */
fs.writeFileSync(path.join(dist, '_headers'), [
  ...SECURITY,
  '/sw.js', '  Cache-Control: no-cache', '/index.html', '  Cache-Control: no-cache', '/manifest.webmanifest', '  Cache-Control: no-cache',
  '  Content-Type: application/manifest+json', '/',
  '  Cache-Control: no-cache', '/icons/*', '  Cache-Control: public, max-age=86400',
  '/version.json', '  Cache-Control: no-store',
  '/newstart.apk', '  Content-Type: application/vnd.android.package-archive', '  Content-Disposition: attachment; filename="NEWSTART.apk"', ''].join('\n'));

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.relative(dist, path.join(d, e.name))); })(dist);
console.log('built dist/ (cache version ' + version + ')');
files.sort().forEach(f => console.log('  ' + f.replace(/\\/g, '/')));
