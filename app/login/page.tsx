import Link from 'next/link';
import Logo from '@/components/Logo';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage(props: { searchParams: Promise<{ mode?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1><Link href="/" aria-label="C-Diary home"><Logo size="lg" /></Link></h1>
        <p className="max-w-sm text-muted">The court diary for your chambers: hearings, adjournments, deadlines and reminders in one place.</p>
      </div>
      <LoginForm initialMode={searchParams.mode === 'signup' ? 'up' : 'in'} />
    </main>
  );
}
