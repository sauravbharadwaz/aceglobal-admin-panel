"use client";

import { useState, useTransition } from "react";
import {
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createClientRecord,
  deleteClientRecord,
  inviteClientToPortal,
  revokeClientPortal,
  updateClientRecord,
} from "@/app/(admin)/clients/actions";
import {
  CLIENT_STATUSES,
  ONBOARDING_SERVICES,
  ONBOARDING_SERVICE_LABELS,
  stageLabelsForService,
  type Client,
  type ClientEngagement,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}: {
  clients: Client[];
  engagements: Record<string, ClientEngagement>;
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  // Tracks the chosen service so the progress field can show the right steps.
  const [serviceValue, setServiceValue] = useState<string>(NO_SERVICE);
  const [isPending, startTransition] = useTransition();

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
    setEditing(null);
    setServiceValue(NO_SERVICE);
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setServiceValue(engagements[client.id]?.service ?? NO_SERVICE);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = editing
        ? await updateClientRecord(editing.id, formData)
        : await createClientRecord(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(editing ? "Client updated" : "Client added");
        setDialogOpen(false);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    startTransition(async () => {
      const res = await deleteClientRecord(id);
      if (res.error) toast.error(res.error);
      else toast.success(`Deleted ${name}`);
    });
  }

  function handleInvite(client: Client, resend: boolean) {
    startTransition(async () => {
      const res = await inviteClientToPortal(client.id);
      if (res.error) toast.error(res.error);
      else
        toast.success(
          resend
            ? `Set-password email re-sent to ${client.email}`
            : `Invite sent to ${client.email}`,
        );
    });
  }

  function handleRevoke(client: Client) {
    startTransition(async () => {
      const res = await revokeClientPortal(client.id);
      if (res.error) toast.error(res.error);
      else toast.success(`Dashboard access revoked for ${client.name}`);
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
              <TableHead className="hidden sm:table-cell">Plan</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead className="hidden md:table-cell">Dashboard</TableHead>
              <TableHead className="hidden xl:table-cell">Since</TableHead>
              <TableHead className="w-10" />
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
                const invited = portal !== "none";
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-medium">{client.name}</div>
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="size-8" />}
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(client)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          {!invited ? (
                            <DropdownMenuItem
                              onClick={() => handleInvite(client, false)}
                              disabled={!client.email}
                            >
                              <Send className="size-4" />
                              Invite to dashboard
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => handleInvite(client, true)}>
                                <KeyRound className="size-4" />
                                Resend set-password email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRevoke(client)}>
                                <ShieldOff className="size-4" />
                                Revoke access
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(client.id, client.name)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          {/* key forces the uncontrolled form to reset between create/edit */}
          <form action={handleSubmit} key={editing?.id ?? "new"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update this client's details and what they see on their dashboard."
                  : "Create a client, then invite them to their dashboard."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" defaultValue={editing?.company ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editing?.status ?? "active"}>
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
                <Select name="plan" defaultValue={editing?.plan ?? "starter"}>
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
                <Input
                  id="mrr"
                  name="mrr"
                  type="number"
                  min="0"
                  step="50"
                  defaultValue={editing?.mrr ?? 0}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="owner">Account manager</Label>
                <Input id="owner" name="owner" defaultValue={editing?.owner ?? ""} />
              </div>

              {/* ── Client dashboard (portal) ─────────────────────────────── */}
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
                      defaultValue={editing ? engagements[editing.id]?.service ?? NO_SERVICE : NO_SERVICE}
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
                    <Select
                      name="payment_status"
                      defaultValue={
                        editing ? engagements[editing.id]?.payment_status ?? "pending" : "pending"
                      }
                    >
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
                        <Select
                          name="filing_stage"
                          defaultValue={String(
                            editing ? engagements[editing.id]?.filing_stage ?? 0 : 0,
                          )}
                        >
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
                  <Label htmlFor="password">
                    Login password {editing?.user_id ? "(type a new one to reset)" : "(optional)"}
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="text"
                    autoComplete="off"
                    placeholder={
                      editing?.user_id ? "Leave blank to keep current" : "Min. 6 characters"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Sets a password so they can sign in at{" "}
                    <span className="font-medium">app.aceglobal.ai/?mode=login</span>{" "}
                    with their email — no invite email needed. Share it with them directly.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save changes" : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
