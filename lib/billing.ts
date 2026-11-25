/** Plans, subscriptions and money: shared by the server and the browser. */

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  interval_months: number;
  max_users: number | null;
  active: boolean;
  sort: number;
}

export interface Subscription {
  firm_id: string;
  plan_id: string | null;
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  trial_ends_at: string | null;
  current_period_end: string | null;
  suspended_reason: string | null;
  notes: string | null;
  updated_at: string;
}

export interface Payment {
  id: string;
  firm_id: string;
  plan_id: string | null;
  reference: string;
  amount_kobo: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
  method: 'paystack' | 'manual';
  channel: string | null;
  months: number;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  note: string | null;
  created_at: string;
}

export const PLAN_COLUMNS = 'id, name, description, price_kobo, interval_months, max_users, active, sort';
export const SUB_COLUMNS = 'firm_id, plan_id, status, trial_ends_at, current_period_end, suspended_reason, notes, updated_at';
export const PAYMENT_COLUMNS = 'id, firm_id, plan_id, reference, amount_kobo, currency, status, method, channel, months, period_start, period_end, paid_at, note, created_at';

export const TRIAL_DAYS = 14;
const DAY = 86400e3;

export function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function intervalLabel(months: number) {
  return months === 1 ? 'month' : months === 12 ? 'year' : `${months} months`;
}

export type AccessState = 'trial' | 'active' | 'expired' | 'suspended';

/** Where a firm stands today. A firm with no subscription row is on a trial counted from its creation. */
export function accessState(firmCreatedAt: string, sub: Subscription | null, now = new Date()) {
  const trialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : new Date(new Date(firmCreatedAt).getTime() + TRIAL_DAYS * DAY);
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  if (sub?.status === 'suspended') return { state: 'suspended' as AccessState, endsAt: null, daysLeft: 0, reason: sub.suspended_reason };
  if (periodEnd && periodEnd > now) {
    return { state: 'active' as AccessState, endsAt: periodEnd, daysLeft: Math.ceil((periodEnd.getTime() - now.getTime()) / DAY), reason: null };
  }
  if (trialEnd > now && (!sub || sub.status === 'trial')) {
    return { state: 'trial' as AccessState, endsAt: trialEnd, daysLeft: Math.ceil((trialEnd.getTime() - now.getTime()) / DAY), reason: null };
  }
  return { state: 'expired' as AccessState, endsAt: periodEnd ?? trialEnd, daysLeft: 0, reason: null };
}

export const STATE_LABEL: Record<AccessState, string> = {
  trial: 'Free trial',
  active: 'Paid',
  expired: 'Expired',
  suspended: 'Suspended',
};

export const STATE_TONE: Record<AccessState, string> = {
  trial: 'bg-primary-100 text-primary',
  active: 'bg-accent-soft text-accent-ink',
  expired: 'bg-warn-soft text-warn',
  suspended: 'bg-hearing-soft text-hearing',
};

/** Adds whole months to a date, keeping the day where the month allows. */
export function addMonths(d: Date, months: number) {
  const out = new Date(d);
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}
