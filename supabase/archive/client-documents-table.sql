-- ─────────────────────────────────────────────────────────────────────────────
-- Client documents TABLE — the DB records behind the client dashboard's
-- "Documents" section (general uploads not tied to a service request).
--
-- The files themselves live in the existing PRIVATE `client-documents` bucket
-- (see client-documents.sql) under the client's own folder:
--     client-documents/{auth.uid}/documents/{timestamp}-{rand}-{filename}
-- This table records one row per uploaded file so the admin panel can list them.
--
-- RLS: a signed-in client can read / add / remove ONLY their own rows; staff
-- (is_staff()) can read every client's rows (the admin panel reads with the
-- anon key + admin session, so RLS applies and must allow staff).
--
-- SAFE TO RUN MULTIPLE TIMES. Run in Supabase → SQL Editor.
-- Prereqs: is_staff() (staff-rls-and-notifications.sql), the clients table
-- (client-portal.sql), and the client-documents storage bucket
-- (client-documents.sql).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Table --------------------------------------------------------------------
create table if not exists public.client_documents (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null    default now(),
  -- The uploading client's login. NULL should not happen (upload requires auth)
  -- but we keep the FK nullable + ON DELETE SET NULL so removing a login never
  -- orphans-delete the document record.
  user_id      uuid        references auth.users(id) on delete set null,
  -- Optional link to the admin `clients` record. Left NULL on client upload;
  -- the admin panel resolves user_id → client, so this is a convenience only.
  client_id    uuid        references public.clients(id) on delete set null,
  name         text        not null,
  path         text        not null unique,   -- storage key in the client-documents bucket
  size         bigint,
  content_type text
);

create index if not exists client_documents_user_idx
  on public.client_documents (user_id, created_at desc);
create index if not exists client_documents_client_idx
  on public.client_documents (client_id, created_at desc);

alter table public.client_documents enable row level security;

-- 2) RLS ----------------------------------------------------------------------
-- Clients: read / add / remove their own rows only.
drop policy if exists client_documents_select_own on public.client_documents;
create policy client_documents_select_own on public.client_documents
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists client_documents_insert_own on public.client_documents;
create policy client_documents_insert_own on public.client_documents
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists client_documents_delete_own on public.client_documents;
create policy client_documents_delete_own on public.client_documents
  for delete to authenticated using (auth.uid() = user_id);

-- Staff: full access (the admin panel reads via anon key + admin session).
drop policy if exists client_documents_staff_all on public.client_documents;
create policy client_documents_staff_all on public.client_documents
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
