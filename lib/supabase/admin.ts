import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for privileged server-side operations (the Auth
 * Admin API: list / invite / delete users). BYPASSES Row Level Security, so it
 * must only ever be used from server code behind a staff check — never shipped
 * to the browser.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment (Vercel → the admin
 * project → Settings → Environment Variables, and .env.local for local dev).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Team management is not configured (missing SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const STAFF_EMAIL_DOMAIN = "@aceglobal.ai";
