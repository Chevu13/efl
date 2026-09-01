import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Ovde stiže korisnik kad klikne na link iz mejla.
 * Bez ove rute Supabase vrati kod na početnu stranicu, koja ne zna
 * šta bi s njim, pa prijava nikad ne prođe.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  /* Samo interne adrese — spoljna bi ovo pretvorila u otvoreno preusmerenje. */
  const trazeno = searchParams.get('next') ?? '/igra';
  const next = trazeno.startsWith('/') && !trazeno.startsWith('//') ? trazeno : '/igra';

  // Supabase ume da vrati i grešku direktno u adresi
  const err = searchParams.get('error_description') ?? searchParams.get('error');
  if (err) {
    return NextResponse.redirect(`${origin}/auth/greska?poruka=${encodeURIComponent(err)}`);
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/auth/greska?poruka=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/auth/greska`);
}
