/**
 * Walk-forward backtest modela za projekciju fantasy poena.
 *
 * Protokol je namerno strog i prati stvarni tok sezone:
 *
 *   za svakog igraca, za svaku utakmicu t >= 11:
 *     1. napravi obelezja ISKLJUCIVO iz utakmica pre t
 *     2. istreniraj model na svim parovima (igrac, utakmica) pre datuma t
 *     3. predvidi utakmicu t
 *     4. uporedi sa stvarnim ishodom
 *     5. utakmica t ulazi u trening za t+1
 *
 * Nijedan podatak iz buducnosti ne ulazi u obelezja — ni igracev, ni
 * protivnikov. To je jedina provera koja govori nesto o stvarnoj
 * upotrebi, jer u kolu koje dolazi buducnost ni ne postoji.
 *
 * Pokretanje:
 *   node scripts/model-backtest.mjs
 *   node scripts/model-backtest.mjs --players 10 --season 2025 --min-start 10
 */

import { createClient } from '@supabase/supabase-js';
import { EuroleagueClient } from 'euroleague-api';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/* ------------------------------------------------------------------ */
/* okruzenje                                                           */
/* ------------------------------------------------------------------ */

const ENV = ['.env.local', '.env'].find((f) => existsSync(f));
let txt = await readFile(ENV, 'utf8');
if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
for (const r of txt.split(/\r?\n/)) {
  const l = r.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 1) continue;
  const v = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  if (v) process.env[l.slice(0, i).trim()] ??= v;
}

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

/* Test se uvek radi na POSLEDNJOJ sezoni; ranije sluze samo za trening
   i za obelezja „kakav je bio prosle sezone". */
const SEASONS = String(flag('seasons', '2025'))
  .split(',')
  .map((x) => Number(x.trim()))
  .filter(Boolean)
  .sort((a, b) => a - b);
const SEASON = SEASONS[SEASONS.length - 1];
const PRIOR = SEASONS.slice(0, -1);
const N_PLAYERS = Number(flag('players', 10));
const MIN_START = Number(flag('min-start', 10)); // prvih N utakmica samo za ucenje

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const log = (...a) => console.log(...a);
const head = (t) => log('\n' + '='.repeat(72) + '\n' + t + '\n' + '='.repeat(72));
const f1 = (n) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(1));
const f2 = (n) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(2));

/* ------------------------------------------------------------------ */
/* 1. POZICIJE — treba nam pozicija SVAKOG igraca lige, ne samo nasih  */
/* ------------------------------------------------------------------ */

async function loadPositions(year) {
  const cacheDir = '.cache';
  const cacheFile = `${cacheDir}/positions-${year}.json`;
  if (existsSync(cacheFile)) {
    return new Map(Object.entries(JSON.parse(await readFile(cacheFile, 'utf8'))));
  }

  log('preuzimam pozicije iz rostera (jednom, pa se kesira)…');
  const el = new EuroleagueClient({
    competition: 'euroleague',
    retries: 4,
    retry: { baseDelayMs: 2000, maxDelayMs: 60_000 },
    liveFeedIntervalMs: 700
  });
  const clubs = await el.clubs.list({ season: year });
  const map = {};
  for (const c of clubs) {
    const roster = await el.clubs.getRoster({ clubCode: c.code, season: year }).catch(() => []);
    for (const r of roster) {
      const code = r?.person?.code;
      if (!code || r.typeName !== 'Player') continue;
      const n = (r.positionName ?? '').toLowerCase();
      map[code] = n.startsWith('guard') ? 'G' : n.startsWith('forward') ? 'F' : n.startsWith('center') ? 'C' : null;
    }
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cacheFile, JSON.stringify(map));
  return new Map(Object.entries(map));
}

/* ------------------------------------------------------------------ */
/* 2. UCITAVANJE                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ucitava celu tabelu u stranicama.
 *
 * `order` je OBAVEZAN i mora biti jedinstven. Bez njega Postgres ne
 * garantuje isti redosled izmedju dva upita, pa stranice pocnu da se
 * preklapaju i preskacu — dataset tiho ostane nepotpun, a nista ne pukne.
 */
