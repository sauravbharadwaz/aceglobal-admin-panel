"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPayout,
  deletePayout,
  updatePayout,
  updatePayoutStatus,
} from "@/app/(admin)/payouts/actions";
import { PAYOUT_STATUSES, type Payout, type PayoutStatus } from "@/lib/types";
import { formatCurrency, titleCase } from "@/lib/format";
import { PayoutStatusBadge } from "@/components/status-badge";
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

export function PayoutsTable({
  payouts,
  expertNames,
}: {
  payouts: Payout[];
  expertNames: string[];
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payout | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = payouts.filter((p) => {
    const q = query.toLowerCase();
    return (
      p.expert.toLowerCase().includes(q) || (p.period ?? "").toLowerCase().includes(q)
    );
  });

  const pendingTotal = payouts
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(payout: Payout) {
    setEditing(payout);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = editing
        ? await updatePayout(editing.id, formData)
        : await createPayout(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success(editing ? "Payout updated" : "Payout added");
        setDialogOpen(false);
      }
    });
  }

  function handleStatus(id: string, status: PayoutStatus) {
    startTransition(async () => {
      const res = await updatePayoutStatus(id, status);
      if (res.error) toast.error(res.error);
      else toast.success("Payout status updated");
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deletePayout(id);
      if (res.error) toast.error(res.error);
      else toast.success("Payout deleted");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payouts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-lg border bg-card px-3 py-2 text-sm sm:block">
            <span className="text-muted-foreground">Pending · </span>
            <span className="font-semibold">{formatCurrency(pendingTotal)}</span>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add payout
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Expert</TableHead>
              <TableHead className="hidden sm:table-cell">Period</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No payouts yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.expert}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {p.period ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.status}
                      onValueChange={(v) => handleStatus(p.id, v as PayoutStatus)}
                    >
                      <SelectTrigger className="h-8 w-[120px] border-none bg-transparent p-0 shadow-none focus:ring-0">
                        <SelectValue>
                          <PayoutStatusBadge status={p.status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PAYOUT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {titleCase(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="size-8" />}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(p.id)}
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
              <DialogTitle>{editing ? "Edit payout" : "Add payout"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update this payout." : "Record an expert payout."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="expert">Expert *</Label>
                <Input
                  id="expert"
                  name="expert"
                  list="payout-expert-names"
                  defaultValue={editing?.expert ?? ""}
                  required
                />
                <datalist id="payout-expert-names">
                  {expertNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="period">Period</Label>
                  <Input
                    id="period"
                    name="period"
                    placeholder="Jun 2026"
                    defaultValue={editing?.period ?? ""}
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
                <Select name="status" defaultValue={editing?.status ?? "pending"}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {titleCase(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save changes" : "Add payout"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
