import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Ovde stize korisnik iz naseg mejla.
 *
 * Mejlove salje sajt preko Resend-a, pa link nosi `token_hash` umesto
 * Supabase-ovog `code`. Razmena za sesiju mora na serveru — samo tu se
 * kolacici sesije mogu upisati pre nego sto stranica krene da se crta.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  /* Samo interne adrese — inace je ovo otvoreno preusmerenje. */
  const trazeno = searchParams.get('next') ?? '/igra';
  const next = trazeno.startsWith('/') && !trazeno.startsWith('//') ? trazeno : '/igra';

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/auth/greska`);
  }

  const { error } = await createClient().auth.verifyOtp({ token_hash, type });
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/greska?poruka=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
