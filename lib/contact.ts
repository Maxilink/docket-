/** How the client can be reached, for showing on screen: email first, then phone. */
export function clientContact(m: { client_email?: string | null; client_phone?: string | null } | null | undefined): string | null {
  if (!m) return null;
  const bits = [m.client_email || null, m.client_phone ? `+${m.client_phone}` : null].filter(Boolean);
  return bits.length ? bits.join(' and ') : null;
}
