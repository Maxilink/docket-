'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { signOut } from '@/app/login/actions';

const LINKS = [
  { href: '/today', label: 'Today', icon: 'M3 10.5 12 4l9 6.5V20H3z' },
  { href: '/calendar', label: 'Calendar', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { href: '/matters', label: 'Matters', icon: 'M5 4h9l5 5v11H5zM14 4v5h5' },
  { href: '/team', label: 'Team', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9' },
];

export default function Nav({ appName, firmName, userName, roleLabel }: { appName: string; firmName: string; userName: string; roleLabel: string }) {
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const initials = userName.replace(/^(barr\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '•';

  return (
    <nav aria-label="Main" className="flex w-full flex-col gap-4 bg-primary px-4 py-4 text-[#C8D6DA] md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:gap-6 md:py-6">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex flex-col">
          <span className="font-display text-2xl font-bold text-white">{appName}</span>
          <span className="label-caps text-accent">{firmName}</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto md:flex-col">
        {LINKS.map((l) => {
          const on = path === l.href || path.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 ${on ? 'bg-primary-600 font-medium text-white' : 'hover:bg-primary-700 hover:text-white'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={l.icon} /></svg>
              {l.label}
            </Link>
          );
        })}
        <Link href="/account" className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-primary-700 hover:text-white md:hidden">Account</Link>
      </div>
      <div className="hidden items-center gap-3 border-t border-primary-600 px-2 pt-4 md:mt-auto md:flex">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold text-primary">{initials}</span>
        <div className="flex min-w-0 flex-col leading-tight">
          <Link href="/account" className="truncate text-sm font-medium text-white hover:underline">{userName || 'My account'}</Link>
          <span className="text-xs">{roleLabel}</span>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          disabled={pending}
          onClick={() => start(async () => { await signOut(); router.replace('/login'); router.refresh(); })}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-primary-700 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></svg>
        </button>
      </div>
    </nav>
  );
}
