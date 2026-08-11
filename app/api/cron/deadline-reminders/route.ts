import { runDeadlineReminders } from "@/lib/deadline-reminders";

/**
 * HTTP entry point for the daily due-date reminders. The work itself lives in
 * lib/deadline-reminders.ts — this only authenticates the caller and turns the
 * result into a response.
 *
 * Scheduled daily at 13:00 UTC by EventBridge, which presents
 * `Authorization: Bearer $CRON_SECRET` — the only thing that gets past the
 * guard below. The route is otherwise public, because a scheduler has no
 * session cookie to offer.
 *
 * The schedule used to live in vercel.json. It was removed when the panel moved
 * to AWS: both platforms read the same database, so two schedules would send
 * every client each reminder twice. Missing a day is harmless by comparison —
 * `last_reminded_on` means the next run picks up whatever was skipped.
 *
 * Config is read from SSM at cold start (see deploy/bootstrap.mjs):
 *   CRON_SECRET                = the shared secret EventBridge presents
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
