"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createClientRecord } from "@/app/(admin)/clients/actions";
import {
  CLIENT_STATUSES,
  ONBOARDING_SERVICES,
  ONBOARDING_SERVICE_LABELS,
  stageLabelsForService,
  type Client,
  type ClientEngagement,
  type Expert,
  type PortalStatus,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  PORTAL_STATUS_LABELS,
  PORTAL_STATUS_STYLES,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PLANS = ["starter", "growth", "enterprise"];
const NO_SERVICE = "none";
// Sentinel for "no account manager" — Select can't use an empty-string value.
const UNASSIGNED = "__unassigned__";

function PortalBadge({ status }: { status: PortalStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PORTAL_STATUS_STYLES[status])}>
      {PORTAL_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ClientsTable({
  clients,
  engagements,
  experts = [],
}: {
  clients: Client[];
  engagements: Record<string, ClientEngagement>;
  /** Team members clients can be assigned to (account managers). */
  experts?: Expert[];
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceValue, setServiceValue] = useState<string>(NO_SERVICE);
  const [ownerValue, setOwnerValue] = useState<string>(UNASSIGNED);
  const [isPending, startTransition] = useTransition();

  const managers = Array.from(
    new Set([
      ...experts.map((e) => e.name).filter(Boolean),
      ...clients.map((c) => c.owner).filter((o): o is string => !!o),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const filtered = clients.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.owner ?? "").toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setServiceValue(NO_SERVICE);
    setOwnerValue(UNASSIGNED);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await createClientRecord(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Client added");
        setDialogOpen(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add client
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden lg:table-cell">Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Account manager</TableHead>
              <TableHead className="hidden sm:table-cell">Plan</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead className="hidden md:table-cell">Dashboard</TableHead>
              <TableHead className="hidden xl:table-cell">Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No clients found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((client) => {
                const portal = (client.portal_status ?? "none") as PortalStatus;
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium hover:underline"
                      >
                        {client.name}
                      </Link>
                      {client.company && client.company !== client.name && (
                        <div className="text-xs text-muted-foreground">{client.company}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      <div>{client.email ?? "—"}</div>
                      <div>{client.phone ?? ""}</div>
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {client.owner ? (
                        client.owner
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {client.plan ? titleCase(client.plan) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCurrency(client.mrr)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <PortalBadge status={portal} />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {formatDate(client.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92dvh] overflow-y-auto">
          <form action={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add client</DialogTitle>
              <DialogDescription>
                Create a client, then open their profile to manage everything.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue="active">
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {titleCase(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan">Plan</Label>
                <Select name="plan" defaultValue="starter">
                  <SelectTrigger id="plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {titleCase(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mrr">MRR (USD)</Label>
                <Input id="mrr" name="mrr" type="number" min="0" step="50" defaultValue={0} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="owner">Account manager</Label>
                <input type="hidden" name="owner" value={ownerValue === UNASSIGNED ? "" : ownerValue} />
                <Select value={ownerValue} onValueChange={(v) => setOwnerValue(String(v))}>
                  <SelectTrigger id="owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {managers.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold">Client dashboard</h4>
                  <p className="text-xs text-muted-foreground">
                    What this client sees when they log in. Pick a service to enable
                    their dashboard, then set a login password below (or invite by email).
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="service">Service</Label>
                    <Select
                      name="service"
                      defaultValue={NO_SERVICE}
                      onValueChange={(v) => setServiceValue(String(v))}
                    >
                      <SelectTrigger id="service">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SERVICE}>— No dashboard —</SelectItem>
                        {ONBOARDING_SERVICES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ONBOARDING_SERVICE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="payment_status">Payment</Label>
                    <Select name="payment_status" defaultValue="pending">
                      <SelectTrigger id="payment_status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(() => {
                    const stageLabels = stageLabelsForService(serviceValue);
                    if (!stageLabels.length) return null;
                    const title =
                      serviceValue === "tax-account" ? "Registration progress" : "Formation progress";
                    return (
                      <div className="grid gap-2">
                        <Label htmlFor="filing_stage">{title}</Label>
                        <Select name="filing_stage" defaultValue="0">
                          <SelectTrigger id="filing_stage">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {stageLabels.map((label, i) => (
                              <SelectItem key={i} value={String(i)}>
                                {i}. {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-3 grid gap-2">
                  <Label htmlFor="password">Login password (optional)</Label>
                  <Input
                    id="password"
                    name="password"
                    type="text"
                    autoComplete="off"
                    placeholder="Min. 6 characters"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sets a password so they can sign in at{" "}
                    <span className="font-medium">app.aceglobal.ai/?mode=login</span>{" "}
                    with their email — no invite email needed.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
