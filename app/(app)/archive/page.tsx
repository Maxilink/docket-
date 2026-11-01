import { redirect } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { canArchive, canDeleteForever } from '@/lib/constants';
import { Empty, SectionCard } from '@/components/EventBits';
import { fmtDate, fmtTime } from '@/lib/time';
import ArchiveRowControls from './ArchiveRowControls';

export const metadata = { title: 'Archive' };
export const dynamic = 'force-dynamic';

interface Item {
  kind: 'matter' | 'event';
  id: string;
  title: string;
  detail: string | null;
  starts_at: string | null;
  archived_at: string;
  archived_by_name: string | null;
}

export default async function ArchivePage() {
  const { supabase, profile } = await requireMember();
  if (!canArchive(profile.role)) redirect('/today');
  const { data, error } = await supabase.rpc('archived_items');
  const items = (data ?? []) as Item[];
  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Archive</h1>
        <p className="text-muted">
          Archived matters and events are hidden from the diary and get no reminders. Restore them at any time.
          {canDeleteForever(profile.role) ? ' Only admins can delete permanently.' : ''}
        </p>
      </header>
      <SectionCard title="Archived" aside={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}>
        {error ? (
          <Empty title="The archive isn't available yet">
            <p>Run the database update <code className="font-mono">003_security_archive_reminders.sql</code> in Supabase.</p>
          </Empty>
        ) : items.length === 0 ? (
          <Empty title="Nothing archived">
            <p>When a partner or admin archives a matter or event, it appears here.</p>
          </Empty>
        ) : (
          <ul className="divide-y divide-line/70">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="label-caps text-muted">{it.kind === 'matter' ? 'Matter' : 'Event'}</p>
                  <p className="font-semibold">{it.title}</p>
                  <p className="text-sm text-muted">
                    {[it.starts_at ? `${fmtDate(new Date(it.starts_at))}, ${fmtTime(new Date(it.starts_at))}` : null, it.detail]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="text-xs text-muted">
                    Archived {fmtDate(new Date(it.archived_at))}{it.archived_by_name ? ` by ${it.archived_by_name}` : ''}
                  </p>
                </div>
                <ArchiveRowControls kind={it.kind} id={it.id} title={it.title} canDelete={canDeleteForever(profile.role)} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
