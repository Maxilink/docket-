'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BRIEF_KINDS, LENGTHS, MAX_FULL_DOCS, PRIMSOL_URL, SIDES, type BriefLength, type BriefRow } from '@/lib/brief';
import { fmtDate, fmtTime } from '@/lib/time';

interface Props {
  matter: { id: string; title: string; suit_number: string | null; court: string | null };
  docs: { id: string; name: string; size_bytes: number | null; summary_status: string | null }[];
  events: { id: string; title: string; starts_at: string; purpose: string | null; type: string }[];
  initialEvent?: string;
  /** When given, the form edits this draft's instructions and redrafts it. */
  brief?: BriefRow;
  onRedraft?: () => void;
}

const mb = (n: number | null) => (n ? `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB` : '');

export default function BriefForm({ matter, docs, events, initialEvent = '', brief, onRedraft }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [kind, setKind] = useState(brief?.kind ?? BRIEF_KINDS[0].value);
  const [side, setSide] = useState(brief?.side ?? '');
  const [eventId, setEventId] = useState(brief?.event_id ?? initialEvent);
  const [title, setTitle] = useState(brief?.title ?? '');
  const [issues, setIssues] = useState(brief?.issues ?? '');
  const [instructions, setInstructions] = useState(brief?.instructions ?? '');
  const [authorities, setAuthorities] = useState(brief?.authorities ?? '');
  const [length, setLength] = useState<BriefLength>(brief?.length ?? 'standard');
  const [picked, setPicked] = useState<string[]>(brief?.document_ids ?? []);

  const autoTitle = /^(Appellant|Respondent)’s /.test(kind) || !side || kind === 'Legal opinion' ? kind : `${side}’s ${kind.charAt(0).toLowerCase()}${kind.slice(1)}`;

  function toggleDoc(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_FULL_DOCS ? p : [...p, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const row = {
      kind,
      side: side || null,
      event_id: eventId || null,
      title: (title.trim() || autoTitle).slice(0, 200),
      issues: issues.trim() || null,
      instructions: instructions.trim() || null,
      authorities: authorities.trim() || null,
      length,
      document_ids: picked,
    };
    start(async () => {
      const supabase = createClient();
      if (brief) {
        const { error: err } = await supabase.from('briefs').update(row).eq('id', brief.id);
        if (err) return setError('That didn’t save. Try again.');
        onRedraft?.();
        return;
      }
      const { data, error: err } = await supabase.from('briefs').insert({ ...row, matter_id: matter.id, status: 'working' }).select('id').single();
      if (err || !data) {
        return setError(/relation|does not exist|schema cache/i.test(err?.message ?? '') ? 'Run update 008 in Supabase first, then try again.' : 'That didn’t save. Try again.');
      }
      router.push(`/briefs/${data.id}?run=1`);
    });
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-5 p-5 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <label className="field" htmlFor="b-kind">What are you drafting?
          <select id="b-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {BRIEF_KINDS.map((k) => <option key={k.value} value={k.value}>{k.value}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="b-side">We act for the
          <select id="b-side" className="input" value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="">Choose</option>
            {SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <label className="field" htmlFor="b-title">Title
          <input id="b-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={autoTitle} />
        </label>
        <label className="field" htmlFor="b-event">For which date? (optional)
          <select id="b-event" className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Not linked to a date</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{fmtDate(new Date(ev.starts_at))}, {fmtTime(new Date(ev.starts_at))}: {ev.purpose || ev.title}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="field" htmlFor="b-issues">Issues for determination (optional, one per line)
        <textarea id="b-issues" rows={3} className="input py-2" value={issues} onChange={(e) => setIssues(e.target.value)} maxLength={4000}
          placeholder="Leave empty and the AI will propose issues from the file. Issues you type are used word for word." />
      </label>

      <label className="field" htmlFor="b-instr">Your instructions and key points
        <textarea id="b-instr" rows={5} className="input py-2" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={8000}
          placeholder="What we want, the points to press, weaknesses to deal with, evidence to rely on (e.g. Exhibit C, DW1's admission under cross-examination)…" />
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="field" htmlFor="b-auth">Authorities to rely on
          <textarea id="b-auth" rows={6} className="input py-2 font-mono text-[13px]" value={authorities} onChange={(e) => setAuthorities(e.target.value)} maxLength={20000}
            placeholder={'One per line, with what each decides, e.g.\nOkafor v. Ezenwa (2002) 13 NWLR (Pt. 784) 319: a party is bound by its pleadings\nSection 131 Evidence Act 2011: burden of proof'} />
        </label>
        <p className="text-sm text-muted">
          The AI cites only what you list here or what is in the documents. Paste a short note of what each authority decides so it is used correctly.{' '}
          <a href={PRIMSOL_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Find authorities in Primsol</a>
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-muted">Documents to read in full (up to {MAX_FULL_DOCS})</legend>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">No documents on this matter yet. Upload the pleadings, processes or record on the matter page for a better draft.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {docs.map((d) => (
              <li key={d.id}>
                <label className="flex items-start gap-2.5 text-[15px]">
                  <input type="checkbox" checked={picked.includes(d.id)} onChange={() => toggleDoc(d.id)} disabled={!picked.includes(d.id) && picked.length >= MAX_FULL_DOCS} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
                  <span className="min-w-0">
                    <span className="break-words">{d.name}</span>{' '}
                    <span className="text-sm text-muted">{mb(d.size_bytes)}{d.summary_status === 'done' ? ', summarised' : ''}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">Documents you don&apos;t tick are still used through their AI summaries, if they have one.</p>
      </fieldset>

      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 w-full text-sm font-medium text-muted">Length</legend>
        {(Object.keys(LENGTHS) as BriefLength[]).map((k) => (
          <label key={k} className="flex items-center gap-2 text-[15px]">
            <input type="radio" name="b-length" checked={length === k} onChange={() => setLength(k)} className="h-5 w-5 accent-primary" /> {LENGTHS[k].label}
          </label>
        ))}
      </fieldset>

      {error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : brief ? 'Save and redraft' : 'Write the draft'}</button>
        <span className="text-sm text-muted">{brief ? 'This replaces the current draft. You can undo it afterwards.' : 'Drafting takes one to three minutes.'}</span>
      </div>
    </form>
  );
}
