import PlayerPhoto from './PlayerPhoto';
import { num, valueClass, matchupClass, matchupWord, teamName } from '@/lib/format';
import type { PricedPlayer, Team } from '@/lib/types';

export default function PlayerCard({
  p, teams, locked = false, why = true
}: {
  p: PricedPlayer;
  teams: Record<string, Team>;
  locked?: boolean;
  why?: boolean;
}) {
  if (locked) {
    return (
      <article className="card p-4 relative overflow-hidden border-brand/35
                          bg-gradient-to-br from-surface to-brand/[0.04]">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full border border-line bg-elev grid place-items-center">
            <span className="font-display font-bold text-white/25">?</span>
          </div>
          <div className="min-w-0">
            <div className="h-3.5 w-28 rounded bg-line" />
            <div className="label mt-2">
              {p.position} · {teamName(teams, p.team_code)}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-y border-line py-3">
          {['CENA', 'PROJ', 'VREDNOST'].map((l, i) => (
            <div key={l} className={i === 2 ? 'text-right' : i === 1 ? 'text-center' : ''}>
              <div className="label">{l}</div>
              <div className="mt-1 h-4 w-10 rounded bg-line inline-block" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Meč se vidi na svakom paketu. PRO otkriva igrača, cenu i projekciju.
        </p>
      </article>
    );
  }

  return (
    <article className="card p-4 transition-all hover:-translate-y-0.5 hover:border-white/15">
      <div className="flex items-center gap-3">
        <PlayerPhoto player={p} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-[15px] font-bold uppercase tracking-tight">
              {p.short_name}
            </h3>
            <span
              className={`chip ${
                p.position === 'G' ? 'bg-data/15 text-data'
                  : p.position === 'F' ? 'bg-ok/15 text-ok'
                  : 'bg-muted/15 text-muted'
              } h-[17px] w-[17px] justify-center px-0 font-bold`}
            >
              {p.position}
            </span>
          </div>
          <div className="label mt-1 truncate">
            {p.jersey != null && `#${p.jersey} · `}
            {teamName(teams, p.team_code)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-y border-line py-3">
        <div>
          <div className="label">CENA</div>
          <div className="stat mt-1 text-xl">
            {num(p.price)}
            <span className="ml-0.5 text-[10px] font-normal text-muted">CR</span>
          </div>
        </div>
        <div className="text-center">
          <div className="label">PROJ</div>
          <div className="stat mt-1 text-xl">{num(p.projected)}</div>
        </div>
        <div className="text-right">
          <div className="label">VREDNOST</div>
          <div className={`stat mt-1 text-xl ${valueClass(p.value_score)}`}>
            {num(p.value_score)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="truncate text-muted">
          {p.opponent_code ? `${p.is_home ? 'protiv' : 'kod'} ${teamName(teams, p.opponent_code)}` : ''}
        </span>
        <span className={matchupClass(p.matchup_score)}>
          {num(p.matchup_score)} {matchupWord(p.matchup_score)}
        </span>
      </div>

      {why && p.why_sr && (
        <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-muted">
          {p.why_sr}
        </p>
      )}
    </article>
  );
}
