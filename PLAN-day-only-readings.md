# Plan: health readings are kept for 7 days only

Goal: a church (or other organisation) never keeps visitors' health data long-term. Visitors take their results home on
the printed card or WhatsApp on the day. After a 7-day grace period:

- every visitor's readings, survey answers, chronic-illness text, height and prayer request are deleted;
- visitors who did **not** tick follow-up are deleted completely;
- visitors who ticked follow-up keep only: badge id, name, phone, email, age, sex, interests (incl. the consent record),
  done, dates. These stay under the existing 2-year rule (`RETENTION_YEARS`).

Decisions already made by the owner: 7-day grace period · prayer deleted with the readings · non-opt-in records deleted
whole · the notice names the church **or organisation** by the name it registered with.

Facts below marked *(seen)* were read in this repo on 2026-10-27. Items marked **VERIFY** were not checked: the
implementing agent must check them before relying on them.

---

## 1. Consent screen and notice: `src/visitor.js`

Current state *(seen)*: one question, `CONSENT_Q` (line 245), covers screening **and** follow-up; `readConsent`
(line 280) sets `optin:true` automatically (line 284). The notice `PRIVACY_NOTICE` (line 249) says "Who: The church
running this health expo" with no name or contact details.

Changes:
1. `CONSENT_Q` → covers the screening and any prayer request only, e.g.
   "Do you consent to today's health screening, including any prayer request you share?"
2. Add a second, separate checkbox in `consentFields` (line 263), **unticked by default**, e.g.
   "May we contact you afterwards about your results, seminars and classes? (optional)".
   It must not be required to save.
3. `readConsent`: `optin` = that checkbox's value, not `true`.
4. Add `const GRACE_DAYS=7;` next to `RETENTION_YEARS` (line 248), with a comment that the SQL interval in step 2 must
   match it.
5. Notice rows:
   - **Who**: the registered name plus its phone/email, from `cloud.acct.church` (`name`, `phone`, `email` come from
     `my_account()`, schema.sql line 704 *(seen)*). In demo mode or with no church loaded, fall back to
     "The church or organisation running this health expo". `noticeHTML` is currently a constant arrow; it has to read
     the church at render time.
   - **What**: unchanged, but say that prayer requests are included.
   - **How long**: "Your health readings and any prayer request are deleted 7 days after your visit. If you agree to
     follow-up, only your name and contact details are kept, for up to 2 years after your last visit."
   - **Who sees it**: "Only the [name]'s approved health team …".
6. Bump `NOTICE_VERSION` (line 246) to the date of the change.
7. Optional label change: where a church registers (`registerChurch`, `src/account.js`), call the name field
   "Church or organisation name". Do not rename the database table.

## 2. Server: `supabase/schema.sql`

Current state *(seen)*:
- `purge_expired_visitors` (line 1308) deletes visitors not updated for 2 years.
- It runs weekly, Sunday 03:00, via pg_cron (lines ~1335–1341), and only if pg_cron is on.
- `audit_row` (line 625) stores a **full copy** of every deleted attendee in `audit_log.old`, readings included. Those
  copies are emptied only after 90 days.

Changes, all in `purge_expired_visitors`, before the existing 2-year delete:
1. Clear health data on every visitor created more than 7 days ago:
   `update public.attendees set s='{}'::jsonb, prayer='', chronic_list=null, height_cm=null where created_at < now() - interval '7 days' and (s <> '{}'::jsonb or prayer <> '' or chronic_list is not null or height_cm is not null);`
   **VERIFY** the column names (`chronic_list` is referenced at line ~1300; check that it exists as a column) and that
   `s` has no NOT-NULL checks that reject `'{}'`.
2. Delete visitors created more than 7 days ago whose `interests->>'optin'` is not `'true'`.
   **VERIFY** how `optin` is stored in the jsonb (`true` boolean → `(interests->>'optin')::boolean`).
3. Empty the audit copies of attendee deletes whose `old->>'created_at'` is more than 7 days ago (`set old = null`), so
   deleted readings do not survive in `audit_log`. Keep the 90-day rule for everything else.
4. Run it **daily**: change the cron schedule from `'0 3 * * 0'` to `'0 3 * * *'`. Otherwise readings can live up to
   13 days.
5. Update the comment block at line ~1302 to describe the 7-day rule, and add `GRACE_DAYS` to the
   "change both together" note.

### Stop offline phones putting readings back (most important)

Current state *(seen)*: `mergeRemote` (`src/account.js` line 759) re-uploads a row that is "edited here but gone there"
(line 780). So a phone that was offline and still holds readings can upload them again after the purge.

Add a `BEFORE INSERT OR UPDATE` trigger on `public.attendees`:
- if the row's `created_at` (the old one on UPDATE) is more than 7 days ago: clear `s`, `prayer`, `chronic_list` and
  `height_cm` on `NEW`; and if not opted in, `return null` (skip the write).
- **VERIFY** whether the app sends `created_at` when it uploads a row (`attToRow` in `src/`). If it does **not**, a
  re-uploaded old row gets `created_at = now()` from the default and looks new. In that case either:
  (a) make `attToRow` send `createdAt`, and keep it on the local object (check `rowToAtt` / `migrateAttendee` in
  `src/state.js` line 43); or
  (b) add a small `purged_attendees (church_id, id, purged_at)` table that the purge fills and the trigger checks
  (rows kept 30 days).
  Prefer (a) if `created_at` already round-trips.
