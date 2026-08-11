import { runDeadlineReminders } from "@/lib/deadline-reminders";

/**
 * HTTP entry point for the daily due-date reminders. The work itself lives in
 * lib/deadline-reminders.ts — this only authenticates the caller and turns the
 * result into a response.
 *
 * Scheduled daily by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET` on every scheduled request, which is the
 * only thing that gets past the guard below — the route is otherwise public,
 * because a cron has no session cookie to present.
 *
 * Env (admin-panel Vercel project):
 *   CRON_SECRET                = any long random string
 *   SUPABASE_SERVICE_ROLE_KEY  = needed to read across all clients
 *   RESEND_API_KEY             = to actually send (see lib/notify.ts)
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  // No secret configured means the route can't tell a cron from a stranger.
  // Refuse to run rather than expose every client's deadlines to an open GET.
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDeadlineReminders();
  if (!result.ok) return Response.json({ error: result.error }, { status: 503 });
  return Response.json(result);
}
