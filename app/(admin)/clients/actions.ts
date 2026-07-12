"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserIsStaff } from "@/lib/staff-guard";
import { ONBOARDING_SERVICES, type ClientStatus, type OnboardingService } from "@/lib/types";

type Result = { error: string | null };

/** Where the client dashboard lives. Their invite email links here. */
const APP_URL = (process.env.PORTAL_APP_URL || "https://app.aceglobal.ai").replace(/\/+$/, "");
const SETUP_REDIRECT = `${APP_URL}/?setup=1`;

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

/** The dashboard-facing engagement the client sees. `service` drives which
 *  dashboard view (persona) they land on; blank means "don't touch the
 *  engagement" (e.g. a client we don't intend to give portal access yet). */
function parseEngagement(formData: FormData) {
  const raw = String(formData.get("service") ?? "").trim();
  const service = (ONBOARDING_SERVICES as string[]).includes(raw)
    ? (raw as OnboardingService)
    : null;
  const filing_stage = Math.max(0, Math.min(5, Math.round(Number(formData.get("filing_stage") ?? 0) || 0)));
  const payment_status = String(formData.get("payment_status") ?? "pending") === "paid" ? "paid" : "pending";
  return { service, filing_stage, payment_status };
}

type ClientValues = ReturnType<typeof parseForm>;
type EngagementValues = ReturnType<typeof parseEngagement>;

/**
 * Keep the client's dashboard engagement (an onboarding_submissions row) in sync
 * with the admin client record. One "portal engagement" per client, linked by
 * client_id. Preserves an already-linked user_id so re-editing a client never
 * detaches their login. No-op when no service is selected.
 */
async function syncEngagement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  client: ClientValues,
  engagement: EngagementValues,
): Promise<string | null> {
  if (!engagement.service) return null;

  const { data: existing } = await supabase
    .from("onboarding_submissions")
    .select("id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const payload = {
    service: engagement.service,
    name: client.name,
    email: client.email,
    company: client.company,
    plan: client.plan,
    status: "won" as const,
    filing_stage: engagement.filing_stage,
    payment_status: engagement.payment_status,
    client_id: clientId,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("onboarding_submissions")
      .update(payload)
      .eq("id", existing.id);
    return error ? error.message : null;
  }

  const { error } = await supabase.from("onboarding_submissions").insert(payload);
  return error ? error.message : null;
}

/**
 * Give a client a login with an admin-set password (no email needed). Creates a
 * confirmed auth user (or updates the password of an existing one), links it to
 * the client + their engagements, and marks them active. Staff-guarded. No-op if
 * no password was entered.
 */
async function provisionClientLogin(
  clientId: string,
  email: string | null,
  password: string,
): Promise<string | null> {
  if (!password) return null; // nothing to set
  if (password.length < 6) return "The login password must be at least 6 characters.";
  if (!email) return "Add an email to this client before setting a login password.";
  if (!(await currentUserIsStaff())) return "Staff access required.";

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return e instanceof Error ? e.message : "Logins are not configured.";
  }

  const { data: client } = await admin
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .single();
  let userId: string | null = client?.user_id ?? null;
  if (!userId) userId = await findUserIdByEmail(admin, email.toLowerCase());

  if (userId) {
    // Existing login → just (re)set its password.
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return error.message;
  } else {
    // Fresh, pre-confirmed login so they can sign in immediately.
    const { data, error } = await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
    });
    if (error) return error.message;
    userId = data.user?.id ?? null;
  }
  if (!userId) return "Could not create the client login.";

  const { error: linkErr } = await admin
    .from("clients")
    .update({ user_id: userId, portal_status: "active" })
    .eq("id", clientId);
  if (linkErr) return linkErr.message;

  await admin
    .from("onboarding_submissions")
    .update({ user_id: userId })
    .eq("client_id", clientId);
  return null;
}

