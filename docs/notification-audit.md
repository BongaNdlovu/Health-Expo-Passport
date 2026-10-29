# Notification System — Audit & Architecture

**Scope:** how the Health Expo Passport notifies anyone, today, in the code as it stands.
**Method:** read from `supabase/schema.sql`, `src/account.js`, `src/cloud.js` and `src/data.js`. No production
telemetry was consulted — every statement below is traceable to a line in this repository.
**Verdict up front:** the system is a single in-app inbox. There is no push, no SMS, no email, and no delivery
when the app is closed. That is a deliberate-looking design, not an oversight, but it is the fact that matters most
for anything built on top of it.

---

## 1. How it works

```
   a change happens                     a trigger speaks                  the inbox shows it
 ─────────────────────────────────────────────────────────────────────────────────────────────
 INSERT/UPDATE/DELETE           →   SECURITY DEFINER trigger     →   row in public.notifications
 on volunteers / memberships /      calls public.notify()             (title ≤ 120, body ≤ 300)
 churches                           "one row, quietly"
                                                                  →   Supabase Realtime pushes the
                                                                      INSERT to that user's open app
                                                                  →   src/account.js renders the bell
                                                                      count and the sheet
```

### The table

`supabase/schema.sql:1711` — `public.notifications`

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `bigint identity` | primary key |
| `church_id` | `uuid not null` | FK → `churches(id)` **on delete cascade** |
| `user_id` | `uuid not null` | FK → `auth.users(id)` **on delete cascade** — the recipient |
| `kind` | `text not null` | free text, **no check constraint** (see gaps) |
| `title` | `text not null` | `check (length(title) <= 120)` |
| `body` | `text not null default ''` | `check (length(body) <= 300)` |
| `created_at` | `timestamptz` | default `now()` |
| `read_at` | `timestamptz` | null = unread |

### The only writer

`notify(p_church, p_user, p_kind, p_title, p_body)` at `schema.sql:1756` — `security definer`, `set search_path = ''`,
inserts one row with `left(...,120)` / `left(...,300)`. It is **revoked from `public, anon, authenticated`**: no
client can create a notification. Every notification in the system is written by a trigger calling this function.

A trigger never fails because of a notification. `perform public.notify(...)` is deliberately fire-and-forget in
the sense that the insert is one row with no error surface — the comment on the function says "one row, quietly: a
notification must never break the change that caused it."

### Who can read what

`schema.sql:1711` (policy block):

- `select` — `user_id = (select auth.uid())`. You see your own rows, and only those.
- `update` — your own rows, and **column-granted to `read_at` only** (`grant update (read_at) on public.notifications`).
  RLS is row-level; the column grant is what stops a recipient rewriting the text of a message they received.
- No `insert`, no `delete` policy. Deletion happens only in the retention job.

### How it reaches the person

| Step | Where | What happens |
| :--- | :--- | :--- |
| 1 | `schema.sql:2011` | `notifications` is added to the `supabase_realtime` publication, so Realtime streams inserts. |
| 2 | `src/account.js` `notifWatch()` | Subscribes to `postgres_changes` on `public.notifications`. |
| 3 | `notifCount()` / `notifCountSoon()` | Keeps the bell badge current. |
| 4 | `openNotifs()` / `renderNotifs()` | `select ... order by created_at desc range(0,49)` — **the 50 most recent**, no paging. |
| 5 | `markNotifsRead()` → RPC `mark_notifications_read(p_upto)` | Sets `read_at` up to a row. |
| 6 | `notifOpen(id)` | Routes: station-related kinds open the volunteer muster board (staff only); everything else opens the account screen. |

There is **no polling loop** for notifications. The realtime subscription plus the count on open is the whole
mechanism, consistent with the app's rule that it keeps exactly two timers.

### Retention

`schema.sql:2248` inside `purge_expired_visitors()`: a notification is deleted **30 days after it was read**, or
**90 days after it was created** if never read. Nothing else prunes the table.

---

## 2. Who receives what

Four audiences exist. There is no fifth, and no broadcast.

