-- ============================================================================
-- Cal.com consultations → meetings.  Run in the Supabase SQL Editor.
--
-- The app's /api/cal-webhook writes consultation bookings into public.meetings.
-- Reschedules and cancellations must update the same row instead of creating a
-- duplicate, so we key those rows on the Cal.com booking uid.
--
-- Additive + idempotent: existing manually-created meetings (cal_uid NULL) are
-- untouched, and the admin panel's `select *` simply ignores the new column.
-- ============================================================================

alter table public.meetings
  add column if not exists cal_uid text;

-- Unique on cal_uid so the webhook can upsert on it. NULLs are distinct in
-- Postgres, so any number of manual meetings (cal_uid NULL) remain allowed.
create unique index if not exists meetings_cal_uid_key
  on public.meetings (cal_uid);
