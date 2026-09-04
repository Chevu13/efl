import type { Metadata } from 'next';
import PlayerCard from '@/components/PlayerCard';
import PlayerTable from '@/components/player/PlayerTable';
import TierGate from '@/components/TierGate';
import { SectionHead, EmptyState, Chip, RowDivider } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { getCurrentRound, getMyTier, getPricedPlayers, getTeams } from '@/lib/data';
import { NEXT_TIER, POSITION_PLURAL, PRICE_BANDS, bandLabel } from '@/lib/config';
import { untilLabel } from '@/lib/format';
import { TIER_RANK, isPremium } from '@/lib/types';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Izbori kola',
  description:
    'Igraci koji vrede svoju cenu u tekucem kolu EuroLeague Fantasy takmicenja, sa projekcijom i obrazlozenjem.'
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
  const plusPicks = players.filter((p) => p.tier_pick === 'PLUS');
  const proPicks = players.filter((p) => p.tier_pick === 'PRO');
  const hiddenPicks =
    (otvoren('PLUS') ? 0 : plusPicks.length) + (otvoren('PRO') ? 0 : proPicks.length);

  /* Tabela: bez paketa se salje samo pocetak liste. Ostatak ne napusta
     server, pa nema sta da se otkljuca u pregledacu. */
  const tableRows = premium ? players : players.slice(0, 12);

  if (!players.length) {
    return (
      <div className="page py-10">
        <SectionHead
          as="h1"
          eyebrow="Izbori kola"
          title="Igraci koji vrede svoju cenu"
        />
        <div className="mt-8">
          <EmptyState
            title="Cene za ovo kolo jos nisu unete"
            desc="Dodaj redove u tabelu player_rounds za tekuce kolo — cena, projekcija i ocena vrednosti."
            action={
              <LinkButton href="/baza" variant="ghost">
                Otvori bazu igraca
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
        title="Igraci koji vrede svoju cenu"
        desc="Poredak je po odnosu projekcije i cene. Uz svaki izbor stoji razlog, protivnik i forma — da mozes da proveris zakljucak, a ne samo da ga prihvatis."
        action={
          <div className="flex items-center gap-2">
            {round?.deadline && <Chip>Jos {untilLabel(round.deadline)}</Chip>}
            <Chip tone={premium ? 'brand' : 'default'}>{tier}</Chip>
          </div>
        }
      />

      {/* ---------------- besplatan izbor ---------------- */}
      {freePicks.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {freePicks.map((p) => (
            <PlayerCard key={p.id} p={p} teams={teams} rank={1} />
          ))}
        </div>
      )}

      {/* ---------------- Plus: po jedan iz svakog ranga ---------------- */}
      {plusPicks.length > 0 && (
        <section className="mt-14">
          <SectionHead
            eyebrow="Plus"
            title="Po jedan iz svakog cenovnog ranga"
            desc="Skup, srednji i jeftin izbor — da postava ne stoji na jednoj polovini budzeta."
            action={<Chip tone={otvoren('PLUS') ? 'brand' : 'default'}>PLUS</Chip>}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PRICE_BANDS.map((b) => {
              const p = plusPicks.find((x) => x.pick_group === b.key);
              if (!p) return null;
              return (
                <div key={b.key}>
                  <p className="label mb-2">
                    {b.label} <span className="text-ink-4">· {b.desc}</span>
                  </p>
                  <PlayerCard p={p} teams={teams} locked={!otvoren('PLUS')} need="PLUS" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------- Pro: po tri na svakoj poziciji ---------------- */}
      {proPicks.length > 0 && (
        <section className="mt-14">
          <SectionHead
            eyebrow="Pro"
            title="Po tri izbora na svakoj poziciji"
            desc="Za svaku poziciju jedan skup, jedan srednji i jedan jeftin — cela postava se moze sastaviti odavde."
            action={<Chip tone={otvoren('PRO') ? 'brand' : 'default'}>PRO</Chip>}
          />
          {(['G', 'F', 'C'] as const).map((poz) => {
            const red = PRICE_BANDS.map((b) =>
              proPicks.find((x) => x.pick_group === `${poz}-${b.key}`)
            ).filter((x): x is (typeof proPicks)[number] => !!x);
            if (!red.length) return null;
            return (
              <div key={poz} className="mt-8">
                <RowDivider title={POSITION_PLURAL[poz]} meta={String(red.length)} />
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {red.map((p) => (
                    <div key={p.id}>
                      <p className="label mb-2">
                        {bandLabel(String(p.pick_group).split('-')[1])}
                      </p>
                      <PlayerCard p={p} teams={teams} locked={!otvoren('PRO')} need="PRO" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {hiddenPicks > 0 && (
        <TierGate
          need={need}
          count={hiddenPicks}
          className="mt-8"
          title={`Jos ${hiddenPicks} izbora sa punim obrazlozenjem`}
        />
      )}

      {/* ---------------- cela tabela kola ---------------- */}
      <div className="mt-14">
        <SectionHead
          eyebrow="Cela lista kola"
          title="Svi igraci sa cenom"
          desc="Sortiraj po vrednosti, projekciji ili protivniku i pronadji sopstvene zakljucke."
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
