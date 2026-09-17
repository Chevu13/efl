import type { Position, Tier } from './types';

/**
 * Jedno mesto za sve što je „poslovna odluka”: cene, šta koji paket nosi,
 * pravila sastava tima. Menja se ovde i menja se svuda — u navigaciji,
 * na profilu, u PayPal narudžbini i u webhook-u.
 */

export const SITE = {
  name: 'Euro Fantasy Lab',
  short: 'EFL',
  tagline: 'Prestani da nagađaš. Počni da računaš.',
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'sr_RS',
  lang: 'sr',
  /** Kontakt za podrsku, privatnost i povracaj novca — jedno mesto. */
  email: 'eurofantasylab@gmail.com'
} as const;

/**
 * Adresa sajta — koren za canonical, sitemap, robots i OG sliku.
 *
 * Vercel postavlja `VERCEL_URL` sam, ali bez šeme i sa nasumičnim
 * poddomenom po deployu; zato je `NEXT_PUBLIC_SITE_URL` glavni izvor i
 * on mora da stoji u produkciji. Lokalni fallback služi samo da build
 * ne pukne na praznoj promenljivoj.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
).replace(/\/$/, '');

/** Puna adresa za canonical i sitemap. */
export const absUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/* ------------------------------------------------------------------ */
/* PAKETI                                                              */
/* ------------------------------------------------------------------ */

export type PlanCode = 'PLUS' | 'PRO' | 'ULTRA';

export type Plan = {
  code: PlanCode;
  tier: Exclude<Tier, 'FREE'>;
  name: string;
  /** Cena u centima — nikad ne računamo u float-u. */
  priceCents: number;
  /** Koliko dana pristupa donosi jedna uplata. */
  days: number;
  pitch: string;
  features: string[];
  /** Istaknut paket u tabeli cena. */
  featured?: boolean;
};

export const PLANS: Plan[] = [
  {
    code: 'PLUS',
    tier: 'PLUS',
    name: 'Plus',
    /* ponytail: privremeno 2 EUR radi probe naplate — vratiti na 900. */
    priceCents: 200,
    days: 30,
    pitch: 'Po jedan izbor iz svakog cenovnog ranga.',
    features: [
      'Sve iz besplatnog paketa',
      'Skup, srednji i jeftin izbor — po jedan, sa detaljnim obrazloženjem',
      'Tabela kola sa cenom, projekcijom i razlikom',
      'Sortiranje i filteri po vrednosti'
    ]
  },
  {
    code: 'PRO',
    tier: 'PRO',
    name: 'Pro',
    priceCents: 1900,
    days: 30,
    featured: true,
    pitch: 'Po tri izbora na svakoj poziciji, u sva tri cenovna ranga.',
    features: [
      'Sve iz Plus paketa',
      'Bek, krilo i centar — po tri izbora, skup, srednji i jeftin',
      'Detaljno obrazloženje za svaki od devet izbora',
      'Forma poslednjih 5 kola i minutaža',
      'Težina protivnika i vlasništvo po igraču'
    ]
  },
  {
    code: 'ULTRA',
    tier: 'ULTRA',
    name: 'Ultra',
    priceCents: 2900,
    days: 30,
    pitch: 'Cela baza i optimizator koji sam nadje četiri izmene.',
    features: [
      'Sve iz Pro paketa',
      'Cela baza igrača sa projekcijom za svakog',
      'Optimizator sam pravi najboljе 4 izmene po kreditu',
      'Svaka izmena sa obrazloženjem i računom budžeta',
      'Prioritet za nova kola'
    ]
  }
];

export const planByCode = (code: string): Plan | undefined =>
  PLANS.find((p) => p.code === code);

