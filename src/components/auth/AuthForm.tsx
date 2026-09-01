'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '../ui/Button';
import { Alert } from '../ui/primitives';
import { createClient } from '@/lib/supabase/client';

/**
 * Prijava, registracija i zaboravljena lozinka u jednoj formi.
 *
 * Poruke o greskama su na srpskom i govore sta da se uradi — Supabase
 * vraca engleski tekst koji korisniku ne znaci nista.
 *
 * Posle uspesne prijave ide tvrda navigacija umesto `router.push`. Nalog stoji
 * u zaglavlju, zaglavlje se crta na serveru, a klijentski kes rutera bi vratio
 * verziju sacuvanu dok korisnik jos nije bio prijavljen — pa bi gore i dalje
 * pisalo „Prijavi se”.
 */

const PORUKE: [RegExp, string][] = [
  [/invalid login credentials/i, 'Pogresan mejl ili lozinka.'],
  [/email not confirmed/i, 'Nalog jos nije potvrdjen. Otvori link iz mejla.'],
  [/user already registered/i, 'Nalog sa ovim mejlom vec postoji. Prijavi se.'],
  [/password should be at least/i, 'Lozinka mora imati bar 6 znakova.'],
  [/rate limit|too many/i, 'Previse pokusaja. Sacekaj minut pa probaj ponovo.'],
  [/unable to validate email/i, 'Mejl adresa nije ispravna.'],
  [/provider is not enabled/i, 'Prijava preko Google naloga jos nije ukljucena.']
];

const prevedi = (m: string) => PORUKE.find(([re]) => re.test(m))?.[1] ?? m;

type Rezim = 'prijava' | 'registracija' | 'zaboravljena';

export default function AuthForm() {
  const params = useSearchParams();
  const trazeno = params.get('next') ?? '/igra';
  /* Samo interne adrese — spoljna bi ovo pretvorila u otvoreno preusmerenje. */
  const next = trazeno.startsWith('/') && !trazeno.startsWith('//') ? trazeno : '/igra';

  const [rezim, setRezim] = useState<Rezim>(
    params.get('zaboravljena') === '1'
      ? 'zaboravljena'
      : params.get('reg') === '1'
        ? 'registracija'
        : 'prijava'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const [greska, setGreska] = useState('');
  const [info, setInfo] = useState('');

  const reg = rezim === 'registracija';
  const zaboravljena = rezim === 'zaboravljena';

  function promeni(u: Rezim) {
    setRezim(u);
    setGreska('');
    setInfo('');
  }

  async function saGoogle() {
    setGoogle(true);
    setGreska('');
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      }
    });
    if (error) {
      setGreska(prevedi(error.message));
      setGoogle(false);
    }
  }

  async function posalji(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setGreska('');
    setInfo('');

    if (zaboravljena) {
      const odgovor = await fetch('/api/lozinka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!odgovor.ok) {
        const telo = (await odgovor.json().catch(() => ({}))) as { greska?: string };
        setGreska(telo.greska ?? 'Slanje nije uspelo. Probaj ponovo.');
        setBusy(false);
        return;
      }
      setInfo(`Ako nalog sa adresom ${email} postoji, link za novu lozinku je vec na putu.`);
      setBusy(false);
      return;
    }

    if (reg) {
      const odgovor = await fetch('/api/registracija', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      const telo = (await odgovor.json().catch(() => ({}))) as {
        greska?: string;
        potvrda?: boolean;
      };
      if (!odgovor.ok) {
        setGreska(prevedi(telo.greska ?? 'Registracija nije uspela. Probaj ponovo.'));
        setBusy(false);
        return;
      }
      /* Kad potvrda ide mejlom, sesije nema dok se link ne otvori. */
      if (telo.potvrda) {
        setInfo(`Poslali smo link na ${email}. Otvori ga i nalog je gotov.`);
        setBusy(false);
        return;
      }
    }

    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setGreska(prevedi(error.message));
      setBusy(false);
      return;
    }

    window.location.assign(next);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="lg:hidden">
        <p className="eyebrow">Nalog</p>
      </div>

      <h1 className="mt-4 text-[clamp(26px,5vw,34px)] uppercase leading-none lg:mt-0">
        {zaboravljena ? 'Nova lozinka' : reg ? 'Napravi nalog' : 'Prijavi se'}
      </h1>
      <p className="mt-3 text-small leading-relaxed text-ink-3">
        {zaboravljena
          ? 'Upisi mejl naloga. Poslacemo link koji vodi na stranicu za promenu lozinke.'
          : reg
            ? 'Besplatno. Treba ti da sacuvas postavu, odigras kolo i pratis svoju tacnost.'
            : 'Postava, listici i paket vezani su za nalog.'}
      </p>

      {!zaboravljena && (
        <>
          <button
            type="button"
            onClick={saGoogle}
            disabled={google}
            className="btn-ghost btn-lg mt-7 w-full gap-2.5"
          >
            <GoogleIkonica />
            {google ? 'Otvaram Google…' : 'Nastavi preko Google naloga'}
          </button>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="label">ili mejlom</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={posalji} className="mt-5 space-y-4">
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

        {!zaboravljena && (
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="loz" className="field-label">
                Lozinka
              </label>
              {!reg && (
                <button
                  type="button"
                  onClick={() => promeni('zaboravljena')}
                  className="link text-[12px]"
                >
                  Zaboravljena?
                </button>
              )}
            </div>
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
        )}

        {greska && (
          <Alert tone="error" title="Nije uspelo">
            {greska}
          </Alert>
        )}
        {info && <Alert tone="ok" title="Proveri mejl">{info}</Alert>}

        <Button
          type="submit"
          loading={busy}
          disabled={!email || (!zaboravljena && !password)}
          full
          size="lg"
        >
          {zaboravljena ? 'Posalji link' : reg ? 'Napravi nalog' : 'Prijavi se'}
        </Button>
      </form>

      <button
        onClick={() => promeni(reg || zaboravljena ? 'prijava' : 'registracija')}
        className="btn-quiet btn-md mt-4 w-full"
      >
        {reg || zaboravljena ? 'Nazad na prijavu' : 'Nemam nalog — napravi ga'}
      </button>

      <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-4">
        Bez naloga i dalje mozes da gledas{' '}
        <Link href="/igraci" className="link">
          izbore kola
        </Link>{' '}
        i{' '}
        <Link href="/raspored" className="link">
          izazov kola
        </Link>
        .
      </p>
    </div>
  );
}

function GoogleIkonica() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
