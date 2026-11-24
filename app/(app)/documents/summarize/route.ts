import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AI_MODEL, AiError, contentFor, summarise } from '@/lib/ai';

export const dynamic = 'force-dynamic';
// Long documents can take a while for Claude to read.
export const maxDuration = 60;

/** POST { id } → summarises one document of the signed-in person's firm and saves the summary. */
export async function POST(request: NextRequest) {
  const { id } = ((await request.json().catch(() => ({}))) ?? {}) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Document not found.' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  // Reading through the person's own access proves the document belongs to their firm.
  const { data: doc } = await supabase
    .from('documents')
    .select('id, name, mime_type, size_bytes, storage_path, matter:matters(title, suit_number, court)')
    .eq('id', id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  const d = doc as unknown as {
    id: string; name: string; mime_type: string | null; size_bytes: number | null; storage_path: string;
    matter: { title: string; suit_number: string | null; court: string | null } | null;
  };

  const admin = createAdminClient();
  const fail = async (message: string, status = 400) => {
    await admin.from('documents').update({ summary_status: 'failed', summary_error: message }).eq('id', d.id);
    return NextResponse.json({ error: message }, { status });
  };

  await admin.from('documents').update({ summary_status: 'working', summary_error: null }).eq('id', d.id);

  try {
    const { data: file, error: dlErr } = await supabase.storage.from('matter-docs').download(d.storage_path);
    if (dlErr || !file) return fail('The file could not be opened. Try uploading it again.', 500);
    const bytes = Buffer.from(await file.arrayBuffer());
    const block = contentFor(d.name, d.mime_type, bytes);
    const context = d.matter
      ? `This document is filed under the matter "${d.matter.title}"${d.matter.suit_number ? ` (${d.matter.suit_number})` : ''}${d.matter.court ? `, ${d.matter.court}` : ''}.`
      : 'This document belongs to a case file.';
    const summary = await summarise(block, context);
    await admin
      .from('documents')
      .update({ summary, summary_status: 'done', summary_error: null, summary_model: AI_MODEL, summarized_at: new Date().toISOString() })
      .eq('id', d.id);
    return NextResponse.json({ summary, model: AI_MODEL, at: new Date().toISOString() });
  } catch (e) {
    if (e instanceof AiError) return fail(e.message);
    return fail('Something went wrong while summarising. Try again in a minute.', 500);
  }
}
