/* fix-plan-capacitor/config.js: what the plan may touch and how it is verified. */
const APP_TESTS = [
  'app: the page boots as the Android app',
  'web: the page does not think it is the app',
  'web: the libraries still load from their pinned CDN addresses',
  'app: the sign-in library loads from the copy inside the app, with the same integrity check',
  'app: the scanner and QR libraries load from the copies inside the app',
  'app: sign-up and password emails link back to the web site, not to the app',
  'app: no service worker is registered inside the app',
  'app: no "Add to Home Screen" steps are shown inside the app',
  'app: WhatsApp opens the WhatsApp app with the message ready',
  'app: without WhatsApp on the phone, the message goes to the share sheet',
  "app: the take-home card goes to the phone's print service as an A6 page",
  'fonts: the app uses its own copy, the web site Google Fonts',
];

module.exports = {
  /* SCOPE */
  edited: ['index.html', '.smoke/harness.js'],
  generated: ['dist/index.html', 'dist/sw.js'],                 /* tools/build.js copies index.html and stamps sw.js with its hash */
  generate: { cmd: 'node', args: ['tools/build.js'] },

  /* mobile/ is the paused React Native folder (not part of this plan); capacitor/ and vendor/ are created after the gate */
  skipDirs: ['fix-plan-capacitor', '.git', 'node_modules', '.claude', 'build', '.gradle', 'coverage', '.cxx', 'mobile', 'capacitor'],
  skipFiles: ['FIX-PLAN-capacitor.md'],

  /* TESTS: the project's harness prints "  PASS  name" or "  FAIL  name  → detail" */
  test: {
    cmd: 'node', args: ['.smoke/harness.js'], shell: false, timeoutSec: 600,
    line: '^\\s*(PASS|FAIL)\\s+(.*?)(?:\\s+→.*)?\\s*$', pass: 'PASS', fail: 'FAIL',
    /* drops a trailing "(… 75 ms …)" or "(3900 rows vs 390: 9.7x)": measurements that change on every run */
    normalize: '\\s*\\((?:[^()]*?\\d+(?:\\.\\d+)?\\s*ms\\b[^()]*|[^()]*:\\s*\\d+(?:\\.\\d+)?x)\\)\\s*$',
  },
  parallel: 3,

  targets: [],                                                  /* every checked behaviour is new: they are required passes */
  requiredPass: APP_TESTS,
  obsoleteNames: [],
  unrelatedFails: [],
  /* existing speed tests: their result depends on how busy the machine is (the gate runs 3 copies at once) */
  flaky: [
    '500 live inserts from other desks are applied',
    'Care with 600 urgent + 1000 call-backs draws a capped set',
    'change detection grows in step with the rows',
    'first full pull finished in a sensible time',
    'saving to the device is fast',
    'the whole backlog uploads on reconnect',
  ],

  /* FACTS the plan document cites */
  anchors: [
    { file: 'index.html', needle: 'family=Inter:wght@400..800&family=Plus+Jakarta+Sans' },
    { file: 'index.html', needle: '/* ================= SEED DATA ================= */' },
    { file: 'index.html', needle: 'function loadScript(src)' },
    { file: 'index.html', needle: 'function sendWhatsApp()' },
    { file: 'index.html', needle: "link.target='_blank'" },
    { file: 'index.html', needle: 'async function printCard()' },
    { file: 'index.html', needle: ' window.print();' },
    { file: 'index.html', needle: 'const SYNC_KEY=' },
    { file: 'index.html', needle: 'function installBlock()' },
    { file: 'index.html', needle: "if('serviceWorker' in navigator" },
    { file: 'index.html', needle: 'const authRedirect=' },
    { file: '.smoke/harness.js', needle: "console.log('\\n17. Cloud sync (fake Supabase)');" },
  ],

  /* must not move: the health logic and the plan content */
  invariants: [
    { id: 'content', desc: 'the plans, actions, food reasons and prices are byte-identical', file: 'index.html', regex: 'const BOOK_REF=([\\s\\S]*?)\\nconst HUES=' },
    { id: 'logic', desc: 'the health logic (categories, health age, plan matching) is byte-identical', file: 'index.html', regex: 'function cat\\(key,v\\)\\{([\\s\\S]*?)/\\* ================= NUMBER TWEEN' },
    { id: 'plan', desc: 'planNeeds, problemOf, urgentOf and planFor are byte-identical', file: 'index.html', regex: 'function planNeeds\\(a\\)\\{([\\s\\S]*?)\\nfunction viewPlan\\(\\)' },
    { id: 'sync', desc: 'the Supabase sync code is byte-identical', file: 'index.html', regex: 'async function cloudSync\\(([\\s\\S]*?)\\nfunction startRealtime' },
  ],

  checks: [
    { id: 'harness-syntax', desc: 'the harness is valid JavaScript', cmd: 'node', args: ['--check', '.smoke/harness.js'] },
  ],

  /* MUTATIONS: break one app behaviour at a time; its check must then FAIL */
  mutations: [
    { id: 'M1', what: 'the app no longer recognises itself', file: 'index.html',
      find: "const IS_APP=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());",
      replace: 'const IS_APP=false;', mustFail: ['app: the page boots as the Android app'] },
    { id: 'M2', what: 'libraries load from the CDN inside the app', file: 'index.html',
      find: 'function appCopyOf(src){return IS_APP&&APP_LIB[src]||src;}', replace: 'function appCopyOf(src){return src;}',
      mustFail: ['app: the sign-in library loads from the copy inside the app, with the same integrity check', 'app: the scanner and QR libraries load from the copies inside the app'] },
    { id: 'M3', what: 'email links point at the app again', file: 'index.html',
      find: 'const authRedirect=()=>IS_APP?APP_SITE:', replace: 'const authRedirect=()=>',
      mustFail: ['app: sign-up and password emails link back to the web site, not to the app'] },
    { id: 'M4', what: 'the service worker is registered inside the app', file: 'index.html',
      find: "if(!IS_APP&&'serviceWorker' in navigator", replace: "if('serviceWorker' in navigator",
      mustFail: ['app: no service worker is registered inside the app'] },
    { id: 'M5', what: 'Add to Home Screen steps show inside the app', file: 'index.html',
      find: "function installBlock(){\n if(IS_APP)return '';\n", replace: 'function installBlock(){\n',
      mustFail: ['app: no "Add to Home Screen" steps are shown inside the app'] },
    { id: 'M6', what: 'the app opens wa.me in a window that does nothing', file: 'index.html',
      find: ' if(IS_APP){sendWhatsAppInApp(n,waMessage(a));return;}\n', replace: '',
      mustFail: ['app: WhatsApp opens the WhatsApp app with the message ready'] },
    { id: 'M7', what: 'no share-sheet fallback without WhatsApp', file: 'index.html',
      find: ' try{await P.Share.share({text:msg});}catch(e){}\n', replace: '',
      mustFail: ['app: without WhatsApp on the phone, the message goes to the share sheet'] },
    { id: 'M8', what: 'the app calls window.print', file: 'index.html',
      find: ' if(IS_APP){printCardInApp();return;}\n', replace: '',
      mustFail: ["app: the take-home card goes to the phone's print service as an A6 page"] },
    { id: 'M9', what: 'the printed card loses its A6 page size', file: 'index.html',
      find: '<style>@page{size:105mm 148mm;margin:0}html,body{margin:0;background:#fff}${css}</style>', replace: '<style>html,body{margin:0;background:#fff}${css}</style>',
      mustFail: ["app: the take-home card goes to the phone's print service as an A6 page"] },
    { id: 'M10', what: 'the app asks Google for its fonts', file: 'index.html',
      find: `document.write(app?'<link href="vendor/fonts.css" rel="stylesheet">'`, replace: `document.write(false?'<link href="vendor/fonts.css" rel="stylesheet">'`,
      mustFail: ['fonts: the app uses its own copy, the web site Google Fonts'] },
    { id: 'M11', what: 'the web page thinks it is the app', file: 'index.html',
      find: "const IS_APP=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());",
      replace: 'const IS_APP=true;', mustFail: ['web: the page does not think it is the app', 'web: the libraries still load from their pinned CDN addresses'] },
  ],
};
