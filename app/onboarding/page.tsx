import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { APP_NAME } from '@/lib/constants';
import OnboardingForms from './OnboardingForms';

export const metadata = { title: 'Get started' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('firm_id, full_name').eq('id', user.id).maybeSingle();
  if (profile?.firm_id) redirect('/today');
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <div className="font-display text-3xl font-extrabold tracking-tight text-primary">{APP_NAME}</div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <p className="text-muted">Create your firm&apos;s diary, or join one a colleague already set up.</p>
      </div>
      <OnboardingForms />
    </main>
  );
}
