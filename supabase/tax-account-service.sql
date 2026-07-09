-- ─────────────────────────────────────────────────────────────────────────────
-- New service: "Register New Tax Account" (service = 'tax-account').
--
-- Widens the onboarding_submissions.service CHECK constraint to allow the new
-- service. Progress reuses the existing `filing_stage` int (0..4):
--   0 = Requested            1 = Received Documents
--   2 = Submitted with Agency  3 = Waiting Approval    4 = Approved
-- The client dashboard renders these as a 4-step task card; the admin advances
-- filing_stage exactly like it does for formation.
--
-- SAFE TO RUN MULTIPLE TIMES. Run in Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop whatever CHECK constraint currently governs the `service` column
-- (its name may be auto-generated), then re-add it with the new value included.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'onboarding_submissions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%service%'
  loop
    execute format('alter table public.onboarding_submissions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.onboarding_submissions
  add constraint onboarding_submissions_service_check
  check (service in ('bookkeeping', 'corporate-tax', 'company-formation', 'tax-account'));
