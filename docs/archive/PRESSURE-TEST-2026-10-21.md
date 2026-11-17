# Pressure test: security, performance, memory (21 Oct 2026)

Every number below was printed by a tool during the test. What could not be checked says so.
Test beds:
- copies of the project
- PGlite 0.5.11, a real Postgres running in memory
- the harness's stand-in database client
- the Chromium browser pane in the Claude desktop app
- your **live** Supabase project, anonymous and read-only (approved by you)

## Summary
| # | Area | Finding | Severity | Status |
|---|---|---|---|---|
| S1 | Secrets | Android keystore passwords stored in plain text in `android/signing/KEYSTORE-INFO.txt` | Medium | **Fixed**: file deleted; passwords are in Windows Credential Manager |
| S2 | Database | Old `public.staff` list could be `SELECT`ed by any signed-in account through the API (RLS returned 0 rows) | Low | **Fixed**: access revoked |
| S3 | Live updates | Supabase does not filter *delete* events by RLS: a signed-in listener could learn church id and badge number of a deleted visitor in another church | Low | App already ignores them; documented |
| S4 | Auth | Server-side password minimum is not visible from outside | Not verified | **Your action**: set to 8 in the dashboard |
| S5 | Page | CSP allows `'unsafe-inline'` scripts (needed by inline handlers) | Info | Mitigated: injection fuzz found 0 holes |
| P1 | Storage | At 10,000 visitors a phone keeps about 4.1 MB of text | Info | Within this browser's limit (≥ 20 MB); phones not measured |
| — | Injection, privilege escalation, church isolation, anonymous access, speed to 10k, memory leaks | No defect found | — | Permanent tests added |

## Security
**Secrets scan.** No service-role or secret keys anywhere in the project. `dist/` holds no secrets. The only key in the page
is the publishable key, which is public by design. **S1:** the keystore store and key passwords were in `android/signing/KEYSTORE-INFO.txt`. That file is deleted. The
passwords are Windows credentials `NEWSTART-Expo/keystore-store` and `NEWSTART-Expo/keystore-key`, which `tools/sign-apk.ps1`
reads. The key file `newstart.jks` is still in `android/signing/` and is gitignored.

**Injection (XSS).** Every database text field got the payload `"><img src=x onerror=…>'<svg onload=…>`:
- visitors: name, phone, prayer
- volunteers: name, phone, email, notes, emergency contact, role, shift, shirt, history
- churches: name, town, phone, email
- members: name, email, phone, area
- the audit trail and the status messages

Then every screen was drawn: all visitor tabs, the 4 volunteer tabs, the switchers, WhatsApp, the print card, the
scanner, the 3 account tabs, 5 account screens, the cloud panel, the Home pill and the account banner.

Result: **0 screens showed the payload as markup.** The probe proved itself on a copy where one name was left unescaped:
it reported exactly that screen. The static sweep found no event handler that puts escaped text inside a JS string. Every
ID in a handler is either `qSafe`-filtered or format-checked by the database (`EXPO-nnn`, `VOL-nnn`, UUID).

**Database attacks (PGlite).** 30 of 30 attacks were refused:
- a member making themselves admin, or linking themselves to someone's results
- staff listing, approving or promoting members, or deleting visitors
- a church admin touching another church's admin, name, members or visitors
- anyone making themselves platform admin
- 100,000-character input

Catalogue audit:
- every SECURITY DEFINER function pins `search_path`
- RLS is on for every table
- anonymous callers reach no table and no privileged function

**S2** came from the audit: `public.staff` had no policies but kept its default `SELECT` grant for signed-in users.

**Live project (anonymous, read-only).** All 8 tables (`attendees`, `volunteers`, `queue_entries`, `staff`,
`audit_log`, `churches`, `memberships`, `platform_admins`) and all 9 functions probed answered
`HTTP 401 permission denied (42501)`. No rows came back. Public auth settings: sign-up open, email confirmation
required (`mailer_autoconfirm: false`). The churches part of the schema is already installed on live.