async function loadAll(table, select, filter = (q) => q, order = ['id']) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = filter(sb.from(table).select(select));
    for (const col of order) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

head(
  `WALK-FORWARD BACKTEST — test na ${SEASON}` +
    (PRIOR.length ? `, trening i sa ${PRIOR.join(', ')}` : '')
);

/* Pozicija se cita iz sezone u kojoj je igrac testiran; ranije sezone
   sluze kao rezerva za one koji su tada igrali pod drugim klubom. */
const posMaps = new Map();
for (const y of SEASONS) posMaps.set(y, await loadPositions(y));
const positions = new Map();
for (const y of SEASONS) for (const [k, v] of posMaps.get(y)) if (v) positions.set(k, v);

const pg = await loadAll(
  'el_player_games',
  'season_year, person_code, game_code, team_code, opponent_code, is_home, round, game_date, did_play, minutes, ' +
    'points, fga2, fga3, fta, ftm, offensive_rebounds, defensive_rebounds, total_rebounds, assists, ' +
    'steals, turnovers, blocks_favour, fouls_committed, fouls_drawn, pir, plus_minus, fantasy_pts, is_starter',
  (q) => q.in('season_year', SEASONS),
  ['season_year', 'game_code', 'person_code']
);

log(`ucitano redova igrac×utakmica: ${pg.length}`);
if (!pg.length) {
  log('\nBaza je prazna — prvo pokreni: node scripts/uvoz-istorije.mjs --season ' + SEASON);
  process.exit(1);
}

const players = await loadAll('el_players', 'person_code, name', (q) => q, ['person_code']);
const nameOf = new Map(players.map((p) => [p.person_code, p.name]));

/* svaki red dobija datum kao broj i poziciju */
for (const r of pg) {
  r.t = new Date(r.game_date).getTime();
  r.pos = positions.get(r.person_code) ?? null;
  r.min = Number(r.minutes) || 0;
  r.fp = Number(r.fantasy_pts) || 0;
  /* posedi po Oliver-ovoj formuli, po igracu */
  r.poss = (r.fga2 ?? 0) + (r.fga3 ?? 0) + 0.44 * (r.fta ?? 0) + (r.turnovers ?? 0);
}
pg.sort((a, b) => a.t - b.t);

/* ------------------------------------------------------------------ */
/* 3. IZBOR 10 IGRACA                                                  */
/* ------------------------------------------------------------------ */

const byPlayer = new Map();
for (const r of pg) {
  if (!byPlayer.has(r.person_code)) byPlayer.set(r.person_code, []);
  byPlayer.get(r.person_code).push(r);
}

const candidates = [...byPlayer.entries()]
  .map(([code, rows]) => {
    /* Kandidat se ocenjuje po TEST sezoni — ranije sezone samo hrane trening. */
    const played = rows.filter((r) => r.did_play && r.season_year === SEASON);
    const avgMin = played.reduce((s, r) => s + r.min, 0) / (played.length || 1);
    const avgFp = played.reduce((s, r) => s + r.fp, 0) / (played.length || 1);
    return { code, rows, games: played.length, avgMin, avgFp, pos: positions.get(code) };
  })
  .filter((p) => p.games >= MIN_START + 12 && p.avgMin >= 18)
  .sort((a, b) => b.games * 100 + b.avgFp - (a.games * 100 + a.avgFp));

/* raznovrsnost: ne svi sa istog tima i ne sve isti tip igraca */
const chosen = [];
const perTeam = new Map();
const capPerTeam = Math.max(2, Math.ceil(N_PLAYERS / 20));
for (const c of candidates) {
  const inTest = c.rows.filter((r) => r.season_year === SEASON);
  const team = inTest[inTest.length - 1]?.team_code ?? c.rows[c.rows.length - 1].team_code;
  if ((perTeam.get(team) ?? 0) >= capPerTeam) continue;
  perTeam.set(team, (perTeam.get(team) ?? 0) + 1);
  chosen.push(c);
  if (chosen.length >= N_PLAYERS) break;
}

