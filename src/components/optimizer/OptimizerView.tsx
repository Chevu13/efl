'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import PlayerPhoto from '../PlayerPhoto';
import TeamCrest from '../TeamCrest';
import MatchupPill from '../player/MatchupPill';
import CourtBackdrop from '../ui/CourtBackdrop';
import { Button } from '../ui/Button';
import { Alert, Chip, EmptyState, PositionTag } from '../ui/primitives';
import { Delta, FormBars } from '../ui/Stat';
import TierGate from '../TierGate';
import { useLineup } from '@/lib/useLineup';
import { num, signed, teamName } from '@/lib/format';
import { LINEUP, POSITION_LABEL } from '@/lib/config';
import type { Position, Team, Tier } from '@/lib/types';

/* ---------------- oblik odgovora sa servera ---------------- */

type Lite = {
  id: string;
  short_name: string;
  full_name: string;
  photo: string | null;
  team_code: string | null;
  position: Position | null;
  jersey: number | null;
  price: number;
  projected: number;
  value_score: number | null;
  matchup_score: number | null;
  opponent_code: string | null;
  is_home: boolean | null;
  season_avg: number | null;
  minutes: number | null;
  form: number[] | null;
  status: string | null;
};

type Reason = { label: string; detail: string };

type WireSwap =
  | {
      locked: false;
      position: Position | null;
      priceDelta: number;
      projDelta: number;
      headline: string;
      reasons: Reason[];
      out: Lite;
      in: Lite;
    }
  | { locked: true; position: Position | null; priceDelta: number; projDelta: number };

type Result = {
  tier: Tier;
  currentTotal: number;
  optimizedTotal: number;
  improvement: number;
  currentSpent: number;
  optimizedSpent: number;
  remaining: number;
  budget: number;
  totalFound: number;
  lockedCount: number;
  needTier: Tier;
  violations: string[];
  swaps: WireSwap[];
};

/**
 * Optimizator postave.
 *
 * Prvo se vidi jedan broj: koliko poena postava dobija. Tek ispod toga
 * stoje zamene, i svaka nosi razlog izveden iz istih brojeva koje
 * korisnik moze da proveri u tabeli. Nista se ne trazi na veru.
 */
