import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { planByCode } from '@/lib/config';
import {
  PayPalError,
  approveUrl,
  createOrder,
  paypalConfigured,
  paypalEnv
} from '@/lib/paypal/client';
import { returnOrigin } from '@/lib/paypal/url';
import { nadogradnja } from '@/lib/nadogradnja';

export const dynamic = 'force-dynamic';

/**
 * Pravljenje PayPal narudzbine.
 *
 * Klijent salje samo oznaku paketa. Iznos, valuta i trajanje se citaju sa
 * servera iz kataloga u `config.ts` — tako niko ne moze da podesi cenu iz
 * pregledaca. Uz narudzbinu ide `custom_id` sa id-jem naloga i paketom,
 * da bi kasnija provera znala kome pripada uplata.
 */
export async function POST(req: Request) {
  const sb = createClient();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Prvo se prijavi.' }, { status: 401 });
  }

  if (!paypalConfigured()) {
    return NextResponse.json(
      {
        error:
          'Placanje jos nije podeseno. Dodaj PAYPAL_CLIENT_ID i PAYPAL_SECRET u okruzenje.'
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = planByCode(String(body.plan ?? ''));
  if (!plan) {
    return NextResponse.json({ error: 'Nepoznat paket.' }, { status: 400 });
  }

  const origin = returnOrigin(req);

  /* Nadogradnja se racuna ovde, iz baze — klijent salje samo koji paket
     hoce, nikad iznos. Vlastite pretplate se citaju korisnikovim klijentom
     (RLS), pa ne treba admin kljuc. */
  const { data: redovi } = await sb
    .from('subscriptions')
    .select('id, tier, source, status, starts_at, ends_at')
    .eq('user_id', user.id);
  const nad = nadogradnja(redovi ?? [], plan.code);

  try {
    const order = await createOrder({
      plan,
      userId: user.id,
      returnUrl: `${origin}/api/paypal/return`,
      cancelUrl: `${origin}/placanje/otkazano?plan=${plan.code}`,
      nadogradnja: nad
        ? {
            osnovaId: nad.osnovaId,
            osnovaNaziv: planByCode(nad.osnova)?.name ?? nad.osnova,
            iznosCents: nad.iznosCents,
            vaziDo: nad.vaziDo
          }
        : undefined,
      /* Dupli klik na dugme vraca istu narudzbinu umesto dve. Nadogradnja
         ima svoj kljuc, da ne pokupi ranije napravljenu narudzbinu po
         punoj ceni iz istog minuta. */
      requestId: `efl-${user.id}-${plan.code}${nad ? `-u${nad.osnovaId}` : ''}-${Math.floor(Date.now() / 60000)}`
    });

    const url = approveUrl(order);
    if (!url) {
      return NextResponse.json(
        { error: 'PayPal nije vratio adresu za placanje.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ id: order.id, url, env: paypalEnv() });
  } catch (e) {
    const err = e as PayPalError;
    console.error('[paypal/order]', err.message, err.debugId ?? '');
    return NextResponse.json(
      { error: 'PayPal trenutno ne prihvata narudzbinu. Pokusaj ponovo.' },
      { status: 502 }
    );
  }
}
