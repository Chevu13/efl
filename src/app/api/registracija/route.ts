import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { mejlPodesen, omotac, posaljiMejl } from '@/lib/mejl';
import { siteOrigin } from '@/lib/paypal/url';
import { SITE } from '@/lib/config';

/**
 * Registracija sa potvrdom mejla, poslatom preko Resend-a.
 *
 * Supabase-ov ugradjeni mejler salje dve poruke na sat i redovno zavrsi u
 * nezeljenoj posti, pa se poruka salje odavde. Link nosi `token_hash`, koji
 * `/auth/potvrda` razmenjuje za sesiju.
 *
 * Ako `RESEND_API_KEY` nije podesen, nalog se pravi odmah potvrdjen i
 * klijent radi obicnu prijavu — sajt tako radi i pre nego sto se mejl
 * podesi, umesto da registracija bude mrtva.
 *
 * ponytail: bez ogranicenja pokusaja po IP-u. Dodati ako neko pocne da
 * pravi naloge masinski — do tada Supabase-ova sopstvena granica drzi vodu.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown; username?: unknown }
    | null;

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const username = typeof body?.username === 'string' ? body.username.trim().slice(0, 40) : '';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ greska: 'Mejl adresa nije ispravna.' }, { status: 400 });
  }
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ greska: 'Lozinka mora imati bar 6 znakova.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const ime = username || email.split('@')[0];

  /* Bez podesenog mejla nema cega da se potvrdi — nalog ide odmah aktivan. */
  if (!mejlPodesen()) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: ime }
    });
    if (error) return greskaNaloga(error.message);
    return NextResponse.json({ ok: true, potvrda: false });
  }

  /* `generateLink` sam pravi nalog kad ga nema, i vraca token za potvrdu. */
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { data: { username: ime } }
  });
  if (error || !data?.properties?.hashed_token) {
    return greskaNaloga(error?.message ?? 'Nije moguce napraviti nalog.');
  }

  const veza =
    `${siteOrigin(request)}/auth/potvrda` +
    `?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=signup&next=%2Figra`;

  const poslato = await posaljiMejl({
    za: email,
    naslov: `Potvrdi nalog — ${SITE.name}`,
    html: omotac({
      nadnaslov: 'Potvrda naloga',
      naslov: `Zdravo, ${ime}`,
      uvod:
        'Ostao je jedan klik. Potvrdi mejl adresu i nalog je spreman — postava se cuva, ' +
        'listic se boduje, a tacnost kroz sezonu pocinje da se broji.',
      dugme: 'Potvrdi nalog',
      veza,
      napomena:
        'Link vazi 24 sata. Ako nisi ti trazio nalog, slobodno zanemari ovu poruku — bez potvrde se nista ne dogadja.'
    })
  });

  if (!poslato) {
    return NextResponse.json(
      { greska: 'Nalog je napravljen, ali mejl nije poslat. Probaj „Zaboravljena lozinka”.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, potvrda: true });
}

function greskaNaloga(poruka: string) {
  const vec = /already|registered|exists/i.test(poruka);
  return NextResponse.json(
    { greska: vec ? 'Nalog sa ovim mejlom vec postoji. Prijavi se.' : poruka },
    { status: vec ? 409 : 400 }
  );
}
