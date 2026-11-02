/* Health Expo Passport — guided tour (coach marks). Content: tutorial/steps.json.
   Never writes to the backend: it only runs the whitelisted local UI actions in ACTIONS. */
(function(){
 'use strict';
 var KEY='newstart.tour.v1', STEPS=null, cur=-1, root=null, consent=false, lastFocus=null, clickHook=null, live=null;
 var log=[]; /* per-step resolution log, read by tests */
 function ls(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){return {};}}
 function save(p){var o=ls();for(var k in p)o[k]=p[k];o.at=Date.now();try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}return o;}
 function app(){return window.__NEWSTART&&window.__NEWSTART.__internals;}
 function cloud(){var I=app();return I&&I.cloud||{};}
 function signedIn(){var c=cloud();return !!(c.user||c.mode);}
 function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
 function load(){if(STEPS)return Promise.resolve(STEPS);
  return fetch('tutorial/steps.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('steps '+r.status);return r.json();})
   .then(function(d){STEPS=d.steps;return STEPS;});}
 /* ---- whitelisted, local-only actions ---- */
 function closeOverlays(){var I=app();if(!I)return;['closeHelp','closeCloud','closeSwitcher','closeBigScreen','closeQueuePick'].forEach(function(f){try{typeof I[f]==='function'&&I[f]();}catch(e){}});}
 var ACTIONS={
  ensureDemo:function(){var I=app(),c=cloud();if(!c.user&&!c.demo&&I&&I.gateDemo){I.gateDemo();}},
  tab:function(t){var b=document.querySelector('[data-tour="nav-'+t+'"]');if(b){b.click();return;}var I=app();I&&I.switchTab&&I.switchTab(t);},
  journey:function(t){var I=app();if(I&&I.switchTab){I.switchTab(t);}},
  qSelect:function(st){var I=app();I&&I.qSelect&&I.qSelect(st);}
 };
 function runBefore(list){closeOverlays();(list||[]).forEach(function(a){var i=a.indexOf(':'),n=i<0?a:a.slice(0,i),arg=i<0?undefined:a.slice(i+1);
  if(ACTIONS[n]){try{ACTIONS[n](arg);}catch(e){console.warn('tour action',a,e&&e.message);}}});}
 function visible(el){if(!el)return false;var r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!el.closest('[inert]');}
 function find(sels){for(var i=0;i<(sels||[]).length;i++){var all;try{all=document.querySelectorAll(sels[i]);}catch(e){continue;}
   for(var j=0;j<all.length;j++)if(visible(all[j])&&!(root&&root.contains(all[j])))return {el:all[j],sel:sels[i],idx:i};}return null;}
 /* ---- DOM ---- */
 function h(tag,attrs,html){var e=document.createElement(tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(html!=null)e.innerHTML=html;return e;}
 function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function build(){if(root)return root;
  root=h('div',{id:'nsTour','class':'nst-root'});
  ['t','r','b','l'].forEach(function(p){root.appendChild(h('div',{'class':'nst-shade nst-shade-'+p,'data-shade':p,'aria-hidden':'true'}));});
  root.appendChild(h('div',{'class':'nst-ring','aria-hidden':'true'}));
  root.appendChild(h('div',{'class':'nst-block','aria-hidden':'true'}));
  var tip=h('div',{'class':'nst-tip',role:'dialog','aria-modal':'true','aria-labelledby':'nstTitle','aria-describedby':'nstBody nstCount'});
  tip.innerHTML='<div id="nstCount" class="nst-count"></div><h2 id="nstTitle" class="nst-title" tabindex="-1"></h2><p id="nstBody" class="nst-body"></p><p id="nstExtra" class="nst-extra"></p>'+
   '<div class="nst-btns"><button type="button" class="nst-btn nst-skip" data-nst="skip">Skip tour</button><span class="nst-sp"></span><button type="button" class="nst-btn nst-back" data-nst="back">Back</button><button type="button" class="nst-btn nst-next" data-nst="next">Next</button></div>';
  root.appendChild(tip);
  live=h('div',{'class':'nst-sr','aria-live':'polite',role:'status'});root.appendChild(live);
  root.addEventListener('click',function(e){var b=e.target.closest('[data-nst]');if(!b)return;e.preventDefault();e.stopPropagation();
   var a=b.getAttribute('data-nst');if(a==='next')next();else if(a==='back')back();else if(a==='skip')skip();else if(a==='resume')go(ls().step||0);else if(a==='restart')go(0);else if(a==='cancel')close(false);else if(a==='consent'){consent=true;go(pending||0);}else if(a==='offer-yes'){dismissOffer();start();}else if(a==='offer-no'){dismissOffer();}});
  document.body.appendChild(root);return root;}
 function tipEl(){return root.querySelector('.nst-tip');}
 function setButtons(html){root.querySelector('.nst-btns').innerHTML=html;}
 function stdButtons(i,n){setButtons('<button type="button" class="nst-btn nst-skip" data-nst="skip">Skip tour</button><span class="nst-sp"></span>'+
   (i>0?'<button type="button" class="nst-btn nst-back" data-nst="back">Back</button>':'')+
   '<button type="button" class="nst-btn nst-next" data-nst="next">'+(i===n-1?'Finish':'Next')+'</button>');}
 function place(el,interactive){var pad=6,vw=Math.min(innerWidth,document.documentElement.clientWidth||innerWidth),vh=innerHeight,ring=root.querySelector('.nst-ring'),blk=root.querySelector('.nst-block'),tip=tipEl(),r;
  if(el){var b=el.getBoundingClientRect();r={x:Math.max(0,b.left-pad),y:Math.max(0,b.top-pad),w:Math.min(vw,b.width+pad*2),h:b.height+pad*2};}
  var S=function(p,x,y,w,hh){var s=root.querySelector('[data-shade='+p+']').style;s.left=x+'px';s.top=y+'px';s.width=Math.max(0,w)+'px';s.height=Math.max(0,hh)+'px';};
  if(r){S('t',0,0,vw,r.y);S('b',0,r.y+r.h,vw,vh-r.y-r.h);S('l',0,r.y,r.x,r.h);S('r',r.x+r.w,r.y,vw-r.x-r.w,r.h);
   ring.style.cssText='display:block;left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px';
   blk.style.cssText=interactive?'display:none':'display:block;left:'+r.x+'px;top:'+r.y+'px;width:'+r.w+'px;height:'+r.h+'px';}
  else{S('t',0,0,vw,vh);S('b',0,0,0,0);S('l',0,0,0,0);S('r',0,0,0,0);ring.style.cssText='display:none';blk.style.cssText='display:none';}
  tip.style.left='';tip.style.top='';tip.classList.toggle('nst-center',!r);
  var tw=Math.min(vw-16,360);tip.style.width=tw+'px';var th=tip.offsetHeight;
  var x=r?Math.min(Math.max(8,r.x+r.w/2-tw/2),vw-tw-8):(vw-tw)/2,y;
  if(!r)y=Math.max(8,(vh-th)/2);else if(r.y+r.h+12+th<=vh-8)y=r.y+r.h+12;else if(r.y-12-th>=8)y=r.y-12-th;else y=Math.max(8,vh-th-8);
  tip.style.left=x+'px';tip.style.top=y+'px';}
 var curEl=null;
 function unhook(){if(clickHook){clickHook.el.removeEventListener('click',clickHook.fn,true);clickHook=null;}if(curEl){curEl.removeAttribute('data-tour-active');curEl=null;}}
 var pending=0, goGen=0;
 function visibleSteps(){return STEPS.filter(function(s){return !(s.demoOnly&&signedIn());});}
 async function go(i){var g=++goGen;var L=visibleSteps(),n=L.length;if(i<0)i=0;if(i>=n){return finish();}
  build();unhook();cur=i;var s=L[i];save({step:i,done:false,id:s.id});
  runBefore(s.before);var f=null;for(var t=0;t<12&&!(f=find(s.target));t++)await wait(60);
  if(!s.target||!s.target.length)f=null;
  if(f){try{f.el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});}catch(e){f.el.scrollIntoView();}var pr=null;for(var k=0;k<20;k++){await wait(40);var q=f.el.getBoundingClientRect(),key=[q.left,q.top,q.width,q.height].map(Math.round).join();if(key===pr)break;pr=key;}if(g!==goGen)return;curEl=f.el;f.el.setAttribute('data-tour-active','1');}if(g!==goGen)return;[300,700,1200].forEach(function(ms){setTimeout(function(){if(g!==goGen||!root)return;if(curEl)onResize();},ms);});
  log[i]={id:s.id,found:!!f,sel:f?f.sel:null,fallback:f?f.idx>0:false,wanted:(s.target||[]).length>0};
  root.querySelector('#nstCount').textContent='Step '+(i+1)+' of '+n;
  root.querySelector('#nstTitle').textContent=s.title;
  root.querySelector('#nstBody').textContent=s.body+((s.target||[]).length&&!f?' (This part of the screen is not showing right now.)':'');
  var ex=root.querySelector('#nstExtra');ex.textContent=s.extra||'';ex.style.display=s.extra?'':'none';
  stdButtons(i,n);root.dataset.step=s.id;root.classList.add('nst-on');
  place(f&&f.el,!!s.interactive);
  if(clickHook){clickHook.el.removeEventListener('click',clickHook.fn,true);clickHook=null;}if(s.interactive&&f){var fn=function(){setTimeout(function(){if(cur===i)next();},700);};f.el.addEventListener('click',fn,true);clickHook={el:f.el,fn:fn};}
  live.textContent='Step '+(i+1)+' of '+n+': '+s.title;
  var nb=root.querySelector('[data-nst=next]');nb&&nb.focus();}
 function next(){go(cur+1);} function back(){if(cur>0)go(cur-1);}
 function skip(){save({skipped:true,done:false,step:cur<0?0:cur});close(true);}
 function finish(){save({done:true,step:0,skipped:false,completedAt:Date.now()});close(true);var I=app();try{I&&I.switchTab&&ACTIONS.tab('home');}catch(e){}
  toastMsg('Tour complete. Take it again any time from Profile → Settings & help.');}
 function toastMsg(m){var I=app();if(I&&typeof I.toast==='function')I.toast(m);}
 function close(keep){goGen++;unhook();if(root){root.classList.remove('nst-on');root.remove();root=null;}cur=-1;document.removeEventListener('keydown',onKey,true);removeEventListener('resize',onResize);removeEventListener('scroll',onResize,true);
  if(lastFocus&&lastFocus.focus&&document.contains(lastFocus))try{lastFocus.focus();}catch(e){}}
 function onKey(e){if(!root)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();save({step:Math.max(0,cur),done:false});close(true);toastMsg('Tour paused. Resume from Profile → Settings & help.');return;}
  if(cur<0)return;
  if(e.key==='ArrowRight'&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||'')){e.preventDefault();next();}
  else if(e.key==='ArrowLeft'&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||'')){e.preventDefault();back();}
  else if(e.key==='Tab'){var f=[].slice.call(tipEl().querySelectorAll('button'));if(!f.length)return;var a=document.activeElement,k=f.indexOf(a);
   if(e.shiftKey&&(k<=0)){e.preventDefault();f[f.length-1].focus();}else if(!e.shiftKey&&(k===f.length-1||k<0)){e.preventDefault();f[0].focus();}}}
 function onResize(){if(cur>=0){var s=visibleSteps()[cur];place(curEl,!!(s&&s.interactive));}}
 function card(title,body,btns){build();unhook();cur=-1;place(null,false);root.querySelector('#nstCount').textContent='';root.querySelector('#nstTitle').textContent=title;
  root.querySelector('#nstBody').textContent=body;var ex=root.querySelector('#nstExtra');ex.style.display='none';setButtons(btns);root.classList.add('nst-on');place(null,false);
  live.textContent=title;var b=root.querySelector('.nst-next');b&&b.focus();}
 async function start(opts){opts=opts||{};lastFocus=document.activeElement;
  try{await load();}catch(e){toastMsg('The guided tour could not load. Help & tutorial has the same steps.');return false;}
  dismissOffer();document.addEventListener('keydown',onKey,true);addEventListener('resize',onResize);addEventListener('scroll',onResize,true);
  var p=ls(),from=0;
  if(!opts.restart&&!p.done&&p.step>0&&p.step<visibleSteps().length){from=p.step;
   if(!opts.resume){pending=from;card('Resume the tour?','You stopped at step '+(from+1)+' of '+visibleSteps().length+'.','<button type="button" class="nst-btn nst-skip" data-nst="cancel">Not now</button><span class="nst-sp"></span><button type="button" class="nst-btn nst-back" data-nst="restart">Start over</button><button type="button" class="nst-btn nst-next" data-nst="resume">Resume</button>');
    if(!signedIn()||consent)return true;}}
  if(signedIn()&&!consent){pending=from;card('You are signed in','The tour will show your real screens but never changes anything, and it skips the practice steps. To practise with demo visitors instead, sign out first.','<button type="button" class="nst-btn nst-skip" data-nst="cancel">Cancel</button><span class="nst-sp"></span><button type="button" class="nst-btn nst-next" data-nst="consent">Continue</button>');return true;}
  go(from);return true;}
 /* ---- non-blocking offer (never forced) ---- */
 function dismissOffer(){var o=document.getElementById('nsTourOffer');o&&o.remove();save({offered:true});}
 function offer(why){var p=ls();if(p.done||p.offered||document.getElementById('nsTourOffer')||root)return false;
  var o=h('div',{id:'nsTourOffer','class':'nst-offer',role:'region','aria-label':'Guided tour offer'});
  o.innerHTML='<div class="nst-offer-t"><b>New here?</b> Take the guided tour — about 3 minutes, with demo visitors.</div><div class="nst-offer-b"><button type="button" class="nst-btn nst-skip" data-nst="offer-no">Not now</button><button type="button" class="nst-btn nst-next" data-nst="offer-yes">Start the tour</button></div>';
  o.addEventListener('click',function(e){var b=e.target.closest('[data-nst]');if(!b)return;if(b.dataset.nst==='offer-yes'){dismissOffer();start();}else dismissOffer();});
  document.body.appendChild(o);o.dataset.why=why||'';
  var navAway=function(e){var n=e.target.closest&&(!e.target.closest('#nsTourOffer'))&&e.target.closest('[data-action],[data-tour^="nav-"]');if(n&&document.getElementById('nsTourOffer')){document.removeEventListener('click',navAway,true);dismissOffer();}};document.addEventListener('click',navAway,true);return true;}
 function status(){var p=ls();if(p.done)return 'You have finished the guided tour. Take it again any time.';if(p.step>0)return 'Tour paused at step '+(p.step+1)+'. Take the guided tour to resume or start over.';return '';}
 window.NSTour={start:start,offer:offer,close:function(){close(true);},status:status,next:next,back:back,state:ls,_log:log,_current:function(){return cur;},_go:go,_steps:function(){return STEPS;}};
 /* first-launch offer: once the app is up and the sign-in gate is not covering it */
 function launchOffer(){var t=0,iv=setInterval(function(){t++;var I=app(),g=document.getElementById('authGate');
   if(I&&g&&g.classList.contains('hidden')){clearInterval(iv);offer('launch');}else if(t>40)clearInterval(iv);},250);}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',launchOffer);else launchOffer();
})();
