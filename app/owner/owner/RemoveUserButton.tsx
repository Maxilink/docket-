'use client';
import { useState, useTransition } from 'react';
import { removeUserFromFirm } from './actions';

export default function RemoveUserButton({ userId, name }: { userId: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  if (msg) return <span className="text-xs text-muted">{msg}</span>;
  return confirm ? (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs">
      Remove {name || 'this user'}?
      <button type="button" disabled={pending} className="font-semibold text-hearing hover:underline"
        onClick={() => start(async () => { const r = await removeUserFromFirm(userId); setMsg(r.error ?? r.ok ?? ''); })}>Remove</button>
      <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setConfirm(false)}>Keep</button>
    </span>
  ) : (
    <button type="button" className="text-xs font-semibold text-hearing hover:underline" onClick={() => setConfirm(true)}>Remove</button>
  );
}
