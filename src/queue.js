// @ts-check
import { $ } from './helpers.js';
import { cloud, persist } from './state.js';
import { BOOTH, attendees, hueOf, state } from './data.js';
import { renderMain, renderNav, toast, toastUndo } from './shell.js';
import { esc, firstName, initials } from './helpers.js';
import { healthFromError, healthLive, isMissingErr, missingName } from './cloud.js';
import { hideModal, isAdminAcct, registerNew, showModal } from './volunteer.js';
import { overlayClosed, overlayOpened } from './overlay.js';
import { switchTo, switchTab, visitorsToShow } from './visitor.js';
import { confirmAsk } from './feedback.js';
/* The live queue shared between desks. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* ================= LIVE QUEUE =================
   Who is waiting at which station, shared between desks through the queue_entries table (see supabase/schema.sql).
   Unlike visitors and volunteers this is NOT offline-first: a line only means something if every desk sees the same
   line, so changes go straight to the database and are refused when there is no connection. Signed out, the tab runs
   as an in-memory practice queue on this device so staff can try it. */
/* One line for each of the 8 health-age checks (Blood Sugar and Cholesterol share one, as they are one finger-prick), then the
   optional stops. The four lifestyle lines use the passport's own reading keys (veg, walk, water, sleep). */
const QUEUE_STATIONS=['vitals','bp','sugar','veg','walk','water','sleep','kitchen','plan','prayer'];
const QUEUE_SHORT={vitals:'Vitals & BMI',bp:'Blood Pressure',sugar:'Sugar & Chol.',veg:'Fruit & Veg',walk:'Exercise',water:'Water',sleep:'Sleep',kitchen:'Kitchen Pharmacy',plan:'Counselling',prayer:'Prayer'};
/* the checks done at each line, named as the passport names them (see QUEUE_OF_READING); shown on the cards, the panel and the big screen */
export const QUEUE_CHECKS={vitals:['Weight','Height','Waist'],bp:['Blood pressure'],sugar:['Blood sugar','Cholesterol'],veg:['Fruit & Veg'],walk:['Exercise'],water:['Water'],sleep:['Sleep']};
const QUEUE_NOCHECK={kitchen:'No checks · optional stop',plan:'No checks · the 90-day plan',prayer:'No checks · optional stop'};
/* a line named after its one check (Exercise → Exercise) says what is recorded instead of repeating its own name */
const QUEUE_CHECK_NOTE={bp:'Top and bottom number',veg:'Servings a day',walk:'Minutes of brisk exercise a day',water:'Glasses a day',sleep:'Hours a night'};
export const qChecksText=k=>{
 const l=QUEUE_CHECKS[k];
 if(!l)return QUEUE_NOCHECK[k]||'';
 return l.length===1&&l[0].toLowerCase()===QUEUE_SHORT[k].toLowerCase()&&QUEUE_CHECK_NOTE[k]?QUEUE_CHECK_NOTE[k]:l.join(' · ');
};
/* The route a visitor walks without anyone typing them into each line: registering puts them in the first line, and
   Done at one of these stations puts them in the next one they have not finished. Kitchen Pharmacy and Prayer are
   optional stops, added by hand with + Add visitor. */
/* v1.6.2: Blood Pressure first (a calm reading before anyone stands on a scale or walks to the next table), then the finger-prick, then Vitals & BMI. */
export const QUEUE_FLOW=['bp','sugar','vitals','veg','walk','water','sleep','plan'];
const QUEUE_WARN=10,QUEUE_ALERT=20;      /* minutes the longest-waiting person has stood in line: amber, then red */
const QUEUE_WINDOW_H=18;                 /* only today's queue is loaded */
export const queue=[];                          /* {id,attendeeId,station,status,joinedAt,calledAt,finishedAt,slot}; times in ms; slot: the place (1..N) at a station serving several at once, kept on this device */
export const qs={ready:false,err:'',ch:null,rt:'',church:'',subbed:false,skew:0,since:'',busy:false,syncing:false,seq:1,confirm:'',pick:'',pickQ:'',renderT:null,retryT:null,names:''};

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
 if(i>=0){if(queue[i].slot&&e.status==='serving')e.slot=queue[i].slot;queue[i]=e;}else queue.push(e);   /* the place is this device's, the row does not carry it */
 if(r.updated_at&&r.updated_at>qs.since)qs.since=r.updated_at;
}
const qActive=(att,st)=>queue.find(e=>e.attendeeId===att&&(!st||e.station===st)&&(e.status==='waiting'||e.status==='serving'));
export const qList=(st,status)=>queue.filter(e=>e.station===st&&e.status===status)
  .sort((a,b)=>(status==='waiting'?a.joinedAt-b.joinedAt:a.calledAt-b.calledAt)||(a.id<b.id?-1:1));
/* ---------- several people served at once (v1.6.2) ----------
   A station can have up to QCAP_MAX places (3 blood-pressure nurses, 2 prayer partners). Each person being served
   holds a place (entry.slot). The count and the optional place names are kept on this device only (QCAP_KEY):
   they describe how this desk is staffed, not the shared line. */
const QCAP_KEY = 'newstart.qcap.v1';
const DQ_KEY = 'newstart.demoQueue.v1';
const QCAP_MAX = 6;
let qcapCache = null;
function qcfg() {
 if (qcapCache) {
  return qcapCache;
 }
 let o = {};
 try {
  o = JSON.parse(localStorage.getItem(QCAP_KEY) || '{}') || {};
 } catch {
  o = {};
 }
 return (qcapCache = typeof o === 'object' && !Array.isArray(o) ? o : {});
}
function qcfgWrite() {
 let o = qcfg();
 for (let k of Object.keys(o)) {
  let c = o[k];
  if (!c || !QUEUE_STATIONS.includes(k) || ((c.n | 0) <= 1 && !(c.l || []).some(Boolean))) {
   delete o[k];
  }
 }
 try {
  if (Object.keys(o).length) {
   localStorage.setItem(QCAP_KEY, JSON.stringify(o));
  } else {
   localStorage.removeItem(QCAP_KEY);
  }
 } catch {}
}
export function qCap(st) {
 let c = qcfg()[st];
 let n = c ? Number(c.n) : 1;
 if (n >= 1 && n <= QCAP_MAX) {
  return Math.floor(n);
 }
 return 1;
}
export function qSlotName(st, n) {
 let c = qcfg()[st];
 let l =
  c && Array.isArray(c.l)
   ? String(c.l[n - 1] || '')
      .trim()
      .slice(0, 24)
   : '';
 return l || `Place ${n}`;
}
function qSlotsFix(st) {
 let cap = qCap(st);
 let sv = queue
  .filter(e => e.station === st && e.status === 'serving')
  .sort((a, b) => a.calledAt - b.calledAt || (a.id < b.id ? -1 : 1));
 let used = new Set();
 for (let e of sv) {
  let n = e.slot | 0;
  if (n >= 1 && n <= cap && !used.has(n)) {
   used.add(n);
  } else {
   e.slot = 0;
  }
 }
 for (let e of sv) {
  if (!e.slot) {
   for (let n = 1; n <= cap; n++) {
    if (!used.has(n)) {
     e.slot = n;
     used.add(n);
     break;
    }
   }
  }
 }
 return sv.sort((a, b) => (a.slot || 99) - (b.slot || 99) || a.calledAt - b.calledAt);
}
export const qFree = st => qCap(st) - qSlotsFix(st).filter(e => e.slot).length;
const qServingAt = (st, n) => qSlotsFix(st).find(e => e.slot === n) || null;
export function qAt(e) {
 if (!e || e.status !== 'serving' || qCap(e.station) < 2) {
  return '';
 }
 qSlotsFix(e.station);
 if (e.slot) {
  return ` \xB7 ${qSlotName(e.station, e.slot)}`;
 }
 return ' · extra (all places busy)';
}
function qPlace(e, n) {
 if (!e || !n) {
  return;
 }
 let cap = qCap(e.station);
 if (n >= 1 && n <= cap && !queue.some(x => x !== e && x.station === e.station && x.status === 'serving' && x.slot === n)) {
  e.slot = n;
 }
 qSlotsFix(e.station);
}
const qHM = t => {
 if (t) {
  return new Date(t).toLocaleTimeString([], {
   hour: '2-digit',
   minute: '2-digit'
  });
 }
 return '';
};
export function qCapSet(arg) {
 let [k, d] = String(arg || '').split('|');
 if (!QUEUE_STATIONS.includes(k)) {
  return;
 }
 let n = Math.min(QCAP_MAX, Math.max(1, qCap(k) + (Number(d) || 0)));
 let o = qcfg();
 o[k] = {
  ...o[k],
  n
 };
 qcfgWrite();
 if (n < 2 && qs.names === k) {
  qs.names = '';
 }
 toast(`${QUEUE_SHORT[k]}: ${n === 1 ? 'one person at a time' : `${n} people at once`}`);
 qAfter();
}
export function qNamesToggle(k) {
 qs.names = qs.names === k ? '' : k;
 qAfter();
}
export function qSlotNameSet(arg, v) {
 const [k, ns] = String(arg || '').split('|');
 const n = Number(ns) | 0;
 if (!QUEUE_STATIONS.includes(k) || n < 1 || n > QCAP_MAX) {
  return;
 }
 let o = qcfg();
 let c = (o[k] = {
  n: qCap(k),
  ...o[k]
 });
 let l = Array.isArray(c.l) ? c.l.slice(0, QCAP_MAX) : [];
 while (l.length < n) {
  l.push('');
 }
 l[n - 1] = String(v || '')
  .replace(/[<>]/g, '')
  .trim()
  .slice(0, 24);
 c.l = l;
 qcfgWrite();
 qAfter();
}
export function qSlotMove(id) {
 let e = queue.find(x => x.id === id && x.status === 'serving');
 if (!e) {
  return;
 }
 let e_station = e.station;
 let cap = qCap(e_station);
 if (cap < 2) {
  return;
 }
 qSlotsFix(e_station);
 let t = e.slot ? (e.slot % cap) + 1 : 1;
 if (!e.slot) {
  for (let n = 1; n <= cap; n++) {
   if (!qServingAt(e_station, n)) {
    t = n;
    break;
   }
  }
 }
 let o = qServingAt(e_station, t);
 if (o && o !== e) {
  o.slot = e.slot;
 }
 e.slot = t;
 toast(
  `${firstName(qName(e.attendeeId))} \u2192 ${qSlotName(e_station, t)}${o && o !== e ? ` \xB7 ${firstName(qName(o.attendeeId))} \u2192 ${o.slot ? qSlotName(e_station, o.slot) : 'extra'}` : ''}`
 );
 qAfter();
}
export async function qSlotCall(arg) {
 const [st, ns] = String(arg || '').split('|');
 const n = Number(ns) | 0;
 if (!QUEUE_STATIONS.includes(st)) {
  return;
 }
 if (qServingAt(st, n)) {
  toast(`${qSlotName(st, n)} is busy`);
  return;
 }
 await qCall(st, false, n);
}
export function qPlacesOpen() {
 switchTab('queue');
 setTimeout(() => {
  let d = $('#qPlaces');
  if (d && d.scrollIntoView) {
   d.scrollIntoView({
    block: 'center'
   });
  }
 }, 350);
}
/* ---------- memory: this phone keeps only the latest finished/removed entries (default 150) ----------
   Visitor records and care notes are not touched; they keep their own POPIA retention. */
