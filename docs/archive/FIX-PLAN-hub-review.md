# FIX-PLAN: hub review fixes

Written 2026-10-29 for another AI agent to execute. Base: branch `ui/mockup-v1.3`, last commit `e42c81d`, plus the uncommitted work described below.

Format: plain steps, the exact code, and a verify gate per phase (no gated-fix-plan machinery, as the project owner prefers). Anything not measured this session is marked **VERIFY**: check it yourself before relying on it.

## 1. What this plan fixes

The uncommitted work is a hardening of the volunteer hub. It touches `supabase/schema.sql`, `src/account.js`, `src/volunteer.js`, `.smoke/harness.js`, `package.json`, the generated `dist/*`, and adds `tools/test-volunteer-hub.js` and `tools/serve.js`. A review found one real bug and several smaller problems. This plan fixes all of them.

**Ultimate goal:** a plain staff member (not an admin, not the station leader) can edit, check in and sync volunteers who are already placed at a station, while moving people and choosing leaders stays limited to church admins and the station's team leader. This must be proven by database tests and by the app's test harness, `dist/` must equal a fresh build, installed apps must pick up the change, and the loose files must be dealt with on purpose.

**Definition of done:** every gate in Phases 1 to 7 passed and is written down with its output, and nothing was committed without the owner's say-so.

## 2. Rules for the executing agent

1. **The tree moves.** Another process edited this folder while the review was running (an icon rebrand was committed, then new uncommitted files appeared). Begin every phase with `git status --short` and `git log --oneline -3`. If an edit's "replace this" text does not match the file exactly once, stop and re-read the file; do not force it.
2. **Never discard uncommitted work.** The edits below sit on top of uncommitted changes. Do not run `git checkout`, `git restore`, `git reset`, `git stash` or `git clean` on this folder. A stash named "wip: partial v9 redesign (pre-reset 2026-10-28 21:xx)" already exists: leave it alone.
3. **`dist/` is generated.** Never hand-edit it. Regenerate it only with `npm run build` (Phase 4).
4. **No commits or pushes** until the owner asks. Phase 7 prepares the commit groups only.
5. **Database work uses PGlite only** (in-memory Postgres). Never run `schema.sql` against a real or production Supabase project. The owner does that by hand (Section 12).
6. **Never delete** screenshots, mockups or other untracked files without the owner's explicit yes (Phase 6).
7. **Report honestly.** If a check fails or is skipped, say so with the output.
8. Windows machine. Use forward-slash paths in bash. The PGlite install lives at `C:\Users\fanel\pglite-test`; set it for every DB test:
   `NEWSTART_PGLITE=C:\Users\fanel\pglite-test`

## 3. Issue register

| # | Issue | Evidence | Fixed in |
|---|---|---|---|
| I1 | **Bug.** The new `before insert or update` trigger `volunteers_place_guard` refuses a plain staff member's upsert of a volunteer who is already placed (and of a station leader's row), even when booth and lead are unchanged. The client saves existing rows as upserts, so those edits are never uploaded. | Measured: against the `HEAD` schema 3 of 3 staff cases pass; against the working schema the 2 upsert cases fail with "Only the church's admins and the station's team leader may place volunteers" and "Only the church's admins choose team leaders". | Phase 1 |
| I2 | Tests could not catch I1: the hub test's "staff may still edit a name" case uses a plain `UPDATE`, and the harness mock refuses a row only once, while the real database refuses every time. | Read from `tools/test-volunteer-hub.js` and `.smoke/harness.js`. | Phases 1 and 2 |
| I3 | The header of `tools/test-volunteer-hub.js` says every case failed before the fix. | Measured: against the `HEAD` schema, 14 of the first 26 cases fail and 12 pass. | Phase 1 |
| I4 | The client recognises a placement refusal by exact message text in two places (`cloudError` and `pushOne` in `src/account.js`). Rewording the SQL message would silently turn one stale row into a "bad sign-in" that blocks the whole desk. | Read from the code. | Phases 1 and 2 |
| I5 | A new row with `lead = true` and no booth, linked to a member, would send the notice "You lead  ★" with a blank station. | Measured: the new test fails on the current schema with `[{"title":"You lead  ★"}]`. | Phase 3 |
| I6 | `dist/*` must be rebuilt after the source changes, and must match a fresh build. | Measured: before these fixes it matched byte for byte. | Phase 4 |
| I7 | The service-worker cache version (`tools/build.js`) hashes only the JS bundle and the manifest, so a change to the page shell (colours, markup) or to icons does not change the version, and installed apps can keep serving old files. | Read from `tools/build.js`; the sw.js precache list includes the icons. | Phase 5 |
| I8 | Teal left after the green rebrand: the `.bar-fill` gradient and the WhatsApp-modal header in `index.html`. May be deliberate. | Seen before the rebrand commit; **VERIFY** now. | Phase 5 (owner decides) |
| I9 | Header comment in `tools/make-icons.js` said "NEWSTART teal". | Seen before the rebrand commit; **VERIFY** now. | Phase 5 |
| I10 | `package.json` has a `test:hub` script that points at an untracked file. | Measured from `git diff` and `git status`. | Phase 6 |
| I11 | `tools/serve.js`: a request for a sibling folder such as `dist-x` is served; a malformed `%` URL crashes the server; it listens on every network interface. | Measured on a scratch copy: sibling file returned HTTP 200, malformed URL killed the process. | Phase 6 |
| I12 | 32 untracked files in `verification/shots/` and 2 untracked `mockup-review-*.png` (about 0.7 MB each) in the repo root. | Measured from `git status`. | Phase 6 (owner decides) |
| I13 | Git warns that `dist/_headers` will switch from LF to CRLF. | Measured from `git diff`. | Phase 6 |
| I14 | Not verified at all: real Supabase/PostgREST behaviour, the app in a browser, the Android app. | Not checked. | Section 12 |

