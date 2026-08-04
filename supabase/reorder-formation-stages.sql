-- ============================================================================
-- Company-formation milestones reordered: "Registered agent set up" moves from
-- position 4 to position 2.  Run in the Supabase SQL Editor.
--
--   before                          after
--   0 Not started                   0 Not started
--   1 Name reserved                 1 Name reserved
--   2 State filing submitted        2 Registered agent set up
--   3 EIN obtained                  3 State filing submitted
--   4 Registered agent set up       4 EIN obtained
--   5 Complete                      5 Complete
--
-- filing_stage stores the position, not the milestone, so every in-flight
-- formation has to be remapped or clients silently jump to a different step:
--   2 -> 3,  3 -> 4,  4 -> 2   (0, 1 and 5 mean the same in both orders)
--
-- Guarded by public.schema_migrations so re-running it is a no-op — a second
-- pass over already-remapped rows would scramble them.
-- ============================================================================

create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from public.schema_migrations
    where name = 'reorder-formation-stages'
  ) then
    raise notice 'Already applied — nothing to do.';
    return;
  end if;

  -- One statement, so each row is remapped from its OLD value exactly once.
  update public.onboarding_submissions
     set filing_stage = case filing_stage
                          when 2 then 3
                          when 3 then 4
                          when 4 then 2
                        end
   where service = 'company-formation'
     and filing_stage in (2, 3, 4);

  insert into public.schema_migrations (name) values ('reorder-formation-stages');
end $$;

-- Check: every in-flight formation and the milestone it now reads as.
select filing_stage,
       (array['Not started','Name reserved','Registered agent set up',
              'State filing submitted','EIN obtained','Complete'])[filing_stage + 1] as milestone,
       count(*)
  from public.onboarding_submissions
 where service = 'company-formation'
 group by filing_stage
 order by filing_stage;
