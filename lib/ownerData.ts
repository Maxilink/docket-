import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accessState, PLAN_COLUMNS, SUB_COLUMNS, type Plan, type Subscription } from '@/lib/billing';

export interface FirmRow {
  id: string;
  name: string;
  created_at: string;
  join_code: string;
  sub: Subscription | null;
  plan: Plan | null;
  access: ReturnType<typeof accessState>;
  members: number;
  pending: number;
  matters: number;
  upcoming: number;
  last_activity: string | null;
  admin_name: string | null;
  admin_email: string | null;
}

/** Every auth user's email, by user id (the owner dashboard is the only place that needs this). */
export async function allEmails(admin: SupabaseClient) {
  const out = new Map<string, { email: string | null; last_sign_in_at: string | null; created_at: string }>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) out.set(u.id, { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null, created_at: u.created_at });
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function loadFirms(admin: SupabaseClient): Promise<{ firms: FirmRow[]; plans: Plan[]; needsSql: string | null }> {
  const [firmsRes, subsRes, plansRes, statsRes, adminsRes, emails] = await Promise.all([
    admin.from('firms').select('id, name, created_at, join_code').order('created_at', { ascending: false }),
    admin.from('firm_subscriptions').select(SUB_COLUMNS),
    admin.from('plans').select(PLAN_COLUMNS).order('sort'),
    admin.rpc('owner_firm_stats'),
    admin.from('profiles').select('id, firm_id, full_name, role, created_at').eq('role', 'admin').order('created_at'),
    allEmails(admin),
  ]);
  const needsSql = subsRes.error || plansRes.error || statsRes.error ? (subsRes.error ?? plansRes.error ?? statsRes.error)!.message : null;
  const subs = new Map(((subsRes.data ?? []) as Subscription[]).map((s) => [s.firm_id, s]));
  const plans = (plansRes.data ?? []) as Plan[];
  const stats = new Map(((statsRes.data ?? []) as { firm_id: string; members: number; pending: number; matters: number; upcoming: number; last_activity: string | null }[]).map((s) => [s.firm_id, s]));
  const firstAdmin = new Map<string, { id: string; full_name: string }>();
  for (const a of (adminsRes.data ?? []) as { id: string; firm_id: string | null; full_name: string }[]) {
    if (a.firm_id && !firstAdmin.has(a.firm_id)) firstAdmin.set(a.firm_id, a);
  }
  const firms = ((firmsRes.data ?? []) as { id: string; name: string; created_at: string; join_code: string }[]).map((f) => {
    const sub = subs.get(f.id) ?? null;
    const st = stats.get(f.id);
    const adm = firstAdmin.get(f.id);
    return {
      ...f,
      sub,
      plan: plans.find((p) => p.id === sub?.plan_id) ?? null,
      access: accessState(f.created_at, sub),
      members: st?.members ?? 0,
      pending: st?.pending ?? 0,
      matters: st?.matters ?? 0,
      upcoming: st?.upcoming ?? 0,
      last_activity: st?.last_activity ?? null,
      admin_name: adm?.full_name ?? null,
      admin_email: adm ? emails.get(adm.id)?.email ?? null : null,
    };
  });
  return { firms, plans, needsSql };
}
