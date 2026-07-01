-- Run this in the Supabase SQL Editor to let the public marketing site submit
-- leads. Safe to run on its own if you already created the tables earlier.
--
-- Insert-only: the anonymous role can create leads but cannot read, update or
-- delete them — so the public anon key can never list your pipeline.

drop policy if exists "anon can submit leads" on public.leads;
create policy "anon can submit leads" on public.leads
  for insert to anon with check (true);
