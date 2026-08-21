import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyTier, getTeams } from '@/lib/data';
import PlayerPhoto from '@/components/PlayerPhoto';
import TeamCrest from '@/components/TeamCrest';
import Paketi from '@/components/Paketi';

export const dynamic = 'force-dynamic';

type Presek = { tacno: number; ukupno: number };
const pct = (p: Presek) => (p.ukupno ? Math.round((p.tacno / p.ukupno) * 100) : null);

export default async function Profil({ searchParams }: { searchParams: { period?: string } }) {
  const { email, tier, userId } = await getMyTier();
  if (!userId) redirect('/prijava');

  const sb = createClient();
  const teams = await getTeams();
  const period = searchParams.period ?? 'sezona';

  const { data: prognoze } = await sb
    .from('entries')
    .select(`
      id, round_id, submitted_at, correct, total, accuracy,
      rounds ( number, season ),
      picks (
        id, kind, answer, is_correct,
        challenge_lines ( line, result, players ( id, short_name, photo, jersey, team_code, position ) ),
        fixtures ( home_code, away_code, home_score, away_score )
      )
    `)
    .eq('user_id', userId)
    .order('round_id', { ascending: false });

  const sve = (prognoze ?? []) as any[];

  const sad = new Date();
  const uPeriodu = sve.filter((e) => {
    if (period === 'sezona') return true;
    if (period === 'kolo') return e.round_id === sve[0]?.round_id;
    const d = new Date(e.submitted_at);
    return d.getMonth() === sad.getMonth() && d.getFullYear() === sad.getFullYear();
  });

  const zbir = (kind?: string): Presek =>
    uPeriodu.reduce(
      (a, e) => {
        const p = (e.picks ?? []).filter((x: any) => (kind ? x.kind === kind : true));
        return {
          tacno: a.tacno + p.filter((x: any) => x.is_correct === true).length,
          ukupno: a.ukupno + p.filter((x: any) => x.is_correct !== null).length
        };
      },
      { tacno: 0, ukupno: 0 }
    );

  const ukupno = zbir();
  const igraci = zbir('player');
  const meceva = zbir('fixture');

  let niz = 0, najduzi = 0;
  for (const e of sve) {
    const n = (e.picks ?? []).filter((p: any) => p.kind === 'player' && p.is_correct).length;
    if (n >= 9) { niz++; najduzi = Math.max(najduzi, niz); } else niz = 0;
  }

  const PERIODI = [['kolo', 'KOLO'], ['mesec', 'MESEC'], ['sezona', 'SEZONA']] as const;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Profil</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">{email}</h1>
        </div>
        <span className={`chip ${tier === 'FREE' ? 'bg-elev text-muted' : 'bg-brand/15 text-brand'}`}>
          {tier}
        </span>
      </div>

      <div className="mt-6 flex gap-1.5">
        {PERIODI.map(([k, l]) => (
          <Link key={k} href={`/profil?period=${k}`}
                className={`rounded-md border px-3.5 py-2 font-mono text-[11px] tracking-[0.14em] transition-colors
                  ${period === k ? 'border-white/20 bg-surface text-ink' : 'border-line text-muted hover:text-ink'}`}>
            {l}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4">
        {[
          ['TAČNOST', pct(ukupno) != null ? `${pct(ukupno)}%` : '—', 'text-brand'],
          ['IGRAČI', `${igraci.tacno}/${igraci.ukupno}`, ''],
          ['UTAKMICE', `${meceva.tacno}/${meceva.ukupno}`, ''],
          ['ODIGRANO KOLA', String(uPeriodu.length), '']
        ].map(([l, v, c]) => (
          <div key={l} className="bg-surface p-4">
            <div className="label">{l}</div>
            <div className={`stat mt-2 text-2xl ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {najduzi > 0 && (
        <p className="mt-3 font-mono text-[11.5px] text-muted">
          NAJDUŽI NIZ SA 9+ POGODAKA: <b className="text-ok">{najduzi}</b> {najduzi === 1 ? 'kolo' : 'kola'}
        </p>
      )}

      <h2 className="mt-12 font-display text-2xl font-bold tracking-tight">Kolo po kolo</h2>

      {!sve.length && (
        <div className="card mt-4 p-10 text-center">
          <p className="text-muted">Još nisi poslao nijednu prognozu.</p>
          <Link href="/igra" className="btn-primary mt-5">Igraj ovo kolo</Link>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {sve.map((e) => {
          const pi = (e.picks ?? []).filter((p: any) => p.kind === 'player');
          const pm = (e.picks ?? []).filter((p: any) => p.kind === 'fixture');
          const tacnoI = pi.filter((p: any) => p.is_correct).length;
          const tacnoM = pm.filter((p: any) => p.is_correct).length;

          return (
            <details key={e.id} className="card group overflow-hidden">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4 hover:bg-elev">
                <span className="stat w-16 text-lg">
                  {e.rounds?.number ?? e.round_id}.
                  <span className="ml-0.5 text-[10px] font-normal text-muted">KOLO</span>
                </span>
                <span className="font-mono text-[12px] text-muted">
                  igrači <b className="text-ink">{tacnoI}/{pi.length}</b>
                  <span className="mx-2 text-line">·</span>
                  utakmice <b className="text-ink">{tacnoM}/{pm.length}</b>
                </span>
                {tacnoI >= 9 && <span className="chip bg-ok/15 text-ok">PRO NAGRADA</span>}
                <span className="ml-auto flex items-center gap-3">
                  {e.total != null ? (
                    <span className={`stat text-lg ${e.accuracy >= 70 ? 'text-ok' : 'text-ink'}`}>
                      {Math.round(e.accuracy)}%
                    </span>
                  ) : (
                    <span className="chip bg-elev text-muted">ČEKA REZULTATE</span>
                  )}
                  <span className="text-muted transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>

              <div className="border-t border-line">
                {pi.map((p: any) => {
                  const ig = p.challenge_lines?.players;
                  if (!ig) return null;
                  return (
                    <div key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                      <PlayerPhoto player={ig} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{ig.short_name}</span>
                      <span className="hidden font-mono text-[11px] text-muted sm:inline">
                        granica {Number(p.challenge_lines.line).toFixed(1)}
                      </span>
                      <span className={`chip ${p.answer === 'over' ? 'bg-brand/15 text-brand' : 'bg-data/15 text-data'}`}>
                        {p.answer === 'over' ? 'IZNAD' : 'ISPOD'}
                      </span>
                      <Ishod v={p.is_correct} />
                    </div>
                  );
                })}

                {pm.map((p: any) => {
                  const f = p.fixtures;
                  if (!f) return null;
                  const moj = p.answer === 'home' ? f.home_code : f.away_code;
                  return (
                    <div key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                      <TeamCrest team={teams[moj]} code={moj} s="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">
                        {teams[f.home_code]?.name_sr ?? f.home_code}
                        <span className="mx-1.5 text-muted">—</span>
                        {teams[f.away_code]?.name_sr ?? f.away_code}
                      </span>
                      {f.home_score != null && (
                        <span className="stat text-[12px] text-muted">{f.home_score}:{f.away_score}</span>
                      )}
                      <Ishod v={p.is_correct} />
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      <div id="paketi" className="scroll-mt-20">
        <Paketi trenutni={tier} userId={userId} />
      </div>
    </>
  );
}

function Ishod({ v }: { v: boolean | null }) {
  if (v === null) return <span className="w-5 text-center font-mono text-[11px] text-muted">·</span>;
  return (
    <span className={`w-5 text-center font-mono text-sm ${v ? 'text-ok' : 'text-bad'}`}>
      {v ? '✓' : '✕'}
    </span>
  );
}
