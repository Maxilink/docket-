'use client';
import { useState, useTransition } from 'react';
import { extendTrial, recordManualPayment, saveFirmNotes, setFirmSuspended } from '../../actions';

interface Props {
  firmId: string;
  suspended: boolean;
  notes: string;
  plans: { id: string; label: string; priceNaira: number; months: number }[];
}

export default function FirmControls({ firmId, suspended, notes, plans }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(14);
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const plan = plans.find((p) => p.id === planId);
  const [amount, setAmount] = useState(plan ? String(plan.priceNaira) : '');
  const [months, setMonths] = useState(plan?.months ?? 1);
  const [note, setNote] = useState('');
  const [notesText, setNotesText] = useState(notes);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const run = (fn: () => Promise<{ ok?: string; error?: string }>) =>
    start(async () => {
      setMsg({});
      setMsg(await fn());
    });

  return (
    <>
      {(msg.ok || msg.error) && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.error ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent-ink'}`}>{msg.error ?? msg.ok}</p>
      )}

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="pay-rec-h">
        <h2 id="pay-rec-h" className="font-display text-lg font-bold">Record a payment</h2>
        <p className="text-sm text-muted">For bank transfers or cash. Paystack payments are recorded by themselves.</p>
        <label className="field" htmlFor="fc-plan">Plan
          <select id="fc-plan" className="input" value={planId} onChange={(e) => { setPlanId(e.target.value); const p = plans.find((x) => x.id === e.target.value); if (p) { setAmount(String(p.priceNaira)); setMonths(p.months); } }}>
            <option value="">No plan</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <label className="field" htmlFor="fc-amount">Amount (₦)
            <input id="fc-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          </label>
          <label className="field" htmlFor="fc-months">Months
            <input id="fc-months" type="number" min={1} max={36} className="input" value={months} onChange={(e) => setMonths(Number(e.target.value))} />
          </label>
        </div>
        <label className="field" htmlFor="fc-note">Note
          <input id="fc-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. GTBank transfer, ref 0123" />
        </label>
        <button type="button" className="btn-primary self-start" disabled={pending} onClick={() => run(() => recordManualPayment(firmId, planId || null, Number(amount), months, note))}>
          Record payment
        </button>
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="trial-h">
        <h2 id="trial-h" className="font-display text-lg font-bold">Extend the free trial</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="field w-28" htmlFor="fc-days">Days
            <input id="fc-days" type="number" min={1} max={365} className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} />
          </label>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => extendTrial(firmId, days))}>Extend trial</button>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="suspend-h">
        <h2 id="suspend-h" className="font-display text-lg font-bold">{suspended ? 'Firm is suspended' : 'Suspend this firm'}</h2>
        {suspended ? (
          <>
            <p className="text-sm text-muted">Nobody in this firm can use C-Diary until you reactivate it. Their data is kept.</p>
            <button type="button" className="btn-primary self-start" disabled={pending} onClick={() => run(() => setFirmSuspended(firmId, false, ''))}>Reactivate firm</button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Everyone in the firm is locked out and sees your reason. Nothing is deleted.</p>
            <label className="field" htmlFor="fc-reason">Reason shown to the firm
              <input id="fc-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Payment overdue. Call 0803 000 0000." />
            </label>
            {confirmSuspend ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-xl bg-hearing px-4 py-2.5 text-sm font-semibold text-white" disabled={pending} onClick={() => { setConfirmSuspend(false); run(() => setFirmSuspended(firmId, true, reason)); }}>Yes, suspend</button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmSuspend(false)}>Keep active</button>
              </div>
            ) : (
              <button type="button" className="self-start text-sm font-semibold text-hearing hover:underline" onClick={() => setConfirmSuspend(true)}>Suspend firm</button>
            )}
          </>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="notes-h">
        <h2 id="notes-h" className="font-display text-lg font-bold">Private notes</h2>
        <label htmlFor="fc-notes" className="sr-only">Notes about this firm</label>
        <textarea id="fc-notes" rows={4} className="input py-2" value={notesText} onChange={(e) => setNotesText(e.target.value)} maxLength={2000} placeholder="Only you can see these." />
        <button type="button" className="btn-ghost self-start" disabled={pending} onClick={() => run(() => saveFirmNotes(firmId, notesText))}>Save notes</button>
      </section>
    </>
  );
}
