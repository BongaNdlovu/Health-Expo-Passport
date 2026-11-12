# BUG REVIEW — FULL AUDIT — 2026-11-12

Repo: `Health Expo` @ `main` (working tree, uncommitted changes included). Lead: ZCode (GLM-5.3) with three
delegate reviewers (account/cloud, core-shell/persistence, data/plans) and orchestrator re-verification of
every finding kept below. Every claim marked VERIFIED was traced or executed in this session; anything that
did not survive re-reading was dropped.

**Re-verification pass (second sweep).** Every finding below was re-checked against the source, not just the
first report: P0-1 was re-proven end-to-end by executing the app's real `migrateAttendee` + `attToRow` +
`sigOf` functions through the full upload→restart→ledger→re-upload sequence (see §1); a sweep of **every**
interests key the app writes (data.js constants, dynamic writes, `skip`+station keys) confirmed
`customPlan` is the *only* key the mapper strips; P2-1 was re-read and is *stronger* than first reported (the
admin's own Church screen renders the cache without re-fetching too — only this desk's save/delete refresh);
P3-1/P3-2/P3-3, BUG-A and BUG-B were confirmed by direct reads of `pushDirty`/`pushOne`/`resolvePlacement`/
`pruneRemote`/`cloudSignOut`/`saveSynced` and the secureStore inline script (`S.getItem` reads `mem`;
`_ledgerSig=h` is set before the async disk write). Two suspected findings were dropped during verification:
the `exFreq>=2` "move plan" guard (survey scale is 1–3 with 1 = "5+ times a week", so the guard is correct)
and a queue.js incremental-retry gap (realtime resubscribe re-syncs by design).

## 0 · Baseline

| Check | Result |
| --- | --- |
| `npm test` (smoke suite) | **1561 / 1561 PASS** |
| `npm run typecheck` | clean |
| CSP hashes | `index.html` meta hashes match its two inline scripts; landing `_headers` hash matches its one inline script (computed, not eyeballed) |
| `dist/` freshness | genuine build of the current tree: `8af02480b9` agrees across `dist/version.json`, the page stamped inside `dist/newstart.apk`, and gradle 1.7.1 / versionCode 47; the third CSP hash in `dist/_headers` is the build-injected bundle hash (`CSP_DIST` in tools/build.js) |
| Uncommitted schema index drops | every dropped global index is superseded for all client query patterns by church-led indexes (attendees/volunteers/queue_entries pull paths checked against `src/account.js`, `src/queue.js`); the purge queries match the kept/partial indexes (`audit_log_kept_copies_idx` predicate matches the `old = null` sweep) |
| `sw.js` `cache: 'reload'` install | correct; harness assertion (`swInstallModes`) tests the right thing and Node 24's `Request` carries the `cache` init |
| `landing/range-worker.js` video cache | correct: 416 paths, suffix ranges, HEAD, end-clamping, ASSETS-206 pass-through (never caches a partial), failed read forgotten |
| `state.js` near-full threshold | math checks out (3.1 M plain chars vs ~3.9 M failure point, ~9,000 visitors) and the toast matches the code |

### Status of the 2026-11-02 audit's bugs

- **BUG-A (refused row deleted at full sync)** — **FIXED**, with harness regressions (TST-BUG-A1/A2/A3, FUP-M5-1). `pruneRemote`/`mergeRemote` keep never-uploaded rows and treat refused rows as pending (account.js:1848–1882).
- **BUG-B (Sign out skips unsaved-changes warning)** — **FIXED**. All sign-out paths route through the registry adapter; `cloudSignOut` counts `cloudPending()+refused` and warns; `force=true` only after server-side account deletion (account.js:1650–1663, action-registry.js:134).
- **BUG-C (saving a placed volunteer rewrites booth=pref[0])** — **FIXED**. Edit path now `v.booth=v.booth||d.pref[0]` (volunteer.js:914) and plain staff/other-station leaders cannot touch `booth` at all (guard at :913); new-row placement matches the place-guard rules.

---

## 1 · Findings

