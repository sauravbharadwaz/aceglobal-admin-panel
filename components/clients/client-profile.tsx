"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Download,
  FileText,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ShieldOff,
  Trash2,
  Upload,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignClientOwner,
  createClientDeadline,
  deleteClientDeadline,
  deleteClientDocument,
  deleteClientRecord,
  getDocumentUrl,
  inviteClientToPortal,
  revokeClientPortal,
  setClientDeadlineDone,
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
  type ClientDeadline,
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
  DEADLINE_STATE_STYLES,
  PORTAL_STATUS_LABELS,
  PORTAL_STATUS_STYLES,
  deadlineLabel,
  deadlineState,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientStatusBadge, InvoiceStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
function DetailField({
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
      <Label htmlFor={id}>{label}</Label>
      {/* An ordinary input like every other field on this form. The enclosing
          fieldset disables it until Edit is pressed, so the Edit toggle is the
          single gate on the whole record — these details used to be write-once
          and stayed read-only text for good, which meant a typo in an EIN could
          never be corrected here. */}
      <Input
        id={id}
        name={id}
        autoComplete="off"
        placeholder={placeholder}
        defaultValue={saved || suggested}
      />
      {!saved && suggested && (
        <p className="text-xs text-muted-foreground">
          From their application — check it, then save.
        </p>
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
  deadlines = [],
}: {
  client: Client;
  /** Every service this client has, newest first. */
  engagements: ClientEngagement[];
  /** Values from their onboarding forms, offered as prefill. */
  hints?: ClientProfileHints;
  documents: ClientDocument[];
  invoices: Invoice[];
  experts?: Expert[];
  /** Due dates we've set for this client, soonest first. */
  deadlines?: ClientDeadline[];
}) {
  const [isPending, startTransition] = useTransition();
  const [ownerValue, setOwnerValue] = useState<string>(client.owner || UNASSIGNED);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  /* The profile is a record, not a form: it reads as one until someone deliberately
     chooses to edit. Stops a stray click or a mistyped character in a field nobody
     meant to touch from being saved over a client's filing details. */
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("overview");

  /** Enter edit mode from the header, wherever the reader happens to be. */
  function startEditing() {
    setTab("profile");
    setEditing(true);
  }
  /** Drop every unsaved change by remounting the form with the stored values. */
  function cancelEditing() {
    setOwnerValue(client.owner || UNASSIGNED);
    setEditing(false);
  }

  const portal = (client.portal_status ?? "none") as PortalStatus;
  const invited = portal !== "none";

  const managers = Array.from(
    new Set([
      ...experts.map((e) => e.name).filter(Boolean),
      ...(client.owner ? [client.owner] : []),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const openDeadlines = deadlines.filter((d) => d.status !== "done");
  // Arrives sorted by due_on; this only sinks the finished ones to the bottom.
  const sortedDeadlines = [...deadlines].sort(
    (a, b) => Number(a.status === "done") - Number(b.status === "done"),
  );

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

  /** jsPDF is heavy, so the builder is only pulled in on click. */
  async function handleDownloadApplication(engagement: ClientEngagement) {
    if (!engagement.row) {
      toast.error("This request has no stored application.");
      return;
    }
    try {
      const mod = await import("@/lib/application-pdf");
      mod.downloadSubmissionPDF(engagement.row);
    } catch {
      toast.error("Could not generate the application PDF.");
    }
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
        setEditing(false);   // saved — back to the locked record view
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

  function handleAddDeadline(formData: FormData) {
    startTransition(async () => {
      const res = await createClientDeadline(client.id, formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Due date added");
        setDueOpen(false);
      }
    });
  }

  function handleToggleDeadline(id: string, done: boolean) {
    startTransition(async () => {
      const res = await setClientDeadlineDone(client.id, id, done);
      if (res.error) toast.error(res.error);
      else toast.success(done ? "Marked done" : "Reopened");
    });
  }

  function handleDeleteDeadline(id: string, title: string) {
    if (!window.confirm(`Remove "${title}"?`)) return;
    startTransition(async () => {
      const res = await deleteClientDeadline(client.id, id);
      if (res.error) toast.error(res.error);
      else toast.success("Due date removed");
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
            {/* Inline status change. Locked with the rest of the record — it writes the
                same field the profile form shows, so leaving it live would make "locked"
                a half-truth. */}
            <Select
              value={client.status}
              onValueChange={(v) => handleStatusChange(String(v))}
              disabled={!editing || isPending}
            >
              <SelectTrigger
                className="w-40"
                aria-label="Change status"
                title={editing ? undefined : "Locked — choose Edit to change"}
              >
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

            {editing ? (
              <Button variant="outline" onClick={cancelEditing} disabled={isPending}>
                <X className="size-4" />
                Cancel editing
              </Button>
            ) : (
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="size-4" />
                Edit
              </Button>
            )}

            <Button variant="outline" onClick={handleDelete} disabled={isPending} className="text-destructive">
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        {/* Scrolls horizontally on small screens instead of overflowing the page. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            {/* Applications count too — they're downloadable documents here. */}
            <TabsTrigger value="documents">
              Documents ({documents.length + engagements.length})
            </TabsTrigger>
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
          {/* Due dates — what the client sees on their own dashboard. Open ones
              first, soonest at the top; ticked-off ones sink to the bottom. */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">
                Due dates{openDeadlines.length ? ` (${openDeadlines.length} open)` : ""}
              </CardTitle>
              {/* CardHeader is a grid — this slot puts the button on the right. */}
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => setDueOpen(true)}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {sortedDeadlines.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No due dates yet — add one and it appears on the client&apos;s dashboard.
                </p>
              ) : (
                <div className="grid gap-2">
                  {sortedDeadlines.map((d) => {
                    const state = deadlineState(d);
                    const done = state === "done";
                    return (
                      <div
                        key={d.id}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                          done && "opacity-60",
                        )}
                      >
                        <CalendarClock
                          className={cn(
                            "size-4 shrink-0",
                            state === "overdue" ? "text-rose-600" : "text-muted-foreground",
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <span className={cn("block truncate", done && "line-through")}>
                            {d.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(d.due_on)}
                            {d.notes ? ` · ${d.notes}` : ""}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("font-medium", DEADLINE_STATE_STYLES[state])}
                        >
                          {deadlineLabel(d)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleToggleDeadline(d.id, !done)}
                          disabled={isPending}
                          aria-label={done ? "Reopen" : "Mark done"}
                          title={done ? "Reopen" : "Mark done"}
                        >
                          {done ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => handleDeleteDeadline(d.id, d.title)}
                          disabled={isPending}
                          aria-label="Remove"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

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
              {/* `key` remounts the form when edit mode flips, so Cancel restores every
                  defaultValue rather than leaving typed-but-unsaved text on screen. */}
              <form action={handleSaveProfile} key={editing ? "edit" : "view"}>
                {!editing && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5 shrink-0" />
                    <span>
                      These details are locked. Choose <span className="font-medium">Edit</span> above to change them.
                    </span>
                  </div>
                )}
                {/* A disabled fieldset disables every control inside it, so nothing here
                    is editable — or submittable — until Edit is pressed. */}
                <fieldset disabled={!editing} className="min-w-0">
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

                  <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold">Business &amp; tax details</h4>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      All optional. These go on the client&apos;s filings — check them against
                      their paperwork before saving.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DetailField
                        id="contact_person"
                        label="Contact person"
                        value={client.contact_person}
                        suggestion={hints.contact_person}
                        placeholder="Full name"
                      />
                      <DetailField
                        id="ein"
                        label="EIN"
                        value={client.ein}
                        suggestion={hints.ein}
                        placeholder="12-3456789"
                      />
                      <DetailField
                        id="state_withholding_id"
                        label="State withholding"
                        value={client.state_withholding_id}
                        placeholder="Account number"
                      />
                      <DetailField
                        id="state_unemployment_id"
                        label="State unemployment tax"
                        value={client.state_unemployment_id}
                        placeholder="Account number"
                      />
                      <DetailField
                        id="eft_pin"
                        label="EFT PIN"
                        value={client.eft_pin}
                        className="sm:col-span-2"
                      />
                      <DetailField
                        id="billing_address"
                        label="Billing address"
                        value={client.billing_address}
                        placeholder="Street, city, state, ZIP"
                        className="sm:col-span-2"
                      />
                      <DetailField
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
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">
                      All optional. Used for payouts and direct debits — double-check any
                      change before saving.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <DetailField id="bank_name" label="Bank name" value={client.bank_name} />
                      <DetailField
                        id="bank_account_number"
                        label="Account number"
                        value={client.bank_account_number}
                      />
                      <DetailField
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
                </fieldset>
                {editing && (
                  <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={cancelEditing} disabled={isPending}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                )}
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

              {/* What the client filled in on each onboarding form. Not an
                  uploaded file — generated on demand from the stored answers,
                  the same document the client can download themselves. */}
              {engagements.length > 0 && (
                <div className="grid gap-2">
                  {engagements.map((e) => (
                    <div
                      key={`app-${e.id}`}
                      className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">
                          {ONBOARDING_SERVICE_LABELS[e.service]} application
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Their submitted answers
                          {e.created_at ? ` · ${formatDate(e.created_at)}` : ""}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleDownloadApplication(e)}
                        disabled={isPending || !e.row}
                        aria-label={`Download ${ONBOARDING_SERVICE_LABELS[e.service]} application`}
                        title="Download as PDF"
                      >
                        <Download className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {documents.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {engagements.length
                    ? "No uploaded files yet — the applications above are generated from their answers."
                    : "No documents yet."}
                </p>
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

      {/* Add due date dialog */}
      <Dialog open={dueOpen} onOpenChange={setDueOpen}>
        <DialogContent className="sm:max-w-lg">
          <form action={handleAddDeadline}>
            <DialogHeader>
              <DialogTitle>Add a due date</DialogTitle>
              <DialogDescription>
                {client.name} sees this on their dashboard, and gets a reminder email as
                it approaches.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="due_title">What&apos;s due *</Label>
                <Input
                  id="due_title"
                  name="title"
                  required
                  placeholder="Form 1120 — federal return"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="due_on">Due date *</Label>
                  <Input id="due_on" name="due_on" type="date" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due_service">Service</Label>
                  <Select name="service" defaultValue={NO_SERVICE}>
                    <SelectTrigger id="due_service">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SERVICE}>— None —</SelectItem>
                      {ONBOARDING_SERVICES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ONBOARDING_SERVICE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due_notes">Note</Label>
                <Input
                  id="due_notes"
                  name="notes"
                  placeholder="Optional — the client sees this too"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding…" : "Add due date"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
