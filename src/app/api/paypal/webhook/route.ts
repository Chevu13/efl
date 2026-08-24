import { NextResponse } from 'next/server';
import { alreadyProcessed, grantEntitlement, revokeEntitlement } from '@/lib/entitlements';
import { planForAmount } from '@/lib/config';
import { decodeRef, verifyWebhook, webhookConfigured } from '@/lib/paypal/client';

export const dynamic = 'force-dynamic';

/**
 * PayPal webhook.
 *
 * Podesi u PayPal Dashboard -> Apps & Credentials -> Webhooks:
 *   URL:      https://tvoj-sajt/api/paypal/webhook
 *   Dogadjaji: PAYMENT.CAPTURE.COMPLETED
 *              PAYMENT.CAPTURE.DENIED
 *              PAYMENT.CAPTURE.REFUNDED
 *              PAYMENT.CAPTURE.REVERSED
 *
 * Tri stvari koje ova ruta mora da radi ispravno:
 *
 * 1. Potpis se proverava kod PayPal-a. Bez toga bi svako mogao da posalje
 *    lazan dogadjaj na ovu adresu i sam sebi ukljuci paket.
 * 2. Obrada je idempotentna. PayPal ponavlja isporuku dok ne dobije 200,
 *    pa isti dogadjaj stize vise puta — pravo se dodeljuje samo jednom.
 * 3. Odgovor je 200 i za dogadjaje koje ne obradjujemo, da PayPal ne bi
 *    beskonacno ponavljao ono sto nas ne zanima.
 */

type WebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    links?: { href?: string; rel?: string }[];
    supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
  };
};

/**
 * Kod povracaja `resource.id` je id povracaja, a ne naplate. Id naplate
 * — po kojem se pravo i dodeljuje — stoji u vezanim podacima ili u
 * `links` vezi "up".
 */
function captureIdOf(res: NonNullable<WebhookEvent['resource']>, eventType: string) {
  if (eventType !== 'PAYMENT.CAPTURE.REFUNDED') return res.id ?? null;
  const related = res.supplementary_data?.related_ids?.capture_id;
  if (related) return related;
  const up = res.links?.find((l) => l.rel === 'up')?.href;
  return up?.split('/captures/')[1]?.split(/[/?]/)[0] ?? null;
}

export async function POST(req: Request) {
  const raw = await req.text();

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Neispravan sadrzaj.' }, { status: 400 });
  }

  /* ---------------- 1. potpis ---------------- */
  if (!webhookConfigured()) {
    /* Bez PAYPAL_WEBHOOK_ID nema sta da se proveri. U razvoju se to sme
       privremeno preskociti, u produkciji nikad. */
    const allowUnverified =
      process.env.PAYPAL_ENV !== 'live' &&
      process.env.PAYPAL_ALLOW_UNVERIFIED_WEBHOOKS === 'true';

    if (!allowUnverified) {
      console.error('[paypal/webhook] nedostaje PAYPAL_WEBHOOK_ID — dogadjaj odbijen');
      return NextResponse.json({ error: 'Webhook nije podesen.' }, { status: 401 });
    }
    console.warn('[paypal/webhook] provera potpisa preskocena (samo sandbox)');
  } else {
    let ok = false;
    try {
      ok = await verifyWebhook(req.headers, event);
    } catch (e) {
      console.error('[paypal/webhook] provera potpisa nije uspela:', (e as Error).message);
      /* 500 da PayPal pokusa ponovo — mozda je nas problem, ne njihov. */
      return NextResponse.json({ error: 'Provera potpisa nije uspela.' }, { status: 500 });
    }
    if (!ok) {
      console.error('[paypal/webhook] potpis nije ispravan', event.id);
      return NextResponse.json({ error: 'Potpis nije ispravan.' }, { status: 401 });
    }
  }

  /* ---------------- 2. duplikat ---------------- */
  if (event.id && (await alreadyProcessed(event.id, event.event_type ?? '?'))) {
    return NextResponse.json({ ok: true, duplikat: true });
  }

  const res = event.resource ?? {};
  const paypalId = res.id;

  /* ---------------- 3. obrada ---------------- */
  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      if (!paypalId) return NextResponse.json({ ok: true, ignored: 'bez id-ja naplate' });

      const { userId, plan } = decodeRef(res.custom_id);
      const amount = Number(res.amount?.value ?? 0);

      if (!userId) {
        /* Uplata bez oznake naloga — resava se rucno. Vracamo 200 da
           PayPal prestane da ponavlja; zapis ostaje u logu. */
        console.warn('[paypal/webhook] uplata bez custom_id:', paypalId, amount);
        return NextResponse.json({ ok: true, warn: 'Uplata nije vezana za nalog.' });
      }

      /* Ako oznake paketa nema (stara narudzbina), izvedi ga iz iznosa. */
      const planCode = plan ?? planForAmount(amount).code;

      const granted = await grantEntitlement({
        userId,
        plan: planCode,
        paypalId,
        amount,
        currency: res.amount?.currency_code,
        orderId: res.supplementary_data?.related_ids?.order_id ?? null
      });

      if (!granted.ok) {
        console.error('[paypal/webhook] dodela nije uspela:', granted.error);
        /* 500 -> PayPal ce pokusati ponovo, pa uplata nece propasti. */
        return NextResponse.json({ error: granted.error }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        tier: granted.tier,
        duplikat: granted.duplicate
      });
    }

    case 'PAYMENT.CAPTURE.REFUNDED':
    case 'PAYMENT.CAPTURE.REVERSED':
    case 'PAYMENT.CAPTURE.DENIED': {
      const captureId = captureIdOf(res, event.event_type);
      if (captureId) {
        await revokeEntitlement(captureId, event.event_type.split('.').pop()!.toLowerCase());
      }
      return NextResponse.json({ ok: true, povuceno: !!captureId });
    }

    default:
      return NextResponse.json({ ok: true, ignored: event.event_type });
  }
}
