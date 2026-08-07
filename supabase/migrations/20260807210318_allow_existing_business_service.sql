-- Allow service = 'existing-business' on onboarding_submissions.
--
-- The client app (app.aceglobal.ai) now splits sign-up in two: form a new company,
-- or record one you already trade under. The second path writes an
-- onboarding_submissions row carrying the client's registration details — legal
-- name, entity type, EIN, state ID, address — or their uploaded state and federal
-- paperwork. Nothing is filed for it, so it has no filing_stage and no payment.
--
-- The CHECK constraint added by archive/tax-account-service.sql does not list the
-- new value, so every one of those inserts is rejected. /api/lead's response is
-- discarded by the client (sendLead is fire-and-forget), so the client is shown a
-- success screen while the business they just entered is never stored. This widens
-- the constraint to close that hole; it must be applied before the client app's
-- existing-business flow ships.
--
-- Drop by lookup rather than by name: the constraint has been recreated before and
-- its name is not guaranteed.

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
  check (service in (
    'bookkeeping',
    'corporate-tax',
    'company-formation',
    'tax-account',
    'existing-business'
  ));
