import type {
  ChallengeLine,
  Coach,
  Fixture,
  LeaderboardRow,
  Player,
  PricedPlayer,
  Round,
  Team
} from './types';

/**
 * DEMO PODACI.
 *
 * Aplikacija radi nad Supabase bazom. Kad baza nije popunjena — na svežoj
 * instalaciji, na pregledu dizajna, u lokalnom razvoju — svaki upit pada
 * na ovaj skup, pa nijedan ekran nikad nije prazan.
 *
 * Sastav i brojevi su izmišljeni i služe samo kao ispravno oblikovan
 * primer. Igrači EA7 i EFS nose prave fotografije iz public/slike/players,
 * pa se vidi kako izgleda gotov proizvod sa slikama.
 *
 * `isMock()` govori ostatku aplikacije da prikaže oznaku demo podataka.
 */

/* ------------------------------------------------------------------ */
/* determinističan generator — isti brojevi pri svakom renderu          */
/* ------------------------------------------------------------------ */

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ */
/* TIMOVI                                                              */
/* ------------------------------------------------------------------ */

type TeamSeed = [code: string, en: string, sr: string, country: string, strength: number];

const TEAM_SEEDS: TeamSeed[] = [
  ['ea7', 'EA7 Emporio Armani Milan', 'Armani Milano', 'IT', 74],
  ['efs', 'Anadolu Efes Istanbul', 'Anadolu Efes', 'TR', 76],
  ['rmb', 'Real Madrid', 'Real Madrid', 'ES', 88],
  ['pao', 'Panathinaikos AKTOR', 'Panatinaikos', 'GR', 87],
  ['oly', 'Olympiacos Piraeus', 'Olimpijakos', 'GR', 86],
  ['fnb', 'Fenerbahce Beko', 'Fenerbahče', 'TR', 85],
  ['bar', 'FC Barcelona', 'Barselona', 'ES', 82],
  ['mco', 'AS Monaco', 'Monako', 'FR', 84],
  ['zal', 'Zalgiris Kaunas', 'Žalgiris', 'LT', 78],
  ['par', 'Partizan Mozzart Bet', 'Partizan', 'RS', 73],
  ['czv', 'Crvena zvezda Meridianbet', 'Crvena zvezda', 'RS', 75],
  ['bas', 'Baskonia Vitoria-Gasteiz', 'Baskonija', 'ES', 71],
  ['bay', 'FC Bayern Munich', 'Bajern', 'DE', 70],
  ['vir', 'Virtus Segafredo Bologna', 'Virtus Bolonja', 'IT', 69],
  ['mta', 'Maccabi Rapyd Tel Aviv', 'Makabi', 'IL', 77],
  ['hta', 'Hapoel Shlomo Tel Aviv', 'Hapoel', 'IL', 79],
  ['asv', 'LDLC ASVEL Villeurbanne', 'ASVEL', 'FR', 66],
  ['prs', 'Paris Basketball', 'Pari', 'FR', 80],
  ['dub', 'Dubai Basketball', 'Dubai', 'AE', 72],
  ['val', 'Valencia Basket', 'Valensija', 'ES', 76]
];

export const mockTeams = (): Record<string, Team> =>
  Object.fromEntries(
    TEAM_SEEDS.map(([code, name_en, name_sr, country]) => [
      code,
      { code, name_en, name_sr, country, logo: null }
    ])
  );

/**
 * Procenjena snaga tima, 64–86.
 *
 * Za demo timove je upisana rucno. Za timove iz prave baze izvodi se iz
 * koda — determinsticki, ali razlicito po timu, da svi mecevi ne bi
 * ispali jednako tezki.
 */
const strengthOf = (code: string) => {
  const seed = TEAM_SEEDS.find((t) => t[0] === code)?.[4];
  if (seed != null) return seed;
  if (!code) return 72;
  return 64 + Math.floor(seeded(`strength-${code}`)() * 23);
};

/* ------------------------------------------------------------------ */
/* IGRAČI SA FOTOGRAFIJOM                                              */
/* ------------------------------------------------------------------ */

/** [id, puno ime, pozicija, broj dresa] — id odgovara imenu fajla slike. */
type Named = [id: string, full: string, pos: 'G' | 'F' | 'C', jersey: number];

