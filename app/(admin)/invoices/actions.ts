"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/types";

type Result = { error: string | null };

function parseForm(formData: FormData) {
  return {
    client_name: String(formData.get("client_name") ?? "").trim(),
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
