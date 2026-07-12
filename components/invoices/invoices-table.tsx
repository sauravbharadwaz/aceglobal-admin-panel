"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createInvoice,
  deleteInvoice,
  updateInvoice,
  updateInvoiceStatus,
} from "@/app/(admin)/invoices/actions";
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from "@/lib/types";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import { InvoiceStatusBadge } from "@/components/status-badge";
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

export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = invoices.filter((i) => {
    const q = query.toLowerCase();
    return (
      i.client_name.toLowerCase().includes(q) ||
      (i.number ?? "").toLowerCase().includes(q)
    );
  });

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(invoice: Invoice) {
    setEditing(invoice);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = editing
        ? await updateInvoice(editing.id, formData)
        : await createInvoice(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success(editing ? "Invoice updated" : "Invoice created");
        setDialogOpen(false);
      }
    });
  }

  function handleStatus(id: string, status: InvoiceStatus) {
    startTransition(async () => {
      const res = await updateInvoiceStatus(id, status);
      if (res.error) toast.error(res.error);
      else toast.success("Invoice status updated");
    });
  }

  function handleDelete(id: string, name: string) {
    startTransition(async () => {
      const res = await deleteInvoice(id);
      if (res.error) toast.error(res.error);
      else toast.success(`Deleted invoice for ${name}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-lg border bg-card px-3 py-2 text-sm sm:block">
            <span className="text-muted-foreground">Outstanding · </span>
            <span className="font-semibold">{formatCurrency(totalOutstanding)}</span>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New invoice
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden sm:table-cell">Number</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Due</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No invoices yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {inv.client_name}
                      {inv.stripe_session_id && (
                        <span className="rounded bg-[#635bff]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#635bff]">
                          Stripe
                        </span>
                      )}
                    </div>
                    {inv.client_email && (
                      <div className="text-xs font-normal text-muted-foreground">
                        {inv.client_email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {inv.number ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(inv.amount)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={inv.status}
                      onValueChange={(v) => handleStatus(inv.id, v as InvoiceStatus)}
                    >
                      <SelectTrigger className="h-8 w-[120px] border-none bg-transparent p-0 shadow-none focus:ring-0">
                        <SelectValue>
                          <InvoiceStatusBadge status={inv.status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {INVOICE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {titleCase(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {inv.due_at ? formatDate(inv.due_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="size-8" />}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(inv)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(inv.id, inv.client_name)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form action={handleSubmit} key={editing?.id ?? "new"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update this invoice." : "Create an invoice for a client."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="client_name">Client *</Label>
                <Input
                  id="client_name"
                  name="client_name"
                  defaultValue={editing?.client_name ?? ""}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="number">Invoice #</Label>
                  <Input
                    id="number"
                    name="number"
                    placeholder="INV-1042"
                    defaultValue={editing?.number ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editing?.amount ?? 0}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={editing?.status ?? "draft"}>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="issued_at">Issued</Label>
                  <Input
                    id="issued_at"
                    name="issued_at"
                    type="date"
                    defaultValue={editing?.issued_at ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due_at">Due</Label>
                  <Input
                    id="due_at"
                    name="due_at"
                    type="date"
                    defaultValue={editing?.due_at ?? ""}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save changes" : "Create invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
