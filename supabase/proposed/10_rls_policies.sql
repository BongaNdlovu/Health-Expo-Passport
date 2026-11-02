-- ==== PROPOSED / NOT APPLIED (v1.6.2 review copy). Never run against the live Supabase project as-is. ====
-- Health Expo Passport: proposed tenant-isolation + role model (Supabase / Postgres 15+).
-- Principles: (1) RLS on every table, deny by default; (2) church_id never trusted from the client: it must be a church
-- the caller is an APPROVED staff/admin of (checked from auth.uid() via memberships), and it defaults from the JWT claim
-- app_metadata.church_id when omitted; (3) role/status changes only through SECURITY DEFINER RPCs that check the caller;
-- (4) rows keyed by (church_id, id) + a random uuid, so sequential badge numbers are not a global key.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

create table public.churches (id uuid primary key default gen_random_uuid(), name text not null, status text not null default 'active' check (status in ('active','suspended')));
create table public.memberships (
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','staff','admin')),
  status text not null default 'pending' check (status in ('pending','approved')),
  primary key (church_id, user_id));
create table public.platform_admins (user_id uuid primary key references auth.users(id));

-- helpers (SECURITY DEFINER so policies can read memberships without recursion; fixed search_path)
create function private.is_staff_of(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m join public.churches ch on ch.id = m.church_id
                 where m.church_id = c and m.user_id = auth.uid() and m.status = 'approved'
                   and m.role in ('staff','admin') and ch.status = 'active') $$;
create function private.is_admin_of(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.church_id = c and m.user_id = auth.uid()
                 and m.status = 'approved' and m.role = 'admin') $$;
create function private.claim_church() returns uuid language sql stable as $$
  select nullif(auth.jwt()->'app_metadata'->>'church_id','')::uuid $$;
grant usage on schema private to authenticated;
grant execute on function private.is_staff_of(uuid), private.is_admin_of(uuid), private.claim_church() to authenticated;

create table public.attendees (
  church_id uuid not null default private.claim_church() references public.churches(id),
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),          -- also blocks F-03 markup in IDs server-side
  row_id uuid not null default gen_random_uuid() unique,             -- non-guessable reference for links/exports
  name text, age int, sex text, phone text, email text, height_cm numeric, s jsonb default '{}', interests jsonb default '{}',
  prayer text default '', done boolean default false, chronic_list text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (church_id, id));
create table public.volunteers (
  church_id uuid not null default private.claim_church() references public.churches(id),
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  row_id uuid not null default gen_random_uuid() unique,
  name text, phone text, email text, status text, notes text, emergency text, role text, history jsonb default '[]',
  updated_at timestamptz not null default now(),
  primary key (church_id, id));
create table public.queue_entries (
  church_id uuid not null default private.claim_church() references public.churches(id),
  id uuid primary key default gen_random_uuid(), attendee_id text not null, station text not null, state text not null default 'waiting',
  created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  body text not null, read boolean default false, created_at timestamptz default now());

alter table public.churches enable row level security;  alter table public.churches force row level security;
alter table public.memberships enable row level security; alter table public.memberships force row level security;
alter table public.platform_admins enable row level security;
alter table public.attendees enable row level security;   alter table public.attendees force row level security;
alter table public.volunteers enable row level security;  alter table public.volunteers force row level security;
alter table public.queue_entries enable row level security; alter table public.queue_entries force row level security;
alter table public.notifications enable row level security; alter table public.notifications force row level security;

-- anon gets nothing at all
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.attendees, public.volunteers, public.queue_entries to authenticated;
grant select on public.churches, public.memberships to authenticated;          -- NO insert/update on memberships
grant select, update (read) on public.notifications to authenticated;

create policy church_read on public.churches for select to authenticated
  using (exists (select 1 from public.memberships m where m.church_id = id and m.user_id = auth.uid()));
create policy own_membership on public.memberships for select to authenticated
  using (user_id = auth.uid() or private.is_admin_of(church_id));

-- tenant tables: identical USING and WITH CHECK, so a row can neither be read nor moved/written into another church
create policy att_rw on public.attendees for all to authenticated
  using (private.is_staff_of(church_id)) with check (private.is_staff_of(church_id));
create policy vol_rw on public.volunteers for all to authenticated
  using (private.is_staff_of(church_id)) with check (private.is_staff_of(church_id));
create policy q_rw on public.queue_entries for all to authenticated
  using (private.is_staff_of(church_id)) with check (private.is_staff_of(church_id));
create policy notif_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_own_upd on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- role changes only via RPC, caller must be approved admin of that church; nobody can approve themselves
create function public.staff_approve(p_church uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin_of(p_church) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'cannot change own role' using errcode = '42501'; end if;
  if p_role not in ('member','staff','admin') then raise exception 'bad role'; end if;
  update public.memberships set role = p_role, status = 'approved' where church_id = p_church and user_id = p_user;
end $$;
revoke all on function public.staff_approve(uuid, uuid, text) from public, anon;
grant execute on function public.staff_approve(uuid, uuid, text) to authenticated;

-- invite: random 128-bit code, single use, expiring; joining always lands as pending member
create table private.invites (code text primary key default encode(gen_random_bytes(16),'hex'), church_id uuid not null references public.churches(id),
  expires_at timestamptz not null default now() + interval '7 days', used_by uuid);
create function public.join_with_invite(p_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  update private.invites set used_by = auth.uid() where code = p_code and used_by is null and expires_at > now() returning church_id into c;
  if c is null then raise exception 'invalid or used invite' using errcode = '42501'; end if;
  insert into public.memberships(church_id, user_id) values (c, auth.uid()) on conflict do nothing;  -- role member, status pending
  return c;
end $$;
revoke all on function public.join_with_invite(text) from public, anon;
grant execute on function public.join_with_invite(text) to authenticated;

-- server-side retention (POPIA s14): clear readings after 7 days, delete after 2 years. Schedule with pg_cron:
--   select cron.schedule('retention','15 2 * * *','select private.apply_retention()');
create function private.apply_retention() returns void language sql security definer set search_path = '' as $$
  update public.attendees set s = '{}', prayer = '', chronic_list = null, height_cm = null
   where created_at < now() - interval '7 days' and (s <> '{}' or prayer <> '' or chronic_list is not null or height_cm is not null);
  delete from public.attendees where created_at < now() - interval '2 years';
$$;
-- Functions get EXECUTE for PUBLIC by default (found by test_rls.py run 1): lock the job down.
revoke all on function private.apply_retention() from public, anon, authenticated;
