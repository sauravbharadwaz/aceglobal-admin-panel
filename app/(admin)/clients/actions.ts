"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserIsStaff } from "@/lib/staff-guard";
import {
  ONBOARDING_SERVICES,
  stageLabelsForService,
  type ClientStatus,
  type OnboardingService,
} from "@/lib/types";
import { sendProgressEmail } from "@/lib/notify";

type Result = { error: string | null; warning?: string | null };

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

/**
 * Optional business / tax / banking details (supabase/client-business-details.sql).
 * Kept apart from the core fields so a database that hasn't run that migration
 * yet still saves the client — see `saveClientValues`.
 */
const DETAIL_FIELDS = [
  "contact_person",
  "ein",
  "state_withholding_id",
  "state_unemployment_id",
  "eft_pin",
  "billing_address",
  "business_address",
  "bank_name",
  "bank_account_number",
  "bank_routing_number",
] as const;

function parseDetails(formData: FormData): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const field of DETAIL_FIELDS) {
    // Absent from the form (e.g. the "New client" dialog) → leave the column alone.
    if (formData.get(field) === null) continue;
    out[field] = emptyToNull(formData.get(field));
  }
  return out;
}

/*
 * These details were write-once: a field that already held a value was locked for
 * good — rendered as read-only text, and any change dropped here as well. That
 * made a mistyped EIN or a closed bank account impossible to correct from the
 * admin panel. The profile is now read-only as a whole until staff press Edit, so
 * that deliberate toggle is what guards against an accidental change, rather than
 * an irreversible first write.
 */

/** A missing column reads as PGRST204 from PostgREST's schema cache. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST204" || /column .* does not exist/i.test(error.message ?? "");
}

const MIGRATION_HINT =
  "Business, tax and banking fields weren't saved — run supabase/client-business-details.sql in Supabase.";

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

const clampStage = (v: FormDataEntryValue | null) =>
  Math.max(0, Math.min(5, Math.round(Number(v ?? 0) || 0)));

/**
 * Keep the client's dashboard engagement (an onboarding_submissions row) in sync
 * with the admin client record. One "portal engagement" per client, linked by
 * client_id. Preserves an already-linked user_id so re-editing a client never
 * detaches their login. No-op when no service is selected.
 */
/**
 * Ping the client on their dashboard when their progress bar moves forward.
 * Targets the client's portal user (falls back to the submission's user), so it
 * only fires for a client who can actually log in. Best-effort — never blocks a save.
 */
async function notifyStageAdvance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  submissionUserId: string | null,
  prevStage: number,
  nextStage: number,
  service: OnboardingService,
): Promise<string | null> {
  try {
    if (nextStage <= prevStage) return null;
    const label = stageLabelsForService(service)[nextStage];
    if (!label) return null;
    // Resolve the client's portal user (for the in-app ping) + email (for Resend).
    const { data } = await supabase
      .from("clients")
      .select("user_id, email")
      .eq("id", clientId)
      .maybeSingle();
    const client = data as { user_id?: string | null; email?: string | null } | null;
    const userId = submissionUserId ?? client?.user_id ?? null;
    if (userId) {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: `Progress update: ${label}`,
        body: `Good news — your application has moved forward to: ${label}.`,
      });
    }
    const emailed = await sendProgressEmail(client?.email, label);
    // Self-describing: callers surface the warning verbatim in a toast.
    return emailed.ok ? null : `Client email not sent — ${emailed.error ?? "unknown error"}`;
  } catch {
    /* non-fatal: the stage was already saved */
    return null;
  }
}

