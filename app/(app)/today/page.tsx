import Link from 'next/link';
import { requireMember, getStaff, firstName } from '@/lib/session';
import { EventRow, Empty, SectionCard, EVENT_SELECT, Pill } from '@/components/EventBits';
import { addDays, daysUntil, fmtDate, fmtDateLong, fmtTime, startOfDay } from '@/lib/time';
import type { DiaryEvent } from '@/lib/types';

export const metadata = { title: 'Today' };
export const dynamic = 'force-dynamic';

export default async function TodayPage({ searchParams }: { searchParams: { scope?: string } }) {
  const { supabase, profile, firm } = await requireMember();
  const mine = searchParams.scope !== 'all';
  const staff = await getStaff(supabase);
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (q: any) => (mine ? q.eq('lawyer_id', profile.id) : q);

  const [todayRes, awaitingRes, weekRes, deadlinesRes, mattersRes, upcomingMattersRes, remindersRes] = await Promise.all([
    scoped(supabase.from('events').select(EVENT_SELECT).gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString()).order('starts_at')),
    scoped(
      supabase
        .from('events')
        .select(EVENT_SELECT)
        .in('type', ['hearing', 'filing'])
        .is('outcome', null)
        .lt('starts_at', now.toISOString())
        .gte('starts_at', addDays(now, -90).toISOString())
        .order('starts_at', { ascending: false }),
    ),
    scoped(supabase.from('events').select('id, type').gte('starts_at', now.toISOString()).lt('starts_at', addDays(now, 7).toISOString())),
    scoped(
      supabase
        .from('events')
        .select(EVENT_SELECT)
        .eq('type', 'filing')
        .is('outcome', null)
        .gte('starts_at', now.toISOString())
        .lt('starts_at', addDays(now, 21).toISOString())
        .order('starts_at')
        .limit(6),
    ),
    supabase.from('matters').select('id, title, suit_number, lead_lawyer_id').eq('status', 'active'),
    supabase.from('events').select('matter_id').gte('starts_at', now.toISOString()).not('matter_id', 'is', null),
    supabase.from('reminder_log').select('id, kind, channel, recipient, status, created_at').gte('created_at', dayStart.toISOString()).order('created_at', { ascending: false }).limit(8),
  ]);

  const today = (todayRes.data ?? []) as unknown as DiaryEvent[];
  const awaitingEarlier = ((awaitingRes.data ?? []) as unknown as DiaryEvent[]).filter((e) => new Date(e.starts_at) < dayStart);
  const week = (weekRes.data ?? []) as { id: string; type: string }[];
  const deadlines = (deadlinesRes.data ?? []) as unknown as DiaryEvent[];
  const withNext = new Set(((upcomingMattersRes.data ?? []) as { matter_id: string }[]).map((r) => r.matter_id));
  const noNext = ((mattersRes.data ?? []) as { id: string; title: string; suit_number: string | null; lead_lawyer_id: string | null }[]).filter(
    (m) => !withNext.has(m.id) && (!mine || m.lead_lawyer_id === profile.id),
  );
  const reminders = (remindersRes.data ?? []) as { id: number; kind: string; channel: string; recipient: string; status: string; created_at: string }[];

  const stats = [
    { n: today.length, label: 'Events today' },
    { n: week.filter((w) => w.type === 'hearing').length, label: 'Hearings in the next 7 days' },
    { n: week.filter((w) => w.type === 'filing').length, label: 'Filing deadlines in the next 7 days' },
    { n: noNext.length, label: 'Active matters with no next date' },
  ];

  const kindLabel: Record<string, string> = { day: 'Day-before reminder', hour: 'Hour-before reminder', client_day: 'Client reminder', client_update: 'Client update', client_manual: 'Client reminder' };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{fmtDateLong(now)}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Good {greeting(now)}, {firstName(profile.full_name)}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Whose diary" className="flex overflow-hidden rounded-lg border border-line bg-white">
            <Link href="/today" aria-current={mine ? 'true' : undefined} className={`px-4 py-2.5 text-sm ${mine ? 'bg-primary font-medium text-white' : 'text-muted'}`}>My matters</Link>
            <Link href="/today?scope=all" aria-current={!mine ? 'true' : undefined} className={`px-4 py-2.5 text-sm ${!mine ? 'bg-primary font-medium text-white' : 'text-muted'}`}>Whole firm</Link>
          </div>
          <Link href="/events/new" className="btn-primary">+ New event</Link>
        </div>
      </header>

      {awaitingEarlier.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-line bg-warn-soft px-5 py-4">
          <div>
            <p className="font-semibold text-warn">
              {awaitingEarlier.length} past {awaitingEarlier.length === 1 ? 'event needs' : 'events need'} an outcome recorded
            </p>
            <p className="text-sm text-[#5C3A1E]">Record what happened so the next date is fixed and nobody forgets the file.</p>
          </div>
          <a href="#awaiting" className="font-semibold text-warn underline-offset-2 hover:underline">Show them</a>
        </div>
      )}

      <section aria-label="At a glance" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white px-5 py-4">
            <div className="tabular font-display text-3xl leading-tight">{s.n}</div>
            <div className="text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          <SectionCard title="Today's cause list" aside={`${today.length} ${today.length === 1 ? 'item' : 'items'}`}>
            {today.length ? (
              <ul>{today.map((e) => <EventRow key={e.id} e={e} staff={staff} now={now} firmName={firm.name} />)}</ul>
            ) : (
              <Empty title="Nothing in the diary today">
                <p>{mine ? 'Switch to Whole firm to see colleagues\' matters, or ' : ''}<Link href="/events/new" className="text-primary underline">add an event</Link>.</p>
              </Empty>
            )}
          </SectionCard>

          {awaitingEarlier.length > 0 && (
            <div id="awaiting">
              <SectionCard title="Awaiting outcome" aside="Last 90 days">
                <ul>{awaitingEarlier.map((e) => <EventRow key={e.id} e={e} staff={staff} showDate now={now} />)}</ul>
              </SectionCard>
            </div>
          )}

          {noNext.length > 0 && (
            <SectionCard title="Active matters with no next date">
              <ul className="divide-y divide-line/70">
                {noNext.slice(0, 8).map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/matters/${m.id}`} className="font-semibold hover:underline">{m.title}</Link>
                      {m.suit_number && <div className="font-mono text-[13px] text-primary-600">{m.suit_number}</div>}
                    </div>
                    <Link href={`/events/new?matter=${m.id}`} className="text-sm font-semibold text-primary hover:underline">Add next date</Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <SectionCard title="Filing deadlines" aside="Next 3 weeks">
            {deadlines.length ? (
              <ul className="divide-y divide-line/70">
                {deadlines.map((d) => {
                  const left = daysUntil(new Date(d.starts_at), now);
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <Link href={`/events/${d.id}`} className="font-medium leading-snug hover:underline">{d.title}</Link>
                        <div className="text-[13px] text-muted">{fmtDate(new Date(d.starts_at))}, {fmtTime(new Date(d.starts_at))}</div>
                      </div>
                      <Pill tone={left <= 2 ? 'danger' : left <= 7 ? 'warn' : 'neutral'}>{left <= 0 ? 'Today' : left === 1 ? '1 day' : `${left} days`}</Pill>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="No filing deadlines soon" />
            )}
          </SectionCard>

          <SectionCard title="Messages sent today">
            {reminders.length ? (
              <ul className="divide-y divide-line/70">
                {reminders.map((r) => (
                  <li key={r.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 px-5 py-2.5 text-sm">
                    <span className="tabular text-muted">{fmtTime(new Date(r.created_at))}</span>
                    <span>
                      <strong className={r.status === 'sent' ? 'text-accent-ink' : 'text-hearing'}>{r.status === 'sent' ? r.channel.toUpperCase() : 'Failed'}</strong> {kindLabel[r.kind] ?? r.kind} to +{r.recipient}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No reminders sent yet today">
                <p>SMS and WhatsApp reminders appear here once Termii is connected.</p>
              </Empty>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function greeting(d: Date) {
  const h = (d.getUTCHours() + 1) % 24;
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
