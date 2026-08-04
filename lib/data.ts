import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Client,
  ClientDocument,
  ClientEngagement,
  Expert,
  Invoice,
  Lead,
  LeadStatus,
  Meeting,
  OnboardingSubmission,
  Payout,
  Review,
} from "@/lib/types";

type OrderOpts = { ascending?: boolean; nullsFirst?: boolean };

/** A Postgres/PostgREST error meaning the table hasn't been created yet. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST202") {
    return true;
  }
  return /does not exist|schema cache|could not find the table/i.test(error.message ?? "");
}

/**
 * Fetch all rows from a table. Returns [] when Supabase isn't configured or the
 * table hasn't been created yet — so a missing migration degrades gracefully
 * instead of 500-ing the whole page.
 */
async function fetchAll<T>(
  table: string,
  orderColumn: string,
  orderOpts: OrderOpts = { ascending: false },
): Promise<T[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").order(orderColumn, orderOpts);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data as T[]) ?? [];
}

export function getMeetings(): Promise<Meeting[]> {
  return fetchAll<Meeting>("meetings", "scheduled_at", { ascending: false, nullsFirst: false });
}

export function getInvoices(): Promise<Invoice[]> {
  return fetchAll<Invoice>("invoices", "created_at", { ascending: false });
}

export function getExperts(): Promise<Expert[]> {
  return fetchAll<Expert>("experts", "created_at", { ascending: false });
}

export function getOnboardingSubmissions(): Promise<OnboardingSubmission[]> {
  return fetchAll<OnboardingSubmission>("onboarding_submissions", "created_at", {
    ascending: false,
  });
}

export function getLeads(): Promise<Lead[]> {
  return fetchAll<Lead>("leads", "created_at", { ascending: false });
}

export function getClients(): Promise<Client[]> {
  return fetchAll<Client>("clients", "created_at", { ascending: false });
}

/**
 * Map of client_id → every service that client has with us (one entry per
 * onboarding_submissions row), newest first. A client who raises a second
 * request from their dashboard gets a second entry here rather than having it
 * collapse into the first — that request is theirs, not a fresh lead. Returns an
 * empty map if the columns/table aren't migrated yet.
 */
export async function getClientEngagements(): Promise<Record<string, ClientEngagement[]>> {
  if (!isSupabaseConfigured) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_submissions")
    .select("id, created_at, client_id, user_id, email, service, filing_stage, payment_status, details")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return {};
    // A missing client_id column also degrades gracefully.
    if (/client_id/i.test(error.message ?? "")) return {};
    throw new Error(error.message);
  }

  // Resolve app-submitted requests (client_id NULL) back to their client — by
  // login first, then by email for a client who has no portal login linked. Same
  // rule the Onboarding page uses, so both views agree on whose request it is.
  const clients = await getClients();
  const userToClient: Record<string, string> = {};
  const emailToClient: Record<string, string> = {};
  for (const c of clients) {
    if (c.user_id) userToClient[c.user_id] = c.id;
    if (c.email) emailToClient[c.email.toLowerCase()] = c.id;
  }

  type Row = ClientEngagement & {
    user_id?: string | null;
    email?: string | null;
    details?: Record<string, unknown>;
    created_at?: string | null;
  };
  /**
   * Pull the fields the client already filled in on their onboarding form so the
   * admin profile can offer them instead of asking staff to retype what we have.
   * Formation forms carry the owner, phone and address; the tax and bookkeeping
   * forms carry the EIN.
   */
  const text = (v: unknown) => (v == null ? "" : String(v).trim());
  const extractHints = (details?: Record<string, unknown>) => {
    if (!details) return {};
    const address = [
      details.addrLine1,
      details.addrLine2,
      details.addrCity,
      details.addrState,
      details.addrZip,
      details.addrCountry,
    ]
      .map(text)
      .filter(Boolean)
      .join(", ");
    // `mainOwner` is an INDEX into shList, not a name — the formation form uses
    // it to mark which shareholder is the primary one. Resolve it to the person.
    const shList = Array.isArray(details.shList)
      ? (details.shList as Array<Record<string, unknown>>)
      : [];
    const ownerIndex = Number(details.mainOwner);
    const owner =
      shList[Number.isFinite(ownerIndex) ? ownerIndex : 0] ?? shList[0] ?? null;
    const manager = (details.manager ?? null) as Record<string, unknown> | null;
    const personName = (p: Record<string, unknown> | null) =>
      p ? [text(p.first), text(p.last)].filter(Boolean).join(" ") : "";

    return {
      contact_person: personName(owner) || personName(manager) || null,
      ein: text(details.ein) || null,
      phone: text(details.bizPhone) || null,
      email: text(details.bizEmail) || null,
      business_address: address || null,
    };
  };

  const extractDocs = (details?: Record<string, unknown>) => {
    const raw = (details?.documents as unknown) ?? [];
    return Array.isArray(raw)
      ? raw
          .filter((d): d is { name?: string; path?: string; size?: number } =>
            !!d && typeof d === "object" && typeof (d as { path?: unknown }).path === "string")
          .map((d) => ({ name: d.name ?? "document", path: d.path as string, size: d.size ?? null }))
      : [];
  };

  const map: Record<string, ClientEngagement[]> = {};
  for (const row of (data as Row[]) ?? []) {
    const clientId =
      row.client_id ??
      (row.user_id ? userToClient[row.user_id] : null) ??
      (row.email ? emailToClient[row.email.toLowerCase()] : null);
    if (!clientId) continue;
    (map[clientId] ??= []).push({
      id: row.id,
      client_id: clientId,
      service: row.service,
      filing_stage: row.filing_stage,
      payment_status: row.payment_status,
      documents: extractDocs(row.details),
      created_at: row.created_at ?? null,
      linked: !!row.client_id,
      hints: extractHints(row.details),
    });
  }
  return map;
}

