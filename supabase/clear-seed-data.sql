-- Removes ALL rows from the leads and clients tables (clears the sample data).
-- Run this in the Supabase SQL Editor. The table structure and policies stay intact.
truncate table public.leads, public.clients;
