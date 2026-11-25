import Link from 'next/link';
import { requireOwner } from '@/lib/owner';
import { allEmails } from '@/lib/ownerData';
import { ROLES } from '@/lib/constants';
import { fmtDate } from '@/lib/time';
import RemoveUserButton from '../RemoveUserButton';

export const dynamic = 'force-dynamic';

export default async function OwnerUsers(props: { searchParams: Promise<{ q?: string }> }) {
  const sp = await props.searchParams;
  const { admin } = await requireOwner();
  const [{ data: profiles }, { data: firms }, emails] = await Promise.all([
    admin.from('profiles').select('id, full_name, phone, role, status, firm_id, created_at').order('created_at', { ascending: false }),
    admin.from('firms').select('id, name'),
    allEmails(admin),
  ]);
  const firmName = new Map(((firms ?? []) as { id: string; name: string }[]).map((f) => [f.id, f.name]));
  const rows = ((profiles ?? []) as { id: string; full_name: string; phone: string | null; role: string; status: string | null; firm_id: string | null; created_at: string }[]).map((p) => ({
    ...p,
    email: emails.get(p.id)?.email ?? null,
    lastSignIn: emails.get(p.id)?.last_sign_in_at ?? null,
    firm: p.firm_id ? firmName.get(p.firm_id) ?? null : null,
  }));
  const q = (sp.q ?? '').trim().toLowerCase();
  const shown = q
    ? rows.filter((r) => [r.full_name, r.email, r.firm, r.phone].some((v) => (v ?? '').toLowerCase().includes(q)))
    : rows;

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-muted">{rows.length} people have signed up. {rows.filter((r) => !r.firm_id).length} are not in a firm yet.</p>
      </div>
      <section className="card overflow-hidden" aria-label="Users">
        <form action="/owner/users" className="border-b border-line p-4">
          <label htmlFor="uq" className="sr-only">Search users</label>
          <input id="uq" name="q" defaultValue={sp.q ?? ''} placeholder="Search by name, email, phone or firm" className="input max-w-md" />
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-primary-50 text-xs font-semibold text-muted">
              <tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Email and phone</th><th className="px-4 py-2.5">Firm</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Signed up</th><th className="px-4 py-2.5">Last sign-in</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-semibold">{r.full_name || 'No name'}{r.status === 'pending' && r.firm_id && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">Waiting</span>}</td>
                  <td className="px-4 py-3">{r.email ?? '—'}<span className="block text-xs text-muted">{r.phone ? `+${r.phone}` : ''}</span></td>
                  <td className="px-4 py-3">{r.firm_id ? <Link href={`/owner/firms/${r.firm_id}`} className="text-primary hover:underline">{r.firm ?? 'Firm'}</Link> : <span className="text-muted">No firm</span>}</td>
                  <td className="px-4 py-3">{ROLES.find((x) => x.value === r.role)?.label ?? r.role}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDate(new Date(r.created_at))}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.lastSignIn ? fmtDate(new Date(r.lastSignIn)) : 'Never'}</td>
                  <td className="px-4 py-3 text-right">{r.firm_id && <RemoveUserButton userId={r.id} name={r.full_name} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
