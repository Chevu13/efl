/**
 * Uvoz cena iz zvanicne fantasy tabele + projekcija fantasy poena.
 *
 *   node scripts/uvoz-cena.mjs <xlsx> [--round 1] [--dry]
 *
 * Puni `player_rounds` (cena, projekcija, vrednost, protivnik) i `coaches`.
 * Cim ta tabela ima redove, aplikacija prestaje da koristi demo brojeve.
 *
 * PROJEKCIJA ZA PRVO KOLO
 * Nema forme tekuce sezone — nijedna utakmica nije odigrana. Zato:
 *
 *   projekcija = minuti × FP_po_minutu × protivnik × domaci
 *
 * gde minuti i FP/min dolaze iz prosle sezone, skalirani faktorom uloge
 * (koliko je minuta na toj poziciji otislo iz tima). Za igraca bez
 * istorije sve se izvodi iz cene — trziste je vec procenilo igraca.
 * Na kraju se istorija i cena mesaju pola-pola: backtest je pokazao da
 * moj model jedva tuce prost prosek, pa nema osnova da cenu nadglasavam.
 *
 * Trazi python sa openpyxl za citanje xlsx (bez novih npm zavisnosti).
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

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

const NL = String.fromCharCode(10);
const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const DRY = args.includes('--dry');
const XLSX = args.find((a) => a.endsWith('.xlsx'));
const ROUND_ID = Number(flag('round', 1));
const PRIOR_SEASON = Number(flag('prior', 2025));

if (!XLSX) {
  console.error('Zadaj putanju do .xlsx fajla.');
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const log = (...a) => console.log(...a);
const head = (t) => log('\n' + '='.repeat(68) + '\n' + t + '\n' + '='.repeat(68));
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;

/** Kodovi u fantasy tabeli se ne poklapaju uvek sa nasima. */
const TEAM_ALIAS = { BJK: 'BES', DUB: 'BKN', FBT: 'FBB', KBA: 'BAS', MIL: 'EA7' };
const ourTeam = (abbr) => TEAM_ALIAS[abbr] ?? abbr;

const POS = { Guard: 'G', Forward: 'F', Center: 'C' };

const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');

/* ------------------------------------------------------------------ */
/* 1. XLSX -> JSON preko pythona                                       */
/* ------------------------------------------------------------------ */

