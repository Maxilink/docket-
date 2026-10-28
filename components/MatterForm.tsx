'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveMatter } from '@/app/(app)/actions';
import type { Matter, Profile } from '@/lib/types';

export default function MatterForm({ matter, staff, defaultLawyer }: { matter?: Matter; staff: Profile[]; defaultLawyer?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    start(async () => {
      const r = await saveMatter(fd);
      if (r.error) return setError(r.error);
      router.push(`/matters/${r.id}`);
      router.refresh();
    });
  }

  const v = (k: keyof Matter) => (matter?.[k] as string | null | undefined) ?? '';

  return (
    <form onSubmit={submit} className="card flex flex-col gap-5 p-6">
      {matter && <input type="hidden" name="id" value={matter.id} />}
      <label className="field" htmlFor="title">Case title
        <input id="title" name="title" className="input" defaultValue={v('title')} placeholder="e.g. Okafor v. Rivers State Government" required />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field" htmlFor="suit_number">Suit / case number
          <input id="suit_number" name="suit_number" className="input font-mono" defaultValue={v('suit_number')} placeholder="e.g. PHC/1234/2025" />
        </label>
        <label className="field" htmlFor="lead_lawyer_id">Lead counsel
          <select id="lead_lawyer_id" name="lead_lawyer_id" className="input" defaultValue={matter?.lead_lawyer_id ?? defaultLawyer ?? ''}>
            <option value="">Not assigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || 'Unnamed'}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="court">Court
          <input id="court" name="court" className="input" defaultValue={v('court')} placeholder="e.g. High Court of Rivers State" />
        </label>
        <label className="field" htmlFor="courtroom">Courtroom
          <input id="courtroom" name="courtroom" className="input" defaultValue={v('courtroom')} placeholder="e.g. Court 4" />
        </label>
        <label className="field" htmlFor="judge">Judge
          <input id="judge" name="judge" className="input" defaultValue={v('judge')} placeholder="e.g. Hon. Justice …" />
        </label>
        <label className="field" htmlFor="opposing_counsel">Opposing counsel
          <input id="opposing_counsel" name="opposing_counsel" className="input" defaultValue={v('opposing_counsel')} />
        </label>
        <label className="field" htmlFor="client_name">Client
          <input id="client_name" name="client_name" className="input" defaultValue={v('client_name')} placeholder="e.g. Mr. Chinedu Okafor" />
        </label>
        <label className="field" htmlFor="client_phone">Client phone (for updates)
          <input id="client_phone" name="client_phone" className="input" defaultValue={matter?.client_phone ? `+${matter.client_phone}` : ''} placeholder="0803 123 4567" inputMode="tel" />
        </label>
      </div>
      <label className="field" htmlFor="description">Notes about the case
        <textarea id="description" name="description" rows={3} className="input py-2" defaultValue={v('description')} placeholder="Nature of the claim, reliefs sought, anything colleagues should know" />
      </label>
      {matter && (
        <label className="field max-w-xs" htmlFor="status">Status
          <select id="status" name="status" className="input" defaultValue={matter.status}>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      )}
      {error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : matter ? 'Save changes' : 'Create matter'}</button>
      </div>
    </form>
  );
}
