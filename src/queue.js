// @ts-check
import { $ } from './helpers.js';
import { cloud } from './state.js';
import { BOOTH, attendees, hueOf, state } from './data.js';
import { renderMain, renderNav, toast } from './shell.js';
import { esc, firstName, initials } from './helpers.js';
import { healthFromError, healthLive, isMissingErr, missingName } from './cloud.js';
import { hideModal, showModal } from './volunteer.js';
import { visitorsToShow } from './visitor.js';
/* The live queue shared between desks. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= LIVE QUEUE =================
   Who is waiting at which station, shared between desks through the queue_entries table (see supabase/schema.sql).
   Unlike visitors and volunteers this is NOT offline-first: a line only means something if every desk sees the same
   line, so changes go straight to the database and are refused when there is no connection. Signed out, the tab runs
   as an in-memory practice queue on this device so staff can try it. */
const QUEUE_STATIONS=['vitals','bp','sugar','kitchen','plan','prayer'];
const QUEUE_SHORT={vitals:'Vitals & BMI',bp:'Blood Pressure',sugar:'Sugar & Chol.',kitchen:'Kitchen Pharmacy',plan:'Counselling',prayer:'Prayer'};
const QUEUE_DEFAULT_MIN={vitals:4,bp:5,sugar:6,kitchen:8,plan:10,prayer:10};   /* until 3 visits have really finished */
const QUEUE_WARN=10,QUEUE_ALERT=20;      /* minutes the longest-waiting person has stood in line: amber, then red */
const QUEUE_WINDOW_H=18;                 /* only today's queue is loaded */
export const queue=[];                          /* {id,attendeeId,station,status,joinedAt,calledAt,finishedAt}; times in ms */
export const qs={ready:false,err:'',ch:null,rt:'',subbed:false,skew:0,since:'',busy:false,syncing:false,seq:1,confirm:'',pick:'',pickQ:'',renderT:null};

export const qSafe=s=>String(s==null?'':s).replace(/[^A-Za-z0-9-]/g,'');           /* ids end up inside data-* attributes */
const qT=v=>v?(Date.parse(String(v).replace(/(\.\d{3})\d+/,'$1'))||0):0;
const qNow=()=>Date.now()+qs.skew;                                            /* the database's clock, not the phone's */
const qLive=()=>!!(cloud.user&&qs.ready);
export const qMode=()=>cloud.user?(qs.ready?'live':(qs.err?'error':'loading')):(cloud.mode?'offline':'demo');
export const qCan=()=>{const m=qMode();return m==='demo'||(m==='live'&&cloud.status!=='offline'&&navigator.onLine!==false);};
const qName=id=>{const a=attendees.find(x=>x.id===id);return a?a.name:id;};
const qMin=ms=>{const m=Math.floor(Math.max(0,ms)/60000);return m<1?'<1 min':m<60?m+' min':Math.floor(m/60)+' h '+(m%60)+' min';};
const rowToQ=r=>({id:qSafe(r.id),attendeeId:qSafe(r.attendee_id),station:qSafe(r.station),status:r.status,
  joinedAt:qT(r.joined_at),calledAt:qT(r.called_at),finishedAt:qT(r.finished_at)});
function qApply(r){
 if(!['waiting','serving','done','left'].includes(r.status))return;
 const e=rowToQ(r),i=queue.findIndex(x=>x.id===e.id);
 if(i>=0)queue[i]=e;else queue.push(e);
 if(r.updated_at&&r.updated_at>qs.since)qs.since=r.updated_at;
}
const qActive=(att,st)=>queue.find(e=>e.attendeeId===att&&(!st||e.station===st)&&(e.status==='waiting'||e.status==='serving'));
export const qList=(st,status)=>queue.filter(e=>e.station===st&&e.status===status)
  .sort((a,b)=>(status==='waiting'?a.joinedAt-b.joinedAt:a.calledAt-b.calledAt)||(a.id<b.id?-1:1));