const PY = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
ws = wb['Players']
hdr = [c.value for c in ws[1]]
out = [dict(zip(hdr, r)) for r in ws.iter_rows(min_row=2, values_only=True) if any(r)]
print(json.dumps(out, default=str))
`;

const raw = JSON.parse(execFileSync('python', ['-c', PY, XLSX], { maxBuffer: 32 << 20 }).toString());
head(`UCITANO IZ TABELE: ${raw.length} redova`);

const coachRows = raw.filter((r) => r.Position === 'Head Coach');
const playerRows = raw.filter((r) => r.Position !== 'Head Coach');
log(`igraca: ${playerRows.length}   trenera: ${coachRows.length}`);

/* ------------------------------------------------------------------ */
/* 2. NASI PODACI                                                      */
/* ------------------------------------------------------------------ */

async function all(table, select, filter = (q) => q, order = ['id']) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = filter(sb.from(table).select(select));
    for (const c of order) q = q.order(c, { ascending: true });
    const { data, error } = await q.range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const ourPlayers = await all('players', 'id, full_name, short_name, team_code, position, jersey, el_person_code, photo', (q) => q, ['id']);
const fixtures = await all('fixtures', 'home_code, away_code, home_edge', (q) => q.eq('round_id', ROUND_ID), ['id']);
const elPlayers = await all('el_players', 'person_code, name', (q) => q, ['person_code']);
const hist = await all(
  'el_player_games',
  'person_code, team_code, minutes, fantasy_pts, did_play, is_starter',
  (q) => q.eq('season_year', PRIOR_SEASON),
  ['season_year', 'game_code', 'person_code']
);

log(`nasi igraci: ${ourPlayers.length}   mecevi kola: ${fixtures.length}   istorija ${PRIOR_SEASON}: ${hist.length} redova`);

/* protivnik + domaci teren iz nasih meceva */
const opponent = new Map();
for (const f of fixtures) {
  opponent.set(f.home_code, { opp: f.away_code, home: true, edge: f.home_edge });
  opponent.set(f.away_code, { opp: f.home_code, home: false, edge: 100 - (f.home_edge ?? 50) });
}

/* ------------------------------------------------------------------ */
/* 3. UPARIVANJE                                                       */
/* ------------------------------------------------------------------ */

/** 'LARKIN, SHANE' -> kljuc prezime|ime */
const elByKey = new Map();
for (const p of elPlayers) {
  const [last = '', first = ''] = p.name.split(',').map((x) => x.trim());
  elByKey.set(`${norm(last)}|${norm(first)}`, p.person_code);
  elByKey.set(norm(last), p.person_code); // rezerva samo po prezimenu
}

/* Kljuc nosi i inicijal imena: Besiktas ima dva Browna, pa bi ih samo
   prezime spojilo u jednog i upis bi pao na duplom kljucu. Prezime samo
   za sebe vazi tek kad je u tom timu jedinstveno. */
const partsOf = (p) => (p.short_name ?? p.full_name ?? '').split(/\s+/).filter(Boolean);
/* Prezime = sve osim inicijala. Ranije se uzimala najduza rec, sto je
   lomilo slozena prezimena („Da Silva" -> „Silva") i sufikse
   („Baldwin Jr" -> „Baldwin"), pa se igrac nije uparivao. */
const lastOf = (p) =>
  partsOf(p).filter((w) => w.replace(/\./g, '').length > 1).join(' ');
const initOf = (p) => {
  const ini = partsOf(p).find((w) => w.replace(/\./g, '').length === 1);
  return norm(ini ?? partsOf(p).find((w) => w !== lastOf(p)) ?? '')[0] ?? '';
};

/** „baldwinjr" -> „baldwin"; hvata slucaj kad jedna strana nosi sufiks a druga ne. */
const core = (s) => norm(s).replace(/(jr|sr|iv|iii|ii)$/, '');

const lastCount = new Map();
for (const p of ourPlayers) {
  const k = `${p.team_code}|${norm(lastOf(p))}`;
  lastCount.set(k, (lastCount.get(k) ?? 0) + 1);
}

const ourByTeamLast = new Map();
for (const p of ourPlayers) {
  const k = `${p.team_code}|${norm(lastOf(p))}`;
  ourByTeamLast.set(`${k}|${initOf(p)}`, p);
  ourByTeamLast.set(`${p.team_code}|${core(lastOf(p))}|${initOf(p)}`, p);
  if (lastCount.get(k) === 1) ourByTeamLast.set(k, p);
}

let matchedOur = 0, matchedEl = 0;
const unmatchedOur = [], unmatchedEl = [];

const rows = playerRows.map((r) => {
  const team = ourTeam(r['Team Abbr']);
  const last = norm(r['Last Name']);
  const first = norm(r['First Name']);

  const mine =
    ourByTeamLast.get(`${team}|${last}|${first[0] ?? ''}`) ??
    ourByTeamLast.get(`${team}|${core(r['Last Name'])}|${first[0] ?? ''}`) ??
    ourByTeamLast.get(`${team}|${last}`) ??
    null;
  const person = elByKey.get(`${last}|${first}`) ?? elByKey.get(last) ?? mine?.el_person_code ?? null;

  if (mine) matchedOur++; else unmatchedOur.push(`${r.Player} (${team})`);
  if (person) matchedEl++; else unmatchedEl.push(`${r.Player} (${team})`);

  return {
    x: r,
    team,
    pos: POS[r.Position] ?? null,
    price: Number(r.Price),
    ourId: mine?.id ?? null,
    person,
    injured: r.Injured === true || r.Injured === 'True',
    playProb: Number(r['Probability of Playing'] ?? 1),
    ownership: Number(r.Popularity ?? 0) * 100
  };
});

/* Tabela je sveza, nasa `players` nije — nova pojacanja fale. Bez njih
   korisnik ne moze da sastavi tim koji stvarno ima, pa se dodaju.
   Slug prati postojecu konvenciju: prezime-inicijal-tim. */
/* Ne dodaj igraca koji vec postoji pod istim imenom u istom timu —
   inace slozena prezimena („Baldwin Jr") naprave drugi zapis pored
   postojeceg, i to onaj bez fotografije. */
const existingKey = new Set(ourPlayers.map((p) => `${p.team_code}|${norm(p.short_name)}`));
const missing = rows.filter(
  (r) => !r.ourId && !existingKey.has(`${r.team}|${norm(`${String(r.x['First Name']).trim()[0]}. ${r.x['Last Name']}`)}`)
);
if (missing.length && !DRY) {
  const slug = (r) =>
    `${norm(r.x['Last Name']).replace(/\s+/g, '-')}-${norm(r.x['First Name'])[0] ?? 'x'}-${r.team.toLowerCase()}`;
  const novi = missing.map((r) => ({
    id: slug(r),
    full_name: r.x.Player,
    /* Konvencija ostatka tabele: „P. Baldwin Jr", ne puno ime — inace se
       igrac ne uparuje pri sledecem uvozu i lose se prikazuje u listama. */
    short_name: `${String(r.x['First Name']).trim()[0]}. ${String(r.x['Last Name']).trim()}`,
    team_code: r.team,
    position: r.pos,
    jersey: Number.isFinite(Number(r.x.Jersey)) ? Number(r.x.Jersey) : null,
    el_person_code: r.person,
    active: true
  }));
  const { error } = await sb.from('players').upsert(novi, { onConflict: 'id' });
  if (error) console.error('dodavanje igraca:', error.message);
  else {
    missing.forEach((r, i) => (r.ourId = novi[i].id));
    console.log(`
