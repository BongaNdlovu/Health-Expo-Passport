# OWASP Cheat Sheet assessment: NEWSTART Health Expo (2026-11-13)

**Target:** this repository at `main` (`be0316b`), plus the uncommitted HE-01/HE-03 fixes made the same day.
**Baseline:** the local OWASP Cheat Sheet Series (`C:\Users\fanel\Downloads\CheatSheetSeries-master`, 137 sheets).
**Method:** read the code and config, and run the test suites. Nothing live was tested: no deployed site, no Supabase
dashboard and no real phone. Every fact below comes from a file or command in this session. Anything not checked
is marked **not checked**.

This builds on the Antigravity report (`owasp-security-assessment.md`), which was verified line by line first.
Its corrections are in section 4.

## 1. Summary

The app is in good shape for an offline-first PWA with an Android wrapper and a multi-tenant Supabase back end.
- No Critical or High findings.
- The two Medium privacy findings from the earlier report (HE-01, HE-03) are **fixed in the working tree, with tests,
  but not committed or deployed yet**.
- This pass adds one Medium finding (no MFA for privileged accounts) and two Low ones (no idle lock on shared desks,
  no bot protection on the auth forms).

| ID | Severity | Finding | Cheat sheets | Status |
| :-- | :-- | :-- | :-- | :-- |
| HE-01 | Medium | Kept records (`QUAR_KEY`) survived sign-out and the 7-day rule | User Privacy Protection, Session Management | Fixed locally, not deployed |
| HE-03 | Medium | 7-day/offboarding gaps: pledge kept on leave, volunteer audit copies, plan keys, offline boot | User Privacy Protection, Logging | Fixed locally, not deployed |
| N-1 | Medium | No MFA for church admins or the platform admin | Multifactor Authentication, Authentication | Open |
| N-2 | Low | No idle lock on a signed-in shared desk | Session Management | Open |
| N-3 | Low | No CAPTCHA/bot check on sign-up, sign-in or reset; relies on Supabase rate limits | Credential Stuffing Prevention, Bot Management | Open |
| HE-02 | Low | 12 unescaped `initials()` sites and 2 unescaped `v.id` | DOM based XSS Prevention | Open |
| HE-04 | Low | Client storage / Keystore bridge / export cache / WebView teardown trade-offs | Cryptographic Storage, Key Management, Mobile Application Security | Open |
| HE-05 | Low / Info | `FORCE RLS`, xlsx quote, landing headers, Free-plan leaked-password check, dev-dep advisories, stray file | Database Security, HTTP Headers, Vulnerable Dependency Management | Open (corrected, see section 4) |

## 2. New findings

### N-1 (Medium): no multi-factor authentication for privileged accounts
- `src/*.js` and `supabase/README.md` have no `mfa` or `captcha` code at all (grep, this session).
- Church admins approve staff, remove members and read every visitor record in their church. The platform admin
  manages every church. Today each of these accounts is protected by a password alone: 8–72 bytes with one letter and
  one digit (`src/cloud.js:257-263`). Leaked-password protection is off on the Free plan (`supabase/README.md:69-71`).
- **Fix:** turn on Supabase Auth TOTP MFA and require AAL2 for admin roles: in `is_admin()` / `is_platform_admin()`,
  check `(auth.jwt() ->> 'aal') = 'aal2'`, and add an enrol step in the profile screen. At the very least, enforce MFA
  on the Supabase, GitHub and Cloudflare owner accounts (section 5).

### N-2 (Low): no idle lock on a signed-in shared desk
- A grep for `idle|inactiv|auto lock` in `src/` finds no session timeout or screen lock.
- The desk resumes straight into its saved copy (`src/main.js:43`, accepted in `docs/threat-model.md:85`). So a phone
  left on a table at the expo shows visitor names, phones and same-day readings until someone signs out.
- **Fix:** after N minutes with no input, blur the main view behind a "Tap to continue" screen that needs the account
  password (or the device unlock in the app). Keep the data on the device, so this does not undo the "never lock a desk
  out" decision.

### N-3 (Low): no bot protection on the auth forms
- Sign-up, resend, sign-in and reset call Supabase Auth directly (`src/cloud.js:453`, `479`, `492`). The app handles
  `429` but adds no CAPTCHA.
- The reset flow is sound: the answer is the same whether or not the address has an account (`src/cloud.js:496-497`).
- **Fix:** turn on Supabase Auth CAPTCHA (hCaptcha or Turnstile) for sign-up and reset, and check the auth rate limits
  in the dashboard (**not checked**).

## 3. Status of HE-01 and HE-03 (fixed locally on 2026-11-13)

What changed:
- `src/account.js`
  - `cloudSignOut()` now deletes `QUAR_KEY`. The sign-out question names the kept records and says how to export them first.
  - `applyRetention()` now also runs over the kept records: an old visitor who did not opt in is dropped, and an old
    follow-up keeps only name, contacts and class answers.
- `src/retention.js`
  - `retentionDue()` lets an offline boot clear visits older than 7 + 7 days on the phone's own clock.
    `OFFLINE_SLACK_DAYS` protects fast clocks.
  - `clearReadings()` also strips `interests.customPlan`, `churchPlan` and `attended`, as the notice promises
    ("only your name and contact details are kept").
  - `interests.stress` and the other class answers are kept: they are follow-up choices, not readings
    (`src/data.js:57`). This differs from the earlier report's advice.
- `src/main.js`: applies the same rule once at boot.
- `supabase/schema.sql`
  - `leave_church()` deletes the account's pledge, the same as `remove_member` / `delete_my_account`.
  - `attendees_retention()` and `purge_expired_visitors()` strip the three plan keys after 7 days.
  - The purge empties a deleted volunteer's audit copy after 90 days.
  - `attendees_custom_plan_guard()` no longer refuses a non-admin desk that syncs an old copy whose plan is being
    stripped. On an update it judges by the stored row, so a non-admin still cannot write a plan on a fresh visit (tested).
