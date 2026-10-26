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
  and jsonb_typeof(interests) = 'object' and octet_length(interests::text) <= 1000   -- the paper form's seminar and "heard via" ticks, plus the follow-up name
) not valid;

alter table public.volunteers drop constraint if exists volunteers_limits;
alter table public.volunteers add constraint volunteers_limits check (
  length(name) <= 200 and length(phone) <= 40 and length(email) <= 254 and length(notes) <= 2000 and length(emergency) <= 500
  and length(shirt) <= 20 and length(role) <= 100 and length(shift) <= 100 and length(since) <= 10 and length(pref2) <= 40
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
create index if not exists memberships_church_idx on public.memberships (church_id, status);
create unique index if not exists memberships_attendee_idx on public.memberships (church_id, attendee_id) where attendee_id is not null;
drop trigger if exists memberships_touch on public.memberships;
create trigger memberships_touch before update on public.memberships
  for each row execute function public.touch_updated_at();
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
    'membership', (select jsonb_build_object('church_id', m.church_id, 'role', m.role, 'status', m.status, 'full_name', m.full_name,
                     'phone', m.phone, 'area', m.area, 'birth_date', m.birth_date, 'attendee_id', m.attendee_id, 'followup', m.followup,
                     'admin_rank', case when m.role = 'admin' and m.status = 'approved'
                                   then (select count(*) + 1 from public.memberships o
                                         where o.church_id = m.church_id and o.role = 'admin' and o.status = 'approved'
                                           and (o.created_at, o.user_id) < (m.created_at, m.user_id))
                                   else 0 end)
                   from public.memberships m where m.user_id = u.id),
    'church', (select jsonb_build_object('id', c.id, 'name', c.name, 'city', c.city, 'phone', c.phone, 'email', c.email, 'status', c.status)
               from public.memberships m join public.churches c on c.id = m.church_id where m.user_id = u.id))
  from auth.users u where u.id = (select auth.uid());
$$;

-- active churches a person can join (name and town only)
create or replace function public.church_directory(p_search text default '')
returns table (id uuid, name text, city text)
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
    select c.id, c.name, c.city from public.churches c
    where c.status = 'active' and (v_q = '' or position(v_q in lower(c.name || ' ' || c.city)) > 0)
    order by lower(c.name), c.id
    limit 50;
end;
$$;

create or replace function public.join_church(p_church uuid, p_full_name text default '', p_phone text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.memberships m where m.user_id = v_uid) then
    raise exception 'You already belong to a church. Leave it first.';
  end if;
  if not exists (select 1 from public.churches c where c.id = p_church and c.status = 'active') then
    raise exception 'That church is not taking members at the moment.';
  end if;
  insert into public.memberships (user_id, church_id, role, status, full_name, phone)
  select v_uid, p_church, 'member', 'pending',
         left(coalesce(nullif(btrim(p_full_name), ''), u.raw_user_meta_data ->> 'full_name', ''), 200), left(btrim(coalesce(p_phone, '')), 40)
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
  if v_m.role = 'admin' and v_m.status = 'approved' and not exists (select 1 from public.memberships o
     where o.church_id = v_m.church_id and o.user_id <> v_m.user_id and o.role = 'admin' and o.status = 'approved') then
    raise exception 'You are this church''s only admin. Make someone else an admin first.';
  end if;
  delete from public.memberships m where m.user_id = v_m.user_id;
end;
$$;

-- delete the caller's own login. Their membership, platform-admin and old staff rows go with it (on delete cascade);
-- the church's visitors, volunteers and queue stay with the church. Refused for a church's only admin and for the only
-- platform admin, so a church or the platform is never left with nobody in charge.
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
  select * into v_m from public.memberships m where m.user_id = v_uid;
  if found and v_m.role = 'admin' and v_m.status = 'approved' and not exists (select 1 from public.memberships o
     where o.church_id = v_m.church_id and o.user_id <> v_m.user_id and o.role = 'admin' and o.status = 'approved') then
    raise exception 'You are this church''s only admin. Make someone else an admin first.';
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

create or replace function public.church_members(p_church uuid)
returns table (user_id uuid, email text, full_name text, phone text, area text, birth_date date, role text, status text,
               attendee_id text, confirmed boolean, created_at timestamptz)
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
           u.email_confirmed_at is not null, m.created_at
    from public.memberships m join auth.users u on u.id = m.user_id
    where m.church_id = p_church
    order by (m.status = 'pending') desc, lower(m.full_name), m.created_at
    limit 1000;
