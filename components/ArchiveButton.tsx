'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveEvent, archiveMatter } from '@/app/(app)/actions';

/** Moves a matter or event to the archive. Partners and admins can restore it from the Archive page. */
export default function ArchiveButton({ kind, id, after, label }: { kind: 'event' | 'matter'; id: string; after: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (!confirming) {
    return <button type="button" className="btn-ghost" onClick={() => setConfirming(true)}>Archive</button>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-primary-100 px-3 py-2 text-sm">
      <span>{label}</span>
      <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>Keep it</button>
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = kind === 'event' ? await archiveEvent(id) : await archiveMatter(id);
            if (r.error) return setError(r.error);
            router.push(after);
            router.refresh();
          })
        }
      >
        {pending ? 'Archiving…' : 'Move to archive'}
      </button>
      {error && <span role="alert" className="text-hearing">{error}</span>}
    </div>
  );
}
