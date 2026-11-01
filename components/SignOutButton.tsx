'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { signOut } from '@/app/login/actions';
import { removePushSubscription } from '@/app/(app)/actions';

/** On sign-out, forget this device: stop its notifications and delete the pages saved for offline use. */
export async function forgetDevice() {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('cdiary-pages')).map((k) => caches.delete(k)));
    }
  } catch {
    // Best effort: signing out must still work.
  }
}

/** Sign-out button for the account page (the sidebar's sign-out is hidden on phones). */
export default function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost self-start"
      disabled={pending}
      onClick={() => start(async () => { await forgetDevice(); await signOut(); router.replace('/login'); router.refresh(); })}
    >
      {pending ? 'Signing out…' : 'Sign out of this device'}
    </button>
  );
}
