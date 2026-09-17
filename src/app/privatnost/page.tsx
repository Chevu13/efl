import type { Metadata } from 'next';
import Link from 'next/link';
import { Dokument, Odeljak } from '@/components/pravno/Dokument';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  alternates: { canonical: '/privatnost' },
  title: 'Politika privatnosti',
  description: `Koje podatke ${SITE.name} cuva, zasto, kome ih poverava i kako da ih obrises.`
};

/*
 * Tekst opisuje ono sto kod stvarno radi (provereno 17.9.2026.):
 * nema analitike ni reklamnih kolacica, postava „Moj tim" zivi u
 * localStorage, kartica se nikad ne vidi, nalog se brise na zahtev.
 * Kad se neko od toga promeni u kodu, menja se i ovde.
 *
 * ponytail: rukovalac je naveden samo imenom sajta i mejlom. Za punu
 * uskladjenost sa ZZPL/GDPR dodati ime i adresu fizickog ili pravnog lica.
 */
export default function Privatnost() {
  const mejl = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

  return (
    <Dokument
      naslov="Politika privatnosti"
      uvod="Kratko i bez sitnih slova: sta cuvamo, zasto, i kako da trazis da se obrise."
      azurirano="17. septembar 2026."
    >
      <Odeljak id="ko" naslov="Ko obradjuje podatke">
        <p>
          Podatke obradjuje {SITE.name}, nezavisna analiticka platforma za EuroLeague Fantasy.
          Za sve u vezi sa privatnoscu pisi na {mejl}.
        </p>
      </Odeljak>

      <Odeljak id="podaci" naslov="Koje podatke cuvamo">
        <ul>
          <li>
            <b>Nalog:</b> mejl adresa, korisnicko ime i lozinka. Lozinku ne vidimo — cuva se samo
            kao kriptografski otisak.
          </li>
          <li>
            <b>Prijava preko Google-a:</b> ime, mejl i sliku profila koje Google posalje. Nista
            vise ne trazimo od tvog Google naloga.
          </li>
          <li>
            <b>Slika profila</b>, ako je sam dodas.
          </li>
          <li>
            <b>Izazov kola:</b> tvoji odgovori i koliko je bilo tacnih.
          </li>
          <li>
            <b>Placanje:</b> koji paket, kada, iznos i broj transakcije. Podatke o kartici i
            nalogu kod platnog servisa nikad ne vidimo — njih obradjuje platni servis.
          </li>
        </ul>
        <p>
          Postava koju sastavis u delu <Link href="/igra">Moj tim</Link> cuva se samo u tvom
          pregledacu i ne salje se nama.
        </p>
      </Odeljak>

      <Odeljak id="zasto" naslov="Zasto ih cuvamo">
        <ul>
          <li>da nalog radi i da ostanes prijavljen;</li>
          <li>da otkljucamo paket koji si platio i znamo do kada vazi;</li>
          <li>da racunamo rezultate izazova kola i nagrade;</li>
          <li>da posaljemo mejl za potvrdu naloga ili novu lozinku.</li>
        </ul>
        <p>
          Podatke ne prodajemo, ne koristimo za reklame i ne pravimo profile za treca lica.
        </p>
      </Odeljak>

      <Odeljak id="obradjivaci" naslov="Kome ih poveravamo">
        <p>Sajt radi uz nekoliko spoljnih servisa, i svaki dobija samo ono sto mu treba:</p>
        <ul>
          <li>
            <b>Supabase</b> — baza, prijava i cuvanje slika profila;
          </li>
          <li>
            <b>Vercel</b> — hosting sajta;
          </li>
          <li>
            <b>PayPal</b> ili drugi platni servis naveden pri kupovini — naplata paketa;
          </li>
          <li>
            <b>Resend</b> — slanje mejlova za potvrdu i lozinku;
          </li>
          <li>
            <b>Google</b> — samo ako se prijavis preko Google naloga.
          </li>
        </ul>
      </Odeljak>

      <Odeljak id="kolacici" naslov="Kolacici">
        <p>
          Koristimo samo kolacice bez kojih prijava ne radi — oni pamte da si prijavljen. Nema
          analitike, nema reklamnih kolacica i nema pracenja kroz druge sajtove, pa nema ni
          banera za pristanak.
        </p>
      </Odeljak>

      <Odeljak id="rok" naslov="Koliko dugo">
        <p>
          Podaci naloga stoje dok nalog postoji. Evidencija uplata cuva se onoliko koliko to
          nalazu propisi o racunovodstvu, i posle brisanja naloga.
        </p>
      </Odeljak>

      <Odeljak id="prava" naslov="Tvoja prava">
        <p>
          Mozes da trazis uvid u svoje podatke, ispravku, brisanje, kopiju u prenosivom obliku, ili
          da ulozis prigovor na obradu. Pisi na {mejl} sa adrese kojom je nalog otvoren —
          odgovaramo u roku od 30 dana.
        </p>
        <p>
          <b>Brisanje naloga</b> se trenutno radi na zahtev, istim mejlom. Brisemo nalog, sliku
          profila i odgovore iz izazova.
        </p>
        <p>
          Ako mislis da podatke obradjujemo protivno zakonu, mozes se obratiti Povereniku za
          informacije od javnog znacaja i zastitu podataka o licnosti.
        </p>
      </Odeljak>

      <Odeljak id="uzrast" naslov="Uzrast">
        <p>Nalog mogu da otvore osobe od 15 godina i starije.</p>
      </Odeljak>

      <Odeljak id="izmene" naslov="Izmene">
        <p>
          Ako promenimo ovu politiku, datum na vrhu se menja. Za vece izmene javljamo mejlom pre
          nego sto stupe na snagu. Vidi i <Link href="/uslovi">uslove koriscenja</Link>.
        </p>
      </Odeljak>
    </Dokument>
  );
}
