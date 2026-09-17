import type { Metadata } from 'next';
import { SectionHead } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import { SITE } from '@/lib/config';

export const metadata: Metadata = {
  alternates: { canonical: '/o-nama' },
  title: 'O nama',
  description: `${SITE.name} je nezavisna analitička platforma za EuroLeague Fantasy.`
};

/* Tekst tvrdi samo ono što sajt stvarno radi — faktori projekcije su isti
   kao u sekciji „Kako računamo projekcije?" na naslovnoj. */
export default function ONama() {
  return (
    <div className="page py-10">
      <div className="max-w-[68ch]">
        <SectionHead
          as="h1"
          eyebrow="O nama"
          title={SITE.name}
          desc="Nezavisna analitička platforma za EuroLeague Fantasy."
        />

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink-2">
          <section>
            <h2 className="text-[20px] uppercase leading-tight text-ink">Šta radimo</h2>
            <p className="mt-3">
              Za svakog igrača Evrolige poredimo cenu u zvaničnoj fantasy igri sa projektovanim
              brojem poena i pokazujemo ko se u kolu stvarno isplati. Uz to dajemo izbore kola,
              raspored sa procenom svakog meča, izazov kola i optimizator postave.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] uppercase leading-tight text-ink">Kako računamo</h2>
            <p className="mt-3">
              Projekcije se zasnivaju na stvarnim podacima: fantasy učinku i minutaži iz prošle
              sezone, promenama u rotaciji tima, ceni u zvaničnoj igri, proceni meča, domaćem terenu
              i dostupnosti igrača. Projekcija je procena, ne garancija.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] uppercase leading-tight text-ink">Nezavisnost</h2>
            <p className="mt-3">
              Nismo povezani sa Euroleague Basketball ni sa zvaničnom EuroLeague Fantasy igrom.
            </p>
          </section>

          <section>
            <h2 className="text-[20px] uppercase leading-tight text-ink">Kontakt</h2>
            <p className="mt-3">
              Pitanja, predlozi i saradnja:{' '}
              <a
                href={`mailto:${SITE.email}`}
                className="text-brand underline underline-offset-2 hover:text-brand-400"
              >
                {SITE.email}
              </a>
            </p>
          </section>
        </div>

        <LinkButton href="/igraci" className="mt-10">
          Pogledaj izbore kola
        </LinkButton>
      </div>
    </div>
  );
}
