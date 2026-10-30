# Final Security Pass — 2026-10-30

Audited against **Master Application Security Handbook & Launch Blueprint v1.1** (11-Phase Edition).
App: Health Expo Passport (NEWSTART) — static PWA + Supabase, Capacitor Android wrapper.
Risk tier per handbook: **Tier 3** (health screenings, offline field-worker PWA) — full scope applies.

Method: every claim below was checked against the cited file and line (no PASS taken from a filename
or comment). Server-side schema, client bundle, built output (`dist/`), service worker, headers,
packaging, tools and git history were all read. Nothing was modified by this pass.

---

## Summary

| Severity | Count | Findings |
| :--- | :--- | :--- |
| Critical | **0** | — |
| High | **1** | F-01 |
| Medium | **3** | F-02, F-03, F-04 |
| Low | **8** | F-05 … F-12 |
| Info / accepted-risk candidates | **4** | F-13 … F-16 |

Coverage: **PASS** on the database core (RLS, functions, triggers, retention, race-safety), secrets,
CSP/headers, supply-chain pins, packaging, and git hygiene. **FAIL** items are all client-side or
operational; **UNKNOWN** items are Supabase-dashboard settings that cannot be proven from the repo.

| Audit area (handbook) | Status | Note |
| :--- | :--- | :--- |
| 0 Threat model | **FAIL (docs)** | No `docs/threat-model.md` (F-12). Controls exist; the model is not written down. |
| 1 Secrets & env | **PASS** | Publishable key only (`src/cloud.js:24-25`); no `.env`/key material ever committed; signing keys outside git, passwords in Windows Credential Manager (`tools/sign-app.ps1:100`). |
| 2 Database & storage | **PASS** | See "Verified sound" below. `service_role` never appears client-side. |
| 3 Auth & access | **PASS, 2 findings** | Signup enumeration (F-06); stale invite after sign-out (F-02). No CSRF surface (bearer tokens, no cookies). |
| 4 APIs, input, payments, AI | **PASS / N-A** | No payments, no AI, no uploads, no server routes. Schema validation via DB CHECK constraints + client trims. CSV formula-injection defended (`src/results.js:592-594`). |
| 5 Infra, headers, cost | **PASS, 1 gap** | CSP + `_headers` strong; two open CDN hosts (F-07); no security.txt (F-12); Supabase free-tier auth rate limits relied on. |
| 6 Logic & concurrency | **PASS** | Queue uses `FOR UPDATE SKIP LOCKED` (`schema.sql:610-635`); advisory locks on numbering (`schema.sql:1289,1544`); partial unique indexes enforce one-leader/one-active-queue; state guards are triggers, not UI. No money, so no double-spend surface. |
| 7 Client & media | **FAIL (2)** | Shared-desk handover (F-01); device over-retention offline (F-03). Sign-out wipe otherwise verified; SW never caches Supabase traffic (`sw.js:98`); no EXIF/SVG surface (no uploads). |
| 8 Supply chain & CI | **PASS, 1 gap** | SRI-pinned + hash-verified Supabase lib (`src/cloud.js:29-31`, `tools/build-app.js:29-33`); no CI workflows to pin; security.txt missing (F-12). |
| 9 Privacy & POPIA | **PASS w/ decisions** | Server-side retention enforced + tested (`supabase/test-security.sql`); readings-not-separated is an accepted-risk candidate (F-14); volunteer contact retention open-ended (F-11); in-app privacy notice present (`PRIVACY_NOTICE` in `src/visitor.js`). |
| 10 Red-team tests | **PARTIAL** | 9 automated security assertions exist (`supabase/test-security.sql`); two-admin cap and device scenarios are manual. |
| 11 Detection & response | **FAIL (docs)** | No alerting, runbooks, or breach-notification draft (F-12). For this app's scale the minimum is a written runbook + the audit log that already exists. |

---

## Findings

