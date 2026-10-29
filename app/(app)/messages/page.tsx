import { requireMember, getStaff } from '@/lib/session';
import MessagesView, { type Msg } from './MessagesView';

export const metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

export default async function MessagesPage({ searchParams }: { searchParams: { c?: string } }) {
  const { supabase, profile, firm } = await requireMember();
  const [staff, { data: matters }, { data: recent, error }, { data: seen }] = await Promise.all([
    getStaff(supabase),
    supabase.from('matters').select('id, title, suit_number, status').order('title').limit(1000),
    supabase.from('messages').select('id, sender_id, matter_id, recipient_id, body, created_at').order('created_at', { ascending: false }).limit(800),
    supabase.from('profiles').select('messages_seen_at').eq('id', profile.id).maybeSingle(),
  ]);

  if (error) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Messages isn&apos;t switched on yet</h1>
        <p className="mt-2 text-muted">
          Run <span className="font-mono text-primary">supabase/002_messages_and_reminders.sql</span> in the Supabase SQL Editor once, then reload this page.
        </p>
      </div>
    );
  }

  const seenAt = (seen?.messages_seen_at as string | undefined) ?? new Date(0).toISOString();
  await supabase.from('profiles').update({ messages_seen_at: new Date().toISOString() }).eq('id', profile.id);

  return (
    <MessagesView
      me={profile.id}
      firmId={firm.id}
      firmName={firm.name}
      seenAt={seenAt}
      initialKey={searchParams.c ?? 'general'}
      staff={staff.map((s) => ({ id: s.id, name: s.full_name || 'Unnamed', role: s.role }))}
      matters={(matters ?? []) as { id: string; title: string; suit_number: string | null; status: string }[]}
      initial={((recent ?? []) as Msg[]).reverse()}
    />
  );
}