### P0-1 · A custom plan is destroyed on every app restart, and the next edit clobbers the server copy — `src/state.js:72–74`

`migrateAttendee`'s interests whitelist keeps lowercase keys (≤12 chars, as booleans) plus exactly two string
entries, `churchPlan` and `followUp`:

```js
const it=a.interests,keep=Object.fromEntries(Object.keys(it).filter(k=>/^[a-z]{1,12}$/.test(k)).map(k=>[k,!!it[k]]));
for(const k of ['churchPlan','followUp'])if(typeof it[k]==='string'&&/^[A-Za-z0-9-]{1,64}$/.test(it[k]))keep[k]=it[k];
```

`customPlan` is an object with an uppercase P and is not in the whitelist, so it is stripped. **Verified
empirically** by running the real function: input keys `nurse,cook,consent,optin,consentOn,customPlan,churchPlan,followUp,followUpName`
→ output keeps everything **except `customPlan`**. A sweep of every interests key the app writes anywhere
(data.js seminar/heard/interest constants, dynamic writes, `skip`+station keys) confirms `customPlan` is the
**only** stripped key — no other victim of the same bug exists today.

**End-to-end proof (executed, second sweep)** — the app's real `migrateAttendee`, `attToRow` and `sigOf`
functions were run through the actual sequence:

```
(1) customPlanSave mutates the live row → attToRow verbatim → server interests:
    consent,optin,consentOn,customPlan        ✓ plan reaches the server
    ledger records sig = sigOf(row WITH plan)
(2) restart → loadPersisted → migrateAttendee → local interests:
    consent,optin,consentOn                   ✗ plan stripped
(3) loadSynced() at boot (main.js:42) restores the ledger from SYNC_KEY;
    isDirty: sig(without plan) ≠ ledger sig(with plan) → YES, row is dirty
(4) pushDirty re-upload payload interests: {"consent":true,"optin":true,"consentOn":"2026-11-12"}
    → overwrites the server copy that still held the plan
```

Why this is a P0 and not a P3:

1. `migrateAttendee` runs on **every** `loadPersisted()` (restart) **and** on **every server row** — `rowToAtt`
   (cloud.js:51) is `migrateAttendee(...)`. So the plan is lost not just on restart but on any full pull or
   realtime replacement of the row.
2. The upload path (`attToRow`, cloud.js:43) serialises `interests` verbatim, so the plan *does* reach the
   server while the writing device still holds it in memory. After that device restarts, its local copy is
   plan-less; the signature now differs from the sync ledger → the row is dirty → the next `pushDirty`
   re-uploads plan-less interests.
3. Server-side, `attendees_custom_plan_guard` (schema.sql:2632) only judges *changed* plans. A non-admin's
   plan-stripping re-upload is refused (row parked as "refused" — safe). But custom plans may only be written
   by **admins / the app owner** (`canCustomPlan`), and for them the guard passes: **the admin's own device
   destroys the plan it wrote**, for every desk, on the first sync after a restart.

Trigger: admin writes a custom plan → app restarts overnight → any edit to that visitor (or the dirty
re-push) → plan gone locally and on the server. The feature survives at most one session on the device that
wrote it. The smoke suite passes because its custom-plan tests (harness ~1587–1683) set the plan in memory and
never reload — 1561 green checks while the bug exists.

Fix direction: carry `customPlan` through `migrateAttendee` (validate shape/lengths as the guard does, or at
minimum `typeof it.customPlan==='object'` → keep), and add a harness check that saves, reloads
(`loadPersisted`) and asserts the plan survives. Note `migrateAttendee` also guards against untrusted
server JSON, so validate rather than pass-through verbatim.

### P2-1 · Church plans are fetched once and never refreshed — `src/churchPlans.js:43–45, 63–64, 157–162`

