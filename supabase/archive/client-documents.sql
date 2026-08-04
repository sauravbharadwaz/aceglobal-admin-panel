-- ─────────────────────────────────────────────────────────────────────────────
-- Client documents storage — business documents clients upload when requesting
-- a service (e.g. "Register New Tax Account").
--
-- Files live in a PRIVATE storage bucket under a per-client folder:
--     client-documents/{auth.uid}/{service}/{timestamp}-{filename}
--
-- RLS: a signed-in client can upload/list/read files in THEIR OWN folder only;
-- staff (is_staff()) can read every client's files. The admin panel's
-- service-role key bypasses RLS, so it can always generate download links.
--
-- SAFE TO RUN MULTIPLE TIMES. Run in Supabase → SQL Editor.
-- Prereq: is_staff() (from staff-rls-and-notifications.sql) must exist.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Private bucket -----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- 2) RLS on storage.objects ---------------------------------------------------
-- Clients: full control of files whose first path segment is their own uid.
drop policy if exists "clients manage own documents" on storage.objects;
create policy "clients manage own documents" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'client-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff: read every client's documents (for the admin panel / signed URLs).
drop policy if exists "staff read all documents" on storage.objects;
create policy "staff read all documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-documents'
    and public.is_staff()
  );
