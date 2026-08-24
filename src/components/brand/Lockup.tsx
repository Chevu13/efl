import Logomark from './Logomark';

/**
 * Puni logotip: brendmark + EURO / FANTASY / LAB.
 *
 * `stacked` je zvanična kompozicija iz priručnika (tri reda).
 * `inline` je jednoredna varijanta za usku navigaciju i futer.
 */
export default function Lockup({
  variant = 'inline',
  size = 30,
  className = ''
}: {
  variant?: 'inline' | 'stacked';
  size?: number;
  className?: string;
}) {
  if (variant === 'stacked') {
    return (
      <span className={`flex items-center gap-4 ${className}`}>
        <Logomark size={size} />
        <span
          className="font-display font-extrabold uppercase leading-[0.86] tracking-[-0.02em]"
          style={{ fontSize: size * 0.46 }}
        >
          <span className="block text-ink">Euro</span>
          <span className="block text-brand">Fantasy</span>
          <span className="block text-ink">Lab</span>
        </span>
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Logomark size={size} />
      <span
        className="font-display font-extrabold uppercase leading-none tracking-[-0.01em]"
        style={{ fontSize: size * 0.58 }}
      >
        <span className="text-ink">Euro</span>
        <span className="text-brand">Fantasy</span>
        <span className="text-ink">Lab</span>
      </span>
    </span>
  );
}
