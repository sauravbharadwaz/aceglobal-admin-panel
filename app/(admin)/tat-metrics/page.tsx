import { getInvoices, getMeetings } from "@/lib/data";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function TatMetricsPage() {
  const [meetings, invoices] = await Promise.all([getMeetings(), getInvoices()]);

  // Meeting -> Invoice turnaround, matched by client name.
  const earliestMeeting = new Map<string, number>();
  for (const m of meetings) {
    if (m.status !== "completed" || !m.scheduled_at) continue;
    const key = m.client_name.trim().toLowerCase();
    const t = new Date(m.scheduled_at).getTime();
    if (!earliestMeeting.has(key) || t < earliestMeeting.get(key)!) {
      earliestMeeting.set(key, t);
    }
  }

  const samples: number[] = [];
  for (const [key, meetingTime] of earliestMeeting) {
    const clientInvoices = invoices
      .filter((i) => i.client_name.trim().toLowerCase() === key)
      .map((i) => new Date(i.created_at).getTime())
      .filter((t) => t >= meetingTime)
      .sort((a, b) => a - b);
    if (clientInvoices.length > 0) {
      samples.push((clientInvoices[0] - meetingTime) / DAY);
    }
  }
  const avgMeetingToInvoice =
    samples.length > 0 ? samples.reduce((s, d) => s + d, 0) / samples.length : null;

  // Funnel
  const meetingsHeld = meetings.filter((m) => m.status === "completed").length;
  const issued = invoices.filter((i) => i.status !== "draft" && i.status !== "void");
  const paid = invoices.filter((i) => i.status === "paid");
  const collectionRate =
    issued.length > 0 ? Math.round((paid.length / issued.length) * 100) : 0;
  const nonVoid = invoices.filter((i) => i.status !== "void");
  const avgInvoice =
    nonVoid.length > 0
      ? nonVoid.reduce((s, i) => s + Number(i.amount ?? 0), 0) / nonVoid.length
      : 0;

  const funnel = [
    { label: "Meetings held", value: meetingsHeld, bar: "bg-blue-500" },
    { label: "Invoices issued", value: issued.length, bar: "bg-amber-500" },
    { label: "Invoices paid", value: paid.length, bar: "bg-emerald-500" },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">TAT Metrics</h1>
        <p className="text-sm text-muted-foreground">
          Turnaround time and conversion across the client journey.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Meeting → Invoice"
          value={avgMeetingToInvoice === null ? "—" : `${avgMeetingToInvoice.toFixed(1)}d`}
          hint={`${samples.length} matched`}
        />
        <MetricTile label="Collection rate" value={`${collectionRate}%`} hint="paid / issued" />
        <MetricTile label="Avg invoice" value={formatCurrency(avgInvoice)} hint="all invoices" />
        <MetricTile label="Meetings held" value={String(meetingsHeld)} hint="completed" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Conversion funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {funnel.map((f) => (
            <div key={f.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{f.label}</span>
                <span className="text-muted-foreground">{f.value}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${f.bar}`}
                  style={{ width: `${(f.value / funnelMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Meeting → Invoice averages the days between a client&apos;s first completed meeting
        and their first invoice, matched by client name. Add more meetings and invoices to
        sharpen these numbers. Payment-date tracking (Invoice → Paid) will come with a Stripe
        integration.
      </p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
