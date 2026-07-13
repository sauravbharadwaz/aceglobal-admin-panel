"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  KeyRound,
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
import {
  createInvoice,
  sendInvoiceByEmail,
  updateInvoiceStatus,
} from "@/app/(admin)/invoices/actions";
import {
  CLIENT_STATUSES,
  ONBOARDING_SERVICES,
  ONBOARDING_SERVICE_LABELS,
  stageLabelsForService,
  type Client,
  type ClientDocument,
  type ClientEngagement,
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
const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "void"];

function PortalBadge({ status }: { status: PortalStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PORTAL_STATUS_STYLES[status])}>
      {PORTAL_STATUS_LABELS[status]}
    </Badge>
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
  engagement,
  documents,
  invoices,
  experts = [],
}: {
  client: Client;
  engagement: ClientEngagement | null;
  documents: ClientDocument[];
  invoices: Invoice[];
  experts?: Expert[];
}) {
  const [isPending, startTransition] = useTransition();
  const [serviceValue, setServiceValue] = useState<string>(engagement?.service ?? NO_SERVICE);
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

  const stageLabels = stageLabelsForService(engagement?.service);
  const stageLabel =
    engagement && stageLabels.length
      ? stageLabels[Math.min(engagement.filing_stage ?? 0, stageLabels.length - 1)]
      : null;

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
      else toast.success("Client updated");
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

  function handleInvoiceStatus(id: string, status: string) {
    startTransition(async () => {
      const res = await updateInvoiceStatus(id, status as InvoiceStatus);
      if (res.error) toast.error(res.error);
      else toast.success(`Invoice ${status}`);
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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Engagement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row k="Service" v={engagement ? ONBOARDING_SERVICE_LABELS[engagement.service] : "No dashboard"} />
                {stageLabel && <Row k="Progress" v={`${engagement?.filing_stage ?? 0}. ${stageLabel}`} />}
                {engagement && (
                  <Row k="Payment" v={titleCase(engagement.payment_status ?? "pending")} />
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
                    <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" name="company" defaultValue={client.company ?? ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={client.status}>
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
                    <Select name="plan" defaultValue={client.plan ?? "starter"}>
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
                    <Input id="mrr" name="mrr" type="number" min="0" step="50" defaultValue={client.mrr} />
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
                    <h4 className="mb-3 text-sm font-semibold">Client dashboard</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor="service">Service</Label>
                        <Select
                          name="service"
                          defaultValue={engagement?.service ?? NO_SERVICE}
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
                        <Select name="payment_status" defaultValue={engagement?.payment_status ?? "pending"}>
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
                        const labels = stageLabelsForService(serviceValue);
                        if (!labels.length) return null;
                        const title = serviceValue === "tax-account" ? "Registration progress" : "Formation progress";
                        return (
                          <div className="grid gap-2">
                            <Label htmlFor="filing_stage">{title}</Label>
                            <Select name="filing_stage" defaultValue={String(engagement?.filing_stage ?? 0)}>
                              <SelectTrigger id="filing_stage">
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
                        );
                      })()}
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
                  <Input id="file" name="file" type="file" required className="w-72" />
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
                            <InvoiceStatusBadge status={inv.status} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {inv.due_at ? formatDate(inv.due_at) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Select
                                value={inv.status}
                                onValueChange={(v) => handleInvoiceStatus(inv.id, String(v))}
                              >
                                <SelectTrigger className="h-8 w-28" aria-label="Invoice status">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INVOICE_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">
                                      {titleCase(s)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => handleSendInvoice(inv.id)}
                                disabled={isPending || !client.email}
                                aria-label="Email invoice"
                              >
                                <Send className="size-4" />
                              </Button>
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
              <DialogDescription>Create an invoice for {client.name}.</DialogDescription>
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
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue="draft">
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {titleCase(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