async function syncEngagement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  client: ClientValues,
  engagement: EngagementValues,
): Promise<{ error: string | null; warning: string | null }> {
  if (!engagement.service) return { error: null, warning: null };

  const { data: existing } = await supabase
    .from("onboarding_submissions")
    .select("id, filing_stage, user_id")
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
    if (error) return { error: error.message, warning: null };
    const ex = existing as { filing_stage?: number | null; user_id?: string | null };
    const warning = await notifyStageAdvance(
      supabase,
      clientId,
      ex.user_id ?? null,
      Number(ex.filing_stage ?? 0),
      Number(engagement.filing_stage ?? 0),
      engagement.service,
    );
    return { error: null, warning };
  }

  const { error } = await supabase.from("onboarding_submissions").insert(payload);
  if (error) return { error: error.message, warning: null };
  // First-time engagement (admin-created client, no prior submission): treat as a
  // move from stage 0 so setting a real milestone still notifies + emails.
  const warning = await notifyStageAdvance(
    supabase,
    clientId,
    null,
    0,
    Number(engagement.filing_stage ?? 0),
    engagement.service,
  );
  return { error: null, warning };
}

/**
 * Save the per-service edits made on the client Profile tab.
 *
 * A client can hold several services at once — the ones we set up plus any they
 * raise themselves from their dashboard later — so the form posts one
 * `engagement_id` per service alongside its own `stage_<id>` / `payment_<id>`.
 * Rows the form didn't carry are left untouched, and a row that only matched by
 * login gets its `client_id` backfilled so it's properly attached from now on.
 */
async function saveEngagementEdits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  client: ClientValues,
  formData: FormData,
): Promise<{ error: string | null; warning: string | null }> {
  const ids = formData.getAll("engagement_id").map(String).filter(Boolean);
  if (!ids.length) return { error: null, warning: null };

  const { data, error } = await supabase
    .from("onboarding_submissions")
    .select("id, client_id, user_id, service, filing_stage")
    .in("id", ids);
  if (error) return { error: error.message, warning: null };

  // A row can belong to this client by client_id or (dashboard-raised, not yet
  // linked) by the client's login. Anything else in the form is ignored.
  const { data: owner } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();
  const clientUserId = (owner as { user_id?: string | null } | null)?.user_id ?? null;

  type Row = {
    id: string;
    client_id: string | null;
    user_id: string | null;
    service: OnboardingService;
    filing_stage: number | null;
  };

  let warning: string | null = null;
  for (const row of (data as Row[]) ?? []) {
    if (row.client_id !== clientId && !(clientUserId && row.user_id === clientUserId)) continue;

    const stageRaw = formData.get(`stage_${row.id}`);
    const payRaw = formData.get(`payment_${row.id}`);
    const patch: Record<string, unknown> = {};
    if (stageRaw !== null) patch.filing_stage = clampStage(stageRaw);
    if (payRaw !== null) patch.payment_status = String(payRaw) === "paid" ? "paid" : "pending";
    // Keep the client's own contact details on their service requests, and
    // attach a dashboard-raised row that only matched by login. Only values we
    // actually have — never blank out what the client submitted themselves.
    patch.name = client.name;
    if (client.email) patch.email = client.email;
    if (client.company) patch.company = client.company;
    if (row.client_id !== clientId) patch.client_id = clientId;

    const { error: upErr } = await supabase
      .from("onboarding_submissions")
      .update(patch)
      .eq("id", row.id);
    if (upErr) return { error: upErr.message, warning };

    if (typeof patch.filing_stage === "number") {
      const w = await notifyStageAdvance(
        supabase,
        clientId,
        row.user_id,
        Number(row.filing_stage ?? 0),
        patch.filing_stage,
        row.service,
      );
      warning ??= w;
    }
  }
  return { error: null, warning };
}

/**
 * Add a service to an existing client from the Profile tab ("Add a service").
 * Always a new row — a client can genuinely hold two of the same service (two
 * formations, say), so this never overwrites one they already have.
 */
