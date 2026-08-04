-- ============================================================================
-- Optional business / tax / banking details on a client.  Run in the Supabase
-- SQL Editor.
--
-- These back the extra fields on the admin client Profile tab. Every column is
-- nullable: existing clients keep working untouched, and the admin panel's
-- `select *` picks the new columns up with no query changes.
--
-- Write-once by app rule (see dropLockedDetails in app/(admin)/clients/actions.ts):
-- the panel only ever fills a blank one; a value already set can be corrected
-- from the Supabase table editor only.
--
-- Additive + idempotent — safe to re-run.
-- ============================================================================

alter table public.clients
  add column if not exists contact_person        text,  -- primary contact at the client
  add column if not exists ein                   text,  -- federal Employer Identification Number
  add column if not exists state_withholding_id  text,  -- state withholding account no.
  add column if not exists state_unemployment_id text,  -- state unemployment (SUTA) account no.
  add column if not exists eft_pin               text,  -- EFTPS / EFT payment PIN
  add column if not exists billing_address       text,
  add column if not exists business_address      text,  -- physical address
  add column if not exists bank_name             text,
  add column if not exists bank_account_number   text,
  add column if not exists bank_routing_number   text;

-- No RLS changes needed: public.clients already grants full access to the
-- authenticated (staff) role only, and anon has no select policy on it.
