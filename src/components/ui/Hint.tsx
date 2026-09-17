'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Objašnjenje uz skraćenicu ili metriku.
 *
 * Ranije je radilo samo na prelaz mišem i fokus tastaturom — na telefonu,
 * gde miša nema, objašnjenje se nije moglo otvoriti. Sada se otvara i
 * dodirom, zatvara drugim dodirom, dodirom van njega ili tasterom Escape.
 *
 * `place="bottom"` je za zaglavlja tabela: omotač tabele ima overflow, pa
 * bi oblačić iznad zaglavlja bio odsečen.
 * `align="end"` je za desne kolone, da oblačić ne izađe van ekrana.
 */
export function Hint({
  children,
  text,
  place = 'top',
  align = 'center',
  icon = false
}: {
  children: ReactNode;
  text: string;
  place?: 'top' | 'bottom';
  align?: 'center' | 'end' | 'start';
  /** Mala „i" ikonica uz tekst — kad nije očigledno da se može kliknuti. */
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent || e instanceof TouchEvent) {
        if (ref.current?.contains(e.target as Node)) return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const pos = place === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]';
  const horiz =
    align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2';

  return (
    <span ref={ref} className="group/hint relative inline-flex items-center">
      <span
        role="button"
        tabIndex={0}
        aria-describedby={id}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="inline-flex cursor-help items-center gap-1 border-b border-dotted border-ink-4
                   focus:outline-none focus-visible:rounded-xs focus-visible:ring-1 focus-visible:ring-brand"
      >
        {children}
        {icon && (
          <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-ink-4" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 7.2v3.6M8 5.1v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute ${pos} ${horiz} z-40 w-max max-w-[240px]
                    rounded-sm border border-line-2 bg-raise px-2.5 py-2 text-left text-[12px] font-normal
                    normal-case leading-snug tracking-normal text-ink-2 shadow-pop
                    transition-opacity duration-fast
                    ${open ? 'opacity-100' : 'opacity-0 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100'}`}
      >
        {text}
      </span>
    </span>
  );
}
