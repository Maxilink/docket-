import { Suspense } from 'react';
import Nav from '@/components/Nav';
import NavProgress from '@/components/NavProgress';
import AlarmWatcher from '@/components/AlarmWatcher';
import AppServiceWorker from '@/components/AppServiceWorker';
import { requireMember } from '@/lib/session';
import { APP_NAME, ROLES } from '@/lib/constants';
import { accessState, SUB_COLUMNS, type Subscription } from '@/lib/billing';
import { isOwnerEmail } from '@/lib/owner';
import { signOut } from '@/app/login/actions';
import Link from 'next/link';
import { fmtDate } from '@/lib/time';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, firm } = await requireMember();
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

  // The firm's plan (update 009). If billing isn't installed yet, nothing is shown.
  const accessP = (async () => {
    const [{ data: f }, { data: sub, error }] = await Promise.all([
      supabase.from('firms').select('created_at').eq('id', firm.id).maybeSingle(),
      supabase.from('firm_subscriptions').select(SUB_COLUMNS).eq('firm_id', firm.id).maybeSingle(),
    ]);
    if (error || !f) return null;
    return accessState(f.created_at, (sub ?? null) as Subscription | null);
  })();

  const [unread, waiting, access] = await Promise.all([unreadP, waitingP, accessP]);
  const isAdmin = profile.role === 'admin';
  const isOwner = isOwnerEmail(user.email);

  // A suspended firm can't use the app; the owner can still get in to manage things.
  if (access?.state === 'suspended' && !isOwner) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl font-bold">{firm.name}&apos;s C-Diary account is suspended</h1>
        <p className="text-muted">{access.reason ?? 'Contact C-Diary to restore access.'}</p>
        <p className="text-sm text-muted">Your matters, dates and documents are kept safe and will be there when access is restored.</p>
        <form action={signOut}><button type="submit" className="btn-ghost">Sign out</button></form>
      </main>
    );
  }

  let banner: { text: string; link: boolean } | null = null;
  if (access?.state === 'expired') banner = { text: `Your firm's C-Diary plan ended on ${fmtDate(access.endsAt!)}.`, link: true };
  else if (access?.state === 'trial' && access.daysLeft <= 7) banner = { text: `Your free trial ends in ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'}.`, link: true };
  else if (access?.state === 'active' && access.daysLeft <= 5) banner = { text: `Your plan ends in ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'}.`, link: true };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Nav appName={APP_NAME} firmName={firm.name} userName={profile.full_name} roleLabel={roleLabel} unread={unread} waiting={waiting} isAdmin={isAdmin} isOwner={isOwner} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppServiceWorker />
        <AlarmWatcher userId={profile.id} />
        {banner && (
          <div role="status" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warn-soft px-4 py-2.5 text-center text-sm text-warn print:hidden">
            <span>{banner.text}</span>
            {isAdmin ? <Link href="/billing" className="font-semibold underline">Choose a plan</Link> : <span>Ask your firm&apos;s admin to renew.</span>}
          </div>
        )}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
