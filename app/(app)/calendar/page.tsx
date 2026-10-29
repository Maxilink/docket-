import { requireMember, getStaff } from '@/lib/session';
import { EVENT_SELECT } from '@/components/EventBits';
import { lagos, parts, ymd } from '@/lib/time';
import type { DiaryEvent } from '@/lib/types';
import CalendarView from './CalendarView';

export const metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage(props: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase } = await requireMember();
  const now = new Date();
  const p = parts(now);
  let y = p.y;
  let m = p.m;
  const match = /^(\d{4})-(\d{2})$/.exec(searchParams.m ?? '');
  if (match) {
    y = Number(match[1]);
    m = Math.min(11, Math.max(0, Number(match[2]) - 1));
  }
  const first = lagos(y, m, 1);
  const offset = (parts(first).dow + 6) % 7; // Monday first
  const gridStart = lagos(y, m, 1 - offset);
  const gridEnd = lagos(y, m, 1 - offset + 42);

  const [{ data }, staff] = await Promise.all([
    supabase.from('events').select(EVENT_SELECT).gte('starts_at', gridStart.toISOString()).lt('starts_at', gridEnd.toISOString()).order('starts_at'),
    getStaff(supabase),
  ]);

  const today = ymd(now);
  const inMonth = searchParams.d && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d) ? searchParams.d : null;
  const selected = inMonth ?? (p.y === y && p.m === m ? today : ymd(first));

  return (
    <CalendarView
      year={y}
      month={m}
      gridStart={gridStart.toISOString()}
      today={today}
      initialSelected={selected}
      events={(data ?? []) as unknown as DiaryEvent[]}
      staff={staff.map((s) => ({ id: s.id, name: s.full_name }))}
    />
  );
}
