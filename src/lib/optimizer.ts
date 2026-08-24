import { LINEUP, POSITION_LABEL } from './config';
import { matchupWord, num } from './format';
import type { Position, PricedPlayer } from './types';

/**
 * Optimizator postave.
 *
 * Namerno nije crna kutija. Radi kao pohlepna lokalna pretraga: u svakom
 * krugu proba svaku moguću zamenu igrač-za-igrača koja postuje pravila
 * sastava i budzet, i uzima onu koja donosi najvise projektovanih poena.
 * Zaustavlja se kad vise nema poboljsanja.
 *
 * Zato svaka preporuka ima objasnjenje izvedeno iz istih brojeva koje
 * korisnik vidi u tabeli — a ne iz nekog skrivenog modela.
 */

/* ------------------------------------------------------------------ */
/* PROVERA SASTAVA                                                     */
/* ------------------------------------------------------------------ */

export type LineupCheck = {
  valid: boolean;
  violations: string[];
  spent: number;
  remaining: number;
  projected: number;
  byPosition: Record<Position, number>;
  byTeam: Record<string, number>;
};

export function checkLineup(players: PricedPlayer[]): LineupCheck {
  const violations: string[] = [];

  const spent = round1(players.reduce((s, p) => s + (p.price ?? 0), 0));
  const projected = round1(players.reduce((s, p) => s + (p.projected ?? 0), 0));

  const byPosition: Record<Position, number> = { G: 0, F: 0, C: 0 };
  const byTeam: Record<string, number> = {};

  for (const p of players) {
    if (p.position) byPosition[p.position]++;
    if (p.team_code) byTeam[p.team_code] = (byTeam[p.team_code] ?? 0) + 1;
  }

  if (players.length > LINEUP.size) {
    violations.push(`Postava ima ${players.length} igraca, dozvoljeno je ${LINEUP.size}.`);
  }
  if (spent > LINEUP.budget) {
    violations.push(`Budzet je prekoracen za ${num(spent - LINEUP.budget)} kredita.`);
  }

  /* Pravila pozicija vaze tek kad je postava puna — dok se sastavlja
     nema smisla vikati na korisnika da mu fali centar. */
  if (players.length === LINEUP.size) {
    (Object.keys(LINEUP.positions) as Position[]).forEach((pos) => {
      const [min, max] = LINEUP.positions[pos];
      const n = byPosition[pos];
      if (n < min) violations.push(`Fali ${min - n} × ${POSITION_LABEL[pos].toLowerCase()}.`);
      if (n > max) violations.push(`Previse igraca na poziciji ${pos} (${n}, najvise ${max}).`);
    });
  }

  Object.entries(byTeam).forEach(([code, n]) => {
    if (n > LINEUP.maxPerTeam) {
      violations.push(`${n} igraca iz istog tima (${code.toUpperCase()}) — najvise ${LINEUP.maxPerTeam}.`);
    }
  });

  return {
    valid: violations.length === 0,
    violations,
    spent,
    remaining: round1(LINEUP.budget - spent),
    projected,
    byPosition,
    byTeam
  };
}

/* ------------------------------------------------------------------ */
/* PREPORUKA ZAMENE                                                    */
/* ------------------------------------------------------------------ */

export type SwapReason = { label: string; detail: string };

