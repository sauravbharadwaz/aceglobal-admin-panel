"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, STAFF_EMAIL_DOMAIN } from "@/lib/supabase/admin";
import { currentUserIsStaff, currentUserId } from "@/lib/staff-guard";

type Result = { error: string | null };

/** Invite a teammate by email. Company-domain emails become staff automatically;
 *  other emails are added to the admin_users allowlist so they get staff access too. */
export async function inviteTeamMember(email: string): Promise<Result> {
  if (!(await currentUserIsStaff())) return { error: "Staff access required." };
  const e = (email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: "Enter a valid email address." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(e);
  if (error) return { error: error.message };

  if (!e.endsWith(STAFF_EMAIL_DOMAIN) && data?.user?.id) {
    await admin.from("admin_users").insert({ user_id: data.user.id });
  }
  revalidatePath("/team");
  return { error: null };
}

/** Remove a teammate: deletes their auth account (cascades their allowlist row).
 *  You cannot remove your own account. */
export async function removeTeamMember(userId: string): Promise<Result> {
  if (!(await currentUserIsStaff())) return { error: "Staff access required." };
  if (!userId) return { error: "Missing user." };

  const me = await currentUserId();
  if (me && me === userId) return { error: "You can't remove your own account." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { error: null };
}