| Audience | Resolved how | Where it is used |
| :--- | :--- | :--- |
| **The linked member** | `memberships.volunteer_id = volunteers.id` → `memberships.user_id` | placement, lead, shift, membership |
| **The church's admins** | `memberships.role = 'admin' and status = 'approved'` for that `church_id` | pledge, register, deregister, unpledge, church approved |
| **A station's team leader** | `volunteers.lead = true` at that booth, joined to `memberships` | someone joined / left their team |
| **The platform admin** | *not notified by any trigger today* | sees everything through the admin screens instead |

An unlinked volunteer row (typed in by staff, not attached to an account) generates **no** notification to the
person — `v_user` is null and every member-facing branch is skipped. That is correct: there is nobody to notify.

---

## 3. The trigger inventory

Every notification below is produced by one of seven functions. `kind` is the string stored in the row.

| # | Trigger | Fires on | Recipient | `kind` | Title (≤120) | Body (≤300) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `pledge_notify` `:1896` | `after insert on volunteers` | every approved admin | `pledge` | `New pledge: {name}` | `They asked for {booth list}.` or `They did not choose a station yet.` |
| 2 | `pledge_notify` `:1896` | same insert | the leader of each station named in `pref` | `pledge` | `New pledge for your station: {name}` | `They asked for {booth}.` |
| 3 | `volunteers_notify` `:1769` | `after update on volunteers` | the linked member | `placement` | `You are placed at {booth}` / `You were taken off {booth}` / `You moved to {booth}` | fixed sentence about the team leader confirming the shift |
| 4 | `volunteers_notify` `:1769` | same update | the station's leader (new and old booth) | `team` | `Someone joined your team at {booth}` / `Someone left your team at {booth}` | link to My team |
| 5 | `volunteers_notify` `:1769` | same update | the linked member | `lead` | `You lead {booth} ★` / `You are no longer the leader of {booth}` | fixed sentence |
| 6 | `volunteers_notify` `:1769` | same update | the linked member | `shift` | `Your shift changed` | the shift text itself |
| 7 | `volunteers_notify_new` `:1819` | `after insert on volunteers` | the linked member | `placement` / `lead` | same wording as 3 and 5 | same |
| 8 | `memberships_notify` `:1849` | `after update on memberships` | that member | `membership` | `Your membership was approved` / `Your role changed to {role}` | fixed sentence per role |
| 9 | `churches_notify` `:1875` | `after update on churches` | every approved admin of the church | `church` | `Your church was approved` | `{name} can now add visitors, volunteers and the queue.` |
| 10 | `volunteers_admin_status_notify` `:1933` | `after update of status on volunteers` | every approved admin | `register` | `Registered: {name}` | `They are registered at {booth}.` (or `…for the expo.` when no booth yet) |
| 11 | `volunteers_admin_status_notify` `:1933` | same, `registered → prospect` | every approved admin | `deregister` | `Deregistered: {name}` | `They gave up their place at the expo. Their pledge still stands.` |
| 12 | `volunteers_admin_withdraw_notify` `:1963` | `after delete on volunteers` | every approved admin | `unpledge` | `Pledge withdrawn: {name}` (member) / `Removed from the roster: {name}` (admin) | `They are no longer on the expo roster.` / `An admin took them off the expo roster.` |

Rows **10–12 were added in this change**; rows 1–9 are pre-existing.

### Content rules worth knowing

- **`{name}` is the volunteer's name as typed on their pledge.** It is copied into `title`, truncated at 120
  characters by `left()`. It is never re-read at display time, so a later rename does not rewrite old messages.
- **`{booth}` is always rendered through `public.booth_title()`** (`schema.sql:1687`), which maps the internal key
  (`bp`, `sugar`, `kitchen`…) to the human label (`Blood Pressure`, `Blood Sugar & Chol.`, `Kitchen Pharmacy`), and
  falls back to the raw key for anything unknown.
- **No PII beyond a display name** is carried in a payload: no phone, email, ID number, or reading. The row is a
  pointer to go and look, not a copy of the record. This is the right call, and it should stay that way.
- **`church_id` is stored on every row** even though the read policy only filters by `user_id`. That keeps the
  cascade honest when a church is deleted, and lets a future church-scoped view exist without a migration.

---

## 4. What the system does not do

Ranked by how much it matters. This is the part to read before planning anything.

### Critical

