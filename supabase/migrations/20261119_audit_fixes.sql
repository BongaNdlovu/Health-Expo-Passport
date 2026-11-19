-- 2026-11-19 · G-4, G-5, G-6, G-7, G-8 (BUG-AUDIT-2026-11-19).
-- Paste into the Supabase SQL editor once. Safe to run again. schema.sql already holds the same lines.

-- G-8: record church status changes in audit_log (matching admin_set_paid_until)
create or replace function public.admin_set_church_status(p_church uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'platform admin only' using errcode = '42501'; end if;
  if p_status not in ('pending', 'active', 'suspended') then raise exception 'Unknown status.'; end if;
  update public.churches c set status = p_status,
    paid_until = case when p_status = 'active' and c.paid_until is null then current_date + interval '1 year' else c.paid_until end
  where c.id = p_church;
  if not found then raise exception 'No such church.'; end if;
  insert into public.audit_log (tbl, op, row_id, church_id) values ('churches', 'STATUS', p_status, p_church);
end;
$$;

-- G-4: close the unauthenticated status='prospect' bypass in volunteers_checkin_sync.
-- All three legitimate deregistration/release RPCs set newstart.checkin_ok; direct writes can no longer erase
-- check-ins (any role) or deregister a registered volunteer without admin or station-leader rights.
create or replace function public.volunteers_checkin_sync()
returns trigger
language plpgsql
security definer
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
  if (new.status = 'checkedin') <> (old.status = 'checkedin') then
    raise exception 'Only an admin or the station''s team leader checks volunteers in' using errcode = '42501', hint = 'place_guard';
  end if;
  if old.status = 'registered' and new.status = 'prospect' then
    if not (public.is_admin() or public.can_place(old.booth, null)) then
      raise exception 'Only the church''s admins and the station''s team leader may deregister volunteers' using errcode = '42501', hint = 'place_guard';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.volunteers_checkin_sync() from public, anon, authenticated;

create or replace function public.deregister_my_pledge()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_m public.memberships; v_row public.volunteers;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into v_m from public.memberships m where m.user_id = v_uid;
  if v_m.user_id is null or v_m.volunteer_id is null then
    raise exception 'You have no pledge on the team list.';
  end if;
  perform pg_advisory_xact_lock(hashtext('vol:' || v_m.church_id::text));
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
  perform set_config('newstart.checkin_ok', 'on', true);
  update public.volunteers v set
    status = 'prospect', booth = null, shift = '', registered_on = null,
    lead = false, checked_in = false,
    role = case when v.lead then '' else v.role end,
    updated_at = now()
  where v.church_id = v_m.church_id and v.id = v_m.volunteer_id;
  perform set_config('newstart.checkin_ok', '', true);
end;
$$;
revoke all on function public.deregister_my_pledge() from public, anon;
grant execute on function public.deregister_my_pledge() to authenticated;

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
  perform set_config('newstart.checkin_ok', 'on', true);
  update public.volunteers v set
    booth = null, status = 'prospect', lead = false, checked_in = false,
    role = case when v.lead then '' else v.role end, updated_at = now()
  where v.church_id = v_church and v.id = p_vol
  returning * into v_row;
  perform set_config('newstart.checkin_ok', '', true);
  return next v_row;
end;
$$;
revoke all on function public.release_volunteer(text) from public, anon;
grant execute on function public.release_volunteer(text) to authenticated;

create or replace function public.admin_deregister(p_vol text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_church uuid := public.hub_church(); v_row public.volunteers;
begin
  if v_church is null or not public.church_admin_of(v_church) then
    raise exception 'Only the church''s admins can do that.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('vol:' || v_church::text));
  select * into v_row from public.volunteers v where v.church_id = v_church and v.id = p_vol for update;
  if not found then raise exception 'No such volunteer in your church.'; end if;
  if v_row.status = 'prospect' then raise exception 'They are not registered for the expo — remove the pledge instead.'; end if;
  perform set_config('newstart.lead_ok', 'on', true);
  perform set_config('newstart.checkin_ok', 'on', true);
  update public.volunteers v set
    status = 'prospect', booth = null, shift = '', registered_on = null, lead = false, checked_in = false,
    role = case when v.lead then '' else v.role end, updated_at = now()
  where v.church_id = v_church and v.id = p_vol;
  perform set_config('newstart.checkin_ok', '', true);
end;
$$;
revoke all on function public.admin_deregister(text) from public, anon;
grant execute on function public.admin_deregister(text) to authenticated;

-- G-7: keep POPIA self-deletion in leave_church / delete_my_account, and clearly notify admins when a
-- checked-in or registered volunteer leaves so the station can be covered.
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
  if v_m.volunteer_id is not null then
    perform set_config('newstart.lead_ok', 'on', true);
    perform set_config('newstart.self_leave', 'on', true);
    delete from public.volunteers v where v.church_id = v_m.church_id and v.id = v_m.volunteer_id;
    perform set_config('newstart.self_leave', '', true);
  end if;
  delete from public.memberships m where m.user_id = v_m.user_id;
end;
$$;
revoke all on function public.leave_church() from public, anon;
grant execute on function public.leave_church() to authenticated;

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
  if v_m.volunteer_id is not null then
    perform set_config('newstart.lead_ok', 'on', true);
    perform set_config('newstart.self_leave', 'on', true);
    delete from public.volunteers v where v.church_id = v_m.church_id and v.id = v_m.volunteer_id;
    perform set_config('newstart.self_leave', '', true);
  end if;
  delete from auth.users u where u.id = v_uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.volunteers_admin_withdraw_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by_admin boolean := public.is_platform_admin() or exists (
    select 1 from public.memberships m join public.churches c on c.id = m.church_id
    where m.user_id = (select auth.uid()) and m.church_id = old.church_id
      and m.status = 'approved' and m.role = 'admin' and c.status <> 'suspended');
  v_self_leave boolean := coalesce(current_setting('newstart.self_leave', true), '') = 'on';
  v_title text;
  v_body  text;
begin
  if not exists (select 1 from public.churches c where c.id = old.church_id) then return null; end if;
  if v_by_admin and not v_self_leave then
    v_title := left('Removed from the roster: ' || old.name, 120);
    v_body  := 'An admin took them off the expo roster.';
  elsif v_self_leave and old.status = 'checkedin' then
    v_title := left('Checked-in volunteer left: ' || old.name, 120);
    v_body  := 'They left the church or deleted their account while checked in'
               || case when old.booth is not null then ' at ' || public.booth_title(old.booth) else '' end
               || '. Their station needs cover.';
  elsif v_self_leave and old.status = 'registered' then
    v_title := left('Registered volunteer left: ' || old.name, 120);
    v_body  := 'They left the church or deleted their account while registered'
               || case when old.booth is not null then ' at ' || public.booth_title(old.booth) else '' end || '.';
  else
    v_title := left('Pledge withdrawn: ' || old.name, 120);
    v_body  := 'They are no longer on the expo roster.';
  end if;
  if exists (select 1 from public.notifications n
             where n.church_id = old.church_id and n.kind = 'unpledge'
               and n.title = v_title
               and n.created_at > now() - interval '1 hour') then return null; end if;
  insert into public.notifications (church_id, user_id, kind, title, body)
  select old.church_id, m.user_id, 'unpledge', v_title, v_body
  from public.memberships m
  where m.church_id = old.church_id and m.role = 'admin' and m.status = 'approved';
  return null;
end;
$$;
revoke all on function public.volunteers_admin_withdraw_notify() from public, anon, authenticated;

-- G-5: join_with_invite requires a confirmed email address, matching staff_approve and set_member
create or replace function public.join_with_invite(p_code text, p_full_name text default '', p_phone text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_inv public.church_invites; v_cur public.memberships;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null) then
    raise exception 'Confirm your email address first, then open the invite link again.' using errcode = '42501';
  end if;
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
    update public.memberships m
    set status = 'approved', role = case when m.role = 'member' and v_inv.role = 'staff' then 'staff' else m.role end, updated_at = now()
    where m.user_id = v_uid;
  end if;
  update public.church_invites i set uses = i.uses + 1 where i.code = v_inv.code;
  return v_inv.church_id;
end;
$$;
revoke all on function public.join_with_invite(text, text, text) from public, anon;
grant execute on function public.join_with_invite(text, text, text) to authenticated;

-- G-6: prevent a stale desk from resurrecting a visitor deleted via remove_visitor
create table if not exists public.removed_attendees (
  church_id   uuid not null references public.churches (id) on delete cascade,
  id          text not null,
  created_at  timestamptz not null,
  removed_at  timestamptz not null default now(),
  primary key (church_id, id, created_at)
);
alter table public.removed_attendees enable row level security;
revoke all on public.removed_attendees from anon, authenticated;

create or replace function public.attendees_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_follow boolean;
begin
  if tg_op = 'INSERT'
     and exists (select 1 from public.removed_attendees r
                  where r.church_id = new.church_id and r.id = new.id
                    and abs(extract(epoch from (r.created_at - coalesce(new.created_at, now())))) < 2) then
    return null;
  end if;

  v_follow := coalesce(new.interests ->> 'optin', 'false') = 'true';
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  if not public.visit_is_old(new.created_at) and not public.consent_is_old(new.interests) then return new; end if;

  new.s := '{}'::jsonb;
  new.prayer := '';
  new.chronic_list := null;
  new.height_cm := null;
  new.interests := coalesce(new.interests, '{}'::jsonb) - 'customPlan' - 'churchPlan' - 'attended';
  if not v_follow and tg_op = 'INSERT' then return null; end if;
  return new;
end;
$$;
revoke all on function public.attendees_retention() from public, anon, authenticated;

create or replace function public.remove_visitor(p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_church uuid;
  v_is_admin boolean;
  v_lead boolean;
  v_booth text;
  v_created timestamptz;
begin
  select m.church_id, m.role = 'admin', coalesce(v.lead, false), v.booth
    into v_church, v_is_admin, v_lead, v_booth
    from public.memberships m
    join public.churches c on c.id = m.church_id and c.status = 'active'
    left join public.volunteers v on v.church_id = m.church_id and v.id = m.volunteer_id
   where m.user_id = (select auth.uid()) and m.status = 'approved'
   order by (m.role = 'admin') desc
   limit 1;
  if v_church is null or not (v_is_admin or v_lead) then
    return false;
  end if;
  delete from public.attendees a
   where a.id = p_id and a.church_id = v_church
     and ( v_is_admin
        or exists (select 1 from public.queue_entries q
                    where q.church_id = v_church and q.attendee_id = p_id
                      and q.station = v_booth and q.status in ('waiting', 'serving')))
   returning a.created_at into v_created;
  if found then
    insert into public.removed_attendees (church_id, id, created_at)
    values (v_church, p_id, v_created)
    on conflict do nothing;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.remove_visitor(text) from public, anon;
grant execute on function public.remove_visitor(text) to authenticated;

create or replace function public.purge_expired_visitors()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer := 0;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'platform admin only' using errcode = '42501';
  end if;
  update public.attendees set s = '{}'::jsonb, prayer = '', chronic_list = null, height_cm = null,
         interests = interests - 'customPlan' - 'churchPlan' - 'attended'
   where (created_at < now() - interval '7 days' or public.consent_is_old(interests))
     and (s <> '{}'::jsonb or prayer <> '' or chronic_list is not null or height_cm is not null
          or interests ?| array['customPlan', 'churchPlan', 'attended']);
  with gone as (
    delete from public.attendees a
     where (a.created_at < now() - interval '7 days' or public.consent_is_old(a.interests))
       and coalesce(a.interests ->> 'optin', 'false') <> 'true'
    returning 1
  )
  select count(*) into n from gone;
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
  update public.audit_log set old = null
   where tbl = 'volunteers' and op = 'DELETE' and old is not null and at < now() - interval '90 days';
  delete from public.audit_log where at < now() - interval '2 years';
  delete from public.queue_entries where joined_at < now() - interval '30 days';
  delete from public.removed_attendees where removed_at < now() - interval '30 days';
  delete from public.notifications where (read_at is not null and read_at < now() - interval '30 days')
     or created_at < now() - interval '90 days';
  return n;
end;
$$;
revoke all on function public.purge_expired_visitors() from public, anon;
grant execute on function public.purge_expired_visitors() to authenticated;

insert into public.schema_migrations (version) values ('20261119_audit_fixes') on conflict do nothing;