- Tests: 9 new client checks and 6 new database checks (`.smoke/harness.js`). The `test:db` stub table gained
  `created_at` (`tools/test-commitments.js`).

**Deploy order matters:** apply the new `supabase/schema.sql` in the SQL Editor **before** shipping the client.
Otherwise an older database refuses non-admin desks that send an old visit with its plan removed.

## 4. Corrections to the earlier report

1. **"`attendees`/`volunteers` text columns omit DB length CHECK bounds" is wrong.** `supabase/schema.sql:321-340`
   defines `attendees_limits` and `volunteers_limits`. They are `not valid`, so rows written before they were added
   were never checked.
2. **"untracked … excluded from git" is wrong.** `newstart-passport (2).html` is tracked (`git ls-files` lists it).
3. **The CSP strength overstates `frame-ancestors` in the `<meta>` tag** (`index.html:7`): browsers ignore it there. The
   real protection is `X-Frame-Options: DENY` plus the header CSP in `dist/_headers`.
4. **HE-03's advice to strip `interests.stress` was not followed:** it is the "Stress & peace" class sign-up, kept for
   follow-up.

## 5. Cheat sheets applied and what was found

| Cheat sheet | Result | Evidence |
| :-- | :-- | :-- |
| Authentication, Forgot Password | Pass, except MFA (N-1) and bots (N-3) | Reset answer does not reveal accounts (`src/cloud.js:496-497`); bcrypt 72-byte cap handled (`src/cloud.js:259-260`) |
| Multifactor Authentication | **Finding N-1** | No MFA in app or README |
| Session Management | **N-2**; HE-01 fixed | Sign-out clears session, ledger, church, plans and now kept records (`src/account.js` `cloudSignOut`) |
| Authorization, Access Control, IDOR, Multi-Tenant | Pass | RLS on every table; tenant policies `church_id = (select public.staff_church())` (`schema.sql:694-696`); member/church/admin tables RPC-only (`revoke all … from anon, authenticated`) |
| Database Security, SQL Injection | Pass | All 87 `security definer` functions pin `set search_path = ''`; every function without its own `revoke` is in a revoke loop (`schema.sql:2525`, `3008`, `3211`); no grants to `anon` |
| Mass Assignment | Pass | Staff updates are tenant-checked; custom plans and placements guarded by triggers (`attendees_custom_plan_guard`, `volunteers_place_guard`) |
| Unvalidated Redirects | Pass | `authRedirect()` uses the app's own origin (`src/cloud.js:279`); APK link refused unless same-origin (`src/update.js:47-51`); WhatsApp share uses `encodeURIComponent` |
| Cross Site Scripting, DOM XSS | HE-02 (Low) | 51 `innerHTML` sites, 467 `esc(` calls; no `eval`/`new Function`/`document.write`/`outerHTML`; events dispatched only from the `ACTIONS` registry (`src/actions.js:25`) |
| Content Security Policy, HTTP Headers, Clickjacking | Pass for the app; HE-05 for `landing/` | Hash-pinned `script-src`, `object-src 'none'`, `frame-ancestors 'none'`, XFO DENY, HSTS (`tools/build.js:181-187`) |
| File Upload, Input Validation | Pass | Plan import: JSON only, 2 MB cap, shape normalised (`src/customPlan.js:81-91`), server re-checks; DB length checks exist |
| Prototype Pollution | Pass (nothing found) | No deep-merge of untrusted objects found by grep |
| Web Cache Security (service worker) | Pass | Supabase requests are never cached (`sw.js:101`); no off-site hosts (`sw.js:20`) |
| Cryptographic Storage, Key Management | HE-04 (Low) | AES-256-GCM over `localStorage`; Keystore-wrapped DEK on Android |
| Mobile Application Security | Pass, plus HE-04 | `allowBackup="false"`, device-transfer excluded, provider not exported, no deep links, `webContentsDebuggingEnabled:false`, `allowMixedContent:false`, only `INTERNET` permission |
| Secrets Management | Pass | No `service_role`, private keys, keystores or `.env` in tracked files; only the publishable key ships |
| Serverless/FaaS | N/A | The Cloudflare Worker serves static assets only (`wrangler.jsonc`, no script) |
| User Privacy Protection, Logging | HE-01/HE-03 fixed locally | 7-day rule now covers kept records, plan keys, volunteer audit copies and offline boot |
| Vulnerable Dependency Management | HE-05 | Root `npm audit`: 0; `capacitor/` audit: 6 moderate (build-time `@capacitor/cli` deps) |
| CI/CD, GitHub Actions | N/A | No `.github/` folder in the repo |

## 6. Tests run in this session

| Command | Result |
| :-- | :-- |
| `npm run typecheck` | exit 0 |
| `npm test` with `NEWSTART_PGLITE` | `all 1843 checks passed` (15 new; the earlier report counted 1828) |
| `npm run test:db` | `all 51 DB checks passed` |
| `npm run test:hub` | `RESULT: 107 passed, 0 failed` |
| `npm run test:build` | `all 20 build checks passed` |
| `npm audit` / `npm --prefix capacitor audit` | 0 / 6 moderate |

## 7. Not checked (needs the live systems)

- Supabase dashboard: auth rate limits, CAPTCHA, redirect URL allowlist, MFA on owner accounts, that `pg_cron` runs
  the purge, and `supabase/test-security.sql` run live.
- Live response headers from Cloudflare against `dist/_headers` and `landing/_headers`.
- Behaviour on a real Android phone (Keystore, export sweep, print view).
