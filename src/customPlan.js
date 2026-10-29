// @ts-check
/* A plan written for one specific visitor (item 5), and the structured editor and JSON template that
   produce it (item 6). The shape is the one the plan card already renders — title, problem area, 3–8 things
   to do, each with do / why / how — so nothing here draws a plan; it only reads, validates and stores one.
   The plan lives at interests.customPlan on the visitor's record, exactly like interests.churchPlan, so the
   existing attendee sync carries it with no mapper change (D-04).

   Who may write it is decided in two places: canCustomPlan() in the screens, and the
   attendees_custom_plan_guard trigger in supabase/schema.sql. The second is the control; the first is a
   courtesy, because a client-only check is bypassable (R-04, D-05).

   Imported JSON is untrusted input (R-06): every field is type-checked, length-capped and escaped at render,
   and a file over 2 MB is refused before JSON.parse. */
import { A, $, esc, firstName } from './helpers.js';
import { PROTOCOLS, attendees, state } from './data.js';
import { cloud, persist } from './state.js';
import { renderMain, toast } from './shell.js';
import { confirmAsk } from './feedback.js';
import { IS_APP } from './platform.js';
import { canCustomPlan } from './account.js';

export const CUSTOM_MIN_ACTIONS=3, CUSTOM_MAX_ACTIONS=8, CUSTOM_MAX_BYTES=2*1024*1024;
const LIMITS={title:120,problem:60,do:140,why:240,howItem:200,note:600,by:80,how:400};
const TOP_KEYS=['title','problem','actions','note','by','at'];
const ACT_KEYS=['do','why','how'];

const clean=s=>String(s==null?'':s).replace(/\s+/g,' ').trim();
/* how may arrive as an array (the template) or as the editor's one-step-per-line textarea */
const lines=s=>(Array.isArray(s)?s:String(s||'').split('\n')).map(clean).filter(Boolean);

/** A blank plan with the three required slots filled in for the editor. */
export function blankCustomPlan(){
 return {title:'',problem:'',actions:Array.from({length:CUSTOM_MIN_ACTIONS},()=>({do:'',why:'',how:[]})),note:'',by:'',at:''};
}

/**
 * Trims, length-caps and validates a plan. Returns the plan it will store; throws an Error whose message is
 * safe to show in a toast when the input is not a plan. Unknown keys are refused rather than silently kept, so
 * a mistyped template cannot smuggle data into the record.
 * @param {any} raw
 */
export function normaliseCustomPlan(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('The plan must be a JSON object.');
 const unknown=Object.keys(raw).filter(k=>!TOP_KEYS.includes(k));
 if(unknown.length)throw new Error(`Unknown field “${unknown[0]}”. A plan has title, problem, actions, note and by.`);
 const title=clean(raw.title);
 if(title.length<2)throw new Error('Give the plan a title.');
 if(title.length>LIMITS.title)throw new Error(`The title is longer than ${LIMITS.title} characters.`);
 const problem=clean(raw.problem);
 if(problem.length<2)throw new Error('Name the problem this plan is for.');
 if(problem.length>LIMITS.problem)throw new Error(`The problem is longer than ${LIMITS.problem} characters.`);
 if(!Array.isArray(raw.actions))throw new Error('The plan needs a list of things to do.');
 if(raw.actions.length<CUSTOM_MIN_ACTIONS)throw new Error(`Add at least ${CUSTOM_MIN_ACTIONS} things to do.`);
 if(raw.actions.length>CUSTOM_MAX_ACTIONS)throw new Error(`A plan can have at most ${CUSTOM_MAX_ACTIONS} things to do.`);
 const actions=raw.actions.map((x,i)=>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw new Error(`Thing to do ${i+1} is not an object.`);
  const bad=Object.keys(x).filter(k=>!ACT_KEYS.includes(k));
  if(bad.length)throw new Error(`Thing to do ${i+1} has an unknown field “${bad[0]}”.`);
  const what=clean(x.do);
  if(!what)throw new Error(`Thing to do ${i+1} needs a short instruction.`);
  if(what.length>LIMITS.do)throw new Error(`Thing to do ${i+1} is longer than ${LIMITS.do} characters.`);
  const why=clean(x.why);
  if(why.length>LIMITS.why)throw new Error(`The reason for thing to do ${i+1} is longer than ${LIMITS.why} characters.`);
  const how=lines(x.how);
  if(how.reduce((n,h)=>n+h.length,0)>LIMITS.how)throw new Error(`The how for thing to do ${i+1} is longer than ${LIMITS.how} characters.`);
  return {do:what,why,how:how.map(h=>h.slice(0,LIMITS.howItem))};
 });
 const note=clean(raw.note);
 if(note.length>LIMITS.note)throw new Error(`The safety note is longer than ${LIMITS.note} characters.`);
 return {title,problem,actions,note,by:clean(raw.by).slice(0,LIMITS.by),
  at:clean(raw.at).slice(0,40)||new Date().toISOString()};
}

