export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";

export type ClientStatus = "active" | "onboarding" | "inactive" | "churned";

export type ExpertStatus = "active" | "inactive" | "on-leave";

export interface Expert {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  specialties: string | null;
  status: ExpertStatus;
  notes: string | null;
}

export const EXPERT_STATUSES: ExpertStatus[] = ["active", "inactive", "on-leave"];

export const EXPERT_ROLES = [
  "CPA",
  "Bookkeeper",
  "Tax Specialist",
  "Reviewer",
  "Account Manager",
];

export type MeetingType = "call" | "video" | "in-person";
export type MeetingStatus = "scheduled" | "completed" | "cancelled" | "no-show";

export interface Meeting {
  id: string;
  created_at: string;
  client_name: string;
  expert: string | null;
  purpose: string | null;
  scheduled_at: string | null;
  type: MeetingType;
  status: MeetingStatus;
  notes: string | null;
}

export const MEETING_TYPES: MeetingType[] = ["call", "video", "in-person"];
export const MEETING_STATUSES: MeetingStatus[] = [
  "scheduled",
  "completed",
  "cancelled",
  "no-show",
];

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export interface Invoice {
  id: string;
  created_at: string;
  client_name: string;
  number: string | null;
  amount: number;
  status: InvoiceStatus;
  issued_at: string | null;
  due_at: string | null;
  notes: string | null;
}

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
];

export interface Review {
  id: string;
  created_at: string;
  expert: string;
  client_name: string | null;
  rating: number;
  comment: string | null;
}

export type PayoutStatus = "pending" | "paid";

export interface Payout {
  id: string;
  created_at: string;
  expert: string;
  period: string | null;
  amount: number;
  status: PayoutStatus;
  notes: string | null;
}

export const PAYOUT_STATUSES: PayoutStatus[] = ["pending", "paid"];

export type OnboardingService =
  | "bookkeeping"
  | "corporate-tax"
  | "company-formation"
  | "tax-account";

export type OnboardingStatus = "new" | "reviewing" | "quoted" | "won" | "lost";

export type PaymentStatus = "pending" | "paid";

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
  // Payment tracking (company-formation orders; NULL for services without payment).
  order_ref?: string | null;
  payment_status?: PaymentStatus | null;
  amount_total?: number | null;
  stripe_session_id?: string | null;
  stripe_subscription_id?: string | null;
  paid_at?: string | null;
  // Auth ownership + live filing progress (0..5) shown on the client dashboard.
  user_id?: string | null;
  filing_stage?: number | null;
}

// Formation filing milestones the admin advances (index = filing_stage value).
export const FILING_STAGES: string[] = [
  "Not started",
  "Name reserved",
  "State filing submitted",
  "EIN obtained",
  "Registered agent set up",
  "Complete",
];

// Register-New-Tax-Account milestones (reuses filing_stage; index = value 0..4).
export const TAX_ACCOUNT_STAGES: string[] = [
  "Requested",
  "Received Documents",
  "Submitted with Agency",
  "Waiting Approval",
  "Approved",
];

/** Progress-stage labels for a given service (blank for services without a tracker). */
export function stageLabelsForService(service: string | null | undefined): string[] {
  if (service === "company-formation") return FILING_STAGES;
  if (service === "tax-account") return TAX_ACCOUNT_STAGES;
  return [];
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

export type PortalStatus = "none" | "invited" | "active";

export const PORTAL_STATUSES: PortalStatus[] = ["none", "invited", "active"];

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
  // Client portal (dashboard access)
  user_id?: string | null;
  portal_status?: PortalStatus | null;
}

/** The dashboard engagement linked to a client (one onboarding_submissions row). */
export interface ClientEngagement {
  id: string;
  client_id: string;
  service: OnboardingService;
  filing_stage: number | null;
  payment_status: PaymentStatus | null;
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
  "tax-account",
];

export const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid"];

export const ONBOARDING_SERVICE_LABELS: Record<OnboardingService, string> = {
  bookkeeping: "Bookkeeping",
  "corporate-tax": "Corporate Tax",
  "company-formation": "Company Formation",
  "tax-account": "Register New Tax Account",
};
