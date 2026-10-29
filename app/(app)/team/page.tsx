import { requireMember, getStaff } from '@/lib/session';
import { ROLES } from '@/lib/constants';
import { Pill } from '@/components/EventBits';
import { JoinCode, MemberControls } from './TeamControls';

export const metadata = { title: 'Team' };
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const { supabase, profile, firm } = await requireMember();
  const staff = await getStaff(supabase);
  const isAdmin = profile.role === 'admin';
  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Team</h1>
        <p className="text-muted">{firm.name} · {staff.length} {staff.length === 1 ? 'person' : 'people'}</p>
      </header>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="font-display text-xl font-bold tracking-tight">Invite colleagues</h2>
        <p className="text-sm text-muted">Colleagues create an account, choose <strong className="text-ink">Join your firm</strong> and enter this code. They join as Associates{isAdmin ? '; change their role below' : ''}.</p>
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