const EA7: Named[] = [
  ['bolmaro-l-ea7', 'Leandro Bolmaro', 'G', 4],
  ['booker-d-ea7', 'Devin Booker', 'C', 22],
  ['guduric-m-ea7', 'Marko Guduric', 'G', 23],
  ['hall-d-ea7', 'Devon Hall', 'G', 0],
  ['ricci-g-ea7', 'Giampaolo Ricci', 'F', 21],
  ['tonut-s-ea7', 'Stefano Tonut', 'G', 7],
  ['flaccadori-d-ea7', 'Diego Flaccadori', 'G', 11],
  ['diop-o-ea7', 'Ousmane Diop', 'C', 16],
  ['akele-n-ea7', 'Nicola Akele', 'F', 30],
  ['wright-m-ea7', 'Moses Wright', 'C', 5],
  ['thompson-d-ea7', 'Darius Thompson', 'G', 15],
  ['peters-a-ea7', 'Alec Peters', 'F', 34],
  ['mathews-g-ea7', 'Grant Mathews', 'F', 9],
  ['burnell-j-ea7', 'Jordan Burnell', 'F', 12],
  ['cole-r-ea7', 'Rayjon Cole', 'G', 3]
];

const EFS: Named[] = [
  ['james-m-efs', 'Mike James', 'G', 55],
  ['loyd-j-efs', 'Jordan Loyd', 'G', 33],
  ['cordinier-i-efs', 'Isaia Cordinier', 'G', 2],
  ['saric-d-efs', 'Dario Saric', 'F', 9],
  ['osmani-e-efs', 'Ercan Osmani', 'F', 21],
  ['papagiannis-g-efs', 'Georgios Papagiannis', 'C', 13],
  ['fernando-b-efs', 'Bruno Fernando', 'C', 20],
  ['dozier-p-efs', 'PJ Dozier', 'G', 35],
  ['strazel-m-efs', 'Matthew Strazel', 'G', 6],
  ['dessert-b-efs', 'Brice Dessert', 'C', 14],
  ['yusta-s-efs', 'Santi Yusta', 'F', 24],
  ['russell-d-efs', 'Derrick Russell', 'G', 1],
  ['malcolm-c-efs', 'Cole Malcolm', 'F', 8],
  ['jones-k-efs', 'Kyle Jones', 'F', 17],
  ['mutaf-d-efs', 'Dogus Mutaf', 'G', 10],
  ['yilmaz-e-efs', 'Erkan Yilmaz', 'F', 27],
  ['yildizli-b-efs', 'Berkay Yildizli', 'G', 44],
  ['fenemen-r-efs', 'Rodrigue Fenemen', 'C', 41]
];

/* Prezimena po tržištu — imena su izmišljena, ali zvuče kao liga. */
const SURNAMES: Record<string, string[]> = {
  es: ['Abrines', 'Nunez', 'Reyes', 'Aldama', 'Sastre', 'Vives', 'Oriola', 'Ferrando', 'Brizuela', 'Sanli'],
  gr: ['Kalaitzakis', 'Papanikolaou', 'Sloukas', 'Mitoglou', 'Larentzakis', 'Vezenkov', 'Katsivelis', 'Agravanis', 'Zougris', 'Dorsey'],
  tr: ['Sanli', 'Korkmaz', 'Arslan', 'Ozdemiroglu', 'Bitim', 'Tuncer', 'Cakir', 'Gunes', 'Kaya', 'Demir'],
  rs: ['Jovanovic', 'Petrovic', 'Nikolic', 'Milic', 'Lazarevic', 'Kovacevic', 'Dobric', 'Simanic', 'Uskokovic', 'Avramovic'],
  fr: ['Ouattara', 'Diallo', 'Lessort', 'Bako', 'Cournooh', 'Hifi', 'Herrera', 'Maledon', 'Ndiaye', 'Robinson'],
  lt: ['Ulanovas', 'Lekavicius', 'Butkevicius', 'Birutis', 'Masiulis', 'Rubstavicius', 'Giedraitis', 'Sirvydis', 'Normantas', 'Velicka'],
  de: ['Obst', 'Lucic', 'Weiler', 'Bonga', 'Dinwiddie', 'Ibaka', 'Giffey', 'Voigtmann', 'Baldwin', 'Reuvers'],
  it: ['Belinelli', 'Pajola', 'Polonara', 'Cordinier', 'Zizic', 'Grazulis', 'Mascolo', 'Diouf', 'Morgan', 'Accorsi'],
  il: ['Avdija', 'Zoosman', 'Sorkin', 'Menco', 'Blayzer', 'Ginat', 'Timor', 'Rivero', 'Motley', 'Odiase'],
  ae: ['Kabengele', 'Petrusev', 'McGee', 'Bertans', 'Vukcevic', 'Sanon', 'Prepelic', 'Todorovic', 'Radebaugh', 'Wiley']
};

