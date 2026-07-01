export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";

export type ClientStatus = "active" | "onboarding" | "inactive" | "churned";

export type OnboardingService =
  | "bookkeeping"
  | "corporate-tax"
  | "company-formation";

export type OnboardingStatus = "new" | "reviewing" | "quoted" | "won" | "lost";

export interface OnboardingSubmission {
  id: string;
  created_at: string;
  service: OnboardingService;
  name: string | null;
  email: string | null;
  company: string | null;
  plan: string | null;
  status: OnboardingStatus;
  details: Record<string, unknown>;
}

export interface Lead {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  service: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  notes: string | null;
}

export interface Client {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: ClientStatus;
  plan: string | null;
  mrr: number;
  owner: string | null;
  notes: string | null;
}

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
];

export const CLIENT_STATUSES: ClientStatus[] = [
  "active",
  "onboarding",
  "inactive",
  "churned",
];

export const ONBOARDING_STATUSES: OnboardingStatus[] = [
  "new",
  "reviewing",
  "quoted",
  "won",
  "lost",
];

export const ONBOARDING_SERVICES: OnboardingService[] = [
  "bookkeeping",
  "corporate-tax",
  "company-formation",
];

export const ONBOARDING_SERVICE_LABELS: Record<OnboardingService, string> = {
  bookkeeping: "Bookkeeping",
  "corporate-tax": "Corporate Tax",
  "company-formation": "Company Formation",
};
