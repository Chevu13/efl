'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import CourtLineup from './CourtLineup';
import PlayerIdentity from '../player/PlayerIdentity';
import MatchupPill from '../player/MatchupPill';
import Segmented from '../ui/Segmented';
import { Button } from '../ui/Button';
import { Alert, EmptyState } from '../ui/primitives';
import { FormBars } from '../ui/Stat';
import { useLineup } from '@/lib/useLineup';
import { checkLineup, suggestLineup } from '@/lib/optimizer';
import { LINEUP, POSITION_PLURAL } from '@/lib/config';
import { num, valueClass } from '@/lib/format';
import type { Position, PricedPlayer, Team } from '@/lib/types';

/**
 * Sastavljanje tima.
 *
 * Tri stvari moraju da se vide bez skrolovanja: koliko je potroseno,
 * koliko je ostalo i koliko postava projektuje poena. Sve ostalo — pravila
 * pozicija, ogranicenje po timu — javlja se tek kad se prekrsi, i to
 * recenicom koja kaze sta tacno nedostaje.
 */
export default function LineupBuilder({
  roundId,
  pool,
  teams,
  canOptimize
}: {
  roundId: number;
  pool: PricedPlayer[];
  teams: Record<string, Team>;
  canOptimize: boolean;
}) {
  const { ids, ready, add, remove, clear, replace } = useLineup(roundId);
  const [filter, setFilter] = useState<'ALL' | Position>('ALL');
  const [q, setQ] = useState('');
  const poolRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(pool.map((p) => [p.id, p])), [pool]);
  const selected = useMemo(
    () => ids.map((id) => byId.get(id)).filter(Boolean) as PricedPlayer[],
    [ids, byId]
  );

  const check = useMemo(() => checkLineup(selected), [selected]);
  const full = selected.length >= LINEUP.size;

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool
      .filter((p) => !ids.includes(p.id))
      .filter((p) => (filter === 'ALL' ? true : p.position === filter))
      .filter((p) => (needle ? p.short_name.toLowerCase().includes(needle) : true))
      .sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0))
      .slice(0, 60);
  }, [pool, ids, filter, q]);

  const budgetPct = Math.min(100, (check.spent / LINEUP.budget) * 100);
  const over = check.spent > LINEUP.budget;

  function focusPool(pos: Position) {
    setFilter(pos);
    poolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function affordable(p: PricedPlayer) {
    return (p.price ?? 0) <= check.remaining + 0.001;
  }

  if (!ready) {
    return <div className="skel h-[420px] w-full rounded-md" aria-label="Ucitavanje postave" />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px] xl:items-start">
      <div className="min-w-0">
        {/* ---------------- brojevi ---------------- */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
          <div className="bg-surface px-4 py-3.5">
            <div className="label">Igraca</div>
            <div className="stat mt-1.5 text-[22px]">
              {selected.length}
              <span className="text-ink-4">/{LINEUP.size}</span>
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
            <div className="label">Projekcija</div>
            <div className="stat mt-1.5 text-[22px] text-brand">{num(check.projected)}</div>
          </div>
        </div>

        {/* budzet */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11.5px] text-ink-3">
            <span>
              Budzet <b className="statmono text-ink-2">{LINEUP.budget}</b> kredita
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

        {/* pravila */}
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

        {full && check.valid && (
          <div className="mt-4">
            <Alert tone="ok" title="Postava je ispravna">
              {LINEUP.size} igraca, budzet postovan, najvise {LINEUP.maxPerTeam} iz istog tima.
            </Alert>
          </div>
        )}

        {/* ---------------- teren ---------------- */}
        <div className="mt-5">
          {selected.length === 0 ? (
            <EmptyState
              title="Postava je prazna"
              desc={`Izaberi ${LINEUP.size} igraca u okviru ${LINEUP.budget} kredita, ili pusti da ti alat predlozi polaznu postavu.`}
              action={
                <Button onClick={() => replace(suggestLineup(pool).map((p) => p.id))}>
                  Predlozi mi postavu
                </Button>
              }
            />
          ) : (
            <CourtLineup
              players={selected}
              teams={teams}
              onRemove={remove}
              onEmptyClick={focusPool}
              activePosition={filter === 'ALL' ? null : filter}
            />
          )}
        </div>

        {/* ---------------- akcije ---------------- */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => replace(suggestLineup(pool).map((p) => p.id))}
          >
            Predlozi postavu
          </Button>
          <Button variant="quiet" size="sm" onClick={clear} disabled={!selected.length}>
            Isprazni
          </Button>
          <span className="flex-1" />
          <Link
            href="/optimizator"
            className={`btn-primary btn-sm ${!selected.length ? 'pointer-events-none opacity-40' : ''}`}
            aria-disabled={!selected.length}
          >
            {canOptimize ? 'Optimizuj postavu' : 'Vidi sta optimizator nalazi'}
          </Link>
        </div>
      </div>

      {/* ---------------- izbor igraca ---------------- */}
      <div ref={poolRef} className="min-w-0 xl:sticky xl:top-[calc(var(--nav-h)+16px)]">
        <div className="panel overflow-hidden">
          <div className="panel-head flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <h3 className="text-[16px] uppercase">Dodaj igraca</h3>
            <span className="label sm:ml-auto">{candidates.length} dostupno</span>
          </div>

          <div className="space-y-3 border-b border-line p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder="Trazi po imenu…"
              aria-label="Pretraga igraca za postavu"
              className="field h-10"
            />
            <Segmented
              size="sm"
              label="Pozicija"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'ALL', label: 'Sve' },
                { value: 'G', label: POSITION_PLURAL.G },
                { value: 'F', label: POSITION_PLURAL.F },
                { value: 'C', label: POSITION_PLURAL.C }
              ]}
            />
          </div>

          <ul className="max-h-[540px] divide-y divide-line overflow-y-auto">
            {candidates.map((p) => {
              const can = affordable(p) && !full;
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
                      onClick={() => add(p.id)}
                      disabled={!can}
                      title={
                        full
                          ? 'Postava je popunjena'
                          : !affordable(p)
                            ? 'Nema dovoljno kredita'
                            : `Dodaj ${p.short_name}`
                      }
                      aria-label={`Dodaj ${p.short_name} u postavu`}
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
        </div>
      </div>
    </div>
  );
}