export function qStats(st){
 const now=qNow(),wait=qList(st,'waiting'),serving=qList(st,'serving'),done=queue.filter(e=>e.station===st&&e.status==='done');
 const took=done.filter(e=>e.calledAt&&e.finishedAt>e.calledAt).sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,15).map(e=>e.finishedAt-e.calledAt);
 const real=took.length>=3,avg=real?took.reduce((a,b)=>a+b,0)/took.length:(QUEUE_DEFAULT_MIN[st]||6)*60000;
 const longest=wait.length?Math.max(0,now-wait[0].joinedAt):0;
 /* people being served right now is the best guess for how many desks are open */
 const eta=wait.length?wait.length*avg/Math.max(1,serving.length):0;
 const mins=longest/60000;
 let tone=mins>=QUEUE_ALERT?'flag':mins>=QUEUE_WARN?'watch':'ok';
 if(wait.length&&!serving.length&&tone==='ok')tone='watch';                 /* people are waiting and nobody is serving */
 return {wait,serving,done:done.length,avg,real,samples:took.length,longest,eta,tone};
}

/* ---------- changes ---------- */
function qGate(){
 const m=qMode();
 if(m==='live'&&!qCan()){toast('No connection — the queue cannot change until you reconnect');return false;}
 if(qCan())return true;
 toast(m==='offline'?'No connection — the queue needs one so every desk sees the same line':m==='error'?'The live queue is not working yet — see the message on this screen':'Connecting to the live queue… try again in a moment');
 return false;
}
async function qRun(fn){if(qs.busy)return;qs.busy=true;try{await fn();}finally{qs.busy=false;}}
function qFail(err){
 console.warn('queue:',err);
 const msg=String((err&&err.message)||err||'');
 if(!navigator.onLine||/failed to fetch|networkerror|load failed|network request/i.test(msg))toast('No connection — nothing was changed');
 else if(err&&err.code==='42501')toast('This sign-in is not approved for the queue');
 else toast('Queue change failed: '+msg);
 queueSync();
}
export async function queueJoin(att,st){
 if(!qGate())return false;
 if(qActive(att,st)){toast(`${qName(att)} is already in this line`);return false;}
 let ok=false;
 await qRun(async()=>{
  if(!qLive()){
   queue.push({id:'L'+(qs.seq++),attendeeId:qSafe(att),station:st,status:'waiting',joinedAt:Date.now(),calledAt:0,finishedAt:0});ok=true;
  }else{
   const {data,error}=await cloud.client.from('queue_entries').insert({attendee_id:att,station:st}).select().single();
   if(error){if(error.code==='23505'){toast(`${qName(att)} is already in this line`);queueSync();}else qFail(error);return;}
   qApply(data);ok=true;
  }
  const n=qList(st,'waiting').length;
  toast(`${firstName(qName(att))} added · ${n===1?'next up':n+' waiting'}`);
 });
 qAfter();return ok;
}
export async function queueCallNext(st){
 if(!qGate())return;
 await qRun(async()=>{
  let e;
  if(!qLive()){
   e=qList(st,'waiting')[0];
   if(e){e.status='serving';e.calledAt=Date.now();e.finishedAt=0;}
  }else{
   const {data,error}=await cloud.client.rpc('queue_call_next',{p_station:st});
   if(error)return qFail(error);
   if(data&&data.length){qApply(data[0]);e=queue.find(x=>x.id===qSafe(data[0].id));}
  }
  if(!e){toast('Nobody is waiting here');return;}
  toast(`Next: ${qName(e.attendeeId)} · ${e.attendeeId}`);
 });
 qAfter();
}
async function qMove(id,to,from,msg){
 if(!qGate())return;
 await qRun(async()=>{
  const e=queue.find(x=>x.id===id);
  if(!e||!from.includes(e.status))return;
  if(!qLive()){
   const t=Date.now();e.status=to;
   if(to==='serving'){e.calledAt=t;e.finishedAt=0;}
   if(to==='waiting'){e.calledAt=0;e.finishedAt=0;}
   if(to==='done'||to==='left')e.finishedAt=t;
  }else{
   const {data,error}=await cloud.client.from('queue_entries').update({status:to}).eq('id',id).in('status',from).select();
   if(error)return qFail(error);
   if(!data.length){toast('Someone else just changed that one');queueSync();return;}
   qApply(data[0]);
  }
  if(msg)toast(msg(e));
 });
 qAfter();
}
export const queueServe=id=>qMove(id,'serving',['waiting'],e=>`Next: ${qName(e.attendeeId)} · ${e.attendeeId}`);
export const queueDone=id=>qMove(id,'done',['serving'],e=>`${firstName(qName(e.attendeeId))} finished ✓`);
export const queueBack=id=>qMove(id,'waiting',['serving'],e=>`${firstName(qName(e.attendeeId))} is back in line (same place)`);
export function queueRemove(id){
 if(qs.confirm!==id){qs.confirm=id;clearTimeout(qs.confT);qs.confT=setTimeout(()=>{qs.confirm='';if(state.tab==='queue')renderMain();},3000);renderMain();return;}
 qs.confirm='';
 qMove(id,'left',['waiting','serving'],e=>`${firstName(qName(e.attendeeId))} removed from the line`);
}
export function qSelect(k){state.qStation=k;qs.confirm='';renderMain();}

