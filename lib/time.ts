// All dates are shown and entered in Nigerian time (WAT, UTC+1, no daylight saving).
export const TZ = 'Africa/Lagos';
const OFFSET_MS = 60 * 60 * 1000;

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parts(d: Date) {
  const t = new Date(d.getTime() + OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), dow: t.getUTCDay() };
}

/** A moment from a Lagos calendar date and clock time. */
export function lagos(y: number, m: number, d: number, h = 0, min = 0) {
  return new Date(Date.UTC(y, m, d, h, min) - OFFSET_MS);
}

export function ymd(d: Date) {
  const p = parts(d);
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function hm(d: Date) {
  const p = parts(d);
  return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
}

export function fromInputs(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const d = new Date(`${date}T${t}:00+01:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function startOfDay(d: Date) {
  const p = parts(d);
  return lagos(p.y, p.m, p.d);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

export function fmtTime(d: Date) {
  const p = parts(d);
  const ap = p.h >= 12 ? 'pm' : 'am';
  return `${p.h % 12 || 12}:${String(p.min).padStart(2, '0')} ${ap}`;
}

export function fmtDate(d: Date) {
  const p = parts(d);
  return `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
}

export function fmtDateLong(d: Date) {
  const p = parts(d);
  return `${WEEKDAYS[p.dow]}, ${p.d} ${MONTHS[p.m]} ${p.y}`;
}

export function relDay(d: Date, now = new Date()) {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WEEKDAYS[parts(d).dow];
  return '';
}

export function daysUntil(d: Date, now = new Date()) {
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
}
