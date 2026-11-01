import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Firm, Profile } from '@/lib/types';

/** Signed-in user with a firm. Sends people to /login or /onboarding when that isn't true yet. */
export async function requireMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('id, firm_id, full_name, phone, role, status').eq('id', user.id).maybeSingle();
  // People waiting for approval stay on the onboarding page until an admin lets them in.
  if (!profile || !profile.firm_id || profile.status === 'pending') redirect('/onboarding');
  const { data: firm } = await supabase.from('firms').select('id, name, join_code').eq('id', profile.firm_id).maybeSingle();
  if (!firm) redirect('/onboarding');
  return { supabase, user, profile: profile as Profile, firm: firm as Firm };
}

export async function getStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Approved colleagues only. (Admins can also see people waiting to join; the Team page lists those separately.)
  const { data } = await supabase.from('profiles').select('id, firm_id, full_name, phone, role, status').eq('status', 'active').order('full_name');
  return (data ?? []) as Profile[];
}

export function firstName(name: string) {
  const cleaned = name.replace(/^(barr\.?|barrister|mr\.?|mrs\.?|ms\.?|dr\.?|chief)\s+/i, '').trim();
  return cleaned.split(/\s+/)[0] || 'there';
}
