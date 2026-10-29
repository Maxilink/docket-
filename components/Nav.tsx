'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { signOut } from '@/app/login/actions';

const LINKS = [
  { href: '/today', label: 'Today', icon: 'M3 10.5 12 4l9 6.5V20H3z' },
  { href: '/calendar', label: 'Calendar', icon: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4' },
  { href: '/matters', label: 'Matters', icon: 'M5 4h9l5 5v11H5zM14 4v5h5' },
  { href: '/messages', label: 'Messages', icon: 'M4 5h16v11H9l-5 4z' },
  { href: '/team', label: 'Team', icon: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6' },
];

export default function Nav({ appName, firmName, userName, roleLabel, unread }: { appName: string; firmName: string; userName: string; roleLabel: string; unread: number }) {
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const initials = userName.replace(/^(barr\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '•';

  return (
    <nav aria-label="Main" className="flex w-full flex-col gap-4 border-b border-line bg-white px-4 py-4 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:gap-7 md:border-b-0 md:border-r md:py-6">
      <Link href="/today" className="flex items-center gap-3 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#49AB9B" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4" /></svg>
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-extrabold tracking-tight text-primary">{appName}</span>
          <span className="text-xs text-muted">{firmName}</span>
        </span>
      </Link>
      <div className="flex gap-1 overflow-x-auto md:flex-col">
        {LINKS.map((l) => {
          const on = path === l.href || path.startsWith(l.href + '/');
          const badge = l.href === '/messages' && unread > 0 && !on;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${on ? 'bg-accent-soft font-semibold text-primary' : 'font-medium text-muted hover:bg-canvas hover:text-primary'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={on ? '#2D7A6E' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={l.icon} /></svg>
              {l.label}
              {badge && (
                <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-primary" aria-label={`${unread} unread`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
        <Link href="/account" className="flex shrink-0 items-center rounded-xl px-3 py-2.5 font-medium text-muted md:hidden">Account</Link>
      </div>
      <div className="hidden items-center gap-3 border-t border-line px-2 pt-4 md:mt-auto md:flex">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-white">{initials}</span>
        <div className="flex min-w-0 flex-col leading-tight">
          <Link href="/account" className="truncate text-sm font-semibold text-primary hover:underline">{userName || 'My account'}</Link>
          <span className="text-xs text-muted">{roleLabel}</span>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          disabled={pending}
          onClick={() => start(async () => { await signOut(); router.replace('/login'); router.refresh(); })}
          className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></svg>
        </button>
      </div>
    </nav>
  );
}
