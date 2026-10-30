-- NEWSTART Passport — Supabase schema
-- Run once in: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (everything is "if not exists" / "create or replace").
--
-- SECURITY MODEL
-- The publishable key is embedded in the web page, so anyone can read it. It is only
-- safe because Row Level Security below denies every request unless the caller is a
-- signed-in user listed in public.staff. Visitor health data and volunteer contact
-- details are personal information: do not weaken these policies.

-- ---------------------------------------------------------------- staff allow-list
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note    text,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;
-- no policies on purpose: only the dashboard / service role can edit the allow-list

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()));
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------- approving new staff inside the app
-- Admins (a staff row with is_admin = true) see who is waiting and approve them from the app's account panel,
-- instead of running SQL here. Make the first admin once, by hand (change the email):
--    update public.staff set is_admin = true
--    where user_id = (select id from auth.users where email = 'you@example.com');
alter table public.staff add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.is_admin);
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- accounts that exist but are not approved yet (admins only): name, email, whether the email is confirmed
create or replace function public.staff_pending()
returns table (user_id uuid, email text, full_name text, confirmed boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, (u.raw_user_meta_data ->> 'full_name')::text, u.email_confirmed_at is not null, u.created_at
    from auth.users u left join public.staff s on s.user_id = u.id
    where s.user_id is null
    order by u.created_at desc
    limit 200;
end;
$$;
revoke all on function public.staff_pending() from public, anon;
grant execute on function public.staff_pending() to authenticated;

-- approve one account (admins only); only accounts that have confirmed their email can be approved
create or replace function public.staff_approve(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  insert into public.staff (user_id, note)
    select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', 'staff')
    from auth.users u
    where u.id = p_user and u.email_confirmed_at is not null
  on conflict do nothing;
  if not found then
    raise exception 'Not approved: the account has not confirmed its email yet, or is already approved.';
  end if;
end;
$$;
revoke all on function public.staff_approve(uuid) from public, anon;
grant execute on function public.staff_approve(uuid) to authenticated;

-- ---------------------------------------------------------------- shared trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- visitors
create table if not exists public.attendees (
  id         text primary key check (id ~ '^EXPO-[0-9]{3,4}$'),   -- lanyard badge
  name       text not null check (length(btrim(name)) > 0),
  age        integer check (age between 0 and 120),
  sex        text,
  phone      text,
  height_cm  numeric,
  email      text,                                 -- optional; used to send the plan by email
  s          jsonb not null default '{}'::jsonb,   -- station readings: sys, dia, sugar, chol, weight, veg, walk, water, sleep; paper record: waist, fat, tbw, pef, pefExp, pulseRest, pulseEx, pulseRec, bpMed, preg, ops, chronic, chronicList; survey: exFreq, breakfast, snack, smoke, alcohol
  interests  jsonb not null default '{}'::jsonb,   -- nurse / cook / stress / pouch, seminars, heard* (how they heard)
  prayer     text not null default '',
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- older databases get the email column on re-run (safe to re-run, like everything here)
alter table public.attendees add column if not exists email text;
drop trigger if exists attendees_touch on public.attendees;
create trigger attendees_touch before update on public.attendees
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- volunteers
create table if not exists public.volunteers (
  id            text primary key check (id ~ '^VOL-[0-9]+$'),
  name          text not null check (length(btrim(name)) > 0),
  phone         text not null default '',
  email         text not null default '',
  status        text not null default 'prospect' check (status in ('prospect', 'registered', 'checkedin')),
  pledge_expos  integer not null default 1,
  skills        text[] not null default '{}',
  pref          text[] not null default '{}',      -- first-choice booths (max 2 in the app)
  pref2         text not null default '',          -- backup booth
  booth         text,                              -- confirmed booth
  availability  text[] not null default '{}',
  shirt         text not null default '',
  emergency     text not null default '',
  since         text not null default '',          -- 'YYYY-MM-DD' (kept as text: the app compares the year only)
  notes         text not null default '',
  pledged_on    date,
  registered_on date,
  checked_in    boolean not null default false,
  role          text not null default '',
  shift         text not null default '',
  history       jsonb not null default '[]'::jsonb, -- [{expo,name,date,booth,hours}]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists volunteers_touch on public.volunteers;
create trigger volunteers_touch before update on public.volunteers
  for each row execute function public.touch_updated_at();

-- one team leader per station (see VOLUNTEER HUB: TEAM LEADERS below); added here because my_pledge() reads it
alter table public.volunteers add column if not exists lead boolean not null default false;

-- ---------------------------------------------------------------- indexes (the app pages through rows by
-- created_at and pulls "changes since" by updated_at; these keep both fast with many thousands of rows)
create index if not exists attendees_created_idx  on public.attendees  (created_at, id);
create index if not exists attendees_updated_idx  on public.attendees  (updated_at, id);
create index if not exists volunteers_created_idx on public.volunteers (created_at, id);
create index if not exists volunteers_updated_idx on public.volunteers (updated_at, id);

-- ---------------------------------------------------------------- row level security
alter table public.attendees  enable row level security;
alter table public.volunteers enable row level security;

drop policy if exists "staff full access" on public.attendees;
create policy "staff full access" on public.attendees
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "staff full access" on public.volunteers;
create policy "staff full access" on public.volunteers
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- anon (not signed in) gets nothing at all
revoke all on public.attendees, public.volunteers, public.staff from anon;

-- ---------------------------------------------------------------- realtime (live updates between desks)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendees') then
    alter publication supabase_realtime add table public.attendees;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'volunteers') then
    alter publication supabase_realtime add table public.volunteers;
  end if;
end $$;

-- ---------------------------------------------------------------- live queue
-- One row per visit to a station. waiting -> serving -> done, or 'left' if the person walked off / was removed.
-- Staff-only, like everything else. Times are set by the database, never by a phone's clock.
create table if not exists public.queue_entries (
  id          uuid primary key default gen_random_uuid(),
  attendee_id text not null check (attendee_id ~ '^EXPO-[0-9]{3,4}$'),   -- lanyard badge
  station     text not null check (length(btrim(station)) between 1 and 40),  -- booth key: vitals, bp, sugar, kitchen, plan, prayer
  status      text not null default 'waiting' check (status in ('waiting', 'serving', 'done', 'left')),
  joined_at   timestamptz not null default now(),
  called_at   timestamptz,
  finished_at timestamptz,
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);

create or replace function public.queue_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' then
    if new.status = 'serving' and old.status is distinct from 'serving' then new.called_at = now(); new.finished_at = null; end if;
    if new.status = 'waiting' then new.called_at = null; new.finished_at = null; end if;          -- put back in line, keeps joined_at
    if new.status in ('done', 'left') and old.status not in ('done', 'left') then new.finished_at = now(); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists queue_entries_touch on public.queue_entries;
create trigger queue_entries_touch before insert or update on public.queue_entries
  for each row execute function public.queue_touch();

-- a person can only be in one line at a time at the same station: per church, so that index is made in the CHURCHES
-- section below (which adds the church_id column)
create index if not exists queue_entries_station_idx on public.queue_entries (station, status, joined_at);
create index if not exists queue_entries_joined_idx  on public.queue_entries (joined_at, id);
create index if not exists queue_entries_updated_idx on public.queue_entries (updated_at, id);

alter table public.queue_entries enable row level security;
drop policy if exists "staff full access" on public.queue_entries;
create policy "staff full access" on public.queue_entries
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
revoke all on public.queue_entries from anon;

-- "Call next": takes the longest-waiting person at a station in ONE statement, so two desks tapping at the same
-- moment never get the same person. Returns nothing when the line is empty.
create or replace function public.queue_call_next(p_station text)
returns setof public.queue_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.queue_entries;
begin
  if not public.is_staff() then
    raise exception 'not approved staff' using errcode = '42501';
  end if;
  update public.queue_entries q set status = 'serving'
  where q.id = (
    select e.id from public.queue_entries e
    where e.station = p_station and e.status = 'waiting'
    order by e.joined_at, e.id
    limit 1
    for update skip locked)
  returning q.* into v_row;
  if found then
    return next v_row;
  end if;
  return;
end;
$$;
revoke all on function public.queue_call_next(text) from public, anon;
grant execute on function public.queue_call_next(text) to authenticated;

-- the database's clock, so every desk shows the same waiting times even if a phone's clock is wrong
create or replace function public.queue_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now(); $$;
revoke all on function public.queue_now() from public, anon;
grant execute on function public.queue_now() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue_entries') then
    alter publication supabase_realtime add table public.queue_entries;
  end if;
end $$;

-- ================================================================ HARDENING (added after a pressure test)
-- Safe to re-run. Three things:
--   1. Size and shape limits, so one account cannot store enormous or booby-trapped values. Readings in attendees.s must be
--      numbers. The constraints are NOT VALID on purpose: they apply to every new or changed row and never block the rows
--      already in the table.
--   2. Only admins can DELETE visitors or volunteers. Every approved staff account can still read, add and edit (all the app does).
--   3. An audit log: who deleted what (with a copy of the row, so it can be put back) and who edited which record.

create or replace function public.jsonb_numbers_only(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(j) = 'object'
              then not exists (select 1 from jsonb_each(j) e where jsonb_typeof(e.value) not in ('number', 'null'))
              else false end;
$$;

alter table public.attendees drop constraint if exists attendees_limits;
alter table public.attendees add constraint attendees_limits check (
  length(name) <= 200 and coalesce(length(phone), 0) <= 40 and coalesce(length(email), 0) <= 200
  and coalesce(length(sex), 0) <= 20 and length(prayer) <= 2000
  and public.jsonb_numbers_only(s) and octet_length(s::text) <= 1000
  -- consent, the follow-up answers and the paper form's ticks live here; so does a per-visitor custom plan
  -- (a title, a problem area and 3–8 do/why/how actions), which needs far more than the original 1 KB.
  and jsonb_typeof(interests) = 'object' and octet_length(interests::text) <= 32000
  and (not (interests ? 'customPlan') or jsonb_typeof(interests -> 'customPlan') = 'object')
) not valid;

-- a station key is a short key, never a paragraph (earlier builds let a placement write any text)
update public.volunteers set booth = left(booth, 40) where length(booth) > 40;
alter table public.volunteers drop constraint if exists volunteers_limits;
alter table public.volunteers add constraint volunteers_limits check (
  length(name) <= 200 and length(phone) <= 40 and length(email) <= 254 and length(notes) <= 2000 and length(emergency) <= 500
  and length(shirt) <= 20 and length(role) <= 100 and length(shift) <= 100 and length(since) <= 10 and length(pref2) <= 40
  and (booth is null or length(booth) <= 40)
  and jsonb_typeof(history) = 'array' and octet_length(history::text) <= 20000
) not valid;

-- replace the single "staff full access" policy with one per action, so deleting needs an admin
do $$
declare t text;
begin
  foreach t in array array['attendees', 'volunteers'] loop
    execute format('drop policy if exists "staff full access" on public.%I', t);
    execute format('drop policy if exists "staff read" on public.%I', t);
    execute format('drop policy if exists "staff add" on public.%I', t);
    execute format('drop policy if exists "staff edit" on public.%I', t);
    execute format('drop policy if exists "admins delete" on public.%I', t);
    execute format('create policy "staff read" on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('create policy "staff add" on public.%I for insert to authenticated with check (public.is_staff())', t);
    execute format('create policy "staff edit" on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())', t);
    execute format('create policy "admins delete" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

create table if not exists public.audit_log (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  actor  uuid default auth.uid(),
  tbl    text not null,
  op     text not null,
  row_id text,
  old    jsonb            -- the full row, kept for DELETE only
);
alter table public.audit_log enable row level security;       -- no policies: read it in the dashboard (service role)
revoke all on public.audit_log from anon, authenticated;
create index if not exists audit_log_at_idx on public.audit_log (at);

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (tbl, op, row_id, old) values (tg_table_name, 'DELETE', old.id, to_jsonb(old));
    return old;
  end if;
  insert into public.audit_log (tbl, op, row_id) values (tg_table_name, tg_op, new.id);
  return new;
end;
$$;
revoke all on function public.audit_row() from public, anon, authenticated;

drop trigger if exists attendees_audit on public.attendees;
create trigger attendees_audit after update or delete on public.attendees for each row execute function public.audit_row();
drop trigger if exists volunteers_audit on public.volunteers;
create trigger volunteers_audit after update or delete on public.volunteers for each row execute function public.audit_row();

-- ================================================================ CHURCHES, MEMBERS AND THE PLATFORM ADMIN
-- Safe to re-run. Three levels of account:
--   * Platform admin (you): sees every church, approves or suspends churches and manages anyone's membership. Reads any
--     church's visitor and volunteer data through admin_church_data (read-only). Made once,
--     by hand, here in the SQL editor (change the email):
--        insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.com'
--        on conflict do nothing;
--   * Church: registered in the app by its first admin. It stays 'pending' (no visitor data at all) until the platform
--     admin approves it. A church sees only its own visitors, volunteers, queue and audit trail.
--   * Person: any account. Joins ONE church and edits their own details there. Once the church approves them they see
--     their own screening results (after a church admin links their badge). Church admins make some members 'staff'
--     (expo data access, what "approved staff" meant before churches) or 'admin' — one of the church's two admin posts,
--     the Health Department Leader and their Assistant.
--     An admin reaches only that one church: no account can touch another church's
--     data. The only way to lead a church you did not create is to be promoted inside it by its admin.
-- Every visitor, volunteer, queue and audit row carries a church_id, and Row Level Security only lets approved staff of
-- an ACTIVE church touch that church's rows. Churches and memberships have no policies at all: they are read and changed
-- only through the functions below, which check who is asking.
--
-- First run on a database that already holds data: everything (visitors, volunteers, queue, audit log) moves into one
-- new active church called "My church (rename me)", and everyone in public.staff becomes its staff (is_admin -> admin).
-- After that, public.staff is no longer used; approvals happen in the app.

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;     -- no policies: only this SQL editor adds one
revoke all on public.platform_admins from anon, authenticated;
-- the old allow-list is only read inside this database now (by the one-time move below); nobody needs it through the API
revoke all on public.staff from anon, authenticated;

create table if not exists public.churches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 2 and 120),
  city       text not null default '' check (length(city) <= 80),
  phone      text not null default '' check (length(phone) <= 40),
  email      text not null default '' check (length(email) <= 254),
  status     text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists churches_touch on public.churches;
create trigger churches_touch before update on public.churches
  for each row execute function public.touch_updated_at();
alter table public.churches enable row level security;
revoke all on public.churches from anon, authenticated;

create table if not exists public.memberships (
  user_id          uuid primary key references auth.users (id) on delete cascade,   -- one church per person
  church_id        uuid not null references public.churches (id) on delete cascade,
  role             text not null default 'member' check (role in ('member', 'staff', 'admin')),
  status           text not null default 'pending' check (status in ('pending', 'approved')),
  full_name        text not null default '' check (length(full_name) <= 200),
  phone            text not null default '' check (length(phone) <= 40),
  area             text not null default '' check (length(area) <= 120),
  birth_date       date check (birth_date between date '1900-01-01' and date '2100-01-01'),
  attendee_id      text check (attendee_id ~ '^EXPO-[0-9]{3,4}$'),   -- their screening record, linked by a church admin
  attendee_created timestamptz,      -- that record's created_at: if the badge number is ever reused, the link stops matching
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- a follow-up person (see FOLLOW-UP PEOPLE below); added here because my_account() reads it
alter table public.memberships add column if not exists followup boolean not null default false;
-- the member's own volunteer pledge (see VOLUNTEER HUB: SELF-PLEDGE below); added here because my_account() reads it
alter table public.memberships add column if not exists volunteer_id text check (volunteer_id ~ '^VOL-[0-9]+$');
create unique index if not exists memberships_volunteer_idx on public.memberships (church_id, volunteer_id)
  where volunteer_id is not null;                       -- one volunteer record belongs to one member
-- the church's two admin posts, explicit so either one can be given, taken away or swapped: 'leader' is the Health
-- Department Leader and 'assistant' their Assistant. Only an approved admin holds one (the trigger below keeps it so).
alter table public.memberships add column if not exists admin_post text check (admin_post in ('leader', 'assistant'));
-- what the person asked to be when they joined; an admin sees it beside the Approve button
alter table public.memberships add column if not exists wants text not null default 'member'
  check (wants in ('member', 'assistant', 'team_leader', 'team_member', 'pledge'));
alter table public.memberships add column if not exists wants_booths text[] not null default '{}'
  check (cardinality(wants_booths) <= 2);
-- databases from before the posts were stored: the oldest approved admin of a church is its Leader, the next its
-- Assistant (what the screens always showed)
update public.memberships m set admin_post = case r.rn when 1 then 'leader' else 'assistant' end
from (select user_id, row_number() over (partition by church_id order by created_at, user_id) rn
      from public.memberships where role = 'admin' and status = 'approved') r
where m.user_id = r.user_id and m.admin_post is null and r.rn <= 2;
create unique index if not exists memberships_admin_post_idx on public.memberships (church_id, admin_post) where admin_post is not null;
create index if not exists memberships_church_idx on public.memberships (church_id, status);
create unique index if not exists memberships_attendee_idx on public.memberships (church_id, attendee_id) where attendee_id is not null;
drop trigger if exists memberships_touch on public.memberships;
create trigger memberships_touch before update on public.memberships
  for each row execute function public.touch_updated_at();

-- An approved admin always holds exactly one post (the Leader's if it is free, otherwise the Assistant's); anyone else
-- holds none. set_admin_post switches this off for the moment of a swap ('newstart.post_swap').
create or replace function public.memberships_admin_post()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'admin' and new.status = 'approved' then
    if new.admin_post is null and coalesce(current_setting('newstart.post_swap', true), '') <> 'on' then
      new.admin_post := case when exists (select 1 from public.memberships m where m.church_id = new.church_id
                                          and m.admin_post = 'leader' and m.user_id <> new.user_id) then 'assistant' else 'leader' end;
    end if;
  else
    new.admin_post := null;
  end if;
  return new;
end;
$$;
drop trigger if exists memberships_admin_post on public.memberships;
create trigger memberships_admin_post before insert or update on public.memberships
  for each row execute function public.memberships_admin_post();

-- When the Leader's post falls vacant (stepped down, removed, account deleted) the Assistant becomes the Leader.
create or replace function public.memberships_admin_succession()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('newstart.post_swap', true), '') = 'on' then return null; end if;
  if old.admin_post = 'leader' and (tg_op = 'DELETE' or new.admin_post is distinct from 'leader') then
    update public.memberships m set admin_post = 'leader'
    where m.church_id = old.church_id and m.admin_post = 'assistant' and m.user_id <> old.user_id;
  end if;
  return null;
end;
$$;
revoke all on function public.memberships_admin_succession() from public, anon, authenticated;
drop trigger if exists memberships_admin_succession on public.memberships;
create trigger memberships_admin_succession after update of admin_post, role, status or delete on public.memberships
  for each row execute function public.memberships_admin_succession();
alter table public.memberships enable row level security;
revoke all on public.memberships from anon, authenticated;

-- ---------------------------------------------------------------- who is asking
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins p where p.user_id = (select auth.uid()));
$$;

-- the church whose expo data the caller may use: approved staff or admin of an ACTIVE church, otherwise null
create or replace function public.staff_church()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.church_id from public.memberships m join public.churches c on c.id = m.church_id
  where m.user_id = (select auth.uid()) and m.status = 'approved' and m.role in ('staff', 'admin') and c.status = 'active';
$$;

-- the old names keep working for everything defined above (the queue, the delete policies)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.staff_church() is not null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.memberships m join public.churches c on c.id = m.church_id
    where m.user_id = (select auth.uid()) and m.status = 'approved' and m.role = 'admin' and c.status = 'active');
$$;

-- may the caller manage this church's profile and members? its approved admin (unless suspended), or the platform admin
create or replace function public.church_admin_of(p_church uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (select 1 from public.memberships m join public.churches c on c.id = m.church_id
    where m.user_id = (select auth.uid()) and m.church_id = p_church and m.status = 'approved' and m.role = 'admin'
      and c.status <> 'suspended');
$$;

-- may the caller give and take the admin posts of this church? its Health Department Leader (unless suspended), or the
-- platform admin. The Assistant runs the members but cannot change who the admins are.
create or replace function public.church_leader_of(p_church uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (select 1 from public.memberships m join public.churches c on c.id = m.church_id
    where m.user_id = (select auth.uid()) and m.church_id = p_church and m.status = 'approved' and m.role = 'admin'
      and m.admin_post = 'leader' and c.status <> 'suspended');
$$;

-- ---------------------------------------------------------------- one-time move of existing data into a church
do $$
declare v_church uuid;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'attendees' and column_name = 'church_id') then
    return;                                                  -- done on an earlier run
  end if;
  if exists (select 1 from public.attendees) or exists (select 1 from public.volunteers)
     or exists (select 1 from public.queue_entries) or exists (select 1 from public.staff) then
    insert into public.churches (name, status) values ('My church (rename me)', 'active') returning id into v_church;
  end if;
  alter table public.attendees     add column church_id uuid references public.churches (id) on delete cascade;
  alter table public.volunteers    add column church_id uuid references public.churches (id) on delete cascade;
  alter table public.queue_entries add column church_id uuid references public.churches (id) on delete cascade;
  alter table public.audit_log     add column if not exists church_id uuid references public.churches (id) on delete set null;
  if v_church is not null then
    update public.attendees     set church_id = v_church;
    update public.volunteers    set church_id = v_church;
    update public.queue_entries set church_id = v_church;
    update public.audit_log     set church_id = v_church;
    insert into public.memberships (user_id, church_id, role, status, full_name)
      select s.user_id, v_church, case when s.is_admin then 'admin' else 'staff' end, 'approved', left(coalesce(s.note, ''), 200)
      from public.staff s
    on conflict (user_id) do nothing;
  end if;
end $$;

-- new rows are filed under the caller's own church; the policies below refuse any other church
alter table public.attendees     alter column church_id set default public.staff_church();
alter table public.volunteers    alter column church_id set default public.staff_church();
alter table public.queue_entries alter column church_id set default public.staff_church();
alter table public.attendees     alter column church_id set not null;
alter table public.volunteers    alter column church_id set not null;
alter table public.queue_entries alter column church_id set not null;

-- a badge or volunteer number is unique inside its church, not across churches
do $$
declare t text; k text;
begin
  foreach t in array array['attendees', 'volunteers'] loop
    select c.conname into k from pg_constraint c
    where c.conrelid = ('public.' || t)::regclass and c.contype = 'p' and array_length(c.conkey, 1) = 1;
    if k is not null then
      execute format('alter table public.%I drop constraint %I', t, k);
      execute format('alter table public.%I add primary key (church_id, id)', t);
    end if;
  end loop;
end $$;
create index if not exists attendees_church_created_idx  on public.attendees  (church_id, created_at, id);
create index if not exists attendees_church_updated_idx  on public.attendees  (church_id, updated_at, id);
create index if not exists volunteers_church_created_idx on public.volunteers (church_id, created_at, id);
create index if not exists volunteers_church_updated_idx on public.volunteers (church_id, updated_at, id);
create index if not exists audit_log_church_idx on public.audit_log (church_id, at);

-- a person can only be in one line at a time at the same station, per church
drop index if exists public.queue_entries_one_active_idx;
create unique index if not exists queue_entries_one_active_church_idx on public.queue_entries (church_id, attendee_id, station)
  where status in ('waiting', 'serving');
create index if not exists queue_entries_church_idx on public.queue_entries (church_id, station, status, joined_at);

-- ---------------------------------------------------------------- row level security, per church
do $$
declare t text;
begin
  foreach t in array array['attendees', 'volunteers'] loop
    execute format('drop policy if exists "staff full access" on public.%I', t);
    execute format('drop policy if exists "staff read" on public.%I', t);
    execute format('drop policy if exists "staff add" on public.%I', t);
    execute format('drop policy if exists "staff edit" on public.%I', t);
    execute format('drop policy if exists "admins delete" on public.%I', t);
    execute format('drop policy if exists "church staff read" on public.%I', t);
    execute format('drop policy if exists "church staff add" on public.%I', t);
    execute format('drop policy if exists "church staff edit" on public.%I', t);
    execute format('drop policy if exists "church admins delete" on public.%I', t);
    execute format('create policy "church staff read" on public.%I for select to authenticated using (church_id = public.staff_church())', t);
    execute format('create policy "church staff add" on public.%I for insert to authenticated with check (church_id = public.staff_church())', t);
    execute format('create policy "church staff edit" on public.%I for update to authenticated using (church_id = public.staff_church()) with check (church_id = public.staff_church())', t);
    execute format('create policy "church admins delete" on public.%I for delete to authenticated using (church_id = public.staff_church() and public.is_admin())', t);
  end loop;
end $$;
drop policy if exists "staff full access" on public.queue_entries;
drop policy if exists "church staff queue" on public.queue_entries;
create policy "church staff queue" on public.queue_entries
  for all to authenticated
  using (church_id = public.staff_church()) with check (church_id = public.staff_church());

-- "Call next" only ever takes someone from the caller's own church
create or replace function public.queue_call_next(p_station text)
returns setof public.queue_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.queue_entries;
begin
  if not public.is_staff() then
    raise exception 'not approved staff' using errcode = '42501';
  end if;
  update public.queue_entries q set status = 'serving'
  where q.id = (
    select e.id from public.queue_entries e
    where e.church_id = public.staff_church() and e.station = p_station and e.status = 'waiting'
    order by e.joined_at, e.id
    limit 1
    for update skip locked)
  returning q.* into v_row;
  if found then
    return next v_row;
  end if;
  return;
end;
$$;

-- the audit trail records the church too, so the platform admin can see where a change happened
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (tbl, op, row_id, old, church_id) values (tg_table_name, 'DELETE', old.id, to_jsonb(old), old.church_id);
    return old;
  end if;
  insert into public.audit_log (tbl, op, row_id, church_id) values (tg_table_name, tg_op, new.id, new.church_id);
  return new;
end;
$$;
revoke all on function public.audit_row() from public, anon, authenticated;

-- the app's older "Waiting for approval" panel, now limited to the caller's own church (approving makes them staff)
create or replace function public.staff_pending()
returns table (user_id uuid, email text, full_name text, confirmed boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.full_name, u.email_confirmed_at is not null, m.created_at
    from public.memberships m join auth.users u on u.id = m.user_id
    where m.church_id = public.staff_church() and m.status = 'pending'
    order by m.created_at desc
    limit 200;
end;
$$;

create or replace function public.staff_approve(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  update public.memberships m set status = 'approved', role = case when m.role = 'member' then 'staff' else m.role end
  where m.user_id = p_user and m.church_id = public.staff_church() and m.status = 'pending'
    and exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null);
  if not found then
    raise exception 'Not approved: the account has not confirmed its email yet, or is already approved.';
  end if;
end;
$$;

-- ---------------------------------------------------------------- the signed-in person's own account
-- everything the app needs to know about the caller in one call: email, platform admin or not, membership, church
create or replace function public.my_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'platform_admin', exists (select 1 from public.platform_admins p where p.user_id = u.id),
    'server_now', now(),   -- the phone measures its clock against this before it clears anything by date (src/retention.js)
    'membership', (select jsonb_build_object('church_id', m.church_id, 'role', m.role, 'status', m.status, 'full_name', m.full_name,
                     'phone', m.phone, 'area', m.area, 'birth_date', m.birth_date, 'attendee_id', m.attendee_id, 'followup', m.followup,
                     'volunteer_id', m.volunteer_id,
                     'admin_rank', case when m.role = 'admin' and m.status = 'approved'
                                   then case m.admin_post when 'leader' then 1 else 2 end
                                   else 0 end,
                     'wants', m.wants, 'wants_booths', to_jsonb(m.wants_booths))
                   from public.memberships m where m.user_id = u.id),
    'church', (select jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city, 'phone', c.phone, 'email', c.email, 'status', c.status)
               from public.memberships m join public.churches c on c.id = m.church_id where m.user_id = u.id))
  from auth.users u where u.id = (select auth.uid());
$$;

-- the churches a person can find when they register: active ones (they can join) and ones still waiting for the
-- platform admin (listed so nobody registers the same church twice; they cannot be joined yet). Name, town and
-- status only. The status column came later, so the old shape is replaced outright.
drop function if exists public.church_directory(text);
create or replace function public.church_directory(p_search text default '')
returns table (id uuid, name text, city text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare v_q text := lower(btrim(coalesce(p_search, '')));
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.city, c.status from public.churches c
    where c.status in ('active', 'pending') and (v_q = '' or position(v_q in lower(c.name || ' ' || c.city)) > 0)
    order by (c.status = 'pending'), lower(c.name), c.id
    limit 50;
end;
$$;

-- the person says what they would like to be; an admin sees it when approving (see memberships.wants). Nothing here
-- gives any right: the role stays 'member' until an admin approves and changes it.
drop function if exists public.join_church(uuid, text, text);
create or replace function public.join_church(p_church uuid, p_full_name text default '', p_phone text default '',
                                              p_wants text default 'member', p_booths text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_wants text := coalesce(nullif(btrim(p_wants), ''), 'member'); v_booths text[];
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.memberships m where m.user_id = v_uid) then
    raise exception 'You already belong to a church. Leave it first.';
  end if;
  if not exists (select 1 from public.churches c where c.id = p_church and c.status = 'active') then
    raise exception 'That church is not taking members at the moment.';
  end if;
  if v_wants not in ('member', 'assistant', 'team_leader', 'team_member', 'pledge') then raise exception 'Choose what you would like to be.'; end if;
  v_booths := coalesce((select array_agg(t.b) from (select left(btrim(x), 40) b from unnest(coalesce(p_booths, '{}'::text[])) x
                                                    where btrim(x) <> '' limit 2) t), '{}'::text[]);
  if v_wants = 'team_leader' and cardinality(v_booths) <> 1 then raise exception 'Choose the one station you would lead.'; end if;
  if v_wants = 'team_member' and cardinality(v_booths) = 0 then raise exception 'Choose the station you would like to help at.'; end if;
  if v_wants not in ('team_leader', 'team_member', 'pledge') then v_booths := '{}'::text[]; end if;
  insert into public.memberships (user_id, church_id, role, status, full_name, phone, wants, wants_booths)
  select v_uid, p_church, 'member', 'pending',
         left(coalesce(nullif(btrim(p_full_name), ''), u.raw_user_meta_data ->> 'full_name', ''), 200), left(btrim(coalesce(p_phone, '')), 40),
         v_wants, v_booths
  from auth.users u where u.id = v_uid;
end;
$$;

-- a new church starts 'pending' with the person who registers it as its Health Department Leader (its first admin)
create or replace function public.register_church(p_name text, p_city text default '', p_phone text default '', p_email text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_church uuid;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.memberships m where m.user_id = v_uid) then
    raise exception 'You already belong to a church. Leave it first.';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Enter the church''s name.'; end if;
  insert into public.churches (name, city, phone, email, created_by)
  values (btrim(p_name), btrim(coalesce(p_city, '')), btrim(coalesce(p_phone, '')), btrim(coalesce(p_email, '')), v_uid)
  returning id into v_church;
  insert into public.memberships (user_id, church_id, role, status, full_name)
  select v_uid, v_church, 'admin', 'approved', left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 200)
  from auth.users u where u.id = v_uid;
  return v_church;
end;
$$;

create or replace function public.update_my_details(p_full_name text, p_phone text default '', p_area text default '', p_birth_date date default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_birth_date > current_date then raise exception 'The date of birth is in the future.'; end if;
  update public.memberships m
  set full_name = btrim(coalesce(p_full_name, '')), phone = btrim(coalesce(p_phone, '')), area = btrim(coalesce(p_area, '')), birth_date = p_birth_date
  where m.user_id = (select auth.uid());
  if not found then raise exception 'Join a church first.'; end if;
end;
$$;

create or replace function public.leave_church()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships;
begin
  select * into v_m from public.memberships m where m.user_id = (select auth.uid());
  if not found then return; end if;
  delete from public.memberships m where m.user_id = v_m.user_id;
end;
$$;

-- delete the caller's own login. Their membership, platform-admin and old staff rows go with it (on delete cascade);
-- the church's visitors, volunteers and queue stay with the church. A church may be left with no admin (the Expo admin
-- appoints one); the only platform admin cannot delete themselves, so the platform is never left with nobody.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_m public.memberships;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.platform_admins p where p.user_id = v_uid)
     and not exists (select 1 from public.platform_admins p where p.user_id <> v_uid) then
    raise exception 'You are the only platform admin. Add another one in the database first.';
  end if;
  delete from auth.users u where u.id = v_uid;
end;
$$;

-- the caller's own screening record: only once approved, only from their own church, only the visit that was linked
create or replace function public.my_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', a.id, 'name', a.name, 'age', a.age, 'sex', a.sex, 'height_cm', a.height_cm, 's', a.s,
           'interests', a.interests, 'done', a.done, 'created_at', a.created_at, 'updated_at', a.updated_at)
  from public.memberships m
  join public.churches c on c.id = m.church_id and c.status = 'active'
  join public.attendees a on a.church_id = m.church_id and a.id = m.attendee_id and a.created_at = m.attendee_created
  where m.user_id = (select auth.uid()) and m.status = 'approved';
$$;

-- ---------------------------------------------------------------- church admins (and the platform admin)
create or replace function public.update_church(p_church uuid, p_name text, p_city text default '', p_phone text default '', p_email text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.church_admin_of(p_church) then raise exception 'church admins only' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Enter the church''s name.'; end if;
  update public.churches c
  set name = btrim(p_name), city = btrim(coalesce(p_city, '')), phone = btrim(coalesce(p_phone, '')), email = btrim(coalesce(p_email, ''))
  where c.id = p_church;
end;
$$;

-- the extra volunteer_id column arrived after the function did, so the old shape is replaced outright
drop function if exists public.church_members(uuid);
create or replace function public.church_members(p_church uuid)
returns table (user_id uuid, email text, full_name text, phone text, area text, birth_date date, role text, status text,
               attendee_id text, confirmed boolean, created_at timestamptz, volunteer_id text,
               admin_post text, wants text, wants_booths text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.church_admin_of(p_church) then raise exception 'church admins only' using errcode = '42501'; end if;
  return query
    select m.user_id, u.email::text, m.full_name, m.phone, m.area, m.birth_date, m.role, m.status, m.attendee_id,
           u.email_confirmed_at is not null, m.created_at, m.volunteer_id, m.admin_post, m.wants, m.wants_booths
    from public.memberships m join auth.users u on u.id = m.user_id
    where m.church_id = p_church
    order by (m.status = 'pending') desc, lower(m.full_name), m.created_at
    limit 1000;
end;
$$;

-- change a member's role or approval. A church fills only its two admin posts (the Health Department Leader and their
-- Assistant) and may have no admin at all. Giving or taking an admin post is for the Leader and the Expo admin (see
-- set_admin_post for choosing which post); anyone may step down from their own.
create or replace function public.set_member(p_user uuid, p_role text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships; v_uid uuid := (select auth.uid()); v_was boolean; v_will boolean;
begin
  select * into v_m from public.memberships m where m.user_id = p_user;
  if not found or not public.church_admin_of(v_m.church_id) then raise exception 'church admins only' using errcode = '42501'; end if;
  -- hold the church row so two admins changing roles at the same moment cannot both pass the two-post check
  perform 1 from public.churches c where c.id = v_m.church_id for update;
  if p_role not in ('member', 'staff', 'admin') or p_status not in ('pending', 'approved') then raise exception 'Unknown role or status.'; end if;
  if p_status = 'approved' and not exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null) then
    raise exception 'This person has not confirmed their email yet.';
  end if;
  v_was := v_m.role = 'admin' and v_m.status = 'approved';
  v_will := p_role = 'admin' and p_status = 'approved';
  if v_was is distinct from v_will and p_user <> v_uid and not public.church_leader_of(v_m.church_id) then
    raise exception 'Only the Health Department Leader or the Expo admin can change the admin posts.' using errcode = '42501';
  end if;
  -- a third promotion (or approval) is refused until one steps down
  if v_will and not v_was
     and (select count(*) from public.memberships o where o.church_id = v_m.church_id and o.user_id <> p_user
          and o.role = 'admin' and o.status = 'approved') >= 2 then
    raise exception 'A church has two admin posts: the Health Department Leader and their Assistant. Both are filled — one must step down first.';
  end if;
  update public.memberships m set role = p_role, status = p_status where m.user_id = p_user;
end;
$$;

-- give someone the Leader's or the Assistant's post, swap the two, or take a post away ('none'). Only the church's Leader
-- or the Expo admin may. The person must be an approved member with a confirmed email. Giving a post that is held
-- replaces its holder, who stays on as staff — unless the person already holds the other post, then the two swap.
create or replace function public.set_admin_post(p_user uuid, p_post text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships; v_other public.memberships; v_mine text;
begin
  select * into v_m from public.memberships m where m.user_id = p_user;
  if not found or not public.church_leader_of(v_m.church_id) then
    raise exception 'Only the Health Department Leader or the Expo admin can change the admin posts.' using errcode = '42501';
  end if;
  if p_post not in ('leader', 'assistant', 'none') then raise exception 'Unknown post.'; end if;
  perform 1 from public.churches c where c.id = v_m.church_id for update;
  if v_m.status <> 'approved' then raise exception 'Approve this person as a member first.'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null) then
    raise exception 'This person has not confirmed their email yet.';
  end if;
  perform set_config('newstart.post_swap', 'on', true);          -- this function keeps the posts consistent itself
  if p_post = 'none' then
    update public.memberships m set role = case when m.role = 'admin' then 'staff' else m.role end, admin_post = null where m.user_id = p_user;
    return;
  end if;
  v_mine := case when v_m.role = 'admin' then v_m.admin_post end;
  if v_mine = p_post then return; end if;
  select * into v_other from public.memberships m where m.church_id = v_m.church_id and m.admin_post = p_post and m.user_id <> p_user;
  if v_other.user_id is not null and v_mine is not null then       -- swap
    update public.memberships m set admin_post = null where m.user_id in (p_user, v_other.user_id);
    update public.memberships m set admin_post = p_post where m.user_id = p_user;
    update public.memberships m set admin_post = v_mine where m.user_id = v_other.user_id;
  else
    if v_other.user_id is not null then                            -- replace: the old holder stays on as staff
      update public.memberships m set role = 'staff', admin_post = null where m.user_id = v_other.user_id;
    end if;
    update public.memberships m set role = 'admin', admin_post = p_post where m.user_id = p_user;
  end if;
end;
$$;

-- link a member to their screening record (a badge in the same church); an empty badge unlinks
create or replace function public.link_member(p_user uuid, p_attendee text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships; v_at timestamptz; v_badge text := upper(btrim(coalesce(p_attendee, '')));
begin
  select * into v_m from public.memberships m where m.user_id = p_user;
  if not found or not public.church_admin_of(v_m.church_id) then raise exception 'church admins only' using errcode = '42501'; end if;
  if v_badge = '' then
    update public.memberships m set attendee_id = null, attendee_created = null where m.user_id = p_user;
    return;
  end if;
  select a.created_at into v_at from public.attendees a where a.church_id = v_m.church_id and a.id = v_badge;
  if v_at is null then raise exception 'No visitor with badge % in this church.', v_badge; end if;
  if exists (select 1 from public.memberships o where o.church_id = v_m.church_id and o.attendee_id = v_badge and o.user_id <> p_user) then
    raise exception 'Badge % is already linked to another member.', v_badge;
  end if;
  update public.memberships m set attendee_id = v_badge, attendee_created = v_at where m.user_id = p_user;
end;
$$;

create or replace function public.remove_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships;
begin
  select * into v_m from public.memberships m where m.user_id = p_user;
  if not found or not public.church_admin_of(v_m.church_id) then raise exception 'church admins only' using errcode = '42501'; end if;
  perform 1 from public.churches c where c.id = v_m.church_id for update;
  -- removing an admin is the Leader's or the Expo admin's to do (the Assistant removes everyone else)
  if v_m.role = 'admin' and v_m.status = 'approved' and p_user <> (select auth.uid()) and not public.church_leader_of(v_m.church_id) then
    raise exception 'Only the Health Department Leader or the Expo admin can remove an admin.' using errcode = '42501';
  end if;
  delete from public.memberships m where m.user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------- platform admin only
create or replace function public.admin_churches()
returns table (id uuid, name text, city text, phone text, email text, status text, created_at timestamptz,
               members bigint, staff bigint, pending bigint, visitors bigint, volunteers bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'platform admin only' using errcode = '42501'; end if;
  return query
    select c.id, c.name, c.city, c.phone, c.email, c.status, c.created_at,
      (select count(*) from public.memberships m where m.church_id = c.id),
      (select count(*) from public.memberships m where m.church_id = c.id and m.status = 'approved' and m.role in ('staff', 'admin')),
      (select count(*) from public.memberships m where m.church_id = c.id and m.status = 'pending'),
      (select count(*) from public.attendees a where a.church_id = c.id),
      (select count(*) from public.volunteers v where v.church_id = c.id)
    from public.churches c
    order by (c.status = 'pending') desc, lower(c.name), c.id;
end;
$$;

create or replace function public.admin_set_church_status(p_church uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'platform admin only' using errcode = '42501'; end if;
  if p_status not in ('pending', 'active', 'suspended') then raise exception 'Unknown status.'; end if;
  update public.churches c set status = p_status where c.id = p_church;
  if not found then raise exception 'No such church.'; end if;
end;
$$;

-- The platform admins themselves: listed and added by email in the app (platform admin only), so that after the first
-- one no SQL is needed. The first is still made by hand in the SQL editor, because nobody may promote themselves.
-- Additions are written to audit_log (tbl 'platform_admins', row_id = the person's email).
create or replace function public.admin_platform_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'platform admin only' using errcode = '42501'; end if;
  return query
    select p.user_id, u.email::text, p.created_at
    from public.platform_admins p join auth.users u on u.id = p.user_id
    order by p.created_at, p.user_id;
end;
$$;

-- the person must already have an account with a confirmed email: that is what proves the address is theirs
create or replace function public.admin_add_platform_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_user uuid; v_confirmed timestamptz;
begin
  if not public.is_platform_admin() then raise exception 'platform admin only' using errcode = '42501'; end if;
  if v_email = '' then raise exception 'Enter their email address.'; end if;
  perform pg_advisory_xact_lock(hashtext('platform_admins'));
  select u.id, u.email_confirmed_at into v_user, v_confirmed from auth.users u where lower(u.email) = v_email;
  if v_user is null then raise exception 'No account has that email. They must create an account in the app first.'; end if;
  if v_confirmed is null then raise exception 'That account has not confirmed its email yet.'; end if;
  if exists (select 1 from public.platform_admins p where p.user_id = v_user) then raise exception 'They are already a platform admin.'; end if;
  insert into public.platform_admins (user_id) values (v_user);
  insert into public.audit_log (tbl, op, row_id) values ('platform_admins', 'INSERT', v_email);
end;
$$;

-- Removing a platform admin is deliberately not in the app yet: for now the owner is the only one. An earlier draft
-- had a remove function; make sure no database still has it.
drop function if exists public.admin_remove_platform_admin(uuid);

-- the latest changes to visitors and volunteers in every church (who, where, what)
create or replace function public.admin_audit(p_limit integer default 50)
returns table (at timestamptz, church text, actor text, tbl text, op text, row_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_platform_admin() then raise exception 'platform admin only' using errcode = '42501'; end if;
  return query
    select l.at, coalesce(c.name, ''), coalesce(u.email::text, ''), l.tbl, l.op, coalesce(l.row_id, '')
    from public.audit_log l
    left join public.churches c on c.id = l.church_id
    left join auth.users u on u.id = l.actor
    order by l.at desc, l.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- the owner's read-only look at one church's expo data: who visited and volunteered. The medical readings themselves
-- stay out of this view; the owner reads those in the Supabase dashboard (service role), which only they can open.
create or replace function public.admin_church_data(p_church uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'visitors', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'phone', a.phone, 'email', a.email,
                                                              'done', a.done, 'created_at', a.created_at, 'updated_at', a.updated_at)
                                           order by a.created_at desc), '[]'::jsonb)
                 from (select * from public.attendees where church_id = p_church order by created_at desc limit 500) a),
    'volunteers', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'phone', v.phone, 'email', v.email,
                                                                'status', v.status, 'created_at', v.created_at)
                                             order by v.created_at desc), '[]'::jsonb)
                   from (select * from public.volunteers where church_id = p_church order by created_at desc limit 500) v),
    'visitor_count', (select count(*) from public.attendees a where a.church_id = p_church),
    'volunteer_count', (select count(*) from public.volunteers v where v.church_id = p_church))
  where public.is_platform_admin();   -- no row for anyone else: the caller gets null, never another church's data
