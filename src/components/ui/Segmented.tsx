'use client';

/**
 * Vodoravni izbor. Na uskom ekranu klizi, ne prelama se u dva reda.
 * Tastatura radi kao na standardnom tab listu: strelice menjaju izbor.
 */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  label,
  className = ''
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  label: string;
  className?: string;
}) {
  const h = size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-10 px-4 text-[13px]';

  function onKey(e: React.KeyboardEvent) {
    const i = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(options[(i + 1) % options.length].value);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(options[(i - 1 + options.length) % options.length].value);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
      className={`no-scrollbar flex shrink-0 gap-1 overflow-x-auto rounded-sm border border-line
                  bg-sunken p-1 ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`${h} inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xs
                        font-semibold transition-colors duration-fast
                        ${on
                          ? 'bg-brand text-black'
                          : 'text-ink-3 hover:bg-elev hover:text-ink'}`}
          >
            {o.label}
            {o.count != null && (
              <span
                className={`font-mono text-[10.5px] tabular-nums ${
                  on ? 'text-black/60' : 'text-ink-4'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
