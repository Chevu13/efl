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

const ourPlayers = await all('players', 'id, full_name, short_name, team_code, position, jersey, el_person_code', (q) => q, ['id']);
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
log('\nNAJBOLJA VREDNOST (projekcija po kreditu)');
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

/* Prva tri po vrednosti su izbori kola; prvi je besplatan. */
const ranked = [...writable].filter((o) => o.projected > 0).sort((a, b) => b.value_score - a.value_score);
ranked.forEach((o, i) => {
  o.tier_pick = i === 0 ? 'FREE' : i < 3 ? 'PLUS' : i < 12 ? 'PRO' : null;
});

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
const payload = [...byId.values()].map(({ _name, _team, _pos, _basis, _own, ...rest }) => rest);

const coaches = coachRows.map((c) => ({
  id: `hc-${ourTeam(c['Team Abbr']).toLowerCase()}`,
  round_id: ROUND_ID,
  name: c.Player,
  team_code: ourTeam(c['Team Abbr']),
  price: Number(c.Price),
  projected: r1(priceImplied(Number(c.Price)) * 0.8)
}));

head(DRY ? 'DRY RUN — nista nije upisano' : 'UPIS');
if (DRY) {
  log(`player_rounds: ${payload.length} redova`);
  log(`coaches:       ${coaches.length} redova`);
} else {
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await sb
      .from('player_rounds')
      .upsert(payload.slice(i, i + 500), { onConflict: 'round_id,player_id' });
    if (error) throw new Error(`player_rounds: ${error.message}`);
  }
  log(`player_rounds: upisano ${payload.length}`);

  const { error: ce } = await sb.from('coaches').upsert(coaches, { onConflict: 'id' });
  if (ce) log(`coaches: ${ce.message}`);
  else log(`coaches: upisano ${coaches.length}`);
}

log('');
