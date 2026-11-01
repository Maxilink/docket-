'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelJoinRequest, createFirm, joinFirm } from './actions';
import { signOut } from '../login/actions';

export default function OnboardingForms() {
  const router = useRouter();
  const [error, setError] = useState<{ which: 'create' | 'join'; msg: string } | null>(null);
  const [pending, start] = useTransition();

  function run(which: 'create' | 'join') {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      setError(null);
      start(async () => {
        const r = which === 'create' ? await createFirm(fd) : await joinFirm(fd);
        if (r.error) return setError({ which, msg: r.error });
        if (which === 'join') return router.refresh(); // shows the "waiting for approval" screen
        router.replace('/today');
        router.refresh();
      });
    };
  }

  return (
    <div className="grid w-full max-w-3xl gap-6 md:grid-cols-2">
      <form onSubmit={run('create')} className="card flex flex-col gap-4 p-6">
        <div>
          <h2 className="font-display text-xl">Set up a new firm</h2>
          <p className="text-sm text-muted">You become the firm admin and can invite your colleagues.</p>
        </div>
        <label className="field" htmlFor="firm_name">Firm name
          <input id="firm_name" name="firm_name" className="input" placeholder="e.g. Synergy Attornies" required />
        </label>
        {error?.which === 'create' && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error.msg}</p>}
        <button className="btn-primary mt-auto" disabled={pending}>Create firm</button>
      </form>
      <form onSubmit={run('join')} className="card flex flex-col gap-4 p-6">
        <div>
          <h2 className="font-display text-xl">Join your firm</h2>
          <p className="text-sm text-muted">Ask your firm admin for the join code. It is on their Team page. Your admin then approves you.</p>
        </div>
        <label className="field" htmlFor="code">Join code
          <input id="code" name="code" className="input font-mono uppercase tracking-widest" placeholder="A1B2C3D4" required autoComplete="off" />
        </label>
        {error?.which === 'join' && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error.msg}</p>}
        <button className="btn-ghost mt-auto" disabled={pending}>Ask to join</button>
      </form>
      <button
        type="button"
        className="text-sm text-muted underline-offset-2 hover:underline md:col-span-2"
        onClick={() => start(async () => { await signOut(); router.replace('/login'); })}
      >
        Sign out
      </button>
    </div>
  );
}

/** Shown after someone asks to join, until the firm admin approves them. */
export function WaitingForApproval({ firmName }: { firmName: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="card flex w-full max-w-md flex-col gap-4 p-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-2xl" aria-hidden="true">⏳</div>
      <h2 className="font-display text-xl font-bold">Waiting for approval</h2>
      <p className="text-sm text-muted">
        You asked to join <strong className="text-ink">{firmName}</strong>. Your firm admin will approve you from their Team page. Once they do, this page opens your diary.
      </p>
      {error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => start(() => router.refresh())}>Check again</button>
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={() => start(async () => { const r = await cancelJoinRequest(); if (r.error) return setError(r.error); router.refresh(); })}
        >
          Cancel request
        </button>
      </div>
      <button
        type="button"
        className="text-sm text-muted underline-offset-2 hover:underline"
        onClick={() => start(async () => { await signOut(); router.replace('/login'); })}
      >
        Sign out
      </button>
    </div>
  );
}
