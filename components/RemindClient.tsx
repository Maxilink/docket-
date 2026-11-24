'use client';
import { useState, useTransition } from 'react';
import { remindClient } from '@/app/(app)/actions';
import { fmtTime } from '@/lib/time';

/** "Remind client" button with an editable message preview. Sends by email (Brevo) first, then SMS or WhatsApp (Termii). */
export default function RemindClient({ eventId, clientName, contact, defaultText, compact = false }: { eventId: string; clientName: string | null; contact: string; defaultText: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(defaultText);
  const [error, setError] = useState('');
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  if (sentAt && !open) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-accent-ink">
        {notice ? `${notice.replace(/\.$/, '')}, ` : 'Client reminded, '}{fmtTime(new Date(sentAt))}
        <button type="button" className="font-medium text-muted underline-offset-2 hover:underline" onClick={() => setOpen(true)}>Send again</button>
      </span>
    );
  }

  if (!open) {
    return (
      <button type="button" className={compact ? 'btn-soft min-h-[36px] px-3 text-sm' : 'btn-soft'} onClick={() => setOpen(true)}>
        Remind client
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl bg-accent-soft/60 p-4 text-left">
      <label htmlFor={`remind-${eventId}`} className="text-sm font-semibold text-muted">
        Message to {clientName || 'the client'} ({contact})
      </label>
      <textarea id={`remind-${eventId}`} rows={4} className="input bg-white py-2.5" value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p role="alert" className="text-sm text-hearing">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-accent"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError('');
              const r = await remindClient(eventId, text);
              if (r.error) return setError(r.error);
              setSentAt(r.at ?? new Date().toISOString());
              setNotice(r.notice ?? '');
              setOpen(false);
            })
          }
        >
          {pending ? 'Sending…' : 'Send reminder'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
      </div>
    </div>
  );
}
