'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Tier } from '@/lib/types';
import { TIER_RANK } from '@/lib/types';

/**
 * Cene menjaj ovde. Iznos mora da se poklapa sa `tierZaIznos`
 * u src/app/api/paypal/webhook/route.ts, inače će webhook dodeliti pogrešan paket.
 */
export const PAKETI: {
  tier: Tier; cena: number; opis: string; feats: string[]; istaknut?: boolean;
}[] = [
  {
    tier: 'FREE', cena: 0, opis: '1 izbor po kolu',
    feats: ['Izbor kola sa punom analizom', 'Predikcije za sve utakmice', 'Igra kola i nagrade']
  },
  {
    tier: 'PLUS', cena: 9, opis: '3 izbora po kolu',
    feats: ['Sve iz FREE', '3 najisplativija igrača kola', 'Cela tabela igrača']
  },
  {
    tier: 'PRO', cena: 19, opis: 'Svi igrači kola', istaknut: true,
    feats: ['Sve iz PLUS', 'Svi igrači sa cenom i projekcijom', 'Obrazloženje za svaki izbor', 'Forma i očekivani minuti']
  },
  {
    tier: 'ULTRA', cena: 29, opis: 'Optimizator tima',
    feats: ['Sve iz PRO', 'Najbolja 4 transfera za tvoj tim', 'Računa tvoje kredite', 'Objašnjenje svakog transfera']
  }
];

declare global {
  interface Window { paypal?: any }
}

export default function Paketi({ trenutni, userId }: { trenutni: Tier; userId: string | null }) {
  const [izabran, setIzabran] = useState<Tier | null>(null);

  return (
    <section className="mt-14">
      <p className="eyebrow">Paketi</p>
      <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">
        Otključaj ceo krug
      </h2>
      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted">
        Svaki paket koristi iste brojeve i iste kartice. Plaćaš širinu i optimizator,
        ne drugačiji proizvod.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PAKETI.map((p) => {
          const aktivan = p.tier === trenutni;
          const nizi = TIER_RANK[p.tier] < TIER_RANK[trenutni];

          return (
            <div key={p.tier}
                 className={`card flex flex-col gap-4 p-5 transition-transform hover:-translate-y-1
                   ${aktivan ? 'border-brand' : p.istaknut ? 'border-brand/40' : p.tier === 'ULTRA' ? 'border-data/40' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-[15px] font-bold tracking-wide">{p.tier}</span>
                  {p.istaknut && !aktivan && (
                    <span className="chip bg-brand/15 text-brand">najbolji izbor</span>
                  )}
                </div>
                <div className="stat mt-2 text-2xl">
                  {p.cena === 0 ? 'Besplatno' : `€${p.cena}`}
                  {p.cena > 0 && <span className="ml-1 text-[11px] font-normal text-muted">/ mesec</span>}
                </div>
              </div>

              <div className="border-b border-line pb-3 font-mono text-[12px] text-muted">{p.opis}</div>

              <ul className="flex-1 space-y-2">
                {p.feats.map((f) => (
                  <li key={f} className="flex gap-2 text-[13px] leading-snug text-muted">
                    <span className="mt-2 h-px w-2 shrink-0 bg-brand" />{f}
                  </li>
                ))}
              </ul>

              {aktivan ? (
                <span className="chip justify-center bg-brand/15 py-2.5 text-brand">Aktivan paket</span>
              ) : nizi || p.cena === 0 ? (
                <span className="chip justify-center bg-elev py-2.5 text-muted">Uključeno</span>
              ) : izabran === p.tier ? (
                <PayPalDugme tier={p.tier} cena={p.cena} userId={userId} />
              ) : (
                <button onClick={() => setIzabran(p.tier)}
                        className={p.istaknut ? 'btn-primary w-full' : 'btn-ghost w-full'}>
                  Uzmi {p.tier}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed tracking-wide text-muted">
        PLAĆANJE KARTICOM ILI PAYPAL NALOGOM · OTKAZIVANJE U SVAKOM TRENUTKU<br />
        NAGRADE IZ IGRE KOLA SE DODAJU NA POSTOJEĆU PRETPLATU
      </p>
    </section>
  );
}

/** Učitava PayPal skriptu tek kad korisnik zaista krene u kupovinu. */
function PayPalDugme({ tier, cena, userId }: { tier: Tier; cena: number; userId: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [stanje, setStanje] = useState<'ucitava' | 'spremno' | 'nema' | 'gotovo'>('ucitava');
  const router = useRouter();

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (!clientId) { setStanje('nema'); return; }
    if (!userId) { setStanje('nema'); return; }

    const prikazi = () => {
      if (!window.paypal || !box.current) return;
      box.current.innerHTML = '';
      window.paypal
        .Buttons({
          style: { layout: 'vertical', color: 'white', shape: 'rect', height: 40, label: 'pay' },
          createOrder: (_: unknown, actions: any) =>
            actions.order.create({
              purchase_units: [
                {
                  amount: { value: cena.toFixed(2), currency_code: 'EUR' },
                  description: `Euro Fantasy Lab — ${tier}, 30 dana`,
                  // po ovome webhook zna kome da doda pretplatu
                  custom_id: userId
                }
              ]
            }),
          onApprove: async (_: unknown, actions: any) => {
            await actions.order.capture();
            setStanje('gotovo');
            // webhook upisuje pretplatu; osveži za koji trenutak
            setTimeout(() => router.refresh(), 2500);
          }
        })
        .render(box.current);
      setStanje('spremno');
    };

    if (window.paypal) { prikazi(); return; }

    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&intent=capture`;
    s.onload = prikazi;
    s.onerror = () => setStanje('nema');
    document.body.appendChild(s);
  }, [clientId, userId, cena, tier, router]);

  if (stanje === 'gotovo') {
    return (
      <div className="rounded-card border border-ok/30 bg-ok/10 p-3 text-center">
        <p className="font-mono text-[11.5px] text-ok">UPLATA PRIMLJENA</p>
        <p className="mt-1 text-[12px] text-muted">Paket se aktivira za nekoliko sekundi.</p>
      </div>
    );
  }

  if (stanje === 'nema') {
    return (
      <div className="rounded-card border border-line bg-bg p-3 text-center">
        <p className="text-[12.5px] leading-relaxed text-muted">
          {!userId
            ? 'Prvo se prijavi da bismo pretplatu vezali za tvoj nalog.'
            : 'Plaćanje se uključuje uskoro. Do tada pretplatu dobijaš kodom.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div ref={box} className="min-h-[42px] [color-scheme:light]" />
      {stanje === 'ucitava' && (
        <p className="text-center font-mono text-[11px] text-muted">učitavam plaćanje…</p>
      )}
    </div>
  );
}
