import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'solid' | 'ghost' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  solid: 'btn-solid',
  ghost: 'btn-ghost',
  quiet: 'btn-quiet'
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg'
};

export const buttonClass = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = ''
) => `${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim();

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  loading?: boolean;
  children: ReactNode;
};

/**
 * Dugme. Sva stanja su predvidjena: hover, active, disabled, loading.
 * U toku ucitavanja ostaje ista sirina da se raspored ne pomera.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  full,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: Common & ComponentProps<'button'>) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, `${full ? 'w-full' : ''} ${className}`)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Ista vizuelna pravila, ali je semanticki link. */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  full,
  children,
  className = '',
  ...rest
}: Common & ComponentProps<typeof Link>) {
  return (
    <Link
      {...rest}
      className={buttonClass(variant, size, `${full ? 'w-full' : ''} ${className}`)}
    >
      {children}
    </Link>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      className={`animate-spin ${className}`}
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2.4" opacity=".25" fill="none" />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
