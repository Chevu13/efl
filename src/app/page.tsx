import Link from 'next/link';
import { PlayerCutout } from '@/components/PlayerPhoto';
import PlayerCard from '@/components/PlayerCard';
import MatchupPill from '@/components/player/MatchupPill';
import FixtureRow from '@/components/fixtures/FixtureRow';
import IzazovNagrade from '@/components/game/IzazovNagrade';
import PricingTable from '@/components/premium/PricingTable';
import CourtBackdrop from '@/components/ui/CourtBackdrop';
import { Chip, Hint, SectionHead } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import {
  getCoaches,
  getCurrentRound,
  getFixtures,
  getMySubscriptions,
  getMyTier,
  getPricedPlayers,
  getTeams,
  trimForTier,
  vidiProjekciju
} from '@/lib/data';
import { edge, num, signed, teamName, untilLabel, valueClass } from '@/lib/format';
import { LINEUP, METRIKE, PLANS, priceLabel } from '@/lib/config';
import { autoBuild } from '@/lib/lineup';
import { optimize } from '@/lib/optimizer';
import { nadogradnja } from '@/lib/nadogradnja';
import { paypalConfigured } from '@/lib/paypal/client';
import { TIER_RANK, type Coach, type PricedPlayer, type Tier } from '@/lib/types';

export const revalidate = 60;

/**
 * Pregled optimizatora na stvarnim podacima kola.
 *
 * Polazni tim nije izmišljen: sastavljen je od igrača koje najviše
 * menadžera ima u zvaničnoj igri, uz poštovanje kvota i budžeta. Onda ga
 * optimizator popravlja pravim projekcijama. Na stranicu idu samo zbirni
 * brojevi — nijedno ime ni projekcija pojedinačnog igrača.
 */
function pregledOptimizatora(igraci: PricedPlayer[], treneri: Coach[]) {
  if (!igraci.some((p) => (p.ownership ?? 0) > 0)) return null;
  const popularni = autoBuild(
    igraci.map((p) => ({ ...p, projected: p.ownership ?? 0 })),
    treneri
  );
  const r = optimize(popularni, igraci, treneri, { maxSwaps: 4 });
  if (!(r.currentTotal > 0)) return null;
  return {
    pre: r.currentTotal,
    posle: r.optimizedTotal,
    dobitak: r.improvement,
    zamena: r.swaps.length
  };
}

/* Stvarni faktori projekcije — provereno u scripts/uvoz-cena.mjs.
   Težine se namerno ne objavljuju. */
const FAKTORI: [string, string][] = [
  [
    'Fantasy učinak',
    'Koliko fantasy poena igrač donosi po odigranom minutu, iz prošle sezone Evrolige.'
  ],
  [
    'Minutaža',
    'Očekivani minuti, prilagođeni promenama u rotaciji tima — čije minute neko preuzima.'
  ],
  [
    'Cena u zvaničnoj igri',
    'Nosi ono što istorija ne vidi, kao nove transfere i promenu uloge. Igrači bez istorije u Evroligi procenjuju se iz cene.'
  ],
  [
    'Procena meča',
    'Šansa za pobedu u konkretnoj utakmici. Utiče umereno — protivnik ne menja projekciju iz korena.'
  ],
  ['Domaći teren', 'Mala, ali stvarna prednost igranja kod kuće.'],
  ['Dostupnost', 'Igrač označen kao povređen u zvaničnoj igri dobija projekciju 0.']
];

