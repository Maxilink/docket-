/** Turns Nigerian numbers like 0803 123 4567 or +234 803... into 2348031234567. Returns null if it doesn't look valid. */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let n = raw.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('0') && n.length === 11) n = '234' + n.slice(1);
  if (!/^\d{10,15}$/.test(n)) return null;
  return n;
}
