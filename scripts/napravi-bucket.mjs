/**
 * Pravi Storage bucket ako ga nema.
 *
 *   node scripts/napravi-bucket.mjs avatars
 *
 * Postoji zato sto se bucket ne moze napraviti SQL migracijom bez
 * dodatnih prava, a rucno klikanje po panelu se ne vidi u repou.
 * Pokretanje vise puta ne skodi.
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

const ime = process.argv[2];
if (!ime) {
  console.error('Upotreba: node scripts/napravi-bucket.mjs <ime>');
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const { data: postojeci } = await sb.storage.listBuckets();
if (postojeci?.some((b) => b.name === ime)) {
  console.log(`Bucket "${ime}" vec postoji.`);
  process.exit(0);
}

const { error } = await sb.storage.createBucket(ime, {
  public: true,
  fileSizeLimit: 2 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
});
if (error) throw new Error(error.message);
console.log(`Bucket "${ime}" napravljen — javan, do 2 MB, jpeg/png/webp.`);
