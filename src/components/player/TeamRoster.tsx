import Avatar from './Avatar';
import TeamCrest from '../TeamCrest';
import { PositionTag } from '../ui/primitives';
import { POSITION_PLURAL } from '@/lib/config';
import type { Player, Position, Team } from '@/lib/types';

const ORDER: Position[] = ['G', 'F', 'C'];

/**
 * Sastav jednog tima.
 *
 * Igraci su grupisani po poziciji, pa se rotacija cita odmah — bez toga
 * je ovo samo abecedni spisak. Zaglavlje je puna traka sa grbom, ne jos
 * jedna kartica u nizu.
 */
export default function TeamRoster({
  team,
  code,
  players,
  teams
}: {
  team?: Team;
  code: string;
  players: Player[];
  teams: Record<string, Team>;
}) {
  const grouped = ORDER.map((pos) => ({
    pos,
    list: players.filter((p) => p.position === pos)
  })).filter((g) => g.list.length > 0);

  const other = players.filter((p) => !p.position);

  return (
    <section className="overflow-hidden rounded-md border border-line">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <TeamCrest team={team} code={code} s="md" />
        <div className="min-w-0">
          <h3 className="truncate text-[16px] uppercase leading-none">
            {team?.name_sr ?? code.toUpperCase()}
          </h3>
          {team?.name_en && team.name_en !== team.name_sr && (
            <p className="mt-1 truncate text-[11.5px] text-ink-4">{team.name_en}</p>
          )}
        </div>
        <span className="label ml-auto shrink-0">{players.length} igraca</span>
      </header>

      <div className="divide-y divide-line">
        {grouped.map(({ pos, list }) => (
          <div key={pos} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[110px_1fr] sm:items-start">
            <span className="label pt-1">{POSITION_PLURAL[pos]}</span>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => (
                <li key={p.id} className="flex min-w-0 items-center gap-2.5">
                  <Avatar player={p} size="sm" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold">{p.short_name}</span>
                      <PositionTag position={p.position} />
                    </span>
                    {p.jersey != null && (
                      <span className="mt-0.5 block font-mono text-[10.5px] text-ink-4">
                        #{p.jersey}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {other.length > 0 && (
          <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-[110px_1fr]">
            <span className="label pt-1">Bez pozicije</span>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {other.map((p) => (
                <li key={p.id} className="flex min-w-0 items-center gap-2.5">
                  <Avatar player={p} size="sm" />
                  <span className="truncate text-[13px] font-semibold">{p.short_name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
