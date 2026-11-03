// @ts-check
import { IS_APP } from './platform.js';
/* One browser-history entry per open overlay, so the Android Back key closes the top overlay
   instead of leaving the app. A single-page WebView has no history of its own, so without an
   entry Back goes straight to the launcher (measured on ctv390, 2026-10-29).

   Keyed by selector, not by call order: an overlay that is already open must not push a second
   entry, and an overlay closed out of order must remove its own entry rather than the newest. */
/** @type {{key:string,close:()=>void}[]} */
const open=[];
let ignoreNextPop=0;   /* (P4) a counter, not a flag: echoes of history.back() can stack, one per screen-closed overlay */
let escWired=false;

/** Register an overlay that has just become visible. `close` is that overlay's own close function. */
export function overlayOpened(key,close){
 if(open.some(o=>o.key===key))return;
 if(!escWired){escWired=true;wireEscape();}
 open.push({key,close});
 history.pushState({overlay:key},'');
}

/** Deregister an overlay closed from the screen (X, Escape, backdrop) rather than by Back. */
export function overlayClosed(key){
 if(window.NSMem)window.NSMem.release('overlay');       /* timers the overlay started stop with it */
 const i=open.findIndex(o=>o.key===key);
 if(i<0)return;
 open.splice(i,1);
 ignoreNextPop++;
 history.back();
}

/** (P4) Escape and shared close buttons act on the top overlay only; its close function deregisters itself. */
export function escapeTop(){const top=open[open.length-1];if(top)top.close();}
/** (P4) true when `key` is the overlay now on top — an own key handler closes only then. */
export function isTop(key){return open.length>0&&open[open.length-1].key===key;}

/* Back closes the top overlay. Its own close function calls overlayClosed, which finds nothing left
   under that key and so does not step history a second time. The echo counter is clamped at 0, so a
   stray echo can never eat the next pop. */
window.addEventListener('popstate',()=>{
 if(ignoreNextPop)ignoreNextPop--;                      /* one echo per overlayClosed (P4) */
 else{const top=open.pop();if(top)top.close();}
});

/* The ONE global Escape handler (P4): it closes the top overlay, whatever module registered it, so no
   overlay keeps an Escape listener of its own and Escape can never be answered by one underneath.
   Wired on the first overlayOpened rather than at module scope, so it is the newest keydown listener:
   any module that registers its own (visitor.js does) evaluates after this module, and only the last
   listener registered can be trusted to have the full overlay stack behind it. */
function wireEscape(){document.addEventListener('keydown',e=>{if(e.key==='Escape')escapeTop();});}

/* Inside the Android app the hardware key never reaches the page: Capacitor's own Android code has no
   back handling at all, so @capacitor/app routes the key here. Registering any listener also switches
   off that plugin's default, which does nothing once canGoBack() is false and would otherwise swallow
   Back and leave no way out of the app. */
if(IS_APP){
 const cap=/** @type {any} */(window).Capacitor;
 const App=cap&&cap.Plugins&&cap.Plugins.App;
 if(App&&App.addListener)App.addListener('backButton',()=>{
  if(open.length){history.back();return;}   /* the popstate that causes closes the top overlay */
  if(App.exitApp)App.exitApp();
 });
}
