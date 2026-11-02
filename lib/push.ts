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
let problem = '';

/** Removes spaces, line breaks and quotes that often sneak in when keys are pasted into Vercel. */
const tidy = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');

/** True when the VAPID keys are set in the environment and valid. */
export function pushConfigured() {
  if (configured !== null) return configured;
  const pub = tidy(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const priv = tidy(process.env.VAPID_PRIVATE_KEY);
  let subject = (process.env.VAPID_SUBJECT ?? '').trim().replace(/^["']|["']$/g, '').replace(/^mailto:\s+/i, 'mailto:');
  if (subject && !/^(mailto:|https:\/\/)/i.test(subject) && subject.includes('@')) subject = `mailto:${subject}`;
  if (!pub) { problem = 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing in Vercel.'; return (configured = false); }
  if (!priv) { problem = 'VAPID_PRIVATE_KEY is missing in Vercel, or the site hasn\'t been redeployed since it was added.'; return (configured = false); }
  try {
    webpush.setVapidDetails(subject || 'mailto:support@example.com', pub, priv);
    configured = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    problem = /subject/i.test(msg)
      ? 'VAPID_SUBJECT must start with mailto: followed by an email address, e.g. mailto:admin@yourfirm.com.'
      : /private/i.test(msg)
        ? 'VAPID_PRIVATE_KEY is not valid. Copy the Private Key again from the npx web-push output.'
        : /public/i.test(msg)
          ? 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is not valid. Copy the Public Key again from the npx web-push output.'
          : `The VAPID keys were rejected: ${msg}`;
    configured = false;
  }
  return configured;
}

/** Why push notifications aren't working on the server, in plain words. Empty when they are. */
export function pushProblem() {
  pushConfigured();
  return problem;
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
