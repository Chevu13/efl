'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import PlayerIdentity from './PlayerIdentity';
import MatchupPill from './MatchupPill';
import Segmented from '../ui/Segmented';
import { EmptyState, Hint, Meter } from '../ui/primitives';
import { Delta, FormBars } from '../ui/Stat';
import { num, teamName, valueClass } from '@/lib/format';
import type { PricedPlayer, Team, Tier } from '@/lib/types';

type SortKey = 'value_score' | 'projected' | 'price' | 'season_avg' | 'ownership' | 'matchup_score';

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'value_score', label: 'Vrednost', hint: 'Koliko igrac ide plus od svoje cene. 5 znaci tacno po ceni.' },
  { key: 'projected', label: 'Projekcija', hint: 'Ocekivani fantasy poeni u ovom kolu.' },
  { key: 'price', label: 'Cena', hint: 'Cena igraca u kreditima za ovo kolo.' },
  { key: 'season_avg', label: 'Prosek', hint: 'Prosecan ucinak u poslednjih pet kola.' },
  { key: 'matchup_score', label: 'Protivnik', hint: 'Koliko je protivnik povoljan, od 1 do 10.' },
  { key: 'ownership', label: 'Vlasnistvo', hint: 'Procenat menadzera koji ga vec ima u timu.' }
];

const POSITIONS = [
  { value: 'ALL' as const, label: 'Sve pozicije' },
  { value: 'G' as const, label: 'Bekovi' },
  { value: 'F' as const, label: 'Krila' },
  { value: 'C' as const, label: 'Centri' }
];

/**
 * Tabela igraca — glavni alat proizvoda.
 *
 * Isti podaci na svakoj sirini ekrana, ali se broj kolona menja: na
 * telefonu ostaju ime, projekcija i vrednost, ostalo se sklapa.
 *
 * Vazno: ova komponenta prikazuje samo ono sto joj je server poslao.
 * Zakljucani redovi se crtaju iz broja `totalCount`, bez ijednog podatka
 * o tim igracima — nema sta da se procita iz izvora stranice.
 */
