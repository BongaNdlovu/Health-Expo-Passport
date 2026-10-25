/* fix-plan-herbs/config.js: what the herb-tea plan may touch and how it is verified. */
module.exports = {
  /* SCOPE. The sleep and stress & mood plans and their labels, the harness that checks them, and PLANS.md. */
  edited: ['index.html', '.smoke/harness.js', 'PLANS.md'],
  generated: ['dist/index.html', 'dist/sw.js'],
  generate: { cmd: 'node', args: ['tools/build.js'] },

  /* Manifest: plan tooling, editor/tool folders, caches, and the Android build output and signing keys are not compared.
     Test copies keep android/signing (section 19 checks the key file exists) and leave out only caches and build output. */
  skipDirs: ['fix-plan', 'fix-plan-churches', 'fix-plan-status', 'fix-plan-provenance', 'fix-plan-herbs', '.git', 'node_modules', '.claude', '.cursor', '.wrangler', '.gradle', 'build', 'signing'],
  copySkipDirs: ['fix-plan', 'fix-plan-churches', 'fix-plan-status', 'fix-plan-provenance', 'fix-plan-herbs', '.git', 'node_modules', '.claude', '.cursor', '.wrangler', '.gradle', 'build'],
  skipFiles: ['FIX-PLAN-herbs.md'],

  test: {
    cmd: 'node', args: ['.smoke/harness.js'], shell: false, timeoutSec: 900,
    line: '^\\s*(PASS|FAIL)\\s+(.*?)\\s*$', pass: 'PASS', fail: 'FAIL',
    /* drops a trailing "(… N ms …)" or "(… N.Nx)" measurement and the "  → detail" a failing check adds */
    normalize: '\\s*(\\([^()]*?\\d+(\\.\\d+)?\\s*(ms|x)\\b[^()]*\\))?(\\s{2}→.*)?$',
  },
  parallel: 3,

  targets: [],                                     // nothing fails today; the plan adds content
  requiredPass: [
    'cited herbal entries are the ones checked (King’s: Matricaria, Tilia, Nepeta, Humulus; Grieve: Hops)',
    'herb teas: only chamomile, linden flower, catnip and hops, with hops in the sleep plan only',
    'every herb tea comes with its hazard note',
    'herb teas are water teas, never tinctures, extracts or capsules',
    'the two herbals are credited: King’s (1898, public domain) and Grieve (1931)',
    'every reference in the plans, actions and foods is a Ministry of Healing chapter, a Kellogg page, general advice or an expo safety rule',
    'reference labels read naturally',
    'every plan credits the books it really uses',
    'every step has a time, text and a page in the book',
    'every plan has a list of what the book advises, each with a page',
    'nothing in the plans, actions or foods names the old books',
    'the old, non-book content is gone from the plans',
    'no plan recommends high-dose supplements or fasting',
    'no plan tells anyone to stop medicine',
    'Plan screen renders the sleep plan with its source and facts',
    'Plan screen renders the mind plan with its source and facts',
    'the stress plan screen shows its gratitude habit and Ministry of Healing chapter labels',
    'the WhatsApp message for the stress plan carries its actions, both books and the help line',
    'the take-home card for the stress plan carries the help line too',
  ],
  obsoleteNames: [],
  unrelatedFails: [],
  /* their result depends on machine speed (their names carry a time) */
  flaky: ['first full pull finished in a sensible time', 'saving to the device is fast', 'Care with 600 urgent + 1000 call-backs draws a capped set',
    'the whole backlog uploads on reconnect', '500 live inserts from other desks are applied'],

  anchors: [
    { file: 'index.html', needle: "const BOOK2_REF='" },
    { file: 'index.html', needle: " sleep:{tag:'Sleep'" },
    { file: 'index.html', needle: " mind:{tag:'Stress & mood'" },
    { file: 'index.html', needle: 'function refLabel(pg){' },
    { file: 'index.html', needle: 'function planBooks(p,extra){' },
    { file: '.smoke/harness.js', needle: '  const oldBooks = ' },
  ],
  invariants: [
    { id: 'css', desc: 'the precompiled stylesheet is untouched', file: 'index.html', regex: '<style id="tw">([\\s\\S]*?)</style>' },
    { id: 'prices', desc: 'the measured store prices (FOOD_PRICES) are untouched', file: 'index.html', regex: '(/\\* FOOD_PRICES:BEGIN[\\s\\S]*?FOOD_PRICES:END \\*/)' },
    { id: 'help-line', desc: 'the crisis help line is untouched', file: 'index.html', regex: "(const HELP_LINE='[^']*';)" },
    { id: 'other-plans', desc: 'the blood-pressure, sugar and weight plans are untouched', file: 'index.html', regex: '( bp:\\{tag:[\\s\\S]*?\\n sleep:\\{)' },
    { id: 'other-actions', desc: 'the blood-pressure, sugar and weight actions are untouched', file: 'index.html', regex: '(const ACTIONS=\\{[\\s\\S]*?\\n sleep:\\[)' },
    { id: 'food-why', desc: 'the Food screen reasons are untouched (no herb is on the shopping list)', file: 'index.html', regex: '(const FOOD_WHY=\\{[\\s\\S]*?\\n\\};)' },
  ],
  checks: [
    { id: 'harness-syntax', desc: 'the harness is valid JavaScript', cmd: 'node', args: ['--check', '.smoke/harness.js'] },
    { id: 'no-old-books', desc: 'index.html, dist/index.html and PLANS.md name none of the three old books',
      cmd: 'node', args: ['-e', "const fs=require('fs');const re=/Nedley|Natural Remedies Encyclopedia|Harvestime|Ferrell|Cherne|Pamplona|Lost Art of Thinking|Encyclopedia of Foods/;const bad=['index.html','dist/index.html','PLANS.md'].filter(f=>re.test(fs.readFileSync(f,'utf8')));if(bad.length){console.log('old book named in: '+bad.join(', '));process.exit(1)}"] },
  ],

  mutations: [
    { id: 'HM1', what: 'hops slips into the stress & mood plan', file: 'index.html',
      find: "['16:30','A cup of chamomile or linden flower tea, unsweetened, in a quiet moment.'", replace: "['16:30','A cup of chamomile or hops tea, unsweetened, in a quiet moment.'",
      mustFail: ['herb teas: only chamomile, linden flower, catnip and hops, with hops in the sleep plan only'] },
    { id: 'HM2', what: 'the catnip pregnancy warning is dropped', file: 'index.html',
      find: ' No catnip tea in pregnancy.', replace: '',
      mustFail: ['every herb tea comes with its hazard note'] },
    { id: 'HM3', what: 'valerian comes back into the sleep plan', file: 'index.html',
      find: "['20:15','A cup of warm catnip, linden flower or hops tea, unsweetened.'", replace: "['20:15','A cup of warm valerian, linden flower or hops tea, unsweetened.'",
      mustFail: ['herb teas: only chamomile, linden flower, catnip and hops, with hops in the sleep plan only'] },
    { id: 'HM4', what: 'a herbal entry that was never checked is cited', file: 'index.html',
      find: "and nervous irritability and to bring on sleep.','KD:Nepeta']", replace: "and nervous irritability and to bring on sleep.','KD:Lavandula']",
      mustFail: ['cited herbal entries are the ones checked (King’s: Matricaria, Tilia, Nepeta, Humulus; Grieve: Hops)'] },
    { id: 'HM5', what: 'King’s references lose their label', file: 'index.html',
      find: "(h[1]==='KD'?'King’s Dispensatory: ':'Grieve: ')", replace: "(h[1]==='KD'?'King: ':'Grieve: ')",
      mustFail: ['reference labels read naturally'] },
    { id: 'HM6', what: 'a tea becomes a tincture', file: 'index.html',
      find: "'The old herbal used about 15 g of chamomile flowers to half a litre of boiling water'", replace: "'Take 20 drops of chamomile tincture'",
      mustFail: ['herb teas are water teas, never tinctures, extracts or capsules'] },
    { id: 'HM7', what: 'King’s loses its date and public-domain note', file: 'index.html',
      find: "const BOOK3_REF='King’s American Dispensatory (1898; public domain)';", replace: "const BOOK3_REF='King’s American Dispensatory';",
      mustFail: ['the two herbals are credited: King’s (1898, public domain) and Grieve (1931)'] },
    { id: 'HM8', what: 'plans stop crediting King’s', file: 'index.html',
      find: ' if(/(^|\\s)KD:/.test(refs))out.push(BOOK3_REF);\n', replace: '',
      mustFail: ['every plan credits the books it really uses'] },
  ],
};
