'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtTime } from '@/lib/time';

export interface ChecklistItem {
  id: string;
  label: string;
  document_id: string | null;
  done: boolean;
  done_by: string | null;
  done_at: string | null;
}

interface Props {
  eventId: string;
  initial: ChecklistItem[];
  /** The case's documents, so an item can point at the file to bring. */
  docs: { id: string; name: string; url: string | null }[];
  staff: { id: string; name: string }[];
  /** The previous hearing in this matter and its checklist, to copy forward. */
  previous?: { label: string; items: { label: string; document_id: string | null }[] } | null;
  readOnly?: boolean;
}

const COLUMNS = 'id, label, document_id, done, done_by, done_at';
const SUGGESTIONS = ['Certified true copies', 'Witness statements', 'List of authorities', 'Written address', 'Proof of service', 'Exhibits (originals)'];

export default function ChecklistPanel({ eventId, initial, docs, staff, previous, readOnly = false }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(initial);
  const [label, setLabel] = useState('');
  const [docId, setDocId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const done = items.filter((i) => i.done).length;
  const who = (id: string | null) => staff.find((s) => s.id === id)?.name ?? 'someone';
  const docOf = (id: string | null) => docs.find((d) => d.id === id);

  async function add(newItems: { label: string; document_id: string | null }[]) {
    if (!newItems.length) return;
    setSaving(true);
    setError('');
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('hearing_items')
      .insert(newItems.map((x) => ({ event_id: eventId, label: x.label.trim().slice(0, 200), document_id: x.document_id })))
      .select(COLUMNS);
    setSaving(false);
    if (err) return setError(`Couldn't add that. ${/relation|does not exist/i.test(err.message) ? 'Run update 005 in Supabase first.' : err.message}`);
    setItems((list) => [...list, ...((data ?? []) as ChecklistItem[])]);
    setLabel('');
    setDocId('');
  }

  async function toggle(item: ChecklistItem) {
    const next = !item.done;
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    const supabase = createClient();
    const { data, error: err } = await supabase.from('hearing_items').update({ done: next }).eq('id', item.id).select(COLUMNS).single();
    if (err || !data) {
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      setError('That change didn\'t save. Check your connection and try again.');
    } else {
      setItems((list) => list.map((i) => (i.id === item.id ? (data as ChecklistItem) : i)));
    }
  }

  async function remove(item: ChecklistItem) {
    const before = items;
    setItems((list) => list.filter((i) => i.id !== item.id));
    const supabase = createClient();
    const { error: err } = await supabase.from('hearing_items').delete().eq('id', item.id);
    if (err) { setItems(before); setError('Couldn\'t remove that item.'); }
  }

  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const unused = SUGGESTIONS.filter((s) => !items.some((i) => i.label.toLowerCase() === s.toLowerCase()));

  return (
    <section aria-label="Bring to court" className="card overflow-hidden border-primary-200 bg-gradient-to-br from-primary-200/80 via-primary-100 to-primary-50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-200 px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Bring to court</h2>
          <p className="text-sm text-muted">{items.length ? `${done} of ${items.length} ready` : 'What counsel needs on the day'}</p>
        </div>
        {items.length > 0 && (
          <div className="flex w-40 items-center gap-2" aria-hidden="true">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80">
              <div className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-accent' : 'bg-gradient-to-r from-primary-600 to-primary-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular text-xs font-bold text-primary">{pct}%</span>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mx-5 mt-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2 px-5 pt-4">
          {items.map((i) => {
            const d = docOf(i.document_id);
            return (
              <li key={i.id} className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${i.done ? 'border-accent/30 bg-accent-soft/70' : 'border-white bg-white/85 hover:shadow-sm'}`}>
                <input
                  type="checkbox"
                  id={`item-${i.id}`}
                  checked={i.done}
                  disabled={readOnly}
                  onChange={() => toggle(i)}
                  className="h-5 w-5 shrink-0 accent-primary"
                />
                <label htmlFor={`item-${i.id}`} className="flex min-w-0 flex-1 cursor-pointer flex-col">
                  <span className={`font-medium ${i.done ? 'text-muted line-through' : 'text-ink'}`}>{i.label}</span>
                  {(d || (i.done && i.done_at)) && (
                    <span className="text-xs text-muted">
                      {d && (d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-600 hover:underline" onClick={(e) => e.stopPropagation()}>{d.name}</a> : d.name)}
                      {d && i.done && i.done_at ? ' · ' : ''}
                      {i.done && i.done_at ? `Ready · ${who(i.done_by)}, ${fmtTime(new Date(i.done_at))}` : ''}
                    </span>
                  )}
                </label>
                {!readOnly && (
                  <button type="button" aria-label={`Remove ${i.label}`} onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded-lg text-muted opacity-60 transition hover:bg-hearing-soft hover:text-hearing hover:opacity-100">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-3 px-5 py-4">
          {items.length === 0 && previous && previous.items.length > 0 && (
            <button
              type="button"
              className="btn-ghost self-start"
              disabled={saving}
              onClick={() => add(previous.items)}
            >
              Copy {previous.items.length} item{previous.items.length === 1 ? '' : 's'} from {previous.label}
            </button>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); if (label.trim()) add([{ label, document_id: docId || null }]); }}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="field min-w-[200px] flex-[2_1_220px]" htmlFor={`new-item-${eventId}`}>Add an item
              <input id={`new-item-${eventId}`} value={label} onChange={(e) => setLabel(e.target.value)} className="input bg-white" placeholder="e.g. CTC of the survey plan" maxLength={200} />
            </label>
            {docs.length > 0 && (
              <label className="field min-w-[160px] flex-[1_1_180px]" htmlFor={`new-doc-${eventId}`}>Link a document (optional)
                <select id={`new-doc-${eventId}`} value={docId} onChange={(e) => { setDocId(e.target.value); if (!label) setLabel(docs.find((d) => d.id === e.target.value)?.name ?? ''); }} className="input bg-white">
                  <option value="">None</option>
                  {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
            )}
            <button className="btn-primary" disabled={saving || !label.trim()}>{saving ? 'Adding…' : 'Add'}</button>
          </form>
          {unused.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Quick add:</span>
              {unused.map((sug) => (
                <button key={sug} type="button" disabled={saving} onClick={() => add([{ label: sug, document_id: null }])} className="rounded-full border border-primary-200 bg-white/80 px-3 py-1 text-xs font-medium text-primary transition hover:-translate-y-px hover:bg-white hover:shadow-sm">
                  + {sug}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
