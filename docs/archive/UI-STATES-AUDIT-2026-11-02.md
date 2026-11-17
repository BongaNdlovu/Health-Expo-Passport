# UI & async state coverage — audit, 2026-11-02
Directive: "Comprehensive UI & Asynchronous State Coverage" (8 numbered categories). Scope agreed with the operator:
**the flows that touch the network**. Audit by a Haiku 5.5 agent (code reading, every cell cited file:line); the
orchestrator re-read the six claims marked ✔. Nothing was run in a browser for this audit.

## Coverage matrix (P = present, ½ = partial, ✗ = missing, – = not applicable)
| Flow | 1 Loading | 2 Latency | 3 Connectivity | 4 Errors | 5 Empty | 6 In-flight | 7 Auth/429/perm | 8 Data edges |
|---|---|---|---|---|---|---|---|---|
| F1 Boot + library load (libs.js) | ½ | ✗ | ½ | ½ | – | ½ | – | – |
| F2 Sign-in | ½ | ½ | ½ | ½ | – | ½ | ½ | – |
| F3 Create account / resend / forgot / new password | ½ | ½ | ½ | ½ | – | ½ | ½ | P |
| F4 Session expiry, sign-out | – | – | ½ | ½ | – | ½ | ½ | – |
| F5 Cloud sync | P | ½ | ½ | ½ | P | ½ | ½ | P |
| F6 Realtime + poll fallback | ½ | – | ½ | ½ | – | – | – | ½ |
| F7 Live queue | ½ | ½ | P | ½ | P | ½ | P | ½ |
| F8 Update check / bar | – | – | P | ½ | – | ½ | ½ | P |
| F9 Service worker | – | ½ | ½ | ½ | – | – | P | ½ |
| F10 Export / share | ½ | – | – | ½ | – | ✗ | ½ | ½ |
| F11 Admin approvals / account hub | P | ½ | ½ | ½ | ½ | ½ | P | P |

**Already strong (reuse, do not rebuild):** every Supabase request has a 4 s "slow" note and a 20 s hard deadline
(`timedFetch`, cloud.js:589-615); account screens have a placeholder and Try again (`acctSkel`, `retryNote`,
account.js:129-133); a crash card isolates thrown errors (crash.js); the queue refuses changes offline with a clear
pill (queue.js:1081-1086); the header dot + Home pill show sync state. **Missing primitives:** no offline banner, no
`offline` listener anywhere in `src/` ✔, no generic disabled/busy button style, no spinner/`aria-busy`.

## Missing states, ranked by impact for volunteers on phones with patchy signal
| # | Flow · category | Finding (evidence) | Smallest change |
|---|---|---|---|
| T2-1 | F1 · 2 hard timeout | ✔ `loadScript` never times out; pending promise cached forever, gate stuck on "Connecting…", Try again does nothing (libs.js:5-9, account.js:1339) | 15 s timer in libs.js: on expiry delete the cache entry and reject; cleared on load/error |
| T2-2 | F7 · 1 loading | ✔ before the first sync the board says "Free — nobody here" (queue.js:1133) and totals 0 while the pill says Connecting | while signed in and `!qs.ready`: totals "—", cards "Loading the line…" |
| T2-3 | F5 · 3 offline detection | ✔ only `online` is listened to (main.js:48); offline is noticed when a request fails and the status flips Syncing→Offline every 20-60 s | `offline` listener → `setCloud('offline')`; poll skips while `navigator.onLine===false` |
| T2-4 | F5 · 4 actionable error | refused upload shows raw server text for 2.2 s, never retried (account.js:1680) | fixed toast text, raw text to the Cloud-status detail, "Try again" action that clears `cloud.rejected` and pushes (pairs with BUG-A) |
| T2-5 | F8 · 4 error | ✔ Android Update records the snooze before the download opens, so a failed hand-off is never offered again (update.js:135-136) | write the snooze after a successful open; toast "Could not open the download — tap Update again" otherwise |
| T2-6 | F2 · 7 rate limit + draft | 429 says "wait 5 minutes" but the button re-enables at once (account.js:1411); every failure rebuilds the form and clears the password (account.js:1398, cloud.js:278) | 5-minute cooldown with minutes left; keep the email (`cloud.viewEmail=em`) |
| T2-7 | F4 · 7 session expired | expiry shows a 2.2 s toast, then a bare form (account.js:1388, cloud.js:334) | `cloud.formErr` "Your session ended. Sign in again to keep syncing — visitor data on this phone is kept." |
| T2-8 | F6 · 3 stale copy | the live pill says changes arrive "within 10 minutes" (cloud.js:647); the poll is 20-60 s (main.js:58-68) | correct the copy; run `cloudSync()` when realtime reaches SUBSCRIBED (catch-up after reconnect) |
| T2-9 | all · 6 in-flight | no generic disabled style: "Sync now", `#cloudGo`, queue buttons look tappable while locked (index.html:553) | one `.btn:disabled,.btn[aria-busy=true]` rule using existing tokens; `gateBusy` sets `aria-busy` |
| T2-10 | F10 · 6 double submit | ✗ export actions have no lock; repeat taps save again (results.js:717) | module flag in `saveExport` |

**Not proposed (with reason):** skeletons for lists that render synchronously from local data (no network wait to
cover); pagination indicators (no paginated UI — pulls page internally); device-permission states (grep finds no camera,
geolocation or notification-permission API in `src/`; the one clipboard write already falls back to a manual copy on
denial, churchPlans.js:327, and `navigator.share` falls back to wa.me, churchPlans.js:332); forgot-password 5xx answering
"link on its way" (cloud.js:486-490 — the code comment says the identical answer is deliberate anti-enumeration;
**owner decision**); 401/JWT branch (needs a check of how supabase-js reports an expired token — not checked).

## Plan once signed off
One Haiku agent per file group so no two agents touch the same file: (libs.js + main.js + index.html CSS),
(queue.js), (update.js), (account.js + cloud.js, after the BUG-A/B fixes land), (results.js). Each change gets a
harness check in the repaired `.smoke/harness.js`; the orchestrator re-runs the full suite, typecheck and test:build,
then verifies in the browser preview (offline toggle, slow library, queue before first sync).
