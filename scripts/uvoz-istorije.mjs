/**
 * Uvoz istorijske EuroLeague statistike na nivou IGRAC × UTAKMICA.
 *
 * Pokretanje:
 *   node scripts/uvoz-istorije.mjs                 # poslednja kompletna sezona
 *   node scripts/uvoz-istorije.mjs --season 2025
 *   node scripts/uvoz-istorije.mjs --from 2023 --to 2025
 *   node scripts/uvoz-istorije.mjs --dry           # nista ne upisuje
 *   node scripts/uvoz-istorije.mjs --limit 20      # samo prvih N utakmica
 *   node scripts/uvoz-istorije.mjs --interval 800  # sporije, ako te API ogranici
 *
 * Ocekivano trajanje pune sezone (402 utakmice): 4–8 minuta.
 *
 * Sve dolazi iz zvanicnog EuroLeague API-ja preko `euroleague-api`.
 * Nijedan broj se ne izmislja; jedino izvedeno polje je `fantasy_pts`
 * (vidi FANTASY_PTS nize) i ono se racuna iz stvarnih boxscore brojeva.
 *
 * Skripta je idempotentna — pokreni je koliko god puta hoces, upisuje
 * preko istog kljuca (sezona, utakmica, igrac).
 *
 * Trazi u .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { EuroleagueClient } from 'euroleague-api';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/* ------------------------------------------------------------------ */
/* okruzenje                                                           */
/* ------------------------------------------------------------------ */

const ENV = ['.env.local', '.env'].find((f) => existsSync(f));
if (!ENV) {
  console.error('Ne vidim .env.local — pokreni iz korena projekta.');
  process.exit(1);
}
let txt = await readFile(ENV, 'utf8');
if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
for (const red of txt.split(/\r?\n/)) {
  const l = red.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 1) continue;
  const v = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  if (v) process.env[l.slice(0, i).trim()] ??= v;
}

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const flag = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = args.includes('--dry');

