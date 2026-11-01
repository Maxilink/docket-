import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PushPayload {
  title: string;
  body: string;
  /** Page to open when the notification is tapped, e.g. /events/123 */
  url?: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag?: string;
}

let configured: boolean | null = null;

/** True when the VAPID keys are set in the environment. */
export function pushConfigured() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@example.com', pub, priv);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

/**
 * Sends a notification to every phone and browser the person has switched notifications on for.
 * Returns how many devices it reached. Subscriptions the browser has cancelled are removed.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  if (!subs?.length) return 0;
  const body = JSON.stringify(payload);
  let reached = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 6 * 3600, urgency: 'high' });
        reached++;
        await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      }
    }),
  );
  return reached;
}
