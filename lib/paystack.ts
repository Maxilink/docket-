import 'server-only';
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addMonths, SUB_COLUMNS, type Subscription } from '@/lib/billing';

/** Paystack (https://paystack.com) takes card, bank transfer and USSD payments in naira. */
export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

const API = 'https://api.paystack.co';

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; message: string }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  return { ok: res.ok && Boolean(body?.status), data: body?.data, message: body?.message ?? `HTTP ${res.status}` };
}

export function newReference(firmId: string) {
  return `cd_${firmId.slice(0, 8)}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

export async function initializePayment(opts: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, string> }) {
  return call<{ authorization_url: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountKobo,
      currency: 'NGN',
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
}

interface VerifyData {
  status: string;
  amount: number;
  currency: string;
  paid_at: string | null;
  channel: string | null;
  reference: string;
}

/** Paystack signs each webhook with the secret key (HMAC SHA-512 of the raw body). */
export function validSignature(rawBody: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Extends a firm's paid period by `months`, starting from today or from the end of the time already paid for,
 * whichever is later. Used for Paystack and manual payments alike.
 */
export async function extendSubscription(admin: SupabaseClient, firmId: string, planId: string | null, months: number) {
  const { data } = await admin.from('firm_subscriptions').select(SUB_COLUMNS).eq('firm_id', firmId).maybeSingle();
  const sub = data as Subscription | null;
  const now = new Date();
  const currentEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const start = currentEnd && currentEnd > now ? currentEnd : now;
  const end = addMonths(start, months);
  const { error } = await admin.from('firm_subscriptions').upsert(
    {
      firm_id: firmId,
      plan_id: planId ?? sub?.plan_id ?? null,
      status: 'active',
      current_period_end: end.toISOString(),
      suspended_reason: null,
      updated_at: now.toISOString(),
    },
    { onConflict: 'firm_id' },
  );
  if (error) throw new Error(error.message);
  return { start, end };
}

/**
 * Checks a payment with Paystack and, if it succeeded for the right amount, marks it paid and extends the firm.
 * Safe to call more than once for the same reference (the callback page and the webhook both call it).
 */
export async function confirmPayment(admin: SupabaseClient, reference: string): Promise<{ ok: boolean; message: string; firmId?: string }> {
  const { data: row } = await admin
    .from('payments')
    .select('id, firm_id, plan_id, amount_kobo, currency, status, months')
    .eq('reference', reference)
    .maybeSingle();
  const p = row as { id: string; firm_id: string; plan_id: string | null; amount_kobo: number; currency: string; status: string; months: number } | null;
  if (!p) return { ok: false, message: 'Payment not found.' };
  if (p.status === 'success') return { ok: true, message: 'Payment already confirmed.', firmId: p.firm_id };

  const v = await call<VerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!v.ok || !v.data) return { ok: false, message: `Paystack could not confirm this payment: ${v.message}`, firmId: p.firm_id };
  const d = v.data;
  if (d.status !== 'success') {
    if (d.status === 'failed' || d.status === 'abandoned') {
      await admin.from('payments').update({ status: 'failed', channel: d.channel }).eq('id', p.id).eq('status', 'pending');
    }
    return { ok: false, message: d.status === 'abandoned' ? 'The payment was not completed.' : `The payment ${d.status}.`, firmId: p.firm_id };
  }
  if (d.amount !== p.amount_kobo || d.currency !== p.currency) {
    return { ok: false, message: 'The amount paid does not match the plan price. Contact support.', firmId: p.firm_id };
  }

  // Claim the payment first, so two confirmations at the same moment can't both extend the subscription.
  const { data: claimed } = await admin
    .from('payments')
    .update({ status: 'success', paid_at: d.paid_at ?? new Date().toISOString(), channel: d.channel })
    .eq('id', p.id)
    .eq('status', 'pending')
    .select('id');
  if (!claimed?.length) return { ok: true, message: 'Payment already confirmed.', firmId: p.firm_id };

  const { start, end } = await extendSubscription(admin, p.firm_id, p.plan_id, p.months);
  await admin.from('payments').update({ period_start: start.toISOString(), period_end: end.toISOString() }).eq('id', p.id);
  return { ok: true, message: 'Payment confirmed.', firmId: p.firm_id };
}