if (!DRY && (!SB_URL || !SB_KEY)) {
  console.error('Nedostaje NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = DRY ? null : createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
/**
 * EuroLeague zivi iza Cloudflare-a koji na `api-live` origin-u ume da
 * vrati 1015 (429) ako se ide prebrzo. Zato je razmak izmedju zahteva
 * podignut iznad podrazumevanih 250ms, a odustajanje je strpljivo:
 * pet pokusaja sa dugim backoff-om. Uvoz od par stotina utakmica se
 * radi jednom, pa nema razloga da bude agresivan.
 */
const el = new EuroleagueClient({
  competition: 'euroleague',
  retries: 5,
  retry: { baseDelayMs: 2_000, maxDelayMs: 90_000, jitter: true },
  timeoutMs: 60_000,
  liveFeedIntervalMs: Number(flag('interval') ?? 500)
});

/** Koliko zahteva sme paralelno. Namerno malo. */
const CONCURRENCY = Number(flag('concurrency') ?? 2);

/* ------------------------------------------------------------------ */
/* pomocno                                                             */
/* ------------------------------------------------------------------ */

const log = (...a) => console.log(...a);
const head = (t) => log('\n' + '='.repeat(66) + '\n' + t + '\n' + '='.repeat(66));

/** 'MM:SS' -> sekunde. 'DNP', prazno i null daju 0. */
function secondsOf(minutes) {
  if (!minutes || typeof minutes !== 'string') return 0;
  const m = minutes.match(/^(\d+):(\d{1,2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Fantasy poeni.
 *
 * EuroLeague Fantasy Challenge boduje igraca njegovim PIR-om
 * (valuation iz boxscore-a). Ako se pravila ikad promene, menja se samo
 * ova funkcija — nigde drugde se fantasy poeni ne racunaju.
 */
const FANTASY_PTS = (row) => row.valuation ?? 0;

/** Pokrece poslove sa najvise `limit` u letu, cuvajuci redosled. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function upsert(table, rows, onConflict) {
  if (DRY) return log(`  [dry] ${table}: ${rows.length} redova`);
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  log(`  ${table}: upisano ${rows.length}`);
}

/* ------------------------------------------------------------------ */
/* koje sezone                                                         */
/* ------------------------------------------------------------------ */

process.on('unhandledRejection', (e) => {
  if (e?.status === 429) {
    const wait = Math.ceil((e.retryAfterMs ?? 60_000) / 1000);
    console.error(
      [
        '',
        '!! EuroLeague te trenutno ogranicava (Cloudflare 1015).',
        `   Sacekaj ${wait}s pa pokreni ponovo, ili uspori:`,
        '   node scripts/uvoz-istorije.mjs --interval 1000 --concurrency 1',
        ''
      ].join('\n')
    );
  } else {
    console.error('\n!! ', e?.message ?? e);
  }
  process.exit(1);
});

const seasons = await el.seasons.list();
const complete = seasons
  .filter((s) => s.winner?.name && new Date(s.endDate).getTime() < Date.now())
  .sort((a, b) => b.year - a.year);

let years;
if (flag('season')) years = [Number(flag('season'))];
else if (flag('from')) {
  const from = Number(flag('from'));
  const to = Number(flag('to') ?? complete[0].year);
  years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
} else years = [complete[0].year];

head(`UVOZ — sezone: ${years.join(', ')}${DRY ? '   (DRY RUN)' : ''}`);
log(`poslednja kompletna po API-ju: ${complete[0].code} (${complete[0].alias}) — ${complete[0].winner.name}`);

/* ------------------------------------------------------------------ */

for (const year of years) {
  const meta = seasons.find((s) => s.year === year);
  head(`SEZONA ${year} — ${meta?.alias ?? '?'}`);

  /* ---- 1. sezona ---- */
  await upsert(
    'el_seasons',
    [
      {
        code: meta.code,
        year,
        alias: meta.alias,
        name: meta.name,
        competition: meta.competitionCode ?? 'E',
        start_date: meta.startDate?.slice(0, 10) ?? null,
        end_date: meta.endDate?.slice(0, 10) ?? null,
        winner_code: meta.winner?.code ?? null,
        winner_name: meta.winner?.name ?? null,
        is_complete: Boolean(meta.winner?.name),
        imported_at: new Date().toISOString()
      }
    ],
    'code'
  );

  /* ---- 2. timovi ---- */
  const clubs = await el.clubs.list({ season: year });
  await upsert(
    'el_teams',
    clubs.map((c) => ({
      code: c.code,
      season_year: year,
      name: c.name,
      abbreviated: c.abbreviatedName ?? null,
      tv_code: c.tvCode ?? null,
      country: c.country?.name ?? null,
      city: c.city ?? null,
      crest_url: c.images?.crest ?? null
    })),
    'code,season_year'
  );

  /* ---- 3. igraci iz rostera (bogatiji podaci nego iz boxscore-a) ---- */
  const rosters = await mapLimit(clubs, CONCURRENCY, (c) =>
    el.clubs.getRoster({ clubCode: c.code, season: year }).catch(() => [])
  );
  const people = new Map();
  for (const r of rosters.flat()) {
    const p = r?.person;
    if (!p?.code || r.typeName !== 'Player') continue;
    people.set(p.code, {
      person_code: p.code,
      name: p.name ?? p.alias ?? '',
      jersey_name: p.jerseyName ?? null,
      birth_date: p.birthDate?.slice(0, 10) ?? null,
      country: p.country?.name ?? null,
      height_cm: p.height || null,
      weight_kg: p.weight || null,
      headshot_url: r.images?.headshot ?? null,
      updated_at: new Date().toISOString()
    });
  }
  await upsert('el_players', [...people.values()], 'person_code');

  /* ---- 4. raspored ---- */
  const schedule = await el.schedule.getSeason({ season: year });
  let played = schedule.filter((g) => g.played);
  if (flag('limit')) played = played.slice(0, Number(flag('limit')));
  log(`\nutakmica: ${schedule.length}, odigrano: ${played.length}`);

  await upsert(
    'el_games',
    played.map((g) => ({
      season_year: year,
      game_code: g.gameCode,
      round: g.round ?? null,
      phase_code: g.phaseType?.code ?? null,
      phase_name: g.phaseType?.name ?? null,
      played: true,
      tip_off: g.utcDate ?? g.date ?? null,
      local_date: g.localDate ?? null,
      home_code: g.local.club.code,
      away_code: g.road.club.code,
      home_score: g.local.score ?? null,
      away_score: g.road.score ?? null,
      home_q1: g.local.partials?.partials1 ?? null,
      home_q2: g.local.partials?.partials2 ?? null,
      home_q3: g.local.partials?.partials3 ?? null,
      home_q4: g.local.partials?.partials4 ?? null,
      away_q1: g.road.partials?.partials1 ?? null,
      away_q2: g.road.partials?.partials2 ?? null,
      away_q3: g.road.partials?.partials3 ?? null,
      away_q4: g.road.partials?.partials4 ?? null,
      venue: g.venue?.name ?? null,
      audience: g.audience ?? null
    })),
    'season_year,game_code'
  );

  /* ---- 5. IGRAC × UTAKMICA ---- */

  /**
   * Preuzima se po utakmici. SDK i za `getPlayerStatsRound` interno gadja
   * svaku utakmicu posebno, pa po kolu nije usteda u broju zahteva — a
   * nosi rizik da se red pripise pogresnom mecu. Ovako svaki red dolazi
   * sa svojim `gameCode` i nema sta da se pogadja.
   */
  log(`
boxscore po utakmici (${played.length} zahteva)…`);

  const t0 = Date.now();
  let done = 0;
  const failures = [];

  const perGame = await mapLimit(played, CONCURRENCY, async (g) => {
    try {
      const rows = await el.boxscore.getPlayerStats({ gameCode: g.gameCode, season: year });
      done++;
      if (done % 25 === 0 || done === played.length) {
        log(`  ${done}/${played.length} (${Math.round((done / played.length) * 100)}%)`);
      }
      return { g, rows };
    } catch (e) {
      failures.push({ gameCode: g.gameCode, error: e.message });
      return { g, rows: [] };
    }
  });
  log(`  preuzeto za ${Math.round((Date.now() - t0) / 1000)}s`);
  if (failures.length) {
    log(`  !! nije preuzeto ${failures.length} od ${played.length} utakmica`);
    failures.slice(0, 3).forEach((f) => log(`     gameCode=${f.gameCode} — ${f.error}`));
    log('     (uvoz je idempotentan — pokreni ponovo da dopuni sto fali)');
  }

  const playerGames = [];
  const teamGames = new Map();
  for (const { g, rows } of perGame) {
    for (const r of rows) {
      const personCode = String(r.playerId ?? '').replace(/^P/, '');
      if (!personCode) continue;

      const homeCode = g.local.club.code;
      const awayCode = g.road.club.code;
      const isHome = r.team === homeCode;
      const teamScore = isHome ? g.local.score : g.road.score;
      const oppScore = isHome ? g.road.score : g.local.score;
      const seconds = secondsOf(r.minutes);

      playerGames.push({
        season_year: year,
        game_code: g.gameCode,
        person_code: personCode,
        team_code: r.team,
        opponent_code: isHome ? awayCode : homeCode,
        is_home: isHome,
        round: g.round ?? null,
        phase_code: g.phaseType?.code ?? null,
        game_date: g.utcDate ?? g.date ?? null,
        team_score: teamScore ?? null,
        opponent_score: oppScore ?? null,
        won: teamScore != null && oppScore != null ? teamScore > oppScore : null,

        dorsal: Number.isFinite(r.dorsal) ? r.dorsal : null,
        is_starter: r.isStarter === 1,
        did_play: seconds > 0,
        seconds_played: seconds,
        minutes: Math.round((seconds / 60) * 100) / 100,

        points: r.points ?? 0,
        fgm2: r.fieldGoalsMade2 ?? 0,
        fga2: r.fieldGoalsAttempted2 ?? 0,
        fgm3: r.fieldGoalsMade3 ?? 0,
        fga3: r.fieldGoalsAttempted3 ?? 0,
        ftm: r.freeThrowsMade ?? 0,
        fta: r.freeThrowsAttempted ?? 0,
        fgm_total: (r.fieldGoalsMade2 ?? 0) + (r.fieldGoalsMade3 ?? 0),
        fga_total: (r.fieldGoalsAttempted2 ?? 0) + (r.fieldGoalsAttempted3 ?? 0),
        offensive_rebounds: r.offensiveRebounds ?? 0,
        defensive_rebounds: r.defensiveRebounds ?? 0,
        total_rebounds: r.totalRebounds ?? 0,
        assists: r.assistances ?? 0,
        steals: r.steals ?? 0,
        turnovers: r.turnovers ?? 0,
        blocks_favour: r.blocksFavour ?? 0,
        blocks_against: r.blocksAgainst ?? 0,
        fouls_committed: r.foulsCommited ?? 0,
        fouls_drawn: r.foulsReceived ?? 0,
        pir: r.valuation ?? 0,
        plus_minus: r.plusminus ?? null,
        fantasy_pts: FANTASY_PTS(r)
      });

      /* timski total = zbir igraca (zvanicni rezultat dolazi iz rasporeda) */
      const key = `${g.gameCode}|${r.team}`;
      const t = teamGames.get(key) ?? {
        season_year: year,
        game_code: g.gameCode,
        team_code: r.team,
        opponent_code: isHome ? awayCode : homeCode,
        is_home: isHome,
        round: g.round ?? null,
        points: teamScore ?? 0,
        opponent_points: oppScore ?? 0,
        won: teamScore != null && oppScore != null ? teamScore > oppScore : null,
        fgm2: 0, fga2: 0, fgm3: 0, fga3: 0, ftm: 0, fta: 0,
        offensive_rebounds: 0, defensive_rebounds: 0, total_rebounds: 0,
        assists: 0, steals: 0, turnovers: 0,
        blocks_favour: 0, blocks_against: 0,
        fouls_committed: 0, fouls_drawn: 0, pir: 0
      };
      t.fgm2 += r.fieldGoalsMade2 ?? 0;
      t.fga2 += r.fieldGoalsAttempted2 ?? 0;
      t.fgm3 += r.fieldGoalsMade3 ?? 0;
      t.fga3 += r.fieldGoalsAttempted3 ?? 0;
      t.ftm += r.freeThrowsMade ?? 0;
      t.fta += r.freeThrowsAttempted ?? 0;
      t.offensive_rebounds += r.offensiveRebounds ?? 0;
      t.defensive_rebounds += r.defensiveRebounds ?? 0;
      t.total_rebounds += r.totalRebounds ?? 0;
      t.assists += r.assistances ?? 0;
      t.steals += r.steals ?? 0;
      t.turnovers += r.turnovers ?? 0;
      t.blocks_favour += r.blocksFavour ?? 0;
      t.blocks_against += r.blocksAgainst ?? 0;
      t.fouls_committed += r.foulsCommited ?? 0;
      t.fouls_drawn += r.foulsReceived ?? 0;
      t.pir += r.valuation ?? 0;
      teamGames.set(key, t);
    }
  }


  log(`\nredova IGRAC × UTAKMICA: ${playerGames.length}`);
  await upsert('el_player_games', playerGames, 'season_year,game_code,person_code');
  await upsert('el_team_games', [...teamGames.values()], 'season_year,game_code,team_code');
}

/* ------------------------------------------------------------------ */
/* mapiranje na nase entitete                                          */
/* ------------------------------------------------------------------ */

head('MAPIRANJE NA NASE TABELE');

if (DRY) {
  log('[dry] preskocen upis mapiranja');
} else {
  /* --- timovi: po imenu na engleskom --- */
  const { data: ourTeams } = await sb.from('teams').select('code, name_en, name_sr, el_code');
  const { data: elTeams } = await sb
    .from('el_teams')
    .select('code, name, abbreviated')
    .eq('season_year', years[0]);

  const norm = (s) =>
    (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z]/g, '');

  let mapped = 0;
  const unmapped = [];
  for (const t of ourTeams ?? []) {
    const mine = norm(t.name_en);
    const hit = (elTeams ?? []).find((e) => {
      const a = norm(e.name);
      const b = norm(e.abbreviated);
      return a.includes(mine) || mine.includes(a) || (b && (b.includes(mine) || mine.includes(b)));
    });
    if (hit) {
      if (t.el_code !== hit.code) {
        await sb.from('teams').update({ el_code: hit.code }).eq('code', t.code);
      }
      mapped++;
    } else unmapped.push(`${t.code} (${t.name_en})`);
  }
  log(`timovi: povezano ${mapped}/${(ourTeams ?? []).length}`);
  if (unmapped.length) log(`  bez para: ${unmapped.join(', ')}`);

  /* --- igraci: prezime + inicijal, unutar istog tima --- */
  const { data: ourPlayers } = await sb
    .from('players')
    .select('id, full_name, short_name, team_code, el_person_code');
  const { data: elPlayers } = await sb.from('el_players').select('person_code, name');

  /* 'LARKIN, SHANE' -> { prezime:'larkin', inicijal:'s' } */
  const elIndex = new Map();
  for (const p of elPlayers ?? []) {
    const [last = '', first = ''] = p.name.split(',').map((x) => x.trim());
    elIndex.set(`${norm(last)}|${norm(first)[0] ?? ''}`, p.person_code);
  }

  let pmapped = 0;
  const pmissing = [];
  for (const p of ourPlayers ?? []) {
    /* nasi oblici: 'D. DeJulius' ili 'Dotson D.' */
    const parts = (p.short_name ?? p.full_name ?? '').split(/\s+/).filter(Boolean);
    const surname = parts.find((w) => w.replace(/\./g, '').length > 1) ?? '';
    const initial = parts.find((w) => w.replace(/\./g, '').length === 1) ?? '';
    const key = `${norm(surname)}|${norm(initial)[0] ?? ''}`;
    const hit = elIndex.get(key);
    if (hit) {
      if (p.el_person_code !== hit) {
        await sb.from('players').update({ el_person_code: hit }).eq('id', p.id);
      }
      pmapped++;
    } else pmissing.push(p.short_name);
  }
  log(`igraci: povezano ${pmapped}/${(ourPlayers ?? []).length}`);
  if (pmissing.length) {
    log(`  bez para (${pmissing.length}): ${pmissing.slice(0, 20).join(', ')}${pmissing.length > 20 ? ' …' : ''}`);
  }
}

head('GOTOVO');
