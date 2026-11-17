# Friction review — UI, infrastructure and complexity, 2026-11-17

Read-only review of `main` at `7c42742` (Android 1.7.4, site version `67a8fb5803`). Nothing in the app was changed.
Evidence: one walk through the live site in practice mode at phone size (375×812), source greps, a complexity
measurement, git history, and one timed `npm test`. Recommendations are my judgement; facts are cited.

## 1. Cyclomatic complexity

Measured per function with a McCabe count: 1, plus one for each `if`, `?:`, `case`, loop, `catch`, `&&`, `||` and
`??`. Nested functions are counted on their own. Files: `src/*.js`, `sw.js`, `nsmem.js`, `tutorial/tour.js`.

| Band | Functions | Share |
|---|---|---|
| 1–10 (simple) | 1,852 | 93% |
| 11–20 (moderate) | 102 | 5% |
| 21–50 (complex) | 31 | 1.6% |
| 51+ (very complex) | 2 | 0.1% |

1,987 functions, **median 2**. The code is mostly small functions; the risk sits in a short list.

**The ten highest**

| CC | Lines | Function | What drives it |
|---|---|---|---|
| 68 | 24 | `cat` (`src/helpers.js:36`) | Every health threshold for 14 measures, written as `if` chains in one `switch` |
| 63 | 123 | `renderGate` (`src/cloud.js:302`) | One function decides and draws every sign-in screen |
| 50 | 22 | `memberRow` (`src/account.js:1003`) | Template with role, rank and request conditions inline |
| 45 | 53 | `queueSync` (`src/queue.js:1005`) | Load, paging, session checks, and four error kinds |
| 42 | 42 | `loadAccount` (`src/account.js:76`) | Account read, invite join, draft keeping, legacy fallback |
| 42 | 76 | `cloudSync` (`src/account.js:1723`) | The whole sync pass |
| 40 | 31 | `problemOf` (`src/results.js:249`) | Wording per problem area |
| 35 | 31 | `churchAdminHTML` (`src/account.js:970`) | Template |
| 35 | 132 | `viewHome` (`src/visitor.js:157`) | Home screen |
| 34 | 35 | `migrateAttendee` (`src/state.js:68`) | Field-by-field cleaning of untrusted rows |

**By file:** `src/account.js` holds 359 functions with a total complexity of 1,880, a third of the app, and 12 of the
33 functions above 20. Next are `queue.js` (982) and `volunteer.js` (759).

**What would actually lower it**
- `cat` and `problemOf`: turn the thresholds and wording into a data table (measure → bands) read by one small
  function. This also makes the clinical cut-offs reviewable in one place. Low risk; `cat` is fully covered by the
  harness.
- `renderGate`: split "which screen" (already `gateState()`, now pinned by a truth table) from "draw that screen", one
  small function per screen.
- `account.js`: split by job (session, sync, account hub, expos, pledges). It is 2,200 lines with five owners' worth of
  logic; most of the second-round audit bugs were in it.
- Leave the templates (`memberRow`, `churchAdminHTML`, `viewHome`) unless they change. Their branches are display
  conditions, not logic that can go wrong silently.

## 2. UI friction

### Seen on the live site (practice mode, phone size)

| # | What happens | Why it is friction |
|---|---|---|
| U1 | After **Register & start the checks**, the screen shows the same fact three times at once: a chip "In line at Blood Pressure · 2 of 2", a card "In line at Blood Pressure … Start at Blood Pressure", and a toast "…in the Blood Pressure line (2 waiting)". The toast sits over the card's button. | Three messages to read, one of them covering a control |
| U2 | While typing the first blood-pressure reading, a modal asks **"Start Blood Pressure for Test? … Start serving them here now?"** (`qStartAsk`, called from `visitor.js:975` on every saved reading). | The volunteer is already taking the reading. The question interrupts data entry, and the obvious answer is always Yes |
| U3 | On the check screen there are three forward buttons visible together: **Next →**, **Start at Blood Pressure** and **Next: Results →**. | Unclear which one is the main path |
| U4 | The button says **All 8 checks** but opens 14 items (the 8 checks plus Waist, Body fat, Body water, Lung function, Fitness and others). | The label and the content disagree; the help text explains it (`help.js:165`), but nobody reads help mid-visit |
| U5 | The registration form puts the submit button below the consent box, and the consent requirement is only explained after a failed tap ("Ask the consent question and tick Yes…"). | One wasted tap per new volunteer until they learn it |
| U6 | The practice home opens with a tour offer card on top of the first task. | Fine once; it returns for every practice session (not checked how often) |