**Headers** (`dist/_headers`): the CSP limits script sources, data destinations (`connect-src` to self and Supabase only)
and framing (`frame-ancestors 'none'`), plus `nosniff`, `X-Frame-Options: DENY`, HSTS and a Permissions-Policy. **S5:**
`'unsafe-inline'` scripts remain because the page uses inline handlers, so escaping is the line of defence; it held
(above).

## Performance (Chromium, stand-in database, timings in ms)
| Visitors / volunteers | Full download | Routine poll | Change detection | Save after an edit | Slowest screen | Saved copy | Sync ledger | JS heap |
|---|---|---|---|---|---|---|---|---|
| 1,000 / 300 | 39 | 18.1 | 5.4 | 2.8 | 46.2 (first draw of Volunteers) | 387 KB | 32 KB | 4.7 MB |
| 3,000 / 900 | 116.1 | 58.9 | 16.1 | 9.9 | 14.9 (Queue) | 1,164 KB | 97 KB | 11.5 MB |
| 10,000 / 3,000 | 263.1 | 177.3 | 59.1 | 31.4 | 15.9 (Queue) | 3,887 KB | 323 KB | 27 MB |

Screens stay fast because lists are capped. Home, Care and Queue all draw in at most 16 ms at 10,000 visitors.
No storage warning fired. **P1:** this browser accepted at least 20 MB of saved data (the search stopped at its 20 MB
cap). Phone browsers may allow less; the README assumes about 5 MB, which is not measured here. At expo size (1,000–3,000
visitors) the saved copy is 0.4–1.2 MB.

## Memory
**Browser, about 1,600 actions:**
- 400 screen changes
- 100 opens of the panel and switcher
- 1,000 status updates
- 50 live reconnects
- 20 full re-syncs of 3,000 rows
- 10 sign-out/sign-in cycles

Results:
- **Waiting timers:** 0 throughout.
- **Event listeners added (net):** 0.
- **Live connections open:** exactly 2 throughout.
- **Rows kept:** stayed at 3,000.
- **Heap:** rose and fell with garbage collection (6.5–24.2 MB) and ended at 9.5 MB, below the 13.4 MB baseline.

**Node with forced garbage collection, 80 use cycles on 2,000 visitors:** heap 12.77 → 12.47 MB, with a peak of 13.17 MB
at cycle 40. Live handlers stayed at 2. **No leak.**

Code review agrees:
- every listener is registered once at start-up
- the scanner's interval is cleared
- the camera stream is stopped on close

## What was changed
1. `supabase/schema.sql`: `revoke all on public.staff from anon, authenticated;` (S2). Run `schema.sql` again on Supabase to
   apply it.
2. `.smoke/harness.js`, new section 18e (14 checks):
   - the injection fuzz of every screen
   - "50 live reconnects leave exactly one connection"
   - the database attacks and catalogue audits (with `NEWSTART_PGLITE`)
3. `supabase/README.md`: S1, S3 and S4 under "Hardening".

Full suite after the change, on a copy: **602 of 602 checks pass.** Whether each new check can fail is in the next section.

## Proof the new checks can fail
Each behaviour was broken in its own copy, and the matching checks FAILED every time. **6 of 6 caught:**

| Mutation | What was broken | Result |
|---|---|---|
| MX1 | a member's name on the Church screen not escaped | CAUGHT |
| MX2 | stopping the live connection no longer removes it | CAUGHT |
| MX3 | the old staff list stays open to signed-in callers | CAUGHT |
| MX4 | any church admin may manage any church | CAUGHT |
| MX5 | `set_member` no longer checks who is asking | CAUGHT |
| MX6 | `platform_admins` keeps the default grants | CAUGHT |

## Not checked
- The server-side password minimum (S4).
- Realtime behaviour on the live project (S3 comes from Supabase's documentation).
- Phone storage limits and timings on real phones.
- Anything that needs signing in to the live project. Probes were anonymous only, as agreed.
