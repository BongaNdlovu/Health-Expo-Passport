/* Database-level tests for member commitments and the admin alerts.
   These execute the REAL functions out of supabase/schema.sql against a real Postgres (PGlite, Postgres 18 compiled
   to WebAssembly) inside a fixture that mirrors only the columns those functions touch. A syntax error, a wrong
   column, a missing grant target or a trigger that fires when it should not all fail here — which is the part a
   jsdom harness can never reach.

   Run:   npm run test:db
   Needs: npm i -D @electric-sql/pglite        (dev-only; the app itself still has no dependencies)
   Not part of `npm test`: the smoke harness needs no database and must keep running with none installed. */

const fs = require('fs');
const path = require('path');

let PGlite;
/* either a dev dependency here, or the shared install the other two suites use (NEWSTART_PGLITE) */
try { ({ PGlite } = require('@electric-sql/pglite')); }
catch (e) {
  const shared = process.env.NEWSTART_PGLITE;
  if (!shared) { console.error('This test needs @electric-sql/pglite:  npm i -D @electric-sql/pglite  (or set NEWSTART_PGLITE)'); process.exit(2); }
  ({ PGlite } = require(path.join(shared, 'node_modules', '@electric-sql', 'pglite')));
}

const root = path.join(__dirname, '..');
const SCHEMA = fs.readFileSync(path.join(root, 'supabase', 'schema.sql'), 'utf8');

/* Pull one function out of the shipped schema, verbatim, so what is tested is what is deployed. */
function fn(name) {
  const start = SCHEMA.indexOf('create or replace function public.' + name + '(');
  if (start < 0) throw new Error('schema.sql has no function public.' + name);
  const end = SCHEMA.indexOf('\n$$;', start);
  if (end < 0) throw new Error('unterminated body for ' + name);
  return SCHEMA.slice(start, end + 4);
}
function trigger(name) {
  const start = SCHEMA.indexOf('create trigger ' + name);
  if (start < 0) throw new Error('schema.sql has no trigger ' + name);
  return SCHEMA.slice(start, SCHEMA.indexOf(';', start) + 1);
}

let checks = 0, fails = 0;
function ok(name, cond, detail) {
  checks++;
  if (cond) console.log('  PASS  ' + name);
  else { fails++; console.log('  FAIL  ' + name + (detail === undefined ? '' : '  → ' + detail)); }
}
const count = async (db, sql, args) => Number((await db.query(sql, args)).rows[0].c);

const CHURCH = '11111111-1111-1111-1111-111111111111';
const ADMIN = '22222222-2222-2222-2222-222222222222';
const ADMIN2 = '22222222-2222-2222-2222-2222222222a2';
const MEMBER = '33333333-3333-3333-3333-333333333333';
const OTHER = '44444444-4444-4444-4444-444444444444';

const FIXTURE = `
create extension if not exists plpgsql;
create schema if not exists auth;

create table auth.users (id uuid primary key);
/* exactly how Supabase exposes the caller: the JWT subject, absent when nobody is signed in */
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.churches (
  id uuid primary key, name text not null default 'Church', status text not null default 'active');

create table public.memberships (
  user_id uuid primary key,
  church_id uuid not null references public.churches (id) on delete cascade,
  volunteer_id text,
  role text not null default 'member',
  status text not null default 'approved');

create table public.volunteers (
  church_id uuid not null references public.churches (id) on delete cascade,
  id text not null,
  name text not null,
  status text not null default 'prospect',
  pledge_expos integer not null default 1,
  pref text[] not null default '{}',
  booth text,
  shift text not null default '',
  role text not null default '',
  lead boolean not null default false,
  checked_in boolean not null default false,
  registered_on date,
  updated_at timestamptz not null default now(),
  primary key (church_id, id));

create table public.notifications (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.churches (id) on delete cascade,
  user_id uuid not null,
  kind text not null,
  title text not null check (length(title) <= 120),
  body text not null default '' check (length(body) <= 300),
  created_at timestamptz not null default now(),
  read_at timestamptz);

create or replace function public.booth_title(p_booth text) returns text language sql immutable as $$
  select case p_booth when 'bp' then 'Blood Pressure' when 'sugar' then 'Blood Sugar & Chol.'
                      when 'kitchen' then 'Kitchen Pharmacy' else coalesce(p_booth, '') end
$$;

create or replace function public.is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from public.memberships m join public.churches c on c.id = m.church_id
                  where m.user_id = auth.uid() and m.status = 'approved' and m.role = 'admin'
                    and c.status = 'active')
$$;

/* the real can_place needs the roster; the guard's behaviour under test is its own branch, so deny by default */
create or replace function public.can_place(p_from text, p_to text) returns boolean language sql stable as $$
  select false
$$;
`;

