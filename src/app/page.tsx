import Link from 'next/link';
import { PlayerCutout } from '@/components/PlayerPhoto';
import PlayerIdentity from '@/components/player/PlayerIdentity';
import MatchupPill from '@/components/player/MatchupPill';
import FixtureRow from '@/components/fixtures/FixtureRow';
import CourtBackdrop from '@/components/ui/CourtBackdrop';
import { Chip, Meter, RowDivider, SectionHead } from '@/components/ui/primitives';
import { Delta, FormBars } from '@/components/ui/Stat';
import { LinkButton } from '@/components/ui/Button';
import { getCurrentRound, getFixtures, getMyTier, getPricedPlayers, getTeams } from '@/lib/data';
import { mecevi, num, signed, teamName, untilLabel, valueClass } from '@/lib/format';
import { PLANS, priceLabel } from '@/lib/config';
import { isPremium } from '@/lib/types';

export const revalidate = 60;

export default async function Home() {
  const [round, teams, me] = await Promise.all([getCurrentRound(), getTeams(), getMyTier()]);
  const [players, fixtures] = round
    ? await Promise.all([getPricedPlayers(round.id), getFixtures(round.id)])
    : [[], []];

  const free = players.find((p) => p.tier_pick === 'FREE') ?? players[0];
  /* Za naslovnu kompoziciju treba igrac koji stvarno ima fotografiju. */
  const hero = players.find((p) => p.photo) ?? free;
  const top = players.slice(0, 6);
  const premium = isPremium(me.tier);

  return (
    <>
      {/* ================= NASLOVNA ================= */}
      <section className="relative overflow-hidden border-b border-line bg-sunken">
        <CourtBackdrop variant="arc" opacity={0.09} />
        <div className="datagrid pointer-events-none absolute inset-0 opacity-70" aria-hidden />

        <div className="page relative grid gap-10 py-14 lg:grid-cols-[1fr_400px] lg:items-center lg:py-20">
          <div className="max-w-2xl animate-rise">
            <p className="eyebrow">
              EuroLeague Fantasy{round ? ` · ${round.number}. kolo` : ''}
              {round?.deadline && untilLabel(round.deadline) !== 'zakljucano' && (
                <span className="text-ink-4"> · jos {untilLabel(round.deadline)}</span>
              )}
            </p>

            <h1 className="mt-5 text-[clamp(40px,8vw,80px)] uppercase leading-[0.92]">
              Prestani da nagadjas.
              <span className="mt-1 block text-brand">Pocni da racunas.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lead leading-relaxed text-ink-2">
              Za svakog igraca poredimo cenu sa projektovanim brojem fantasy poena,
              formom i tezinom protivnika — i pokazujemo ko se u ovom kolu stvarno
              isplati.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/igra" size="lg">
                Sastavi postavu
              </LinkButton>
              <LinkButton href="/baza" variant="ghost" size="lg">
                Otvori bazu igraca
              </LinkButton>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ['Igraca sa cenom', String(players.length)],
                ['Meceva u kolu', String(fixtures.length)],
                ['Timova', String(Object.keys(teams).length)]
              ].map(([l, v]) => (
                <div key={l}>
                  <dt className="label">{l}</dt>
                  <dd className="stat mt-1.5 text-[26px]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* zivi izlog proizvoda — ne ukrasna slika */}
          {hero && (
            <aside className="relative animate-rise" style={{ animationDelay: '90ms' }}>
              <div className="relative overflow-hidden rounded-md border border-line bg-surface">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="label">Izbor kola</span>
                  <Chip tone="brand">Besplatno</Chip>
                </div>

                <div className="relative h-52 bg-gradient-to-b from-elev to-surface">
                  <PlayerCutout player={hero} className="absolute inset-0" priority />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface to-transparent" />
                </div>

                <div className="relative px-4 pb-4">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[24px] uppercase leading-none">
                        {hero.short_name}
                      </h2>
                      <p className="mt-1.5 text-[12px] text-ink-3">
                        {hero.position === 'G' ? 'Bek' : hero.position === 'F' ? 'Krilo' : 'Centar'} ·{' '}
                        {teamName(teams, hero.team_code)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="label">Projekcija</div>
                      <div className="stat text-[34px] leading-none text-brand">
                        {num(hero.projected)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-line bg-line">
                    <div className="bg-sunken px-3 py-2.5">
                      <div className="label">Cena</div>
                      <div className="statmono mt-1 text-[15px]">{num(hero.price)}</div>
                    </div>
                    <div className="bg-sunken px-3 py-2.5">
                      <div className="label">Vrednost</div>
                      <div className={`statmono mt-1 text-[15px] ${valueClass(hero.value_score)}`}>
                        {num(hero.value_score)}
                      </div>
                    </div>
                    <div className="bg-sunken px-3 py-2.5">
                      <div className="label">Forma</div>
                      <div className="mt-1">
                        <FormBars values={hero.form} height={16} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <MatchupPill
                      opponent={hero.opponent_code}
                      isHome={hero.is_home}
                      score={hero.matchup_score}
                      teams={teams}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* ================= VREDNOST KOLA ================= */}
      {top.length > 0 && (
        <section className="page py-14">
          <SectionHead
            eyebrow="Rang liste kola"
            title="Ko vredi svoju cenu"
            desc="Vrednost je odstupanje od cene: 5 znaci da igrac tacno opravdava svoju cenu, sve iznad je dobitak. Tu se dobijaju kola."
            action={
              <LinkButton href="/igraci" variant="ghost" size="sm">
                Svi izbori kola
              </LinkButton>
            }
          />

          <div className="mt-7 overflow-hidden rounded-md border border-line">
            <div className="hidden grid-cols-[40px_1fr_150px_90px_90px_120px] gap-4 border-b border-line bg-surface px-4 py-2.5 lg:grid">
              {['#', 'Igrac', 'Protivnik', 'Cena', 'Proj.', 'Vrednost'].map((h, i) => (
                <span key={h} className={`label ${i > 2 ? 'text-right' : ''}`}>
                  {h}
                </span>
              ))}
            </div>

            {top.map((p, i) => (
              <div
                key={p.id}
                className="grid grid-cols-[28px_1fr_auto] items-center gap-4 border-b border-line
                           px-4 py-3 transition-colors duration-fast last:border-0 hover:bg-elev
                           lg:grid-cols-[40px_1fr_150px_90px_90px_120px]"
              >
                <span className="font-mono text-[12px] font-bold tabular-nums text-brand">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <PlayerIdentity player={p} teams={teams} size="sm" />

                <div className="hidden lg:block">
                  <MatchupPill
                    opponent={p.opponent_code}
                    isHome={p.is_home}
                    score={p.matchup_score}
                    teams={teams}
                    size="sm"
                    showWord={false}
                  />
                </div>

                <span className="statmono hidden text-right text-[13.5px] text-ink-2 lg:block">
                  {num(p.price)}
                </span>
                <span className="statmono hidden text-right text-[13.5px] lg:block">
                  {num(p.projected)}
                </span>

                <div className="text-right">
                  <span className={`statmono text-[15px] font-bold ${valueClass(p.value_score)}`}>
                    {num(p.value_score)}
                  </span>
                  <Meter value={p.value_score} max={10} className="ml-auto mt-1.5 w-14 lg:w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ================= ZASTO BAS ON ================= */}
      {free?.why_sr && (
        <section className="border-y border-line bg-sunken">
          <div className="page grid gap-8 py-14 md:grid-cols-[300px_1fr] md:items-center">
            <div className="relative h-64 overflow-hidden rounded-md border border-line bg-gradient-to-b from-elev to-surface">
              <PlayerCutout player={free} className="absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface to-transparent px-4 pb-3 pt-10">
                <p className="font-display text-[20px] font-extrabold uppercase leading-none">
                  {free.short_name}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-3">{teamName(teams, free.team_code)}</p>
              </div>
            </div>

            <div>
              <p className="eyebrow">Analiza · besplatno svako kolo</p>
              <h2 className="mt-4 text-[clamp(24px,4vw,36px)] uppercase leading-tight">
                Zasto bas on ovog kola
              </h2>
              <p className="mt-4 max-w-prose text-lead leading-relaxed text-ink-2">{free.why_sr}</p>

              <div className="mt-6 flex flex-wrap gap-6">
                {[
                  ['Cena', num(free.price), 'kredita'],
                  ['Projekcija', num(free.projected), 'FP'],
                  ['Vrednost', num(free.value_score), '/ 10'],
                  ['Vlasnistvo', num(free.ownership ?? null, 0), '%']
                ].map(([l, v, u]) => (
                  <div key={l}>
                    <div className="label">{l}</div>
                    <div className="stat mt-1.5 text-[28px] leading-none">
                      {v}
                      <span className="ml-1 font-mono text-[10px] font-medium text-ink-3">{u}</span>
                    </div>
                  </div>
                ))}
              </div>

              <LinkButton href="/igraci" className="mt-7">
                Vidi sve izbore kola
              </LinkButton>
            </div>
          </div>
        </section>
      )}

      {/* ================= OPTIMIZATOR ================= */}
      <section className="page py-14">
        <SectionHead
          eyebrow="Premium alat"
          title="Optimizator postave"
          desc="Ubaci svoju postavu i alat trazi zamene koje donose vise poena u okviru istog budzeta. Uz svaku preporuku stoji razlog — cena, forma, protivnik, minutaza."
        />

        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="relative overflow-hidden rounded-md border border-line bg-gradient-to-b from-surface to-sunken">
            <CourtBackdrop variant="arc" opacity={0.08} />
            <div className="relative grid gap-6 p-6 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center sm:p-8">
              <div>
                <div className="label">Trenutna projekcija</div>
                <div className="stat mt-2 text-[clamp(34px,6vw,52px)] leading-none text-ink-3">142.7</div>
              </div>
              <div className="hidden text-[22px] text-brand sm:block" aria-hidden>
                →
              </div>
              <div>
                <div className="label">Posle optimizacije</div>
                <div className="stat mt-2 text-[clamp(34px,6vw,52px)] leading-none text-brand">161.4</div>
              </div>
              <div className="sm:border-l sm:border-line sm:pl-6">
                <div className="label">Poboljsanje</div>
                <div className="stat mt-2 text-[clamp(26px,4vw,36px)] leading-none text-brand">
                  {signed(18.7)}
                </div>
              </div>
            </div>

            <div className="relative border-t border-line px-6 py-4 sm:px-8">
              <p className="text-[12.5px] text-ink-3">
                Primer sa demo postavom. Tvoj rezultat zavisi od igraca koje si izabrao.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="chip">
                  <Delta value={6.4} unit="FP" /> zamena beka
                </span>
                <span className="chip">
                  <Delta value={5.1} unit="FP" /> povoljniji protivnik
                </span>
                <span className="chip">
                  <Delta value={-2.3} suffix="kr" /> oslobodjen budzet
                </span>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="text-[17px] uppercase">Sta dobijas</h3>
            <ul className="mt-4 space-y-3">
              {[
                'Zamene poredjane po dobitku poena',
                'Razlog za svaku zamenu, ne samo rezultat',
                'Postovanje budzeta i pravila sastava',
                'Racunanje na serveru — brojevi se ne mogu podesiti'
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-small text-ink-2">
                  <span className="mt-[7px] h-[3px] w-3 shrink-0 bg-brand" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <LinkButton href="/optimizator" className="mt-6" full>
              {premium ? 'Otvori optimizator' : 'Probaj optimizator'}
            </LinkButton>
            {!premium && (
              <p className="mt-3 text-center text-[11.5px] text-ink-4">
                Ukupno poboljsanje vidis besplatno · pojedinacne zamene od{' '}
                {priceLabel(PLANS[0].priceCents)}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ================= MECEVI ================= */}
      {fixtures.length > 0 && (
        <section className="border-t border-line bg-sunken">
          <div className="page py-14">
            <RowDivider title={`${round?.number ?? ''}. kolo — mecevi`} meta={mecevi(fixtures.length)} />
            <div className="mt-4 overflow-hidden rounded-md border border-line bg-surface">
              {fixtures.slice(0, 4).map((f) => (
                <FixtureRow
                  key={f.id}
                  f={f}
                  teams={teams}
                  topPlayers={players
                    .filter((p) => p.team_code === f.home_code || p.team_code === f.away_code)
                    .slice(0, 3)}
                />
              ))}
            </div>
            <div className="mt-5">
              <LinkButton href="/raspored" variant="ghost" size="sm">
                Ceo raspored kola
              </LinkButton>
            </div>
          </div>
        </section>
      )}

      {/* ================= POZIV ================= */}
      {!premium && (
        <section className="page py-16">
          <div className="relative overflow-hidden rounded-md border border-brand/40 bg-gradient-to-br from-brand/[.12] to-surface">
            <div className="hatch pointer-events-none absolute inset-0 opacity-60" aria-hidden />
            <div className="relative grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-center sm:p-10">
              <div className="max-w-xl">
                <h2 className="text-[clamp(24px,4vw,34px)] uppercase leading-tight">
                  Jedno kolo bez lose zamene vraca cenu paketa
                </h2>
                <p className="mt-4 text-body leading-relaxed text-ink-2">
                  Svi igraci kola sa cenom i projekcijom, forma i minutaza, tezina
                  protivnika po igracu i optimizator koji objasni svaku preporuku.
                </p>
              </div>
              <div className="shrink-0">
                <LinkButton href="/profil#paketi" size="lg">
                  Pogledaj pakete
                </LinkButton>
                <p className="mt-2.5 text-center text-[11.5px] text-ink-3">
                  Od {priceLabel(PLANS[0].priceCents)} · placanje preko PayPal-a
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {!round && (
        <section className="page py-20">
          <p className="panel p-10 text-center text-ink-3">
            Nema unetih kola. Dodaj kolo u Supabase, tabela{' '}
            <code className="font-mono text-ink">rounds</code>.
          </p>
        </section>
      )}
    </>
  );
}
