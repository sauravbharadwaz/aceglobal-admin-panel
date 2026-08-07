// Builds the company-formation application PDF from an onboarding submission's
// stored `details` (the raw form state). Mirrors the client dashboard's builder
// so the admin and the client download an identical document. jsPDF is imported
// statically here, but this module is only imported dynamically (on click), so it
// stays out of the initial admin bundle.
import { jsPDF } from "jspdf";
import type { OnboardingSubmission } from "@/lib/types";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  taxcomp: "Tax & Compliance",
  concierge: "Concierge",
};

type Details = Record<string, unknown>;
type Shareholder = {
  first?: string; last?: string; business?: string; ssn?: string; pct?: string | number;
  address?: string; email?: string; phone?: string; dob?: string; main?: boolean; index?: number;
};
type Application = {
  orderRef?: string | null;
  submittedAt?: string;
  applicant: { name: string; email: string };
  company: {
    residence: string; goal: string; entity: string;
    nameChoices: string[]; dba: string[] | null; natureOfBusiness: string; formationState: string;
  };
  contact: { line1: string; line2: string; city: string; state: string; zip: string; country: string; phone: string; email: string };
  shareholders: Shareholder[];
  plan: { name: string; total: number | null };
  payment: { status: string };
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function applicationFromRow(row: OnboardingSubmission): Application {
  const d = (row.details || {}) as Details;
  const shCount = parseInt(str(d.shCount), 10) || 0;
  const shList = Array.isArray(d.shList) ? (d.shList as Shareholder[]) : [];
  const nameChoices = [d.name, d.name2, d.name3].map(str).filter((x) => x.trim());
  const dba =
    d.dba === "yes"
      ? [d.dbaName, d.dbaName2, d.dbaName3].map(str).filter((x) => x.trim())
      : d.dba === "no"
        ? []
        : null;
  const entity = (d.entity === "ccorp" ? "C-Corp" : "LLC") + (d.scorp === "yes" ? " · S-Corp" : "");
  return {
    orderRef: row.order_ref ?? null,
    submittedAt: row.created_at,
    applicant: { name: row.name ?? "", email: row.email ?? str(d.bizEmail) },
    company: {
      residence: str(d.country),
      goal: d.intent === "grow" ? "Run & grow existing US business" : "Form & start a new US business",
      entity,
      nameChoices,
      dba,
      natureOfBusiness: str(d.bizNature),
      formationState: str(d.state),
    },
    contact: {
      line1: str(d.addrLine1), line2: str(d.addrLine2), city: str(d.addrCity),
      state: str(d.addrState), zip: str(d.addrZip), country: str(d.addrCountry),
      phone: str(d.bizPhone), email: str(d.bizEmail),
    },
    shareholders: shList.map((s, i) => ({ ...s, index: i, main: shCount > 1 && d.mainOwner === i })),
    plan: { name: PLAN_NAMES[str(d.plan) || (row.plan ?? "")] || "", total: row.amount_total ?? null },
    payment: { status: row.payment_status || "pending" },
  };
}

function money(n: number | null): string {
  return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function companyNameOf(row: OnboardingSubmission): string {
  const d = (row.details || {}) as Details;
  return str(d.name) || row.company || "Company";
}

export function downloadApplicationPDF(row: OnboardingSubmission): void {
  const a = applicationFromRow(row);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 48, CW = PW - M * 2;
  const ink: [number, number, number] = [15, 27, 76];
  const muted: [number, number, number] = [120, 115, 160];
  const faint: [number, number, number] = [168, 164, 200];
  let y = 0;

  const ensure = (h: number) => { if (y + h > PH - M) { doc.addPage(); y = M; } };
  const sectionTitle = (t: string) => {
    ensure(34); y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...faint);
    doc.text(t.toUpperCase(), M, y + 8); y += 18;
  };
  const kvRow = (k: string, v: unknown) => {
    const val = v == null || String(v).trim() === "" ? "—" : String(v);
    const keyW = 165, valX = M + keyW + 12, valW = CW - keyW - 12;
    doc.setFontSize(10.5); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(val, valW);
    const h = Math.max(17, lines.length * 13 + 5);
    ensure(h);
    doc.setTextColor(...muted); doc.setFont("helvetica", "normal");
    doc.text(k, M, y + 11, { maxWidth: keyW });
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold");
    doc.text(lines, valX, y + 11);
    doc.setDrawColor(238, 236, 247); doc.setLineWidth(0.5); doc.line(M, y + h - 2, M + CW, y + h - 2);
    y += h;
  };

  const company = companyNameOf(row);

  // Header band
  doc.setFillColor(75, 59, 184); doc.rect(0, 0, PW, 92, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("Company Formation Application", M, 42);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(228, 224, 250);
  doc.text(doc.splitTextToSize(company, CW - 120), M, 64);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text("Ace Global", PW - M, 42, { align: "right" });
  y = 92 + 24;

  const submitted = a.submittedAt ? new Date(a.submittedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "";
  const meta = [
    "Status: " + (a.payment.status === "paid" ? "Paid" : "Payment pending"),
    submitted ? "Submitted: " + submitted : "",
    a.orderRef ? "Ref: " + a.orderRef : "",
  ].filter(Boolean);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...muted);
  doc.text(doc.splitTextToSize(meta.join("     "), CW), M, y); y += 10;

  sectionTitle("Applicant");
  kvRow("Name", a.applicant.name);
  kvRow("Email", a.applicant.email);

  sectionTitle("Company");
  kvRow("Country of residence", a.company.residence);
  kvRow("Goal", a.company.goal);
  kvRow("Entity type", a.company.entity);
  kvRow("Name choices", a.company.nameChoices.join("   |   "));
  kvRow("DBA name(s)", a.company.dba == null ? "" : a.company.dba.length ? a.company.dba.join(", ") : "Not needed");
  kvRow("Nature of business", a.company.natureOfBusiness);
  kvRow("Formation state", a.company.formationState);

  sectionTitle("Address & contact");
  kvRow("Business address", [a.contact.line1, a.contact.line2, a.contact.city, a.contact.state, a.contact.zip, a.contact.country].filter((x) => x && x.trim()).join(", "));
  kvRow("Business phone", a.contact.phone);
  kvRow("Business email", a.contact.email);

  sectionTitle("Shareholders & ownership");
  if (!a.shareholders.length) kvRow("Shareholders", "");
  a.shareholders.forEach((s, i) => {
    ensure(26); y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...ink);
    const nm = (s.first ? `${i + 1}. ${(s.first + " " + (s.last || "")).trim()}` : "Shareholder " + (i + 1)) + (s.main ? "   (Main owner)" : "");
    doc.text(nm, M, y + 10); y += 20;
    if (s.business && String(s.business).trim()) kvRow("Business (if entity)", s.business);
    kvRow("SSN / EIN", s.ssn);
    kvRow("Percentage holding", s.pct != null && String(s.pct).trim() !== "" ? s.pct + "%" : "");
    kvRow("Address", s.address);
    kvRow("Email", s.email);
    kvRow("Phone", s.phone);
    kvRow("Date of birth", s.dob);
  });

  sectionTitle("Plan & order");
  kvRow("Package", a.plan.name);
  kvRow("Total", a.plan.total != null ? money(a.plan.total) : "");
  kvRow("Payment status", a.payment.status === "paid" ? "Paid" : "Payment pending");

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...faint);
    doc.text("Ace Global · Company Formation Application", M, PH - 22);
    doc.text(`Page ${i} of ${pages}`, PW - M, PH - 22, { align: "right" });
  }

  const safe = company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "application";
  doc.save(`Ace-Global-Application-${safe}.pdf`);
}

