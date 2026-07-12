"use server";

import Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/types";

type Result = { error: string | null };

function parseForm(formData: FormData) {
  return {
    client_name: String(formData.get("client_name") ?? "").trim(),
    client_email: emptyToNull(formData.get("client_email")),
    number: emptyToNull(formData.get("number")),
    amount: Number(formData.get("amount") ?? 0) || 0,
    status: (String(formData.get("status") ?? "draft") as InvoiceStatus) || "draft",
    issued_at: emptyToNull(formData.get("issued_at")),
    due_at: emptyToNull(formData.get("due_at")),
    notes: emptyToNull(formData.get("notes")),
  };
}

export async function createInvoice(formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.client_name) return { error: "Client name is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").insert(values);
  if (error) return { error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateInvoice(id: string, formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.client_name) return { error: "Client name is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update(values).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { error: null };
}

/**
 * Email a client a Stripe-hosted invoice they can pay online. Creates (or reuses)
 * a Stripe customer for the invoice's email, adds a single line item for the
 * amount, finalizes and sends it — Stripe emails the pay link. The row is tagged
 * with the Stripe invoice id + hosted URL and moved to 'sent'; the
 * app.aceglobal.ai webhook flips it to 'paid' on invoice.paid.
 *
 * Idempotent-ish: if this invoice was already sent to Stripe, we re-send the
 * existing Stripe invoice instead of creating a duplicate.
 */
export async function sendInvoiceByEmail(id: string): Promise<Result> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Payments aren't configured (missing STRIPE_SECRET_KEY)." };

  const supabase = await createClient();
  const { data: inv, error: readErr } = await supabase
    .from("invoices")
    .select("id, client_name, client_email, amount, number, notes, due_at, status, stripe_invoice_id")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!inv) return { error: "Invoice not found." };
  if (!inv.client_email) return { error: "Add the client's email to this invoice first." };
  if (!(Number(inv.amount) > 0)) return { error: "Set an amount greater than 0 before sending." };
  if (inv.status === "paid") return { error: "This invoice is already paid." };

  const stripe = new Stripe(key);

  try {
    // Re-send an already-created Stripe invoice rather than duplicating it.
    if (inv.stripe_invoice_id) {
      const sent = await stripe.invoices.sendInvoice(inv.stripe_invoice_id);
      await supabase
        .from("invoices")
        .update({ status: "sent", hosted_invoice_url: sent.hosted_invoice_url ?? null })
        .eq("id", id);
      revalidatePath("/invoices");
      return { error: null };
    }

    // Find or create the Stripe customer for this email.
    const existing = await stripe.customers.list({ email: inv.client_email, limit: 1 });
    const customer =
      existing.data[0] ??
      (await stripe.customers.create({ email: inv.client_email, name: inv.client_name }));

    // One line item for the invoice total.
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: Math.round(Number(inv.amount) * 100),
      currency: "usd",
      description: inv.notes || (inv.number ? `Invoice ${inv.number}` : "Ace Global services"),
    });

    // Collect via emailed invoice. Honor the row's due date if set, else net 7.
    const invoiceParams: Stripe.InvoiceCreateParams = {
      customer: customer.id,
      collection_method: "send_invoice",
      pending_invoice_items_behavior: "include",
      metadata: { admin_invoice_id: id },
    };
    if (inv.due_at) {
      invoiceParams.due_date = Math.floor(new Date(inv.due_at).getTime() / 1000);
    } else {
      invoiceParams.days_until_due = 7;
    }
    if (inv.number) invoiceParams.number = inv.number;

    const created = await stripe.invoices.create(invoiceParams);
    const finalized = await stripe.invoices.finalizeInvoice(created.id);
    const sent = await stripe.invoices.sendInvoice(finalized.id);

    const { error: upErr } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        stripe_invoice_id: sent.id,
        hosted_invoice_url: sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
      })
      .eq("id", id);
    if (upErr) return { error: upErr.message };

    revalidatePath("/invoices");
    revalidatePath("/dashboard");
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stripe error while sending the invoice." };
  }
}

export async function deleteInvoice(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
