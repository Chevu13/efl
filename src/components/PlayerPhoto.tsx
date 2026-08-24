'use client';

import Image from 'next/image';
import { useState } from 'react';
import { initials, storageUrl } from '@/lib/format';
import type { Player } from '@/lib/types';

/** Boja izvedena iz koda tima — stabilna, ista svaki put. */
function teamHue(code?: string | null) {
  if (!code) return 22;
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BOX: Record<Size, string> = {
  xs: 'h-7 w-7 text-[9px]',
  sm: 'h-9 w-9 text-[10px]',
  md: 'h-12 w-12 text-[13px]',
  lg: 'h-16 w-16 text-[17px]',
  xl: 'h-24 w-24 text-2xl'
};

const PX: Record<Size, number> = { xs: 56, sm: 72, md: 96, lg: 128, xl: 192 };

/** Portreti su kadrirani do struka — bez zuma glava ispadne sitna u krugu. */
const ZOOM: Record<Size, string> = {
  xs: 'scale-[1.75] translate-y-[15%]',
  sm: 'scale-[1.75] translate-y-[15%]',
  md: 'scale-[1.7] translate-y-[14%]',
  lg: 'scale-[1.6] translate-y-[12%]',
  xl: 'scale-[1.45] translate-y-[9%]'
};

/**
 * Portret igraca u listama i tabelama.
 *
 * Ako fotografije nema — crta plocicu sa inicijalima i bojom izvedenom
 * iz koda tima, pa mreza izgleda namerno umesto da zjapi prazna.
 * Za veliku, editorijalnu upotrebu koristi se `PlayerCutout`.
 */
export default function PlayerPhoto({
  player,
  size = 'md',
  shape = 'round',
  ring = false,
  className = ''
}: {
  player: Pick<Player, 'short_name' | 'photo' | 'jersey' | 'team_code'>;
  size?: Size;
  shape?: 'round' | 'square';
  /** Tanak narandzasti prsten — samo za istaknutog igraca. */
  ring?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = storageUrl(player.photo);
  const hue = teamHue(player.team_code);

  return (
    <div
      className={`relative shrink-0 overflow-hidden border bg-elev ${BOX[size]}
                  ${shape === 'round' ? 'rounded-full' : 'rounded-sm'}
                  ${ring ? 'border-brand' : 'border-line-2'} ${className}`}
      style={{
        backgroundImage: `radial-gradient(115% 100% at 50% 0%, hsl(${hue} 38% 20% / .9) 0%, transparent 72%)`
      }}
    >
      {src && !failed ? (
        <Image
          src={src}
          alt=""
          width={PX[size]}
          height={PX[size]}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover object-[center_top] ${ZOOM[size]}`}
          unoptimized
        />
      ) : (
        <span
          className="absolute inset-0 grid place-items-center font-display font-extrabold text-white/40"
          aria-hidden
        >
          {initials(player.short_name)}
        </span>
      )}

      {/* dijagonalna srafura — deo brend jezika, ne ukras */}
      <span className="hatch pointer-events-none absolute inset-0 opacity-70" aria-hidden />
    </div>
  );
}

/**
 * Veliki portret za editorijalne kompozicije: naslovni izbor kola,
 * profil igraca, optimizator. Slika ide do ivice bloka i tone u pozadinu,
 * pa tekst preko nje ostaje citljiv.
 */
export function PlayerCutout({
  player,
  className = '',
  priority = false
}: {
  player: Pick<Player, 'short_name' | 'photo' | 'jersey' | 'team_code'>;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = storageUrl(player.photo);
  const hue = teamHue(player.team_code);

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      <span
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(70% 60% at 50% 18%, hsl(${hue} 40% 22% / .95) 0%, transparent 75%)`
        }}
      />
      {src && !failed ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 768px) 60vw, 420px"
          priority={priority}
          onError={() => setFailed(true)}
          className="object-contain object-bottom"
          unoptimized
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-[26vw] font-extrabold leading-none text-white/[.06] sm:text-[140px]">
          {player.jersey ?? initials(player.short_name)}
        </span>
      )}
      <span className="hatch pointer-events-none absolute inset-0 opacity-50" />
    </div>
  );
}
