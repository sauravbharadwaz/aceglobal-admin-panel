-- Creates the three tables that are still missing: experts, meetings, invoices.
-- Safe to run (create if not exists). Ends by listing your public tables so you
-- can confirm all six are present.

create table if not exists public.experts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text,
  phone        text,
  role         text,
  specialties  text,
  status       text not null default 'active' check (status in ('active','inactive','on-leave')),
  notes        text
);

create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  client_name   text not null,
  expert        text,
  purpose       text,
  scheduled_at  timestamptz,
  type          text not null default 'call' check (type in ('call','video','in-person')),
  status        text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no-show')),
  notes         text
);

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  client_name    text not null,
  number         text,
  amount         numeric not null default 0,
  status         text not null default 'draft' check (status in ('draft','sent','paid','overdue','void')),
  issued_at      date,
  due_at         date,
  notes          text
);

alter table public.experts  enable row level security;
alter table public.meetings enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "authenticated full access" on public.experts;
create policy "authenticated full access" on public.experts
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.meetings;
create policy "authenticated full access" on public.meetings
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.invoices;
create policy "authenticated full access" on public.invoices
  for all to authenticated using (true) with check (true);

-- Confirmation: should list experts, invoices, meetings among the rows.
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
