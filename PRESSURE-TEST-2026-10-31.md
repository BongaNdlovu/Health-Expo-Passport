# Pressure test: 1,000 → 10,000 users, memory, security, rate limiting, caching (31 Oct 2026)

Every number below was printed by a tool during the test. What could not be checked says so.
This re-runs the pressure test of 21 Oct 2026 against the 103 commits that landed since it (the ECG and triage deck,
custom plans, church expos, join wants, platform-admin management, the sync progress UI and the APK update
path all landed after it). It also adds what that test did not cover: **a ramped load test from 1,000 to
10,000 simulated users, and an inventory of rate limiting and caching** — the two things this app has
always relied on Supabase's platform for.

Test beds:
- the built `dist/` served by the project's own preview server (`tools/serve.js`, Node 24.5.0)
- a zero-dependency load generator written for this test (`pen-test/load.js`), 1,000 → 10,000 concurrent users
- real Chrome (headless, phone-sized 412×915 viewport) driven by `pen-test/scale-browser.js` through puppeteer
- the project's own test suite (`npm test`): **1,265 of 1,265 checks pass** on the build under test
  (cache version `69eb90bc41`, 1.6.2) — including the on-real-Postgres battery (PGlite 0.5.11 in a sandbox
  folder): the database attack scenarios, the RLS catalogue audit and church isolation, 204 checks that are
  skipped when `NEWSTART_PGLITE` is not set
- static line-by-line audits of every module and of `supabase/schema.sql`, and `git` history since 21 Oct

**The live Supabase project received no traffic from this test** — not even read-only probes. Everything ran
locally; the page under test was launched with cloud networking disabled.

## Summary

| # | Area | Finding | Severity | Status |
|---|---|---|---|---|
| R1 | Scale | A 10-minute **full-table pull per signed-in device** (~8 MB at 10k visitors) is the single biggest load item; 500 desks ≈ 190 GB/day of re-downloaded data | **High** | **Fixed 1 Nov**: the deletion check now reads `id,updated_at` only (~15 B/row); the RLS helpers are initplan-wrapped |
| R2 | Scale | **Realtime connection caps by plan** (Free 200, Pro-with-cap 500, Pro 10,000 devices): one channel per device means a big expo silently exceeds every plan but uncapped Pro | **High** | Your action: right-size the plan before the event (§Rate limiting) |
| R3 | Memory | **No memory leaks** — 100 sustained use-cycles at 3k and 10k visitors: event listeners Δ0, DOM nodes Δ0 (−509), heap plateaus flat (2.8 MB / 5.3 MB) | Pass | Permanent tests added; re-verified after the 1 Nov fixes |
| R4 | Storage | At 10k visitors the saved copy is **4,254 KB of the ~5,000 KB localStorage budget** — one busy day at a mega-expo can hit the quota cliff; the save then fails with one toast and offline edits are lost on reload | **High** | **Warned 1 Nov** (toast at 4.2 MB); the IndexedDB move remains a separate planned change |
| R5 | Security | Re-audit of everything changed since 21 Oct: **no new critical or high defect**. 4 lows, 4 infos (below); the 30 Oct security pass (`docs/security-pass-2026-10-30.md`, F-01…F-16) remains the authoritative list — F-01 (shared-desk session) is still the one high | Low | S-1/S-2/S-3/S-5/S-7 **fixed 1 Nov**; S-4 resolved by S-3; S-6/S-8 accepted (see §Security) |
| R6 | Load | The origin server saturates at ~1,500–1,800 req/s under zero-think-time load; at 10,000 simultaneous tight-loop users it degrades (12.8 s p95) but **never crashes or leaks** (RSS 712 MB, bounded by connections). Production serves from Cloudflare's edge, which this test deliberately did not touch | Info | Behaviour documented |
| R7 | Caching | Present and mostly right, with one measured gap: the page is **network-first**, so every open re-downloads the 581 KB shell (measured: warm reload 580 KB) and a cold open on venue wifi stalls up to 4 s before the saved copy shows | Medium | **Fixed 1 Nov**: navigations are stale-while-revalidate |
| R8 | Rate limiting | Client cooldowns and debounces exist; **the database has exactly one time-window check** (pledge notifications). Sign-in, join requests, invite creation and pledge churn can be spammed and rely wholly on Supabase's platform limits | Medium | **Hardened 1 Nov**: join requests notify with a 1-hour window, invites capped 50/day/church, register/deregister/withdraw deduped |
| R9 | Performance | Client stays fast at 10k: worst screen draw 27 ms, edit+save 41 ms, 100-event realtime burst merges in 8.6 ms, heap 9.4 MB | Pass | — |

