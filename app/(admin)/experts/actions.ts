"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ExpertStatus } from "@/lib/types";

type Result = { error: string | null };

function parseForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    email: emptyToNull(formData.get("email")),
    phone: emptyToNull(formData.get("phone")),
    role: emptyToNull(formData.get("role")),
    specialties: emptyToNull(formData.get("specialties")),
    status: (String(formData.get("status") ?? "active") as ExpertStatus) || "active",
    notes: emptyToNull(formData.get("notes")),
  };
}

export async function createExpert(formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("experts").insert(values);
  if (error) return { error: error.message };
  revalidatePath("/experts");
  return { error: null };
}

export async function updateExpert(id: string, formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.name) return { error: "Name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("experts").update(values).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/experts");
  return { error: null };
}

export async function deleteExpert(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("experts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/experts");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
