// @ts-check
import { $ } from './helpers.js';
import { SRI, appCopyOf } from './cloud.js';
import { cloud } from './state.js';
import { attendees } from './data.js';
import { esc } from './helpers.js';
import { hideModal, onScanText, showModal } from './volunteer.js';
/* Real camera QR scanning. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= REAL CAMERA QR SCANNING ================= */
let camStream=null,detector=null,scanTimer=null,h5qr=null,scanSession=0;   /* scanSession: each opening gets a number; stopCamera() retires it */
const _scripts={};
export function loadScript(src){return _scripts[src]||(_scripts[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=appCopyOf(src);
  /* a library whose bytes differ from the audited release is refused, so a hijacked CDN cannot run code next to patient data */
  if(typeof SRI!=='undefined'&&SRI[src]){s.integrity=SRI[src];s.crossOrigin='anonymous';}
  s.onload=res;s.onerror=()=>{delete _scripts[src];rej();};document.head.appendChild(s);}));}
export const H5Q='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',QRJS='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
export function setStatus(t){const el=$('#scanStatus');if(el)el.textContent=t;}

export function openScanner(){
 /* the "simulate a scan" shortcut is for the demo only; once connected it would list real people on the scanner */
 const sd=$('#scanDemo');if(sd)sd.style.display=(cloud.mode||cloud.user)?'none':'';
 $('#scannerList').innerHTML=attendees.slice(-8).map(a=>`<button data-action="demoScan" data-args="${a.id}"
   class="flex w-full items-center justify-between rounded-[16px] border border-white/80 bg-white/60 px-4 py-2.5 text-left transition-all duration-300 hover:bg-white active:scale-[.98]">
  <span><span class="mono block text-[11px] font-bold text-brand-700">${esc(a.id)}</span>
  <span class="block text-[12px] font-bold text-[#123033]">${esc(a.name)}</span></span>
  <span class="text-[10px] font-extrabold tracking-wider text-brand-600">SCAN →</span></button>`).join('');
 setStatus('Starting camera…');
 $('#camVideo').classList.add('hidden');$('#qrReader').classList.add('hidden');$('#scanFrame').classList.remove('hidden');
 showModal('#scannerModal');
 stopCamera();                       /* opening twice (a double tap) must not leave the first camera running */
 startCamera(++scanSession);
}
export function closeScanner(){hideModal('#scannerModal');stopCamera();}
async function startCamera(session){
 const stale=()=>session!==scanSession;      /* the scanner was closed (or reopened) while we were waiting for the camera */
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setStatus('Camera needs https or localhost — type the badge below instead.');return;}
 if('BarcodeDetector' in window){
  let stream=null;
  try{
   const det=new BarcodeDetector({formats:['qr_code']});
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:960},height:{ideal:540},frameRate:{ideal:24,max:30}}});
   if(stale()){stream.getTracks().forEach(t=>t.stop());return;}
   detector=det;camStream=stream;
   const v=$('#camVideo');v.srcObject=camStream;await v.play();
   if(stale())return;
   v.classList.remove('hidden');$('#scanFrame').classList.remove('hidden');
   setStatus('Camera live — hold the lanyard QR inside the frame');
   scanLoop();return;
  }catch(e){
   if(stale()){if(stream)stream.getTracks().forEach(t=>t.stop());return;}
   if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;}detector=null;
  }
 }
 try{
  await loadScript(H5Q);
  if(stale())return;
  const q=new Html5Qrcode('qrReader',{verbose:false});
  h5qr=q;
  $('#camVideo').classList.add('hidden');$('#scanFrame').classList.add('hidden');$('#qrReader').classList.remove('hidden');
  await q.start({facingMode:'environment'},{fps:8,qrbox:{width:200,height:200},disableFlip:true},txt=>onScanText(txt),()=>{});
  if(stale()){try{await q.stop();q.clear();}catch(e){}if(h5qr===q)h5qr=null;return;}
  setStatus('Camera live (fallback scanner) — frame the QR');
 }catch(e){
  if(!stale())setStatus('Camera unavailable or permission denied — type the badge below.');
 }
}
function scanLoop(){
 let busy=false;
 scanTimer=setInterval(async()=>{
  if(busy||document.hidden||!detector||!camStream)return;
  const v=$('#camVideo');
  if(v&&v.readyState>=2){
   busy=true;
   try{const codes=await detector.detect(v);if(codes&&codes.length)onScanText(codes[0].rawValue);}catch(e){}
   busy=false;
  }
 },160);
}
export function stopCamera(){
 scanSession++;                     /* retires any camera start that is still waiting */
 if(scanTimer){clearInterval(scanTimer);scanTimer=null;}
 if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;}
 const v=$('#camVideo');if(v)v.srcObject=null;
 if(h5qr){try{h5qr.stop().then(()=>h5qr.clear()).catch(()=>{});}catch(e){} h5qr=null;}
 detector=null;
}
export function parseBadge(text){
 const t=String(text||'').toUpperCase().trim();
 let m=t.match(/EXPO[\s:#_-]*(\d{1,4})/);
 if(!m)m=t.match(/^(\d{1,4})$/);
 if(!m)return null;
 /* "EXPO-0042" and "EXPO-42" both mean badge 42 */
 return 'EXPO-'+String(parseInt(m[1],10)).padStart(3,'0');
}
