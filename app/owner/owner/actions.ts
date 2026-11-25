'use server';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/owner';
import { extendSubscription, newReference } from '@/lib/paystack';
import { SUB_COLUMNS, TRIAL_DAYS, type Subscription } from '@/lib/billing';

type Result = { error?: string; ok?: string };

const isId = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);

async function currentSub(admin: Awaited<ReturnType<typeof requireOwner>>['admin'], firmId: string) {
  const { data } = await admin.from('firm_subscriptions').select(SUB_COLUMNS).eq('firm_id', firmId).maybeSingle();
  return data as Subscription | null;
}

/** Suspend a firm (everyone in it is locked out) or let it back in. */
export async function setFirmSuspended(firmId: string, suspended: boolean, reason: string): Promise<Result> {
  const { admin } = await requireOwner();
  if (!isId(firmId)) return { error: 'Firm not found.' };
  const sub = await currentSub(admin, firmId);
  const now = new Date();
  const next = suspended
    ? { status: 'suspended', suspended_reason: reason.trim().slice(0, 300) || 'Suspended by C-Diary.' }
    : {
        status: sub?.current_period_end && new Date(sub.current_period_end) > now ? 'active' : 'trial',
        suspended_reason: null,
      };
  const { error } = await admin.from('firm_subscriptions').upsert({ firm_id: firmId, ...next, updated_at: now.toISOString() }, { onConflict: 'firm_id' });
  if (error) return { error: error.message };
  revalidatePath('/owner');
  revalidatePath(`/owner/firms/${firmId}`);
  return { ok: suspended ? 'Firm suspended.' : 'Firm reactivated.' };
}

/** Give a firm more free days, from today or from the end of its current trial. */
export async function extendTrial(firmId: string, days: number): Promise<Result> {
  const { admin } = await requireOwner();
  if (!isId(firmId)) return { error: 'Firm not found.' };
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: 'Choose between 1 and 365 days.' };
  const { data: firm } = await admin.from('firms').select('created_at').eq('id', firmId).maybeSingle();
  if (!firm) return { error: 'Firm not found.' };
  const sub = await currentSub(admin, firmId);
  const now = new Date();
  const currentEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : new Date(new Date(firm.created_at).getTime() + TRIAL_DAYS * 86400e3);
  const from = currentEnd > now ? currentEnd : now;
  const end = new Date(from.getTime() + days * 86400e3);
  const { error } = await admin
    .from('firm_subscriptions')
    .upsert({ firm_id: firmId, status: sub?.status === 'active' ? 'active' : 'trial', trial_ends_at: end.toISOString(), updated_at: now.toISOString() }, { onConflict: 'firm_id' });
  if (error) return { error: error.message };
  revalidatePath('/owner');
  revalidatePath(`/owner/firms/${firmId}`);
  return { ok: `Trial now ends ${end.toDateString()}.` };
}

/** Record a payment made outside Paystack (bank transfer, cash) and extend the firm. */
export async function recordManualPayment(firmId: string, planId: string | null, amountNaira: number, months: number, note: string): Promise<Result> {
  const { admin, user } = await requireOwner();
  if (!isId(firmId)) return { error: 'Firm not found.' };
  if (planId && !isId(planId)) return { error: 'Plan not found.' };
  if (!Number.isFinite(amountNaira) || amountNaira <= 0) return { error: 'Enter the amount received in naira.' };
  if (!Number.isInteger(months) || months < 1 || months > 36) return { error: 'Choose between 1 and 36 months.' };
  const reference = `manual_${newReference(firmId)}`;
  const now = new Date();
  const { start, end } = await extendSubscription(admin, firmId, planId, months);
  const { error } = await admin.from('payments').insert({
    firm_id: firmId,
    plan_id: planId,
    reference,
    amount_kobo: Math.round(amountNaira * 100),
    status: 'success',
    method: 'manual',
    months,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    paid_at: now.toISOString(),
    note: note.trim().slice(0, 500) || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/owner');
  revalidatePath(`/owner/firms/${firmId}`);
  revalidatePath('/owner/payments');
  return { ok: `Payment recorded. Paid until ${end.toDateString()}.` };
}

/** Owner's private notes on a firm. */
export async function saveFirmNotes(firmId: string, notes: string): Promise<Result> {
  const { admin } = await requireOwner();
  if (!isId(firmId)) return { error: 'Firm not found.' };
  const sub = await currentSub(admin, firmId);
  const { error } = await admin
    .from('firm_subscriptions')
    .upsert({ firm_id: firmId, status: sub?.status ?? 'trial', notes: notes.trim().slice(0, 2000) || null, updated_at: new Date().toISOString() }, { onConflict: 'firm_id' });
  if (error) return { error: error.message };
  revalidatePath(`/owner/firms/${firmId}`);
  return { ok: 'Notes saved.' };
}

/** Create or change a plan. Prices are entered in naira. */
export async function savePlan(input: { id?: string; name: string; description: string; priceNaira: number; intervalMonths: number; maxUsers: number | null; active: boolean; sort: number }): Promise<Result> {
  const { admin } = await requireOwner();
  const name = input.name.trim();
  if (!name || name.length > 60) return { error: 'Give the plan a name (up to 60 characters).' };
  if (!Number.isFinite(input.priceNaira) || input.priceNaira < 100) return { error: 'The price must be at least ₦100.' };
  if (![1, 3, 6, 12].includes(input.intervalMonths)) return { error: 'Choose monthly, quarterly, every 6 months or yearly.' };
  if (input.maxUsers != null && (!Number.isInteger(input.maxUsers) || input.maxUsers < 1)) return { error: 'Users must be a whole number, or leave it empty for unlimited.' };
  const row = {
    name,
    description: input.description.trim().slice(0, 300) || null,
    price_kobo: Math.round(input.priceNaira * 100),
    interval_months: input.intervalMonths,
    max_users: input.maxUsers,
    active: input.active,
    sort: Number.isInteger(input.sort) ? input.sort : 0,
  };
  const { error } = input.id && isId(input.id) ? await admin.from('plans').update(row).eq('id', input.id) : await admin.from('plans').insert(row);
  if (error) return { error: error.message };
  revalidatePath('/owner/plans');
  revalidatePath('/billing');
  return { ok: 'Plan saved.' };
}

/** Remove someone from their firm (they can no longer sign in to it), e.g. after a complaint. */
export async function removeUserFromFirm(userId: string): Promise<Result> {
  const { admin, user } = await requireOwner();
  if (!isId(userId)) return { error: 'User not found.' };
  if (userId === user.id) return { error: 'You can’t remove yourself here.' };
  const { error } = await admin.from('profiles').update({ firm_id: null, status: 'active' }).eq('id', userId);
  if (error) return { error: error.message };
  revalidatePath('/owner/users');
  revalidatePath('/owner');
  return { ok: 'User removed from their firm.' };
}
