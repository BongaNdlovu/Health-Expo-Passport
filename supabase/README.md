# Supabase backend — setup

Project: `https://wlsrgihkijlvjyfxvhfl.supabase.co` (URL and publishable key are already in `index.html`).

The app is a single static HTML file, so it uses the Supabase **browser** client loaded from a CDN. The
Next.js files in the Supabase quickstart (`utils/supabase/*`, middleware) do not apply here.

## One-time setup (about 5 minutes)

1. **Create the tables and security rules.** Dashboard → SQL Editor → New query → paste all of
   `supabase/schema.sql` → Run.
2. **Turn on account creation with email confirmation.** Authentication → Sign In / Providers → Email:
   - **Allow new users to sign up** = ON (the app's *Create an account* page needs it)
   - **Confirm email** = ON (so nobody can register with an address that isn't theirs)
3. **Tell Supabase where the app lives**, or the links in the emails will point at the wrong place.
   Authentication → URL Configuration:
   - **Site URL** = the web address you host `index.html` at (for example `https://newstart-expo.pages.dev/`)
   - **Redirect URLs** = add the same address (and `http://localhost:5173/**` if you test locally)
4. **Set up real email sending before the event.** Supabase's built-in email sender is for testing only and allows just
   a handful of emails per hour. Authentication → Emails → SMTP Settings → connect a provider (Resend, SendGrid,
   Brevo, Gmail SMTP…). Without this, sign-up and reset emails stop arriving once the limit is hit.
5. **Make yourself the platform admin.** Create an account in the app (or Authentication → Users → Add user),
   confirm the email, then run this in the SQL editor with that email:

   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```

   Then register your church in the app, or rename the one the upgrade made (see *Churches, members and the platform
   admin* below).

6. Open the app and sign in. The dot on the logo turns green once the first sync finishes.

## Churches, members and the platform admin

Run the whole of `schema.sql` again (it is safe to re-run). It adds three levels of account on top of the expo app:

| Who | What they see and do |
| --- | --- |
| **Platform admin** (you) | Logo → **Admin**: every church with its member, staff, visitor and volunteer counts; approve, pause or reactivate a church; open any church's members and details; the latest changes in every church. Nobody can become platform admin from the app: it is a row in `public.platform_admins`, added in the SQL editor (step 5 above). |
| **Church admin** | Registers the church in the app; it waits until you approve it. Logo → **Church**: approves members, makes people **staff** or **admin**, links a member to their expo badge, removes people, edits the church's details. |
| **Staff** | Use the expo app exactly as before, on their own church's visitors, volunteers and queue only. |
| **Member** | Anyone who creates an account and joins a church. Once the church approves them they see **My account**: their own details (name, phone, area, date of birth) and their own screening results, after a church admin links their badge. They never see anyone else's data. |

- **One church per person.** Leaving a church deletes the person's details there; they can then join another one.
- **Each church's data is separate.** Every visitor, volunteer, queue entry and audit row carries a `church_id`. Row Level
  Security lets only that church's approved staff read or change them, and only while the church is active. Two churches
  can both use badge EXPO-001.
- **Upgrading a database that already holds data:** the first run moves everything into one new active church named
  *My church (rename me)* and makes everyone in `public.staff` its staff (`is_admin` becomes church admin). Rename it under
  Logo → Church. From then on `public.staff` is no longer used: approvals happen in the app.
- **Phones remember which church their saved copy belongs to.** Signing in to a different church clears the old copy first
  instead of uploading it into the new church. An account that is no longer staff loses the saved copy at its next sync.
- **Screening results for members:** a church admin taps **Link badge** next to the member and types the badge number.
  The link also remembers that visit, so if the badge number is ever reused for someone else, the member stops seeing it.
  As at the expo, only medical readings decide the clinic line: a red blood pressure, sugar, cholesterol or weight reading
  says to book a clinic visit this week, a danger-range one (160/100, sugar 15) says to see a clinic as soon as possible,
  and the "keep taking your medicine" rule always shows.
- **The platform admin sees counts, not visitor records.** The policies give the platform admin nobody's health data. To
  work in a church's expo data, join that church as staff.
- **Testing the database part:** section 18c of `.smoke/harness.js` runs this schema on an in-memory Postgres (PGlite)
  and checks the rules above, including that churches cannot see each other's data. Install PGlite in a folder outside
  the project (`npm i @electric-sql/pglite@0.5.11`) and set `NEWSTART_PGLITE` to that folder before running the harness;
  without it, section 18c says it was skipped.

## The Profile page

The **Profile** tab (last item in the bottom bar) is where a person manages their own account. Everything on it calls
the same database functions as the sheets behind the logo; it only puts them where they can be found.

- **Signed out:** sign in, **Forgot password?** and **Create an account** (these open the full-screen sign-in screens, with
  *Back to the app* to return).
- **Signed in:** name, email and role (member, staff, church admin, platform admin) with the church; **Sync now** and status;
  *My details* and *My screening results*; **Change password**; the install-on-phone help; **Sign out**; and shortcuts to
  *Manage church* and *Platform admin* for those who have them.
- **Delete my account:** needs the latest `schema.sql` (it adds `delete_my_account()`), so run the whole file again. The
  person opens the panel and types DELETE. The database then deletes their login, their church membership and any admin
  rows; the church's visitors, volunteers and queue stay. It refuses a church's **only admin** (make someone else an admin
  first) and the **only platform admin** (add another one in the SQL editor first). Until `schema.sql` has been run, the
  button says so instead of failing silently.
- Members (people with no expo access) never see the app behind the sign-in screen, so their *My account* screen has the
  same **Change password** and **Delete my account** controls.

## How accounts work

> This section describes the database **before** the churches part of `schema.sql`. Once that has run, accounts
> work as described above and `public.staff` is no longer used.

- Anyone can **create an account** (name, email, password) and must **confirm their email** by clicking the link.
- Creating an account gives **no access to any data**. Until an administrator approves it, the person sees a
  *Waiting for approval* screen. Approval = a row in `public.staff`; the database enforces it, not the app.
- **Forgot password** emails a reset link; it opens the app on a *Choose a new password* screen.
- Passwords: at least 8 characters with a letter and a number.

### Approving people inside the app (recommended)

Run `schema.sql` again (it adds an `is_admin` flag and three small functions), then make yourself the first admin
**once** in the SQL editor (your email):

```sql
update public.staff set is_admin = true
where user_id = (select id from auth.users where email = 'you@example.com');
```

From then on, an admin opens the account panel (tap **Sync** on Home) and sees **Waiting for approval**: each new
account's name and email, with an **Approve** button. Only accounts that have confirmed their email can be approved.
Nobody else sees this section. To make another person an admin, run the same `update` with their email.

**Practice mode:** the sign-in screen has *Practise first, with demo visitors*, so new volunteers can learn the app
before they are approved. Nothing is shared or saved to the database. It is only offered on phones that have never
held real shared data, so practice can never show real visitors.

### Approving people with SQL

See who is waiting:

```sql
select u.email, u.raw_user_meta_data->>'full_name' as name, u.email_confirmed_at is not null as confirmed, u.created_at
from auth.users u left join public.staff s on s.user_id = u.id
where s.user_id is null
order by u.created_at desc;
```

Approve one person (their email):

```sql
insert into public.staff (user_id, note)
select id, coalesce(raw_user_meta_data->>'full_name', 'staff') from auth.users where email = 'person@example.com'
on conflict do nothing;
```

Remove someone's access (their account stays, but they see nothing):

```sql
delete from public.staff where user_id = (select id from auth.users where email = 'person@example.com');
```

### Hardening (recommended before the expo)

Findings of the security pressure test (21 Oct 2026) that only you can act on:

- **Android signing passwords** belong in a password manager. On this PC they are Windows credentials
  `NEWSTART-Expo/keystore-store` and `NEWSTART-Expo/keystore-key`. `tools/sign-app.ps1` reads those. Do not put them
  back in the project folder.
- **Password rules on the server.** The app asks for 8+ characters with a letter and a number, but someone calling
  Supabase directly is held only to Supabase's own minimum (not visible from outside, so not checked). In the Supabase
  dashboard's Auth settings, set the minimum password length to 8 and turn on leaked-password protection if your plan
  offers it.
- **Live deletes are not filtered by row-level security** (Supabase Realtime docs, "Postgres Changes"). A signed-in
  account that listens for deletes can learn the church id and badge number of a visitor deleted in another church; no
  names or readings. The app ignores such events. Visitors are only ever deleted from this dashboard.

Open sign-ups mean strangers can request accounts and cost you emails. They still cannot see data. To reduce abuse,
turn on Authentication → Attack Protection → **CAPTCHA** (Cloudflare Turnstile is supported) — note this app does not
include the CAPTCHA widget yet, so switch it on only after that is added, or sign-ups will be refused. Alternatively
switch **Allow new users to sign up** back OFF and add people yourself under Authentication → Users → Add user.

`supabase/seed-demo.sql` is optional demo data for a **test** project only. Never load it into the live database.

## Already ran an earlier schema.sql? Run it again

`schema.sql` is safe to re-run. The newest version adds four indexes that keep paging and "changes since"
pulls fast with thousands of rows. Just paste and run the whole file again.

## Live queue (Queue tab)

The **Queue** tab shows who is waiting at each station, live on every desk. It needs the `queue_entries` table, so
**run the whole of `schema.sql` again** (it is safe to re-run). Until you do, the tab shows "The live queue is not set up
yet" and everything else keeps working.

- A desk adds a visitor to a station's line, taps **Call next** when ready, then **Done**. **↩** puts someone back in
  the line in their original place; **✕** (tap twice) removes them.
- The board shows, per station, how many are waiting, who is being served, the longest wait and an estimated wait for
  someone joining now. The estimate uses the average of the last 15 finished visits (4–10 minutes until three have
  finished) divided by how many people are being served at that moment. Green under 10 minutes, amber from 10, red from 20;
  amber also when people are waiting and nobody is being served.
- **Unlike visitor records the queue is not offline-first.** A line only means something if every desk sees the same one,
  so queue changes are refused with "No connection" instead of being saved for later. Waiting times use the database
  clock, so a phone with the wrong time does not skew them.
- **Big screen** (button on the Queue tab): a full-screen board for a TV or projector — now serving, the next four
  badges and the wait at each station. Badge numbers only, never names. Sign in on a
  laptop or tablet, tap *Big screen*, and cast or plug it into the TV. It keeps the screen awake; **Esc** or ✕ closes it.
- Signed out, the tab is an in-memory practice queue on that device only.
- Only approved staff can read or change the queue (same rules as visitors). Only today's queue (last 18 hours) loads.

## Scale (1,000+ visitors)

- 1,000 visitors plus volunteers is roughly 1–2 MB of database — tiny for Postgres.
- Supabase returns at most 1,000 rows per request; the app reads in pages of 500 and never loses rows past that.
- A device does a full read when it signs in, on **Sync now**, and every 10 minutes; in between it only asks for
  rows that changed. Live changes from other desks arrive instantly.
- The lists on Home, the switcher and Care show the latest 25–30 and have search / "Show all", so the phone stays
  fast with thousands of people.
- The device keeps its own copy in the browser (limit about 5 MB). Measured with 3,000 visitors and 900 volunteers:
  the copy is about 1.3 MB and the sync bookkeeping about 0.1 MB (it used to be 1.6 MB — a full second copy of every
  row — and is converted automatically on first open). The device only writes to storage when something actually
  changed, and warns once if the phone's storage is full instead of failing silently.
- Long volunteer lists (Muster, Switch volunteer) show 25 at a time with *Show all* / search, like the visitor lists.
  The fallback camera scanner library loads only when the scanner is first opened, not at start-up.
- Tested with 3,000 visitors and 900 volunteers: full first load under half a second against a simulated server,
  every screen renders in under 25 ms in a real browser.

## For the live event

- **Use the Pro plan for the event month.** Free projects are paused after a week without activity and have no
  automatic backups; this is health data you cannot re-collect.
- Host the app over **https** and install it on each phone — see `HOSTING.md` (build with `node tools/build.js`,
  upload `dist/`). Camera scanning, install and offline mode all need https, and every desk needs the same link.
- Load the page once on each device while it has Wi-Fi; after that, brief drops are fine (changes queue and upload).

## How it behaves

- **Offline-first.** Every change is saved on the device straight away and uploaded when online. The logo dot:
  grey = not signed in, amber = syncing/offline, green = up to date, red = problem (tap it for the reason).
- **Shared between desks.** Other desks' changes appear live. If two desks edit the same visitor at the same
  moment, the last upload wins for that row.
- **Demo mode.** Until someone signs in, the device shows the built-in demo data. Signing in replaces it with the
  database contents; demo rows are never uploaded unless edited.
- **Signing out** clears the visitor and volunteer data from the device (it warns first if anything has not been
  uploaded).
- **Cloud status.** Tap **Sync** on Home (or the logo) for one row per cloud function: Sign-in, Download, Upload, Live
  updates, Live queue, Accounts & admin and Database setup. Each row is green (working), amber (attention, e.g. offline
  or reconnecting), red (failed, with the database's own message underneath) or grey (off / not checked yet), with the
  time it last changed. Rows only change when something actually happened, never by guesswork. **Test now** checks
  every row on demand with read-only requests (one row of each table and read-only functions); it never changes data.
  Database setup names any missing table or function, so you know when to run `schema.sql` again. Home shows the worst
  of Download, Upload and Live updates, the Queue tab's warning banner has a **Details** link, and the account screens
  show a banner while an account call is failing.
- **Privacy.** The publishable key is public by design. All access is blocked by row-level security unless the
  caller is signed in *and* listed in `public.staff`. Never put a `secret` / `service_role` key in the page.
