import type { EventType, Outcome, Role } from './types';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'C-Diary';

export const EVENT_TYPES: Record<EventType, { label: string; text: string; bg: string; border: string; dot: string }> = {
  hearing: { label: 'Court hearing', text: 'text-hearing', bg: 'bg-hearing-soft', border: 'border-hearing', dot: 'bg-hearing' },
  filing: { label: 'Filing deadline', text: 'text-filing', bg: 'bg-filing-soft', border: 'border-filing', dot: 'bg-filing' },
  client: { label: 'Client meeting', text: 'text-client', bg: 'bg-client-soft', border: 'border-client', dot: 'bg-client' },
  internal: { label: 'Internal meeting', text: 'text-internal', bg: 'bg-internal-soft', border: 'border-internal', dot: 'bg-internal' },
};

export const OUTCOMES: { value: Outcome; label: string; needsDate: boolean }[] = [
  { value: 'adjourned', label: 'Adjourned', needsDate: true },
  { value: 'reserved', label: 'Ruling or judgment reserved', needsDate: true },
  { value: 'judgment', label: 'Judgment delivered', needsDate: false },
  { value: 'struck_out', label: 'Struck out', needsDate: false },
  { value: 'settled', label: 'Settled out of court', needsDate: false },
  { value: 'held', label: 'Held (meeting or filing done)', needsDate: false },
  { value: 'other', label: 'Other', needsDate: false },
];

export const OUTCOME_LABEL: Record<Outcome, string> = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label])) as Record<Outcome, string>;

export const PURPOSES = [
  'Mention',
  'Hearing',
  'Continuation of hearing',
  'Cross-examination',
  'Defence',
  'Adoption of final written addresses',
  'Ruling',
  'Judgment',
  'Hearing of motion',
  'Report of settlement',
];

export const ROLES: { value: Role; label: string; note: string }[] = [
  { value: 'admin', label: 'Admin', note: 'Everything, including staff and roles' },
  { value: 'partner', label: 'Partner', note: 'Everything except managing staff' },
  { value: 'associate', label: 'Associate', note: 'Add and edit matters and events' },
  { value: 'clerk', label: 'Clerk', note: 'Add and edit; cannot delete' },
];

export const canDelete = (role: Role | undefined | null) => role === 'admin' || role === 'partner';
