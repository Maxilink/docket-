'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteForever, restoreItem } from '@/app/(app)/actions';

export default function ArchiveRowControls({ kind, id, title, canDelete }: { kind: 'matter' | 'event'; id: string; title: string; canDelete: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {confirm ? (
        <>
          <span className="text-sm text-hearing">
            Delete {kind === 'matter' ? 'this matter, its dates and its discussion' : 'this event'} for good? This can&apos;t be undone.
          </span>
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Keep</button>
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            aria-label={`Delete ${title} permanently`}
            onClick={() => start(async () => { const r = await deleteForever(kind, id); if (r.error) setError(r.error); router.refresh(); })}
          >
            Delete permanently
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn-primary"
            disabled={pending}
            aria-label={`Restore ${title}`}
            onClick={() => start(async () => { const r = await restoreItem(kind, id); if (r.error) setError(r.error); router.refresh(); })}
          >
            {pending ? 'Restoring…' : 'Restore'}
          </button>
          {canDelete && <button type="button" className="btn-ghost" onClick={() => setConfirm(true)}>Delete…</button>}
        </>
      )}
      {error && <span role="alert" className="w-full text-right text-sm text-hearing">{error}</span>}
    </div>
  );
}
