import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMessage, termiiConfigured } from '@/lib/termii';
import { pushConfigured, sendPushToUser } from '@/lib/push';
import { normalisePhone } from '@/lib/phone';
import { clientReminderText, lawyerReminderText } from '@/lib/messages';
import { fmtTime, isQuietHours } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Row {
  id: string;
  firm_id: string;
  title: string;
  starts_at: string;
  purpose: string | null;
  court: string | null;
  courtroom: string | null;
  lawyer_id: string | null;
  remind_day: boolean;
  remind_hour: boolean;
  remind_client: boolean;
  lawyer: { phone: string | null; firm_id: string | null; status: string | null } | null;
  matter: { suit_number: string | null; client_phone: string | null } | null;
  firm: { name: string } | null;
}

type Kind = 'day' | 'hour' | 'client_day' | 'push_day' | 'push_hour';
interface Job {
  ev: Row;
  kind: Kind;
  to: string;
  send: () => Promise<{ ok: boolean; channel: string; detail: string }>;
}

/** Runs async jobs a few at a time so a busy day doesn't time out. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

/**
 * Called every 5 minutes by Supabase (pg_cron). Sends, for hearings in the next 24 hours:
 *  - counsel: SMS/WhatsApp and a push notification about a day before, and again within the last hour
 *  - client (if ticked): an SMS/WhatsApp about a day before
 * Nothing automatic goes out between 8pm and 7am; held messages go out at 7am if still due.
 * Each message is claimed in reminder_log before sending, per hearing date, so a rescheduled hearing gets
 * fresh reminders and nothing is sent twice. Failed messages are retried up to 3 times.
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  const sms = termiiConfigured();
  const push = pushConfigured();
  if (!sms && !push) {
    return NextResponse.json({ ok: false, error: 'Neither Termii nor push notifications are configured' }, { status: 200 });
  }
  if (isQuietHours()) {
    return NextResponse.json({ ok: true, quiet: true, note: 'Quiet hours (8pm to 7am). Due reminders go out at 7am.' });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const { data, error } = await admin
    .from('events')
    .select('id, firm_id, title, starts_at, purpose, court, courtroom, lawyer_id, remind_day, remind_hour, remind_client, lawyer:profiles!events_lawyer_id_fkey(phone, firm_id, status), matter:matters(suit_number, client_phone), firm:firms(name)')
    .is('outcome', null)
    .is('archived_at', null)
    .gt('starts_at', new Date(now).toISOString())
    .lte('starts_at', new Date(now + 24 * 3600e3).toISOString())
    .limit(2000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const events = (data ?? []) as unknown as Row[];

  // Who has switched on notifications on at least one device.
  let pushUsers = new Set<string>();
  if (push) {
    const ids = Array.from(new Set(events.map((e) => e.lawyer_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: subs } = await admin.from('push_subscriptions').select('user_id').in('user_id', ids);
      pushUsers = new Set((subs ?? []).map((s) => s.user_id as string));
    }
  }

  const jobs: Job[] = [];
  for (const ev of events) {
    const at = new Date(ev.starts_at);
    const minsLeft = (at.getTime() - now) / 60000;
    const where = [ev.court, ev.courtroom].filter(Boolean).join(', ');
    // Counsel only gets reminders while they are still an approved member of this firm.
    const counselOk = ev.lawyer_id && ev.lawyer && ev.lawyer.firm_id === ev.firm_id && ev.lawyer.status !== 'pending';
    const which: 'day' | 'hour' | null = ev.remind_hour && minsLeft <= 60 ? 'hour' : ev.remind_day && minsLeft > 60 ? 'day' : null;
    const lawyerText = which ? lawyerReminderText(which, ev.title, at, where, ev.purpose, ev.matter?.suit_number ?? null) : '';

    if (which && counselOk) {
      const phone = normalisePhone(ev.lawyer?.phone);
      if (sms && phone) jobs.push({ ev, kind: which, to: phone, send: () => sendMessage(phone, lawyerText) });
      if (push && pushUsers.has(ev.lawyer_id!)) {
        const userId = ev.lawyer_id!;
        jobs.push({
          ev,
          kind: which === 'hour' ? 'push_hour' : 'push_day',
          to: userId,
          send: async () => {
            const n = await sendPushToUser(userId, {
              title: which === 'hour' ? `In court at ${fmtTime(at)}` : ev.title,
              body: lawyerText,
              url: `/events/${ev.id}`,
              tag: `event-${ev.id}`,
            });
            return { ok: n > 0, channel: 'push', detail: `${n} device(s)` };
          },
        });
      }
    }
    if (sms && ev.remind_client && minsLeft > 60) {
      const phone = normalisePhone(ev.matter?.client_phone);
      if (phone) {
        const text = clientReminderText(ev.firm?.name ?? '', at, where, ev.matter?.suit_number ?? null);
        jobs.push({ ev, kind: 'client_day', to: phone, send: () => sendMessage(phone, text) });
      }
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  await pool(jobs, 5, async (job) => {
    // Claim first. If someone already sent (or is sending) this one, skip it.
    const { data: claimId, error: claimErr } = await admin.rpc('claim_reminder', {
      p_firm: job.ev.firm_id,
      p_event: job.ev.id,
      p_kind: job.kind,
      p_recipient: job.to,
      p_starts: job.ev.starts_at,
      p_channel: job.kind.startsWith('push') ? 'push' : process.env.TERMII_CHANNEL || 'dnd',
    });
    if (claimErr || claimId == null) { skipped++; return; }
    let res: { ok: boolean; channel: string; detail: string };
    try {
      res = await job.send();
    } catch (e) {
      res = { ok: false, channel: 'unknown', detail: e instanceof Error ? e.message : 'Send failed' };
    }
    await admin
      .from('reminder_log')
      .update({ status: res.ok ? 'sent' : 'failed', detail: res.detail, channel: res.channel, updated_at: new Date().toISOString() })
      .eq('id', claimId);
    if (res.ok) sent++; else failed++;
  });

  return NextResponse.json({ ok: true, checked: events.length, sent, failed, skipped });
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
