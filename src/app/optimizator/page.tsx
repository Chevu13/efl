import type { Metadata } from 'next';
import OptimizerView from '@/components/optimizer/OptimizerView';
import { SectionHead, EmptyState, Chip } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { getCurrentRound, getMyTier, getTeams } from '@/lib/data';
import { OPTIMIZER_LIMIT } from '@/lib/config';
import { isPremium } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/optimizator' },
  title: 'Optimizator postave',
  description:
    'Zamene koje donose vise projektovanih poena u okviru istog budzeta — sa obrazlozenjem za svaku.'
};

/**
 * Optimizator.
 *
 * Stranica sama ne racuna nista: postava zivi u pregledacu, a racun i
 * odsecanje po paketu rade se na serveru, u /api/optimizator. Zato se
 * ovde salju samo kolo, timovi i paket.
 */
export default async function Optimizator() {
  const [round, teams, me] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);
  const premium = isPremium(me.tier);
  const visible = OPTIMIZER_LIMIT[me.tier];

  if (!round) {
    return (
      <div className="page py-10">
        <SectionHead as="h1" eyebrow="Premium alat" title="Optimizator postave" />
        <div className="mt-8">
          <EmptyState
            title="Nema aktivnog kola"
            desc="Optimizator racuna nad cenama tekuceg kola. Dodaj kolo i cene, pa se vrati."
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
        eyebrow={`${round.number}. kolo · optimizacija`}
        title="Optimizator postave"
        desc="Alat trazi zamene koje donose vise bodova bez izlaska iz budzeta i pravila sastava. Racuna mesto u postavi — petorka, kapiten, klupa — i uz svaku zamenu daje razlog."
        action={
          <div className="flex items-center gap-2">
            <Chip tone={premium ? 'brand' : 'default'}>{me.tier}</Chip>
            <Chip>
              {visible >= 99 ? 'Sve zamene' : `${visible} ${visible === 1 ? 'zamena' : 'zamene'}`}
            </Chip>
          </div>
        }
      />

      <div className="mt-8">
        <OptimizerView roundId={round.id} teams={teams} tier={me.tier} />
      </div>
    </div>
  );
}
