'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Alert } from '../ui/primitives';

/**
 * Unos pristupnog koda.
 *
 * Ranije je isao kroz `prompt()` i `alert()` — to je izlazilo iz
 * proizvoda, nije se moglo stilizovati i nije radilo sa citacem ekrana.
 * Sada je pravi dijalog: Escape zatvara, fokus ide na polje, greska se
 * ispisuje u samom dijalogu.
 */
export default function CodeDialog({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setError('');
    setDone(null);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/kod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kod: code.trim() })
      });
      const out = (await res.json()) as { tier?: string; error?: string };
      if (!res.ok) {
        setError(out.error ?? 'Kod nije vazeci.');
        return;
      }
      setDone(out.tier ?? 'PLUS');
      router.refresh();
    } catch {
      setError('Nema veze sa serverom. Pokusaj ponovo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button
        aria-label="Zatvori"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kod-naslov"
        className="relative w-full max-w-sm animate-rise border-t border-line bg-surface p-6
                   sm:rounded-md sm:border"
      >
        <h2 id="kod-naslov" className="text-[20px] uppercase">
          Imam pristupni kod
        </h2>
        <p className="mt-2 text-small text-ink-3">
          Kod dobijaš uz uplatu ili kao nagradu za vrh rang-liste izazova.
          Otključava paket odmah, bez plaćanja.
        </p>

        {done ? (
          <div className="mt-5">
            <Alert tone="ok" title={`Otkljucano: ${done}`}>
              Paket je aktivan. Sadrzaj se osvezava odmah.
            </Alert>
            <Button variant="ghost" full className="mt-4" onClick={onClose}>
              Zatvori
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5">
            <label htmlFor="kod" className="field-label">
              Kod
            </label>
            <input
              id="kod"
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EFL-PRO-7K2M"
              autoComplete="off"
              spellCheck={false}
              className="field font-mono tracking-[0.08em]"
            />
            {error && (
              <p role="alert" className="mt-3 text-[12.5px] text-neg">
                {error}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <Button type="submit" loading={busy} disabled={!code.trim()} full>
                Otkljucaj
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Otkazi
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
