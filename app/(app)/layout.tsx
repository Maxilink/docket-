import Nav from '@/components/Nav';
import AlarmWatcher from '@/components/AlarmWatcher';
import { requireMember } from '@/lib/session';
import { APP_NAME, ROLES } from '@/lib/constants';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, firm } = await requireMember();
  const roleLabel = ROLES.find((r) => r.value === profile.role)?.label ?? '';
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav appName={APP_NAME} firmName={firm.name} userName={profile.full_name} roleLabel={roleLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AlarmWatcher userId={profile.id} />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