export async function createClientRecord(formData: FormData): Promise<Result> {
  const values = parseForm(formData);
  if (!values.name) return { error: "Name is required." };
  const engagement = parseEngagement(formData);
  const password = String(formData.get("password") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert(values)
    .select("id")
    .single();
  if (error) return { error: error.message };

  const engErr = await syncEngagement(supabase, data.id, values, engagement);
  if (engErr) return { error: `Client saved, but the dashboard engagement failed: ${engErr}` };

  const pwErr = await provisionClientLogin(data.id, values.email, password);
  if (pwErr) return { error: `Client saved, but the login failed: ${pwErr}` };

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
  const engagement = parseEngagement(formData);
  const password = String(formData.get("password") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(values).eq("id", id);
  if (error) return { error: error.message };

  const engErr = await syncEngagement(supabase, id, values, engagement);
  if (engErr) return { error: `Client saved, but the dashboard engagement failed: ${engErr}` };

  const pwErr = await provisionClientLogin(id, values.email, password);
  if (pwErr) return { error: `Client saved, but the login failed: ${pwErr}` };

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { error: null };
}

/**
 * Quick-assign (or clear) a client's account manager without opening the full
 * editor. Pass an empty string to unassign. `owner` is a plain name string that
 * the Expert-Performance page groups by (client.owner === expert.name).
 */
export async function assignClientOwner(id: string, owner: string): Promise<Result> {
  const value = owner.trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ owner: value }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  revalidatePath("/expert-performance");
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

/** Find an existing auth user by email (paged; there is no getUserByEmail). */
async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null; // last page
  }
  return null;
}

/**
 * Invite a client to their dashboard. Creates (or reuses) their login, emails a
 * set-password link that returns them to the app, and links the login to this
 * client + their engagement so RLS shows them exactly their own data.
 *
 * Idempotent: safe to click again as "Resend" — an already-registered client
 * gets a fresh set-password email instead of erroring.
 */
export async function inviteClientToPortal(clientId: string): Promise<Result> {
  if (!(await currentUserIsStaff())) return { error: "Staff access required." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Portal invites are not configured." };
  }

  const { data: client, error: cErr } = await admin
    .from("clients")
    .select("id, email, user_id")
    .eq("id", clientId)
    .single();
  if (cErr || !client) return { error: "Client not found." };

  const email = (client.email ?? "").trim().toLowerCase();
  if (!email) return { error: "Add an email to this client before inviting them." };

  let userId: string | null = client.user_id ?? null;
  // Whether we still owe them a set-password email. A brand-new invite emails
  // itself; every other path (existing account, or resend) needs an explicit
  // recovery email.
  let needSetupEmail = !!client.user_id; // resend on an already-linked client

  if (!userId) {
    // First try a clean invite; if the email already has a login, fall back to a
    // set-password (recovery) email so existing accounts can still get access.
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: SETUP_REDIRECT,
    });
    if (error) {
      userId = await findUserIdByEmail(admin, email);
      if (!userId) return { error: error.message };
      needSetupEmail = true; // reused an existing account → it never got the invite mail
    } else {
      userId = data.user?.id ?? null; // fresh invite email already on its way
    }
  }

  if (!userId) return { error: "Could not create the client login." };

  // resetPasswordForEmail is delivered by Supabase's mailer and lands on the
  // same ?setup=1 screen as a fresh invite.
  if (needSetupEmail) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: SETUP_REDIRECT });
  }

  const { error: linkErr } = await admin
    .from("clients")
    .update({ user_id: userId, portal_status: "invited" })
    .eq("id", clientId);
  if (linkErr) return { error: linkErr.message };

  // Attach the login to every engagement of this client so the dashboard's
  // owner-scoped RLS (auth.uid() = user_id) returns their data.
  await admin
    .from("onboarding_submissions")
    .update({ user_id: userId })
    .eq("client_id", clientId);

  revalidatePath("/clients");
  return { error: null };
}

/** Revoke a client's dashboard access: unlink the login from the client and
 *  their engagements (does not delete the auth user or any data). */
export async function revokeClientPortal(clientId: string): Promise<Result> {
  if (!(await currentUserIsStaff())) return { error: "Staff access required." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Portal invites are not configured." };
  }

  await admin.from("onboarding_submissions").update({ user_id: null }).eq("client_id", clientId);
  const { error } = await admin
    .from("clients")
    .update({ user_id: null, portal_status: "none" })
    .eq("id", clientId);
  if (error) return { error: error.message };

  revalidatePath("/clients");
  return { error: null };
}

/** Generate a short-lived signed download URL for a client-uploaded document. */
export async function getDocumentUrl(
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  if (!(await currentUserIsStaff())) return { url: null, error: "Staff access required." };
  if (!path) return { url: null, error: "Missing document." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : "Documents are not configured." };
  }

  const { data, error } = await admin.storage
    .from("client-documents")
    .createSignedUrl(path, 300); // valid 5 minutes
  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
