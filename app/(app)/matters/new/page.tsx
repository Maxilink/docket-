import Link from 'next/link';
import { requireMember, getStaff } from '@/lib/session';
import MatterForm from '@/components/MatterForm';

export const metadata = { title: 'New matter' };

export default async function NewMatterPage() {
  const { supabase, profile } = await requireMember();
  const staff = await getStaff(supabase);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/matters" className="text-sm text-muted hover:underline">← Matters</Link>
      <h1 className="font-display text-3xl font-normal">New matter</h1>
      <MatterForm staff={staff} defaultLawyer={profile.id} />
    </div>
  );
}
