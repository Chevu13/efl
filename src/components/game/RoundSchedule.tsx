'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FixtureRow from '../fixtures/FixtureRow';
import PlayerIdentity from '../player/PlayerIdentity';
import Leaderboard from './Leaderboard';
import IzazovNagrade from './IzazovNagrade';
import { Button } from '../ui/Button';
import { Alert, RowDivider } from '../ui/primitives';
import { dayLabel, mecevi, num, untilLabel } from '@/lib/format';
import type {
  ChallengeLine,
  Fixture,
  LeaderboardRow,
  Player,
  PricedPlayer,
  Round,
  Team
} from '@/lib/types';

type Line = ChallengeLine & { players: Player };
type Answers = Record<string, string>;

type SavedPick =
  | { kind: 'player'; line_id: number; answer: string }
  | { kind: 'fixture'; fixture_id: number; answer: string };

/**
 * Raspored kola sa izazovom u istom redu.
 *
 * Ranije su ovo bila dva ekrana: raspored na jednom, glasanje na drugom.
 * Nema razloga — mec koji gledas je mec na koji glasas, pa dugmad stoje
 * tu gde su i procena snaga i fantasy prilike iz tog meca.
 *
 * Prognoza se i dalje salje jednim pozivom, na istu rutu kao pre.
 */
export default function RoundSchedule({
  round,
  fixtures,
  lines,
  players,
  teams,
  board,
  loggedIn
}: {
  round: Round;
  fixtures: Fixture[];
  lines: Line[];
  players: PricedPlayer[];
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

  /* Vrati ranije poslatu prognozu. */
  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch(`/api/prognoza?round_id=${round.id}`)
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
  /* Poslata prognoza se i dalje vidi, samo se ne menja dok se ne otkljuca. */
  const frozen = sent || locked;

  function answer(key: string, value: string) {
    if (frozen) return;
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!loggedIn) {
      router.push(`/prijava?next=${encodeURIComponent('/raspored')}`);
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
      const res = await fetch('/api/prognoza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_id: round.id, picks })
      });
      if (!res.ok) {
        const out = (await res.json()) as { error?: string };
        setError(out.error ?? 'Prognoza nije sacuvana.');
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

  const byDay = fixtures.reduce<Record<string, Fixture[]>>((acc, f) => {
    (acc[f.tip_off?.slice(0, 10) ?? 'bez-termina'] ||= []).push(f);
    return acc;
  }, {});
  const days = Object.keys(byDay).sort();

  const bestFor = (home: string, away: string) =>
    players
      .filter((p) => p.team_code === home || p.team_code === away)
      /* Projekcija stize samo za igrace koje paket vidi; ostali se redjaju
         po ceni, koja je javna, pa redosled ne otkriva nista. */
      .sort((a, b) => (b.projected ?? -1) - (a.projected ?? -1) || (b.price ?? 0) - (a.price ?? 0))
      .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* ---------------- stanje prognoze ---------------- */}
      {!loading && total > 0 && (
        <div className="panel px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[20px] uppercase">Izazov kola</h2>
              <p className="mt-1.5 max-w-md text-small text-ink-3">
                Pogodi pobednike mečeva i da li igrači prelaze svoju cenu. Bez uloga — pobednik
                kola dobija Pro na nedelju dana, a pobednik meseca Pro na ceo mesec.
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

          <div className="mt-4">
            <IzazovNagrade compact />
          </div>

          {round.deadline && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
              Zaključava se za {untilLabel(round.deadline)}
            </p>
          )}
        </div>
      )}

      {sent && !locked && (
        <Alert
          tone="ok"
          title="Prognoza je poslata"
          action={
            <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
              Izmeni
            </Button>
          }
        >
          Rezultati stizu posle poslednje utakmice kola.
        </Alert>
      )}

      {locked && (
        <Alert tone="warn" title="Kolo je zakljucano">
          Prognoza se vise ne moze menjati. Raspored i procene ostaju vidljivi.
        </Alert>
      )}

      {/* ---------------- mecevi po danima ---------------- */}
      {days.map((day) => {
        const label = day === 'bez-termina' ? null : dayLabel(`${day}T12:00:00`);
        return (
          <section key={day}>
            <RowDivider
              title={label ? label.date : 'Termin nije zakazan'}
              meta={
                label
                  ? `${label.weekday} · ${mecevi(byDay[day].length)}`
                  : mecevi(byDay[day].length)
              }
            />
            <div className="mt-4 overflow-hidden rounded-md border border-line bg-surface">
              {byDay[day].map((f) => (
                <FixtureRow
                  key={f.id}
                  f={f}
                  teams={teams}
                  topPlayers={bestFor(f.home_code, f.away_code)}
                  pick={answers[`M${f.id}`] as 'home' | 'away' | undefined}
                  onPick={loading ? undefined : (v) => answer(`M${f.id}`, v)}
                  pickDisabled={frozen}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* ---------------- granice igraca ---------------- */}
      {lines.length > 0 && (
        <section>
          <RowDivider title="Igraci — prelaze li svoju cenu" meta={`${lines.length}`} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lines.map((l) => (
              <LineCard
                key={l.id}
                line={l}
                teams={teams}
                value={answers[`L${l.id}`]}
                disabled={frozen}
                onPick={(v) => answer(`L${l.id}`, v)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- slanje ---------------- */}
      {!frozen && total > 0 && (
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
              <b className="text-ink">Prognoza je popunjena.</b>
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
            {loggedIn ? 'Posalji prognozu' : 'Prijavi se i posalji'}
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
                  ${value ? 'border-brand bg-brand/[.04]' : 'hover:border-line-2'}`}
    >
      <PlayerIdentity player={line.players} teams={teams} size="md" />

      <div className="flex items-baseline justify-center gap-2 border-y border-line py-3">
        <span className="stat text-[34px] leading-none">{num(line.line)}</span>
        <span className="label">cena · granica FP</span>
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
              /* Izabrano mora da se vidi bez trazenja: puna narandzasta,
                 crn tekst, prsten oko dugmeta i neizabrano prigusi. */
              className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border
                          text-[12.5px] font-bold uppercase tracking-wide transition-all duration-fast
                          disabled:opacity-40
                          ${on
                            ? 'border-brand bg-brand text-black shadow-[0_0_0_3px_rgb(223_99_32/.28)]'
                            : value
                              ? 'border-line bg-transparent text-ink-4 hover:border-line-2 hover:text-ink-3'
                              : 'border-line text-ink-3 hover:border-line-2 hover:bg-elev hover:text-ink'}`}
            >
              <span aria-hidden>{side === 'over' ? '▲' : '▼'}</span>
              {side === 'over' ? 'Iznad' : 'Ispod'}
              {on && (
                <span className="sr-only"> — izabrano</span>
              )}
            </button>
          );
        })}
      </div>
    </article>
  );
}
