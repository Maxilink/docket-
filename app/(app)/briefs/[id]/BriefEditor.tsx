'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { findGaps, PRIMSOL_URL, type BriefRow } from '@/lib/brief';
import { mdToHtml, wordDocument } from '@/lib/md';
import { fmtDate, fmtTime } from '@/lib/time';
import BriefForm from '../BriefForm';

interface Props {
  brief: BriefRow;
  matter: { id: string; title: string; suit_number: string | null; court: string | null };
  docs: { id: string; name: string; size_bytes: number | null; summary_status: string | null }[];
  events: { id: string; title: string; starts_at: string; purpose: string | null; type: string }[];
  authorName: string | null;
  canEdit: boolean;
  canDelete: boolean;
  autoRun: boolean;
  aiReady: boolean;
}

const QUICK = ['Make it more concise', 'Strengthen the argument on issue 1', 'Answer the other side’s points directly', 'Make the tone more formal'];

export default function BriefEditor({ brief, matter, docs, events, authorName, canEdit, canDelete, autoRun, aiReady }: Props) {
  const router = useRouter();
  const [content, setContent] = useState(brief.content ?? '');
  const [saved, setSaved] = useState(brief.content ?? '');
  const [previous, setPrevious] = useState(brief.previous_content);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState('');
  const [error, setError] = useState(brief.status === 'failed' ? brief.error ?? 'The last attempt failed.' : '');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [revise, setRevise] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const started = useRef(false);
  const liveRef = useRef<HTMLDivElement>(null);

  const dirty = content !== saved;
  const shown = running ? live : content;
  const html = useMemo(() => mdToHtml(shown), [shown]);
  const gaps = useMemo(() => findGaps(content), [content]);
  const stale = brief.status === 'working' && Date.now() - new Date(brief.updated_at).getTime() > 6 * 60e3;

  async function run(instruction?: string) {
    if (running) return;
    setError('');
    setNotice('');
    setRunning(true);
    setLive('');
    setMode('read');
    try {
      const res = await fetch('/briefs/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: brief.id, revise: instruction }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'The draft could not be started. Try again.');
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setLive(acc.split('<<ERROR>>')[0]);
      }
      const [text, err] = acc.split('<<ERROR>>');
      if (err) throw new Error(err.trim());
      setPrevious(content || null);
      setContent(text.trim());
      setSaved(text.trim());
      setRevise('');
      setNotice(instruction ? 'Revised. You can undo this if you prefer the earlier version.' : 'Draft ready. Fill the marked gaps before filing.');
      router.replace(`/briefs/${brief.id}`, { scroll: false });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoRun && !started.current && !brief.content && canEdit && aiReady) {
      started.current = true;
      void run();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (running && liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [live, running]);

  async function save() {
    const { error: err } = await createClient().from('briefs').update({ content, status: 'draft', error: null }).eq('id', brief.id);
    if (err) return setError('That didn’t save. Try again.');
    setSaved(content);
    setNotice('Saved.');
  }

  async function undo() {
    if (previous == null) return;
    const { error: err } = await createClient().from('briefs').update({ content: previous, previous_content: content }).eq('id', brief.id);
    if (err) return setError('That didn’t undo. Try again.');
    const now = content;
    setContent(previous);
    setSaved(previous);
    setPrevious(now);
    setNotice('Back to the earlier version. Use Undo again to return to the newer one.');
  }

  async function remove() {
    const { error: err } = await createClient().from('briefs').delete().eq('id', brief.id);
    if (err) return setError('That didn’t delete. Try again.');
    router.push(`/matters/${matter.id}`);
    router.refresh();
  }

  function download() {
    const blob = new Blob([wordDocument(brief.title, content)], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brief.title.replace(/[^\w\- ’']+/g, '').slice(0, 80) || 'Draft'}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setNotice('Copied.');
    } catch {
      setError('Copying isn’t allowed here. Select the text and copy it instead.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary-600">{brief.kind}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{brief.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {matter.suit_number ? `${matter.suit_number}, ` : ''}{matter.court ?? 'Court not recorded'}
            {authorName ? `. Started by ${authorName}` : ''}. Last changed {fmtDate(new Date(brief.updated_at))}, {fmtTime(new Date(brief.updated_at))}.
          </p>
        </div>
        {content && !running && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={download} className="btn-primary">Download for Word</button>
            <button type="button" onClick={copy} className="btn-ghost">Copy text</button>
          </div>
        )}
      </header>

      {!aiReady && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">AI drafting isn&apos;t switched on yet. Add ANTHROPIC_API_KEY in Vercel, then redeploy.</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          <span>{error}</span>
          {canEdit && aiReady && !running && <button type="button" onClick={() => run()} className="btn-ghost">{content ? 'Redraft' : 'Try again'}</button>}
        </div>
      )}
      {notice && !error && <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-ink">{notice}</p>}

      <div className="flex flex-wrap items-start gap-5">
        {/* The draft */}
        <section className="card min-w-0 flex-[999_1_560px] overflow-hidden" aria-label="Draft">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 print:hidden">
            {running ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" /> Writing the draft… this takes one to three minutes.
              </p>
            ) : (
              <div className="flex gap-1 rounded-full bg-primary-50 p-1" role="tablist" aria-label="View">
                {(['read', 'edit'] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} disabled={!canEdit && m === 'edit'}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${mode === m ? 'bg-primary text-white' : 'text-primary hover:bg-white'}`}>
                    {m === 'read' ? 'Read' : 'Edit'}
                  </button>
                ))}
              </div>
            )}
            {!running && mode === 'edit' && (
              <div className="flex items-center gap-2">
                {dirty && <span className="text-sm text-muted">Unsaved changes</span>}
                <button type="button" onClick={save} disabled={!dirty} className="btn-primary">Save</button>
              </div>
            )}
          </div>

          {!running && !content ? (
            <div className="flex flex-col items-start gap-3 p-6">
              <p className="font-semibold">{brief.status === 'working' && !stale ? 'The draft is being written.' : 'No draft yet.'}</p>
              <p className="text-muted">{brief.status === 'working' && !stale ? 'Refresh this page in a minute to see it.' : 'Write it from the file and the instructions below.'}</p>
              {canEdit && aiReady && (brief.status !== 'working' || stale) && <button type="button" onClick={() => run()} className="btn-primary">Write the draft</button>}
            </div>
          ) : mode === 'edit' && !running ? (
            <textarea
              aria-label="Draft text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="block min-h-[70vh] w-full resize-y border-0 bg-white p-5 font-mono text-[14px] leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-200"
            />
          ) : (
            <div
              ref={liveRef}
              className={`brief-doc bg-white px-5 py-6 text-ink sm:px-10 ${running ? 'max-h-[75vh] overflow-y-auto' : ''}`}
              dangerouslySetInnerHTML={{ __html: html || '<p>Starting…</p>' }}
            />
          )}
        </section>

        {/* Side panel */}
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 print:hidden">
          {content && !running && (
            <section className="card p-4" aria-labelledby="gaps-h">
              <h2 id="gaps-h" className="font-display text-lg font-bold">To fill before filing</h2>
              {gaps.length === 0 ? (
                <p className="mt-1 text-sm text-muted">No marked gaps. Still check every authority and fact against the file.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted">
                    {(() => { const a = gaps.filter((g) => g.kind === 'authority').length; const c = gaps.length - a; return `${a} ${a === 1 ? 'authority' : 'authorities'} needed, ${c} ${c === 1 ? 'point' : 'points'} to check.`; })()}
                  </p>
                  <ul className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                    {gaps.map((g, i) => (
                      <li key={i} className={`rounded-lg px-3 py-2 text-sm ${g.kind === 'authority' ? 'bg-hearing-soft text-hearing' : 'bg-warn-soft text-warn'}`}>
                        <span className="font-semibold">{g.kind === 'authority' ? 'Authority: ' : 'Check: '}</span>{g.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <a href={PRIMSOL_URL} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary underline">Find authorities in Primsol</a>
              <p className="mt-1 text-xs text-muted">Add the authorities you find under Instructions and redraft, or type them into the draft yourself.</p>
            </section>
          )}

          {canEdit && aiReady && content && !running && (
            <section className="card p-4" aria-labelledby="revise-h">
              <h2 id="revise-h" className="font-display text-lg font-bold">Ask for changes</h2>
              <form onSubmit={(e) => { e.preventDefault(); if (revise.trim()) void run(revise.trim()); }} className="mt-2 flex flex-col gap-2">
                <label htmlFor="revise" className="sr-only">What should change?</label>
                <textarea id="revise" rows={3} className="input py-2" value={revise} onChange={(e) => setRevise(e.target.value)} maxLength={2000}
                  placeholder="e.g. Add an argument that the motion is incompetent for want of a supporting affidavit" />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map((q) => (
                    <button key={q} type="button" onClick={() => setRevise(q)} className="rounded-full border border-primary-200 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-50">{q}</button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button type="submit" className="btn-primary" disabled={!revise.trim() || dirty}>Revise the draft</button>
                  {dirty && <span className="text-xs text-muted">Save your edits first.</span>}
                </div>
              </form>
              {previous != null && <button type="button" onClick={undo} className="mt-3 text-sm font-semibold text-primary hover:underline">Undo the last change</button>}
            </section>
          )}

          {canEdit && !running && (
            <section className="card p-4">
              <button type="button" className="text-left font-display text-lg font-bold" aria-expanded={showSettings} onClick={() => setShowSettings((s) => !s)}>
                {showSettings ? '▾' : '▸'} Instructions, authorities and documents
              </button>
              {!showSettings && <p className="mt-1 text-sm text-muted">Change what the draft is based on and write it again.</p>}
            </section>
          )}

          {canDelete && !running && (
            <div className="px-1">
              {confirmDelete ? (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  Delete this draft for everyone?
                  <button type="button" onClick={remove} className="rounded-lg bg-hearing px-3 py-1.5 font-semibold text-white">Delete</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 font-semibold text-primary hover:bg-primary-50">Keep it</button>
                </p>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-hearing hover:underline">Delete draft</button>
              )}
            </div>
          )}

          <p className="px-1 text-xs text-muted">
            AI drafts are a starting point. Counsel must check every fact, authority and citation before filing.
          </p>
        </aside>
      </div>

      {showSettings && canEdit && !running && (
        <BriefForm matter={matter} docs={docs} events={events} brief={{ ...brief, content }} onRedraft={() => { setShowSettings(false); void run(); }} />
      )}
    </div>
  );
}
