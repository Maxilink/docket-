import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/owner';
import { allEmails, loadFirms } from '@/lib/ownerData';
import { intervalLabel, naira, PAYMENT_COLUMNS, STATE_LABEL, STATE_TONE, type Payment } from '@/lib/billing';
import { ROLES } from '@/lib/constants';
import { fmtDate } from '@/lib/time';
import FirmControls from './FirmControls';
import RemoveUserButton from '../../RemoveUserButton';

export const dynamic = 'force-dynamic';

export default async function OwnerFirmPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { admin } = await requireOwner();
  const [{ firms, plans }, membersRes, paymentsRes, emails] = await Promise.all([
    loadFirms(admin),
    admin.from('profiles').select('id, full_name, phone, role, status, created_at').eq('firm_id', id).order('created_at'),
    admin.from('payments').select(PAYMENT_COLUMNS).eq('firm_id', id).order('created_at', { ascending: false }),
    allEmails(admin),
  ]);
  const f = firms.find((x) => x.id === id);
  if (!f) notFound();
  const members = (membersRes.data ?? []) as { id: string; full_name: string; phone: string | null; role: string; status: string | null; created_at: string }[];
  const payments = (paymentsRes.data ?? []) as Payment[];
  const a = f.access;

  return (
    <>
      <Link href="/owner" className="text-sm text-muted hover:underline">← All firms</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{f.name}</h1>
          <p className="mt-1 text-sm text-muted">Joined {fmtDate(new Date(f.created_at))}. Join code {f.join_code}.</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${STATE_TONE[a.state]}`}>{STATE_LABEL[a.state]}</span>
          <p className="mt-2 text-sm text-muted">
            {a.state === 'suspended' ? a.reason : a.endsAt ? `${a.state === 'expired' ? 'Ended' : 'Until'} ${fmtDate(a.endsAt)}` : ''}
            {f.plan ? `. ${f.plan.name}` : ''}
          </p>
        </div>
      </header>

      <section aria-label="Usage" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Users', `${f.members}${f.pending ? ` (+${f.pending} waiting)` : ''}`],
          ['Matters', String(f.matters)],
          ['Upcoming dates', String(f.upcoming)],
          ['Last active', f.last_activity ? fmtDate(new Date(f.last_activity)) : 'Never'],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-sm text-muted">{k}</p>
            <p className="font-display text-xl font-bold">{v}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <section className="card overflow-hidden" aria-labelledby="members-h">
            <h2 id="members-h" className="border-b border-line px-5 py-4 font-display text-lg font-bold">People</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-primary-50 text-xs font-semibold text-muted">
                  <tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Email and phone</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Last sign-in</th><th className="px-4 py-2.5" /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {members.map((m) => {
                    const e = emails.get(m.id);
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3 font-semibold">{m.full_name || 'No name'}{m.status === 'pending' && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">Waiting</span>}</td>
                        <td className="px-4 py-3">{e?.email ?? '—'}<span className="block text-xs text-muted">{m.phone ? `+${m.phone}` : ''}</span></td>
                        <td className="px-4 py-3">{ROLES.find((r) => r.value === m.role)?.label ?? m.role}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{e?.last_sign_in_at ? fmtDate(new Date(e.last_sign_in_at)) : 'Never'}</td>
                        <td className="px-4 py-3 text-right"><RemoveUserButton userId={m.id} name={m.full_name} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card overflow-hidden" aria-labelledby="pay-h">
            <h2 id="pay-h" className="border-b border-line px-5 py-4 font-display text-lg font-bold">Payments</h2>
            {payments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No payments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-primary-50 text-xs font-semibold text-muted">
                    <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5 text-right">Amount</th><th className="px-4 py-2.5">Covers</th><th className="px-4 py-2.5">How</th><th className="px-4 py-2.5">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 whitespace-nowrap">{fmtDate(new Date(p.paid_at ?? p.created_at))}</td>
                        <td className="px-4 py-3 text-right tabular">{naira(p.amount_kobo)}</td>
                        <td className="px-4 py-3">{p.months} month{p.months === 1 ? '' : 's'}{p.period_end ? `, to ${fmtDate(new Date(p.period_end))}` : ''}</td>
                        <td className="px-4 py-3">{p.method === 'manual' ? `Recorded by owner${p.note ? `: ${p.note}` : ''}` : `Paystack${p.channel ? ` (${p.channel})` : ''}`}</td>
                        <td className="px-4 py-3 capitalize">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <FirmControls
            firmId={f.id}
            suspended={a.state === 'suspended'}
            notes={f.sub?.notes ?? ''}
            plans={plans.map((p) => ({ id: p.id, label: `${p.name}: ${naira(p.price_kobo)} per ${intervalLabel(p.interval_months)}`, priceNaira: p.price_kobo / 100, months: p.interval_months }))}
          />
        </aside>
      </div>
    </>
  );
}
