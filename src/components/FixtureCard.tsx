'use client';

import TeamCrest from './TeamCrest';
import { dayLabel, teamName } from '@/lib/format';
import type { Fixture, Team } from '@/lib/types';

/**
 * Mec u izazovu kola — bira se pobednik.
 *
 * Izabrana strana se ne obelezava samo bojom nego i punom podlogom i
 * kvacicom, pa se izbor vidi i bez percepcije boje. Dva dugmeta su
 * dovoljno velika za prst i na najuzem telefonu.
 */
export default function FixtureCard({
  f,
  teams,
  pick,
  onPick
}: {
  f: Fixture;
  teams: Record<string, Team>;
  pick?: 'home' | 'away';
  onPick?: (v: 'home' | 'away') => void;
}) {
  const t = dayLabel(f.tip_off);
  const edge = f.home_edge;

  return (
    <article
      className={`panel overflow-hidden transition-colors duration-fast
                  ${pick ? 'border-brand/60' : 'hover:border-line-2'}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2">
        <span className="label">{t ? `${t.weekdayShort} · ${t.dateShort}` : 'Termin'}</span>
        <span className="statmono text-[12px] text-ink-2">{t?.time ?? ''}</span>
      </div>

      <div className="px-3.5 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {([f.home_code, f.away_code] as const).map((code, i) => (
            <div key={code} className={`flex flex-col items-center gap-2 ${i ? 'order-3' : ''}`}>
              <TeamCrest team={teams[code]} code={code} s="lg" />
              <span className="text-center text-[12.5px] font-semibold leading-tight">
                {teamName(teams, code)}
              </span>
            </div>
          ))}
          <span className="order-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-4">
            protiv
          </span>
        </div>

        {edge != null && (
          <div className="mt-4">
            <span className="flex h-1.5 overflow-hidden rounded-full bg-sunken">
              <span className="block bg-brand" style={{ width: `${edge}%` }} />
              <span className="block bg-line-2" style={{ width: `${100 - edge}%` }} />
            </span>
            <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-3">
              <span className="text-ink-2">{edge}%</span>
              <span className="uppercase tracking-wide">nasa procena</span>
              <span className="text-ink-2">{100 - edge}%</span>
            </div>
          </div>
        )}

        {onPick && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['home', 'away'] as const).map((side) => {
              const on = pick === side;
              const code = side === 'home' ? f.home_code : f.away_code;
              return (
                <button
                  key={side}
                  onClick={() => onPick(side)}
                  aria-pressed={on}
                  className={`inline-flex h-11 items-center justify-center gap-1.5 truncate rounded-sm
                              border px-2 text-[12px] font-semibold transition-colors duration-fast
                              ${on
                                ? 'border-brand bg-brand text-black'
                                : 'border-line text-ink-3 hover:border-line-2 hover:bg-elev hover:text-ink'}`}
                >
                  {on && <span aria-hidden>✓</span>}
                  <span className="truncate">{teamName(teams, code)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {f.pred_sr && (
        <p className="rule-brand border-t border-line bg-sunken px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-3">
          {f.pred_sr}
        </p>
      )}
    </article>
  );
}
