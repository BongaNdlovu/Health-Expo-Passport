# dsh-truth-guard

A small, host-plane DeepSeek Harness plugin that makes specific kinds of
unsupported reporting visible and correctable.

It is **not** a truth oracle. It cannot prove that prose is true. It checks the
session log for evidence of the claims that agents most often fake:

- “tests/build/lint/typecheck passed” with no successful command in the turn;
- a check that ran **before** the last file edit (stale verification);
- a passing test claim after modifying tests/fixtures without disclosing it;
- bypass flags such as `--no-verify`, `--passWithNoTests`, `|| true`, or `exit 0`;
- a cited URL that never appeared in the user message or a tool result.

When it finds one, it queues one correction turn that names the missing evidence
and requires the model to either run the check or label the claim unverified.

## What the model sees

A system-prompt section, `truth-guard:contract`, at order 50. It states the
evidence standard: only tool results, read files, and the user’s message count
as observation; verification must run after the last change; invented URLs,
paths, outputs, and citations are defects; test changes must be disclosed; and
finished work must include an **Evidence** section or say that nothing was run.

## Configuration

The plugin accepts optional config; defaults are shown.

```yaml
- id: truth-guard
  name: dsh-truth-guard
  config:
    enabled: true
    promptContract: true
    auditUrls: true
    auditTestTampering: true
    auditBypass: true
```

`enabled: false` keeps the prompt contract but disables the idle audit.
`promptContract: false` keeps the audit but removes the prompt section.

## Install

The plugin is a normal ESM package. It must be resolvable from the target DSH
profile, then inserted as a host-plane row. For example, in
`$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- insert:
    - id: truth-guard
      name: dsh-truth-guard
```

Then install the package into that profile (or copy it under the profile’s
`node_modules`). It has no package dependencies; it uses only Node built-ins.

## Test evidence

Run from this directory with the system Node (the DSH sandbox cannot spawn the
Node test runner’s children):

```sh
node test/audit.test.js
node test/integration.mjs
node test/smoke.mjs
```

Observed results on 2026-10-18:

- `audit.test.js`: 16 tests, 16 passed, 0 failed.
- `integration.mjs`: one correction queued for an unsupported claim; none for a
  supported claim, a subagent, or a correction turn.
- `smoke.mjs`: the dependency-free module imports and registers the prompt
  section and both listeners.

These are unit/integration checks against constructed session events, not a
live-model benchmark. They prove the detector behaves as written; they do not
prove a model will stop lying.

## Limits

- **Semantic falsehoods are out of scope.** A wrong explanation, a misread API,
  or a fabricated function name can pass if it is not a verification claim or a
  URL.
- **The first wrong answer is still shown.** The gate queues a correction turn;
  it does not block the original message before display.
- **Shell edits are opaque.** A file changed through `bash`/`pwsh` redirection is
  not treated as a mutation, so stale-verification detection may miss it.
- **Here-doc/here-string payloads are stripped before command classification.**
  Writing a test file that contains the literal text of a bypass flag is not
  treated as running one. This was added after a live false positive.
- **PTC inner calls are not parsed.** The standard native tool presentation is
  covered; a `run_code` outer call is not decomposed into its inner calls.
- **Claim detection is heuristic.** It is deliberately conservative (modals and
  questions are ignored), so some claims will be missed; unusual phrasing can
  also produce a false positive. A false positive costs one correction turn.
- **One correction per human turn.** The correction turn itself is not audited
  again, to avoid loops. A model that repeats the lie in its correction will not
  be corrected a second time by this version.
- **Subagents are skipped.** Their output is reviewed by the parent, not shown
  directly to the user; auditing them would also fight delegation.
- **No persistence or telemetry.** Findings are logged through the normal DSH
  logger; no new session event type or external call is created.

## Why not a model judge?

A second model can hallucinate a verdict about the first. This gate uses only
committed facts: which command ran, in what order, what the result said, and
which URLs the model actually received. That makes its findings reproducible
and auditable. The tradeoff is narrower coverage.
