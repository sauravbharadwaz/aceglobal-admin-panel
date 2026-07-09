import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Client,
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
 * Map of client_id → the client's dashboard engagement (service / filing stage /
 * payment), used to prefill the client editor and show portal state. Returns an
 * empty map if the columns/table aren't migrated yet.
 */
export async function getClientEngagements(): Promise<Record<string, ClientEngagement>> {
  if (!isSupabaseConfigured) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_submissions")
    .select("id, client_id, service, filing_stage, payment_status, details")
    .not("client_id", "is", null)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return {};
    // A missing client_id column also degrades gracefully.
    if (/client_id/i.test(error.message ?? "")) return {};
    throw new Error(error.message);
  }
  const map: Record<string, ClientEngagement> = {};
  for (const row of (data as (ClientEngagement & { details?: Record<string, unknown> })[]) ?? []) {
    // earliest row per client is the primary engagement (ascending order above)
    if (!row.client_id || map[row.client_id]) continue;
    const rawDocs = (row.details?.documents as unknown) ?? [];
    const documents = Array.isArray(rawDocs)
      ? rawDocs
          .filter((d): d is { name?: string; path?: string; size?: number } =>
            !!d && typeof d === "object" && typeof (d as { path?: unknown }).path === "string")
          .map((d) => ({ name: d.name ?? "document", path: d.path as string, size: d.size ?? null }))
      : [];
    map[row.client_id] = {
      id: row.id,
      client_id: row.client_id,
      service: row.service,
      filing_stage: row.filing_stage,
      payment_status: row.payment_status,
      documents,
    };
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
