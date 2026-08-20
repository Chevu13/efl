import { createClient } from '@/lib/supabase/server';
import type { ChallengeLine, Fixture, Player, PlayerRound, PricedPlayer, Round, Team, Tier } from './types';

export async function getTeams(): Promise<Record<string, Team>> {
  const sb = createClient();
  const { data } = await sb.from('teams').select('*');
  return Object.fromEntries((data ?? []).map((t) => [t.code, t as Team]));
}

export async function getCurrentRound(): Promise<Round | null> {
  const sb = createClient();
  const { data } = await sb
    .from('rounds')
    .select('*')
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Round) ?? null;
}

export async function getFixtures(roundId: number): Promise<Fixture[]> {
  const sb = createClient();
  const { data } = await sb.from('fixtures').select('*').eq('round_id', roundId).order('tip_off');
  return (data ?? []) as Fixture[];
}

export async function getAllPlayers(): Promise<Player[]> {
  const sb = createClient();
  const { data } = await sb.from('players').select('*').eq('active', true).order('team_code');
  return (data ?? []) as Player[];
}

/** Igrači sa cenom za dato kolo, sortirani po vrednosti. */
export async function getPricedPlayers(roundId: number): Promise<PricedPlayer[]> {
  const sb = createClient();
  const { data } = await sb
    .from('player_rounds')
    .select('*, players(*)')
    .eq('round_id', roundId)
    .not('price', 'is', null)
    .order('value_score', { ascending: false });

  return (data ?? [])
    .filter((r: any) => r.players)
    .map((r: any) => ({ ...(r.players as Player), ...(r as PlayerRound) })) as PricedPlayer[];
}

export async function getChallengeLines(roundId: number) {
  const sb = createClient();
  const { data } = await sb
    .from('challenge_lines')
    .select('*, players(*)')
    .eq('round_id', roundId);
  return (data ?? []) as (ChallengeLine & { players: Player })[];
}

export async function getMyTier(): Promise<{ email: string | null; tier: Tier; userId: string | null }> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { email: null, tier: 'FREE', userId: null };
  const { data } = await sb.rpc('moj_tier', { uid: user.id });
  return { email: user.email ?? null, tier: (data as Tier) ?? 'FREE', userId: user.id };
}

export async function getLeaderboard() {
  const sb = createClient();
  const { data } = await sb
    .from('leaderboard_season')
    .select('*')
    .order('accuracy', { ascending: false })
    .limit(10);
  return data ?? [];
}