The walk covered the sign-in screen, practice home, registration and the first check only. Results, Plan, Send,
Queue, Care, Team and Profile were not walked this time.

### From the source

| Measure | Count | Note |
|---|---|---|
| `confirmAsk` (a yes/no sheet) | 29 | Each one stops the flow. Worth a pass to keep only the ones guarding loss or sending |
| `toast(` | 161 | A lot of feedback that disappears. About 50 of them announce success ("✓", "saved", "added") |
| `toastUndo(` | 9 | The better pattern for reversible actions: act now, offer Undo |
| Distinct `data-action` names | 191 | A large surface for one app |
| Header icon buttons | 5 | Visitor switcher, theme, help, cloud, notifications |
| Bottom tabs | 6 | Home, Visitor, Queue, Care, Team, Profile |

**Recommendations, smallest first**
1. **U2:** don't ask. When a reading is saved for someone waiting in that line, start them and show "Started at
   Blood Pressure · Undo" (the app already has `toastUndo`). One fewer modal per visitor per station.
2. **U1:** after registering, keep the card, drop the toast, or make the toast say only "EXPO-118 registered".
3. **U3:** one primary button per screen. On the check screen it is **Next →**; the other two become text links.
4. **U4:** rename to "All checks (14)" or "8 checks + extra measures".
5. **U5:** show the consent line as the first thing in the form's required area, or disable the submit button with
   the reason under it until consent is ticked.
6. Review the 29 confirmations: convert the reversible ones to act-then-Undo.

## 3. Infrastructure friction

| # | Friction | Evidence | Cost |
|---|---|---|---|
| I1 | **Built output and the APK are committed to git.** | 135 of 176 commits touch `dist/`; 62 versions of `dist/newstart.apk` are in history, taking about 73 MiB of the repository's 117 MiB (pack plus loose objects) | Every release adds about 3.5 MB to every clone, forever. Every change needs a second "Rebuild dist" commit |
| I2 | **Running the tests changes the tree.** | `npm test` rebuilds `dist/` (it runs `tools/build.js`); after one clean run `dist/version.json` was modified | A clean checkout is dirty after testing; easy to commit by accident |
| I3 | **The build deletes `dist/` before it checks the CSP hash.** | `tools/build.js:13` empties `dist/`; the CSP check that can fail is at `tools/build.js:112` | A failed build leaves no site to deploy. It happened on 2026-11-10 |
| I4 | **The CSP hash of inline scripts is kept by hand.** | Editing the secure-store script required pasting a new hash into `index.html`; the landing page has its own `make-headers.js` for the same job | One manual step per edit, in two places |
| I5 | **Deploying depends on a tool that is not in the project.** | Wrangler is not in `node_modules`; `npx --no-install wrangler` refused on 2026-11-10 and 2026-11-12; a cached copy in the npm cache was used | Deploys break when the cache is cleaned |
| I6 | **Two sites, two deploys.** | App: `wrangler.jsonc` → `dist/`; landing: `landing/wrangler.jsonc` | Easy to ship one and forget the other (it happened on 2026-11-10) |
| I7 | **The database is changed by pasting `schema.sql` (3,225 lines) into the Supabase SQL editor.** | `supabase/README.md`; no migration history | No record of which version the live database runs, except by querying it, as was done on 2026-11-17 |
| I8 | **The Android release is a manual chain.** | Bump `build.gradle` by hand → `sign-app.ps1` → `npm run build` again (the script builds before it signs, so `dist/` gets the previous APK) → commit → deploy | Four steps that must happen in order, every release |
| I9 | **No CI.** | No `.github/` folder; `context.md:384` says "No automated deployment" | Tests run only when someone remembers |
| I10 | **Two test suites need a local database folder.** | `npm run test:hub` and `test:db` skip without `NEWSTART_PGLITE` | They are silently not run on a machine without it |
| I11 | **Plans and reports pile up in the root.** | 34 `.md` files in the root, 12 `fix-plan*` folders | Hard to see what is current |

