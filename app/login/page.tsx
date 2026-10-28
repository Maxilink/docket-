import { APP_NAME } from '@/lib/constants';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="font-display text-4xl font-bold text-primary">{APP_NAME}</div>
        <p className="max-w-sm text-muted">The court diary for your chambers: hearings, adjournments, deadlines and reminders in one place.</p>
      </div>
      <LoginForm />
    </main>
  );
}
