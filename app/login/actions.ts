'use server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { normalisePhone } from '@/lib/phone';

export async function signIn(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Enter your email and password.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/confirm/i.test(error.message)) return { error: 'Please confirm your email first. Check your inbox for the link.' };
    return { error: 'That email and password don\'t match. Try again or reset your password.' };
  }
  return {};
}

export async function signUp(formData: FormData): Promise<ActionResult & { confirm?: boolean }> {
  const fullName = String(formData.get('full_name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!fullName) return { error: 'Enter your full name.' };
  if (!email) return { error: 'Enter your email address.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };
  const origin = (await headers()).get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone: normalisePhone(phone) ?? '' }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { confirm: !data.session };
}

export async function sendReset(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') || '').trim();
  if (!email) return { error: 'Enter your email address first.' };
  const origin = (await headers()).get('origin') || '';
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/account` });
  if (error) return { error: error.message };
  return {};
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
