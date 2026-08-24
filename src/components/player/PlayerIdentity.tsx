import PlayerPhoto from '../PlayerPhoto';
import TeamCrest from '../TeamCrest';
import { PositionTag } from '../ui/primitives';
import { teamName } from '@/lib/format';
import type { Player, Team } from '@/lib/types';

/**
 * Ime igraca sa timom i pozicijom. Ista kombinacija se pojavljuje u
 * tabeli, na kartici, u postavi i u optimizatoru — zato stoji na jednom
 * mestu, umesto da se sklapa iznova na svakom ekranu.
 */
export default function PlayerIdentity({
  player,
  teams,
  size = 'md',
  showTeamName = true,
  showJersey = false,
  ring = false,
  className = ''
}: {
  player: Pick<Player, 'short_name' | 'photo' | 'jersey' | 'team_code' | 'position'>;
  teams: Record<string, Team>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTeamName?: boolean;
  showJersey?: boolean;
  ring?: boolean;
  className?: string;
}) {
  const nameSize = {
    xs: 'text-[12px]',
    sm: 'text-[13.5px]',
    md: 'text-[15px]',
    lg: 'text-[19px]'
  }[size];

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <PlayerPhoto player={player} size={size === 'lg' ? 'lg' : size} ring={ring} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`truncate font-display font-extrabold uppercase leading-none tracking-tight ${nameSize}`}
          >
            {player.short_name}
          </span>
          <PositionTag position={player.position} />
        </div>
        {showTeamName && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {player.team_code && (
              <TeamCrest team={teams[player.team_code]} code={player.team_code} s="xs" />
            )}
            <span className="truncate text-[11.5px] text-ink-3">
              {showJersey && player.jersey != null && (
                <span className="font-mono text-ink-4">#{player.jersey} </span>
              )}
              {teamName(teams, player.team_code)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
