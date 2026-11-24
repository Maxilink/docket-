import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember, getStaff } from '@/lib/session';
import { EVENT_SELECT, Pill, TypeTag, eventStatus } from '@/components/EventBits';
import ArchiveButton from '@/components/ArchiveButton';
import { canArchive, canTextClients, OUTCOME_LABEL } from '@/lib/constants';
import RemindClient from '@/components/RemindClient';
import ChecklistPanel, { type ChecklistItem } from '@/components/ChecklistPanel';
import DocumentsPanel, { type Doc } from '@/components/DocumentsPanel';
import { DOC_COLUMNS } from '@/lib/docs';
import { aiConfigured } from '@/lib/ai';
import { clientUpcomingText } from '@/lib/messages';
import { fmtDate, fmtDateLong, fmtTime, startOfDay } from '@/lib/time';
import type { DiaryEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EventPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { supabase, profile, firm } = await requireMember();
  const [{ data }, staff] = await Promise.all([supabase.from('events').select(EVENT_SELECT).eq('id', params.id).maybeSingle(), getStaff(supabase)]);
  if (!data) notFound();
  const e = data as unknown as DiaryEvent;
  const now = new Date();
  const at = new Date(e.starts_at);
  const past = at < now;
  const st = eventStatus(e, now);
  const canRecord = !e.outcome && startOfDay(at) <= startOfDay(now);
  const name = (id: string | null) => staff.find((s) => s.id === id)?.full_name;
  type NextRef = { id: string; starts_at: string; purpose: string | null };
  let nextEvent: NextRef | null = null;
  if (e.next_event_id) {
    const { data: n } = await supabase.from('events').select('id, starts_at, purpose').eq('id', e.next_event_id).maybeSingle();
    nextEvent = (n as NextRef | null) ?? null;
  }

  // Court prep: the checklist, this hearing's documents, and last hearing's list to copy forward.
  const courtPrep = Boolean(e.matter && (e.type === 'hearing' || e.type === 'filing'));
  let items: ChecklistItem[] = [];
  let caseDocs: Doc[] = [];
  let prepReady = true;
  let previous: { label: string; items: { label: string; document_id: string | null }[] } | null = null;
  if (courtPrep && e.matter) {
    const [itemsRes, docsRes, prevRes] = await Promise.all([
      supabase.from('hearing_items').select('id, label, document_id, done, done_by, done_at').eq('event_id', e.id).order('created_at'),
      supabase.from('documents').select(DOC_COLUMNS).eq('matter_id', e.matter.id).order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('id, starts_at, purpose, items:hearing_items(label, document_id)')
        .eq('matter_id', e.matter.id)
        .lt('starts_at', e.starts_at)
        .order('starts_at', { ascending: false })
        .limit(1),
    ]);
    prepReady = !itemsRes.error && !docsRes.error;
    items = (itemsRes.data ?? []) as ChecklistItem[];
    caseDocs = (docsRes.data ?? []) as Doc[];
    if (caseDocs.length) {
      const { data: signed } = await supabase.storage.from('matter-docs').createSignedUrls(caseDocs.map((d) => d.storage_path), 3600);
      caseDocs = caseDocs.map((d) => ({ ...d, url: signed?.find((x) => x.path === d.storage_path)?.signedUrl ?? null }));
    }
    const prev = ((prevRes.data ?? [])[0] ?? null) as { starts_at: string; purpose: string | null; items: { label: string; document_id: string | null }[] | null } | null;
    if (prev?.items?.length) previous = { label: `the ${fmtDate(new Date(prev.starts_at))} hearing`, items: prev.items };
  }
  const staffNames = staff.map((x) => ({ id: x.id, name: x.full_name || 'A colleague' }));

  const facts: [string, string | null | undefined, boolean?][] = [
    ['Date', fmtDateLong(at)],
    ['Time', fmtTime(at)],
    ['Suit / case no.', e.matter?.suit_number, true],
    [e.type === 'filing' ? 'What to file' : 'Fixed for', e.purpose],
    ['Court', e.court],
    ['Courtroom', e.courtroom],
    ['Counsel', name(e.lawyer_id)],
    ['Reminders', [e.remind_day && '1 day before', e.remind_hour && '1 hour before', e.remind_client && 'client the day before'].filter(Boolean).join(', ') || 'None'],
    ['Notes and documents', e.notes],
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href={e.matter ? `/matters/${e.matter.id}` : '/calendar'} className="text-sm text-muted hover:underline">← {e.matter ? e.matter.title : 'Calendar'}</Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type={e.type} />
          <Pill tone={st.tone}>{st.label}</Pill>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight leading-tight">{e.title}</h1>
      </header>

      {canRecord && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-line bg-warn-soft px-5 py-4">
          <p className="text-sm text-[#5C3A1E]"><strong className="text-warn">What happened?</strong> Record the outcome and fix the next date.</p>
          <Link href={`/events/${e.id}/outcome`} className="btn-primary">Record outcome</Link>
        </div>
      )}

      {e.outcome && (
        <section className="rounded-xl border border-accent bg-accent-soft px-5 py-4">
          <p className="label-caps text-accent-ink">Outcome</p>
          <p className="font-display text-xl">{OUTCOME_LABEL[e.outcome]}</p>
          {e.outcome_note && <p className="mt-1 whitespace-pre-wrap text-sm">{e.outcome_note}</p>}
          {nextEvent && (
            <p className="mt-2 text-sm">
              Next date:{' '}
              <Link href={`/events/${nextEvent.id}`} className="font-semibold text-primary underline">
                {fmtDateLong(new Date(nextEvent.starts_at))}, {fmtTime(new Date(nextEvent.starts_at))}
              </Link>
              {nextEvent.purpose ? ` for ${nextEvent.purpose.toLowerCase()}` : ''}
            </p>
          )}
        </section>
      )}

      {!past && !e.outcome && e.matter?.client_phone && canTextClients(profile.role) && (
        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-bold">Remind the client</h2>
            <p className="text-sm text-muted">{e.matter.client_name || 'Client'} · +{e.matter.client_phone}{e.remind_client ? ' · An automatic reminder also goes out the day before.' : ''}</p>
          </div>
          <RemindClient
            eventId={e.id}
            clientName={e.matter.client_name}
            clientPhone={e.matter.client_phone}
            defaultText={clientUpcomingText(firm.name, e.matter.client_name, at, [e.court, e.courtroom].filter(Boolean).join(', '), e.purpose, e.matter.suit_number)}
          />
        </section>
      )}

      {courtPrep && e.matter && (prepReady ? (
        <>
          <ChecklistPanel
            eventId={e.id}
            initial={items}
            docs={caseDocs.map((d) => ({ id: d.id, name: d.name, url: d.url ?? null }))}
            staff={staffNames}
            previous={previous}
            readOnly={Boolean(e.outcome)}
          />
          <DocumentsPanel
            title="Documents for this hearing"
            eventId={e.id}
            firmId={firm.id}
            matterId={e.matter.id}
            me={profile.id}
            canManageAll={canArchive(profile.role)}
            aiReady={aiConfigured()}
            staff={staffNames}
            initial={caseDocs.filter((d) => d.event_id === e.id)}
          />
        </>
      ) : (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">The court checklist and hearing documents aren&apos;t switched on yet. Run updates 004 and 005 in Supabase, then reload.</p>
      ))}

      <section className="card p-5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
          {facts.filter(([, v]) => v).map(([k, v, mono]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className={`whitespace-pre-wrap break-words ${mono ? 'font-mono' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {past ? (
        <p className="rounded-lg bg-primary-100 px-4 py-3 text-sm text-primary">This event has passed, so its details can no longer be edited.{!e.outcome ? ' You can still record its outcome.' : ''}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!past && <Link href={`/events/${e.id}/edit`} className="btn-primary">Edit</Link>}
        {canArchive(profile.role) && <ArchiveButton kind="event" id={e.id} after={e.matter ? `/matters/${e.matter.id}` : '/calendar'} label="Archive this event? It disappears from the diary and its reminders stop." />}
      </div>
    </div>
  );
}
