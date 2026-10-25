# Plan: church-written plans for any problem, sent to a church's own visitors

**Status: plan only, nothing applied.** Every number was measured, and `gate pre` re-checks it before anything changes.

<!-- Fields with "=" inside double braces are filled by render-plan.js from tool output. The other double-brace fields are
     prose you write from this session's tool output. `render-plan.js <project> --check` must PASS before reporting. -->

## 1. Goal
Today a church can only use the app's nine plans. After the plan, a church's admins write their own plans (for one of the nine problems or their own, such as joint pain) on the Church screen; its staff send one to a visitor from the Plan tab; the visitor sees it, and gets it on WhatsApp and the printed card, labelled as the church's own with the app's safety rules. The database keeps the plans per church: only that church's staff and admins read them, only admins write them. Measured on copies with the database checks on: tests before 656 pass / 0 fail, after 680 pass / 0 fail.

| # | Problem (exact test name or symptom) | Cause (file:line from an anchor) | Kind | Fix |
|---|---|---|---|---|
| F1 | No church-written plans | plans are fixed in `index.html` (`planFor`, `viewPlan`); the Church screen is `churchAdminHTML`; no table in `supabase/schema.sql` | Real bug / Stale test / Decision: admins write, staff send, the volunteer chooses church or app plan per visitor (your answers) | B1–B8 app; S1–S2 database; T1–T6 tests; V1 PLANS.md |

Out of scope, unchanged before and after: none.

## 2. Scope
- **Edited:** `index.html`, `supabase/schema.sql`, `.smoke/harness.js`, `PLANS.md`, changed only by `node fix-plan-church-plans/apply.js .`
- **Generated:** `dist/index.html`, `dist/sw.js`, changed only by `node tools/build.js`
- **Everything else:** 134 files stay byte-identical. No file is added or deleted.
- **Invariants:** the nine built-in plans and actions, the red-flag rule, the help line, the sync merge/upload code, the visitor row mapping (the choice rides inside interests), and the churches and memberships tables stay byte-identical.

## 3. Hard rules (any violation = the plan FAILS)
1. **Fail closed.** Any `[FAIL]`, crash or timeout fails the plan. Never edit the gate, `config.js` or `expected.json`
   to get past one. Restore the backups and report.
2. **No hand edits.** Only `apply.js` changes edited files: each edit is applied exactly once, or nothing is written.
3. **No weakened tests.** Changed files must be byte-identical to the dry run. No test may be renamed, dropped, skipped
   or made always-true. The gate breaks the fixed code in 9 way(s), and each must be caught.
4. **Zero hallucination.** Report only what the gate or a tool printed. Write "not run" or "not measured" for
   anything else.
5. **Pinned tooling.**
   - `fix-plan-church-plans/gate.js` sha256 `61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587`
   - `fix-plan-church-plans/expected.json` sha256 `b99b30ecc1cf82fd1df35e7baf196b7a50d8681cc9ea6e684c113f799ba923e5`

   The gate pins the other files itself.
6. **Real run only.** The final `RESULT:` lines must not contain `DRY-RUN`.

## 4. Before execution: scope analysis
Read-only. Check the pins, run `node fix-plan-church-plans/scope-report.js` (required: `SCOPE VERDICT: READY`), read sections 1–2
and 6 and `fix-plan-church-plans/edits.js`, and grep the callers and tests of each edit site.

Present it under four headings, citing `file:line`:
- **Scope covered:** 6 file(s) change (`.smoke/harness.js`, `PLANS.md`, `dist/index.html`, `dist/sw.js`, `index.html`, `supabase/schema.sql`) and 134 stay identical.
- **What it entails.**
- **What is in it.**
- **How it connects with the plan:** each edit → its goal → the tests that must pass → its mutations.

**Stop and ask** if:
- the verdict isn't READY;
- an edit or goal isn't linked;
- the code doesn't match this plan;
- this document and `edits.js` disagree;
- the change affects something not mentioned here.

Otherwise, continue to section 5 without waiting. ALREADY APPLIED: run `gate.js post` and report; don't re-apply.

## 5. Steps (from `C:\Users\fanel\Downloads\Health Expo`)
```bash
sha256sum fix-plan-church-plans/gate.js fix-plan-church-plans/expected.json   # must match rule 5
node fix-plan-church-plans/gate.js pre     # required: RESULT: PASS (27/27 checks passed, mode=pre); writes backups
node fix-plan-church-plans/apply.js .      # required: applied 17 edits to 4 files
node tools/build.js    # regenerate
node fix-plan-church-plans/gate.js post    # required: RESULT: PASS (38/38 checks passed, mode=post)
```
**On any other output:**
1. Copy each edited file back from `%TEMP%/fix-plan-backup` (`/` in the path is written as `__`).
2. Regenerate.
3. Report FAILED, quoting the `[FAIL]` lines.

