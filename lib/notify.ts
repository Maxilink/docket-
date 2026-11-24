import 'server-only';
import { sendEmail, emailConfigured, cleanEmail } from '@/lib/email';
import { sendMessage, termiiConfigured, type SendResult } from '@/lib/termii';
import { normalisePhone } from '@/lib/phone';

export interface ClientTarget {
  email: string | null;
  phone: string | null;
  name: string | null;
  firmName: string;
}

export interface Attempt extends SendResult {
  recipient: string;
}

/** The channels that can reach this client right now, email first. */
export function clientChannels(t: { email: string | null; phone: string | null }) {
  const email = emailConfigured() ? cleanEmail(t.email) : null;
  const phone = termiiConfigured() ? normalisePhone(t.phone) : null;
  return { email, phone, count: (email ? 1 : 0) + (phone ? 1 : 0) };
}

/** Sends the same message to a client by email first, then SMS/WhatsApp. Returns one result per channel tried. */
export async function sendToClient(t: ClientTarget, subject: string, text: string): Promise<Attempt[]> {
  const { email, phone } = clientChannels(t);
  const out: Attempt[] = [];
  if (email) {
    const r = await sendEmail({
      to: email,
      toName: t.name,
      fromName: t.firmName,
      subject,
      text,
      footer: `Sent by ${t.firmName} through C-Diary. Please reply to your lawyer directly if you have questions.`,
    });
    out.push({ ...r, recipient: email });
  }
  if (phone) {
    const r = await sendMessage(phone, text);
    out.push({ ...r, recipient: phone });
  }
  return out;
}
