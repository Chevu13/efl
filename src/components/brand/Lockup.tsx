import Logomark from './Logomark';
import Wordmark from './Wordmark';

/**
 * Puni logotip: brendmark + EURO / FANTASY / LAB.
 *
 * Oba dela dolaze iz originalnih vektora, pa je jedina razlika izmedju
 * varijanti razmak — `tight` za navigaciju, `wide` kad logo stoji sam.
 */
export default function Lockup({
  variant = 'tight',
  size = 30,
  className = ''
}: {
  variant?: 'tight' | 'wide';
  size?: number;
  className?: string;
}) {
  return (
    <span className={`flex items-center ${variant === 'wide' ? 'gap-4' : 'gap-2.5'} ${className}`}>
      <Logomark size={size} />
      <Wordmark height={size} />
    </span>
  );
}
