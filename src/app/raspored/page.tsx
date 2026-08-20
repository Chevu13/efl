import { getCurrentRound, getFixtures, getTeams } from '@/lib/data';
import FixtureCard from '@/components/FixtureCard';

export const revalidate = 60;

const MESECI = ['januar','februar','mart','april','maj','jun','jul','avgust','septembar','oktobar','novembar','decembar'];
const DANI = ['NEDELJA','PONEDELJAK','UTORAK','SREDA','ČETVRTAK','PETAK','SUBOTA'];

export default async function Raspored() {
  const [round, teams] = await Promise.all([getCurrentRound(), getTeams()]);
  const fixtures = round ? await getFixtures(round.id) : [];

  const byDay = fixtures.reduce<Record<string, typeof fixtures>>((acc, f) => {
    (acc[f.tip_off?.slice(0, 10) ?? ''] ||= []).push(f);
    return acc;
  }, {});

  return (
    <>
      <p className="eyebrow">Raspored</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
        {round ? `${round.number}. kolo` : 'Raspored'}
      </h1>

      {Object.keys(byDay).sort().map((day) => {
        const d = day ? new Date(day + 'T12:00:00') : null;
        return (
          <section key={day}>
            <div className="mt-8 flex items-center gap-3">
              <span className="font-display text-[15px] font-bold">
                {d ? `${d.getDate()}. ${MESECI[d.getMonth()]}` : ''}
              </span>
              <span className="label">{d ? DANI[d.getDay()] : ''}</span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] text-muted">{byDay[day].length} utakmica</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {byDay[day].map((f) => <FixtureCard key={f.id} f={f} teams={teams} />)}
            </div>
          </section>
        );
      })}

      {!fixtures.length && (
        <p className="card mt-8 p-10 text-center text-muted">Nema zakazanih utakmica.</p>
      )}
    </>
  );
}