`churchPlanList()` restores `cloud.plans` from localStorage on boot, and the fetch fires only when
`!cloud.plans || cloud.plans.cid!==cid`. A cid match means **no fetch, this session or any future one** — the
only refreshes are a save/delete on this desk or sign-out. **On re-verification this is stronger than first
reported**: `churchPlansBox` (the admin's own Church screen, :157–162) also renders the cached list whenever
`cloud[key]` matches the cid and only calls `loadChurchPlans` on a cache miss — so not even the admin's
screen refreshes. Attendees and volunteers re-pull every 10 minutes; church plans never do. VERIFIED by
reading all three call sites.

Trigger: co-admin corrects a plan's safety note (or adds a plan); every other desk — even online, even
freshly restarted — keeps showing and sending the old version indefinitely, on the Plan picker, the Church
screen, WhatsApp and the printed card.

### P2-2 · A church plan for a custom problem omits the crisis help line even when the visitor's protocol is sleep/mind — `src/churchPlans.js:78` vs `:93`

`churchPlanFor`: `help:['sleep','mind'].includes(cp.problem)?HELP_LINE:''` tests the **plan's** problem key.
`customPlanFor` resolves the identical situation correctly through
`base=PROTOCOLS[cp.problem]?cp.problem:autoProtocol(a)`. For a church plan whose problem is free text
(e.g. "Joint pain") sent to a visitor whose readings generate the sleep or mind protocol, the SADAG/Lifeline
block is dropped from all four surfaces (Plan screen, volunteer card, WhatsApp, A6 card). The modules' own
headers state the help line "always comes with" a plan for sleep and stress. VERIFIED by reading both
functions side by side.

### P2-3 · A failed encrypted save is never retried, and a reload silently reverts to the stale disk copy — `index.html` (secureStore) + `src/state.js:41`

The secure store's `setItem` puts the plaintext into `mem` synchronously, then encrypts/writes async; on
failure it now dispatches `securestore:writefail`. But `persistNow`'s new early-return compares against
`localStorage.getItem` — which reads `mem`. After a failed write, `mem` holds the new value, so every later
save with unchanged content (including the `pagehide`/`visibilitychange` flushes) returns early and the disk
write is never retried; on reload, boot decrypts only what is on disk and the delta is gone. One toast (via
`storageFull`) is the entire signal. VERIFIED by trace. Context: the old hash-based compare had the same
skip-after-async-failure semantics, so this is a pre-existing design made observable by the new event, not a
regression — and signed-in desks are protected because `cloudQueuePush()` still runs after the failed
`setItem`, so the cloud copy has the data. Signed-out/practice devices near the quota are exposed.

### P3 findings (real, minor)

- **P3-1 · One poison row blocks every later upload forever** — `src/account.js:1936`. `pushOne` throws on any
  error that is not 23505 / 22x–23x / place-refusal; the push loop aborts at that row and re-runs in the same
  order next pass, so every dirty row after it never reaches other desks while the status says "Sync hit a
  problem. It retries by itself." Trigger: a trigger/proxy returning a persistent P0xxx-class error for one
  row's content.
- **P3-2 · A transient network failure inside `resolvePlacement` parks an edit as permanently "refused by the
  database"** — `src/account.js:1931–49`. `resolvePlacement` returns `false` both for "no row" and for "the
  read failed"; the failure is then classified as a hard refusal (`cloud.rejected[o.id]=s`), so it never
  retries automatically and the Cloud status wording contradicts the cause.
- **P3-3 · Sync-ledger and quarantine write failures are silent** — `src/cloud.js` `saveSynced`'s `catch` is
  dead code under the secure store (setItem never throws), and the `securestore:writefail` listener
  (state.js:46) matches only the passport key. A failed ledger write (`SYNC_KEY`) also sets `_ledgerSig`
  first, so identical later saves skip the write; after a reload the device runs on a stale ledger (spurious
  re-uploads, reliance on the E4 dedupe). Same gap for `QUAR_KEY` in `quarantineKeep` — its "kept on this
  phone" toast can be false.
- **P3-4 · False privacy statement on the pledge form** — `src/volunteer.js:856`:
  "Stored on this device only. Nothing is sent anywhere." is shown unconditionally, but for a signed-in desk
  the volunteer row uploads to the church's shared database (~1 s later). help.js:65 says exactly that.
  Should be conditional on `cloud.mode`/practice, or reworded.
- **P3-5 · `makeInvite` has no in-flight guard** — `src/churchPlans.js:350`. A double-tap mints several live
  30-day invite codes and shows only the last (compare `saveChurchPlan`'s `planSaving`, E10). Server caps at
  50/day, but unseen valid links lingering is poor hygiene for an approval feature.
- **P3-6 · Update banner can offer an update whose button silently does nothing** — `src/update.js`.
  `serverVersion()` falls back to `server.version` when `version.json` has no `apk` block, so `offer()` shows
  the banner; but `updateNow()`'s IS_APP path requires `server.apk.url` and otherwise bare-`return`s — no
  toast, no fallback. Needs a legacy server file; current `dist/version.json` always carries `apk`.
- **P3-7 · The source page boots without waiting for the secure store** — `index.html:2019` loads
  `src/main.js` directly; on an origin holding a saved passport, `loadPersisted` reads still-encrypted
  ciphertext, returns false, and the first debounced `persist()` from render writes SEED data over the real
  saved copy. Dev/repo-root serving only — the built page (and the APK) gates on `__bootApp` (tools/build.js:27).
- **P3-8 · A signed-out device whose saved copy is legitimately empty reboots into demo visitors** —
  `state.js:121` returns false for an empty non-cloud copy; `hasSavedCopy()` suppresses the explicit
  `seedDemo()` but `attendees` is already the SEED default from data.js, so three demo visitors appear and
  the next persist replaces the empty copy with the seed payload. Breaks the stated D2/M10 invariant through
  the back door (no real data lost — the copy was empty).
- **P3-9 · A single "how" step longer than 200 chars is silently truncated** — `src/customPlan.js:67–68`:
  validation caps the *total* how text at 400 (the textarea's maxlength), then each item is sliced to 200
  with no message, on save and on template import.

---

## 2 · Verified sound (no findings)

**Sync engine (account.js/cloud.js)**: retry jitter (`retryIn`, 20–35 s / 60–75 s, single timer, cleared on
sign-out); `allIds` pagination (inclusive 1000-row ranges, termination on short/exact pages), `maxNum` loop
(vs spread overflow), renumber escalates monotonically; E4 lost-response dedupe; push batching with
per-row fallback; generation discipline (E1/H3–H5) around every await; realtime echo suppression and
re-verification of unfiltered deletes; church lifecycle (adopt/drop/quarantine/restore/export); 429 cooldown,
enumeration-safe auth screens; applyRetention gating. `npm run typecheck` clean.

**Queue (queue.js)**: every state transition guards (`qGate`, `qRun`, `qCan`); `queue_call_next`
`for update skip locked`; timer discipline incl. today's jitter change; leave-list merge (Q2) incl.
mid-flush re-adds; realtime delete-by-id rationale; stations sheet save path.

**Results/exports (results.js)**: plan priority (custom > church > generated) with one `planFor` for all
surfaces; `planNeeds` ranking (the `exFreq>=2` guard is correct — the survey scale is 1–3 with 1 = "5+
times a week"); CSV formula defusing; hand-built XLSX zip byte layout verified (local/central headers, EOCD,
UTF-8 flag, stored method); per-file save guards (R4).

**Visitors (visitor.js)**: consent gating (POPIA) before any check; past-visit no-new-readings gate; reading
validation (V6 never rewrites a wrong value; comma decimals; cross-check dia<sys); duplicate detection;
badge exhaustion (EXPO-9999, D3); `finishVisit` order (passport saved before queue leaves).

**Volunteers (volunteer.js)**: placement board all through RPCs with full re-sync and undo;
`placeSwap` double in-flight guard (E9); draft-discard prompts (askLeave reentrancy); WhatsApp/email/print
paths escape everything and share one plan object; `waNumber` normalisation.

**Schema (supabase/schema.sql)**: every security-definer function sets `search_path=''`; the early global
"staff full access" policies are **dropped** before the church-scoped ones are created (no policy OR-ing
leak); all helpers re-defined church-aware (`staff_church` requires active church + approved staff/admin
role); place guard is upsert-aware with leader/self carve-outs; invite links rate-capped (50/day) and
expiry-checked; block/unblock role-checked (self-block and owner-block refused); retention trigger and daily
purge implement the stated POPIA rules and the purge queries match the new/kept indexes; `test-security.sql`
matches the actual policies (13 checks). `paid_until` is informational by design — server enforcement is via
church `status='active'` in `staff_church()`.

**Core shell**: secureStore `b64` 32 KB slicing, write ordering (`seq` guard), boot exactly-once; `persistNow`
string-compare is equivalent to the old hash for the store path; `sw.js` every fetch path (SWR page, 503 when
nothing saved, `version.json` network-only, ownFile, activate cleanup, SKIP_WAITING handshake); `update.js`
snooze/success discipline (U3/M6); overlay stack; `migrateVolunteer`; delegated actions with no inline
handlers; manifest consistent with SHELL_FILES.

**Landing/build/deploy**: ECG IntersectionObserver pause/resume logic (no rAF leak, `last=NaN` beat guard);
range-worker caching; `_headers` single-rule-per-path; build.js CSP/hash discipline and APK-embedded version
read; gradle 1.7.1/code 47 consistent with dist and commits; harness SwRequest sandbox faithful for
`cache:'reload'` (undici `Request.cache` verified on Node 24.5).

---

## 3 · Recommended order of work

1. **P0-1** — one whitelist entry + validation in `migrateAttendee`, plus a reload-survival harness test. (Also
   re-check `followUpName`/`guardianName`-style whitelists whenever a new `interests` entry is added — this is
   the second time the mapper has eaten a field the sync carries.)
2. **P2-2** (one line: `cp.problem` → `base` in `churchPlanFor`'s `help:`), **P2-1** (re-fetch on sign-in /
   periodic like the other lists), **P2-3** (retry a failed store write on next `persistNow` instead of
   early-returning against `mem`).
3. The P3s as a sweep; P3-4 is a one-line conditional and worth doing with the sweep.

---

## 4 · Fix status (2026-11-12)

Each finding was re-read against `main` @ `59e9a42` before fixing. The review's baseline (1.7.1 / code 47) predates
the 2026-11-10 audit commits, which had already fixed two of the findings.

| Finding | Status | Change |
| --- | --- | --- |
| P0-1 | Already fixed (`90e8494`) | `migrateAttendee` keeps `customPlan` through `normaliseCustomPlan` (state.js); harness checks reload survival |
| P2-1 | Fixed | `churchPlanList` and `churchPlansBox` re-ask once per session and every 10 min; the cached list is shown meanwhile |
| P2-2 | Fixed | `churchPlanFor` help line keys on the resolved protocol (`base`), as `customPlanFor` does |
| P2-3 | Fixed | a `securestore:writefail` for the passport key makes the next `persistNow` write even when the content is unchanged |
| P3-1 | Fixed | a row failing with a non-network error no longer stops the pass; the other rows go up, then the error is thrown so the pass retries |
| P3-2 | Fixed | a failed read in `resolvePlacement` throws (retried) instead of parking the row as refused |
| P3-3 | Fixed | ledger write failure clears `_ledgerSig` and warns; quarantine write failure tells the person to export the kept records |
| P3-4 | Fixed | pledge form line says the record is shared with the church's team when signed in |
| P3-5 | Fixed | `makeInvite` drops a second tap while a request is in flight |
| P3-6 | Already fixed (F-4, `6c1b67c`) | `offer()` hides the bar in the app when `version.json` has no `apk` block |
| P3-7 | Fixed | the source page loads `src/dev-boot.js`, which imports `main.js` only once the secure store is ready |
| P3-8 | Fixed | an empty signed-out copy loads as empty lists instead of the demo visitors |
| P3-9 | Fixed | per-step how limit raised to the 400-character total (the database guard has no per-step limit), so nothing is cut off |

No database change was needed: none of the fixes touches `supabase/schema.sql`.
Harness: 1598 / 1598 checks pass (8 new: P2-2, P2-3 ×3, P3-3 ×2, P3-8, P3-9); typecheck clean.
