-- ============================================================================
-- Reviews + Payouts (Phase 3) — run in Supabase SQL Editor.
-- Both reference an expert by name (matches experts.name).
-- ============================================================================

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  expert       text not null,
  client_name  text,
  rating       int not null check (rating between 1 and 5),
  comment      text
);
create index if not exists reviews_expert_idx on public.reviews (expert);

create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  expert       text not null,
  period       text,                       -- e.g. "Jun 2026"
  amount       numeric not null default 0,
  status       text not null default 'pending'
               check (status in ('pending', 'paid')),
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
