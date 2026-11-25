import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AI_MODEL, AiError, contentFor, streamClaude, type Block } from '@/lib/ai';
import { BRIEF_COLUMNS, MAX_FULL_DOCS, type BriefRow } from '@/lib/brief';
import { BRIEF_SYSTEM, briefRequest, reviseRequest, type DocInfo, type MatterInfo } from '@/lib/briefPrompt';

export const dynamic = 'force-dynamic';
// A full brief takes Claude a few minutes to write.
export const maxDuration = 300;

const MAX_FULL_BYTES = 20 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * POST { id, revise? } → drafts (or revises) a brief and streams the text back as it is written.
 * The finished text is saved on the brief; the previous version is kept so it can be undone.
 */
export async function POST(request: NextRequest) {
  const { id, revise } = ((await request.json().catch(() => ({}))) ?? {}) as { id?: string; revise?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Draft not found.' }, 400);
  const instruction = typeof revise === 'string' ? revise.trim().slice(0, 2000) : '';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  const { data: me } = await supabase.from('profiles').select('role, firm:firms(name)').eq('id', user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role;
  if (!role || !['admin', 'partner', 'associate'].includes(role)) return json({ error: 'Only counsel (admins, partners and associates) can draft briefs.' }, 403);
  const firmName = ((me as unknown as { firm?: { name?: string } } | null)?.firm?.name) ?? 'the firm';

  // Reading through the person's own access proves the brief belongs to their firm.
  const { data: row } = await supabase.from('briefs').select(BRIEF_COLUMNS).eq('id', id).maybeSingle();
  if (!row) return json({ error: 'Draft not found.' }, 404);
  const b = row as unknown as BriefRow;
  if (instruction && !b.content) return json({ error: 'There is no draft to revise yet.' }, 400);

  const [{ data: matter }, { data: docRows }] = await Promise.all([
    supabase.from('matters').select('title, suit_number, court, judge, client_name, opposing_counsel, description').eq('id', b.matter_id).maybeSingle(),
    supabase.from('documents').select('id, name, mime_type, size_bytes, storage_path, summary').eq('matter_id', b.matter_id).order('created_at'),
  ]);
  if (!matter) return json({ error: 'The matter for this draft was not found.' }, 404);
  const docs = (docRows ?? []) as (DocInfo & { mime_type: string | null; size_bytes: number | null; storage_path: string })[];

  const admin = createAdminClient();
  const fail = async (message: string) => {
    await admin.from('briefs').update({ status: 'failed', error: message }).eq('id', b.id);
  };

  // Documents read in full (first draft only; revisions work from the draft and the summaries).
  const blocks: Block[] = [];
  const fullIds: string[] = [];
  if (!instruction) {
    const chosen = docs.filter((d) => b.document_ids.includes(d.id)).slice(0, MAX_FULL_DOCS);
    const total = chosen.reduce((n, d) => n + (d.size_bytes ?? 0), 0);
    if (total > MAX_FULL_BYTES) {
      await fail('The chosen documents are larger than 20 MB together. Choose fewer documents to read in full.');
      return json({ error: 'The chosen documents are larger than 20 MB together. Choose fewer documents to read in full.' }, 400);
    }
    for (const d of chosen) {
      try {
        const { data: file } = await supabase.storage.from('matter-docs').download(d.storage_path);
        if (!file) continue;
        blocks.push(contentFor(d.name, d.mime_type, Buffer.from(await file.arrayBuffer())));
        blocks.push({ type: 'text', text: `(Above: "${d.name}")` });
        fullIds.push(d.id);
      } catch (e) {
        const msg = e instanceof AiError ? `${d.name}: ${e.message}` : `${d.name} could not be opened.`;
        await fail(msg);
        return json({ error: msg }, 400);
      }
    }
  }

  const request_ = briefRequest(b, matter as MatterInfo, docs, fullIds, firmName);
  const content: Block[] = [...blocks, { type: 'text', text: instruction ? `${request_}\n\n${reviseRequest(b.content!, instruction)}` : `${request_}\n\nWrite the draft now.` }];

  await admin.from('briefs').update({ status: 'working', error: null }).eq('id', b.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (t: string) => {
        if (!open) return;
        try { controller.enqueue(encoder.encode(t)); } catch { open = false; }
      };
      try {
        const { text, stop } = await streamClaude({
          system: BRIEF_SYSTEM,
          content,
          maxTokens: 16000,
          what: instruction ? 'revision' : 'draft',
          onText: send,
        });
        const finalText = stop === 'max_tokens' ? `${text}\n\n[CHECK: the draft stopped because it reached the length limit. Ask for a shorter version or revise one section at a time.]` : text;
        if (stop === 'max_tokens') send('\n\n[CHECK: the draft stopped because it reached the length limit. Ask for a shorter version or revise one section at a time.]');
        await admin
          .from('briefs')
          .update({ content: finalText, previous_content: b.content, status: 'draft', error: null, model: AI_MODEL })
          .eq('id', b.id);
      } catch (e) {
        const msg = e instanceof AiError ? e.message : 'Something went wrong while drafting. Try again in a minute.';
        await fail(msg);
        send(`\n\n<<ERROR>>${msg}`);
      } finally {
        if (open) { try { controller.close(); } catch { /* already closed */ } }
      }
    },
  });

  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
