import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Logo from '@/components/Logo';
import OnboardingForms, { WaitingForApproval } from './OnboardingForms';

export const metadata = { title: 'Get started' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('firm_id, full_name, status').eq('id', user.id).maybeSingle();
  if (profile?.firm_id && profile.status !== 'pending') redirect('/today');

  let firmName = '';
  if (profile?.status === 'pending') {
    const { data } = await supabase.rpc('my_membership');
    firmName = (data as { firm_name: string }[] | null)?.[0]?.firm_name ?? 'your firm';
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <Logo size="lg" />
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        {!firmName && <p className="text-muted">Create your firm&apos;s diary, or join one a colleague already set up.</p>}
      </div>
      {firmName ? <WaitingForApproval firmName={firmName} /> : <OnboardingForms />}
    </main>
  );
}
