'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import CourtLineup, { BenchRow } from './CourtLineup';
import PlayerIdentity from '../player/PlayerIdentity';
import MatchupPill from '../player/MatchupPill';
import TeamCrest from '../TeamCrest';
import Segmented from '../ui/Segmented';
import { Button } from '../ui/Button';
import { Alert, Chip, Hint } from '../ui/primitives';
import { FormBars } from '../ui/Stat';
import { useLineup } from '@/lib/useLineup';
import {
  addPlayer,
  checkLineup,
  demote,
  promote,
  removePlayer,
  resolveLineup,
  scoreLineup,
  setCaptain,
  setFormation,
  squadIds,
  squadSlotFree,
  autoBuild
} from '@/lib/lineup';
import { FORMATIONS, LINEUP, POSITION_LABEL, POSITION_PLURAL } from '@/lib/config';
import { num, valueClass } from '@/lib/format';
import type { Coach, Position, PricedPlayer, Team } from '@/lib/types';

/**
 * Sastavljanje tima po zvanicnim pravilima.
 *
 * Kadar je 4 beka, 4 krila, 2 centra i trener, u okviru 100 kredita. Od
 * njih petorka po izabranoj formaciji izlazi na teren, jedan nosi
 * kapitensku traku, jedan je sesti igrac.
 *
 * Projekcija koja stoji gore nije zbir projekcija — to je zbir BODOVA,
 * sa kapitenom pomnozenim i klupom prepolovljenom, jer je to jedini broj
 * koji korisnik stvarno dobija u kolu.
 */
