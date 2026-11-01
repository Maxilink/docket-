'use client';
import { useEffect, useState, useTransition } from 'react';
import { removePushSubscription, savePushSubscription, sendTestPush } from '@/app/(app)/actions';

type State = 'loading' | 'unsupported' | 'ios-install' | 'blocked' | 'off' | 'on';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Notifications on this device" switch for the account page. */
export default function PushToggle() {
  const [state, setState] = useState<State>('loading');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return setState(ios && !standalone ? 'ios-install' : 'unsupported');
      }
      if (Notification.permission === 'denied') return setState('blocked');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  const turnOn = () => start(async () => {
    setMsg(null);
    if (!VAPID) return setMsg({ text: 'Notifications aren\'t set up on the server yet. Ask whoever manages C-Diary to add the VAPID keys.', ok: false });
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setState(permission === 'denied' ? 'blocked' : 'off');
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription(json, navigator.userAgent);
      if (r.error) return setMsg({ text: r.error, ok: false });
      setState('on');
      const t = await sendTestPush();
      setMsg(t.error ? { text: t.error, ok: false } : { text: 'Notifications are on. We sent a test to this device.', ok: true });
    } catch {
      setMsg({ text: 'This browser didn\'t allow notifications. Check its settings and try again.', ok: false });
    }
  });

  const turnOff = () => start(async () => {
    setMsg(null);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState('off');
    setMsg({ text: 'Notifications are off on this device.', ok: true });
  });

  return (
    <section className="card flex flex-col gap-3 p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">Notifications on this device</h2>
      <p className="text-sm text-muted">Get hearing reminders on this phone or computer, 1 day and 1 hour before. They&apos;re free and arrive even when C-Diary is closed. Nothing is sent between 8pm and 7am.</p>
      {state === 'loading' && <p className="text-sm text-muted">Checking this device…</p>}
      {state === 'unsupported' && <p className="text-sm text-muted">This browser can&apos;t receive notifications. Try Chrome, Edge, Firefox or Safari on an up-to-date device.</p>}
      {state === 'ios-install' && (
        <p className="rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary">
          On iPhone and iPad, add C-Diary to your Home Screen first: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Open it from there and switch notifications on. Needs iOS 16.4 or later.
        </p>
      )}
      {state === 'blocked' && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Notifications are blocked for C-Diary in this browser&apos;s settings. Allow them there, then reload this page.</p>}
      {state === 'off' && <button type="button" className="btn-primary self-start" disabled={pending} onClick={turnOn}>{pending ? 'Switching on…' : 'Switch on notifications'}</button>}
      {state === 'on' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => { const t = await sendTestPush(); setMsg(t.error ? { text: t.error, ok: false } : { text: 'Test sent.', ok: true }); })}>Send a test</button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={turnOff}>Switch off</button>
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-accent-ink' : 'text-hearing'}`}>{msg.text}</p>}
    </section>
  );
}
