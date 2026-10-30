# Incident runbooks (read before you need them)

Each is a numbered checklist for a tired person at 3 AM. Fill in the blanks now — the brackets are
deliberate. Companion documents: `docs/threat-model.md`, `docs/security-pass-2026-10-30.md`.

## RB-1 — Suspected key leak (`service_role`, signing key, or any secret seen in a log, bundle or repo)

1. **Revoke first, investigate second.** Supabase dashboard → Settings → API: rotate the JWT
   secret / service key. For the Android signing key: it must never have left
   `android/signing/` + Windows Credential Manager; if it has, plan a new keystore and app
   re-release (a new signing key means every installed APK must be reinstalled by hand).
2. The app ships only the **publishable** key by design — its exposure alone is not an incident.
   `service_role` in a page, log or screenshot **is**: assume full database read.
3. In the SQL editor, check for damage: new rows in `pg_policies`, new functions in `pg_proc`,
   unexpected rows in `public.platform_admins`, and `select * from public.audit_log order by at desc limit 200`
   for actions taken in the exposed window.
4. Rotate every other secret that shared the same environment (SMTP credentials, Cloudflare API
   token).
5. Decide on notification with the threat model's impact ceiling (POPIA s22): confirmed
   unauthorised access to personal information → notify the Information Regulator and affected
   people as soon as reasonably possible. Owner: ____________
6. Write the post-mortem within a week; every finding becomes a test.

## RB-2 — Cross-church or unauthorised data access reported

1. Identify the path: which account, which endpoint/function, from the `audit_log` (`actor`, `at`,
   `tbl`, `op`).
2. Contain: suspend the church (Logo → Admin → Pause) or remove the account's membership —
   availability is cheap, disclosure is not.
3. Size the blast radius from `audit_log` and Supabase API logs before cleaning anything up;
   preserve logs.
4. Fix the policy/function in `supabase/schema.sql` and re-run it; add the case to
   `supabase/test-security.sql`.
5. Notify per RB-1 step 5. Owner: ____________

## RB-3 — Shared-desk exposure / lost or stolen device

1. Revoke the device's session: have the account change its password (invalidates sessions), or
   remove the account's membership / suspend the church as in RB-2.
2. The device's saved copy is protected only by the gate and by sign-out — assume a thief with
   DevTools can read it. If readings on the device are past the 7-day grace period they are the
   same as what the server has already purged; assess what newer data was on it.
3. If the device was signed in to a church with real visitors, treat as a POPIA security
   compromise assessment (RB-1 step 5). Owner: ____________

## RB-4 — Retention stopped working (readings older than 7 days still in the database)

1. Check pg_cron: `select * from cron.job;` (empty → enable the extension, re-run `schema.sql`)
   and `select * from cron.job_run_details order by start_time desc limit 10;`
2. Run the purge by hand: `select public.purge_expired_visitors();` — it returns the number of
   visitors deleted; then run `supabase/test-security.sql` to confirm the rules still hold.
3. If readings were over-retained beyond the notice, treat as a POPIA assessment (RB-1 step 5).
   Owner: ____________