/* ---------- loading and live updates ---------- */
export async function queueSync(manual){
 if(!cloud.client||!cloud.user||qs.syncing)return;
 qs.syncing=true;
 try{
  const clock=await cloud.client.rpc('queue_now');
  if(clock.error)throw clock.error;
  qs.skew=qT(clock.data)-Date.now();
  const first=!qs.ready||!!manual,col=first?'joined_at':'updated_at';
  const from=first?new Date(qNow()-QUEUE_WINDOW_H*36e5).toISOString():(qs.since||new Date(qNow()-QUEUE_WINDOW_H*36e5).toISOString());
  const rows=[];
  for(let p=0;p<100;p++){
   const {data,error}=await cloud.client.from('queue_entries').select('*').gte(col,from).order(col).order('id').range(p*500,p*500+499);
   if(error)throw error;
   rows.push(...data);if(data.length<500)break;
  }
  if(first){queue.length=0;qs.since='';}
  rows.forEach(qApply);
  if(!qs.since)qs.since=from;
  qs.ready=true;qs.err='';
  startQueueRealtime();healthLive('queue',qs.rt);
 }catch(err){
  console.warn('queue sync:',err);
  const msg=String((err&&err.message)||err||'');
  if(err&&(err.code==='PGRST205'||err.code==='PGRST202'||err.code==='42P01'||err.code==='42883'||/schema cache|could not find the (table|function)/i.test(msg)))
   {qs.ready=false;qs.err='The live queue is not set up yet. Run supabase/schema.sql again in the Supabase SQL editor.';}
  else if(!navigator.onLine||/failed to fetch|networkerror|load failed|network request/i.test(msg)){if(!qs.ready)qs.err='Could not reach the server yet — retrying.';}
  else if(err&&(err.code==='42501'||/row-level security|permission denied/i.test(msg)))
   {qs.ready=false;qs.err='This sign-in is not approved for the queue.';}
  else if(!qs.ready)qs.err=msg||'The queue could not load.';
  healthFromError('queue',err,isMissingErr(err)?(missingName(err)||'queue_entries'):'');
 }finally{qs.syncing=false;qAfter();}
}
function startQueueRealtime(){
 if(qs.ch||!cloud.client)return;
 const ch=cloud.client.channel('newstart-queue');
 ch.on('postgres_changes',{event:'*',schema:'public',table:'queue_entries'},p=>{
  if(p.eventType==='DELETE'){const id=qSafe(p.old&&p.old.id),i=queue.findIndex(e=>e.id===id);if(i>=0)queue.splice(i,1);}
  else if(p.new&&p.new.id)qApply(p.new);
  else return;
  qRefresh();
 });
 ch.subscribe(st=>{
  qs.rt=st;healthLive('queue',st);
  if(st==='SUBSCRIBED'){if(qs.subbed)queueSync();qs.subbed=true;}    /* reconnected: fetch whatever was missed */
  qRefresh();
 });
 qs.ch=ch;
}
export function queueReset(){
 if(qs.ch&&cloud.client){try{cloud.client.removeChannel(qs.ch);}catch(e){}}
 qs.ch=null;qs.rt='';qs.subbed=false;qs.ready=false;qs.err='';qs.since='';qs.skew=0;qs.confirm='';
 queue.length=0;
}
function qRefresh(){clearTimeout(qs.renderT);qs.renderT=setTimeout(qAfter,150);}
function qAfter(){renderNav();if(state.tab==='queue')renderMain();if(tvOpen())renderBigScreen();}

