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

const size = { sm: 'h-6 w-6 text-[8px]', md: 'h-9 w-9 text-[10px]', lg: 'h-12 w-12 text-xs' };

/**
 * Grb tima. Ako u Storage postoji fajl — prikazuje ga.
 * Ako ga nema, ili se ne učita, crta monogram sa kodom tima.
 * Rezervni prikaz radi i kad slika vrati grešku, pa konzola ostaje čista.
 */
export default function TeamCrest({
  team,
  code,
  s = 'md'
}: {
  team?: Team | null;
  code: string;
  s?: keyof typeof size;
}) {
  const [pao, setPao] = useState(false);
  const src = storageUrl(team?.logo ?? null);
  const h = hue(code);

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg
                  border border-line font-mono font-bold text-muted ${size[s]}`}
      style={src && !pao ? { background: '#000' } : { background: `hsl(${h} 40% 16%)` }}
      title={team?.name_sr ?? code}
    >
      {src && !pao ? (
        // obično img, ne next/image — grbovi su sitni i često ih nema,
        // pa nema smisla da optimizator vraća 400 za svaki
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={team?.name_sr ?? code}
          className="h-full w-full object-cover"
          onError={() => setPao(true)}
          loading="lazy"
        />
      ) : (
        code
      )}
    </span>
  );
}