const SERVICE_TITLES: Record<string, string> = {
  bookkeeping: "Bookkeeping Request",
  "corporate-tax": "Corporate Tax Request",
  "tax-account": "Tax Account Registration",
  "existing-business": "Business Profile",
};

/**
 * Readable names for detail keys whose camelCase does not survive the generic
 * "einNumber" → "Ein number" transform. Anything absent falls back to that.
 */
const FIELD_LABELS: Record<string, string> = {
  business: "Legal name",
  method: "Added by",
  entity: "Business type",
  ein: "EIN",
  stateId: "State ID / file number",
  formState: "State of registration",
  bizEmail: "Business email",
  bizPhone: "Business phone",
  addrLine1: "Address line 1",
  addrLine2: "Address line 2",
  addrCity: "City",
  addrState: "State",
  addrZip: "ZIP / postal code",
  addrCountry: "Country",
  clientName: "Contact name",
  clientEmail: "Contact email",
  clientPhone: "Contact phone",
  stateDoc: "State document",
  federalDoc: "Federal document",
};

/** True for a details value that is an uploaded-file manifest: [{ name, path }]. */
function isFileManifest(v: unknown): v is Array<{ name?: string; path?: string }> {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((f) => !!f && typeof f === "object" && typeof (f as { path?: unknown }).path === "string")
  );
}

