'use server';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

const clean = (m: string) => m.replace(/^.*?ERROR:\s*/i, '');

export async function createFirm(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('firm_name') || '').trim();
  if (name.length < 2) return { error: 'Enter your firm\'s name.' };
  const supabase = createClient();
  const { error } = await supabase.rpc('create_firm', { firm_name: name });
  if (error) return { error: clean(error.message) };
  return {};
}

export async function joinFirm(formData: FormData): Promise<ActionResult> {
  const code = String(formData.get('code') || '').trim();
  if (!code) return { error: 'Enter the join code your firm admin gave you.' };
  const supabase = createClient();
  const { error } = await supabase.rpc('join_firm', { code });
  if (error) return { error: clean(error.message) };
  return {};
}
