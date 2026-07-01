"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteOnboardingSubmission,
  updateOnboardingStatus,
} from "@/app/(admin)/onboarding/actions";
import {
  ONBOARDING_SERVICE_LABELS,
  ONBOARDING_STATUSES,
  type OnboardingStatus,
  type OnboardingSubmission,
} from "@/lib/types";
import { formatDate, titleCase } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { OnboardingStatusBadge } from "@/components/status-badge";
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
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<OnboardingSubmission | null>(null);
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: submissions.length };
    for (const s of submissions) c[s.service] = (c[s.service] ?? 0) + 1;
    return c;
  }, [submissions]);

  const filtered = submissions.filter((s) => {
    if (filter !== "all" && s.service !== filter) return false;
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

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search submissions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
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
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Submitted</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
                        <DropdownMenuItem onClick={() => setDetail(s)}>
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
