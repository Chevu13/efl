import Link from 'next/link';
import { getCurrentRound, getFixtures, getPricedPlayers, getTeams, getMyTier } from '@/lib/data';
import PlayerCard from '@/components/PlayerCard';
import { num } from '@/lib/format';

export const revalidate = 60;

export default async function Home() {
  const [round, teams, { tier }] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);
  const [players, fixtures] = round
    ? await Promise.all([getPricedPlayers(round.id), getFixtures(round.id)])
    : [[], []];

  const free = players.find((p) => p.tier_pick === 'FREE') ?? players[0];
  const best = players[0];

  return (
    <>
      <section className="tgrid relative -mx-4 overflow-hidden px-4 py-14">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none"
             viewBox="0 0 1200 420" aria-hidden>
          <path d="M-40 330 C 240 300, 330 150, 570 170 S 910 280, 1240 100"
                fill="none" stroke="#2DB4FF" strokeWidth="1.4" opacity=".25" />
          <circle cx="570" cy="170" r="4" fill="#FF5E1A" opacity=".8" />
        </svg>

        <div className="relative max-w-2xl animate-rise">
          <p className="eyebrow">
            EuroLeague Fantasy {round ? `· ${round.number}. kolo` : ''}
          </p>
          <h1 className="mt-5 font-display text-[clamp(34px,6vw,58px)] font-bold leading-[1.05] tracking-tight">
            Prestani da nagađaš.
            <span className="block text-brand">Počni da računaš.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            Poredimo cenu svakog igrača sa projektovanim brojem fantasy poena i težinom protivnika —
            i pokazujemo ti ko se stvarno isplati u ovom kolu.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/igraci" className="btn-primary">Analiziraj kolo</Link>
            <Link href="/igra" className="btn-ghost">Igraj kolo</Link>
          </div>
        </div>
      </section>

      {round && (
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line
                            bg-line md:grid-cols-4">
          {[
            ['Kolo', String(round.number)],
            ['Utakmica', String(fixtures.length)],
            ['Igrača sa cenom', String(players.length)],
            ['Najbolja vrednost', best ? num(best.value_score) : '—']
          ].map(([l, v]) => (
            <div key={l} className="bg-surface p-4">
              <div className="text-[11px] text-muted">{l}</div>
              <div className="stat mt-1.5 text-xl">{v}</div>
            </div>
          ))}
        </section>
      )}

      {free && (
        <section className="mt-14">
          <p className="eyebrow">Besplatno · svako kolo</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Izbor kola</h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Jedan igrač, jasno objašnjen. Isti brojevi koji stoje iza svake plaćene preporuke.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-[380px_1fr] md:items-start">
            <PlayerCard p={free} teams={teams} why={false} />
            <div className="card p-5">
              <h3 className="font-display text-lg font-bold">Zašto baš on</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
                {free.why_sr ?? 'Objašnjenje još nije upisano za ovo kolo.'}
              </p>
              {tier === 'FREE' && (
                <Link href="/igraci" className="btn-primary mt-6">Vidi sve izbore kola</Link>
              )}
            </div>
          </div>
        </section>
      )}

      {!round && (
        <p className="card mt-10 p-10 text-center text-muted">
          Nema unetih kola. Dodaj kolo u Supabase, tabela <code className="font-mono">rounds</code>.
        </p>
      )}
    </>
  );
}
