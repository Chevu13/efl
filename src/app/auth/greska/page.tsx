'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logomark from '@/components/brand/Logomark';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * Link iz mejla nije prosao.
 *
 * Najcesci razlog je istekao ili vec iskoriscen link, i tu korisnik ne
 * moze nista osim da zatrazi novi — pa je polje za mejl odmah tu, a ne
 * iza jos jednog koraka.
 */
export default function Greska() {
  return (
    <Suspense fallback={<div className="page py-20" />}>
      <GreskaSadrzaj />
    </Suspense>
  );
}

function GreskaSadrzaj() {
  const params = useSearchParams();
  const poruka = params.get('poruka') ?? '';
  const istekao = /expired|invalid/i.test(poruka);

  const [mejl, setMejl] = useState('');
  const [stanje, setStanje] = useState<'' | 'salje' | 'poslato' | 'greska'>('');

  async function posaljiPonovo(e: React.FormEvent) {
    e.preventDefault();
    if (!mejl) return;
    setStanje('salje');
    const { error } = await createClient().auth.resend({
      type: 'signup',
      email: mejl,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    setStanje(error ? 'greska' : 'poslato');
  }

  return (
    <div className="page flex min-h-[calc(100dvh-var(--nav-h))] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center opacity-70">
          <Logomark size={48} />
        </div>

        <h1 className="mt-7 text-center text-[clamp(24px,5vw,32px)] uppercase leading-none">
          {istekao ? 'Link je istekao' : 'Nesto nije u redu sa linkom'}
        </h1>

        <p className="mt-4 text-center text-body leading-relaxed text-ink-2">
          {istekao
            ? 'Link za potvrdu vazi 24 sata i moze se otvoriti samo jednom. Upisi mejl pa ti saljemo novi.'
            : 'Pokusaj ponovo iz mejla, ili zatrazi novi link.'}
        </p>

        {stanje === 'poslato' ? (
          <div className="mt-7">
            <Alert tone="ok" title="Novi link je poslat">
              Proveri sanduce — i folder sa nezeljenom postom, tamo zna da zavrsi.
            </Alert>
          </div>
        ) : (
          <form onSubmit={posaljiPonovo} className="mt-7">
            <label htmlFor="mejl" className="field-label">
              Mejl sa kojim si se registrovao
            </label>
            <input
              id="mejl"
              type="email"
              required
              value={mejl}
              onChange={(e) => setMejl(e.target.value)}
              placeholder="ti@primer.com"
              autoComplete="email"
              className="field"
            />

            <Button
              type="submit"
              full
              className="mt-4"
              loading={stanje === 'salje'}
              disabled={!mejl}
            >
              Posalji novi link
            </Button>

            {stanje === 'greska' && (
              <div className="mt-4">
                <Alert tone="error">Nije uspelo. Probaj za koji minut.</Alert>
              </div>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-[12.5px] text-ink-3">
          <Link href="/prijava" className="link">
            Nazad na prijavu
          </Link>
        </p>
      </div>
    </div>
  );
}
