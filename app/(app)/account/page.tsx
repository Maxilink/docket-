import { requireMember } from '@/lib/session';
import AccountForms from './AccountForms';

export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const { profile, user } = await requireMember();
  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-normal">My account</h1>
        <p className="text-muted">{user.email}</p>
      </header>
      <AccountForms name={profile.full_name} phone={profile.phone} />
    </>
  );
}
