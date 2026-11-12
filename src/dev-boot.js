/* The source page's entry (dev and repo-root serving only; the build inlines the bundle with its own gate, tools/build.js).
   The app may only start once the secure store (index.html) has decrypted localStorage into memory: started earlier,
   loadPersisted would read ciphertext, find no saved copy, and the first save would write demo data over it (P3-7). */
const start=()=>{window.__bootApp=null;import('./main.js');};
if(window.__secureReady)start();else window.__bootApp=start;
