-- Optional tests for the owner rules. Paste into Dashboard → SQL Editor → Run.
-- Everything here is read-only and the whole run is rolled back: nothing is kept.
-- The editor shows only the last result, so each check stores its value and one table at the end lists them all.
-- Expected result: 13 rows, and every `ok` reads `t` (true).
-- Needs one church and one platform admin (README step 5). If no ordinary member exists yet (only the owner has joined),
-- a made-up member with no church stands in for checks 2 and 3, and the `note` column says so.
begin;

do $$ begin
  if not exists (select 1 from public.churches) or not exists (select 1 from public.platform_admins) then
    raise exception 'test-security.sql needs at least one church and one platform admin (README step 5): none found';
  end if;
end $$;

-- 1. the owner (the one platform admin) can read any church's expo data
--    (these ids are read as the owner: the authenticated role cannot read those tables itself)
select set_config('test.church', (select id::text from public.churches order by created_at limit 1), true);
select set_config('test.admin', (select user_id::text from public.platform_admins limit 1), true);
select set_config('test.real_member', (exists (select 1 from public.memberships m
  where not exists (select 1 from public.platform_admins p where p.user_id = m.user_id)))::text, true);
select set_config('test.member', coalesce((select m.user_id::text from public.memberships m
  where not exists (select 1 from public.platform_admins p where p.user_id = m.user_id) limit 1), gen_random_uuid()::text), true);
select set_config('test.member_church', coalesce((select church_id::text from public.memberships
  where user_id = current_setting('test.member')::uuid), gen_random_uuid()::text), true);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.admin'), 'role', 'authenticated')::text, true);
select set_config('r.owner_reads_church_data',
  (public.admin_church_data(current_setting('test.church')::uuid) is not null)::text, true);

-- 2. an ordinary member gets nothing out of admin_church_data …
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('test.member'), 'role', 'authenticated')::text, true);
select set_config('r.member_gets_no_church_data',
  (public.admin_church_data(current_setting('test.church')::uuid) is null)::text, true);

-- 3. … and Row Level Security hands them zero rows from any other church
select set_config('r.member_sees_no_other_churchs_visitors', (not exists (
  select 1 from public.attendees a
  where a.church_id <> current_setting('test.member_church')::uuid
))::text, true);

-- The two-admin cap needs a write, so it is not tested here: in the app, try to promote a third
-- admin in a church that already has two — the database refuses with
-- "A church has two admin posts: the Health Department Leader and their Assistant. Both are filled — one must step down first."

