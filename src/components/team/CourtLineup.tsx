'use client';

import CourtBackdrop from '../ui/CourtBackdrop';
import PlayerPhoto from '../PlayerPhoto';
import TeamCrest from '../TeamCrest';
import { num } from '@/lib/format';
import { LINEUP, POSITION_ACC, POSITION_LABEL } from '@/lib/config';
import { effectivePoints, type LineupState, type ResolvedLineup } from '@/lib/lineup';
import type { Coach, Position, PricedPlayer, Team } from '@/lib/types';

/**
 * Postava na terenu.
 *
 * Raspored prati zvanicnu igru: centri gore kod kosa, krila u sredini,
 * bekovi dole. Broj mesta u svakom redu diktira izabrana formacija, pa se
 * pravilo vidi na terenu umesto da stoji u nekom tekstu sa strane.
 *
 * Teren je pozadina, ne ukras — crtez je prigusen da bi imena i brojevi
 * ostali citljivi.
 */

const ROWS: Position[] = ['C', 'F', 'G'];

export default function CourtLineup({
  state,
  resolved,
  teams,
  onRemove,
  onSetCaptain,
  onDemote,
  onEmptyClick,
  onCoachClick
}: {
  state: LineupState;
  resolved: ResolvedLineup;
  teams: Record<string, Team>;
  onRemove: (id: string) => void;
  onSetCaptain: (id: string) => void;
  onDemote: (id: string, to: 'sixth' | 'bench') => void;
  onEmptyClick: (pos: Position) => void;
  onCoachClick: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-line bg-gradient-to-b from-surface to-sunken">
      <CourtBackdrop variant="half" opacity={0.13} />

      {/* trener stoji uz teren, kao na klupi */}
      <div className="relative flex justify-end p-3 sm:p-4">
        <CoachCard coach={resolved.coach} teams={teams} onClick={onCoachClick} />
      </div>

      <div className="relative space-y-5 px-3 pb-5 sm:px-6 sm:pb-6">
        {ROWS.map((pos) => {
          const slots = resolved.formation[pos];
          const inRow = resolved.starters.filter((p) => p.position === pos);

          return (
            <div key={pos}>
              <div className="mb-2.5 flex items-center gap-3">
                <span className="label">{POSITION_LABEL[pos]}</span>
                <span className="h-px flex-1 bg-line/70" />
                <span className="font-mono text-[10.5px] tabular-nums text-ink-4">
                  {inRow.length}/{slots}
                </span>
              </div>

              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(slots, 3)}, minmax(0,1fr))` }}
              >
                {Array.from({ length: slots }).map((_, i) => {
                  const p = inRow[i];
                  return p ? (
                    <StarterCard
                      key={p.id}
                      p={p}
                      teams={teams}
                      isCaptain={state.captain === p.id}
                      onRemove={onRemove}
                      onSetCaptain={onSetCaptain}
                      onDemote={onDemote}
                    />
                  ) : (
                    <EmptySlot key={`${pos}-${i}`} pos={pos} onClick={() => onEmptyClick(pos)} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StarterCard({
  p,
  teams,
  isCaptain,
  onRemove,
  onSetCaptain,
  onDemote
}: {
  p: PricedPlayer;
  teams: Record<string, Team>;
  isCaptain: boolean;
  onRemove: (id: string) => void;
  onSetCaptain: (id: string) => void;
  onDemote: (id: string, to: 'sixth' | 'bench') => void;
}) {
  const points = effectivePoints(p, 'starter', isCaptain);

  return (
    <div
      className={`group relative flex flex-col items-center gap-2 rounded-sm border p-3 text-center
                  backdrop-blur-sm transition-colors duration-fast
                  ${isCaptain
                    ? 'border-brand bg-brand/[.10]'
                    : 'border-line-2 bg-surface/90 hover:border-brand/60'}`}
    >
      {isCaptain && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-xs bg-brand px-1.5 py-0.5
                         font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-black">
          Kapiten ×{LINEUP.captainMultiplier}
        </span>
      )}

      <button
        onClick={() => onRemove(p.id)}
        aria-label={`Izbaci ${p.short_name} iz postave`}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-xs border
                   border-line bg-sunken text-[12px] leading-none text-ink-4 opacity-0
                   transition-all duration-fast hover:border-neg hover:text-neg
                   focus-visible:opacity-100 group-hover:opacity-100"
      >
        ×
      </button>

      <PlayerPhoto player={p} size="lg" ring={isCaptain} />

      <span className="w-full truncate font-display text-[13px] font-extrabold uppercase leading-none">
        {p.short_name}
      </span>

      <span className="flex items-center gap-1.5">
        {p.team_code && <TeamCrest team={teams[p.team_code]} code={p.team_code} s="xs" />}
        <span className="statmono text-[11px] text-ink-3">{num(p.price)}</span>
      </span>

      <span
        className={`w-full rounded-xs py-1 font-mono text-[11px] font-bold tabular-nums
                    ${isCaptain ? 'bg-brand text-black' : 'bg-sunken text-brand'}`}
      >
        {num(points)} <span className="font-medium opacity-70">BOD</span>
      </span>

      {/* radnje se pojavljuju na hover i na fokus tastaturom */}
      <span className="flex w-full gap-1 opacity-0 transition-opacity duration-fast
                       focus-within:opacity-100 group-hover:opacity-100">
        {!isCaptain && (
          <button
            onClick={() => onSetCaptain(p.id)}
            title="Postavi za kapitena"
            className="flex-1 rounded-xs border border-line bg-sunken py-1 font-mono text-[9.5px]
                       uppercase tracking-wide text-ink-3 transition-colors duration-fast
                       hover:border-brand hover:text-brand"
          >
            Kapiten
          </button>
        )}
        <button
          onClick={() => onDemote(p.id, 'sixth')}
          title="Prebaci na mesto sestog igraca"
          className="flex-1 rounded-xs border border-line bg-sunken py-1 font-mono text-[9.5px]
                     uppercase tracking-wide text-ink-3 transition-colors duration-fast
                     hover:border-ink-4 hover:text-ink"
        >
          6. igrac
        </button>
        <button
          onClick={() => onDemote(p.id, 'bench')}
          title="Posalji na klupu"
          className="flex-1 rounded-xs border border-line bg-sunken py-1 font-mono text-[9.5px]
                     uppercase tracking-wide text-ink-3 transition-colors duration-fast
                     hover:border-ink-4 hover:text-ink"
        >
          Klupa
        </button>
      </span>
    </div>
  );
}

function EmptySlot({ pos, onClick }: { pos: Position; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-sm border
                 border-dashed border-line-2 text-ink-4 transition-colors duration-fast
                 hover:border-brand hover:bg-brand/[.06] hover:text-brand"
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

function CoachCard({
  coach,
  teams,
  onClick
}: {
  coach: Coach | null;
  teams: Record<string, Team>;
  onClick: () => void;
}) {
  if (!coach) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2.5 rounded-sm border border-dashed border-line-2 px-3 py-2
                   text-ink-4 transition-colors duration-fast hover:border-brand hover:text-brand"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full border border-current text-[14px] leading-none">
          +
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em]">Dodaj trenera</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-sm border border-line-2 bg-surface/90 px-3 py-2
                 text-left backdrop-blur-sm transition-colors duration-fast hover:border-brand/60"
    >
      <TeamCrest team={teams[coach.team_code]} code={coach.team_code} s="sm" />
      <span className="min-w-0">
        <span className="block truncate font-display text-[13px] font-extrabold uppercase leading-none">
          {coach.name}
        </span>
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
          Trener · {num(coach.price)} kr
        </span>
      </span>
      <span className="statmono shrink-0 rounded-xs bg-sunken px-2 py-1 text-[11px] text-brand">
        {num(coach.projected)}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* KLUPA                                                               */
/* ------------------------------------------------------------------ */

/**
 * Sesti igrac i klupa.
 *
 * Sesti igrac je odvojen jer nosi pune poene, a ostatak klupe polovinu —
 * to je razlika koju korisnik mora da vidi bez citanja pravila, pa svaka
 * kartica pise koliko bodova stvarno donosi.
 */
export function BenchRow({
  resolved,
  teams,
  onRemove,
  onPromote,
  onEmptyClick
}: {
  resolved: ResolvedLineup;
  teams: Record<string, Team>;
  onRemove: (id: string) => void;
  onPromote: (id: string) => void;
  onEmptyClick: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="label">Sesti igrac</span>
          <span className="chip-brand h-[18px] px-1.5 text-[9px]">100%</span>
        </div>
        {resolved.sixth ? (
          <BenchCard
            p={resolved.sixth}
            teams={teams}
            role="sixth"
            onRemove={onRemove}
            onPromote={onPromote}
          />
        ) : (
          <EmptyBench label="Dodaj sestog" onClick={onEmptyClick} />
        )}
      </div>

      <div>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="label">Klupa</span>
          <span className="chip h-[18px] px-1.5 text-[9px]">50%</span>
          <span className="h-px flex-1 bg-line/70" />
          <span className="font-mono text-[10.5px] tabular-nums text-ink-4">
            {resolved.bench.length}/{LINEUP.bench}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: LINEUP.bench }).map((_, i) => {
            const p = resolved.bench[i];
            return p ? (
              <BenchCard
                key={p.id}
                p={p}
                teams={teams}
                role="bench"
                onRemove={onRemove}
                onPromote={onPromote}
              />
            ) : (
              <EmptyBench key={i} label="Dodaj" onClick={onEmptyClick} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BenchCard({
  p,
  teams,
  role,
  onRemove,
  onPromote
}: {
  p: PricedPlayer;
  teams: Record<string, Team>;
  role: 'sixth' | 'bench';
  onRemove: (id: string) => void;
  onPromote: (id: string) => void;
}) {
  const points = effectivePoints(p, role, false);

  return (
    <div
      className={`group relative flex items-center gap-2.5 rounded-sm border bg-surface p-2.5
                  transition-colors duration-fast hover:border-line-2
                  ${role === 'sixth' ? 'border-brand/45' : 'border-line'}`}
    >
      <PlayerPhoto player={p} size="md" />

      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[12.5px] font-extrabold uppercase leading-none">
          {p.short_name}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {p.team_code && <TeamCrest team={teams[p.team_code]} code={p.team_code} s="xs" />}
          <span className="statmono text-[10.5px] text-ink-3">{num(p.price)} kr</span>
        </div>
        <div className="mt-1.5 statmono text-[11.5px] text-brand">
          {num(points)}
          <span className="ml-1 font-medium text-ink-4">
            BOD{role === 'bench' ? ` · od ${num(p.projected)}` : ''}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity duration-fast
                      focus-within:opacity-100 group-hover:opacity-100">
        <button
          onClick={() => onPromote(p.id)}
          title="Ubaci u prvu petorku"
          aria-label={`Ubaci ${p.short_name} u prvu petorku`}
          className="grid h-6 w-6 place-items-center rounded-xs border border-line bg-sunken
                     text-[11px] text-ink-3 transition-colors duration-fast
                     hover:border-brand hover:text-brand"
        >
          ↑
        </button>
        <button
          onClick={() => onRemove(p.id)}
          title="Izbaci iz kadra"
          aria-label={`Izbaci ${p.short_name} iz kadra`}
          className="grid h-6 w-6 place-items-center rounded-xs border border-line bg-sunken
                     text-[12px] leading-none text-ink-4 transition-colors duration-fast
                     hover:border-neg hover:text-neg"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function EmptyBench({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[76px] items-center justify-center gap-2 rounded-sm border border-dashed
                 border-line-2 text-ink-4 transition-colors duration-fast
                 hover:border-brand hover:bg-brand/[.06] hover:text-brand"
    >
      <span className="text-[15px] leading-none">+</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{label}</span>
    </button>
  );
}
