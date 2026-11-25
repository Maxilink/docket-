/** Shared definitions for AI-drafted briefs and written addresses (used on the server and in the browser). */

export const BRIEF_KINDS = [
  { value: 'Written address in support of a motion', court: 'trial' },
  { value: 'Written address in opposition to a motion', court: 'trial' },
  { value: 'Final written address', court: 'trial' },
  { value: 'Reply on points of law', court: 'trial' },
  { value: 'Appellant’s brief of argument', court: 'appeal' },
  { value: 'Respondent’s brief of argument', court: 'appeal' },
  { value: 'Appellant’s reply brief', court: 'appeal' },
  { value: 'Legal opinion', court: 'none' },
] as const;

export const SIDES = ['Claimant', 'Defendant', 'Applicant', 'Respondent', 'Appellant', 'Petitioner', 'Prosecution', 'Defence'] as const;

export const LENGTHS = {
  short: { label: 'Short (about 4 pages)', words: 1200 },
  standard: { label: 'Standard (about 8 pages)', words: 2500 },
  full: { label: 'Full (about 15 pages)', words: 4500 },
} as const;
export type BriefLength = keyof typeof LENGTHS;

/** Most documents Claude reads in full for one draft; the rest are used through their summaries. */
export const MAX_FULL_DOCS = 4;

export const PRIMSOL_URL = 'https://primsol.lawpavilion.com/';

export interface BriefRow {
  id: string;
  matter_id: string;
  event_id: string | null;
  kind: string;
  title: string;
  side: string | null;
  issues: string | null;
  instructions: string | null;
  authorities: string | null;
  document_ids: string[];
  length: BriefLength;
  content: string | null;
  previous_content: string | null;
  status: 'draft' | 'working' | 'failed';
  error: string | null;
  model: string | null;
  created_by: string | null;
  updated_at: string;
}

export const BRIEF_COLUMNS =
  'id, matter_id, event_id, kind, title, side, issues, instructions, authorities, document_ids, length, content, previous_content, status, error, model, created_by, updated_at';

/** Gaps the draft leaves for counsel: [AUTHORITY NEEDED: …] and [CHECK: …]. */
export function findGaps(text: string | null | undefined) {
  const out: { kind: 'authority' | 'check'; text: string }[] = [];
  if (!text) return out;
  const re = /\[(AUTHORITY NEEDED|CHECK):\s*([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ kind: /AUTHORITY/i.test(m[1]) ? 'authority' : 'check', text: m[2].trim() });
  return out;
}
