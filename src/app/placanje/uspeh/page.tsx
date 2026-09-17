import type { Metadata } from 'next';
import Link from 'next/link';
import Logomark from '@/components/brand/Logomark';
import { Alert } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { getMyTier } from '@/lib/data';
import { planByCode } from '@/lib/config';
import { TIER_RANK, type Tier } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Uplata',
  robots: { index: false }
};

/**
 * Ishod placanja.
 *
 * Paket se NE dodeljuje ovde. Uplata je vec naplacena i proverena u
 * /api/paypal/return, a ova stranica samo cita stvarno stanje naloga iz
 * baze. Dolazak na ovu adresu sam po sebi ne otkljucava nista.
 */

type Status =
  | 'uspeh'
  | 'u-obradi'
  | 'nije-placeno'
  | 'bez-naloga'
  | 'greska-baza'
  | 'greska';

const PORUKE: Record<Status, { tone: 'ok' | 'warn' | 'error'; title: string; body: string }> = {
  uspeh: {
    tone: 'ok',
    title: 'Uplata je potvrdjena',
    body: 'Paket je aktivan i sadrzaj je otkljucan odmah.'
  },
  'u-obradi': {
    tone: 'warn',
    title: 'Uplata je primljena, jos se obradjuje',
    body: 'PayPal je jos nije potvrdio do kraja. Cim potvrdi, paket se ukljucuje sam — obicno u roku od nekoliko minuta.'
  },
  'nije-placeno': {
    tone: 'warn',
    title: 'Uplata nije zavrsena',
    body: 'Narudzbina postoji, ali placanje nije proslo. Pokusaj ponovo — nista ti nije naplaceno.'
  },
  'bez-naloga': {
    tone: 'error',
    title: 'Uplata nije vezana za nalog',
    body: 'Novac je naplacen, ali ne mozemo da odredimo kom nalogu pripada. Javi nam se sa brojem narudzbine i resicemo rucno.'
  },
  'greska-baza': {
    tone: 'error',
    title: 'Uplata je prosla, upis nije',
    body: 'Naplata je uspela ali paket jos nije upisan. PayPal ponavlja obavestenje, pa se to najcesce sredi samo. Ako se ne sredi za sat vremena, javi nam broj narudzbine.'
  },
  greska: {
    tone: 'error',
    title: 'Nesto je poslo naopako',
    body: 'Nismo uspeli da zavrsimo proveru uplate. Proveri profil — ako paket nije aktivan, a novac je naplacen, javi nam broj narudzbine.'
  }
};

export default async function Uspeh({
  searchParams
}: {
  searchParams: { status?: string; order?: string; paket?: string };
}) {
  const status = (searchParams.status ?? 'greska') as Status;

  /* Stvarno stanje — iz baze, ne iz adrese. */
  const me = await getMyTier();
  const plan = planByCode(me.tier);
  /* Aktivan znaci: nalog ima bar onaj paket koji je kupljen. Samo „nije
     FREE" je prijavljivalo uspeh i kad je Plus korisnik kupio Pro, a Pro
     se nije ukljucio. */
  const kupljen = searchParams.paket as Tier | undefined;
  const active =
    kupljen && kupljen in TIER_RANK
      ? TIER_RANK[me.tier] >= TIER_RANK[kupljen]
      : me.tier !== 'FREE';

  /* Adresa moze da tvrdi sta hoce; poruka prati ono sto stvarno pise u
     bazi. Zato otvaranje ove adrese rukom nikome nista ne otkljucava i,
     jednako vazno, nikome ne kaze da jeste. */
  const effective: Status = status === 'uspeh' && !active ? 'u-obradi' : status;
  const msg = PORUKE[effective] ?? PORUKE.greska;

  return (
    <div className="page flex min-h-[calc(100dvh-var(--nav-h))] items-center justify-center py-16">
      <div className="w-full max-w-lg">
        <div className="flex justify-center">
          <Logomark size={56} />
        </div>

        <h1 className="mt-7 text-center text-[clamp(26px,5vw,38px)] uppercase leading-none">
          {msg.title}
        </h1>

        <p className="mx-auto mt-4 max-w-md text-center text-body leading-relaxed text-ink-2">
          {msg.body}
        </p>

        {/* stanje naloga, kako god da je uplata prosla */}
        <div className="mt-8 overflow-hidden rounded-md border border-line">
          <div className="flex items-center justify-between gap-4 bg-surface px-5 py-4">
            <span className="label">Paket na nalogu</span>
            <span className={`stat text-[24px] ${me.tier === 'FREE' ? 'text-ink-3' : 'text-brand'}`}>
              {me.tier}
            </span>
          </div>
          {plan && (
            <p className="border-t border-line bg-sunken px-5 py-3 text-small text-ink-3">
              {plan.pitch}
            </p>
          )}
        </div>

        {!me.userId && (
          <div className="mt-4">
            <Alert tone="warn" title="Nisi prijavljen">
              Paket se vezuje za nalog. Prijavi se istim mejlom sa kojim si
              zapoceo kupovinu, pa ce se pojaviti na profilu.
            </Alert>
          </div>
        )}

        {effective !== 'uspeh' && me.userId && (
          <div className="mt-4">
            <Alert tone={msg.tone}>
              {searchParams.order ? (
                <>
                  Broj narudzbine:{' '}
                  <code className="font-mono text-ink">{searchParams.order}</code>
                </>
              ) : (
                'Ako je iznos naplacen, a paket se ne pojavi u roku od sat vremena, javi nam se.'
              )}
            </Alert>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/igraci">Otvori izbore kola</LinkButton>
          <LinkButton href="/optimizator" variant="ghost">
            Optimizator
          </LinkButton>
          <LinkButton href="/profil" variant="quiet">
            Profil
          </LinkButton>
        </div>

        <p className="mt-8 text-center text-[11.5px] text-ink-4">
          Ne vidis promenu?{' '}
          <Link href="/profil" className="link">
            Osvezi profil
          </Link>{' '}
          — paket se cita iz baze pri svakom ucitavanju.
        </p>
      </div>
    </div>
  );
}