const FIRSTS = ['A', 'B', 'D', 'E', 'F', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'V', 'Z'];

const COUNTRY_POOL: Record<string, keyof typeof SURNAMES> = {
  rmb: 'es', bar: 'es', bas: 'es', val: 'es',
  pao: 'gr', oly: 'gr',
  fnb: 'tr',
  par: 'rs', czv: 'rs',
  mco: 'fr', asv: 'fr', prs: 'fr',
  zal: 'lt',
  bay: 'de',
  vir: 'it',
  mta: 'il', hta: 'il',
  dub: 'ae'
};

const shortName = (full: string) => {
  const parts = full.split(' ');
  const last = parts[parts.length - 1];
  return `${last} ${parts[0][0]}.`;
};

function rosterFor(code: string): Player[] {
  if (code === 'ea7' || code === 'efs') {
    const list = code === 'ea7' ? EA7 : EFS;
    return list.map(([id, full, position, jersey]) => ({
      id,
      full_name: full,
      short_name: shortName(full),
      team_code: code,
      position,
      jersey,
      photo: `/slike/players/${id}.jpg`
    }));
  }

  const pool = SURNAMES[COUNTRY_POOL[code] ?? 'es'];
  const rnd = seeded(`roster-${code}`);
  const positions: ('G' | 'F' | 'C')[] = ['G', 'G', 'G', 'G', 'F', 'F', 'F', 'F', 'C', 'C'];

  return pool.map((surname, i) => {
    const first = FIRSTS[Math.floor(rnd() * FIRSTS.length)];
    return {
      id: `${surname.toLowerCase()}-${first.toLowerCase()}-${code}`,
      full_name: `${first}. ${surname}`,
      short_name: `${surname} ${first}.`,
      team_code: code,
      position: positions[i],
      jersey: 1 + Math.floor(rnd() * 44),
      photo: null
    };
  });
}

export const mockPlayers = (): Player[] => TEAM_SEEDS.flatMap(([code]) => rosterFor(code));

/* ------------------------------------------------------------------ */
/* KOLO I RASPORED                                                     */
/* ------------------------------------------------------------------ */

export const MOCK_ROUND_ID = 12;

export const mockRound = (): Round => {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 2);
  deadline.setHours(19, 0, 0, 0);
  return {
    id: MOCK_ROUND_ID,
    season: '2025/26',
    number: 12,
    deadline: deadline.toISOString(),
    status: 'open'
  };
};

const PAIRS: [string, string][] = [
  ['ea7', 'efs'],
  ['rmb', 'bas'],
  ['pao', 'zal'],
  ['oly', 'vir'],
  ['fnb', 'bay'],
  ['bar', 'asv'],
  ['mco', 'par'],
  ['czv', 'val'],
  ['mta', 'prs'],
  ['hta', 'dub']
];

export function mockFixtures(roundId = MOCK_ROUND_ID): Fixture[] {
  const base = new Date();
  base.setDate(base.getDate() + 2);
  base.setHours(18, 45, 0, 0);

  return PAIRS.map(([home, away], i) => {
    const rnd = seeded(`fx-${home}-${away}`);
    const diff = strengthOf(home) + 3 - strengthOf(away); // prednost domaćeg terena
    const edge = Math.min(84, Math.max(16, Math.round(50 + diff * 1.6 + (rnd() - 0.5) * 6)));
    const t = new Date(base);
    t.setDate(t.getDate() + (i < 5 ? 0 : 1));
    t.setHours(18 + (i % 5), i % 2 ? 30 : 0, 0, 0);

    const homeName = TEAM_SEEDS.find((x) => x[0] === home)![2];
    const awayName = TEAM_SEEDS.find((x) => x[0] === away)![2];

    return {
      id: roundId * 100 + i,
      round_id: roundId,
      home_code: home,
      away_code: away,
      tip_off: t.toISOString(),
      home_edge: edge,
      pred_sr:
        edge >= 60
          ? `${homeName} kod kuce drzi tempo nisko i dobija skok u napadu — ocekujemo sigurnu pobedu.`
          : edge <= 40
            ? `${awayName} ima bolju rotaciju na spoljnim pozicijama; gost je favorit i pored puta.`
            : `Utakmica bez favorita. Odlucuje procenat za tri poena u poslednjoj cetvrtini.`,
      pred_en: null,
      home_score: null,
      away_score: null
    };
  });
}

