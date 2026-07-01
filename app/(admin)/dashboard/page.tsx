import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Check,
  DollarSign,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { getDashboardData } from "@/lib/data";
import { formatCurrency, timeAgo } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LeadStatusBadge } from "@/components/status-badge";
import { LeadsChart } from "@/components/dashboard/leads-chart";
import type { LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PIPELINE: { status: LeadStatus; label: string; bar: string }[] = [
  { status: "new", label: "New", bar: "bg-blue-500" },
  { status: "contacted", label: "Contacted", bar: "bg-amber-500" },
  { status: "qualified", label: "Qualified", bar: "bg-violet-500" },
  { status: "converted", label: "Converted", bar: "bg-emerald-500" },
  { status: "lost", label: "Lost", bar: "bg-rose-500" },
];

function AttentionCard({
  title,
  subtitle,
  count,
  icon: Icon,
  tint,
  href,
}: {
  title: string;
  subtitle: string;
  count: number;
  icon: React.ElementType;
  tint: string;
  href: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-2 border-b py-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-9 items-center justify-center rounded-lg ${tint}`}>
            <Icon className="size-4.5" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {count}
        </span>
      </CardHeader>
      <CardContent className="flex min-h-[120px] flex-col items-center justify-center py-6 text-center">
        {count === 0 ? (
          <>
            <Check className="mb-2 size-6 text-muted-foreground/50" strokeWidth={2.5} />
            <p className="text-sm text-muted-foreground">All clear</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold tracking-tight">{count}</p>
            <Link
              href={href}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View {title.toLowerCase()} <ArrowUpRight className="size-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PerfTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const maxPipeline = Math.max(1, ...PIPELINE.map((p) => data.leadCounts[p.status]));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Good morning, Admin</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across Ace Global today.
          </p>
        </div>
        <div className="rounded-lg border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">Pipeline value · </span>
          <span className="font-semibold">{formatCurrency(data.mrr)}</span>
          <span className="text-muted-foreground"> MRR</span>
        </div>
      </div>

      {/* Attention Required */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="size-4 text-primary" />
          Attention Required
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AttentionCard
            title="New Leads"
            subtitle="Just came in, no contact yet"
            count={data.leadCounts.new}
            icon={UserPlus}
            tint="bg-blue-50 text-blue-600"
            href="/leads"
          />
          <AttentionCard
            title="Contacted"
            subtitle="Reached out, awaiting reply"
            count={data.leadCounts.contacted}
            icon={Activity}
            tint="bg-amber-50 text-amber-600"
            href="/leads"
          />
          <AttentionCard
            title="Qualified"
            subtitle="Ready to convert"
            count={data.leadCounts.qualified}
            icon={UserCheck}
            tint="bg-violet-50 text-violet-600"
            href="/leads"
          />
          <AttentionCard
            title="Onboarding"
            subtitle="New clients to set up"
            count={data.onboardingClients}
            icon={Users}
            tint="bg-emerald-50 text-emerald-600"
            href="/clients"
          />
        </div>
      </section>

      {/* Lower grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Lead Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4 text-primary" />
              Lead Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PIPELINE.map((p) => {
              const value = data.leadCounts[p.status];
              return (
                <div key={p.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${p.bar}`}
                      style={{ width: `${(value / maxPipeline) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recentLeads.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No recent leads.
              </p>
            ) : (
              data.recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-muted/60"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-muted text-xs">
                      {lead.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{lead.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.company ?? lead.email ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <LeadStatusBadge status={lead.status} />
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(lead.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <PerfTile label="Leads" value={String(data.totalLeads)} icon={UserPlus} />
              <PerfTile label="Clients" value={String(data.totalClients)} icon={Users} />
              <PerfTile
                label="Converted"
                value={String(data.leadCounts.converted)}
                icon={UserCheck}
              />
              <PerfTile label="MRR" value={formatCurrency(data.mrr)} icon={DollarSign} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                New leads · last 6 months
              </p>
              <LeadsChart data={data.leadsByMonth} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