/**
 * Reads the app's own JSON template. Never throws: the caller gets a message it can show.
 * @param {string} text
 * @returns {{ok:boolean, plan?:any, error?:string}}
 */
export function parseCustomPlanFile(text){
 const s=String(text==null?'':text);
 if(s.length>CUSTOM_MAX_BYTES)return {ok:false,error:'That file is too big (the limit is 2 MB).'};
 let raw;
 try{raw=JSON.parse(s);}catch(e){return {ok:false,error:'That file is not valid JSON.'};}
 try{return {ok:true,plan:normaliseCustomPlan(raw)};}catch(e){return {ok:false,error:(e&&e.message)||'That file is not a plan template.'};}
}

/* The one example the template download writes; parseCustomPlanFile accepts it back unchanged. */
function templatePlan(){
 return {title:'Easing stiff, painful joints',problem:'Joint pain',
  actions:[
   {do:'Move every joint gently each morning',why:'Gentle movement keeps joints from stiffening.',
    how:['5 minutes of slow stretches after you get up','Stop if a joint is hot or swollen']},
   {do:'Use a warm, never hot, compress on stiff joints',why:'Warmth eases stiffness.',
    how:['A warm, wet towel on the joint for 10 minutes','Test the heat on your wrist first']},
   {do:'Walk a little every day',why:'Walking keeps the muscles round the joints strong.',
    how:['Start with 10 minutes on flat ground']}],
  note:'',by:'',at:''};
}

/* The editor. It is a card on the Plan screen, not a new modal: the app already has one confirmation sheet
   and no other modal machinery for a long form (the church plan editor is a card too). */
export function customPlanHTML(a){
 const cp=a&&a.interests&&a.interests.customPlan;
 const p=cp&&typeof cp==='object'?cp:blankCustomPlan();
 const acts=Array.isArray(p.actions)?p.actions:[];
 const keys=Object.keys(PROTOCOLS),own=!keys.includes(p.problem);
 const field=(id,ph,v,max)=>`<input id="${id}" value="${esc(v||'')}" placeholder="${ph}" maxlength="${max}" class="field mt-1.5 text-xs">`;
 const slot=i=>{const x=acts[i]||{};
  return `<div class="rounded-[14px] border border-[#123033]/[.07] p-2.5">
   <div class="microlabel">Thing to do ${i+1}${i<CUSTOM_MIN_ACTIONS?' (required)':' (optional)'}</div>
   ${field('cpxDo'+i,'What to do',x.do,LIMITS.do)}${field('cpxWhy'+i,'Why it helps',x.why,LIMITS.why)}
   <textarea id="cpxHow${i}" rows="2" maxlength="${LIMITS.how}" placeholder="How: one step per line" class="field mt-1.5 text-xs">${esc(lines(x.how).join('\n'))}</textarea>
  </div>`;};
 return `<form data-action="customPlanSave" class="mt-3 space-y-2.5">
  <label class="block"><span class="microlabel">Title</span>${field('cpxTitle','e.g. Easing stiff, painful joints',p.title,LIMITS.title)}</label>
  <label class="block"><span class="microlabel">Problem area</span>
   <select id="cpxProblem" class="field mt-1 text-xs">${keys.map(k=>`<option value="${k}" ${k===p.problem?'selected':''}>${esc(PROTOCOLS[k].tag)}</option>`).join('')}<option value="own" ${own?'selected':''}>Another problem (type it below)</option></select></label>
  ${field('cpxOwn','Another problem, e.g. Joint pain',own?p.problem:'',LIMITS.problem)}
  ${Array.from({length:CUSTOM_MAX_ACTIONS},(_,i)=>slot(i)).join('')}
  <label class="block"><span class="microlabel">Safety note (optional)</span><textarea id="cpxNote" rows="2" maxlength="${LIMITS.note}" class="field mt-1 text-xs">${esc(p.note||'')}</textarea></label>
  <div class="btn-row">
   <button class="btn btn-primary flex-1 py-2.5 text-xs">Save custom plan</button>
   <button type="button" class="btn btn-glass flex-1 py-2.5 text-xs" data-action="customPlanEdit">Cancel</button>
  </div>
 </form>
 <div class="mt-3 rounded-[14px] border border-[#123033]/[.07] p-2.5">
  <div class="microlabel">Or import a completed template</div>
  <input type="file" accept="application/json,.json" class="field mt-1.5 text-xs" data-on-change="customPlanImport">
  <div class="btn-row mt-2"><button type="button" class="btn btn-glass py-2 text-[11px]" data-action="customPlanTemplate">Download template</button></div>
 </div>`;
}

