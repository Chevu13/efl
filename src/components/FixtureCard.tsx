'use client';
import { teamName } from '@/lib/format';
import type { Fixture, Team } from '@/lib/types';

export default function FixtureCard({
  f, teams, pick, onPick
}: {
  f: Fixture;
  teams: Record<string, Team>;
  pick?: 'home' | 'away';
  onPick?: (v: 'home' | 'away') => void;
}) {
  const edge = f.home_edge;
  const t = f.tip_off ? new Date(f.tip_off) : null;

  return (
    <article className={`card p-4 transition-colors ${pick ? 'border-brand/45' : ''}`}>
      <div className="text-center font-mono text-[9.5px] tracking-[0.12em] text-muted">
        {t && `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}. · ${t.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}`}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {[f.home_code, f.away_code].map((code, i) => (
          <div key={code} className={`flex flex-col items-center gap-2 ${i ? 'order-3' : ''}`}>
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-line
                             bg-elev font-mono text-[10px] font-bold text-muted">
              {code}
            </span>
            <span className="text-center text-[12.5px] font-semibold leading-tight">
              {teamName(teams, code)}
            </span>
          </div>
        ))}
        <span className="order-2 font-mono text-[9.5px] tracking-[0.12em] text-muted">PROTIV</span>
      </div>

      {edge != null && (
        <div className="mt-3">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-elev">
            <i className="block bg-brand" style={{ width: `${edge}%` }} />
            <i className="block bg-line" style={{ width: `${100 - edge}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
            <span className="text-ink">{edge}%</span>
            <span>naša procena</span>
            <span className="text-ink">{100 - edge}%</span>
          </div>
        </div>
      )}

      {onPick && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['home', 'away'] as const).map((side) => (
            <button
              key={side}
              onClick={() => onPick(side)}
              className={`h-10 truncate rounded-md border px-2 font-mono text-[11px] transition-colors
                ${pick === side
                  ? 'border-brand bg-brand font-bold text-bg'
                  : 'border-line text-muted hover:border-white/20 hover:bg-elev hover:text-ink'}`}
            >
              {teamName(teams, side === 'home' ? f.home_code : f.away_code)}
            </button>
          ))}
        </div>
      )}

      {f.pred_sr && (
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
          {f.pred_sr}
        </p>
      )}
    </article>
  );
}
