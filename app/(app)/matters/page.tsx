import Link from 'next/link';
import { requireMember, getStaff } from '@/lib/session';
import { Empty, Pill } from '@/components/EventBits';
import { fmtDate, fmtTime, relDay } from '@/lib/time';
import type { Matter } from '@/lib/types';

export const metadata = { title: 'Matters' };
export const dynamic = 'force-dynamic';

export default async function MattersPage(props: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase } = await requireMember();
  const status = searchParams.status === 'closed' ? 'closed' : 'active';
  const q = (searchParams.q ?? '').trim();
  let query = supabase.from('matters').select('*').eq('status', status).order('created_at', { ascending: false }).limit(300);
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    query = query.or(`title.ilike.%${safe}%,suit_number.ilike.%${safe}%,client_name.ilike.%${safe}%,court.ilike.%${safe}%`);
  }
  const now = new Date();
  const [{ data }, staff, { data: upcoming }] = await Promise.all([
    query,
    getStaff(supabase),
    supabase.from('events').select('matter_id, starts_at, purpose').gte('starts_at', now.toISOString()).not('matter_id', 'is', null).order('starts_at'),
  ]);
  const matters = (data ?? []) as Matter[];
  const nextBy = new Map<string, { starts_at: string; purpose: string | null }>();
  for (const u of (upcoming ?? []) as { matter_id: string; starts_at: string; purpose: string | null }[]) {
    if (!nextBy.has(u.matter_id)) nextBy.set(u.matter_id, u);
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Matters</h1>
        <Link href="/matters/new" className="btn-primary">+ New matter</Link>
      </header>
      <form className="flex flex-wrap items-center gap-3" role="search">
        <label htmlFor="q" className="sr-only">Search matters</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search title, suit no., client or court" className="input max-w-md bg-white" />
        <input type="hidden" name="status" value={status} />
        <button className="btn-ghost">Search</button>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-line bg-white">
          <Link href={`/matters${q ? `?q=${encodeURIComponent(q)}` : ''}`} className={`px-4 py-2.5 text-sm ${status === 'active' ? 'bg-primary font-medium text-white' : 'text-muted'}`}>Active</Link>
          <Link href={`/matters?status=closed${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`px-4 py-2.5 text-sm ${status === 'closed' ? 'bg-primary font-medium text-white' : 'text-muted'}`}>Closed</Link>
        </div>
      </form>
      <section className="card overflow-hidden">
        {matters.length === 0 ? (
          <Empty title={q ? 'No matters match that search' : status === 'closed' ? 'No closed matters yet' : 'No matters yet'}>
            {!q && status === 'active' && <p>Create a matter for each case, then add its hearings and deadlines. <Link href="/matters/new" className="text-primary underline">New matter</Link></p>}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-primary-100 text-muted">
                <tr>
                  <th className="label-caps px-5 py-2.5 font-semibold">Case</th>
                  <th className="label-caps px-3 py-2.5 font-semibold">Court</th>
                  <th className="label-caps px-3 py-2.5 font-semibold">Lead counsel</th>
                  <th className="label-caps px-5 py-2.5 font-semibold">Next date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {matters.map((m) => {
                  const n = nextBy.get(m.id);
                  const lead = staff.find((s) => s.id === m.lead_lawyer_id)?.full_name;
                  return (
                    <tr key={m.id} className="hover:bg-canvas">
                      <td className="px-5 py-3">
                        <Link href={`/matters/${m.id}`} className="font-semibold text-ink hover:underline">{m.title}</Link>
                        {m.suit_number && <div className="font-mono text-[13px] text-primary-600">{m.suit_number}</div>}
                      </td>
                      <td className="px-3 py-3 text-muted">{[m.court, m.courtroom].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-3 py-3 text-muted">{lead || '—'}</td>
                      <td className="tabular px-5 py-3">
                        {n ? (
                          <span>{relDay(new Date(n.starts_at), now) || fmtDate(new Date(n.starts_at))}, {fmtTime(new Date(n.starts_at))}{n.purpose ? <span className="text-muted"> · {n.purpose}</span> : null}</span>
                        ) : status === 'active' ? (
                          <Pill tone="warn">No next date</Pill>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
