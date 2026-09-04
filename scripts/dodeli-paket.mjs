/**
 * Rucna dodela paketa nalogu — bez PayPal-a.
 *
 * Pokretanje:
 *   node scripts/dodeli-paket.mjs vuk@primer.com ULTRA
 *   node scripts/dodeli-paket.mjs vuk@primer.com PRO --dana 30
 *   node scripts/dodeli-paket.mjs vuk@primer.com --skini
 *
 * Bez `--dana` pristup nema rok — `moj_tier` tretira `ends_at is null`
 * kao trajno vazeci. To je „admin” slucaj: sopstveni nalog koji uvek
 * vidi ceo proizvod.
 *
 * Ne pravi paralelan sistem prava: upisuje red u `subscriptions`, istu
 * tabelu koju puni i naplata, pa `moj_tier` racuna paket na jedan nacin
 * bez obzira odakle je dosao.
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
const email = args.find((a) => a.includes('@'));
const tier = args.find((a) => ['PLUS', 'PRO', 'ULTRA'].includes(a.toUpperCase()))?.toUpperCase();
const dana = args.includes('--dana') ? Number(args[args.indexOf('--dana') + 1]) : null;
const SKINI = args.includes('--skini');

if (!email || (!tier && !SKINI)) {
  console.error('Upotreba: node scripts/dodeli-paket.mjs <mejl> <PLUS|PRO|ULTRA> [--dana N] [--skini]');
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

/* Nalog po mejlu. Admin API stranici po 1000, liga nema toliko naloga. */
async function nadjiKorisnika(mejl) {
  const cilj = mejl.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === cilj);
    if (hit) return hit;
    if (data.users.length < 1000) break;
  }
  return null;
}

const user = await nadjiKorisnika(email);
if (!user) {
  console.error(`Nema naloga sa mejlom ${email}. Prvo se registruj na sajtu.`);
  process.exit(1);
}

if (SKINI) {
  const { error, count } = await sb
    .from('subscriptions')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('source', 'manual');
  if (error) throw new Error(error.message);
  console.log(`Skinuto rucno dodeljenih redova: ${count ?? 0}. Nalog se vraca na ono sto je platio.`);
  process.exit(0);
}

const endsAt = dana ? new Date(Date.now() + dana * 864e5).toISOString() : null;

/* Idempotentno bez ON CONFLICT: na `paypal_id` nema jedinstvenog indeksa,
   pa se stara rucna dodela istom nalogu prvo brise. Uplate se ne diraju. */
await sb.from('subscriptions').delete().eq('user_id', user.id).eq('source', 'manual');

const { error } = await sb.from('subscriptions').insert({
  user_id: user.id,
  tier,
  source: 'manual',
  paypal_id: `manual:${user.id}:${tier}`,
  ends_at: endsAt,
  note: dana ? `rucno, ${dana} dana` : 'rucno, bez roka'
});
if (error) throw new Error(error.message);

const { data: proveri } = await sb.rpc('moj_tier', { uid: user.id });
console.log(`${email} -> ${tier}${endsAt ? ` do ${endsAt.slice(0, 10)}` : ' (bez roka)'}`);
console.log(`moj_tier sada vraca: ${proveri}`);
