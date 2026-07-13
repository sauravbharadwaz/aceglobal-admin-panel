"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2, Phone, Video, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  createMeeting,
  deleteMeeting,
  updateMeeting,
} from "@/app/(admin)/meetings/actions";
import {
  MEETING_STATUSES,
  MEETING_TYPES,
  type Meeting,
  type MeetingType,
} from "@/lib/types";
import { formatDateTime, titleCase } from "@/lib/format";
import { MeetingStatusBadge } from "@/components/status-badge";
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

const TYPE_ICON: Record<MeetingType, React.ElementType> = {
  call: Phone,
  video: Video,
  "in-person": MapPin,
};

/** Convert a stored ISO timestamp to the value a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function MeetingsTable({ meetings }: { meetings: Meeting[] }) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = meetings.filter((m) => {
    const q = query.toLowerCase();
    return (
      m.client_name.toLowerCase().includes(q) ||
      (m.expert ?? "").toLowerCase().includes(q) ||
      (m.purpose ?? "").toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(meeting: Meeting) {
    setEditing(meeting);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = editing
        ? await updateMeeting(editing.id, formData)
        : await createMeeting(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success(editing ? "Meeting updated" : "Meeting scheduled");
        setDialogOpen(false);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    startTransition(async () => {
      const res = await deleteMeeting(id);
      if (res.error) toast.error(res.error);
      else toast.success(`Deleted meeting with ${name}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search meetings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Schedule meeting
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl glass">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">When</TableHead>
              <TableHead className="hidden lg:table-cell">Expert</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No meetings yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => {
                const Icon = TYPE_ICON[m.type];
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.client_name}</div>
                      {m.purpose && (
                        <div className="text-xs text-muted-foreground">{m.purpose}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {m.scheduled_at ? formatDateTime(m.scheduled_at) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {m.expert ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-sm capitalize text-muted-foreground">
                        <Icon className="size-3.5" />
                        {m.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <MeetingStatusBadge status={m.status} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="size-8" />}
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(m)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(m.id, m.client_name)}
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
        <DialogContent>
          <form action={handleSubmit} key={editing?.id ?? "new"}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit meeting" : "Schedule meeting"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update this meeting." : "Log or schedule a client meeting."}
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
              <div className="grid gap-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Input
                  id="purpose"
                  name="purpose"
                  placeholder="Kickoff call, tax review…"
                  defaultValue={editing?.purpose ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduled_at">Date &amp; time</Label>
                <Input
                  id="scheduled_at"
                  name="scheduled_at"
                  type="datetime-local"
                  defaultValue={toLocalInput(editing?.scheduled_at ?? null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select name="type" defaultValue={editing?.type ?? "call"}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {titleCase(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={editing?.status ?? "scheduled"}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {titleCase(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expert">Expert</Label>
                <Input
                  id="expert"
                  name="expert"
                  placeholder="Assigned team member"
                  defaultValue={editing?.expert ?? ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save changes" : "Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
