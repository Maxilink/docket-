import 'server-only';

export interface SendResult {
  ok: boolean;
  channel: string;
  detail: string;
}

export function termiiConfigured() {
  return Boolean(process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID);
}

/** Sends one SMS or WhatsApp message through Termii. `to` must already be in 234... format. */
export async function sendMessage(to: string, text: string): Promise<SendResult> {
  const channel = (process.env.TERMII_CHANNEL || 'dnd').toLowerCase();
  if (!termiiConfigured()) return { ok: false, channel, detail: 'Termii is not set up (missing TERMII_API_KEY or TERMII_SENDER_ID).' };
  const base = (process.env.TERMII_BASE_URL || 'https://v4.api.termii.com').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TERMII_API_KEY,
        to,
        from: process.env.TERMII_SENDER_ID,
        sms: text.slice(0, 900),
        type: 'plain',
        channel,
      }),
      cache: 'no-store',
    });
    const body = await res.text();
    return { ok: res.ok, channel, detail: body.slice(0, 300) };
  } catch (e) {
    return { ok: false, channel, detail: e instanceof Error ? e.message : 'Network error' };
  }
}
