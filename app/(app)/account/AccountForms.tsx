'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword, updateMyProfile } from '@/app/(app)/actions';

export default function AccountForms({ name, phone }: { name: string; phone: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ which: string; text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();

  const handle = (which: 'profile' | 'password') => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = which === 'profile' ? await updateMyProfile(fd) : await changePassword(fd);
      if (r.error) return setMsg({ which, text: r.error, ok: false });
      setMsg({ which, text: which === 'profile' ? 'Saved' : 'Password changed', ok: true });
      if (which === 'password') form.reset();
      router.refresh();
    });
  };

  const note = (which: string) =>
    msg?.which === which ? <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-accent-ink' : 'text-hearing'}`}>{msg.text}</p> : null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={handle('profile')} className="card flex flex-col gap-4 p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Your details</h2>
        <label className="field" htmlFor="full_name">Name
          <input id="full_name" name="full_name" className="input" defaultValue={name} required />
        </label>
        <label className="field" htmlFor="phone">Phone for reminders
          <input id="phone" name="phone" className="input" defaultValue={phone ? `+${phone}` : ''} placeholder="0803 123 4567" inputMode="tel" />
        </label>
        <p className="text-sm text-muted">Court reminders go to this number by SMS or WhatsApp, 1 day and 1 hour before your hearings.</p>
        {note('profile')}
        <button className="btn-primary self-start" disabled={pending}>Save</button>
      </form>
      <form onSubmit={handle('password')} className="card flex flex-col gap-4 p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Change password</h2>
        <label className="field" htmlFor="password">New password
          <input id="password" name="password" type="password" className="input" minLength={8} autoComplete="new-password" required />
        </label>
        {note('password')}
        <button className="btn-ghost self-start" disabled={pending}>Change password</button>
      </form>
    </div>
  );
}
