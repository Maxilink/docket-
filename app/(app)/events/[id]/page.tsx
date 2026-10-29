import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember, getStaff } from '@/lib/session';
import { EVENT_SELECT, Pill, TypeTag, eventStatus } from '@/components/EventBits';
import DeleteButton from '@/components/DeleteButton';
import { canDelete, OUTCOME_LABEL } from '@/lib/constants';
import RemindClient from '@/components/RemindClient';
import { clientUpcomingText } from '@/lib/messages';
import { fmtDateLong, fmtTime, startOfDay } from '@/lib/time';
import type { DiaryEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EventPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { supabase, profile, firm } = await requireMember();
  const [{ data }, staff] = await Promise.all([supabase.from('events').select(EVENT_SELECT).eq('id', params.id).maybeSingle(), getStaff(supabase)]);
  if (!data) notFound();
  const e = data as unknown as DiaryEvent;
  const now = new Date();
  const at = new Date(e.starts_at);
  const past = at < now;
  const st = eventStatus(e, now);
  const canRecord = !e.outcome && startOfDay(at) <= startOfDay(now);
  const name = (id: string | null) => staff.find((s) => s.id === id)?.full_name;
  type NextRef = { id: string; starts_at: string; purpose: string | null };
  let nextEvent: NextRef | null = null;
  if (e.next_event_id) {
    const { data: n } = await supabase.from('events').select('id, starts_at, purpose').eq('id', e.next_event_id).maybeSingle();
    nextEvent = (n as NextRef | null) ?? null;
  }

  const facts: [string, string | null | undefined, boolean?][] = [
    ['Date', fmtDateLong(at)],
    ['Time', fmtTime(at)],
    ['Suit / case no.', e.matter?.suit_number, true],
    [e.type === 'filing' ? 'What to file' : 'Fixed for', e.purpose],
    ['Court', e.court],
    ['Courtroom', e.courtroom],
    ['Counsel', name(e.lawyer_id)],
    ['Reminders', [e.remind_day && '1 day before', e.remind_hour && '1 hour before', e.remind_client && 'client the day before'].filter(Boolean).join(', ') || 'None'],
    ['Notes and documents', e.notes],
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href={e.matter ? `/matters/${e.matter.id}` : '/calendar'} className="text-sm text-muted hover:underline">← {e.matter ? e.matter.title : 'Calendar'}</Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type={e.type} />
          <Pill tone={st.tone}>{st.label}</Pill>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-tight">{e.title}</h1>
      </header>

      {canRecord && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-line bg-warn-soft px-5 py-4">
          <p className="text-sm text-[#5C3A1E]"><strong className="text-warn">What happened?</strong> Record the outcome and fix the next date.</p>
          <Link href={`/events/${e.id}/outcome`} className="btn-primary">Record outcome</Link>
        </div>
      )}

      {e.outcome && (
        <section className="rounded-xl border border-accent bg-accent-soft px-5 py-4">
          <p className="label-caps text-accent-ink">Outcome</p>
          <p className="font-display text-xl">{OUTCOME_LABEL[e.outcome]}</p>
          {e.outcome_note && <p className="mt-1 whitespace-pre-wrap text-sm">{e.outcome_note}</p>}
          {nextEvent && (
            <p className="mt-2 text-sm">
              Next date:{' '}
              <Link href={`/events/${nextEvent.id}`} className="font-semibold text-primary underline">
                {fmtDateLong(new Date(nextEvent.starts_at))}, {fmtTime(new Date(nextEvent.starts_at))}
              </Link>
              {nextEvent.purpose ? ` for ${nextEvent.purpose.toLowerCase()}` : ''}
            </p>
          )}
        </section>
      )}

      {!past && !e.outcome && e.matter?.client_phone && (
        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-bold">Remind the client</h2>
            <p className="text-sm text-muted">{e.matter.client_name || 'Client'} · +{e.matter.client_phone}{e.remind_client ? ' · An automatic reminder also goes out the day before.' : ''}</p>
          </div>
          <RemindClient
            eventId={e.id}
            clientName={e.matter.client_name}
            clientPhone={e.matter.client_phone}
            defaultText={clientUpcomingText(firm.name, e.matter.client_name, at, [e.court, e.courtroom].filter(Boolean).join(', '), e.purpose, e.matter.suit_number)}
          />
        </section>
      )}

      <section className="card p-5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
          {facts.filter(([, v]) => v).map(([k, v, mono]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className={`whitespace-pre-wrap break-words ${mono ? 'font-mono' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {past ? (
        <p className="rounded-lg bg-primary-100 px-4 py-3 text-sm text-primary">This event has passed, so its details can no longer be edited.{!e.outcome ? ' You can still record its outcome.' : ''}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!past && <Link href={`/events/${e.id}/edit`} className="btn-primary">Edit</Link>}
        {canDelete(profile.role) && <DeleteButton kind="event" id={e.id} after={e.matter ? `/matters/${e.matter.id}` : '/calendar'} label="Delete this event for everyone?" />}
      </div>
    </div>
  );
}
