"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/lib/types";

type Result = { error: string | null };

function parseForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  return {
    name,
    email: emptyToNull(formData.get("email")),
    phone: emptyToNull(formData.get("phone")),
    company: emptyToNull(formData.get("company")),
    status: (String(formData.get("status") ?? "active") as ClientStatus) || "active",
    plan: emptyToNull(formData.get("plan")),
    mrr: Number(formData.get("mrr") ?? 0) || 0,
    owner: emptyToNull(formData.get("owner")),
  };
}

export async function createClientRecord(formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(values);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateClientRecord(
  id: string,
  formData: FormData,
): Promise<Result> {
  const values = parseForm(formData);
  if (!values.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(values).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteClientRecord(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
