/**
 * Skida fotografije igraca i grbove timova sa zvanicnog EuroLeague feeda.
 *
 * Pokretanje:
 *   node scripts/slike-evroliga.mjs            # samo ono sto fali
 *   node scripts/slike-evroliga.mjs --sve      # i one koji vec imaju sliku
 *   node scripts/slike-evroliga.mjs --dry      # samo izvestaj, nista se ne menja
 *
 * Trazi u .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Igraci se vezuju preko `players.el_person_code` — sifre osobe u EuroLeague
 * bazi. Ko tu sifru nema, trazi se po prezimenu i pocetnom slovu imena unutar
 * istog kluba; kad se tako nadje, sifra se upise u bazu da sledeci put ide
 * direktno.
 *
 * Feed nosi slike samo u spisku po klubu (`clubs/<kod>/people`), ne u
 * zbirnom spisku ljudi — zato se ide klub po klub.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/* ---- .env.local, bez dodatnih paketa ---- */
const ENV = ['.env.local', '.env'].find((f) => existsSync(f));
if (!ENV) {
  console.error('Ne vidim .env.local — pokreni skriptu iz korena projekta.');
  process.exit(1);
}
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
const SVE = args.includes('--sve');
const DRY = args.includes('--dry');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

/* Sezone se gledaju od novije ka starijoj: ko je u novoj bez slike, moze
   da je ima iz prosle. */
const SEZONE = ['E2026', 'E2025'];
const API = 'https://api-live.euroleague.net/v2/competitions/E/seasons';

const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));

/* Feed vraca 429 ako se cuka bez pauze — ceka se i pokusava ponovo. */
const json = async (url) => {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (r.ok) return r.json();
    if (r.status !== 429 || i === 4) throw new Error(`${r.status} ${url}`);
    await spavaj(1500 * (i + 1));
  }
};
const rows = (d) => (Array.isArray(d) ? d : (d?.data ?? []));

/* ---- ko sve nema sliku ---- */
async function listBucket(name) {
  const out = new Set();
  for (let off = 0; ; off += 100) {
    const { data, error } = await sb.storage.from(name).list('', { limit: 100, offset: off });
    if (error || !data?.length) break;
    data.forEach((f) => out.add(f.name));
    if (data.length < 100) break;
  }
  return out;
}

const [uStorageu, uLogosu] = await Promise.all([listBucket('players'), listBucket('logos')]);
const { data: players } = await sb
  .from('players')
  .select('id, short_name, team_code, photo, el_person_code')
  .eq('active', true);
const { data: teams } = await sb.from('teams').select('code, name_sr, logo');