### F-01 · HIGH (device-local) — A session that dies silently leaves the full desk browsable by the next person
**Evidence:** `src/account.js:983-989` — on `SIGNED_OUT` (expired/revoked session) the app clears
`cloud.user` but keeps `cloud.ready`; `src/cloud.js:196` — `if((cloud.ready||cloud.demo)&&!cloud.gateForce)return 'hidden';`
keeps the gate hidden. Result: on a shared desk, the previous operator's complete visitor list
(names, phones, readings, prayer notes) and volunteer roster stay fully usable with no credential,
until someone presses Sign out (which wipes, `src/account.js:1013-1034` — verified).
This is a deliberate offline-resilience tradeoff (comment at `src/cloud.js:181-185`), but nothing
distinguishes "same operator returning" from "desk handed over".

**Smallest safe fix:** at `account.js:983-984`, when the sign-out event arrives *while the app was
open* (`if(cloud.user)` branch — i.e. expiry/revocation, not a fresh boot), also set
`cloud.gateForce=true` so the sign-in gate returns at the next render. Boot-from-saved-copy (the
flat-battery case) is unaffected. Alternative: an explicit "Hand over the desk" action that calls
`cloudSignOut()`. Either way, write the chosen residual risk down (Phase 0.4).

### F-02 · MEDIUM — A stale church-invite code survives sign-out and auto-joins the next account
**Evidence:** `cloudSignOut` (`src/account.js:1013-1034`) removes `CHURCH_PLANS_KEY`, `SYNC_KEY`,
`CHURCH_KEY` — but never `INVITE_KEY`. On the next sign-in on that browser, `loadAccount`
(`src/account.js:59-65`) consumes it: `join_with_invite` approves the join immediately and can
raise the member to **staff** (`schema.sql:2099-2102`). Invite links can carry the staff role
(`src/churchPlans.js:295-296`).

**Smallest safe fix:** add `try{localStorage.removeItem(INVITE_KEY);}catch(e){}` to `cloudSignOut`
(import `INVITE_KEY` from `src/churchPlans.js`). Verify: sign out on a device that opened a
`?join=` link, sign in with another account — no auto-join toast appears.

### F-03 · MEDIUM — Readings can sit in localStorage past the 7-day rule while the desk is offline or expired
**Evidence:** the phone-side purge `applyRetention` (`src/account.js:1225-1236`) runs only inside
`cloudSync` and bails with `if(!cloud.user&&!cloud.mode)return 0;` and `if(!clockKnown())return 0;`.
A device offline past day 7, or whose session expired (see F-01), still holds readings in
`newstart.passport.v2` even though the server has purged them. On screen they are masked
(`withoutOldReadings`, `src/retention.js:46-49`), but the bytes are on disk — the privacy notice
says deleted.

**Smallest safe fix:** run the retention pass once on boot before requiring a session (drop the
`cloud.user` gate for the delete-only path; `clockKnown()` already prevents wrong-clock damage, and
`skewKnown` is set by the first successful `my_account`). Verify: set a visit's `created_at` 8 days
back, stay signed out, reload — record disappears from localStorage.

### F-04 · MEDIUM (UNKNOWN until dashboard check) — Server-side retention depends on pg_cron being enabled
**Evidence:** `schema.sql:2305-2311` schedules the daily purge only `if exists (… pg_extension where
extname = 'pg_cron')`; the comment says: without it "nothing is deleted" unless the platform admin
runs `select public.purge_expired_visitors();` by hand. The repo cannot prove the extension is on.
If it is not, all readings live forever server-side and the privacy notice is false.

**Smallest safe fix:** Supabase Dashboard → Database → Extensions → enable `pg_cron`; then run
`select public.purge_expired_visitors();` once and confirm `cron.job` shows `purge-expired-visitors`.
Add this to the launch checklist in `supabase/README.md`.