dodato u players: ${novi.length} novih igraca`);
  }
}

head('UPARIVANJE');
log(`sa nasim igracima:   ${matchedOur}/${rows.length}`);
log(`sa istorijom (EL):   ${matchedEl}/${rows.length}`);
if (unmatchedOur.length) log(`\nbez para u players (${unmatchedOur.length}): ${unmatchedOur.slice(0, 12).join(', ')}${unmatchedOur.length > 12 ? ' …' : ''}`);
if (unmatchedEl.length) log(`\nbez istorije (${unmatchedEl.length}): ${unmatchedEl.slice(0, 12).join(', ')}${unmatchedEl.length > 12 ? ' …' : ''}`);

/* ------------------------------------------------------------------ */
/* 4. PROSLA SEZONA PO IGRACU                                          */
/* ------------------------------------------------------------------ */

const byPerson = new Map();
for (const h of hist) {
  if (!h.did_play) continue;
  const e = byPerson.get(h.person_code) ?? { g: 0, min: 0, fp: 0, starts: 0, team: h.team_code };
  e.g++; e.min += Number(h.minutes) || 0; e.fp += Number(h.fantasy_pts) || 0;
  if (h.is_starter) e.starts++;
  byPerson.set(h.person_code, e);
}

/* ------------------------------------------------------------------ */
/* 5. FAKTOR ULOGE — koliko je minuta otislo iz tima                   */
/* ------------------------------------------------------------------ */

/**
 * Prosle sezone tim je odigrao N minuta na svakoj poziciji. Deo tih
 * minuta pripada igracima kojih vise nema na spisku. Ti minuti se
 * preraspodeljuju na one koji su ostali — to je jedini nacin da se pre
 * prvog kola vidi cija uloga raste.
 */
const stayingByTeamPos = new Map(); // tim|poz -> minuti koji ostaju
const totalByTeamPos = new Map();   // tim|poz -> minuti prosle sezone

const posOf = new Map(rows.filter((r) => r.person).map((r) => [r.person, r.pos]));
const onRoster = new Set(rows.map((r) => r.person).filter(Boolean));

for (const [person, e] of byPerson) {
  const pos = posOf.get(person);
  if (!pos) continue;
  const team = e.team;
  const k = `${team}|${pos}`;
  totalByTeamPos.set(k, (totalByTeamPos.get(k) ?? 0) + e.min);
  if (onRoster.has(person)) stayingByTeamPos.set(k, (stayingByTeamPos.get(k) ?? 0) + e.min);
}

/** ponytail: linearna preraspodela minuta, bez modela rotacije. Ogranicena na 1.6× da jedan odlazak ne napravi cudo. */
function roleBoost(elTeam, pos) {
  const k = `${elTeam}|${pos}`;
  const total = totalByTeamPos.get(k) ?? 0;
  const staying = stayingByTeamPos.get(k) ?? 0;
  if (!total || !staying) return 1;
  return Math.min(1.6, Math.max(0.7, total / staying));
}

/* ------------------------------------------------------------------ */
/* 6. CENA -> FP  (kalibracija na igracima koji imaju oboje)           */
/* ------------------------------------------------------------------ */

const calib = rows
  .map((r) => ({ p: r.price, e: byPerson.get(r.person) }))
  .filter((x) => x.e && x.e.g >= 10)
  .map((x) => ({ p: x.p, fp: x.e.fp / x.e.g }));

const mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const mp = mean(calib.map((c) => c.p)), mf = mean(calib.map((c) => c.fp));
const cov = mean(calib.map((c) => (c.p - mp) * (c.fp - mf)));
const varp = mean(calib.map((c) => (c.p - mp) ** 2));
const slope = varp ? cov / varp : 1.2;
const intercept = mf - slope * mp;
const priceImplied = (p) => Math.max(0, intercept + slope * p);

head('KALIBRACIJA CENE');
log(`uzorak: ${calib.length} igraca sa cenom i bar 10 utakmica prosle sezone`);
log(`FP ≈ ${r2(intercept)} + ${r2(slope)} × cena`);
log(`primer: cena 4 → ${r1(priceImplied(4))} FP   cena 10 → ${r1(priceImplied(10))}   cena 17 → ${r1(priceImplied(17))}`);

/* ------------------------------------------------------------------ */
/* 7. PROJEKCIJA                                                       */
/* ------------------------------------------------------------------ */

const out = [];
for (const r of rows) {
  const ctx = opponent.get(r.team);
  const e = byPerson.get(r.person);
  const implied = priceImplied(r.price);

  let projected, basis;
  if (e && e.g >= 8) {
    const perMin = e.fp / Math.max(1, e.min);
    const minutes = (e.min / e.g) * roleBoost(e.team, r.pos);
    const fromHistory = perMin * minutes;
    /* Istorija i cena pola-pola — cena nosi ono sto istorija ne vidi
       (promena tima, uloga, forma u pripremama). */
    projected = 0.5 * fromHistory + 0.5 * implied;
    basis = 'istorija+cena';
  } else {
    projected = implied;
    basis = 'samo cena';
  }

  /* Protivnik: nasa procena meca, blago. ±10% je gornja granica —
     backtest je pokazao da protivnik nosi vrlo malo signala. */
  const edge = ctx?.edge ?? 50;
  projected *= 1 + ((edge - 50) / 50) * 0.1;
  /* Domaci teren je mali ali stvaran. */
  if (ctx?.home) projected *= 1.03;

  if (r.injured || r.playProb === 0) projected = 0;

  projected = r1(Math.max(0, projected));

  /* Vrednost = koliko igrac ide PLUS od svoje cene, ne projekcija po
     kreditu. Odnos proj/cena raste sa cenom zbog negativnog preseka u
     kalibraciji, pa bi skupi uvek izgledali kao najbolja kupovina —
     tacno suprotno od onoga sto lista treba da pokaze.
     5.0 = tacno po ceni, iznad = potcenjen, ispod = precenjen. */
  const value = projected > 0 ? r1(Math.min(10, Math.max(0, 5 + (projected - implied)))) : 0;
  const matchup = ctx ? r1(Math.min(10, Math.max(1, (edge / 100) * 9 + 1))) : null;

  out.push({
    round_id: ROUND_ID,
    player_id: r.ourId,
    price: r.price,
    projected,
    value_score: value,
    matchup_score: matchup,
    /* "Popularity" iz tabele je udeo menadzera koji ga vec imaju. */
    ownership: r1(r.ownership),
    opponent_code: ctx?.opp ?? null,
    is_home: ctx?.home ?? null,
    status: r.injured ? 'povreda' : 'ok',
    _name: r.x.Player,
    _team: r.team,
    _pos: r.pos,
    _basis: basis,
    _own: r.ownership
  });
}

const writable = out.filter((o) => o.player_id);
head('PROJEKCIJA');
log(`izracunato: ${out.length}   sa nasim player_id (moze da se upise): ${writable.length}`);
log(`osnov: istorija+cena ${out.filter((o) => o._basis === 'istorija+cena').length}, samo cena ${out.filter((o) => o._basis === 'samo cena').length}`);

const top = [...out].sort((a, b) => b.projected - a.projected).slice(0, 15);
log('\nNAJVECA PROJEKCIJA');
log('igrac                        tim  poz  cena  proj  vred  osnov');
log('-'.repeat(70));
top.forEach((o) =>
  log(
    `${o._name.slice(0, 28).padEnd(28)} ${o._team.padEnd(4)} ${(o._pos ?? '?').padEnd(3)} ` +
      `${String(o.price).padStart(5)} ${String(o.projected).padStart(5)} ${String(o.value_score).padStart(5)}  ${o._basis}`
  )
);

const val = [...out].filter((o) => o.projected > 0).sort((a, b) => b.value_score - a.value_score).slice(0, 15);
log('\nNAJBOLJA VREDNOST (koliko ide preko onoga sto cena podrazumeva)');
log('igrac                        tim  poz  cena  proj  vred');
log('-'.repeat(62));
val.forEach((o) =>
  log(
    `${o._name.slice(0, 28).padEnd(28)} ${o._team.padEnd(4)} ${(o._pos ?? '?').padEnd(3)} ` +
      `${String(o.price).padStart(5)} ${String(o.projected).padStart(5)} ${String(o.value_score).padStart(5)}`
  )
);

/* ------------------------------------------------------------------ */
/* 8. UPIS                                                             */
/* ------------------------------------------------------------------ */

/* Poslednja odbrana: dva reda sa istim player_id obaraju ceo upis
   (`ON CONFLICT ... cannot affect row a second time`). Zadrzava se onaj
   sa vecom projekcijom. */
const byId = new Map();
for (const o of writable) {
  const prev = byId.get(o.player_id);
  if (!prev || o.projected > prev.projected) byId.set(o.player_id, o);
}
if (byId.size < writable.length) {
  log(`