**Fixed the same day:** I2 (tests build into a temporary folder), I3 (the build checks everything before it replaces
`dist/`), I4 for the app (the build writes the CSP meta tag itself; the landing page already had `make-headers.js`),
I5 (`wrangler` 4.159.0 is a dev dependency; `npm run deploy`, `npm run deploy:landing`), I6 and I8 (`npm run release`,
with `-Android` for a new app: see `tools/release.ps1`).

**Then, also on 2026-11-17:**
- **I1:** `dist/` is no longer in git (ignored, removed from the index; history unchanged). `npm run release` builds and
  deploys from the folder; `-Android` puts the APK on a GitHub Release (1.7.4 is `v1.7.4`).
- **I7:** `supabase/migrations/` with the 2026-11-13 baseline and one migration; `public.schema_migrations` records
  which have run. `npm test` runs each migration twice in PGlite and checks `schema.sql` lists them all. Applying is
  still a paste into the SQL editor (the Supabase CLI was not set up).
- **I9:** `.github/workflows/test.yml` runs `npm test`, typecheck, the build and its checks, `test:hub` and `test:db` on
  every push. Its first runs found three timing-dependent checks and one leftover read of `dist/`; all are fixed.
- **I10:** PGlite 0.5.11 is a pinned dev dependency, so the database suites always run (107 + 51 checks, plus the
  harness's database sections); a missing install now fails instead of skipping.
- **I11:** 39 finished plans, reviews and gates moved to `docs/archive/`.
- **U1–U5** fixed as recommended below (U2: a typed reading starts the visitor with Undo; U4: "Whole record on one
  screen"); each has a harness check and was looked at in the browser at phone size. Of the 26 `confirmAsk` calls,
  only *Remove custom plan* was reversible on the phone; it now acts with Undo. The others guard a server change,
  a deletion or a sign-out.
- **Complexity:** `cat` (68) and `problemOf` (40) are now data tables read by small functions. Their output is identical
  to the old code over 5,658 and 44,000 input combinations. Functions above 50 went from 2 to 1 (`renderGate`).
  `account.js` was not split.

`npm test` takes 90 s and passes (1,607 checks). That is acceptable; it is not a friction point.

**Recommendations, in the order I would do them**
1. **I3 + I4:** make `tools/build.js` compute and write the CSP hash into `index.html` itself (as `landing/make-headers.js`
   already does), and run its checks before emptying `dist/`. Removes a manual step and the empty-`dist` trap. Small.
2. **I5:** add `wrangler` as a dev dependency and `"deploy"` / `"deploy:landing"` scripts in `package.json`. Small.
3. **I8:** one `release` script: bump the version, sign, rebuild, run the build checks, then deploy both sites. Small to
   medium; the pieces exist.
4. **I2:** have the harness build into a temporary folder instead of `dist/`. Small.
5. **I1:** stop committing `dist/` and the APK; build and deploy from source (Cloudflare can build on push), and keep
   the APK as a release asset. Medium; it changes how releases work, so it is your call.
6. **I9 + I10:** a GitHub Actions job that runs `npm test`, `typecheck`, `test:build`, and the PGlite suites on every
   push. Medium.
7. **I7:** move to dated migration files applied with the Supabase CLI. Medium; also your call.
8. **I11:** move finished plans and audits into `docs/archive/`. Small.

## Not covered

- Screens beyond registration and the first check, and anything signed in.
- The Android app's UI (only its start was checked, on 2026-11-10).
- Performance and load times.
- Accessibility beyond the labels the walk touched (the consent checkboxes are correctly labelled).
