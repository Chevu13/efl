/**
 * Puna sema baze iz PostgREST OpenAPI opisa — radi i za prazne tabele.
 *
 * Pokretanje:  node scripts/probe-schema.mjs
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ENV = ['.env.local', '.env'].find((f) => existsSync(f));
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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(`${URL}/rest/v1/`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
});
const spec = await res.json();

const defs = spec.definitions ?? spec.components?.schemas ?? {};
const names = Object.keys(defs).sort();

console.log(`tabela/pogleda: ${names.length}\n`);

for (const name of names) {
  const d = defs[name];
  const props = d.properties ?? {};
  const req = new Set(d.required ?? []);
  console.log(`\n### ${name}`);
  for (const [col, meta] of Object.entries(props)) {
    const pk = /Primary Key/i.test(meta.description ?? '') ? ' PK' : '';
    const fk = (meta.description ?? '').match(/`([^`]+)`/)?.[1];
    console.log(
      `  ${col.padEnd(22)} ${String(meta.format ?? meta.type).padEnd(28)}` +
        `${req.has(col) ? ' NOT NULL' : ''}${pk}${fk ? ` → ${fk}` : ''}`
    );
  }
}

/* RPC funkcije */
const paths = Object.keys(spec.paths ?? {}).filter((p) => p.startsWith('/rpc/'));
console.log('\n\n### RPC funkcije');
paths.forEach((p) => console.log('  ' + p.replace('/rpc/', '')));
