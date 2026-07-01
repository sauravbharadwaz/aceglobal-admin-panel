-- Clears ALL rows from leads and clients, then reports the counts so you can
-- confirm it worked. Run in the Supabase SQL Editor. Structure/policies stay.
delete from public.leads;
delete from public.clients;

select
  (select count(*) from public.leads)   as leads_remaining,
  (select count(*) from public.clients) as clients_remaining;
