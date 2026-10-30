# Threat model — Health Expo Passport (NEWSTART)

Written for the final security pass of 2026-10-30 (see `docs/security-pass-2026-10-30.md`).
Re-run this document, at minimum, when: a new data category is stored, a new third party is added,
the app gains multi-tenancy changes (churches), money starts moving, or the first external
security questionnaire arrives.

## 1. Data flow

**Actors** — anonymous visitor (no account); signed-in account (member, awaiting approval); approved
church staff (works the expo desks); church admin (two posts per church: Health Department Leader,
Assistant); platform admin (the app owner, one row in `platform_admins`, added only in SQL).

**Components** — browser / installed PWA / Capacitor Android WebView (one bundled page); Cloudflare
static host (`dist/`, no server code); Supabase (Auth + Postgres + Realtime); Supabase's email
sender or the configured SMTP provider (confirmation + reset emails only).

**Data stores** —
- `attendees`: **PII + special personal information** (name, contacts, health readings, prayer
  request, consent record). Readings cleared 7 days after the visit; record deleted at 2 years.
- `volunteers`: PII (name, contacts, emergency contact, availability). Roster lifetime — removed on
  request (pledge screens say so).
- `queue_entries`: badge numbers + times only, 30 days.
- `audit_log`: who changed/deleted what (full old row for deletes, emptied once the visit ages out).
- `churches` / `memberships`: account and church administration.
- Device (`localStorage`): the signed-in desk's offline copy of visitors + volunteers (health data
  included), the sync ledger, the Supabase session tokens. Cleared on explicit sign-out.

**Arrows** — page → static host (HTTPS); page → Supabase REST/Realtime (publishable key + user
JWT; RLS decides everything); auth emails → staff (confirm/reset); APK → phone (same host,
`Content-Disposition: attachment`, same-origin-checked by `src/update.js`).

## 2. Trust boundaries (every arrow below needs its check on the far side)

1. **Browser → Supabase** — everything here is hostile. The database, not the page, decides: RLS
   per church, `SECURITY DEFINER` functions that re-check the caller, CHECK constraints on size and
   shape. The page's own checks are conveniences only (the code says so where it matters).
2. **Desk → desk** — Realtime events are RLS-filtered for inserts/updates but **not for deletes**;
   the client ignores delete events that do not name its own church and lets the next full pull
   correct it.
3. **Phone clock → retention decisions** — a phone's clock is untrusted; age-of-visit is judged on
   the database clock (`my_account().server_now`), and the database trigger re-clears anything a
   stale phone writes.
4. **Hosted page → Android WebView** — the packaged page carries the same CSP; the APK updater
   only ever opens a file from the app's own origin.

## 3. Named threats (attack → impact)

1. **Cross-church data theft** — an approved staff account changes `church_id`/badge id in a
   request and reads another church's visitors. → RLS policies scope every table to
   `staff_church()`; `test-security.sql` asserts it. Impact if it failed: POPIA-reportable breach
   of special personal information.
2. **Unapproved account reaches data** — a signed-up but unapproved account (or a suspended
   church's staff) calls the API directly. → No policy allows it; the app deletes the saved copy
   and gates the screen (`cloudSync`); the gate cannot be waved past with *Back to the app*.
3. **Shared-desk handover** — the next person at a shared tablet continues in the previous
   operator's copy. → A session that ends while the desk is open puts the sign-in gate back up with
   no *Back* escape; explicit sign-out wipes the device. Residual (accepted): a desk that boots
   with a saved copy and a still-valid session opens straight in — that is the offline-resilience
   tradeoff below.
4. **Invite-link misuse** — a shared too widely `?join=` code grants approved membership (possibly
   staff). → Codes are 128-bit random, expire in 30 days, and admins can cancel all of a church's
   invites; a stale code on a device is cleared at sign-out.
5. **Retention failure** — health readings live longer than the notice says. → Enforced in the
   database (trigger + daily purge via pg_cron) and on the device; the phone cannot move a visit's
   date or resurrect a purged visitor (`test-security.sql` asserts both).

## 4. Impact ceiling

- **Worst single-record leak:** one visitor's health screening (readings + prayer note) tied to
  name and phone. Special personal information under POPIA s26–27 — disclosure to the Information
  Regulator and the data subject would be required.
- **Who would care:** the visitor, the church, the Information Regulator (POPIA), the app owner's
  church denomination.
- **Disclosure obligation:** POPIA s22 — notify the Regulator and affected people as soon as
  reasonably possible. The runbooks in `docs/runbooks/` carry the first steps; the Regulator's
  contact route and the signed-off notice templates are the app owner's to fill in.

## 5. Accepted risks (each needs an owner — fill in the name)

| Risk | Why accepted | Owner |
| :--- | :--- | :--- |
| Readings are stored beside identity (no 9.2-style split) | The screening workflow needs both on one screen; staff-only RLS, 7-day retention and an audit log are the compensating controls. | ____________ |
| Session tokens in `localStorage` (supabase-js default) | Standard for this stack; the strict CSP (hash-pinned scripts, one version-pinned CDN path, no inline handlers) is the mitigation; there is no third-party script. | ____________ |
| A desk that boots with a saved copy and a valid session opens straight in | Deliberate: a flat battery or dropped connection at the expo must never lock a desk out of its own data. The server stays protected by RLS regardless of the device. | ____________ |
| Volunteer roster contact details have no automatic expiry | Rosters are ongoing; the pledge screens say how removal works. Revisit if rosters outlive their use. | ____________ |
