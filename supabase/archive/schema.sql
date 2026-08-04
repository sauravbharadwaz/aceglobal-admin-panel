-- ============================================================================
-- Ace Global Admin — database schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LEADS  (inbound contact submissions from the marketing site)
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text,
  phone       text,
  company     text,
  service     text,                       -- e.g. company-formation, bookkeeping, corporate-taxes
  message     text,
  source      text not null default 'website',
  status      text not null default 'new'
              check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes       text
);

-- ---------------------------------------------------------------------------
-- CLIENTS  (active customers managed by the team)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text,
  phone       text,
  company     text,
  status      text not null default 'active'
              check (status in ('active', 'onboarding', 'inactive', 'churned')),
  plan        text,                        -- starter | growth | enterprise
  mrr         numeric not null default 0,  -- monthly recurring revenue (USD)
  owner       text,                        -- account manager
  notes       text
);

create index if not exists leads_status_idx   on public.leads (status);
create index if not exists leads_created_idx   on public.leads (created_at desc);
create index if not exists clients_status_idx  on public.clients (status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- This is an internal tool: every authenticated staff member has full access.
-- ---------------------------------------------------------------------------
alter table public.leads   enable row level security;
alter table public.clients enable row level security;

drop policy if exists "authenticated full access" on public.leads;
create policy "authenticated full access" on public.leads
  for all to authenticated using (true) with check (true);

-- The public marketing site submits leads as the anonymous role.
-- Insert-only: anon can create leads but cannot read, update, or delete them.
drop policy if exists "anon can submit leads" on public.leads;
create policy "anon can submit leads" on public.leads
  for insert to anon with check (true);

drop policy if exists "authenticated full access" on public.clients;
create policy "authenticated full access" on public.clients
  for all to authenticated using (true) with check (true);

-- No seed data — the panel starts empty and fills with real leads/clients.
