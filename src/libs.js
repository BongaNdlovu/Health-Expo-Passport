// @ts-check
import { SRI, appCopyOf } from './cloud.js';
/* Loads a pinned library once (the sign-in library is the only one left). Inside the Android app it comes from the copy
   in the package (appCopyOf); on the web, from its CDN. */
const _scripts={};
export function loadScript(src){return _scripts[src]||(_scripts[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=appCopyOf(src);
  /* a library whose bytes differ from the audited release is refused, so a hijacked CDN cannot run code next to patient data */
  if(typeof SRI!=='undefined'&&SRI[src]){s.integrity=SRI[src];s.crossOrigin='anonymous';}
  s.onload=res;s.onerror=()=>{delete _scripts[src];rej();};document.head.appendChild(s);}));}
