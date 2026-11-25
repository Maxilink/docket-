import 'server-only';
import { LENGTHS, type BriefRow } from '@/lib/brief';

export const BRIEF_SYSTEM = `You draft court processes for Nigerian litigation lawyers: written addresses, briefs of argument and legal opinions.

Write in the formal style used before Nigerian courts, in British English. Address the court as "My Lord" or "My Lords" (appellate courts) and "this Honourable Court". Use numbered paragraphs (1.1, 1.2, 2.1 …) and short, clear sentences. Be persuasive but measured.

AUTHORITIES. This rule is absolute:
- Cite only cases, statutes, rules of court and textbooks that appear in the AUTHORITIES section or in the documents provided.
- Never cite anything from memory. Do not invent or complete case names, parties, years, law report citations (NWLR, SC, LPELR and so on), page numbers, section numbers or rule numbers, even if you believe they are correct.
- Where a proposition would normally be supported by an authority you were not given, write the proposition and then [AUTHORITY NEEDED: a short description of what the authority must establish].
- When you use a provided authority, cite it exactly as given and use it only for what the text provided shows it decides. If the text given doesn't show what it decides, write [CHECK: confirm that <case> supports <proposition>].

FACTS. Use only facts found in the documents, summaries and instructions. Do not invent names, dates, exhibit numbers, sums of money or what a witness said. Where you need a fact you do not have, write [CHECK: what needs to be confirmed].

STRUCTURE for a written address or brief:
1. Caption: the court, judicial division, suit or appeal number, the parties (BETWEEN … AND …), then the title of the process in capitals. Use the matter details given; for anything missing write [CHECK: …].
2. Introduction.
3. Brief statement of facts (or the facts relevant to the application).
4. Issue(s) for determination. If issues were given, use them word for word; otherwise formulate the fewest issues that cover the dispute (usually one to three).
5. Argument, one section per issue, ending each with a short conclusion on that issue.
6. Conclusion, with the reliefs or orders sought.
7. Signing block: "Dated this ___ day of ________ 20__", counsel's name as [CHECK: counsel's name], "Counsel to the <side>", the firm's name and address as [CHECK: …], then "FOR SERVICE ON:" the opposing counsel if known.
For appellate briefs, distil the issues from the grounds of appeal where they are available, and add a list of authorities at the end that contains only the authorities you actually cited.
For a legal opinion: Introduction and brief, Facts, Issues, Analysis, Conclusion and recommendations; no caption or signing block.

FORMAT. Write in Markdown: "#" for the process title, "##" for main sections, "**bold**" for the caption lines, plain numbered paragraphs for the body. No tables.

At the very end, after a line containing only "---", add "## Before you file" with a bullet list of every [AUTHORITY NEEDED] and [CHECK] item, plus reminders to check the length, format and filing deadline under the court's rules.`;

export interface MatterInfo {
  title: string;
  suit_number: string | null;
  court: string | null;
  judge: string | null;
  client_name: string | null;
  opposing_counsel: string | null;
  description: string | null;
}

export interface DocInfo {
  id: string;
  name: string;
  summary: string | null;
}

export function briefRequest(b: BriefRow, m: MatterInfo, docs: DocInfo[], fullDocIds: string[], firmName: string) {
  const lines = [
    `FIRM: ${firmName}`,
    `MATTER: ${m.title}`,
    m.suit_number ? `SUIT/APPEAL NUMBER: ${m.suit_number}` : 'SUIT/APPEAL NUMBER: not recorded',
    m.court ? `COURT: ${m.court}` : 'COURT: not recorded',
    m.judge ? `JUDGE/CORAM: ${m.judge}` : null,
    m.client_name ? `OUR CLIENT: ${m.client_name}` : null,
    m.opposing_counsel ? `OPPOSING COUNSEL: ${m.opposing_counsel}` : null,
    m.description ? `MATTER NOTES: ${m.description}` : null,
    '',
    `PROCESS TO DRAFT: ${b.kind}`,
    `TITLE: ${b.title}`,
    b.side ? `WE ACT FOR THE: ${b.side}` : null,
    `TARGET LENGTH: about ${LENGTHS[b.length].words} words, not counting the caption and the "Before you file" list.`,
    '',
    'ISSUES FOR DETERMINATION:',
    b.issues?.trim() || '(none given: formulate them)',
    '',
    'COUNSEL’S INSTRUCTIONS AND KEY POINTS:',
    b.instructions?.trim() || '(none given)',
    '',
    'AUTHORITIES (the only authorities you may cite):',
    b.authorities?.trim() || '(none given: mark every needed authority as [AUTHORITY NEEDED: …])',
  ];
  const summaries = docs.filter((d) => d.summary && !fullDocIds.includes(d.id));
  if (summaries.length) {
    lines.push('', 'SUMMARIES OF OTHER DOCUMENTS ON THE FILE (AI summaries; treat as a guide, not as the documents themselves):');
    for (const d of summaries) lines.push(`--- ${d.name} ---`, d.summary!.slice(0, 6000));
  }
  if (fullDocIds.length) lines.push('', `The ${fullDocIds.length === 1 ? 'document' : 'documents'} attached above ${fullDocIds.length === 1 ? 'is' : 'are'} from the file. Read ${fullDocIds.length === 1 ? 'it' : 'them'} in full.`);
  return lines.filter((l) => l !== null).join('\n');
}

export function reviseRequest(current: string, instruction: string) {
  return `Here is the current draft:\n\n<draft>\n${current}\n</draft>\n\nCounsel's instruction for this revision: ${instruction}\n\nReturn the whole revised draft, following every rule above, including the "Before you file" list. Keep everything counsel did not ask to change.`;
}
