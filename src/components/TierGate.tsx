import Link from 'next/link';
import { PLANS, planByCode } from '@/lib/config';
import { priceLabel } from '@/lib/config';
import type { Tier } from '@/lib/types';

/**
 * Zakljucan deo proizvoda.
 *
 * Namerno nije zamucena slika sadrzaja. Pise se tacno sta se otkljucava,
 * koliko kosta i koliko toga ostaje neprikazano — korisnik treba da moze
 * da odluci, ne da nagadja.
 */
export default function TierGate({
  need,
  count,
  what = 'igraca',
  title,
  desc,
  className = ''
}: {
  need: Tier;
  /** Koliko stavki ostaje sakriveno. */
  count?: number;
  what?: string;
  title?: string;
  desc?: string;
  className?: string;
}) {
  const plan = planByCode(need) ?? PLANS[0];

  return (
    <section
      className={`relative overflow-hidden rounded-md border border-dashed border-brand/40
                  bg-gradient-to-b from-brand/[.08] to-surface ${className}`}
    >
      <div className="hatch pointer-events-none absolute inset-0 opacity-60" aria-hidden />

      <div className="relative grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
        <div className="max-w-lg">
          <span className="chip-brand">
            <LockIcon />
            {plan.code}
          </span>

          <h3 className="mt-4 text-[clamp(20px,3vw,26px)] uppercase">
            {title ?? (count ? `Jos ${count} ${what} ceka` : `Otkljucaj ${plan.name}`)}
          </h3>

          <p className="mt-3 text-body leading-relaxed text-ink-2">
            {desc ?? plan.pitch}
          </p>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {plan.features.slice(0, 4).map((f) => (
              <li key={f} className="flex items-start gap-2 text-small text-ink-2">
                <span className="mt-[7px] h-[3px] w-3 shrink-0 bg-brand" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 rounded-md border border-line bg-sunken p-5 text-center md:w-56">
          <div className="label">Mesecno</div>
          <div className="stat mt-1 text-[42px] leading-none text-ink">
            {priceLabel(plan.priceCents)}
          </div>
          <div className="mt-1 text-[11.5px] text-ink-3">{plan.days} dana pristupa</div>
          <Link href="/profil#paketi" className="btn-primary btn-md mt-5 w-full">
            Otkljucaj {plan.name}
          </Link>
          <p className="mt-3 text-[11px] text-ink-4">Placanje preko PayPal-a</p>
        </div>
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
