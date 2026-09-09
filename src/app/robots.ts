import type { MetadataRoute } from 'next';
import { SITE_URL, absUrl } from '@/lib/config';

/**
 * robots.txt
 *
 * Zabranjeno je sve iza naloga i sve sto je samo mehanika: API rute,
 * povratne stranice sa PayPal-a i potvrde iz mejla. Te adrese nose
 * jednokratne tokene u upitu i nemaju sta da trazе u pretrazi.
 *
 * Dok sajt nije na svom domenu, indeksiranje se zabranjuje u celosti —
 * bolje nego da Google zapamti privremenu Vercel adresu kao original.
 */
export default function robots(): MetadataRoute.Robots {
  const naSvomDomenu = !!process.env.NEXT_PUBLIC_SITE_URL;

  if (!naSvomDomenu) {
    return {
      rules: { userAgent: '*', disallow: '/' }
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/profil', '/nalog/', '/placanje/']
    },
    sitemap: absUrl('/sitemap.xml'),
    host: SITE_URL
  };
}
