-- Break the two client addresses into their parts.
--
-- billing_address and business_address were single free-text boxes, which meant
-- staff retyped an address we already hold in pieces: the onboarding form
-- collects addrLine1/2, addrCity, addrState, addrZip and addrCountry, and
-- getClientEngagements joined them into one string purely to fill a hint. A
-- filing needs the state and ZIP on their own, so keep the structure.
--
-- Six parts each, matching what the onboarding form collects and what the
-- application PDF already labels.

alter table public.clients
  add column if not exists billing_line1    text,
  add column if not exists billing_line2    text,
  add column if not exists billing_city     text,
  add column if not exists billing_state    text,
  add column if not exists billing_zip      text,
  add column if not exists billing_country  text,
  add column if not exists business_line1   text,
  add column if not exists business_line2   text,
  add column if not exists business_city    text,
  add column if not exists business_state   text,
  add column if not exists business_zip     text,
  add column if not exists business_country text;

-- Carry the old single-line values across. Splitting them on commas would be a
-- guess ("801 Cranch Austin, Texas" has no reliable boundary), so the whole
-- string goes into line1 for a human to correct — nothing is silently
-- misfiled into the wrong column, and nothing is lost.
--
-- Guarded so a re-run can't overwrite parts someone has since filled in.
update public.clients
   set billing_line1 = billing_address
 where billing_address is not null
   and billing_line1 is null
   and billing_city is null and billing_state is null and billing_zip is null;

update public.clients
   set business_line1 = business_address
 where business_address is not null
   and business_line1 is null
   and business_city is null and business_state is null and business_zip is null;

-- billing_address / business_address are deliberately left in place. Nothing
-- writes them any more, but dropping a column cannot be undone and they are the
-- only copy of what was typed before this ran. Remove them in a later migration
-- once the split values have been checked.
