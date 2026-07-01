import {
  getClients,
  getInvoices,
  getLeads,
  getOnboardingSubmissions,
} from "@/lib/data";
import { formatCurrency, titleCase } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthlyBarChart } from "@/components/insights/insights-charts";
import { ONBOARDING_SERVICE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function last6Months() {
  const now = new Date();
  const buckets: { key: string; month: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()] });
  }
  return buckets;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export default async function InsightsPage() {
  const [leads, invoices, clients, onboarding] = await Promise.all([
    getLeads(),
    getInvoices(),
    getClients(),
    getOnboardingSubmissions(),
  ]);

  const buckets = last6Months();

  const leadsByMonth = buckets.map((b) => ({
    month: b.month,
    value: leads.filter((l) => monthKey(l.created_at) === b.key).length,
  }));

  const revenueByMonth = buckets.map((b) => ({
    month: b.month,
    value: invoices
      .filter((i) => i.status === "paid" && monthKey(i.created_at) === b.key)
      .reduce((s, i) => s + Number(i.amount ?? 0), 0),
  }));

  const serviceMix = (["bookkeeping", "corporate-tax", "company-formation"] as const).map(
    (svc) => ({
      label: ONBOARDING_SERVICE_LABELS[svc],
      value: onboarding.filter((o) => o.service === svc).length,
    }),
  );

  const invoiceStatus = ["draft", "sent", "paid", "overdue", "void"].map((s) => ({
    label: titleCase(s),
    value: invoices.filter((i) => i.status === s).length,
  }));

  const clientStatus = ["active", "onboarding", "inactive", "churned"].map((s) => ({
    label: titleCase(s),
    value: clients.filter((c) => c.status === s).length,
  }));

  const collectedTotal = revenueByMonth.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Trends across leads, revenue, and client activity.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">New leads · last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBarChart data={leadsByMonth} kind="leads" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span>Collected · last 6 months</span>
              <span className="text-muted-foreground">{formatCurrency(collectedTotal)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBarChart data={revenueByMonth} kind="revenue" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard title="Onboarding by service" items={serviceMix} bar="bg-primary" />
        <BreakdownCard title="Invoices by status" items={invoiceStatus} bar="bg-amber-500" />
        <BreakdownCard title="Clients by status" items={clientStatus} bar="bg-emerald-500" />
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  items,
  bar,
}: {
  title: string;
  items: { label: string; value: number }[];
  bar: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((i) => (
          <div key={i.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{i.label}</span>
              <span className="text-muted-foreground">{i.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${bar}`}
                style={{ width: `${(i.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