export const QHIST_KEY = 'newstart.qHistCap';
export const qHistCap = () => {
 let n = 0;
 try {
  n = +localStorage.getItem(QHIST_KEY);
 } catch {}
 if (n >= 20 && n <= 1000) {
  return Math.round(n);
 }
 return 150;
};
export function qPruneHistory() {
 let cap = qHistCap();
 let fin = queue.filter(e => e.status === 'done' || e.status === 'left');
 if (fin.length <= cap) {
  return 0;
 }
 fin.sort((a, b) => (b.finishedAt || b.joinedAt || 0) - (a.finishedAt || a.joinedAt || 0));
 let drop = new Set(fin.slice(cap).map(e => e.id));
 let queue_length = queue.length;
 for (let i = queue.length - 1; i >= 0; i--) {
  if (drop.has(queue[i].id)) {
   queue.splice(i, 1);
  }
 }
 return queue_length - queue.length;
}
function qDemoSave() {
 qPruneHistory();
 if (!cloud.demo || qMode() !== 'demo') {
  return;
 }
 try {
  localStorage.setItem(
   DQ_KEY,
   JSON.stringify({
    seq: qs.seq,
    q: queue.map(e => ({
     id: e.id,
     attendeeId: e.attendeeId,
     station: e.station,
     status: e.status,
     joinedAt: e.joinedAt,
     calledAt: e.calledAt,
     finishedAt: e.finishedAt,
     slot: e.slot | 0
    }))
   })
  );
 } catch {}
}
/* Practice mode keeps its queue on this phone between openings, so the tour and a practice run can pick up again. */
export function qDemoLoad() {
 try {
  let o = JSON.parse(localStorage.getItem(DQ_KEY) || 'null');
  if (!o || !Array.isArray(o.q) || !o.q.length) {
   return false;
  }
  let ok = o.q
   .filter(
    e =>
     e &&
     ['waiting', 'serving', 'done', 'left'].includes(e.status) &&
     QUEUE_STATIONS.includes(e.station) &&
     attendees.some(a => a.id === e.attendeeId)
   )
   .map(e => ({
    id: qSafe(e.id),
    attendeeId: qSafe(e.attendeeId),
    station: e.station,
    status: e.status,
    joinedAt: +e.joinedAt || 0,
    calledAt: +e.calledAt || 0,
    finishedAt: +e.finishedAt || 0,
    slot: e.slot | 0
   }));
  if (!ok.length) {
   return false;
  }
  queue.push(...ok);
  qs.seq = Math.max(qs.seq, Number(o.seq) || 1);
  return true;
 } catch {
  return false;
 }
}
export function qDemoClear() {
 try {
  localStorage.removeItem(DQ_KEY);
  localStorage.removeItem(QHIST_KEY);
  localStorage.removeItem(QCAP_KEY);
 } catch {}
 qcapCache = null;
 qs.names = '';
}
/* ---------- the serving area of the station panel ---------- */
function qPlacesBar(k, { cap }) {
 let nm = esc(QUEUE_SHORT[k] || k);
 return `<div id="qPlaces" class="q-places" data-tour="q-places"><span class="q-places-t">People served at once</span><button class="q-ms q-ms-b" data-action="qCapSet" data-args="${esc(k)}|-1" aria-label="Fewer people at once at ${nm}"${cap <= 1 ? ' disabled' : ''}>\u2212</button><b class="q-places-n" aria-live="polite" aria-label="${cap} at once">${cap}</b><button class="q-ms q-ms-b" data-action="qCapSet" data-args="${esc(k)}|1" aria-label="More people at once at ${nm}"${cap >= QCAP_MAX ? ' disabled' : ''}>+</button>${cap > 1 ? `<button class="q-ms q-ms-soft" data-action="qNamesToggle" data-args="${esc(k)}" aria-expanded="${qs.names === k}">Name places</button>` : ''}</div>${cap > 1 && qs.names === k ? qNamesForm(k, cap) : ''}<button type="button" class="q-skipf" data-action="qSkipFilledToggle" aria-pressed="${qSkipFilled()}">Skip lines whose readings are in: <b>${qSkipFilled() ? 'On' : 'Off'}</b></button>`;
}
function qNamesForm(k, cap) {
 let r = '';
 let l = (qcfg()[k] || {}).l || [];
 for (let n = 1; n <= cap; n++) {
  r += `<label class="q-name-row"><span>Place ${n}</span><input class="field q-name-in" maxlength="24" autocomplete="off" data-on-change="qSlotName" data-args="${esc(k)}|${n}" value="${esc(l[n - 1] || '')}" placeholder="e.g. Nurse ${String.fromCharCode(64 + n)}" aria-label="Name for place ${n}"></label>`;
 }
 return `<div class="q-names">${r}<p class="q-note">Optional: a desk, room or role, shown on the cards and the big screen. Leave empty for Place 1, Place 2\u2026</p></div>`;
}
function qServeBlock(k, st, can) {
 let cb = (attr, lab) =>
  `<button class="btn btn-primary q-big" ${attr}${can && !qs.busy && st.wait.length ? '' : ' disabled'}>${lab}</button>`;
 if (st.cap < 2) {
  return `<div class="q-label">With you now${st.serving.length ? ` \xB7 ${st.serving.length}` : ''}</div>${qPlacesBar(k, st)}${st.serving.length ? st.serving.map((e, i) => qRow(e, i, st)).join('') : cb(`data-action="queueCallNext" data-args="${esc(k)}"`, 'Call next →')}`;
 }
 let used = st.serving.filter(e => e.slot).length;
 let cards = [];
 for (let n = 1; n <= st.cap; n++) {
  let e = st.serving.find(x => x.slot === n);
  let nm = esc(qSlotName(k, n));
  cards.push(
   e
    ? qRow(e, n - 1, st)
    : `<div class="q-slot-free"><div class="q-slot-tag">${nm} \xB7 free</div>${cb(`data-action="qSlotCall" data-args="${esc(k)}|${n}" aria-label="Call next to ${nm}"`, `Call next \u2192 ${nm}`)}</div>`
  );
 }
 st.serving.filter(e => !e.slot).forEach(e => cards.push(qRow(e, 0, st)));
 return `<div class="q-label">With you now \xB7 serving ${used} of ${st.cap}</div>${qPlacesBar(k, st)}${cards.join('')}`;
}
function qTvSlots(key, s) {
 let r = '';
 for (let n = 1; n <= s.cap; n++) {
  let e = s.serving.find(x => x.slot === n);
  r += `<div class="q-tv-slot${e ? '' : ' is-free'}"><span>${esc(qSlotName(key, n))}</span><b>${e ? esc(e.attendeeId.replace(/^EXPO-/, '')) : 'free'}</b></div>`;
 }
 let length = s.serving.filter(e => !e.slot).length;
 return `<div class="q-tv-slots">${r}${length ? `<div class="q-tv-slot"><span>Extra</span><b>+${length}</b></div>` : ''}</div>`;
}
export function qStats(st){
 const now=qNow(),wait=qList(st,'waiting'),serving=qList(st,'serving'),done=queue.filter(e=>e.station===st&&e.status==='done');
 const took=done.filter(e=>e.calledAt&&e.finishedAt>e.calledAt).sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,15).map(e=>e.finishedAt-e.calledAt);
 /* No time is ever invented: there is an average, and so an estimate, only once 3 visits have really finished here. */
 const real=took.length>=3,avg=real?took.reduce((a,b)=>a+b,0)/took.length:0;
 const longest=wait.length?Math.max(0,now-wait[0].joinedAt):0;
 /* How long someone joining now would wait to be called: the line ahead of them, plus what is left of the visits
    in progress, shared between the desks open (people being served now is the best guess for that; with nobody
    called yet, one desk is assumed). */
 const desks=Math.max(qCap(st),serving.length),left=serving.reduce((t,e)=>t+Math.max(0,avg-(now-(e.calledAt||now))),0);
 const eta=real&&wait.length?(wait.length*avg+left)/desks:null;
 const mins=longest/60000;
 let tone=mins>=QUEUE_ALERT?'flag':mins>=QUEUE_WARN?'watch':'ok';
 if(wait.length&&!serving.length&&tone==='ok')tone='watch';                 /* people are waiting and nobody is serving */
 return {cap:qCap(st),wait,serving:qSlotsFix(st),done:done.length,avg,real,samples:took.length,longest,eta,tone};
}

