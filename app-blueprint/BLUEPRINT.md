# {{App name}} — App Blueprint

> Copy this file into the new app's repo (e.g. `docs/BLUEPRINT.md`) and fill it in before writing production code.
> Replace every `{{…}}`. Delete hint lines (starting with `>`) once a section is filled.

| Field | Value |
| --- | --- |
| Status | Draft / In review / Approved / Superseded |
| Version | {{0.1}} |
| Owner | {{name}} |
| Reviewers | {{names}} |
| Last updated | {{YYYY-MM-DD}} |
| Repo / links | {{links}} |

## How to read and fill this blueprint

**Tags.** Every checklist item carries one tag:
- **[MVP]**: must be true before the first real user touches the app.
- **[SCALE]**: can wait until the named trigger hits. Write the trigger next to the item, e.g. `[SCALE: >1,000 weekly users]`.

**Numbers.** Every number in this document is exactly one of three kinds, and is labelled as such:
- **FACT**: measured or sourced. It points to a row in [§18 Facts register](#18-facts-register-and-not-measured) (`F3`).
- **TARGET**: a decision someone made. It names an owner and a date. A target is never presented as a measurement.
- **NOT MEASURED**: unknown so far. It is listed in §18 until someone measures it.

A number with no label is a defect in the plan.

**Section shape.** Every section has the same parts:
- **Purpose**: why the section exists.
- **Answer these**: the questions it must settle.
- **Fill in**: the artefact it produces.
- **Done when**: a checklist someone else can verify.

A section is finished only when every **[MVP]** item under *Done when* is ticked.

---

## 1. Problem, goals and success metrics

**Purpose:** agree on *why* the app exists before deciding *what* it does, so scope arguments have a referee.

**Answer these:**
- What problem, for whom, and how do they cope with it today?
- What changes for them if the app succeeds?
- How will we know, in numbers, that it is working?
- What are we explicitly *not* trying to achieve?

**Fill in:**

| Item | Value |
| --- | --- |
| Problem statement (2–3 sentences) | {{…}} |
| Target users | {{…}} |
| Current workaround | {{…}} |
| Goal 1 / 2 / 3 | {{…}} |
| Non-goals | {{…}} |

| Metric | Baseline (FACT or NOT MEASURED) | TARGET | By when | Owner | How it is measured (tool/event) |
| --- | --- | --- | --- | --- | --- |
| {{e.g. weekly active groups}} | | | | | |

**Done when:**
- [ ] [MVP] Problem, goals and non-goals are written and agreed by the reviewers.
- [ ] [MVP] Every metric names the tool or analytics event that will produce it.
- [ ] [SCALE] Baselines are measured, not estimated.

---

## 2. Users, roles and permissions

**Purpose:** know who does what, so authorisation is designed rather than bolted on.

**Answer these:**
- Which kinds of user exist (end user, admin, support, partner, system/service)?
- What may each role see and do? Can a user hold several roles, or different roles in different groups or tenants?
- Who can grant or revoke a role, and is that action audited?

**Fill in:** a permissions matrix (rows = actions, columns = roles; mark ✅ / ❌ / "own only").

| Action | {{Role A}} | {{Role B}} | {{Admin}} | {{Support}} |
| --- | --- | --- | --- | --- |
| {{e.g. view group balance}} | | | | |

**Done when:**
- [ ] [MVP] Every action in §3's user journeys appears in the matrix.
- [ ] [MVP] Default is deny: any action not in the matrix is refused.
- [ ] [MVP] Support/admin access to user data is listed and audited (§8).
- [ ] [SCALE] Delegated or custom roles are designed, if the trigger applies.

---

## 3. Scope and user journeys

**Purpose:** turn goals into concrete, testable features, and fence off what is out.

**Answer these:**
- Which journeys must work end to end for the first release?
- Which features are in, which are later, and which are never?
- What does "done" mean for each feature (acceptance criteria)?
- Which journeys must work offline or on a poor connection?

**Fill in:**

| ID | Feature / journey | In / Later / Never | Acceptance criteria (Given / When / Then) | Roles (§2) | Offline? |
| --- | --- | --- | --- | --- | --- |
| J1 | {{sign up and join a group}} | In | {{…}} | | |

For each **In** journey, add a numbered step list or a flow diagram (happy path, plus at least the main error path).

**Done when:**
- [ ] [MVP] Every **In** journey has acceptance criteria that a tester could check.
- [ ] [MVP] Every **In** journey maps to at least one goal in §1, and journeys that serve no goal are cut.
- [ ] [MVP] Error and empty states are listed for each journey (no network, no data, permission denied).
- [ ] [SCALE] Later features are ranked.

---

## 4. Non-functional requirements

**Purpose:** set the quality bar (speed, uptime, scale, accessibility) before choosing tech, because it drives the choice.

**Answer these:**
- **Performance:** how fast must the key screens or APIs respond, and at which percentile?
- **Availability:** what uptime do users need, and are there quiet hours when maintenance is allowed?
- **Scale:** how many users, requests and how much data at launch, and at the scale trigger?
- **Devices:** which OS versions, browsers and screen sizes, and how good must it be on a low-end phone or slow network?
- **Accessibility:** which standard? A common choice is WCAG 2.2 Level AA (a W3C Recommendation; the current edition is dated 12 Dec 2024).
- **Languages, locales, currencies, time zones.**
- **Data residency:** must the data stay in a particular country or region?

**Fill in:**

| Requirement | TARGET | Owner | How it will be verified |
| --- | --- | --- | --- |
| p95 latency, key API | {{… ms}} | | {{load test, §10}} |
| Availability (monthly) | {{… %}} | | {{SLO, §11}} |
| Launch users / peak RPS | {{…}} | | |
| Min OS / browser | {{…}} | | {{device matrix}} |
| Accessibility | {{WCAG 2.2 AA}} | | {{audit tool + manual check}} |
| Data residency | {{…}} | | |

**Done when:**
- [ ] [MVP] Every requirement is a labelled TARGET with an owner and a verification method.
- [ ] [MVP] The architecture in §6 shows how each target is met, or the target is lowered on record.
- [ ] [SCALE] Load test results are recorded as FACTs in §18.

---

## 5. Domain and data model

**Purpose:** get the data right. Data outlives code, and mistakes in it are the most expensive to undo.

**Answer these:**
- What are the core entities, their relationships, and which service owns each?
- Which fields are personal or sensitive data, and why do we need each one?
- How long is each kind of data kept, and how is it deleted (including from backups)?
- How do schema changes ship without downtime?
- What are the money or ledger rules, if any (immutability, rounding, currency, reconciliation)?

**Fill in:**
- An entity-relationship diagram (link or embed).
- A data inventory:

| Entity / field group | Owner service | Classification (Public / Internal / Personal / Sensitive) | Purpose | Retention | Deletion method |
| --- | --- | --- | --- | --- | --- |
| {{…}} | | | | | |

- **Migration policy:** the default is *expand → migrate → contract*. Ship additive schema first, then backfill, then switch code, and drop old columns only in a later release.

**Done when:**
- [ ] [MVP] Every personal or sensitive field has a stated purpose and retention period.
- [ ] [MVP] Migrations are versioned in the repo, run automatically in CI/CD (§9), and are backward compatible with the previous release.
- [ ] [MVP] For money or ledger data: records are append-only, and corrections are new entries.
- [ ] [SCALE] An archival or partitioning plan is written for the largest tables.

---

## 6. Architecture

**Purpose:** show how the system is built, and record *why* each major choice was made.

**Answer these:**
- What are the deployable parts (web, API, worker, database, cache, queue, storage), and how do they talk?
- What runs synchronously in the request, and what runs async in workers or queues?
- Which external services do we depend on, and what happens when each is down?
- What is the simplest architecture that meets §4? (Prefer a modular monolith until a SCALE trigger justifies splitting.)
- Where are the single points of failure?

**Fill in:**
- **C4 diagrams** (c4model.com, Simon Brown). Level 1 *System context* and Level 2 *Container* are [MVP]. Level 3 *Component* is [SCALE]. Level 4 *Code* is optional.
- A tech-stack table. Each row links an ADR (Appendix A):

| Concern | Choice | ADR | Alternatives considered |
| --- | --- | --- | --- |
| Client(s) | | | |
| API | | | |
| Background jobs | | | |
| Database | | | |
| File storage | | | |
| Hosting / runtime | | | |
| Edge / DNS / TLS | | | |

- **Single points of failure:**

| Component | Failure impact | Mitigation now | Mitigation at SCALE trigger |
| --- | --- | --- | --- |
| {{…}} | | | |

**Done when:**
- [ ] [MVP] The context and container diagrams match what will actually be deployed: every box is real, and nothing real is missing.
- [ ] [MVP] Each tech choice has an ADR with its consequences.
- [ ] [MVP] Every external dependency has a stated failure behaviour (degrade, queue and retry, or hard fail).
- [ ] [SCALE] Every single point of failure has a mitigation, or an accepted risk in §16.

---

## 7. APIs, contracts and integrations

**Purpose:** define the seams between clients, services and third parties so they can change without breaking each other.

**Answer these:**
- What is the API style (REST, GraphQL, RPC), and where does the contract live (e.g. an OpenAPI file in the repo)?
- How is the API versioned? How long must old versions keep working?
  - **Mobile:** old app versions stay on phones for a long time, so this is not optional.
- Which operations must be **idempotent** (payments, joins, anything retried)? How is that enforced (an idempotency key)?
- What are the rate limits, pagination, error format and timeouts?
- For each third-party integration: what do we send, what do we get back, which webhooks arrive, how are they verified, and what happens when the third party is down?

**Fill in:**

| Integration | Purpose | Data sent (classification §5) | Auth method | Failure behaviour | Owner |
| --- | --- | --- | --- | --- | --- |
| {{…}} | | | | | |

**Done when:**
- [ ] [MVP] The contract is in the repo, and CI fails if the implementation drifts from it.
- [ ] [MVP] There is a written compatibility rule, e.g. "only additive changes within a major version; the oldest supported app version is `{{x}}` (§13)".
- [ ] [MVP] Retry-prone writes are idempotent, and incoming webhooks are signature-verified.
- [ ] [SCALE] Consumer-driven contract tests run between services.

---

## 8. Identity, security and privacy

**Purpose:** decide how users are identified, what each may access, and how data and secrets are protected. Do it before code exists.

**Answer these:**
- **Authentication:** password, magic link, OTP, social or SSO? MFA for whom? How do sessions or tokens expire and get revoked?
- **Authorisation:** where is the §2 matrix enforced (server-side, always)? How is tenant/group isolation guaranteed?
- **Secrets:** where do they live, who can read them, and how are they rotated? Never in the repo or in images.
- **Threat model:** what could go wrong per component? STRIDE is one common checklist: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.
- **Verification standard:**
  - Web and API: OWASP ASVS 5.0.0 (released 30 May 2025). Choose a level.
  - Mobile: OWASP MASVS v2.1.0 (Jan 2024).
  - Review against OWASP Top 10:2025.
- **Supply chain:** dependency scanning, pinned versions, signed or attested builds.
- **Privacy law:** which apply (e.g. POPIA in South Africa, GDPR in the EU)? What is the lawful basis, how are consents recorded, how are data-subject requests handled, who is the information officer, and what is the breach-notification process?
- **Audit log:** which actions are recorded (logins, role changes, money movements, admin access), and is the log tamper-evident?

**Fill in:**

| Threat (STRIDE) | Component | Mitigation | Verified by | Status |
| --- | --- | --- | --- | --- |
| {{…}} | | | | |

| Control | Choice / TARGET | Evidence |
| --- | --- | --- |
| ASVS level | {{1 / 2 / 3}} | |
| Secrets store | | |
| Admin access path (no open ports? VPN / zero-trust?) | | |
| Privacy laws in scope | | |

**Done when:**
- [ ] [MVP] Authorisation is enforced server-side for every action in §2, and tests prove a user cannot read another tenant's data.
- [ ] [MVP] No secret appears in the repo, images or logs (a secret scanner runs in CI).
- [ ] [MVP] Dependency and container scanning run in CI and block on critical findings.
- [ ] [MVP] Privacy notice, consent records and a deletion path exist for the laws in scope.
- [ ] [MVP] Admin/server access works without exposing inbound ports to the internet, or the exposure is an accepted risk in §16.
- [ ] [SCALE] An external penetration test is done, and its findings are tracked to closure.

---

## 9. Environments, branching and delivery

**Purpose:** make the path from commit to production automatic, repeatable and reversible.

**Answer these:**
- Which environments exist, and is each one isolated (separate data, secrets and, ideally, hosts)?
- Which branch or tag deploys where?
- Is the **same build artefact** promoted from staging to production, or is it rebuilt? (It should be promoted.)
- How do database migrations run, and what happens if one fails mid-deploy?
- Are risky features shipped behind **feature flags**?
- Is infrastructure defined as code? Is config read from the environment (Twelve-Factor, 12factor.net)?

**Fill in:**

| Environment | Purpose | Trigger | Host(s) | Database | Who can access | Data |
| --- | --- | --- | --- | --- | --- | --- |
| Local | dev | — | laptop | local / branch | dev | seed |
| Preview | per-PR review | PR opened | | branch | team | seed |
| Staging | pre-release validation | merge to `{{staging}}` / RC tag | | | team + testers | anonymised / seed |
| Production | users | promote approved build | | | public | real |

**Pipeline** (write it as stages; each must pass before the next):
1. Lint, type check, unit tests.
2. Build the image once and tag it with the **git commit SHA**. Mutable tags like `latest` are for humans, never for deploys.
3. Integration and contract tests, plus security scans (§8, §10).
4. Deploy that **image digest** to staging, run migrations, run smoke and health checks.
5. Approval gate (manual or automated).
6. Promote **the same digest** to production with a rolling or blue-green deploy, then health-check and auto-rollback on failure.

**Done when:**
- [ ] [MVP] A deploy to any environment is one automated action. There are no manual SSH steps.
- [ ] [MVP] Production runs a digest that ran in staging first, and you can show which commit is live.
- [ ] [MVP] Each environment has separate secrets and separate data. Staging never touches production data.
- [ ] [MVP] Branch names describe environments, not vendors (e.g. `staging`, not the hosting provider's name).
- [ ] [SCALE] Staging and production run on separate hosts or accounts.
- [ ] [SCALE] Infrastructure as code for everything that is not clicked together in a console.

---

## 10. Testing and quality strategy

**Purpose:** decide what proves the app works, and which failures block a merge or a release.

**Answer these:**
- What is tested at each layer: unit, integration (with a real DB), contract, end-to-end on key journeys, manual exploratory?
- What blocks a merge, and what blocks a release?
- Where does test data come from? Never copy production personal data.
- How are performance (§4), accessibility (§4) and security (§8) checked?
- How do we know the tests can actually fail? (Mutation testing, or deliberately breaking code during review.)

**Fill in:**

| Layer | Tool | Runs when | Blocks | Owner |
| --- | --- | --- | --- | --- |
| Unit | | every push | merge | |
| Integration | | every PR | merge | |
| E2E (journeys J…) | | before release | release | |
| Load | | {{trigger}} | release | |
| Accessibility | | every PR / release | | |
| Security scans | | every PR | merge (critical) | |

**Done when:**
- [ ] [MVP] Every **In** journey from §3 has at least one automated E2E or integration test.
- [ ] [MVP] CI is required to pass before merging to the main branch (branch protection on).
- [ ] [MVP] Flaky tests are quarantined and tracked, never silently retried forever.
- [ ] [SCALE] A load test proves the §4 targets, and the result is recorded as a FACT.

---

## 11. Observability and operations

**Purpose:** know the app is broken before users tell you, and know why.

**Answer these:**
- What is logged, in what format (structured), where, and for how long? How is personal data kept out of logs?
- Which metrics and traces exist per service?
- **SLIs and SLOs** (Google SRE book, ch. 4):
  - An SLI is a measured indicator of service level.
  - An SLO is the target value for an SLI.
  - An SLA is a contract that attaches consequences to SLOs.
  - Which of these do we commit to?
- Who gets alerted, how, and for what? Alerts should be about user-visible symptoms, not every CPU spike.
- Which dashboards exist? Who looks at them, and when?
- Which runbooks exist for the likely failures?

**Fill in:**

| SLI | SLO (TARGET) | Window | Alert when | Goes to |
| --- | --- | --- | --- | --- |
| {{successful API requests / total}} | | 30 days | | |
| {{p95 latency key endpoint}} | | | | |

**Done when:**
- [ ] [MVP] Uptime monitoring from *outside* the server checks the public URL, and it alerts a human.
- [ ] [MVP] Errors are captured with release/commit info, so a spike points at a deploy.
- [ ] [MVP] Logs are structured and centralised, and contain no secrets or unmasked personal data.
- [ ] [MVP] There are runbooks for: app down, DB unreachable, disk full, bad deploy, leaked secret.
- [ ] [SCALE] SLOs with error budgets are reviewed on a schedule, plus an on-call rota.

---

## 12. Resilience: backups, disaster recovery and rollback

**Purpose:** decide in advance how much data and downtime are acceptable, and prove you can recover.

**Answer these:**
- **RPO** (how much data loss is acceptable) and **RTO** (how long you may be down) per data store.
- What is backed up: databases, file volumes, secrets, config? Where to, how often, and kept for how long? Are copies off-site?
- How is a restore *tested*, and when was it last tested?
- How do you roll back:
  - the **app**: redeploy the previous digest;
  - the **database**: forward-fix or restore, because migrations are not always reversible;
  - the **mobile app**: you can't recall a store release, so use a feature flag, a server-side kill switch or a forced update.
- What is the incident process: who leads, how are users told, and when is the post-incident review?

**Fill in:**

| Data store | RPO (TARGET) | RTO (TARGET) | Backup method + frequency | Off-site copy | Last restore test (FACT, date) |
| --- | --- | --- | --- | --- | --- |
| {{…}} | | | | | NOT MEASURED |

**Done when:**
- [ ] [MVP] Every data store from §6 has a backup, and a restore has been performed and timed at least once (recorded as a FACT).
- [ ] [MVP] App rollback to the previous release is one action, and it has been done once in staging.
- [ ] [MVP] Mobile clients have a server-controlled kill switch or minimum-version check (§13).
- [ ] [SCALE] A scheduled restore drill, plus a regional or host failover plan.

---

## 13. Client release and distribution

**Purpose:** plan how users actually get each client and its updates. For mobile, this pipeline is separate from the server's.

**Answer these:**
- **Web:** how is it deployed and cached, and how are users moved to a new version?
- **Mobile:** which build service, store accounts, signing keys (who holds them, and the backup)? How long do store reviews take?
- Is over-the-air (OTA) updating allowed for JS/asset changes, and within each store's rules?
- What is the version scheme? E.g. Semantic Versioning (semver.org) plus a build number.
- What is the **minimum supported version**? How is a forced or soft update triggered?
- What is the release cadence, staged rollout percentage and crash-rate stop condition?

**Fill in:**

| Client | Build | Distribution | Version scheme | Min supported version rule | Rollout | Halt condition |
| --- | --- | --- | --- | --- | --- | --- |
| Web | | | | | | |
| iOS | | App Store / TestFlight | | | | |
| Android | | Play Store / internal testing | | | | |

**Done when:**
- [ ] [MVP] Store accounts exist, signing keys are stored with a recovery path, and at least two people can release.
- [ ] [MVP] The app calls a version-check endpoint, and the server can require an update.
- [ ] [MVP] A beta channel (TestFlight / internal testing) is used before every public release.
- [ ] [SCALE] Staged rollouts with automatic halt on crash-rate regression.

---

## 14. Cost and capacity

**Purpose:** know what the app costs to run now and at the scale trigger, so there are no surprises.

**Answer these:**
- What does each environment cost per month, by line item (hosting, DB, storage, egress, third-party APIs, store fees, domains)?
- What is the cost per active user, or per unit of work, at launch and at the trigger?
- Which line items grow with usage, and which are fixed?
- Which budget alerts exist, and who receives them?

**Fill in:**

| Line item | Env | Pricing basis (source + date) | Monthly cost (FACT from invoice/calculator, or NOT MEASURED) | Grows with |
| --- | --- | --- | --- | --- |
| {{…}} | | | | |

**Done when:**
- [ ] [MVP] Every paid service is listed with its pricing source and date.
- [ ] [MVP] Budget or usage alerts are set on every metered service.
- [ ] [SCALE] Cost per active user is tracked monthly.

---

## 15. Team, process and delivery plan

**Purpose:** decide who does what and in what order, and how progress is checked.

**Answer these:**
- Who owns each section of this blueprint and each running component?
- How does work flow: issue → branch → PR → review → merge → deploy? What is the definition of done?
- What are the milestones? For each: how do we verify it is done, and when do we stop and re-plan?
- Which delivery metrics are tracked? DORA's five are change lead time, deployment frequency, failed deployment recovery time, change fail rate and deployment rework rate (dora.dev).

**Fill in:**

| Milestone | Contents (§3 IDs) | Verification (observable) | Stop condition (when to stop and ask) | TARGET date | Owner |
| --- | --- | --- | --- | --- | --- |
| M1 Walking skeleton | 1 journey deployed through full pipeline to staging | {{staging URL serves J1; pipeline green}} | {{pipeline not automatable → revisit §9}} | | |
| M2 MVP | | | | | |
| M3 Launch | §17 all [MVP] ticked | | | | |

**Done when:**
- [ ] [MVP] Every milestone has a verification someone else can check, and a stop condition.
- [ ] [MVP] The first milestone is a *walking skeleton*: one thin journey through the full pipeline to staging, built before any feature work.
- [ ] [SCALE] DORA metrics are reported monthly.

---

## 16. Risks and decisions

**Purpose:** make risks and open choices visible, owned and dated, rather than discovered in production.

**Risk register:**

| ID | Risk | Likelihood (L/M/H) | Impact (L/M/H) | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | {{…}} | | | | | Open / Accepted / Closed |

**Decisions needed** (each decision, once made, becomes an ADR in Appendix A):

| ID | Decision | Options | Recommendation | Evidence | Decided by | Date |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | {{…}} | | | | | |

**Done when:**
- [ ] [MVP] Every single point of failure (§6) and every unchecked [MVP] item that ships anyway is in the register as an *accepted* risk with an owner.
- [ ] [MVP] No open decision blocks the next milestone.

---

## 17. Launch readiness (go / no-go)

Tick all of these before real users are let in. Each line points to the section that proves it.

- [ ] [MVP] Goals and metrics are instrumented, and events fire in staging (§1).
- [ ] [MVP] Every **In** journey passes its acceptance criteria in staging (§3, §10).
- [ ] [MVP] The authorisation matrix is enforced, and the cross-tenant test passes (§2, §8).
- [ ] [MVP] No critical vulnerabilities are open, and no secrets are in the repo or images (§8).
- [ ] [MVP] Privacy notice is published, and the deletion path works (§8).
- [ ] [MVP] Production runs the digest validated in staging (§9).
- [ ] [MVP] External uptime monitor and error tracking are alerting a human (§11).
- [ ] [MVP] A backup restore and an app rollback have each been performed once (§12).
- [ ] [MVP] Mobile: store listings are approved, the version check works, and the beta was tested (§13).
- [ ] [MVP] Budget alerts are on (§14).
- [ ] [MVP] The risk register is reviewed, and the remaining risks are accepted by the owner (§16).
- [ ] [MVP] Support contact and an incident comms path exist (§12).

**Decision:** Go / No-go — {{name}}, {{date}}

---

## 18. Facts register and not measured

**Facts register:** every FACT cited in this document.

| ID | Fact | Source (command, tool, invoice, URL + date, document) | Recorded by | Date |
| --- | --- | --- | --- | --- |
| F1 | {{…}} | | | |

**Not measured / not checked:** everything assumed or unverified, said plainly. Write "nothing" only if it is true.

- {{e.g. peak concurrent users: NOT MEASURED, estimate only}}

---

## 19. Before executing this blueprint

Before building from this blueprint, or from any milestone in it, the person doing the work first analyses the scope and presents it. Nothing is built until this is done.

1. **Scope covered:** which sections and milestones this piece of work implements, and which it does not.
2. **What it entails:** the concrete changes (code, infrastructure, accounts, data), and the risk of getting each wrong.
3. **What is in it now:** the current state of the code and infrastructure it touches, cited from the repo or tools, not memory.
4. **How it connects:** each change mapped to its journey (§3), requirement (§4), and verification (§10 / *Done when*).

**Stop and ask** if the blueprint and reality disagree, a change has no section that justifies it, or a section has no change that delivers it.

---

## Appendix A — ADR template

> One file per decision, e.g. `docs/adr/0001-use-postgres.md`. This follows the format in Michael Nygard's
> "Documenting Architecture Decisions" (2011).

```markdown
# ADR {{NNNN}}: {{short noun phrase}}

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR {{NNNN}}
**Date:** {{YYYY-MM-DD}}

## Context
{{The forces at play: requirements (§4), constraints, facts (F#). Stated neutrally.}}

## Decision
{{We will … — full sentences, active voice.}}

## Consequences
{{What becomes easier, what becomes harder, what we must now do. Positive, negative and neutral.}}
```

## Appendix B — Glossary

| Term | Meaning |
| --- | --- |
| ADR | Architecture Decision Record: a short document recording one decision, its context and consequences. |
| C4 | A model for software architecture diagrams at four levels: system context, container, component, code. |
| Digest | The content hash of a container image. Unlike a tag, it can never point at different contents. |
| Expand / contract | Schema change pattern: add new structure, migrate, switch code, then remove old structure in a later release. |
| Idempotent | Doing the same request twice has the same effect as doing it once. |
| RPO / RTO | Recovery Point Objective (max acceptable data loss) / Recovery Time Objective (max acceptable downtime). |
| SLI / SLO / SLA | Indicator measured / objective (target) for it / agreement with consequences. |
| Walking skeleton | The thinnest possible end-to-end slice of the system, deployed through the real pipeline. |

## Appendix C — References

Checked on 2026-10-20 unless marked otherwise.

- C4 model — Simon Brown: <https://c4model.com/>
- Michael Nygard, "Documenting Architecture Decisions" (15 Nov 2011): <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
- Google SRE book, ch. 4 "Service Level Objectives": <https://sre.google/sre-book/service-level-objectives/>
- DORA software delivery metrics: <https://dora.dev/guides/dora-metrics/>
- OWASP ASVS (5.0.0, 30 May 2025): <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP MASVS (v2.1.0, Jan 2024): <https://mas.owasp.org/news/2024/01/18/masvs-v210-release--masvs-privacy/>
- OWASP Top 10:2025: <https://owasp.org/Top10/2025/>
- WCAG 2.2 (W3C Recommendation; current edition dated 12 Dec 2024, first published as a Recommendation 5 Oct 2023 per secondary sources): <https://www.w3.org/TR/WCAG22/>
- The Twelve-Factor App: <https://12factor.net/> *(not re-checked this session)*
- Semantic Versioning: <https://semver.org/> *(not re-checked this session)*
