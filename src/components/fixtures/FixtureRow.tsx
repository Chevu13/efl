import TeamCrest from '../TeamCrest';
import { dayLabel, lastName, num, teamName } from '@/lib/format';
import type { Fixture, PricedPlayer, Team } from '@/lib/types';

/**
 * Mec kao red statisticke tabele, ne kao kartica dogadjaja.
 *
 * Odnos snaga se cita iz jedne trake izmedju dva tima: sirina je nasa
 * procena, a procenti stoje ispisani sa obe strane, pa se podatak vidi
 * i kad se traka ne razlikuje na prvi pogled.
 */
export default function FixtureRow({
  f,
  teams,
  topPlayers = [],
  pick,
  onPick,
  pickDisabled = false
}: {
  f: Fixture;
  teams: Record<string, Team>;
  /** Najbolje fantasy prilike iz ovog meca. */
  topPlayers?: PricedPlayer[];
  /** Izabrani pobednik u izazovu kola. */
  pick?: 'home' | 'away';
  /** Ako nije prosledjeno, red je samo raspored — bez glasanja. */
  onPick?: (v: 'home' | 'away') => void;
  pickDisabled?: boolean;
}) {
  const t = dayLabel(f.tip_off);
  const edge = f.home_edge;
  const played = f.home_score != null && f.away_score != null;

  return (
    <article
      className={`group border-b border-line transition-colors duration-fast last:border-0
                  hover:bg-elev ${pick ? 'rule-brand bg-brand/[.04]' : ''}`}
    >
      <div className="grid items-center gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[92px_1fr_auto]">
        {/* vreme */}
        <div className="flex items-center gap-3 lg:block">
          <div className="statmono text-[15px] text-ink">{t?.time ?? '—'}</div>
          <div className="label lg:mt-1">
            {t ? `${t.weekdayShort} ${t.dateShort}` : ''}
          </div>
        </div>

        {/* timovi + odnos snaga */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
          <div className="flex min-w-0 items-center justify-end gap-2.5 text-right">
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">
                {teamName(teams, f.home_code)}
              </span>
              <span className="label">Domacin</span>
            </span>
            <TeamCrest team={teams[f.home_code]} code={f.home_code} s="lg" />
          </div>

          <div className="w-16 text-center sm:w-24">
            {played ? (
              <div className="statmono text-[19px]">
                {f.home_score}–{f.away_score}
              </div>
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
                protiv
              </div>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2.5">
            <TeamCrest team={teams[f.away_code]} code={f.away_code} s="lg" />
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">
                {teamName(teams, f.away_code)}
              </span>
              <span className="label">Gost</span>
            </span>
          </div>
        </div>

        {/* fantasy prilike */}
        {topPlayers.length > 0 && (
          <div className="flex items-center gap-2 lg:justify-end">
            <span className="label hidden xl:inline">Prilika</span>
            <div className="flex gap-1.5">
              {topPlayers.slice(0, 3).map((p) => (
                <span
                  key={p.id}
                  title={`${p.short_name} · projekcija ${num(p.projected)} FP`}
                  className="inline-flex items-center gap-1.5 rounded-xs border border-line bg-sunken
                             px-2 py-1 font-mono text-[10.5px] text-ink-2"
                >
                  <span className="truncate uppercase">{lastName(p.short_name)}</span>
                  <span className="font-bold text-brand">{num(p.projected, 0)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* traka procene */}
      {edge != null && (
        <div className="px-4 pb-4 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="statmono w-9 text-[12px] text-ink-2">{edge}%</span>
            <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
              <span className="block bg-brand transition-[width] duration-slow" style={{ width: `${edge}%` }} />
              <span className="block bg-line-2" style={{ width: `${100 - edge}%` }} />
            </span>
            <span className="statmono w-9 text-right text-[12px] text-ink-2">{100 - edge}%</span>
          </div>
          <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-4">
            nasa procena sanse za pobedu
          </p>
        </div>
      )}

      {/* glasanje — isti red, bez skakanja na drugu stranicu */}
      {onPick && (
        <div className="px-4 pb-4 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="label shrink-0">Ko pobedjuje</span>
            <span className="h-px flex-1 bg-line/70" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['home', 'away'] as const).map((side) => {
              const on = pick === side;
              const code = side === 'home' ? f.home_code : f.away_code;
              return (
                <button
                  key={side}
                  onClick={() => onPick(side)}
                  disabled={pickDisabled}
                  aria-pressed={on}
                  className={`inline-flex h-11 items-center justify-center gap-2 truncate rounded-sm border
                              px-3 text-[12.5px] font-semibold transition-colors duration-fast
                              disabled:opacity-40
                              ${on
                                ? 'border-brand bg-brand text-black'
                                : 'border-line text-ink-3 hover:border-line-2 hover:bg-elev hover:text-ink'}`}
                >
                  {on && <span aria-hidden>✓</span>}
                  <TeamCrest team={teams[code]} code={code} s="xs" />
                  <span className="truncate">{teamName(teams, code)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {f.pred_sr && (
        <details className="group/d border-t border-line/60 px-4 sm:px-5">
          <summary
            className="flex cursor-pointer list-none items-center gap-2 py-3 text-[12.5px]
                       font-semibold text-ink-3 transition-colors duration-fast hover:text-ink"
          >
            <span
              className="inline-block transition-transform duration-fast group-open/d:rotate-90"
              aria-hidden
            >
              ›
            </span>
            Analiza meca
          </summary>
          <p className="rule-brand mb-4 bg-sunken px-4 py-3 text-small leading-relaxed text-ink-2">
            {f.pred_sr}
          </p>
        </details>
      )}
    </article>
  );
}
