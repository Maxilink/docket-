'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { regenerateJoinCode, removeMember, setRole } from '@/app/(app)/actions';
import { ROLES } from '@/lib/constants';
import type { Role } from '@/lib/types';

export function JoinCode({ code, isAdmin }: { code: string; isAdmin: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="select-all rounded-lg bg-primary px-4 py-2 font-mono text-xl tracking-[0.2em] text-white">{code}</span>
      <button
        type="button"
        className="btn-ghost"
        onClick={async () => {
          try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setError('Copy failed. Select the code and copy it.'); }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {isAdmin && (
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={() => start(async () => { const r = await regenerateJoinCode(); if (r.error) setError(r.error); router.refresh(); })}
        >
          Make a new code
        </button>
      )}
      {error && <span role="alert" className="text-sm text-hearing">{error}</span>}
    </div>
  );
}

export function MemberControls({ id, role, name }: { id: string; role: Role; name: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label htmlFor={`role-${id}`} className="sr-only">Role for {name}</label>
      <select
        id={`role-${id}`}
        className="input w-auto bg-white"
        defaultValue={role}
        disabled={pending}
        onChange={(e) => start(async () => { const r = await setRole(id, e.target.value as Role); if (r.error) setError(r.error); router.refresh(); })}
      >
        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      {confirm ? (
        <>
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Keep</button>
          <button type="button" className="btn-danger" disabled={pending} onClick={() => start(async () => { const r = await removeMember(id); if (r.error) setError(r.error); router.refresh(); })}>Remove {name.split(' ')[0] || 'them'}</button>
        </>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setConfirm(true)}>Remove</button>
      )}
      {error && <span role="alert" className="w-full text-right text-sm text-hearing">{error}</span>}
    </div>
  );
}
