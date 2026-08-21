'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlayerPhoto from './PlayerPhoto';
import FixtureCard from './FixtureCard';
import { num, teamName } from '@/lib/format';
import type { ChallengeLine, Fixture, Player, Round, Team } from '@/lib/types';

type Line = ChallengeLine & { players: Player };
type Odgovori = Record<string, string>;

export default function GameBoard({
  round, lines, fixtures, teams, board, prijavljen
}: {
  round: Round;
  lines: Line[];
  fixtures: Fixture[];
  teams: Record<string, Team>;
  board: { username: string; accuracy: number }[];
  prijavljen: boolean;
}) {
  const router = useRouter();
  const [o, setO] = useState<Odgovori>({});
  const [poslat, setPoslat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [greska, setGreska] = useState('');

  // Vrati ranije poslat listić
  useEffect(() => {
    if (!prijavljen) return;
    fetch(`/api/prognoza?round_id=${round.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.picks?.length) return;
        const v: Odgovori = {};
        d.picks.forEach((p: any) => {
          if (p.kind === 'player') v[`L${p.line_id}`] = p.answer;
          else v[`M${p.fixture_id}`] = p.answer;
        });
        setO(v);
        setPoslat(true);
      })
      .catch(() => {});
  }, [round.id, prijavljen]);

  const ukupno = lines.length + fixtures.length;
  const dato = Object.keys(o).length;
  const preostalo = ukupno - dato;
  const procenat = ukupno ? Math.round((dato / ukupno) * 100) : 0;

  function odgovori(k: string, v: string) {
    if (poslat) return;
    setO((prev) => ({ ...prev, [k]: v }));
  }

  async function posalji() {
    if (!prijavljen) { router.push('/prijava'); return; }
    setBusy(true); setGreska('');
    const picks = Object.entries(o).map(([k, v]) =>
      k[0] === 'L'
        ? { kind: 'player' as const, line_id: Number(k.slice(1)), answer: v }
        : { kind: 'fixture' as const, fixture_id: Number(k.slice(1)), answer: v }
    );
    const res = await fetch('/api/prognoza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round_id: round.id, picks })
    });
    setBusy(false);
    if (!res.ok) { setGreska((await res.json()).error ?? 'Greška.'); return; }
    setPoslat(true);
    router.refresh();
  }

  if (poslat) {
    return (
      <>
        <div className="card border-ok/30 p-10 text-center">
          <div className="mx-auto grid h-13 w-13 place-items-center rounded-full bg-ok/15 p-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5 10 17.5 19 7" stroke="#3AC96E" strokeWidth="2.2"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="mt-4 font-display text-xl font-bold">Prognoza poslata</h2>
          <p className="mt-2 text-[13.5px] text-muted">
            Rezultati stižu posle poslednje utakmice kola. Vidimo se sledeće nedelje.
          </p>
          <button onClick={() => setPoslat(false)} className="btn-ghost mt-6">Izmeni prognozu</button>
        </div>
        <Lista board={board} />
      </>
    );
  }

  return (
    <>
      <section className="tgrid card relative overflow-hidden p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex-1">
            <h1 className="font-display text-[clamp(20px,3.4vw,27px)] font-bold tracking-tight">
              Iznad ili ispod?
            </h1>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted">
              {lines.length} igrača i {fixtures.length} utakmica. Bez uloga — igra se za PRO paket.
            </p>
          </div>
          <div className="text-right">
            <div className="stat text-3xl">
              <span className="text-brand">{dato}</span>/{ukupno}
            </div>
            <div className="label mt-1">ODABRANO</div>
          </div>
        </div>

        <div className="mt-5 h-1 overflow-hidden rounded-full bg-elev">
          <i className="block h-full bg-brand transition-all duration-500" style={{ width: `${procenat}%` }} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip border border-line bg-bg text-muted">
            <b className="font-mono text-brand">9/10</b> sledeće kolo PRO
          </span>
          <span className="chip border border-line bg-bg text-muted">
            <b className="font-mono text-data">#1</b> najbolji u mesecu — mesec PRO
          </span>
        </div>
      </section>

      {!!lines.length && (
        <>
          <Naslov t="Igrači — iznad ili ispod granice" n={lines.length} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lines.map((l) => {
              const v = o[`L${l.id}`];
              return (
                <article key={l.id}
                  className={`card flex flex-col gap-3 p-4 transition-colors
                    ${v === 'over' ? 'border-brand/50' : v === 'under' ? 'border-data/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <PlayerPhoto player={l.players} size="md" />
                    <div className="min-w-0">
                      <div className="truncate font-display text-[14.5px] font-bold uppercase">
                        {l.players.short_name}
                      </div>
                      <div className="label mt-1 truncate">
                        {l.players.position} · {teamName(teams, l.players.team_code)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-center gap-2 border-y border-line py-2.5">
                    <span className="stat text-3xl">{num(l.line)}</span>
                    <span className="label">GRANICA · FP</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(['over', 'under'] as const).map((side) => (
                      <button key={side} onClick={() => odgovori(`L${l.id}`, side)}
                        className={`h-10 rounded-md border font-mono text-[11.5px] transition-colors
                          ${v === side
                            ? side === 'over'
                              ? 'border-brand bg-brand font-bold text-bg'
                              : 'border-data bg-data font-bold text-[#06121C]'
                            : 'border-line text-muted hover:border-white/20 hover:bg-elev hover:text-ink'}`}>
                        {side === 'over' ? 'IZNAD' : 'ISPOD'}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {!!fixtures.length && (
        <>
          <Naslov t="Utakmice — ko pobeđuje" n={fixtures.length} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fixtures.map((f) => (
              <FixtureCard key={f.id} f={f} teams={teams}
                pick={o[`M${f.id}`] as 'home' | 'away' | undefined}
                onPick={(v) => odgovori(`M${f.id}`, v)} />
            ))}
          </div>
        </>
      )}

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center gap-4 rounded-card
                      border border-line bg-elev p-4 shadow-[0_8px_24px_rgba(0,0,0,.45)]">
        <p className="min-w-[150px] flex-1 text-[12.5px] text-muted">
          {preostalo
            ? <>Ostalo još <b className="font-mono text-ink">{preostalo}</b>.</>
            : 'Prognoza je popunjena.'}
          <br />Zaključava se na deadline kola.
        </p>
        {greska && <span className="font-mono text-[11px] text-warn">{greska}</span>}
        <button onClick={posalji} disabled={!!preostalo || busy} className="btn-primary">
          {busy ? '…' : prijavljen ? 'Pošalji prognozu' : 'Prijavi se i pošalji'}
        </button>
      </div>

      <Lista board={board} />
    </>
  );
}

function Naslov({ t, n }: { t: string; n: number }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3">
      <span className="font-display text-[15px] font-bold">{t}</span>
      <span className="h-px flex-1 bg-line" />
      <span className="font-mono text-[10px] text-muted">{n}</span>
    </div>
  );
}

function Lista({ board }: { board: { username: string; accuracy: number }[] }) {
  if (!board?.length) return null;
  const najbolji = board[0]?.accuracy;
  return (
    <section className="mt-8 overflow-hidden rounded-card border border-line">
      <div className="flex items-center gap-2 border-b border-line p-4">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <h3 className="text-sm font-semibold">Sezonska lista</h3>
      </div>
      <div className="grid grid-cols-[32px_1fr_auto] gap-3 bg-elev p-3 label">
        <span>#</span><span>Korisnik</span><span>Tačnost</span>
      </div>
      {board.map((u, i) => (
        <div key={u.username}
             className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-line p-3
                        text-[13.5px] last:border-0">
          <span className={`font-mono ${u.accuracy === najbolji ? 'text-brand' : 'text-muted'}`}>
            {u.accuracy === najbolji ? 1 : i + 1}
          </span>
          <span className="truncate">{u.username}</span>
          <span className="stat">{u.accuracy}%</span>
        </div>
      ))}
    </section>
  );
}
