import { getCurrentRound, getChallengeLines, getFixtures, getTeams, getLeaderboard, getMyTier } from '@/lib/data';
import GameBoard from '@/components/GameBoard';

export const revalidate = 30;

export default async function Igra() {
  const [round, teams, { userId }] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);
  const [lines, fixtures, board] = round
    ? await Promise.all([getChallengeLines(round.id), getFixtures(round.id), getLeaderboard()])
    : [[], [], []];

  if (!round) {
    return <p className="card p-10 text-center text-muted">Nema aktivnog kola.</p>;
  }

  return (
    <GameBoard
      round={round}
      lines={lines}
      fixtures={fixtures}
      teams={teams}
      board={board as any}
      prijavljen={!!userId}
    />
  );
}
