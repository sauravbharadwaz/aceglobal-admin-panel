-- Send Stripe invoices from the admin panel.
--
-- The admin "Email invoice to pay" action creates a hosted Stripe invoice and
-- emails the client a pay link. We store the Stripe invoice id + hosted URL on
-- the row; the app.aceglobal.ai Stripe webhook flips status to 'paid' on the
-- invoice.paid event (matched by stripe_invoice_id / metadata.admin_invoice_id).
--
-- Additive + idempotent. (client_email was added by invoices-stripe-sync.sql;
-- included here with IF NOT EXISTS so this file is safe to run standalone.)

alter table public.invoices
  add column if not exists client_email      text,
  add column if not exists stripe_invoice_id text,
  add column if not exists hosted_invoice_url text;

create unique index if not exists invoices_stripe_invoice_uq
  on public.invoices (stripe_invoice_id)
  where stripe_invoice_id is not null;
