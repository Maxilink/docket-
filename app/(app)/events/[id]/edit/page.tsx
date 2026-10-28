import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireMember, getStaff } from '@/lib/session';
import EventForm from '@/components/EventForm';
import { EVENT_SELECT } from '@/components/EventBits';
import { hm, ymd } from '@/lib/time';
import type { DiaryEvent } from '@/lib/types';

export const metadata = { title: 'Edit event' };

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireMember();
  const [{ data }, staff, { data: matters }] = await Promise.all([
    supabase.from('events').select(EVENT_SELECT).eq('id', params.id).maybeSingle(),
    getStaff(supabase),
    supabase.from('matters').select('id, title, suit_number, court, courtroom, lead_lawyer_id, client_phone').order('title'),
  ]);
  if (!data) notFound();
  const e = data as unknown as DiaryEvent;
  if (new Date(e.starts_at) < new Date()) redirect(`/events/${e.id}`);
  const at = new Date(e.starts_at);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href={`/events/${e.id}`} className="text-sm text-muted hover:underline">← {e.title}</Link>
      <h1 className="font-display text-3xl font-normal">Edit event</h1>
      <EventForm event={e} matters={matters ?? []} staff={staff} minDate={ymd(new Date())} defaults={{ date: ymd(at), time: hm(at), lawyerId: e.lawyer_id ?? '' }} />
    </div>
  );
}