/**
 * Bookkeeping, corporate-tax and tax-account forms have no fixed shape — each
 * captures its own set of answers — so render whatever the client actually
 * submitted rather than forcing it through the formation layout, which would
 * come out mostly blank.
 */
function downloadRequestPDF(row: OnboardingSubmission): void {
  const d = (row.details || {}) as Details;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 48, CW = PW - M * 2;
  const ink: [number, number, number] = [15, 27, 76];
  const muted: [number, number, number] = [120, 115, 160];
  const faint: [number, number, number] = [168, 164, 200];
  let y = 0;

  const ensure = (h: number) => { if (y + h > PH - M) { doc.addPage(); y = M; } };
  const kvRow = (k: string, v: unknown) => {
    const val = v == null || String(v).trim() === "" ? "—" : String(v);
    const keyW = 165, valX = M + keyW + 12, valW = CW - keyW - 12;
    doc.setFontSize(10.5); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(val, valW);
    const h = Math.max(17, lines.length * 13 + 5);
    ensure(h);
    doc.setTextColor(...muted); doc.setFont("helvetica", "normal");
    doc.text(k, M, y + 11, { maxWidth: keyW });
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold");
    doc.text(lines, valX, y + 11);
    doc.setDrawColor(238, 236, 247); doc.setLineWidth(0.5); doc.line(M, y + h - 2, M + CW, y + h - 2);
    y += h;
  };
  // "bizType" → "Biz type"; leading underscores mark internal bookkeeping fields.
  const label = (k: string) =>
    FIELD_LABELS[k] ??
    k.replace(/^_/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  const show = (v: unknown): string => {
    if (Array.isArray(v)) return v.map(show).filter(Boolean).join(", ");
    if (v && typeof v === "object") {
      return Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => String(x ?? "").trim() !== "")
        .map(([k, x]) => `${label(k)}: ${show(x)}`)
        .join(" · ");
    }
    if (v === true) return "Yes";
    if (v === false) return "No";
    return v == null ? "" : String(v);
  };

  const title = SERVICE_TITLES[row.service] || "Service Request";
  const company = row.company || str(d.business) || "Client";

  doc.setFillColor(75, 59, 184); doc.rect(0, 0, PW, 92, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(title, M, 42);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(228, 224, 250);
  doc.text(doc.splitTextToSize(company, CW - 120), M, 64);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text("Ace Global", PW - M, 42, { align: "right" });
  y = 92 + 24;

  const submitted = row.created_at
    ? new Date(row.created_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
    : "";
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...muted);
  doc.text([submitted ? "Submitted: " + submitted : "", row.email ? "Contact: " + row.email : ""].filter(Boolean).join("     "), M, y);
  y += 10;

  y += 14;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...faint);
  doc.text("SUBMITTED DETAILS", M, y + 8); y += 18;

  /* Uploads are listed under their own heading, not inline: `show()` would flatten
     each record into "Name: x · Path: y · Size: z" and print the storage path.
     Detected by shape rather than by key name — 'documents' on a tax-account
     request, 'stateDoc'/'federalDoc' on a business profile, others later. */
  const fileKeys = Object.keys(d).filter((k) => isFileManifest(d[k]));
  const keys = Object.keys(d).filter(
    (k) => !fileKeys.includes(k) && k !== "documents" && show(d[k]).trim() !== "",
  );
  if (!keys.length) kvRow("Details", "");
  for (const k of keys) kvRow(label(k), show(d[k]));

  const files = fileKeys.flatMap((k) =>
    (d[k] as Array<{ name?: string }>).map((f) => ({ key: k, name: f?.name || "document" })),
  );
  if (files.length) {
    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...faint);
    doc.text("ATTACHED FILES", M, y + 8); y += 18;
    files.forEach((f, i) => kvRow(fileKeys.length > 1 ? label(f.key) : `File ${i + 1}`, f.name));
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...faint);
    doc.text(`Ace Global · ${title}`, M, PH - 22);
    doc.text(`Page ${i} of ${pages}`, PW - M, PH - 22, { align: "right" });
  }

  const safe = company.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "request";
  doc.save(`Ace-Global-${title.replace(/\s+/g, "-")}-${safe}.pdf`);
}

/** Any service request as a PDF — the formation layout where it fits, a plain
 *  rendering of the submitted answers everywhere else. */
export function downloadSubmissionPDF(row: OnboardingSubmission): void {
  if (row.service === "company-formation") downloadApplicationPDF(row);
  else downloadRequestPDF(row);
}
