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
const rawBundle = esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true, format: 'iife', globalName: '__NEWSTART', write: false, logLevel: 'warning',
  /* Ship less without touching behaviour: whitespace/syntax only, identifiers stay readable in stack
     traces. The old build shipped a ~466 KB unminified IIFE inside every page. */
  minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false,
}).outputFiles[0].text;
/* v1.6.2: the app may only start once the secure store (the inline <script id="secureStore"> in index.html) has
   decrypted localStorage into memory, so the bundle is wrapped: it runs when the store calls window.__bootApp(),
   or at once if the store was already ready. */
const bundle = 'window.__bootApp=function(){window.__bootApp=null;window.__NEWSTART=' + rawBundle.trim().replace(/^var __NEWSTART\s*=\s*/, '').replace(/;?$/, ';') + '};\nif(window.__secureReady)window.__bootApp();';
if (!/^var __NEWSTART\s*=/.test(rawBundle.trim())) throw new Error('esbuild output did not start with var __NEWSTART= (the boot wrapper needs it)');
/* nsmem.js ships with its diagnostics build flag OFF. Only a test build (NS_DEV_BUILD=1 node tools/build.js) turns it on. */
const DEV_BUILD = process.env.NS_DEV_BUILD === '1';
const nsmemSrc = fs.readFileSync(path.join(root, 'nsmem.js'), 'utf8');
if (!/var NS_DEV_BUILD = false;/.test(nsmemSrc)) throw new Error('nsmem.js must keep "var NS_DEV_BUILD = false;" in source');
const nsmemOut = DEV_BUILD ? nsmemSrc.replace('var NS_DEV_BUILD = false;', 'var NS_DEV_BUILD = true;') : nsmemSrc;
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
/* v1.6.2: the page also loads these same-origin files, so they are part of the build's identity */
const STATIC_DIRS = ['tutorial', 'vendor'];
const staticFiles = [];
for (const d of STATIC_DIRS) (function walk(rel) {
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) walk(r); else if (!e.name.endsWith('README.md')) staticFiles.push(r);
  }
})(d);
versionHash.update(nsmemOut);
for (const f of staticFiles) versionHash.update(f.replace(/\\/g, '/')).update(fs.readFileSync(path.join(root, f)));
const version = versionHash.digest('hex').slice(0, 10);

/* ---- CSP ---------------------------------------------------------------------------------------------
   No 'unsafe-inline' for scripts: the page has exactly two inline scripts and each is allowed by its own
   content hash — the tiny font picker in <head>, and the app bundle (different on every build, so its hash
   is stamped fresh into the built page and _headers here). The only off-site script source is the one
   library the app loads, pinned down to its exact versioned path — jsDelivr serves arbitrary npm content,
   so the host name alone must never be enough. The style-src 'unsafe-inline' stays: the page styles itself inline. */
const hashOf = s => "'sha256-" + crypto.createHash('sha256').update(s).digest('base64') + "'";
/* v1.6.2: two inline scripts in the shell, each allowed by its own hash: fontPick (theme before first paint) and
   secureStore (encrypts localStorage, then boots the app). The sign-in library is now served from vendor/ ('self'). */
const INLINE_IDS = ['fontPick', 'secureStore'];
const inlineHashes = INLINE_IDS.map(id => {
  const m = shell.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)<\\/script>'));
  if (!m) throw new Error('index.html lost its ' + id + ' script — the CSP hash cannot be computed');
  return hashOf(m[1]);
});

const cspScripts = base => base.replace("'self'", "'self' " + inlineHashes.join(' '));
const policy = scripts => [
  "default-src 'self'",
  cspScripts(scripts),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' " + SITE_ORIGIN + ' ' + SB_API,
  "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');
/* the browser hashes the exact text between <script> and </script>, so the hash is taken of exactly what is
   injected below — newlines included */
const inlineBundle = '\n' + bundle + '\n';
/* The exact URL the app loads (SB_LIB in src/cloud.js). A CSP source without a trailing slash matches that path
   only, so it must be the whole file path — a shortened one blocks the library and sign-in never loads. */
/* The packaged Android app reads /version.json from the website to learn about a new build (src/update.js), so the
   policy lets the page connect to that one origin as well as to itself and Supabase. */
const APP_SITE = (/export const APP_SITE='([^']+)'/.exec(fs.readFileSync(path.join(root, 'src', 'platform.js'), 'utf8')) || [])[1];
if (!APP_SITE) throw new Error('src/platform.js lost its APP_SITE line — the CSP cannot name the site the app updates from');
const SITE_ORIGIN = new URL(APP_SITE).origin;
const SB_CDN = (/export const SB_LIB='([^']+)'/.exec(fs.readFileSync(path.join(root, 'src', 'cloud.js'), 'utf8')) || [])[1];
if (!SB_CDN) throw new Error('src/cloud.js lost its SB_LIB line — the CSP cannot name the library it must allow');
/* Data may leave only for this one Supabase project (SB_URL in src/cloud.js), https for the REST/auth calls and
   wss for realtime — not the *.supabase.co wildcard, which would have blessed every Supabase project on earth. */
