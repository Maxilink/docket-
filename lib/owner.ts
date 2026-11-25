import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** The platform owner's sign-in emails, from OWNER_EMAILS in Vercel (comma-separated). */
function ownerEmails() {
  return (process.env.OWNER_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined) {
  return Boolean(email) && ownerEmails().includes(email!.toLowerCase());
}

/**
 * The owner dashboard is for the platform owner only. Anyone else gets "not found", so the page
 * doesn't reveal that it exists. Returns the full-access database client for owner work.
 */
export const requireOwner = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!user.email_confirmed_at || !isOwnerEmail(user.email)) notFound();
  return { user, admin: createAdminClient() };
});
