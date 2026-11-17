/* fix-plan-ui/edits.js: the ONLY changes this plan makes, applied in order by apply.js.
   F1 an intro: the logo beats once on the app's own colour, then the app rises into place (app and web site)
   F2 no grey or white flash at launch in the Android app
   F3 every screen fits phones from 320 wide to tablets: the page is never wider than the phone
   F4 the header and the bottom tabs clear the phone's status bar and gesture bar
   F5 screens feel quicker: cards arrive within half a second, progress bars fill in half a second
   F6 every behaviour above has a harness check that can fail */
const HEART = 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12zM7.5 12h2.25l1.5-3 2 5 1.5-2h2.25';

module.exports = [
  {
    id: 'E1 header: clear of the status bar, and allowed to fit narrow phones',
    fixes: ['F3', 'F4'],
    why: 'the header row (logo, title, camera, visitor chip) could not shrink below 390 wide, so narrower phones got a page wider than the screen; it also started under the status bar',
    protectedBy: ['M3', 'M4'],
    file: 'index.html',
    find: `  <header class="sticky top-0 z-30 px-3 pt-3">
    <div class="glass flex items-center justify-between gap-2 rounded-[22px] px-3 py-2.5">
      <div class="flex items-center gap-2.5">`,
    replace: `  <!-- the top padding keeps the header clear of the phone's status bar: Capacitor's measured size in the app, env() in browsers -->
  <header class="sticky top-0 z-30 px-3" style="padding-top:max(.75rem,calc(var(--safe-area-inset-top,0px) + .5rem),calc(env(safe-area-inset-top,0px) + .5rem))">
    <div class="glass flex items-center justify-between gap-2 rounded-[22px] px-3 py-2.5">
      <div class="hdr-brand flex items-center gap-2.5">`,
  },
  {
    id: 'E2 header title class',
    fixes: ['F3'],
    why: 'lets the stylesheet hide the title on phones, where the logo already says which app this is',
    protectedBy: ['M3'],
    file: 'index.html',
    find: `        <div class="leading-tight" style="white-space:nowrap">
          <div class="display text-[15px] font-extrabold tracking-tight text-[#123033]">Health Expo Passport</div>`,
    replace: `        <div class="hdr-title leading-tight" style="white-space:nowrap">
          <div class="display text-[15px] font-extrabold tracking-tight text-[#123033]">Health Expo Passport</div>`,
  },
  {
    id: 'E3 header tools class',
    fixes: ['F3'],
    why: 'lets the camera button and the visitor chip give way on narrow phones instead of widening the page',
    protectedBy: ['M3'],
    file: 'index.html',
    find: `      <div class="flex items-center gap-2">
        <button onclick="openScanner()" aria-label="Scan badge"`,
    replace: `      <div class="hdr-tools flex items-center gap-2">
        <button onclick="openScanner()" aria-label="Scan badge"`,
  },
  {
    id: 'E4 bottom tabs clear of the gesture bar',
    fixes: ['F4'],
    why: 'only env() was used, which the Android app reports as 0; Capacitor provides the real size as --safe-area-inset-bottom',
    protectedBy: ['M4'],
    file: 'index.html',
    find: `<nav class="sticky bottom-0 z-30 px-3 pb-3 pt-1" style="padding-bottom:max(.75rem,env(safe-area-inset-bottom))">`,
    replace: `<nav class="sticky bottom-0 z-30 px-3 pb-3 pt-1" style="padding-bottom:max(.75rem,calc(var(--safe-area-inset-bottom,0px) + .5rem),calc(env(safe-area-inset-bottom,0px) + .5rem))">`,
  },
  {
    id: 'E5 the intro markup',
    fixes: ['F1', 'F2'],
    why: 'the logo is part of the page itself, so it shows from the very first paint, before the (large) script has run',
    protectedBy: ['M1', 'M10'],
    file: 'index.html',
    find: `<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>`,
    replace: `<body>
<!-- intro: the app's logo, shown from the very first paint (before any script runs); the script below lets it go -->
<div id="intro" aria-hidden="true"><div class="intro-badge"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${HEART}"/></svg></div></div>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>`,
  },
  {
    id: 'E6 the stylesheet: intro, every screen size, quicker screens',
    fixes: ['F1', 'F3', 'F5'],
    why: 'the intro animation; the header rules for narrow phones; two-line names on Home; shorter entrance and progress-bar animations (measured: screens took up to 1.1 s to settle)',
    protectedBy: ['M2', 'M3', 'M5', 'M6', 'M7', 'M11'],
    file: 'index.html',
    find: `  .lite .medal::after{display:none}
</style>
<style id="tw">`,
    replace: `  .lite .medal::after{display:none}

  /* ============ v8 · INTRO, EVERY SCREEN SIZE, QUICKER SCREENS ============ */
  /* intro: the logo beats once on the app's own background, then the app rises into place (#intro, introLeave) */
  #intro{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:#f6f8f6;transition:opacity .35s ease}
  #intro.intro-out{opacity:0;pointer-events:none}
  .intro-badge{width:84px;height:84px;border-radius:26px;display:grid;place-items:center;color:#fff;
    background:linear-gradient(135deg,#58b5a7,#2f8b7f);box-shadow:0 18px 36px -16px rgba(37,120,110,.85),inset 0 1px 0 rgba(255,255,255,.35);
    animation:introPop .45s cubic-bezier(.34,1.56,.64,1) both,introBeat .6s .5s ease-in-out both}
  .intro-badge svg{width:44px;height:44px}
  @keyframes introPop{from{opacity:0;transform:scale(.6)}}
  @keyframes introBeat{0%,100%{transform:scale(1)}30%{transform:scale(1.12)}55%{transform:scale(.96)}75%{transform:scale(1.04)}}
  @keyframes introRise{from{opacity:0;transform:translate3d(0,24px,0)}}
  .intro-rise #app,.intro-rise #authGate>div{animation:introRise .5s cubic-bezier(.22,1,.36,1) both}
  @media (prefers-reduced-motion:reduce){#intro{display:none}.intro-rise #app,.intro-rise #authGate>div{animation:none}}
  /* every screen size: the header title is never squeezed (whole on wide screens, hidden on phones, where the logo
     already says which app this is); the visitor chip gives way instead, so the page is never wider than the phone */
  .hdr-brand{flex:0 0 auto}
  .hdr-tools{min-width:0;flex:0 1 auto}
  #headerChip{min-width:0;max-width:100%}
  #headerChip>span.text-left{min-width:0;overflow:hidden}
  #headerChip>span.text-left>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @media (max-width:439.98px){.hdr-title{display:none}}
  @media (max-width:359.98px){#headerChip .mono{display:none}}
  /* Home: a long name wraps onto two lines instead of being cut */
  .hero .display.truncate{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word}
  /* quicker screens: cards arrive within half a second, progress bars fill in half a second */
  .stagger>*,.pour>*{animation-duration:.3s}
  .stagger>*:nth-child(1),.pour>*:nth-child(1){animation-delay:0s}
  .stagger>*:nth-child(2),.pour>*:nth-child(2){animation-delay:.03s}
  .stagger>*:nth-child(3),.pour>*:nth-child(3){animation-delay:.06s}
  .stagger>*:nth-child(4),.pour>*:nth-child(4){animation-delay:.09s}
  .stagger>*:nth-child(n+5),.pour>*:nth-child(n+5){animation-delay:.12s}
  .bar-fill{animation-duration:.5s}
</style>
<style id="tw">`,
  },
  {
    id: 'E7 the intro leaves on its own',
    fixes: ['F1'],
    why: 'about a second after loading began (or at once if loading took longer), so it never holds the app back; skipped for reduced motion',
    protectedBy: ['M1'],
    file: 'index.html',
    find: ` idle(()=>{loadScript(QRJS).catch(()=>{});});
})();
`,
    replace: ` idle(()=>{loadScript(QRJS).catch(()=>{});});
})();

/* ===== intro ===== */
/* The logo beats once, then the app rises into place. It never holds the app back: it leaves about a second after the
   page started loading, or straight away if loading took longer, and people who ask for less motion never see it. */
(function introLeave(){
 const el=document.getElementById('intro');if(!el)return;
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){el.remove();return;}
 const leave=()=>{document.documentElement.classList.add('intro-rise');el.classList.add('intro-out');setTimeout(()=>el.remove(),450);};
 setTimeout(leave,Math.max(120,1100-performance.now()));
})();
`,
  },
  {
    id: 'E8 Android launch screen in the app\'s colour and logo',
    fixes: ['F2'],
    why: 'the launch theme set no background or icon, so Android showed a plain grey screen at every start',
    protectedBy: ['M8'],
    file: 'capacitor/android/app/src/main/res/values/styles.xml',
    find: `    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
    </style>`,
    replace: `    <!-- Android's own launch screen: the app's background colour and logo, so there is no grey flash before the
         page's intro takes over (index.html #intro). Capacitor switches to AppTheme.NoActionBar itself. -->
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">#F6F8F6</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>
    </style>`,
  },
  {
    id: 'E9 the web view starts in the app\'s colour',
    fixes: ['F2'],
    why: 'the web view is white until the page paints, which showed as a white flash after the launch screen',
    protectedBy: ['M9'],
    file: 'capacitor/capacitor.config.json',
    find: `  "webDir": "www",
`,
    replace: `  "webDir": "www",
  "backgroundColor": "#f6f8f6",
`,
  },
  {
    id: 'E10 harness checks for all of the above',
    fixes: ['F6'],
    why: 'each behaviour gets a check, and each check is proven by a mutation',
    file: '.smoke/harness.js',
    find: `  console.log('\\n17. Cloud sync (fake Supabase)');
`,
    replace: `  /* ---- 16c. intro, every screen size, quicker screens ---- */
  console.log('\\n16c. Intro, screen sizes, quicker screens');
  {
    const css = (html.match(/v8 · INTRO, EVERY SCREEN SIZE, QUICKER SCREENS[\\s\\S]*?<\\/style>/) || [''])[0];
    const mainScript = html.indexOf('\\n<script>\\n');
    ok('intro: the logo is in the page itself, so it shows before any script runs',
      html.indexOf('<div id="intro"') > html.indexOf('<body>') && html.indexOf('<div id="intro"') < mainScript && /class="intro-badge"/.test(html));
    ok('intro: the logo pops in and beats once, then the app rises into place',
      /\\.intro-badge\\{[^}]*animation:introPop[^}]*introBeat/.test(css) && /@keyframes introBeat/.test(css) && /\\.intro-rise #app[^{]*\\{animation:introRise/.test(css));
    ok('intro: it leaves on its own and never holds the app back',
      $el('intro').classList.contains('intro-out') && document.documentElement.classList.contains('intro-rise'));
    ok('intro: people who ask for less motion do not see it',
      /@media \\(prefers-reduced-motion:reduce\\)\\{#intro\\{display:none\\}/.test(css) && /prefers-reduced-motion: reduce\\)'\\)\\.matches\\)\\{el\\.remove\\(\\);return;\\}/.test(html));
    ok('screens: the header never makes the page wider than the phone',
      /\\.hdr-brand\\{flex:0 0 auto\\}/.test(css) && /\\.hdr-tools\\{min-width:0;flex:0 1 auto\\}/.test(css) && /@media \\(max-width:439\\.98px\\)\\{\\.hdr-title\\{display:none\\}\\}/.test(css)
      && /#headerChip>span\\.text-left>span\\{overflow:hidden;text-overflow:ellipsis/.test(css) && /class="hdr-brand /.test(html) && /class="hdr-tools /.test(html) && /class="hdr-title /.test(html));
    ok('screens: the header and the tabs clear the phone\\'s status bar and gesture bar',
      /<header [^>]*padding-top:max\\(\\.75rem,calc\\(var\\(--safe-area-inset-top,0px\\) \\+ \\.5rem\\)/.test(html) && /<nav [^>]*padding-bottom:max\\(\\.75rem,calc\\(var\\(--safe-area-inset-bottom,0px\\) \\+ \\.5rem\\)/.test(html));
    g.state.tab = 'home'; g.render();
    ok('screens: a long visitor name wraps on the Home card instead of being cut',
      /\\.hero \\.display\\.truncate\\{white-space:normal;display:-webkit-box;-webkit-line-clamp:2/.test(css) && /class="display truncate/.test($main.innerHTML));
    ok('screens: cards arrive within half a second and progress bars fill in half a second',
      /\\.stagger>\\*,\\.pour>\\*\\{animation-duration:\\.3s\\}/.test(css) && /nth-child\\(n\\+5\\)\\{animation-delay:\\.12s\\}/.test(css) && /\\.bar-fill\\{animation-duration:\\.5s\\}/.test(css));
    const capDir = path.join(__dirname, '..', 'capacitor');
    const styles = fs.existsSync(capDir) ? fs.readFileSync(path.join(capDir, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'), 'utf8') : '';
    ok('app: Android\\'s launch screen uses the app\\'s colour and logo',
      /<item name="windowSplashScreenBackground">#F6F8F6<\\/item>/.test(styles) && /<item name="windowSplashScreenAnimatedIcon">@mipmap\\/ic_launcher<\\/item>/.test(styles));
    const capCfg = fs.existsSync(capDir) ? JSON.parse(fs.readFileSync(path.join(capDir, 'capacitor.config.json'), 'utf8')) : {};
    ok('app: the web view starts in the app\\'s colour (no white flash)', capCfg.backgroundColor === '#f6f8f6');
  }

  console.log('\\n17. Cloud sync (fake Supabase)');
`,
  },
];