/* ---------- changes ---------- */
function qGate(){
 const m=qMode();
 if(m==='live'&&!qCan()){toast('No connection — the queue cannot change until you reconnect');return false;}
 if(qCan())return true;
 toast(m==='offline'?'No connection — the queue needs one so every desk sees the same line':m==='error'?'The live queue is not working yet — see the message on this screen':'Connecting to the live queue… try again in a moment');
 return false;
}
/* one queue change at a time per desk; a tap while one is still saving says so instead of vanishing */
async function qRun(fn){if(qs.busy){toast('One moment — the last queue change is still saving');return false;}qs.busy=true;try{await fn();}finally{qs.busy=false;}return true;}
function qFail(err){
 console.warn('queue:',err);
 const msg=String((err&&err.message)||err||'');
 if(!navigator.onLine||/failed to fetch|networkerror|load failed|network request/i.test(msg))toast('No connection — nothing was changed');
 else if(err&&err.code==='42501')toast('This sign-in is not approved for the queue');
 else toast('Queue change failed: '+msg);
 queueSync();
}
export async function queueJoin(att,st,say){
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
  if(say!==null)toast(say?say(n):`${firstName(qName(att))} added · ${n===1?'next up':n+' waiting'}`);   /* null: the caller says it */
 });
 qAfter();return ok;
}
/* The person now being served: the entry, null when nobody is waiting, undefined when the call did not happen (the
   queue refused it, a change was still saving, or it failed — those say so themselves). quiet: the caller says what
   happened. slot: the place to call them into (Call next → Place 2), else the first free one. */
