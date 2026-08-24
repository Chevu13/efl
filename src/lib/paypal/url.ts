/**
 * Apsolutna adresa sajta. PayPal-u trebaju pune povratne adrese, a one se
 * razlikuju izmedju lokalnog razvoja, pregleda i produkcije.
 *
 * `NEXT_PUBLIC_SITE_URL` ima prednost; ako nije podesen, adresa se cita iz
 * zaglavlja zahteva, sto pokriva Vercel pregled-adrese bez dodatnog posla.
 */
export function siteOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const proto =
    req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
