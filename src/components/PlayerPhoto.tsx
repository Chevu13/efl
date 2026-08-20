'use client';

import Image from 'next/image';
import { useState } from 'react';
import { storageUrl } from '@/lib/format';
import type { Player } from '@/lib/types';

/** Boja izvedena iz koda tima — stabilna, ista svaki put. */
function teamHue(code?: string | null) {
  if (!code) return 210;
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

const initials = (name: string) =>
  name
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

type Size = 'sm' | 'md' | 'lg';

const box: Record<Size, string> = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-12 w-12 text-sm',
  lg: 'h-full w-full text-4xl'
};

const px: Record<Size, number> = { sm: 72, md: 128, lg: 640 };

/** Portreti su kadrirani do struka — bez zuma glava ispadne sitna u krugu. */
const ZOOM: Record<Size, string> = {
  sm: 'scale-[1.7] translate-y-[14%]',
  md: 'scale-[1.7] translate-y-[14%]',
  lg: 'scale-[1.15] translate-y-[2%]'
};

/**
 * Slika igrača. Ako u Storage postoji fotografija — prikazuje nju.
 * Ako ne — crta kartu sa inicijalima, brojem dresa i bojom tima,
 * tako da mreža izgleda namerno umesto da zjapi prazna.
 */
export default function PlayerPhoto({
  player,
  size = 'md',
  round = true
}: {
  player: Pick<Player, 'short_name' | 'photo' | 'jersey' | 'team_code'>;
  size?: Size;
  round?: boolean;
}) {
  const [pao, setPao] = useState(false);
  const src = storageUrl(player.photo);
  const hue = teamHue(player.team_code);
  const shape = round ? 'rounded-full' : 'rounded-card';

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-line bg-elev ${box[size]} ${shape}`}
      style={{
        backgroundImage: `radial-gradient(120% 100% at 50% 0%,
          hsl(${hue} 45% 22% / .85) 0%, transparent 70%)`
      }}
    >
      {src && !pao ? (
        <Image
          src={src}
          alt={player.short_name}
          width={px[size]}
          height={px[size]}
          onError={() => setPao(true)}
          className={`h-full w-full object-cover object-[center_top] ${ZOOM[size]}`}
          unoptimized={size !== 'lg'}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display font-bold text-white/35">
          {size === 'lg' && player.jersey != null ? player.jersey : initials(player.short_name)}
        </span>
      )}

      {/* dijagonalna šrafura — deo brend jezika, ne ukras */}
      <span
        className="pointer-events-none absolute inset-0 opacity-[.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 7px)'
        }}
      />
    </div>
  );
}