/* ---------- adding a visitor to a line ---------- */
export function openQueuePick(st){
 if(!qGate())return;
 qs.pick=st;qs.pickQ='';
 $('#queueHead').innerHTML=`<h3 class="display text-base font-extrabold">Add to ${esc((BOOTH(st)||{}).label||st)}</h3>
  <input id="qq" type="search" placeholder="Search by name, badge or phone" data-on-input="queue-filter" class="field mt-2.5" autocomplete="off">`;
 qRenderPick();showModal('#queueModal');
}
export function closeQueuePick(){hideModal('#queueModal');qs.pick='';}
export function qFilterPick(v){qs.pickQ=v;qRenderPick();}
function qRenderPick(){
 const rows=visitorsToShow(qs.pickQ),el=$('#queueList');
 if(!rows.length){el.innerHTML=`<p class="q-empty">${String(qs.pickQ||'').trim()?'Nobody matches that.':'No visitors yet — register the first one.'}</p>`;return;}
 el.innerHTML=rows.map(a=>{
  const here=qActive(a.id,qs.pick);
  const elsewhere=queue.filter(e=>e.attendeeId===a.id&&e.station!==qs.pick&&(e.status==='waiting'||e.status==='serving'))
   .map(e=>`<span class="chip chip-none">${esc(QUEUE_SHORT[e.station]||e.station)}${e.status==='serving'?' · now':''}</span>`).join(' ');
  return `<button class="q-pick" ${here?'disabled':`data-action="qPickAdd" data-args="${a.id}"`}>
   <span class="flex h-9 w-9 flex-none items-center justify-center rounded-[13px] text-[11px] font-extrabold tint hue-${hueOf(a.id)}">${esc(initials(a.name))}</span>
   <span class="q-who"><b>${esc(a.name)}</b><span class="mono">${esc(a.id)}</span>${elsewhere?`<span style="margin-top:2px">${elsewhere}</span>`:''}</span>
   <span class="${here?'chip chip-ok':'q-mini q-mini-soft'}">${here?(here.status==='serving'?'Being served':'In line ✓'):'Add'}</span>
  </button>`}).join('');
}
export async function qPickAdd(id){if(qs.pick)await queueJoin(id,qs.pick);qRenderPick();}

/* ---------- screen ---------- */
/* [kind, text for staff, short text for the big screen] */
function qStateInfo(mode){
 if(mode==='live'){
  if(cloud.status==='offline'||navigator.onLine===false)return ['warn','Offline — the line is paused here until you reconnect. What you see may be out of date.','Offline — numbers may be out of date'];
  return qs.rt==='SUBSCRIBED'?['live','Live — every desk sees this same line','Live']:['warn','Reconnecting… numbers may be a few seconds behind','Reconnecting…'];
 }
 if(mode==='loading')return ['info','Connecting to the live queue…','Connecting…'];
 if(mode==='error')return ['bad',esc(qs.err),'Queue not available'];
 if(mode==='offline')return ['warn','No connection. The queue needs one so every desk sees the same line.','No connection — numbers may be out of date'];
 return ['info','Practice mode — sign in to share this queue between desks. Nothing here is saved.','Practice mode'];
}
export function qStateBar(mode){
 const [k,txt]=qStateInfo(mode);
 const extra=(mode==='error'?`<button class="q-mini q-mini-soft" data-action="queue-sync">Retry</button>`:'')+(k==='warn'||k==='bad'?`<button class="q-mini q-mini-soft" data-action="openCloud">Details</button>`:'');
 return `<div class="q-state q-state-${k} mt-2.5"><span class="q-dot"></span><span style="flex:1">${txt}</span>${extra}</div>`;
}

