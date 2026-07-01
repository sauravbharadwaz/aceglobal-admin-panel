"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MeetingStatus, MeetingType } from "@/lib/types";

type Result = { error: string | null };

function parseForm(formData: FormData) {
  const scheduled = String(formData.get("scheduled_at") ?? "").trim();
  return {
    client_name: String(formData.get("client_name") ?? "").trim(),
    expert: emptyToNull(formData.get("expert")),
    purpose: emptyToNull(formData.get("purpose")),
    scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
    type: (String(formData.get("type") ?? "call") as MeetingType) || "call",
    status: (String(formData.get("status") ?? "scheduled") as MeetingStatus) || "scheduled",
    notes: emptyToNull(formData.get("notes")),
  };
}

export async function createMeeting(formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.client_name) return { error: "Client name is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").insert(values);
  if (error) return { error: error.message };
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateMeeting(id: string, formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.client_name) return { error: "Client name is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update(values).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function deleteMeeting(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
