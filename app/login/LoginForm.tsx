'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, sendReset } from './actions';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    setNotice('');
    start(async () => {
      if (mode === 'in') {
        const r = await signIn(fd);
        if (r.error) return setError(r.error);
        router.replace('/today');
        router.refresh();
      } else {
        const r = await signUp(fd);
        if (r.error) return setError(r.error);
        if (r.confirm) setNotice('Account created. Check your email and click the confirmation link, then sign in.');
        else {
          router.replace('/onboarding');
          router.refresh();
        }
      }
    });
  }

  function reset(form: HTMLFormElement | null) {
    if (!form) return;
    const fd = new FormData(form);
    setError('');
    start(async () => {
      const r = await sendReset(fd);
      if (r.error) setError(r.error);
      else setNotice('If that email has an account, a reset link is on its way.');
    });
  }

  return (
    <div className="card w-full max-w-md p-6 sm:p-8">
      <div role="tablist" aria-label="Sign in or create account" className="mb-6 grid grid-cols-2 rounded-lg border border-line p-1">
        {(['in', 'up'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setError(''); setNotice(''); }}
            className={`rounded-md py-2 text-sm font-medium ${mode === m ? 'bg-primary text-white' : 'text-muted'}`}
          >
            {m === 'in' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" id="auth-form">
        {mode === 'up' && (
          <>
            <label className="field" htmlFor="full_name">Full name
              <input id="full_name" name="full_name" className="input" placeholder="e.g. Barr. Ada Nwosu" autoComplete="name" required />
            </label>
            <label className="field" htmlFor="phone">Phone (for court reminders)
              <input id="phone" name="phone" className="input" placeholder="0803 123 4567" autoComplete="tel" inputMode="tel" />
            </label>
          </>
        )}
        <label className="field" htmlFor="email">Email
          <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        </label>
        <label className="field" htmlFor="password">Password
          <input id="password" name="password" type="password" className="input" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={mode === 'up' ? 8 : undefined} />
        </label>
        {error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{notice}</p>}
        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        {mode === 'in' && (
          <button type="button" className="text-sm text-muted underline-offset-2 hover:underline" onClick={() => reset(document.getElementById('auth-form') as HTMLFormElement)}>
            Forgot password? Email me a reset link
          </button>
        )}
      </form>
    </div>
  );
}
