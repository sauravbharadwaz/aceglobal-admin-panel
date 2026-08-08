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
  // Set when the invoice was auto-synced from a Stripe payment (null = manual).
  stripe_session_id: string | null;
  client_email: string | null;
  // Set when the invoice was emailed to the client via Stripe (send-invoice flow).
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
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
  | "tax-account"
  /** A client who already trades, recording the business they have. Nothing is filed. */
  | "existing-business";

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
  /** Set when the request came from (or was matched to) an existing client. */
  client_id?: string | null;
}

/** The client a submission belongs to, when it isn't a brand-new request. */
export interface SubmissionClient {
  id: string;
  name: string;
}

// Formation filing milestones the admin advances (index = filing_stage value).
export const FILING_STAGES: string[] = [
  "Not started",
  "Name reserved",
  "State filing submitted",
  "EIN obtained",
  "Registered agent set up",
  // Same milestone the client sees as the last step on their dashboard
  // (FILING_LABELS in app.aceglobal.ai/dashboard.html). Stage 5 is the finish
  // line — the operating agreement is the last deliverable.
  "Operating agreement",
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

/**
 * A date the client has to hit — a tax filing, an annual report, documents we
 * need from them. Staff set these on the client profile; the client sees them
 * on their dashboard.
 */
export interface ClientDeadline {
  id: string;
  created_at: string;
  client_id: string;
  title: string;
  /** A plain calendar date ("2026-04-15"), not a timestamp. */
  due_on: string;
  notes: string | null;
  /** Only 'done' is stored — see DeadlineState for what's shown. */
  status: "upcoming" | "done";
  completed_at: string | null;
  service: string | null;
  last_reminded_on: string | null;
}

/**
 * What a due date reads as right now. Derived from `due_on` on every render
 * rather than stored, so nothing goes stale between page loads — the same
 * trick `effectiveInvoiceStatus` uses for overdue invoices.
 */
export type DeadlineState = "done" | "overdue" | "due-soon" | "upcoming";

/** A due date counts as "due soon" once it's this close. */
export const DUE_SOON_DAYS = 14;

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
  // Optional business / tax / banking details (supabase/client-business-details.sql).
  // All nullable — a client can be saved without any of them.
  contact_person?: string | null;
  ein?: string | null;
  state_withholding_id?: string | null;
  state_unemployment_id?: string | null;
  eft_pin?: string | null;
  /**
   * Superseded by the split columns below. Still read so an address typed
   * before the split is not lost; nothing writes them.
   */
  billing_address?: string | null;
  business_address?: string | null;
  billing_line1?: string | null;
  billing_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  billing_country?: string | null;
  business_line1?: string | null;
  business_line2?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_zip?: string | null;
  business_country?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_routing_number?: string | null;
}

/** A business document a client uploaded (stored in the client-documents bucket). */
export interface ClientDocument {
  name: string;
  path: string;
  size?: number | null;
}

/**
 * Values the client already gave us on an onboarding form, offered as prefill
 * for the admin profile. Suggestions only — nothing is stored until a staff
 * member reviews it and saves.
 */
export interface ClientProfileHints {
  contact_person?: string | null;
  ein?: string | null;
  phone?: string | null;
  email?: string | null;
  // The onboarding form collects the address in parts, so it is offered in
  // parts. It used to be joined into one string here and split back by hand.
  business_line1?: string | null;
  business_line2?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_zip?: string | null;
  business_country?: string | null;
}

/**
 * One service a client has with us — backed by a single onboarding_submissions
 * row. A client can hold several (e.g. bookkeeping, then a later company
 * formation raised from their dashboard), so these come back as a list.
 */
export interface ClientEngagement {
  id: string;
  client_id: string;
  service: OnboardingService;
  filing_stage: number | null;
  payment_status: PaymentStatus | null;
  documents: ClientDocument[];
  created_at?: string | null;
  /** False when the row was matched by login (user_id) rather than client_id. */
  linked?: boolean;
  /** What this request's form already told us about the client. */
  hints?: ClientProfileHints;
  /** The submission behind this engagement, for rendering its application PDF. */
  row?: OnboardingSubmission;
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
  "existing-business",
];

export const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid"];

export const ONBOARDING_SERVICE_LABELS: Record<OnboardingService, string> = {
  bookkeeping: "Bookkeeping",
  "corporate-tax": "Corporate Tax",
  "company-formation": "Company Formation",
  "tax-account": "Register New Tax Account",
  "existing-business": "Existing Business",
};
