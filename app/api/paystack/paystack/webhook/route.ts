import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { confirmPayment, validSignature } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

/**
 * Paystack calls this when a payment succeeds, even if the admin closed the page before being sent back.
 * Set it in Paystack: Settings > API Keys & Webhooks > Live Webhook URL = https://<your domain>/api/paystack/webhook
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (event.event === 'charge.success' && event.data?.reference) {
    // The payment is checked with Paystack again before the firm is extended.
    const r = await confirmPayment(createAdminClient(), event.data.reference);
    return NextResponse.json({ ok: r.ok, message: r.message });
  }
  return NextResponse.json({ ok: true });
}
