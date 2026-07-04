import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Is the current (cookie-authenticated) user staff? Uses the is_staff() SQL
 * function. Falls back to the company-email domain if is_staff() isn't deployed
 * yet, so a missing migration doesn't lock admins out.
 */
export async function currentUserIsStaff(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc("is_staff");
    if (error) {
      return (user.email ?? "").toLowerCase().endsWith("@aceglobal.ai");
    }
    return data === true;
  } catch {
    return false;
  }
}

export async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
