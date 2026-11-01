import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireMember, getStaff } from '@/lib/session';
import { canArchive } from '@/lib/constants';
import { Empty, SectionCard } from '@/components/EventBits';
import { fmtDate, fmtTime, ymd } from '@/lib/time';

export const metadata = { title: 'Activity log' };
export const dynamic = 'force-dynamic';

interface Entry {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
}

const FILTERS: { value: string; label: string; prefix: string | null }[] = [
  { value: 'all', label: 'Everything', prefix: null },
  { value: 'event', label: 'Hearings and events', prefix: 'event.' },
  { value: 'matter', label: 'Matters', prefix: 'matter.' },
  { value: 'client', label: 'Client texts', prefix: 'client.' },
  { value: 'staff', label: 'Staff', prefix: 'staff.' },
];

export default async function ActivityPage(props: { searchParams: Promise<{ show?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireMember();
  if (!canArchive(profile.role)) redirect('/today');
  const filter = FILTERS.find((f) => f.value === searchParams.show) ?? FILTERS[0];
  let query = supabase.from('activity_log').select('id, actor_id, action, entity, entity_id, summary, created_at').order('created_at', { ascending: false }).limit(300);
  if (filter.prefix) query = query.like('action', `${filter.prefix}%`);
  const [{ data, error }, staff] = await Promise.all([query, getStaff(supabase)]);
  const entries = (data ?? []) as Entry[];
  const who = (id: string | null) => (id ? staff.find((s) => s.id === id)?.full_name || 'A former colleague' : 'C-Diary');
  // These entries already name the person.
  const selfDescribing = new Set(['staff.requested', 'staff.withdrew', 'firm.created']);

  // Group by day.
  const days: { day: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const d = ymd(new Date(e.created_at));
    if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, items: [] });
    days[days.length - 1].items.push(e);
  }

  return (
    <>
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Activity log</h1>
          <p className="text-muted">Who added, changed, archived or texted what. Visible to partners and admins. Shows the latest 300 entries.</p>
        </div>
        <nav aria-label="Filter activity" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === 'all' ? '/activity' : `/activity?show=${f.value}`}
              aria-current={f.value === filter.value ? 'page' : undefined}
              className={`min-h-[36px] rounded-full border px-4 py-1.5 text-sm ${f.value === filter.value ? 'border-primary bg-primary font-semibold text-white' : 'border-line bg-white hover:border-muted'}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </header>
      {error ? (
        <SectionCard title="Activity">
          <Empty title="The activity log isn't available yet">
            <p>Run the database update <code className="font-mono">003_security_archive_reminders.sql</code> in Supabase.</p>
          </Empty>
        </SectionCard>
      ) : days.length === 0 ? (
        <SectionCard title="Activity">
          <Empty title="Nothing yet">
            <p>Changes made from now on appear here.</p>
          </Empty>
        </SectionCard>
      ) : (
        days.map(({ day, items }) => (
          <SectionCard key={day} title={fmtDate(new Date(items[0].created_at))}>
            <ul className="divide-y divide-line/70">
              {items.map((e) => {
                const href = e.entity === 'event' && e.entity_id ? `/events/${e.entity_id}` : e.entity === 'matter' && e.entity_id ? `/matters/${e.entity_id}` : null;
                return (
                  <li key={e.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 px-5 py-3 text-sm">
                    <span className="tabular text-muted">{fmtTime(new Date(e.created_at))}</span>
                    <span className="min-w-0">
                      {!selfDescribing.has(e.action) && <><span className="font-semibold">{who(e.actor_id)}</span>{' · '}</>}
                      {href && !/deleted|archived/.test(e.action) ? <Link href={href} className="hover:underline">{e.summary}</Link> : e.summary}
                    </span>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        ))
      )}
    </>
  );
}
