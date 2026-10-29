import { fmtDateLong, fmtTime, relDay } from './time';
import type { Outcome } from './types';

/** Default text for the client update after a hearing. The lawyer can edit it before sending. */
export function clientUpdateText(firmName: string, suit: string | null, outcome: Outcome, nextAt: Date | null, purpose: string | null) {
  const ref = suit ? ` (${suit})` : '';
  const when = nextAt ? `${fmtDateLong(nextAt)} at ${fmtTime(nextAt)}` : 'a date to be fixed';
  switch (outcome) {
    case 'adjourned':
      return `Good day. Your case${ref} came up in court today and was adjourned to ${when}${purpose ? ` for ${purpose.toLowerCase()}` : ''}. We will remind you before then. ${firmName}.`;
    case 'reserved':
      return `Good day. Your case${ref} came up in court today. The court reserved its decision to ${when}. ${firmName}.`;
    case 'judgment':
      return `Good day. Judgment was delivered in your case${ref} today. Your lawyer will call you to explain it and your options. ${firmName}.`;
    case 'struck_out':
      return `Good day. Your case${ref} was struck out today. Your lawyer will call you about the next steps. ${firmName}.`;
    case 'settled':
      return `Good day. The settlement in your case${ref} was reported to court today. Your lawyer will send you a copy. ${firmName}.`;
    default:
      return `Good day. There is an update on your case${ref}. Your lawyer will be in touch. ${firmName}.`;
  }
}

/** Reminder text for the lawyer (day before / hour before). */
export function lawyerReminderText(kind: 'day' | 'hour', title: string, at: Date, where: string, purpose: string | null, suit: string | null) {
  const lead = kind === 'hour' ? 'Within the hour' : relDay(at) === 'Today' ? 'Later today' : 'Tomorrow';
  return `${lead}: ${title}${suit ? ` (${suit})` : ''}, ${fmtTime(at)}${where ? `, ${where}` : ''}${purpose ? `. For ${purpose.toLowerCase()}` : ''}.`;
}

/** Day-before reminder for the client. */
export function clientReminderText(firmName: string, at: Date, where: string, suit: string | null) {
  const when = relDay(at) === 'Today' ? 'today' : 'tomorrow';
  return `Reminder: your case${suit ? ` (${suit})` : ''} is in court ${when}, ${fmtDateLong(at)} at ${fmtTime(at)}${where ? `, ${where}` : ''}. ${firmName}.`;
}

/** Message for "Remind client" sent by a lawyer before a hearing. Editable before sending. */
export function clientUpcomingText(firmName: string, clientName: string | null, at: Date, where: string, purpose: string | null, suit: string | null) {
  const greet = clientName ? `Good day ${clientName}.` : 'Good day.';
  const when = relDay(at);
  const day = when === 'Today' || when === 'Tomorrow' ? `${when.toLowerCase()}, ${fmtDateLong(at)}` : fmtDateLong(at);
  return `${greet} A reminder that your case${suit ? ` (${suit})` : ''} is coming up ${day} at ${fmtTime(at)}${where ? `, ${where}` : ''}${purpose ? `, for ${purpose.toLowerCase()}` : ''}. Please be available. ${firmName}.`;
}