async function qCall(st,quiet,slot){
 if(!qGate())return undefined;
 let e;
 await qRun(async()=>{
  if(!qLive()){
   e=qList(st,'waiting')[0]||null;
   if(e){e.status='serving';e.calledAt=Date.now();e.finishedAt=0;e.slot=0;}
  }else{
   const {data,error}=await cloud.client.rpc('queue_call_next',{p_station:st});
   if(error)return qFail(error);
   e=null;
   if(data&&data.length){qApply(data[0]);e=queue.find(x=>x.id===qSafe(data[0].id))||null;}
  }
  if(e)qPlace(e,slot);
  if(quiet)return;
  if(!e){toast('Nobody is waiting here');return;}
  toast(`Next: ${qName(e.attendeeId)} · ${e.attendeeId}${qAt(e)}`);
 });
 qAfter();return e;
}
export async function queueCallNext(st){
 if(qFree(st)<=0){const c=qCap(st);toast(`${c===1?'The place is':'All '+c+' places are'} busy at ${QUEUE_SHORT[st]||st} — tap Done on someone first`);return;}
 await qCall(st,false);
}
async function qMove(id,to,from,msg){
 if(!qGate())return;
 await qRun(async()=>{
  const e=queue.find(x=>x.id===id);
  if(!e||!from.includes(e.status))return;
  if(!qLive()){
   const t=Date.now();e.status=to;e.slot=0;
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
export const queueServe=id=>qMove(id,'serving',['waiting'],e=>`Next: ${qName(e.attendeeId)} · ${e.attendeeId}${qAt(e)}`);
export async function queueDone(id){
 await qMove(id,'done',['serving'],e=>`${firstName(qName(e.attendeeId))} finished ✓`);
 const e=queue.find(x=>x.id===id);
 if(e&&e.status==='done')await queueFlowNext(e.attendeeId,e.station);
}
/* "Start Blood Pressure for Thandi?" — asked once per visitor and station when a reading is typed while they still wait
   in that line. Never starts anyone on its own. */
const qAsked = new Map();
export const qAskClear = () => qAsked.clear();
export async function qStartAsk(id, k) {
 let st = k === 'sys' || k === 'dia' ? 'bp' : QUEUE_OF_READING[k];
 if (!st) {
  return;
 }
 let e = qActive(id, st);
 if (!e || e.status !== 'waiting') {
  return;
 }
 let key = `${id}|${st}`;
 if (qAsked.has(key)) {
  return;
 }
 qAsked.set(key, 'asking');
 let back = document.activeElement;
 let who = firstName(qName(id));
 let p = confirmAsk({
  title: `Start ${QUEUE_SHORT[st]} for ${who}?`,
  body: `${who} is still waiting in the ${QUEUE_SHORT[st]} line. Start serving them here now? No keeps them waiting in line.`,
  label: 'Yes, start',
  cancelLabel: 'No, keep waiting'
 });
 setTimeout(() => {
  let g = $('#cfGo');
  if (g && !$('#confirmSheet').classList.contains('hidden')) {
   g.focus();
  }
 }, 30);
 let ok = await p;
 qAsked.set(key, ok ? 'yes' : 'no');
 if (ok) {
  let d = qActive(id, st);
  if (d && d.status === 'waiting') {
   if (qFree(st) <= 0) {
    toast(`All places at ${QUEUE_SHORT[st]} are busy \u2014 ${who} stays in line`);
   } else {
    await queueStart(id, st);
   }
  }
 }
 try {
  if (back instanceof HTMLElement && back.isConnected) {
   back.focus({
    preventScroll: true
   });
  }
 } catch {}
}
/* Opening Results, Plan or Send home: the check stations still serving this visitor are finished and they move on
   (Send home also finishes the counselling and optional stops). */
export async function qLeaveServing(att, t) {
 let ids = queue
  .filter(e => e.attendeeId === att && e.status === 'serving' && (t === 'send' || QUEUE_CHECKS[e.station]))
  .map(e => e.id);
 if (!ids.length) {
  return;
 }
 let msg = [];
 for (let id of ids) {
  let r = await qFinish(id);
  if (r) {
   msg.push(`${QUEUE_SHORT[r.st]} done${r.moved}`);
  }
 }
 if (msg.length) {
  toast(`${firstName(qName(att))}: ${msg.join(' · ')}`);
 }
 qAfter();
}
/* The desk's whole turn in one tap: finish this person, send them on to their next line, and call whoever has waited
   longest here. One message says all three, because the visitor needs telling where to go next. If the finish does
   not go through, nobody is called. */
/* finish a person being served and put them in their next line; null when the finish did not go through, else what to
   say about it. No toast of its own: each caller makes one message. */
async function qFinish(id){
 const e=queue.find(x=>x.id===id);
 if(!e||e.status!=='serving')return null;
 const st=e.station,att=e.attendeeId,who=firstName(qName(att));
 await qMove(id,'done',['serving'],null);
 const d=queue.find(x=>x.id===id);
 if(!d||d.status!=='done')return null;
 const next=nextFlowStation(att,st),skipped=qSkippedBetween(att,st,next);
 let moved=skipped.length?` · ${skipped.map(k=>QUEUE_SHORT[k]).join(', ')} skipped (readings in)`:'',nextId='';
 if(next&&!qActive(att,next)){
  const joined=await queueJoin(att,next,null);
  moved+=joined?` · now in the ${QUEUE_SHORT[next]} line`:` · add them to the ${QUEUE_SHORT[next]} line by hand`;
  if(joined)nextId=(qActive(att,next)||{}).id||'';
 }
 return {st,who,moved,nextId};
}
export async function queueDoneNext(id){
 const r=await qFinish(id);
 if(!r)return;
 const full=qFree(r.st)<=0,c=full?null:await qCall(r.st,true);
 if(c===undefined)return;
 toast(`${r.who} finished ✓${r.moved} · ${c?`Next: ${qName(c.attendeeId)} · ${c.attendeeId}${qAt(c)}`:full?'all places are busy':'nobody else is waiting'}`);
}

/* ---------- the passport and the queue work together ----------
   A. Finish visit: the visitor is going home, so they leave every line they are still in (queueFinishVisit).
   B. The passport's footer has Start and Done for the volunteer's station (queueStripHTML): Start puts the visitor
      with the volunteer (adding them to the line first if they are not in it), Finish finishes the line and moves them to
      the next one. Finish asks first only when the station's readings are missing, and otherwise offers Undo for 6
      seconds. Readings that are all in light the Finish button up; they never finish anything themselves.
   C. The person with you has an Open passport button, and the passport says where the visitor stands (queueLineText).
   The passport never waits for the queue: the queue needs a connection and the passport does not. */
const LEAVE_KEY='newstart.queueLeave';           /* {churchId: [badge, …]}: lines still to leave once the queue can change again */
const qOpenFor=att=>queue.filter(e=>e.attendeeId===att&&(e.status==='waiting'||e.status==='serving'));
function leaveRead(){try{return JSON.parse(localStorage.getItem(LEAVE_KEY)||'{}')||{};}catch(e){return {};}}
function leaveWrite(o){try{if(Object.keys(o).length)localStorage.setItem(LEAVE_KEY,JSON.stringify(o));else localStorage.removeItem(LEAVE_KEY);}catch(e){}}
/* kept per church, because badge numbers repeat across churches; false when the church is not known */
function leaveAdd(att){
 const c=cloud.churchId;if(!c)return false;
 const o=leaveRead(),l=o[c]||(o[c]=[]);
 if(!l.includes(att))l.push(att);
 if(l.length>200)l.splice(0,l.length-200);
 leaveWrite(o);return true;
}
const qLabels=list=>{const n=list.map(e=>QUEUE_SHORT[e.station]||e.station).filter((x,i,a)=>a.indexOf(x)===i);return n.length>1?n.slice(0,-1).join(', ')+' and '+n[n.length-1]+' lines':n[0]+' line';};
/* What to add to the "visit complete" message: '' when they were in no line. */
export async function queueFinishVisit(att){
 const mode=qMode(),open=qOpenFor(att);
 if(mode==='demo'||(mode==='live'&&qCan())){
  if(!open.length)return '';
  for(const e of open)await qMove(e.id,'left',['waiting','serving'],null);
  const gone=open.filter(e=>{const x=queue.find(y=>y.id===e.id);return !x||x.status==='left';});
  const stuck=open.filter(e=>!gone.includes(e));
  if(stuck.length){leaveAdd(att);return gone.length?` · taken out of the ${qLabels(gone)}, the rest will be tried again`:' · the lines could not be updated yet, it will be tried again';}
  qAfter();
  return ` · taken out of the ${qLabels(gone)}`;
 }
 const saved=leaveAdd(att);
 if(!open.length)return '';
 return saved?' · the lines could not be updated (no connection), they will be when you are back online':' · the lines could not be updated (no connection)';
}
let leaving=false;
async function flushLeaves(){
 if(leaving||!qLive()||!qCan()||!cloud.churchId)return;
 const mine=leaveRead()[cloud.churchId];
 if(!mine||!mine.length)return;
 leaving=true;
 try{
  const keep=[];
  for(const att of mine){
   for(const e of qOpenFor(att))await qMove(e.id,'left',['waiting','serving'],null);
   if(qOpenFor(att).length)keep.push(att);
  }
  const o=leaveRead();if(keep.length)o[cloud.churchId]=keep;else delete o[cloud.churchId];leaveWrite(o);
 }finally{leaving=false;}
 qAfter();
}
/* The readings each line needs, in the passport's keys (height is the passport's own field). All of them in lights the Finish
   button up; what is missing is named on the Start/Finish row, on the queue panel and in the Finish question. */
const QUEUE_KEYS={vitals:['weight','height'],bp:['sys','dia'],sugar:['sugar','chol'],veg:['veg'],walk:['walk'],water:['water'],sleep:['sleep']};
const QUEUE_LONG={weight:'weight',height:'height',sys:'the top blood pressure number',dia:'the bottom blood pressure number',sugar:'blood sugar',chol:'cholesterol',veg:'fruit and veg',walk:'exercise',water:'water',sleep:'sleep'};
const QUEUE_BRIEF={weight:'weight',height:'height',sys:'top number',dia:'bottom number',sugar:'blood sugar',chol:'cholesterol',veg:'fruit and veg',walk:'exercise',water:'water',sleep:'sleep'};
const qMiss=(a,st)=>(QUEUE_KEYS[st]||[]).filter(k=>k==='height'?a.heightCm==null:a.s[k]==null);
const qReady=(a,st)=>!!QUEUE_KEYS[st]&&!qMiss(a,st).length;
/* "Your station" on the passport (a reading's key) → the queue's station; readings with no station (diet, exercise…) have none */
export const QUEUE_OF_READING={bp:'bp',weight:'vitals',waist:'vitals',sugar:'sugar',chol:'sugar',veg:'veg',walk:'walk',water:'water',sleep:'sleep'};

/* The state of a line's checks on a passport: na (the line has no checks), filled, empty or partial (not filled in), or
   skipped: not filled in, and confirmed as such on the Check page, either by Done anyway or by confirming the results.
   Skipped is kept on the passport (interests.skip<line>, a plain true), so every desk reads the same state. */
export function qCheckState(a,st){
 const keys=QUEUE_KEYS[st];
 if(!a||!keys)return {state:'na',missing:[]};
 const missing=qMiss(a,st);
 if(!missing.length)return {state:'filled',missing};
 if(a.interests&&a.interests['skip'+st])return {state:'skipped',missing};
 return {state:missing.length===keys.length?'empty':'partial',missing};
}
export function qCheckLine(a,st){
 const c=qCheckState(a,st);
 return c.state==='na'?'':c.state==='filled'?'readings in ✓':c.state==='skipped'?'not filled in · confirmed':'not filled in: '+c.missing.map(k=>QUEUE_BRIEF[k]).join(', ');
}
const qChkSpan=(a,st,cls,hideEmpty)=>{
 const c=qCheckState(a,st);
 if(c.state==='na'||(hideEmpty&&c.state==='empty'))return '';
 return `<span class="${cls} ${cls==='q-chk'?'q-chk':'jr-q-chk'}-${c.state}">${esc(qCheckLine(a,st))}</span>`;
};
function qSkip(a,st){
 if(!a||a.interests&&a.interests['skip'+st])return false;
 a.interests=a.interests||{};a.interests['skip'+st]=true;persist();return true;
}
function qUnskip(a,st){if(a&&a.interests&&a.interests['skip'+st]){delete a.interests['skip'+st];persist();}}
/* confirming the results on the Check page confirms every check still not filled in as skipped; returns how many lines */
export function queueConfirmGaps(a){
 let n=0;
 for(const st of Object.keys(QUEUE_KEYS)){
  const c=qCheckState(a,st);
  if(c.state==='empty'||c.state==='partial'){qSkip(a,st);n++;}
 }
 return n;
}

/* Start: the visitor is now with this volunteer. Not in the line yet (a walk-up): they are added, then started. Undo for 6
   seconds: back in line (same place), or out of the line again for a walk-up. */
export async function queueStart(att,st){
 if(!qGate())return;
 let e=qActive(att,st),added=false;
 if(!e){if(!await queueJoin(att,st,null))return;e=qActive(att,st);added=true;}
 if(!e||e.status!=='waiting')return;
 await qMove(e.id,'serving',['waiting'],null);
 const d=queue.find(x=>x.id===e.id);
 if(!d||d.status!=='serving')return;
 toastUndo(`${firstName(qName(att))}: ${QUEUE_SHORT[st]} started`,()=>{queueUndoStart(e.id,added);});
 qAfter();
}
async function queueUndoStart(id,added){
 if(!qGate())return;
 if(added)await qMove(id,'left',['serving'],x=>`${firstName(qName(x.attendeeId))}: start cancelled`);
 else await qMove(id,'waiting',['serving'],x=>`${firstName(qName(x.attendeeId))} is back in line (same place)`);
}
/* Finish at this station and move on to the next line. With readings missing it asks first, and a yes records those checks as
   skipped on the passport; otherwise it just does it. Either way Undo for 6 seconds (a finished entry cannot be reopened from
   the queue screen), which also takes back the skipped mark. */
export async function queueFinishHere(att,st){
 if(!qGate())return;
 const e=queue.find(x=>x.attendeeId===att&&x.station===st&&x.status==='serving');
 if(!e)return;
 const a=attendees.find(x=>x.id===att),miss=a?qMiss(a,st).map(k=>QUEUE_LONG[k]):[];
 let skipped=false;
 if(miss.length){
  const yes=await confirmAsk({title:`Done at ${QUEUE_SHORT[st]}?`,
   body:`${miss.join(' and ')} ${miss.length>1?'are':'is'} not recorded yet. Mark ${firstName(qName(att))} done here anyway?`,label:'Done anyway',cancelLabel:'Keep going'});
  if(!yes)return;
  skipped=qSkip(a,st);
 }
 const r=await qFinish(e.id);
 if(!r){if(skipped)qUnskip(a,st);qAfter();return;}
 toastUndo(`${r.who}: ${QUEUE_SHORT[st]} done ✓${r.moved}`,()=>{if(skipped)qUnskip(a,st);queueUndoFinish(e.id,r.nextId);});
 qAfter();
}
/* back with the volunteer; the line they were put in next is left again, unless they have already been called there */
async function queueUndoFinish(id,nextId){
 if(!qGate())return;
 await qMove(id,'serving',['done'],x=>`${firstName(qName(x.attendeeId))} is back with you at ${QUEUE_SHORT[x.station]}`);
 const n=nextId&&queue.find(x=>x.id===nextId);
 if(n&&n.status==='waiting')await qMove(nextId,'left',['waiting'],null);
}
/* The footer's "Next in line" for a volunteer who works one station: calls whoever has waited longest at that line and opens
   their passport (called = started). Nobody waiting, or no connection: it opens the registration form, as the button always
   did, so a desk can still add a visitor. */
export async function queueNextInLine(st){
 if(!qCan()||!qList(st,'waiting').length){
  if(qCan())toast(`Nobody is waiting at ${QUEUE_SHORT[st]||st}`);
  registerNew();return;
 }
 const e=await qCall(st,false);
 if(e)switchTo(e.attendeeId);
}
/* An abrupt stop, with the visitor here: Put back in line (they will return, same place, readings kept), or They left (out
   of every line; the visit is not marked complete). The second can be taken back for 6 seconds. */
export async function queueCancelHere(att,st){
 if(!qGate())return;
 const e=queue.find(x=>x.attendeeId===att&&x.station===st&&x.status==='serving');
 if(!e)return;
 const who=firstName(qName(att));
 const r=await confirmAsk({title:`Stop at ${QUEUE_SHORT[st]}?`,
  body:`${who} has stopped part-way. Put them back in the line, keeping their place, or take them out of every line because they left?`,
  label:'Put back in line',alt:'They left',cancelLabel:'Keep going'});
 if(r==='alt'){
  const open=qOpenFor(att).map(x=>({id:x.id,status:x.status,station:x.station}));
  for(const o of open)await qMove(o.id,'left',['waiting','serving'],null);
  const gone=open.filter(o=>{const x=queue.find(y=>y.id===o.id);return x&&x.status==='left';});
  if(gone.length)toastUndo(`${who} left · taken out of the ${qLabels(gone)}`,()=>{queueRestore(gone);});
  qAfter();
 }else if(r)await queueBack(e.id);
}
async function queueRestore(list){
 if(!qGate())return;
 for(const o of list)await qMove(o.id,o.status==='serving'?'serving':'waiting',['left'],null);
 toast('Back in the lines');
}
/* the Start / Finish rows in the passport's footer. scope: a station key for a volunteer who works one station, '' for a
   volunteer doing every check (then every line the visitor is in), null when the station has no queue line (no strip). */
let stripScope='';
export function queueStripHTML(a,scope){
 stripScope=scope;
 const mode=qMode();
 if(!a||scope===null||!(mode==='demo'||mode==='live'))return '';
 const dis=qCan()&&!qs.busy?'':' disabled';   /* not while a queue change is still saving (Q6) */
 const lines=scope?[scope]:qOpenFor(a.id).map(e=>e.station).filter((x,i,l)=>l.indexOf(x)===i);
 return lines.map(st=>{
  const label=esc(QUEUE_SHORT[st]||st),e=qActive(a.id,st),arg=`${esc(a.id)}|${st}`,chk=qChkSpan(a,st,'jr-q-chk');
  if(e&&e.status==='serving'){
   const ready=qReady(a,st);
   return `<div class="jr-q-row"><div class="jr-q-t"><b>Being served at ${label}${esc(qAt(e))}</b>${chk}</div><div class="jr-q-act"><button class="btn btn-primary jr-q-go${ready?' is-ready':''}" data-action="queueFinishHere" data-args="${esc(arg)}"${dis}>Done at ${label} ✓</button><button class="jr-q-cancel" data-action="queueCancelHere" data-args="${esc(arg)}"${dis}>Cancel</button></div></div>`;
  }
  if(e){
   const w=qList(st,'waiting');
   return `<div class="jr-q-row"><div class="jr-q-t"><b>In line at ${label} · ${w.findIndex(x=>x.id===e.id)+1} of ${w.length}</b>${chk}</div><div class="jr-q-act"><button class="btn btn-primary jr-q-go" data-action="queueStart" data-args="${esc(arg)}"${dis}>Start at ${label}</button></div></div>`;
  }
  const was=queue.some(x=>x.attendeeId===a.id&&x.station===st&&x.status==='done');
  return `<div class="jr-q-row"><div class="jr-q-t"><b>${was?`Done at ${label} ✓`:`Not in the ${label} line`}</b>${chk}</div><div class="jr-q-act"><button class="btn ${was?'btn-soft':'btn-primary'} jr-q-go" data-action="queueStart" data-args="${esc(arg)}"${dis}>${was?'Start again':`Start at ${label}`}</button></div></div>`;
 }).join('');
}
/* called on every reading change, and by qAfter when a line moves: redraws the rows only when they would read differently */
export function queueStripRefresh(){
 const el=$('#jrQ');
 if(!el)return;
 const a=attendees.find(x=>x.id===state.activeId),html=a?queueStripHTML(a,stripScope):'';
 if(el._q===html)return;
 el._q=html;el.innerHTML=html;
}
/* where the visitor stands, for the passport's header ('' when in no line or the queue cannot be read) */
export function queueLineText(att){
 if(!att||!qCan())return '';
 return qOpenFor(att).map(e=>{
  const label=QUEUE_SHORT[e.station]||e.station;
  if(e.status==='serving')return `Being served at ${label}${qAt(e)}`;
  const w=qList(e.station,'waiting');
  return `In line at ${label} · ${w.findIndex(x=>x.id===e.id)+1} of ${w.length}`;
 }).join(' · ');
}
function qChip(){
 const el=$('#jrLine');
 if(!el)return;
 const t=queueLineText(state.activeId);
 el.textContent=t;el.hidden=!t;
}
/* Skip lines whose readings are in (on unless turned off on the Queue tab): after Done the visitor is not sent to a
   line whose checks were already typed, e.g. on the one-at-a-time screen. Kept on this device. */
const QSF_KEY = 'newstart.qSkipFilled';
const qSkipFilled = () => {
 try {
  return localStorage.getItem(QSF_KEY) !== '0';
 } catch {
  return true;
 }
};
const qFilledAt = (att, k) => {
 let a = attendees.find(x => x.id === att);
 return !!a && qCheckState(a, k).state === 'filled';
};
export function qSkipFilledToggle() {
 let on = !qSkipFilled();
 try {
  localStorage.setItem(QSF_KEY, on ? '1' : '0');
 } catch {}
 toast(
  on ? 'After Done, lines whose readings are already in are skipped' : 'After Done, visitors go to every next line, as before'
 );
 qAfter();
}
function qSkippedBetween(att, from, next) {
 let i = QUEUE_FLOW.indexOf(from);
 let j = next ? QUEUE_FLOW.indexOf(next) : QUEUE_FLOW.length;
 if (i < 0 || !qSkipFilled()) {
  return [];
 }
 return QUEUE_FLOW.slice(i + 1, j).filter(
  k => !queue.some(e => e.attendeeId === att && e.station === k && e.status === 'done') && qFilledAt(att, k)
 );
}
/* the next station on QUEUE_FLOW after `from` that this visitor has not finished today, and whose readings are not
   all in when skipping is on ('' when there is none) */
export function nextFlowStation(att,from){
 const i=QUEUE_FLOW.indexOf(from);
 if(i<0)return '';
 return QUEUE_FLOW.slice(i+1).find(k=>!queue.some(e=>e.attendeeId===att&&e.station===k&&e.status==='done')&&!(qSkipFilled()&&qFilledAt(att,k)))||'';
}
async function queueFlowNext(att,from){
 const next=nextFlowStation(att,from);
 if(!next||qActive(att,next))return;
 await queueJoin(att,next,n=>`${firstName(qName(att))} finished ✓ · now in the ${QUEUE_SHORT[next]} line${n>1?` (${n} waiting)`:''}`);
}
/* a newly registered visitor goes straight into the first line — when the queue can take changes; offline the
   registration still stands and they can be added by hand once the desk is back online */
export async function queueFlowStart(att,said){
 if(!qCan()||qActive(att))return;
 await queueJoin(att,QUEUE_FLOW[0],n=>`${said} · in the ${QUEUE_SHORT[QUEUE_FLOW[0]]} line${n>1?` (${n} waiting)`:''}`);
}
export const queueBack=id=>qMove(id,'waiting',['serving'],e=>`${firstName(qName(e.attendeeId))} is back in line (same place)`);
export function queueRemove(id){
 if(qs.confirm!==id){qs.confirm=id;clearTimeout(qs.confT);qs.confT=setTimeout(()=>{qs.confirm='';if(state.tab==='queue')renderMain();},3000);renderMain();return;}
 qs.confirm='';
 qMove(id,'left',['waiting','serving'],e=>`${firstName(qName(e.attendeeId))} removed from the line`);
}
/* a visitor removed from the list leaves every line they are still in: queue_entries has no link to the visitor row */
export async function queueLeaveFor(attendeeId){
 const open=queue.filter(e=>e.attendeeId===attendeeId);
 for(const entry of open){
  const isOpen=entry.status==='waiting'||entry.status==='serving';
  if(!isOpen)continue;
  await qMove(entry.id,'left',['waiting','serving'],null);   /* null: no toast per line; the caller says what happened */
 }
}
/* Finished and removed entries are history: they only feed the "Finished" count and the average time per person.
   Clearing takes them out of the queue for good, for every desk; anyone still waiting or being served stays. Live, it
   deletes on the server — including entries older than the hours this screen loads — and the other desks drop them
   through the realtime delete events. */
const qOver=e=>e.status==='done'||e.status==='left';
export const qOverCount=()=>queue.filter(qOver).length;
/* Deleting is for a church admin, as for visitors and volunteers (the database enforces it); the practice queue on
   this device has no database, so anyone may clear it. */
export const qMayClear=()=>qMode()==='demo'||isAdminAcct();
export async function queueClearHistory(){
 if(!qMayClear()){toast('Only a church admin can clear the queue');return;}
 const n=qOverCount();
 if(!n){toast('Nothing to clear');return;}
 if(!qGate())return;
 const yes=await confirmAsk({title:'Clear finished entries?',
  body:`${n} finished or removed ${n===1?'entry goes':'entries go'} from the queue for every desk, for good. Nobody waiting or being served is touched. The average time per person starts again from estimates.`,
  label:'Clear',danger:true});
 if(!yes)return;
 let cleared=0,refused=false;
 await qRun(async()=>{
  if(!qLive()){
   for(let i=queue.length-1;i>=0;i--)if(qOver(queue[i])){queue.splice(i,1);cleared++;}
  }else{
   const {data,error}=await cloud.client.from('queue_entries').delete().in('status',['done','left']).select('id');
   if(error){if(error.code==='42501')toast('This sign-in is not allowed to clear the queue');else qFail(error);return;}
   const gone=new Set(data.map(r=>qSafe(r.id)));
   for(let i=queue.length-1;i>=0;i--)if(gone.has(queue[i].id))queue.splice(i,1);
   cleared=data.length;
  }
  if(cleared)toast(`${cleared} finished ${cleared===1?'entry':'entries'} cleared`);
  else refused=true;
 });
 /* the database deletes nothing for someone who is not a church admin, and says nothing about it: read the line
    again to tell "another desk already cleared them" from "not allowed" */
 if(refused){await queueSync(true);toast(qOverCount()?'Nothing was cleared — only a church admin can clear the queue':'Nothing to clear');}
 qAfter();
}
/* Tapping a station card opens its panel — who is being served and who is waiting, by name — which sits under the
   board, below the fold on a phone. So the tap also brings that panel into view, unless it is already on screen. */
export function qSelect(k){
 state.qStation=k;qs.confirm='';renderMain();
 const d=$('#qDetail');
 if(!d||typeof d.getBoundingClientRect!=='function'||typeof d.scrollIntoView!=='function')return;
 const r=d.getBoundingClientRect(),vh=window.innerHeight||0;
 if(r.top>=0&&r.top<vh*0.6)return;                                  /* the panel's heading is already in view */
 d.scrollIntoView({block:'start'});    /* an instant jump: a smooth scroll was seen not to move at all in a browser */
}

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
  qs.ready=true;qs.err='';clearTimeout(qs.retryT);qs.retryT=null;   /* a retry that is still due is not wanted now (Q6) */
  startQueueRealtime();healthLive('queue',qs.rt);
  setTimeout(flushLeaves,0);                 /* visits finished while the queue could not change: leave their lines now */
 }catch(err){
  console.warn('queue sync:',err);
  const msg=String((err&&err.message)||err||'');
  if(err&&(err.code==='PGRST205'||err.code==='PGRST202'||err.code==='42P01'||err.code==='42883'||/schema cache|could not find the (table|function)/i.test(msg)))
   {qs.ready=false;qs.err='The live queue isn’t switched on for your church yet. Ask your church admin to contact the app’s support.';clearTimeout(qs.retryT);qs.retryT=null;}
  else if(!navigator.onLine||/failed to fetch|networkerror|load failed|network request/i.test(msg)){if(!qs.ready){qs.err='Could not reach the server yet — retrying.';clearTimeout(qs.retryT);qs.retryT=setTimeout(queueSync,15000);}}   /* a failed first load retries by itself (Q6) */
  else if(err&&(err.code==='42501'||/row-level security|permission denied/i.test(msg)))
   {qs.ready=false;qs.err='This sign-in is not approved for the queue.';clearTimeout(qs.retryT);qs.retryT=null;}
  else if(!qs.ready){qs.err='The queue could not load.';clearTimeout(qs.retryT);qs.retryT=setTimeout(queueSync,15000);}   /* a failed first load retries by itself (Q6) */
  healthFromError('queue',err,isMissingErr(err)?(missingName(err)||'queue_entries'):'');
 }finally{qs.syncing=false;qAfter();}
}
function startQueueRealtime(){
 if(qs.ch&&qs.church===cloud.churchId)return;
 if(!cloud.client)return;
 if(qs.ch){try{cloud.client.removeChannel(qs.ch);}catch(e){}qs.ch=null;}
 const ch=cloud.client.channel('newstart-queue');
 /* inserts and updates filtered to this church on the server, deletes unfiltered (see startRealtime in account.js) */
 const mine=cloud.churchId?{filter:'church_id=eq.'+cloud.churchId}:{};
 const onQ=p=>{
  if(p.eventType==='DELETE'){
   /* A delete event carries only the row's id (the table does not keep full old rows), so the church cannot be checked
      from it. Queue row ids are UUIDs, unique across churches, and this list holds only this church's rows: a delete is
      matched by id, so a line changed on another desk does not stay on screen until the next manual sync. */
   const id=qSafe(p.old&&p.old.id),i=queue.findIndex(e=>e.id===id);if(i>=0)queue.splice(i,1);}
  else if(p.new&&p.new.id)qApply(p.new);
  else return;
  qRefresh();
 };
 ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'queue_entries',...mine},onQ)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'queue_entries',...mine},onQ)
   .on('postgres_changes',{event:'DELETE',schema:'public',table:'queue_entries'},onQ);
 ch.subscribe(st=>{
  qs.rt=st;healthLive('queue',st);
  if(st==='SUBSCRIBED'){if(qs.subbed)queueSync();qs.subbed=true;}    /* reconnected: fetch whatever was missed */
  qRefresh();
 });
 qs.ch=ch;qs.church=cloud.churchId;
}
/* out of sight: drop the channel but keep the lines on the device (pauseRealtime in account.js); qs.subbed stays
   set, so the channel that reopens on return re-reads whatever changed meanwhile */
