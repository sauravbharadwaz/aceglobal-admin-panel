import "server-only";

/**
 * Best-effort transactional email for client progress updates, sent via Resend.
 *
 * No-op (returns quietly) when RESEND_API_KEY isn't configured, so the in-app
 * dashboard notification keeps working with or without email set up. Uses the
 * Resend REST API directly (no SDK dependency).
 *
 * Env (admin-panel Vercel project):
 *   RESEND_API_KEY     = re_…                     (required to actually send)
 *   NOTIFY_EMAIL_FROM  = "Ace Global <updates@aceglobal.ai>"  (verified sender)
 *   PORTAL_APP_URL     = https://app.aceglobal.ai (dashboard link in the email)
 */
export async function sendProgressEmail(
  to: string | null | undefined,
  milestone: string,
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const recipient = (to ?? "").trim();
  if (!milestone) return { ok: false };
  if (!key) return { ok: false, error: "Email isn't set up: RESEND_API_KEY is missing on this deployment." };
  if (!recipient) return { ok: false, error: "No email address on file for this client." };

  // Must be an address on a Resend-verified domain. We verified the
  // updates.aceglobal.ai subdomain, so default the sender there.
  const from = process.env.NOTIFY_EMAIL_FROM || "Ace Global <notifications@updates.aceglobal.ai>";
  const appUrl = (process.env.PORTAL_APP_URL || "https://app.aceglobal.ai").replace(/\/+$/, "");
  const subject = `Progress update: ${milestone}`;

  /* Plain text alongside the HTML — see the note in sendDeadlineEmail. */
  const text = [
    "Progress update",
    "",
    milestone,
    "",
    "Good news, your application has moved forward. The full details and next steps are on your dashboard:",
    appUrl,
    "",
    "You're receiving this because you have an active engagement with Ace Global.",
  ].join("\n");

  const html = `<!doctype html>
  <div style="margin:0;padding:24px;background:#f5f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e2330">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e8f0;border-radius:16px;overflow:hidden">
      <div style="padding:22px 28px;border-bottom:1px solid #eef0f6;font-weight:700;font-size:18px;color:#0f172a">Ace Global</div>
      <div style="padding:28px">
        <p style="margin:0 0 6px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#8a90a2">Progress update</p>
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#0f172a">${escapeHtml(milestone)}</h1>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5163">Good news — your application has moved forward. You can see the full details and next steps on your dashboard.</p>
        <a href="${appUrl}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Open your dashboard</a>
      </div>
      <div style="padding:16px 28px;border-top:1px solid #eef0f6;font-size:12px;color:#9aa0ae">You're receiving this because you have an active engagement with Ace Global.</div>
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: recipient, subject, html, text }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { message?: string; name?: string };
        detail = body.message || body.name || "";
      } catch {
        /* ignore parse failure */
      }
      return { ok: false, error: `Resend ${res.status}: ${detail || res.statusText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}

/**
 * Reminder that a due date is coming up (or has passed). Sent by the
 * deadline-reminders cron; same Resend setup and the same no-op-when-unset
 * behaviour as sendProgressEmail.
 */
export async function sendDeadlineEmail(
  to: string | null | undefined,
  deadline: { title: string; dueOn: string; daysUntil: number },
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const recipient = (to ?? "").trim();
  if (!deadline.title) return { ok: false };
  if (!key) return { ok: false, error: "Email isn't set up: RESEND_API_KEY is missing on this deployment." };
  if (!recipient) return { ok: false, error: "No email address on file for this client." };

  const from = process.env.NOTIFY_EMAIL_FROM || "Ace Global <notifications@updates.aceglobal.ai>";
  const appUrl = (process.env.PORTAL_APP_URL || "https://app.aceglobal.ai").replace(/\/+$/, "");

  const { title, dueOn, daysUntil } = deadline;
  const when = describeDueIn(daysUntil);
  const overdue = daysUntil < 0;
  const subject = overdue ? `Overdue: ${title}` : `${title} is due ${when}`;
  const accent = overdue ? "#be123c" : "#b45309";
  // The date column is "2026-04-15"; read it as a plain date so the label can't
  // slip a day on a server in a different timezone.
  const [y, m, d] = dueOn.split("-").map(Number);
  const dueLabel = new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  /* Plain text alongside the HTML. Sending HTML alone is a spam signal in its
     own right, and a deadline reminder that lands in spam has done nothing at
     all — this is the one email in the product where delivery IS the feature. */
  const text = [
    overdue ? "Overdue" : "Upcoming deadline",
    "",
    title,
    `Due ${dueLabel} (${when}).`,
    "",
    "Your dashboard has the details, and we'll be in touch if we need anything from you:",
    appUrl,
    "",
    "You're receiving this because you have an active engagement with Ace Global.",
  ].join("\n");

  const html = `<!doctype html>
  <div style="margin:0;padding:24px;background:#f5f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e2330">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e8f0;border-radius:16px;overflow:hidden">
      <div style="padding:22px 28px;border-bottom:1px solid #eef0f6;font-weight:700;font-size:18px;color:#0f172a">Ace Global</div>
      <div style="padding:28px">
        <p style="margin:0 0 6px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:${accent}">${overdue ? "Overdue" : "Upcoming deadline"}</p>
        <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#0f172a">${escapeHtml(title)}</h1>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5163">Due <strong>${escapeHtml(dueLabel)}</strong> — ${escapeHtml(when)}. Your dashboard has the details, and we'll be in touch if we need anything from you.</p>
        <a href="${appUrl}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Open your dashboard</a>
      </div>
      <div style="padding:16px 28px;border-top:1px solid #eef0f6;font-size:12px;color:#9aa0ae">You're receiving this because you have an active engagement with Ace Global.</div>
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: recipient, subject, html, text }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { message?: string; name?: string };
        detail = body.message || body.name || "";
      } catch {
        /* ignore parse failure */
      }
      return { ok: false, error: `Resend ${res.status}: ${detail || res.statusText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}

/** "today", "in 7 days", "3 days ago" — the human half of the subject line. */
export function describeDueIn(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil === -1) return "1 day ago";
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
  return `in ${daysUntil} days`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Tells a human that a scheduled job went wrong.
 *
 * The reminder run already collected its failures and handed them back in the
 * response body, which nothing reads: EventBridge sees a 200 and moves on. So a
 * dead Resend key, or a client with no address on file, would stop reminders
 * going out and the first anyone would know is a client missing a filing date.
 *
 * Plain text on purpose. This is mail to ourselves, and the point is that it is
 * readable in a notification preview without opening anything.
 */
export async function sendOpsAlert(
  subject: string,
  lines: string[],
): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.OPS_ALERT_EMAIL ?? "").trim();
  /* No address configured is not an error worth throwing over — the caller has
     already written the same detail to the log, which is the floor. */
  if (!to) return { ok: false, error: "OPS_ALERT_EMAIL is not set." };
  if (!key) return { ok: false, error: "RESEND_API_KEY is missing." };

  const from = process.env.NOTIFY_EMAIL_FROM || "Ace Global <notifications@updates.aceglobal.ai>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `[Ace Global] ${subject}`,
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Alert send failed." };
  }
}
