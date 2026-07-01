"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingStatus } from "@/lib/types";

type Result = { error: string | null };

export async function updateOnboardingStatus(
  id: string,
  status: OnboardingStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_submissions")
    .update({ status })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { error: null };
}

export async function deleteOnboardingSubmission(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_submissions")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/onboarding");
  return { error: null };
}
