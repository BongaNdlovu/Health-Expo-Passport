-- ==== PROPOSED / NOT APPLIED (v1.6.2 review copy). Never run against the live Supabase project as-is. ====
-- =====================================================================================
-- PROPOSAL ONLY (v43 item 7) - DOCS. NOT APPLIED, NOT RUN against any database (mock or live).
-- For the owner's backend reviewer. Written against the schema in sql/10_rls_policies.sql
-- (public.queue_entries keyed by church_id, RLS via private.is_staff_of(church_id)).
-- Purpose: make live mode match the v40-v43 app behaviour that today is per-device only:
--   (a) several people served at one station (capacity + place/slot numbers),
--   (b) BP-first flow is app-side only (no SQL needed),
--   (c) server-side tidy-up of FINISHED queue rows (the REC5 cap, server side). Care/health
--       records (public.attendees readings) are NOT touched here - their retention stays the
--       existing POPIA retention job (apply_retention), owner-controlled.
-- Review, test on a staging project with run_rls_tests.sh-style tests, then apply yourself.
-- =====================================================================================
begin;

-- (a1) place number for the person being served
alter table public.queue_entries add column if not exists slot smallint check (slot between 1 and 6);
alter table public.queue_entries add column if not exists called_at timestamptz;
alter table public.queue_entries add column if not exists finished_at timestamptz;

-- (a2) per-station capacity + optional place names, shared by every desk of the church
create table if not exists public.station_settings (
  church_id uuid not null default private.claim_church() references public.churches(id),
  station text not null,
  capacity smallint not null default 1 check (capacity between 1 and 6),
  slot_names text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (church_id, station));
alter table public.station_settings enable row level security;
alter table public.station_settings force row level security;
create policy ss_rw on public.station_settings for all to authenticated
  using (private.is_staff_of(church_id)) with check (private.is_staff_of(church_id));
grant select, insert, update on public.station_settings to authenticated;

-- (a3) atomic call-next that respects capacity; two desks pressing at once cannot over-fill
create or replace function public.queue_call_next_slot(p_station text, p_slot smallint default null)
returns public.queue_entries language plpgsql security invoker set search_path = '' as $$
declare c uuid; cap smallint; used smallint[]; s smallint; r public.queue_entries;
begin
  select m.church_id into c from public.memberships m where m.user_id = auth.uid() limit 1;
  if c is null or not private.is_staff_of(c) then raise exception 'not staff'; end if;
  perform 1 from public.station_settings where church_id = c and station = p_station for update;
  select coalesce((select capacity from public.station_settings where church_id = c and station = p_station), 1) into cap;
  select coalesce(array_agg(slot), '{}') into used from public.queue_entries
    where church_id = c and station = p_station and state = 'serving';
  if cardinality(used) >= cap then return null; end if;            -- full: app shows "all places busy"
  s := coalesce(p_slot, (select min(g)::smallint from generate_series(1, cap) g where not (g = any(used))));
  if s = any(used) then return null; end if;
  update public.queue_entries q set state = 'serving', slot = s, called_at = now()
    where q.id = (select id from public.queue_entries where church_id = c and station = p_station and state = 'waiting'
                  order by created_at limit 1 for update skip locked)
    returning q.* into r;
  return r;
end $$;
grant execute on function public.queue_call_next_slot(text, smallint) to authenticated;

-- (c) server-side cap of FINISHED queue rows (mirrors app REC5 default 150): keep the newest
--     150 'done' rows per church+station, delete older ones. Queue rows hold no readings.
create or replace function private.prune_queue_history(p_keep int default 150)
returns int language sql security definer set search_path = '' as $$
  with ranked as (select id, row_number() over (partition by church_id, station order by coalesce(finished_at, created_at) desc) rn
                  from public.queue_entries where state = 'done')
  delete from public.queue_entries q using ranked where q.id = ranked.id and ranked.rn > p_keep
  returning 1 $$;
revoke all on function private.prune_queue_history(int) from public, authenticated;  -- scheduled job only (pg_cron), like apply_retention

-- Realtime: add public.station_settings to the supabase_realtime publication so desks see capacity changes.
-- alter publication supabase_realtime add table public.station_settings;   -- left commented on purpose

rollback;  -- proposal file ends in ROLLBACK so an accidental run changes nothing
