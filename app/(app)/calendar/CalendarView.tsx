'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EVENT_TYPES, OUTCOME_LABEL, typeName } from '@/lib/constants';
import { MONTHS, fmtDateLong, fmtTime, ymd, addDays, parts } from '@/lib/time';
import type { DiaryEvent, EventType } from '@/lib/types';

interface Props {
  year: number;
  month: number;
  gridStart: string;
  today: string;
  initialSelected: string;
  events: DiaryEvent[];
  staff: { id: string; name: string }[];
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function CalendarView({ year, month, gridStart, today, initialSelected, events, staff }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected);
  const [hidden, setHidden] = useState<Partial<Record<EventType, boolean>>>({});
  const [tip, setTip] = useState<{ key: string; x: number; y: number; above: boolean } | null>(null);

  const shown = useMemo(() => events.filter((e) => !hidden[e.type]), [events, hidden]);
  const byDay = useMemo(() => {
    const map: Record<string, DiaryEvent[]> = {};
    for (const e of shown) (map[ymd(new Date(e.starts_at))] ||= []).push(e);
    return map;
  }, [shown]);

  const start = new Date(gridStart);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i);
    const p = parts(d);
    return { key: ymd(d), day: p.d, inMonth: p.m === month, date: d };
  });
  const lastRowNeeded = cells.slice(35).some((c) => c.inMonth);
  const visibleCells = lastRowNeeded ? cells : cells.slice(0, 35);

  const prev = month === 0 ? `${year - 1}-12` : `${year}-${pad(month)}`;
  const next = month === 11 ? `${year + 1}-01` : `${year}-${pad(month + 2)}`;
  const selList = byDay[selected] ?? [];
  const selDate = new Date(`${selected}T12:00:00+01:00`);
  const lawyer = (id: string | null) => staff.find((s) => s.id === id)?.name;
  const tipList = tip ? byDay[tip.key] ?? [] : [];

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/calendar?m=${prev}`} aria-label="Previous month" className="btn-ghost w-11 px-0">‹</Link>
          <h1 className="text-gradient min-w-[200px] text-center font-display text-3xl font-bold tracking-tight">{MONTHS[month]} {year}</h1>
          <Link href={`/calendar?m=${next}`} aria-label="Next month" className="btn-ghost w-11 px-0">›</Link>
          <Link href="/calendar" className="btn-ghost">Today</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => {
            const on = !hidden[t];
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setHidden((h) => ({ ...h, [t]: on }))}
                className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-sm ${on ? 'border-primary-200 bg-primary-100 text-ink' : 'border-line bg-white text-muted'} transition hover:-translate-y-px hover:border-primary-200 hover:bg-primary-50`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${EVENT_TYPES[t].dot}`} />
                {EVENT_TYPES[t].label}
              </button>
            );
          })}
          <Link href={`/events/new?date=${selected >= today ? selected : today}`} className="btn-primary">+ New event</Link>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Month" className="card min-w-0 flex-[999_1_600px] overflow-hidden shadow-lift">
          <div className="grid grid-cols-7 border-b border-line bg-gradient-to-r from-primary to-primary-600">
            {DOW.map((d) => (
              <span key={d} className="label-caps px-2 py-2.5 text-primary-100">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {visibleCells.map((c, i) => {
              const list = byDay[c.key] ?? [];
              const isToday = c.key === today;
              const isSel = c.key === selected;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-label={`${fmtDateLong(c.date)}${list.length ? `, ${list.length} event${list.length > 1 ? 's' : ''}` : ''}`}
                  aria-pressed={isSel}
                  onClick={() => {
                    setSelected(c.key);
                    if (!c.inMonth) router.push(`/calendar?m=${c.key.slice(0, 7)}&d=${c.key}`);
                  }}
                  onDoubleClick={() => { if (c.key >= today) router.push(`/events/new?date=${c.key}`); }}
                  onMouseEnter={(ev) => {
                    if (!list.length) return setTip(null);
                    const r = ev.currentTarget.getBoundingClientRect();
                    const above = r.bottom + 220 > window.innerHeight;
                    setTip({ key: c.key, x: Math.min(Math.max(8, r.left + r.width / 2 - 150), window.innerWidth - 308), y: above ? r.top - 6 : r.bottom + 6, above });
                  }}
                  onMouseLeave={() => setTip(null)}
                  className={`relative flex min-h-[64px] min-w-0 flex-col gap-1 border-line p-1.5 text-left sm:min-h-[112px] ${i % 7 !== 6 ? 'border-r' : ''} ${i < visibleCells.length - 7 ? 'border-b' : ''} group transition-colors duration-150 ${c.inMonth ? 'bg-white hover:bg-primary-50' : 'bg-canvas text-muted/70 hover:bg-primary-50/60'} ${isSel ? 'z-[1] ring-2 ring-inset ring-primary' : ''}`}
                >
                  <span className="relative w-fit">
                    <span className={`tabular grid h-7 w-7 place-items-center rounded-full text-[13px] transition-transform duration-150 group-hover:scale-110 ${isToday ? 'bg-gradient-to-br from-accent-300 to-accent font-bold text-primary shadow-glow' : 'font-medium group-hover:bg-white'}`}>{c.day}</span>
                    {list.length > 0 && (
                      // Hotspot: purple for today and upcoming days, faded orange for past days.
                      <span
                        aria-hidden="true"
                        className={`absolute -right-1 -top-0.5 h-3 w-3 rounded-full ring-2 ring-white ${c.key >= today ? 'bg-primary-600 shadow-[0_0_0_3px_rgba(91,27,184,0.18)]' : 'bg-[#F59E0B] opacity-50'}`}
                      />
                    )}
                  </span>
                  <span className="hidden flex-col gap-1 sm:flex">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={`truncate rounded-md px-1.5 py-0.5 text-xs font-semibold transition hover:brightness-95 ${EVENT_TYPES[e.type].bg} ${EVENT_TYPES[e.type].text} ${e.outcome ? 'opacity-60' : ''}`}>
                        {fmtTime(new Date(e.starts_at)).replace(' ', '')} {e.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="pl-1 text-[11px] text-muted">+{list.length - 3} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside aria-label="Selected day" className="card min-w-0 flex-[1_1_300px] overflow-hidden">
          <div className="border-b border-line bg-gradient-to-br from-primary-50 to-white px-5 py-4">
            <p className="label-caps text-accent-ink">{selected === today ? 'Today' : selected < today ? 'Past day' : 'Upcoming'}</p>
            <h2 className="font-display text-xl font-bold tracking-tight">{fmtDateLong(selDate)}</h2>
          </div>
          {selList.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted">
              <p className="font-semibold text-ink">Nothing scheduled</p>
              {selected >= today ? <p>Double-click a day, or use New event.</p> : <p>No events were held on this day.</p>}
            </div>
          ) : (
            <ul className="flex flex-col p-2">
              {selList.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className={`my-1 flex flex-col gap-0.5 rounded-xl border-l-[3px] px-3 py-2.5 transition duration-200 hover:translate-x-1 hover:bg-primary-50 hover:shadow-sm ${EVENT_TYPES[e.type].border}`}>
                    <span className={`label-caps ${EVENT_TYPES[e.type].text}`}>{typeName(e)} · {fmtTime(new Date(e.starts_at))}</span>
                    <span className="font-semibold leading-snug">{e.title}</span>
                    {e.matter?.suit_number && <span className="font-mono text-[13px] text-primary-600">{e.matter.suit_number}</span>}
                    <span className="text-[13px] text-muted">{[[e.court, e.courtroom].filter(Boolean).join(', '), lawyer(e.lawyer_id)].filter(Boolean).join(' · ')}</span>
                    {e.outcome && <span className="text-[13px] font-medium text-accent-ink">{OUTCOME_LABEL[e.outcome]}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {tip && tipList.length > 0 && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-40 w-[300px] rounded-2xl bg-primary p-3 text-[13px] text-white shadow-[0_20px_40px_-16px_rgba(46,5,98,0.7)]"
          style={{ left: tip.x, top: tip.y, transform: tip.above ? 'translateY(-100%)' : undefined }}
        >
          <p className="label-caps mb-1.5 text-primary-200">{fmtDateLong(new Date(`${tip.key}T12:00:00+01:00`))}</p>
          {tipList.slice(0, 5).map((e) => (
            <div key={e.id} className="grid grid-cols-[60px_minmax(0,1fr)] gap-2 border-t border-white/15 py-1.5 first-of-type:border-t-0">
              <span className="tabular font-semibold text-accent">{fmtTime(new Date(e.starts_at))}</span>
              <span className="min-w-0">
                <span className="block font-semibold leading-snug">{e.title}</span>
                <span className="block text-primary-100">{[typeName(e), e.matter?.suit_number, e.court, lawyer(e.lawyer_id)].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          ))}
          {tipList.length > 5 && <p className="text-primary-100">+{tipList.length - 5} more. Click the day to see all.</p>}
        </div>
      )}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-full bg-primary-600" /> Upcoming events</span>
        <span className="inline-flex items-center gap-1.5"><i className="block h-2.5 w-2.5 rounded-full bg-[#F59E0B] opacity-50" /> Past events</span>
        <span>Times are Nigerian time (WAT). Hover a day to preview it; double-click a future day to add an event.</span>
      </p>
    </>
  );
}
