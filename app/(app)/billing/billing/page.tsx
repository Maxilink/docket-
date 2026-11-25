import { requireMember } from '@/lib/session';
import { paystackConfigured } from '@/lib/paystack';
import { accessState, intervalLabel, naira, PAYMENT_COLUMNS, PLAN_COLUMNS, STATE_LABEL, STATE_TONE, SUB_COLUMNS, type Payment, type Plan, type Subscription } from '@/lib/billing';
import { fmtDate } from '@/lib/time';
import PayButton from './PayButton';

export const metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const { supabase, profile, firm } = await requireMember();
  const isAdmin = profile.role === 'admin';
  const [{ data: f }, subRes, plansRes, paymentsRes, { count: users }] = await Promise.all([
    supabase.from('firms').select('created_at').eq('id', firm.id).maybeSingle(),
    supabase.from('firm_subscriptions').select(SUB_COLUMNS).eq('firm_id', firm.id).maybeSingle(),
    supabase.from('plans').select(PLAN_COLUMNS).eq('active', true).order('sort').order('price_kobo'),
    isAdmin ? supabase.from('payments').select(PAYMENT_COLUMNS).eq('status', 'success').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ]);
  const notReady = Boolean(subRes.error || plansRes.error);
  const sub = (subRes.data ?? null) as Subscription | null;
  const plans = (plansRes.data ?? []) as Plan[];
  const payments = (paymentsRes.data ?? []) as Payment[];
  const a = accessState(f?.created_at ?? new Date().toISOString(), sub);
  const current = plans.find((p) => p.id === sub?.plan_id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted">Your firm&apos;s C-Diary plan and payments.</p>
      </header>

      {notReady ? (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">Billing isn&apos;t switched on yet.</p>
      ) : (
        <>
          <section className="card flex flex-wrap items-center justify-between gap-4 p-5" aria-label="Current plan">
            <div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATE_TONE[a.state]}`}>{STATE_LABEL[a.state]}</span>
              <p className="mt-3 font-display text-2xl font-bold">
                {a.state === 'active' && `${current?.name ?? 'Paid'} until ${fmtDate(a.endsAt!)}`}
                {a.state === 'trial' && `Free trial: ${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`}
                {a.state === 'expired' && 'Your plan has ended'}
                {a.state === 'suspended' && 'Your firm’s account is suspended'}
              </p>
              <p className="mt-1 text-muted">
                {a.state === 'trial' && `The trial ends on ${fmtDate(a.endsAt!)}. Choose a plan below to keep using C-Diary after that.`}
                {a.state === 'active' && 'Paying again adds another period after this one ends, so you can renew early without losing days.'}
                {a.state === 'expired' && 'Choose a plan below to carry on. All your matters and dates are kept.'}
                {a.state === 'suspended' && (a.reason ?? 'Contact C-Diary to restore access.')}
              </p>
            </div>
            <p className="text-sm text-muted">{users ?? 0} user{users === 1 ? '' : 's'} in your firm</p>
          </section>

          <section aria-labelledby="plans-h" className="flex flex-col gap-4">
            <h2 id="plans-h" className="font-display text-xl font-bold">Plans</h2>
            {plans.length === 0 ? (
              <p className="card p-5 text-muted">Plans will be listed here soon.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((p) => {
                  const tooSmall = Boolean(p.max_users && (users ?? 0) > p.max_users);
                  return (
                    <div key={p.id} className={`card flex flex-col gap-3 p-5 ${current?.id === p.id && a.state === 'active' ? 'ring-2 ring-primary' : ''}`}>
                      <h3 className="font-display text-lg font-bold">{p.name}</h3>
                      <p><span className="font-display text-3xl font-bold text-primary">{naira(p.price_kobo)}</span> <span className="text-muted">per {intervalLabel(p.interval_months)}</span></p>
                      {p.description && <p className="text-muted">{p.description}</p>}
                      <p className="text-sm text-muted">{p.max_users ? `Up to ${p.max_users} users` : 'Unlimited users'}</p>
                      <div className="mt-auto pt-2">
                        {!isAdmin ? (
                          <p className="text-sm text-muted">Your firm&apos;s admin can pay for this plan.</p>
                        ) : tooSmall ? (
                          <p className="text-sm text-warn">Your firm has more users than this plan allows.</p>
                        ) : !paystackConfigured() ? (
                          <p className="text-sm text-muted">Online payment is coming soon.</p>
                        ) : (
                          <PayButton planId={p.id} label={`Pay ${naira(p.price_kobo)} with Paystack`} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-sm text-muted">Payments are made securely through Paystack by card, bank transfer or USSD. Paystack emails the receipt.</p>
          </section>

          {isAdmin && (
            <section className="card overflow-hidden" aria-labelledby="hist-h">
              <h2 id="hist-h" className="border-b border-line px-5 py-4 font-display text-lg font-bold">Payment history</h2>
              {payments.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <span>{fmtDate(new Date(p.paid_at ?? p.created_at))}: {naira(p.amount_kobo)}</span>
                      <span className="text-sm text-muted">{p.period_end ? `Covers to ${fmtDate(new Date(p.period_end))}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
