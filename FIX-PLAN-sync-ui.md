# FIX-PLAN: a smoother sync UI

*Follows the shape of FIX-PLAN-status.md (executed 2026-10-21). This plan was executed on 2026-10-30.*

## The problem

The only glanceable sync signal was a 9px dot that changes colour. Tapping **Sync now** showed a frozen
"Syncing…" while the To-upload count snapped only when the whole upload finished. There was no "last synced"
time, and a generic failure put a raw database message in the status line.

## Goals

- **G1 — the header says what is happening.** The cloud dot breathes while a sync runs (the same
  compositor-friendly ring as the live-queue dot, on a `data-busy` attribute, no new class); a small badge on the
  cloud button counts the changes waiting to upload and stands down while the ring speaks; the button's tooltip
  carries the status words.
- **G2 — progress you can see.** While syncing, the status line (Profile card, the sheet behind the logo, the
  Home pill) says what the sync is doing: "Downloading the latest…", then "Uploading 3 of 5…", then "Up to
  date". The counts are taken from the existing push loop at batch boundaries; **Sync now** disables itself
  while a sync runs (requests already coalesced through `cloud.again`; this makes it visible).
- **G3 — "last synced".** `cloud.syncedAt` is set by `setCloud('online')` (both the full sync and a push reach
  it) and shown as "· synced just now / 5 min ago / 14:32". No timer: recomputed at render time.
- **G4 — calmer failures.** A generic failure shows "Sync hit a problem. It retries by itself — Details has the
  technical bit."; the raw message stays in the Details row where `healthFromError` already put it. A refused
  change records `cloud.rejectedNote` so the Upload row names the latest refusal ("EXPO-042 — <reason>")
  instead of "the reason was shown when it happened". A refusal that later uploads clears itself out of
  `cloud.rejected` (previously the refused count could go stale).

## Invariants kept

- **The engine is observe-only.** `fetchRows`, `mergeRemote`, `pushOne`'s request order, conflict resolution and
  the placement retry are unchanged; the only additions are counters (`cloud.prog`), a phase marker
  (`cloud.phase`), and the timestamp. No new `setInterval` (the two-timer rule stands; progress is emitted at
  batch boundaries).
- **No new CSS classes.** The pulse rules are attribute selectors (`#cloudDot[data-busy="1"]::after`) reusing
  `@keyframes qpulse`, with the same `html.lite` and `prefers-reduced-motion` guards as the queue dot.
- **Cheap patches, not renders.** `syncChrome()` touches the dots, badge, tooltip and the status line/tile
  nodes by id (`cloudSyncLine`, `profSyncLine`, `cloudSyncTiles`, `profSyncTiles`); full renders still happen
  through the existing `setCloud` → `profileChanged`/`cloudRefresh` debounce.
- The harness grew one block in section 18d (syncedAt, busy wording, busy ring, badge) — everything it asserted
  before still holds.

## Files

`src/state.js` (fields) · `src/cloud.js` (`syncChrome`, `syncStatusText`, `syncedLabel`, `syncTilesHTML`,
`setCloud`, `healthUpload`, `renderCloudBody`, `homeHealthHTML`) · `src/account.js` (`cloudSync`, `pushDirty`,
`pushOne`, `cloudPush`, `cloudError`, `profSync`, `cloudSignOut`) · `src/main.js` (exports through
`__internals`) · `index.html` (badge markup + pulse rules) · `.smoke/harness.js` (section 18d block).

*PASS: typecheck, build, and the full harness (see the commit that carries this file).*
