import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Full-access client for background jobs (reminders). Server only: never import into a client component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