/* ---------- big screen ---------- */
const tvOpen=()=>!$('#tv').classList.contains('hidden');
function renderBigScreen(){
 const [k,,short]=qStateInfo(qMode());
 const st=$('#tvState');st.className='q-tv-sub '+k;st.innerHTML=`<i></i>${esc(short)}`;
 $('#tvClock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
 $('#tvGrid').innerHTML=QUEUE_STATIONS.map(key=>{
  const s=qStats(key),now=s.serving.slice(0,2),more=s.serving.length-now.length,nxt=s.wait.slice(0,4),rest=s.wait.length-nxt.length;
  return `<div class="q-tv-tile q-tv-${s.tone}">
   <div class="q-tv-name">${esc(QUEUE_SHORT[key])}</div>
   <div class="q-tv-lab">Now serving</div>
   ${now.length?`<div class="q-tv-now">${now.map(e=>esc(e.attendeeId.replace(/^EXPO-/,''))).join(' · ')}${more>0?`<small>+${more}</small>`:''}</div>`:'<div class="q-tv-none">—</div>'}
   <div class="q-tv-lab">Next</div>
   ${nxt.length?`<div class="q-tv-next">${nxt.map(e=>`<span>${esc(e.attendeeId.replace(/^EXPO-/,''))}</span>`).join('')}${rest>0?`<span>+${rest}</span>`:''}</div>`:'<div class="q-tv-none">Nobody waiting</div>'}
   <div class="q-tv-meta">${s.wait.length?`${s.wait.length} waiting · about ${Math.max(1,Math.round(s.eta/60000))} min`:'No wait — walk right in'}</div>
  </div>`;}).join('');
}
export function openBigScreen(){
 const tv=$('#tv');tv.classList.remove('hidden');renderBigScreen();
 try{const p=tv.requestFullscreen&&tv.requestFullscreen();if(p&&p.catch)p.catch(()=>{});}catch(e){}
 qWake();
}
export function closeBigScreen(){
 $('#tv').classList.add('hidden');
 try{if(document.fullscreenElement){const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{});}}catch(e){}
 if(qs.wake){try{qs.wake.release();}catch(e){}qs.wake=null;}
}
/* keep a TV from going to sleep */
async function qWake(){try{if(navigator.wakeLock&&tvOpen()&&!qs.wake){qs.wake=await navigator.wakeLock.request('screen');qs.wake.addEventListener('release',()=>{qs.wake=null;});}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&tvOpen())qWake();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tvOpen())closeBigScreen();});
function qCard(k,st,sel){
 const first=st.serving[0],more=st.serving.length-1;
 const serve=first?`Serving <b>${esc(first.attendeeId)}</b>${more>0?` +${more}`:''}`:(st.wait.length?'<b>Nobody serving</b>':'Free — nobody here');
 const eta=st.wait.length?`About <b>${Math.max(1,Math.round(st.eta/60000))} min</b> · longest ${qMin(st.longest)}`:'No wait';
 return `<button data-action="qSelect" data-args="${k}" class="q-card q-card-${st.tone} ${sel?'q-card-sel':''}" aria-pressed="${sel}">
  <span class="q-card-top"><span class="q-card-name">${esc(QUEUE_SHORT[k])}</span><span class="q-card-dot"></span></span>
  <span class="q-card-n">${st.wait.length}<small>waiting</small></span>
  <span class="q-card-line">${serve}</span><span class="q-card-line">${eta}</span></button>`;
}
function qRow(e,i,st){
 const now=qNow(),name=qName(e.attendeeId),av=`<span class="flex h-9 w-9 flex-none items-center justify-center rounded-[13px] text-[11px] font-extrabold tint hue-${hueOf(e.attendeeId)}">${esc(initials(name))}</span>`;
 const sure=qs.confirm===e.id,x=`<button class="q-mini q-mini-x ${sure?'q-sure':''}" data-action="queueRemove" data-args="${e.id}" aria-label="Remove ${esc(name)} from the line">${sure?'Remove?':'✕'}</button>`;
 if(e.status==='serving')
  return `<div class="q-row q-row-serving">${av}<div class="q-who"><b>${esc(name)}</b><span class="mono">${esc(e.attendeeId)} · with you for ${qMin(now-e.calledAt)}</span></div>
   <div class="q-btns"><button class="q-mini q-mini-go" data-action="queueDone" data-args="${e.id}">Done ✓</button>
   <button class="q-mini q-mini-soft" data-action="queueBack" data-args="${e.id}" aria-label="Put ${esc(name)} back in line" title="Put back in line">↩</button>${x}</div></div>`;
 const w=now-e.joinedAt,cls=w/60000>=QUEUE_ALERT?'q-late':w/60000>=QUEUE_WARN?'q-slow':'';
 return `<div class="q-row"><span class="q-pos">${i+1}</span><div class="q-who"><b>${esc(name)}</b>
   <span class="mono ${cls}">${esc(e.attendeeId)} · waiting ${qMin(w)}</span></div>
   <div class="q-btns"><button class="q-mini q-mini-soft" data-action="queueServe" data-args="${e.id}">Call</button>${x}</div></div>`;
}
function qDetail(k,st,can){
 const dis=can?'':' disabled',m=Math.max(1,Math.round(st.avg/60000));
 const note=st.real?`Average ${m} min per person (last ${st.samples} finished). ${st.done} finished today.`
  :`Estimating ${m} min per person until a few visits have finished here. ${st.done} finished today.`;
 return `<div class="glass p-4">
  <div class="q-head"><div><div class="microlabel">Station</div><div class="display text-base font-extrabold">${esc((BOOTH(k)||{}).label||k)}</div></div></div>
  <div class="q-actions">
   <button class="btn btn-primary" data-action="queueCallNext" data-args="${k}"${can&&st.wait.length?'':' disabled'}>Call next →</button>
   <button class="btn btn-soft" data-action="openQueuePick" data-args="${k}"${dis}>+ Add visitor</button>
  </div>
  <div class="q-label">Being served · ${st.serving.length}</div>
  ${st.serving.length?st.serving.map((e,i)=>qRow(e,i,st)).join(''):'<div class="q-empty">Nobody being served right now.</div>'}
  <div class="q-label">Waiting · ${st.wait.length}</div>
  ${st.wait.length?st.wait.map((e,i)=>qRow(e,i,st)).join(''):'<div class="q-empty">Nobody waiting — nice and quiet ✓</div>'}
  <p class="q-note">${note}</p>
 </div>`;
}
export function viewQueue(){
 const mode=qMode(),can=qCan();
 const sel=QUEUE_STATIONS.includes(state.qStation)?state.qStation:QUEUE_STATIONS[0];
 const S={};QUEUE_STATIONS.forEach(k=>S[k]=qStats(k));
 const tot=QUEUE_STATIONS.reduce((t,k)=>({w:t.w+S[k].wait.length,s:t.s+S[k].serving.length,d:t.d+S[k].done,l:Math.max(t.l,S[k].longest)}),{w:0,s:0,d:0,l:0});
 const tile=(n,l)=>`<div class="q-total"><b>${n}</b><span>${l}</span></div>`;
 return `<section class="space-y-3.5">
  <div class="glass p-4">
   <div class="q-head"><div><div class="microlabel">Live queue</div>
    <div class="display text-base font-extrabold">Who is waiting where</div></div>
    <button class="btn btn-soft q-tvbtn" data-action="openBigScreen">Big screen</button></div>
   ${qStateBar(mode)}
   <div class="q-totals">${tile(tot.w,'Waiting')}${tile(tot.s,'Being served')}${tile(tot.d,'Finished')}${tile(tot.w?qMin(tot.l).replace(' min','m'):'—','Longest wait')}</div>
  </div>
  <div class="q-board">${QUEUE_STATIONS.map(k=>qCard(k,S[k],k===sel)).join('')}</div>
  ${qDetail(sel,S[sel],can)}
 </section>`;
}
setInterval(()=>{if((state.tab==='queue'||tvOpen())&&!document.hidden)qAfter();},20000);   /* the "waiting 7 min" figures tick up */
