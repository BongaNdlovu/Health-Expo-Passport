# context.md — Health Expo Passport

*The document you wish had existed on day one. Read it before changing anything; it is faster than reading 25
modules and a 2,200-line schema.*

---

## 1. What this is

**Health Expo Passport** is an offline-capable web app (and an Android wrapper of the same page) that runs a
community health screening event end to end: a visitor is registered, measured at a series of stations, given a
plain-language health age and a plan, and sent home with a printed record — while the volunteers staffing the
stations, the queue, and the church that owns the event are managed in the same app.

It was built for **Seventh-day Adventist community health expos in South Africa**. Every product decision leans on
three facts about that setting:

1. **The venue has no reliable internet.** Church halls and parking lots do not have wifi. The app must work with no
   signal, all day, and reconcile later.
2. **The people using it are volunteers, not clinicians.** Screens must be obvious under time pressure and the
   wording must not imply a diagnosis.
3. **The data is health data about identifiable people.** Under POPIA it is special personal information. Consent,
   retention and deletion are product features, not an afterthought.

### The problem it replaces

Paper passport cards, a clipboard queue, and a spreadsheet afterwards. The failure modes of that process are what
the app is shaped around:

| Paper problem | What the app does instead |
| :--- | :--- |
| Badge numbers collide between tables | One shared numbering scheme with a conflict resolver on sync |
| The queue is a person shouting names | A live queue with stations, call-next and a big screen |
| Results are illegible to the visitor | A health age, a staged BP reading, and a written plan |
| Data is lost with the paper | Local-first storage, cloud sync, and a restore path |
| Nobody knows who is coming to help | The volunteer pledge → register → place → serve pipeline |
| The church cannot see its own event | Per-church tenancy, admin dashboards, and admin notifications |

### What it is not

- **Not a medical device.** No diagnosis, no prescription. The output is an educational estimate with a disclaimer
  (`DISCLAIMER`, `PRECAUTIONS` in `src/data.js`).
- **Not multi-tenant SaaS in the usual sense.** One deployment, many churches, each isolated by `church_id` and RLS.
- **Not a React app.** There is no framework, no virtual DOM, and no runtime dependency of any kind.

---

## 2. The people and the nouns

Getting these four nouns right prevents most confusion in this codebase. They are not synonyms.

| Noun | Table | What it is |
| :--- | :--- | :--- |
| **User** | `auth.users` (Supabase) | A login. Email + password. Owns nothing directly. |
| **Member** | `memberships` | A user's place in one church: `role` (`member` / `staff` / `admin`), `status` (`pending` / `approved` / `suspended`). Approval is required before anything else works. |
| **Volunteer** | `volunteers` | A person on a church's expo roster. May be **linked** to a member (`memberships.volunteer_id`) or unlinked (typed in by staff at a desk). Carries the pledge, the station, the level and the expo history. |
| **Attendee / visitor** | `attendees` | A person who came to be screened. **Has no account and never signs in.** A member can be linked to one attendee record to see their own results (`memberships.attendee`). |

> **This is the single most common misreading.** "Attendee" in conversation often means "person using the app",
> but in the schema an attendee is a *patient*. Pledging, registering, deregistering and unpledging are all
> **volunteer/member** actions. Attendees do not pledge.

### Roles

| Role | Can do |
| :--- | :--- |
| `member` | See their own results, pledge/unpledge, deregister, join/leave a church, edit their details |
| `staff` | Work the expo desks: register visitors, record readings, run the queue, see all visitors |
| `admin` | Everything staff can, plus manage members, approve them, place volunteers, choose team leaders, set church plans and invites. At most two admins per church, ranked (`admin_rank`): Health Department Leader, then Assistant. |
| **platform admin** | `platform_admins` table. Approves churches, sees all churches, pauses them. Not a member of any church by default. |

### Status vocabularies (they are separate machines)

```
church      pending ──→ active ──→ suspended
membership  pending ──→ approved ──→ suspended
volunteer   prospect ──→ registered ──→ checkedin
```

- `prospect` displays as **Pledged**, `registered` as **Registered**, `checkedin` as **Checked in ✓** (`STATUS_UI`).
- A volunteer only exists as `prospect` once they have pledged. `pledged_on` / `registered_on` / `checked_in` track
  the transitions.
