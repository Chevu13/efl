import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { Tier } from '@/lib/types';

/**
 * PayPal webhook.
 *
 * Podesi u PayPal Dashboard -> Apps & Credentials -> Webhooks:
 *   URL:      https://tvoj-sajt.vercel.app/api/paypal/webhook
 *   Dogadjaj: PAYMENT.CAPTURE.COMPLETED  (i BILLING.SUBSCRIPTION.ACTIVATED za pretplate)
 *
 * Kupac pri placanju mora da nosi svoj user id — prosledi ga kao custom_id
 * kada praviš narudžbinu, pa ga ovde čitamo i vezujemo uplatu za nalog.
 */

const API = () =>
  process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function token() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString('base64');
  const r = await fetch(`${API()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const j = await r.json();
  return j.access_token as string;
}

/** Bez ove provere bilo ko može da pošalje lažnu uplatu na ovu adresu. */
async function verifikuj(headers: Headers, body: unknown) {
  const r = await fetch(`${API()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: headers.get('paypal-auth-algo'),
      cert_url: headers.get('paypal-cert-url'),
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      transmission_time: headers.get('paypal-transmission-time'),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: body
    })
  });
  const j = await r.json();
  return j.verification_status === 'SUCCESS';
}

/**
 * Iznos -> paket.
 * MORA da se poklapa sa cenama u src/components/Paketi.tsx.
 * Ako tamo promeniš cenu, promeni i ovde.
 */
function tierZaIznos(eur: number): { tier: Tier; days: number } {
  if (eur >= 29) return { tier: 'ULTRA', days: 30 };
  if (eur >= 19) return { tier: 'PRO', days: 30 };
  if (eur >= 9) return { tier: 'PLUS', days: 30 };
  return { tier: 'PLUS', days: 30 };
}

export async function POST(req: Request) {
  const body = await req.json();

  if (process.env.PAYPAL_WEBHOOK_ID) {
    const ok = await verifikuj(req.headers, body);
    if (!ok) return NextResponse.json({ error: 'Potpis nije ispravan' }, { status: 401 });
  }

  if (body.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return NextResponse.json({ ignored: body.event_type });
  }

  const res = body.resource ?? {};
  const userId: string | undefined = res.custom_id;
  const iznos = Number(res.amount?.value ?? 0);
  const paypalId: string = res.id;

  if (!userId) {
    // Uplata bez naloga — upiši kao neraspoređenu, rešavaš ručno.
    return NextResponse.json({ warn: 'Nema custom_id, uplata nije vezana za nalog.' });
  }

  const sb = createAdminClient();

  // Ista uplata može stići dva puta — ne duplirati pretplatu.
  const { data: postoji } = await sb
    .from('subscriptions')
    .select('id')
    .eq('paypal_id', paypalId)
    .maybeSingle();
  if (postoji) return NextResponse.json({ ok: true, duplikat: true });

  const { tier, days } = tierZaIznos(iznos);
  const ends = new Date(Date.now() + days * 864e5).toISOString();

  const { error } = await sb.from('subscriptions').insert({
    user_id: userId,
    tier,
    ends_at: ends,
    source: 'paypal',
    paypal_id: paypalId,
    note: `${iznos} ${res.amount?.currency_code ?? 'EUR'}`
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, tier });
}
