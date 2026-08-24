'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlayerIdentity from '../player/PlayerIdentity';
import FixtureCard from '../FixtureCard';
import Leaderboard from './Leaderboard';
import { Button } from '../ui/Button';
import { Alert, RowDivider } from '../ui/primitives';
import { num, untilLabel } from '@/lib/format';
import type { ChallengeLine, Fixture, LeaderboardRow, Player, Round, Team } from '@/lib/types';

type Line = ChallengeLine & { players: Player };
type Answers = Record<string, string>;

type SavedPick =
  | { kind: 'player'; line_id: number; answer: string }
  | { kind: 'fixture'; fixture_id: number; answer: string };

/**
 * Izazov kola — pogadja se da li igrac prelazi granicu i ko dobija mec.
 *
 * Ovo je postojeca igra proizvoda i ostaje netaknuta u ponasanju:
 * isti API, isti listic, ista nagrada. Promenjeno je samo kako izgleda i
 * koliko je jasno gde si stao.
 */
export default function ChallengeBoard({
  round,
  lines,
  fixtures,
  teams,
  board,
  loggedIn
}: {
  round: Round;
  lines: Line[];
  fixtures: Fixture[];
  teams: Record<string, Team>;
  board: LeaderboardRow[];
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  /* Vrati ranije poslat listic. */
  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch(`/api/listic?round_id=${round.id}`)
      .then((r) => r.json())
      .then((d: { picks?: SavedPick[] }) => {
        if (!alive || !d.picks?.length) return;
        const v: Answers = {};
        d.picks.forEach((p) => {
          if (p.kind === 'player') v[`L${p.line_id}`] = p.answer;
          else v[`M${p.fixture_id}`] = p.answer;
        });
        setAnswers(v);
        setSent(true);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [round.id, loggedIn]);

  const total = lines.length + fixtures.length;
  const given = Object.keys(answers).length;
  const left = total - given;
  const percent = total ? Math.round((given / total) * 100) : 0;
  const locked = round.status !== 'open';

  function answer(key: string, value: string) {
    if (sent || locked) return;
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!loggedIn) {
      router.push(`/prijava?next=${encodeURIComponent('/igra')}`);
      return;
    }
    setBusy(true);
    setError('');

    const picks = Object.entries(answers).map(([k, v]) =>
      k[0] === 'L'
        ? { kind: 'player' as const, line_id: Number(k.slice(1)), answer: v }
        : { kind: 'fixture' as const, fixture_id: Number(k.slice(1)), answer: v }
    );

    try {
      const res = await fetch('/api/listic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: round.id, picks })
      });
      if (!res.ok) {
        const out = (await res.json()) as { error?: string };
        setError(out.error ?? 'Listic nije sacuvan.');
        return;
      }
      setSent(true);
      router.refresh();
    } catch {
      setError('Nema veze sa serverom.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="skel h-64 w-full rounded-md" aria-label="Ucitavanje listica" />;
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <div className="panel hatch flex flex-col items-center px-6 py-12 text-center">
          <span
            className="grid h-12 w-12 place-items-center rounded-full border border-brand bg-brand/15"
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5 10 17.5 19 7"
                stroke="#DF6320"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h3 className="mt-4 text-[22px] uppercase">Listic je poslat</h3>
          <p className="mt-2 max-w-sm text-small text-ink-3">
            Rezultati stizu posle poslednje utakmice kola. Devet od deset tacnih
            donosi PRO na sledece kolo.
          </p>
          {!locked && (
            <Button variant="ghost" className="mt-6" onClick={() => setSent(false)}>
              Izmeni listic
            </Button>
          )}
        </div>
        <Leaderboard rows={board} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* napredak */}
      <div className="panel px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-[20px] uppercase">Iznad ili ispod?</h3>
            <p className="mt-1.5 max-w-md text-small text-ink-3">
              {lines.length} igraca i {fixtures.length} utakmica. Bez uloga — igra se za paket.
            </p>
          </div>
          <div className="text-right">
            <div className="stat text-[30px] leading-none">
              <span className="text-brand">{given}</span>
              <span className="text-ink-4">/{total}</span>
            </div>
            <div className="label mt-1.5">Odgovoreno</div>
          </div>
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-elev">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-slow ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip">
            <b className="text-brand">9/10</b> sledece kolo PRO
          </span>
          <span className="chip">
            <b className="text-ink">#1</b> u mesecu — mesec dana PRO
          </span>
          {round.deadline && (
            <span className="chip">Zakljucava se za {untilLabel(round.deadline)}</span>
          )}
        </div>
      </div>

      {locked && (
        <Alert tone="warn" title="Kolo je zakljucano">
          Listic se vise ne moze poslati. Rezultati stizu posle poslednje utakmice.
        </Alert>
      )}

      {/* granice igraca */}
      {lines.length > 0 && (
        <section>
          <RowDivider title="Igraci — iznad ili ispod granice" meta={`${lines.length}`} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lines.map((l) => (
              <LineCard
                key={l.id}
                line={l}
                teams={teams}
                value={answers[`L${l.id}`]}
                disabled={locked}
                onPick={(v) => answer(`L${l.id}`, v)}
              />
            ))}
          </div>
        </section>
      )}

      {/* mecevi */}
      {fixtures.length > 0 && (
        <section>
          <RowDivider title="Utakmice — ko pobedjuje" meta={`${fixtures.length}`} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fixtures.map((f) => (
              <FixtureCard
                key={f.id}
                f={f}
                teams={teams}
                pick={answers[`M${f.id}`] as 'home' | 'away' | undefined}
                onPick={locked ? undefined : (v) => answer(`M${f.id}`, v)}
              />
            ))}
          </div>
        </section>
      )}

      {/* slanje */}
      {!locked && (
        <div
          className="sticky bottom-3 z-20 flex flex-wrap items-center gap-4 rounded-md border border-line-2
                     bg-raise/95 px-4 py-3.5 shadow-rail backdrop-blur"
        >
          <p className="min-w-[160px] flex-1 text-[12.5px] leading-snug text-ink-3">
            {left ? (
              <>
                Ostalo jos <b className="statmono text-ink">{left}</b> odgovora.
              </>
            ) : (
              <b className="text-ink">Listic je popunjen.</b>
            )}
            <br />
            Zakljucava se na kraju roka za kolo.
          </p>
          {error && (
            <span role="alert" className="text-[12px] text-neg">
              {error}
            </span>
          )}
          <Button onClick={submit} loading={busy} disabled={!!left}>
            {loggedIn ? 'Posalji listic' : 'Prijavi se i posalji'}
          </Button>
        </div>
      )}

      <Leaderboard rows={board} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LineCard({
  line,
  teams,
  value,
  onPick,
  disabled
}: {
  line: Line;
  teams: Record<string, Team>;
  value?: string;
  onPick: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <article
      className={`panel flex flex-col gap-3 p-4 transition-colors duration-fast
                  ${value ? 'border-brand/60' : 'hover:border-line-2'}`}
    >
      <PlayerIdentity player={line.players} teams={teams} size="md" />

      <div className="flex items-baseline justify-center gap-2 border-y border-line py-3">
        <span className="stat text-[34px] leading-none">{num(line.line)}</span>
        <span className="label">granica · FP</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['over', 'under'] as const).map((side) => {
          const on = value === side;
          return (
            <button
              key={side}
              onClick={() => onPick(side)}
              disabled={disabled}
              aria-pressed={on}
              className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border
                          text-[12.5px] font-bold uppercase tracking-wide transition-colors duration-fast
                          disabled:opacity-40
                          ${on
                            ? 'border-brand bg-brand text-black'
                            : 'border-line text-ink-3 hover:border-line-2 hover:bg-elev hover:text-ink'}`}
            >
              <span aria-hidden>{side === 'over' ? '▲' : '▼'}</span>
              {side === 'over' ? 'Iznad' : 'Ispod'}
            </button>
          );
        })}
      </div>
    </article>
  );
}
