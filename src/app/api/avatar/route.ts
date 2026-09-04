import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Slika profila.
 *
 * Upload ide kroz server, ne pravo iz pregledaca u Storage. Tako je
 * provera tipa i velicine na granici poverenja, a ne stvar toga sta je
 * klijent poslao — i ne treba posebna RLS politika nad bucket-om.
 *
 * Putanja je uvek `<userId>.<ext>`, pa nova slika pregazi staru i jedan
 * nalog ne moze da natrpa Storage.
 */

const DOZVOLJENO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const MAX = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const sb = createClient();
  const {
    data: { user }
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Prvo se prijavi.' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('slika');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Nema fajla.' }, { status: 400 });
  }

  const ext = DOZVOLJENO[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'Dozvoljeni su samo JPG, PNG i WEBP.' },
      { status: 415 }
    );
  }
  if (file.size > MAX) {
    return NextResponse.json({ error: 'Slika ne sme biti veca od 2 MB.' }, { status: 413 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  /* Stara slika moze imati drugu ekstenziju — obrisi sve varijante da
     ne ostane siroce koje niko ne prikazuje ali zauzima mesto. */
  await admin.storage
    .from('avatars')
    .remove(Object.values(DOZVOLJENO).map((e) => `${user.id}.${e}`));

  const putanja = `${user.id}.${ext}`;
  const { error } = await admin.storage
    .from('avatars')
    .upload(putanja, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* `v` obara kes pregledaca — putanja je ista pri svakoj promeni. */
  const avatar = `avatars/${putanja}?v=${Date.now()}`;
  const { error: me } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar }
  });
  if (me) return NextResponse.json({ error: me.message }, { status: 500 });

  return NextResponse.json({ ok: true, avatar });
}

export async function DELETE() {
  const sb = createClient();
  const {
    data: { user }
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Prvo se prijavi.' }, { status: 401 });

  const admin = createAdminClient();
  await admin.storage
    .from('avatars')
    .remove(Object.values(DOZVOLJENO).map((e) => `${user.id}.${e}`));
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar: null }
  });
  return NextResponse.json({ ok: true });
}
