import Link from 'next/link';
import Lockup from './brand/Lockup';
import { PRIMARY } from './nav/links';
import { SITE } from '@/lib/config';

/**
 * Futer. Drzi identitet, mapu proizvoda i pravnu napomenu.
 *
 * `demo` oznaka se pojavljuje samo kad baza nije popunjena — posteno je
 * reci da su brojevi na ekranu primer, a ne stvarna analiza kola.
 */
export default function SiteFooter({ demo }: { demo: boolean }) {
  return (
    <footer className="border-t border-line bg-sunken">
      <div className="page grid gap-10 py-12 md:grid-cols-[1fr_auto]">
        <div>
          <Lockup variant="wide" size={44} />
          <p className="mt-5 max-w-sm text-small leading-relaxed text-ink-3">
            {SITE.tagline} Analitika za EuroLeague Fantasy — cena, projekcija,
            tezina protivnika i vrednost, za svako kolo.
          </p>

          {demo && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-sm border border-warn/40 bg-warn/[.08]
                          px-3 py-2 text-[12px] text-ink-2">
              <span className="font-mono font-bold text-warn" aria-hidden>
                !
              </span>
              Baza jos nije popunjena — prikazani brojevi su demonstracioni.
            </p>
          )}
        </div>

        <nav aria-label="Futer" className="md:min-w-[220px]">
          <p className="label mb-4">Proizvod</p>
          <ul className="space-y-2.5">
            {PRIMARY.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-small text-ink-3 transition-colors duration-fast hover:text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/profil#paketi"
                className="text-small text-ink-3 transition-colors duration-fast hover:text-ink"
              >
                Paketi i cene
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="page flex flex-wrap justify-between gap-x-8 gap-y-2 py-5 font-mono text-[10.5px]
                        uppercase tracking-[0.12em] text-ink-4">
          <span>© {new Date().getFullYear()} {SITE.name}</span>
          <span>Nezavisna analiticka platforma · bez veze sa Euroleague Basketball</span>
        </div>
      </div>
    </footer>
  );
}
