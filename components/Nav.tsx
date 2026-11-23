'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { signOut } from '@/app/login/actions';
import { forgetDevice } from '@/components/SignOutButton';
import Logo from '@/components/Logo';

const LINKS = [
  { href: '/today', label: 'Today', icon: 'M3 10.5 12 4l9 6.5V20H3z' },
  { href: '/calendar', label: 'Calendar', icon: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4' },
  { href: '/matters', label: 'Matters', icon: 'M5 4h9l5 5v11H5zM14 4v5h5' },
  { href: '/messages', label: 'Messages', icon: 'M4 5h16v11H9l-5 4z' },
  { href: '/team', label: 'Team', icon: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6' },
];

export default function Nav({ firmName, userName, roleLabel, unread, waiting = 0 }: { appName?: string; firmName: string; userName: string; roleLabel: string; unread: number; waiting?: number }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const initials = userName.replace(/^(barr\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '•';
  const anyBadge = unread > 0 || waiting > 0;

  // Close the mobile menu after navigating and on Escape; stop the page scrolling behind it while open.
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur md:hidden"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <Link href="/today" aria-label="C-Diary, Today">
          <Logo firmName={firmName} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="main-nav"
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-line bg-white text-primary transition hover:border-primary-200 hover:bg-primary-50"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          {anyBadge && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" aria-hidden="true" />}
        </button>
      </header>

      {/* Dimmed backdrop behind the mobile menu */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-primary-800/40 backdrop-blur-[2px] transition-opacity duration-300 md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <nav
        id="main-nav"
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-7 overflow-y-auto border-r border-primary-200 bg-gradient-to-b from-primary-200 via-primary-100 to-[#C9F1F3] px-4 py-6 shadow-2xl transition-[transform,visibility] duration-300 ease-out
          md:visible md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none
          ${open ? 'visible translate-x-0' : 'invisible -translate-x-full'}`}
        style={{ paddingTop: 'max(24px, env(safe-area-inset-top))', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <Link href="/today" aria-label="C-Diary, Today" className="transition-opacity hover:opacity-85">
            <Logo firmName={firmName} />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-white/80 hover:text-primary md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {LINKS.map((l) => {
            const on = path === l.href || path.startsWith(l.href + '/');
            const count = l.href === '/messages' ? unread : l.href === '/team' ? waiting : 0;
            const badge = count > 0 && !on;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={on ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition duration-200 ${
                  on
                    ? 'bg-gradient-to-r from-primary to-primary-600 font-semibold text-white shadow-lift'
                    : 'font-medium text-primary/80 hover:translate-x-1 hover:bg-white/80 hover:text-primary hover:shadow-sm'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={on ? '#6BE3E7' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-200 group-hover:scale-110"><path d={l.icon} /></svg>
                {l.label}
                {badge && (
                  <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-primary" aria-label={l.href === '/team' ? `${count} waiting for approval` : `${count} unread`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto flex items-center gap-3 rounded-2xl border border-white/80 bg-white/70 p-3 shadow-sm backdrop-blur">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-600 to-primary text-sm font-bold text-white">{initials}</span>
          <div className="flex min-w-0 flex-col leading-tight">
            <Link href="/account" className="truncate text-sm font-semibold text-primary hover:underline">{userName || 'My account'}</Link>
            <span className="text-xs text-muted">{roleLabel}</span>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            disabled={pending}
            onClick={() => start(async () => { await forgetDevice(); await signOut(); router.replace('/login'); router.refresh(); })}
            className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-hearing-soft hover:text-hearing"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" /></svg>
          </button>
        </div>
      </nav>
    </>
  );
}
