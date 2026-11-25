import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { aiConfigured } from '@/lib/ai';
import { BRIEF_COLUMNS, type BriefRow } from '@/lib/brief';
import BriefEditor from './BriefEditor';

export const metadata = { title: 'Draft' };
export const dynamic = 'force-dynamic';

export default async function BriefPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireMember();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { data: row } = await supabase.from('briefs').select(BRIEF_COLUMNS).eq('id', params.id).maybeSingle();
  if (!row) notFound();
  const brief = row as unknown as BriefRow;
  const [{ data: matter }, { data: docs }, { data: events }, { data: author }] = await Promise.all([
    supabase.from('matters').select('id, title, suit_number, court').eq('id', brief.matter_id).maybeSingle(),
    supabase.from('documents').select('id, name, size_bytes, summary_status').eq('matter_id', brief.matter_id).order('created_at', { ascending: false }),
    supabase.from('events').select('id, title, starts_at, purpose, type').eq('matter_id', brief.matter_id).in('type', ['hearing', 'filing']).gte('starts_at', new Date(Date.now() - 86400e3).toISOString()).order('starts_at').limit(10),
    brief.created_by ? supabase.from('profiles').select('full_name').eq('id', brief.created_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!matter) notFound();
  const canEdit = ['admin', 'partner', 'associate'].includes(profile.role);
  const canDelete = brief.created_by === profile.id || profile.role === 'admin' || profile.role === 'partner';

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/matters/${matter.id}`} className="text-sm text-muted hover:underline print:hidden">← {matter.title}</Link>
      <BriefEditor
        brief={brief}
        matter={matter as { id: string; title: string; suit_number: string | null; court: string | null }}
        docs={(docs ?? []) as { id: string; name: string; size_bytes: number | null; summary_status: string | null }[]}
        events={(events ?? []) as { id: string; title: string; starts_at: string; purpose: string | null; type: string }[]}
        authorName={(author as { full_name?: string } | null)?.full_name ?? null}
        canEdit={canEdit}
        canDelete={canDelete}
        autoRun={searchParams.run === '1'}
        aiReady={aiConfigured()}
      />
    </div>
  );
}
