"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error: string | null };

function parseForm(formData: FormData) {
  const rating = Number(formData.get("rating") ?? 0);
  return {
    expert: String(formData.get("expert") ?? "").trim(),
    client_name: emptyToNull(formData.get("client_name")),
    rating: Math.min(5, Math.max(1, rating || 5)),
    comment: emptyToNull(formData.get("comment")),
  };
}

export async function createReview(formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.expert) return { error: "Expert is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert(values);
  if (error) return { error: error.message };
  revalidatePath("/expert-reviews");
  revalidatePath("/expert-performance");
  return { error: null };
}

export async function updateReview(id: string, formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.expert) return { error: "Expert is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update(values).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expert-reviews");
  revalidatePath("/expert-performance");
  return { error: null };
}

export async function deleteReview(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expert-reviews");
  revalidatePath("/expert-performance");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
