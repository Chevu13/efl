import { getAllPlayers, getTeams } from '@/lib/data';
import PlayerPhoto from '@/components/PlayerPhoto';

export const revalidate = 3600;

export default async function Baza() {
  const [players, teams] = await Promise.all([getAllPlayers(), getTeams()]);
  const byTeam = players.reduce<Record<string, typeof players>>((acc, p) => {
    (acc[p.team_code ?? '—'] ||= []).push(p);
    return acc;
  }, {});

  return (
    <>
      <p className="eyebrow">Baza</p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Svi igrači lige</h1>
      <p className="mt-3 text-[13px] text-muted">
        <b className="font-mono text-ink">{players.length}</b> igrača · {Object.keys(byTeam).length} timova
      </p>

      {Object.keys(byTeam).sort().map((code) => (
        <section key={code}>
          <div className="mt-8 flex items-center gap-3">
            <span className="font-display text-[15px] font-bold">{teams[code]?.name_sr ?? code}</span>
            <span className="label">{code}</span>
            <span className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] text-muted">{byTeam[code].length}</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byTeam[code].map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                <PlayerPhoto player={p} size="md" />
                <div className="min-w-0">
                  <div className="truncate font-display text-[13.5px] font-bold uppercase">{p.short_name}</div>
                  <div className="label mt-1">{p.jersey != null && `#${p.jersey} · `}{p.position}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
