/**
 * Nagrade izazova kola — isti tekst na naslovnoj i na stranici izazova.
 *
 * Pravilo vlasnika sajta: pobednik kola dobija Pro za sledeću nedelju,
 * pobednik meseca dobija Ultra (najjači paket) za sledeći mesec.
 *
 * Bez hook-ova, pa radi i u serverskoj i u klijentskoj komponenti.
 */
export const NAGRADE = [
  {
    ko: 'Pobednik kola',
    paket: 'Pro',
    trajanje: 'sledećih 7 dana',
    opis: 'Najviše tačnih odgovora u kolu.'
  },
  {
    ko: 'Pobednik meseca',
    paket: 'Ultra',
    trajanje: 'ceo sledeći mesec',
    opis: 'Najviše tačnih odgovora u svim kolima meseca.'
  }
] as const;

export default function IzazovNagrade({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2'}`}>
      {NAGRADE.map((n) => (
        <li
          key={n.ko}
          className={`relative flex items-center gap-4 overflow-hidden rounded-md border border-brand/35
                      bg-gradient-to-r from-brand/[.10] to-transparent ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
        >
          <span
            className={`grid shrink-0 place-items-center rounded-full border border-brand/50 bg-brand/15 text-brand
                        ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}
            aria-hidden
          >
            <TrofejIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </span>
          <span className="min-w-0">
            <span className="label block">{n.ko}</span>
            <span
              className={`mt-1 block font-display font-extrabold uppercase leading-tight tracking-tight text-ink
                          ${compact ? 'text-[15px]' : 'text-[18px]'}`}
            >
              <span className="text-brand">{n.paket}</span> · {n.trajanje}
            </span>
            {!compact && <span className="mt-0.5 block text-[12.5px] text-ink-3">{n.opis}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TrofejIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M5 2.5h6v3.25a3 3 0 0 1-6 0V2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5 3.75H3.25v.75A2 2 0 0 0 5.2 6.5M11 3.75h1.75v.75a2 2 0 0 1-1.95 2M8 8.75V11m-2.25 2.5h4.5M6.5 13.5 7 11h2l.5 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
