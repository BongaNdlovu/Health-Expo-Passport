-- 2026-11-17 · G-1 (BUG-AUDIT-2026-11-10): the database allows only the queue moves the app makes.
-- Paste into the Supabase SQL editor once. Safe to run again. schema.sql already holds the same lines.

create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version) values ('20261113_baseline') on conflict do nothing;   -- the live database already ran schema.sql as of 2026-11-13 (checked 2026-11-17)

-- G-1: the moves a queue entry may make, checked here as well as in the app (queue.js qMove's "from" lists), so a
-- client other than the app cannot, for example, mark someone done who was never served. Same status is not a move.
--   waiting -> serving (called) or left (walked off)
--   serving -> waiting (put back, keeps the place), done, or left
--   done    -> serving (Start again)
--   left    -> waiting or serving (Undo of "They left")
create or replace function public.queue_move_ok()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'waiting' and new.status in ('serving', 'left'))
    or (old.status = 'serving' and new.status in ('waiting', 'done', 'left'))
    or (old.status = 'done'    and new.status = 'serving')
    or (old.status = 'left'    and new.status in ('waiting', 'serving'))
  ) then
    raise exception 'A queue entry cannot move from % to %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists queue_entries_move_guard on public.queue_entries;
create trigger queue_entries_move_guard before update of status on public.queue_entries
  for each row execute function public.queue_move_ok();

insert into public.schema_migrations (version) values ('20261117_queue_move_guard') on conflict do nothing;
