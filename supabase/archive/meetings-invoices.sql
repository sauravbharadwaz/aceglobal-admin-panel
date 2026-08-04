-- ============================================================================
-- Meetings + Invoices (manual tables) — run in Supabase SQL Editor.
-- Powers the Meetings and Invoices pages and the dashboard attention cards.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MEETINGS
-- ---------------------------------------------------------------------------
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  client_name   text not null,
  expert        text,                       -- assigned team member
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

-- ---------------------------------------------------------------------------
-- INVOICES
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  client_name    text not null,
  number         text,                      -- human invoice number, e.g. INV-1042
  amount         numeric not null default 0,
  status         text not null default 'draft'
                 check (status in ('draft', 'sent', 'paid', 'overdue', 'void')),
  issued_at      date,
  due_at         date,
  notes          text
);

create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_created_idx on public.invoices (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — authenticated staff full access
-- ---------------------------------------------------------------------------
alter table public.meetings enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "authenticated full access" on public.meetings;
create policy "authenticated full access" on public.meetings
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.invoices;
create policy "authenticated full access" on public.invoices
  for all to authenticated using (true) with check (true);