/* ------------------------------------------------------------------ */
/* CENE I PROJEKCIJE                                                   */
/* ------------------------------------------------------------------ */

const WHY_TEMPLATES = [
  (n: string, o: string) => `${n} u poslednja tri kola igra preko 28 minuta, a ${o} prima najvise poena od beka na krilu. Cena jos nije ispratila skok minutaze.`,
  (n: string, o: string) => `Protiv ${o} se otvara skok u napadu — ${n} po utakmici uzme skoro pet ofanzivnih lopti, sto je najbrzi nacin da se dodje do fantasy poena.`,
  (n: string, _o: string) => `Bez prvog centra u rotaciji ${n} preuzima ulogu u reketu. Isti scenario mu je prosle sezone doneo dvocifren skok projekcije.`,
  (n: string, o: string) => `${o} igra najsporiji tempo u ligi, ali ${n} vecinu poena pravi sa penala — tempo mu smeta manje nego ostalima na toj poziciji.`,
  (n: string, _o: string) => `Cena je pala posle dva slaba kola, forma se vratila. Ovo je klasican trenutak za ulazak pre nego sto se cena ispravi.`
];

/**
 * Generise cenu, projekciju i analiticki sloj nad datim spiskom igraca.
 *
 * Koristi se na dva nacina:
 *  - nad demo sastavima, kad je baza sasvim prazna;
 *  - nad PRAVIM igracima i PRAVIM rasporedom iz baze, kad postoje igraci i
 *    mecevi ali za kolo jos nisu unete cene. Tada su imena, timovi i
 *    protivnici tacni, a samo brojevi su demonstracioni — sto je daleko
 *    korisnije od paralelnog izmisljenog sastava.
 */
export function generatePricing(
  players: Player[],
  fixtures: Fixture[],
  teams: Record<string, Team>,
  roundId: number
): PricedPlayer[] {
  const opponentOf = (code: string | null) => {
    const none = { opponent: null as string | null, home: null as boolean | null, edge: null as number | null };
    if (!code) return none;
    const f = fixtures.find((x) => x.home_code === code || x.away_code === code);
    if (!f) return none;
    return f.home_code === code
      ? { opponent: f.away_code, home: true, edge: f.home_edge }
      : { opponent: f.home_code, home: false, edge: f.home_edge };
  };

  /* Mesto igraca u rotaciji je stabilno po timu — ne sme da se menja
     izmedju dva renderovanja, inace tabela poskakuje. */
  const depthOf = new Map<string, number>();
  const byTeam = players.reduce<Record<string, Player[]>>((acc, p) => {
    (acc[p.team_code ?? '-'] ||= []).push(p);
    return acc;
  }, {});
  Object.values(byTeam).forEach((roster) => {
    [...roster]
      .sort((a, b) => seeded(`depth-${a.id}`)() - seeded(`depth-${b.id}`)())
      .forEach((p, i) => depthOf.set(p.id, i));
  });

  const rows = players.map((p, idx) => {
    const rnd = seeded(`pr-${p.id}-${roundId}`);
    const teamPower = strengthOf(p.team_code ?? '');
    const depth = Math.min(9, depthOf.get(p.id) ?? idx % 10);

    /* Nosioci tima nose najvise poena; centri nesto vise od beka. */
    const roleBoost = [1.35, 1.22, 1.12, 1.04, 0.96, 0.9, 0.82, 0.74, 0.66, 0.58][depth];
    const posBoost = p.position === 'C' ? 1.06 : p.position === 'F' ? 1.0 : 0.98;
    const base = (teamPower / 78) * 15.5 * roleBoost * posBoost;
    const projected = round1(Math.max(2.5, base + (rnd() - 0.5) * 4));

    /* Cena prati projekciju, ali ne savrseno — u tom raskoraku je vrednost. */
    const price = round1(Math.max(3.2, projected * (0.62 + rnd() * 0.22)));

    const { opponent, home, edge } = opponentOf(p.team_code);

    /* Ako baza vec nosi nasu procenu meca, ona je bolji izvor od bilo cega
       sto bismo ovde izmislili — tezina protivnika se izvodi iz nje. */
    const matchup =
      edge != null
        ? round1(Math.min(10, Math.max(1, ((home ? edge : 100 - edge) / 100) * 9 + 1)))
        : round1(
            Math.min(
              10,
              Math.max(1, 10 - ((opponent ? strengthOf(opponent) : 75) - 62) / 3 + (home ? 0.8 : -0.4))
            )
          );

    const value = round1(Math.min(10, (projected / price) * 3.6));

    const form = Array.from({ length: 5 }, (_, i) =>
      round1(Math.max(0, projected + (seeded(`${p.id}-f${i}`)() - 0.45) * projected * 0.8))
    );
    const seasonAvg = round1(form.reduce((a, b) => a + b, 0) / form.length);
    const oppName = teams[opponent ?? '']?.name_sr ?? 'protivnik';

    return {
      ...p,
      player_id: p.id,
      price,
      projected,
      value_score: value,
      matchup_score: matchup,
      opponent_code: opponent,
      is_home: home,
      tier_pick: null,
      pick_group: null,
      why_sr: WHY_TEMPLATES[idx % WHY_TEMPLATES.length](p.short_name, oppName),
      why_en: null,
      status: rnd() > 0.94 ? 'upitan' : 'ok',
      form,
      season_avg: seasonAvg,
      minutes: round1(12 + roleBoost * 11 + (rnd() - 0.5) * 4),
      ownership: round1(Math.min(72, Math.max(0.4, value * 4.5 + (rnd() - 0.5) * 12))),
      price_trend: round1((rnd() - 0.45) * 1.4),
      team: teams[p.team_code ?? '']
    } as PricedPlayer;
  });

  rows.sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0));

  /* Prva tri su izbori kola — prvi je besplatan. */
  rows.forEach((r, i) => {
    r.tier_pick = i === 0 ? 'FREE' : i < 3 ? 'PLUS' : i < 12 ? 'PRO' : null;
  });

  return rows;
}

