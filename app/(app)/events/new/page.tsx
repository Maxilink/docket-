import Link from 'next/link';
import { requireMember, getStaff } from '@/lib/session';
import EventForm from '@/components/EventForm';
import { ymd } from '@/lib/time';
import type { EventType } from '@/lib/types';

const TYPES: EventType[] = ['hearing', 'filing', 'client', 'internal', 'other'];

export const metadata = { title: 'New event' };

export default async function NewEventPage(props: { searchParams: Promise<{ date?: string; matter?: string; type?: string; purpose?: string; notes?: string; title?: string; time?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, profile } = await requireMember();
  const [staff, { data: matters }] = await Promise.all([
    getStaff(supabase),
    supabase.from('matters').select('id, title, suit_number, court, courtroom, lead_lawyer_id, client_phone, client_email').eq('status', 'active').order('title'),
  ]);
  const today = ymd(new Date());
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) && searchParams.date >= today ? searchParams.date : today;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href={searchParams.matter ? `/matters/${searchParams.matter}` : '/calendar'} className="text-sm text-muted hover:underline">← Back</Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">New event</h1>
      <EventForm
        matters={matters ?? []}
        staff={staff}
        minDate={today}
        defaults={{
          date,
          time: searchParams.time && /^\d{2}:\d{2}$/.test(searchParams.time) ? searchParams.time : '09:00',
          matterId: searchParams.matter,
          lawyerId: profile.id,
          type: TYPES.includes(searchParams.type as EventType) ? (searchParams.type as EventType) : undefined,
          purpose: searchParams.purpose?.slice(0, 200),
          notes: searchParams.notes?.slice(0, 2000),
          title: searchParams.title?.slice(0, 200),
        }}
      />
    </div>
  );
}
