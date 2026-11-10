# State machines in the app — inventory and recommendation, 2026-11-10

Read from the working tree on `main` (HEAD `0bcdf3e`, with 18 uncommitted files). Code reading only: no source file
was changed and no test was run for this document. Line numbers are from this session's reads. Anything marked
**VERIFY** was not read.

An "implicit state machine" here means a flow whose current state is spread over several flags or string values, with
no single place that names the states or says which moves are allowed.

## The recommendation

**Make the app's own two good patterns the rule for every machine. No state library, no rewrite.**

The app already contains both patterns, and the machines that use them are the ones without bug-fix scars:

1. **Derive, do not store.** `gateState()` (src/cloud.js:240-253) computes the gate's state from the facts each time
   it is asked. Nothing can leave a stale "gate state" behind.
2. **One guarded writer.** `qMove(id,to,from)` (src/queue.js:505-520) is the only way a queue entry changes status,
   it names the states it may move from, and the server applies the same list (`.in('status',from)`, queue.js:516).

The rule, per machine: one stored value or one pure derive function; one writer function that names the allowed
"from" states; one row in this file; one entry in a debug snapshot.

| For | What it gives |
|---|---|
| Users | Fewer stuck screens. The code's own comment at account.js:1593-1594 describes the failure this prevents: the status line hanging at "Syncing…" for a whole session. |
| Developers | One place to read per flow, instead of following 10 or more flags through a 2,159-line file. |
| Agents | A table to check a change against, and one snapshot call to assert on in the harness instead of inferring state from the DOM. |

### Steps, smallest and safest first (none applied)

| # | Step | Files | Why it is safe |
|---|---|---|---|
| 1 | Pin `gateState()` with a truth-table test: set the input flags, assert the returned state, one row per branch | `.smoke/harness.js` only (it already lists `gateState`, harness.js:44) | No source change. It freezes today's behaviour before anything moves. |
| 2 | Extract `orphanPass()` for the reset that is copy-pasted three times (account.js:1595, 1613, 1662). All three sites also bump `cloud.gen` (1592, 1613, 1662), so the function can do both | `src/account.js` | Same statements, one name. Step 1 and the existing sync checks cover it. |
| 3 | Add `stateSnapshot()` to the dev-only internals (src/main.js:79): `{gate, status, phase, busy, queued, acct, live, queue}` built from the existing getters | `src/main.js`, harness | Read-only, and not shipped: internals exist only in a dev build (main.js:80-84). |
| 4 | Build the sign-out reset from one defaults object instead of the hand-written field list (account.js:1666-1673) | `src/state.js`, `src/account.js` | **Only after the bug audit** settles which of the 35 untouched fields must survive (see M5). `client` and `gen` must. |
| 5 | In dev builds only, have `setCloud()` log a move that is not in an allowed-moves table. Never block in production | `src/cloud.js` | Logging only. It finds illegal moves without changing behaviour. |

Steps 1 to 3 are worth doing on their own. Steps 4 and 5 depend on the audit.

## Inventory

Risk is my judgement from the reading, not a measurement.

