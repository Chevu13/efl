import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Rute koje nemaju smisla bez naloga. */
const ZASTICENO = ['/profil'];

/**
 * Osvezava Supabase sesiju na svakom zahtevu da prijava ne istice, i
 * cuva rute kojima treba nalog.
 *
 * Zastita je ovde, a ne samo u stranici: `redirect()` iz server
 * komponente stize tek posle pocetka strimovanja, pa korisnik nakratko
 * vidi zaglavlje stranice koju ne sme da otvori. Ovde se preusmerenje
 * desava pre nego sto ijedan bajt HTML-a krene.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && ZASTICENO.some((p) => path === p || path.startsWith(`${p}/`))) {
    const to = new URL('/prijava', request.url);
    to.searchParams.set('next', path);
    return NextResponse.redirect(to);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)']
};
