import 'server-only';
import { inflateRawSync } from 'node:zlib';

/** Claude model used for summaries. Override with ANTHROPIC_MODEL (for example claude-haiku-5-5 for lower cost). */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
};
const TEXT_EXT = ['txt', 'md', 'csv', 'rtf'];

export const SUPPORTED_HINT = 'PDF, a Word (.docx) file, a photo (JPG or PNG) or a text file';

function ext(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

// ---------- Word (.docx) text extraction, with no extra packages ----------
// A .docx is a zip file; its text lives in word/document.xml.
function unzipEntry(buf: Buffer, wanted: string): Buffer | null {
  // Find the end-of-central-directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

export function docxToText(buf: Buffer): string | null {
  const xml = unzipEntry(buf, 'word/document.xml');
  if (!xml) return null;
  const text = xml
    .toString('utf8')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<[^>]+>/g, '');
  return decodeXml(text).replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- Claude ----------
const SYSTEM = `You summarise documents for litigation lawyers at a Nigerian law firm, inside their court diary app.
Write for a busy lawyer who has not read the document. Be accurate and concise. Use only what the document says.
If something is unclear, unreadable or missing, say so instead of guessing. Never invent names, dates, sums or citations.
Use plain text with these headings, each on its own line, and short "- " bullet points under them:
What this is
Parties
Key points
Dates and deadlines
Orders, reliefs or demands
Suggested next steps
Leave out a heading if the document has nothing for it. Keep the whole summary under about 350 words.
Write dates as day month year (for example 14 March 2026). Keep suit numbers and section references exactly as written.`;

type Block =
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'text'; text: string };

export class AiError extends Error {}

/** Builds the content Claude reads from the file, or explains why the file can't be read. */
export function contentFor(name: string, mime: string | null, bytes: Buffer): Block {
  const e = ext(name);
  const type = (mime || '').toLowerCase();
  if (type === 'application/pdf' || e === 'pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } };
  }
  const img = IMAGE_TYPES[e] || (type.startsWith('image/') && Object.values(IMAGE_TYPES).includes(type) ? type : '');
  if (img) {
    if (bytes.length > 5 * 1024 * 1024) throw new AiError('This photo is larger than 5 MB. Upload a smaller photo, or scan it to PDF.');
    return { type: 'image', source: { type: 'base64', media_type: img, data: bytes.toString('base64') } };
  }
  if (e === 'docx') {
    const text = docxToText(bytes);
    if (!text) throw new AiError('This Word file could not be read. Save it again as .docx or PDF and re-upload it.');
    return { type: 'text', text: `Document "${name}":\n\n${text.slice(0, 400_000)}` };
  }
  if (e === 'doc') throw new AiError('Old Word files (.doc) can\'t be read. Save it as .docx or PDF and re-upload it.');
  if (TEXT_EXT.includes(e) || type.startsWith('text/')) {
    return { type: 'text', text: `Document "${name}":\n\n${bytes.toString('utf8').slice(0, 400_000)}` };
  }
  throw new AiError(`This file type can't be summarised. Upload a ${SUPPORTED_HINT}.`);
}

export async function summarise(block: Block, context: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError('AI summaries aren\'t switched on yet. Add ANTHROPIC_API_KEY in Vercel.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [block, { type: 'text', text: `${context}\n\nSummarise this document using the headings described.` }],
        },
      ],
    }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => null)) as
    | { content?: { type: string; text?: string }[]; error?: { type?: string; message?: string } }
    | null;
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new AiError('The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.');
    if (res.status === 429) throw new AiError('Too many summaries at once. Wait a minute and try again.');
    if (res.status === 413 || /too large|too long|exceed/i.test(msg)) throw new AiError('This document is too large to summarise in one go. Split it into smaller files.');
    if (/credit|billing|balance/i.test(msg)) throw new AiError('The Anthropic account is out of credit. Top it up in the Claude Console.');
    throw new AiError(`The summary failed: ${msg}`);
  }
  const text = (body?.content ?? []).filter((c) => c.type === 'text' && c.text).map((c) => c.text).join('\n').trim();
  if (!text) throw new AiError('The summary came back empty. Try again.');
  return text;
}
