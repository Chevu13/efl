'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '../ui/Button';
import { Alert } from '../ui/primitives';
import { createClient } from '@/lib/supabase/client';

/**
 * Prijava i registracija u jednoj formi.
 *
 * Poruke o greskama su na srpskom i govore sta da se uradi — Supabase
 * vraca engleski tekst koji korisniku ne znaci nista.
 */

const PORUKE: [RegExp, string][] = [
  [/invalid login credentials/i, 'Pogresan mejl ili lozinka.'],
  [/email not confirmed/i, 'Nalog jos nije potvrdjen. Proveri mejl.'],
  [/user already registered/i, 'Nalog sa ovim mejlom vec postoji. Prijavi se.'],
  [/password should be at least/i, 'Lozinka mora imati bar 6 znakova.'],
  [/rate limit|too many/i, 'Previse pokusaja. Sacekaj minut pa probaj ponovo.'],
  [/unable to validate email/i, 'Mejl adresa nije ispravna.']
];

const prevedi = (m: string) => PORUKE.find(([re]) => re.test(m))?.[1] ?? m;

export default function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/igra';

  const [reg, setReg] = useState(params.get('reg') === '1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    const sb = createClient();

    /* Nalog pravi server i odmah ga potvrdjuje — mejl sa linkom ne stize
       pouzdano, pa bi registracija inace stala na pola. */
    if (reg) {
      const odgovor = await fetch('/api/registracija', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      if (!odgovor.ok) {
        const { greska } = (await odgovor.json().catch(() => ({}))) as { greska?: string };
        setError(prevedi(greska ?? 'Registracija nije uspela. Probaj ponovo.'));
        setBusy(false);
        return;
      }
    }

    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    if (err) {
      setError(prevedi(err.message));
      setBusy(false);
      return;
    }

    router.refresh();
    router.push(next);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="lg:hidden">
        <p className="eyebrow">Nalog</p>
      </div>

      <h1 className="mt-4 text-[clamp(26px,5vw,34px)] uppercase leading-none lg:mt-0">
        {reg ? 'Napravi nalog' : 'Prijavi se'}
      </h1>
      <p className="mt-3 text-small leading-relaxed text-ink-3">
        {reg
          ? 'Besplatno. Treba ti da sacuvas postavu, odigras kolo i pratis svoju tacnost.'
          : 'Postava, listici i paket vezani su za nalog.'}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {reg && (
          <div>
            <label htmlFor="ime" className="field-label">
              Korisnicko ime
            </label>
            <input
              id="ime"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kako se prikazujes na listi"
              autoComplete="nickname"
              className="field"
            />
          </div>
        )}

        <div>
          <label htmlFor="mejl" className="field-label">
            Mejl
          </label>
          <input
            id="mejl"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="ti@primer.com"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="loz" className="field-label">
            Lozinka
          </label>
          <input
            id="loz"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={reg ? 'new-password' : 'current-password'}
            placeholder={reg ? 'bar 6 znakova' : ''}
            className="field"
          />
        </div>

        {error && (
          <Alert tone="error" title="Nije uspelo">
            {error}
          </Alert>
        )}

        <Button type="submit" loading={busy} disabled={!email || !password} full size="lg">
          {reg ? 'Napravi nalog' : 'Prijavi se'}
        </Button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="label">ili</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        onClick={() => {
          setReg(!reg);
          setError('');
        }}
        className="btn-ghost btn-md mt-4 w-full"
      >
        {reg ? 'Vec imam nalog' : 'Nemam nalog — napravi ga'}
      </button>

      <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-4">
        Bez naloga i dalje mozes da gledas{' '}
        <Link href="/igraci" className="link">
          izbore kola
        </Link>{' '}
        i{' '}
        <Link href="/raspored" className="link">
          raspored
        </Link>
        .
      </p>
    </div>
  );
}
