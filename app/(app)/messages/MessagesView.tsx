'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ROLES } from '@/lib/constants';
import { fmtTime, relDay, fmtDate, ymd } from '@/lib/time';

export interface Msg {
  id: string;
  sender_id: string;
  matter_id: string | null;
  recipient_id: string | null;
  body: string;
  created_at: string;
}
interface Person { id: string; name: string; role: string }
interface MatterRef { id: string; title: string; suit_number: string | null; status: string }

interface Props {
  me: string;
  firmId: string;
  firmName: string;
  seenAt: string;
  initialKey: string;
  staff: Person[];
  matters: MatterRef[];
  initial: Msg[];
}

const keyOf = (m: Msg, me: string) =>
  m.recipient_id ? `dm:${m.sender_id === me ? m.recipient_id : m.sender_id}` : m.matter_id ? `m:${m.matter_id}` : 'general';

const initialsOf = (name: string) =>
  name.replace(/^(barr\.?|mr\.?|mrs\.?|ms\.?|dr\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '•';

export default function MessagesView({ me, firmId, firmName, seenAt, initialKey, staff, matters, initial }: Props) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [active, setActive] = useState(initialKey);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [read, setRead] = useState<Record<string, boolean>>({ [initialKey]: true });
  const [filter, setFilter] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const people = useMemo(() => staff.filter((s) => s.id !== me), [staff, me]);
  const nameOf = (id: string) => (id === me ? 'You' : staff.find((s) => s.id === id)?.name ?? 'Former colleague');

  // Live updates.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${firmId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `firm_id=eq.${firmId}` }, (payload) => {
        const m = payload.new as Msg;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [firmId]);

  const byKey = useMemo(() => {
    const map: Record<string, Msg[]> = {};
    for (const m of messages) (map[keyOf(m, me)] ||= []).push(m);
    return map;
  }, [messages, me]);

  const unreadFor = (key: string) => (read[key] || key === active ? 0 : (byKey[key] ?? []).filter((m) => m.sender_id !== me && m.created_at > seenAt).length);
  const lastAt = (key: string) => byKey[key]?.[byKey[key].length - 1]?.created_at ?? '';

  const matterKeys = useMemo(() => {
    const keys = Object.keys(byKey).filter((k) => k.startsWith('m:'));
    if (active.startsWith('m:') && !keys.includes(active)) keys.push(active);
    return keys.sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  }, [byKey, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const dmPeople = useMemo(() => [...people].sort((a, b) => lastAt(`dm:${b.id}`).localeCompare(lastAt(`dm:${a.id}`)) || a.name.localeCompare(b.name)), [people, byKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const thread = byKey[active] ?? [];
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [active, thread.length]);

  function open(key: string) {
    setActive(key);
    setRead((r) => ({ ...r, [key]: true }));
    setError('');
    try { window.history.replaceState(null, '', `/messages?c=${encodeURIComponent(key)}`); } catch { /* ignore */ }
  }

  const matterOf = (key: string) => matters.find((m) => `m:${m.id}` === key);
  const title =
    active === 'general' ? 'General' : active.startsWith('m:') ? matterOf(active)?.title ?? 'Matter' : nameOf(active.slice(3));
  const subtitle =
    active === 'general'
      ? `Everyone at ${firmName} · ${staff.length} people`
      : active.startsWith('m:')
        ? `${matterOf(active)?.suit_number ?? 'Matter discussion'} · visible to everyone in the firm`
        : `${ROLES.find((r) => r.value === people.find((p) => `dm:${p.id}` === active)?.role)?.label ?? ''} · only the two of you can see this`;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    const row: { body: string; matter_id?: string; recipient_id?: string } = { body };
    if (active.startsWith('m:')) row.matter_id = active.slice(2);
    if (active.startsWith('dm:')) row.recipient_id = active.slice(3);
    const supabase = createClient();
    const { data, error: err } = await supabase.from('messages').insert(row).select('id, sender_id, matter_id, recipient_id, body, created_at').single();
    setSending(false);
    if (err || !data) {
      setError('Your message didn\'t send. Check your connection and try again.');
      return;
    }
    setDraft('');
    setMessages((list) => (list.some((x) => x.id === (data as Msg).id) ? list : [...list, data as Msg]));
  }

  const q = filter.trim().toLowerCase();
  const show = (label: string) => !q || label.toLowerCase().includes(q);
  const unusedMatters = matters.filter((m) => m.status === 'active' && !matterKeys.includes(`m:${m.id}`));

  const Item = ({ k, label, sub, avatar, square }: { k: string; label: string; sub: string; avatar: string; square?: boolean }) => {
    const n = unreadFor(k);
    const on = k === active;
    return (
      <button
        type="button"
        onClick={() => open(k)}
        aria-pressed={on}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${on ? 'bg-primary-100' : 'hover:bg-canvas'}`}
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center text-xs font-bold ${square ? 'rounded-[10px] bg-hearing-soft text-hearing' : 'rounded-full bg-primary text-white'} ${k === 'general' ? '!bg-primary-100 !text-primary' : ''}`}>{avatar}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">{label}</span>
          <span className="truncate text-[13px] text-muted">{sub}</span>
        </span>
        {n > 0 && <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-primary">{n}</span>}
      </button>
    );
  };

  const preview = (k: string) => {
    const last = byKey[k]?.[byKey[k].length - 1];
    if (!last) return 'No messages yet';
    return `${last.sender_id === me ? 'You' : nameOf(last.sender_id).split(' ').slice(-1)[0]}: ${last.body}`;
  };

  let lastDay = '';

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted">Private to {firmName} staff. Clients never see these.</p>
      </header>

      <div className="card flex min-h-[640px] flex-col overflow-hidden md:flex-row">
        <aside aria-label="Conversations" className="flex max-h-[360px] flex-col border-b border-line md:max-h-none md:w-80 md:shrink-0 md:border-b-0 md:border-r">
          <div className="p-3">
            <label htmlFor="msgFilter" className="sr-only">Search conversations</label>
            <input id="msgFilter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search people or matters" className="input" />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <p className="label-caps px-3 py-1.5 text-muted">Firm</p>
            {show('General') && <Item k="general" label="General" sub={preview('general')} avatar="#" />}

            <p className="label-caps mt-3 px-3 py-1.5 text-muted">Matters</p>
            {matterKeys.filter((k) => show(matterOf(k)?.title ?? '')).map((k) => (
              <Item key={k} k={k} label={matterOf(k)?.title ?? 'Matter'} sub={preview(k)} avatar={initialsOf(matterOf(k)?.title ?? 'M')} square />
            ))}
            {unusedMatters.length > 0 && (
              <div className="px-3 pt-1">
                <label htmlFor="startMatter" className="sr-only">Start a matter discussion</label>
                <select id="startMatter" className="input text-sm text-muted" value="" onChange={(e) => e.target.value && open(`m:${e.target.value}`)}>
                  <option value="">+ Discuss another matter…</option>
                  {unusedMatters.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            )}

            <p className="label-caps mt-3 px-3 py-1.5 text-muted">Direct messages</p>
            {dmPeople.filter((p) => show(p.name)).map((p) => (
              <Item key={p.id} k={`dm:${p.id}`} label={p.name} sub={byKey[`dm:${p.id}`] ? preview(`dm:${p.id}`) : ROLES.find((r) => r.value === p.role)?.label ?? ''} avatar={initialsOf(p.name)} />
            ))}
            {people.length === 0 && <p className="px-3 text-sm text-muted">Invite colleagues from the Team page to message them.</p>}
          </div>
        </aside>

        <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">{title}</h2>
              <p className="truncate text-[13px] text-muted">{subtitle}</p>
            </div>
            {active.startsWith('m:') && <Link href={`/matters/${active.slice(2)}`} className="btn-ghost">Open case file</Link>}
          </div>

          <div className="flex max-h-[60vh] min-h-[320px] flex-1 flex-col gap-3 overflow-y-auto bg-[#FBFAFD] px-5 py-5 md:max-h-[560px]">
            {thread.length === 0 && (
              <div className="m-auto max-w-sm text-center text-sm text-muted">
                <p className="font-semibold text-ink">No messages yet</p>
                <p>{active.startsWith('dm:') ? `Send ${title} a message. Only the two of you will see it.` : 'Start the conversation. Everyone in the firm can read and reply.'}</p>
              </div>
            )}
            {thread.map((m, i) => {
              const mine = m.sender_id === me;
              const d = new Date(m.created_at);
              const day = ymd(d);
              const showDay = day !== lastDay;
              lastDay = day;
              const showName = !mine && (i === 0 || thread[i - 1].sender_id !== m.sender_id || showDay);
              return (
                <div key={m.id} className="flex flex-col gap-1">
                  {showDay && <span className="mx-auto my-1 rounded-full bg-primary-100 px-3 py-0.5 text-xs font-semibold text-muted">{relDay(d) || fmtDate(d)}</span>}
                  <div className={`flex max-w-[75%] flex-col gap-1 ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
                    {showName && <span className="px-1 text-xs text-muted"><strong className="font-bold text-primary">{nameOf(m.sender_id)}</strong> · {fmtTime(d)}</span>}
                    <div className={`whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] ${mine ? 'rounded-[16px_16px_4px_16px] bg-primary text-white' : 'rounded-[16px_16px_16px_4px] border border-line bg-white'}`}>{m.body}</div>
                    {mine && <span className="px-1 text-xs text-muted">{fmtTime(d)}</span>}
                  </div>
                </div>
              );
            })}
            <div ref={bottom} />
          </div>

          <form onSubmit={send} className="flex items-end gap-3 border-t border-line px-5 py-4">
            <label htmlFor="composer" className="sr-only">Message</label>
            <textarea
              id="composer"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit(); } }}
              placeholder={`Message ${title}`}
              className="input min-w-0 flex-1 resize-none py-2.5"
            />
            <button className="btn-primary" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send'}</button>
          </form>
          {error && <p role="alert" className="px-5 pb-3 text-sm text-hearing">{error}</p>}
        </section>
      </div>
      <p className="text-xs text-muted">Press Enter to send, Shift + Enter for a new line.</p>
    </>
  );
}
