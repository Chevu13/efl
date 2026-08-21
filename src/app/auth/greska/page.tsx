'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export default function Greska() {
  const params = useSearchParams();
  const poruka = params.get('poruka') ?? '';
  const istekao = /expired|invalid/i.test(poruka);

  const [mejl, setMejl] = useState('');
  const [stanje, setStanje] = useState<'' | 'salje' | 'poslato' | 'greska'>('');

  async function posaljiPonovo() {
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
    <div className="mx-auto max-w-md py-14">
      <div className="card p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warn/15">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5M12 16.5v.5" stroke="#F5B942" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="#F5B942" strokeWidth="1.6" />
          </svg>
        </div>

        <h1 className="mt-4 font-display text-xl font-bold">
          {istekao ? 'Link je istekao' : 'Nešto nije u redu sa linkom'}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-muted">
          {istekao
            ? 'Link za potvrdu važi 24 sata i može se otvoriti samo jednom. Upiši mejl pa ti šaljemo novi.'
            : 'Pokušaj ponovo iz mejla, ili zatraži novi link.'}
        </p>

        {stanje === 'poslato' ? (
          <p className="mt-6 font-mono text-[12px] text-ok">Novi link je poslat. Proveri sanduče.</p>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              className="field" type="email" placeholder="tvoj@mejl.com"
              value={mejl} onChange={(e) => setMejl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && posaljiPonovo()}
            />
            <button onClick={posaljiPonovo} disabled={!mejl || stanje === 'salje'}
                    className="btn-primary w-full">
              {stanje === 'salje' ? '…' : 'Pošalji novi link'}
            </button>
            {stanje === 'greska' && (
              <p className="font-mono text-[11.5px] text-warn">Nije uspelo. Probaj za koji minut.</p>
            )}
          </div>
        )}

        <Link href="/prijava" className="mt-4 block text-[13px] text-muted underline hover:text-ink">
          Nazad na prijavu
        </Link>
      </div>
    </div>
  );
}
