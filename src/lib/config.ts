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

/**
 * Objašnjenja metrika — isti tekst u tabeli, na kartici i na naslovnoj.
 *
 * Svaka rečenica mora da odgovara onome što `scripts/uvoz-cena.mjs`
 * stvarno računa. Tezina meca se izvodi iz procene ishoda utakmice, ne iz
 * odbrane protivnika po poziciji — zato tako i piše.
 */
export const METRIKE = {
  cena: 'Cena igrača u kreditima u zvaničnoj igri za ovo kolo.',
  projekcija: 'Očekivani fantasy poeni u ovom kolu.',
  razlika:
    'Koliko projektovanih fantasy poena igrač donosi iznad svoje cene. Računa se kao projekcija minus cena.',
  vrednost:
    'Koliko je igrač isplativ u odnosu na cenu, na skali 0–10. 5 = tačno onoliko koliko se za tu cenu očekuje; više je bolje.',
  protivnik:
    'Protivnik i koliko je meč povoljan, 1–10. Više znači lakši meč. Izvodi se iz procene ishoda utakmice.',
  prosek: 'Prosečni fantasy poeni po utakmici u prošloj sezoni.',
  vlasnistvo: 'Procenat menadžera u zvaničnoj igri koji već imaju igrača u timu.'
} as const;

/** Puna adresa za canonical i sitemap. */
export const absUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/* ------------------------------------------------------------------ */
/* PAKETI                                                              */
/* ------------------------------------------------------------------ */

export type PlanCode = 'PLUS' | 'PRO';

export type Plan = {
  code: PlanCode;
  tier: Exclude<Tier, 'FREE' | 'ULTRA'>;
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

/*
 * Dva plaćena paketa. `ULTRA` ostaje samo u tipu `Tier`, zbog naloga koji
 * ga već imaju (ručno dodeljen admin) — ima sva prava kao Pro, ali se više
 * ne prodaje.
 */
export const PLANS: Plan[] = [
  {
    code: 'PLUS',
    tier: 'PLUS',
    name: 'Plus',
    priceCents: 200,
    days: 30,
    pitch: 'Po dva izbora za svaku poziciju u svakom cenovnom rangu — i koga da izbegneš.',
    features: [
      'Besplatan izbor kola',
      '18 izbora: po 2 za bekove, krila i centre u svakom cenovnom rangu',
      '9 igrača koje treba izbegavati za cenu koju traže',
      'Tabela kola sa cenom i protivnikom za sve igrače'
    ]
  },
  {
    code: 'PRO',
    tier: 'PRO',
    name: 'Pro',
    priceCents: 2500,
    days: 30,
    featured: true,
    pitch: 'Najbolji izbori kola, cela baza projekcija i optimizator tima.',
    features: [
      'Sve iz Plus paketa',
      'Top 5 izbora kola i kapiten — samo u Pro paketu',
      'Projekcija za svakog igrača u ligi',
      'Optimizator sam predlaže 4 najbolje izmene',
      'Vlasništvo, prosek i minutaža za sve igrače'
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
 * Cenovni rangovi. Isti pragovi važe i za dodelu izbora u skripti i za
 * naslove na sajtu, pa stoje ovde a ne na dva mesta.
 */
export const PRICE_BANDS = [
  { key: 'skup', label: 'Skup', desc: 'više od 12 kredita' },
  { key: 'srednji', label: 'Srednji', desc: 'od 8 do 12 kredita' },
  { key: 'jeftin', label: 'Jeftin', desc: 'manje od 8 kredita' }
] as const;

export type PriceBand = (typeof PRICE_BANDS)[number]['key'];

export const bandOf = (price: number | null): PriceBand =>
  price == null || price < 8 ? 'jeftin' : price <= 12 ? 'srednji' : 'skup';

export const bandLabel = (key: string) =>
  PRICE_BANDS.find((b) => b.key === key)?.label ?? key;

/**
 * Šta koji paket dobija u izborima kola.
 *
 * FREE — jedan izbor kola.
 * PLUS — za svaku poziciju i svaki cenovni rang po 2 izbora (18), plus po
 *        jedan igrač koga treba izbegavati (9).
 * PRO  — sve to, plus top 5 izbora kola i kapiten, koji se ne dele ni sa
 *        Plus paketom, cela baza projekcija i optimizator.
 *
 * Ko je u kom pretincu odlučuje skripta pri uvozu (`tier_pick`,
 * `pick_group`); stranica samo grupiše ono što joj server pošalje.
 * Izbegavanje nosi `pick_group` sa sufiksom IZBEGNI.
 */
export const IZBEGNI = '-izbegni';

/** Koliko zamena optimizator otkriva u celosti. */
export const OPTIMIZER_LIMIT: Record<Tier, number> = {
  /* Optimizator je Pro. Niži paketi vide koliko poena zamene donose i
     da ih ima, ali ne i koje su. */
  FREE: 0,
  PLUS: 0,
  /* Četiri izmene — koliko zvanična igra dozvoljava besplatno po kolu. */
  PRO: 4,
  ULTRA: 4
};

/** Paket koji je logičan sledeći korak sa trenutnog. */
export const NEXT_TIER: Record<Tier, PlanCode> = {
  FREE: 'PLUS',
  PLUS: 'PRO',
  PRO: 'PRO',
  ULTRA: 'PRO'
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
