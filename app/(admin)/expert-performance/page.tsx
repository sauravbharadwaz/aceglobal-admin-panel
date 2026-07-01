import { getClients, getExperts, getMeetings, getPayouts, getReviews } from "@/lib/data";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Stars } from "@/components/reviews/reviews-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ExpertPerformancePage() {
  const [experts, meetings, clients, reviews, payouts] = await Promise.all([
    getExperts(),
    getMeetings(),
    getClients(),
    getReviews(),
    getPayouts(),
  ]);

  const rows = experts.map((e) => {
    const myMeetings = meetings.filter((m) => m.expert === e.name);
    const completed = myMeetings.filter((m) => m.status === "completed").length;
    const myClients = clients.filter((c) => c.owner === e.name);
    const mrr = myClients.reduce((s, c) => s + Number(c.mrr ?? 0), 0);
    const myReviews = reviews.filter((r) => r.expert === e.name);
    const avgRating =
      myReviews.length > 0
        ? myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length
        : 0;
    const paidOut = payouts
      .filter((p) => p.expert === e.name && p.status === "paid")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return {
      expert: e,
      meetings: myMeetings.length,
      completed,
      clients: myClients.length,
      mrr,
      avgRating,
      reviewCount: myReviews.length,
      paidOut,
    };
  });

  const totalManaged = rows.reduce((s, r) => s + r.mrr, 0);
  const totalMeetings = rows.reduce((s, r) => s + r.meetings, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidOut, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expert Performance</h1>
        <p className="text-sm text-muted-foreground">
          Throughput and value delivered per team member.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Managed MRR" value={formatCurrency(totalManaged)} />
        <SummaryTile label="Meetings logged" value={String(totalMeetings)} />
        <SummaryTile label="Paid out" value={formatCurrency(totalPaid)} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Expert</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="text-center">Clients</TableHead>
              <TableHead className="text-right">Managed MRR</TableHead>
              <TableHead className="text-center">Meetings</TableHead>
              <TableHead className="hidden sm:table-cell">Rating</TableHead>
              <TableHead className="text-right">Paid out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No experts yet. Add team members in Manage Experts.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.expert.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {r.expert.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{r.expert.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {r.expert.role ?? "—"}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{r.clients}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(r.mrr)}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {r.completed}/{r.meetings}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {r.reviewCount > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Stars rating={Math.round(r.avgRating)} />
                        <span className="text-xs text-muted-foreground">
                          {r.avgRating.toFixed(1)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.paidOut)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Meetings shows completed / total. Clients and Managed MRR are matched by the
        account manager set on each client.
      </p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
