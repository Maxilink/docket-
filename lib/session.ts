import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Firm, Profile } from '@/lib/types';

/** Signed-in user with a firm. Sends people to /login or /onboarding when that isn't true yet. */
export async function requireMember() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('id, firm_id, full_name, phone, role').eq('id', user.id).maybeSingle();
  if (!profile || !profile.firm_id) redirect('/onboarding');
  const { data: firm } = await supabase.from('firms').select('id, name, join_code').eq('id', profile.firm_id).maybeSingle();
  if (!firm) redirect('/onboarding');
  return { supabase, user, profile: profile as Profile, firm: firm as Firm };
}

export async function getStaff(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('profiles').select('id, firm_id, full_name, phone, role').order('full_name');
  return (data ?? []) as Profile[];
}

export function firstName(name: string) {
  const cleaned = name.replace(/^(barr\.?|barrister|mr\.?|mrs\.?|ms\.?|dr\.?|chief)\s+/i, '').trim();
  return cleaned.split(/\s+/)[0] || 'there';
}
