import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/session';
import { aiConfigured } from '@/lib/ai';
import BriefForm from '../BriefForm';

export const metadata = { title: 'Draft a brief' };
export const dynamic = 'force-dynamic';

export default async function NewBriefPage(props: { searchParams: Promise<{ matter?: string; event?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireMember();
  if (!searchParams.matter || !/^[0-9a-f-]{36}$/i.test(searchParams.matter)) notFound();
  const [{ data: matter }, { data: docs }, { data: events }] = await Promise.all([
    supabase.from('matters').select('id, title, suit_number, court').eq('id', searchParams.matter).maybeSingle(),
    supabase.from('documents').select('id, name, size_bytes, summary_status').eq('matter_id', searchParams.matter).order('created_at', { ascending: false }),
    supabase.from('events').select('id, title, starts_at, purpose, type').eq('matter_id', searchParams.matter).in('type', ['hearing', 'filing']).gte('starts_at', new Date(Date.now() - 86400e3).toISOString()).order('starts_at').limit(10),
  ]);
  if (!matter) notFound();
  const canDraft = ['admin', 'partner', 'associate'].includes(profile.role);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href={`/matters/${matter.id}`} className="text-sm text-muted hover:underline">← {matter.title}</Link>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Draft a brief or written address</h1>
        <p className="mt-1 text-muted">
          The AI writes a first draft from the case file and the authorities you give it. It never adds cases from memory: where an
          authority is needed, it leaves a marked gap for you to fill.
        </p>
      </div>
      {!aiConfigured() && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">AI drafting isn&apos;t switched on yet. Add ANTHROPIC_API_KEY in Vercel, then redeploy.</p>}
      {canDraft ? (
        <BriefForm
          matter={matter as { id: string; title: string; suit_number: string | null; court: string | null }}
          docs={(docs ?? []) as { id: string; name: string; size_bytes: number | null; summary_status: string | null }[]}
          events={(events ?? []) as { id: string; title: string; starts_at: string; purpose: string | null; type: string }[]}
          initialEvent={searchParams.event ?? ''}
        />
      ) : (
        <p className="card p-5 text-muted">Only counsel (admins, partners and associates) can draft briefs. You can read the drafts on the matter page.</p>
      )}
    </div>
  );
}
