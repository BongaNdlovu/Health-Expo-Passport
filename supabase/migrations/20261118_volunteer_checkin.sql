-- 2026-11-18 · G-2 (BUG-AUDIT-2026-11-10): volunteer check-in on the day.
-- Paste into the Supabase SQL editor once. Safe to run again. schema.sql already holds the same lines.

-- G-2: volunteer check-in on the day. status = 'checkedin' is the one record of it; checked_in (read by older apps)
-- always follows status. Checking in, and undoing it, go through check_in_volunteer (an admin, or the team leader of
-- the volunteer's station); a direct write that moves a row into or out of 'checkedin' is refused, except a
-- deregistration (back to 'prospect'), which has its own rules. The refusal uses the placement hint, so a desk whose
-- copy is out of date takes the server's row and tries again (resolvePlacement in account.js).
create or replace function public.volunteers_checkin_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.checked_in := new.status = 'checkedin';
  if (select auth.uid()) is null then return new; end if;
  if coalesce(current_setting('newstart.checkin_ok', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    -- an upsert of an existing row is judged by the update branch, against its real old values
    if exists (select 1 from public.volunteers v where v.church_id = new.church_id and v.id = new.id) then return new; end if;
    if new.status = 'checkedin' then
      raise exception 'Only an admin or the station''s team leader checks volunteers in' using errcode = '42501', hint = 'place_guard';
    end if;
    return new;
  end if;
  if (new.status = 'checkedin') <> (old.status = 'checkedin') and new.status <> 'prospect' then
    raise exception 'Only an admin or the station''s team leader checks volunteers in' using errcode = '42501', hint = 'place_guard';
  end if;
  return new;
end;
$$;
revoke all on function public.volunteers_checkin_sync() from public, anon, authenticated;
drop trigger if exists volunteers_checkin_sync on public.volunteers;
create trigger volunteers_checkin_sync before insert or update on public.volunteers
  for each row execute function public.volunteers_checkin_sync();
update public.volunteers set checked_in = (status = 'checkedin') where checked_in is distinct from (status = 'checkedin');

create or replace function public.check_in_volunteer(p_vol text, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.volunteers;
begin
  select * into v_row from public.volunteers where id = p_vol and church_id = public.hub_church() for update;
  if not found then
    raise exception 'That volunteer is not on your church''s team' using errcode = '42501';
  end if;
  if not (public.is_admin() or public.can_place(v_row.booth, v_row.booth)) then
    raise exception 'Only an admin or the station''s team leader checks volunteers in' using errcode = '42501';
  end if;
  if p_on and (v_row.booth is null or v_row.status not in ('registered', 'checkedin')) then
    raise exception 'Only a registered volunteer with a station can be checked in' using errcode = '23514';
  end if;
  if p_on = (v_row.status = 'checkedin') then return false; end if;   -- already so: nothing to change
  perform set_config('newstart.checkin_ok', 'on', true);
  update public.volunteers set status = case when p_on then 'checkedin' else 'registered' end
   where id = v_row.id and church_id = v_row.church_id;
  perform set_config('newstart.checkin_ok', '', true);
  return true;
end;
$$;
revoke all on function public.check_in_volunteer(text, boolean) from public, anon;
grant execute on function public.check_in_volunteer(text, boolean) to authenticated;

-- an undone check-in (checkedin -> registered) does not tell the admins about a "new" registration
create or replace function public.volunteers_admin_status_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by_admin boolean := public.is_platform_admin() or exists (
    select 1 from public.memberships m join public.churches c on c.id = m.church_id
    where m.user_id = (select auth.uid()) and m.church_id = new.church_id
      and m.status = 'approved' and m.role = 'admin' and c.status <> 'suspended');
  v_body text;
begin
  if new.status is not distinct from old.status then return null; end if;
  if new.status = 'registered' and old.status is distinct from 'checkedin' then   -- an undone check-in is not a new registration (G-2)
    if exists (select 1 from public.notifications n
               where n.church_id = new.church_id and n.kind = 'register'
                 and n.title = left('Registered: ' || new.name, 120)
                 and n.created_at > now() - interval '1 hour') then return null; end if;
    insert into public.notifications (church_id, user_id, kind, title, body)
    select new.church_id, m.user_id, 'register', left('Registered: ' || new.name, 120),
           case when new.booth is null then 'They are registered for the expo.'
                else 'They are registered at ' || public.booth_title(new.booth) || '.' end
    from public.memberships m
    where m.church_id = new.church_id and m.role = 'admin' and m.status = 'approved';
  elsif new.status = 'prospect' and old.status in ('registered', 'checkedin') then
    v_body := case
      when coalesce(current_setting('newstart.self_release', true), '') = 'on'
        then 'They gave up their place at the expo. Their pledge still stands.'
      when v_by_admin
        then 'An admin took them off the expo. Their pledge still stands.'
      else 'A team leader took them off their station. Their pledge still stands.'
    end;
    if exists (select 1 from public.notifications n
               where n.church_id = new.church_id and n.kind = 'deregister'
                 and n.title = left('Deregistered: ' || new.name, 120) and n.body = v_body
                 and n.created_at > now() - interval '1 hour') then return null; end if;
    insert into public.notifications (church_id, user_id, kind, title, body)
    select new.church_id, m.user_id, 'deregister', left('Deregistered: ' || new.name, 120), v_body
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

insert into public.schema_migrations (version) values ('20261118_volunteer_checkin') on conflict do nothing;
