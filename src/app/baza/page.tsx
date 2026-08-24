import type { Metadata } from 'next';
import PlayerTable from '@/components/player/PlayerTable';
import TeamRoster from '@/components/player/TeamRoster';
import { SectionHead, EmptyState, Chip } from '@/components/ui/primitives';
import { StatStrip } from '@/components/ui/Stat';
import { getAllPlayers, getCurrentRound, getMyTier, getPricedPlayers, getTeams } from '@/lib/data';
import { NEXT_TIER } from '@/lib/config';
import { isPremium } from '@/lib/types';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Baza igraca',
  description:
    'Svi igraci EuroLeague sezone: pozicija, tim, cena kola, projekcija, forma i vrednost.'
};

/**
 * Baza igraca.
 *
 * Dva pogleda na isto: analiticka tabela sa cenom kola, i pregled po
 * timovima za one koji traze konkretan sastav. Tabela je gore jer je to
 * ono zbog cega se dolazi.
 */
export default async function Baza() {
  const [players, teams, round, { tier }] = await Promise.all([
    getAllPlayers(),
    getTeams(),
    getCurrentRound(),
    getMyTier()
  ]);

  const priced = round ? await getPricedPlayers(round.id) : [];
  const premium = isPremium(tier);
  const visible = premium ? priced : priced.slice(0, 15);

  const byTeam = players.reduce<Record<string, typeof players>>((acc, p) => {
    (acc[p.team_code ?? '—'] ||= []).push(p);
    return acc;
  }, {});

  const teamCodes = Object.keys(byTeam).sort((a, b) =>
    (teams[a]?.name_sr ?? a).localeCompare(teams[b]?.name_sr ?? b, 'sr')
  );

  return (
    <div className="page py-10">
      <SectionHead
        as="h1"
        eyebrow="Baza"
        title="Svi igraci lige"
        desc="Cela liga na jednom mestu. Tabela nosi cenu i projekciju za tekuce kolo; pregled po timovima daje kompletan sastav."
        action={<Chip tone={premium ? 'brand' : 'default'}>{tier}</Chip>}
      />

      <StatStrip
        className="mt-7"
        items={[
          { label: 'Igraca', value: String(players.length) },
          { label: 'Timova', value: String(teamCodes.length) },
          {
            label: 'Sa cenom kola',
            value: String(priced.length),
            hint: 'Igraci za koje je uneta cena i projekcija u tekucem kolu.'
          },
          { label: 'Kolo', value: round ? String(round.number) : '—' }
        ]}
      />

      {/* ---------------- analiticka tabela ---------------- */}
      {priced.length > 0 && (
        <section className="mt-12">
          <SectionHead
            eyebrow="Analiza kola"
            title="Cena, projekcija i vrednost"
            desc="Filtriraj po poziciji i timu, sortiraj po onome sto ti je bitno."
          />
          <div className="mt-6">
            <PlayerTable
              players={visible}
              totalCount={priced.length}
              teams={teams}
              tier={tier}
              need={NEXT_TIER[tier]}
            />
          </div>
        </section>
      )}

      {/* ---------------- sastavi ---------------- */}
      <section className="mt-14">
        <SectionHead
          eyebrow="Sastavi"
          title="Po timovima"
          desc="Ko je sve u ligi, bez brojeva — koristi se kad proveravas rotaciju ili trazis igraca po imenu."
        />

        {teamCodes.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Baza je prazna"
              desc="Dodaj igrace u tabelu players i grbove u tabelu teams."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {teamCodes.map((code) => (
              <TeamRoster
                key={code}
                team={teams[code]}
                code={code}
                players={byTeam[code]}
                teams={teams}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