- **VERIFY** whether badge ids (`EXPO-###`) get reused at a later expo. If they do, check that the trigger does not
  block a genuinely new visitor with a reused badge number.

## 3. Phones: the local copy

The same rule has to apply on the device, or the old readings stay visible in the visitor list:
1. After loading from storage and after each `mergeRemote`, apply the same rule as the server to every attendee older
   than `GRACE_DAYS`: clear health fields, and drop the record if not opted in. Only do this for records
   **that have been synced**: don't drop a pending local change before it uploads. The server trigger strips it anyway.
2. Use the record's creation date. **VERIFY** which field holds it on the local object. If there is none, add one
   (see 2(a)).
3. Do not apply this in demo mode to the built-in demo visitors (`src/data.js` lines 8–14 have fixed dates in 2026-03).
   **VERIFY** how `isSeedRow` marks them.

## 4. Screens that show readings

1. **Results / plan screens** (`src/results.js`) for a record with no readings: check they render cleanly (no "NaN",
   no crash) and show a line like "Readings were deleted 7 days after the visit."
2. **My health** (`healthHTML`, `src/account.js` line 215; `my_health()` schema.sql line 836): show the same line
   when `s` is empty.
3. **Printed card and WhatsApp message** (`buildPrintCard` `src/volunteer.js` line 1053, `waMessage` line 951): add
   one line: "Keep this: the church deletes your readings after 7 days."
4. **CSV export** (`exportCSV`, `src/results.js` line 478): no logic change. It already blanks contacts for
   non-opt-ins (line 489). Add a toast or confirm: "This file contains health data. Delete it when you're done."
5. **Follow-up toggle** (`toggleOptin`, `src/visitor.js` line 310): no change needed. Turning follow-up off makes the
   record eligible for deletion at the next daily purge. Mention that in the toast after the grace period.

## 5. Build and docs
- Rebuild with `npm run build` (`tools/build.js`) so `dist/` and `index.html` match `src/`. **VERIFY** which files the
  build writes.
- Update `supabase/README.md`: the daily purge needs pg_cron, and without it nothing is deleted.
- Re-run `supabase/schema.sql` in the Supabase SQL editor (it's written to be safe to re-run). That's a manual step for
  the owner.

## Rules for the implementing agent
- Keep each new or changed function at a cyclomatic complexity of 20 or under (`.cursor/rules/function-complexity.mdc`).
- Match the surrounding code style: terse, comments only where they explain why.
- Report only measured results: test counts and outputs from the actual run.

---

## What needs to be verified (checklist)

Code checks (before writing):
- [x] `chronic_list` is a column of `public.attendees`, and `s` accepts `'{}'` (empty object passes jsonb_numbers_only).
- [x] How `optin` is stored in `interests` — a JSON boolean; `interests->>'optin' = 'true'`.
- [x] `attToRow` did **not** upload `created_at` and the local record had none: added both (option a), plus the
      `purged_attendees` ledger (option b) because a phone that never sends `created_at` would otherwise resurrect a row.
- [x] Badge ids are per church (`primary key (church_id, id)`) and can be reused at a later expo: the trigger keys off
      `created_at` only, and the ledger row is cleared after 30 days, so a reused badge still registers.
- [x] Demo/seed rows are recognised by `isSeedRow` (and the phone rule only runs on a real synced copy).

Behaviour tests (after writing). Added to `.smoke/harness.js`; `npm test` → 882 checks passed, `npm run typecheck` clean.
- [x] The new follow-up tick is unticked by default; saving with only the screening consent gives `optin:false`.
- [x] The notice shows the church/organisation name, phone and email when signed in, and the fallback text in demo mode.
- [x] `NOTICE_VERSION` changed (2026-10-27).
- [x] A visitor created 8 days ago **with** opt-in: after the purge, `s` = `{}`, prayer empty, chronic list and height
      empty; name and phone kept.
- [x] A visitor created 8 days ago **without** opt-in: gone after the purge, and its `audit_log.old` is null.
- [x] A visitor created 6 days ago: untouched.
- [x] Resurrection: an offline phone holding an 8-day-old record with readings syncs. The server row has no readings,
      and a non-opt-in row is not recreated.
- [x] Phone copy: after load/merge, old records show no readings; a pending unsynced edit is not lost before upload.
- [x] Results, plan and My health screens render a record with empty readings without errors.
- [x] Card and WhatsApp text include the "deleted after 7 days" line.
- [x] The cron job is daily in `schema.sql` (`0 3 * * *`). Running it still needs pg_cron on the project.
- [x] SQL tests: added to `.smoke/harness.js` section 18c (PGlite) and to `supabase/test-security.sql`.

---

> **Superseded 2026-10-27:** the `purged_attendees` ledger was removed. Badge numbers are reused at the next expo, so
> it silently dropped a new visitor who was given a deleted visitor's number. The trigger and the purge now judge an
> old visit by `interests.consentOn` when the phone sends no `created_at`, and a visit's `created_at` can no longer be
> moved by an update.