/** The Plan screen's custom-plan controls; empty for anyone who may not write one (D-05, CHANGE 16). */
export function customPlanBox(a){
 if(!a||!canCustomPlan())return '';
 const cp=a.interests&&a.interests.customPlan;
 if(state.customEdit)return customPlanHTML(a);
 if(cp)return `<div class="btn-row mt-2">
  <button class="btn btn-glass py-2 text-[11px]" data-action="customPlanEdit">Edit custom plan</button>
  <button class="btn btn-glass py-2 text-[11px] text-rose-700" data-action="customPlanClear">Remove custom plan</button></div>`;
 return `<button class="btn btn-glass mt-2 w-full py-2 text-[11px]" data-action="customPlanEdit">+ Write a custom plan for this visitor</button>`;
}

const churchLabel=()=>cloud.acct&&cloud.acct.church&&cloud.acct.church.name?cloud.acct.church.name:'your church';
const holder=()=>{const a=A();return a&&attendees.some(x=>x.id===a.id)?a:null;};

export function customPlanEdit(){
 if(!canCustomPlan()){toast('Only a church admin or the app owner can write a custom plan.');return;}
 state.customEdit=!state.customEdit;renderMain();
}

/** Saves the structured editor. The form's fields are read from the page, normalised, then stored on the record. */
export function customPlanSave(e){
 if(e)e.preventDefault();
 if(!canCustomPlan()){toast('Only a church admin or the app owner can write a custom plan.');return;}
 const a=holder();if(!a){renderMain();return;}
 const v=id=>{const el=/** @type {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|null} */ ($('#'+id));return el?String(el.value||'').trim():'';};
 const chosen=v('cpxProblem'),own=v('cpxOwn');
 const actions=[];
 for(let i=0;i<CUSTOM_MAX_ACTIONS;i++){
  const what=v('cpxDo'+i);if(!what)continue;
  actions.push({do:what,why:v('cpxWhy'+i),how:v('cpxHow'+i).split('\n').map(h=>h.trim()).filter(Boolean)});
 }
 try{
  const plan=normaliseCustomPlan({title:v('cpxTitle'),problem:chosen==='own'?own:chosen,actions,
   note:v('cpxNote'),by:churchLabel(),at:new Date().toISOString()});
  a.interests=a.interests||{};
  a.interests.customPlan=plan;
  persist();state.customEdit=false;renderMain();
  toast(`Custom plan saved for ${firstName(a.name)} ✓`);
 }catch(err){toast((err&&err.message)||'Check the plan fields.');}
}

/** Imports the downloaded JSON template from the phone's file picker. */
export function customPlanImport(el){
 if(!canCustomPlan())return;
 const f=el&&el.files&&el.files[0];
 if(!f){toast('Choose a JSON file first');return;}
 if(f.size>CUSTOM_MAX_BYTES){toast('That file is too big (the limit is 2 MB).');return;}
 if(typeof FileReader==='undefined'){toast('This device cannot read a file here.');return;}
 const r=new FileReader();
 r.onload=()=>{
  const out=parseCustomPlanFile(String(r.result||''));
  if(!out.ok){toast(out.error);return;}
  const a=holder();if(!a){toast('Choose a visitor first');return;}
  if(!out.plan.by)out.plan.by=churchLabel();
  a.interests=a.interests||{};
  a.interests.customPlan=out.plan;
  persist();state.customEdit=false;renderMain();
  toast(`Custom plan imported for ${firstName(a.name)} ✓`);
 };
 r.onerror=()=>toast('Could not read that file.');
 r.readAsText(f);
}

/** Removes the override, so the visitor goes back to the church or generated plan. */
export async function customPlanClear(){
 if(!canCustomPlan())return;
 const a=holder();if(!a)return;
 if(!(a.interests&&a.interests.customPlan))return;
 const yes=await confirmAsk({title:'Remove this custom plan?',
  body:'The visitor goes back to their church’s plan, or to the app’s generated one. This cannot be undone from here.',
  label:'Remove',danger:true});
 if(!yes)return;
 delete a.interests.customPlan;
 persist();renderMain();
 toast('Custom plan removed — back to the usual plan');
}

/** Downloads exactly the JSON parseCustomPlanFile() accepts (D-11), in the style of downloadCSV(). */
export function customPlanTemplate(){
 const text=JSON.stringify(templatePlan(),null,2),filename='newstart-custom-plan.json';
 if(IS_APP){
  const P=window.Capacitor.Plugins.CardPrinter;
  if(!P||!P.saveDownload){toast('Saving files needs the latest version of the app');return;}
  P.saveDownload({name:filename,text,mime:'application/json'})
   .then(r=>toast(`Template saved in ${r&&r.where||'Downloads'} as ${filename}.`))
   .catch(e=>toast('Could not save the file: '+(e&&e.message||e)));
  return;
 }
 toast('Template downloaded ✓ Fill it in, then import it on this screen.');
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=filename;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
