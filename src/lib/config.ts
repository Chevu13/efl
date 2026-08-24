import type { Tier } from './types';

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
  currencySymbol: '€'
} as const;

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
    priceCents: 499,
    days: 30,
    pitch: 'Tri izbora kola i cela tabela igrača.',
    features: [
      'Sve iz besplatnog paketa',
      '3 izbora kola sa obrazloženjem',
      'Cela tabela igrača sa cenom i projekcijom',
      'Sortiranje i filteri po vrednosti'
    ]
  },
  {
    code: 'PRO',
    tier: 'PRO',
    name: 'Pro',
    priceCents: 999,
    days: 30,
    featured: true,
    pitch: 'Svi igrači kola, forma, minuti i dubinska analiza.',
    features: [
      'Sve iz Plus paketa',
      'Svi igrači kola sa projekcijom',
      'Forma poslednjih 5 kola i minutaža',
      'Težina protivnika po igraču',
      'Vlasništvo i trend cene'
    ]
  },
  {
    code: 'ULTRA',
    tier: 'ULTRA',
    name: 'Ultra',
    priceCents: 1799,
    days: 30,
    pitch: 'Optimizator postave — sve zamene i razlog za svaku.',
    features: [
      'Sve iz Pro paketa',
      'Optimizator postave bez ograničenja',
      'Svaka preporučena zamena sa obrazloženjem',
      'Računanje budžeta i ograničenja tima',
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
 * koji taj iznos pokriva. Izvodi se iz iste tabele cena, da se ne razilazi.
 */
export function planForAmount(eur: number): Plan {
  const cents = Math.round(eur * 100);
  const sorted = [...PLANS].sort((a, b) => b.priceCents - a.priceCents);
  return sorted.find((p) => cents >= p.priceCents - 1) ?? PLANS[0];
}

/* ------------------------------------------------------------------ */
/* ŠTA KOJI PAKET OTKLJUČAVA                                           */
/* ------------------------------------------------------------------ */

/** Koliko izbora kola se vidi na /igraci. */
export const PICK_LIMIT: Record<Tier, number> = {
  FREE: 1,
  PLUS: 3,
  PRO: 999,
  ULTRA: 999
};

/** Koliko zamena optimizator otkriva u celosti. */
export const OPTIMIZER_LIMIT: Record<Tier, number> = {
  FREE: 1,
  PLUS: 1,
  PRO: 2,
  ULTRA: 99
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

export const LINEUP = {
  size: 10,
  budget: 100,
  maxPerTeam: 2,
  /** [minimum, maksimum] po poziciji. */
  positions: {
    G: [3, 5],
    F: [3, 5],
    C: [1, 3]
  } as Record<'G' | 'F' | 'C', [number, number]>
} as const;

export const POSITION_LABEL: Record<'G' | 'F' | 'C', string> = {
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
