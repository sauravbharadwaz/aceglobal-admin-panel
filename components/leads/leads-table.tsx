"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createLead, deleteLead, updateLeadStatus } from "@/app/(admin)/leads/actions";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { formatDate, titleCase } from "@/lib/format";
import { LeadStatusBadge } from "@/components/status-badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered = leads.filter((l) => {
    const q = query.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.company ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").toLowerCase().includes(q)
    );
  });

  function handleStatus(id: string, status: LeadStatus) {
    startTransition(async () => {
      const res = await updateLeadStatus(id, status);
      if (res.error) toast.error(res.error);
      else toast.success("Lead status updated");
    });
  }

  function handleDelete(id: string, name: string) {
    startTransition(async () => {
      const res = await deleteLead(id);
      if (res.error) toast.error(res.error);
      else toast.success(`Deleted ${name}`);
    });
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const res = await createLead(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Lead added");
        setAddOpen(false);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="size-4" />
            Add lead
          </DialogTrigger>
          <DialogContent>
            <form action={handleCreate}>
              <DialogHeader>
                <DialogTitle>Add lead</DialogTitle>
                <DialogDescription>
                  Manually record a lead that came in outside the website form.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" name="company" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="service">Service</Label>
                    <Input id="service" name="service" placeholder="bookkeeping" />
                  </div>
                </div>
                <input type="hidden" name="status" value="new" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : "Save lead"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">Company</TableHead>
              <TableHead className="hidden lg:table-cell">Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Added</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    <div>{lead.email ?? "—"}</div>
                    <div>{lead.phone ?? ""}</div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {lead.company ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {lead.service ? titleCase(lead.service) : "—"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lead.status}
                      onValueChange={(v) => handleStatus(lead.id, v as LeadStatus)}
                    >
                      <SelectTrigger className="h-8 w-[140px] border-none bg-transparent p-0 shadow-none focus:ring-0">
                        <SelectValue>
                          <LeadStatusBadge status={lead.status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {titleCase(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(lead.created_at)}
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
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(lead.id, lead.name)}
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
    </div>
  );
}
