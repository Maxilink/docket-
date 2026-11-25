import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { confirmPayment } from '@/lib/paystack';

export const metadata = { title: 'Payment' };
export const dynamic = 'force-dynamic';

/** Paystack sends the admin back here after paying. The payment is checked with Paystack before anything changes. */
export default async function BillingCallback(props: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const sp = await props.searchParams;
  const { firm } = await requireMember();
  const reference = (sp.reference ?? sp.trxref ?? '').trim();
  let ok = false;
  let message = 'No payment reference was given.';
  if (/^[\w-]{6,100}$/.test(reference)) {
    const r = await confirmPayment(createAdminClient(), reference);
    if (r.firmId && r.firmId !== firm.id) {
      message = 'This payment belongs to another firm.';
    } else {
      ok = r.ok;
      message = r.message;
    }
  }
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-8 text-center">
      <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${ok ? 'bg-accent-soft text-accent-ink' : 'bg-warn-soft text-warn'}`} aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {ok ? <path d="m5 12 5 5 9-10" /> : <path d="M12 8v5M12 17h.01" />}
        </svg>
      </div>
      <h1 className="font-display text-2xl font-bold">{ok ? 'Payment received' : 'Payment not confirmed'}</h1>
      <p className="text-muted">{ok ? 'Thank you. Your plan is active and your firm can carry on using C-Diary.' : message}</p>
      {!ok && <p className="text-sm text-muted">If money left your account, it will be confirmed automatically within a few minutes. Your reference is <span className="font-mono">{reference || 'missing'}</span>.</p>}
      <Link href="/billing" className="btn-primary mx-auto">Back to Billing</Link>
    </div>
  );
}
