import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Firm, Profile } from '@/lib/types';

/**
 * Signed-in user with a firm. Sends people to /login or /onboarding when that isn't true yet.
 * Wrapped in cache() so the layout and the page share one lookup per request instead of repeating it.
 */
export const requireMember = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // Profile and firm in one round trip.
  const { data: row } = await supabase
    .from('profiles')
    .select('id, firm_id, full_name, phone, role, status, firm:firms(id, name, join_code)')
    .eq('id', user.id)
    .maybeSingle();
  const r = row as (Profile & { status?: string; firm: Firm | Firm[] | null }) | null;
  // People waiting for approval stay on the onboarding page until an admin lets them in.
  if (!r || !r.firm_id || r.status === 'pending') redirect('/onboarding');
  const firm = Array.isArray(r.firm) ? r.firm[0] : r.firm;
  if (!firm) redirect('/onboarding');
  const { firm: _f, ...profile } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { supabase, user, profile: profile as Profile, firm: firm as Firm };
});

export async function getStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Approved colleagues only. (Admins can also see people waiting to join; the Team page lists those separately.)
  const { data } = await supabase.from('profiles').select('id, firm_id, full_name, phone, role, status').eq('status', 'active').order('full_name');
  return (data ?? []) as Profile[];
}

export function firstName(name: string) {
  const cleaned = name.replace(/^(barr\.?|barrister|mr\.?|mrs\.?|ms\.?|dr\.?|chief)\s+/i, '').trim();
  return cleaned.split(/\s+/)[0] || 'there';
}