What the gate checks (each check's result is in the report JSON it prints):
- **pre:** tooling hashes, a byte-identical baseline, anchors, line endings, invariants, the recorded test results, and
  verified backups.
- **post:**
  - only the planned files changed, each byte-identical to the dry run, with the rest unchanged;
  - invariants and extra checks;
  - fresh regeneration;
  - test tallies, names and statuses;
  - every mutation caught.

After the first FAIL, the gate skips the slow steps (`[SKIP]`), because the RESULT is FAIL anyway.

## 6. The exact change (ground truth: `fix-plan-church-plans/edits.js`)
### B1 church plan functions  (`index.html`, serves F1, F2)

Why: planCredit honours a church credit; adds the church plan list (demo, cached, loaded), the chosen plan, its planFor-shaped view, the Plan-tab picker and view, and the Church-screen editor

Find (exactly once):

```html
const planCredit=p=>planBooks(p).join('; ');
```

Replace with:

```html
const planCredit=p=>p.credit||planBooks(p).join('; ');

/* ================= CHURCH PLANS =================
   A church's own home plans, for one of the nine problems or one of its own (e.g. "Joint pain"). Its admins write
   them on the Church screen; its staff send one to a visitor from the Plan tab, and the visitor's record keeps the
   plan's id in interests.churchPlan (so it syncs with the rest of the record). A church plan is always shown as the
   church's own, never as the app's, and the app's safety rules (red-range warning, keep taking your pills, the help
   line for sleep and stress) always come with it. In practice mode DEMO_CHURCH_PLANS stand in. */
const CHURCH_PLANS_KEY='newstart.churchplans.v1';
const DEMO_CHURCH_PLANS=[
 {id:'demo-joints',church_id:'demo',problem:'Joint pain',title:'Easing stiff, painful joints',
  note:'This is an example from a practice church. Real plans are written by your church’s admin.',
  actions:[{do:'Move every joint gently each morning',why:'Gentle movement keeps joints from stiffening.',how:['5 minutes of slow stretches after you get up','Stop if a joint is hot or swollen']},
   {do:'Use a warm, never hot, compress on stiff joints',why:'Warmth eases stiffness.',how:['A warm, wet towel on the joint for 10 minutes','Test the heat on your wrist first']},
   {do:'Walk a little every day',why:'Walking keeps the muscles round the joints strong.',how:['Start with 10 minutes on flat ground']},
   {do:'See the clinic if a joint is red, hot or swollen',why:'That needs a check, not only home care.',how:['Ask the triage nurse today']}]},
 {id:'demo-bp',church_id:'demo',problem:'bp',title:'Our church’s blood-pressure walking club',
  note:'This is an example from a practice church.',
  actions:[{do:'Join the Sunday walking group',why:'Walking with others keeps you going.',how:['Meet at the church gate at 07:00 on Sundays']},
   {do:'Cut right down on salt',why:'Less salt helps blood pressure come down.',how:['No salt at the table']},
   {do:'Have your blood pressure checked at church each month',why:'Seeing the numbers keeps you on track.',how:['At the health desk after the service']}]}];
const inPractice=()=>!cloud.mode&&!cloud.user;
const myChurchId=()=>cloud.acct&&cloud.acct.church?cloud.acct.church.id:'';
const churchNameOf=cp=>cp.church_id==='demo'?'Practice church':(cloud.acct&&cloud.acct.church&&cloud.acct.church.id===cp.church_id?cloud.acct.church.name:'your church');
const churchPlanLabel=cp=>PROTOCOLS[cp.problem]?PROTOCOLS[cp.problem].tag:cp.problem;
const cleanHow=x=>(Array.isArray(x.how)?x.how:String(x.how||'').split('\n')).map(h=>String(h).trim()).filter(Boolean);
/* the plans this device can send: the demo set in practice mode, otherwise the signed-in church's (cached for offline) */
function churchPlanList(){
 if(inPractice())return DEMO_CHURCH_PLANS;
 if(!cloud.plans){try{const s=JSON.parse(localStorage.getItem(CHURCH_PLANS_KEY)||'null');if(s&&Array.isArray(s.list))cloud.plans=s;}catch(e){}}
 const cid=myChurchId();
 if(cid&&cloud.client&&(!cloud.plans||cloud.plans.cid!==cid)&&cloud.plansBusy!==cid)loadChurchPlans(cid);
 return cloud.plans&&(!cid||cloud.plans.cid===cid)?cloud.plans.list:[];
}
/* `key` keeps the platform admin's view of another church apart from this device's own church */
async function loadChurchPlans(cid,key){
 key=key||'plans';
 if(!cid||!cloud.client)return;
 if(key==='plans')cloud.plansBusy=cid;
 let r;try{r=await cloud.client.rpc('church_plans',{p_church:cid});}catch(e){r={error:e};}
 if(key==='plans')cloud.plansBusy='';
 const list=!r.error&&Array.isArray(r.data)?r.data:null;
 if(!list&&cloud[key]&&cloud[key].cid===cid)return;      /* offline or an older database: keep what we have */
 cloud[key]={cid,list:list||[]};
 if(key==='plans'&&list){try{localStorage.setItem(CHURCH_PLANS_KEY,JSON.stringify(cloud.plans));}catch(e){}}
 if(state.tab==='plan'&&A())renderMain();
 renderAcct();
}
function chosenChurchPlan(a){
 const id=a&&a.interests&&a.interests.churchPlan;
 return id?churchPlanList().find(p=>p.id===id)||null:null;
}
/* a church plan in the same shape as planFor(), so the WhatsApp message and the card carry it unchanged */
function churchPlanFor(a,cp){
 const base=PROTOCOLS[cp.problem]?cp.problem:autoProtocol(a),name=churchNameOf(cp);
 const list=(cp.actions||[]).map(x=>({do:String(x.do||''),why:String(x.why||''),how:cleanHow(x),ref:'',cost:0}));
 const p={tag:churchPlanLabel(cp),title:cp.title,credit:name,src:'its own plan, not reviewed by the app',steps:[],facts:[],items:[],
  habits:list.slice(0,3).map(x=>x.do),note:cp.note||'',help:['sleep','mind'].includes(cp.problem)?HELP_LINE:'',hydro:null};
 return {pk:base,church:cp,p,goal:cp.title,problem:PROTOCOLS[cp.problem]?problemOf(a,cp.problem):`A plan from ${name} for: ${cp.problem}.`,
  urgent:urgentOf(a,base),top:list.slice(0,3),more:list.slice(3),recheck:['Check in with your church’s health team in 3 weeks.','']};
}
function chooseChurchPlan(id){
 const a=A();if(!a)return;
 a.interests=a.interests||{};
 if(id)a.interests.churchPlan=id;else delete a.interests.churchPlan;
 persist();renderMain();
 toast(id?`Church plan chosen for ${firstName(a.name)} ✓`:'Back to the app’s plan');
}
/* on the app's plan: the church's plans, the ones for today's readings first */
function churchPlanPicker(a){
 const L=churchPlanList();if(!L.length)return '';
 const needs=new Set(planNeeds(a).map(n=>n.k));
 const sorted=[...L].sort((x,y)=>(needs.has(y.problem)-needs.has(x.problem))||String(x.title).localeCompare(String(y.title)));
 return `<details class="pl-switch"><summary>Send a plan from ${esc(churchNameOf(sorted[0]))} ▾</summary>
  <div class="mt-2 grid gap-2">${sorted.map(cp=>`<button onclick="chooseChurchPlan('${qSafe(cp.id)}')" class="btn btn-glass py-2.5 text-left text-[11px]"><b>${esc(cp.title)}</b> · ${esc(churchPlanLabel(cp))}${needs.has(cp.problem)?' · fits today’s readings':''}</button>`).join('')}</div>
 </details>`;
}
function viewChurchPlan(a,cp){
 const P=churchPlanFor(a,cp),p=P.p,first=esc(firstName(a.name)),hue='sage';
 const card=(x,i)=>`<li class="ac-card hue-${hue}">
   <div class="ac-top"><span class="ac-n">${i+1}</span><div class="ac-do">${esc(x.do)}</div></div>
   ${x.why?`<p class="ac-why"><b>Why</b>${esc(x.why)}</p>`:''}
   ${x.how.length?`<div class="ac-how"><b>How</b><ul>${x.how.map(h=>`<li>${esc(h)}</li>`).join('')}</ul></div>`:''}
  </li>`;
 return `<section class="stagger space-y-3.5">
  <div class="glass hue-tint hue-${hue} p-4">
   <div class="microlabel">${first}’s plan · from ${esc(p.credit)}</div>
   <div class="display mt-0.5 text-[19px] leading-tight font-extrabold text-[#0f2a2c]">${esc(P.goal)}</div>
   <p class="pl-problem">${esc(P.problem)}</p>
   <p class="mt-2 text-[11px] leading-snug text-[#4f6870]">Written by ${esc(p.credit)} for ${esc(p.tag)}: the church’s own plan, not reviewed by the app.</p>
   <button class="tap-link mt-1" onclick="chooseChurchPlan('')">Use the app’s plan instead</button>
  </div>

  ${P.urgent?`<div class="pl-urgent" role="alert"><b>⚠ ${esc(P.urgent.t)}</b><span>${esc(P.urgent.w)}</span></div>`:''}

  <div>
   <div class="pl-h">Do ${P.top.length===1?'this':`these ${P.top.length} things`}</div>
   <ol class="ac-list">${P.top.map(card).join('')}</ol>
  </div>

  ${P.more.length?`<div class="glass p-4">
   <div class="microlabel">When these feel easy, add</div>
   <ul class="pl-more">${P.more.map(x=>`<li><b>${esc(x.do)}</b><span>${esc(x.why)}</span></li>`).join('')}</ul>
  </div>`:''}

  <div class="glass p-4">
   <div class="pl-row"><span class="pl-ic" aria-hidden="true">📅</span><div><b>Check again</b><span>${esc(P.recheck[0])}</span></div></div>
   <div class="pl-row"><span class="pl-ic" aria-hidden="true">💊</span><div><b>Keep taking your pills</b><span>Never stop prescribed pills suddenly; your clinic will adjust them. This plan is healthy-living advice, not a replacement for the clinic.${p.note?` ${esc(p.note)}`:''}</span></div></div>
  </div>
  ${p.help?`<div class="pl-urgent"><b>Need help now?</b><span>${esc(p.help)}</span></div>`:''}
 </section>`;
}

/* --- the Church screen: writing the church's plans (admins) --- */
const CP_SLOTS=5;            /* things to do shown in the form; a plan may hold up to 8 */
function churchPlansBox(cid){
 const own=cid===myChurchId(),key=own?'plans':'adminPlans',S=cloud[key];
 if(!S||S.cid!==cid){if(!(own&&cloud.plansBusy===cid))loadChurchPlans(cid,key);return acctNote('Loading…');}
 const ed=cloud.planEdit&&cloud.planEdit.cid===cid?cloud.planEdit:null;
 return (S.list.length?S.list.map(cp=>`<div class="border-t border-[#123033]/[.07] py-2.5"><div class="flex items-center gap-2">
   <div class="min-w-0 flex-1"><div class="truncate text-[13px] font-bold text-[#123033]">${esc(cp.title)}</div>
    <div class="truncate text-[11px] text-[#4f6870]">${esc(churchPlanLabel(cp))} · ${nOf((cp.actions||[]).length,'thing')} to do</div></div>
   <button class="tap-link" onclick="editChurchPlan('${qSafe(cid)}','${qSafe(cp.id)}')">Edit</button>
   <button class="tap-link text-rose-700" onclick="deleteChurchPlan('${qSafe(cid)}','${qSafe(cp.id)}')">Delete</button></div></div>`).join('')
   :acctNote('No church plans yet.'))
  +(ed?churchPlanForm(cid,ed):`<button class="btn btn-primary mt-3 w-full py-2.5 text-xs" onclick="editChurchPlan('${qSafe(cid)}','')">+ Write a new plan</button>`)
  +acctNote('Your staff can send these plans to visitors from the Plan tab. They show as your church’s own plan, together with the app’s safety rules. Write them in your own words; do not copy from books.');
}
function churchPlanForm(cid,ed){
 const keys=Object.keys(PROTOCOLS),own=!keys.includes(ed.problem),acts=ed.actions||[];
 const slots=Math.min(8,Math.max(CP_SLOTS,acts.length));
 const field=(id,ph,v,max)=>`<input id="${id}" value="${esc(v||'')}" placeholder="${ph}" maxlength="${max}" class="field mt-1.5 text-xs">`;
 return `<form onsubmit="saveChurchPlan(event,'${qSafe(cid)}')" class="mt-3 space-y-2.5">
  <label class="block"><span class="microlabel">Problem</span>
   <select id="cpProblem" class="field mt-1 text-xs">${keys.map(k=>`<option value="${k}" ${k===ed.problem?'selected':''}>${PROTOCOLS[k].tag}</option>`).join('')}<option value="own" ${own?'selected':''}>Another problem (type it below)</option></select></label>
  ${field('cpOwn','Another problem, e.g. Joint pain',own?ed.problem:'',60)}
  <label class="block"><span class="microlabel">Title</span>${field('cpTitle','e.g. Easing stiff, painful joints',ed.title,120)}</label>
  ${Array.from({length:slots},(_,i)=>{const x=acts[i]||{};return `<div class="rounded-[14px] border border-[#123033]/[.07] p-2.5"><div class="microlabel">Thing to do ${i+1}${i?' (optional)':''}</div>
   ${field('cpDo'+i,'What to do',x.do,140)}${field('cpWhy'+i,'Why it helps',x.why,240)}
   <textarea id="cpHow${i}" rows="2" maxlength="400" placeholder="How: one step per line" class="field mt-1.5 text-xs">${esc(cleanHow(x).join('\n'))}</textarea></div>`;}).join('')}
  <label class="block"><span class="microlabel">Safety note (optional)</span><textarea id="cpNote" rows="2" maxlength="600" class="field mt-1 text-xs">${esc(ed.note||'')}</textarea></label>
  <div class="flex gap-2"><button id="cpGo" class="btn btn-primary flex-1 py-2.5 text-xs">Save plan</button>
   <button type="button" class="btn btn-glass flex-1 py-2.5 text-xs" onclick="cloud.planEdit=null;renderAcct()">Cancel</button></div>
 </form>`;
}
function editChurchPlan(cid,id){
 const S=cloud[cid===myChurchId()?'plans':'adminPlans'],cp=id&&S?S.list.find(p=>p.id===id):null;
 cloud.planEdit=cp?{...cp,cid}:{cid,id:null,problem:'bp',title:'',actions:[],note:''};
 renderAcct();
}
async function saveChurchPlan(e,cid){
 e.preventDefault();
 const v=id=>(($('#'+id)||{}).value||'').trim(),ed=cloud.planEdit||{};
 const problem=v('cpProblem')==='own'?v('cpOwn'):v('cpProblem');
 const actions=[];
 for(let i=0;i<8;i++){const d=v('cpDo'+i);if(d)actions.push({do:d,why:v('cpWhy'+i),how:v('cpHow'+i).split('\n').map(h=>h.trim()).filter(Boolean)});}
 if(!problem){toast('Choose the problem this plan is for.');return;}
 if(!actions.length){toast('Add at least one thing to do.');return;}
 const r=await acctRpc('save_church_plan',{p_church:cid,p_id:ed.id||null,p_problem:problem,p_title:v('cpTitle'),p_actions:actions,p_note:v('cpNote')},'Plan saved ✓');
 if(!r)return;
 cloud.planEdit=null;
 await loadChurchPlans(cid,cid===myChurchId()?'plans':'adminPlans');
}
async function deleteChurchPlan(cid,id){
 const S=cloud[cid===myChurchId()?'plans':'adminPlans'],cp=S&&S.list.find(p=>p.id===id);
 if(!confirm(`Delete the plan “${cp?cp.title:''}”? Visitors it was sent to go back to the app’s plan.`))return;
 if(await acctRpc('delete_church_plan',{p_id:id},'Plan deleted'))await loadChurchPlans(cid,cid===myChurchId()?'plans':'adminPlans');
}
```

### B2  (`index.html`, serves F1)

Why: planFor() without a plan key returns the visitor's chosen church plan, so the message and card carry it

Find (exactly once):

```html
 pk=pk||pkOf(a);
```

Replace with:

```html
 if(!pk){const cp=chosenChurchPlan(a);if(cp)return churchPlanFor(a,cp);}
 pk=pk||pkOf(a);
```

### B3  (`index.html`, serves F1)

Why: the Plan tab shows the chosen church plan in place of the app's plan

Find (exactly once):

```html
 if(state.sugFor!==a.id||state.sugVal!==sug){state.protocol=sug;state.sugFor=a.id;state.sugVal=sug;}
 const P=planFor(a,state.protocol)
```

Replace with:

```html
 if(state.sugFor!==a.id||state.sugVal!==sug){state.protocol=sug;state.sugFor=a.id;state.sugVal=sug;}
 const cp=chosenChurchPlan(a);if(cp)return viewChurchPlan(a,cp);
 const P=planFor(a,state.protocol)
```

### B4  (`index.html`, serves F1)

Why: the app's plan offers the church's plans

Find (exactly once):

```html
   </details>
  </div>

  ${P.urgent?`<div class="pl-urgent" role="alert">
```

Replace with:

```html
   </details>
   ${churchPlanPicker(a)}
  </div>

  ${P.urgent?`<div class="pl-urgent" role="alert">
```

### B5  (`index.html`, serves F1)

Why: the printed card credits the church for a church plan

Find (exactly once):

```html
 const books=planBooks(p,P.top.map(x=>x.ref)).map(b=>b.split(' (')[0]).join('; ');
```

Replace with:

```html
 const books=p.credit||planBooks(p,P.top.map(x=>x.ref)).map(b=>b.split(' (')[0]).join('; ');
```

### B6  (`index.html`, serves F2)

Why: the Church screen gets a Church plans box

Find (exactly once):

```html
  ${acctBox('Church details',churchFormHTML(c))}`;
```

Replace with:

```html
  ${acctBox('Church plans',churchPlansBox(cid))}
  ${acctBox('Church details',churchFormHTML(c))}`;
```

### B7  (`index.html`, serves F2)

Why: opening the Church screen starts with a fresh plan list and no open form

Find (exactly once):

```html
 if(cloud.acctTab==='church')cloud.members=null;
```

Replace with:

```html
 if(cloud.acctTab==='church'){cloud.members=null;cloud.adminPlans=null;cloud.planEdit=null;}
```

### B8  (`index.html`, serves F3)

Why: signing out forgets the church's plans on this device

Find (exactly once):

```html
 cloud.user=null;cloud.mode=false;cloud.blocked=false;
```

Replace with:

```html
 cloud.plans=null;cloud.adminPlans=null;cloud.planEdit=null;try{localStorage.removeItem(CHURCH_PLANS_KEY);}catch(e){}
 cloud.user=null;cloud.mode=false;cloud.blocked=false;
```

### S1  (`supabase/schema.sql`, serves F4)

Why: the church_plans table and its three functions, before the grants

Find (exactly once):

```sql
do $$
declare f text;
begin
  foreach f in array array['is_platform_admin()'
```

Replace with:

```sql
-- ================================================================ CHURCH PLANS
-- A church's own home plans, for any health problem (one of the app's nine, or its own, such as "arthritis").
-- The church's admins write them; its staff send one to a visitor, whose record keeps the plan's id in
-- interests.churchPlan. The app shows them as written by the church, never as its own, and always adds its safety rules.
create table if not exists public.church_plans (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches (id) on delete cascade,
  problem    text not null check (length(btrim(problem)) between 1 and 60),
  title      text not null check (length(btrim(title)) between 2 and 120),
  actions    jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 8),
  note       text not null default '' check (length(note) <= 600),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.church_plans enable row level security;         -- no policies: only the functions below reach it
revoke all on public.church_plans from anon, authenticated;
create index if not exists church_plans_church_idx on public.church_plans (church_id);

-- the church's plans, for its staff and admins (and the platform admin)
create or replace function public.church_plans(p_church uuid)
returns setof public.church_plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.church_plans p
  where p.church_id = p_church and (p_church = public.staff_church() or public.church_admin_of(p_church))
  order by p.problem, p.title;
$$;

-- add (p_id null) or change a plan; church admins only. Each action is {do, why, how: [..]}.
create or replace function public.save_church_plan(p_church uuid, p_id uuid, p_problem text, p_title text, p_actions jsonb, p_note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.church_admin_of(p_church) then raise exception 'church admins only' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_problem, ''))) = 0 then raise exception 'Choose the problem this plan is for.'; end if;
  if length(btrim(coalesce(p_title, ''))) < 2 then raise exception 'Give the plan a title.'; end if;
  if jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions) = 0 then raise exception 'Add at least one thing to do.'; end if;
  if jsonb_array_length(p_actions) > 8 then raise exception 'A plan can have at most 8 things to do.'; end if;
  if exists (select 1 from jsonb_array_elements(p_actions) x
             where jsonb_typeof(x) <> 'object' or length(btrim(coalesce(x->>'do', ''))) = 0) then
    raise exception 'Every thing to do needs a short instruction.';
  end if;
  if p_id is null then
    insert into public.church_plans (church_id, problem, title, actions, note, created_by)
    values (p_church, btrim(p_problem), btrim(p_title), p_actions, btrim(coalesce(p_note, '')), (select auth.uid()))
    returning id into v_id;
  else
    update public.church_plans p
    set problem = btrim(p_problem), title = btrim(p_title), actions = p_actions, note = btrim(coalesce(p_note, '')), updated_at = now()
    where p.id = p_id and p.church_id = p_church
    returning p.id into v_id;
    if v_id is null then raise exception 'That plan is not in this church.'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.delete_church_plan(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_church uuid;
begin
  select p.church_id into v_church from public.church_plans p where p.id = p_id;
  if v_church is null then raise exception 'That plan no longer exists.'; end if;
  if not public.church_admin_of(v_church) then raise exception 'church admins only' using errcode = '42501'; end if;
  delete from public.church_plans p where p.id = p_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['is_platform_admin()'
```

### S2  (`supabase/schema.sql`, serves F4)

Why: signed-in users may call the church plan functions; anon may not

Find (exactly once):

```sql
    'admin_set_church_status(uuid, text)', 'admin_audit(integer)'] loop
```

Replace with:

```sql
    'admin_set_church_status(uuid, text)', 'admin_audit(integer)',
    'church_plans(uuid)', 'save_church_plan(uuid, uuid, text, text, jsonb, text)', 'delete_church_plan(uuid)'] loop
```

### T1  (`.smoke/harness.js`, serves F5)

Why: the fake database answers the church plan functions

Find (exactly once):

```js
        update_church: a => { rc.push('church:' + a.p_church + ':' + a.p_name); return done(); },
```

Replace with:

```js
        update_church: a => { rc.push('church:' + a.p_church + ':' + a.p_name); return done(); },
        church_plans: a => { rc.push('plans:' + a.p_church); return done(JSON.parse(JSON.stringify(cplans.filter(p => p.church_id === a.p_church)))); },
        save_church_plan: a => {
          rc.push(['saveplan', a.p_church, a.p_problem, a.p_title, a.p_actions.length].join(':'));
          const id = a.p_id || 'cp-' + (cplans.length + 1), row = { id, church_id: a.p_church, problem: a.p_problem, title: a.p_title, actions: a.p_actions, note: a.p_note };
          cplans = cplans.filter(p => p.id !== id).concat([row]); return done(id);
        },
        delete_church_plan: a => { rc.push('delplan:' + a.p_id); cplans = cplans.filter(p => p.id !== a.p_id); return done(); },
```

### T2  (`.smoke/harness.js`, serves F5)

Why: the fake church plans start empty

Find (exactly once):

```js
    const A = { id: 'ch-a', name: 'Grace Chapel', city: 'Durban', phone: '', email: '', status: 'active' };
```

Replace with:

```js
    const A = { id: 'ch-a', name: 'Grace Chapel', city: 'Durban', phone: '', email: '', status: 'active' };
    let cplans = [];
```

### T3  (`.smoke/harness.js`, serves F5)

Why: a church admin writes, staff send, and the admin deletes a church plan (fake database)

Find (exactly once):

```js
    ok('a church admin saves the church\'s details', rc.includes('church:ch-a:Grace Chapel Durban'), rc.join());
    g.closeAcct();
```

Replace with:

```js
    ok('a church admin saves the church\'s details', rc.includes('church:ch-a:Grace Chapel Durban'), rc.join());
    g.closeAcct();
    g.openAcct('church'); await sleep(30);
    ok('the Church screen has a Church plans box with + Write a new plan', sheet().includes('Church plans') && /editChurchPlan\('ch-a',''\)/.test(sheet()) && rc.includes('plans:ch-a'), rc.join());
    g.editChurchPlan('ch-a', ''); sheet();
    $el('cpProblem').value = 'own'; $el('cpOwn').value = 'Joint pain'; $el('cpTitle').value = 'Easing stiff joints'; $el('cpNote').value = '';
    $el('cpDo0').value = 'Move every joint gently'; $el('cpWhy0').value = 'Keeps joints supple'; $el('cpHow0').value = '5 minutes\nEvery morning';
    for (let i = 1; i < 8; i++) { $el('cpDo' + i).value = ''; $el('cpWhy' + i).value = ''; $el('cpHow' + i).value = ''; }
    await g.saveChurchPlan({ preventDefault() {} }, 'ch-a'); await sleep(20);
    ok('a church admin writes a plan for a problem of their own', rc.includes('saveplan:ch-a:Joint pain:Easing stiff joints:1') && sheet().includes('Easing stiff joints'), rc.join());
    $el('cpProblem').value = 'bp'; $el('cpDo0').value = '';
    await g.saveChurchPlan({ preventDefault() {} }, 'ch-a');
    ok('…a plan with nothing to do is refused before any request', !rc.some(x => x.startsWith('saveplan:ch-a:bp')) && /at least one thing to do/.test($el('toastMsg').textContent));
    g.closeAcct();
    g.attendees.push(g.migrateAttendee({ id: 'EXPO-901', name: 'Plan Visitor', age: 40, sex: 'Female', s: { sys: 150, dia: 95 }, heightCm: 165 }));
    const cpVisitor = g.attendees.find(a => a.id === 'EXPO-901');
    g.state.activeId = cpVisitor.id; g.state.sugFor = null; g.state.tab = 'plan'; g.render();
    ok('church staff see the church\'s plans on the Plan tab', /Send a plan from Grace Chapel/.test($main.innerHTML) && /chooseChurchPlan\('cp-1'\)/.test($main.innerHTML));
    g.chooseChurchPlan('cp-1');
    ok('…sending one shows it in place of the app\'s plan, as the church\'s own, with the pills rule', cpVisitor.interests.churchPlan === 'cp-1' && $main.innerHTML.includes('Easing stiff joints')
      && /Written by Grace Chapel/.test($main.innerHTML) && /not reviewed by the app/.test($main.innerHTML) && /Never stop prescribed pills suddenly/.test($main.innerHTML));
    ok('…and the WhatsApp message carries it', /EASING STIFF JOINTS/.test(g.waMessage(cpVisitor)) && /Move every joint gently/.test(g.waMessage(cpVisitor)) && /Grace Chapel/.test(g.waMessage(cpVisitor)));
    sandbox.confirm = () => true;
    await g.deleteChurchPlan('ch-a', 'cp-1'); await sleep(20); g.render();
    ok('a church admin deletes a plan, and the visitor it was sent to falls back to the app\'s plan', rc.includes('delplan:cp-1') && /Do these 3 things/.test($main.innerHTML) && !/Easing stiff joints/.test($main.innerHTML), rc.join());
    g.chooseChurchPlan('');
```

### T4  (`.smoke/harness.js`, serves F5)

Why: church plans in the real database: who can see, write and delete them

Find (exactly once):

```js
    /* ---- a brand-new project ---- */
```

Replace with:

```js
    /* ---- church plans ---- */
    const PU = { adm: '00000000-0000-4000-8000-0000000000a1', stf: '00000000-0000-4000-8000-0000000000a2', mem: '00000000-0000-4000-8000-0000000000a3', oth: '00000000-0000-4000-8000-0000000000a4' };
    for (const [n, id] of Object.entries(PU)) await sys(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, 'plan-' + n + '@example.org']);
    const PA = (await sys(`insert into public.churches (name, status) values ('Plan Church A', 'active') returning id`))[0].id;
    const PB = (await sys(`insert into public.churches (name, status) values ('Plan Church B', 'active') returning id`))[0].id;
    await sys(`insert into public.memberships (user_id, church_id, role, status) values ($1, $5, 'admin', 'approved'), ($2, $5, 'staff', 'approved'), ($3, $5, 'member', 'approved'), ($4, $6, 'admin', 'approved')`,
      [PU.adm, PU.stf, PU.mem, PU.oth, PA, PB]);
    const acts = JSON.stringify([{ do: 'Move every joint gently', why: 'Keeps joints supple', how: ['5 minutes'] }]);
    r = await as(PU.adm, `select public.save_church_plan($1, null, 'Joint pain', 'Easing stiff joints', $2::jsonb, '') id`, [PA, acts]);
    const planId = r.rows && r.rows[0].id;
    ok('a church admin saves a church plan for a problem of their own', !r.error && !!planId, r.error && r.error.message);
    r = await as(PU.stf, `select id, title, problem from public.church_plans($1)`, [PA]);
    ok('the church\'s staff list its plans', !r.error && r.rows.length === 1 && r.rows[0].title === 'Easing stiff joints' && r.rows[0].problem === 'Joint pain', r.error ? r.error.message : JSON.stringify(r.rows));
    r = await as(PU.stf, `select public.save_church_plan($1, null, 'bp', 'Staff plan', $2::jsonb, '')`, [PA, acts]);
    ok('church staff cannot write plans; only admins can', !!r.error);
    r = await as(PU.mem, `select count(*)::int n from public.church_plans($1)`, [PA]);
    ok('a member sees no church plans', !r.error && r.rows[0].n === 0, r.error && r.error.message);
    const o1 = await as(PU.oth, `select count(*)::int n from public.church_plans($1)`, [PA]);
    const o2 = await as(PU.oth, `select public.save_church_plan($1, null, 'bp', 'Not mine', $2::jsonb, '')`, [PA, acts]);
    const o3 = await as(PU.oth, `select public.delete_church_plan($1)`, [planId]);
    ok('another church\'s admin can neither see, write nor delete them', !o1.error && o1.rows[0].n === 0 && !!o2.error && !!o3.error);
    r = await as(PU.adm, `select count(*)::int n from public.church_plans`);
    ok('the church_plans table cannot be read directly', !!r.error);
    const e1p = await as(PU.adm, `select public.save_church_plan($1, null, 'bp', 'Empty', '[]'::jsonb, '')`, [PA]);
    const e2p = await as(PU.adm, `select public.save_church_plan($1, null, 'bp', 'Blank', '[{"do":"  "}]'::jsonb, '')`, [PA]);
    ok('a plan needs at least one thing to do, each with an instruction', !!e1p.error && !!e2p.error);
    r = await as(PU.adm, `select public.save_church_plan($1, $2, 'bp', 'Walking club', $3::jsonb, 'Bring water')`, [PA, planId, acts]);
    const edited = await sys(`select problem, title, note from public.church_plans where id = $1`, [planId]);
    ok('a church admin edits a plan', !r.error && edited[0].problem === 'bp' && edited[0].title === 'Walking club' && edited[0].note === 'Bring water', r.error ? r.error.message : JSON.stringify(edited));
    r = await as(null, `select * from public.church_plans($1)`, [PA]);
    ok('signed-out callers cannot use the church plan functions', !!r.error);
    await sys(`update public.churches set status = 'suspended' where id = $1`, [PA]);
    r = await as(PU.stf, `select count(*)::int n from public.church_plans($1)`, [PA]);
    ok('a suspended church\'s staff see no plans', !r.error && r.rows[0].n === 0, r.error && r.error.message);
    await sys(`update public.churches set status = 'active' where id = $1`, [PA]);
    r = await as(PU.adm, `select public.delete_church_plan($1)`, [planId]);
    ok('a church admin deletes a plan', !r.error && (await sys(`select count(*)::int n from public.church_plans where id = $1`, [planId]))[0].n === 0, r.error && r.error.message);

    /* ---- a brand-new project ---- */
```

### T5  (`.smoke/harness.js`, serves F5)

Why: practice mode: the example church plans, sending one, and going back

Find (exactly once):

```js
  g.state.protocol = 'bmi'; g.render();
  ok('the weight plan shows no calorie rule of thumb (it came only from the old book)', !/kcal/.test($main.innerHTML));
```

Replace with:

```js
  g.state.protocol = 'bmi'; g.render();
  ok('the weight plan shows no calorie rule of thumb (it came only from the old book)', !/kcal/.test($main.innerHTML));
  g.state.protocol = 'bp'; g.render();
  ok('in practice mode the Plan tab offers the example church plans', /Send a plan from Practice church/.test($main.innerHTML) && /chooseChurchPlan\('demo-joints'\)/.test($main.innerHTML));
  const cpDav = g.attendees.find(a => a.id === 'EXPO-042');
  g.chooseChurchPlan('demo-joints');
  ok('a chosen church plan replaces the app\'s plan, labelled as the church\'s own, with the pills rule', cpDav.interests.churchPlan === 'demo-joints'
    && $main.innerHTML.includes('Easing stiff, painful joints') && /Written by Practice church/.test($main.innerHTML) && /not reviewed by the app/.test($main.innerHTML)
    && /Never stop prescribed pills suddenly/.test($main.innerHTML) && /chooseChurchPlan\(''\)/.test($main.innerHTML));
  ok('…a red-range reading still shows the warning first', /See the triage nurse now|Book a clinic visit this week/.test($main.innerHTML) === !!g.urgentOf(cpDav, 'bp'));
  const cpMsg = g.waMessage(cpDav);
  ok('the WhatsApp message carries the church plan, its church and the pills rule, and no book credit', cpMsg.includes('EASING STIFF, PAINFUL JOINTS') && cpMsg.includes('Move every joint gently each morning') && cpMsg.includes('Practice church')
    && /do not stop them suddenly/.test(cpMsg) && !/Ministry of Healing/.test(cpMsg), cpMsg.slice(0, 300));
  g.buildPrintCard();
  ok('the take-home card carries the church plan and credits the church', $el('printArea').innerHTML.includes(g.esc('Move every joint gently each morning')) && /From: Practice church/.test($el('printArea').innerHTML)
    && /Never stop prescribed pills suddenly/.test($el('printArea').innerHTML));
  g.chooseChurchPlan('');
  ok('“Use the app’s plan instead” goes back to the app\'s plan', !cpDav.interests.churchPlan && /Do these 3 things/.test($main.innerHTML) && /Counsels on Diet §/.test($main.innerHTML));
```

### T6  (`.smoke/harness.js`, serves F5)

Why: export the church plan functions to the tests

Find (exactly once):

```js
  'planFor', 'PRICE_DATE', 'ACTIONS', 'FOOD_WHY',
```

Replace with:

```js
  'planFor', 'PRICE_DATE', 'ACTIONS', 'FOOD_WHY', 'urgentOf',
  'churchPlanList', 'chooseChurchPlan', 'editChurchPlan', 'saveChurchPlan', 'deleteChurchPlan', 'DEMO_CHURCH_PLANS',
```

### V1  (`PLANS.md`, serves F6)

Why: how church plans work

Find (exactly once):

```md
## The Food screen
```

Replace with:

```md
## Church plans

A church can write its own plans, for one of the nine problems or one of its own (for example "Joint pain"), and send
them to its visitors:

- **Writing:** church admins use **Church plans** on the Church screen (logo → Church). A plan has a problem, a title,
  up to 8 things to do (each with why and how) and an optional safety note. Admins should write in their own words.
- **Sending:** church staff open a visitor's Plan tab, then **Send a plan from <church>**; plans for the visitor's own
  readings are listed first. The visitor's record keeps the plan's id in `interests.churchPlan`, so it syncs like the
  rest of the record. **Use the app's plan instead** goes back.
- **What the visitor sees:** the church's plan, labelled as written by the church and not reviewed by the app, always
  with the app's safety rules: the red-range warning, "keep taking your pills", and the help line for sleep and stress
  plans. The WhatsApp message and the printed card carry the same plan and credit the church instead of any book.
- **Who can do what:** in the database (`supabase/schema.sql`, table `church_plans`, functions `church_plans`,
  `save_church_plan`, `delete_church_plan`) only the church's approved staff and admins can read its plans, only its
  admins (or the platform admin) can write or delete them, members and other churches see none, and a suspended
  church's staff see none. Run the whole schema file again in the Supabase SQL editor to add them.
- **Practice mode** shows two example plans from a "Practice church" so volunteers can try it.

## The Food screen
```

Not changed: the built-in plans; how visitors sync (the chosen plan id travels inside the existing interests field); the existing tables. The live Supabase project still needs the schema file run again to get church plans; until then the app simply shows no church plans.

## 7. Measured facts (verbatim from prove.js)
```text
apply (dry-run copy)               162 ms  applied 17 edits to 4 files
generate (dry-run copy)             77 ms  exit 0
make-expected                    93381 ms  expected.json written: 140 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html, supabase/schema.sql
tamper-test (+ full gate post)  217457 ms  TAMPER-TEST: PASS  (control passed; 10 tampers)
scope-report pristine              206 ms  SCOPE VERDICT: READY  (17 edit(s) pending, 0 already applied)
scope-report dry-run               131 ms  SCOPE VERDICT: ALREADY APPLIED  (0 edit(s) pending, 17 already applied)
scope-report (real project)        314 ms  SCOPE VERDICT: READY  (17 edit(s) pending, 0 already applied)
gate pre (real project)          47224 ms  RESULT: PASS  (27/27 checks passed, mode=pre)

# make-expected
expected.json written: 140 baseline files; changed: .smoke/harness.js, PLANS.md, dist/index.html, dist/sw.js, index.html, supabase/schema.sql
tests before {"pass":656,"fail":0} (exit 0) -> after {"pass":680,"fail":0} (exit 0)
  anchor index.html:1729 x1  const planCredit=p=>planBooks(p).join('; ');
  anchor index.html:2632 x1  function planFor(a,pk){
  anchor index.html:2641 x1  function viewPlan(){
  anchor index.html:5002 x1  function churchAdminHTML(){
  anchor supabase/schema.sql:487 x1  create or replace function public.church_admin_of(p_church uuid)
  anchor supabase/schema.sql:453 x1  create or replace function public.staff_church()
  anchor .smoke/harness.js:1732 x1      /* ---- a brand-new project ---- */

# tamper-test (its control is the full dry-run gate post)
control: gate post on the dry-run copy (full, with mutation tests)…
  OK    control must PASS -> RESULT: PASS  (38/38 checks passed, mode=post)  [DRY-RUN]
  OK    plan never applied (pristine copy) -> RESULT: FAIL  (15/22 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-.smoke/harness.js  .smoke/harness.js is byte-identi, X-PLANS.md  PLANS.md is byte-identical to the dry-run, X-dist/index.html  dist/index.html is byte-identical 
  OK    a stray file was added -> RESULT: FAIL  (20/22 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S2  no file was added or deleted
  OK    edited file drifted by one byte: index.html -> RESULT: FAIL  (21/22 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
  OK    edited file drifted by one byte: supabase/schema.sql -> RESULT: FAIL  (21/22 checks passed, mode=post)   caught by: X-supabase/schema.sql  supabase/schema.sql is byte-id
  OK    edited file drifted by one byte: .smoke/harness.js -> RESULT: FAIL  (21/22 checks passed, mode=post)   caught by: X-.smoke/harness.js  .smoke/harness.js is byte-identi
  OK    edited file drifted by one byte: PLANS.md -> RESULT: FAIL  (21/22 checks passed, mode=post)   caught by: X-PLANS.md  PLANS.md is byte-identical to the dry-run
  OK    an out-of-scope file was changed: .smoke/serve.js -> RESULT: FAIL  (20/22 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, S3  the other 134 files are byte-identical to the bas
  OK    generated file left stale: dist/index.html -> RESULT: FAIL  (20/22 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/index.html  dist/index.html is byte-identical 
  OK    generated file left stale: dist/sw.js -> RESULT: FAIL  (20/22 checks passed, mode=post)   caught by: S1  exactly these files changed: .smoke/harness.js, P, X-dist/sw.js  dist/sw.js is byte-identical to the dry
  OK    half-applied: edit "B1 church plan functions" undone -> RESULT: FAIL  (21/22 checks passed, mode=post)   caught by: X-index.html  index.html is byte-identical to the dry
TAMPER-TEST: PASS  (control passed; 10 tampers)

PIN fix-plan/gate.js sha256 61bb8519de3de0ebba8c7436fb1703e6d182797e72b351eb1c56f0d13586a587
PIN fix-plan/expected.json sha256 b99b30ecc1cf82fd1df35e7baf196b7a50d8681cc9ea6e684c113f799ba923e5
```

## 8. Not measured
- The schema has not been run on the live Supabase project: not done.
- Church plans in a member's own account view (My account): not built.
- The Android app: not rebuilt.
- Clinical review of church-written plans: the app labels them as not reviewed; no review process exists.
- Behaviour on a real phone: not tested; checked in the browser preview and the harness only.

## 9. Execution report (only these statements)
1. The scope analysis summary under the four headings, and the SCOPE VERDICT line.
2. Both `RESULT:` lines and both report paths with their hashes.
3. The S1 line (files changed) and the H1 line (test tally).
4. Anything not run, marked "not run".
