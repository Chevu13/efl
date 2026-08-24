import { NextResponse } from 'next/server';
import { getMyTier, getPricedPlayers } from '@/lib/data';
import { optimize } from '@/lib/optimizer';
import { OPTIMIZER_LIMIT, NEXT_TIER } from '@/lib/config';
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

const MAX_LINEUP = 20;

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

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    roundId?: number;
    ids?: unknown;
  };

  const roundId = Number(body.roundId);
  if (!roundId) return NextResponse.json({ error: 'Nedostaje kolo.' }, { status: 400 });

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, MAX_LINEUP)
    : [];

  if (!ids.length) {
    return NextResponse.json({ error: 'Postava je prazna.' }, { status: 400 });
  }

  const [{ tier }, pool] = await Promise.all([getMyTier(), getPricedPlayers(roundId)]);

  const result = optimize(ids, pool, { maxSwaps: 4 });
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
    violations: result.check.violations,

    /* Detalji — samo do granice paketa. Ostalo se ne salje uopste. */
    swaps: result.swaps.map((s, i) =>
      i < visible
        ? {
            locked: false as const,
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
            position: s.out.position,
            priceDelta: s.priceDelta,
            projDelta: s.projDelta
          }
    )
  });
}
