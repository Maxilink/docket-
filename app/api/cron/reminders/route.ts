import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMessage, termiiConfigured } from '@/lib/termii';
import { normalisePhone } from '@/lib/phone';
import { clientReminderText, lawyerReminderText } from '@/lib/messages';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  firm_id: string;
  title: string;
  starts_at: string;
  purpose: string | null;
  court: string | null;
  courtroom: string | null;
  remind_day: boolean;
  remind_hour: boolean;
  remind_client: boolean;
  lawyer: { phone: string | null } | null;
  matter: { suit_number: string | null; client_phone: string | null } | null;
  firm: { name: string } | null;
}

/**
 * Called every 5 minutes by Supabase (pg_cron). Sends:
 *  - counsel: a reminder about 24 hours before, and another within the last hour
 *  - client (if ticked): a reminder about 24 hours before
 * Each message is logged first, so it is never sent twice.
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (!termiiConfigured()) {
    return NextResponse.json({ ok: false, error: 'Termii is not configured' }, { status: 200 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const { data, error } = await admin
    .from('events')
    .select('id, firm_id, title, starts_at, purpose, court, courtroom, remind_day, remind_hour, remind_client, lawyer:profiles!events_lawyer_id_fkey(phone), matter:matters(suit_number, client_phone), firm:firms(name)')
    .is('outcome', null)
    .gt('starts_at', new Date(now).toISOString())
    .lte('starts_at', new Date(now + 24 * 3600e3).toISOString());
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const ev of (data ?? []) as unknown as Row[]) {
    const at = new Date(ev.starts_at);
    const minsLeft = (at.getTime() - now) / 60000;
    const where = [ev.court, ev.courtroom].filter(Boolean).join(', ');
    const jobs: { kind: 'day' | 'hour' | 'client_day'; to: string | null; text: string }[] = [];
    const lawyerPhone = normalisePhone(ev.lawyer?.phone);
    if (ev.remind_hour && minsLeft <= 60) {
      jobs.push({ kind: 'hour', to: lawyerPhone, text: lawyerReminderText('hour', ev.title, at, where, ev.purpose, ev.matter?.suit_number ?? null) });
    } else if (ev.remind_day && minsLeft > 60) {
      jobs.push({ kind: 'day', to: lawyerPhone, text: lawyerReminderText('day', ev.title, at, where, ev.purpose, ev.matter?.suit_number ?? null) });
    }
    if (ev.remind_client && minsLeft > 60) {
      jobs.push({ kind: 'client_day', to: normalisePhone(ev.matter?.client_phone), text: clientReminderText(ev.firm?.name ?? '', at, where, ev.matter?.suit_number ?? null) });
    }

    for (const job of jobs) {
      if (!job.to) { skipped++; continue; }
      // Claim the message first. If it was already claimed, skip it.
      const { error: claimErr } = await admin
        .from('reminder_log')
        .insert({ firm_id: ev.firm_id, event_id: ev.id, kind: job.kind, channel: process.env.TERMII_CHANNEL || 'dnd', recipient: job.to, status: 'pending' });
      if (claimErr) { skipped++; continue; }
      const res = await sendMessage(job.to, job.text);
      await admin
        .from('reminder_log')
        .update({ status: res.ok ? 'sent' : 'failed', detail: res.detail, channel: res.channel })
        .eq('event_id', ev.id)
        .eq('kind', job.kind)
        .eq('recipient', job.to);
      if (res.ok) sent++; else failed++;
    }
  }

  return NextResponse.json({ ok: true, checked: data?.length ?? 0, sent, failed, skipped });
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
