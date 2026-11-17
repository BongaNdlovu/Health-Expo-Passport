/* fix-plan-intro/config.js: the intro waits for the logo's own animation instead of a clock. */
const NEW_TESTS = [
  "intro: it waits for the logo's animation to finish, however late the page first paints",
  'intro: it still leaves 1.6 s after the logo appears if the animation stalls',
  'intro: it still leaves after 5 s if the logo never gets to show',
  'intro: it leaves only once, however many of its timers fire',
  'intro: browsers that cannot report animations get the old timing',
];

module.exports = {
  edited: ['index.html', '.smoke/harness.js'],
  generated: ['dist/index.html', 'dist/sw.js'],
  generate: { cmd: 'node', args: ['tools/build.js'] },

  /* mobile/ is the abandoned React Native folder; www, public and assets are Capacitor's generated copies of the page */
  skipDirs: ['fix-plan-intro', '.git', 'node_modules', '.claude', 'build', '.gradle', 'coverage', '.cxx', 'mobile', 'www', 'public', 'assets', 'capacitor-cordova-android-plugins'],
  skipFiles: ['FIX-PLAN-intro.md'],

  test: {
    cmd: 'node', args: ['.smoke/harness.js'], shell: false, timeoutSec: 600,
    line: '^\\s*(PASS|FAIL)\\s+(.*?)(?:\\s+→.*)?\\s*$', pass: 'PASS', fail: 'FAIL',
    /* drops a trailing "(… 75 ms …)" or "(3900 rows vs 390: 9.7x)": measurements that change on every run */
    normalize: '\\s*\\((?:[^()]*?\\d+(?:\\.\\d+)?\\s*ms\\b[^()]*|[^()]*:\\s*\\d+(?:\\.\\d+)?x)\\)\\s*$',
  },
  parallel: 3,

  targets: [],
  requiredPass: [...NEW_TESTS, 'intro: it leaves on its own and never holds the app back'],
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
    { file: 'index.html', needle: ' setTimeout(leave,Math.max(120,1100-performance.now()));\n})();' },
    { file: 'index.html', needle: '<div id="intro" aria-hidden="true"><div class="intro-badge">' },
    { file: 'index.html', needle: 'animation:introPop .45s cubic-bezier(.34,1.56,.64,1) both,introBeat .6s .5s ease-in-out both}' },
    { file: '.smoke/harness.js', needle: "  console.log('\\n17. Cloud sync (fake Supabase)');" },
  ],

  invariants: [
    { id: 'content', desc: 'the plans, actions, food reasons and prices are byte-identical', file: 'index.html', regex: 'const BOOK_REF=([\\s\\S]*?)\\nconst HUES=' },
    { id: 'logic', desc: 'the health logic is byte-identical', file: 'index.html', regex: 'function cat\\(key,v\\)\\{([\\s\\S]*?)/\\* ================= NUMBER TWEEN' },
    { id: 'sync', desc: 'the Supabase sync code is byte-identical', file: 'index.html', regex: 'async function cloudSync\\(([\\s\\S]*?)\\nfunction startRealtime' },
    { id: 'styles', desc: 'every stylesheet (intro animation, sizes, speeds) is byte-identical', file: 'index.html', regex: '([\\s\\S]*?)</head>' },
    { id: 'markup', desc: 'the page markup up to the app script is byte-identical', file: 'index.html', regex: '</head>([\\s\\S]*?)\\n<script>\\n' },
    { id: 'sw', desc: 'sw.js is byte-identical', file: 'sw.js', regex: '([\\s\\S]*)' },
  ],

  checks: [
    { id: 'harness-syntax', desc: 'the harness is valid JavaScript', cmd: 'node', args: ['--check', '.smoke/harness.js'] },
  ],

  mutations: [
    { id: 'M1', what: 'the intro leaves at once instead of waiting for the animation', file: 'index.html',
      find: ' Promise.all(anims.map(a=>a.finished)).then(leave,leave);\n', replace: ' leave();\n',
      mustFail: ["intro: it waits for the logo's animation to finish, however late the page first paints"] },
    { id: 'M2', what: 'a stalled animation keeps the intro up until the 5 s cap', file: 'index.html',
      find: ' Promise.all(anims.map(a=>a.ready)).then(()=>setTimeout(leave,1600),leave);\n', replace: '',
      mustFail: ['intro: it still leaves 1.6 s after the logo appears if the animation stalls'] },
    { id: 'M3', what: 'a logo that never shows keeps the intro up for ever', file: 'index.html',
      find: ' setTimeout(leave,5000);\n', replace: '',
      mustFail: ['intro: it still leaves after 5 s if the logo never gets to show'] },
    { id: 'M4', what: 'the intro leaves again each time a timer fires', file: 'index.html',
      find: 'if(gone)return;gone=true;', replace: '',
      mustFail: ['intro: it leaves only once, however many of its timers fire'] },
    { id: 'M5', what: 'browsers without animation reports drop the intro at once', file: 'index.html',
      find: ' if(!anims.length){setTimeout(leave,Math.max(120,1100-performance.now()));return;}\n', replace: '',
      mustFail: ['intro: browsers that cannot report animations get the old timing'] },
  ],
};
