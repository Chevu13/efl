import type { LeaderboardRow } from '@/lib/types';

/**
 * Sezonska lista tacnosti.
 *
 * Prvo mesto je istaknuto tipografijom i debljinom trake, ne samo bojom.
 * Traka pokazuje tacnost u odnosu na vodeceg, pa se razlike vide odmah.
 */
export default function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  if (!rows?.length) return null;
  const top = rows[0]?.accuracy || 1;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-head">
        <h3 className="text-[16px] uppercase">Sezonska lista</h3>
        <span className="label">Tacnost</span>
      </div>

      <ol>
        {rows.map((u, i) => (
          <li
            key={u.username}
            className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0
                        transition-colors duration-fast hover:bg-elev ${i === 0 ? 'bg-brand/[.06]' : ''}`}
          >
            <span
              className={`w-6 shrink-0 font-mono text-[12px] font-bold tabular-nums
                          ${i === 0 ? 'text-brand' : 'text-ink-4'}`}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{u.username}</span>
            <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-sunken sm:block">
              <span
                className={`block h-full rounded-full ${i === 0 ? 'bg-brand' : 'bg-ink-4'}`}
                style={{ width: `${(u.accuracy / top) * 100}%` }}
              />
            </span>
            <span className="statmono w-12 shrink-0 text-right text-[14px]">{u.accuracy}%</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
