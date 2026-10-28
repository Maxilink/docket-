'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EVENT_TYPES } from '@/lib/constants';
import { fmtDateLong, fmtTime } from '@/lib/time';
import type { EventType } from '@/lib/types';

interface Upcoming {
  id: string;
  title: string;
  type: EventType;
  starts_at: string;
  court: string | null;
  remind_day: boolean;
  remind_hour: boolean;
}
interface Due { ev: Upcoming; kind: 'day' | 'hour'; key: string }

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

/** Rings in the browser 1 day and 1 hour before the signed-in lawyer's own events, while the app is open. */
export default function AlarmWatcher({ userId }: { userId: string }) {
  const [events, setEvents] = useState<Upcoming[]>([]);
  const [due, setDue] = useState<Due[]>([]);
  const [armed, setArmed] = useState(false);
  const [wasArmed, setWasArmed] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => { setWasArmed(read('docket-armed') === '1'); }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const now = new Date();
    const until = new Date(now.getTime() + 25 * 3600 * 1000);
    const { data } = await supabase
      .from('events')
      .select('id, title, type, starts_at, court, remind_day, remind_hour')
      .eq('lawyer_id', userId)
      .is('outcome', null)
      .gt('starts_at', now.toISOString())
      .lt('starts_at', until.toISOString())
      .order('starts_at');
    setEvents((data ?? []) as Upcoming[]);
  }, [userId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const list: Due[] = [];
      for (const ev of events) {
        const at = new Date(ev.starts_at).getTime();
        if (at <= now) continue;
        const mins = (at - now) / 60000;
        let kind: 'day' | 'hour' | null = null;
        if (ev.remind_hour && mins <= 60) kind = 'hour';
        else if (ev.remind_day && mins <= 24 * 60) kind = 'day';
        if (!kind) continue;
        const key = `docket-ack:${ev.id}:${kind}:${ev.starts_at}`;
        if (read(key) !== '1') list.push({ ev, kind, key });
      }
      setDue(list);
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [events]);

  const chime = useCallback(() => {
    const ctx = audio.current;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    for (let r = 0; r < 2; r++) {
      [880, 1175, 880, 1175].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        const s = t0 + r * 1.4 + i * 0.18;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.35, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.16);
        o.connect(g).connect(ctx.destination);
        o.start(s);
        o.stop(s + 0.18);
      });
    }
  }, []);

  useEffect(() => {
    if (!armed || due.length === 0) return;
    chime();
    const id = setInterval(chime, 5000);
    return () => clearInterval(id);
  }, [armed, due.length, chime]);

  function arm() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current) audio.current = new Ctx();
      audio.current.resume();
      setArmed(true);
      write('docket-armed', '1');
      setTimeout(chime, 50);
    } catch {
      setArmed(false);
    }
  }


  return (
    <div className="flex flex-col gap-2 px-4 pt-4 sm:px-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={armed ? () => setArmed(false) : arm}
          aria-pressed={armed}
          className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-sm ${armed ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-white text-muted hover:border-muted'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          {armed ? 'Alarm sound on' : wasArmed ? 'Tap to turn alarm sound back on' : 'Turn on alarm sound'}
        </button>
      </div>
      {due.map((d) => (
        <div key={d.key} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hearing bg-hearing-soft px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold text-hearing">
              {d.kind === 'hour' ? 'Within the hour' : 'Tomorrow'}: {EVENT_TYPES[d.ev.type].label}
            </p>
            <p className="text-sm">
              {d.ev.title} · {fmtDateLong(new Date(d.ev.starts_at))} at {fmtTime(new Date(d.ev.starts_at))}
              {d.ev.court ? ` · ${d.ev.court}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/events/${d.ev.id}`} className="btn-ghost">View</Link>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                write(d.key, '1');
                if (d.kind === 'hour') write(`docket-ack:${d.ev.id}:day:${d.ev.starts_at}`, '1');
                setDue((x) => x.filter((y) => y.key !== d.key && !(d.kind === 'hour' && y.ev.id === d.ev.id)));
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
