/*
 * Print-media audit: renders the real A6 take-home card with print CSS, runs axe against it in
 * print media, and writes a PDF + PNG for visual inspection.
 *
 *   node tools/print-audit.js
 *
 * Dev-only. Uses the installed Chrome via puppeteer-core; nothing is shipped.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const root = path.resolve(__dirname, '..');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const axe = fs.readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
const outDir = path.join(root, 'verification', 'print');
fs.mkdirSync(outDir, { recursive: true });

let page = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
page = page.replace(
  /(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/,
  '$1default-src \'self\' \'unsafe-inline\' data: blob: https:; connect-src https: wss:; img-src \'self\' data: blob: https:$2'
);
page = page.replace('<head>', '<head><style>#intro{display:none!important}</style>');
const temp = path.join(os.tmpdir(), 'newstart-print-audit.html');
fs.writeFileSync(temp, page);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    for (const theme of ['light', 'dark']) {
      const p = await browser.newPage();
      await p.setViewport({ width: 500, height: 1000, deviceScaleFactor: 2 });
      await p.goto('file:///' + temp.replace(/\\/g, '/'), { waitUntil: 'load' });
      await new Promise((r) => setTimeout(r, 1200));
      await p.evaluate((theme) => {
        const I = window.__NEWSTART.__internals;
        I.gateDemo();
        I.setTheme(theme);
        I.state.activeId = I.attendees[0].id;
        I.buildPrintCard();
      }, theme);
      await p.emulateMediaType('print');
      await p.addScriptTag({ content: axe });
      const audit = await p.evaluate(async () => {
        const el = document.getElementById('printArea') || document;
        const r = await axe.run(el, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
        return {
          theme: document.documentElement.getAttribute('data-theme'),
          cards: document.querySelectorAll('#printArea .pc-card').length,
          violations: r.violations.map((v) => ({
            id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
            targets: v.nodes.slice(0, 6).map((n) => n.target.join(' ')),
          })),
        };
      });
      fs.writeFileSync(path.join(outDir, `print-${theme}.json`), JSON.stringify(audit, null, 2));

      await p.pdf({
        path: path.join(outDir, `print-${theme}.pdf`),
        printBackground: true,
        preferCSSPageSize: true,
      });
      const card = await p.$('#printArea .pc-card');
      if (card) {
        try {
          await card.screenshot({ path: path.join(outDir, `print-${theme}.png`) });
        } catch (e) {
          console.log(`${theme}: PNG preview skipped (print media hides the card; see the PDF)`);
        }
      }
      console.log(`${theme}: cards=${audit.cards} violations=${audit.violations.length}`);
      for (const v of audit.violations) console.log(`  ${v.impact} ${v.id} x${v.nodes} ${v.targets.join(' | ')}`);
      await p.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