## 4. Phase 0: Investigate and verify (read-only)

**Goal:** prove the bug and every finding still hold on the tree as it is now, before anything is edited.

**Go to, and why**

| Place | Why |
|---|---|
| `git status --short`, `git log --oneline -3`, `git diff --stat` | The tree moves; know the exact starting state. |
| `supabase/schema.sql`: function `volunteers_place_guard` and its trigger (at the time of writing ~lines 1429 to 1461, **VERIFY**) | This is the bug. |
| `src/account.js`: `pushDirty` (~1045), `pushOne` (~1062), `resolvePlacement` (~1078), `cloudError` (~943), `conflictOn` (~36) (**VERIFY** line numbers) | Confirms existing rows are saved with `upsert(..., {onConflict: conflictOn()})`, singly and in batches of up to 100 (`pushDirty` falls back to `pushOne` per row when a batch fails), which is what fires the `BEFORE INSERT` trigger. |
| `supabase/schema.sql` ~line 564 | Confirms the primary key of `volunteers` is `(church_id, id)` (the loop `alter table public.%I add primary key (church_id, id)`), so `on conflict (church_id,id)` in the tests matches the real request. **VERIFY** that `volunteers` is one of the tables in that loop. |
| `tools/test-volunteer-hub.js`, `.smoke/harness.js` (search `refuseOnce`) | Confirms why the tests missed it. |

**Steps**

1. Run the baseline suites and record the numbers:
   ```bash
   cd "C:/Users/fanel/Downloads/Health Expo"
   export NEWSTART_PGLITE="C:\\Users\\fanel\\pglite-test"
   npm run typecheck
   npm run test:hub
   npm test
   ```
   Expected today: typecheck prints no errors; hub `RESULT: 26 passed, 0 failed`; harness `all 991 checks passed` (the harness takes about a minute).
2. Reproduce I1 before fixing it. Create a throwaway probe in a scratch folder (not in the project) that copies the setup block of `tools/test-volunteer-hub.js` (everything above the `1. the place guard` heading), then, as the staff user `bob`, runs:
   ```sql
   insert into public.volunteers (church_id,id,name,status,booth,lead,role)
   values ($1,'VOL-9500','Renamed by upsert','registered','plan',false,'')
   on conflict (church_id,id) do update
     set name=excluded.name, booth=excluded.booth, lead=excluded.lead, role=excluded.role
   returning id
   ```
   after `carol` (admin) inserted `VOL-9500` at station `plan`. Expect the refusal "Only the church's admins and the station's team leader may place volunteers". Run the same probe against `git show HEAD:supabase/schema.sql` and expect success.
3. Re-check I8, I9: `grep -n "58b5a7\|2f8b7f\|8ed4c8" index.html` and `grep -n -i teal tools/make-icons.js`.
4. Re-check I11: read `tools/serve.js` and confirm the `startsWith(ROOT)` test and the unguarded `decodeURIComponent`.

**Gate 0:** write a table (issue, still true yes/no, evidence). If the I1 probe does **not** fail on the working schema, stop and report. Do not "fix" a bug that does not reproduce.

## 5. Phase 1: Fix the bug in the database (I1, I3, and the database half of I4)

**Goal:** a plain staff member's upsert of an unchanged placed row succeeds; a real insert, or any change of booth or lead, is still refused; the refusals carry a stable marker.

**Go to:** `supabase/schema.sql`, function `volunteers_place_guard`. And `tools/test-volunteer-hub.js` for the tests.

