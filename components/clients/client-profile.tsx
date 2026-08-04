"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  KeyRound,
  Lock,
  Plus,
  Send,
  ShieldOff,
  Trash2,
  Upload,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignClientOwner,
  deleteClientDocument,
  deleteClientRecord,
  getDocumentUrl,
  inviteClientToPortal,
  revokeClientPortal,
  updateClientRecord,
  updateClientStatus,
  uploadClientDocument,
} from "@/app/(admin)/clients/actions";
import { createInvoice, sendInvoiceByEmail } from "@/app/(admin)/invoices/actions";
import {
  CLIENT_STATUSES,
  ONBOARDING_SERVICES,
  ONBOARDING_SERVICE_LABELS,
  stageLabelsForService,
  type Client,
  type ClientDocument,
  type ClientEngagement,
  type ClientProfileHints,
  type ClientStatus,
  type Expert,
  type Invoice,
  type InvoiceStatus,
  type PortalStatus,
} from "@/lib/types";
import {
  PORTAL_STATUS_LABELS,
  PORTAL_STATUS_STYLES,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientStatusBadge, InvoiceStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PLANS = ["starter", "growth", "enterprise"];
const NO_SERVICE = "none";
const UNASSIGNED = "__unassigned__";

/**
 * Invoice status is fully automatic: sent (on ✈️), paid (Stripe webhook), and
 * overdue derived here — any unpaid invoice past its due date reads as overdue,
 * no cron or manual change needed.
 */
function effectiveInvoiceStatus(inv: Invoice): InvoiceStatus {
  if (inv.status === "sent" && inv.due_at) {
    const due = new Date(`${inv.due_at}T23:59:59`).getTime();
    if (!Number.isNaN(due) && due < Date.now()) return "overdue";
  }
  return inv.status;
}

function PortalBadge({ status }: { status: PortalStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PORTAL_STATUS_STYLES[status])}>
      {PORTAL_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * A write-once client detail (EIN, banking, …). Blank → a normal input. Once a
 * value has been saved it renders as locked read-only text and posts nothing;
 * the server drops changes to a set field too, so this can't be worked around
 * from a stale tab.
 */
function LockedField({
  id,
  label,
  value,
  suggestion,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string | null | undefined;
  /** What the client put on their own onboarding form, if anything. */
  suggestion?: string | null;
  placeholder?: string;
  className?: string;
}) {
  const saved = (value ?? "").trim();
  const suggested = (suggestion ?? "").trim();
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={saved ? undefined : id} className={cn(saved && "text-muted-foreground")}>
        {label}
      </Label>
      {saved ? (
        <div
          className="flex h-8 items-center gap-2 rounded-lg border border-dashed bg-muted/60 px-2.5 py-1 text-base md:text-sm"
          title="Locked — this can't be changed once saved"
        >
          <Lock className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{saved}</span>
        </div>
      ) : (
        <>
          {/* Prefilled from their application but NOT stored yet — these fields
              lock on write, so a human confirms the value by saving. */}
          <Input
            id={id}
            name={id}
            autoComplete="off"
            placeholder={placeholder}
            defaultValue={suggested}
          />
          {suggested && (
            <p className="text-xs text-muted-foreground">
              From their application — check it, then save to lock it in.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function formatBytes(size: number | null | undefined): string {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientProfile({
  client,
  engagements,
  hints = {},
  documents,
  invoices,
  experts = [],
}: {
  client: Client;
  /** Every service this client has, newest first. */
  engagements: ClientEngagement[];
  /** Values from their onboarding forms, offered as prefill. */
  hints?: ClientProfileHints;
  documents: ClientDocument[];
  invoices: Invoice[];
  experts?: Expert[];
}) {
  const [isPending, startTransition] = useTransition();
  const [ownerValue, setOwnerValue] = useState<string>(client.owner || UNASSIGNED);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const portal = (client.portal_status ?? "none") as PortalStatus;
  const invited = portal !== "none";

  const managers = Array.from(
    new Set([
      ...experts.map((e) => e.name).filter(Boolean),
      ...(client.owner ? [client.owner] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  /** "2. Registered agent set up" for a service that tracks progress, else null. */
  function progressLabel(e: ClientEngagement): string | null {
    const labels = stageLabelsForService(e.service);
    if (!labels.length) return null;
    const i = Math.min(e.filing_stage ?? 0, labels.length - 1);
    return `${i}. ${labels[i]}`;
  }

  function handleStatusChange(next: string) {
    if (next === client.status) return;
    startTransition(async () => {
      const res = await updateClientStatus(client.id, next as ClientStatus);
      if (res.error) toast.error(res.error);
      else toast.success(`Status set to ${titleCase(next)}`);
    });
  }

  function handleAssign(owner: string) {
    startTransition(async () => {
      const res = await assignClientOwner(client.id, owner);
      if (res.error) toast.error(res.error);
      else toast.success(owner ? `Assigned to ${owner}` : "Unassigned");
    });
  }

  function handleInvite(resend: boolean) {
    startTransition(async () => {
      const res = await inviteClientToPortal(client.id);
      if (res.error) toast.error(res.error);
      else toast.success(resend ? "Set-password email re-sent" : "Invite sent");
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      const res = await revokeClientPortal(client.id);
      if (res.error) toast.error(res.error);
      else toast.success("Dashboard access revoked");
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteClientRecord(client.id);
      if (res.error) toast.error(res.error);
      else window.location.href = "/clients";
    });
  }

  function handleDownload(path: string) {
    startTransition(async () => {
      const res = await getDocumentUrl(path);
      if (res.error || !res.url) toast.error(res.error ?? "Couldn't open that document.");
      else window.open(res.url, "_blank", "noopener");
    });
  }

  function handleDeleteDoc(path: string, name: string) {
    if (!window.confirm(`Remove "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteClientDocument(client.id, path);
      if (res.error) toast.error(res.error);
      else toast.success("Document removed");
    });
  }

  function handleUpload(formData: FormData) {
    startTransition(async () => {
      const res = await uploadClientDocument(client.id, formData);
      if (res.error) toast.error(res.error);
      else toast.success("Document uploaded");
    });
  }

  function handleSaveProfile(formData: FormData) {
    startTransition(async () => {
      const res = await updateClientRecord(client.id, formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Client updated");
        if (res.warning) toast.warning(res.warning);
      }
    });
  }

  function handleRaiseInvoice(formData: FormData) {
    startTransition(async () => {
      const res = await createInvoice(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Invoice created");
        setRaiseOpen(false);
      }
    });
  }

  function handleSendInvoice(id: string) {
    startTransition(async () => {
      const res = await sendInvoiceByEmail(id);
      if (res.error) toast.error(res.error);
      else toast.success("Invoice emailed to client");
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <Link
          href="/clients"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to clients
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            {client.company && client.company !== client.name && (
              <p className="text-sm text-muted-foreground">{client.company}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {client.email ?? "No email"}
              {client.phone ? ` · ${client.phone}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ClientStatusBadge status={client.status} />
              <PortalBadge status={portal} />
              {client.owner && (
                <span className="text-xs text-muted-foreground">
                  Manager: <span className="font-medium text-foreground">{client.owner}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Inline status change */}
            <Select value={client.status} onValueChange={(v) => handleStatusChange(String(v))}>
              <SelectTrigger className="w-40" aria-label="Change status">
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

            {/* Assign manager */}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <UserCog className="size-4" />
                Assign
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {managers.length === 0 ? (
                  <DropdownMenuItem disabled>No team members yet</DropdownMenuItem>
                ) : (
                  managers.map((name) => (
                    <DropdownMenuItem
                      key={name}
                      onClick={() => handleAssign(name)}
                      className={cn(client.owner === name && "font-semibold")}
                    >
                      {name}
                      {client.owner === name && (
                        <span className="ml-auto text-xs text-muted-foreground">current</span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
                {client.owner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleAssign("")}
                      className="text-destructive focus:text-destructive"
                    >
                      Unassign
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Portal access */}
            {!invited ? (
              <Button variant="outline" onClick={() => handleInvite(false)} disabled={!client.email || isPending}>
                <Send className="size-4" />
                Invite to dashboard
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleInvite(true)} disabled={isPending}>
                  <KeyRound className="size-4" />
                  Resend invite
                </Button>
                <Button variant="outline" onClick={handleRevoke} disabled={isPending}>
                  <ShieldOff className="size-4" />
                  Revoke
                </Button>
              </>
            )}

            <Button variant="outline" onClick={handleDelete} disabled={isPending} className="text-destructive">
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        {/* Scrolls horizontally on small screens instead of overflowing the page. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
          </TabsList>
        </div>

        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className={cn(engagements.length > 1 && "sm:col-span-2")}>
              <CardHeader>
                <CardTitle className="text-sm">
                  Services{engagements.length > 1 ? ` (${engagements.length})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {engagements.length === 0 ? (
                  <p className="text-muted-foreground">No dashboard service yet.</p>
                ) : (
                  engagements.map((e, i) => (
                    <div
                      key={e.id}
                      className={cn("space-y-2", i > 0 && "border-t pt-3")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{ONBOARDING_SERVICE_LABELS[e.service]}</span>
                        {e.created_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(e.created_at)}
                          </span>
                        )}
                      </div>
                      {progressLabel(e) && <Row k="Progress" v={progressLabel(e) as string} />}
                      <Row k="Payment" v={titleCase(e.payment_status ?? "pending")} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Billing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row k="Plan" v={client.plan ? titleCase(client.plan) : "—"} />
                <Row k="MRR" v={formatCurrency(client.mrr)} />
                <Row k="Invoices" v={String(invoices.length)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row k="Manager" v={client.owner ?? "Unassigned"} />
                <Row k="Dashboard" v={PORTAL_STATUS_LABELS[portal]} />
                <Row k="Client since" v={formatDate(client.created_at)} />
              </CardContent>
            </Card>
          </div>
          {client.notes && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                {client.notes}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Profile (inline edit) */}
        <TabsContent value="profile" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <form action={handleSaveProfile}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" name="name" defaultValue={client.name} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    {/* Falls back to the number on their application when we have
                        none on file. Editable and not saved until you submit. */}
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={client.phone ?? hints.phone ?? ""}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" name="company" defaultValue={client.company ?? ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={client.status}>
                      <SelectTrigger id="status">
                        <SelectValue>{(v: unknown) => titleCase(String(v ?? ""))}</SelectValue>
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
                    <Select name="plan" defaultValue={client.plan ?? "starter"}>
                      <SelectTrigger id="plan">
                        <SelectValue>{(v: unknown) => titleCase(String(v ?? ""))}</SelectValue>
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
                    <Input id="mrr" name="mrr" type="number" min="0" step="50" defaultValue={client.mrr} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="owner">Account manager</Label>
                    <input type="hidden" name="owner" value={ownerValue === UNASSIGNED ? "" : ownerValue} />
                    <Select value={ownerValue} onValueChange={(v) => setOwnerValue(String(v))}>
                      <SelectTrigger id="owner">
                        {/* SelectValue renders the raw value, which would print
                            the UNASSIGNED sentinel at the user. */}
                        <SelectValue>
                          {(v: unknown) => (v === UNASSIGNED ? "Unassigned" : String(v ?? ""))}
                        </SelectValue>
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

                  {/* Optional + write-once: blank fields accept a value, saved ones lock. */}
                  <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold">Business &amp; tax details</h4>
                      <Lock className="size-3.5 text-muted-foreground" />
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      All optional — but once saved, a value is locked and can&apos;t be edited here.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <LockedField
                        id="contact_person"
                        label="Contact person"
                        value={client.contact_person}
                        suggestion={hints.contact_person}
                        placeholder="Full name"
                      />
                      <LockedField
                        id="ein"
                        label="EIN"
                        value={client.ein}
                        suggestion={hints.ein}
                        placeholder="12-3456789"
                      />
                      <LockedField
                        id="state_withholding_id"
                        label="State withholding"
                        value={client.state_withholding_id}
                        placeholder="Account number"
                      />
                      <LockedField
                        id="state_unemployment_id"
                        label="State unemployment tax"
                        value={client.state_unemployment_id}
                        placeholder="Account number"
                      />
                      <LockedField
                        id="eft_pin"
                        label="EFT PIN"
                        value={client.eft_pin}
                        className="sm:col-span-2"
                      />
                      <LockedField
                        id="billing_address"
                        label="Billing address"
                        value={client.billing_address}
                        placeholder="Street, city, state, ZIP"
                        className="sm:col-span-2"
                      />
                      <LockedField
                        id="business_address"
                        label="Business physical address"
                        value={client.business_address}
                        suggestion={hints.business_address}
                        placeholder="Street, city, state, ZIP"
                        className="sm:col-span-2"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold">Banking</h4>
                      <Lock className="size-3.5 text-muted-foreground" />
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      All optional — but once saved, a value is locked and can&apos;t be edited here.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <LockedField id="bank_name" label="Bank name" value={client.bank_name} />
                      <LockedField
                        id="bank_account_number"
                        label="Account number"
                        value={client.bank_account_number}
                      />
                      <LockedField
                        id="bank_routing_number"
                        label="Routing number"
                        value={client.bank_routing_number}
                        placeholder="9 digits"
                      />
                    </div>
                  </div>

                  {/* One block per service the client holds — including requests they
                      raised themselves from their dashboard after signing up. */}
                  <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-sm font-semibold">
                      Services{engagements.length ? ` (${engagements.length})` : ""}
                    </h4>
                    <p className="mb-3 text-xs text-muted-foreground">
                      What this client sees on their dashboard. Moving a service forward
                      notifies them.
                    </p>

                    {engagements.length === 0 ? (
                      <p className="rounded-lg border border-dashed bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">
                        No service yet — add one below to give this client a dashboard.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {engagements.map((e) => {
                          const labels = stageLabelsForService(e.service);
                          const progressTitle =
                            e.service === "tax-account" ? "Registration progress" : "Formation progress";
                          return (
                            <div key={e.id} className="rounded-lg border bg-background/60 p-3">
                              <input type="hidden" name="engagement_id" value={e.id} />
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">
                                  {ONBOARDING_SERVICE_LABELS[e.service]}
                                </span>
                                {e.created_at && (
                                  <span className="text-xs text-muted-foreground">
                                    raised {formatDate(e.created_at)}
                                  </span>
                                )}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-2">
                                  <Label htmlFor={`payment_${e.id}`}>Payment</Label>
                                  <Select
                                    name={`payment_${e.id}`}
                                    defaultValue={e.payment_status ?? "pending"}
                                  >
                                    <SelectTrigger id={`payment_${e.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="paid">Paid</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {labels.length > 0 && (
                                  <div className="grid gap-2">
                                    <Label htmlFor={`stage_${e.id}`}>{progressTitle}</Label>
                                    <Select
                                      name={`stage_${e.id}`}
                                      defaultValue={String(e.filing_stage ?? 0)}
                                    >
                                      <SelectTrigger id={`stage_${e.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {labels.map((label, i) => (
                                          <SelectItem key={i} value={String(i)}>
                                            {i}. {label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-3 grid gap-2">
                      <Label htmlFor="add_service">Add a service</Label>
                      <Select name="add_service" defaultValue={NO_SERVICE}>
                        <SelectTrigger id="add_service">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_SERVICE}>— Don&apos;t add one —</SelectItem>
                          {ONBOARDING_SERVICES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {ONBOARDING_SERVICE_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Starts at stage 0 / unpaid — set its progress after saving.
                      </p>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <Label htmlFor="password">
                        Login password {client.user_id ? "(type a new one to reset)" : "(optional)"}
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="text"
                        autoComplete="off"
                        placeholder={client.user_id ? "Leave blank to keep current" : "Min. 6 characters"}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="pt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <form action={handleUpload} className="flex flex-wrap items-end gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="file">Upload a document</Label>
                  <Input id="file" name="file" type="file" required className="w-full sm:w-72" />
                </div>
                <Button type="submit" disabled={isPending}>
                  <Upload className="size-4" />
                  Upload
                </Button>
              </form>

              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                <div className="grid gap-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.path}
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{doc.name}</span>
                      {doc.size ? (
                        <span className="text-xs text-muted-foreground">{formatBytes(doc.size)}</span>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleDownload(doc.path)}
                        disabled={isPending}
                        aria-label="Download"
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => handleDeleteDoc(doc.path, doc.name)}
                        disabled={isPending}
                        aria-label="Remove"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="pt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-end">
                <Button onClick={() => setRaiseOpen(true)}>
                  <Plus className="size-4" />
                  Raise invoice
                </Button>
              </div>
              {invoices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Number</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden sm:table-cell">Due</TableHead>
                        <TableHead className="w-40 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.number ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(inv.amount)}
                          </TableCell>
                          <TableCell>
                            <InvoiceStatusBadge status={effectiveInvoiceStatus(inv)} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {inv.due_at ? formatDate(inv.due_at) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end">
                              {inv.status !== "paid" && inv.status !== "void" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => handleSendInvoice(inv.id)}
                                  disabled={isPending || !client.email}
                                  aria-label={inv.status === "sent" ? "Resend invoice" : "Send invoice"}
                                  title={inv.status === "sent" ? "Resend invoice email" : "Email invoice to pay"}
                                >
                                  <Send className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Raise invoice dialog */}
      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="sm:max-w-lg">
          <form action={handleRaiseInvoice}>
            <DialogHeader>
              <DialogTitle>Raise invoice</DialogTitle>
              <DialogDescription>
                Create an invoice for {client.name}, then use Send (✈️) on the row to
                email a payable link. Status updates on its own — sent, overdue, and paid.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <input type="hidden" name="client_name" value={client.name} />
              <input type="hidden" name="client_email" value={client.email ?? ""} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="number">Invoice number</Label>
                  <Input id="number" name="number" placeholder="INV-001" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (USD) *</Label>
                  <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due_at">Due date</Label>
                  <Input id="due_at" name="due_at" type="date" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" placeholder="Optional" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
