// @ts-check
import { IS_APP } from './platform.js';
import { BADGE_TIERS, EXPO_TOTAL, STATUS_UI } from './data.js';
import { $, FOOD_PRICES } from './helpers.js';
import { AVAIL, BOOTH, BOOTHS, DISCLAIMER, EXPO_UPCOMING, PRECAUTIONS, SKILLS, attendees, boothHue, boothLabel, hueOf, state, volunteers } from './data.js';
import { A, PRICE_DATE, bmi, esc, firstName, fmt1, healthAge, initials, money, pefPct, projection, simBP } from './helpers.js';
import { render, toast, toastUndo } from './shell.js';
import { LIST_CAP, switchTab, visitorsToShow } from './visitor.js';
import { migrateVolunteer, persist, cloud } from './state.js';
import { isOfflineErr, validEmail } from './cloud.js';
import { overlayClosed, overlayOpened } from './overlay.js';
/* a lazy cycle: account.js imports this module's modal helpers; the sync call happens only at runtime */
import { cloudSync } from './account.js';
import { downloadCSV, foodKeyOf, planFor, shortFood } from './results.js';
import { GRACE_DAYS, withoutOldReadings } from './retention.js';
/* Volunteers: pledge, register, booth picker, serve, modals, WhatsApp/email share and the print card. Split from the original single-file app; bundled back into one file by tools/build.js. */
/* =====================================================================
   VOLUNTEER / SERVE  —  pledge → register → booth → serve → record
   ---------------------------------------------------------------------
   Everything lives in this device's localStorage alongside the visitor
   data. All volunteer-supplied strings go through esc() before they are
   interpolated, because profiles are re-rendered into HTML on every tap.
   ===================================================================== */

/* ---------- derived volunteer values ---------- */
/* AV() is the "who am I editing" pointer. volNew means we are composing a
   brand-new pledge, so AV() must NOT fall back to volunteers[0] — otherwise
   saving would overwrite the first person on the roster. */
export const AV=()=>state.volNew?null:(volunteers.find(v=>v.id===state.volId)||volunteers[0]||null);
export const volHours=v=>(v.history||[]).reduce((t,h)=>t+(Number(h.hours)||0),0);
export const volExpos=v=>(v.history||[]).length;
/* The level counts expos served, one level per expo, and stops at the end of the
   programme (EXPO_TOTAL). A volunteer with 0 expos has no level — 0 must never
   display as one, and must never borrow a service rank either. */
export const VOL_LEVEL_MAX=EXPO_TOTAL;
export const volLevel=v=>{const e=volExpos(v);return e>0?Math.min(e,VOL_LEVEL_MAX):0;};
export const volYears=v=>v.since?Math.max(0,new Date().getFullYear()-Number(String(v.since).slice(0,4))):0;
export const needsRegistration=v=>v.status==='prospect';
const checkedInToday=v=>v.status==='checkedin'||v.checkedIn===true;
export const helpersAt=k=>volunteers.filter(v=>v.booth===k&&!needsRegistration(v));
const boothNeeds=k=>{const b=BOOTH(k);return b?b.cap:0;};

/* Highest tier whose expos AND hours minimums are both met. */
export function badgeTier(v){
 let cur=BADGE_TIERS[0];
 const e=volExpos(v),h=volHours(v);
 for(const t of BADGE_TIERS){if(e>=t.minExpos&&h>=t.minHours)cur=t;}
 return cur;
}
export function nextTier(v){
 const n=badgeTier(v).n;
 return n>=BADGE_TIERS.length-1?null:BADGE_TIERS[n+1];
}
/* Progress toward the next badge. Both minimums must be met, so the headline
   figure is the weaker of the two and blockedBy names what is holding it back. */
export function tierProgress(v){
 const nx=nextTier(v); if(!nx)return {pct:100,expoPct:100,hourPct:100,needExpos:0,needHours:0,blockedBy:null};
 const e=volExpos(v),h=volHours(v);
 const expoPct=Math.min(1,e/nx.minExpos),hourPct=Math.min(1,h/nx.minHours);
 return {pct:Math.round(Math.min(expoPct,hourPct)*100),expoPct,hourPct,
   needExpos:Math.max(0,nx.minExpos-e),needHours:Math.max(0,Math.round((nx.minHours-h)*10)/10),
   blockedBy:expoPct<hourPct?'expos':hourPct<expoPct?'hours':null};
}
/* Human sentence for what still stands between a volunteer and the next badge. */
export function tierRemaining(v){
 const p=tierProgress(v),nx=nextTier(v);
 if(!nx)return '';
 const bits=[];
 if(p.needExpos)bits.push(`${p.needExpos} more expo${p.needExpos>1?'s':''}`);
 if(p.needHours)bits.push(`${fmt1(p.needHours)} more hour${p.needHours===1?'':'s'}`);
 return bits.length?`${bits.join(' + ')} for ${nx.short}`:'Next badge unlocked';
}
function starGlyph(n,size){
 if(!n)return '';
 const s='<svg viewBox="0 0 24 24" style="width:'+size+';height:'+size+'" fill="currentColor"><path d="M12 2.6l2.95 5.98 6.6.96-4.77 4.65 1.12 6.57L12 17.66l-5.9 3.1 1.12-6.57L2.45 9.54l6.6-.96L12 2.6z"/></svg>';
 return `<span class="stars">${s.repeat(n)}</span>`;
}
/* The medal is the visual badge: tier colour + the volunteer's level (expos served,
   1–EXPO_TOTAL) + the medal rank and its stars. With no expos there is no number to show —
   the circle reads – and the rank alone is shown, never "Lv 0". */
export function medalHTML(v,small){
 const t=badgeTier(v),lv=volLevel(v);
 if(small)return `<span class="medal medal-sm hue-${t.hue}" title="${esc(t.name)}"><span class="medal-v"><b class="medal-lv">${lv||'–'}</b></span></span>`;
 return `<span class="medal hue-${t.hue}" role="img" aria-label="${esc(t.name)}">
  <span class="medal-v"><b class="medal-lv">${lv||'–'}</b><span class="medal-rk">${esc(t.short)}</span>${starGlyph(t.stars,'7px')}</span></span>`;
}
const rankPill=v=>{const t=badgeTier(v);return `<span class="rankpill hue-${t.hue}">${esc(t.name)}</span>`};
/* Compact pill: "Lv 4 · Silver" once there is a level, the full status before it.
   The short form ('New') exists for the medal circle; the pill has room for the
   whole word, so a newcomer reads as "Newcomer", never as a truncated rank. */
const lvPill=v=>{const t=badgeTier(v),lv=volLevel(v);return lv?`Lv ${lv} · ${esc(t.short)}`:esc(t.name);};

/* ---------- shared bits ---------- */
/* local calendar date as YYYY-MM-DD (toISOString is UTC, which is yesterday for the first hours of a South African day) */
export const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const fmtDate=s=>{if(!s)return '—';const d=new Date(s);return isNaN(d.getTime())?s:d.toLocaleDateString('en-ZA',{day:'numeric',month:'short'});};
const fmtDateLong=s=>{if(!s)return 'date to be confirmed';const d=new Date(s);return isNaN(d.getTime())?s:d.toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});};
export function daysTo(dateStr){
 const d=new Date(dateStr); if(isNaN(d.getTime()))return null;
 const a=new Date();a.setHours(0,0,0,0);d.setHours(0,0,0,0);
 return Math.round((d.getTime()-a.getTime())/86400000);
}
function expoLine(){
 const n=daysTo(EXPO_UPCOMING.date);
 const when=n==null?'date to be confirmed':(n>1?`in ${n} days`:n===1?'tomorrow':n===0?'today 🎉':`${Math.abs(n)} days ago`);
 return `${fmtDateLong(EXPO_UPCOMING.date)} · ${when}`;
}
export const staffedCount=()=>volunteers.filter(v=>!needsRegistration(v)).length;
export const hiredCountLabel=()=>`${staffedCount()}/${EXPO_UPCOMING.need} helpers`;
export const pendingLabel=()=>{const n=volunteers.filter(needsRegistration).length;return n?` · ${n} awaiting registration`:'';};
function availLabels(v){return (v.availability||[]).map(a=>(AVAIL.find(x=>x[0]===a)||[a,a])[1]);}

/* Every volunteer action can be triggered from outside the Team tab (the Home
   card and its modal), so each one first makes sure the Team tab is showing. */
function gotoServe(){state.tab='serve';}
export const emptyDraft=()=>({name:'',phone:'',email:'',pledgeExpos:1,skills:[],pref:[],avail:[]});
/* leave the pledge form without saving: drop the draft and undo "new volunteer" */
function discardVolDraft(){
 state.volRegOpen=false;state.vf=emptyDraft();
 if(state.volNew){state.volNew=false;state.volId=(volunteers[0]||{}).id||null;}
}
export function closeVolReg(){discardVolDraft();render();}
export function setVolTab(t){gotoServe();if(state.volRegOpen)discardVolDraft();state.volTab=t;render();}
export function setVol(id){gotoServe();state.volId=id;state.volNew=false;state.volRegOpen=false;state.vf=emptyDraft();render();}

/* ---------- the Serve shell ---------- */
export function renderServeView(){
 const st=state.volTab;
 let html;
 if(state.volRegOpen){html=viewVolRegister();}
 else if(st==='muster'){html=viewVolMuster();}
 else if(st==='booth'){html=viewVolBooth();}
 else if(st==='record'){html=viewVolRecord();}
 else{html=viewVolPledge();}
 /* set visibility right before writing: the visitor tab this replaced may have
    left the container hidden, and an inline style is unambiguous here. */
 const el=$('#main');
 el.style.display='';
 el.innerHTML=html;
 /* the same screen drawn again (a pledge pill, a booth, a skill tapped) appears at once: replaying the entrance
    fade on every tap made the form flicker and feel slow */
 const key=[st,!!state.volRegOpen,state.volId].join('|');
 if(key===state._serveKey)el.querySelectorAll(':scope > .stagger').forEach(s=>s.classList.remove('stagger'));
 state._serveKey=key;
 /* no movePill() here: render() has already started the pill's liquid glide, and a second call
    straight after snapped it into place, so only the Team tab lost its flow */
}
function serveTabs(){
 const T=[['pledge','Pledge'],['muster','Muster'],['booth','Booth'],['record','Record']];
 const pending=volunteers.filter(needsRegistration).length,v=AV();
 /* the app does not know who holds the phone: say whose page this is instead of "your" */
 const who=v?`<button class="vw-bar" data-action="openVolSwitcher"><span>Viewing <b>${esc(v.name)}</b> · ${esc(v.id)}</span><span class="vw-sw">Switch</span></button>`:'';
 return who+`<div class="vt-tabs">${T.map(([k,l])=>{
  const act=state.volTab===k&&!state.volRegOpen;
  const badge=k==='muster'&&pending?`<span class="rounded-full bg-white/70 px-1.5 text-[9px] font-extrabold">${pending}</span>`:'';
  return `<button data-action="setVolTab" data-args="${k}" class="${act?'btn btn-primary':'btn btn-glass'} gap-1.5 rounded-full px-2 py-2 text-[12px] ${act?'':'text-[#5b7178]'}" style="white-space:nowrap">${l}${badge}</button>`;
 }).join('')}</div>`;
}

