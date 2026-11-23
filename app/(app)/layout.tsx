import { Suspense } from 'react';
import Nav from '@/components/Nav';
import NavProgress from '@/components/NavProgress';
import AlarmWatcher from '@/components/AlarmWatcher';
import AppServiceWorker from '@/components/AppServiceWorker';
import { requireMember } from '@/lib/session';
import { APP_NAME, ROLES } from '@/lib/constants';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, firm } = await requireMember();
  const roleLabel = ROLES.find((r) => r.value === profile.role)?.label ?? '';

  // Unread messages since this person last opened Messages. Shows 0 if the messages update hasn't been installed yet.
  // Both badge lookups run at the same time.
  const unreadP = (async () => {
    const { data: seen, error: seenErr } = await supabase.from('profiles').select('messages_seen_at').eq('id', profile.id).maybeSingle();
    if (seenErr || !seen?.messages_seen_at) return 0;
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', seen.messages_seen_at)
      .neq('sender_id', profile.id);
    return count ?? 0;
  })();

  // People waiting for the admin to approve them.
  const waitingP = (async () => {
    if (profile.role !== 'admin') return 0;
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    return count ?? 0;
  })();

  const [unread, waiting] = await Promise.all([unreadP, waitingP]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Nav appName={APP_NAME} firmName={firm.name} userName={profile.full_name} roleLabel={roleLabel} unread={unread} waiting={waiting} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppServiceWorker />
        <AlarmWatcher userId={profile.id} />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
