import Link from 'next/link';
import Lockup from './brand/Lockup';
import { SITE } from '@/lib/config';

const LINKOVI = [
  { href: '/o-nama', label: 'O nama' },
  { href: '/uslovi', label: 'Uslovi korišćenja' },
  { href: '/privatnost', label: 'Politika privatnosti' }
];

/**
 * Futer — namerno kratak: logo, nekoliko linkova i pravna napomena.
 * Navigacija kroz proizvod je u zaglavlju, cene na naslovnoj.
 *
 * `demo` oznaka se pojavljuje samo kad baza nije popunjena — pošteno je
 * reći da su brojevi na ekranu primer, a ne stvarna analiza kola.
 */
export default function SiteFooter({ demo }: { demo: boolean }) {
  return (
    <footer className="border-t border-line bg-sunken">
      <div className="page flex flex-col gap-5 py-7 md:flex-row md:items-center md:justify-between">
        <Link
          href="/"
          aria-label={`${SITE.name} — početna`}
          className="inline-block w-fit transition-opacity duration-fast hover:opacity-85"
        >
          <Lockup size={28} />
        </Link>

        <nav aria-label="Futer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKOVI.map((l) => (
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
              <a
                href={`mailto:${SITE.email}`}
                className="text-small text-ink-3 transition-colors duration-fast hover:text-ink"
              >
                Kontakt
              </a>
            </li>
          </ul>
        </nav>
      </div>

      {demo && (
        <div className="page pb-5">
          <p className="text-[12px] text-warn">
            Baza još nije popunjena — prikazani brojevi su demonstracioni.
          </p>
        </div>
      )}

      <div className="border-t border-line">
        <div className="page flex flex-col gap-1.5 py-4 text-[11.5px] text-ink-4 sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} {SITE.name}
          </span>
          <span>Nezavisna platforma, nije povezana sa Euroleague Basketball.</span>
        </div>
      </div>
    </footer>
  );
}
