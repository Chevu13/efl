import type { ReactNode } from 'react';
import { signed } from '@/lib/format';
import { Hint } from './primitives';

/* ------------------------------------------------------------------ */
/* JEDAN PODATAK                                                       */
/* ------------------------------------------------------------------ */

export type StatSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<StatSize, string> = {
  sm: 'text-[17px]',
  md: 'text-[22px]',
  lg: 'text-[30px]',
  xl: 'text-[clamp(38px,6vw,62px)] leading-[0.9]'
};

/**
 * Osnovna jedinica prikaza broja: oznaka gore, broj dole, opciona
 * jedinica i objasnjenje. Brojevi su uvek tabularni da kolone stoje.
 */
export function Stat({
  label,
  value,
  unit,
  size = 'md',
  tone = 'default',
  hint,
  sub,
  className = ''
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  size?: StatSize;
  tone?: 'default' | 'brand' | 'muted' | 'neg';
  hint?: string;
  sub?: ReactNode;
  className?: string;
}) {
  const tones = {
    default: 'text-ink',
    brand: 'text-brand',
    muted: 'text-ink-3',
    neg: 'text-neg'
  };
  return (
    <div className={className}>
      <div className="label">{hint ? <Hint text={hint}>{label}</Hint> : label}</div>
      <div className={`stat mt-1.5 ${SIZES[size]} ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-1 font-mono text-[10px] font-medium text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  );
}

/**
 * Traka podataka preko cele sirine. Namerno nije mreza kartica —
 * jedna povrsina podeljena vlas-linijama, kao statisticka tabla.
 */
export function StatStrip({
  items,
  className = ''
}: {
  items: { label: ReactNode; value: ReactNode; unit?: string; hint?: string; tone?: 'default' | 'brand' | 'muted' | 'neg' }[];
  className?: string;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line
                  sm:grid-cols-4 ${className}`}
    >
      {items.map((it, i) => (
        <div key={i} className="bg-surface px-4 py-3.5">
          <Stat {...it} size="md" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RAZLIKA                                                             */
/* ------------------------------------------------------------------ */

/**
 * Promena u odnosu na nesto. Znak i strelica nose znacenje — boja je
 * samo pojacanje, pa podatak radi i za daltoniste i u crno-belom.
 */
export function Delta({
  value,
  unit,
  size = 'sm',
  suffix,
  className = ''
}: {
  value: number | null | undefined;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  suffix?: string;
  className?: string;
}) {
  if (value == null) return <span className="text-ink-3">—</span>;

  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  const sizes = { sm: 'text-[12px]', md: 'text-[15px]', lg: 'text-[22px]' };
  const tone = flat ? 'text-ink-3' : up ? 'text-brand' : 'text-neg';

  return (
    <span className={`inline-flex items-center gap-1 font-mono font-bold tabular-nums ${sizes[size]} ${tone} ${className}`}>
      <span aria-hidden>{flat ? '=' : up ? '▲' : '▼'}</span>
      <span>{signed(value)}</span>
      {unit && <span className="font-medium opacity-70">{unit}</span>}
      {suffix && <span className="font-medium opacity-70">{suffix}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* FORMA                                                               */
/* ------------------------------------------------------------------ */

/**
 * Forma poslednjih kola kao stubici. Najnovije kolo je desno i
 * naglaseno. Uz grafiku uvek ide i brojcani prosek u tekstu.
 */
export function FormBars({
  values,
  max,
  className = '',
  height = 22
}: {
  values: number[] | null | undefined;
  max?: number;
  className?: string;
  height?: number;
}) {
  if (!values?.length) return <span className="text-ink-3">—</span>;

  const top = max ?? Math.max(...values, 1);
  const last = values.length - 1;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <span
      className={`inline-flex items-end gap-[3px] ${className}`}
      style={{ height }}
      role="img"
      aria-label={`Forma poslednjih ${values.length} kola, prosek ${avg.toFixed(1)} poena`}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-[5px] rounded-[1px] transition-colors duration-fast ${
            i === last ? 'bg-brand' : 'bg-ink-4'
          }`}
          style={{ height: `${Math.max(12, (v / top) * 100)}%` }}
        />
      ))}
    </span>
  );
}
