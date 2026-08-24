/**
 * Zvanični Euro Fantasy Lab brendmark.
 *
 * Krug u obliku košarkaške lopte, narandžast (#DF6320), sa crnim
 * obručem, šavovima i blok slovima EFL. Slova su crtana kao pravougaonici
 * — ne kao tekst — pa mark izgleda isto bez obzira na to koji je font učitan.
 *
 * NAPOMENA: ovo je verna rekonstrukcija iz brend priručnika. Kada dobiješ
 * originalni vektor (.svg / .ai), zameni putanje u ovoj komponenti i u
 * public/brand/efl-mark.svg — ostatak aplikacije ne treba dirati.
 */
export default function Logomark({
  size = 32,
  className = '',
  title
}: {
  size?: number;
  className?: string;
  /** Zadaj samo kad mark stoji sam kao link/dugme. Inače je dekorativan. */
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}

      <defs>
        {/* Šavovi se seku na unutrašnjoj ivici obruča. */}
        <clipPath id="efl-ball">
          <circle cx="50" cy="50" r="42.5" />
        </clipPath>
      </defs>

      {/* lopta */}
      <circle cx="50" cy="50" r="46" fill="#DF6320" stroke="#000000" strokeWidth="7" />

      {/* šavovi */}
      <g clipPath="url(#efl-ball)" stroke="#000000" strokeWidth="4.6" fill="none">
        <path d="M50 4 V96" />
        <path d="M4 50 H96" />
        <path d="M27 8 C 39 27, 39 73, 27 92" />
        <path d="M73 8 C 61 27, 61 73, 73 92" />
      </g>

      {/* EFL */}
      <g fill="#000000">
        {/* E */}
        <rect x="13" y="33" width="8" height="34" />
        <rect x="13" y="33" width="24" height="8" />
        <rect x="13" y="46" width="21" height="8" />
        <rect x="13" y="59" width="24" height="8" />
        {/* F */}
        <rect x="40" y="33" width="8" height="34" />
        <rect x="40" y="33" width="22" height="8" />
        <rect x="40" y="46" width="19" height="8" />
        {/* L */}
        <rect x="65" y="33" width="8" height="34" />
        <rect x="65" y="59" width="22" height="8" />
      </g>
    </svg>
  );
}
