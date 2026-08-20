export type Tier = 'FREE' | 'PLUS' | 'PRO' | 'ULTRA';
export const TIER_RANK: Record<Tier, number> = { FREE: 0, PLUS: 1, PRO: 2, ULTRA: 3 };
export const canAccess = (mine: Tier, need: Tier) => TIER_RANK[mine] >= TIER_RANK[need];

export type Team = {
  code: string; name_en: string; name_sr: string; country: string | null; logo: string | null;
};

export type Player = {
  id: string; full_name: string; short_name: string;
  team_code: string | null; position: 'G' | 'F' | 'C' | null;
  jersey: number | null; photo: string | null;
};

export type Round = {
  id: number; season: string; number: number;
  deadline: string | null; status: 'upcoming' | 'open' | 'locked' | 'finished';
};

export type Fixture = {
  id: number; round_id: number;
  home_code: string; away_code: string; tip_off: string | null;
  home_edge: number | null; pred_sr: string | null; pred_en: string | null;
  home_score: number | null; away_score: number | null;
};

export type PlayerRound = {
  player_id: string; price: number; projected: number;
  value_score: number | null; matchup_score: number | null;
  opponent_code: string | null; is_home: boolean | null;
  tier_pick: Tier | null; pick_group: string | null;
  why_sr: string | null; why_en: string | null; status: string | null;
};

export type ChallengeLine = { id: number; player_id: string; line: number; result: string | null };

/** Igrač spojen sa cenom kola — ono što kartice prikazuju. */
export type PricedPlayer = Player & PlayerRound & { team?: Team };
