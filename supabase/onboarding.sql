-- ============================================================================
-- Onboarding submissions from app.aceglobal.ai
-- Run this in the Supabase SQL Editor (after schema.sql).
--
-- The app writes here via a Vercel serverless function (api/lead.js) using the
-- SERVICE_ROLE key, which bypasses RLS — so no anon insert policy is needed.
-- Staff (authenticated) get full read/write access from the admin panel.
-- ============================================================================

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
  details     jsonb not null default '{}'::jsonb   -- full structured answers from the form
);

create index if not exists onboarding_service_idx on public.onboarding_submissions (service);
create index if not exists onboarding_created_idx on public.onboarding_submissions (created_at desc);
create index if not exists onboarding_status_idx  on public.onboarding_submissions (status);

alter table public.onboarding_submissions enable row level security;

drop policy if exists "authenticated full access" on public.onboarding_submissions;
create policy "authenticated full access" on public.onboarding_submissions
  for all to authenticated using (true) with check (true);
