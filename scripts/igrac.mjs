/**
 * Statistika jednog igraca iz istorijskog dataseta.
 *
 * Pokretanje:
 *   node scripts/igrac.mjs Grant
 *   node scripts/igrac.mjs Grant --team PAN --season 2025
 *   node scripts/igrac.mjs Grant --log          # i utakmica po utakmica
 *
 * Sve dolazi iz tabele el_player_games, dakle iz zvanicnog boxscore-a.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

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
const query = args.filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true)[0];
const SEASON = Number(flag('season', 2025));
const TEAM = flag('team', null);
const SHOW_LOG = args.includes('--log');

if (!query) {
  console.error('Zadaj ime: node scripts/igrac.mjs Grant');
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const f1 = (n) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(1));
const pct = (m, a) => (a > 0 ? `${((100 * m) / a).toFixed(1)}%` : '—');

/* ---- nadji igraca ---- */
const { data: people } = await sb
  .from('el_players')
  .select('person_code, name, birth_date, height_cm, weight_kg, country')
  .ilike('name', `%${query}%`);

if (!people?.length) {
  console.error(`Nema igraca po imenu "${query}".`);
  process.exit(1);
}

/* ---- ucitaj utakmice ---- */
let q = sb
  .from('el_player_games')
  .select('*')
  .eq('season_year', SEASON)
  .in('person_code', people.map((p) => p.person_code))
  .order('game_date');
if (TEAM) q = q.eq('team_code', TEAM);
const { data: games } = await q;

if (!games?.length) {
  console.error(`"${query}" nema odigranih utakmica u sezoni ${SEASON}${TEAM ? ` za ${TEAM}` : ''}.`);
  console.error('Nadjeni kandidati:', people.map((p) => p.name).join(' | '));
  process.exit(1);
}

/* ---- grupisi po igracu (ime moze da pogodi vise njih) ---- */
const byPerson = new Map();
for (const g of games) {
  if (!byPerson.has(g.person_code)) byPerson.set(g.person_code, []);
  byPerson.get(g.person_code).push(g);
}

for (const [code, rows] of byPerson) {
  const info = people.find((p) => p.person_code === code);
  const played = rows.filter((r) => r.did_play);
  const n = played.length;
  const sum = (k) => played.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const avg = (k) => sum(k) / (n || 1);

  const team = played[0]?.team_code ?? rows[0]?.team_code;

  console.log('\n' + '='.repeat(74));
  console.log(`${info.name}   ·   ${team}   ·   sezona ${SEASON}-${String(SEASON + 1).slice(2)}`);
  console.log('='.repeat(74));
  console.log(
    `rodjen ${info.birth_date ?? '—'}   visina ${info.height_cm ?? '—'} cm   ` +
      `tezina ${info.weight_kg ?? '—'} kg   ${info.country ?? ''}`
  );
  console.log(
    `\nutakmica u protokolu: ${rows.length}   odigrao: ${n}   ` +
      `u startnoj petorci: ${played.filter((r) => r.is_starter).length}`
  );

  console.log('\n--- PROSEK PO UTAKMICI (odigrane) ---');
  const line = (label, v) => console.log(`  ${label.padEnd(24)} ${v}`);
  line('minuti', f1(avg('minutes')));
  line('poeni', f1(avg('points')));
  line('skokovi (of + def)', `${f1(avg('total_rebounds'))}  (${f1(avg('offensive_rebounds'))} + ${f1(avg('defensive_rebounds'))})`);
  line('asistencije', f1(avg('assists')));
  line('ukradene', f1(avg('steals')));
  line('blokade', f1(avg('blocks_favour')));
  line('izgubljene lopte', f1(avg('turnovers')));
  line('faulovi napravljeni', f1(avg('fouls_committed')));
  line('faulovi izazvani', f1(avg('fouls_drawn')));
  line('PIR / fantasy poeni', f1(avg('pir')));
  line('plus/minus', f1(avg('plus_minus')));

  console.log('\n--- SUT ---');
  line('2 poena', `${f1(avg('fgm2'))}/${f1(avg('fga2'))}   ${pct(sum('fgm2'), sum('fga2'))}`);
  line('3 poena', `${f1(avg('fgm3'))}/${f1(avg('fga3'))}   ${pct(sum('fgm3'), sum('fga3'))}`);
  line('slobodna bacanja', `${f1(avg('ftm'))}/${f1(avg('fta'))}   ${pct(sum('ftm'), sum('fta'))}`);
  line('iz igre ukupno', `${f1(avg('fgm_total'))}/${f1(avg('fga_total'))}   ${pct(sum('fgm_total'), sum('fga_total'))}`);

  console.log('\n--- UKUPNO U SEZONI ---');
  line('poeni', String(sum('points')));
  line('skokovi', String(sum('total_rebounds')));
  line('asistencije', String(sum('assists')));
  line('PIR', String(sum('pir')));

  /* raspon i doslednost */
  const fps = played.map((r) => Number(r.pir));
  const mean = fps.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = Math.sqrt(fps.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  console.log('\n--- DOSLEDNOST (fantasy poeni) ---');
  line('prosek', f1(mean));
  line('standardna devijacija', f1(sd));
  line('najbolja / najgora', `${Math.max(...fps)} / ${Math.min(...fps)}`);
  line('utakmica 15+', `${fps.filter((x) => x >= 15).length} od ${n}`);
  line('utakmica ispod 5', `${fps.filter((x) => x < 5).length} od ${n}`);

  /* kod kuce vs u gostima */
  const split = (home) => {
    const g = played.filter((r) => r.is_home === home);
    return g.length ? `${f1(g.reduce((s, r) => s + Number(r.pir), 0) / g.length)} (${g.length} ut.)` : '—';
  };
  console.log('\n--- DOMACI / GOST (fantasy poeni) ---');
  line('kod kuce', split(true));
  line('u gostima', split(false));

  if (SHOW_LOG) {
    console.log('\n--- UTAKMICA PO UTAKMICA ---');
    console.log('kolo  datum       protivnik D/G  min   poe  sko  ast  PIR  +/-');
    console.log('-'.repeat(66));
    for (const r of rows) {
      if (!r.did_play) {
        console.log(`${String(r.round).padStart(4)}  ${r.game_date.slice(0, 10)}  ${r.opponent_code.padEnd(9)} ${r.is_home ? 'D' : 'G'}    nije igrao`);
        continue;
      }
      console.log(
        `${String(r.round).padStart(4)}  ${r.game_date.slice(0, 10)}  ${r.opponent_code.padEnd(9)} ${r.is_home ? 'D' : 'G'}  ` +
          `${f1(Number(r.minutes)).padStart(4)}  ${String(r.points).padStart(3)}  ${String(r.total_rebounds).padStart(3)}  ` +
          `${String(r.assists).padStart(3)}  ${String(r.pir).padStart(3)}  ${String(r.plus_minus ?? '').padStart(4)}`
      );
    }
  }
}
