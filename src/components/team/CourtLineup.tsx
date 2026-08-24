'use client';

import CourtBackdrop from '../ui/CourtBackdrop';
import PlayerPhoto from '../PlayerPhoto';
import TeamCrest from '../TeamCrest';
import { num } from '@/lib/format';
import { LINEUP, POSITION_ACC, POSITION_LABEL } from '@/lib/config';
import type { Position, PricedPlayer, Team } from '@/lib/types';

/**
 * Postava na terenu.
 *
 * Teren je pozadina, ne ukras: igraci stoje po linijama pozicija, pa se
 * sastav cita bez legende. Prazna mesta su vidljiva i klikabilna — to je
 * najbrzi put do sledeceg igraca.
 *
 * Crtez terena je namerno prigusen; citljivost imena i brojeva je
 * vaznija od dekoracije.
 */

const ORDER: Position[] = ['C', 'F', 'G'];

export default function CourtLineup({
  players,
  teams,
  onRemove,
  onEmptyClick,
  activePosition
}: {
  players: PricedPlayer[];
  teams: Record<string, Team>;
  onRemove: (id: string) => void;
  onEmptyClick: (pos: Position) => void;
  activePosition?: Position | null;
}) {
  const rows = ORDER.map((pos) => {
    const [min, max] = LINEUP.positions[pos];
    const inPos = players.filter((p) => p.position === pos);
    /* Prikazi bar minimum mesta, a ako je vec vise igraca — prikazi njih. */
    const slots = Math.max(min, Math.min(max, inPos.length + (inPos.length < max ? 1 : 0)));
    return { pos, inPos, slots };
  });

  return (
    <div className="relative overflow-hidden rounded-md border border-line bg-gradient-to-b from-surface to-sunken">
      <CourtBackdrop variant="half" opacity={0.13} />

      <div className="relative space-y-5 p-4 sm:p-6">
        {rows.map(({ pos, inPos, slots }) => (
          <div key={pos}>
            <div className="mb-2.5 flex items-center gap-3">
              <span className="label">{POSITION_LABEL[pos]}</span>
              <span className="h-px flex-1 bg-line/70" />
              <span className="font-mono text-[10.5px] tabular-nums text-ink-4">
                {inPos.length}/{LINEUP.positions[pos][1]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: slots }).map((_, i) => {
                const p = inPos[i];
                return p ? (
                  <FilledSlot key={p.id} p={p} teams={teams} onRemove={onRemove} />
                ) : (
                  <EmptySlot
                    key={`${pos}-${i}`}
                    pos={pos}
                    active={activePosition === pos}
                    onClick={() => onEmptyClick(pos)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilledSlot({
  p,
  teams,
  onRemove
}: {
  p: PricedPlayer;
  teams: Record<string, Team>;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group relative flex flex-col items-center gap-2 rounded-sm border border-line-2
                    bg-surface/90 p-3 text-center backdrop-blur-sm transition-colors duration-fast
                    hover:border-brand/60">
      <button
        onClick={() => onRemove(p.id)}
        aria-label={`Izbaci ${p.short_name} iz postave`}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-xs
                   border border-line bg-sunken text-[12px] leading-none text-ink-4 opacity-0
                   transition-all duration-fast hover:border-neg hover:text-neg
                   focus-visible:opacity-100 group-hover:opacity-100"
      >
        ×
      </button>

      <PlayerPhoto player={p} size="lg" />

      <span className="w-full truncate font-display text-[13px] font-extrabold uppercase leading-none">
        {p.short_name}
      </span>

      <span className="flex items-center gap-1.5">
        {p.team_code && <TeamCrest team={teams[p.team_code]} code={p.team_code} s="xs" />}
        <span className="statmono text-[11px] text-ink-3">{num(p.price)}</span>
      </span>

      <span className="w-full rounded-xs bg-sunken py-1 font-mono text-[11px] font-bold tabular-nums text-brand">
        {num(p.projected)} <span className="font-medium text-ink-4">FP</span>
      </span>
    </div>
  );
}

function EmptySlot({
  pos,
  active,
  onClick
}: {
  pos: Position;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-sm border
                  border-dashed transition-colors duration-fast
                  ${active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-line-2 text-ink-4 hover:border-ink-4 hover:bg-elev/60 hover:text-ink-3'}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-full border border-current text-[17px] leading-none">
        +
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em]">
        Dodaj {POSITION_ACC[pos]}
      </span>
    </button>
  );
}
