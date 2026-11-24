'use client';
import { useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deleteDocument } from '@/app/(app)/actions';
import { fmtDate, fmtTime } from '@/lib/time';
import { DOC_COLUMNS } from '@/lib/docs';

export interface Doc {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  summary: string | null;
  summary_status: 'none' | 'working' | 'done' | 'failed';
  summary_error: string | null;
  summarized_at: string | null;
  event_id?: string | null;
  url?: string | null;
}

interface Props {
  firmId: string;
  matterId: string;
  me: string;
  canManageAll: boolean;
  aiReady: boolean;
  staff: { id: string; name: string }[];
  initial: Doc[];
  /** On a hearing page: uploads belong to this hearing. */
  eventId?: string;
  /** On the case file: hearings a document can be tagged to. */
  hearings?: { id: string; label: string }[];
  title?: string;
}

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.webp,.txt,.md,.csv';
const HEADINGS = ['What this is', 'Parties', 'Key points', 'Dates and deadlines', 'Orders, reliefs or demands', 'Suggested next steps'];

const sizeLabel = (n: number | null) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const kindOf = (name: string) => {
  const e = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();
  if (e === 'pdf') return { label: 'PDF', cls: 'bg-hearing-soft text-hearing' };
  if (e === 'docx' || e === 'doc') return { label: 'DOC', cls: 'bg-primary-100 text-primary' };
  if (['jpg', 'jpeg', 'png', 'webp'].includes(e)) return { label: 'IMG', cls: 'bg-accent-soft text-accent-ink' };
  return { label: (e || 'FILE').slice(0, 4).toUpperCase(), cls: 'bg-filing-soft text-filing' };
};
const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-120) || 'document';

