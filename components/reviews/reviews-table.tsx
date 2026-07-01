"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createReview,
  deleteReview,
  updateReview,
} from "@/app/(admin)/expert-reviews/actions";
import { type Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
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

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-4",
            n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

export function ReviewsTable({
  reviews,
  expertNames,
}: {
  reviews: Review[];
  expertNames: string[];
}) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = reviews.filter((r) => {
    const q = query.toLowerCase();
    return (
      r.expert.toLowerCase().includes(q) ||
      (r.client_name ?? "").toLowerCase().includes(q) ||
      (r.comment ?? "").toLowerCase().includes(q)
    );
  });

  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "—";

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(review: Review) {
    setEditing(review);
    setDialogOpen(true);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = editing
        ? await updateReview(editing.id, formData)
        : await createReview(formData);
      if (res.error) toast.error(res.error);
      else {
        toast.success(editing ? "Review updated" : "Review added");
        setDialogOpen(false);
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteReview(id);
      if (res.error) toast.error(res.error);
      else toast.success("Review deleted");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reviews…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm sm:flex">
            <span className="text-muted-foreground">Avg rating</span>
            <span className="font-semibold">{avg}</span>
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add review
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Expert</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="hidden md:table-cell">Comment</TableHead>
              <TableHead className="hidden lg:table-cell">Client</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No reviews yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.expert}</TableCell>
                  <TableCell>
                    <Stars rating={r.rating} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground">
                    {r.comment ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {r.client_name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="size-8" />}
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(r)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(r.id)}
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
              <DialogTitle>{editing ? "Edit review" : "Add review"}</DialogTitle>
              <DialogDescription>
                {editing ? "Update this review." : "Record client feedback on an expert."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="expert">Expert *</Label>
                <Input
                  id="expert"
                  name="expert"
                  list="expert-names"
                  defaultValue={editing?.expert ?? ""}
                  required
                />
                <datalist id="expert-names">
                  {expertNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="rating">Rating</Label>
                  <Select name="rating" defaultValue={String(editing?.rating ?? 5)}>
                    <SelectTrigger id="rating">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 4, 3, 2, 1].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} ★
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client_name">Client</Label>
                  <Input
                    id="client_name"
                    name="client_name"
                    defaultValue={editing?.client_name ?? ""}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comment">Comment</Label>
                <Input
                  id="comment"
                  name="comment"
                  placeholder="What did the client say?"
                  defaultValue={editing?.comment ?? ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save changes" : "Add review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
