"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createExpert,
  deleteExpert,
  inviteExpertToPanel,
  updateExpert,
} from "@/app/(admin)/experts/actions";
import { EXPERT_ROLES, EXPERT_STATUSES, type Expert } from "@/lib/types";
import { titleCase } from "@/lib/format";
import { ExpertStatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export function ExpertsTable({ experts }: { experts: Expert[] }) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expert | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = experts.filter((e) => {
    const q = query.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.role ?? "").toLowerCase().includes(q) ||
      (e.specialties ?? "").toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(expert: Expert) {
    setEditing(expert);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = editing
        ? await updateExpert(editing.id, formData)
        : await createExpert(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(editing ? "Expert updated" : "Expert added");
        setDialogOpen(false);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    startTransition(async () => {
      const res = await deleteExpert(id);
      if (res.error) toast.error(res.error);
      else toast.success(`Removed ${name}`);
    });
  }

  function handleInvite(expert: Expert) {
    startTransition(async () => {
      const res = await inviteExpertToPanel(expert.id);
      if (res.error) toast.error(res.error);
      else toast.success(`Panel invite sent to ${expert.email}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search experts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add expert
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl glass">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Expert</TableHead>
              <TableHead className="hidden md:table-cell">Role</TableHead>
              <TableHead className="hidden lg:table-cell">Specialties</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No experts yet. Add your first team member.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((expert) => (
                <TableRow key={expert.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {expert.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{expert.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {expert.email ?? ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {expert.role ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {expert.specialties ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ExpertStatusBadge status={expert.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="size-8" />}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(expert)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleInvite(expert)}
                          disabled={!expert.email}
                        >
                          <Send className="size-4" />
                          Invite to panel
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(expert.id, expert.name)}
                        >
                          <Trash2 className="size-4" />
                          Remove
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
              <DialogTitle>{editing ? "Edit expert" : "Add expert"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update this team member." : "Add a new team member."}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select name="role" defaultValue={editing?.role ?? "CPA"}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERT_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={editing?.status ?? "active"}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPERT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {titleCase(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  name="specialties"
                  placeholder="Bookkeeping, IFTA, Schedule F"
                  defaultValue={editing?.specialties ?? ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save changes" : "Add expert"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
