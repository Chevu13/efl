export type Tier = 'FREE' | 'PLUS' | 'PRO' | 'ULTRA';
export const TIER_RANK: Record<Tier, number> = { FREE: 0, PLUS: 1, PRO: 2, ULTRA: 3 };
export const canAccess = (mine: Tier, need: Tier) => TIER_RANK[mine] >= TIER_RANK[need];
export const isPremium = (t: Tier) => TIER_RANK[t] > 0;
/** Pro ili jači — cela baza projekcija, top izbori i optimizator. */
export const jePro = (t: Tier) => TIER_RANK[t] >= TIER_RANK.PRO;

export type Position = 'G' | 'F' | 'C';

export type Team = {
  code: string;
  name_en: string;
  name_sr: string;
  country: string | null;
  logo: string | null;
};

export type Player = {
  id: string;
  full_name: string;
  short_name: string;
  team_code: string | null;
  position: Position | null;
  jersey: number | null;
  photo: string | null;
};

export type Round = {
  id: number;
  season: string;
  number: number;
  deadline: string | null;
  status: 'upcoming' | 'open' | 'locked' | 'finished';
};

export type Fixture = {
  id: number;
  round_id: number;
  home_code: string;
  away_code: string;
  tip_off: string | null;
  home_edge: number | null;
  pred_sr: string | null;
  pred_en: string | null;
  home_score: number | null;
  away_score: number | null;
};

export type PlayerRound = {
  player_id: string;
  price: number;
  projected: number;
  value_score: number | null;
  matchup_score: number | null;
  opponent_code: string | null;
  is_home: boolean | null;
  tier_pick: Tier | null;
  pick_group: string | null;
  why_sr: string | null;
  why_en: string | null;
  status: string | null;

  /* Prošireni podaci. Kolone su opcione — ako ih u bazi nema,
     interfejs ih jednostavno ne prikazuje umesto da puca. */
  /** Fantasy poeni u poslednjih do 5 kola, od najstarijeg ka najnovijem. */
  form?: number[] | null;
  /** Sezonski prosek fantasy poena. */
  season_avg?: number | null;
  /** Prosečna minutaža. */
  minutes?: number | null;
  /** Procenat menadžera koji ga ima u timu. */
  ownership?: number | null;
  /** Promena cene u odnosu na prethodno kolo. */
  price_trend?: number | null;
};

export type ChallengeLine = {
  id: number;
  player_id: string;
  line: number;
  result: string | null;
};

/** Igrač spojen sa cenom kola — ono što kartice i tabele prikazuju. */
export type PricedPlayer = Player & PlayerRound & { team?: Team };

export type LeaderboardRow = { username: string; accuracy: number };

/**
 * Trener. Po zvanicnim pravilima ulazi u postavu kao jedanaesti izbor,
 * kosta kredite i nosi pune poene — pa je i ovde ravnopravan entitet, a
 * ne ukras na kartici tima.
 */
export type Coach = {
  id: string;
  name: string;
  team_code: string;
  price: number;
  projected: number;
};

/* ------------------------------------------------------------------ */
/* PRETPLATE                                                           */
/* ------------------------------------------------------------------ */

export type SubscriptionSource = 'paypal' | 'code' | 'manual' | 'reward' | string;

export type Subscription = {
  id: number | string;
  user_id?: string;
  tier: Tier;
  source: SubscriptionSource;
  starts_at?: string | null;
  ends_at: string | null;
  created_at?: string | null;
  paypal_id?: string | null;
  note?: string | null;
  status?: string | null;
};
