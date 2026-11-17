/* fix-plan-status/edits.js: the ONLY changes this plan makes, applied in order by apply.js (each find must match exactly
   once). Line breaks are \n; apply.js converts them to each file's own ending. */
module.exports = [
 {
  "id": "C1 status records and screens",
  "fixes": [
   "G1",
   "G2",
   "G3",
   "G4",
   "G5"
  ],
  "why": "the status records, the panel, the Home pill, the account banner and Test now",
  "protectedBy": [
   "MH1",
   "MH2",
   "MH3",
   "MH4",
   "MH6",
   "MH8"
  ],
  "file": "index.html",
  "find": "/* ---------- churches, members and the platform admin ----------",
  "replace": "/* ---------- cloud status: one record per cloud function ----------\n   Each row says what just happened to that function: a request that worked or failed, a live connection's own report,\n   or Test now. Nothing is guessed; a row nobody has checked says so. The panel behind the logo lists every row, Home\n   shows the worst of download / upload / live updates, and the queue and account screens point here when they fail. */\nconst HEALTH_ROWS=[['auth','Sign-in'],['sync','Download'],['upload','Upload'],['live','Live updates'],['queue','Live queue'],\n ['account','Accounts & admin'],['schema','Database setup']];\nconst H_TONE={ok:'live',warn:'warn',bad:'bad',off:'info'};\nconst H_RANK={bad:3,warn:2,off:1,ok:0};\nconst health={};\nconst hhmm=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});\nconst isOfflineErr=m=>!navigator.onLine||/failed to fetch|networkerror|load failed|network request/i.test(String(m||''));\nconst isMissingErr=e=>!!e&&(e.code==='PGRST205'||e.code==='PGRST202'||e.code==='42P01'||e.code==='42883'||/schema cache|could not find the (table|function)|does not exist/i.test(String(e.message||'')));\n/* \"Could not find the table 'public.queue_entries' …\" / \"… function public.my_account …\" / relation \"x\" -> the name */\nconst missingName=e=>{const m=/(?:public\\.|relation\\s+\")([a-z_]+)/i.exec(String((e&&e.message)||''));return m?m[1]:'';};\nlet _healthT=null;\nfunction noteHealth(key,st,msg,detail){\n health[key]={st,msg,detail:detail||'',at:Date.now()};\n clearTimeout(_healthT);_healthT=setTimeout(healthRefresh,60);\n}\nfunction healthReset(){for(const k in health)delete health[k];cloud.testedAt=0;}\n/* a failed request, in plain words; a missing table or function also marks Database setup */\nfunction healthFromError(key,err,what){\n const msg=String((err&&err.message)||err||''),name=what||missingName(err);\n if(isOfflineErr(msg))return noteHealth(key,'warn','No connection. It retries by itself; changes stay on this phone.',msg);\n if(isMissingErr(err)){\n  noteHealth('schema','bad',`Missing in the database: ${name||'a table or function'}. Run supabase/schema.sql again in the Supabase SQL editor.`,msg);\n  return noteHealth(key,'bad','Not set up in the database yet (see Database setup).',msg);\n }\n if(err&&(err.code==='42501'||/row-level security|permission denied/i.test(msg)))return noteHealth(key,'bad','Refused: this account has no access to it.',msg);\n noteHealth(key,'bad',msg||'Failed for an unknown reason.',[err&&err.code,what].filter(Boolean).join(' · '));\n}\n/* what is waiting to upload, counted from this phone's own copy */\nfunction healthUpload(){\n const n=cloudPending(),bad=Object.keys(cloud.rejected).length;\n if(bad)return noteHealth('upload','warn',`${bad} change${bad>1?'s were':' was'} refused by the database and will not upload. The reason was shown when it happened.`);\n noteHealth('upload',n?'warn':'ok',n?`${n} change${n>1?'s':''} waiting to upload.`:'Every change on this phone is uploaded.');\n}\n/* the live connections report their own state: SUBSCRIBED, or CHANNEL_ERROR / TIMED_OUT / CLOSED while reconnecting */\nfunction healthLive(key,st){\n if(st==='SUBSCRIBED')return noteHealth(key,'ok',key==='queue'?'Live: every desk sees the same line.':'Connected: changes from other desks arrive straight away.',st);\n if(!st)return noteHealth(key,'warn','Connecting the live updates…','no status reported yet');\n noteHealth(key,'warn',key==='queue'?'Reconnecting… numbers may be a few seconds behind.':'Reconnecting… other desks’ changes still arrive at the next sync (within 10 minutes).',st||'connecting');\n}\nfunction healthRefresh(){\n const m=$('#cloudModal');if(m&&!m.classList.contains('hidden'))renderCloudBody();\n const h=$('#homeHealth');if(h)h.innerHTML=homeHealthHTML();\n for(const id of ['acctHealth','gateHealth']){const e=$('#'+id);if(e)e.innerHTML=acctHealthHTML();}\n}\n/* the panel behind the logo */\nfunction statusPanelHTML(){\n return `<div class=\"mt-4 rounded-[18px] border border-[#123033]/[.07] bg-white/60 p-3.5\">\n  <div class=\"flex items-center justify-between\"><div class=\"microlabel\">Cloud status</div>\n   <button class=\"tap-link\" onclick=\"healthTest()\" ${cloud.testing?'disabled':''}>${cloud.testing?'Testing…':'Test now'}</button></div>\n  ${HEALTH_ROWS.map(([k,l])=>{const h=health[k];\n   return `<div class=\"q-state q-state-${h?H_TONE[h.st]:'info'} mt-2\"><span class=\"q-dot\"></span><span style=\"flex:1\"><b>${l}</b> · ${h?esc(h.msg):'Not checked yet.'}${h&&h.detail&&h.st!=='ok'?`<span class=\"mono mt-0.5 block text-[10px]\">${esc(h.detail)}</span>`:''}</span><span class=\"text-[10px]\">${h?hhmm(h.at):''}</span></div>`;}).join('')}\n  <p class=\"mt-2 text-[10px] leading-relaxed text-[#8a9aa0]\">${cloud.testedAt?`Test now ran at ${hhmm(cloud.testedAt)}. `:''}Test now only reads (one row of each table, and read-only functions); it never changes data.</p>\n </div>`;\n}\n/* Home: the worst of download, upload and live updates, one tap from the details */\nfunction homeHealthHTML(){\n const rows=['sync','upload','live'].map(k=>health[k]).filter(Boolean);\n if(!rows.length)return '';\n const w=rows.reduce((a,b)=>H_RANK[b.st]>H_RANK[a.st]?b:a);\n return `<button onclick=\"openCloud()\" class=\"q-state q-state-${H_TONE[w.st]} mb-2 w-full text-left\"><span class=\"q-dot\"></span><span class=\"min-w-0 flex-1 truncate\">${w.st==='ok'?'Up to date with the shared database':esc(w.msg)}</span><span>Details</span></button>`;\n}\n/* the account screens: only when an account call is failing */\nfunction acctHealthHTML(){\n const h=health.account;\n if(!h||h.st==='ok'||h.st==='off')return '';\n return `<button onclick=\"openCloud()\" class=\"q-state q-state-${H_TONE[h.st]} mb-2.5 w-full text-left\"><span class=\"q-dot\"></span><span class=\"min-w-0 flex-1\">${esc(h.msg)}</span><span>Details</span></button>`;\n}\n/* Test now: read-only checks of each function, one after another, each recorded with its time */\nasync function healthTest(){\n if(!cloud.client||!cloud.user){noteHealth('auth','off','Not signed in. Sign in to test the shared database.');return;}\n if(cloud.testing)return;\n cloud.testing=true;renderCloudBody();\n const missing=[];let unreached=0;\n const probe=async(key,what,run)=>{\n  let r;\n  try{r=await run();}catch(e){r={error:e};}\n  if(r&&r.error){if(isMissingErr(r.error))missing.push(what);else unreached++;healthFromError(key,r.error,what);return null;}\n  return r||{};\n };\n noteHealth('auth','ok','Signed in as '+(cloud.user.email||''));\n const a=await probe('sync','attendees',()=>cloud.client.from('attendees').select('id').range(0,0));\n const v=await probe('sync','volunteers',()=>cloud.client.from('volunteers').select('id').range(0,0));\n if(a&&v)noteHealth('sync','ok','Reading visitors and volunteers works.');\n const qc=await probe('queue','queue_now',()=>cloud.client.rpc('queue_now'));\n const qt=await probe('queue','queue_entries',()=>cloud.client.from('queue_entries').select('id').range(0,0));\n if(qc&&qt)healthLive('queue',qs.rt||'');\n const me=await probe('account','my_account',()=>cloud.client.rpc('my_account'));\n if(me&&me.data&&typeof me.data==='object')noteHealth('account','ok','Account functions answer.');\n else if(me){missing.push('my_account (churches part)');noteHealth('account','warn','Churches are not set up in this database. Until schema.sql is run again, the old staff list decides who gets in.');}\n healthUpload();\n if(cloud.channel)healthLive('live',cloud.liveSt||'');else noteHealth('live','off','Not connected (connects after the first download).');\n if(missing.length)noteHealth('schema','bad',`Missing in the database: ${missing.join(', ')}. Run supabase/schema.sql again in the Supabase SQL editor.`);\n else if(unreached)noteHealth('schema','warn',`Could not be checked: ${unreached} request${unreached>1?'s':''} failed for another reason (see the rows above).`);\n else noteHealth('schema','ok','Every table and function Test now checks was found: attendees, volunteers, queue_entries, queue_now, my_account.');\n cloud.testing=false;cloud.testedAt=Date.now();\n healthRefresh();renderCloudBody();toast(missing.length?'Cloud test finished: something is missing (see Database setup)':'Cloud test finished');\n}\n\n/* ---------- churches, members and the platform admin ----------"
 },
 {
  "id": "C2 sign-in library failed",
  "fixes": [
   "G1"
  ],
  "why": "Sign-in turns red when the Supabase library cannot load",
  "protectedBy": [],
  "file": "index.html",
  "find": "}catch(e){cloud.starting=false;setCloud(cloud.mode?'offline':'unavailable');return;}",
  "replace": "}catch(e){cloud.starting=false;noteHealth('auth','bad','The sign-in service did not load, usually because there is no internet. Connect, then reopen the app.',String((e&&e.message)||e));setCloud(cloud.mode?'offline':'unavailable');return;}"
 },
 {
  "id": "C3 signed in",
  "fixes": [
   "G1"
  ],
  "why": "Sign-in turns green with the email",
  "protectedBy": [],
  "file": "index.html",
  "find": "  cloud.user=u;\n",
  "replace": "  cloud.user=u;noteHealth('auth','ok','Signed in as '+(u.email||''));\n"
 },
 {
  "id": "C4 signed out",
  "fixes": [
   "G1"
  ],
  "why": "signing out (or a lost session) clears every row and says Not signed in",
  "protectedBy": [
   "MH7"
  ],
  "file": "index.html",
  "find": "  if(ev==='SIGNED_OUT'&&cloud.ready&&!cloud.signingOut)toast(",
  "replace": "  healthReset();noteHealth('auth','off','Not signed in.');\n  if(ev==='SIGNED_OUT'&&cloud.ready&&!cloud.signingOut)toast("
 },
 {
  "id": "C5 accounts: database without churches",
  "fixes": [
   "G3"
  ],
  "why": "a database without the churches part shows as a warning, not as a failure (the old staff list still works)",
  "protectedBy": [],
  "file": "index.html",
  "find": "  cloud.acct=null;cloud.churchId='';\n",
  "replace": "  cloud.acct=null;cloud.churchId='';\n  if(!r.error||!isOfflineErr(r.error.message))noteHealth('account','warn','Churches are not set up in this database. Until schema.sql is run again, the old staff list decides who gets in.',r.error?String(r.error.message||''):'my_account gave no account');\n"
 },
 {
  "id": "C6 accounts: who is signed in",
  "fixes": [
   "G3"
  ],
  "why": "Accounts shows the church and role once my_account answers",
  "protectedBy": [],
  "file": "index.html",
  "find": " cloud.churchId=c?c.id:'';\n",
  "replace": " cloud.churchId=c?c.id:'';\n noteHealth('account','ok',c&&m?`${c.name} · ${ROLE_L[m.role]}${m.status==='approved'?'':' (waiting for approval)'}`:'Signed in, not in a church yet.');\n"
 },
 {
  "id": "C7 accounts: a call failed",
  "fixes": [
   "G3"
  ],
  "why": "every failing account call is recorded with its function name",
  "protectedBy": [
   "MH8"
  ],
  "file": "index.html",
  "find": " if(r.error){toast(isNet(r.error.message)?",
  "replace": " if(r.error){healthFromError('account',r.error,fn);toast(isNet(r.error.message)?"
 },
 {
  "id": "C8 sync and upload failures",
  "fixes": [
   "G1"
  ],
  "why": "cloudError records the failure on Download (or Upload when it came from an upload); offline also recounts what is waiting",
  "protectedBy": [
   "MH1"
  ],
  "file": "index.html",
  "find": "function cloudError(err){\n console.warn('cloud sync:',err);\n",
  "replace": "function cloudError(err,where){\n console.warn('cloud sync:',err);\n healthFromError(where||'sync',err);\n if(where!=='upload'&&isOfflineErr(err&&err.message))healthUpload();\n"
 },
 {
  "id": "C9 no expo access",
  "fixes": [
   "G1"
  ],
  "why": "an account without expo data access shows Download and Upload as off, not as failing",
  "protectedBy": [],
  "file": "index.html",
  "find": "   cloud.blocked=true;cloud.pending=true;\n",
  "replace": "   cloud.blocked=true;cloud.pending=true;\n   noteHealth('sync','off','This account has no expo data access, so nothing is downloaded.');noteHealth('upload','off','Nothing to upload for this account.');\n"
 },
 {
  "id": "C10 download worked",
  "fixes": [
   "G1"
  ],
  "why": "a successful sync marks Download green with the counts and recounts Upload",
  "protectedBy": [],
  "file": "index.html",
  "find": "  setCloud('online');\n  if(changed||manual)cloudRefresh();",
  "replace": "  setCloud('online');noteHealth('sync','ok',`Up to date: ${attendees.length} visitors, ${volunteers.length} volunteers.`);healthUpload();\n  if(changed||manual)cloudRefresh();"
 },
 {
  "id": "C11 upload worked or failed",
  "fixes": [
   "G1"
  ],
  "why": "cloudPush recounts Upload, and names itself when it fails",
  "protectedBy": [
   "MH1"
  ],
  "file": "index.html",
  "find": " try{await pushDirty();saveSynced();setCloud('online');}\n catch(err){cloudError(err);}",
  "replace": " try{await pushDirty();saveSynced();setCloud('online');healthUpload();}\n catch(err){cloudError(err,'upload');}"
 },
 {
  "id": "C12 live updates report their state",
  "fixes": [
   "G2"
  ],
  "why": "the live connection for visitors and volunteers reports SUBSCRIBED / errors into Live updates",
  "protectedBy": [
   "MH5"
  ],
  "file": "index.html",
  "find": " ch.subscribe();cloud.channel=ch;",
  "replace": " ch.subscribe(st=>{cloud.liveSt=st;healthLive('live',st);});cloud.channel=ch;"
 },
 {
  "id": "C13 live updates stopped",
  "fixes": [
   "G2"
  ],
  "why": "stopping the live connection shows Live updates as off",
  "protectedBy": [],
  "file": "index.html",
  "find": "function stopRealtime(){\n",
  "replace": "function stopRealtime(){\n if(cloud.channel)noteHealth('live','off','Not connected.');\n cloud.liveSt='';\n"
 },
 {
  "id": "C14 live queue loaded",
  "fixes": [
   "G2"
  ],
  "why": "after the queue loads, Live queue shows its live connection state",
  "protectedBy": [],
  "file": "index.html",
  "find": "  qs.ready=true;qs.err='';\n  startQueueRealtime();",
  "replace": "  qs.ready=true;qs.err='';\n  startQueueRealtime();healthLive('queue',qs.rt);"
 },
 {
  "id": "C15 live queue failed",
  "fixes": [
   "G2",
   "G4"
  ],
  "why": "a failing queue load is recorded; a missing queue table is named under Database setup",
  "protectedBy": [
   "MH10"
  ],
  "file": "index.html",
  "find": "  else if(!qs.ready)qs.err=msg||'The queue could not load.';\n }finally{qs.syncing=false;qAfter();}",
  "replace": "  else if(!qs.ready)qs.err=msg||'The queue could not load.';\n  healthFromError('queue',err,isMissingErr(err)?(missingName(err)||'queue_entries'):'');\n }finally{qs.syncing=false;qAfter();}"
 },
 {
  "id": "C16 live queue connection state",
  "fixes": [
   "G2"
  ],
  "why": "the queue's live connection reports into Live queue",
  "protectedBy": [],
  "file": "index.html",
  "find": "  qs.rt=st;\n",
  "replace": "  qs.rt=st;healthLive('queue',st);\n"
 },
 {
  "id": "C17 queue banner: Details",
  "fixes": [
   "G5"
  ],
  "why": "the queue's warning and error banners link to the status panel",
  "protectedBy": [
   "MH9"
  ],
  "file": "index.html",
  "find": " const extra=mode==='error'?`<button class=\"q-mini q-mini-soft\" onclick=\"queueSync(true)\">Retry</button>`:'';",
  "replace": " const extra=(mode==='error'?`<button class=\"q-mini q-mini-soft\" onclick=\"queueSync(true)\">Retry</button>`:'')+(k==='warn'||k==='bad'?`<button class=\"q-mini q-mini-soft\" onclick=\"openCloud()\">Details</button>`:'');"
 },
 {
  "id": "C18 panel behind the logo",
  "fixes": [
   "G5"
  ],
  "why": "the status list and Test now sit under Sign out / Sync now",
  "protectedBy": [],
  "file": "index.html",
  "find": "</div>${acctButtons()}${cloud.isAdmin&&!cloud.acct?approvalsHTML():''}${installBlock()}`;",
  "replace": "</div>${statusPanelHTML()}${acctButtons()}${cloud.isAdmin&&!cloud.acct?approvalsHTML():''}${installBlock()}`;"
 },
 {
  "id": "C19 Home pill",
  "fixes": [
   "G5"
  ],
  "why": "Home shows the worst of Download, Upload and Live updates, under Visitors today",
  "protectedBy": [
   "MH4"
  ],
  "file": "index.html",
  "find": "     <button onclick=\"openCloud()\" class=\"tap-link\">${cloud.user?'Sync':'Sign in'}</button>\n    </div>\n   </div>\n",
  "replace": "     <button onclick=\"openCloud()\" class=\"tap-link\">${cloud.user?'Sync':'Sign in'}</button>\n    </div>\n   </div>\n   ${cloud.user?`<div id=\"homeHealth\">${homeHealthHTML()}</div>`:''}\n"
 },
 {
  "id": "C20 account sheet banner",
  "fixes": [
   "G5"
  ],
  "why": "the account sheet shows a banner while an account call is failing",
  "protectedBy": [
   "MH8"
  ],
  "file": "index.html",
  "find": " el.innerHTML=cloud.acctTab==='admin'?platformHTML():cloud.acctTab==='church'?churchAdminHTML():meHTML();",
  "replace": " el.innerHTML=`<div id=\"acctHealth\">${acctHealthHTML()}</div>`+(cloud.acctTab==='admin'?platformHTML():cloud.acctTab==='church'?churchAdminHTML():meHTML());"
 },
 {
  "id": "C21 account gate banner",
  "fixes": [
   "G5"
  ],
  "why": "the account screens in the sign-in gate show the same banner",
  "protectedBy": [],
  "file": "index.html",
  "find": "  html=acctGateHTML(st);",
  "replace": "  html=`<div id=\"gateHealth\">${acctHealthHTML()}</div>`+acctGateHTML(st);"
 },
 {
  "id": "C22 approvals panel: borders that exist",
  "fixes": [
   "G5"
  ],
  "why": "the older \"Waiting for approval\" panel shows next to the status list; its two border classes were never in the stylesheet, so its borders never drew",
  "protectedBy": [],
  "file": "index.html",
  "find": "return `<div class=\"mt-4 rounded-[18px] border border-[#123033]/[.08] bg-white/60 p-3.5\">\n  <div class=\"flex items-center justify-between\"><div class=\"microlabel\">Waiting for approval</div>",
  "replace": "return `<div class=\"mt-4 rounded-[18px] border border-[#123033]/[.07] bg-white/60 p-3.5\">\n  <div class=\"flex items-center justify-between\"><div class=\"microlabel\">Waiting for approval</div>"
 },
 {
  "id": "C23 approvals panel rows: border that exists",
  "fixes": [
   "G5"
  ],
  "why": "same, for the row dividers",
  "protectedBy": [],
  "file": "index.html",
  "find": ":list.map(u=>`<div class=\"flex items-center gap-2 border-t border-[#123033]/[.06] py-2\">",
  "replace": ":list.map(u=>`<div class=\"flex items-center gap-2 border-t border-[#123033]/[.07] py-2\">"
 },
 {
  "id": "T1 export the status functions",
  "fixes": [
   "G6"
  ],
  "why": "the new tests drive these",
  "protectedBy": [],
  "file": ".smoke/harness.js",
  "find": "  'planFor', 'PRICE_DATE',\n",
  "replace": "  'planFor', 'PRICE_DATE',\n  'health', 'noteHealth', 'healthReset', 'healthTest', 'statusPanelHTML', 'homeHealthHTML', 'acctHealthHTML', 'qStateBar',\n"
 },
 {
  "id": "T2 fake database: reset the live state",
  "fixes": [
   "G6"
  ],
  "why": "each fresh device starts with no live connection report",
  "protectedBy": [],
  "file": ".smoke/harness.js",
  "find": " srv.signupMode = 'confirm'; srv.rpcs = null; };",
  "replace": " srv.signupMode = 'confirm'; srv.rpcs = null; srv.rtState = ''; };"
 },
 {
  "id": "T3 fake database: live connection reports",
  "fixes": [
   "G6"
  ],
  "why": "a test can make the live connection report a state (off by default, so older tests are unchanged)",
  "protectedBy": [],
  "file": ".smoke/harness.js",
  "find": "subscribe() { return ch; } }; return ch; },",
  "replace": "subscribe(cb) { if (cb && srv.rtState) cb(srv.rtState); return ch; } }; return ch; },"
 },
 {
  "id": "T4 tests: cloud status (18d)",
  "fixes": [
   "G6"
  ],
  "why": "new checks, before section 19",
  "protectedBy": [],
  "file": ".smoke/harness.js",
  "find": "  /* ---- 19. installable app (PWA) -------------------------------------- */\n",
  "replace": "  /* ---- 18d. cloud status: one row per cloud function -------------------------------------------- */\n  console.log('\\n18d. Cloud status signals');\n  {\n    const noCloudWas = sandbox.NEWSTART_NO_CLOUD;\n    const H = g.health, shots = [];\n    const panel = () => { g.renderCloudBody(); const h = $el('cloudBody').innerHTML; shots.push(h); return h; };\n    const flush = () => sleep(120);                     /* rows redraw 60 ms after they change */\n    device(); g.healthReset(); sandbox.NEWSTART_NO_CLOUD = false;\n    Object.assign(C, { ready: false, demo: false, pending: false, gateKey: '', acct: null, churchId: '' });\n    srv.authCb('INITIAL_SESSION', null); await flush();\n    ok('signed out: Sign-in says so, and no other row claims anything', H.auth && H.auth.st === 'off' && !H.sync && !H.upload, JSON.stringify(H));\n    await signIn(); await sleep(80); await flush();\n    ok('after sign-in each function reports what just happened', H.auth.st === 'ok' && /staff@example\\.org/.test(H.auth.msg) && H.sync.st === 'ok' && /visitors/.test(H.sync.msg) && H.upload.st === 'ok', JSON.stringify(H));\n    ok('…a database without the churches part shows as a warning under Accounts', H.account && H.account.st === 'warn' && /not set up/.test(H.account.msg), JSON.stringify(H.account));\n    ok('…and the missing live queue table is named under Database setup', H.queue && H.queue.st === 'bad' && H.schema && H.schema.st === 'bad' && /queue_entries/.test(H.schema.msg), JSON.stringify([H.queue, H.schema]));\n    const p1 = panel();\n    ok('the panel behind the logo lists every function with its state and time, and offers Test now',\n      ['Sign-in', 'Download', 'Upload', 'Live updates', 'Live queue', 'Accounts & admin', 'Database setup'].every(l => p1.includes('<b>' + l + '</b>'))\n      && /healthTest\\(\\)/.test(p1) && /q-state-bad/.test(p1) && /q-state-live/.test(p1) && /Not checked yet/.test(p1));\n    g.state.tab = 'home'; g.render(); shots.push($main.innerHTML);\n    ok('Home shows the shared-database state, one tap from the details', /id=\"homeHealth\"/.test($main.innerHTML) && /Up to date/.test(g.homeHealthHTML()) && /openCloud\\(\\)/.test(g.homeHealthHTML()));\n\n    /* no connection */\n    srv.offline = true; registerLocal('Status Waiting', 'EXPO-321');\n    await g.cloudSync(true); await flush();\n    ok('offline: Download says there is no connection, and Upload counts what is waiting', H.sync.st === 'warn' && /No connection/.test(H.sync.msg) && H.upload.st === 'warn' && /1 change waiting/.test(H.upload.msg), JSON.stringify([H.sync, H.upload]));\n    ok('…and Home shows it as a warning, not as an error', /q-state-warn/.test(g.homeHealthHTML()) && !/q-state-bad/.test(g.homeHealthHTML()), g.homeHealthHTML());\n    shots.push(g.homeHealthHTML());\n    srv.offline = false; await g.cloudSync(true); await flush();\n    ok('back online the change uploads and Upload says so', H.upload.st === 'ok' && srv.tables.attendees.has('EXPO-321'), JSON.stringify(H.upload));\n\n    /* the live connection reports its own state */\n    srv.rtState = 'CHANNEL_ERROR'; g.stopRealtime(); g.startRealtime(); await flush();\n    ok('a dropped live connection shows \"Reconnecting…\" under Live updates', H.live && H.live.st === 'warn' && /Reconnecting/.test(H.live.msg), JSON.stringify(H.live));\n    ok('…and Home shows that one warning even though Download and Upload are working', H.sync.st === 'ok' && H.upload.st === 'ok' && /q-state-warn/.test(g.homeHealthHTML()) && /Reconnecting/.test(g.homeHealthHTML()), g.homeHealthHTML());\n    srv.rtState = 'SUBSCRIBED'; g.stopRealtime(); g.startRealtime(); await flush();\n    ok('…and \"Connected\" once it is back', H.live.st === 'ok' && /Connected/.test(H.live.msg));\n\n    /* Test now */\n    srv.calls.length = 0; await g.healthTest(); await flush();\n    ok('Test now only reads: nothing is inserted, updated or upserted', srv.calls.length > 0 && srv.calls.every(c => /^select/.test(c)), srv.calls.join());\n    ok('…records when it ran, and names what is missing', C.testedAt > 0 && H.schema.st === 'bad' && /queue_entries/.test(H.schema.msg) && /Test now ran at/.test(panel()), JSON.stringify(H.schema));\n    srv.tables.queue_entries = new Map();\n    srv.rpcs = { my_account: () => ({ data: { user_id: 'user-1', email: 'staff@example.org', platform_admin: false, membership: null, church: null }, error: null }) };\n    await g.healthTest(); await flush();\n    ok('when everything it checks is found, Database setup and Accounts say so', H.schema.st === 'ok' && H.account.st === 'ok' && H.queue.st !== 'bad', JSON.stringify([H.schema, H.account, H.queue]));\n    srv.offline = true; await g.healthTest(); await flush(); srv.offline = false;\n    ok('Test now with no connection does not claim the database is set up', H.schema.st === 'warn' && /Could not be checked/.test(H.schema.msg), JSON.stringify(H.schema));\n    delete srv.tables.queue_entries; srv.rpcs = null;\n\n    /* the screens that point here */\n    srv.rpcs = { church_directory: () => ({ data: null, error: { code: '42501', message: 'permission denied for function church_directory' } }) };\n    await g.churchSearch(''); await flush(); srv.rpcs = null;\n    ok('a refused account call shows on the account screens, with a way to the details', H.account.st === 'bad' && /Refused/.test(H.account.msg) && /openCloud\\(\\)/.test(g.acctHealthHTML()), JSON.stringify(H.account));\n    shots.push(g.acctHealthHTML(), g.qStateBar('offline'));\n    ok('the queue banner offers Details when it warns, and not in practice mode', /openCloud\\(\\)/.test(g.qStateBar('offline')) && !/openCloud\\(\\)/.test(g.qStateBar('practice')));\n    g.noteHealth('sync', 'bad', '<img src=x onerror=alert(1)>', '<b>detail</b>'); await flush();\n    ok('messages from the database are escaped in the status rows', panel().includes('&lt;img src=x') && !panel().includes('<img src=x') && g.homeHealthHTML().includes('&lt;img') && panel().includes('&lt;b&gt;detail'));\n    {\n      const css = (html.match(/<style[^>]*>[\\s\\S]*?<\\/style>/g) || []).join('\\n'), used = new Set();\n      shots.join('\\n').replace(/class=\"([^\"]*)\"/g, (_, c) => { c.split(/\\s+/).filter(Boolean).forEach(t => used.add(t)); return ''; });\n      const missing = [...used].filter(t => !css.includes('.' + t.replace(/[^a-zA-Z0-9_-]/g, m => '\\\\' + m)));\n      ok('every class the status signals use exists in the stylesheet', used.size > 15 && missing.length === 0, missing.join(' ') || used.size);\n    }\n    await g.cloudSignOut(); await flush();\n    ok('signing out clears every row except Sign-in', Object.keys(H).join() === 'auth' && H.auth.st === 'off', Object.keys(H).join());\n\n    clearTimeout(C.retryT); C.user = null; g.stopRealtime(); srv.reset(); store.delete('newstart.cloud.v1'); store.delete('newstart.church.v1');\n    Object.assign(C, { mode: false, ready: false, pending: false, acct: null, churchId: '', synced: { att: {}, vol: {} } });\n    g.healthReset(); sandbox.NEWSTART_NO_CLOUD = noCloudWas; g.resetDemo();\n  }\n\n  /* ---- 19. installable app (PWA) -------------------------------------- */\n"
 },
 {
  "id": "R1 README: cloud status",
  "fixes": [
   "G6"
  ],
  "why": "how to read the status rows and what Test now does",
  "protectedBy": [],
  "file": "supabase/README.md",
  "find": "- **Privacy.** The publishable key is public by design.",
  "replace": "- **Cloud status.** Tap **Sync** on Home (or the logo) for one row per cloud function: Sign-in, Download, Upload, Live\n  updates, Live queue, Accounts & admin and Database setup. Each row is green (working), amber (attention, e.g. offline\n  or reconnecting), red (failed, with the database's own message underneath) or grey (off / not checked yet), with the\n  time it last changed. Rows only change when something actually happened, never by guesswork. **Test now** checks\n  every row on demand with read-only requests (one row of each table and read-only functions); it never changes data.\n  Database setup names any missing table or function, so you know when to run `schema.sql` again. Home shows the worst\n  of Download, Upload and Live updates, the Queue tab's warning banner has a **Details** link, and the account screens\n  show a banner while an account call is failing.\n- **Privacy.** The publishable key is public by design."
 }
];
