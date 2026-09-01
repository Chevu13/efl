'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Alert } from '../ui/primitives';
import { createClient } from '@/lib/supabase/client';

/**
 * Postavljanje nove lozinke.
 *
 * Do ovde se stize iskljucivo preko linka iz mejla — on je vec ostavio
 * sesiju, pa se lozinka menja obicnim `updateUser`. Ako sesije nema, link
 * je istekao ili je vec iskoriscen, i to treba da pise umesto praznog polja
 * koje nista ne radi.
 */
export default function NovaLozinkaForm() {
  const [sesija, setSesija] = useState<boolean | null>(null);
  const [lozinka, setLozinka] = useState('');
  const [ponovo, setPonovo] = useState('');
  const [busy, setBusy] = useState(false);
  const [greska, setGreska] = useState('');

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSesija(Boolean(data.session)));
  }, []);

  async function posalji(e: React.FormEvent) {
    e.preventDefault();
    if (lozinka !== ponovo) {
      setGreska('Lozinke se ne poklapaju.');
      return;
    }
    setBusy(true);
    setGreska('');

    const { error } = await createClient().auth.updateUser({ password: lozinka });
    if (error) {
      setGreska(
        /should be at least/i.test(error.message)
          ? 'Lozinka mora imati bar 6 znakova.'
          : error.message
      );
      setBusy(false);
      return;
    }

    /* Tvrda navigacija — nalog stoji u zaglavlju, koje se crta na serveru. */
    window.location.assign('/igra');
  }

  if (sesija === null) {
    return <div className="skel h-64 w-full max-w-sm rounded-md" aria-label="Ucitavanje" />;
  }

  if (!sesija) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-[clamp(26px,5vw,34px)] uppercase leading-none">Link ne vazi</h1>
        <p className="mt-3 text-small leading-relaxed text-ink-3">
          Link za promenu lozinke vazi jedan sat i moze se upotrebiti jednom. Zatrazi novi.
        </p>
        <a href="/prijava?zaboravljena=1" className="btn-primary btn-lg mt-7 w-full">
          Posalji novi link
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[clamp(26px,5vw,34px)] uppercase leading-none">Nova lozinka</h1>
      <p className="mt-3 text-small leading-relaxed text-ink-3">
        Upisi novu lozinku za svoj nalog. Stara prestaje da vazi odmah.
      </p>

      <form onSubmit={posalji} className="mt-7 space-y-4">
        <div>
          <label htmlFor="nova" className="field-label">
            Nova lozinka
          </label>
          <input
            id="nova"
            type="password"
            required
            minLength={6}
            value={lozinka}
            onChange={(e) => setLozinka(e.target.value)}
            autoComplete="new-password"
            placeholder="bar 6 znakova"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="ponovo" className="field-label">
            Ponovi lozinku
          </label>
          <input
            id="ponovo"
            type="password"
            required
            minLength={6}
            value={ponovo}
            onChange={(e) => setPonovo(e.target.value)}
            autoComplete="new-password"
            className="field"
          />
        </div>

        {greska && (
          <Alert tone="error" title="Nije uspelo">
            {greska}
          </Alert>
        )}

        <Button type="submit" loading={busy} disabled={!lozinka || !ponovo} full size="lg">
          Sacuvaj lozinku
        </Button>
      </form>
    </div>
  );
}
