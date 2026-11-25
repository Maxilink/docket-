'use server';
import { headers } from 'next/headers';
import { requireMember } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { initializePayment, newReference, paystackConfigured } from '@/lib/paystack';
import { PLAN_COLUMNS, type Plan } from '@/lib/billing';

/** Starts a Paystack payment for a plan and returns the Paystack page to send the admin to. */
export async function startCheckout(planId: string): Promise<{ url?: string; error?: string }> {
  const { user, profile, firm } = await requireMember();
  if (profile.role !== 'admin') return { error: 'Only the firm’s admin can pay for C-Diary.' };
  if (!paystackConfigured()) return { error: 'Online payment isn’t switched on yet. Please contact C-Diary.' };
  if (!user.email) return { error: 'Your account has no email address, which Paystack needs for the receipt.' };
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return { error: 'Plan not found.' };

  const admin = createAdminClient();
  const { data } = await admin.from('plans').select(PLAN_COLUMNS).eq('id', planId).eq('active', true).maybeSingle();
  const plan = data as Plan | null;
  if (!plan) return { error: 'That plan is no longer available. Refresh the page.' };
  if (plan.max_users) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).eq('status', 'active');
    if ((count ?? 0) > plan.max_users) return { error: `Your firm has ${count} users, more than this plan allows (${plan.max_users}). Choose a larger plan.` };
  }

  const reference = newReference(firm.id);
  const { error: insErr } = await admin.from('payments').insert({
    firm_id: firm.id,
    plan_id: plan.id,
    reference,
    amount_kobo: plan.price_kobo,
    months: plan.interval_months,
    created_by: user.id,
  });
  if (insErr) return { error: 'The payment could not be started. Try again.' };

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const r = await initializePayment({
    email: user.email,
    amountKobo: plan.price_kobo,
    reference,
    callbackUrl: `${proto}://${host}/billing/callback`,
    metadata: { firm_id: firm.id, firm_name: firm.name, plan: plan.name },
  });
  if (!r.ok || !r.data?.authorization_url) {
    await admin.from('payments').update({ status: 'failed', note: r.message.slice(0, 300) }).eq('reference', reference);
    return { error: `Paystack didn’t accept the payment: ${r.message}` };
  }
  return { url: r.data.authorization_url };
}
