# supabase/proposed/ — PROPOSED / NOT APPLIED

**Nothing in this folder has been applied to any live database.** These files are for the owner's backend reviewer.

| File | What it is |
| --- | --- |
| `00_mock_supabase.sql` | TEST HARNESS ONLY: fakes the bits of Supabase (roles, `auth.uid()`, `auth.jwt()`) so the policies can be tested on a plain local Postgres. Never run on a real Supabase project. |
| `10_rls_policies.sql` | Proposed tenant isolation + role model (RLS on every table, deny by default, church_id checked from memberships). Passed 31/31 tests on a local throwaway Postgres (`run_rls_tests.sh`). |
| `PROPOSAL_v43_item7_live_queue.sql` | Proposal only, never run anywhere: live-mode support for several people served at one station (places), and server-side tidy-up of finished queue rows. |
| `run_rls_tests.sh`, `test_rls.py` | The local test runner (throwaway Postgres; no network). |

Before applying anything: review, run on a staging project, take a backup, then apply yourself.