export default async function Home() {
  const [round, teams, me] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);
  const [sviIgraci, fixtures, treneri] = round
    ? await Promise.all([getPricedPlayers(round.id), getFixtures(round.id), getCoaches(round.id)])
    : [[], [], []];

  /* Naslovna je javna — sve što ide u pregledač prolazi kroz isto pravilo
     vidljivosti kao tabela igrača. `sviIgraci` ostaje samo na serveru. */
  const players = trimForTier(sviIgraci, me.tier);
  const hero = players.find((p) => p.tier_pick === 'FREE') ?? players[0];
  const ultra = me.tier === 'ULTRA';

  /* Top 3: igrači čija je projekcija vidljiva ovom nalogu, po razlici. Ako
     ih je manje od tri, ostatak su zaključane kartice izbora iz jačeg
     paketa — one se crtaju na serveru i otkrivaju samo poziciju, tim i
     protivnika. */
  const top = players
    .filter((p) => p.projected != null)
    .sort((a, b) => (edge(b) ?? -99) - (edge(a) ?? -99))
    .slice(0, 3);
  const zakljucaniIzbori = sviIgraci
    .filter((p) => p.tier_pick && !vidiProjekciju(me.tier, p))
    .sort(
      (a, b) => TIER_RANK[a.tier_pick as Tier] - TIER_RANK[b.tier_pick as Tier]
    );
  const teaseri = zakljucaniIzbori.slice(0, Math.max(0, 3 - top.length));
  const josIzbora = zakljucaniIzbori.length - teaseri.length;

  /* Dva najneizvesnija meča — procena najbliža 50:50. */
  const neodigrani = fixtures.filter((f) => f.home_score == null);
  const mecevi = [...(neodigrani.length ? neodigrani : fixtures)]
    .sort(
      (a, b) =>
        Math.abs((a.home_edge ?? 50) - 50) - Math.abs((b.home_edge ?? 50) - 50) ||
        (a.tip_off ?? '').localeCompare(b.tip_off ?? '')
    )
    .slice(0, 2);

  const optimizator = round ? pregledOptimizatora(sviIgraci, treneri) : null;
  const najjeftiniji = Math.min(...PLANS.map((p) => p.priceCents));
  /* Doplata za nadogradnju se prikazuje i na naslovnoj — isti racun kao na /paketi. */
  const pretplate = me.userId && !ultra ? await getMySubscriptions() : [];

  return (
    <>
      {/* ================= NASLOVNA ================= */}
      <section className="relative overflow-hidden border-b border-line bg-sunken">
        <CourtBackdrop variant="arc" opacity={0.09} />
        <div className="datagrid pointer-events-none absolute inset-0 opacity-70" aria-hidden />

        <div className="page relative grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_400px] lg:items-center lg:gap-14 lg:py-20">
          <div className="max-w-2xl animate-rise">
            <p className="eyebrow">
              EuroLeague Fantasy{round ? ` · ${round.number}. kolo` : ''}
              {round?.deadline && untilLabel(round.deadline) !== 'zakljucano' && (
                <span className="text-ink-4"> · još {untilLabel(round.deadline)}</span>
              )}
            </p>

            <h1 className="mt-5 text-[clamp(40px,8vw,80px)] uppercase leading-[0.92]">
              Prestani da nagađaš.
              <span className="mt-1 block text-brand">Počni da računaš.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-2">
              Za svakog igrača poredimo cenu sa projektovanim fantasy poenima — iz učinka,
              minutaže i procene meča — i pokazujemo ko se u ovom kolu stvarno isplati.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <LinkButton href="/igraci" size="lg">
                Pogledaj izbore kola
              </LinkButton>
              <LinkButton href="/igra" variant="ghost" size="lg">
                Sastavi postavu
              </LinkButton>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ['Igrača sa cenom', String(players.length)],
                ['Mečeva u kolu', String(fixtures.length)],
                ['Timova', String(Object.keys(teams).length)]
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="label">{l}</dt>
                  <dd className="stat mt-1.5 text-[26px]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* živi izlog proizvoda — ne ukrasna slika */}
          {hero && (
            <aside
              className="group relative mx-auto w-full max-w-[420px] animate-rise lg:max-w-none"
              style={{ animationDelay: '90ms' }}
            >
              <div
                className="relative overflow-hidden rounded-md border border-line bg-surface shadow-pop
                           transition-[transform,border-color] duration-fast ease-out
                           hover:-translate-y-0.5 hover:border-line-2 motion-reduce:transform-none"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="label">Izbor kola</span>
                  <Chip tone="brand">Besplatno</Chip>
                </div>

                <div className="relative h-52 overflow-hidden bg-gradient-to-b from-elev to-surface sm:h-56">
                  <div className="absolute inset-0 transition-transform duration-slow ease-out group-hover:scale-[1.03] motion-reduce:transform-none">
                    <PlayerCutout player={hero} priority />
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent" />
                </div>

                <div className="relative px-4 pb-4 sm:px-5 sm:pb-5">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[24px] uppercase leading-none">{hero.short_name}</h2>
                      <p className="mt-1.5 text-[12px] text-ink-3">
                        {hero.position === 'G' ? 'Bek' : hero.position === 'F' ? 'Krilo' : 'Centar'} ·{' '}
                        {teamName(teams, hero.team_code)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="label">
                        <Hint text={METRIKE.razlika} align="end">
                          Razlika
                        </Hint>
                      </div>
                      <div className="stat mt-1 text-[38px] leading-none text-brand">
                        {signed(edge(hero))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-line bg-line">
                    <div className="bg-sunken px-3 py-2.5">
                      <div className="label">
                        <Hint text={METRIKE.cena} align="start">
                          Cena
                        </Hint>
                      </div>
                      <div className="statmono mt-1 text-[16px] text-ink">{num(hero.price)}</div>
                    </div>
                    <div className="bg-sunken px-3 py-2.5">
                      <div className="label">
                        <Hint text={METRIKE.projekcija}>Projekcija</Hint>
                      </div>
                      <div className="statmono mt-1 text-[16px] text-ink">{num(hero.projected)}</div>
                    </div>
                    <div className="bg-sunken px-3 py-2.5">
                      <div className="label">
                        <Hint text={METRIKE.vrednost} align="end">
                          Vrednost
                        </Hint>
                      </div>
                      <div className={`statmono mt-1 text-[16px] ${valueClass(hero.value_score)}`}>
                        {num(hero.value_score)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <MatchupPill
                      opponent={hero.opponent_code}
                      isHome={hero.is_home}
                      score={hero.matchup_score}
                      teams={teams}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* ================= TOP 3 ================= */}
      {top.length + teaseri.length > 0 && (
        <section className="page py-14 sm:py-16">
          <SectionHead
            eyebrow={round ? `${round.number}. kolo` : 'Izbori kola'}
            title="Najbolji izbori kola"
            desc="Igrači koji donose najviše poena preko svoje cene. Uz svaki stoje cena, projekcija, razlika i protivnik."
            action={
              <LinkButton href="/igraci" variant="ghost" size="sm">
                Pogledaj sve igrače
              </LinkButton>
            }
          />

          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {top.map((p, i) => (
              <PlayerCard key={p.id} p={p} teams={teams} rank={i + 1} why={false} />
            ))}
            {teaseri.map((p, i) => (
              <PlayerCard
                key={p.id}
                p={p}
                teams={teams}
                rank={top.length + i + 1}
                locked
                need={p.tier_pick as Tier}
              />
            ))}
          </div>

          {josIzbora > 0 && (
            <Link
              href="/paketi"
              className="group mt-4 flex items-center justify-between gap-4 rounded-md border border-dashed
                         border-brand/40 bg-gradient-to-r from-brand/[.08] to-transparent px-5 py-4
                         transition-colors duration-fast hover:border-brand/70"
            >
              <span>
                <span className="block font-display text-[16px] font-extrabold uppercase tracking-tight">
                  Još {josIzbora} premium preporuka ovog kola
                </span>
                <span className="mt-0.5 block text-[12.5px] text-ink-3">
                  Po igrač iz svakog cenovnog ranga i po tri na svakoj poziciji.
                </span>
              </span>
              <span className="shrink-0 font-semibold text-brand transition-transform duration-fast group-hover:translate-x-0.5">
                Pogledaj pakete →
              </span>
            </Link>
          )}
        </section>
      )}

      {/* ================= MEČEVI ================= */}
      {mecevi.length > 0 && (
        <section className="border-y border-line bg-sunken">
          <div className="page py-14 sm:py-16">
            <SectionHead
              eyebrow="Raspored"
              title="Najneizvesniji mečevi"
              desc="Utakmice u kojima je naša procena najbliža 50:50 — tu se najčešće odlučuje izazov kola."
              action={
                <LinkButton href="/raspored" variant="ghost" size="sm">
                  Sve utakmice
                </LinkButton>
              }
            />
            <div className="mt-7 overflow-hidden rounded-md border border-line bg-surface">
              {mecevi.map((f) => (
                <FixtureRow
                  key={f.id}
                  f={f}
                  teams={teams}
                  topPlayers={players
                    .filter(
                      (p) =>
                        p.projected != null &&
                        (p.team_code === f.home_code || p.team_code === f.away_code)
                    )
                    .sort((a, b) => (b.projected ?? 0) - (a.projected ?? 0))}
                />
              ))}
            </div>

            {/* izazov kola — nagrade stoje uz mečeve na koje se glasa */}
            <div className="mt-6 rounded-md border border-line bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-xl">
                  <p className="eyebrow">Izazov kola · besplatno</p>
                  <h3 className="mt-3 text-[clamp(20px,3vw,26px)] uppercase leading-tight">
                    Pogodi kolo, osvoji paket
                  </h3>
                  <p className="mt-2 text-small text-ink-3">
                    Tipuj pobednike mečeva i da li igrači prelaze svoju cenu. Bez uloga i bez
                    plaćanja.
                  </p>
                </div>
                <LinkButton href="/raspored" size="sm">
                  Uđi u izazov
                </LinkButton>
              </div>
              <div className="mt-5">
                <IzazovNagrade />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= OPTIMIZATOR ================= */}
      <section className="page py-14 sm:py-16">
        <SectionHead
          eyebrow="Ultra alat"
          title="Optimizator postave"
          desc={`Ubaci svoju postavu, a alat pronalazi do 4 zamene koje donose najviše poena u okviru ${LINEUP.budget} kredita — uz razlog za svaku.`}
        />

        <div className="mt-7 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-stretch">
          <div className="relative overflow-hidden rounded-md border border-line bg-gradient-to-b from-surface to-sunken">
            <CourtBackdrop variant="arc" opacity={0.08} />
            {optimizator ? (
              <>
                <div className="relative grid gap-6 p-6 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center sm:p-8">
                  <div>
                    <div className="label">Najpopularniji tim</div>
                    <div className="stat mt-2 text-[clamp(34px,6vw,52px)] leading-none text-ink-3">
                      {num(optimizator.pre)}
                    </div>
                  </div>
                  <div className="hidden text-[22px] text-brand sm:block" aria-hidden>
                    →
                  </div>
                  <div>
                    <div className="label">
                      Posle {optimizator.zamena}{' '}
                      {optimizator.zamena >= 1 && optimizator.zamena <= 4 ? 'zamene' : 'zamena'}
                    </div>
                    <div className="stat mt-2 text-[clamp(34px,6vw,52px)] leading-none text-brand">
                      {num(optimizator.posle)}
                    </div>
                  </div>
                  <div className="sm:border-l sm:border-line sm:pl-6">
                    <div className="label">Dobitak</div>
                    <div className="stat mt-2 text-[clamp(26px,4vw,36px)] leading-none text-brand">
                      {signed(optimizator.dobitak)}
                      <span className="ml-1 font-mono text-[11px] font-medium text-ink-3">FP</span>
                    </div>
                  </div>
                </div>
                <p className="relative border-t border-line px-6 py-4 text-[12.5px] leading-relaxed text-ink-3 sm:px-8">
                  Stvarni brojevi ovog kola: tim od igrača koje najviše menadžera ima u zvaničnoj
                  igri, u okviru {LINEUP.budget} kredita, pa isti tim posle optimizatora. Tvoj
                  rezultat zavisi od tvoje postave.
                </p>
              </>
            ) : (
              <div className="relative p-6 sm:p-8">
                <p className="text-body text-ink-2">
                  Pregled se računa čim budu unete cene i vlasništvo za tekuće kolo.
                </p>
              </div>
            )}
          </div>

          <div className="panel flex flex-col p-5">
            <h3 className="text-[17px] uppercase">Šta dobijaš</h3>
            <ul className="mt-4 flex-1 space-y-3">
              {[
                'Zamene poređane po dobitku poena',
                'Razlog za svaku zamenu, ne samo rezultat',
                'Poštovanje budžeta i pravila sastava',
                'Računanje na serveru — brojevi se ne mogu podesiti'
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-small text-ink-2">
                  <span className="mt-[7px] h-[3px] w-3 shrink-0 bg-brand" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <LinkButton href="/optimizator" className="mt-6" full>
              Otvori optimizator
            </LinkButton>
            {!ultra && (
              <p className="mt-3 text-center text-[11.5px] text-ink-4">
                Pojedinačne zamene su deo Ultra paketa
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ================= KAKO RAČUNAMO ================= */}
      <section className="border-y border-line bg-sunken">
        <div className="page grid gap-10 py-14 sm:py-16 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div>
            <SectionHead
              eyebrow="Metodologija"
              title="Kako računamo projekcije?"
              desc="Projekcija je procena iz stvarnih podataka, ne garancija. Faktore objavljujemo, tačne težine ne."
            />
            {round && (
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
                {round.number}. kolo · {players.length} igrača sa cenom · {fixtures.length}{' '}
                {fixtures.length === 1 ? 'meč' : 'mečeva'}
              </p>
            )}
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
              Forma iz tekuće sezone još ne ulazi u projekciju.
            </p>
          </div>

          <ul className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
            {FAKTORI.map(([naslov, opis], i) => (
              <li key={naslov} className="bg-surface p-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] font-bold tabular-nums text-brand">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-[15px] uppercase leading-tight">{naslov}</h3>
                </div>
                <p className="mt-2 text-small leading-relaxed text-ink-3">{opis}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= PAKETI ================= */}
      {!ultra && (
        <section className="page py-14 sm:py-16">
          <SectionHead
            eyebrow="Paketi"
            title="Izaberi paket"
            desc={`Jedna uplata, 30 dana pristupa, bez automatske obnove. Paketi od ${priceLabel(najjeftiniji)}.`}
            action={
              <LinkButton href="/paketi" variant="ghost" size="sm">
                Uporedi pakete
              </LinkButton>
            }
          />
          <div className="mt-7">
            <PricingTable
              tier={me.tier}
              loggedIn={!!me.userId}
              paypalReady={paypalConfigured()}
              nadogradnje={Object.fromEntries(
                PLANS.map((p) => [p.code, nadogradnja(pretplate, p.code) ?? undefined])
              )}
            />
          </div>
        </section>
      )}

      {/* ================= DALJE ================= */}
      {round && (
        <section className="page py-14 sm:py-16">
          <div className="relative overflow-hidden rounded-md border border-line bg-surface">
            <div className="hatch pointer-events-none absolute inset-0 opacity-40" aria-hidden />
            <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
              <div className="max-w-xl">
                <h2 className="text-[clamp(24px,4vw,34px)] uppercase leading-tight">
                  Kreni od kola koje je pred tobom
                </h2>
                <p className="mt-3 text-body leading-relaxed text-ink-2">
                  Svi igrači sa cenom, ceo raspored sa procenama i optimizator za tvoju postavu.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row md:flex-col">
                <LinkButton href="/igraci">Pogledaj sve igrače</LinkButton>
                <LinkButton href="/raspored" variant="ghost">
                  Sve utakmice
                </LinkButton>
                <LinkButton href="/optimizator" variant="ghost">
                  Otvori optimizator
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      )}

      {!round && (
        <section className="page py-20">
          <p className="panel p-10 text-center text-ink-3">
            Nema unetih kola. Dodaj kolo u Supabase, tabela{' '}
            <code className="font-mono text-ink">rounds</code>.
          </p>
        </section>
      )}
    </>
  );
}
