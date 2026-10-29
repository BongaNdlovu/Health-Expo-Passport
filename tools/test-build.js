/* Build-contract tests: what dist/ must contain for the update workflow to work and for the app to stay inside
   its own security rules. Dependency-free and fast — run after `npm run build`.

   Run: npm run test:build */

const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
let checks = 0, fails = 0;
const ok = (name, cond, detail) => {
  checks++;
  if (cond) console.log('  PASS  ' + name);
  else { fails++; console.log('  FAIL  ' + name + (detail === undefined ? '' : '  → ' + detail)); }
};

if (!fs.existsSync(path.join(dist, 'version.json'))) {
  console.error('dist/ is missing — run `npm run build` first.');
  process.exit(2);
}

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
const version = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));

console.log('\n1. version.json');
ok('names a build', /^[0-9a-f]{10}$/.test(String(version.version || '')), version.version);
ok('records when it was built', !Number.isNaN(Date.parse(version.built)), version.built);
ok('offers the APK when one is packaged',
  version.apk === null || (version.apk && typeof version.apk.url === 'string'));

console.log('\n2. the page carries its own build id');
const meta = /<meta name="app-version" content="([^"]*)"/.exec(html);
ok('the meta tag is stamped', !!meta, meta ? meta[1] : 'missing');
ok('...with the same version as version.json', meta && meta[1] === version.version, meta && meta[1]);
/* the bare token still appears once inside the bundle, on purpose: it is the guard that makes a development
   page (which is never stamped) skip the check entirely. What must not survive is the meta tag. */
ok('...and no meta tag is left unstamped', !/content="__APP_VERSION__"/.test(html));

console.log('\n3. the service worker waits for the page');
const msgAt = sw.indexOf("addEventListener('message'");
const skipAt = sw.indexOf('self.skipWaiting()');
ok('it listens for SKIP_WAITING', msgAt > -1 && /SKIP_WAITING/.test(sw.slice(msgAt, msgAt + 200)));
ok('skipWaiting is only reachable through that message', skipAt > msgAt && msgAt > -1, 'message@' + msgAt + ' skip@' + skipAt);
ok('the cache version is stamped', !sw.includes('__VERSION__'));

console.log('\n4. caching rules');
ok('version.json is never cached', /\/version\.json[\s\S]{0,60}no-store/.test(headers));
ok('sw.js is never cached', /\/sw\.js[\s\S]{0,60}no-cache/.test(headers));
ok('the APK is served as an attachment', /\/newstart\.apk[\s\S]{0,120}Content-Disposition: attachment/.test(headers));
ok('the page sends a CSP', /Content-Security-Policy:/.test(headers) && /http-equiv="Content-Security-Policy"/.test(html));

console.log('\n5. the new UI is in the shipped page');
ok('the update banner', /id="updateBar"/.test(html) && /data-action="updateNow"/.test(html));
ok('the confirmation sheet', /id="confirmSheet"/.test(html) && /data-action="confirmYes"/.test(html));
ok('the settings sheet', /id="setSheet"/.test(html) && /data-action="closeSettings"/.test(html));
ok('the app bundle is inlined (no module script left)',
  /__NEWSTART/.test(html) && !/type="module" src="\.\/src\/main\.js"/.test(html));

console.log('\n' + '='.repeat(52));
console.log(fails ? `${fails} of ${checks} build checks FAILED` : `all ${checks} build checks passed`);
console.log('='.repeat(52));
process.exit(fails ? 1 : 0);
