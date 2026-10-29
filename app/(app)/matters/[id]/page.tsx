import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember, getStaff } from '@/lib/session';
import { EVENT_SELECT, Pill, TypeTag, eventStatus } from '@/components/EventBits';
import DeleteButton from '@/components/DeleteButton';
import { canDelete, EVENT_TYPES } from '@/lib/constants';
import RemindClient from '@/components/RemindClient';
import { clientUpcomingText } from '@/lib/messages';
import { fmtDate, fmtDateLong, fmtTime, relDay } from '@/lib/time';
import type { DiaryEvent, Matter } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MatterPage({ params }: { params: { id: string } }) {
  const { supabase, profile, firm } = await requireMember();
  const [{ data }, staff, { data: evData }] = await Promise.all([
    supabase.from('matters').select('*').eq('id', params.id).maybeSingle(),
    getStaff(supabase),
    supabase.from('events').select(EVENT_SELECT).eq('matter_id', params.id).order('starts_at', { ascending: false }),
  ]);
  if (!data) notFound();
  const m = data as Matter;
  const events = (evData ?? []) as unknown as DiaryEvent[];
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.starts_at) >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = upcoming[0];
  const awaiting = events.find((e) => eventStatus(e, now).label === 'Awaiting outcome');
  const name = (id: string | null) => staff.find((s) => s.id === id)?.full_name;
  const hearings = events.filter((e) => e.type === 'hearing' && new Date(e.starts_at) < now);
  const adjournments = hearings.filter((e) => e.outcome === 'adjourned').length;

  const facts: [string, string | null | undefined][] = [
    ['Court', m.court],
    ['Courtroom', m.courtroom],
    ['Judge', m.judge],
    ['Lead counsel', name(m.lead_lawyer_id)],
    ['Client', m.client_name],
    ['Client phone', m.client_phone ? `+${m.client_phone}` : null],
    ['Opposing counsel', m.opposing_counsel],
    ['Hearings so far', `${hearings.length} (${adjournments} adjourned)`],
  ];

  return (
    <>
      <Link href="/matters" className="text-sm text-muted hover:underline">← Matters</Link>
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {m.suit_number && <span className="rounded bg-primary-100 px-2 py-0.5 font-mono text-sm text-primary">{m.suit_number}</span>}
            <Pill tone={m.status === 'active' ? 'good' : 'neutral'}>{m.status === 'active' ? 'Active' : 'Closed'}</Pill>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight leading-tight sm:text-4xl">{m.title}</h1>
          {m.description && <p className="whitespace-pre-wrap text-muted">{m.description}</p>}
          <div className="mt-1 flex flex-wrap gap-2">
            <Link href={`/events/new?matter=${m.id}`} className="btn-primary">+ Add date</Link>
            <Link href={`/matters/${m.id}/edit`} className="btn-ghost">Edit matter</Link>
            <Link href={`/messages?c=m:${m.id}`} className="btn-ghost">Team discussion</Link>
            {canDelete(profile.role) && <DeleteButton kind="matter" id={m.id} after="/matters" label="Delete this matter and all its dates?" />}
          </div>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-1.5 rounded-xl bg-primary p-5 text-white">
          {awaiting ? (
            <>
              <span className="label-caps text-accent">Awaiting outcome</span>
              <span className="font-display text-2xl">{relDay(new Date(awaiting.starts_at), now) || fmtDate(new Date(awaiting.starts_at))}, {fmtTime(new Date(awaiting.starts_at))}</span>
              <span className="text-sm text-[#D9D2EA]">{awaiting.purpose || EVENT_TYPES[awaiting.type].label}</span>
              <Link href={`/events/${awaiting.id}/outcome`} className="btn-accent mt-2">Record outcome</Link>
            </>
          ) : next ? (
            <>
              <span className="label-caps text-accent">Next date</span>
              <span className="font-display text-2xl">{relDay(new Date(next.starts_at), now) || fmtDateLong(new Date(next.starts_at))}, {fmtTime(new Date(next.starts_at))}</span>
              <span className="text-sm text-[#D9D2EA]">{[next.purpose, [next.court, next.courtroom].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
              <Link href={`/events/${next.id}`} className="btn-accent mt-2">Open</Link>
            </>
          ) : (
            <>
              <span className="label-caps text-accent">Next date</span>
              <span className="font-display text-2xl">None fixed</span>
              <span className="text-sm text-[#D9D2EA]">{m.status === 'active' ? 'Add the next hearing so this file isn\'t forgotten.' : 'This matter is closed.'}</span>
              {m.status === 'active' && <Link href={`/events/new?matter=${m.id}`} className="btn-accent mt-2">Add next date</Link>}
            </>
          )}
        </div>
      </header>

      {next && m.client_phone && (next.type === 'hearing' || next.type === 'client') && (
        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-bold">Remind the client</h2>
            <p className="text-sm text-muted">
              {m.client_name || 'Client'} · +{m.client_phone} · Next date {fmtDateLong(new Date(next.starts_at))}, {fmtTime(new Date(next.starts_at))}
            </p>
          </div>
          <RemindClient
            eventId={next.id}
            clientName={m.client_name}
            clientPhone={m.client_phone}
            defaultText={clientUpcomingText(firm.name, m.client_name, new Date(next.starts_at), [next.court, next.courtroom].filter(Boolean).join(', '), next.purpose, m.suit_number)}
          />
        </section>
      )}

      <section aria-label="Case details" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0 bg-white px-4 py-3">
            <div className="text-xs text-muted">{k}</div>
            <div className="break-words font-medium">{v || '—'}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-bold tracking-tight">Proceedings</h2>
        </div>
        {events.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted">
            <p className="font-semibold text-ink">No dates yet</p>
            <p>Add the first hearing or filing deadline for this matter.</p>
          </div>
        ) : (
          <ol className="px-5 py-3">
            {events.map((e, i) => {
              const st = eventStatus(e, now);
              const d = new Date(e.starts_at);
              const nextOf = e.next_event_id ? events.find((x) => x.id === e.next_event_id) : null;
              return (
                <li key={e.id} className="grid grid-cols-[96px_20px_minmax(0,1fr)] gap-3 sm:grid-cols-[120px_20px_minmax(0,1fr)]">
                  <span className="tabular pt-3 text-sm text-muted">{fmtDate(d)}</span>
                  <span className="flex flex-col items-center">
                    <span className={`mt-4 h-3 w-3 rounded-full border-2 ${EVENT_TYPES[e.type].border} ${e.outcome || d < now ? EVENT_TYPES[e.type].dot : 'bg-white'}`} />
                    {i < events.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5 pb-5 pt-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeTag type={e.type} />
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                    <Link href={`/events/${e.id}`} className="font-semibold hover:underline">{e.purpose || e.title}</Link>
                    <span className="text-sm text-muted">{[fmtTime(d), [e.court, e.courtroom].filter(Boolean).join(', '), name(e.lawyer_id)].filter(Boolean).join(' · ')}</span>
                    {e.outcome_note && <p className="whitespace-pre-wrap text-sm">{e.outcome_note}</p>}
                    {nextOf && <span className="text-sm text-accent-ink">Next date: {fmtDateLong(new Date(nextOf.starts_at))}{nextOf.purpose ? ` for ${nextOf.purpose.toLowerCase()}` : ''}</span>}
                    {st.label === 'Awaiting outcome' && <Link href={`/events/${e.id}/outcome`} className="text-sm font-semibold text-primary hover:underline">Record outcome</Link>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
