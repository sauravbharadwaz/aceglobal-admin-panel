<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database changes

Never tell anyone to paste SQL into the Supabase SQL Editor. Schema changes are
migrations: `npm run db:new -- <name>`, write the SQL in the generated file,
`npm run db:push`. See `supabase/README.md`. `supabase/archive/` is history —
don't run anything in it, and don't edit a migration that has already been
pushed.

The client dashboard (app.aceglobal.ai) queries this database straight from the
browser, so RLS is its only access control. Every new table needs a policy.
