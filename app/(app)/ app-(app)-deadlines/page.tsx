import { requireMember } from '@/lib/session';
import DeadlineCalculator from './DeadlineCalculator';
import ClosuresPanel from './ClosuresPanel';
import type { Closure } from '@/lib/deadlines';
import { ymd } from '@/lib/time';

export const metadata = { title: 'Deadlines' };
export const dynamic = 'force-dynamic';

export default async function DeadlinesPage(props: { searchParams: Promise<{ matter?: string; rule?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireMember();
  const today = ymd(new Date());
  const [closuresRes, { data: matters }] = await Promise.all([
    supabase.from('court_closures').select('id, starts_on, ends_on, label, kind, created_by').order('starts_on'),
    supabase.from('matters').select('id, title, suit_number, court').eq('status', 'active').order('title'),
  ]);
  const needsSql = Boolean(closuresRes.error);
  const closures = (closuresRes.data ?? []) as (Closure & { id: string; created_by: string | null })[];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Deadlines</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Pick the court and the process, enter the date time starts from, and C-Diary works out the last day to file. Then add it to the diary
          so reminders go out.
        </p>
      </header>
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px]">
          <DeadlineCalculator
            matters={matters ?? []}
            closures={closures}
            today={today}
            initialMatter={searchParams.matter ?? ''}
            initialRule={searchParams.rule ?? ''}
          />
        </div>
        <div className="min-w-0 flex-[1_1_300px]">
          <ClosuresPanel
            closures={closures}
            today={today}
            userId={profile.id}
            canRemoveAny={profile.role === 'admin' || profile.role === 'partner'}
            needsSql={needsSql}
          />
        </div>
      </div>
    </div>
  );
}