/** Renders the summary's headings and "- " bullets. Plain text only: nothing from the summary is treated as HTML. */
function Summary({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (k: string) => {
    if (bullets.length) out.push(<ul key={`u${k}`} className="mb-2 ml-5 list-disc space-y-1">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };
  lines.forEach((l, i) => {
    const clean = l.replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*:?$/, '$1').replace(/:$/, '');
    if (HEADINGS.some((h) => h.toLowerCase() === clean.toLowerCase())) {
      flush(String(i));
      out.push(<p key={i} className="label-caps mt-2 text-primary-600 first:mt-0">{clean}</p>);
    } else if (/^[-•*]\s+/.test(l)) {
      bullets.push(l.replace(/^[-•*]\s+/, '').replace(/\*\*/g, ''));
    } else {
      flush(String(i));
      out.push(<p key={i} className="mb-2">{l.replace(/\*\*/g, '')}</p>);
    }
  });
  flush('end');
  return <div className="text-[14px] leading-relaxed text-ink">{out}</div>;
}

export default function DocumentsPanel({ firmId, matterId, me, canManageAll, aiReady, staff, initial, eventId, hearings = [], title = 'Documents' }: Props) {
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const who = (id: string | null) => staff.find((s) => s.id === id)?.name ?? 'A colleague';
  const patch = (id: string, p: Partial<Doc>) => setDocs((list) => list.map((d) => (d.id === id ? { ...d, ...p } : d)));

  async function upload(files: FileList | File[]) {
    setError('');
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) { setError(`"${file.name}" is larger than 25 MB.`); continue; }
      setUploading(file.name);
      const path = `${firmId}/${matterId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from('matter-docs').upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (up.error) { setError(`"${file.name}" didn't upload. ${up.error.message}`); continue; }
      const { data, error: insErr } = await supabase
        .from('documents')
        .insert({ matter_id: matterId, event_id: eventId ?? null, name: file.name, storage_path: path, mime_type: file.type || null, size_bytes: file.size })
        .select(DOC_COLUMNS)
        .single();
      if (insErr || !data) {
        await supabase.storage.from('matter-docs').remove([path]);
        setError(`"${file.name}" didn't save. Check that updates 004 and 005 have been run in Supabase.`);
        continue;
      }
      const { data: signed } = await supabase.storage.from('matter-docs').createSignedUrl(path, 3600);
      setDocs((list) => [{ ...(data as Doc), url: signed?.signedUrl ?? null }, ...list]);
    }
    setUploading(null);
    if (input.current) input.current.value = '';
  }

  async function setHearing(d: Doc, id: string) {
    const supabase = createClient();
    const next = id || null;
    const { error: err } = await supabase.from('documents').update({ event_id: next }).eq('id', d.id);
    if (err) setError(`Couldn't move "${d.name}". ${err.message}`);
    else patch(d.id, { event_id: next });
  }

  async function summarise(d: Doc) {
    setBusy((b) => ({ ...b, [d.id]: true }));
    setOpen((o) => ({ ...o, [d.id]: true }));
    patch(d.id, { summary_status: 'working', summary_error: null });
    try {
      const res = await fetch('/documents/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) });
      const body = (await res.json().catch(() => ({}))) as { summary?: string; at?: string; error?: string };
      if (!res.ok || !body.summary) patch(d.id, { summary_status: 'failed', summary_error: body.error ?? 'The summary failed. Try again.' });
      else patch(d.id, { summary: body.summary, summary_status: 'done', summarized_at: body.at ?? new Date().toISOString() });
    } catch {
      patch(d.id, { summary_status: 'failed', summary_error: 'Connection lost. Check your internet and try again.' });
    }
    setBusy((b) => ({ ...b, [d.id]: false }));
  }

  return (
    <section aria-label="Documents" className="card overflow-hidden border-accent/40 bg-gradient-to-br from-[#C9F1F3] via-accent-soft to-[#F5FDFD]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/30 px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{docs.length ? `${docs.length} file${docs.length === 1 ? '' : 's'}` : 'Processes, addresses, exhibits, letters'}{aiReady ? ' · AI summaries on' : ''}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => input.current?.click()} disabled={!!uploading}>
          {uploading ? 'Uploading…' : '+ Upload'}
        </button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" aria-label="Upload documents" onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
        className={`transition-colors ${dragOver ? 'bg-white/70' : ''}`}
      >
        {uploading && <p role="status" className="px-5 pt-4 text-sm font-semibold text-accent-ink">Uploading “{uploading}”…</p>}
        {error && <p role="alert" className="mx-5 mt-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

        {docs.length === 0 ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="m-5 flex w-[calc(100%-2.5rem)] flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-accent/40 bg-white/60 px-4 py-8 text-center transition hover:border-accent hover:bg-white"
          >
            <span className="font-semibold text-ink">Drop files here or tap to upload</span>
            <span className="text-sm text-muted">PDF, Word, photos or text, up to 25 MB each.{aiReady ? ' Get a one-click AI summary of each.' : ''}</span>
          </button>
        ) : (
          <ul className="divide-y divide-accent/20">
            {docs.map((d) => {
              const k = kindOf(d.name);
              const mine = d.uploaded_by === me;
              const isOpen = open[d.id];
              return (
                <li key={d.id} className="px-5 py-4 transition-colors hover:bg-white/60">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold ${k.cls}`}>{k.label}</span>
                    <div className="min-w-0 flex-1">
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold text-ink hover:underline">{d.name}</a>
                      ) : (
                        <span className="block truncate font-semibold">{d.name}</span>
                      )}
                      <span className="text-[13px] text-muted">{[sizeLabel(d.size_bytes), who(d.uploaded_by), `${fmtDate(new Date(d.created_at))}, ${fmtTime(new Date(d.created_at))}`].filter(Boolean).join(' · ')}</span>
                      {!eventId && hearings.length > 0 && (
                        <span className="mt-1 flex items-center gap-2 text-[13px]">
                          <label htmlFor={`hear-${d.id}`} className="text-muted">For hearing</label>
                          <select
                            id={`hear-${d.id}`}
                            value={d.event_id ?? ''}
                            onChange={(e) => setHearing(d, e.target.value)}
                            className="max-w-[220px] rounded-lg border border-accent/30 bg-white/80 px-2 py-1 text-[13px] text-ink"
                          >
                            <option value="">Whole case</option>
                            {hearings.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
                          </select>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {aiReady && d.summary_status === 'done' && (
                        <button type="button" className="btn-soft min-h-[38px] px-3 text-sm" onClick={() => setOpen((o) => ({ ...o, [d.id]: !isOpen }))}>
                          {isOpen ? 'Hide summary' : 'View summary'}
                        </button>
                      )}
                      {aiReady && d.summary_status !== 'done' && (
                        <button type="button" className="btn-accent min-h-[38px] px-3 text-sm" disabled={busy[d.id] || d.summary_status === 'working'} onClick={() => summarise(d)}>
                          {busy[d.id] || d.summary_status === 'working' ? 'Summarising…' : '✦ Summarise'}
                        </button>
                      )}
                      {(mine || canManageAll) && confirm !== d.id && (
                        <button type="button" className="btn-ghost min-h-[38px] px-3 text-sm" onClick={() => setConfirm(d.id)}>Delete</button>
                      )}
                    </div>
                  </div>

                  {confirm === d.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-hearing-soft px-3 py-2 text-sm">
                      <span>Delete “{d.name}” for everyone?</span>
                      <button type="button" className="btn-ghost min-h-[36px] px-3" onClick={() => setConfirm(null)}>Keep it</button>
                      <button
                        type="button"
                        className="btn-danger min-h-[36px] px-3"
                        onClick={() =>
                          start(async () => {
                            const r = await deleteDocument(d.id);
                            if (r.error) { setError(r.error); setConfirm(null); return; }
                            setDocs((list) => list.filter((x) => x.id !== d.id));
                            setConfirm(null);
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {isOpen && (
                    <div className="mt-3 rounded-2xl border border-primary-200 bg-white/90 p-4 shadow-sm">
                      {d.summary_status === 'working' && (
                        <div className="flex flex-col gap-2" aria-busy="true">
                          <p className="text-sm font-semibold text-primary-600">Claude is reading the document. Long files can take up to a minute…</p>
                          {[0, 1, 2].map((i) => <div key={i} className="h-3 animate-pulse rounded-full bg-primary-100" style={{ width: `${90 - i * 18}%` }} />)}
                        </div>
                      )}
                      {d.summary_status === 'failed' && (
                        <div className="flex flex-wrap items-center gap-3">
                          <p role="alert" className="text-sm text-hearing">{d.summary_error ?? 'The summary failed.'}</p>
                          <button type="button" className="btn-ghost min-h-[36px] px-3 text-sm" onClick={() => summarise(d)}>Try again</button>
                        </div>
                      )}
                      {d.summary_status === 'done' && d.summary && (
                        <>
                          <Summary text={d.summary} />
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                            <span>AI summary{d.summarized_at ? ` · ${fmtDate(new Date(d.summarized_at))}` : ''}. Check it against the document before relying on it.</span>
                            <button type="button" className="font-semibold text-primary-600 hover:underline" onClick={() => summarise(d)} disabled={busy[d.id]}>Summarise again</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
