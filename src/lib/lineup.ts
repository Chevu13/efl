import {
  FORMATIONS,
  LINEUP,
  POSITION_LABEL,
  formationByCode,
  type FormationCode
} from './config';
import { num } from './format';
import type { Coach, Position, PricedPlayer } from './types';

/**
 * Postava po zvanicnim pravilima EuroLeague Fantasy takmicenja.
 *
 * Kadar je uvek 4 beka, 4 krila, 2 centra i trener. Od tih deset igraca
 * petorka izlazi na teren po jednoj od dozvoljenih formacija, jedan je
 * kapiten, jedan je sesti igrac, a cetvorica su na klupi.
 *
 * Bodovanje:
 *   petorka       100%   (kapiten 150%)
 *   sesti igrac   100%
 *   klupa          50%
 *   trener        100%
 */

/* ------------------------------------------------------------------ */
/* STANJE                                                              */
/* ------------------------------------------------------------------ */

export type LineupState = {
  /** Id-jevi prve petorke, redosled prati formaciju. */
  starters: string[];
  sixth: string | null;
  bench: string[];
  /** Mora biti neko iz prve petorke. */
  captain: string | null;
  coach: string | null;
  formation: FormationCode;
};

export const emptyLineup = (): LineupState => ({
  starters: [],
  sixth: null,
  bench: [],
  captain: null,
  coach: null,
  formation: '2-2-1'
});

/** Svi igraci u kadru, bez obzira na ulogu. */
export const squadIds = (s: LineupState): string[] =>
  [...s.starters, ...(s.sixth ? [s.sixth] : []), ...s.bench];

export type Role = 'starter' | 'sixth' | 'bench';

export const roleOf = (s: LineupState, id: string): Role | null =>
  s.starters.includes(id) ? 'starter' : s.sixth === id ? 'sixth' : s.bench.includes(id) ? 'bench' : null;

/* ------------------------------------------------------------------ */
/* RAZRESAVANJE                                                        */
/* ------------------------------------------------------------------ */

export type ResolvedLineup = {
  starters: PricedPlayer[];
  sixth: PricedPlayer | null;
  bench: PricedPlayer[];
  captain: PricedPlayer | null;
  coach: Coach | null;
  /** Svi igraci u kadru. */
  all: PricedPlayer[];
  formation: ReturnType<typeof formationByCode>;
};

export function resolveLineup(
  state: LineupState,
  players: Map<string, PricedPlayer>,
  coaches: Map<string, Coach>
): ResolvedLineup {
  const get = (id: string | null) => (id ? (players.get(id) ?? null) : null);
  const list = (ids: string[]) => ids.map((id) => players.get(id)).filter(Boolean) as PricedPlayer[];

  const starters = list(state.starters);
  const sixth = get(state.sixth);
  const bench = list(state.bench);

  return {
    starters,
    sixth,
    bench,
    captain: get(state.captain),
    coach: state.coach ? (coaches.get(state.coach) ?? null) : null,
    all: [...starters, ...(sixth ? [sixth] : []), ...bench],
    formation: formationByCode(state.formation)
  };
}

/* ------------------------------------------------------------------ */
/* BODOVANJE                                                           */
/* ------------------------------------------------------------------ */

