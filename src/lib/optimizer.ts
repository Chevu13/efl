import { LINEUP, POSITION_LABEL } from './config';
import { matchupWord, num } from './format';
import {
  checkLineup,
  effectivePoints,
  resolveLineup,
  roleOf,
  scoreLineup,
  squadIds,
  type LineupState,
  type Role
} from './lineup';
import type { Coach, PricedPlayer } from './types';

/**
 * Optimizator postave.
 *
 * Namerno nije crna kutija. Radi kao pohlepna lokalna pretraga: u svakom
 * krugu proba svaku zamenu igrac-za-igraca koja postuje kvotu pozicija i
 * budzet, i uzima onu koja donosi najvise bodova.
 *
 * Vazno: racuna se ucinak NA MESTU u postavi, ne gola projekcija. Zamena
 * startera vredi punu razliku, zamena igraca sa klupe polovinu, a zamena
 * kapitena jedan i po put — pa optimizator sam od sebe prvo popravlja
 * mesta koja najvise nose.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

export type SwapReason = { label: string; detail: string };

export type Swap = {
  out: PricedPlayer;
  in: PricedPlayer;
  role: Role;
  isCaptain: boolean;
  /** Razlika u ceni: negativno = zamena oslobadja kredite. */
  priceDelta: number;
  /** Razlika u bodovima na tom mestu u postavi. */
  projDelta: number;
  reasons: SwapReason[];
  headline: string;
};

export type OptimizeResult = {
  currentTotal: number;
  optimizedTotal: number;
  improvement: number;
  currentSpent: number;
  optimizedSpent: number;
  remaining: number;
  budget: number;
  swaps: Swap[];
  totalFound: number;
  violations: string[];
  /** Predlog bolje kapitenske trake, ako postoji. */
  captainMove: { from: PricedPlayer; to: PricedPlayer; gain: number } | null;
};

/* ------------------------------------------------------------------ */

function buildReasons(out: PricedPlayer, inc: PricedPlayer, role: Role, isCaptain: boolean): SwapReason[] {
  const r: SwapReason[] = [];

  r.push({
    label: 'Projekcija',
    detail: `${num(inc.projected)} naspram ${num(out.projected)} fantasy poena u ovom kolu.`
  });

  if (role === 'bench') {
    r.push({
      label: 'Mesto u postavi',
      detail: `Igrac je na klupi, pa se racuna ${LINEUP.benchMultiplier * 100}% poena — razlika u bodovima je upola manja od razlike u projekciji.`
    });
  }
  if (isCaptain) {
    r.push({
      label: 'Kapitenska traka',
      detail: `Mesto nosi ${LINEUP.captainMultiplier}× poena, pa svaka razlika ovde vredi najvise.`
    });
  }

  const pd = r1((inc.price ?? 0) - (out.price ?? 0));
  r.push({
    label: 'Cena',
    detail:
      pd > 0
        ? `Kosta ${num(pd)} kredita vise — poeni to pokrivaju.`
        : pd < 0
          ? `Oslobadja ${num(Math.abs(pd))} kredita za ostatak postave.`
          : 'Ista cena, vise poena.'
  });

  if (inc.matchup_score != null && out.matchup_score != null) {
    const d = inc.matchup_score - out.matchup_score;
    if (Math.abs(d) >= 0.5) {
      r.push({
        label: 'Protivnik',
        detail: `${matchupWord(inc.matchup_score).toLowerCase()} mec (${num(inc.matchup_score)}) umesto ${matchupWord(out.matchup_score).toLowerCase()}g (${num(out.matchup_score)}).`
      });
    }
  }

  if (inc.season_avg != null && out.season_avg != null && Math.abs(inc.season_avg - out.season_avg) >= 1) {
    r.push({
      label: 'Forma',
      detail: `Prosek po utakmici ${num(inc.season_avg)} naspram ${num(out.season_avg)}.`
    });
  }

  if (inc.minutes != null && out.minutes != null && inc.minutes - out.minutes >= 2) {
    r.push({
      label: 'Minutaza',
      detail: `${num(inc.minutes)} minuta po utakmici, ${num(r1(inc.minutes - out.minutes))} vise od igraca koji izlazi.`
    });
  }

  if (out.status && out.status !== 'ok') {
    r.push({ label: 'Rizik', detail: `Igrac koji izlazi je oznacen kao ${out.status}.` });
  }

  return r;
}

function headlineFor(out: PricedPlayer, inc: PricedPlayer, delta: number, priceDelta: number, role: Role, isCaptain: boolean) {
  if (isCaptain) return `Jaci kapiten — ${num(delta)} bodova vise`;
  if (role === 'bench') return `Bolja klupa — ${num(delta)} bodova vise`;
  if (priceDelta < -0.4) return `${num(delta)} bodova vise i ${num(Math.abs(priceDelta))} kredita nazad`;
  if (inc.matchup_score != null && out.matchup_score != null && inc.matchup_score - out.matchup_score >= 2) {
    return `Znatno povoljniji protivnik uz ${num(delta)} bodova vise`;
  }
  return `${num(delta)} bodova vise za slicnu cenu`;
}