export default function LineupBuilder({
  roundId,
  pool,
  coaches,
  teams,
  canOptimize
}: {
  roundId: number;
  pool: PricedPlayer[];
  coaches: Coach[];
  teams: Record<string, Team>;
  canOptimize: boolean;
}) {
  const { state, ready, save, update, clear } = useLineup(roundId);
  const [filter, setFilter] = useState<'ALL' | Position>('ALL');
  const [mode, setMode] = useState<'igraci' | 'treneri'>('igraci');
  const [q, setQ] = useState('');
  const poolRef = useRef<HTMLDivElement>(null);

  const players = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const coachMap = useMemo(() => new Map(coaches.map((c) => [c.id, c])), [coaches]);

  const resolved = useMemo(
    () => resolveLineup(state, players, coachMap),
    [state, players, coachMap]
  );
  const check = useMemo(() => checkLineup(state, resolved), [state, resolved]);
  const score = useMemo(() => scoreLineup(resolved), [resolved]);

  const chosen = useMemo(() => new Set(squadIds(state)), [state]);

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool
      .filter((p) => !chosen.has(p.id))
      .filter((p) => (filter === 'ALL' ? true : p.position === filter))
      .filter((p) => (needle ? p.short_name.toLowerCase().includes(needle) : true))
      .sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0))
      .slice(0, 60);
  }, [pool, chosen, filter, q]);

  const coachCandidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return coaches
      .filter((c) => (needle ? c.name.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.projected - a.projected);
  }, [coaches, q]);

  const budgetPct = Math.min(100, (check.spent / LINEUP.budget) * 100);
  const over = check.spent > LINEUP.budget;
  const squadFull = resolved.all.length >= LINEUP.size;

  /* ---------------- radnje ---------------- */

  const focusPool = useCallback((pos: Position) => {
    setMode('igraci');
    setFilter(pos);
    poolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openCoaches = useCallback(() => {
    setMode('treneri');
    poolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const canAfford = (price: number) => price <= check.remaining + 0.001;

  function whyBlocked(p: PricedPlayer): string | null {
    if (!p.position) return 'Igrac nema poziciju';
    if (!squadSlotFree(resolved, p.position))
      return `Kadar vec ima ${LINEUP.squad[p.position]} × ${POSITION_LABEL[p.position].toLowerCase()}`;
    if (!canAfford(p.price ?? 0)) return 'Nema dovoljno kredita';
    return null;
  }

  if (!ready) {
    return <div className="skel h-[520px] w-full rounded-md" aria-label="Ucitavanje postave" />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
      <div className="min-w-0">
        {/* ---------------- brojevi ---------------- */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
          <div className="bg-surface px-4 py-3.5">
            <div className="label">Kadar</div>
            <div className="stat mt-1.5 text-[22px]">
              {resolved.all.length}
              <span className="text-ink-4">/{LINEUP.size}</span>
              {resolved.coach && <span className="ml-1.5 text-[12px] text-brand">+ HC</span>}
            </div>
          </div>
          <div className="bg-surface px-4 py-3.5">
            <div className="label">Potroseno</div>
            <div className={`stat mt-1.5 text-[22px] ${over ? 'text-neg' : ''}`}>
              {num(check.spent)}
            </div>
          </div>
          <div className="bg-surface px-4 py-3.5">
            <div className="label">Ostalo</div>
            <div className={`stat mt-1.5 text-[22px] ${over ? 'text-neg' : 'text-ink-2'}`}>
              {num(check.remaining)}
            </div>
          </div>
          <div className="bg-surface px-4 py-3.5">
            <div className="label">
              <Hint text="Zbir bodova: petorka 100%, kapiten 150%, sesti igrac 100%, klupa 50%, trener 100%.">
                Projekcija
              </Hint>
            </div>
            <div className="stat mt-1.5 text-[22px] text-brand">{num(score.total)}</div>
          </div>
        </div>

        {/* budzet */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11.5px] text-ink-3">
            <span>
              Budzet <b className="statmono text-ink-2">{LINEUP.budget}</b> kredita · 10 igraca + trener
            </span>
            <span className="statmono">{Math.round(budgetPct)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elev">
            <div
              className={`h-full rounded-full transition-[width] duration-slow ease-out ${
                over ? 'bg-neg' : 'bg-brand'
              }`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>

        {/* kvote pozicija */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(['G', 'F', 'C'] as Position[]).map((pos) => {
            const have = check.squad[pos];
            const need = LINEUP.squad[pos];
            return (
              <span
                key={pos}
                className={`chip ${have === need ? 'border-brand/45 text-brand-400' : ''}`}
                title={`${POSITION_LABEL[pos]}: ${have} od ${need}`}
              >
                {POSITION_PLURAL[pos]}
                <b className="statmono">
                  {have}/{need}
                </b>
              </span>
            );
          })}
          <span className={`chip ${resolved.coach ? 'border-brand/45 text-brand-400' : ''}`}>
            Trener <b className="statmono">{resolved.coach ? '1/1' : '0/1'}</b>
          </span>
        </div>

        {/* ---------------- formacija ---------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="label shrink-0">Formacija</span>
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-sm border border-line bg-sunken p-1">
            {FORMATIONS.map((f) => {
              const on = state.formation === f.code;
              return (
                <button
                  key={f.code}
                  onClick={() => update((s) => setFormation(s, resolved, f.code))}
                  aria-pressed={on}
                  title={f.hint}
                  className={`h-9 shrink-0 rounded-xs px-3 font-mono text-[12px] font-bold tabular-nums
                              transition-colors duration-fast
                              ${on ? 'bg-brand text-black' : 'text-ink-3 hover:bg-elev hover:text-ink'}`}
                >
                  {f.code}
                </button>
              );
            })}
          </div>
          <p className="text-[11.5px] text-ink-3">
            bek–krilo–centar u prvoj petorci
          </p>
        </div>

        {/* ---------------- stanje ---------------- */}
        {check.violations.length > 0 && (
          <div className="mt-4">
            <Alert tone="warn" title="Postava jos ne postuje pravila">
              <ul className="mt-1 space-y-1">
                {check.violations.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </Alert>
          </div>
        )}

        {check.valid && (
          <div className="mt-4">
            <Alert tone="ok" title="Postava je ispravna">
              {LINEUP.squad.G} beka, {LINEUP.squad.F} krila, {LINEUP.squad.C} centra i trener u
              okviru budzeta. Formacija {resolved.formation.code}, kapiten{' '}
              {resolved.captain?.short_name}.
            </Alert>
          </div>
        )}

        {/* ---------------- teren ---------------- */}
        <div className="mt-5 space-y-5">
          <CourtLineup
            state={state}
            resolved={resolved}
            teams={teams}
            onRemove={(id) => update((s) => removePlayer(s, id))}
            onSetCaptain={(id) => update((s) => setCaptain(s, id))}
            onDemote={(id, to) => update((s) => demote(s, id, to))}
            onEmptyClick={focusPool}
            onCoachClick={openCoaches}
          />

          <BenchRow
            resolved={resolved}
            teams={teams}
            onRemove={(id) => update((s) => removePlayer(s, id))}
            onPromote={(id) => update((s) => promote(s, resolved, id))}
            onEmptyClick={() => focusPool('G')}
          />
        </div>

        {/* ---------------- razrada bodova ---------------- */}
        {resolved.all.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-5">
            {[
              ['Petorka', score.starters],
              ['Kapiten', score.captainBonus],
              ['Sesti igrac', score.sixth],
              ['Klupa', score.bench],
              ['Trener', score.coach]
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-surface px-3 py-2.5">
                <div className="label">{label}</div>
                <div className="statmono mt-1 text-[15px] text-ink-2">
                  {value === score.captainBonus && score.captainBonus > 0 ? '+' : ''}
                  {num(value as number)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------------- akcije ---------------- */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => save(autoBuild(pool, coaches))}>
            Predlozi postavu
          </Button>
          <Button variant="quiet" size="sm" onClick={clear} disabled={!resolved.all.length}>
            Isprazni
          </Button>
          <span className="flex-1" />
          <Link
            href="/optimizator"
            className={`btn-primary btn-sm ${!resolved.all.length ? 'pointer-events-none opacity-40' : ''}`}
            aria-disabled={!resolved.all.length}
          >
            {canOptimize ? 'Optimizuj postavu' : 'Vidi sta optimizator nalazi'}
          </Link>
        </div>
      </div>

      {/* ---------------- izbor ---------------- */}
      <div ref={poolRef} className="min-w-0 xl:sticky xl:top-[calc(var(--nav-h)+16px)]">
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <h3 className="text-[16px] uppercase">
              {mode === 'igraci' ? 'Dodaj igraca' : 'Izaberi trenera'}
            </h3>
            <span className="label">
              {mode === 'igraci' ? `${candidates.length} dostupno` : `${coachCandidates.length} timova`}
            </span>
          </div>

          <div className="space-y-3 border-b border-line p-3">
            <Segmented
              size="sm"
              label="Sta biras"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'igraci', label: 'Igraci' },
                { value: 'treneri', label: 'Treneri' }
              ]}
            />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder={mode === 'igraci' ? 'Trazi po imenu…' : 'Trazi trenera ili tim…'}
              aria-label="Pretraga"
              className="field h-10"
            />

            {mode === 'igraci' && (
              <Segmented
                size="sm"
                label="Pozicija"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'ALL', label: 'Sve' },
                  { value: 'G', label: POSITION_PLURAL.G, count: LINEUP.squad.G - check.squad.G },
                  { value: 'F', label: POSITION_PLURAL.F, count: LINEUP.squad.F - check.squad.F },
                  { value: 'C', label: POSITION_PLURAL.C, count: LINEUP.squad.C - check.squad.C }
                ]}
              />
            )}
          </div>

          {mode === 'igraci' ? (
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
              {candidates.map((p) => {
                const blocked = whyBlocked(p);
                return (
                  <li key={p.id}>
                    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-elev">
                      <div className="min-w-0 flex-1">
                        <PlayerIdentity player={p} teams={teams} size="xs" />
                        <div className="mt-1.5 flex items-center gap-3 pl-[38px]">
                          <MatchupPill
                            opponent={p.opponent_code}
                            isHome={p.is_home}
                            score={p.matchup_score}
                            teams={teams}
                            size="sm"
                            showWord={false}
                          />
                          <FormBars values={p.form} height={14} />
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="statmono text-[13px] text-ink">{num(p.projected)}</div>
                        <div className="statmono text-[11px] text-ink-3">
                          {num(p.price)} kr ·{' '}
                          <span className={valueClass(p.value_score)}>{num(p.value_score)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => update((s) => addPlayer(s, resolved, p))}
                        disabled={!!blocked}
                        title={blocked ?? `Dodaj ${p.short_name}`}
                        aria-label={`Dodaj ${p.short_name} u kadar`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-line-2
                                   text-[16px] leading-none text-ink-2 transition-colors duration-fast
                                   hover:border-brand hover:bg-brand hover:text-black
                                   disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4
                                   disabled:hover:bg-transparent"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}

              {candidates.length === 0 && (
                <li className="px-4 py-10 text-center text-small text-ink-3">
                  Nema igraca za ovaj filter.
                </li>
              )}
            </ul>
          ) : (
            <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
              {coachCandidates.map((c) => {
                const active = state.coach === c.id;
                const blocked =
                  !active && c.price > check.remaining + (resolved.coach?.price ?? 0) + 0.001;
                return (
                  <li key={c.id}>
                    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast hover:bg-elev">
                      <TeamCrest team={teams[c.team_code]} code={c.team_code} s="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-[13px] font-extrabold uppercase leading-none">
                          {c.name}
                        </div>
                        <div className="mt-1 statmono text-[11px] text-ink-3">{num(c.price)} kr</div>
                      </div>
                      <div className="statmono shrink-0 text-[13px] text-ink">{num(c.projected)}</div>
                      <button
                        onClick={() =>
                          update((s) => ({ ...s, coach: active ? null : c.id }))
                        }
                        disabled={blocked}
                        title={blocked ? 'Nema dovoljno kredita' : undefined}
                        aria-label={active ? `Ukloni ${c.name}` : `Izaberi ${c.name}`}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-sm border
                                    text-[16px] leading-none transition-colors duration-fast
                                    disabled:cursor-not-allowed disabled:border-line disabled:text-ink-4
                                    ${active
                                      ? 'border-brand bg-brand text-black'
                                      : 'border-line-2 text-ink-2 hover:border-brand hover:bg-brand hover:text-black'}`}
                      >
                        {active ? '✓' : '+'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {squadFull && !resolved.coach && (
          <div className="mt-3">
            <Alert tone="warn">
              Kadar je pun, ali jos nema trenera — on nosi pune poene i ulazi u budzet.
            </Alert>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
          Zvanicna pravila: {LINEUP.squad.G} beka, {LINEUP.squad.F} krila, {LINEUP.squad.C} centra
          i trener u okviru {LINEUP.budget} kredita. Petorka i sesti igrac nose{' '}
          {100}% poena, klupa {LINEUP.benchMultiplier * 100}%, kapiten{' '}
          {LINEUP.captainMultiplier * 100}%.
        </p>
      </div>
    </div>
  );
}