export default function PlayerTable({
  players,
  teams,
  tier,
  totalCount,
  need,
  showMatchup = true,
  emptyHint
}: {
  players: PricedPlayer[];
  teams: Record<string, Team>;
  tier?: Tier;
  /** Koliko igraca kolo ukupno ima — razlika se prikazuje kao zakljucano. */
  totalCount?: number;
  need?: Tier;
  showMatchup?: boolean;
  emptyHint?: string;
}) {
  const hidden = Math.max(0, (totalCount ?? players.length) - players.length);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<'ALL' | 'G' | 'F' | 'C'>('ALL');
  const [team, setTeam] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('value_score');

  const teamOptions = useMemo(
    () =>
      Object.values(teams)
        .map((t) => ({ code: t.code, name: t.name_sr }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sr')),
    [teams]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players
      .filter((p) => {
        if (pos !== 'ALL' && p.position !== pos) return false;
        if (team !== 'ALL' && p.team_code !== team) return false;
        if (!needle) return true;
        return (
          p.short_name.toLowerCase().includes(needle) ||
          p.full_name.toLowerCase().includes(needle) ||
          teamName(teams, p.team_code).toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const av = (a[sort] ?? -1) as number;
        const bv = (b[sort] ?? -1) as number;
        return sort === 'price' ? av - bv : bv - av;
      });
  }, [players, q, pos, team, sort, teams]);

  const counts = useMemo(
    () => ({
      G: players.filter((p) => p.position === 'G').length,
      F: players.filter((p) => p.position === 'F').length,
      C: players.filter((p) => p.position === 'C').length
    }),
    [players]
  );

  return (
    <div>
      {/* ---------------- filteri ---------------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <SearchIcon />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Trazi igraca ili tim…"
            aria-label="Pretraga igraca"
            className="field pl-10"
          />
        </div>

        <Segmented
          label="Pozicija"
          value={pos}
          onChange={setPos}
          options={POSITIONS.map((o) => ({
            ...o,
            count: o.value === 'ALL' ? players.length : counts[o.value]
          }))}
        />

        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          aria-label="Tim"
          className="field lg:w-52"
        >
          <option value="ALL">Svi timovi</option>
          {teamOptions.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* ---------------- sortiranje ---------------- */}
      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto">
        <span className="label shrink-0">Sortiraj</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            aria-pressed={sort === s.key}
            title={s.hint}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xs border px-2.5
                        font-mono text-[11px] uppercase tracking-wide transition-colors duration-fast
                        ${sort === s.key
                          ? 'border-brand bg-brand/15 text-brand-400'
                          : 'border-line text-ink-3 hover:border-line-2 hover:text-ink'}`}
          >
            {s.label}
            {sort === s.key && <span aria-hidden>{s.key === 'price' ? '▲' : '▼'}</span>}
          </button>
        ))}
      </div>

      <p className="mt-3 text-[12px] text-ink-3" role="status">
        Prikazano <b className="statmono text-ink">{rows.length}</b> od{' '}
        {totalCount ?? players.length} igraca
        {hidden > 0 && <span className="text-ink-4"> · {hidden} zakljucano</span>}
      </p>

      {/* ---------------- tabela ---------------- */}
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nema igraca za ovaj filter"
            desc={emptyHint ?? 'Probaj drugu poziciju ili ocisti pretragu.'}
          />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-md border border-line">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[640px]">
              <caption className="sr-only">
                Igraci sa cenom, projekcijom i ocenom vrednosti za tekuce kolo
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-10 text-center">
                    #
                  </th>
                  <th scope="col">Igrac</th>
                  {showMatchup && (
                    <th scope="col" className="hidden lg:table-cell">
                      Protivnik
                    </th>
                  )}
                  <th scope="col" className="hidden text-right md:table-cell">
                    <Hint text="Prosecan ucinak u poslednjih pet kola.">Forma</Hint>
                  </th>
                  <th scope="col" className="text-right">
                    <Hint text="Cena igraca u kreditima za ovo kolo.">Cena</Hint>
                  </th>
                  <th scope="col" className="text-right">
                    <Hint text="Ocekivani fantasy poeni u ovom kolu.">Proj.</Hint>
                  </th>
                  <th scope="col" className="text-right">
                    <Hint text="Koliko igrac ide plus od svoje cene. 5 znaci tacno po ceni.">Vred.</Hint>
                  </th>
                  <th scope="col" className="hidden text-right xl:table-cell">
                    <Hint text="Procenat menadzera koji ga vec ima u timu.">Vlas.</Hint>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => (
                    <tr key={p.id}>
                      <td className="text-center font-mono text-[11px] tabular-nums text-ink-4">
                        {i + 1}
                      </td>
                      <td>
                        <PlayerIdentity player={p} teams={teams} size="sm" showJersey />
                      </td>
                      {showMatchup && (
                        <td className="hidden lg:table-cell">
                          <MatchupPill
                            opponent={p.opponent_code}
                            isHome={p.is_home}
                            score={p.matchup_score}
                            teams={teams}
                            size="sm"
                            showWord={false}
                          />
                        </td>
                      )}
                      <td className="hidden md:table-cell">
                        <div className="flex items-center justify-end gap-2.5">
                          <FormBars values={p.form} height={18} />
                          <span className="statmono w-9 text-right text-[12.5px] text-ink-2">
                            {num(p.season_avg ?? null)}
                          </span>
                        </div>
                      </td>
                      <td className="num text-ink-2">{num(p.price)}</td>
                      <td className="num font-bold text-ink">{num(p.projected)}</td>
                      <td className="num">
                        <span className={`font-bold ${valueClass(p.value_score)}`}>
                          {num(p.value_score)}
                        </span>
                        <Meter value={p.value_score} max={10} className="mt-1.5 w-12 md:w-16" />
                      </td>
                      <td className="hidden xl:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <span className="statmono text-[12.5px] text-ink-3">
                            {num(p.ownership ?? null, 0)}%
                          </span>
                          {p.price_trend != null && <Delta value={p.price_trend} />}
                        </div>
                      </td>
                    </tr>
                ))}

                {/* Zakljucani redovi — samo mesta, bez ijednog podatka. */}
                {hidden > 0 &&
                  Array.from({ length: Math.min(hidden, 3) }).map((_, i) => (
                    <LockedRow
                      key={`lock-${i}`}
                      index={players.length + i}
                      showMatchup={showMatchup}
                    />
                  ))}
              </tbody>
            </table>
          </div>

          {hidden > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-sunken px-4 py-4">
              <p className="text-small text-ink-3">
                Jos <b className="statmono text-ink">{hidden}</b> igraca sa cenom, projekcijom i
                ocenom vrednosti.
              </p>
              <Link href="/profil#paketi" className="btn-primary btn-sm">
                Otkljucaj {need ?? 'PRO'}
              </Link>
            </div>
          )}
        </div>
      )}

      {tier && (
        <p className="mt-3 text-[11.5px] text-ink-4">
          Tvoj paket: <b className="text-ink-3">{tier}</b> · vrednost je koliko igrac ide plus od
          svoje cene — 5 je tacno po ceni, vise je dobitak.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LockedRow({ index, showMatchup }: { index: number; showMatchup: boolean }) {
  return (
    <tr className="select-none" aria-label="Zakljucan red">
      <td className="text-center font-mono text-[11px] tabular-nums text-ink-4">{index + 1}</td>
      <td>
        <div className="flex items-center gap-3">
          <span
            className="hatch h-9 w-9 shrink-0 rounded-full border border-line bg-elev"
            aria-hidden
          />
          <div>
            <span className="block h-3 w-24 rounded-xs bg-line" aria-hidden />
            <span className="mt-1.5 block text-[11px] text-ink-4">Dostupno uz paket</span>
          </div>
        </div>
      </td>
      {showMatchup && (
        <td className="hidden lg:table-cell">
          <span className="block h-3 w-20 rounded-xs bg-line" aria-hidden />
        </td>
      )}
      <td className="hidden md:table-cell">
        <span className="ml-auto block h-3 w-14 rounded-xs bg-line" aria-hidden />
      </td>
      <td>
        <span className="ml-auto block h-3 w-8 rounded-xs bg-line" aria-hidden />
      </td>
      <td>
        <span className="ml-auto block h-3 w-8 rounded-xs bg-line" aria-hidden />
      </td>
      <td>
        <span className="ml-auto block h-3 w-8 rounded-xs bg-line" aria-hidden />
      </td>
      <td className="hidden xl:table-cell">
        <span className="ml-auto block h-3 w-10 rounded-xs bg-line" aria-hidden />
      </td>
    </tr>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4"
      fill="none"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
