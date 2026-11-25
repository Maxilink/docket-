/**
 * A small, safe Markdown-to-HTML converter for drafts: headings, bold, italics, lists, rules and
 * paragraphs. All text is escaped first, so the output can be shown with innerHTML.
 * Gaps the AI leaves ([AUTHORITY NEEDED: …], [CHECK: …]) are wrapped in <mark>.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string, marks: { auth: string; check: string }) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[(AUTHORITY NEEDED):\s*([^\]]+)\]/gi, `<mark ${marks.auth}>[$1: $2]</mark>`)
    .replace(/\[(CHECK):\s*([^\]]+)\]/gi, `<mark ${marks.check}>[$1: $2]</mark>`);
}

export function mdToHtml(md: string, opts: { forWord?: boolean } = {}) {
  const marks = opts.forWord
    ? { auth: 'style="background:#FDE2E2"', check: 'style="background:#FDF0C7"' }
    : { auth: 'class="gap gap-auth"', check: 'class="gap gap-check"' };
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map((l) => inline(l, marks)).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i, marks)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue; }
    if (h) { flushPara(); flushList(); const n = Math.min(h[1].length, 3); out.push(`<h${n}>${inline(h[2], marks)}</h${n}>`); continue; }
    if (ul) { flushPara(); if (list?.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list!.items.push(ul[1]); continue; }
    if (ol && !/^\s*\d+\.\d/.test(line)) { flushPara(); if (list?.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list!.items.push(ol[1]); continue; }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join('\n');
}

/** A Word-compatible document (opens in Microsoft Word and Google Docs) in court style. */
export function wordDocument(title: string, md: string) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
@page { size: A4; margin: 2.54cm; }
body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; }
h1 { font-size: 13pt; text-align: center; text-transform: uppercase; margin: 18pt 0 12pt; }
h2 { font-size: 12pt; text-transform: uppercase; margin: 14pt 0 6pt; }
h3 { font-size: 12pt; margin: 12pt 0 6pt; }
p { margin: 0 0 10pt; text-align: justify; }
</style></head><body>${mdToHtml(md, { forWord: true })}</body></html>`;
}
