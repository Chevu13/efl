'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/primitives';

/**
 * Granica greske.
 *
 * Korisnik dobija recenicu koju moze da iskoristi i dugme koje stvarno
 * nesto radi. Tehnicki detalj ostaje u konzoli, ne na ekranu.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[efl]', error);
  }, [error]);

  return (
    <div className="page flex min-h-[calc(100dvh-var(--nav-h))] items-center justify-center py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-[clamp(24px,4vw,34px)] uppercase leading-none">
          Nesto je puklo na nasoj strani
        </h1>
        <p className="mt-4 text-body leading-relaxed text-ink-2">
          Podaci se nisu ucitali kako treba. Pokusaj ponovo — ako se ponovi,
          verovatno je do baze, ne do tebe.
        </p>

        {error.digest && (
          <div className="mt-6 text-left">
            <Alert tone="info">
              Oznaka greske: <code className="font-mono text-ink">{error.digest}</code>
            </Alert>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset}>Pokusaj ponovo</Button>
          <a href="/" className="btn-ghost btn-md">Pocetna</a>
        </div>
      </div>
    </div>
  );
}
