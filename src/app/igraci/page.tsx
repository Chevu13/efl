import { getCurrentRound, getPricedPlayers, getTeams, getMyTier } from '@/lib/data';
import PlayerCard from '@/components/PlayerCard';
import TierGate from '@/components/TierGate';
import { TIER_RANK, type Tier } from '@/lib/types';

export const revalidate = 60;

const LIMIT: Record<Tier, number> = { FREE: 1, PLUS: 3, PRO: 999, ULTRA: 999 };

export default async function Igraci() {
  const [round, teams, { tier }] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);
  const players = round ? await getPricedPlayers(round.id) : [];

  const vidljivi = players.slice(0, LIMIT[tier]);
  const ostalo = players.length - vidljivi.length;
  const sledeci: Tier = TIER_RANK[tier] < 1 ? 'PLUS' : 'PRO';

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Izbori kola</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Igrači koji vrede svoju cenu
          </h1>
        </div>
        <span className="chip bg-brand/15 text-brand">{tier}</span>
      </div>

      <p className="mt-4 text-[13px] text-muted">
        Prikazano <b className="font-mono text-ink">{vidljivi.length}</b> od {players.length} · sortirano po vrednosti
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vidljivi.map((p) => <PlayerCard key={p.id} p={p} teams={teams} />)}
      </div>

      {ostalo > 0 && <TierGate need={sledeci} count={ostalo} />}

      {!players.length && (
        <p className="card mt-8 p-10 text-center text-muted">
          Za ovo kolo još nisu unete cene. Dodaj ih u tabelu <code className="font-mono">player_rounds</code>.
        </p>
      )}
    </>
  );
}
