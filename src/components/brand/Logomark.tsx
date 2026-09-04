/**
 * Zvanicni Euro Fantasy Lab brendmark — kosarkaska lopta sa slovima EFL.
 *
 * Crta se iz `public/brand/efl-mark.svg`, originalnog vektora iz brend
 * paketa. Boje su fiksne (#df6320 + crna), pa nema sta da se nasledjuje
 * iz teme; obicni `<img>` je dovoljan i ne nosi 4 KB putanja u JS bandl.
 */
export default function Logomark({
  size = 32,
  className = '',
  title
}: {
  size?: number;
  className?: string;
  /** Zadaj samo kad mark stoji sam kao link/dugme. Inace je dekorativan. */
  title?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/efl-mark.svg"
      width={size}
      height={size}
      alt={title ?? ''}
      className={`shrink-0 ${className}`}
    />
  );
}
