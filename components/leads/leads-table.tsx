"use client";

import { useState, useTransition } from "react";
import { Building2, Download, FileDown, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createLead, deleteLead, updateLeadStatus } from "@/app/(admin)/leads/actions";
import { getDocumentUrl } from "@/app/(admin)/clients/actions";
import {
  LEAD_STATUSES,
  type Lead,
  type LeadStatus,
  type OnboardingSubmission,
} from "@/lib/types";
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
  DialogTrigger,
} from "@/components/ui/dialog";

/** Uploaded-file manifest as stored in `details` by the client app. */
type UploadedFile = { name?: string; path?: string };
function filesIn(sub: OnboardingSubmission): UploadedFile[] {
  const d = (sub.details ?? {}) as Record<string, unknown>;
  return Object.values(d).flatMap((v) =>
    Array.isArray(v) && v.every((f) => !!f && typeof f === "object" && typeof (f as UploadedFile).path === "string")
      ? (v as UploadedFile[])
      : [],
  );
}

export function LeadsTable({
  leads,
  businesses = {},
}: {
  leads: Lead[];
  /** Lowercased email → the business this lead added at sign-up, when they had one. */
  businesses?: Record<string, OnboardingSubmission>;
}) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const businessFor = (lead: Lead): OnboardingSubmission | undefined =>
    businesses[(lead.email ?? "").trim().toLowerCase()];

  async function handleDownloadProfile(sub: OnboardingSubmission) {
    try {
      const mod = await import("@/lib/application-pdf");   // lazy-load jsPDF only on click
      mod.downloadSubmissionPDF(sub);
    } catch {
      toast.error("Could not generate the business profile PDF.");
    }
  }

  function handleDownloadDoc(path: string) {
    startTransition(async () => {
      const res = await getDocumentUrl(path);
      if (res.error || !res.url) toast.error(res.error ?? "Couldn't open that document.");
      else window.open(res.url, "_blank", "noopener");
    });
  }

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

      <div className="overflow-hidden rounded-xl glass">
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
                    {/* App sign-ups have no company on the lead row itself; show the
                        business they added so staff can see at a glance which leads
                        have details to download. */}
                    {lead.company ?? businessFor(lead)?.company ?? "—"}
                    {!lead.company && businessFor(lead) && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 align-middle text-xs text-muted-foreground"
                        title="This lead added an existing business at sign-up"
                      >
                        <Building2 className="size-3" />
                        on file
                      </span>
                    )}
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
                        {/* Present only for leads who signed up choosing "I already
                            have a business" — everyone else sees just Delete. */}
                        {(() => {
                          const sub = businessFor(lead);
                          if (!sub) return null;
                          return (
                            <>
                              <DropdownMenuItem onClick={() => handleDownloadProfile(sub)}>
                                <FileDown className="size-4" />
                                Download business details
                              </DropdownMenuItem>
                              {filesIn(sub).map((f, i) => (
                                <DropdownMenuItem
                                  key={f.path ?? i}
                                  disabled={isPending}
                                  onClick={() => f.path && handleDownloadDoc(f.path)}
                                >
                                  <Download className="size-4" />
                                  {f.name ?? "Document"}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                            </>
                          );
                        })()}
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
