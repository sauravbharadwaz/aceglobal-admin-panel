-- Due dates a client needs to know about: tax filings, annual reports, document
-- deadlines. Staff create them on the client profile; the client sees them on
-- their own dashboard (the "Upcoming deadlines" / "Filing calendar" cards).

create table if not exists public.client_deadlines (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null    default now(),
  client_id  uuid        not null    references public.clients(id) on delete cascade,
  title      text        not null,
  -- A calendar date, not a moment: "due April 15" means the same day everywhere.
  due_on     date        not null,
  notes      text,
  -- Only 'done' is stored. Overdue and due-soon are derived from due_on at read
  -- time, so they can't go stale the way a persisted status would.
  status     text        not null default 'upcoming'
    check (status in ('upcoming', 'done')),
  completed_at timestamptz,
  -- Which service this belongs to, when it belongs to one. Free-form on purpose:
  -- plenty of deadlines (annual report, franchise tax) map to no service at all.
  service    text,
  -- Guards the reminder cron against double-sending: one email per lead time.
  last_reminded_on date
);

create index if not exists client_deadlines_client_idx on public.client_deadlines (client_id, due_on);
-- The cron scans by date across every client, so due_on needs its own index.
create index if not exists client_deadlines_due_idx    on public.client_deadlines (due_on)
  where status = 'upcoming';

-- Does the signed-in user own this client record?
--
-- SECURITY DEFINER for the same reason is_staff() is: `clients` is staff-only
-- under RLS, so a plain subquery against it inside a policy would evaluate as
-- the client and find nothing — every row would be invisible to its own owner.
create or replace function public.owns_client(cid uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid and c.user_id = auth.uid()
  );
$$;

alter table public.client_deadlines enable row level security;

-- Staff (admin panel) manage them.
drop policy if exists client_deadlines_staff_all on public.client_deadlines;
create policy client_deadlines_staff_all on public.client_deadlines
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Clients read their own, and only read: a due date is something we tell them,
-- not something they set.
drop policy if exists client_deadlines_select_own on public.client_deadlines;
create policy client_deadlines_select_own on public.client_deadlines
  for select to authenticated using (public.owns_client(client_id));
