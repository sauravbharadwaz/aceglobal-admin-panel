# Ace Global — Admin Panel

Internal admin for Ace Global: leads pipeline, client management, and a performance dashboard.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Supabase (Postgres + Auth).

---

## Getting started

### 1. Create a Supabase project
Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.

### 2. Create the database
In the Supabase dashboard, open **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the `leads` and
`clients` tables, row-level security policies, and some seed data.

### 3. Configure environment variables
```bash
cp .env.local.example .env.local
```
Fill in the two values from **Project Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Create a staff login
In **Authentication → Users → Add user**, create an account (e.g. `saurav@aceglobal.ai`)
with a password. This is the account you'll sign in with. (There is intentionally no public
sign-up in this admin.)

### 5. Run it
```bash
npm install
npm run dev
```
Open http://localhost:3000 and sign in.

> Until `.env.local` is filled in, the app shows a setup screen instead of crashing.

---

## How it works

- **Auth & route protection** — `proxy.ts` (Next.js 16's rename of Middleware) refreshes the
  Supabase session on every request and redirects unauthenticated users to `/login`. The
  `(admin)` layout re-verifies the user server-side.
- **Data** — read in Server Components via `lib/data.ts`; writes go through Server Actions
  (`app/(admin)/**/actions.ts`) which call `revalidatePath` so the UI stays in sync.
- **Access model** — this is an internal tool, so RLS grants every authenticated staff
  member full access to both tables. Tighten the policies in `schema.sql` if you need
  per-user scoping.

## Project structure
```
app/
  (admin)/            protected area (top-nav layout + auth guard)
    dashboard/        KPIs, lead pipeline, recent activity, performance chart
    leads/            leads table + inline status, add, delete
    clients/          clients table + full CRUD
  login/              email/password sign-in
lib/supabase/         browser, server, and proxy clients
supabase/schema.sql   database schema + seed
```
