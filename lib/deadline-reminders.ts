import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeDueIn, sendDeadlineEmail, sendOpsAlert } from "@/lib/notify";

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
 * How often to write, by how far away the due date is.
 *
 * This replaced a list of exact lead days. That list had two problems. It said
 * nothing until a fortnight out, which is late for anything a client has to
 * gather papers for, and it matched the day exactly — so a day the cron did not
 * run was a reminder lost rather than deferred, and at a weekly spacing that
 * would cost a whole notch. Asking "has it been long enough since the last one"
 * has neither fault: a late run still sends, it just sends late.
 *
 * The shape: quiet until a month out, weekly through that month, every other
 * day in the final week, and weekly again once it is past due — because a date
 * that has slipped is the one most worth chasing.
 *
 * Returns null when nothing is owed today.
 */
const FAR_HORIZON_DAYS = 30;
/* Past this, email has plainly stopped working on this one and something else
   needs to happen. Nagging forever only teaches people to filter us. */
const OVERDUE_GIVE_UP_DAYS = 90;

function reminderIntervalDays(daysUntil: number): number | null {
  if (daysUntil > FAR_HORIZON_DAYS) return null;
  if (daysUntil > 7) return 7;
  /* The due date always writes. At every other spacing it could fall a day
     after the previous one and be skipped, and the day the thing is actually
     due is the one email nobody should miss. */
  if (daysUntil === 0) return 0;
  if (daysUntil > 0) return 2;
  if (daysUntil >= -OVERDUE_GIVE_UP_DAYS) return 7;
  return null;
}

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
    const error = e instanceof Error ? e.message : "Supabase is not configured.";
    console.error("[deadline-reminders] could not start:", error);
    return { ok: false, error };
  }

  const today = new Date().toISOString().slice(0, 10);
  const earliest = addDays(today, -OVERDUE_GIVE_UP_DAYS);
  const latest = addDays(today, FAR_HORIZON_DAYS);

  const { data, error } = await admin
    .from("client_deadlines")
    .select("id, title, due_on, last_reminded_on, client_id, clients(name, email, user_id)")
    .eq("status", "upcoming")
    .gte("due_on", earliest)
    .lte("due_on", latest)
    .order("due_on", { ascending: true });

  if (error) {
    console.error("[deadline-reminders] query failed:", error.message);
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as unknown as DeadlineRow[];
  let sent = 0;
  let skipped = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const row of rows) {
    const days = daysBetween(today, row.due_on);
    const interval = reminderIntervalDays(days);
    /* Enough time since the last one, rather than an exact lead day. `since`
       is null the first time, which always sends. Zero means we already wrote
       today — a manual re-run or a retry after a partial failure — and must not
       write again whatever the interval says. */
    const since = row.last_reminded_on ? daysBetween(row.last_reminded_on, today) : null;
    if (interval === null || since === 0 || (since !== null && since < interval)) {
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

  if (failures.length) {
    /* CloudWatch is the floor: it holds this even when alerting is unconfigured
       or the mail provider is the thing that broke. */
    console.error(
      `[deadline-reminders] ${failures.length} of ${rows.length} failed on ${today}`,
      failures,
    );
    /* Best effort, and deliberately not awaited into the result: a run that sent
       most of its mail is still a run that worked, and an alert that cannot be
       delivered must not turn it into an error. */
    await sendOpsAlert(`Deadline reminders: ${failures.length} failed`, [
      `Run date: ${today}`,
      `Scanned ${rows.length}, sent ${sent}, skipped ${skipped}, failed ${failures.length}.`,
      "",
      ...failures.map((f) => `- ${f.id}: ${f.reason}`),
      "",
      "These clients did not get their reminder. The run does not retry them:",
      "the next lead day is the next chance, and for a deadline that is already",
      "close there may not be one.",
    ]).catch(() => {});
  }

  return { ok: true, date: today, scanned: rows.length, sent, skipped, failures };
}