$$;

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

-- ================================================================ FOLLOW-UP PEOPLE
-- A church names up to five of its approved members as follow-up people. Staff give each visitor one of them (the
-- visitor's record keeps the member's user id in interests.followUp). A follow-up person sees only the visitors given
-- to them, through my_followups(), never the rest of the church's data. (memberships.followup is added with the table.)

-- the church's follow-up people, for its staff (to give visitors to) and admins
create or replace function public.church_followups(p_church uuid)
returns table (user_id uuid, full_name text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.full_name, m.phone from public.memberships m
  where m.church_id = p_church and m.followup and m.status = 'approved'
    and (p_church = public.staff_church() or public.church_admin_of(p_church))
  order by lower(m.full_name), m.user_id;
$$;

-- make a member a follow-up person (at most five per church), or stop; church admins only
create or replace function public.set_followup(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_church uuid; v_status text;
begin
  select m.church_id, m.status into v_church, v_status from public.memberships m where m.user_id = p_user;
  if v_church is null then raise exception 'That person is not in a church.'; end if;
  if not public.church_admin_of(v_church) then raise exception 'church admins only' using errcode = '42501'; end if;
  if coalesce(p_on, false) then
    if v_status <> 'approved' then raise exception 'Approve this member first.'; end if;
    perform pg_advisory_xact_lock(hashtext('followup:' || v_church::text));   -- two admins at once cannot make a sixth
    if (select count(*) from public.memberships m where m.church_id = v_church and m.followup and m.user_id <> p_user) >= 5 then
      raise exception 'A church can have at most five follow-up people. Turn one off first.';
    end if;
  end if;
  update public.memberships m set followup = coalesce(p_on, false), updated_at = now() where m.user_id = p_user;
end;
$$;

-- the visitors given to me, if I am an approved follow-up person of an active church
create or replace function public.my_followups()
returns table (id text, name text, phone text, email text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, coalesce(a.phone, ''), coalesce(a.email, ''), a.created_at
  from public.memberships m
  join public.churches c on c.id = m.church_id and c.status = 'active'
  join public.attendees a on a.church_id = m.church_id and a.interests ->> 'followUp' = m.user_id::text
  where m.user_id = (select auth.uid()) and m.followup and m.status = 'approved'
  order by a.created_at desc
  limit 500;
$$;

-- ================================================================ VOLUNTEER HUB: SELF-PLEDGE
-- A member can pledge themselves from their account: their pledge is a row in public.volunteers, linked to their
-- account through memberships.volunteer_id (the column is added up with the memberships table, which my_account
-- reads first). The member may write only the pledge fields (name, contacts, choices); booth, status, role and
-- history belong to the church's admins, and no function here can touch them. Safe to re-run.

-- the caller's own pledge, read once when their account screen opens (null when they have not pledged)
create or replace function public.my_pledge()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', v.id, 'name', v.name, 'phone', v.phone, 'email', v.email, 'status', v.status,
    'pledge_expos', v.pledge_expos, 'skills', v.skills, 'pref', v.pref, 'pref2', v.pref2,
    'availability', v.availability, 'shirt', v.shirt, 'emergency', v.emergency, 'notes', v.notes,
    'pledged_on', v.pledged_on, 'since', v.since, 'booth', v.booth, 'role', v.role, 'shift', v.shift, 'lead', v.lead)
  from public.memberships m
  join public.churches c on c.id = m.church_id and c.status = 'active'
  join public.volunteers v on v.church_id = m.church_id and v.id = m.volunteer_id
  where m.user_id = (select auth.uid()) and m.status = 'approved';
$$;

-- create (first save) or update (later saves) the caller's own pledge. Only the pledge fields are taken: an admin
-- owns booth, status, role, history and checked_in, and nothing here can change them. The volunteer number is
-- handed out under a per-church lock, so two members saving at the same moment get different numbers.
create or replace function public.save_my_pledge(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_m public.memberships;
  v_id text;
  v_num integer;
  v_name text; v_phone text; v_email text; v_expos integer;
  v_skills text[]; v_pref text[]; v_avail text[];
  v_list jsonb;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into v_m from public.memberships m where m.user_id = v_uid;
  if v_m.user_id is null then raise exception 'Join a church first.' using errcode = '42501'; end if;
  if v_m.status <> 'approved' then raise exception 'Your church has to approve you before you can pledge.' using errcode = '42501'; end if;
  if not exists (select 1 from public.churches c where c.id = v_m.church_id and c.status = 'active') then
    raise exception 'Your church is not open for pledges at the moment.' using errcode = '42501';
  end if;

  -- the pledge fields, trimmed to the same limits as volunteers_limits (which backs this up as a constraint)
  v_name  := left(btrim(coalesce(p ->> 'name', '')), 200);
  v_phone := left(btrim(coalesce(p ->> 'phone', '')), 40);
  v_email := left(btrim(coalesce(p ->> 'email', '')), 254);
  v_expos := coalesce(nullif(regexp_replace(coalesce(p ->> 'pledgeExpos', ''), '\D', '', ''), '')::integer, 1);
  v_expos := greatest(1, least(v_expos, 30));
  if length(btrim(v_name)) = 0 then raise exception 'Enter your full name.'; end if;
  if v_phone = '' and v_email = '' then raise exception 'Add a mobile number or an email address, so the team can reach you.'; end if;
  -- lists arrive as JSON arrays of short booth/skill keys; anything longer or bigger is dropped, not stored
  v_list := p -> 'skills';
  v_skills := case when jsonb_typeof(v_list) = 'array' then
    (select coalesce(array_agg(left(btrim(x), 40)), '{}'::text[]) from (select jsonb_array_elements_text(v_list) x) s where btrim(x) <> '' limit 20)
    else '{}'::text[] end;
  v_list := p -> 'availability';
  v_avail := case when jsonb_typeof(v_list) = 'array' then
    (select coalesce(array_agg(left(btrim(x), 40)), '{}'::text[]) from (select jsonb_array_elements_text(v_list) x) s where btrim(x) <> '' limit 20)
    else '{}'::text[] end;
  v_list := p -> 'pref';
  v_pref := case when jsonb_typeof(v_list) = 'array' then
    (select coalesce(array_agg(left(btrim(x), 40)), '{}'::text[]) from (select jsonb_array_elements_text(v_list) x) s where btrim(x) <> '' limit 2)
    else '{}'::text[] end;

  if v_m.volunteer_id is not null then
    update public.volunteers v set
      name = v_name, phone = v_phone, email = v_email, pledge_expos = v_expos,
      skills = v_skills, pref = v_pref, pref2 = left(btrim(coalesce(p ->> 'pref2', '')), 40),
      availability = v_avail, shirt = left(btrim(coalesce(p ->> 'shirt', '')), 20),
      emergency = left(btrim(coalesce(p ->> 'emergency', '')), 500),
      notes = left(btrim(coalesce(p ->> 'notes', '')), 2000), updated_at = now()
    where v.church_id = v_m.church_id and v.id = v_m.volunteer_id;
    if not found then raise exception 'Your pledge could not be found — ask your church''s admin.'; end if;
    return v_m.volunteer_id;
  end if;

  -- first save: the next free number in this church, under a lock so two members cannot take the same one
  perform pg_advisory_xact_lock(hashtext('vol:' || v_m.church_id::text));
  v_num := coalesce((select max(substring(v.id from 5)::integer) from public.volunteers v where v.church_id = v_m.church_id), 1000) + 1;
  while exists (select 1 from public.volunteers v where v.church_id = v_m.church_id and v.id = 'VOL-' || v_num) loop
    v_num := v_num + 1;
  end loop;
  v_id := 'VOL-' || v_num;
  insert into public.volunteers (church_id, id, name, phone, email, status, pledge_expos, skills, pref, pref2,
      availability, shirt, emergency, notes, since, pledged_on)
  values (v_m.church_id, v_id, v_name, v_phone, v_email, 'prospect', v_expos, v_skills, v_pref,
      left(btrim(coalesce(p ->> 'pref2', '')), 40), v_avail, left(btrim(coalesce(p ->> 'shirt', '')), 20),
      left(btrim(coalesce(p ->> 'emergency', '')), 500), left(btrim(coalesce(p ->> 'notes', '')), 2000),
      to_char(now(), 'YYYY-MM-DD'), current_date);
  update public.memberships m set volunteer_id = v_id, updated_at = now() where m.user_id = v_uid;
  return v_id;
end;
$$;

-- take back a pledge that has not been registered yet. Once the person is registered or checked in, the row is part
-- of the expo plan and an admin has to remove it.
create or replace function public.withdraw_my_pledge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships;
begin
  select * into v_m from public.memberships m where m.user_id = (select auth.uid());
  if v_m.user_id is null or v_m.volunteer_id is null then raise exception 'You have no pledge to withdraw.'; end if;
  delete from public.volunteers v
   where v.church_id = v_m.church_id and v.id = v_m.volunteer_id and v.status = 'prospect';
  if not found then
    raise exception 'Your pledge is already registered for the expo — ask your church''s admin to remove it.';
  end if;
  update public.memberships m set volunteer_id = null, updated_at = now() where m.user_id = v_m.user_id;
end;
$$;

-- give up a REGISTERED place without giving up the whole pledge: the row stays on the roster as 'prospect'
-- (they still mean to help) with the confirmed booth, shift and registration date cleared, and Unpledge then
-- removes it entirely. Checked-in is part of the expo record and only an admin undoes it. A team leader handing
-- back their station loses the title with it, exactly as release_volunteer does.
create or replace function public.deregister_my_pledge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships; v_row public.volunteers;
begin
  if (select auth.uid()) is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into v_m from public.memberships m where m.user_id = (select auth.uid());
  if v_m.user_id is null or v_m.volunteer_id is null then raise exception 'You have no pledge to deregister.'; end if;
  select * into v_row from public.volunteers v
   where v.church_id = v_m.church_id and v.id = v_m.volunteer_id for update;
  if not found then raise exception 'Your pledge could not be found — ask your church''s admin.'; end if;
  if v_row.status = 'checkedin' then
    raise exception 'You are already checked in for this expo — ask your church''s admin to change it.';
  end if;
  if v_row.status <> 'registered' then
    raise exception 'You are not registered for an expo yet — take back your pledge instead.';
  end if;
  /* the placement guard reads these: this transaction may clear its own booth, and may drop the title */
  perform set_config('newstart.lead_ok', 'on', true);
  perform set_config('newstart.self_release', 'on', true);
  update public.volunteers v set
    status = 'prospect', booth = null, shift = '', registered_on = null,
    lead = false, checked_in = false,
    role = case when v.lead then '' else v.role end,
    updated_at = now()
  where v.church_id = v_m.church_id and v.id = v_m.volunteer_id;
end;
$$;
revoke all on function public.deregister_my_pledge() from public, anon;
grant execute on function public.deregister_my_pledge() to authenticated;

-- attach a pledge a staff member typed in to the person's account, or unlink with an empty number (admins only,
-- mirroring link_member)
create or replace function public.link_volunteer(p_user uuid, p_vol text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships; v_id text := upper(btrim(coalesce(p_vol, '')));
begin
  select * into v_m from public.memberships m where m.user_id = p_user;
  if not found or not public.church_admin_of(v_m.church_id) then raise exception 'church admins only' using errcode = '42501'; end if;
  if v_id = '' then
    update public.memberships m set volunteer_id = null, updated_at = now() where m.user_id = p_user;
    return;
  end if;
  if not (v_id ~ '^VOL-[0-9]+$') then raise exception 'A volunteer number looks like VOL-1001.'; end if;
  if not exists (select 1 from public.volunteers v where v.church_id = v_m.church_id and v.id = v_id) then
    raise exception 'No volunteer with number % in this church.', v_id;
  end if;
  if exists (select 1 from public.memberships o where o.church_id = v_m.church_id and o.volunteer_id = v_id and o.user_id <> p_user) then
    raise exception 'Volunteer % is already linked to another member.', v_id;
  end if;
  update public.memberships m set volunteer_id = v_id, updated_at = now() where m.user_id = p_user;
end;
$$;

revoke all on function public.my_pledge() from public, anon;
grant execute on function public.my_pledge() to authenticated;
revoke all on function public.save_my_pledge(jsonb) from public, anon;
grant execute on function public.save_my_pledge(jsonb) to authenticated;
revoke all on function public.withdraw_my_pledge() from public, anon;
grant execute on function public.withdraw_my_pledge() to authenticated;
revoke all on function public.link_volunteer(uuid, text) from public, anon;
grant execute on function public.link_volunteer(uuid, text) to authenticated;

-- ================================================================ VOLUNTEER HUB: TEAM LEADERS
-- One team leader per station. volunteers.lead says who; the title the screens show stays in volunteers.role
-- ("Team leader" is written when a leader is made, and the trigger below keeps the two in step on a move).
-- The unique index makes the database itself refuse a second leader at one station. Safe to re-run.

create unique index if not exists volunteers_one_lead_idx on public.volunteers (church_id, booth) where lead;

-- A leader moved to another station is not the leader of their new station: a change of booth that the update
-- itself did not pair with a change of lead clears lead. Phase 3's placement functions pair the two when they
-- swap people, so a swap keeps exactly one leader per station.
create or replace function public.volunteers_lead_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booth is distinct from old.booth and new.lead and new.lead is not distinct from old.lead then
    new.lead := false;
  end if;
  /* the display title follows the flag: nobody keeps "Team leader" after losing the title */
  if old.lead and not new.lead and new.role = 'Team leader' then
    new.role := '';
  end if;
  return new;
end;
$$;
revoke all on function public.volunteers_lead_move() from public, anon, authenticated;
drop trigger if exists volunteers_lead_move on public.volunteers;
create trigger volunteers_lead_move before update on public.volunteers
  for each row execute function public.volunteers_lead_move();

-- ================================================================ VOLUNTEER HUB: PLACEMENT
-- All placing, moving, swapping and releasing goes through these functions, so the rules sit in one place and the
-- database — not the screens — decides who may do what. The caller is a church admin, or the station's team leader
-- acting within their own team (a leader's rights come from their linked volunteer record: memberships.volunteer_id,
-- VOLUNTEER HUB: SELF-PLEDGE — they need no staff access). Everything takes the church's advisory lock, so two
-- people placing at the same moment leave a consistent board. Safe to re-run.

-- may the caller move a person from one booth to another? An admin of an active church may; a team leader may
-- place an unplaced person into their own station, release or reorder within it, and nothing else.
create or replace function public.can_place(p_from text, p_to text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select v.booth, v.lead from public.memberships m
    join public.churches c on c.id = m.church_id and c.status = 'active'
    join public.volunteers v on v.church_id = m.church_id and v.id = m.volunteer_id
    where m.user_id = (select auth.uid()) and m.status = 'approved'
  )
  select exists (select 1 from public.memberships m join public.churches c on c.id = m.church_id
                  where m.user_id = (select auth.uid()) and m.status = 'approved' and m.role = 'admin'
                    and c.status = 'active')
      or exists (select 1 from me
                  where lead and ((p_from is not distinct from booth and (p_to is null or p_to = booth))
                               or (p_from is null and p_to is not distinct from booth)));
$$;
revoke all on function public.can_place(text, text) from public, anon, authenticated;

-- nobody outside these functions changes where a person stands: a direct write of booth or lead by anybody else
-- is refused, on insert as well as on update (the staff sync sends whole rows, but only the placement columns are
-- guarded; edits of names and contact details still go through). A change of lead is an admin decision; the
-- placement functions mark their transaction with newstart.lead_ok because a swap moves the title with the station
-- even when a team leader (not an admin) is the one swapping. Leaders' rights are read live, so losing the title
-- loses the rights at once.
create or replace function public.volunteers_place_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_lead_ok boolean := coalesce(current_setting('newstart.lead_ok', true), '') = 'on';
        v_self_ok boolean := coalesce(current_setting('newstart.self_release', true), '') = 'on';
begin
  if (select auth.uid()) is null then return new; end if;
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
  /* A member may take THEMSELVES off a booth: deregister_my_pledge marks its transaction with
     newstart.self_release. It only ever clears their own booth — a move to another station, a lead
     change, or any other row still needs an admin or that station's leader. */
  if new.booth is distinct from old.booth
     and not (public.is_admin() or public.can_place(old.booth, new.booth)
              or (v_self_ok and new.booth is null
                  and exists (select 1 from public.memberships m
                               where m.user_id = (select auth.uid())
                                 and m.church_id = new.church_id and m.volunteer_id = new.id))) then
    raise exception 'Only the church''s admins and the station''s team leader may place volunteers' using errcode = '42501', hint = 'place_guard';
  end if;
  return new;
end;
$$;
revoke all on function public.volunteers_place_guard() from public, anon, authenticated;
drop trigger if exists volunteers_place_guard on public.volunteers;
create trigger volunteers_place_guard before insert or update on public.volunteers
  for each row execute function public.volunteers_place_guard();

-- the caller's church for volunteer-hub actions: any approved member of an active church (leaders are not staff)
create or replace function public.hub_church()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.church_id from public.memberships m join public.churches c on c.id = m.church_id
  where m.user_id = (select auth.uid()) and m.status = 'approved' and c.status = 'active';
$$;
revoke all on function public.hub_church() from public, anon;
grant execute on function public.hub_church() to authenticated;

-- put someone on a station (an unplaced person, or a move). A prospect becomes registered on their first placement.
create or replace function public.place_volunteer(p_vol text, p_booth text)
returns setof public.volunteers
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.volunteers; v_church uuid := public.hub_church();
begin
  if v_church is null then raise exception 'Join a church first.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('vol:' || v_church::text));
  select * into v_row from public.volunteers v where v.church_id = v_church and v.id = p_vol for update;
  if not found then raise exception 'No such volunteer in your church.'; end if;
  if length(btrim(coalesce(p_booth, ''))) = 0 then raise exception 'Choose a station.'; end if;
  if not (public.is_admin() or public.can_place(v_row.booth, left(btrim(p_booth), 40))) then
    raise exception 'Only the church''s admins and the station''s team leader may place volunteers' using errcode = '42501';
  end if;
  update public.volunteers v set
    booth = left(btrim(p_booth), 40),
    status = case when v.status = 'prospect' then 'registered' else v.status end,
    registered_on = coalesce(v.registered_on, current_date)
  where v.church_id = v_church and v.id = p_vol
  returning * into v_row;
  return next v_row;
end;
$$;
revoke all on function public.place_volunteer(text, text) from public, anon;
grant execute on function public.place_volunteer(text, text) to authenticated;

-- swap two people in one locked transaction. The leader title stays with the STATION: whoever arrives at a station
-- that had a leader becomes its leader, and the one who left is no longer a leader. The three steps below never
-- show the unique index two leaders at one station: both leads are cleared before the booths move.
create or replace function public.swap_volunteers(p_a text, p_b text)
returns setof public.volunteers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church uuid := public.hub_church();
  v_a public.volunteers; v_b public.volunteers;
  v_a_lead boolean; v_b_lead boolean;
begin
  if v_church is null then raise exception 'Join a church first.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('vol:' || v_church::text));
  select * into v_a from public.volunteers v where v.church_id = v_church and v.id = least(p_a, p_b) for update;
  if not found then raise exception 'No such volunteer in your church.'; end if;
  select * into v_b from public.volunteers v where v.church_id = v_church and v.id = greatest(p_a, p_b) for update;
  if not found then raise exception 'No such volunteer in your church.'; end if;
  if v_a.id = v_b.id then raise exception 'Pick two different people to swap.'; end if;
  if not (public.is_admin()
          or (public.can_place(v_a.booth, v_b.booth) and public.can_place(v_b.booth, v_a.booth))) then
    raise exception 'A team leader may only swap within their own station, or one of their people with somebody unplaced' using errcode = '42501';
  end if;
  perform set_config('newstart.lead_ok', 'on', true);
  v_a_lead := v_a.lead; v_b_lead := v_b.lead;
  update public.volunteers v set lead = false
   where v.church_id = v_church and v.id in (v_a.id, v_b.id) and v.lead;
  update public.volunteers v set booth = case when v.id = v_a.id then v_b.booth else v_a.booth end
   where v.church_id = v_church and v.id in (v_a.id, v_b.id);
  update public.volunteers v set lead = true, role = 'Team leader'
   where v.church_id = v_church and ((v.id = v_a.id and v_b_lead) or (v.id = v_b.id and v_a_lead));
  /* somebody who arrives at a station is registered, exactly as place_volunteer would have made them */
  update public.volunteers v set status = 'registered', registered_on = coalesce(v.registered_on, current_date)
   where v.church_id = v_church and v.id in (v_a.id, v_b.id) and v.booth is not null and v.status = 'prospect';
  return query select * from public.volunteers v where v.church_id = v_church and v.id in (v_a.id, v_b.id);
end;
$$;
revoke all on function public.swap_volunteers(text, text) from public, anon;
grant execute on function public.swap_volunteers(text, text) to authenticated;

-- make (or unmake, with p_vol null) a station's one team leader; admins only
create or replace function public.set_station_lead(p_booth text, p_vol text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_church uuid := public.hub_church(); v_booth text := left(btrim(coalesce(p_booth, '')), 40);
begin
  if v_church is null then raise exception 'Join a church first.' using errcode = '42501'; end if;
  if not public.is_admin() then
    raise exception 'Only the church''s admins choose team leaders' using errcode = '42501';
  end if;
  if length(v_booth) = 0 then raise exception 'Choose a station.'; end if;
  perform pg_advisory_xact_lock(hashtext('vol:' || v_church::text));
  perform set_config('newstart.lead_ok', 'on', true);
  update public.volunteers v set lead = false, role = ''
   where v.church_id = v_church and v.booth = v_booth and v.lead;
  if coalesce(btrim(p_vol), '') <> '' then
    update public.volunteers v set lead = true, role = 'Team leader'
     where v.church_id = v_church and v.id = btrim(p_vol) and v.booth = v_booth;
    if not found then raise exception 'Place them at the station first, then make them the leader.'; end if;
  end if;
end;
$$;
revoke all on function public.set_station_lead(text, text) from public, anon;
grant execute on function public.set_station_lead(text, text) to authenticated;

-- take someone off their station so they can be placed elsewhere (their pledge choices stay)
create or replace function public.release_volunteer(p_vol text)
returns setof public.volunteers
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.volunteers; v_church uuid := public.hub_church();
begin
  if v_church is null then raise exception 'Join a church first.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('vol:' || v_church::text));
  select * into v_row from public.volunteers v where v.church_id = v_church and v.id = p_vol for update;
  if not found then raise exception 'No such volunteer in your church.'; end if;
  if not (public.is_admin() or public.can_place(v_row.booth, null)) then
    raise exception 'Only the church''s admins and the station''s team leader may release volunteers' using errcode = '42501';
  end if;
  perform set_config('newstart.lead_ok', 'on', true);
  update public.volunteers v set
    booth = null, status = 'prospect', lead = false, checked_in = false,
    role = case when v.lead then '' else v.role end, updated_at = now()
  where v.church_id = v_church and v.id = p_vol
  returning * into v_row;
  return next v_row;
end;
$$;
revoke all on function public.release_volunteer(text) from public, anon;
grant execute on function public.release_volunteer(text) to authenticated;

-- a team leader sets one of their people's shift; an admin may set anybody's
create or replace function public.set_shift(p_vol text, p_shift text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.volunteers; v_church uuid := public.hub_church();
begin
  if v_church is null then raise exception 'Join a church first.' using errcode = '42501'; end if;
  select * into v_row from public.volunteers v where v.church_id = v_church and v.id = p_vol;
  if not found then raise exception 'No such volunteer in your church.'; end if;
  if not (public.is_admin() or public.can_place(v_row.booth, v_row.booth)) then
    raise exception 'Only the church''s admins and the station''s team leader may set shifts' using errcode = '42501';
  end if;
  update public.volunteers v set shift = left(btrim(coalesce(p_shift, '')), 100), updated_at = now()
   where v.church_id = v_church and v.id = p_vol;
end;
$$;
revoke all on function public.set_shift(text, text) from public, anon;
grant execute on function public.set_shift(text, text) to authenticated;

-- the leader's team: their station's people plus the unplaced volunteers who asked for the station. Only what a
-- team leader may see — never notes, emergency contacts or history — and never another station's rows.
create or replace function public.my_team()
returns table (id text, name text, phone text, status text, booth text, shift text, pref text[], pref2 text, lead boolean, linked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.name, v.phone, v.status, v.booth, v.shift, v.pref, v.pref2, v.lead,
         exists (select 1 from public.memberships o where o.church_id = v.church_id and o.volunteer_id = v.id)
  from public.memberships m
  join public.churches c on c.id = m.church_id and c.status = 'active'
  join public.volunteers me on me.church_id = m.church_id and me.id = m.volunteer_id and me.lead and me.booth is not null
  join public.volunteers v on v.church_id = m.church_id
   and ((v.booth = me.booth and v.id <> me.id)
        or (v.booth is null and (me.booth = any (v.pref) or v.pref2 = me.booth)))
  where m.user_id = (select auth.uid()) and m.status = 'approved'
  order by (v.booth is null), lower(v.name)
  limit 200;
$$;
revoke all on function public.my_team() from public, anon;
grant execute on function public.my_team() to authenticated;

-- ================================================================ VOLUNTEER HUB: NOTIFICATIONS
-- A small inbox for events about the person: membership, placement, the leader title, their church, their team and
-- their shift. Only people with accounts get rows, and only the account's own rows are readable. Rows are written
-- by the triggers and functions below — never by the screens — so every path that changes a placement notifies,
-- including a desk acting through the sync. No body text is ever copied from health data: only station names and
-- roles. Safe to re-run.

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  church_id  uuid not null references public.churches (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  title      text not null check (length(title) <= 120),
  body       text not null default '' check (length(body) <= 300),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
-- a user reads and marks their own rows; there is no insert policy: only the triggers and functions below write
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
/* RLS applies to rows, not columns: a column grant is what stops a member rewriting a notification's text */
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- the station's display name, for notification text (the keys the app's BOOTHS list uses)
create or replace function public.booth_title(p_booth text)
returns text
language sql
stable
set search_path = ''
as $$
  select case p_booth
    when 'welcome' then 'Welcome & Registration' when 'vitals' then 'Vitals & BMI'
    when 'bp' then 'Blood Pressure' when 'sugar' then 'Blood Sugar & Chol.'
    when 'kitchen' then 'Kitchen Pharmacy' when 'plan' then 'Health Counselling'
    when 'prayer' then 'Prayer & Chaplaincy' when 'kids' then 'Kids Corner'
    when 'logistics' then 'Logistics & Setup' when 'media' then 'Media & Photography'
    when 'followup' then 'Follow-up & Data' when 'refresh' then 'Refreshments'
    else coalesce(p_booth, '') end;
$$;
revoke all on function public.booth_title(text) from public, anon, authenticated;

-- one row, quietly: a notification must never break the change that caused it. The church comes from the event,
-- never from the caller: the platform admin approving a church has no membership of their own.
create or replace function public.notify(p_church uuid, p_user uuid, p_kind text, p_title text, p_body text default '')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (church_id, user_id, kind, title, body)
  select p_church, p_user, p_kind, left(p_title, 120), left(p_body, 300)
  where p_user is not null and p_church is not null;
$$;
revoke all on function public.notify(uuid, uuid, text, text, text) from public, anon, authenticated;

-- placements, the leader title and shifts: written on any update of a linked volunteer row, whichever desk made it
create or replace function public.volunteers_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid; v_old_lead uuid; v_new_lead uuid;
begin
  select m.user_id into v_user from public.memberships m where m.church_id = new.church_id and m.volunteer_id = new.id;
  if new.booth is distinct from old.booth then
    if v_user is not null then
      perform public.notify(new.church_id, v_user, 'placement',
        case when new.booth is null then 'You were taken off ' || public.booth_title(old.booth)
             when old.booth is null then 'You are placed at ' || public.booth_title(new.booth)
             else 'You moved to ' || public.booth_title(new.booth) end,
        'Your team leader will confirm your shift on the day.');
    end if;
    -- the station that gained or lost someone tells its leader (joined or left your team)
    select l.user_id into v_new_lead from public.memberships l where l.church_id = new.church_id and l.volunteer_id = (
      select v.id from public.volunteers v where v.church_id = new.church_id and v.booth = new.booth and v.lead and v.id <> new.id);
    select l.user_id into v_old_lead from public.memberships l where l.church_id = old.church_id and l.volunteer_id = (
      select v.id from public.volunteers v where v.church_id = old.church_id and v.booth = old.booth and v.lead and v.id <> old.id);
    /* v_user is null for an unlinked volunteer; `<> v_user` would then be NULL and the leader would never hear */
    if new.booth is not null and v_new_lead is not null and (v_user is null or v_new_lead <> v_user) then
      perform public.notify(new.church_id, v_new_lead, 'team', 'Someone joined your team at ' || public.booth_title(new.booth), 'Open My team to see who and set their shift.');
    end if;
    if old.booth is not null and v_old_lead is not null and (v_user is null or v_old_lead <> v_user) and v_old_lead is distinct from v_new_lead then
      perform public.notify(old.church_id, v_old_lead, 'team', 'Someone left your team at ' || public.booth_title(old.booth), 'The admin moved them to another station.');
    end if;
  end if;
  if new.lead is distinct from old.lead and v_user is not null then
    perform public.notify(new.church_id, v_user, 'lead',
      case when new.lead then 'You lead ' || public.booth_title(new.booth) || ' ★'
           else 'You are no longer the leader of ' || public.booth_title(coalesce(old.booth, new.booth)) end,
      case when new.lead then 'Open My team to add people and set their shifts.' else 'Ask your church''s admin if that is a surprise.' end);
  end if;
  if new.shift is distinct from old.shift and v_user is not null and new.shift <> '' then
    perform public.notify(new.church_id, v_user, 'shift', 'Your shift changed', coalesce(new.shift, ''));
  end if;
  return null;
end;
$$;
revoke all on function public.volunteers_notify() from public, anon, authenticated;
drop trigger if exists volunteers_notify on public.volunteers;
create trigger volunteers_notify after update on public.volunteers
  for each row execute function public.volunteers_notify();

-- a volunteer typed in already placed (the staff form's insert, or a sync from another desk) gets the same
-- placement word the update trigger sends. No team row here: pledge_notify already tells the station leader
-- about a new pledge, so one event still means one message.
create or replace function public.volunteers_notify_new()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  select m.user_id into v_user from public.memberships m
   where m.church_id = new.church_id and m.volunteer_id = new.id;
  if v_user is null then return null; end if;
  if new.booth is not null then
    perform public.notify(new.church_id, v_user, 'placement',
      'You are placed at ' || public.booth_title(new.booth),
      'Your team leader will confirm your shift on the day.');
  end if;
  if new.lead and new.booth is not null then
    perform public.notify(new.church_id, v_user, 'lead',
      'You lead ' || public.booth_title(new.booth) || ' ★',
      'Open My team to add people and set their shifts.');
  end if;
  return null;
end;
$$;
revoke all on function public.volunteers_notify_new() from public, anon, authenticated;
drop trigger if exists volunteers_notify_new on public.volunteers;
create trigger volunteers_notify_new after insert on public.volunteers
  for each row execute function public.volunteers_notify_new();

-- membership approved or role changed
create or replace function public.memberships_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status = 'approved' then
    perform public.notify(new.church_id, new.user_id, 'membership', 'Your membership was approved',
      'You can now see your own expo results and pledge for the next expo.');
  end if;
  if new.role is distinct from old.role then
    perform public.notify(new.church_id, new.user_id, 'membership', 'Your role changed to ' || new.role,
      case new.role when 'admin' then 'You manage this church''s members, volunteers and placements.'
                    when 'staff' then 'You can work the expo app on your church''s desks.'
                    else 'Ask your church''s admin if that is a surprise.' end);
  end if;
  return null;
end;
$$;
revoke all on function public.memberships_notify() from public, anon, authenticated;
drop trigger if exists memberships_notify on public.memberships;
create trigger memberships_notify after update on public.memberships
  for each row execute function public.memberships_notify();

-- the church was approved by the platform admin
create or replace function public.churches_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status <> 'active' then
    perform public.notify(new.id, m.user_id, 'church', 'Your church was approved',
      new.name || ' can now add visitors, volunteers and the queue.')
    from public.memberships m where m.church_id = new.id and m.role = 'admin' and m.status = 'approved';
  end if;
  return null;
end;
$$;
revoke all on function public.churches_notify() from public, anon, authenticated;
drop trigger if exists churches_notify on public.churches;
create trigger churches_notify after update on public.churches
  for each row execute function public.churches_notify();

-- a member's first pledge tells the church's admins and the leader of each station they chose
create or replace function public.pledge_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  /* the title column refuses more than 120 characters; a 200-character name must not abort the pledge itself */
  if not exists (select 1 from public.notifications n
                 where n.church_id = new.church_id and n.kind = 'pledge'
                   and n.title = left('New pledge: ' || new.name, 120) and n.created_at > now() - interval '1 hour') then
    insert into public.notifications (church_id, user_id, kind, title, body)
    select new.church_id, m.user_id, 'pledge', left('New pledge: ' || new.name, 120),
           case when cardinality(new.pref) = 0 then 'They did not choose a station yet.'
                else 'They asked for ' || (select string_agg(public.booth_title(x), ', ') from unnest(new.pref) x) || '.' end
    from public.memberships m
    where m.church_id = new.church_id and m.role = 'admin' and m.status = 'approved';
    insert into public.notifications (church_id, user_id, kind, title, body)
    select distinct new.church_id, lm.user_id, 'pledge', left('New pledge for your station: ' || new.name, 120),
           'They asked for ' || public.booth_title(l.booth) || '.'
    from public.volunteers l
    join public.memberships lm on lm.church_id = l.church_id and lm.volunteer_id = l.id
    where l.church_id = new.church_id and l.lead and l.booth = any (coalesce(new.pref, '{}'));
  end if;
  return null;
end;
$$;
revoke all on function public.pledge_notify() from public, anon, authenticated;
drop trigger if exists pledge_notify on public.volunteers;
create trigger pledge_notify after insert on public.volunteers
  for each row execute function public.pledge_notify();

-- ================================================================ ADMIN ALERTS: REGISTER / DEREGISTER / WITHDRAW
-- pledge_notify above already tells a church's admins about a new pledge. These two cover the other three
-- movements so an admin inbox reflects every change to who is coming: a registration, a deregistration, and a
-- withdrawn pledge. One row per approved admin, and — like every other notification here — a row that can never
-- abort the change that caused it.
create or replace function public.volunteers_admin_status_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then return null; end if;
  if new.status = 'registered' then
    insert into public.notifications (church_id, user_id, kind, title, body)
    select new.church_id, m.user_id, 'register', left('Registered: ' || new.name, 120),
           case when new.booth is null then 'They are registered for the expo.'
                else 'They are registered at ' || public.booth_title(new.booth) || '.' end
    from public.memberships m
    where m.church_id = new.church_id and m.role = 'admin' and m.status = 'approved';
  elsif new.status = 'prospect' and old.status = 'registered' then
    insert into public.notifications (church_id, user_id, kind, title, body)
    select new.church_id, m.user_id, 'deregister', left('Deregistered: ' || new.name, 120),
           'They gave up their place at the expo. Their pledge still stands.'
    from public.memberships m
    where m.church_id = new.church_id and m.role = 'admin' and m.status = 'approved';
  end if;
  return null;
end;
$$;
revoke all on function public.volunteers_admin_status_notify() from public, anon, authenticated;
drop trigger if exists volunteers_admin_status_notify on public.volunteers;
create trigger volunteers_admin_status_notify after update of status on public.volunteers
  for each row execute function public.volunteers_admin_status_notify();

create or replace function public.volunteers_admin_withdraw_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_by_admin boolean := public.is_admin();
begin
  /* deleting a church cascades here: there is no church left to notify, and a row pointing at it would
     fail the foreign key and abort the delete */
  if not exists (select 1 from public.churches c where c.id = old.church_id) then return null; end if;
  insert into public.notifications (church_id, user_id, kind, title, body)
  select old.church_id, m.user_id, 'unpledge',
         left((case when v_by_admin then 'Removed from the roster: ' else 'Pledge withdrawn: ' end) || old.name, 120),
         case when v_by_admin then 'An admin took them off the expo roster.'
              else 'They are no longer on the expo roster.' end
  from public.memberships m
  where m.church_id = old.church_id and m.role = 'admin' and m.status = 'approved';
  return null;
end;
$$;
revoke all on function public.volunteers_admin_withdraw_notify() from public, anon, authenticated;
drop trigger if exists volunteers_admin_withdraw_notify on public.volunteers;
create trigger volunteers_admin_withdraw_notify after delete on public.volunteers
  for each row execute function public.volunteers_admin_withdraw_notify();

-- mark read up to a row, in one call ("Mark all read")
create or replace function public.mark_notifications_read(p_upto bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if (select auth.uid()) is null then raise exception 'sign in first' using errcode = '42501'; end if;
  update public.notifications n set read_at = now()
   where n.user_id = (select auth.uid()) and n.read_at is null and n.id <= coalesce(p_upto, 9223372036854775807);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.mark_notifications_read(bigint) from public, anon;
grant execute on function public.mark_notifications_read(bigint) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ================================================================ INVITE LINKS
-- A church admin shares a link (…/?join=CODE). Whoever signs in with it joins that church at once, approved, as a
-- member or as staff: no searching for the church and no waiting for approval. Links last 30 days and can be cancelled.
create table if not exists public.church_invites (
  code       text primary key check (code ~ '^[0-9a-f]{32}$'),
  church_id  uuid not null references public.churches (id) on delete cascade,
  role       text not null check (role in ('member', 'staff')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  uses       integer not null default 0
);
alter table public.church_invites enable row level security;       -- no policies: only the functions below reach it
revoke all on public.church_invites from anon, authenticated;
create index if not exists church_invites_church_idx on public.church_invites (church_id);

create or replace function public.create_church_invite(p_church uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_code text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.church_admin_of(p_church) then raise exception 'church admins only' using errcode = '42501'; end if;
  if p_role not in ('member', 'staff') then raise exception 'An invite is for a member or for staff.'; end if;
  insert into public.church_invites (code, church_id, role, created_by) values (v_code, p_church, p_role, (select auth.uid()));
  return v_code;
end;
$$;

-- cancel every invite link of a church (for example, one was shared too widely)
create or replace function public.cancel_church_invites(p_church uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  if not public.church_admin_of(p_church) then raise exception 'church admins only' using errcode = '42501'; end if;
  delete from public.church_invites i where i.church_id = p_church;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- what an invite link is for, to show before joining: the church's name and the role (nothing when it is not valid)
create or replace function public.church_invite_info(p_code text)
returns table (church_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, i.role from public.church_invites i join public.churches c on c.id = i.church_id
  where i.code = p_code and i.expires_at > now() and c.status = 'active';
$$;

create or replace function public.join_with_invite(p_code text, p_full_name text default '', p_phone text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_inv public.church_invites; v_cur public.memberships;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select i.* into v_inv from public.church_invites i join public.churches c on c.id = i.church_id
  where i.code = p_code and i.expires_at > now() and c.status = 'active';
  if v_inv.code is null then raise exception 'This invite link has expired or was cancelled. Ask the church for a new one.'; end if;
  select m.* into v_cur from public.memberships m where m.user_id = v_uid;
  if v_cur.user_id is not null and v_cur.church_id <> v_inv.church_id then
    raise exception 'You already belong to another church. Leave it first.';
  end if;
  if v_cur.user_id is null then
    insert into public.memberships (user_id, church_id, role, status, full_name, phone)
    select v_uid, v_inv.church_id, v_inv.role, 'approved',
           left(coalesce(nullif(btrim(p_full_name), ''), u.raw_user_meta_data ->> 'full_name', ''), 200), left(btrim(coalesce(p_phone, '')), 40)
    from auth.users u where u.id = v_uid;
  else
    -- already in this church: approve them, and raise a member to staff if that is what the link is for (never lower an admin)
    update public.memberships m
    set status = 'approved', role = case when m.role = 'member' and v_inv.role = 'staff' then 'staff' else m.role end, updated_at = now()
    where m.user_id = v_uid;
  end if;
  update public.church_invites i set uses = i.uses + 1 where i.code = v_inv.code;
  return v_inv.church_id;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['is_platform_admin()', 'staff_church()', 'is_staff()', 'is_admin()', 'church_admin_of(uuid)',
    'queue_call_next(text)', 'staff_pending()', 'staff_approve(uuid)', 'my_account()', 'church_directory(text)',
    'join_church(uuid, text, text, text, text[])', 'register_church(text, text, text, text)', 'update_my_details(text, text, text, date)',
    'leave_church()', 'delete_my_account()', 'my_health()', 'update_church(uuid, text, text, text, text)', 'church_members(uuid)',
    'set_member(uuid, text, text)', 'link_member(uuid, text)', 'remove_member(uuid)', 'admin_churches()',
    'admin_set_church_status(uuid, text)', 'admin_audit(integer)', 'admin_church_data(uuid)',
    'admin_platform_admins()', 'admin_add_platform_admin(text)', 'church_leader_of(uuid)', 'set_admin_post(uuid, text)',
    'church_plans(uuid)', 'save_church_plan(uuid, uuid, text, text, jsonb, text)', 'delete_church_plan(uuid)',
    'church_followups(uuid)', 'set_followup(uuid, boolean)', 'my_followups()',
    'create_church_invite(uuid, text)', 'cancel_church_invites(uuid)', 'church_invite_info(text)', 'join_with_invite(text, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ================================================================ PAPER HEALTH RECORD: CHRONIC ILLNESSES
-- The chronic illnesses written on the paper form are text, and s takes numbers only, so they get their own column.
-- The app sends it only when something is written, so the app keeps working before this part has been run.
alter table public.attendees add column if not exists chronic_list text;
alter table public.attendees drop constraint if exists attendees_chronic_list_len;
alter table public.attendees add constraint attendees_chronic_list_len check (coalesce(length(chronic_list), 0) <= 200) not valid;

-- ================================================================ READINGS ARE KEPT 7 DAYS
-- A visitor takes their results home on the printed card or by WhatsApp on the day, so the readings of that visit are
-- cleared a week later and a visitor who did not agree to follow-up is deleted. This is enforced on every write, not
-- only by the purge below, because a phone that was offline still holds an old copy and would otherwise upload the
-- readings again (src/account.js mergeRemote does re-upload a row that is "edited here but gone there").
-- The visit's date comes from created_at, which the app now sends with each row, so an old copy keeps its real date
-- instead of looking like a new visit. A phone running the older app does not send created_at, but every version
-- sends the consent date (interests.consentOn), so that date decides for those. Badge numbers are per church and can
-- be reused at a later expo, so a badge number never decides on its own. Change 7 days here, in src/retention.js and
-- in the notice together.

-- one definition of "this visit is past the grace period", used by the trigger and the purge
create or replace function public.visit_is_old(p_created timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_created is not null and p_created < now() - interval '7 days';
$$;
revoke all on function public.visit_is_old(timestamptz) from public, anon, authenticated;

-- The date on the consent record, and whether it is past the grace period. An older phone does not send created_at,
-- so the column default would make its stale copy look like a new visit; every version of the app sends this date.
-- ISO dates compare correctly as text, so a malformed value is ignored rather than failing the write.
create or replace function public.consent_is_old(j jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(j ->> 'consentOn', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and (j ->> 'consentOn') < to_char(now() - interval '7 days', 'YYYY-MM-DD');
$$;
revoke all on function public.consent_is_old(jsonb) from public, anon, authenticated;

create or replace function public.attendees_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_follow boolean;
begin
  v_follow := coalesce(new.interests ->> 'optin', 'false') = 'true';

  -- a visit's date never moves: an update keeps the date the row already has
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;

  -- an old visit is one whose date the phone sent is past the grace period, or (for an older phone that sends no
  -- date) whose consent date is. A badge number is reused at a later expo, so it never decides on its own.
  if not public.visit_is_old(new.created_at) and not public.consent_is_old(new.interests) then return new; end if;

  -- a visit past the grace period keeps nothing about itself: no readings, no prayer, no measurements
  new.s := '{}'::jsonb;
  new.prayer := '';
  new.chronic_list := null;
  new.height_cm := null;
  -- without follow-up there is nothing left to keep, so a first write of such a visit is skipped; the daily purge
  -- deletes a row that is still there (an update keeps the row it cannot delete from inside its own trigger)
  if not v_follow and tg_op = 'INSERT' then return null; end if;
  return new;
end;
$$;
revoke all on function public.attendees_retention() from public, anon, authenticated;
drop trigger if exists attendees_retention on public.attendees;
create trigger attendees_retention before insert or update on public.attendees
  for each row execute function public.attendees_retention();

-- ================================================================ CUSTOM PLANS (one visitor, item 5/6)
-- A custom plan is a church's own words for one visitor. It travels inside attendee.interests.customPlan, exactly
-- like interests.churchPlan, so the staff sync (attToRow → upsert) can write it with no mapper change. That also
-- means any approved account could PATCH it over the API: a client-side check is bypassable, so the role rule has
-- to live here (R-04, D-05). The App Owner and an approved church admin may write, replace or remove it; every
-- other approved account may still change the rest of interests (consent, church plan, prayer flags) exactly as
-- before (R-05). Shape follows volunteers_place_guard: an upsert fires the INSERT branch for a row that already
-- exists, so it is judged against the stored row — never as a fresh insert that would block an ordinary edit.
create or replace function public.attendees_custom_plan_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_new jsonb := new.interests -> 'customPlan';
        v_old jsonb;
begin
  if (select auth.uid()) is null then return new; end if;   -- anon has no write policy; nothing to judge
  /* An upsert fires BEFORE INSERT for a row it is about to update, so the stored plan has to be looked up.
     The key is (church_id, id) and visitor ids are handed out per device, so EXPO-042 exists in many
     churches: without church_id this reads another church's plan and then either refuses an honest insert
     or waves a real one through. */
  if tg_op = 'INSERT' then
    select a.interests -> 'customPlan' into v_old from public.attendees a
     where a.church_id = new.church_id and a.id = new.id;
  elsif tg_op = 'UPDATE' then
    v_old := old.interests -> 'customPlan';
  end if;
  if v_old is distinct from v_new and not (public.is_admin() or public.is_platform_admin()) then
    raise exception 'Only the church''s admins can write a custom plan' using errcode = '42501', hint = 'custom_plan_guard';
  end if;
  return new;
end;
$$;
revoke all on function public.attendees_custom_plan_guard() from public, anon, authenticated;
drop trigger if exists attendees_custom_plan_guard on public.attendees;
create trigger attendees_custom_plan_guard before insert or update on public.attendees
  for each row execute function public.attendees_custom_plan_guard();

-- ================================================================ RETENTION (POPIA s14)
-- Visitors take their results home on the printed card or by WhatsApp on the day, so the church does not keep the
-- readings of a past visit: GRACE_DAYS after the visit they are cleared, and a visitor who did not agree to follow-up
-- is deleted with them. Only name and contact details of a follow-up stay, for 2 years after their last visit (the last
-- time the row was updated), then the whole record goes. The app applies the same rule on the phone (GRACE_DAYS and
-- RETENTION_YEARS in src/retention.js) and its privacy notice says it: change both together.
-- Deleting a visitor normally leaves a full copy in audit_log so an admin's mistake can be undone. Copies of a visit
-- whose readings were cleared are emptied straight away; any other is emptied after 90 days, and the purge below leaves
-- no copy at all. Queue entries hold only badge numbers and times, and are kept 30 days. Audit lines themselves (who
-- did what, no health data) are kept 2 years.
create or replace function public.purge_expired_visitors()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  -- the daily job runs with no signed-in user; a signed-in caller must be the platform admin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'platform admin only' using errcode = '42501';
  end if;
  -- the readings of a visit older than the grace period go, but the person stays if they agreed to follow-up
  update public.attendees set s = '{}'::jsonb, prayer = '', chronic_list = null, height_cm = null
   where (created_at < now() - interval '7 days' or public.consent_is_old(interests))
     and (s <> '{}'::jsonb or prayer <> '' or chronic_list is not null or height_cm is not null);
  -- without follow-up there is nothing left to keep, so the visitor goes. A phone that still holds an old copy cannot
  -- put them back: the trigger judges the copy by its created_at or its consent date, not by its badge number.
  with gone as (
    delete from public.attendees a
     where (a.created_at < now() - interval '7 days' or public.consent_is_old(a.interests))
       and coalesce(a.interests ->> 'optin', 'false') <> 'true'
    returning 1
  )
  select count(*) into n from gone;
  -- 2 years after the last visit, everything goes, follow-up or not
  with expired as (
    delete from public.attendees where updated_at < now() - interval '2 years' returning id
  )
  select n + count(*) into n from expired;
  update public.audit_log set old = null
   where tbl = 'attendees' and op = 'DELETE' and old is not null
     and (at < now() - interval '90 days'
          or (old ->> 'updated_at')::timestamptz < now() - interval '2 years'
          or (old ->> 'created_at')::timestamptz < now() - interval '7 days'
          or public.consent_is_old(old -> 'interests'));
  delete from public.audit_log where at < now() - interval '2 years';
  delete from public.queue_entries where joined_at < now() - interval '30 days';
  -- notifications are read-once: a read one goes after 30 days, any one after 90
  delete from public.notifications where (read_at is not null and read_at < now() - interval '30 days')
     or created_at < now() - interval '90 days';
  return n;
end;
$$;
revoke all on function public.purge_expired_visitors() from public, anon;
grant execute on function public.purge_expired_visitors() to authenticated;

-- The list of deleted badge numbers this rule used to keep is gone. Badge numbers are reused at the next expo, so the
-- list quietly dropped a new visitor who was given a deleted visitor's number; the consent date above replaces it.
drop table if exists public.purged_attendees;

-- run it every day at 03:00 when the pg_cron extension is on (Database → Extensions → pg_cron), so a reading lives at
-- most a day past the 7-day grace period. Without the extension nothing is deleted: a platform admin then runs
--   select public.purge_expired_visitors();  here (daily, or as often as the expo is in use).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-visitors';
    perform cron.schedule('purge-expired-visitors', '0 3 * * *', 'select public.purge_expired_visitors()');
  end if;
end $$;

-- ================================================================ AFTER RUNNING THE SCRIPT
-- 1. Make yourself the platform admin, once (change the email). Only this SQL editor can do it:
--
--    insert into public.platform_admins (user_id)
--    select id from auth.users where email = 'you@example.com'
--    on conflict do nothing;
--
-- 2. Keep "Allow new users to sign up" ON (Authentication → Sign In / Providers): members create their own accounts.
-- 3. Open the app. Churches register there and wait for you (logo → Admin); each church's admin approves its own
--    members and makes volunteers 'staff' (logo → Church). public.staff is no longer used after the first run.