export type Swap = {
  out: PricedPlayer;
  in: PricedPlayer;
  /** Razlika u ceni: negativno = zamena oslobadja kredite. */
  priceDelta: number;
  /** Razlika u projekciji: uvek pozitivna, inace se zamena ne predlaze. */
  projDelta: number;
  reasons: SwapReason[];
  /** Kratka recenica koja stoji kao naslov preporuke. */
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
  /** Koliko zamena je ukupno nadjeno, i pre nego sto se lista skrati po paketu. */
  totalFound: number;
  check: LineupCheck;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Da li kandidat sme u postavu bez krsenja pravila o broju iz istog tima. */
function teamOk(lineup: PricedPlayer[], out: PricedPlayer, cand: PricedPlayer) {
  if (!cand.team_code) return true;
  const n = lineup.filter(
    (p) => p.id !== out.id && p.team_code === cand.team_code
  ).length;
  return n < LINEUP.maxPerTeam;
}

function buildReasons(out: PricedPlayer, inc: PricedPlayer): SwapReason[] {
  const r: SwapReason[] = [];

  r.push({
    label: 'Projekcija',
    detail: `${num(inc.projected)} naspram ${num(out.projected)} fantasy poena u ovom kolu.`
  });

  const pd = round1((inc.price ?? 0) - (out.price ?? 0));
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
    const better = inc.matchup_score - out.matchup_score;
    if (Math.abs(better) >= 0.5) {
      r.push({
        label: 'Protivnik',
        detail: `${matchupWord(inc.matchup_score).toLowerCase()} mec (${num(inc.matchup_score)}) umesto ${matchupWord(out.matchup_score).toLowerCase()}g (${num(out.matchup_score)}).`
      });
    }
  }

  if (inc.season_avg != null && out.season_avg != null) {
    const d = round1(inc.season_avg - out.season_avg);
    if (Math.abs(d) >= 1) {
      r.push({
        label: 'Forma',
        detail: `Prosek poslednjih pet kola ${num(inc.season_avg)} naspram ${num(out.season_avg)}.`
      });
    }
  }

  if (inc.minutes != null && out.minutes != null) {
    const d = round1(inc.minutes - out.minutes);
    if (d >= 2) {
      r.push({
        label: 'Minutaza',
        detail: `${num(inc.minutes)} minuta po utakmici, ${num(d)} vise od igraca koji izlazi.`
      });
    }
  }

  if (inc.value_score != null && out.value_score != null) {
    r.push({
      label: 'Vrednost',
      detail: `Ocena vrednosti ${num(inc.value_score)} naspram ${num(out.value_score)}.`
    });
  }

  if (out.status && out.status !== 'ok') {
    r.push({
      label: 'Rizik',
      detail: `Igrac koji izlazi je oznacen kao ${out.status}.`
    });
  }

  return r;
}

function headlineFor(out: PricedPlayer, inc: PricedPlayer, projDelta: number, priceDelta: number) {
  if (priceDelta < -0.4) {
    return `${num(projDelta)} poena vise i ${num(Math.abs(priceDelta))} kredita nazad`;
  }
  if (inc.matchup_score != null && out.matchup_score != null && inc.matchup_score - out.matchup_score >= 2) {
    return `Znatno povoljniji protivnik uz ${num(projDelta)} poena vise`;
  }
  if (inc.season_avg != null && out.season_avg != null && inc.season_avg - out.season_avg >= 3) {
    return `Bolja forma i ${num(projDelta)} projektovanih poena vise`;
  }
  return `${num(projDelta)} projektovanih poena vise za slicnu cenu`;
}

/* ------------------------------------------------------------------ */
/* GLAVNI POZIV                                                        */
/* ------------------------------------------------------------------ */

export function optimize(
  lineupIds: string[],
  pool: PricedPlayer[],
  opts: { maxSwaps?: number; budget?: number } = {}
): OptimizeResult {
  const maxSwaps = opts.maxSwaps ?? 4;
  const budget = opts.budget ?? LINEUP.budget;

  const byId = new Map(pool.map((p) => [p.id, p]));
  let lineup = lineupIds.map((id) => byId.get(id)).filter(Boolean) as PricedPlayer[];

  const currentTotal = round1(lineup.reduce((s, p) => s + (p.projected ?? 0), 0));
  const currentSpent = round1(lineup.reduce((s, p) => s + (p.price ?? 0), 0));

  const swaps: Swap[] = [];
  const used = new Set(lineup.map((p) => p.id));

  for (let step = 0; step < maxSwaps; step++) {
    const spent = lineup.reduce((s, p) => s + (p.price ?? 0), 0);
    let best: { out: PricedPlayer; in: PricedPlayer; gain: number } | null = null;

    for (const out of lineup) {
      const free = budget - spent + (out.price ?? 0);

      for (const cand of pool) {
        if (used.has(cand.id)) continue;
        if (cand.position !== out.position) continue; // pozicije ostaju netaknute
        if ((cand.price ?? 0) > free + 1e-9) continue;
        if (!teamOk(lineup, out, cand)) continue;

        const gain = (cand.projected ?? 0) - (out.projected ?? 0);
        if (gain <= 0.05) continue;
        if (!best || gain > best.gain) best = { out, in: cand, gain };
      }
    }

    if (!best) break;

    const priceDelta = round1((best.in.price ?? 0) - (best.out.price ?? 0));
    const projDelta = round1(best.gain);

    swaps.push({
      out: best.out,
      in: best.in,
      priceDelta,
      projDelta,
      reasons: buildReasons(best.out, best.in),
      headline: headlineFor(best.out, best.in, projDelta, priceDelta)
    });

    lineup = lineup.map((p) => (p.id === best!.out.id ? best!.in : p));
    used.delete(best.out.id);
    used.add(best.in.id);
  }

  const optimizedTotal = round1(lineup.reduce((s, p) => s + (p.projected ?? 0), 0));
  const optimizedSpent = round1(lineup.reduce((s, p) => s + (p.price ?? 0), 0));

  return {
    currentTotal,
    optimizedTotal,
    improvement: round1(optimizedTotal - currentTotal),
    currentSpent,
    optimizedSpent,
    remaining: round1(budget - optimizedSpent),
    budget,
    swaps,
    totalFound: swaps.length,
    check: checkLineup(lineup)
  };
}