| # | Machine | States | Where the state lives | Writers | Pattern today | Risk |
|---|---|---|---|---|---|---|
| M1 | Sign-in gate | `hidden`, `newpass`, `error`, `loading`, `unavailable`, `form` or the `cloud.view` name, `connecting`, plus M2's values | Derived by `gateState()` (cloud.js:240-253) from 11 inputs: `NEWSTART_NO_CLOUD`, `recovery`, `user`, `pending`, `gateHide`, `ready`, `demo`, `gateForce`, `status`, `client`, `view` | The inputs are written in many places in account.js and cloud.js | Derived (good), no test table | Medium |
| M2 | Account access | `church`, `suspended`, `churchwait`, `pending`, `member`, or `''` with no account | Derived by `acctGate()` (account.js:115-123) from the server's account row | `loadAccount()` (account.js:76-112) | Derived (good) | Low |
| M3 | Cloud connection | 8 values: `off`, `unavailable`, `loading`, `signedout`, `syncing`, `online`, `offline`, `error` (`CLOUD_UI`, cloud.js:136-145) | `cloud.status` | One writer, `setCloud()` (cloud.js:194-200). Called with a literal from 13 places in account.js and 1 in main.js, plus a computed call at account.js:1565 | Single writer (good), any move allowed | Medium |
| M4 | Sync pass | idle, pulling, pushing, "run again" queued in 3 kinds, blocked, orphaned | `cloud.busy`, `again`, `againManual`, `againPull`, `phase`, `gen`, `blocked`, `starting` (state.js:10-14) | `cloudSync()` (account.js:1704-1779), `cloudPush()` (2058-2071), `cloudError()` (to 1703), and three reset sites | **Implicit.** 8 fields, the same 4-flag reset in 3 places, each added by a separate fix (comments H3, H4, E1) | **High** |
| M5 | Session | no client, signed out, signed in, recovery, signing out, demo | `cloud.client`, `user`, `mode`, `ready`, `demo`, `recovery`, `signingOut`, `signOutAsk` | `cloudInit()` (1559-1572), `cloudAuthEvent()` (1582-1620), `cloudSignOut()` (1650-1678) | **Implicit.** Sign-out resets fields by hand | **High** |
| M6 | Live updates channel | Supabase's own strings, `''` when stopped | `cloud.liveSt`, `channel`, `liveChurch` | `startRealtime`, `stopRealtime`, `pauseRealtime` (account.js:2074-2112) | Three named functions (fair) | Medium |
| M7 | Queue entry | `waiting`, `serving`, `done`, `left` (queue.js:69) | `e.status` on each entry | `qMove()` only (queue.js:505-520) for moves; `qApply()` for server rows | **Explicit. This is the model.** | Low |
| M8 | Queue connection | not ready, ready, error, syncing, saving, subscribed | `qs.ready`, `err`, `syncing`, `busy`, `rt`, `subbed` (queue.js:41) | `qRun` (452), the sync at 1004-1034, channel code at 1057-1088 | Implicit, but small and reset in one place (1088) | Medium |
| M9 | Volunteer status | `prospect`, `registered`, `checkedin` (data.js:95-99) | `v.status` **and** a second boolean `v.checkedIn` | Client: volunteer.js:914-915. Check-in arrives from the server (cloud.js:64, account.js:1946) | **Two fields for one fact.** `checkedInToday` accepts either (volunteer.js:42). Migration sets the boolean from the status, not the reverse (state.js `migrateVolunteer`) | Medium |
| M10 | Church and membership | church: `pending`, `active`, `suspended`; membership: `pending`, `approved`; roles | Server rows, read at account.js:70, 112, 119-121 | Database functions in `supabase/schema.sql` (**VERIFY**: not read) | Server-owned | VERIFY |
| M11 | App update | no update, offered, snoozed, reloading | Module variables `server`, `waiting`, `reloading`, `snoozed` (update.js:26-31) plus the worker's own lifecycle | `watchWorker`, `offer`, `updateNow`, `updateLater` (update.js:69-179) | Implicit, contained in one 187-line file | Low to medium |
| M12 | Screens and sheets | tab, visitor or volunteer mode, open sheets | `state.tab`, `switchMode`, `volTab`, `regOpen`, `volOpen`, `volRegOpen`, `logOpen`, `volNew`, `protocol`, `tfMode` (data.js:19-25) | Direct assignments in visitor.js and volunteer.js | Independent booleans. Whether two sheets can be open together: **VERIFY** | Low to medium |
| M13 | In-flight locks | free, busy | `planSaving` (churchPlans.js:22), `cloud.pledgeBusy`, `myTeamBusy`, `swapBusy`, `expoBusy`, `expoSaving`, `qs.busy`, `qs.editBusy`, `leaving` (queue.js:674) | One per feature | Nine separate two-state machines. Whether each is released on every exit path: **VERIFY** (only `qRun` was read, and it uses `finally`) | Medium |
| M14 | Boot | secure store ready, app booted, client starting | `window.__secureReady`, `__bootApp` (MODULE_MAP.md boot order), `cloud.starting` (account.js:1560-1571) | index.html inline script, `cloudInit` | **VERIFY**: the inline script was not read | VERIFY |

### Two findings to hand to the audit (candidates, not confirmed bugs)

- **M5, fields that outlive a sign-out.** Of the 83 top-level fields on `cloud`, 35 are not assigned inside
  `cloudSignOut` (measured with a script this session). Some are cleared elsewhere (`notifStop`, account.js:686-690;
  `loadAccount`, account.js:93-94) and some must survive (`client`). Not checked for the next person on a shared desk:
  `acctTab`, `wants`, `wantsBooths`, `notifs`, `notifOpen`, `signInWaitUntil`, `resendAt`, `swapBusy`, `expoBusy`,
  `expoSaving`, `removing`, `pledgeBusy`, `myTeamBusy`, `pledgeErr`, `pledgeNetErr`.
- **M9, status and boolean can disagree.** A row with `checkedIn:true` and `status:'registered'` counts as checked in
  for `checkedInToday` but shows the Deregister wording for a registered volunteer (volunteer.js:449-451 tests the
  status only). Whether the server can produce that row: **VERIFY**.

### Not read this session

The check flow in `src/visitor.js`, `src/results.js`, `src/customPlan.js`, `src/help.js`, `sw.js`,
`tutorial/tour.js`, `landing/`, the inline scripts in `index.html`, and `supabase/schema.sql`. Machines in those files
are not in the table above.
