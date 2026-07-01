import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Client,
  Lead,
  LeadStatus,
  OnboardingSubmission,
} from "@/lib/types";

export async function getOnboardingSubmissions(): Promise<OnboardingSubmission[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_submissions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as OnboardingSubmission[]) ?? [];
}

export async function getLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Lead[]) ?? [];
}

export async function getClients(): Promise<Client[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Client[]) ?? [];
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
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function getDashboardData(): Promise<DashboardData> {
  const [leads, clients] = await Promise.all([getLeads(), getClients()]);

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

  return {
    leadCounts,
    totalLeads: leads.length,
    activeClients,
    onboardingClients,
    totalClients: clients.length,
    mrr,
    recentLeads: leads.slice(0, 6),
    leadsByMonth: buckets.map(({ month, leads }) => ({ month, leads })),
  };
}
