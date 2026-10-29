import Link from 'next/link';
import { requireMember, getStaff } from '@/lib/session';
import EventForm from '@/components/EventForm';
import { ymd } from '@/lib/time';

export const metadata = { title: 'New event' };

export default async function NewEventPage({ searchParams }: { searchParams: { date?: string; matter?: string } }) {
  const { supabase, profile } = await requireMember();
  const [staff, { data: matters }] = await Promise.all([
    getStaff(supabase),
    supabase.from('matters').select('id, title, suit_number, court, courtroom, lead_lawyer_id, client_phone').eq('status', 'active').order('title'),
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
        defaults={{ date, time: '09:00', matterId: searchParams.matter, lawyerId: profile.id }}
      />
    </div>
  );
}
