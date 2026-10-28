'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fromInputs, fmtTime } from '@/lib/time';
import type { Profile } from '@/lib/types';

interface Clash { id: string; title: string; starts_at: string; court: string | null }

/** Finds the same lawyer's other events within 3 hours of the chosen time. */
export function useClashes(lawyerId: string | null, date: string, time: string, excludeId?: string) {
  const [clashes, setClashes] = useState<Clash[]>([]);
  useEffect(() => {
    const at = fromInputs(date, time);
    if (!lawyerId || !at) { setClashes([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const supabase = createClient();
      let q = supabase
        .from('events')
        .select('id, title, starts_at, court')
        .eq('lawyer_id', lawyerId)
        .is('outcome', null)
        .gte('starts_at', new Date(at.getTime() - 3 * 3600e3).toISOString())
        .lte('starts_at', new Date(at.getTime() + 3 * 3600e3).toISOString());
      if (excludeId) q = q.neq('id', excludeId);
      const { data } = await q;
      if (!cancelled) setClashes((data ?? []) as Clash[]);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [lawyerId, date, time, excludeId]);
  return clashes;
}

export function ClashWarning({ clashes, staff, lawyerId }: { clashes: Clash[]; staff: Profile[]; lawyerId: string | null }) {
  if (!clashes.length) return null;
  const who = staff.find((s) => s.id === lawyerId)?.full_name || 'This lawyer';
  return (
    <div role="alert" className="rounded-lg border border-warn-line bg-warn-soft px-4 py-3 text-sm text-[#5C3A1E]">
      <strong className="text-warn">Possible clash:</strong> {who} also has{' '}
      {clashes.map((c, i) => (
        <span key={c.id}>
          {i > 0 && (i === clashes.length - 1 ? ' and ' : ', ')}
          <strong>{c.title}</strong> at {fmtTime(new Date(c.starts_at))}{c.court ? ` (${c.court})` : ''}
        </span>
      ))}
      {' '}around then. Pick another time, or assign another lawyer.
    </div>
  );
}
