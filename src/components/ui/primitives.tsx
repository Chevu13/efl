import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/* NASLOVI SEKCIJA                                                     */
/* ------------------------------------------------------------------ */

/**
 * Naslov sekcije. Isti ritam na svakoj stranici: nadnaslov, naslov,
 * opcioni opis i akcija desno.
 */
export function SectionHead({
  eyebrow,
  title,
  desc,
  action,
  className = '',
  as: Tag = 'h2'
}: {
  eyebrow?: string;
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-4 ${className}`}>
      <div className="min-w-0 max-w-prose">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <Tag
          className={
            Tag === 'h1'
              ? 'text-[clamp(30px,5vw,46px)] uppercase leading-[0.95]'
              : 'text-[clamp(22px,3vw,30px)] uppercase leading-[1]'
          }
        >
          {title}
        </Tag>
        {desc && <p className="mt-3 text-body text-ink-3">{desc}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Tanka pregrada sa naslovom — deli listu na grupe bez novih kartica. */
export function RowDivider({
  title,
  meta,
  className = ''
}: {
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="font-display text-[15px] font-extrabold uppercase tracking-tight">
        {title}
      </span>
      <span className="h-px flex-1 bg-line" />
      {meta && <span className="label shrink-0">{meta}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* POVRSINE                                                            */
/* ------------------------------------------------------------------ */

export function Panel({
  children,
  className = '',
  tone = 'default'
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'brand' | 'sunken';
}) {
  const tones = {
    default: 'panel',
    brand: 'rounded-md border border-brand/40 bg-gradient-to-b from-brand/[.07] to-surface',
    sunken: 'rounded-md border border-line bg-sunken'
  };
  return <div className={`${tones[tone]} ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* OZNAKE                                                             */
/* ------------------------------------------------------------------ */

export function Chip({
  children,
  tone = 'default',
  className = '',
  title
}: {
  children: ReactNode;
  tone?: 'default' | 'brand' | 'solid' | 'warn' | 'neg';
  className?: string;
  title?: string;
}) {
  const tones = {
    default: 'chip',
    brand: 'chip-brand',
    solid: 'chip-solid',
    warn: 'chip border-warn/40 bg-warn/10 text-warn',
    neg: 'chip border-neg/40 bg-neg/10 text-neg'
  };
  return (
    <span className={`${tones[tone]} ${className}`} title={title}>
      {children}
    </span>
  );
}

/** Oznaka pozicije. Slovo + boja, ali slovo je nosilac znacenja. */
export function PositionTag({ position }: { position: 'G' | 'F' | 'C' | null }) {
  if (!position) return null;
  return (
    <span className="postag" title={{ G: 'Bek', F: 'Krilo', C: 'Centar' }[position]}>
      {position}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* STANJA                                                             */
/* ------------------------------------------------------------------ */

export function Alert({
  tone = 'info',
  title,
  children,
  action
}: {
  tone?: 'info' | 'ok' | 'warn' | 'error';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: 'border-line bg-elev text-ink-2',
    ok: 'border-brand/45 bg-brand/[.09] text-ink',
    warn: 'border-warn/45 bg-warn/[.08] text-ink',
    error: 'border-neg/50 bg-neg/[.09] text-ink'
  };
  const marks = { info: '·', ok: '✓', warn: '!', error: '×' };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-sm border px-4 py-3 text-small ${tones[tone]}`}
    >
      <span className="mt-[1px] font-mono text-[13px] font-bold" aria-hidden>
        {marks[tone]}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  action,
  icon
}: {
  title: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="panel hatch flex flex-col items-center px-6 py-14 text-center">
      {icon ?? (
        <span
          className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-line-2 bg-elev
                     font-mono text-[15px] text-ink-4"
          aria-hidden
        >
          ∅
        </span>
      )}
      <p className="font-display text-[17px] font-extrabold uppercase tracking-tight">{title}</p>
      {desc && <p className="mt-2 max-w-sm text-small text-ink-3">{desc}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skel block ${className}`} aria-hidden />;
}

/** Skelet reda tabele — koristi se u loading.tsx fajlovima. */
export function SkeletonRows({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="panel divide-y divide-line" aria-busy>
      <span className="sr-only">Ucitavanje…</span>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 flex-1" />
          {Array.from({ length: cols - 2 }).map((__, c) => (
            <Skeleton key={c} className="hidden h-3.5 w-12 sm:block" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MERE                                                                */
/* ------------------------------------------------------------------ */

/** Vodoravna traka 0–max. Uvek ima i brojcanu vrednost pored sebe. */
export function Meter({
  value,
  max = 10,
  tone = 'brand',
  className = '',
  label
}: {
  value: number | null | undefined;
  max?: number;
  tone?: 'brand' | 'neutral';
  className?: string;
  label?: string;
}) {
  const pctv = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span
      role="meter"
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`block h-1 w-full overflow-hidden rounded-full bg-elev ${className}`}
    >
      <span
        className={`block h-full origin-left rounded-full transition-[width] duration-slow ease-out ${
          tone === 'brand' ? 'bg-brand' : 'bg-ink-4'
        }`}
        style={{ width: `${pctv}%` }}
      />
    </span>
  );
}

/* Objasnjenje uz metriku zivi u sopstvenom fajlu jer mora da radi i na
   dodir, a za to treba stanje na klijentu. */
export { Hint } from './Hint';
