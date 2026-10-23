/* Builds the files the Android app carries inside it:   node tools/build-app.js   →   capacitor/www/
   The app is the same page as the web site (index.html), plus the copies it needs to work with no internet:
   the three libraries and the fonts from vendor/. A library is copied only when its bytes match the integrity hash
   (SRI) pinned in index.html, so the app can never carry a different version from the audited one.
   Then run  npx cap sync android  in capacitor/  (tools/sign-app.ps1 does both and signs the result). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const www = path.join(root, 'capacitor', 'www');
const vendor = path.join(root, 'vendor');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* the library addresses and their pinned hashes, read from index.html itself */
const constOf = n => (html.match(new RegExp("(?:const |,)" + n + "='([^']+)'")) || [])[1];
const sriOf = n => (html.match(new RegExp('\\[' + n + "\\]:'(sha384-[^']+)'")) || [])[1];
const appOf = n => (html.match(new RegExp('\\[' + n + "\\]:'(vendor/[^']+)'")) || [])[1];
const LIBS = ['SB_LIB', 'H5Q', 'QRJS'];

const problems = [];
for (const n of LIBS) {
  const url = constOf(n), sri = sriOf(n), copy = appOf(n);
  if (!url || !sri || !copy) { problems.push(`${n}: address, hash or app copy not found in index.html`); continue; }
  const file = path.join(root, copy);
  if (!fs.existsSync(file)) { problems.push(`${copy} is missing (download ${url})`); continue; }
  const got = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(file)).digest('base64');
  if (got !== sri) problems.push(`${copy} does not match the pinned hash for ${url}`);
}
for (const f of ['fonts.css']) if (!fs.existsSync(path.join(vendor, f))) problems.push(`vendor/${f} is missing`);
if (problems.length) { console.error('NOT built:\n - ' + problems.join('\n - ')); process.exit(1); }

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, 'icons'), { recursive: true });
fs.writeFileSync(path.join(www, 'index.html'), html);
fs.copyFileSync(path.join(root, 'manifest.webmanifest'), path.join(www, 'manifest.webmanifest'));
for (const f of fs.readdirSync(path.join(root, 'icons'))) fs.copyFileSync(path.join(root, 'icons', f), path.join(www, 'icons', f));
fs.cpSync(vendor, path.join(www, 'vendor'), { recursive: true, filter: s => !s.endsWith('README.md') });

const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.relative(www, path.join(d, e.name))); })(www);
console.log(`built capacitor/www/ (${files.length} files; libraries checked against index.html's integrity hashes)`);
files.sort().forEach(f => console.log('  ' + f.replace(/\\/g, '/')));
