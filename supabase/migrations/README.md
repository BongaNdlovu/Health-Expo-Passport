# Database migrations

`../schema.sql` is the whole database, safe to run again on any copy. These files are the **changes**, one per
release that touches the database, so you can see which version a database runs and apply only what is new.

| File | What it does |
|---|---|
| `20261113_baseline.sql` | `schema.sql` as of 2026-11-13. The live database was checked against it on 2026-11-17. Do not run it on the live database. |
| `20261117_queue_move_guard.sql` | G-1: the database refuses queue moves the app never makes (for example waiting straight to done). Also creates `public.schema_migrations`. |

## Applying a new one

1. See what the database already has, in the Supabase SQL editor:
   `select version, applied_at from public.schema_migrations order by version;`
   (an error that the table does not exist means only the baseline has run).
2. Paste each newer file, oldest first, into the SQL editor and run it. Each one is safe to run twice.
3. Run the query from step 1 again: the new version is listed.

## Adding one

1. Make the change in `schema.sql` (it stays the full current state; `npm test` runs it in PGlite).
2. Copy the same statements into a new file named `YYYYMMDD_short_name.sql`, ending with
   `insert into public.schema_migrations (version) values ('YYYYMMDD_short_name') on conflict do nothing;`
3. Add the same version to the list near the end of `schema.sql` (section MIGRATIONS APPLIED). `npm test` checks that
   every file here is listed there.
