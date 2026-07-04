"use client";

import { useMemo, useState, useTransition } from "react";
import { BellRing, Download, Eye, MoreHorizontal, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteOnboardingSubmission,
  sendNotification,
  updateFilingStage,
  updateOnboardingStatus,
} from "@/app/(admin)/onboarding/actions";
import {
  FILING_STAGES,
  ONBOARDING_SERVICE_LABELS,
  ONBOARDING_STATUSES,
  type OnboardingStatus,
  type OnboardingSubmission,
  type PaymentStatus,
} from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { OnboardingStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Filter = "all" | OnboardingSubmission["service"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bookkeeping", label: "Bookkeeping" },
  { key: "corporate-tax", label: "Corporate Tax" },
  { key: "company-formation", label: "Company Formation" },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function OnboardingTable({
  submissions,
}: {
  submissions: OnboardingSubmission[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [payFilter, setPayFilter] = useState<"all" | PaymentStatus>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<OnboardingSubmission | null>(null);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: submissions.length };
    for (const s of submissions) c[s.service] = (c[s.service] ?? 0) + 1;
    return c;
  }, [submissions]);

  const payCounts = useMemo(() => {
    const c: Record<string, number> = { all: submissions.length, paid: 0, pending: 0 };
    for (const s of submissions) {
      if (s.payment_status === "paid") c.paid += 1;
      else if (s.payment_status === "pending") c.pending += 1;
    }
    return c;
  }, [submissions]);

  const filtered = submissions.filter((s) => {
    if (filter !== "all" && s.service !== filter) return false;
    if (payFilter !== "all" && s.payment_status !== payFilter) return false;
    const q = query.toLowerCase();
    return (
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.company ?? "").toLowerCase().includes(q)
    );
  });

  function handleStatus(id: string, status: OnboardingStatus) {
    startTransition(async () => {
      const res = await updateOnboardingStatus(id, status);
      if (res.error) toast.error(res.error);
      else toast.success("Status updated");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteOnboardingSubmission(id);
      if (res.error) toast.error(res.error);
      else toast.success("Submission deleted");
    });
  }

  function handleSendNotification() {
    if (!detail) return;
    const uid = detail.user_id;
    startTransition(async () => {
      const res = await sendNotification(uid, notifTitle, notifBody);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Notification sent — it'll appear on the client's dashboard.");
      setNotifTitle("");
      setNotifBody("");
    });
  }

  async function handleDownloadPdf(row: OnboardingSubmission) {
    try {
      const mod = await import("@/lib/application-pdf");   // lazy-load jsPDF only on click
      mod.downloadApplicationPDF(row);
    } catch {
      toast.error("Could not generate the application PDF.");
    }
  }

  function handleFilingStage(id: string, stage: number) {
    setDetail((prev) => (prev && prev.id === id ? { ...prev, filing_stage: stage } : prev));
    startTransition(async () => {
      const res = await updateFilingStage(id, stage);
      if (res.error) toast.error(res.error);
      else toast.success("Filing stage updated — the client's dashboard will reflect it.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Service filter */}
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          {/* Payment filter */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Payment</span>
            {(["all", "paid", "pending"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setPayFilter(k)}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium capitalize transition-colors ${
                  payFilter === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {k}
                <span className="ml-1.5 opacity-70">{payCounts[k] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search submissions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Contact</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="hidden lg:table-cell">Company</TableHead>
              <TableHead className="hidden sm:table-cell">Plan</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Submitted</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No onboarding submissions yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.email ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {ONBOARDING_SERVICE_LABELS[s.service]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {s.company ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    {s.plan ? titleCase(s.plan) : "—"}
                  </TableCell>
                  <TableCell>
                    {s.service === "company-formation" && s.payment_status ? (
                      <div className="flex items-center gap-2">
                        <PaymentStatusBadge status={s.payment_status} />
                        {typeof s.amount_total === "number" ? (
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(s.amount_total)}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={s.status}
                      onValueChange={(v) => handleStatus(s.id, v as OnboardingStatus)}
                    >
                      <SelectTrigger className="h-8 w-[130px] border-none bg-transparent p-0 shadow-none focus:ring-0">
                        <SelectValue>
                          <OnboardingStatusBadge status={s.status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ONBOARDING_STATUSES.map((st) => (
                          <SelectItem key={st} value={st} className="capitalize">
                            {titleCase(st)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(s.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="size-8" />}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setDetail(s);
                            setNotifTitle("");
                            setNotifBody("");
                          }}
                        >
                          <Eye className="size-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail ? ONBOARDING_SERVICE_LABELS[detail.service] : ""} submission
            </DialogTitle>
            <DialogDescription>
              {detail?.name ?? "—"}
              {detail?.email ? ` · ${detail.email}` : ""}
              {detail ? ` · ${formatDate(detail.created_at)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && detail.service === "company-formation" && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => handleDownloadPdf(detail)}
            >
              <Download className="size-4" />
              Download application (PDF)
            </Button>
          )}
          {detail && detail.service === "company-formation" && detail.payment_status && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <PaymentStatusBadge status={detail.payment_status} />
                {typeof detail.amount_total === "number" ? (
                  <span className="text-sm font-semibold">
                    {formatCurrency(detail.amount_total)}
                  </span>
                ) : null}
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                {detail.paid_at ? (
                  <>
                    <dt className="text-muted-foreground">Paid on</dt>
                    <dd className="font-medium">{formatDateTime(detail.paid_at)}</dd>
                  </>
                ) : null}
                {detail.order_ref ? (
                  <>
                    <dt className="text-muted-foreground">Order ref</dt>
                    <dd className="truncate font-mono">{detail.order_ref}</dd>
                  </>
                ) : null}
                {detail.stripe_subscription_id ? (
                  <>
                    <dt className="text-muted-foreground">Subscription</dt>
                    <dd className="truncate font-mono">{detail.stripe_subscription_id}</dd>
                  </>
                ) : null}
                {detail.stripe_session_id ? (
                  <>
                    <dt className="text-muted-foreground">Session</dt>
                    <dd className="truncate font-mono">{detail.stripe_session_id}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          )}
          {detail && detail.service === "company-formation" && (
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Filing progress</span>
                <span className="text-xs text-muted-foreground">
                  Shown live on the client&apos;s dashboard
                </span>
              </div>
              <Select
                value={String(detail.filing_stage ?? 0)}
                onValueChange={(v) => handleFilingStage(detail.id, Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILING_STAGES.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {i}. {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {detail && (
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <BellRing className="size-4 text-muted-foreground" />
                Send a notification
              </div>
              {detail.user_id ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Title (e.g. Your EIN is ready)"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                  />
                  <textarea
                    placeholder="Message (optional)"
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSendNotification}
                      disabled={isPending || !notifTitle.trim()}
                    >
                      <Send className="size-4" />
                      Send to client
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  This submission isn&apos;t linked to a signed-in account yet, so there&apos;s nobody to notify.
                </p>
              )}
            </div>
          )}
          {detail && (
            <dl className="divide-y rounded-lg border">
              {Object.entries(detail.details).length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No extra details were captured for this submission.
                </p>
              ) : (
                Object.entries(detail.details).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-3 px-4 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{titleCase(key)}</dt>
                    <dd className="col-span-2 break-words font-medium">
                      {formatValue(value)}
                    </dd>
                  </div>
                ))
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