export default function OptimizerView({
  roundId,
  teams,
  tier
}: {
  roundId: number;
  teams: Record<string, Team>;
  tier: Tier;
}) {
  const { ids, ready } = useLineup(roundId);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    if (!ids.length) return;
    setBusy(true);
    setError('');
    setApplied(false);

    try {
      const res = await fetch('/api/optimizator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, ids })
      });
      const out = (await res.json()) as Result & { error?: string };
      if (!res.ok) {
        setError(out.error ?? 'Optimizacija nije uspela.');
        return;
      }
      setResult(out);
    } catch {
      setError('Nema veze sa serverom.');
    } finally {
      setBusy(false);
    }
  }, [ids, roundId]);

  /* Prvi racun krece sam — korisnik je dosao ovde bas zbog toga. */
  useEffect(() => {
    if (ready && ids.length && !started.current) {
      started.current = true;
      void run();
    }
  }, [ready, ids.length, run]);

  if (!ready) {
    return <div className="skel h-72 w-full rounded-md" aria-label="Ucitavanje" />;
  }

  if (!ids.length) {
    return (
      <EmptyState
        title="Nema postave za optimizaciju"
        desc={`Sastavi tim od ${LINEUP.size} igraca u okviru ${LINEUP.budget} kredita, pa se vrati ovde. Optimizator ce naci zamene koje donose vise poena za isti novac.`}
        action={
          <Link href="/igra" className="btn-primary btn-md">
            Sastavi postavu
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <ScoreHeader result={result} busy={busy} onRun={run} />

      {error && <Alert tone="error" title="Optimizacija nije uspela">{error}</Alert>}

      {result && result.violations.length > 0 && (
        <Alert tone="warn" title="Postava krsi pravila">
          <ul className="mt-1 space-y-1">
            {result.violations.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </Alert>
      )}

      {result && result.totalFound === 0 && (
        <Alert tone="ok" title="Postava je vec optimalna">
          Za zadati budzet i pravila sastava nema zamene koja donosi vise
          projektovanih poena. Vrati se posle azuriranja cena.
        </Alert>
      )}

      {result && result.totalFound > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[22px] uppercase">
              Preporucene zamene
              <span className="ml-2.5 font-mono text-[13px] font-medium text-ink-3">
                {result.totalFound}
              </span>
            </h2>
            <Chip>{applied ? 'Primenjeno u pregledu' : `Paket ${result.tier}`}</Chip>
          </div>

          <ol className="space-y-4">
            {result.swaps.map((s, i) =>
              s.locked ? (
                <LockedSwap key={`l${i}`} swap={s} index={i} />
              ) : (
                <SwapRow key={s.out.id} swap={s} index={i} teams={teams} />
              )
            )}
          </ol>

          {result.lockedCount > 0 && (
            <TierGate
              need={result.needTier}
              title={`Jos ${result.lockedCount} ${result.lockedCount === 1 ? 'zamena' : 'zamene'} koje donose poene`}
              desc={`Ukupno poboljsanje od ${signed(result.improvement)} poena racuna sve zamene. Sa paketom ${result.needTier} vidis koje su i zasto rade.`}
            />
          )}
        </>
      )}

      {result && (
        <p className="text-[11.5px] leading-relaxed text-ink-4">
          Kako radi: optimizator u svakom krugu proba svaku zamenu igrac-za-igraca
          koja postuje poziciju, budzet od {result.budget} kredita i najvise{' '}
          {LINEUP.maxPerTeam} igraca iz istog tima, i bira onu sa najvecim dobitkom
          projektovanih poena. Staje kad vise nema poboljsanja.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GLAVNI BROJ                                                         */
/* ------------------------------------------------------------------ */

function ScoreHeader({
  result,
  busy,
  onRun
}: {
  result: Result | null;
  busy: boolean;
  onRun: () => void;
}) {
  const improved = result && result.improvement > 0;

  return (
    <section className="relative overflow-hidden rounded-md border border-line bg-gradient-to-b from-surface to-sunken">
      <CourtBackdrop variant="arc" opacity={0.1} />

      <div className="relative p-5 sm:p-7">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto]">
          {/* trenutno */}
          <div>
            <div className="label">Trenutna projekcija</div>
            <div className="stat mt-2 text-[clamp(38px,7vw,62px)] leading-none text-ink-3">
              {busy && !result ? <span className="skel inline-block h-[0.8em] w-28" /> : num(result?.currentTotal)}
            </div>
            <div className="mt-1.5 text-[11.5px] text-ink-4">
              {result ? `${num(result.currentSpent)} kredita potroseno` : ''}
            </div>
          </div>

          <div className="hidden text-[26px] text-brand md:block" aria-hidden>
            →
          </div>

          {/* optimizovano */}
          <div>
            <div className="label">Optimizovana projekcija</div>
            <div
              key={result?.optimizedTotal}
              className="stat mt-2 animate-tickUp text-[clamp(38px,7vw,62px)] leading-none text-brand"
            >
              {busy && !result ? <span className="skel inline-block h-[0.8em] w-28" /> : num(result?.optimizedTotal)}
            </div>
            <div className="mt-1.5 text-[11.5px] text-ink-4">
              {result ? `${num(result.optimizedSpent)} kredita potroseno` : ''}
            </div>
          </div>

          {/* razlika */}
          <div className="md:border-l md:border-line md:pl-6">
            <div className="label">Poboljsanje</div>
            <div
              className={`stat mt-2 text-[clamp(30px,5vw,44px)] leading-none ${
                improved ? 'text-brand' : 'text-ink-3'
              }`}
            >
              {result ? signed(result.improvement) : '—'}
            </div>
            <div className="mt-1.5 text-[11.5px] text-ink-4">projektovanih poena</div>
          </div>
        </div>

        {result && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <span className="chip">
              Preostali budzet <b className="text-ink">{num(result.remaining)}</b>
            </span>
            <span className="chip">
              Nadjeno zamena <b className="text-ink">{result.totalFound}</b>
            </span>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={onRun} loading={busy}>
              Izracunaj ponovo
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* JEDNA ZAMENA                                                        */
/* ------------------------------------------------------------------ */

function SwapRow({
  swap,
  index,
  teams
}: {
  swap: Extract<WireSwap, { locked: false }>;
  index: number;
  teams: Record<string, Team>;
}) {
  return (
    <li
      className="animate-rise overflow-hidden rounded-md border border-line bg-surface"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] font-bold tabular-nums text-brand">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-[13px] font-semibold text-ink">{swap.headline}</span>
        </span>
        <span className="flex items-center gap-3">
          <Delta value={swap.projDelta} unit="FP" size="md" />
          <span className="statmono text-[12px] text-ink-3">
            {swap.priceDelta === 0 ? 'ista cena' : `${signed(swap.priceDelta)} kr`}
          </span>
        </span>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-[1fr_auto_1fr]">
        <SwapSide p={swap.out} teams={teams} kind="out" />
        <div className="flex items-center justify-center bg-surface px-4 py-2 md:px-5">
          <span className="text-[20px] text-brand md:rotate-0" aria-hidden>
            →
          </span>
          <span className="sr-only">menja se u</span>
        </div>
        <SwapSide p={swap.in} teams={teams} kind="in" />
      </div>

      <details className="group/d border-t border-line bg-sunken">
        <summary
          className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[12.5px]
                     font-semibold text-ink-2 transition-colors duration-fast hover:text-ink"
        >
          <span className="inline-block transition-transform duration-fast group-open/d:rotate-90" aria-hidden>
            ›
          </span>
          Zasto ova zamena
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-wide text-ink-4">
            {swap.reasons.length} razloga
          </span>
        </summary>

        <dl className="grid gap-px bg-line sm:grid-cols-2">
          {swap.reasons.map((r) => (
            <div key={r.label} className="bg-sunken px-4 py-3">
              <dt className="label">{r.label}</dt>
              <dd className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{r.detail}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}

function SwapSide({
  p,
  teams,
  kind
}: {
  p: Lite;
  teams: Record<string, Team>;
  kind: 'out' | 'in';
}) {
  const out = kind === 'out';
  return (
    <div className={`bg-surface p-4 ${out ? 'md:text-right' : ''}`}>
      <div className={`flex items-center gap-3 ${out ? 'md:flex-row-reverse md:text-right' : ''}`}>
        <PlayerPhoto player={p} size="lg" ring={!out} />
        <div className="min-w-0">
          <div className={`flex items-center gap-2 ${out ? 'md:flex-row-reverse' : ''}`}>
            <span className="truncate font-display text-[17px] font-extrabold uppercase leading-none tracking-tight">
              {p.short_name}
            </span>
            <PositionTag position={p.position} />
          </div>
          <div className={`mt-1.5 flex items-center gap-1.5 ${out ? 'md:flex-row-reverse' : ''}`}>
            {p.team_code && <TeamCrest team={teams[p.team_code]} code={p.team_code} s="xs" />}
            <span className="truncate text-[11.5px] text-ink-3">
              {teamName(teams, p.team_code)}
            </span>
          </div>
        </div>
      </div>

      <div className={`mt-3 flex items-center gap-2 ${out ? 'md:justify-end' : ''}`}>
        <span
          className={`chip ${out ? 'border-neg/40 text-neg' : 'chip-brand'}`}
        >
          {out ? 'Izlazi' : 'Ulazi'}
        </span>
      </div>

      <dl className={`mt-3 flex flex-wrap gap-x-5 gap-y-2 ${out ? 'md:justify-end' : ''}`}>
        <div>
          <dt className="label">Proj.</dt>
          <dd className={`statmono mt-1 text-[15px] ${out ? 'text-ink-3' : 'text-brand'}`}>
            {num(p.projected)}
          </dd>
        </div>
        <div>
          <dt className="label">Cena</dt>
          <dd className="statmono mt-1 text-[15px] text-ink-2">{num(p.price)}</dd>
        </div>
        <div>
          <dt className="label">Forma</dt>
          <dd className="mt-1 flex items-center gap-2">
            <FormBars values={p.form} height={16} />
            <span className="statmono text-[12px] text-ink-3">{num(p.season_avg)}</span>
          </dd>
        </div>
      </dl>

      <div className={`mt-3 flex ${out ? 'md:justify-end' : ''}`}>
        <MatchupPill
          opponent={p.opponent_code}
          isHome={p.is_home}
          score={p.matchup_score}
          teams={teams}
          size="sm"
        />
      </div>
    </div>
  );
}

function LockedSwap({
  swap,
  index
}: {
  swap: Extract<WireSwap, { locked: true }>;
  index: number;
}) {
  return (
    <li
      className="animate-rise overflow-hidden rounded-md border border-dashed border-line-2 bg-surface/60"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold tabular-nums text-ink-4">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="hatch h-10 w-10 rounded-full border border-line bg-elev" aria-hidden />
          <span className="text-[16px] text-ink-4" aria-hidden>
            →
          </span>
          <span className="hatch h-10 w-10 rounded-full border border-line bg-elev" aria-hidden />
          <div>
            <p className="text-[13px] font-semibold text-ink-2">
              Zamena na poziciji{' '}
              {swap.position ? POSITION_LABEL[swap.position].toLowerCase() : '—'}
            </p>
            <p className="text-[11.5px] text-ink-4">Imena i obrazlozenje su u placenom paketu</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Delta value={swap.projDelta} unit="FP" size="md" />
          <span className="statmono text-[12px] text-ink-4">{signed(swap.priceDelta)} kr</span>
        </div>
      </div>
    </li>
  );
}