export type Score = {
  total: number;
  starters: number;
  captainBonus: number;
  sixth: number;
  bench: number;
  coach: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function scoreLineup(r: ResolvedLineup, captainId?: string | null): Score {
  const cap = captainId ?? r.captain?.id ?? null;

  const startersPts = r.starters.reduce((s, p) => s + (p.projected ?? 0), 0);
  const capPlayer = r.starters.find((p) => p.id === cap);
  const captainBonus = capPlayer
    ? (capPlayer.projected ?? 0) * (LINEUP.captainMultiplier - 1)
    : 0;

  const sixthPts = r.sixth?.projected ?? 0;
  const benchPts = r.bench.reduce((s, p) => s + (p.projected ?? 0), 0) * LINEUP.benchMultiplier;
  const coachPts = r.coach?.projected ?? 0;

  return {
    starters: r1(startersPts),
    captainBonus: r1(captainBonus),
    sixth: r1(sixthPts),
    bench: r1(benchPts),
    coach: r1(coachPts),
    total: r1(startersPts + captainBonus + sixthPts + benchPts + coachPts)
  };
}

/** Koliko poena jedan igrac stvarno donosi na svom mestu u postavi. */
export function effectivePoints(
  p: PricedPlayer,
  role: Role,
  isCaptain: boolean
): number {
  const base = p.projected ?? 0;
  if (role === 'bench') return r1(base * LINEUP.benchMultiplier);
  if (role === 'starter' && isCaptain) return r1(base * LINEUP.captainMultiplier);
  return r1(base);
}

/* ------------------------------------------------------------------ */
/* PROVERA                                                             */
/* ------------------------------------------------------------------ */

export type LineupCheck = {
  valid: boolean;
  violations: string[];
  spent: number;
  remaining: number;
  squad: Record<Position, number>;
  startersByPos: Record<Position, number>;
  complete: boolean;
};

export function checkLineup(state: LineupState, r: ResolvedLineup): LineupCheck {
  const violations: string[] = [];

  const spent = r1(
    r.all.reduce((s, p) => s + (p.price ?? 0), 0) + (r.coach?.price ?? 0)
  );

  const squad: Record<Position, number> = { G: 0, F: 0, C: 0 };
  r.all.forEach((p) => {
    if (p.position) squad[p.position]++;
  });

  const startersByPos: Record<Position, number> = { G: 0, F: 0, C: 0 };
  r.starters.forEach((p) => {
    if (p.position) startersByPos[p.position]++;
  });

  const complete =
    r.all.length === LINEUP.size &&
    r.starters.length === LINEUP.starters &&
    !!r.sixth &&
    r.bench.length === LINEUP.bench &&
    !!r.coach;

  if (spent > LINEUP.budget) {
    violations.push(`Budzet je prekoracen za ${num(spent - LINEUP.budget)} kredita.`);
  }

  /* Sastav kadra se proverava tek kad je pun — dok se bira nema smisla
     prigovarati sto jos fali centar. */
  if (r.all.length === LINEUP.size) {
    (Object.keys(LINEUP.squad) as Position[]).forEach((pos) => {
      const need = LINEUP.squad[pos];
      if (squad[pos] !== need) {
        violations.push(
          `Kadar mora imati tacno ${need} × ${POSITION_LABEL[pos].toLowerCase()} (imas ${squad[pos]}).`
        );
      }
    });
  }

  if (r.starters.length === LINEUP.starters) {
    (Object.keys(startersByPos) as Position[]).forEach((pos) => {
      const need = r.formation[pos];
      if (startersByPos[pos] !== need) {
        violations.push(
          `Formacija ${r.formation.code} trazi ${need} × ${POSITION_LABEL[pos].toLowerCase()} u petorci.`
        );
      }
    });
  }

  if (complete && !state.captain) {
    violations.push('Nije izabran kapiten.');
  }
  if (state.captain && !r.starters.some((p) => p.id === state.captain)) {
    violations.push('Kapiten mora biti iz prve petorke.');
  }

  return {
    valid: violations.length === 0 && complete,
    violations,
    spent,
    remaining: r1(LINEUP.budget - spent),
    squad,
    startersByPos,
    complete
  };
}

/* ------------------------------------------------------------------ */
/* GDE IGRAC MOZE                                                      */
/* ------------------------------------------------------------------ */

/** Da li u petorci ima jos mesta za tu poziciju po trenutnoj formaciji. */
export function starterSlotFree(state: LineupState, r: ResolvedLineup, pos: Position): boolean {
  if (r.starters.length >= LINEUP.starters) return false;
  const used = r.starters.filter((p) => p.position === pos).length;
  return used < r.formation[pos];
}

/** Da li kadar jos prima igraca te pozicije. */
export function squadSlotFree(r: ResolvedLineup, pos: Position): boolean {
  const used = r.all.filter((p) => p.position === pos).length;
  return used < LINEUP.squad[pos];
}

/**
 * Ubacuje igraca na prvo mesto koje mu odgovara: prvo petorka, pa sesti
 * igrac, pa klupa. Ako kadar vec ima dovoljno igraca te pozicije, vraca
 * stanje nepromenjeno — pravila su tvrda granica, ne predlog.
 */
export function addPlayer(
  state: LineupState,
  r: ResolvedLineup,
  player: PricedPlayer
): LineupState {
  if (!player.position) return state;
  if (squadIds(state).includes(player.id)) return state;
  if (!squadSlotFree(r, player.position)) return state;

  if (starterSlotFree(state, r, player.position)) {
    const starters = [...state.starters, player.id];
    return {
      ...state,
      starters,
      /* Prvi ubaceni igrac je automatski kapiten — jedan klik manje, a
         kapiten se posle menja jednim dugmetom. */
      captain: state.captain ?? player.id
    };
  }

  if (!state.sixth) return { ...state, sixth: player.id };
  if (state.bench.length < LINEUP.bench) {
    return { ...state, bench: [...state.bench, player.id] };
  }
  return state;
}

export function removePlayer(state: LineupState, id: string): LineupState {
  const next: LineupState = {
    ...state,
    starters: state.starters.filter((x) => x !== id),
    sixth: state.sixth === id ? null : state.sixth,
    bench: state.bench.filter((x) => x !== id),
    captain: state.captain === id ? null : state.captain
  };
  /* Kapiten mora da ostane u petorci. */
  if (next.captain && !next.starters.includes(next.captain)) next.captain = next.starters[0] ?? null;
  return next;
}

/** Vraca igraca iz klupe ili sa mesta sestog u prvu petorku. */
export function promote(state: LineupState, r: ResolvedLineup, id: string): LineupState {
  const player = r.all.find((p) => p.id === id);
  if (!player?.position) return state;
  if (state.starters.includes(id)) return state;
  if (!starterSlotFree(state, r, player.position)) return state;

  return {
    ...state,
    starters: [...state.starters, id],
    sixth: state.sixth === id ? null : state.sixth,
    bench: state.bench.filter((x) => x !== id),
    captain: state.captain ?? id
  };
}

/** Salje startera na klupu ili na mesto sestog igraca. */
export function demote(state: LineupState, id: string, to: 'sixth' | 'bench'): LineupState {
  if (!state.starters.includes(id)) return state;

  let next: LineupState = {
    ...state,
    starters: state.starters.filter((x) => x !== id),
    captain: state.captain === id ? null : state.captain
  };

  if (to === 'sixth') {
    /* Mesto sestog je zauzeto — dotadasnji sesti ide na klupu. */
    const previous = next.sixth;
    next = { ...next, sixth: id };
    if (previous && next.bench.length < LINEUP.bench) {
      next = { ...next, bench: [...next.bench, previous] };
    }
  } else if (next.bench.length < LINEUP.bench) {
    next = { ...next, bench: [...next.bench, id] };
  } else if (!next.sixth) {
    next = { ...next, sixth: id };
  } else {
    return state; // nema gde
  }

  if (!next.captain) next.captain = next.starters[0] ?? null;
  return next;
}

export const setCaptain = (state: LineupState, id: string): LineupState =>
  state.starters.includes(id) ? { ...state, captain: id } : state;

/**
 * Menja formaciju.
 *
 * Kadar ostaje isti — menja se samo ko je u petorci. Zato se uloge
 * dodeljuju iznova iz celog kadra, umesto da se visak redom spusta na
 * klupu: kad se ide sa tri beka na jednog, klupa i mesto sestog su vec
 * puni, pa bi igraci koji ne stanu tiho ispali iz tima.
 */
export function setFormation(
  state: LineupState,
  r: ResolvedLineup,
  code: FormationCode
): LineupState {
  const target = formationByCode(code);
  const used: Record<Position, number> = { G: 0, F: 0, C: 0 };

  /* 1) Zadrzi startere koje nova formacija jos prima. */
  const keep: PricedPlayer[] = [];
  const spare: PricedPlayer[] = [];

  r.starters.forEach((p) => {
    if (p.position && used[p.position] < target[p.position]) {
      used[p.position]++;
      keep.push(p);
    } else {
      spare.push(p);
    }
  });

  /* 2) Ostatak kadra ide u isti bazen kandidata za prazna mesta. */
  const previousSixth = r.sixth;
  if (r.sixth) spare.push(r.sixth);
  spare.push(...r.bench);

  /* 3) Popuni preostala mesta u petorci — najboljom projekcijom. */
  const byProjected = [...spare].sort((a, b) => (b.projected ?? 0) - (a.projected ?? 0));
  const promoted = new Set<string>();

  for (const p of byProjected) {
    if (keep.length >= LINEUP.starters) break;
    if (!p.position) continue;
    if (used[p.position] >= target[p.position]) continue;
    used[p.position]++;
    keep.push(p);
    promoted.add(p.id);
  }

  /* 4) Ko nije u petorci — sesti igrac pa klupa. Raniji sesti zadrzava
        mesto ako i dalje nije u petorci. */
  const rest = spare.filter((p) => !promoted.has(p.id));
  const sixth =
    previousSixth && rest.some((p) => p.id === previousSixth.id)
      ? previousSixth
      : (rest[0] ?? null);
  const bench = rest.filter((p) => p.id !== sixth?.id).slice(0, LINEUP.bench);

  const starters = keep.map((p) => p.id);
  const captain =
    state.captain && starters.includes(state.captain) ? state.captain : (starters[0] ?? null);

  return {
    ...state,
    formation: code,
    starters,
    sixth: sixth?.id ?? null,
    bench: bench.map((p) => p.id),
    captain
  };
}

/* ------------------------------------------------------------------ */
/* AUTOMATSKA POSTAVA                                                  */
/* ------------------------------------------------------------------ */

/**
 * Predlog kadra i postave.
 *
 * Bira formaciju koja daje najvise bodova, popunjava kadar po vrednosti
 * unutar budzeta i kapitensku traku daje najboljoj projekciji u petorci.
 * Sluzi kao polazna tacka, ne kao konacan odgovor.
 */
export function autoBuild(
  pool: PricedPlayer[],
  coaches: Coach[],
  budget = LINEUP.budget
): LineupState {
  const best = { state: emptyLineup(), score: -1 };

  for (const formation of FORMATIONS) {
    const state = buildFor(formation.code, pool, coaches, budget);
    const players = new Map(pool.map((p) => [p.id, p]));
    const coachMap = new Map(coaches.map((c) => [c.id, c]));
    const resolved = resolveLineup(state, players, coachMap);
    const check = checkLineup(state, resolved);
    if (!check.complete || check.spent > budget) continue;

    const score = scoreLineup(resolved).total;
    if (score > best.score) {
      best.score = score;
      best.state = state;
    }
  }

  return best.score > 0 ? best.state : buildFor('2-2-1', pool, coaches, budget);
}

/**
 * Sastavlja kadar za jednu formaciju, uvek unutar budzeta.
 *
 * Ide obrnuto od ocekivanog: prvo napravi najjeftiniji moguci kadar koji
 * postuje kvote, pa ga onda nadogradjuje zamenama dokle god ima kredita.
 * Tako je svaki medjukorak validan — ranija verzija je birala najbolje
 * igrace pa tek na kraju otkrivala da je probila budzet.
 */
function buildFor(
  code: FormationCode,
  pool: PricedPlayer[],
  coaches: Coach[],
  budget: number
): LineupState {
  const formation = formationByCode(code);
  const priceOf = (p: PricedPlayer) => p.price ?? 0;

  /* Trener uzima svoj deo pre igraca — najbolja projekcija koja staje
     u razuman deo budzeta, da ne pojede kadar. */
  const coachCap = budget * 0.12;
  const coach =
    [...coaches].filter((c) => c.price <= coachCap).sort((a, b) => b.projected - a.projected)[0] ??
    [...coaches].sort((a, b) => a.price - b.price)[0] ??
    null;

  let spent = coach?.price ?? 0;

  /* 1) Najjeftiniji kadar koji postuje kvote 4/4/2. */
  const squad: PricedPlayer[] = [];
  (Object.keys(LINEUP.squad) as Position[]).forEach((pos) => {
    const cheapest = pool
      .filter((p) => p.position === pos)
      .sort((a, b) => priceOf(a) - priceOf(b))
      .slice(0, LINEUP.squad[pos]);
    cheapest.forEach((p) => {
      squad.push(p);
      spent += priceOf(p);
    });
  });

  /* 2) Nadogradnja: najisplativija zamena koja jos staje u budzet. */
  const inSquad = new Set(squad.map((p) => p.id));

  for (let step = 0; step < 40; step++) {
    let best: { outIdx: number; in: PricedPlayer; gain: number } | null = null;

    squad.forEach((out, idx) => {
      const free = budget - spent + priceOf(out);
      for (const cand of pool) {
        if (inSquad.has(cand.id)) continue;
        if (cand.position !== out.position) continue;
        if (priceOf(cand) > free + 1e-9) continue;
        const gain = (cand.projected ?? 0) - (out.projected ?? 0);
        if (gain <= 0.05) continue;
        if (!best || gain > best.gain) best = { outIdx: idx, in: cand, gain };
      }
    });

    if (!best) break;
    const chosen = best as { outIdx: number; in: PricedPlayer; gain: number };
    const out = squad[chosen.outIdx];
    spent = spent - priceOf(out) + priceOf(chosen.in);
    inSquad.delete(out.id);
    inSquad.add(chosen.in.id);
    squad[chosen.outIdx] = chosen.in;
  }

  /* 3) Uloge: najbolja projekcija ide u petorku, koliko formacija pusta. */
  const byProjected = [...squad].sort((a, b) => (b.projected ?? 0) - (a.projected ?? 0));
  const used: Record<Position, number> = { G: 0, F: 0, C: 0 };
  const starters: PricedPlayer[] = [];
  const restPool: PricedPlayer[] = [];

  for (const p of byProjected) {
    if (p.position && starters.length < LINEUP.starters && used[p.position] < formation[p.position]) {
      used[p.position]++;
      starters.push(p);
    } else {
      restPool.push(p);
    }
  }

  return {
    formation: code,
    starters: starters.map((p) => p.id),
    /* Sesti igrac nosi pune poene, pa tu ide najbolji preostali. */
    sixth: restPool[0]?.id ?? null,
    bench: restPool.slice(1, 1 + LINEUP.bench).map((p) => p.id),
    captain: starters[0]?.id ?? null,
    coach: coach?.id ?? null
  };
}
