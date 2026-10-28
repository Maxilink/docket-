import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember, getStaff } from '@/lib/session';
import MatterForm from '@/components/MatterForm';
import type { Matter } from '@/lib/types';

export const metadata = { title: 'Edit matter' };

export default async function EditMatterPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireMember();
  const [{ data }, staff] = await Promise.all([supabase.from('matters').select('*').eq('id', params.id).maybeSingle(), getStaff(supabase)]);
  if (!data) notFound();
  const matter = data as Matter;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href={`/matters/${matter.id}`} className="text-sm text-muted hover:underline">← {matter.title}</Link>
      <h1 className="font-display text-3xl font-normal">Edit matter</h1>
      <MatterForm matter={matter} staff={staff} />
    </div>
  );
}
