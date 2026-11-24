import { requireMember } from '@/lib/session';
import PushToggle from '@/components/PushToggle';
import SignOutButton from '@/components/SignOutButton';
import AccountForms from './AccountForms';
import MorningListToggle from '@/components/MorningListToggle';

export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const { supabase, profile, user } = await requireMember();
  const { data: pref } = await supabase.from('profiles').select('morning_list').eq('id', profile.id).maybeSingle();
  const morningOn = (pref as { morning_list?: boolean } | null)?.morning_list !== false;
  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">My account</h1>
        <p className="text-muted">{user.email}</p>
      </header>
      <AccountForms name={profile.full_name} phone={profile.phone} />
      <MorningListToggle initial={morningOn} hasPhone={Boolean(profile.phone)} />
      <PushToggle />
      <SignOutButton />
    </>
  );
}