/* ---------- 1. PLEDGE ---------- */
function viewVolPledge(){
 const hired=staffedCount(),need=EXPO_UPCOMING.need,pct=Math.min(100,Math.round(hired/need*100));
 const vacancies=Math.max(0,need-hired);
 const dn=daysTo(EXPO_UPCOMING.date),openNow=dn!=null&&dn>=0&&dn<=14;
 const v=AV();
 return `<section class="stagger space-y-3.5 pb-2">

  <div class="hero p-5">
   <div class="flex items-start justify-between gap-2">
    <div class="microlabel">Incoming expo</div>
    <span class="servechip ${openNow?'sc-ok':'sc-warn'}">${openNow?'Registration open':'Pledges open'}</span>
   </div>
   <div class="display mt-1 text-[19px] leading-tight font-extrabold text-[#0f2a2c]">${esc(EXPO_UPCOMING.name)}</div>
   <div class="mt-1 text-[11px] font-semibold text-[#5c747a]">${esc(EXPO_UPCOMING.venue)}</div>
   <div class="mt-1 mono text-[11px] font-bold text-brand-800">${expoLine()}</div>
   <div class="mt-4 flex items-end justify-between gap-3">
    <div><div class="microlabel">Team pledged</div>
     <div class="display mt-1 text-[32px] leading-none font-extrabold text-[#0f2a2c]">${hired}<span class="text-sm font-bold text-[#667d83]"> / ${need}</span></div></div>
    <div class="text-right text-[10px] font-bold leading-tight text-[#5b7178]">
     ${vacancies?`${vacancies} helper${vacancies>1?'s':''}<br>still needed`:'Fully staffed ✓'}<br>
     <span class="text-[#667d83]">${volunteers.length} total pledges</span></div>
   </div>
   <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#123033]/[.08]"><div class="bar-fill" style="width:${pct}%"></div></div>
  </div>

  ${serveTabs()}

  ${v?`<div class="glass hue-${badgeTier(v).hue} p-3.5">
   <div class="flex items-center gap-3">
    ${medalHTML(v)}
    <div class="min-w-0 flex-1">
     <div class="microlabel">${esc(firstName(AV().name))}’s badge</div>
     <div class="display mt-0.5 truncate text-[15px] font-extrabold text-[#0f2a2c]">${esc(v.name)}</div>
     <div class="mt-1 flex flex-wrap items-center gap-1.5">
      <span class="rankpill hue-${badgeTier(v).hue}">${lvPill(v)}</span>
      <span class="servechip ${STATUS_UI[v.status].cls}">${STATUS_UI[v.status].label}</span>
     </div>
    </div>
   </div>
   ${nextTier(v)?(()=>{const p=tierProgress(v),nx=nextTier(v);return `
   <div class="mt-3">
    <div class="flex items-baseline justify-between text-[10px] font-bold text-[#5b7178]">
     <span>Next badge · <b class="text-[#33504f]">${esc(nx.name)}</b></span><span class="mono">${p.pct}%</span></div>
    <div class="covbar mt-1.5"><i style="width:${p.pct}%"></i></div>
    <div class="mt-1.5 flex justify-between text-[10px] font-semibold text-[#6b8187]">
     <span class="${p.blockedBy==='expos'?'text-[#8a5a12]':''}">${volExpos(v)}/${nx.minExpos} expos</span>
     <span class="${p.blockedBy==='hours'?'text-[#8a5a12]':''}">${fmt1(volHours(v))}/${nx.minHours} hrs</span></div>
    <div class="mt-1.5 text-[10px] font-bold text-[#33504f]">${tierRemaining(v)}</div>
   </div>`;})():`<div class="mt-3 text-[10px] font-bold text-brand-800">Top badge reached — Legend of the expo 🏅</div>`}
   <div class="mt-3 grid grid-cols-3 gap-2">
    <div class="tile"><span class="tile-l">Expos</span><span class="tile-v">${volExpos(v)}</span></div>
    <div class="tile"><span class="tile-l">Hours</span><span class="tile-v">${fmt1(volHours(v))}</span></div>
    <div class="tile"><span class="tile-l">Years</span><span class="tile-v">${volYears(v)}</span></div>
   </div>
   <div class="mt-2.5 flex gap-2">
    <button data-action="switchToVol" class="btn btn-glass flex-1 py-2 text-[11px] text-[#5b7178]">Switch volunteer</button>
    ${needsRegistration(v)?`<button data-action="openVolReg" class="btn btn-primary flex-1 py-2 text-[11px]">Register now →</button>`
      :`<button data-action="logExpoEntry" class="btn btn-soft flex-1 py-2 text-[11px]">+ Log an expo</button>`}
   </div>
  </div>`:''}

  <div class="glass p-4">
   <div class="display text-[14px] font-extrabold text-[#0f2a2c]">How volunteering works</div>
   <div class="mt-2.5 space-y-2.5">
    ${[['1','Pledge now','Tell us you are willing and which booth you would like. Takes 30 seconds, no commitment yet.'],
       ['2','Register closer to the day','Two weeks before the expo we open registration: contact details, emergency contact, shift and final booth.'],
       ['3','Serve and get recorded','Every expo you help at is logged against your name, with your hours.'],
       ['4','Earn your badge','Expos plus hours move you up: Bronze → Silver → Gold → Platinum → Legend.']]
     .map(([n,t,d])=>`<div class="flex gap-2.5">
       <span class="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-extrabold tint hue-peach">${n}</span>
       <div class="min-w-0"><div class="text-[12px] font-bold text-[#33504f]">${t}</div>
        <div class="mt-0.5 text-[11px] leading-relaxed text-[#6b8187]">${d}</div></div></div>`).join('')}
   </div>
  </div>

  <button data-action="setVolTab" data-args="muster" class="btn btn-glass w-full py-2.5 text-[11px] text-[#5b7178]">See who has pledged so far →</button>
 </section>`;
}

/* ---------- 2. MUSTER (roster + coverage) ---------- */
function viewVolMuster(){
 const need=EXPO_UPCOMING.need,hired=staffedCount();
 const rows=BOOTHS.map(b=>({b,team:helpersAt(b.k)})).sort((x,y)=>(y.b.cap?y.team.length/y.b.cap:0)-(x.b.cap?x.team.length/x.b.cap:0));
 const short=rows.filter(r=>r.team.length<r.b.cap).length;
 const upcoming=volunteers.filter(needsRegistration);
 const confirmed=volunteers.filter(v=>!needsRegistration(v)).sort((a,b)=>badgeTier(b).n-badgeTier(a).n||volExpoSort(a,b));
 return `<section class="stagger space-y-3.5 pb-2">
  <div class="flex items-center justify-between gap-2">
   <div><div class="microlabel">Volunteer muster</div>
    <div class="display mt-0.5 text-[17px] font-extrabold text-[#0f2a2c]">Who is standing where</div></div>
   <button data-action="switchToVol" class="btn btn-glass flex-none rounded-full px-3 py-1.5 text-[11px] text-[#5b7178]">Switch</button>
  </div>
  ${serveTabs()}

  <div class="glass p-3.5">
   <div class="flex items-center justify-between">
    <div class="microlabel">Team for this expo</div>
    <span class="servechip ${hired>=need?'sc-ok':'sc-warn'}">${hired}/${need} confirmed</span>
   </div>
   <div class="mt-2 grid grid-cols-3 gap-2">
    <div class="tile"><span class="tile-l">Pledged</span><span class="tile-v">${volunteers.length}</span></div>
    <div class="tile"><span class="tile-l">Registered</span><span class="tile-v">${hired}</span></div>
    <div class="tile ${short?'tile-watch':''}"><span class="tile-l">Booths short</span><span class="tile-v">${short}</span></div>
   </div>
   <button data-action="exportVolCSV" class="btn btn-soft mt-3 w-full py-2 text-[11px]">⤓ Export volunteer roster CSV</button>
  </div>

  <div class="glass p-3.5">
   <div class="microlabel">Booth coverage</div>
   <div class="mt-2.5 space-y-2.5">
    ${rows.map(({b,team})=>{
      const got=team.length,cap=b.cap,pct=cap?Math.min(100,Math.round(got/cap*100)):0;
      const cls=got===0?'covbar-none':got<cap?'covbar-short':'';
      return `<div>
       <div class="flex items-center gap-2">
        <span class="boothpick-glyph hue-${b.hue}">${b.letter}</span>
        <span class="min-w-0 flex-1 text-[11.5px] font-bold text-[#33504f]">${esc(b.label)}</span>
        <span class="mono text-[10px] font-extrabold ${got>=cap?'text-brand-800':got===0?'text-rose-600':'text-amber-700'}">${got}/${cap}</span>
       </div>
       <div class="covbar mt-1.5 ${cls}"><i style="width:${pct}%"></i></div>
       ${(()=>{const leader=team.find(x=>x.lead),lk=linkedVolIds();
         return leader?`<div class="mt-1 truncate text-[10px] font-bold text-[#33504f]">★ ${esc(firstName(leader.name))} leads this station${mayPlace()&&lk&&!lk.has(leader.id)?' · link them to an account so they can manage their team':''}</div>`
                      :'<div class="mt-1 text-[10px] font-semibold text-[#8a9aa0]">No leader yet</div>';})()}
       ${got?`<div class="mt-1 truncate text-[10px] font-semibold text-[#6b8187]">${team.slice(0,12).map(v=>esc(firstName(v.name))).join(' · ')}${got>12?` · +${got-12}`:''}</div>`:
             `<div class="mt-1 text-[10px] font-semibold text-rose-600/90">Nobody yet — needs ${cap} helper${cap>1?'s':''}</div>`}
      </div>`;}).join('')}
   </div>
  </div>

  ${confirmed.length?`<div class="glass p-3.5">
   <div class="microlabel">Confirmed helpers · ${confirmed.length}</div>
   <div class="mt-2 space-y-1.5">${volCapped(confirmed,'confirmed').map(v=>volRow(v,true,mayPlace())).join('')}</div>
   ${volMore(confirmed,'confirmed')}
  </div>`:''}

  <div class="glass p-3.5">
   <div class="flex items-center justify-between">
    <div class="microlabel">Pledged — registration pending</div>
    ${upcoming.length?`<span class="servechip sc-warn">${upcoming.length} to register</span>`:'<span class="servechip sc-ok">all registered</span>'}
   </div>
   ${upcoming.length?`<div class="mt-2 space-y-1.5">${volCapped(upcoming,'pending').map(v=>volRow(v,false,mayPlace())).join('')}</div>
    ${volMore(upcoming,'pending')}
    <p class="mt-2.5 text-[10px] leading-relaxed text-[#6b8187]">Registration opens two weeks before the expo. Tap a name to register them now, or send a reminder.</p>`
   :`<p class="mt-2 text-[11px] leading-relaxed text-[#6b8187]">Everyone who pledged has completed registration. 🎉</p>`}
  </div>
 </section>`;
}
const volExpoSort=(a,b)=>volExpos(b)-volExpos(a)||volHours(b)-volHours(a);
/* Hundreds of volunteer rows at once made this screen take a second to open on a phone: show the first 25 (plus
   whoever is selected), and let the coordinator expand or use Switch → search to find anyone else. */
function volCapped(arr,key){
 if(arr.length<=LIST_CAP||(state.volAll&&state.volAll[key]))return arr;
 const out=arr.slice(0,LIST_CAP),act=arr.find(v=>v.id===state.volId);
 if(act&&!out.includes(act))out[LIST_CAP-1]=act;
 return out;
}
const volMore=(arr,key)=>arr.length>LIST_CAP&&!(state.volAll&&state.volAll[key])
 ?`<button data-action="showAllVol" data-args="${key}" class="btn btn-glass mt-2 w-full py-2.5 text-[11px] text-[#5b7178]">Show all ${arr.length}</button>`:'';
export function showAllVol(key){state.volAll=Object.assign({},state.volAll,{[key]:true});render();}
/* which volunteers are linked to a member account. The admin's loaded member list (src/account.js) is the only
   source on a staff device, so the mark appears once My church has been opened — no extra request for it. */
export const linkedVolIds=()=>{
 const L=(typeof cloud!=='undefined')&&cloud.members&&cloud.members.list;
 return L?new Set(L.filter(u=>u.volunteer_id).map(u=>u.volunteer_id)):null;
};

/* ================= PLACEMENT BOARD (admins and station leaders) =================
   Tap a volunteer on the muster: a sheet to move, swap, release or make team leader. Everything goes through the
   database functions (supabase "VOLUNTEER HUB: PLACEMENT"), which refuse a team leader acting outside their own
   station — the screens only show what the caller may do. No drag-and-drop: tap targets work with one thumb. */
