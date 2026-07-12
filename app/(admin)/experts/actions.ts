"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inviteTeamMember } from "@/app/(admin)/team/actions";
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

/**
 * Give an expert admin-panel access: look up their email and run the same
 * teammate invite used on the Team page (invite email + staff allowlist for
 * non-company emails). Closes the gap where an Expert record has no login.
 */
export async function inviteExpertToPanel(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: expert, error } = await supabase
    .from("experts")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!expert?.email) return { error: "Add an email to this expert first." };

  const res = await inviteTeamMember(expert.email);
  if (res.error) return res;
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