**Why this fix.** Postgres runs `BEFORE INSERT` triggers on the proposed row even when the upsert will turn into an update. The new insert branch therefore judges an existing row as if it were new and placed. If the row already exists, the insert branch should step aside and let the `BEFORE UPDATE` branch judge the real old and new values, which is exactly the rule a plain update already follows (and it already worked). A plain insert of an existing id still fails on the primary key, so nothing slips through. If the lookup cannot see the row, the checks simply run (stricter, never looser).
Rejected alternatives: removing the insert trigger (re-opens "staff cannot INSERT a row already placed / a leader", which the hub tests pin); using `TG_OP` (an upsert reports `INSERT`, so it cannot tell them apart).

**The hint.** The four `raise exception` lines in this function also get `hint = 'place_guard'`. Supabase's API returns it to the client as `error.hint`, so the client (Phase 2) can stop depending on the wording. It is in the same lines, so it is done in one edit.

**Edit 1.1** — in `supabase/schema.sql`, replace the body of `volunteers_place_guard` from `if tg_op = 'INSERT' then` to the final `return new;`:

Replace this:

````sql
  if tg_op = 'INSERT' then
    if new.lead and not (public.is_admin() or v_lead_ok) then
      raise exception 'Only the church''s admins choose team leaders' using errcode = '42501';
    end if;
    if new.booth is not null and not (public.is_admin() or public.can_place(null, new.booth)) then
      raise exception 'Only the church''s admins and the station''s team leader may place volunteers' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.lead is distinct from old.lead
     and not (public.is_admin() or v_lead_ok) then
    raise exception 'Only the church''s admins choose team leaders' using errcode = '42501';
  end if;
  if new.booth is distinct from old.booth
     and not (public.is_admin() or public.can_place(old.booth, new.booth)) then
    raise exception 'Only the church''s admins and the station''s team leader may place volunteers' using errcode = '42501';
  end if;
  return new;
````

with this:

````sql
  if tg_op = 'INSERT' then
    /* An upsert (insert ... on conflict do update) fires this BEFORE INSERT trigger for the row it is about to
       update. That row is judged by the update branch below, against its real old values, exactly like a plain
       update. A plain insert of an id that exists fails on the primary key anyway, so nothing slips through here.
       The lookup ignores RLS (security definer); if it cannot see the row the check below simply runs, which is
       the stricter outcome. */
    if exists (select 1 from public.volunteers v where v.church_id = new.church_id and v.id = new.id) then
      return new;
    end if;
    if new.lead and not (public.is_admin() or v_lead_ok) then
      raise exception 'Only the church''s admins choose team leaders' using errcode = '42501', hint = 'place_guard';
    end if;
    if new.booth is not null and not (public.is_admin() or public.can_place(null, new.booth)) then
      raise exception 'Only the church''s admins and the station''s team leader may place volunteers' using errcode = '42501', hint = 'place_guard';
    end if;
    return new;
  end if;
  if new.lead is distinct from old.lead
     and not (public.is_admin() or v_lead_ok) then
    raise exception 'Only the church''s admins choose team leaders' using errcode = '42501', hint = 'place_guard';
  end if;
  if new.booth is distinct from old.booth
     and not (public.is_admin() or public.can_place(old.booth, new.booth)) then
    raise exception 'Only the church''s admins and the station''s team leader may place volunteers' using errcode = '42501', hint = 'place_guard';
  end if;
  return new;
````

