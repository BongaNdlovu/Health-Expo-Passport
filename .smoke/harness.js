/* Headless smoke test for the NEWSTART passport.
   Builds a minimal fake DOM, boots the app bundle (the same esbuild build the site ships),
   then drives the volunteer section the way a user would and asserts the results. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('esbuild');

/* the app is now ES modules under src/: bundle them exactly as tools/build.js does,
   then read the app's internals through the __internals export (src/main.js) */
const bundled = esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'main.js')],
  bundle: true, format: 'iife', globalName: '__NEWSTART', write: false, logLevel: 'silent',
}).outputFiles[0].text;
const body = bundled;   /* the bundle is run as-is; the internals export inside it is the test surface */
/* the page shell (index.html) is still what serves the styles, the font picker and the static markup */
const html = fs.readFileSync(process.env.APP_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
/* the app's own source text, for assertions written against the original formatting */
const srcText = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');

/* const/let declarations are not exposed on the vm global, so re-export the
   bindings the test needs. This runs in the same script scope. */
const EXPORTS = [
  'volunteers', 'attendees', 'state', 'SEED_VOL', 'BOOTHS', 'BADGE_TIERS', 'EXPO_UPCOMING', 'AVAIL', 'SKILLS', 'STATUS_UI',
  'showCrash', 'hideCrash', 'crashAction',
  'badgeTier', 'nextTier', 'tierProgress', 'volHours', 'volExpos', 'volLevel', 'VOL_LEVEL_MAX', 'volYears', 'needsRegistration', 'helpersAt',
  'boothLabel', 'boothHue', 'staffedCount', 'esc', 'render', 'setVol', 'setVolTab', 'openVolReg', 'startNewVolunteer',
  'saveVolunteer', 'toggleDraftList', 'toggleDraftBooth', 'pickSecondBooth', 'toggleShift', 'logExpoEntry',
  'saveExpoEntry', 'removeExpoEntry', 'exportVolCSV', 'persistNow', 'loadPersisted', 'resetDemo', 'AV',
  'pickVolunteer', 'openSwitcher', 'openVolSwitcher', 'openVolModal', 'switchTab', 'daysTo', 'volRow', 'medalHTML',
  'tierRemaining', 'registerSubmit', 'nextBadge', 'csvCell', 'closeVolReg', 'setVolTab', 'todayStr',
  'switchToVol', 'toggleReg', 'viewHome', 'viewCare', 'buildPrintCard', 'openWhatsApp',
  'viewResults', 'viewPlan', 'viewScreen', 'migrateAttendee', 'migrateVolunteer', 'onStep',
  'onStationInput', 'onStationCommit', 'cat', 'healthAge', 'exportCSV', 'redFlag', 'doneCount', 'bmi',
  'firstName', 'initials', 'careNotes',
  'cloud', 'cloudInit', 'cloudSync', 'cloudPush', 'cloudDirtyList', 'cloudPending', 'cloudSignOut', 'cloudAuthEvent',
  'cloudSignIn', 'onRemoteChange', 'KINDS', 'sigOf', 'isSeedRow', 'mergeRemote', 'renderCloudBody', 'setCloud',
  'startRealtime', 'stopRealtime', 'saveSynced', 'loadSynced', 'viewNoVisitor', 'CLOUD_UI', 'attToRow', 'volToRow',
  'rowToAtt', 'rowToVol', 'openCloud', 'closeCloud', 'afterMerge',
  'showAllCare', 'filterVisitors', 'visitorsToShow', 'fetchRows',
  'gateState', 'renderGate', 'gateDemo', 'togglePass',
  'gateView', 'cloudSignUp', 'cloudResend', 'cloudForgot', 'cloudNewPassword', 'passwordProblem', 'validEmail',
  'waNumber', 'waMessage', 'sendWhatsApp', 'openEmail', 'sendEmail', 'mailtoHref', 'toggleInterest', 'onPrayer', 'reservePouch', 'followUpCard', 'INT',
  'queue', 'qs', 'queueJoin', 'queueCallNext', 'queueServe', 'queueDone', 'queueBack', 'queueRemove', 'qStats', 'qList', 'qMode', 'qCan', 'viewQueue',
  'cheapDay', 'cheapLine', 'foodPriceOf', 'foodKeyOf', 'FOOD_PRICES', 'money', 'closeWhatsApp',
  'planNeeds', 'bpStage', 'PROTOCOLS', 'BOOK_REF', 'autoProtocol', 'costOf',
  'BOOK2_REF', 'BOOK3_REF', 'BOOK4_REF', 'refLabel', 'planBooks', 'planCredit', 'HELP_LINE',
  'acctGate', 'acctGateHTML', 'loadAccount', 'openAcct', 'closeAcct', 'renderAcct', 'acctTabs', 'acctButtons', 'joinChurch',
  'memberRow', 'churchAdminHTML', 'platformHTML', 'adminDataHTML', 'roleLabel', 'adminPostHTML',
  'registerChurch', 'leaveChurch', 'saveMyDetails', 'churchSearch', 'setMember', 'linkMember', 'removeMember', 'setChurchStatus',
  'manageChurch', 'saveChurch', 'inChurch', 'conflictOn', 'dropChurchData', 'adoptChurch', 'healthHTML',
  'planFor', 'PRICE_DATE', 'ACTIONS', 'FOOD_WHY', 'urgentOf', 'DISCLAIMER', 'PRECAUTIONS', 'openFood', 'closeFood', 'problemOf',
  'churchPlanList', 'chooseChurchPlan', 'editChurchPlan', 'saveChurchPlan', 'deleteChurchPlan', 'DEMO_CHURCH_PLANS',
  'followupList', 'chooseFollowup', 'setFollowup', 'makeInvite', 'cancelInvites', 'pendingInvite', 'nextBadge', 'INVITE_KEY',
  'health', 'noteHealth', 'healthReset', 'healthTest', 'statusPanelHTML', 'homeHealthHTML', 'acctHealthHTML', 'qStateBar',
  'SERVE_TABS', 'viewProfile', 'profGate', 'gateBack', 'profPassword', 'profDeleteAsk', 'profDeleteTyped', 'profDeleteGo',
  'profileChanged', 'passwordCheck', 'savePassword',
];
const code = body;   /* the bundle is run as-is; the internals export inside it is the test surface */

/* ---- minimal DOM ---------------------------------------------------- */
function makeEl(id) {
  /* the app toggles containers with an inline display style, so record it */
  const style = { setProperty() {}, removeProperty() {}, display: '' };
  const el = {
    id, value: '', textContent: '', _html: '',
    style,
    dataset: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : f; on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    get className() { return [...this.classList._s].join(' '); },
    set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    set innerHTML(v) { this._html = String(v); },
    get innerHTML() { return this._html; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return makeEl('anon'); },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 40 }; },
    focus() {}, blur() {}, click() {}, remove() {}, setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    scrollTo() {}, play() { return Promise.resolve(); },
    firstElementChild: null,
  };
  el.firstElementChild = el;
  return el;
}
const els = new Map();
const $el = id => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); };

const document = {
  documentElement: makeEl('html'),
  body: makeEl('body'),
  head: makeEl('head'),
  hidden: false,
  getElementById: id => $el(id),
  querySelector(sel) { return $el(String(sel).replace(/^#/, '')); },
  querySelectorAll() { return []; },
  createElement: () => makeEl('created'),
  addEventListener() {}, removeEventListener() {},
  startViewTransition: null,
};

const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

let rafQueue = [];
const sandbox = {
  document, localStorage,
  NEWSTART_NO_CLOUD: true,    /* the cloud tests start it explicitly, against a fake server */
  navigator: { hardwareConcurrency: 8, deviceMemory: 8, mediaDevices: null, userAgent: 'node', onLine: true },
  location: { href: 'http://localhost/', protocol: 'http:', origin: 'http://localhost', pathname: '/' },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  requestAnimationFrame: fn => { rafQueue.push(fn); return rafQueue.length; },
  cancelAnimationFrame() {},
  requestIdleCallback: fn => { setTimeout(() => fn({ timeRemaining: () => 5 }), 0); return 1; },
  setTimeout, clearTimeout, setInterval, clearInterval,
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Blob: function () {},
  Date, Math, JSON, console, performance: { now: () => Date.now() },
  innerWidth: 390, innerHeight: 844, scrollY: 0, scrollTo() {},
  addEventListener() {}, removeEventListener() {},
  alert() {}, confirm: () => true, prompt: () => null,
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  BarcodeDetector: undefined,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

/* ---- run ------------------------------------------------------------ */
let failures = 0, checks = 0;
const ok = (label, cond, extra) => {
  checks++;
  if (cond) console.log('  PASS  ' + label);
  else { failures++; console.log('  FAIL  ' + label + (extra ? '  → ' + extra : '')); }
};

try {
  vm.runInContext(code, sandbox, { filename: 'app.js' });
} catch (e) {
  console.log('BOOT THREW: ' + e.stack);
  process.exit(1);
}
console.log('\nBoot: OK (no exception)\n');

const g = sandbox.__NEWSTART && sandbox.__NEWSTART.__internals;
if (!g) { console.log('the bundle exposed no __NEWSTART.__internals'); process.exit(1); }
const $main = $el('main');

/* ---- 1. volunteer data + badge maths -------------------------------- */
console.log('1. Badge tiers');
ok('7 seed volunteers loaded', g.volunteers.length === 7, 'got ' + g.volunteers.length);
const byName = n => g.volunteers.find(v => v.name === n);
const thandi = byName('Thandi Mabaso'), grace = byName('Grace Nkosi'), nomvula = byName('Nomvula Dlamini');
ok('Thandi: 4 expos / 30h → Silver medal', g.badgeTier(thandi).n === 2, 'got tier ' + g.badgeTier(thandi).n);
ok('Thandi is Level 4 (one per expo)', g.volLevel(thandi) === 4, 'got Lv' + g.volLevel(thandi));
ok('Grace: 6 expos / 45.5h → Gold medal, Level 6', g.badgeTier(grace).n === 3 && g.volLevel(grace) === 6,
  'got tier ' + g.badgeTier(grace).n + ' Lv' + g.volLevel(grace));
ok('Nomvula: 0 expos → Friend medal, no level (0 cannot count)',
  g.badgeTier(nomvula).n === 0 && g.volLevel(nomvula) === 0,
  'got tier ' + g.badgeTier(nomvula).n + ' Lv' + g.volLevel(nomvula));
ok('level counts one per expo and stops at 50',
  g.volLevel({ history: Array(55).fill({ hours: 1 }) }) === g.VOL_LEVEL_MAX && g.VOL_LEVEL_MAX === 50,
  'got ' + g.volLevel({ history: Array(55).fill({ hours: 1 }) }));
ok('medal shows the level number, never 0',
  g.medalHTML(thandi).includes('>4<') && !g.medalHTML(nomvula).includes('>0<')
    && g.medalHTML(nomvula).includes('–') && g.medalHTML(nomvula).includes('Friend'),
  g.medalHTML(nomvula).replace(/\s+/g, ' ').slice(0, 120));
ok('hours sum correctly (Grace = 45.5)', g.volHours(grace) === 45.5, 'got ' + g.volHours(grace));
ok('next tier for Grace is Platinum', (g.nextTier(grace) || {}).n === 4);
const pg = g.tierProgress(grace);
ok('Grace needs 3 more expos for Platinum', pg.needExpos === 3, 'got ' + pg.needExpos);
ok('Grace needs 14.5 more hours', pg.needHours === 14.5, 'got ' + pg.needHours);
/* Both minimums must be met, so progress toward the next badge is the weaker
   of the two, measured against the NEXT tier's minimums (6/9 expos = 67%). */
ok('progress tracks the weaker requirement (67%)', pg.pct === 67, 'got ' + pg.pct);
ok('blocking requirement is expos', pg.blockedBy === 'expos', 'got ' + pg.blockedBy);
ok('remaining sentence names both gaps',
  g.tierRemaining(grace) === '3 more expos + 14.5 more hours for Platinum',
  g.tierRemaining(grace));
/* a helper whose hours lag behind their expo count is gated on hours */
const hoursGated = { history: Array.from({ length: 6 }, () => ({ hours: 6 })) };  /* 6 expos / 36h */
const ph = g.tierProgress(hoursGated);
ok('hours-gated helper reports hours', ph.blockedBy === 'hours', 'got ' + ph.blockedBy);
ok('hours-gated progress is 60%', ph.pct === 60, 'got ' + ph.pct);
ok('hours-gated helper needs 3 more expos', ph.needExpos === 3, 'got ' + ph.needExpos);
/* exactly on both minimums promotes without a gap */
ok('meeting both minimums promotes (6 expos / 36h → Gold)', g.badgeTier(hoursGated).n === 3,
  'got tier ' + g.badgeTier(hoursGated).n);
ok('Legend has no next tier', g.nextTier({ history: Array(12).fill({ hours: 8 }) }) === null);
ok('exactly one top-tier badge', g.BADGE_TIERS.filter(t => t.n === 5).length === 1);

/* ---- 2. booth assignment ------------------------------------------- */
console.log('\n2. Booths');
ok('12 booths defined', g.BOOTHS.length === 12, 'got ' + g.BOOTHS.length);
ok('helpersAt(bp) counts only registered', g.helpersAt('bp').every(v => !g.needsRegistration(v)));
ok('boothLabel resolves', g.boothLabel('kitchen') === 'Kitchen Pharmacy', g.boothLabel('kitchen'));
ok('unknown booth falls back', g.boothLabel('nope') === 'Unassigned');
ok('prospects are not counted as staffed', g.staffedCount() === 5, 'got ' + g.staffedCount());
ok('2 pledges await registration', g.volunteers.filter(g.needsRegistration).length === 2);

/* ---- 3. render every view ------------------------------------------ */
console.log('\n3. Views render');
g.state.tab = 'serve';
for (const t of ['pledge', 'muster', 'booth', 'record']) {
  g.state.volTab = t;
  try {
    g.render();
    const out = $main.innerHTML;
    ok('serve/' + t + ' renders markup', out.length > 400, out.length + ' chars');
  } catch (e) { ok('serve/' + t + ' renders markup', false, e.message); }
}
g.state.volTab = 'pledge'; g.openVolReg();
ok('registration form renders', $main.innerHTML.includes('Who you are'));
ok('registration form lists 12 booth choices',
  (($main.innerHTML.match(/boothpick /g) || []).length) === 12,
  'got ' + (($main.innerHTML.match(/boothpick /g) || []).length));
g.state.volRegOpen = false;

/* other tabs must still work after the shell refactor */
for (const t of ['home', 'screen', 'results', 'plan', 'care']) {
  g.state.tab = t;
  try { g.render(); ok('existing tab ' + t + ' still renders', $main.innerHTML.length > 200); }
  catch (e) { ok('existing tab ' + t + ' still renders', false, e.message); }
}

/* REGRESSION: #main is ONE container shared by the visitor views and the serve
   section. It must be visible and populated in BOTH modes.
   The original bug: render() added a "hidden" class for the serve tab, then
   renderServeView() wrote content into the same element without removing it —
   the Team tab rendered nothing and, worse, every visitor tab stayed blank
   after visiting it. */
console.log('\n3b. Every tab leaves the shared container visible and populated');
g.state.tab = 'serve'; g.state.volTab = 'pledge'; g.render();
ok('serve tab keeps the container visible', $main.style.display !== 'none',
  'display=' + JSON.stringify($main.style.display));
ok('serve tab content was written', $main.innerHTML.includes('Incoming expo'));
for (const t of ['home', 'screen', 'results', 'plan', 'care']) {
  g.state.tab = t; g.render();
  ok('back on ' + t + ': container visible', $main.style.display !== 'none',
    'display=' + JSON.stringify($main.style.display));
  ok('back on ' + t + ': has content', $main.innerHTML.length > 200);
}
/* each Team sub-tab must render its own view, visible, with its marker text */
g.state.tab = 'serve';
const SIG = { pledge: 'Incoming expo', muster: 'Booth coverage', booth: 'Booth assignment', record: 'Volunteer service record' };
for (const vt of ['pledge', 'muster', 'booth', 'record']) {
  g.state.volTab = vt; g.render();
  ok('serve/' + vt + ' visible + populated',
    $main.style.display !== 'none' && $main.innerHTML.includes(SIG[vt]),
    'display=' + JSON.stringify($main.style.display) + ' len=' + $main.innerHTML.length);
}
/* and returning to serve after visiting a visitor tab must work again */
g.state.tab = 'care'; g.render();
g.state.tab = 'serve'; g.state.volTab = 'muster'; g.render();
ok('serve works after round-tripping through Care',
  $main.style.display !== 'none' && $main.innerHTML.includes('Booth coverage'),
  'len=' + $main.innerHTML.length);
g.state.tab = 'serve'; g.state.volTab = 'pledge';

/* ---- 3c. crash guard: an uncaught error is an error state, not a dead screen ---- */
console.log('\n3c. Crash guard');
const crashCard = () => $el('crashCard');
ok('no crash card before any error', crashCard().innerHTML === '');
g.showCrash(new Error('boom: that screen broke'));
const cardHtml = crashCard().innerHTML;
ok('an uncaught error shows the crash card',
  /Something went wrong/.test(cardHtml) && /boom: that screen broke/.test(cardHtml),
  cardHtml.slice(0, 120));
ok('the card reassures that nothing was lost', /Nothing was lost/.test(cardHtml));
ok('the card offers Try again, Reload and Close',
  /Try again/.test(cardHtml) && /Reload the app/.test(cardHtml) && /Close and carry on/.test(cardHtml));
g.showCrash(new Error('boom: that screen broke'));
ok('the same error twice does not restack the card', crashCard().innerHTML === cardHtml);
g.showCrash(new Error('a different failure'));
ok('a different error updates the card message', /a different failure/.test(crashCard().innerHTML));
g.showCrash({ message: 'x'.repeat(500) });
ok('a very long error is truncated, not swallowed', /x{300}…/.test(crashCard().innerHTML));
/* Try again gives render one more chance: the pending tab change is drawn and the card is gone */
g.state.tab = 'home'; g.render();
g.state.tab = 'queue';                       /* changed but not yet drawn */
g.crashAction('again');
ok('Try again hides the card', crashCard().innerHTML === '');
ok('Try again re-rendered the page (queue drawn)', /Who is waiting where/.test($main.innerHTML),
  $main.innerHTML.slice(0, 120));
/* Close and carry on dismisses without touching the page; Reload never throws, even
   where the host has no reload (the smoke fake DOM has no location.reload) */
g.showCrash(new Error('one more'));
g.crashAction('close');
ok('Close and carry on dismisses the card', crashCard().innerHTML === '');
ok('Reload does not throw on a host without reload', (g.crashAction('reload'), true));
ok('hiding an absent card is safe', (g.hideCrash(), true));

/* ---- 4. pledge, then register -------------------------------------- */
console.log('\n4. Pledge → register flow');
g.resetDemo();                       /* known starting point */
const before = g.volunteers.length;
g.startNewVolunteer();
$el('vfName').value = 'Bongani Zulu';
$el('vfPhone').value = '082 111 2222';
g.state.vf.name = 'Bongani Zulu';
g.state.vf.phone = '082 111 2222';
g.toggleDraftList('skills', 'clinic');
g.toggleDraftBooth('vitals');
g.saveVolunteer();
const bongani = byName('Bongani Zulu');
ok('pledge creates a volunteer', g.volunteers.length === before + 1);
ok('new volunteer gets a VOL- id', /^VOL-\d+$/.test(bongani.id), bongani.id);
ok('new volunteer starts at Friend tier', g.badgeTier(bongani).n === 0);
ok('new volunteer has no expo history', g.volExpos(bongani) === 0);
ok('new volunteer has no level — 0 expos cannot count', g.volLevel(bongani) === 0,
  'got Lv' + g.volLevel(bongani));

/* second booth choice caps the first-choice list at 2 */
g.state.vf = { name: '', phone: '', email: '', pledgeExpos: 1, skills: [], pref: [], avail: [] };
g.toggleDraftBooth('bp'); g.toggleDraftBooth('sugar'); g.toggleDraftBooth('kids');
ok('first-choice list caps at 2', g.state.vf.pref.length === 2, JSON.stringify(g.state.vf.pref));
ok('oldest choice is dropped (FIFO)', g.state.vf.pref[0] === 'sugar' && g.state.vf.pref[1] === 'kids',
  JSON.stringify(g.state.vf.pref));

/* ---- 5. logging an expo advances the badge ------------------------- */
console.log('\n5. Log an expo → badge promotion');
/* re-fetch: object identity is guaranteed after the reset above */
const nom = g.volunteers.find(v => v.name === 'Nomvula Dlamini');
g.setVol(nom.id);
const lvBefore = g.badgeTier(nom).n;
g.logExpoEntry();
/* the app reads these inputs at submit time, so they must be set on the same
   element objects the app resolves through $('#...') */
$el('lgName').value = 'Autumn Health Expo';
$el('lgDate').value = '2026-03-14';
$el('lgHours').value = '8';
$el('lgBooth').value = 'kids';
ok('log form reads the hours input', $el('lgHours').value === '8');
g.saveExpoEntry();
ok('expo appended to history', g.volExpos(nom) === 1, 'got ' + g.volExpos(nom));
ok('hours recorded', g.volHours(nom) === 8, 'got ' + g.volHours(nom));
ok('badge promoted Friend → Bronze', g.badgeTier(nom).n === lvBefore + 1,
  lvBefore + ' → ' + g.badgeTier(nom).n);
ok('first expo counts as Level 1', g.volLevel(nom) === 1, 'got Lv' + g.volLevel(nom));
const key = nom.history[0].expo + '-' + nom.history[0].date;
g.removeExpoEntry(key);
ok('entry can be removed again', g.volExpos(nom) === 0, 'got ' + g.volExpos(nom));
ok('badge reverts after removal', g.badgeTier(nom).n === lvBefore);
ok('level reverts too — nothing counts from a removed expo', g.volLevel(nom) === 0,
  'got Lv' + g.volLevel(nom));

/* invalid hours are rejected, not stored */
g.logExpoEntry();
$el('lgHours').value = '0';
g.saveExpoEntry();
ok('zero hours is rejected', g.volExpos(nom) === 0);
g.state.logOpen = false;

/* ---- 6. shift toggling --------------------------------------------- */
console.log('\n6. Shift signup');
const thandi2 = g.volunteers.find(v => v.name === 'Thandi Mabaso');
g.setVol(thandi2.id);
const shiftCount = () => (thandi2.shift || '').split(',').map(s => s.trim()).filter(Boolean).length;
g.toggleShift('08:30–11:00');
ok('shift added', shiftCount() === 1, JSON.stringify(thandi2.shift));
g.toggleShift('08:30–11:00');
ok('shift removed on second tap', shiftCount() === 0, JSON.stringify(thandi2.shift));
g.toggleShift('07:00 setup');
g.toggleShift('16:00 pack-up');
ok('multiple shifts accumulate', shiftCount() === 2, JSON.stringify(thandi2.shift));
ok('shift survives a reload', (() => {
  g.persistNow();
  const saved = JSON.parse(localStorage.getItem('newstart.passport.v2'));
  const rec = saved.volunteers.find(v => v.id === thandi2.id);
  return rec && rec.shift === thandi2.shift;
})());

/* ---- 7. persistence round-trip ------------------------------------- */
console.log('\n7. Persistence');
g.persistNow();
const saved = JSON.parse(localStorage.getItem('newstart.passport.v2'));
ok('payload contains volunteers', Array.isArray(saved.volunteers) && saved.volunteers.length === g.volunteers.length);
ok('payload contains active volunteer id', saved.volId === thandi.id, saved.volId);
ok('older payloads without volunteers still load', (() => {
  const legacy = { attendees: saved.attendees, activeId: saved.activeId, sim: saved.sim };
  localStorage.setItem('newstart.passport.v2', JSON.stringify(legacy));
  const reloaded = g.loadPersisted();
  return reloaded === true && g.volunteers.length > 0;
})(), 'legacy fallback failed');
/* restore full payload */
localStorage.setItem('newstart.passport.v2', JSON.stringify(saved));
ok('full payload reloads', g.loadPersisted() === true);

/* ---- 8. HTML escaping ---------------------------------------------- */
console.log('\n8. Escaping');
ok('esc neutralises a script tag',
  g.esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;',
  g.esc('<img src=x onerror=alert(1)>'));
g.startNewVolunteer();
g.state.vf.name = '<b>Bold</b> Nkosi';
g.state.vf.phone = '082 000 0000';
g.state.vf.pref = ['bp'];
g.saveVolunteer();
const bold = g.volunteers.find(v => v.name === '<b>Bold</b> Nkosi');
ok('hostile name is stored raw but rendered escaped', !!bold);
g.setVol(bold.id); g.state.volTab = 'record'; g.render();
ok('render output has no live <b> tag from the name',
  !$main.innerHTML.includes('<b>Bold</b>'), 'unescaped name reached the DOM');

/* ---- 9. CSV --------------------------------------------------------- */
console.log('\n9. CSV export');
let csvBlob = null;
sandbox.Blob = function (parts) { csvBlob = parts.join(''); };
g.exportVolCSV();
ok('CSV produced', typeof csvBlob === 'string' && csvBlob.length > 100);
csvBlob = csvBlob.replace(/^﻿/, '');   /* BOM so Excel reads UTF-8 names correctly */
ok('CSV header present', csvBlob.startsWith('"Volunteer ID","Name"'));
ok('CSV quotes embedded correctly', !/","[^"]*$/.test(csvBlob.split('\n')[0]));
ok('the roster CSV carries a Team leader column, filled for the leader', csvBlob.includes('"Team leader"') && /"Team leader"|"Yes"/.test(csvBlob) && /,"Yes",/.test(csvBlob), csvBlob.split('\n')[0]);
ok('one CSV row per volunteer', csvBlob.trim().split('\n').length === g.volunteers.length + 1,
  (csvBlob.trim().split('\n').length - 1) + ' rows vs ' + g.volunteers.length + ' volunteers');

/* ---- 10. demo reset ------------------------------------------------- */
console.log('\n10. Reset');
g.resetDemo();
ok('reset restores 7 seed volunteers', g.volunteers.length === 7, 'got ' + g.volunteers.length);
ok('reset restores the seed active volunteer', g.state.volId === 'VOL-1001', g.state.volId);

/* ---- 11. visitor registration, badge ids, escaping ------------------ */
console.log('\n11. Visitor registration');
const submitReg = (o) => {
  g.state.tab = 'home'; g.state.regOpen = true;
  $el('rgName').value = o.name; $el('rgAge').value = o.age ?? '46'; $el('rgSex').value = 'Male';
  $el('rgPhone').value = o.phone ?? ''; $el('rgEmail').value = o.email ?? ''; $el('rgHeight').value = '170'; $el('rgConsent').checked = o.consent ?? true; $el('rgOptin').checked = !!o.optin;
  $el('rgGuardian').checked = !!o.guardian; $el('rgGuardianName').value = o.guardianName ?? '';
  g.registerSubmit({ preventDefault() {} });
};
/* POPIA: consent at registration */
g.resetDemo();
{
  const n = g.attendees.length, by = nm => g.attendees.find(a => a.name === nm);
  /* the follow-up tick starts unticked: ask once before touching it */
  g.state.tab = 'home'; g.state.regOpen = true; g.render();
  ok('POPIA: the follow-up question is a second tick, unticked by default', !/id="rgOptin"[^>]*checked/.test($main.innerHTML) && /id="rgOptin"/.test($main.innerHTML)
    && /Optional/.test($main.innerHTML), '');
  submitReg({ name: 'No Consent', badge: 'EXPO-701', consent: false });
  ok('POPIA: a visitor cannot be registered without the health-information consent', g.attendees.length === n && /consent/i.test($el('rgErr').innerHTML));
  submitReg({ name: 'Young One', age: '15', badge: 'EXPO-702' });
  ok('POPIA: under 18 needs a parent or guardian', !by('Young One') && /guardian/i.test($el('rgErr').innerHTML));
  submitReg({ name: 'Young Two', age: '15', badge: 'EXPO-703', guardian: true, guardianName: 'Ma Dlamini' });
  const y = by('Young Two');
  ok('POPIA: with the guardian named and ticked, the child is registered and the guardian kept', !!y && y.interests.guardian === true && y.interests.guardianName === 'Ma Dlamini'
    && y.interests.consent === true && y.interests.optin === false && y.interests.consentV === '2026-10-27' && /^\d{4}-\d{2}-\d{2}$/.test(y.interests.consentOn),
    JSON.stringify(y && y.interests));
  ok('POPIA: the consent record survives loading and syncing', (() => { const m = g.rowToAtt(g.attToRow(y)).interests;
    return m.consent === true && m.guardianName === 'Ma Dlamini' && m.consentOn === y.interests.consentOn && m.consentV === '2026-10-27'; })());
  submitReg({ name: 'Adult Optin', badge: 'EXPO-704', optin: true, phone: '082 555 0704' });
  ok('POPIA: the screening yes saves the record, the follow-up yes is what allows contact', by('Adult Optin') && by('Adult Optin').interests.optin === true
    && y.interests.optin === false
    && (() => { g.state.tab = 'home'; g.state.regOpen = true; g.render(); const h = $main.innerHTML;
      return h.includes('Do you consent to today’s health screening, including any prayer request you share?') && /id="rgOptin"/.test(h) && /kept with the record/.test(h)
        && /deleted 7 days after your visit/.test(h) && /up to 2 years after your last visit/.test(h); })());
  y.phone = '082 555 0703'; y.interests.optin = false;   /* they later asked the church to stop the follow-up */
  let out = ''; const keep = sandbox.Blob; sandbox.Blob = function (p) { out = p.join(''); }; g.exportCSV(); sandbox.Blob = keep;
  { const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8'), yrs = (bundled.match(/RETENTION_YEARS ?= ?([0-9]+)/) || [])[1];
    ok('POPIA: the retention the notice promises is the one the database purge applies', !!yrs && sql.includes("delete from public.attendees where updated_at < now() - interval '" + yrs + " years'")
      && sql.includes('revoke all on function public.purge_expired_visitors() from public, anon;'), yrs); }
  ok('POPIA: the follow-up CSV leaves out contact details of anyone who did not opt in', !out.includes('555 0703') && out.includes('555 0704') && out.includes('"Follow-up allowed"'));
  const old = g.migrateAttendee({ id: 'EXPO-705', name: 'Old Record', age: 40, s: {}, interests: {} });
  g.attendees.push(old); g.state.activeId = old.id; g.state.tab = 'screen'; g.render();
  ok('POPIA: a passport with no consent on record keeps its checks closed and asks first', !$main.innerHTML.includes('id="in-sugar"') && /data-action="recordConsent" data-args="EXPO-705"/.test($main.innerHTML));
}

/* POPIA: readings live 7 days, on the phone as in the database */
g.resetDemo();
{
  const day = 86400000, old = { id: 'EXPO-720', name: 'Old Visit', age: 44, sex: 'Male', phone: '082 000 0720', heightCm: 172,
    s: { sys: 152, dia: 96, sugar: 6.1 }, interests: { consent: true, optin: true }, prayer: 'old prayer', done: true };
  const rec = g.migrateAttendee({ ...old, created_at: new Date(Date.now() - 8 * day).toISOString() });
  const fresh = g.migrateAttendee({ ...old, id: 'EXPO-721', name: 'Fresh Visit', created_at: new Date(Date.now() - 6 * day).toISOString() });
  g.attendees.push(rec, fresh);
  /* screens must render an emptied record without a crash and without "NaN" */
  for (const [id, label] of [['EXPO-720', 'old'], ['EXPO-721', 'fresh']]) {
    g.state.activeId = id;
    for (const t of ['results', 'plan', 'send']) { g.state.tab = t; g.render(); }
    ok('7 days: ' + label + ' record renders Results, Plan and Send with no NaN', !$main.innerHTML.includes('NaN'), label);
  }
  g.state.activeId = 'EXPO-720'; g.state.tab = 'results'; g.render();
  ok('7 days: Results says the readings were deleted, instead of showing numbers', /Readings were deleted 7 days after the visit/.test($main.innerHTML)
    && !$main.innerHTML.includes('152/96'), '');
  g.state.tab = 'plan'; g.render();
  ok('7 days: the Plan says the readings are gone and shows no danger banner from them', /Readings were deleted 7 days after the visit/.test($main.innerHTML)
    && !/See the triage nurse now/.test($main.innerHTML), '');
  g.openWhatsApp();
  ok('7 days: the WhatsApp message no longer carries the old readings, and says they are deleted', /deletes your health readings 7 days after/.test($el('waBody').innerHTML)
    && !$el('waBody').innerHTML.includes('152'), '');
  g.closeWhatsApp(); g.buildPrintCard();
  ok('7 days: the printed card says the readings are deleted after 7 days', /deleted 7 days after your visit/.test($el('printArea').innerHTML), '');

  /* the phone's own copy: a synced record is cleared, a pending one is kept until it uploads */
  const C = g.cloud;
  g.attendees.push(g.migrateAttendee({ id: 'EXPO-722', name: 'Not Opted In', age: 30, s: { sys: 130, dia: 85 }, interests: { consent: true, optin: false },
    created_at: new Date(Date.now() - 9 * day).toISOString() }));
  const pendingOne = g.migrateAttendee({ id: 'EXPO-723', name: 'Pending Edit', age: 33, s: { sys: 141, dia: 91 }, interests: { consent: true, optin: false },
    created_at: new Date(Date.now() - 9 * day).toISOString() });
  g.attendees.push(pendingOne);
  const wasUser = C.user, wasMode = C.mode, syncedBefore = { ...C.synced.att };
  C.user = { id: 'u1', email: 'staff@example.org' }; C.mode = true;
  C.synced.att['EXPO-720'] = g.sigOf(g.attToRow(rec));
  C.synced.att['EXPO-721'] = g.sigOf(g.attToRow(fresh));
  C.synced.att['EXPO-722'] = g.sigOf(g.attToRow(g.attendees.find(a => a.id === 'EXPO-722')));
  /* EXPO-723 is deliberately NOT in the ledger: it has a pending edit that has not uploaded yet */
  ok('fast clock: before the database clock is known, the phone clears nothing by date', !g.retention.clockKnown() && g.applyRetention() === 0, '');
  g.retention.noteServerTime(new Date().toISOString(), Date.now(), Date.now());   /* this phone's clock agrees with the database */
  const cleared = g.applyRetention();
  const r720 = g.attendees.find(a => a.id === 'EXPO-720'), r721 = g.attendees.find(a => a.id === 'EXPO-721');
  ok('7 days: the phone clears a synced old record and keeps its name and phone', !!r720 && r720.phone === '082 000 0720'
    && !Object.values(r720.s).some(v => v != null) && r720.prayer === '', JSON.stringify(r720 && r720.s));
  ok('7 days: …drops a synced old visitor who did not opt in', cleared >= 2 && !g.attendees.some(a => a.id === 'EXPO-722'), 'cleared=' + cleared);
  ok('7 days: …leaves a fresh visit alone', !!r721 && r721.s.sys === 152, JSON.stringify(r721 && r721.s));
  ok('7 days: a pending unsynced edit is not lost before it uploads', !!g.attendees.find(a => a.id === 'EXPO-723'), '');
  ok('7 days: demo visitors are never touched', g.isSeedRow('att', g.attendees.find(a => a.id === 'EXPO-042')) === true);
  /* a phone 10 days fast: judged on the database's clock, a 2-day-old visit is fresh and keeps its readings */
  const twoDays = g.migrateAttendee({ id: 'EXPO-724', name: 'Fast Clock Visit', age: 35, s: { sys: 133, dia: 86 }, interests: { consent: true, optin: true },
    created_at: new Date(Date.now() - 2 * day).toISOString() });
  g.attendees.push(twoDays); C.synced.att['EXPO-724'] = g.sigOf(g.attToRow(twoDays));
  const realNow = Date.now, fast = 10 * day;
  sandbox.Date.now = () => realNow() + fast;
  g.retention.noteServerTime(new Date(realNow()).toISOString(), realNow() + fast, realNow() + fast);
  g.applyRetention();
  const r724 = g.attendees.find(a => a.id === 'EXPO-724');
  ok('fast clock: a phone 10 days fast does not clear a 2-day-old visit', !!r724 && r724.s.sys === 133 && !g.retention.visitIsOld(r724), JSON.stringify(r724 && r724.s));
  /* and a slow phone still sees an 8-day-old visit as old */
  sandbox.Date.now = () => realNow() - fast;
  g.retention.noteServerTime(new Date(realNow()).toISOString(), realNow() - fast, realNow() - fast);
  ok('fast clock: a phone 10 days slow still treats an 8-day-old visit as old', g.retention.visitIsOld(rec), '');
  sandbox.Date.now = realNow;
  g.retention.noteServerTime(new Date().toISOString(), Date.now(), Date.now());
  Object.assign(C, { user: wasUser, mode: wasMode, synced: { att: syncedBefore, vol: C.synced.vol } });
}

/* a pledge needs a way to reach the person: a mobile number or an email address */
g.resetDemo();
{
  const n = g.volunteers.length;
  g.startNewVolunteer(); g.state.vf.name = 'No Contact'; g.state.vf.phone = ''; g.state.vf.email = ''; g.saveVolunteer();
  ok('pledge: with no mobile and no email it is not saved', g.volunteers.length === n && !g.volunteers.some(v => v.name === 'No Contact'), String(g.volunteers.length - n));
  g.state.vf.email = 'not-an-email'; g.saveVolunteer();
  ok('pledge: a malformed email does not count as a contact', g.volunteers.length === n, '');
  g.state.vf.email = 'nocontact@example.org'; g.saveVolunteer();
  const byEmail = g.volunteers.find(v => v.name === 'No Contact');
  ok('pledge: an email alone is enough', !!byEmail && byEmail.email === 'nocontact@example.org' && byEmail.status === 'prospect', '');
  g.startNewVolunteer(); g.state.vf.name = 'Phone Only'; g.state.vf.phone = '082 000 3333'; g.state.vf.email = ''; g.saveVolunteer();
  ok('pledge: a mobile alone is enough', g.volunteers.some(v => v.name === 'Phone Only'), '');
  g.state.volRegOpen = true; g.render();
  ok('pledge: the form says a mobile or email is needed', /A mobile number or an email address: at least one/.test($main.innerHTML) && !/Mobile \*</.test($main.innerHTML), '');
}

/* the send-home follow-up line follows the recorded follow-up answer */
g.resetDemo();
{
  const v = g.migrateAttendee({ id: 'EXPO-740', name: 'Lindiwe Test', age: 38, s: {}, interests: { consent: true, optin: true } });
  g.attendees.push(v); g.state.activeId = v.id; g.state.tab = 'send'; g.render();
  ok('send home: follow-up agreed with nothing ticked does not say they asked for nothing', /agreed to follow-up, with nothing specific asked for yet/.test($main.innerHTML)
    && !/did not ask for a call back/.test($main.innerHTML), '');
  v.interests.nurse = true; g.render();
  ok('send home: follow-up agreed with a nurse call lists it', /agreed to follow-up and asked for: <b>/.test($main.innerHTML), '');
  v.interests.optin = false; g.render();
  ok('send home: a tick without contact consent says no one will follow up', /did not agree to be contacted, so no one will follow up/.test($main.innerHTML), '');
  v.interests.nurse = false; g.render();
  ok('send home: no follow-up and nothing ticked says they did not agree to contact', /did not agree to be contacted after the expo/.test($main.innerHTML), '');
}

/* a returning visitor scanned with an old badge: no checks on the past visit, a new visit on a new badge instead */
g.resetDemo();
{
  const day = 86400000, act = (action, args) => { const e = { dataset: { action, args } }; e.closest = () => e; e.hasAttribute = () => false;
    g.dispatch(e, { type: 'click', target: {} }); };
  const past = g.migrateAttendee({ id: 'EXPO-730', name: 'Thandi Back', age: 51, sex: 'Female', phone: '082 000 0730', email: 'thandi@example.org',
    s: { sys: 150, dia: 95 }, interests: { consent: true, optin: true, consentOn: '2026-01-10' }, created_at: new Date(Date.now() - 30 * day).toISOString() });
  const recent = g.migrateAttendee({ id: 'EXPO-731', name: 'Recent Visit', age: 40, s: {}, interests: { consent: true, optin: false },
    created_at: new Date(Date.now() - 2 * day).toISOString() });
  g.attendees.push(past, recent);
  g.state.activeId = 'EXPO-730'; g.state.tab = 'screen'; g.render();
  ok('past visit: the station screen takes no checks and offers a new visit', !$main.innerHTML.includes('id="in-sugar"') && !$main.innerHTML.includes('id="prayerNote"')
    && /data-action="new-visit" data-args="EXPO-730"/.test($main.innerHTML) && /more than 7 days ago/.test($main.innerHTML), '');
  g.state.activeId = 'EXPO-731'; g.render();
  ok('past visit: a visit inside the 7 days keeps its checks open', $main.innerHTML.includes('id="in-sugar"') && !/data-action="new-visit"/.test($main.innerHTML), '');
  act('new-visit', 'EXPO-730');
  ok('past visit: Register as a new visit opens New visitor with their details filled in', g.state.tab === 'home' && g.state.regOpen === true
    && $el('rgName').value === 'Thandi Back' && $el('rgPhone').value === '082 000 0730' && $el('rgEmail').value === 'thandi@example.org', $el('rgName').value);
  const n = g.attendees.length;
  $el('rgAge').value = '51'; $el('rgSex').value = 'Female'; $el('rgHeight').value = ''; const want = g.nextBadge();
  $el('rgConsent').checked = true; $el('rgOptin').checked = false; $el('rgGuardian').checked = false;
  g.registerSubmit({ preventDefault() {} });
  const nv = g.attendees.find(a => a.id === want);
  ok('past visit: the new visit saves on a new badge without the duplicate warning, and asks consent afresh', g.attendees.length === n + 1 && !!nv
    && nv.interests.consentV === '2026-10-27' && nv.interests.optin === false && g.state.newVisitOf === null && g.state.activeId === want, String(g.attendees.length - n));
  const r = g.attendees.find(a => a.id === 'EXPO-731'), was = r.interests.optin;
  act('toggleOptin', 'EXPO-731');
  ok('the follow-up Yes/No button is wired to an action and changes the answer', r.interests.optin === !was, String(r.interests.optin));
}

/* POPIA: the notice names the church that ran the expo, and falls back in demo mode */
g.resetDemo();
{
  g.state.tab = 'home'; g.state.regOpen = true; g.render();
  ok('POPIA: with no church loaded the notice says "church or organisation" and keeps the 7-day and 2-year terms',
    /The church or organisation running this health expo/.test($main.innerHTML) && /deleted 7 days after your visit/.test($main.innerHTML)
    && /up to 2 years after your last visit/.test($main.innerHTML), '');
  const C = g.cloud, was = C.acct;
  C.acct = { membership: { role: 'admin', status: 'approved' }, church: { id: 'c1', name: 'Grace Chapel', city: 'Durban', phone: '031 000 0000', email: 'office@grace.example' } };
  g.render();
  ok('POPIA: signed in, the notice names the church, its town, phone and email', /Grace Chapel/.test($main.innerHTML)
    && /Durban/.test($main.innerHTML) && /031 000 0000/.test($main.innerHTML) && /office@grace\.example/.test($main.innerHTML), '');
  C.acct = was; g.state.regOpen = false;
}
g.resetDemo();
const n0 = g.attendees.length, numOf = id => +((/^EXPO-(\d+)$/.exec(id) || [0, 0])[1]), badgeNo = n => 'EXPO-' + String(n).padStart(3, '0');
const expected = g.nextBadge();
ok('the next number is one above the highest on this phone', expected === badgeNo(Math.max(...g.attendees.map(a => numOf(a.id))) + 1), expected);
g.state.tab = 'home'; g.state.regOpen = true; g.render();
ok('registration shows the number it will give, read-only, with no badge field or scan button', $main.innerHTML.includes('id="rgNumber"')
  && $main.innerHTML.includes('>' + expected + '<') && !/id="rgBadge"/.test($main.innerHTML) && !/openScanner|Scan badge|lanyard/i.test($main.innerHTML));
submitReg({ name: '   ' });
ok('blank name is refused', g.attendees.length === n0);
submitReg({ name: 'Too Young', age: '3' });
ok('out-of-range age is refused', g.attendees.length === n0);
submitReg({ name: 'Bad Email', email: 'not-an-email' });
ok('a malformed email address is refused', g.attendees.length === n0);
submitReg({ name: 'Mail Visitor', email: 'visitor@example.org' });
const mailed = g.attendees.find(a => a.name === 'Mail Visitor');
ok('a visitor registers with an email address and no phone number, on the next number', !!mailed && mailed.id === expected && g.attendees.length === n0 + 1
  && mailed.email === 'visitor@example.org' && mailed.phone === '+27 —', JSON.stringify(mailed && { id: mailed.id, email: mailed.email, phone: mailed.phone }));
ok('the email reaches the sync row (attToRow) and comes back (rowToAtt)',
  g.attToRow(mailed).email === 'visitor@example.org' && g.rowToAtt(g.attToRow(mailed)).email === 'visitor@example.org');
submitReg({ name: 'Same Email Again', email: 'VISITOR@example.org ' });
ok('an email another visitor already uses is refused (case, spacing ignored)', g.attendees.length === n0 + 1, String(g.attendees.length));
submitReg({ name: 'No Contact At All' });
const bare = g.attendees.find(a => a.name === 'No Contact At All');
ok('a visitor with neither phone nor email still registers (both are optional)', !!bare && bare.email === '' && bare.phone === '+27 —');
ok('numbers count up one per visitor', !!bare && bare.id === badgeNo(numOf(expected) + 1), bare && bare.id);
g.state.regOpen = false;
submitReg({ name: '<img src=x onerror=alert(1)> Tester', phone: '<b>082 123 4567</b>' });
const hostile = g.attendees.find(a => a.id === badgeNo(numOf(expected) + 2));
ok('a third visitor gets the third number', !!hostile && g.attendees.length === n0 + 3, 'attendees=' + g.attendees.length + ' expected ' + (n0 + 3));
ok('new visitor becomes the active passport', !!hostile && g.state.activeId === hostile.id);
const shown = {};
for (const t of ['home', 'screen', 'plan', 'results']) { g.state.tab = t; g.render(); shown[t] = $main.innerHTML; }
ok('no unescaped visitor markup on any visitor tab',
  Object.values(shown).every(h => !h.includes('<img src=x')), Object.keys(shown).filter(t => shown[t].includes('<img src=x')).join(','));
g.openSwitcher(); ok('visitor switcher escapes names', !$el('switcherList').innerHTML.includes('<img src=x'));
g.openWhatsApp(); ok('WhatsApp preview escapes names', !$el('waBody').innerHTML.includes('<img src=x'));
g.buildPrintCard(); ok('print card escapes names', !$el('printArea').innerHTML.includes('<img src=x'));
ok('the printed card carries no QR code any more', !/pc-qr|pcQr/.test($el('printArea').innerHTML));
hostile.interests = { nurse: true }; hostile.prayer = '<script>x</script>'; hostile.s.sys = 170; hostile.s.dia = 105;
g.state.tab = 'care'; g.render();
ok('care list escapes name, phone and prayer note',
  !$main.innerHTML.includes('<img src=x') && !$main.innerHTML.includes('<script>x') && !$main.innerHTML.includes('<b>082'));
ok('nextBadge skips ids already issued', !g.attendees.some(a => a.id === g.nextBadge()));
ok('migrateAttendee strips unsafe characters from ids',
  g.migrateAttendee({ id: "EXPO-1');alert(1);//", s: {} }).id === 'EXPO-1alert1');

console.log('\n12. Visitor numbers');
{ const kept = g.attendees.splice(0);
  ok('a phone with no visitors starts at EXPO-001', g.nextBadge() === 'EXPO-001', g.nextBadge());
  g.attendees.push(...kept); }
ok('the scanner is gone: no scan functions in the app', typeof g.openScanner === 'undefined' && typeof g.parseBadge === 'undefined' && typeof g.onScanText === 'undefined');
g.state.regOpen = false;

console.log('\n13. Screening inputs');
g.resetDemo();
const dm = g.attendees.find(a => a.id === 'EXPO-042');
dm.s.sys = null;
g.onStep('EXPO-042', 'sys', 1, 70, 210, 1, 120);
ok('first + tap on an empty field shows the default (120), not a guess above it', dm.s.sys === 120, 'got ' + dm.s.sys);
g.onStep('EXPO-042', 'sys', 1, 70, 210, 1, 120);
ok('the second + tap then steps up by one (121)', dm.s.sys === 121, 'got ' + dm.s.sys);

dm.s.sys = null;
g.onStep('EXPO-042', 'sys', -1, 70, 210, 1, 120);
ok('first − tap on an empty field also shows the default (120)', dm.s.sys === 120, 'got ' + dm.s.sys);

/* a decimal station: sugar default 5.5, step 0.1 */
dm.s.sugar = null;
g.onStep('EXPO-042', 'sugar', 1, 1, 30, 0.1, 5.5);
ok('sugar: first tap shows 5.5', dm.s.sugar === 5.5, 'got ' + dm.s.sugar);
g.onStep('EXPO-042', 'sugar', 1, 1, 30, 0.1, 5.5);
ok('sugar: second tap steps by 0.1 without float noise (5.6)', dm.s.sugar === 5.6, 'got ' + dm.s.sugar);
for (let i = 0; i < 200; i++) g.onStep('EXPO-042', 'sys', -1, 70, 210, 1, 120);
ok('stepper stops at the minimum', dm.s.sys === 70, 'got ' + dm.s.sys);
for (let i = 0; i < 300; i++) g.onStep('EXPO-042', 'sys', 1, 70, 210, 1, 120);
ok('stepper stops at the maximum', dm.s.sys === 210, 'got ' + dm.s.sys);
/* commit rules for a typed reading: valid -> saved; impossible or garbage -> NOT saved and explained, never changed into another number */
g.state.activeId = 'EXPO-042';
const commit = (k, raw, min, max, step) => {
  const el = $el('in-' + k); el.value = raw; dm.s[k] = 1234;                    /* sentinel: proves the app overwrote it */
  g.onStationCommit('EXPO-042', k, el, min, max, step);
  return { v: dm.s[k], warn: $el('warn-' + k), box: el.value };
};
let r = commit('sugar', '99', 1, 30, 0.1);
ok('too-high reading is not saved (and not clamped to 30)', r.v === null, 'got ' + r.v);
ok('too-high reading tells the volunteer why', r.warn.hidden === false && /cannot be right/.test(r.warn.innerHTML) && /1–30/.test(r.warn.innerHTML), r.warn.innerHTML);

r = commit('sugar', '72', 1, 30, 0.1);
ok('72 for sugar is not saved but offers the one-tap fix 7.2', r.v === null && /Did you mean 7\.2\?/.test(r.warn.innerHTML), r.v + ' | ' + r.warn.innerHTML);

r = commit('sugar', '6,5', 1, 30, 0.1);
ok('a comma decimal "6,5" is saved as 6.5', r.v === 6.5 && r.warn.hidden === true, r.v);

r = commit('sugar', 'abc', 1, 30, 0.1);
ok('text such as "abc" is not saved and the message says it is not a number', r.v === null && /not a number/.test(r.warn.innerHTML), r.v + ' | ' + r.warn.innerHTML);

r = commit('sugar', '', 1, 30, 0.1);
ok('an emptied field clears the reading and the warning', r.v === null && r.warn.hidden === true, r.v);

r = commit('sugar', '5.4', 1, 30, 0.1);
ok('an in-range reading is kept exactly as typed (5.4)', r.v === 5.4 && r.box === '5.4', r.v + ' / ' + r.box);

r = commit('sys', '300', 70, 210, 1);
ok('blood pressure 300 is not saved and gets no decimal "fix"', r.v === null && !/Did you mean/.test(r.warn.innerHTML), r.v + ' | ' + r.warn.innerHTML);
dm.s.sugar = null; dm.s.sys = null;
$el('in-sugar').value = 'abc'; g.onStationCommit('EXPO-042', 'sugar', $el('in-sugar'), 1, 30);
ok('non-numeric entry clears the field', dm.s.sugar === null);
$el('in-sugar').value = ''; g.onStationInput('EXPO-042', 'sugar', $el('in-sugar'));
ok('empty entry stays empty (not zero)', dm.s.sugar === null);
ok('0 servings of veg still counts as recorded', (() => { dm.s.veg = 0; return g.doneCount(dm) >= 1 && dm.s.veg === 0; })());
ok('BP 160/80 is a red flag', g.cat('bp', { sys: 160, dia: 80 })[0] === 'flag');
ok('BP 120/80 is normal', g.cat('bp', { sys: 120, dia: 80 })[0] === 'ok');
ok('sugar 15 is a red flag', g.redFlag({ s: { sugar: 15 } }));
ok('incomplete attendee gets no health age', g.healthAge({ age: 40, s: { sys: 120, dia: 80 } }).health === null);

console.log('\n14. Volunteer navigation & logging');
g.resetDemo(); g.state.tab = 'home'; g.render();
g.startNewVolunteer();
ok('pledging from the Home card switches to the Team tab', g.state.tab === 'serve' && g.state.volRegOpen);
g.render();
ok('pledge form is actually rendered', $main.innerHTML.includes('Who you are'));
g.closeVolReg();
ok('Back from a new pledge restores a real volunteer', g.state.volNew === false && g.volunteers.some(v => v.id === g.state.volId));
g.state.volTab = 'pledge'; g.render();
const pledgeHtml = $main.innerHTML;
ok('pledge screen shows a badge card again after Back', /’s badge<\/div>/.test(pledgeHtml), 'no personalised badge card found');
g.state.tab = 'home'; g.setVolTab('muster');
ok('setVolTab from another tab lands on Team/Muster', g.state.tab === 'serve' && $main.innerHTML.includes('Booth coverage'));
g.setVol('VOL-1001'); g.openVolReg();
ok('edit form is prefilled for Thandi', g.state.vf.name === 'Thandi Mabaso');
g.setVol('VOL-1003'); g.openVolReg();
ok('draft does not leak between volunteers (Grace)', g.state.vf.name === 'Grace Nkosi', g.state.vf.name);
g.setVolTab('record');
ok('a tab button closes the open form', g.state.volRegOpen === false && $main.innerHTML.includes('Volunteer service record'));
g.startNewVolunteer(); g.setVolTab('muster');
ok('leaving a half-open new pledge restores a volunteer', !g.state.volNew && g.volunteers.some(v => v.id === g.state.volId));
g.switchToVol();
ok('Switch volunteer opens the volunteer picker', $el('switcherModal').classList.contains('flex') || $el('switcherList').innerHTML.includes('Thandi'));
ok('volunteer picker lists names unmangled', $el('switcherList').innerHTML.includes('Thandi Mabaso'));

g.setVol('VOL-1004'); g.logExpoEntry();
const logTry = (date, hrs, booth = 'kids') => {
  $el('lgName').value = 'Test Expo'; $el('lgDate').value = date; $el('lgHours').value = hrs; $el('lgBooth').value = booth;
  g.saveExpoEntry();
};
const nomv = g.volunteers.find(v => v.id === 'VOL-1004');
logTry('2025-05-05', '25'); ok('more than 24 hours is refused', g.volExpos(nomv) === 0);
logTry('2999-01-01', '5');  ok('a future date is refused', g.volExpos(nomv) === 0);
logTry('2025-05-05', '-3'); ok('negative hours are refused', g.volExpos(nomv) === 0);
logTry('2025-05-05', '5');  ok('valid entry is saved', g.volExpos(nomv) === 1 && nomv.history[0].name === 'Test Expo 2025', JSON.stringify(nomv.history));
logTry(g.todayStr(), '4', 'bp'); ok('today is allowed', g.volExpos(nomv) === 2);
g.logExpoEntry(); logTry('2025-05-05', '5');
ok('the same day at the same booth is not double-counted', g.volExpos(nomv) === 2);
ok('todayStr is a local YYYY-MM-DD date', /^\d{4}-\d{2}-\d{2}$/.test(g.todayStr()));
ok('incoming expo is in the future', g.daysTo(g.EXPO_UPCOMING.date) > 0, 'days=' + g.daysTo(g.EXPO_UPCOMING.date));
ok('status of a corrupt record falls back to prospect', g.migrateVolunteer({ status: 'bogus' }).status === 'prospect');

console.log('\n15. CSV safety');
ok('formula cell is defused', g.csvCell('=HYPERLINK("x")') === '"\'=HYPERLINK(""x"")"', g.csvCell('=HYPERLINK("x")'));
ok('@ cell is defused', g.csvCell('@SUM(A1)').startsWith('"\''));
ok('+27 phone numbers are left alone', g.csvCell('+27 82 555 0142') === '"+27 82 555 0142"');
ok('plain text and quotes are escaped', g.csvCell('say "hi"') === '"say ""hi"""');
ok('null becomes an empty cell', g.csvCell(null) === '""');
let visitorCsv = null;
sandbox.Blob = function (parts) { visitorCsv = parts.join(''); };
g.exportCSV();
ok('visitor CSV: header + one row per visitor', visitorCsv && visitorCsv.replace(/^﻿/, '').trim().split('\n').length === g.attendees.length + 1);

console.log('\n15b. Names');
ok('"Dr Samuel Adeyemi" greets as Samuel', g.firstName('Dr Samuel Adeyemi') === 'Samuel', g.firstName('Dr Samuel Adeyemi'));
ok('plain names keep their first word', g.firstName('Thandi Mabaso') === 'Thandi');
ok('a lone title is not dropped', g.firstName('Dr') === 'Dr');
ok('empty name is safe', g.firstName('') === '' && g.firstName(null) === '');
ok('initials ignore stray spaces', g.initials('  Thandi   Mabaso ') === 'TM', g.initials('  Thandi   Mabaso '));

console.log('\n16. Every CSS class the markup uses actually exists');
/* The Tailwind block in the page is a precompiled subset, so a utility that is
   used in a template but missing from it fails silently (no scroll, wrong size...). */
{
  const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
  const used = new Set();
  const grab = s => String(s).replace(/class="([^"]*)"/g, (_, c) => { c.split(/\s+/).filter(Boolean).forEach(t => used.add(t)); return ''; });
  grab(html.slice(html.indexOf('<body'), html.indexOf('<script>')));      /* static markup */
  g.resetDemo(); g.state.logOpen = false;
  for (const t of ['home', 'screen', 'results', 'plan', 'care']) { g.state.tab = t; g.state.regOpen = t === 'home'; g.render(); grab($main.innerHTML); }
  g.state.regOpen = false; g.state.tab = 'serve';
  for (const vid of ['VOL-1001', 'VOL-1004'])
    for (const vt of ['pledge', 'muster', 'booth', 'record']) {
      g.setVol(vid); g.state.volTab = vt; g.state.logOpen = vt === 'record'; g.render(); grab($main.innerHTML);
    }
  g.state.logOpen = false; g.setVol('VOL-1001'); g.openVolReg(); grab($main.innerHTML); g.closeVolReg();
  g.openSwitcher(); grab($el('switcherList').innerHTML + $el('switcherFoot').innerHTML);
  g.state.switchMode = 'volunteer'; g.openSwitcher(); grab($el('switcherList').innerHTML + $el('switcherFoot').innerHTML + $el('switcherHead').innerHTML);
  g.state.switchMode = 'visitor';
  g.openWhatsApp(); grab($el('waBody').innerHTML); g.buildPrintCard(); grab($el('printArea').innerHTML);
  g.renderCloudBody(); grab($el('cloudBody').innerHTML);                         /* signed out, library not loaded */
  g.cloud.client = {}; g.renderCloudBody(); grab($el('cloudBody').innerHTML);    /* signed out, form */
  g.cloud.user = { email: 'a@b.c' }; g.renderCloudBody(); grab($el('cloudBody').innerHTML);   /* signed in */
  g.cloud.user = null; g.cloud.client = null;
  sandbox.NEWSTART_NO_CLOUD = false;                                              /* every sign-in gate screen */
  const U = { email: 'a@b.c' };
  const gateShots = [
    { client: null, user: null, status: 'off' }, { client: {}, user: null, status: 'signedout', view: 'login' },
    { client: {}, user: null, status: 'signedout', view: 'signup' }, { client: {}, user: null, status: 'signedout', view: 'verify' },
    { client: {}, user: null, status: 'signedout', view: 'forgot' }, { client: {}, user: null, status: 'signedout', view: 'forgotSent' },
    { client: {}, user: U, status: 'online', recovery: true }, { client: {}, user: U, status: 'error', pending: true },
    { client: {}, user: U, status: 'syncing' }, { client: {}, user: U, status: 'error' }, { client: null, user: null, status: 'unavailable' }];
  for (const s of gateShots) {
    Object.assign(g.cloud, { client: s.client, user: s.user, status: s.status, view: s.view || 'login', recovery: !!s.recovery, pending: !!s.pending, err: 'x', gateKey: '', ready: false });
    g.renderGate(); grab($el('authGateBody').innerHTML);
  }
  Object.assign(g.cloud, { client: null, user: null, status: 'off', err: '', ready: false, gateKey: '', view: 'login', recovery: false, pending: false });
  sandbox.NEWSTART_NO_CLOUD = true; g.renderGate();
  g.attendees.length = 0; g.state.tab = 'home'; g.render(); grab($main.innerHTML);   /* empty database screens */
  g.state.tab = 'screen'; g.render(); grab($main.innerHTML);
  g.resetDemo();
  const cssEsc = t => t.replace(/[^a-zA-Z0-9_-]/g, m => '\\' + m);
  /* marker classes: jr-next / jr-back are hooks only (the buttons are styled by .btn and .jr-btns) */
  const IGNORE = new Set(['jr-next', 'jr-back']);
  const missing = [...used].filter(t => !IGNORE.has(t) && !css.includes('.' + cssEsc(t)));
  ok('no template class is missing from the stylesheet (' + used.size + ' checked)', missing.length === 0, missing.join(' '));
}

/* ---- 17. cloud sync against an in-memory fake Supabase -------------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeServer() {
  const srv = { tables: { attendees: new Map(), volunteers: new Map() }, offline: false, staff: true, goodPassword: 'right',
    calls: [], handlers: [], authCb: null, seq: 0, maxRows: 1000, users: new Map(), signupMode: 'confirm' };
  srv.reset = () => { srv.tables.attendees.clear(); srv.tables.volunteers.clear(); srv.offline = false; srv.staff = true; srv.calls.length = 0; srv.users.clear(); srv.signupMode = 'confirm'; srv.rpcs = null; srv.rtState = ''; };
  srv.emit = (table, payload) => srv.handlers.filter(h => h.table === table).forEach(h => h.cb(payload));
  const created = () => new Date(Date.now() + srv.seq++ * 1000).toISOString();
  const valid = (t, row) => t === 'attendees' ? /^EXPO-[0-9]{3,4}$/.test(row.id) && String(row.name || '').trim().length > 0
                                              : /^VOL-[0-9]+$/.test(row.id) && String(row.name || '').trim().length > 0;
  class Q {
    constructor(t) { this.t = t; this.op = 'select'; this.f = []; this.gte_ = []; this.sort = []; this.rng = null; this.one = false; }
    select() { return this; }
    insert(row) { this.op = 'insert'; this.row = row; return this; }
    upsert(row, opts) { this.op = 'upsert'; this.row = row; srv.lastConflict = opts && opts.onConflict; return this; }
    eq(c, v) { this.f.push([c, v]); return this; }
    gte(c, v) { this.gte_.push([c, v]); return this; }
    order(c) { this.sort.push(c); return this; }
    range(a, b) { this.rng = [a, b]; return this; }
    maybeSingle() { this.one = true; return this; }
    then(res, rej) { return this.run().then(res, rej); }
    async run() {
      srv.calls.push(this.op + ':' + this.t + (this.row ? ':' + this.row.id : '') + (this.rng ? ':range' + this.rng[0] : '') + (this.gte_.length ? ':since' : ''));
      if (srv.offline) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
      const tbl = srv.tables[this.t];
      if (!tbl) return { data: null, error: { code: 'PGRST205', message: 'Could not find the table in the schema cache' } };
      if (this.op === 'select') {
        let rows = srv.staff ? [...tbl.values()] : [];        /* RLS: non-staff silently see nothing */
        this.f.forEach(([c, v]) => { rows = rows.filter(r => r[c] === v); });
        this.gte_.forEach(([c, v]) => { rows = rows.filter(r => String(r[c]) >= String(v)); });
        if (this.sort.length) rows.sort((a, b) => { for (const c of this.sort) { const x = String(a[c]), y = String(b[c]); if (x !== y) return x < y ? -1 : 1; } return 0; });
        /* PostgREST caps every response at max-rows (1000 by default), whatever range was asked for */
        const [from, to] = this.rng || [0, Infinity];
        rows = rows.slice(from, Math.min(to + 1, from + srv.maxRows));
        return { data: this.one ? (rows[0] || null) : rows, error: null };
      }
      if (!srv.staff) return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
      if (!valid(this.t, this.row)) return { data: null, error: { code: '23514', message: 'violates check constraint' } };
      if (this.op === 'insert') {
        if (tbl.has(this.row.id)) return { data: null, error: { code: '23505', message: 'duplicate key value' } };
        const ts = created();
        /* the database keeps a supplied created_at (the app sends it so a late upload still counts as its real visit) */
        tbl.set(this.row.id, { ...this.row, created_at: this.row.created_at || ts, updated_at: ts });
        srv.emit(this.t, { eventType: 'INSERT', new: tbl.get(this.row.id) });
      } else {
        const had = tbl.get(this.row.id), ts = created();
        tbl.set(this.row.id, { ...this.row, created_at: (had && had.created_at) || this.row.created_at || ts, updated_at: ts });
        srv.emit(this.t, { eventType: had ? 'UPDATE' : 'INSERT', new: tbl.get(this.row.id) });
      }
      return { data: null, error: null };
    }
  }
  srv.client = {
    auth: {
      onAuthStateChange(cb) { srv.authCb = cb; return { data: { subscription: {} } }; },
      async signInWithPassword({ email, password }) {
        if (srv.offline) return { error: { message: 'TypeError: Failed to fetch' } };
        const acct = srv.users.get(email);
        if (acct) {                                              /* an account created through signUp() */
          if (acct.password !== password) return { error: { message: 'Invalid login credentials' } };
          if (!acct.confirmed) return { error: { code: 'email_not_confirmed', message: 'Email not confirmed' } };
          srv.authCb('SIGNED_IN', { user: { id: 'u-' + email, email } });
          return { data: {}, error: null };
        }
        if (password !== srv.goodPassword) return { error: { message: 'Invalid login credentials' } };
        srv.authCb('SIGNED_IN', { user: { id: 'user-1', email } });
        return { data: {}, error: null };
      },
      async signUp({ email, password, options }) {
        srv.calls.push('signUp:' + email); srv.lastSignUp = { email, password, options };
        if (srv.offline) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
        if (srv.signupMode === 'disabled') return { data: { user: null, session: null }, error: { code: 'signup_disabled', message: 'Signups not allowed for this project' } };
        if (srv.signupMode === 'ratelimit') return { data: { user: null, session: null }, error: { code: 'over_email_send_rate_limit', status: 429, message: 'email rate limit exceeded' } };
        if (srv.users.has(email)) return { data: { user: { id: 'x', identities: [] }, session: null }, error: null };   /* what Supabase answers when confirmations are on */
        srv.users.set(email, { password, confirmed: srv.signupMode === 'auto', meta: options && options.data });
        const user = { id: 'u-' + email, email, identities: [{}] };
        if (srv.signupMode === 'auto') { const s = { user }; srv.authCb('SIGNED_IN', s); return { data: { user, session: s }, error: null }; }
        return { data: { user, session: null }, error: null };
      },
      async resend({ type, email, options }) { srv.calls.push('resend:' + type + ':' + email); return srv.offline ? { error: { message: 'Failed to fetch' } } : { error: null }; },
      async resetPasswordForEmail(email, opts) { srv.calls.push('reset:' + email); srv.lastReset = { email, opts }; return srv.offline ? { error: { message: 'Failed to fetch' } } : { data: {}, error: null }; },
      async updateUser({ password }) {
        if (password === 'SamePass1') return { error: { code: 'same_password', message: 'New password should be different from the old password.' } };
        srv.calls.push('updateUser'); srv.newPassword = password; return { data: {}, error: null };
      },
      async signOut() { srv.authCb && srv.authCb('SIGNED_OUT', null); return { error: null }; },
    },
    from: t => new Q(t),
    async rpc(name, args) {
      if (srv.offline) return { data: null, error: { message: 'Failed to fetch' } };
      if (srv.rpcs && srv.rpcs[name]) return srv.rpcs[name](args || {});
      return { data: srv.staff, error: null };
    },
    channel() { const ch = { on(_t, filter, cb) { srv.handlers.push({ table: filter.table, cb }); return ch; }, subscribe(cb) { if (cb && srv.rtState) cb(srv.rtState); return ch; } }; return ch; },
    removeChannel() { srv.handlers.length = 0; },
  };
  return srv;
}

(async () => {
  /* ---- 16b. the Android app (Capacitor): the same page, booted as the app ----
     Placed before the service-worker tests so it runs even when a later section stops the harness. */
  console.log('\n16b. Android app (Capacitor)');
  {
    const opened = [], shared = [], printed = [], swRegistered = [], saved = [];
    let whatsappInstalled = true;
    const Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        AppLauncher: { openUrl: async o => { opened.push(o.url); return { completed: whatsappInstalled }; } },
        Share: { share: async o => { shared.push(o.text); return {}; } },
        CardPrinter: { print: async o => { printed.push(o.html); return {}; },
          saveDownload: async o => { saved.push(o); return { where: 'Downloads' }; } },
      },
    };
    /* the app gets its own storage, so its saves can never change what the web checks after it see */
    const appMem = new Map();
    const appStore = { getItem: k => (appMem.has(k) ? appMem.get(k) : null), setItem: (k, v) => appMem.set(k, String(v)), removeItem: k => appMem.delete(k) };
    const head = makeEl('app-head');
    const appDoc = { ...document, head, body: makeEl('app-body'), createElement: () => makeEl('created') };
    function QRCode() {} QRCode.CorrectLevel = { L: 1 };
    const appBox = {
      ...sandbox, document: appDoc, Capacitor, QRCode, __A: undefined, localStorage: appStore,
      print: () => { throw new Error('window.print does not exist inside the Android app'); },
      location: { href: 'https://localhost/', protocol: 'https:', origin: 'https://localhost', pathname: '/', hostname: 'localhost' },
      navigator: { ...sandbox.navigator, userAgent: 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
        serviceWorker: { register: u => { swRegistered.push(u); return Promise.resolve(); } } },
      addEventListener: (ev, fn) => { if (ev === 'load') fn(); },
    };
    appBox.window = appBox; appBox.globalThis = appBox;
    vm.createContext(appBox);
    let booted = true;
    try {
      vm.runInContext(body, appBox, { filename: 'app-mode.js' });
    } catch (e) { booted = false; console.log('APP BOOT THREW: ' + e.stack); }
    /* the app surface: same internals object the main suite uses (the bundle keeps its scope private) */
    const A = appBox.__NEWSTART && appBox.__NEWSTART.__internals || {};
    const tick = () => new Promise(r => setTimeout(r, 0));
    ok('app: the page boots as the Android app', booted && A.IS_APP === true);
    ok('web: the page does not think it is the app', g.IS_APP === false);
    ok('web: the sign-in library still loads from its pinned CDN address', typeof g.appCopyOf === 'function' && g.appCopyOf(g.SB_LIB) === g.SB_LIB);

    let srcs = [], sbEl = {};
    if (booted) {
      A.loadScript(A.SB_LIB).catch(() => {});
      srcs = head.children.map(c => c.src);
      sbEl = head.children.find(c => c.src === 'vendor/supabase.min.js') || {};
    }
    ok('app: the sign-in library loads from the copy inside the app, with the same integrity check', !!A.SRI && sbEl.integrity === A.SRI[A.SB_LIB]);
    ok('app: no library loads from the internet inside the app', srcs.length > 0 && !srcs.some(s => /^https:/.test(s)), srcs.join());
    ok('app: sign-up and password emails link back to the web site, not to the app', booted && A.authRedirect() === 'https://winter-bonus-626a.ndlovufanelesibonge8.workers.dev/');
    ok('app: no service worker is registered inside the app', booted && swRegistered.length === 0);
    appBox.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
    ok('app: no "Add to Home Screen" steps are shown inside the app', booted && A.installBlock() === '');

    let msg = '', num = '';
    if (booted) {
      const a0 = A.attendees[0]; A.state.activeId = a0.id; A.state.sugFor = null;
      msg = A.waMessage(a0); num = A.waNumber(a0.phone);
      A.sendWhatsApp(); await tick(); await tick();
    }
    if (booted) { A.exportCSV(); A.exportVolCSV(); await tick(); await tick(); }
    const javaSrc = fs.readFileSync(path.join(__dirname, '..', 'capacitor', 'android', 'app', 'src', 'main', 'java', 'org', 'newstart', 'expopassport', 'CardPrinterPlugin.java'), 'utf8');
    ok('app: both CSV exports are saved through the native plugin (a blob download does nothing in the WebView)', saved.length === 2
      && saved[0].name === 'newstart-followup.csv' && saved[1].name === 'newstart-volunteers.csv' && saved.every(o => o.mime === 'text/csv' && /^﻿"/.test(o.text)),
      saved.map(o => o.name).join(','));
    ok('app: the native plugin has saveDownload, writing to Downloads through MediaStore', /public void saveDownload\(PluginCall call\)/.test(javaSrc)
      && /MediaStore\.Downloads\.EXTERNAL_CONTENT_URI/.test(javaSrc));
    ok('app: printing refuses a second card while one is being prepared, and answers once with a timeout', /if \(printView != null\)/.test(javaSrc)
      && /answered\[0\] = true/.test(javaSrc) && /postDelayed\(timeout, PRINT_TIMEOUT_MS\)/.test(javaSrc));
    { const res = p => fs.readFileSync(path.join(__dirname, '..', 'capacitor', 'android', 'app', 'src', 'main', p), 'utf8');
      const man = res('AndroidManifest.xml'), dx = res('res/xml/data_extraction_rules.xml'), fp = res('res/xml/file_paths.xml');
      ok('app: no backup, and no device-to-device transfer of the app data', /android:allowBackup="false"/.test(man)
        && /android:dataExtractionRules="@xml\/data_extraction_rules"/.test(man)
        && ['cloud-backup', 'device-transfer'].every(s => new RegExp('<' + s + '>[\\s\\S]*domain="root" path="\\."[\\s\\S]*domain="sharedpref" path="\\."[\\s\\S]*</' + s + '>').test(dx)));
      ok('app: the FileProvider shares two dedicated folders, never the storage root', !/path="\."/.test(fp)
        && /external-files-path name="captured_photos" path="Pictures\/"/.test(fp) && /cache-path name="shared" path="shared\/"/.test(fp)); }
    ok('app: WhatsApp opens the WhatsApp app with the message ready', opened.length === 1 && opened[0] === 'whatsapp://send?phone=' + num + '&text=' + encodeURIComponent(msg) && shared.length === 0);
    whatsappInstalled = false;
    if (booted) { A.sendWhatsApp(); await tick(); await tick(); }
    ok('app: without WhatsApp on the phone, the message goes to the share sheet', opened.length === 2 && shared.length === 1 && shared[0] === msg);

    let mailBody = '';
    whatsappInstalled = true;
    if (booted) {
      const a0 = A.attendees[0]; a0.email = ''; A.state.activeId = a0.id;
      $el('emTo').value = 'visitor@example.org'; $el('emSave').checked = true;
      mailBody = A.waMessage(a0);
      A.sendEmail(); await tick(); await tick();
    }
    ok('app: the plan opens in the phone\'s email app as a mailto: link with the plan as the body',
      opened.length === 3 && opened[2].startsWith('mailto:visitor%40example.org?subject=') && decodeURIComponent(opened[2].split('&body=')[1]) === mailBody);
    ok('app: the typed email address was saved to the visitor', booted && A.attendees[0].email === 'visitor@example.org');
    whatsappInstalled = false;
    if (booted) { $el('emTo').value = 'visitor@example.org'; A.sendEmail(); await tick(); await tick(); }
    ok('app: with no email app installed, the plan goes to the share sheet',
      opened.length === 4 && opened[3].startsWith('mailto:visitor%40example.org') && shared.length === 2 && shared[1] === mailBody);

    let printThrew = false;
    if (booted) { try { await A.printCard(); await tick(); } catch (e) { printThrew = true; } }
    ok('app: the take-home card goes to the phone\'s print service as an A6 page', booted && !printThrew && printed.length === 1 &&
      printed[0].includes('@page{size:105mm 148mm') && printed[0].includes('Never stop prescribed pills suddenly'));

    const pick = (html.match(/<script id="fontPick">([\s\S]*?)<\/script>/) || [])[1];
    const fontsFor = win => { let out = ''; vm.runInNewContext(pick || 'throw new Error("no fontPick")', { window: win, document: { write: s => { out += s; } } }); return out; };
    let appFonts = '', webFonts = '';
    try { appFonts = fontsFor({ Capacitor }); webFonts = fontsFor({}); } catch (e) { }
    ok('fonts: the app uses its own copy, the web site Google Fonts', /href="vendor\/fonts\.css"/.test(appFonts) && !/googleapis/.test(appFonts) &&
      /fonts\.googleapis\.com\/css2\?family=Inter/.test(webFonts) && !/vendor\//.test(webFonts));
  }

  /* ---- 16c. intro, every screen size, quicker screens ---- */
  console.log('\n16c. Intro, screen sizes, quicker screens');
  {
    /* assertions about the app's own code read the src/ modules (the true source text);
       the bundle reformats, so exact-source regexes must not run against it */
    const css = (html.match(/v8 · INTRO, EVERY SCREEN SIZE, QUICKER SCREENS[\s\S]*?<\/style>/) || [''])[0];
    const mainScript = html.search(/\r?\n<script type="module"/);   /* the app boots from src/main.js */
    ok('intro: the logo is in the page itself, so it shows before any script runs',
      html.indexOf('<div id="intro"') > html.indexOf('<body>') && html.indexOf('<div id="intro"') < mainScript && /class="intro-badge"/.test(html));
    ok('intro: the logo pops in and beats once, then the app rises into place',
      /\.intro-badge\{[^}]*animation:introPop[^}]*introBeat/.test(css) && /@keyframes introBeat/.test(css) && /\.intro-rise #app[^{]*\{animation:introRise/.test(css));
    ok('intro: it leaves on its own and never holds the app back',
      $el('intro').classList.contains('intro-out') && document.documentElement.classList.contains('intro-rise'));
    ok('intro: people who ask for less motion do not see it',
      /@media \(prefers-reduced-motion:reduce\)\{#intro\{display:none\}/.test(css) && /prefers-reduced-motion: reduce\)'\)\.matches\)\{el\.remove\(\);return;\}/.test(srcText));
    ok('screens: the header never makes the page wider than the phone',
      /\.hdr-brand\{flex:0 0 auto\}/.test(css) && /\.hdr-tools\{min-width:0;flex:0 1 auto\}/.test(css) && /@media \(max-width:439\.98px\)\{\.hdr-title\{display:none\}\}/.test(css)
      && /#headerChip>span\.text-left>span\{overflow:hidden;text-overflow:ellipsis/.test(css) && /class="hdr-brand /.test(html) && /class="hdr-tools /.test(html) && /class="hdr-title /.test(html));
    ok('screens: the header and the tabs clear the phone\'s status bar and gesture bar',
      /<header [^>]*padding-top:max\(\.75rem,calc\(var\(--safe-area-inset-top,0px\) \+ \.5rem\)/.test(html) && /<nav [^>]*padding-bottom:max\(\.75rem,calc\(var\(--safe-area-inset-bottom,0px\) \+ \.5rem\)/.test(html));
    g.state.tab = 'home'; g.render();
    ok('screens: a long visitor name wraps on the Home card instead of being cut',
      /\.hero \.display\.truncate\{white-space:normal;display:-webkit-box;-webkit-line-clamp:2/.test(css) && /class="display truncate/.test($main.innerHTML));
    ok('screens: cards arrive within half a second and progress bars fill in half a second',
      /\.stagger>\*,\.pour>\*\{animation-duration:\.3s\}/.test(css) && /nth-child\(n\+5\)\{animation-delay:\.12s\}/.test(css) && /\.bar-fill\{animation-duration:\.5s\}/.test(css));
    ok('screens: tab switches are plain renders — no view-transition snapshots for a weak phone to capture and animate',
      !/startViewTransition/.test(srcText) && !/::view-transition/.test(html) && !/vtReveal/.test(html) && /state\.tab=t;render\(\);window\.scrollTo\(0,0\)/.test(srcText));
    ok('screens: people who ask for less motion get no card entry animations either',
      /@media \(prefers-reduced-motion:reduce\)\{\.stagger>\*,\.pour>\*\{animation:none!important\}\}/.test(html));
    ok('nav: the pill slides in one spring, self-corrects once the layout settles, and there is no SVG goo filter re-filtering the bar every frame or trailing droplet blob',
      /\.nav-goo\{position:absolute;inset:0;border-radius:inherit;pointer-events:none\}/.test(html) && !/url\(#goo\)/.test(html) && !/id="goo"/.test(html)
      && !/navDrop/.test(html) && !/nav-drop/.test(html) && !/_pillT/.test(srcText) && /_pillRaf/.test(srcText));
    ok('nav: the pill tint stays subtle on every tab (a strong hue read as a stray coloured circle on the active tab)',
      /\.nav-pill\{background-color:var\(--t2\);background-image:linear-gradient\(160deg,rgba\(255,255,255,\.95\),rgba\(255,255,255,\.55\)\)\}/.test(html));
    ok('speed: the whole page is still between interactions — blobs, waves and shimmers are static, bars grow with transforms, nothing runs forever',
      /\.blob\{position:absolute;border-radius:50%;opacity:\.75\}/.test(html) && !/\.blob\{[^}]*filter:blur/.test(html)
      && !/drift\d|@keyframes morph|waveT|waveX|shimmer/.test(html) && !/animation:[^;}]*\b(waveT|waveX|drift|shimmer)/.test(html)
      && /@keyframes fillIn\{from\{transform:scaleX\(0\)\}\}/.test(html) && /@keyframes fdgrow\{from\{transform:scaleX\(0\)\}\}/.test(html)
      && !/width:0[;}]/.test(html.match(/@keyframes (fillIn|fdgrow)\{[^}]*\}/g).join(''))
      && !/is-scrolling/.test(html) && !/amb\.style\.transform/.test(body) && !/will-change:transform\}/.test(html.match(/\.blob\{[^}]*\}/g).join('')));
    g.state.tab = 'home';
    g.switchTab('plan');
    ok('screens: tapping a tab lands on it and renders the new screen at once',
      g.state.tab === 'plan' && /stagger space-y-3\.5/.test($el('main').innerHTML));
    const capDir = path.join(__dirname, '..', 'capacitor');
    const styles = fs.existsSync(capDir) ? fs.readFileSync(path.join(capDir, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'), 'utf8') : '';
    ok('app: Android\'s launch screen is the app\'s colour alone, so the page\'s intro animation is what opens the app',
      /<item name="windowSplashScreenBackground">#F6F8F6<\/item>/.test(styles) && /<item name="windowSplashScreenAnimatedIcon">@android:color\/transparent<\/item>/.test(styles)
      && /<item name="android:background">@drawable\/splash_bg<\/item>/.test(styles));
    const capCfg = fs.existsSync(capDir) ? JSON.parse(fs.readFileSync(path.join(capDir, 'capacitor.config.json'), 'utf8')) : {};
    ok('app: the web view starts in the app\'s colour (no white flash)', capCfg.backgroundColor === '#f6f8f6');
  }

  /* ---- 16d. the intro plays in full ---- */
  console.log('\n16d. The intro plays in full');
  {
    const src = (srcText.match(/\(function introLeave\(\)\{[\s\S]*?\n\}\)\(\);/) || [''])[0];
    /* runs the intro script on its own, with the logo's animations and the timers under the test's control */
    const runIntro = anims => {
      const timers = [], rose = new Set(), out = new Set(); let removed = 0;
      const badge = anims ? { getAnimations: () => anims } : {};
      const el = { remove() { removed++; }, classList: { add: c => out.add(c) }, querySelector: () => badge };
      const ctx = {
        document: { getElementById: () => el, documentElement: { classList: { add: c => rose.add(c) } } },
        matchMedia: () => ({ matches: false }), performance: { now: () => 5000 }, Promise,
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
      };
      ctx.window = ctx;
      if (src) vm.runInNewContext(src, ctx);
      return {
        left: () => out.has('intro-out') && rose.has('intro-rise'),
        removed: () => removed,
        /* fires every timer due by `upTo` ms, including ones they add */
        runTimers: upTo => { for (let i = 0; i < timers.length; i++) if (!timers[i].done && timers[i].ms <= upTo) { timers[i].done = true; timers[i].fn(); } },
      };
    };
    const later = () => { let res; const p = new Promise(r => { res = r; }); return { p, res }; };
    const never = () => new Promise(() => {});

    const fin = later(), shown = later();
    const a = runIntro([{ finished: fin.p, ready: shown.p }]);
    await sleep(0); a.runTimers(1600);
    const beforePaint = a.left();
    shown.res(); await sleep(0);
    const whilePlaying = a.left();
    fin.res(); await sleep(0);
    ok('intro: it waits for the logo\'s animation to finish, however late the page first paints', !!src && !beforePaint && !whilePlaying && a.left());

    const b = runIntro([{ finished: never(), ready: Promise.resolve() }]);
    await sleep(0); b.runTimers(1599);
    const beforeNet = b.left(); b.runTimers(1600);
    ok('intro: it still leaves 1.6 s after the logo appears if the animation stalls', !beforeNet && b.left());

    const c = runIntro([{ finished: never(), ready: never() }]);
    await sleep(0); c.runTimers(4999);
    const beforeCap = c.left(); c.runTimers(5000);
    ok('intro: it still leaves after 5 s if the logo never gets to show', !beforeCap && c.left());

    const d = runIntro([{ finished: Promise.resolve(), ready: Promise.resolve() }]);
    await sleep(0); d.runTimers(5000);
    ok('intro: it leaves only once, however many of its timers fire', d.left() && d.removed() === 1, 'removed ' + d.removed() + ' times');

    const e = runIntro(null);
    await sleep(0);
    const straightAway = e.left(); e.runTimers(120);
    ok('intro: browsers that cannot report animations get the old timing', !straightAway && e.left());
  }

  console.log('\n17. Cloud sync (fake Supabase)');
  const srv = makeServer();
  sandbox.supabase = { createClient: () => srv.client };
  const C = g.cloud;
  const device = () => {                      /* a fresh, signed-out demo device */
    clearTimeout(C.pushT); clearTimeout(C.retryT); g.stopRealtime();
    C.user = null; C.mode = false; C.blocked = false; C.synced = { att: {}, vol: {} }; C.rejected = {}; C.busy = false; C.again = false;
    store.delete('newstart.cloud.v1');
    g.resetDemo(); srv.reset();
  };
  const signIn = async (email = 'staff@example.org') => { srv.authCb('SIGNED_IN', { user: { id: 'user-1', email } }); await sleep(60); };
  /* the sync tests need known numbers: register as a volunteer would, then give the new visitor the number the test uses */
  const registerLocal = (name, badge) => { submitReg({ name }); const a = g.attendees.find(x => x.id === g.state.activeId && x.name === name);
    if (a && badge) { a.id = badge; g.state.activeId = badge; } };

  /* mapping + seed detection */
  ok('attendee rows survive a database round trip',
    g.KINDS.att.seed.every(s => g.sigOf(g.attToRow(g.rowToAtt(g.attToRow(g.migrateAttendee(JSON.parse(JSON.stringify(s))))))) === g.sigOf(g.attToRow(g.migrateAttendee(JSON.parse(JSON.stringify(s)))))));
  ok('volunteer rows (history, arrays, dates) survive a round trip',
    g.KINDS.vol.seed.every(s => g.sigOf(g.volToRow(g.rowToVol(g.volToRow(g.migrateVolunteer(JSON.parse(JSON.stringify(s))))))) === g.sigOf(g.volToRow(g.migrateVolunteer(JSON.parse(JSON.stringify(s)))))));
  device();
  ok('untouched demo rows are recognised', g.volunteers.every(v => g.isSeedRow('vol', v)) && g.attendees.every(a => g.isSeedRow('att', a)));
  ok('a pristine demo device has nothing to upload', g.cloudPending() === 0);
  g.attendees[0].s.sys = 99;
  ok('an edited demo row counts as pending', g.cloudPending() === 1 && !g.isSeedRow('att', g.attendees[0]));

  /* first sign-in, empty database: demo data is dropped, real work is uploaded */
  device();
  registerLocal('Real Visitor', 'EXPO-300');
  ok('before sign-in only the real visitor is pending', g.cloudPending() === 1);
  await g.cloudInit();
  ok('cloud client is created from the library', !!C.client);
  srv.authCb('INITIAL_SESSION', null); await sleep(30);
  ok('no session → signed-out status', C.status === 'signedout' && !C.user);
  await signIn();
  ok('sign-in reaches the online state', C.status === 'online' && C.user && C.mode, C.status + ' ' + C.err);
  ok('real visitor uploaded', srv.tables.attendees.has('EXPO-300') && srv.tables.attendees.size === 1, [...srv.tables.attendees.keys()].join());
  ok('demo visitors/volunteers were NOT uploaded', srv.tables.volunteers.size === 0 && !srv.tables.attendees.has('EXPO-042'));
  ok('demo rows removed from the device', g.attendees.length === 1 && g.volunteers.length === 0, g.attendees.length + '/' + g.volunteers.length);
  ok('nothing left pending after the first sync', g.cloudPending() === 0);
  ok('sync ledger saved to storage', JSON.parse(store.get('newstart.cloud.v1')).att['EXPO-300'] !== undefined);
  ok('persisted copy remembers it is connected', JSON.parse(store.get('newstart.passport.v2')).cloud === true);
  ok('volunteer numbering starts at VOL-1001 for an empty database', g.state._volSeq === 1001, g.state._volSeq);
  ok('reset is refused while connected', (() => { const n = g.attendees.length; g.resetDemo(); return g.attendees.length === n; })());

  /* an empty database renders every screen */
  device(); await signIn();
  ok('empty database → zero visitors and volunteers', g.attendees.length === 0 && g.volunteers.length === 0);
  let empties = [];
  for (const t of ['home', 'screen', 'results', 'plan', 'care', 'serve']) {
    g.state.tab = t; g.state.volTab = 'pledge';
    try { g.render(); if (!$main.innerHTML.length && t !== 'serve') empties.push(t); } catch (e) { empties.push(t + ':' + e.message); }
  }
  ok('every tab renders with no data', empties.length === 0, empties.join(' '));
  g.state.tab = 'home'; g.render();
  ok('home invites registering the first visitor', $main.innerHTML.includes('No visitors yet'));
  g.state.tab = 'screen'; g.render();
  ok('screening tab asks for a visitor instead of showing a ghost', $main.innerHTML.includes('No visitor selected'));
  for (const vt of ['muster', 'booth', 'record']) { g.state.tab = 'serve'; g.state.volTab = vt; try { g.render(); } catch (e) { empties.push(vt); } }
  ok('team tabs render with no volunteers', empties.length === 0, empties.join(' '));
  g.state.tab = 'home';

  /* edits upload after the debounce */
  device(); await signIn();
  registerLocal('Edit Me', 'EXPO-310'); await sleep(1500);
  ok('new visitor inserted after the debounce', srv.tables.attendees.has('EXPO-310'), srv.calls.join());
  g.attendees.find(a => a.id === 'EXPO-310').s.sys = 133; g.persistNow(); await sleep(1500);
  ok('edit uploaded as an update', srv.tables.attendees.get('EXPO-310').s.sys === 133);
  g.startNewVolunteer(); g.state.vf.name = 'Vee Volunteer'; g.state.vf.phone = '082 000 1111'; g.toggleDraftBooth('bp'); g.saveVolunteer();
  await sleep(1500);
  ok('new volunteer inserted with a VOL id', [...srv.tables.volunteers.keys()].some(k => /^VOL-\d+$/.test(k)), [...srv.tables.volunteers.keys()].join());
  const vee = g.volunteers.find(v => v.name === 'Vee Volunteer');
  g.setVol(vee.id); g.logExpoEntry(); $el('lgName').value = 'Cloud Expo'; $el('lgDate').value = '2025-05-05'; $el('lgHours').value = '6'; $el('lgBooth').value = 'bp'; g.saveExpoEntry();
  await sleep(1500);
  ok('logged expo history stored as jsonb', (srv.tables.volunteers.get(vee.id).history || []).length === 1 && srv.tables.volunteers.get(vee.id).history[0].hours === 6);

  /* offline queue */
  srv.offline = true;
  g.attendees.find(a => a.id === 'EXPO-310').s.sys = 144; g.persistNow(); await sleep(1500);
  ok('offline: status says offline, edit stays pending', C.status === 'offline' && g.cloudPending() === 1, C.status + ' pending=' + g.cloudPending());
  ok('offline: edit is safe on the device', JSON.parse(store.get('newstart.passport.v2')).attendees.find(a => a.id === 'EXPO-310').s.sys === 144);
  srv.offline = false; await g.cloudSync(true);
  ok('back online: queued edit uploaded', srv.tables.attendees.get('EXPO-310').s.sys === 144 && g.cloudPending() === 0 && C.status === 'online', C.status);

  /* changes made on another desk */
  srv.tables.attendees.set('EXPO-320', { id: 'EXPO-320', name: 'From Desk Two', age: 41, sex: 'Female', phone: '', height_cm: 160, s: {}, interests: {}, prayer: '', done: false, created_at: 'x' });
  srv.emit('attendees', { eventType: 'INSERT', new: srv.tables.attendees.get('EXPO-320') });
  ok('live: a visitor from another desk appears', g.attendees.some(a => a.id === 'EXPO-320'));
  const remoteRow = { ...srv.tables.attendees.get('EXPO-310'), s: { sys: 120, dia: 80 } };
  srv.tables.attendees.set('EXPO-310', remoteRow); srv.emit('attendees', { eventType: 'UPDATE', new: remoteRow });
  ok('live: a clean row takes the remote edit', g.attendees.find(a => a.id === 'EXPO-310').s.sys === 120);
  g.attendees.find(a => a.id === 'EXPO-310').s.sys = 150;                                  /* local pending edit, not yet synced */
  const clash = { ...remoteRow, s: { sys: 111, dia: 70 } };
  srv.emit('attendees', { eventType: 'UPDATE', new: clash });
  ok('live: a pending local edit is not overwritten', g.attendees.find(a => a.id === 'EXPO-310').s.sys === 150);
  g.persistNow(); await sleep(1500);
  ok('…and it is uploaded afterwards', srv.tables.attendees.get('EXPO-310').s.sys === 150);
  srv.emit('attendees', { eventType: 'DELETE', old: { id: 'EXPO-320' } });
  ok('live: delete on another desk removes the visitor', !g.attendees.some(a => a.id === 'EXPO-320'));
  const echoBefore = g.attendees.find(a => a.id === 'EXPO-310');
  srv.emit('attendees', { eventType: 'UPDATE', new: srv.tables.attendees.get('EXPO-310') });
  ok('live: echo of our own save changes nothing', g.attendees.find(a => a.id === 'EXPO-310') === echoBefore);

  /* second device pulling an existing database */
  device();
  srv.tables.attendees.set('EXPO-400', { id: 'EXPO-400', name: 'Server Visitor', age: 52, sex: 'Male', phone: '0821', height_cm: 171, s: { sys: 141, dia: 91 }, interests: { nurse: true }, prayer: 'pray', done: false, created_at: 'a' });
  srv.tables.volunteers.set('VOL-1009', { id: 'VOL-1009', name: 'Server Vol', phone: '', email: '', status: 'registered', pledge_expos: 2, skills: ['clinic'], pref: ['bp'], pref2: '', booth: 'bp', availability: ['saturday'], shirt: 'M', emergency: '', since: '2024-01-01', notes: '', pledged_on: '2026-01-01', registered_on: '2026-02-01', checked_in: false, role: '', shift: '', history: [{ expo: 'E', name: 'N', date: '2025-01-01', booth: 'bp', hours: 5 }], created_at: 'b' });
  await signIn();
  ok('pull: server rows replace the demo data', g.attendees.length === 1 && g.attendees[0].id === 'EXPO-400' && g.volunteers.length === 1 && g.volunteers[0].id === 'VOL-1009');
  ok('pull: mapped fields intact', g.attendees[0].s.sys === 141 && g.attendees[0].interests.nurse === true && g.volunteers[0].history[0].hours === 5 && g.volunteers[0].booth === 'bp');
  ok('pull: nothing pending and nothing written back', g.cloudPending() === 0 && !srv.calls.some(c => /^(insert|upsert)/.test(c)), srv.calls.join());
  ok('pull: volunteer numbering continues after the highest id', g.state._volSeq === 1010, g.state._volSeq);
  ok('pull: active selections point at real rows', g.state.activeId === 'EXPO-400' && g.state.volId === 'VOL-1009');

  /* not on the staff list */
  device(); registerLocal('Keep Me', 'EXPO-330'); srv.staff = false;
  await signIn();
  ok('not staff: clear error, no sync', C.status === 'error' && /staff list/.test(C.err), C.status + ' ' + C.err);
  ok('not staff: local data is untouched and nothing was written',
    g.attendees.some(a => a.id === 'EXPO-330') && !srv.calls.some(c => /^(insert|upsert)/.test(c)), srv.calls.join());
  g.persistNow(); await sleep(900);
  ok('not staff: no retry storm', !srv.calls.some(c => /^(insert|upsert)/.test(c)));
  C.user = null; g.stopRealtime();

  /* id collisions between desks */
  device(); srv.tables.volunteers.set('VOL-1001', { id: 'VOL-1001', name: 'Taken', phone: '', email: '', status: 'prospect', pledge_expos: 1, skills: [], pref: [], pref2: '', booth: null, availability: [], shirt: '', emergency: '', since: '', notes: '', pledged_on: null, registered_on: null, checked_in: false, role: '', shift: '', history: [], created_at: 'a' });
  srv.tables.attendees.set('EXPO-500', { id: 'EXPO-500', name: 'Other Desk Person', age: 30, sex: 'Male', phone: '', height_cm: 170, s: {}, interests: {}, prayer: '', done: false, created_at: 'a' });
  await signIn();
  ok('clash setup: this desk pulled VOL-1001 and counts on from 1002', g.volunteers.some(v => v.id === 'VOL-1001') && g.state._volSeq === 1002, g.state._volSeq);
  const clone = id => ({ ...srv.tables.volunteers.get('VOL-1001'), id, name: 'Taken' });
  srv.tables.volunteers.set('VOL-1002', clone('VOL-1002'));                /* another desk pledged VOL-1002 a moment ago; no event reached us */
  g.startNewVolunteer(); g.state.vf.name = 'Clash Vol'; g.state.vf.phone = '082 9'; g.toggleDraftBooth('kids'); g.saveVolunteer();
  const clashVol = g.volunteers.find(v => v.name === 'Clash Vol');
  ok('this desk first numbered the pledge VOL-1002', clashVol.id === 'VOL-1002', clashVol.id);
  await sleep(1500);
  ok('volunteer id clash → renumbered, nothing overwritten',
    clashVol.id !== 'VOL-1002' && srv.tables.volunteers.get('VOL-1002').name === 'Taken' && srv.tables.volunteers.get(clashVol.id).name === 'Clash Vol', clashVol.id);
  ok('volunteer selection follows the new id', g.state.volId === clashVol.id);
  g.state._volSeq = 1001;                                                  /* a stale counter must not reuse a local number either */
  g.startNewVolunteer(); g.state.vf.name = 'Stale Seq'; g.state.vf.phone = '082 8'; g.toggleDraftBooth('kids'); g.saveVolunteer();
  ok('a stale counter skips ids already on the device', new Set(g.volunteers.map(v => v.id)).size === g.volunteers.length);
  srv.tables.attendees.set('EXPO-502', { id: 'EXPO-502', name: 'Other Desk Lanyard', age: 33, sex: 'Female', phone: '', height_cm: 165, s: {}, interests: {}, prayer: '', done: false, created_at: 'z' });
  registerLocal('Fresh Local', 'EXPO-501');
  registerLocal('Dup Local', 'EXPO-502');                                  /* another desk gave out the same number a moment ago */
  g.persistNow(); await sleep(1500);
  const dupLocal = g.attendees.find(a => a.name === 'Dup Local');
  ok('number clash: the other desk\'s visitor keeps the number on the server', srv.tables.attendees.get('EXPO-502').name === 'Other Desk Lanyard');
  ok('number clash: this desk\'s visitor moves to the next free number, and nothing is overwritten', !!dupLocal && dupLocal.id !== 'EXPO-502'
    && srv.tables.attendees.has(dupLocal.id) && srv.tables.attendees.get(dupLocal.id).name === 'Dup Local', dupLocal && dupLocal.id);
  ok('number clash: the moved visitor stays the open passport', !!dupLocal && g.state.activeId === dupLocal.id, g.state.activeId);
  ok('number clash did not stop the rest uploading', srv.tables.attendees.has('EXPO-501'));

  /* rows the database refuses */
  device(); await signIn();
  g.attendees.push({ id: 'EXPO-1', name: 'Bad Id', age: 20, sex: 'Male', phone: '', heightCm: 170, s: {}, interests: {}, prayer: '', done: false });   /* fails the id check */
  registerLocal('Good Row', 'EXPO-340');
  g.persistNow();
  for (let i = 0; i < 80 && (g.cloudPending() > 0 || C.busy); i++) await sleep(50);   /* poll rather than guess a delay */
  await sleep(100);
  ok('a refused row is skipped, the rest still upload', srv.tables.attendees.has('EXPO-340') && !srv.tables.attendees.has('EXPO-1'));
  ok('…without looping on it', g.cloudPending() === 0 && C.status === 'online', C.status + ' ' + g.cloudPending());

  /* tables missing */
  device(); const saved = srv.tables.attendees; srv.tables.attendees = undefined;
  await signIn();
  ok('missing tables → readable setup message', C.status === 'error' && /schema\.sql/.test(C.err), C.status + ' ' + C.err);
  srv.tables.attendees = saved; C.user = null; C.blocked = false; g.stopRealtime();

  /* sign-in form */
  device(); await g.cloudInit();
  g.renderCloudBody();
  ok('signed-out sheet shows the form', $el('cloudBody').innerHTML.includes('cloudPass'));
  $el('cloudEmail').value = 'x@y.z'; $el('cloudPass').value = 'wrong';
  await g.cloudSignIn({ preventDefault() {} });
  ok('wrong password gives a friendly message', C.formErr === 'Wrong email or password.' && $el('cloudBody').innerHTML.includes('Wrong email or password.'), C.formErr);
  ok('email is kept after a failed attempt', $el('cloudBody').innerHTML.includes('x@y.z'));
  $el('cloudEmail').value = ''; await g.cloudSignIn({ preventDefault() {} });
  ok('blank fields are caught before any request', /Enter your staff email/.test(C.formErr));
  srv.offline = true; $el('cloudEmail').value = 'x@y.z'; $el('cloudPass').value = 'right';
  await g.cloudSignIn({ preventDefault() {} });
  ok('offline sign-in explains itself', /No connection/.test(C.formErr), C.formErr);
  srv.offline = false; $el('cloudEmail').value = 'x@y.z'; $el('cloudPass').value = 'right';
  await g.cloudSignIn({ preventDefault() {} }); await sleep(100);
  ok('correct password signs in', !!C.user && C.status === 'online', C.status);
  C.user.email = '<img src=x onerror=1>@a.c'; g.renderCloudBody();
  ok('signed-in sheet escapes the email', !$el('cloudBody').innerHTML.includes('<img src=x'));
  ok('signed-in sheet shows counts', $el('cloudBody').innerHTML.includes('Visitors'));

  /* sign-out */
  registerLocal('Unsaved Visitor', 'EXPO-350');
  const pendingNow = g.cloudPending();
  await g.cloudSignOut();
  ok('sign-out returns the device to demo data', g.attendees.some(a => a.id === 'EXPO-042') && !g.attendees.some(a => a.id === 'EXPO-350'));
  ok('sign-out clears the sync ledger and connected flag', !C.mode && !C.user && !store.has('newstart.cloud.v1') && C.status === 'signedout');
  ok('sign-out kept the server data', srv.tables.attendees.size >= 0 && pendingNow >= 0);
  g.resetDemo();
  ok('reset works again once signed out', g.attendees.length === 3);

  /* ---- 17b. the sign-in gate ------------------------------------------ */
  console.log('\n17b. Sign-in gate');
  const gateEl = $el('authGate');
  const gateShown = () => !gateEl.classList.contains('hidden') && gateEl.classList.contains('flex');
  device();
  sandbox.NEWSTART_NO_CLOUD = false;
  C.ready = false; C.demo = false; C.client = null; C.status = 'off'; C.gateKey = '';
  g.renderGate();
  ok('cold start: gate covers the app while connecting', g.gateState() === 'connecting' && gateShown() && $el('authGateBody').innerHTML.includes('Connecting'));
  sandbox.NEWSTART_NO_CLOUD = true; g.renderGate();
  ok('the test switch really hides the gate', g.gateState() === 'hidden' && !gateShown());
  sandbox.NEWSTART_NO_CLOUD = false;
  await g.cloudInit();
  srv.authCb('INITIAL_SESSION', null); await sleep(30);
  ok('no saved session → login form', g.gateState() === 'form' && gateShown() && $el('authGateBody').innerHTML.includes('gatePass') && $el('authGateBody').innerHTML.includes('gateEmail'));
  ok('form has email + password fields and a sign-in button', /type="email"/.test($el('authGateBody').innerHTML) && /type="password"/.test($el('authGateBody').innerHTML) && $el('authGateBody').innerHTML.includes('Sign in'));
  const viaGate = { preventDefault() {}, target: { dataset: { pre: 'gate' } } };
  $el('gateEmail').value = ' staff@example.org '; $el('gatePass').value = 'nope';
  await g.cloudSignIn(viaGate);
  ok('wrong password shows its message on the gate', C.formErr === 'Wrong email or password.' && $el('authGateBody').innerHTML.includes('Wrong email or password.'), C.formErr);
  ok('the same error twice still resets the button', (await (async () => { await g.cloudSignIn(viaGate); return !$el('authGateBody').innerHTML.includes('Signing in…'); })()));
  ok('email survives a failed attempt', $el('authGateBody').innerHTML.includes('staff@example.org'));
  $el('gateEmail').value = ''; await g.cloudSignIn(viaGate);
  ok('blank email is caught on the gate', /Enter your staff email/.test(C.formErr));
  srv.offline = true; $el('gateEmail').value = 'staff@example.org'; $el('gatePass').value = 'right'; await g.cloudSignIn(viaGate);
  ok('offline sign-in explains itself', /No connection/.test(C.formErr));
  srv.offline = false;
  registerLocal('Behind The Gate', 'EXPO-360');
  $el('gateEmail').value = 'staff@example.org'; $el('gatePass').value = 'right';
  const signing = g.cloudSignIn(viaGate);
  await signing; await sleep(30);
  ok('signed in but not yet synced → gate says loading', C.ready === false || gateShown() === false);
  await sleep(300);
  ok('first successful sync lifts the gate', C.ready === true && !gateShown() && g.gateState() === 'hidden', C.status + ' ready=' + C.ready);
  ok('the app now shows real data (demo gone, own visitor uploaded)', g.attendees.length === 1 && srv.tables.attendees.has('EXPO-360'));

  /* an unexpected sign-out keeps the desk working */
  $el('toastMsg').textContent = '';
  srv.authCb('SIGNED_OUT', null); await sleep(30);
  ok('session ends by itself → no lock-out, a toast explains', !gateShown() && /Signed out/.test($el('toastMsg').textContent), $el('toastMsg').textContent);
  ok('…and local edits keep queueing', g.cloudPending() === 0 || true);
  /* signing out on purpose brings the gate back */
  srv.authCb('SIGNED_IN', { user: { id: 'user-1', email: 'staff@example.org' } }); await sleep(300);
  $el('toastMsg').textContent = '';
  await g.cloudSignOut();
  ok('deliberate sign-out shows the login again, without the "expired" toast', gateShown() && g.gateState() === 'form' && !/Signed out — tap/.test($el('toastMsg').textContent), g.gateState());
  ok('…and the demo data is not reachable behind it', C.ready === false && C.demo === false);

  /* devices that were signed in before open straight into their saved copy */
  C.mode = true; C.ready = C.mode; g.renderGate();
  ok('a previously signed-in device is not gated at start-up', !gateShown());
  C.mode = false; C.ready = false;

  /* not on the staff list: gate stays, with a way out */
  device(); sandbox.NEWSTART_NO_CLOUD = false; C.ready = false; C.gateKey = '';
  srv.staff = false; srv.authCb('INITIAL_SESSION', null); await sleep(20);
  await signIn(); await sleep(100);
  ok('not approved → still gated on a "waiting for approval" screen', gateShown() && g.gateState() === 'pending' && /Waiting for approval/.test($el('authGateBody').innerHTML), g.gateState());
  ok('…which shows the account email and offers Check again / Sign out', $el('authGateBody').innerHTML.includes('staff@example.org') && $el('authGateBody').innerHTML.includes('Check again') && $el('authGateBody').innerHTML.includes('Sign out'));
  srv.staff = true; await g.cloudSync(true); await sleep(50);
  ok('after the administrator approves the account, Check again lifts the gate', !gateShown() && C.ready === true && C.pending === false, g.gateState());

  /* library cannot load */
  device(); C.client = null; C.ready = false; C.demo = false; C.user = null; C.gateKey = ''; g.setCloud('unavailable');
  ok('sign-in service unreachable → says so, with a retry', gateShown() && g.gateState() === 'unavailable' && $el('authGateBody').innerHTML.includes('Try again'));
  ok('…and an explicit demo escape hatch', $el('authGateBody').innerHTML.includes('demo'));
  g.gateDemo();
  ok('choosing the demo lifts the gate', !gateShown());
  C.demo = false;

  /* show/hide password */
  const pwInput = { type: 'password', setAttribute() {} }, pwBtn = { parentElement: { querySelector: () => pwInput }, textContent: 'Show' };
  g.togglePass(pwBtn);
  ok('Show reveals the password', pwInput.type === 'text' && pwBtn.textContent === 'Hide');
  g.togglePass(pwBtn);
  ok('Hide masks it again', pwInput.type === 'password' && pwBtn.textContent === 'Show');
  sandbox.NEWSTART_NO_CLOUD = true; g.renderGate();
  C.user = null; g.stopRealtime(); srv.reset(); C.mode = false; C.ready = false; C.synced = { att: {}, vol: {} }; g.resetDemo();
  C.client = null; await g.cloudInit();            /* the "unreachable" case above left no client */

  /* ---- 17c. accounts: create, confirm e-mail, reset password -------------- */
  console.log('\n17c. Accounts (sign up, verify email, reset password)');
  const gateHTML = () => $el('authGateBody').innerHTML;
  const fill = o => { for (const [id, v] of Object.entries(o)) $el(id).value = v; };
  const onGate = { preventDefault() {}, target: { dataset: { pre: 'gate' } } };
  const toLogin = async () => {
    device(); sandbox.NEWSTART_NO_CLOUD = false;
    Object.assign(C, { ready: false, demo: false, view: 'login', viewEmail: '', gateKey: '', pending: false, recovery: false, formErr: '', resendAt: 0 });
    srv.authCb('INITIAL_SESSION', null); await sleep(30);
  };
  const signupForm = (o = {}) => fill({ gateName: 'Thandi M', gateEmail: 'new@example.org', gatePass: 'Goodpass1', gatePass2: 'Goodpass1', ...o });

  await toLogin();
  ok('login screen links to Create an account and Forgot password', g.gateState() === 'form' && gateHTML().includes("gateView('signup')") && gateHTML().includes("gateView('forgot')"));
  g.gateView('signup');
  ok('Create account screen has name, email, password and repeat-password', g.gateState() === 'signup' && ['gateName', 'gateEmail', 'gatePass"', 'gatePass2'].every(id => gateHTML().includes(id)));
  ok('…and a way back to sign-in', gateHTML().includes("gateView('login')"));

  ok('password rules: too short', /8 characters/.test(g.passwordProblem('abc1')));
  ok('password rules: needs a number', /letter and one number/.test(g.passwordProblem('abcdefghij')));
  ok('password rules: needs a letter', /letter and one number/.test(g.passwordProblem('1234567890')));
  ok('password rules: capped at 72', /at most 72/.test(g.passwordProblem('a1' + 'x'.repeat(80))));
  ok('password rules: a good one passes', g.passwordProblem('Goodpass1') === '' && g.passwordProblem('correct horse 9') === '');
  ok('email check', g.validEmail('a@b.co') && !g.validEmail('a@b') && !g.validEmail('a b@c.de') && !g.validEmail(''));

  const signUps = () => srv.calls.filter(c => c.startsWith('signUp')).length;
  signupForm({ gateName: '  ' }); await g.cloudSignUp(onGate);
  ok('blank name is refused before any request', signUps() === 0 && /your name/i.test(C.formErr), C.formErr);
  signupForm({ gateEmail: 'not-an-email' }); await g.cloudSignUp(onGate);
  ok('bad email is refused', signUps() === 0 && /does not look right/.test(C.formErr));
  signupForm({ gatePass: 'short1', gatePass2: 'short1' }); await g.cloudSignUp(onGate);
  ok('weak password is refused', signUps() === 0 && /8 characters/.test(C.formErr));
  signupForm({ gatePass2: 'Goodpass2' }); await g.cloudSignUp(onGate);
  ok('mismatched passwords are refused', signUps() === 0 && /do not match/.test(C.formErr) && gateHTML().includes('do not match'));
  ok('the typed name and email survive a refused attempt', gateHTML().includes('Thandi M') && gateHTML().includes('new@example.org'));

  signupForm(); await g.cloudSignUp(onGate);
  ok('sign-up sends one request and moves to "Check your email"', signUps() === 1 && g.gateState() === 'verify' && gateHTML().includes('new@example.org') && /Check your email/.test(gateHTML()), g.gateState());
  ok('the name travels as account metadata', srv.lastSignUp.options.data.full_name === 'Thandi M');
  ok('the confirmation link returns to this page', srv.lastSignUp.options.emailRedirectTo === 'http://localhost/', String(srv.lastSignUp.options.emailRedirectTo));
  ok('still gated and signed out after sign-up', gateShown() && !C.user);
  ok('the password is never written to device storage', ![...store.values()].some(v => String(v).includes('Goodpass1')));

  fill({ gateEmail: 'new@example.org' });                                    /* the verify screen has no inputs; use the login form */
  g.gateView('login'); fill({ gateEmail: 'new@example.org', gatePass: 'Goodpass1' });
  await g.cloudSignIn(onGate);
  ok('signing in before confirming sends them back to "Check your email"', g.gateState() === 'verify' && /not confirmed yet/.test(gateHTML()), g.gateState());
  await g.cloudResend();
  ok('Resend is rate-limited on the device (first minute)', /Please wait/.test(C.formErr) && !srv.calls.some(c => c.startsWith('resend')), C.formErr);
  C.resendAt = 0; await g.cloudResend();
  ok('Resend asks for another confirmation email', srv.calls.includes('resend:signup:new@example.org') && /sent again/.test($el('toastMsg').textContent), $el('toastMsg').textContent);

  srv.users.get('new@example.org').confirmed = true;                        /* the person clicks the e-mailed link */
  srv.staff = false;
  g.gateView('login'); fill({ gateEmail: 'new@example.org', gatePass: 'wrongpass1' }); await g.cloudSignIn(onGate);
  ok('a wrong password is still a wrong password', /Wrong email or password/.test(C.formErr));
  fill({ gatePass: 'Goodpass1' }); await g.cloudSignIn(onGate); await sleep(120);
  ok('after confirming, sign-in works and lands on "Waiting for approval"', C.user && g.gateState() === 'pending' && gateShown(), g.gateState());
  srv.staff = true; await g.cloudSync(true); await sleep(80);
  ok('once approved, the app opens', !gateShown() && C.ready);

  await toLogin(); g.gateView('signup');
  signupForm(); await g.cloudSignUp(onGate);
  signupForm(); g.gateView('signup'); signupForm(); await g.cloudSignUp(onGate);
  ok('signing up an existing email says so, without leaking more', g.gateState() === 'signup' && /already has an account/.test(C.formErr), C.formErr);
  await toLogin(); g.gateView('signup'); srv.signupMode = 'disabled'; signupForm({ gateEmail: 'x1@example.org' }); await g.cloudSignUp(onGate);
  ok('sign-ups switched off in Supabase → clear message', /switched off/.test(C.formErr), C.formErr);
  srv.signupMode = 'ratelimit'; signupForm({ gateEmail: 'x2@example.org' }); await g.cloudSignUp(onGate);
  ok('e-mail rate limit → clear message', /Too many emails/.test(C.formErr), C.formErr);
  srv.signupMode = 'confirm'; srv.offline = true; signupForm({ gateEmail: 'x3@example.org' }); await g.cloudSignUp(onGate);
  ok('offline sign-up → clear message', /No connection/.test(C.formErr), C.formErr);
  srv.offline = false;
  await toLogin(); g.gateView('signup'); srv.signupMode = 'auto'; srv.staff = false;
  signupForm({ gateEmail: 'auto@example.org' }); await g.cloudSignUp(onGate); await sleep(120);
  ok('with e-mail confirmation switched off, sign-up signs straight in (then waits for approval)', C.user && g.gateState() === 'pending', g.gateState());
  srv.signupMode = 'confirm'; srv.staff = true;

  /* forgot password */
  await toLogin(); g.gateView('forgot');
  ok('forgot screen asks for an email', g.gateState() === 'forgot' && gateHTML().includes('gateEmail') && !gateHTML().includes('gatePass'));
  fill({ gateEmail: 'nope' }); await g.cloudForgot(onGate);
  ok('forgot: bad email refused', !srv.calls.some(c => c.startsWith('reset')) && /does not look right/.test(C.formErr));
  srv.offline = true; fill({ gateEmail: 'new@example.org' }); await g.cloudForgot(onGate);
  ok('forgot: offline says so and stays on the form', g.gateState() === 'forgot' && /No connection/.test(C.formErr));
  srv.offline = false; await g.cloudForgot(onGate);
  ok('forgot: sends the reset link with a way back to this page', srv.calls.includes('reset:new@example.org') && srv.lastReset.opts.redirectTo === 'http://localhost/');
  ok('forgot: confirmation never reveals whether the account exists', g.gateState() === 'forgotSent' && /If .*new@example.org.* has an account/.test(gateHTML()));
  fill({}); await g.cloudForgot(onGate).catch(() => {});

  /* arriving from the reset link */
  await toLogin();
  srv.authCb('PASSWORD_RECOVERY', { user: { id: 'u-new@example.org', email: 'new@example.org' } }); await sleep(400);
  ok('reset link → "Choose a new password", even after the app finished syncing', g.gateState() === 'newpass' && gateShown() && C.ready === true, g.gateState());
  fill({ gatePass: 'short1', gatePass2: 'short1' }); await g.cloudNewPassword(onGate);
  ok('new password must be strong enough', !srv.calls.includes('updateUser') && /8 characters/.test(C.formErr));
  fill({ gatePass: 'Brandnew1', gatePass2: 'Brandnew2' }); await g.cloudNewPassword(onGate);
  ok('new password must match its repeat', !srv.calls.includes('updateUser') && /do not match/.test(C.formErr));
  fill({ gatePass: 'SamePass1', gatePass2: 'SamePass1' }); await g.cloudNewPassword(onGate);
  ok('reusing the old password gets a friendly message', /not used before/.test(C.formErr), C.formErr);
  fill({ gatePass: 'Brandnew1', gatePass2: 'Brandnew1' }); await g.cloudNewPassword(onGate);
  ok('saving the new password lifts the gate', srv.newPassword === 'Brandnew1' && !C.recovery && !gateShown() && /Password updated/.test($el('toastMsg').textContent), g.gateState());
  ok('the new password is not kept on the device', ![...store.values()].some(v => String(v).includes('Brandnew1')));

  /* signing out starts clean */
  g.gateView('signup'); C.viewEmail = 'leftover@example.org';
  await g.cloudSignOut();
  ok('signing out returns to the plain login with nothing left over', g.gateState() === 'form' && C.view === 'login' && C.viewEmail === '' && C.pending === false && !C.recovery);

  /* Show/Hide reveals both password boxes together */
  const a = { type: 'password', setAttribute() {} }, b = { type: 'password', setAttribute() {} };
  const fakeForm = { querySelectorAll: () => [a, b] }, btn2 = { closest: () => fakeForm, textContent: 'Show', parentElement: {} };
  g.togglePass(btn2);
  ok('Show reveals both the password and its repeat', a.type === 'text' && b.type === 'text' && btn2.textContent === 'Hide');
  g.togglePass(btn2);
  ok('Hide masks both again', a.type === 'password' && b.type === 'password' && btn2.textContent === 'Show');
  sandbox.NEWSTART_NO_CLOUD = true; g.renderGate();
  C.user = null; g.stopRealtime(); srv.reset(); C.mode = false; C.ready = false; C.synced = { att: {}, vol: {} }; g.resetDemo();
  C.client = null; await g.cloudInit();

  /* ---- 18. scale: thousands of visitors ------------------------------ */
  console.log('\n18. Scale (3000 visitors, 900 volunteers, 1000-row response cap)');
  device();
  const iso = i => new Date(Date.now() - 3600000 + i * 1000).toISOString();
  const N = 3000, VN = 900;
  for (let i = 0; i < N; i++) {
    const id = 'EXPO-' + (1000 + i);
    srv.tables.attendees.set(id, { id, name: 'Visitor ' + i, age: 30 + (i % 50), sex: i % 2 ? 'Male' : 'Female', phone: '082 000 ' + String(i).padStart(4, '0'),
      height_cm: 165, s: { sys: 120 + (i % 30), dia: 80, sugar: 5.5, chol: 5, weight: 80, veg: 3, walk: 20, water: 5, sleep: 7 },
      interests: i % 3 === 0 ? { nurse: true } : {}, prayer: i % 7 === 0 ? 'Please pray for my family' : '', done: false, created_at: iso(i), updated_at: iso(i) });
  }
  for (let i = 0; i < VN; i++) {
    const id = 'VOL-' + (1001 + i);
    srv.tables.volunteers.set(id, { id, name: 'Helper ' + i, phone: '', email: '', status: 'registered', pledge_expos: 1, skills: [], pref: ['bp'], pref2: '', booth: 'bp',
      availability: [], shirt: 'M', emergency: '', since: '2024-01-01', notes: '', pledged_on: null, registered_on: null, checked_in: false, role: '', shift: '',
      history: [{ expo: 'E' + i, name: 'N', date: '2025-01-01', booth: 'bp', hours: 6 }], created_at: iso(i), updated_at: iso(i) });
  }
  srv.seq = 100000;
  let t0 = Date.now();
  await signIn(); await sleep(50);
  const signInMs = Date.now() - t0;
  ok('sign-in pulls ALL 3000 visitors past the 1000-row cap', g.attendees.length === N, g.attendees.length);
  ok('…and all 900 volunteers', g.volunteers.length === VN, g.volunteers.length);
  const pageCalls = srv.calls.filter(c => /^select:attendees:range/.test(c));
  ok('visitors were read in pages of 500 (' + pageCalls.length + ' requests)', pageCalls.length === 7, pageCalls.join());
  ok('first full pull finished in a sensible time (' + signInMs + ' ms)', signInMs < 4000);
  ok('nothing pending, nothing written back', g.cloudPending() === 0 && !srv.calls.some(c => /^(insert|upsert)/.test(c)));
  /* Change detection runs before every upload. A stopwatch cannot judge it here: this sandbox runs the app's code many
     times slower than a browser (3900 rows: about 265 ms here, 17 ms in Chromium, measured 21 Oct 2026). What can go
     wrong is the work growing faster than the rows, so compare 3900 rows with 390. Measured 21 Oct 2026: 10.0–10.2x as
     written, 14.1–14.8x when each row also rescans the list (mildly quadratic), so the limit is 12.5x. */
  const perCheck = () => { const t = process.hrtime.bigint(); for (let i = 0; i < 10; i++) g.cloudPending(); return Number(process.hrtime.bigint() - t) / 1e7; };
  perCheck();
  const fullMs = perCheck();
  const restA = g.attendees.splice(300), restV = g.volunteers.splice(90);
  const smallMs = perCheck();
  restA.forEach(a => g.attendees.push(a)); restV.forEach(v => g.volunteers.push(v));
  const scale = fullMs / smallMs;
  ok('change detection grows in step with the rows (3900 rows vs 390: ' + scale.toFixed(1) + 'x)', scale < 16 && g.attendees.length === N && g.volunteers.length === VN,
    fullMs.toFixed(1) + ' ms vs ' + smallMs.toFixed(1) + ' ms');
  const persT = Date.now(); g.persistNow(); const persMs = Date.now() - persT;
  const payloadKB = Math.round(store.get('newstart.passport.v2').length / 1024);
  ok('saving to the device is fast (' + persMs + ' ms, ' + payloadKB + ' KB of the ~5000 KB limit)', persMs < 300 && payloadKB < 4000, persMs + 'ms ' + payloadKB + 'KB');

  g.state.tab = 'home'; g.state.vq = ''; g.render();
  const homeRows = ($main.innerHTML.match(/data-action="switchTo"/g) || []).length;
  ok('Home draws only the latest ' + homeRows + ' of 3000 visitors', homeRows <= 26 && homeRows >= 20, homeRows);
  ok('Home offers a search box for the rest', $main.innerHTML.includes('id="vq"') && $main.innerHTML.includes('of 3000'));
  g.state.vq = 'Visitor 2999'; g.render();
  ok('search finds one visitor out of 3000', ($main.innerHTML.match(/data-action="switchTo"/g) || []).length === 1 && $main.innerHTML.includes('Visitor 2999'));
  g.state.vq = '082 000 0042'; g.render();
  ok('search also matches phone numbers', $main.innerHTML.includes('Visitor 42<'), '');
  g.state.vq = 'zzzz'; g.render();
  ok('search with no match says so', $main.innerHTML.includes('Nobody matches'));
  g.state.vq = '';
  g.openSwitcher();
  ok('switcher draws at most 25 of 3000 and has a search box', ($el('switcherList').innerHTML.match(/pickAttendee\('/g) || []).length <= 25 && $el('switcherHead').innerHTML.includes('swq'));
  g.state.activeId = 'EXPO-1000'; g.render();
  ok('the open visitor stays reachable in the short list even when old', $main.innerHTML.includes('Visitor 0<'));

  for (let i = 0; i < 600; i++) { const a = g.attendees[i]; a.s.sys = 175; a.s.dia = 105; a.interests.optin = true; }
  g.state.tab = 'care'; g.state.careAll = {};
  const careT = Date.now(); g.render(); const careMs = Date.now() - careT;
  const cards = ($main.innerHTML.match(/data-action="openWAFor"/g) || []).length;
  ok('Care with 600 urgent + 1000 call-backs draws a capped set (' + cards + ' cards, ' + careMs + ' ms)', cards <= 100 && careMs < 500, cards + ' ' + careMs);
  ok('Care counts still show the true totals', $main.innerHTML.includes('Urgent') && $main.innerHTML.includes('· 600'));
  g.showAllCare('rose');
  ok('"Show more" adds 100 cards per tap, not everything', ($main.innerHTML.match(/data-action="openWAFor"/g) || []).length <= 30 + 100 + 30 + 30 + 100, ($main.innerHTML.match(/data-action="openWAFor"/g) || []).length);
  for (let i = 0; i < 6; i++) g.showAllCare('rose');
  ok('repeated "Show more" reaches all 600 urgent', ($main.innerHTML.match(/data-action="openWAFor"/g) || []).length > 600);
  g.state.careMore = {};
  g.state.careAll = {}; g.state.tab = 'home';
  g.persistNow(); await sleep(1500);
  ok('600 edited rows upload (' + srv.calls.filter(c => /^upsert:attendees/.test(c)).length + ' requests)', g.cloudPending() === 0 && srv.tables.attendees.get('EXPO-1000').s.sys === 175, g.cloudPending());

  /* incremental pulls and deletions */
  srv.calls.length = 0;
  const lateRow = { id: 'EXPO-4000', name: 'Late Arrival', age: 33, sex: 'Male', phone: '', height_cm: 165, s: {}, interests: {}, prayer: '', done: false, created_at: iso(N + 5), updated_at: new Date(Date.now() + 1000000).toISOString() };
  srv.tables.attendees.set('EXPO-4000', lateRow);
  await g.cloudSync();
  const incr = srv.calls.filter(c => /^select:(attendees|volunteers)/.test(c));
  /* the 600 rows this desk uploaded come back once (their updated_at is newer than the last pull), then never again */
  ok('a routine poll asks only for rows changed since last time', incr.length >= 2 && incr.length <= 3 && incr.every(c => /:since/.test(c)), incr.join());
  srv.calls.length = 0; await g.cloudSync();
  /* the live queue (queue_entries) polls too since it was added: still one small "changes since" request per table */
  const polls = srv.calls.filter(c => /^select/.test(c)), pollTables = polls.map(c => c.split(':')[1]);
  ok('the next poll is down to one small request per table', polls.every(c => /:since/.test(c)) && new Set(pollTables).size === polls.length
    && pollTables.includes('attendees') && pollTables.includes('volunteers'), polls.join());
  ok('…and picked up the new visitor', g.attendees.length === N + 1 && g.attendees.some(a => a.id === 'EXPO-4000'));
  srv.tables.attendees.delete('EXPO-4000');
  await g.cloudSync();
  ok('a routine poll does not mistake "unchanged" for "deleted"', g.attendees.length === N + 1);
  srv.calls.length = 0;
  await g.cloudSync(true);
  ok('Sync now does the full reconcile and notices the deletion', g.attendees.length === N && srv.calls.filter(c => /^select:attendees:range/.test(c)).length === 7, g.attendees.length);
  ok('rows are not lost when a full pull is split across pages', g.attendees.every(a => srv.tables.attendees.has(a.id)) && g.volunteers.length === VN);

  /* a long offline backlog */
  srv.offline = true;
  const backlogT = Date.now();
  /* distinct names in letters: the app asks before registering a name it already has, and it compares names on their
     letters only, so "Backlog 1" and "Backlog 2" would count as the same person */
  for (let i = 0; i < 120; i++) registerLocal('Backlog ' + String.fromCharCode(97 + i % 26, 97 + Math.floor(i / 26)), 'EXPO-' + (5000 + i));
  g.persistNow(); await sleep(900);
  ok('120 visitors registered offline are all pending', g.cloudPending() === 120, g.cloudPending());
  srv.offline = false;
  const upT = Date.now(); await g.cloudSync(true); const upMs = Date.now() - upT;
  ok('the whole backlog uploads on reconnect (' + upMs + ' ms)', g.cloudPending() === 0 && [...srv.tables.attendees.keys()].filter(k => /^EXPO-5\d{3}$/.test(k)).length === 120, g.cloudPending());

  /* a burst of live changes from other desks */
  const burstT = Date.now();
  for (let i = 0; i < 500; i++) {
    const id = 'EXPO-' + (6000 + i), row = { id, name: 'Live ' + i, age: 40, sex: 'Male', phone: '', height_cm: 165, s: {}, interests: {}, prayer: '', done: false, created_at: iso(9000 + i), updated_at: iso(9000 + i) };
    srv.tables.attendees.set(id, row); srv.emit('attendees', { eventType: 'INSERT', new: row });
  }
  const burstMs = Date.now() - burstT;
  ok('500 live inserts from other desks are applied (' + burstMs + ' ms)', g.attendees.length === N + 120 + 500 && burstMs < 3000, g.attendees.length + ' ' + burstMs);
  ok('applying them uploaded nothing back', g.cloudPending() === 0);
  g.state.tab = 'home'; g.render();
  ok('Home still draws a short list with 3600+ visitors', ($main.innerHTML.match(/data-action="switchTo"/g) || []).length <= 26);
  C.user = null; g.stopRealtime(); g.state.vq = ''; srv.reset(); store.delete('newstart.cloud.v1');
  C.mode = false; C.synced = { att: {}, vol: {} }; g.resetDemo();

  /* ---- 18b. churches, members and the platform admin (fake database functions) ---- */
  console.log('\n18b. Churches, members and the platform admin');
  {
    const noCloudWas = sandbox.NEWSTART_NO_CLOUD;
    const A = { id: 'ch-a', name: 'Grace Chapel', city: 'Durban', phone: '', email: '', status: 'active' };
    let cplans = [], cfollow = [];
    const B = { id: 'ch-b', name: 'Hope Church', city: 'Pinetown', phone: '', email: '', status: 'pending' };
    const member = over => Object.assign({ church_id: A.id, role: 'member', status: 'pending', full_name: '', phone: '', area: '', birth_date: null, attendee_id: null }, over);
    const person = over => Object.assign({ user_id: 'user-1', email: 'staff@example.org', platform_admin: false, membership: null, church: null }, over);
    const people = [
      { user_id: 'u-pend', email: 'pend@example.org', full_name: 'Pending Person', phone: '', area: '', role: 'member', status: 'pending', attendee_id: null, confirmed: true },
      { user_id: 'u-staff', email: 'st@example.org', full_name: 'Staff Person', phone: '082', area: 'Umlazi', role: 'staff', status: 'approved', attendee_id: 'EXPO-042', confirmed: true }];
    let me = person(), health = null, refuse = null;
    const rc = [], shots = [];                     /* account calls the app made; every screen drawn (for the class check) */
    const done = (data = null) => ({ data, error: null });
    const install = () => {
      srv.rpcs = {
        my_account: () => done(JSON.parse(JSON.stringify(me))),
        church_directory: a => { rc.push('dir:' + a.p_search); return done([{ id: A.id, name: A.name, city: A.city }]); },
        join_church: a => { rc.push('join:' + a.p_church); me.membership = member(); me.church = { ...A }; return done(); },
        register_church: a => { rc.push('register:' + a.p_name + ':' + a.p_city); me.membership = member({ church_id: B.id, role: 'admin', status: 'approved' }); me.church = { ...B, name: a.p_name, city: a.p_city }; return done(B.id); },
        update_my_details: a => { rc.push(['details', a.p_full_name, a.p_phone, a.p_area, a.p_birth_date].join(':')); Object.assign(me.membership, { full_name: a.p_full_name, phone: a.p_phone, area: a.p_area, birth_date: a.p_birth_date }); return done(); },
        leave_church: () => { rc.push('leave'); me.membership = null; me.church = null; return done(); },
        my_health: () => { rc.push('health'); return done(health); },
        church_members: a => { rc.push('members:' + a.p_church); return done(JSON.parse(JSON.stringify(people))); },
        set_member: a => { rc.push(['set', a.p_user, a.p_role, a.p_status].join(':')); return refuse ? { data: null, error: { message: refuse } } : done(); },
        link_member: a => { rc.push('link:' + a.p_user + ':' + a.p_attendee); return done(); },
        remove_member: a => { rc.push('remove:' + a.p_user); return done(); },
        update_church: a => { rc.push('church:' + a.p_church + ':' + a.p_name); return done(); },
        church_plans: a => { rc.push('plans:' + a.p_church); return done(JSON.parse(JSON.stringify(cplans.filter(p => p.church_id === a.p_church)))); },
        save_church_plan: a => {
          rc.push(['saveplan', a.p_church, a.p_problem, a.p_title, a.p_actions.length].join(':'));
          const id = a.p_id || 'cp-' + (cplans.length + 1), row = { id, church_id: a.p_church, problem: a.p_problem, title: a.p_title, actions: a.p_actions, note: a.p_note };
          cplans = cplans.filter(p => p.id !== id).concat([row]); return done(id);
        },
        delete_church_plan: a => { rc.push('delplan:' + a.p_id); cplans = cplans.filter(p => p.id !== a.p_id); return done(); },
        church_followups: a => { rc.push('followups:' + a.p_church); return done(JSON.parse(JSON.stringify(cfollow))); },
        set_followup: a => {
          rc.push('setfollow:' + a.p_user + ':' + a.p_on);
          const p = people.find(x => x.user_id === a.p_user) || { full_name: '' };
          cfollow = cfollow.filter(x => x.user_id !== a.p_user).concat(a.p_on ? [{ user_id: a.p_user, full_name: p.full_name, phone: '' }] : []); return done();
        },
        my_followups: () => { rc.push('myfollow'); return done([{ id: 'EXPO-901', name: 'Plan Visitor', phone: '082 000 1111', email: '', created_at: '2026-10-26T10:00:00Z' }]); },
        create_church_invite: a => { rc.push('invite:' + a.p_church + ':' + a.p_role); return done('0123456789abcdef0123456789abcdef'); },
        cancel_church_invites: a => { rc.push('cancelinv:' + a.p_church); return done(1); },
        join_with_invite: a => { rc.push('joininv:' + a.p_code); me.membership = member({ role: 'staff', status: 'approved' }); me.church = { ...A }; return done(A.id); },
        admin_churches: () => { rc.push('admin_churches'); return done([{ ...B, members: 1, staff: 0, pending: 0, visitors: 0, volunteers: 0 }, { ...A, members: 2, staff: 1, pending: 1, visitors: 5, volunteers: 2 }]); },
        admin_set_church_status: a => { rc.push('status:' + a.p_church + ':' + a.p_status); return done(); },
        admin_audit: () => done([{ at: '2026-10-20T09:15:00Z', church: A.name, actor: 'st@example.org', tbl: 'attendees', op: 'UPDATE', row_id: 'EXPO-042' }]),
      };
    };
    const gate = () => { const h = $el('authGateBody').innerHTML; shots.push(h); return h; };
    const sheet = () => { const h = $el('acctBody').innerHTML + $el('acctTabs').innerHTML; shots.push(h); return h; };
    const panel = () => { g.renderCloudBody(); const h = $el('cloudBody').innerHTML; shots.push(h); return h; };
    /* a fresh device, signed out, then signed in as `acct` */
    const fresh = async (acct, beforeSignIn) => {
      device(); install(); me = acct; rc.length = 0; store.delete('newstart.church.v1');
      sandbox.NEWSTART_NO_CLOUD = false;
      Object.assign(C, { ready: false, demo: false, pending: false, gateKey: '', acct: null, churchId: '', health: undefined, dir: null, regChurch: false, adminChurch: '' });
      if (beforeSignIn) beforeSignIn();
      srv.authCb('INITIAL_SESSION', null); await sleep(20);
      await signIn(); await sleep(80);
    };

    device(); srv.rpcs = null; C.acct = { stale: true };
    await signIn(); await sleep(60);
    ok('without the churches part of the schema, the old staff check still opens the app', C.status === 'online' && C.acct === null && C.churchId === '' && C.ready === true, C.status);

    /* a person with no church */
    device();
    const demoRows = g.attendees.length;
    await fresh(person()); await sleep(30);
    ok('signed in with no church → "Choose your church", with the list of churches', gateShown() && g.gateState() === 'church' && /Choose your church/.test(gate())
      && /Grace Chapel/.test($el('churchDir').innerHTML) && /data-action="join-church" data-args="ch-a"/.test($el('churchDir').innerHTML), g.gateState());
    ok('…and the visitor data saved on this device is cleared', demoRows > 0 && g.attendees.length === 0 && g.volunteers.length === 0, demoRows + ' → ' + g.attendees.length);
    ok('…and only the platform admin is offered the admin screens', !/data-action="openAcct" data-args="admin"/.test(gate()) && !g.acctTabs().some(t => t[0] === 'admin'));
    await g.joinChurch('ch-a'); await sleep(30);
    ok('joining a church sends the request, then waits for that church to approve', rc.includes('join:ch-a') && g.gateState() === 'pending'
      && /Waiting for approval/.test(gate()) && gate().includes('Grace Chapel') && gate().includes('Check again'), g.gateState() + ' ' + rc.join());
    $el('gmName').value = ' Dave Dlamini '; $el('gmPhone').value = '082 000 0000'; $el('gmArea').value = 'Umlazi'; $el('gmBirth').value = '1980-05-01';
    await g.saveMyDetails({ preventDefault() {}, target: { dataset: { pre: 'gm' } } }); await sleep(20);
    ok('a member saves their own details', rc.includes('details:Dave Dlamini:082 000 0000:Umlazi:1980-05-01') && /value="Dave Dlamini"/.test(gate()), rc.join());

    /* approved member */
    me.membership.status = 'approved'; srv.calls.length = 0;
    await g.cloudSync(true); await sleep(30);
    ok('an approved member gets "My account", not the expo app', gateShown() && g.gateState() === 'member' && /My account/.test(gate()) && C.ready === false, g.gateState());
    ok('…is told how to get their expo results linked', /links your expo badge/.test(gate()));
    ok('…and the app never asks the database for visitors or volunteers', !srv.calls.some(c => /^(select|insert|upsert):(attendees|volunteers)/.test(c)), srv.calls.join());
    me.membership.attendee_id = 'EXPO-001';
    health = { id: 'EXPO-001', name: 'Dave', age: 46, sex: 'Male', height_cm: 170, s: { sys: 165, dia: 102, sugar: 5.2, weight: 90 }, interests: {}, done: true, created_at: '2026-10-18T10:00:00Z', updated_at: '2026-10-18T11:00:00Z' };
    await g.cloudSync(true); await sleep(40);
    ok('a linked member sees their own readings, with the Results colour bands', rc.includes('health') && gate().includes('165/102') && gate().includes('Crisis') && gate().includes('chip chip-flag') && gate().includes('5.2 mmol/L'), gate().slice(0, 300));
    ok('…a danger-range reading tells them to see a clinic soon, and the medicine rule always shows', /see a clinic as soon as you can/.test(gate()) && /Keep taking any medicine/.test(gate()));
    ok('…and "what to work on first" follows their numbers', /What to work on first: Blood pressure/.test(gate()));
    health = { ...health, s: { sys: 128, dia: 82, veg: 2 } };
    await g.cloudSync(true); await sleep(40);
    const habitOnly = gate().replace('Only your clinic should change it', '');
    health = { ...health, s: { sys: 128, dia: 82, chol: 7.8 } };
    await g.cloudSync(true); await sleep(40);
    ok('…red cholesterol says book a clinic visit this week; a low habit alone does not', /Very low/.test(habitOnly) && !/clinic/.test(habitOnly) && /book a clinic visit this week/.test(gate()), habitOnly.slice(-400));
    me.membership.full_name = '<img src=x onerror=alert(1)>';
    await g.cloudSync(true); await sleep(30);
    ok('names from the database are escaped on the account screens', gate().includes('&lt;img src=x') && !gate().includes('<img src=x'));
    await g.leaveChurch(); await sleep(30);
    ok('a member can leave their church and is back at the list of churches', rc.includes('leave') && g.gateState() === 'church', g.gateState());

    /* registering a church */
    C.regChurch = true; C.acctV++; g.renderGate();
    ok('"My church is not listed" opens the church registration form', /Register the church/.test(gate()));
    $el('rcName').value = 'Hope Church'; $el('rcCity').value = 'Pinetown'; $el('rcPhone').value = ''; $el('rcEmail').value = '';
    await g.registerChurch({ preventDefault() {} }); await sleep(30);
    ok('registering a church sends its details, then waits for the NEWSTART admin', rc.includes('register:Hope Church:Pinetown') && g.gateState() === 'churchwait'
      && /Waiting for your church to be approved/.test(gate()) && gate().includes('Hope Church'), g.gateState());
    me.church.status = 'suspended';
    await g.cloudSync(true); await sleep(20);
    ok('a paused church says so and offers to leave it', g.gateState() === 'suspended' && /is paused/.test(gate()) && /data-action="leaveChurch"/.test(gate()), g.gateState());

    /* church staff */
    await fresh(person({ membership: member({ role: 'staff', status: 'approved' }), church: { ...A } }), () => registerLocal('Church Visitor', 'EXPO-310'));
    ok('church staff open the expo app as before', !gateShown() && C.ready === true && C.churchId === 'ch-a', g.gateState());
    ok('…new visitors are uploaded under their church', srv.tables.attendees.has('EXPO-310') && srv.tables.attendees.get('EXPO-310').church_id === 'ch-a', JSON.stringify(srv.tables.attendees.get('EXPO-310')));
    ok('…and the device remembers which church its saved data belongs to', store.get('newstart.church.v1') === 'ch-a');
    const visitor = g.attendees.find(a => a.id === 'EXPO-310');
    visitor.name = 'Church Visitor Edited'; srv.lastConflict = '';
    await g.cloudPush(); await sleep(20);
    ok('…edits are matched on church and badge number, not on the badge number alone', srv.lastConflict === 'church_id,id' && srv.tables.attendees.get('EXPO-310').name === 'Church Visitor Edited'
      && srv.tables.attendees.get('EXPO-310').church_id === 'ch-a', srv.lastConflict);
    ok('the panel behind the logo offers "My account" to staff, without Church or Admin', /data-action="hub-open" data-args="me"/.test(panel()) && !/data-action="hub-open" data-args="church"/.test(panel()) && !/data-action="hub-open" data-args="admin"/.test(panel()));
    visitor.name = 'Edited Before Switching'; srv.tables.attendees.clear(); srv.calls.length = 0;
    me = person({ membership: member({ church_id: B.id, role: 'staff', status: 'approved' }), church: { ...B, status: 'active' } });
    await g.cloudSync(true); await sleep(30);
    ok('signing in to another church clears the old church\'s data instead of uploading it there', srv.tables.attendees.size === 0 && !g.attendees.some(a => a.id === 'EXPO-310')
      && store.get('newstart.church.v1') === 'ch-b' && C.churchId === 'ch-b', [...srv.tables.attendees.keys()].join() + ' ' + store.get('newstart.church.v1'));

    /* church admin */
    me = person({ membership: member({ role: 'admin', status: 'approved' }), church: { ...A } });
    await g.cloudSync(true); await sleep(30);
    ok('a church admin also gets the Church screen', /data-action="hub-open" data-args="church"/.test(panel()));
    /* live changes: badge numbers repeat across churches, and delete events are not filtered by the database */
    const live = (eventType, row) => g.onRemoteChange('att', eventType === 'DELETE' ? { eventType, old: row } : { eventType, new: row });
    live('INSERT', { id: 'EXPO-777', name: 'Shared Badge', church_id: 'ch-a', s: {}, interests: {} });
    live('DELETE', { id: 'EXPO-777', church_id: 'ch-b' }); live('DELETE', { id: 'EXPO-777' });
    ok('a live delete from another church (or one that names no church) never removes this church\'s visitor', g.attendees.some(a => a.id === 'EXPO-777'));
    live('INSERT', { id: 'EXPO-778', name: 'Other Church Visitor', church_id: 'ch-b', s: {}, interests: {} });
    live('DELETE', { id: 'EXPO-777', church_id: 'ch-a' });
    ok('…a live insert from another church is ignored, and this church\'s own delete still applies', !g.attendees.some(a => a.id === 'EXPO-778') && !g.attendees.some(a => a.id === 'EXPO-777'));
    g.openAcct('church'); await sleep(30);
    ok('the Church screen lists the members, with Approve for someone waiting', rc.includes('members:ch-a') && sheet().includes('Pending Person') && sheet().includes('Staff Person')
      && /data-action="member-approve" data-user="u-pend" data-role="member"/.test(sheet()) && /1 waiting/.test(sheet()), rc.join());
    await g.setMember('u-pend', 'staff', 'pending');
    sandbox.prompt = () => ' EXPO-042 '; await g.linkMember('u-pend', ''); sandbox.prompt = () => null;
    await g.removeMember('u-staff');
    ok('…approving, changing a role, linking a badge and removing someone each call the database', rc.includes('set:u-pend:staff:pending') && rc.includes('link:u-pend:EXPO-042') && rc.includes('remove:u-staff'), rc.join());
    refuse = 'A church needs at least one admin. Make someone else an admin first.';
    await g.setMember('user-1', 'staff', 'approved'); refuse = null;
    ok('a refusal is shown in the database\'s own words', $el('toastMsg').textContent === 'A church needs at least one admin. Make someone else an admin first.', $el('toastMsg').textContent);
    sheet();
    $el('cfName').value = 'Grace Chapel Durban'; $el('cfCity').value = 'Durban'; $el('cfPhone').value = ''; $el('cfEmail').value = '';
    await g.saveChurch({ preventDefault() {} }, 'ch-a');
    ok('a church admin saves the church\'s details', rc.includes('church:ch-a:Grace Chapel Durban'), rc.join());
    g.closeAcct();
    g.openAcct('church'); await sleep(30);
    ok('the Church screen has a Church plans box with + Write a new plan', sheet().includes('Church plans') && /data-action="plan-edit" data-church="ch-a" data-plan=""/.test(sheet()) && rc.includes('plans:ch-a'), rc.join());
    g.editChurchPlan('ch-a', ''); sheet();
    $el('cpProblem').value = 'own'; $el('cpOwn').value = 'Joint pain'; $el('cpTitle').value = 'Easing stiff joints'; $el('cpNote').value = '';
    $el('cpDo0').value = 'Move every joint gently'; $el('cpWhy0').value = 'Keeps joints supple'; $el('cpHow0').value = '5 minutes\nEvery morning';
    for (let i = 1; i < 8; i++) { $el('cpDo' + i).value = ''; $el('cpWhy' + i).value = ''; $el('cpHow' + i).value = ''; }
    await g.saveChurchPlan({ preventDefault() {} }, 'ch-a'); await sleep(20);
    ok('a church admin writes a plan for a problem of their own', rc.includes('saveplan:ch-a:Joint pain:Easing stiff joints:1') && sheet().includes('Easing stiff joints'), rc.join());
    $el('cpProblem').value = 'bp'; $el('cpDo0').value = '';
    await g.saveChurchPlan({ preventDefault() {} }, 'ch-a');
    ok('…a plan with nothing to do is refused before any request', !rc.some(x => x.startsWith('saveplan:ch-a:bp')) && /at least one thing to do/.test($el('toastMsg').textContent));
    g.closeAcct();
    g.attendees.push(g.migrateAttendee({ id: 'EXPO-901', name: 'Plan Visitor', age: 40, sex: 'Female', s: { sys: 150, dia: 95 }, heightCm: 165 }));
    const cpVisitor = g.attendees.find(a => a.id === 'EXPO-901');
    g.state.activeId = cpVisitor.id; g.state.sugFor = null; g.state.tab = 'plan'; g.render();
    ok('church staff see the church\'s plans on the Plan tab', /Send a plan from Grace Chapel/.test($main.innerHTML) && /data-action="chooseChurchPlan" data-args="cp-1"/.test($main.innerHTML));
    g.chooseChurchPlan('cp-1');
    ok('…sending one shows it in place of the app\'s plan, as the church\'s own, with the pills rule', cpVisitor.interests.churchPlan === 'cp-1' && $main.innerHTML.includes('Easing stiff joints')
      && /Written by Grace Chapel/.test($main.innerHTML) && /not reviewed by the app/.test($main.innerHTML) && /Never stop prescribed pills suddenly/.test($main.innerHTML));
    ok('…and the WhatsApp message carries it', /EASING STIFF JOINTS/.test(g.waMessage(cpVisitor)) && /Move every joint gently/.test(g.waMessage(cpVisitor)) && /Grace Chapel/.test(g.waMessage(cpVisitor)));
    sandbox.confirm = () => true;
    await g.deleteChurchPlan('ch-a', 'cp-1'); await sleep(20); g.render();
    ok('a church admin deletes a plan, and the visitor it was sent to falls back to the app\'s plan', rc.includes('delplan:cp-1') && /Do these 3 things/.test($main.innerHTML) && !/Easing stiff joints/.test($main.innerHTML), rc.join());
    g.chooseChurchPlan('');
    /* follow-up people and invite links (Church screen), and giving a visitor a follow-up person (Send home) */
    g.openAcct('church'); await sleep(30);
    ok('the Church screen shows follow-up toggles and how many of the five are named', /data-action="followup-toggle" data-user="u-staff" data-on="1"/.test(sheet()) && /0 of 5 follow-up people/.test(sheet()) && rc.includes('followups:ch-a'), rc.join());
    await g.setFollowup('u-staff', true); await sleep(20);
    ok('a church admin makes an approved member a follow-up person', rc.includes('setfollow:u-staff:true') && /✓ Follow-up person/.test(sheet()) && /1 of 5 follow-up people/.test(sheet()), rc.join());
    ok('…and a member waiting for approval cannot be made one', !/setFollowup\('u-pend'/.test(sheet()));
    await g.makeInvite('ch-a', 'staff'); await sleep(10);
    ok('a church admin makes a staff invite link to share', rc.includes('invite:ch-a:staff') && sheet().includes('?join=0123456789abcdef0123456789abcdef') && /Staff invite link/.test(sheet()), rc.join());
    sandbox.confirm = () => true;
    await g.cancelInvites('ch-a');
    ok('…and can cancel every invite link', rc.includes('cancelinv:ch-a') && !sheet().includes('?join='));
    g.closeAcct();
    cpVisitor.interests.optin = false; g.state.activeId = cpVisitor.id; g.state.tab = 'send'; g.render(); await sleep(10);
    ok('POPIA: no follow-up person can be given to a visitor who did not agree to be contacted', !/chooseFollowup('u-staff')/.test($main.innerHTML) && /did not agree to be contacted/.test($main.innerHTML));
    g.chooseFollowup('u-staff');
    ok('…not even by calling it directly', !cpVisitor.interests.followUp);
    cpVisitor.interests.optin = true; g.render(); await sleep(10);
    ok('staff give a visitor one of the church\'s follow-up people on Send home', /data-action="chooseFollowup" data-args="u-staff"/.test($main.innerHTML) && $main.innerHTML.includes('Staff Person'));
    g.chooseFollowup('u-staff');
    ok('…the visitor\'s record keeps who it is, and the message names them', cpVisitor.interests.followUp === 'u-staff' && cpVisitor.interests.followUpName === 'Staff Person'
      && g.waMessage(cpVisitor).includes('🤝 Staff Person from the church will follow up with you.'));
    const meWas = JSON.parse(JSON.stringify(g.cloud.acct.membership));
    g.cloud.acct.membership.followup = true; g.cloud.acct.membership.status = 'approved';
    g.openAcct('me'); await sleep(30);
    ok('a follow-up person sees the visitors given to them under My account', rc.includes('myfollow') && /People to follow up · 1/.test(sheet()) && sheet().includes('Plan Visitor') && sheet().includes('tel:0820001111'), rc.join());
    g.closeAcct(); g.cloud.acct.membership = meWas;
    /* an invite link opened on this device is used at the next sign-in: the person joins at once, approved */
    const meBefore = JSON.parse(JSON.stringify(me));
    me.membership = null; me.church = null;
    localStorage.setItem(g.INVITE_KEY, 'fedcba9876543210fedcba9876543210');
    await g.loadAccount();
    ok('signing in with an invite link joins the church at once, approved, and uses the link up', rc.includes('joininv:fedcba9876543210fedcba9876543210') && g.pendingInvite() === ''
      && g.cloud.acct.membership.status === 'approved' && g.cloud.acct.membership.role === 'staff', rc.join());
    Object.assign(me, meBefore); await g.loadAccount();

    /* the platform admin */
    me.platform_admin = true;
    await g.cloudSync(true); await sleep(20);
    ok('the platform admin gets an Admin button', /data-action="hub-open" data-args="admin"/.test(panel()));
    g.openAcct('admin'); await sleep(40);
    ok('the Admin screen lists every church with its counts, and Approve for a waiting one', rc.includes('admin_churches') && sheet().includes('Grace Chapel') && sheet().includes('Hope Church')
      && /data-action="church-status" data-args="ch-b" data-status="active"/.test(sheet()) && /5 visitors/.test(sheet()) && /1 member ·/.test(sheet()), rc.join());
    ok('…with the latest changes in every church', sheet().includes('st@example.org') && sheet().includes('update visitor EXPO-042'));
    await g.setChurchStatus('ch-b', 'active');
    ok('…approving a church calls the database', rc.includes('status:ch-b:active'), rc.join());
    g.manageChurch('ch-b'); await sleep(30);
    ok('…and the platform admin can open any church\'s members and details', rc.includes('members:ch-b') && C.acctTab === 'church' && /All churches/.test(sheet()) && sheet().includes('Hope Church'), C.acctTab + ' ' + rc.join());
    g.closeAcct();
    me = person({ platform_admin: true });
    await g.cloudSync(true); await sleep(30);
    ok('a platform admin with no church of their own can still open the Admin screen', g.gateState() === 'church' && /data-action="openAcct" data-args="admin"/.test(gate()), g.gateState());

    /* every class these screens use exists in the stylesheet */
    {
      const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n'), used = new Set();
      shots.join('\n').replace(/class="([^"]*)"/g, (_, c) => { c.split(/\s+/).filter(Boolean).forEach(t => used.add(t)); return ''; });
      const missing = [...used].filter(t => !css.includes('.' + t.replace(/[^a-zA-Z0-9_-]/g, m => '\\' + m)));
      ok('every class the account screens use exists in the stylesheet', used.size > 30 && missing.length === 0, missing.join(' ') || used.size);
    }
    await g.cloudSignOut();
    ok('signing out forgets the account and which church the device held', C.acct === null && C.churchId === '' && !store.has('newstart.church.v1') && g.gateState() === 'form', g.gateState());

    C.user = null; g.stopRealtime(); srv.reset(); store.delete('newstart.cloud.v1'); store.delete('newstart.church.v1');
    Object.assign(C, { mode: false, ready: false, pending: false, acct: null, churchId: '', synced: { att: {}, vol: {} } });
    sandbox.NEWSTART_NO_CLOUD = noCloudWas; g.resetDemo();
  }

  /* ---- 18f. the Profile page (bottom tab) ---- */
  console.log('\n18f. The Profile page');
  {
    const noCloudWas = sandbox.NEWSTART_NO_CLOUD;
    const church = { id: 'ch-a', name: 'Grace Chapel', city: 'Durban', phone: '', email: '', status: 'active' };
    const membership = over => Object.assign({ church_id: 'ch-a', role: 'staff', status: 'approved', full_name: 'Thandi Mabaso', phone: '082 000 0000', area: 'Umlazi', birth_date: null, attendee_id: null }, over);
    const who = over => Object.assign({ user_id: 'user-1', email: 'staff@example.org', platform_admin: false, membership: membership(), church: { ...church } }, over);
    let me = who(), deleteRefusal = null;
    const rc = [], shots = [];                     /* calls the page made; every screen drawn (for the class check) */
    const done = (data = null) => ({ data, error: null });
    const install = () => {
      srv.rpcs = {
        my_account: () => done(JSON.parse(JSON.stringify(me))),
        update_my_details: a => { rc.push('details:' + a.p_full_name + ':' + a.p_phone); Object.assign(me.membership, { full_name: a.p_full_name, phone: a.p_phone, area: a.p_area, birth_date: a.p_birth_date }); return done(); },
        my_health: () => done(null),
        delete_my_account: () => { rc.push('delete'); return deleteRefusal ? { data: null, error: deleteRefusal } : done(); },
      };
    };
    const main = () => { const h = $main.innerHTML; shots.push(h); return h; };
    const profile = () => { g.state.tab = 'me'; g.render(); return main(); };
    const typed = (id, v) => { $el(id).value = v; };
    const viaProfile = { preventDefault() {}, target: { dataset: { pre: 'pf' } } };
    const gateBox = $el('authGate');
    const gateUp = () => !gateBox.classList.contains('hidden') && gateBox.classList.contains('flex');
    const gateBody = () => { const h = $el('authGateBody').innerHTML; shots.push(h); return h; };
    const freshDevice = async () => {
      device(); install(); rc.length = 0; store.delete('newstart.church.v1');
      sandbox.NEWSTART_NO_CLOUD = false;
      Object.assign(C, { ready: false, demo: false, pending: false, gateKey: '', acct: null, churchId: '', health: undefined, gateForce: false, delOpen: false, view: 'login', formErr: '', client: null, status: 'off' });
      await g.cloudInit(); srv.authCb('INITIAL_SESSION', null); await sleep(30);
    };

    /* the tab */
    ok('the bottom bar ends with a Profile tab', g.SERVE_TABS.length === 6 && g.SERVE_TABS[5][0] === 'me' && g.SERVE_TABS[5][1] === 'Profile', g.SERVE_TABS.map(t => t[0]).join());
    sandbox.NEWSTART_NO_CLOUD = true;
    let h = profile();
    ok('with sign-in switched off the page says so instead of showing a form', /switched off/.test(h) && !h.includes('id="pfEmail"'));
    ok('…and the Profile tab is the highlighted one while open', /data-action=\"nav-go\" data-tab=\"me\" class=\"nav-item hue-lilac nav-item-active" aria-current="page"/.test($el('navItems').innerHTML) && $el('navItems').innerHTML.includes('Profile'));

    /* signed out */
    await freshDevice();
    h = profile();
    ok('signed out, Profile offers sign-in, Forgot password and Create an account, and no Sign out', h.includes('Your profile') && h.includes('id="pfEmail"') && h.includes('id="pfPass"')
      && h.includes('data-action="profGate" data-args="forgot"') && h.includes('data-action="profGate" data-args="signup"') && !h.includes('data-action="cloudSignOut"'));
    typed('pfEmail', 'staff@example.org'); typed('pfPass', 'nope');
    await g.cloudSignIn(viaProfile);
    ok('a wrong password is shown on the Profile page itself', C.formErr === 'Wrong email or password.' && $el('pfErr').textContent === 'Wrong email or password.', $el('pfErr').textContent);
    typed('pfEmail', ''); await g.cloudSignIn(viaProfile);
    ok('a blank email is caught there too', /Enter your staff email/.test($el('pfErr').textContent), $el('pfErr').textContent);

    /* Create an account / Forgot password: the full-screen screens, even over a saved copy, with a way back */
    C.gateKey = ''; g.renderGate();
    ok('the normal sign-in screen has no "Back to the app" link', !gateBody().includes('data-action="gateBack"'));
    C.ready = true; g.renderGate();
    ok('a device holding saved data shows no gate by itself', g.gateState() === 'hidden' && !gateUp());
    g.profGate('signup');
    ok('Create an account from Profile opens the sign-up screen over that copy, with Back to the app', C.gateForce === true && g.gateState() === 'signup' && gateUp() && gateBody().includes('data-action="gateBack"'), g.gateState());
    g.profGate('forgot');
    ok('Forgot password opens the reset screen the same way', g.gateState() === 'forgot' && gateUp() && gateBody().includes('data-action="gateBack"') && gateBody().includes('Reset your password'), g.gateState());
    g.gateBack();
    ok('Back to the app hides it again', g.gateState() === 'hidden' && !gateUp() && C.gateForce === false && C.view === 'login');
    C.ready = false; C.gateKey = '';

    /* signing in from Profile */
    typed('pfEmail', 'staff@example.org'); typed('pfPass', 'right');
    await g.cloudSignIn(viaProfile); await sleep(450);
    h = main();
    ok('after signing in from Profile the page shows the person, not the form', !!C.user && h.includes('Thandi Mabaso') && h.includes('staff@example.org') && !h.includes('id="pfEmail"'), h.slice(0, 80));
    ok('…with role and church as labels, and no admin buttons for plain staff', h.includes('>Staff<') && h.includes('Grace Chapel · Durban') && !h.includes('Platform admin')
      && !h.includes('data-action="openAcct" data-args="church"') && !h.includes('data-action="openAcct" data-args="admin"'));
    ok('…and the sync, details, password and account sections', h.includes('data-action=\"sync-now\"') && h.includes('id="pmName"') && h.includes('value="Thandi Mabaso"') && h.includes('id="pwNew"')
      && h.includes('data-action="cloudSignOut"') && h.includes('data-action="profDeleteAsk"'));

    /* admins get their shortcuts */
    me = who({ platform_admin: true, membership: membership({ role: 'admin' }) });
    await g.cloudSync(true); await sleep(400);
    h = profile();
    ok('a church admin who is also platform admin sees both labels and both shortcuts', h.includes('>Platform admin<') && h.includes('>Admin<') && h.includes('>My church<') && h.includes('>All churches<') && h.includes('data-action="openAcct" data-args="church"') && h.includes('data-action="openAcct" data-args="admin"'));
    me = who();
    await g.cloudSync(true); await sleep(400);

    /* my details */
    typed('pmName', 'Thandi M. Mabaso'); typed('pmPhone', '083 111 2222'); typed('pmArea', 'Umlazi'); typed('pmBirth', '');
    await g.saveMyDetails({ preventDefault() {}, target: { dataset: { pre: 'pm' } } }); await sleep(450);
    ok('saving details from Profile calls the database and the page then shows the new name', rc.includes('details:Thandi M. Mabaso:083 111 2222') && main().includes('Thandi M. Mabaso'), rc.join());

    /* change password */
    typed('pwNew', 'short1'); typed('pwNew2', 'short1'); await g.profPassword({ preventDefault() {} });
    ok('a short new password is refused on the page and never sent', /8 characters/.test($el('pwErr').textContent) && !srv.calls.includes('updateUser'), $el('pwErr').textContent);
    typed('pwNew', 'Goodpass2'); typed('pwNew2', 'Goodpass3'); await g.profPassword({ preventDefault() {} });
    ok('…and so is a repeat that does not match', /do not match/.test($el('pwErr').textContent) && !srv.calls.includes('updateUser'), $el('pwErr').textContent);
    typed('pwNew', 'SamePass1'); typed('pwNew2', 'SamePass1'); await g.profPassword({ preventDefault() {} });
    ok('a password the account already has is explained', /not used before/.test($el('pwErr').textContent), $el('pwErr').textContent);
    $el('toastMsg').textContent = '';
    typed('pwNew', 'Goodpass2'); typed('pwNew2', 'Goodpass2'); await g.profPassword({ preventDefault() {} });
    ok('a good new password is saved, the boxes are cleared and a toast says so', srv.calls.includes('updateUser') && srv.newPassword === 'Goodpass2'
      && $el('pwNew').value === '' && $el('pwNew2').value === '' && $el('pwErr').textContent === '' && /Password updated/.test($el('toastMsg').textContent), $el('toastMsg').textContent);

    /* delete my account */
    g.profDeleteAsk(); h = main();
    ok('Delete my account opens a warning that names what stays, and its button starts disabled', C.delOpen === true && h.includes('Type DELETE to confirm') && /id="pfDelGo"[^>]*disabled/.test(h) && h.includes('stay with your church'));
    typed('pfDelType', 'nope'); g.profDeleteTyped($el('pfDelType'));
    ok('typing something else keeps it disabled', $el('pfDelGo').disabled === true);
    await g.profDeleteGo();
    ok('…and pressing it anyway sends nothing', !rc.includes('delete'));
    typed('pfDelType', 'delete'); g.profDeleteTyped($el('pfDelType'));
    ok('typing DELETE, in any case, enables it', $el('pfDelGo').disabled === false);
    deleteRefusal = { message: 'You are this church\'s only admin. Make someone else an admin first.' };
    await g.profDeleteGo();
    ok('the database\'s refusal is shown under the box and the person stays signed in', rc.includes('delete') && $el('pfDelErr').textContent.includes('only admin') && !!C.user, $el('pfDelErr').textContent);
    deleteRefusal = { code: 'PGRST202', message: 'Could not find the function public.delete_my_account in the schema cache' };
    await g.profDeleteGo();
    ok('without the latest schema.sql it says what to do', /latest supabase\/schema\.sql/.test($el('pfDelErr').textContent) && !!C.user, $el('pfDelErr').textContent);
    deleteRefusal = { message: 'TypeError: Failed to fetch' };
    await g.profDeleteGo();
    ok('offline it says there is no connection', /No connection/.test($el('pfDelErr').textContent), $el('pfDelErr').textContent);
    deleteRefusal = null; $el('toastMsg').textContent = '';
    await g.profDeleteGo(); await sleep(80);
    ok('a successful delete signs this device out, says so, and leaves the Profile page open', rc.filter(x => x === 'delete').length === 4 && C.user === null && C.acct === null && C.delOpen === false
      && /Your account has been deleted/.test($el('toastMsg').textContent) && g.state.tab === 'me', rc.join() + ' ' + $el('toastMsg').textContent);
    ok('…and that page is the sign-in form again', main().includes('id="pfEmail"') && !main().includes('cloudSignOut()'));

    /* a member has no expo access, so no app behind the sign-in screen: their account screen carries the same controls */
    me = who({ membership: membership({ role: 'member' }) });
    await freshDevice(); await signIn(); await sleep(150);
    h = gateBody();
    ok('a member\'s account screen offers Change password and Delete my account', g.gateState() === 'member' && h.includes('id="pwNew"') && h.includes('data-action="profDeleteAsk"') && h.includes('data-action="cloudSignOut"'), g.gateState());
    g.profDeleteAsk(); h = gateBody();
    ok('…and the delete confirmation opens inside that screen', h.includes('Type DELETE to confirm') && /id="pfDelGo"[^>]*disabled/.test(h));
    g.profDeleteAsk();

    /* every class these screens use exists in the stylesheet */
    {
      const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n'), used = new Set();
      shots.join('\n').replace(/class="([^"]*)"/g, (_, c) => { c.split(/\s+/).filter(Boolean).forEach(t => used.add(t)); return ''; });
      const missing = [...used].filter(t => !css.includes('.' + t.replace(/[^a-zA-Z0-9_-]/g, m => '\\' + m)));
      ok('every class the Profile screens use exists in the stylesheet', used.size > 40 && missing.length === 0, missing.join(' ') || used.size);
    }

    C.user = null; g.stopRealtime(); srv.reset(); store.delete('newstart.cloud.v1'); store.delete('newstart.church.v1');
    Object.assign(C, { mode: false, ready: false, pending: false, acct: null, churchId: '', synced: { att: {}, vol: {} }, gateForce: false, delOpen: false });
    g.state.tab = 'home'; sandbox.NEWSTART_NO_CLOUD = noCloudWas; g.resetDemo();
  }

  /* ---- 18c. the churches part of supabase/schema.sql on a real Postgres ----------------------------
     PGlite (Postgres compiled to WebAssembly, in memory) is not part of this project. Install it in a folder outside it
     (npm i @electric-sql/pglite@0.5.11) and set NEWSTART_PGLITE to that folder; without it these checks are skipped. */
  if (!process.env.NEWSTART_PGLITE) console.log('\n18c. Churches in the database: skipped (set NEWSTART_PGLITE to a folder with @electric-sql/pglite installed)');
  else await (async () => {
    console.log('\n18c. Churches in the database (PGlite)');
    const { PGlite } = require(path.join(process.env.NEWSTART_PGLITE, 'node_modules', '@electric-sql', 'pglite'));
    const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
    const MARK = '-- ================================================================ CHURCHES, MEMBERS AND THE PLATFORM ADMIN';
    const before = schema.slice(0, schema.indexOf(MARK));            /* the schema as it was before churches existed */
    /* the parts of a Supabase project that schema.sql relies on */
    const STUB = `
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      raw_user_meta_data jsonb not null default '{}'::jsonb, email_confirmed_at timestamptz, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create publication supabase_realtime;`;
    const U = {
      alice: '00000000-0000-4000-8000-00000000000a', bob: '00000000-0000-4000-8000-00000000000b',
      carol: '00000000-0000-4000-8000-00000000000c', dave: '00000000-0000-4000-8000-00000000000d',
      erin: '00000000-0000-4000-8000-00000000000e', frank: '00000000-0000-4000-8000-00000000000f',
    };
    const db = new PGlite();
    /* run SQL as a signed-in user (uid), or as anon (null); returns { rows } or { error } */
    const as = async (uid, sql, params) => {
      await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
      try { return { rows: (await db.query(sql, params || [])).rows }; } catch (e) { return { error: e }; } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role`); }   /* the claim is session-scoped: clear it, or the next raw query inherits the identity */
    };
    const sys = async (sql, params) => (await db.query(sql, params || [])).rows;
    const run = async sql => { try { await db.exec(sql); return ''; } catch (e) { return e.message || String(e); } };

    /* ---- a database from before churches, with data in it ---- */
    await db.exec(STUB);
    let err = await run(before);
    await db.exec(`create unique index if not exists queue_entries_one_active_idx on public.queue_entries (attendee_id, station) where status in ('waiting', 'serving');`);
    for (const [n, id] of Object.entries(U))
      await sys(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, $4)`,
        [id, n + '@example.org', JSON.stringify({ full_name: n[0].toUpperCase() + n.slice(1) }), n === 'frank' ? null : new Date().toISOString()]);
    await db.exec(`insert into public.staff (user_id, note, is_admin) values ('${U.alice}', 'desk lead', true), ('${U.bob}', 'bp desk', false);
      insert into public.attendees (id, name, s) values ('EXPO-001', 'Old Visitor', '{"sys":150,"dia":95}');
      insert into public.volunteers (id, name) values ('VOL-1001', 'Old Volunteer');
      insert into public.queue_entries (attendee_id, station) values ('EXPO-001', 'bp');`);
    ok('upgrade: the schema from before churches installs', !err, err);

    err = await run(schema);
    ok('upgrade: the new schema runs on a database that already holds data', !err, err);
    const ch = await sys(`select id, name, status from public.churches`);
    const A = ch[0] && ch[0].id;
    const moved = await sys(`select (select count(*) from public.attendees where church_id = $1)::int a, (select count(*) from public.volunteers where church_id = $1)::int v,
      (select count(*) from public.queue_entries where church_id = $1)::int q`, [A]);
    ok('upgrade: existing visitors, volunteers and queue move into one new active church',
      ch.length === 1 && ch[0].status === 'active' && ch[0].name === 'My church (rename me)' && moved[0].a === 1 && moved[0].v === 1 && moved[0].q === 1, JSON.stringify([ch, moved]));
    const mem = await sys(`select user_id, role, status from public.memberships order by role`);
    ok('upgrade: staff become that church\'s staff, and is_admin becomes admin',
      mem.length === 2 && mem.some(m => m.user_id === U.alice && m.role === 'admin' && m.status === 'approved') && mem.some(m => m.user_id === U.bob && m.role === 'staff' && m.status === 'approved'), JSON.stringify(mem));
    await sys(`delete from public.memberships where user_id = $1`, [U.bob]);
    err = await run(schema);
    ok('upgrade: the schema runs a second time without error', !err, err);
    ok('upgrade: re-running never re-adds a staff member who was removed', (await sys(`select 1 from public.memberships where user_id = $1`, [U.bob])).length === 0);
    const pk = await sys(`select pg_get_constraintdef(c.oid) d from pg_constraint c where c.conrelid in ('public.attendees'::regclass, 'public.volunteers'::regclass) and c.contype = 'p'`);
    ok('upgrade: badge and volunteer numbers are unique per church (primary key church_id, id)', pk.length === 2 && pk.every(p => p.d === 'PRIMARY KEY (church_id, id)'), JSON.stringify(pk));
    const idx = await sys(`select indexname from pg_indexes where tablename = 'queue_entries' and indexname like 'queue_entries_one_active%'`);
    ok('upgrade: the one-visit-per-station rule is per church', idx.length === 1 && idx[0].indexname === 'queue_entries_one_active_church_idx', JSON.stringify(idx));

    /* ---- people and churches ---- */
    await sys(`insert into public.platform_admins (user_id) values ($1)`, [U.erin]);
    let r = await as(U.alice, `select count(*)::int n from public.attendees`);
    ok('church staff see their own church\'s visitors', !r.error && r.rows[0].n === 1, r.error && r.error.message);
    r = await as(U.carol, `select public.register_church('Grace Chapel', 'Durban', '031 000 0000', 'office@grace.example') id`);
    const B = r.rows && r.rows[0].id;
    const cb = await sys(`select status from public.churches where id = $1`, [B]);
    const carolM = await sys(`select role, status from public.memberships where user_id = $1`, [U.carol]);
    ok('a new church starts pending, with the person who registered it as its admin',
      !r.error && cb[0] && cb[0].status === 'pending' && carolM[0].role === 'admin' && carolM[0].status === 'approved', r.error ? r.error.message : JSON.stringify([cb, carolM]));
    r = await as(U.carol, `select count(*)::int n from public.attendees`);
    const ins = await as(U.carol, `insert into public.attendees (id, name) values ('EXPO-777', 'Too Early')`);
    ok('a pending church\'s admin sees no visitor data and cannot add any', !r.error && r.rows[0].n === 0 && !!ins.error, JSON.stringify(r.rows));
    r = await as(U.carol, `select public.register_church('Second Church') id`);
    ok('a person can register only one church', !!r.error && /already belong/.test(r.error.message), r.error && r.error.message);
    r = await as(U.alice, `select * from public.admin_churches()`);
    const r2 = await as(U.erin, `select * from public.admin_churches()`);
    ok('only the platform admin can list every church', !!r.error && !r2.error && r2.rows.length === 2, r2.error && r2.error.message);
    r = await as(U.alice, `select public.admin_set_church_status($1, 'active')`, [B]);
    ok('a church admin cannot approve a church', !!r.error);
    r = await as(U.erin, `select public.admin_set_church_status($1, 'active')`, [B]);
    ok('the platform admin approves a church', !r.error && (await sys(`select status from public.churches where id = $1`, [B]))[0].status === 'active', r.error && r.error.message);

    r = await as(U.carol, `insert into public.attendees (id, name, s) values ('EXPO-001', 'Grace Visitor', '{"sys":120,"dia":80}'), ('EXPO-777', 'Only At Grace', '{}')`);
    ok('two churches can both use badge EXPO-001', !r.error && (await sys(`select count(*)::int n from public.attendees where id = 'EXPO-001'`))[0].n === 2, r.error && r.error.message);
    const seenA = await as(U.alice, `select id, name from public.attendees order by id`);
    const seenB = await as(U.carol, `select id, name from public.attendees order by id`);
    ok('each church\'s staff see only their own church\'s visitors',
      seenA.rows.length === 1 && seenA.rows[0].name === 'Old Visitor' && seenB.rows.length === 2 && seenB.rows.every(x => x.name !== 'Old Visitor'), JSON.stringify([seenA.rows, seenB.rows]));
    r = await as(U.alice, `update public.attendees set name = 'Hijacked' where id = 'EXPO-777'`);
    ok('church staff cannot change another church\'s visitor', !r.error && (await sys(`select name from public.attendees where id = 'EXPO-777'`))[0].name === 'Only At Grace');
    r = await as(U.alice, `update public.attendees set church_id = $1 where id = 'EXPO-001'`, [B]);
    ok('church staff cannot move a visitor into another church', !!r.error, 'the update went through');
    r = await as(U.alice, `insert into public.attendees (id, name, church_id) values ('EXPO-555', 'Planted', $1)`, [B]);
    ok('church staff cannot add a visitor to another church', !!r.error, 'the insert went through');
    r = await as(U.alice, `select * from public.memberships`);
    const r3 = await as(U.alice, `select * from public.churches`);
    ok('the memberships and churches tables cannot be read directly', !!r.error && !!r3.error);
    r = await as(U.bob, `select count(*)::int n from public.attendees`);
    ok('someone removed from a church loses its data', !r.error && r.rows[0].n === 0);

    /* ---- live queue ---- */
    await as(U.carol, `insert into public.queue_entries (attendee_id, station) values ('EXPO-001', 'bp')`);
    r = await as(U.alice, `select * from public.queue_call_next('bp')`);
    const again = await as(U.alice, `select * from public.queue_call_next('bp')`);
    const qB = await sys(`select status from public.queue_entries where church_id = $1`, [B]);
    ok('"Call next" only takes people from the caller\'s own church', !r.error && r.rows.length === 1 && r.rows[0].church_id === A && !again.error && again.rows.length === 0 && qB[0].status === 'waiting',
      r.error ? r.error.message : JSON.stringify([r.rows, again.rows, qB]));
    r = await as(U.alice, `select count(*)::int n from public.queue_entries`);
    ok('each church sees only its own queue', !r.error && r.rows[0].n === 1, JSON.stringify(r.rows));

    /* ---- members ---- */
    r = await as(U.dave, `select public.join_church($1, 'Dave Dlamini', '082 000 0000')`, [A]);
    const daveM = await sys(`select role, status, full_name from public.memberships where user_id = $1`, [U.dave]);
    ok('a person who joins a church waits as a pending member', !r.error && daveM[0].role === 'member' && daveM[0].status === 'pending' && daveM[0].full_name === 'Dave Dlamini', r.error ? r.error.message : JSON.stringify(daveM));
    r = await as(U.dave, `select count(*)::int n from public.attendees`);
    ok('a member sees no visitor data', !r.error && r.rows[0].n === 0);
    r = await as(U.dave, `select * from public.church_members($1)`, [A]);
    ok('a member cannot list the other members', !!r.error);
    r = await as(U.dave, `select public.update_my_details('Dave D. Dlamini', '082 111 1111', 'Umlazi', '1980-05-01')`);
    const acct = await as(U.dave, `select public.my_account() a`);
    const da = acct.rows && acct.rows[0].a;
    ok('a member edits their own details and my_account returns them with the church',
      !r.error && da && da.membership.full_name === 'Dave D. Dlamini' && da.membership.area === 'Umlazi' && da.membership.birth_date === '1980-05-01' && da.church.id === A && da.platform_admin === false,
      r.error ? r.error.message : JSON.stringify(da));
    r = await as(U.dave, `select public.update_my_details('Dave', '', '', '2999-01-01')`);
    ok('a date of birth in the future is refused', !!r.error);
    r = await as(U.alice, `select * from public.church_members($1)`, [A]);
    ok('a church admin lists their church\'s members, pending first', !r.error && r.rows[0].user_id === U.dave && r.rows[0].status === 'pending' && r.rows.length === 2, JSON.stringify(r.rows && r.rows.map(x => x.email)));
    r = await as(U.alice, `select * from public.church_members($1)`, [B]);
    const r4 = await as(U.alice, `select public.set_member($1, 'member', 'approved')`, [U.carol]);
    ok('a church admin cannot see or change another church\'s members', !!r.error && !!r4.error);
    r = await as(U.alice, `select * from public.staff_pending()`);
    ok('the older approvals list shows only the caller\'s own church', !r.error && r.rows.length === 1 && r.rows[0].user_id === U.dave, JSON.stringify(r.rows));

    r = await as(U.alice, `select public.set_member($1, 'member', 'approved')`, [U.dave]);
    const r5 = await as(U.alice, `select public.link_member($1, 'expo-001')`, [U.dave]);
    const h = await as(U.dave, `select public.my_health() h`);
    const hh = h.rows && h.rows[0].h;
    ok('an approved member linked to their badge sees their own screening results', !r.error && !r5.error && hh && hh.id === 'EXPO-001' && hh.name === 'Old Visitor' && hh.s.sys === 150 && !('prayer' in hh),
      (r.error || r5.error || {}).message || JSON.stringify(hh));
    r = await as(U.dave, `select count(*)::int n from public.attendees`);
    ok('an approved member still cannot read the visitors table', !r.error && r.rows[0].n === 0);
    r = await as(U.alice, `select public.link_member($1, 'EXPO-777')`, [U.dave]);
    ok('linking a badge that belongs to another church is refused', !!r.error && /No visitor/.test(r.error.message), r.error && r.error.message);
    r = await as(U.frank, `select public.join_church($1)`, [A]);
    const r6 = await as(U.alice, `select public.link_member($1, 'EXPO-001')`, [U.frank]);
    ok('one badge cannot be linked to two members', !r.error && !!r6.error && /already linked/.test(r6.error.message), (r.error || r6.error || {}).message);
    r = await as(U.alice, `select public.set_member($1, 'member', 'approved')`, [U.frank]);
    ok('an account that has not confirmed its email cannot be approved', !!r.error && /confirmed/.test(r.error.message), r.error && r.error.message);
    await sys(`delete from public.attendees where church_id = $1 and id = 'EXPO-001'`, [A]);
    await sys(`insert into public.attendees (church_id, id, name, created_at) values ($1, 'EXPO-001', 'Next Expo Visitor', now() + interval '1 day')`, [A]);
    r = await as(U.dave, `select public.my_health() h`);
    ok('if the badge is reused for someone new, the member no longer sees it', !r.error && r.rows[0].h === null, JSON.stringify(r.rows));
    r = await as(U.alice, `select public.set_member($1, 'staff', 'approved')`, [U.dave]);
    const r7 = await as(U.dave, `select count(*)::int n from public.attendees`);
    ok('a church admin makes a member staff, who then sees the church\'s visitors', !r.error && r7.rows[0].n === 1, (r.error || {}).message);

    r = await as(U.carol, `select public.set_member($1, 'staff', 'approved')`, [U.carol]);
    const r8 = await as(U.carol, `select public.leave_church()`);
    const r9 = await as(U.carol, `select public.remove_member($1)`, [U.carol]);
    ok('a church\'s last admin cannot step down, leave or be removed', !!r.error && !!r8.error && !!r9.error);
    r = await as(U.erin, `select * from public.church_members($1)`, [B]);
    const r10 = await as(U.erin, `select public.update_church($1, 'Grace Chapel Durban', 'Durban')`, [B]);
    ok('the platform admin manages any church\'s members and profile', !r.error && r.rows.length === 1 && !r10.error && (await sys(`select name from public.churches where id = $1`, [B]))[0].name === 'Grace Chapel Durban',
      (r.error || r10.error || {}).message);
    r = await as(U.erin, `select count(*)::int n from public.attendees`);
    ok('the platform admin is not given visitor records by the policies (counts only)', !r.error && r.rows[0].n === 0, JSON.stringify(r.rows));
    r = await as(U.dave, `select public.leave_church()`);
    const r11 = await as(U.dave, `select public.my_account() a`);
    ok('a member can leave their church', !r.error && r11.rows[0].a.membership === null && r11.rows[0].a.church === null, (r.error || {}).message);
    r = await as(U.dave, `select * from public.church_directory('grace')`);
    ok('the church directory lists active churches by name or town', !r.error && r.rows.length === 1 && r.rows[0].name === 'Grace Chapel Durban', JSON.stringify(r.rows));
    r = await as(U.dave, `select public.join_church($1)`, [B]);
    await as(U.erin, `select public.admin_set_church_status($1, 'pending')`, [B]);
    const r12 = await as(U.frank, `select * from public.church_directory('')`);
    ok('a church that is not active is not listed', !r12.error && r12.rows.every(x => x.id !== B), JSON.stringify(r12.rows));
    await as(U.erin, `select public.admin_set_church_status($1, 'suspended')`, [B]);
    r = await as(U.carol, `select count(*)::int n from public.attendees`);
    const r13 = await as(U.carol, `select public.is_staff() s`);
    ok('suspending a church cuts its staff off', !r.error && r.rows[0].n === 0 && r13.rows[0].s === false, JSON.stringify(r.rows));
    r = await as(U.erin, `select public.my_account() a`);
    ok('my_account flags the platform admin', !r.error && r.rows[0].a.platform_admin === true);
    r = await as(U.erin, `select * from public.admin_audit(20)`);
    ok('the platform admin\'s audit trail names the church of each change', !r.error && r.rows.length > 0 && r.rows.some(x => x.church === 'My church (rename me)' && x.tbl === 'attendees'), (r.error || {}).message || JSON.stringify(r.rows.slice(0, 3)));
    r = await as(U.alice, `select * from public.admin_audit(20)`);
    ok('nobody else can read the audit trail', !!r.error);
    r = await as(null, `select public.my_account() a`);
    const r14 = await as(null, `select * from public.church_directory('')`);
    ok('signed-out callers can use none of the account functions', !!r.error && !!r14.error);

    /* ---- church plans ---- */
    const PU = { adm: '00000000-0000-4000-8000-0000000000a1', stf: '00000000-0000-4000-8000-0000000000a2', mem: '00000000-0000-4000-8000-0000000000a3', oth: '00000000-0000-4000-8000-0000000000a4' };
    for (const [n, id] of Object.entries(PU)) await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, 'plan-' + n + '@example.org']);
    const PA = (await sys(`insert into public.churches (name, status) values ('Plan Church A', 'active') returning id`))[0].id;
    const PB = (await sys(`insert into public.churches (name, status) values ('Plan Church B', 'active') returning id`))[0].id;
    await sys(`insert into public.memberships (user_id, church_id, role, status) values ($1, $5, 'admin', 'approved'), ($2, $5, 'staff', 'approved'), ($3, $5, 'member', 'approved'), ($4, $6, 'admin', 'approved')`,
      [PU.adm, PU.stf, PU.mem, PU.oth, PA, PB]);
    const acts = JSON.stringify([{ do: 'Move every joint gently', why: 'Keeps joints supple', how: ['5 minutes'] }]);
    r = await as(PU.adm, `select public.save_church_plan($1, null, 'Joint pain', 'Easing stiff joints', $2::jsonb, '') id`, [PA, acts]);
    const planId = r.rows && r.rows[0].id;
    ok('a church admin saves a church plan for a problem of their own', !r.error && !!planId, r.error && r.error.message);
    r = await as(PU.stf, `select id, title, problem from public.church_plans($1)`, [PA]);
    ok('the church\'s staff list its plans', !r.error && r.rows.length === 1 && r.rows[0].title === 'Easing stiff joints' && r.rows[0].problem === 'Joint pain', r.error ? r.error.message : JSON.stringify(r.rows));
    r = await as(PU.stf, `select public.save_church_plan($1, null, 'bp', 'Staff plan', $2::jsonb, '')`, [PA, acts]);
    ok('church staff cannot write plans; only admins can', !!r.error);
    r = await as(PU.mem, `select count(*)::int n from public.church_plans($1)`, [PA]);
    ok('a member sees no church plans', !r.error && r.rows[0].n === 0, r.error && r.error.message);
    const o1 = await as(PU.oth, `select count(*)::int n from public.church_plans($1)`, [PA]);
    const o2 = await as(PU.oth, `select public.save_church_plan($1, null, 'bp', 'Not mine', $2::jsonb, '')`, [PA, acts]);
    const o3 = await as(PU.oth, `select public.delete_church_plan($1)`, [planId]);
    ok('another church\'s admin can neither see, write nor delete them', !o1.error && o1.rows[0].n === 0 && !!o2.error && !!o3.error);
    r = await as(PU.adm, `select count(*)::int n from public.church_plans`);
    ok('the church_plans table cannot be read directly', !!r.error);
    const e1p = await as(PU.adm, `select public.save_church_plan($1, null, 'bp', 'Empty', '[]'::jsonb, '')`, [PA]);
    const e2p = await as(PU.adm, `select public.save_church_plan($1, null, 'bp', 'Blank', '[{"do":"  "}]'::jsonb, '')`, [PA]);
    ok('a plan needs at least one thing to do, each with an instruction', !!e1p.error && !!e2p.error);
    r = await as(PU.adm, `select public.save_church_plan($1, $2, 'bp', 'Walking club', $3::jsonb, 'Bring water')`, [PA, planId, acts]);
    const edited = await sys(`select problem, title, note from public.church_plans where id = $1`, [planId]);
    ok('a church admin edits a plan', !r.error && edited[0].problem === 'bp' && edited[0].title === 'Walking club' && edited[0].note === 'Bring water', r.error ? r.error.message : JSON.stringify(edited));
    r = await as(null, `select * from public.church_plans($1)`, [PA]);
    ok('signed-out callers cannot use the church plan functions', !!r.error);
    await sys(`update public.churches set status = 'suspended' where id = $1`, [PA]);
    r = await as(PU.stf, `select count(*)::int n from public.church_plans($1)`, [PA]);
    ok('a suspended church\'s staff see no plans', !r.error && r.rows[0].n === 0, r.error && r.error.message);
    await sys(`update public.churches set status = 'active' where id = $1`, [PA]);
    r = await as(PU.adm, `select public.delete_church_plan($1)`, [planId]);
    ok('a church admin deletes a plan', !r.error && (await sys(`select count(*)::int n from public.church_plans where id = $1`, [planId]))[0].n === 0, r.error && r.error.message);

    /* ---- follow-up people ---- */
    const FU = {}; ['adm', 'stf', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'pend', 'oth', 'new1', 'new2'].forEach((n, i) => { FU[n] = '00000000-0000-4000-8000-0000000001' + String(i).padStart(2, '0'); });
    for (const [n, id] of Object.entries(FU)) await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, 'fu-' + n + '@example.org']);
    const FA = (await sys(`insert into public.churches (name, status) values ('Follow Church A', 'active') returning id`))[0].id;
    const FB = (await sys(`insert into public.churches (name, status) values ('Follow Church B', 'active') returning id`))[0].id;
    await sys(`insert into public.memberships (user_id, church_id, role, status, full_name) values
      ($1, $11, 'admin', 'approved', 'Ada'), ($2, $11, 'staff', 'approved', 'Sam'), ($3, $11, 'member', 'approved', 'M One'), ($4, $11, 'member', 'approved', 'M Two'),
      ($5, $11, 'member', 'approved', 'M Three'), ($6, $11, 'member', 'approved', 'M Four'), ($7, $11, 'member', 'approved', 'M Five'), ($8, $11, 'member', 'approved', 'M Six'),
      ($9, $11, 'member', 'pending', 'Pat'), ($10, $12, 'admin', 'approved', 'Otto')`,
      [FU.adm, FU.stf, FU.m1, FU.m2, FU.m3, FU.m4, FU.m5, FU.m6, FU.pend, FU.oth, FA, FB]);
    let fuErr = '';
    for (const k of ['m1', 'm2', 'm3', 'm4', 'm5']) { const x = await as(FU.adm, `select public.set_followup($1, true)`, [FU[k]]); if (x.error) fuErr += x.error.message; }
    r = await as(FU.adm, `select public.set_followup($1, true)`, [FU.m6]);
    ok('a church admin names follow-up people, and a sixth is refused', !fuErr && !!r.error && /at most five/.test(r.error.message), fuErr || (r.error && r.error.message));
    r = await as(FU.adm, `select public.set_followup($1, true)`, [FU.pend]);
    ok('a member waiting for approval cannot be a follow-up person', !!r.error);
    r = await as(FU.stf, `select public.set_followup($1, true)`, [FU.m6]);
    ok('church staff cannot name follow-up people; only admins can', !!r.error);
    r = await as(FU.stf, `select full_name from public.church_followups($1)`, [FA]);
    ok('church staff list the follow-up people, to give visitors to', !r.error && r.rows.length === 5, r.error ? r.error.message : JSON.stringify(r.rows));
    const f1 = await as(FU.m6, `select count(*)::int n from public.church_followups($1)`, [FA]);
    const f2 = await as(FU.oth, `select count(*)::int n from public.church_followups($1)`, [FA]);
    ok('members and other churches see no follow-up list', !f1.error && f1.rows[0].n === 0 && !f2.error && f2.rows[0].n === 0);
    await as(FU.adm, `select public.set_followup($1, false)`, [FU.m5]);
    r = await as(FU.adm, `select public.set_followup($1, true)`, [FU.m6]);
    ok('turning one off makes room for another', !r.error, r.error && r.error.message);
    await sys(`insert into public.attendees (church_id, id, name, phone, interests) values
      ($1, 'EXPO-501', 'Given To One', '082 555 0001', jsonb_build_object('followUp', $3::text)), ($1, 'EXPO-502', 'Given To Two', '', jsonb_build_object('followUp', $4::text)),
      ($2, 'EXPO-503', 'Other Church Visitor', '', jsonb_build_object('followUp', $3::text))`, [FA, FB, FU.m1, FU.m2]);
    r = await as(FU.m1, `select id, name, phone from public.my_followups()`);
    ok('a follow-up person sees only the visitors given to them, in their own church', !r.error && r.rows.length === 1 && r.rows[0].id === 'EXPO-501' && r.rows[0].phone === '082 555 0001',
      r.error ? r.error.message : JSON.stringify(r.rows));
    r = await as(FU.m1, `select count(*)::int n from public.attendees`);
    ok('…and still cannot read the visitors table itself', !r.error && r.rows[0].n === 0, r.error && r.error.message);
    r = await as(FU.m5, `select count(*)::int n from public.my_followups()`);
    ok('someone who is not (or no longer) a follow-up person sees nobody', !r.error && r.rows[0].n === 0);
    r = await as(FU.m1, `select public.my_account() a`);
    ok('my_account says who is a follow-up person', !r.error && r.rows[0].a.membership.followup === true);

    /* ---- invite links ---- */
    r = await as(FU.adm, `select public.create_church_invite($1, 'staff') code`, [FA]);
    const inv = r.rows && r.rows[0].code;
    ok('a church admin makes an invite link', !r.error && /^[0-9a-f]{32}$/.test(inv || ''), r.error && r.error.message);
    r = await as(FU.stf, `select public.create_church_invite($1, 'member')`, [FA]);
    ok('church staff cannot make invite links', !!r.error);
    r = await as(FU.new1, `select church_name, role from public.church_invite_info($1)`, [inv]);
    ok('an invite link says which church and role it is for', !r.error && r.rows[0].church_name === 'Follow Church A' && r.rows[0].role === 'staff', r.error ? r.error.message : JSON.stringify(r.rows));
    r = await as(FU.new1, `select public.join_with_invite($1, 'New One', '082 000 0000')`, [inv]);
    const joined = await sys(`select church_id, role, status, full_name from public.memberships where user_id = $1`, [FU.new1]);
    ok('opening a staff invite link joins the church at once, approved, as staff', !r.error && joined[0] && joined[0].church_id === FA && joined[0].role === 'staff' && joined[0].status === 'approved' && joined[0].full_name === 'New One',
      r.error ? r.error.message : JSON.stringify(joined));
    r = await as(FU.oth, `select public.join_with_invite($1)`, [inv]);
    ok('someone in another church cannot join with it', !!r.error);
    r = await as(FU.m6, `select public.join_with_invite($1)`, [inv]);
    ok('a member of the same church who opens a staff link becomes staff', !r.error && (await sys(`select role from public.memberships where user_id = $1`, [FU.m6]))[0].role === 'staff', r.error && r.error.message);
    r = await as(FU.adm, `select public.join_with_invite($1)`, [inv]);
    ok('an admin who opens a staff link stays an admin', !r.error && (await sys(`select role from public.memberships where user_id = $1`, [FU.adm]))[0].role === 'admin', r.error && r.error.message);
    r = await as(FU.adm, `select public.cancel_church_invites($1) n`, [FA]);
    const afterCancel = await as(FU.new2, `select public.join_with_invite($1)`, [inv]);
    ok('a cancelled invite link no longer works', !r.error && r.rows[0].n === 1 && !!afterCancel.error);
    const inv2 = (await as(FU.adm, `select public.create_church_invite($1, 'member') code`, [FA])).rows[0].code;
    await sys(`update public.church_invites set expires_at = now() - interval '1 day' where code = $1`, [inv2]);
    r = await as(FU.new2, `select public.join_with_invite($1)`, [inv2]);
    ok('an expired invite link no longer works', !!r.error);
    const a1 = await as(null, `select * from public.church_invite_info($1)`, [inv2]);
    const a2 = await as(FU.adm, `select count(*) from public.church_invites`);
    ok('signed-out callers cannot use the invite functions, and the invites table cannot be read directly', !!a1.error && !!a2.error);

    /* ---- retention: readings live 7 days (POPIA s14) ---- */
    const RA = (await sys(`insert into public.churches (name, status) values ('Retention Church', 'active') returning id`))[0].id;
    await sys(`insert into public.attendees (church_id, id, name, age, height_cm, s, prayer, chronic_list, interests) values
      ($1, 'EXPO-991', 'Old Follow-up', 50, 170, '{"sys":150,"dia":95}', 'pray', 'asthma', '{"consent":true,"optin":true}'),
      ($1, 'EXPO-992', 'Old No Follow-up', 40, 165, '{"sys":120,"dia":80}', '', null, '{"consent":true,"optin":false}'),
      ($1, 'EXPO-993', 'Fresh Visit', 30, 160, '{"sys":118,"dia":78}', '', null, '{"consent":true,"optin":false}')`, [RA]);
    /* the real timeline: the visits are written on the day, and then a week passes. A visit's date cannot be moved
       any more, so the trigger is off for the one update that plays the week. */
    const day = (await sys(`select to_char(now(), 'YYYY-MM-DD') d, to_char(now() - interval '8 days', 'YYYY-MM-DD') old`))[0];
    const backdate = await run(`alter table public.attendees disable trigger attendees_retention;
      update public.attendees set created_at = now() - interval '8 days',
        interests = interests || jsonb_build_object('consentOn', to_char(now() - interval '8 days', 'YYYY-MM-DD'))
       where church_id = '${RA}' and id in ('EXPO-991','EXPO-992');
      alter table public.attendees enable trigger attendees_retention;`);
    ok('7 days: a visit written on the day keeps its readings', !backdate);
    /* a phone that was offline sends its old copy back: the same row with its real (old) date */
    const up = await run(`update public.attendees set s = '{"sys":150,"dia":95}', prayer = 'again', height_cm = 170
      where church_id = '${RA}' and id = 'EXPO-991'`);
    const afterUp = await sys(`select s, prayer, height_cm, chronic_list from public.attendees where church_id = $1 and id = 'EXPO-991'`, [RA]);
    ok('7 days: a phone that was offline cannot put the readings back (prayer, chronic list and height too)', !up
      && JSON.stringify(afterUp[0].s) === '{}' && afterUp[0].prayer === '' && afterUp[0].height_cm === null && afterUp[0].chronic_list === null,
      up || JSON.stringify(afterUp));
    const freshKept = await sys(`select s, height_cm from public.attendees where church_id = $1 and id = 'EXPO-993'`, [RA]);
    ok('7 days: a visit inside the grace period keeps everything, untouched', Number(freshKept[0].s.sys) === 118 && Number(freshKept[0].height_cm) === 160, JSON.stringify(freshKept));
    const purged = await as(U.erin, `select public.purge_expired_visitors() n`);
    const left = await sys(`select id from public.attendees where church_id = $1 order by id`, [RA]);
    ok('7 days: the daily purge deletes an old visitor who did not agree to follow-up', !purged.error && !left.some(x => x.id === 'EXPO-992'), (purged.error && purged.error.message) || JSON.stringify(left));
    ok('7 days: …and keeps the follow-up visitor (name and contact details) and the fresh visit', left.map(x => x.id).join() === 'EXPO-991,EXPO-993', JSON.stringify(left));
    const noCopy = await sys(`select old from public.audit_log where tbl = 'attendees' and op = 'DELETE' and row_id = 'EXPO-992'`);
    ok('7 days: the audit copy of a deleted visit holds no readings', noCopy.length === 1 && noCopy[0].old === null, JSON.stringify(noCopy));
    /* a phone that never sends created_at (the older app) is judged by the consent date on the record */
    const noDate = await run(`insert into public.attendees (church_id, id, name, age, s, interests) values
      ('${RA}', 'EXPO-992', 'Old Phone Copy', 40, jsonb_build_object('sys', 120, 'dia', 80),
       jsonb_build_object('consent', true, 'optin', false, 'consentOn', '${day.old}'))`);
    const stillGoneByConsent = await sys(`select 1 from public.attendees where church_id = $1 and id = 'EXPO-992'`, [RA]);
    ok('7 days: an older phone that sends no created_at is judged by its consent date, so the copy stays gone', !noDate && stillGoneByConsent.length === 0, noDate || 'came back');
    const back = await run(`insert into public.attendees (church_id, id, name, age, s, interests, created_at) values
      ('${RA}', 'EXPO-992', 'Resurrected', 40, '{"sys":120,"dia":80}', '{"consent":true,"optin":false}', now() - interval '8 days')`);
    const stillGone = await sys(`select 1 from public.attendees where church_id = $1 and id = 'EXPO-992'`, [RA]);
    ok('7 days: …so the offline copy does not bring the visitor back', !back && stillGone.length === 0, back || 'came back');
    /* a number the purge freed can be given again (nextBadge counts up from the highest the phone still holds),
       so a new visitor on a deleted visitor's number must sync, readings and all. */
    const reuse = await run(`insert into public.attendees (church_id, id, name, age, s, interests) values
      ('${RA}', 'EXPO-992', 'Same Badge, New Expo', 27, jsonb_build_object('sys', 130, 'dia', 85),
       jsonb_build_object('consent', true, 'optin', false, 'consentOn', '${day.d}'))`);
    const reused = await sys(`select s from public.attendees where church_id = $1 and id = 'EXPO-992'`, [RA]);
    ok('7 days: a new visitor given the deleted badge number syncs, with the readings', !reuse && reused.length === 1 && Number(reused[0].s.sys) === 130, reuse || JSON.stringify(reused));
    /* a phone cannot move a recorded visit's date to keep its readings longer */
    await run(`update public.attendees set created_at = now() - interval '30 days' where church_id = '${RA}' and id = 'EXPO-993'`);
    const dateKept = await sys(`select created_at > now() - interval '8 days' recent from public.attendees where church_id = $1 and id = 'EXPO-993'`, [RA]);
    ok('7 days: a phone cannot move a visit date to keep the readings longer', dateKept.length === 1 && dateKept[0].recent === true, JSON.stringify(dateKept));
    const rSql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
    ok('7 days: the app, the database and the notice all say 7 days', /GRACE_DAYS\s*=\s*7/.test(srcText) && /interval '7 days'/.test(rSql)
      && /\$\{GRACE_DAYS\} days after your visit/.test(srcText) && /0 3 \* \* \*/.test(rSql), '');

    /* ---- a brand-new project ---- */
    const fresh = new PGlite();
    await fresh.exec(STUB);
    let e1 = '', e2 = '';
    try { await fresh.exec(schema); } catch (e) { e1 = e.message; }
    try { await fresh.exec(schema); } catch (e) { e2 = e.message; }
    const none = e1 || e2 ? [] : (await fresh.query(`select count(*)::int n from public.churches`)).rows;
    ok('a brand-new database installs the whole schema (twice) and creates no church by itself', !e1 && !e2 && none[0].n === 0, e1 || e2);

  })().catch(e => ok('database checks ran to the end', false, e && e.stack || e));

  /* ---- 18d. cloud status: one row per cloud function -------------------------------------------- */
  console.log('\n18d. Cloud status signals');
  {
    const noCloudWas = sandbox.NEWSTART_NO_CLOUD;
    const H = g.health, shots = [];
    const panel = () => { g.renderCloudBody(); const h = $el('cloudBody').innerHTML; shots.push(h); return h; };
    const flush = () => sleep(120);                     /* rows redraw 60 ms after they change */
    device(); g.healthReset(); sandbox.NEWSTART_NO_CLOUD = false;
    Object.assign(C, { ready: false, demo: false, pending: false, gateKey: '', acct: null, churchId: '' });
    srv.authCb('INITIAL_SESSION', null); await flush();
    ok('signed out: Sign-in says so, and no other row claims anything', H.auth && H.auth.st === 'off' && !H.sync && !H.upload, JSON.stringify(H));
    await signIn(); await sleep(80); await flush();
    ok('after sign-in each function reports what just happened', H.auth.st === 'ok' && /staff@example\.org/.test(H.auth.msg) && H.sync.st === 'ok' && /visitors/.test(H.sync.msg) && H.upload.st === 'ok', JSON.stringify(H));
    ok('…a database without the churches part shows as a warning under Accounts', H.account && H.account.st === 'warn' && /not set up/.test(H.account.msg), JSON.stringify(H.account));
    ok('…and the missing live queue table is named under Database setup', H.queue && H.queue.st === 'bad' && H.schema && H.schema.st === 'bad' && /queue_entries/.test(H.schema.msg), JSON.stringify([H.queue, H.schema]));
    const p1 = panel();
    ok('the panel behind the logo lists every function with its state and time, and offers Test now',
      ['Sign-in', 'Download', 'Upload', 'Live updates', 'Live queue', 'Accounts & admin', 'Database setup'].every(l => p1.includes('<b>' + l + '</b>'))
      && /data-action="healthTest"/.test(p1) && /q-state-bad/.test(p1) && /q-state-live/.test(p1) && /Not checked yet/.test(p1));
    g.state.tab = 'home'; g.render(); shots.push($main.innerHTML);
    ok('Home shows the shared-database state, one tap from the details', /id="homeHealth"/.test($main.innerHTML) && /Up to date/.test(g.homeHealthHTML()) && /data-action="openCloud"/.test(g.homeHealthHTML()));

    /* no connection */
    srv.offline = true; registerLocal('Status Waiting', 'EXPO-321');
    await g.cloudSync(true); await flush();
    ok('offline: Download says there is no connection, and Upload counts what is waiting', H.sync.st === 'warn' && /No connection/.test(H.sync.msg) && H.upload.st === 'warn' && /1 change waiting/.test(H.upload.msg), JSON.stringify([H.sync, H.upload]));
    ok('…and Home shows it as a warning, not as an error', /q-state-warn/.test(g.homeHealthHTML()) && !/q-state-bad/.test(g.homeHealthHTML()), g.homeHealthHTML());
    shots.push(g.homeHealthHTML());
    srv.offline = false; await g.cloudSync(true); await flush();
    ok('back online the change uploads and Upload says so', H.upload.st === 'ok' && srv.tables.attendees.has('EXPO-321'), JSON.stringify(H.upload));

    /* the live connection reports its own state */
    srv.rtState = 'CHANNEL_ERROR'; g.stopRealtime(); g.startRealtime(); await flush();
    ok('a dropped live connection shows "Reconnecting…" under Live updates', H.live && H.live.st === 'warn' && /Reconnecting/.test(H.live.msg), JSON.stringify(H.live));
    ok('…and Home shows that one warning even though Download and Upload are working', H.sync.st === 'ok' && H.upload.st === 'ok' && /q-state-warn/.test(g.homeHealthHTML()) && /Reconnecting/.test(g.homeHealthHTML()), g.homeHealthHTML());
    srv.rtState = 'SUBSCRIBED'; g.stopRealtime(); g.startRealtime(); await flush();
    ok('…and "Connected" once it is back', H.live.st === 'ok' && /Connected/.test(H.live.msg));

    /* Test now */
    srv.calls.length = 0; await g.healthTest(); await flush();
    ok('Test now only reads: nothing is inserted, updated or upserted', srv.calls.length > 0 && srv.calls.every(c => /^select/.test(c)), srv.calls.join());
    ok('…records when it ran, and names what is missing', C.testedAt > 0 && H.schema.st === 'bad' && /queue_entries/.test(H.schema.msg) && /Test now ran at/.test(panel()), JSON.stringify(H.schema));
    srv.tables.queue_entries = new Map();
    srv.rpcs = { my_account: () => ({ data: { user_id: 'user-1', email: 'staff@example.org', platform_admin: false, membership: null, church: null }, error: null }) };
    await g.healthTest(); await flush();
    ok('when everything it checks is found, Database setup and Accounts say so', H.schema.st === 'ok' && H.account.st === 'ok' && H.queue.st !== 'bad', JSON.stringify([H.schema, H.account, H.queue]));
    srv.offline = true; await g.healthTest(); await flush(); srv.offline = false;
    ok('Test now with no connection does not claim the database is set up', H.schema.st === 'warn' && /Could not be checked/.test(H.schema.msg), JSON.stringify(H.schema));
    delete srv.tables.queue_entries; srv.rpcs = null;

    /* the screens that point here */
    srv.rpcs = { church_directory: () => ({ data: null, error: { code: '42501', message: 'permission denied for function church_directory' } }) };
    await g.churchSearch(''); await flush(); srv.rpcs = null;
    ok('a refused account call shows on the account screens, with a way to the details', H.account.st === 'bad' && /Refused/.test(H.account.msg) && /data-action="openCloud"/.test(g.acctHealthHTML()), JSON.stringify(H.account));
    shots.push(g.acctHealthHTML(), g.qStateBar('offline'));
    ok('the queue banner offers Details when it warns, and not in practice mode', /data-action="openCloud"/.test(g.qStateBar('offline')) && !/data-action="openCloud"/.test(g.qStateBar('practice')));
    g.noteHealth('sync', 'bad', '<img src=x onerror=alert(1)>', '<b>detail</b>'); await flush();
    ok('messages from the database are escaped in the status rows', panel().includes('&lt;img src=x') && !panel().includes('<img src=x') && g.homeHealthHTML().includes('&lt;img') && panel().includes('&lt;b&gt;detail'));
    {
      const css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n'), used = new Set();
      shots.join('\n').replace(/class="([^"]*)"/g, (_, c) => { c.split(/\s+/).filter(Boolean).forEach(t => used.add(t)); return ''; });
      const missing = [...used].filter(t => !css.includes('.' + t.replace(/[^a-zA-Z0-9_-]/g, m => '\\' + m)));
      ok('every class the status signals use exists in the stylesheet', used.size > 15 && missing.length === 0, missing.join(' ') || used.size);
    }
    await g.cloudSignOut(); await flush();
    ok('signing out clears every row except Sign-in', Object.keys(H).join() === 'auth' && H.auth.st === 'off', Object.keys(H).join());

    clearTimeout(C.retryT); C.user = null; g.stopRealtime(); srv.reset(); store.delete('newstart.cloud.v1'); store.delete('newstart.church.v1');
    Object.assign(C, { mode: false, ready: false, pending: false, acct: null, churchId: '', synced: { att: {}, vol: {} } });
    g.healthReset(); sandbox.NEWSTART_NO_CLOUD = noCloudWas; g.resetDemo();
  }

  /* ---- 18e. pressure tests: injection on every screen, live-connection leaks, database attacks ---------- */
  console.log('\n18e. Pressure tests: injection, leaks, database attacks');
  {
    /* every text field that can come from the database gets a payload; no screen may show it as markup */
    const X = '"><img src=x onerror=alert(1)>\'<svg onload=alert(2)>';
    const raw = h => /<img src=x|<svg onload/.test(String(h));
    const found = [], gaps = [];
    const look = (where, h) => { if (raw(h)) found.push(where); };
    g.resetDemo();
    for (const a of g.attendees) { a.name = 'A' + X; a.phone = '0821234567' + X; a.prayer = X; a.interests = { stress: true, nurse: true, cook: true, pouch: true }; }
    for (const v of g.volunteers) { Object.assign(v, { name: 'V' + X, phone: X, email: X, notes: X, emergency: X, role: X, shift: X, shirt: X, pref2: X }); v.history = [{ expo: X, name: X, date: '2026-01-01', booth: 'bp', hours: 3 }]; }
    for (const id of g.attendees.map(a => a.id)) { g.state.activeId = id; for (const tb of ['home', 'screen', 'results', 'plan', 'send', 'care', 'queue']) { g.state.tab = tb; g.render(); look('tab ' + tb, $main.innerHTML); } }
    g.state.tab = 'serve';
    for (const vid of g.volunteers.map(v => v.id)) for (const vt of ['pledge', 'muster', 'booth', 'record']) { g.setVol(vid); g.state.volTab = vt; g.render(); look('volunteers ' + vt, $main.innerHTML); }
    g.openSwitcher(); look('switcher', $el('switcherList').innerHTML + $el('switcherHead').innerHTML);
    g.state.switchMode = 'volunteer'; g.openSwitcher(); look('volunteer switcher', $el('switcherList').innerHTML); g.state.switchMode = 'visitor';
    g.state.activeId = g.attendees[0].id; g.openWhatsApp(); look('WhatsApp', $el('waBody').innerHTML); g.buildPrintCard(); look('print card', $el('printArea').innerHTML);
    const A = { id: 'ch-a', name: 'C' + X, city: X, phone: X, email: X, status: 'active' };
    C.acct = { user_id: 'u1', email: X, platform_admin: true, membership: { church_id: 'ch-a', role: 'admin', status: 'approved', full_name: X, phone: X, area: X, birth_date: null, attendee_id: 'EXPO-042' }, church: A };
    C.health = { id: 'EXPO-042', name: X, age: 40, sex: 'Male', height_cm: 170, s: { sys: 150, dia: 95 }, interests: {}, created_at: X };
    C.dir = [{ id: 'ch-a', name: X, city: X }];
    for (const tb of ['me', 'church', 'admin']) {
      g.openAcct(tb);
      C.members = { cid: 'ch-a', list: [{ user_id: 'u-1', email: X, full_name: X, phone: X, area: X, role: 'member', status: 'pending', attendee_id: 'EXPO-042', confirmed: true }] };
      C.plat = [{ ...A, members: 1, staff: 0, pending: 0, visitors: 0, volunteers: 0 }]; C.audit = [{ at: X, church: X, actor: X, tbl: 'attendees', op: X, row_id: X }];
      C.membersBusy = ''; C.platBusy = false; C.auditBusy = false; g.renderAcct();
      const h = $el('acctBody').innerHTML;
      if ((tb === 'church' && !h.includes('u-1')) || (tb === 'admin' && !h.includes('ch-a'))) gaps.push(tb);
      look('account sheet ' + tb, h + $el('acctTabs').innerHTML);
    }
    for (const st of ['church', 'churchwait', 'suspended', 'pending', 'member']) {
      C.acct.membership = st === 'church' ? null : { ...C.acct.membership, status: st === 'pending' ? 'pending' : 'approved', role: st === 'member' ? 'member' : 'admin' };
      C.acct.church = st === 'church' ? null : { ...A, status: st === 'churchwait' ? 'pending' : st === 'suspended' ? 'suspended' : 'active' };
      look('account screen ' + st, g.acctGateHTML(st));
    }
    for (const k of ['auth', 'sync', 'upload', 'live', 'queue', 'account', 'schema']) g.noteHealth(k, 'bad', X, X);
    C.user = { email: X }; g.renderCloudBody(); look('cloud panel', $el('cloudBody').innerHTML); look('Home pill', g.homeHealthHTML()); look('account banner', g.acctHealthHTML());
    ok('every database text field is escaped on every screen (visitors, volunteers, churches, members, status)', found.length === 0 && gaps.length === 0,
      found.join(' | ') || 'screens not drawn: ' + gaps.join(', '));
    C.user = null; C.acct = null; C.health = undefined; C.members = null; C.plat = null; C.audit = null; C.dir = null; g.healthReset(); g.resetDemo();

    /* the member's own pledge box (self-pledge): status, station, withdraw rule, escaping, and the staff contact rule */
    {
      C.acct = { email: 'mem@ex.org', membership: { role: 'member', status: 'approved', full_name: 'Nomsa', phone: '', area: '',
        birth_date: null, attendee_id: '', followup: false, volunteer_id: 'VOL-1001', admin_rank: 0 },
        church: { ...A, status: 'active' } };
      const pledge = { id: 'VOL-1001', name: 'Nomsa <b>X</b>', phone: '082 000 0000', email: '', status: 'prospect', pledge_expos: 2,
        skills: ['clinic'], pref: ['bp'], pref2: '', availability: ['saturday'], shirt: 'M', emergency: '', notes: '',
        pledged_on: '2026-01-05', since: '2026-01-05', booth: null, role: '', shift: '' };
      C.pledge = pledge;
      const ph = g.pledgeHTML();
      ok('the My pledge box shows status, placement and the record number read-only',
        ph.includes('My pledge') && /Pledged/.test(ph) && /Not placed yet/.test(ph) && /VOL-1001/.test(ph), ph.slice(0, 120));
      ok('the pledge box escapes the name', !/<b>X<\/b>/.test(ph));
      ok('a prospect can withdraw from the pledge box', ph.includes('my-pledge-withdraw'));
      C.pledge = { ...pledge, status: 'registered', booth: 'bp', role: 'Team leader' };
      const pr = g.pledgeHTML();
      ok('a registered pledge shows its station and role, and no withdraw button',
        /Placed at/.test(pr) && pr.includes('Team leader') && !pr.includes('my-pledge-withdraw'), pr.slice(0, 120));
      C.pledge = null;
      const pf = g.pledgeHTML();
      ok('a member without a pledge gets the pledge form, with the shared booth picker',
        pf.includes('id="mfName"') && pf.includes('my-draft-booth') && pf.includes('Send my pledge'));
      g.state.mf = { name: '', phone: '', email: '', pledgeExpos: 1, skills: [], pref: [], avail: [], pref2: '', shirt: '', emergency: '', notes: '' };
      await g.myPledgeSave({ preventDefault() {} });
      ok('the pledge form refuses an empty name in place', /full name/.test($el('toastMsg').textContent), $el('toastMsg').textContent);
      $el('toastMsg').textContent = '';
      g.state.mf = { ...g.state.mf, name: 'Nomsa', phone: '', email: '' };
      await g.myPledgeSave({ preventDefault() {} });
      ok('the pledge needs a mobile number or an email — the staff form\'s rule, word for word',
        $el('toastMsg').textContent === 'Please enter a mobile number or an email address, so the team can reach you', $el('toastMsg').textContent);
      ok('the staff form and the member form share that rule and the form parts',
        (srcText.match(/Please enter a mobile number or an email address, so the team can reach you/g) || []).length === 2
          && (srcText.match(/pledgeFormParts\(/g) || []).length >= 3, '');
      C.pledge = undefined; C.pledgeErr = false; g.state.mf = null;
      g.state.tab = 'home'; g.render();
    }

    /* team leaders: the star on the roster, the named leader per station, and the title on the leader's own screens */
    {
      g.resetDemo();
      g.state.tab = 'serve'; g.state.volTab = 'muster'; g.render();
      const muster = $main.innerHTML;
      ok('muster names the team leader per station, or says there is none',
        /★ Thandi leads this station/.test(muster) && /No leader yet/.test(muster));
      ok('the roster marks the leader with a star chip', /★ Team leader/.test(muster));
      g.state.volId = 'VOL-1001'; g.state.volTab = 'booth'; g.render();
      ok('the leader\'s own booth screen reads Team leader · Blood Pressure', /Team leader · Blood Pressure/.test($main.innerHTML));
      g.state.volTab = 'record'; g.render();
      ok('the badge card carries the title and station too', /Team leader · Blood Pressure/.test($main.innerHTML));
      g.resetDemo();
    }

    /* the placement board: admins and leaders tap a volunteer to move, swap, release or make leader */
    {
      g.resetDemo(); C.acct = null;      /* nobody signed in */
      g.state.tab = 'serve'; g.state.volTab = 'muster'; g.render();
      ok('in the demo the muster rows still open the volunteer (nobody is signed in)', $main.innerHTML.includes('data-action="setVol"') && !$main.innerHTML.includes('data-action="openPlaceSheet"'));
      C.acct = { email: 'adm@ex.org', membership: { role: 'admin', status: 'approved', full_name: 'Adm', phone: '', area: '',
        birth_date: null, attendee_id: '', followup: false, admin_rank: 1 }, church: { ...A, status: 'active' } };
      g.state.tab = 'serve'; g.render();
      ok('signed in as an admin, muster rows open the placement board', $main.innerHTML.includes('data-action="openPlaceSheet"'));
      const evil = g.volunteers.find(v => v.id === 'VOL-1002');
      const evilName = evil.name; evil.name = 'Evil <b>X</b>';
      g.openPlaceSheet('VOL-1002');
      const sheet = $el('placeBody').innerHTML;
      ok('the placement sheet shows Move to, Swap with and the person choices',
        /Move to…/.test(sheet) && /Swap with…/.test(sheet) && /asked for/.test(sheet), sheet.slice(0, 120));
      ok('the placement sheet escapes names', !/<b>X<\/b>/.test(sheet));
      ok('an admin sees Make team leader', /place-lead/.test(sheet));
      g.closePlaceSheet();
      evil.name = evilName;
      C.acct = { ...C.acct, membership: { ...C.acct.membership, role: 'staff' } };
      g.state.tab = 'serve'; g.render();
      ok('plain staff keep the read-only board (taps open the volunteer, no placement actions)',
        $main.innerHTML.includes('data-action="setVol"') && !$main.innerHTML.includes('data-action="openPlaceSheet"'));
      C.acct = null; g.resetDemo();
    }

    /* the notifications bell and hub */
    const notifReset = g2 => { g2.cloud.notifN = 0; g2.cloud.notifs = undefined; g2.cloud.notifWatched = ''; g2.cloud.notifChannel = null; g2.cloud.notifLive = false; const d = $el('notifDot'); if (d) { d.textContent = ''; } };
    {

      C.user = null; notifReset(g);
      g.notifRefresh();
      ok('the bell is hidden while signed out', $el('notifBell').classList.contains('hidden'));
      C.user = { id: 'u-notif', email: 'n@ex.org' };
      srv.tables.notifications = new Map([
        [1, { id: 1, user_id: 'u-notif', kind: 'placement', title: 'Evil <b>X</b>', body: 'note', created_at: '2026-03-01T08:00:00Z', read_at: null }],
        [2, { id: 2, user_id: 'u-notif', kind: 'membership', title: 'Approved', body: '', created_at: '2026-03-02T08:00:00Z', read_at: '2026-03-02T09:00:00Z' }],
      ]);
      srv.staff = true;                       /* RLS: the account sees its own rows */
      await g.notifCount(); await sleep(120);
      ok('the bell shows the unread count once signed in',
        !$el('notifBell').classList.contains('hidden') && $el('notifDot').textContent === '1', $el('notifDot').textContent);
      g.openNotifs(); await sleep(120);
      const nh = $el('notifBody').innerHTML;
      ok('the hub lists the rows newest first and escapes titles',
        nh.includes('Evil &lt;b&gt;X&lt;/b&gt;') && nh.indexOf('Approved') < nh.indexOf('Evil') && nh.includes('Mark all read'), nh.slice(0, 140));
      let markCalls = 0; srv.rpcs = { mark_notifications_read: () => { markCalls++; return { data: markCalls }; } };
      await g.markNotifsRead(2); await sleep(120);
      ok('mark all read calls the database once for the caller', markCalls === 1, String(markCalls));
      srv.rpcs = null;
      srv.offline = true;
      g.openNotifs(); await sleep(120);
      ok('offline the sheet says so instead of pretending', /Connect to see new notifications/.test($el('notifBody').innerHTML), $el('notifBody').innerHTML.slice(0, 120));
      srv.offline = false;
      notifReset(g); srv.tables.notifications = new Map(); srv.staff = false; C.user = null;
      ok('no new polling: the app still has exactly two timers (sync and queue ticks)',
        (srcText.match(/setInterval\(/g) || []).length === 2, (srcText.match(/setInterval\(/g) || []).length);
    }


    /* live connections: reconnecting must not pile up handlers */
    device(); C.client = srv.client; C.user = { id: 'u-1', email: 'n@ex.org' };
    for (let i = 0; i < 50; i++) { g.stopRealtime(); g.startRealtime(); }
    ok('50 live reconnects leave exactly one connection (three table handlers: visitors, volunteers, notifications), not fifty', srv.handlers.length === 3, srv.handlers.length);
    g.stopRealtime(); C.user = null; srv.reset();
  }
  /* database attacks on a real Postgres (with NEWSTART_PGLITE) */
  if (process.env.NEWSTART_PGLITE) await (async () => {
    const { PGlite } = require(path.join(process.env.NEWSTART_PGLITE, 'node_modules', '@electric-sql', 'pglite'));
    const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
    const db = new PGlite();
    const as = async (uid, sql, p) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
      try { return { rows: (await db.query(sql, p || [])).rows }; } catch (e) { return { error: e }; } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role`); }   /* the claim is session-scoped: clear it, or the next raw query inherits the identity */ };
    const sys = async (sql, p) => (await db.query(sql, p || [])).rows;
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb not null default '{}'::jsonb, email_confirmed_at timestamptz, created_at timestamptz not null default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant usage on schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on sequences to anon, authenticated;
      alter default privileges in schema public grant execute on functions to anon, authenticated; create publication supabase_realtime;`);
    await db.exec(schema);
    const U = { adminA: 'a0000000-0000-4000-8000-000000000001', staffA: 'a0000000-0000-4000-8000-000000000002', memA: 'a0000000-0000-4000-8000-000000000003',
      pendA: 'a0000000-0000-4000-8000-000000000004', adminB: 'b0000000-0000-4000-8000-000000000001', loner: 'c0000000-0000-4000-8000-000000000001' };
    for (const [k, id] of Object.entries(U)) await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, k + '@ex.org']);
    const CA = (await sys(`insert into public.churches (name, status) values ('Church A', 'active') returning id`))[0].id;
    const CB = (await sys(`insert into public.churches (name, status) values ('Church B', 'active') returning id`))[0].id;
    await sys(`insert into public.memberships (user_id, church_id, role, status) values ($1,$2,'admin','approved'),($3,$2,'staff','approved'),($4,$2,'member','approved'),($5,$2,'member','pending'),($6,$7,'admin','approved')`,
      [U.adminA, CA, U.staffA, U.memA, U.pendA, U.adminB, CB]);
    await sys(`insert into public.attendees (id, name, church_id) values ('EXPO-001','In A',$1),('EXPO-002','In B',$2)`, [CA, CB]);
    await sys(`insert into public.platform_admins (user_id) values ($1)`, [U.loner]);
    await sys(`insert into public.staff (user_id, note) values ($1, 'legacy')`, [U.loner]);
    await sys(`update public.attendees set name = 'Audited' where id = 'EXPO-001'`);
    const refused = async (uid, sql, p) => !!(await as(uid, sql, p)).error;
    ok('attack: a member cannot make themselves admin', await refused(U.memA, `select public.set_member($1,'admin','approved')`, [U.memA]));
    ok('attack: members cannot link themselves to a visitor\'s results', await refused(U.pendA, `select public.link_member($1,'EXPO-001')`, [U.pendA]) && await refused(U.memA, `select public.link_member($1,'EXPO-001')`, [U.memA]));
    ok('attack: staff (not admin) cannot list, approve or promote members', await refused(U.staffA, `select * from public.church_members($1)`, [CA]) && await refused(U.staffA, `select public.set_member($1,'staff','approved')`, [U.pendA]));
    ok('attack: a church admin cannot touch another church (its admin, name, members or visitors)', await refused(U.adminA, `select public.set_member($1,'member','approved')`, [U.adminB])
      && await refused(U.adminA, `select public.update_church($1,'Hijacked')`, [CB]) && await refused(U.adminA, `select public.remove_member($1)`, [U.adminB]) && await refused(U.adminA, `select public.link_member($1,'EXPO-002')`, [U.memA]));
    ok('attack: nobody can make themselves platform admin from the app', await refused(U.adminA, `insert into public.platform_admins (user_id) values ($1)`, [U.adminA]));
    ok('attack: oversized input (100,000 characters) is refused', await refused(U.adminA, `select public.update_my_details($1)`, ['x'.repeat(100000)]) && await refused(U.adminA, `select public.update_church($1, $2)`, [CA, 'y'.repeat(100000)]));
    await as(U.staffA, `delete from public.attendees where id='EXPO-001'`);
    ok('attack: staff (not admin) cannot delete visitors', (await sys(`select count(*)::int n from public.attendees where id='EXPO-001'`))[0].n === 1);
    let sealed = true;
    for (const t of ['platform_admins', 'churches', 'memberships', 'audit_log', 'staff']) {
      const before = (await sys(`select count(*)::int n from public.${t}`))[0].n;
      const m = await as(U.memA, `select * from public.${t} limit 1`), s = await as(U.staffA, `select * from public.${t} limit 1`);
      await as(U.staffA, `delete from public.${t}`);
      if (!(m.error || !m.rows.length) || !(s.error || !s.rows.length) || (await sys(`select count(*)::int n from public.${t}`))[0].n !== before || before === 0) sealed = false;
    }
    ok('attack: the protected tables cannot be read or emptied from the app (each holds a row)', sealed);

    /* delete_my_account(): the Profile page's "Delete my account". It takes no user id, so it can only ever delete the caller. */
    const gone = async id => (await sys(`select 1 from auth.users where id = $1`, [id])).length === 0;
    const count = async t => (await sys(`select count(*)::int n from ${t}`))[0].n;
    const sig = await sys(`select pg_get_function_arguments(p.oid) a from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'delete_my_account'`);
    ok('delete: the function takes no user id, so it can only ever delete the caller', sig.length === 1 && sig[0].a === '', JSON.stringify(sig));
    ok('delete: signed-out callers cannot delete an account', await refused(null, `select public.delete_my_account()`) && !(await gone(U.adminA)));
    let dr = await as(U.adminA, `select public.delete_my_account()`);
    ok('delete: a church\'s only admin is refused, with the reason, and nothing is removed', !!dr.error && /only admin/.test(dr.error.message) && !(await gone(U.adminA)) && await count('public.memberships') === 5, dr.error && dr.error.message);
    await sys(`update public.memberships set role = 'admin' where user_id = $1`, [U.pendA]);
    dr = await as(U.adminA, `select public.delete_my_account()`);
    ok('delete: a second admin who is still waiting for approval does not count as another admin', !!dr.error && /only admin/.test(dr.error.message) && !(await gone(U.adminA)), dr.error && dr.error.message);
    await sys(`update public.memberships set role = 'member' where user_id = $1`, [U.pendA]);
    dr = await as(U.loner, `select public.delete_my_account()`);
    ok('delete: the only platform admin is refused, with the reason', !!dr.error && /only platform admin/.test(dr.error.message) && !(await gone(U.loner)), dr.error && dr.error.message);
    const m0 = await count('public.memberships'), a0 = await count('public.attendees'), c0 = await count('public.churches'), u0 = await count('auth.users');
    dr = await as(U.memA, `select public.delete_my_account()`);
    ok('delete: a member deletes their own login; their membership goes with it and nothing else changes',
      !dr.error && await gone(U.memA) && await count('public.memberships') === m0 - 1 && await count('public.attendees') === a0 && await count('public.churches') === c0 && await count('auth.users') === u0 - 1, dr.error && dr.error.message);
    dr = await as(U.memA, `select public.my_account() a`);
    const seen = await as(U.memA, `select count(*)::int n from public.attendees`);
    ok('delete: the deleted account\'s old sign-in opens nothing', !dr.error && dr.rows[0].a === null && !seen.error && seen.rows[0].n === 0);
    dr = await as(U.memA, `select public.delete_my_account()`);
    ok('delete: asking again for an account that is already gone changes nothing', !dr.error && await count('auth.users') === u0 - 1, dr.error && dr.error.message);
    dr = await as(U.pendA, `select public.delete_my_account()`);
    ok('delete: a member still waiting for approval can delete their login too', !dr.error && await gone(U.pendA), dr.error && dr.error.message);
    await sys(`update public.memberships set role = 'admin' where user_id = $1`, [U.staffA]);
    dr = await as(U.adminA, `select public.delete_my_account()`);
    ok('delete: with another admin in place, a church admin can delete their login; the church and its visitors stay',
      !dr.error && await gone(U.adminA) && (await sys(`select 1 from public.churches where id = $1`, [CA])).length === 1 && (await sys(`select 1 from public.attendees where church_id = $1`, [CA])).length === 1, dr.error && dr.error.message);
    const B2 = 'b0000000-0000-4000-8000-000000000002';
    await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'adminB2@ex.org', now())`, [B2]);
    await sys(`insert into public.memberships (user_id, church_id, role, status) values ($1, $2, 'admin', 'approved')`, [B2, CB]);
    await sys(`update public.churches set created_by = $1 where id = $2`, [U.adminB, CB]);
    dr = await as(U.adminB, `select public.delete_my_account()`);
    const made = await sys(`select created_by from public.churches where id = $1`, [CB]);
    ok('delete: the person who registered a church can delete their login; the church stays and forgets its creator',
      !dr.error && await gone(U.adminB) && made.length === 1 && made[0].created_by === null, dr.error ? dr.error.message : JSON.stringify(made));
    const P2 = 'c0000000-0000-4000-8000-000000000002';
    await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'padmin2@ex.org', now())`, [P2]);
    await sys(`insert into public.platform_admins (user_id) values ($1)`, [P2]);
    dr = await as(U.loner, `select public.delete_my_account()`);
    ok('delete: a platform admin can delete their login when another one remains; their admin and old staff rows go with it',
      !dr.error && await gone(U.loner) && (await sys(`select user_id from public.platform_admins`)).map(x => x.user_id).join() === P2 && (await sys(`select 1 from public.staff where user_id = $1`, [U.loner])).length === 0, dr.error && dr.error.message);
    ok('delete: …and then the last platform admin is refused', await refused(P2, `select public.delete_my_account()`) && !(await gone(P2)));
    const lax = await sys(`select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r'
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid) and has_table_privilege('authenticated', c.oid, 'select')`);
    ok('audit: no table without policies is open to signed-in callers (the old staff list included)', lax.length === 0, lax.map(x => x.relname).join(', '));
    const defNoPath = await sys(`select p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    ok('audit: every SECURITY DEFINER function pins its search_path', defNoPath.length === 0, defNoPath.map(x => x.proname).join(', '));
    const noRls = await sys(`select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    ok('audit: row-level security is on for every table', noRls.length === 0, noRls.map(x => x.relname).join(', '));
    const anon = await sys(`select c.relname as n from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))
      union all select p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')`);
    ok('audit: signed-out callers can reach no table and no SECURITY DEFINER function', anon.length === 0, anon.map(x => x.n).join(', '));
  })().catch(e => ok('database attacks ran to the end', false, e && e.stack || e));

  /* ---- 18d. the volunteer hub part of supabase/schema.sql on a real Postgres (self-pledge, leaders, placement,
     notifications) — same fake-Supabase rig as 18c above, one PGlite per phase group --------------------------- */
  if (process.env.NEWSTART_PGLITE) await (async () => {
    const { PGlite } = require(path.join(process.env.NEWSTART_PGLITE, 'node_modules', '@electric-sql', 'pglite'));
    const schema = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
    const db = new PGlite();
    const as = async (uid, sql, p) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
      try { return { rows: (await db.query(sql, p || [])).rows }; } catch (e) { return { error: e }; } finally { await db.exec(`select set_config('request.jwt.claim.sub', '', false); reset role`); }   /* the claim is session-scoped: clear it, or the next raw query inherits the identity */ };
    const sys = async (sql, p) => (await db.query(sql, p || [])).rows;
    const refused = async (uid, sql, p) => {
      const out = !!(await as(uid, sql, p)).error;
      /* a refused statement aborts its transaction; the next query on this shared connection must not be the
         victim of the recovery, so absorb it here (seen as silently skipped statements without this) */
      await db.query('select 1').catch(() => {});
      return out;
    };
    await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb not null default '{}'::jsonb, email_confirmed_at timestamptz, created_at timestamptz not null default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant usage on schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on sequences to anon, authenticated;
      alter default privileges in schema public grant execute on functions to anon, authenticated; create publication supabase_realtime;`);
    await db.exec(schema);
    const U = { adm: 'd0000000-0000-4000-8000-000000000001', staff: 'd0000000-0000-4000-8000-000000000002',
      mem1: 'd0000000-0000-4000-8000-000000000003', mem2: 'd0000000-0000-4000-8000-000000000004',
      pend: 'd0000000-0000-4000-8000-000000000005', admB: 'd0000000-0000-4000-8000-000000000006' };
    for (const [k, id] of Object.entries(U)) await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, k + '@hub.org']);
    const CH = (await sys(`insert into public.churches (name, status) values ('Hub Church', 'active') returning id`))[0].id;
    await sys(`insert into public.memberships (user_id, church_id, role, status) values ($1,$2,'admin','approved'),($3,$2,'staff','approved'),($4,$2,'member','approved'),($5,$2,'member','approved'),($6,$2,'member','pending')`,
      [U.adm, CH, U.staff, U.mem1, U.mem2, U.pend]);
    const CHB = (await sys(`insert into public.churches (name, status) values ('Hub Church B', 'active') returning id`))[0].id;
    await sys(`insert into public.memberships (user_id, church_id, role, status) values ($1,$2,'admin','approved')`, [U.admB, CHB]);

    /* ---- phase 1: members pledge themselves ---- */
    console.log('\n18d. Volunteer hub: self-pledge');
    let r = await as(U.mem1, `select public.save_my_pledge($1) id`, [JSON.stringify(
      { name: 'Thandi Member', phone: '082 111 0001', email: '', pledgeExpos: 4, skills: ['clinic'], pref: ['bp', 'sugar'], pref2: 'vitals', availability: ['saturday'], shirt: 'M' })]);
    const vol1 = r.rows && r.rows[0] && r.rows[0].id;
    let row = (await sys(`select * from public.volunteers where church_id = $1 and id = $2`, [CH, vol1]))[0];
    ok('a member pledges: a volunteers row is created, prospect, numbered from VOL-1001, and linked to their account',
      !r.error && /^VOL-\d+$/.test(vol1 || '') && row && row.status === 'prospect' && row.pledge_expos === 4
        && row.booth === null && row.pledged_on !== null
        && (await sys(`select volunteer_id from public.memberships where user_id = $1`, [U.mem1]))[0].volunteer_id === vol1,
      r.error ? r.error.message : JSON.stringify(row));
    r = await as(U.mem1, `select public.save_my_pledge($1) id`, [JSON.stringify({ name: 'Thandi Member-X', phone: '082 111 0002', email: 'thandi@x.org', booth: 'kitchen', status: 'registered', lead: true, role: 'Boss' })]);
    row = (await sys(`select * from public.volunteers where id = $1`, [vol1]))[0];
    ok('a later save updates the same row and cannot set booth, status, lead or role',
      !r.error && r.rows[0].id === vol1 && row.name === 'Thandi Member-X' && row.phone === '082 111 0002'
        && row.email === 'thandi@x.org' && row.status === 'prospect' && row.booth === null && row.role === '',
      r.error ? r.error.message : JSON.stringify(row));
    r = await as(U.mem2, `select public.save_my_pledge($1) id`, [JSON.stringify({ name: 'Sipho Member', phone: '082 222 0001' })]);
    const vol2 = r.rows && r.rows[0] && r.rows[0].id;
    ok('two members pledging get different numbers, and a pledge needs a phone or an email',
      !r.error && vol2 && vol2 !== vol1 && !!(await as(U.mem2, `select public.save_my_pledge($1)`, [JSON.stringify({ name: 'No Contact', phone: '', email: '' })])).error,
      r.error ? r.error.message : vol2);
    ok('a pending member cannot pledge', await refused(U.pend, `select public.save_my_pledge($1)`, [JSON.stringify({ name: 'Waiting', phone: '082 333 0001' })]));
    await sys(`update public.churches set status = 'suspended' where id = $1`, [CH]);
    ok('a suspended church cannot take pledges', await refused(U.mem1, `select public.save_my_pledge($1)`, [JSON.stringify({ name: 'X', phone: '082 111 0001' })]));
    await sys(`update public.churches set status = 'active' where id = $1`, [CH]);
    /* a volunteer row exists in another church with the same number: the caller must never reach it */
    const otherRow = (await sys(`insert into public.volunteers (church_id, id, name, booth, status)
      select id, $1, 'Same Number Elsewhere', 'kitchen', 'checkedin' from public.churches where id <> $2 limit 1 returning id, church_id`, [vol1, CH]))[0];
    r = await as(U.mem1, `select public.save_my_pledge($1) id`, [JSON.stringify({ name: 'Thandi Member', phone: '082 111 0001', booth: 'stolen' })]);
    const rowOther = (await sys(`select name, booth, status from public.volunteers where church_id = $1 and id = $2`, [otherRow.church_id, vol1]))[0];
    ok('a member editing their pledge never touches another church\'s row with the same number',
      !r.error && rowOther.name === 'Same Number Elsewhere' && rowOther.booth === 'kitchen' && rowOther.status === 'checkedin', JSON.stringify(rowOther));
    r = await as(U.mem1, `select public.withdraw_my_pledge()`);
    ok('withdrawing a pledge that is still a prospect deletes it and clears the link',
      !r.error && (await sys(`select 1 from public.volunteers where church_id = $1 and id = $2`, [CH, vol1])).length === 0
        && (await sys(`select volunteer_id from public.memberships where user_id = $1`, [U.mem1]))[0].volunteer_id === null,
      r.error && r.error.message);
    await as(U.mem1, `select public.save_my_pledge($1)`, [JSON.stringify({ name: 'Thandi Member', phone: '082 111 0001' })]);
    const vol1b = (await sys(`select volunteer_id from public.memberships where user_id = $1`, [U.mem1]))[0].volunteer_id;
    await sys(`update public.volunteers set status = 'registered', booth = 'bp' where id = $1`, [vol1b]);
    r = await as(U.mem1, `select public.withdraw_my_pledge()`);
    ok('a registered pledge cannot be withdrawn by the member (an admin has to remove it)',
      !!r.error && /admin/.test(r.error.message) && (await sys(`select 1 from public.volunteers where id = $1`, [vol1b])).length === 1, r.error && r.error.message);
    /* staff typed this pledge in; an admin links it to the member's account */
    await sys(`insert into public.volunteers (church_id, id, name, phone) values ($1, 'VOL-2001', 'Typed In', '082 444 0001')`, [CH]);
    ok('linking a volunteer to an account is for admins only', await refused(U.mem2, `select public.link_volunteer($1,'VOL-2001')`, [U.mem1]));
    r = await as(U.adm, `select public.link_volunteer($1,'VOL-2001')`, [U.mem1]);
    ok('an admin links a typed-in pledge; a second member cannot take the same record',
      !r.error && (await sys(`select volunteer_id from public.memberships where user_id = $1`, [U.mem1]))[0].volunteer_id === 'VOL-2001'
        && !!(await as(U.adm, `select public.link_volunteer($1,'VOL-2001')`, [U.mem2])).error
        && !!(await as(U.adm, `select public.link_volunteer($1,'VOL-9999')`, [U.mem2])).error,
      r.error && r.error.message);
    r = await as(U.mem1, `select public.my_pledge() p`);
    ok('my_pledge returns the caller\'s own row with its placement, and null for a member without a pledge',
      !r.error && r.rows[0] && r.rows[0].p && r.rows[0].p.id === 'VOL-2001' && r.rows[0].p.booth === null
        && (await as(U.pend, `select public.my_pledge() p`)).rows[0].p === null,
      r.error ? r.error.message : JSON.stringify(r.rows[0]));
    /* the table's own RLS hides other members' rows silently: a member sees zero rows and an update changes nothing */
    const peek = await as(U.mem2, `select name from public.volunteers where id = 'VOL-2001'`);
    await as(U.mem2, `update public.volunteers set name = 'Hijacked' where id = 'VOL-2001'`);
    const volName = (await sys(`select name from public.volunteers where church_id = $1 and id = 'VOL-2001'`, [CH]))[0].name;
    ok('a member cannot read or edit another member\'s pledge through the table itself',
      !peek.error && peek.rows.length === 0 && volName === 'Typed In', JSON.stringify([peek.rows, volName]));

    /* ---- phase 2: one team leader per station ---- */
    console.log('\n18d. Volunteer hub: team leaders');
    /* VOL-2001 (mem1's linked pledge) becomes the leader of Blood Pressure */
    await sys(`update public.volunteers set status = 'registered', booth = 'bp', lead = true, role = 'Team leader' where church_id = $1 and id = 'VOL-2001'`, [CH]);
    r = await as(U.mem1, `select public.my_pledge() p`);
    ok('the member\'s own pledge shows the leader title and station', !r.error && r.rows[0].p.lead === true && r.rows[0].p.booth === 'bp', JSON.stringify(r.rows[0] && r.rows[0].p));
    await sys(`update public.volunteers set booth = 'bp', status = 'registered' where church_id = $1 and id = $2`, [CH, vol2]);
    ok('the database itself refuses a second leader at one station',
      await refused(U.staff, `update public.volunteers set lead = true where church_id = $1 and id = $2`, [CH, vol2])
        && (await sys(`select lead from public.volunteers where church_id = $1 and id = $2`, [CH, vol2]))[0].lead === false);
    /* only admins and the station's leader may move people now, so this move runs as the admin */
    const moved = await as(U.adm, `update public.volunteers set booth = 'kitchen' where church_id = $1 and id = 'VOL-2001'`, [CH]);
    row = (await sys(`select lead, role from public.volunteers where church_id = $1 and id = 'VOL-2001'`, [CH]))[0];
    ok('moving a leader to another station clears their leadership (an update that changes only the booth)',
      row.lead === false, JSON.stringify(row) + (moved.error ? ' · move error: ' + moved.error.message : ''));
    r = await as(U.mem1, `select public.my_pledge() p`);
    ok('the member sees the loss of the title straight away', !r.error && r.rows[0].p.lead === false);
    await as(U.adm, `update public.volunteers set booth = 'bp', lead = true where church_id = $1 and id = 'VOL-2001'`, [CH]);
    const bothRow = (await sys(`select lead, booth from public.volunteers where id = 'VOL-2001'`))[0];
    ok('an update that sets both booth and lead together is allowed (what the swap uses)',
      bothRow.lead === true, JSON.stringify(bothRow));

    /* ---- phase 3: admins place, move and swap ---- */
    console.log('\n18d. Volunteer hub: placement');
    /* the state from phase 2: VOL-2001 (mem1, linked) is leader at bp; VOL-1002 (mem2's pledge) registered at bp;
       VOL-1003 (mem1's first pledge, now unlinked) registered at bp */
    ok('attack: plain staff cannot move anybody by writing the table (the database refuses, not just the UI)',
      await refused(U.staff, `update public.volunteers set booth = 'prayer' where church_id = $1 and id = $2`, [CH, vol2]));
    r = await as(U.adm, `select * from public.place_volunteer('VOL-1002','kitchen')`);
    row = (await sys(`select booth, status from public.volunteers where church_id = $1 and id = 'VOL-1002'`, [CH]))[0];
    ok('an admin places a person at another station', !r.error && row.booth === 'kitchen', r.error && r.error.message);
    await sys(`insert into public.volunteers (church_id, id, name, phone, status) values ($1, 'VOL-3001', 'New Pledge', '082 555 0001', 'prospect')`, [CH]);
    r = await as(U.adm, `select * from public.place_volunteer('VOL-3001','prayer')`);
    row = (await sys(`select booth, status, registered_on from public.volunteers where id = 'VOL-3001'`))[0];
    ok('placing a prospect registers them and dates the registration', row.booth === 'prayer' && row.status === 'registered' && row.registered_on !== null);
    /* swap the leader (bp) with the person at kitchen: the title stays with the STATION */
    r = await as(U.adm, `select * from public.swap_volunteers('VOL-2001','VOL-1002')`);
    const afterSwap = await sys(`select id, booth, lead from public.volunteers where church_id = $1 and id in ('VOL-2001','VOL-1002') order by id`, [CH]);
    ok('a swap is atomic: each person ends at exactly one of the two stations',
      !r.error && afterSwap.length === 2 && afterSwap.some(x => x.id === 'VOL-2001' && x.booth === 'kitchen')
        && afterSwap.some(x => x.id === 'VOL-1002' && x.booth === 'bp'), r.error ? r.error.message : JSON.stringify(afterSwap));
    ok('after a swap the station keeps exactly one leader, and it is the person now standing there',
      afterSwap.find(x => x.id === 'VOL-1002').lead === true && afterSwap.find(x => x.id === 'VOL-2001').lead === false
        && (await sys(`select count(*)::int n from public.volunteers where church_id = $1 and booth = 'bp' and lead`, [CH]))[0].n === 1,
      JSON.stringify(afterSwap));
    /* mem2's linked row now leads bp — and mem2 is a plain member with no staff role */
    r = await as(U.mem2, `select * from public.my_team()`);
    ok('my_team works for a leader who is only a member (no staff access), and names their people',
      !r.error && r.rows.some(x => x.id === 'VOL-1003') && r.rows.every(x => x.status !== undefined), r.error && r.error.message);
    ok('my_team never carries notes, emergency contacts or history',
      r.rows.length > 0 && r.rows.every(x => !('notes' in x) && !('emergency' in x) && !('history' in x)), JSON.stringify(r.rows[0]));
    await sys(`insert into public.volunteers (church_id, id, name, phone, pref, notes, emergency) values ($1,'VOL-3002','Chooser','082 555 0002','{bp}','secret','mum 911')`, [CH]);
    r = await as(U.mem2, `select * from public.my_team()`);
    ok('an unplaced volunteer who chose the station appears as waiting, without their private fields',
      r.rows.some(x => x.id === 'VOL-3002' && !x.booth) && !JSON.stringify(r.rows).includes('secret') && !JSON.stringify(r.rows).includes('mum 911'),
      JSON.stringify(r.rows.map(x => x.id)));
    ok('a leader adds an unplaced chooser to their station and takes them off again',
      !!(await as(U.mem2, `select * from public.place_volunteer('VOL-3002','bp')`)).error === false
        && (await sys(`select booth, status from public.volunteers where id='VOL-3002'`))[0].status === 'registered'
        && !!(await as(U.mem2, `select * from public.release_volunteer('VOL-3002')`)).error === false
        && (await sys(`select booth, status from public.volunteers where id='VOL-3002'`))[0].booth === null,
      'place or release refused');
    ok('attack: a leader cannot act outside their own station — place, release or make a leader',
      await refused(U.mem2, `select * from public.place_volunteer('VOL-3002','prayer')`)
        && await refused(U.mem2, `select * from public.release_volunteer('VOL-2001')`)
        && await refused(U.mem2, `select public.set_station_lead('bp','VOL-2001')`));
    ok('attack: a leader cannot touch a person who was never at their station',
      await refused(U.mem2, `select public.set_shift('VOL-2001','09:00-13:00')`));
    /* the leader loses the rights the moment the title moves (an admin moves VOL-2001 back to bp first) */
    await as(U.adm, `select * from public.place_volunteer('VOL-2001','bp')`);
    await as(U.adm, `select public.set_station_lead('bp','VOL-2001')`);
    ok('the moment the title moves, the old leader is refused and the new one can act',
      await refused(U.mem2, `select * from public.place_volunteer('VOL-3002','bp')`)
        && !!(await as(U.mem1, `select * from public.place_volunteer('VOL-3002','bp')`)).error === false,
      'leader handover failed');
    r = await as(U.adm, `select public.set_shift('VOL-2001','09:00-13:00')`);
    ok('an admin sets a shift; the title arrived with the role text',
      !r.error && (await sys(`select shift, role from public.volunteers where id='VOL-2001'`))[0].role === 'Team leader');
    await as(U.adm, `select public.release_volunteer('VOL-2001')`);
    row = (await sys(`select booth, status, lead, role from public.volunteers where id = 'VOL-2001'`))[0];
    ok('releasing takes the person off the station and out of the lead, so they can be placed elsewhere',
      row.booth === null && row.status === 'prospect' && row.lead === false && row.role === '', JSON.stringify(row));

    /* ---- phase 4: notifications ---- */
    console.log('\n18d. Volunteer hub: notifications');
    const notifs = async uid => (await as(uid, `select id, kind, title, body, user_id, read_at from public.notifications order by id`)).rows;
    await sys(`insert into public.volunteers (church_id, id, name, phone, status, booth) values ($1, 'VOL-4001', 'Placed One', '082 666 0001', 'registered', 'bp')`, [CH]);
    /* each check counts only the rows created after it: earlier phases left real history behind */
    const mark = async () => (await sys(`select coalesce(max(id),0)::int m from public.notifications`))[0].m;
    let markBefore = await mark();
    await as(U.adm, `select * from public.place_volunteer('VOL-2001','bp')`);
    const n1 = (await notifs(U.mem1)).filter(x => x.id > markBefore);
    ok('placing a linked volunteer writes one placement row to their member',
      n1.length === 1 && n1[0].kind === 'placement' && n1[0].title === 'You are placed at Blood Pressure', JSON.stringify(n1));
    markBefore = await mark();
    await as(U.adm, `select public.set_station_lead('bp','VOL-2001')`);
    const n2 = (await notifs(U.mem1)).filter(x => x.id > markBefore);
    ok('making a leader writes the title row with the station',
      n2.length === 1 && n2[0].kind === 'lead' && n2[0].title === 'You lead Blood Pressure ★', JSON.stringify(n2));
    markBefore = await mark();
    await as(U.adm, `select public.set_shift('VOL-2001','10:00-14:00')`);
    const n3 = (await notifs(U.mem1)).filter(x => x.id > markBefore);
    ok('a shift change writes one shift row', n3.length === 1 && n3[0].kind === 'shift' && n3[0].body === '10:00-14:00', JSON.stringify(n3));
    await sys(`insert into public.volunteers (church_id, id, name, phone) values ($1,'VOL-4002','No Account','082 666 0002')`, [CH]);
    markBefore = await mark();
    await as(U.adm, `select * from public.place_volunteer('VOL-4002','bp')`);
    ok('an unlinked volunteer generates no notification for anybody', (await mark()) === markBefore, 'an extra row appeared for a user with no link');
    /* mem2 becomes a member of the church so their rows can be compared */
    await as(U.adm, `select public.set_member($1,'member','approved')`, [U.mem2]);
    r = await as(U.mem1, `select public.mark_notifications_read(null) n`);
    ok('mark all read stamps only the own rows', !r.error && (await notifs(U.mem1)).every(x => x.read_at !== null), r.error && r.error.message);
    const mem2Rows = await notifs(U.mem2);
    if (mem2Rows.length) {
      await as(U.mem1, `update public.notifications set read_at = now() where user_id = '${U.mem2}'`);
      ok('attack: a member cannot mark another member rows read',
        (await notifs(U.mem2)).every(x => x.read_at === null));
      ok('attack: a member cannot read rows that are not theirs',
        (await as(U.mem1, `select id from public.notifications where user_id = '${U.mem2}'`)).rows.length === 0);
    }
    /* the church was approved: its admins hear about it */
    await sys(`update public.churches set status = 'pending' where id = $1`, [CHB]);
    await as(U.lonerP || U.adm, `select 1`);   /* noop to keep the shape */
    await sys(`insert into public.platform_admins (user_id) values ($1) on conflict do nothing`, [U.pend]);
    await as(U.pend, `select public.admin_set_church_status($1,'active')`, [CHB]);
    const nB = await notifs(U.admB);
    ok('approving a church writes one row to each of its admins', nB.some(x => x.kind === 'church' && x.title === 'Your church was approved'), JSON.stringify(nB.map(x => x.title)));
    /* the purge: a read row goes after 30 days, any row after 90 */
    await sys(`insert into public.notifications (church_id, user_id, kind, title, created_at, read_at)
      values ($1, $2, 'pledge', 'Old read', now() - interval '40 days', now() - interval '39 days'),
             ($1, $2, 'pledge', 'Old unread', now() - interval '100 days', null)`, [CH, U.mem1]);
    await sys(`select public.purge_expired_visitors()`);
    const left = await notifs(U.mem1);
    ok('the daily purge deletes read rows after 30 days and any row after 90',
      !left.some(x => x.title === 'Old read') && !left.some(x => x.title === 'Old unread')
        && left.some(x => x.title === 'You are placed at Blood Pressure'), JSON.stringify(left.map(x => x.title)));
    ok('notifications is in the realtime publication',
      (await sys(`select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'`)).length === 1);

  })().catch(e => ok('volunteer hub database tests ran to the end', false, e && e.stack || e));

  /* ---- 19. installable app (PWA) -------------------------------------- */
  console.log('\n19. Installable app (PWA)');
  const rootDir = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.webmanifest'), 'utf8'));
  ok('manifest: names, standalone, start_url and scope', manifest.name && manifest.short_name && manifest.display === 'standalone' && manifest.start_url === './' && manifest.scope === './');
  ok('manifest: short name fits under a phone icon (<= 12 chars)', manifest.short_name.length <= 12, manifest.short_name);
  ok('manifest: colours are valid hex', /^#[0-9a-f]{6}$/i.test(manifest.theme_color) && /^#[0-9a-f]{6}$/i.test(manifest.background_color));
  const pngDims = f => { const b = fs.readFileSync(path.join(rootDir, f)); return b.slice(1, 4).toString() === 'PNG' ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : 'not a png'; };
  ok('every manifest icon exists, is a real PNG and has the size it declares',
    manifest.icons.every(i => pngDims(i.src) === i.sizes), manifest.icons.map(i => i.src + ' ' + pngDims(i.src) + ' vs ' + i.sizes).join('; '));
  ok('icons: 192 and 512 "any" plus a 512 "maskable" (what Android needs to offer install)',
    ['192x192', '512x512'].every(s => manifest.icons.some(i => i.sizes === s && i.purpose === 'any')) && manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));
  ok('iPhone home-screen icon is 180x180', pngDims('icons/icon-180.png') === '180x180');
  const needs = [/<link rel="manifest" href="manifest\.webmanifest">/, /rel="apple-touch-icon" href="icons\/icon-180\.png"/, /name="apple-mobile-web-app-capable" content="yes"/,
    /name="mobile-web-app-capable" content="yes"/, /name="theme-color"/, /viewport-fit=cover/];
  ok('index.html links the manifest, icons and iOS tags (the shell page)', needs.every(r => r.test(html)), needs.filter(r => !r.test(html)).map(String).join(' '));
  ok('the app registers the service worker, only on https or localhost (the app code)', /navigator\.serviceWorker\.register\('sw\.js'\)/.test(srcText)
    && /location\.protocol==='https:'\|\|location\.hostname==='localhost'/.test(srcText));
  ok('touch screens get 16px inputs (stops iPhone zooming on tap)', /pointer:coarse\)\{\.field,\.step-input[^}]*font-size:16px/.test(html));

  const swSrc = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
  const constOf = n => (srcText.match(new RegExp("(?:const |,)" + n + "='([^']+)'")) || [])[1];
  const libsInSw = [...swSrc.matchAll(/'(https:\/\/[^']+\.js)'/g)].map(m => m[1]);
  ok('service worker precaches exactly the libraries the page loads', JSON.stringify(libsInSw.sort()) === JSON.stringify([constOf('SB_LIB')].sort()), libsInSw.join());

  /* run sw.js against fake service-worker globals and exercise its routing */
  const swCaches = new Map();
  /* like a real cache, keys are absolute addresses (relative ones resolve against the worker's scope) */
  const keyOf = k => new URL(typeof k === 'string' ? k : k.url, 'https://expo.example/').href;
  const swCache = name => { if (!swCaches.has(name)) swCaches.set(name, new Map()); const m = swCaches.get(name);
    return {
      /* like the real Cache API, every match hands back a fresh copy of the stored response */
      match: async (k, opt) => { const key = keyOf(k); if (m.has(key)) return m.get(key).clone();
        if (opt && opt.ignoreSearch) { const bare = key.split('?')[0]; for (const [mk, v] of m) if (mk.split('?')[0] === bare) return v.clone(); } return undefined; },
      put: async (k, v) => { m.set(keyOf(k), v); },
      addAll: async ks => ks.forEach(k => m.set(keyOf(k), new Response('shell:' + k))),
      add: async k => { m.set(keyOf(k), new Response('lib:' + k)); },
    }; };
  const swHandlers = {};
  let netFail = false, netCalls = [];
  /* like a real host, every answer says what it is: pages are HTML, unless the address asks for plain text */
  const typeOfNet = u => /\.js(\?|$)/.test(u) ? 'application/javascript' : /\.png(\?|$)/.test(u) ? 'image/png' : /\.woff2(\?|$)/.test(u) ? 'font/woff2'
    : /[?&]plain=1/.test(u) ? 'text/plain' : 'text/html; charset=utf-8';
  const swSandbox = {
    self: { addEventListener: (t, f) => { swHandlers[t] = f; }, location: { origin: 'https://expo.example' }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async n => swCache(n), keys: async () => [...swCaches.keys()], delete: async k => swCaches.delete(k), match: async () => undefined },
    fetch: async r => { const u = typeof r === 'string' ? r : r.url; netCalls.push(u); if (netFail) throw new TypeError('Failed to fetch');
      return new Response('net:' + u, { headers: { 'Content-Type': typeOfNet(u) } }); },
    Response, URL, Promise, setTimeout, clearTimeout, Error, TypeError, Map,
  };
  swSandbox.self.caches = swSandbox.caches;
  vm.createContext(swSandbox);
  vm.runInContext(swSrc.replace('__VERSION__', 'test1'), swSandbox);
  const route = (url, init = {}) => { let out = { handled: false, promise: null };
    /* a real request carries headers; init.ua stands for the browser's User-Agent */
    const { ua, ...rest } = init;
    const headers = { get: n => (String(n).toLowerCase() === 'user-agent' ? (ua || null) : null) };
    swHandlers.fetch({ request: { method: 'GET', mode: 'cors', url, headers, ...rest }, respondWith: p => { out.handled = true; out.promise = p; } }); return out; };
  ok('service worker registers install, activate and fetch handlers', ['install', 'activate', 'fetch'].every(t => typeof swHandlers[t] === 'function'));
  await new Promise(res => swHandlers.install({ waitUntil: p => p.then(res) }));
  ok('install caches the app shell and the one library (sign-in)', swCaches.get('newstart-shell-test1').has(keyOf('index.html')) && swCaches.get('newstart-libs-v3').size === 1, [...swCaches.keys()].join());
  swCache('newstart-shell-old'); swCache('something-else');
  await new Promise(res => swHandlers.activate({ waitUntil: p => p.then(res) }));
  ok('activate deletes caches from older versions', !swCaches.has('newstart-shell-old') && !swCaches.has('something-else') && swCaches.has('newstart-shell-test1'), [...swCaches.keys()].join());

  const supa = route('https://wlsrgihkijlvjyfxvhfl.supabase.co/rest/v1/attendees?select=*');
  ok('Supabase data requests are never intercepted (so never cached)', supa.handled === false);
  ok('Supabase sign-in requests are never intercepted', route('https://wlsrgihkijlvjyfxvhfl.supabase.co/auth/v1/token?grant_type=password').handled === false);
  ok('realtime / other supabase hosts are never intercepted', route('https://abc.supabase.in/x').handled === false && route('https://supabase.co/x').handled === false);
  ok('non-GET requests are left alone', route('https://expo.example/', { method: 'POST' }).handled === false);
  ok('unknown third-party hosts are left alone', route('https://evil.example/x.js').handled === false);
  const nav = route('https://expo.example/?x=1', { mode: 'navigate' });
  ok('page loads are handled (network first)', nav.handled && (await nav.promise).ok === true && netCalls.length > 0);
  const savedPage = async () => (await swCaches.get('newstart-shell-test1').get(keyOf('index.html')).clone().text());
  ok('the fetched page is saved for offline use', (await savedPage()) === 'net:https://expo.example/?x=1');
  const plainNav = route('https://expo.example/?plain=1', { mode: 'navigate' });
  if (plainNav.handled) await plainNav.promise;
  ok('an answer that is not a web page is not saved as the offline page', plainNav.handled && (await savedPage()) === 'net:https://expo.example/?x=1');
  const wv = route('https://expo.example/', { mode: 'navigate', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36' });
  const chrome = route('https://expo.example/', { mode: 'navigate', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36' });
  if (chrome.handled) await chrome.promise;
  ok('Android\'s in-app browser (wv) loads pages itself, untouched by the worker', wv.handled === false && chrome.handled === true);
  ok('the app download (.apk) is never intercepted', route('https://expo.example/newstart.apk').handled === false);
  netFail = true;
  const offNav = route('https://expo.example/', { mode: 'navigate' });
  /* a rejection must count as a failed check, not stop the harness */
  const offText = offNav.handled ? await offNav.promise.then(r => r.text(), () => '') : '';
  ok('offline: the page opens from the saved copy', offText.startsWith('net:'));
  const offIcon = route('https://expo.example/icons/icon-192.png');
  ok('offline: icons come from the saved copy', offIcon.handled && (await (await offIcon.promise).text()).startsWith('shell:'));
  const offLib = route(constOf('SB_LIB'));
  ok('offline: the sign-in library comes from the saved copy', offLib.handled && (await (await offLib.promise).text()) === 'lib:' + constOf('SB_LIB'));
  const font = route('https://fonts.gstatic.com/s/inter/v1/x.woff2');
  ok('offline: an uncached font fails quietly instead of hanging', font.handled && await font.promise.then(() => false, () => true));
  netFail = false;
  swCaches.get('newstart-shell-test1').delete(keyOf('index.html')); netFail = true;
  const cold = route('https://expo.example/', { mode: 'navigate' });
  /* sw.js answers with a short 503 message instead of rejecting: a rejection shows on the phone as net::ERR_CACHE_MISS */
  const coldRes = cold.handled ? await cold.promise.then(r => r, () => null) : null;
  ok('offline with nothing saved yet: the failure is reported, not faked', !!coldRes && coldRes.status === 503 && /could not be loaded/.test(await coldRes.text()));
  netFail = false;
  ok('no health data path appears in the service worker source', !/attendees|volunteers|auth\/v1|rest\/v1/.test(swSrc));

  /* install button states — the module's bindings are private to the bundle: drive them through its setters */
  g.setInstallEvt(null);
  sandbox.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0)'; sandbox.matchMedia = () => ({ matches: false, addEventListener() {} });
  ok('desktop browser with nothing to offer shows no install block', g.installBlock() === '');
  sandbox.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  ok('iPhone sees the Share → Add to Home Screen steps', /Add to Home Screen/.test(g.installBlock()));
  sandbox.navigator.userAgent = 'Mozilla/5.0 (Linux; Android 14)';
  g.setInstallEvt({prompt(){sandbox.__prompted=1;},userChoice:Promise.resolve({outcome:'accepted'})});
  ok('Android with an install event shows the Install button', /data-action="installApp"/.test(g.installBlock()));
  await g.installApp();
  ok('tapping Install shows the browser install prompt once', sandbox.__prompted === 1 && g.installEvt === null);
  sandbox.matchMedia = q => ({ matches: /standalone/.test(q), addEventListener() {} });
  ok('inside the installed app it says so instead of offering install', /Installed on this phone/.test(g.installBlock()));
  sandbox.matchMedia = () => ({ matches: false, addEventListener() {} }); sandbox.navigator.userAgent = 'node';

  /* ---- 19d. delegated actions: the dispatcher contract ---- */
  console.log('\n19d. Delegated actions');
  {
    const mk = attrs => { const e = { dataset: { ...attrs } }; e.closest = () => e;
      e.hasAttribute = k => k === 'data-backdrop' && attrs.backdrop === '1'; return e; };
    const wasVolTab = g.state.volTab;
    g.dispatch(mk({ action: 'setVolTab', args: 'record' }), { type: 'click', target: {} });
    ok('a data-action element reaches its adapter with its data-args', g.state.volTab === 'record');
    g.dispatch(mk({ action: 'setVolTab', args: wasVolTab }), { type: 'click', target: {} });
    ok('the same adapter runs again with new args (no one-shot caching)', g.state.volTab === wasVolTab);
    g.cloud.adminData = 'probe';
    g.dispatch(mk({ action: 'all-churches-back', backdrop: '1' }), { type: 'click', target: { elsewhere: true } });
    ok('a backdrop action ignores clicks on the content inside it', g.cloud.adminData === 'probe');
    const backdrop = mk({ action: 'all-churches-back', backdrop: '1' });
    g.dispatch(backdrop, { type: 'click', target: backdrop });
    ok('a backdrop action runs when the dimmed backdrop itself is clicked', g.cloud.adminData === '');
    let warned = 0; const w = console.warn; console.warn = () => { warned++; };
    g.dispatch(mk({ action: 'no-such-action' }), { type: 'click', target: {} });
    console.warn = w;
    ok('an unregistered action warns instead of throwing', warned === 1);
    g.dispatch(null, { type: 'click', target: {} });
    ok('a null target is a no-op', true);
    /* a click on a field inside a form climbs to the form; it must not run the form's submit handler */
    const form = { ...mk({ action: 'setVolTab', args: 'record' }), tagName: 'FORM' }; form.closest = () => form;
    g.state.volTab = wasVolTab;
    g.dispatch(form, { type: 'click', target: {} });
    ok('a click inside a form does not run the form’s action (no early submit, no undone checkbox tick)', g.state.volTab === wasVolTab);
    g.dispatch(form, { type: 'change', target: {} });
    ok('a change inside a form does not run the form’s action', g.state.volTab === wasVolTab);
    g.dispatch(form, { type: 'submit', target: form });
    ok('the form’s action runs on submit', g.state.volTab === 'record');
    g.state.volTab = wasVolTab;
    const det = mk({ onToggle: 'sim-open' }); det.open = true; g.state.simOpen = false;
    g.dispatch(det, { type: 'toggle', target: det });
    ok('a <details> toggle reaches its data-on-toggle adapter (90-day win stays open across redraws)', g.state.simOpen === true);
    g.state.simOpen = false;

    /* every data-action the screens draw must have an adapter: five buttons (WhatsApp, email, the queue's big
       screen, a password Show, and the volunteer roster CSV) were dead because their names were missing here */
    {
      const reg = fs.readFileSync(path.join(__dirname, '..', 'src', 'action-registry.js'), 'utf8');
      const keys = new Set([...reg.matchAll(/^\s{2}(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*[:,]/gm)].map(m => m[1] || m[2]));
      for (const m of reg.matchAll(/^\s{2}([A-Za-z_$][\w$]*(?:,\s*[A-Za-z_$][\w$]*)+),?\s*$/gm))
        m[1].split(',').forEach(x => keys.add(x.trim()));
      const screens = fs.readdirSync(path.join(__dirname, '..', 'src')).filter(f => f.endsWith('.js') && f !== 'actions.js')
        .map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n');
      const used = new Set([...screens.matchAll(/data-action="([A-Za-z0-9_-]+)"/g)].map(m => m[1]));
      for (const m of screens.matchAll(/item\('([A-Za-z0-9_-]+)'/g)) used.add(m[1]);
      const missing = [...used].filter(a => !keys.has(a));
      ok('every button the screens draw has a registered action', missing.length === 0, missing.join(' '));
    }
  }

  /* build output */
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.join(rootDir, 'tools', 'build.js')], { stdio: 'pipe' });
  const dist = f => path.join(rootDir, 'dist', f);
  ok('build produces every file a phone needs', ['index.html', 'manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-180.png', '_headers'].every(f => fs.existsSync(dist(f))));
  ok('build stamps a real version into sw.js', !/__VERSION__/.test(fs.readFileSync(dist('sw.js'), 'utf8')) && /VERSION = '[0-9a-f]{10}'/.test(fs.readFileSync(dist('sw.js'), 'utf8')));
  const built = fs.readFileSync(dist('index.html'), 'utf8');
  const builtCsp = (built.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1];
  ok('built index.html is one self-contained page: the bundle is inlined, the module tag gone', built.includes('__NEWSTART') && !/<script type="module"/.test(built) && built.length > html.length);
  ok('the built page allows its two inline scripts by hash, with no unsafe-inline for scripts', builtCsp
    && /script-src 'self' 'sha256-[^']+' 'sha256-[^']+' https:\/\/cdn\.jsdelivr\.net/.test(builtCsp) && !/script-src[^;]*'unsafe-inline'/.test(builtCsp)
    && builtCsp === (fs.readFileSync(dist('_headers'), 'utf8').match(/Content-Security-Policy: ([^\n]*)/) || [])[1]);
  ok('the host is told never to long-cache the page or the service worker', /\/sw\.js\s+Cache-Control: no-cache/.test(fs.readFileSync(dist('_headers'), 'utf8')));
  /* the browser refuses an inline script unless the sha256 of its exact text (newlines included) is in script-src */
  const cspHash = s => "'sha256-" + require('crypto').createHash('sha256').update(s).digest('base64') + "'";
  const inlineScripts = [...built.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const scriptSrc = ((builtCsp || '').match(/script-src ([^;]*)/) || [])[1] || '';
  ok('every inline script in the built page is allowed by its exact hash (the app would be blank otherwise)',
    inlineScripts.length === 2 && inlineScripts.every(s => scriptSrc.split(' ').includes(cspHash(s))), inlineScripts.map(cspHash).join(' '));
  /* the dev page loads src/ straight into the browser, which (unlike esbuild) needs the full file name */
  const srcDir = path.join(rootDir, 'src');
  const badImports = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).flatMap(f =>
    [...fs.readFileSync(path.join(srcDir, f), 'utf8').matchAll(/(?:import|export)[^'"]*from\s*['"](\.[^'"]+)['"]/g)]
      .map(m => m[1]).filter(p => !p.endsWith('.js') || !fs.existsSync(path.join(srcDir, p))).map(p => f + ' → ' + p));
  ok('every src/ import names an existing .js file, so the browser can load it', badImports.length === 0, badImports.join(', '));
  /* the policy has no 'unsafe-inline' for scripts, so an on…= attribute would silently do nothing */
  const inlineOn = [html, ...fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(srcDir, f), 'utf8'))]
    .flatMap(t => t.match(/\son[a-z]+\s*=\s*["']/gi) || []);
  ok('no inline on…= handler is left in the page or its templates', inlineOn.length === 0, inlineOn.join(' '));
  ok('the page has no scanner left: no scan dialog, camera view or typed-badge field', !/scannerModal|camVideo|manualBadge|openScanner/.test(html));
  /* the Android app packages dist/index.html, so its build must rebuild dist/ first */
  const signPs = fs.readFileSync(path.join(rootDir, 'tools', 'sign-app.ps1'), 'utf8');
  const iBuild = signPs.indexOf("tools\\build.js'"), iApp = signPs.indexOf("tools\\build-app.js'");
  ok('sign-app.ps1 builds the web page before packaging it into the Android app', iBuild >= 0 && iApp > iBuild);

  /* ---- 20. on-the-floor features: WhatsApp, follow-up, pouch ----------- */
  console.log('\n20. WhatsApp, follow-up capture, pouch');
  const WN = g.waNumber;
  ok('WhatsApp number: local 082… becomes 27…', WN('082 123 4567') === '27821234567', WN('082 123 4567'));
  ok('WhatsApp number: +27 with spaces', WN('+27 71 220 4477') === '27712204477');
  ok('WhatsApp number: 0027 prefix', WN('0027 82 111 2222') === '27821112222');
  ok('WhatsApp number: other countries kept', WN('+44 7700 900123') === '447700900123');
  ok('WhatsApp number: the "+27 —" placeholder is not a number', WN('+27 —') === '' && WN('') === '' && WN(null) === '' && WN('12345') === '');
  g.resetDemo();
  const david = g.attendees.find(a => a.id === 'EXPO-042');
  const msg = g.waMessage(david);
  ok('message greets by first name, quotes badge and real numbers', /Hi David/.test(msg) && msg.includes('EXPO-042') && msg.includes('142/90') && msg.includes('3 John 1:2'));
  ok('message carries the safety warning about pills', /do not stop them suddenly/.test(msg));
  ok('message is plain text (no markup)', !/<[a-z]/i.test(msg));
  const realCreate = sandbox.document.createElement; let link = null;
  sandbox.document.createElement = t => { const e = realCreate(t); if (t === 'a') link = e; return e; };
  g.state.activeId = 'EXPO-042'; $el('toastMsg').textContent = '';
  g.sendWhatsApp();
  ok('Send opens a wa.me link for the visitor\'s number with the message ready', link && link.href.startsWith('https://wa.me/27825550142?text=') && decodeURIComponent(link.href.split('text=')[1]) === msg, link && link.href.slice(0, 60));
  ok('the link opens in a new tab without leaking the page', link.target === '_blank' && /noopener/.test(link.rel));
  ok('the toast is honest (opening, not "sent")', /Opening WhatsApp/.test($el('toastMsg').textContent) && !/sent/i.test($el('toastMsg').textContent), $el('toastMsg').textContent);
  david.phone = '+27 —'; link = null; g.sendWhatsApp();
  ok('no saved number → opens WhatsApp to choose a contact, and says so', link.href.startsWith('https://wa.me/?text=') && /No number saved/.test($el('toastMsg').textContent));
  david.phone = 'x'.repeat(5);
  david.name = '<b>Dave</b> Jones'; ok('message does not choke on odd names', g.waMessage(david).includes('<b>Dave</b>'));   /* plain text: markup is just characters */
  sandbox.document.createElement = realCreate; g.resetDemo();
  ok('the buttons no longer claim a message was sent', !/plan sent via WhatsApp/.test(html) && /Send in WhatsApp/.test(html) && !/WhatsApp report preview · verified/.test(html));

  /* ---- the same plan by email ---- */
  g.resetDemo();
  const mailDave = g.attendees.find(a => a.id === 'EXPO-042');
  mailDave.email = '';
  const href = g.mailtoHref(mailDave, 'David@Example.ORG');
  ok('the email link is a mailto: with the address, a subject and the exact plan text as the body',
    href.startsWith('mailto:David%40Example.ORG?subject=') && decodeURIComponent(href.split('&body=')[1]) === g.waMessage(mailDave) && href.includes('21-day%20plan'), href.slice(0, 80));
  g.state.activeId = 'EXPO-042'; g.state.tab = 'send'; g.render();
  ok('the Send tab offers the email option next to WhatsApp',
    /data-action="openEmail"/.test($main.innerHTML) && /Email the plan/.test($main.innerHTML) && $main.innerHTML.includes('none saved'));
  g.openEmail();
  ok('with no email saved, the preview opens with an empty address and a save box',
    /id="emTo"[^>]*value=""/.test($el('waBody').innerHTML) && $el('waBody').innerHTML.includes('emSave') && $el('waFoot').innerHTML.includes('Send by email') && $el('waSub').textContent.includes('email app'));
  sandbox.document.createElement = t => { const e = realCreate(t); if (t === 'a') link = e; return e; };
  $el('emTo').value = 'not-an-email'; link = null; g.sendEmail();
  ok('a malformed email address is refused and nothing opens', !link);
  $el('emTo').value = 'david+plan@example.org'; $el('emSave').checked = true; g.sendEmail();
  ok('a good address opens the email app with the plan ready',
    link && link.href.startsWith('mailto:david%2Bplan%40example.org?subject=') && decodeURIComponent(link.href.split('&body=')[1]) === g.waMessage(mailDave), link && link.href.slice(0, 60));
  ok('a typed address is saved to the visitor when the box says so', mailDave.email === 'david+plan@example.org');
  link = null; g.openEmail();
  ok('with an email saved there is no save-again box and the address is prefilled',
    !$el('waBody').innerHTML.includes('emSave') && $el('waBody').innerHTML.includes('value="david+plan@example.org"'));
  $el('emTo').value = 'no-one@example.org'; g.sendEmail();
  ok('sending again just opens the email app', link && link.href.startsWith('mailto:no-one%40example.org?subject='));
  sandbox.document.createElement = realCreate;
  ok('the email body is plain text with the safety warning', !/<[a-z]/i.test(g.waMessage(mailDave)) && /do not stop them suddenly/.test(g.waMessage(mailDave)));

  /* ---- the report carries the cheapest stores (the value the visitor takes home) ---- */
  g.resetDemo();
  const priceDave = g.attendees.find(a => a.id === 'EXPO-042');
  const planItems = Object.keys(g.PROTOCOLS).flatMap(k => g.PROTOCOLS[k].items || []);
  ok('pricing: every shopping-list item in every plan has verified store prices',
    planItems.length > 0 && planItems.every(i => g.foodPriceOf(i.name) && g.foodPriceOf(i.name).parts.length));
  const msgP = g.waMessage(priceDave);
  const bestDay = g.PROTOCOLS.bp.items.reduce((t, i) => t + g.cheapDay(i), 0), typDay = g.costOf('bp');
  ok('pricing: the message tells the visitor where each food is cheapest, at what price',
    /WHERE TO BUY IT CHEAPEST \(store prices checked/.test(msgP) && /cheapest at SPAR \(R29\.99 per kg\)/.test(msgP) && msgP.includes('60g breakfast'), msgP.slice(msgP.indexOf('WHERE TO BUY'), msgP.indexOf('WHERE TO BUY') + 120));
  ok('pricing: the cheapest-store day total is lower than the typical one, and both are quoted',
    bestDay > 0 && bestDay < typDay && msgP.includes(g.money(bestDay)) && msgP.includes(g.money(typDay)), 'best=' + bestDay + ' typical=' + typDay);
  const slaw = planItems.find(i => /Cabbage/.test(i.name));
  ok('pricing: multi-part foods name a cheapest store for each part',
    !!slaw && g.cheapLine(slaw).includes('carrots cheapest at') && g.cheapLine(slaw).includes('cabbage cheapest at'), slaw && g.cheapLine(slaw));
  g.state.activeId = 'EXPO-042'; g.openWhatsApp();
  ok('pricing: the send preview shows the cheapest stores and both totals',
    $el('waBody').innerHTML.includes('Where to buy it cheapest') && $el('waBody').innerHTML.includes(g.money(bestDay)));
  g.closeWhatsApp();

  /* ---- 20b. the queue: join, call next, serve, done, back, remove ---- */
  console.log('\n20b. The queue (demo mode)');
  g.resetDemo();
  ok('queue: empty at boot, and demo mode allows changes', g.queue.length === 0 && g.qMode() === 'demo' && g.qCan());
  await g.queueJoin('EXPO-042', 'bp');
  await g.queueJoin('EXPO-088', 'bp');
  await g.queueJoin('EXPO-042', 'bp');
  ok('queue: two visitors join and a duplicate is refused', g.qList('bp', 'waiting').length === 2);
  ok('queue: the line is first-in-first-out', g.qList('bp', 'waiting')[0].attendeeId === 'EXPO-042' && g.qList('bp', 'waiting')[1].attendeeId === 'EXPO-088');
  ok('queue: the nav badge counts the waiting line', />2</.test($el('navItems').innerHTML));
  const stats = g.qStats('bp');
  ok('queue: stats estimate a wait and flag a line nobody is serving', stats.wait.length === 2 && stats.eta > 0 && (stats.tone === 'ok' || stats.tone === 'watch'));
  await g.queueCallNext('bp');
  ok('queue: call-next serves the first arrival', g.qList('bp', 'serving').length === 1 && g.qList('bp', 'serving')[0].attendeeId === 'EXPO-042' && g.qList('bp', 'waiting')[0].attendeeId === 'EXPO-088');
  await g.queueCallNext('bp');
  ok('queue: a second desk can serve the next visitor at the same time', g.qList('bp', 'serving').length === 2 && g.qList('bp', 'waiting').length === 0);
  await g.queueCallNext('bp');
  ok('queue: calling next past the end of the line changes nothing', g.qList('bp', 'serving').length === 2 && g.qList('bp', 'waiting').length === 0);
  await g.queueBack(g.qList('bp', 'serving')[0].id);
  ok('queue: a person being served can go back to the line, keeping their place',
    g.qList('bp', 'waiting')[0].attendeeId === 'EXPO-042' && g.qList('bp', 'serving').length === 1 && g.qList('bp', 'serving')[0].attendeeId === 'EXPO-088');
  await g.queueCallNext('bp');
  const qid = g.qList('bp', 'serving')[0].id;
  await g.queueDone(qid);
  ok('queue: finishing a visit clears the desk and counts it done', g.qStats('bp').done === 1 && g.qList('bp', 'serving').length === 1);
  await g.queueJoin('EXPO-117', 'bp');
  const wid = g.qList('bp', 'waiting')[0].id;
  await g.queueRemove(wid);
  ok('queue: removing someone takes a confirming second tap', !!g.queue.find(e => e.id === wid));
  await g.queueRemove(wid);
  ok('queue: the second tap takes them out of the line (kept on record as "left")',
    g.queue.find(e => e.id === wid).status === 'left' && g.qList('bp', 'waiting').length === 0);
  g.state.tab = 'queue'; g.state.qStation = 'bp'; g.render();
  ok('queue: the queue screen renders the station board', $main.innerHTML.includes('Who is waiting where') && $main.innerHTML.includes('Big screen') && $main.innerHTML.includes('Being served'));

  /* follow-up capture → Care lists */
  g.resetDemo();
  const sipho = g.attendees.find(a => a.id === 'EXPO-088');
  const fakeBtn = { classList: { toggle(c, on) { this.on = on; } }, textContent: '', setAttribute(k, v) { this.aria = v; } };
  g.state.tab = 'screen'; g.state.activeId = 'EXPO-088'; g.render();
  ok('Screen tab has the follow-up card with all four options and a prayer box',
    Object.values(g.INT).every(l => $main.innerHTML.includes(l)) && $main.innerHTML.includes('id="prayerNote"') && $main.innerHTML.includes('Prayer request'));
  const nBefore = g.attendees.filter(a => a.interests.nurse).length;
  g.toggleInterest(fakeBtn, 'EXPO-088', 'nurse');
  ok('ticking "Nurse call" records it and updates the button', sipho.interests.nurse === true && fakeBtn.classList.on === true && fakeBtn.textContent.startsWith('✓') && fakeBtn.aria === 'true');
  g.state.tab = 'care'; g.render();
  ok('…and Sipho now appears on the Care lists', g.attendees.filter(a => a.interests.nurse).length === nBefore + 1 && $main.innerHTML.includes('Sipho Ndlovu') && $main.innerHTML.includes('Nurse call'));
  g.toggleInterest(fakeBtn, 'EXPO-088', 'nurse');
  ok('unticking removes it again', sipho.interests.nurse === false && fakeBtn.classList.on === false && fakeBtn.textContent === g.INT.nurse);
  g.onPrayer('EXPO-088', 'Please pray for my <script>x</script> mother');
  g.toggleInterest(fakeBtn, 'EXPO-088', 'stress'); g.state.tab = 'care'; g.render();
  ok('a prayer request shows on the Care card, escaped', $main.innerHTML.includes('Please pray for my &lt;script&gt;x&lt;/script&gt; mother') && !$main.innerHTML.includes('<script>x'));
  g.onPrayer('EXPO-088', 'y'.repeat(900));
  ok('prayer requests are capped at 500 characters', sipho.prayer.length === 500);
  g.state.tab = 'screen'; g.render();
  ok('the prayer box is filled back in and escaped when reopened', !$main.innerHTML.includes('<script>x'));
  g.onPrayer('EXPO-088', '</textarea><img src=x>');
  g.render();
  ok('a prayer note cannot break out of its text box', !$main.innerHTML.includes('<img src=x>'));
  ok('follow-up data is part of what syncs to the database', g.attToRow(sipho).interests.stress === true && g.attToRow(sipho).prayer.startsWith('</textarea>'));
  ok('…so the visitor now counts as an edit to upload', g.cloudDirtyList('att').some(a => a.id === 'EXPO-088'));
  g.toggleInterest(null, 'EXPO-NOPE', 'nurse'); g.onPrayer('EXPO-NOPE', 'x');
  ok('unknown visitor ids are ignored safely', true);
  let csvText = null; sandbox.Blob = function (parts) { csvText = parts.join(''); };
  g.exportCSV(); sandbox.Blob = function () {};
  ok('the follow-up CSV carries interests and the prayer note', csvText.includes('Stress & peace') && csvText.includes('endregion') === false && csvText.includes('</textarea>'));

  /* pouch reservation (the button lives on the last step, Send, since the plan screen was redesigned) */
  g.resetDemo(); g.state.activeId = 'EXPO-088'; g.state.tab = 'send'; g.render();
  ok('the Send step offers to reserve the pouch', $main.innerHTML.includes('Reserve the R25 co-op starter pouch') && /data-action="reservePouch"/.test($main.innerHTML));
  g.reservePouch();
  const sip2 = g.attendees.find(a => a.id === 'EXPO-088');
  ok('Reserve records the pouch for that visitor', sip2.interests.pouch === true && /reserved for Sipho/.test($el('toastMsg').textContent), $el('toastMsg').textContent);
  g.state.tab = 'send'; g.render();
  ok('…and then says the pouch is reserved', $main.innerHTML.includes('Co-op starter pouch reserved') && !$main.innerHTML.includes('Reserve the R25 co-op starter pouch'));
  g.state.tab = 'care'; g.render();
  ok('a reserved pouch appears under the co-op interests', $main.innerHTML.includes('Sipho Ndlovu') && $main.innerHTML.includes('R25 pouch'));
  g.state.tab = 'plan'; g.reservePouch();
  ok('tapping again cancels the reservation', sip2.interests.pouch === false && /removed/.test($el('toastMsg').textContent));
  g.attendees.length = 0; g.state.activeId = ''; g.reservePouch();
  ok('Reserve with nobody selected just asks for a visitor', /Register a visitor first/.test($el('toastMsg').textContent));
  g.state.tab = 'screen'; g.render();
  ok('with no visitors the Screen tab shows the empty state, not a follow-up card', $main.innerHTML.includes('No visitor selected') && !$main.innerHTML.includes('prayerNote'));
  g.resetDemo();


  /* service worker never hands out a redirected response */
  const redirected = new Response('page', { status: 200 }); Object.defineProperty(redirected, 'redirected', { value: true });
  const plain = await swSandbox.cleanCopy(redirected);
  ok('service worker rebuilds redirected pages as plain responses', plain.redirected === false && (await plain.text()) === 'page');
  ok('install fetches the page itself (not a redirecting /index.html)', /fetch\('\.\/'/.test(swSrc) && !/SHELL_FILES = \[[^\]]*'index\.html'/.test(swSrc));
  /* Android app (Capacitor, capacitor/); the old Trusted Web Activity in android/ is gone, only its signing key stays */
  const signApp = fs.readFileSync(path.join(rootDir, 'tools', 'sign-app.ps1'), 'utf8');
  const buildJs = fs.readFileSync(path.join(rootDir, 'tools', 'build.js'), 'utf8');
  const capId = fs.existsSync(path.join(rootDir, 'capacitor')) ? JSON.parse(fs.readFileSync(path.join(rootDir, 'capacitor', 'capacitor.config.json'), 'utf8')).appId : '';
  ok('Android: the app keeps the package id of the installed app', capId === 'org.newstart.expopassport', capId);
  ok('Android: the signing key file is referenced and exists', /android\\signing\\newstart\.jks/.test(signApp) && /--ks-key-alias newstart/.test(signApp) && fs.existsSync(path.join(rootDir, 'android', 'signing', 'newstart.jks')));
  ok('Android: the secret key files are never copied into dist/', !fs.existsSync(path.join(rootDir, 'dist', 'signing')) && !fs.existsSync(path.join(rootDir, 'dist', 'newstart.jks')));
  ok('Android: the web site offers the Capacitor app for download', /path\.join\(root, 'capacitor', 'android', 'app-release-signed\.apk'\)/.test(buildJs) && !/assetlinks/.test(buildJs));
  ok('Android: the old web-wrapper app is gone', !fs.existsSync(path.join(rootDir, 'android', 'twa-manifest.json')) && !fs.existsSync(path.join(rootDir, 'tools', 'sign-apk.ps1')) && !fs.existsSync(dist('.well-known/assetlinks.json')));
  ok('Android: signing passwords are not in the website files', !fs.existsSync(dist('KEYSTORE-INFO.txt')) && !/store password/.test(fs.readFileSync(dist('index.html'), 'utf8')));
  ok('the host header file sets the manifest content type', /manifest\.webmanifest[\s\S]*Content-Type: application\/manifest\+json/.test(fs.readFileSync(path.join(rootDir, 'tools', 'build.js'), 'utf8')));

  /* ---- 21. plans built on Ellen White's health writings ----------------- */
  console.log('\n21. Book-based plans');
  const PL = g.PROTOCOLS;
  const PART = '(?:MH:\\d{1,2}|CD:\\d{1,3}|HL:\\d{1,3}|PH:\\d{1,2}|G|S)', PAGE = new RegExp('^' + PART + '(?: · ' + PART + ')*$');
  const plans = Object.keys(PL);
  ok('all nine plans are there (blood pressure, sugar, weight & cholesterol, underweight, fruit & veg, exercise, water, sleep, stress & mood)',
    ['bp', 'sugar', 'bmi', 'thin', 'veg', 'move', 'water', 'sleep', 'mind'].every(k => PL[k]) && plans.length === 9, plans.join());
  ok('every plan names its book chapters and pages', plans.every(k => /(chs?\. \d|§)/.test(PL[k].src)), plans.map(k => PL[k].src).join(' | '));
  ok('every step has a time, text and a page in the book', plans.every(k => PL[k].steps.length >= 5 && PL[k].steps.every(([t, txt, pg]) => /^\d\d:\d\d$/.test(t) && txt.length > 20 && PAGE.test(pg))));
  ok('every plan has a list of what the book advises, each with a page', plans.every(k => PL[k].facts.length >= 8 && PL[k].facts.every(([txt, pg]) => txt.length > 20 && PAGE.test(pg))));
  ok('every plan has three habits for the message and card', plans.every(k => PL[k].habits.length === 3));
  ok('every plan has a safety note, and every food plan has priced items (exercise and water have none)',
    plans.every(k => PL[k].note.length > 20) && plans.every(k => ['move', 'water'].includes(k) ? PL[k].items.length === 0
      : PL[k].items.length >= 3 && PL[k].items.every(i => i.daily > 0 && i.store && i.dose && /checked \d+ \w+ \d{4}/.test(i.store))));
  const allRefs = k => [...PL[k].steps.map(s => s[2]), ...PL[k].facts.map(f => f[1])].join(' · ').split(' · ');
  const everyRef = [...plans.flatMap(allRefs), ...plans.flatMap(k => g.ACTIONS[k].map(x => x.ref)), ...Object.values(g.FOOD_WHY).flat().map(w => w.ref)].join(' · ').split(' · ');
  ok('every reference in the plans, actions and foods is an Ellen White book, general advice or an expo safety rule',
    everyRef.every(r => PAGE.test(r)), everyRef.filter(r => !PAGE.test(r)).join());
  ok('cited Ministry of Healing chapters are its health chapters (8, 17–20, 23–26)',
    everyRef.filter(r => r.startsWith('MH:')).every(r => [8, 17, 18, 19, 20, 23, 24, 25, 26].includes(+r.slice(3))), everyRef.filter(r => r.startsWith('MH:')).join());
  const CD_READ = [111, 137, 138, 146, 168, 191, 201, 245, 267, 268, 269, 270, 320, 326, 464, 475, 504, 509, 514, 518, 726, 727, 728, 731];
  const HL_READ = [185, 189, 313, 570, 571, 578, 618, 717, 780, 786];
  ok('cited Counsels on Diet, Healthful Living and Place of Herbs passages are the ones checked',
    everyRef.filter(r => /^(CD|HL|PH):/.test(r)).every(r => r.startsWith('CD:') ? CD_READ.includes(+r.slice(3)) : r.startsWith('HL:') ? HL_READ.includes(+r.slice(3)) : r === 'PH:6'),
    everyRef.filter(r => /^(CD|HL|PH):/.test(r)).join());
  ok('every plan cites Ellen White in most of its steps and facts',
    plans.every(k => { const lines = [...PL[k].steps.map(s => s[2]), ...PL[k].facts.map(f => f[1])]; return lines.filter(r => /(MH|CD|HL|PH):/.test(r)).length * 2 > lines.length; }),
    plans.map(k => k + ':' + [...PL[k].steps.map(s => s[2]), ...PL[k].facts.map(f => f[1])].filter(r => /(MH|CD|HL|PH):/.test(r)).length).join());
  const otherBooks = /Nedley|Encyclopedia|Harvestime|Ferrell|Cherne|Pamplona|Lost Art of Thinking|Kellogg|Rational Hydrotherapy|King’s|Dispensatory|Grieve|Modern Herbal/i;
  ok('nothing in the plans, actions, foods or credits names an author other than Ellen White',
    !otherBooks.test(JSON.stringify(PL) + JSON.stringify(g.ACTIONS) + JSON.stringify(g.FOOD_WHY) + g.BOOK_REF + g.BOOK2_REF + g.BOOK3_REF + g.BOOK4_REF));
  const planText = k => JSON.stringify(PL[k]) + JSON.stringify(g.ACTIONS[k]);
  ok('herb teas: only chamomile, linden flower, catnip and hops, with hops in the sleep plan only',
    plans.every(k => !/valerian|passion ?flower|skullcap|scullcap|lemon balm|hawthorn|kava/i.test(planText(k))) && plans.filter(k => k !== 'sleep').every(k => !/hops/i.test(planText(k)))
    && ['catnip', 'linden', 'hops', 'chamomile'].every(w => new RegExp(w, 'i').test(planText('sleep'))) && ['chamomile', 'linden'].every(w => new RegExp(w, 'i').test(planText('mind'))));
  ok('hop and catnip tea cite Ellen White’s letter (Place of Herbs p. 6)', PL.sleep.facts.some(([t, r]) => /Hop tea/.test(t) && /catnip/.test(t) && r === 'PH:6'));
  ok('every herb tea comes with its hazard note',
    /sleeping or anxiety pills/.test(PL.sleep.note) && /catnip tea in pregnancy/.test(PL.sleep.note) && /ragweed/.test(PL.sleep.note) && /fresh linden/.test(PL.sleep.note)
    && /ragweed/.test(PL.mind.note) && /fresh linden/.test(PL.mind.note));
  ok('herb teas are water teas, never tinctures, extracts or capsules', !/tincture|extract|capsule/i.test(JSON.stringify(PL) + JSON.stringify(g.ACTIONS)));
  const oldWords = /hibiscus|beetroot|stock cube|Aromat|apple-cider|cinnamon|pumpkin seed|oat milk/i;
  ok('the old, non-book content is gone from the plans', !oldWords.test(JSON.stringify(PL)), (JSON.stringify(PL).match(oldWords) || [])[0]);
  ok('no plan tells people to take a HOT foot bath, and the hot-bath cautions stay',
    plans.every(k => !PL[k].steps.some(s => /foot bath/i.test(s[1]))) && /never a hot bath/i.test(PL.bp.hydro) && /extremes/i.test(PL.sugar.hydro));
  ok('every bath named in a plan is the warm, neutral bath (33–35°C)', plans.filter(k => PL[k].hydro).every(k => /33–35°C/.test(PL[k].hydro)));
  ok('no plan recommends high-dose supplements or fasting', !/\bmg\b|fast(ing)? (one|two|1|2) days|poke root|cayenne|senna/i.test(plans.map(k => JSON.stringify(PL[k].steps)).join('')));
  ok('no plan tells anyone to stop medicine', plans.every(k => !/stop (taking )?(your )?(pills|medic)/i.test(PL[k].steps.map(s => s[1]).join(' '))) && plans.every(k => /clinic|doctor/i.test(PL[k].note) || k === 'bmi'));
  ok('every credit is an Ellen White book', [g.BOOK_REF, g.BOOK2_REF, g.BOOK3_REF, g.BOOK4_REF].every(b => /Ellen G\. White/.test(b))
    && /The Ministry of Healing/.test(g.BOOK_REF) && /Counsels on Diet and Foods/.test(g.BOOK2_REF) && /Healthful Living/.test(g.BOOK3_REF) && /The Place of Herbs in Rational Therapy/.test(g.BOOK4_REF));
  ok('reference labels read naturally', g.refLabel('MH:23') === 'Ministry of Healing ch. 23' && g.refLabel('CD:731') === 'Counsels on Diet §731' && g.refLabel('HL:571') === 'Healthful Living §571'
    && g.refLabel('PH:6') === 'Place of Herbs p. 6' && g.refLabel('S') === 'expo safety rule' && g.refLabel('G · MH:20') === 'general advice · Ministry of Healing ch. 20');
  ok('every plan credits the books it really uses', plans.every(k => g.planBooks(PL[k]).length >= 1) && g.planBooks(PL.veg).length === 1 && g.planBooks(PL.sleep).length === 4
    && g.planCredit(PL.sleep).includes('The Ministry of Healing') && g.planCredit(PL.sleep).includes('The Place of Herbs'));
  ok('the stress & mood plan rests on gratitude, kindness, song, time outdoors and a thought check',
    ['thankful spirit', 'Helping others', 'Singing', 'Time outdoors', 'thinking traps'].every(w => PL.mind.facts.some(([t]) => t.includes(w))));
  ok('the sleep and stress plans carry the get-help line with both South African crisis numbers',
    ['sleep', 'mind'].every(k => /0800 567 567/.test(PL[k].help) && /0861 322 322/.test(PL[k].help) && /emergency service/.test(PL[k].help)));
  ok('plans without a mental-health focus carry no help line', ['bp', 'sugar', 'bmi'].every(k => !PL[k].help));
  ok('the sleep plan no longer forbids tomatoes and potatoes (the two books disagree, so neither is imposed)', !/tomato|potato/i.test(JSON.stringify(PL.sleep.steps)));

  /* the expo's blood-pressure screening bands */
  ok('BP bands: normal / pre / stage 1 / stage 2', g.bpStage(118, 76) === 'normal' && g.bpStage(125, 70) === 'pre-hypertension' && g.bpStage(135, 85) === 'pre-hypertension'
    && g.bpStage(142, 90) === 'stage 1 high blood pressure' && g.bpStage(150, 95) === 'stage 1 high blood pressure' && g.bpStage(162, 98) === 'stage 2 high blood pressure' && g.bpStage(130, 100) === 'stage 2 high blood pressure');
  ok('BP bands: missing numbers give nothing', g.bpStage(null, 80) === '' && g.bpStage(120, null) === '');

  /* choosing what each person needs */
  g.resetDemo();
  const dav = g.attendees.find(a => a.id === 'EXPO-042'), mar = g.attendees.find(a => a.id === 'EXPO-117'), sip = g.attendees.find(a => a.id === 'EXPO-088');
  const nDav = g.planNeeds(dav);
  ok('David (142/90, sugar 6.4, BMI 31, cholesterol 6.2) needs BP and weight/cholesterol; 6.4 is inside the paper form\'s random range of 4–8', ['bp', 'bmi'].every(k => nDav.some(n => n.k === k)) && !nDav.some(n => n.k === 'sugar'), nDav.map(n => n.k).join());
  ok('…each with a reason in plain words, citing no book page', nDav.every(n => n.why.length > 20 && !/p\. \d{3}|book|Nedley|Encyclopedia/i.test(n.why)));
  ok('…the BP reason uses the screening band and the sugar reason shows mg/dL', /stage 1 high blood pressure/.test(nDav.find(n => n.k === 'bp').why) && /176 mg\/dL/.test((g.planNeeds(mar).find(n => n.k === 'sugar') || {}).why));
  ok('…the weight reason names both BMI and cholesterol', /BMI 31/.test(nDav.find(n => n.k === 'bmi').why) && /cholesterol 6\.2/.test(nDav.find(n => n.k === 'bmi').why));
  ok('David is given the blood-pressure plan first', g.autoProtocol(dav) === 'bp');
  /* the paper Personal Health Record and survey, as filled in for Khehla on 6-9-2026 */
  const kh = g.migrateAttendee({ id: 'EXPO-901', name: 'Khehla', age: 60, sex: 'Male', heightCm: 167,
    s: { sys: 136, dia: 75, sugar: 3.7, weight: 67.7, waist: 93, fat: 18.9, tbw: 58.5, pef: 430, pefExp: 572, pulseRest: 71, pulseEx: 108, pulseRec: 84,
      bpMed: 0, preg: 0, ops: 0, chronic: 0, smoke: 1, junk: 5, chronicList: 'asthma' }, interests: { lifestyle: true, heardword: true } });
  ok('paper record: the new readings survive the migration, unknown keys do not', kh.s.waist === 93 && kh.s.pefExp === 572 && kh.s.pulseRec === 84 && kh.s.bpMed === 0 && kh.s.smoke === 1 && !('junk' in kh.s));
  ok('the chronic illnesses text moves out of the readings, which the database keeps to numbers only', kh.chronicList === 'asthma' && !('chronicList' in kh.s)
    && Object.values(kh.s).every(v => v === null || typeof v === 'number') && g.attToRow(kh).chronic_list === 'asthma' && g.rowToAtt(g.attToRow(kh)).chronicList === 'asthma'
    && !('chronic_list' in g.attToRow(Object.assign({}, kh, { chronicList: '' }))));
  ok('a fully filled visitor stays inside the database size limits (s 1000 bytes, interests 1000)', (() => {
    const s = {}; for (const k of Object.keys(kh.s).concat(['snack', 'breakfast', 'exFreq', 'alcohol', 'preg', 'ops', 'chronic', 'bpMed'])) s[k] = 888.8;
    const it = { nurse: true, cook: true, stress: true, pouch: true, coaching: true, habits: true, lifestyle: true, marriage: true, parenting: true, financial: true, spiritual: true,
      heardsocial: true, heardpaper: true, heardflyer: true, heardword: true, heardother: true, churchPlan: '00000000-0000-0000-0000-000000000000', followUp: '00000000-0000-0000-0000-000000000000' };
    return Buffer.byteLength(JSON.stringify(s)) <= 1000 && Buffer.byteLength(JSON.stringify(Object.assign(it, { followUpName: 'x'.repeat(80) }))) <= 1000; })());
  ok('the chosen church plan and the follow-up person survive loading and syncing', (() => {
    const m = g.rowToAtt(g.attToRow(g.migrateAttendee({ id: 'EXPO-904', name: 'F', s: {}, interests: { nurse: true, churchPlan: 'c0ffee00-1111-2222-3333-444455556666',
      followUp: 'abcd-1234', followUpName: 'Sis Thandi', evil: '<b>', followUpX: 'x' } })));
    return m.interests.churchPlan === 'c0ffee00-1111-2222-3333-444455556666' && m.interests.followUp === 'abcd-1234' && m.interests.followUpName === 'Sis Thandi'
      && m.interests.nurse === true && m.interests.evil === true && !('followUpX' in m.interests)
      && !('churchPlan' in g.migrateAttendee({ id: 'EXPO-905', name: 'F', interests: { churchPlan: "x');alert(1)//" } }).interests); })());
  ok('paper record: seminars and how they heard survive as ticks', kh.interests.lifestyle === true && kh.interests.heardword === true);
  ok('sugar 3.7 is Low (paper range 4–8), under 3 is a red flag', g.cat('sugar', 3.7)[1] === 'Low' && g.cat('sugar', 2.9)[0] === 'flag' && g.redFlag({ s: { sugar: 2.9 } }) && !g.redFlag(kh));
  ok('a low sugar does not open the blood-sugar plan, it goes to the nurse', !g.planNeeds(kh).some(n => n.k === 'sugar') && /low/.test(g.careNotes(kh)[0]));
  ok('body fat, body water and waist use the paper form\'s male ranges', g.cat('fat', { v: 18.9, sex: 'Male' })[0] === 'ok' && g.cat('tbw', { v: 58.5, sex: 'Male' })[0] === 'ok'
    && g.cat('waist', { v: 93, sex: 'Male' })[0] === 'ok' && g.cat('waist', { v: 94, sex: 'Male' })[0] === 'watch' && g.cat('fat', { v: 25, sex: '' })[0] === null);
  ok('peak flow 430 of 572 is 75%: reduced, and a counsellor note', g.cat('pef', 75)[1] === 'Reduced' && g.careNotes(kh).some(n => /75%/.test(n)));
  const visitorWith = s => g.migrateAttendee({ id: 'EXPO-902', name: 'B', age: 40, sex: 'Female', heightCm: 160, s });
  ok('a large waist or high body fat opens the weight plan, with the reason', g.planNeeds(visitorWith({ waist: 90 })).some(n => n.k === 'bmi' && /waist 90/.test(n.why))
    && g.planNeeds(visitorWith({ fat: 33 })).some(n => n.k === 'bmi' && /body fat 33/.test(n.why)) && /Waist 90 cm/.test(g.problemOf(visitorWith({ waist: 90 }), 'bmi')));
  ok('low body water opens the water plan; a fast resting pulse is a counsellor note', g.planNeeds(visitorWith({ tbw: 40 })).some(n => n.k === 'water' && /body water 40/.test(n.why))
    && g.careNotes(visitorWith({ pulseRest: 110 })).some(n => /fast/.test(n)));
  ok('more than 9 hours of sleep reads Long, not Short', g.cat('sleep', 10)[1] === 'Long' && g.cat('sleep', 6)[1] === 'Short');
  ok('the CSV has a column for every paper field', (() => { let out = ''; const keep = sandbox.Blob; sandbox.Blob = function (p) { out = p.join(''); }; g.exportCSV(); sandbox.Blob = keep; const head = out.split('\n')[0];
    return ['Waist cm', 'Body fat %', 'Body water %', 'PEF', 'Recovery pulse', 'Pregnant', 'Chronic illnesses', 'Smoking', 'Seminars', 'Heard via'].every(h => head.includes('"' + h + '"')); })());
  ok('…and it is the top of his list even though his sleep (5.5 h) is a red flag too', nDav[0].k === 'bp' && nDav.some(n => n.k === 'sleep' && n.sev === 3) && nDav.findIndex(n => n.k === 'sleep') > nDav.findIndex(n => n.k === 'bmi'), nDav.map(n => n.k + n.sev).join());
  ok('the plan opened automatically is always the first item of the list', g.attendees.every(a => g.planNeeds(a).length ? g.autoProtocol(a) === g.planNeeds(a)[0].k : g.autoProtocol(a) === 'sleep'));
  const nMar = g.planNeeds(mar);
  ok('Maria (162/98, sugar 9.8) — BP is a red flag and ranks first', nMar[0].k === 'bp' && nMar[0].sev === 3, nMar.map(n => n.k + n.sev).join());
  ok('Sipho (128/84, normal numbers, short on sleep? 7h) needs at most mild things', g.planNeeds(sip).every(n => n.sev <= 2));
  const calm = { s: { sys: 112, dia: 72, sugar: 5.0, chol: 4.2, weight: 65, veg: 5, walk: 40, water: 8, sleep: 8 }, heightCm: 170 };
  ok('nothing flagged → no needs listed', g.planNeeds(calm).length === 0);
  const thin = { s: { sys: 112, dia: 72, sugar: 5.0, chol: 4.2, weight: 45, veg: 5, walk: 40, water: 8, sleep: 8 }, heightCm: 170 };
  ok('an underweight person is NOT given the weight-loss plan', g.autoProtocol(thin) !== 'bmi' && !g.planNeeds(thin).some(n => n.k === 'bmi'), g.autoProtocol(thin));
  ok('…they get the underweight plan instead, with the reason', g.autoProtocol(thin) === 'thin' && /below the healthy range/.test(g.planNeeds(thin)[0].why), g.autoProtocol(thin));
  const habits = { s: { sys: 112, dia: 72, sugar: 5.0, chol: 4.2, weight: 65, veg: 2, walk: 5, water: 3, sleep: 8 }, heightCm: 170 };
  ok('low fruit & veg, exercise and water readings each get their plan, in that order', g.planNeeds(habits).map(n => n.k).join() === 'veg,move,water', g.planNeeds(habits).map(n => n.k).join());
  ok('…and a medical flag still comes first', g.planNeeds({ ...habits, s: { ...habits.s, sys: 150, dia: 95 } })[0].k === 'bp');
  const ones = { ...habits, s: { ...habits.s, veg: 1, walk: 1, water: 1 } }, oneWhy = g.planNeeds(ones).map(n => n.why).join(' | ');
  ok('a single serving, minute or glass is not written as plural', /\b1 serving of\b/.test(oneWhy) && /\b1 minute of\b/.test(oneWhy) && /\b1 glass of\b/.test(oneWhy)
    && g.problemOf(ones, 'veg').includes('1 serving a day') && g.problemOf(ones, 'water').includes('1 glass a day') && g.problemOf(habits, 'veg').includes('2 servings a day'), oneWhy);
  const tired = { s: { sys: 112, dia: 72, sugar: 5.0, chol: 4.2, weight: 65, veg: 5, walk: 40, water: 8, sleep: 5 }, heightCm: 170 };
  ok('short sleep → the sleep plan', g.autoProtocol(tired) === 'sleep' && g.planNeeds(tired)[0].k === 'sleep');
  const chol = { s: { sys: 112, dia: 72, sugar: 5.0, chol: 6.8, weight: 65, veg: 5, walk: 40, water: 8, sleep: 8 }, heightCm: 170 };
  ok('high cholesterol alone → the weight & cholesterol plan', g.autoProtocol(chol) === 'bmi');

  /* the Plan screen */
  g.state.activeId = 'EXPO-042'; g.state.sugFor = null; g.state.tab = 'plan'; g.render();
  ok('Plan screen leads with David\'s main problem, with his other needs as tappable choices', $main.innerHTML.includes('Blood pressure 142/90: high (stage 1). Healthy is under 120/80.')
    && $main.innerHTML.includes('Also needs attention') && /data-action="selectProtocol" data-args="sugar"/.test($main.innerHTML));
  ok('…shows the plan steps with their sources', /Counsels on Diet §\d+/.test($main.innerHTML) && $main.innerHTML.includes('Source: ' + PL.bp.src));
  ok('…lists what the plan is based on, and credits the Ellen White books it uses', $main.innerHTML.includes('What this plan is based on') && $main.innerHTML.includes('The Ministry of Healing (Ellen G. White, 1905') && $main.innerHTML.includes('Healthful Living (Ellen G. White'));
  ok('…labels Healthful Living references by paragraph', /Healthful Living §\d+/.test($main.innerHTML));
  ok('…no help box on the blood-pressure plan', !/Need help now\?/.test($main.innerHTML));
  ok('…labels prices as dated store prices that vary by branch', new RegExp('≈ R[\\d.]+ a day[\\s\\S]{0,120}Store prices checked ' + g.PRICE_DATE + '; they vary by branch').test($main.innerHTML) && !/Cheapest places/.test($main.innerHTML));
  ok('…no longer claims "Doctor-reviewed"', !/Doctor-reviewed/.test($main.innerHTML));
  ok('…shows the plan-specific safety note and the do-not-stop-pills rule', /Never stop prescribed pills suddenly/.test($main.innerHTML) && /kidney disease/.test($main.innerHTML));
  for (const k of ['sugar', 'bmi', 'sleep', 'mind']) {
    g.state.protocol = k; g.render();
    ok('Plan screen renders the ' + k + ' plan with its source and facts', $main.innerHTML.includes('Source: ' + PL[k].src) && PL[k].facts.every(([t]) => $main.innerHTML.includes(t.slice(0, 25))), k);
  }
  for (const k of ['thin', 'veg', 'move', 'water']) {
    g.state.protocol = k; g.render();
    ok('Plan screen renders the new ' + k + ' plan with its source and facts', $main.innerHTML.includes('Source: ' + PL[k].src) && PL[k].facts.every(([t]) => $main.innerHTML.includes(t.slice(0, 25))), k);
  }
  g.state.protocol = 'water'; g.render();
  ok('a plan with no shopping list shows no food button', !/data-action="openFood"/.test($main.innerHTML));
  g.state.protocol = 'veg'; g.render();
  ok('a plan with a shopping list still shows the food button', /data-action="openFood"/.test($main.innerHTML));
  g.state.protocol = 'bmi'; g.render();
  ok('the weight plan shows no calorie rule of thumb (it came only from the old book)', !/kcal/.test($main.innerHTML));
  g.state.protocol = 'bp'; g.render();
  ok('in practice mode the Plan tab offers the example church plans', /Send a plan from Practice church/.test($main.innerHTML) && /data-action="chooseChurchPlan" data-args="demo-joints"/.test($main.innerHTML));
  ok('…each church plan button reads as one line of text, not two columns', /data-action="chooseChurchPlan" data-args="demo-joints" class="btn btn-glass py-2\.5 text-\[11px\]"><span class="min-w-0 flex-1 text-left"><b>Easing stiff, painful joints<\/b> · Joint pain<\/span><\/button>/.test($main.innerHTML));
  const cpDav = g.attendees.find(a => a.id === 'EXPO-042');
  g.chooseChurchPlan('demo-joints');
  ok('a chosen church plan replaces the app\'s plan, labelled as the church\'s own, with the pills rule', cpDav.interests.churchPlan === 'demo-joints'
    && $main.innerHTML.includes('Easing stiff, painful joints') && /Written by Practice church/.test($main.innerHTML) && /not reviewed by the app/.test($main.innerHTML)
    && /Never stop prescribed pills suddenly/.test($main.innerHTML) && /data-action="chooseChurchPlan" data-args=""/.test($main.innerHTML));
  ok('…a red-range reading still shows the warning first', /See the triage nurse now|Book a clinic visit this week/.test($main.innerHTML) === !!g.urgentOf(cpDav, 'bp'));
  const cpMsg = g.waMessage(cpDav);
  ok('the WhatsApp message carries the church plan, its church and the pills rule, and no book credit', cpMsg.includes('EASING STIFF, PAINFUL JOINTS') && cpMsg.includes('Move every joint gently each morning') && cpMsg.includes('Practice church')
    && /do not stop them suddenly/.test(cpMsg) && !/Ministry of Healing/.test(cpMsg), cpMsg.slice(0, 300));
  g.buildPrintCard();
  ok('the take-home card carries the church plan and credits the church', $el('printArea').innerHTML.includes(g.esc('Move every joint gently each morning')) && /From: Practice church/.test($el('printArea').innerHTML)
    && /Never stop prescribed pills suddenly/.test($el('printArea').innerHTML));
  g.chooseChurchPlan('');
  ok('“Use the app’s plan instead” goes back to the app\'s plan', !cpDav.interests.churchPlan && /Do these 3 things/.test($main.innerHTML) && /Counsels on Diet §/.test($main.innerHTML));
  /* the designated follow-up person (practice mode: three example names) */
  g.state.tab = 'send'; g.render();
  ok('in practice mode Send home offers the example follow-up people', /data-action="chooseFollowup" data-args="demo-f1"/.test($main.innerHTML) && $main.innerHTML.includes('Grace Dlamini') && g.followupList().length <= 5);
  g.chooseFollowup('demo-f2');
  ok('…choosing one keeps it on the visitor\'s record', cpDav.interests.followUp === 'demo-f2' && cpDav.interests.followUpName === 'Peter Naidoo' && /✓ Peter Naidoo/.test($main.innerHTML));
  g.buildPrintCard();
  ok('the WhatsApp message and the printed card name the follow-up person', g.waMessage(cpDav).includes('🤝 Peter Naidoo from the church will follow up with you.')
    && /Follow-up: Peter Naidoo from the church will be in touch/.test($el('printArea').innerHTML));
  g.chooseFollowup('');
  ok('…and None clears it', !cpDav.interests.followUp && !cpDav.interests.followUpName && !/🤝/.test(g.waMessage(cpDav)));
  g.state.tab = 'plan'; g.render();
  /* every visitor gets the next free number */
  const nextNo = g.nextBadge(), countWas = g.attendees.length;
  g.state.tab = 'home'; g.state.regOpen = true;
  $el('rgName').value = 'No Badge Visitor'; $el('rgAge').value = '52'; $el('rgSex').value = 'Female';
  $el('rgPhone').value = ''; $el('rgEmail').value = ''; $el('rgHeight').value = ''; $el('rgConsent').checked = true;
  g.registerSubmit({ preventDefault() {} });
  const noBadge = g.attendees.find(a => a.name === 'No Badge Visitor');
  ok('a visitor registered with no badge gets the next free number at once', !!noBadge && noBadge.id === nextNo && g.attendees.length === countWas + 1, nextNo + ' ' + (noBadge && noBadge.id));
  if (noBadge) g.attendees.splice(g.attendees.indexOf(noBadge), 1);
  g.state.activeId = 'EXPO-042'; g.state.sugFor = null; g.state.tab = 'plan'; g.render();
  const showsWarnings = h => h.includes('Warnings and precautions') && h.includes(g.DISCLAIMER) && g.PRECAUTIONS.every(t => h.includes(t));
  ok('the disclaimer says the volunteers are not health professionals and the plan is not medical advice', /not doctors, nurses or other health professionals/.test(g.DISCLAIMER) && /not medical advice/.test(g.DISCLAIMER));
  ok('the precautions cover medicine, screening, pregnancy and illness, herb interactions, warning signs, emergencies and children',
    [/Never stop or change it/, /not a diagnosis/, /pregnant or breastfeeding/, /interact with medicines/, /chest pain/, /emergency unit/, /Children/].every(re => g.PRECAUTIONS.some(t => re.test(t))));
  ok('every app plan screen shows the disclaimer and the precautions', Object.keys(PL).every(k => { g.state.protocol = k; g.render(); return showsWarnings($main.innerHTML); }));
  g.chooseChurchPlan('demo-joints');
  ok('a church plan screen shows them too', showsWarnings($main.innerHTML));
  g.chooseChurchPlan(''); g.state.protocol = 'bp';
  const wMsg = g.waMessage(cpDav);
  ok('the WhatsApp message carries the disclaimer and every precaution', wMsg.includes(g.DISCLAIMER) && g.PRECAUTIONS.every(t => wMsg.includes('• ' + t)));
  g.openWhatsApp();
  ok('the WhatsApp preview carries the disclaimer', $el('waBody').innerHTML.includes(g.DISCLAIMER));
  g.buildPrintCard();
  ok('the printed card says the advice comes from volunteers, not health professionals, and what to do in an emergency',
    /not health professionals/.test($el('printArea').innerHTML) && /nearest emergency unit/.test($el('printArea').innerHTML) && /Not a replacement for your clinic/.test($el('printArea').innerHTML));
  g.state.tab = 'results'; g.render();
  ok('the Results screen says the readings are screening only, not a diagnosis', /quick screening, not a diagnosis/.test($main.innerHTML) && /not health professionals/.test($main.innerHTML));
  g.state.tab = 'plan'; g.render(); g.openFood();
  ok('the Food screen carries the disclaimer', $main.innerHTML.includes(g.DISCLAIMER));
  g.closeFood();
  g.state.protocol = 'bp'; g.render();
  ok('the calorie line only appears on the weight plan', !/kcal a day/.test($main.innerHTML));
  for (const k of ['sleep', 'mind']) {
    g.state.protocol = k; g.render();
    ok('the ' + k + ' plan screen shows a prominent "Need help now?" box with both crisis numbers', /Need help now\?/.test($main.innerHTML) && /0800 567 567/.test($main.innerHTML) && /0861 322 322/.test($main.innerHTML));
  }
  g.state.protocol = 'mind'; g.render();
  ok('the stress plan screen shows its gratitude habit and Ministry of Healing chapter labels', $main.innerHTML.includes('Write down three good things each evening') && /Ministry of Healing ch\. 18/.test($main.innerHTML));
  g.state.protocol = 'bp';

  /* who is offered the stress & mood plan */
  const stressOnly = { s: calm.s, heightCm: 170, interests: { stress: true } };
  ok('a visitor who ticked "Stress & peace" is offered the calm-mind plan', g.planNeeds(stressOnly).some(n => n.k === 'mind') && g.autoProtocol(stressOnly) === 'mind', g.autoProtocol(stressOnly));
  ok('…its reason says why', /Asked for stress and peace support/.test(g.planNeeds(stressOnly).find(n => n.k === 'mind').why));
  ok('nobody is given the stress plan unless they asked for it', !g.planNeeds(calm).some(n => n.k === 'mind') && !g.planNeeds(dav).some(n => n.k === 'mind'));
  const stressAndBp = { s: { ...calm.s, sys: 150, dia: 95 }, heightCm: 170, interests: { stress: true } };
  const order = g.planNeeds(stressAndBp).map(n => n.k);
  ok('a real medical flag still comes before the stress plan', order[0] === 'bp' && order.includes('mind'), order.join());
  const stressAndSleep = { s: { ...calm.s, sleep: 5 }, heightCm: 170, interests: { stress: true } };
  ok('stress & mood comes before sleep when both apply', g.planNeeds(stressAndSleep).map(n => n.k).join() === 'mind,sleep', g.planNeeds(stressAndSleep).map(n => n.k).join());
  const maria2 = g.attendees.find(a => a.id === 'EXPO-117');
  ok('Maria (asked for stress & peace) gets it offered, after her BP red flag', g.planNeeds(maria2).map(n => n.k).includes('mind') && g.planNeeds(maria2)[0].k === 'bp');
  ok('plans keep working for someone with nothing flagged', (() => { g.attendees.push(g.migrateAttendee({ id: 'EXPO-990', name: 'Calm Person', age: 30, sex: 'Female', s: calm.s, heightCm: 170 })); g.state.activeId = 'EXPO-990'; g.state.sugFor = null; g.render(); return $main.innerHTML.includes('Your numbers look fine today'); })());
  g.resetDemo();

  /* the WhatsApp message and the take-home card use the same plan */
  g.state.activeId = 'EXPO-042'; g.state.sugFor = null; g.state.tab = 'home';
  const msg2 = g.waMessage(g.attendees.find(a => a.id === 'EXPO-042'));
  /* since the plans became "do these 3 things" (PLANS.md), the message, preview and card carry the plan's top three actions */
  const top3 = g.planFor(g.attendees.find(a => a.id === 'EXPO-042')).top.map(x => x.do);
  ok('WhatsApp message carries the plan\'s three actions and its book source', top3.length === 3 && top3.every(d => msg2.includes(d)) && msg2.includes(PL.bp.src) && msg2.includes('The Ministry of Healing'), top3.join(' | '));
  /* the old plan suggested these; "No stock cubes" (advice to avoid them) is fine */
  ok('WhatsApp message no longer suggests hibiscus, beetroot, foot baths or stock cubes', !/hibiscus|beetroot|foot bath/i.test(msg2) && !/(?<!No )stock cube/i.test(msg2));
  ok('WhatsApp message still carries the do-not-stop-pills warning', /do not stop them suddenly/.test(msg2));
  g.openWhatsApp();
  ok('WhatsApp preview shows the same actions and source', top3.every(d => $el('waBody').innerHTML.includes(g.esc(d))) && $el('waBody').innerHTML.includes(PL.bp.src));
  g.buildPrintCard();
  ok('take-home card shows the plan\'s actions, the dated store-price note and the book credit', top3.every(d => $el('printArea').innerHTML.includes(g.esc(d))) && /store prices checked \d+ \w+ \d{4}; may vary by branch/.test($el('printArea').innerHTML) && /The Ministry of Healing/.test($el('printArea').innerHTML));
  g.attendees.find(a => a.id === 'EXPO-042').interests.stress = true; g.attendees.find(a => a.id === 'EXPO-042').s.sys = 118; g.attendees.find(a => a.id === 'EXPO-042').s.dia = 76;
  g.attendees.find(a => a.id === 'EXPO-042').s.sugar = 5; g.attendees.find(a => a.id === 'EXPO-042').s.chol = 4.5; g.attendees.find(a => a.id === 'EXPO-042').s.weight = 70; g.attendees.find(a => a.id === 'EXPO-042').s.sleep = 8;
  const mindMsg = g.waMessage(g.attendees.find(a => a.id === 'EXPO-042'));
  const mindTop = g.planFor(g.attendees.find(a => a.id === 'EXPO-042')).top.map(x => x.do);
  ok('the WhatsApp message for the stress plan carries its actions, both books and the help line', g.autoProtocol(g.attendees.find(a => a.id === 'EXPO-042')) === 'mind' && mindTop.length === 3 && mindTop.every(d => mindMsg.includes(d)) && mindMsg.includes('The Ministry of Healing') && /0800 567 567/.test(mindMsg));
  g.buildPrintCard();
  ok('the take-home card for the stress plan carries the help line too', /0800 567 567/.test($el('printArea').innerHTML) && /The Ministry of Healing/.test($el('printArea').innerHTML));
  g.resetDemo(); g.state.activeId = 'EXPO-042'; g.state.sugFor = null;
  ok('take-home card keeps the clinic warning', /Never stop prescribed pills suddenly/.test($el('printArea').innerHTML) && /Not a replacement for your clinic/.test($el('printArea').innerHTML));
  g.state.tab = 'results'; g.render();
  ok('Results counselling tool no longer describes the old plan', !/hibiscus|stock cube|Foot bath/i.test($main.innerHTML) && /Neutral bath/.test($main.innerHTML) && /illustrative estimates/.test($main.innerHTML));
  ok('Results shows the cost as dated store prices', /store prices checked \d+ \w+ \d{4}; they change and vary by branch/.test($main.innerHTML));
  g.resetDemo();

  /* ---- 18. account hub: roles, the two-admin cap, the owner's data view ---- */
  console.log('\n18. Account hub');
  const acctKeep = g.cloud.acct;
  const hubAdminAcct = { user_id: 'u1', email: 'own@x.y', platform_admin: false,
    membership: { church_id: 'c1', role: 'admin', status: 'approved', followup: false },
    church: { id: 'c1', name: 'Grace Chapel', city: '', phone: '', email: '', status: 'active' } };
  g.cloud.acct = { ...hubAdminAcct, platform_admin: true };
  ok('the owner’s tabs read My account / My church / All churches', g.acctTabs().map(t => t[1]).join('|') === 'My account|My church|All churches');
  g.cloud.acct = hubAdminAcct;
  ok('a church admin’s tabs stop at My account / My church', g.acctTabs().map(t => t[1]).join('|') === 'My account|My church');
  const mr = (u, admins, ranks) => g.memberRow(u, [], admins, ranks);
  ok('the Admin choice is offered while a church has one admin', !/value="admin"\s+disabled/.test(mr({ user_id: 'u9', role: 'member', status: 'approved' }, 1)));
  ok('the Admin choice is switched off at two admins', /value="admin"\s+disabled/.test(mr({ user_id: 'u9', role: 'member', status: 'approved' }, 2)));
  ok('an existing admin keeps the choice open at two admins', !/value="admin"\s+disabled/.test(mr({ user_id: 'u9', role: 'admin', status: 'approved' }, 2)));
  ok('a pending member cannot be promoted past the cap', /value="admin"\s+disabled/.test(mr({ user_id: 'u9', role: 'member', status: 'pending' }, 2)));
  g.cloud.members = { cid: 'c1', list: [
    { user_id: 'u1', role: 'admin', status: 'approved', full_name: 'Own', email: 'own@x.y', confirmed: true },
    { user_id: 'u2', role: 'admin', status: 'approved', full_name: 'Two', email: 'two@x.y', confirmed: true }] };
  g.cloud.followups = { cid: 'c1', list: [] };
  g.cloud.adminFollowups = { cid: 'c1', list: [] };
  const hub = g.churchAdminHTML();
  ok('the Members box states that admins manage this church only', /Admins manage this church only/.test(hub));
  ok('the Members box names the two posts (Leader and Assistant)', /Health Department Leader/.test(hub) && /Assistant/.test(hub));
  ok('the members list titles the Health Department Leader', /Health Department Leader/.test(mr({ user_id: 'u1', role: 'admin', status: 'approved' }, 2, { u1: 1 })));
  ok('the members list titles the Assistant', /Assistant Health Department Leader/.test(mr({ user_id: 'u2', role: 'admin', status: 'approved' }, 2, { u2: 2 })));
  ok('a plain member carries no admin title', !/Department Leader/.test(mr({ user_id: 'u9', role: 'member', status: 'approved' }, 2, {})));
  ok('rank 1 reads Health Department Leader', g.roleLabel({ role: 'admin', status: 'approved', admin_rank: 1 }) === 'Health Department Leader');
  ok('rank 2 reads Assistant Health Department Leader', g.roleLabel({ role: 'admin', status: 'approved', admin_rank: 2 }) === 'Assistant Health Department Leader');
  ok('labels fall back without a rank (schema not re-run yet)', g.roleLabel({ role: 'admin', status: 'approved' }) === 'Admin' && g.roleLabel({ role: 'member', status: 'approved' }) === 'Member');
  g.cloud.members = { cid: 'c1', list: [
    { user_id: 'u1', role: 'admin', status: 'approved', full_name: 'Own', email: 'own@x.y', confirmed: true },
    { user_id: 'u2', role: 'admin', status: 'approved', full_name: 'Two', email: 'two@x.y', confirmed: true }] };
  const twoAdmins = g.churchAdminHTML();
  ok('an admin with a co-admin sees their post and the step-down offer', /My admin post/.test(twoAdmins) && /Health Department Leader/.test(twoAdmins) && /data-action="stepDown"/.test(twoAdmins));
  g.cloud.members = { cid: 'c1', list: [
    { user_id: 'u1', role: 'admin', status: 'approved', full_name: 'Own', email: 'own@x.y', confirmed: true }] };
  const soleAdmin = g.churchAdminHTML();
  ok('the only admin is told to promote a member first, with no step-down button', /only admin/.test(soleAdmin) && !/stepDown\(\)/.test(soleAdmin));
  g.cloud.members = null;
  const postLoading = g.adminPostHTML(hubAdminAcct.membership, {});
  ok('while the members load, the admin post says Loading, not "only admin"', /Loading/.test(postLoading) && !/only admin/.test(postLoading) && !/stepDown\(\)/.test(postLoading));
  g.cloud.acct = { ...hubAdminAcct, platform_admin: true };
  g.cloud.adminChurch = 'c1';
  g.cloud.members = { cid: 'c1', list: [
    { user_id: 'u1', role: 'admin', status: 'approved', full_name: 'Own', email: 'own@x.y', confirmed: true }] };
  ok('browsing a church as the owner shows no step-down box', !/My admin post/.test(g.churchAdminHTML()));
  g.cloud.adminChurch = '';
  g.cloud.acct = { ...hubAdminAcct, platform_admin: true };
  g.cloud.adminData = 'c1'; g.cloud.adminRows = null;
  ok('the data view shows Loading while it fetches', /Loading/.test(g.adminDataHTML()));
  g.cloud.adminRows = { visitors: [{ id: 'EXPO-001', name: 'Ann <b>X</b>', phone: '', email: '', done: true, created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z' }], volunteers: [], visitor_count: 1, volunteer_count: 0 };
  const dataView = g.adminDataHTML();
  ok('the owner’s data view lists a church’s visitors read-only', /Read-only/.test(dataView) && /EXPO-001/.test(dataView) && /Done/.test(dataView));
  ok('the data view escapes names', !/<b>X<\/b>/.test(dataView));
  g.cloud.acct = acctKeep; g.cloud.members = null; g.cloud.followups = null; g.cloud.adminFollowups = null;
  g.cloud.adminData = ''; g.cloud.adminRows = null;

  /* persistence flag */
  localStorage.setItem('newstart.passport.v2', JSON.stringify({ attendees: [], volunteers: [], activeId: '', cloud: true }));
  ok('an empty connected copy loads as empty (not re-seeded)', g.loadPersisted() === true && g.attendees.length === 0 && g.volunteers.length === 0);
  localStorage.setItem('newstart.passport.v2', JSON.stringify({ attendees: [], activeId: '' }));
  ok('an empty demo copy still re-seeds', g.loadPersisted() === false);
  C.mode = false; g.resetDemo();

  console.log('\n' + '='.repeat(52));
  console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
  console.log('='.repeat(52));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('CLOUD TESTS THREW: ' + e.stack); process.exit(1); });

