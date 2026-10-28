'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordOutcome } from '@/app/(app)/actions';
import { OUTCOMES, PURPOSES } from '@/lib/constants';
import { clientUpdateText } from '@/lib/messages';
import { fromInputs, fmtDateLong, fmtTime } from '@/lib/time';
import { useClashes, ClashWarning } from '@/components/useClashes';
import type { DiaryEvent, Outcome, Profile } from '@/lib/types';

interface Props {
  event: DiaryEvent;
  staff: Profile[];
  firmName: string;
  clientPhone: string | null;
  clientName: string | null;
  smsReady: boolean;
  minDate: string;
}

export default function OutcomeForm({ event, staff, firmName, clientPhone, clientName, smsReady, minDate }: Props) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>(event.type === 'hearing' ? 'adjourned' : 'held');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [purpose, setPurpose] = useState(event.purpose ?? '');
  const [notify, setNotify] = useState(Boolean(clientPhone));
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ nextId?: string; notified?: string } | null>(null);
  const [pending, start] = useTransition();

  const needsDate = OUTCOMES.find((o) => o.value === outcome)?.needsDate ?? false;
  const nextAt = needsDate ? fromInputs(date, time) : null;
  const clashes = useClashes(needsDate ? event.lawyer_id : null, date, time);
  const choices = event.type === 'hearing' ? OUTCOMES : OUTCOMES.filter((o) => ['held', 'adjourned', 'other'].includes(o.value));

  const draft = useMemo(
    () => clientUpdateText(firmName, event.matter?.suit_number ?? null, outcome, nextAt, outcome === 'reserved' ? null : purpose || null),
    [firmName, event.matter?.suit_number, outcome, nextAt?.getTime(), purpose], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => { if (!edited) setMessage(draft); }, [draft, edited]);

  const effects = [
    `Records this ${event.type === 'hearing' ? 'hearing' : 'event'} as "${OUTCOMES.find((o) => o.value === outcome)?.label}" in the case history`,
    ...(needsDate
      ? [
          nextAt ? `Creates the next hearing on ${fmtDateLong(nextAt)} at ${fmtTime(nextAt)}${outcome === 'reserved' ? ' for ruling' : purpose ? ` for ${purpose.toLowerCase()}` : ''}` : 'Creates the next hearing on the date you pick',
          'Copies the court, courtroom, counsel and reminders to it',
        ]
      : []),
    ...(outcome === 'settled' ? ['Closes the matter'] : []),
    ...(notify && clientPhone ? [`Sends ${clientName || 'the client'} the update below`] : []),
  ];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    start(async () => {
      const r = await recordOutcome(fd);
      if (r.error) return setError(r.error);
      setDone({ nextId: r.id, notified: r.notified });
      router.refresh();
    });
  }

  if (done) {
    return (
      <section role="status" className="card flex max-w-2xl flex-col gap-3 border-accent p-6">
        <p className="label-caps text-accent-ink">Outcome saved</p>
        <h2 className="font-display text-2xl font-normal">
          {needsDate && nextAt ? `${outcome === 'reserved' ? 'Reserved to' : 'Adjourned to'} ${fmtDateLong(nextAt)}` : OUTCOMES.find((o) => o.value === outcome)?.label}
        </h2>
        {done.notified && <p className="text-sm text-muted">{done.notified}</p>}
        <div className="flex flex-wrap gap-3">
          {done.nextId && <Link href={`/events/${done.nextId}`} className="btn-primary">Open next date</Link>}
          <Link href={event.matter ? `/matters/${event.matter.id}` : '/today'} className="btn-ghost">{event.matter ? 'View case file' : 'Back to today'}</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <form onSubmit={submit} className="card flex min-w-0 flex-[999_1_520px] flex-col gap-6 p-6">
        <input type="hidden" name="event_id" value={event.id} />
        <input type="hidden" name="outcome" value={outcome} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-semibold">1. Outcome</legend>
          <div className="flex flex-wrap gap-2">
            {choices.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={outcome === o.value}
                onClick={() => setOutcome(o.value)}
                className={`min-h-[40px] rounded-full border px-4 text-sm ${outcome === o.value ? 'border-primary bg-primary font-semibold text-white' : 'border-line bg-white'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>

        {needsDate && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 font-semibold">2. {outcome === 'reserved' ? 'Date for the decision' : 'Next date'}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field" htmlFor="next_date">Date
                <input id="next_date" name="next_date" type="date" className="input" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label className="field" htmlFor="next_time">Time
                <input id="next_time" name="next_time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
            </div>
            <ClashWarning clashes={clashes} staff={staff} lawyerId={event.lawyer_id} />
            {outcome === 'adjourned' && (
              <label className="field" htmlFor="next_purpose">Adjourned for
                <input id="next_purpose" name="next_purpose" className="input" list="purposes" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Cross-examination of PW2" />
                <datalist id="purposes">{PURPOSES.map((p) => <option key={p} value={p} />)}</datalist>
              </label>
            )}
            {outcome === 'reserved' && <input type="hidden" name="next_purpose" value="Ruling" />}
          </fieldset>
        )}

        <label className="field" htmlFor="note">
          <span className="font-semibold text-ink">{needsDate ? '3.' : '2.'} Note for the file</span>
          <textarea id="note" name="note" rows={3} className="input py-2" placeholder="What happened: witnesses called, exhibits tendered, applications made, the judge's directions" />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Client update</legend>
          {clientPhone ? (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="notify_client" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-5 w-5 accent-primary" />
                Send {clientName || 'the client'} (+{clientPhone}) an update
              </label>
              {notify && (
                <>
                  <label htmlFor="client_message" className="sr-only">Message to client</label>
                  <textarea
                    id="client_message"
                    name="client_message"
                    rows={4}
                    className="input py-2"
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setEdited(true); }}
                  />
                  {!smsReady && <p className="text-sm text-warn">Termii isn&apos;t connected yet, so this message won&apos;t send until it is.</p>}
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">Add the client&apos;s phone number on the matter to send updates after each hearing.</p>
          )}
        </fieldset>

        {error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
          <Link href={`/events/${event.id}`} className="btn-ghost">Cancel</Link>
          <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : needsDate ? 'Save and set next date' : 'Save outcome'}</button>
        </div>
      </form>

      <aside aria-label="What happens when you save" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
        <section className="rounded-xl bg-primary p-5 text-white">
          <p className="label-caps mb-2 text-accent">When you save</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-[#DCE7EA]">
            {effects.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </section>
        {notify && clientPhone && (
          <section className="card p-4">
            <p className="label-caps mb-2 text-accent-ink">Client message preview</p>
            <div className="rounded-[4px_14px_14px_14px] bg-accent-soft px-4 py-3 text-sm">{message}</div>
          </section>
        )}
      </aside>
    </div>
  );
}
