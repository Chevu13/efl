import CheckoutButton from './CheckoutButton';
import { Chip } from '../ui/primitives';
import { PLANS, priceLabel, type PlanCode } from '@/lib/config';
import { dateShort } from '@/lib/format';
import type { Nadogradnja } from '@/lib/nadogradnja';
import { TIER_RANK, type Tier } from '@/lib/types';

const FREE_FEATURES = [
  'Jedan izbor kola sa obrazloženjem',
  'Raspored i procena svakog meča',
  'Izazov kola i sezonska lista',
  'Cene igrača sa početka liste'
];

/**
 * Paketi.
 *
 * Nije mreza od cetiri identicne kartice — besplatan paket stoji kao
 * osnova, a placeni kao stepenice iznad njega. Aktivan paket se
 * prepoznaje po traci i po reci, ne samo po boji ivice.
 */
export default function PricingTable({
  tier,
  loggedIn,
  paypalReady,
  nadogradnje = {}
}: {
  tier: Tier;
  loggedIn: boolean;
  paypalReady: boolean;
  /** Doplata po paketu, izracunata na serveru istom funkcijom kao naplata. */
  nadogradnje?: Partial<Record<PlanCode, Nadogradnja>>;
}) {
  return (
    <div>
      {/* besplatno — osnova, ne konkurencija placenim paketima */}
      <div className="panel flex flex-wrap items-center justify-between gap-6 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-display text-[18px] font-extrabold uppercase tracking-tight">
              Besplatno
            </span>
            {tier === 'FREE' && <Chip tone="brand">Tvoj paket</Chip>}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-[12.5px] text-ink-3">
                <span className="h-[3px] w-2.5 shrink-0 bg-ink-4" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="stat text-[30px] leading-none text-ink-3">€0</div>
      </div>

      {/* placeni paketi */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => {
          const active = plan.tier === tier;
          const owned = TIER_RANK[tier] >= TIER_RANK[plan.tier];
          const nad = owned ? undefined : nadogradnje[plan.code];

          return (
            <article
              key={plan.code}
              className={`relative flex flex-col overflow-hidden rounded-md border bg-surface
                          ${active
                            ? 'border-brand'
                            : plan.featured
                              ? 'border-brand/40'
                              : 'border-line'}`}
            >
              {(plan.featured || active) && (
                <div
                  className={`px-5 py-1.5 text-center font-mono text-[10px] font-bold uppercase
                              tracking-[0.16em] ${
                                active ? 'bg-brand text-black' : 'bg-brand/15 text-brand-400'
                              }`}
                >
                  {active ? 'Tvoj aktivan paket' : 'Najčešći izbor'}
                </div>
              )}

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[22px] uppercase">{plan.name}</h3>
                  <span className="chip">{plan.code}</span>
                </div>

                {nad ? (
                  <div className="mt-4">
                    <div className="flex items-end gap-1.5">
                      <span className="stat text-[44px] leading-none text-brand">
                        {priceLabel(nad.iznosCents)}
                      </span>
                      <span className="pb-1 text-[12px] text-ink-3">doplata</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-ink-3">
                      <s className="text-ink-4">{priceLabel(plan.priceCents)}</s> · prelaziš odmah,
                      važi do <b className="text-ink-2">{dateShort(nad.vaziDo)}</b>
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 flex items-end gap-1.5">
                    <span className="stat text-[44px] leading-none">
                      {priceLabel(plan.priceCents)}
                    </span>
                    <span className="pb-1 text-[12px] text-ink-3">/ {plan.days} dana</span>
                  </div>
                )}

                <p className="mt-3 border-b border-line pb-4 text-small text-ink-3">{plan.pitch}</p>

                <ul className="mt-4 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-ink-2">
                      <span className="mt-[7px] h-[3px] w-3 shrink-0 bg-brand" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {owned ? (
                    <div className="flex h-11 items-center justify-center rounded-sm border border-line
                                    bg-elev text-[13px] font-semibold text-ink-3">
                      {active ? 'Već je aktivan' : 'Uključeno u tvoj paket'}
                    </div>
                  ) : paypalReady ? (
                    <CheckoutButton
                      plan={plan.code}
                      loggedIn={loggedIn}
                      label={nad ? `Nadogradi na ${plan.name}` : `Uzmi ${plan.name}`}
                      variant={plan.featured ? 'primary' : 'ghost'}
                    />
                  ) : (
                    <div className="rounded-sm border border-line bg-elev px-3 py-3 text-center text-[12px] text-ink-3">
                      Plaćanje još nije uključeno. Paket se za sada otključava
                      pristupnim kodom.
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
        Plaćanje preko PayPal-a · jedna uplata otključava paket na {PLANS[0].days} dana ·
        bez automatske obnove · nadogradnja: plaćaš samo razliku
      </p>
    </div>
  );
}
