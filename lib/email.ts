import 'server-only';
import type { SendResult } from '@/lib/termii';

/** Email goes out through Brevo (https://www.brevo.com). Free plan: 300 emails a day. */
export function emailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function cleanEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  return EMAIL_RE.test(v) ? v : null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain, readable HTML version of a text message, with the C-Diary colours. */
function toHtml(text: string, footer: string, heading: string, link?: { href: string; label: string }) {
  const body = esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  const button = link
    ? `<p style="margin:22px 0 4px"><a href="${esc(link.href)}" style="display:inline-block;background:#2E0562;color:#ffffff;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px">${esc(link.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F4F0FA;padding:24px 12px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1F0F45">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E7DDF7">
<div style="background:#2E0562;color:#ffffff;padding:16px 24px;font-weight:700;font-size:17px">${esc(heading)}</div>
<div style="padding:24px;font-size:16px;line-height:1.55">${body}${button}</div>
<div style="padding:14px 24px;border-top:1px solid #EFE8FA;color:#625C75;font-size:13px">${esc(footer)}</div>
</div></body></html>`;
}

export interface EmailInput {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  /** Shown as the sender's name, e.g. the firm's name for client emails. */
  fromName?: string | null;
  footer?: string;
  link?: { href: string; label: string };
}

/** Sends one email through Brevo's transactional email API. */
export async function sendEmail(input: EmailInput): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, channel: 'email', detail: 'Email is not set up (missing BREVO_API_KEY or BREVO_SENDER_EMAIL).' };
  const to = cleanEmail(input.to);
  if (!to) return { ok: false, channel: 'email', detail: 'Not a valid email address.' };
  const fromName = (input.fromName || process.env.BREVO_SENDER_NAME || 'C-Diary').slice(0, 70);
  const footer = input.footer ?? 'Sent by C-Diary, the court diary for Nigerian law firms.';
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: fromName },
        to: [{ email: to, ...(input.toName ? { name: input.toName.slice(0, 70) } : {}) }],
        subject: input.subject.slice(0, 200),
        textContent: `${input.text}\n\n${input.link ? `${input.link.label}: ${input.link.href}\n\n` : ''}${footer}`,
        htmlContent: toHtml(input.text, footer, input.fromName || 'C-Diary', input.link),
      }),
      cache: 'no-store',
    });
    const body = await res.text();
    return { ok: res.ok, channel: 'email', detail: body.slice(0, 300) };
  } catch (e) {
    return { ok: false, channel: 'email', detail: e instanceof Error ? e.message : 'Network error' };
  }
}

/** The app's public address, for links in emails. */
export function appUrl(path = '') {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/+$/, '');
  return base ? `${base}${path}` : '';
}
