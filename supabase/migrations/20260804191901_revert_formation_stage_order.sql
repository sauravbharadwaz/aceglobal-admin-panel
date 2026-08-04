-- Put "Registered agent set up" back at position 4.
--
-- Reverts supabase/reorder-formation-stages.sql, which had moved it to 2. The
-- milestone order returns to:
--
--   0 Not started
--   1 Name reserved
--   2 State filing submitted
--   3 EIN obtained
--   4 Registered agent set up
--   5 Operating agreement
--
-- filing_stage stores the position, so the rows have to move back with it. The
-- exact inverse of the forward map (2->3, 3->4, 4->2):
--
--   2 -> 4,  3 -> 2,  4 -> 3
--
-- Both live rows land where they belong: the one showing "Registered agent set
-- up" goes 2 -> 4, and the "State filing submitted" one goes 3 -> 2.
--
-- Guarded on the forward migration's own marker: this only runs if that one was
-- applied, and it clears the marker afterwards so the pair can't drift.

do $$
begin
  if not exists (
    select 1 from public.schema_migrations where name = 'reorder-formation-stages'
  ) then
    raise notice 'Forward reorder was never applied — nothing to revert.';
    return;
  end if;

  -- One statement, so every row is remapped from its OLD value exactly once.
  update public.onboarding_submissions
     set filing_stage = case filing_stage
                          when 2 then 4
                          when 3 then 2
                          when 4 then 3
                        end
   where service = 'company-formation'
     and filing_stage in (2, 3, 4);

  delete from public.schema_migrations where name = 'reorder-formation-stages';
end $$;

-- Check: every in-flight formation and the milestone it now reads as.
select filing_stage,
       (array['Not started','Name reserved','State filing submitted',
              'EIN obtained','Registered agent set up','Operating agreement'])[filing_stage + 1] as milestone,
       count(*)
  from public.onboarding_submissions
 where service = 'company-formation'
 group by filing_stage
 order by filing_stage;
