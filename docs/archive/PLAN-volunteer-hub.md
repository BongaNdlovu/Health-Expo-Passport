# Plan: self-pledge, station team leaders, admin placement, notifications

Four features that share one base: a member's account linked to their volunteer record. Build them in this order;
each phase ships on its own and leaves nothing half-done.

Facts marked *(seen)* were read in this repo on 2026-10-27. **VERIFY** marks what was not checked.

## Ground rules (all phases)
- **No new polling.** Nothing new runs on a timer. Updates arrive through the existing live channel or on actions the
  person takes. The member screens load their data once when opened.
- **Small reads only.** Every new read is by primary key or an indexed column, and lists are capped (50 notifications).
- **The database decides.** Who may do what is enforced in SQL (RLS, `security definer` functions, triggers), never
  only by hiding buttons.
- **Same style as the code around it.** Complexity of 20 or under (`.cursor/rules/function-complexity.mdc`), terse
  comments that say why, `esc()` on everything rendered.
- **Every phase ends with:** `npm test` green, `npm run typecheck` clean, the SQL tests passing on PGlite (see the
  `android-emulator-test-setup` memory for `NEWSTART_PGLITE`), a click-through on the built page, and a commit.

## Current state *(seen)*
- `public.volunteers` (`schema.sql` ~line 133) has `status` (prospect / registered / checkedin), `pref` (up to 2
  first-choice booths), `pref2` (backup), `booth` (confirmed), and **`role`** (free text, seed uses "Booth lead"), plus
  `shift`. Only staff can read or write it (RLS "staff full access", ~line 179).
- A pledge is typed in by staff in the Team tab (`saveVolunteer`, `src/volunteer.js`). Registering puts the volunteer at
  `pref[0]` straight away.
- `memberships` already links a member to a visitor record (`attendee_id`, set by an admin through `link_member`). There
  is no link to a volunteer record.
- Plain members can't open the expo app: `loadAccount` returns true only for staff and admins (`account.js:61`). They
  see the account panel (details, "My screening results").
- Live updates: one Supabase channel per staff device on `attendees` and `volunteers` (`startRealtime`, `account.js`),
  and the `volunteers` table is in the `supabase_realtime` publication (~line 192).

---

## Phase 1: members pledge themselves

**Database**
1. `alter table memberships add column volunteer_id text check (volunteer_id ~ '^VOL-[0-9]+$')`, plus a unique index on
   `(church_id, volunteer_id) where volunteer_id is not null`, so one record belongs to one member.
2. `my_pledge()`, `security definer`: returns the caller's volunteer row (joined through their membership), or null.
3. `save_my_pledge(p jsonb)`, `security definer`:
   - The caller must be an **approved** member of an **active** church.
   - The only fields taken are: name, phone, email, `pledge_expos`, skills, `pref` (at most 2), `pref2`, availability,
     shirt, emergency, notes. Each is length-checked like `volunteers_limits` (~line 320).
   - Phone or email is required, the same rule as the staff form.
   - **First save:** creates `VOL-n` with the next free number. Use `pg_advisory_xact_lock(hashtext('vol:'||church))`
     so two members saving at the same moment can't take the same number. Sets `status = 'prospect'` and
     `pledged_on = today`, and stores the id in `memberships.volunteer_id`.
   - **Later saves:** update the same row. They **never** change `booth`, `status`, `role`, `lead`, `history` or
     `checked_in`, because those belong to the admin.
4. `withdraw_my_pledge()`: deletes the row if `status = 'prospect'`. Once the person is registered or checked in, the
   admin has to remove them (a row in that state is part of the expo plan).
5. `link_volunteer(p_user, p_vol)` for admins, mirroring `link_member`, so a pledge staff typed in before can be
   attached to the person's account.

**App**
6. A **"My pledge"** box in the account panel for approved members, next to "My screening results". It reuses the
   pledge form's sections 1–3 from `volunteer.js` (split the form into parts the member box can share instead of
   copying them). It loads `my_pledge()` once when the panel opens.
7. When a member has a pledge, the box shows their status and the station they're placed at, read-only.
8. Staff Team tab: a small "linked to an account" mark on volunteers whose record is linked, and a **Link** action for
   admins on the member row (step 5).

**Tests**
- SQL:
  - a member pledges, then edits;
  - they can't set `booth`/`status`/`lead` through `save_my_pledge`;
  - two members at once get different numbers;
  - a pending member or a suspended church is refused;
  - another church's row can't be reached.
- Harness: the "My pledge" box renders, escapes names, and the phone-or-email rule shows the same message as the staff
  form.

## Phase 2: one team leader per station

**Database**
1. `alter table volunteers add column lead boolean not null default false`, plus a unique index on
   `(church_id, booth) where lead`. The database itself then refuses a second leader at the same station.
2. A trigger on `volunteers`, `before update`: if `booth` changes on a leader, `lead` becomes false. A leader moved
   away isn't the leader of their new station.
3. Keep `role` as the display title ("Team leader" is written when `lead` is set). **VERIFY** whether anything outside
   `volunteer.js` writes `role`. Only display uses were found (lines ~361, 366, 397).

