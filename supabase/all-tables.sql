-- ============================================================================
-- Ace Global Admin — ALL remaining tables in one script.
-- Safe to run anytime: uses "create table if not exists" and idempotent policies.
-- Run this once in the Supabase SQL Editor to power every section of the panel.
-- (leads + clients come from the original schema.sql.)
-- ============================================================================

-- ---------- EXPERTS ----------
create table if not exists public.experts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text,
  phone        text,
  role         text,
  specialties  text,
  status       text not null default 'active'
               check (status in ('active', 'inactive', 'on-leave')),
  notes        text
);
create index if not exists experts_status_idx on public.experts (status);

-- ---------- MEETINGS ----------
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  client_name   text not null,
  expert        text,
  purpose       text,
  scheduled_at  timestamptz,
  type          text not null default 'call'
                check (type in ('call', 'video', 'in-person')),
  status        text not null default 'scheduled'
                check (status in ('scheduled', 'completed', 'cancelled', 'no-show')),
  notes         text
);
create index if not exists meetings_scheduled_idx on public.meetings (scheduled_at desc);
create index if not exists meetings_status_idx    on public.meetings (status);

-- ---------- INVOICES ----------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  client_name    text not null,
  number         text,
  amount         numeric not null default 0,
  status         text not null default 'draft'
                 check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  issued_at      date,
  due_at         date,
  notes          text
);
create index if not exists invoices_status_idx  on public.invoices (status);
create index if not exists invoices_created_idx on public.invoices (created_at desc);

-- ---------- ONBOARDING SUBMISSIONS (from app.aceglobal.ai) ----------
create table if not exists public.onboarding_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  service     text not null
              check (service in ('bookkeeping', 'corporate-tax', 'company-formation')),
  name        text,
  email       text,
  company     text,
  plan        text,
  status      text not null default 'new'
              check (status in ('new', 'reviewing', 'quoted', 'won', 'lost')),
  details     jsonb not null default '{}'::jsonb
);
create index if not exists onboarding_service_idx on public.onboarding_submissions (service);
create index if not exists onboarding_created_idx on public.onboarding_submissions (created_at desc);

-- ---------- Row Level Security: authenticated staff full access ----------
alter table public.experts               enable row level security;
alter table public.meetings              enable row level security;
alter table public.invoices              enable row level security;
alter table public.onboarding_submissions enable row level security;

drop policy if exists "authenticated full access" on public.experts;
create policy "authenticated full access" on public.experts
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.meetings;
create policy "authenticated full access" on public.meetings
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.invoices;
create policy "authenticated full access" on public.invoices
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.onboarding_submissions;
create policy "authenticated full access" on public.onboarding_submissions
  for all to authenticated using (true) with check (true);

-- ---------- REVIEWS (Phase 3) ----------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  expert       text not null,
  client_name  text,
  rating       int not null check (rating between 1 and 5),
  comment      text
);
create index if not exists reviews_expert_idx on public.reviews (expert);

-- ---------- PAYOUTS (Phase 3) ----------
create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  expert       text not null,
  period       text,
  amount       numeric not null default 0,
  status       text not null default 'pending' check (status in ('pending', 'paid')),
  notes        text
);
create index if not exists payouts_expert_idx on public.payouts (expert);
create index if not exists payouts_status_idx on public.payouts (status);

alter table public.reviews enable row level security;
alter table public.payouts enable row level security;

drop policy if exists "authenticated full access" on public.reviews;
create policy "authenticated full access" on public.reviews
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.payouts;
create policy "authenticated full access" on public.payouts
  for all to authenticated using (true) with check (true);
