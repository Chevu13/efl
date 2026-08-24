'use client';

import { useState } from 'react';
import LineupBuilder from './team/LineupBuilder';
import ChallengeBoard from './game/ChallengeBoard';
import Segmented from './ui/Segmented';
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
type Tab = 'tim' | 'izazov';

/**
 * Radni sto kola.
 *
 * Dve stvari koje korisnik radi pred kolo stoje jedna do druge:
 * sastavlja postavu i popunjava listic izazova. Postava je primarna —
 * otvara se prva — ali izazov nije sklonjen, jer je to igra koja vraca
 * ljude svake nedelje.
 */
export default function GameBoard({
  round,
  lines,
  fixtures,
  teams,
  board,
  pool,
  loggedIn,
  canOptimize
}: {
  round: Round;
  lines: Line[];
  fixtures: Fixture[];
  teams: Record<string, Team>;
  board: LeaderboardRow[];
  pool: PricedPlayer[];
  loggedIn: boolean;
  canOptimize: boolean;
}) {
  const [tab, setTab] = useState<Tab>('tim');

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          label="Deo kola"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tim', label: 'Moj tim' },
            { value: 'izazov', label: 'Izazov kola', count: lines.length + fixtures.length }
          ]}
        />
        <p className="text-[12.5px] text-ink-3">
          {tab === 'tim'
            ? 'Sastavi postavu u okviru budzeta, pa je posalji optimizatoru.'
            : 'Pogodi granice i pobednike — devet od deset tacnih donosi PRO.'}
        </p>
      </div>

      {tab === 'tim' ? (
        <LineupBuilder
          roundId={round.id}
          pool={pool}
          teams={teams}
          canOptimize={canOptimize}
        />
      ) : (
        <ChallengeBoard
          round={round}
          lines={lines}
          fixtures={fixtures}
          teams={teams}
          board={board}
          loggedIn={loggedIn}
        />
      )}
    </div>
  );
}
