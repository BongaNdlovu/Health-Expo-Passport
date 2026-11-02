-- ==== PROPOSED / NOT APPLIED (v1.6.2 review copy). Never run against the live Supabase project as-is. ====
-- TEST HARNESS ONLY: mimics the parts of Supabase the policies rely on (roles anon/authenticated, auth.uid(), auth.jwt()).
-- Do NOT run on a real Supabase project (these objects already exist there).
do $$ begin if not exists (select 1 from pg_roles where rolname=$q$anon$q$) then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
