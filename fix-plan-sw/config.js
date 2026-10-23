/* fix-plan-sw/config.js: fix the harness crash caused by the deliberate sw.js changes. Only the harness changes. */
const SW_TESTS = [
  'page loads are handled (network first)',
  'the fetched page is saved for offline use',
  'an answer that is not a web page is not saved as the offline page',
  "Android's in-app browser (wv) loads pages itself, untouched by the worker",
  'the app download (.apk) is never intercepted',
  'offline: the page opens from the saved copy',
  'offline: icons come from the saved copy',
  'offline: the sign-in library comes from the saved copy',
  'offline: an uncached font fails quietly instead of hanging',
  'offline with nothing saved yet: the failure is reported, not faked',
  'no health data path appears in the service worker source',
  'unknown third-party hosts are left alone',
];

module.exports = {
  edited: ['.smoke/harness.js'],
  generated: [],
  generate: null,

  skipDirs: ['fix-plan-sw', '.git', 'node_modules', '.claude', 'build', '.gradle', 'coverage', '.cxx', 'mobile', 'capacitor'],
  skipFiles: ['FIX-PLAN-sw-harness.md'],

  test: {
    cmd: 'node', args: ['.smoke/harness.js'], shell: false, timeoutSec: 600,
    line: '^\\s*(PASS|FAIL)\\s+(.*?)(?:\\s+→.*)?\\s*$', pass: 'PASS', fail: 'FAIL',
    /* drops a trailing "(… 75 ms …)" or "(3900 rows vs 390: 9.7x)": measurements that change on every run */
    normalize: '\\s*\\((?:[^()]*?\\d+(?:\\.\\d+)?\\s*ms\\b[^()]*|[^()]*:\\s*\\d+(?:\\.\\d+)?x)\\)\\s*$',
  },
  parallel: 3,

  /* the failing tests sit behind the crash today, so none appears as FAIL in the baseline: all are required passes */
  targets: [],
  requiredPass: SW_TESTS,
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

  anchors: [
    { file: '.smoke/harness.js', needle: "swHandlers.fetch({ request: { method: 'GET', mode: 'cors', url, ...init }" },
    { file: '.smoke/harness.js', needle: "ok('unknown third-party hosts are left alone'" },
    { file: '.smoke/harness.js', needle: "ok('the fetched page is saved for offline use'" },
    { file: '.smoke/harness.js', needle: "ok('offline with nothing saved yet: the failure is reported, not faked'" },
    { file: 'sw.js', needle: "request.headers.get('User-Agent')" },
    { file: 'sw.js', needle: "(res.headers.get('content-type') || '').includes('text/html')" },
    { file: 'sw.js', needle: "url.pathname.endsWith('.apk')" },
    { file: 'sw.js', needle: "return new Response('The page could not be loaded." },
    { file: 'sw.js', needle: 'A rejected answer here is shown on the phone as net::ERR_CACHE_MISS' },
  ],

  /* sw.js is the code under test and must not change; the app script must not change either */
  invariants: [
    { id: 'sw', desc: 'sw.js is byte-identical', file: 'sw.js', regex: '([\\s\\S]*)' },
    { id: 'app', desc: 'the app script in index.html is byte-identical', file: 'index.html', regex: '<script>([\\s\\S]*?)<\\/script>' },
  ],

  checks: [
    { id: 'harness-syntax', desc: 'the harness is valid JavaScript', cmd: 'node', args: ['--check', '.smoke/harness.js'] },
  ],

  /* MUTATIONS: undo one deliberate sw.js change at a time (in a temporary copy); its test must then FAIL */
  mutations: [
    { id: 'M1', what: 'the worker intercepts the Android in-app browser again', file: 'sw.js',
      find: "  if ((request.headers.get('User-Agent') || '').includes('; wv)')) return;\n", replace: '',
      mustFail: ["Android's in-app browser (wv) loads pages itself, untouched by the worker"] },
    { id: 'M2', what: 'the worker intercepts the apk download', file: 'sw.js',
      find: "  if (url.origin === self.location.origin && url.pathname.endsWith('.apk')) return;\n", replace: '',
      mustFail: ['the app download (.apk) is never intercepted'] },
    { id: 'M3', what: 'any answer is saved as the offline page, even one that is not HTML', file: 'sw.js',
      find: "const html = res && res.ok && (res.headers.get('content-type') || '').includes('text/html');", replace: 'const html = res && res.ok;',
      mustFail: ['an answer that is not a web page is not saved as the offline page'] },
    { id: 'M4', what: 'with nothing saved, the worker rejects again (net::ERR_CACHE_MISS on phones)', file: 'sw.js',
      find: "      return new Response('The page could not be loaded. Check the connection and try again.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=UTF-8' } });",
      replace: '      throw err;',
      mustFail: ['offline with nothing saved yet: the failure is reported, not faked'] },
    { id: 'M5', what: 'fetched pages are never saved', file: 'sw.js',
      find: "    if (html) cache.put('index.html', await cleanCopy(res.clone()));\n", replace: '',
      mustFail: ['the fetched page is saved for offline use'] },
    { id: 'M6', what: 'offline with a saved copy, the worker fails instead of using it', file: 'sw.js',
      find: '  } catch (err) {\n    return saved;\n  }', replace: '  } catch (err) {\n    throw err;\n  }',
      mustFail: ['offline: the page opens from the saved copy'] },
  ],
};
