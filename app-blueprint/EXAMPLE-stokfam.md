# Worked example — "Stokfam" (filled-in blueprint, abridged)

> **What this is:** [BLUEPRINT.md](BLUEPRINT.md) filled in for a Stokfam-style app, to show what a finished section
> looks like. It is a teaching example, not a real plan.
>
> **Where the content comes from:**
> - **(diagram)**: read from the Stokfam infrastructure diagram shared in the planning conversation.
> - **(assumed)**: invented for illustration. The diagram says nothing about the app's purpose, users, features or targets.
>
> All targets below are illustrative TARGETs, not recommendations for any real app. Each section is shortened to its most
> instructive rows.

| Field | Value |
| --- | --- |
| Status | Draft (example) |
| Owner | {{owner}} |
| Repo | GitHub, private; images at `ghcr.io/quillqode/stokfam` (diagram) |

---

## 1. Problem, goals and success metrics

| Item | Value |
| --- | --- |
| Problem statement | Members of a savings group (a "stokvel") track contributions in WhatsApp chats and paper books, which leads to disputes about who paid what. (assumed) |
| Target users | Group treasurers and members. (assumed) |
| Goal 1 | Every contribution is recorded once and visible to all members of the group. (assumed) |
| Non-goals | Holding or moving money. The app records payments made elsewhere. (assumed) |

| Metric | Baseline | TARGET | By when | Owner | Measured by |
| --- | --- | --- | --- | --- | --- |
| Groups with ≥1 contribution logged per week | NOT MEASURED | 50 groups (assumed) | 3 months after launch | Product | `contribution_logged` event |

> The non-goal "not holding money" is the most important line on this page. It removes payment licensing,
> reconciliation and most of the fraud risk from scope (§8, §16).

## 2. Users, roles and permissions

| Action | Member | Treasurer | Admin (staff) | Support (staff) |
| --- | --- | --- | --- | --- |
| View own group's ledger | ✅ | ✅ | ❌ | ✅ audited, with user consent |
| Log a contribution | own only | ✅ | ❌ | ❌ |
| Correct an entry | ❌ | ✅ (new reversing entry) | ❌ | ❌ |
| Change roles in group | ❌ | ✅ | ✅ audited | ❌ |

All rows are (assumed).

## 3. Scope and user journeys (excerpt)

| ID | Journey | In / Later | Acceptance criteria | Offline? |
| --- | --- | --- | --- | --- |
| J1 | Join a group via invite link | In | Given a valid invite, when a signed-in user opens it, then they appear in the member list within 5 s. | No |
| J2 | Treasurer logs a contribution | In | Given a member, when the treasurer saves an amount, then every member sees it and the ledger total updates. | Queued, syncs later |
| J3 | Export statement as PDF | Later | — | — |

All rows are (assumed).

## 4. Non-functional requirements (excerpt)

| Requirement | TARGET | Verified by |
| --- | --- | --- |
| p95 latency, ledger API | 300 ms (assumed) | k6 load test, §10 |
| Availability (monthly) | 99.5 % (assumed) | External uptime SLO, §11 |
| Min Android version | Android 9 (assumed) | Device matrix in CI |
| Data residency | NOT DECIDED — see D2 in §16 | — |

## 5. Domain and data model (excerpt)

| Entity | Classification | Purpose | Retention |
| --- | --- | --- | --- |
| Member (name, phone) | Personal | Identify members to each other | Until account deletion + 30 days (assumed) |
| Contribution (amount, date, member) | Personal / financial record | Group ledger | Life of the group + legal minimum. NOT CHECKED: the legal minimum is unknown |

- **Ledger rule:** contributions are append-only. A correction is a reversing entry, never an update.
- **Database:** NeonDB (diagram). Staging uses a Neon **branch** of production's schema seeded with fake data, not a copy of production data.

## 6. Architecture

**Container view** (diagram, corrected):

```
[Mobile app iOS/Android] --HTTPS--> [Cloudflare DNS + Tunnel] --outbound tunnel--> [Hetzner VPS: Dokploy]
                                                                                   ├─ api (container)
                                                                                   ├─ web (container)
                                                                                   └─ worker (container)
                                         api, worker --TLS--> [NeonDB — managed, hosted by Neon, NOT on the VPS]
```

**Correction to the diagram:** the diagram draws NeonDB *inside* the Hetzner box. Neon is a managed service, so it is drawn outside here. This matters for backups (§12) and latency.

**Single points of failure:**

| Component | Failure impact | Mitigation now | At SCALE trigger |
| --- | --- | --- | --- |
| The one Hetzner VPS (diagram: staging and prod share it) | Total outage. A runaway staging job can starve prod. | Resource limits per container in Dokploy, and staging stopped outside test hours (assumed) | Move staging to its own VPS (R1) |
| Cloudflare Tunnel daemon | No traffic reaches the server | Run as a supervised service, and the external uptime check alerts | Second connector on a second host |

## 7. APIs and contracts (excerpt)

- REST with an OpenAPI spec in `api/openapi.yaml`. CI fails on drift. (assumed)
- **Compatibility rule:** only additive changes within `/v1`. The oldest supported app version is set by the server (§13).
- **Idempotency:** `POST /contributions` takes an `Idempotency-Key` header, because J2 retries from the offline queue.