export const isAdminAcct=()=>{
 const m=cloud.acct&&cloud.acct.membership;
 return !!m&&m.status==='approved'&&m.role==='admin';
};
/* may this viewer place people at all? An admin, or a team leader through their linked volunteer record */
export const mayPlace=()=>{
 if(isAdminAcct())return true;
 const m=cloud.acct&&cloud.acct.membership,vid=m&&m.volunteer_id;
 const v=vid&&volunteers.find(x=>x.id===vid);
 return !!(v&&v.lead);
};
/* the station the signed-in leader runs, through their linked record */
export const myLeadBooth=()=>{
 const m=cloud.acct&&cloud.acct.membership,vid=m&&m.volunteer_id;
 const v=vid&&volunteers.find(x=>x.id===vid);
 return v&&v.lead?v.booth:'';
};
async function volRpc(fn,args,done){
 if(!cloud.client)return null;
 let r;try{r=await cloud.client.rpc(fn,args||{});}catch(e){r={error:e};}
 if(r.error){toast(isOfflineErr(r.error.message)?'No connection — try again when you are online.':(r.error.message||'That did not work.'));return null;}
 if(done)toast(done);
 return r;
}
/* every placement change is pulled back straight away, so the board shows the truth even without live updates */
const afterPlace=async()=>{await cloudSync(true);};
export function openPlaceSheet(id){
 gotoServe();state.placeId=id;state.logOpen=false;showModal('#placeSheet',closePlaceSheet);rerenderPlace();
}
export function closePlaceSheet(){state.placeId='';hideModal('#placeSheet');render();}
const placedVol=()=>volunteers.find(v=>v.id===state.placeId)||null;
function placeSheetHTML(){
 const v=placedVol();if(!v)return '';
 const linked=linkedVolIds(),isAdm=isAdminAcct();
 const mine=myLeadBooth();
 const stations=BOOTHS.map(b=>({b,n:helpersAt(b.k).length}));
 /* who this caller may offer as the other half of a swap: an admin anybody, a leader their own people or the unplaced */
 const swappable=volunteers.filter(x=>x.id!==v.id&&(isAdm||x.booth===mine||!x.booth));
 return `<div class="flex items-center gap-2.5">
   <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11px] font-extrabold av hue-${badgeTier(v).hue}">${initials(v.name)}</span>
   <div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(v.name)}</div>
    <div class="text-[10.5px] text-[#4f6870]">${v.booth?'At '+esc(boothLabel(v.booth)):'Not placed yet'}${(v.pref||[]).length?' · asked for '+esc((v.pref||[]).map(boothLabel).join(', ')):''}${v.pref2?' or '+esc(boothLabel(v.pref2)):''}</div></div>
   <span class="servechip ${STATUS_UI[v.status].cls}">${STATUS_UI[v.status].label}</span></div>
  ${linked&&!linked.has(v.id)&&isAdm&&v.lead?'<p class="mt-2 rounded-xl bg-amber-50/80 p-2 text-[10.5px] font-semibold leading-snug text-[#8a5a12]">This team leader has no account linked — link them under My church so they can manage their team.</p>':''}
  <div class="microlabel mt-3">Move to…</div>
  <div class="mt-1.5 grid grid-cols-2 gap-1.5">
   ${stations.map(({b,n})=>`<button data-action="place-move" data-args="${b.k}" class="boothpick hue-${b.hue} ${v.booth===b.k?'boothpick-sel':''}">
     <span class="flex items-center gap-2"><span class="boothpick-glyph">${b.letter}</span>
      <span class="min-w-0"><span class="block truncate text-[10.5px] font-extrabold leading-tight text-[#123033]">${esc(b.label)}</span>
       <span class="mono block text-[8.5px] font-bold text-[#8a9aa0]">${n}${v.booth===b.k?'':'/'+b.cap} filled</span></span></span></button>`).join('')}
  </div>
  ${v.booth?`<div class="microlabel mt-3">Swap with…</div>
   <div class="mt-1.5 max-h-[26vh] space-y-1 overflow-y-auto no-scrollbar">
    ${swappable.slice(0,25).map(x=>`<button data-action="place-swap" data-args="${x.id}" class="flex w-full items-center gap-2 rounded-[14px] px-2 py-1.5 text-left transition hover:bg-white/60">
      <span class="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[9px] font-extrabold tint hue-${badgeTier(x).hue}">${initials(x.name)}</span>
      <span class="min-w-0 flex-1 truncate text-[11.5px] font-bold text-[#123033]">${esc(x.name)}</span>
      <span class="flex-none text-[9.5px] font-bold text-[#6b8187]">${x.booth?esc(boothLabel(x.booth)):'unplaced'}</span></button>`).join('')||'<p class="px-1 py-2 text-[11px] text-[#6b8187]">Nobody to swap with.</p>'}
   </div>
   <div class="mt-3 flex gap-2">
    <button data-action="place-release" class="btn btn-glass flex-1 py-2 text-xs text-rose-700">Take off this station</button>
    ${isAdm?`<button data-action="place-lead" class="btn btn-soft flex-1 py-2 text-xs">${v.lead?'Remove ★ leader':'Make ★ team leader'}</button>`:''}
   </div>`:`<p class="mt-3 text-[11px] leading-relaxed text-[#6b8187]">Pick a station above to place ${esc(firstName(v.name))}. Their choices are listed first, but the choice is yours.</p>`}`;
}
const rerenderPlace=()=>{const el=$('#placeBody');if(el)el.innerHTML=placeSheetHTML();};
export async function placeMove(booth){
 const v=placedVol();if(!v)return;
 if(v.booth===booth)return;
 const from=v.booth;
 const r=await volRpc('place_volunteer',{p_vol:v.id,p_booth:booth});
 if(!r)return;
 await afterPlace();rerenderPlace();
 /* from is empty when this was a first placement: undoing that is a release, not a move to nowhere */
 const back=()=>(from?volRpc('place_volunteer',{p_vol:v.id,p_booth:from}):volRpc('release_volunteer',{p_vol:v.id})).then(r2=>{if(r2)afterPlace();});
 toastUndo(`${firstName(v.name)} → ${boothLabel(booth)} ✓`,back);
}
export async function placeSwap(otherId){
 const v=placedVol(),o=volunteers.find(x=>x.id===otherId);if(!v||!o)return;
 const r=await volRpc('swap_volunteers',{p_a:v.id,p_b:o.id});
 if(!r)return;
 await afterPlace();rerenderPlace();
 toastUndo(`Swapped ${firstName(v.name)} ↔ ${firstName(o.name)} ✓`,()=>volRpc('swap_volunteers',{p_a:v.id,p_b:o.id}).then(r2=>{if(r2)afterPlace();}));
}
export async function placeRelease(){
 const v=placedVol();if(!v)return;
 const from=v.booth;
 const r=await volRpc('release_volunteer',{p_vol:v.id});
 if(!r)return;
 await afterPlace();rerenderPlace();
 if(from)toastUndo(`${firstName(v.name)} taken off ${boothLabel(from)}`,()=>volRpc('place_volunteer',{p_vol:v.id,p_booth:from}).then(r2=>{if(r2)afterPlace();}));
}
export async function placeLead(){
 const v=placedVol();if(!v)return;
 const make=!v.lead;
 const r=await volRpc('set_station_lead',{p_booth:v.booth,p_vol:make?v.id:null},make?`${firstName(v.name)} leads ${boothLabel(v.booth)} ★`:'Leader removed');
 if(!r)return;
 await afterPlace();rerenderPlace();
}

export function volRow(v,confirmed,placeMode){
 const act=!placeMode&&v.id===state.volId;
 const t=badgeTier(v);
 return `<button data-action="${placeMode?'openPlaceSheet':'setVol'}" data-args="${v.id}" class="flex w-full items-center gap-2.5 rounded-[18px] px-2 py-2 text-left transition-all duration-300 ${act?'bg-brand-500/10 ring-1 ring-brand-400/25':'hover:bg-white/60'}">
  <span class="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[10px] font-extrabold av hue-${t.hue}">${initials(v.name)}</span>
  <span class="min-w-0 flex-1">
   <span class="block truncate text-[12px] font-bold text-[#123033]">${esc(v.name)}</span>
   <span class="mt-0.5 flex flex-wrap items-center gap-1">
    <span class="servechip ${STATUS_UI[v.status].cls}">${STATUS_UI[v.status].label}</span>
    ${v.lead?'<span class="servechip sc-warn">★ Team leader</span>':''}
    <span class="rankpill hue-${t.hue}">${volLevel(v)?`Lv ${volLevel(v)}`:esc(t.name)}</span>
    ${linkedVolIds()&&linkedVolIds().has(v.id)?'<span class="servechip sc-ok">account ✓</span>':''}
    ${confirmed?`<span class="text-[9.5px] font-bold text-[#6b8187]">${esc(boothLabel(v.booth))}</span>`
               :`<span class="text-[9.5px] font-bold text-[#6b8187]">wants ${esc(boothLabel((v.pref||[])[0]||''))}</span>`}
   </span>
  </span>
  <span class="flex-none text-right">
   <span class="mono block text-[11px] font-extrabold text-[#33504f]">${volExpos(v)}</span>
   <span class="block text-[8.5px] font-bold uppercase tracking-wider text-[#8a9aa0]">expos</span>
  </span>
 </button>`;
}

