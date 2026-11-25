import { requireOwner } from '@/lib/owner';
import { PLAN_COLUMNS, type Plan } from '@/lib/billing';
import PlanEditor from './PlanEditor';

export const dynamic = 'force-dynamic';

export default async function OwnerPlans() {
  const { admin } = await requireOwner();
  const { data, error } = await admin.from('plans').select(PLAN_COLUMNS).order('sort').order('price_kobo');
  const plans = (data ?? []) as Plan[];
  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Plans</h1>
        <p className="mt-1 max-w-2xl text-muted">
          The plans firms can buy on their Billing page. Firm admins pay through Paystack; each payment adds the plan&apos;s period to the firm.
          Turn a plan off to stop new sales without affecting firms already on it.
        </p>
      </div>
      {error && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">Run 009_subscriptions_owner.sql in Supabase first. ({error.message})</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => <PlanEditor key={p.id} plan={p} />)}
        <PlanEditor />
      </div>
    </>
  );
}
