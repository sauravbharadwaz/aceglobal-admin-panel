-- ─────────────────────────────────────────────────────────────────────────────
-- Client portal — invite existing clients to their dashboard (Phase 1).
--
-- WHAT THIS ADDS
--   • clients.user_id       links an admin `clients` row to the client's login
--                           (auth.users) once they've been invited.
--   • clients.portal_status none | invited | active — where they are in the
--                           invite → set-password → signed-in journey.
--   • onboarding_submissions.client_id  links the engagement record the client
--                           dashboard renders back to the admin `clients` row,
--                           so staff can edit "the client's details + progress"
--                           from one place and the invite can stamp user_id onto
--                           the right rows.
--
-- SAFE TO RUN MULTIPLE TIMES (idempotent). Run in Supabase → SQL Editor, against
-- the same project the app + admin panel already share.
--
-- Prereq already deployed (do not need to re-run): staff-rls-and-notifications.sql
-- (is_staff(), admin_users) and auth-and-filing.sql (onboarding_submissions.user_id,
-- filing_stage) from the app.aceglobal.ai repo.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) clients → login link + invite state -------------------------------------
alter table public.clients
  add column if not exists user_id       uuid references auth.users(id) on delete set null,
  add column if not exists portal_status text not null default 'none';

-- Constrain portal_status to the known states (add the check only once).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_portal_status_check'
  ) then
    alter table public.clients
      add constraint clients_portal_status_check
      check (portal_status in ('none', 'invited', 'active'));
  end if;
end $$;

create index if not exists clients_user_id_idx      on public.clients (user_id);
create index if not exists clients_portal_status_idx on public.clients (portal_status);

-- 2) engagement ↔ client link -------------------------------------------------
-- Each onboarding_submissions row is the "engagement" the client dashboard
-- shows. Linking it to a clients row lets the admin edit both together and lets
-- the invite attach the same user_id to every engagement of that client.
alter table public.onboarding_submissions
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists onboarding_client_id_idx on public.onboarding_submissions (client_id);

-- 3) RLS — no changes needed.
--    • clients          : clients_staff_all (staff only) already applies. Clients
--                         never read the clients table; they read their own
--                         onboarding_submissions via onboarding_select_own.
--    • onboarding_submissions: onboarding_select_own (auth.uid() = user_id) already
--                         scopes reads to the signed-in client; onboarding_staff_all
--                         lets the admin write. The new client_id column rides along.
--
-- Nothing else to do — Phase 1 reuses the existing security model.
