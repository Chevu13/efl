'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import type { PlanCode } from '@/lib/config';

/**
 * Pokretanje placanja.
 *
 * Salje samo oznaku paketa. Iznos se odredjuje na serveru i nikad ne
 * putuje iz pregledaca — inace bi cena bila stvar podesavanja u konzoli.
 * Posle uspesnog pravljenja narudzbine, korisnik ide na PayPal.
 */
export default function CheckoutButton({
  plan,
  label,
  variant = 'primary',
  size = 'md',
  full = true,
  loggedIn
}: {
  plan: PlanCode;
  label: string;
  variant?: 'primary' | 'ghost' | 'quiet' | 'solid';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    if (!loggedIn) {
      router.push(`/prijava?reg=1&next=${encodeURIComponent('/paketi')}`);
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/paypal/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const out = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !out.url) {
        setError(out.error ?? 'Placanje trenutno nije dostupno.');
        setBusy(false);
        return;
      }

      /* Odlazak na PayPal — namerno bez novog prozora, da povratna
         adresa vrati korisnika u istu sesiju. */
      window.location.href = out.url;
    } catch {
      setError('Nema veze sa serverom. Pokusaj ponovo.');
      setBusy(false);
    }
  }

  return (
    <div className={full ? 'w-full' : ''}>
      <Button onClick={start} loading={busy} variant={variant} size={size} full={full}>
        {label}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-[12px] leading-snug text-neg">
          {error}
        </p>
      )}
    </div>
  );
}