/* ---------- 3. MY BOOTH ---------- */
function viewVolBooth(){
 const v=AV(); if(!v)return emptyVolState();
 if(needsRegistration(v))return `<section class="stagger space-y-3.5 pb-2">
  ${serveTabs()}
  <div class="glass hue-peach p-5 text-center">
   <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full tint hue-peach text-[15px] font-extrabold">${initials(v.name)}</div>
   <div class="display mt-2.5 text-[16px] font-extrabold text-[#0f2a2c]">No booth yet, ${esc(firstName(v.name))}</div>
   <p class="mx-auto mt-1.5 max-w-[30ch] text-[11px] leading-relaxed text-[#5b7178]">You have pledged${(v.pref||[]).length?` for <b>${esc(boothLabel(v.pref[0]))}</b>`:''}. Complete registration and we will confirm your booth and shift.</p>
   <button data-action="openVolReg" class="btn btn-primary w-full py-2.5 text-xs">Complete registration →</button>
  </div>
  ${boothPickerPreview(v)}
 </section>`;

 const b=BOOTH(v.booth),team=helpersAt(v.booth).filter(x=>x.id!==v.id),cap=boothNeeds(v.booth);
 const onShift=(v.shift||'').split(',').map(s=>s.trim()).filter(Boolean);
 return `<section class="stagger space-y-3.5 pb-2">
  <div class="flex items-center justify-between gap-2">
   <div><div class="microlabel">Booth assignment</div>
    <div class="display mt-0.5 text-[17px] font-extrabold text-[#0f2a2c]">${esc(boothLabel(v.booth))}</div></div>
   <button data-action="switchToVol" class="btn btn-glass flex-none rounded-full px-3 py-1.5 text-[11px] text-[#5b7178]">Switch</button>
  </div>
  ${serveTabs()}

  <div class="glass hue-${boothHue(v.booth)} p-4">
   <div class="flex items-start gap-3">
     <span class="medal hue-${badgeTier(v).hue}"><span class="medal-v"><b class="medal-lv">${volLevel(v)||'–'}</b><span class="medal-rk">${esc(badgeTier(v).short)}</span>${starGlyph(badgeTier(v).stars,'7px')}</span></span>
    <div class="min-w-0 flex-1">
     <div class="microlabel">${esc(v.lead?'Team leader':(v.role||'Volunteer'))}${v.lead?' · '+esc(boothLabel(v.booth)):''}</div>
     <div class="display mt-0.5 truncate text-[16px] font-extrabold text-[#0f2a2c]">${esc(v.name)}</div>
     <div class="mono mt-0.5 text-[10px] font-bold text-[#667d83]">${v.id} · ${esc(v.shirt||'—')} shirt</div>
     <div class="mt-1.5 flex flex-wrap gap-1.5">
      <span class="servechip ${STATUS_UI[v.status].cls}">${STATUS_UI[v.status].label}</span>
      ${v.role?`<span class="rankpill hue-${boothHue(v.booth)}">${esc(v.role)}</span>`:''}
     </div>
    </div>
   </div>
   <div class="mt-3 rounded-[14px] border border-white/80 bg-white/60 p-2.5">
    <div class="text-[10.5px] leading-relaxed text-[#5b7178]">${b?esc(b.blurb):''}</div>
   </div>
   <div class="mt-3 grid grid-cols-3 gap-2">
    <div class="tile"><span class="tile-l">On booth</span><span class="tile-v">${helpersAt(v.booth).length}/${cap}</span></div>
    <div class="tile"><span class="tile-l">Expos</span><span class="tile-v">${volExpos(v)}</span></div>
    <div class="tile"><span class="tile-l">Hours</span><span class="tile-v">${fmt1(volHours(v))}</span></div>
   </div>
  </div>

  <div class="glass p-4">
   <div class="flex items-center justify-between">
    <div class="microlabel">Your shift on the day</div>
    <button data-action="openVolReg" class="text-[10px] font-extrabold text-brand-800">Edit</button>
   </div>
   <div class="mt-2 flex flex-wrap gap-1.5">
    ${EXPO_UPCOMING.shifts.map(s=>{const on=onShift.includes(s);
      return `<button data-action="toggleShift" data-args="${s}" class="availpill ${on?'availpill-on':''} hue-${boothHue(v.booth)}">${on?'✓ ':''}${s}</button>`;}).join('')}
   </div>
   <div class="mt-2 text-[10px] leading-relaxed text-[#6b8187]">Tap the slots you can cover. ${onShift.length?`You are down for <b class="text-[#33504f]">${esc(onShift.join(', '))}</b>.`:'Nothing selected yet.'}</div>
  </div>

  ${team.length?`<div class="glass p-4">
   <div class="microlabel">Working this booth with you · ${team.length}</div>
   <div class="mt-2 space-y-1.5">${team.map(x=>`<div class="flex items-center gap-2.5 rounded-[16px] px-1.5 py-1.5">
     <span class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[9px] font-extrabold av hue-${badgeTier(x).hue}">${initials(x.name)}</span>
     <span class="min-w-0 flex-1"><span class="block truncate text-[11.5px] font-bold text-[#123033]">${esc(x.name)}</span>
      <span class="block text-[9.5px] font-semibold text-[#6b8187]">${esc(x.role||'Volunteer')} · ${volExpos(x)} expos · ${esc(x.phone||'no number')}</span></span>
     ${medalHTML(x,true)}</div>`).join('')}</div>
  </div>`:''}

  <div class="grid grid-cols-2 gap-2">
   <button data-action="logExpoEntry" class="btn btn-primary py-2.5 text-[11px]">+ Log an expo</button>
   <button data-action="exportVolCSV" class="btn btn-glass py-2.5 text-[11px] text-[#5b7178]">⤓ Roster CSV</button>
  </div>

  ${boothPickerPreview(v,true)}
 </section>`;
}

/* Booth picker: reads the registration draft when open, else the saved record. */
function boothPicker(d,{onToggleA,onToggleB}){
 const selA=d.pref||[],selB=d.pref2||'';
 return `<div class="space-y-2">
  <div class="microlabel">First choice booth <span class="font-bold normal-case tracking-normal text-[#8a9aa0]">(tap to change)</span></div>
  <div class="grid grid-cols-2 gap-2">
   ${BOOTHS.map(b=>{const on=selA.includes(b.k);
    return `<button data-action="${onToggleA}" data-args="${b.k}" class="boothpick hue-${b.hue} ${on?'boothpick-sel':''}">
     ${on?`<span class="boothpick-tick"><svg viewBox="0 0 24 24" style="width:.6rem;height:.6rem" fill="none" stroke="currentColor" stroke-width="3.4"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>`:''}
     <span class="flex items-center gap-2">
      <span class="boothpick-glyph">${b.letter}</span>
      <span class="min-w-0"><span class="block truncate text-[10.5px] font-extrabold leading-tight text-[#123033]">${esc(b.label)}</span>
       <span class="mono block text-[8.5px] font-bold text-[#8a9aa0]">${helpersAt(b.k).length}/${b.cap} filled</span></span>
     </span>
    </button>`;}).join('')}
  </div>
  <div class="microlabel pt-1">Second choice <span class="font-bold normal-case tracking-normal text-[#8a9aa0]">(backup if the first is full)</span></div>
  <div class="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
   ${BOOTHS.map(b=>{const on=selB===b.k;
    return `<button data-action="${onToggleB}" data-args="${b.k}" class="availpill flex-none hue-${b.hue} ${on?'availpill-on':''}">${on?'✓ ':''}${esc(b.label)}</button>`;}).join('')}
  </div>
 </div>`;
}
function boothPickerPreview(v,compact){
 const mine=v.pref||[],back=v.pref2;
 const others=BOOTHS.filter(b=>b.k!==v.booth&&(mine.includes(b.k)||b.k===back));
 if(!others.length)return '';
 return `<div class="glass p-4">
  <div class="microlabel">${compact?'Your other choices':'Booths you asked for'}</div>
  <div class="mt-2 space-y-2">
   ${others.map(b=>{const got=helpersAt(b.k).length;
    return `<div class="flex items-center gap-2">
     <span class="boothpick-glyph hue-${b.hue}">${b.letter}</span>
     <span class="min-w-0 flex-1"><span class="block truncate text-[11px] font-bold text-[#33504f]">${esc(b.label)}</span>
      <span class="covbar mt-1 block"><i style="width:${Math.min(100,Math.round(got/(b.cap||1)*100))}%"></i></span></span>
     <span class="mono flex-none text-[10px] font-extrabold text-[#667d83]">${got}/${b.cap}</span>
     ${b.k===v.booth?'<span class="servechip sc-ok">yours</span>':''}
    </div>`;}).join('')}
  </div>
 </div>`;
}

/* ---------- 4. RECORD (service history) ---------- */
function viewVolRecord(){
 const v=AV(); if(!v)return emptyVolState();
 const h=[...v.history].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const t=badgeTier(v),nx=nextTier(v),p=tierProgress(v);
 const shown=Math.min(volExpos(v),10);
 const totalH=volHours(v);
 return `<section class="stagger space-y-3.5 pb-2">
  <div><div class="microlabel">Volunteer service record</div>
   <div class="display mt-0.5 text-[17px] font-extrabold text-[#0f2a2c]">${esc(firstName(v.name))}’s ${volExpos(v)} expo${volExpos(v)===1?'':'s'}</div></div>
  ${serveTabs()}

  <div class="glass hue-${t.hue} p-4">
   <div class="flex items-center gap-3.5">
    ${medalHTML(v)}
    <div class="min-w-0 flex-1">
     <div class="text-[10px] font-extrabold uppercase tracking-wider" style="color:var(--ink)">Badge ${t.n} of ${BADGE_TIERS.length-1}</div>
     <div class="display mt-0.5 text-[16px] leading-tight font-extrabold text-[#0f2a2c]">${esc(t.name)}</div>
     ${v.lead&&v.booth?`<div class="mt-0.5 text-[10px] font-bold text-[#33504f]">Team leader · ${esc(boothLabel(v.booth))}</div>`:''}
     <div class="mt-1 text-[10px] font-bold text-[#5b7178]">${volLevel(v)?`Level ${volLevel(v)} of ${VOL_LEVEL_MAX} · `:''}Volunteering since ${esc(String(v.since||'—').slice(0,4))} · ${volYears(v)} yr${volYears(v)===1?'':'s'}</div>
     ${t.stars?`<div class="mt-1 flex gap-0.5 text-[#bf9a40]">${'★'.repeat(t.stars)}<span class="text-[#c9d3d6]">${'★'.repeat(5-t.stars)}</span></div>`:''}
    </div>
   </div>
   ${nx?`<div class="mt-3.5">
     <div class="flex items-baseline justify-between text-[10px] font-bold text-[#5b7178]">
      <span>Next · ${esc(nx.name)}</span><span class="mono">${p.pct}%</span></div>
     <div class="covbar mt-1.5"><i style="width:${p.pct}%"></i></div>
     <div class="mt-1.5 flex justify-between text-[10px] font-semibold text-[#6b8187]">
      <span class="${p.blockedBy==='expos'?'text-[#8a5a12]':''}">${volExpos(v)}/${nx.minExpos} expos</span>
      <span class="${p.blockedBy==='hours'?'text-[#8a5a12]':''}">${fmt1(totalH)}/${nx.minHours} hrs</span></div>
     <div class="mt-1.5 text-[10px] font-bold" style="color:var(--ink)">${tierRemaining(v)}</div>
    </div>`:`<div class="mt-3 text-[10px] font-bold" style="color:var(--ink)">Highest badge — Expo Legend 🏅</div>`}
  </div>

  <div class="glass p-3.5">
   <div class="microlabel">Lifetime service</div>
   <div class="mt-2 grid grid-cols-3 gap-2">
    <div class="tile"><span class="tile-l">Expos</span><span class="tile-v">${volExpos(v)}</span></div>
    <div class="tile"><span class="tile-l">Hours</span><span class="tile-v">${fmt1(totalH)}</span></div>
    <div class="tile"><span class="tile-l">Booths</span><span class="tile-v">${new Set(v.history.map(x=>x.booth).filter(Boolean)).size}</span></div>
   </div>
   <div class="mt-2.5 text-[10px] font-semibold text-[#6b8187]">${volExpos(v)?`Average ${fmt1(totalH/Math.max(1,volExpos(v)))} hours per expo.`:'No expos logged yet.'}</div>
  </div>

  <div class="glass p-3.5">
   <div class="flex items-center justify-between">
    <div class="microlabel">Served at${volExpos(v)>shown?` · last ${shown} of ${volExpos(v)}`:''}</div>
    <button data-action="logExpoEntry" class="btn btn-soft flex-none rounded-full px-3 py-1 text-[10px]">+ Add</button>
   </div>
   ${state.logOpen?logForm():''}
   ${h.length?`<div class="mt-2.5 space-y-2">${h.slice(0,shown).map(x=>`
    <div class="tline">
     <span class="tdate hue-${boothHue(x.booth)}"><b>${esc(fmtDate(x.date).split(' ')[0])}</b><span>${esc(fmtDate(x.date).split(' ')[1]||'')}</span></span>
     <span class="min-w-0 flex-1">
      <span class="block truncate text-[11.5px] font-bold text-[#123033]">${esc(x.name||'Health Expo')}</span>
      <span class="mt-0.5 block truncate text-[10px] font-semibold text-[#6b8187]">${esc(boothLabel(x.booth))} · ${esc(x.expo||'')}</span>
     </span>
     <span class="mono flex-none text-right text-[11px] font-extrabold text-[#33504f]">${fmt1(Number(x.hours)||0)}<span class="block text-[8.5px] font-bold uppercase tracking-wider text-[#8a9aa0]">hours</span></span>
     <button data-action="expo-remove" data-ix="${v.history.indexOf(x)}" aria-label="Remove entry" class="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[#b8c4c8] transition hover:bg-rose-500/10 hover:text-rose-600">
      <svg viewBox="0 0 24 24" style="width:.7rem;height:.7rem" fill="none" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>`).join('')}</div>`
   :`<p class="mt-2.5 text-[11px] leading-relaxed text-[#6b8187]">No past expos recorded yet. After the expo, tap <b>+ Add</b> to log the day and your hours — it counts toward your badge.</p>`}
  </div>

  <div class="glass p-4">
   <div class="microlabel">Badge ladder</div>
   <div class="mt-2.5 space-y-2">
    ${BADGE_TIERS.map(x=>{const got=volExpos(v)>=x.minExpos&&volHours(v)>=x.minHours;const cur=x.n===t.n;
     return `<div class="flex items-center gap-2.5 rounded-[14px] px-2 py-1.5 ${cur?'bg-white/70':''}">
      <span class="medal medal-sm hue-${x.hue}" style="opacity:${got?1:.42}"><span class="medal-v"><b class="medal-lv">${x.n}</b></span></span>
      <span class="min-w-0 flex-1">
       <span class="block truncate text-[11px] font-extrabold text-[#33504f]">${esc(x.name)}</span>
       <span class="block text-[9.5px] font-semibold text-[#6b8187]">${x.minExpos} expos · ${x.minHours} hours</span></span>
      ${got?'<span class="servechip sc-ok">earned</span>':'<span class="servechip sc-off">locked</span>'}
     </div>`;}).join('')}
   </div>
  </div>

  <button data-action="exportVolCSV" class="btn btn-glass w-full py-2.5 text-[11px] text-[#5b7178]">⤓ Export volunteer roster CSV</button>
 </section>`;
}
function logForm(){
 return `<div class="modal-in mt-2.5 rounded-[18px] border border-brand-200/60 bg-brand-50/70 p-3">
  <div class="text-[11px] font-extrabold text-brand-900">Log an expo you served at</div>
  <div class="mt-2 grid grid-cols-2 gap-2">
   <label class="col-span-2"><span class="microlabel">Expo name</span>
    <input id="lgName" class="field mt-1 text-[12px]" placeholder="Autumn Health Expo"></label>
   <label><span class="microlabel">Date</span>
    <input id="lgDate" type="date" class="field mono mt-1 text-[12px]"></label>
   <label><span class="microlabel">Hours</span>
    <input id="lgHours" type="number" step="0.5" min="0" max="24" inputmode="decimal" class="step-input mt-1" placeholder="6"></label>
   <label class="col-span-2"><span class="microlabel">Booth worked</span>
    <select id="lgBooth" class="field mt-1 text-[12px]">${BOOTHS.map(b=>`<option value="${b.k}" ${b.k===(AV()||{}).booth?'selected':''}>${esc(b.label)}</option>`).join('')}</select></label>
  </div>
  <div class="mt-2.5 flex gap-2">
   <button data-action="log-close" class="btn btn-glass flex-1 py-2 text-[11px] text-[#5b7178]">Cancel</button>
   <button data-action="saveExpoEntry" class="btn btn-primary flex-1 py-2 text-[11px]">Save to record</button>
  </div>
 </div>`;
}
function emptyVolState(){
 return `<section class="stagger space-y-3.5 pb-2">
  <div class="glass p-5 text-center">
   <div class="display text-[16px] font-extrabold text-[#0f2a2c]">No volunteer selected</div>
   <p class="mx-auto mt-1.5 max-w-[28ch] text-[11px] leading-relaxed text-[#5b7178]">Register the first volunteer and they will appear here with a badge.</p>
   <button data-action="openVolReg" class="btn btn-primary mt-3 w-full py-2.5 text-xs">Register a volunteer →</button>
  </div></section>`;
}

