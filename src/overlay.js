// @ts-check
import { IS_APP } from './platform.js';
/* One browser-history entry per open overlay, so the Android Back key closes the top overlay
   instead of leaving the app. A single-page WebView has no history of its own, so without an
   entry Back goes straight to the launcher (measured on ctv390, 2026-10-29).

   Keyed by selector, not by call order: an overlay that is already open must not push a second
   entry, and an overlay closed out of order must remove its own entry rather than the newest. */
/** @type {{key:string,close:()=>void}[]} */
const open=[];
let ignoreNextPop=false;

/** Register an overlay that has just become visible. `close` is that overlay's own close function. */
export function overlayOpened(key,close){
 if(open.some(o=>o.key===key))return;
 open.push({key,close});
 history.pushState({overlay:key},'');
}

/** Deregister an overlay closed from the screen (X, Escape, backdrop) rather than by Back. */
export function overlayClosed(key){
 const i=open.findIndex(o=>o.key===key);
 if(i<0)return;
 open.splice(i,1);
 ignoreNextPop=true;
 history.back();
}

/* Back closes the top overlay. Its own close function calls overlayClosed, which finds nothing left
   under that key and so does not step history a second time. */
window.addEventListener('popstate',()=>{
 if(ignoreNextPop){ignoreNextPop=false;return;}
 const top=open.pop();
 if(top)top.close();
});

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
