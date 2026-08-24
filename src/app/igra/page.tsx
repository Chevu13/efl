import type { Metadata } from 'next';
import GameBoard from '@/components/GameBoard';
import { SectionHead, EmptyState, Chip } from '@/components/ui/primitives';
import {
  getChallengeLines,
  getCurrentRound,
  getFixtures,
  getLeaderboard,
  getMyTier,
  getPricedPlayers,
  getTeams,
  trimForTier
} from '@/lib/data';
import { untilLabel } from '@/lib/format';
import { LINEUP } from '@/lib/config';
import { TIER_RANK } from '@/lib/types';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Moj tim',
  description:
    'Sastavi fantasy postavu u okviru budzeta i odigraj izazov kola — projekcije, ogranicenja i sezonska lista.'
};

export default async function Igra() {
  const [round, teams, me] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);

  if (!round) {
    return (
      <div className="page py-10">
        <SectionHead as="h1" eyebrow="Kolo" title="Moj tim" />
        <div className="mt-8">
          <EmptyState
            title="Nema aktivnog kola"
            desc="Dodaj kolo u tabelu rounds i postavi mu status na open."
          />
        </div>
      </div>
    );
  }

  const [lines, fixtures, board, pool] = await Promise.all([
    getChallengeLines(round.id),
    getFixtures(round.id),
    getLeaderboard(),
    getPricedPlayers(round.id)
  ]);

  return (
    <div className="page py-10">
      <SectionHead
        as="h1"
        eyebrow={`${round.season} · ${round.number}. kolo`}
        title="Moj tim"
        desc={`Postava od ${LINEUP.size} igraca u okviru ${LINEUP.budget} kredita, najvise ${LINEUP.maxPerTeam} iz istog tima. Sve se racuna dok biras — ne posle.`}
        action={
          <div className="flex items-center gap-2">
            {round.deadline && <Chip>Jos {untilLabel(round.deadline)}</Chip>}
            <Chip tone={round.status === 'open' ? 'brand' : 'default'}>
              {round.status === 'open' ? 'Otvoreno' : 'Zakljucano'}
            </Chip>
          </div>
        }
      />

      <div className="mt-8">
        <GameBoard
          round={round}
          lines={lines}
          fixtures={fixtures}
          teams={teams}
          board={board}
          pool={trimForTier(pool, me.tier)}
          loggedIn={!!me.userId}
          canOptimize={TIER_RANK[me.tier] >= TIER_RANK.PRO}
        />
      </div>
    </div>
  );
}
