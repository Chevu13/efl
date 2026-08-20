import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Prvo se prijavi.' }, { status: 401 });

  const { kod } = await req.json().catch(() => ({ kod: '' }));
  if (!kod || typeof kod !== 'string') {
    return NextResponse.json({ error: 'Nedostaje kod.' }, { status: 400 });
  }

  const { data, error } = await sb.rpc('iskoristi_kod', { p_code: kod.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data === 'nevazeci') {
    return NextResponse.json({ error: 'Kod nije važeći ili je već iskorišćen.' }, { status: 400 });
  }
  return NextResponse.json({ tier: data });
}
