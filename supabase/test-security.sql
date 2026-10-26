-- Optional tests for the owner rules. Paste into Dashboard → SQL Editor → Run.
-- Everything here is read-only and the whole run is rolled back: nothing is kept.
-- Expected result: every value in the last column reads `t` (true).
begin;

-- 1. the owner (the one platform admin) can read any church's expo data
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', (select user_id from public.platform_admins limit 1)::text,
                    'role', 'authenticated')::text, true);
select public.admin_church_data((select id from public.churches limit 1)) is not null
  as owner_reads_church_data;

-- 2. an ordinary member gets nothing out of admin_church_data …
select set_config('request.jwt.claims',
  json_build_object('sub', (select m.user_id from public.memberships m
                            where not exists (select 1 from public.platform_admins p where p.user_id = m.user_id)
                            limit 1)::text,
                    'role', 'authenticated')::text, true);
select public.admin_church_data((select id from public.churches limit 1)) is null
  as member_gets_no_church_data;

-- 3. … and Row Level Security hands them zero rows from any other church
select not exists (
  select 1 from public.attendees a
  where a.church_id <> (select church_id from public.memberships where user_id = (select auth.uid()))
) as member_sees_no_other_churchs_visitors;

-- The two-admin cap needs a write, so it is not tested here: in the app, try to promote a third
-- admin in a church that already has two — the database refuses with
-- "A church has two admin posts: the Health Department Leader and their Assistant. Both are filled — one must step down first."

rollback;
