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

  console.log('\n14. admins unpledge, deregister and block; a blocked account cannot come back');
  // carol = church B admin (Health Department Leader); alice = app owner; bob = staff; eve and mallory = members
  await SQL(`delete from public.notifications`);
  await SQL(`insert into public.volunteers (church_id,id,name,status,booth,checked_in,lead,role) values ($1,'VOL-9700','Checked In','checkedin','plan',true,false,'Nurse')`, [B]);
  await SQL(`insert into public.volunteers (church_id,id,name,status,booth,shift,registered_on,lead,role) values ($1,'VOL-9701','Registered','registered','sugar','08:30–11:00',current_date,true,'Team leader')`, [B]);
  await SQL(`insert into public.volunteers (church_id,id,name,status) values ($1,'VOL-9702','Just Pledged','prospect')`, [B]);
  await SQL(`insert into public.volunteers (church_id,id,name,status) values ($1,'VOL-9703','Eve Pledge','prospect')`, [B]);
  await SQL(`update public.memberships set volunteer_id='VOL-9702' where user_id=$1`, [U.mallory]);
  await SQL(`update public.memberships set volunteer_id='VOL-9703' where user_id=$1`, [U.eve]);
  ok('staff cannot deregister someone', await refused(U.bob, `select public.admin_deregister('VOL-9701')`));
  ok('staff cannot take back someone else\'s pledge', await refused(U.bob, `select public.admin_unpledge('VOL-9702')`));
  r = await as(U.carol, `select public.admin_deregister('VOL-9701')`);
  row = (await SQL(`select status,booth,shift,registered_on,lead,role from public.volunteers where church_id=$1 and id='VOL-9701'`, [B]))[0];
  ok('an admin deregisters a registered leader: back to pledged, station, shift, date, lead and leader role cleared',
    !r.error && row.status === 'prospect' && row.booth === null && row.shift === '' && row.registered_on === null && row.lead === false && row.role === '', msg(r) + ' ' + JSON.stringify(row));
  let dNote = (await SQL(`select body from public.notifications where church_id=$1 and kind='deregister' and title='Deregistered: Registered'`, [B]))[0];
  ok('...and the deregister alert says an admin took them off the expo', dNote && dNote.body === 'An admin took them off the expo. Their pledge still stands.', JSON.stringify(dNote));
  r = await as(U.carol, `select public.admin_deregister('VOL-9700')`);
  row = (await SQL(`select status,booth,checked_in,lead,role from public.volunteers where church_id=$1 and id='VOL-9700'`, [B]))[0];
  ok('...and a checked-in volunteer clears checked_in while keeping a non-lead role',
    !r.error && row.status === 'prospect' && row.booth === null && row.checked_in === false && row.lead === false && row.role === 'Nurse', msg(r) + ' ' + JSON.stringify(row));
  dNote = (await SQL(`select body from public.notifications where church_id=$1 and kind='deregister' and title='Deregistered: Checked In'`, [B]))[0];
  ok('...and deregistering a checked-in volunteer also alerts the admins', dNote && dNote.body === 'An admin took them off the expo. Their pledge still stands.', JSON.stringify(dNote));
  r = await as(U.carol, `select public.admin_deregister('VOL-9702')`);
  ok('deregistering someone who only pledged says to remove the pledge instead', !!r.error && /remove the pledge/.test(r.error.message), msg(r));
  r = await as(U.carol, `select public.admin_unpledge('VOL-9702')`);
  ok('an admin takes back a pledge: the row is gone', !r.error && (await SQL(`select 1 from public.volunteers where church_id=$1 and id='VOL-9702'`, [B])).length === 0, msg(r));
  ok('...and the member account linked to that pledge is unlinked', (await SQL(`select volunteer_id from public.memberships where user_id=$1`, [U.mallory]))[0].volunteer_id === null);

  // self-block, Assistant-vs-Leader admin target rules, church_members.platform_admin, and second-church isolation
  ok('nobody can block their own account (church or app-wide)',
    await refused(U.carol, `select public.block_member($1,$2)`, [U.carol, B]) && await refused(U.alice, `select public.block_member($1,null)`, [U.alice]));
  await as(U.carol, `select public.set_admin_post($1,'assistant')`, [U.dave]);
  ok('the Assistant cannot block an admin', await refused(U.dave, `select public.block_member($1,$2)`, [U.carol, B]));
  r = await as(U.carol, `select public.block_member($1,$2)`, [U.dave, B]);
  ok('the Health Department Leader can block the Assistant', !r.error && (await SQL(`select 1 from public.memberships where user_id=$1`, [U.dave])).length === 0, msg(r));
  await as(U.carol, `select public.unblock_member($1,$2)`, [U.dave, B]);
  await as(U.dave, `select public.join_church($1,'dave','')`, [B]);
  await as(U.carol, `select public.set_member($1,'member','approved')`, [U.dave]);

  await as(U.alice, `select public.join_church($1,'alice','')`, [B]);
  r = await as(U.carol, `select user_id, platform_admin from public.church_members($1)`, [B]);
  ok('church_members marks the app owner with platform_admin = true and others false',
    !r.error && r.rows.find(x => x.user_id === U.alice).platform_admin === true && r.rows.find(x => x.user_id === U.bob).platform_admin === false, msg(r));
  await as(U.alice, `select public.leave_church()`);

  const frank = '00000000-0000-4000-8000-0000000000d4';
  await SQL(`insert into auth.users (id,email,raw_user_meta_data,email_confirmed_at) values ($1,'frank@example.org','{"full_name":"frank"}'::jsonb,now())`, [frank]);
  const C2 = (await as(frank, `select public.register_church('Church C') as id`)).rows[0].id;
  await as(U.alice, `select public.admin_set_church_status($1,'active')`, [C2]);
  ok('another church\'s admin cannot deregister, unpledge, block or read blocks in church B',
    await refused(frank, `select public.admin_deregister('VOL-1002')`) && await refused(frank, `select public.admin_unpledge('VOL-1002')`)
    && await refused(frank, `select public.block_member($1,$2)`, [U.eve, B]) && await refused(frank, `select * from public.church_blocks($1)`, [B])
    && (await SQL(`select status from public.volunteers where church_id=$1 and id='VOL-1002'`, [B]))[0].status === 'registered');

  ok('staff cannot block anyone', await refused(U.bob, `select public.block_member($1,$2)`, [U.eve, B]));
  ok('a church admin cannot block from the whole app', await refused(U.carol, `select public.block_member($1,null)`, [U.eve]));
  ok('nobody can block the app owner', await refused(U.carol, `select public.block_member($1,$2)`, [U.alice, B]));
  await SQL(`insert into public.volunteers (church_id,id,name,email,status) values ($1,'VOL-9704','Eve Unlinked','  EVE@example.org ','prospect'),($1,'VOL-9705','Other Unlinked','other@example.org','prospect')`, [B]);
  await SQL(`update public.volunteers set email='eve@example.org' where church_id=$1 and id='VOL-1002'`, [B]);
  const inv = (await as(U.carol, `select public.create_church_invite($1,'staff') as code`, [B])).rows[0].code;
  r = await as(U.carol, `select public.block_member($1,$2)`, [U.eve, B]);
  ok('an admin blocks a member from the church: no error', !r.error, msg(r));
  ok('...their membership is gone', (await SQL(`select 1 from public.memberships where user_id=$1`, [U.eve])).length === 0);
  ok('...their linked pledge is gone', (await SQL(`select 1 from public.volunteers where church_id=$1 and id='VOL-9703'`, [B])).length === 0);
  ok('...their unlinked email-matched pledge is also gone', (await SQL(`select 1 from public.volunteers where church_id=$1 and id='VOL-9704'`, [B])).length === 0);
  ok('...while another person\'s unlinked pledge and a shared-email pledge linked to someone else stay',
    (await SQL(`select id from public.volunteers where church_id=$1 and id in ('VOL-1002','VOL-9705') order by id`, [B])).length === 2);
  r = await as(U.eve, `select public.join_church($1,'eve','')`, [B]);
  ok('a blocked account cannot ask to join that church again, and is told so neutrally',
    !!r.error && /can't join this church/.test(r.error.message) && !/block/i.test(r.error.message), msg(r));
  r = await as(U.eve, `select public.join_with_invite($1,'eve','')`, [inv]);
  ok('...nor come back through an invite link', !!r.error && /can't join this church/.test(r.error.message) && !/block/i.test(r.error.message), msg(r));
  r = await as(U.eve, `select public.join_church($1,'eve','')`, [C2]);
  ok('...yet a church-scoped block leaves them free to join a different church', !r.error, msg(r));
  await as(U.eve, `select public.leave_church()`);
  r = await as(U.carol, `select * from public.church_blocks($1)`, [B]);
  ok('the admin sees them on the Blocked list, with name and email', !r.error && r.rows.length === 1 && r.rows[0].email === 'eve@example.org', msg(r));
  ok('a member cannot read the Blocked list', await refused(U.bob, `select * from public.church_blocks($1)`, [B]));
  ok('neither staff nor another church\'s admin can unblock them',
    await refused(U.bob, `select public.unblock_member($1,$2)`, [U.eve, B]) && await refused(frank, `select public.unblock_member($1,$2)`, [U.eve, B]));
  const audit = await SQL(`select op, church_id from public.audit_log where tbl='blocks' and row_id=$1`, [U.eve]);
  ok('the church block is in the change log under that church', audit.some(a => a.op === 'BLOCK' && a.church_id === B), JSON.stringify(audit));
  r = await as(U.carol, `select public.unblock_member($1,$2)`, [U.eve, B]);
  ok('the admin unblocks them', !r.error, msg(r));
  r = await as(U.eve, `select public.join_church($1,'eve','')`, [B]);
  ok('...and they may ask to join again', !r.error, msg(r));

  await SQL(`delete from public.notifications`);
  await SQL(`insert into public.volunteers (church_id,id,name,email,status) values ($1,'VOL-9706','Mallory Unlinked','mallory@example.org','prospect')`, [B]);
  r = await as(U.alice, `select public.block_member($1,null)`, [U.mallory]);
  ok('the app owner blocks an account from the whole app: its membership and unlinked email pledge go',
    !r.error && (await SQL(`select 1 from public.memberships where user_id=$1`, [U.mallory])).length === 0
    && (await SQL(`select 1 from public.volunteers where church_id=$1 and id='VOL-9706'`, [B])).length === 0, msg(r));
  const wNote = (await SQL(`select title,body from public.notifications where church_id=$1 and kind='unpledge' and title='Removed from the roster: Mallory Unlinked'`, [B]))[0];
  ok('...and the church admins receive the admin-authored removal alert, not "Pledge withdrawn"',
    wNote && wNote.body === 'An admin took them off the expo roster.', JSON.stringify(wNote));
  r = await as(U.mallory, `select public.register_church('Mallory Church') as id`);
  ok('...it cannot register a church of its own', !!r.error && /can't join/.test(r.error.message), msg(r));
  ok('...and nothing of that attempt was left behind', (await SQL(`select 1 from public.churches where name='Mallory Church'`)).length === 0);
  r = await as(U.mallory, `select public.join_church($1,'mallory','')`, [B]);
  ok('...nor join any church', !!r.error, msg(r));
  r = await as(U.mallory, `select public.join_with_invite($1,'mallory','')`, [inv]);
  ok('...nor join through an invite link', !!r.error && /can't join/.test(r.error.message), msg(r));
  r = await as(U.alice, `select * from public.church_blocks(null)`);
  ok('the app owner sees the app-wide Blocked list', !r.error && r.rows.some(x => x.user_id === U.mallory), msg(r));
  ok('a church admin cannot read or lift an app-wide block',
    await refused(U.carol, `select * from public.church_blocks(null)`) && await refused(U.carol, `select public.unblock_member($1,null)`, [U.mallory]));
  r = await as(U.alice, `select public.unblock_member($1,null)`, [U.mallory]);
  ok('the app owner unblocks it', !r.error && !(await as(U.mallory, `select public.join_church($1,'mallory','')`, [B])).error, msg(r));
  const appAudit = await SQL(`select op, church_id from public.audit_log where tbl='blocks' and row_id=$1 order by id`, [U.mallory]);
  ok('app-wide BLOCK and UNBLOCK both log church_id = null',
    appAudit.length === 2 && appAudit[0].op === 'BLOCK' && appAudit[0].church_id === null && appAudit[1].op === 'UNBLOCK' && appAudit[1].church_id === null, JSON.stringify(appAudit));

  console.log('\n15. removing a member, or deleting an account, takes their pledge off the team list too');
  // eve rejoined in section 14 (pending): approve her, give her a pledge, then remove her
  await as(U.carol, `select public.set_member($1,'member','approved')`, [U.eve]);
  await SQL(`insert into public.volunteers (church_id,id,name,status) values ($1,'VOL-9710','Eve Again','prospect')`, [B]);
  await SQL(`update public.memberships set volunteer_id='VOL-9710' where user_id=$1`, [U.eve]);
  r = await as(U.carol, `select public.remove_member($1)`, [U.eve]);
  ok('an admin removes a member: their pledge goes with them', !r.error && (await SQL(`select 1 from public.volunteers where church_id=$1 and id='VOL-9710'`, [B])).length === 0, msg(r));
  await SQL(`insert into public.volunteers (church_id,id,name,status) values ($1,'VOL-9711','Untouched Pledge','prospect')`, [B]);
  ok('...and nobody else\'s', (await SQL(`select 1 from public.volunteers where church_id=$1 and id='VOL-9711'`, [B])).length === 1);
  // mallory rejoined in section 14: approve, pledge, then delete her own account
  await as(U.carol, `select public.set_member($1,'member','approved')`, [U.mallory]);
  await SQL(`insert into public.volunteers (church_id,id,name,status,booth) values ($1,'VOL-9712','Mallory Pledge','registered','plan')`, [B]);
  await SQL(`update public.memberships set volunteer_id='VOL-9712' where user_id=$1`, [U.mallory]);
  r = await as(U.mallory, `select public.delete_my_account()`);
  ok('deleting your own account deletes your pledge too, as the app promises', !r.error && (await SQL(`select 1 from public.volunteers where church_id=$1 and id='VOL-9712'`, [B])).length === 0
    && (await SQL(`select 1 from auth.users where id=$1`, [U.mallory])).length === 0, msg(r));

  // a block outlives the login it was made for: deleting the account and registering again with the same email changes nothing
  const IVY = ['00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c3'];
  const IVY_MAIL = ['ivy@example.org', 'Ivy@Example.org', 'IVY@example.ORG'];   // the same address, three letter cases
  const mkIvy = i => SQL(`insert into auth.users (id,email,raw_user_meta_data,email_confirmed_at) values ($1,$2,$3,now())`, [IVY[i], IVY_MAIL[i], JSON.stringify({ full_name: 'Ivy' })]);
  await mkIvy(0);
  await as(IVY[0], `select public.join_church($1,'Ivy','')`, [B]);
  await as(U.carol, `select public.set_member($1,'member','approved')`, [IVY[0]]);
  await as(U.carol, `select public.block_member($1,$2)`, [IVY[0], B]);
  r = await as(IVY[0], `select public.delete_my_account()`);
  ok('a blocked member can still delete their login, and the block stays',
    !r.error && (await SQL(`select 1 from auth.users where id=$1`, [IVY[0]])).length === 0
    && (await SQL(`select 1 from public.blocks where user_id=$1 and church_id=$2`, [IVY[0], B])).length === 1, msg(r));
  await mkIvy(1);
  r = await as(IVY[1], `select public.join_church($1,'Ivy','')`, [B]);
  ok('...registering again with the same email (in any letter case) still cannot join that church, and is told so neutrally',
    !!r.error && /can't join this church/.test(r.error.message) && !/block/i.test(r.error.message), msg(r));
  r = await as(IVY[1], `select public.join_church($1,'Ivy','')`, [C2]);
  ok('...yet a church-scoped block leaves them free to join a different church', !r.error, msg(r));
  await as(IVY[1], `select public.leave_church()`);
  r = await as(U.carol, `select * from public.church_blocks($1)`, [B]);
  ok('the Blocked list still shows them, with name and email, so an admin can lift it',
    !r.error && r.rows.some(x => x.user_id === IVY[0] && x.email === 'ivy@example.org' && x.name === 'Ivy'), msg(r));
  r = await as(U.carol, `select public.unblock_member($1,$2)`, [IVY[0], B]);
  ok('lifting it lets the new account ask to join', !r.error && !(await as(IVY[1], `select public.join_church($1,'Ivy','')`, [B])).error, msg(r));
  await as(IVY[1], `select public.leave_church()`);
  // the same for a block from the whole app
  r = await as(U.alice, `select public.block_member($1,null)`, [IVY[1]]);
  const ivyDel = await as(IVY[1], `select public.delete_my_account()`);
  await mkIvy(2);
  ok('an app-wide block survives the login being deleted: the new account joins no church and registers none',
    !r.error && !ivyDel.error && !!(await as(IVY[2], `select public.join_church($1,'Ivy','')`, [B])).error
    && !!(await as(IVY[2], `select public.join_church($1,'Ivy','')`, [C2])).error
    && !!(await as(IVY[2], `select public.register_church('Ivy Church') as id`)).error
    && (await SQL(`select 1 from public.churches where name='Ivy Church'`)).length === 0, msg(r) + ' ' + msg(ivyDel));
  r = await as(U.alice, `select public.unblock_member($1,null)`, [IVY[1]]);
  ok('...and the app owner lifts it from the old row', !r.error && !(await as(IVY[2], `select public.join_church($1,'Ivy','')`, [B])).error, msg(r));
  await as(IVY[2], `select public.leave_church()`);
  await SQL(`delete from public.notifications where title like '%Ivy%'`);

  console.log('\n16. positions: register as Leader or Assistant; ask to lead only a church with no Leader; the full church list');
  const NEW = { leader2: '00000000-0000-4000-8000-0000000000e1', asst: '00000000-0000-4000-8000-0000000000e2', asker: '00000000-0000-4000-8000-0000000000e3', other: '00000000-0000-4000-8000-0000000000e4' };
  for (const [n, id] of Object.entries(NEW))
    await SQL(`insert into auth.users (id,email,raw_user_meta_data,email_confirmed_at) values ($1,$2,$3,$4)`, [id, n + '@example.org', JSON.stringify({ full_name: n }), new Date().toISOString()]);
  r = await as(NEW.asst, `select public.register_church('Assistant Church','Durban','','','assistant') as id`);
  const AC = r.rows && r.rows[0].id;
  let m = (await SQL(`select role,status,admin_post from public.memberships where user_id=$1`, [NEW.asst]))[0];
  ok('registering as the Assistant makes them an admin holding the Assistant post', !r.error && m.role === 'admin' && m.admin_post === 'assistant', msg(r) + ' ' + JSON.stringify(m));
  r = await as(NEW.leader2, `select public.register_church('Leader Church') as id`);
  m = (await SQL(`select admin_post from public.memberships where user_id=$1`, [NEW.leader2]))[0];
  ok('registering without a choice still makes them the Leader', !r.error && m.admin_post === 'leader', msg(r) + ' ' + JSON.stringify(m));
  const LC = r.rows && r.rows[0].id;
  ok('a made-up post is refused at registration', await refused(NEW.other, `select public.register_church('Odd Church','','','','owner')`));
  await as(U.alice, `select public.admin_set_church_status($1,'active')`, [AC]);
  await as(U.alice, `select public.admin_set_church_status($1,'active')`, [LC]);
  r = await as(NEW.asker, `select * from public.church_directory('')`);
  const dir = r.rows || [];
  ok('the church list says which churches have no Leader yet', dir.some(c => c.id === AC && c.has_leader === false) && dir.some(c => c.id === LC && c.has_leader === true), msg(r));
  for (let i = 0; i < 55; i++) await SQL(`insert into public.churches (name,city,status) values ($1,'Town','active')`, ['Extra Church ' + String(i).padStart(2, '0')]);
  r = await as(NEW.asker, `select count(*)::int n from public.church_directory('')`);
  ok('the church list is no longer cut at 50', !r.error && r.rows[0].n >= 57, msg(r));
  r = await as(NEW.asker, `select public.join_church($1,'Asker','','leader')`, [LC]);
  ok('asking to lead a church that has a Leader is refused, saying so', !!r.error && /already has a Health Department Leader/.test(r.error.message), msg(r));
  r = await as(NEW.asker, `select public.join_church($1,'Asker','','leader')`, [AC]);
  m = (await SQL(`select status,wants from public.memberships where user_id=$1`, [NEW.asker]))[0];
  ok('asking to lead a church with no Leader is a pending request marked leader', !r.error && m.status === 'pending' && m.wants === 'leader', msg(r) + ' ' + JSON.stringify(m));
  const owner = await SQL(`select 1 from public.notifications where user_id=$1 and title like 'Leader request:%'`, [U.alice]);
  ok('...and the app owner is told', owner.length >= 1, JSON.stringify(owner));
  const leaderNotes = async () => (await SQL(`select 1 from public.notifications where user_id=$1 and title='Leader request: Asker'`, [U.alice])).length;
  await as(NEW.asker, `select public.leave_church()`);
  await as(NEW.asker, `select public.join_church($1,'Asker','','leader')`, [AC]);
  ok('...but leaving and asking again within the hour does not tell them a second time', (await leaderNotes()) === 1, String(await leaderNotes()));
  await SQL(`update public.notifications set created_at = now() - interval '2 hours' where user_id=$1 and title='Leader request: Asker'`, [U.alice]);
  await as(NEW.asker, `select public.leave_church()`);
  await as(NEW.asker, `select public.join_church($1,'Asker','','leader')`, [AC]);
  ok('...while a request an hour later is told again', (await leaderNotes()) === 2, String(await leaderNotes()));
  r = await as(U.alice, `select public.set_member($1,'member','approved')`, [NEW.asker]);
  const r2 = await as(U.alice, `select public.set_admin_post($1,'leader')`, [NEW.asker]);
  m = (await SQL(`select role,status,admin_post from public.memberships where user_id=$1`, [NEW.asker]))[0];
  ok('the app owner approves them as the Leader', !r.error && !r2.error && m.role === 'admin' && m.admin_post === 'leader', msg(r) + ' ' + msg(r2) + ' ' + JSON.stringify(m));

  console.log('\n17. the church plan: paid until');
  const PU = '00000000-0000-4000-8000-0000000000f1', PM = '00000000-0000-4000-8000-0000000000f2';
  for (const [id, n] of [[PU, 'planlead'], [PM, 'planmember']])
    await SQL(`insert into auth.users (id,email,raw_user_meta_data,email_confirmed_at) values ($1,$2,$3,$4)`, [id, n + '@example.org', JSON.stringify({ full_name: n }), new Date().toISOString()]);
  r = await as(PU, `select public.register_church('Plan Church') as id`);
  const PC = r.rows[0].id;
  ok('a new church has no plan date yet', (await SQL(`select paid_until from public.churches where id=$1`, [PC]))[0].paid_until === null);
  await as(U.alice, `select public.admin_set_church_status($1,'active')`, [PC]);
  let pu = (await SQL(`select paid_until, (paid_until - current_date) as days from public.churches where id=$1`, [PC]))[0];
  ok('approving it starts the plan a year from today', pu.paid_until !== null && pu.days >= 365 && pu.days <= 366, JSON.stringify(pu));
  await as(U.alice, `select public.admin_set_church_status($1,'suspended')`, [PC]);
  await as(U.alice, `select public.admin_set_church_status($1,'active')`, [PC]);
  ok('pausing and reactivating leaves the date alone', (await SQL(`select (paid_until - current_date) as days from public.churches where id=$1`, [PC]))[0].days === pu.days);
  r = await as(U.alice, `select public.admin_set_paid_until($1, current_date + 400)`, [PC]);
  ok('the app owner records a renewal', !r.error && (await SQL(`select (paid_until - current_date) as days from public.churches where id=$1`, [PC]))[0].days === 400, msg(r));
  ok('a church admin cannot change their own date', await refused(PU, `select public.admin_set_paid_until($1, current_date + 999)`, [PC]));
  ok('a date far in the future is refused', await refused(U.alice, `select public.admin_set_paid_until($1, current_date + 4000)`, [PC]));
  r = await as(PU, `select public.my_account() a`);
  ok('the church admin sees their plan date', !r.error && !!r.rows[0].a.church.paid_until, msg(r));
  await as(PM, `select public.join_church($1,'planmember','')`, [PC]);
  await as(PU, `select public.set_member($1,'member','approved')`, [PM]);
  r = await as(PM, `select public.my_account() a`);
  ok('a plain member does not', !r.error && r.rows[0].a.church && r.rows[0].a.church.paid_until == null, msg(r));
  r = await as(U.alice, `select id, paid_until from public.admin_churches() where id=$1`, [PC]);
  ok('All churches lists the date', !r.error && r.rows.length === 1 && !!r.rows[0].paid_until, msg(r));
  ok('the change log has it', (await SQL(`select 1 from public.audit_log where tbl='churches' and op='PAID_UNTIL' and church_id=$1`, [PC])).length === 1);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
  process.exit(0);
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(2); });
