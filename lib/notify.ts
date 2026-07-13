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
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const recipient = (to ?? "").trim();
  if (!key || !recipient || !milestone) return;

  const from = process.env.NOTIFY_EMAIL_FROM || "Ace Global <updates@aceglobal.ai>";
  const appUrl = (process.env.PORTAL_APP_URL || "https://app.aceglobal.ai").replace(/\/+$/, "");
  const subject = `Progress update: ${milestone}`;

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
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: recipient, subject, html }),
    });
  } catch {
    /* best-effort: the in-app notification already covers the update */
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
