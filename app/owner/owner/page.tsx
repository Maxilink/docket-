import Link from 'next/link';
import { requireOwner } from '@/lib/owner';
import { loadFirms, type FirmRow } from '@/lib/ownerData';
import { naira, STATE_LABEL, STATE_TONE, type AccessState } from '@/lib/billing';
import { fmtDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

const FILTERS: { value: '' | AccessState; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Paid' },
  { value: 'trial', label: 'On trial' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
];

function ago(iso: string | null) {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400e3);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

function statusLine(f: FirmRow) {
  const a = f.access;
  if (a.state === 'suspended') return a.reason ?? 'Suspended';
  if (!a.endsAt) return '';
  return a.state === 'expired' ? `Ended ${fmtDate(a.endsAt)}` : `${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left, to ${fmtDate(a.endsAt)}`;
}

export default async function OwnerHome(props: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await props.searchParams;
  const { admin } = await requireOwner();
  const [{ firms, needsSql }, paymentsRes, usersRes] = await Promise.all([
    loadFirms(admin),
    admin.from('payments').select('amount_kobo, paid_at').eq('status', 'success'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).not('firm_id', 'is', null),
  ]);
  const paid = (paymentsRes.data ?? []) as { amount_kobo: number; paid_at: string | null }[];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const revenueMonth = paid.filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart).reduce((n, p) => n + p.amount_kobo, 0);
  const revenueAll = paid.reduce((n, p) => n + p.amount_kobo, 0);
  const count = (s: AccessState) => firms.filter((f) => f.access.state === s).length;
  const newThisMonth = firms.filter((f) => new Date(f.created_at) >= monthStart).length;

  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = firms.filter(
    (f) =>
      (!sp.status || f.access.state === sp.status) &&
      (!q || f.name.toLowerCase().includes(q) || (f.admin_email ?? '').toLowerCase().includes(q) || (f.admin_name ?? '').toLowerCase().includes(q)),
  );

  const tiles = [
    { label: 'Law firms', value: String(firms.length), note: `${newThisMonth} new this month`, tone: 'bg-primary-50' },
    { label: 'Paying', value: String(count('active')), note: `${count('trial')} on free trial`, tone: 'bg-accent-soft' },
    { label: 'Need attention', value: String(count('expired') + count('suspended')), note: `${count('expired')} expired, ${count('suspended')} suspended`, tone: 'bg-warn-soft' },
    { label: 'Users in firms', value: String(usersRes.count ?? 0), note: 'Approved and waiting', tone: 'bg-primary-50' },
    { label: 'Revenue this month', value: naira(revenueMonth), note: `${naira(revenueAll)} all time`, tone: 'bg-accent-soft' },
  ];

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Law firms on C-Diary</h1>
        <p className="mt-1 text-muted">Every firm that has signed up, its plan, and how much it uses the diary.</p>
      </div>

      {needsSql && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          Run <span className="font-mono">009_subscriptions_owner.sql</span> in Supabase to switch on plans and payments. ({needsSql})
        </p>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-2xl p-4 ${t.tone}`}>
            <p className="text-sm text-muted">{t.label}</p>
            <p className="font-display text-2xl font-bold tabular text-ink">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.note}</p>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden" aria-label="Firms">
        <form className="flex flex-wrap items-center gap-3 border-b border-line p-4" action="/owner">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link key={f.value} href={`/owner?${new URLSearchParams({ ...(f.value ? { status: f.value } : {}), ...(sp.q ? { q: sp.q } : {}) })}`}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${((sp.status ?? '') === f.value) ? 'bg-primary text-white' : 'bg-primary/[0.07] text-primary hover:bg-primary/[0.14]'}`}>
                {f.label}
              </Link>
            ))}
          </div>
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <label htmlFor="q" className="sr-only">Search firms</label>
          <input id="q" name="q" defaultValue={sp.q ?? ''} placeholder="Search by firm, admin or email" className="input ml-auto max-w-xs" />
        </form>

        {shown.length === 0 ? (
          <p className="p-6 text-muted">No firms match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-primary-50 text-xs font-semibold text-muted">
                <tr>
                  <th className="px-4 py-3">Firm</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 text-right">Users</th>
                  <th className="px-4 py-3 text-right">Matters</th>
                  <th className="px-4 py-3 text-right">Upcoming</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((f) => (
                  <tr key={f.id} className="hover:bg-primary-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/owner/firms/${f.id}`} className="font-semibold text-primary hover:underline">{f.name}</Link>
                      <span className="block text-xs text-muted">{[f.admin_name, f.admin_email].filter(Boolean).join(', ') || 'No admin'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATE_TONE[f.access.state]}`}>{STATE_LABEL[f.access.state]}</span>
                      <span className="mt-1 block text-xs text-muted">{statusLine(f)}</span>
                    </td>
                    <td className="px-4 py-3">{f.plan?.name ?? <span className="text-muted">None</span>}</td>
                    <td className="px-4 py-3 text-right tabular">{f.members}{f.pending ? <span className="text-xs text-warn"> +{f.pending} waiting</span> : null}</td>
                    <td className="px-4 py-3 text-right tabular">{f.matters}</td>
                    <td className="px-4 py-3 text-right tabular">{f.upcoming}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ago(f.last_activity)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(new Date(f.created_at))}</td>
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
