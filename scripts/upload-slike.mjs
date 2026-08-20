/**
 * Ubacuje slike igrača u Supabase Storage i povezuje ih sa tabelom players.
 *
 * Pokretanje:
 *   node scripts/upload-slike.mjs
 *
 * Traži u .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY      (Settings -> API -> service_role)
 *
 * Slike stavi u  public/slike/players/  pre pokretanja.
 * Ime fajla mora biti id igrača iz baze, npr.  james-m-efs.png
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// --- ucitaj .env.local rucno, bez dodatnih paketa ---
const ENV_FAJL = ['.env.local', '.env'].find((f) => existsSync(f));

if (ENV_FAJL) {
  let txt = await readFile(ENV_FAJL, 'utf8');
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);          // BOM iz Notepada
  for (const red of txt.split(/\r?\n/)) {                        // CRLF sa Windowsa
    const linija = red.trim();
    if (!linija || linija.startsWith('#')) continue;
    const i = linija.indexOf('=');
    if (i < 1) continue;
    const kljuc = linija.slice(0, i).trim();
    const vrednost = linija.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (vrednost) process.env[kljuc] ??= vrednost;
  }
  console.log(`učitano iz ${ENV_FAJL}`);
} else {
  console.error('Ne vidim .env.local u ovom folderu.');
  console.error('Pokreni skriptu iz korena projekta (tamo gde je package.json).');
  console.error('Ako si fajl pravio Notepad-om, možda se zove .env.local.txt — preimenuj ga.');
  console.error('\nU folderu vidim:');
  for (const f of (await readdir('.')).filter((f) => f.startsWith('.env'))) {
    console.error('  ' + f);
  }
  process.exit(1);
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  if (!URL) console.error('Nedostaje NEXT_PUBLIC_SUPABASE_URL');
  if (!KEY) console.error('Nedostaje SUPABASE_SERVICE_ROLE_KEY');
  console.error(`\nPročitao sam ${ENV_FAJL}, ali taj ključ nije u njemu (ili je prazan).`);
  console.error('Proveri da nema razmaka oko znaka = i da vrednost nije u navodnicima.');
  process.exit(1);
}

if (!KEY.startsWith('eyJ') || KEY.length < 100) {
  console.error('SUPABASE_SERVICE_ROLE_KEY ne izgleda ispravno — treba da počinje sa "eyJ".');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const POSLOVI = [
  { folder: 'public/slike/players', bucket: 'players', tabela: 'players', kolona: 'photo', kljuc: 'id' },
  { folder: 'public/slike/logos', bucket: 'logos', tabela: 'teams', kolona: 'logo', kljuc: 'code' }
];

for (const p of POSLOVI) {
  if (!existsSync(p.folder)) {
    console.log(`preskačem ${p.folder} — nema foldera`);
    continue;
  }

  // bucket mora postojati i biti javan
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === p.bucket)) {
    const { error } = await sb.storage.createBucket(p.bucket, { public: true });
    if (error) { console.error(`ne mogu da napravim bucket ${p.bucket}:`, error.message); continue; }
    console.log(`napravljen javni bucket: ${p.bucket}`);
  }

  const fajlovi = (await readdir(p.folder)).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
  console.log(`\n${p.bucket}: ${fajlovi.length} fajlova`);

  let ok = 0, nemaUBazi = 0, greske = 0;

  for (const fajl of fajlovi) {
    const id = path.parse(fajl).name;
    const ext = path.extname(fajl).slice(1).toLowerCase();
    const tip = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    // postoji li uopste taj igrac / tim u bazi
    const { data: red } = await sb
      .from(p.tabela).select(p.kljuc).eq(p.kljuc, p.bucket === 'logos' ? id.toUpperCase() : id)
      .maybeSingle();
    if (!red) { console.warn(`  ? ${fajl} — nema ga u tabeli ${p.tabela}`); nemaUBazi++; continue; }

    const putanja = `${p.bucket}/${fajl}`;
    const telo = await readFile(path.join(p.folder, fajl));

    const { error: up } = await sb.storage.from(p.bucket)
      .upload(fajl, telo, { contentType: tip, upsert: true, cacheControl: '31536000' });
    if (up) { console.error(`  ! ${fajl}: ${up.message}`); greske++; continue; }

    const { error: db } = await sb
      .from(p.tabela).update({ [p.kolona]: putanja })
      .eq(p.kljuc, p.bucket === 'logos' ? id.toUpperCase() : id);
    if (db) { console.error(`  ! ${fajl} (baza): ${db.message}`); greske++; continue; }

    ok++;
    process.stdout.write(`\r  poslato ${ok}/${fajlovi.length}`);
  }

  console.log(`\n  gotovo: ${ok} ubačeno, ${nemaUBazi} bez para u bazi, ${greske} grešaka`);
}

// --- pregled stanja ---
const { count: ukupno } = await sb.from('players').select('*', { count: 'exact', head: true });
const { count: saSlikom } = await sb
  .from('players').select('*', { count: 'exact', head: true }).not('photo', 'is', null);

console.log(`\nIgrača u bazi: ${ukupno} · sa slikom: ${saSlikom} · bez slike: ${(ukupno ?? 0) - (saSlikom ?? 0)}`);
