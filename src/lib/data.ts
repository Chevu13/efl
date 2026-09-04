import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import * as mock from './mock';
import { teamName } from './format';
import { TIER_RANK } from './types';
import type {
  ChallengeLine,
  Coach,
  Fixture,
  LeaderboardRow,
  Player,
  PlayerRound,
  PricedPlayer,
  Round,
  Subscription,
  Team,
  Tier
} from './types';

/**
 * Sloj podataka.
 *
 * Svaki upit prvo ide na Supabase. Ako tabela ne postoji, upit padne ili
 * vrati prazan rezultat, vraca se demo skup iz `mock.ts` — tako nijedan
 * ekran nikad nije prazan i dizajn se moze pregledati bez pune baze.
 *
 * Jedini izuzetak je `getMyTier`: paket i identitet nikad ne dolaze iz
 * demo podataka, jer bi to bila rupa u naplati.
 */

const fromMock = <T>(value: T): T => value;

/**
 * Da li aplikacija radi na demo podacima. Proverava se jednom po zahtevu
 * i sluzi samo da interfejs posteno oznaci da brojevi nisu pravi.
 */
export const isDemoData = cache(async (): Promise<boolean> => {
  const sb = createClient();
  const { count, error } = await sb
    .from('rounds')
    .select('id', { count: 'exact', head: true });
  return !!error || !count;
});

const empty = (rows: unknown[] | null | undefined) => !rows || rows.length === 0;

/* ------------------------------------------------------------------ */
/* TIMOVI I IGRACI                                                     */
/* ------------------------------------------------------------------ */

export const getTeams = cache(async (): Promise<Record<string, Team>> => {
  const sb = createClient();
  const { data, error } = await sb.from('teams').select('*');
  if (error || empty(data)) return fromMock(mock.mockTeams());
  return Object.fromEntries((data ?? []).map((t) => [t.code, t as Team]));
});

export const getAllPlayers = cache(async (): Promise<Player[]> => {
  const sb = createClient();
  const { data, error } = await sb
    .from('players')
    .select('*')
    .eq('active', true)
    .order('team_code');
  if (error || empty(data)) return fromMock(mock.mockPlayers());
  return data as Player[];
});

/* ------------------------------------------------------------------ */
/* KOLO                                                                */
/* ------------------------------------------------------------------ */

export const getCurrentRound = cache(async (): Promise<Round | null> => {
  const sb = createClient();
  const { data, error } = await sb
    .from('rounds')
    .select('*')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return fromMock(mock.mockRound());
  return data as Round;
});

export const getFixtures = cache(async (roundId: number): Promise<Fixture[]> => {
  const sb = createClient();
  const { data, error } = await sb
    .from('fixtures')
    .select('*')
    .eq('round_id', roundId)
    .order('tip_off');
  if (error || empty(data)) return fromMock(mock.mockFixtures(roundId));
  return data as Fixture[];
});

/** Igraci sa cenom za dato kolo, sortirani po vrednosti. */
export const getPricedPlayers = cache(async (roundId: number): Promise<PricedPlayer[]> => {
  const sb = createClient();
  const { data, error } = await sb
    .from('player_rounds')
    .select('*, players(*)')
    .eq('round_id', roundId)
    .not('price', 'is', null)
    .order('value_score', { ascending: false });

  if (error || empty(data)) {
    /* Cene za kolo jos nisu unete. Ako u bazi postoje pravi igraci i pravi
       mecevi, demo brojevi se generisu nad NJIMA — imena, timovi i
       protivnici ostaju tacni, samo su cene i projekcije demonstracione.
       Tek ako je baza sasvim prazna, koristi se izmisljen sastav. */
    const [teams, players, fixtures] = await Promise.all([
      getTeams(),
      getAllPlayers(),
      getFixtures(roundId)
    ]);
    if (players.length) {
      return fromMock(mock.generatePricing(players, fixtures, teams, roundId));
    }
    return fromMock(mock.mockPricedPlayers(roundId));
  }

  const teams = await getTeams();
  return (data as { players: Player | null }[])
    .filter((r) => r.players)
    .map((r) => {
      const { players, ...round } = r as { players: Player } & PlayerRound;
      return { ...players, ...round, team: teams[players.team_code ?? ''] };
    }) as PricedPlayer[];
});

export const getChallengeLines = cache(
  async (roundId: number): Promise<(ChallengeLine & { players: Player })[]> => {
    const sb = createClient();
    const { data, error } = await sb
      .from('challenge_lines')
      .select('*, players(*)')
      .eq('round_id', roundId);
    if (error || empty(data)) {
      const priced = await getPricedPlayers(roundId);
      return fromMock(mock.mockChallengeLines(roundId, priced));
    }
    return data as (ChallengeLine & { players: Player })[];
  }
);

export const getLeaderboard = cache(async (): Promise<LeaderboardRow[]> => {
  const sb = createClient();
  const { data, error } = await sb
    .from('leaderboard_season')
    .select('*')
    .order('accuracy', { ascending: false })
    .limit(10);
  if (error || empty(data)) return fromMock(mock.mockLeaderboard());
  return data as LeaderboardRow[];
});

/** Treneri kola. Ako tabele nema, izvode se iz timova i rasporeda. */
export const getCoaches = cache(async (roundId: number): Promise<Coach[]> => {
  const sb = createClient();
  const { data, error } = await sb.from('coaches').select('*').eq('round_id', roundId);

  if (error || empty(data)) {
    const [teams, fixtures] = await Promise.all([getTeams(), getFixtures(roundId)]);
    return fromMock(mock.generateCoaches(teams, fixtures, roundId));
  }
  return data as Coach[];
});

