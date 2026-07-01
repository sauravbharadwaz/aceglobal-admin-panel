"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/types";

type Result = { error: string | null };

export async function createLead(formData: FormData): Promise<Result> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    name,
    email: emptyToNull(formData.get("email")),
    phone: emptyToNull(formData.get("phone")),
    company: emptyToNull(formData.get("company")),
    service: emptyToNull(formData.get("service")),
    message: emptyToNull(formData.get("message")),
    source: String(formData.get("source") ?? "manual") || "manual",
    status: (String(formData.get("status") ?? "new") as LeadStatus) || "new",
  });

  if (error) return { error: error.message };
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteLead(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