---

## 1. Load: 1,000 → 10,000 simulated users

Method. `pen-test/load.js` forks worker processes; each holds its share of users on keep-alive sockets and
repeats the app's real boot sequence (`/`, `/sw.js`, `/version.json`, `/manifest.webmanifest`,
`/icons/icon-192.png`) with **no think time** — every user is a maximum-rate client, so this is a saturation
test, far pessimistic against reality (a real user opens once, then idles). 30 s per phase, warmup first.
Target: the project's preview server, a stand-in for "your own origin box". A 1 req/s canary ran throughout.

| Users | req/s | p50 (ms) | p95 (ms) | p99 (ms) | max (ms) | errors | server RSS peak | canary p95 (ms) |
|---|---|---|---|---|---|---|---|---|
| 1,000 | 1,792 | 338 | 1,502 | 1,696 | 1,978 | 0 | 332 MB | 402 |
| 2,500 | 1,539 | 909 | 4,437 | 4,965 | 5,385 | 0 | 447 MB | 1,254 |
| 5,000 | 1,512 | 2,746 | 8,372 | 8,712 | 9,561 | 2,042 | 593 MB | 2,983 |
| 10,000 | 2,485 | 3,204 | 12,774 | 14,624 | 15,884 | 39,332 | 712 MB | 1,050 |

Reading:
- The stand-in saturates around **1,500–1,800 req/s**. Beyond ~2,500 zero-think-time users the accept queue
  backs up: latency climbs, and at 5k/10k some requests exceed the generator's 15 s timeout (the "errors" are
  client-side timeouts and refused connects, not wrong answers). The canary kept being served throughout.
- **No crash, no unbounded memory.** RSS tracks the connection count almost linearly (~70 KB per kept-alive
  socket) and would come back down with the connections; this is bounded working set, not a leak.
- **What this means for the real event.** Production does not serve from a Node box: `wrangler.jsonc` puts
  `dist/` on Cloudflare's edge, where static files scale horizontally past anything an expo generates. The
  realistic per-user cost is one cold boot (measured below: 7 requests, 643 KB) plus the sync traffic in
  §3 — for 10,000 cold opens that is ≈ **5.8 GB of shell HTML uncompressed** (≈4× less over the wire), which
  the edge absorbs but a shared venue uplink feels. The failure mode to plan for is **venue wifi**, not the
  server.

## 2. The client at scale (real Chrome, 1k / 3k / 10k visitors + 300/900/3,000 volunteers)