upozorenje: ${writable.length - byId.size} duplih player_id — zadrzan red sa vecom projekcijom`);
}

/* ------------------------------------------------------------------ */
/* IZBORI KOLA                                                         */
/*                                                                     */
/* Nije lista od trinaest najboljih. Paketi se razlikuju po tome KOJI   */
/* deo terena i koje cene pokrivaju, pa se izbori dele u pretince:      */
/*                                                                     */
/*   FREE   1  najveca razlika u kolu, bez obzira na poziciju i cenu    */
/*   PLUS   3  po jedan iz svakog cenovnog ranga                        */
/*   PRO    9  svaka pozicija puta svaki cenovni rang                   */
/*                                                                     */
/* Jedan igrac moze da bude samo u jednom pretincu — ko je vec uzet za  */
/* nizi paket ne racuna se ponovo, inace bi PLUS i PRO gledali iste     */
/* karte pod drugim imenom.                                            */
/* ------------------------------------------------------------------ */

const RANG = (cena) => (cena < 8 ? 'jeftin' : cena < 12 ? 'srednji' : 'skup');
const RANGOVI = ['skup', 'srednji', 'jeftin'];
const POZICIJE = ['G', 'F', 'C'];

const ranked = [...byId.values()]
  .filter((o) => o.projected > 0)
  .sort((a, b) => b.projected - b.price - (a.projected - a.price));

const uzet = new Set();
const uzmi = (uslov) => {
  const o = ranked.find((x) => !uzet.has(x.player_id) && uslov(x));
  if (o) uzet.add(o.player_id);
  return o;
};

/* 1) besplatan izbor */
const free = uzmi(() => true);
if (free) {
  free.tier_pick = 'FREE';
  free.pick_group = RANG(free.price);
}

/* 2) Plus — po jedan iz svakog cenovnog ranga */
for (const rang of RANGOVI) {
  const o = uzmi((x) => RANG(x.price) === rang);
  if (o) {
    o.tier_pick = 'PLUS';
    o.pick_group = rang;
  }
}

/* 3) Pro — mreza pozicija x rang */
for (const poz of POZICIJE) {
  for (const rang of RANGOVI) {
    const o = uzmi((x) => x._pos === poz && RANG(x.price) === rang);
    if (o) {
      o.tier_pick = 'PRO';
      o.pick_group = `${poz}-${rang}`;
    }
  }
}

head('IZBORI KOLA');
log('paket  grupa        igrac                        tim   cena   proj  razlika');
log('-'.repeat(76));
[...byId.values()]
  .filter((o) => o.tier_pick)
  .sort((a, b) => {
    const red = { FREE: 0, PLUS: 1, PRO: 2 };
    return red[a.tier_pick] - red[b.tier_pick] || (a.pick_group > b.pick_group ? 1 : -1);
  })
  .forEach((o) =>
    log(
      `${o.tier_pick.padEnd(6)} ${String(o.pick_group).padEnd(12)} ` +
        `${o._name.slice(0, 28).padEnd(28)} ${o._team.padEnd(4)} ` +
        `${String(o.price).padStart(5)} ${String(o.projected).padStart(6)} ` +
        `${r1(o.projected - o.price).toFixed(1).padStart(8)}`
    )
  );

const razlika = [...out]
  .filter((o) => o.projected > 0)
  .sort((a, b) => b.projected - b.price - (a.projected - a.price))
  .slice(0, 15);
log(NL + 'NAJVECA RAZLIKA (projekcija minus cena)');
log('igrac                        tim  poz  cena  proj  razlika');
log('-'.repeat(64));
razlika.forEach((o) =>
  log(
    `${o._name.slice(0, 28).padEnd(28)} ${o._team.padEnd(4)} ${(o._pos ?? '?').padEnd(3)} ` +
      `${String(o.price).padStart(5)} ${String(o.projected).padStart(5)} ` +
      `${r1(o.projected - o.price).toFixed(1).padStart(8)}`
  )
);

const payload = [...byId.values()].map(({ _name, _team, _pos, _basis, _own, ...rest }) => rest);

/* ------------------------------------------------------------------ */
/* 8b. TRENERI                                                         */
/*                                                                     */
/* Trener se ne boduje kao igrac. Zvanicna tabela daje sest ishoda,    */
/* i svi zavise iskljucivo od rezultata meca:                          */
/*                                                                     */
/*   pobeda   1-10 ili produzetak  +10                                 */
/*   pobeda  11-20                 +20                                 */
/*   pobeda    20+                 +25                                 */
/*   poraz    1-10 ili produzetak   -5                                 */
/*   poraz   11-20                 -10                                 */
/*   poraz     20+                 -20                                 */
/*                                                                     */
/* Cena trenera ne govori nista o tome — zato projekcija ide iz sanse  */
/* za pobedu u konkretnom mecu, a ne iz cene kao kod igraca.           */
/* ------------------------------------------------------------------ */

const BODOVI = { p10: 10, p20: 20, pBig: 25, g10: -5, g20: -10, gBig: -20 };

/* Sigma razlike u kosevima, izmerena na 732 odigrane utakmice sezona
   2024 i 2025 iz `el_games`. Prednost domaceg je u proseku +3,4 koseva,
   ali ona vec sedi u proceni meca, pa se ovde ne dodaje ponovo. */
const SIGMA = 12.4;

/* Abramowitz-Stegun 7.1.26 — greska ispod 1.5e-7, dovoljno za projekciju. */
function erf(x) {
  const znak = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return znak * y;
}
const F = (x, mu) => 0.5 * (1 + erf((x - mu) / (SIGMA * Math.SQRT2)));

/* Iz sanse za pobedu nazad u ocekivanu razliku: trazi se mu za koje je
   P(razlika > 0) = sansa. Bisekcija umesto druge aproksimacije — kratko
   je i nema svoju gresku. */
function muIzSanse(sansa) {
  const p = Math.min(0.99, Math.max(0.01, sansa));
  let lo = -40, hi = 40;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (1 - F(0, mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Ocekivani broj poena trenera u jednom mecu, po zvanicnoj tabeli. */
function trenerEV(sansa) {
  const mu = muIzSanse(sansa);
  const v = {
    p10: F(10, mu) - F(0, mu),
    p20: F(20, mu) - F(10, mu),
    pBig: 1 - F(20, mu),
    g10: F(0, mu) - F(-10, mu),
    g20: F(-10, mu) - F(-20, mu),
    gBig: F(-20, mu)
  };
  const ev = Object.keys(BODOVI).reduce((a, k) => a + BODOVI[k] * v[k], 0);
  return { ev, v };
}

const coaches = coachRows.map((c) => {
  const tim = ourTeam(c['Team Abbr']);
  /* Tim u dvokolu ima dva meca — trener kupi poene sa oba. */
  const meceviTima = fixtures.filter((f) => f.home_code === tim || f.away_code === tim);
  let ev = 0;
  let raspodela = null;
  for (const f of meceviTima) {
    const domaci = f.home_code === tim;
    const sansa = (domaci ? (f.home_edge ?? 50) : 100 - (f.home_edge ?? 50)) / 100;
    const r = trenerEV(sansa);
    ev += r.ev;
    raspodela ??= { sansa, ...r.v };
  }
  return {
    id: `hc-${tim.toLowerCase()}`,
    round_id: ROUND_ID,
    name: c.Player,
    team_code: tim,
    price: Number(c.Price),
    projected: r1(ev),
    _meceva: meceviTima.length,
    _r: raspodela
  };
});

head('TRENERI');
log('Bodovanje: pobeda 1-10 +10, 11-20 +20, 20+ +25 | poraz 1-10 -5, 11-20 -10, 20+ -20');
log('');
log('trener                       tim  cena  sansa   +10   +20   +25    -5   -10   -20   proj');
log('-'.repeat(94));
[...coaches]
  .sort((a, b) => b.projected - a.projected)
  .forEach((c) => {
    const r = c._r;
    const pct = (x) => (x == null ? '   —' : (x * 100).toFixed(0).padStart(4) + '%');
    log(
      `${c.name.slice(0, 28).padEnd(28)} ${c.team_code.padEnd(4)} ${String(c.price).padStart(5)} ` +
        `${r ? (r.sansa * 100).toFixed(0).padStart(5) + '%' : '    —'} ` +
        `${pct(r?.p10)} ${pct(r?.p20)} ${pct(r?.pBig)} ${pct(r?.g10)} ${pct(r?.g20)} ${pct(r?.gBig)} ` +
        `${String(c.projected).padStart(6)}`
    );
  });

/* ------------------------------------------------------------------ */
/* 8c. GRANICE ZA IZAZOV                                               */
/*                                                                     */
/* Granica je CENA igraca, ne nasa projekcija: pitanje je da li je     */
/* igrac zaradio ono sto kosta, a ne da li smo mi dobro pogodili.      */
/*                                                                     */
/* Bira se sest poznatih imena kod kojih odgovor nije ocigledan —      */
/* medju cetrdeset najvecih projekcija, ona sa fotografijom kod kojih  */
/* je projekcija najbliza ceni, po jedan iz razlicitih timova.         */
/* ------------------------------------------------------------------ */

const saSlikom = new Set(ourPlayers.filter((p) => p.photo).map((p) => p.id));
const kandidati = [...byId.values()]
  .filter((o) => o.projected > 0 && saSlikom.has(o.player_id))
  .sort((a, b) => b.projected - a.projected)
  .slice(0, 40)
  .sort((a, b) => Math.abs(a.projected - a.price) - Math.abs(b.projected - b.price));

const granice = [];
const zauzet = new Set();
for (const o of kandidati) {
  if (granice.length === 6) break;
  if (zauzet.has(o._team)) continue;
  zauzet.add(o._team);
  granice.push({ round_id: ROUND_ID, player_id: o.player_id, line: o.price, _o: o });
}

head('GRANICE ZA IZAZOV');
log('granica = cena igraca; „iznad" znaci da je zaradio vise nego sto kosta');
log('');
log('igrac                        tim   granica  nasa proj  razlika');
log('-'.repeat(62));
granice.forEach((g) =>
  log(
    `${g._o._name.slice(0, 28).padEnd(28)} ${g._o._team.padEnd(4)} ` +
      `${String(g.line).padStart(8)} ${String(g._o.projected).padStart(10)} ` +
      `${r1(g._o.projected - g.line).toFixed(1).padStart(8)}`
  )
);

head(DRY ? 'DRY RUN — nista nije upisano' : 'UPIS');
if (DRY) {
  log(`player_rounds: ${payload.length} redova`);
  log(`coaches:       ${coaches.length} redova`);
  log(`challenge_lines: ${granice.length} redova`);
} else {
  /* `ownership` stize migracijom 0003. Dok ona nije pustena, kolona ne
     postoji — upis tada ide bez nje umesto da cela skripta padne. */
  let redovi = payload;
  for (let pokusaj = 0; pokusaj < 2; pokusaj++) {
    let greska = null;
    for (let i = 0; i < redovi.length; i += 500) {
      const { error } = await sb
        .from('player_rounds')
        .upsert(redovi.slice(i, i + 500), { onConflict: 'round_id,player_id' });
      if (error) {
        greska = error;
        break;
      }
    }
    if (!greska) break;
    if (pokusaj === 0 && /'ownership' column/.test(greska.message)) {
      log('upozorenje: kolone ownership nema u bazi — pusti supabase/migrations/0003_analitika_kola.sql');
      redovi = payload.map(({ ownership, ...rest }) => rest);
      continue;
    }
    throw new Error(`player_rounds: ${greska.message}`);
  }
  log(`player_rounds: upisano ${redovi.length}${redovi === payload ? ' (sa vlasnistvom)' : ' (bez vlasnistva)'}`);

  const trenerRedovi = coaches.map(({ _meceva, _r, ...rest }) => rest);
  const { error: ce } = await sb.from('coaches').upsert(trenerRedovi, { onConflict: 'id' });
  if (ce) log(`coaches: ${ce.message}`);
  else log(`coaches: upisano ${coaches.length}`);

  /* Granice se prvo brisu: kolo ih ima tacno sest, a ponovno pokretanje
     sa drugim izborom bi inace samo dodalo jos redova. */
  await sb.from('challenge_lines').delete().eq('round_id', ROUND_ID);
  const { error: le } = await sb
    .from('challenge_lines')
    .insert(granice.map(({ _o, ...rest }) => rest));
  if (le) log(`challenge_lines: ${le.message}`);
  else log(`challenge_lines: upisano ${granice.length}`);
}

log('');
