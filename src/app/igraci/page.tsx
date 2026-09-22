import type { Metadata } from 'next';
import Link from 'next/link';
import PlayerCard from '@/components/PlayerCard';
import PlayerTable from '@/components/player/PlayerTable';
import PlayerIdentity from '@/components/player/PlayerIdentity';
import { SectionHead, EmptyState, Chip, Hint, RowDivider } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { getCurrentRound, getMyTier, getPricedPlayers, getTeams, trimForTier } from '@/lib/data';
import {
  IZBEGNI,
  LINEUP,
  METRIKE,
  NEXT_TIER,
  POSITION_PLURAL,
  PRICE_BANDS,
  planByCode,
  priceLabel
} from '@/lib/config';
import { edge, num, signed, untilLabel } from '@/lib/format';
import { TIER_RANK, isPremium, jePro, type PricedPlayer, type Team } from '@/lib/types';

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: '/igraci' },
  title: 'Izbori kola',
  description:
    'Igrači koji vrede svoju cenu u tekućem kolu EuroLeague Fantasy takmičenja — i oni koje treba izbegavati.'
};

/**
 * Izbori kola.
 *
 *   besplatno  1 izbor kola
 *   Plus       za svaku poziciju i svaki cenovni rang po 2 izbora (18)
 *              i po 1 igrač koga treba izbegavati (9)
 *   Pro        top 5 izbora kola i kapiten — ne dele se ni sa Plus paketom
 *
 * Odsecanje po paketu radi se ovde, na serveru: podaci koje korisnik nije
 * platio ne odlaze u pregledač uopšte. Zaključani delovi su paneli bez
 * imena i brojeva.
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
  const pro = jePro(tier);
  const plusOtvoren = TIER_RANK[tier] >= TIER_RANK.PLUS;

  /* Sve što ide u pregledač prolazi kroz trimForTier — projekcije za igrače
     van tvojih izbora ne napuštaju server. */
  const vidljivi = trimForTier(players, tier);
  const poId = new Map(vidljivi.map((p) => [p.id, p]));
  const red = (p: PricedPlayer) => poId.get(p.id) ?? p;

  const freePicks = players.filter((p) => p.tier_pick === 'FREE');
  const plusRedovi = players.filter((p) => p.tier_pick === 'PLUS');
  const proTop = players
    .filter((p) => p.tier_pick === 'PRO')
    .sort((a, b) => (edge(b) ?? -99) - (edge(a) ?? -99));

  /* Kapiten kola — najveća projekcija u kolu, računa se samo za Pro. */
  const kapiten = pro
    ? [...vidljivi]
        .filter((p) => p.status === 'ok' || p.status == null)
        .sort((a, b) => (b.projected ?? 0) - (a.projected ?? 0))[0]
    : null;

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
        desc="Izbori su poređani po razlici između projekcije i cene. Uz izbore stoje i igrači koje za cenu koju traže treba izbegavati."
        action={
          <div className="flex items-center gap-2">
            {round?.deadline && <Chip>Još {untilLabel(round.deadline)}</Chip>}
            <Chip tone={premium ? 'brand' : 'default'}>{tier}</Chip>
          </div>
        }
      />

      {/* ---------------- besplatni izbori ---------------- */}
      {freePicks.length > 0 && (
        <div className="mt-8">
          <SectionHead
            eyebrow="Besplatno"
            title="Petorka kola"
            desc="Dva beka, dva krila i centar koje svaki nalog vidi, plus izbor sa naslovne strane. Najbolji izbori kola nisu ovde — oni idu u Pro paket."
          />
        </div>
      )}
      {freePicks.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {freePicks.map((p) => (
            <PlayerCard key={p.id} p={red(p)} teams={teams} rank={1} />
          ))}
        </div>
      )}

      {/* ---------------- Pro: top 5 i kapiten ---------------- */}
      {proTop.length > 0 && (
        <section className="mt-14">
          <SectionHead
            eyebrow="Pro"
            title="Top izbori kola"
            desc="Pet igrača sa najvećom razlikom u celom kolu i kapiten kola. Ovi izbori se ne dele ni sa Plus paketom."
            action={<Chip tone={pro ? 'brand' : 'default'}>PRO</Chip>}
          />
          {pro ? (
            <>
              {kapiten && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-md border border-brand/45 bg-gradient-to-r from-brand/[.12] to-transparent px-5 py-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand font-display text-[18px] font-extrabold text-black">
                      C
                    </span>
                    <div className="min-w-0">
                      <p className="label">Kapiten kola</p>
                      <PlayerIdentity player={kapiten} teams={teams} size="sm" />
                    </div>
                  </div>
                  <div className="flex gap-6 text-right">
                    <div>
                      <div className="label">Projekcija</div>
                      <div className="statmono mt-1 text-[17px]">{num(kapiten.projected)}</div>
                    </div>
                    <div>
                      <div className="label">Kao kapiten ×{LINEUP.captainMultiplier}</div>
                      <div className="stat mt-1 text-[24px] leading-none text-brand">
                        {num((kapiten.projected ?? 0) * LINEUP.captainMultiplier)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {proTop.map((p, i) => (
                  <PlayerCard key={p.id} p={red(p)} teams={teams} rank={i + 1} why={false} />
                ))}
              </div>
            </>
          ) : (
            <ZakljucanPanel
              paket="PRO"
              naslov={`Top ${proTop.length} izbora kola i kapiten`}
              opis="Najbolji izbori kola, cela baza projekcija za svakog igrača i optimizator koji sam predlaže 4 najbolje izmene."
              mesta={[`Top ${proTop.length} kola`, 'Kapiten kola', 'Cela baza projekcija', 'Optimizator']}
            />
          )}
        </section>
      )}

      {/* ---------------- Plus: po pozicijama i rangovima ---------------- */}
      {plusRedovi.length > 0 && (
        <section className="mt-14">
          <SectionHead
            eyebrow="Plus"
            title="Izbori po poziciji i ceni"
            desc="Za bekove, krila i centre po 2 izbora u svakom cenovnom rangu — i po jedan igrač koga za tu cenu treba izbegavati."
            action={<Chip tone={plusOtvoren ? 'brand' : 'default'}>PLUS</Chip>}
          />

          {plusOtvoren ? (
            (['G', 'F', 'C'] as const).map((poz) => (
              <div key={poz} className="mt-8">
                <RowDivider title={POSITION_PLURAL[poz]} />
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {PRICE_BANDS.map((b) => {
                    const grupa = `${poz}-${b.key}`;
                    const izbori = plusRedovi
                      .filter((p) => p.pick_group === grupa)
                      .sort((x, y) => (edge(y) ?? -99) - (edge(x) ?? -99));
                    const izbegni = plusRedovi.find((p) => p.pick_group === `${grupa}${IZBEGNI}`);
                    return (
                      <div key={b.key} className="panel flex flex-col overflow-hidden">
                        <div className="flex items-baseline justify-between gap-3 border-b border-line bg-sunken px-4 py-2.5">
                          <span className="font-display text-[15px] font-extrabold uppercase tracking-tight">
                            {b.label}
                          </span>
                          <span className="label">{b.desc}</span>
                        </div>
                        <ul className="divide-y divide-line">
                          {izbori.map((p) => (
                            <IzborRed key={p.id} p={red(p)} teams={teams} />
                          ))}
                          {izbori.length === 0 && (
                            <li className="px-4 py-3 text-small text-ink-4">Nema izbora u ovom rangu.</li>
                          )}
                        </ul>
                        {izbegni && (
                          <div className="mt-auto border-t border-neg/30 bg-neg/[.06]">
                            <p className="px-4 pt-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-neg">
                              Izbegni za ovu cenu
                            </p>
                            <ul>
                              <IzborRed p={red(izbegni)} teams={teams} izbegni />
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <ZakljucanPanel
              paket="PLUS"
              naslov={`${plusRedovi.filter((p) => !String(p.pick_group).endsWith(IZBEGNI)).length} izbora i ${
                plusRedovi.filter((p) => String(p.pick_group).endsWith(IZBEGNI)).length
              } igrača za izbegavanje`}
              opis="Po 2 izbora za bekove, krila i centre u svakom cenovnom rangu — skup, srednji i jeftin — i po jedan igrač koga za tu cenu treba izbegavati."
              mesta={['Bekovi', 'Krila', 'Centri', ...PRICE_BANDS.map((b) => b.label)]}
            />
          )}
        </section>
      )}

      {/* ---------------- cela tabela kola ---------------- */}
      <div className="mt-14">
        <SectionHead
          eyebrow="Cela lista kola"
          title="Svi igrači sa cenom"
          desc="Sortiraj po razlici, vrednosti, projekciji ili protivniku i pronađi sopstvene zaključke."
        />
        {pro ? (
          <div className="mt-6">
            <PlayerTable
              players={vidljivi}
              totalCount={players.length}
              teams={teams}
              tier={tier}
              need={need}
            />
          </div>
        ) : (
          <ZakljucanPanel
            paket="PRO"
            naslov={`Svih ${players.length} igrača sa projekcijom`}
            opis="Cela lista kola — cena, protivnik, projekcija, razlika i vrednost za svakog igrača u ligi — deo je Pro paketa."
            mesta={['Projekcija', 'Razlika', 'Vrednost', 'Vlasništvo', 'Sortiranje']}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Kompaktan red izbora: igrač levo, cena · projekcija · razlika desno. */
function IzborRed({
  p,
  teams,
  izbegni = false
}: {
  p: PricedPlayer;
  teams: Record<string, Team>;
  izbegni?: boolean;
}) {
  const r = edge(p);
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <PlayerIdentity player={p} teams={teams} size="sm" />
      <div className="grid shrink-0 grid-cols-3 gap-3 text-right">
        <div>
          <div className="label">Cena</div>
          <div className="statmono mt-0.5 text-[13px] text-ink-2">{num(p.price)}</div>
        </div>
        <div>
          <div className="label">Proj.</div>
          <div className="statmono mt-0.5 text-[13px] text-ink">{num(p.projected)}</div>
        </div>
        <div>
          <div className="label">
            <Hint text={METRIKE.razlika} align="end">
              Razl.
            </Hint>
          </div>
          <div
            className={`statmono mt-0.5 text-[14px] font-bold ${
              izbegni ? 'text-neg' : (r ?? 0) > 0 ? 'text-brand' : 'text-ink-2'
            }`}
          >
            {signed(r)}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Zaključan deo — jedan panel umesto niza kartica sa katancem. Bez imena i
 * brojeva; kaže samo šta paket sadrži.
 */
function ZakljucanPanel({
  paket,
  naslov,
  opis,
  mesta
}: {
  paket: 'PLUS' | 'PRO';
  naslov: string;
  opis: string;
  mesta: string[];
}) {
  const plan = planByCode(paket);

  return (
    <Link
      href="/paketi"
      className="group relative mt-6 flex flex-col justify-between overflow-hidden rounded-md border border-dashed
                 border-brand/40 bg-gradient-to-br from-brand/[.10] via-surface to-surface p-6
                 transition-colors duration-fast hover:border-brand/70 sm:p-8"
    >
      <div className="hatch pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <div className="relative">
        <span className="chip-brand">
          <LockIcon />
          {paket}
        </span>
        <h3 className="mt-4 text-[clamp(22px,3vw,30px)] uppercase leading-tight">{naslov}</h3>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-ink-2">{opis}</p>

        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Šta paket sadrži">
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
