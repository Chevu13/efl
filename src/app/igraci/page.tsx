import type { Metadata } from 'next';
import Link from 'next/link';
import PlayerCard from '@/components/PlayerCard';
import PlayerTable from '@/components/player/PlayerTable';
import { SectionHead, EmptyState, Chip, RowDivider } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { getCurrentRound, getMyTier, getPricedPlayers, getTeams, trimForTier } from '@/lib/data';
import {
  NEXT_TIER,
  POSITION_PLURAL,
  PRICE_BANDS,
  bandLabel,
  planByCode,
  priceLabel
} from '@/lib/config';
import { untilLabel } from '@/lib/format';
import { TIER_RANK, isPremium, type PricedPlayer, type Team } from '@/lib/types';

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: '/igraci' },
  title: 'Izbori kola',
  description:
    'Igrači koji vrede svoju cenu u tekućem kolu EuroLeague Fantasy takmičenja, sa projekcijom i obrazloženjem.'
};

/**
 * Izbori kola.
 *
 * Gore stoje detaljni izbori sa obrazlozenjem — to je ono sto se
 * naplacuje. Ispod je cela tabela kola, koja daje kontekst i pokazuje da
 * izbori nisu izvuceni iz rukava.
 *
 * Odsecanje po paketu radi se ovde, na serveru: podaci koje korisnik nije
 * platio ne odlaze u pregledac uopste.
 */