- `checkedin` is terminal from the member's side: withdrawing and deregistering are both refused once someone has
  served.

---

## 3. How the system operates

### 3.1 The visitor journey (the core loop)

`JOURNEY = ['screen', 'results', 'plan', 'send']` — Check → Results → Plan → Send home. Eight checks are recorded
against an attendee (`doneCount(a) / 8`). Each step writes to the same local record; nothing is uploaded per step.

```
register ─→ Check (8 stations) ─→ Results (health age) ─→ Plan (counselling) ─→ Send home (print / survey)
```

- **Register** assigns the next badge number (`EXPO-###`) in this church's sequence.
- **Check** records height/weight, BP, blood sugar, and the questionnaire answers. Each reading is classified
  (`cat`, `redFlag`) the moment it is entered, and a red flag surfaces on the Care tab immediately.
- **Results** computes a **health age** (`healthAge`) from the readings — an educational estimate, deliberately
  two-sided so better-than-reference numbers pull the age down.
- **Plan** picks a counselling protocol (`PROTOCOLS`, `autoProtocol`) and books/refers by cost (`FOOD_PRICES`,
  `BOOK_REF`).
- **Send home** prints an A6 card (`printCard`) and records the survey/consent answers.

### 3.2 The volunteer lifecycle

```
pledge (member, self-service) ─→ admin places them at a booth ─→ admin registers them ─→ check in on the day
      └─ unpledge (delete)                 └─ deregister (back to prospect)          └─ record hours
```

- **Pledge** is a member action (`save_my_pledge`) that creates a `volunteers` row at `prospect` and links it to
  their membership. They choose up to two preferred stations and an availability band.
- **Placement** is an admin or team-leader action (`place_volunteer`, `swap_volunteers`, `release_volunteer`),
  guarded by `volunteers_place_guard` so no other path can move a person.
- **Registration** is the admin's confirmation (`status = 'registered'`, `registered_on`). Only now does the person
  appear on the muster board as a confirmed helper.
- **Deregister** (`deregister_my_pledge`) sends a registered person back to `prospect`, releasing the booth, shift
  and any team-lead title. **Unpledge** (`withdraw_my_pledge`) deletes the row entirely. Both are refused at
  `checkedin`.
- **Service history** is the `history` jsonb array on the volunteer row: `[{expo, name, date, booth, hours}]`. The
  level and badge are derived from it, never stored.

### 3.3 The queue

`queue_entries` is per church and per station. A visitor is joined to a station, called, served and completed
(`queueJoin → queueCallNext → queueServe → queueDone`), with `queue_now()` giving the current state and a
big-screen view for the hall. The queue is one of the app's two polling timers.

### 3.4 Church and account lifecycle

```
register a church (pending) ─→ platform admin approves (active) ─→ admins approve members ─→ members pledge
                                        │                                    │
                                        └── paused (suspended) ──────────────┘  leave / be removed
```

- A church is created by the first person to sign up for it; they become its first admin once approved.
- Members join by searching the directory (`church_directory`) or following an invite link (`church_invites`,
  32-hex code, 30 days, cancellable).
- Leaving a church deletes that church's data from the device and clears `memberships`.

---

## 4. Business rules that actually bite

These are rules with teeth — they are enforced in SQL or in a test, and changing them without knowing will break
something.