-- 4. the 7-day rule: the visits are written on the day, and then a week passes
--    (a visit's date cannot be moved any more, so the trigger is off for the one update that plays the week)
reset role;
select set_config('request.jwt.claims', '', true);   -- signed out: the purge must not think a member is calling it
insert into public.attendees (church_id, id, name, age, height_cm, s, prayer, chronic_list, interests)
select id, 'EXPO-991', 'Purge Follow-up', 50, 170, '{"sys":150,"dia":95}', 'pray', 'asthma',
       jsonb_build_object('consent', true, 'optin', true, 'consentOn', to_char(now(), 'YYYY-MM-DD'))
from public.churches order by created_at limit 1;
insert into public.attendees (church_id, id, name, age, height_cm, s, prayer, interests)
select id, 'EXPO-992', 'Purge No Follow-up', 40, 165, '{"sys":120,"dia":80}', '',
       jsonb_build_object('consent', true, 'optin', false, 'consentOn', to_char(now(), 'YYYY-MM-DD'))
from public.churches order by created_at limit 1;
insert into public.attendees (church_id, id, name, age, height_cm, s, interests)
select id, 'EXPO-993', 'Purge Fresh', 30, 160, '{"sys":118,"dia":78}',
       jsonb_build_object('consent', true, 'optin', false, 'consentOn', to_char(now(), 'YYYY-MM-DD'))
from public.churches order by created_at limit 1;

alter table public.attendees disable trigger attendees_retention;
update public.attendees set created_at = now() - interval '8 days',
  interests = interests || jsonb_build_object('consentOn', to_char(now() - interval '8 days', 'YYYY-MM-DD'))
 where id in ('EXPO-991', 'EXPO-992');
update public.attendees set created_at = now() - interval '6 days' where id = 'EXPO-993';
alter table public.attendees enable trigger attendees_retention;

-- 5. a visit written on the day kept its readings, and the old visit still holds its own until a write or the purge
select set_config('r.fresh_visit_kept',
         coalesce((select s ->> 'sys' = '118' from public.attendees where id = 'EXPO-993'), false)::text, true),
       set_config('r.old_visit_not_yet_written_since',
         coalesce((select s ->> 'sys' = '150' from public.attendees where id = 'EXPO-991'), false)::text, true);

-- 6. a phone that was offline sends its old copy back: the trigger clears the readings, but keeps the person
update public.attendees set s = '{"sys":150,"dia":95}'::jsonb, prayer = 'pray again', height_cm = 170 where id = 'EXPO-991';
select set_config('r.reupload_cleared_by_trigger',
         coalesce((select s = '{}'::jsonb and prayer = '' and height_cm is null
                     from public.attendees where id = 'EXPO-991'), false)::text, true);

-- 7. the daily purge deletes the old visitor who did not opt in, and keeps the fresh one and the follow-up
select set_config('r.purge_deleted_old', coalesce(public.purge_expired_visitors() >= 1, false)::text, true);
select set_config('r.non_optin_old_deleted',
         ((select count(*) = 0 from public.attendees where id = 'EXPO-992'))::text, true),
       set_config('r.fresh_visit_kept_after_purge',
         ((select count(*) = 1 from public.attendees where id = 'EXPO-993'))::text, true),
       set_config('r.followup_kept',
         ((select count(*) = 1 from public.attendees where id = 'EXPO-991'))::text, true);

-- 8. a stale copy from an older phone (no created_at at all) is judged by the consent date on the record, and stays gone
insert into public.attendees (church_id, id, name, age, s, interests)
select id, 'EXPO-992', 'Resurrected', 40, '{"sys":120,"dia":80}',
       jsonb_build_object('consent', true, 'optin', false, 'consentOn', to_char(now() - interval '8 days', 'YYYY-MM-DD'))
from public.churches order by created_at limit 1;
select set_config('r.stale_copy_stays_gone',
         ((select count(*) = 0 from public.attendees where id = 'EXPO-992'))::text, true);

-- 9. a genuinely new visitor at a later expo may be given the same badge number, and must sync with the readings
insert into public.attendees (church_id, id, name, age, s, interests)
select id, 'EXPO-992', 'Same Badge New Expo', 27, '{"sys":130,"dia":85}',
       jsonb_build_object('consent', true, 'optin', false, 'consentOn', to_char(now(), 'YYYY-MM-DD'))
from public.churches order by created_at limit 1;
select set_config('r.reused_badge_syncs_with_readings',
         coalesce((select s ->> 'sys' = '130' from public.attendees where id = 'EXPO-992'), false)::text, true);

-- 10. a phone cannot move a recorded visit's date to keep the readings longer
update public.attendees set created_at = now() - interval '30 days' where id = 'EXPO-993';
select set_config('r.visit_date_stays',
         coalesce((select created_at > now() - interval '8 days' from public.attendees where id = 'EXPO-993'), false)::text, true);

-- the result: one row per check (a check that did not run counts as false)
select c.check_name,
       coalesce(nullif(current_setting('r.' || c.check_name, true), '')::boolean, false) as ok,
       case when c.uses_member then
         case when current_setting('test.real_member')::boolean then 'a real member'
              else 'a made-up member with no church (no ordinary member exists yet)' end
       end as note
from (values
  ('owner_reads_church_data', false),
  ('member_gets_no_church_data', true),
  ('member_sees_no_other_churchs_visitors', true),
  ('fresh_visit_kept', false),
  ('old_visit_not_yet_written_since', false),
  ('reupload_cleared_by_trigger', false),
  ('purge_deleted_old', false),
  ('non_optin_old_deleted', false),
  ('fresh_visit_kept_after_purge', false),
  ('followup_kept', false),
  ('stale_copy_stays_gone', false),
  ('reused_badge_syncs_with_readings', false),
  ('visit_date_stays', false)
) as c(check_name, uses_member);

rollback;
