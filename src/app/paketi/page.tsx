import type { Metadata } from 'next';
import PricingTable from '@/components/premium/PricingTable';
import { Alert, SectionHead } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { getMySubscriptions, getMyTier } from '@/lib/data';
import { paypalConfigured, paypalEnv } from '@/lib/paypal/client';
import { PLANS, priceLabel } from '@/lib/config';
import { nadogradnja } from '@/lib/nadogradnja';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/paketi' },
  title: 'Paketi i cene',
  description:
    'Šta dobijaš besplatno, a šta u paketima Plus i Pro: izbori kola, igrači koje treba izbegavati, projekcije za sve igrače i optimizator postave.'
};

/**
 * Paketi i cene — javna stranica.
 *
 * Do sada su cene stajale samo na profilu, pa je link „Paketi i cene"
 * neprijavljenog posetioca slao na prijavu pre nego sto vidi ijednu cenu.
 * Ovde nema zahteva za nalogom; nalog treba tek za samu kupovinu.
 *
 * Tabela ispod prati stvarna pravila vidljivosti iz `trimForTier` i
 * `OPTIMIZER_LIMIT` — ako se ona promene, menja se i ova tabela.
 */

type Celija = boolean | string;

const POREDJENJE: { sta: string; free: Celija; plus: Celija; pro: Celija }[] = [
  { sta: 'Besplatan izbor kola', free: true, plus: true, pro: true },
  { sta: 'Raspored, procena mečeva i izazov kola', free: true, plus: true, pro: true },
  { sta: 'Izbori po poziciji i cenovnom rangu', free: false, plus: '18', pro: '18' },
  { sta: 'Igrači koje treba izbegavati', free: false, plus: '9', pro: '9' },
  { sta: 'Top 5 izbora kola i kapiten', free: false, plus: false, pro: true },
  { sta: 'Cela lista kola sa projekcijom za svakog igrača', free: false, plus: false, pro: true },
  { sta: 'Vlasništvo, prosek i minutaža', free: false, plus: false, pro: true },
  { sta: 'Optimizator — 4 najbolje izmene', free: false, plus: false, pro: true }
];

const PITANJA: [string, string][] = [
  [
    'Da li se paket sam obnavlja?',
    'Ne. Jedna uplata otključava paket na 30 dana. Kad istekne, nalog se vraća na besplatan i ništa se ne naplaćuje samo od sebe.'
  ],
  [
    'Imam Plus, a hoću Pro. Plaćam li punu cenu?',
    'Ne. Plaćaš samo razliku u ceni, prelaziš odmah, a novi paket važi do istog datuma do kog je važio stari.'
  ],
  [
    'Kako se plaća?',
    'Preko PayPal-a. Za kupovinu treba nalog na sajtu, da bi paket znao kome pripada.'
  ],
  [
    'Mogu li da dobijem novac nazad?',
    'Uplate se ne vraćaju, jer se pristup otključava odmah. Ako je uplata prošla a paket se nije otključao, javi se sa brojem transakcije i otključavamo ga za pun period.'
  ]
];

export default async function Paketi() {
  const me = await getMyTier();
  const subs = me.userId ? await getMySubscriptions() : [];

  return (
    <div className="page py-10">
      <SectionHead
        as="h1"
        eyebrow="Paketi"
        title="Paketi i cene"
        desc={`Besplatno vidiš izbor kola, raspored i izazov. Plaćeni paketi otključavaju više izbora, projekcije i optimizator — od ${priceLabel(
          Math.min(...PLANS.map((p) => p.priceCents))
        )}, bez automatske obnove.`}
      />

      <div className="mt-8">
        <PricingTable
          tier={me.tier}
          loggedIn={!!me.userId}
          paypalReady={paypalConfigured()}
          nadogradnje={Object.fromEntries(
            PLANS.map((p) => [p.code, nadogradnja(subs, p.code) ?? undefined])
          )}
        />
      </div>

      {paypalConfigured() && paypalEnv() === 'sandbox' && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
          PayPal radi u probnom režimu — uplate nisu stvarne.
        </p>
      )}

      {/* ---------------- poređenje ---------------- */}
      <section className="mt-16">
        <SectionHead
          eyebrow="Poređenje"
          title="Šta tačno dobijaš"
          desc="Isto pravilo važi svuda na sajtu: brojeve koje paket ne otključava server ni ne šalje u pregledač."
        />

        <div className="mt-6 overflow-hidden rounded-md border border-line">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[520px]">
              <caption className="sr-only">Poređenje paketa</caption>
              <thead>
                <tr>
                  <th scope="col">Funkcija</th>
                  <th scope="col" className="text-center">
                    Besplatno
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.code}
                      scope="col"
                      className={`text-center ${p.tier === me.tier ? 'text-brand' : ''}`}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POREDJENJE.map((red) => (
                  <tr key={red.sta}>
                    <th scope="row" className="text-left text-[13.5px] font-medium text-ink-2">
                      {red.sta}
                    </th>
                    {[red.free, red.plus, red.pro].map((c, i) => (
                      <td key={i} className="text-center">
                        <Oznaka vrednost={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------- pitanja ---------------- */}
      <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_2fr]">
        <SectionHead eyebrow="Pitanja" title="Pre nego što kupiš" />
        <dl className="divide-y divide-line border-y border-line">
          {PITANJA.map(([q, a]) => (
            <div key={q} className="py-4">
              <dt className="text-[15px] font-semibold text-ink">{q}</dt>
              <dd className="mt-1.5 text-small leading-relaxed text-ink-3">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {!me.userId && (
        <div className="mt-12">
          <Alert tone="info" title="Nalog ti treba tek za kupovinu">
            <span className="block">
              Cene i poređenje vidiš bez prijave. Kad izabereš paket, napraviš nalog i nastavljaš
              na plaćanje.
            </span>
            <LinkButton href="/prijava?reg=1&next=%2Fpaketi" size="sm" className="mt-3">
              Napravi besplatan nalog
            </LinkButton>
          </Alert>
        </div>
      )}
    </div>
  );
}

function Oznaka({ vrednost }: { vrednost: Celija }) {
  if (vrednost === true) {
    return (
      <span className="font-bold text-brand" aria-label="Da">
        ✓
      </span>
    );
  }
  if (vrednost === false) {
    return (
      <span className="text-ink-4" aria-label="Ne">
        —
      </span>
    );
  }
  return <span className="statmono text-[13px] text-ink">{vrednost}</span>;
}
