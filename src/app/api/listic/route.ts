import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Pick =
  | { kind: 'player'; line_id: number; answer: 'over' | 'under' }
  | { kind: 'fixture'; fixture_id: number; answer: 'home' | 'away' };

export async function POST(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Prvo se prijavi.' }, { status: 401 });

  const { round_id, picks } = (await req.json()) as { round_id: number; picks: Pick[] };
  if (!round_id || !Array.isArray(picks) || !picks.length) {
    return NextResponse.json({ error: 'Prazan listić.' }, { status: 400 });
  }

  const { data: round } = await sb.from('rounds').select('status').eq('id', round_id).single();
  if (round?.status !== 'open') {
    return NextResponse.json({ error: 'Kolo je zaključano.' }, { status: 409 });
  }

  const { data: entry, error } = await sb
    .from('entries')
    .upsert({ user_id: user.id, round_id }, { onConflict: 'user_id,round_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('picks').delete().eq('entry_id', entry.id);
  const { error: e2 } = await sb.from('picks').insert(picks.map((p) => ({ entry_id: entry.id, ...p })));
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true, entry_id: entry.id });
}

export async function GET(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ picks: [] });

  const roundId = Number(new URL(req.url).searchParams.get('round_id'));
  const { data: entry } = await sb
    .from('entries').select('id')
    .eq('user_id', user.id).eq('round_id', roundId).maybeSingle();
  if (!entry) return NextResponse.json({ picks: [] });

  const { data: picks } = await sb.from('picks').select('*').eq('entry_id', entry.id);
  return NextResponse.json({ entry_id: entry.id, picks: picks ?? [] });
}
