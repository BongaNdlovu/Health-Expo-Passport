/* Volunteer-hub database regressions (PGlite, in-memory Postgres).
   Run: NEWSTART_PGLITE=C:\Users\fanel\pglite-test node tools/test-volunteer-hub.js
   Against the schema as committed at e42c81d, 14 of the first 26 cases fail (measured); the rest pin behaviour that
   must stay, and section 12 is such a pin: an upsert is judged like an update. */
const path = require('path');
const fs = require('fs');
const PROJ = path.join(__dirname, '..');

(async () => {
  if (!process.env.NEWSTART_PGLITE) {
    console.log('SKIP: set NEWSTART_PGLITE to a folder with @electric-sql/pglite installed (the same setting .smoke/harness.js uses).');
    process.exit(0);
  }
  const { PGlite } = require(path.join(process.env.NEWSTART_PGLITE, 'node_modules', '@electric-sql', 'pglite'));
  const schema = fs.readFileSync(path.join(PROJ, 'supabase', 'schema.sql'), 'utf8');
  const STUB = `
    create role anon nologin; create role authenticated nologin; create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique,
      raw_user_meta_data jsonb not null default '{}'::jsonb, email_confirmed_at timestamptz, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    create publication supabase_realtime;`;
  const U = {
    alice: '00000000-0000-4000-8000-00000000000a', carol: '00000000-0000-4000-8000-00000000000c',
    bob: '00000000-0000-4000-8000-00000000000b', dave: '00000000-0000-4000-8000-0000000000d1',
    mallory: '00000000-0000-4000-8000-0000000000d2', eve: '00000000-0000-4000-8000-0000000000d3',
  };
  const db = new PGlite();
  const as = async (uid, sql, params) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
    try { return { rows: (await db.query(sql, params || [])).rows }; }
    catch (e) { return { error: e }; }
    finally { await db.exec('reset role'); }
  };
  const SQL = async (sql, params) => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    try { return (await db.query(sql, params || [])).rows; }
    catch (e) { return { error: e }; }
  };
  let pass = 0, fail = 0;
  const ok = (name, good, detail) => { good ? pass++ : fail++; console.log(`  ${good ? 'PASS' : 'FAIL'} ${name}${!good && detail !== undefined ? '  -> ' + detail : ''}`); };
  const refused = async (uid, sql, params) => !!(await as(uid, sql, params)).error;
  const msg = r => r.error ? r.error.message : JSON.stringify(r.rows);

  await db.exec(STUB);
  await db.exec(schema);
  for (const [n, id] of Object.entries(U))
    await SQL(`insert into auth.users (id,email,raw_user_meta_data,email_confirmed_at) values ($1,$2,$3,$4)`,
      [id, n + '@example.org', JSON.stringify({ full_name: n }), new Date().toISOString()]);
  await SQL(`insert into public.platform_admins (user_id) values ($1)`, [U.alice]);
  let r = await as(U.carol, `select public.register_church('Church B') as id`);
  const B = r.rows[0].id;
  await as(U.alice, `select public.admin_set_church_status($1,'active')`, [B]);
  for (const who of ['bob', 'dave', 'mallory', 'eve']) {
    await as(U[who], `select public.join_church($1,'${who}','')`, [B]);
    await as(U.carol, `select public.set_member($1,'member','approved')`, [U[who]]);
  }
  await as(U.carol, `select public.set_member($1,'staff','approved')`, [U.bob]);
  // dave: linked leader at Blood Pressure; bob: staff, also linked leader at Kids Corner
  await SQL(`insert into public.volunteers (church_id,id,name,status,booth,lead,role) values ($1,'VOL-1001','Dave Leader','registered','bp',true,'Team leader')`, [B]);
  await SQL(`insert into public.volunteers (church_id,id,name,status,booth,lead,role) values ($1,'VOL-1002','Bob Staff Lead','registered','kids',true,'Team leader')`, [B]);
  await SQL(`insert into public.volunteers (church_id,id,name,status,booth) values ($1,'VOL-9001','Unplaced One','prospect',null)`, [B]);
  await SQL(`insert into public.volunteers (church_id,id,name,status,booth) values ($1,'VOL-9104','Logistics Lead','prospect',null)`, [B]);
  await as(U.carol, `select public.link_volunteer($1,'VOL-1001')`, [U.dave]);
  await as(U.carol, `select public.link_volunteer($1,'VOL-1002')`, [U.bob]);

  console.log('\n1. the place guard, on update and on insert');
  ok('staff cannot move a booth with a whole-row write', await refused(U.bob, `update public.volunteers set booth='plan' where church_id=$1 and id='VOL-9001'`, [B]));
  ok('staff may still edit a name', !(await as(U.bob, `update public.volunteers set name='Unplaced One 2' where church_id=$1 and id='VOL-9001' returning id`, [B])).error);
  ok('staff cannot INSERT a row already placed', await refused(U.bob, `insert into public.volunteers (church_id,id,name,status,booth) values ($1,'VOL-9101','Inserted Placed','registered','plan')`, [B]));
  ok('staff cannot INSERT themselves a leader', await refused(U.bob, `insert into public.volunteers (church_id,id,name,status,lead) values ($1,'VOL-9102','Inserted Lead','prospect',true)`, [B]));
  ok('a church admin may insert a placed leader', !(await as(U.carol, `insert into public.volunteers (church_id,id,name,status,booth,lead,role) values ($1,'VOL-9103','Admin Placed','registered','refresh',true,'Team leader') returning id`, [B])).error);
  ok('a staff member who leads a station cannot hand the title to someone else by writing lead',
    await refused(U.bob, `update public.volunteers set booth='kids', lead=true where church_id=$1 and id='VOL-9001'`, [B]));

  console.log('\n2. team-leader management by a church admin who is not on the old staff list');
  await SQL(`update public.volunteers set booth='logistics' where church_id=$1 and id='VOL-9104'`, [B]);
  r = await as(U.carol, `select public.set_station_lead('logistics','VOL-9104')`);
  ok('a church admin can make a station leader (is_admin() now means the church admin)', !r.error, r.error && r.error.message);

  console.log('\n3. swap keeps the leader with the station and registers the arrival');
  await as(U.carol, `update public.volunteers set booth='sugar', status='prospect' where church_id=$1 and id='VOL-9001'`, [B]);
  r = await as(U.carol, `select public.swap_volunteers('VOL-1001','VOL-9001')`);
  const rows = (await SQL(`select id,booth,lead,role,status from public.volunteers where church_id=$1 and id in ('VOL-1001','VOL-9001') order by id`, [B]));
  ok('the arriving person becomes the station leader', !r.error && rows.find(x => x.id === 'VOL-9001').lead === true, msg(r));
  ok('the departing leader loses the title AND the role text', rows.find(x => x.id === 'VOL-1001').role === '' && rows.find(x => x.id === 'VOL-1001').lead === false, JSON.stringify(rows));
  ok('the arriving person is registered, not left a prospect at a station', rows.find(x => x.id === 'VOL-9001').status === 'registered', JSON.stringify(rows));

  console.log('\n4. release and move clear the flags they must');
  await SQL(`update public.volunteers set status='checkedin', checked_in=true, booth='plan' where church_id=$1 and id='VOL-1001'`, [B]);
  r = await as(U.carol, `select public.release_volunteer('VOL-1001')`);
  let row = (await SQL(`select status, checked_in, booth, lead, role from public.volunteers where church_id=$1 and id='VOL-1001'`, [B]))[0];
  ok('release clears checked_in as well as the station', !r.error && row.checked_in === false && row.status === 'prospect' && row.booth === null, msg(r));
  await SQL(`update public.volunteers set booth='bp', lead=true, role='Team leader' where church_id=$1 and id='VOL-1001'`, [B]);
  r = await as(U.carol, `select public.place_volunteer('VOL-1001','kitchen')`);
  row = (await SQL(`select booth, lead, role from public.volunteers where church_id=$1 and id='VOL-1001'`, [B]))[0];
  ok('moving a leader away clears the title text too', !r.error && row.booth === 'kitchen' && row.lead === false && row.role === '', JSON.stringify(row));

  console.log('\n5. notification text cannot abort a pledge');
  /* a linked leader at bp, so the station-leader notification is actually produced */
  await SQL(`update public.volunteers set lead=false, role='' where church_id=$1 and booth='bp'`, [B]);
  await SQL(`update public.volunteers set booth='bp', lead=true, role='Team leader' where church_id=$1 and id='VOL-1001'`, [B]);
  const longName = 'N'.repeat(150);
  r = await as(U.carol, `insert into public.volunteers (church_id,id,name,status,pref) values ($1,'VOL-9200',$2,'prospect','{bp}') returning id`, [B, longName]);
  ok('a 150-character name no longer breaks the insert', !r.error, msg(r));
  row = (await SQL(`select length(title)::int n from public.notifications where kind='pledge' and title like 'New pledge:%' order by id desc limit 1`))[0];
  ok('the notification title is trimmed to the 120-character column', row && row.n <= 120, JSON.stringify(row));
  const body = (await SQL(`select body from public.notifications where kind='pledge' and title like 'New pledge for your station:%' order by id desc limit 1`))[0];
  ok('the station leader is told which station, not "asked for ."', body && body.body === 'They asked for Blood Pressure.', JSON.stringify(body));
  r = await as(U.mallory, `select public.save_my_pledge($1::jsonb)`, [JSON.stringify({ name: 'Mallory No Station', phone: '0820000000' })]);
  const empty = (await SQL(`select body from public.notifications where title='New pledge: Mallory No Station'`))[0];
  ok('a pledge with no station choice says so', !r.error && empty && empty.body === 'They did not choose a station yet.', JSON.stringify(empty));

  console.log('\n6. the station leader hears about an unlinked arrival');
  await SQL(`delete from public.notifications`);
  await SQL(`update public.volunteers set booth='bp', lead=true, role='Team leader' where church_id=$1 and id='VOL-1001'`, [B]);
  await SQL(`insert into public.volunteers (church_id,id,name,status) values ($1,'VOL-9300','No Account','prospect')`, [B]);
  r = await as(U.carol, `select * from public.place_volunteer('VOL-9300','bp')`);
  const got = (await SQL(`select user_id,kind,title from public.notifications order by id`));
  ok('the leader is told an unlinked volunteer joined (was silent: v_new_lead <> v_user is NULL)',
    !r.error && got.some(x => x.user_id === U.dave && x.kind === 'team' && /joined your team/.test(x.title)), JSON.stringify(got));
  ok('the unlinked volunteer gets no row of their own', !got.some(x => x.kind === 'placement'), JSON.stringify(got));

  console.log('\n7. a volunteer inserted already placed is announced to their member');
  await SQL(`delete from public.notifications`);
  await SQL(`update public.memberships set volunteer_id='VOL-9401' where user_id=$1`, [U.eve]);
  r = await as(U.carol, `insert into public.volunteers (church_id,id,name,status,booth) values ($1,'VOL-9401','Eve Placed','registered','bp') returning id`, [B]);
  const eveRows = (await SQL(`select kind,title from public.notifications where user_id=$1 order by id`, [U.eve]));
  ok('an insert trigger sends the placement word to the linked member',
    !r.error && eveRows.length === 1 && eveRows[0].kind === 'placement' && eveRows[0].title === 'You are placed at Blood Pressure',
    msg(r) + ' ' + JSON.stringify(eveRows));

  console.log('\n8. my_team and the station key');
  r = await as(U.dave, `select * from public.my_team()`);
  ok('the leader is not listed among their own people', !r.error && !r.rows.some(x => x.id === 'VOL-1001'), msg(r));
  r = await as(U.carol, `select length(booth)::int n from public.place_volunteer('VOL-9001', repeat('x',100))`);
  ok('a station key is capped at 40 characters', !r.error && r.rows[0].n === 40, msg(r));

  console.log('\n9. a member may mark read, not rewrite');
  await SQL(`insert into public.notifications (church_id,user_id,kind,title) values ($1,$2,'x','Mine')`, [B, U.mallory]);
  ok('a member cannot rewrite their own notification title', await refused(U.mallory, `update public.notifications set title='FORGED' where user_id=$1`, [U.mallory]));
  ok('a member can stamp read_at on their own rows', !(await as(U.mallory, `update public.notifications set read_at=now() where user_id=$1 returning id`, [U.mallory])).error);
  ok('a member still cannot read another member\'s rows', (await as(U.mallory, `select count(*)::int n from public.notifications where user_id <> $1`, [U.mallory])).rows[0].n === 0);

  console.log('\n10. self-pledge keeps its walls');
  r = await as(U.mallory, `select public.save_my_pledge($1::jsonb)`, [JSON.stringify({ name: 'Mallory M', phone: '0820000000', pref: ['bp'], booth: 'kids', status: 'checkedin', lead: true, role: 'Admin' })]);
  row = (await SQL(`select booth,status,lead,role from public.volunteers where church_id=$1 and name='Mallory M'`, [B]))[0];
  ok('booth, status, lead and role sent by a member are ignored', !r.error && row.booth === null && row.status === 'prospect' && row.lead === false && row.role === '', JSON.stringify(row));

  console.log('\n11. the undo path');
  r = await as(U.carol, `select public.place_volunteer('VOL-9001','')`);
  ok('placing with an empty station still says "Choose a station."', !!r.error && /Choose a station/.test(r.error.message), msg(r));

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

  console.log('\n13. a leader row with no station does not produce a notice with a blank name');
  await SQL(`update public.memberships set volunteer_id='VOL-9600' where user_id=$1`, [U.mallory]);
  r = await as(U.carol, `insert into public.volunteers (church_id,id,name,status,lead,role) values ($1,'VOL-9600','Leader No Station','prospect',true,'Team leader') returning id`, [B]);
  const leadNotes = await SQL(`select title from public.notifications where user_id=$1 and kind='lead'`, [U.mallory]);
  ok('the insert succeeds and no "You lead" notice is sent without a station', !r.error && leadNotes.length === 0, msg(r) + ' ' + JSON.stringify(leadNotes));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(2); });
