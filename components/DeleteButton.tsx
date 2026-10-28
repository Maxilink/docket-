'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteEvent, deleteMatter } from '@/app/(app)/actions';

export default function DeleteButton({ kind, id, after, label }: { kind: 'event' | 'matter'; id: string; after: string; label: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  if (!confirming) {
    return <button type="button" className="btn-danger" onClick={() => setConfirming(true)}>Delete</button>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-hearing-soft px-3 py-2 text-sm">
      <span>{label}</span>
      <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>Keep it</button>
      <button
        type="button"
        className="btn-danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = kind === 'event' ? await deleteEvent(id) : await deleteMatter(id);
            if (r.error) return setError(r.error);
            router.push(after);
            router.refresh();
          })
        }
      >
        {pending ? 'Deleting…' : 'Delete for everyone'}
      </button>
      {error && <span role="alert" className="text-hearing">{error}</span>}
    </div>
  );
}
