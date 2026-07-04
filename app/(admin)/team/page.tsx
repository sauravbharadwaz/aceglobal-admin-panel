import { createAdminClient } from "@/lib/supabase/admin";
import { currentUserId, currentUserIsStaff } from "@/lib/staff-guard";
import { TeamManager, type TeamMember } from "@/components/team/team-manager";

export const dynamic = "force-dynamic";

async function getTeam(): Promise<{ members: TeamMember[]; meId: string | null; configured: boolean }> {
  const meId = await currentUserId();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { members: [], meId, configured: false };
  }

  // Staff = company-domain email OR listed in admin_users.
  const { data: allow } = await admin.from("admin_users").select("user_id");
  const allowSet = new Set((allow ?? []).map((r) => r.user_id as string));

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = data?.users ?? [];

  const members: TeamMember[] = users
    .filter((u) => {
      const email = (u.email ?? "").toLowerCase();
      return email.endsWith("@aceglobal.ai") || allowSet.has(u.id);
    })
    .map((u) => ({
      id: u.id,
      email: u.email ?? "—",
      lastSignInAt: u.last_sign_in_at ?? null,
      confirmed: !!u.email_confirmed_at,
      viaDomain: (u.email ?? "").toLowerCase().endsWith("@aceglobal.ai"),
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return { members, meId, configured: true };
}

export default async function TeamPage() {
  if (!(await currentUserIsStaff())) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Staff access required.</p>
      </div>
    );
  }

  const { members, meId, configured } = await getTeam();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Everyone with admin-panel access. Anyone on an{" "}
          <span className="font-medium">@aceglobal.ai</span> email is staff automatically;
          invite others to grant access.
        </p>
      </div>
      {!configured ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          Team management needs the <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>{" "}
          environment variable on this project. Add it in Vercel → Settings → Environment
          Variables, then redeploy.
        </div>
      ) : (
        <TeamManager members={members} meId={meId} />
      )}
    </div>
  );
}
