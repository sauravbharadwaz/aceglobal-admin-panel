"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stageLabelsForService, type OnboardingStatus } from "@/lib/types";
import { sendProgressEmail } from "@/lib/notify";

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

export async function updateFilingStage(
  id: string,
  stage: number,
): Promise<Result> {
  const s = Math.max(0, Math.min(5, Math.round(Number(stage) || 0)));
  const supabase = await createClient();

  // Read the current stage + who to notify + which milestone labels apply,
  // so a forward move on the client's progress bar pings them by name.
  const { data: sub } = await supabase
    .from("onboarding_submissions")
    .select("filing_stage, user_id, service, client_id, email")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("onboarding_submissions")
    .update({ filing_stage: s })
    .eq("id", id);
  if (error) return { error: error.message };

  // Notify the client only when the progress bar moves forward (not on backward
  // corrections). Prefer the submission's user; fall back to the linked client's
  // portal user so it still fires for admin-created engagements.
  const prev = Number(sub?.filing_stage ?? 0);
  if (s > prev) {
    let userId = (sub?.user_id as string | null) ?? null;
    let email = (sub?.email as string | null) ?? null;
    if ((!userId || !email) && sub?.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("user_id, email")
        .eq("id", sub.client_id)
        .maybeSingle();
      const c = client as { user_id?: string | null; email?: string | null } | null;
      userId = userId ?? c?.user_id ?? null;
      email = email ?? c?.email ?? null;
    }
    const label = stageLabelsForService(sub?.service)[s];
    if (label) {
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          title: `Progress update: ${label}`,
          body: `Good news — your application has moved forward to: ${label}.`,
        });
      }
      await sendProgressEmail(email, label);
    }
  }

  revalidatePath("/onboarding");
  return { error: null };
}

export async function sendNotification(
  userId: string | null | undefined,
  title: string,
  body: string,
): Promise<Result> {
  if (!userId) return { error: "This submission isn't linked to a signed-in user yet, so there's nobody to notify." };
  const t = (title || "").trim();
  if (!t) return { error: "A title is required." };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title: t.slice(0, 200),
    body: (body || "").trim().slice(0, 2000) || null,
  });
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Promote an onboarding submission into the Clients section: create a `clients`
 * record from it (or reuse an existing client matched by login / email) and link
 * the submission — and any sibling submissions from the same login — to that
 * client via client_id, so it shows in the client editor with its documents and
 * progress. Staff-only (enforced by RLS on the clients / onboarding tables).
 * Idempotent: a submission already linked to a client is a no-op success.
 */
export async function convertToClient(id: string): Promise<Result> {
  const supabase = await createClient();

  const { data: sub, error: subErr } = await supabase
    .from("onboarding_submissions")
    .select("id, name, email, company, plan, client_id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (subErr) return { error: subErr.message };
  if (!sub) return { error: "Submission not found." };
  if (sub.client_id) return { error: null }; // already a client

  const email = (sub.email ?? "").trim().toLowerCase() || null;

  // Reuse an existing client where possible (same login, then same email) so we
  // don't create a duplicate for a client who already exists.
  let clientId: string | null = null;
  if (sub.user_id) {
    const { data } = await supabase
      .from("clients").select("id").eq("user_id", sub.user_id).limit(1).maybeSingle();
    if (data?.id) clientId = data.id;
  }
  if (!clientId && email) {
    const { data } = await supabase
      .from("clients").select("id").ilike("email", email).limit(1).maybeSingle();
    if (data?.id) clientId = data.id;
  }

  if (!clientId) {
    const insert: Record<string, unknown> = {
      name: sub.name || email || "New client",
      email,
      company: sub.company ?? null,
      plan: sub.plan ?? null,
      status: "onboarding",
      mrr: 0,
    };
    // Carry over the client's login so their dashboard data + documents resolve.
    if (sub.user_id) {
      insert.user_id = sub.user_id;
      insert.portal_status = "active";
    }
    const { data: created, error: cErr } = await supabase
      .from("clients").insert(insert).select("id").single();
    if (cErr) return { error: cErr.message };
    clientId = created.id;
  } else if (sub.user_id) {
    // Link the login to the existing client if it wasn't already.
    await supabase
      .from("clients").update({ user_id: sub.user_id }).eq("id", clientId).is("user_id", null);
  }

  const { error: linkErr } = await supabase
    .from("onboarding_submissions").update({ client_id: clientId }).eq("id", id);
  if (linkErr) return { error: linkErr.message };

  // Adopt the client's other unlinked submissions too, so all their requests and
  // documents gather under the one client record.
  if (sub.user_id) {
    await supabase
      .from("onboarding_submissions")
      .update({ client_id: clientId })
      .eq("user_id", sub.user_id)
      .is("client_id", null);
  }

  revalidatePath("/onboarding");
  revalidatePath("/clients");
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