export function mockPricedPlayers(roundId = MOCK_ROUND_ID): PricedPlayer[] {
  return generatePricing(mockPlayers(), mockFixtures(roundId), mockTeams(), roundId);
}

/* ------------------------------------------------------------------ */
/* TRENERI                                                             */
/* ------------------------------------------------------------------ */

/**
 * Jedan trener po timu.
 *
 * Prava imena trenera nisu u bazi, pa se do tada koristi oznaka tima.
 * Kad se popuni tabela `coaches`, ova funkcija se vise ne poziva —
 * ime, cena i projekcija dolaze odande.
 */
export function generateCoaches(
  teams: Record<string, Team>,
  fixtures: Fixture[],
  roundId: number
): Coach[] {
  return Object.values(teams).map((t) => {
    const rnd = seeded(`coach-${t.code}-${roundId}`);
    const f = fixtures.find((x) => x.home_code === t.code || x.away_code === t.code);
    const home = f?.home_code === t.code;
    const edge = f?.home_edge ?? 50;
    /* Trener najvise zavisi od toga da li tim dobija mec. */
    const chance = (home ? edge : 100 - edge) / 100;

    return {
      id: `hc-${t.code}`,
      name: `HC ${t.name_sr}`,
      team_code: t.code,
      price: round1(3.5 + chance * 4 + rnd() * 1.2),
      projected: round1(6 + chance * 14 + (rnd() - 0.5) * 3)
    };
  });
}

/* ------------------------------------------------------------------ */
/* IGRA KOLA                                                           */
/* ------------------------------------------------------------------ */

export function mockChallengeLines(
  roundId = MOCK_ROUND_ID,
  priced?: PricedPlayer[]
): (ChallengeLine & { players: Player })[] {
  const all = priced?.length ? priced : mockPricedPlayers(roundId);
  const withPhoto = all.filter((p) => p.photo).slice(0, 6);
  const pool = withPhoto.length >= 6 ? withPhoto : all.slice(0, 6);

  return pool.map((p, i) => ({
    id: roundId * 100 + i,
    player_id: p.id,
    line: round1(p.projected + (i % 2 ? 1.5 : -1.5)),
    result: null,
    players: {
      id: p.id,
      full_name: p.full_name,
      short_name: p.short_name,
      team_code: p.team_code,
      position: p.position,
      jersey: p.jersey,
      photo: p.photo
    }
  }));
}

export const mockLeaderboard = (): LeaderboardRow[] =>
  [
    ['bekstrana', 91],
    ['pick_and_roll', 88],
    ['marko_efl', 86],
    ['triple_dabl', 83],
    ['zona_2_3', 81],
    ['kontranapad', 78],
    ['sesti_igrac', 75],
    ['tajmaut', 72],
    ['reket', 70],
    ['asistencija', 67]
  ].map(([username, accuracy]) => ({ username: username as string, accuracy: accuracy as number }));
