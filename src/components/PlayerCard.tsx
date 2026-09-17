import Link from 'next/link';
import PlayerIdentity from './player/PlayerIdentity';
import MatchupPill from './player/MatchupPill';
import { Chip, Hint, Meter } from './ui/primitives';
import { Delta, FormBars } from './ui/Stat';
import { edge, num, signed, valueClass, valueWord, valueBand, teamName } from '@/lib/format';
import type { PricedPlayer, Team, Tier } from '@/lib/types';
import { METRIKE } from '@/lib/config';

/**
 * Izbor kola.
 *
 * Nije obicna kartica sa tri broja — ima jasnu hijerarhiju:
 * projekcija je najveci broj, cena i vrednost stoje uz nju, a ispod
 * ide razlog. Zakljucana varijanta ne skriva sve nego pokazuje
 * dovoljno da se vidi sta se kupuje.
 */
export default function PlayerCard({
  p,
  teams,
  rank,
  locked = false,
  why = true,
  need
}: {
  p: PricedPlayer;
  teams: Record<string, Team>;
  rank?: number;
  locked?: boolean;
  why?: boolean;
  need?: Tier;
}) {
  if (locked) return <LockedCard p={p} teams={teams} rank={rank} need={need} />;

  const band = valueBand(p.value_score);

  return (
    <article className="group panel relative flex flex-col overflow-hidden transition-colors duration-fast hover:border-line-2">
      {/* zaglavlje */}
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-2.5">
          {rank != null && (
            <span className="font-mono text-[11px] font-bold tabular-nums text-brand">
              {String(rank).padStart(2, '0')}
            </span>
          )}
          <span className="label">Izbor kola</span>
        </span>
        {band === 'elite' && <Chip tone="brand">Vrhunska vrednost</Chip>}
        {p.status && p.status !== 'ok' && <Chip tone="warn">{p.status}</Chip>}
      </header>

      <div className="px-4 pb-4 pt-4">
        <PlayerIdentity player={p} teams={teams} size="lg" ring={band === 'elite'} />

        {/* glavni brojevi — projekcija nosi tezinu */}
        <div className="mt-5 flex items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="label">
              <Hint text={METRIKE.projekcija} align="start">
                Projekcija
              </Hint>
            </div>
            <div className="stat mt-1 text-[42px] leading-none">
              {num(p.projected)}
              <span className="ml-1.5 font-mono text-[11px] font-medium text-ink-3">FP</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-right">
            <div>
              <div className="label">Cena</div>
              <div className="statmono mt-1 text-[16px]">{num(p.price)}</div>
            </div>
            <div>
              <div className="label">
                <Hint text={METRIKE.razlika} align="end">
                  Razlika
                </Hint>
              </div>
              <div className={`statmono mt-1 text-[16px] ${valueClass(p.value_score)}`}>
                {signed(edge(p))}
              </div>
            </div>
          </div>
        </div>

        {/* kontekst */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="label mb-1.5">Protivnik</div>
            <MatchupPill
              opponent={p.opponent_code}
              isHome={p.is_home}
              score={p.matchup_score}
              teams={teams}
              size="sm"
            />
          </div>
          <div>
            <div className="label mb-1.5">Forma · poslednjih 5</div>
            <div className="flex items-center gap-2.5">
              <FormBars values={p.form} />
              <span className="statmono text-[13px] text-ink-2">
                {num(p.season_avg ?? null)}
                <span className="ml-1 text-[10px] font-medium text-ink-3">PROSEK</span>
              </span>
            </div>
          </div>
        </div>

        {/* vrednost kao traka + rec, ne samo boja */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label">
              <Hint text={METRIKE.vrednost} align="start" icon>
                Vrednost
              </Hint>
            </span>
            <span className={`font-mono text-[11px] font-bold uppercase ${valueClass(p.value_score)}`}>
              {valueWord[band]}
            </span>
          </div>
          <Meter value={p.value_score} max={10} label="Ocena vrednosti" />
        </div>

        {(p.ownership != null || p.price_trend != null) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-ink-3">
            {p.ownership != null && (
              <span>
                <Hint text={METRIKE.vlasnistvo} align="start">
                  Vlasništvo
                </Hint>{' '}
                <b className="statmono text-ink-2">{num(p.ownership, 0)}%</b>
              </span>
            )}
            {p.price_trend != null && (
              <span className="inline-flex items-center gap-1.5">
                Cena <Delta value={p.price_trend} />
              </span>
            )}
          </div>
        )}
      </div>

      {why && p.why_sr && (
        <p className="rule-brand mt-auto border-t border-line bg-sunken px-4 py-3.5 text-small leading-relaxed text-ink-2">
          {p.why_sr}
        </p>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Zakljucan izbor. Vidi se pozicija, tim, protivnik i tezina meca —
 * dovoljno da korisnik zna sta dobija, a ne toliko da mu ne treba paket.
 */
function LockedCard({
  p,
  teams,
  rank,
  need = 'PLUS'
}: {
  p: PricedPlayer;
  teams: Record<string, Team>;
  rank?: number;
  need?: Tier;
}) {
  return (
    <article className="panel relative flex flex-col overflow-hidden border-dashed border-line-2">
      <header className="flex items-center justify-between gap-3 border-b border-line border-dashed px-4 py-2.5">
        <span className="flex items-center gap-2.5">
          {rank != null && (
            <span className="font-mono text-[11px] font-bold tabular-nums text-ink-4">
              {String(rank).padStart(2, '0')}
            </span>
          )}
          <span className="label">Izbor kola</span>
        </span>
        <Chip tone="brand">
          <LockIcon />
          {need}
        </Chip>
      </header>

      <div className="px-4 pb-4 pt-4">
        <div className="flex items-center gap-3">
          <div
            className="hatch grid h-16 w-16 shrink-0 place-items-center rounded-full border border-line-2 bg-elev"
            aria-hidden
          >
            <LockIcon className="h-5 w-5 text-ink-4" />
          </div>
          <div className="min-w-0">
            <div className="h-4 w-32 rounded-xs bg-line" aria-hidden />
            <div className="mt-2 text-[11.5px] text-ink-3">
              {p.position === 'G' ? 'Bek' : p.position === 'F' ? 'Krilo' : 'Centar'} ·{' '}
              {teamName(teams, p.team_code)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="label">Projekcija</div>
            <div className="mt-2 h-8 w-20 rounded-xs bg-line" aria-hidden />
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-right">
            <div>
              <div className="label">Cena</div>
              <div className="mt-2 ml-auto h-4 w-10 rounded-xs bg-line" aria-hidden />
            </div>
            <div>
              <div className="label">Vrednost</div>
              <div className="mt-2 ml-auto h-4 w-10 rounded-xs bg-line" aria-hidden />
            </div>
          </div>
        </div>

        {/* Ovo se vidi i bez paketa — kontekst nije ono sto se naplacuje. */}
        <div className="mt-4">
          <div className="label mb-1.5">Protivnik</div>
          <MatchupPill
            opponent={p.opponent_code}
            isHome={p.is_home}
            score={p.matchup_score}
            teams={teams}
            size="sm"
          />
        </div>
      </div>

      <div className="mt-auto border-t border-line bg-sunken px-4 py-3.5">
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Mec i tezina protivnika vide se u svakom paketu. {need} otkriva igraca,
          cenu, projekciju i obrazlozenje.
        </p>
        <Link href="/paketi" className="btn-primary btn-sm mt-3 w-full">
          Otkljucaj {need}
        </Link>
      </div>
    </article>
  );
}

function LockIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