(async () => {
  const db = new PGlite();
  await db.exec(FIXTURE);
  await db.exec(fn('deregister_my_pledge'));
  await db.exec(fn('volunteers_place_guard'));
  await db.exec(fn('volunteers_admin_status_notify'));
  await db.exec(fn('volunteers_admin_withdraw_notify'));
  await db.exec(trigger('volunteers_place_guard'));
  await db.exec(trigger('volunteers_admin_status_notify'));
  await db.exec(trigger('volunteers_admin_withdraw_notify'));

  const as = id => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  const notifs = async (kind) => (await db.query(
    'select user_id, kind, title, body from public.notifications where ($1::text is null or kind = $1) order by id',
    [kind || null])).rows;
  const reset = async () => {
    /* seed as nobody: the guard refuses an unprivileged caller who inserts a team leader */
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec('delete from public.notifications; delete from public.volunteers; delete from public.memberships; delete from public.churches;');
    await db.exec(`insert into public.churches (id) values ('${CHURCH}');
      insert into public.memberships (user_id, church_id, role) values ('${ADMIN}', '${CHURCH}', 'admin');
      insert into public.memberships (user_id, church_id, role, volunteer_id) values ('${MEMBER}', '${CHURCH}', 'member', 'VOL-1');
      insert into public.volunteers (church_id, id, name, status, booth, shift, role, lead, registered_on)
        values ('${CHURCH}', 'VOL-1', 'Thandi Mabaso', 'registered', 'bp', 'morning', 'Team', true, current_date);`);
  };
  const raiseOf = async (call) => { try { await call(); return null; } catch (e) { return String(e.message || e); } };

  /* ------------------------------------------------------------------ */
  console.log('\n1. deregister_my_pledge');
  await reset();
  await as(MEMBER);
  ok('a registered member can deregister', await raiseOf(() => db.query('select public.deregister_my_pledge()')) === null);

  const row = (await db.query("select * from public.volunteers where id = 'VOL-1'")).rows[0];
  ok('status returns to prospect', row.status === 'prospect', row.status);
  ok('the booth is released', row.booth === null, String(row.booth));
  ok('the shift is cleared', row.shift === '', JSON.stringify(row.shift));
  ok('the registration date is cleared', row.registered_on === null, String(row.registered_on));
  ok('a team-lead title is handed back', row.lead === false && row.role === '', row.lead + '/' + row.role);
  ok('the pledge itself survives', row.name === 'Thandi Mabaso' && row.pledge_expos === 1);

  const dn = await notifs('deregister');
  ok('the church admin is told', dn.length === 1 && dn[0].user_id === ADMIN, dn.length + ' rows');
  ok('the alert names the person', dn[0] && dn[0].title === 'Deregistered: Thandi Mabaso', dn[0] && dn[0].title);
  ok('the alert says the pledge still stands', /pledge still stands/.test(dn[0] ? dn[0].body : ''), dn[0] && dn[0].body);

  ok('deregistering twice is refused', /not registered/.test(await raiseOf(() => db.query('select public.deregister_my_pledge()')) || ''));

  await reset();
  await db.exec("update public.volunteers set status = 'checkedin' where id = 'VOL-1'");
  await as(MEMBER);
  const checkedIn = await raiseOf(() => db.query('select public.deregister_my_pledge()'));
  ok('a checked-in member cannot deregister', /checked in/.test(checkedIn || ''), checkedIn);
  ok('...and their row is untouched',
    (await db.query("select status from public.volunteers where id = 'VOL-1'")).rows[0].status === 'checkedin');

  await reset();
  await db.exec("update public.memberships set volunteer_id = null where user_id = '" + MEMBER + "'");
  await as(MEMBER);
  ok('an unlinked member has nothing to deregister', /no pledge/.test(await raiseOf(() => db.query('select public.deregister_my_pledge()')) || ''));

  await reset();
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  ok('a signed-out caller is refused', /sign in first/.test(await raiseOf(() => db.query('select public.deregister_my_pledge()')) || ''));

  /* ------------------------------------------------------------------ */
  console.log('\n2. admin alerts on register / unpledge');
  await reset();
  /* start from a pledge, then take the real transition — the seeded row is already registered */
  await db.exec("update public.volunteers set status = 'prospect', booth = null where id = 'VOL-1'");
  await db.exec('delete from public.notifications');
  await as(ADMIN);
  await db.query("update public.volunteers set status = 'registered', booth = 'sugar' where id = 'VOL-1'");
  const rn = await notifs('register');
  ok('registering alerts the admin', rn.length === 1 && rn[0].user_id === ADMIN, rn.length + ' rows');
  ok('the register alert names the station', rn[0] && /at Blood Sugar & Chol\./.test(rn[0].body), rn[0] && rn[0].body);
  ok('a status that does not move says nothing',
    await (async () => { await db.exec('delete from public.notifications');
      await db.query("update public.volunteers set status = 'registered' where id = 'VOL-1'");
      return (await notifs()).length; })() === 0);

  await reset();
  await as(MEMBER);
  await db.query("delete from public.volunteers where id = 'VOL-1'");
  const wn = await notifs('unpledge');
  ok('a member withdrawl alerts the admin', wn.length === 1, wn.length + ' rows');
  ok('it is worded as a withdrawal', wn[0] && wn[0].title === 'Pledge withdrawn: Thandi Mabaso', wn[0] && wn[0].title);

  await reset();
  await as(ADMIN);
  await db.query("delete from public.volunteers where id = 'VOL-1'");
  const an = await notifs('unpledge');
  ok('an admin removal is worded differently', an[0] && an[0].title === 'Removed from the roster: Thandi Mabaso', an[0] && an[0].title);
  ok('...and says an admin did it', an[0] && /An admin took them off/.test(an[0].body), an[0] && an[0].body);

  /* ------------------------------------------------------------------ */
  console.log('\n3. every admin, once, and nothing on a church delete');
  await reset();
  await db.exec("insert into public.memberships (user_id, church_id, role) values ('" + ADMIN2 + "', '" + CHURCH + "', 'admin')");
  await as(MEMBER);
  await db.query('select public.deregister_my_pledge()');
  const both = await notifs('deregister');
  ok('both admins are told', both.length === 2 && both.map(r => r.user_id).sort().join() === [ADMIN, ADMIN2].sort().join(), both.length + ' rows');
  ok('a member is not told about their own admin alert', both.every(r => r.user_id !== MEMBER));

  await as(ADMIN);
  const del = await raiseOf(() => db.query('delete from public.churches where id = $1', [CHURCH]));
  ok('deleting a church does not trip the notify trigger', del === null, del);
  ok('and leaves no notification pointing at it',
    await count(db, 'select count(*) c from public.notifications') === 0);

  /* ------------------------------------------------------------------ */
  console.log('\n4. payload limits');
  await reset();
  await as(MEMBER);
  await db.query("update public.volunteers set name = repeat('N', 200) where id = 'VOL-1'");
  await db.query('select public.deregister_my_pledge()');
  const long = (await notifs('deregister'))[0];
  ok('a 200-character name cannot break the 120-character title', long && long.title.length <= 120, long && long.title.length);

  /* ------------------------------------------------------------------ */
  console.log('\n5. the placement guard');
  await reset();
  await as(MEMBER);
  const moved = await raiseOf(() => db.query("update public.volunteers set booth = 'sugar' where id = 'VOL-1'"));
  ok('a member cannot move themselves to another station', /may place volunteers/.test(moved || ''), moved);

  /* somebody else's pledge: the flag must not reach it */
  await reset();
  await db.exec(`insert into public.memberships (user_id, church_id, role, volunteer_id) values ('${OTHER}', '${CHURCH}', 'member', 'VOL-2');
    insert into public.volunteers (church_id, id, name, status, booth) values ('${CHURCH}', 'VOL-2', 'Pieter Botha', 'registered', 'vitals');`);
  await as(MEMBER);
  await db.query('begin');
  await db.query("select set_config('newstart.self_release', 'on', true)");
  const stolen = await raiseOf(() => db.query("update public.volunteers set booth = null where id = 'VOL-2'"));
  await db.query('rollback');          /* the statement failed, so there is nothing to commit */
  ok('...nor release a row that is not theirs', /may place volunteers/.test(stolen || ''), stolen);

  /* the self-release door: their own booth, cleared, inside a flagged transaction */
  await db.query("begin");
  await db.query("select set_config('newstart.self_release', 'on', true)");
  const cleared = await raiseOf(() => db.query("update public.volunteers set booth = null where id = 'VOL-1'"));
  await db.query("commit");
  ok('a member can clear their own booth through the flag', cleared === null, cleared);
  ok('...and it is actually cleared',
    (await db.query("select booth from public.volunteers where id = 'VOL-1'")).rows[0].booth === null);

  await reset();
  await as(MEMBER);
  await db.query("begin");
  await db.query("select set_config('newstart.self_release', 'on', true)");
  const wrongMove = await raiseOf(() => db.query("update public.volunteers set booth = 'sugar' where id = 'VOL-1'"));
  await db.query("rollback");
  ok('the flag does not permit a move, only a release', /may place volunteers/.test(wrongMove || ''), wrongMove);

  await reset();
  await as(ADMIN);
  const adminMove = await raiseOf(() => db.query("update public.volunteers set booth = 'sugar' where id = 'VOL-1'"));
  ok('an admin can still move anybody', adminMove === null, adminMove);

  await reset();
  await as(OTHER);
  const outsider = await raiseOf(() => db.query("update public.volunteers set booth = null where id = 'VOL-1'"));
  ok('a signed-out-of-this-church user cannot touch the row', outsider !== null, 'the update was allowed');

  /* ------------------------------------------------------------------ */
  console.log('\n' + '='.repeat(52));
  console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} DB checks passed`);
  console.log('='.repeat(52));
  await db.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('DB TESTS THREW: ' + (e && e.stack || e)); process.exit(1); });
