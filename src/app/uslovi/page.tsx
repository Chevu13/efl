import type { Metadata } from 'next';
import Link from 'next/link';
import { Dokument, Odeljak } from '@/components/pravno/Dokument';
import { PLANS, SITE, priceLabel } from '@/lib/config';

export const metadata: Metadata = {
  alternates: { canonical: '/uslovi' },
  title: 'Uslovi koriscenja',
  description: `Pravila koriscenja sajta ${SITE.name}: nalog, paketi, placanje, povracaj novca i izazov kola.`
};

/*
 * Cene i trajanje paketa citaju se iz config.ts, pa ovaj tekst ne moze
 * da zaostane za tabelom cena.
 *
 * Povracaja novca nema — odluka vlasnika sajta. Jedini izuzetak je
 * uplata posle koje se paket nije otkljucao: tada se paket otkljucava,
 * jer usluga koja nije isporucena i nije prodata.
 *
 * ponytail: merodavno pravo (Srbija) i ogranicenje odgovornosti su
 * pocetne odluke, ne pravni savet.
 *
 * Platni servis nije imenovan kao jedini — moze se promeniti bez
 * menjanja uslova.
 */
export default function Uslovi() {
  const mejl = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;
  const dana = PLANS[0]?.days ?? 30;

  return (
    <Dokument
      naslov="Uslovi koriscenja"
      uvod="Koriscenjem sajta prihvatas ova pravila. Napisana su da se procitaju, ne da se preskoce."
      azurirano="17. septembar 2026."
    >
      <Odeljak id="sta-je" naslov="Sta je Euro Fantasy Lab">
        <p>
          {SITE.name} je nezavisna analiticka platforma za EuroLeague Fantasy. Nismo povezani sa
          Euroleague Basketball ni sa zvanicnom EuroLeague Fantasy igrom, i ne predstavljamo ih.
          Imena timova i igraca koristimo samo da opisemo stvarna takmicenja.
        </p>
      </Odeljak>

      <Odeljak id="nalog" naslov="Nalog">
        <ul>
          <li>Podaci pri otvaranju naloga treba da budu tacni.</li>
          <li>Jedan nalog po osobi. Nalog se ne deli i ne prodaje.</li>
          <li>Odgovoran si za lozinku i za ono sto se radi sa tvog naloga.</li>
        </ul>
      </Odeljak>

      <Odeljak id="projekcije" naslov="Projekcije nisu garancija">
        <p>
          Cene, projekcije, izbori kola i predlozi optimizatora su procene zasnovane na podacima i
          modelu. Kosarka je nepredvidiva — igrac moze da se povredi, da ne igra ili da odigra
          ispod ocekivanja. Odluke o svom timu donosis sam.
        </p>
        <p>
          Sadrzaj sajta nije savet za kladjenje i nije namenjen kladjenju.
        </p>
      </Odeljak>

      <Odeljak id="paketi" naslov="Paketi i placanje">
        <ul>
          <li>
            Paketi se placaju jednokratno i vaze {dana} dana od uplate:{' '}
            {PLANS.map((p) => `${p.name} ${priceLabel(p.priceCents)}`).join(', ')}.
          </li>
          <li>Nema automatske obnove — kad paket istekne, nalog se vraca na besplatan.</li>
          <li>
            Placanje ide preko PayPal-a ili drugog platnog servisa navedenog pri kupovini. Cene su
            u evrima.
          </li>
          <li>Pristup se otkljucava odmah posle potvrdjene uplate.</li>
        </ul>
      </Odeljak>

      <Odeljak id="povracaj" naslov="Bez povracaja novca">
        <p>
          Uplate se ne vracaju. Pristup se otkljucava odmah posle uplate, pa kupovinom pristajes
          da usluga pocne odmah i da nema prava na odustanak kad je paket otkljucan.
        </p>
        <p>
          Ako je uplata prosla a paket se nije otkljucao, pisi na {mejl} sa brojem transakcije —
          otkljucavamo paket za pun period.
        </p>
      </Odeljak>

      <Odeljak id="izazov" naslov="Izazov kola">
        <ul>
          <li>Ucesce je besplatno i bez uloga.</li>
          <li>
            Pobednik kola dobija Pro paket za sledecih 7 dana. Pobednik meseca dobija Ultra paket
            za ceo sledeci mesec.
          </li>
          <li>
            Nagrade su dani placenog paketa, ne novac, i ne mogu se zameniti za novac ili preneti.
          </li>
          <li>
            Odgovori se zakljucavaju pocetkom kola. Rezultat se racuna po zvanicnim statistikama
            utakmica.
          </li>
          <li>Vise naloga iste osobe ili drugi pokusaj varanja znaci gubitak nagrade.</li>
        </ul>
      </Odeljak>

      <Odeljak id="dozvoljeno" naslov="Sta nije dozvoljeno">
        <ul>
          <li>automatsko preuzimanje sadrzaja sa sajta (scraping);</li>
          <li>preprodaja ili javno objavljivanje placenih analiza;</li>
          <li>ometanje rada sajta ili zaobilazenje zakljucanih delova.</li>
        </ul>
      </Odeljak>

      <Odeljak id="prekid" naslov="Prekid">
        <p>
          Nalog mozes da ugasis kad hoces — pisi na {mejl}. Nalog koji krsi ova pravila mozemo da
          ugasimo, bez povracaja uplate.
        </p>
      </Odeljak>

      <Odeljak id="odgovornost" naslov="Odgovornost">
        <p>
          Sajt pruzamo takav kakav jeste i trudimo se da radi bez prekida, ali to ne mozemo da
          garantujemo. Ne odgovaramo za ishode odluka donetih na osnovu projekcija. Nasa
          odgovornost je ogranicena na iznos koji si platio u poslednjih {dana} dana.
        </p>
      </Odeljak>

      <Odeljak id="pravo" naslov="Merodavno pravo i izmene">
        <p>
          Na ove uslove primenjuje se pravo Republike Srbije. Ako ih menjamo, datum na vrhu se
          menja, a za vece izmene javljamo mejlom. Vidi i{' '}
          <Link href="/privatnost">politiku privatnosti</Link>.
        </p>
      </Odeljak>
    </Dokument>
  );
}
