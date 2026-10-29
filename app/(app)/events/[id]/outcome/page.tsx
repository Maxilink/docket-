import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireMember, getStaff } from '@/lib/session';
import { EVENT_SELECT } from '@/components/EventBits';
import { fmtTime, relDay, fmtDateLong, ymd, startOfDay, addDays } from '@/lib/time';
import { termiiConfigured } from '@/lib/termii';
import type { DiaryEvent } from '@/lib/types';
import OutcomeForm from './OutcomeForm';

export const metadata = { title: 'Record outcome' };
export const dynamic = 'force-dynamic';

export default async function OutcomePage({ params }: { params: { id: string } }) {
  const { supabase, firm } = await requireMember();
  const [{ data }, staff] = await Promise.all([supabase.from('events').select(EVENT_SELECT).eq('id', params.id).maybeSingle(), getStaff(supabase)]);
  if (!data) notFound();
  const e = data as unknown as DiaryEvent;
  const at = new Date(e.starts_at);
  const now = new Date();
  if (e.outcome || startOfDay(at) > startOfDay(now)) redirect(`/events/${e.id}`);
  const when = relDay(at, now) || fmtDateLong(at);

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/events/${e.id}`} className="text-sm text-muted hover:underline">← {e.title}</Link>
      <header className="flex flex-col gap-1">
        <p className="label-caps text-accent-ink">{when} · {fmtTime(at)}{e.courtroom ? ` · ${e.courtroom}` : ''}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">What happened?</h1>
        <p className="text-muted">
          {e.matter?.suit_number && <span className="font-mono text-primary-600">{e.matter.suit_number} · </span>}
          {e.title}{e.purpose ? ` · Fixed for ${e.purpose.toLowerCase()}` : ''}
        </p>
      </header>
      <OutcomeForm
        event={e}
        staff={staff}
        firmName={firm.name}
        clientPhone={e.matter?.client_phone ?? null}
        clientName={e.matter?.client_name ?? null}
        smsReady={termiiConfigured()}
        minDate={ymd(addDays(now, 1))}
      />
    </div>
  );
}