/* ------------------------------------------------------------------ */

export function optimize(
  state: LineupState,
  pool: PricedPlayer[],
  coaches: Coach[],
  opts: { maxSwaps?: number; budget?: number } = {}
): OptimizeResult {
  const maxSwaps = opts.maxSwaps ?? 4;
  const budget = opts.budget ?? LINEUP.budget;

  const players = new Map(pool.map((p) => [p.id, p]));
  const coachMap = new Map(coaches.map((c) => [c.id, c]));

  let current = state;
  const before = resolveLineup(current, players, coachMap);
  const currentTotal = scoreLineup(before).total;
  const currentSpent = checkLineup(current, before).spent;

  const swaps: Swap[] = [];

  for (let step = 0; step < maxSwaps; step++) {
    const resolved = resolveLineup(current, players, coachMap);
    const check = checkLineup(current, resolved);
    const inSquad = new Set(squadIds(current));

    let best: { out: PricedPlayer; in: PricedPlayer; gain: number; role: Role; captain: boolean } | null = null;

    for (const out of resolved.all) {
      const role = roleOf(current, out.id);
      if (!role) continue;
      const isCaptain = current.captain === out.id;
      const free = check.remaining + (out.price ?? 0);
      const outPts = effectivePoints(out, role, isCaptain);

      for (const cand of pool) {
        if (inSquad.has(cand.id)) continue;
        /* Pozicija mora da ostane ista — inace se rusi kvota 4/4/2. */
        if (cand.position !== out.position) continue;
        if ((cand.price ?? 0) > free + 1e-9) continue;

        const gain = effectivePoints(cand, role, isCaptain) - outPts;
        if (gain <= 0.05) continue;
        if (!best || gain > best.gain) {
          best = { out, in: cand, gain, role, captain: isCaptain };
        }
      }
    }

    if (!best) break;

    const priceDelta = r1((best.in.price ?? 0) - (best.out.price ?? 0));
    const projDelta = r1(best.gain);

    swaps.push({
      out: best.out,
      in: best.in,
      role: best.role,
      isCaptain: best.captain,
      priceDelta,
      projDelta,
      reasons: buildReasons(best.out, best.in, best.role, best.captain),
      headline: headlineFor(best.out, best.in, projDelta, priceDelta, best.role, best.captain)
    });

    /* Novi igrac preuzima tacno mesto onog koji izlazi. */
    const swapId = (id: string) => (id === best!.out.id ? best!.in.id : id);
    current = {
      ...current,
      starters: current.starters.map(swapId),
      sixth: current.sixth ? swapId(current.sixth) : null,
      bench: current.bench.map(swapId),
      captain: current.captain ? swapId(current.captain) : null
    };
  }

  /* Kapitenska traka je besplatna promena — proveri je posebno. */
  const afterSwaps = resolveLineup(current, players, coachMap);
  let captainMove: OptimizeResult['captainMove'] = null;
  const bestCaptain = [...afterSwaps.starters].sort(
    (a, b) => (b.projected ?? 0) - (a.projected ?? 0)
  )[0];
  const nowCaptain = afterSwaps.starters.find((p) => p.id === current.captain);

  if (bestCaptain && nowCaptain && bestCaptain.id !== nowCaptain.id) {
    const gain = r1(
      ((bestCaptain.projected ?? 0) - (nowCaptain.projected ?? 0)) * (LINEUP.captainMultiplier - 1)
    );
    if (gain > 0.05) {
      captainMove = { from: nowCaptain, to: bestCaptain, gain };
      current = { ...current, captain: bestCaptain.id };
    }
  }

  const after = resolveLineup(current, players, coachMap);
  const finalCheck = checkLineup(current, after);
  const optimizedTotal = scoreLineup(after).total;

  return {
    currentTotal,
    optimizedTotal,
    improvement: r1(optimizedTotal - currentTotal),
    currentSpent,
    optimizedSpent: finalCheck.spent,
    remaining: finalCheck.remaining,
    budget,
    swaps,
    totalFound: swaps.length,
    violations: finalCheck.violations,
    captainMove
  };
}

/** Naziv uloge za prikaz uz preporuku. */
export const roleLabel = (role: Role, isCaptain: boolean, position: string | null) => {
  if (isCaptain) return 'Kapiten';
  const base = role === 'starter' ? 'Prva petorka' : role === 'sixth' ? 'Sesti igrac' : 'Klupa';
  return position ? `${base} · ${POSITION_LABEL[position as 'G' | 'F' | 'C']}` : base;
};
