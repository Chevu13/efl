import Link from 'next/link';
import {
  getCurrentRound, getChallengeLines, getFixtures, getTeams,
  getLeaderboard, getMyTier, getPricedPlayers
} from '@/lib/data';
import GameBoard from '@/components/GameBoard';
import PlayerCard from '@/components/PlayerCard';
import Paketi from '@/components/Paketi';

export const revalidate = 30;

export default async function Igra() {
  const [round, teams, { userId, tier }] = await Promise.all([
    getCurrentRound(), getTeams(), getMyTier()
  ]);

  if (!round) return <p className="card p-10 text-center text-muted">Nema aktivnog kola.</p>;

  const [lines, fixtures, board, players] = await Promise.all([
    getChallengeLines(round.id),
    getFixtures(round.id),
    getLeaderboard(),
    getPricedPlayers(round.id)
  ]);

  const izbor = players.find((p) => p.tier_pick === 'FREE') ?? players[0];

  return (
    <>
      <GameBoard
        round={round}
        lines={lines}
        fixtures={fixtures}
        teams={teams}
        board={board as any}
        prijavljen={!!userId}
      />

      {izbor && (
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Besplatno · svako kolo</p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
                Igrač kola
              </h2>
            </div>
            <Link href="/igraci" className="btn-ghost">Vidi sve izbore</Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[360px_1fr] md:items-start">
            <PlayerCard p={izbor} teams={teams} why={false} />
            <div className="card p-5">
              <h3 className="font-display text-lg font-bold">Zašto baš on</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
                {izbor.why_sr ?? 'Objašnjenje još nije upisano za ovo kolo.'}
              </p>
              {players.length > 1 && (
                <p className="mt-5 border-t border-line pt-4 text-[13.5px] text-muted">
                  Ovo je jedan od <b className="font-mono text-ink">{players.length}</b> igrača
                  koje smo analizirali za ovo kolo. Ostali su u paketima ispod.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      <Paketi trenutni={tier} userId={userId} />
    </>
  );
}