/* ---------- registration / pledge form ---------- */
export function openVolReg(){gotoServe();state.volRegOpen=true;state.logOpen=false;render();window.scrollTo({top:0,behavior:'smooth'});}
/* Sections 1–3 of the pledge form, shared by the staff pledge (Team tab) and the member's "My pledge" box
   (src/account.js). `d` is the draft being edited, `pfx` the input-id prefix and `acts` the action names, so the
   two forms keep separate drafts and never write each other's state. */
export function pledgeFormParts(d,pfx,acts){
 return `<div class="glass p-4 space-y-3">
   <div class="microlabel">1 · Who you are</div>
   <label class="block"><span class="microlabel">Full name *</span>
    <input id="${pfx}Name" value="${esc(d.name)}" data-on-input="${acts.name}" class="field mt-1" placeholder="e.g. Thandi Mabaso" autocomplete="name"></label>
   <div class="grid grid-cols-2 gap-2">
    <label class="block"><span class="microlabel">Mobile **</span>
     <input id="${pfx}Phone" value="${esc(d.phone)}" data-on-input="${acts.phone}" type="tel" inputmode="tel" class="field mt-1" placeholder="082 000 0000" autocomplete="tel"></label>
    <label class="block"><span class="microlabel">T-shirt</span>
     <select id="${pfx}Shirt" data-on-change="${acts.shirt}" class="field mt-1">
      ${['','S','M','L','XL','2XL','3XL'].map(s=>`<option value="${s}" ${d.shirt===s?'selected':''}>${s||'—'}</option>`).join('')}</select></label>
   </div>
   <label class="block"><span class="microlabel">Email **</span>
    <input id="${pfx}Email" value="${esc(d.email)}" data-on-input="${acts.email}" type="email" inputmode="email" class="field mt-1" placeholder="you@example.org" autocomplete="email"></label>
   <p class="text-[11px] leading-snug text-[#6b8187]">** A mobile number or an email address: at least one, so the team can reach you.</p>
  </div>

  <div class="glass p-4">
   <div class="microlabel">2 · Your pledge</div>
   <div class="mt-2">
    <span class="microlabel">How many expos are you pledging to help at?</span>
    <div class="mt-1.5 flex flex-wrap gap-1.5">
     ${[1,2,3,4,6,12].map(n=>`<button data-action="${acts.pledge}" data-args="${n}" class="availpill hue-peach ${d.pledgeExpos===n?'availpill-on':''}">${n}${n===12?'+':''} expo${n>1?'s':''}</button>`).join('')}
    </div>
   </div>
   <div class="mt-3">
    <span class="microlabel">What can you help with?</span>
    <div class="mt-1.5 flex flex-wrap gap-1.5">
     ${SKILLS.map(([k,l])=>`<button data-action="${acts.list}" data-list="${acts.skillsKey}" data-args="${k}" class="availpill hue-aqua ${d.skills.includes(k)?'availpill-on':''}">${l}</button>`).join('')}
    </div>
   </div>
   <div class="mt-3">
    <span class="microlabel">When are you usually free?</span>
    <div class="mt-1.5 flex flex-wrap gap-1.5">
     ${AVAIL.map(([k,l])=>`<button data-action="${acts.list}" data-list="${acts.availKey}" data-args="${k}" class="availpill hue-sage ${d.avail.includes(k)?'availpill-on':''}">${l}</button>`).join('')}
    </div>
   </div>
  </div>

  <div class="glass p-4">
   <div class="microlabel">3 · Booth preference</div>
   <div class="mt-2.5">${boothPicker(d,{onToggleA:acts.boothA,onToggleB:acts.boothB})}</div>
  </div>`;
}
/* the member's own pledge draft ("My pledge" box in src/account.js): same shape as state.vf, kept apart from it */
export const myDraft=()=>state.mf||(state.mf=emptyDraft());
export function myField(k,val){myDraft()[k]=val;render();}
export function myPickPledge(n){myDraft().pledgeExpos=n;render();}
export function myToggleList(k,v){
 const a=myDraft()[k];const i=a.indexOf(v);
 if(i<0)a.push(v);else a.splice(i,1);
 render();
}
export function myToggleBooth(k){
 const a=myDraft().pref;const i=a.indexOf(k);
 if(i<0){a.push(k);if(a.length>2)a.shift();}else a.splice(i,1);
 render();
}
export function mySecondBooth(k){myDraft().pref2=myDraft().pref2===k?'':k;render();}
/* the actions the two forms pass to pledgeFormParts: same parts, different drafts */
export const STAFF_PLEDGE_ACTS={name:'vf-name',phone:'vf-phone',shirt:'vf-shirt',email:'vf-email',
 pledge:'pledge-pick',list:'draft-toggle',skillsKey:'skills',availKey:'avail',boothA:'toggleDraftBooth',boothB:'pickSecondBooth'};
export const MY_PLEDGE_ACTS={name:'my-name',phone:'my-phone',shirt:'my-shirt',email:'my-email',
 pledge:'my-pledge-pick',list:'my-draft-toggle',skillsKey:'skills',availKey:'avail',boothA:'my-draft-booth',boothB:'my-second-booth'};

