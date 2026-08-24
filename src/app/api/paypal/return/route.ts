import { NextResponse } from 'next/server';
import { grantEntitlement } from '@/lib/entitlements';
import {
  PayPalError,
  captureOf,
  captureOrder,
  decodeRef,
  getOrder
} from '@/lib/paypal/client';
import { siteOrigin } from '@/lib/paypal/url';

export const dynamic = 'force-dynamic';

/**
 * Povratak sa PayPal-a.
 *
 * Ovde se uplata zaista naplacuje i tek posle toga se dodeljuje paket.
 * Sam dolazak na ovu adresu nista ne otkljucava — status se uzima iz
 * PayPal odgovora, ne iz parametara u adresi.
 *
 * Isti posao radi i webhook. Ko god stigne prvi, drugi vidi da je
 * naplata vec upisana i ne dira nista.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get('token');
  const origin = siteOrigin(req);

  const back = (status: string, extra: Record<string, string> = {}) => {
    const to = new URL('/placanje/uspeh', origin);
    to.searchParams.set('status', status);
    Object.entries(extra).forEach(([k, v]) => to.searchParams.set(k, v));
    return NextResponse.redirect(to, { status: 303 });
  };

  if (!orderId) return back('greska');

  try {
    /* Ako je korisnik osvezio stranicu, narudzbina je vec naplacena. */
    let order = await getOrder(orderId);
    if (order.status !== 'COMPLETED') {
      order = await captureOrder(orderId);
    }

    if (order.status !== 'COMPLETED') {
      return back('nije-placeno', { order: orderId });
    }

    const cap = captureOf(order);
    if (!cap || cap.status !== 'COMPLETED') {
      return back('u-obradi', { order: orderId });
    }

    const { userId, plan } = decodeRef(cap.ref);
    if (!userId || !plan) {
      console.error('[paypal/return] uplata bez custom_id', orderId);
      return back('bez-naloga', { order: orderId });
    }

    const granted = await grantEntitlement({
      userId,
      plan,
      paypalId: cap.id,
      amount: cap.amount,
      currency: cap.currency,
      orderId: order.id
    });

    if (!granted.ok) {
      console.error('[paypal/return] dodela nije uspela:', granted.error);
      return back('greska-baza', { order: orderId });
    }

    return back('uspeh', { paket: granted.tier });
  } catch (e) {
    const err = e as PayPalError;
    console.error('[paypal/return]', err.message, err.debugId ?? '');
    return back('greska', { order: orderId });
  }
}