/* ------------------------------------------------------------------ */
/* NALOG — nikad iz demo podataka                                      */
/* ------------------------------------------------------------------ */

export type Me = {
  email: string | null;
  username: string | null;
  tier: Tier;
  userId: string | null;
};

export const getMyTier = cache(async (): Promise<Me> => {
  const sb = createClient();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return { email: null, username: null, tier: 'FREE', userId: null };

  const { data } = await sb.rpc('moj_tier', { uid: user.id });
  /* `full_name` stize uz Google prijavu — tamo nema naseg polja za ime. */
  const meta = user.user_metadata as { username?: string; full_name?: string } | null;

  return {
    email: user.email ?? null,
    username: meta?.username ?? meta?.full_name ?? user.email?.split('@')[0] ?? null,
    tier: ((data as Tier) ?? 'FREE') as Tier,
    userId: user.id
  };
});

/** Pretplate prijavljenog korisnika, najnovija prva. */
export async function getMySubscriptions(): Promise<Subscription[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return [];
  return (data ?? []) as Subscription[];
}

/** Aktivna pretplata — ona koja jos nije istekla. */
export function activeSubscription(subs: Subscription[]): Subscription | null {
  const now = Date.now();
  return (
    subs.find((s) => !s.ends_at || new Date(s.ends_at).getTime() > now) ?? null
  );
}

/**
 * Skida analiticki sloj sa igraca za korisnike bez paketa.
 *
 * Cena i projekcija ostaju — bez njih se postava ne moze ni sastaviti, a
 * to je deo proizvoda koji je namerno besplatan. Ono sto se naplacuje —
 * obrazlozenje, forma, minutaza, vlasnistvo i trend cene — ne odlazi u
 * pregledac uopste, pa nema sta da se otkljuca iz alatki za razvoj.
 */
export function trimForTier(players: PricedPlayer[], tier: Tier): PricedPlayer[] {
  if (TIER_RANK[tier] > 0) return players;
  return players.map((p) => ({
    ...p,
    why_sr: null,
    why_en: null,
    form: null,
    season_avg: null,
    minutes: null,
    ownership: null,
    price_trend: null
  }));
}

export async function getMyEntries() {
  const sb = createClient();
  const { data, error } = await sb
    .from('entries')
    .select('*')
    .order('round_id', { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as { id: number; round_id: number; correct: number | null; total: number | null }[];
}

/* ------------------------------------------------------------------ */
/* IZAZOV KOLA — sta je korisnik tipovao                               */
/* ------------------------------------------------------------------ */

export type MyPick = {
  id: string;
  /** Ime igraca ili „Domacin — Gost”. */
  subject: string;
  /** Granica, ili sta se tipuje na mecu. */
  detail: string;
  answer: string;
  /** null dok kolo nije odigrano i sracunato. */
  correct: boolean | null;
};

/**
 * Odabiri prijavljenog korisnika za jedno kolo, spremni za prikaz.
 *
 * Vraca praznu listu i kad korisnik nije prijavljen i kad nije tipovao —
 * profil u oba slucaja prikazuje isti poziv na akciju, pa razlika ne
 * treba nikome iznad ovog sloja.
 */
export async function getMyPicks(roundId: number): Promise<MyPick[]> {
  const sb = createClient();
  const {
    data: { user }
  } = await sb.auth.getUser();
  if (!user) return [];

  const { data: entry } = await sb
    .from('entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('round_id', roundId)
    .maybeSingle();
  if (!entry) return [];

  const { data: picks } = await sb.from('picks').select('*').eq('entry_id', entry.id);
  if (!picks?.length) return [];

  const lineIds = picks.filter((p) => p.kind === 'player').map((p) => p.line_id);
  const fixtureIds = picks.filter((p) => p.kind === 'fixture').map((p) => p.fixture_id);

  const [lines, fixtures, teams] = await Promise.all([
    lineIds.length
      ? sb.from('challenge_lines').select('id, line, players(short_name)').in('id', lineIds)
      : Promise.resolve({ data: [] as unknown[] }),
    fixtureIds.length
      ? sb.from('fixtures').select('id, home_code, away_code').in('id', fixtureIds)
      : Promise.resolve({ data: [] as unknown[] }),
    getTeams()
  ]);

  type LineRow = { id: number; line: number; players: { short_name: string } | null };
  type FixRow = { id: number; home_code: string; away_code: string };
  const lineById = new Map(((lines.data ?? []) as LineRow[]).map((l) => [l.id, l]));
  const fixtureById = new Map(((fixtures.data ?? []) as FixRow[]).map((f) => [f.id, f]));

  return picks.map((p) => {
    if (p.kind === 'player') {
      const l = lineById.get(p.line_id);
      return {
        id: `p${p.line_id}`,
        subject: l?.players?.short_name ?? 'Igrac',
        detail: l ? `granica ${l.line} FP` : '—',
        answer: p.answer === 'over' ? 'Iznad' : 'Ispod',
        correct: p.is_correct ?? null
      };
    }
    const f = fixtureById.get(p.fixture_id);
    return {
      id: `f${p.fixture_id}`,
      subject: f ? `${teamName(teams, f.home_code)} — ${teamName(teams, f.away_code)}` : 'Mec',
      detail: 'pobednik meca',
      answer: f ? teamName(teams, p.answer === 'home' ? f.home_code : f.away_code) : p.answer,
      correct: p.is_correct ?? null
    };
  });
}
