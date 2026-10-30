// @ts-check
import { I } from './icons.js';
import { $ } from './helpers.js';
import { journeyTop } from './visitor.js';
import { attendees, hueOf, state, volunteers } from './data.js';
import { AV, badgeTier, closeSwitcher, closeVolModal, closeWhatsApp, needsRegistration, renderServeSheet, renderServeView } from './volunteer.js';
import { persist } from './state.js';
import { A, doneCount, esc, firstName, initials, redFlag } from './helpers.js';
import { queue, viewQueue } from './queue.js';
import { journeyBottom, viewHome, viewNoVisitor, viewScreen, viewSend } from './visitor.js';
import { updateSimUI, viewCare, viewFood, viewPlan, viewResults } from './results.js';
import { viewProfile } from './account.js';
import { closeCloud } from './cloud.js';
/* The app shell: rendering, toast, liquid interactions and the intro. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= RENDER: SHELL ================= */
/* hue for every tab, + which tabs use the shared "main" container */
const HUE_N={home:'mint',visit:'sky',care:'blush',queue:'aqua',serve:'peach',me:'lilac'};
/* One visitor, four steps in order. They all live under the "Visitor" tab, with a step bar and Back / Next. */
export const JOURNEY=['screen','results','plan','send'];
export const JOURNEY_LABEL={screen:'Check',results:'Results',plan:'Plan',send:'Send home'};
const navKey=t=>JOURNEY.includes(t)?'visit':t;
export const SERVE_TABS=[
 ['home','Home',I.home],
 ['visit','Visitor',I.clip],
 ['queue','Queue',I.queue],
 ['care','Care',I.heart],
 ['serve','Team',I.team],
 ['me','Profile',I.user],
];
/* function declaration (not a const) so hoisting keeps inline onclick handlers safe */
export function isServe(){return state.tab==='serve';}

export function render(){
 renderHeaderChip();renderNav();
 /* The mockup has no separate app header on the hub: the visitor pill and tools live inside the hero. */
 const hdr=/** @type {HTMLElement|null} */(document.querySelector('#app > header'));
 if(hdr)hdr.style.display=state.tab==='home'?'none':'';
 /* hide/show with an inline style rather than a class, so the two render paths
    (visitor views vs the serve section) cannot fight over one shared classList */
 const el=$('#main');
 if(isServe()){el.style.display='none';renderServeView();}
 else{el.style.display='';renderMain(true);}
 renderServeSheet();/* rebuilt by renderVolModal() */persist();
}
function renderHeaderChip(){
 if(isServe()){
  const v=AV();
  $('#headerChip').innerHTML=v
   ?`<span class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-extrabold tint hue-${badgeTier(v).hue}">${initials(v.name)}</span>
     <span class="text-left leading-none"><span class="block text-[11px] font-extrabold text-[#123033]">${esc(firstName(v.name))}</span><span class="mt-0.5 block mono text-[9px] text-[#667d83]">${v.id}</span></span>
     <svg class="h-3.5 w-3.5 flex-none text-[#6b8187]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>`
   :`<span class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-extrabold tint hue-peach">+</span>
     <span class="text-left leading-none"><span class="block text-[11px] font-extrabold text-[#123033]">Volunteer</span><span class="mt-0.5 block mono text-[9px] text-[#667d83]">team</span></span>
     <svg class="h-3.5 w-3.5 flex-none text-[#6b8187]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>`;
  return;
 }
 const a=A();
 $('#headerChip').innerHTML=`<span class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-extrabold tint hue-${hueOf(a.id)}">${initials(a.name)}</span>
 <span class="text-left leading-none"><span class="block text-[11px] font-extrabold text-[#123033]">${esc(firstName(a.name))}</span><span class="mt-0.5 block mono text-[9px] text-[#667d83]">${esc(a.id)}</span></span>
 <svg class="h-3.5 w-3.5 flex-none text-[#6b8187]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>`;}

