'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function OwnerTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Owner sections" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-8">
      {tabs.map((t) => {
        const on = t.href === '/owner' ? path === '/owner' || path.startsWith('/owner/firms') : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${on ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-primary'}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