const imaSliku = (p) => {
  const f = (p.photo ?? '').replace(/^players\//, '');
  return !!f && uStorageu.has(f);
};
const traze = SVE ? players : players.filter((p) => !imaSliku(p));

console.log(`u bazi ${players.length} igraca, bez slike ${players.filter((p) => !imaSliku(p)).length}`);
console.log(`trazim slike za ${traze.length}\n`);

/* ---- feed: sifra osobe -> fotografija, kod kluba -> grb ---- */
const foto = new Map();
const grb = new Map();
/* prezime+inicijal+nas kod tima -> sifra osobe, za igrace bez sifre */
const poImenu = new Map();
const svuda = new Map();
const golo = (t) =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
/* „P. Mills" i „M. Fodzo Dada" -> mills-p, fodzodada-m */
const kljucNas = (p) => {
  const m = /^([A-Za-z])\.\s*(.+)$/.exec(p.short_name ?? '');
  return m ? `${golo(m[2])}-${golo(m[1])}-${p.team_code}` : null;
};
/* Nasi kodovi timova nisu kodovi iz feeda (EA7 : MIL), pa se klub prepozna
   preko igraca: sifra osobe iz naseg tima vodi do kluba u feedu. */
const klubPoNasem = new Map();
const sifraNasa = new Map(players.filter((p) => p.el_person_code).map((p) => [p.el_person_code, p.team_code]));

for (const sezona of SEZONE) {
  const klubovi = rows(await json(`${API}/${sezona}/clubs`));
  for (const k of klubovi) {
    if (k.images?.crest && !grb.has(k.code)) grb.set(k.code, k.images.crest);
    let ljudi;
    try {
      ljudi = rows(await json(`${API}/${sezona}/clubs/${k.code}/people`));
    } catch (e) {
      console.error(`  ! ${sezona} ${k.code}: ${e.message}`);
      continue;
    }
    for (const o of ljudi) {
      const url = o.images?.headshot ?? o.images?.action;
      const kod = o.person?.code;
      if (url && kod && !foto.has(kod)) foto.set(kod, url);
      const nas = sifraNasa.get(kod);
      if (nas && !klubPoNasem.has(nas)) klubPoNasem.set(nas, k.code);
      /* „WATERS, TREMONT" -> waters-t */
      const im = /^(.+?),\s*(.)/.exec(o.person?.name ?? '');
      if (url && im && o.type === 'J') {
        const kl = `${golo(im[1])}-${golo(im[2])}-${k.code}`;
        if (!poImenu.has(kl)) poImenu.set(kl, url);
        /* Igraci se menjaju klubove izmedju sezona, pa se prezime i
           inicijal pamte i bez kluba. Ako se dvojica tako poklope, taj
           kljuc se odbacuje — bolje bez slike nego tudja slika. */
        const bezKluba = `${golo(im[1])}-${golo(im[2])}`;
        if (svuda.has(bezKluba)) {
          if (svuda.get(bezKluba) !== url) svuda.set(bezKluba, null);
        } else {
          svuda.set(bezKluba, url);
        }
      }
    }
    await spavaj(250);
  }
  console.log(`${sezona}: ${klubovi.length} klubova, ukupno ${foto.size} fotografija u feedu`);
}

/* ---- prenos ---- */
let ok = 0;
const bezSifre = [];
const nemaUFeedu = [];
const pukli = [];

/* nas kod tima -> kod kluba u feedu, za trazenje po imenu */
const feedKod = klubPoNasem;

for (const p of traze) {
  const kn = kljucNas(p);
  const url =
    (p.el_person_code ? foto.get(p.el_person_code) : null) ??
    (kn ? poImenu.get(kn.replace(`-${p.team_code}`, `-${feedKod.get(p.team_code) ?? p.team_code}`)) : null) ??
    (kn ? svuda.get(kn.slice(0, kn.lastIndexOf('-'))) : null);
  if (!url) {
    (p.el_person_code ? nemaUFeedu : bezSifre).push(p);
    continue;
  }
  if (DRY) {
    ok++;
    continue;
  }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`skidanje ${r.status}`);
    const tip = r.headers.get('content-type') ?? 'image/png';
    const ext = tip.includes('jpeg') ? 'jpg' : tip.includes('webp') ? 'webp' : 'png';
    const putanja = `${p.id}.${ext}`;
    const { error: up } = await sb.storage
      .from('players')
      .upload(putanja, Buffer.from(await r.arrayBuffer()), { contentType: tip, upsert: true });
    if (up) throw new Error(`upload ${up.message}`);
    const { error: db } = await sb.from('players').update({ photo: `players/${putanja}` }).eq('id', p.id);
    if (db) throw new Error(`baza ${db.message}`);
    ok++;
    console.log(`  + ${p.id}`);
  } catch (e) {
    pukli.push([p, e.message]);
  }
}

/* ---- grbovi timova koji ih nemaju ---- */

let grbovi = 0;
for (const t of teams) {
  const f = (t.logo ?? '').replace(/^logos\//, '');
  if (!SVE && f && uLogosu.has(f)) continue;
  const url = grb.get(klubPoNasem.get(t.code));
  if (!url) continue;
  if (DRY) {
    grbovi++;
    continue;
  }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const tip = r.headers.get('content-type') ?? 'image/png';
    const putanja = `${t.code}.${tip.includes('jpeg') ? 'jpg' : tip.includes('svg') ? 'svg' : 'png'}`;
    const { error: up } = await sb.storage
      .from('logos')
      .upload(putanja, Buffer.from(await r.arrayBuffer()), { contentType: tip, upsert: true });
    if (up) throw new Error(up.message);
    await sb.from('teams').update({ logo: `logos/${putanja}` }).eq('code', t.code);
    grbovi++;
    console.log(`  grb ${t.code} — ${t.name_sr}`);
  } catch (e) {
    console.error(`  ! grb ${t.code}: ${e.message}`);
  }
}

/* ---- izvestaj ---- */
console.log('\n' + '='.repeat(60));
console.log(DRY ? `naslo bi ${ok} slika i ${grbovi} grbova (--dry)` : `preneto ${ok} slika i ${grbovi} grbova`);
if (bezSifre.length) {
  console.log(`\nbez el_person_code (${bezSifre.length}) — ne mogu da ih nadjem u feedu:`);
  bezSifre.forEach((p) => console.log(`   ${p.id.padEnd(26)} ${p.short_name}`));
}
if (nemaUFeedu.length) {
  console.log(`\nfeed nema fotografiju (${nemaUFeedu.length}):`);
  nemaUFeedu.forEach((p) => console.log(`   ${p.id.padEnd(26)} ${p.short_name}`));
}
if (pukli.length) {
  console.log(`\npuklo (${pukli.length}):`);
  pukli.forEach(([p, m]) => console.log(`   ${p.id.padEnd(26)} ${m}`));
}