export default async function Igraci() {
  const [round, teams, { tier }] = await Promise.all([
    getCurrentRound(),
    getTeams(),
    getMyTier()
  ]);
  const players = round ? await getPricedPlayers(round.id) : [];

  const need = NEXT_TIER[tier];
  const premium = isPremium(tier);

  /* Izbori nisu prvih N sa liste nego pretinci: besplatan jedan, Plus po
     jedan iz svakog cenovnog ranga, Pro po tri na svakoj poziciji. Ko je
     u kom pretincu odlucila je skripta pri uvozu (`tier_pick` i
     `pick_group`), pa stranica samo grupise ono sto joj server posalje. */
  const rank = TIER_RANK[tier];
  const otvoren = (t: 'FREE' | 'PLUS' | 'PRO') => rank >= TIER_RANK[t];
  const freePicks = players.filter((p) => p.tier_pick === 'FREE');
  const plusPicks = PRICE_BANDS.map((b) =>
    players.find((x) => x.tier_pick === 'PLUS' && x.pick_group === b.key)
  ).filter((x): x is PricedPlayer => !!x);
  const proPicks = players.filter((p) => p.tier_pick === 'PRO');

  /* Kartice izbora se crtaju na serveru: zakljucana kartica ispisuje samo
     poziciju, tim i protivnika, pa pun spisak ovde ne curi. Tabela je
     klijentska komponenta i sve sto dobije stize u pregledac — zato ide
     kroz trimForTier, koji skida projekcije za igrace van tvojih izbora. */
  const vidljivi = trimForTier(players, tier);
  const tableRows = tier === 'FREE' ? vidljivi.slice(0, 12) : vidljivi;
  const poId = new Map(vidljivi.map((p) => [p.id, p]));
  const kartica = (p: PricedPlayer) => poId.get(p.id) ?? p;

  if (!players.length) {
    return (
      <div className="page py-10">
        <SectionHead as="h1" eyebrow="Izbori kola" title="Igrači koji vrede svoju cenu" />
        <div className="mt-8">
          <EmptyState
            title="Cene za ovo kolo još nisu unete"
            desc="Izbori kola se pojavljuju čim budu unete cene i projekcije za tekuće kolo."
            action={
              <LinkButton href="/baza" variant="ghost">
                Otvori bazu igrača
              </LinkButton>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page py-10">
      <SectionHead
        as="h1"
        eyebrow={round ? `${round.number}. kolo · ${round.season}` : 'Izbori kola'}
        title="Igrači koji vrede svoju cenu"
        desc="Poredak je po razlici između projekcije i cene. Uz svaki izbor stoje razlog, protivnik i prosek — da možeš da proveriš zaključak, a ne samo da ga prihvatiš."
        action={
          <div className="flex items-center gap-2">
            {round?.deadline && <Chip>Još {untilLabel(round.deadline)}</Chip>}
            <Chip tone={premium ? 'brand' : 'default'}>{tier}</Chip>
          </div>
        }
      />

      {/* ---------------- besplatan izbor ---------------- */}
      {freePicks.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {freePicks.map((p) => (
            <PlayerCard key={p.id} p={kartica(p)} teams={teams} rank={1} />
          ))}
        </div>
      )}

      {/* ---------------- Plus: po jedan iz svakog ranga ---------------- */}
      {plusPicks.length > 0 && (
        <section className="mt-14">
          <SectionHead
            eyebrow="Plus"
            title="Po jedan iz svakog cenovnog ranga"
            desc="Skup, srednji i jeftin izbor — da postava ne stoji na jednoj polovini budžeta."
            action={<Chip tone={otvoren('PLUS') ? 'brand' : 'default'}>PLUS</Chip>}
          />
          {otvoren('PLUS') ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plusPicks.map((p) => {
                const b = PRICE_BANDS.find((x) => x.key === p.pick_group);
                return (
                  <div key={p.id}>
                    <p className="label mb-2">
                      {b?.label} <span className="text-ink-4">· {b?.desc}</span>
                    </p>
                    <PlayerCard p={kartica(p)} teams={teams} />
                  </div>
                );
              })}
            </div>
          ) : (
            <ZakljucanaGrupa
              teaser={plusPicks[0]}
              ukupno={plusPicks.length}
              paket="PLUS"
              teams={teams}
              mesta={PRICE_BANDS.map((b) => b.label)}
              opis="Po jedan izbor iz svakog cenovnog ranga, sa cenom, projekcijom i obrazloženjem — da postava ne stoji na jednoj polovini budžeta."
            />
          )}
        </section>
      )}

      {/* ---------------- Pro: po tri na svakoj poziciji ---------------- */}
      {proPicks.length > 0 && (
        <section className="mt-14">
          <SectionHead
            eyebrow="Pro"
            title="Po tri izbora na svakoj poziciji"
            desc="Za svaku poziciju jedan skup, jedan srednji i jedan jeftin — cela postava se može sastaviti odavde."
            action={<Chip tone={otvoren('PRO') ? 'brand' : 'default'}>PRO</Chip>}
          />
          {otvoren('PRO') ? (
            (['G', 'F', 'C'] as const).map((poz) => {
              const red = PRICE_BANDS.map((b) =>
                proPicks.find((x) => x.pick_group === `${poz}-${b.key}`)
              ).filter((x): x is PricedPlayer => !!x);
              if (!red.length) return null;
              return (
                <div key={poz} className="mt-8">
                  <RowDivider title={POSITION_PLURAL[poz]} meta={String(red.length)} />
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {red.map((p) => (
                      <div key={p.id}>
                        <p className="label mb-2">{bandLabel(String(p.pick_group).split('-')[1])}</p>
                        <PlayerCard p={kartica(p)} teams={teams} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <ZakljucanaGrupa
              teaser={proPicks[0]}
              ukupno={proPicks.length}
              paket="PRO"
              teams={teams}
              mesta={(['G', 'F', 'C'] as const).map((p) => POSITION_PLURAL[p])}
              opis="Za bekove, krila i centre po jedan skup, srednji i jeftin izbor — cela postava sa obrazloženjem za svakog igrača."
            />
          )}
        </section>
      )}

      {/* ---------------- cela tabela kola ---------------- */}
      <div className="mt-14">
        <SectionHead
          eyebrow="Cela lista kola"
          title="Svi igrači sa cenom"
          desc={
            tier === 'ULTRA'
              ? 'Sortiraj po razlici, vrednosti, projekciji ili protivniku i pronađi sopstvene zaključke.'
              : 'Cena i protivnik za sve igrače. Projekcija za celu ligu otključava se u Ultra paketu.'
          }
        />
        <div className="mt-6">
          <PlayerTable
            players={tableRows}
            totalCount={players.length}
            teams={teams}
            tier={tier}
            need={need}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Zaključana grupa izbora.
 *
 * Ranije je svaki zaključan izbor bio posebna kartica — za besplatan nalog
 * to je bilo dvanaest skoro istih pravougaonika sa katancem. Sada jedna
 * kartica pokazuje kako izbor izgleda, a ostatak je jedan panel koji kaže
 * koliko ih ima i kako su raspoređeni. Bez imena i brojeva: kartica i panel
 * se crtaju na serveru i ne nose ništa što paket ne otključava.
 */
function ZakljucanaGrupa({
  teaser,
  ukupno,
  paket,
  teams,
  mesta,
  opis
}: {
  teaser: PricedPlayer;
  ukupno: number;
  paket: 'PLUS' | 'PRO';
  teams: Record<string, Team>;
  mesta: string[];
  opis: string;
}) {
  const plan = planByCode(paket);
  const jos = ukupno - 1;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <PlayerCard p={teaser} teams={teams} locked need={paket} />

      <Link
        href="/paketi"
        className="group relative flex flex-col justify-between overflow-hidden rounded-md border border-dashed
                   border-brand/40 bg-gradient-to-br from-brand/[.10] via-surface to-surface p-6
                   transition-colors duration-fast hover:border-brand/70 sm:p-8 xl:col-span-2"
      >
        <div className="hatch pointer-events-none absolute inset-0 opacity-40" aria-hidden />

        <div className="relative">
          <span className="chip-brand">
            <LockIcon />
            {paket}
          </span>
          <h3 className="mt-4 text-[clamp(22px,3vw,30px)] uppercase leading-tight">
            Još {jos} {jos === 1 ? 'preporuka' : jos < 5 ? 'preporuke' : 'preporuka'} u paketu{' '}
            {plan?.name}
          </h3>
          <p className="mt-3 max-w-lg text-body leading-relaxed text-ink-2">{opis}</p>

          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Raspored izbora">
            {mesta.map((m) => (
              <li
                key={m}
                className="inline-flex items-center gap-2 rounded-xs border border-line bg-sunken/80 px-2.5 py-1.5
                           font-mono text-[11px] uppercase tracking-wide text-ink-3"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand/70" aria-hidden />
                {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="btn-primary btn-md">Otključaj {plan?.name}</span>
          {plan && (
            <span className="text-[12.5px] text-ink-3">
              <b className="statmono text-ink">{priceLabel(plan.priceCents)}</b> · {plan.days} dana
            </span>
          )}
          <span className="ml-auto hidden text-[12.5px] font-semibold text-brand transition-transform duration-fast group-hover:translate-x-0.5 sm:block">
            Uporedi pakete →
          </span>
        </div>
      </Link>
    </div>
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