head(`IZABRANO ${chosen.length} IGRACA`);
chosen.slice(0, 12).forEach((c, i) =>
  log(
    `${String(i + 1).padStart(2)}. ${(nameOf.get(c.code) ?? c.code).padEnd(28)} ` +
      `${(c.pos ?? '?').padEnd(2)} ${(c.rows.filter((r) => r.season_year === SEASON).slice(-1)[0]?.team_code ?? '?').padEnd(4)} ` +
      `utakmica=${String(c.games).padStart(2)}  min=${f1(c.avgMin)}  FP=${f1(c.avgFp)}`
  )
);
if (chosen.length > 12) log(`… i jos ${chosen.length - 12}`);

/* ------------------------------------------------------------------ */
/* 4. PROTIVNIK — kumulativ pre datuma, bez virenja unapred            */
/* ------------------------------------------------------------------ */

/**
 * Za svaki tim cuvamo hronoloski niz „sta su dopustili" po utakmici.
 * Kad pravimo obelezja za utakmicu u trenutku t, uzimamo samo zapise
 * stariji od t. Tako protivnikov profil u 15. kolu ne zna nista o tome
 * sta ce se desiti u 20.
 */
const allowed = new Map(); // team -> [{t, fp, pos, pts, poss, oreb, fouls, fta}]
for (const r of pg) {
  if (!r.did_play) continue;
  /* Kljuc nosi i sezonu — odbrana tima iz prosle sezone nije ista ekipa. */
  const k = `${r.season_year}|${r.opponent_code}`;
  if (!allowed.has(k)) allowed.set(k, []);
  allowed.get(k).push({
    t: r.t,
    fp: r.fp,
    pos: r.pos,
    pts: r.points ?? 0,
    poss: r.poss,
    oreb: r.offensive_rebounds ?? 0,
    fouls: r.fouls_drawn ?? 0, // faulovi koje je protivnik napravio nad igracem
    fta: r.fta ?? 0,
    game: r.game_code
  });
}
for (const arr of allowed.values()) arr.sort((a, b) => a.t - b.t);

function oppProfile(season, team, before, pos) {
  const arr = allowed.get(`${season}|${team}`) ?? [];
  let n = 0, fp = 0, pts = 0, poss = 0, oreb = 0, fouls = 0, fta = 0;
  let nPos = 0, fpPos = 0;
  const games = new Set();
  for (const a of arr) {
    if (a.t >= before) break;
    n++; fp += a.fp; pts += a.pts; poss += a.poss; oreb += a.oreb; fouls += a.fouls; fta += a.fta;
    games.add(a.game);
    if (pos && a.pos === pos) { nPos++; fpPos += a.fp; }
  }
  const g = games.size || 1;
  return {
    n,
    fpAllowed: n ? fp / n : null,
    fpAllowedPos: nPos >= 8 ? fpPos / nPos : null,
    ptsAllowedPerGame: n ? (pts / g) : null,
    pace: n ? poss / g : null,
    orebAllowedPerGame: n ? oreb / g : null,
    foulsPerGame: n ? fouls / g : null,
    ftaAllowedPerGame: n ? fta / g : null
  };
}

/* ------------------------------------------------------------------ */
/* 5. OBELEZJA                                                         */
/* ------------------------------------------------------------------ */

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

const FEATURES = [
  'forma_3',            // prosek fantasy poena u poslednje 3
  'forma_5',            // prosek u poslednjih 5
  'prosek_sezone',      // prosek od pocetka sezone
  'kolebljivost',       // std poslednjih 5 — koliko je nepredvidiv
  'trend',              // forma_3 − prosek_sezone
  'minuti_3',           // minutaza u poslednje 3
  'minuti_sezona',
  'udeo_startera',      // koliko puta je poceo utakmicu
  'upotreba',           // posedi po minutu
  'sutevi_po_minutu',
  'bacanja_po_minutu',
  'skok_po_minutu',
  'domaci',             // 1 = kod kuce
  'odmor_dana',
  'prot_fp_dozvoljeno', // koliko protivnik prosecno pusta fantasy poena po igracu
  'prot_fp_pozicija',   // isto, ali samo na poziciji ovog igraca
  'prot_tempo',         // posedi po utakmici
  'prot_poeni_prima',
  'prot_of_skok_prima',
  'prot_faulovi',       // koliko faulova protivnik pravi
  'prot_bacanja_prima',
  /* iz ranijih sezona — prazno za igraca koji tada nije igrao */
  'prosek_prosle_sezone',
  'minuti_prosle_sezone',
  'ima_proslu_sezonu',
  'prot_fp_prosle_sezone'
];

