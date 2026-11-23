'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Thin purple-to-cyan bar across the top from the moment a link is clicked until the new page shows. */
export default function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => { setActive(false); }, [path, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`h-full bg-gradient-to-r from-primary-600 via-primary-500 to-accent ${active ? 'animate-[navload_1.4s_ease-out_forwards]' : 'w-0'}`} />
      <style>{`@keyframes navload { 0% { width: 0 } 60% { width: 75% } 100% { width: 92% } }`}</style>
    </div>
  );
}
