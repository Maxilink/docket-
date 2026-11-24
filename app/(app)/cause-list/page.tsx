import Link from 'next/link';
import { requireMember, getStaff } from '@/lib/session';
import PrintButton from '@/components/PrintButton';
import { EVENT_TYPES } from '@/lib/constants';
import { addDays, fmtTime, lagos, MONTHS, parts, startOfDay, WEEKDAYS, ymd } from '@/lib/time';

export const metadata = { title: 'Cause list' };
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  type: 'hearing' | 'filing';
  title: string;
  starts_at: string;
  purpose: string | null;
  court: string | null;
  courtroom: string | null;
  lawyer_id: string | null;
  matter: { id: string; suit_number: string | null; judge: string | null } | null;
}

/** Monday of the week containing d (Nigerian time). */
function mondayOf(d: Date) {
  const p = parts(d);
  return lagos(p.y, p.m, p.d - ((p.dow + 6) % 7));
}

const range = (a: Date, b: Date) => {
  const pa = parts(a);
  const pb = parts(b);
  return pa.m === pb.m
    ? `${pa.d}–${pb.d} ${MONTHS[pb.m]} ${pb.y}`
    : `${pa.d} ${MONTHS[pa.m].slice(0, 3)} – ${pb.d} ${MONTHS[pb.m].slice(0, 3)} ${pb.y}`;
};

