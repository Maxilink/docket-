'use client';
import { useEffect, useState } from 'react';

/** Registers the service worker (offline pages and notifications) and shows a bar when there's no signal. */
export default function AppServiceWorker() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* offline mode simply isn't available */ });
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-30 bg-primary px-4 py-2 text-center text-sm text-white">
      You&apos;re offline. You&apos;re seeing the last saved copy of this page, so changes can&apos;t be saved until you&apos;re back online.
    </div>
  );
}
