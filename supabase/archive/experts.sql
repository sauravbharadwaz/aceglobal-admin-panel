-- ============================================================================
-- Experts (the professionals delivering client work) — run in Supabase SQL Editor.
-- Backbone for Manage Experts, and later Expert Performance / Reviews / Payouts / TAT.
-- ============================================================================

create table if not exists public.experts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text,
  phone        text,
  role         text,                       -- CPA, Bookkeeper, Tax Specialist, Reviewer, Account Manager
  specialties  text,                       -- free text, comma-separated (e.g. "Bookkeeping, IFTA, Schedule F")
  status       text not null default 'active'
               check (status in ('active', 'inactive', 'on-leave')),
  notes        text
);

create index if not exists experts_status_idx on public.experts (status);

alter table public.experts enable row level security;

drop policy if exists "authenticated full access" on public.experts;
create policy "authenticated full access" on public.experts
  for all to authenticated using (true) with check (true);