function viewVolRegister(){
 const v=AV();
 const d=state.vf;
 /* when editing an existing profile, prefill the draft once */
 if(!d._init&&v){d.name=v.name||'';d.phone=v.phone||'';d.email=v.email||'';d.pledgeExpos=v.pledgeExpos||1;
  d.skills=[...(v.skills||[])];d.pref=[...(v.pref||[])];d.avail=[...(v.availability||[])];d.pref2=v.pref2||'';
  d.shirt=v.shirt||'';d.emergency=v.emergency||'';d.notes=v.notes||'';d._init=true;}
 const set=(k,val)=>{state.vf[k]=val;};
 return `<section class="stagger space-y-3.5 pb-2">
  <button data-action="closeVolReg" class="btn btn-glass w-fit gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-[#5b7178]">
   <svg viewBox="0 0 24 24" style="width:.8rem;height:.8rem" fill="none" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>Back</button>

  <div><div class="microlabel">${v&&!needsRegistration(v)?'Update registration':'Pledge & register'}</div>
   <div class="display mt-0.5 text-[18px] font-extrabold text-[#0f2a2c]">${v&&!needsRegistration(v)?'Keep your details current':'Volunteer for the expo'}</div>
   <p class="mt-1 text-[11px] leading-relaxed text-[#6b8187]">${EXPO_UPCOMING.name} · ${expoLine()}</p>
   ${v&&!needsRegistration(v)?'':`<p class="mt-1.5 text-[11.5px] font-semibold leading-snug text-[#33504f]">Only a name and a mobile number or email are needed now. Tap <b>Submit pledge</b> any time; the rest can wait until closer to the day.</p>`}</div>

  ${pledgeFormParts(d,'vf',STAFF_PLEDGE_ACTS)}

  <div class="glass p-4 space-y-3">
   <div class="microlabel">4 · Registration details <span class="font-bold normal-case tracking-normal text-[#8a9aa0]">(needed closer to the day)</span></div>
   <label class="block"><span class="microlabel">Emergency contact</span>
    <input id="vfEm" value="${esc(d.emergency)}" data-on-input="vf-emergency" class="field mt-1" placeholder="Name & number"></label>
   <label class="block"><span class="microlabel">Anything we should know? (health, dietary, skills)</span>
    <textarea id="vfNotes" data-on-input="vf-notes" rows="2" class="field mt-1" placeholder="Optional">${esc(d.notes)}</textarea></label>
  </div>

  <div class="sticky bottom-24 z-20">
   <button data-action="saveVolunteer" class="btn btn-primary w-full py-3 text-sm">${v&&!needsRegistration(v)?'Save changes':'Submit pledge →'}</button>
  </div>
  <p class="pb-2 text-center text-[10px] leading-relaxed text-[#8a9aa0]">Stored on this device only. Nothing is sent anywhere.</p>
 </section>`;
}
export function pickPledge(n){state.vf.pledgeExpos=n;render();}
export function toggleDraftList(k,v){
 const a=state.vf[k];const i=a.indexOf(v);
 if(i<0)a.push(v);else a.splice(i,1);
 render();
}
export function toggleDraftBooth(k){
 const a=state.vf.pref,i=a.indexOf(k);
 if(i<0){a.push(k);if(a.length>2)a.shift();}else a.splice(i,1);
 render();
}
export function pickSecondBooth(k){state.vf.pref2=state.vf.pref2===k?'':k;render();}
export function toggleShift(s){
 const v=AV(); if(!v)return;
 const cur=(v.shift||'').split(',').map(x=>x.trim()).filter(Boolean);
 const i=cur.indexOf(s);
 if(i<0)cur.push(s);else cur.splice(i,1);
 v.shift=cur.join(', ');
 toast(i<0?`Added ${s} ✓`:`Removed ${s}`);
 render();
}
export function saveVolunteer(){
 const d=state.vf;
 const name=String(d.name||'').trim(),phone=String(d.phone||'').trim();
 if(!name){toast('Please enter a name');return;}
 /* a pledge nobody can reach is no pledge: a mobile number or an email address, at least one */
 const hasPhone=/\d/.test(phone),email=String(d.email||'').trim();
 if(!hasPhone&&!validEmail(email)){toast('Please enter a mobile number or an email address, so the team can reach you');return;}
 const v=AV();
 const isNew=!v||state.volNew;
 const registered=d.pref.length>0;
 const today=todayStr();
 /* in the shared database, where a person stands is the admin's or the station leader's call — the place-guard
    trigger refuses anybody else writing booth, on a new row as well as on an edit. A plain staff pledge keeps
    its choices and an admin places them; the demo and the admins' own form keep the one-tap registration. */
 const cloudStaff=!!(cloud.user&&cloud.acct&&cloud.acct.membership&&cloud.acct.membership.status==='approved');
 const mayPlaceHere=!cloudStaff||isAdminAcct()||!!myLeadBooth();
 const placed=registered&&mayPlaceHere;
 if(isNew){
  let id;do{id='VOL-'+state._volSeq++;}while(volunteers.some(x=>x.id===id));   /* never reuse a number already on this device */
  const rec=migrateVolunteer({id,name,phone,email:d.email,pledgeExpos:d.pledgeExpos,skills:d.skills,
   pref:d.pref,pref2:d.pref2,availability:d.avail,shirt:d.shirt,emergency:d.emergency,notes:d.notes,
   status:placed?'registered':'prospect',booth:placed?d.pref[0]:null,
   since:today,pledgedOn:today,registeredOn:placed?today:null,history:[]});
  volunteers.push(rec);state.volId=id;
  toast(placed?`${firstName(name)} registered at ${boothLabel(rec.booth)} ✓`:`Pledge received — ${firstName(name)} ✓`);
 }else{
  Object.assign(v,{name,phone,email:d.email,pledgeExpos:d.pledgeExpos,skills:[...d.skills],
   pref:[...d.pref],pref2:d.pref2,availability:[...d.avail],shirt:d.shirt,emergency:d.emergency,notes:d.notes});
  if(mayPlaceHere){
   if(registered){v.status=v.status==='checkedin'?'checkedin':'registered';v.booth=d.pref[0];v.registeredOn=v.registeredOn||today;}
   else if(v.status!=='checkedin'){v.status='prospect';}
  }
  toast('Saved ✓');
 }
 state.volRegOpen=false;state.volNew=false;state.vf=emptyDraft();
 render();
}
export function startNewVolunteer(){closeSwitcher();state.volNew=true;state.volId=null;state.vf=emptyDraft();openVolReg();}
/* the same volunteer picker the header chip opens (the old prompt() dialog could not show names properly) */
export function switchToVol(){openVolSwitcher();}
export function logExpoEntry(){gotoServe();state.logOpen=true;if(state.volTab!=='record')state.volTab='record';render();}
export function saveExpoEntry(){
 const v=AV(); if(!v)return;
 const nm=($('#lgName')&&$('#lgName').value.trim())||'Health Expo';
 const dt=($('#lgDate')&&$('#lgDate').value)||todayStr();
 const hrs=parseFloat($('#lgHours')&&$('#lgHours').value);
 const bk=$('#lgBooth')?$('#lgBooth').value:(v.booth||BOOTHS[0].k);
 if(!(hrs>0)){toast('Enter the hours you served');return;}
 if(hrs>24){toast('A single expo day cannot be more than 24 hours');return;}
 if(dt>todayStr()){toast('That date is in the future — log it after the expo');return;}
 const name=nm+' '+dt.slice(0,4);
 const key=(v.id+'-'+dt+'-'+bk).replace(/[^A-Za-z0-9-]/g,'');
 if(v.history.some(x=>x.expo===key&&x.date===dt)){toast('That day is already in the record for this booth');return;}
 v.history.push({expo:key,name,date:dt,booth:bk,hours:hrs});
 state.logOpen=false;
 const t=badgeTier(v);
 toast(`Logged ✓ ${fmt1(hrs)} hrs at ${boothLabel(bk)} — ${t.name}`);
 render();
}
/* the button passes the entry's position, never its text (text from the database must not end up inside an onclick) */
export function removeExpoEntry(at){
 const v=AV(); if(!v)return;
 const i=typeof at==='number'?at:v.history.findIndex(x=>`${x.expo}-${x.date}`===at);
 if(!Number.isInteger(i)||i<0||i>=v.history.length)return;
 const gone=v.history.splice(i,1)[0];
 toast(`Removed ${fmtDate(gone.date)} entry`);
 render();
}
/* the volunteer sheet body is rebuilt by renderVolModal() when it is opened */
export function renderServeSheet(){}

/* ---------- CSV export ---------- */
export function exportVolCSV(){
 const rows=[['Volunteer ID','Name','Phone','Email','Status','Team leader','Badge level','Badge','Expos served','Total hours','Booth','Second choice','Shift','Availability','Skills','T-shirt','Emergency contact','Volunteering since','Notes','Expo history']];
 volunteers.forEach(v=>{
  const t=badgeTier(v);
  rows.push([v.id,v.name,v.phone,v.email,STATUS_UI[v.status].label,v.lead?'Yes':'',t.n,t.name,volExpos(v),fmt1(volHours(v)),
   boothLabel(v.booth),(v.pref||[]).map(boothLabel).join('; '),v.shift||'',availLabels(v).join('; '),
   (v.skills||[]).map(k=>(SKILLS.find(s=>s[0]===k)||[k,k])[1]).join('; '),
   v.shirt||'',v.emergency||'',String(v.since||''),v.notes||'',
   (v.history||[]).map(h=>`${h.name} (${h.date}) ${boothLabel(h.booth)} ${fmt1(Number(h.hours)||0)}h`).join(' | ')]);
 });
 downloadCSV(rows,'newstart-volunteers.csv','Volunteer roster exported ✓');
}


/* ================= MODALS ================= */
/* `close` is the overlay's own close function, for the sheets that also reset state; the rest just hide.
   A sheet caught mid-close (is-closing) counts as closed, because hideModal already gave its entry back. */
export function showModal(sel,close){const el=$(sel);clearTimeout(el._t);
 const wasOpen=!el.classList.contains('hidden')&&!el.classList.contains('is-closing');
 el.classList.remove('hidden','is-closing');el.classList.add('flex');
 if(!wasOpen)overlayOpened(sel,close||(()=>hideModal(sel)));}
export function hideModal(sel){const el=$(sel);if(el.classList.contains('hidden'))return;el.classList.add('is-closing');clearTimeout(el._t);el._t=setTimeout(()=>{el.classList.add('hidden');el.classList.remove('flex','is-closing');},260);overlayClosed(sel);}
function modeToggle(mode){
 const B=(k,l)=>`<button data-action="setSwitchMode" data-args="${k}" class="flex-1 rounded-full py-1.5 text-[11px] font-extrabold transition ${mode===k?'sw-on':'text-[#5b7178]'}">${l}</button>`;
 return `<div class="flex gap-1 rounded-full bg-[#123033]/[.06] p-1">${B('visitor','Visitors')}${B('volunteer','Volunteers')}</div>`;
}
export function setSwitchMode(m){state.switchMode=m;openSwitcher();}