/** Obelezja za jednu utakmicu, iskljucivo iz proslosti. */
function buildRow(rows, idx) {
  const cur = rows[idx];
  const past = rows.slice(0, idx).filter((r) => r.did_play);

  /* Forma se racuna iz tekuce sezone; ranije sezone ulaze samo kao
     zasebna obelezja, jer se sastav tima i uloga izmedju sezona menjaju. */
  const thisSeason = past.filter((r) => r.season_year === cur.season_year);
  const priorSeason = past.filter((r) => r.season_year < cur.season_year);
  if (thisSeason.length < MIN_START) return null;

  const last3 = thisSeason.slice(-3), last5 = thisSeason.slice(-5);
  const fpAll = thisSeason.map((r) => r.fp);
  const minAll = thisSeason.map((r) => r.min);
  const totMin = minAll.reduce((s, x) => s + x, 0) || 1;

  const forma3 = mean(last3.map((r) => r.fp));
  const prosek = mean(fpAll);
  const prev = thisSeason[thisSeason.length - 1];
  const restDays = Math.min(14, Math.round((cur.t - prev.t) / 864e5));

  const op = oppProfile(cur.season_year, cur.opponent_code, cur.t, cur.pos);
  /* Kakav je protivnik bio PROSLE sezone — koristi se rano u sezoni,
     kad tekuci uzorak jos ne znaci nista. */
  const opPrior = PRIOR.length
    ? oppProfile(PRIOR[PRIOR.length - 1], cur.opponent_code, Infinity, cur.pos)
    : { fpAllowed: null, pace: null };
  /* Ako protivnik jos nema dovoljno odigranog, obelezje ostaje prazno i
     kasnije se popunjava prosekom lige — bolje nego izmisljati broj. */

  return {
    meta: cur,
    y: cur.fp,
    x: {
      forma_3: forma3,
      forma_5: mean(last5.map((r) => r.fp)),
      prosek_sezone: prosek,
      kolebljivost: std(last5.map((r) => r.fp)),
      trend: forma3 - prosek,
      minuti_3: mean(last3.map((r) => r.min)),
      minuti_sezona: mean(minAll),
      udeo_startera: mean(thisSeason.map((r) => (r.is_starter ? 1 : 0))),
      upotreba: thisSeason.reduce((s, r) => s + r.poss, 0) / totMin,
      sutevi_po_minutu: thisSeason.reduce((s, r) => s + (r.fga2 ?? 0) + (r.fga3 ?? 0), 0) / totMin,
      bacanja_po_minutu: thisSeason.reduce((s, r) => s + (r.fta ?? 0), 0) / totMin,
      skok_po_minutu: thisSeason.reduce((s, r) => s + (r.total_rebounds ?? 0), 0) / totMin,
      domaci: cur.is_home ? 1 : 0,
      odmor_dana: restDays,
      prot_fp_dozvoljeno: op.fpAllowed,
      prot_fp_pozicija: op.fpAllowedPos,
      prot_tempo: op.pace,
      prot_poeni_prima: op.ptsAllowedPerGame,
      prot_of_skok_prima: op.orebAllowedPerGame,
      prot_faulovi: op.foulsPerGame,
      prot_bacanja_prima: op.ftaAllowedPerGame,

      prosek_prosle_sezone: priorSeason.length >= 5 ? mean(priorSeason.map((r) => r.fp)) : null,
      minuti_prosle_sezone: priorSeason.length >= 5 ? mean(priorSeason.map((r) => r.min)) : null,
      ima_proslu_sezonu: priorSeason.length >= 5 ? 1 : 0,
      prot_fp_prosle_sezone: opPrior.fpAllowed
    }
  };
}

/* ------------------------------------------------------------------ */
/* 6. GREBEN REGRESIJA (ridge)                                         */
/* ------------------------------------------------------------------ */

