"use client";

import { useState, useTransition } from "react";
import { Mail, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteTeamMember, removeTeamMember } from "@/app/(admin)/team/actions";
import { timeAgo } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TeamMember = {
  id: string;
  email: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  viaDomain: boolean;
};

export function TeamManager({
  members,
  meId,
}: {
  members: TeamMember[];
  meId: string | null;
}) {
  const [email, setEmail] = useState("");
  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite() {
    const e = email.trim();
    if (!e) return;
    startTransition(async () => {
      const res = await inviteTeamMember(e);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invitation sent to ${e}.`);
      setEmail("");
    });
  }

  function handleRemove() {
    const m = pendingRemove;
    if (!m) return;
    startTransition(async () => {
      const res = await removeTeamMember(m.id);
      if (res.error) toast.error(res.error);
      else toast.success(`${m.email} removed.`);
      setPendingRemove(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Invite */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <UserPlus className="size-4 text-muted-foreground" />
          Invite a teammate
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="name@aceglobal.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInvite();
            }}
            className="sm:max-w-sm"
          />
          <Button onClick={handleInvite} disabled={isPending || !email.trim()}>
            <Mail className="size-4" />
            Send invite
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          They&apos;ll get an email to set a password. Company-domain emails get staff access
          automatically; other emails are added to the staff allowlist.
        </p>
      </div>

      {/* Members */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Member</TableHead>
              <TableHead className="hidden sm:table-cell">Access</TableHead>
              <TableHead className="hidden sm:table-cell">Last sign-in</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No team members found.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {m.email}
                      {meId === m.id ? (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      ) : null}
                    </div>
                    {!m.confirmed ? (
                      <div className="text-xs text-amber-600">Invite pending</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <ShieldCheck className="size-3.5" />
                      {m.viaDomain ? "Company domain" : "Allowlisted"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {m.lastSignInAt ? timeAgo(m.lastSignInAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    {meId === m.id ? null : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setPendingRemove(m)}
                        aria-label={`Remove ${m.email}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Remove confirm */}
      <Dialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
            <DialogDescription>
              {pendingRemove?.email} will lose access to the admin panel and their login
              account will be deleted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemove(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isPending}>
              {isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
