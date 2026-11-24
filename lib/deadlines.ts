import type { Calc } from '@/lib/timelines';

/** A day the court registry is closed that the firm has added (Sallah, Maulud, vacation, strike). */
export interface Closure {
  id?: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string;
  label: string;
  kind?: 'closed' | 'vacation';
}

const DAY = 86400e3;
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const toYmd = (d: Date) => d.toISOString().slice(0, 10);
const shift = (s: string, n: number) => toYmd(new Date(toDate(s).getTime() + n * DAY));
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon 16 Nov 2026" */
export function fmtDay(s: string) {
  const d = toDate(s);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Easter Sunday (Gregorian calendar). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Nigerian public holidays with fixed or calculable dates. Sallah and Maulud dates
 * depend on the moon and are announced each year, so firms add those as closures.
 */
export function fixedHolidays(y: number): Record<string, string> {
  const e = easter(y);
  return {
    [`${y}-01-01`]: 'New Year’s Day',
    [shift(e, -2)]: 'Good Friday',
    [shift(e, 1)]: 'Easter Monday',
    [`${y}-05-01`]: 'Workers’ Day',
    [`${y}-06-12`]: 'Democracy Day',
    [`${y}-10-01`]: 'Independence Day',
    [`${y}-12-25`]: 'Christmas Day',
    [`${y}-12-26`]: 'Boxing Day',
  };
}

/** Why the registry is closed on this day, or null if it is open. */
export function closedReason(s: string, closures: Closure[]): string | null {
  const dow = toDate(s).getUTCDay();
  if (dow === 6) return 'Saturday';
  if (dow === 0) return 'Sunday';
  const h = fixedHolidays(Number(s.slice(0, 4)))[s];
  if (h) return h;
  const c = closures.find((x) => x.kind !== 'vacation' && x.starts_on <= s && s <= x.ends_on);
  return c ? c.label : null;
}

function addMonths(s: string, n: number) {
  const [y, m, d] = s.split('-').map(Number);
  const total = m - 1 + n;
  const ny = y + Math.floor(total / 12), nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export interface DeadlineResult {
  /** The date to put in the diary. */
  due: string;
  /** The date before any move off a closed day. */
  counted: string;
  explain: string;
  /** The counted day falls when the registry is closed. `next` is the next open day, `earlier` the open day before. */
  moved: { reason: string; from: string; next: string; earlier: string } | null;
  /** Strict rules (election matters) that land on a closed day: not moved, but flagged. */
  landsOnClosed: string | null;
  /** Closures that fall inside the counting period, so the lawyer can check whether time runs. */
  crosses: string[];
}

/**
 * Turns a timeline into a date. Counting follows the usual approach: the day of the event is
 * not counted unless the rule says so, and a last day that falls when the registry is closed moves
 * to the next open day (or, for "before" rules, to the open day before it).
 */
export function computeDeadline(calc: Calc, trigger: string, closures: Closure[] = [], strict = false): DeadlineResult {
  let counted: string;
  let explain: string;
  const unitWord = calc.unit === 'months' ? (calc.n === 1 ? 'month' : 'months') : calc.unit === 'working_days' ? 'working days' : calc.n === 1 ? 'day' : 'days';

  if (calc.dir === 'after') {
    if (calc.unit === 'months') {
      counted = addMonths(trigger, calc.n);
      explain = `${calc.n} ${unitWord} from ${fmtDay(trigger)} ends on ${fmtDay(counted)}.`;
    } else if (calc.unit === 'working_days') {
      let day = trigger, left = calc.n;
      while (left > 0) {
        day = shift(day, 1);
        if (!closedReason(day, closures)) left -= 1;
      }
      counted = day;
      explain = `Counting ${calc.n} working days after ${fmtDay(trigger)}, skipping weekends, public holidays and closures, the last is ${fmtDay(counted)}.`;
    } else if (calc.inclusive) {
      counted = shift(trigger, calc.n - 1);
      explain = `Counting ${fmtDay(trigger)} as day 1, day ${calc.n} is ${fmtDay(counted)}.`;
    } else {
      counted = shift(trigger, calc.n);
      explain = `${fmtDay(trigger)} is not counted. Day 1 is ${fmtDay(shift(trigger, 1))}, so day ${calc.n} is ${fmtDay(counted)}.`;
    }
  } else if (calc.dir === 'before') {
    counted = shift(trigger, -calc.n);
    explain = `${calc.n} ${unitWord} before ${fmtDay(trigger)} is ${fmtDay(counted)}, the last day to file.`;
  } else {
    counted = shift(trigger, -(calc.n + 1));
    explain = `${calc.n} clear days means neither the filing day nor ${fmtDay(trigger)} counts, so the last day to file is ${fmtDay(counted)}.`;
  }

  let due = counted;
  let moved: DeadlineResult['moved'] = null;
  let landsOnClosed: string | null = null;
  const reason = calc.unit === 'working_days' ? null : closedReason(counted, closures);
  if (reason) {
    if (strict) {
      landsOnClosed = reason;
    } else {
      let next = counted, earlier = counted;
      while (closedReason(next, closures)) next = shift(next, 1);
      while (closedReason(earlier, closures)) earlier = shift(earlier, -1);
      // "Before" rules must be met early, so they always go to the earlier open day.
      due = calc.dir === 'after' ? next : earlier;
      moved = { reason, from: counted, next, earlier };
    }
  }

  const [lo, hi] = calc.dir === 'after' ? [trigger, due] : [due, trigger];
  // Vacations, and closures of 3 days or more, inside the counting period are flagged.
  const crosses = closures.filter((c) => c.starts_on <= hi && c.ends_on >= lo && (c.kind === 'vacation' || c.ends_on >= shift(c.starts_on, 2))).map((c) => c.label);

  return { due, counted, explain, moved, landsOnClosed, crosses: Array.from(new Set(crosses)) };
}

export const ymdToday = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10); // WAT
