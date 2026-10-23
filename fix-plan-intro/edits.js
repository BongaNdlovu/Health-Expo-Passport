/* fix-plan-intro/edits.js: the ONLY changes this plan makes, applied in order by apply.js.
   F1 the intro plays in full: it leaves when the logo's own animation has finished, however late the page first paints
   F2 it never holds the app back: it leaves anyway if the animation stalls or never gets to show, and leaves only once
   F3 every behaviour above has a harness check that can fail */
module.exports = [
  {
    id: 'E1 the intro waits for the logo\'s animation',
    fixes: ['F1', 'F2'],
    why: 'the intro left about 1.1 s after navigation began, timed by the clock, so on the emulator it cut the logo\'s beat short on every reload (800-817 of 1100 ms played) and on a slow reload left after 200 ms',
    protectedBy: ['M1', 'M2', 'M3', 'M4', 'M5'],
    file: 'index.html',
    find: `/* ===== intro ===== */
/* The logo beats once, then the app rises into place. It never holds the app back: it leaves about a second after the
   page started loading, or straight away if loading took longer, and people who ask for less motion never see it. */
(function introLeave(){
 const el=document.getElementById('intro');if(!el)return;
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){el.remove();return;}
 const leave=()=>{document.documentElement.classList.add('intro-rise');el.classList.add('intro-out');setTimeout(()=>el.remove(),450);};
 setTimeout(leave,Math.max(120,1100-performance.now()));
})();
`,
    replace: `/* ===== intro ===== */
/* The logo pops in and beats once, then the app rises into place. The intro leaves when the logo's own animation has
   finished, so it plays in full however late the page first paints. It never holds the app back: it leaves anyway
   1.6 s after the logo appears, or 5 s after this script runs if the logo never gets to show (a hidden tab), and
   browsers that cannot report animations get the old timing. People who ask for less motion never see it. */
(function introLeave(){
 const el=document.getElementById('intro');if(!el)return;
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){el.remove();return;}
 let gone=false;
 const leave=()=>{if(gone)return;gone=true;document.documentElement.classList.add('intro-rise');el.classList.add('intro-out');setTimeout(()=>el.remove(),450);};
 const badge=el.querySelector('.intro-badge');
 const anims=badge&&badge.getAnimations?badge.getAnimations():[];
 if(!anims.length){setTimeout(leave,Math.max(120,1100-performance.now()));return;}
 Promise.all(anims.map(a=>a.finished)).then(leave,leave);
 Promise.all(anims.map(a=>a.ready)).then(()=>setTimeout(leave,1600),leave);
 setTimeout(leave,5000);
})();
`,
  },
  {
    id: 'E2 harness checks for the intro timing',
    fixes: ['F3'],
    why: 'the harness\'s fake page has no animations, so it only ever ran the fallback; these checks run the intro script on its own with the logo\'s animations and the timers under the test\'s control',
    protectedBy: ['M1', 'M2', 'M3', 'M4', 'M5'],
    file: '.smoke/harness.js',
    find: `    ok('app: the web view starts in the app\\'s colour (no white flash)', capCfg.backgroundColor === '#f6f8f6');
  }
`,
    replace: `    ok('app: the web view starts in the app\\'s colour (no white flash)', capCfg.backgroundColor === '#f6f8f6');
  }

  /* ---- 16d. the intro plays in full ---- */
  console.log('\\n16d. The intro plays in full');
  {
    const src = (html.match(/\\(function introLeave\\(\\)\\{[\\s\\S]*?\\n\\}\\)\\(\\);/) || [''])[0];
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
        /* fires every timer due by \`upTo\` ms, including ones they add */
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
    ok('intro: it waits for the logo\\'s animation to finish, however late the page first paints', !!src && !beforePaint && !whilePlaying && a.left());

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
`,
  },
];
