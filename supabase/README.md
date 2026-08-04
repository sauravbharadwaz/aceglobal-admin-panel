# Database changes

Schema changes go through the Supabase CLI, not the SQL Editor. The CLI keeps a
record on the server of which migrations have run, so the repo and production
can't quietly drift apart.

## One-time setup

Not done yet — until it is, the two files still sitting in this folder have to
be pasted into the SQL Editor by hand. Run these once, in order:

```bash
# 1. Apply the two outstanding changes the old way (the last time you'll do this).
#    Paste each into the Supabase SQL Editor and run it:
#      supabase/client-business-details.sql
#      supabase/reorder-formation-stages.sql

# 2. Log in and attach this repo to the project.
npx supabase login
npx supabase link --project-ref sngubnhkrexlteqpevjc   # asks for the database password

# 3. Snapshot production as the starting point. Writes
#    supabase/migrations/<timestamp>_remote_schema.sql and records it as applied,
#    so nothing re-runs against the live database.
npm run db:pull

# 4. Commit that baseline, then delete the two files from step 1 — they're
#    inside the snapshot now.
```

`archive/` holds the SQL files that built the database before this. They're kept
for reference only; the baseline from step 3 is the source of truth. Nothing in
`archive/` should ever be run again.

## Making a change from now on

```bash
npm run db:new -- add_client_tax_id     # creates supabase/migrations/<ts>_add_client_tax_id.sql
# write the SQL in that file
npm run db:push                          # applies only what production is missing
```

Commit the migration file with the code that depends on it. A migration that's
been pushed is history — never edit it; write another one on top.

## Checking for drift

```bash
npm run db:diff     # prints SQL that production has and the repo doesn't
```

Silence means the repo and production agree. Output means somebody changed the
database by hand — capture it with `npm run db:diff -- -f <name>` to turn it
into a real migration.

## Conventions

- Additive and idempotent where it's cheap: `add column if not exists`,
  `create table if not exists`, `drop policy if exists` before `create policy`.
  It makes a re-run harmless.
- A migration that rewrites existing rows (like the formation-stage reorder)
  is *not* idempotent — guard it, as that one does with `schema_migrations`.
- Every table needs RLS. This database is reached directly from the browser by
  the client dashboard, so a policy is the only thing standing between a client
  and someone else's row.