export function queuePause(){
 if(qs.ch&&cloud.client){try{cloud.client.removeChannel(qs.ch);}catch(e){}}
 qs.ch=null;qs.rt='';
}
/* Practice mode opens with three demo visitors already in line, so the Queue tab and the tour have something to show. */
export function seedDemoQueue() {
 if (cloud.user || cloud.mode || queue.length || qDemoLoad()) {
  return;
 }
 const t = Date.now();
 /** @type {[string, string, number][]} id, station, minutes already waiting */
 const seed = [
  ['EXPO-088', 'vitals', 9],
  ['EXPO-117', 'vitals', 4],
  ['EXPO-042', 'bp', 6]
 ];
 for (const [a, station, m] of seed) {
  if (!attendees.some(x => x.id === a)) continue;
  queue.push({ id: `L${qs.seq++}`, attendeeId: a, station, status: 'waiting', joinedAt: t - m * 60000, calledAt: 0, finishedAt: 0 });
 }
}
export function queueReset(){
 if(qs.ch&&cloud.client){try{cloud.client.removeChannel(qs.ch);}catch(e){}}
 qs.ch=null;qs.rt='';qs.church='';qs.subbed=false;qs.ready=false;qs.err='';qs.retryT=null;qs.since='';qs.skew=0;qs.confirm='';
 queue.length=0;
}
function qRefresh(){clearTimeout(qs.renderT);qs.renderT=setTimeout(qAfter,150);}
export function qAfter(){
 qDemoSave();
 if(qMode()!=='demo')qPruneHistory();
 if(window.NSMem)window.NSMem.bump('queue');
 renderNav();if(state.tab==='queue')renderMain();if(tvOpen())renderBigScreen();qChip();queueStripRefresh();}

