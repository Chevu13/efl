'use client';

import { useState } from 'react';
import { storageUrl } from '@/lib/format';
import type { Team } from '@/lib/types';

/** Stabilna boja po kodu tima — ista pri svakom renderu. */
function hue(code: string) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

const SIZE = {
  xs: 'h-5 w-5 text-[7.5px]',
  sm: 'h-7 w-7 text-[9px]',
  md: 'h-9 w-9 text-[10px]',
  lg: 'h-12 w-12 text-[12px]',
  xl: 'h-16 w-16 text-[15px]'
} as const;

/**
 * Grb tima. Ako u Storage postoji fajl — prikazuje ga.
 * Ako ga nema, ili se ne ucita, crta monogram sa kodom tima, pa
 * raspored izgleda uredno i pre nego sto se grbovi ubace.
 */
export default function TeamCrest({
  team,
  code,
  s = 'md',
  className = ''
}: {
  team?: Team | null;
  code: string;
  s?: keyof typeof SIZE;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = storageUrl(team?.logo ?? null);
  const h = hue(code);
  const name = team?.name_sr ?? code.toUpperCase();

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-sm border
                  border-line-2 font-mono font-bold uppercase tracking-tight text-ink-2
                  ${SIZE[s]} ${className}`}
      style={src && !failed ? { background: '#000' } : { background: `hsl(${h} 32% 15%)` }}
      title={name}
    >
      {src && !failed ? (
        // obicni img, ne next/image — grbovi su sitni i cesto ih nema,
        // pa nema smisla da optimizator vraca gresku za svaki
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span aria-hidden>{code.slice(0, 3)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
