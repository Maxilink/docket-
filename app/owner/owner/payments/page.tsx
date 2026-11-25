import Link from 'next/link';
import { requireOwner } from '@/lib/owner';
import { naira, PAYMENT_COLUMNS, type Payment } from '@/lib/billing';
import { fmtDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function OwnerPayments() {
  const { admin } = await requireOwner();
  const [{ data, error }, { data: firms }] = await Promise.all([
    admin.from('payments').select(PAYMENT_COLUMNS).order('created_at', { ascending: false }).limit(500),
    admin.from('firms').select('id, name'),
  ]);
  const firmName = new Map(((firms ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name]));
  const payments = (data ?? []) as Payment[];
  const ok = payments.filter((p) => p.status === 'success');
  const total = ok.reduce((n, p) => n + p.amount_kobo, 0);

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Payments</h1>
        <p className="mt-1 text-muted">{ok.length} successful payments, {naira(total)} in total.</p>
      </div>
      {error && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">Run 009_subscriptions_owner.sql in Supabase first. ({error.message})</p>}
      <section className="card overflow-hidden" aria-label="Payments">
        {payments.length === 0 ? (
          <p className="p-6 text-muted">No payments yet. They appear here as firms pay through Paystack or when you record one on a firm&apos;s page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-primary-50 text-xs font-semibold text-muted">
                <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Firm</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5">Covers</th><th className="px-4 py-2.5">How</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Reference</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(new Date(p.paid_at ?? p.created_at))}</td>
                    <td className="px-4 py-3"><Link href={`/owner/firms/${p.firm_id}`} className="text-primary hover:underline">{firmName.get(p.firm_id) ?? 'Firm'}</Link></td>
                    <td className="px-4 py-3 text-right tabular">{naira(p.amount_kobo)}</td>
                    <td className="px-4 py-3">{p.months} month{p.months === 1 ? '' : 's'}</td>
                    <td className="px-4 py-3">{p.method === 'manual' ? 'Recorded by owner' : `Paystack${p.channel ? ` (${p.channel})` : ''}`}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.status === 'success' ? 'bg-accent-soft text-accent-ink' : p.status === 'failed' ? 'bg-hearing-soft text-hearing' : 'bg-primary-100 text-primary'}`}>
                        {p.status === 'success' ? 'Paid' : p.status === 'failed' ? 'Failed' : 'Not completed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
