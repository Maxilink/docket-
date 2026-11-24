'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fixedHolidays, fmtDay, type Closure } from '@/lib/deadlines';

interface Props {
  closures: (Closure & { id: string; created_by: string | null })[];
  today: string;
  userId: string;
  canRemoveAny: boolean;
  needsSql: boolean;
}

export default function ClosuresPanel({ closures, today, userId, canRemoveAny, needsSql }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<'closed' | 'vacation'>('closed');
  const [showHolidays, setShowHolidays] = useState(false);

  const upcoming = closures.filter((c) => c.ends_on >= today);
  const year = Number(today.slice(0, 4));
  const holidays = [year, year + 1].flatMap((y) => Object.entries(fixedHolidays(y))).filter(([d]) => d >= today).sort(([a], [b]) => a.localeCompare(b)).slice(0, 10);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const end = to || from;
    if (!label.trim() || !from) return setError('Add a name and the first day.');
    if (end < from) return setError('The last day can’t be before the first day.');
    start(async () => {
      const { error: err } = await createClient().from('court_closures').insert({ label: label.trim().slice(0, 80), starts_on: from, ends_on: end, kind });
      if (err) return setError(err.message.includes('check') ? 'A closure can be at most 120 days long.' : 'That didn’t save. Try again.');
      setLabel(''); setFrom(''); setTo('');
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const { error: err } = await createClient().from('court_closures').delete().eq('id', id);
      if (err) return setError('That didn’t delete. Try again.');
      router.refresh();
    });
  }

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="closures-h">
      <div>
        <h2 id="closures-h" className="font-display text-lg font-bold">Court closures</h2>
        <p className="text-sm text-muted">
          Days the registry is shut, such as Sallah and Maulud once announced, and court vacations. The calculator takes them into account for the whole firm.
        </p>
      </div>

      {needsSql ? (
        <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Run update 007 in Supabase to add court closures.</p>
      ) : (
        <>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">No closures added yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {upcoming.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.label}</p>
                    <p className="text-sm text-muted">
                      {c.starts_on === c.ends_on ? fmtDay(c.starts_on) : `${fmtDay(c.starts_on)} to ${fmtDay(c.ends_on)}`}
                      {c.kind === 'vacation' ? ', vacation' : ', registry closed'}
                    </p>
                  </div>
                  {(canRemoveAny || c.created_by === userId) && (
                    <button type="button" onClick={() => remove(c.id)} disabled={pending} className="shrink-0 rounded-lg px-2 py-1 text-sm text-hearing hover:bg-hearing-soft">
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={add} className="flex flex-col gap-3 border-t border-line pt-4">
            <label className="field" htmlFor="cl-label">Name
              <input id="cl-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. Eid el-Fitr, Christmas vacation" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field" htmlFor="cl-from">First day
                <input id="cl-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field" htmlFor="cl-to">Last day
                <input id="cl-to" type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium text-muted">Kind</legend>
              <label className="flex items-center gap-2 text-[15px]"><input type="radio" name="cl-kind" checked={kind === 'closed'} onChange={() => setKind('closed')} className="h-5 w-5 accent-primary" /> Registry closed (public holiday, strike)</label>
              <label className="flex items-center gap-2 text-[15px]"><input type="radio" name="cl-kind" checked={kind === 'vacation'} onChange={() => setKind('vacation')} className="h-5 w-5 accent-primary" /> Court vacation</label>
            </fieldset>
            {error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
            <button type="submit" className="btn-primary self-start" disabled={pending}>{pending ? 'Adding…' : 'Add closure'}</button>
          </form>
        </>
      )}

      <div className="border-t border-line pt-3">
        <button type="button" className="text-left text-sm font-semibold text-primary hover:underline" aria-expanded={showHolidays} onClick={() => setShowHolidays((s) => !s)}>
          {showHolidays ? 'Hide' : 'Show'} public holidays already included
        </button>
        {showHolidays && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {holidays.map(([d, name]) => <li key={d}>{fmtDay(d)}: {name}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