/** Resava (X'X + λI)β = X'y Gaus-Jordanovom eliminacijom. */
function ridge(X, y, lambda) {
  const n = X.length, p = X[0].length;
  const A = Array.from({ length: p }, () => new Float64Array(p + 1));

  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += X[k][i] * X[k][j];
      A[i][j] = s + (i === j ? lambda : 0);
    }
    let s = 0;
    for (let k = 0; k < n; k++) s += X[k][i] * y[k];
    A[i][p] = s;
  }

  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    /* Degenerisana kolona: koeficijent je 0. Ranije se ovde radilo
       `continue`, sto je ostavljalo neredukovan red i davalo koeficijente
       reda 1e11 — model bi tiho eksplodirao umesto da prijavi problem. */
    if (Math.abs(A[piv][c]) < 1e-9) {
      for (let j = 0; j <= p; j++) A[c][j] = 0;
      A[c][c] = 1;
      continue;
    }
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    for (let j = c; j <= p; j++) A[c][j] /= d;
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (!f) continue;
      for (let j = c; j <= p; j++) A[r][j] -= f * A[c][j];
    }
  }
  return Array.from({ length: p }, (_, i) => A[i][p]);
}

/* ------------------------------------------------------------------ */
/* 7. WALK-FORWARD                                                     */
/* ------------------------------------------------------------------ */

/* svi redovi svih izabranih igraca, hronoloski */
const dataset = [];
for (const c of chosen) {
  const rows = c.rows.slice().sort((a, b) => a.t - b.t);
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].did_play) continue;
    const built = buildRow(rows, i);
    if (built) dataset.push(built);
  }
}
dataset.sort((a, b) => a.meta.t - b.meta.t);

/* Predvidja se SAMO test sezona. Ranije sezone su tu da bi model imao
   sta da uci pre nego sto test sezona uopste pocne. */
const testable = dataset.filter((d) => d.meta.season_year === SEASON);

head(`WALK-FORWARD: ${testable.length} predikcija na sezoni ${SEASON}`);
if (PRIOR.length) {
  log(`trening bazen ukljucuje i ${dataset.length - testable.length} redova iz ranijih sezona`);
}
log(`svaka koristi samo utakmice pre svog datuma; prvih ${MIN_START} po igracu sluzi za ucenje\n`);

/* liga-prosek za popunjavanje praznih protivnickih obelezja */
const leagueMeans = {};
for (const f of FEATURES) {
  const vals = dataset.map((d) => d.x[f]).filter((v) => v != null && Number.isFinite(v));
  leagueMeans[f] = mean(vals);
}
const vec = (x) => FEATURES.map((f) => (x[f] == null || !Number.isFinite(x[f]) ? leagueMeans[f] : x[f]));

const preds = [];
let lastCoef = null;

for (const cur of testable) {
  /* trening = sve sto se desilo STROGO pre ove utakmice, iz svih sezona */
  const train = dataset.filter((d) => d.meta.t < cur.meta.t);
  if (train.length < 60) continue;

  const rawAll = train.map((d) => vec(d.x));
  /* Obelezje koje u trening skupu nema varijanse ne nosi informaciju, a
     uz presek pravi singularnu matricu — izbacuje se pre resavanja. */
  const active = FEATURES.map((_, j) => j).filter(
    (j) => std(rawAll.map((r) => r[j])) > 1e-8
  );
  const rawX = rawAll.map((r) => active.map((j) => r[j]));
  const mu = active.map((_, k) => mean(rawX.map((r) => r[k])));
  const sd = active.map((_, k) => std(rawX.map((r) => r[k])) || 1);
  const norm = (r) => [1, ...r.map((v, k) => (v - mu[k]) / sd[k])];

  const X = rawX.map(norm);
  const beta = ridge(X, train.map((d) => d.y), 12);
  lastCoef = { beta, mu, sd, active };

  const xs = norm(active.map((j) => vec(cur.x)[j]));
  const yhat = xs.reduce((s, v, j) => s + v * beta[j], 0);

  /* Dvostepeni: posebno minuti, posebno ucinak po minutu.
     Minutaza je predvidiva, ucinak po minutu nije — pa ih model koji ih
     spaja u jedan broj meri istim arsinom, sto je verovatno greska. */
  const betaMin = ridge(X, train.map((d) => d.meta.min), 12);
  const betaRate = ridge(
    X,
    train.map((d) => (d.meta.min > 0 ? d.y / d.meta.min : 0)),
    12
  );
  const minHat = Math.max(0, xs.reduce((s, v, j) => s + v * betaMin[j], 0));
  const rateHat = xs.reduce((s, v, j) => s + v * betaRate[j], 0);

  preds.push({
    ...cur,
    yhat: Math.max(0, yhat),
    yhat2: Math.max(0, minHat * rateHat),
    b_prosek: cur.x.prosek_sezone,
    b_forma5: cur.x.forma_5,
    b_pond: 0.5 * cur.x.forma_3 + 0.3 * cur.x.forma_5 + 0.2 * cur.x.prosek_sezone,
    trainSize: train.length
  });
}