/* ---------- adding a visitor to a line ---------- */
export function openQueuePick(st){
 if(!qGate())return;
 qs.pick=st;qs.pickQ='';
 $('#queueHead').innerHTML=`<h3 class="display text-base font-extrabold">Add to ${esc(QUEUE_SHORT[st]||(BOOTH(st)||{}).label||st)}</h3>
  <input id="qq" type="search" placeholder="Search by name, badge or phone" data-on-input="queue-filter" class="field mt-2.5" autocomplete="off">`;
 qRenderPick();showModal('#queueModal',closeQueuePick);
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
  return `<button class="q-pick" ${here?'disabled':`data-action="qPickAdd" data-args="${esc(a.id)}"`}>
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
 if(mode==='error')return /Could not reach the server/.test(qs.err)?['warn',esc(qs.err),'Queue not available']:['bad',esc(qs.err),'Queue not available'];   /* retrying through a bad connection is a warning, not a fault (Q6) */
 if(mode==='offline')return ['warn','No connection. The queue needs one so every desk sees the same line.','No connection — numbers may be out of date'];
 return ['info','Practice mode — nothing is sent to the shared database. Demo data stays on this phone until you reset it.','Practice mode'];
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
   <div class="q-tv-checks">${esc(qChecksText(key))}</div>
   <div class="q-tv-lab">Now serving${s.cap>1?` · ${s.serving.filter(e=>e.slot).length} of ${s.cap}`:''}</div>
   ${s.cap>1?qTvSlots(key,s):now.length?`<div class="q-tv-now">${now.map(e=>esc(e.attendeeId.replace(/^EXPO-/,''))).join(' · ')}${more>0?`<small>+${more}</small>`:''}</div>`:'<div class="q-tv-none">—</div>'}
   <div class="q-tv-lab">Next</div>
   ${nxt.length?`<div class="q-tv-next">${nxt.map(e=>`<span>${esc(e.attendeeId.replace(/^EXPO-/,''))}</span>`).join('')}${rest>0?`<span>+${rest}</span>`:''}</div>`:'<div class="q-tv-none">Nobody waiting</div>'}
   <div class="q-tv-meta">${s.wait.length?`${s.wait.length} waiting${s.eta!=null?` · about ${Math.max(1,Math.round(s.eta/60000))} min`:''}`:'No wait — walk right in'}</div>
  </div>`;}).join('');
}
export function openBigScreen(){
 const tv=$('#tv');tv.classList.remove('hidden');renderBigScreen();
 overlayOpened('#tv',closeBigScreen);
 try{const p=tv.requestFullscreen&&tv.requestFullscreen();if(p&&p.catch)p.catch(()=>{});}catch(e){}
 qWake();
}
export function closeBigScreen(){
 $('#tv').classList.add('hidden');
 try{if(document.fullscreenElement){const p=document.exitFullscreen();if(p&&p.catch)p.catch(()=>{});}}catch(e){}
 if(qs.wake){try{qs.wake.release();}catch(e){}qs.wake=null;}
 overlayClosed('#tv');
}
/* keep a TV from going to sleep */
async function qWake(){try{if(navigator.wakeLock&&tvOpen()&&!qs.wake){qs.wake=await navigator.wakeLock.request('screen');qs.wake.addEventListener('release',()=>{qs.wake=null;});}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&tvOpen())qWake();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tvOpen())closeBigScreen();});
function qCard(k,st,sel){
 if(st.tone==='loading'||qMode()==='loading')return `<button data-action="qSelect" data-args="${esc(k)}" class="q-card q-card-${st.tone} ${sel?'q-card-sel':''}" aria-pressed="${sel}">
  <span class="q-card-top"><span class="q-card-name">${esc(QUEUE_SHORT[k])}</span><span class="q-card-dot"></span></span>
  <span class="q-card-line q-card-checks">${esc(qChecksText(k))}</span>
  <span class="q-card-n">—<small>waiting</small></span>
  <span class="q-card-line">Loading the line…</span></button>`;   /* no zeros that look like facts before the first read (Q5) */
 const first=st.serving[0],more=st.serving.length-1;
 const serve=st.cap>1&&first?`Serving <b>${st.serving.length} of ${st.cap}</b>`
  :st.cap>1?(st.wait.length?`<b>Not called yet</b> · ${st.cap} places`:`Free — ${st.cap} places`)
  :first?`Serving <b>${esc(first.attendeeId)}</b>${more>0?` +${more}`:''}`:(st.wait.length?'<b>Not called yet</b>':'Free — nobody here');
 const eta=st.wait.length?(st.eta!=null?`About <b>${Math.max(1,Math.round(st.eta/60000))} min</b> · longest ${qMin(st.longest)}`:`Longest wait <b>${qMin(st.longest)}</b>`):'No wait';
 return `<button data-action="qSelect" data-args="${esc(k)}" class="q-card q-card-${st.tone} ${sel?'q-card-sel':''}" aria-pressed="${sel}">
  <span class="q-card-top"><span class="q-card-name">${esc(QUEUE_SHORT[k])}</span><span class="q-card-dot"></span></span>
  <span class="q-card-line q-card-checks">${esc(qChecksText(k))}</span>
  <span class="q-card-n">${st.wait.length}<small>waiting</small></span>
  <span class="q-card-line">${serve}</span><span class="q-card-line">${eta}</span></button>`;
}
function qRow(e,i,st){
 const now=qNow(),name=qName(e.attendeeId),av=`<span class="flex h-9 w-9 flex-none items-center justify-center rounded-[13px] text-[11px] font-extrabold tint hue-${hueOf(e.attendeeId)}">${esc(initials(name))}</span>`;
 const sure=qs.confirm===e.id,x=lab=>`<button class="q-mini q-mini-x ${sure?'q-sure':''}" data-action="queueRemove" data-args="${esc(e.id)}" aria-label="Remove ${esc(name)} from the line">${sure?'Remove?':lab}</button>`;
 /* the person with you: one big button does the desk's whole turn; putting back and removing are the rare ones, small underneath */
 if(e.status==='serving'){
  const last=!st.wait.length,cap=qCap(e.station);
  /* with several places: which place, since when, and ⇄ to move them to the next place */
  const tag=cap>1?`<div class="q-slot-tag">${e.slot?esc(qSlotName(e.station,e.slot)):`Extra · over ${cap} places`} · since ${qHM(e.calledAt)}</div>`:'';
  let mv='';
  if(cap>1){
   let t=e.slot?e.slot%cap+1:0;
   if(!e.slot)for(let n=1;n<=cap;n++)if(!qServingAt(e.station,n)){t=n;break;}
   if(t)mv=`<button class="q-mini q-mini-soft q-ms" data-action="qSlotMove" data-args="${esc(e.id)}" aria-label="Move ${esc(name)} to ${esc(qSlotName(e.station,t))}">⇄ ${esc(qSlotName(e.station,t))}</button>`;
  }
  return `<div class="q-row q-row-serving q-now" data-slot="${e.slot|0}">${tag}<div class="q-now-who">${av}<div class="q-who"><b>${esc(name)}</b><span class="mono">${esc(e.attendeeId)} · with you for ${qMin(now-e.calledAt)}</span>${qChkSpan(attendees.find(x=>x.id===e.attendeeId),e.station,'q-chk')}</div></div>
   <button class="btn btn-primary q-big" data-action="${last?'queueDone':'queueDoneNext'}" data-args="${esc(e.id)}"${qs.busy?' disabled':''}>${last?'Done ✓':'Done · call next →'}</button>
   <div class="q-sub">${attendees.some(a=>a.id===e.attendeeId)?`<button class="q-mini q-mini-soft" data-action="switchTo" data-args="${esc(e.attendeeId)}">Open passport</button>`:''}${mv}<button class="q-mini q-mini-soft" data-action="queueBack" data-args="${esc(e.id)}" aria-label="Put ${esc(name)} back in line">↩ Put back</button>${x('✕ Remove')}</div></div>`;
 }
 const w=now-e.joinedAt,cls=w/60000>=QUEUE_ALERT?'q-late':w/60000>=QUEUE_WARN?'q-slow':'';
 return `<div class="q-row"><span class="q-pos">${i+1}</span><div class="q-who"><b>${esc(name)}</b>
   <span class="mono ${cls}">${esc(e.attendeeId)} · waiting ${qMin(w)}</span>${qChkSpan(attendees.find(x=>x.id===e.attendeeId),e.station,'q-chk',true)}</div>
   <div class="q-btns"><button class="q-mini q-mini-soft" data-action="queueServe" data-args="${esc(e.id)}">Call</button>${x('✕')}</div></div>`;
}
function qDetail(k,st,can){
 const dis=can&&!qs.busy?'':' disabled',m=Math.max(1,Math.round(st.avg/60000));
 let gaps=0,conf=0;
 for(const x of queue)if(x.station===k&&x.status==='done'){const c=qCheckState(attendees.find(y=>y.id===x.attendeeId),k).state;if(c==='skipped'){gaps++;conf++;}else if(c==='empty'||c==='partial')gaps++;}
 const gapNote=gaps?` ${gaps} of them with checks not filled in${conf?` (${conf} confirmed)`:''}.`:'';
 const note=(st.real?`Average ${m} min per person (last ${st.samples} finished). ${st.done} finished today.`
  :`No average yet: it shows once 3 visits have finished here. ${st.done} finished today.`)+gapNote;
 return `<div id="qDetail" class="glass p-4" style="scroll-margin-top:84px">
  <div class="q-head"><div><div class="microlabel">Station</div><div class="display text-base font-extrabold">${esc(QUEUE_SHORT[k]||(BOOTH(k)||{}).label||k)}</div>
    <p class="q-note q-checks">${QUEUE_CHECKS[k]?(QUEUE_CHECKS[k].length>1?'Checks: ':'Check: '):''}${esc(qChecksText(k))}</p></div>
   <button class="btn btn-soft q-tvbtn" data-action="openQueuePick" data-args="${esc(k)}"${dis}>+ Add visitor</button></div>
  ${qServeBlock(k,st,can)}
  <div class="q-label">Next up · ${st.wait.length}</div>
  ${qMode()==='loading'?'<div class="q-empty">Loading the line…</div>':st.wait.length?st.wait.map((e,i)=>qRow(e,i,st)).join(''):'<div class="q-empty">Nobody waiting — nice and quiet ✓</div>'}
  <p class="q-note">${note}</p>
 </div>`;
}
export function viewQueue(){
 const mode=qMode(),can=qCan(),loading=mode==='loading';
 const sel=QUEUE_STATIONS.includes(state.qStation)?state.qStation:QUEUE_STATIONS[0];
 const S={};QUEUE_STATIONS.forEach(k=>S[k]=qStats(k));
 const tot=QUEUE_STATIONS.reduce((t,k)=>({w:t.w+S[k].wait.length,s:t.s+S[k].serving.length,d:t.d+S[k].done,l:Math.max(t.l,S[k].longest)}),{w:0,s:0,d:0,l:0});
 const tile=(n,l)=>`<div class="q-total"><b>${n}</b><span>${l}</span></div>`;
 const over=qOverCount();
 return `<section class="space-y-3.5">
  <div class="glass p-4">
   <div class="q-head"><div><div class="microlabel">Live queue</div>
    <div class="display text-base font-extrabold">Who is waiting where</div></div>
    <button class="btn btn-soft q-tvbtn" data-action="openBigScreen">Big screen</button></div>
   ${qStateBar(mode)}
   <div class="q-totals">${tile(loading?'—':tot.w,'Waiting')}${tile(loading?'—':tot.s,'Being served')}${tile(loading?'—':tot.d,'Finished')}${tile(loading?'—':(tot.w?qMin(tot.l).replace(' min','m'):'—'),'Longest wait')}</div>
   ${!loading&&over&&qMayClear()?`<button class="btn btn-soft q-clear" data-action="queueClearHistory"${can?'':' disabled'}>Clear finished &amp; removed · ${over}</button>`:''}
  </div>
  <div class="q-board">${QUEUE_STATIONS.map(k=>qCard(k,S[k],k===sel)).join('')}</div>
  ${qDetail(sel,S[sel],can)}
 </section>`;
}
/* the "waiting 7 min" figures tick up. Without live updates (refused past the Free plan's 200 connections, or
   dropped) the same tick re-reads the lines instead, so a queue screen is never more than 20 s behind. The timer is
   registered with the memory layer (nsmem.js), which pauses page timers while the app is hidden. */
(window.NSMem?window.NSMem.every.bind(null,'page'):setInterval)(()=>{
 if(!(state.tab==='queue'||tvOpen())||document.hidden)return;
 if(qs.ready&&qs.rt!=='SUBSCRIBED')queueSync();else qAfter();
},20000);
