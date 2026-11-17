/* fix-plan-ui/config.js: intro, every screen size, quicker screens, no launch flash. */
const NEW_TESTS = [
  'intro: the logo is in the page itself, so it shows before any script runs',
  'intro: the logo pops in and beats once, then the app rises into place',
  'intro: it leaves on its own and never holds the app back',
  'intro: people who ask for less motion do not see it',
  'screens: the header never makes the page wider than the phone',
  "screens: the header and the tabs clear the phone's status bar and gesture bar",
  'screens: a long visitor name wraps on the Home card instead of being cut',
  'screens: cards arrive within half a second and progress bars fill in half a second',
  "app: Android's launch screen uses the app's colour and logo",
  "app: the web view starts in the app's colour (no white flash)",
];

module.exports = {
  edited: ['index.html', '.smoke/harness.js', 'capacitor/android/app/src/main/res/values/styles.xml', 'capacitor/capacitor.config.json'],
  generated: ['dist/index.html', 'dist/sw.js'],
  generate: { cmd: 'node', args: ['tools/build.js'] },

  /* mobile/ is the abandoned React Native folder; www, public and assets are Capacitor's generated copies of the page */
  skipDirs: ['fix-plan-ui', '.git', 'node_modules', '.claude', 'build', '.gradle', 'coverage', '.cxx', 'mobile', 'www', 'public', 'assets', 'capacitor-cordova-android-plugins'],
  skipFiles: ['FIX-PLAN-ui.md'],

  test: {
    cmd: 'node', args: ['.smoke/harness.js'], shell: false, timeoutSec: 600,
    line: '^\\s*(PASS|FAIL)\\s+(.*?)(?:\\s+→.*)?\\s*$', pass: 'PASS', fail: 'FAIL',
    /* drops a trailing "(… 75 ms …)" or "(3900 rows vs 390: 9.7x)": measurements that change on every run */
    normalize: '\\s*\\((?:[^()]*?\\d+(?:\\.\\d+)?\\s*ms\\b[^()]*|[^()]*:\\s*\\d+(?:\\.\\d+)?x)\\)\\s*$',
  },
  parallel: 3,

  targets: [],
  requiredPass: NEW_TESTS,
  obsoleteNames: [],
  unrelatedFails: [],
  flaky: [
    '500 live inserts from other desks are applied',
    'Care with 600 urgent + 1000 call-backs draws a capped set',
    'change detection grows in step with the rows',
    'first full pull finished in a sensible time',
    'saving to the device is fast',
    'the whole backlog uploads on reconnect',
  ],

  anchors: [
    { file: 'index.html', needle: '<header class="sticky top-0 z-30 px-3 pt-3">' },
    { file: 'index.html', needle: '<div class="leading-tight" style="white-space:nowrap">' },
    { file: 'index.html', needle: 'style="padding-bottom:max(.75rem,env(safe-area-inset-bottom))"' },
    { file: 'index.html', needle: '.stagger>*{animation:rise .7s' },
    { file: 'index.html', needle: '.stagger>*:nth-child(9){animation-delay:.41s}' },
    { file: 'index.html', needle: '.bar-fill{animation:fillIn 1.1s' },
    { file: 'index.html', needle: '  .lite .medal::after{display:none}' },
    { file: 'index.html', needle: ' idle(()=>{loadScript(QRJS).catch(()=>{});});' },
    { file: 'capacitor/android/app/src/main/res/values/styles.xml', needle: '<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">' },
    { file: 'capacitor/capacitor.config.json', needle: '"webDir": "www",' },
  ],

  invariants: [
    { id: 'content', desc: 'the plans, actions, food reasons and prices are byte-identical', file: 'index.html', regex: 'const BOOK_REF=([\\s\\S]*?)\\nconst HUES=' },
    { id: 'logic', desc: 'the health logic is byte-identical', file: 'index.html', regex: 'function cat\\(key,v\\)\\{([\\s\\S]*?)/\\* ================= NUMBER TWEEN' },
    { id: 'plan', desc: 'plan matching is byte-identical', file: 'index.html', regex: 'function planNeeds\\(a\\)\\{([\\s\\S]*?)\\nfunction viewPlan\\(\\)' },
    { id: 'sync', desc: 'the Supabase sync code is byte-identical', file: 'index.html', regex: 'async function cloudSync\\(([\\s\\S]*?)\\nfunction startRealtime' },
    { id: 'sw', desc: 'sw.js is byte-identical', file: 'sw.js', regex: '([\\s\\S]*)' },
  ],

  checks: [
    { id: 'harness-syntax', desc: 'the harness is valid JavaScript', cmd: 'node', args: ['--check', '.smoke/harness.js'] },
    { id: 'config-json', desc: 'capacitor.config.json is valid JSON', cmd: 'node', args: ['-e', "JSON.parse(require('fs').readFileSync('capacitor/capacitor.config.json','utf8'))"] },
  ],

  mutations: [
    { id: 'M1', what: 'the intro never leaves', file: 'index.html',
      find: ' setTimeout(leave,Math.max(120,1100-performance.now()));\n', replace: '',
      mustFail: ['intro: it leaves on its own and never holds the app back'] },
    { id: 'M2', what: 'reduced-motion users still get the intro', file: 'index.html',
      find: '  @media (prefers-reduced-motion:reduce){#intro{display:none}', replace: '  @media (prefers-reduced-motion:reduce){#introX{display:none}',
      mustFail: ['intro: people who ask for less motion do not see it'] },
    { id: 'M3', what: 'the header can no longer shrink (narrow phones get a page wider than the screen)', file: 'index.html',
      find: '  .hdr-tools{min-width:0;flex:0 1 auto}\n', replace: '',
      mustFail: ['screens: the header never makes the page wider than the phone'] },
    { id: 'M4', what: 'the header ignores the status bar again', file: 'index.html',
      find: 'style="padding-top:max(.75rem,calc(var(--safe-area-inset-top,0px) + .5rem),calc(env(safe-area-inset-top,0px) + .5rem))"', replace: 'style="padding-top:.75rem"',
      mustFail: ["screens: the header and the tabs clear the phone's status bar and gesture bar"] },
    { id: 'M5', what: 'a long name is cut on Home again', file: 'index.html',
      find: '  .hero .display.truncate{white-space:normal;', replace: '  .hero .display.truncateX{white-space:normal;',
      mustFail: ['screens: a long visitor name wraps on the Home card instead of being cut'] },
    { id: 'M6', what: 'cards take 0.7 s to arrive again', file: 'index.html',
      find: '  .stagger>*,.pour>*{animation-duration:.3s}\n', replace: '',
      mustFail: ['screens: cards arrive within half a second and progress bars fill in half a second'] },
    { id: 'M7', what: 'progress bars take 1.1 s again', file: 'index.html',
      find: '  .bar-fill{animation-duration:.5s}\n', replace: '',
      mustFail: ['screens: cards arrive within half a second and progress bars fill in half a second'] },
    { id: 'M8', what: 'Android shows a plain grey launch screen again', file: 'capacitor/android/app/src/main/res/values/styles.xml',
      find: '        <item name="windowSplashScreenBackground">#F6F8F6</item>\n', replace: '',
      mustFail: ["app: Android's launch screen uses the app's colour and logo"] },
    { id: 'M9', what: 'the web view starts white again', file: 'capacitor/capacitor.config.json',
      find: '  "backgroundColor": "#f6f8f6",\n', replace: '',
      mustFail: ["app: the web view starts in the app's colour (no white flash)"] },
    { id: 'M10', what: 'the intro logo is added by script instead of being in the page', file: 'index.html',
      find: '<div id="intro" aria-hidden="true"><div class="intro-badge">', replace: '<div id="introX" aria-hidden="true"><div class="intro-badge">',
      mustFail: ['intro: the logo is in the page itself, so it shows before any script runs'] },
    { id: 'M11', what: 'the logo no longer beats', file: 'index.html',
      find: 'animation:introPop .45s cubic-bezier(.34,1.56,.64,1) both,introBeat .6s .5s ease-in-out both}', replace: 'animation:introPop .45s cubic-bezier(.34,1.56,.64,1) both}',
      mustFail: ['intro: the logo pops in and beats once, then the app rises into place'] },
  ],
};
