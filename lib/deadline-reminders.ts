import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeDueIn, sendDeadlineEmail } from "@/lib/notify";

/**
 * Emails clients about due dates that are coming up, and pushes the same notice
 * to the bell on their dashboard.
 *
 * Kept apart from the route that calls it so the schedule and the work aren't
 * welded together: on Vercel a cron hits the HTTP route, but a scheduler that
 * can invoke code directly should not have to make a round trip through the
 * public internet and a bearer token to reach it.
 *
 * Env:
 *   SUPABASE_SERVICE_ROLE_KEY  = needed to read across all clients
 *   RESEND_API_KEY             = to actually send (see lib/notify.ts)
 */

/**
 * How far ahead of a due date we write. One email per entry, no drip: 14 and 7
 * days out to give warning, 3, 1 and 0 to prompt, and -1 as the single "this is
 * past due" notice. Nothing fires after that — a missed deadline is a
 * conversation for a human, not a daily nag.
 */
const LEAD_DAYS = [14, 7, 3, 1, 0, -1];

/** Whole days between two `date` columns. Both are read as UTC, so no drift. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

type DeadlineRow = {
  id: string;
  title: string;
  due_on: string;
  last_reminded_on: string | null;
  client_id: string;
  clients: { name: string | null; email: string | null; user_id: string | null } | null;
};

export type ReminderRun = {
  ok: boolean;
  error?: string;
  date?: string;
  scanned?: number;
  sent?: number;
  skipped?: number;
  failures?: { id: string; reason: string }[];
};

/**
 * Send whatever is due today. Safe to run more than once a day: `last_reminded_on`
 * makes a repeat run a no-op, so a retry after a partial failure only picks up
 * what didn't get through.
 */
export async function runDeadlineReminders(): Promise<ReminderRun> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Supabase is not configured." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const earliest = addDays(today, Math.min(...LEAD_DAYS));
  const latest = addDays(today, Math.max(...LEAD_DAYS));

  const { data, error } = await admin
    .from("client_deadlines")
    .select("id, title, due_on, last_reminded_on, client_id, clients(name, email, user_id)")
    .eq("status", "upcoming")
    .gte("due_on", earliest)
    .lte("due_on", latest)
    .order("due_on", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as unknown as DeadlineRow[];
  let sent = 0;
  let skipped = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const row of rows) {
    const days = daysBetween(today, row.due_on);
    // Between two lead times, or already written to today (a manual re-run, or
    // a retry after a partial failure) — nothing to do.
    if (!LEAD_DAYS.includes(days) || row.last_reminded_on === today) {
      skipped++;
      continue;
    }

    const email = row.clients?.email ?? null;
    const res = await sendDeadlineEmail(email, {
      title: row.title,
      dueOn: row.due_on,
      daysUntil: days,
    });
    if (!res.ok) {
      failures.push({ id: row.id, reason: res.error ?? "Send failed." });
      // Leave last_reminded_on alone so tomorrow's run tries again.
      continue;
    }

    // Mirror it on the dashboard bell, so a client who misses the email still
    // sees it. Best-effort: a failure here shouldn't re-send the email tomorrow.
    if (row.clients?.user_id) {
      await admin.from("notifications").insert({
        user_id: row.clients.user_id,
        title: days < 0 ? `Overdue: ${row.title}` : `${row.title} is due ${describeDueIn(days)}`,
        body: `Due ${row.due_on}.`,
      });
    }

    await admin
      .from("client_deadlines")
      .update({ last_reminded_on: today })
      .eq("id", row.id);
    sent++;
  }

  return { ok: true, date: today, scanned: rows.length, sent, skipped, failures };
}
