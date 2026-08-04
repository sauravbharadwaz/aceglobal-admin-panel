-- Close five tables that were readable and writable by every logged-in client.
--
-- These carried "for all to authenticated using (true)". The client dashboard
-- signs clients in as `authenticated`, so any client could read — or delete —
-- every invoice, meeting, team member, payout and review in the system.
--
-- clients, leads, notifications, client_documents and onboarding_submissions
-- were already gated behind is_staff(); these five were simply never tightened.
-- This brings them in line with that pattern.
--
-- Nothing legitimate loses access:
--   * the admin panel authenticates as staff, so is_staff() is true
--   * the webhooks (Stripe, Cal.com) use the service-role key, which bypasses RLS
--   * the client dashboard never queries these tables from the browser — it only
--     reads onboarding_submissions, notifications and client_documents
--   * anon had no access to any of them before, and still has none

alter table public.experts  enable row level security;
alter table public.invoices enable row level security;
alter table public.meetings enable row level security;
alter table public.payouts  enable row level security;
alter table public.reviews  enable row level security;

drop policy if exists "authenticated full access" on public.experts;
drop policy if exists "experts_staff_all" on public.experts;
create policy "experts_staff_all" on public.experts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated full access" on public.invoices;
drop policy if exists "invoices_staff_all" on public.invoices;
create policy "invoices_staff_all" on public.invoices
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated full access" on public.meetings;
drop policy if exists "meetings_staff_all" on public.meetings;
create policy "meetings_staff_all" on public.meetings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated full access" on public.payouts;
drop policy if exists "payouts_staff_all" on public.payouts;
create policy "payouts_staff_all" on public.payouts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "authenticated full access" on public.reviews;
drop policy if exists "reviews_staff_all" on public.reviews;
create policy "reviews_staff_all" on public.reviews
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
