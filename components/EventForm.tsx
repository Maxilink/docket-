'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { saveEvent } from '@/app/(app)/actions';
import { EVENT_TYPES, PURPOSES } from '@/lib/constants';
import { useClashes, ClashWarning } from '@/components/useClashes';
import type { DiaryEvent, EventType, Matter, Profile } from '@/lib/types';

interface Props {
  event?: DiaryEvent;
  matters: Pick<Matter, 'id' | 'title' | 'suit_number' | 'court' | 'courtroom' | 'lead_lawyer_id' | 'client_phone'>[];
  staff: Profile[];
  defaults: { date: string; time: string; matterId?: string; lawyerId: string };
  minDate: string;
}

export default function EventForm({ event, matters, staff, defaults, minDate }: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [type, setType] = useState<EventType>(event?.type ?? 'hearing');
  const [matterId, setMatterId] = useState(event?.matter_id ?? defaults.matterId ?? '');
  const matter = matters.find((m) => m.id === matterId);
  const [title, setTitle] = useState(event?.title ?? matter?.title ?? '');
  const [court, setCourt] = useState(event?.court ?? matter?.court ?? '');
  const [courtroom, setCourtroom] = useState(event?.courtroom ?? matter?.courtroom ?? '');
  const [lawyerId, setLawyerId] = useState(event?.lawyer_id ?? matter?.lead_lawyer_id ?? defaults.lawyerId);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const clashes = useClashes(lawyerId, date, time, event?.id);

  // Picking a matter fills in its details, unless the user already typed something else.
  useEffect(() => {
    if (!matter || event) return;
    setTitle((t) => t || matter.title);
    setCourt((c) => c || matter.court || '');
    setCourtroom((c) => c || matter.courtroom || '');
    if (matter.lead_lawyer_id) setLawyerId(matter.lead_lawyer_id);
  }, [matterId]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError('');
    start(async () => {
      const r = await saveEvent(fd);
      if (r.error) return setError(r.error);
      router.push(`/events/${r.id}`);
      router.refresh();
    });
  }

  const showCourt = type === 'hearing' || type === 'filing';

  return (
    <form onSubmit={submit} className="card flex flex-col gap-5 p-6">
      {event && <input type="hidden" name="id" value={event.id} />}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-muted">Type</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(EVENT_TYPES) as EventType[]).map((t) => (
            <label key={t} className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${type === t ? `${EVENT_TYPES[t].border} ${EVENT_TYPES[t].bg} ${EVENT_TYPES[t].text} font-semibold` : 'border-line'}`}>
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="accent-primary" />
              {EVENT_TYPES[t].label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field" htmlFor="matter_id">Matter
        <select id="matter_id" name="matter_id" className="input" value={matterId} onChange={(e) => setMatterId(e.target.value)}>
          <option value="">No matter (general event)</option>
          {matters.map((m) => <option key={m.id} value={m.id}>{m.title}{m.suit_number ? ` · ${m.suit_number}` : ''}</option>)}
        </select>
      </label>

      <label className="field" htmlFor="title">Title
        <input id="title" name="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Okafor v. Rivers State Government" required />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field" htmlFor="date">Date
          <input id="date" name="date" type="date" className="input" min={event ? undefined : minDate} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field" htmlFor="time">Time
          <input id="time" name="time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        {showCourt && (
          <>
            <label className="field" htmlFor="purpose">{type === 'filing' ? 'What to file' : 'Fixed for'}
              <input id="purpose" name="purpose" className="input" list="purposes" defaultValue={event?.purpose ?? ''} placeholder={type === 'filing' ? 'e.g. Reply to statement of defence' : 'e.g. Continuation of hearing'} />
              <datalist id="purposes">{PURPOSES.map((p) => <option key={p} value={p} />)}</datalist>
            </label>
            <label className="field" htmlFor="lawyer_id">Counsel
              <select id="lawyer_id" name="lawyer_id" className="input" value={lawyerId} onChange={(e) => setLawyerId(e.target.value)}>
                <option value="">Not assigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || 'Unnamed'}</option>)}
              </select>
            </label>
            <label className="field" htmlFor="court">Court
              <input id="court" name="court" className="input" value={court} onChange={(e) => setCourt(e.target.value)} placeholder="e.g. High Court of Rivers State" />
            </label>
            <label className="field" htmlFor="courtroom">Courtroom
              <input id="courtroom" name="courtroom" className="input" value={courtroom} onChange={(e) => setCourtroom(e.target.value)} placeholder="e.g. Court 4" />
            </label>
          </>
        )}
        {!showCourt && (
          <label className="field" htmlFor="lawyer_id">Who is responsible
            <select id="lawyer_id" name="lawyer_id" className="input" value={lawyerId} onChange={(e) => setLawyerId(e.target.value)}>
              <option value="">Not assigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || 'Unnamed'}</option>)}
            </select>
          </label>
        )}
      </div>

      <ClashWarning clashes={clashes} staff={staff} lawyerId={lawyerId} />

      <label className="field" htmlFor="notes">Notes and documents to bring
        <textarea id="notes" name="notes" rows={3} className="input py-2" defaultValue={event?.notes ?? ''} placeholder="Witness statements, certified true copies, list of authorities…" />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-muted">Reminders</legend>
        <label className="flex items-center gap-2"><input type="checkbox" name="remind_day" defaultChecked={event?.remind_day ?? true} className="h-5 w-5 accent-primary" /> Remind counsel 1 day before</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="remind_hour" defaultChecked={event?.remind_hour ?? true} className="h-5 w-5 accent-primary" /> Remind counsel 1 hour before</label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="remind_client" defaultChecked={event?.remind_client ?? false} disabled={!matter?.client_phone} className="h-5 w-5 accent-primary" />
          Remind the client 1 day before{!matter?.client_phone && <span className="text-sm text-muted">(add a client phone on the matter first)</span>}
        </label>
      </fieldset>

      {error && <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={pending}>{pending ? 'Saving…' : event ? 'Save changes' : 'Add event'}</button>
      </div>
    </form>
  );
}
