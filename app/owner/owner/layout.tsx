import Link from 'next/link';
import { requireOwner } from '@/lib/owner';
import Logo from '@/components/Logo';
import OwnerTabs from '@/components/OwnerTabs';

export const metadata = { title: 'Owner' };
export const dynamic = 'force-dynamic';

const TABS = [
  { href: '/owner', label: 'Firms' },
  { href: '/owner/users', label: 'Users' },
  { href: '/owner/payments', label: 'Payments' },
  { href: '/owner/plans', label: 'Plans' },
];

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireOwner();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Link href="/owner" aria-label="Owner dashboard"><Logo /></Link>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">Owner</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{user.email}</span>
            <Link href="/today" className="btn-ghost">My diary</Link>
          </div>
        </div>
        <OwnerTabs tabs={TABS} />
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