**App**
4. In Muster and Booth: a ★ "Team leader" badge on the leader. Each station's coverage row names its leader, or shows
   "No leader yet".
5. The volunteer's own screen and badge show "Team leader · Blood Pressure". The member's "My pledge" box shows it too.
6. The CSV roster gains a "Team leader" column.

**Tests:** a second leader at one booth is refused by the database; moving a leader clears `lead`; the badge renders.

## Phase 3: admins place, move and swap people

**Database**
1. All placement goes through functions, so the rules sit in one place:
   - `place_volunteer(p_vol, p_booth)`: sets `booth`, and `status = 'registered'` if they were a prospect.
   - `swap_volunteers(p_a, p_b)`: swaps two booths in **one transaction**, locking both rows (`for update`, in id order
     so two people swapping at once can't deadlock). **The leader title stays with the station** *(decided)*: whoever
     arrives at a station that had a leader becomes its leader, and the one who left is no longer a leader.
     Concretely: swap `booth`, then swap `lead`, in the same statement, so the unique index never sees two leaders.
   - `set_station_lead(p_booth, p_vol)`: clears the old leader and sets the new one, in one statement.
   - `release_volunteer(p_vol)`: takes someone off their station (`booth = null`, `status = 'prospect'`, `lead = false`),
     so they can be placed elsewhere.
2. **Who may call them** *(decided: admins, plus team leaders for their own team)*. One helper,
   `can_place(p_church, p_from_booth, p_to_booth)`, used by every function above:
   - A **church admin** may do anything in their church.
   - A **team leader** is the member whose linked volunteer record (`memberships.volunteer_id`, Phase 1) has
     `lead = true`. Their rights come from that link, so a leader needs **no staff access**. They may:
     - place an **unplaced** volunteer (booth null) **into their own station**;
     - release someone **from their own station**;
     - swap two people **within their own station's list**, which has no effect on booths but can reorder shifts
       (see step 6), or swap one of their people with an **unplaced** volunteer.
   - A leader **may not**: move anyone into or out of **another** station, touch another station's people, make or
     remove leaders (admins only, `set_station_lead`), or change anyone's details. Moving between two stations is an
     admin action, because it changes two teams.
   - A leader who is moved off their station, or loses the title, loses these rights on the next call, because the
     check reads the live row each time.
3. A trigger refuses a direct `update` of `booth` or `lead` by anyone else. Today any staff account can change any
   column (RLS ~line 179), so this trigger is what makes "admins and leaders only" real. **VERIFY** that this doesn't
   break the staff pledge form, which sets `booth = pref[0]` on registration. Recommended: move that into
   `place_volunteer` and have the form call it (when an admin or the station's leader is signed in); otherwise the
   pledge is saved as "Pledged" with its choices, and an admin or leader places them.
4. `my_team()`, `security definer`, for leaders: returns their station's volunteers plus the unplaced volunteers who
   picked their station as a first or backup choice. It returns only name, phone, status, shift and choices, never
   notes, emergency contact or history. This is what a leader without staff access sees.

**App**
5. **Admins:** Muster becomes the placement board, with no drag-and-drop (drag is slow and fiddly on phones):
   - **Tap a volunteer:** a sheet with "Move to…" (the station list, showing each station's count against its need,
     using `helpersAt`, `volunteer.js:36`), "Swap with…", "Take off this station" and "Make team leader".
   - The sheet shows the person's first choices and backup, so the admin places people where they asked first.
   - **Undo:** the toast after a move offers "Undo" for 6 seconds (it calls the reverse function).
6. **Team leaders:** a **"My team"** box in their account panel (they may be plain members), filled by `my_team()`:
   - their people, with "Take off my station";
   - "Waiting for a place": unplaced volunteers who chose this station, each with "Add to my team";
   - their people's shifts (`volunteers.shift`, already in the table), editable by the leader through a small
     `set_shift(p_vol, p_shift)` with the same `can_place` check.
   - No other station's data loads on their phone.
7. Staff who are neither admins nor leaders see the board read-only.

**Tests:**
- a swap is atomic, so nobody ends up at both stations or none;
- after a swap the station keeps exactly one leader, and it's the person now standing there;
- a leader can add an unplaced volunteer to their station and take one off, but is refused (by the database) when
  moving someone to or from another station, touching another station, or making a leader;
- a leader who has been moved away is refused straight after;
- `my_team()` returns no notes, emergency contacts or history, and nothing from other stations;
- staff who aren't admins or leaders are refused by the database (not just the UI);
- the "Undo" restores the earlier placement;
- two people acting on the same volunteer at once leave a consistent result.

## Phase 4: notifications hub

**What sends a notification.** Only events about the person, and only to people with accounts:

| Event | To |
| --- | --- |
| Your membership was approved / your role changed | the member |
| You were placed at, moved to or swapped to a station | the linked volunteer's member |
| You were made team leader / no longer team leader | same |
| Your church was approved | its admins |
| A member pledged (Phase 1) | the church's admins, and the leader of each station they chose |
| Someone joined or left your team | that station's team leader |
| Your shift changed | the linked volunteer's member |

Volunteers without an account get nothing in the app. The admin still sees them on the board.

**Database**
1. The notifications table:
   ```sql
   create table public.notifications (
     id bigint generated always as identity primary key,
     church_id uuid not null references public.churches(id) on delete cascade,
     user_id uuid not null references auth.users(id) on delete cascade,
     kind text not null, title text not null check (length(title) <= 120),
     body text not null default '' check (length(body) <= 300),
     created_at timestamptz not null default now(), read_at timestamptz);
   create index notifications_user_idx on public.notifications (user_id, created_at desc);
   ```
   - RLS: a user can **select** and **update `read_at`** on their own rows only.
   - No insert policy: rows are written only by triggers and functions (`security definer`).
2. Written by **triggers**, not by the app, so every path that changes a placement notifies, including the functions
   in Phases 1–3 and the admin's own screens:
   - `after update` on `volunteers` (booth or lead changed, and the row is linked to a member);
   - `after update` on `memberships` (status or role changed);
   - `after update` on `churches` (status to active).
   - **No body text is ever copied from health data.** These events carry only station names and roles.
3. `mark_notifications_read(p_upto bigint)`: one update for "mark all read".
4. Retention: add to `purge_expired_visitors` (it already runs daily): delete read notifications after 30 days and any
   after 90.
5. Add the table to the `supabase_realtime` publication.

**App (no new load)**
6. A **bell** in the header for every signed-in account, showing an unread count. The count comes from a
   `head`-only count query, once, at sign-in and when the app comes back to the front. Hook into the existing
   `visibilitychange` listener in `main.js`; add no timer.
7. Live arrival: **one** extra subscription, filtered `user_id=eq.<me>` on `notifications`.
   - Staff devices add it to the existing `newstart-live` channel rather than opening a second one.
   - Members (who have no channel today) open just this one, and only while signed in.
   - **VERIFY** that Supabase Realtime applies the table's RLS to `postgres_changes` inserts for this filter. The code
     notes it doesn't for deletes (`account.js:901`); deletes aren't needed here.
8. The **hub**: tapping the bell opens a sheet with the latest 50 (one query, newest first), unread ones marked.
   "Mark all read" sets them in one call. A notification about a station opens the person's pledge or the board.
   Nothing loads until the sheet opens.
9. Offline: the bell shows the last known count, and the sheet says "Connect to see new notifications". Nothing is
   queued, since notifications are only ever read.

**Tests:**
- SQL:
  - each event writes exactly one row to the right person;
  - no row for an unlinked volunteer;
  - users can't read or mark anyone else's rows;
  - the purge deletes old rows.
- Harness:
  - the bell count renders and escapes titles;
  - the sheet loads once per opening;
  - no new `setInterval` was added (a source check for `setInterval(` count unchanged).

---

## Performance budget (check after each phase)
- Bundle: `dist/index.html` grows by no more than ~25 KB in total for all four phases (it's 546,607 bytes *(seen)* before
  the scanner removal). **VERIFY** the size after each phase.
- Requests: per member per app open, at most 2 new requests (pledge and notification count). Per staff device, no
  new requests except the realtime filter.
- Database: every new query uses an index listed above. `explain` each RPC on a seeded church with 3,000 visitors and
  900 volunteers (the README's test size).
- Renders: the harness timing checks ("every screen renders in under 25 ms") must still pass.

## Decisions (made 2026-10-27)
1. **Swap and the leader:** the leader title **stays with the station**.
2. **Self-pledge:** counts **straight away** as "Pledged". No admin approval step.
3. **Who places people:** **admins**, and **team leaders for their own team** only (rules in Phase 3, step 2).

Order consequence: team leaders act through their linked account, so Phase 1 (the account link) must be finished
before the leader rights in Phase 3 can work. Phase 2 (the `lead` column) must also come before Phase 3.

## What to verify (checklist)
- [ ] Nothing outside `volunteer.js` writes `volunteers.role` or `booth`.
- [ ] The staff pledge form still registers people after the Phase 3 trigger.
- [ ] Realtime `postgres_changes` honours RLS for the filtered `notifications` inserts.
- [ ] The unique index (one leader per station) and the swap function survive two admins acting at the same moment.
- [ ] A member can never reach `booth`, `status`, `lead` or `history` through any function.
- [ ] A team leader can never act outside their own station, make a leader, or read notes, emergency contacts or history.
- [ ] A volunteer with no linked account can be a station's leader on the board, but gets no leader rights in the app
      (they have no account to act through). Admins see a hint: "Link this leader to their account so they can manage
      their team."
- [ ] No new `setInterval`, and the bundle grows within budget.
- [ ] The notification bodies never carry health data (POPIA).
- [ ] `schema.sql` is still safe to re-run (every `create` / `alter` guarded with `if not exists` / `drop ... if exists`).
- [ ] After each phase: tests, typecheck, SQL tests on PGlite, a click-through on the built page and on the emulator,
      an APK rebuild, and a commit.