**4.1 There is no delivery outside an open app.** No Web Push, no FCM/APNs, no email, no SMS. A notification is a
row in a table; the phone learns about it only while the app is running and subscribed. For a church admin who
closes the app after the service, a pledge on Monday is invisible until they next open it. This is the single
largest functional gap and it is structural, not a bug — the app ships with no push bridge and Capacitor has none
wired.

**4.2 The service worker never handles `push`.** `sw.js` does not register a `push` or `notificationclick`
listener, and there is no subscription table. Adding push later means: a `push_subscriptions` table, VAPID keys, a
`push` handler in `sw.js`, and a sender — a real project, not a config change.

### High

**4.3 `pledge_notify`'s duplicate suppression keys on the volunteer's name.** `schema.sql:1900` suppresses a pledge
notification if a row with the *same title* (`New pledge: {name}`) exists within the last hour. Two different
volunteers called "Thandi Mabaso" pledging within an hour means the second admin alert is silently dropped. The
right key is `volunteer id`, which the trigger already has as `new.id`.

**4.4 There are no notification preferences.** A member cannot mute, none of the four audiences can choose kinds,
and there is no quiet-hours concept. Every member-facing event writes a row.

**4.5 The client only ever loads 50 rows.** `range(0,49)` with no paging. A busy church admin's older messages are
unreachable from the sheet even though they exist in the table until retention deletes them.

### Medium

**4.6 `kind` has no constraint.** `text not null` with no `check`. A typo in a future trigger creates a new kind
that the UI renders as its raw string (`KIND_L[x.kind] || x.kind`). It degrades gracefully, which is why this is
medium rather than high, but a `check (kind in (...))` — or a lookup table — would make the vocabulary explicit.

**4.7 The admin-recipient select is duplicated.** Rows 1, 10, 11 and 12 each repeat
`select ... from memberships where church_id = … and role='admin' and status='approved'`. Four copies of one rule
will drift. A `notify_church_admins(p_church, p_kind, p_title, p_body)` helper alongside `notify()` would collapse
them — left as a follow-up rather than done here, because it changes four working functions at once.

**4.8 Read state is a single timestamp.** There is no per-device read state and no "delivered" concept. Marking a
notification read on one phone marks it read everywhere, which is probably right for this app but should be a
stated decision rather than an accident.

### Low

**4.9 No unread badge outside the app.** The bell count lives in the rendered page; the PWA icon has no badge and
the Android app has no notification dot.

**4.10 No digest or escalation.** Nothing rolls up "4 people pledged this week" and nothing escalates an unread
admin alert.

---

## 5. What was changed in this pass

- `volunteers_admin_status_notify` (`schema.sql:1933`) — admins hear about **register** and **deregister**.
- `volunteers_admin_withdraw_notify` (`schema.sql:1963`) — admins hear about **unpledge**, and it distinguishes a
  member withdrawing from an admin removing someone. It skips entirely when the church itself is being deleted,
  because there is then no `churches` row for the FK to point at.
- Client labels for the three new kinds, and they route to the muster board for staff like the other roster kinds
  (`src/account.js`, `KIND_L` and `notifOpen`).

Together with the pre-existing `pledge_notify`, all four requested admin events now produce exactly one row each:

| Event | Trigger |
| :--- | :--- |
| pledges to an expo | `pledge_notify` (pre-existing) |
| registers for an expo | `volunteers_admin_status_notify` (`prospect → registered`) |
| unpledges | `volunteers_admin_withdraw_notify` (delete) |
| deregisters | `volunteers_admin_status_notify` (`registered → prospect`) |

---

## 6. If you build on this next

In the order that buys the most:

1. **Push, or accept the inbox.** Decide explicitly. If church admins must know within minutes, in-app-only cannot
   get there and no amount of trigger work will change that.
2. **Fix the pledge dedupe key** to `new.id` (row 4.3). Small, and it fixes a silent data loss.
3. **Extract `notify_church_admins()`** (row 4.7) before a fifth copy of the select appears.
4. **Add the `kind` check constraint** (row 4.6) once the vocabulary has stopped moving.
5. **Page the inbox** (row 4.5) if any church exceeds 50 notifications in a retention window — the analytics to know
   that would be `select church_id, count(*) from notifications group by 1`.
