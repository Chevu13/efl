/**
 * Geometrija terena kao pozadina.
 *
 * Namerno je sam crtez linijama, bez fotografije i bez sjaja: dovoljno
 * da se prepozna kosarka, a da ne smeta citanju brojeva preko njega.
 * Zato je i opacity nizak i sve linije su tanke.
 */
export default function CourtBackdrop({
  variant = 'half',
  className = '',
  opacity = 0.16
}: {
  variant?: 'half' | 'arc' | 'center';
  className?: string;
  opacity?: number;
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    vectorEffect: 'non-scaling-stroke' as const
  };

  if (variant === 'arc') {
    return (
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMax slice"
        className={`pointer-events-none absolute inset-0 h-full w-full text-ink ${className}`}
        style={{ opacity }}
        aria-hidden
      >
        <path d="M40 200 V150 A160 160 0 0 1 360 150 V200" {...common} />
        <path d="M150 200 V120 H250 V200" {...common} />
        <circle cx="200" cy="120" r="42" {...common} />
        <path d="M170 200 V196 H230 V200" {...common} />
      </svg>
    );
  }

  if (variant === 'center') {
    return (
      <svg
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
        className={`pointer-events-none absolute inset-0 h-full w-full text-ink ${className}`}
        style={{ opacity }}
        aria-hidden
      >
        <circle cx="200" cy="200" r="120" {...common} />
        <circle cx="200" cy="200" r="46" {...common} />
        <path d="M0 200 H400" {...common} />
      </svg>
    );
  }

  /* half — cela polovina terena, koristi se iza postave */
  return (
    <svg
      viewBox="0 0 500 470"
      preserveAspectRatio="xMidYMin slice"
      className={`pointer-events-none absolute inset-0 h-full w-full text-ink ${className}`}
      style={{ opacity }}
      aria-hidden
    >
      {/* granice */}
      <rect x="10" y="10" width="480" height="450" {...common} />
      {/* reket */}
      <rect x="185" y="10" width="130" height="190" {...common} />
      {/* krug slobodnih bacanja */}
      <circle cx="250" cy="200" r="60" {...common} />
      {/* obruc i tabla */}
      <path d="M205 45 H295" {...common} />
      <circle cx="250" cy="62" r="14" {...common} />
      {/* linija za tri poena */}
      <path d="M50 10 V120 A215 215 0 0 0 450 120 V10" {...common} />
      {/* centar */}
      <path d="M10 460 H490" {...common} />
      <circle cx="250" cy="460" r="70" {...common} />
    </svg>
  );
}
