'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { COURTS, SOURCE, findTimeline } from '@/lib/timelines';
import { computeDeadline, fmtDay, type Closure } from '@/lib/deadlines';

interface Props {
  matters: { id: string; title: string; suit_number: string | null; court: string | null }[];
  closures: Closure[];
  today: string;
  initialMatter: string;
  initialRule: string;
}

export default function DeadlineCalculator({ matters, closures, today, initialMatter, initialRule }: Props) {
  const start = findTimeline(initialRule);
  const [courtId, setCourtId] = useState(start?.court.id ?? COURTS[1].id);
  const court = COURTS.find((c) => c.id === courtId)!;
  const [ruleId, setRuleId] = useState(start?.t.id ?? '');
  const rule = court.timelines.find((t) => t.id === ruleId) ?? null;
  const [trigger, setTrigger] = useState('');
  const [matterId, setMatterId] = useState(initialMatter);
  const [pick, setPick] = useState<'earlier' | 'next'>('earlier');

  const result = useMemo(() => {
    if (!rule?.calc || !/^\d{4}-\d{2}-\d{2}$/.test(trigger)) return null;
    return computeDeadline(rule.calc, trigger, closures, court.strict);
  }, [rule, trigger, closures, court.strict]);

  const due = result ? (result.moved && rule?.calc?.dir === 'after' ? (pick === 'earlier' ? result.moved.earlier : result.moved.next) : result.due) : null;
  const passed = Boolean(due && due < today);
  const matter = matters.find((m) => m.id === matterId);

  const addHref = (() => {
    if (!due || !rule || passed) return null;
    const notes = [
      `Rule (${court.name}): ${rule.rule}`,
      `${rule.calc?.from}: ${fmtDay(trigger)}.`,
      result?.explain,
      result?.moved ? `${fmtDay(result.moved.from)} is a ${result.moved.reason === 'Saturday' || result.moved.reason === 'Sunday' ? result.moved.reason : `closed day (${result.moved.reason})`}; diary date set to ${fmtDay(due)}.` : '',
      'Worked out by the C-Diary deadline calculator. Check against the rules of court.',
    ].filter(Boolean).join('\n');
    const q = new URLSearchParams({ date: due, type: 'filing', purpose: rule.process, notes, time: '09:00' });
    if (matterId) q.set('matter', matterId);
    else q.set('title', rule.process);
    return `/events/new?${q.toString()}`;
  })();

  return (
    <section className="card flex flex-col gap-5 p-5 sm:p-6" aria-label="Deadline calculator">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <label className="field" htmlFor="dl-court">Court
          <select id="dl-court" className="input" value={courtId} onChange={(e) => { setCourtId(e.target.value); setRuleId(''); }}>
            {COURTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="dl-matter">Matter (optional)
          <select id="dl-matter" className="input" value={matterId} onChange={(e) => setMatterId(e.target.value)}>
            <option value="">No matter</option>
            {matters.map((m) => <option key={m.id} value={m.id}>{m.title}{m.suit_number ? ` (${m.suit_number})` : ''}</option>)}
          </select>
        </label>
      </div>

      <label className="field" htmlFor="dl-rule">What are you filing?
        <select id="dl-rule" className="input" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
          <option value="">Choose a process</option>
          {court.timelines.map((t) => <option key={t.id} value={t.id}>{t.process}</option>)}
        </select>
      </label>

      {rule && (
        <div className="rounded-xl bg-primary-50 px-4 py-3 text-[15px]">
          <p className="font-semibold text-primary">The rule</p>
          <p className="text-ink">{rule.rule}</p>
          {rule.note && <p className="mt-1 text-sm text-muted">{rule.note}</p>}
        </div>
      )}

      {rule && !rule.calc && (
        <p className="text-sm text-muted">This process has no fixed period to count, so there is no date to work out.</p>
      )}

      {rule?.calc && (
        <label className="field max-w-xs" htmlFor="dl-trigger">{rule.calc.from}
          <input id="dl-trigger" type="date" className="input" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
        </label>
      )}

      {result && due && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-white p-4 sm:p-5" aria-live="polite">
          <div>
            <p className="text-sm font-semibold text-muted">{rule?.calc?.dir === 'after' ? 'Last day to file' : 'File on or before'}</p>
            <p className={`font-display text-3xl font-bold tracking-tight ${passed ? 'text-hearing' : 'text-primary'}`}>{fmtDay(due)}</p>
            {passed && <p className="mt-1 font-semibold text-hearing">This date has passed. Speak to counsel about an application for extension of time.</p>}
          </div>
          <p className="text-[15px] text-ink">{result.explain}</p>

          {result.moved && rule?.calc?.dir === 'after' && (
            <fieldset className="flex flex-col gap-2 rounded-xl bg-warn-soft px-4 py-3">
              <legend className="sr-only">Which date to use</legend>
              <p className="text-sm text-warn">
                {fmtDay(result.moved.from)} is {result.moved.reason === 'Saturday' || result.moved.reason === 'Sunday' ? 'a ' : ''}{result.moved.reason}, when the registry is closed. Choose the date to put in the diary:
              </p>
              <label className="flex items-start gap-2 text-[15px]">
                <input type="radio" name="dl-pick" checked={pick === 'earlier'} onChange={() => setPick('earlier')} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
                The open day before: {fmtDay(result.moved.earlier)} (safer)
              </label>
              <label className="flex items-start gap-2 text-[15px]">
                <input type="radio" name="dl-pick" checked={pick === 'next'} onChange={() => setPick('next')} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
                The next open day: {fmtDay(result.moved.next)}
              </label>
            </fieldset>
          )}
          {result.moved && rule?.calc?.dir !== 'after' && (
            <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{fmtDay(result.moved.from)} is {result.moved.reason}, so the date is brought forward to the open day before it.</p>
          )}
          {result.landsOnClosed && (
            <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
              This falls on {result.landsOnClosed}. Election timelines are strict and are not extended, so file before then.
            </p>
          )}
          {result.crosses.length > 0 && (
            <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
              This period runs through {result.crosses.join(' and ')}. Check whether time runs during it under the rules of this court.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {addHref && (
              <Link href={addHref} className="btn-primary">
                Add to diary{matter ? ` for ${matter.title.length > 28 ? `${matter.title.slice(0, 28)}…` : matter.title}` : ''}
              </Link>
            )}
            <span className="text-xs text-muted">You can check and change the details before saving.</span>
          </div>
        </div>
      )}

      <p className="border-t border-line pt-4 text-xs text-muted">
        Source: {SOURCE}. Days are counted from the day after the event unless the rule says otherwise. Public holidays with fixed dates are
        built in; add Sallah, Maulud and other announced holidays under Court closures. Always check the date against the current rules of court.
      </p>
    </section>
  );
}