function syncNavH(){const n=document.querySelector('nav');if(n)document.documentElement.style.setProperty('--navh',n.offsetHeight+'px');}
addEventListener('resize',syncNavH);
export function renderNav(){
 const urgent=attendees.filter(redFlag).length;
 const pending=volunteers.filter(needsRegistration).length;
 $('#navItems').innerHTML=SERVE_TABS.map(([k,l,ic])=>{
  const act=navKey(state.tab)===k;
  let badge='';
  if(k==='visit'&&attendees.length)badge=`<span id="navCount" class="nav-badge">${doneCount(A())}/8</span>`;
  if(k==='care'&&urgent)badge=`<span class="nav-badge nav-badge-alert">${urgent}</span>`;
  if(k==='queue'){const w=queue.filter(e=>e.status==='waiting').length;if(w)badge=`<span class="nav-badge">${w>99?'99+':w}</span>`;}
  if(k==='serve'&&pending)badge=`<span id="navVol" class="nav-badge">${pending}</span>`;
  return `<button data-action="nav-go" data-tab="${k}" class="nav-item hue-${HUE_N[k]} ${act?'nav-item-active':''}" ${act?'aria-current="page"':''}>
   <span class="nav-ico">${ic}${badge}</span><span class="nav-lbl">${l}</span></button>`}).join('');movePill();syncNavH();
}
export function renderMain(anim){
 const views={home:viewHome,screen:viewScreen,results:viewResults,plan:viewPlan,send:viewSend,care:viewCare,queue:viewQueue,me:viewProfile};
 const needsVisitor=JOURNEY.includes(state.tab)&&!attendees.length;
 const food=state.tab==='plan'&&state.food&&state.food.open;          /* Food is a screen inside Plan, with its own back button */
 const view=food?viewFood:views[state.tab];
 $('#main').innerHTML=needsVisitor?viewNoVisitor()
  :JOURNEY.includes(state.tab)&&!food?journeyTop()+view()+journeyBottom():view();
 if(!anim)$('#main').querySelectorAll(':scope > .stagger').forEach(s=>s.classList.remove('stagger'));
 if(state.tab==='results')updateSimUI();
}
/* ================= TOAST & KEYS ================= */
let toastTimer;
export function toast(m){
 $('#toastMsg').textContent=m;
 undoFn=null;const u=$('#toastUndo');if(u)u.classList.add('hidden');
 const t=$('#toast');t.classList.remove('opacity-0','translate-y-3');{const d=t.firstElementChild;d.style.animation='none';void d.offsetWidth;d.style.animation='dropIn .75s cubic-bezier(.34,1.5,.5,1) both';}
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>t.classList.add('opacity-0','translate-y-3'),2200);
}
/* a toast with an Undo action (the placement board): the button lives 6 seconds, then the offer is gone */
let undoFn=null;
export function toastUndo(m,fn){
 toast(m);
 undoFn=fn;
 const u=$('#toastUndo');
 if(u){u.classList.remove('hidden');u.onclick=()=>{const f=undoFn;undoFn=null;u.classList.add('hidden');if(f)f();};}
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>{undoFn=null;const b=$('#toastUndo');if(b)b.classList.add('hidden');$('#toast').classList.add('opacity-0','translate-y-3');},6000);   /* the message leaves with the offer: left up, it covered the buttons */
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSwitcher();closeWhatsApp();closeVolModal();closeCloud();}});

/* ================= LIQUID INTERACTIONS ================= */
export function syncRanges(){document.querySelectorAll('input[type=range]').forEach(/** @param {HTMLInputElement} r */(r)=>r.style.setProperty('--pct',((Number(r.value)-Number(r.min))/((Number(r.max)-Number(r.min))||1)*100)+'%'));}
document.addEventListener('input',e=>{if(/** @type {HTMLInputElement} */ (e.target).type==='range')syncRanges();});
/* nav pill: slides to the new tab in one quick spring (the old two-phase stretch + trailing
   droplet took most of a second to settle and read as a stray blob on the active tab) */
let _pill={x:null,w:0},_pillRaf=0;
function movePill(){
 const it=/** @type {HTMLElement} */ (document.querySelector('.nav-item-active')),p=$('#navPill'),box=/** @type {HTMLElement} */ ($('#navItems'));
 if(!it||!p||!box)return;
 const hue=(it.className.match(/hue-\w+/)||[''])[0];
 p.className='nav-pill '+hue;
 const x=it.offsetLeft+box.offsetLeft,w=it.offsetWidth,h=it.offsetHeight,y=box.offsetTop,T=`translate3d(${x}px,${y}px,0)`;
 p.style.height=h+'px';
 if(_pill.x===null||(_pill.x===x&&_pill.w===w)){p.style.transition='none';p.style.width=w+'px';p.style.transform=T;}
 else{
  p.style.transition='transform .3s cubic-bezier(.3,1.25,.45,1),width .3s cubic-bezier(.3,1.25,.45,1),background-color .5s';
  p.style.width=w+'px';p.style.transform=T;
 }
 _pill={x,w};
 /* fonts and scrollbars settle a beat after a render and shift every item a little; measure
    again once the layout is final, so the pill is exactly on the active tab however the
    first measurement landed */
 if(_pillRaf)cancelAnimationFrame(_pillRaf);
 _pillRaf=requestAnimationFrame(()=>requestAnimationFrame(()=>{
  _pillRaf=0;
  const it2=/** @type {HTMLElement} */ (document.querySelector('.nav-item-active'));
  if(!it2||!p.isConnected)return;
  if(it2.offsetLeft+box.offsetLeft!==_pill.x||it2.offsetWidth!==_pill.w)movePill();
 }));
}
addEventListener('resize',()=>{_pill.x=null;movePill();});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{_pill.x=null;movePill();});
/* specular light follows the finger / cursor on glass */
let _sp=null,_raf=0;
function sheen(e){
 if(e.pointerType==='touch'&&e.type==='pointermove')return;
 const el=e.target instanceof Element?e.target.closest('.glass,.hero'):null;if(!el)return;
 _sp={el,x:e.clientX,y:e.clientY};
 if(!_raf)_raf=requestAnimationFrame(()=>{_raf=0;const r=_sp.el.getBoundingClientRect();
  _sp.el.style.setProperty('--mx',(_sp.x-r.left)+'px');_sp.el.style.setProperty('--my',(_sp.y-r.top)+'px');});
}
document.addEventListener('pointermove',sheen,{passive:true});
document.addEventListener('pointerdown',sheen,{passive:true});
/* liquid ripple on press */
document.addEventListener('pointerdown',e=>{
 const b=e.target instanceof Element?e.target.closest('.btn,.step-btn'):null;if(!b)return;
 const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,d=document.createElement('span');
 d.className='rip';d.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;
 b.appendChild(d);d.addEventListener('animationend',()=>d.remove());
},{passive:true});

