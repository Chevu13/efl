import TeamCrest from '../TeamCrest';
import { matchupClass, matchupWord, num, teamName } from '@/lib/format';
import type { Team } from '@/lib/types';

/**
 * Protivnik za ovo kolo + ocena tezine meca.
 *
 * Znacenje nose slovo (D/G — domaci/gost) i rec (Lak / Neutralan / Tezak),
 * boja je samo pojacanje. Bez toga bi podatak nestao za daltoniste
 * i u stampi.
 */
export default function MatchupPill({
  opponent,
  isHome,
  score,
  teams,
  size = 'md',
  showWord = true
}: {
  opponent: string | null;
  isHome: boolean | null;
  score: number | null;
  teams: Record<string, Team>;
  size?: 'sm' | 'md';
  showWord?: boolean;
}) {
  if (!opponent) return <span className="text-ink-3">—</span>;

  const venue = isHome ? 'D' : 'G';
  const venueLabel = isHome ? 'domaci teren' : 'gostovanje';

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-xs border border-line-2
                   bg-sunken font-mono text-[10px] font-bold text-ink-3"
        title={venueLabel}
      >
        {venue}
      </span>
      <TeamCrest team={teams[opponent]} code={opponent} s="xs" />
      {size === 'md' && (
        <span className="truncate text-[12.5px] text-ink-2">{teamName(teams, opponent)}</span>
      )}
      <span className={`font-mono text-[11.5px] font-bold tabular-nums ${matchupClass(score)}`}>
        {num(score)}
        {showWord && (
          <span className="ml-1.5 font-medium uppercase tracking-wide">{matchupWord(score)}</span>
        )}
      </span>
    </span>
  );
}
