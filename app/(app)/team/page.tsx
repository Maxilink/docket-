import Link from 'next/link';
import { requireMember, getStaff } from '@/lib/session';
import { ROLES, canArchive } from '@/lib/constants';
import { Pill } from '@/components/EventBits';
import { fmtDate, fmtTime } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { JoinCode, MemberControls, ApprovalControls } from './TeamControls';

export const metadata = { title: 'Team' };
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const { supabase, profile, firm } = await requireMember();
  const staff = await getStaff(supabase);
  const isAdmin = profile.role === 'admin';
  let waiting: Profile[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from('profiles')
      .select('id, firm_id, full_name, phone, role, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at');
    waiting = (data ?? []) as Profile[];
  }
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted">{firm.name} · {staff.length} {staff.length === 1 ? 'person' : 'people'}</p>
        </div>
        {canArchive(profile.role) && (
          <div className="flex flex-wrap gap-2">
            <Link href="/activity" className="btn-ghost">Activity log</Link>
            <Link href="/archive" className="btn-ghost">Archive</Link>
          </div>
        )}
      </header>

      {isAdmin && waiting.length > 0 && (
        <section className="card overflow-hidden border-accent-ink/40">
          <div className="border-b border-line bg-accent-soft/60 px-5 py-4">
            <h2 className="font-display text-xl font-bold tracking-tight">Waiting for approval</h2>
            <p className="text-sm text-muted">These people used your join code. They can&apos;t see anything until you approve them.</p>
          </div>
          <ul className="divide-y divide-line/70">
            {waiting.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">{w.full_name || 'Unnamed'}</p>
                  <p className="text-sm text-muted">
                    {w.phone ? `+${w.phone}` : 'No phone'}
                    {w.requested_at ? ` · Asked ${fmtDate(new Date(w.requested_at))}, ${fmtTime(new Date(w.requested_at))}` : ''}
                  </p>
                </div>
                <ApprovalControls id={w.id} name={w.full_name} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-bold tracking-tight">Invite colleagues</h2>
        <p className="text-sm text-muted">
          Colleagues create an account, choose <strong className="text-ink">Join your firm</strong> and enter this code.
          {isAdmin ? ' You then approve them here and choose their role.' : ' Your firm admin then approves them.'}
          {' '}The code changes automatically whenever someone is removed.
        </p>
        <JoinCode code={firm.join_code} isAdmin={isAdmin} />
      </section>

      <section className="card overflow-hidden">
        <ul className="divide-y divide-line/70">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold">{s.full_name || 'Unnamed'}{s.id === profile.id && <span className="font-normal text-muted"> (you)</span>}</p>
                <p className="text-sm text-muted">{s.phone ? `+${s.phone}` : 'No phone yet: SMS reminders can\'t reach them'}</p>
              </div>
              {isAdmin && s.id !== profile.id ? (
                <MemberControls id={s.id} role={s.role} name={s.full_name} />
              ) : (
                <Pill tone={s.role === 'admin' ? 'good' : 'neutral'}>{ROLES.find((r) => r.value === s.role)?.label}</Pill>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="mb-2 font-display text-xl font-bold tracking-tight">What each role can do</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
          {ROLES.map((r) => (
            <div key={r.value} className="contents">
              <dt className="font-semibold">{r.label}</dt>
              <dd className="text-muted">{r.note}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
