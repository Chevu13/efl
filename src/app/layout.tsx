import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Nav from '@/components/Nav';
import { getMyTier } from '@/lib/data';

const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Euro Fantasy Lab — Prestani da nagađaš. Počni da računaš.',
  description:
    'Analitika za EuroLeague Fantasy: cena, projekcija poena, težina protivnika i vrednost za svako kolo.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { email, tier } = await getMyTier();
  return (
    <html lang="sr" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <Nav email={email} tier={tier} />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-20">{children}</main>
        <footer className="border-t border-line py-8">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4
                          font-mono text-[10.5px] text-muted">
            <span>© 2026 EURO FANTASY LAB</span>
            <span>NEZAVISNA ANALITIČKA PLATFORMA · BEZ VEZE SA EUROLEAGUE BASKETBALL</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