| Rule | Where | Why it exists |
| :--- | :--- | :--- |
| **The database decides authorization, not the screen.** Every write is an RPC with its own check. | `supabase/schema.sql` | A hidden button is not a control. The client is untrusted by design. |
| **Only admins and station leaders may change `booth`, `lead`, or `status`.** | `volunteers_place_guard` | Stops a sync or a crafted request from moving people around. |
| **A member may clear their own booth, never move to another.** | `newstart.self_release` flag read by the same guard | Deregistering must be possible without opening a hole. |
| **Zero expos is not a rank.** A volunteer with no history is a **Newcomer**, level 0, medal `–`. | `BADGE_TIERS[0]`, `volLevel` | An unearned service label reads as an award. |
| **The level ladder tops out at 30 expos** (`EXPO_TOTAL`), and the tiers are spread across it. | `src/data.js`, `src/volunteer.js` | One level per expo served; the programme is 30 expos. |
| **A notification must never abort the change that caused it.** | `notify()` | A failed insert must not roll back a pledge. |
| **Unread personal data expires.** Readings without consent go after 7 days; everything goes 2 years after last visit. | `purge_expired_visitors()` | POPIA retention. |
| **Consent is a stored fact, not a checkbox.** `interests.optin` is read by the retention job. | `consent_is_old()` | The law, in one column. |
| **Deleting an account keeps the church's records.** | `delete_my_account` | The health record belongs to the church's event, not to a login. |
| **The app keeps exactly two timers.** | `main.js` + harness check | Every extra interval is battery on a weak phone. |
| **No runtime dependencies.** | `package.json` (devDependencies only) | Supply-chain surface and offline determinism. |
| **No inline event handlers.** | `src/actions.js` | The CSP forbids inline script; everything is `data-action`. |

---

## 5. Technical architecture

### 5.1 Shape

```
index.html  ── one self-contained page: markup, all CSS inline, CSP meta, font picker
   │
   ├── src/main.js ── imports every module in dependency order, boots, exposes __internals
   │       │
   │       ├── data.js        seed data, BADGE_TIERS, BOOTHS, STATIONS, live state arrays
   │       ├── state.js       localStorage persistence, cloud mode, migration
   │       ├── helpers.js     pure functions: esc, bmi, healthAge, cat, formatting
   │       ├── shell.js       nav, render loop, toast, theme
   │       ├── ui.js          HTML string builders (no DOM access)
   │       ├── visitor.js     the screening journey
   │       ├── results.js     results, plan, CSV export
   │       ├── volunteer.js   pledge/register/place/serve, badge maths, print card
   │       ├── queue.js       the station queue
   │       ├── account.js     account hub, church admin, platform admin, notifications, settings
   │       ├── churchPlans.js plans, follow-up people, invite links
   │       ├── cloud.js       Supabase client, auth, row mapping, sync UI
   │       ├── update.js      version check + update banner (PWA and APK)
   │       ├── feedback.js    toast tones + the confirmation sheet
   │       ├── overlay.js     overlay stack + Android Back
   │       ├── crash.js       uncaught-error card
   │       └── action-registry.js  every data-action name → its function
   │
   ├── sw.js ── offline shell: page, icons, pinned CDN libs; never caches Supabase
   └── supabase/schema.sql ── the entire backend: tables, RLS, RPCs, triggers, retention
```

Build: `node tools/build.js` → esbuild bundles `src/main.js` into one IIFE, inlines it into `index.html`, hashes
the result into a cache version, writes `dist/` with `_headers`, `version.json`, icons and (if present) the APK.

### 5.2 Data flow, and the three copies of the truth

```
   user taps
      ↓
   data-action → action-registry → module function
      ↓
   mutate the in-memory arrays (attendees / volunteers / queue)   ← the UI renders from these
      ↓
   persist()  →  localStorage  ("newstart.passport.v2")           ← the offline copy
      ↓
   cloudPush() → Supabase REST     (only rows whose signature changed)
```

- **The in-memory arrays are the render source.** `render()` re-renders whole screens from `state`.
- **localStorage is the offline truth.** It survives a closed tab and works with no signal.
- **Postgres is the shared truth.** When signed in, remote rows merge into the local arrays; conflicts resolve by
  signature comparison, and a placement refusal triggers a re-resolve rather than a data loss (`resolvePlacement`).
- **Realtime** streams row changes on `attendees`, `volunteers` and `notifications` so other desks see them live.

There is **no server-rendered HTML and no API layer of your own**. The client talks to Postgres through Supabase's
REST/RPC endpoints, and *only* through the SQL functions defined in `schema.sql`.

### 5.3 Offline and the service worker

`sw.js` precaches the page, the icons, the manifest and one pinned CDN library. It **never** caches Supabase
traffic — health data and tokens go straight to the network. The page is served network-first with a 4-second
cutoff and a cached fallback; own files are cache-first with a background refresh.