## 8. Identity, security and privacy (excerpt)

| Control | Choice | Evidence |
| --- | --- | --- |
| ASVS level | Level 2 (assumed: personal financial records) | Checklist in `docs/security/asvs.md` |
| Mobile standard | MASVS v2.1.0 categories, incl. MASVS-PRIVACY | Review before each major release |
| Admin access path | No inbound ports (diagram). Server SSH via Cloudflare Access, plus the Hetzner console as break-glass. (assumed) | Access policy screenshot in the repo wiki |
| Staging access | Behind Cloudflare Access, restricted to team emails. The diagram says "not public" but not how. (assumed) | Access policy |
| Privacy laws in scope | POPIA, assuming South African users. NOT CHECKED with a lawyer. | — |

| Threat (STRIDE) | Component | Mitigation |
| --- | --- | --- |
| Information disclosure: member sees another group's ledger | api | Every query scoped by `group_id` from the session, never from the request body. A cross-group test is in CI. |
| Tampering: treasurer edits history | api / DB | Append-only ledger plus an audit log. |

## 9. Environments, branching and delivery

**Changes from the diagram:**

| Diagram (as drawn) | Blueprint version | Why |
| --- | --- | --- |
| Branch named `hetzner` | Branch named `staging` | Name the environment, not the vendor (§9 Done-when) |
| Images tagged `main` / `hetzner` / `latest`, built per branch | Build once and tag with the commit SHA. Deploy staging by digest, then **promote the same digest** to prod. | Prod runs exactly what was validated |
| `stokfam-mobile-build` shown as a deployable image | Mobile builds go to the stores (§13). An image may still be used as the *build environment*. | Phones don't run containers |
| Staging and prod on one VPS | Accepted risk R1 now. Separate VPS at the SCALE trigger. | Isolation |

| Environment | Trigger | Host | Database | Access |
| --- | --- | --- | --- | --- |
| Preview (`preview/*`, diagram) | PR opened | VPS, Dokploy preview app | Neon branch | Team |
| Staging | Merge to `staging` | VPS, Dokploy (diagram) | Neon branch, seed data | Team + testers via Access |
| Production | Promote approved digest after merge to `main` (diagram) | VPS, Dokploy (diagram) | Neon main branch (diagram) | Public via `app.stokfam.com` (diagram) |

## 10–11. Testing and observability (excerpt)

| Layer | Tool | Blocks |
| --- | --- | --- |
| Unit + integration (real Postgres via Neon branch) | Vitest (assumed) | Merge |
| E2E journeys J1–J2 on Android emulator | Maestro (assumed) | Release |
| Cross-group access test | API integration suite | Merge |

| SLI | SLO (TARGET) | Alert → |
| --- | --- | --- |
| Uptime checks of `https://app.stokfam.com/health` from outside the server | 99.5 % / 30 days (assumed) | Owner's phone |

## 12. Resilience

| Data store | RPO | RTO | Backup | Last restore test |
| --- | --- | --- | --- | --- |
| NeonDB (prod) | 1 h (assumed) | 4 h (assumed) | Neon's point-in-time restore (NOT CHECKED this session: that the feature applies, and its retention on the plan in use). | NOT MEASURED |
| VPS volumes (uploads, Dokploy config) | 24 h (assumed) | 8 h (assumed) | Nightly off-site copy (assumed) | NOT MEASURED |

The diagram's "Backups (database + volumes)" line is two separate jobs: Neon covers the database, and the volumes need their own backup.

## 13. Client release

| Client | Distribution | Min supported version rule | Halt condition |
| --- | --- | --- | --- |
| iOS | TestFlight → App Store | `GET /v1/app-config` returns `minVersion`, and the app blocks below it | Crash-free sessions drop below the agreed TARGET |
| Android | Internal testing → staged Play rollout | Same | Same |

The diagram has no store path at all. This section is the gap it fills.

## 16. Risks and decisions (excerpt)

| ID | Risk | L | I | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| R1 | Staging and prod share one VPS | M | H | Container limits, staging stopped off-hours, split at trigger | Accepted (owner) |
| R2 | Signing keys held by one person | M | H | Keys in a team password vault, two release managers | Open |

| ID | Decision | Options | Recommendation | Evidence |
| --- | --- | --- | --- | --- |
| D1 | Separate staging host now or later? | Now / at trigger | At trigger, if R1 mitigations are in place | Cost vs. isolation. Cost NOT MEASURED. |
| D2 | Data residency | Neon region near users / any | NOT DECIDED — needs POPIA advice | NOT CHECKED |

## 18. Facts register and not measured

| ID | Fact | Source |
| --- | --- | --- |
| F1 | Repo is private on GitHub; images in `ghcr.io/quillqode/stokfam` | Diagram |
| F2 | Hosting: Hetzner VPS with Dokploy, no open inbound ports, Cloudflare Tunnel + DNS for `app.stokfam.com` | Diagram |
| F3 | Database: NeonDB, with a branch for validation | Diagram |

**Not measured / not checked:** the app's real purpose, users and features; every TARGET above; costs; Neon backup retention; POPIA obligations and data residency; whether Cloudflare Access is already configured; restore and rollback times.
