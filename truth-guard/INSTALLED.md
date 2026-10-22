# Deployment record — 2026-10-18

## Active installation

- **Desktop profile (the running GUI):** the package is installed as a real
  directory at `~/.dsh/profiles/desktop/node_modules/dsh-truth-guard`, and the
  `truth-guard` insert is in `~/.dsh/profiles/desktop/cordis.patch.yml`.
- **Web profile (`dsh web`):** its patch row points at the desktop profile's
  installed entry file:
  `~/.dsh/profiles/desktop/node_modules/dsh-truth-guard/lib/index.js`.
  It has no package dependency of its own, so it does not rely on the
  workspace remaining in place.
- **Model:** unchanged. `deepseek-flash`, `reasoningEffort: max`.

## Verification observed

- `node test/audit.test.js` → 16 tests, 16 passed, 0 failed.
- `node test/integration.mjs` → correction queued for an unsupported claim;
  none for a supported claim, a subagent, or a correction turn.
- `node test/smoke.mjs` → prompt section and both listeners register.
- `dsh --profile web --dump-config` → exit 0 with the `truth-guard` row.
- The current desktop session's persisted latest `system/message` (seq 899)
  contains `Truth and evidence contract`; the plugin is mounted in the live
  GUI, not just written to disk.
- `dsh --profile desktop --dump-config` is unavailable because the Electron
  application owns that profile; activation was verified from the session log
  instead.
- The fixed desktop detector file matches the workspace source
  (`SHA-256 31A79B7B…D8139`).

### Live-audit incident (2026-10-18)

The gate's first live correction was a **false positive**. It scanned the
here-string used to restore the test files and read the embedded
`--no-verify` / `--passWithNoTests` fixtures as if they were a bypass command.
The actual test runs used plain `node test/...` commands and no bypass.

Fixed by adding `stripShellPayloads()` before command classification and by
requiring a bypass finding to come from a verification or Git command.
Regression tests: a here-string payload is neither a test run nor a bypass; a
plain `echo --no-verify` is not a verification bypass. The installed desktop
copy now matches the fixed source, but the running process still has the
previous detector in memory until the app is restarted.

These checks prove the gate behaves as written on constructed session events
and that the live desktop prompt contains the contract. They do **not** prove
that a live model can never lie; see `README.md` for the exact scope.

## Rollback

1. Remove the `truth-guard` insert block from
   `~/.dsh/profiles/desktop/cordis.patch.yml` and
   `~/.dsh/profiles/web/cordis.patch.yml`.
2. Optionally run:
   `dsh plugin --profile desktop remove dsh-truth-guard`
3. Restart the desktop app (or let profile HMR apply the removal).

Removing only the prompt section but leaving the audit enabled is possible with
`promptContract: false`; removing only the audit but keeping the contract is
possible with `enabled: false`.

## Caveat

The desktop package was installed from `file:C:/Users/fanel/Downloads/Health Expo/truth-guard`.
If that workspace is deleted, the installed copy keeps running, but a later
`pnpm install` / profile reconciliation may fail to find the source. Keep the
`truth-guard` folder or reinstall from a stable location first.