export default async function CauseListPage(props: { searchParams: Promise<{ week?: string; scope?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, profile, firm } = await requireMember();
  const mine = searchParams.scope === 'mine';
  const pick = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.week ?? '') ? new Date(`${searchParams.week}T12:00:00+01:00`) : new Date();
  const start = mondayOf(isNaN(pick.getTime()) ? new Date() : pick);
  const end = addDays(start, 7);

  let q = supabase
    .from('events')
    .select('id, type, title, starts_at, purpose, court, courtroom, lawyer_id, matter:matters(id, suit_number, judge)')
    .in('type', ['hearing', 'filing'])
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .order('starts_at');
  if (mine) q = q.eq('lawyer_id', profile.id);
  const [{ data }, staff] = await Promise.all([q, getStaff(supabase)]);
  const rows = (data ?? []) as unknown as Row[];

  // "Bring to court" readiness per hearing (if update 005 is installed).
  const ready = new Map<string, { done: number; total: number }>();
  if (rows.length) {
    const { data: items, error } = await supabase.from('hearing_items').select('event_id, done').in('event_id', rows.map((r) => r.id));
    if (!error) {
      for (const it of (items ?? []) as { event_id: string; done: boolean }[]) {
        const x = ready.get(it.event_id) ?? { done: 0, total: 0 };
        x.total++;
        if (it.done) x.done++;
        ready.set(it.event_id, x);
      }
    }
  }

  const name = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? '—';
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    .map((d) => ({ d, list: rows.filter((r) => startOfDay(new Date(r.starts_at)).getTime() === startOfDay(d).getTime()) }))
    .filter((x, i) => i < 5 || x.list.length > 0); // weekends only when something is on
  const today = ymd(new Date());
  const qs = (week: Date) => `/cause-list?week=${ymd(week)}${mine ? '&scope=mine' : ''}`;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 print:block">
        <div>
          <p className="label-caps text-accent-ink print:text-black">{firm.name}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Cause list</h1>
          <p className="text-muted print:text-black">
            {range(start, addDays(start, days.length > 5 ? 6 : 4))} · {rows.length} {rows.length === 1 ? 'item' : 'items'}{mine ? ` · ${profile.full_name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link href={qs(addDays(start, -7))} className="btn-ghost w-11 px-0" aria-label="Previous week">‹</Link>
          <Link href={qs(mondayOf(new Date()))} className="btn-ghost">This week</Link>
          <Link href={qs(addDays(start, 7))} className="btn-ghost w-11 px-0" aria-label="Next week">›</Link>
          <div role="group" aria-label="Whose list" className="flex overflow-hidden rounded-xl border border-line bg-white">
            <Link href={`/cause-list?week=${ymd(start)}`} className={`px-4 py-2.5 text-sm ${!mine ? 'bg-primary font-semibold text-white' : 'text-muted hover:bg-primary-50'}`}>Whole firm</Link>
            <Link href={`/cause-list?week=${ymd(start)}&scope=mine`} className={`px-4 py-2.5 text-sm ${mine ? 'bg-primary font-semibold text-white' : 'text-muted hover:bg-primary-50'}`}>Mine</Link>
          </div>
          <PrintButton />
        </div>
      </header>

      <div className="flex flex-col gap-5 print:gap-3">
        {days.map(({ d, list }) => {
          const p = parts(d);
          const isToday = ymd(d) === today;
          return (
            <section key={ymd(d)} className={`card overflow-hidden print:break-inside-avoid print:rounded-none print:border-black/40 ${isToday ? 'border-primary-200 shadow-lift' : ''}`}>
              <div className={`flex items-baseline justify-between gap-3 px-5 py-3 print:bg-white print:px-2 print:py-1.5 ${isToday ? 'bg-gradient-to-r from-primary to-primary-600 text-white' : 'bg-gradient-to-r from-primary-100 to-primary-50'}`}>
                <h2 className="font-display text-lg font-bold print:text-black">{WEEKDAYS[p.dow]} {p.d} {MONTHS[p.m]}{isToday ? ' · Today' : ''}</h2>
                <span className={`text-sm print:text-black ${isToday ? 'text-primary-100' : 'text-muted'}`}>{list.length ? `${list.length} ${list.length === 1 ? 'item' : 'items'}` : 'Nothing listed'}</span>
              </div>
              {list.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm print:min-w-0 print:text-[11px]">
                    <thead className="text-muted print:text-black">
                      <tr className="border-b border-line">
                        <th className="label-caps px-5 py-2 font-semibold print:px-2">Time</th>
                        <th className="label-caps px-3 py-2 font-semibold">Matter</th>
                        <th className="label-caps px-3 py-2 font-semibold">Court</th>
                        <th className="label-caps px-3 py-2 font-semibold">For</th>
                        <th className="label-caps px-3 py-2 font-semibold">Counsel</th>
                        <th className="label-caps px-5 py-2 font-semibold print:px-2">Ready</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                      {list.map((r) => {
                        const rd = ready.get(r.id);
                        return (
                          <tr key={r.id} className="row-hover align-top print:hover:bg-white">
                            <td className="tabular whitespace-nowrap px-5 py-3 font-semibold print:px-2 print:py-1.5">{fmtTime(new Date(r.starts_at))}</td>
                            <td className="px-3 py-3 print:py-1.5">
                              <Link href={`/events/${r.id}`} className="font-semibold text-ink hover:underline">{r.title}</Link>
                              <div className="flex flex-wrap gap-x-2 text-[13px] print:text-[10px]">
                                {r.matter?.suit_number && <span className="font-mono text-primary-600 print:text-black">{r.matter.suit_number}</span>}
                                {r.type === 'filing' && <span className={`font-semibold ${EVENT_TYPES.filing.text}`}>Filing deadline</span>}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-muted print:py-1.5 print:text-black">
                              {[r.court, r.courtroom].filter(Boolean).join(', ') || '—'}
                              {r.matter?.judge && <div className="text-[13px] print:text-[10px]">{r.matter.judge}</div>}
                            </td>
                            <td className="px-3 py-3 print:py-1.5">{r.purpose || '—'}</td>
                            <td className="px-3 py-3 print:py-1.5">{name(r.lawyer_id)}</td>
                            <td className="whitespace-nowrap px-5 py-3 print:px-2 print:py-1.5">
                              {rd ? (
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${rd.done === rd.total ? 'bg-accent-soft text-accent-ink' : 'bg-warn-soft text-warn'} print:bg-white print:p-0 print:text-black`}>
                                  {rd.done}/{rd.total}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted print:text-black">Printed from C-Diary. Times are Nigerian time (WAT). &ldquo;Ready&rdquo; counts the bring-to-court items ticked off.</p>
    </>
  );
}
