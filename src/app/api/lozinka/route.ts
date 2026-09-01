import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mejlPodesen, omotac, posaljiMejl } from '@/lib/mejl';
import { siteOrigin } from '@/lib/paypal/url';
import { SITE } from '@/lib/config';

/**
 * Zahtev za promenu lozinke.
 *
 * Odgovor je uvek isti bez obzira da li nalog postoji — inace bi ova ruta
 * bila spisak registrovanih mejlova za svakoga ko je ume pozvati.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ greska: 'Mejl adresa nije ispravna.' }, { status: 400 });
  }

  if (!mejlPodesen()) {
    return NextResponse.json(
      { greska: 'Slanje mejlova jos nije podeseno na sajtu.' },
      { status: 503 }
    );
  }

  const { data } = await createAdminClient().auth.admin.generateLink({
    type: 'recovery',
    email
  });

  const token = data?.properties?.hashed_token;
  if (token) {
    const veza =
      `${siteOrigin(request)}/auth/potvrda` +
      `?token_hash=${encodeURIComponent(token)}&type=recovery&next=%2Fnalog%2Fnova-lozinka`;

    await posaljiMejl({
      za: email,
      naslov: `Nova lozinka — ${SITE.name}`,
      html: omotac({
        nadnaslov: 'Promena lozinke',
        naslov: 'Postavi novu lozinku',
        uvod:
          'Neko je zatrazio promenu lozinke za ovaj nalog. Klikni na dugme i upisi novu — ' +
          'stara prestaje da vazi tek kad postavis novu.',
        dugme: 'Postavi novu lozinku',
        veza,
        napomena:
          'Link vazi jedan sat i moze se upotrebiti jednom. Ako nisi ti trazio promenu, zanemari poruku — lozinka ostaje ista.'
      })
    });
  }

  return NextResponse.json({ ok: true });
}