export function openSwitcher(){
 const vol=state.switchMode==='volunteer';
 $('#switcherHead').innerHTML=`<h3 class="display text-base font-extrabold">${vol?'Switch volunteer':'Switch visitor'}</h3>
  <div class="mt-2.5">${modeToggle(vol?'volunteer':'visitor')}</div>`;
 if(vol){
  const pend=volunteers.filter(needsRegistration).length;
  if(volunteers.length>LIST_CAP)$('#switcherHead').innerHTML+=`<input id="swv" type="search" placeholder="Search ${volunteers.length} volunteers by name, phone or email"
    data-on-input="vol-switcher-filter" class="field mt-2.5" autocomplete="off">`;
  $('#switcherList').innerHTML=volSwitcherHTML('');
  $('#switcherFoot').innerHTML=`${pend?`<div class="mb-2 rounded-[16px] border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-[10px] font-semibold text-amber-900">${pend} pledge${pend>1?'s':''} still need${pend>1?'':'s'} registration.</div>`:''}
   <button data-action="startNewVolunteer" class="btn btn-soft w-full py-2.5 text-xs">
    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 4v16m8-8H4"/></svg>
    Pledge a new volunteer</button>`;
  showModal('#switcherModal');return;
 }
 if(attendees.length>LIST_CAP)$('#switcherHead').innerHTML+=`<input id="swq" type="search" placeholder="Search ${attendees.length} visitors by name, badge or phone"
   data-on-input="switcher-filter" class="field mt-2.5" autocomplete="off">`;
 $('#switcherList').innerHTML=switcherListHTML('');
 $('#switcherFoot').innerHTML=`<button data-action="registerNew" class="btn btn-soft w-full py-2.5 text-xs">
   <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 4v16m8-8H4"/></svg>
   Register a new visitor</button>`;
 showModal('#switcherModal');
}
function switcherListHTML(query){
 const rows=visitorsToShow(query);
 if(!rows.length)return `<p class="px-1 py-4 text-center text-[11px] text-[#6b8187]">${String(query||'').trim()?'Nobody matches that.':'No visitors yet — register the first one.'}</p>`;
 return rows.map(a=>{const act=a.id===state.activeId;
  return `<button data-action="pickAttendee" data-args="${a.id}" class="flex w-full items-center gap-3 rounded-[18px] px-2.5 py-2.5 text-left transition-all duration-300 ${act?'bg-brand-500/10 ring-1 ring-brand-400/25':'hover:bg-white/60'}">
   <span class="flex h-9 w-9 flex-none items-center justify-center rounded-[13px] text-[11px] font-extrabold ${act?'av':'tint'} hue-${hueOf(a.id)}">${initials(a.name)}</span>
   <span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-bold">${esc(a.name)}</span>
   <span class="mono block text-[10px] text-[#6b8187]">${esc(a.id)}</span></span>
   ${act?'<svg class="h-5 w-5 flex-none text-brand-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>':''}
  </button>`}).join('');
}
export function filterSwitcher(v){const el=$('#switcherList');if(el)el.innerHTML=switcherListHTML(v);}
/* same idea as visitorsToShow: a search box and at most LIST_CAP rows, never the whole roster */
function volsToShow(query){
 const q=String(query||'').trim().toLowerCase();
 if(q){const out=[];for(let i=volunteers.length-1;i>=0&&out.length<LIST_CAP;i--){const v=volunteers[i];
  if(`${v.name} ${v.id} ${v.phone||''} ${v.email||''}`.toLowerCase().includes(q))out.push(v);}return out;}
 if(volunteers.length<=LIST_CAP)return volunteers;
 const recent=volunteers.slice(-LIST_CAP).reverse(),act=volunteers.find(v=>v.id===state.volId);
 return act&&!recent.includes(act)?[act,...recent.slice(0,LIST_CAP-1)]:recent;
}
function volSwitcherHTML(query){
 const rows=volsToShow(query);
 if(!rows.length)return `<p class="px-1 py-4 text-center text-[11px] text-[#6b8187]">${String(query||'').trim()?'Nobody matches that.':'No volunteers yet — pledge the first one.'}</p>`;
 return rows.map(v=>{const act=v.id===state.volId,t=badgeTier(v);
  return `<button data-action="pickVolunteer" data-args="${v.id}" class="flex w-full items-center gap-3 rounded-[18px] px-2.5 py-2.5 text-left transition-all duration-300 ${act?'bg-brand-500/10 ring-1 ring-brand-400/25':'hover:bg-white/60'}">
   <span class="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[11px] font-extrabold ${act?'av':'tint'} hue-${t.hue}">${initials(v.name)}</span>
   <span class="min-w-0 flex-1"><span class="block truncate text-[13px] font-bold">${esc(v.name)}</span>
    <span class="mt-0.5 flex flex-wrap items-center gap-1"><span class="servechip ${STATUS_UI[v.status].cls}">${STATUS_UI[v.status].label}</span>
     <span class="mono text-[9.5px] font-bold text-[#6b8187]">${volLevel(v)?`Lv ${volLevel(v)} · ${volExpos(v)} expo${volExpos(v)===1?'':'s'}`:'No expos yet'}</span></span></span>
   ${act?'<svg class="h-5 w-5 flex-none text-brand-600" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>':''}
  </button>`}).join('');
}
export function filterVolSwitcher(v){const el=$('#switcherList');if(el)el.innerHTML=volSwitcherHTML(v);}
export function closeSwitcher(){hideModal('#switcherModal');}
export function pickVolunteer(id){
 closeSwitcher();
 state.volId=id;state.volNew=false;state.volRegOpen=false;state.vf={name:'',phone:'',email:'',pledgeExpos:1,skills:[],pref:[],avail:[]};
 if(state.tab!=='serve'){state.tab='serve';}
 render();
 const v=volunteers.find(x=>x.id===id);
 if(v)toast(`${firstName(v.name)} · ${badgeTier(v).name}`);
}
export function openVolSwitcher(){state.switchMode='volunteer';openSwitcher();}
export function openVolModal(){renderVolModal();showModal('#volModal');}
export function closeVolModal(){hideModal('#volModal');}
function renderVolModal(){
 const hired=staffedCount(),need=EXPO_UPCOMING.need;
 $('#volModalTitle').textContent=EXPO_UPCOMING.name;
 $('#volModalSub').textContent=`${hired} of ${need} helpers pledged`;
 $('#volBody').innerHTML=`
  <div class="modal-in rounded-[20px] border border-white/90 bg-white/85 p-4 shadow-sm backdrop-blur">
   <div class="flex items-center justify-between border-b border-[#123033]/[.07] pb-2">
    <span class="text-sm font-bold text-[#8f5420]">🌿 ${esc(EXPO_UPCOMING.venue)}</span>
    <span class="mono rounded-md tint hue-peach px-2 py-0.5 text-[10px] font-bold">${esc(EXPO_UPCOMING.id)}</span>
   </div>
   <div class="mt-2.5 text-[11px] font-bold text-[#33504f]">${expoLine()}</div>
   <p class="mt-2 text-[11px] leading-relaxed text-[#5b7178]">We need <b>${need} volunteers</b> to run the booths. Pledge now and pick where you would like to serve — registration opens two weeks before the day.</p>
   <div class="mt-3">
    <div class="flex items-baseline justify-between text-[10px] font-bold text-[#5b7178]"><span>Team pledged</span><span class="mono">${hired}/${need}</span></div>
    <div class="covbar mt-1.5"><i style="width:${Math.min(100,Math.round(hired/need*100))}%"></i></div>
   </div>
   <div class="mt-3 space-y-1.5">
    ${BOOTHS.filter(b=>helpersAt(b.k).length<b.cap).slice(0,4).map(b=>`
     <div class="flex items-center gap-2 text-[10px] font-bold text-[#5b7178]">
      <span class="boothpick-glyph hue-${b.hue}">${b.letter}</span>
      <span class="min-w-0 flex-1 truncate">${esc(b.label)}</span>
      <span class="mono text-rose-600">needs ${b.cap-helpersAt(b.k).length}</span></div>`).join('')}
   </div>
  </div>`;
}
export function pickAttendee(id){state.activeId=id;state.sugFor=null;state._goal=null;closeSwitcher();render();toast(`Now serving ${firstName(A().name)} · ${id}`);}
export function registerNew(){closeSwitcher();state.regOpen=true;switchTab('home');}
export function openWAFor(id){state.activeId=id;state.sugFor=null;state._goal=null;render();openWhatsApp();}
/* the paper-record readings that were taken, for the message the visitor keeps */
function paperLines(a){
 const s=a.s,out=[],p=pefPct(a);
 if(s.waist!=null)out.push(`Waist: ${s.waist} cm`);
 if(s.fat!=null)out.push(`Body fat: ${s.fat}%`);
 if(s.tbw!=null)out.push(`Body water: ${s.tbw}%`);
 if(s.pef!=null)out.push(`Lung function: ${s.pef}${p!=null?` (${p}% of the recommended ${s.pefExp})`:''}`);
 if(s.pulseRest!=null)out.push(`Pulse: ${s.pulseRest} resting${s.pulseEx!=null?`, ${s.pulseEx} after exercise`:''}${s.pulseRec!=null?`, ${s.pulseRec} after 3 min`:''}`);
 return out;
}
/* the scorecard-and-plan preview both sending ways share (the message that goes out is waMessage(a)) */
function waPreviewHTML(a){
 const ha=healthAge(a),{sys,dia}=simBP(a),proj=projection(a),P=planFor(a),pk=P.pk,p=P.p;
 return `<div class="modal-in rounded-[20px] rounded-tl-md border border-white/90 bg-white/85 p-4 shadow-sm backdrop-blur">
  <div class="flex items-center justify-between border-b border-[#123033]/[.07] pb-2">
   <span class="text-sm font-bold text-brand-800">🌿 Hi ${esc(firstName(a.name))}!</span>
   <span class="mono rounded-md tint px-2 py-0.5 text-[10px] font-bold">${esc(a.id)}</span>
  </div>
  <p class="mt-2.5 text-[11px] leading-relaxed text-[#5b7178]">Thank you for visiting the SDA Community Health Expo. Here is your personal <b class="text-[#33504f]">health scorecard & 90-day natural plan</b>${p.credit?`, written by ${esc(p.credit)}`:''}:</p>
  <div class="mono mt-3 space-y-1 rounded-[14px] border border-brand-200/60 bg-brand-50/70 p-3 text-[11px] font-semibold text-[#33504f]">
   <div>Blood pressure: ${a.s.sys??'—'}/${a.s.dia??'—'} → <b class="text-brand-800">${sys}/${dia} mmHg</b></div>
   <div>Blood sugar: ${a.s.sugar??'—'} mmol/L</div>
   <div>BMI: ${bmi(a)?fmt1(bmi(a)):'—'}</div>
   ${paperLines(a).map(l=>`<div>${esc(l)}</div>`).join('')}
   <div>Health age: ${ha.health!=null?fmt1(ha.health):'—'} → <b class="text-brand-800">${fmt1(proj.age)} yrs in 90 days</b></div>
  </div>
  <div class="mt-3"><div class="text-[10px] font-extrabold uppercase tracking-wider text-brand-900">Your plan: ${esc(P.goal)}</div>
   <p class="mt-1 text-[11px] font-bold leading-relaxed text-[#33504f]">${esc(P.problem)}</p>
   ${P.urgent?`<p class="mt-1.5 text-[11px] font-bold leading-relaxed text-rose-700">⚠ ${esc(P.urgent.t)}.</p>`:''}
   <ol class="mt-2 space-y-2 text-[11px] leading-relaxed text-[#5b7178]">
    ${P.top.map((x,i)=>`<li><b class="text-[#33504f]">${i+1}. ${esc(x.do)}</b><br>How: ${esc(x.how.join('; '))}.<br><i>Why: ${esc(x.why)}</i></li>`).join('')}
   </ol>
   <p class="mt-2 text-[11px] font-semibold leading-relaxed text-[#33504f]">📅 ${esc(P.recheck[0])}</p></div>
  ${p.items.length?`<div class="mt-3 rounded-[14px] border border-amber-200/70 bg-amber-50/80 p-2.5 text-[10px] leading-relaxed text-amber-900">
   <b>Shopping list (store prices checked ${PRICE_DATE}; may vary by branch):</b> ${p.items.map(it=>`${it.name} (${it.dose})`).join('; ')}.
   <br><b>Where to buy it cheapest:</b> ${p.items.map(it=>{const Pr=foodPriceOf(it.name);return Pr?`${esc(shortFood(it.name))} at ${Pr.parts.map(pp=>esc(pp.cheap)).join(' & ')}`:'';}).filter(Boolean).join(' · ')} —
  </div>`:''}
  ${p.help?`<p class="mt-2 text-[10px] font-bold leading-relaxed text-rose-700">${esc(p.help)}</p>`:''}
  <p class="mt-3 text-[10px] font-bold leading-relaxed text-[#6b8187]">Keep this: the church deletes your health readings ${GRACE_DAYS} days after your visit.</p>
  <p class="mt-2 text-[10px] leading-relaxed text-[#6b8187]">${esc(DISCLAIMER)} ${esc(PRECAUTIONS[5])}</p>
  <p class="mt-3 text-[10px] italic text-[#6b8187]">“Beloved, I pray that you may prosper in all things and be in health, just as your soul prospers.” — 3 John 1:2</p>
 </div>`;
}
function waFootHTML(kind){
 return kind==='mail'
  ?`<button data-action="closeWhatsApp" class="btn btn-glass flex-1 py-2.5 text-[11px] text-[#5b7178]">Back</button>
    <button data-action="sendEmail" class="btn btn-primary flex-1 py-2.5 text-[11px] text-white">Send by email →</button>`
  :`<button data-action="recycleBadge" class="btn btn-glass flex-1 py-2.5 text-[11px] text-[#5b7178]">Finish visit</button>
    <button data-action="sendWhatsApp" class="btn flex-1 py-2.5 text-[11px] text-white"
     style="background:linear-gradient(135deg,#25D366,#1aa851);box-shadow:0 12px 24px -14px rgba(37,211,102,.9)">Send in WhatsApp →</button>`;
}
export function openWhatsApp(){
 if(!attendees.length){toast('Register a visitor first');return;}
 /* an old visit's readings were deleted: the preview says so rather than showing numbers that are gone */
 const a=withoutOldReadings(A());
 $('#waSub').textContent='Message preview · opens in WhatsApp';
 $('#waBody').innerHTML=waPreviewHTML(a);
 $('#waFoot').innerHTML=waFootHTML('wa');
 showModal('#waModal');
}
/* the same plan by email: the body is exactly the message WhatsApp would send */
export function openEmail(){
 if(!attendees.length){toast('Register a visitor first');return;}
 const a=withoutOldReadings(A());
 $('#waSub').textContent='Message preview · opens in their email app';
 $('#waBody').innerHTML=waPreviewHTML(a)+`
  <div class="modal-in mt-3 rounded-[16px] border border-white/90 bg-white/85 p-3">
   <label class="microlabel" for="emTo">Send to</label>
   <input id="emTo" type="email" inputmode="email" autocomplete="off" value="${esc(a.email||'')}" placeholder="their email address" class="field mt-1">
   ${a.email?'':`<label class="mt-1.5 flex items-center gap-2 text-[10px] font-bold text-[#5b7178]"><input id="emSave" type="checkbox" checked class="h-3.5 w-3.5"> Save this email to ${esc(a.id)}</label>`}
  </div>`;
 $('#waFoot').innerHTML=waFootHTML('mail');
 showModal('#waModal');
}
export function closeWhatsApp(){hideModal('#waModal');}
/* WhatsApp wants digits only, with the country code. South African numbers are usually saved as 082 123 4567. */
export function waNumber(phone){
 let d=String(phone||'').replace(/\D/g,'');
 if(d.startsWith('00'))d=d.slice(2);
 else if(d.startsWith('0'))d='27'+d.slice(1);
 return d.length>=11&&d.length<=15?d:'';          /* "+27 —" (no number captured) leaves just "27" → not usable */
}
/* ---------- where to buy it cheapest (the value the visitor takes home) ---------- */
/* FOOD_PRICES holds the verified per-store prices; an item's daily cost is worked out at the typical
   (median) price, so the same data also gives the cheapest-store version of every cost. */