`pen-test/scale-browser.js` seeds the app's own row objects through its own mapping, then times real renders
and saves inside the page (single samples; the harness's own big-data checks keep watch on growth ratios).
The device profile is a cheap phone (412×915 viewport).

| Visitors | heap | DOM nodes | Home | Queue | Care | Team | Profile | Check→Results→Plan | Edit+save | Dirty check (per pass) | Saved copy |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1,000 | 2.4 MB | 775 | 2.8 ms | 3.0 | 20.5 | 16.9 | 2.8 | 21.7 / 17.0 / 35.1 | 11.2 ms | 7.6 ms | 424 KB |
| 3,000 | 4.0 MB | 784 | 4.3 ms | 5.7 | 22.0 | 14.8 | 2.5 | 13.3 / 11.0 / 27.3 | 17.5 ms | 22.8 ms | 1,274 KB |
| 10,000 | 9.4 MB | 775 | 6.6 ms | 5.5 | 8.4 | 12.9 | 3.4 | 14.7 / 11.1 / 27.3 | 40.9 ms | 66.2 ms | 4,254 KB |

- Screens stay in tens of milliseconds at 10,000 visitors because lists are capped (Home draws ~25 rows and
  offers search; Care draws a capped card set). The slowest measured draw anywhere is Plan at 27 ms.
- **Edit+save at 10k costs 41 ms** because the save stringifies the whole dataset (§3, R4).
- **The dirty check costs 66 ms per pass at 10k** and runs several times around every sync cycle (push
  snapshot, pending badge, tiles, health) — it re-hashes every row every time. Not user-visible today; it is
  battery on a cheap phone, and it is the reason the change-detection check in the harness exists.
- A burst of **100 realtime events merges in 8.6 ms** (per-event row splice + signature; the debounced
  re-render afterwards costs 2.6 ms). A busy desk's live traffic will not bog the UI down.
- Cold boot measured: **1.27 s, 7 requests, 643 KB** on loopback — on venue wifi this is network-bound; see
  R7 for what the service worker does with it.

## 3. Memory leaks — none found

**Browser, forced GC, 100 use-cycles each at 3,000 and 10,000 visitors.** Every cycle: all six tabs drawn,
20 remote realtime updates merged, 5 local edits, one full save. Heap sampled after `HeapProfiler.collectGarbage`
every 10 cycles; DOM node and event-listener counts from Chrome's performance metrics.

| Size | Event listeners | DOM nodes | Heap trace over the run (MB) | Verdict |
|---|---|---|---|---|
| 3,000 | 31 → 31 (Δ0) | Δ −509 | 2.4 → plateau **2.8, flat** for 90 cycles | no leak |
| 10,000 | 31 → 31 (Δ0) | Δ −509 | 4.9 → plateau **5.3, flat** for 90 cycles | no leak |

A leak shows as a listener ratchet, a node ratchet, or a climbing heap; none moved. The −509 nodes are the
initial render tree shrinking after the first draws, not growth.

Code review agrees with the measurement, and the suite enforces it: the harness (1,265 checks) counts timers
(exactly two are allowed — the 60 s sync tick and the 20 s queue re-render), verifies every listener is
registered once at start-up, and the realtime channels are removed on sign-out. The audit looked for growing
arrays and found only bounded ones (notifications capped at 50, admin lists capped server-side, the sync
ledger fingerprinted to ~11 chars per row ≈ 120 KB at 10k).

**The one memory-adjacent risk is not a leak but a cliff (R4):** the offline copy lives in `localStorage`,
which browsers cap around 5 MB per origin. Measured saved copy: 4,254 KB at 10,000 visitors. A mega-expo
that crosses ~10–11k records starts failing its saves with a single toast; offline desks then lose edits on
reload — the exact scenario the app exists to survive. Fix: move the dataset to IndexedDB (no practical
quota), keep `localStorage` for the small keys. Until then the honest ceiling for one device is ~9–10k
records.

**Server memory:** bounded (R6) — RSS tracked connections, no growth across phases.

## 4. Security leaks

Scope: everything changed since the 21 Oct test, plus a re-verification of the standing controls. The
31-finding handbook pass of 30 Oct (`docs/security-pass-2026-10-30.md`) is recent and authoritative; this
pass re-checked its headline items independently and adds the delta since it. **No critical or high defect
was found beyond that pass's F-01.**

Verified sound (re-checked this pass):
- **Secrets:** repo-wide sweep for `sb_secret_`, `sbp_`, service-role keys, JWTs, `AKIA`/`AIza` keys and
  private-key blocks: **zero hits** outside documentation *about* key hygiene. Only the publishable
  `sb_publishable_…` key ships, which is public by design. Keystore passwords remain in Windows Credential
  Manager, not in the repo.
- **Injection:** the harness's XSS fuzz across every screen still passes inside the 1,265; the line-by-line
  re-read of the new modules (custom plans, expos, join wants, platform-admin screens, sync chrome) found
  `esc()` on every interpolated string, ids through `qSafe()`, no inline handlers, no `JSON.stringify` into
  HTML.
- **Headers:** the built `_headers` and the page's CSP meta carry byte-identical script hashes (checked);
  CSP stays `'self'` + two pinned hashes + one pinned jsDelivr path; `connect-src` limited to self + Supabase;
  `frame-ancestors 'none'`, nosniff, HSTS, Permissions-Policy all present.
- **Path traversal** on the preview server: `/../package.json` and `/%2e%2e/package.json` both → **403**.
- **Database:** RLS enabled on all 12 tables; every new RPC (`set_admin_post`, `admin_platform_admins`,
  `admin_add_platform_admin`, `attendees_custom_plan_guard`, `remove_visitor`, `church_expos`/`save_expo`/
  `delete_expo`, 5-arg `join_church`) carries all four requirements: `security definer`, `set search_path=''`,
  an in-function authorization check, and revoke-all + targeted grant.
- **New-code specifics verified:** the APK updater refuses any non-same-origin download URL; the crash card
  keeps its 300-char slice of the error on the device and phones nothing home; custom plans reject
  non-objects and unknown keys, and every render site of a plan escapes.

New findings this pass (none above Low). Status after the 1 Nov fixes:

| # | Severity | Finding | Status |
|---|---|---|---|
| S-1 | Low | `remove_visitor` lets any **team leader** permanently delete **any** visitor in the church (`schema.sql:2528`), while every other leader power is station-scoped by `can_place` | **Fixed**: a leader may now remove a visitor only while they stand in the leader's own booth line (`queue_entries` waiting/serving at their station); admins keep church-wide removal. Tested both ways in the PGlite battery |
| S-2 | Low | The stale-invite auto-join (30 Oct pass F-02) now also fires on the new multi-account paths: a stored invite code is consumed by whichever account signs in next | **Fixed**: the stored code is bound to the account it was offered to; a different account signing in on the same desk drops it instead of joining. A code still waiting for its anonymous arrival (the normal sign-up round trip) is untouched |
| S-3 | Low | Custom-plan limits (3–8 actions, field lengths, key whitelist) are enforced **only in the client**; the DB checks object-ness inside a 32 KB `interests` blob and nothing else | **Fixed**: the `attendees_custom_plan_guard` trigger now mirrors every client cap server-side (keys, lengths, 3–8 actions); only a *changed* plan is judged, so stored plans stay readable |
| S-4 | Info | `interests` cap raised 1 KB → 32 KB for plans: ×32 the admin-writable JSON hauled in every pull, push and realtime payload | **Resolved by S-3**: a conforming plan is ≤ ~6 KB, so the 32 KB ceiling is now unreachable through the editor path; a dedicated column stays unnecessary |
| S-5 | Info | `station_needs` value interpolated uncoerced (`account.js:1044`) — numeric only because `save_expo` rewrites it | **Fixed**: `Number(needs[b.k])||0`, matching the adjacent `placed` |
| S-6 | Info | `/version.json` served `Access-Control-Allow-Origin: *` — any site can read your build id | **Accepted — the original recommendation was wrong**: the packaged Android app fetches version.json cross-origin from the Capacitor WebView (`https://localhost` → APP_SITE, `update.js:88`), so the header is required by the update flow. What leaks is a build id. `tools/test-build.js` pins the header to exactly this one path |
| S-7 | Info | CSP `connect-src` allows `*.supabase.co`/`*.supabase.in` wildcards — every Supabase project, not yours | **Fixed**: build.js derives the host from `SB_URL` and pins `https://` + `wss://` for exactly `wlsrgihkijlvjyfxvhfl.supabase.co`. The APK's bundled copy picks this up at the next `build-app` + re-sign |
| S-8 | Info | `church_directory` now lists pending churches' names to any signed-in account (deliberate, aids dedupe) | **Accepted**: filtering to active churches would strand newly-registered ones — the directory is how members join a church that is still awaiting platform-admin approval |

Also re-confirmed: the anonymous attack surface is unchanged (no table, no privileged function reachable
without an approved membership — the harness's real-Postgres attack battery and catalogue audit ran this
pass: 204 PGlite checks, all passing), and the sign-up enumeration fix and unapproved-account gate fix from
the interim commits are in place.

## 5. Rate limiting

**What exists today**

| Layer | Limit | Where |
|---|---|---|
| Client | Resend-confirmation e-mail: 60 s cooldown | `src/cloud.js:444-455` |
| Client | Pending-approval re-check: ≥15 s; directory search debounced 250 ms; push debounced 700 ms; busy-guards stop overlapping syncs | `account.js`, `queue.js` |
| Database | One time-window check in the whole schema: identical pledge notifications deduped for 1 h | `schema.sql:2086-2090` |
| Supabase Auth (platform) | Sign-ups/sign-ins 30 per 5 min per IP; token endpoint 150 per 5 min per IP; verify 30 per 5 min per IP; OTP/reset per-user 60 s; MFA 15/min; **built-in e-mail sender 2/hour project-wide** | Supabase docs; the README already tells you to attach real SMTP before the event |
| Supabase Realtime (platform) | Concurrent connections: **Free 200 / Pro-with-spend-cap 500 / Pro 10,000**; 100–2,500 msgs/s by plan | Supabase docs |

**Gaps**

- **R2 (the one that can spoil an event):** every signed-in device holds one realtime connection. A 600-desk
  expo on Free or capped Pro exceeds the connection cap: Supabase starts disconnecting clients, which
  reconnect and hammer the cap again — flapping queues and "synced just now" lies for the back half of the
  hall. *Action:* know your device count; above ~180 devices be on uncapped Pro (10,000), or accept
  poll-only desks by disabling realtime for non-queue roles.
- **R8** (hardened 1 Nov): the spam-able actions now have server-side windows. Join requests notify the
  church's admins through the same 1-hour identical-title window `pledge_notify` uses (and give admins a
  signal they never had); `create_church_invite` refuses past 50 links per church per day; the
  register/deregister and withdraw notifications carry the same 1-hour dedupe. Sign-in attempts remain
  platform-limited only (Supabase Auth's per-IP token buckets) — nothing app-side to add there.
- **R1, the cost twin of rate limiting — fixed 1 Nov.** Every signed-in device still does a **full reconcile
  every 10 minutes** (`account.js` `cloudSync`), but "full" is now two cheap pieces: the rows changed since the
  last pull with all their columns, plus an **`id,updated_at` projection** that is what notices deletions —
  ~15 bytes a row instead of ~650. At 10k visitors the ten-minute cycle drops from ≈ 8 MB to ≈ 150 KB per
  device; the worked example (500 devices, 8-hour day) drops from ≈ 190 GB of egress to a few GB. The RLS
  policy helpers were wrapped as `(select public.staff_church())` / `(select public.is_admin())` in the same
  pass, so the per-statement lookup runs once, not once per row. The companion client fix that keeps the
  watermark honest: nothing (the database sets `updated_at`, so stamps are server time).
- Also noticed: the offline retry loop is a **fixed 20 s** during outages (`account.js:1407-1422`) — when
  venue wifi dies, every desk retries in lockstep forever. Exponential backoff with jitter would calm the
  reconnect stampede.

## 6. Caching

Inventory (all verified in the running build):

| Layer | Strategy | Verdict |
|---|---|---|
| Page (`/`, `index.html`) | SW network-first, 4 s cutoff, saved-copy fallback, copy refreshed in background | Correct for freshness; costs R7 below |
| Own files (icons, manifest) | Stale-while-revalidate from the SW | Good |
| CDN library (supabase-js, pinned + SRI) | Cache-first, forever at a pinned URL | Good |
| Supabase traffic | **Never** intercepted or stored by the SW | Correct (health data) |
| HTTP headers | `/`, `/sw.js`, `/manifest` no-cache; `/icons/*` 1 day; `/version.json` no-store + CORS; APK as attachment | Right; icons could live 30 days, minor |
| `version.json` polling | On open, foreground and reconnect only — never a timer | Good |
| Data layer | Whole dataset kept on-device; pushes send only rows whose signature changed; sync ledger fingerprinted | Good |

**R7, the measured gap — fixed 1 Nov:** navigations are now **stale-while-revalidate** (`sw.js page()`): the
saved copy answers at once and the network copy is fetched in the background for the next open, exactly like
the icons already behaved. Measured on the fixed build: a warm open went from **631 ms** (waiting for the
shell download) to **81 ms** (opened from the saved copy; the 581 KB refresh arrives in the background) — and
the venue-wifi stall is gone with it. Updates still arrive: the banner is driven by `version.json`, not HTML freshness, and the new worker's install fetch
has already cached the fresh page — a tap on Update with a waiting worker lands the new build on that reload;
without one it lands on the next open (the promise HOSTING.md already makes). The nothing-saved 503 path and
the non-HTML guard are unchanged and still tested.

Second, the opposite of caching — R1's 10-minute full pull is a "cache-miss by design" that §5 fixes with a
cheap projection; after that fix the data layer caches as well offline as it does on.

## 7. What this test changed

**1 Nov 2026 — the findings were fixed** (approved plan; all 1,274 suite checks pass, including the 204-check
PGlite battery):

| Fix | Where |
|---|---|
| R1: deletion check reads `id,updated_at` only (`fetchIds`/`pruneRemote`); RLS helpers initplan-wrapped | `src/account.js`, `supabase/schema.sql` |
| R4: near-full warning at 4.2 MB (IndexedDB move still to come) | `src/state.js` |
| R7: navigations stale-while-revalidate | `sw.js`, `src/update.js` comment |
| R8: join-request notifications (1 h window), invites capped 50/day/church, register/deregister/withdraw deduped | `supabase/schema.sql` |
| S-1: `remove_visitor` booth-scoped for leaders, church-wide for admins | `supabase/schema.sql` |
| S-2: stored invite codes bound to the account they were offered to | `src/churchPlans.js`, `src/account.js` |
| S-3: custom-plan caps mirrored server-side in the guard trigger | `supabase/schema.sql` |
| S-5: `station_needs` read as numbers | `src/account.js` |
| S-7: CSP `connect-src` pinned to the one Supabase host | `tools/build.js`, `index.html` |

S-6 and S-8 were **accepted** (see §4 — the original fix suggestions were wrong: the CORS header is required
by the in-app updater; the directory must list pending churches for onboarding to work).

**Run schema.sql on Supabase again** — S-1, S-3, R1's RLS half and R8 are server-side and do nothing until
the database has the new definitions.

Test tooling added for reproduction:
- `pen-test/load.js` — the 1k→10k ramp (run: `node pen-test/load.js`), results in `pen-test/results-load.json`
- `pen-test/scale-browser.js` — the Chrome scale + leak protocol (run: `node pen-test/scale-browser.js`),
  results in `pen-test/results-browser.json`

Remaining follow-ups, in the order they pay off:
1. R2: right-size the Supabase plan for the expected device count (Free 200 / Pro-capped 500 realtime devices).
2. R4: move the offline dataset to IndexedDB (the warning buys time; the ceiling is real).
3. Re-package the APK (`build-app` + `cap sync` + re-sign) so its bundled page carries the pinned CSP.
4. F-01 of the 30 Oct pass (shared-desk session) is still the one open high.

## 8. Not checked

- The live Supabase project: untouched by agreement — no probes, no writes. The Realtime flap behaviour at
  plan caps (R2) is from Supabase's documented quotas, not observed on your project.
- The production Cloudflare worker was not load-tested (that would be testing Cloudflare); the local
  preview server stood in for "an origin box", which is why §1 numbers are a floor, not a forecast.
- Real phones, real venue wifi, and the APK install hand-off on a device (the 30 Oct pass lists the same).
- Dashboard-side settings that cannot be seen from the repo (password minimum, pg_cron for the retention
  job — 30 Oct pass F-04, SMTP provider attached) remain manual checklist items in `supabase/README.md`.
- Battery drain and thermals (the timers audit is a proxy: exactly two intervals exist, both hidden-tab gated).
