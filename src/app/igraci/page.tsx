import type { Metadata } from 'next';
import PlayerCard from '@/components/PlayerCard';
import PlayerTable from '@/components/player/PlayerTable';
import TierGate from '@/components/TierGate';
import { SectionHead, EmptyState, Chip } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { getCurrentRound, getMyTier, getPricedPlayers, getTeams } from '@/lib/data';
import { NEXT_TIER, PICK_LIMIT } from '@/lib/config';
import { untilLabel } from '@/lib/format';
import { isPremium } from '@/lib/types';

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

  const limit = PICK_LIMIT[tier];
  const picks = players.slice(0, Math.min(limit, 6));
  const hiddenPicks = Math.max(0, Math.min(6, players.length) - picks.length);
  const need = NEXT_TIER[tier];
  const premium = isPremium(tier);

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

      {/* ---------------- detaljni izbori ---------------- */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {picks.map((p, i) => (
          <PlayerCard key={p.id} p={p} teams={teams} rank={i + 1} />
        ))}

        {/* Zakljucani izbori stoje na svom mestu u poretku, ne sklonjeni u stranu. */}
        {Array.from({ length: Math.min(hiddenPicks, 3) }).map((_, i) => (
          <PlayerCard
            key={`lock-${i}`}
            p={players[picks.length + i]}
            teams={teams}
            rank={picks.length + i + 1}
            locked
            need={need}
          />
        ))}
      </div>

      {hiddenPicks > 0 && (
        <TierGate
          need={need}
          count={players.length - picks.length}
          className="mt-6"
          title={`Jos ${players.length - picks.length} igraca sa punom analizom`}
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
