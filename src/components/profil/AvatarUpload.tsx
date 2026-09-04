'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { storageUrl } from '@/lib/format';

/**
 * Slika profila — izbor fajla, pregled i brisanje.
 *
 * Odmah crta izabranu sliku iz `URL.createObjectURL`, pre nego sto se
 * upload zavrsi: na sporoj vezi bi inace izgledalo kao da klik nije
 * primljen. Ako upload padne, pregled se vraca na staro.
 */
export default function AvatarUpload({
  avatar,
  fallback
}: {
  avatar: string | null;
  /** Slovo koje stoji dok slike nema. */
  fallback: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pregled, setPregled] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const src = pregled ?? storageUrl(avatar);

  async function posalji(file: File) {
    setError('');
    const privremeni = URL.createObjectURL(file);
    setPregled(privremeni);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('slika', file);
      const res = await fetch('/api/avatar', { method: 'POST', body: fd });
      const out = (await res.json()) as { error?: string };
      if (!res.ok) {
        setPregled(null);
        setError(out.error ?? 'Slika nije sacuvana.');
        return;
      }
      router.refresh();
    } catch {
      setPregled(null);
      setError('Nema veze sa serverom.');
    } finally {
      setBusy(false);
      URL.revokeObjectURL(privremeni);
    }
  }

  async function obrisi() {
    setBusy(true);
    setError('');
    try {
      await fetch('/api/avatar', { method: 'DELETE' });
      setPregled(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-4">
      <span className="relative">
        <span
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full
                     border border-line-2 bg-elev font-display text-[26px] font-extrabold
                     uppercase text-ink-2"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" />
          ) : (
            fallback
          )}
        </span>
        {busy && (
          <span
            className="absolute inset-0 grid place-items-center rounded-full bg-black/60 text-[10px] font-mono uppercase text-ink-2"
            aria-live="polite"
          >
            …
          </span>
        )}
      </span>

      <div className="min-w-0">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) posalji(f);
            e.target.value = '';
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="btn-ghost btn-sm"
          >
            {avatar || pregled ? 'Promeni sliku' : 'Dodaj sliku'}
          </button>
          {(avatar || pregled) && (
            <button type="button" onClick={obrisi} disabled={busy} className="btn-quiet btn-sm">
              Ukloni
            </button>
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-ink-4">JPG, PNG ili WEBP, do 2 MB.</p>
        {error && (
          <p className="mt-1 text-[11.5px] text-warn" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
