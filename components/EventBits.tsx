import Link from 'next/link';
import { EVENT_TYPES, OUTCOME_LABEL } from '@/lib/constants';
import { fmtDate, fmtTime, relDay, parts, MONTHS } from '@/lib/time';
import type { DiaryEvent, Profile } from '@/lib/types';

export function TypeTag({ type }: { type: DiaryEvent['type'] }) {
  return <span className={`label-caps ${EVENT_TYPES[type].text}`}>{EVENT_TYPES[type].label}</span>;
}

export function Pill({ tone, children }: { tone: 'warn' | 'neutral' | 'good' | 'danger'; children: React.ReactNode }) {
  const cls = {
    warn: 'bg-warn-soft text-warn',
    neutral: 'bg-primary-100 text-primary',
    good: 'bg-accent-soft text-accent-ink',
    danger: 'bg-hearing-soft text-hearing',
  }[tone];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function eventStatus(e: DiaryEvent, now = new Date()) {
  const past = new Date(e.starts_at) < now;
  if (e.outcome) return { label: OUTCOME_LABEL[e.outcome], tone: 'good' as const };
  if (past && (e.type === 'hearing' || e.type === 'filing')) return { label: 'Awaiting outcome', tone: 'warn' as const };
  if (past) return { label: 'Past', tone: 'neutral' as const };
  return { label: 'Upcoming', tone: 'neutral' as const };
}

export function EventRow({ e, staff, showDate = false, now = new Date() }: { e: DiaryEvent; staff: Profile[]; showDate?: boolean; now?: Date }) {
  const d = new Date(e.starts_at);
  const p = parts(d);
  const lawyer = staff.find((s) => s.id === e.lawyer_id)?.full_name;
  const st = eventStatus(e, now);
  const needsOutcome = st.label === 'Awaiting outcome';
  const rel = relDay(d, now);
  return (
    <li className={`grid grid-cols-[64px_minmax(0,1fr)] gap-4 border-b border-line/70 px-5 py-4 last:border-b-0 sm:grid-cols-[72px_minmax(0,1fr)_auto]`}>
      <div className="tabular flex flex-col">
        {showDate ? (
          <>
            <span className="font-display text-2xl leading-none">{p.d}</span>
            <span className="label-caps text-muted">{MONTHS[p.m].slice(0, 3)}</span>
          </>
        ) : (
          <>
            <span className="font-display text-xl leading-tight">{fmtTime(d).split(' ')[0]}</span>
            <span className="label-caps text-muted">{fmtTime(d).split(' ')[1]}</span>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type={e.type} />
          {showDate && rel && <span className="text-xs font-semibold text-accent-ink">{rel}</span>}
        </div>
        <Link href={`/events/${e.id}`} className="font-semibold leading-snug hover:underline">{e.title}</Link>
        {e.matter?.suit_number && <span className="font-mono text-[13px] text-primary-600">{e.matter.suit_number}</span>}
        <span className="text-sm text-muted">
          {[showDate ? `${fmtDate(d)}, ${fmtTime(d)}` : null, [e.court, e.courtroom].filter(Boolean).join(', ') || null, e.purpose ? `For ${e.purpose.toLowerCase()}` : null, lawyer]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <div className="col-span-2 flex items-center gap-3 sm:col-span-1 sm:flex-col sm:items-end">
        <Pill tone={st.tone}>{st.label}</Pill>
        {needsOutcome && (
          <Link href={`/events/${e.id}/outcome`} className="whitespace-nowrap text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Record outcome
          </Link>
        )}
      </div>
    </li>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-8 text-sm text-muted">
      <p className="font-semibold text-ink">{title}</p>
      {children}
    </div>
  );
}

export function SectionCard({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card min-w-0">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-display text-xl font-normal">{title}</h2>
        {aside && <div className="text-sm text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export const EVENT_SELECT = 'id, firm_id, matter_id, type, title, starts_at, purpose, court, courtroom, lawyer_id, notes, remind_day, remind_hour, remind_client, outcome, outcome_note, outcome_recorded_at, next_event_id, created_at, matter:matters(id, title, suit_number, client_name, client_phone)';
