-- Stripe → admin invoices auto-sync.
--
-- When the app.aceglobal.ai Stripe webhook (api/stripe-webhook.js) records a
-- paid checkout, it also upserts a 'paid' row into this invoices table so the
-- admin Invoices page reflects real payments automatically (no manual marking).
--
-- Idempotency: the webhook upserts on stripe_session_id, so retries and the
-- duplicate completed/async_payment_succeeded events never create duplicates.
-- Manual invoices leave these columns null (and NULLs are distinct in Postgres,
-- so the unique index below doesn't collide across manual rows).

alter table public.invoices
  add column if not exists stripe_session_id text,
  add column if not exists client_email      text;

create unique index if not exists invoices_stripe_session_uq
  on public.invoices (stripe_session_id)
  where stripe_session_id is not null;