A new build installs **but does not activate** until the page asks (see §5.5). This is deliberate: a worker that
swaps itself under a running page leaves the open tab executing the old bundle.

### 5.4 The Android wrapper

`capacitor/` packages `dist/` into a WebView. `IS_APP` (`src/platform.js`) is true only there, and switches fonts to
the bundled copy, links to `APP_SITE` for emails, and routes the hardware Back key through `overlay.js`.

### 5.5 Updates

| Surface | Mechanism |
| :--- | :--- |
| Web / installed PWA | `tools/build.js` stamps `<meta name="app-version">` and writes `/version.json`. `src/update.js` compares them on open, on foreground, and on reconnect; a banner offers Update, which `postMessage`s `SKIP_WAITING` to the waiting worker and reloads on `controllerchange`. |
| Android APK | Same comparison; the page inside the APK was stamped when it was packaged, so a newer server build means a newer app. Update downloads `/newstart.apk`, which the host serves as an attachment. |

"Not now" is remembered per build, so the banner returns on the next release, not on the next screen.

---

## 6. Data model

Eleven tables, all in `public`, all row-level secured.

| Table | Purpose | Key relationships |
| :--- | :--- | :--- |
| `churches` | One event-owning organisation | `id` is the tenant key on almost everything |
| `memberships` | user ↔ church, with role and approval | → `auth.users`, → `churches`, → `volunteers`, → `attendees` |
| `platform_admins` | Cross-church operator | → `auth.users` |
| `volunteers` | The expo roster and each person's service history | → `churches` |
| `attendees` | Screening records | → `churches` |
| `queue_entries` | Station queues | → `churches` |
| `church_plans` | Counselling plans a church adopts | → `churches` |
| `church_invites` | Join links | → `churches` |
| `notifications` | The in-app inbox | → `churches`, → `auth.users` |
| `staff` | **Legacy.** Superseded by `memberships.role = 'staff'` | — |
| `audit_log` | Append-only record of sensitive writes | — |

### Sensitive fields to treat carefully

- `attendees`: name, phone, age, sex, readings (`sys`, `dia`, `sugar`, `chol`), `notes`, `interests` (consent).
- `volunteers`: name, phone, email, emergency contact, notes.
- `memberships`: full name, phone, area, birth date.

None of these are encrypted at the column level today. Phase 9 of the master security blueprint would put
high-risk fields behind application-level encryption; that has not been done and should be a conscious decision.

---

## 7. Security invariants

These are load-bearing. Break one and the app is no longer safe to run for a church.

1. **RLS on every table, plus column grants** where a user may update only part of a row (`grant update (read_at)`).
   RLS is row-level; only a column grant stops a recipient rewriting a message they received.
2. **`security definer` everywhere, with `set search_path = ''`.** Every function names its schema explicitly.
3. **No client writes except through RPCs.** There is no insert policy on `notifications`; there is none on
   `volunteers` for the placement columns.
4. **`service_role` never reaches the browser.** If it appears in a bundle, a log, or a Sentry event, treat it as an
   active incident. RLS is a defence against the anon key, not against that one.
5. **The CSP is enforced, not decorative.** Two inline scripts, each allowed by its own SHA-256; everything else is
   `'self'` or three pinned CDNs. `tools/build.js` fails the build if the meta tag drifts from `_headers`.
6. **`esc()` on every interpolated string.** Profiles are re-rendered into HTML on every tap.
7. **Android Back always has a way out.** Every sheet registers with `overlay.js`; a sheet that does not will trap
   the user (this was measured, not theorised — see the comment at the top of `overlay.js`).

---

## 8. Conventions

House style, visible throughout. Follow it and your change will look native.

- `// @ts-check` at the top of every module. `npm run typecheck` is real (23 files, `checkJs: true`).
- **Comments explain why, in prose.** Not `// increment i`. The voice is a colleague explaining a decision.
- **British/SA English**: "colour", "licence", "organisation". Dates render `en-ZA`.
- **Templates return strings; nothing touches the DOM from a builder.** `ui.js` is pure.
- **Every action is `data-action="name"`**, registered in `action-registry.js`. Field events use
  `data-on-input` / `data-on-change` so a select's change does not also fire on the click that opened it.
