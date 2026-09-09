import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import SiteFooter from '@/components/SiteFooter';
import { getCurrentRound, getMyTier, isDemoData } from '@/lib/data';
import { PLANS, SITE, SITE_URL, absUrl } from '@/lib/config';

/**
 * Zvanicno brend pismo je Proxima Nova. Dok licencirani webfont nije u
 * projektu, koristi se Barlow — isti humanisticki grotesk, visok x-height,
 * atletski utisak. Cim se u globals.css otkomentarisu @font-face pravila,
 * Proxima Nova preuzima jer stoji prva u stack-u u tailwind.config.ts.
 */
const sans = Barlow({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap'
});

const display = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap'
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap'
});

const OPIS =
  'Analitika za EuroLeague Fantasy: cena, projekcija poena, tezina protivnika i razlika u odnosu na cenu za svako kolo. Optimizator postave koji objasni svaku zamenu.';

export const metadata: Metadata = {
  /* Bez ovoga Next ne ume da napravi apsolutne adrese za canonical i OG
     sliku, pa deljenje linka na mrezama vrati prazan pregled. */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.short}`
  },
  description: OPIS,
  applicationName: SITE.name,
  keywords: [
    'EuroLeague Fantasy',
    'fantasy kosarka',
    'projekcija fantasy poena',
    'cene igraca',
    'optimizator postave',
    'Evroliga'
  ],
  alternates: { canonical: '/' },
  openGraph: {
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: OPIS,
    url: '/',
    type: 'website',
    locale: SITE.locale
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: OPIS
  },
  /* Dok sajt nije na svom domenu, privremena adresa ne sme u indeks. */
  robots: process.env.NEXT_PUBLIC_SITE_URL
    ? { index: true, follow: true }
    : { index: false, follow: false }
};

export const viewport: Viewport = {
  themeColor: '#08090B',
  colorScheme: 'dark'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ email, username, tier, avatar }, round, demo] = await Promise.all([
    getMyTier(),
    getCurrentRound(),
    isDemoData()
  ]);

  return (
    <html lang={SITE.lang} className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {/* Strukturirani podaci — pretrazivacu kazu sta je ovo i kako da
            se pretraga sajta prikaze kao polje u rezultatu. Cene stoje uz
            proizvod jer se paketi stvarno prodaju. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': absUrl('/#sajt'),
                  url: absUrl('/'),
                  name: SITE.name,
                  inLanguage: SITE.lang,
                  description: OPIS,
                  publisher: { '@id': absUrl('/#organizacija') }
                },
                {
                  '@type': 'Organization',
                  '@id': absUrl('/#organizacija'),
                  name: SITE.name,
                  url: absUrl('/'),
                  logo: absUrl('/brand/efl-mark.svg')
                },
                {
                  '@type': 'SoftwareApplication',
                  name: SITE.name,
                  applicationCategory: 'SportsApplication',
                  operatingSystem: 'Web',
                  inLanguage: SITE.lang,
                  description: OPIS,
                  offers: PLANS.map((plan) => ({
                    '@type': 'Offer',
                    name: plan.name,
                    price: (plan.priceCents / 100).toFixed(2),
                    priceCurrency: SITE.currency,
                    category: `${plan.days} dana pristupa`
                  }))
                }
              ]
            })
          }}
        />
        <Nav
          email={email}
          username={username}
          avatar={avatar}
          tier={tier}
          round={round ? { number: round.number, deadline: round.deadline } : null}
        />

        <main id="sadrzaj" className="pb-20 pt-[var(--nav-h)]">
          {children}
        </main>

        <SiteFooter demo={demo} />
      </body>
    </html>
  );
}