const SB_URL = (/export const SB_URL='([^']+)'/.exec(fs.readFileSync(path.join(root, 'src', 'cloud.js'), 'utf8')) || [])[1];
if (!SB_URL) throw new Error('src/cloud.js lost its SB_URL line — the CSP cannot name the database host');
const SB_HOST = new URL(SB_URL).host;
const SB_API = 'https://' + SB_HOST + ' wss://' + SB_HOST;
/* a same-origin library path (vendor/...) is covered by 'self'; only an off-site URL needs naming */
const SB_SRC = /^https:\/\//.test(SB_CDN) ? ' ' + SB_CDN : '';
const CSP_DEV = policy("script-src 'self'" + SB_SRC);
const CSP_DIST = policy("script-src 'self' " + hashOf(inlineBundle) + SB_SRC);

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
fs.writeFileSync(path.join(dist, 'nsmem.js'), nsmemOut);
for (const f of staticFiles) { fs.mkdirSync(path.dirname(path.join(dist, f)), { recursive: true }); fs.copyFileSync(path.join(root, f), path.join(dist, f)); }
if (DEV_BUILD) console.log('NOTE: NS_DEV_BUILD=1 — nsmem.js diagnostics flag ON (test build only)');

/* the Android app (capacitor/, built by tools/sign-app.ps1), if one has been built, so phones can download it from the
   same address */
const apk = path.join(root, 'capacitor', 'android', 'app-release-signed.apk');
if (fs.existsSync(apk)) fs.copyFileSync(apk, path.join(dist, 'newstart.apk'));

/* The build id of the page packaged inside the APK, read from the APK itself (a zip: assets/public/index.html), so
   version.json says exactly what the download holds. The app offers an update only when this differs from its own
   page; before, it compared the website's id, and a website-only release made every phone reinstall the same app. */
function apkPageVersion(file) {
  const b = fs.readFileSync(file), zlib = require('zlib');
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('newstart.apk is not a zip file');
  let p = b.readUInt32LE(eocd + 16);
  for (let n = b.readUInt16LE(eocd + 10); n > 0; n--) {
    if (b.readUInt32LE(p) !== 0x02014b50) break;
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30), noteLen = b.readUInt16LE(p + 32), local = b.readUInt32LE(p + 42);
    if (b.toString('utf8', p + 46, p + 46 + nameLen) === 'assets/public/index.html') {
      const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28), raw = b.subarray(start, start + size);
      const page = (method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
      return (/<meta name="?app-version"? content="?([0-9a-f]+)"?/.exec(page) || [])[1] || '';
    }
    p += 46 + nameLen + extraLen + noteLen;
  }
  return '';
}
const apkVersion = fs.existsSync(apk) ? apkPageVersion(apk) : '';
if (fs.existsSync(apk) && !apkVersion) throw new Error('could not read the page version inside capacitor/android/app-release-signed.apk');
if (apkVersion && apkVersion !== version) console.log('NOTE: the Android download holds page ' + apkVersion + ', the website is ' + version + ' — run tools\\sign-app.ps1 to ship this build to the app too');

/* What src/update.js reads: the build this folder was made at, and — when an Android build is sitting beside it —
   where to fetch it and which page it holds. */
/* The build date is HEAD's commit date, not the wall clock: two builds of the same source then write the
   same bytes, so a no-op rebuild stops showing dist/ as changed. Outside a git checkout it falls back to
   now. The build's real identity is `version` above, which is a hash of what actually went into it. */
let builtAt = '';
try { builtAt = require('child_process').execFileSync('git', ['log', '-1', '--format=%cI'], { cwd: root, encoding: 'utf8' }).trim(); }
catch (e) { /* not a checkout, or no git on PATH */ }
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({
  version,
  built: builtAt || new Date().toISOString(),
  apk: fs.existsSync(apk) ? { url: 'newstart.apk', version: apkVersion } : null,
}, null, 2) + '\n');

/* Security headers for every file — identical to the built page's meta tag. What the policy locks down is WHERE
   code may load from (only this site, the two inline hashed scripts, and the one library pinned to its exact
   versioned path), where data may be sent (only this site and Supabase), and who may frame the app (nobody). */
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
  /* Filenames here are not content-hashed, so no "immutable": a day (fonts a month) saves a revalidation round-trip per
     file, and a new release still lands because sw.js installs with cache: 'reload'. One rule per path, never two
     matching the same file (Pages would join both Cache-Control values). */
  '/tutorial/*', '  Cache-Control: public, max-age=86400',
  '/vendor/fonts.css', '  Cache-Control: public, max-age=86400',
  '/vendor/supabase.min.js', '  Cache-Control: public, max-age=86400',
  '/vendor/fonts/*', '  Cache-Control: public, max-age=2592000',
  '/version.json', '  Cache-Control: no-store', '  Access-Control-Allow-Origin: *',
  '/newstart.apk', '  Content-Type: application/vnd.android.package-archive', '  Content-Disposition: attachment; filename="NEWSTART.apk"', ''].join('\n'));

/* RFC 9116 security.txt: a researcher who finds something has somewhere to take it instead of going public.
   Monitored by End of Time Academy (project owner). */
fs.mkdirSync(path.join(dist, '.well-known'), { recursive: true });
fs.writeFileSync(path.join(dist, '.well-known', 'security.txt'), [
  'Contact: mailto:admin@endoftime7.com',
  'Expires: 2027-10-30T00:00:00.000Z',
  'Preferred-Languages: en',
  '# Health Expo Passport (NEWSTART). Please include the page address and a screenshot with any report.',
  ''].join('\n'));

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.relative(dist, path.join(d, e.name))); })(dist);
console.log('built dist/ (cache version ' + version + ')');
files.sort().forEach(f => console.log('  ' + f.replace(/\\/g, '/')));
