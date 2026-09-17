import type { Metadata } from 'next';
import LineupBuilder from '@/components/team/LineupBuilder';
import { SectionHead, EmptyState, Chip } from '@/components/ui/primitives';
import {
  getCoaches,
  getCurrentRound,
  getMyTier,
  getPricedPlayers,
  getTeams,
  trimForTier
} from '@/lib/data';
import { untilLabel } from '@/lib/format';
import { LINEUP } from '@/lib/config';
import { jePro } from '@/lib/types';

export const revalidate = 30;

export const metadata: Metadata = {
  alternates: { canonical: '/igra' },
  title: 'Moj tim',
  description:
    'Sastavi fantasy postavu po zvanicnim pravilima: 4 beka, 4 krila, 2 centra i trener u okviru 100 kredita.'
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

  const [pool, coaches] = await Promise.all([
    getPricedPlayers(round.id),
    getCoaches(round.id)
  ]);

  return (
    <div className="page py-10">
      <SectionHead
        as="h1"
        eyebrow={`${round.season} · ${round.number}. kolo`}
        title="Moj tim"
        desc={`Kadar od ${LINEUP.squad.G} beka, ${LINEUP.squad.F} krila i ${LINEUP.squad.C} centra, plus trener — sve u okviru ${LINEUP.budget} kredita. Petorka izlazi po izabranoj formaciji, kapiten nosi ${LINEUP.captainMultiplier}× poena.`}
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
        <LineupBuilder
          roundId={round.id}
          pool={trimForTier(pool, me.tier)}
          coaches={coaches}
          teams={teams}
          canOptimize={jePro(me.tier)}
        />
      </div>
    </div>
  );
}
