import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Registracija bez potvrde mejlom.
 *
 * Supabase-ov ugradjeni mejler salje dve poruke na sat i redovno zavrsi u
 * nezeljenoj posti, pa link za potvrdu nikad ne stigne i nalog ostane mrtav.
 * Nalog se zato pravi servisnim kljucem i odmah je potvrdjen; prijava posle
 * ide normalno, lozinkom sa klijenta.
 *
 * ponytail: bez ogranicenja broja pokusaja po IP-u. Dodati ako neko pocne da
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

  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: username || email.split('@')[0] }
  });

  if (error) {
    const vec = /already|registered|exists/i.test(error.message);
    return NextResponse.json(
      { greska: vec ? 'Nalog sa ovim mejlom vec postoji. Prijavi se.' : error.message },
      { status: vec ? 409 : 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