export const priceLabel = (cents: number) =>
  `${SITE.currencySymbol}${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;

/** PayPal traži string sa dve decimale. */
export const priceValue = (cents: number) => (cents / 100).toFixed(2);

/**
 * Rezervni put: stara uplata bez oznake paketa. Iznos -> najviši paket
 * koji taj iznos pokriva.
 *
 * Izvodi se iz iste tabele cena iznad. Ranije su cene stajale na dva
 * mesta — u komponenti sa paketima i u webhook-u — pa je promena na
 * jednom mestu tiho dodeljivala pogrešan paket. Sada je izvor jedan.
 */
export function planForAmount(eur: number): Plan {
  const cents = Math.round(eur * 100);
  const sorted = [...PLANS].sort((a, b) => b.priceCents - a.priceCents);
  return sorted.find((p) => cents >= p.priceCents - 1) ?? PLANS[0];
}

/* ------------------------------------------------------------------ */
/* ŠTA KOJI PAKET OTKLJUČAVA                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* IZBORI KOLA                                                         */
/* ------------------------------------------------------------------ */

/**
 * Cenovni rangovi. Isti pragovi vaze i za dodelu izbora u skripti i za
 * naslove na sajtu, pa stoje ovde a ne na dva mesta.
 */
export const PRICE_BANDS = [
  { key: 'skup', label: 'Skup', desc: '12 kredita i vise', min: 12, max: Infinity },
  { key: 'srednji', label: 'Srednji', desc: 'od 8 do 12 kredita', min: 8, max: 12 },
  { key: 'jeftin', label: 'Jeftin', desc: 'do 8 kredita', min: 0, max: 8 }
] as const;

export type PriceBand = (typeof PRICE_BANDS)[number]['key'];

export const bandOf = (price: number | null): PriceBand =>
  price == null || price < 8 ? 'jeftin' : price < 12 ? 'srednji' : 'skup';

export const bandLabel = (key: string) =>
  PRICE_BANDS.find((b) => b.key === key)?.label ?? key;

/**
 * Sta koji paket dobija u izborima kola.
 *
 * FREE  — jedan izbor, onaj sa najvecom razlikom projekcije i cene.
 * PLUS  — jos tri: po jedan iz svakog cenovnog ranga.
 * PRO   — jos devet: svaka pozicija puta svaki cenovni rang.
 * ULTRA — sve to, plus cela baza i optimizator.
 *
 * Broj se ne kuca rucno u komponenti: skripta dodeljuje `tier_pick` i
 * `pick_group`, a stranica samo grupise ono sto joj server posalje.
 */
export const PICK_LIMIT: Record<Tier, number> = {
  FREE: 1,
  PLUS: 4,
  PRO: 13,
  ULTRA: 13
};

/** Koliko zamena optimizator otkriva u celosti. */
export const OPTIMIZER_LIMIT: Record<Tier, number> = {
  FREE: 1,
  PLUS: 1,
  PRO: 2,
  /* Cetiri izmene — koliko zvanicna igra dozvoljava besplatno po kolu. */
  ULTRA: 4
};

/** Paket koji je logičan sledeći korak sa trenutnog. */
export const NEXT_TIER: Record<Tier, PlanCode> = {
  FREE: 'PLUS',
  PLUS: 'PRO',
  PRO: 'ULTRA',
  ULTRA: 'ULTRA'
};

/* ------------------------------------------------------------------ */
/* PRAVILA SASTAVA                                                     */
/* ------------------------------------------------------------------ */

/**
 * Pravila EuroLeague Fantasy Challenge takmicenja.
 *
 * Ovo nisu nasa pravila nego zvanicna — postava napravljena ovde mora da
 * se moze prepisati u zvanicnu igru bez ijedne izmene. Zato su brojevi
 * tacni, a ne priblizni: cetiri beka, cetiri krila, dva centra i trener.
 */
export const LINEUP = {
  /** 10 igraca + 1 trener. */
  size: 10,
  budget: 100,

  /** Tacan sastav kadra — ni manje ni vise. */
  squad: { G: 4, F: 4, C: 2 } as Record<Position, number>,

  starters: 5,
  /** Sesti igrac nosi pune poene, kao i starteri. */
  sixthMan: 1,
  bench: 4,

  /** Kapiten iz prve petorke. */
  captainMultiplier: 1.5,
  /** Klupa bez sestog igraca. */
  benchMultiplier: 0.5,

  hasCoach: true
} as const;

export type FormationCode = '2-2-1' | '3-1-1' | '1-3-1' | '1-2-2' | '2-1-2';

export type Formation = {
  code: FormationCode;
  /** Koliko igraca po poziciji ide u prvu petorku. */
  G: number;
  F: number;
  C: number;
  hint: string;
};

/** Dozvoljene formacije prve petorke, citaju se bek-krilo-centar. */
export const FORMATIONS: Formation[] = [
  { code: '2-2-1', G: 2, F: 2, C: 1, hint: 'Klasicna podela, najsigurniji izbor.' },
  { code: '3-1-1', G: 3, F: 1, C: 1, hint: 'Tri beka — za kola sa brzim mecevima.' },
  { code: '1-3-1', G: 1, F: 3, C: 1, hint: 'Tezina na krilima.' },
  { code: '1-2-2', G: 1, F: 2, C: 2, hint: 'Dva centra — kad se otvara skok.' },
  { code: '2-1-2', G: 2, F: 1, C: 2, hint: 'Dva centra uz dva beka.' }
];

export const formationByCode = (code: string): Formation =>
  FORMATIONS.find((f) => f.code === code) ?? FORMATIONS[0];

export const POSITION_LABEL: Record<Position, string> = {
  G: 'Bek',
  F: 'Krilo',
  C: 'Centar'
};

/** Akuzativ — za recenice tipa „Dodaj beka”. */
export const POSITION_ACC: Record<'G' | 'F' | 'C', string> = {
  G: 'beka',
  F: 'krilo',
  C: 'centra'
};

/** Mnozina — za naslove kolona i filtere. */
export const POSITION_PLURAL: Record<'G' | 'F' | 'C', string> = {
  G: 'Bekovi',
  F: 'Krila',
  C: 'Centri'
};