/**
 * Map of client_id → the standalone documents a client uploaded from the
 * dashboard "Documents" section (the `client_documents` table), separate from
 * documents attached to a service request (which live in
 * onboarding_submissions.details.documents and come through getClientEngagements).
 * Resolves each row to a client via client_id, falling back to user_id → client
 * (self-uploaded rows leave client_id NULL). Returns {} if the table isn't
 * migrated yet, so a missing migration degrades gracefully.
 */
export async function getClientDocuments(): Promise<Record<string, ClientDocument[]>> {
  if (!isSupabaseConfigured) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_documents")
    .select("client_id, user_id, name, path, size")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return {};
    throw new Error(error.message);
  }

  const clients = await getClients();
  const userToClient: Record<string, string> = {};
  for (const c of clients) if (c.user_id) userToClient[c.user_id] = c.id;

  type Row = {
    client_id?: string | null;
    user_id?: string | null;
    name?: string | null;
    path?: string | null;
    size?: number | null;
  };
  const map: Record<string, ClientDocument[]> = {};
  for (const row of (data as Row[]) ?? []) {
    if (!row.path) continue;
    const clientId = row.client_id ?? (row.user_id ? userToClient[row.user_id] : null);
    if (!clientId) continue;
    (map[clientId] ??= []).push({
      name: row.name ?? "document",
      path: row.path,
      size: row.size ?? null,
    });
  }
  return map;
}

export function getReviews(): Promise<Review[]> {
  return fetchAll<Review>("reviews", "created_at", { ascending: false });
}

export function getPayouts(): Promise<Payout[]> {
  return fetchAll<Payout>("payouts", "created_at", { ascending: false });
}

export interface DashboardData {
  leadCounts: Record<LeadStatus, number>;
  totalLeads: number;
  activeClients: number;
  onboardingClients: number;
  totalClients: number;
  mrr: number;
  recentLeads: Lead[];
  /** New leads per month for the last 6 months. */
  leadsByMonth: { month: string; leads: number }[];
  // Meetings + invoices (Phase 2)
  draftInvoices: number;
  awaitingPayment: number;
  overdueInvoices: number;
  upcomingMeetings: number;
  totalInvoices: number;
  collected: number;
  outstanding: number;
  totalMeetings: number;
  nextMeetings: Meeting[];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function getDashboardData(): Promise<DashboardData> {
  const [leads, clients, meetings, invoices] = await Promise.all([
    getLeads(),
    getClients(),
    getMeetings(),
    getInvoices(),
  ]);

  const leadCounts: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    lost: 0,
  };
  for (const lead of leads) leadCounts[lead.status]++;

  const activeClients = clients.filter((c) => c.status === "active").length;
  const onboardingClients = clients.filter((c) => c.status === "onboarding").length;
  const mrr = clients.reduce((sum, c) => sum + Number(c.mrr ?? 0), 0);

  // Build the last 6 month buckets (oldest -> newest).
  const now = new Date();
  const buckets: { key: string; month: string; leads: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: MONTHS[d.getMonth()],
      leads: 0,
    });
  }
  for (const lead of leads) {
    const d = new Date(lead.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.leads++;
  }

  // Invoice aggregates
  const draftInvoices = invoices.filter((i) => i.status === "draft").length;
  const awaitingPayment = invoices.filter((i) => i.status === "sent").length;
  const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;
  const collected = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);

  // Meeting aggregates
  const nowMs = now.getTime();
  const upcoming = meetings
    .filter(
      (m) =>
        m.status === "scheduled" &&
        m.scheduled_at &&
        new Date(m.scheduled_at).getTime() >= nowMs,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime(),
    );

  return {
    leadCounts,
    totalLeads: leads.length,
    activeClients,
    onboardingClients,
    totalClients: clients.length,
    mrr,
    recentLeads: leads.slice(0, 6),
    leadsByMonth: buckets.map(({ month, leads }) => ({ month, leads })),
    draftInvoices,
    awaitingPayment,
    overdueInvoices,
    upcomingMeetings: upcoming.length,
    totalInvoices: invoices.length,
    collected,
    outstanding,
    totalMeetings: meetings.length,
    nextMeetings: upcoming.slice(0, 4),
  };
}