**Edit 1.2** — in `tools/test-volunteer-hub.js`, fix the false header claim (replace line 3's text):

````text
   Every case here failed before the matching fix in supabase/schema.sql. */
````

with:

````text
   Against the schema as committed at e42c81d, 14 of the first 26 cases fail (measured); the rest pin behaviour that
   must stay, and section 12 is such a pin: an upsert is judged like an update. */
````

**Edit 1.3** — in `tools/test-volunteer-hub.js`, add section 12 before the final `RESULT` line. Replace this one line:

````js
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
````

with this block (it ends with the same `RESULT` line):

````js
  console.log('\n12. an upsert is judged like an update, not like a new row');
  const upsert = (uid, id, name, booth, lead) => as(uid,
    `insert into public.volunteers (church_id,id,name,status,booth,lead,role) values ($1,$2,$3,'registered',$4,$5,$6)
     on conflict (church_id,id) do update set name=excluded.name, booth=excluded.booth, lead=excluded.lead, role=excluded.role
     returning id`, [B, id, name, booth, lead, lead ? 'Team leader' : '']);
  await as(U.carol, `insert into public.volunteers (church_id,id,name,status,booth) values ($1,'VOL-9500','Placed Person','registered','plan')`, [B]);
  await as(U.carol, `insert into public.volunteers (church_id,id,name,status,booth,lead,role) values ($1,'VOL-9501','Placed Leader','registered','media',true,'Team leader')`, [B]);
  r = await upsert(U.bob, 'VOL-9500', 'Renamed by staff', 'plan', false);
  ok('staff may upsert an already-placed row whose station and leader flag are unchanged', !r.error, msg(r));
  r = await upsert(U.bob, 'VOL-9501', 'Leader renamed by staff', 'media', true);
  ok('...including a station leader\'s row', !r.error, msg(r));
  r = await upsert(U.bob, 'VOL-9500', 'Moved by staff', 'sugar', false);
  ok('but an upsert that moves the station is refused', !!r.error && /may place volunteers/.test(r.error.message), msg(r));
  ok('...and the refusal carries the hint the app looks for', !!r.error && r.error.hint === 'place_guard', r.error && JSON.stringify(r.error.hint));
  r = await upsert(U.bob, 'VOL-9500', 'Promoted by staff', 'plan', true);
  ok('and so is one that makes somebody a leader', !!r.error && /choose team leaders/.test(r.error.message), msg(r));
  r = await upsert(U.bob, 'VOL-9502', 'New and placed', 'plan', false);
  ok('an upsert of an id that does not exist yet is a new row, refused when it is placed', !!r.error && /may place volunteers/.test(r.error.message), msg(r));
  row = (await SQL(`select name,booth,lead from public.volunteers where church_id=$1 and id='VOL-9500'`, [B]))[0];
  ok('the refused upserts changed nothing', row.name === 'Renamed by staff' && row.booth === 'plan' && row.lead === false, JSON.stringify(row));
  r = await upsert(U.carol, 'VOL-9500', 'Moved by admin', 'sugar', false);
  ok('a church admin may still move a person with an upsert', !r.error, msg(r));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
````

Notes on the test: the new ids `VOL-9500`, `VOL-9501`, `VOL-9502` and the station `media` are not used by sections 1 to 11 (**VERIFY** with a search before running). `bob` is a staff member who leads station `kids`, so he is neither an admin nor the leader of `plan` or `media`.

**Gate 1 (all must hold):**
1. `npm run test:hub` prints `RESULT: 34 passed, 0 failed` (26 old + 8 new).
2. **Mutation check:** temporarily put the old guard back (or run the new tests against `git show HEAD:supabase/schema.sql` plus the uncommitted hub fixes, i.e. the schema from before this edit). Cases "staff may upsert an already-placed row…", "…including a station leader's row", "…refusal carries the hint…" and "the refused upserts changed nothing" must **fail**. Then restore the fix and re-run. (Measured in a scratch copy: with the old schema the combined suite gave 30 passed, 5 failed; one of those 5 is the Phase 3 case.)
3. Refused upserts leave the row untouched (covered by "the refused upserts changed nothing").

## 6. Phase 2: Make the client robust and test the real failure shape (I2, I4)

**Goal:** the client recognises a placement refusal by its hint (or, on a database that has not been updated yet, by its message), and the harness proves that a refusal that repeats cannot loop or block the desk.

**Go to:** `src/account.js` and `.smoke/harness.js`.

**Why.** Today the same message regex is written twice (`cloudError`, `pushOne`). One helper means one place to maintain. The helper accepts either signal so an app that reaches users before the schema update, or after a future rewording, still behaves. The harness mock only refuses once; the real database refuses the same row each time, so a case where the refusal repeats (one retry, then the row is skipped with a toast, no endless loop, desk not blocked) must be tested.

**Edit 2.1** — `src/account.js`: add the helper just above `function cloudError`. Replace:

````js
/* ---------- pull, merge, push ---------- */
function cloudError(err,where){
````

with:

````js
/* ---------- pull, merge, push ---------- */
/* The place-guard trigger answers 42501 with hint 'place_guard'. The message test keeps a database that has not
   been updated yet working. Either way it is one row another desk has moved, not a bad sign-in. */
const isPlaceRefusal=e=>!!e&&e.code==='42501'&&(e.hint==='place_guard'||/may place volunteers|choose team leaders/i.test(e.message||''));
function cloudError(err,where){
````

**Edit 2.2** — `src/account.js`, in `cloudError`. Replace this line:

````js
 if(err&&(err.code==='42501'||/row-level security|permission denied/i.test(msg))&&!/may place volunteers|choose team leaders/i.test(msg))
````

with:

````js
 if(err&&(err.code==='42501'||/row-level security|permission denied/i.test(msg))&&!isPlaceRefusal(err))
````

**Edit 2.3** — `src/account.js`, in `pushOne`. Replace this line:

````js
 const placeRefused=error.code==='42501'&&/may place volunteers|choose team leaders/i.test(error.message||'');
````

with:

````js
 const placeRefused=isPlaceRefusal(error);
````

**Edit 2.4** — `.smoke/harness.js`, the fake server. Replace:

````js
      if (srv.refuseOnce && srv.refuseOnce.has(this.row.id)) {          /* the place guard's 42501, once */
        srv.refuseOnce.delete(this.row.id);
        return { data: null, error: { code: '42501', message: "Only the church's admins and the station's team leader may place volunteers" } };
      }
````

with:

````js
      /* the place guard's 42501: once (another desk moved the row) or every time (the database keeps refusing it).
         srv.guardStyle words the error: 'both' (hint and message, the default), 'hint' (message reworded) or
         'message' (an older database that sends no hint) */
      const guardError = () => {
        const style = srv.guardStyle || 'both';
        return { data: null, error: { code: '42501',
          message: style === 'hint' ? 'Placement refused' : "Only the church's admins and the station's team leader may place volunteers",
          ...(style === 'message' ? {} : { hint: 'place_guard' }) } };
      };
      if (srv.refuseOnce && srv.refuseOnce.has(this.row.id)) {
        srv.refuseOnce.delete(this.row.id);
        return guardError();
      }
      if (srv.refuseAlways && srv.refuseAlways.has(this.row.id)) return guardError();
````

**Edit 2.5** — `.smoke/harness.js`, add the new cases at the end of the existing "placement refusal" block. Replace:

````js
    srv.refuseOnce = null;
  }

  /* tables missing */
````

with:

````js
    /* a refusal that repeats (the real database refuses the same row every time): one retry, then skipped, no loop */
    const serverCopy = (r, booth) => ({ ...g.volToRow({ ...r, booth }), created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });
    const x = mk('VOL-8103', 'Always Refused', 'sugar');
    g.volunteers.push(x);
    srv.tables.volunteers.set(x.id, serverCopy(x, 'bp'));
    C.synced.vol[x.id] = g.sigOf(g.volToRow({ ...x, booth: 'bp' }));
    x.name = 'Edited Here';
    srv.refuseAlways = new Set([x.id]);
    const callsBefore = srv.calls.length;
    await g.cloudPush();
    const sent = srv.calls.slice(callsBefore).filter(c => c === 'upsert:volunteers:' + x.id).length;
    ok('a placement refusal that repeats is tried twice at most, then skipped, and does not block the desk',
      sent === 2 && !!C.rejected[x.id] && C.blocked === false,
      JSON.stringify({ sent, blocked: C.blocked, rejected: Object.keys(C.rejected) }));
    srv.refuseAlways = null;
    /* recognised by the hint even if the message is reworded, and by the message on a database that sends no hint */
    for (const [style, id] of [['hint', 'VOL-8104'], ['message', 'VOL-8105']]) {
      const y = mk(id, 'Style ' + style, 'sugar');
      g.volunteers.push(y);
      srv.tables.volunteers.set(y.id, serverCopy(y, 'bp'));
      C.synced.vol[y.id] = g.sigOf(g.volToRow({ ...y, booth: 'bp' }));
      y.name = 'Edited ' + style;
      srv.guardStyle = style;
      srv.refuseOnce = new Set([y.id]);
      await g.cloudPush();
      ok('a placement refusal worded "' + style + '" is one row, not a bad sign-in',
        C.blocked === false && y.booth === 'bp' && !C.rejected[y.id],
        JSON.stringify({ blocked: C.blocked, booth: y.booth, rejected: Object.keys(C.rejected) }));
    }
    srv.guardStyle = null;
    srv.refuseOnce = null;
    srv.refuseAlways = null;
  }

  /* tables missing */
````

**Gate 2:**
1. `npm run typecheck` prints no errors (measured in a scratch copy: exit 0).
2. `npm test` reports 994 checks (991 + 3 new), all passing. The three new cases are: "a placement refusal that repeats is tried twice at most, then skipped, and does not block the desk", and the two "worded …" cases.
3. **Mutation check:** put the original `src/account.js` back temporarily; the case worded "hint" must fail (measured: `blocked: true`). The case worded "message" then also fails, but only as a knock-on of the earlier failure leaving `C.blocked` set (inferred, not separately isolated). Restore the fix.

## 7. Phase 3: Remove the blank-station notice (I5)

**Goal:** a leader row without a station does not send a notice with an empty name.

**Go to:** `supabase/schema.sql`, function `volunteers_notify_new` (~line 1765, **VERIFY**).

**Why.** `booth_title(null)` returns an empty string (it ends in `coalesce(p_booth, '')`), so the title would read "You lead  ★". The notice has no meaning without a station, so it is skipped. The placement notice already has the same `booth is not null` condition.

**Edit 3.1** — `supabase/schema.sql`. Replace:

````sql
  if new.lead then
    perform public.notify(new.church_id, v_user, 'lead',
      'You lead ' || public.booth_title(new.booth) || ' ★',
````

with:

````sql
  if new.lead and new.booth is not null then
    perform public.notify(new.church_id, v_user, 'lead',
      'You lead ' || public.booth_title(new.booth) || ' ★',
````

**Edit 3.2** — `tools/test-volunteer-hub.js`, add section 13 before the final `RESULT` line. Replace this one line:

````js
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
````

with:

````js
  console.log('\n13. a leader row with no station does not produce a notice with a blank name');
  await SQL(`update public.memberships set volunteer_id='VOL-9600' where user_id=$1`, [U.mallory]);
  r = await as(U.carol, `insert into public.volunteers (church_id,id,name,status,lead,role) values ($1,'VOL-9600','Leader No Station','prospect',true,'Team leader') returning id`, [B]);
  const leadNotes = await SQL(`select title from public.notifications where user_id=$1 and kind='lead'`, [U.mallory]);
  ok('the insert succeeds and no "You lead" notice is sent without a station', !r.error && leadNotes.length === 0, msg(r) + ' ' + JSON.stringify(leadNotes));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
````

**Gate 3:** `npm run test:hub` prints `RESULT: 35 passed, 0 failed`. Mutation: with the old `if new.lead then`, the new case fails (measured: it returned `[{"title":"You lead  ★"}]`).

## 8. Phase 4: Rebuild `dist/` (I6)

**Goal:** `dist/` is exactly what the sources produce, with a fresh cache version.

**Go to:** the project root, then `dist/`.

**Why.** Source edits change the JS bundle, so the committed `dist/` is stale until rebuilt. `dist/` is committed, and the Android app packages it. Rebuilding by hand-editing would drift.

**Steps**
1. Apply Edit 5.1 (the `tools/build.js` cache-version change) before this build, so the project is built only once with the final version logic. Its gate runs in a scratch copy and does not need the real `dist/`.
2. `npm run build`.
3. `dist/newstart.apk` is copied only if `capacitor/android/app-release-signed.apk` exists (`tools/build.js`, near the end). That APK is git-ignored. Check it is still in `dist/` afterwards; if the source file is missing the build will not copy one. Report that; do not create one.
4. Verify against a build made elsewhere (this worked in the review session):
   ```bash
   S="C:/Users/fanel/AppData/Local/Temp/verify-build"; rm -rf "$S"; mkdir -p "$S"
   cd "C:/Users/fanel/Downloads/Health Expo"
   tar --force-local --exclude=./node_modules --exclude=./.git --exclude=./verification --exclude=./dist --exclude=./android --exclude=./capacitor --exclude=./app-blueprint -cf - . | tar --force-local -xf - -C "$S"
   ```
   ```powershell
   New-Item -ItemType Junction -Path "$env:TEMP\verify-build\node_modules" -Target "C:\Users\fanel\Downloads\Health Expo\node_modules"
   ```
   ```bash
   cd "$S" && node tools/build.js | head -1
   cd "C:/Users/fanel/Downloads/Health Expo"
   for f in index.html sw.js _headers manifest.webmanifest; do cmp -s "dist/$f" "$S/dist/$f" && echo "same $f" || echo "DIFF $f"; done
   for f in dist/icons/*; do cmp -s "$f" "$S/$f" && echo "same $f" || echo "DIFF $f"; done
   ```

**Gate 4:** every file prints `same`. `git diff --stat -- dist` shows `index.html`, `sw.js` and `_headers` changed (new bundle, new cache version, new CSP hash) and nothing unexpected.

## 9. Phase 5: Carry-over findings from the first review (I7, I8, I9)

**Goal:** installed apps pick up changes to the page shell and icons; the rebrand is finished or knowingly left.

**Go to:** `tools/build.js`, `index.html`, `tools/make-icons.js`.

### 9.1 Cache version (I7)

**Why.** `sw.js` names its cache `newstart-shell-<VERSION>` and deletes older caches on activation. The version only changes when the bundle or manifest changes, so a colours-only or icons-only release keeps the old cache name and installed apps can keep the old shell and icons. The fix fingerprints the bundle, the page shell, the manifest and the icons.

**Edit 5.1** — `tools/build.js`. Replace this one line (find it with `grep -n "const version" tools/build.js`):

````js
const version = crypto.createHash('sha1').update(bundle).update(fs.readFileSync(path.join(root, 'manifest.webmanifest'))).digest('hex').slice(0, 10);
````

with:

````js
/* The cache version fingerprints everything the service worker precaches or serves: the app bundle, the page shell
   (styles and markup), the manifest and the icons. Hashing only the bundle and manifest left a change to colours or
   icons under the old cache name, so installed apps kept serving the old files. */
const versionHash = crypto.createHash('sha1').update(bundle).update(minifiedShell).update(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
for (const f of fs.readdirSync(path.join(root, 'icons')).sort()) versionHash.update(f).update(fs.readFileSync(path.join(root, 'icons', f)));
const version = versionHash.digest('hex').slice(0, 10);
````

`minifiedShell` is defined a few lines above in the same file, so it is in scope.

**Gate 5.1** (all measured in a scratch copy, repeat them):
1. Build twice with no changes: the same `VERSION` both times (it was `5a75d7255e`; yours will differ).
2. Append one byte to `icons/icon-192.png` in a **scratch copy** and rebuild: `VERSION` changes.
3. Change one colour in `index.html` in a scratch copy and rebuild: `VERSION` changes.
4. Restore both and rebuild: the original `VERSION` returns.
Never run these byte-change experiments in the real project.

### 9.2 Teal leftovers (I8) — owner decides

Run `grep -n "58b5a7\|2f8b7f\|8ed4c8" index.html` (before the rebrand commit these were the `.bar-fill` gradient near line 338 and the WhatsApp-modal header near line 1290; **VERIFY** they still exist). Open the app in the browser pane, take one screenshot of the progress bar and one of the WhatsApp modal, and **ask the owner** whether they stay teal. If the owner says change them, use the existing mint tokens from the page's `:root` (`--hx-mint`, `--hx-mint-deep`; **VERIFY** their values in `index.html`) and make the same change in both places: `index.html` is the source and `dist/` is regenerated by Phase 4.

### 9.3 Icon script comment (I9)

`grep -n -i "teal" tools/make-icons.js`. If the file's first-comment still says the icon is drawn "on the NEWSTART teal", change the word to the colour the script actually uses now. Comment only; the icons must not change, and the script does not need to be run for a comment edit (do not run it in the real project: it overwrites 15 icon files). For reference, regenerating from the current script in a scratch copy produced byte-identical files for all 15.

**Gate 5:** 9.1 gate passed; 9.2 answered by the owner; 9.3 changes nothing but a comment.

## 10. Phase 6: Untracked files and housekeeping (I10 to I13)

**Goal:** nothing stray, nothing unsafe, no script pointing at a missing file.

### 10.1 `test:hub` (I10)

`package.json` gains `"test:hub": "node tools/test-volunteer-hub.js"` and the script file is untracked. They must be committed together (Phase 7, group 1). Nothing to edit.

### 10.2 `tools/serve.js` (I11)

It serves `dist/` on port 4173. It is **not** a duplicate of `.smoke/serve.js` (that one serves the project root on port 5173), so do not delete it as a duplicate. Three defects were measured: a request to a sibling folder starting with the same letters (`dist-x`) returned 200, a malformed `%` escape crashed the process, and it binds to every network interface.

**Ask the owner** whether to keep it. If yes, replace the file with this (measured in a scratch copy: `/index.html` 200, sibling-folder request 403, malformed URL 400, server still alive afterwards):

````js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 4173;
const ROOT = path.resolve(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath;
  try { reqPath = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch (e) { res.writeHead(400); return res.end('Bad request'); }          /* a malformed %-escape must not crash the server */
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  /* compare by relative path: "dist-x" also starts with "dist", so a prefix test lets a sibling folder through */
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

/* this-computer only; set HOST=0.0.0.0 to test from a phone on the same network */
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`Health Expo Passport preview server running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
});
````

Why each change: `path.relative` compares real path segments, so `dist-x` no longer passes as `dist`; the `try/catch` turns a bad escape into a 400; `127.0.0.1` keeps it on this computer (set `HOST=0.0.0.0` to test from a phone on the same network). Optionally add `"serve": "node tools/serve.js"` to `package.json` scripts if the owner wants it (ask first).

### 10.3 Screenshots and mockups (I12) — owner decides

List them with sizes (`ls -la mockup-review-*.png`, `du -sh verification/shots`; measured: 32 untracked files in `verification/shots`, the folder is 70 files and about 9.8 MB in total). Propose, do not apply: keep the shots that document a finished screen, move `mockup-review-*.png` into `verification/`, drop debug shots (`jdbg`, `jover` and similar), and add a `.gitignore` line for debug shots. Wait for the owner's yes before deleting or moving anything. I did not open any of these images.

### 10.4 Line endings (I13)

Git warned: `in the working copy of 'dist/_headers', LF will be replaced by CRLF`. Check `git ls-files --eol dist/_headers` and whether a `.gitattributes` exists. Because `dist/_headers` is produced by `tools/build.js` with `\n`, the clean fix is a `.gitattributes` rule such as `dist/_headers text eol=lf`. Ask the owner before adding the file.

**Gate 6:** `git status --short` lists only intended files, every deletion or move was approved by the owner, and `node tools/serve.js` (if kept) answers `/index.html` with 200.

## 11. Phase 7: Final verification and commit preparation

**Goal:** everything proven together; the commits ready, not made.

**Run, in order, and paste the output of each**

```bash
cd "C:/Users/fanel/Downloads/Health Expo"
export NEWSTART_PGLITE="C:\\Users\\fanel\\pglite-test"
npm run typecheck
npm run test:hub
npm test
npm run build
git status --short
git diff --stat
```

**Expected:** typecheck clean; hub `35 passed, 0 failed`; harness `all 994 checks passed` (991 + 3 new; in a scratch copy it showed 1 failure, "Android: the signing key file is referenced and exists", which exists only because the scratch copy lacks the signing folder; it must pass in the real tree, as it did at 991/991); Phase 4's byte comparison still `same` after the final build; no unexpected files in `git status`.

**Suggested commit groups (do not commit until asked):**

| # | Files | Message idea |
|---|---|---|
| 1 | `supabase/schema.sql`, `tools/test-volunteer-hub.js`, `package.json` | `fix(hub): upserts of placed volunteers pass the place guard; hint on refusals; no blank leader notice` |
| 2 | `src/account.js`, `src/volunteer.js`, `.smoke/harness.js` | `fix(sync): recognise placement refusals by hint; harness covers repeating refusals` |
| 3 | `tools/build.js` | `fix(build): cache version covers the page shell and icons` |
| 4 | `dist/*` | `build: regenerate dist` |
| 5 | `tools/serve.js`, `.gitignore`, `.gitattributes` and any approved clean-up | `chore: preview server fixes and housekeeping` |

Group 1 and 2 are separate so a database-only deploy is possible. Group 4 must come after 1 to 3.

## 12. What this plan does not cover (and what the owner must do)

- **Real Supabase.** Run `supabase/schema.sql` on a **staging** project first (the file says it is safe to re-run), sign in as a plain staff member, edit and check in a volunteer who is already placed, and confirm it syncs with no "was not uploaded" toast. Not checked: the Phase 1 test shape was taken from PGlite, not from a real PostgREST request. Deploy order: either order is safe, because the client accepts both the hint and the old message; deploy the schema first because it is what unblocks staff.
- **Browser check.** The new notifications box on the member gate screen and the notification count were exercised by harness mocks only, never viewed in a browser. Not checked.
- **Android app.** The fix reaches the Android app only after `dist/` is rebuilt and the app is rebuilt and signed (`tools/build-app.js`, `tools/sign-app.ps1`; **VERIFY**, see the project's `ANDROID.md`). Not part of this plan.
- **Screenshots and mockup images** were not opened.

## 13. Rollback

- Schema: the changes are `create or replace function` and a trigger that is dropped and recreated, so re-running the previous function text restores the previous behaviour. Keep a copy of the pre-edit `volunteers_place_guard` and `volunteers_notify_new` text before Phase 1 and Phase 3.
- Client, harness, hub test, `build.js`: use a normal editor undo or restore only the exact text you replaced. Do not use `git checkout` on these files (Rule 2).
- `dist/`: re-run `npm run build`.

## 14. Appendix: what was measured while writing this plan

All in scratch copies under the temp folder; the project itself was not changed.

| Check | Result |
|---|---|
| All 11 planned edits applied to a copy of the project, each "replace this" text matched exactly once | yes |
| Hub test after Phase 1 / after Phase 3 | 34 passed, 0 failed / 35 passed, 0 failed |
| Hub test, new cases against the schema from before the fix | 30 passed, 5 failed (the new cases fail, as intended) |
| `tsc --noEmit -p jsconfig.json` with the client edits | exit 0, no output |
| Harness with all edits | 994 checks, 1 failure that is an artefact of the scratch copy (missing signing folder) |
| Harness with the original `src/account.js` and the new cases | the "hint" case fails (`blocked: true`) |
| Cache version: two builds, one icon byte changed, one colour changed, restored | same / different / different / same as the first |
| Old `tools/serve.js`: sibling folder request, malformed URL | HTTP 200 / process crashed |
| New `tools/serve.js`: same requests | HTTP 403 / HTTP 400 and still running |
