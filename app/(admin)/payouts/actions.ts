"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PayoutStatus } from "@/lib/types";

type Result = { error: string | null };

function parseForm(formData: FormData) {
  return {
    expert: String(formData.get("expert") ?? "").trim(),
    period: emptyToNull(formData.get("period")),
    amount: Number(formData.get("amount") ?? 0) || 0,
    status: (String(formData.get("status") ?? "pending") as PayoutStatus) || "pending",
    notes: emptyToNull(formData.get("notes")),
  };
}

export async function createPayout(formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.expert) return { error: "Expert is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("payouts").insert(values);
  if (error) return { error: error.message };
  revalidatePath("/payouts");
  return { error: null };
}

export async function updatePayout(id: string, formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.expert) return { error: "Expert is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("payouts").update(values).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/payouts");
  return { error: null };
}

export async function updatePayoutStatus(
  id: string,
  status: PayoutStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("payouts").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/payouts");
  return { error: null };
}

export async function deletePayout(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("payouts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/payouts");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