/* ------------------------------------------------------------------ */
/* AUTOMATSKA POSTAVA                                                  */
/* ------------------------------------------------------------------ */

/**
 * Predlog pocetne postave. Prvo popuni minimum po pozicijama najboljom
 * vrednoscu, pa preostala mesta popuni najvecom projekcijom koju budzet
 * jos podnosi. Sluzi kao polazna tacka, ne kao konacan odgovor.
 */
export function suggestLineup(pool: PricedPlayer[], budget = LINEUP.budget): PricedPlayer[] {
  const picked: PricedPlayer[] = [];
  const teamCount: Record<string, number> = {};

  const canAdd = (p: PricedPlayer, spent: number) => {
    if (picked.some((x) => x.id === p.id)) return false;
    if ((p.price ?? 0) + spent > budget) return false;
    if (p.team_code && (teamCount[p.team_code] ?? 0) >= LINEUP.maxPerTeam) return false;
    return true;
  };

  const add = (p: PricedPlayer) => {
    picked.push(p);
    if (p.team_code) teamCount[p.team_code] = (teamCount[p.team_code] ?? 0) + 1;
  };

  const byValue = [...pool].sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0));

  /* 1) minimum po pozicijama */
  (Object.keys(LINEUP.positions) as Position[]).forEach((pos) => {
    const [min] = LINEUP.positions[pos];
    for (const p of byValue) {
      if (picked.filter((x) => x.position === pos).length >= min) break;
      if (p.position !== pos) continue;
      const spent = picked.reduce((s, x) => s + (x.price ?? 0), 0);
      if (canAdd(p, spent)) add(p);
    }
  });

  /* 2) ostatak — najveca projekcija koju budzet podnosi */
  const byProjected = [...pool].sort((a, b) => (b.projected ?? 0) - (a.projected ?? 0));
  for (const p of byProjected) {
    if (picked.length >= LINEUP.size) break;
    if (!p.position) continue;
    const [, max] = LINEUP.positions[p.position];
    if (picked.filter((x) => x.position === p.position).length >= max) continue;

    /* Ostaviti dovoljno kredita da se preostala mesta uopste mogu popuniti. */
    const spent = picked.reduce((s, x) => s + (x.price ?? 0), 0);
    const slotsLeftAfter = LINEUP.size - picked.length - 1;
    const cheapest = Math.min(...pool.map((x) => x.price ?? 0));
    if (spent + (p.price ?? 0) + slotsLeftAfter * cheapest > budget) continue;

    if (canAdd(p, spent)) add(p);
  }

  /* 3) ako je jos prazno, popuni najjeftinijim sto uklapa pravila */
  const cheapFirst = [...pool].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  for (const p of cheapFirst) {
    if (picked.length >= LINEUP.size) break;
    if (!p.position) continue;
    const [, max] = LINEUP.positions[p.position];
    if (picked.filter((x) => x.position === p.position).length >= max) continue;
    const spent = picked.reduce((s, x) => s + (x.price ?? 0), 0);
    if (canAdd(p, spent)) add(p);
  }

  return picked;
}
