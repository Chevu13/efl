/**
 * Provera PayPal podesavanja — pre nego sto se osloni na naplatu.
 *
 * Pokretanje:
 *   node scripts/paypal-provera.mjs           # token, katalog, probna narudzbina
 *   node scripts/paypal-provera.mjs --bez-narudzbine
 *
 * Zasto postoji: kad naplata ne radi, uzrok je skoro uvek jedna od tri
 * stvari — pogresan par kljuceva, kljucevi iz live naloga uz PAYPAL_ENV
 * sandbox (ili obrnuto), ili webhook koji pokazuje na pogresnu adresu.
 * Sve tri se vide odavde, bez otvaranja pregledaca.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ENV = ['.env.local', '.env'].find((f) => existsSync(f));
if (!ENV) izadji('Nema .env.local — nema sta da se proverava.');

let txt = await readFile(ENV, 'utf8');
if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
for (const r of txt.split(/\r?\n/)) {
  const l = r.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i < 1) continue;
  process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim();
}

const ID = process.env.PAYPAL_CLIENT_ID;
const TAJNA = process.env.PAYPAL_SECRET;
const OKRUZENJE = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
const BAZA =
  OKRUZENJE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const SAJT = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

console.log(`okruzenje        ${OKRUZENJE}  (${BAZA})`);
console.log(`adresa sajta     ${SAJT}`);

if (!ID || !TAJNA) izadji('Nedostaju PAYPAL_CLIENT_ID i/ili PAYPAL_SECRET u ' + ENV);
console.log(`client id        ${ID.slice(0, 8)}…${ID.slice(-4)}  (${ID.length} znakova)`);

/* ---------------------------------------------------------------- token */

const tokenRes = await fetch(`${BAZA}/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(`${ID}:${TAJNA}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: 'grant_type=client_credentials'
});

if (!tokenRes.ok) {
  const telo = await tokenRes.text();
  console.log(`\ntoken            NE (${tokenRes.status})`);
  if (tokenRes.status === 401) {
    console.log(
      `\nPayPal odbija par kljuceva. Skoro uvek znaci da su kljucevi iz ` +
        `${OKRUZENJE === 'live' ? 'sandbox' : 'live'} naloga, a PAYPAL_ENV je "${OKRUZENJE}".\n` +
        `Uzmi kljuceve sa iste kartice (Sandbox / Live) na developer.paypal.com.`
    );
  }
  izadji(telo.slice(0, 300));
}

const { access_token: token } = await tokenRes.json();
console.log('token            ok');

const api = async (putanja, init = {}) => {
  const res = await fetch(`${BAZA}${putanja}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  const t = await res.text();
  return { status: res.status, telo: t ? JSON.parse(t) : {} };
};

/* -------------------------------------------------------------- webhook */

const webhookId = process.env.PAYPAL_WEBHOOK_ID;
const { telo: spisak } = await api('/v1/notifications/webhooks');
const webhooks = spisak.webhooks ?? [];

if (!webhookId) {
  console.log('webhook          nije podesen (PAYPAL_WEBHOOK_ID prazan)');
  if (webhooks.length) {
    console.log('\n  Postoje ovi webhook-ovi na nalogu — prepisi id onog koji pokazuje na sajt:');
    for (const w of webhooks) console.log(`    ${w.id}  ${w.url}`);
  } else {
    console.log(`\n  Napravi ga: Developer Dashboard -> Apps -> (aplikacija) -> Webhooks`);
    console.log(`  Adresa: ${SAJT}/api/paypal/webhook`);
    console.log('  Dogadjaji: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED,');
    console.log('             PAYMENT.CAPTURE.REFUNDED, PAYMENT.CAPTURE.REVERSED');
  }
} else {
  const nas = webhooks.find((w) => w.id === webhookId);
  if (!nas) {
    console.log(`webhook          NE — id ${webhookId} ne postoji na ovom nalogu`);
  } else {
    const ocekivano = `${SAJT}/api/paypal/webhook`;
    const dogadjaji = (nas.event_types ?? []).map((e) => e.name);
    const fale = ['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.REFUNDED'].filter(
      (e) => !dogadjaji.includes(e) && !dogadjaji.includes('*')
    );
    console.log(`webhook          ok  ${nas.url}`);
    if (nas.url !== ocekivano) console.log(`  PAZI: adresa nije ${ocekivano}`);
    if (fale.length) console.log(`  PAZI: nisu prijavljeni dogadjaji ${fale.join(', ')}`);
  }
}

/* ---------------------------------------------------------- narudzbina */

if (process.argv.includes('--bez-narudzbine')) process.exit(0);

/* Narudzbina se samo pravi, ne naplacuje — istekne sama za tri sata. */
const { status, telo: nar } = await api('/v2/checkout/orders', {
  method: 'POST',
  body: JSON.stringify({
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: { currency_code: 'EUR', value: '9.00' },
        description: 'Provera podesavanja',
        custom_id: 'provera|PLUS'
      }
    ],
    application_context: {
      return_url: `${SAJT}/api/paypal/return`,
      cancel_url: `${SAJT}/placanje/otkazano`,
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING'
    }
  })
});

if (status !== 201) {
  console.log(`\nnarudzbina       NE (${status})`);
  console.log(JSON.stringify(nar, null, 2).slice(0, 600));
  process.exit(1);
}

const veza = (nar.links ?? []).find((l) => l.rel === 'approve' || l.rel === 'payer-action');
console.log(`\nnarudzbina       ok  ${nar.id}  (${nar.status})`);
console.log(`\nOtvori ovo u pregledacu da probas ceo tok:\n${veza?.href ?? '(nema approve linka)'}`);
if (OKRUZENJE === 'sandbox') {
  console.log(
    '\nPrijavi se probnim kupcem sa developer.paypal.com -> Testing Tools -> Sandbox Accounts.'
  );
}

function izadji(poruka) {
  console.error('\n' + poruka);
  process.exit(1);
}