- **`esc()` every dynamic string.**
- **No new CSS classes.** The page ships a hand-written stylesheet and the harness fails the build on any class in
  the markup that is not defined in it. Style with existing utilities or inline `style`.
- **No new timers.** Two, and the harness counts them.
- **No new dependencies.** If you need a library, justify it in the PR.

### How to add a feature end to end

1. **Schema first.** Add the table/column and an RPC with `security definer`, `set search_path = ''`, an explicit
   authorization check, `revoke all`, and a targeted `grant execute`. Make it re-runnable (`create or replace`,
   `if not exists`).
2. **State.** Extend the record shape in `src/types.js`, the migration in `src/state.js` if the saved payload
   changes, and the row mapping in `src/cloud.js` if it syncs.
3. **Render.** Add a builder in the right module; use `esc()`; use only existing classes.
4. **Action.** Add the function, export it, add it to `ACTION_MAP`, and if it opens a sheet, register with
   `overlay.js`.
5. **Feedback.** Wrap the result in `ok()` / `warn()` from `src/feedback.js`; use `confirmAsk` before anything
   destructive or irreversible.
6. **Harness.** Add checks to `.smoke/harness.js`. The suite is the contract: 860 assertions, and it knows about
   timers, unregistered actions, and undefined CSS classes.
7. **Docs.** If it changes a workflow, update this file.

---

## 9. Verification

| Command | What it proves |
| :--- | :--- |
| `npm run typecheck` | `tsc --noEmit` over all 25 modules with `checkJs` |
| `npm run build` | esbuild bundle, CSP hash, cache version, `dist/`, `version.json`, `_headers` |
| `npm test` | 860 assertions in a jsdom sandbox: badge maths, booths, the journey, sync against a fake Supabase, auth, queue, screens, accessibility, and the app's own rules (timers, registered actions, CSS classes) |

The harness loads the built page and drives `__internals` — a deliberate seam that exposes ~250 functions. If you
rename or change the return shape of anything in that object, update `main.js` and the harness together.

---

## 10. Where things are, if you are looking for…

| Looking for | Go to |
| :--- | :--- |
| The health-age formula | `helpers.js` → `healthAge`, with the reference levels in the comment above it |
| Station list and capacities | `data.js` → `BOOTHS`, `STATION_DEFS` |
| The badge ladder | `data.js` → `BADGE_TIERS`, `EXPO_TOTAL`; maths in `volunteer.js` |
| The in-app inbox | `account.js` → `notifWatch`/`renderNotifs`; the table and triggers in `schema.sql` |
| Notification behaviour, in detail | `docs/notification-audit.md` |
| Who may move a volunteer | `schema.sql` → `volunteers_place_guard`, `can_place` |
| Retention rules | `schema.sql` → `purge_expired_visitors`, `consent_is_old`; `src/retention.js` |
| The design system | `docs/ui-contract.md`, `docs/ui-inventory.md`, `src/ui.js` |
| Crypto/sync conflict handling | `cloud.js` → `pushOne`, `resolveConflict`, `resolvePlacement` |
| Why a sheet traps Back | `src/overlay.js` (top comment) |

---

## 11. Known gaps

Honest list, current as of this document. None of these are secrets; all of them are decisions waiting to be made.

1. **No out-of-app notifications.** No push, email or SMS. A church admin learns about a pledge only when they open
   the app. See `docs/notification-audit.md` §4.
2. **No field-level encryption** on health data or ID-like fields. Disk encryption at Supabase is the only layer.
3. **No automated deployment.** `dist/` is built and uploaded; there is no CI pipeline, no SBOM, and no dependency
   scanning (there are no runtime dependencies, which mitigates the last one).
4. **`staff` table is legacy** and still exists alongside `memberships.role`. Do not build on it.
5. **The harness is the only test suite.** There is no unit-test layer below it; a failing assertion is often the
   first signal, and debugging means reading the sandbox.
6. **Comments are the documentation.** This file is the first attempt at a map; if it drifts, fix it in the same PR
   that changed the behaviour.

---

*Last updated with: 30-expo badge recalibration, the Settings/commitments panel, the update workflow, the
confirmation-sheet feedback layer, and admin notifications on register/deregister/unpledge.*
