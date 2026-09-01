/**
 * Stanje slika: ko ima, ko nema, i sta je pokvareno.
 *
 * Pokretanje:
 *   node scripts/slike-status.mjs              # izvestaj
 *   node scripts/slike-status.mjs --spisak     # samo imena fajlova koja fale
 *   node scripts/slike-status.mjs --ocisti     # obrise mrtve putanje iz baze
 *
 * Zasto postoji: kolona `players.photo` moze da pokazuje na fajl koji ne
 * postoji u Storage-u. Baza tada izgleda uredno, a aplikacija za svakog
 * takvog igraca salje zahtev koji vrati 404. Ovo to nalazi.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, readdir } from 'node:fs/promises';
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
const ONLY_LIST = args.includes('--spisak');
const CLEAN = args.includes('--ocisti');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

/** Svi fajlovi u jednom javnom bucketu. */
async function listBucket(name) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const { data, error } = await sb.storage.from(name).list('', { limit: 100, offset: off });
    if (error || !data?.length) break;
    out.push(...data.map((f) => f.name));
    if (data.length < 100) break;
  }
  return new Set(out);
}

const inStorage = await listBucket('players');
const inLogos = await listBucket('logos');

const { data: players } = await sb
  .from('players')
  .select('id, short_name, team_code, photo')
  .order('team_code');
const { data: teams } = await sb.from('teams').select('code, name_sr, logo').order('code');

const fileOf = (photo) => (photo ?? '').replace(/^players\//, '');
const missing = players.filter((p) => {
  const f = fileOf(p.photo);
  return !f || !inStorage.has(f);
});

/* ---- samo spisak imena fajlova, za kopiranje ---- */
if (ONLY_LIST) {
  missing.forEach((p) => console.log(`${p.id}.jpg`));
  process.exit(0);
}

/* ---- ciscenje mrtvih putanja ---- */
if (CLEAN) {
  const dead = missing.filter((p) => p.photo);
  console.log(`Brisem ${dead.length} mrtvih putanja iz players.photo…`);
  for (const p of dead) {
    const { error } = await sb.from('players').update({ photo: null }).eq('id', p.id);
    if (error) console.error(`  ! ${p.id}: ${error.message}`);
  }
  console.log('Gotovo. Ti igraci sada crtaju inicijale umesto da salju 404.');
  process.exit(0);
}

/* ---- izvestaj ---- */
console.log('='.repeat(66));
console.log('SLIKE IGRACA');
console.log('='.repeat(66));
console.log(`u bazi:            ${players.length}`);
console.log(`u Storage-u:       ${inStorage.size}`);
console.log(`ima ispravnu sliku: ${players.length - missing.length}`);
console.log(`FALI:              ${missing.length}`);

const brokenPath = missing.filter((p) => p.photo).length;
if (brokenPath) {
  console.log(
    `\n  od toga ${brokenPath} ima upisanu putanju koja ne postoji u Storage-u —` +
      `\n  to su zahtevi koji vracaju 404 pri svakom ucitavanju stranice.` +
      `\n  Pokreni  node scripts/slike-status.mjs --ocisti  da ih ocistis.`
  );
}

const byTeam = {};
missing.forEach((p) => (byTeam[p.team_code ?? '—'] ||= []).push(p));
console.log('\nPO TIMU:');
for (const code of Object.keys(byTeam).sort()) {
  const t = teams.find((x) => x.code === code);
  console.log(`\n  ${code} — ${t?.name_sr ?? '?'}  (${byTeam[code].length})`);
  byTeam[code].forEach((p) => console.log(`     ${p.id}.jpg`.padEnd(34) + p.short_name));
}

/* ---- lokalni folder ---- */
const dir = 'public/slike/players';
const local = existsSync(dir) ? await readdir(dir) : [];
const ids = new Set(players.map((p) => p.id));
const orphan = local.filter((f) => !ids.has(f.replace(/\.(png|jpe?g|webp)$/i, '')));
console.log(`\n${'='.repeat(66)}`);
console.log(`LOKALNO u ${dir}: ${local.length} fajlova`);
if (orphan.length) {
  console.log(`  ${orphan.length} bez para u bazi (nece biti poslato):`);
  orphan.slice(0, 10).forEach((f) => console.log(`     ${f}`));
}

/* ---- grbovi ---- */
const noLogo = teams.filter((t) => {
  const f = (t.logo ?? '').replace(/^logos\//, '');
  return !f || !inLogos.has(f);
});
console.log(`\nGRBOVI: ${teams.length - noLogo.length}/${teams.length} ispravnih`);
if (noLogo.length) noLogo.forEach((t) => console.log(`  fali: ${t.code}.jpg  (${t.name_sr})`));
