import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import { sendMessage } from '@/lib/termii';
import { sendPushToUser } from '@/lib/push';
import { normalisePhone } from '@/lib/phone';
import { addDays, fmtTime, parts, startOfDay, WEEKDAYS, MONTHS, ymd } from '@/lib/time';

/** The morning list goes out between 7:00 and 9:59 am (Nigerian time), once per person per day. */
export const MORNING_FROM_HOUR = 7;
export const MORNING_UNTIL_HOUR = 10;

export interface MorningItem {
  at: Date;
  type: string;
  title: string;
  suit: string | null;
  where: string;
  purpose: string | null;
  openItems: number;
}

const TYPE_WORD: Record<string, string> = { hearing: '', filing: 'File: ', client: 'Client: ', internal: 'Meeting: ' };

function firstName(name: string) {
  return name.replace(/^(barr\.?|barrister|mr\.?|mrs\.?|ms\.?|dr\.?|chief)\s+/i, '').trim().split(/\s+/)[0] || '';
}

/** Short enough for SMS: up to 5 items, then "and N more". */
export function morningText(fullName: string, day: Date, items: MorningItem[], max = 5): string {
  const p = parts(day);
  const head = `Good morning${firstName(fullName) ? ` ${firstName(fullName)}` : ''}. Today, ${WEEKDAYS[p.dow].slice(0, 3)} ${p.d} ${MONTHS[p.m].slice(0, 3)}:`;
  const lines = items.slice(0, max).map((it) => {
    const bits = [
      `${fmtTime(it.at)} ${TYPE_WORD[it.type] ?? ''}${it.title}${it.suit ? ` (${it.suit})` : ''}`,
      it.where || null,
      it.purpose ? `for ${it.purpose.toLowerCase()}` : null,
      it.openItems > 0 ? `${it.openItems} item${it.openItems === 1 ? '' : 's'} not ready` : null,
    ].filter(Boolean);
    return `- ${bits.join(', ')}`;
  });
  const more = items.length > max ? `\n- and ${items.length - max} more in C-Diary` : '';
  return `${head}\n${lines.join('\n')}${more}`;
}

interface Row {
  id: string;
  firm_id: string;
  type: string;
  title: string;
  starts_at: string;
  purpose: string | null;
  court: string | null;
  courtroom: string | null;
  lawyer_id: string;
  lawyer: { full_name: string; phone: string | null; firm_id: string | null; status: string | null; morning_list: boolean | null } | null;
  matter: { suit_number: string | null } | null;
}

/**
 * Sends each lawyer one message with today's matters, by SMS/WhatsApp and push.
 * Only people with something in the diary today get one, and only those who haven't turned it off.
 */
export async function runMorningList(admin: ReturnType<typeof createAdminClient>, opts: { sms: boolean; push: boolean }, now = new Date()) {
  const h = parts(now).h;
  if (h < MORNING_FROM_HOUR || h >= MORNING_UNTIL_HOUR) return { skipped: 'outside 7–10am' };

  const dayStart = startOfDay(now);
  const { data, error } = await admin
    .from('events')
    .select('id, firm_id, type, title, starts_at, purpose, court, courtroom, lawyer_id, lawyer:profiles!events_lawyer_id_fkey(full_name, phone, firm_id, status, morning_list), matter:matters(suit_number)')
    .is('archived_at', null)
    .is('outcome', null)
    .not('lawyer_id', 'is', null)
    .gte('starts_at', dayStart.toISOString())
    .lt('starts_at', addDays(dayStart, 1).toISOString())
    .order('starts_at')
    .limit(3000);
  // Before update 005 is installed there is no morning_list column: do nothing.
  if (error) return { error: error.message };
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return { sent: 0 };

  // Unticked "bring to court" items per hearing.
  const open = new Map<string, number>();
  const { data: itemRows } = await admin.from('hearing_items').select('event_id').eq('done', false).in('event_id', rows.map((r) => r.id));
  for (const r of (itemRows ?? []) as { event_id: string }[]) open.set(r.event_id, (open.get(r.event_id) ?? 0) + 1);

  // Group by lawyer, keeping only approved members of the same firm who want the list.
  const byLawyer = new Map<string, Row[]>();
  for (const r of rows) {
    const l = r.lawyer;
    if (!l || l.firm_id !== r.firm_id || l.status === 'pending' || l.morning_list === false) continue;
    const list = byLawyer.get(r.lawyer_id) ?? [];
    list.push(r);
    byLawyer.set(r.lawyer_id, list);
  }

  let pushUsers = new Set<string>();
  if (opts.push && byLawyer.size) {
    const { data: subs } = await admin.from('push_subscriptions').select('user_id').in('user_id', Array.from(byLawyer.keys()));
    pushUsers = new Set((subs ?? []).map((s) => s.user_id as string));
  }

  const day = ymd(now);
  let sent = 0;
  let failed = 0;
  for (const [userId, list] of byLawyer) {
    const lawyer = list[0].lawyer!;
    const items: MorningItem[] = list.map((r) => ({
      at: new Date(r.starts_at),
      type: r.type,
      title: r.title,
      suit: r.matter?.suit_number ?? null,
      where: [r.court, r.courtroom].filter(Boolean).join(', '),
      purpose: r.purpose,
      openItems: open.get(r.id) ?? 0,
    }));
    const text = morningText(lawyer.full_name, now, items);
    const channels: { channel: string; send: () => Promise<{ ok: boolean; detail: string }> }[] = [];
    const phone = normalisePhone(lawyer.phone);
    if (opts.sms && phone) channels.push({ channel: 'sms', send: async () => { const r = await sendMessage(phone, text); return { ok: r.ok, detail: r.detail }; } });
    if (opts.push && pushUsers.has(userId)) {
      channels.push({
        channel: 'push',
        send: async () => {
          const n = await sendPushToUser(userId, {
            title: `Today: ${list.length} item${list.length === 1 ? '' : 's'} in your diary`,
            body: text.split('\n').slice(1).join('\n'),
            url: '/today',
            tag: `morning-${day}`,
          });
          return { ok: n > 0, detail: `${n} device(s)` };
        },
      });
    }
    for (const c of channels) {
      // Claim first: a second run the same morning finds the row and skips.
      const { data: claimed, error: claimErr } = await admin
        .from('morning_list_log')
        .insert({ user_id: userId, firm_id: list[0].firm_id, day, channel: c.channel, status: 'pending' })
        .select('id')
        .maybeSingle();
      if (claimErr || !claimed) continue;
      let res: { ok: boolean; detail: string };
      try {
        res = await c.send();
      } catch (e) {
        res = { ok: false, detail: e instanceof Error ? e.message : 'Send failed' };
      }
      await admin.from('morning_list_log').update({ status: res.ok ? 'sent' : 'failed', detail: res.detail.slice(0, 300) }).eq('id', claimed.id);
      if (res.ok) sent++; else failed++;
    }
  }
  return { sent, failed, lawyers: byLawyer.size };
}
