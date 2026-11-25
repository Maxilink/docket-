'use client';
import { useState, useTransition } from 'react';
import { startCheckout } from './actions';

export default function PayButton({ planId, label }: { planId: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError('');
            const r = await startCheckout(planId);
            if (r.url) window.location.assign(r.url);
            else setError(r.error ?? 'Something went wrong. Try again.');
          })
        }
      >
        {pending ? 'Opening Paystack…' : label}
      </button>
      {error && <p role="alert" className="text-sm text-warn">{error}</p>}
    </div>
  );
}
