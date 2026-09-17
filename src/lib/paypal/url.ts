/**
 * Dve razlicite adrese sajta, za dve razlicite namene.
 *
 * Isti deploy na Vercelu odgovara na vise adresa (npr. efl-murex.vercel.app
 * i efl-<tim>.vercel.app). Pregledac cuva prijavu posebno za svaku, pa je
 * vazno na koju se korisnik vraca.
 */

/** Adresa sa koje je zahtev stvarno dosao — tu su kolacici prijave. */
function fromRequest(req: Request): string | null {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return null;
  const proto =
    req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Zvanicna adresa — za linkove u mejlovima.
 *
 * Ovde se ne veruje zaglavlju zahteva: link za novu lozinku napravljen iz
 * podmetnutog Host zaglavlja poslao bi zrtvu na tudji sajt sa vazecim
 * tokenom. Zato `NEXT_PUBLIC_SITE_URL` ima prednost.
 */
export function siteOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return fromRequest(req) ?? 'http://localhost:3000';
}

/**
 * Adresa za povratak sa PayPal-a — ista ona sa koje je kupac krenuo.
 *
 * Ranije se koristila zvanicna adresa. Kad se ona razlikovala od one na
 * kojoj je kupac bio, PayPal ga je vracao na adresu gde nije prijavljen:
 * paket je bio dodeljen, a stranica je pisala „Nisi prijavljen" i FREE.
 *
 * Zaglavlju se ovde sme verovati: narudzbinu pravi prijavljen korisnik za
 * sopstveni nalog, pa podmetnuta adresa moze da preusmeri samo njega.
 */
export function returnOrigin(req: Request): string {
  return fromRequest(req) ?? siteOrigin(req);
}