/* ===== more liquid ===== */
export function jelly(el){if(!el)return;el.classList.remove('jelly');void el.offsetWidth;el.classList.add('jelly');}
/* the old ambient parallax (a transform on the blob layer for every pointer move and scroll tick) is
   gone with the drifting blobs: the background is painted once and stays put */

/* ===== performance guards ===== */
(function(){
 const root=document.documentElement;
 /* weak devices get the lite look from the start; others are measured for ~1.5s and downgraded if choppy */
 const weak=(navigator.hardwareConcurrency||8)<=4||((/** @type {any} */ (navigator)).deviceMemory||8)<=2;
 if(weak){root.classList.add('lite');return;}
 let n=0,last=0,slow=0;
 const probe=t=>{
  if(last){const d=t-last;if(d>34)slow++;}
  last=t;
  if(++n<90)requestAnimationFrame(probe);
  else if(slow>18)root.classList.add('lite');
 };
 requestAnimationFrame(()=>requestAnimationFrame(probe));
})();

/* ===== intro ===== */
/* The logo pops in and beats once, then the app rises into place. The intro leaves when the logo's own animation has
   finished, so it plays in full however late the page first paints. It never holds the app back: it leaves anyway
   1.6 s after the logo appears, or 5 s after this script runs if the logo never gets to show (a hidden tab), and
   browsers that cannot report animations get the old timing. People who ask for less motion never see it. */
(function introLeave(){
 const el=document.getElementById('intro');if(!el)return;
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){el.remove();return;}
 let gone=false;
 /* intro-rise comes off once the app has risen: left on, #app replayed its .5s rise on later screen changes */
 const leave=()=>{if(gone)return;gone=true;document.documentElement.classList.add('intro-rise');el.classList.add('intro-out');setTimeout(()=>el.remove(),450);
  setTimeout(()=>{try{document.documentElement.classList.remove('intro-rise');}catch(e){}},700);};
 const badge=el.querySelector('.intro-badge');
 const anims=badge&&badge.getAnimations?badge.getAnimations():[];
 if(!anims.length){setTimeout(leave,Math.max(120,1100-performance.now()));return;}
 Promise.all(anims.map(a=>a.finished)).then(leave,leave);
 Promise.all(anims.map(a=>a.ready)).then(()=>setTimeout(leave,1600),leave);
 setTimeout(leave,5000);
})();

/* ================= APPEARANCE & THEME ================= */
/* One data-theme attribute drives every colour through the --hx tokens. The default stays light until
   every screen is migrated (Phase 6); then the default flips to dark to match the reference. */
function paintStatusBar(theme){
 const cap=/** @type {any} */ (window).Capacitor;
 const sb=cap&&cap.Plugins&&cap.Plugins.StatusBar;
 if(!sb)return;
 try{
  const style=sb.setStyle&&sb.setStyle({style:theme==='dark'?'DARK':'LIGHT'});
  if(style&&style.catch)style.catch(()=>{});
  const bg=sb.setBackgroundColor&&sb.setBackgroundColor({color:theme==='dark'?'#0b0e0c':'#f4f3ee'});
  if(bg&&bg.catch)bg.catch(()=>{});
 }catch(e){}
}
export function getTheme(){
 try{return localStorage.getItem('newstart.theme')==='dark'?'dark':'light';}catch(e){return 'light';}
}
export function setTheme(t){
 const theme=t==='dark'?'dark':'light';
 try{localStorage.setItem('newstart.theme',theme);}catch(e){}
 if(document.documentElement)document.documentElement.dataset.theme=theme;
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',theme==='dark'?'#0b0e0c':'#f4f3ee');
 paintStatusBar(theme);
}
export function toggleTheme(){
 const next=getTheme()==='dark'?'light':'dark';
 setTheme(next);
 return next;
}
paintStatusBar(getTheme());