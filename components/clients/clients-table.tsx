"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createClientRecord,
  deleteClientRecord,
  updateClientRecord,
} from "@/app/(admin)/clients/actions";
import { CLIENT_STATUSES, type Client } from "@/lib/types";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
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

export function ClientsTable({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
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
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
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
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
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
              filtered.map((client) => (
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
                  <TableCell className="hidden lg:table-cell text-sm">
                    {client.owner ?? "—"}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          {/* key forces the uncontrolled form to reset between create/edit */}
          <form action={handleSubmit} key={editing?.id ?? "new"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update this client's details."
                  : "Create a new client record."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" defaultValue={editing?.company ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
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
