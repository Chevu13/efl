import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import SiteFooter from '@/components/SiteFooter';
import { getCurrentRound, getMyTier, isDemoData } from '@/lib/data';
import { SITE } from '@/lib/config';

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

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.short}`
  },
  description:
    'Analitika za EuroLeague Fantasy: cena, projekcija poena, tezina protivnika i vrednost za svako kolo. Optimizator postave koji objasni svaku zamenu.',
  applicationName: SITE.name,
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description:
      'Cena, projekcija, tezina protivnika i vrednost za svakog igraca EuroLeague Fantasy takmicenja.',
    type: 'website',
    locale: 'sr_RS'
  }
};

export const viewport: Viewport = {
  themeColor: '#08090B',
  colorScheme: 'dark'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ email, username, tier }, round, demo] = await Promise.all([
    getMyTier(),
    getCurrentRound(),
    isDemoData()
  ]);

  return (
    <html lang="sr" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <Nav
          email={email}
          username={username}
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
