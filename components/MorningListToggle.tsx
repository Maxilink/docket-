'use client';
import { useState, useTransition } from 'react';
import { setMorningList } from '@/app/(app)/actions';

/** On My account: the 7am message listing today's matters. */
export default function MorningListToggle({ initial, hasPhone }: { initial: boolean; hasPhone: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  return (
    <section className="card flex flex-wrap items-center justify-between gap-4 border-primary-200 bg-gradient-to-br from-primary-100 to-primary-50 p-6">
      <div className="min-w-0 max-w-xl">
        <h2 className="font-display text-xl font-bold tracking-tight">Morning cause list</h2>
        <p className="text-sm text-muted">
          At 7am on days you have something in the diary, get one message listing today&apos;s hearings, deadlines and meetings, with any
          &ldquo;bring to court&rdquo; items not ready yet. It comes by SMS or WhatsApp{hasPhone ? '' : ' (add your phone number above)'} and as a phone notification if they&apos;re on.
        </p>
        {error && <p role="alert" className="mt-2 text-sm text-hearing">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          setError('');
          start(async () => {
            const r = await setMorningList(next);
            if (r.error) { setOn(!next); setError(r.error); }
          });
        }}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-gradient-to-r from-primary-600 to-primary' : 'bg-line'}`}
      >
        <span className="sr-only">Morning cause list {on ? 'on' : 'off'}</span>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
      </button>
    </section>
  );
}