async function addEngagement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  client: ClientValues,
  formData: FormData,
): Promise<{ error: string | null }> {
  const raw = String(formData.get("add_service") ?? "").trim();
  if (!(ONBOARDING_SERVICES as string[]).includes(raw)) return { error: null };

  const { data: owner } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();

  const { error } = await supabase.from("onboarding_submissions").insert({
    service: raw as OnboardingService,
    name: client.name,
    email: client.email,
    company: client.company,
    plan: client.plan,
    status: "won" as const,
    filing_stage: 0,
    payment_status: "pending" as const,
    client_id: clientId,
    // So it shows on the client's own dashboard right away.
    user_id: (owner as { user_id?: string | null } | null)?.user_id ?? null,
  });
  return { error: error?.message ?? null };
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
  const details = parseDetails(formData);
  const password = String(formData.get("password") ?? "").trim();

  const supabase = await createClient();
  let detailWarning: string | null = null;
  let { data, error } = await supabase
    .from("clients")
    .insert({ ...values, ...details })
    .select("id")
    .single();
  if (isMissingColumn(error)) {
    detailWarning = MIGRATION_HINT;
    ({ data, error } = await supabase.from("clients").insert(values).select("id").single());
  }
  if (error || !data) return { error: error?.message ?? "Could not save the client." };

  const eng = await syncEngagement(supabase, data.id, values, engagement);
  if (eng.error) return { error: `Client saved, but the dashboard engagement failed: ${eng.error}` };

  const pwErr = await provisionClientLogin(data.id, values.email, password);
  if (pwErr) return { error: `Client saved, but the login failed: ${pwErr}` };

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { error: null, warning: eng.warning ?? detailWarning };
}

export async function updateClientRecord(
  id: string,
  formData: FormData,
): Promise<Result> {
  const values = parseForm(formData);
  if (!values.name) return { error: "Name is required." };
  const password = String(formData.get("password") ?? "").trim();

  const supabase = await createClient();
  const details = parseDetails(formData);
  let detailWarning: string | null = null;
  let { error } = await supabase
    .from("clients")
    .update({ ...values, ...details })
    .eq("id", id);
  if (isMissingColumn(error)) {
    detailWarning = MIGRATION_HINT;
    ({ error } = await supabase.from("clients").update(values).eq("id", id));
  }
  if (error) return { error: error.message };

  const eng = await saveEngagementEdits(supabase, id, values, formData);
  if (eng.error) return { error: `Client saved, but a service update failed: ${eng.error}` };

  const added = await addEngagement(supabase, id, values, formData);
  if (added.error) return { error: `Client saved, but the new service failed: ${added.error}` };

  const pwErr = await provisionClientLogin(id, values.email, password);
  if (pwErr) return { error: `Client saved, but the login failed: ${pwErr}` };

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { error: null, warning: eng.warning ?? detailWarning };
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

/** Quick inline status change from the client profile (no full edit form). */
export async function updateClientStatus(
  id: string,
  status: ClientStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  return { error: null };
}

/**
 * Upload a document for a client from the admin profile page. Stored in the same
 * `client-documents` bucket + `client_documents` table the dashboard reads, and
 * linked to the client's portal user (when they have one) so it shows up for them.
 */
export async function uploadClientDocument(
  clientId: string,
  formData: FormData,
): Promise<Result> {
  if (!(await currentUserIsStaff())) return { error: "Staff access required." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 25 * 1024 * 1024) return { error: "File is too large (max 25 MB)." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Documents are not configured." };
  }

  // Link the upload to the client's portal user (if any) so it appears on their dashboard.
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();

  const safeName = (file.name || "document").replace(/[^\w.\-]+/g, "_").slice(-120) || "document";
  const path = `${clientId}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const up = await admin.storage.from("client-documents").upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (up.error) return { error: up.error.message };

  const { error } = await admin.from("client_documents").insert({
    client_id: clientId,
    user_id: (client as { user_id?: string | null } | null)?.user_id ?? null,
    name: (file.name || "document").slice(0, 200),
    path,
    size: file.size,
  });
  if (error) {
    // Roll back the orphaned object so we don't leave a file with no row.
    await admin.storage.from("client-documents").remove([path]);
    return { error: error.message };
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { error: null };
}

/** Remove a client document (storage object + table row). */
export async function deleteClientDocument(
  clientId: string,
  path: string,
): Promise<Result> {
  if (!(await currentUserIsStaff())) return { error: "Staff access required." };
  if (!path) return { error: "Missing document." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Documents are not configured." };
  }

  await admin.storage.from("client-documents").remove([path]);
  const { error } = await admin.from("client_documents").delete().eq("path", path);
  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { error: null };
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}
