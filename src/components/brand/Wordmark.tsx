/** Odnos sirine i visine originalnog vektora — drzi ga uz izvor. */
const RATIO = 381.82 / 191.96;

/**
 * EURO / FANTASY / LAB iz brend paketa, u beloj i narandzastoj — verzija
 * za tamnu podlogu. Zvanicna kompozicija je u tri reda; jednorednu
 * brend nema, pa je i ovde nema.
 */
export default function Wordmark({
  height = 30,
  className = ''
}: {
  height?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/efl-wordmark.svg"
      width={Math.round(height * RATIO)}
      height={height}
      alt="Euro Fantasy Lab"
      className={`shrink-0 ${className}`}
    />
  );
}