end;
$$;

-- change a member's role or approval. A church always keeps at least one approved admin, and fills only its two posts:
-- the Health Department Leader and their Assistant.
create or replace function public.set_member(p_user uuid, p_role text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_m public.memberships;
begin
  select * into v_m from public.memberships m where m.user_id = p_user;
  if not found or not public.church_admin_of(v_m.church_id) then raise exception 'church admins only' using errcode = '42501'; end if;
  -- hold the church row so two admins changing roles at the same moment cannot both pass the one/two-admin checks
  perform 1 from public.churches c where c.id = v_m.church_id for update;
  if p_role not in ('member', 'staff', 'admin') or p_status not in ('pending', 'approved') then raise exception 'Unknown role or status.'; end if;
  if p_status = 'approved' and not exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null) then
    raise exception 'This person has not confirmed their email yet.';
  end if;
  if v_m.role = 'admin' and v_m.status = 'approved' and (p_role <> 'admin' or p_status <> 'approved')
     and not exists (select 1 from public.memberships o where o.church_id = v_m.church_id and o.user_id <> p_user
                     and o.role = 'admin' and o.status = 'approved') then
    raise exception 'A church needs at least one admin. Make someone else an admin first.';
  end if;
  -- the church's two admin posts (Health Department Leader, then their Assistant) are both filled:
  -- a third promotion (or approval) is refused until one steps down
  if p_role = 'admin' and p_status = 'approved' and not (v_m.role = 'admin' and v_m.status = 'approved')
     and (select count(*) from public.memberships o where o.church_id = v_m.church_id and o.user_id <> p_user
          and o.role = 'admin' and o.status = 'approved') >= 2 then
    raise exception 'A church has two admin posts: the Health Department Leader and their Assistant. Both are filled — one must step down first.';
  end if;
  update public.memberships m set role = p_role, status = p_status where m.user_id = p_user;
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
  -- hold the church row so a remove racing a promotion cannot drop a church's last admin
  perform 1 from public.churches c where c.id = v_m.church_id for update;
  if v_m.role = 'admin' and v_m.status = 'approved' and not exists (select 1 from public.memberships o
     where o.church_id = v_m.church_id and o.user_id <> p_user and o.role = 'admin' and o.status = 'approved') then
    raise exception 'A church needs at least one admin. Make someone else an admin first.';
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
    'join_church(uuid, text, text)', 'register_church(text, text, text, text)', 'update_my_details(text, text, text, date)',
    'leave_church()', 'delete_my_account()', 'my_health()', 'update_church(uuid, text, text, text, text)', 'church_members(uuid)',
    'set_member(uuid, text, text)', 'link_member(uuid, text)', 'remove_member(uuid)', 'admin_churches()',
    'admin_set_church_status(uuid, text)', 'admin_audit(integer)', 'admin_church_data(uuid)',
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

-- ================================================================ RETENTION (POPIA s14)
-- A visitor's record is kept for 2 years after their last visit (the last time it was updated), then deleted. The
-- app's privacy notice says the same (RETENTION_YEARS in index.html): change both together.
-- Deleting a visitor normally leaves a full copy in audit_log so an admin's mistake can be undone. Those copies are
-- emptied after 90 days, and a record removed here leaves no copy at all. Queue entries hold only badge numbers and
-- times, and are kept 30 days. Audit lines themselves (who did what, no health data) are kept 2 years.
create or replace function public.purge_expired_visitors()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  -- the weekly job runs with no signed-in user; a signed-in caller must be the platform admin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'platform admin only' using errcode = '42501';
  end if;
  with gone as (
    delete from public.attendees where updated_at < now() - interval '2 years' returning id
  )
  select count(*) into n from gone;
  update public.audit_log set old = null
   where tbl = 'attendees' and op = 'DELETE' and old is not null
     and (at < now() - interval '90 days' or (old ->> 'updated_at')::timestamptz < now() - interval '2 years');
  delete from public.audit_log where at < now() - interval '2 years';
  delete from public.queue_entries where joined_at < now() - interval '30 days';
  return n;
end;
$$;
revoke all on function public.purge_expired_visitors() from public, anon;
grant execute on function public.purge_expired_visitors() to authenticated;

-- run it every Sunday at 03:00 when the pg_cron extension is on (Database → Extensions → pg_cron); without it, a
-- platform admin runs  select public.purge_expired_visitors();  here once a month
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-visitors';
    perform cron.schedule('purge-expired-visitors', '0 3 * * 0', 'select public.purge_expired_visitors()');
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