export const foodPriceOf=name=>FOOD_PRICES[foodKeyOf(name)]||null;
export function cheapDay(it){
 const P=foodPriceOf(it.name);
 return P?P.parts.reduce((t,p)=>t+p.min*p.qty,0):it.daily;
}
export function cheapLine(it){
 const name=`${it.name} (${it.dose})`,P=foodPriceOf(it.name);
 if(!P||!P.parts.length)return `• ${name}: no verified store price yet`;
 const where=P.parts.map(p=>`${p.label?`${p.label} cheapest at `:'cheapest at '}${p.cheap} (${money(p.min)} ${p.unit})${p.n<2?', only one price found':''}`).join(' · ');
 return `• ${name}: ${where}`;
}
/* the same content as the preview, as the plain text that gets sent */
export function waMessage(a){
 a=withoutOldReadings(a);
 const ha=healthAge(a),{sys,dia}=simBP(a),proj=projection(a),P=planFor(a),pk=P.pk,p=P.p;
 return [
  `🌿 Hi ${firstName(a.name)}! Thank you for visiting the SDA Community Health Expo. Here is your personal health scorecard and 90-day natural plan (badge ${a.id}):`,
  '',
  `• Blood pressure: ${a.s.sys??'—'}/${a.s.dia??'—'} → ${sys}/${dia} mmHg`,
  `• Blood sugar: ${a.s.sugar??'—'} mmol/L`,
  `• BMI: ${bmi(a)?fmt1(bmi(a)):'—'}`,
  ...paperLines(a).map(l=>'• '+l),
  `• Health age: ${ha.health!=null?fmt1(ha.health):'—'} → ${fmt1(proj.age)} yrs in 90 days`,
  '',
  `YOUR PLAN: ${P.goal.toUpperCase()}`,
  P.problem,
  ...(P.urgent?[`⚠ ${P.urgent.t}.`]:[]),
  '',
  ...P.top.flatMap((x,i)=>[`${i+1}. ${x.do}`,`   How: ${x.how.join('; ')}.`,`   Why: ${x.why}`,'']),
  `📅 ${P.recheck[0]}`,
  ...(a.interests&&a.interests.followUpName?[`🤝 ${a.interests.followUpName} from the church will follow up with you.`]:[]),
  ...(p.credit?[`This plan was written by ${p.credit}.`,'']:[]),
  ...(p.items.length?[`Food for this plan — what each item costs in the shops, cheapest first.`,
   '',
   `WHERE TO BUY IT CHEAPEST (store prices checked ${PRICE_DATE}):`,
   ...[...p.items].sort((x,y)=>cheapDay(x)-cheapDay(y)).map(cheapLine),
   '']:[]),
  ...(p.help?[p.help,'']:[]),
  `These are home remedies and healthy-living advice, not a replacement for your clinic. If you take blood-pressure or diabetes pills, do not stop them suddenly — your clinic will adjust the doses safely.`,
  `Keep this: the church deletes your health readings ${GRACE_DAYS} days after your visit.`,
  '',
  DISCLAIMER,
  'Warnings and precautions:',
  ...PRECAUTIONS.map(t=>`• ${t}`),
  '',
  `“Beloved, I pray that you may prosper in all things and be in health, just as your soul prospers.” — 3 John 1:2`,
 ].join('\n');
}
/* Opens WhatsApp with the message ready. Nothing is sent from here — the volunteer taps Send in WhatsApp. */
export function sendWhatsApp(){
 const a=attendees.find(x=>x.id===state.activeId);
 if(!a){toast('Select a visitor first');return;}
 const n=waNumber(a.phone),url=`https://wa.me/${n}?text=${encodeURIComponent(waMessage(a))}`;
 closeWhatsApp();
 if(IS_APP){sendWhatsAppInApp(n,waMessage(a));return;}
 toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');
 const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';
 document.body.appendChild(link);link.click();link.remove();
}
/* Android app: straight into the WhatsApp app with the message ready (it goes once the phone has signal). Without
   WhatsApp on the phone, the phone's own share sheet offers SMS, email and the rest. */
async function sendWhatsAppInApp(n,msg){
 const P=window.Capacitor.Plugins;
 let opened=false;
 try{const r=await P.AppLauncher.openUrl({url:`whatsapp://send?${n?`phone=${n}&`:''}text=${encodeURIComponent(msg)}`});opened=!!(r&&r.completed);}catch(e){}
 if(opened){toast(n?'Opening WhatsApp…':'No number saved for this visitor — choose the contact in WhatsApp');return;}
 toast('WhatsApp is not on this phone — choose another way to send');
 try{await P.Share.share({text:msg});}catch(e){}
}
/* ===== the same plan by email ===== */
/* The email app does the sending (nothing leaves this device from here), exactly like WhatsApp above:
   a mailto: link with the same plan text as the subject-line body. */
export function mailtoHref(a,to){
 return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`Your health scorecard & 90-day plan (badge ${a.id})`)}&body=${encodeURIComponent(waMessage(a))}`;
}
export function sendEmail(){
 const a=attendees.find(x=>x.id===state.activeId);
 if(!a){closeWhatsApp();return;}
 const input=$('#emTo'),to=String(input&&input.value||'').trim();
 if(!validEmail(to)){
  if(input){try{input.focus();}catch(e){}}
  toast('That email address does not look right — check it, or leave email out');return;
 }
 const save=$('#emSave');
 const saving=!!(save&&save.checked);
 if(saving){a.email=to;persist();}
 closeWhatsApp();
 if(IS_APP){sendEmailInApp(mailtoHref(a,to),waMessage(a),saving?a.id:'');return;}
 toast(saving?`Email saved to ${a.id} ✓ Opening the email app…`:'Opening the email app…');
 const link=document.createElement('a');link.href=mailtoHref(a,to);link.target='_blank';link.rel='noopener noreferrer';
 document.body.appendChild(link);link.click();link.remove();
}
/* Android app: into the phone's email app with the message ready; with no mail app installed,
   the share sheet takes it (it offers email, and everything else). */
async function sendEmailInApp(href,msg,savedTo){
 const P=window.Capacitor.Plugins;
 let opened=false;
 try{const r=await P.AppLauncher.openUrl({url:href});opened=!!(r&&r.completed);}catch(e){}
 if(opened){toast(savedTo?`Email saved to ${savedTo} ✓ Opening the email app…`:'Opening the email app…');return;}
 toast('No email app on this phone — the plan goes to the share sheet instead');
 try{await P.Share.share({text:msg});}catch(e){}
}
export function recycleBadge(){
 const a=attendees.find(x=>x.id===state.activeId);if(!a){closeWhatsApp();return;}
 a.done=true;closeWhatsApp();render();switchTab('home');
 toast(`${a.id} finished ✓ Ready for the next visitor`);
}

/* ================= A6 PRINT CARD ================= */
export function buildPrintCard(){
 const a=withoutOldReadings(A()),ha=healthAge(a),{sys,dia}=simBP(a),proj=projection(a),P=planFor(a),pk=P.pk,p=P.p;
 const date=new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
 /* An A6 card is small: the 3 actions with their first "how", food on one line, short book names. (The old card,
    with four long store lines, ran past the bottom edge and cut the safety note off.) */
 $('#printArea').innerHTML=`<div class="pc-card">
  <div class="pc-head">
   <div class="pc-head-row">
    <div><div class="pc-brand">Health Expo Passport</div><div class="pc-sub">SDA Community Health Expo</div>
     <div class="pc-name">${esc(a.name)}</div>
     <div class="pc-meta">${esc(a.id)} · ${a.age}y ${esc(a.sex)} · ${date}</div></div>
   </div>
  </div>
  <div class="pc-body">
   <div class="pc-sec-title">Your numbers today → 90-day goal</div>
   <div class="pc-grid4">
    <div class="pc-metric"><span class="pc-ml">Blood pressure</span><span class="pc-mv">${a.s.sys??'—'}/${a.s.dia??'—'} → ${sys}/${dia}</span></div>
    <div class="pc-metric"><span class="pc-ml">Blood sugar</span><span class="pc-mv">${a.s.sugar??'—'} mmol/L</span></div>
    <div class="pc-metric"><span class="pc-ml">BMI</span><span class="pc-mv">${bmi(a)?fmt1(bmi(a)):'—'}</span></div>
    <div class="pc-metric pc-hot"><span class="pc-ml">Health age</span><span class="pc-mv">${ha.health!=null?fmt1(ha.health):'—'} → ${fmt1(proj.age)}</span></div>
   </div>
   <div class="pc-sec-title">My plan: ${esc(P.goal)}</div>
   <div class="pc-problem">${esc(P.problem)}${P.urgent?` <b>${esc(P.urgent.t)}.</b>`:''}</div>
   <div>${P.top.map((x,i)=>`<div class="pc-habit"><span class="pc-box"></span><span><b>${i+1}. ${esc(x.do)}.</b> ${esc(x.how[0]||'')}.</span></div>`).join('')}</div>
   <div class="pc-line">📅 ${esc(P.recheck[0])}</div>
   ${a.interests&&a.interests.followUpName?`<div class="pc-line">🤝 Follow-up: ${esc(a.interests.followUpName)} from the church will be in touch.</div>`:''}
   ${p.help||!p.items.length?'':`<div class="pc-line">🛒 Shopping list (store prices checked ${PRICE_DATE}; may vary by branch): ${p.items.map(i=>esc(shortFood(i.name))).join(', ')}.</div>`}   <!-- plans with the crisis line need the room -->
   <div class="pc-foot">
    <div class="pc-safety">Not a replacement for your clinic: given by volunteers, not health professionals, as general information, not medical advice. <b>Never stop prescribed pills suddenly</b>; your clinic will adjust them. In an emergency, go to the nearest emergency unit.${p.help?` ${esc(p.help)}`:''} Your health readings are deleted ${GRACE_DAYS} days after your visit — keep this card.</div>
    <div class="pc-verse">“Beloved, I pray that you may prosper in all things and be in health.” — 3 John 1:2${p.credit?` · From: ${esc(p.credit)}`:''}</div>
    <div class="pc-bottom"><span>${a.interests.nurse?'☎ A nurse will call you within 48 hours':'Questions? Speak to the Health Ministries team'}</span><span>Badge ${esc(a.id)}</span></div>
   </div>
  </div>
 </div>`;
 fitPrintCard();
}
/* The card is a fixed A6 size and cuts off whatever does not fit, which would lose the safety note at the bottom.
   Measure it off-screen and step the text down a size (at most twice) until everything fits. */
function fitPrintCard(){
 const pa=$('#printArea'),c=pa&&pa.querySelector('.pc-card');if(!c)return;
 const old=pa.style.cssText;pa.style.cssText='display:block;position:fixed;left:-9999px;top:0';
 for(const cls of ['pc-fit1','pc-fit2']){if(c.scrollHeight<=c.clientHeight+1)break;c.classList.add(cls);}
 pa.style.cssText=old;
}
export function printCard(){
 if(!attendees.length){toast('Register a visitor first');return;}
 buildPrintCard();
 if(IS_APP){printCardInApp();return;}
 document.body.classList.add('print-mode');
 window.print();
}
/* Android app: the card (with only its own .pc-* styles) goes to the CardPrinter plugin, which prints it through the
   phone's print service on an A6 page. */
function printCardInApp(){
 const pa=$('#printArea');
 const css=[...(document.styleSheets||[])].flatMap(s=>{try{return [...(/** @type {CSSStyleSheet} */ (s)).cssRules];}catch(e){return [];}})
  .filter(r=>r instanceof CSSStyleRule&&r.selectorText.includes('.pc-')).map(r=>r.cssText).join('\n');
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:105mm 148mm;margin:0}html,body{margin:0;background:#fff}${css}</style></head><body>${pa.innerHTML}</body></html>`;
 const P=window.Capacitor.Plugins.CardPrinter;
 if(!P){toast('Printing is not available in this version of the app');return;}
 P.print({html,name:'Health Expo card '+A().id}).catch(e=>toast('Could not open printing: '+(e&&e.message||e)));
}
window.addEventListener('afterprint',()=>document.body.classList.remove('print-mode'));