### F-05 · LOW — Volunteer `id` is never sanitized and is interpolated raw at four sinks
**Evidence:** `migrateAttendee` strips ids to `[A-Za-z0-9-]` (`src/state.js:65-67`, comment: "ids
are interpolated into data-* attributes"); `migrateVolunteer` does not (`src/state.js:73-86`).
Unescaped interpolations: `src/shell.js:50` (`${v.id}`, while the attendee branch at :59 uses
`esc(a.id)`); `src/volunteer.js:432`, `:384`, `:952` (`data-args="${v.id}"` — attribute breakout can
inject a second `data-action`); `src/volunteer.js:482` (text context). Latent:
`src/volunteer.js:1035` interpolates `p.items[].name/dose` unescaped (currently static `PROTOCOLS`
only — church/custom plans set `items:[]`).

**Exploitability today:** low — the DB constrains `volunteers.id ~ '^VOL-[0-9]+$'`
(`schema.sql:134`) and CSP blocks script execution; risk is an older/modified schema plus UI
confusion.
**Smallest safe fix:** one line in `migrateVolunteer` mirroring the attendee rule
(`o.id=String(o.id==null?'':o.id).replace(/[^A-Za-z0-9-]/g,'')`), plus `esc()` the two strings at
`volunteer.js:1035`. Verify: the volunteer switcher, place sheet and hub rows render normally.

### F-06 · LOW — Signup is an email-enumeration oracle
**Evidence:** `src/cloud.js:371` maps `user_already_exists` to "That email already has an account",
and `src/cloud.js:378` maps Supabase's deliberately obfuscated `identities:[]` response to the same
message. Forgot-password is generic (`src/cloud.js:404-405` — verified), but signup reveals
existence.

**Smallest safe fix:** show the generic "Check your email to confirm the address" note for the
duplicate cases (the verification email the flow already instructs is the safe outcome). If the
explicit message is kept as a UX choice, record it as an accepted risk — it leaks nothing but
existence.

### F-07 · LOW — CSP `script-src` allows any script from two open CDNs
**Evidence:** `index.html:7` and `dist/_headers`: `script-src 'self' … https://cdn.jsdelivr.net
https://cdnjs.cloudflare.com`. SRI protects the one script the app loads (`src/libs.js:8`), but any
injected tag pointing at an arbitrary jsDelivr/npm path passes the policy.

**Smallest safe fix:** narrow to the exact pinned path
(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4`) in both the meta and `tools/build.js`,
or drop `cdnjs.cloudflare.com` if nothing loads from it. Keep in mind `build.js:66-67` fails the
build if the meta drifts — update both.

### F-08 · LOW — An edited demo row uploads fake health data to the production church
**Evidence:** `isSeedRow`/`isDirty` (`src/cloud.js:102-111`) fence only *untouched* seed rows; a
demo visitor who was edited while practicing becomes dirty and `pushDirty`
(`src/account.js:1142-1157`) uploads it under the signed-in church.

**Smallest safe fix:** refuse uploads for the three demo id families (`EXPO-04x/08x/11x`, compare
`SEED` in `src/data.js`) when `cloud.synced` has no prior signature for them, with a one-line toast
explaining why. Low priority: requires staff practicing while signed in.

### F-09 · LOW — A local record without `created_at` never ages out on the device
**Evidence:** `visitIsOld` (`src/retention.js:24-26`) returns false when `created_at` is missing or
unparseable; `created_at` is only stamped after a first upload (`src/cloud.js:45-47`). A visitor
created offline for the expo + week keeps readings locally until one successful sync.

**Smallest safe fix:** mirror the database's fallback — when `created_at` is absent, judge by
`interests.consentOn` (compare `consent_is_old`, `schema.sql:2158-2166`).

### F-10 · LOW — Queue realtime DELETE events are not church-filtered client-side
**Evidence:** `src/queue.js:174-175` splices on any delete event; Supabase Realtime applies no RLS
to delete payloads (documented in-app at `src/account.js:1269-1272`, where attendees/volunteers
*are* church-checked). Exposure: an authenticated outsider learns that an opaque queue-entry id was
deleted. No health data.

**Smallest safe fix:** apply the same `p.old.church_id===cloud.churchId` check as
`account.js:1272`.

### F-11 · LOW — Volunteer contact PII (incl. emergency contact) has no retention horizon
**Evidence:** the retention machinery (`schema.sql:2241-2311`, `src/retention.js`) covers attendees
and queue entries; `public.volunteers` rows — name, phone, email, `emergency` — are kept
indefinitely by design ("roster"). POPIA s14 minimization asks for a documented period.

**Smallest safe fix:** document the roster period in the privacy notice (e.g. "kept while your
church keeps the roster; remove via your church admin"), or add a purge clause for volunteers
untouched for N years. A decision plus one sentence satisfies the handbook; SQL optional.

### F-12 · LOW (documentation) — Phase 0/11 artifacts and security.txt do not exist
**Evidence:** no `docs/threat-model.md`; no `docs/runbooks/`; no breach-notification draft; no
restore-drill log; no `/.well-known/security.txt` in `dist/`. The controls these documents describe
largely exist (audit log, church suspension, invites cancellation, backups via Supabase) — the
writing is what's missing, and the handbook treats an undocumented accepted risk as a finding.

**Smallest safe fix:** write a one-page threat model (the five stories from Phase 0.3 are already
evident: cross-church access, unapproved account, shared-desk handover, invite misuse, badge
renumbering); a 3 AM runbook for "key leak" and "church reports data visible"; add a static
`dist/.well-known/security.txt` with a contact.

### F-13 · INFO — Leaked-password check not verifiable from the repo
Supabase Auth's "Leaked password protection" is a dashboard toggle; the repo cannot prove it is on.
The client policy is 8+ chars with a letter and number (`src/cloud.js:203-208`).
**Action:** enable the toggle (one click) or record its absence as accepted.

### F-14 · INFO (accepted-risk candidate) — Readings are stored beside identity (handbook 9.2 separation not implemented)
`s`/`chronic_list`/`prayer` live on the same row as name/phone/email. The app's compensating
controls are real: staff-gated RLS scoped to one church, admin-only deletes with an audit log,
7-day server-side retention of readings, platform-admin view excludes readings
(`admin_church_data`, `schema.sql:1044-1063`), and the screening workflow genuinely needs the name
and the readings on one screen. **Recommendation:** record this as a written accepted risk with an
owner, per Phase 0.4, rather than re-architecting.

### F-15 · INFO (accepted-risk candidate) — Session tokens live in localStorage
supabase-js default persistence (`src/account.js:970`). XSS-to-session is the theoretical path; the
strict CSP (hash-pinned scripts, no inline handlers — verified zero) is the mitigation, and no
telemetry or third-party script exists. Standard for this stack; keep it conscious.

### F-16 · INFO — Repository hygiene
`dist/newstart.apk` (3.4 MB) is committed per release — intentional deployable artifact, causes repo
growth (consider LFS later). `newstart-passport (2).html` is a stale pre-hardening single-file copy
tracked at the root (carries the same publishable key; harmless, but it is dead code that will drift
— delete or move to docs). No `.env`, `.pem`, `.jks`, `.key` has *ever* been committed (checked full
history); signing keys are outside git and passwords come from Windows Credential Manager.

---

## Verified sound (evidence-backed highlights)

- **RLS everywhere**: `attendees`, `volunteers`, `queue_entries` (per-church policies, `schema.sql:584-607`); `staff`, `churches`, `memberships`, `church_plans`, `church_invites`, `audit_log`, `platform_admins` have RLS with **no policies** — reachable only through SECURITY DEFINER functions that check the caller. Deletes of visitors/volunteers are admin-only with a full-row audit copy (`schema.sql:336-385`).
- **Every SECURITY DEFINER function pins `search_path=''`** and re-checks authorization internally (`is_staff`, `is_admin`, `church_admin_of`, `staff_church`, all admin/invite/pledge/placement functions).
- **Retention is enforced in the database**, not just the UI: `attendees_retention` trigger clears readings and pins `created_at` on update (`schema.sql:2169-2200`), the daily purge handles deletes/derivatives (`schema.sql:2251-2294`), and `supabase/test-security.sql` asserts 9 attack scenarios inside a rolled-back transaction — including the stale-phone resurrection and the date-move bypass (both rejected).
- **Race safety**: `queue_call_next` uses `FOR UPDATE SKIP LOCKED`; pledge/volunteer numbering takes per-church advisory locks; partial unique indexes enforce one active queue entry and one leader per station; two-admin invariants hold the church row (`schema.sql:918,974,1406,1579`).
- **Placement and custom-plan guards are server-side triggers** (`volunteers_place_guard`, `attendees_custom_plan_guard`), so the client's advisory checks are backed by the database — the client itself acknowledges and handles the refusals (`src/account.js:1039,1167-1185`).
- **Headers/CSP**: hash-pinned `script-src`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; `_headers` adds nosniff, XFO DENY, HSTS, Referrer-Policy, Permissions-Policy; meta and `_headers` are kept identical by the build (`tools/build.js:66-67`). Zero inline event handlers; one hashed inline script.
- **Service worker** never stores Supabase traffic (`sw.js:98`), bypasses `.apk` and in-app webviews explicitly; the update APK path is same-origin-checked before opening (`src/update.js:117-118`).
- **Sign-out wipe** is thorough: local-scoped auth sign-out, ledger/church/plan keys removed, demo data reseeded and persisted (`src/account.js:1013-1034`) — shared desks that use Sign out are clean.
- **No secrets in the built output**: the only key in `dist/` is the publishable one; grep for `service_role|sk_live|PRIVATE` across src/dist/supabase returns nothing.
- **Auth flows**: forgot-password response is identical whether or not the address exists; approval requires confirmed email (`staff_approve`, `schema.sql:677-694`); an unapproved account's saved copy is deleted and the gate enforced (commit 27dd118, verified at `account.js:1062-1067`).
- **Packaging**: Capacitor WebView hardened (no mixed content, no webContents debugging, `allowBackup=false`, https scheme, INTERNET-only permission); vendor lib hash-checked before packaging (`tools/build-app.js:29-33`); preview server is loopback with traversal protection (`tools/serve.js:28-31`).
- **No telemetry, no crash uploads, no third-party analytics**; the only console logging is error objects (`src/account.js:1041`), never payloads.

**Not applicable:** payments/webhooks (4.3), AI/LLM guardrails (4.4), OAuth social login & redirects (3.4), file uploads/storage buckets (2.4), GraphQL, server-rendered routes/cookies (no CSRF surface — bearer tokens only).

## UNKNOWN — verify in the Supabase dashboard before launch (cannot be proven from the repo)

1. `pg_cron` enabled and the purge job scheduled (F-04) — **the highest-stakes unknown**.
2. Leaked password protection ON (F-13); email confirmation ON; Site URL + redirect allowlist set (`supabase/README.md` steps 2-3).
3. SMTP connected for real email volume (README step 4) — otherwise sign-up/reset mails stop mid-expo.
4. Platform admin row created (README step 5); 2FA on the Supabase/GitHub/Cloudflare accounts (handbook 8.4).

## The three items that most increase risk today

1. **F-04** — if `pg_cron` is not enabled, every "readings are deleted after 7 days" statement is false and health data accumulates server-side forever.
2. **F-01** — shared desks keep a full, usable copy of visitors after a silent session loss; the fix is small and the deployment (church volunteers, shared tablets) makes handover routine.
3. **F-02** — a one-line fix for invite-code inheritance across accounts on the same browser.

## Sign-off record (fill in and keep)

- Date: 2026-10-30 · Tester: ZCode security pass (handbook v1.1), reviewed file-by-file
- Tests: static audit of schema/client/build/history + review of the 9 automated assertions in `supabase/test-security.sql`. Manual Phase-10 items still to run on production: two-admin cap walkthrough, dashboard-side checklist above.
- Accepted risks needing an owner and a sentence each: F-14 (readings beside identity), F-15 (tokens in localStorage), F-06 (if the signup message is kept), F-01 (if only partially mitigated), F-11 (roster retention period).

---

## Fixes applied — 2026-10-30 (same day, after re-verification)

All code fixes were re-verified against the cited lines first, then implemented, then proven by the
full smoke harness (`npm test` — 955/955 pass, one assertion strengthened), `tsc --noEmit` clean,
and `tools/test-build.js` 17/17. Baseline on pristine `main`: 954/954 (one timing-flaky perf check).

- **F-01 (High)** — `src/account.js` `cloudAuthEvent`: a session that ends while the desk is open now drops
  `cloud.ready`, so the sign-in gate returns **and no "Back to the app" control exists to wave it away**
  (boot-from-saved-copy is untouched). The harness's old "unexpected sign-out keeps the desk working" assertion
  was replaced with the new expectation — this is a deliberate product-behavior change, recorded in the threat model.
- **F-02 (Medium)** — `cloudSignOut` now calls `clearInvite()`; a stale invite code can no longer auto-join the next account.
- **F-03 (Medium)** — the retention sweep runs once when a live session dies (`applyRetention` + `persistNow` in the SIGNED_OUT branch), so readings the server has purged do not linger in the saved copy.
- **F-05 (Low)** — `migrateVolunteer` now sanitizes `id` exactly like `migrateAttendee`; the WhatsApp shopping-list line escapes `it.name`/`it.dose`.
- **F-06 (Low)** — duplicate-email signups now land on the same "Check your email" screen as fresh ones (both the error-code path and the obfuscated-identities path); no enumeration message remains.
- **F-07 (Low)** — `script-src` now pins the one library to its exact versioned path (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4`) and drops `cdnjs.cloudflare.com`; enforced identical in the meta tag and `dist/_headers` (the build fails on drift).
- **F-08 (Low)** — implemented **differently from the report's first sketch**: an upload-time "seed id" guard is unsound, because real rows legitimately occupy the seed-id space (a church's first volunteers number VOL-1001+, as the harness's clash scenario proves). Instead, the sign-in sync now drops *dirty, never-uploaded rows carrying a seed id* **only on a device's first-ever sign-in** (no saved church key — an explicit sign-out always wipes it, and real rows created before a first sign-in are always numbered above the demo data). Re-sign-in after a lost session keeps unsynced real work.
- **F-09 (Low)** — `visitIsOld` falls back to `interests.consentOn` when `created_at` is absent, **exempting the built-in demo visitors** (their consent dates are old fixtures; without the exemption the whole practice mode renders "readings deleted" — caught by the harness).
- **F-10 (Low)** — queue realtime DELETE events are now ignored unless they name this device's church (mirrors `onRemoteChange`).
- **F-11 (Low)** — the pledge screens state the roster retention ("until you unpledge or your church's admin removes them").
- **F-12 (Low, docs)** — added `docs/threat-model.md`, `docs/runbooks/incident-runbooks.md` (RB-1…RB-4), and the build now emits `dist/.well-known/security.txt` (RFC 9116) with `Contact: mailto:admin@endoftime7.com`.
- **F-04 / F-13 (Medium/Info, dashboard)** — `supabase/README.md` gained a tickable "Before the expo — dashboard checklist" (pg_cron verification commands, leaked-password protection, SMTP, redirect URLs, platform admin + 2FA). **pg_cron is ON** (job `purge-expired-visitors` at `0 3 * * *`, verified 2026-10-30). Leaked-password protection still needs Pro plan + dashboard toggle.

**Still to do outside this repo:** enable leaked-password protection (Authentication → Sign In / Providers → Email → Prevent use of leaked passwords; Pro plan required).