/* ------------------------------------------------------------------ */
/* 8. REZULTATI                                                        */
/* ------------------------------------------------------------------ */

const mae = (a) => mean(a.map(Math.abs));
const rmse = (a) => Math.sqrt(mean(a.map((x) => x * x)));

const errModel = preds.map((p) => p.yhat - p.y);
const errProsek = preds.map((p) => p.b_prosek - p.y);
const errForma = preds.map((p) => p.b_forma5 - p.y);
const errPond = preds.map((p) => p.b_pond - p.y);
const errDvo = preds.map((p) => p.yhat2 - p.y);

const yMean = mean(preds.map((p) => p.y));
const ssTot = preds.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
const r2 = 1 - preds.reduce((s, p) => s + (p.yhat - p.y) ** 2, 0) / ssTot;

head('REZULTAT');
log(`predikcija: ${preds.length}   prosecan stvarni ucinak: ${f1(yMean)} FP\n`);
log('metoda                        MAE    RMSE    ±3FP   ±5FP');
log('-'.repeat(60));
const line = (name, err) => {
  const within = (k) => (100 * err.filter((e) => Math.abs(e) <= k).length) / err.length;
  log(
    `${name.padEnd(28)} ${f2(mae(err)).padStart(5)}  ${f2(rmse(err)).padStart(6)}  ` +
      `${f1(within(3)).padStart(5)}%  ${f1(within(5)).padStart(5)}%`
  );
};
line('prosek sezone (baseline)', errProsek);
line('forma poslednjih 5', errForma);
line('ponderisana forma', errPond);
line('MODEL (ridge)', errModel);
line('MODEL dvostepeni (min × FP/min)', errDvo);

/* Poredi se sa NAJBOLJIM baseline-om, ne sa proizvoljno izabranim —
   inace je lako ispisati brojku koja laska modelu. */
const baselines = [
  ['prosek sezone', mae(errProsek)],
  ['forma poslednjih 5', mae(errForma)],
  ['ponderisana forma', mae(errPond)]
];
const bestModel = mae(errDvo) < mae(errModel) ? ['dvostepeni', mae(errDvo)] : ['ridge', mae(errModel)];
const best = baselines.reduce((a, b) => (b[1] < a[1] ? b : a));
const gain = (100 * (best[1] - bestModel[1])) / best[1];

log(`\nR² modela: ${f2(r2)}`);
log(`najbolji baseline: ${best[0]} — MAE ${f2(best[1])}`);
log(`najbolji model: ${bestModel[0]} — MAE ${f2(bestModel[1])}`);
log(
  gain > 0
    ? `MODEL JE BOLJI od najboljeg baseline-a za ${f1(gain)}% MAE`
    : `MODEL NIJE BOLJI — losiji je od najboljeg baseline-a za ${f1(Math.abs(gain))}% MAE`
);

/* ------------------------------------------------------------------ */
/* 9. STA NAJVISE UTICE                                                */
/* ------------------------------------------------------------------ */

head('STA NAJVISE UTICE NA UCINAK');

log('A. Tezine poslednjeg modela (obelezja standardizovana, pa su uporediva)\n');
const weights = lastCoef.active
  .map((j, k) => ({ f: FEATURES[j], w: lastCoef.beta[k + 1] }))
  .sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
