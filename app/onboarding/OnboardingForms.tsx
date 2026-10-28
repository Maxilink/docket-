'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createFirm, joinFirm } from './actions';
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
          <p className="text-sm text-muted">Ask your firm admin for the join code. It is on their Team page.</p>
        </div>
        <label className="field" htmlFor="code">Join code
          <input id="code" name="code" className="input font-mono uppercase tracking-widest" placeholder="A1B2C3D4" required autoComplete="off" />
        </label>
        {error?.which === 'join' && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error.msg}</p>}
        <button className="btn-ghost mt-auto" disabled={pending}>Join firm</button>
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
