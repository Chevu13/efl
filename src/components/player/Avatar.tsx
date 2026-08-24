import { initials, storageUrl } from '@/lib/format';
import type { Player } from '@/lib/types';

/** Stabilna boja po kodu tima — ista pri svakom renderu. */
function teamHue(code?: string | null) {
  if (!code) return 22;
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

const BOX = {
  xs: 'h-7 w-7 text-[9px]',
  sm: 'h-9 w-9 text-[10px]',
  md: 'h-12 w-12 text-[13px]'
} as const;

/**
 * Portret bez JavaScript-a.
 *
 * `PlayerPhoto` ume da uhvati sliku koja se ne ucita, ali za to mora da
 * bude klijentska komponenta. Na spisku od tri stotine igraca to znaci
 * tri stotine komponenti u paketu — pa se tamo koristi ova, cisto
 * serverska: inicijali stoje ispod slike, i vide se i ako slika zataji.
 *
 * Izgled je u klasi `.avatar` u globals.css, a ne u nizu Tailwind klasa:
 * ponovljen tri stotine puta, taj niz sam po sebi tezi vise od slika.
 */
export default function Avatar({
  player,
  size = 'sm',
  className = ''
}: {
  player: Pick<Player, 'short_name' | 'photo' | 'team_code'>;
  size?: keyof typeof BOX;
  className?: string;
}) {
  const src = storageUrl(player.photo);

  return (
    <span
      className={`avatar ${BOX[size]} ${className}`}
      style={{ '--hue': teamHue(player.team_code) } as React.CSSProperties}
      aria-hidden
    >
      <b>{initials(player.short_name)}</b>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" />
      )}
      <i />
    </span>
  );
}