const maxW = Math.abs(weights[0].w);
for (const { f, w } of weights) {
  const bar = '█'.repeat(Math.round((Math.abs(w) / maxW) * 26));
  log(`  ${f.padEnd(20)} ${(w >= 0 ? '+' : '−') + f2(Math.abs(w)).padStart(5)}  ${bar}`);
}

log('\nB. Koliko MAE poraste kad se obelezje izbaci (posteniji test)\n');
/* jedan trening na 70% pa merenje na 30% — drop-one bi bio prespor u walk-forwardu */
const cut = Math.floor(dataset.length * 0.7);
const trainSet = dataset.slice(0, cut);
const testSet = dataset.slice(cut);

function fitEval(exclude) {
  const idx = FEATURES.map((f, j) => j).filter((j) => FEATURES[j] !== exclude);
  const rawX = trainSet.map((d) => idx.map((j) => vec(d.x)[j]));
  const mu = idx.map((_, k) => mean(rawX.map((r) => r[k])));
  const sd = idx.map((_, k) => std(rawX.map((r) => r[k])) || 1);
  const X = rawX.map((r) => [1, ...r.map((v, k) => (v - mu[k]) / sd[k])]);
  const beta = ridge(X, trainSet.map((d) => d.y), 12);
  const err = testSet.map((d) => {
    const xr = idx.map((j) => vec(d.x)[j]);
    const xs = [1, ...xr.map((v, k) => (v - mu[k]) / sd[k])];
    return Math.max(0, xs.reduce((s, v, k) => s + v * beta[k], 0)) - d.y;
  });
  return mae(err);
}

const base = fitEval(null);
const drops = FEATURES.map((f) => ({ f, delta: fitEval(f) - base })).sort((a, b) => b.delta - a.delta);
log(`  osnovni MAE sa svim obelezjima: ${f2(base)}\n`);
for (const { f, delta } of drops.slice(0, 12)) {
  const sign = delta >= 0 ? '+' : '−';
  const bar = '█'.repeat(Math.max(0, Math.round(Math.abs(delta) * 60)));
  log(`  bez ${f.padEnd(20)} MAE ${sign}${f2(Math.abs(delta))}  ${bar}`);
}

/* ------------------------------------------------------------------ */
/* 10. PO IGRACU                                                       */
/* ------------------------------------------------------------------ */

head('PO IGRACU');
log('igrac                        n   stvarno  model   MAE   baseline MAE');
log('-'.repeat(70));
for (const c of chosen.slice(0, 12)) {
  const mine = preds.filter((p) => p.meta.person_code === c.code);
  if (!mine.length) continue;
  const e = mine.map((p) => p.yhat - p.y);
  const b = mine.map((p) => p.b_pond - p.y);
  log(
    `${(nameOf.get(c.code) ?? c.code).padEnd(28)} ${String(mine.length).padStart(2)}  ` +
      `${f1(mean(mine.map((p) => p.y))).padStart(6)}  ${f1(mean(mine.map((p) => p.yhat))).padStart(6)}  ` +
      `${f2(mae(e)).padStart(5)}  ${f2(mae(b)).padStart(6)}`
  );
}

/* ------------------------------------------------------------------ */
/* 11. PRIMER — poslednjih 10 predikcija                               */
/* ------------------------------------------------------------------ */

head('POSLEDNJIH 10 PREDIKCIJA');
log('kolo  igrac                     protivnik  D/G  model  stvarno  greska');
log('-'.repeat(72));
for (const p of preds.slice(-10)) {
  log(
    `${String(p.meta.round ?? '').padStart(4)}  ${(nameOf.get(p.meta.person_code) ?? '').padEnd(24)} ` +
      `${p.meta.opponent_code.padEnd(9)}  ${p.meta.is_home ? 'D' : 'G'}   ` +
      `${f1(p.yhat).padStart(5)}  ${f1(p.y).padStart(7)}  ${(p.yhat - p.y >= 0 ? '+' : '−') + f1(Math.abs(p.yhat - p.y))}`
  );
}

log('\n');
