import { NextResponse } from 'next/server';
import { getCoaches, getMyTier, getPricedPlayers } from '@/lib/data';
import { optimize, roleLabel } from '@/lib/optimizer';
import { FORMATIONS, OPTIMIZER_LIMIT, NEXT_TIER } from '@/lib/config';
import { emptyLineup, type LineupState } from '@/lib/lineup';
import type { PricedPlayer, Tier } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Optimizacija postave.
 *
 * Racun se radi na serveru i tu se i secka po paketu. Klijent nikad ne
 * dobije podatke o zamenama koje nije platio — nema sta da se otkrije
 * gledanjem odgovora u konzoli.
 *
 * Ukupno poboljsanje se salje svima. To je jedini nacin da korisnik zna
 * vredi li mu paket, a i dalje ne otkriva koje su zamene u pitanju.
 */

const MAX = 12;

/** Sve sto interfejs treba za jednog igraca u preporuci. */
function lite(p: PricedPlayer) {
  return {
    id: p.id,
    short_name: p.short_name,
    full_name: p.full_name,
    photo: p.photo,
    team_code: p.team_code,
    position: p.position,
    jersey: p.jersey,
    price: p.price,
    projected: p.projected,
    value_score: p.value_score,
    matchup_score: p.matchup_score,
    opponent_code: p.opponent_code,
    is_home: p.is_home,
    season_avg: p.season_avg ?? null,
    minutes: p.minutes ?? null,
    form: p.form ?? null,
    status: p.status
  };
}

/** Cisti ono sto stigne iz pregledaca — nista se ne uzima na veru. */
function sanitize(body: unknown): LineupState | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;

  const ids = (x: unknown, max: number) =>
    Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string').slice(0, max) : [];

  const state: LineupState = {
    ...emptyLineup(),
    starters: ids(b.starters, 5),
    sixth: typeof b.sixth === 'string' ? b.sixth : null,
    bench: ids(b.bench, MAX),
    captain: typeof b.captain === 'string' ? b.captain : null,
    coach: typeof b.coach === 'string' ? b.coach : null,
    formation: FORMATIONS.some((f) => f.code === b.formation)
      ? (b.formation as LineupState['formation'])
      : '2-2-1'
  };

  const total = state.starters.length + (state.sixth ? 1 : 0) + state.bench.length;
  return total > 0 ? state : null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { roundId?: number; lineup?: unknown };

  const roundId = Number(body.roundId);
  if (!roundId) return NextResponse.json({ error: 'Nedostaje kolo.' }, { status: 400 });

  const state = sanitize(body.lineup);
  if (!state) return NextResponse.json({ error: 'Postava je prazna.' }, { status: 400 });

  const [{ tier }, pool, coaches] = await Promise.all([
    getMyTier(),
    getPricedPlayers(roundId),
    getCoaches(roundId)
  ]);

  const result = optimize(state, pool, coaches, { maxSwaps: 4 });
  const visible = OPTIMIZER_LIMIT[tier as Tier] ?? 1;

  return NextResponse.json({
    tier,
    /* Ukupni brojevi — vide se u svakom paketu. */
    currentTotal: result.currentTotal,
    optimizedTotal: result.optimizedTotal,
    improvement: result.improvement,
    currentSpent: result.currentSpent,
    optimizedSpent: result.optimizedSpent,
    remaining: result.remaining,
    budget: result.budget,
    totalFound: result.totalFound,
    lockedCount: Math.max(0, result.totalFound - visible),
    needTier: NEXT_TIER[tier as Tier],
    violations: result.violations,

    /* Promena kapitena je besplatna i vidi se svima — to je najbrza
       korist koju alat moze da ponudi. */
    captainMove: result.captainMove
      ? {
          from: lite(result.captainMove.from),
          to: lite(result.captainMove.to),
          gain: result.captainMove.gain
        }
      : null,

    /* Detalji zamena — samo do granice paketa. Ostalo se ne salje uopste. */
    swaps: result.swaps.map((s, i) =>
      i < visible
        ? {
            locked: false as const,
            role: s.role,
            roleLabel: roleLabel(s.role, s.isCaptain, s.out.position),
            isCaptain: s.isCaptain,
            position: s.out.position,
            priceDelta: s.priceDelta,
            projDelta: s.projDelta,
            headline: s.headline,
            reasons: s.reasons,
            out: lite(s.out),
            in: lite(s.in)
          }
        : {
            locked: true as const,
            role: s.role,
            roleLabel: roleLabel(s.role, s.isCaptain, s.out.position),
            position: s.out.position,
            priceDelta: s.priceDelta,
            projDelta: s.projDelta
          }
    )
  });
}
