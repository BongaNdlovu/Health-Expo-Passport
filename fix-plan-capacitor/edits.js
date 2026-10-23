/* fix-plan-capacitor/edits.js: the ONLY changes this plan makes to hand-edited files, applied in order by apply.js.
   F1 the app is bundled and works with no internet (fonts, libraries, no service worker)
   F2 WhatsApp works inside the app (opens WhatsApp, or the share sheet without it)
   F3 the take-home card prints inside the app (no window.print in an Android app)
   F4 sign-up / password emails link to the web site, not to the app's internal address; no "install" steps inside the app
   F5 the web site behaves exactly as before
   F6 every app behaviour above is proven by harness checks that boot the page as the app */
module.exports = [
  {
    id: 'E1 fonts: bundled copy in the app, Google Fonts on the web',
    fixes: ['F1', 'F5'],
    why: 'the three Google Fonts tags need the internet; inside the app the same fonts come from vendor/fonts.css',
    protectedBy: ['M10'],
    file: 'index.html',
    find: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=Plus+Jakarta+Sans:wght@600..800&display=swap" rel="stylesheet">
`,
    replace: `<!-- Fonts: the Android app carries its own copy (vendor/fonts.css), so it shows the same letters with no internet;
     the web site loads them from Google Fonts as before. -->
<script id="fontPick">(function(){
 var app=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
 document.write(app?'<link href="vendor/fonts.css" rel="stylesheet">'
  :'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  +'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=Plus+Jakarta+Sans:wght@600..800&display=swap" rel="stylesheet">');
})();</script>
`,
  },
  {
    id: 'E2 IS_APP and the web site address',
    fixes: ['F1', 'F2', 'F3', 'F4', 'F5'],
    why: 'one flag says whether the page runs inside the Android app (Capacitor); everything app-specific asks it',
    protectedBy: ['M1', 'M11'],
    file: 'index.html',
    find: `<script>
/* ================= SEED DATA ================= */
`,
    replace: `<script>
/* ================= ANDROID APP (Capacitor) =================
   The same page also runs packaged inside the Android app, where it opens with no internet and syncs when there is
   signal. IS_APP is true only there; the few places that differ (libraries, fonts, WhatsApp, printing, email links)
   ask it. APP_SITE is the web address: sign-up and password emails must link there, not to the app. */
const IS_APP=!!(window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform());
const APP_SITE='https://winter-bonus-626a.ndlovufanelesibonge8.workers.dev/';

/* ================= SEED DATA ================= */
`,
  },
  {
    id: 'E3 loadScript loads the bundled copy inside the app',
    fixes: ['F1'],
    why: 'the three libraries come from CDNs; inside the app they load from vendor/, and the same SRI hash still has to match',
    protectedBy: ['M2'],
    file: 'index.html',
    find: `function loadScript(src){return _scripts[src]||(_scripts[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;
`,
    replace: `function loadScript(src){return _scripts[src]||(_scripts[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=appCopyOf(src);
`,
  },
  {
    id: 'E4 APP_LIB: where each library lives inside the app',
    fixes: ['F1'],
    why: 'maps each pinned CDN address to its bundled copy; the web keeps the CDN address',
    protectedBy: ['M2'],
    file: 'index.html',
    find: ` [QRJS]:'sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU',
};
const SYNC_KEY='newstart.cloud.v1';
`,
    replace: ` [QRJS]:'sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU',
};
/* Inside the Android app the libraries are bundled (tools/build-app.js copies them and refuses any whose bytes do not
   match the hash above), so the app needs no internet to start. The integrity check still applies to the copy. */
const APP_LIB={[SB_LIB]:'vendor/supabase.min.js',[H5Q]:'vendor/html5-qrcode.min.js',[QRJS]:'vendor/qrcode.min.js'};
function appCopyOf(src){return IS_APP&&APP_LIB[src]||src;}
const SYNC_KEY='newstart.cloud.v1';
`,
  },
  {
    id: 'E5 WhatsApp inside the app',
    fixes: ['F2'],
    why: 'a wa.me link opened in a new window does nothing inside the app; it opens the WhatsApp app instead, or the share sheet when WhatsApp is not installed',
    protectedBy: ['M6', 'M7'],
    file: 'index.html',
    find: ` const n=waNumber(a.phone),url=\`https://wa.me/\${n}?text=\${encodeURIComponent(waMessage(a))}\`;
 closeWhatsApp();
 toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');
`,
    replace: ` const n=waNumber(a.phone),url=\`https://wa.me/\${n}?text=\${encodeURIComponent(waMessage(a))}\`;
 closeWhatsApp();
 if(IS_APP){sendWhatsAppInApp(n,waMessage(a));return;}
 toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');
`,
  },
  {
    id: 'E6 sendWhatsAppInApp',
    fixes: ['F2'],
    why: 'the app-side sender: whatsapp:// through the AppLauncher plugin (WhatsApp sends once there is signal), else the Share plugin',
    protectedBy: ['M6', 'M7'],
    file: 'index.html',
    find: ` document.body.appendChild(link);link.click();link.remove();
}
`,
    replace: ` document.body.appendChild(link);link.click();link.remove();
}
/* Android app: straight into the WhatsApp app with the message ready (it goes once the phone has signal). Without
   WhatsApp on the phone, the phone's own share sheet offers SMS, email and the rest. */
async function sendWhatsAppInApp(n,msg){
 const P=window.Capacitor.Plugins;
 let opened=false;
 try{const r=await P.AppLauncher.openUrl({url:\`whatsapp://send?\${n?\`phone=\${n}&\`:''}text=\${encodeURIComponent(msg)}\`});opened=!!(r&&r.completed);}catch(e){}
 if(opened){toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');return;}
 toast('WhatsApp is not on this phone — choose another way to send');
 try{await P.Share.share({text:msg});}catch(e){}
}
`,
  },
  {
    id: 'E7 printCard inside the app',
    fixes: ['F3'],
    why: 'window.print() does not exist in an Android app; the card goes to the phone\'s print service as an A6 page instead',
    protectedBy: ['M8', 'M9'],
    file: 'index.html',
    find: ` await ensureQrLib();
 buildPrintCard();
 document.body.classList.add('print-mode');
 window.print();
}
`,
    replace: ` await ensureQrLib();
 buildPrintCard();
 if(IS_APP){printCardInApp();return;}
 document.body.classList.add('print-mode');
 window.print();
}
/* Android app: the card (with only its own .pc-* styles) goes to the CardPrinter plugin, which prints it through the
   phone's print service on an A6 page. The QR code is drawn on a canvas, which does not survive copying the HTML, so
   it travels as a picture. */
function printCardInApp(){
 const pa=$('#printArea');
 pa.querySelectorAll('.pc-qr').forEach(q=>{const c=q.querySelector('canvas');if(!c||!c.toDataURL)return;
  try{const u=c.toDataURL('image/png');q.innerHTML='';const i=document.createElement('img');i.src=u;i.alt='';q.appendChild(i);}catch(e){}});
 const css=[...(document.styleSheets||[])].flatMap(s=>{try{return [...s.cssRules];}catch(e){return [];}})
  .filter(r=>r.selectorText&&r.selectorText.includes('.pc-')).map(r=>r.cssText).join('\\n');
 const html=\`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:105mm 148mm;margin:0}html,body{margin:0;background:#fff}\${css}</style></head><body>\${pa.innerHTML}</body></html>\`;
 const P=window.Capacitor.Plugins.CardPrinter;
 if(!P){toast('Printing is not available in this version of the app');return;}
 P.print({html,name:'Health Expo card '+A().id}).catch(e=>toast('Could not open printing: '+(e&&e.message||e)));
}
`,
  },
  {
    id: 'E8 no "install" steps inside the app',
    fixes: ['F4'],
    why: 'the install block tells iPhone users to Add to Home Screen; inside an app that is wrong',
    protectedBy: ['M5'],
    file: 'index.html',
    find: `function installBlock(){
 if(isStandalone())`,
    replace: `function installBlock(){
 if(IS_APP)return '';
 if(isStandalone())`,
  },
  {
    id: 'E9 no service worker inside the app',
    fixes: ['F1'],
    why: 'the app already carries every file; a service worker there would only keep stale copies',
    protectedBy: ['M4'],
    file: 'index.html',
    find: `if('serviceWorker' in navigator&&(location.protocol==='https:'`,
    replace: `if(!IS_APP&&'serviceWorker' in navigator&&(location.protocol==='https:'`,
  },
  {
    id: 'E10 email links go to the web site from the app',
    fixes: ['F4'],
    why: 'inside the app location.origin is the app\'s internal address (https://localhost), which no email link can open',
    protectedBy: ['M3'],
    file: 'index.html',
    find: `const authRedirect=()=>/^https?:$/.test(location.protocol)?location.origin+location.pathname:undefined;`,
    replace: `const authRedirect=()=>IS_APP?APP_SITE:/^https?:$/.test(location.protocol)?location.origin+location.pathname:undefined;`,
  },
  {
    id: 'E11 harness: boot the page as the Android app and check every app behaviour',
    fixes: ['F6', 'F5'],
    why: 'proves E1 to E10 with a stand-in Capacitor, and that the web page is not affected',
    file: '.smoke/harness.js',
    find: `(async () => {
  console.log('\\n17. Cloud sync (fake Supabase)');
`,
    replace: `(async () => {
  /* ---- 16b. the Android app (Capacitor): the same page, booted as the app ----
     Placed before the service-worker tests so it runs even when a later section stops the harness. */
  console.log('\\n16b. Android app (Capacitor)');
  {
    const opened = [], shared = [], printed = [], swRegistered = [];
    let whatsappInstalled = true;
    const Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        AppLauncher: { openUrl: async o => { opened.push(o.url); return { completed: whatsappInstalled }; } },
        Share: { share: async o => { shared.push(o.text); return {}; } },
        CardPrinter: { print: async o => { printed.push(o.html); return {}; } },
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
      vm.runInContext(body + '\\n;globalThis.__A={IS_APP:typeof IS_APP!=="undefined"?IS_APP:undefined,loadScript,authRedirect,installBlock,' +
        'sendWhatsApp,printCard,waMessage,waNumber,attendees,state,SB_LIB,H5Q,QRJS,SRI};', appBox, { filename: 'app-mode.js' });
    } catch (e) { booted = false; console.log('APP BOOT THREW: ' + e.stack); }
    const A = appBox.__A || {};
    const tick = () => new Promise(r => setTimeout(r, 0));
    ok('app: the page boots as the Android app', booted && A.IS_APP === true);
    ok('web: the page does not think it is the app', vm.runInContext('typeof IS_APP!=="undefined"&&IS_APP===false', sandbox) === true);
    ok('web: the libraries still load from their pinned CDN addresses', vm.runInContext('typeof appCopyOf==="function"&&appCopyOf(SB_LIB)===SB_LIB&&appCopyOf(H5Q)===H5Q&&appCopyOf(QRJS)===QRJS', sandbox) === true);

    let srcs = [], sbEl = {};
    if (booted) {
      A.loadScript(A.SB_LIB).catch(() => {}); A.loadScript(A.H5Q).catch(() => {}); A.loadScript(A.QRJS).catch(() => {});
      srcs = head.children.map(c => c.src);
      sbEl = head.children.find(c => c.src === 'vendor/supabase.min.js') || {};
    }
    ok('app: the sign-in library loads from the copy inside the app, with the same integrity check', !!A.SRI && sbEl.integrity === A.SRI[A.SB_LIB]);
    ok('app: the scanner and QR libraries load from the copies inside the app', srcs.includes('vendor/html5-qrcode.min.js') && srcs.includes('vendor/qrcode.min.js') && !srcs.some(s => /^https:/.test(s)));
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
    ok('app: WhatsApp opens the WhatsApp app with the message ready', opened.length === 1 && opened[0] === 'whatsapp://send?phone=' + num + '&text=' + encodeURIComponent(msg) && shared.length === 0);
    whatsappInstalled = false;
    if (booted) { A.sendWhatsApp(); await tick(); await tick(); }
    ok('app: without WhatsApp on the phone, the message goes to the share sheet', opened.length === 2 && shared.length === 1 && shared[0] === msg);

    let printThrew = false;
    if (booted) { try { await A.printCard(); await tick(); } catch (e) { printThrew = true; } }
    ok('app: the take-home card goes to the phone\\'s print service as an A6 page', booted && !printThrew && printed.length === 1 &&
      printed[0].includes('@page{size:105mm 148mm') && printed[0].includes('Never stop prescribed pills suddenly'));

    const pick = (html.match(/<script id="fontPick">([\\s\\S]*?)<\\/script>/) || [])[1];
    const fontsFor = win => { let out = ''; vm.runInNewContext(pick || 'throw new Error("no fontPick")', { window: win, document: { write: s => { out += s; } } }); return out; };
    let appFonts = '', webFonts = '';
    try { appFonts = fontsFor({ Capacitor }); webFonts = fontsFor({}); } catch (e) { }
    ok('fonts: the app uses its own copy, the web site Google Fonts', /href="vendor\\/fonts\\.css"/.test(appFonts) && !/googleapis/.test(appFonts) &&
      /fonts\\.googleapis\\.com\\/css2\\?family=Inter/.test(webFonts) && !/vendor\\//.test(webFonts));
  }

  console.log('\\n17. Cloud sync (fake Supabase)');
`,
  },
];
