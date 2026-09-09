import type { Metadata } from 'next';
import RoundSchedule from '@/components/game/RoundSchedule';
import { SectionHead, EmptyState, Chip } from '@/components/ui/primitives';
import { StatStrip } from '@/components/ui/Stat';
import {
  getChallengeLines,
  getCurrentRound,
  getFixtures,
  getLeaderboard,
  getMyTier,
  getPricedPlayers,
  getTeams
} from '@/lib/data';
import { num, untilLabel } from '@/lib/format';

export const revalidate = 30;

export const metadata: Metadata = {
  alternates: { canonical: '/raspored' },
  title: 'Raspored i izazov kola',
  description:
    'Mecevi tekuceg kola EuroLeague sa procenom sanse za pobedu, fantasy prilikama i glasanjem za izazov kola.'
};

/**
 * Raspored kola.
 *
 * Mecevi su redovi u tabeli, ne kartice dogadjaja: dan po dan, sa procenom
 * snaga i sa tri fantasy prilike iz svakog meca. Glasanje za izazov kola
 * stoji u istom redu — mec koji gledas je mec na koji glasas, pa nema
 * razloga da to budu dva ekrana.
 */
export default async function Raspored() {
  const [round, teams, me] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);

  if (!round) {
    return (
      <div className="page py-10">
        <SectionHead as="h1" eyebrow="Raspored" title="Raspored" />
        <div className="mt-8">
          <EmptyState
            title="Nema aktivnog kola"
            desc="Dodaj kolo u tabelu rounds, pa mecevi u tabelu fixtures."
          />
        </div>
      </div>
    );
  }

  const [fixtures, players, lines, board] = await Promise.all([
    getFixtures(round.id),
    getPricedPlayers(round.id),
    getChallengeLines(round.id),
    getLeaderboard()
  ]);

  const days = new Set(fixtures.map((f) => f.tip_off?.slice(0, 10) ?? '—'));
  const avgEdge = fixtures.length
    ? fixtures.reduce((s, f) => s + Math.abs((f.home_edge ?? 50) - 50), 0) / fixtures.length
    : 0;

  return (
    <div className="page py-10">
      <SectionHead
        as="h1"
        eyebrow={`${round.season} · ${round.number}. kolo`}
        title="Raspored i izazov"
        desc="Procena sanse za pobedu izvedena je iz forme, kvaliteta rotacije i prednosti domaceg terena. Uz svaki mec mozes odmah da glasas ko pobedjuje."
        action={
          <div className="flex items-center gap-2">
            {round.deadline && <Chip>Jos {untilLabel(round.deadline)}</Chip>}
            <Chip tone={round.status === 'open' ? 'brand' : 'default'}>
              {round.status === 'open' ? 'Otvoreno' : 'Zakljucano'}
            </Chip>
          </div>
        }
      />

      {fixtures.length > 0 && (
        <StatStrip
          className="mt-7"
          items={[
            { label: 'Utakmica', value: String(fixtures.length) },
            { label: 'Dana igranja', value: String(days.size) },
            {
              label: 'Prosecna razlika',
              value: num(avgEdge, 0),
              unit: '%',
              hint: 'Koliko je prosecno izrazen favorit u ovom kolu. Vise znaci predvidljivije kolo.'
            },
            {
              label: 'Izjednacenih',
              value: String(fixtures.filter((f) => Math.abs((f.home_edge ?? 50) - 50) < 8).length),
              hint: 'Mecevi u kojima nijedan tim nema jasnu prednost.'
            }
          ]}
        />
      )}

      <div className="mt-10">
        {fixtures.length === 0 ? (
          <EmptyState
            title="Nema zakazanih utakmica"
            desc="Dodaj meceve u tabelu fixtures za tekuce kolo, sa terminom i kodovima timova."
          />
        ) : (
          <RoundSchedule
            round={round}
            fixtures={fixtures}
            lines={lines}
            players={players}
            teams={teams}
            board={board}
            loggedIn={!!me.userId}
          />
        )}
      </div>
    </div>
  );
}
