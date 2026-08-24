import type { Metadata } from 'next';
import FixtureRow from '@/components/fixtures/FixtureRow';
import { SectionHead, EmptyState, Chip, RowDivider } from '@/components/ui/primitives';
import { StatStrip } from '@/components/ui/Stat';
import { getCurrentRound, getFixtures, getPricedPlayers, getTeams } from '@/lib/data';
import { dayLabel, num, untilLabel } from '@/lib/format';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Raspored kola',
  description:
    'Mecevi tekuceg kola EuroLeague sa procenom sanse za pobedu i najboljim fantasy prilikama.'
};

/**
 * Raspored kola.
 *
 * Mecevi su redovi u tabeli, ne kartice dogadjaja: dan po dan, sa
 * procenom snaga i sa tri fantasy prilike iz svakog meca. Cilj je da se
 * kolo procita odozgo nadole za trideset sekundi.
 */
export default async function Raspored() {
  const [round, teams] = await Promise.all([getCurrentRound(), getTeams()]);
  const [fixtures, players] = round
    ? await Promise.all([getFixtures(round.id), getPricedPlayers(round.id)])
    : [[], []];

  const byDay = fixtures.reduce<Record<string, typeof fixtures>>((acc, f) => {
    (acc[f.tip_off?.slice(0, 10) ?? 'bez-termina'] ||= []).push(f);
    return acc;
  }, {});

  const days = Object.keys(byDay).sort();

  /* Najbolja fantasy prilika po meču — po projekciji, ne po imenu. */
  const bestFor = (home: string, away: string) =>
    players
      .filter((p) => p.team_code === home || p.team_code === away)
      .sort((a, b) => (b.projected ?? 0) - (a.projected ?? 0))
      .slice(0, 3);

  const avgEdge = fixtures.length
    ? fixtures.reduce((s, f) => s + Math.abs((f.home_edge ?? 50) - 50), 0) / fixtures.length
    : 0;

  return (
    <div className="page py-10">
      <SectionHead
        as="h1"
        eyebrow={round ? `${round.season} · ${round.number}. kolo` : 'Raspored'}
        title={round ? `${round.number}. kolo` : 'Raspored'}
        desc="Procena sanse za pobedu izvedena je iz forme, kvaliteta rotacije i prednosti domaceg terena. Sluzi kao kontekst za izbor igraca, ne kao savet za kladjenje."
        action={round?.deadline ? <Chip>Jos {untilLabel(round.deadline)}</Chip> : undefined}
      />

      {fixtures.length > 0 && (
        <StatStrip
          className="mt-7"
          items={[
            { label: 'Utakmica', value: String(fixtures.length) },
            { label: 'Dana igranja', value: String(days.length) },
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

      {days.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nema zakazanih utakmica"
            desc="Dodaj mecevi u tabelu fixtures za tekuce kolo, sa terminom i kodovima timova."
          />
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {days.map((day) => {
            const label = day === 'bez-termina' ? null : dayLabel(`${day}T12:00:00`);
            return (
              <section key={day}>
                <RowDivider
                  title={label ? label.date : 'Termin nije zakazan'}
                  meta={
                    label
                      ? `${label.weekday} · ${byDay[day].length} utakmica`
                      : `${byDay[day].length} utakmica`
                  }
                />
                <div className="mt-4 overflow-hidden rounded-md border border-line bg-surface">
                  {byDay[day].map((f) => (
                    <FixtureRow
                      key={f.id}
                      f={f}
                      teams={teams}
                      topPlayers={bestFor(f.home_code, f.away_code)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
